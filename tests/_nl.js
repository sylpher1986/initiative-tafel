// Testhulp (WP27): Nederlandse catalogus laden, zodat descriptoren uit js/rules/ en js/log.js als de oude Nederlandse
// zinnen te vergelijken zijn. De verwachte zinnen in de tests blijven zo ongewijzigd (docs/i18n.md, WP27).
import { initI18n, tr } from "../js/i18n/boot.js";
await initI18n({ doc: { documentElement: { lang: "nl" } }, search: "", storage: null });

/** Descriptor (of tekst, of lijst daarvan) als Nederlandse tekst */
export const nl = (x) => (Array.isArray(x) ? x.map(nl) : tr(x));
/** Oorzaken [{ t, id }] met t als Nederlandse tekst */
export const nlw = (why) => (why || []).map((w) => ({ ...w, t: tr(w.t) }));
/** Fx { msgs, why } met teksten (msgs en why vertaald, de rest ongewijzigd) */
export const nlfx = (f) => (f ? { ...f, msgs: nl(f.msgs || []), why: nlw(f.why) } : f);
