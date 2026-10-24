// Taal bepalen en taalpaden voor heel Kev’s Inn (meertaligheid, WP19/TA3). Puur, behalve prefStore (localStorage,
// altijd in try/catch). Regels: docs/i18n.md §2.2; besluiten §0 (alleen localStorage, Engelse padsegmenten, / = app).
//
// Volgorde:
//   1. ondersteund prefix in de URL (/en/…, /nl/…) wint altijd, zonder melding; verandert de voorkeur niet
//      (alleen de taalkiezer schrijft de voorkeur; resolveLang schrijft nooit)
//   2. ongeldig of niet-ondersteund prefix (/de/…, /xx/…) → terugvaltaal, zelfde rest van het pad
//   3. geen prefix: opgeslagen voorkeur → eerste ondersteunde browsertaal (nl-BE → nl) → terugvaltaal
// Tot Engels live gaat (WP33) kiezen 2 en 3 alleen uit LIVE; een /en/-link werkt wel (SUPPORTED).

/** Talen met code, catalogi en pagina's */
export const SUPPORTED = ["en", "nl"];
/** Talen die automatisch gekozen en in de taalkiezer aangeboden worden (WP33: ["en", "nl"]) */
export const LIVE = ["nl"];
/** Standaard- en terugvaltaal */
export const DEFAULT = "en";
/** Intl-locale per taal (getallen, datums); één plek om te wijzigen */
export const LOCALES = { en: "en", nl: "nl-NL" };
/** localStorage-sleutel van de voorkeur (platformbreed voorvoegsel kevs-) */
export const PREF_KEY = "kevs-lang";

// Eerste padsegment dat op een taalcode lijkt ("nl", "en-gb"); mappen van de app tellen nooit als taal.
const CODE = /^[a-z]{2}(-[a-z]{2})?$/i;
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

// Oude en taalloze adressen → pagina (pad na het taalprefix). Alles wat er niet in staat blijft gelijk.
const PAGES = {
  "/": "/initiative/", "/index.html": "/initiative/",
  "/initiative": "/initiative/", "/initiative/": "/initiative/", "/initiative/index.html": "/initiative/",
  "/speler": "/initiative/player/", "/speler/": "/initiative/player/", "/speler.html": "/initiative/player/",
  "/player": "/initiative/player/", "/player/": "/initiative/player/",
  "/initiative/player": "/initiative/player/", "/initiative/player/index.html": "/initiative/player/",
};
/** Pagina voor een pad zonder prefix: "/speler.html" → "/initiative/player/" (V4: "/" = de app) */
export const pageFor = (rest) => PAGES[rest] || rest;

const slash = (p) => "/" + String(p || "/").replace(/^\/+/, "");
/** Taalloos adres in een taal (oude adressen eerst omgezet): pathFor("nl", "/speler") → "/nl/initiative/player/",
 *  pathFor("nl", "/") → "/nl/initiative/" (V4) */
export const pathFor = (lang, path = "/") => `/${lang}${pageFor(slash(path))}`;
/** Rest van een pad dat al een prefix had, in een andere taal: langPath("en", "/") → "/en/" (homepage) */
const langPath = (lang, rest) => `/${lang}${slash(rest)}`;

/** Zelfde pagina in een andere taal (taalkiezer): "/nl/initiative/" → "/en/initiative/" */
export function switchPath(path, lang) {
  const { prefix, rest } = parsePath(path);
  return prefix ? langPath(lang, rest) : pathFor(lang, path);
}

/** Eerste ondersteunde browsertaal uit navigator.languages (of navigator.language) */
export function browserLang(languages, list = LIVE) {
  for (const l of [].concat(languages || [])) { const x = normLang(l, list); if (x) return x; }
  return null;
}

/**
 * Taal voor een adres.
 * @param {object} o
 * @param {string} o.path            location.pathname
 * @param {string} [o.search]        location.search (blijft bij een doorverwijzing staan, ook ?k=)
 * @param {string} [o.hash]
 * @param {string|null} [o.pref]     opgeslagen voorkeur (prefStore().get())
 * @param {string[]} [o.languages]   navigator.languages
 * @param {string[]} [o.live]        talen voor automatische keuze (standaard LIVE)
 * @returns {{ lang: string, source: "path"|"pref"|"browser"|"default", redirect: string|null }}
 *   redirect = waar de pagina naartoe moet (location.replace), of null als het adres goed is
 */
export function resolveLang({ path = "/", search = "", hash = "", pref = null, languages = [], live = LIVE } = {}) {
  const tail = (search || "") + (hash || "");
  const { prefix, lang, rest } = parsePath(path);
  const fb = fallbackIn(live);
  if (prefix && lang) { // 1. ondersteund prefix wint, ook als de voorkeur anders is; alleen de schrijfwijze rechtzetten
    return { lang, source: "path", redirect: prefix === lang ? null : langPath(lang, rest) + tail };
  }
  if (prefix) return { lang: fb, source: "default", redirect: langPath(fb, rest) + tail }; // 2. ongeldig prefix
  const p = normLang(pref, live), b = browserLang(languages, live); // 3. geen prefix
  const pick = p ? [p, "pref"] : b ? [b, "browser"] : [fb, "default"];
  return { lang: pick[0], source: pick[1], redirect: pathFor(pick[0], path) + tail };
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
