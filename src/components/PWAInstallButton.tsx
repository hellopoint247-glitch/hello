/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Download, Smartphone, X, Share, PlusSquare, Monitor, CheckCircle2, Sparkles } from 'lucide-react';
import { usePWAInstall } from '../utils/usePWAInstall';

interface PWAInstallButtonProps {
  lang?: 'bn' | 'en';
  variant?: 'header' | 'compact' | 'full';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  lang = 'bn',
  variant = 'header',
  className = '',
}) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [installSuccessToast, setInstallSuccessToast] = useState(false);

  // If already running inside installed standalone PWA, suppress
  if (isInstalled) {
    return null;
  }

  const handleAction = async () => {
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
      {installSuccessToast && (
        <div className="fixed top-5 inset-x-4 max-w-sm mx-auto z-[100030] bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-emerald-400">
          <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
          <div className="text-xs font-bold leading-snug">
            {lang === 'bn' 
              ? 'অভিনন্দন! অ্যাপ সফলভাবে ইনস্টল করা হয়েছে।' 
              : 'App installed successfully on your device!'}
          </div>
        </div>
      )}

      {variant === 'header' && (
        <motion.button
          id="header-pwa-install-trigger"
          type="button"
          onClick={handleAction}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black text-[11px] sm:text-xs shadow-md border border-yellow-200/80 cursor-pointer transition-all shrink-0 ${className}`}
          title={lang === 'bn' ? 'ব্রাউজার থেকে অ্যাপ ইনস্টল করুন' : 'Install Web App'}
        >
          <Download className="w-3.5 h-3.5 stroke-[2.8] animate-bounce shrink-0" />
          <span className="inline whitespace-nowrap">
            {lang === 'bn' ? 'অ্যাপ ইনস্টল' : 'Install'}
          </span>
        </motion.button>
      )}

      {variant === 'compact' && (
        <motion.button
          type="button"
          onClick={handleAction}
          whileTap={{ scale: 0.95 }}
          className={`p-1.5 rounded-full bg-white/15 hover:bg-white/25 text-yellow-300 transition-colors cursor-pointer ${className}`}
          title={lang === 'bn' ? 'অ্যাপ ইনস্টল করুন' : 'Install App'}
        >
          <Download className="w-5 h-5 text-yellow-300" />
        </motion.button>
      )}

      {variant === 'full' && (
        <button
          type="button"
          onClick={handleAction}
          className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black text-xs shadow-md border border-yellow-200 transition-all active:scale-98 cursor-pointer ${className}`}
        >
          <Download className="w-4 h-4 stroke-[2.5] animate-bounce shrink-0" />
          <span>{lang === 'bn' ? 'Hello Point অ্যাপ ইনস্টল করুন' : 'Install Hello Point App'}</span>
          <span className="bg-slate-950/20 text-slate-950 text-[9px] font-black px-1.5 py-0.5 rounded ml-1">
            PWA
          </span>
        </button>
      )}

      {/* Browser Step-by-Step Installation Modal */}
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
                  ? 'আপনার ব্রাউজার মেন্যু থেকে খুব সহজেই মাত্র ২ পদক্ষেপে অ্যাপটি ইনস্টল করে নিতে পারবেন:'
                  : 'You can easily install this web app directly to your home screen:'}
              </p>

              <div className="space-y-2.5 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 text-xs">
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
                          Tap the three dots <span className="font-bold text-blue-500">(⋮)</span> menu button at top right.
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
                          Click the <Download className="w-3.5 h-3.5 inline text-blue-500" /> Install icon in address bar.
                        </>
                      )
                    )}
                  </div>
                </div>

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

                <div className="flex items-start gap-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                  <div className="w-6 h-6 rounded-lg bg-purple-100 dark:bg-purple-900/60 text-purple-600 dark:text-purple-300 flex items-center justify-center shrink-0 font-black text-xs mt-0.5">
                    ৩
                  </div>
                  <div className="text-[11.5px] font-medium text-slate-800 dark:text-slate-200 leading-snug">
                    {lang === 'bn' ? (
                      <>
                        উপরে ডানপাশে <span className="font-bold text-purple-600 dark:text-purple-400">'Add'</span>{' '}
                        বা 'ইনস্টল' চাপলেই আপনার ফোনে সরাসরি অ্যাপ ইনস্টল হয়ে যাবে!
                      </>
                    ) : (
                      <>
                        Tap <span className="font-bold text-purple-500">'Add'</span> or 'Install' to complete installation!
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
