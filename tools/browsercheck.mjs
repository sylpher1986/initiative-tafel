// Vaste browsercheck (WP13). Draait de matrix 320/360/390 px × licht/donker met touch en rapporteert getallen:
// horizontaal scrollen, zichtbare tikdoelen < 44 px en JS-fouten. FOUT (exitcode 1) = horizontaal scrollen of een JS-fout;
// te kleine tikdoelen worden geteld en op 320 licht opgesomd, maar zijn geen FOUT (vergelijk met de vorige run). Screenshots alleen op verzoek (320 px, licht en donker).
//
//   node tools/browsercheck.mjs                 alle scenario's
//   node tools/browsercheck.mjs prep fight      alleen deze scenario's
//   node tools/browsercheck.mjs --shots=fight   ook screenshots van "fight" in shots/ (komma's voor meer)
//   node tools/browsercheck.mjs --lang=nl,en,xx  taal als extra as (WP32; standaard nl): /{taal}/… per scenario; xx = de
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

process.env.PLAYWRIGHT_BROWSERS_PATH ||= "/opt/pw-browsers";
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const WIDTHS = [320, 360, 390], SCHEMES = ["light", "dark"];

async function loadPw() {
  for (const p of [process.env.PW_MODULE, "playwright", "/opt/npm-tools/node_modules/playwright", "/opt/node-tools/node_modules/playwright"].filter(Boolean)) {
    try { return p.startsWith("/") ? createRequire(import.meta.url)(p) : await import(p); } catch { /* volgende */ }
  }
  throw new Error("Playwright niet gevonden. Zet PW_MODULE op het pad van de playwright-module.");
}

// Statische server zoals Cloudflare: /speler → speler.html, /nl/initiative/ → nl/initiative/index.html (WP21).
// /api/* bestaat hier niet (404, wordt genegeerd); elke andere 404 is FOUT (bijv. een relatief pad onder /{taal}/).
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
let OFFLINE = false; // i18n-offline: server weigert alles (Chromiums setOffline blokkeert navigaties al vóór de service worker)
function serve() {
  const srv = createServer(async (req, res) => {
    if (OFFLINE) { req.socket.destroy(); return; }
    let p;
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
const START = { speler: "/speler", tagline: "/speler", stale: "/speler", "i18n-mixed": "/en/initiative/player/", home: "/nl/", homeen: "/en/", notfound: "/nl/404.html",
  "i18n-switch": "/nl/initiative/", "i18n-offline": "/nl/initiative/", "i18n-legacy": "/en/initiative/", wp33: "/nl/" };
// Eigen taalopzet: niet per taal herhalen (WP32)
const ONCE = new Set(["i18n-mixed", "i18n-switch", "i18n-offline", "i18n-legacy", "homeen", "wp33"]);
// Startpagina in een taal: taalloze adressen en /nl/… worden /{taal}/…; vaste talen (ONCE) blijven zoals ze zijn
function startFor(name, lang) {
  const p = START[name] || "/";
  if (ONCE.has(name)) return p;
  if (p === "/") return `/${lang}/initiative/`;
  if (p === "/speler") return `/${lang}/initiative/player/`;
  return p.replace(/^\/nl\//, `/${lang}/`);
}
// Wat scenario's zelf intypen (gebruikersinhoud: wordt nooit vertaald)
const OWN = ["Hinderlaag bij de oude brug", "Aurelianus Vandermeer", "Zonder Level", "Vrije regel zonder punt"];
const noPaths = (l) => l.replace(/\S*\/\S*/g, " "); // paden en URL's (src/2014/en, /speler?k=) zijn geen tekst, zoals in tests/pages.test.js
const tap = (page, sel) => page.locator(sel).first().tap();

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
  speler: null, // eigen startpagina, zie START
  home: null, homeen: null, notfound: null, // WP30: publieke homepage per taal en de niet-gevonden-pagina (START)
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
    await tv.goto(base + "/en/initiative/player/");
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
    await Promise.all([page.waitForURL(/\/en\/initiative\//), tap(page, '#lang-seg [data-lang="en"]')]);
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
  // WP32: één bezoek (nl) met de service worker, daarna offline: beide talen, spelersscherm, homepage en doorverwijzer laden
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
      for (const [u, sel, lang] of [["/en/initiative/", "#dock", "en"], ["/nl/initiative/", "#dock", "nl"], ["/en/initiative/player/", "#pv-wait", "en"], ["/speler", "#pv-wait", "nl"], ["/", "#dock", "nl"], ["/en/", "main", "en"]]) {
        await p.goto(base + u);
        await p.waitForSelector(sel, { state: "attached", timeout: 8000 }).catch(async () => { throw new Error(`offline ${u}: ${sel} ontbreekt (${p.url()}): ${(await p.evaluate(() => document.body?.innerText || "")).slice(0, 80)}`); });
        const l = await p.evaluate(() => document.documentElement.lang);
        if (l !== lang) throw new Error(`offline ${u}: lang ${l}, verwacht ${lang}`);
        const unt = await p.evaluate(() => /⟦/.test(document.body.innerText));
        if (unt) throw new Error(`offline ${u}: ontbrekende vertaling`);
      }
    } finally { OFFLINE = false; await ctx.close(); }
  },
  // WP33: Engels live. Nieuwe Engelstalige browser → /en/, Nederlandse → /nl/, bestaande gebruiker (it-*, geen voorkeur)
  // met een Engelse browser blijft Nederlands; taalkiezer zichtbaar; een nieuwe gebruiker telt later niet als bestaand.
  async wp33(page, base) {
    const browser = page.context().browser();
    const visit = async (locale, seed, steps) => {
      const ctx = await browser.newContext({ locale });
      if (seed) await ctx.addInitScript(() => { if (!localStorage.getItem("bc-seeded")) { localStorage.setItem("it-tour", "pf"); localStorage.setItem("bc-seeded", "1"); } });
      const p = await ctx.newPage();
      try { for (const [u, want, sel] of steps) {
        await p.goto(base + u);
        await p.waitForURL((x) => x.pathname.startsWith(want), { timeout: 8000 }).catch(() => { throw new Error(`${locale}${seed ? " (bestaand)" : ""} ${u}: ${p.url()}, verwacht ${want}`); });
        await p.waitForSelector(sel, { state: "attached" });
        const l = await p.evaluate(() => document.documentElement.lang);
        if (l !== want.slice(1, 3)) throw new Error(`${u}: lang ${l}`);
      } return p; } catch (e) { await ctx.close(); throw e; }
    };
    const a = await visit("en-US", false, [["/", "/en/initiative/", "#dock"], ["/", "/en/initiative/", "#dock"], ["/speler?k=ABC234", "/en/initiative/player/", "#pv-wait"]]);
    if (!(await a.url()).includes("?k=ABC234")) throw new Error("?k= weg na doorverwijzen");
    await a.goto(base + "/en/initiative/"); await a.waitForSelector("#dock");
    if (await a.evaluate(() => document.querySelector("#lang-seg")?.hidden !== false)) throw new Error("taalkiezer verborgen in Instellingen");
    await a.context().close();
    await (await visit("nl-NL", false, [["/", "/nl/initiative/", "#dock"]])).context().close();
    const c = await visit("en-US", true, [["/", "/nl/initiative/", "#dock"], ["/speler", "/nl/initiative/player/", "#pv-wait"]]);
    const pref = await c.evaluate(() => JSON.parse(localStorage.getItem("kevs-lang") || "null"));
    if (!pref || pref.lang !== "nl") throw new Error("bestaande gebruiker kreeg geen voorkeur nl: " + JSON.stringify(pref));
    await c.context().close();
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
      if (m.lang === "en" && mode !== "xx" && name !== "i18n-legacy" && m.lines) { // taal van de pagina (i18n-switch eindigt op /en/)
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
