// Service worker: maakt de app offline bruikbaar. Geregistreerd als /sw.js met scope "/" (js/main.js), dus "./x" = "/x". Verhoog VERSION bij elke release zodat de cache ververst.
// Gelijk houden aan js/version.js (de test bewaakt dat); dit is ook het nummer dat de app toont.
const VERSION = "1.53.0";
const CACHE = "initiative-tafel-" + VERSION;
// Pagina's (WP21): homepage (WP30) en app per taal plus de taalloze doorverwijzers (/, /speler, /player, /initiative/), die offline moeten
// werken voor beginscherm-apps en QR-links; tests/pages.test.js bewaakt dat elke gegenereerde pagina hier staat.
const ASSETS = [
  "./",
  "./en/",
  "./en/initiative/",
  "./en/initiative/player/",
  "./en/manifest.webmanifest",
  "./initiative/",
  "./initiative/player/",
  "./nl/",
  "./nl/initiative/",
  "./nl/initiative/player/",
  "./nl/manifest.webmanifest",
  "./player",
  "./css/app.css",
  "./data/monsters.json",
  "./data/spells-2024.json",
  "./data/spells.json",
  "./fonts/dm-sans-latin-wght-italic.woff2",
  "./fonts/dm-sans-latin-wght.woff2",
  "./fonts/newsreader-latin-wght.woff2",
  "./icons/creatures.svg",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/icon.svg",
  "./icons/ui.svg",
  "./index.html",
  "./js/backup.js",
  "./js/exportnudge.js",
  "./js/data/monsters.js",
  "./js/data/statparse.js",
  "./js/data/spells.js",
  "./js/data/syn.js",
  "./js/ddb.js",
  "./js/ddbjson.js",
  "./js/log.js",
  "./js/main.js",
  "./js/playerview.js",
  "./js/rules/aoe.js",
  "./js/rules/attacks.js",
  "./js/rules/monrules.js",
  "./js/rules/passives.js",
  "./js/rules/combat.js",
  "./js/rules/conclist.js",
  "./js/rules/conditions.js",
  "./js/rules/dice.js",
  "./js/rules/effects.js",
  "./js/rules/encounters.js",
  "./js/rules/fight.js",
  "./js/rules/legendary.js",
  "./js/rules/saves.js",
  "./js/rules/spellcast.js",
  "./js/rules/spells.js",
  "./js/rules/dmgspells.js",
  "./js/rules/dmgtable.js",
  "./js/rules/slots.js",
  "./js/rules/turns.js",
  "./js/share.js",
  "./js/qr.js",
  "./js/tvfit.js",
  "./js/speler.js",
  "./js/state.js",
  "./js/histpack.js",
  "./js/i18n/boot.js",
  "./js/i18n/core.js",
  "./js/i18n/lang.js",
  "./js/i18n/msg.js",
  "./js/i18n/redirect.js",
  "./js/i18n/term.js",
  "./js/storage.js",
  "./js/tablock.js",
  "./js/theme.js",
  "./js/ui/actions.js",
  "./js/ui/avatar.js",
  "./js/ui/encounters.js",
  "./js/ui/einde.js",
  "./js/ui/render.js",
  "./js/ui/kamer.js",
  "./js/ui/keys.js",
  "./js/ui/settings.js",
  "./js/ui/spellinfo.js",
  "./js/ui/condinfo.js",
  "./js/ui/langpick.js",
  "./js/ui/spellrules.js",
  "./js/ui/pcreact.js",
  "./js/ui/tour.js",
  "./js/tour.js",
  "./js/ui/icons.js",
  "./js/ui/initroll.js",
  "./js/ui/playervis.js",
  "./js/ui/statblock.js",
  "./js/ui/util.js",
  "./js/version.js",
  "./locales/en.js",
  "./locales/nl.js",
  "./locales/xx.js",
  "./locales/nl/search.js",
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
  // live data: D&D Beyond en de spelersscherm-kamers (/api/room, ook de WebSocket) nooit uit de cache.
  // POST /api/room komt hier al niet (alleen GET); WebSockets gaan niet langs de service worker.
  if (own && url.pathname.startsWith("/api/")) return;
  if (own) {
    e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => (hit ? unredirect(hit) : fetch(req))));
  } else {
    e.respondWith(fetch(req).then((res) => {
      if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req)));
  }
});
