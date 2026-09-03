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

const CACHE_NAME = 'haris-cura-v1';
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

  // Navigation requests: try network first so updates land quickly, fall back to cached shell offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', clone));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Everything else in the app shell: cache-first, then network, then cache the result.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => cached);
    })
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
