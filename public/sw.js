const CACHE = 's2s-social-v1';
const SHELL = ['/', '/login.html', '/discover.html', '/Group-Chatroom.html', '/white-sky-ui.css', '/social.css', '/manifest.json'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) { event.respondWith(fetch(event.request)); return; }
  event.respondWith(fetch(event.request).then(res => {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(event.request, copy)).catch(() => {});
    return res;
  }).catch(() => caches.match(event.request).then(r => r || caches.match('/'))));
});
self.addEventListener('push', event => {
  let data = { title: 'Stranger 2 Stranger', body: 'You have a new update.', link: '/discover.html#notifications' };
  try { data = { ...data, ...(event.data ? event.data.json() : {}) }; } catch (_) {}
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: '/icons/icon-192x192.png', badge: '/icons/icon-192x192.png', data: { link: data.link } }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const link = event.notification.data?.link || '/discover.html#notifications';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const existing = list.find(c => 'focus' in c);
    if (existing) { existing.navigate(link); return existing.focus(); }
    return clients.openWindow(link);
  }));
});
