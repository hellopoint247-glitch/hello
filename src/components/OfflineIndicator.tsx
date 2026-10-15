/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export const OfflineIndicator: React.FC<{ lang?: 'bn' | 'en' }> = ({ lang = 'bn' }) => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[99999] flex items-center gap-2 rounded-xl bg-amber-600 text-white px-3.5 py-2 text-xs font-bold shadow-2xl border border-amber-400 animate-pulse font-sans">
      <WifiOff className="w-4 h-4 text-white shrink-0" />
      <span>
        {lang === 'bn'
          ? 'অফলাইন মোড — ক্যাশ করা ডাটা ব্যবহৃত হচ্ছে।'
          : 'Offline Mode — Cached data is being used.'}
      </span>
    </div>
  );
};
