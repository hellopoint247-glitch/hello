/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, Check } from 'lucide-react';
import { 
  isNotificationSupported, 
  getNotificationPermission, 
  requestNotificationPermission, 
  sendTestNotification 
} from '../utils/notifications';
import { safeLocalStorage as localStorage } from '../utils/safeStorage';

interface NotificationPermissionPromptProps {
  lang?: 'bn' | 'en';
}

const DISMISS_KEY = 'hellopoint_notif_prompt_dismissed_at';
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Detects if the current device is a Viewer or Customer:
 * 1. Anyone currently logged in with a mobile number (customer session).
 * 2. Any device where the owner page (PIN/Google) has NEVER been logged into.
 */
export function isViewerOrCustomer(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    // 1. Current customer session (mobile number login)
    const currentRole = localStorage.getItem('hellopoint_session_role');
    if (currentRole === 'customer') {
      return true;
    }
    // 2. Check if owner has ever unlocked/logged into this device
    const hasOwnerLoggedIn = localStorage.getItem('hellopoint_has_owner_logged_in') === 'true' ||
      localStorage.getItem('hellopoint_is_owner_device') === 'true';
    if (!hasOwnerLoggedIn) {
      // Device has never unlocked owner page -> Viewer / Visitor
      return true;
    }
    // Owner device -> Not a viewer or customer
    return false;
  } catch {
    return false;
  }
}

export const NotificationPermissionPrompt: React.FC<NotificationPermissionPromptProps> = ({
  lang = 'bn'
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [justGranted, setJustGranted] = useState(false);

  useEffect(() => {
    if (!isNotificationSupported()) return;

    const checkAndShow = () => {
      if (!isViewerOrCustomer()) {
        setIsVisible(false);
        return;
      }

      const currentPerm = getNotificationPermission();
      if (currentPerm !== 'default') {
        setIsVisible(false);
        return;
      }

      try {
        const dismissedAt = localStorage.getItem(DISMISS_KEY);
        if (dismissedAt) {
          const timeDiff = Date.now() - parseInt(dismissedAt, 10);
          if (timeDiff < DISMISS_DURATION_MS) {
            return;
          }
        }
      } catch {}

      setIsVisible(true);
    };

    // Short pleasant delay so page renders first
    const timer = setTimeout(checkAndShow, 1200);

    window.addEventListener('storage', checkAndShow);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('storage', checkAndShow);
    };
  }, []);

  const handleAllow = async () => {
    setIsProcessing(true);
    try {
      const result = await requestNotificationPermission();
      if (result === 'granted') {
        setJustGranted(true);
        try {
          await sendTestNotification(lang === 'en' ? 'en' : 'bn');
        } catch {}
        setTimeout(() => {
          setIsVisible(false);
        }, 1500);
      } else {
        setIsVisible(false);
        try {
          localStorage.setItem(DISMISS_KEY, Date.now().toString());
        } catch {}
      }
    } catch (e) {
      console.warn('Failed to request permission:', e);
      setIsVisible(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, Date.now().toString());
    } catch {}
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.aside
        aria-label="Notification Permission"
        initial={{ y: -40, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -30, opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', damping: 24, stiffness: 300 }}
        className="fixed top-3 left-3 right-3 sm:left-auto sm:right-5 sm:max-w-xs z-[9999] select-none font-sans"
      >
        <div className="bg-white/95 dark:bg-[#1E232B]/95 backdrop-blur-md rounded-2xl px-3.5 py-2.5 border border-purple-200/90 dark:border-purple-500/30 shadow-[0_12px_36px_-6px_rgba(98,68,166,0.3)] ring-1 ring-purple-600/15 flex items-center justify-between gap-3">
          {justGranted ? (
            <div className="flex items-center gap-2 py-0.5 text-emerald-600 dark:text-emerald-400 w-full justify-center">
              <Check className="w-4 h-4 stroke-[3]" />
              <span className="text-xs font-black">
                {lang === 'bn' ? 'নোটিফিকেশন সক্রিয় হয়েছে' : 'Notifications Allowed'}
              </span>
            </div>
          ) : (
            <>
              {/* Minimal Title with Icon - Zero Extra Text */}
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0 shadow-xs">
                  <Bell className="w-3.5 h-3.5 animate-wiggle" />
                </div>
                <span className="text-[11.5px] font-black text-slate-800 dark:text-slate-100 truncate">
                  {lang === 'bn' ? 'নোটিফিকেশন এলাও' : 'Allow Notifications'}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleAllow}
                  disabled={isProcessing}
                  className="py-1.5 px-3 bg-purple-650 hover:bg-purple-700 active:scale-95 text-white text-[11px] font-black rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-1"
                >
                  <span>{isProcessing ? '...' : (lang === 'bn' ? 'এলাও' : 'Allow')}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  disabled={isProcessing}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                  title={lang === 'bn' ? 'বাতিল' : 'Dismiss'}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}
        </div>
      </motion.aside>
    </AnimatePresence>
  );
};
