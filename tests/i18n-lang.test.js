// Meertaligheid WP19 (TA3): taalbepaling resolveLang, taalpaden en de opgeslagen voorkeur (docs/i18n.md §2.2).
import "./_nl.js"; // WP27: Nederlandse catalogus voor descriptoren
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveLang, parsePath, normLang, browserLang, pathFor, pageFor, switchPath, parsePref, prefValue, prefStore,
  fallbackIn, SUPPORTED, LIVE, DEFAULT, LOCALES, PREF_KEY, HOME } from "../js/i18n/lang.js";

const BOTH = ["en", "nl"]; // na WP33
const r = (o) => resolveLang({ live: BOTH, ...o });

test("constanten: Engels is standaard en ondersteund; tot WP33 is alleen Nederlands live", () => {
  assert.equal(DEFAULT, "en");
  assert.deepEqual(SUPPORTED, ["en", "nl"]);
  assert.deepEqual(LIVE, ["nl"]);
  for (const l of SUPPORTED) assert.ok(LOCALES[l], l);
  assert.equal(PREF_KEY, "kevs-lang");
});

test("1. prefix in de URL wint van voorkeur en browser, zonder doorverwijzing", () => {
  assert.deepEqual(r({ path: "/en/initiative/", pref: "nl", languages: ["nl-NL"] }), { lang: "en", source: "path", redirect: null });
  assert.deepEqual(r({ path: "/nl/initiative/player/", pref: "en" }), { lang: "nl", source: "path", redirect: null });
  assert.deepEqual(r({ path: "/en/initiative/" }), { lang: "en", source: "path", redirect: null });
});

test("1. ook als Engels nog niet live is werkt een /en/-link (gedeelde URL)", () => {
  assert.deepEqual(resolveLang({ path: "/en/initiative/", pref: "nl" }), { lang: "en", source: "path", redirect: null });
});

test("1. schrijfwijze van het prefix wordt rechtgezet, taal blijft", () => {
  assert.deepEqual(r({ path: "/EN/initiative/", search: "?k=ABC234" }), { lang: "en", source: "path", redirect: "/en/initiative/?k=ABC234" });
  assert.deepEqual(r({ path: "/nl-BE/" }), { lang: "nl", source: "path", redirect: "/nl/" });
  assert.deepEqual(r({ path: "/nl_BE/x" }), { lang: "nl", source: "path", redirect: "/nl/x" });
});

test("2. ongeldig of niet-ondersteund prefix → Engels, rest van het pad en de query blijven", () => {
  assert.deepEqual(r({ path: "/de/initiative/", pref: "nl", search: "?k=ABC234" }), { lang: "en", source: "default", redirect: "/en/initiative/?k=ABC234" });
  assert.deepEqual(r({ path: "/xx/" }), { lang: "en", source: "default", redirect: "/en/" });
  assert.equal(resolveLang({ path: "/xx/" }).redirect, "/nl/", "tot WP33: de terugval binnen LIVE");
});

test("3. zonder prefix: voorkeur, dan browsertaal, dan Engels", () => {
  assert.deepEqual(r({ path: "/", pref: "nl", languages: ["en-US"] }), { lang: "nl", source: "pref", redirect: "/nl/initiative/" });
  assert.deepEqual(r({ path: "/", languages: ["de-DE", "nl-BE", "en"] }), { lang: "nl", source: "browser", redirect: "/nl/initiative/" });
  assert.deepEqual(r({ path: "/", languages: ["de-DE", "fr"] }), { lang: "en", source: "default", redirect: "/en/initiative/" });
  assert.deepEqual(r({ path: "/", languages: [] }), { lang: "en", source: "default", redirect: "/en/initiative/" });
  assert.deepEqual(r({ path: "/", languages: undefined }), { lang: "en", source: "default", redirect: "/en/initiative/" });
});

test("3. een expliciete keuze gaat voor de browsertaal; een ongeldige voorkeur telt niet", () => {
  assert.equal(r({ path: "/", pref: "en", languages: ["nl-NL"] }).lang, "en");
  assert.deepEqual(r({ path: "/", pref: "de", languages: ["nl"] }), { lang: "nl", source: "browser", redirect: "/nl/initiative/" });
});

test("3. tot WP33: Engels-voorkeur of Engelse browser geeft nog Nederlands (geen half vertaalde app)", () => {
  assert.equal(resolveLang({ path: "/", pref: "en" }).lang, "nl");
  assert.equal(resolveLang({ path: "/", languages: ["en-US"] }).lang, "nl");
});

test("oude adressen gaan naar de juiste pagina, met ?k= (spelerslink en QR blijven werken)", () => {
  const go = (path) => r({ path, pref: "nl", search: "?k=K7M3QX" }).redirect;
  assert.equal(go("/"), "/nl/initiative/?k=K7M3QX");
  assert.equal(go("/index.html"), "/nl/initiative/?k=K7M3QX");
  assert.equal(go("/initiative"), "/nl/initiative/?k=K7M3QX");
  assert.equal(go("/initiative/"), "/nl/initiative/?k=K7M3QX");
  for (const p of ["/speler", "/speler.html", "/player", "/player/", "/initiative/player"]) assert.equal(go(p), "/nl/initiative/player/?k=K7M3QX", p);
  assert.equal(r({ path: "/speler", languages: ["en-GB"], hash: "#x" }).redirect, "/en/initiative/player/#x");
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
  assert.equal(browserLang(["fr", "en-GB", "nl"], BOTH), "en");
  assert.equal(browserLang("nl-NL", BOTH), "nl");
  assert.equal(browserLang(null), null);
  assert.equal(fallbackIn(["nl"]), "nl");
  assert.equal(fallbackIn(BOTH), "en");
});

test("pathFor, pageFor en switchPath (taalkiezer)", () => {
  assert.equal(pathFor("nl", "/speler"), "/nl/initiative/player/");
  assert.equal(pathFor("en", "/"), "/en/initiative/");
  assert.equal(pageFor("/characters/"), "/characters/");
  assert.equal(switchPath("/nl/initiative/", "en"), "/en/initiative/");
  assert.equal(switchPath("/nl/", "en"), HOME ? "/en/" : "/en/initiative/", "homepage blijft homepage (zodra die er is)");
  assert.equal(switchPath("/nl/initiative/", undefined), "/en/initiative/", "ongeldige taal: terugval");
  assert.equal(switchPath("/nl/initiative/", "de"), "/en/initiative/");
  assert.equal(switchPath("/nl/initiative/player/", "en"), "/en/initiative/player/");
  assert.equal(switchPath("/speler", "en"), "/en/initiative/player/");
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

test("homepage (WP30): een kaal taalprefix blijft of wordt de homepage, taalloos / blijft de app (V4)", () => {
  assert.equal(HOME, true);
  assert.deepEqual(r({ path: "/en/" }), { lang: "en", source: "path", redirect: null });
  assert.deepEqual(r({ path: "/nl", search: "?k=ABC234" }), { lang: "nl", source: "path", redirect: null }, "slash: Cloudflare (html_handling)");
  assert.deepEqual(r({ path: "/EN" }), { lang: "en", source: "path", redirect: "/en/" });
  assert.equal(r({ path: "/", languages: ["en-US"] }).redirect, "/en/initiative/");
});

const PATHS = ["/", "", "//", "/EN", "/en", "/nl-be/x", "/nl_BE/", "/js/x", "/xx", "/xx/initiative/", "/de/initiative/player/",
  "/en/initiative/player/", "/initiative/player/index.html", "/speler.html", "/player", "/index.html", "/initiative",
  "//nl//initiative", "/%2F%2Fevil.com", "/characters/", "/nl/initiative/", "/en/"];

test("geen lus: een doorverwijzing opnieuw bepalen geeft geen nieuwe doorverwijzing", () => {
  for (const live of [LIVE, BOTH]) for (const path of PATHS) for (const pref of [null, "nl", "en"]) {
    const a = resolveLang({ path, pref, live, languages: ["de", "en-US"], search: "?k=ABC234" });
    if (!a.redirect) continue;
    const u = new URL(a.redirect, "https://kevs-inn.com");
    assert.equal(u.search, "?k=ABC234", path);
    const b = resolveLang({ path: u.pathname, pref, live, languages: ["de", "en-US"] });
    assert.equal(b.redirect, null, `${path} → ${a.redirect} → ${b.redirect}`);
    assert.equal(b.lang, a.lang, path);
  }
});

test("geen open redirect: elke doorverwijzing blijft op dezelfde host onder /{taal}/", () => {
  for (const path of [...PATHS, "//evil.com", "//evil.com/x", "/\\evil.com", "/NL//evil.com", "/xx//evil.com", "/\\/evil.com"])
    for (const live of [LIVE, BOTH]) {
      const { redirect } = resolveLang({ path, live, languages: ["en"] });
      if (!redirect) continue;
      assert.match(redirect, /^\/(en|nl)\//, `${path} → ${redirect}`);
      assert.equal(new URL(redirect, "https://kevs-inn.com").host, "kevs-inn.com", `${path} → ${redirect}`);
    }
});

test("WP22: offered en debugStored: kiezer en automatische keuze uit LIVE, in de debugstand alle talen", async () => {
  const { offered, debugStored, DEBUG_KEY, DEBUG_MODES } = await import("../js/i18n/lang.js");
  assert.deepEqual(offered(false), LIVE);
  assert.deepEqual(offered(true), SUPPORTED);
  const st = (v) => ({ getItem: (k) => (k === DEBUG_KEY ? v : null) });
  assert.deepEqual(DEBUG_MODES, ["debug", "xx"]);
  assert.equal(debugStored(st("debug")), true);
  assert.equal(debugStored(st("xx")), true);
  assert.equal(debugStored(st("off")), false);
  assert.equal(debugStored(st(null)), false);
  assert.equal(debugStored(null), false, "geen opslag = uit");
  assert.equal(debugStored({ getItem() { throw new Error("geblokkeerd"); } }), false, "nooit een fout");
  const boot = await import("../js/i18n/boot.js");
  assert.equal(boot.DEBUG_KEY, DEBUG_KEY, "één sleutel voor boot en doorverwijzer");
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
  assert.equal(l.to, "/en/initiative/player/?k=ABC234#x");
  assert.equal(store.get(), "en");
  l = loc("/en/initiative/");
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
  assert.equal(l.to, "/en/initiative/");
  // knoppen: elke taal in haar eigen taal met lang, huidige ingedrukt; label tweetalig, huidige taal eerst
  const h = langSegHtml("nl", ["en", "nl"]);
  assert.match(h, /data-lang="en" lang="en" aria-pressed="false">English</);
  assert.match(h, /data-lang="nl" lang="nl" aria-pressed="true">Nederlands</);
  assert.equal(langLabelHtml("nl", ["en", "nl"]), 'Taal · <span lang="en">Language</span>');
  assert.equal(langLabelHtml("en", ["en", "nl"]), 'Language · <span lang="nl">Taal</span>');
  assert.equal(langLabelText("en", ["en", "nl"]), "Language, Taal");
});
