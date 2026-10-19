// Kleine DOM-hulpjes en meldingen.
export const $ = (s) => document.querySelector(s);
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const n0 = (v) => (Number.isFinite(+v) ? +v : 0);

let tt = 0, tLast = 0;
/** Toont een melding; meldingen binnen 300 ms worden samengevoegd. html moet al geëscaped zijn. */
export function toastHtml(html) {
  const t = $("#toast");
  const now = Date.now();
  t.innerHTML = !t.hidden && now - tLast < 300 ? t.innerHTML + "<br>" + html : html;
  tLast = now;
  t.hidden = false;
  clearTimeout(tt);
  tt = setTimeout(() => (t.hidden = true), 5000);
}
export const toast = (text) => toastHtml(esc(text));
/** Fx-meldingen uit de regels tonen */
export const show = (fx) => fx && fx.msgs.forEach((m) => toast(m));
/**
 * Tikbare spellnaam: opent de spell-uitleg (js/ui/spellinfo.js). label = getoonde tekst (ook met annotatie),
 * name = naam om op te zoeken, cid = speler van wie de sheet-gegevens als terugval dienen (niet-SRD-spell).
 */
export const spellLink = (name, label = name, cid = "") =>
  `<button type="button" class="spl" data-spell="${esc(name)}"${cid ? ` data-cid="${esc(cid)}"` : ""}>${esc(label)}</button>`;
