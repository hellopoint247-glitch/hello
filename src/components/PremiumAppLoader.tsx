import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LucideIcon, Sparkles } from 'lucide-react';

interface PremiumAppLoaderProps {
  isOpen: boolean;
  title?: string;
  subtitle?: string;
  icon?: LucideIcon;
  iconGradient?: string;
  ringColor?: string;
  progressColor?: string;
  progress?: number; // 0 to 100 or auto-indeterminate
  duration?: number; // for auto progress if any
  onClose?: () => void;
}

export function PremiumAppLoader({
  isOpen,
  title = 'সংরক্ষণ করা হচ্ছে...',
  subtitle,
  icon: Icon = Sparkles,
  iconGradient = 'from-purple-600 via-indigo-600 to-purple-700',
  ringColor = 'border-purple-500',
  progressColor = 'from-purple-500 to-indigo-500',
  progress: controlledProgress,
  duration = 800
}: PremiumAppLoaderProps) {
  const [internalProgress, setInternalProgress] = useState(15);

  useEffect(() => {
    if (!isOpen) {
      setInternalProgress(15);
      return;
    }

    if (controlledProgress !== undefined) {
      setInternalProgress(controlledProgress);
      return;
    }

    // Auto animate progress if controlledProgress is not given
    setInternalProgress(20);
    const stepTime = Math.max(20, Math.floor(duration / 10));
    const interval = setInterval(() => {
      setInternalProgress((prev) => {
        if (prev >= 92) {
          clearInterval(interval);
          return 96;
        }
        return prev + 12;
      });
    }, stepTime);

    return () => clearInterval(interval);
  }, [isOpen, controlledProgress, duration]);

  const activeProgress = controlledProgress !== undefined ? controlledProgress : internalProgress;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="premium-app-loader-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[99999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 select-none font-sans"
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: 10 }}
            transition={{ type: 'spring', damping: 24, stiffness: 300 }}
            className="bg-white dark:bg-[#1E252D] rounded-3xl p-6 max-w-xs w-full shadow-2xl border border-slate-100 dark:border-slate-800 text-center space-y-4"
          >
            {/* Glowing animated spinner ring identical to Cash-In style */}
            <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
              <div className={`absolute inset-0 rounded-full border-4 ${ringColor}/20 animate-ping`} />
              <div className={`absolute inset-0 rounded-full border-4 border-t-purple-500 border-r-indigo-500 border-b-transparent border-l-transparent animate-spin`} />
              <div className={`w-12 h-12 rounded-full bg-gradient-to-tr ${iconGradient} text-white flex items-center justify-center shadow-lg shadow-purple-500/30`}>
                <Icon className="w-6 h-6 animate-pulse stroke-[2.5]" />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 tracking-wide">
                {title}
              </h3>
              {subtitle && (
                <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 mt-1">
                  {subtitle}
                </p>
              )}
            </div>

            {/* Smooth animated progress line */}
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <motion.div
                className={`bg-gradient-to-r ${progressColor} h-full`}
                animate={{ width: `${Math.min(100, Math.max(0, activeProgress))}%` }}
                transition={{ ease: 'easeInOut', duration: 0.2 }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
