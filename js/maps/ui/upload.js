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

/** Opgeslagen asset (record uit de store) → tekenbare afbeelding, of null */
export async function assetImage(rec) {
  try { return await decode(new Blob([rec.data], { type: rec.mime })); } catch { return null; }
}

/**
 * Bestand verwerken. find(src) zoekt een bestaande asset bij hetzelfde origineel (store.findAsset of het geheugen).
 */
export async function prepareImage(file, { find }) {
  if (!file) return { ok: false, code: "empty" };
  if (file.size > IMG.maxBytes) return { ok: false, code: "big" }; // te groot: niet eens inlezen
  let buf;
  try { buf = await readBuf(file); } catch { return { ok: false, code: "broken" }; }
  const bytes = new Uint8Array(buf);
  const chk = checkImage(bytes.length, bytes);
  if (!chk.ok) return chk;
  if (!(globalThis.crypto && crypto.subtle)) return { ok: false, code: "broken" };
  const src = await sha256(buf);
  const known = await find(src);
  if (known) return { ok: true, sha: known.sha, rec: known.rec, again: true };
  let img;
  try { img = await decode(new Blob([buf], { type: chk.mime })); } catch { return { ok: false, code: "broken" }; }
  const o = sizeOf(img); // na EXIF-rotatie: wat de gebruiker ziet
  if (!(o.w > 0 && o.h > 0)) return { ok: false, code: "broken" };
  const s = fitSize(o.w, o.h);
  const cv = document.createElement("canvas");
  cv.width = s.w; cv.height = s.h;
  const g = cv.getContext("2d");
  if (!g) return { ok: false, code: "broken" };
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  g.drawImage(img, 0, 0, s.w, s.h);
  if (img.close) img.close();
  let blob = await toBlob(cv, "image/webp", 0.9);
  if (!blob || blob.type !== "image/webp") { // Safari < 16: geen WebP-encoder. JPEG (PNG van 4096² = tientallen MB); transparant wordt wit
    g.globalCompositeOperation = "destination-over"; g.fillStyle = "#ffffff"; g.fillRect(0, 0, s.w, s.h);
    blob = await toBlob(cv, "image/jpeg", 0.9);
  }
  cv.width = cv.height = 1; // geheugen meteen vrij (iOS telt canvasgeheugen streng)
  if (!blob) return { ok: false, code: "broken" };
  const data = await readBuf(blob);
  const sha = await sha256(data);
  return { ok: true, sha, rec: { data, mime: blob.type, w: s.w, h: s.h, ow: o.w, oh: o.h, src }, again: false };
}
