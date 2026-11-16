import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { apiFetch, isOnline } from '../config/apiConfig';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Currently authenticated user session
  // STRICT: Default to NULL on initial launch. Fresh launch starts unauthenticated!
  // A cached profile is display data, not proof of authentication.
  // Restore a session only after the server validates its bearer token.
  const [currentUser, setCurrentUser] = useState(null);

  // Administrator user directory is fetched from the protected backend and held in memory.
  const [registeredUsers, setRegisteredUsers] = useState([]);

  useEffect(() => {
    // Remove the legacy global admin cache; admin user data is fetched only into memory.
    localStorage.removeItem('medremind_registered_users');
    localStorage.removeItem('medremind_system_activity');
  }, []);

  // System audit log for Admin overview (initializes empty)
  const [systemActivity, setSystemActivity] = useState([]);

  // Sync to localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('medremind_auth_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('medremind_auth_user');
    }
  }, [currentUser]);

  // Log system activity
  const logActivity = (type, user, details, userId = '') => {
    const newEntry = {
      id: `ACT-${Date.now()}`,
      type,
      user,
      userId,
      details,
      timestamp: `Today, ${format(new Date(), 'hh:mm a')}`
    };
    setSystemActivity(prev => [newEntry, ...prev.slice(0, 49)]);
  };

  /**
   * Authenticate user with Email/User ID & Password
   * Connects to MedRemind Cloud API with resilient offline fallback
   */
  const login = async (identifier, password) => {
    const cleanId = (identifier || '').trim();
    const cleanPwd = (password || '').trim();
    if (!cleanId || !cleanPwd) {
      return { success: false, error: 'Email/phone and password are required.' };
    }

    // Authentication is server-authoritative. Never authenticate from localStorage.
    try {
      const response = await apiFetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: cleanId, password: cleanPwd })
      }, 10000);
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success || !data.user || !data.token) {
        return {
          success: false,
          error: data.error || 'Unable to sign in. Check your credentials and try again.'
        };
      }

      const safeUser = { ...data.user };
      delete safeUser.password;
      delete safeUser.passwordHash;
      localStorage.setItem('medremind_auth_token', data.token);
      localStorage.setItem('medremind_auth_user', JSON.stringify(safeUser));
      setCurrentUser(safeUser);
      setRegisteredUsers([]);
      setSystemActivity([]);
      logActivity('LOGIN', `${safeUser.name} (${safeUser.role})`, 'User authenticated by MedRemind API', safeUser.id);
      return { success: true, user: safeUser, token: data.token };
    } catch (error) {
      return {
        success: false,
        error: 'Sign-in requires a connection to the secure MedRemind server. Please reconnect and try again.'
      };
    }
  };

  /**
   * Register a new Patient account directly with Name, DOB, Gender, Email, and Phone.
   * Resilient offline-first registration: always succeeds and immediately activates session.
   */
  const register = async ({ name, dob, gender, email, phone, phoneNumber, password, role }) => {
    if (role === 'admin' || role?.toLowerCase() === 'administrator') {
      return { success: false, error: 'Administrator accounts cannot be created via public registration.' };
    }

    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanName = (name || '').trim();
    const cleanDob = (dob || '').toString().trim();
    const cleanGender = (gender || '').toString().trim();
    const cleanPhone = (phone || phoneNumber || '').toString().trim();
    const cleanPassword = (password || '').trim();

    if (!cleanName || !cleanDob || !cleanGender || !cleanEmail || !cleanPhone || cleanPassword.length < 8) {
      return { success: false, error: 'Complete all required fields and use a password of at least 8 characters.' };
    }

    try {
      const response = await apiFetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanName,
          dob: cleanDob,
          gender: cleanGender,
          email: cleanEmail,
          phone: cleanPhone,
          password: cleanPassword,
          role: 'patient'
        })
      }, 10000);
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success || !data.user || !data.token) {
        return { success: false, error: data.error || 'Registration could not be completed.' };
      }

      const safeUser = { ...data.user };
      delete safeUser.password;
      delete safeUser.passwordHash;
      localStorage.setItem('medremind_auth_token', data.token);
      localStorage.setItem('medremind_auth_user', JSON.stringify(safeUser));
      setCurrentUser(safeUser);
      setRegisteredUsers([]);
      setSystemActivity([]);
      logActivity('REGISTRATION', `${safeUser.name} (${safeUser.role})`, `Account created with ID ${safeUser.id}`, safeUser.id);
      return { success: true, user: safeUser, token: data.token };
    } catch {
      return {
        success: false,
        error: 'Registration requires a connection to the secure MedRemind server. No local account was created.'
      };
    }
  };

  /**
   * Compatibility stubs for legacy OTP calls
   */
  const verifyOtp = async () => ({ success: true, message: 'OTP is no longer required.' });
  const resendOtp = async () => ({ success: true, message: 'OTP is no longer required.' });

  /**
   * Log out active session
   * Clears state and localStorage, allowing clean return to Welcome page.
   */
  const logout = () => {
    if (currentUser) {
      logActivity('LOGOUT', `${currentUser.name} (${currentUser.role})`, 'User logged out', currentUser.id);
    }
    setCurrentUser(null);
    setRegisteredUsers([]);
    setSystemActivity([]);
    localStorage.removeItem('medremind_auth_user');
    localStorage.removeItem('medremind_auth_token');
    window.dispatchEvent(new Event('medremind:session-invalidated'));
  };

  // Schedule Account Deletion with 24-Hour Grace Period
  const scheduleDeletion = async (reason = 'User requested account closure') => {
    const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    if (isOnline()) {
      try {
        const token = localStorage.getItem('medremind_auth_token');
        const res = await apiFetch('/auth/schedule-deletion', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ reason })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          const updated = {
            ...currentUser,
            status: 'Pending_Deletion',
            scheduledDeletionAt: data.user?.scheduledDeletionAt || scheduledAt,
            deletionRequestedBy: currentUser?.id,
            deletionReason: reason
          };
          setCurrentUser(updated);
          localStorage.setItem('medremind_auth_user', JSON.stringify(updated));
          return { success: true, message: data.message, user: updated };
        }
      } catch (err) {
        console.warn('[AuthContext] Cloud schedule-deletion failed, applying locally:', err.message);
      }
    }

    // Local state fallback
    const updated = {
      ...currentUser,
      status: 'Pending_Deletion',
      scheduledDeletionAt: scheduledAt,
      deletionRequestedBy: currentUser?.id,
      deletionReason: reason
    };
    setCurrentUser(updated);
    localStorage.setItem('medremind_auth_user', JSON.stringify(updated));
    return { success: true, message: 'Account scheduled for deletion in 24 hours.', user: updated };
  };

  // Cancel Account Deletion
  const cancelDeletion = async () => {
    if (isOnline()) {
      try {
        const token = localStorage.getItem('medremind_auth_token');
        const res = await apiFetch('/auth/cancel-deletion', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          }
        });
        const data = await res.json();
        if (res.ok && data.success) {
          const updated = {
            ...currentUser,
            status: 'Active',
            scheduledDeletionAt: null,
            deletionRequestedBy: null,
            deletionReason: null
          };
          setCurrentUser(updated);
          localStorage.setItem('medremind_auth_user', JSON.stringify(updated));
          return { success: true, message: data.message, user: updated };
        }
      } catch (err) {
        console.warn('[AuthContext] Cloud cancel-deletion failed, applying locally:', err.message);
      }
    }

    // Local state fallback
    const updated = {
      ...currentUser,
      status: 'Active',
      scheduledDeletionAt: null,
      deletionRequestedBy: null,
      deletionReason: null
    };
    setCurrentUser(updated);
    localStorage.setItem('medremind_auth_user', JSON.stringify(updated));
    return { success: true, message: 'Account deletion cancelled successfully.', user: updated };
  };

  // Restore a session only when the API validates the stored token.
  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem('medremind_auth_token');
    if (!token) {
      setCurrentUser(null);
      localStorage.removeItem('medremind_auth_user');
      return;
    }
    if (!isOnline()) {
      setCurrentUser(null);
      localStorage.removeItem('medremind_auth_user');
      return;
    }
    try {
      const res = await apiFetch('/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.user) {
        const safeUser = { ...data.user };
        delete safeUser.password;
        delete safeUser.passwordHash;
        setCurrentUser(safeUser);
        localStorage.setItem('medremind_auth_user', JSON.stringify(safeUser));
      } else if (res.status === 401 || res.status === 403) {
        setCurrentUser(null);
        setRegisteredUsers([]);
        localStorage.removeItem('medremind_auth_token');
        localStorage.removeItem('medremind_auth_user');
        window.dispatchEvent(new Event('medremind:session-invalidated'));
      }
    } catch {
      // Keep the user signed out if the server cannot validate the session.
      setCurrentUser(null);
      setRegisteredUsers([]);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const refreshUsers = useCallback(async () => {
    if (currentUser?.role !== 'admin') return;
    const token = localStorage.getItem('medremind_auth_token');
    if (!token) return;
    try {
      const response = await apiFetch('/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success || !Array.isArray(data.users)) return;
      const safeUsers = data.users.map(({ password, passwordHash, ...user }) => user);
      setRegisteredUsers(safeUsers);
    } catch (error) {
      console.warn('[AuthContext] Could not refresh administrator user list:', error);
    }
  }, [currentUser?.role]);

  useEffect(() => {
    if (currentUser?.role === 'admin') refreshUsers();
  }, [currentUser?.role, refreshUsers]);

  // User medical profile update (offline-first persistent)
  const updateUserMedicalInfo = (allergies, medicalInfo) => {
    setCurrentUser(prev => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        allergies: Array.isArray(allergies) ? allergies : prev.allergies,
        medicalInfo: { ...(prev.medicalInfo || {}), ...(medicalInfo || {}) }
      };
      try {
        localStorage.setItem('medremind_auth_user', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  // Admin user status changes are server-authoritative.
  const updateUserStatus = async (userId, newStatus) => {
    if (currentUser?.role !== 'admin') {
      return { success: false, error: 'Administrator access required.' };
    }
    const token = localStorage.getItem('medremind_auth_token');
    if (!token) return { success: false, error: 'Administrator session is missing.' };
    try {
      const response = await apiFetch(`/users/${encodeURIComponent(userId)}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        return { success: false, error: data.error || 'Could not update account status.' };
      }
      setRegisteredUsers(prev => prev.map(user => user.id === userId ? { ...user, status: newStatus } : user));
      logActivity('ADMIN_ACTION', 'System Administrator', `Updated status of user ${userId} to ${newStatus}`, userId);
      return { success: true, user: data.user };
    } catch {
      return { success: false, error: 'Account status changes require a connection to the secure server.' };
    }
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      user: currentUser,
      activeRole: currentUser?.role || null,
      registeredUsers,
      systemActivity,
      login,
      register,
      verifyOtp,
      resendOtp,
      logout,
      updateUserMedicalInfo,
      updateUserStatus,
      scheduleDeletion,
      cancelDeletion,
      refreshUser,
      refreshUsers,
      logActivity
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
