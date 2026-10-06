/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, CheckCircle2, Sparkles, Volume2 } from 'lucide-react';
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

export const NotificationPermissionPrompt: React.FC<NotificationPermissionPromptProps> = ({
  lang = 'bn'
}) => {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [isVisible, setIsVisible] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [justGranted, setJustGranted] = useState(false);

  useEffect(() => {
    if (!isNotificationSupported()) return;

    const currentPerm = getNotificationPermission();
    setPermission(currentPerm);

    // If already granted or denied, don't show
    if (currentPerm !== 'default') return;

    // Check if user dismissed recently
    try {
      const dismissedAt = localStorage.getItem(DISMISS_KEY);
      if (dismissedAt) {
        const timeDiff = Date.now() - parseInt(dismissedAt, 10);
        if (timeDiff < DISMISS_DURATION_MS) {
          return;
        }
      }
    } catch {}

    // Show prompt after a short pleasant delay so page renders first
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  const handleAllow = async () => {
    setIsProcessing(true);
    try {
      const result = await requestNotificationPermission();
      setPermission(result);

      if (result === 'granted') {
        setJustGranted(true);
        // Dispatch test notification so they see the result immediately
        await sendTestNotification(lang === 'en' ? 'en' : 'bn');
        setTimeout(() => {
          setIsVisible(false);
        }, 2200);
      } else {
        // If denied or dismissed native prompt
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
        initial={{ y: -60, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -40, opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', damping: 22, stiffness: 280 }}
        className="fixed top-3 left-3 right-3 sm:left-auto sm:right-5 sm:max-w-md z-[9999] select-none font-sans"
      >
        <div className="bg-white/95 dark:bg-[#1E232B]/95 backdrop-blur-md rounded-2.5xl p-4 sm:p-4.5 border border-purple-200/90 dark:border-purple-500/30 shadow-[0_18px_50px_-10px_rgba(98,68,166,0.35)] ring-1 ring-purple-600/15">
          {justGranted ? (
            <div className="flex items-center gap-3 py-1 text-emerald-600 dark:text-emerald-400">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-black leading-tight text-slate-900 dark:text-white">
                  {lang === 'bn' ? 'ধন্যবাদ! নোটিফিকেশন সক্রিয় হয়েছে ✓' : 'Thank you! Notifications Activated ✓'}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                  {lang === 'bn' ? 'এখন থেকে সকল গুরুত্বপূর্ণ নোটিশ মোবাইলে পৌঁছে যাবে।' : 'You will receive timely alerts and updates.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-500/30 shrink-0">
                    <Bell className="w-5 h-5 animate-wiggle" />
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 animate-ping" />
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-slate-900" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-1">
                        {lang === 'bn' ? 'HelloPoint.online নোটিফিকেশন' : 'HelloPoint.online Notifications'}
                        <Sparkles className="w-3 h-3 text-amber-500" />
                      </h4>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-tight mt-0.5">
                      {lang === 'bn' ? 'জরুরি নোটিশ ও অ্যালার্ট সরাসরি মোবাইলে পান' : 'Get instant alerts & notices on your device'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDismiss}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                  title={lang === 'bn' ? 'বন্ধ করুন' : 'Dismiss'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300 leading-relaxed bg-purple-50/70 dark:bg-purple-950/30 p-2.5 rounded-xl border border-purple-100/80 dark:border-purple-900/40">
                {lang === 'bn' 
                  ? 'অ্যাপ বন্ধ থাকলেও কাস্টমার নম্বর, রিচার্জ আপডেট বা নতুন মেসেজ আসার সাথে সাথে মোবাইলের নোটিফিকেশন বারে সাউন্ড সহ অ্যালার্ট পেতে নোটিফিকেশন Allow করুন।'
                  : 'Receive instant notifications with sound & vibration on your phone status bar even when away from the app.'}
              </p>

              <div className="flex items-center gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={handleAllow}
                  disabled={isProcessing}
                  className="flex-1 py-2.5 px-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:to-indigo-700 active:scale-[0.98] text-white text-[11px] font-black rounded-xl shadow-md shadow-purple-600/25 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>{isProcessing ? (lang === 'bn' ? 'অনুমতি নেওয়া হচ্ছে...' : 'Requesting...') : (lang === 'bn' ? 'অনুমতি দিন (Allow)' : 'Allow Notifications')}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDismiss}
                  disabled={isProcessing}
                  className="py-2.5 px-3.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-[10.5px] font-bold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                >
                  {lang === 'bn' ? 'পরে' : 'Later'}
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.aside>
    </AnimatePresence>
  );
};
