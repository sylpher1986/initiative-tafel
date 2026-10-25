// Vertalingen laden bij het opstarten (meertaligheid, WP20/TA4). De taal van de pagina staat in <html lang> (de pagina
// is per taal gegenereerd vanaf WP21); hier wordt die catalogus geladen (locales/<taal>.js, één bestand per taal,
// gemaakt door tools/i18n-build.mjs), plus Engels als terugval. Duurt laden langer dan WAIT_MS (trage wifi op een tv),
// dan start de app met wat er binnen is: een vertaling mag het opstarten nooit tegenhouden (dev-review WP20).
// Gebruik in de app: import { t } from "./i18n/boot.js" (na initI18n; ervoor geeft t de sleutel terug).
//
// Ontwikkelen (werkt ook op de telefoon, blijft bewaard tot je hem uitzet):
//   ?i18n=debug  ontbrekende vertalingen tussen ⟦ ⟧ op het scherm en als waarschuwing in de console
//   ?i18n=xx     testtaal: lange tekst met accenten (tools/i18n-pseudo.mjs); wat niet verandert, is nog niet vertaald
//   ?i18n=off    weer normaal
import { createI18n } from "./core.js";
import { normLang, LOCALES, DEFAULT, DEBUG_KEY, DEBUG_MODES as MODES } from "./lang.js";

export { DEBUG_KEY };
export const WAIT_MS = 3000;

/** Debugstand uit de query (wint en wordt bewaard) of de opgeslagen stand. Puur.
 *  → { mode: "debug" | "xx" | null, store: undefined (niets doen) | null (wissen) | "debug" | "xx" } */
export function i18nMode(search, stored) {
  const q = /[?&]i18n=([a-z]+)/i.exec(String(search || ""));
  if (q) {
    const v = q[1].toLowerCase();
    if (MODES.includes(v)) return { mode: v, store: v };
    if (v === "off") return { mode: null, store: null };
  }
  return { mode: MODES.includes(stored) ? stored : null, store: undefined };
}

let cur = createI18n({ lang: DEFAULT }), curMode = null, gen = 0;
/** Actieve debugstand ("debug", "xx" of null), voor de versieregel in Instellingen */
export const i18nDebug = () => curMode;
/** Huidige vertaler (core.js); vóór initI18n zonder catalogi */
export const i18n = () => cur;
export const t = (key, params) => cur.t(key, params);
export const tr = (d) => cur.tr(d);

const loadCat = (l) => import(`../../locales/${l}.js`).then((m) => m.default || {});

/**
 * Laadt de catalogus van de pagina-taal (en Engels) en zet de vertaler. Gooit nooit en wacht nooit langer dan wait:
 * lukt laden niet, dan blijft t de sleutel of de Engelse tekst geven en staat de fout in de console en de foutbalk
 * (window.__itErr, alleen in de DM-app); komt een catalogus te laat, dan geldt hij vanaf dat moment.
 * @param {object} [o]  alleen voor tests: doc, search, storage (null = geen opslag), load, wait
 */
export async function initI18n({ doc = globalThis.document, search = globalThis.location?.search, storage, load = loadCat, wait = WAIT_MS } = {}) {
  let st = null;
  try { st = storage !== undefined ? storage : globalThis.localStorage || null; } catch { st = null; }
  let stored = null;
  try { stored = st ? st.getItem(DEBUG_KEY) : null; } catch { /* geen opslag */ }
  const { mode, store } = i18nMode(search, stored);
  try { if (st && store === null) st.removeItem(DEBUG_KEY); else if (st && store) st.setItem(DEBUG_KEY, store); } catch { /* geen opslag */ }

  const page = normLang(doc?.documentElement?.lang) || DEFAULT;
  const lang = mode === "xx" ? "xx" : page;
  const want = [...new Set([lang, DEFAULT])];
  const catalogs = {};
  const fail = (l, why) => {
    const m = `i18n: catalog ${l} failed to load: ${why && why.message || why}`; // technische diagnose: Engels, geen UI-tekst
    console.warn(m);
    if (globalThis.__itErr) globalThis.__itErr(m);
  };
  const debug = !!mode, me = ++gen;
  curMode = mode;
  const make = () => {
    if (me !== gen) return; // een latere initI18n is de baas
    cur = createI18n({
      lang, catalogs, fallback: DEFAULT, locale: LOCALES[page] || page, debug,
      onMissing: debug ? (key, l, kind) => console.warn(`[i18n] ${kind === "none" ? "missing everywhere" : "not translated"} (${l}): ${key}`) : undefined,
    });
  };
  let late = false, timer;
  const all = Promise.allSettled(want.map((l) => Promise.resolve().then(() => load(l)).then(
    (v) => { catalogs[l] = v; if (late) make(); }, // te laat binnen: vanaf de volgende render toch vertaald
    (e) => fail(l, e),
  )));
  await Promise.race([all, new Promise((r) => { timer = setTimeout(() => { late = true; console.warn(`i18n: catalogs slow (> ${wait} ms), starting without`); r(); }, wait); })]);
  clearTimeout(timer);
  make();
  return cur;
}
