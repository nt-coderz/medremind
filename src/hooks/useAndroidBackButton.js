import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';
import { dismissTopModal } from '../utils/modalRegistry';

// Root/home routes where pressing back triggers exit confirmation
const ROOT_ROUTES = [
  '/',
  '/welcome',
  '/dashboard',
  '/admin/dashboard'
];

/**
 * Handles Android hardware back button cleanly with Capacitor and React Router.
 * - Dismisses open modals first.
 * - Navigates back on nested routes.
 * - Enforces "Press back again to exit" within 2 seconds on root pages.
 * - Prevents duplicate listeners.
 */
export function useAndroidBackButton() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Refs to maintain fresh state inside the listener closure without re-binding
  const locationRef = useRef(location.pathname);
  locationRef.current = location.pathname;

  const lastBackPressRef = useRef(0);
  const resetTimerRef = useRef(null);

  useEffect(() => {
    // Only register on native platforms (Android)
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    let isSubscribed = true;
    let backButtonListener = null;

    const setupListener = async () => {
      try {
        backButtonListener = await App.addListener('backButton', ({ canGoBack }) => {
          if (!isSubscribed) return;

          // 1. Dismiss top-most modal/dialog/drawer if one is currently open
          if (dismissTopModal()) {
            return;
          }

          const currentPath = locationRef.current;
          const isRootPage = ROOT_ROUTES.includes(currentPath);

          // 2. If on a root/home page, require double press within 2 seconds to exit
          if (isRootPage) {
            const now = Date.now();
            const timeDiff = now - lastBackPressRef.current;

            if (timeDiff <= 2000) {
              // Second press within 2s -> exit the app
              if (resetTimerRef.current) {
                clearTimeout(resetTimerRef.current);
              }
              App.exitApp();
            } else {
              // First press -> show toast and arm confirmation for 2s
              lastBackPressRef.current = now;
              toast('Press back again to exit the app.', {
                id: 'back-exit-confirm',
                duration: 2000
              });

              if (resetTimerRef.current) {
                clearTimeout(resetTimerRef.current);
              }
              // Reset confirmation after 2000ms
              resetTimerRef.current = setTimeout(() => {
                lastBackPressRef.current = 0;
              }, 2000);
            }
          } else {
            // 3. On nested routes, navigate to the previous page
            navigate(-1);
          }
        });
      } catch (err) {
        console.warn('[useAndroidBackButton] Failed to register backButton listener:', err);
      }
    };

    setupListener();

    return () => {
      isSubscribed = false;
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
      if (backButtonListener && typeof backButtonListener.remove === 'function') {
        backButtonListener.remove();
      }
    };
  }, [navigate]);
}
