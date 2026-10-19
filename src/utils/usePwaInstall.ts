import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
const installListeners = new Set<(canPrompt: boolean) => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    installListeners.forEach(listener => listener(true));
  });

  window.addEventListener('appinstalled', () => {
    globalDeferredPrompt = null;
    try {
      localStorage.setItem('hellopoint_pwa_installed', 'true');
    } catch {}
    installListeners.forEach(listener => listener(false));
  });
}

export function checkIsAppInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.includes('android-app://') ||
      localStorage.getItem('hellopoint_pwa_installed') === 'true';
    return Boolean(isStandalone);
  } catch {
    return false;
  }
}

export function usePwaInstall() {
  const [isInstalled, setIsInstalled] = useState<boolean>(() => checkIsAppInstalled());
  const [canPrompt, setCanPrompt] = useState<boolean>(() => Boolean(globalDeferredPrompt));
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    const updateInstalled = () => {
      setIsInstalled(checkIsAppInstalled());
    };

    updateInstalled();

    const listener = (available: boolean) => {
      setCanPrompt(available);
      updateInstalled();
    };

    installListeners.add(listener);

    const media = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsInstalled(true);
        try {
          localStorage.setItem('hellopoint_pwa_installed', 'true');
        } catch {}
      }
    };

    if (media.addEventListener) {
      media.addEventListener('change', handleMediaChange);
    }

    return () => {
      installListeners.delete(listener);
      if (media.removeEventListener) {
        media.removeEventListener('change', handleMediaChange);
      }
    };
  }, []);

  const promptInstall = async () => {
    if (globalDeferredPrompt) {
      try {
        await globalDeferredPrompt.prompt();
        const choice = await globalDeferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setIsInstalled(true);
          try {
            localStorage.setItem('hellopoint_pwa_installed', 'true');
          } catch {}
        }
        globalDeferredPrompt = null;
        setCanPrompt(false);
      } catch (err) {
        console.error('Install prompt failed:', err);
        setShowGuide(true);
      }
    } else {
      setShowGuide(true);
    }
  };

  return {
    isInstalled,
    canPrompt,
    promptInstall,
    showGuide,
    setShowGuide
  };
}
