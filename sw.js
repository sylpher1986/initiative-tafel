// Service worker: maakt de app offline bruikbaar. Verhoog VERSION bij elke release zodat de cache ververst.
// Gelijk houden aan js/version.js (de test bewaakt dat); dit is ook het nummer dat de app toont.
const VERSION = "1.6.4";
const CACHE = "initiative-tafel-" + VERSION;
const ASSETS = [
  "./",
  "./css/app.css",
  "./data/monsters.json",
  "./fonts/alegreya-sans-400.woff2",
  "./fonts/alegreya-sans-400-italic.woff2",
  "./fonts/alegreya-sans-700.woff2",
  "./fonts/alegreya-sans-700-italic.woff2",
  "./fonts/alegreya-sc-500.woff2",
  "./fonts/alegreya-sc-700.woff2",
  "./fonts/alegreya-sc-800.woff2",
  "./icons/creatures.svg",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/icon.svg",
  "./index.html",
  "./js/backup.js",
  "./js/data/monsters.js",
  "./js/ddb.js",
  "./js/ddbjson.js",
  "./js/log.js",
  "./js/main.js",
  "./js/playerview.js",
  "./js/rules/aoe.js",
  "./js/rules/combat.js",
  "./js/rules/dice.js",
  "./js/rules/effects.js",
  "./js/rules/spells.js",
  "./js/rules/turns.js",
  "./js/share.js",
  "./js/speler.js",
  "./js/state.js",
  "./js/storage.js",
  "./js/theme.js",
  "./js/ui/actions.js",
  "./js/ui/avatar.js",
  "./js/ui/render.js",
  "./js/ui/statblock.js",
  "./js/ui/util.js",
  "./js/version.js",
  "./manifest.webmanifest",
  "./speler",
];

// Cloudflare stuurt /pagina.html door naar /pagina. Safari weigert een doorgestuurd antwoord uit de
// service worker voor een pagina ("Response served by service worker has redirections"): bewaar en geef
// daarom altijd een kopie zonder redirect-vlag.
const unredirect = async (res) => (res && res.redirected
  ? new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers })
  : res);

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(ASSETS.map((a) =>
    fetch(a, { cache: "reload" }).then((res) => {
      if (!res.ok) throw new Error(`${a}: ${res.status}`);
      return unredirect(res).then((r) => c.put(a, r));
    })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Eigen bestanden: eerst cache (snel en offline). Externe (pdf.js): netwerk, met cache als terugval.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url), own = url.origin === self.location.origin;
  if (own && url.pathname.startsWith("/api/")) return; // live data (D&D Beyond): nooit uit de cache
  if (own) {
    e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => (hit ? unredirect(hit) : fetch(req))));
  } else {
    e.respondWith(fetch(req).then((res) => {
      if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req)));
  }
});
