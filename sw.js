// Service worker: maakt de app offline bruikbaar. Geregistreerd als /sw.js met scope "/" (js/main.js), dus "./x" = "/x". Verhoog VERSION bij elke release zodat de cache ververst.
// Gelijk houden aan js/version.js (de test bewaakt dat); dit is ook het nummer dat de app toont.
const VERSION = "2.18.2";
const CACHE = "initiative-tafel-" + VERSION;
// TS1: pdf.js (± 2,5 MB, alleen voor de PDF-import) in een eigen cache op zijn eigen versie: blijft staan bij een
// app-update, zodat niet elke release hem opnieuw downloadt. Nieuwe pdf.js-versie = nieuwe map en nieuwe naam hier.
const VENDOR = "initiative-tafel-pdfjs-3.11.174";
const VENDOR_ASSETS = ["./vendor/pdfjs/pdf.js", "./vendor/pdfjs/pdf.worker.js"];
// Inn Sight (G4, WP56; docs/g4-inn-the-grid.md §2.10): eigen versie en eigen cache met alleen de Maps-bestanden.
// Gelijk houden aan js/maps/version.js (tests/maps-sw.test.js). Een Maps-release verhoogt alleen MAPS_VERSION: CACHE
// van Initiative heet dan nog hetzelfde en install haalt bestanden die daar al staan niet opnieuw op (en omgekeerd).
// Gedeeld (css/app.css, fonts, iconen, js/i18n/*, js/theme.js, homepage) staat in ASSETS: wijzigen = Initiative-release.
const MAPS_VERSION = "1.7.0";
const MAPS_CACHE = "kevs-inn-maps-" + MAPS_VERSION;
const MAPS_ASSETS = [
  "./maps/",
  "./nl/maps/",
  "./maps/manifest.webmanifest",
  "./nl/maps/manifest.webmanifest",
  "./maps/icons/icon.svg",
  "./maps/icons/icon-180.png",
  "./maps/icons/icon-192.png",
  "./maps/icons/icon-512.png",
  "./maps/icons/icon-maskable-512.png",
  "./css/maps.css",
  "./js/maps/main.js",
  "./js/maps/version.js",
  "./js/maps/model/grid.js",
  "./js/maps/model/view.js",
  "./js/maps/render/canvas.js",
  "./js/maps/ui/input.js",
  "./js/maps/ui/dom.js",
  "./js/maps/model/map.js",
  "./js/maps/store.js",
  "./js/maps/save.js",
  "./js/maps/tablock.js",
  "./js/maps/model/bg.js",
  "./js/maps/model/image.js",
  "./js/maps/ui/upload.js",
  "./js/maps/model/file.js",
  "./js/maps/ui/export.js",
  "./js/maps/model/history.js",
  "./js/maps/model/assets.js",
  "./js/maps/model/limits.js",
  "./js/maps/model/bench.js",
  "./js/maps/ui/bench.js",
  "./js/maps/model/objects.js",
  "./js/maps/model/terrain.js",
  "./js/maps/model/fog.js",
  "./js/maps/model/tokens.js",
  "./js/maps/model/mine.js",
  "./js/maps/model/hit.js",
  "./js/maps/render/art.js",
  "./data/maps-assets/altar.svg",
  "./data/maps-assets/barrel.svg",
  "./data/maps-assets/bed.svg",
  "./data/maps-assets/bush.svg",
  "./data/maps-assets/campfire.svg",
  "./data/maps-assets/chair.svg",
  "./data/maps-assets/chest.svg",
  "./data/maps-assets/crate.svg",
  "./data/maps-assets/door.svg",
  "./data/maps-assets/dirt.svg",
  "./data/maps-assets/flagstone.svg",
  "./data/maps-assets/planks.svg",
  "./data/maps-assets/log.svg",
  "./data/maps-assets/pillar.svg",
  "./data/maps-assets/pond.svg",
  "./data/maps-assets/rock.svg",
  "./data/maps-assets/rug.svg",
  "./data/maps-assets/shelf.svg",
  "./data/maps-assets/stairs.svg",
  "./data/maps-assets/table.svg",
  "./data/maps-assets/tent.svg",
  "./data/maps-assets/trapdoor.svg",
  "./data/maps-assets/tree.svg",
  "./data/maps-assets/wall.svg",
  "./locales/maps/en.js",
  "./locales/maps/nl.js",
  "./locales/maps/xx.js",
];
const MAPS_SET = new Set(MAPS_ASSETS); // WP68d: aanvullen bij gebruik (fetch)
// Pagina's (WP21; WP44: Engels zonder taalcode): homepage (WP30) en app per taal plus de oude spelersadressen (/speler,
// /player), die offline moeten werken voor beginscherm-apps en QR-links; tests/pages.test.js bewaakt dat elke
// gegenereerde pagina hier staat. "/initiative/" en "/nl/initiative/" zijn de start_url van de manifesten (K10).
const ASSETS = [
  "./",
  "./initiative/",
  "./initiative/player/",
  "./nl/",
  "./nl/initiative/",
  "./nl/initiative/player/",
  "./nl/manifest.webmanifest",
  "./player",
  "./css/app.css",
  "./data/monsters.json",
  "./data/monsters-2024.json",
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
  "./js/backup.js",
  "./js/exportnudge.js",
  "./js/data/monsters.js",
  "./js/data/statparse.js",
  "./js/data/spells.js",
  "./js/data/spellnotes.js",
  "./js/data/syn.js",
  "./js/ddb.js",
  "./js/ddbjson.js",
  "./js/log.js",
  "./js/main.js",
  "./js/playerview.js",
  "./js/rules/aoe.js",
  "./js/rules/attacks.js",
  "./js/rules/statform.js",
  "./js/rules/monrules.js",
  "./js/rules/passives.js",
  "./js/rules/combat.js",
  "./js/rules/conclist.js",
  "./js/rules/conditions.js",
  "./js/rules/dice.js",
  "./js/rules/effects.js",
  "./js/rules/edition.js",
  "./js/rules/encounters.js",
  "./js/rules/fight.js",
  "./js/rules/maptoks.js",
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
  "./js/ui/hpbar.js",
  "./js/ui/encounters.js",
  "./js/ui/encmap.js",
  "./js/ui/mapview.js",
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

const put = (c, a) => fetch(a, { cache: "reload" }).then((res) => {
  if (!res.ok) throw new Error(`${a}: ${res.status}`);
  return unredirect(res).then((r) => c.put(a, r));
});

// Alleen ophalen wat nog niet in deze cache staat: een cache hoort bij één versie (nieuwe versie = nieuwe naam = leeg),
// dus een treffer is altijd actueel. Zo kost een Maps-release Initiative-gebruikers geen nieuwe download (WP56).
// soft = best effort per bestand (een fout gooit niet).
const fill = (name, list, soft) => caches.open(name).then((c) => Promise.all(list.map((a) => {
  const p = c.match(a).then((hit) => hit || put(c, a));
  return soft ? p.catch(() => {}) : p;
})));

self.addEventListener("install", (e) => {
  e.waitUntil(Promise.all([
    fill(CACHE, ASSETS),
    // best effort: een mislukt Maps-bestand mag een Initiative-update niet tegenhouden (D2); de fetch-handler valt terug op het netwerk
    fill(MAPS_CACHE, MAPS_ASSETS, true).catch(() => {}),
    // best effort: een mislukte pdf.js-download mag de app-update niet tegenhouden; de fetch-handler vult later aan
    caches.open(VENDOR).then((c) => Promise.all(VENDOR_ASSETS.map((a) => c.match(a).then((hit) => hit || put(c, a)).catch(() => {})))),
  ]).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== VENDOR && k !== MAPS_CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Eigen bestanden: eerst cache (snel en offline). Extern: netwerk, met cache als terugval (sinds TS1 geen CDN meer).
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url), own = url.origin === self.location.origin;
  // live data: D&D Beyond en de spelersscherm-kamers (/api/room, ook de WebSocket) nooit uit de cache.
  // POST /api/room komt hier al niet (alleen GET); WebSockets gaan niet langs de service worker.
  if (own && url.pathname.startsWith("/api/")) return;
  // WP44: oud Engels adres (/en, /en/…) → zelfde pad zonder /en, ook offline; gelijk aan enRedirect in worker/index.js
  const en = own && /^\/en(\/.*)?$/.exec(url.pathname);
  if (en) { e.respondWith(Response.redirect(url.origin + "/" + (en[1] || "/").replace(/^\/+/, "") + url.search, 301)); return; }
  if (own && url.pathname.startsWith("/vendor/")) { // pdf.js: niet bij install gelukt = bij het eerste gebruik bewaren
    e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VENDOR).then((c) => c.put(req, copy)); }
      return res;
    })));
  } else if (own) {
    // WP68d: install vult Maps best effort (D2). Mislukte daar een Maps-bestand, dan bewaart het eerste gebruik met
    // netwerk het alsnog, zodat een geïnstalleerde Inn Sight daarna ook offline start (zonder Initiative-updates te blokkeren).
    const mk = "." + url.pathname;
    e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => (hit ? unredirect(hit) : fetch(req).then((res) => {
      if (res.ok && MAPS_SET.has(mk)) { const copy = res.clone(); unredirect(copy).then((r) => caches.open(MAPS_CACHE).then((c) => c.put(mk, r))).catch(() => {}); }
      return res;
    }))));
  } else {
    e.respondWith(fetch(req).then((res) => {
      if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req)));
  }
});
