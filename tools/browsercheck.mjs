// Vaste browsercheck (WP13). Draait de matrix 320/360/390 px × licht/donker met touch en rapporteert getallen:
// horizontaal scrollen, zichtbare tikdoelen < 44 px en JS-fouten. FOUT (exitcode 1) = horizontaal scrollen of een JS-fout;
// te kleine tikdoelen worden geteld en op 320 licht opgesomd, maar zijn geen FOUT (vergelijk met de vorige run). Screenshots alleen op verzoek (320 px, licht en donker).
//
//   node tools/browsercheck.mjs                 alle scenario's
//   node tools/browsercheck.mjs prep fight      alleen deze scenario's
//   node tools/browsercheck.mjs --shots=fight   ook screenshots van "fight" in shots/ (komma's voor meer)
//   node tools/browsercheck.mjs --i18n=xx       alles in de testtaal (lange tekst, accenten; WP20) of --i18n=debug
//
// Altijd FOUT: een ⟦ op het scherm (ontbrekende vertaling in de debugstand, js/i18n/boot.js).
//
// Playwright staat niet in package.json (geen dependencies). Het script zoekt het via PW_MODULE, gewone resolutie
// of /opt/npm-tools; browsers in PLAYWRIGHT_BROWSERS_PATH (standaard /opt/pw-browsers).
// Per pakket: voeg een scenario toe aan SCEN (naam → async (page) => { … }) dat de app in de juiste stand zet.
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { extname, join, normalize } from "node:path";

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
function serve() {
  const srv = createServer(async (req, res) => {
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
const START = { speler: "/speler", tagline: "/speler", stale: "/speler", mixed: "/en/initiative/player/", home: "/nl/", homeen: "/en/", notfound: "/nl/404.html" };
const tap = (page, sel) => page.locator(sel).first().tap();

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
  // WP15: letters geladen, h1 op één regel, gevecht met open statblock (Playfair-naam, Inter-tekst)
  async letters(page) {
    await SCEN.prep(page);
    const f = await page.evaluate(async () => { await document.fonts.ready; const h = document.querySelector("h1"), lh = parseFloat(getComputedStyle(h).lineHeight);
      return { inter: document.fonts.check('16px "Inter"'), play: document.fonts.check('800 26px "Playfair Display"'), lines: Math.round(h.getBoundingClientRect().height / lh) }; });
    if (!f.inter || !f.play) throw new Error("letters niet geladen: " + JSON.stringify(f));
    if (f.lines > 1) throw new Error(`h1 over ${f.lines} regels`);
    await tap(page, "#start");
    const n = await page.locator('[data-ia="roll"]').count();
    for (let i = 0; i < n; i++) await page.locator('[data-ia="roll"]').nth(i).tap();
    if (n) await tap(page, '[data-ia="go"]');
    await page.waitForSelector("#next");
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
  async eigen(page) { await SCEN.monster(page); await tap(page, '#p-montabs [data-prep="custom"]'); await page.waitForSelector("#f-custom", { state: "visible" }); },
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
      const u = await import("/js/ui/util.js"); u.toastBad("Proef: weigering met icoon.");
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
      n.innerHTML = '<div><span class="l">Ronde 2 · aan de beurt</span><b>Aria</b></div><div class="r"><span class="l">Daarna</span> Goblin 1</div>';
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
  // WP28: DM op Nederlands (tweede tabblad, zelfde browser), spelersscherm op Engels: alles Engels, ook onbekend wezen en status
  async mixed(page, base) {
    const dm = await page.context().newPage();
    await dm.goto(base + "/nl/initiative/");
    await dm.waitForSelector("#dock");
    await SCEN.fight(dm);
    await dm.evaluate(async () => { // alle monsters: naam onbekend, de eerste half HP (status Bloodied/Hurt)
      const { app, commit } = await import("/js/state.js"), { render } = await import("/js/ui/render.js");
      let n = 0;
      for (const c of app.S.list) if (c.kind === "monster") { c.anon = ++n; if (n === 1) c.hp = Math.ceil(c.max / 2); }
      commit(); render();
    });
    // met --i18n=xx staat er testtaal: dan alleen wachten op de onbekende wezens (lengte op 320 px), niet op Engels
    const xx = await page.evaluate(() => localStorage.getItem("kevs-i18n-debug") === "xx");
    await page.waitForFunction((x) => [...document.querySelectorAll("#pv-list .pvc .av")].some((a) => a.innerHTML.includes("unknown")) && (x || /Unknown creature/.test(document.querySelector("#pv-list").innerText)), xx, { timeout: 5000 });
    const txt = await page.locator("main").innerText();
    await dm.close();
    if (xx) return;
    if (!/Round \d/i.test(txt)) throw new Error("kop niet Engels: " + txt.slice(0, 120));
    if (!/Unknown creature/.test(txt)) throw new Error("geen 'Unknown creature': " + txt.slice(0, 200));
    if (/Ronde|aan de beurt|Daarna|Onbekend|Ongedeerd|Gewond|Bijna dood/i.test(txt)) throw new Error("Nederlandse tekst op het Engelse spelersscherm: " + txt.slice(0, 200));
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
  return { hscroll: Math.max(de.scrollWidth, document.body.scrollWidth) - vw, small, unt: (document.body.innerText.match(/⟦[^⟧]*⟧/g) || []).slice(0, 3) };
}

async function main() {
  const args = process.argv.slice(2);
  const shots = new Set((args.find((a) => a.startsWith("--shots=")) || "").slice(8).split(",").filter(Boolean));
  const only = args.filter((a) => !a.startsWith("--"));
  const i18n = (args.find((a) => a.startsWith("--i18n=")) || "").slice(7);
  if (i18n && !["xx", "debug"].includes(i18n)) throw new Error("--i18n=xx of --i18n=debug");
  const names = only.length ? only : Object.keys(SCEN);
  const bad = names.filter((n) => !(n in SCEN));
  if (bad.length) throw new Error("Onbekend scenario: " + bad.join(", "));

  const { chromium } = await loadPw();
  const srv = await serve(), base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch();
  if (shots.size) await mkdir(join(ROOT, "shots"), { recursive: true });
  let fails = 0;
  try {
    for (const name of names) for (const w of WIDTHS) for (const scheme of SCHEMES) {
      const ctx = await browser.newContext({ viewport: { width: w, height: 740 }, hasTouch: true, isMobile: true, colorScheme: scheme, deviceScaleFactor: 2, serviceWorkers: "block" });
      await ctx.addInitScript((m) => { try { localStorage.setItem("it-tour", "pf"); if (m) localStorage.setItem("kevs-i18n-debug", m); } catch { /* geen opslag */ } }, i18n);
      const page = await ctx.newPage(), errs = [];
      page.on("pageerror", (e) => errs.push(e.message));
      page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
      page.on("response", (r) => { const u = new URL(r.url()); if (r.status() >= 400 && u.origin === base && !u.pathname.startsWith("/api/")) errs.push(`${r.status()} ${u.pathname}`); });
      try {
        await page.goto(base + (START[name] || "/"));
        if (SCEN[name]) { if (!START[name]) await page.waitForSelector("#dock"); await SCEN[name](page, base); }
        else await page.waitForLoadState("networkidle");
        if (process.env.BC_PROBE) await page.evaluate(() => document.body.insertAdjacentHTML("afterbegin", '<button id="probe" style="width:30px;height:30px">x</button>'));
        await page.evaluate(() => document.fonts.ready); // Inter is breder dan de terugvalletter: meten met de echte letter
        await page.waitForTimeout(150);
      } catch (e) { errs.push("scenario: " + e.message.split("\n")[0]); }
      const m = await page.evaluate(measure).catch((e) => ({ hscroll: NaN, small: [], err: e.message }));
      if (m.unt && m.unt.length) errs.push("niet vertaald: " + m.unt.join(" "));
      const ok = m.hscroll <= 0 && !errs.length;
      if (!ok) fails++;
      console.log(`${ok ? "ok  " : "FOUT"} ${name.padEnd(9)} ${w} ${scheme.padEnd(5)} hscroll ${m.hscroll > 0 ? m.hscroll + "px" : 0} · tikdoelen<44 ${m.small.length}${errs.length ? " · JS: " + errs.join(" | ") : ""}`);
      if (m.small.length && w === 320 && scheme === "light") for (const s of m.small.slice(0, 12)) console.log("       " + s);
      if (shots.has(name) && w === 320) await page.screenshot({ path: join(ROOT, "shots", `${name}-${w}-${scheme}.png`), fullPage: false });
      await ctx.close();
    }
  } finally { await browser.close(); srv.close(); }
  console.log(fails ? `\n${fails} combinatie(s) met horizontaal scrollen, JS-fouten of ⟦…⟧.` : "\nGeen horizontaal scrollen, geen JS-fouten, geen ⟦…⟧.");
  process.exitCode = fails ? 1 : 0;
}

main().catch((e) => { console.error(e.message); process.exitCode = 2; });
