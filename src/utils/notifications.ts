/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { soundEngine } from './audio';
import { safeLocalStorage as localStorage } from './safeStorage';

export const NOTIFICATION_PREF_KEY = 'hellopoint_notification_enabled';

export const isNotificationSupported = (): boolean => {
  return typeof window !== 'undefined' && 'Notification' in window;
};

export const isTabHidden = (): boolean => {
  if (typeof document === 'undefined') return false;
  return Boolean(document.hidden || (typeof document.hasFocus === 'function' && !document.hasFocus()));
};

export const getNotificationPermission = (): NotificationPermission | 'unsupported' => {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
};

export const requestNotificationPermission = async (): Promise<NotificationPermission | 'unsupported'> => {
  if (!isNotificationSupported()) return 'unsupported';
  try {
    const result = await Notification.requestPermission();
    if (result === 'granted') {
      localStorage.setItem(NOTIFICATION_PREF_KEY, 'true');
    } else {
      localStorage.setItem(NOTIFICATION_PREF_KEY, 'false');
    }
    return result;
  } catch (err) {
    console.warn('Failed to request notification permission:', err);
    return Notification.permission;
  }
};

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  url?: string;
  playSound?: boolean;
  vibrate?: number[];
}

/**
 * Sends a real device system notification (shows on phone status bar, lockscreen, or desktop tray).
 * Works via Service Worker registration.showNotification when available, with fallback to new Notification().
 */
export const sendSystemNotification = async ({
  title,
  body,
  icon = '/icon-192.svg',
  badge = '/icon-192.svg',
  tag,
  data = {},
  url = '/',
  playSound = true,
  vibrate = [200, 100, 200, 100, 200]
}: NotificationOptions): Promise<boolean> => {
  // Always trigger sound & vibration if enabled, even if Notification permission is pending or denied
  if (playSound) {
    try {
      soundEngine.playIncomingMessageSound();
    } catch {}
  }

  if (typeof navigator !== 'undefined' && 'vibrate' in navigator && Array.isArray(vibrate)) {
    try {
      navigator.vibrate(vibrate);
    } catch {}
  }

  if (!isNotificationSupported()) return false;

  // If permission is not granted, skip system notification
  if (Notification.permission !== 'granted') {
    return false;
  }

  const notificationData = {
    url,
    timestamp: Date.now(),
    ...data
  };

  const notificationTag = tag || 'hellopoint-' + Date.now();

  // 1. Try Service Worker showNotification first (Works when browser is backgrounded / minimized / phone locked)
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready.catch(() => null) 
        || await navigator.serviceWorker.getRegistration();

      if (registration && typeof registration.showNotification === 'function') {
        await registration.showNotification(title, {
          body,
          icon,
          badge,
          tag: notificationTag,
          vibrate,
          data: notificationData,
          renotify: true
        });
        return true;
      }

      // If active controller exists, post message to worker
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SHOW_NOTIFICATION',
          title,
          options: {
            body,
            icon,
            badge,
            tag: notificationTag,
            vibrate,
            data: notificationData
          }
        });
        return true;
      }
    }
  } catch (swErr) {
    console.debug('Service worker notification failed, trying standard Notification fallback:', swErr);
  }

  // 2. Fallback to standard window Notification
  try {
    const notif = new Notification(title, {
      body,
      icon,
      badge,
      tag: notificationTag,
      data: notificationData
    });

    notif.onclick = () => {
      try {
        window.focus();
      } catch {}
      notif.close();
    };
    return true;
  } catch (notifErr) {
    console.debug('Standard notification fallback failed:', notifErr);
    return false;
  }
};

const recentNotificationKeys = new Map<string, number>();

/**
 * Deduplicated system notification helper.
 * Prevents identical alerts from firing repeatedly within minIntervalMs (default 8s).
 */
export const notifyWithDeduplication = async (
  options: NotificationOptions & { dedupeKey?: string; minIntervalMs?: number }
): Promise<boolean> => {
  const key = options.dedupeKey || options.tag || `${options.title}::${options.body}`;
  const now = Date.now();
  const lastFired = recentNotificationKeys.get(key) || 0;
  const interval = options.minIntervalMs || 8000;

  if (now - lastFired < interval) {
    return false;
  }

  recentNotificationKeys.set(key, now);

  // Prune map if large
  if (recentNotificationKeys.size > 80) {
    for (const [k, timestamp] of recentNotificationKeys.entries()) {
      if (now - timestamp > 300000) {
        recentNotificationKeys.delete(k);
      }
    }
  }

  return sendSystemNotification(options);
};

/**
 * Quick helper to test system notification immediately on user's device
 */
export const sendTestNotification = async (lang: 'bn' | 'en' = 'bn'): Promise<boolean> => {
  return sendSystemNotification({
    title: lang === 'bn' ? 'Hello Point ব্যাকগ্রাউন্ড নোটিফিকেশন ✓' : 'Hello Point Background Alert ✓',
    body: lang === 'bn' 
      ? 'অভিনন্দন! আপনার ব্যাকগ্রাউন্ড নোটিফিকেশন ও অ্যালার্ট সফলভাবে সক্রিয় রয়েছে। অ্যাপ বন্ধ বা ব্যাকগ্রাউন্ডে থাকলেও মোবাইলে অ্যালার্ট আসবে।' 
      : 'Congratulations! Your background notifications and alarms are active and ready.',
    tag: 'test-notification-' + Date.now(),
    playSound: true,
    vibrate: [250, 100, 250, 100, 250]
  });
};
