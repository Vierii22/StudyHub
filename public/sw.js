const CACHE = 'studyhub-v3-redesign';

const PRECACHE = [
  '/',
  '/index.html',
  '/assets/icon.png',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE.map(url => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Nunca interceptar CDNs externos, Supabase ni APIs
  if (
    url.hostname.includes('supabase') ||
    url.hostname.includes('unpkg') ||
    url.hostname.includes('fonts.g') ||
    url.hostname.includes('anthropic') ||
    url.pathname.startsWith('/rest/') ||
    url.pathname.startsWith('/auth/')
  ) return;

  // Para requests del mismo origen: network-first, cache como fallback
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(e.request).then(r => r || caches.match('/index.html'))
        )
    );
  }
});
