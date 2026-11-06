// Service worker de Caeliscope: permite instalarlo como app y abrirlo sin conexión después de la primera visita.
// Solo guarda archivos de este mismo sitio (código, catálogos, texturas, tipografías). Las imágenes satelitales de NASA GIBS del globo
// NO se guardan: sin conexión el globo funciona con las texturas locales y se omite el detalle del mapa.
// El identificador lo escribe solo cada compilación (scripts/stamp-sw.mjs): no hay que tocarlo a mano.
const CACHE_VERSION = '__BUILD_ID__';
const CACHE = `caeliscope-${CACHE_VERSION}`;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('caeliscope-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;       // solo lo propio; lo externo va directo a la red
  if (req.headers.has('range')) return;
  if (req.mode === 'navigate') {                                                  // la página: red primero (así llega la versión nueva), copia guardada sin conexión
    e.respondWith((async () => {
      try { const r = await fetch(req); if (r.ok) (await caches.open(CACHE)).put(req, r.clone()); return r; }
      catch { return (await caches.match(req, { ignoreSearch: true })) || (await caches.match(new URL('./', self.registration.scope))) || Response.error(); }
    })());
    return;
  }
  e.respondWith((async () => {                                                    // el resto: copia guardada primero (los archivos con huella no cambian), si no, red y se guarda
    const hit = await caches.match(req);
    if (hit) return hit;
    const r = await fetch(req);
    if (r.ok && r.type === 'basic') (await caches.open(CACHE)).put(req, r.clone());
    return r;
  })());
});
