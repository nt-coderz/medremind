import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Role-Based Route Guard
 * Enforces interface separation between Patient and Administrator roles.
 * Note: Frontend role guards provide UI separation for demonstration.
 * Production security must be enforced by backend authentication and API access controls.
 */
export default function ProtectedRoute({ allowedRoles = [] }) {
  const { currentUser } = useAuth();

  if (!currentUser) {
    // Unauthenticated user -> redirect to Welcome
    return <Navigate to="/welcome" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(currentUser.role)) {
    // Role mismatch -> redirect to the appropriate dashboard
    if (currentUser.role === 'admin') {
      return <Navigate to="/admin/dashboard" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
