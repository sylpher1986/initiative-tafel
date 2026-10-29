// Inn the Grid (G4, WP59): een gekozen bestand omzetten in een veilige, kleine asset. Stappen: grootte en soort
// controleren op de bytes (checkImage, puur), dezelfde upload hergebruiken (sha256 van het origineel, index "src"),
// decoderen, verkleinen tot langste zijde ≤ 4096 px en hercoderen naar WebP (terugval JPEG op wit).
// Hercoderen verwijdert EXIF/locatie; de opgeslagen bytes krijgen hun eigen sha256 = sleutel in de assetstore.
// Geeft { ok: true, sha, rec, again } of { ok: false, code } (tekst via maps.bg.err.<code>).
import { checkImage, fitSize, toHex, IMG } from "../model/image.js";

const sha256 = async (buf) => toHex(await crypto.subtle.digest("SHA-256", buf));
const readBuf = (file) => (file.arrayBuffer ? file.arrayBuffer() : new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsArrayBuffer(file); }));

/** Decoderen: createImageBitmap waar het kan (sneller, buiten de hoofdthread), anders een <img> */
async function decode(blob) {
  if (typeof createImageBitmap === "function") {
    try { return await createImageBitmap(blob); } catch { /* oude Safari: valt terug op <img> */ }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    return img;
  } finally { URL.revokeObjectURL(url); }
}
const sizeOf = (img) => ({ w: img.width || img.naturalWidth, h: img.height || img.naturalHeight });

const toBlob = (cv, type, q) => new Promise((res) => { try { cv.toBlob(res, type, q); } catch { res(null); } });

/** Canvas → WebP 0,9; Safari < 16 (geen WebP-encoder): JPEG (PNG van 4096² = tientallen MB), transparant wordt wit.
 *  png = true (WP64: eigen assets ≤ 1024 px en miniaturen): eerst PNG, zodat een token transparant blijft. */
async function encode(cv, g, s, png = false) {
  let blob = await toBlob(cv, "image/webp", 0.9);
  if ((!blob || blob.type !== "image/webp") && png) blob = await toBlob(cv, "image/png");
  if (!blob || (blob.type !== "image/webp" && blob.type !== "image/png")) {
    g.globalCompositeOperation = "destination-over"; g.fillStyle = "#ffffff"; g.fillRect(0, 0, s.w, s.h);
    blob = await toBlob(cv, "image/jpeg", 0.9);
  }
  return blob;
}

/** Opgeslagen asset (record uit de store) → tekenbare afbeelding, of null */
export async function assetImage(rec) {
  try { return await decode(new Blob([rec.data], { type: rec.mime })); } catch { return null; }
}

/**
 * Bestand verwerken. find(src) zoekt een bestaande asset bij hetzelfde origineel (store.findAsset of het geheugen).
 * WP64: max = langste opgeslagen zijde (Mijn assets: MINE.maxSide), kind = "mine" maakt een eigen src (sha256 van
 * "mine:<max>:" + sha van het origineel), zodat een eigen asset nooit de grote achtergrond van hetzelfde bestand hergebruikt
 * of omgekeerd; thumb = langste zijde van een miniatuur (alleen bij een nieuwe asset: { thumb: { data, mime } }).
 */
export async function prepareImage(file, { find, max = IMG.maxSide, kind = "bg", thumb = 0 }) {
  if (!file) return { ok: false, code: "empty" };
  if (file.size > IMG.maxBytes) return { ok: false, code: "big" }; // te groot: niet eens inlezen
  let buf;
  try { buf = await readBuf(file); } catch { return { ok: false, code: "broken" }; }
  const bytes = new Uint8Array(buf);
  const chk = checkImage(bytes.length, bytes);
  if (!chk.ok) return chk;
  if (!(globalThis.crypto && crypto.subtle)) return { ok: false, code: "broken" };
  let src = await sha256(buf);
  if (kind === "mine") src = await sha256(new TextEncoder().encode(`mine:${max}:${src}`));
  const known = await find(src);
  if (known) return { ok: true, sha: known.sha, rec: known.rec, again: true };
  let img;
  try { img = await decode(new Blob([buf], { type: chk.mime })); } catch { return { ok: false, code: "broken" }; }
  const o = sizeOf(img); // na EXIF-rotatie: wat de gebruiker ziet
  if (!(o.w > 0 && o.h > 0)) return { ok: false, code: "broken" };
  const s = fitSize(o.w, o.h, max);
  const cv = document.createElement("canvas");
  cv.width = s.w; cv.height = s.h;
  const g = cv.getContext("2d");
  if (!g) return { ok: false, code: "broken" };
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  g.drawImage(img, 0, 0, s.w, s.h);
  let tb = null;
  if (thumb > 0) { // WP64: miniatuur voor de tegel, uit hetzelfde gedecodeerde beeld
    const ts = fitSize(o.w, o.h, thumb), tc = document.createElement("canvas");
    tc.width = ts.w; tc.height = ts.h;
    const tg = tc.getContext("2d");
    if (tg) { tg.imageSmoothingEnabled = true; tg.imageSmoothingQuality = "high"; tg.drawImage(img, 0, 0, ts.w, ts.h); tb = await encode(tc, tg, ts, true); }
    tc.width = tc.height = 1;
  }
  if (img.close) img.close();
  const blob = await encode(cv, g, s, kind === "mine");
  cv.width = cv.height = 1; // geheugen meteen vrij (iOS telt canvasgeheugen streng)
  if (!blob) return { ok: false, code: "broken" };
  const data = await readBuf(blob);
  const sha = await sha256(data);
  const out = { ok: true, sha, rec: { data, mime: blob.type, w: s.w, h: s.h, ow: o.w, oh: o.h, src }, again: false };
  if (tb) out.thumb = { data: await readBuf(tb), mime: tb.type };
  return out;
}

/** WP64: miniatuur ({ data, mime } of null) van een opgeslagen asset: voor een item dat opnieuw in Mijn assets komt
 *  (dezelfde upload als eerder, of uit een geïmporteerde kaart) */
export async function makeThumb(rec, size) {
  const img = await assetImage(rec);
  if (!img) return null;
  try {
    const o = sizeOf(img), ts = fitSize(o.w, o.h, size), c = document.createElement("canvas");
    c.width = ts.w; c.height = ts.h;
    const g = c.getContext("2d");
    if (!g) return null;
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high"; g.drawImage(img, 0, 0, ts.w, ts.h);
    const b = await encode(c, g, ts, true);
    c.width = c.height = 1;
    return b ? { data: await readBuf(b), mime: b.type } : null;
  } catch { return null; } finally { if (img.close) img.close(); }
}
