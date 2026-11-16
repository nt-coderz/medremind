import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import BrandLogo from '../common/BrandLogo';
import Badge from '../common/Badge';
import LanguagePickerModal from '../common/LanguagePickerModal';
import { useMedicine } from '../../context/MedicineContext';
import { useAuth } from '../../context/AuthContext';
import { Bell, ShieldCheck, LogOut, Globe } from 'lucide-react';

export default function AppHeader() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const { notifications } = useMedicine();
  const { currentUser, activeRole, logout } = useAuth();
  const unreadCount = notifications.filter(n => !n.read).length;
  const isAdmin = currentUser?.role === 'admin';

  const handleHomeClick = () => {
    if (isAdmin) navigate('/admin/dashboard');
    else navigate('/dashboard');
  };

  const handleLogout = () => {
    logout();
    navigate('/welcome');
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#E6ECE8] px-4 py-3 flex items-center justify-between safe-top">
        {/* Brand & Context */}
        <div 
          onClick={handleHomeClick}
          className="cursor-pointer active:scale-98 transition-transform flex items-center gap-2"
        >
          <BrandLogo size="sm" />
          {isAdmin && (
            <Badge variant="neutral" size="sm" className="bg-gray-900 text-emerald-400 border-gray-700 font-mono text-[10px]">
              {t('admin.console', 'ADMIN CONSOLE')}
            </Badge>
          )}
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1.5">
          {/* Language Switcher Button */}
          <button
            onClick={() => setShowLanguageModal(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[#7A8782] hover:text-[#202B28] hover:bg-[#F8FAF8] border border-gray-200/80 transition-colors cursor-pointer text-xs font-semibold"
            title="Change Language / भाषा बदलें"
            aria-label="Change Language"
          >
            <Globe className="w-4 h-4 text-[#238B78]" />
            <span className="text-[11px] font-bold text-gray-700">A/अ</span>
          </button>

          {isAdmin ? (
            /* Dedicated Administrator Identity & Logout */
            <div className="flex items-center gap-2 ml-1">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-gray-100 border border-gray-200 text-xs">
                <ShieldCheck className="w-3.5 h-3.5 text-gray-800" />
                <span className="font-semibold text-gray-900">{t('admin.administrator', 'Administrator')}</span>
              </div>
              <button
                onClick={handleLogout}
                title="Sign Out of Admin Console"
                className="p-1.5 rounded-xl text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                aria-label="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* Patient Notification Bell */
            <button
              onClick={() => navigate('/notifications')}
              className="relative p-2 rounded-xl text-[#7A8782] hover:text-[#202B28] hover:bg-[#F8FAF8] transition-colors cursor-pointer"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#238B78] ring-2 ring-white" />
              )}
            </button>
          )}
        </div>
      </header>

      <LanguagePickerModal
        isOpen={showLanguageModal}
        onClose={() => setShowLanguageModal(false)}
      />
    </>
  );
}
