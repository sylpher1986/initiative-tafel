// Vertalingen laden bij het opstarten (meertaligheid, WP20/TA4). De taal van de pagina staat in <html lang> (de pagina
// is per taal gegenereerd vanaf WP21); hier wordt alleen die catalogus geladen, plus Engels als terugval.
// Gebruik in de app: import { t } from "./i18n/boot.js" (na initI18n; ervoor geeft t de sleutel terug).
//
// Ontwikkelen (werkt ook op de telefoon, blijft bewaard tot je hem uitzet):
//   ?i18n=debug  ontbrekende vertalingen tussen ⟦ ⟧ op het scherm en als waarschuwing in de console
//   ?i18n=xx     testtaal: lange tekst met accenten (tools/i18n-pseudo.mjs); wat niet verandert, is nog niet vertaald
//   ?i18n=off    weer normaal
import { createI18n } from "./core.js";
import { normLang, LOCALES, DEFAULT } from "./lang.js";

export const DEBUG_KEY = "kevs-i18n-debug";
const MODES = ["debug", "xx"];

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

let cur = createI18n({ lang: DEFAULT });
/** Huidige vertaler (core.js); vóór initI18n zonder catalogi */
export const i18n = () => cur;
export const t = (key, params) => cur.t(key, params);
export const tr = (d) => cur.tr(d);

const loadCat = (l) => import(`../../locales/${l}/index.js`).then((m) => m.default || {});

/**
 * Laadt de catalogus van de pagina-taal (en Engels) en zet de vertaler. Gooit nooit: lukt laden niet, dan blijft t
 * de sleutel of de Engelse tekst geven en verschijnt de fout in de foutbalk (window.__itErr).
 * @param {object} [o]  alleen voor tests: doc, search, storage, load
 */
export async function initI18n({ doc = globalThis.document, search = globalThis.location?.search, storage, load = loadCat } = {}) {
  let st = null;
  try { st = storage || globalThis.localStorage || null; } catch { st = null; }
  let stored = null;
  try { stored = st ? st.getItem(DEBUG_KEY) : null; } catch { /* geen opslag */ }
  const { mode, store } = i18nMode(search, stored);
  try { if (st && store === null) st.removeItem(DEBUG_KEY); else if (st && store) st.setItem(DEBUG_KEY, store); } catch { /* geen opslag */ }

  const page = normLang(doc?.documentElement?.lang) || DEFAULT;
  const lang = mode === "xx" ? "xx" : page;
  const want = [...new Set([lang, DEFAULT])];
  const catalogs = {};
  const res = await Promise.allSettled(want.map((l) => load(l)));
  res.forEach((r, i) => {
    if (r.status === "fulfilled") catalogs[want[i]] = r.value;
    else if (globalThis.__itErr) globalThis.__itErr(`i18n: catalog ${want[i]} failed to load: ${r.reason && r.reason.message || r.reason}`); // technische diagnose: Engels, geen UI-tekst
  });
  const debug = !!mode;
  cur = createI18n({
    lang, catalogs, fallback: DEFAULT, locale: LOCALES[page] || page, debug,
    onMissing: debug ? (key, l, kind) => console.warn(`[i18n] ${kind === "none" ? "missing everywhere" : "not translated"} (${l}): ${key}`) : undefined,
  });
  return cur;
}
