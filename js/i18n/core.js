// Vertaalfunctie voor heel Kev’s Inn (meertaligheid, WP19/TA3). Puur: geen DOM, geen opslag; de catalogi komen
// als gewone objecten binnen (locales/<taal>/*.js, vanaf WP20). Plan: docs/i18n.md §3.1.
//
// Catalogus = plat object { "init.fight.next": "Volgende", ... }. Een waarde is een tekst of een meervoudsobject
// { one, other } (sleutels volgens Intl.PluralRules; "other" is verplicht), gekozen op params.n.
// Placeholders: {naam}. Getallen worden in de taal opgemaakt (1.950 / 1,950), een descriptor { k, p } wordt
// zelf vertaald, een array wordt een opsomming ("a, b en c"). Een onbekende placeholder blijft zichtbaar staan.
// Terugval per sleutel: actieve taal → terugvaltaal (Engels) → de sleutel zelf. Ontbreekt een sleutel in de
// actieve taal, dan meldt onMissing dat; in debugmodus staat de tekst tussen ⟦ ⟧, zodat het op het scherm opvalt.
//
// Veiligheid: t() escapet niets. Wie de uitkomst in HTML zet, gebruikt esc() zoals nu (ook voor de waarden).
// Placeholders lezen alleen eigen sleutels van params ({toString} wordt nooit een functie); een punt in de naam is
// gewoon deel van de sleutel (params["a.b"]), geen pad. Geneste descriptoren/arrays stoppen na MAX_DEPTH niveaus
// (vanaf WP27 komen descriptoren uit opgeslagen en geïmporteerde data: een lus mag nooit de stack opblazen).
import { isMsg } from "./msg.js";

const PH = /\{([A-Za-z_][\w.]*)\}/g;
const own_ = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
export const MAX_DEPTH = 8;
const pad2 = (n) => String(n).padStart(2, "0");

/** Meervoudsregel zonder Intl.PluralRules (Safari < 13): klopt voor Engels en Nederlands */
const basicPlural = (n) => (Math.abs(n) === 1 ? "one" : "other");

/**
 * @param {object} o
 * @param {string} o.lang            actieve taal ("nl")
 * @param {object} o.catalogs        { en: {...}, nl: {...} }
 * @param {string} [o.fallback="en"] terugvaltaal
 * @param {string} [o.locale]        Intl-locale voor getallen en datums (standaard = lang)
 * @param {boolean} [o.debug]        ontbrekende vertalingen zichtbaar maken (⟦…⟧)
 * @param {function} [o.onMissing]   (key, lang, kind) bij een ontbrekende sleutel; kind "fallback" of "none"
 * @param {object} [o.intl]          Intl-vervanger (tests); standaard globalThis.Intl
 */
export function createI18n({ lang, catalogs = {}, fallback = "en", locale, debug = false, onMissing, intl = globalThis.Intl } = {}) {
  const cat = (l) => (own_(catalogs, l) && catalogs[l]) || {};
  const own = cat(lang), back = lang === fallback ? {} : cat(fallback);
  const loc = locale || lang;
  const missing = new Map(); // key → kind (één keer per sleutel melden)
  const miss = (key, kind) => {
    if (missing.has(key)) return;
    missing.set(key, kind);
    if (onMissing) try { onMissing(key, lang, kind); } catch { /* melden mag nooit de app breken */ }
  };
  const cache = {};
  const make = (name, opts) => {
    const id = name + JSON.stringify(opts || {});
    if (!(id in cache)) { try { cache[id] = intl && intl[name] ? new intl[name](loc, opts) : null; } catch { cache[id] = null; } }
    return cache[id];
  };

  /** Getal in de taal: 1950 → "1.950" (nl) of "1,950" (en); geen getal = String(x) */
  const num = (n, opts) => {
    if (typeof n !== "number" || !Number.isFinite(n)) return String(n);
    if (n === 0) n = 0; // -0 → 0
    const f = make("NumberFormat", opts);
    return f ? f.format(n) : String(n);
  };
  /** Datum (Date of ms); opts zoals Intl.DateTimeFormat */
  const date = (t, opts = { day: "numeric", month: "short", year: "numeric" }, bare) => {
    if (t == null || t === "") return ""; // new Date(null) zou 1 jan 1970 zijn
    const d = t instanceof Date ? t : new Date(t);
    if (Number.isNaN(d.getTime())) return "";
    const f = make("DateTimeFormat", opts);
    return f ? f.format(d) : bare ? bare(d) : d.toISOString().slice(0, 10);
  };
  /** Tijd HH:MM (zonder Intl: lokale uren en minuten) */
  const time = (t) => date(t, { hour: "2-digit", minute: "2-digit" }, (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`);
  /** Opsomming "a, b en c" / "a, b, and c"; zonder Intl.ListFormat (Safari < 14.1) met komma's */
  const list = (items, type = "conjunction") => {
    const L = (items || []).map(String);
    const f = make("ListFormat", { type });
    return f ? f.format(L) : L.join(", ");
  };
  /** Meervoudscategorie voor n ("one", "other", …) */
  const plural = (n) => {
    const f = make("PluralRules");
    return f ? f.select(n) : basicPlural(n);
  };

  const pick = (v, params) => {
    if (v && typeof v === "object") {
      const n = params && typeof params.n === "number" ? params.n : NaN;
      return v[Number.isNaN(n) ? "other" : plural(n)] ?? v.other ?? "";
    }
    return v;
  };
  const value = (x, depth) => {
    if (depth > MAX_DEPTH) return isMsg(x) ? x.k : "…";
    return isMsg(x) ? look(x.k, x.p, depth + 1) : Array.isArray(x) ? list(x.map((y) => value(y, depth + 1))) : typeof x === "number" ? num(x) : String(x);
  };
  const fill = (s, params, depth) => (params && typeof params === "object"
    ? String(s).replace(PH, (m, name) => (own_(params, name) && params[name] != null ? value(params[name], depth) : m))
    : String(s));

  /** Vertaal een sleutel; params vullen {placeholders} in, params.n kiest het meervoud */
  function look(key, params, depth) {
    if (own_(own, key)) return fill(pick(own[key], params), params, depth);
    if (own_(back, key)) {
      miss(key, "fallback");
      const s = fill(pick(back[key], params), params, depth);
      return debug ? `⟦${s}⟧` : s;
    }
    miss(key, "none");
    return debug ? `⟦${key}⟧` : key;
  }
  const t = (key, params) => look(key, params, 0);
  /** Descriptor { k, p } vertalen (geen descriptor: als tekst) */
  const tr = (d) => (isMsg(d) ? t(d.k, d.p) : d == null ? "" : String(d));
  /** Bestaat de sleutel in de actieve taal of de terugval? */
  const has = (key) => own_(own, key) || own_(back, key);

  return { lang, locale: loc, t, tr, has, num, date, time, list, plural, missing: () => [...missing.keys()] };
}
