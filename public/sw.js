// Service Worker mínimo — habilita instalação como PWA
const CACHE_NAME = 'portal-voluntario-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Passa todas as requisições direto para a rede (sem cache offline)
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
