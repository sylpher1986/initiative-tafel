// Vaste browsercheck (WP13). Draait de matrix 320/360/390 px × licht/donker met touch en rapporteert getallen:
// horizontaal scrollen, zichtbare tikdoelen < 44 px en JS-fouten. FOUT (exitcode 1) = horizontaal scrollen of een JS-fout;
// te kleine tikdoelen worden geteld en op 320 licht opgesomd, maar zijn geen FOUT (vergelijk met de vorige run). Screenshots alleen op verzoek (320 px, licht en donker).
//
//   node tools/browsercheck.mjs                 alle scenario's
//   node tools/browsercheck.mjs prep fight      alleen deze scenario's
//   node tools/browsercheck.mjs --shots=fight   ook screenshots van "fight" in shots/ (komma's voor meer)
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

// Statische server zoals Cloudflare: /speler → speler.html. /api/* bestaat hier niet (404, wordt genegeerd).
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
function serve() {
  const srv = createServer(async (req, res) => {
    let p;
    try { p = decodeURIComponent(new URL(req.url, "http://x").pathname); } catch { res.writeHead(400).end(); return; }
    if (p === "/") p = "/index.html"; else if (!extname(p)) p += ".html";
    const f = normalize(join(ROOT, p));
    if (!f.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    try { const b = await readFile(f); res.writeHead(200, { "content-type": TYPES[extname(f)] || "application/octet-stream" }).end(b); }
    catch { res.writeHead(404).end(); }
  });
  return new Promise((ok) => srv.listen(0, "127.0.0.1", () => ok(srv)));
}

// Scenario's met een andere startpagina dan "/"; zonder functie in SCEN wordt alleen geladen.
const START = { speler: "/speler", tagline: "/speler" };
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
      return { ab, min: Math.min(...ab), undo: ic && Math.round(ic.getBoundingClientRect().width), tico: !!t, role: cs(t?.closest(".tmsg"), "display") && t.closest(".tmsg").getAttribute("role"),
        sb: cs(document.querySelector(".sb"), "backgroundColor"), card: cs(document.querySelector("#order .c"), "backgroundColor") };
    });
    if (!r.ab.length || r.min < 44) throw new Error("ability-knoppen < 44 px: " + r.ab.join(","));
    if (!r.undo || r.undo < 18) throw new Error("undo-icoon ontbreekt of te klein");
    if (!r.tico || r.role !== "alert") throw new Error("foutmelding zonder icoon of role=alert");
    if (r.sb === "rgb(255, 255, 255)" || r.card === "rgb(255, 255, 255)") throw new Error("statblock/kaart nog wit: " + JSON.stringify(r));
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
  return { hscroll: Math.max(de.scrollWidth, document.body.scrollWidth) - vw, small };
}

async function main() {
  const args = process.argv.slice(2);
  const shots = new Set((args.find((a) => a.startsWith("--shots=")) || "").slice(8).split(",").filter(Boolean));
  const only = args.filter((a) => !a.startsWith("--"));
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
      await ctx.addInitScript(() => { try { localStorage.setItem("it-tour", "pf"); } catch { /* geen opslag */ } });
      const page = await ctx.newPage(), errs = [];
      page.on("pageerror", (e) => errs.push(e.message));
      page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
      try {
        await page.goto(base + (START[name] || "/"));
        if (SCEN[name]) { if (!START[name]) await page.waitForSelector("#dock"); await SCEN[name](page, base); }
        else await page.waitForLoadState("networkidle");
        if (process.env.BC_PROBE) await page.evaluate(() => document.body.insertAdjacentHTML("afterbegin", '<button id="probe" style="width:30px;height:30px">x</button>'));
        await page.evaluate(() => document.fonts.ready); // Inter is breder dan de terugvalletter: meten met de echte letter
        await page.waitForTimeout(150);
      } catch (e) { errs.push("scenario: " + e.message.split("\n")[0]); }
      const m = await page.evaluate(measure).catch((e) => ({ hscroll: NaN, small: [], err: e.message }));
      const ok = m.hscroll <= 0 && !errs.length;
      if (!ok) fails++;
      console.log(`${ok ? "ok  " : "FOUT"} ${name.padEnd(9)} ${w} ${scheme.padEnd(5)} hscroll ${m.hscroll > 0 ? m.hscroll + "px" : 0} · tikdoelen<44 ${m.small.length}${errs.length ? " · JS: " + errs.join(" | ") : ""}`);
      if (m.small.length && w === 320 && scheme === "light") for (const s of m.small.slice(0, 12)) console.log("       " + s);
      if (shots.has(name) && w === 320) await page.screenshot({ path: join(ROOT, "shots", `${name}-${w}-${scheme}.png`), fullPage: false });
      await ctx.close();
    }
  } finally { await browser.close(); srv.close(); }
  console.log(fails ? `\n${fails} combinatie(s) met horizontaal scrollen of JS-fouten.` : "\nGeen horizontaal scrollen, geen JS-fouten.");
  process.exitCode = fails ? 1 : 0;
}

main().catch((e) => { console.error(e.message); process.exitCode = 2; });
