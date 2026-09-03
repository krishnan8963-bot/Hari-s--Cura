/**
 * service-worker.js — Offline app-shell caching for Hari's Cura.
 *
 * Strategy:
 *  - Precache the app shell (HTML/CSS/JS/manifest/icons) on install.
 *  - Cache-first for the app shell files themselves (they only change on deploy).
 *  - Network-first (falling back to cache) for navigation requests, so a
 *    deployed update is picked up quickly when online, but the app still
 *    loads instantly when offline.
 *  - IndexedDB (all task/shopping/settings data) is NOT touched here —
 *    it lives entirely in the page's IndexedDB, which the service worker
 *    doesn't need to intercept.
 */

/**
 * service-worker.js — Offline app-shell caching for Hari's Cura.
 *
 * Strategy: network-first, cache as a fallback.
 *  - Every GET request for an app-shell file first tries the network, so
 *    the app always picks up the latest deployed code when you're online.
 *  - The successful response is also stored in the cache, so if you go
 *    offline later, the app still loads from that last-known-good copy.
 *  - IndexedDB (all task/shopping/settings data) is NOT touched here —
 *    it lives entirely in the page's IndexedDB, which the service worker
 *    doesn't need to intercept.
 *
 * IMPORTANT: bump CACHE_NAME (e.g. 'haris-cura-v3') any time you want to
 * force every device to fully discard its old cache on next load. This
 * isn't required for normal code updates (network-first already picks
 * those up automatically while online) — it's a manual "just in case"
 * reset button for stuck devices.
 */

const CACHE_NAME = 'haris-cura-v2';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './db.js',
  './notifications.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/icon-64.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // don't intercept cross-origin (e.g. Google Fonts)

  // Network-first for every app-shell request: always try to get the
  // freshest deployed file first. Only fall back to whatever's cached
  // (or, for a full-page navigation, the cached index.html) when the
  // network request fails — i.e. when actually offline.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => cached || (request.mode === 'navigate' ? caches.match('./index.html') : undefined))
      )
  );
});

// Allows notifications shown via registration.showNotification() to focus
// or open the app when tapped.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      if (clientsArr.length > 0) {
        return clientsArr[0].focus();
      }
      return self.clients.openWindow('./index.html');
    })
  );
});
