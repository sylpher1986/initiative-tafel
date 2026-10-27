// Meertaligheid WP19 (TA3): taalbepaling, taalpaden en de opgeslagen voorkeur (docs/i18n.md §2.2).
// Sinds WP44 (WB1, 2.3.0): Engels zonder taalcode ("/", "/initiative/"), andere talen met voorvoegsel ("/nl/…");
// taal alleen uit het pad, geen automatische taalredirect (behalve het openen van een geïnstalleerde app). Meer in tests/wp44.test.js.
import "./_nl.js"; // WP27: Nederlandse catalogus voor descriptoren
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveLang, parsePath, normLang, browserLang, pathFor, pageFor, switchPath, parsePref, prefValue, prefStore,
  fallbackIn, langFromPath, SUPPORTED, LIVE, DEFAULT, LOCALES, PREF_KEY } from "../js/i18n/lang.js";

const r = (o) => resolveLang(o);

test("constanten: Engels is standaard en ondersteund; sinds WP33 zijn Engels en Nederlands live", () => {
  assert.equal(DEFAULT, "en");
  assert.deepEqual(SUPPORTED, ["en", "nl"]);
  assert.deepEqual(LIVE, ["en", "nl"]);
  for (const l of SUPPORTED) assert.ok(LOCALES[l], l);
  assert.equal(PREF_KEY, "kevs-lang");
});

test("1. ondersteund voorvoegsel: die taal, zonder doorverwijzing; voorkeur en browser tellen niet (WP44)", () => {
  assert.deepEqual(r({ path: "/nl/initiative/player/", pref: "en" }), { lang: "nl", source: "path", redirect: null });
  assert.deepEqual(r({ path: "/nl/" }), { lang: "nl", source: "path", redirect: null });
  assert.deepEqual(r({ path: "/nl", search: "?k=ABC234" }), { lang: "nl", source: "path", redirect: null }, "slash: Cloudflare (html_handling)");
});

test("1. oud /en/… → hetzelfde pad zonder voorvoegsel, query en hash blijven (WP44)", () => {
  assert.deepEqual(r({ path: "/en/initiative/", search: "?k=ABC234", hash: "#x" }), { lang: "en", source: "path", redirect: "/initiative/?k=ABC234#x" });
  assert.equal(r({ path: "/en/" }).redirect, "/");
  assert.equal(r({ path: "/en" }).redirect, "/");
  assert.equal(r({ path: "/EN/initiative/player/" }).redirect, "/initiative/player/");
  assert.equal(r({ path: "/en-GB/x" }).redirect, "/x");
});

test("1. schrijfwijze van het voorvoegsel wordt rechtgezet, taal blijft", () => {
  assert.deepEqual(r({ path: "/NL/initiative/", search: "?k=ABC234" }), { lang: "nl", source: "path", redirect: "/nl/initiative/?k=ABC234" });
  assert.deepEqual(r({ path: "/nl-BE/" }), { lang: "nl", source: "path", redirect: "/nl/" });
  assert.deepEqual(r({ path: "/nl_BE/x" }), { lang: "nl", source: "path", redirect: "/nl/x" });
});

test("2. ongeldig of niet-ondersteund voorvoegsel → Engels zonder voorvoegsel, rest van het pad en de query blijven", () => {
  assert.deepEqual(r({ path: "/de/initiative/", search: "?k=ABC234" }), { lang: "en", source: "default", redirect: "/initiative/?k=ABC234" });
  assert.deepEqual(r({ path: "/xx/" }), { lang: "en", source: "default", redirect: "/" });
  assert.equal(r({ path: "/xx/initiative/" }).redirect, "/initiative/");
});

test("3. geen voorvoegsel = Engels, nooit een doorverwijzing (ook niet bij Nederlandse voorkeur of browser)", () => {
  for (const path of ["/", "/initiative/", "/initiative/player/", "/index.html", "/speler", "/foo/bar", "/characters/"])
    assert.deepEqual(r({ path, pref: "nl", languages: ["nl-NL"] }), { lang: "en", source: "path", redirect: null }, path);
});

test("langFromPath: één regel voor taal-uit-pad", () => {
  assert.equal(langFromPath("/"), "en");
  assert.equal(langFromPath("/initiative/"), "en");
  assert.equal(langFromPath("/initiative/player/"), "en");
  assert.equal(langFromPath("/nl/"), "nl");
  assert.equal(langFromPath("/nl/initiative/player/"), "nl");
  assert.equal(langFromPath("/NL/initiative/"), "nl");
  assert.equal(langFromPath("/xx/initiative/"), "en", "ongeldig voorvoegsel: Engels");
  assert.equal(langFromPath("/js/main.js"), "en");
  assert.equal(langFromPath(""), "en");
});

test("resolveLang schrijft niets en hangt niet van de omgeving af", () => {
  const before = JSON.stringify(globalThis.localStorage ?? null);
  r({ path: "/en/", pref: "nl" });
  assert.equal(JSON.stringify(globalThis.localStorage ?? null), before);
});

test("parsePath: mappen van de app en gewone paden zijn geen taal", () => {
  assert.deepEqual(parsePath("/nl/initiative/"), { prefix: "nl", lang: "nl", rest: "/initiative/" });
  assert.deepEqual(parsePath("/xx/a"), { prefix: "xx", lang: null, rest: "/a" });
  assert.deepEqual(parsePath("/js/main.js"), { prefix: null, lang: null, rest: "/js/main.js" });
  assert.deepEqual(parsePath("/initiative/"), { prefix: null, lang: null, rest: "/initiative/" });
  assert.deepEqual(parsePath(""), { prefix: null, lang: null, rest: "/" });
  assert.deepEqual(parsePath("nl"), { prefix: "nl", lang: "nl", rest: "/" });
});

test("normLang en browserLang", () => {
  assert.equal(normLang("nl-BE"), "nl");
  assert.equal(normLang("EN_us"), "en");
  assert.equal(normLang("de"), null);
  assert.equal(normLang(null), null);
  assert.equal(normLang("en", ["nl"]), null);
  assert.equal(browserLang(["fr", "en-GB", "nl"], LIVE), "en");
  assert.equal(browserLang("nl-NL", LIVE), "nl");
  assert.equal(browserLang(null), null);
  assert.equal(fallbackIn(["nl"]), "nl");
  assert.equal(fallbackIn(LIVE), "en");
});

test("pathFor, pageFor en switchPath (taalkiezer): Engels nooit met /en/", () => {
  assert.equal(pathFor("en", "/"), "/");
  assert.equal(pathFor("nl", "/"), "/nl/");
  assert.equal(pathFor("en", "/initiative/"), "/initiative/");
  assert.equal(pathFor("nl", "/initiative/player/"), "/nl/initiative/player/");
  assert.equal(pathFor("nl", "/speler"), "/nl/initiative/player/");
  assert.equal(pathFor("en", "/speler.html"), "/initiative/player/");
  assert.equal(pathFor("en", "/index.html"), "/");
  assert.equal(pageFor("/characters/"), "/characters/");
  assert.equal(switchPath("/nl/initiative/", "en"), "/initiative/");
  assert.equal(switchPath("/initiative/", "nl"), "/nl/initiative/");
  assert.equal(switchPath("/nl/", "en"), "/", "homepage blijft homepage");
  assert.equal(switchPath("/", "nl"), "/nl/");
  assert.equal(switchPath("/nl/initiative/", undefined), "/initiative/", "ongeldige taal: terugval");
  assert.equal(switchPath("/nl/initiative/", "de"), "/initiative/");
  assert.equal(switchPath("/nl/initiative/player/", "en"), "/initiative/player/");
  assert.equal(switchPath("/initiative/player/", "nl"), "/nl/initiative/player/");
  assert.equal(switchPath("/speler", "nl"), "/nl/initiative/player/");
  for (const p of ["/", "/initiative/", "/nl/initiative/player/", "/speler", "/xx/a"]) for (const l of [...SUPPORTED, "de", undefined])
    assert.doesNotMatch(switchPath(p, l), /^\/en(\/|$)/, `${p} → ${l}`);
});

test("voorkeur: parsePref en prefValue, kapotte of vreemde waarden → null", () => {
  assert.equal(parsePref(prefValue("nl", 5)), "nl");
  assert.deepEqual(JSON.parse(prefValue("en", 7)), { lang: "en", t: 7 });
  for (const raw of [null, "", "nl", "{", "[]", '{"lang":"de"}', '{"lang":5}', "null"]) assert.equal(parsePref(raw), null, String(raw));
});

test("prefStore: localStorage-achtig, zonder of met kapotte opslag nooit een fout", () => {
  const mem = new Map();
  const ls = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)) };
  const s = prefStore(ls);
  assert.equal(s.get(), null);
  assert.equal(s.set("nl-BE", 9), true);
  assert.equal(mem.get("kevs-lang"), '{"lang":"nl","t":9}');
  assert.equal(s.get(), "nl");
  assert.equal(s.set("de"), false, "niet-ondersteunde taal wordt niet opgeslagen");
  assert.equal(s.get(), "nl");
  const broken = prefStore({ getItem() { throw new Error("SecurityError"); }, setItem() { throw new Error("QuotaExceeded"); } });
  assert.equal(broken.get(), null);
  assert.equal(broken.set("en"), false);
  const none = prefStore(null);
  assert.equal(none.get(), null, "Node heeft geen localStorage");
});

const PATHS = ["/", "", "//", "/EN", "/en", "/en/", "/nl-be/x", "/nl_BE/", "/js/x", "/xx", "/xx/initiative/", "/de/initiative/player/",
  "/en/initiative/player/", "/initiative/player/index.html", "/speler.html", "/player", "/index.html", "/initiative",
  "//nl//initiative", "/%2F%2Fevil.com", "/characters/", "/nl/initiative/", "/NL/", "/en//x"];

test("geen lus: een doorverwijzing opnieuw bepalen geeft geen nieuwe doorverwijzing", () => {
  for (const path of PATHS) {
    const a = resolveLang({ path, search: "?k=ABC234" });
    if (!a.redirect) continue;
    const u = new URL(a.redirect, "https://kevs-inn.com");
    assert.equal(u.search, "?k=ABC234", path);
    const b = resolveLang({ path: u.pathname });
    assert.equal(b.redirect, null, `${path} → ${a.redirect} → ${b.redirect}`);
    assert.equal(b.lang, a.lang, path);
  }
});

test("geen open redirect: elke doorverwijzing blijft op dezelfde host", () => {
  for (const path of [...PATHS, "//evil.com", "//evil.com/x", "/\\evil.com", "/NL//evil.com", "/xx//evil.com", "/\\/evil.com", "/en//evil.com", "/EN///evil.com/x"]) {
    const { redirect } = resolveLang({ path });
    if (!redirect) continue;
    assert.match(redirect, /^\/(?![/\\])/, `${path} → ${redirect}`);
    assert.equal(new URL(redirect, "https://kevs-inn.com").host, "kevs-inn.com", `${path} → ${redirect}`);
  }
});

test("WP22: offered: kiezer en automatische keuze uit LIVE, in de debugstand alle talen", async () => {
  const { offered, DEBUG_KEY, DEBUG_MODES } = await import("../js/i18n/lang.js");
  assert.deepEqual(offered(false), LIVE);
  assert.deepEqual(offered(true), SUPPORTED);
  assert.deepEqual(DEBUG_MODES, ["debug", "xx"]);
  const boot = await import("../js/i18n/boot.js");
  assert.equal(boot.DEBUG_KEY, DEBUG_KEY, "één sleutel voor boot en lang.js");
});

test("WP22: taalkiezer wisselt naar dezelfde pagina in de andere taal, query en hash blijven; voorkeur altijd bewaard", async () => {
  const { switchLang, langSegHtml, langLabelHtml, langLabelText, pageLang } = await import("../js/ui/langpick.js");
  const d = (lang) => ({ documentElement: { lang } });
  assert.equal(pageLang(d("nl")), "nl"); assert.equal(pageLang(d("en-GB")), "en");
  assert.equal(pageLang(d("xx")), DEFAULT); assert.equal(pageLang(d("")), DEFAULT);
  await (await import("../js/i18n/boot.js")).initI18n({ doc: { documentElement: { lang: "nl" } }, search: "", storage: null });
  const mem = {}, store = prefStore({ getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } });
  const loc = (pathname, search = "", hash = "") => ({ pathname, search, hash, to: null, replace(u) { this.to = u; } });
  let l = loc("/nl/initiative/player/", "?k=ABC234", "#x");
  assert.equal(switchLang("en", { loc: l, store, cur: "nl" }), true);
  assert.equal(l.to, "/initiative/player/?k=ABC234#x", "WP44: Engels zonder voorvoegsel");
  assert.equal(store.get(), "en");
  l = loc("/initiative/");
  assert.equal(switchLang("nl", { loc: l, store, cur: "en" }), true);
  assert.equal(l.to, "/nl/initiative/");
  l = loc("/nl/initiative/");
  assert.equal(switchLang("nl", { loc: l, store, cur: "nl" }), false, "zelfde taal: niet herladen");
  assert.equal(l.to, null);
  assert.equal(store.get(), "nl", "maar de keuze telt wel als voorkeur");
  assert.equal(switchLang("de", { loc: l, store, cur: "nl" }), false, "onbekende taal: niets");
  assert.equal(store.get(), "nl");
  // geen opslag (privémodus): wisselt toch
  l = loc("/nl/initiative/");
  assert.equal(switchLang("en", { loc: l, store: prefStore(null), cur: "nl" }), true);
  assert.equal(l.to, "/initiative/");
  // knoppen: elke taal in haar eigen taal met lang, huidige ingedrukt; label tweetalig, huidige taal eerst
  const h = langSegHtml("nl", ["en", "nl"]);
  assert.match(h, /data-lang="en" lang="en" aria-pressed="false">English</);
  assert.match(h, /data-lang="nl" lang="nl" aria-pressed="true">Nederlands</);
  assert.equal(langLabelHtml("nl", ["en", "nl"]), 'Taal · <span lang="en">Language</span>');
  assert.equal(langLabelHtml("en", ["en", "nl"]), 'Language · <span lang="nl">Taal</span>');
  assert.equal(langLabelText("en", ["en", "nl"]), "Language, Taal");
});

test("WP33: adoptExisting zet eenmalig nl voor een bestaande gebruiker zonder voorkeur, nooit voor een nieuwe", async () => {
  const { adoptExisting, ADOPT_KEY, parsePref } = await import("../js/i18n/lang.js");
  const mk = (init = {}) => { const m = new Map(Object.entries(init)); return {
    m, get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };
  // bestaande gebruiker (it-tour, it-theme …), geen voorkeur → nl, en daarna nooit meer
  const a = mk({ "it-tour": "pf" });
  assert.equal(adoptExisting(a), "nl");
  assert.equal(parsePref(a.getItem(PREF_KEY)), "nl");
  assert.equal(a.getItem(ADOPT_KEY), "1");
  a.setItem(PREF_KEY, JSON.stringify({ lang: "en", t: 1 })); // later zelf Engels gekozen
  assert.equal(adoptExisting(a), null);
  assert.equal(parsePref(a.getItem(PREF_KEY)), "en", "tweede keer verandert niets");
  // nieuwe gebruiker: vlag gezet, geen voorkeur; later it-* erbij → blijft zonder voorkeur (browsertaal)
  const b = mk();
  assert.equal(adoptExisting(b), null);
  assert.equal(b.getItem(PREF_KEY), null);
  b.setItem("it-tab", "{}");
  assert.equal(adoptExisting(b), null);
  assert.equal(b.getItem(PREF_KEY), null);
  // bestaande voorkeur (tester koos Engels in de debugstand) blijft
  const c = mk({ "it-tour": "p", [PREF_KEY]: JSON.stringify({ lang: "en", t: 1 }) });
  assert.equal(adoptExisting(c), null);
  assert.equal(parsePref(c.getItem(PREF_KEY)), "en");
  // kapotte voorkeur telt als geen voorkeur
  const d = mk({ "it-tour": "p", [PREF_KEY]: "{kapot" });
  assert.equal(adoptExisting(d), "nl");
  // alleen kevs-*-sleutels (bv. debugstand) = geen bestaande app-gebruiker
  assert.equal(adoptExisting(mk({ "kevs-i18n-debug": "debug" })), null);
  // opslag vol (setItem faalt): geen fout en geen vlag, dus de volgende start probeert het opnieuw
  const full = mk({ "it-tour": "p" }); full.setItem = () => { throw new Error("QuotaExceededError"); };
  assert.equal(adoptExisting(full), null);
  assert.equal(full.getItem(ADOPT_KEY), null);
  // geen opslag of geblokkeerd: nooit een fout
  assert.equal(adoptExisting(null), null);
  assert.equal(adoptExisting({ getItem() { throw new Error("geblokkeerd"); } }), null);
});
