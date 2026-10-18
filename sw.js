// Service worker: maakt de app offline bruikbaar. Verhoog VERSION bij elke release zodat de cache ververst.
const VERSION = "v4";
const CACHE = "initiative-tafel-" + VERSION;
const ASSETS = [
  "./",
  "./css/app.css",
  "./data/monsters.json",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/icon.svg",
  "./index.html",
  "./js/backup.js",
  "./js/data/monsters.js",
  "./js/ddb.js",
  "./js/log.js",
  "./js/main.js",
  "./js/rules/combat.js",
  "./js/rules/dice.js",
  "./js/rules/spells.js",
  "./js/rules/turns.js",
  "./js/state.js",
  "./js/storage.js",
  "./js/theme.js",
  "./js/ui/actions.js",
  "./js/ui/render.js",
  "./js/ui/statblock.js",
  "./js/ui/util.js",
  "./manifest.webmanifest",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Eigen bestanden: eerst cache (snel en offline). Externe (lettertypes, pdf.js): netwerk, met cache als terugval.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const own = new URL(req.url).origin === self.location.origin;
  if (own) {
    e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req)));
  } else {
    e.respondWith(fetch(req).then((res) => {
      if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req)));
  }
});
