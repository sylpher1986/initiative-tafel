// Taalkiezer (WP22/TA6, docs/i18n.md §2.4–2.5): seg-knoppen, elke taal in haar eigen taal met lang-attribuut.
// Gedeeld door de DM-app (Instellingen → Weergave) en het spelersscherm. Kiezen = voorkeur bewaren (kevs-lang, per
// apparaat) + location.replace naar dezelfde pagina met de andere prefix (query en hash blijven, ook ?k=). De pagina
// herlaadt: stand en undo uit IndexedDB (DA2), de kamer verbindt opnieuw (it-room), het tabblad claimt opnieuw (DA3).
// Alleen zichtbaar bij meer dan één taal in offered(): tot WP33 alleen in de i18n-debugstand.
import { offered, normLang, prefStore, switchPath, DEFAULT } from "../i18n/lang.js";
import { t, i18nDebug } from "../i18n/boot.js";
import { esc } from "./util.js";

/** Taal van deze pagina (<html lang>, per taal gegenereerd) */
export const pageLang = (doc = document) => normLang(doc.documentElement.lang) || DEFAULT;
/** Talen voor de kiezer; minder dan twee = geen kiezer. Zelfde bron als de rest van de app (query of opslag, na
 *  initI18n), dus ?i18n=debug werkt ook zonder localStorage (dev-review WP22). */
export const pickLangs = () => offered(!!i18nDebug());

/** Knoppen voor een .seg; de naam van elke taal komt uit haar eigen catalogus-sleutel (endoniem, niet vertaald) */
export const langSegHtml = (cur, langs = pickLangs()) => langs.map((l) =>
  `<button type="button" data-lang="${esc(l)}" lang="${esc(l)}" aria-pressed="${l === cur}">${esc(t(`common.lang.${l}`))}</button>`).join("");

/** Wisselen: voorkeur bewaren, dan naar dezelfde pagina in die taal. Zelfde taal = alleen de voorkeur. */
export function switchLang(lang, { loc = location, store = prefStore(), cur = pageLang() } = {}) {
  const l = normLang(lang);
  if (!l) return false;
  store.set(l); // lukt dit niet (privémodus), dan wisselt alleen deze pagina; een /nl/-link blijft Nederlands
  if (l === cur) return false;
  loc.replace(switchPath(loc.pathname, l) + (loc.search || "") + (loc.hash || ""));
  return true;
}

// Het woord "Taal" in elke taal, zelf in die taal (zoals de taalnamen): wie de huidige taal niet leest, vindt de kiezer
// toch (UX-agent WP22). Daarom geen catalogus-sleutel: die geeft alleen de huidige taal.
const WORD = { en: "Language", nl: "Taal" };
/** Label van de kiezer: huidige taal eerst, dan de andere(n), elk met lang (HTML) */
const curFirst = (cur, langs) => [cur, ...langs.filter((l) => l !== cur)];
export const langLabelHtml = (cur, langs = pickLangs()) => curFirst(cur, langs)
  .map((l, i) => (i ? `<span lang="${esc(l)}">${esc(WORD[l] || l)}</span>` : esc(WORD[l] || l))).join(" · ");
/** Zelfde als platte tekst (aria-label op het spelersscherm) */
export const langLabelText = (cur, langs = pickLangs()) => curFirst(cur, langs).map((l) => WORD[l] || l).join(", ");

/**
 * Zet de kiezer in een .seg en koppelt de klik. Bij één taal blijft alles verborgen en geeft het false.
 * label: element dat het label krijgt (aria-labelledby op de seg), anders krijgt de seg een aria-label.
 */
export function mountLangPick(seg, label = null) {
  const langs = pickLangs(), cur = pageLang();
  if (!seg || langs.length < 2) return false;
  seg.innerHTML = langSegHtml(cur, langs);
  if (label) { label.innerHTML = langLabelHtml(cur, langs); label.hidden = false; }
  else seg.setAttribute("aria-label", langLabelText(cur, langs));
  seg.addEventListener("click", (e) => { const b = e.target.closest("[data-lang]"); if (b) switchLang(b.dataset.lang); });
  seg.hidden = false;
  return true;
}
