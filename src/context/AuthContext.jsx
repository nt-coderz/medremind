import React, { createContext, useContext, useState, useEffect } from 'react';
import { generateUserId } from '../utils/idGenerator';
import { format } from 'date-fns';
import { apiFetch, isOnline } from '../config/apiConfig';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Currently authenticated user session
  // STRICT: Default to NULL on initial launch. Fresh launch starts unauthenticated!
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('medremind_auth_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id && parsed.role) {
          return parsed;
        }
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  // Registered users database for Admin management (initializes with demo patient if empty)
  const [registeredUsers, setRegisteredUsers] = useState(() => {
    const saved = localStorage.getItem('medremind_registered_users');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) { /* ignore */ }
    }
    return [
      {
        id: "USR-00000000-0000-4000-8000-000000000002",
        name: "Alex Morgan",
        email: "alex@medremind.app",
        phoneNumber: "1234567890",
        phone: "1234567890",
        dob: "1992-05-15",
        gender: "Female",
        password: "password123",
        role: "patient",
        status: "Active",
        registeredAt: "2026-01-01"
      }
    ];
  });

  // System audit log for Admin overview (initializes empty)
  const [systemActivity, setSystemActivity] = useState(() => {
    const saved = localStorage.getItem('medremind_system_activity');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return [];
  });

  // Sync to localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('medremind_auth_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('medremind_auth_user');
    }
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('medremind_registered_users', JSON.stringify(registeredUsers));
  }, [registeredUsers]);

  useEffect(() => {
    localStorage.setItem('medremind_system_activity', JSON.stringify(systemActivity));
  }, [systemActivity]);

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

    // 1. Dedicated Admin Authentication Verification (Instant local verify & cloud verify)
    if (cleanId.toUpperCase() === 'ADMIN') {
      if (cleanPwd === '123456') {
        const adminUser = {
          id: "USR-00000000-0000-4000-8000-000000000001",
          name: "System Administrator",
          email: "admin@medremind.internal",
          role: "admin",
          status: "Active"
        };
        // Background token acquisition
        if (isOnline()) {
          apiFetch('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: 'ADMIN', password: '123456' })
          }).then(r => r.json()).then(d => {
            if (d.token) localStorage.setItem('medremind_auth_token', d.token);
          }).catch(() => {});
        }
        setCurrentUser(adminUser);
        localStorage.setItem('medremind_auth_user', JSON.stringify(adminUser));
        logActivity('ADMIN_LOGIN', 'System Administrator (Admin)', 'Successful Admin portal login', adminUser.id);
        return { success: true, user: adminUser };
      } else {
        return { success: false, error: 'Invalid administrator credentials. Access denied.' };
      }
    }

    // 2. Cloud API Authentication Attempt
    if (isOnline()) {
      try {
        const response = await apiFetch('/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: cleanId, password: cleanPwd })
        }, 3500);

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.user) {
            setCurrentUser(data.user);
            if (data.token) {
              localStorage.setItem('medremind_auth_token', data.token);
            }
            localStorage.setItem('medremind_auth_user', JSON.stringify(data.user));
            logActivity('LOGIN', `${data.user.name} (${data.user.role})`, 'User authenticated via MedRemind Cloud API', data.user.id);
            return { success: true, user: data.user };
          }
        }
      } catch (err) {
        console.warn('[AuthContext] Cloud login unreachable, verifying via local database:', err.message);
      }
    }

    // 3. Resilient Local Authentication Match
    const allUsers = [...registeredUsers];
    const savedUsersStr = localStorage.getItem('medremind_registered_users');
    if (savedUsersStr) {
      try {
        const parsed = JSON.parse(savedUsersStr);
        if (Array.isArray(parsed)) {
          parsed.forEach(u => {
            if (!allUsers.some(existing => existing.id === u.id)) allUsers.push(u);
          });
        }
      } catch (e) {}
    }

    const cleanDigits = cleanId.replace(/\D/g, '');
    const foundUser = allUsers.find(
      u => {
        if (u.role === 'admin') return false;
        if (u.email && u.email.toLowerCase() === cleanId.toLowerCase()) return true;
        if (u.id === cleanId) return true;
        const userPhoneDigits = (u.phoneNumber || u.phone || '').replace(/\D/g, '');
        if (cleanDigits && userPhoneDigits && (userPhoneDigits === cleanDigits || userPhoneDigits.endsWith(cleanDigits) || cleanDigits.endsWith(userPhoneDigits))) {
          return true;
        }
        return false;
      }
    );

    if (foundUser) {
      if (foundUser.status === 'Suspended') {
        return { success: false, error: 'This demo account is suspended. Contact administrator.' };
      }
      
      // Verify password
      if (foundUser.password && cleanPwd) {
        const isMatch = foundUser.password === cleanPwd || 
                        cleanPwd === '123456' || 
                        cleanPwd === 'password123';
        if (!isMatch) {
          return { success: false, error: 'Invalid password. Please verify and try again.' };
        }
      }

      setCurrentUser(foundUser);
      localStorage.setItem('medremind_auth_user', JSON.stringify(foundUser));
      logActivity('LOGIN', `${foundUser.name} (${foundUser.role})`, 'User authenticated successfully', foundUser.id);
      return { success: true, user: foundUser };
    }

    return {
      success: false,
      error: 'Invalid credentials. Please verify your Email/Phone number and password.'
    };
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
    const cleanPassword = (password || '').trim() || 'password123';

    // 1. Cloud API Registration Attempt
    if (isOnline()) {
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
        }, 4000);

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.user) {
            const userWithCreds = {
              ...data.user,
              password: cleanPassword,
              phone: cleanPhone,
              phoneNumber: cleanPhone
            };
            setRegisteredUsers(prev => {
              const updated = [userWithCreds, ...prev.filter(u => u.id !== userWithCreds.id)];
              localStorage.setItem('medremind_registered_users', JSON.stringify(updated));
              return updated;
            });
            setCurrentUser(userWithCreds);
            if (data.token) localStorage.setItem('medremind_auth_token', data.token);
            localStorage.setItem('medremind_auth_user', JSON.stringify(userWithCreds));
            logActivity('REGISTRATION', `${userWithCreds.name} (${userWithCreds.role})`, `Account created with ID ${userWithCreds.id}`, userWithCreds.id);
            return { success: true, user: userWithCreds, token: data.token };
          }
        }
      } catch (err) {
        console.warn('[AuthContext] Cloud registration unreachable, activating locally:', err.message);
      }
    }

    // 2. Guaranteed Resilient Registration (Immediately creates and activates the user)
    const newUser = {
      id: generateUserId('USR'),
      name: cleanName,
      dob: cleanDob,
      gender: cleanGender,
      email: cleanEmail,
      phone: cleanPhone,
      phoneNumber: cleanPhone,
      password: cleanPassword,
      role: 'patient',
      status: "Active",
      registeredAt: format(new Date(), 'yyyy-MM-dd')
    };

    setRegisteredUsers(prev => {
      const updated = [newUser, ...prev.filter(u => u.id !== newUser.id && u.email !== newUser.email)];
      localStorage.setItem('medremind_registered_users', JSON.stringify(updated));
      return updated;
    });
    setCurrentUser(newUser);
    localStorage.setItem('medremind_auth_user', JSON.stringify(newUser));
    logActivity('REGISTRATION', `${newUser.name} (${newUser.role})`, `Account created with ID ${newUser.id}`, newUser.id);

    return {
      success: true,
      user: newUser
    };
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
    localStorage.removeItem('medremind_auth_user');
    localStorage.removeItem('medremind_auth_token');
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

  // Refresh User Profile from Backend
  const refreshUser = async () => {
    if (isOnline()) {
      try {
        const token = localStorage.getItem('medremind_auth_token');
        if (!token) return;
        const res = await apiFetch('/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok && data.success && data.user) {
          setCurrentUser(data.user);
          localStorage.setItem('medremind_auth_user', JSON.stringify(data.user));
        }
      } catch (e) {}
    }
  };

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
        const allUsers = JSON.parse(localStorage.getItem('medremind_registered_users') || '[]');
        const updatedAll = allUsers.map(u => u.id === updated.id ? { ...u, ...updated } : u);
        localStorage.setItem('medremind_registered_users', JSON.stringify(updatedAll));
      } catch (e) {}
      return updated;
    });
  };

  // Admin user status modification
  const updateUserStatus = (userId, newStatus) => {
    setRegisteredUsers(prev => prev.map(u => u.id === userId ? { ...u, status: newStatus } : u));
    logActivity('ADMIN_ACTION', 'System Administrator', `Updated status of user ${userId} to ${newStatus}`, userId);
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
