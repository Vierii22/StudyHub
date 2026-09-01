const CACHE = 'studyhub-v7-push';

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

// ── notificaciones push (reemplaza al bot de Telegram para los avisos) ──
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { title: 'StudyHub', body: e.data ? e.data.text() : '' }; }
  const title = data.title || 'StudyHub';
  const options = {
    body: data.body || '',
    icon: '/assets/icon-192.png',
    badge: '/assets/icon-192.png',
    data: { url: data.url || '/' },
    tag: data.tag || 'studyhub-reminder',
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

/* Solo abrimos rutas de NUESTRO sitio. El payload viene firmado con VAPID
   (solo nuestro servidor puede mandarlo), pero si esa clave se filtrara
   una notificación podría llevar a una página trucha. Defensa en capas. */
function sameOriginPath(raw) {
  try {
    const u = new URL(raw || '/', self.location.origin);
    return u.origin === self.location.origin ? u.pathname + u.search : '/';
  } catch {
    return '/';
  }
}

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = sameOriginPath(e.notification.data?.url);
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
