/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, useCallback } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const BANNER_DISMISSED_KEY = 'hellopoint_pwa_banner_dismissed_until';

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    );
  });
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isAndroid, setIsAndroid] = useState<boolean>(false);
  const [isBannerDismissed, setIsBannerDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const dismissedUntil = sessionStorage.getItem(BANNER_DISMISSED_KEY) || localStorage.getItem(BANNER_DISMISSED_KEY);
      if (dismissedUntil && Number(dismissedUntil) > Date.now()) {
        return true;
      }
    } catch {
      // ignore storage error
    }
    return false;
  });

  useEffect(() => {
    // Detect standalone mode (already installed as PWA)
    const checkStandalone = () => {
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsInstalled(isStandalone);
    };

    checkStandalone();

    // Detect user platform
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent) && !(window as any).MSStream;
    const isAndroidDevice = /android/.test(userAgent);
    setIsIOS(isIOSDevice);
    setIsAndroid(isAndroidDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent browser default mini-infobar so our custom prompt controls the presentation
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setIsBannerDismissed(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    const mediaMatcher = window.matchMedia('(display-mode: standalone)');
    try {
      mediaMatcher.addEventListener('change', checkStandalone);
    } catch {
      // Fallback for older browsers
      mediaMatcher.addListener(checkStandalone);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      try {
        mediaMatcher.removeEventListener('change', checkStandalone);
      } catch {
        mediaMatcher.removeListener(checkStandalone);
      }
    };
  }, []);

  const install = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
        setIsBannerDismissed(true);
        return true;
      }
    } catch (err) {
      console.warn('Install prompt error:', err);
    }
    return false;
  }, [deferredPrompt]);

  const dismissBanner = useCallback((hours = 2) => {
    setIsBannerDismissed(true);
    try {
      const expiry = Date.now() + hours * 60 * 60 * 1000;
      sessionStorage.setItem(BANNER_DISMISSED_KEY, String(expiry));
    } catch {
      // ignore
    }
  }, []);

  const reopenBanner = useCallback(() => {
    setIsBannerDismissed(false);
    try {
      sessionStorage.removeItem(BANNER_DISMISSED_KEY);
      localStorage.removeItem(BANNER_DISMISSED_KEY);
    } catch {
      // ignore
    }
  }, []);

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    isAndroid,
    isBannerDismissed,
    install,
    dismissBanner,
    reopenBanner,
  };
}
