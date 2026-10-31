// Service worker: makes the game installable and lets it open with no connection.
// Pages: network first, so an update shows up on the next launch; the cached copy is the fallback.
// Built files (hashed names under assets/): cache first, they never change under the same name.
// Art and other files: the cached copy right away, refreshed in the background for next time.
// Other sites (the Supabase cloud save, fonts) are left alone: an old cached save must never come back.
const CACHE = 'hordefall-v2';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function store(req, res) {
  if (res.ok && res.type === 'basic') {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy));
  }
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => store(req, res))
        .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html'))),
    );
    return;
  }
  const hashed = url.pathname.includes('/assets/');
  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit && hashed) return hit;
      const fresh = fetch(req).then((res) => store(req, res));
      if (hit) {
        e.waitUntil(fresh.catch(() => {}));
        return hit;
      }
      return fresh;
    }),
  );
});
