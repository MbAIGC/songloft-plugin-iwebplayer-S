// This worker intentionally does not cache API or audio responses. It supplies
// the PWA lifecycle required by Chromium while preserving live SongLoft data.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
