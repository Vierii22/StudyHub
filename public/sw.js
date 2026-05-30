const CACHE = 'studyhub-v1';

const PRECACHE = [
  '/',
  '/index.html',
  '/assets/icon.png',
  '/assets/logo-circle.png',
  '/assets/logo-dashboard.png',
];

// Instalar: cachear assets del shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

// Activar: limpiar caches viejos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: network first, cache como fallback
self.addEventListener('fetch', e => {
  // Solo interceptar GET del mismo origen
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith(self.location.origin)) return;

  // Supabase y CDNs: siempre red, nunca cachear
  const url = new URL(e.request.url);
  if (url.hostname.includes('supabase') || url.hostname.includes('unpkg') || url.hostname.includes('fonts.g')) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Guardamos copia en cache si fue bien
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('/index.html')))
  );
});
