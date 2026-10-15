/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X, Share, PlusSquare, Smartphone, Zap, WifiOff, CheckCircle2, Sparkles, Monitor, ChevronRight } from 'lucide-react';
import { usePWAInstall } from '../utils/usePWAInstall';

interface PWAInstallBannerProps {
  lang?: 'bn' | 'en';
}

export const PWAInstallBanner: React.FC<PWAInstallBannerProps> = ({ lang = 'bn' }) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, isBannerDismissed, install, dismissBanner, reopenBanner } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [hasWaitedDelay, setHasWaitedDelay] = useState(false);
  const [installSuccessToast, setInstallSuccessToast] = useState(false);

  // Smooth short delay on page load so page transition finishes cleanly before prompt appears
  useEffect(() => {
    const timer = setTimeout(() => {
      setHasWaitedDelay(true);
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  // Suppress completely if app is already running in standalone mode (already installed as PWA)
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const success = await install();
      if (success) {
        setInstallSuccessToast(true);
        setTimeout(() => setInstallSuccessToast(false), 5000);
      }
    } else {
      setShowGuideModal(true);
    }
  };

  return (
    <>
      {/* Toast Notification when Installed */}
      <AnimatePresence>
        {installSuccessToast && (
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            className="fixed top-5 inset-x-4 max-w-sm mx-auto z-[100030] bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-emerald-400"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
            <div className="text-xs font-bold leading-snug">
              {lang === 'bn' 
                ? 'অভিনন্দন! অ্যাপ সফলভাবে ইনস্টল করা হয়েছে। এখন আপনার হোম স্ক্রিন থেকে খুলুন।' 
                : 'Awesome! App installed successfully. You can now launch it from your home screen.'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Welcoming Install Banner */}
      <AnimatePresence>
        {hasWaitedDelay && !isBannerDismissed && (
          <motion.div
            initial={{ opacity: 0, y: 80, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 60, scale: 0.94 }}
            transition={{ type: 'spring', damping: 25, stiffness: 280 }}
            className="fixed bottom-3 inset-x-3 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-md z-[100020] font-sans print:hidden"
          >
            <div className="relative bg-gradient-to-br from-slate-950 via-[#351b66] to-[#512b96] text-white p-4 sm:p-4.5 rounded-2xl sm:rounded-3xl shadow-[0_20px_50px_rgba(30,12,70,0.65)] border border-purple-400/40 backdrop-blur-2xl ring-1 ring-white/10">
              
              {/* Close / Dismiss button */}
              <button
                type="button"
                onClick={() => dismissBanner(2)}
                className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 p-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title={lang === 'bn' ? 'পরে মনে করিয়ে দিন' : 'Dismiss for now'}
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-start gap-3">
                {/* Brand App Icon with pulse ring */}
                <div className="relative w-13 h-13 rounded-2xl bg-purple-950 p-0.5 border border-purple-300/40 shadow-xl shrink-0 flex items-center justify-center overflow-hidden">
                  <img
                    src="/pwa-192x192.png"
                    alt="Hello Point Icon"
                    className="w-full h-full object-cover rounded-xl"
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-slate-950 animate-pulse" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="text-sm font-black text-white tracking-tight leading-none">
                      {lang === 'bn' ? 'Hello Point অ্যাপ ইনস্টল করুন' : 'Install Hello Point App'}
                    </h4>
                    <span className="inline-flex items-center gap-0.5 bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 text-[8.5px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider shadow-xs">
                      <Sparkles className="w-2.5 h-2.5" />
                      PWA
                    </span>
                  </div>

                  <p className="text-[11px] text-purple-100/95 font-medium leading-snug mt-1.5">
                    {lang === 'bn'
                      ? 'ব্রাউজারের ঝামেলা ছাড়াই ফোনের হোম স্ক্রিন থেকে ১ ট্যাপে ওপেন করুন ও ফুলস্ক্রিনে অফলাইনেও হিসাব রাখুন!'
                      : 'Open in one tap directly from your home screen with offline sync and native fullscreen experience!'}
                  </p>

                  {/* Feature Badges */}
                  <div className="flex items-center gap-1.5 mt-2.5 text-[9.5px] font-bold text-white/90 flex-wrap">
                    <span className="flex items-center gap-1 bg-white/10 px-2 py-0.8 rounded-lg border border-white/5">
                      <Zap className="w-2.5 h-2.5 text-yellow-300" />
                      <span>{lang === 'bn' ? 'দ্রুত গতি' : 'Fast'}</span>
                    </span>
                    <span className="flex items-center gap-1 bg-white/10 px-2 py-0.8 rounded-lg border border-white/5">
                      <WifiOff className="w-2.5 h-2.5 text-emerald-300" />
                      <span>{lang === 'bn' ? 'অফলাইন হিসাব' : 'Offline'}</span>
                    </span>
                    <span className="flex items-center gap-1 bg-white/10 px-2 py-0.8 rounded-lg border border-white/5">
                      <Smartphone className="w-2.5 h-2.5 text-sky-300" />
                      <span>{lang === 'bn' ? 'ফুলস্ক্রিন অ্যাপ' : 'Fullscreen'}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-3.5 pt-2.5 border-t border-purple-400/20 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => dismissBanner(2)}
                  className="text-xs font-bold text-white/70 hover:text-white px-2.5 py-1.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                >
                  {lang === 'bn' ? 'পরে করব' : 'Later'}
                </button>

                <button
                  type="button"
                  onClick={handleInstallClick}
                  className="flex items-center gap-1.5 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 text-slate-950 px-4.5 py-2 rounded-xl font-black text-xs shadow-lg hover:shadow-amber-500/30 active:scale-95 transition-all cursor-pointer border border-yellow-200/60"
                >
                  <Download className="w-3.5 h-3.5 stroke-[2.8] animate-bounce" />
                  <span>{lang === 'bn' ? 'সরাসরি ইনস্টল করুন' : 'Install Direct'}</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sleek Floating Persistent Pill (Shown when banner is minimized/dismissed) */}
      <AnimatePresence>
        {isBannerDismissed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed bottom-4 right-4 z-[100015] font-sans print:hidden"
          >
            <button
              type="button"
              onClick={reopenBanner}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black text-xs px-3.5 py-2 rounded-full shadow-xl border border-yellow-200 hover:scale-105 active:scale-95 transition-all cursor-pointer group"
              title={lang === 'bn' ? 'Hello Point অ্যাপ ইনস্টল করুন' : 'Install Hello Point App'}
            >
              <Download className="w-4 h-4 stroke-[2.5] text-slate-950 group-hover:translate-y-0.5 transition-transform" />
              <span>{lang === 'bn' ? 'অ্যাপ ইনস্টল করুন' : 'Install App'}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Visual Step-by-Step Installation Modal (For Safari, Firefox, or Desktop fallback) */}
      {showGuideModal && (
        <div className="fixed inset-0 z-[100030] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 font-sans animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-left">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-md">
                  {isIOS ? (
                    <Smartphone className="w-5 h-5" />
                  ) : isAndroid ? (
                    <Smartphone className="w-5 h-5" />
                  ) : (
                    <Monitor className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                    {lang === 'bn' ? 'হোম স্ক্রিনে অ্যাপ ইনস্টল' : 'Add to Home Screen'}
                  </h3>
                  <p className="text-[10px] font-bold text-purple-600 dark:text-purple-400 mt-0.5">
                    {isIOS ? 'iPhone / iPad Safari' : isAndroid ? 'Android Chrome / Browser' : 'Desktop Browser'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-3.5">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-relaxed">
                {lang === 'bn'
                  ? 'আপনার বর্তমান ব্রাউজার থেকে খুব সহজেই মাত্র ২ পদক্ষেপে অ্যাপটি ইনস্টল করে নিতে পারবেন:'
                  : 'You can easily install this web app in 2 quick steps from your browser:'}
              </p>

              {/* Steps Container */}
              <div className="space-y-2.5 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 text-xs">
                
                {/* Step 1 */}
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 flex items-center justify-center shrink-0 font-black text-xs mt-0.5">
                    ১
                  </div>
                  <div className="text-[11.5px] font-medium text-slate-800 dark:text-slate-200 leading-snug">
                    {isIOS ? (
                      lang === 'bn' ? (
                        <>
                          সাফারি ব্রাউজারের নিচে থাকা{' '}
                          <span className="inline-flex items-center gap-0.5 font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1 py-0.2 rounded">
                            <Share className="w-3.5 h-3.5 inline" /> শেয়ার (Share)
                          </span>{' '}
                          বাটনে ট্যাপ করুন।
                        </>
                      ) : (
                        <>
                          Tap the <Share className="w-3.5 h-3.5 inline text-blue-500" /> Share button in Safari toolbar.
                        </>
                      )
                    ) : isAndroid ? (
                      lang === 'bn' ? (
                        <>
                          ব্রাউজারের উপরে ডানপাশের তিন ডট{' '}
                          <span className="inline-flex items-center font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1 py-0.2 rounded">
                            (⋮) মেন্যু
                          </span>{' '}
                          বাটনে ট্যাপ করুন।
                        </>
                      ) : (
                        <>
                          Tap the three dots <span className="font-bold text-blue-500">(⋮)</span> menu at top right.
                        </>
                      )
                    ) : (
                      lang === 'bn' ? (
                        <>
                          ব্রাউজারের অ্যাড্রেস বারের ডানপাশে থাকা{' '}
                          <span className="inline-flex items-center gap-0.5 font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1 py-0.2 rounded">
                            <Download className="w-3.5 h-3.5 inline" /> ইনস্টল আইকন
                          </span>{' '}
                          বা মেন্যু (⋮) চাপুন।
                        </>
                      ) : (
                        <>
                          Click the <Download className="w-3.5 h-3.5 inline text-blue-500" /> Install icon in your browser address bar.
                        </>
                      )
                    )}
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                  <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0 font-black text-xs mt-0.5">
                    ২
                  </div>
                  <div className="text-[11.5px] font-medium text-slate-800 dark:text-slate-200 leading-snug">
                    {lang === 'bn' ? (
                      <>
                        তালিকা থেকে{' '}
                        <span className="inline-flex items-center gap-0.5 font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1 py-0.2 rounded">
                          <PlusSquare className="w-3.5 h-3.5 inline" /> 'Add to Home Screen'
                        </span>{' '}
                        বা 'অ্যাপ ইনস্টল করুন' নির্বাচন করুন।
                      </>
                    ) : (
                      <>
                        Select <span className="font-bold text-emerald-500">'Add to Home Screen'</span> or 'Install App'.
                      </>
                    )}
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                  <div className="w-6 h-6 rounded-lg bg-purple-100 dark:bg-purple-900/60 text-purple-600 dark:text-purple-300 flex items-center justify-center shrink-0 font-black text-xs mt-0.5">
                    ৩
                  </div>
                  <div className="text-[11.5px] font-medium text-slate-800 dark:text-slate-200 leading-snug">
                    {lang === 'bn' ? (
                      <>
                        উপরে ডানপাশে <span className="font-bold text-purple-600 dark:text-purple-400">'Add'</span>{' '}
                        বা 'ইনস্টল' চাপলেই আপনার ডিভাইসে অ্যাপটি সরাসরি ইনস্টল হয়ে যাবে!
                      </>
                    ) : (
                      <>
                        Tap <span className="font-bold text-purple-500">'Add'</span> or 'Install' to finish setup!
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black text-xs shadow-md transition-all active:scale-98 cursor-pointer"
            >
              {lang === 'bn' ? 'ঠিক আছে, বুঝতে পেরেছি' : 'Got it!'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
