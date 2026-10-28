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

process.env.PLAYWRIGHT_BROWSERS_PATH ||= "/opt/pw-browsers";
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const WIDTHS = [320, 360, 390], SCHEMES = ["light", "dark"];

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
  "i18n-switch": "/nl/initiative/", "i18n-offline": "/nl/initiative/", "i18n-legacy": "/initiative/", wp33: "/", wp37: "/nl/", wp43: "/initiative/", wp44: "/", maps: "/nl/maps/", wp57: "/nl/maps/" };
// Eigen taalopzet: niet per taal herhalen (WP32)
const ONCE = new Set(["i18n-mixed", "i18n-switch", "i18n-offline", "i18n-legacy", "homeen", "wp33", "wp43", "wp44"]);
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
const tap = (page, sel) => page.locator(sel).first().tap();
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
    await tap(page, "#m-fit"); await page.waitForTimeout(50);
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
    await tap(page, "#m-fit"); await page.waitForTimeout(50);
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
    const tabs = await page.evaluate(() => [...document.querySelectorAll(".mdock button")].every((b) => b.getAttribute("tabindex") === "-1"));
    if (!tabs) throw new Error("dockknoppen bereikbaar met Tab onder het open paneel");
    await page.keyboard.press("Escape"); await frame();
    const cl = await page.evaluate(() => ({ hid: document.getElementById("m-sheet").hidden, foc: document.activeElement?.id, exp: document.getElementById("m-set").getAttribute("aria-expanded") }));
    if (!cl.hid || cl.foc !== "m-set" || cl.exp !== "false" || await page.evaluate(() => !!document.querySelector(".mdock button[tabindex]"))) throw new Error("sluiten: " + JSON.stringify(cl));
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
      await importPdf(p, "offline");
    } finally { OFFLINE = false; await ctx.close(); }
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
  async logp(page) { await SCEN.fight(page); await tap(page, "#logopen"); await page.waitForSelector("#gsheet .gsheet"); },
  async keyhelp(page) { await SCEN.fight(page); await page.evaluate(async () => (await import("/js/ui/keys.js")).openKeys()); await page.waitForSelector("#hsheet .hsheet"); },
  async meer(page) { await SCEN.fight(page); await page.locator('#order .c.k.open [data-a="panel"][data-p="more"]').first().tap(); await page.waitForSelector("#order .kpanel.more"); },
  // WP26: Encounters-tab met een opgeslagen encounter en menu, samenvatting na Gevecht afronden, rondleiding (deel f)
  async enc(page) {
    await SCEN.monster(page); await tap(page, '#p-montabs [data-prep="enc"]'); await page.waitForSelector("#enc-panel .encsave");
    await tap(page, '#enc-panel [data-enc="save-open"]'); await page.fill("#enc-name", "Hinderlaag bij de oude brug"); await tap(page, '#enc-panel [data-enc="save-go"]');
    await page.waitForSelector("#enc-panel .encrow"); await tap(page, '#enc-panel [data-enc="menu"]'); await page.waitForSelector("#enc-panel .encmenu");
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
  async wp37(page, base) {
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => document.fonts.ready);
    const r = await page.evaluate(() => {
      const img = document.querySelector(".hero-img img"), pic = document.querySelector(".hero-img").getBoundingClientRect();
      const h1 = document.querySelector("h1"), lh = parseFloat(getComputedStyle(h1).lineHeight), cta = document.querySelector(".cta").getBoundingClientRect();
      const gold = [...document.querySelectorAll("a,button")].filter((e) => getComputedStyle(e).backgroundColor === "rgb(227, 168, 59)").length;
      const cur = [...document.querySelectorAll(".lang a[aria-current=page]")].map((a) => a.getAttribute("hreflang"));
      const card = document.querySelector("a.toolcard"), cb = card.getBoundingClientRect();
      const links = [...new Set([...document.querySelectorAll("a[href^='/']")].map((a) => a.getAttribute("href")))];
      return { loaded: img.complete && img.naturalWidth > 0, src: img.currentSrc.split("/").pop(), picH: Math.round(pic.height), lines: Math.round(h1.getBoundingClientRect().height / lh),
        ctaBottom: Math.round(cta.bottom), vh: innerHeight, gold, cur, lang: document.documentElement.lang, cardH: Math.round(cb.height), name: card.getAttribute("aria-labelledby").split(" ").map((i) => document.getElementById(i).textContent.trim()).join(" "), links };
    });
    if (!r.loaded) throw new Error("illustratie niet geladen: " + r.src);
    if (r.lines !== 1) throw new Error(`h1 op ${r.lines} regels`);
    if (r.picH > 262 || r.picH < 150) throw new Error("illustratie hoogte " + r.picH);
    if (r.ctaBottom > r.vh) throw new Error(`knop onder de vouw (${r.ctaBottom} > ${r.vh})`);
    if (r.gold !== 1) throw new Error("gouden knoppen: " + r.gold);
    if (r.cur.join() !== r.lang) throw new Error("taalkiezer aria-current: " + r.cur.join());
    if (r.cardH < 72 || !/itiative/.test(r.name)) throw new Error("toolkaart: " + JSON.stringify([r.cardH, r.name]));
    for (const href of r.links) { const res = await page.request.get(base + href); if (res.status() !== 200) throw new Error(`link ${href}: ${res.status()}`); }
    if (page.viewportSize().width === 320) {
      const vp = page.viewportSize();
      await page.setViewportSize({ width: 1280, height: 800 }); await page.waitForTimeout(200);
      const d = await page.evaluate(() => {
        const t = document.querySelector(".hero-txt").getBoundingClientRect(), i = document.querySelector(".hero-img").getBoundingClientRect();
        return { side: i.left >= t.right - 1, h: document.documentElement.scrollWidth - innerWidth, cta: document.querySelector(".cta").getBoundingClientRect().bottom, vh: innerHeight };
      });
      if (!d.side || d.h > 0 || d.cta > d.vh) throw new Error("desktop-hero: " + JSON.stringify(d));
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
  // WP44 (WB1, WB2): /en/… → 301 naar het pad zonder /en/ (query blijft); geïnstalleerde app op /initiative/ opent in de
  // voorkeurstaal, de website niet; homepage (/ en /nl/) volgt een bewuste themakeuze uit de app, anders het systeem
  // (ook zonder JavaScript en bij een systeemwissel zonder herladen), zonder flits van het verkeerde thema.
  async wp44(page, base) {
    const browser = page.context().browser();
    const resp = await page.goto(base + "/en/initiative/?x=1");
    const chain = []; for (let r = resp.request().redirectedFrom(); r; r = r.redirectedFrom()) chain.push(r.url());
    if (new URL(page.url()).pathname + new URL(page.url()).search !== "/initiative/?x=1" || chain.length !== 1) throw new Error(`/en/ niet in één stap: ${chain.join(" → ")} → ${page.url()}`);
    // geïnstalleerde app (display-mode standalone nagebootst)
    for (const [standalone, want] of [[true, "/nl/initiative/"], [false, "/initiative/"]]) {
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
