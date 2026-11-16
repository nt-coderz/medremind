import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { 
  Home, 
  Pill, 
  CalendarDays, 
  User, 
  Activity, 
  Users, 
  LayoutDashboard,
  Settings
} from 'lucide-react';

export default function BottomNav() {
  const { t } = useTranslation();
  const { activeRole } = useAuth();

  const patientTabs = [
    { to: '/dashboard', label: t('nav.dashboard', 'Home'), icon: Home },
    { to: '/medicines', label: t('nav.medicines', 'Medicines'), icon: Pill },
    { to: '/schedule', label: t('nav.schedule', 'Schedule'), icon: CalendarDays },
    { to: '/profile', label: t('nav.profile', 'Profile'), icon: User }
  ];

  const adminTabs = [
    { to: '/admin/dashboard', label: t('nav.overview', 'Overview'), icon: LayoutDashboard },
    { to: '/admin/users', label: t('nav.users', 'Users'), icon: Users },
    { to: '/admin/activity', label: t('nav.auditLog', 'Audit Log'), icon: Activity },
    { to: '/admin/settings', label: t('nav.settings', 'Settings'), icon: Settings }
  ];

  const tabs = activeRole === 'admin' ? adminTabs : patientTabs;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-[#E6ECE8] safe-bottom max-w-md mx-auto">
      <div className="flex items-center justify-around px-2 py-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) => `
                flex flex-col items-center justify-center py-1 px-1.5 sm:px-3 rounded-xl transition-all duration-150 min-w-[48px] sm:min-w-[56px] cursor-pointer
                ${isActive 
                  ? 'text-[#238B78] font-semibold' 
                  : 'text-[#7A8782] hover:text-[#202B28]'
                }
              `}
            >
              {({ isActive }) => (
                <>
                  <div className={`p-1 rounded-lg transition-colors ${isActive ? 'bg-[#DDEFE8]' : ''}`}>
                    <Icon className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <span className="text-[10px] sm:text-[11px] mt-0.5 tracking-tight">{tab.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
