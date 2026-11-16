import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import ProtectedRoute from './ProtectedRoute';
import { useAuth } from '../context/AuthContext';

// Auth Pages
import WelcomePage from '../pages/auth/WelcomePage';
import LoginPage from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';
import LegalCentrePage from '../pages/legal/LegalCentrePage';

// Patient Pages
import DashboardPage from '../pages/patient/DashboardPage';
import MedicinesPage from '../pages/patient/MedicinesPage';
import MedicineDetailPage from '../pages/patient/MedicineDetailPage';
import AddEditMedicinePage from '../pages/patient/AddEditMedicinePage';
import ScannerPage from '../pages/patient/ScannerPage';
import SchedulePage from '../pages/patient/SchedulePage';
import ProfilePage from '../pages/patient/ProfilePage';
import NotificationsPage from '../pages/patient/NotificationsPage';
import NutritionPage from '../pages/patient/NutritionPage';
import HistoryPage from '../pages/patient/HistoryPage';
import AboutPage from '../pages/patient/AboutPage';

// Admin Pages
import AdminDashboardPage from '../pages/admin/AdminDashboardPage';
import AdminUsersPage from '../pages/admin/AdminUsersPage';
import AdminActivityPage from '../pages/admin/AdminActivityPage';
import AdminSettingsPage from '../pages/admin/AdminSettingsPage';

export default function AppRoutes() {
  const { currentUser } = useAuth();

  // Helper to determine destination for authenticated users
  const getHomeRoute = () => {
    if (!currentUser) return '/welcome';
    if (currentUser.role === 'admin') return '/admin/dashboard';
    return '/dashboard';
  };

  return (
    <Routes>
      {/* Public Authentication & Compliance Routes */}
      <Route path="/welcome" element={<WelcomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/legal" element={<LegalCentrePage />} />
      <Route path="/about" element={<AboutPage />} />

      {/* Main Application Shell with Protected Role Routes */}
      <Route element={<AppShell />}>
        {/* 1. Patient Interface (Protected to 'patient') */}
        <Route element={<ProtectedRoute allowedRoles={['patient']} />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/medicines" element={<MedicinesPage />} />
          <Route path="/medicines/add" element={<AddEditMedicinePage />} />
          <Route path="/medicines/edit/:id" element={<AddEditMedicinePage />} />
          <Route path="/medicines/:id" element={<MedicineDetailPage />} />
          <Route path="/scanner" element={<ScannerPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/nutrition" element={<NutritionPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/about" element={<AboutPage />} />
        </Route>

        {/* 2. Administrator Interface (Protected to 'admin') */}
        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/activity" element={<AdminActivityPage />} />
          <Route path="/admin/settings" element={<AdminSettingsPage />} />
        </Route>
      </Route>

      {/* Root & Fallback Redirection */}
      <Route path="/" element={<Navigate to={getHomeRoute()} replace />} />
      <Route path="*" element={<Navigate to={getHomeRoute()} replace />} />
    </Routes>
  );
}
