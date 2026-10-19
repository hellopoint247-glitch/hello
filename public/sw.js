// Hello Point PWA Service Worker (V4 - High Stability)
const CACHE_NAME = 'hello-point-v4';
const OFFLINE_URL = '/';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Purge all old and stale caches immediately to fix white screen caching issues
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((k) => caches.delete(k)));
    }).then(() => self.clients.claim())
  );
});

// PWA Installability compliant:
// Only intercept navigation requests if completely offline.
// NEVER intercept scripts, modules, or network APIs to prevent white screens.
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(OFFLINE_URL) || caches.match('/index.html');
      })
    );
  }
  // Non-navigation requests pass through natively to the browser without interference
});

// Handle System Notification Click: Bring user back into the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Handle background push event if configured
self.addEventListener('push', (event) => {
  let data = { title: 'Hello Point', body: 'নতুন নোটিফিকেশন এসেছে' };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (err) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    vibrate: [200, 100, 200],
    data: data.data || { url: '/' }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle direct message from client app to show notification through Service Worker
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    const notifOptions = {
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      vibrate: [200, 100, 200, 100, 200],
      ...options
    };
    event.waitUntil(
      self.registration.showNotification(title, notifOptions)
    );
  }
});
