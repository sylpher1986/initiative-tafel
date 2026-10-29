// Inn the Grid (G4, WP60): projectbestand naar buiten brengen en binnenhalen (browserdeel van js/maps/model/file.js).
// Exporteren zoals exportFile in Initiative (eigen kopie, grens): eerst het deelmenu met het bestand (telefoon: AirDrop,
// Bestanden, mail), anders of bij een fout downloaden. Het bestand wordt als Blob uit stukken gebouwd, zodat een grote
// afbeelding nooit één enorme string in het geheugen wordt.
import { buildParts, readFile, fileName, FILE_MAX } from "../model/file.js";
import { toHex } from "../model/image.js";
import { assetImage } from "./upload.js";

const sha256 = async (bytes) => toHex(await crypto.subtle.digest("SHA-256", bytes));
const readText = (file) => (file.text ? file.text() : new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsText(file); }));

/**
 * Kaart exporteren. assets = Map(sha → record) met wat de kaart gebruikt. Geeft { r } met r = "done", "cancel" (deelmenu
 * gesloten), "big" (WP64: groter dan de importgrens) of "missing" (afbeelding niet beschikbaar: geen bestand gemaakt).
 * WP64: names = Map(sha → naam in Mijn assets) gaat mee voor eigen assets; "missing" geeft ook welke ontbreken (missing).
 */
export async function exportMap(map, assets, { app, title, names = null }) {
  const out = buildParts(map, assets, { app, names });
  if (out.big) return { r: "big" };
  if (!out.parts) return { r: "missing", missing: out.missing || [] };
  const name = fileName(map.name, new Date());
  const blob = new Blob(out.parts, { type: "application/json" });
  try {
    const f = new File([blob], name, { type: "application/json" });
    if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title }); return { r: "done" }; }
  } catch (err) { if (err && err.name === "AbortError") return { r: "cancel" }; } // geannuleerd; andere fout (geen gebruikersgebaar meer): downloaden
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return { r: "done" };
}

/**
 * Bestand lezen en controleren, tot en met decoderen van de afbeelding (de laatste controle die alleen de browser kan).
 * Geeft { ok: true, map, assets } (map zonder id) of { ok: false, code } (tekst via maps.imp.err.<code>).
 */
export async function importFile(file) {
  if (!file || !(file.size > 0)) return { ok: false, code: "empty" };
  if (file.size > FILE_MAX) return { ok: false, code: "big" }; // te groot: niet eens inlezen
  if (!(globalThis.crypto && crypto.subtle)) return { ok: false, code: "read" };
  let text;
  try { text = await readText(file); } catch { return { ok: false, code: "read" }; }
  const res = await readFile(file.size, text, { hash: sha256 });
  text = null; // geheugen (oude iPad): de tekst kan weg vóór het decoderen
  if (!res.ok) return res;
  for (const rec of res.assets.values()) {
    const img = await assetImage(rec);
    if (!img) return { ok: false, code: "image" };
    if (img.close) img.close(); // alleen controleren; tekenen gebeurt pas als de kaart open gaat
  }
  return res;
}
