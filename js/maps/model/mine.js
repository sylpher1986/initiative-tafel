// Inn the Grid (G4, WP64): "Mijn assets", puur (geen DOM, Node-testbaar). Eigen afbeeldingen die de DM als object op de
// kaart zet. Eén bibliotheek per apparaat (over alle kaarten heen), store "mine" in de IndexedDB (js/maps/store.js, DB
// versie 3). Een item = { sha, name, w, h, addedAt }: sha = sha256 van de opgeslagen bytes (sleutel in de store "assets",
// zoals een achtergrond), name = gebruikersinhoud (nooit vertaald), w/h = standaardgrootte in cellen bij plaatsen,
// thumb = miniatuur (ArrayBuffer, ≤ 128 px, mime tmime) voor de tegel: zo hoeft het paneel geen volle afbeelding te decoderen.
// Een object verwijst naar een eigen asset met diezelfde sha (ASSET_RE in model/assets.js). Uit de bibliotheek halen
// haalt alleen het item weg: kaarten die de afbeelding gebruiken houden hem (gcAssets telt elke verwijzing).
import { OBJ } from "./objects.js";

/** Langste itemnaam (tekens) en het maximum aantal items (bescherming tegen een gemaakte database of import) */
export const MINE = { nameMax: 40, max: 500, maxSide: 1024, thumb: 128, thumbBytes: 256 * 1024 };
const THUMB_MIMES = ["image/webp", "image/jpeg", "image/png"];
const SHA = /^[0-9a-f]{64}$/;

/** Eigen asset (sha256) in plaats van een ingebouwd onderdeel? */
export const isCustom = (ref) => typeof ref === "string" && SHA.test(ref);

/** Itemnaam opschonen: stuurtekens weg, witruimte samengevoegd, max MINE.nameMax codepunten; leeg → "" */
export function cleanItemName(v) {
  if (typeof v !== "string") return "";
  const s = v.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/g, " ").replace(/\s+/g, " ").trim();
  return [...s].slice(0, MINE.nameMax).join("").trim();
}

/** Naam uit een bestandsnaam: zonder map en extensie, _ en - als spatie ("goblin_token.png" → "goblin token"); leeg → "" */
export function nameFromFile(file) {
  const base = String(file ?? "").split(/[\\/]/).pop().replace(/\.[a-z0-9]{1,5}$/i, "");
  return cleanItemName(base.replace(/[_-]+/g, " "));
}

const q = (v) => Math.round(v * 4) / 4; // op 0,25 cel (de stap van de schaalgreep zonder snap)

/** Standaardgrootte in cellen: kortste zijde 1 cel, verhouding behouden (op 0,25 afgerond), langste ≤ OBJ.maxSize */
export function defaultCells(iw, ih) {
  if (!(iw > 0 && ih > 0)) return { w: 1, h: 1 };
  const r = Math.min(OBJ.maxSize, Math.max(iw, ih) / Math.min(iw, ih));
  const long = Math.max(1, q(r));
  return iw >= ih ? { w: long, h: 1 } : { w: 1, h: long };
}

const size = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.min(OBJ.maxSize, Math.max(OBJ.minSize, q(v))) : NaN);

/** Eén item opschonen; null = onbruikbaar (geen sha). Ontbrekende naam = "" (de UI toont dan een standaardnaam). */
export function cleanItem(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || !isCustom(raw.sha)) return null;
  const w = size(raw.w), h = size(raw.h);
  const t = Number.isFinite(raw.addedAt) && raw.addedAt > 0 ? Math.round(raw.addedAt) : 0;
  const out = { sha: raw.sha, name: cleanItemName(raw.name), w: Number.isFinite(w) ? w : 1, h: Number.isFinite(h) ? h : 1, addedAt: t };
  const ab = typeof ArrayBuffer !== "undefined" && raw.thumb instanceof ArrayBuffer;
  if (ab && raw.thumb.byteLength > 0 && raw.thumb.byteLength <= MINE.thumbBytes && THUMB_MIMES.includes(raw.tmime)) { out.thumb = raw.thumb; out.tmime = raw.tmime; }
  return out;
}

/** Lijst opschonen: onbruikbare en dubbele (op sha) weg, max MINE.max, nieuwste eerst (paneelvolgorde) */
export function cleanItems(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set(), out = [];
  for (const r of raw) { const it = cleanItem(r); if (it && !seen.has(it.sha)) { seen.add(it.sha); out.push(it); } }
  return out.sort((a, b) => b.addedAt - a.addedAt || (a.sha < b.sha ? -1 : 1)).slice(0, MINE.max);
}

/** Alle afbeeldingen waar een kaart naar verwijst: achtergrond + eigen assets op objecten (volgorde: eerst gezien) */
export function usedAssets(map) {
  const out = new Set();
  if (!map || typeof map !== "object") return [];
  if (map.bg && typeof map.bg.asset === "string") out.add(map.bg.asset);
  if (Array.isArray(map.objs)) for (const o of map.objs) if (o && isCustom(o.asset)) out.add(o.asset);
  return [...out];
}

/** Op hoeveel kaarten staat eigen asset sha (als object)? maps = lijst kaartdocumenten */
export const usedOn = (sha, maps) => maps.filter((m) => m && Array.isArray(m.objs) && m.objs.some((o) => o && o.asset === sha)).length;

/** Opslaggebruik: null (onbekend of laag) of "high" (≥ 80 %). est = { usage, quota } (storage.estimate) */
export function quotaLevel(est) {
  const u = est && est.usage, qt = est && est.quota;
  if (!(Number.isFinite(u) && Number.isFinite(qt) && qt > 0)) return null;
  const r = u / qt;
  return r >= 0.8 ? "high" : null;
}
