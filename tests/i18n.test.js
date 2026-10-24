// Meertaligheid WP20 (TA4): de catalogi in locales/ bewaken. Elke taal heeft dezelfde sleutels en placeholders als
// Engels (de terugval), elke sleutel hoort bij zijn namespace-bestand, elke t("…")/M("…") in de code bestaat, en de
// testtaal xx is actueel. Plan: docs/i18n.md §3.2–§3.3.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SUPPORTED, DEFAULT } from "../js/i18n/lang.js";
import { pseudo, pseudoFile } from "../tools/i18n-pseudo.mjs";
import { i18nMode, initI18n, t as bootT, DEBUG_KEY } from "../js/i18n/boot.js";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
// namespace-bestand → sleutelvoorvoegsel (docs/i18n.md §3.2)
const NS = { common: "common.", initiative: "init.", rules: "rules.", log: "log.", player: "player.", dnd: "dnd.", pages: "page." };
const PH = /\{([A-Za-z_][\w.]*)\}/g;

const loadIdx = async (l) => (await import(pathToFileURL(`${ROOT}locales/${l}/index.js`).href)).default;
const loadNs = async (l, f) => (await import(pathToFileURL(`${ROOT}locales/${l}/${f}.js`).href)).default;
const forms = (v) => (v && typeof v === "object" ? Object.values(v) : [v]);
const holes = (v) => [...new Set(forms(v).flatMap((s) => [...String(s).matchAll(PH)].map((m) => m[1])))].sort();

const cats = {};
for (const l of SUPPORTED) cats[l] = await loadIdx(l);
const en = cats[DEFAULT];

test("elke taal heeft dezelfde namespace-bestanden, met hetzelfde voorvoegsel per bestand", async () => {
  for (const l of SUPPORTED) {
    const files = readdirSync(`${ROOT}locales/${l}`).filter((f) => f.endsWith(".js") && f !== "index.js").map((f) => f.slice(0, -3)).sort();
    assert.deepEqual(files, Object.keys(NS).sort(), `locales/${l}: namespaces`);
    for (const f of files) {
      const bad = Object.keys(await loadNs(l, f)).filter((k) => !k.startsWith(NS[f]));
      assert.deepEqual(bad, [], `locales/${l}/${f}.js: sleutels moeten met "${NS[f]}" beginnen`);
    }
  }
});

test("index.js bevat elk namespace-bestand en geen sleutel komt dubbel voor", async () => {
  for (const l of SUPPORTED) {
    let n = 0;
    for (const f of Object.keys(NS)) n += Object.keys(await loadNs(l, f)).length;
    assert.equal(Object.keys(cats[l]).length, n, `locales/${l}/index.js mist een namespace of heeft dubbele sleutels`);
  }
});

test("elke taal heeft precies dezelfde sleutels als Engels", () => {
  for (const l of SUPPORTED) {
    if (l === DEFAULT) continue;
    const miss = Object.keys(en).filter((k) => !(k in cats[l])), extra = Object.keys(cats[l]).filter((k) => !(k in en));
    assert.deepEqual(miss, [], `ontbreekt in ${l}`);
    assert.deepEqual(extra, [], `staat in ${l} maar niet in ${DEFAULT} (Engels is de terugval: altijd eerst daar toevoegen)`);
  }
});

test("waarden zijn een niet-lege tekst of een meervoud { one, other }", () => {
  for (const l of SUPPORTED) for (const [k, v] of Object.entries(cats[l])) {
    if (typeof v === "string") { assert.ok(v.trim(), `${l} ${k}: lege tekst`); continue; }
    assert.ok(v && typeof v === "object" && !Array.isArray(v), `${l} ${k}: geen tekst of meervoud`);
    assert.ok(typeof v.one === "string" && typeof v.other === "string", `${l} ${k}: meervoud heeft one en other nodig`);
    for (const [f, s] of Object.entries(v)) assert.ok(["zero", "one", "two", "few", "many", "other"].includes(f) && typeof s === "string" && s.trim(), `${l} ${k}.${f}`);
    assert.ok(holes(v).includes("n"), `${l} ${k}: meervoud zonder {n}`);
  }
});

test("elke vertaling gebruikt dezelfde placeholders als Engels", () => {
  for (const l of SUPPORTED) for (const k of Object.keys(en)) {
    if (k in cats[l]) assert.deepEqual(holes(cats[l][k]), holes(en[k]), `${l} ${k}`);
  }
});

// Gebruik in de code: t("sleutel") en M("sleutel") met een letterlijke sleutel. Een berekende sleutel (t(x)) ziet
// deze test niet: gebruik dan een vaste lijst met letterlijke sleutels in de buurt.
const walk = (dir) => readdirSync(ROOT + dir).flatMap((n) => { const p = dir + n; return statSync(ROOT + p).isDirectory() ? walk(p + "/") : [p]; });
const code = walk("js/").filter((p) => p.endsWith(".js") && !p.startsWith("js/i18n/"));
const used = new Map();
for (const f of code) for (const m of readFileSync(ROOT + f, "utf8").matchAll(/\b(?:t|M|tr)\(\s*["'`]([a-z][\w.]*)["'`]/g)) {
  if (m[1].includes(".")) used.set(m[1], f);
}

test("elke t(\"…\") en M(\"…\") in js/ bestaat in de Engelse catalogus", () => {
  const miss = [...used].filter(([k]) => !(k in en)).map(([k, f]) => `${k} (${f})`);
  assert.deepEqual(miss, []);
});

test("ongebruikte sleutels (melding, geen fout tot WP33)", (t) => {
  const unused = Object.keys(en).filter((k) => !used.has(k) && !k.startsWith("common.") && !k.startsWith("page."));
  if (unused.length) t.diagnostic(`ongebruikt: ${unused.join(", ")}`);
});

test("testtaal xx is actueel (opnieuw maken: node tools/i18n-pseudo.mjs)", async () => {
  assert.deepEqual(await loadIdx("xx"), pseudo(en));
  assert.equal(readFileSync(`${ROOT}locales/xx/index.js`, "utf8"), pseudoFile(en));
});

test("pseudo: placeholders blijven heel, tekst wordt langer en herkenbaar", () => {
  const p = pseudo({ a: "Turn of {name}", b: { one: "{n} day ago", other: "{n} days ago" } });
  assert.match(p.a, /^\[Türñ öf \{name\} ·+\]$/);
  assert.ok(p.a.length > "Turn of {name}".length * 1.3);
  assert.match(p.b.one, /\{n\}/);
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

test("initI18n: taal van de pagina, Engels als terugval, debugstand bewaard", async () => {
  const st = mem();
  const loads = [];
  const i = await initI18n({ doc: doc("nl"), search: "?i18n=debug", storage: st, load: (l) => { loads.push(l); return loadIdx(l); } });
  assert.deepEqual(loads.sort(), ["en", "nl"]);
  assert.equal(i.lang, "nl");
  assert.equal(i.t("common.close"), "Sluit");
  assert.equal(bootT("common.close"), "Sluit", "t uit boot.js volgt de geladen vertaler");
  assert.equal(i.t("common.bestaat.niet"), "⟦common.bestaat.niet⟧");
  assert.equal(st.m.get(DEBUG_KEY), "debug");
  const j = await initI18n({ doc: doc("nl"), search: "?i18n=off", storage: st, load: loadIdx });
  assert.ok(!st.m.has(DEBUG_KEY));
  assert.equal(j.t("common.bestaat.niet"), "common.bestaat.niet");
});

test("initI18n: testtaal xx, onbekende pagina-taal, mislukt laden en geen opslag breken niets", async () => {
  const x = await initI18n({ doc: doc("nl"), search: "?i18n=xx", storage: mem(), load: loadIdx });
  assert.equal(x.lang, "xx");
  assert.match(x.t("common.close"), /^\[Çlösé/);
  const d = await initI18n({ doc: doc("de"), search: "", storage: mem(), load: loadIdx });
  assert.equal(d.lang, "en");
  const errs = []; globalThis.__itErr = (m) => errs.push(m);
  try {
    const f = await initI18n({ doc: doc("nl"), search: "", storage: null, load: (l) => (l === "nl" ? Promise.reject(new Error("offline")) : loadIdx(l)) });
    assert.equal(f.t("common.close"), "Close", "nl kwam niet: Engelse terugval");
    assert.equal(errs.length, 1);
    assert.match(errs[0], /nl.*offline/);
    const g = await initI18n({ doc: null, search: "", storage: { getItem() { throw new Error("SecurityError"); } }, load: () => Promise.reject(new Error("x")) });
    assert.equal(g.t("common.close"), "common.close");
  } finally { delete globalThis.__itErr; }
});
