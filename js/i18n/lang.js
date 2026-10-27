// Taal bepalen en taalpaden voor heel Kev’s Inn (meertaligheid, WP19/TA3; sinds WP44 Engels zonder voorvoegsel).
// Puur, behalve prefStore (localStorage, altijd in try/catch). Regels: docs/i18n.md §2.2.
//
// Adressen (WP44, WB1, 2.3.0): Engels is de leidende taal en staat zonder taalcode ("/", "/initiative/",
// "/initiative/player/"); elke andere taal krijgt een voorvoegsel ("/nl/", "/nl/initiative/"). "/en/…" bestaat niet
// meer: de Worker (worker/index.js, enRedirect) en de service worker sturen het met 301 door naar het pad zonder /en/.
// Taal uit het pad alleen via langFromPath/parsePath; adressen alleen via pathFor/switchPath (nooit zelf "/en/" of
// "/{lang}/" in een string). Geen automatische taalredirect op voorkeur of browsertaal, behalve bij het openen van een
// geïnstalleerde app (launchRedirect). De voorkeur (kevs-lang) schrijft alleen de taalkiezer (en eenmalig adoptExisting).

/** Talen met code, catalogi en pagina's */
export const SUPPORTED = ["en", "nl"];
/** Talen die automatisch gekozen en in de taalkiezer aangeboden worden (sinds WP33, 1.53.0: Engels live) */
export const LIVE = ["en", "nl"];
/** Standaard- en terugvaltaal */
export const DEFAULT = "en";
/** Intl-locale per taal (getallen, datums); één plek om te wijzigen */
export const LOCALES = { en: "en-GB", nl: "nl-NL" }; // en-GB: "12 Oct 2026" en 24-uursklok (vertaalagent WP20); spelling blijft Amerikaans (PHB)
/** localStorage-sleutel van de voorkeur (platformbreed voorvoegsel kevs-) */
export const PREF_KEY = "kevs-lang";
/** sessionStorage-sleutel: taal die in dit venster met de taalkiezer gekozen is (WP44). Gaat in een geïnstalleerde
 *  app voor de voorkeur (launchRedirect), zodat kiezen ook werkt als localStorage niet schrijft. */
export const TAB_KEY = "kevs-lang-tab";
/** localStorage-sleutel: eenmalige overgang bij Engels live (WP33) is gedaan op dit apparaat (adoptExisting) */
export const ADOPT_KEY = "kevs-lang-adopt";
/** localStorage-sleutel van de i18n-debugstand (?i18n=debug|xx|off, zie boot.js) */
export const DEBUG_KEY = "kevs-i18n-debug";
/** Geldige debugstanden (boot.js) */
export const DEBUG_MODES = ["debug", "xx"];

/** Talen in de taalkiezer en voor de automatische keuze: LIVE, in de debugstand alle ondersteunde (WP22; voor een
 *  toekomstige taal die nog niet live is). De kiezer is er alleen bij meer dan één taal. */
export const offered = (debug) => (debug ? SUPPORTED : LIVE);

// Eerste padsegment dat op een taalcode lijkt ("nl", "en-gb"); mappen van de app tellen nooit als taal.
// Een nieuwe map of pagina van twee letters (/qr/, /tv/) moet in RESERVED, anders telt hij als ongeldig taalprefix.
const CODE = /^[a-z]{2}([-_][a-z]{2})?$/i;
const RESERVED = new Set(["js"]);

/** Taalcode naar ondersteunde taal: "nl-BE" → "nl", "EN" → "en", onbekend of leeg → null */
export function normLang(tag, list = SUPPORTED) {
  const base = String(tag || "").trim().toLowerCase().split(/[-_]/)[0];
  return list.includes(base) ? base : null;
}

/** Terugvaltaal binnen een lijst: Engels als die erin staat, anders de eerste */
export const fallbackIn = (list) => (list.includes(DEFAULT) ? DEFAULT : list[0] || DEFAULT);

/** Pad splitsen: "/nl/initiative/" → { prefix: "nl", lang: "nl", rest: "/initiative/" };
 *  "/xx/a" → { prefix: "xx", lang: null }; "/initiative/" → { prefix: null, lang: null, rest: "/initiative/" } */
export function parsePath(path, list = SUPPORTED) {
  const p = "/" + String(path || "/").replace(/^\/+/, "");
  const m = /^\/([^/]+)(\/.*)?$/.exec(p);
  const seg = m ? m[1] : "";
  if (!seg || !CODE.test(seg) || RESERVED.has(seg.toLowerCase())) return { prefix: null, lang: null, rest: p };
  return { prefix: seg, lang: normLang(seg, list), rest: m[2] || "/" };
}

/** Taal van een adres (WP44, WB1): geen voorvoegsel = Engels (DEFAULT), een ondersteund voorvoegsel = die taal,
 *  een ongeldig voorvoegsel (/xx/…) = Engels (resolveLang zet het adres recht). De enige regel voor taal-uit-pad. */
export function langFromPath(path) {
  const { prefix, lang } = parsePath(path);
  return prefix && lang ? lang : DEFAULT;
}

// Oude en verkorte adressen → pagina (pad zonder taalvoorvoegsel). Alles wat er niet in staat blijft gelijk.
const PAGES = {
  "/index.html": "/",
  "/initiative": "/initiative/", "/initiative/index.html": "/initiative/",
  "/speler": "/initiative/player/", "/speler/": "/initiative/player/", "/speler.html": "/initiative/player/",
  "/player": "/initiative/player/", "/player/": "/initiative/player/", "/player.html": "/initiative/player/",
  "/initiative/player": "/initiative/player/", "/initiative/player/index.html": "/initiative/player/",
};
/** Pagina voor een pad zonder prefix: "/speler.html" → "/initiative/player/"; "/" is de homepage (WP44) */
export const pageFor = (rest) => PAGES[rest] || rest;

const slash = (p) => "/" + String(p || "/").replace(/^\/+/, "");
/** Voorvoegsel van een taal: Engels heeft er geen (WP44: "/", "/initiative/"), elke andere taal "/{taal}" */
export const langBase = (lang) => (lang === DEFAULT ? "" : `/${lang}`);
/** Adres van een pagina in een taal (oude adressen eerst omgezet). Nooit "/en/…":
 *  pathFor("en", "/") → "/", pathFor("nl", "/") → "/nl/", pathFor("nl", "/speler") → "/nl/initiative/player/" */
export const pathFor = (lang, page = "/") => langBase(lang) + pageFor(slash(page));

/** Zelfde pagina in een andere taal (taalkiezer): "/nl/initiative/" → "/initiative/", "/initiative/player/" → "/nl/initiative/player/" */
export function switchPath(path, lang) {
  lang = normLang(lang) || DEFAULT;
  const { prefix, rest } = parsePath(path);
  return pathFor(lang, prefix ? rest : path);
}

/** Spelerslink voor een kamer in de taal van de pagina (WP44): "https://kevs-inn.com/initiative/player/?k=K7M3QX",
 *  in het Nederlands ".../nl/initiative/player/?k=…". Rechtstreeks naar de pagina: geen doorverwijzing voor de speler. */
export const joinUrl = (origin, lang, code) => `${origin}${pathFor(normLang(lang) || DEFAULT, "/initiative/player/")}?k=${code}`;

/** Eerste ondersteunde browsertaal uit navigator.languages (of navigator.language) */
export function browserLang(languages, list = LIVE) {
  for (const l of [].concat(languages || [])) { const x = normLang(l, list); if (x) return x; }
  return null;
}

/**
 * Taal voor een adres en of het adres rechtgezet moet worden (WP44, WB1). Alleen het pad telt: geen voorkeur, geen
 * browsertaal (geen automatische taalredirect; "/" is altijd Engels). Gebruikt door de 404-pagina's.
 *   1. ondersteund voorvoegsel: die taal; "/en/…" (oud) → zelfde pad zonder voorvoegsel; schrijfwijze rechtgezet ("/NL/" → "/nl/")
 *   2. ongeldig of niet-ondersteund voorvoegsel (/de/…, /xx/…) → Engels, zelfde rest van het pad
 *   3. geen voorvoegsel: Engels, niets doen
 * @returns {{ lang: string, source: "path"|"default", redirect: string|null }} redirect inclusief search en hash
 */
export function resolveLang({ path = "/", search = "", hash = "" } = {}) {
  const tail = (search || "") + (hash || "");
  const { prefix, lang, rest } = parsePath(path);
  if (!prefix) return { lang: DEFAULT, source: "path", redirect: null };
  if (!lang) return { lang: DEFAULT, source: "default", redirect: pathFor(DEFAULT, rest) + tail };
  return { lang, source: "path", redirect: lang === DEFAULT || prefix !== lang ? langBase(lang) + slash(rest) + tail : null };
}

/**
 * Taal waarin een beginscherm-app opent (WP44). Alle manifesten hebben start_url "/initiative/" (id "/" ongewijzigd,
 * zodat bestaande installaties één app blijven). Vóór 2.3.0 was dat een doorverwijzer naar de taal van voorkeur of
 * browser; nu is het de Engelse app. Alleen in een geïnstalleerde app (standalone) en alleen op een adres zonder
 * voorvoegsel kiest de app daarom nog: keuze in dit venster (tab, TAB_KEY) → voorkeur (taalkiezer, adoptExisting) →
 * browsertaal → Engels. De website zelf verwijst nooit automatisch door. Zelfde regel als het inline script in de
 * Engelse app-pagina (launchScript in tools/pages.mjs, vóór de eerste paint; tests/wp44.test.js vergelijkt ze).
 * @returns {string|null} adres in de andere taal (met search en hash), of null
 */
export function launchRedirect({ path = "/", search = "", hash = "", standalone = false, tab = null, pref = null, languages = [], live = LIVE } = {}) {
  if (!standalone || parsePath(path).prefix) return null;
  const lang = normLang(tab, live) || normLang(pref, live) || browserLang(languages, live) || fallbackIn(live);
  return lang === DEFAULT ? null : pathFor(lang, path) + (search || "") + (hash || "");
}

/** Opgeslagen voorkeur lezen: '{"lang":"nl","t":…}' → "nl"; kapot, onbekend of oud formaat → null */
export function parsePref(raw, list = SUPPORTED) {
  if (typeof raw !== "string" || !raw) return null;
  try { const o = JSON.parse(raw); return o && typeof o === "object" ? normLang(o.lang, list) : null; } catch { return null; }
}
/** Waarde om op te slaan; t = moment van kiezen (Fase 2: nieuwste keuze wint bij sync) */
export const prefValue = (lang, now = Date.now()) => JSON.stringify({ lang, t: now });

/**
 * Opslag van de voorkeur. Standaard localStorage (per apparaat, geen account; geen cookie, V2).
 * Fase 2 kan een tweede opslag (account) achter dezelfde get/set zetten zonder aanroepers te wijzigen.
 * Zonder localStorage (privémodus, geblokkeerd): get geeft null, set geeft false; nooit een fout.
 */
export function prefStore(storage) {
  const s = () => { try { return storage || globalThis.localStorage || null; } catch { return null; } };
  return {
    get() { try { const x = s(); return x ? parsePref(x.getItem(PREF_KEY)) : null; } catch { return null; } },
    set(lang, now) {
      const l = normLang(lang);
      if (!l) return false;
      try { const x = s(); if (!x) return false; x.setItem(PREF_KEY, prefValue(l, now)); return true; } catch { return false; }
    },
  };
}

/**
 * Eenmalige overgang bij Engels live (WP33, docs/i18n.md): wie de app al gebruikte toen alleen Nederlands live was
 * (er staat een it-*-sleutel) en geen voorkeur heeft, krijgt stil de voorkeur "nl", zodat een Engelstalige browser
 * hem niet ineens Engels geeft. Draait vóór de doorverwijzing en vóór het opstarten van de app (die it-*-sleutels
 * schrijft); daarna nooit meer (ADOPT_KEY), dus een nieuwe gebruiker van na de update houdt zijn browsertaal.
 * Zonder localStorage: niets. Nooit een fout. Geeft de gezette taal of null.
 */
export function adoptExisting(storage, lang = "nl") {
  try {
    const s = storage === undefined ? globalThis.localStorage : storage;
    if (!s || s.getItem(ADOPT_KEY) != null) return null;
    let old = false;
    for (let i = 0; i < s.length && !old; i++) old = String(s.key(i) || "").startsWith("it-");
    s.setItem(ADOPT_KEY, "1");
    if (!old || parsePref(s.getItem(PREF_KEY))) return null;
    s.setItem(PREF_KEY, prefValue(lang));
    return lang;
  } catch { return null; }
}
