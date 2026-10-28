// Meertaligheid WP20 (TA4): de catalogi bewaken. Bron in locales/src/<taal>/<namespace>.js, gebouwd tot één bestand
// per taal (locales/<taal>.js, tools/i18n-build.mjs). Elke taal heeft dezelfde sleutels en placeholders als Engels (de
// terugval), elke sleutel hoort bij zijn namespace, elke sleutel in de code bestaat, en de gebouwde bestanden zijn
// actueel. Plan: docs/i18n.md §3.2–§3.3.
import "./_nl.js"; // WP27: Nederlandse catalogus voor descriptoren
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SUPPORTED, DEFAULT } from "../js/i18n/lang.js";
import { NS, OWN, SRC_LANGS, loadSrc, merge, mainCat, pseudo, pseudoText, build } from "../tools/i18n-build.mjs";
import { i18nMode, initI18n, i18nDebug, t as bootT, DEBUG_KEY } from "../js/i18n/boot.js";
import { CINFO, cinfoKeys } from "../js/rules/conditions.js";
import { HS } from "../js/playerview.js";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const PH = /\{([A-Za-z_][\w.]*)\}/g;
const KEY = /^[a-z][a-z0-9]*(\.[A-Za-z0-9]+)+$/;
const forms = (v) => (v && typeof v === "object" ? Object.values(v) : [v]);
const holes = (v) => [...new Set(forms(v).flatMap((s) => [...String(s).matchAll(PH)].map((m) => m[1])))].sort();
const loadOut = async (l) => (await import(pathToFileURL(`${ROOT}locales/${l}.js`).href)).default;

const src = {}, cats = {};
for (const l of SRC_LANGS) { src[l] = await loadSrc(l); cats[l] = merge(src[l]); }
const en = cats[DEFAULT];

test("bron per taal: precies de namespaces uit NS, geen talen buiten SRC_LANGS, SUPPORTED heeft een bron", () => {
  assert.deepEqual(readdirSync(`${ROOT}locales/src`).sort(), [...SRC_LANGS].sort());
  for (const l of SUPPORTED) assert.ok(SRC_LANGS.includes(l), `${l} heeft geen bron`);
  for (const l of SRC_LANGS) {
    const files = readdirSync(`${ROOT}locales/src/${l}`).map((f) => f.replace(/\.js$/, "")).sort();
    assert.deepEqual(files, Object.keys(NS).sort(), `locales/src/${l}`);
  }
});

test("sleutels: juist voorvoegsel per namespace, vast formaat, nergens dubbel (ook niet binnen één bestand)", () => {
  for (const l of SRC_LANGS) {
    const seen = new Map();
    for (const [ns, cat] of Object.entries(src[l])) {
      for (const k of Object.keys(cat)) {
        assert.ok(k.startsWith(NS[ns]), `${l}/${ns}.js: ${k} moet met "${NS[ns]}" beginnen`);
        assert.match(k, KEY, `${l}/${ns}.js: sleutelformaat ${k}`);
        assert.ok(!seen.has(k), `${l}: ${k} staat in ${seen.get(k)} en ${ns}`);
        seen.set(k, ns);
      }
      // JS neemt bij een dubbele sleutel in één object stil de laatste: tel de sleutels in de brontekst
      const text = readFileSync(`${ROOT}locales/src/${l}/${ns}.js`, "utf8");
      const lex = [...text.matchAll(/^\s*"([^"]+)"\s*:/gm)].map((m) => m[1]);
      assert.equal(lex.length, Object.keys(cat).length, `${l}/${ns}.js: dubbele sleutel of sleutel zonder "…"`);
    }
  }
});

test("elke taal heeft precies dezelfde sleutels als Engels", () => {
  for (const l of SRC_LANGS) {
    if (l === DEFAULT) continue;
    const miss = Object.keys(en).filter((k) => !(k in cats[l])), extra = Object.keys(cats[l]).filter((k) => !(k in en));
    assert.deepEqual(miss, [], `ontbreekt in ${l}`);
    assert.deepEqual(extra, [], `staat in ${l} maar niet in ${DEFAULT} (Engels is de terugval: altijd eerst daar toevoegen)`);
  }
});

test("waarden: niet-lege tekst of meervoud { one, other } met {n}; geen HTML of entities (t escapet niet)", () => {
  for (const l of SRC_LANGS) for (const [k, v] of Object.entries(cats[l])) {
    if (typeof v === "object") {
      assert.ok(v && !Array.isArray(v) && typeof v.one === "string" && typeof v.other === "string", `${l} ${k}: meervoud heeft one en other nodig`);
      for (const f of Object.keys(v)) assert.ok(["zero", "one", "two", "few", "many", "other"].includes(f), `${l} ${k}.${f}`);
      assert.ok(holes(v).includes("n"), `${l} ${k}: meervoud zonder {n}`);
    } else assert.equal(typeof v, "string", `${l} ${k}: geen tekst`);
    for (const s of forms(v)) {
      assert.ok(String(s).trim(), `${l} ${k}: lege tekst`);
      assert.ok(!/[<>]|&[#\w]+;/.test(s), `${l} ${k}: geen HTML of entities in een catalogus ("${s}")`);
    }
  }
});

test("elke vertaling (ook de testtaal) gebruikt dezelfde placeholders als Engels", () => {
  const xx = pseudo(en);
  for (const [l, cat] of [...SRC_LANGS.map((x) => [x, cats[x]]), ["xx", xx]]) for (const k of Object.keys(en)) {
    if (k in cat) assert.deepEqual(holes(cat[k]), holes(en[k]), `${l} ${k}`);
  }
});

test("gebouwde catalogi zijn actueel (opnieuw maken: node tools/i18n-build.mjs)", async () => {
  const files = await build();
  assert.deepEqual(Object.keys(files).sort(), ["locales/en.js", "locales/maps/en.js", "locales/maps/nl.js", "locales/maps/xx.js", "locales/nl.js", "locales/xx.js"]);
  for (const [p, s] of Object.entries(files)) assert.equal(readFileSync(ROOT + p, "utf8"), s, p);
  // G4 (WP56): namespaces uit OWN staan alleen in hun eigen bestand, niet in locales/<taal>.js (eigen cache)
  for (const l of SRC_LANGS) assert.deepEqual(await loadOut(l), mainCat(src[l]), l);
  assert.deepEqual(await loadOut("xx"), pseudo(mainCat(src[DEFAULT])));
  for (const [ns, dir] of Object.entries(OWN)) {
    for (const l of SRC_LANGS) assert.deepEqual(await loadOut(`${dir.slice("locales/".length)}${l}`), src[l][ns], `${dir}${l}`);
    assert.deepEqual(await loadOut(`${dir.slice("locales/".length)}xx`), pseudo(src[DEFAULT][ns]));
    assert.ok(!Object.keys(await loadOut(DEFAULT)).some((k) => k.startsWith(NS[ns])), `${NS[ns]}* hoort niet in locales/${DEFAULT}.js`);
  }
});

// Sleutels in de code: elke string die met een namespace-voorvoegsel begint ("init.fight.next"), ook in lijsten of
// t(c ? "a.b" : "c.d"). Bestandsnamen ("log.js") tellen niet.
const PRE = Object.values(NS).map((p) => p.replace(".", "\\.")).join("|");
const KEY_IN_CODE = new RegExp(`["'\`]((?:${PRE})[A-Za-z0-9.]*[A-Za-z0-9])["'\`]`, "g");
const KEY_IN_TPL = /\{\{t(?:js)?:([A-Za-z0-9.]+)\}\}/g; // sjablonen in pages/ (WP23, tools/pages.mjs)
export const keysIn = (text) => [...[...text.matchAll(KEY_IN_CODE)].map((m) => m[1]), ...[...text.matchAll(KEY_IN_TPL)].map((m) => m[1])]
  .filter((k) => !/\.(m?js|json|html|css)$/.test(k) && KEY.test(k));

test("scanner voor sleutels in de code: herkent sleutels, slaat bestandsnamen en ander tekst over", () => {
  const sample = `t("init.fight.next"); x ? t('common.close') : t(\`rules.save.lost\`); const L = ["dnd.cond.Prone", "page.home.title"];
    import("./log.js"); m("player."); s = "init"; u = "common.time.daysAgo"; v = "logboek.x"; <p>{{t:init.set.look}}</p> '{{tjs:page.err.bar}}'`;
  assert.deepEqual(keysIn(sample), ["init.fight.next", "common.close", "rules.save.lost", "dnd.cond.Prone", "page.home.title", "common.time.daysAgo", "init.set.look", "page.err.bar"]);
});

const walk = (dir) => readdirSync(ROOT + dir).flatMap((n) => { const p = dir + n; return statSync(ROOT + p).isDirectory() ? walk(p + "/") : [p]; });
const codeFiles = [...walk("js/").filter((p) => p.endsWith(".js") && !p.startsWith("js/i18n/")), "pages/initiative.html", "pages/player.html", "pages/maps.html"];
const used = new Map();
for (const f of codeFiles) for (const k of keysIn(readFileSync(ROOT + f, "utf8"))) used.set(k, f);

test("elke sleutel in js/ en de pagina's bestaat in de Engelse catalogus", () => {
  assert.deepEqual([...used].filter(([k]) => !(k in en)).map(([k, f]) => `${k} (${f})`), []);
});

// Sleutels die de code samenstelt (`dnd.cond.${id}.${n}`): de scanner ziet ze niet letterlijk. Elk patroon met de plek
// waar de sleutel ontstaat; een patroon dat niets meer dekt is zelf een fout (geen dode uitzonderingen).
const cinfoSet = new Set(Object.keys(CINFO).flatMap((id) => [...cinfoKeys(id, "2014"), ...cinfoKeys(id, "2024")])); // WP52: ook CINFO24
const DYNAMIC = [
  [/^maps\.bg\.err\./, "js/maps/main.js bgErr"],
  [/^maps\.imp\.err\./, "js/maps/main.js impErr"],
  [/^maps\.asset\./, "js/maps/main.js assetName (BUILTIN in js/maps/model/assets.js)"],
  [/^maps\.hist\.(grid|bg|align)$/, "js/maps/main.js stepName"],
  [/^init\.custom\.f\.(act|re|la|tr)$/, "js/data/statparse.js n()"],
  [/^rules\.dur\.\w+S$/, "js/rules/turns.js durShort"],
  [/^rules\.sv\.(ok|fail)(Note)?$/, "js/rules/saves.js"],
  [/^rules\.aoeRes\./, "js/rules/aoe.js aoeOutcome"],
  [/^rules\.rd\.n\.(maxLr|max|swallow|curse|wound|die|moved|uncon|see)$/, "js/rules/monrules.js"],
  [{ test: (k) => HS.some((c) => k === `dnd.hs.${c}`) }, "js/playerview.js hsText (HS)"],
  [{ test: (k) => cinfoSet.has(k) }, "js/rules/conditions.js condInfo (CINFO, CINFO24)"],
  [/^dnd\.exh\.s?[1-6]$/, "js/rules/conditions.js, effects.js"],
  [/^maps\.ago\.(min|hour|day)$/, "js/maps/main.js when() (ago)"],
];

test("ongebruikte sleutels zijn een fout (sinds WP33); samengestelde sleutels via DYNAMIC", () => {
  const free = (k) => !used.has(k) && !k.startsWith("common.") && !k.startsWith("page.");
  const unused = Object.keys(en).filter((k) => free(k) && !DYNAMIC.some(([re]) => re.test(k)));
  assert.deepEqual(unused, [], "ongebruikt: weghalen uit locales/src/{en,nl}, of een samengestelde sleutel in DYNAMIC zetten");
  for (const [re, where] of DYNAMIC) assert.ok(Object.keys(en).some((k) => free(k) && re.test(k)), `DYNAMIC ${re} (${where}) dekt niets meer`);
});

test("pseudo: placeholders blijven heel, tekst wordt langer en herkenbaar", () => {
  const p = pseudo({ a: "Turn of {name}", b: { one: "{n} day ago", other: "{n} days ago" } });
  assert.match(p.a, /^\[Türñ öf \{name\} ·+\]$/);
  assert.ok(p.a.length > "Turn of {name}".length * 1.3);
  assert.match(p.b.one, /\{n\}/);
  assert.equal(pseudoText("{n}"), "[{n}]", "alleen een placeholder: geen opvulling");
});

test("i18nMode: query wint en wordt bewaard, off wist, anders de opgeslagen stand", () => {
  assert.deepEqual(i18nMode("?i18n=debug", null), { mode: "debug", store: "debug" });
  assert.deepEqual(i18nMode("?k=ABC234&i18n=XX", null), { mode: "xx", store: "xx" });
  assert.deepEqual(i18nMode("?i18n=off", "xx"), { mode: null, store: null });
  assert.deepEqual(i18nMode("", "xx"), { mode: "xx", store: undefined });
  assert.deepEqual(i18nMode("?i18n=onzin", "debug"), { mode: "debug", store: undefined });
  assert.deepEqual(i18nMode(undefined, "kapot"), { mode: null, store: undefined });
});

const mem = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const doc = (lang) => ({ documentElement: { lang } });
const quiet = async (fn) => { const w = console.warn; console.warn = () => {}; try { return await fn(); } finally { console.warn = w; } };

test("initI18n: taal van de pagina, Engels als terugval, debugstand bewaard en opvraagbaar", async () => {
  const st = mem();
  const loads = [];
  const i = await quiet(() => initI18n({ doc: doc("nl"), search: "?i18n=debug", storage: st, load: (l) => { loads.push(l); return loadOut(l); } }));
  assert.deepEqual(loads.sort(), ["en", "nl"]);
  assert.equal(i.lang, "nl");
  assert.equal(i.t("common.close"), "Sluit");
  assert.equal(bootT("common.close"), "Sluit", "t uit boot.js volgt de geladen vertaler");
  assert.equal(await quiet(() => i.t("common.bestaat.niet")), "⟦common.bestaat.niet⟧");
  assert.equal(st.m.get(DEBUG_KEY), "debug");
  assert.equal(i18nDebug(), "debug");
  const j = await initI18n({ doc: doc("nl"), search: "?i18n=off", storage: st, load: loadOut });
  assert.ok(!st.m.has(DEBUG_KEY));
  assert.equal(i18nDebug(), null);
  assert.equal(j.t("common.bestaat.niet"), "common.bestaat.niet");
});

test("initI18n: testtaal xx, onbekende pagina-taal, mislukt laden en geen opslag breken niets", async () => {
  const x = await initI18n({ doc: doc("nl"), search: "?i18n=xx", storage: mem(), load: loadOut });
  assert.equal(x.lang, "xx");
  assert.match(x.t("common.close"), /^\[Çlösé/);
  const d = await initI18n({ doc: doc("de"), search: "", storage: mem(), load: loadOut });
  assert.equal(d.lang, "en");
  const errs = []; globalThis.__itErr = (m) => errs.push(m);
  try {
    const f = await quiet(() => initI18n({ doc: doc("nl"), search: "", storage: null, load: (l) => (l === "nl" ? Promise.reject(new Error("offline")) : loadOut(l)) }));
    assert.equal(f.t("common.close"), "Close", "nl kwam niet: Engelse terugval");
    assert.equal(errs.length, 1);
    assert.match(errs[0], /nl.*offline/);
    const g = await quiet(() => initI18n({ doc: null, search: "?i18n=debug", storage: null, load: () => { throw new Error("sync"); } }));
    assert.equal(g.t("common.close"), "⟦common.close⟧", "load gooit synchroon: geen catalogi, geen fout");
    const h = await quiet(() => initI18n({ doc: null, search: "", storage: { getItem() { throw new Error("SecurityError"); } }, load: () => Promise.reject(new Error("x")) }));
    assert.equal(h.t("common.close"), "common.close");
  } finally { delete globalThis.__itErr; }
});

test("initI18n: een download die blijft hangen houdt het opstarten niet tegen; komt hij later, dan geldt hij alsnog", async () => {
  let release;
  const slow = new Promise((r) => { release = r; });
  const t0 = Date.now();
  const i = await quiet(() => initI18n({ doc: doc("nl"), search: "", storage: null, wait: 50, load: (l) => (l === "nl" ? slow : loadOut(l)) }));
  assert.ok(Date.now() - t0 < 1000, "binnen de wachttijd verder");
  assert.equal(i.t("common.close"), "Close", "zonder nl: Engels");
  release(await loadOut("nl"));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(bootT("common.close"), "Sluit", "te laat binnen: vanaf nu vertaald");
  const never = await quiet(() => initI18n({ doc: doc("nl"), search: "", storage: null, wait: 20, load: () => new Promise(() => {}) }));
  assert.equal(never.t("common.close"), "common.close");
});

test("initI18n: een late catalogus van een eerdere aanroep overschrijft een latere niet", async () => {
  let release;
  const slow = new Promise((r) => { release = r; });
  await quiet(() => initI18n({ doc: doc("nl"), search: "", storage: null, wait: 20, load: (l) => (l === "nl" ? slow : loadOut(l)) }));
  await initI18n({ doc: doc("en"), search: "", storage: null, load: loadOut });
  release({ "common.close": "OUD" });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(bootT("common.close"), "Close");
});
