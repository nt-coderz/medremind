import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import AppHeader from './AppHeader';
import BottomNav from './BottomNav';
import MediChatSheet from '../chat/MediChatSheet';

export default function AppShell() {
  const location = useLocation();
  const hideNavRoutes = ['/welcome', '/login', '/register', '/scanner'];
  const shouldHideNav = hideNavRoutes.includes(location.pathname);

  return (
    <div className="min-h-screen bg-[#F0F4F2] flex flex-col items-center justify-start text-[#202B28]">
      {/* Centered Mobile App Frame */}
      <div className="w-full max-w-md min-h-screen bg-[#F8FAF8] flex flex-col shadow-xl sm:border-x sm:border-[#E6ECE8] relative">
        {!shouldHideNav && <AppHeader />}
        
        {/* Main Content Area */}
        <main className={`flex-1 flex flex-col ${!shouldHideNav ? 'pb-24' : ''}`}>
          <Outlet />
        </main>

        {!shouldHideNav && (
          <>
            <MediChatSheet />
            <BottomNav />
          </>
        )}
      </div>
    </div>
  );
}
