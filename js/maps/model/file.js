// Inn Sight (G4, WP60): projectbestand v1, puur (geen DOM, Node-testbaar). Eén kaart volledig en zelfstandig in één
// JSON-bestand, de afbeeldingen als base64 erin (D4 optie A, besloten in WP60 op het advies; extensie .json = D5).
// Vorm: { format: "kevs-inn-maps", version: 1, exported, app: "Inn Sight x.y.z", map: {…}, assets: { <sha256>: {
// mime, w, h, data } } }. `map` is het kaartdocument zonder id (geen verwijzing naar browseropslag; import geeft
// altijd een nieuwe id). `assets` bevat precies de afbeeldingen waar de kaart naar verwijst: bg.asset en (WP64) de eigen
// assets op objecten, die optioneel hun naam uit Mijn assets meekrijgen (`name`, gebruikersinhoud).
// Alles uit een bestand is onbetrouwbaar: grootte, JSON, format, versie (hoger = weigeren, lager = migreren via
// MIGRATE), cleanMap voor de kaart en per asset: mime-allowlist, geldige base64, magic bytes = mime, afmetingen uit de
// kop = w/h en binnen de grenzen, sha256 van de bytes = sleutel. Decoderen (laatste controle) doet de UI.
import { cleanMap, SCHEMA } from "./map.js";
import { sniff, dims, IMG } from "./image.js";
import { usedAssets, isCustom, cleanItemName, MINE } from "./mine.js";
import { LIMITS } from "./limits.js";
import { OBJ, cleanObj } from "./objects.js";

export const FORMAT = "kevs-inn-maps";
/** Hoogste bestandsversie die deze versie schrijft en leest */
export const FILE_VERSION = 1;
/** Grens voor een bestand bij import (bytes): een echte export (één 4096-px-afbeelding) blijft ruim onder 10 MB */
export const FILE_MAX = LIMITS.fileBytes; // één asset ≤ 25 MB (IMG.maxBytes) als base64 + marge; meer = geheugen op een oude iPad
const MIMES = ["image/png", "image/jpeg", "image/webp"];

/** Migraties per bestandsversie: MIGRATE[v](doc) maakt van een v-bestand een (v+1)-bestand. Nog leeg (v1 = eerste). */
export const MIGRATE = {};

/** Bestandsnaam: inn-sight-<kaartnaam>-YYYY-MM-DD-HH-MM.json (lokale tijd, zoals Initiative) */
export function fileName(name, d) {
  const p = (n) => String(n).padStart(2, "0");
  const slug = [...String(name ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "")].slice(0, 40).join("").replace(/-+$/, "") || "map";
  return `inn-sight-${slug}-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}-${p(d.getMinutes())}.json`;
}

/** Bytes → base64 in stukken (geen String.fromCharCode met miljoenen argumenten). Stukgrootte deelbaar door 3. */
export function* b64Chunks(bytes, size = 3 * 16384) {
  for (let i = 0; i < bytes.length; i += size) {
    const part = bytes.subarray(i, i + size);
    let s = "";
    for (let k = 0; k < part.length; k += 8192) s += String.fromCharCode.apply(null, part.subarray(k, k + 8192));
    yield btoa(s);
  }
}

/** base64 → Uint8Array, of null als het geen geldige base64 is (strikt: alleen het standaardalfabet, juiste opvulling) */
export function fromB64(s) {
  if (typeof s !== "string" || s.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(s)) return null;
  let bin;
  try { bin = atob(s); } catch { return null; }
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const plain = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const toBytes = (d) => (d instanceof Uint8Array ? d : d instanceof ArrayBuffer ? new Uint8Array(d) : null);

/**
 * Bestand opbouwen als lijst tekststukken (UI: new Blob(parts)), zodat een grote afbeelding nooit één enorme string
 * wordt. map = kaartdocument (cleanMap), assets = sha → record { data: ArrayBuffer|Uint8Array, mime, w, h }. Het
 * record-veld src (sha256 van het origineel, sleutel van de store-index) gaat bewust niet mee: browseropslag.
 * Geeft { parts }, { big: true } (WP64: het bestand zou groter worden dan FILE_MAX) of { missing: [sha] } als een afbeelding waar de kaart naar verwijst niet beschikbaar is (dan niet
 * exporteren: een bestand zonder afbeelding is niet zelfstandig).
 */
export function buildParts(map, assets, { app = "", now = new Date(), names = null } = {}) {
  const c = cleanMap(map);
  if (!c) return { missing: [] };
  const { id, ...doc } = c; // id = sleutel in de browseropslag: niet in het bestand
  const need = usedAssets(doc); // WP64: achtergrond + eigen assets op objecten, elk één keer; ongebruikte nooit
  const missing = need.filter((sha) => { const r = assets && assets.get(sha); return !(r && toBytes(r.data) && MIMES.includes(r.mime)); });
  if (missing.length) return { missing };
  // WP64: meerdere afbeeldingen in één bestand: nooit een export maken die de import (FILE_MAX) zelf weer weigert
  const size = need.reduce((n, sha) => n + Math.ceil(toBytes(assets.get(sha).data).length / 3) * 4 + 200, 0) + JSON.stringify(doc).length + 400;
  if (size > FILE_MAX) return { big: true };
  const head = { format: FORMAT, version: FILE_VERSION, exported: now.toISOString(), app, map: doc };
  const parts = [JSON.stringify(head).slice(0, -1) + ',"assets":{'];
  need.forEach((sha, i) => {
    const r = assets.get(sha), meta = { mime: r.mime, w: r.w, h: r.h };
    const nm = isCustom(sha) && doc.objs && doc.objs.some((o) => o.asset === sha) && names && cleanItemName(names.get(sha));
    if (nm) meta.name = nm; // WP64: naam in Mijn assets (alleen voor een object-asset)
    parts.push(`${i ? "," : ""}${JSON.stringify(sha)}:${JSON.stringify(meta).slice(0, -1)},"data":"`);
    for (const s of b64Chunks(toBytes(r.data))) parts.push(s);
    parts.push('"}');
  });
  parts.push("}}");
  return { parts };
}

/** Bestandsversie omhoog tot FILE_VERSION via de migraties (migrate in te spuiten voor tests) */
export function upgrade(doc, migrate = MIGRATE) {
  let d = doc;
  for (let v = d.version; v < FILE_VERSION; v++) {
    if (typeof migrate[v] !== "function") return null;
    d = migrate[v](d);
    if (!plain(d)) return null;
    d.version = v + 1;
  }
  return d;
}

/**
 * Bestand lezen. size = bestandsgrootte in bytes, text = inhoud, hash(bytes) = async sha256-hex (crypto.subtle in de
 * browser, node:crypto in de tests). Geeft { ok: true, map, assets: Map(sha → { data: ArrayBuffer, mime, w, h, ow, oh })
 * } met map zonder id (de aanroeper kiest id en naam), of { ok: false, code } met code ∈ "empty" | "big" |
 * "notjson" | "format" | "newer" | "badmap" | "objs" (WP66: meer dan OBJ.max objecten) | "missing" (afbeelding niet in het bestand) | "b64" (kapotte base64) |
 * "image" (geen toegestane of een kapotte afbeelding, of afmetingen kloppen niet) | "sha" (inhoud klopt niet met de
 * sleutel). Tekst via de catalogus (maps.imp.err.<code>). Een src uit het bestand wordt genegeerd: anders kan een
 * gemaakt bestand zich voordoen als een later geüpload origineel (findAsset).
 */
export async function readFile(size, text, { hash, migrate = MIGRATE } = {}) {
  if (!(size > 0) || typeof text !== "string" || !text.trim()) return { ok: false, code: "empty" };
  if (size > FILE_MAX || text.length > FILE_MAX) return { ok: false, code: "big" };
  let raw;
  try { raw = JSON.parse(text); } catch { return { ok: false, code: "notjson" }; }
  if (!plain(raw) || raw.format !== FORMAT || !Number.isInteger(raw.version) || raw.version < 1) return { ok: false, code: "format" };
  if (raw.version > FILE_VERSION) return { ok: false, code: "newer" };
  const doc = upgrade(raw, migrate);
  if (!doc) return { ok: false, code: "format" };
  const m = doc.map;
  if (!plain(m)) return { ok: false, code: "badmap" };
  if (Number.isInteger(m.schema) && m.schema > SCHEMA) return { ok: false, code: "newer" };
  // WP66: meer objecten dan de grens = weigeren met een melding (cleanObjs kapt stil af; een import mag niets stil weglaten)
  if (Array.isArray(m.objs) && m.objs.length > OBJ.max && m.objs.filter((o) => cleanObj(o)).length > OBJ.max) return { ok: false, code: "objs" };
  const map = cleanMap({ ...m, id: "import0" }); // tijdelijke id: alleen om door cleanMap te komen
  if (!map) return { ok: false, code: "badmap" };
  delete map.id;
  // een kaart die naar een afbeelding verwijst, maar met een onbruikbare bg, verliest die niet stil
  if (m.bg != null && !map.bg) return { ok: false, code: "badmap" };
  // WP63: idem terrein: onbruikbaar terwijl er cellen geverfd lijken = weigeren (een echt leeg terrein mag)
  if (m.terr != null && !map.terr && !(plain(m.terr) && typeof m.terr.cells === "string" && !/[1-9a-z]/.test(m.terr.cells))) return { ok: false, code: "badmap" };
  // WP73: idem fog: een fog-veld dat geen fog is, weigeren (cleanFog maakt kapotte cellen veilig "alles verborgen")
  if (m.fog != null && !map.fog) return { ok: false, code: "badmap" };
  const assets = new Map(), names = new Map(), all = doc.assets;
  for (const sha of usedAssets(map)) { // WP64: achtergrond én eigen assets op objecten, elk met dezelfde controles
    const a = plain(all) && own(all, sha) ? all[sha] : null;
    if (!plain(a)) return { ok: false, code: "missing" };
    if (!MIMES.includes(a.mime)) return { ok: false, code: "image" };
    const bytes = fromB64(a.data);
    if (!bytes || !bytes.length) return { ok: false, code: "b64" };
    if (bytes.length > IMG.maxBytes || sniff(bytes) !== a.mime) return { ok: false, code: "image" };
    const d = dims(bytes, a.mime);
    if (!d || d.w !== a.w || d.h !== a.h || Math.max(d.w, d.h) > IMG.maxSide || d.w * d.h > IMG.maxInPixels) return { ok: false, code: "image" };
    if (typeof hash !== "function" || (await hash(bytes)) !== sha) return { ok: false, code: "sha" };
    const isBg = map.bg && map.bg.asset === sha; // dezelfde afbeelding als achtergrond én object: het origineel van de achtergrond
    if (!isBg && Math.max(d.w, d.h) > MINE.maxSide) return { ok: false, code: "image" }; // WP64: eigen asset ≤ 1024 px (geheugen)
    assets.set(sha, { data: bytes.buffer, mime: a.mime, w: d.w, h: d.h, ow: isBg ? map.bg.w : d.w, oh: isBg ? map.bg.h : d.h }); // fromB64: eigen buffer vanaf 0
    const nm = isCustom(sha) && map.objs && map.objs.some((o) => o.asset === sha) ? cleanItemName(a.name) : "";
    if (nm) names.set(sha, nm);
  }
  return { ok: true, map, assets, names };
}
