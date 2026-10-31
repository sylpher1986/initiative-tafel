// Vaste browsercheck (WP13). Draait de matrix 320/360/390 px × licht/donker met touch en rapporteert getallen:
// horizontaal scrollen, zichtbare tikdoelen < 44 px en JS-fouten. FOUT (exitcode 1) = horizontaal scrollen of een JS-fout;
// te kleine tikdoelen worden geteld en op 320 licht opgesomd, maar zijn geen FOUT (vergelijk met de vorige run). Screenshots alleen op verzoek (320 px, licht en donker).
//
//   node tools/browsercheck.mjs                 alle scenario's
//   node tools/browsercheck.mjs prep fight      alleen deze scenario's
//   node tools/browsercheck.mjs --shots=fight   ook screenshots van "fight" in shots/ (komma's voor meer)
//   node tools/browsercheck.mjs --lang=nl,en,xx  taal als extra as (WP32; standaard nl): pagina in die taal (WP44: Engels zonder voorvoegsel); xx = de
//                                                testtaal op de Engelse pagina's (lange tekst, accenten; WP20)
//   node tools/browsercheck.mjs --i18n=debug     debugstand (ontbrekende vertaling als ⟦…⟧); --i18n=xx = --lang=xx (oud)
//
// Altijd FOUT: een ⟦ op het scherm (ontbrekende vertaling in de debugstand, js/i18n/boot.js). In en ook FOUT: een regel
// Nederlandse tekst op het scherm (heuristiek van tools/i18n-audit.mjs; namen die het scenario zelf intypt tellen niet).
// Scenario's in ONCE (eigen taalopzet: DM nl + speler en, taalwissel, offline, oude export) draaien één keer per taal-run.
//
// Playwright staat niet in package.json (geen dependencies). Het script zoekt het via PW_MODULE, gewone resolutie
// of /opt/npm-tools; browsers in PLAYWRIGHT_BROWSERS_PATH (standaard /opt/pw-browsers).
// Per pakket: voeg een scenario toe aan SCEN (naam → async (page) => { … }) dat de app in de juiste stand zet.
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { extname, join, normalize } from "node:path";
import { isDutch } from "./i18n-audit.mjs";
import { pathFor, langBase } from "../js/i18n/lang.js";
import { enRedirect } from "../worker/index.js";
import { Room, rt as roomRt, MAX_MSG } from "../worker/room.js";
import { BUILTIN, BUILTIN_IDS } from "../js/maps/model/assets.js";
import { placeAt } from "../js/maps/model/objects.js";
import { handles } from "../js/maps/model/hit.js";
import { cleanGrid, cellCenter, cellAt } from "../js/maps/model/grid.js";

process.env.PLAYWRIGHT_BROWSERS_PATH ||= "/opt/pw-browsers";
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const WIDTHS = process.env.BC_W ? process.env.BC_W.split(",").map(Number) : [320, 360, 390], SCHEMES = ["light", "dark"];

/** TS6: wacht tot sleutel key in de IndexedDB van de app (js/storage.js: db "initiative-tafel", store "kv") ok(waarde) geeft.
 *  Leest de opslag zelf, niet app-geheugen: zo is een herladen daarna zeker van de nieuwe waarde. Alleen na het opstarten
 *  van de app gebruiken: open zonder versie maakt anders een lege database aan. */
async function idbHas(page, key, ok, ms = 5000) {
  const read = () => page.evaluate((k) => new Promise((res) => {
    const r = indexedDB.open("initiative-tafel");
    r.onerror = () => res(undefined);
    r.onsuccess = () => { try { const g = r.result.transaction("kv").objectStore("kv").get(k); g.onsuccess = () => { r.result.close(); res(g.result); }; g.onerror = () => { r.result.close(); res(undefined); }; } catch { r.result.close(); res(undefined); } };
  }), key);
  const end = Date.now() + ms;
  for (;;) {
    if (ok(await read())) return;
    if (Date.now() > end) throw new Error(`IndexedDB: ${key} niet opgeslagen binnen ${ms} ms`);
    await page.waitForTimeout(50);
  }
}

/** WP58: wacht tot alle kaarten in IndexedDB "kevs-inn-maps" (js/maps/store.js) ok(lijst) geven. Leest de opslag zelf. */
async function mapsIdb(page, ok, ms = 5000) {
  const read = () => page.evaluate(() => new Promise((res) => {
    const r = indexedDB.open("kevs-inn-maps");
    r.onerror = () => res(undefined);
    r.onsuccess = () => { try { const g = r.result.transaction("maps").objectStore("maps").getAll(); g.onsuccess = () => { r.result.close(); res(g.result); }; g.onerror = () => { r.result.close(); res(undefined); }; } catch { r.result.close(); res(undefined); } };
  }));
  const end = Date.now() + Math.max(ms, 100);
  for (;;) {
    const v = await read();
    if (v && ok(v)) return v;
    if (Date.now() > end) throw new Error(`kevs-inn-maps: niet binnen ${ms} ms: ` + JSON.stringify(v)?.slice(0, 300));
    await page.waitForTimeout(50);
  }
}

/** WP59: alle assets in "kevs-inn-maps" als { key, mime, w, h, ow, oh, exif } (leest de opslag zelf) */
const mapsAssets = (page) => page.evaluate(() => new Promise((res) => {
  const r = indexedDB.open("kevs-inn-maps");
  r.onerror = () => res(null);
  r.onsuccess = () => {
    const out = [], c = r.result.transaction("assets").objectStore("assets").openCursor();
    c.onsuccess = () => {
      const k = c.result;
      if (!k) { r.result.close(); res(out); return; }
      const v = k.value, b = new Uint8Array(v.data), s = String.fromCharCode(...b.subarray(0, Math.min(b.length, 4096)));
      out.push({ key: k.key, mime: v.mime, w: v.w, h: v.h, ow: v.ow, oh: v.oh, exif: s.includes("Exif") });
      k.continue();
    };
    c.onerror = () => { r.result.close(); res(null); };
  };
}));
/** WP59: testafbeelding in de pagina tekenen (OffscreenCanvas) en als bytes teruggeven: w×h, raster om de cell px */
const fixture = (page, w, h, cell, type = "image/png") => page.evaluate(async ([w, h, cell, type]) => {
  const c = new OffscreenCanvas(w, h), g = c.getContext("2d");
  g.fillStyle = "#c9b48a"; g.fillRect(0, 0, w, h);
  g.strokeStyle = "#3a281e"; g.lineWidth = 2; g.beginPath();
  for (let x = 0; x <= w; x += cell) { g.moveTo(x, 0); g.lineTo(x, h); }
  for (let y = 0; y <= h; y += cell) { g.moveTo(0, y); g.lineTo(w, y); }
  g.stroke(); g.fillStyle = "#8a1d14"; g.fillRect(0, 0, cell, cell);
  return [...new Uint8Array(await (await c.convertToBlob({ type, quality: 0.9 })).arrayBuffer())];
}, [w, h, cell, type]).then((a) => Buffer.from(a));

async function loadPw() {
  for (const p of [process.env.PW_MODULE, "playwright", "/opt/npm-tools/node_modules/playwright", "/opt/node-tools/node_modules/playwright"].filter(Boolean)) {
    try { return p.startsWith("/") ? createRequire(import.meta.url)(p) : await import(p); } catch { /* volgende */ }
  }
  throw new Error("Playwright niet gevonden. Zet PW_MODULE op het pad van de playwright-module.");
}

// Statische server zoals Cloudflare: /speler → speler.html, /nl/initiative/ → nl/initiative/index.html (WP21);
// /en, /en/… → 301 zoals de Worker (enRedirect, WP44). /api/* bestaat hier niet (404, wordt genegeerd); elke andere 404
// is FOUT (bijv. een relatief pad onder /nl/).
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".avif": "image/avif", ".webp": "image/webp", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
let OFFLINE = false; // i18n-offline: server weigert alles (Chromiums setOffline blokkeert navigaties al vóór de service worker)
function serve() {
  const srv = createServer(async (req, res) => {
    if (OFFLINE) { req.socket.destroy(); return; }
    let p;
    const en = enRedirect(new URL(req.url, "http://127.0.0.1"));
    if (en) { const u = new URL(en); res.writeHead(301, { location: u.pathname + u.search }).end(); return; }
    try { p = decodeURIComponent(new URL(req.url, "http://x").pathname); } catch { res.writeHead(400).end(); return; }
    if (p.endsWith("/")) p += "index.html"; else if (!extname(p)) p += ".html";
    const f = normalize(join(ROOT, p));
    if (!f.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    try { const b = await readFile(f); res.writeHead(200, { "content-type": TYPES[extname(f)] || "application/octet-stream" }).end(b); }
    catch { res.writeHead(404).end(); }
  });
  return new Promise((ok) => srv.listen(0, "127.0.0.1", () => ok(srv)));
}

// Scenario's met een andere startpagina dan "/"; zonder functie in SCEN wordt alleen geladen.
// "/" staat hier voor de app (sinds WP44 is "/" zelf de Engelse homepage), "/speler" voor het spelersscherm.
const START = { speler: "/speler", tagline: "/speler", stale: "/speler", "i18n-mixed": "/initiative/player/", home: "/nl/", homeen: "/", notfound: "/nl/404.html",
  "i18n-switch": "/nl/initiative/", "i18n-offline": "/nl/initiative/", "i18n-legacy": "/initiative/", wp33: "/", wp37: "/nl/", wp43: "/initiative/", wp44: "/", wp77: "/initiative/", maps: "/nl/maps/", wp57: "/nl/maps/", wp58: "/nl/maps/", wp58priv: "/nl/maps/", wp59: "/nl/maps/", wp60: "/nl/maps/", wp61: "/nl/maps/", wp62: "/nl/maps/", wp63: "/nl/maps/", wp64: "/nl/maps/", wp65: "/nl/maps/", wp66: "/nl/maps/", wp68: "/nl/maps/", wp68b: "/nl/maps/", wp68c: "/nl/maps/", wp68d: "/nl/maps/", wp73m: "/nl/maps/", wp74m: "/nl/maps/", wp75m: "/nl/maps/" };
// Script vóór het laden van de pagina, per scenario (WP58: privémodus zonder IndexedDB)
const INIT = { wp58priv: () => { try { Object.defineProperty(window, "indexedDB", { value: undefined, configurable: true }); } catch { /* al weg */ } } };
// Eigen taalopzet: niet per taal herhalen (WP32)
const ONCE = new Set(["i18n-mixed", "i18n-switch", "i18n-offline", "i18n-legacy", "homeen", "wp33", "wp43", "wp44", "wp77"]);
// Startpagina in een taal (pathFor: Engels zonder voorvoegsel); /nl/… wordt de pagina in die taal; ONCE blijft zoals het is
function startFor(name, lang) {
  const p = START[name] || "/";
  if (ONCE.has(name)) return p;
  if (p === "/") return pathFor(lang, "/initiative/");
  if (p === "/speler") return pathFor(lang, "/initiative/player/");
  return p.replace(/^\/nl\//, langBase(lang) + "/");
}
// Wat scenario's zelf intypen (gebruikersinhoud: wordt nooit vertaald)
const OWN = ["Hinderlaag bij de oude brug", "Aurelianus Vandermeer", "Zonder Level", "Vrije regel zonder punt"];
const noPaths = (l) => l.replace(/\S*\/\S*/g, " "); // paden en URL's (src/2014/en, /speler?k=) zijn geen tekst, zoals in tests/pages.test.js
const tap = (page, sel) => page.locator(sel).first().tap().catch((e) => { throw new Error(`tik ${sel}: ${String(e.message).split("\n")[0]}`); }); // WP61: welke tik
let SHOTS = new Set(); // --shots=…, gezet in main()
// WP35: extra screenshot midden in een scenario (alleen 320 px en alleen met --shots=<scenario>)
async function snap(page, name, part) {
  if (!SHOTS.has(name) || page.viewportSize().width !== 320) return;
  const [lang, dark] = await page.evaluate(() => [document.documentElement.lang, matchMedia("(prefers-color-scheme: dark)").matches]);
  await page.screenshot({ path: join(ROOT, "shots", `${name}-${part}-${lang}-320-${dark ? "dark" : "light"}.png`) });
}

// WP32: export zoals 1.48.0 die maakte (versie 2, logboek alleen als Nederlandse tekst, geen descriptoren m/w, snapshot-tijdperk v1)
const LEGACY = { format: "initiative-tafel", version: 2, exported: "2026-10-20T19:00:00.000Z", app: "1.48.0",
  state: { round: 1, active: "a", list: [
    { id: "a", name: "Aria", kind: "pc", init: 17, dex: 3, ac: 15, hp: 24, max: 24, cond: [] },
    { id: "g", name: "Goblin 1", kind: "monster", ref: "goblin", init: 12, dex: 2, ac: 15, hp: 0, max: 7, cond: [] },
    { id: "h", name: "Goblin 2", kind: "monster", ref: "goblin", init: 10, dex: 2, ac: 15, hp: 7, max: 7, cond: ["Prone"], cd: { Prone: { kind: "inf" } } } ],
    log: [
      { id: "l1", r: 0, turn: "", type: "", msg: "Goblin 1 doet mee (initiative 12)", why: "", note: "" },
      { id: "l2", r: 1, turn: "", type: "round", msg: "Ronde 1 begint", why: "", note: "" },
      { id: "l3", r: 1, turn: "Aria", type: "turn", msg: "Beurt van Aria", why: "", note: "" },
      { id: "l4", r: 1, turn: "Aria", type: "", msg: "Goblin 1: 7 schade (Longsword)", why: "d20 [14] +5 = 19 raak", note: "flankeerde" } ] },
  party: [{ pid: "pa", name: "Aria", ac: 15, hp: 24, max: 24, dex: 3, lvl: 3 }], lairs: {}, custom: [], imported: [], encounters: [] };

// Scenario's. Elk begint op een verse pagina (rondleiding uit, lege opslag).
// WP72: kamer in Node met de echte Room (worker/room.js) achter Playwrights routeWebSocket: DM en spelers in aparte
// browsercontexten praten zo via dezelfde kamer als op Cloudflare (opslag en sockets nagebootst zoals tests/room.test.js).
function kamerSim() {
  const m = new Map(), socks = [], big = [];
  const storage = {
    m, get: async (k) => m.get(k), put: async (k, v) => { if (typeof k === "object") for (const [a, b] of Object.entries(k)) m.set(a, b); else m.set(k, v); },
    delete: async (k) => (Array.isArray(k) ? k.forEach((x) => m.delete(x)) : m.delete(k)), list: async ({ prefix }) => new Map([...m].filter(([k]) => k.startsWith(prefix)).sort(([a], [b]) => (a < b ? -1 : 1))),
    deleteAll: async () => m.clear(), setAlarm: async () => {}, getAlarm: async () => null, deleteAlarm: async () => {},
  };
  const ctx = { storage, acceptWebSocket: (ws, tags) => { ws.tags = tags; socks.push(ws); }, getWebSockets: (tag) => socks.filter((w) => !w.closed && (!tag || w.tags.includes(tag))), getTags: (ws) => ws.tags };
  const room = new Room(ctx, {}), code = "K7M3QX", token = "t".repeat(32);
  const ready = (async () => {
    const h = Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))).toString("base64url");
    await room.fetch(new Request("https://kamer/init", { method: "POST", body: JSON.stringify({ hash: h }) }));
  })();
  async function attach(bctx) {
    await bctx.routeWebSocket(/\/api\/room\/[^/]+\/ws/, async (ws) => {
      await ready;
      const server = { tags: [], closed: false, accept() {}, send: (s) => { try { ws.send(s); } catch { /* dicht */ } }, close: (c) => { if (!server.closed) { server.closed = true; try { ws.close({ code: c }); } catch { /* dicht */ } } } };
      roomRt.pair = () => [{}, server];
      roomRt.upgraded = () => ({ status: 101 });
      await room.fetch(new Request(ws.url().replace(/^ws/, "http")));
      ws.onMessage((d) => { if (typeof d === "string" && d.length > MAX_MSG) big.push(d.length); room.webSocketMessage(server, d); });
      ws.onClose(() => { server.closed = true; room.webSocketClose(server, 1000); });
    });
  }
  return { code, token, room: { code, token, at: Date.now() }, attach, storage: m, big };
}

const SCEN = {
  async welcome(page) { await page.waitForSelector("#welcome-sample"); },
  async prep(page) { await tap(page, "#welcome-sample"); await page.waitForSelector("#start:not([disabled])"); },
  async monster(page) { await SCEN.prep(page); await tap(page, '#dock [data-prep="mon"]'); await page.waitForSelector("#psheet .sheet", { state: "visible" }); },
  async settings(page) { await SCEN.prep(page); await tap(page, '#dock [data-prep="data"]'); await page.waitForSelector("#psheet .sheet", { state: "visible" }); },
  async fight(page) {
    await SCEN.prep(page);
    await tap(page, "#start");
    const n = await page.locator('[data-ia="roll"]').count();
    for (let i = 0; i < n; i++) await page.locator('[data-ia="roll"]').nth(i).tap(); // elke tik tekent het paneel opnieuw
    if (n) await tap(page, '[data-ia="go"]');
    await page.waitForSelector("#next");
    // 1.48.3: het rondeblok (Gevecht · Logboek, Ronde, Party/Vijanden) past binnen zijn eigen rand
    await page.evaluate(() => document.fonts.ready);
    const ft = await page.evaluate(() => { const f = document.querySelector("#logopen"); if (!f) return 0; // slechtste geval: Ronde 10, 12/12
      const rn = f.querySelector(".rn"), su = f.querySelector(".fsum"), was = [rn.textContent, su.innerHTML];
      rn.textContent = "Ronde 10"; su.innerHTML = "<span>Party <b>12/12</b></span> · <span>Vijanden <b>12/12</b></span>";
      const d = f.scrollWidth - f.clientWidth; [rn.textContent, su.innerHTML] = was; return d; });
    if (ft > 0) throw new Error(`rondeblok loopt ${ft}px over zijn rand`);
  },
  // 1.48.3: gestopt delen; de grijze code mag geen paneel-dim worden die tikken op Instellingen blokkeert
  async delen(page) {
    await page.evaluate(() => localStorage.setItem("it-room", JSON.stringify({ code: "E5HMTJ", token: "t".repeat(32), stopped: true, at: Date.now() })));
    await page.reload(); await page.waitForSelector("#dock");
    await SCEN.settings(page);
    await page.locator('details[data-sec="player"] > summary').tap();
    await page.waitForSelector("#kamer-box .kamer-code");
    const bad = await page.evaluate(() => [...document.querySelectorAll('#psheet [data-vis] button, #kamer-box button')].filter((b) => {
      b.scrollIntoView({ block: "center" }); const r = b.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !(e && b.contains(e)); }).map((b) => b.textContent.trim()));
    if (bad.length) throw new Error("niet tikbaar: " + bad.join(", "));
  },
  // WP14: beurt (gouden vlak) en een andere geopende kaart (ring) naast elkaar
  async kleur(page) { await SCEN.fight(page); await page.locator("#order .c.k:not(.turn) .khead").first().tap(); await page.waitForSelector("#order .c.k.open:not(.turn)"); },
  // WP14: schadepaneel met gouden toepasknop
  async schade(page) {
    await SCEN.fight(page); await tap(page, "#order .c.k.turn .khp"); await page.waitForSelector("#sheet .pad");
    await page.locator("#sheet .pad button", { hasText: /^7$/ }).first().tap();
  },
  // WP15/WP34: letters geladen, h1 op één regel, gevecht met open statblock (Newsreader-naam, DM Sans-tekst), tnum werkt
  async letters(page) {
    await SCEN.prep(page);
    const f = await page.evaluate(async () => { await document.fonts.ready; const h = document.querySelector("h1"), lh = parseFloat(getComputedStyle(h).lineHeight);
      return { sans: document.fonts.check('16px "DM Sans"'), brand: document.fonts.check('600 26px "Newsreader"'), lines: Math.round(h.getBoundingClientRect().height / lh) }; });
    if (!f.sans || !f.brand) throw new Error("letters niet geladen: " + JSON.stringify(f));
    if (f.lines > 1) throw new Error(`h1 over ${f.lines} regels`);
    await tap(page, "#start");
    const n = await page.locator('[data-ia="roll"]').count();
    for (let i = 0; i < n; i++) await page.locator('[data-ia="roll"]').nth(i).tap();
    if (n) await tap(page, '[data-ia="go"]');
    await page.waitForSelector("#next");
    // WP34: DM Sans heeft geen tabular-nums (geen tnum in het lettertype, ook upstream niet): de initiative-kolom moet dan
    // zelf een vaste breedte hebben, anders verspringen naam en HP-balk per kaart ("1" is half zo breed als "0")
    const iw = await page.$$eval("#order .c.k:not(.lair) .khead .i", (els) => els.map((e) => Math.round(e.getBoundingClientRect().width * 2) / 2));
    if (new Set(iw).size > 1) throw new Error("initiative-kolom niet even breed: " + iw.join(","));
    const mon = page.locator("#order .c.k.mon").first();
    if (!(await mon.evaluate((el) => el.classList.contains("open")))) await mon.locator(".khead").tap();
    await mon.locator('[data-a="sb"]').tap();
    await page.waitForSelector(".sb h2", { state: "visible" });
  },
  // WP39 (HS16–HS18): donker thema in een schemerige kamer (geen knop- of meldingsvlak feller dan Volgende), krap op 320 px
  // (statblock-titel max. twee regels, .acts-labels niet tegen de rand, + Speler-velden op één hoogte, ras niet afgekapt),
  // na Gevecht afronden statblock dicht en één melding, homepage-voet begint geen regel met "·". --shots=wp39: alle tussenstanden.
  async wp39(page, base) {
    const lum = () => { // relatieve luminantie van een computed rgb()-kleur
      window.__lum = (c) => { const v = (c.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).map((x) => x / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
    };
    await SCEN.letters(page); // gevecht, statblock van het eerste monster open
    await page.evaluate(lum);
    const sbl = await page.evaluate(() => { const h = document.querySelector(".sb h2"); h.textContent = "Adult Black Dragon"; // langste gangbare naam
      return Math.round(h.getBoundingClientRect().height / parseFloat(getComputedStyle(h).lineHeight)); });
    const xx = await page.evaluate(() => localStorage.getItem("kevs-i18n-debug") === "xx"); // testtaal: lange knoppen naast de titel, alleen lengte
    if (sbl > 2 && !xx) throw new Error(`statblock-titel over ${sbl} regels`);
    await snap(page, "wp39", "statblock");
    await page.evaluate(async () => (await import("/js/ui/statblock.js")).closeSB());
    const turn = page.locator("#order .c.k.turn");
    if (!(await turn.evaluate((el) => el.classList.contains("open")))) await turn.locator(".khead").tap();
    const acts = await turn.evaluate((el) => [...el.querySelectorAll(".acts button")].filter((b) => b.textContent.trim()).map((b) => {
      const g = document.createRange(); g.selectNodeContents(b); const rs = [...g.getClientRects()], r = b.getBoundingClientRect();
      return { t: b.textContent.trim(), free: Math.round(Math.min(...rs.map((x) => Math.min(x.left - r.left, r.right - x.right)))) }; })); // lucht tussen tekst en rand
    const tight = acts.filter((a) => a.free < 3); // was ± 0 (persona-test 2.0)
    if (tight.length && !xx) throw new Error("actieknop krap of overlopend: " + JSON.stringify(tight));
    await turn.locator('[data-a="panel"][data-p="conds"]').tap();
    await page.waitForSelector("#order .condgrid");
    await snap(page, "wp39", "conditie");
    await turn.locator(".khp").tap(); await page.waitForSelector("#sheet .pad");
    await page.locator("#sheet .pad button", { hasText: /^7$/ }).first().tap();
    await tap(page, '#sheet [data-sk="apply"]');
    await page.waitForSelector("#toast .tmsg");
    const dark = await page.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) { // HS16: in een schemerige kamer is Volgende het felste vlak
      const r = await page.evaluate(() => { const L = (el) => window.__lum(getComputedStyle(el).backgroundColor), nx = L(document.querySelector("#next"));
        return [...document.querySelectorAll("#toast .tmsg, #order .acts button, #dock button:not(#next)")].filter((el) => L(el) > nx).map((el) => el.id || el.className || el.textContent.trim().slice(0, 16)); });
      if (r.length) throw new Error("feller dan Volgende in donker: " + r.join(", "));
    }
    await snap(page, "wp39", "melding");
    await tap(page, '#modes [data-setmode="prep"]');
    await page.evaluate(async () => { const c = (await import("/js/state.js")).app.S.list.find((x) => x.kind === "monster"); if (c) (await import("/js/ui/statblock.js")).showSB(c, true); });
    await tap(page, "#stop"); await page.waitForSelector("#esheet .esheet");
    const end = await page.evaluate(() => ({ sb: document.querySelector("#sbwrap")?.dataset.open === "true", n: document.querySelectorAll("#toast .tmsg").length }));
    if (end.sb || end.n !== 1) throw new Error("na Gevecht afronden: " + JSON.stringify(end));
    await snap(page, "wp39", "einde");
    await page.keyboard.press("Escape");
    await tap(page, '#dock [data-prep="pc"]'); await page.waitForSelector("#f-pc", { state: "visible" });
    const f = await page.evaluate(() => { const sel = document.querySelector("#pc-race"), rows = {}; // velden per rij (zelfde labelhoogte) moeten op dezelfde hoogte beginnen
      for (const id of ["#pc-ac", "#pc-hp", "#pc-bon", "#pc-race", "#pc-lvl"]) { const el = document.querySelector(id), lt = Math.round(el.closest("label, .lab").getBoundingClientRect().top);
        (rows[lt] ||= []).push(Math.round(el.getBoundingClientRect().top)); }
      const cv = document.createElement("canvas").getContext("2d"), cs = getComputedStyle(sel); cv.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const room = sel.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 16; // 16: pijltje
      return { rows: Object.values(rows), scheef: Object.values(rows).some((r) => Math.max(...r) - Math.min(...r) > 1), cut: Math.round(cv.measureText(sel.options[sel.selectedIndex].text).width - room) }; });
    if (f.scheef || f.cut > 0) throw new Error("+ Speler-formulier scheef of afgekapt: " + JSON.stringify(f));
    await snap(page, "wp39", "speler");
    const lang = await page.evaluate(() => document.documentElement.lang);
    await page.goto(base + pathFor(lang, "/")); await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
    const dot = await page.evaluate(() => { const li = [...document.querySelectorAll("footer .facts li")];
      return li.slice(1).filter((x, i) => Math.round(x.getBoundingClientRect().top) !== Math.round(li[i].getBoundingClientRect().top) && getComputedStyle(x, "::before").content !== "none").length; });
    if (dot) throw new Error("homepage-voet: regel begint met ·");
    await snap(page, "wp39", "home");
  },
  // WP56 (G4, Inn the Grid): /maps/ los van Initiative. Canvas op apparaatgrootte, kaart 20×15 passend in beeld, één vinger
  // pant, knijpen zoomt rond het midden van de vingers, wiel zoomt rond de cursor, grenzen 25 %–400 % (knoppen uit),
  // Passend maken herstelt, geen pagina-scroll. Gebaren als echte PointerEvents op het canvas (touch).
  async maps(page) {
    await page.waitForFunction(() => window.__maps && document.getElementById("m-zoom").textContent);
    const st = () => page.evaluate(() => ({ ...window.__maps.view(), ...window.__maps.size() }));
    const s0 = await st();
    const geo = await page.evaluate(() => { const c = document.getElementById("m-canvas"), r = c.getBoundingClientRect(); return { cw: c.width, ch: c.height, w: r.width, h: r.height, left: r.left, top: r.top }; });
    if (Math.abs(geo.cw - Math.round(geo.w * s0.dpr)) > 1 || Math.abs(geo.ch - Math.round(geo.h * s0.dpr)) > 1) throw new Error("canvas niet op apparaatgrootte: " + JSON.stringify(geo));
    const CELL = 48, mapW = 20 * CELL * s0.z, mapH = 15 * CELL * s0.z;
    if (s0.x < 15 || s0.y < 15 || s0.x + mapW > s0.w - 15 || s0.y + mapH > s0.h - 15) throw new Error("kaart niet passend: " + JSON.stringify(s0));
    const touch = (steps) => page.evaluate(({ steps, left, top }) => {
      const c = document.getElementById("m-canvas");
      for (const [type, id, x, y] of steps) c.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: "touch", isPrimary: id === 1, clientX: left + x, clientY: top + y, bubbles: true, cancelable: true, button: 0, buttons: type === "pointerup" ? 0 : 1 }));
    }, { steps, left: geo.left, top: geo.top });
    // één vinger: pannen
    await touch([["pointerdown", 1, 100, 100], ["pointermove", 1, 130, 90], ["pointermove", 1, 160, 80], ["pointerup", 1, 160, 80]]);
    await page.waitForTimeout(50);
    const s1 = await st();
    if (Math.abs(s1.x - s0.x - 60) > 0.5 || Math.abs(s1.y - s0.y + 20) > 0.5 || s1.z !== s0.z) throw new Error("pannen: " + JSON.stringify([s0, s1]));
    // knijpen: afstand 80 → 160 = ×2
    await touch([["pointerdown", 1, 100, 150], ["pointerdown", 2, 180, 150], ["pointermove", 2, 260, 150], ["pointerup", 2, 260, 150], ["pointerup", 1, 100, 150]]);
    await page.waitForTimeout(50);
    const s2 = await st();
    if (Math.abs(s2.z / s1.z - 2) > 0.01) throw new Error("knijpen: " + JSON.stringify([s1, s2]));
    // wiel: inzoomen rond de cursor, kaartpunt onder de cursor blijft
    await tap(page, "#m-zoom"); await page.waitForTimeout(50);
    const s3 = await st(), px = 120, py = 140, mx = (px - s3.x) / (CELL * s3.z);
    await page.mouse.move(geo.left + px, geo.top + py); await page.mouse.wheel(0, -200); await page.waitForTimeout(80);
    const s4 = await st(), mx2 = (px - s4.x) / (CELL * s4.z);
    if (!(s4.z > s3.z) || Math.abs(mx2 - mx) > 1e-6) throw new Error("wiel: " + JSON.stringify([s3, s4]));
    // grenzen: + tot 400 % (knop uit), − tot 25 % (knop uit)
    const until = (id) => page.evaluate(async (id) => { // klikken tot de knop uitgaat (de stand volgt een frame later)
      const b = document.getElementById(id), frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      for (let i = 0; i < 30 && !b.disabled; i++) { b.click(); await frame(); }
      return b.disabled;
    }, id);
    if (!(await until("m-in")) || (await st()).z !== 4 || !/400/.test(await page.locator("#m-zoom").textContent())) throw new Error("max 400 %: " + JSON.stringify(await st()));
    if (!(await until("m-out")) || (await st()).z !== 0.25) throw new Error("min 25 %: " + JSON.stringify(await st()));
    await tap(page, "#m-zoom"); await page.waitForTimeout(50);
    const s5 = await st();
    if (Math.abs(s5.z - s0.z) > 1e-9) throw new Error("Passend maken herstelt niet");
    const sc = await page.evaluate(() => ({ y: scrollY, sh: document.documentElement.scrollHeight, ih: innerHeight, ta: getComputedStyle(document.getElementById("m-canvas")).touchAction, lbl: document.getElementById("m-canvas").getAttribute("aria-label"), ver: document.getElementById("m-ver").textContent }));
    if (sc.y !== 0 || sc.sh > sc.ih || sc.ta !== "none") throw new Error("pagina scrolt of touch-action: " + JSON.stringify(sc));
    if (!/20/.test(sc.lbl || "") || !/^\d+\.\d+\.\d+$/.test(sc.ver)) throw new Error("label/versie: " + JSON.stringify(sc));
  },
  // WP57 (G4): paneel Kaart. Opent zonder dim (kaart blijft zichtbaar), velden ≥ 16 px; type wisselen behoudt kolommen/rijen;
  // 0, 101, leeg en tekst geweigerd met foutregel (raster ongewijzigd); geldig = direct; raster uit = binnen de kaart één
  // kleur (alleen de rand); Esc sluit en zet de focus terug. --shots=wp57: vierkant, hex punt, hex plat.
  async wp57(page) {
    await page.waitForFunction(() => window.__maps && document.getElementById("m-zoom").textContent);
    const grid = () => page.evaluate(() => window.__maps.grid());
    const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await tap(page, "#m-set");
    await page.locator("#m-sheet").waitFor({ state: "visible" });
    const sh = await page.evaluate(() => { const s = document.getElementById("m-sheet").getBoundingClientRect(); return { top: s.top, ih: innerHeight, fs: parseFloat(getComputedStyle(document.getElementById("m-cols")).fontSize), dim: !!document.querySelector("#m-sheet ~ .dim, .sheet-wrap:not([hidden])"), exp: document.getElementById("m-set").getAttribute("aria-expanded"), cols: document.getElementById("m-cols").value } ; });
    if (sh.fs < 16 || sh.dim || sh.exp !== "true" || sh.cols !== "20") throw new Error("paneel: " + JSON.stringify(sh));
    await frame();
    const fitTop = await page.evaluate(() => { const v = window.__maps.view(), st = document.getElementById("m-stage").getBoundingClientRect(); return { bot: st.top + v.y + 15 * 48 * v.z, sheet: document.getElementById("m-sheet").getBoundingClientRect().top, top: st.top + v.y }; });
    if (fitTop.bot > fitTop.sheet + 0.5 || fitTop.top < 0) throw new Error("kaart niet passend boven het paneel: " + JSON.stringify(fitTop));
    await snap(page, "wp57", "vierkant");
    await tap(page, '#m-type [data-v="pointy"]'); await frame();
    let g = await grid();
    if (g.type !== "hex" || g.orient !== "pointy" || g.cols !== 20 || g.rows !== 15) throw new Error("hex punt: " + JSON.stringify(g));
    await snap(page, "wp57", "hexpunt");
    await tap(page, '#m-type [data-v="flat"]'); await frame();
    g = await grid();
    if (g.orient !== "flat" || g.cols !== 20 || g.rows !== 15) throw new Error("hex plat: " + JSON.stringify(g));
    await snap(page, "wp57", "hexplat");
    for (const bad of ["0", "101", "", "abc"]) {
      await page.locator("#m-cols").fill(bad); await page.locator("#m-cols").press("Enter"); await frame();
      const st = await page.evaluate(() => ({ inv: document.getElementById("m-cols").getAttribute("aria-invalid"), err: !document.getElementById("m-cols-e").hidden && document.getElementById("m-cols-e").textContent, cols: window.__maps.grid().cols }));
      if (st.inv !== "true" || !st.err || st.cols !== 20) throw new Error(`ongeldig "${bad}": ` + JSON.stringify(st));
    }
    await page.locator("#m-cols").fill("30"); await page.locator("#m-cols").press("Enter");
    await page.locator("#m-rows").fill("8"); await page.locator("#m-rows").press("Enter"); await frame();
    g = await grid();
    if (g.cols !== 30 || g.rows !== 8 || (await page.locator("#m-cols-e").isVisible())) throw new Error("geldig: " + JSON.stringify(g));
    await tap(page, '#m-type [data-v="square"]'); await tap(page, '#m-show [data-v="off"]'); await frame();
    g = await grid();
    if (g.show || g.type !== "square" || g.cols !== 30 || !(await page.locator('#m-color [data-v="gold"]').isDisabled())) throw new Error("raster uit: " + JSON.stringify(g));
    // binnen de kaart (zonder de rand) maar één kleur: geen rasterlijnen; vierkant én hex
    const oneColor = () => page.evaluate(() => {
      const c = document.getElementById("m-canvas"), v = window.__maps.view(), d = window.__maps.size().dpr, s = 48 * v.z * d;
      const x0 = Math.ceil(v.x * d + 6), y0 = Math.ceil(v.y * d + 6), x1 = Math.floor(v.x * d + 26 * s), y1 = Math.floor(v.y * d + 6 * s);
      const X0 = Math.max(0, x0), Y0 = Math.max(0, y0), W = Math.min(c.width, x1) - X0, H = Math.min(c.height, y1) - Y0;
      if (W < 20 || H < 20) return "te klein " + [W, H];
      const px = c.getContext("2d").getImageData(X0, Y0, W, H).data, set = new Set();
      for (let i = 0; i < px.length; i += 4) set.add(px[i] + "," + px[i + 1] + "," + px[i + 2]);
      return set.size;
    });
    let one = await oneColor();
    if (one !== 1) throw new Error("raster uit (vierkant): kleuren binnen de kaart = " + one);
    await tap(page, '#m-type [data-v="pointy"]'); await frame();
    one = await oneColor();
    if (one !== 1) throw new Error("raster uit (hex): kleuren binnen de kaart = " + one);
    const tabs = await page.evaluate(() => [...document.querySelectorAll("#m-dock button")].every((b) => b.getAttribute("tabindex") === "-1"));
    if (!tabs) throw new Error("dockknoppen bereikbaar met Tab onder het open paneel");
    await page.keyboard.press("Escape"); await frame();
    const cl = await page.evaluate(() => ({ hid: document.getElementById("m-sheet").hidden, foc: document.activeElement?.id, exp: document.getElementById("m-set").getAttribute("aria-expanded") }));
    if (!cl.hid || cl.foc !== "m-set" || cl.exp !== "false" || await page.evaluate(() => !!document.querySelector("#m-dock button[tabindex]"))) throw new Error("sluiten: " + JSON.stringify(cl));
  },
  // WP58 (G4): kaarten bewaren. Eerste start maakt kaart 1 en bewaart hem; wijziging → "Opgeslagen" binnen 1 s (in
  // IndexedDB, mapsIdb); herladen direct na een wijziging verliest niets (pagehide); opslaan dat faalt (put gooit) toont
  // "Niet opgeslagen" en blijft dat tonen tot Opnieuw lukt; Mijn kaarten: nieuw, hernoemen, dupliceren, verwijderen +
  // Ongedaan (zelfde id), terug = editor; laatste kaart heropent; tweede tabblad neemt over (stopscherm), Initiative in
  // een ander tabblad blijft werken. --shots=wp58: lijst, menu, fout.
  async wp58(page, base) {
    const ready = () => page.waitForFunction(() => window.__maps && window.__maps.map() && document.getElementById("m-zoom").textContent);
    await ready();
    const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const M = () => page.evaluate(() => ({ map: window.__maps.map(), st: window.__maps.status(), v: window.__maps.view$(), txt: document.getElementById("m-stat").textContent, name: document.getElementById("m-name").textContent }));
    let m = await M();
    const id1 = m.map.id;
    await mapsIdb(page, (all) => all.length === 1 && all[0].id === id1);
    if (m.st !== "saved" || !m.txt || m.name !== m.map.name) throw new Error("eerste start: " + JSON.stringify(m));
    // (1) wijziging → binnen 1 s Opgeslagen, en echt in IndexedDB
    await tap(page, "#m-set"); await page.locator("#m-sheet").waitFor({ state: "visible" });
    const t0 = Date.now();
    await tap(page, '#m-type [data-v="pointy"]');
    if ((await M()).st === "saved") throw new Error("status bleef Opgeslagen na een wijziging");
    await page.waitForFunction(() => window.__maps.status() === "saved", null, { timeout: 1000 });
    await mapsIdb(page, (all) => all[0]?.grid.type === "hex", 1000 - (Date.now() - t0) + 200);
    // (2) naam wijzigen en direct herladen: pagehide bewaart
    await page.locator("#m-mname").fill("Hinderlaag bij de oude brug"); await page.locator("#m-mname").press("Enter");
    if ((await M()).name !== "Hinderlaag bij de oude brug") throw new Error("kop volgt de naam niet");
    await page.locator("#m-cols").fill("33"); await page.locator("#m-cols").press("Enter");
    await page.reload(); await ready();
    m = await M();
    if (m.map.id !== id1 || m.map.grid.cols !== 33 || m.map.name !== "Hinderlaag bij de oude brug" || m.map.grid.type !== "hex") throw new Error("herladen direct na wijziging: " + JSON.stringify(m.map));
    // (3) opslaan faalt → Niet opgeslagen, blijft staan (ook bij een volgende wijziging), Opnieuw herstelt
    await page.evaluate(() => { window.__put = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function () { throw new DOMException("quota", "QuotaExceededError"); }; });
    await tap(page, "#m-set"); await tap(page, '#m-type [data-v="square"]');
    await page.waitForFunction(() => window.__maps.status() === "error", null, { timeout: 2000 });
    await tap(page, '#m-show [data-v="off"]');
    await page.waitForTimeout(700);
    m = await M();
    const red = await page.evaluate(() => { const s = document.getElementById("m-stat"); return s.classList.contains("bad") && !!s.querySelector("button") && s.querySelector("button").getBoundingClientRect().height >= 44; });
    if (m.st !== "error" || !red) throw new Error("foutstatus: " + JSON.stringify({ m, red }));
    await page.keyboard.press("Escape");
    await tap(page, "#m-stat button");
    await page.locator("#m-toast .tmsg.bad .tundo").waitFor();
    await snap(page, "wp58", "fout");
    await page.evaluate(() => { IDBObjectStore.prototype.put = window.__put; });
    await tap(page, "#m-toast .tundo");
    await page.waitForFunction(() => window.__maps.status() === "saved", null, { timeout: 2000 });
    await mapsIdb(page, (all) => all[0]?.grid.type === "square" && all[0].grid.show === false);
    // Mijn kaarten: lijst, nieuw, terug (history), hernoemen, dupliceren, verwijderen + Ongedaan
    await tap(page, "#m-maps");
    await page.locator("#m-list").waitFor({ state: "visible" }); await page.waitForTimeout(100);
    if ((await page.locator("#m-lrows .mkl-row").count()) !== 1 || !(await page.locator("#m-lrows .mkl-c").count())) throw new Error("lijst met de open kaart");
    await tap(page, "#m-new");
    await page.waitForFunction((id) => window.__maps.view$() === "edit" && window.__maps.map().id !== id, id1);
    const id2 = (await M()).map.id;
    await mapsIdb(page, (all) => all.length === 2);
    await tap(page, "#m-maps"); await page.locator("#m-list").waitFor({ state: "visible" });
    await page.goBack(); // Android-terugknop: editor
    await page.waitForFunction(() => window.__maps.view$() === "edit");
    if ((await M()).map.id !== id2) throw new Error("terug: andere kaart");
    await tap(page, "#m-maps"); await page.locator("#m-list").waitFor({ state: "visible" });
    const order = await page.evaluate(() => [...document.querySelectorAll("#m-lrows .mkl-o")].map((b) => b.dataset.id));
    if (order[0] !== id2 || order[1] !== id1) throw new Error("volgorde: " + order);
    await snap(page, "wp58", "lijst");
    await tap(page, `#m-lrows .mkl-m[data-id="${id1}"]`);
    await page.locator("#m-menu").waitFor({ state: "visible" });
    await snap(page, "wp58", "menu");
    await tap(page, '#m-menu [data-m="rename"]');
    await page.locator("#m-rn").fill("   "); await tap(page, "#m-menu .mrename .btn");
    if (!(await page.locator("#m-rn-e").isVisible())) throw new Error("lege naam niet geweigerd");
    await page.locator("#m-rn").fill("Zonder Level"); await tap(page, "#m-menu .mrename .btn");
    await page.locator("#m-menu").waitFor({ state: "hidden" });
    await mapsIdb(page, (all) => all.some((x) => x.id === id1 && x.name === "Zonder Level"));
    await tap(page, `#m-lrows .mkl-m[data-id="${id1}"]`); await tap(page, '#m-menu [data-m="dup"]');
    await mapsIdb(page, (all) => all.length === 3);
    await page.waitForFunction(() => document.querySelectorAll("#m-lrows .mkl-row").length === 3 && document.activeElement?.classList.contains("mkl-o"));
    const dup = await page.evaluate(() => { const b = document.querySelector("#m-lrows .mkl-o"); return { txt: b?.querySelector(".mkl-n")?.textContent, foc: document.activeElement === b }; });
    if (!/Zonder Level \S/.test(dup.txt || "") || !dup.foc) throw new Error("dupliceren: kopie bovenaan met focus: " + JSON.stringify(dup));
    // review: de open kaart (id2) hernoemen via het menu wordt echt bewaard
    await tap(page, `#m-lrows .mkl-m[data-id="${id2}"]`); await tap(page, '#m-menu [data-m="rename"]');
    await page.locator("#m-rn").fill("Aurelianus Vandermeer"); await tap(page, "#m-menu .mrename .btn");
    await mapsIdb(page, (all) => all.some((x) => x.id === id2 && x.name === "Aurelianus Vandermeer"));
    // review: opslaan faalt en dan een andere kaart openen → wissel geweigerd, status blijft rood, niets weg
    await tap(page, `#m-lrows .mkl-o[data-id="${id2}"]`);
    await page.waitForFunction(() => window.__maps.view$() === "edit");
    await page.evaluate(() => { IDBObjectStore.prototype.put = function () { throw new DOMException("quota", "QuotaExceededError"); }; });
    await tap(page, "#m-set"); await tap(page, '#m-type [data-v="flat"]'); await page.keyboard.press("Escape");
    await page.waitForFunction(() => window.__maps.status() === "error", null, { timeout: 2000 });
    await tap(page, "#m-maps"); await page.locator("#m-list").waitFor({ state: "visible" }); await page.waitForTimeout(100);
    await tap(page, `#m-lrows .mkl-o[data-id="${id1}"]`); await page.waitForTimeout(200);
    m = await M();
    if (m.map.id !== id2 || m.st !== "error" || m.v !== "list" || !(await page.locator("#m-toast .tmsg.bad .tundo").count())) throw new Error("wissel na mislukte opslag: " + JSON.stringify({ id: m.map.id, st: m.st, v: m.v }));
    await page.evaluate(() => { IDBObjectStore.prototype.put = window.__put; });
    await tap(page, "#m-toast .tundo");
    await mapsIdb(page, (all) => all.some((x) => x.id === id2 && x.grid.orient === "flat"));
    // verwijder de open kaart (id2) → in de lijst blijven; Ongedaan zet hem terug met dezelfde id
    await tap(page, `#m-lrows .mkl-m[data-id="${id2}"]`); await tap(page, '#m-menu [data-m="del"]');
    await mapsIdb(page, (all) => all.length === 2 && !all.some((x) => x.id === id2));
    if ((await M()).v !== "list" || (await M()).map !== null) throw new Error("na verwijderen van de open kaart");
    await tap(page, "#m-toast .tundo");
    await mapsIdb(page, (all) => all.length === 3 && all.some((x) => x.id === id2));
    await page.waitForFunction((id) => !!document.querySelector(`#m-lrows .mkl-o[data-id="${id}"]`), id2, { timeout: 2000 }).catch(() => {});
    if (!(await page.locator(`#m-lrows .mkl-o[data-id="${id2}"]`).count())) throw new Error("Ongedaan: niet terug in de lijst");
    await tap(page, `#m-lrows .mkl-o[data-id="${id1}"]`);
    await page.waitForFunction((id) => window.__maps.view$() === "edit" && window.__maps.map().id === id, id1);
    // laatste kaart heropent na herladen
    await page.reload(); await ready();
    if ((await M()).map.id !== id1) throw new Error("laatste kaart niet heropend");
    // (4) tweede tabblad neemt over; Initiative in een ander tabblad blijft werken
    const ctx = page.context(), p2 = await ctx.newPage(), p3 = await ctx.newPage();
    await p2.goto(base + "/nl/maps/"); await p2.waitForFunction(() => window.__maps && window.__maps.map());
    await page.locator(".tabstop").waitFor({ timeout: 3000 });
    await p3.goto(base + "/nl/initiative/"); await p3.waitForSelector("#dock");
    await p3.waitForTimeout(300);
    const st = { p1: await page.locator(".tabstop").count(), p2: await p2.locator(".tabstop").count(), p3: await p3.locator(".tabstop").count(), foc: await page.evaluate(() => document.activeElement?.closest(".tabstop") !== null) };
    if (st.p1 !== 1 || st.p2 !== 0 || st.p3 !== 0 || !st.foc) throw new Error("tabbladen: " + JSON.stringify(st));
    if ((await p2.evaluate(() => window.__maps.map().id)) !== id1) throw new Error("tweede tabblad: niet de laatste kaart");
    await p2.close(); await p3.close();
  },
  // WP58 (G4): privémodus zonder IndexedDB. Duidelijke melding (strook + rode status "wordt niet bewaard"), editor werkt.
  async wp58priv(page) {
    await page.waitForFunction(() => window.__maps && window.__maps.map());
    const st = await page.evaluate(() => ({ s: window.__maps.status(), bad: document.getElementById("m-stat").classList.contains("bad"), toast: document.querySelector("#m-toast .tmsg.bad")?.textContent || "" }));
    if (st.s !== "off" || !st.bad || st.toast.length < 20) throw new Error("privémodus: " + JSON.stringify(st));
    await tap(page, "#m-set"); await tap(page, '#m-type [data-v="flat"]');
    if ((await page.evaluate(() => window.__maps.grid().orient)) !== "flat") throw new Error("editor werkt niet zonder opslag");
    await page.keyboard.press("Escape");
    await tap(page, "#m-maps"); await page.locator("#m-list").waitFor({ state: "visible" });
    if (!(await page.locator("#m-l-off").isVisible()) || (await page.locator("#m-lrows .mkl-row").count()) !== 1) throw new Error("lijst in privémodus");
    await tap(page, "#m-new");
    await page.waitForFunction(() => window.__maps.view$() === "edit");
    await tap(page, "#m-maps"); await page.locator("#m-list").waitFor({ state: "visible" });
    if ((await page.locator("#m-lrows .mkl-row").count()) !== 2) throw new Error("nieuwe kaart in privémodus");
    // review: verwijderen, naar de editor, Ongedaan → precies één keer terug in de lijst
    const gone = await page.evaluate(() => document.querySelectorAll("#m-lrows .mkl-m")[1].dataset.id);
    await tap(page, `#m-lrows .mkl-m[data-id="${gone}"]`); await tap(page, '#m-menu [data-m="del"]');
    await tap(page, "#m-back"); await page.waitForFunction(() => window.__maps.view$() === "edit");
    await tap(page, "#m-toast .tundo");
    await tap(page, "#m-maps"); await page.locator("#m-list").waitFor({ state: "visible" });
    const ids = await page.evaluate(() => [...document.querySelectorAll("#m-lrows .mkl-o")].map((b) => b.dataset.id));
    if (ids.length !== 2 || ids.filter((x) => x === gone).length !== 1) throw new Error("Ongedaan vanuit de editor: " + ids);
    // WP59-review: achtergrond zonder IndexedDB (assets in het geheugen), ook in een gedupliceerde kaart
    await tap(page, `#m-lrows .mkl-o[data-id="${ids[0]}"]`); await page.waitForFunction(() => window.__maps.view$() === "edit");
    await tap(page, "#m-set"); await page.locator("#m-sheet").waitFor({ state: "visible" });
    const [fc] = await Promise.all([page.waitForEvent("filechooser"), tap(page, "#m-bg-pick")]);
    await fc.setFiles({ name: "grot.png", mimeType: "image/png", buffer: await fixture(page, 700, 490, 70) });
    await page.waitForFunction(() => window.__maps.bg().state === "set" && window.__maps.bg().img, null, { timeout: 10000 });
    await page.keyboard.press("Escape");
    const cur = await page.evaluate(() => window.__maps.map().id);
    await tap(page, "#m-maps"); await page.locator("#m-list").waitFor({ state: "visible" });
    await tap(page, `#m-lrows .mkl-m[data-id="${cur}"]`); await tap(page, '#m-menu [data-m="dup"]');
    await page.waitForFunction(() => document.querySelectorAll("#m-lrows .mkl-row").length === 3);
    await tap(page, "#m-lrows .mkl-o"); await page.waitForFunction((id) => window.__maps.view$() === "edit" && window.__maps.map().id !== id, cur);
    await page.waitForFunction(() => window.__maps.bg().img, null, { timeout: 5000 }).catch(() => {});
    if (!(await page.evaluate(() => window.__maps.bg().img))) throw new Error("privémodus: achtergrond in de kopie ontbreekt");
    // WP60: importeren zonder IndexedDB (kaart en asset in het geheugen)
    await tap(page, "#m-maps"); await page.locator("#m-list").waitFor({ state: "visible" });
    const [fi] = await Promise.all([page.waitForEvent("filechooser"), tap(page, "#m-imp")]);
    await fi.setFiles(join(ROOT, "tests/fixtures/maps/valid.json"));
    await page.waitForFunction(() => document.querySelectorAll("#m-lrows .mkl-row").length === 4, null, { timeout: 5000 });
    await tap(page, "#m-lrows .mkl-o"); // bovenaan = de import
    await page.waitForFunction(() => window.__maps.view$() === "edit" && window.__maps.map().name === "Test fixture" && window.__maps.bg().img, null, { timeout: 5000 });
  },
  // WP59 (G4): achtergrondafbeelding. Kiezen via de echte knop (bestandskiezer); GIF, SVG, HEIC, hernoemd tekstbestand en
  // > 25 MB geven elk een melding (acceptatie 1); testkaart 30×20 à 70 px: startschatting 70 px/cel, Raster passend
  // 30 × 20 in één tik (3); in IndexedDB schema 2 + één asset, zelfde afbeelding = één asset (5); uitlijnmodus: pijl = 3
  // bronpixels, slepen schuift, Gereed = paneel; velden gekoppeld; herladen = precies gelijk (4); verwijderen + Ongedaan;
  // groot bestand → opgeslagen ≤ 4096 px, WebP, geen EXIF (2); ongebruikte asset weg na herladen; ontbrekende asset →
  // Opnieuw kiezen houdt schaal en verschuiving. --shots=wp59: paneel, uitlijnen.
  async wp59(page, base) {
    const ready = () => page.waitForFunction(() => window.__maps && window.__maps.map() && document.getElementById("m-zoom").textContent);
    await ready();
    // review: upgrade van een bestaande v1-database (WP58) naar v2: kaart blijft, index "src" komt erbij
    const here = page.url();
    await page.goto(base + "/nl/404.html");
    await page.evaluate(() => new Promise((res, rej) => {
      const d = indexedDB.deleteDatabase("kevs-inn-maps");
      d.onsuccess = d.onerror = d.onblocked = () => {
        const r = indexedDB.open("kevs-inn-maps", 1);
        r.onupgradeneeded = () => { r.result.createObjectStore("maps", { keyPath: "id" }); r.result.createObjectStore("assets"); };
        r.onsuccess = () => {
          const t = r.result.transaction("maps", "readwrite");
          t.objectStore("maps").put({ id: "upgrade01", schema: 1, name: "Zonder Level", createdAt: 1, updatedAt: Date.now(), grid: { type: "square", cols: 20, rows: 15 } });
          t.oncomplete = () => { r.result.close(); localStorage.setItem("maps-last", "upgrade01"); res(); };
        };
        r.onerror = () => rej(r.error);
      };
    }));
    await page.goto(here); await ready();
    const up = await page.evaluate(() => new Promise((res) => { const r = indexedDB.open("kevs-inn-maps"); r.onsuccess = () => { const db = r.result; res({ v: db.version, idx: [...db.transaction("assets").objectStore("assets").indexNames], id: window.__maps.map().id }); db.close(); }; }));
    if (up.v !== 3 || !up.idx.includes("src") || up.id !== "upgrade01") throw new Error("upgrade v1 → v3: " + JSON.stringify(up)); // WP64: versie 3 (store "mine")
    const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const B = () => page.evaluate(() => ({ ...window.__maps.bg(), bg: window.__maps.map().bg || null, grid: window.__maps.grid() }));
    const choose = async (sel, file) => {
      const [fc] = await Promise.all([page.waitForEvent("filechooser"), tap(page, sel)]);
      await fc.setFiles(file);
    };
    await tap(page, "#m-set"); await page.locator("#m-sheet").waitFor({ state: "visible" });
    if (!(await page.locator("#m-bg-pick").isVisible()) || !(await page.locator("#m-bg-hint").textContent()).includes("25")) throw new Error("geen afbeelding: kiesknop + hint");
    const bad = [
      ["kaart.gif", "image/gif", Buffer.from("GIF89a\x01\x00\x01\x00\x00\x00\x00;", "latin1")],
      ["kaart.svg", "image/svg+xml", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')],
      ["IMG_0001.HEIC", "image/heic", Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypheic"), Buffer.alloc(40)])],
      ["kaart.png", "image/png", Buffer.from("Dit is eigenlijk tekst, hernoemd naar .png")],
      ["groot.png", "image/png", Buffer.alloc(25 * 1024 * 1024 + 1)],
    ];
    const msgs = new Set();
    for (const [name, mimeType, buffer] of bad) {
      await choose("#m-bg-pick", { name, mimeType, buffer });
      await page.waitForFunction(() => !document.getElementById("m-bg-e").hidden && !document.getElementById("m-bg-pick").disabled, null, { timeout: 5000 });
      const st = await page.evaluate(() => ({ e: document.getElementById("m-bg-e").textContent, s: window.__maps.bg().state }));
      if (st.s !== "none" || st.e.length < 10 || st.e.includes("⟦")) throw new Error(`${name}: ` + JSON.stringify(st));
      msgs.add(st.e);
    }
    if (msgs.size !== bad.length) throw new Error("meldingen niet per soort verschillend: " + [...msgs].join(" | "));
    // testkaart 30×20 vakken à 70 px
    const map30 = await fixture(page, 2100, 1400, 70);
    const t0 = Date.now();
    await choose("#m-bg-pick", { name: "grot.png", mimeType: "image/png", buffer: map30 });
    await page.waitForFunction(() => window.__maps.bg().state === "set" && window.__maps.bg().img, null, { timeout: 10000 });
    let b = await B();
    if (b.bg.ppc !== 70 || b.bg.x !== 0 || b.bg.w !== 2100 || (await page.locator("#m-bg-e").isVisible())) throw new Error("startschatting: " + JSON.stringify(b));
    if (!(await page.locator("#m-bg-fit").textContent()).includes("30×20")) throw new Error("knop Raster passend: " + await page.locator("#m-bg-fit").textContent());
    if ((await page.evaluate(() => document.activeElement?.id)) !== "m-bg-align") throw new Error("focus na kiezen niet op Uitlijnen");
    await tap(page, "#m-bg-fit"); await frame();
    b = await B();
    if (b.grid.cols !== 30 || b.grid.rows !== 20 || await page.locator("#m-bg-fit").isVisible()) throw new Error("raster passend: " + JSON.stringify(b.grid));
    if (Date.now() - t0 > 60000) throw new Error("uitlijnen duurde > 1 minuut");
    // het raster ligt precies op de getekende lijnen: pixel net naast een rasterlijn = achtergrond (geen dim), rode hoekcel
    await snap(page, "wp59", "paneel");
    const ids = await mapsIdb(page, (all) => all[0]?.schema === 2 && all[0].bg?.asset && all[0].grid.cols === 30);
    let as = await mapsAssets(page);
    if (as.length !== 1 || as[0].key !== ids[0].bg.asset) throw new Error("asset: " + JSON.stringify(as));
    // zelfde afbeelding via Vervangen = één asset; melding met Ongedaan
    await choose("#m-bg-rep", { name: "grot-kopie.png", mimeType: "image/png", buffer: map30 });
    await page.locator("#m-toast .tundo").waitFor();
    as = await mapsAssets(page);
    if (as.length !== 1) throw new Error("zelfde afbeelding twee keer ≠ één asset: " + as.length);
    // velden gekoppeld: 35 px per cel → 60 cellen; 30 cellen → 70 px
    await page.locator("#m-ppc").fill("35"); await page.locator("#m-ppc").press("Enter");
    if ((await page.locator("#m-across").inputValue()) !== "60") throw new Error("cellen volgt ppc niet: " + await page.locator("#m-across").inputValue());
    await page.locator("#m-across").fill("30"); await page.locator("#m-across").press("Enter");
    if ((await page.locator("#m-ppc").inputValue()) !== "70" || (await B()).bg.ppc !== 70) throw new Error("ppc volgt cellen niet");
    await page.locator("#m-ppc").fill("2"); await page.locator("#m-ppc").press("Enter");
    if (!(await page.locator("#m-ppc-e").isVisible()) || (await B()).bg.ppc !== 70) throw new Error("ppc 2 niet geweigerd");
    await page.locator("#m-ppc").fill("70"); await page.locator("#m-ppc").press("Enter");
    // uitlijnmodus
    await tap(page, "#m-bg-align");
    await page.locator("#m-adock").waitFor({ state: "visible" });
    const am = await page.evaluate(() => ({ sheet: document.getElementById("m-sheet").hidden, dock: document.getElementById("m-dock").hidden, strip: !document.getElementById("m-astrip").hidden, align: window.__maps.bg().align, foc: document.activeElement?.id }));
    if (!am.sheet || !am.dock || !am.strip || !am.align || am.foc !== "m-adone") throw new Error("uitlijnmodus: " + JSON.stringify(am));
    const z = (await page.evaluate(() => window.__maps.view())).z;
    const step = Math.max(1, Math.round((2 / (48 * z)) * 70)) / 70;
    await tap(page, '#m-adock [data-nudge="right"]'); await tap(page, '#m-adock [data-nudge="down"]');
    b = await B();
    if (Math.abs(b.bg.x - step) > 1e-3 || Math.abs(b.bg.y - step) > 1e-3) throw new Error(`pijlen: ${b.bg.x},${b.bg.y} ≠ ${step}`);
    const st = await page.locator("#m-stage").boundingBox(), cx = st.x + st.width / 2, cy = st.y + st.height / 2;
    const v0 = await page.evaluate(() => window.__maps.view());
    await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 24, cy, { steps: 4 }); await page.mouse.move(cx + 48 * z, cy, { steps: 4 }); await page.mouse.up();
    b = await B();
    const v1 = await page.evaluate(() => window.__maps.view());
    if (Math.abs(b.bg.x - step - 1) > 0.02 || v1.x !== v0.x) throw new Error("slepen schuift de afbeelding niet (of pant): " + JSON.stringify({ x: b.bg.x, v0, v1 }));
    await snap(page, "wp59", "uitlijnen");
    await page.keyboard.press("ArrowLeft");
    if (Math.abs((await B()).bg.x - 1) > 0.02) throw new Error("pijltjestoets");
    await tap(page, "#m-adone");
    await page.locator("#m-sheet").waitFor({ state: "visible" });
    if ((await page.evaluate(() => document.activeElement?.id)) !== "m-bg-align" || !(await page.locator("#m-dock").isVisible())) throw new Error("Gereed: terug naar paneel");
    // herladen: alles precies gelijk (acceptatie 4)
    const before = (await B()).bg;
    await page.waitForFunction(() => window.__maps.status() === "saved", null, { timeout: 3000 });
    await page.reload(); await ready();
    await page.waitForFunction(() => window.__maps.bg().img, null, { timeout: 5000 });
    b = await B();
    if (JSON.stringify(b.bg) !== JSON.stringify(before) || b.grid.cols !== 30) throw new Error("na herladen: " + JSON.stringify({ before, after: b.bg }));
    // verwijderen + Ongedaan
    await tap(page, "#m-set"); await page.locator("#m-sheet").waitFor({ state: "visible" });
    await tap(page, "#m-bg-del");
    if ((await B()).state !== "none" || (await page.evaluate(() => document.activeElement?.id)) !== "m-bg-pick") throw new Error("verwijderen");
    await tap(page, "#m-toast .tundo");
    await page.waitForFunction(() => window.__maps.bg().state === "set" && window.__maps.bg().img);
    if (JSON.stringify((await B()).bg) !== JSON.stringify(before)) throw new Error("Ongedaan na verwijderen");
    // groot bestand → ≤ 4096 px, WebP, geen EXIF (acceptatie 2); oude asset weg na herladen
    const big = await fixture(page, 5000, 1000, 100, "image/jpeg");
    await choose("#m-bg-rep", { name: "groot.jpg", mimeType: "image/jpeg", buffer: big });
    await page.waitForFunction(() => window.__maps.map().bg?.w === 5000 && window.__maps.bg().img, null, { timeout: 15000 });
    b = await B();
    if (b.bg.ppc !== 100) throw new Error("startschatting groot: " + b.bg.ppc);
    as = await mapsAssets(page);
    const nw = as.find((a) => a.key === b.bg.asset);
    if (!nw || nw.w !== 4096 || nw.h !== 819 || nw.ow !== 5000 || nw.mime !== "image/webp" || nw.exif) throw new Error("opgeslagen versie: " + JSON.stringify(nw));
    await page.waitForFunction(() => window.__maps.status() === "saved", null, { timeout: 3000 });
    await page.reload(); await ready();
    await page.waitForFunction(() => window.__maps.bg().img, null, { timeout: 5000 });
    await page.waitForTimeout(200);
    as = await mapsAssets(page);
    if (as.length !== 1 || as[0].key !== b.bg.asset) throw new Error("opruimen: " + JSON.stringify(as.map((a) => a.key.slice(0, 8))));
    // review: dupliceren deelt de asset; het origineel verwijderen laat hem staan (de kopie verwijst ernaar)
    const orig = (await page.evaluate(() => window.__maps.map())).id;
    await tap(page, "#m-maps"); await page.locator("#m-list").waitFor({ state: "visible" });
    await tap(page, `#m-lrows .mkl-m[data-id="${orig}"]`); await tap(page, '#m-menu [data-m="dup"]');
    await mapsIdb(page, (all) => all.length === 2 && all.every((x) => x.bg?.asset === b.bg.asset));
    await tap(page, `#m-lrows .mkl-m[data-id="${orig}"]`); await tap(page, '#m-menu [data-m="del"]');
    await mapsIdb(page, (all) => all.length === 1 && all[0].id !== orig);
    await page.reload(); await ready();
    await page.waitForFunction(() => window.__maps.bg().img, null, { timeout: 5000 });
    await page.waitForTimeout(200);
    as = await mapsAssets(page);
    if (as.length !== 1 || as[0].key !== b.bg.asset) throw new Error("asset van de kopie opgeruimd: " + as.length);
    // ontbrekende asset (opslag gewist): melding, Opnieuw kiezen houdt schaal en verschuiving
    await page.evaluate(() => new Promise((res) => { const r = indexedDB.open("kevs-inn-maps"); r.onsuccess = () => { const t = r.result.transaction("assets", "readwrite"); t.objectStore("assets").clear(); t.oncomplete = () => { r.result.close(); res(); }; }; }));
    await page.reload(); await ready();
    await tap(page, "#m-set"); await page.locator("#m-sheet").waitFor({ state: "visible" });
    await page.waitForFunction(() => window.__maps.bg().state === "missing", null, { timeout: 5000 });
    if (!(await page.locator("#m-bg-miss").isVisible()) || (await page.locator("#m-bg-rep").isVisible()) || !(await page.locator("#m-bg-del").isVisible())) throw new Error("ontbreekt: knoppen");
    await page.evaluate(() => { window.__maps.flush(); });
    const keep = (await B()).bg;
    await choose("#m-bg-pick", { name: "grot.png", mimeType: "image/png", buffer: map30 });
    await page.waitForFunction(() => window.__maps.bg().state === "set" && window.__maps.bg().img, null, { timeout: 10000 });
    b = await B();
    if (b.bg.ppc !== keep.ppc || b.bg.x !== keep.x || b.bg.w !== 2100) throw new Error("opnieuw kiezen: " + JSON.stringify({ keep, now: b.bg }));
    await page.locator("#m-sheet").evaluate((el) => { el.scrollTop = el.scrollHeight; });
  },
  // WP60 (G4): projectbestand. Elk kapot bestand uit tests/fixtures/maps/ (en > 50 MB) via de echte importknop geeft een
  // eigen foutregel en maakt geen kaart (acceptatie 3), ook opslag vol (put faalt); valid.json → nieuwe kaart bovenaan met focus, melding met
  // Ongedaan, asset met de sha uit het bestand (5: nooit overschrijven, tweede import = "Test fixture 2"); Ongedaan haalt
  // hem weg; kwaadaardige naam als tekst; exporteren via het menu (download) → bestand zonder id/URL's → importeren in een
  // ánder browsercontext geeft dezelfde modeldata en een pixelgelijk canvas (1). --shots=wp60: lijst met fout, editor.
  async wp60(page, base) {
    const ready = (p = page) => p.waitForFunction(() => window.__maps && window.__maps.map() && document.getElementById("m-zoom").textContent);
    await ready();
    const FX = join(ROOT, "tests/fixtures/maps");
    const { readdirSync, readFileSync } = await import("node:fs");
    const toList = async (p = page) => { await tap(p, "#m-maps"); await p.locator("#m-list").waitFor({ state: "visible" }); };
    const imp = async (file, p = page) => {
      const [fc] = await Promise.all([p.waitForEvent("filechooser"), tap(p, "#m-imp")]);
      await fc.setFiles(file);
      await p.waitForFunction(() => !document.getElementById("m-imp").disabled && !document.getElementById("m-imp").hasAttribute("aria-busy"), null, { timeout: 10000 });
    };
    const fxFile = (n) => ({ name: n, mimeType: "application/json", buffer: readFileSync(join(FX, n)) });
    await toList();
    if (!(await page.locator("#m-imp").isVisible())) throw new Error("importknop onder de lijst ontbreekt");
    const n0 = (await mapsIdb(page, (all) => all.length >= 1)).length;
    // kapotte bestanden: eigen foutregel per soort, geen nieuwe kaart
    const msgs = new Map();
    const errs = readdirSync(FX).filter((f) => f.startsWith("err-")).map(fxFile);
    const big = join((await import("node:os")).tmpdir(), "inn-the-grid-groot.json"); // > 50 MB: Playwright wil dan een pad
    (await import("node:fs")).writeFileSync(big, Buffer.alloc(35 * 1024 * 1024 + 1, 32)); // FILE_MAX + 1
    errs.push(big);
    for (const f of errs) {
      await imp(f);
      const e = await page.evaluate(() => ({ vis: !document.getElementById("m-imp-e").hidden, t: document.getElementById("m-imp-e").textContent }));
      if (!e.vis || e.t.length < 10 || e.t.includes("⟦")) throw new Error(`${f.name || f}: geen foutregel ` + JSON.stringify(e));
      msgs.set(e.t, f.name || f);
    }
    // opslag vol: put faalt → foutregel "store", geen kaart, knop weer bruikbaar
    await page.evaluate(() => { window.__put = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function () { throw new DOMException("vol", "QuotaExceededError"); }; });
    await imp(fxFile("valid.json"));
    await page.evaluate(() => { IDBObjectStore.prototype.put = window.__put; });
    const se = await page.evaluate(() => ({ vis: !document.getElementById("m-imp-e").hidden, t: document.getElementById("m-imp-e").textContent, dis: document.getElementById("m-imp").disabled }));
    if (!se.vis || se.dis || msgs.has(se.t)) throw new Error("opslag vol: " + JSON.stringify(se));
    msgs.set(se.t, "store");
    if ((await mapsIdb(page, () => true)).length !== n0) throw new Error("kapot bestand maakte toch een kaart");
    // 14 foutbestanden + te groot + opslag vol, codes empty notjson format newer b64 sha missing image badmap objs (WP66) big store: 12 teksten
    if (msgs.size !== 12) throw new Error("foutregels niet per soort verschillend: " + [...msgs.keys()].join(" | "));
    await snap(page, "wp60", "fout");
    // geldig bestand: nieuwe kaart bovenaan met focus, melding met Ongedaan, foutregel weg
    const fxDoc = JSON.parse(readFileSync(join(FX, "valid.json"), "utf8")), sha = Object.keys(fxDoc.assets)[0];
    await imp(fxFile("valid.json"));
    const all1 = await mapsIdb(page, (all) => all.length === n0 + 1);
    const m1 = all1.find((m) => m.name === "Test fixture");
    if (!m1 || m1.schema !== 2 || m1.bg.asset !== sha || m1.grid.cols !== 2 || m1.id === "import0") throw new Error("import: " + JSON.stringify(m1));
    const st1 = await page.evaluate(() => ({ e: document.getElementById("m-imp-e").hidden, top: document.querySelector("#m-lrows .mkl-o")?.dataset.id, foc: document.activeElement?.dataset?.id, t: !!document.querySelector("#m-toast .tundo") }));
    if (!st1.e || st1.top !== m1.id || st1.foc !== m1.id || !st1.t) throw new Error("na import: " + JSON.stringify(st1));
    if (!(await mapsAssets(page)).some((a) => a.key === sha && a.w === 140 && a.ow === 140)) throw new Error("asset uit het bestand niet bewaard");
    // nog een keer: nooit overschrijven, unieke naam; Ongedaan haalt alleen de tweede weg
    await imp(fxFile("valid.json"));
    const all2 = await mapsIdb(page, (all) => all.length === n0 + 2);
    const m2 = all2.find((m) => m.name === "Test fixture 2");
    if (!m2 || m2.id === m1.id || !all2.some((m) => m.id === m1.id && m.name === "Test fixture")) throw new Error("tweede import: " + all2.map((m) => m.name));
    await tap(page, "#m-toast .tundo");
    await mapsIdb(page, (all) => all.length === n0 + 1 && !all.some((m) => m.id === m2.id));
    // kwaadaardige naam: tekst, geen element
    await imp(fxFile("evil.json"));
    await mapsIdb(page, (all) => all.length === n0 + 2);
    if (await page.locator("#m-lrows img").count()) throw new Error("HTML uit de naam is een element geworden");
    // openen: achtergrond geladen
    await tap(page, `#m-lrows .mkl-o[data-id="${m1.id}"]`);
    await page.waitForFunction((id) => window.__maps.view$() === "edit" && window.__maps.map().id === id && window.__maps.bg().img, m1.id, { timeout: 5000 });
    await snap(page, "wp60", "editor");
    const frame = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const pix = async (p) => { await frame(p); return p.evaluate(() => document.getElementById("m-canvas").toDataURL()); };
    const pixA = await pix(page), modelA = await page.evaluate(() => window.__maps.map());
    // exporteren via het menu (Linux-Chromium heeft geen deelmenu; voor de zekerheid uit): download
    await page.evaluate(() => { try { Object.defineProperty(navigator, "canShare", { value: undefined, configurable: true }); } catch { /* */ } });
    await toList();
    await tap(page, `#m-lrows .mkl-m[data-id="${m1.id}"]`);
    const [dl] = await Promise.all([page.waitForEvent("download"), tap(page, '#m-menu [data-m="exp"]')]);
    if (!/^inn-sight-test-fixture-\d{4}-\d\d-\d\d-\d\d-\d\d\.json$/.test(dl.suggestedFilename())) throw new Error("bestandsnaam: " + dl.suggestedFilename());
    const text = readFileSync(await dl.path(), "utf8"), doc = JSON.parse(text);
    if (doc.format !== "kevs-inn-maps" || doc.version !== 1 || "id" in doc.map || /blob:|https?:|indexeddb/i.test(text) || !doc.assets[sha]) throw new Error("exportbestand: " + text.slice(0, 200));
    await page.locator("#m-menu").waitFor({ state: "hidden" });
    // ander browsercontext = ander apparaat: lege opslag, importeren, openen, vergelijken
    const ctx2 = await page.context().browser().newContext({ viewport: page.viewportSize(), hasTouch: true, isMobile: true, colorScheme: await page.evaluate(() => (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")), deviceScaleFactor: 2, serviceWorkers: "block" });
    try {
      const dbg = await page.evaluate(() => localStorage.getItem("kevs-i18n-debug")); // zelfde taalstand (xx: langere kop = ander canvas)
      await ctx2.addInitScript((m) => { try { if (m) localStorage.setItem("kevs-i18n-debug", m); } catch { /* */ } }, dbg);
      const p2 = await ctx2.newPage();
      await p2.goto(page.url()); await ready(p2);
      await toList(p2);
      await imp({ name: dl.suggestedFilename(), mimeType: "application/json", buffer: Buffer.from(text) }, p2);
      const got = await mapsIdb(p2, (all) => all.some((m) => m.name === "Test fixture"));
      const id = got.find((m) => m.name === "Test fixture").id;
      await tap(p2, `#m-lrows .mkl-o[data-id="${id}"]`);
      await p2.waitForFunction((i) => window.__maps.view$() === "edit" && window.__maps.map().id === i && window.__maps.bg().img, id, { timeout: 5000 });
      const modelB = await p2.evaluate(() => window.__maps.map());
      const strip = ({ id, createdAt, updatedAt, ...r }) => r;
      if (JSON.stringify(strip(modelA)) !== JSON.stringify(strip(modelB))) throw new Error("modeldata na rondreis: " + JSON.stringify({ a: strip(modelA), b: strip(modelB) }));
      if ((await pix(p2)) !== pixA) throw new Error("rendering na rondreis niet pixelgelijk");
    } finally { await ctx2.close(); }
  },
  // WP61 (G4): undo/redo en plaatsen. Ongedaan/Opnieuw in de kop (uit zolang er niets is) over rasterwijzigingen; paneel
  // Bibliotheek zonder dim, 4 categorieën; tegel kiezen = Plaatsen (strook), tik plaatst op de cel (snap), slepen pant
  // zonder te plaatsen, tik naast de kaart plaatst niets, snap uit = tikpunt; het onderdeel is echt getekend (pixel);
  // elk ingebouwd onderdeel op vierkant en hex op de verwachte plek, ook na herladen en na export → import (acceptatie 1);
  // Ctrl+Z / Ctrl+Shift+Z; achtergrond kiezen/verwijderen en één uitlijnsessie = één stap, knoppen uit tijdens uitlijnen
  // (acceptatie 2). --shots=wp61: bibliotheek, kaart met objecten.
  async wp61(page) {
    const ready = (p = page) => p.waitForFunction(() => window.__maps && window.__maps.map() && document.getElementById("m-zoom").textContent);
    await ready();
    const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const M = () => page.evaluate(() => ({ map: window.__maps.map(), hist: window.__maps.hist(), tool: window.__maps.tool(), view: window.__maps.view(), grid: window.__maps.grid(),
      undo: document.getElementById("m-undo").disabled, redo: document.getElementById("m-redo").disabled }));
    const touch = (steps) => page.evaluate((steps) => {
      const c = document.getElementById("m-canvas"), r = c.getBoundingClientRect();
      for (const [type, id, x, y] of steps) c.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: "touch", isPrimary: id === 1, clientX: r.left + x, clientY: r.top + y, bubbles: true, cancelable: true, button: 0, buttons: type === "pointerup" ? 0 : 1 }));
    }, steps);
    const scr = async (mx, my) => { const v = (await M()).view; return { x: mx * 48 * v.z + v.x, y: my * 48 * v.z + v.y }; };
    const tapMap = async (mx, my) => { const p = await scr(mx, my); await touch([["pointerdown", 1, p.x, p.y], ["pointerup", 1, p.x, p.y]]); await frame(); };
    const field = async (sel, v) => { await page.locator(sel).fill(v); await page.locator(sel).press("Enter"); await frame(); };
    let m = await M();
    if (!m.undo || !m.redo) throw new Error("Ongedaan/Opnieuw niet uit bij een verse kaart");
    // raster: twee stappen, Ongedaan/Opnieuw via de kop
    await tap(page, "#m-set"); await page.locator("#m-sheet").waitFor({ state: "visible" });
    await field("#m-cols", "10"); await field("#m-rows", "8");
    m = await M();
    if (m.grid.cols !== 10 || m.grid.rows !== 8 || m.hist.size !== 2 || m.undo) throw new Error("raster als stappen: " + JSON.stringify(m.hist));
    await tap(page, "#m-undo"); await frame();
    m = await M();
    if (m.grid.rows !== 15 || m.redo || (await page.locator("#m-rows").inputValue()) !== "15") throw new Error("Ongedaan raster (veld volgt): " + JSON.stringify(m.grid));
    await tap(page, "#m-redo"); await frame();
    if ((await M()).grid.rows !== 8) throw new Error("Opnieuw raster");
    // bibliotheek (dockknop; het paneel Kaart ligt over de dock en gaat eerst dicht), zonder dim
    await tap(page, "#m-close");
    await tap(page, "#m-lib"); await page.locator("#m-lsheet").waitFor({ state: "visible" });
    const lib = await page.evaluate(() => ({ kaart: document.getElementById("m-sheet").hidden, dim: [...document.querySelectorAll(".dim")].some((d) => d.offsetParent), cats: document.querySelectorAll("#m-cats button").length,
      tiles: document.querySelectorAll("#m-tiles .mtile").length, exp: document.getElementById("m-lib").getAttribute("aria-expanded"), snap: document.getElementById("m-snap").getAttribute("aria-pressed") }));
    if (!lib.kaart || lib.dim || lib.cats !== 4 || lib.tiles < 1 || lib.exp !== "true" || lib.snap !== "true") throw new Error("bibliotheek: " + JSON.stringify(lib));
    const pick = async (id) => {
      await tap(page, `#m-cats [data-v="${BUILTIN[id].cat}"]`);
      await tap(page, `#m-tiles [data-id="${id}"]`);
      await page.waitForFunction((id) => window.__maps.tool().active === id, id);
    };
    await pick("table");
    if (!(await page.locator("#m-pstrip").isVisible()) || !(await M()).tool.placing) throw new Error("Plaatsen niet aan na een tegel");
    await snap(page, "wp61", "bibliotheek");
    await tapMap(3.3, 2.4);
    m = await M();
    if (m.map.objs?.length !== 1 || m.map.objs[0].x !== 3 || m.map.objs[0].y !== 2.5 || m.map.objs[0].asset !== "table") throw new Error("tik plaatst op de cel: " + JSON.stringify(m.map.objs));
    // echt getekend: pixel in het tafelblad (#a4703f sinds WP68c, binnen 30 van de oude #9b6a3c) zodra de tekening geladen is
    const px = async (mx, my) => { const p = await scr(mx, my); return page.evaluate(({ x, y }) => { const c = document.getElementById("m-canvas"), d = window.__maps.size().dpr; return [...c.getContext("2d").getImageData(Math.round(x * d), Math.round(y * d), 1, 1).data]; }, p); };
    const near = (a, b) => a.slice(0, 3).every((v, i) => Math.abs(v - b[i]) < 30);
    let ok = false;
    for (let i = 0; i < 40 && !ok; i++) { await frame(); ok = near(await px(2.5, 2.2), [155, 106, 60]); }
    if (!ok) throw new Error("tafel niet getekend: " + (await px(2.5, 2.2)));
    // slepen pant, plaatst niets
    const v0 = (await M()).view, p0 = await scr(5, 4);
    await touch([["pointerdown", 1, p0.x, p0.y], ["pointermove", 1, p0.x + 4, p0.y], ["pointermove", 1, p0.x + 30, p0.y + 10], ["pointerup", 1, p0.x + 30, p0.y + 10]]); await frame();
    m = await M();
    if (m.map.objs.length !== 1 || Math.abs(m.view.x - v0.x - 30) > 0.5) throw new Error("slepen in Plaatsen: " + JSON.stringify({ n: m.map.objs.length, v0, v: m.view }));
    await page.locator("#m-lsheet").focus(); await page.keyboard.press("0"); await frame(); // Hele kaart (toets 0; de dock ligt onder het paneel)
    // naast de kaart: niets, strook zegt het
    const vx = (await M()).view.x, strip = () => page.evaluate(() => document.getElementById("m-pstrip").textContent);
    if (!(vx > 8)) throw new Error("geen ruimte naast de kaart na Hele kaart: " + vx);
    const pre = await strip();
    await touch([["pointerdown", 1, vx - 4, 60], ["pointerup", 1, vx - 4, 60]]); await frame();
    const st = await strip();
    if ((await M()).map.objs.length !== 1 || !st || st === pre) throw new Error("tik naast de kaart: " + JSON.stringify({ pre, st }));
    // snap uit: het tikpunt; weer aan
    await tap(page, "#m-snap");
    await pick("chair");
    await tapMap(5.3, 4.6);
    m = await M();
    const ch = m.map.objs[m.map.objs.length - 1];
    if (m.map.objs.length !== 2 || Math.abs(ch.x - 5.3) > 0.05 || Math.abs(ch.y - 4.6) > 0.05) throw new Error("snap uit: " + JSON.stringify(ch));
    await tap(page, "#m-snap");
    if (!(await M()).tool.snap) throw new Error("snap weer aan");
    // elk ingebouwd onderdeel op vierkant en hex, op de verwachte plek
    const all = async () => {
      const g = cleanGrid((await M()).grid), exp = [];
      for (let i = 0; i < BUILTIN_IDS.length; i++) {
        const id = BUILTIN_IDS[i], c = cellCenter(g, i % 10, Math.floor(i / 10) * 3 + 1), x = c.x + 0.12, y = c.y - 0.1;
        await pick(id);
        await tapMap(x, y);
        exp.push({ asset: id, ...placeAt(g, x, y, BUILTIN[id].w, BUILTIN[id].h, true) });
      }
      const got = (await M()).map.objs.slice(-BUILTIN_IDS.length).map((o) => ({ asset: o.asset, x: o.x, y: o.y }));
      if (JSON.stringify(got) !== JSON.stringify(exp)) throw new Error("plek per onderdeel: " + JSON.stringify({ got, exp }));
    };
    await all();
    // Ctrl+Z / Ctrl+Shift+Z buiten een tekstveld
    await page.locator("#m-lsheet").focus();
    const n1 = (await M()).map.objs.length;
    await page.keyboard.press("Control+z"); await frame();
    if ((await M()).map.objs.length !== n1 - 1) throw new Error("Ctrl+Z");
    await page.keyboard.press("Control+Shift+Z"); await frame();
    if ((await M()).map.objs.length !== n1) throw new Error("Ctrl+Shift+Z");
    // hex (punt): nog eens alles; het tandwiel (ligt onder het paneel: via click()) sluit de bibliotheek
    await page.locator("#m-set").evaluate((b) => b.click());
    await page.locator("#m-sheet").waitFor({ state: "visible" });
    if (!(await page.locator("#m-lsheet").isHidden())) throw new Error("twee panelen tegelijk");
    await tap(page, '#m-type [data-v="pointy"]'); await frame();
    await tap(page, "#m-close");
    await tap(page, "#m-lib"); await page.locator("#m-lsheet").waitFor({ state: "visible" });
    await all();
    await tap(page, "#m-lclose");
    if ((await M()).tool.placing || !(await page.locator("#m-pstrip").isHidden())) throw new Error("Sluiten stopt Plaatsen");
    await snap(page, "wp61", "kaart");
    // herladen: alles op dezelfde plek
    const before = (await M()).map;
    await page.evaluate(() => window.__maps.flush());
    await mapsIdb(page, (l) => l.some((x) => x.id === before.id && x.objs?.length === before.objs.length && x.schema === 3));
    await page.reload(); await ready();
    const after = (await M()).map;
    if (JSON.stringify(after.objs) !== JSON.stringify(before.objs)) throw new Error("na herladen andere objecten");
    if (!(await M()).undo) throw new Error("geschiedenis hoort niet in de opslag");
    // export → import (nieuwe kaart) → openen: zelfde objecten
    await page.evaluate(() => { try { Object.defineProperty(navigator, "canShare", { value: undefined, configurable: true }); } catch { /* */ } });
    await tap(page, "#m-maps"); await page.locator("#m-list").waitFor({ state: "visible" });
    await tap(page, `#m-lrows .mkl-m[data-id="${before.id}"]`);
    const [dl] = await Promise.all([page.waitForEvent("download"), tap(page, '#m-menu [data-m="exp"]')]);
    const { readFileSync } = await import("node:fs");
    const text = readFileSync(await dl.path(), "utf8"), doc = JSON.parse(text);
    if (doc.map.schema !== 3 || JSON.stringify(doc.map.objs) !== JSON.stringify(before.objs) || Object.keys(doc.assets || {}).length) throw new Error("export: " + text.slice(0, 300));
    await page.locator("#m-menu").waitFor({ state: "hidden" });
    const [fc] = await Promise.all([page.waitForEvent("filechooser"), tap(page, "#m-imp")]);
    await fc.setFiles({ name: dl.suggestedFilename(), mimeType: "application/json", buffer: Buffer.from(text) });
    const lst = await mapsIdb(page, (l) => l.length >= 2);
    const imp = lst.find((x) => x.id !== before.id);
    await tap(page, `#m-lrows .mkl-o[data-id="${imp.id}"]`);
    await page.waitForFunction((id) => window.__maps.view$() === "edit" && window.__maps.map().id === id, imp.id);
    m = await M();
    if (JSON.stringify(m.map.objs) !== JSON.stringify(before.objs) || JSON.stringify(m.grid) !== JSON.stringify(before.grid)) throw new Error("na import andere objecten");
    if (!m.undo || !m.redo) throw new Error("andere kaart: lege geschiedenis");
    // achtergrond: kiezen en verwijderen als stap; uitlijnen (pijltjes + slepen) = één stap; knoppen uit tijdens uitlijnen
    await tap(page, "#m-set"); await page.locator("#m-sheet").waitFor({ state: "visible" });
    const [fb] = await Promise.all([page.waitForEvent("filechooser"), tap(page, "#m-bg-pick")]);
    await fb.setFiles({ name: "grot.png", mimeType: "image/png", buffer: await fixture(page, 700, 560, 70) });
    await page.waitForFunction(() => window.__maps.bg().state === "set" && window.__maps.bg().img, null, { timeout: 10000 });
    const s0 = (await M()).hist.size;
    await tap(page, "#m-bg-align"); await page.locator("#m-adock").waitFor({ state: "visible" });
    if (!(await M()).undo) throw new Error("Ongedaan aan tijdens uitlijnen");
    for (let i = 0; i < 3; i++) await tap(page, '#m-adock [data-nudge="right"]');
    const q = await scr(2, 2);
    await touch([["pointerdown", 1, q.x, q.y], ["pointermove", 1, q.x + 20, q.y], ["pointermove", 1, q.x + 40, q.y + 12], ["pointerup", 1, q.x + 40, q.y + 12]]);
    await tap(page, "#m-adone"); await page.locator("#m-sheet").waitFor({ state: "visible" });
    m = await M();
    if (m.hist.size !== s0 + 1 || !(m.map.bg.x > 0)) throw new Error("uitlijnsessie = één stap: " + JSON.stringify({ s0, h: m.hist, bg: m.map.bg }));
    await tap(page, "#m-undo"); await frame();
    if ((await M()).map.bg.x !== 0) throw new Error("Ongedaan uitlijnen");
    await tap(page, "#m-undo"); await frame();
    if ((await M()).map.bg) throw new Error("Ongedaan achtergrond kiezen");
    await tap(page, "#m-redo"); await page.waitForFunction(() => window.__maps.bg().state === "set" && window.__maps.bg().img, null, { timeout: 5000 });
    await tap(page, "#m-bg-del"); await frame();
    if ((await M()).map.bg) throw new Error("verwijderen");
    await tap(page, "#m-toast .tundo"); await page.waitForFunction(() => window.__maps.bg().state === "set", null, { timeout: 5000 });
    m = await M();
    if (m.redo !== false) throw new Error("Ongedaan in de melding = gewone undo (Opnieuw beschikbaar)");
  },
  // WP62 (G4): selecteren en bewerken. Tik selecteert (eigen dock, strook), nog eens tikken = het object eronder, tik
  // ernaast heft op; slepen op het geselecteerde object verplaatst (één stap), ernaast pant; touch-slepen op een niet
  // geselecteerd object pant; draaigreep en schaalgreep (tik naast het midden van de greep: tikdoel 44 px op 320 px);
  // dock: draaien, dupliceren, verwijderen + Ongedaan, Meer (paneel Object: breedte, laag, volgorde), Klaar; muis pakt en
  // sleept in één keer; toetsenbord zonder muis: cursor, Enter, pijltjes (één stap), Shift, R, ], Ctrl+D, Delete, Esc, N,
  // plaatsen met Enter; hex: pijltje = buurcel; herladen. --shots=wp62: selectie, paneel Object.
  async wp62(page) {
    const ready = (p = page) => p.waitForFunction(() => window.__maps && window.__maps.map() && document.getElementById("m-zoom").textContent);
    await ready();
    const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const M = () => page.evaluate(() => ({ map: window.__maps.map(), hist: window.__maps.hist(), view: window.__maps.view(), grid: window.__maps.grid(), sel: window.__maps.sel(), kbd: window.__maps.kbd(),
      odock: !document.getElementById("m-odock").hidden, dock: !document.getElementById("m-dock").hidden, strip: document.getElementById("m-sstrip").hidden ? "" : document.getElementById("m-sstrip").textContent }));
    const ptr = (steps, kind = "touch") => page.evaluate(({ steps, kind }) => {
      const c = document.getElementById("m-canvas"), r = c.getBoundingClientRect();
      for (const [type, id, x, y] of steps) c.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: kind, isPrimary: id === 1, clientX: r.left + x, clientY: r.top + y, bubbles: true, cancelable: true, button: 0, buttons: type === "pointerup" ? 0 : 1 }));
    }, { steps, kind });
    const scr = async (mx, my) => { const v = (await M()).view; return { x: mx * 48 * v.z + v.x, y: my * 48 * v.z + v.y }; };
    const tapAt = async (p) => { await ptr([["pointerdown", 1, p.x, p.y], ["pointerup", 1, p.x, p.y]]); await frame(); };
    const tapMap = async (mx, my) => tapAt(await scr(mx, my));
    const drag = async (a, b, kind = "touch") => { const st = [["pointerdown", 1, a.x, a.y]]; for (let i = 1; i <= 6; i++) st.push(["pointermove", 1, a.x + ((b.x - a.x) * i) / 6, a.y + ((b.y - a.y) * i) / 6]); st.push(["pointerup", 1, b.x, b.y]); await ptr(st, kind); await frame(); };
    const obj = async (id) => (await M()).map.objs.find((o) => o.id === id);
    const pick = async (id) => { await tap(page, `#m-cats [data-v="${BUILTIN[id].cat}"]`); await tap(page, `#m-tiles [data-id="${id}"]`); await page.waitForFunction((id) => window.__maps.tool().active === id, id); };
    // opbouw: tafel, stoel en een kleed eronder
    await tap(page, "#m-lib"); await page.locator("#m-lsheet").waitFor({ state: "visible" });
    await pick("table"); await tapMap(3.3, 2.4);
    await pick("chair"); await tapMap(8.3, 6.3);
    await pick("rug"); await tapMap(3.3, 3.3);
    await tap(page, "#m-lclose");
    let m = await M();
    const [T, C, R] = m.map.objs.map((o) => o.id);
    if (m.map.objs.length !== 3 || m.sel) throw new Error("opbouw: " + JSON.stringify(m.map.objs));
    // tik selecteert: eigen dock, strook; tikken op het geselecteerde object = het kleed eronder, en weer terug
    await tapMap(3.2, 2.6);
    m = await M();
    if (m.sel !== T || !m.odock || m.dock || !m.strip) throw new Error("selecteren: " + JSON.stringify({ sel: m.sel, odock: m.odock, dock: m.dock, strip: m.strip }));
    await snap(page, "wp62", "selectie");
    await tapMap(3.2, 2.6);
    if ((await M()).sel !== R) throw new Error("nog eens tikken = het object eronder");
    await tapMap(3.2, 2.6);
    if ((await M()).sel !== T) throw new Error("en weer het bovenste");
    // slepen op de selectie = verplaatsen, één stap; Ongedaan zet hem terug
    const h0 = (await M()).hist.size;
    await drag(await scr(3, 2.5), await scr(5.2, 2.6));
    m = await M();
    let t = await obj(T);
    if (t.x !== 5 || t.y !== 2.5 || m.hist.size !== h0 + 1 || m.sel !== T) throw new Error("slepen = één stap: " + JSON.stringify({ t, h0, h: m.hist }));
    await tap(page, "#m-undo"); await frame();
    if ((await obj(T)).x !== 3) throw new Error("Ongedaan slepen");
    await tap(page, "#m-redo"); await frame();
    // slepen ernaast pant (selectie blijft); touch-slepen op een niet-geselecteerd object pant ook
    let v0 = (await M()).view, p = await scr(8.5, 1.5);
    await drag(p, { x: p.x - 30, y: p.y + 10 });
    m = await M();
    if (Math.abs(m.view.x - v0.x + 30) > 0.5 || m.sel !== T || (await obj(T)).x !== 5) throw new Error("slepen naast de selectie pant: " + JSON.stringify({ v0, v: m.view }));
    v0 = m.view; p = await scr(8.5, 6.5);
    await drag(p, { x: p.x + 40, y: p.y });
    if ((await obj(C)).x !== 8.5 || Math.abs((await M()).view.x - v0.x - 40) > 0.5) throw new Error("touch: niet geselecteerd object slepen = pannen: " + JSON.stringify({ c: await obj(C), v0, v: (await M()).view, sel: (await M()).sel }));
    // draaien via de dock en met de draaigreep (tik 15 px naast het midden van de greep)
    await tap(page, "#m-orot"); await frame();
    t = await obj(T);
    if (t.rot !== 90 || t.x !== 5.5 || t.y !== 2) throw new Error("draaien 90° op de cellen: " + JSON.stringify(t));
    let v = (await M()).view, hd = handles(t, v), c0 = await scr(t.x, t.y);
    await drag({ x: hd.rot.x + 15, y: hd.rot.y }, { x: c0.x, y: c0.y + 120 });
    if ((await obj(T)).rot !== 180) throw new Error("draaigreep: " + JSON.stringify(await obj(T)));
    // schaalgreep op de stoel: twee cellen, linksboven blijft staan
    await tapMap(8.5, 6.5);
    if ((await M()).sel !== C) throw new Error("stoel selecteren");
    let ch = await obj(C);
    v = (await M()).view; hd = handles(ch, v);
    const cell = 48 * v.z;
    await drag({ x: hd.size.x - 12, y: hd.size.y + 12 }, { x: hd.size.x - 12 + cell, y: hd.size.y + 12 + cell });
    ch = await obj(C);
    if (ch.w !== 2 || ch.h !== 2 || ch.x !== 9 || ch.y !== 7) throw new Error("schaalgreep: " + JSON.stringify(ch));
    // Meer: paneel Object (breedte, laag, volgorde); Esc sluit het paneel, de selectie blijft
    await tap(page, "#m-omore"); await page.locator("#m-osheet").waitFor({ state: "visible" });
    if ((await page.locator("#m-ow").inputValue()) !== "2") throw new Error("breedte in het paneel");
    await page.locator("#m-ow").fill("3"); await page.locator("#m-ow").press("Enter"); await frame();
    if ((await obj(C)).w !== 3) throw new Error("breedte toepassen");
    await page.locator("#m-ow").fill("99"); await page.locator("#m-ow").press("Enter"); await frame();
    if (await page.locator("#m-ow-e").isHidden() || (await obj(C)).w !== 3) throw new Error("foute breedte: foutregel, niets toegepast");
    await page.locator("#m-ow").fill("3"); await page.locator("#m-ow").press("Enter");
    await tap(page, '#m-olayer [data-v="floor"]'); await frame();
    if ((await obj(C)).layer !== "floor" || !(await page.locator("#m-ofront").isDisabled())) throw new Error("laag vloer: bovenaan in die laag");
    await tap(page, "#m-oback"); await frame();
    m = await M();
    if (m.map.objs[0].id !== C) throw new Error("naar achteren: " + m.map.objs.map((o) => o.id));
    await snap(page, "wp62", "object");
    await page.keyboard.press("Escape"); await frame();
    if (!(await page.locator("#m-osheet").isHidden()) || (await M()).sel !== C) throw new Error("Esc: paneel dicht, selectie blijft");
    // dupliceren, verwijderen met Ongedaan, Klaar
    let n = (await M()).map.objs.length;
    await tap(page, "#m-odup"); await frame();
    m = await M();
    if (m.map.objs.length !== n + 1 || m.sel === C || !m.sel) throw new Error("dupliceren selecteert de kopie");
    await tap(page, "#m-odel"); await frame();
    m = await M();
    if (m.map.objs.length !== n || m.sel || !m.dock) throw new Error("verwijderen: " + JSON.stringify({ n: m.map.objs.length, sel: m.sel }));
    await tap(page, "#m-toast .tundo"); await frame();
    m = await M();
    if (m.map.objs.length !== n + 1 || !m.sel) throw new Error("Ongedaan verwijderen zet terug en selecteert");
    await tap(page, "#m-odone"); await frame();
    m = await M();
    if (m.sel || !m.dock || m.odock || m.strip) throw new Error("Klaar");
    // muis: indrukken op een object selecteert en sleept in één keer
    await drag(await scr(3, 3.5), await scr(3, 5.6), "mouse");
    m = await M();
    const rug = await obj(R);
    if (m.sel !== R || rug.y !== 5.5) throw new Error("muis: pakken en slepen: " + JSON.stringify({ sel: m.sel, rug }));
    await page.keyboard.press("Escape"); await frame();
    // toetsenbord: canvas met focus, cursor, Enter selecteert de tafel, pijltjes (één stap), Shift, R, ], Ctrl+D, Delete, N
    await page.locator("#m-canvas").focus();
    await page.keyboard.press("Escape"); // cursor weg
    t = await obj(T);
    await page.keyboard.press("ArrowRight"); await frame();
    let k = (await M()).kbd;
    if (!k) throw new Error("pijltje zonder selectie: cursor");
    const goal = { c: Math.floor(t.x), r: Math.floor(t.y) };
    for (let i = 0; i < 30 && (k.c !== goal.c || k.r !== goal.r); i++) {
      await page.keyboard.press(k.c < goal.c ? "ArrowRight" : k.c > goal.c ? "ArrowLeft" : k.r < goal.r ? "ArrowDown" : "ArrowUp");
      k = (await M()).kbd;
    }
    await page.keyboard.press("Enter"); await frame();
    if ((await M()).sel !== T) throw new Error("Enter selecteert het object op de cursor");
    const h1 = (await M()).hist.size, x1 = (await obj(T)).x;
    await page.keyboard.press("ArrowLeft"); await page.keyboard.press("ArrowLeft"); await frame();
    m = await M();
    if ((await obj(T)).x !== x1 - 2 || m.hist.size !== h1 + 1) throw new Error("pijltjes = één stap: " + JSON.stringify({ x1, t: await obj(T), h: m.hist }));
    await page.keyboard.press("Shift+ArrowDown"); await frame();
    if (Math.abs((await obj(T)).y - t.y - 0.1) > 1e-6) throw new Error("Shift+pijl = 0,1 cel");
    await page.keyboard.press("r"); await frame();
    if ((await obj(T)).rot !== 270) throw new Error("R draait");
    n = (await M()).map.objs.length;
    await page.keyboard.press("Control+d"); await frame();
    m = await M();
    if (m.map.objs.length !== n + 1 || m.sel === T) throw new Error("Ctrl+D dupliceert");
    await page.keyboard.press("Delete"); await frame();
    m = await M();
    if (m.map.objs.length !== n || m.sel) throw new Error("Delete verwijdert");
    await page.locator("#m-canvas").focus();
    await page.keyboard.press("n"); await frame();
    if (!(await M()).sel) throw new Error("N selecteert een object");
    await page.keyboard.press("Escape"); await frame();
    if ((await M()).sel) throw new Error("Esc heft op");
    // plaatsen met het toetsenbord: Bibliotheek, tegel, kaart met focus, Enter plaatst op de cursorcel
    await tap(page, "#m-lib"); await page.locator("#m-lsheet").waitFor({ state: "visible" });
    await pick("barrel");
    await page.locator("#m-canvas").focus();
    n = (await M()).map.objs.length;
    await page.keyboard.press("ArrowUp"); k = (await M()).kbd;
    await page.keyboard.press("Enter"); await frame();
    m = await M();
    const bar = m.map.objs[m.map.objs.length - 1], cc = cellCenter(cleanGrid(m.grid), k.c, k.r);
    if (m.map.objs.length !== n + 1 || bar.asset !== "barrel" || bar.x !== cc.x || bar.y !== cc.y || m.sel) throw new Error("Enter plaatst: " + JSON.stringify({ bar, k }));
    await tap(page, "#m-lclose");
    // hex: pijltje = buurcel (celmidden)
    await tap(page, "#m-set"); await page.locator("#m-sheet").waitFor({ state: "visible" });
    await tap(page, '#m-type [data-v="pointy"]'); await frame();
    await tap(page, "#m-close");
    await page.locator("#m-canvas").focus();
    await page.keyboard.press("n"); await frame();
    const sid = (await M()).sel, before = await obj(sid);
    await page.keyboard.press("ArrowRight"); await frame();
    const g = cleanGrid((await M()).grid), aft = await obj(sid), ca = cellAt(g, aft.x, aft.y), cb = cellAt(g, before.x, before.y), mc = cellCenter(g, ca.c, ca.r);
    if (Math.abs(aft.x - mc.x) > 1e-3 || Math.abs(aft.y - mc.y) > 1e-3 || ca.r !== cb.r || ca.c !== Math.min(g.cols - 1, cb.c + 1)) throw new Error("hex: pijltje rechts = buurcel: " + JSON.stringify({ before, aft }));
    await page.keyboard.press("Escape");
    // herladen: alles staat er nog
    const doc = (await M()).map;
    await page.evaluate(() => window.__maps.flush());
    await mapsIdb(page, (l) => l.some((x) => x.id === doc.id && JSON.stringify(x.objs) === JSON.stringify(doc.objs)));
    await page.reload(); await ready();
    if (JSON.stringify((await M()).map.objs) !== JSON.stringify(doc.objs) || (await M()).sel) throw new Error("na herladen");
  },
  // WP63 (G4): terrein verven. Tab Terrein in paneel Bibliotheek (categorieën en tegels weg, terreintegels + gereedschap);
  // zonder gekozen terrein verft niets; veeg met één vinger = elke cel eronder, één undo-stap (acceptatie 1), Ongedaan en
  // Opnieuw; een tweede vinger zet de begonnen veeg terug zonder stap; de kleur staat echt op het canvas (pixel); Breed =
  // 3×3; Vullen stopt bij een muur van steen en de kaartrand (acceptatie 2), slepen in Vullen pant; Wissen; een veeg over
  // een meubel verft (geen selectie); Esc stopt Verven; herladen; hex pointy: tik verft één cel. --shots=wp63: terrein.
  async wp63(page) {
    const ready = (p = page) => p.waitForFunction(() => window.__maps && window.__maps.map() && document.getElementById("m-zoom").textContent);
    await ready();
    const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const M = () => page.evaluate(() => ({ map: window.__maps.map(), hist: window.__maps.hist(), view: window.__maps.view(), grid: window.__maps.grid(), sel: window.__maps.sel(), paint: window.__maps.paint(),
      strip: document.getElementById("m-pstrip").hidden ? "" : document.getElementById("m-pstrip").textContent }));
    const ptr = (steps, kind = "touch") => page.evaluate(({ steps, kind }) => {
      const c = document.getElementById("m-canvas"), r = c.getBoundingClientRect();
      for (const [type, id, x, y] of steps) c.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: kind, isPrimary: id === 1, clientX: r.left + x, clientY: r.top + y, bubbles: true, cancelable: true, button: 0, buttons: type === "pointerup" ? 0 : 1 }));
    }, { steps, kind });
    const scr = async (mx, my) => { const v = (await M()).view; return { x: mx * 48 * v.z + v.x, y: my * 48 * v.z + v.y }; };
    const tapMap = async (mx, my) => { const p = await scr(mx, my); await ptr([["pointerdown", 1, p.x, p.y], ["pointerup", 1, p.x, p.y]]); await frame(); };
    const swipe = async (a, b) => { const st = [["pointerdown", 1, a.x, a.y]]; for (let i = 1; i <= 8; i++) st.push(["pointermove", 1, a.x + ((b.x - a.x) * i) / 8, a.y + ((b.y - a.y) * i) / 8]); st.push(["pointerup", 1, b.x, b.y]); await ptr(st); await frame(); };
    const swipeMap = async (x0, y0, x1, y1) => swipe(await scr(x0, y0), await scr(x1, y1));
    const nl = (await page.evaluate(() => document.documentElement.lang)) === "nl", says = (re, txt) => (nl ? re.test(txt) : !!txt); // striptekst alleen in het Nederlands letterlijk
    const cells = async () => (await M()).paint.cells;
    const pixel = async (mx, my) => { const p = await scr(mx, my); return page.evaluate(({ x, y }) => { const c = document.getElementById("m-canvas"), d = devicePixelRatio || 1; return [...c.getContext("2d").getImageData(Math.round(x * d), Math.round(y * d), 1, 1).data].slice(0, 3); }, p); };
    // kleine kaart (10 × 8), zodat elke cel ruim tikbaar is op 320 px
    await tap(page, "#m-set"); await page.locator("#m-sheet").waitFor({ state: "visible" });
    for (const [sel, v] of [["#m-cols", "10"], ["#m-rows", "8"]]) { await page.locator(sel).fill(v); await page.locator(sel).press("Enter"); }
    await tap(page, "#m-close"); await frame();
    // een tafel om overheen te verven
    await tap(page, "#m-lib"); await page.locator("#m-lsheet").waitFor({ state: "visible" });
    await tap(page, '#m-cats [data-v="furniture"]'); await tap(page, '#m-tiles [data-id="table"]'); await tapMap(6.3, 6.4);
    if ((await M()).map.objs.length !== 1) throw new Error("opbouw: tafel");
    // tab Terrein
    await tap(page, '#m-ltab [data-v="terrain"]'); await frame();
    if (!(await page.locator("#m-tiles").isHidden()) || !(await page.locator("#m-cats").isHidden()) || (await page.locator("#m-terr .mtile").count()) !== 9) throw new Error("tab Terrein: 8 terreinen + Wissen, geen onderdelen");
    let m = await M();
    if (m.paint.painting || m.paint.tab !== "terrain" || m.strip) throw new Error("geen terrein gekozen: geen Verven");
    await swipeMap(0.5, 0.5, 3.5, 0.5);
    if ((await cells()) !== 0) throw new Error("zonder gekozen terrein verft een veeg niets");
    // gras, penseel: één veeg = elke cel eronder, één stap
    await tap(page, '#m-tool [data-v="brush"]');
    await tap(page, '#m-terr [data-t="grass"]'); await frame();
    m = await M();
    if (!m.paint.painting || !says(/Gras/, m.strip)) throw new Error("Verven: strook " + m.strip);
    const h0 = m.hist.size, vw = m.view;
    await swipeMap(0.5, 0.5, 5.5, 0.5);
    m = await M();
    if (m.paint.cells !== 6 || m.hist.size !== h0 + 1 || m.view.x !== vw.x || m.view.y !== vw.y || m.view.z !== vw.z) throw new Error("veeg: " + JSON.stringify({ cells: m.paint.cells, h: m.hist.size, h0 }));
    const px = await pixel(1.5, 0.5);
    if (Math.abs(px[0] - 108) > 6 || Math.abs(px[1] - 154) > 6 || Math.abs(px[2] - 72) > 6) throw new Error("gras op het canvas: " + px);
    await snap(page, "wp63", "terrein");
    await tap(page, "#m-undo"); await frame();
    if ((await cells()) !== 0) throw new Error("Ongedaan: de hele veeg");
    await tap(page, "#m-redo"); await frame();
    if ((await cells()) !== 6) throw new Error("Opnieuw");
    // tweede vinger: de begonnen veeg verdwijnt, geen stap, knijpen zoomt
    const h1 = (await M()).hist.size, z1 = (await M()).view.z, a = await scr(2.5, 3.5), b = await scr(5.5, 4.5);
    await ptr([["pointerdown", 1, a.x, a.y], ["pointerdown", 2, b.x, b.y], ["pointermove", 2, b.x + 40, b.y + 30], ["pointerup", 2, b.x + 40, b.y + 30], ["pointerup", 1, a.x, a.y]]); await frame();
    m = await M();
    if (m.paint.cells !== 6 || m.hist.size !== h1 || m.view.z === z1) throw new Error("tweede vinger: " + JSON.stringify({ cells: m.paint.cells, h: m.hist.size, z: [z1, m.view.z] }));
    await page.keyboard.press("0"); await frame(); // weer passend (de dock ligt onder het paneel)
    // breed: 3 × 3 rond de cel
    await tap(page, '#m-tool [data-v="wide"]');
    await tapMap(2.5, 3.5);
    if ((await cells()) !== 15) throw new Error("Breed: 3×3 erbij: " + (await cells()));
    // muur van steen op kolom 7, dan water vullen rechts ervan: stopt bij de muur en de rand
    await tap(page, '#m-tool [data-v="brush"]'); await tap(page, '#m-terr [data-t="stone"]');
    await swipeMap(7.5, 0.5, 7.5, 7.5);
    if ((await cells()) !== 23) throw new Error("muur: " + (await cells()));
    await tap(page, '#m-tool [data-v="fill"]'); await tap(page, '#m-terr [data-t="water"]'); await frame();
    if (!says(/Vullen: Water/, (await M()).strip)) throw new Error("strook Vullen");
    const v0 = (await M()).view, h2 = (await M()).hist.size;
    await swipeMap(8.5, 2.5, 8.5, 5.5);
    m = await M();
    if (m.paint.cells !== 23 || (m.view.x === v0.x && m.view.y === v0.y)) throw new Error("slepen in Vullen pant, verft niet");
    await page.keyboard.press("0"); await frame();
    await tapMap(8.5, 3.5);
    m = await M();
    if (m.paint.cells !== 23 + 16 || m.hist.size !== h2 + 1 || !m.paint.ids.includes("water")) throw new Error("vullen rechts van de muur: " + m.paint.cells);
    // wissen (penseel) en een veeg over de tafel verft (geen selectie)
    await tap(page, '#m-tool [data-v="brush"]'); await tap(page, '#m-terr [data-t="erase"]');
    await tapMap(0.5, 0.5);
    if ((await cells()) !== 38 || !says(/Wissen/, (await M()).strip)) throw new Error("wissen");
    await tap(page, '#m-terr [data-t="dirt"]');
    await swipeMap(5.5, 6.5, 6.5, 6.5);
    m = await M();
    if (m.sel || m.paint.cells !== 40) throw new Error("veeg over de tafel: " + JSON.stringify({ sel: m.sel, cells: m.paint.cells }));
    // N selecteert niet tijdens Verven (Enter verft sinds WP65 de cursorcel: scenario wp65)
    await page.locator("#m-canvas").focus();
    await page.keyboard.press("n"); await frame();
    if ((await M()).sel || !(await M()).paint.painting || (await M()).paint.cells !== 40) throw new Error("N selecteert niet in Verven");
    // Esc stopt Verven; tik selecteert dan weer
    await page.keyboard.press("Escape"); await frame();
    m = await M();
    if (m.paint.painting || m.strip) throw new Error("Esc stopt Verven");
    // herladen: terrein bewaard
    const doc = m.map;
    await page.evaluate(() => window.__maps.flush());
    await mapsIdb(page, (l) => l.some((x) => x.id === doc.id && x.terr && x.terr.cells === doc.terr.cells));
    await page.reload(); await ready();
    m = await M();
    if (m.paint.cells !== 40 || m.map.schema !== 4) throw new Error("na herladen: " + JSON.stringify({ cells: m.paint.cells, schema: m.map.schema }));
    // hex: tik verft één cel (de cel onder het celmidden)
    await tap(page, "#m-set"); await page.locator("#m-sheet").waitFor({ state: "visible" });
    await tap(page, '#m-type [data-v="pointy"]'); await tap(page, "#m-close"); await frame();
    await tap(page, "#m-lib"); await page.locator("#m-lsheet").waitFor({ state: "visible" });
    await tap(page, '#m-ltab [data-v="terrain"]');
    await tap(page, '#m-terr [data-t="lava"]');
    const n0 = await cells(), cc = cellCenter(cleanGrid((await M()).grid), 3, 6);
    await tapMap(cc.x, cc.y);
    m = await M();
    if (m.paint.cells !== n0 + 1 || !m.paint.ids.includes("lava")) throw new Error("hex: één cel: " + JSON.stringify({ n0, cells: m.paint.cells }));
    const lv = await pixel(cc.x, cc.y), nb = cellCenter(cleanGrid((await M()).grid), 4, 6), nv = await pixel(nb.x, nb.y);
    if (Math.abs(lv[0] - 207) > 8 || Math.abs(lv[1] - 81) > 8 || Math.abs(lv[2] - 42) > 8 || Math.abs(nv[0] - 207) < 8 && Math.abs(nv[1] - 81) < 8) throw new Error("hex: lava alleen in die cel: " + JSON.stringify({ lv, nv }));
    // flat: één kolom-run van drie cellen + de cel ernaast leeg
    await tap(page, "#m-lclose"); await tap(page, "#m-set"); await tap(page, '#m-type [data-v="flat"]'); await tap(page, "#m-close"); await frame();
    await tap(page, "#m-lib"); await tap(page, '#m-ltab [data-v="terrain"]'); await tap(page, '#m-terr [data-t="sand"]');
    const gf = cleanGrid((await M()).grid), f0 = cellCenter(gf, 1, 2), f2 = cellCenter(gf, 1, 4);
    await swipeMap(f0.x, f0.y, f2.x, f2.y);
    for (const [c, r, want] of [[1, 2, true], [1, 3, true], [1, 4, true], [2, 3, false], [1, 5, false]]) {
      const q = cellCenter(gf, c, r), v = await pixel(q.x, q.y), sand = Math.abs(v[0] - 216) < 8 && Math.abs(v[1] - 192) < 8 && Math.abs(v[2] - 138) < 8;
      if (sand !== want) throw new Error(`hex plat: zand in ${c},${r} = ${sand}: ${v}`);
    }
    // acceptatie 3: hex 100×100 helemaal geverfd (headless tekent in software: grens ruim, en vooral het verschil met en zonder terrein telt) (vullen + breed in vier soorten), hele kaart in beeld: tekentijd per frame
    await tap(page, "#m-lclose");
    await tap(page, "#m-set"); await page.locator("#m-sheet").waitFor({ state: "visible" });
    for (const [sel, v] of [["#m-cols", "100"], ["#m-rows", "100"]]) { await page.locator(sel).fill(v); await page.locator(sel).press("Enter"); }
    await tap(page, "#m-close"); await frame();
    await tap(page, "#m-lib"); await page.locator("#m-lsheet").waitFor({ state: "visible" });
    await tap(page, '#m-ltab [data-v="terrain"]'); await tap(page, '#m-tool [data-v="fill"]'); await tap(page, '#m-terr [data-t="grass"]');
    await page.keyboard.press("0"); await frame();
    const ms0 = await page.evaluate(() => window.__maps.bench(20));
    await tapMap(50, 50);
    if ((await cells()) !== 10000) throw new Error("100×100 vullen: " + (await cells()));
    const ms = await page.evaluate(() => window.__maps.bench(20));
    if (page.viewportSize().width === 320) console.log(`  wp63: tekenen hex 100×100 vol: ${ms.toFixed(1)} ms/frame (zonder terrein ${ms0.toFixed(1)})`);
    if (ms > 80 || ms - ms0 > 15) throw new Error(`tekenen hex 100×100: ${ms.toFixed(1)} ms per frame`);
  },
  // WP64: eigen assets. Tab Eigen past op 320 px (drie tabs, geen afgekapte tekst); lege toestand; foute bestanden (eigen
  // regel); toevoegen = item met naam uit het bestand, grootte uit de verhouding, miniatuur, meteen Plaatsen; tik = object
  // (schema 5, tekent de afbeelding); beheerrij met gebruik; hernoemen (Enter, leeg = vorige); dezelfde upload = geen nieuw
  // item; tweede item; quota-strook (estimate nagebootst); verwijderen van een gebruikt item (melding "blijft op 1 kaart",
  // kaart tekent hem nog) + Ongedaan; herladen + opruimen houdt alles; export (download) → import in een ander
  // browsercontext: kaart compleet, item in Mijn assets met de naam, ongebruikt item niet in het bestand; opslag vol.
  // --shots=wp64: tab Eigen.
  async wp64(page, base) {
    const ready = (p = page) => p.waitForFunction(() => window.__maps && window.__maps.map() && document.getElementById("m-zoom").textContent);
    await ready();
    const frame = (p = page) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const nl = (await page.evaluate(() => document.documentElement.lang)) === "nl", says = (re, txt) => (nl ? re.test(txt) : !!txt);
    const ptr = (steps) => page.evaluate((steps) => {
      const c = document.getElementById("m-canvas"), r = c.getBoundingClientRect();
      for (const [type, x, y] of steps) c.dispatchEvent(new PointerEvent(type, { pointerId: 1, pointerType: "touch", isPrimary: true, clientX: r.left + x, clientY: r.top + y, bubbles: true, cancelable: true, button: 0, buttons: type === "pointerup" ? 0 : 1 }));
    }, steps);
    const scr = async (mx, my, p = page) => { const v = await p.evaluate(() => window.__maps.view()); return { x: mx * 48 * v.z + v.x, y: my * 48 * v.z + v.y }; };
    const tapMap = async (mx, my) => { const q = await scr(mx, my); await ptr([["pointerdown", q.x, q.y], ["pointerup", q.x, q.y]]); await frame(); };
    const pixel = async (mx, my, p = page) => { const q = await scr(mx, my, p); return p.evaluate(({ x, y }) => { const c = document.getElementById("m-canvas"), d = devicePixelRatio || 1; return [...c.getContext("2d").getImageData(Math.round(x * d), Math.round(y * d), 1, 1).data].slice(0, 3); }, q); };
    const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 24);
    const mine = (p = page) => p.evaluate(() => window.__maps.mine());
    const add = async (file, p = page) => {
      const [fc] = await Promise.all([p.waitForEvent("filechooser"), tap(p, "#m-myadd")]);
      await fc.setFiles(file);
      await p.waitForFunction(() => { const b = document.getElementById("m-myadd"); return b && !b.disabled && !b.hasAttribute("aria-busy"); }, null, { timeout: 10000 });
    };
    // kleine kaart (10 × 8)
    await tap(page, "#m-set"); await page.locator("#m-sheet").waitFor({ state: "visible" });
    for (const [sel, v] of [["#m-cols", "10"], ["#m-rows", "8"]]) { await page.locator(sel).fill(v); await page.locator(sel).press("Enter"); }
    await tap(page, "#m-close");
    await tap(page, "#m-lib"); await page.locator("#m-lsheet").waitFor({ state: "visible" });
    await tap(page, '#m-ltab [data-v="own"]');
    await page.locator("#m-my").waitFor({ state: "visible" });
    const tabs = await page.evaluate(() => [...document.querySelectorAll("#m-ltab button")].map((b) => ({ t: b.textContent, cut: b.scrollWidth > b.clientWidth + 1, w: b.getBoundingClientRect().width })));
    if (tabs.length !== 4 || tabs.some((x) => x.cut)) throw new Error("tabs (WP74: vier): " + JSON.stringify(tabs));
    if (!(await page.locator("#m-myhint").isVisible()) || (await page.locator("#m-mytiles .mtile").count()) !== 1 || !(await page.locator("#m-snap").isVisible())) throw new Error("lege toestand tab Eigen");
    // foute bestanden: eigen foutregel, geen item
    for (const [name, mimeType, buffer] of [["x.svg", "image/svg+xml", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')], ["x.png", "image/png", Buffer.from("geen afbeelding")]]) {
      await add({ name, mimeType, buffer });
      const e = await page.evaluate(() => ({ v: !document.getElementById("m-myerr").hidden, t: document.getElementById("m-myerr").textContent }));
      if (!e.v || e.t.length < 10 || e.t.includes("⟦") || (await mine()).length) throw new Error(`${name}: ` + JSON.stringify(e));
    }
    // toevoegen: 256 × 128 → 2 × 1 cel, naam uit het bestand, miniatuur, meteen gekozen (Plaatsen)
    const tok = await fixture(page, 256, 128, 32);
    await add({ name: "goblin_token.png", mimeType: "image/png", buffer: tok });
    let my = await mine();
    if (my.length !== 1 || my[0].name !== "goblin token" || my[0].w !== 2 || my[0].h !== 1 || !my[0].thumb) throw new Error("toevoegen: " + JSON.stringify(my));
    const T = my[0].sha;
    let st = await page.evaluate(() => ({ err: document.getElementById("m-myerr").hidden, hint: document.getElementById("m-myhint").hidden, tool: window.__maps.tool(), foc: document.activeElement?.dataset?.id, img: document.querySelector("#m-mytiles .mtimg img")?.naturalWidth, row: !document.getElementById("m-myrow").hidden }));
    if (!st.err || !st.hint || !st.tool.placing || st.tool.active !== T || st.foc !== T || !st.row) throw new Error("na toevoegen: " + JSON.stringify(st));
    await page.waitForFunction(() => document.querySelector("#m-mytiles .mtimg img")?.naturalWidth > 0, null, { timeout: 5000 }).catch(() => { throw new Error("miniatuur laadt niet"); });
    if (!says(/Niet gebruikt/, await page.locator("#m-myinfo").textContent())) throw new Error("gebruik vóór plaatsen: " + await page.locator("#m-myinfo").textContent());
    await snap(page, "wp64", "eigen");
    // plaatsen: object met de sha, grootte uit Mijn assets, schema 5, afbeelding getekend
    await tapMap(3, 2);
    let m = await page.evaluate(() => window.__maps.map());
    const o = (m.objs || []).find((x) => x.asset === T);
    if (!o || o.w !== 2 || o.h !== 1 || o.layer !== "object") throw new Error("plaatsen: " + JSON.stringify(m.objs));
    await page.waitForFunction((s) => window.__maps.art(s), T, { timeout: 5000 });
    await frame();
    if (!near(await pixel(o.x + 0.125, o.y + 0.125), [0xc9, 0xb4, 0x8a])) throw new Error("eigen asset niet getekend: " + await pixel(o.x + 0.125, o.y + 0.125));
    if (!says(/Op deze kaart/, await page.locator("#m-myinfo").textContent())) throw new Error("gebruik na plaatsen: " + await page.locator("#m-myinfo").textContent());
    await mapsIdb(page, (all) => all.some((x) => x.schema === 5 && (x.objs || []).some((y) => y.asset === T)));
    // hernoemen: Enter past toe, leeg = vorige naam
    await tap(page, "#m-myren");
    if ((await page.evaluate(() => document.activeElement?.id)) !== "m-myname") throw new Error("hernoemen: geen focus in het veld");
    await page.locator("#m-myname").fill("Goblin");
    await page.locator("#m-myname").press("Enter");
    await page.waitForFunction(() => window.__maps.mine()[0].name === "Goblin", null, { timeout: 3000 }).catch(() => {});
    my = await mine();
    if (my[0].name !== "Goblin" || (await page.locator("#m-myname-l").isVisible()) || (await page.evaluate(() => document.activeElement?.id)) !== "m-myren") throw new Error("hernoemen: " + JSON.stringify(my));
    await tap(page, "#m-myren"); await page.locator("#m-myname").fill("   "); await page.locator("#m-myname").press("Enter");
    if ((await mine())[0].name !== "Goblin") throw new Error("leeg hernoemen veranderde de naam");
    // dezelfde upload nog eens: geen nieuw item, melding
    await add({ name: "kopie.png", mimeType: "image/png", buffer: tok });
    if ((await mine()).length !== 1 || !says(/staat al bij/, await page.locator("#m-toast").textContent())) throw new Error("dubbele upload: " + JSON.stringify(await mine()));
    // tweede item (verhouding hoog): 64 × 160 → 1 × 2,5
    const tall = await fixture(page, 64, 160, 32, "image/webp");
    await add({ name: "fakkel.webp", mimeType: "image/webp", buffer: tall });
    my = await mine();
    const U = my.find((x) => x.name === "fakkel");
    if (my.length !== 2 || !U || U.w !== 1 || U.h !== 2.5 || my[0].sha !== U.sha) throw new Error("tweede item: " + JSON.stringify(my));
    // quota: estimate nagebootst (85 %) → strook bij het openen van de tab; zonder estimate geen strook
    await page.evaluate(() => { window.__est = navigator.storage.estimate; navigator.storage.estimate = async () => ({ usage: 85, quota: 100 }); });
    await tap(page, '#m-ltab [data-v="parts"]'); await tap(page, '#m-ltab [data-v="own"]');
    await page.waitForFunction(() => !document.getElementById("m-myq").hidden, null, { timeout: 3000 }).catch(() => { throw new Error("quota-strook ontbreekt"); });
    if (!(await page.locator("#m-myq").textContent()).includes("85")) throw new Error("quota-strook: " + await page.locator("#m-myq").textContent());
    await page.evaluate(() => { navigator.storage.estimate = window.__est; });
    // opslag vol bij toevoegen: eigen foutregel, geen item
    await page.evaluate(() => { window.__put = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function () { throw new DOMException("vol", "QuotaExceededError"); }; });
    await add({ name: "vol.png", mimeType: "image/png", buffer: await fixture(page, 40, 40, 10) });
    await page.evaluate(() => { IDBObjectStore.prototype.put = window.__put; });
    if ((await mine()).length !== 2 || (await page.locator("#m-myerr").isHidden())) throw new Error("opslag vol: geen foutregel");
    // verwijderen van het gebruikte item: melding noemt de kaart, object blijft getekend; Ongedaan zet hem terug
    await tap(page, `#m-mytiles [data-id="${T}"]`);
    await tap(page, "#m-mydel");
    await page.waitForFunction(() => window.__maps.mine().length === 1, null, { timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(50);
    if ((await mine()).length !== 1 || !says(/verwijderd uit je eigen afbeeldingen. Staat nog op 1 kaart\./, await page.locator("#m-toast").textContent())) throw new Error("verwijderen: " + await page.locator("#m-toast").textContent());
    if ((await page.evaluate(() => document.activeElement?.id)) !== "m-myadd") throw new Error("focus na verwijderen");
    await frame();
    if (!near(await pixel(o.x + 0.125, o.y + 0.125), [0xc9, 0xb4, 0x8a])) throw new Error("na verwijderen uit Mijn assets tekent de kaart het object niet meer");
    await tap(page, "#m-toast .tundo");
    await page.waitForFunction((s) => window.__maps.mine().some((x) => x.sha === s && x.name === "Goblin"), T, { timeout: 3000 });
    // herladen: items, object en afbeeldingen blijven (opruimen bij het opstarten kent de eigen assets)
    await page.evaluate(() => window.__maps.flush());
    await page.reload(); await ready();
    await page.waitForFunction((s) => window.__maps.mine().length === 2 && window.__maps.art(s), T, { timeout: 5000 });
    const keys = (await mapsAssets(page)).map((a) => a.key);
    if (!keys.includes(T) || !keys.includes(U.sha)) throw new Error("opruimen gooide een eigen asset weg");
    // review: ongebruikt item verwijderen + herstarten = afbeelding opgeruimd; de gebruikte blijft (ook zonder item)
    await tap(page, "#m-lib"); await page.locator("#m-lsheet").waitFor({ state: "visible" });
    await tap(page, '#m-ltab [data-v="own"]');
    await tap(page, `#m-mytiles [data-id="${U.sha}"]`); await tap(page, "#m-mydel");
    await page.waitForFunction(() => window.__maps.mine().length === 1, null, { timeout: 3000 });
    await page.waitForTimeout(100);
    await page.reload(); await ready();
    await page.waitForFunction((s) => window.__maps.art(s), T, { timeout: 5000 });
    for (let i = 0; i < 40 && (await mapsAssets(page)).some((a) => a.key === U.sha); i++) await page.waitForTimeout(50);
    const keys2 = (await mapsAssets(page)).map((a) => a.key);
    if (keys2.includes(U.sha) || !keys2.includes(T)) throw new Error("opruimen na verwijderen: " + JSON.stringify(keys2));
    // export (download): alleen de gebruikte eigen asset, met naam; ongebruikte niet
    await page.evaluate(() => { try { Object.defineProperty(navigator, "canShare", { value: undefined, configurable: true }); } catch { /* */ } });
    const id = (await page.evaluate(() => window.__maps.map())).id;
    await tap(page, "#m-maps"); await page.locator("#m-list").waitFor({ state: "visible" });
    await tap(page, `#m-lrows .mkl-m[data-id="${id}"]`);
    const [dl] = await Promise.all([page.waitForEvent("download"), tap(page, '#m-menu [data-m="exp"]')]);
    const { readFileSync } = await import("node:fs");
    const text = readFileSync(await dl.path(), "utf8"), doc = JSON.parse(text);
    if (!doc.assets[T] || doc.assets[T].name !== "Goblin" || doc.assets[U.sha] || doc.map.schema !== 5) throw new Error("exportbestand: " + JSON.stringify(Object.keys(doc.assets)));
    // ander apparaat: importeren → kaart compleet, item in Mijn assets met de naam
    const ctx2 = await page.context().browser().newContext({ viewport: page.viewportSize(), hasTouch: true, isMobile: true, deviceScaleFactor: 2, serviceWorkers: "block" });
    try {
      const p2 = await ctx2.newPage();
      await p2.goto(page.url()); await ready(p2);
      await tap(p2, "#m-maps"); await p2.locator("#m-list").waitFor({ state: "visible" });
      const [fc] = await Promise.all([p2.waitForEvent("filechooser"), tap(p2, "#m-imp")]);
      await fc.setFiles({ name: dl.suggestedFilename(), mimeType: "application/json", buffer: Buffer.from(text) });
      const got = await mapsIdb(p2, (all) => all.some((x) => x.schema === 5));
      let nid = got.find((x) => x.schema === 5).id;
      await p2.waitForFunction(() => window.__maps.mine().length > 0, null, { timeout: 5000 }).catch(() => {}); // Mijn assets komt ná de kaart (adoptMine); WP69: putImport schrijft de kaart sneller
      let m2 = await p2.evaluate(() => window.__maps.mine());
      if (m2.length !== 1 || m2[0].sha !== T || m2[0].name !== "Goblin" || !m2[0].thumb) throw new Error("import Mijn assets: " + JSON.stringify(m2));
      // review: Ongedaan van de import haalt ook het toegevoegde item weg; daarna opnieuw importeren
      await tap(p2, "#m-toast .tundo");
      await p2.waitForFunction(() => window.__maps.mine().length === 0, null, { timeout: 3000 }).catch(() => { throw new Error("Ongedaan van de import liet het item staan"); });
      const [fc2] = await Promise.all([p2.waitForEvent("filechooser"), tap(p2, "#m-imp")]);
      await fc2.setFiles({ name: dl.suggestedFilename(), mimeType: "application/json", buffer: Buffer.from(text) });
      nid = (await mapsIdb(p2, (all) => all.some((x) => x.schema === 5))).find((x) => x.schema === 5).id;
      await p2.waitForFunction(() => window.__maps.mine().length === 1, null, { timeout: 5000 });
      await tap(p2, `#m-lrows .mkl-o[data-id="${nid}"]`);
      await p2.waitForFunction((s) => window.__maps.view$() === "edit" && window.__maps.art(s), T, { timeout: 5000 });
      await frame(p2);
      const ob = (await p2.evaluate(() => window.__maps.map())).objs.find((x) => x.asset === T);
      if (!near(await pixel(ob.x + 0.125, ob.y + 0.125, p2), [0xc9, 0xb4, 0x8a])) throw new Error("geïmporteerde eigen asset niet getekend");
    } finally { await ctx2.close(); }
  },
  // WP65 (Maps 0.10.0): responsief, touch en eerste gebruik. Uitleg in een lege kaart, ?-overzicht (toets en link),
  // foutregels onder de rij (velden houden dezelfde top), kernflow (achtergrond → object → verven met het toetsenbord →
  // export), toegankelijke namen, en iPad portret (768) en desktop (1280): zijpaneel rechts tussen kop en dock, dock
  // bereikbaar, passend maken links van het paneel, geen horizontaal scrollen. --shots=wp65: lege kaart, zijpaneel.
  // WP66: prestaties en grenzen. Import met meer dan 2000 objecten = eigen foutregel, geen kaart; meetstand ?bench (korte
  // fasen): uitslag met drie fasen in een paneel, schrijft niets (geen kaart, laatste kaart en tabbladclaim ongewijzigd);
  // de kaartbuffer (createLayer) tekent bij pannen precies wat een volledige tekening zou tekenen, doorlopend zoomen is
  // een voorbeeld en wordt daarna vanzelf scherp. --shots=wp66: de uitslag.
  // WP68a (Maps 1.1.0): huisstijl van de editor. Walnut-kop met bovenregel "Inn Sight" (alleen in de editor), dock met
  // icoon + label (onder 380 px alleen het icoon, nooit < 44 px), de labels zitten in de toegankelijke naam, lijst met een
  // rastertype-teken per rij, paneel Kaart in twee groepen, strook op één regel als hij past.
  async wp68(page) {
    await page.waitForFunction(() => window.__maps && document.getElementById("m-zoom").textContent);
    const r = await page.evaluate(() => {
      const $ = (id) => document.getElementById(id), cs = (el) => getComputedStyle(el);
      const top = document.querySelector(".mtop"), out = { w: innerWidth };
      out.topBg = cs(top).backgroundColor; out.eye = !$("m-eye").hidden && $("m-eye").getBoundingClientRect().height > 0;
      out.btns = ["m-maps", "m-lib", "m-set"].map((id) => { const b = $(id), l = b.querySelector(".mdl"), rc = b.getBoundingClientRect();
        return { id, h: rc.height, w: rc.width, lab: l && l.getBoundingClientRect().width > 0, name: b.getAttribute("aria-label"), txt: l && l.textContent }; });
      out.dockOver = $("m-dock").scrollWidth - $("m-dock").clientWidth;
      return out;
    });
    if (r.dockOver > 0) throw new Error("dock loopt over: " + r.dockOver + " px");
    if (!/rgb\(36, 24, 17\)|rgb\(58, 40, 30\)/.test(r.topBg)) throw new Error("kop niet Walnut/Dark Oak: " + r.topBg);
    if (!r.eye) throw new Error("bovenregel Inn Sight ontbreekt in de editor");
    for (const b of r.btns) {
      if (b.h < 44 || b.w < 44) throw new Error("dockknop < 44 px: " + JSON.stringify(b));
      if (b.lab !== r.w >= 380) throw new Error("label " + (r.w >= 380 ? "ontbreekt" : "zichtbaar onder 380 px") + ": " + JSON.stringify(b));
      if (!b.name.toLowerCase().includes(b.txt.toLowerCase())) throw new Error("label niet in de toegankelijke naam: " + JSON.stringify(b));
    }
    await tap(page, "#m-set"); await page.waitForTimeout(100);
    const g = await page.evaluate(() => [...document.querySelectorAll("#m-sheet .mgrp")].map((e) => getComputedStyle(e).backgroundColor));
    if (g.length !== 3 || g.some((c) => c === "rgba(0, 0, 0, 0)")) throw new Error("paneel Kaart: drie groepen op --sunk verwacht (raster, achtergrond, WP73 fog): " + JSON.stringify(g));
    await page.keyboard.press("Escape"); await page.waitForTimeout(50);
    await tap(page, "#m-lib"); await page.waitForTimeout(100);
    await tap(page, "#m-tiles .mtile"); await page.waitForTimeout(100);
    const strip = await page.evaluate(() => { const e = document.getElementById("m-pstrip"), rc = e.getBoundingClientRect(); return { h: rc.height, w: rc.width, sw: e.scrollWidth }; });
    if (r.w >= 390 && strip.h > 48) throw new Error("strook niet op één regel op " + r.w + " px: " + JSON.stringify(strip));
    await page.keyboard.press("Escape"); await page.waitForTimeout(50);
    await tap(page, "#m-maps"); await page.waitForTimeout(150);
    const l = await page.evaluate(() => ({ eye: document.getElementById("m-eye").hidden, g: document.querySelectorAll("#m-lrows .mkl-g svg").length, rows: document.querySelectorAll("#m-lrows .mkl-row").length }));
    if (!l.eye) throw new Error("bovenregel zichtbaar in de lijst");
    if (l.g !== l.rows || !l.rows) throw new Error("rastertype-teken per rij ontbreekt: " + JSON.stringify(l));
  },
  // WP68b (Maps 1.2.0): uitleg in een lege kaart (drie regels met het woord van de dockknop, niet aanklikbaar) en de
  // raster-chip linksonder: verborgen zolang de uitleg staat, info opent Instellingen met de focus op het rastertype,
  // lijnen aan/uit = één undo-stap, verborgen onder een paneel van onderen en in de lijst, volgt het raster.
  async wp68b(page) {
    await page.waitForFunction(() => window.__maps && document.getElementById("m-zoom").textContent);
    const vis = (sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.closest("[hidden]") && e.getBoundingClientRect().height > 0; }, sel);
    const e0 = await page.evaluate(() => { const e = document.getElementById("m-empty"); return { rows: e.querySelectorAll("li").length, pe: getComputedStyle(e).pointerEvents, bs: getComputedStyle(e).borderTopStyle,
      words: [...e.querySelectorAll("li b")].map((b) => b.textContent), dock: [...document.querySelectorAll("#m-dock .mdl")].map((l) => l.textContent) }; });
    if (!(await vis("#m-empty")) || e0.rows !== 3 || e0.pe !== "none" || e0.bs !== "dashed") throw new Error("uitleg: " + JSON.stringify(e0));
    for (const w of e0.words) if (!e0.dock.includes(w)) throw new Error("uitleg noemt een woord dat niet in de dock staat: " + w);
    if (await vis("#m-gchip")) throw new Error("chip zichtbaar naast de uitleg");
    await tap(page, "#m-lib"); await page.waitForTimeout(100);
    await tap(page, "#m-tiles .mtile"); await page.waitForTimeout(100);
    const bb = await page.locator("#m-canvas").boundingBox();
    await page.touchscreen.tap(bb.x + bb.width * 0.4, bb.y + bb.height * 0.25); await page.waitForTimeout(100);
    if (await vis("#m-gchip")) throw new Error("chip zichtbaar onder een paneel van onderen");
    await page.keyboard.press("Escape"); await page.waitForTimeout(100);
    if (!(await vis("#m-gchip"))) throw new Error("chip ontbreekt met inhoud op de kaart");
    const c1 = await page.evaluate(() => { const i = document.getElementById("m-ginfo"), l = document.getElementById("m-glines"), r1 = i.getBoundingClientRect(), r2 = l.getBoundingClientRect();
      return { txt: document.getElementById("m-gtext").textContent, name: i.getAttribute("aria-label"), p: l.getAttribute("aria-pressed"), h: Math.min(r1.height, r2.height), w: r2.width }; });
    if (!c1.txt.endsWith(" · 20×15") || !c1.name.includes(c1.txt) || c1.p !== "true" || c1.h < 44 || c1.w < 44) throw new Error("chip: " + JSON.stringify(c1));
    const steps = await page.evaluate(() => window.__maps.hist().size);
    await tap(page, "#m-glines"); await page.waitForTimeout(100);
    const c2 = await page.evaluate(() => ({ show: window.__maps.grid().show, p: document.getElementById("m-glines").getAttribute("aria-pressed"), size: window.__maps.hist().size }));
    if (c2.show || c2.p !== "false" || c2.size !== steps + 1) throw new Error("lijnen uit = één stap: " + JSON.stringify(c2));
    await tap(page, "#m-undo"); await page.waitForTimeout(100);
    if (!(await page.evaluate(() => window.__maps.grid().show && document.getElementById("m-glines").getAttribute("aria-pressed") === "true"))) throw new Error("Ongedaan zet de lijnen niet terug");
    await tap(page, "#m-ginfo"); await page.waitForTimeout(150);
    const f = await page.evaluate(() => ({ open: !document.getElementById("m-sheet").hidden, foc: document.activeElement?.closest("#m-type") && document.activeElement.getAttribute("aria-pressed") }));
    if (!f.open || f.foc !== "true") throw new Error("info opent Instellingen met focus op het rastertype: " + JSON.stringify(f));
    await tap(page, '#m-type [data-v="pointy"]'); await page.waitForTimeout(100);
    await page.keyboard.press("Escape"); await page.waitForTimeout(100);
    const t2 = await page.evaluate(() => document.getElementById("m-gtext").textContent);
    if (t2 === c1.txt || !t2.endsWith(" · 20×15")) throw new Error("chip volgt het raster niet: " + t2);
    // lijnen uit, naar de lijst, een kopie openen: de chip volgt de geopende kaart
    await tap(page, "#m-glines"); await page.waitForTimeout(100);
    await tap(page, "#m-maps"); await page.waitForTimeout(150);
    if (await vis("#m-gchip")) throw new Error("chip zichtbaar in de lijst");
    await tap(page, "#m-new"); await page.waitForTimeout(300);
    const nw = await page.evaluate(() => ({ p: document.getElementById("m-glines").getAttribute("aria-pressed"), show: window.__maps.grid().show, txt: document.getElementById("m-gtext").textContent }));
    if (nw.p !== String(nw.show) || !nw.txt.endsWith(" · 20×15")) throw new Error("chip volgt een andere kaart niet: " + JSON.stringify(nw));
    // vanaf 768 px: chip blijft naast het zijpaneel (dan staat er wel iets op de kaart nodig: de nieuwe kaart is leeg)
    const vp = page.viewportSize();
    await page.setViewportSize({ width: 768, height: 1024 }); await page.waitForTimeout(200);
    await tap(page, "#m-lib"); await page.waitForTimeout(100);
    await tap(page, "#m-tiles .mtile"); await page.waitForTimeout(100);
    const b2 = await page.locator("#m-canvas").boundingBox();
    await page.touchscreen.tap(b2.x + 120, b2.y + 120); await page.waitForTimeout(150);
    const sd = await page.evaluate(() => { const c = document.getElementById("m-gchip").getBoundingClientRect(), p = document.getElementById("m-lsheet").getBoundingClientRect(); return { h: c.height, right: c.right, pl: p.left }; });
    if (!(await vis("#m-gchip")) || sd.right > sd.pl) throw new Error("chip naast het zijpaneel: " + JSON.stringify(sd));
    await page.keyboard.press("Escape"); await page.waitForTimeout(100);
    await page.setViewportSize(vp); await page.waitForTimeout(150);
  },
  // WP68c (Maps 1.3.0): de 24 hertekende onderdelen laden als tegel in elke categorie (geen kapotte afbeelding);
  // horizontaal scrollen telt de matrix, tekenen op de kaart bewaakt wp61 (pixel + elk onderdeel).
  async wp68c(page) {
    await page.waitForFunction(() => window.__maps && document.getElementById("m-zoom").textContent);
    await tap(page, "#m-lib"); await page.waitForTimeout(150);
    const seen = new Set();
    for (const b of await page.locator("#m-cats button").all()) {
      await b.tap(); await page.waitForTimeout(100);
      await page.waitForFunction(() => [...document.querySelectorAll("#m-tiles img")].every((i) => i.complete), null, { timeout: 5000 });
      const t = await page.evaluate(() => [...document.querySelectorAll("#m-tiles .mtile")].map((e) => ({ id: e.dataset.id, ok: (e.querySelector("img")?.naturalWidth || 0) > 0 })));
      for (const x of t) { if (!x.ok) throw new Error("tegel laadt niet: " + x.id); seen.add(x.id); }
    }
    if (seen.size !== 24) throw new Error("niet alle 24 onderdelen als tegel: " + seen.size);
  },
  // WP68d (Maps 1.4.0): installeerbaar, één app per taal. De pagina wijst naar het manifest van haar eigen taal; dat
  // manifest en alle iconen zijn bereikbaar, met id/scope/start_url = het eigen pad (nooit "/", dat is Initiative).
  async wp68d(page, base) {
    await page.waitForFunction(() => window.__maps && document.getElementById("m-zoom").textContent);
    const h = await page.evaluate(() => ({ man: document.querySelector('link[rel="manifest"]')?.href, apple: document.querySelector('link[rel="apple-touch-icon"]')?.href,
      icon: document.querySelector('link[rel="icon"]')?.href, title: document.querySelector('meta[name="apple-mobile-web-app-title"]')?.content, path: location.pathname }));
    if (!h.man || new URL(h.man).pathname !== h.path + "manifest.webmanifest") throw new Error("manifest-link: " + JSON.stringify(h));
    if (h.title !== "Inn Sight") throw new Error("apple-titel: " + h.title);
    const m = await (await page.request.get(h.man)).json();
    if (m.id !== h.path || m.scope !== h.path || m.start_url !== h.path) throw new Error("manifest-identiteit: " + JSON.stringify([m.id, m.scope, m.start_url, h.path]));
    for (const u of [h.apple, h.icon, ...m.icons.map((i) => new URL(i.src, h.man).href)]) { const res = await page.request.get(u); if (res.status() !== 200) throw new Error(`icoon ${u}: ${res.status()}`); }
  },
  async wp66(page, base) {
    const ready = () => page.waitForFunction(() => window.__maps && window.__maps.map() && document.getElementById("m-zoom").textContent);
    await ready();
    const { readFileSync } = await import("node:fs");
    await tap(page, "#m-maps"); await page.locator("#m-list").waitFor({ state: "visible" });
    const n0 = (await mapsIdb(page, (all) => all.length >= 1)).length;
    const [fc] = await Promise.all([page.waitForEvent("filechooser"), tap(page, "#m-imp")]);
    await fc.setFiles({ name: "te-veel.json", mimeType: "application/json", buffer: readFileSync(join(ROOT, "tests/fixtures/maps/err-objs.json")) });
    await page.waitForFunction(() => !document.getElementById("m-imp-e").hidden, null, { timeout: 10000 });
    const et = await page.locator("#m-imp-e").textContent();
    if (!/2[.,]?000/.test(et)) throw new Error("foutregel noemt de grens niet: " + et);
    await page.waitForTimeout(300);
    if ((await mapsIdb(page, () => true)).length !== n0) throw new Error("import met te veel objecten maakte toch een kaart");
    const keep = await page.evaluate(() => [localStorage.getItem("maps-last"), localStorage.getItem("maps-tab")]);
    // meetstand
    await page.goto(base + (await page.evaluate(() => location.pathname)) + "?bench&ms=300");
    await page.waitForFunction(() => window.__maps && window.__maps.result(), null, { timeout: 60000 });
    const res = await page.evaluate(() => window.__maps.result());
    for (const ph of ["pan", "far", "zoom"]) if (!(res.res[ph] && res.res[ph].fps > 0)) throw new Error("meetstand: fase " + ph + " zonder uitslag");
    if (!(res.openMs > 0) || !(res.mem.mb > 0)) throw new Error("meetstand: openen/geheugen ontbreekt");
    if ((await page.locator("#m-benchw .mbench dt").count()) !== 4) throw new Error("uitslag: 4 regels");
    if (!(await page.evaluate(() => document.getElementById("m-benchw").contains(document.activeElement)))) throw new Error("uitslag: focus in het paneel");
    if (page.viewportSize().width === 320) console.log(`  wp66: open ${res.openMs} ms, ` + ["pan", "far", "zoom"].map((p) => `${p} ${res.res[p].fps} fps (tekenen ${res.res[p].draw} ms)`).join(", ") + `, ${res.mem.mb} MB`);
    await snap(page, "wp66", "uitslag");
    const after = await page.evaluate(() => [localStorage.getItem("maps-last"), localStorage.getItem("maps-tab")]);
    if (after[0] !== keep[0] || after[1] !== keep[1]) throw new Error("meetstand schreef in localStorage: " + JSON.stringify([keep, after]));
    if ((await mapsIdb(page, () => true)).length !== n0) throw new Error("meetstand schreef een kaart");
    // buffer tegen volledige tekening
    const go = (v) => page.evaluate((v) => window.__maps.go(v), v);
    const diff = async (what) => { const d = await page.evaluate(() => window.__maps.diff()); if (d.n > d.of * 0.002) throw new Error(`${what}: ${d.n} van ${d.of} pixels anders dan een volledige tekening`); };
    let v = { x: -300.25, y: -200.5, z: 0.5 };
    await page.waitForTimeout(300); // ZOOM_GAP: het zoomen van het script is voorbij
    if ((await go(v)) !== "full") throw new Error("nieuwe zoom: volledig tekenen");
    await diff("volledig");
    for (const [dx, dy] of [[13.3, 0], [0, -21.7], [-48.4, 33.1], [5.5, 5.5]]) {
      v = { ...v, x: v.x + dx, y: v.y + dy };
      const m = await go(v);
      if (m !== "pan") throw new Error(`pannen ${dx},${dy}: ${m}`);
      await diff(`na pannen ${dx},${dy}`);
    }
    if ((await go({ ...v, x: v.x + 5000 })) !== "full") throw new Error("ver pannen: volledig tekenen");
    await page.waitForTimeout(300);
    if ((await go({ ...v, z: 0.55 })) !== "full") throw new Error("losse zoomstap: meteen scherp");
    const zm = await go({ ...v, z: 0.6 });
    if (zm !== "zoom") throw new Error("doorlopend zoomen: voorbeeld verwacht, kreeg " + zm);
    await page.waitForFunction(() => window.__maps.mode() === "full", null, { timeout: 2000 });
    await diff("na zoomen");
  },
  async wp65(page) {
    const ready = () => page.waitForFunction(() => window.__maps && window.__maps.map() && document.getElementById("m-zoom").textContent);
    await ready();
    const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const M = () => page.evaluate(() => ({ map: window.__maps.map(), hist: window.__maps.hist(), view: window.__maps.view(), size: window.__maps.size(), paint: window.__maps.paint(), kbd: window.__maps.kbd() }));
    const vis = (sel) => page.locator(sel).isVisible();
    // uitleg in een lege kaart, geen melding bij het opstarten
    if (!(await vis("#m-empty")) || (await page.locator("#m-toast .tmsg").count())) throw new Error("lege kaart: uitleg zichtbaar, geen melding");
    await snap(page, "wp65", "leeg");
    // toegankelijke namen: elke zichtbare knop heeft tekst of aria-label
    const noName = () => page.evaluate(() => [...document.querySelectorAll("button")].filter((b) => b.offsetParent && !(b.getAttribute("aria-label") || b.textContent).trim()).map((b) => b.id || b.className));
    let nn = await noName();
    if (nn.length) throw new Error("knop zonder naam: " + nn.join(", "));
    // ? opent het overzicht, Esc sluit, focus terug
    await page.locator("#m-canvas").focus();
    await page.keyboard.press("?");
    await page.locator("#m-keysw .keys").first().waitFor({ state: "visible" });
    if ((await page.locator("#m-keysw dl.keys").count()) !== 3 || !(await page.evaluate(() => document.getElementById("m-stage").inert))) throw new Error("overzicht: 3 groepen, rest inert");
    await page.keyboard.press("ArrowRight"); // geblokkeerd zolang het overzicht open is
    if ((await M()).kbd) throw new Error("pijltje onder het overzicht verplaatste de cursor");
    await page.keyboard.press("Escape");
    await page.locator("#m-keysw").waitFor({ state: "hidden" });
    if (!(await page.evaluate(() => document.activeElement && document.activeElement.id === "m-canvas" && !document.getElementById("m-stage").inert))) throw new Error("Esc: focus terug op de kaart");
    // paneel Kaart: link Sneltoetsen (≥ 44 px), foutregel onder de rij
    await tap(page, "#m-set"); await page.locator("#m-sheet").waitFor({ state: "visible" });
    if (await vis("#m-empty")) throw new Error("uitleg weg zolang een paneel open is");
    const kb = await page.locator("#m-keys").boundingBox();
    if (!kb || kb.height < 44) throw new Error("link Sneltoetsen < 44 px");
    await tap(page, "#m-keys"); await page.locator("#m-keysw .sheet").waitFor({ state: "visible" });
    await tap(page, '#m-keysw .shead [data-keys="close"]'); await page.locator("#m-keysw").waitFor({ state: "hidden" });
    if (!(await page.evaluate(() => document.activeElement && document.activeElement.id === "m-keys"))) throw new Error("sluiten: focus terug op de link");
    // ten opzichte van het rastertype erboven (het paneel kan intussen scrollen)
    const tops = () => page.evaluate(() => ["m-cols", "m-rows"].map((id) => Math.round(document.getElementById(id).getBoundingClientRect().top - document.getElementById("m-type").getBoundingClientRect().top)));
    const t0 = await tops();
    await page.locator("#m-cols").fill("0");
    if (!(await vis("#m-cols-e"))) throw new Error("foutregel kolommen");
    const t1 = await tops();
    if (t0[0] !== t0[1] || t1[0] !== t1[1] || t1[0] !== t0[0]) throw new Error("foutregel verschuift een veld: " + JSON.stringify([t0, t1]));
    const eb = await page.locator("#m-cols-e").boundingBox(), rb = await page.locator("#m-rows").boundingBox();
    if (eb.y < rb.y + rb.height) throw new Error("foutregel niet onder de hele rij");
    await page.locator("#m-rows").fill("999"); // twee fouten = één regel
    if (!(await vis("#m-cols-e")) || (await vis("#m-rows-e"))) throw new Error("twee fouten: één regel");
    for (const [sel, v] of [["#m-cols", "10"], ["#m-rows", "8"]]) { await page.locator(sel).fill(v); await page.locator(sel).press("Enter"); }
    if ((await vis("#m-cols-e")) || (await vis("#m-rows-e"))) throw new Error("geldig: foutregels weg");
    // kernflow: achtergrond
    await page.locator("#m-bg-file").setInputFiles({ name: "kaart.png", mimeType: "image/png", buffer: await fixture(page, 700, 560, 70) });
    await page.waitForFunction(() => window.__maps.bg().state === "set", null, { timeout: 5000 });
    const p0 = await page.locator("#m-ppc").boundingBox(), a0 = await page.locator("#m-across").boundingBox();
    await page.locator("#m-ppc").fill("2");
    const p1 = await page.locator("#m-ppc").boundingBox(), a1 = await page.locator("#m-across").boundingBox();
    if (!(await vis("#m-ppc-e")) || Math.round(p1.y) !== Math.round(a1.y) || Math.round(p0.y) !== Math.round(p1.y) || Math.round(a0.y) !== Math.round(a1.y)) throw new Error("foutregel pixels per cel verschuift een veld");
    await page.locator("#m-ppc").fill("70"); await page.locator("#m-ppc").press("Enter");
    await tap(page, "#m-close"); await frame();
    if (await vis("#m-empty")) throw new Error("met een achtergrond: geen uitleg meer");
    // object plaatsen
    await tap(page, "#m-lib"); await page.locator("#m-lsheet").waitFor({ state: "visible" });
    await tap(page, '#m-cats [data-v="furniture"]'); await tap(page, '#m-tiles [data-id="table"]');
    await page.locator("#m-canvas").focus();
    await page.keyboard.press("ArrowRight"); await page.keyboard.press("Enter"); await frame();
    if ((await M()).map.objs?.length !== 1) throw new Error("plaatsen met Enter");
    // verven met het toetsenbord: tab Terrein, uitleg tot er een terrein gekozen is
    await tap(page, '#m-ltab [data-v="terrain"]');
    if (!(await vis("#m-terr-h"))) throw new Error("Terrein zonder keuze: uitleg");
    await tap(page, '#m-tool [data-v="brush"]'); await tap(page, '#m-terr [data-t="grass"]');
    if (await vis("#m-terr-h")) throw new Error("terrein gekozen: uitleg weg");
    await page.locator("#m-canvas").focus();
    const keys = async (k, n = 1) => { for (let i = 0; i < n; i++) await page.keyboard.press(k); };
    await keys("ArrowUp", 10); await keys("ArrowLeft", 12); // cursor in de hoek (0, 0): pijltjes klemmen op de kaart
    let m = await M();
    if (m.kbd.c !== 0 || m.kbd.r !== 0) throw new Error("cursor in de hoek: " + JSON.stringify(m.kbd));
    const h0 = m.hist.size;
    await page.keyboard.press("Enter"); await frame();
    m = await M();
    if (m.paint.cells !== 1 || m.hist.size !== h0 + 1) throw new Error("Enter verft de cursorcel: " + JSON.stringify({ cells: m.paint.cells, h: [h0, m.hist.size] }));
    await keys("ArrowRight"); await page.keyboard.press(" "); await frame();
    if ((await M()).paint.cells !== 2) throw new Error("spatie verft");
    await tap(page, '#m-tool [data-v="wide"]'); await page.locator("#m-canvas").focus();
    await keys("ArrowRight", 3); await keys("ArrowDown", 4); await page.keyboard.press("Enter"); await frame(); // (4, 4): 3×3 helemaal nieuw
    if ((await M()).paint.cells !== 11) throw new Error("Breed met Enter: 3×3 erbij: " + (await M()).paint.cells);
    await tap(page, '#m-tool [data-v="fill"]'); await tap(page, '#m-terr [data-t="water"]'); await page.locator("#m-canvas").focus();
    await keys("ArrowRight", 5); await keys("ArrowDown", 3); // (9, 7): leeg, vult de rest van de 10 × 8
    await page.keyboard.press("Enter"); await frame();
    m = await M();
    if (m.paint.cells !== 80 || !m.paint.ids.includes("water")) throw new Error("Vullen met Enter: " + JSON.stringify(m.paint));
    await page.keyboard.press("Control+z"); await frame();
    if ((await M()).paint.cells !== 11) throw new Error("Ongedaan na Vullen met Enter");
    await page.keyboard.press("Escape"); // Bibliotheek dicht
    await page.locator("#m-lsheet").waitFor({ state: "hidden" });
    nn = await noName();
    if (nn.length) throw new Error("knop zonder naam: " + nn.join(", "));
    // exporteren
    await page.evaluate(() => { try { Object.defineProperty(navigator, "canShare", { value: undefined, configurable: true }); } catch { /* */ } });
    const id = (await M()).map.id;
    await page.evaluate(() => window.__maps.flush());
    await tap(page, "#m-maps"); await page.waitForFunction(() => window.__maps.view$() === "list");
    await tap(page, `#m-lrows .mkl-m[data-id="${id}"]`);
    const [dl] = await Promise.all([page.waitForEvent("download"), tap(page, '#m-menu [data-m="exp"]')]);
    if (!/^inn-sight-/.test(dl.suggestedFilename())) throw new Error("bestandsnaam: " + dl.suggestedFilename());
    const doc = JSON.parse((await import("node:fs")).readFileSync(await dl.path(), "utf8"));
    if (!/^Inn Sight \d+\.\d+\.\d+$/.test(doc.app) || doc.format !== "kevs-inn-maps" || !doc.map.terr || doc.map.objs.length !== 1 || !doc.map.bg) throw new Error("exportbestand: " + JSON.stringify({ app: doc.app, format: doc.format }));
    await page.locator("#m-menu").waitFor({ state: "hidden" });
    await tap(page, "#m-back"); await page.waitForFunction(() => window.__maps.view$() === "edit");
    // iPad portret en desktop: zijpaneel
    const orig = page.viewportSize();
    for (const vp of [{ width: 768, height: 1024 }, { width: 1280, height: 800 }]) {
      await page.setViewportSize(vp); await frame(); await frame();
      const hs = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (hs > 0) throw new Error(`${vp.width}: horizontaal scrollen ${hs}px`);
      await page.keyboard.press("0"); await frame();
      await tap(page, "#m-lib"); await page.locator("#m-lsheet").waitFor({ state: "visible" }); await frame(); await frame();
      const g = await page.evaluate(() => {
        const r = (id) => document.getElementById(id).getBoundingClientRect();
        return { s: r("m-lsheet"), top: r("m-stage").top, dock: r("m-dock").top, tab: [...document.querySelectorAll("#m-dock button")].some((b) => b.getAttribute("tabindex") === "-1"),
          strip: r("m-pstrip"), side: document.body.classList.contains("mside") };
      });
      if (Math.abs(g.s.right - vp.width) > 1 || Math.abs(g.s.width - 360) > 1 || Math.abs(g.s.top - g.top) > 1 || Math.abs(g.s.bottom - g.dock) > 1) throw new Error(`${vp.width}: zijpaneel ` + JSON.stringify(g.s));
      if (g.tab || !g.side) throw new Error(`${vp.width}: dock moet bereikbaar zijn naast het zijpaneel`);
      m = await M();
      const right = m.view.x + 10 * 48 * m.view.z;
      if (right > g.s.left + 1) throw new Error(`${vp.width}: passend maken links van het paneel: ${right} > ${g.s.left}`);
      // tandwiel wisselt in één tik van paneel (de dock ligt er niet onder)
      await tap(page, "#m-set"); await page.locator("#m-sheet").waitFor({ state: "visible" });
      if (await vis("#m-lsheet")) throw new Error(`${vp.width}: één paneel tegelijk`);
      await tap(page, '#m-tiles [data-id="table"]').catch(() => {}); // ligt onder het andere paneel: niets
      await snap(page, "wp65", "zijpaneel-" + vp.width);
      await tap(page, "#m-close"); await frame();
      if (await page.evaluate(() => document.body.classList.contains("mside"))) throw new Error(`${vp.width}: mside na sluiten`);
    }
    await page.setViewportSize(orig); await frame();
    // terug op telefoonbreedte: paneel van onderen, dock onder het paneel niet met Tab bereikbaar
    await tap(page, "#m-lib"); await page.locator("#m-lsheet").waitFor({ state: "visible" });
    const ph = await page.evaluate(() => ({ b: Math.round(document.getElementById("m-lsheet").getBoundingClientRect().bottom), vh: document.documentElement.clientHeight, tab: document.getElementById("m-set").getAttribute("tabindex") }));
    if (Math.abs(ph.b - ph.vh) > 1 || ph.tab !== "-1") throw new Error("telefoon: paneel van onderen " + JSON.stringify(ph));
    await tap(page, "#m-lclose");
  },
  speler: null, // eigen startpagina, zie START
  home: null, homeen: null, notfound: null, // WP30: publieke homepage per taal en de niet-gevonden-pagina (START)
  // WP40 (TA19): Spells-hint in Instellingen ingekort; "More" (44 px) klapt de rest uit. --shots=wp40: dicht en open.
  async wp40(page) {
    await SCEN.settings(page);
    await page.locator('details[data-sec="rules"] > summary').tap(); // WP54: Spells staat als subinstelling in Regels
    const sum = page.locator('#spells-sub .hmore > summary');
    await sum.waitFor({ state: "visible" });
    if (await page.locator('#spells-sub .hmore > p').isVisible()) throw new Error("rest van de Spells-hint staat al open");
    const h = await sum.evaluate((el) => el.getBoundingClientRect().height);
    if (h < 44) throw new Error(`"More" is ${h}px hoog (< 44)`);
    await snap(page, "wp40", "dicht");
    await sum.tap();
    await page.locator('#spells-sub .hmore > p').waitFor({ state: "visible" });
    await snap(page, "wp40", "open");
  },
  // WP41 (RE5, RE6a): zonder spelers "Monsters verrast" naast Start (≥ 44 px, Start blijft één tik, geen paneel); daarna
  // spellnamen buiten de tegels: keuzeregel tab Spell, gekozen schade-spell, regel onder de Effect-presets → #rsheet en focus terug.
  // --shots=wp41: dock met schakelaar, tab Spell, Effect-paneel.
  async wp41(page) {
    await SCEN.prep(page);
    await page.evaluate(async () => { const { app } = await import("/js/state.js"), { render } = await import("/js/ui/render.js");
      app.S.list = app.S.list.filter((c) => c.kind !== "pc"); render(); }); // voorbeeld zonder spelers
    const tog = page.locator("#sur-mon");
    await tog.waitFor({ state: "visible" });
    const h = await tog.evaluate((el) => el.getBoundingClientRect().height);
    if (h < 44) throw new Error(`"Monsters verrast" is ${h}px hoog (< 44)`);
    const over = await page.evaluate(() => { const r = document.querySelector("#dock .row.one"); return r.scrollWidth - r.clientWidth; });
    if (over > 0) throw new Error(`dock-rij met Verrast loopt ${over}px over`);
    await tog.tap();
    if ((await page.locator("#sur-mon").getAttribute("aria-pressed")) !== "true") throw new Error("Verrast-schakelaar gaat niet aan");
    await snap(page, "wp41", "dock");
    // speler erbij terwijl de schakelaar aan staat: Start opent het paneel en neemt "Monsters" over
    await page.evaluate(async () => { const { app } = await import("/js/state.js"), { render } = await import("/js/ui/render.js");
      app.S.list.push({ id: "wp41pc", name: "Aria", kind: "pc", init: null, dex: 2, ac: 15, hp: 20, max: 20, cond: [] }); render(); });
    if (await page.locator("#sur-mon").count()) throw new Error("schakelaar blijft staan met een speler");
    await tap(page, "#start"); await page.waitForSelector("#isheet .isheet");
    if ((await page.locator('#isheet [data-ia="sur"][data-v="mon"]').getAttribute("aria-pressed")) !== "true") throw new Error("paneel nam 'Monsters verrast' niet over");
    await tap(page, '#isheet .shead [data-ia="close"]'); await page.waitForSelector("#isheet", { state: "hidden" });
    await page.evaluate(async () => { const { app } = await import("/js/state.js"), { render } = await import("/js/ui/render.js");
      app.S.list = app.S.list.filter((c) => c.id !== "wp41pc"); render(); });
    if ((await page.locator("#sur-mon").getAttribute("aria-pressed")) !== "true") throw new Error("schakelaar niet meer aan na Annuleer");
    await tap(page, "#start");
    await page.waitForSelector("#next");
    if (await page.locator("#isheet .isheet").count()) throw new Error("initiative-paneel opende zonder spelers");
    const sur = await page.evaluate(async () => { const { app } = await import("/js/state.js");
      return app.S.round === 2 || app.S.list.filter((c) => c.kind === "monster" && c.hp > 0).every((c) => c.sur); }); // iedereen verrast: ronde 1 vervalt
    if (!sur) throw new Error("niet alle monsters verrast na Start");
    // a) tab Spell: naam in de keuzeregel
    await tap(page, "#aoe"); await page.waitForSelector("#asheet .asheet");
    await tap(page, '#asheet [data-ao="tab"][data-v="spell"]'); await tap(page, '#asheet [data-ao="sp"][data-v="0"]');
    const link = page.locator("#s-name .spl");
    await link.waitFor({ state: "visible" });
    const lh = await link.evaluate((el) => el.getBoundingClientRect().height);
    if (lh < 44) throw new Error(`spellnaam boven #s-info is ${lh}px hoog (< 44)`);
    await snap(page, "wp41", "spell");
    await link.tap(); await page.waitForSelector("#rsheet .rsheet");
    await tap(page, '#rsheet .shead [data-rsh="close"]'); await page.waitForSelector("#rsheet", { state: "hidden" });
    await page.evaluate(async () => (await import("/js/ui/render.js")).paintAoe()); // een paint na het sluiten: de link blijft staan, focus blijft
    if (!(await page.evaluate(() => document.activeElement?.matches("#s-name .spl")))) throw new Error("focus niet terug op de spellnaam");
    // b) tab Schade: gekozen schade-spell
    await tap(page, '#asheet [data-ao="tab"][data-v="dmg"]');
    await page.fill("#a-q", "fireb"); await tap(page, '#a-sugg [data-ao="dsp"]');
    await page.locator(".dsel .spl").waitFor({ state: "visible" });
    await tap(page, '#asheet .shead [data-ao="close"]'); await page.waitForSelector("#asheet", { state: "hidden" });
    // c) Effect-paneel op de open kaart: regel onder het grid, tegel ongewijzigd
    await page.locator('#order .c.k.open [data-a="panel"][data-p="eff"]').first().tap();
    const el = page.locator("#order .efflinks .spl").first();
    await el.waitFor({ state: "visible" });
    await el.evaluate((x) => x.scrollIntoView({ block: "center" }));
    await snap(page, "wp41", "effect");
    await el.tap(); await page.waitForSelector("#rsheet .rsheet");
  },
  // WP52 (G1): conditie-uitleg volgens de tafelregels (2024 nog alleen via de stand: de keuze komt in WP54)
  async wp52(page) {
    await SCEN.fight(page);
    await page.evaluate(async () => { const { app } = await import("/js/state.js"), { render } = await import("/js/ui/render.js");
      app.S.rules = "2024"; const c = app.S.list.find((x) => x.id === app.S.active); c.cond = [...c.cond, "Grappled"]; render(); });
    const chip = page.locator('#order .c.k.open [data-cinfo="Grappled"]').first();
    await chip.waitFor({ state: "visible" });
    await chip.evaluate((x) => x.scrollIntoView({ block: "center" }));
    await chip.tap(); await page.waitForSelector("#csheet .csheet");
    const n = await page.locator("#csheet .rtext p").count();
    if (n !== 3) throw new Error(`Grappled 2024: ${n} regels uitleg, verwacht 3`);
    await snap(page, "wp52", "grappled");
    await tap(page, '#csheet .shead [data-csh="close"]'); await page.waitForSelector("#csheet", { state: "hidden" });
  },
  // --shots=wp42: eigen notitie bij een niet-SRD-spell (Toll the Dead; Hex staat in SRD 5.2): toevoegen, bewaard na herladen, in de export, wissen + Undo.
  async wp42(page) {
    await SCEN.prep(page);
    const openHex = async () => {
      await page.evaluate(() => { const b = document.createElement("button"); b.type = "button"; b.dataset.spell = "Toll the Dead"; b.id = "wp42hex";
        b.textContent = "Spell"; b.style.cssText = "position:fixed;top:0;left:0;width:44px;height:44px"; document.body.appendChild(b); });
      await tap(page, "#wp42hex"); await page.waitForSelector("#rsheet .rsheet");
    };
    await openHex();
    const add = page.locator('#rsheet [data-rnote="add"]');
    await add.waitFor({ state: "visible" });
    if ((await add.evaluate((el) => el.getBoundingClientRect().height)) < 44) throw new Error("Add note < 44px");
    await add.tap();
    if (!(await page.evaluate(() => document.activeElement?.id === "r-note"))) throw new Error("focus niet in het tekstveld");
    await page.keyboard.press("Escape"); // alleen de bewerkstand dicht
    if (!(await page.locator("#rsheet .rsheet").count()) || (await page.locator("#r-note").count())) throw new Error("Escape sloot niet alleen de bewerkstand");
    await tap(page, '#rsheet [data-rnote="add"]');
    await page.fill("#r-note", "Bonus action · 90 ft\n1d6 necrotic on hit");
    await snap(page, "wp42", "edit");
    await tap(page, '#rsheet [data-rnote="save"]');
    await page.locator("#rsheet .rntxt").waitFor({ state: "visible" });
    if (await page.locator('#rsheet [data-rnote="add"]').count()) throw new Error("Add note staat er nog na opslaan");
    await snap(page, "wp42", "note");
    const edit = page.locator('#rsheet [data-rnote="edit"]');
    if ((await edit.evaluate((el) => el.getBoundingClientRect().height)) < 44) throw new Error("Edit < 44px");
    // herladen: notitie blijft (IndexedDB), en staat in de export. TS6: eerst wachten tot de schrijfactie in IndexedDB
    // staat; direct herladen breekt een lopende transactie af (de oude waarde blijft, ± 1 op 12 rood). Een mens
    // herlaadt nooit binnen die paar ms; de test moet dus op de opslag wachten, niet op een timeout.
    await idbHas(page, "spellNotes", (v) => v?.["toll the dead"]?.t === "Bonus action · 90 ft\n1d6 necrotic on hit");
    await page.reload(); await page.waitForSelector("#start");
    await openHex();
    await page.locator("#rsheet .rntxt").waitFor({ state: "visible" });
    const exp = await page.evaluate(async () => { const { app } = await import("/js/state.js"), { buildExport } = await import("/js/backup.js"); return buildExport(app); });
    if (exp.version !== 3 || exp.spellNotes?.["toll the dead"]?.t !== "Bonus action · 90 ft\n1d6 necrotic on hit") throw new Error("notitie niet in de export (versie 3)");
    // leeg opslaan = wissen, met Undo in de melding
    await tap(page, '#rsheet [data-rnote="edit"]'); await page.fill("#r-note", "");
    await tap(page, '#rsheet [data-rnote="save"]');
    await page.waitForSelector("#toast-noteundo");
    if (!(await page.locator('#rsheet [data-rnote="add"]').count())) throw new Error("na wissen geen Add note");
    await tap(page, "#toast-noteundo");
    await page.locator("#rsheet .rntxt").waitFor({ state: "visible" });
    // SRD-spell: geen notitieknop
    await tap(page, '#rsheet .shead [data-rsh="close"]'); await page.waitForSelector("#rsheet", { state: "hidden" });
    await page.evaluate(() => { const b = document.getElementById("wp42hex"); b.dataset.spell = "Fireball"; });
    await tap(page, "#wp42hex"); await page.waitForSelector("#rsheet .rtext");
    if (await page.locator('#rsheet [data-rnote]').count()) throw new Error("notitieknop bij een SRD-spell");
    await tap(page, '#rsheet .shead [data-rsh="close"]');
    await page.evaluate(() => document.getElementById("wp42hex")?.remove());
  },
  // WP43 (TS1): PDF-import met het zelf gehoste pdf.js, eerst gewoon online, daarna offline via de service worker
  // (eigen cache VENDOR); geen verzoek naar een andere host.
  async wp43(page, base) {
    const pdf = join(ROOT, "tests/fixtures/ddb-sheet.pdf");
    const importPdf = async (p, where) => {
      await p.locator('#dock [data-prep="pc"]').first().tap(); await p.waitForSelector("#f-pc", { state: "visible" });
      await p.setInputFiles("#pc-pdf", pdf);
      await p.waitForFunction(() => document.getElementById("pc-name")?.value === "Testa Vonk", null, { timeout: 15000 })
        .catch(async () => { throw new Error(`${where}: PDF niet ingelezen (${await p.evaluate(() => document.getElementById("pc-sheetinfo")?.textContent)})`); });
    };
    const foreign = [];
    page.on("request", (r) => { const u = new URL(r.url()); if (!/^(127\.0\.0\.1|localhost)$/.test(u.hostname) && u.protocol.startsWith("http")) foreign.push(u.host); });
    await SCEN.prep(page);
    await importPdf(page, "online");
    if (foreign.length) throw new Error("verzoek naar een andere host: " + foreign.join(", "));
    const ctx = await page.context().browser().newContext({ serviceWorkers: "allow", locale: "en-US", hasTouch: true, viewport: page.viewportSize() });
    await ctx.addInitScript(() => { try { localStorage.setItem("it-tour", "pf"); } catch { /* geen opslag */ } });
    const p = await ctx.newPage();
    try {
      await p.goto(base + "/initiative/"); await p.waitForSelector("#dock");
      const ready = await p.evaluate(async () => {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;
        for (let i = 0; i < 100 && !navigator.serviceWorker.controller; i++) await new Promise((r) => setTimeout(r, 100));
        const c = await caches.open("initiative-tafel-pdfjs-3.11.174");
        return !!navigator.serviceWorker.controller && !!(await c.match("/vendor/pdfjs/pdf.worker.js")) && !!(await c.match("/vendor/pdfjs/pdf.js"));
      });
      if (!ready) throw new Error("service worker of pdf.js-cache niet klaar");
      OFFLINE = true;
      await p.reload(); await p.waitForSelector("#dock");
      await p.locator("#welcome-sample").tap(); await p.waitForSelector("#start:not([disabled])");
      const workers = []; p.on("worker", (w) => workers.push(new URL(w.url()).pathname)); // WP77: ook offline een echte Worker
      await importPdf(p, "offline");
      if (!workers.includes("/vendor/pdfjs/pdf.worker.js")) throw new Error("offline: pdf.js draait niet in een echte Worker");
    } finally { OFFLINE = false; await ctx.close(); }
  },
  // WP77 (K4): PDF-import met CPU-throttling (4×, via CDP): pdf.js parset in een echte Worker (geen "fake worker",
  // het worker-script niet als <script>), de hoofdthread blijft vrij (langste longtask) en de rAF-teller loopt door.
  async wp77(page) {
    const pdf = join(ROOT, "tests/fixtures/ddb-sheet.pdf"), workers = [], fake = [];
    page.on("worker", (w) => workers.push(new URL(w.url()).pathname));
    page.on("console", (m) => { if (/fake worker/i.test(m.text())) fake.push(m.text()); });
    await SCEN.pcform(page);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    try {
      await page.evaluate(() => {
        const s = (window.__wp77 = { frames: 0, long: 0, run: true });
        try { new PerformanceObserver((l) => { for (const e of l.getEntries()) s.long = Math.max(s.long, e.duration); }).observe({ type: "longtask" }); } catch { /* geen longtask-api */ }
        const tick = () => { if (s.run) { s.frames++; requestAnimationFrame(tick); } };
        requestAnimationFrame(tick);
      });
      const t0 = Date.now();
      await page.setInputFiles("#pc-pdf", pdf);
      await page.waitForFunction(() => document.getElementById("pc-name")?.value === "Testa Vonk", null, { timeout: 30000 });
      const ms = Date.now() - t0;
      const s = await page.evaluate(() => { const s = window.__wp77; s.run = false; return { frames: s.frames, long: Math.round(s.long), tag: !!document.querySelector('script[src*="pdf.worker"]') }; });
      if (page.viewportSize().width === 320) console.log(`  wp77: import ${ms} ms (CPU 4×), langste blokkade ${s.long} ms, ${Math.round(s.frames / (ms / 1000))} fps, Worker: ${workers.join(", ") || "geen"}`);
      if (process.env.WP77_MEASURE) return; // alleen meten (vóór/na-vergelijking)
      if (!workers.some((u) => u.startsWith("/vendor/pdfjs/pdf.worker"))) throw new Error("pdf.js draait niet in een echte Worker");
      if (fake.length) throw new Error("pdf.js: " + fake[0]);
      if (s.tag) throw new Error("worker-script als <script> geladen");
      if (!s.frames) throw new Error("geen enkel frame tijdens de import");
      if (s.long >= 500) throw new Error(`hoofdthread ${s.long} ms geblokkeerd (gemeten ± 220 ms, met fake worker ± 750 ms)`);
    } finally { await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 }); await cdp.detach(); }
  },
  // WP23: formulieren met de statische tekst (met --i18n=debug de Engelse pagina)
  async pcform(page) { await SCEN.prep(page); await tap(page, '#dock [data-prep="pc"]'); await page.waitForSelector("#f-pc", { state: "visible" }); },
  // WP24: Party met een lid (Bijwerken/Uit party), moeilijkheid met uitleg en levelveld, snel toevoegen met het toevoegblok
  async party(page) {
    await SCEN.pcform(page);
    await page.fill("#pc-name", "Aurelianus Vandermeer");
    if (!(await page.isChecked("#pc-party"))) await page.locator("#pc-party").check();
    await tap(page, "#pc-add");
    await page.waitForSelector("#order .c.k.pc >> nth=2");
    await page.$eval('#psheet [data-prep="close"]', (b) => b.click()); await page.waitForSelector("#psheet", { state: "hidden" }); // melding kan boven de knop liggen
    await tap(page, '#dock [data-prep="party"]'); await page.waitForSelector("#party-panel .pm", { state: "visible" });
  },
  async diff(page) {
    await SCEN.pcform(page); await page.fill("#pc-name", "Zonder Level"); await tap(page, "#pc-add"); // speler zonder level: veld in de uitleg
    await page.$eval('#psheet [data-prep="close"]', (b) => b.click()); await page.waitForSelector("#psheet", { state: "hidden" });
    await tap(page, '[data-enc="difftog"]'); await page.waitForSelector(".dwhy [data-dlvl]");
  },
  // WP53 (G1): moeilijkheid volgens 2024 (XP-budget; de keuze komt in WP54, hier via de stand); levels gezet, uitleg open
  async wp53(page) {
    await SCEN.prep(page);
    await page.evaluate(async () => { const { app } = await import("/js/state.js"), { render } = await import("/js/ui/render.js");
      app.S.rules = "2024"; for (const c of app.S.list) if (c.kind === "pc") c.lvl = 3; for (const m of app.party) m.lvl = 3; render(); });
    await tap(page, '[data-enc="difftog"]'); await page.waitForSelector(".dbanner .dwhy");
    const chip = (await page.locator(".dbanner .dchip").textContent()).trim();
    const ok = await page.evaluate(async () => { const { t } = await import("/js/i18n/boot.js"); return ["low", "moderate", "high", "over"].map((k) => t("init.diff." + k)); });
    if (!ok.includes(chip)) throw new Error(`WP53: chip "${chip}" is geen 2024-oordeel`);
    if (/ × /.test(await page.locator(".dbanner .dwhy").textContent())) throw new Error("WP53: multiplier in de 2024-uitleg");
    const tips = await page.evaluate(async () => { const { deadlyText } = await import("/js/ui/encounters.js"), { t } = await import("/js/i18n/boot.js");
      const T = [deadlyText({ one: true }, "2024"), deadlyText({ stays: true }, "2024"), deadlyText({ name: "Ogre", rating: 2 }, "2024"), deadlyText({ name: "Ogre", rating: 2 })];
      return { T, over: t("init.diff.overText"), high: t("init.diff.high"), one: t("init.diff.overOne"), stays: t("init.diff.overStays"), deadly: t("init.diff.deadly") }; });
    const [one, stays, less, old] = tips.T;
    if (!one.startsWith(tips.over) || !one.endsWith(tips.one) || !stays.endsWith(tips.stays) || !less.startsWith(tips.over) || !less.includes(tips.high) || !old.startsWith(tips.deadly) || !old.includes("Hard"))
      throw new Error(`WP53: adviesregels ${JSON.stringify(tips.T)}`);
    await snap(page, "wp53", "uitleg");
  },
  async qadd(page) { await SCEN.fight(page); await tap(page, "#qadd"); await page.fill("#q-q", "gob"); await page.waitForSelector("#q-blk .qrow"); },
  // WP25: Gevecht-panelen uit de catalogus (AoE/Spell, aanvalspaneel, initiative, logboek, sneltoetsen, open kaart met ⋯)
  async aoe(page) { await SCEN.fight(page); await tap(page, "#aoe"); await page.waitForSelector("#asheet .asheet"); await page.fill("#a-dmg", "28"); await page.locator("#a-dmg").blur(); },
  async spell(page) { await SCEN.aoe(page); await tap(page, '#asheet [data-ao="tab"][data-v="spell"]'); await tap(page, '#asheet [data-ao="sp"][data-v="0"]'); await page.waitForSelector("#a-list .at"); },
  async atk(page) {
    await SCEN.fight(page);
    const mon = page.locator("#order .c.k.mon").first();
    if (!(await mon.evaluate((el) => el.classList.contains("open")))) await mon.locator(".khead").tap();
    const fold = mon.locator('[data-a="atk-open"]').first(); if (await fold.count()) await fold.tap();
    await mon.locator("[data-atk]").first().tap(); await page.waitForSelector("#xsheet .xsheet");
    await page.locator("#xsheet [data-xa=tgt]").first().tap(); await page.waitForSelector("#xsheet .xhit");
  },
  // WP48: SRD 5.2-monster (Aboleth, ed 2024) aan de beurt; aanvalspaneel met een vaste conditie als hint ("Grappled (escape DC 14)")
  async wp48(page) {
    await SCEN.fight(page);
    await page.evaluate(async () => {
      const D = await import("/js/data/monsters.js"); if ((await D.loadSrd24()) !== "ok") throw new Error("SRD 5.2 niet geladen");
      const { addMonsters } = await import("/js/ui/actions.js"), { app } = await import("/js/state.js");
      addMonsters("Aboleth", 1, "avg", "each", true, null, false, false, "2024");
      app.S.active = app.S.list.find((c) => c.ed === "2024").id;
      (await import("/js/ui/render.js")).render();
    });
    const mon = page.locator("#order .c.k.turn");
    await mon.locator('[data-atk="Tentacle"]').first().tap(); await page.waitForSelector("#xsheet .xsheet");
    await page.locator("#xsheet [data-xa=tgt]").first().tap(); await page.waitForSelector("#xsheet .xhit");
    if (await page.locator('#xsheet [data-xa="force"]').count()) await tap(page, '#xsheet [data-xa="force"]');
    await page.waitForSelector("#xsheet .xrider");
    const txt = await page.locator("#xsheet .xrider").first().innerText();
    if (!/Grappled|Gegrepen/.test(txt) || !/14/.test(txt)) throw new Error("rider-hint ontbreekt: " + txt);
  },
  // WP49 (V4): aan een 2014-tafel geeft "zombie" alleen SRD 5.1; "Zoek in SRD 5.2 (2024) ▸" (≥ 44 px) zet het zoekwoord 2024 in het veld,
  // de 2024-Zombie heeft de tag en wordt met ed "2024" en zijn eigen statblock toegevoegd; opgeslagen encounter houdt hem 2024 (marker in de lijst).
  // --shots=g1-mon: lijst 2014, lijst 2024, encounters.
  async "g1-mon"(page) {
    await SCEN.monster(page);
    await page.locator("#mon-q").fill("zombie");
    await page.waitForSelector('#mon-list [data-pick="Zombie"]');
    if (await page.locator("#mon-list .tag").count()) throw new Error("2014-tafel toont al een editietag");
    const go = page.locator("#mon-ed .edgo");
    const h = await go.evaluate((el) => el.getBoundingClientRect().height);
    if (h < 44) throw new Error(`editieregel is ${h}px hoog (< 44)`);
    await snap(page, "g1-mon", "2014");
    await go.tap();
    if ((await page.locator("#mon-q").inputValue()) !== "zombie 2024") throw new Error("zoekwoord 2024 niet in het veld");
    const k24 = "Zombie\u20632024";
    await page.waitForSelector(`#mon-list [data-pick="${k24}"] .tag`);
    if (await page.locator('#mon-list [data-pick="Zombie"]').count()) throw new Error("met 2024 nog SRD 5.1 in de lijst");
    await page.locator(`#mon-list [data-pick="${k24}"]`).tap();
    await page.waitForSelector("#mon-prev .mprev .tag");
    await snap(page, "g1-mon", "2024");
    await tap(page, "#mon-add");
    const st = await page.evaluate(async () => { const { app } = await import("/js/state.js"), z = app.S.list.at(-1); return { ed: z.ed, ref: z.ref, hp: z.max, ib: z.initBonus }; });
    if (st.ed !== "2024" || st.ref !== "Zombie" || st.hp !== 15 || st.ib !== -2) throw new Error("toegevoegd: " + JSON.stringify(st));
    await page.evaluate(async () => { const { app, saveEncounters } = await import("/js/state.js"), E = await import("/js/rules/encounters.js");
      app.encounters = [E.fromList(app.S.list, { id: "g1", name: "Graf", now: Date.now() })]; saveEncounters(); });
    await page.locator('#p-montabs [data-prep="enc"]').tap();
    await page.waitForSelector("#enc-panel .encrow");
    const sm = await page.locator("#enc-panel .encrow .einfo small").first().innerText();
    if (!/· 2024 ·/.test(sm)) throw new Error("encountermarker ontbreekt: " + sm);
    await snap(page, "g1-mon", "enc");
  },
  // WP49 (B4): SRD 5.2 kan niet laden → inladen meldt "Zombie · 2024" en voegt hem niet als 2014 toe; de editieregel toont de fout
  async "g1-mon-fail"(page) {
    await page.route("**/data/monsters-2024.json", (r) => r.abort());
    await SCEN.monster(page);
    await page.evaluate(async () => { const { app, saveEncounters } = await import("/js/state.js");
      app.encounters = [{ id: "g2", name: "Graf", updatedAt: Date.now(), notes: "", monsters: [{ ref: "Zombie", n: 2, ed: "2024" }, { ref: "Goblin", n: 1 }] }]; saveEncounters(); });
    await page.locator('#p-montabs [data-prep="enc"]').tap();
    await page.waitForSelector('#enc-panel [data-enc="load"]');
    const n0 = await page.evaluate(async () => (await import("/js/state.js")).app.S.list.length);
    await page.locator('#enc-panel [data-enc="load"]').first().tap();
    const rep = page.locator('#enc-panel [data-enc="load-add"]'); // voorbeeld staat aan tafel: Toevoegen
    if (await rep.count()) await rep.first().tap();
    await page.waitForFunction(() => /Zombie · 2024/.test(document.querySelector("#toast")?.innerText || ""));
    const st = await page.evaluate(async () => { const { app } = await import("/js/state.js"); return app.S.list.map((c) => [c.ref, c.ed || ""]); });
    if (st.some(([r]) => r === "Zombie")) throw new Error("Zombie toch toegevoegd: " + JSON.stringify(st));
    if (st.length !== n0 + 1) throw new Error("Goblin niet ingeladen: " + JSON.stringify(st));
  },
  async initp(page) { await SCEN.prep(page); await tap(page, "#start"); await page.waitForSelector("#isheet .isheet"); },
  // WP76 (K2): voorbeeldmonsters als "vorig gevecht" + één nieuw monster → Start → "Oude wissen en starten": het
  // initiative-paneel telt alleen het nieuwe monster (1) en "Verrast: monsters" blijft aan. --shots=wp76: paneel.
  async wp76(page) {
    await SCEN.einde(page); await tap(page, '#esheet .shead [data-end="close"]'); await page.waitForSelector("#esheet .esheet", { state: "hidden" });
    await page.evaluate(async () => { const { app } = await import("/js/state.js"), { render } = await import("/js/ui/render.js");
      for (const c of app.S.list) if (c.kind === "monster") c.init = 30; // oude monsters: aangepast, dus niet "fresh"
      app.S.list.push({ id: "wp76m", name: "Ogre", kind: "monster", init: 9, dex: -1, ac: 11, hp: 59, max: 59, cond: [] },
        { id: "wp76n", name: "Orc", kind: "monster", init: 14, roll: 13, dex: 1, ac: 13, hp: 15, max: 15, cond: [] }); render(); });
    await tap(page, "#start"); await tap(page, "#old-start"); await page.waitForSelector("#isheet .isheet");
    if (!(await page.locator('#isheet [data-ia="mroll"]').count())) throw new Error("Houden | Opnieuw rollen ontbreekt (Orc is fresh)");
    await tap(page, '#isheet [data-ia="mroll"][data-v="roll"]');
    const hint = await page.locator("#isheet .hint").first().innerText();
    if (!/\(1\)/.test(hint)) throw new Error("monster-hint telt oude monsters mee: " + hint); // init.ini.kept: alleen de Ogre
    if (await page.locator('#isheet [data-ia="sur"][data-v="mon"][disabled]').count()) throw new Error("Verrast: monsters uit terwijl er een monster blijft");
    await snap(page, "wp76", "panel");
  },
  async logp(page) { await SCEN.fight(page); await tap(page, "#logopen"); await page.waitForSelector("#gsheet .gsheet"); },
  async keyhelp(page) { await SCEN.fight(page); await page.evaluate(async () => (await import("/js/ui/keys.js")).openKeys()); await page.waitForSelector("#hsheet .hsheet"); },
  async meer(page) { await SCEN.fight(page); await page.locator('#order .c.k.open [data-a="panel"][data-p="more"]').first().tap(); await page.waitForSelector("#order .kpanel.more"); },
  // WP26: Encounters-tab met een opgeslagen encounter en menu, samenvatting na Gevecht afronden, rondleiding (deel f)
  async enc(page) {
    await SCEN.monster(page); await tap(page, '#p-montabs [data-prep="enc"]'); await page.waitForSelector("#enc-panel .encsave");
    await tap(page, '#enc-panel [data-enc="save-open"]'); await page.fill("#enc-name", "Hinderlaag bij de oude brug"); await tap(page, '#enc-panel [data-enc="save-go"]');
    await page.waitForSelector("#enc-panel .encrow"); await tap(page, '#enc-panel [data-enc="menu"]'); await page.waitForSelector("#enc-panel .encmenu");
  },
  // WP69: kaart uit Inn Sight kiezen bij een encounter (verwijzing). Twee kaarten in kevs-inn-maps; encounter A heeft kaart 1,
  // encounter B een kaart die hier niet staat. Kiezer (rijen ≥ 44 px), kiezen + Opslaan bewaart { id, name }, "Bewerken in
  // Inn Sight" zet maps-last; B toont "ontbreekt" met Kiezen | Kaartbestand importeren | Weghalen. --shots=wp69: gekozen, kiezer, ontbreekt.
  async wp69(page) {
    const wait = (sel) => page.waitForSelector(sel).catch(async () => { throw new Error(`wacht ${sel}: ${(await page.locator("#enc-panel").innerText()).slice(0, 300)}`); });
    await SCEN.monster(page);
    await page.evaluate(async () => {
      const st = await import("/js/maps/store.js"), M = await import("/js/maps/model/map.js");
      await st.putMap({ ...M.newMap({ id: "kaart00001", name: "Grot der goblins" }), grid: { type: "square", cols: 20, rows: 15 } });
      await st.putMap({ ...M.newMap({ id: "kaart00002", name: "Oude brug bij de rivier met een heel lange naam" }), grid: { type: "hex", cols: 12, rows: 9 } });
      const { app, saveEncounters } = await import("/js/state.js"), now = Date.now();
      app.encounters = [{ id: "ea", name: "Grot", updatedAt: now, notes: "", monsters: [{ ref: "Goblin", n: 3 }], map: { id: "kaart00001", name: "Oude naam" } },
        { id: "eb", name: "Brug", updatedAt: now - 1, notes: "", monsters: [{ ref: "Goblin", n: 1 }], map: { id: "elders0001", name: "Kaart van elders" } }];
      saveEncounters();
    });
    await tap(page, '#p-montabs [data-prep="enc"]'); await wait("#enc-panel .encrow");
    const sm = await page.locator("#enc-panel .encrow .einfo small").first().innerText();
    if (sm.split(" · ").length !== 3) throw new Error("kaartmarker ontbreekt: " + sm); // "3 monsters · Kaart · 30 okt"
    const edit = async (i) => { await page.locator('#enc-panel [data-enc="menu"]').nth(i).tap(); await tap(page, '#enc-panel [data-enc="edit"]'); await wait("#ee-name"); };
    await edit(0);
    await page.waitForFunction(() => /20×15/.test(document.querySelector("#enc-panel .emap")?.innerText || ""));
    if (!/Grot der goblins/.test(await page.locator("#enc-panel .emap").innerText())) throw new Error("actuele kaartnaam niet getoond");
    await page.locator('#enc-panel a[data-encmap="sight"]').evaluate((a) => a.addEventListener("click", (e) => e.preventDefault())); // geen nieuw tabblad in de check
    await page.locator('#enc-panel a[data-encmap="sight"]').tap();
    if ((await page.evaluate(() => localStorage.getItem("maps-last"))) !== "kaart00001") throw new Error("maps-last niet gezet");
    await snap(page, "wp69", "gekozen");
    await tap(page, '#enc-panel [data-encmap="open"]');
    await wait('#enc-panel .emaps [data-encmap="pick"]');
    const hs = await page.locator('#enc-panel .emaps [data-encmap="pick"]').evaluateAll((b) => b.map((x) => x.getBoundingClientRect().height));
    if (hs.length !== 2 || hs.some((h) => h < 44)) throw new Error("kiezer: " + JSON.stringify(hs));
    await snap(page, "wp69", "kiezer");
    await page.locator('#enc-panel .emaps [data-id="kaart00002"]').tap();
    await wait("#ee-map-change");
    await tap(page, '#enc-panel [data-enc="edit-go"]');
    const m = await page.evaluate(async () => (await import("/js/state.js")).app.encounters.find((e) => e.id === "ea").map);
    if (!m || m.id !== "kaart00002" || !/Oude brug/.test(m.name)) throw new Error("kaart niet bewaard: " + JSON.stringify(m));
    await wait("#enc-panel .encrow");
    await edit(1);
    await wait('#enc-panel .confirmbox [data-file="ee-map-file"]');
    if (!/Kaart van elders/.test(await page.locator("#enc-panel .confirmbox").innerText())) throw new Error("bewaarde naam ontbreekt");
    await snap(page, "wp69", "ontbreekt");
    await tap(page, '#enc-panel .confirmbox [data-encmap="rm"]');
    await wait('#enc-panel button[data-encmap="open"].encsave');
    // terugval: kaartbestand importeren → in de Inn Sight-bibliotheek (nieuwe id, unieke naam) en meteen gekozen; kapot bestand = foutregel
    const json = await page.evaluate(async () => {
      const F = await import("/js/maps/model/file.js"), M = await import("/js/maps/model/map.js");
      const { parts } = F.buildParts({ ...M.newMap({ id: "kaart00009", name: "Grot der goblins" }), grid: { type: "hex", cols: 8, rows: 6 } }, new Map(), { app: "Inn Sight" });
      return new Blob(parts).text();
    });
    await tap(page, '#enc-panel [data-encmap="open"]');
    await wait('#enc-panel [data-file="ee-map-file"]');
    await page.setInputFiles("#ee-map-file", { name: "kapot.json", mimeType: "application/json", buffer: Buffer.from("{nee") });
    await wait("#enc-panel .encerr");
    await page.setInputFiles("#ee-map-file", { name: "grot.json", mimeType: "application/json", buffer: Buffer.from(json) });
    await page.waitForFunction(() => /8×6/.test(document.querySelector("#enc-panel .emap")?.innerText || ""));
    const imp = await page.evaluate(async () => { const st = await import("/js/maps/store.js"), L = await st.listMaps(), { ui } = await import("/js/ui/render.js");
      return { n: L.length, map: ui.encEdit.map, names: L.map((m) => m.name), err: !!document.querySelector("#enc-panel .encerr"), focus: document.activeElement?.id }; });
    if (imp.n !== 3 || !imp.map || imp.map.id === "kaart00009" || imp.names.filter((x) => /^Grot der goblins/.test(x)).length !== 2 || imp.err) throw new Error("import: " + JSON.stringify(imp));
    if (imp.focus !== "ee-map-change") throw new Error("focus na import: " + imp.focus);
  },
  // WP71: spelerskaart op hetzelfde apparaat. Schakelaar "Toon aan spelers" linksonder in de viewer (≥ 44 px, naast + en −,
  // niet eroverheen); aan = knop in de strip "Kaart · gedeeld"; spelersvenster (telefoon en tv) toont het platte beeld:
  // telefoon onder de vaste kop (≤ 45vh, niet breder dan het scherm), tv links vast met de lijst rechts (één kolom, rijen
  // passen). Viewer dicht = blijft gedeeld; uit = kaart weg bij de spelers; monsters gewist = niet meer gedeeld.
  // Eindigt met de viewer open en gedeeld (meting van de DM-pagina). --shots=wp71: viewer, telefoon, tv.
  async wp71(page, base) {
    await SCEN.fight(page);
    await page.evaluate(async () => {
      const st = await import("/js/maps/store.js"), M = await import("/js/maps/model/map.js");
      await st.putMap({ ...M.newMap({ id: "kaart00001", name: "Grot der goblins" }), grid: { type: "square", cols: 20, rows: 15 }, objs: [{ id: "o1", asset: "table", x: 5, y: 5 }, { id: "o2", asset: "tree", x: 12, y: 8 }] });
      const { app } = await import("/js/state.js"), F = await import("/js/rules/fight.js"), R = await import("/js/ui/render.js");
      F.addEnc(app.S, { name: "Grot", notes: "", map: { id: "kaart00001", name: "Grot der goblins" } }, true);
      R.render();
    });
    const lang = await page.evaluate(() => document.documentElement.lang);
    const openPv = async (w, h) => {
      const pv = await page.context().newPage();
      await pv.setViewportSize({ width: w, height: h });
      await pv.goto(base + pathFor(lang, "/initiative/player/"));
      await pv.waitForSelector("#pv-list .pvc");
      return pv;
    };
    const pv = await openPv(page.viewportSize().width, 740);
    if (!(await pv.locator("#pv-map").isHidden())) throw new Error("kaart op het spelersscherm zonder delen");
    await tap(page, '#order [data-enc="map"]');
    await page.waitForSelector('#mapview .mvtoon:not([hidden]) [data-mv="pv"]');
    const tg = await page.evaluate(() => { const b = document.querySelector('#mapview [data-mv="pv"]').getBoundingClientRect(), z = document.querySelector("#mapview .mvzoom").getBoundingClientRect(), h = document.querySelector("#mapview .mvthint").getBoundingClientRect();
      return { h: b.height, overlap: !(b.right <= z.left || h.right <= z.left) ? 1 : 0, pressed: document.querySelector('#mapview [data-mv="pv"]').classList.contains("on") }; });
    if (tg.h < 44 || tg.overlap || tg.pressed) throw new Error("schakelaar: " + JSON.stringify(tg));
    await tap(page, '#mapview [data-mv="pv"]');
    await page.waitForFunction(() => document.querySelector('#mapview [data-mv="pv"]').classList.contains("on") && document.querySelector('#order [data-enc="map"]')?.classList.contains("on"));
    await pv.waitForFunction(() => { const i = document.querySelector("#pv-mapimg"); return !document.querySelector("#pv-map").hidden && i.complete && i.naturalWidth > 100; }, null, { timeout: 8000 });
    await snap(page, "wp71", "viewer");
    const ph = await pv.evaluate(() => { const r = document.querySelector("#pv-mapimg").getBoundingClientRect(), s = document.querySelector("#pv-stick").getBoundingClientRect();
      return { h: r.height, max: innerHeight * 0.45 + 1, below: r.top >= s.bottom - 1, hs: document.documentElement.scrollWidth - innerWidth, nat: document.querySelector("#pv-mapimg").naturalWidth }; });
    if (ph.h > ph.max || !ph.below || ph.hs > 0 || ph.nat > 2048) throw new Error("spelersscherm telefoon: " + JSON.stringify(ph));
    if (SHOTS.has("wp71") && page.viewportSize().width === 320) await pv.screenshot({ path: join(ROOT, "shots", `wp71-telefoon-${lang}-320-${await pv.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")}.png`) });
    const tv = await openPv(1280, 720);
    await tv.waitForFunction(() => document.body.classList.contains("tv") && document.body.classList.contains("map") && document.querySelector("#pv-mapimg").naturalWidth > 100, null, { timeout: 8000 });
    const tl = await tv.evaluate(() => { const m = document.querySelector("#pv-map").getBoundingClientRect(), l = document.querySelector("#pv-list").getBoundingClientRect();
      return { left: m.left, mapR: m.right, listL: l.left, cols: document.body.classList.contains("cols"), hs: document.documentElement.scrollWidth - innerWidth,
        wide: [...document.querySelectorAll("#pv-list .pvc")].filter((r) => r.scrollWidth - r.clientWidth > 1).length,
        one: new Set([...document.querySelectorAll("#pv-list .pvc")].map((r) => Math.round(r.getBoundingClientRect().left))).size,
        hidden: [...document.querySelectorAll("#pv-list .pvc .nm")].filter((n) => n.scrollWidth > n.clientWidth + 1 || n.scrollHeight > n.clientHeight + 1).map((n) => n.textContent) }; });
    if (tl.left !== 0 || tl.listL < tl.mapR - 1 || !tl.cols || tl.hs > 0 || tl.wide || tl.one !== 1 || tl.hidden.length) throw new Error("tv: " + JSON.stringify(tl));
    if (SHOTS.has("wp71") && page.viewportSize().width === 320) await tv.screenshot({ path: join(ROOT, "shots", `wp71-tv-${lang}-${await tv.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")}.png`) });
    await tv.close();
    // viewer dicht: blijft gedeeld; daarna uit = weg bij de spelers
    await tap(page, '#mapview [data-mv="close"]');
    await page.waitForSelector("#mapview", { state: "hidden" });
    if (!/·/.test(await page.locator('#order [data-enc="map"]').innerText()) || (await pv.locator("#pv-map").isHidden())) throw new Error("niet meer gedeeld na sluiten");
    await tap(page, '#order [data-enc="map"]');
    await tap(page, '#mapview [data-mv="pv"]');
    await pv.waitForSelector("#pv-map", { state: "hidden" });
    if (await page.locator('#order [data-enc="map"].on').count()) throw new Error("strip zegt nog gedeeld");
    // weer aan, monsters gewist = niet meer gedeeld (knop en viewer weg, spelers zonder kaart)
    await tap(page, '#mapview [data-mv="pv"]');
    await pv.waitForSelector("#pv-map:not([hidden])", { timeout: 8000 });
    await page.evaluate(async () => { const { app } = await import("/js/state.js"), R = await import("/js/ui/render.js"), F = await import("/js/rules/fight.js");
      const keep = app.S.list; app.S.list = keep.filter((c) => c.kind === "pc"); const enc = app.S.enc; app.S.enc = []; R.render(); app.S.list = keep; app.S.enc = enc; });
    await pv.waitForSelector("#pv-map", { state: "hidden" });
    await page.waitForSelector("#mapview", { state: "hidden" });
    await page.evaluate(async () => (await import("/js/ui/render.js")).render());
    await pv.close();
    // eindstand voor de meting: viewer open en gedeeld
    await tap(page, '#order [data-enc="map"]');
    await tap(page, '#mapview [data-mv="pv"]');
    await page.waitForFunction(() => document.querySelector('#mapview [data-mv="pv"]').classList.contains("on"));
  },
  // WP73 (Inn Sight): fog of war. Paneel Kaart: aan = alles verborgen; Fog bewerken = fogmodus met eigen dock (dock en
  // paneel weg, strook); penseel veegt een rij, rechthoek onthult een blok bij loslaten, Verbergen + tik, Ongedaan, een tweede
  // vinger zet een veeg terug; verborgen cel donkerder dan een onthulde; bewaard in de opslag (schema 6). Eindstand: fogmodus.
  async wp73m(page) {
    await page.waitForFunction(() => window.__maps && window.__maps.map() && document.getElementById("m-zoom").textContent);
    const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const F = () => page.evaluate(() => ({ ...window.__maps.fog(), hist: window.__maps.hist().size, view: window.__maps.view(), dock: document.getElementById("m-dock").hidden, fdock: document.getElementById("m-fdock").hidden,
      sheet: document.getElementById("m-sheet").hidden, strip: document.getElementById("m-fstrip").hidden ? "" : document.getElementById("m-fstrip").textContent }));
    const ptr = (steps) => page.evaluate((steps) => {
      const c = document.getElementById("m-canvas"), r = c.getBoundingClientRect();
      for (const [type, id, x, y] of steps) c.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: "touch", isPrimary: id === 1, clientX: r.left + x, clientY: r.top + y, bubbles: true, cancelable: true, button: 0, buttons: type === "pointerup" ? 0 : 1 }));
    }, steps);
    const scr = async (mx, my) => { const v = (await F()).view; return { x: mx * 48 * v.z + v.x, y: my * 48 * v.z + v.y }; };
    const drag = async (x0, y0, x1, y1) => { const a = await scr(x0, y0), b = await scr(x1, y1), st = [["pointerdown", 1, a.x, a.y]]; for (let i = 1; i <= 8; i++) st.push(["pointermove", 1, a.x + ((b.x - a.x) * i) / 8, a.y + ((b.y - a.y) * i) / 8]); st.push(["pointerup", 1, b.x, b.y]); await ptr(st); await frame(); };
    const tapMap = async (mx, my) => { const p = await scr(mx, my); await ptr([["pointerdown", 1, p.x, p.y], ["pointerup", 1, p.x, p.y]]); await frame(); };
    // gemiddelde en spreiding van de helderheid over het midden van een cel (arcering = spreiding, ook in het donkere thema)
    const lum = async (mx, my) => { const a = await scr(mx - 0.3, my - 0.3), b = await scr(mx + 0.3, my + 0.3); return page.evaluate(({ a, b }) => { const c = document.getElementById("m-canvas"), d = devicePixelRatio || 1, x = Math.round(a.x * d), y = Math.round(a.y * d), px = c.getContext("2d").getImageData(x, y, Math.max(1, Math.round((b.x - a.x) * d)), Math.max(1, Math.round((b.y - a.y) * d))).data;
      let n = 0, sum = 0, lo = 255, hi = 0; for (let i = 0; i < px.length; i += 4) { const l = (px[i] + px[i + 1] + px[i + 2]) / 3; sum += l; n++; lo = Math.min(lo, l); hi = Math.max(hi, l); } return { avg: sum / n, range: hi - lo }; }, { a, b }); };
    await tap(page, "#m-set"); await page.locator("#m-sheet").waitFor({ state: "visible" });
    for (const [sel, v] of [["#m-cols", "10"], ["#m-rows", "8"]]) { await page.locator(sel).fill(v); await page.locator(sel).press("Enter"); }
    if (!(await page.locator("#m-fog-set").isHidden())) throw new Error("fog-knoppen zonder fog");
    await tap(page, '#m-fog-on [data-v="on"]');
    let f = await F();
    if (!f.on || f.rev !== 0 || f.n !== 80 || (await page.locator("#m-fog-set").isHidden())) throw new Error("fog aan: " + JSON.stringify(f));
    await tap(page, "#m-fog-edit"); await frame();
    f = await F();
    if (!f.mode || !f.dock || f.fdock || !f.sheet || !f.strip) throw new Error("fogmodus: " + JSON.stringify(f));
    await tap(page, '#m-ftool [data-v="brush"]'); await tap(page, '#m-fact [data-v="reveal"]');
    const h0 = (await F()).hist;
    await drag(0.5, 1.5, 4.5, 1.5);
    f = await F();
    if (f.rev !== 5 || f.hist !== h0 + 1) throw new Error("penseel: " + JSON.stringify(f));
    await tap(page, '#m-ftool [data-v="rect"]');
    await drag(6.2, 4.2, 8.8, 6.8);
    if ((await F()).rev !== 14) throw new Error("rechthoek: " + JSON.stringify(await F()));
    const dark = await lum(2.5, 5.5), light = await lum(2.5, 1.5);
    if (!(dark.range > 25 && light.range < 10 && (dark.avg < light.avg - 40 || light.avg < 80))) throw new Error(`fog niet herkenbaar: ${JSON.stringify({ dark, light })}`); // licht: donkerder; donker thema: de arcering
    await tap(page, '#m-fact [data-v="hide"]'); await tap(page, '#m-ftool [data-v="brush"]');
    await tapMap(0.5, 1.5);
    if ((await F()).rev !== 13) throw new Error("verbergen: " + JSON.stringify(await F()));
    await tap(page, "#m-undo"); await frame();
    if ((await F()).rev !== 14) throw new Error("ongedaan: " + JSON.stringify(await F()));
    await tap(page, '#m-fact [data-v="reveal"]');
    const a = await scr(0.5, 7.5), b = await scr(1.5, 7.5);
    await ptr([["pointerdown", 1, a.x, a.y], ["pointerdown", 2, b.x, b.y], ["pointerup", 2, b.x, b.y], ["pointerup", 1, a.x, a.y]]); await frame();
    if ((await F()).rev !== 14) throw new Error("tweede vinger: " + JSON.stringify(await F()));
    await tap(page, "#m-fdone"); await frame();
    f = await F();
    if (f.mode || f.sheet || !f.fdock) throw new Error("klaar: " + JSON.stringify(f));
    await page.waitForFunction(() => window.__maps.status() === "saved");
    const kept = await page.evaluate(async () => { const st = await import("/js/maps/store.js"), m = (await st.listMaps())[0]; return { schema: m.schema, on: !!(m.fog && m.fog.on) }; });
    if (kept.schema !== 6 || !kept.on) throw new Error("opslag: " + JSON.stringify(kept));
    await snap(page, "wp73m", "panel");
    await tap(page, "#m-fog-edit"); await frame(); // eindstand: fogmodus
    await snap(page, "wp73m", "mode");
  },
  // WP73 (Initiative): fog in de kaartviewer. Kaart met fog (blok linksboven onthuld): knop met wolkje boven + en −;
  // spelersbeeld heeft de fog ondoorzichtig ingebakken; fogmodus = balk, pil weg, + en − erboven; een tik onthult en gaat
  // naar de opslag en het spelersbeeld; Klaar = terug. Eindstand: fogmodus.
  async wp73(page, base) {
    await SCEN.fight(page);
    await page.evaluate(async () => {
      const st = await import("/js/maps/store.js"), M = await import("/js/maps/model/map.js"), Fg = await import("/js/maps/model/fog.js"), G = await import("/js/maps/model/grid.js");
      const grid = G.cleanGrid({ type: "square", cols: 20, rows: 15 }), cells = [];
      for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) cells.push({ c, r });
      await st.putMap({ ...M.newMap({ id: "kaart00001", name: "Grot der goblins" }), grid, fog: Fg.revealCells(Fg.setFogOn(true), grid, cells, true) });
      const { app } = await import("/js/state.js"), F = await import("/js/rules/fight.js"), R = await import("/js/ui/render.js");
      F.addEnc(app.S, { name: "Grot", notes: "", map: { id: "kaart00001", name: "Grot der goblins" } }, true);
      R.render();
    });
    const lang = await page.evaluate(() => document.documentElement.lang);
    const pv = await page.context().newPage();
    await pv.setViewportSize({ width: 390, height: 740 });
    await pv.goto(base + pathFor(lang, "/initiative/player/"));
    await pv.waitForSelector("#pv-list .pvc");
    await tap(page, '#order [data-enc="map"]');
    await page.waitForSelector('#mapview [data-mv="fog"]:not([hidden])');
    await tap(page, '#mapview [data-mv="pv"]');
    await pv.waitForFunction(() => { const i = document.querySelector("#pv-mapimg"); return !document.querySelector("#pv-map").hidden && i.complete && i.naturalWidth > 100; }, null, { timeout: 8000 });
    const px = () => pv.evaluate(() => { const i = document.querySelector("#pv-mapimg"), c = document.createElement("canvas"); c.width = i.naturalWidth; c.height = i.naturalHeight; const g = c.getContext("2d"); g.drawImage(i, 0, 0);
      const at = (cx, cy) => { const d = g.getImageData(Math.round((cx / 20) * c.width), Math.round((cy / 15) * c.height), 1, 1).data; return (d[0] + d[1] + d[2]) / 3; };
      return { open: at(2.5, 2.5), fog: at(15.5, 10.5), src: i.src }; });
    const p0 = await px();
    if (!(p0.fog < 60 && p0.open > 180)) throw new Error("spelersbeeld zonder ingebakken fog: " + JSON.stringify(p0));
    await tap(page, '#mapview [data-mv="fog"]');
    await page.waitForSelector("#mapview .mvfog:not([hidden])");
    const lay = await page.evaluate(() => { const q = (s) => document.querySelector(s), z = q("#mapview .mvzoom").getBoundingClientRect(), b = q("#mapview .mvfog").getBoundingClientRect();
      return { toon: getComputedStyle(q("#mapview .mvtoon")).display, above: z.bottom <= b.top + 1, strip: !q("#mapview .mvfstrip").hidden, fogBtn: q('#mapview [data-mv="fog"]').hidden }; });
    if (lay.toon !== "none" || !lay.above || !lay.strip || !lay.fogBtn) throw new Error("fogmodus viewer: " + JSON.stringify(lay));
    const count = () => page.evaluate(async () => { const st = await import("/js/maps/store.js"), Fg = await import("/js/maps/model/fog.js"), G = await import("/js/maps/model/grid.js"), m = await st.getMap("kaart00001"); return Fg.countFog(G.cleanGrid(m.grid), m.fog).rev; });
    const before = await count();
    await tap(page, '#mapview [data-mv="tool"][data-v="wide"]'); await tap(page, '#mapview [data-mv="act"][data-v="reveal"]');
    await page.evaluate(() => { const c = document.querySelector("#mapview canvas"), r = c.getBoundingClientRect(), x = r.left + r.width * 0.8, y = r.top + r.height * 0.6;
      for (const t of ["pointerdown", "pointerup"]) c.dispatchEvent(new PointerEvent(t, { pointerId: 1, pointerType: "touch", isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true, button: 0, buttons: t === "pointerup" ? 0 : 1 })); });
    const t0 = Date.now();
    while ((await count()) <= before) { if (Date.now() - t0 > 5000) throw new Error("fog niet bewaard"); await page.waitForTimeout(100); }
    await pv.waitForFunction((src) => document.querySelector("#pv-mapimg").src !== src, p0.src, { timeout: 8000 });
    await snap(page, "wp73", "fog");
    await tap(page, '#mapview [data-mv="fdone"]');
    await page.waitForSelector('#mapview .mvtoon:not([hidden]) [data-mv="pv"]');
    if (!(await page.locator("#mapview .mvfog").isHidden())) throw new Error("balk na Klaar");
    await pv.close();
    await tap(page, '#mapview [data-mv="fog"]'); // eindstand: fogmodus
    await page.waitForSelector("#mapview .mvfog:not([hidden])");
  },
  // WP74 (Inn Sight): vrije tokens. Tab Tokens (vier tabs passen, op 320 px op een eigen rij), staal kiezen = Plaatsen,
  // een tik plaatst (label telt op), naast de kaart niets; tik selecteert (ring, dock met Verbergen i.p.v. Draaien),
  // slepen = één stap, verbergen, paneel Token (grootte Large), toetsen (pijl, H, N), dupliceren, verwijderen + Ongedaan,
  // token boven een object, schema 7 in de opslag. Eindstand: token geselecteerd met paneel Token.
  async wp74m(page) {
    await page.waitForFunction(() => window.__maps && window.__maps.map() && document.getElementById("m-zoom").textContent);
    const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const K = () => page.evaluate(() => ({ ...window.__maps.toks(), hist: window.__maps.hist().size, view: window.__maps.view(), osel: window.__maps.sel(),
      odock: document.getElementById("m-odock").hidden, rot: document.getElementById("m-orot").hidden, hide: document.getElementById("m-ohide").hidden,
      hidePressed: document.getElementById("m-ohide").getAttribute("aria-pressed"), strip: document.getElementById("m-pstrip").hidden ? "" : document.getElementById("m-pstrip").textContent }));
    const ptr = (steps) => page.evaluate((steps) => {
      const c = document.getElementById("m-canvas"), r = c.getBoundingClientRect();
      for (const [type, id, x, y] of steps) c.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: "touch", isPrimary: id === 1, clientX: r.left + x, clientY: r.top + y, bubbles: true, cancelable: true, button: 0, buttons: type === "pointerup" ? 0 : 1 }));
    }, steps);
    const scr = async (mx, my) => { const v = (await K()).view; return { x: mx * 48 * v.z + v.x, y: my * 48 * v.z + v.y }; };
    const tapMap = async (mx, my) => { const p = await scr(mx, my); await ptr([["pointerdown", 1, p.x, p.y], ["pointerup", 1, p.x, p.y]]); await frame(); };
    const drag = async (x0, y0, x1, y1) => { const a = await scr(x0, y0), b = await scr(x1, y1), st = [["pointerdown", 1, a.x, a.y]]; for (let i = 1; i <= 8; i++) st.push(["pointermove", 1, a.x + ((b.x - a.x) * i) / 8, a.y + ((b.y - a.y) * i) / 8]); st.push(["pointerup", 1, b.x, b.y]); await ptr(st); await frame(); };
    await tap(page, "#m-set"); await page.locator("#m-sheet").waitFor({ state: "visible" });
    for (const [sel, v] of [["#m-cols", "8"], ["#m-rows", "6"]]) { await page.locator(sel).fill(v); await page.locator(sel).press("Enter"); }
    await tap(page, "#m-close");
    await tap(page, "#m-lib"); await page.locator("#m-lsheet").waitFor({ state: "visible" });
    // een object (tafel) om te testen dat een token erboven ligt
    await tap(page, '#m-ltab [data-v="parts"]');
    await tap(page, "#m-tiles .mtile");
    await tapMap(5.5, 3.5);
    const tabs = await page.evaluate(() => { const b = [...document.querySelectorAll("#m-ltab button")].map((x) => x.getBoundingClientRect()), s = document.getElementById("m-lsheet").getBoundingClientRect(); return { n: b.length, inside: b.every((r) => r.right <= s.right + 1 && r.left >= s.left - 1 && r.height >= 44) }; });
    if (tabs.n !== 4 || !tabs.inside) throw new Error("tabs: " + JSON.stringify(tabs));
    await tap(page, '#m-ltab [data-v="tokens"]');
    await page.locator("#m-tok").waitFor({ state: "visible" });
    if ((await page.locator("#m-tl").inputValue()) !== "1") throw new Error("standaardlabel");
    await page.locator("#m-tl").fill("G1"); await page.locator("#m-tl").press("Enter");
    await tap(page, '#m-tcolors [data-c="red"]');
    let k = await K();
    if (!k.placing || !k.strip) throw new Error("plaatsen aan: " + JSON.stringify(k));
    const h0 = k.hist;
    await tapMap(1.5, 1.5); await tapMap(3.5, 1.5); await tapMap(5.5, 3.5); await tapMap(9.5, 3.5);
    k = await K();
    if (k.list.length !== 3 || k.list.map((x) => x.l).join() !== "G1,G2,G3" || k.hist !== h0 + 3 || k.label !== "G4") throw new Error("plaatsen: " + JSON.stringify(k));
    if (k.list[0].x !== 1.5 || k.list[0].y !== 1.5) throw new Error("snap: " + JSON.stringify(k.list[0]));
    await tap(page, "#m-lclose");
    // tik op G3 (ligt op de tafel) selecteert het token, nog eens tikken = de tafel eronder
    await tapMap(5.5, 3.5);
    k = await K();
    if (k.sel !== k.list[2].id || k.odock || !k.rot || k.hide) throw new Error("selecteren: " + JSON.stringify(k));
    await tapMap(5.5, 3.5);
    k = await K();
    if (k.sel || !k.osel) throw new Error("object eronder: " + JSON.stringify(k));
    await tapMap(1.5, 1.5);
    k = await K();
    const id1 = k.list[0].id;
    if (k.sel !== id1 || k.osel) throw new Error("G1: " + JSON.stringify(k));
    const h1 = k.hist;
    await drag(1.5, 1.5, 2.6, 4.4);
    k = await K();
    if (k.list[0].x !== 2.5 || k.list[0].y !== 4.5 || k.hist !== h1 + 1) throw new Error("slepen: " + JSON.stringify(k.list[0]) + k.hist);
    await tap(page, "#m-ohide");
    k = await K();
    if (!k.list[0].hide || k.hidePressed !== "true") throw new Error("verbergen: " + JSON.stringify(k));
    // paneel Token: grootte Large
    await tap(page, "#m-omore"); await page.locator("#m-tsheet").waitFor({ state: "visible" });
    await tap(page, '#m-ttsize [data-s="2"]');
    k = await K();
    if (k.list[0].s !== 2 || !Number.isInteger(k.list[0].x)) throw new Error("grootte: " + JSON.stringify(k.list[0]));
    await tap(page, "#m-tclose");
    // toetsen: pijl verplaatst, H toont weer, Ctrl+D dupliceert, Delete + Ongedaan
    await page.locator("#m-canvas").focus();
    const x0 = (await K()).list[0].x;
    await page.keyboard.press("ArrowRight");
    if ((await K()).list[0].x !== x0 + 2) throw new Error("pijl (Large = 2 cellen): " + JSON.stringify((await K()).list[0]));
    await page.keyboard.press("h");
    if ((await K()).list[0].hide) throw new Error("H");
    await page.keyboard.press("Control+d");
    k = await K();
    if (k.list.length !== 4 || k.sel !== k.list[3].id) throw new Error("dupliceren: " + JSON.stringify(k));
    await page.keyboard.press("Delete");
    if ((await K()).list.length !== 3) throw new Error("verwijderen");
    await tap(page, "#m-undo"); await frame();
    if ((await K()).list.length !== 4) throw new Error("ongedaan verwijderen");
    await page.keyboard.press("Escape");
    if ((await K()).sel) throw new Error("Esc");
    await page.waitForFunction(() => window.__maps.status() === "saved");
    const kept = await page.evaluate(async () => { const st = await import("/js/maps/store.js"), m = (await st.listMaps())[0]; return { schema: m.schema, n: m.toks && m.toks.list.length }; });
    if (kept.schema !== 7 || kept.n !== 4) throw new Error("opslag: " + JSON.stringify(kept));
    await tapMap(3.5, 1.5);
    await tap(page, "#m-omore"); await page.locator("#m-tsheet").waitFor({ state: "visible" }); // eindstand: paneel Token
    await snap(page, "wp74m", "panel");
  },
  // WP74 (Initiative): tokens in de kaartviewer. Kaart met twee tokens (één verborgen); spelersbeeld toont alleen het
  // zichtbare; slepen = token op de nieuwe cel in de opslag en een nieuw spelersbeeld; tik = balk met Verborgen voor
  // spelers + Klaar (pil weg, + en − erboven); omzetten bewaart. Eindstand: balk open.
  async wp74(page, base) {
    await SCEN.fight(page);
    await page.evaluate(async () => {
      const st = await import("/js/maps/store.js"), M = await import("/js/maps/model/map.js"), G = await import("/js/maps/model/grid.js");
      const grid = G.cleanGrid({ type: "square", cols: 10, rows: 8 });
      await st.putMap({ ...M.newMap({ id: "kaart00002", name: "Herberg" }), grid, toks: { at: Date.now(), list: [{ id: "ta", x: 1.5, y: 1.5, s: 1, c: "red", l: "G1" }, { id: "tb", x: 8.5, y: 6.5, s: 1, c: "blue", l: "A", hide: true }] } });
      const { app } = await import("/js/state.js"), F = await import("/js/rules/fight.js"), R = await import("/js/ui/render.js");
      F.addEnc(app.S, { name: "Herberg", notes: "", map: { id: "kaart00002", name: "Herberg" } }, true);
      R.render();
    });
    const lang = await page.evaluate(() => document.documentElement.lang);
    const pv = await page.context().newPage();
    await pv.setViewportSize({ width: 390, height: 740 });
    await pv.goto(base + pathFor(lang, "/initiative/player/"));
    await pv.waitForSelector("#pv-list .pvc");
    await tap(page, '#order [data-enc="map"]');
    await page.waitForSelector("#mapview canvas:not([hidden])");
    await page.waitForFunction(() => { const c = document.querySelector("#mapview canvas"); return c.width > 10; });
    await tap(page, '#mapview [data-mv="pv"]');
    await pv.waitForFunction(() => { const i = document.querySelector("#pv-mapimg"); return !document.querySelector("#pv-map").hidden && i.complete && i.naturalWidth > 100; }, null, { timeout: 8000 });
    const px = (cx, cy) => pv.evaluate(({ cx, cy }) => { const i = document.querySelector("#pv-mapimg"), c = document.createElement("canvas"); c.width = i.naturalWidth; c.height = i.naturalHeight; const g = c.getContext("2d"); g.drawImage(i, 0, 0);
      const d = g.getImageData(Math.round((cx / 10) * c.width), Math.round((cy / 8) * c.height), 1, 1).data; return { r: d[0], g: d[1], b: d[2], src: i.src }; }, { cx, cy });
    const red = await px(1.2, 1.5), blue = await px(8.2, 6.5); // binnen de schijf, naast het label
    if (!(red.r > 150 && red.g < 110) || blue.b > blue.r + 60) throw new Error("spelersbeeld tokens: " + JSON.stringify({ red, blue }));
    const stored = () => page.evaluate(async () => { const st = await import("/js/maps/store.js"); const m = await st.getMap("kaart00002"); return m.toks.list.map((x) => ({ id: x.id, x: x.x, y: x.y, hide: !!x.hide })); });
    // het token zit linksboven; de kaart is passend getekend (fitView): zoek het rode token op het canvas
    const find = (rgb) => page.evaluate((rgb) => { const c = document.querySelector("#mapview canvas"), g = c.getContext("2d"), d = g.getImageData(0, 0, c.width, c.height).data, r = c.getBoundingClientRect(), k = c.width / r.width;
      let sx = 0, sy = 0, n = 0; for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x += 2) { const i = (y * c.width + x) * 4; if (Math.abs(d[i] - rgb[0]) < 12 && Math.abs(d[i + 1] - rgb[1]) < 12 && Math.abs(d[i + 2] - rgb[2]) < 12) { sx += x; sy += y; n++; } }
      return n ? { x: r.left + sx / n / k, y: r.top + sy / n / k, n } : null; }, rgb);
    const t0 = await find([192, 57, 43]);
    if (!t0) throw new Error("rood token niet op het canvas");
    const cellPx = await page.evaluate(() => { const c = document.querySelector("#mapview canvas"), r = c.getBoundingClientRect(); return Math.min(r.width / 10, r.height / 8); });
    const ev = (steps) => page.evaluate((steps) => { const c = document.querySelector("#mapview canvas");
      for (const [t, x, y] of steps) c.dispatchEvent(new PointerEvent(t, { pointerId: 1, pointerType: "touch", isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true, button: 0, buttons: t === "pointerup" ? 0 : 1 })); }, steps);
    const st = [["pointerdown", t0.x, t0.y]];
    for (let i = 1; i <= 8; i++) st.push(["pointermove", t0.x + (cellPx * 3 * i) / 8, t0.y + (cellPx * 2 * i) / 8]);
    st.push(["pointerup", t0.x + cellPx * 3, t0.y + cellPx * 2]);
    await ev(st);
    const w0 = Date.now();
    let s1;
    while (!((s1 = await stored()).find((x) => x.id === "ta").x === 4.5)) { if (Date.now() - w0 > 5000) throw new Error("token niet verplaatst: " + JSON.stringify(s1)); await page.waitForTimeout(100); }
    if (s1.find((x) => x.id === "ta").y !== 3.5) throw new Error("snap: " + JSON.stringify(s1));
    await pv.waitForFunction((src) => document.querySelector("#pv-mapimg").src !== src, red.src, { timeout: 8000 });
    // tik op het token: balk met Verborgen voor spelers
    const t1 = await find([192, 57, 43]);
    await ev([["pointerdown", t1.x, t1.y], ["pointerup", t1.x, t1.y]]);
    await page.waitForSelector("#mapview .mvtok:not([hidden])");
    const lay = await page.evaluate(() => { const q = (s) => document.querySelector(s), z = q("#mapview .mvzoom").getBoundingClientRect(), b = q("#mapview .mvtok").getBoundingClientRect();
      return { toon: getComputedStyle(q("#mapview .mvtoon")).display, above: z.bottom <= b.top + 1, name: q("#mapview .mvtname").textContent }; });
    if (lay.toon !== "none" || !lay.above || !/G1/.test(lay.name)) throw new Error("balk: " + JSON.stringify(lay));
    await tap(page, '#mapview [data-mv="thide"]');
    const w1 = Date.now();
    while (!(await stored()).find((x) => x.id === "ta").hide) { if (Date.now() - w1 > 5000) throw new Error("verbergen niet bewaard"); await page.waitForTimeout(100); }
    if ((await page.getAttribute('#mapview [data-mv="thide"]', "aria-pressed")) !== "true") throw new Error("schakelaar");
    await snap(page, "wp74", "tok");
    await tap(page, '#mapview [data-mv="tdone"]');
    if (!(await page.locator("#mapview .mvtok").isHidden())) throw new Error("balk na Klaar");
    await pv.close();
    await ev([["pointerdown", t1.x, t1.y], ["pointerup", t1.x, t1.y]]); // eindstand: balk open
    await page.waitForSelector("#mapview .mvtok:not([hidden])");
  },
  // WP75 (Initiative): tokens gekoppeld aan deelnemers. Kaart zonder tokens bij de encounter; viewer: pil "Plaatsen (n)"
  // = iedereen zonder token; tik = gekoppelde tokens in de opslag (spelers eerst, rood/blauw), pil weg. Spelersbeeld: een
  // nieuwe beurt en een verborgen monster geven een nieuw beeld. Tik op een gekoppeld token = statblock/sheet boven de
  // viewer (viewer blijft open), Esc = terug. Wees-token (deelnemer weg): balk met Weghalen i.p.v. de schakelaar.
  async wp75(page, base) {
    await SCEN.fight(page);
    await page.evaluate(async () => {
      const st = await import("/js/maps/store.js"), M = await import("/js/maps/model/map.js"), G = await import("/js/maps/model/grid.js");
      const grid = G.cleanGrid({ type: "square", cols: 12, rows: 9 });
      await st.putMap({ ...M.newMap({ id: "kaart00075", name: "Grot" }), grid, toks: { at: Date.now(), list: [{ id: "tz", x: 11.5, y: 8.5, s: 1, c: "black", l: "Z", p: "c:weg0001" }] } });
      const { app } = await import("/js/state.js"), F = await import("/js/rules/fight.js"), R = await import("/js/ui/render.js");
      F.addEnc(app.S, { name: "Grot", notes: "", map: { id: "kaart00075", name: "Grot" } }, true);
      R.render();
    });
    const n = await page.evaluate(async () => { const { app } = await import("/js/state.js"); return app.S.list.filter((c) => c.kind !== "lair").length; });
    const lang = await page.evaluate(() => document.documentElement.lang);
    const pv = await page.context().newPage();
    await pv.setViewportSize({ width: 390, height: 740 });
    await pv.goto(base + pathFor(lang, "/initiative/player/"));
    await pv.waitForSelector("#pv-list .pvc");
    await tap(page, '#order [data-enc="map"]');
    await page.waitForSelector("#mapview canvas:not([hidden])");
    await page.waitForFunction(() => { const c = document.querySelector("#mapview canvas"); return c.width > 10; });
    await page.waitForSelector('#mapview [data-mv="place"]:not([hidden])');
    const pill = await page.evaluate(() => { const b = document.querySelector('#mapview [data-mv="place"]'), r = b.getBoundingClientRect(); return { t: b.textContent, h: r.height }; });
    if (!pill.t.includes(`(${n})`) || pill.h < 44) throw new Error("pil: " + JSON.stringify(pill) + n);
    const stored = () => page.evaluate(async () => { const st = await import("/js/maps/store.js"); const m = await st.getMap("kaart00075"); return { schema: m.schema, list: m.toks.list.map((x) => ({ id: x.id, p: x.p || "", l: x.l, c: x.c, x: x.x, y: x.y, s: x.s })) }; });
    await tap(page, '#mapview [data-mv="place"]');
    const w0 = Date.now();
    let s1;
    while ((s1 = await stored()).list.filter((x) => x.p).length < n + 1) { if (Date.now() - w0 > 5000) throw new Error("niet geplaatst: " + JSON.stringify(s1)); await page.waitForTimeout(100); }
    const pl = s1.list.filter((x) => x.p && x.id !== "tz");
    const firstMon = pl.findIndex((x) => x.c === "red");
    if (s1.schema !== 8 || pl.length !== n || firstMon < 1 || pl.slice(0, firstMon).some((x) => x.c !== "blue") || pl.slice(firstMon).some((x) => x.c !== "red")) throw new Error("plaatsen: " + JSON.stringify(s1));
    if (new Set(pl.map((x) => `${x.x},${x.y}`)).size !== pl.length || pl.some((x) => x.x < 0 || x.y < 0 || x.x > 12 || x.y > 9)) throw new Error("plekken: " + JSON.stringify(pl));
    if (!(await page.locator('#mapview [data-mv="place"]').isHidden())) throw new Error("pil na plaatsen");
    // delen met spelers: nieuwe beurt = nieuw beeld; monster verbergen = nieuw beeld
    await tap(page, '#mapview [data-mv="pv"]');
    await pv.waitForFunction(() => { const i = document.querySelector("#pv-mapimg"); return !document.querySelector("#pv-map").hidden && i.complete && i.naturalWidth > 100; }, null, { timeout: 8000 });
    const src0 = await pv.getAttribute("#pv-mapimg", "src");
    await tap(page, "#next");
    await pv.waitForFunction((src) => document.querySelector("#pv-mapimg").src !== src, src0, { timeout: 8000 });
    const src1 = await pv.getAttribute("#pv-mapimg", "src");
    await page.evaluate(async () => { const { app } = await import("/js/state.js"); const m = app.S.list.find((c) => c.kind === "monster" && !c.hidden); m.hidden = true; const R = await import("/js/ui/render.js"); R.render(); });
    await pv.waitForFunction((src) => document.querySelector("#pv-mapimg").src !== src, src1, { timeout: 8000 });
    // tik op een gekoppeld token = statblock of sheet boven de viewer (hele kaart in beeld; kaarteenheden → scherm)
    const at = (x, y) => page.evaluate(({ x, y }) => { const c = document.querySelector("#mapview canvas"); for (const t of ["pointerdown", "pointerup"]) c.dispatchEvent(new PointerEvent(t, { pointerId: 1, pointerType: "touch", isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true, button: 0, buttons: t === "pointerup" ? 0 : 1 })); }, { x, y });
    await tap(page, '#mapview [data-mv="fit"]');
    await page.waitForTimeout(150);
    const rect = await page.evaluate(() => { const r = document.querySelector("#mapview canvas").getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; });
    const toScr = (mx, my) => { const k = Math.min(rect.w / 12, rect.h / 9) * 0.98; return { x: rect.l + rect.w / 2 + (mx - 6) * k, y: rect.t + rect.h / 2 + (my - 4.5) * k }; };
    const p0 = toScr(pl[0].x, pl[0].y);
    await at(p0.x, p0.y);
    await page.waitForFunction(() => document.body.classList.contains("mvsb") && document.body.dataset.sb === "open", null, { timeout: 4000 }).catch(() => { throw new Error("tik opent de deelnemer niet: " + JSON.stringify(p0)); });
    const over = await page.evaluate(() => { const w = document.querySelector("#sbwrap"), r = w.getBoundingClientRect(), cs = getComputedStyle(w);
      const hit = document.elementFromPoint(r.left + r.width / 2, r.bottom - 20); return { z: cs.zIndex, vis: cs.display !== "none" && r.height > 40, top: !!hit && w.contains(hit), map: !document.querySelector("#mapview").hidden }; });
    if (over.z !== "17" || !over.vis || !over.top || !over.map) throw new Error("statblock boven de kaart: " + JSON.stringify(over));
    await snap(page, "wp75", "sb");
    await page.keyboard.press("Escape");
    const back = await page.evaluate(() => ({ sb: document.body.classList.contains("mvsb"), map: !document.querySelector("#mapview").hidden }));
    if (back.sb || !back.map) throw new Error("Esc: " + JSON.stringify(back));
    // wees-token (deelnemer weg): balk met Weghalen, schakelaar weg; Weghalen = uit de opslag
    const pz = toScr(11.5, 8.5);
    await at(pz.x, pz.y);
    await page.waitForSelector("#mapview .mvtok:not([hidden])");
    const bar = await page.evaluate(() => ({ del: !document.querySelector('#mapview [data-mv="tdel"]').hidden, dsp: getComputedStyle(document.querySelector('#mapview [data-mv="thide"]')).display }));
    if (!bar.del || bar.dsp !== "none") throw new Error("balk wees-token: " + JSON.stringify(bar));
    await snap(page, "wp75", "orphan");
    await tap(page, '#mapview [data-mv="tdel"]');
    const w2 = Date.now();
    while ((await stored()).list.some((x) => x.id === "tz")) { if (Date.now() - w2 > 5000) throw new Error("weghalen niet bewaard"); await page.waitForTimeout(100); }
    await pv.close();
    await at(p0.x, p0.y); // eindstand: statblock/sheet boven de kaart
    await page.waitForFunction(() => document.body.classList.contains("mvsb") && document.body.dataset.sb === "open", null, { timeout: 4000 });
  },
  // WP75 (Inn Sight): een gekoppeld token (uit Initiative) toont in het paneel Token "Gekoppeld aan een deelnemer" +
  // Ontkoppelen; ontkoppelen = één undo-stap, daarna vrij token (schema 7). Eindstand: paneel met de regel.
  async wp75m(page) {
    await page.waitForFunction(() => window.__maps && window.__maps.map());
    await page.evaluate(async () => {
      const st = await import("/js/maps/store.js"), M = await import("/js/maps/model/map.js"), G = await import("/js/maps/model/grid.js");
      await st.putMap({ ...M.newMap({ id: "kaart0075m", name: "Gekoppeld" }), grid: G.cleanGrid({ type: "square", cols: 8, rows: 6 }), toks: { at: Date.now(), list: [{ id: "tk", x: 2.5, y: 2.5, s: 1, c: "red", l: "G1", p: "c:m1" }, { id: "tf", x: 5.5, y: 2.5, s: 1, c: "blue", l: "F" }] } });
      st.setLastId("kaart0075m");
    });
    await page.reload();
    await page.waitForFunction(() => window.__maps && window.__maps.map() && window.__maps.map().id === "kaart0075m" && document.getElementById("m-zoom").textContent);
    const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const tapMap = async (mx, my) => { await page.evaluate(({ mx, my }) => { const c = document.getElementById("m-canvas"), r = c.getBoundingClientRect(), v = window.__maps.view(), x = r.left + mx * 48 * v.z + v.x, y = r.top + my * 48 * v.z + v.y;
      for (const t of ["pointerdown", "pointerup"]) c.dispatchEvent(new PointerEvent(t, { pointerId: 1, pointerType: "touch", isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true, button: 0, buttons: t === "pointerup" ? 0 : 1 })); }, { mx, my }); await frame(); };
    await tapMap(5.5, 2.5);
    await tap(page, "#m-omore"); await page.locator("#m-tsheet").waitFor({ state: "visible" });
    if (!(await page.locator("#m-ttlink").isHidden())) throw new Error("vrij token toont koppeling");
    await tap(page, "#m-tclose");
    await tapMap(2.5, 2.5);
    await tap(page, "#m-omore"); await page.locator("#m-tsheet").waitFor({ state: "visible" });
    if (await page.locator("#m-ttlink").isHidden()) throw new Error("koppeling niet getoond");
    await snap(page, "wp75m", "panel");
    const h0 = await page.evaluate(() => window.__maps.hist().size);
    await tap(page, "#m-ttunlink");
    const k = await page.evaluate(() => ({ p: window.__maps.toks().list.find((x) => x.id === "tk").p || "", hist: window.__maps.hist().size }));
    if (k.p || k.hist !== h0 + 1 || !(await page.locator("#m-ttlink").isHidden())) throw new Error("ontkoppelen: " + JSON.stringify(k));
    await page.waitForFunction(() => window.__maps.status() === "saved");
    const sc = await page.evaluate(async () => { const st = await import("/js/maps/store.js"); return (await st.getMap("kaart0075m")).schema; });
    if (sc !== 7) throw new Error("schema na ontkoppelen: " + sc);
    await tap(page, "#m-undo"); await frame();
    if (await page.locator("#m-ttlink").isHidden()) throw new Error("ongedaan: koppeling terug"); // eindstand: paneel met de regel
  },
  // WP72: spelerskaart via de kamer. DM deelt een kamer (kamerSim), speler in een eigen browsercontext (geen
  // BroadcastChannel: de kaart kan alleen via de kamer komen). Hint noemt de kamer; aan = kaart in stukken (elk bericht
  // ≤ MAX_MSG) en compleet in de kamer; speler toont hem; een later scherm krijgt hem bij "hallo"; uit = weg. Daarnaast:
  // fitJpeg houdt een kaart met veel ruis onder ROOM_MAP_MAX. --shots=wp72: viewer met hint, speler.
  async wp72(page, base) {
    const sim = kamerSim();
    await sim.attach(page.context());
    await page.evaluate((r) => localStorage.setItem("it-room", JSON.stringify(r)), sim.room);
    await page.reload(); await page.waitForSelector("#dock");
    await SCEN.fight(page);
    await page.evaluate(async () => {
      const st = await import("/js/maps/store.js"), M = await import("/js/maps/model/map.js");
      await st.putMap({ ...M.newMap({ id: "kaart00001", name: "Grot der goblins" }), grid: { type: "square", cols: 20, rows: 15 }, objs: [{ id: "o1", asset: "table", x: 5, y: 5 }, { id: "o2", asset: "tree", x: 12, y: 8 }] });
      const { app } = await import("/js/state.js"), F = await import("/js/rules/fight.js"), R = await import("/js/ui/render.js");
      F.addEnc(app.S, { name: "Grot", notes: "", map: { id: "kaart00001", name: "Grot der goblins" } }, true);
      R.render();
    });
    const lang = await page.evaluate(() => document.documentElement.lang);
    const scheme = await page.evaluate(() => (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
    const players = [];
    const openPv = async () => {
      const c = await page.context().browser().newContext({ viewport: page.viewportSize(), hasTouch: true, isMobile: true, colorScheme: scheme, deviceScaleFactor: 2, serviceWorkers: "block" });
      await sim.attach(c);
      const pv = await c.newPage();
      players.push(c);
      await pv.goto(base + pathFor(lang, "/initiative/player/") + "?k=" + sim.code);
      await pv.waitForSelector("#pv-list .pvc", { timeout: 8000 });
      return pv;
    };
    const pv = await openPv();
    if (!(await pv.locator("#pv-map").isHidden())) throw new Error("kaart bij de speler zonder delen");
    await tap(page, '#order [data-enc="map"]');
    await page.waitForSelector('#mapview .mvtoon:not([hidden]) [data-mv="pv"]');
    const code = sim.code.slice(0, 3) + " " + sim.code.slice(3);
    await page.waitForFunction((c) => document.querySelector("#mapview .mvthint").textContent.includes(c), code, { timeout: 8000 });
    await tap(page, '#mapview [data-mv="pv"]');
    await pv.waitForFunction(() => { const i = document.querySelector("#pv-mapimg"); return !document.querySelector("#pv-map").hidden && i.complete && i.naturalWidth > 100; }, null, { timeout: 15000 });
    await page.waitForFunction((c) => { const h = document.querySelector("#mapview .mvthint").textContent; return h.includes(c) && !h.includes("…"); }, code, { timeout: 8000 });
    await snap(page, "wp72", "viewer");
    const mm = sim.storage.get("mapm");
    if (!mm || mm.got !== mm.n || sim.big.length) throw new Error("kamer: " + JSON.stringify({ mm, big: sim.big }));
    const ph = await pv.evaluate(() => ({ hs: document.documentElement.scrollWidth - innerWidth, h: document.querySelector("#pv-mapimg").getBoundingClientRect().height, max: innerHeight * 0.45 + 1 }));
    if (ph.hs > 0 || ph.h > ph.max) throw new Error("speler: " + JSON.stringify(ph));
    if (SHOTS.has("wp72") && page.viewportSize().width === 320) await pv.screenshot({ path: join(ROOT, "shots", `wp72-speler-${lang}-320-${scheme}.png`) });
    // later scherm: krijgt de kaart bij "hallo"
    const pv2 = await openPv();
    await pv2.waitForFunction(() => !document.querySelector("#pv-map").hidden && document.querySelector("#pv-mapimg").naturalWidth > 100, null, { timeout: 15000 });
    // gewone wijziging (Volgende): kaart blijft, geen nieuwe stukken
    const n0 = [...sim.storage.keys()].filter((k) => k.startsWith("map:")).length;
    await tap(page, "#next");
    await pv.waitForTimeout(400);
    if (await pv.locator("#pv-map").isHidden()) throw new Error("kaart weg na Volgende");
    if ([...sim.storage.keys()].filter((k) => k.startsWith("map:")).length !== n0 || sim.storage.get("mapm").k !== mm.k) throw new Error("kaart opnieuw gestuurd na Volgende");
    // uit = weg bij beide spelers en uit de kamer
    await tap(page, '#mapview [data-mv="pv"]');
    await pv.waitForSelector("#pv-map", { state: "hidden" });
    await pv2.waitForSelector("#pv-map", { state: "hidden" });
    if (sim.storage.get("mapm")) throw new Error("kaart nog in de kamer");
    for (const c of players) await c.close();
    // budget: een kaart met veel ruis (2048 px) blijft onder ROOM_MAP_MAX
    const fit = await page.evaluate(async () => {
      const { fitJpeg } = await import("/js/ui/encmap.js"), { ROOM_MAP_MAX } = await import("/js/share.js");
      const cv = document.createElement("canvas"); cv.width = cv.height = 2048;
      const g = cv.getContext("2d"), d = g.createImageData(2048, 2048);
      let x = 2463534242; // xorshift32: echte ruis, comprimeert slecht (dwingt het verkleinpad af)
      for (let i = 0; i < d.data.length; i++) { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; d.data[i] = (i & 3) === 3 ? 255 : x & 255; }
      g.putImageData(d, 0, 0);
      const r = await fitJpeg(cv);
      return r && { size: r.b.size, max: ROOM_MAP_MAX, w: r.w, h: r.h };
    });
    if (!fit || fit.size > fit.max || fit.w >= 2048 || fit.w < 256) throw new Error("fitJpeg: " + JSON.stringify(fit));
    await tap(page, '#mapview [data-mv="close"]');
  },
  // WP70: kaart bekijken in Gevecht (DM, alleen kijken). Twee ingeladen encounters met elk een kaart (één bestaat niet).
  // Knop "Kaarten (2)" in de encounterstrip; viewer vol scherm tot aan de dock: canvas getekend, Volgende blijft bruikbaar
  // en de viewer blijft open, +/− en Hele kaart, chips wisselen, "staat niet op dit apparaat", Esc sluit met de focus terug.
  // Monsters weg (undo-stand) = viewer dicht. --shots=wp70: kaart, ontbreekt.
  async wp70(page) {
    await SCEN.fight(page);
    await page.evaluate(async () => {
      const st = await import("/js/maps/store.js"), M = await import("/js/maps/model/map.js");
      await st.putMap({ ...M.newMap({ id: "kaart00001", name: "Grot der goblins" }), grid: { type: "square", cols: 20, rows: 15 }, objs: [{ id: "o1", asset: "table", x: 5, y: 5 }] });
      const { app } = await import("/js/state.js"), F = await import("/js/rules/fight.js"), R = await import("/js/ui/render.js");
      F.addEnc(app.S, { name: "Grot", notes: "", map: { id: "kaart00001", name: "Oude naam" } }, true);
      F.addEnc(app.S, { name: "Brug", notes: "Val aan vanaf de brug", map: { id: "elders0001", name: "Kaart van elders" } }, false);
      R.render();
    });
    await page.waitForSelector('#order [data-enc="map"]');
    const bh = await page.locator('#order [data-enc="map"]').evaluate((b) => [b.getBoundingClientRect().height, b.innerText]);
    if (bh[0] < 44 || !/2/.test(bh[1])) throw new Error("knop Kaart: " + JSON.stringify(bh));
    await tap(page, '#order [data-enc="map"]');
    await page.waitForSelector("#mapview:not([hidden]) .mvcv:not([hidden])");
    await page.waitForFunction(() => { const c = document.querySelector("#mapview .mvcv"); if (!c.width) return false; const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4 * 97) if (d[i] !== d[0] || d[i + 1] !== d[1]) n++; return n > 20; });
    const lay = await page.evaluate(() => { const v = document.querySelector("#mapview").getBoundingClientRect(), dk = document.querySelector("#dock").getBoundingClientRect();
      return { over: v.bottom - dk.top, name: document.querySelector("#mv-name").innerText, chips: document.querySelectorAll("#mapview .mvchip").length,
        small: [...document.querySelectorAll("#mapview button:not([hidden])")].filter((b) => b.offsetParent && b.getBoundingClientRect().height < 44).length }; });
    if (lay.over > 1 || lay.name !== "Grot der goblins" || lay.chips !== 2 || lay.small) throw new Error("viewer: " + JSON.stringify(lay));
    await tap(page, '#mapview [data-mv="in"]'); await tap(page, '#mapview [data-mv="fit"]');
    await snap(page, "wp70", "kaart");
    const r0 = await page.evaluate(async () => (await import("/js/state.js")).app.S.active);
    await tap(page, "#next");
    const r1 = await page.evaluate(async () => [(await import("/js/state.js")).app.S.active, !document.querySelector("#mapview").hidden]);
    if (r1[0] === r0 || !r1[1]) throw new Error("Volgende met open kaart: " + JSON.stringify(r1));
    // spatie met de viewer open = Volgende (focus op de viewer, niet op ✕); viewer blijft open
    await page.keyboard.press(" ");
    const r2 = await page.evaluate(async () => [(await import("/js/state.js")).app.S.active, !document.querySelector("#mapview").hidden]);
    if (r2[0] === r1[0] || !r2[1]) throw new Error("spatie met open kaart: " + JSON.stringify(r2));
    // herhaald openen en sluiten: één canvas (vers per kaart), kaart weer getekend
    for (let i = 0; i < 3; i++) { await tap(page, '#mapview [data-mv="close"]'); await tap(page, '#order [data-enc="map"]'); }
    await page.waitForSelector("#mapview .mvcv:not([hidden])");
    if ((await page.locator("#mapview canvas").count()) !== 1) throw new Error("meer dan één canvas na herhaald openen");
    await tap(page, '#mapview .mvchip[data-id="elders0001"]');
    await page.waitForFunction(() => /Kaart van elders/.test(document.querySelector("#mapview .mvmsg")?.innerText || ""));
    await snap(page, "wp70", "ontbreekt");
    await page.keyboard.press("Escape");
    await page.waitForSelector("#mapview", { state: "hidden" });
    if ((await page.evaluate(() => document.activeElement?.dataset.enc)) !== "map") throw new Error("focus niet terug op Kaart");
    // ingeladen encounter weg (monsters gewist) = knop en viewer weg
    await tap(page, '#order [data-enc="map"]'); await page.waitForSelector("#mapview:not([hidden])");
    await page.evaluate(async () => { const { app } = await import("/js/state.js"), R = await import("/js/ui/render.js"); app.S.list = app.S.list.filter((c) => c.kind === "pc"); R.render(); });
    await page.waitForSelector("#mapview", { state: "hidden" });
    if (await page.locator('#order [data-enc="map"]').count()) throw new Error("knop Kaart blijft zonder encounter");
  },
  async einde(page) { await SCEN.fight(page); await tap(page, '#modes [data-setmode="prep"]'); await tap(page, "#stop"); await page.waitForSelector("#esheet .esheet"); },
  async tourf(page) { await SCEN.fight(page); await page.evaluate(async () => { localStorage.setItem("it-tour", "p"); (await import("/js/ui/tour.js")).restartTour(); (await import("/js/ui/render.js")).render(); }); await page.waitForSelector("#tour .tbox"); },
  async eigen(page) {
    await SCEN.monster(page); await tap(page, '#p-montabs [data-prep="custom"]'); await page.waitForSelector("#f-custom", { state: "visible" });
    // WP32 (persona-test EN): "Herkend: …" en de trait voor niet herkende tekst komen uit de catalogus
    await page.fill("#cu-text", "Bog Ork\nArmor Class 14\nHit Points 22 (4d8 + 4)\nDamage Immunities poison\nVrije regel zonder punt\nBite. Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) piercing damage.");
    await page.waitForSelector("#cu-parse .cuok");
    await tap(page, "#cu-parse [data-cuprev]");
    const r = await page.evaluate(() => ({ lang: localStorage.getItem("kevs-i18n-debug") === "xx" ? "xx" : document.documentElement.lang, txt: document.querySelector("#cu-parse").innerText })); // xx: pseudo-tekst, alleen lengte
    if (r.lang === "en" && (!/1 action\b/.test(r.txt) || !/immune to poison/.test(r.txt) || !/Other/.test(r.txt))) throw new Error("herkend/voorbeeld niet Engels: " + r.txt.slice(0, 160));
    if (r.lang === "nl" && (!/1 actie\b/.test(r.txt) || !/Overig/.test(r.txt))) throw new Error("herkend/voorbeeld niet Nederlands: " + r.txt.slice(0, 160));
  },
  // WP22: taalkiezer in Weergave (alleen met --i18n=debug zichtbaar) met de lange statusregel ("Spelers zelf")
  async lang(page) {
    await SCEN.settings(page);
    await page.locator('details[data-sec="look"] > summary').tap();
    await tap(page, '#react-seg [data-react="off"]');
  },
  // WP16: embleem ±34 px vóór het woordmerk, samen op één regel; tagline alleen op het spelersscherm in de wachtstand
  async logo(page) {
    await SCEN.prep(page);
    const r = await page.evaluate(async () => { await document.fonts.ready; const h = document.querySelector("h1"), e = h.querySelector(".emb"), b = e.getBoundingClientRect();
      return { w: Math.round(b.width), top: Math.round(b.top), ht: Math.round(h.getBoundingClientRect().top), hh: Math.round(h.getBoundingClientRect().height), lh: parseFloat(getComputedStyle(h).lineHeight) }; });
    if (r.w < 30 || r.w > 38) throw new Error("embleem " + r.w + " px");
    if (r.hh > 1.6 * r.lh) throw new Error("h1 over meer regels: " + JSON.stringify(r));
  },
  // WP17: statblock op perkament met koperen inkt, ability-knoppen ≥ 44 px, melding met fout-icoon, lijn-iconen geladen
  async huisstijl(page) {
    await SCEN.letters(page);
    const r = await page.evaluate(async () => {
      const u = await import("/js/ui/util.js"); u.toastBad("Test: refusal with icon.");
      const ab = [...document.querySelectorAll(".sb .abil button")].map((b) => Math.round(b.getBoundingClientRect().width));
      const ic = document.querySelector("#undo .li"), t = document.querySelector("#toast .tmsg.bad .tico");
      const cs = (el, p) => el && getComputedStyle(el)[p];
      return { ab, min: Math.min(...ab), undo: ic && Math.round(ic.getBoundingClientRect().width), tico: !!t, vh: !!t?.closest(".tmsg").querySelector(".vh"),
        sb: cs(document.querySelector(".sb"), "backgroundColor"), card: cs(document.querySelector("#order .c"), "backgroundColor") };
    });
    if (!r.ab.length || r.min < 44) throw new Error("ability-knoppen < 44 px: " + r.ab.join(","));
    if (!r.undo || r.undo < 18) throw new Error("undo-icoon ontbreekt of te klein");
    if (!r.tico || !r.vh) throw new Error("foutmelding zonder icoon of \"Let op:\"");
    if (r.sb === "rgb(255, 255, 255)" || r.card === "rgb(255, 255, 255)") throw new Error("statblock/kaart nog wit: " + JSON.stringify(r));
  },
  // WP35: gedeelde componenten. Dock (Volgende het enige gouden vlak buiten een open formulier als ⋯: één primaire knop per context; secundaire knoppen op --btn), ⋯-paneeltje zonder eigen rand,
  // HP-balken even lang (DM Sans zonder tnum), melding boven de dock, schadepaneel (seg zonder omgekeerd vlak, warme dim),
  // desktop 1280: lijst en zijkolom gescheiden, dock binnen de linkerkolom. Eindstand = dialoog (Gevecht afronden).
  // Met --shots=redesign-components ook losse screenshots van dock en paneel (320 px).
  async "redesign-components"(page) {
    await SCEN.fight(page);
    await tap(page, '#order .c.k.turn [data-p="more"]');
    await page.waitForSelector("#order .c.k.turn .kpanel.more");
    const r = await page.evaluate(async () => {
      const u = await import("/js/ui/util.js"); u.toastHtml("Test");
      const cs = (el) => getComputedStyle(el), root = cs(document.documentElement);
      const tok = (k) => { const d = document.createElement("i"); d.style.color = `var(--${k})`; document.body.append(d); const c = cs(d).color; d.remove(); return c; };
      const vis = (el) => { const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 && cs(el).visibility !== "hidden"; };
      const gold = [...document.querySelectorAll("button")].filter((b) => vis(b) && !b.closest(".kpanel") && cs(b).backgroundColor === tok("act")).map((b) => b.id || b.className || b.textContent.trim());
      const sec = ["#undo", "#prev", "#order .c.k.turn .acts button:not(.dmg2):not([aria-pressed=\"true\"])"].map((s) => document.querySelector(s)).filter(Boolean)
        .filter((b) => cs(b).backgroundColor !== tok("btn")).map((b) => b.id || b.textContent.trim());
      const kp = document.querySelector("#order .c.k.turn .kpanel.more");
      const bars = [...document.querySelectorAll("#order .c.k:not(.lair):not(.turn) .khp.hpw .bar")].map((b) => Math.round(b.getBoundingClientRect().width));
      const t = document.querySelector("#toast .tmsg:last-child").getBoundingClientRect(), d = document.querySelector("#dock").getBoundingClientRect();
      return { gold, sec, kpBorder: cs(kp).borderTopWidth, kpBg: cs(kp).backgroundColor === tok("sunk"), bars, toastGap: Math.round(d.top - t.bottom), dockH: root.getPropertyValue("--dock-h").trim(), dh: Math.ceil(d.height) };
    });
    if (r.gold.length !== 1 || !/next/.test(r.gold[0])) throw new Error("gouden knoppen in Gevecht: " + JSON.stringify(r.gold));
    if (r.sec.length) throw new Error("secundaire knop niet op --btn: " + r.sec.join(", "));
    if (r.kpBorder !== "0px" || !r.kpBg) throw new Error("⋯-paneeltje met eigen rand of zonder verzonken vlak");
    if (r.bars.length < 2 || Math.max(...r.bars) - Math.min(...r.bars) > 1) throw new Error("HP-balken ongelijk: " + r.bars.join(","));
    if (r.toastGap < 0) throw new Error(`melding overlapt de dock (${r.toastGap}px)`);
    if (parseInt(r.dockH) !== r.dh) throw new Error(`--dock-h ${r.dockH} ≠ dock ${r.dh}px`);
    await snap(page, "redesign-components", "dock");
    // schadepaneel: gekozen tab = zacht vlak (geen omgekeerd --fg), dim warm
    await page.evaluate(() => document.querySelectorAll("#toast .tmsg").forEach((m) => m.remove()));
    await tap(page, "#order .c.k.turn .khp");
    await page.waitForSelector("#sheet .pad");
    const s = await page.evaluate(() => {
      const cs = (el) => getComputedStyle(el), on = document.querySelector("#sheet .seg2 [aria-pressed=\"true\"]");
      return { onBg: on && cs(on).backgroundColor, fg: cs(document.body).color, dim: cs(document.querySelector("#sheet .dim")).backgroundColor };
    });
    if (s.onBg && s.onBg === s.fg) throw new Error("seg2: gekozen knop nog omgekeerd (--fg-vlak)");
    if (/rgba\(10, 12, 18/.test(s.dim)) throw new Error("paneel-dim nog koel");
    await snap(page, "redesign-components", "paneel");
    await page.keyboard.press("Escape");
    await page.waitForSelector("#sheet", { state: "hidden" });
    // desktop: lijst en zijkolom naast elkaar zonder overloop, dock binnen de linkerkolom
    const vp = page.viewportSize();
    if (vp.width === 320) {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.waitForTimeout(150);
      const k = await page.evaluate(() => {
        const [a, b] = [".wrap>section", "#sbwrap"].map((q) => document.querySelector(q)?.getBoundingClientRect()), d = document.querySelector("#dock").getBoundingClientRect();
        return { gap: b ? Math.round(b.left - a.right) : null, dockR: Math.round(d.right - a.right), h: document.documentElement.scrollWidth - innerWidth };
      });
      if (k.gap === null || k.gap < 8) throw new Error("desktop: lijst en zijkolom niet gescheiden: " + JSON.stringify(k));
      if (k.dockR > 1 || k.h > 0) throw new Error("desktop: dock of pagina loopt over: " + JSON.stringify(k));
      await page.setViewportSize(vp);
      await page.waitForTimeout(150);
    }
    // dialoog: Gevecht afronden (samenvatting)
    await tap(page, '.fhead [data-setmode="prep"]');
    await tap(page, "#stop");
    await page.waitForSelector("#esheet .esheet");
  },
  // WP37 (HS14): homepage huisstijl 2.0. Illustratie geladen (AVIF/WebP via <picture>) en niet hoger dan 260 px op de telefoon,
  // kop op één regel, gouden knop boven de vouw en de enige Lantern-knop, taalkiezer met aria-current, toolkaart ≥ 72 px en
  // hele kaart klikbaar, alle interne links bestaan (geen dode routes). Desktop 1280: tekst links, beeld rechts. --shots=wp37: desktop.
  // WP67: ook de toolkaart Inn Sight (onder Initiative, op 1280 ernaast) en het kopje boven de kenmerken.
  async wp37(page, base) {
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => document.fonts.ready);
    const r = await page.evaluate(() => {
      const img = document.querySelector(".hero-img img"), pic = document.querySelector(".hero-img").getBoundingClientRect();
      const h1 = document.querySelector("h1"), lh = parseFloat(getComputedStyle(h1).lineHeight), cta = document.querySelector(".cta").getBoundingClientRect();
      const gold = [...document.querySelectorAll("a,button")].filter((e) => getComputedStyle(e).backgroundColor === "rgb(227, 168, 59)").length;
      const cur = [...document.querySelectorAll(".lang a[aria-current=page]")].map((a) => a.getAttribute("hreflang"));
      const card = document.querySelector("a.toolcard"), cb = card.getBoundingClientRect();
      const mc = document.querySelector('a.toolcard[href$="/maps/"]'), mb = mc && mc.getBoundingClientRect(), fh = document.getElementById("h-feat");
      const maps = mc && { h: Math.round(mb.height), below: mb.top >= cb.bottom - 1, name: mc.getAttribute("aria-labelledby").split(" ").map((i) => document.getElementById(i).textContent.trim()).join(" "),
        feat: !!fh && fh.getBoundingClientRect().top >= mb.bottom && document.querySelector(".feat").getAttribute("aria-labelledby") === "h-feat" };
      const links = [...new Set([...document.querySelectorAll("a[href^='/']")].map((a) => a.getAttribute("href")))];
      return { loaded: img.complete && img.naturalWidth > 0, src: img.currentSrc.split("/").pop(), picH: Math.round(pic.height), lines: Math.round(h1.getBoundingClientRect().height / lh),
        ctaBottom: Math.round(cta.bottom), vh: innerHeight, gold, cur, lang: document.documentElement.lang, cardH: Math.round(cb.height), name: card.getAttribute("aria-labelledby").split(" ").map((i) => document.getElementById(i).textContent.trim()).join(" "), maps, links };
    });
    if (!r.loaded) throw new Error("illustratie niet geladen: " + r.src);
    if (r.lines !== 1) throw new Error(`h1 op ${r.lines} regels`);
    if (r.picH > 262 || r.picH < 150) throw new Error("illustratie hoogte " + r.picH);
    if (r.ctaBottom > r.vh) throw new Error(`knop onder de vouw (${r.ctaBottom} > ${r.vh})`);
    if (r.gold !== 1) throw new Error("gouden knoppen: " + r.gold);
    if (r.cur.join() !== r.lang) throw new Error("taalkiezer aria-current: " + r.cur.join());
    if (r.cardH < 72 || !/itiative/.test(r.name)) throw new Error("toolkaart: " + JSON.stringify([r.cardH, r.name]));
    // WP67: tweede toolkaart Inn Sight direct onder Initiative (≥ 72 px), kenmerken daarna met een zichtbaar kopje; WP68d: zonder Beta
    if (!r.maps || r.maps.h < 72 || !r.maps.below || !/^Inn Sight /.test(r.maps.name) || /Beta/.test(r.maps.name) || !r.maps.feat) throw new Error("toolkaart Inn Sight: " + JSON.stringify(r.maps));
    for (const href of r.links) { const res = await page.request.get(base + href); if (res.status() !== 200) throw new Error(`link ${href}: ${res.status()}`); }
    if (page.viewportSize().width === 320) {
      const vp = page.viewportSize();
      await page.setViewportSize({ width: 1280, height: 800 }); await page.waitForTimeout(200);
      const d = await page.evaluate(() => {
        const t = document.querySelector(".hero-txt").getBoundingClientRect(), i = document.querySelector(".hero-img").getBoundingClientRect();
        const [a, b] = [...document.querySelectorAll("a.toolcard")].map((e) => e.getBoundingClientRect());
        return { side: i.left >= t.right - 1, h: document.documentElement.scrollWidth - innerWidth, cta: document.querySelector(".cta").getBoundingClientRect().bottom, vh: innerHeight, cards: Math.abs(a.top - b.top) < 1 && b.left > a.right };
      });
      if (!d.side || d.h > 0 || d.cta > d.vh || !d.cards) throw new Error("desktop-hero: " + JSON.stringify(d));
      if (SHOTS.has("wp37")) await page.screenshot({ path: join(ROOT, "shots", `wp37-desktop-${r.lang}-${await page.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")}.png`), fullPage: true });
      await page.setViewportSize(vp); await page.waitForTimeout(150);
    }
  },
  // WP36 (HS12/HS13): speler rond, monster achthoek (vorm hangt aan het soort, ook op spelersscherm en tv), neutrale rand, HP-kleur
  // per fractie gelijk voor speler en monster, beurtvlak gelijk, compacte rijen niet hoger, open legendary-monster met pips op één
  // regel. Twee monstertypes, speler met en zonder portret. Met --shots=wp36: compact, beurt bij speler/monster, open, grijswaarden
  // (320 px) en desktop 1280.
  async wp36(page, base) {
    await SCEN.fight(page);
    const setup = async (activeKind) => page.evaluate(async (ak) => {
      const { app, commit } = await import("/js/state.js"), { render, ui } = await import("/js/ui/render.js"), a = await import("/js/ui/actions.js");
      const L = app.S.list;
      if (!L.some((c) => c.ref === "Adult Black Dragon")) {
        a.addMonsters("Adult Black Dragon", 1, "avg", "each", true);
        L.push(a.newLair("Lair: Adult Black Dragon")); // lair: derde, neutrale vorm (spelersscherm)
        const cv = document.createElement("canvas"); cv.width = cv.height = 48; const g = cv.getContext("2d");
        g.fillStyle = "#7a4a2a"; g.fillRect(0, 0, 48, 48); g.fillStyle = "#e9c9a0"; g.beginPath(); g.arc(24, 20, 11, 0, 7); g.fill();
        const pcs = L.filter((c) => c.kind === "pc"); pcs[0].img = cv.toDataURL("image/jpeg", 0.8); if (pcs[1]) pcs[1].hp = Math.floor(pcs[1].max * 0.2);
        const gob = L.filter((c) => c.ref === "Goblin"); if (gob[0]) gob[0].hp = Math.floor(gob[0].max * 0.4); if (gob[1]) gob[1].hp = 1;
      }
      const t = L.find((c) => (ak === "pc" ? c.kind === "pc" : c.ref === "Adult Black Dragon"));
      app.S.active = t.id; ui.open = t.id; commit(); render();
    }, activeKind);
    const check = () => page.evaluate(() => {
      const cs = (e) => getComputedStyle(e), out = [];
      const tok = (k) => { const d = document.createElement("i"); d.style.color = `var(--${k})`; document.body.append(d); const c = cs(d).color; d.remove(); return c; };
      const cards = [...document.querySelectorAll("#order .c.k:not(.lair)")];
      for (const c of cards) {
        const av = c.querySelector(".av"), pc = c.classList.contains("pc"), st = cs(av), clip = st.clipPath;
        if (pc ? !(st.borderTopLeftRadius === "50%" && clip === "none") : !/polygon/.test(clip)) out.push(`vorm ${c.querySelector(".nm").textContent}: ${st.borderTopLeftRadius} ${clip}`);
        if (st.backgroundColor !== tok("line-strong")) out.push("rand niet neutraal: " + c.querySelector(".nm").textContent);
        if (Math.round(av.getBoundingClientRect().height) !== 32) out.push("avatar niet 32 px");
      }
      // HP-kleur: klasse → kleur, gelijk voor speler en monster
      const col = {};
      for (const i of document.querySelectorAll("#order .c.k .hpw .bar i")) {
        const k = i.className || "ok", kind = i.closest(".c.k").classList.contains("pc") ? "pc" : "mon", v = cs(i).backgroundColor;
        (col[k] ||= {})[kind] = v;
      }
      for (const [k, v] of Object.entries(col)) if (v.pc && v.mon && v.pc !== v.mon) out.push(`HP-kleur ${k} verschilt: ${v.pc} / ${v.mon}`);
      const want = { ok: tok("good"), mid: tok("warn"), low: tok("bad") };
      for (const [k, v] of Object.entries(col)) for (const x of Object.values(v)) if (x !== want[k]) out.push(`HP-kleur ${k} ≠ token`);
      // beurtvlak
      const turn = document.querySelector("#order .c.k.turn .i");
      if (!turn || cs(turn).backgroundColor !== tok("act")) out.push("beurtvlak niet Lantern");
      // compacte rij zonder badges niet hoger dan 92 px (± 2 px op de 90 px van vóór WP36)
      const tall = cards.filter((c) => !c.classList.contains("open") && !c.querySelector(".badges") && c.getBoundingClientRect().height > 92)
        .map((c) => `${c.querySelector(".nm").textContent} ${Math.round(c.getBoundingClientRect().height)}`);
      if (tall.length) out.push("rij te hoog: " + tall.join(", "));
      // HP-balken even lang (7ch), ook 195/195 naast 1/7
      const bars = cards.filter((c) => !c.classList.contains("turn")).map((c) => c.querySelector(".khp .bar")).filter(Boolean).map((b) => Math.round(b.getBoundingClientRect().width));
      if (bars.length > 1 && Math.max(...bars) - Math.min(...bars) > 1) out.push("HP-balken ongelijk: " + bars.join(","));
      return out;
    });
    await setup("pc");
    let bad = await check(); if (bad.length) throw new Error("WP36 (beurt speler): " + bad.join("; "));
    await snap(page, "wp36", "beurt-speler");
    await setup("mon");
    await page.waitForSelector("#order .c.k.open .pips");
    bad = await check(); if (bad.length) throw new Error("WP36 (beurt monster): " + bad.join("; "));
    const pips = await page.evaluate(() => [...document.querySelectorAll("#order .c.k.open .pips")].map((p) => Math.round(p.getBoundingClientRect().height)));
    if (pips.length !== 2 || pips.some((h) => h > 46)) throw new Error("legendary-rijen niet op één regel: " + pips.join(","));
    await page.locator("#order .c.k.open").scrollIntoViewIfNeeded();
    await snap(page, "wp36", "open-monster");
    const gs = await page.addStyleTag({ content: "html{filter:grayscale(1)}" });
    await snap(page, "wp36", "grijs");
    await gs.evaluate((e) => e.remove());
    // spelersscherm (telefoon) en tv: zelfde vormen, rand op de tv ≥ 1,5 px
    for (const [w, h] of [[page.viewportSize().width, 780], [1280, 720]]) {
      const pv = await page.context().newPage();
      await pv.setViewportSize({ width: w, height: h });
      await pv.goto(base + pathFor(await page.evaluate(() => document.documentElement.lang), "/initiative/player/"));
      await pv.waitForSelector("#pv-list .pvc .av");
      const r = await pv.evaluate(() => [...document.querySelectorAll("#pv-list .pvc")].map((c) => {
        const av = c.querySelector(".av"), st = getComputedStyle(av);
        return { kind: ["pc", "monster", "lair"].find((k) => c.classList.contains(k)), r: st.borderTopLeftRadius, clip: st.clipPath, pad: parseFloat(st.paddingTop) };
      }));
      const wrong = r.filter((x) => (x.kind === "pc" ? !(x.r === "50%" && x.clip === "none") : x.kind === "monster" ? !/polygon/.test(x.clip) : !(x.r === "6px" && x.clip === "none")) || x.pad < 1.5);
      if (!["pc", "monster", "lair"].every((k) => r.some((x) => x.kind === k)) || wrong.length) throw new Error(`spelersscherm ${w}px: ` + JSON.stringify(wrong.length ? wrong : r));
      if (w === 1280 && SHOTS.has("wp36") && page.viewportSize().width === 320) await pv.screenshot({ path: join(ROOT, "shots", `wp36-tv-${await pv.evaluate(() => document.documentElement.lang)}-${await pv.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")}.png`) });
      await pv.close();
    }
    if (page.viewportSize().width === 320 && SHOTS.has("wp36")) {
      const vp = page.viewportSize();
      await page.setViewportSize({ width: 1280, height: 800 }); await page.waitForTimeout(150);
      bad = await check(); if (bad.length) throw new Error("WP36 desktop: " + bad.join("; "));
      await page.screenshot({ path: join(ROOT, "shots", `wp36-desktop-${await page.evaluate(() => document.documentElement.lang)}-${await page.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")}.png`) });
      await page.setViewportSize(vp); await page.waitForTimeout(150);
    }
  },
  // WP17-review: spelersscherm "jij aan de beurt" + verbinding kwijt: de kop wordt neutraal en alle tekst blijft leesbaar
  async stale(page) {
    const r = await page.evaluate(() => {
      const n = document.querySelector("#pv-now");
      n.innerHTML = '<div><span class="l">Round 2 · up now</span><b>Aria</b></div><div class="r"><span class="l">Up next</span> Goblin 1</div>'; // alleen opmaak meten: tekst taalneutraal voor de en-run
      n.classList.add("me"); document.body.classList.add("stale"); n.closest(".pvstick")?.classList.remove("off");
      const rgb = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number);
      const lum = (c) => { const v = rgb(c).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
      const bg = getComputedStyle(n).backgroundColor, out = {};
      for (const sel of ["b", ".r", ".l"]) { const a = lum(getComputedStyle(n.querySelector(sel)).color), b = lum(bg); out[sel] = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); }
      return out;
    });
    const low = Object.entries(r).filter(([, v]) => v < 4.5);
    if (low.length) throw new Error("stale + jij onleesbaar: " + low.map(([k, v]) => `${k} ${v.toFixed(2)}`).join(", "));
  },
  // WP28/WP32: DM op Nederlands (tweede tabblad, zelfde browser), spelersscherm op Engels (telefoon én tv): alles Engels,
  // ook onbekend wezen en status; de snapshot (v 2) bevat geen UI-tekst
  async "i18n-mixed"(page, base) {
    const dm = await page.context().newPage();
    await dm.goto(base + "/nl/initiative/");
    await dm.waitForSelector("#dock");
    await SCEN.fight(dm);
    await dm.evaluate(async () => { // alle monsters: naam onbekend, de eerste half HP (status Bloodied/Hurt)
      const { app, commit } = await import("/js/state.js"), { render } = await import("/js/ui/render.js");
      let n = 0;
      for (const c of app.S.list) if (c.kind === "monster") { c.anon = ++n; if (n === 1) c.hp = Math.ceil(c.max / 2); }
      const pc = app.S.list.find((c) => c.kind === "pc"); if (pc) { pc.hp = 0; pc.ds = { s: 1, f: 2 }; } // TA18: death saves op de tv
      const p2 = app.S.list.filter((c) => c.kind === "pc")[1]; if (p2) { p2.cond = [...(p2.cond || []), "Concentrating"]; p2.concSpell = "Hypnotic Pattern of the Shimmering Long Name"; } // lange tag
      commit(); render();
    });
    // met --i18n=xx staat er testtaal: dan alleen wachten op de onbekende wezens (lengte op 320 px), niet op Engels
    const xx = await page.evaluate(() => localStorage.getItem("kevs-i18n-debug") === "xx");
    await page.waitForFunction((x) => [...document.querySelectorAll("#pv-list .pvc .av")].some((a) => a.innerHTML.includes("unknown")) && (x || /Unknown creature/.test(document.querySelector("#pv-list").innerText)), xx, { timeout: 5000 });
    const txt = await page.locator("main").innerText();
    // tv: zelfde stand op een groot scherm in het Engels (tv-stand, geen Nederlandse tekst)
    const tv = await page.context().newPage();
    await tv.setViewportSize({ width: 1280, height: 720 });
    await tv.goto(base + "/initiative/player/");
    await tv.waitForFunction((x) => document.body.classList.contains("tv") && (x || /Unknown creature/.test(document.querySelector("#pv-list").innerText)), xx, { timeout: 5000 });
    const tvTxt = await tv.locator("main").innerText();
    const ds = await tv.evaluate(() => { const b = document.querySelector("#pv-list .bd.r"), v = b && b.querySelector("[aria-hidden]"); // zichtbare deel; .vh telt niet
      return v ? { cut: Math.round(v.getBoundingClientRect().right - b.getBoundingClientRect().right), icons: v.querySelectorAll("svg").length } : null; });
    if (!ds || ds.cut > 1 || ds.icons < 2) throw new Error("death saves op de tv afgekapt of zonder iconen: " + JSON.stringify(ds));
    const wide = await tv.evaluate(() => [...document.querySelectorAll("#pv-list .pvc")].map((r) => r.scrollWidth - r.clientWidth).filter((d) => d > 1));
    if (wide.length) throw new Error("tv-rij breder dan het scherm: " + wide.join(", ") + " px");
    await tv.close();
    await dm.close();
    if (xx) return;
    const nlTv = tvTxt.split("\n").filter((l) => isDutch(l));
    if (nlTv.length) throw new Error("Nederlandse tekst op de Engelse tv: " + nlTv.slice(0, 3).join(" | "));
    if (!/Round \d/i.test(txt)) throw new Error("kop niet Engels: " + txt.slice(0, 120));
    if (!/Unknown creature/.test(txt)) throw new Error("geen 'Unknown creature': " + txt.slice(0, 200));
    if (/Ronde|aan de beurt|Daarna|Onbekend|Ongedeerd|Gewond|Bijna dood/i.test(txt)) throw new Error("Nederlandse tekst op het Engelse spelersscherm: " + txt.slice(0, 200));
  },
  // WP32: taal wisselen tijdens een gevecht (debugstand: kiezer zichtbaar): stand, undo en kamer blijven
  async "i18n-switch"(page) {
    await page.evaluate(() => { localStorage.setItem("kevs-i18n-debug", "debug");
      localStorage.setItem("it-room", JSON.stringify({ code: "E5HMTJ", token: "t".repeat(32), stopped: true, at: Date.now() })); });
    await page.reload(); await page.waitForSelector("#dock");
    await SCEN.fight(page);
    const state = () => page.evaluate(async () => { const { app } = await import("/js/state.js"); return { round: app.S.round, active: app.S.active, n: app.S.list.length, log: app.S.log.length }; });
    const s0 = await state();
    await tap(page, "#next");
    const s1 = await state();
    if (s1.active === s0.active && s1.round === s0.round) throw new Error("Volgende deed niets");
    await tap(page, '#modes [data-setmode="prep"]'); await tap(page, '#dock [data-prep="data"]'); await page.waitForSelector("#psheet .sheet", { state: "visible" });
    await page.locator('details[data-sec="look"] > summary').tap();
    await Promise.all([page.waitForURL((u) => u.pathname === "/initiative/"), tap(page, '#lang-seg [data-lang="en"]')]); // WP44: Engels zonder /en/
    await page.waitForSelector("#dock");
    const lang = await page.evaluate(() => document.documentElement.lang);
    const s2 = await state();
    if (lang !== "en") throw new Error("pagina niet Engels: " + lang);
    if (s2.round !== s1.round || s2.active !== s1.active || s2.n !== s1.n) throw new Error("stand na wisselen anders: " + JSON.stringify([s1, s2]));
    if (await page.locator("#undo").isDisabled()) throw new Error("undo-geschiedenis weg na wisselen");
    await tap(page, "#undo");
    await page.waitForSelector("#toast .tmsg");
    const s3 = await state(), toast = await page.locator("#toast").innerText();
    if (s3.active !== s0.active || s3.round !== s0.round) throw new Error("undo na wisselen zette de beurt niet terug: " + JSON.stringify([s0, s3]));
    if (isDutch(toast)) throw new Error("undo-melding Nederlands: " + toast);
    const room = await page.evaluate(() => JSON.parse(localStorage.getItem("it-room") || "null"));
    if (!room || room.code !== "E5HMTJ") throw new Error("kamer weg na wisselen");
    await tap(page, '#modes [data-setmode="prep"]'); await tap(page, '#dock [data-prep="data"]'); await page.waitForSelector("#psheet .sheet", { state: "visible" });
    await page.locator('details[data-sec="player"] > summary').tap();
    const kb = await page.locator("#kamer-box").innerText();
    if (!/E5H\s?MTJ/.test(kb)) throw new Error("kamercode niet in het kamer-blok: " + kb.slice(0, 120));
  },
  // WP32: één bezoek (nl) met de service worker, daarna offline: beide talen, spelersscherm, homepages, oud spelersadres
  // en (WP44) een oud /en/-adres via de service worker
  async "i18n-offline"(page, base) {
    const ctx = await page.context().browser().newContext({ serviceWorkers: "allow", locale: "nl-NL" }); // taalloze adressen volgen sinds WP33 de browsertaal
    const p = await ctx.newPage();
    try {
      await p.goto(base + "/nl/initiative/"); await p.waitForSelector("#dock");
      // main.js registreert alleen op https; hier dezelfde registratie (zelfde bestand en scope) op de http-testserver
      // wachten tot hij actief is en de pagina bestuurt (activate + clients.claim); waitForFunction wacht niet op een async predikaat
      const ready = await p.evaluate(async () => {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;
        for (let i = 0; i < 100 && !navigator.serviceWorker.controller; i++) await new Promise((r) => setTimeout(r, 100));
        return !!navigator.serviceWorker.controller;
      });
      if (!ready) throw new Error("service worker bestuurt de pagina niet");
      OFFLINE = true;
      for (const [u, sel, lang] of [["/initiative/", "#dock", "en"], ["/nl/initiative/", "#dock", "nl"], ["/initiative/player/", "#pv-wait", "en"], ["/speler", "#pv-wait", "en"],
        ["/", "main", "en"], ["/nl/", "main", "nl"], ["/en/initiative/", "#dock", "en"]]) {
        await p.goto(base + u);
        await p.waitForSelector(sel, { state: "attached", timeout: 8000 }).catch(async () => { throw new Error(`offline ${u}: ${sel} ontbreekt (${p.url()}): ${(await p.evaluate(() => document.body?.innerText || "")).slice(0, 80)}`); });
        const l = await p.evaluate(() => document.documentElement.lang);
        if (l !== lang) throw new Error(`offline ${u}: lang ${l}, verwacht ${lang}`);
        const unt = await p.evaluate(() => /⟦/.test(document.body.innerText));
        if (unt) throw new Error(`offline ${u}: ontbrekende vertaling`);
      }
    } finally { OFFLINE = false; await ctx.close(); }
  },
  // WP33/WP44: geen automatische taalredirect meer. "/" is voor elke browsertaal de Engelse homepage, een oud spelersadres
  // gaat naar het Engelse spelersscherm (met ?k=); een bestaande gebruiker (it-*, geen voorkeur) krijgt bij het openen
  // van de app nog wel stil de voorkeur nl (voor zijn geïnstalleerde app); taalkiezer zichtbaar.
  async wp33(page, base) {
    const browser = page.context().browser();
    const visit = async (locale, seed, steps) => {
      const ctx = await browser.newContext({ locale });
      if (seed) await ctx.addInitScript(() => { if (!localStorage.getItem("bc-seeded")) { localStorage.setItem("it-tour", "pf"); localStorage.setItem("bc-seeded", "1"); } });
      const p = await ctx.newPage();
      try { for (const [u, want, sel, lang] of steps) {
        await p.goto(base + u);
        await p.waitForSelector(sel, { state: "attached" });
        const at = new URL(p.url());
        if (at.pathname !== want) throw new Error(`${locale}${seed ? " (bestaand)" : ""} ${u}: ${p.url()}, verwacht ${want}`);
        const l = await p.evaluate(() => document.documentElement.lang);
        if (l !== lang) throw new Error(`${u}: lang ${l}, verwacht ${lang}`);
      } return p; } catch (e) { await ctx.close(); throw e; }
    };
    for (const loc of ["en-US", "nl-NL"]) {
      const a = await visit(loc, false, [["/", "/", "main", "en"], ["/speler?k=ABC234", "/initiative/player/", "#pv-wait", "en"]]);
      if (!(await a.url()).includes("?k=ABC234")) throw new Error("?k= weg na doorverwijzen");
      await a.context().close();
    }
    const c = await visit("nl-NL", true, [["/initiative/", "/initiative/", "#dock", "en"]]);
    if (await c.evaluate(() => document.querySelector("#lang-seg")?.hidden !== false)) throw new Error("taalkiezer verborgen in Instellingen");
    const pref = await c.evaluate(() => JSON.parse(localStorage.getItem("kevs-lang") || "null"));
    if (!pref || pref.lang !== "nl") throw new Error("bestaande gebruiker kreeg geen voorkeur nl: " + JSON.stringify(pref));
    await c.context().close();
  },
  // WP44 (WB1, WB2): /en/… → 301 naar het pad zonder /en/ (query blijft); K10: ook een geïnstalleerde app blijft in de
  // taal van zijn pad (één app per taal, geen launchRedirect); homepage (/ en /nl/) volgt een bewuste themakeuze uit de app, anders het systeem
  // (ook zonder JavaScript en bij een systeemwissel zonder herladen), zonder flits van het verkeerde thema.
  async wp44(page, base) {
    const browser = page.context().browser();
    const resp = await page.goto(base + "/en/initiative/?x=1");
    const chain = []; for (let r = resp.request().redirectedFrom(); r; r = r.redirectedFrom()) chain.push(r.url());
    if (new URL(page.url()).pathname + new URL(page.url()).search !== "/initiative/?x=1" || chain.length !== 1) throw new Error(`/en/ niet in één stap: ${chain.join(" → ")} → ${page.url()}`);
    // geïnstalleerde app (display-mode standalone nagebootst)
    for (const [standalone, want] of [[true, "/initiative/"], [false, "/initiative/"]]) {
      const ctx = await browser.newContext({ locale: "en-US" });
      await ctx.addInitScript((sa) => {
        try { localStorage.setItem("it-tour", "pf"); localStorage.setItem("kevs-lang", JSON.stringify({ lang: "nl", t: 1 })); } catch { /* */ }
        const mm = window.matchMedia.bind(window);
        window.matchMedia = (q) => (/display-mode: standalone/.test(q) ? { matches: sa, media: q, addEventListener() {}, removeEventListener() {} } : mm(q));
      }, standalone);
      const p = await ctx.newPage();
      await p.goto(base + "/initiative/"); await p.waitForURL((u) => u.pathname === want, { timeout: 8000 }).catch(() => {});
      await p.waitForSelector("#dock");
      const at = new URL(p.url()).pathname;
      await ctx.close();
      if (at !== want) throw new Error(`app ${standalone ? "geïnstalleerd" : "website"} met voorkeur nl: ${at}, verwacht ${want}`);
    }
    // homepage-thema
    const BG = { light: "rgb(250, 246, 236)", dark: "rgb(29, 19, 13)" };
    for (const path of ["/", "/nl/"]) for (const scheme of ["light", "dark"]) for (const pick of [null, "light", "dark", "system"]) {
      const ctx = await browser.newContext({ colorScheme: scheme });
      await ctx.addInitScript((v) => {
        try { if (v && v !== "system") localStorage.setItem("it-theme", v); } catch { /* */ }
        document.addEventListener("DOMContentLoaded", () => { window.__bg0 = getComputedStyle(document.body).backgroundColor; });
      }, pick);
      const p = await ctx.newPage();
      await p.goto(base + path, { waitUntil: "domcontentloaded" });
      const want = !pick || pick === "system" ? scheme : pick;
      const [bg0, bg, dt] = await p.evaluate(() => [window.__bg0, getComputedStyle(document.body).backgroundColor, document.documentElement.dataset.theme || ""]);
      if (bg0 !== BG[want] || bg !== BG[want]) { await ctx.close(); throw new Error(`${path} systeem ${scheme}, app ${pick}: achtergrond ${bg0} → ${bg}, verwacht ${want}`); }
      if (!pick || pick === "system") { // systeemwissel op een open pagina: zonder herladen mee
        const other = scheme === "light" ? "dark" : "light";
        await p.emulateMedia({ colorScheme: other });
        const bg2 = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
        if (bg2 !== BG[other] || dt) { await ctx.close(); throw new Error(`${path}: systeemwissel niet gevolgd (${bg2}, data-theme "${dt}")`); }
      } else { // bewuste keuze blijft bij een systeemwissel
        await p.emulateMedia({ colorScheme: scheme === "light" ? "dark" : "light" });
        if (await p.evaluate(() => getComputedStyle(document.body).backgroundColor) !== BG[pick]) { await ctx.close(); throw new Error(`${path}: keuze ${pick} losgelaten bij systeemwissel`); }
      }
      await ctx.close();
    }
    // zonder JavaScript: systeem
    for (const scheme of ["light", "dark"]) {
      const ctx = await browser.newContext({ colorScheme: scheme, javaScriptEnabled: false });
      const p = await ctx.newPage(); await p.goto(base + "/");
      const bg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor); // evaluate werkt ook met de paginascripts uit
      await ctx.close();
      if (bg !== BG[scheme]) throw new Error(`zonder JS ${scheme}: ${bg}`);
    }
    await page.goto(base + "/"); await page.waitForSelector("main");
  },
  // WP32: export van 1.48.0 (Nederlands logboek zonder descriptoren) importeren in de Engelse app: oude regels blijven
  // zoals ze waren, nieuwe regels in het Engels, undo werkt, geen fouten
  async "i18n-legacy"(page) {
    await page.locator("#imp-backup").setInputFiles({ name: "kevs-inn-itiative-1.48.0.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(LEGACY)) });
    await page.waitForSelector("#imp-yes", { state: "attached" });
    await page.$eval("#imp-yes", (b) => b.click());
    await page.waitForFunction(() => /Goblin 2/.test(document.querySelector("#order")?.innerText || "")); // Goblin 1 (0 HP) staat ingeklapt in Down (1)
    if (!(await page.locator("#logopen").count())) await tap(page, '#modes [data-setmode="fight"]');
    await tap(page, "#logopen"); await page.waitForSelector("#gsheet .gsheet");
    const old = await page.locator("#gsheet").innerText();
    if (!/Goblin 1: 7 schade \(Longsword\)/.test(old)) throw new Error("oude logregel niet zoals opgeslagen: " + old.slice(0, 200));
    if (/⟦/.test(old)) throw new Error("oude logregel als ⟦sleutel⟧");
    await page.$eval('#gsheet .dim[data-log="close"], #gsheet button[data-log="close"]', (b) => b.click());
    await page.waitForSelector("#gsheet .gsheet", { state: "detached" });
    const n0 = await page.evaluate(async () => (await import("/js/state.js")).app.S.log.length);
    await tap(page, "#next");
    const last = await page.evaluate(async (n) => { const { app } = await import("/js/state.js"), { logMsg } = await import("/js/log.js"); return app.S.log.slice(n).map(logMsg); }, n0);
    if (!last.length) throw new Error("Volgende schreef geen logregel");
    if (last.some((m) => isDutch(m))) throw new Error("nieuwe logregel Nederlands: " + last.join(" | "));
    await tap(page, "#undo"); await page.waitForSelector("#toast .tmsg");
  },
  // WP50: Rage 2024-regel in de beurtbalk (langere tekst, elke beurt) en Exhaustion 2024 bij wie aan de beurt is: past op 320 px
  async wp50(page) {
    await SCEN.fight(page);
    const ok = await page.evaluate(async () => {
      const { app } = await import("/js/state.js"), E = await import("/js/rules/effects.js"), { makeDur } = await import("/js/rules/turns.js");
      app.S.rules = "2024"; const c = app.S.list.find((x) => x.id === app.S.active);
      E.setExh(c, 2, undefined, "2024"); E.startRage(c, makeDur(c, { dur: "r100" }, c.id), { ed: "2024" });
      (await import("/js/ui/render.js")).render();
      return !!document.querySelector(".rgrow");
    });
    if (!ok) throw new Error("WP50: geen Rage-regel in de beurtbalk");
    await snap(page, "wp50", "rage");
  },
  // WP51: surprise 2024 in het initiative-paneel: eigen hint, Rol = twee d20's voor verraste spelers, Start zonder overgeslagen beurt
  async wp51(page) {
    await SCEN.prep(page);
    await page.evaluate(async () => { (await import("/js/state.js")).app.S.rules = "2024"; });
    await tap(page, "#start"); await page.waitForSelector("#isheet .isheet");
    await page.locator('[data-ia="roll"]').first().tap(); // eerst gerold, daarna Verrast: die worp moet opnieuw
    await tap(page, '#isheet [data-ia="sur"][data-v="pc"]');
    if ((await page.locator("#isheet").textContent()).includes("d20 [")) throw new Error("WP51: worp zonder disadvantage bleef staan na Verrast");
    const hint = await page.locator("#isheet #i-surh").textContent();
    if (!/d20/.test(hint)) throw new Error("WP51: geen 2024-hint bij Verrast: " + hint);
    await page.locator('[data-ia="roll"]').first().tap();
    if (!(await page.locator("#isheet").textContent()).includes(" dis ")) throw new Error("WP51: verraste speler rolde zonder disadvantage");
    await snap(page, "wp51", "initp");
    const n = await page.locator('[data-ia="roll"]').count();
    for (let i = 0; i < n; i++) await page.locator('[data-ia="roll"]').nth(i).tap();
    await tap(page, '[data-ia="go"]'); await page.waitForSelector("#next");
    const sur = await page.evaluate(async () => (await import("/js/state.js")).app.S.list.some((c) => "sur" in c));
    if (sur) throw new Error("WP51: 2024 zette toch sur");
  },
  // WP46: export versie 4 (regelset 2024, monster met ed "2024" zonder SRD 5.2-data): laden zonder JS-fout, zonder terugval op 2014, regelset overleeft reset
  async wp46(page) {
    await page.route("**/data/monsters-2024.json", (r) => r.abort()); // zonder SRD 5.2-data (regelset 2024 laadt hem sinds WP49 bij de eerste behoefte)
    const v4 = { format: "initiative-tafel", version: 4, state: { round: 0, active: null, rules: "2024", list: [
      { id: "g", name: "Goblin", kind: "monster", ref: "Goblin", init: 12, dex: 2, ac: 15, hp: 7, max: 7, cond: [] },
      { id: "z", name: "Zombie", kind: "monster", ref: "Zombie", ed: "2024", init: 6, dex: -2, ac: 8, hp: 15, max: 15, cond: [] } ] },
      party: [], lairs: {}, custom: [], imported: [], encounters: [{ id: "e1", name: "Graf", updatedAt: 1, monsters: [{ ref: "Zombie", n: 2, ed: "2024" }] }] };
    await page.locator("#imp-backup").setInputFiles({ name: "wp46.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(v4)) });
    await page.waitForSelector("#imp-yes", { state: "attached" });
    await page.$eval("#imp-yes", (b) => b.click());
    await page.waitForFunction(() => /Zombie/.test(document.querySelector("#order")?.innerText || ""));
    const st = await page.evaluate(async () => { const { app } = await import("/js/state.js"), { findMon } = await import("/js/data/monsters.js"), z = app.S.list.find((c) => c.id === "z");
      return { rules: app.S.rules, ed: z.ed, sb: !!findMon(z.ref, z.ed), enc: app.encounters[0]?.monsters[0]?.ed }; });
    if (st.rules !== "2024" || st.ed !== "2024" || st.sb || st.enc !== "2024") throw new Error("WP46 import: " + JSON.stringify(st));
    await snap(page, "wp46", "list");
    // B1: regelset blijft bij "Alles wissen" en bij Ongedaan daarvan
    const rules = () => page.evaluate(async () => (await import("/js/state.js")).app.S.rules);
    await tap(page, "#reset"); await page.waitForSelector("#reset-yes"); await tap(page, "#reset-yes");
    await page.waitForFunction(async () => !(await import("/js/state.js")).app.S.list.length);
    if ((await rules()) !== "2024") throw new Error("WP46: regelset weg na Alles wissen");
    await page.evaluate(async () => { const s = await import("/js/state.js"); s.undo(); });
    await page.waitForFunction(async () => (await import("/js/state.js")).app.S.list.length === 2);
    if ((await rules()) !== "2024") throw new Error("WP46: regelset weg na Ongedaan");
  },
  // TA18 (persona-test EN): statblock-knop in de actierij op één regel, hit dice niet in hoofdletters, SRD-markdown als opmaak
  async ta18(page) {
    await SCEN.prep(page);
    const mon = page.locator("#order .c.k.mon").first();
    if (!(await mon.evaluate((el) => el.classList.contains("open")))) await mon.locator(".khead").tap();
    await mon.locator('[data-a="sb"]').waitFor();
    const r = await mon.evaluate((el) => {
      const b = el.querySelector('[data-a="sb"]'), rg = document.createRange(); rg.selectNodeContents(b);
      const lines = new Set([...rg.getClientRects()].map((x) => Math.round(x.top))).size;
      const hd = el.querySelector("small.nocase");
      return { lines, hd: hd && getComputedStyle(hd).textTransform, hdTxt: hd && hd.textContent };
    });
    if (r.lines > 1) throw new Error(`statblock-knop over ${r.lines} regels`);
    if (r.hd !== "none" || /D/.test(r.hdTxt || "")) throw new Error("hit dice in hoofdletters: " + JSON.stringify(r));
    const md = await page.evaluate(async () => { const { diceify } = await import("/js/ui/statblock.js"); return diceify("12 (15 with _mage armor_) and **Fire Breath.**"); });
    if (!/<i>mage armor<\/i>/.test(md) || !/<b>Fire Breath\.<\/b>/.test(md)) throw new Error("markdown niet omgezet: " + md);
  },
  // WP54 (G1): Instellingen → Regels 2014 | 2024. Status in de kop, Spells-subinstelling alleen bij 2014, wisselen = melding
  // met Ongedaan + logregel, tijdens een gevecht uitgeschakeld; voorbeeld bij 2024 met SRD 5.2 (Goblin Warrior).
  // --shots=g1-rules: 2014 met Spells 2024, 2024, gevecht.
  async "g1-rules"(page) {
    const stat = () => page.locator('[data-sstat="rules"]').textContent();
    const S = () => page.evaluate(async () => { const { app } = await import("/js/state.js"); return { rules: app.S.rules, log: (app.S.log || []).length, list: app.S.list.map((c) => c.ref + (c.ed ? "·" + c.ed : "")) }; });
    // regels 2024 op de welkomstkaart (lege lijst): het voorbeeld laadt SRD 5.2
    await page.waitForSelector("#welcome-sample");
    await tap(page, '#dock [data-prep="data"]'); await page.waitForSelector("#psheet .sheet", { state: "visible" });
    await page.locator('details[data-sec="rules"] > summary').tap();
    if ((await stat()) !== "2014") throw new Error("WP54: status bij de start is niet 2014: " + (await stat()));
    await tap(page, '#rules-seg [data-rules="2024"]');
    await page.waitForFunction(() => /^2014 · .+ 2024$/.test(document.querySelector('[data-sstat="rules"]').textContent)); // "Spells" via de catalogus
    await snap(page, "g1-rules", "spells24");
    await tap(page, '#ruleset-seg [data-ruleset="2024"]');
    await page.waitForFunction(() => document.querySelector('[data-sstat="rules"]').textContent === "2024");
    if (await page.locator("#spells-sub").isVisible() || !(await page.locator("#spells-24").isVisible())) throw new Error("WP54: Spells-subinstelling zichtbaar bij 2024");
    await page.locator("#toast-undo").first().waitFor({ state: "visible" });
    await snap(page, "g1-rules", "r2024");
    if ((await S()).rules !== "2024") throw new Error("WP54: S.rules niet 2024");
    await tap(page, '#psheet .shead [data-prep="close"]');
    await tap(page, "#welcome-sample");
    await page.waitForFunction(async () => (await import("/js/state.js")).app.S.list.some((c) => c.ref === "Goblin Warrior" && c.ed === "2024"), null, { timeout: 15000 });
    const st = await S();
    if (st.list.filter((x) => x === "Goblin Warrior·2024").length !== 2 || !st.list.includes("Hobgoblin Warrior·2024")) throw new Error("WP54: voorbeeld 2024: " + JSON.stringify(st));
    await page.waitForSelector("#start:not([disabled])");
    // Ongedaan van de wissel zet hem terug (de wissel is de stap vóór het voorbeeld)
    await page.evaluate(async () => { const s = await import("/js/state.js"), { render } = await import("/js/ui/render.js"); s.undo(); s.undo(); render(); });
    if ((await S()).rules !== undefined) throw new Error("WP54: Ongedaan zette de regels niet terug");
    await page.evaluate(async () => { const s = await import("/js/state.js"), { render } = await import("/js/ui/render.js"); s.redo(); render(); });
    if ((await S()).rules !== "2024") throw new Error("WP54: Opnieuw zette de regels niet terug");
    // tijdens een gevecht: uitgeschakeld met uitleg
    await page.evaluate(async () => { const s = await import("/js/state.js"), { render } = await import("/js/ui/render.js"); s.redo(); render(); });
    await tap(page, "#start");
    const n = await page.locator('[data-ia="roll"]').count();
    for (let i = 0; i < n; i++) await page.locator('[data-ia="roll"]').nth(i).tap();
    if (n) await tap(page, '[data-ia="go"]');
    await page.waitForSelector("#next");
    await tap(page, '#modes [data-setmode="prep"]');
    await tap(page, '#dock [data-prep="data"]'); await page.waitForSelector("#psheet .sheet", { state: "visible" });
    if (!(await page.locator('details[data-sec="rules"]').evaluate((d) => d.open))) await page.locator('details[data-sec="rules"] > summary').tap();
    const dis = await page.locator("#ruleset-seg button").evaluateAll((bs) => bs.map((b) => b.disabled));
    if (dis.some((x) => !x)) throw new Error("WP54: regelkeuze niet uitgeschakeld tijdens een gevecht");
    await snap(page, "g1-rules", "gevecht");
  },
  async tagline(page) { if (!(await page.locator("#pv-tag").isVisible())) throw new Error("tagline niet zichtbaar in de wachtstand"); },
};

// Meting in de pagina: horizontaal scrollen en zichtbare tikdoelen kleiner dan 44 px.
// Uitzondering (AF14): .dice in lopende tekst (WCAG 2.5.8, inline target).
function measure() {
  const vw = innerWidth, de = document.documentElement;
  const sel = "button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [data-a], .chk";
  const small = [];
  for (const el of document.querySelectorAll(sel)) {
    if (el.closest(".dice, [inert], [hidden]") || el.matches(".dice")) continue;
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    if (!r.width || !r.height || cs.visibility === "hidden" || cs.display === "none") continue;
    if (el.matches("input[type=checkbox], input[type=radio]") && el.closest("label")) continue; // het label is het tikvlak
    if (r.width < 44 - 0.5 || r.height < 44 - 0.5) {
      const id = el.id ? "#" + el.id : el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).join(".") : el.tagName.toLowerCase();
      small.push(`${el.tagName.toLowerCase()}${id.startsWith("#") || id.startsWith(".") ? id : ""} ${Math.round(r.width)}×${Math.round(r.height)} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 24)}"`);
    }
  }
  const txt = document.body.innerText; // zichtbare tekst (ook geopende panelen); attributen als aria-label tellen niet mee
  return { hscroll: Math.max(de.scrollWidth, document.body.scrollWidth) - vw, small, unt: (txt.match(/⟦[^⟧]*⟧/g) || []).slice(0, 3), lang: document.documentElement.lang, lines: [...new Set(txt.split("\n").map((l) => l.trim()).filter(Boolean))] };
}

async function main() {
  const args = process.argv.slice(2);
  const shots = new Set((args.find((a) => a.startsWith("--shots=")) || "").slice(8).split(",").filter(Boolean));
  const only = args.filter((a) => !a.startsWith("--"));
  let i18n = (args.find((a) => a.startsWith("--i18n=")) || "").slice(7);
  if (i18n && !["xx", "debug"].includes(i18n)) throw new Error("--i18n=xx of --i18n=debug");
  let langs = (args.find((a) => a.startsWith("--lang=")) || "--lang=nl").slice(7).split(",").filter(Boolean);
  if (i18n === "xx") { langs = ["xx"]; i18n = ""; } // oud: --i18n=xx
  if (langs.some((l) => !["nl", "en", "xx"].includes(l))) throw new Error("--lang=nl,en,xx");
  const names = only.length ? only : Object.keys(SCEN);
  const bad = names.filter((n) => !(n in SCEN));
  if (bad.length) throw new Error("Onbekend scenario: " + bad.join(", "));

  const { chromium } = await loadPw();
  const srv = await serve(), base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch();
  if (shots.size) await mkdir(join(ROOT, "shots"), { recursive: true });
  SHOTS = shots;
  let fails = 0;
  try {
    for (const lang of langs) for (const name of names) for (const w of WIDTHS) for (const scheme of SCHEMES) {
      if (ONCE.has(name) && lang !== langs[0]) continue;
      const mode = lang === "xx" ? "xx" : i18n, pl = lang === "xx" ? "en" : lang;
      const ctx = await browser.newContext({ viewport: { width: w, height: 740 }, hasTouch: true, isMobile: true, colorScheme: scheme, deviceScaleFactor: 2, serviceWorkers: "block" });
      await ctx.addInitScript((m) => { try { localStorage.setItem("it-tour", "pf"); if (m) localStorage.setItem("kevs-i18n-debug", m); } catch { /* geen opslag */ } }, mode);
      if (INIT[name]) await ctx.addInitScript(INIT[name]);
      const page = await ctx.newPage(), errs = [];
      page.on("pageerror", (e) => errs.push(e.message));
      page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
      page.on("response", (r) => { const u = new URL(r.url()); if (r.status() >= 400 && u.origin === base && !u.pathname.startsWith("/api/")) errs.push(`${r.status()} ${u.pathname}`); });
      try {
        await page.goto(base + startFor(name, pl));
        if (SCEN[name]) { if (!START[name] || /\/initiative\/$/.test(START[name])) await page.waitForSelector("#dock"); await SCEN[name](page, base); }
        else await page.waitForLoadState("networkidle");
        if (process.env.BC_PROBE) await page.evaluate(() => document.body.insertAdjacentHTML("afterbegin", '<button id="probe" style="width:30px;height:30px">x</button>'));
        await page.evaluate(() => document.fonts.ready); // de huisletter (DM Sans) is anders breed dan de terugvalletter: meten met de echte letter
        await page.waitForTimeout(150);
      } catch (e) { errs.push("scenario: " + e.message.split("\n")[0]); }
      const m = await page.evaluate(measure).catch((e) => ({ hscroll: NaN, small: [], err: e.message }));
      if (m.unt && m.unt.length) errs.push("niet vertaald: " + m.unt.join(" "));
      // WP32: in en geen Nederlandse tekst op het scherm (behalve wat het scenario zelf intypt; de oude export is inhoud)
      if (m.lang === "en" && mode !== "xx" && name !== "i18n-legacy" && m.lines) { // taal van de pagina (i18n-switch eindigt op de Engelse app)
        const nl = m.lines.filter((l) => isDutch(noPaths(OWN.reduce((x, o) => x.split(o).join(" "), l))));
        if (nl.length) errs.push("Nederlandse tekst: " + nl.slice(0, 3).map((l) => JSON.stringify(l.slice(0, 60))).join(" | "));
      }
      const ok = m.hscroll <= 0 && !errs.length;
      if (!ok) fails++;
      console.log(`${ok ? "ok  " : "FOUT"} ${lang} ${name.padEnd(12)} ${w} ${scheme.padEnd(5)} hscroll ${m.hscroll > 0 ? m.hscroll + "px" : 0} · tikdoelen<44 ${m.small.length}${errs.length ? " · JS: " + errs.join(" | ") : ""}`);
      if (m.small.length && w === 320 && scheme === "light") for (const s of m.small.slice(0, 12)) console.log("       " + s);
      if (shots.has(name) && w === 320) await page.screenshot({ path: join(ROOT, "shots", `${name}-${lang}-${w}-${scheme}.png`), fullPage: false });
      await ctx.close();
    }
  } finally { await browser.close(); srv.close(); }
  console.log(fails ? `\n${fails} combinatie(s) met horizontaal scrollen, JS-fouten of ⟦…⟧.` : "\nGeen horizontaal scrollen, geen JS-fouten, geen ⟦…⟧.");
  process.exitCode = fails ? 1 : 0;
}

main().catch((e) => { console.error(e.message); process.exitCode = 2; });
