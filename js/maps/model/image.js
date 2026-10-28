// Inn the Grid (G4, WP59): controle van een geüploade afbeelding, puur (geen DOM, Node-testbaar). Alleen PNG, JPEG en
// WebP, herkend aan de eerste bytes (magic bytes), nooit aan extensie of mime-type van het bestand. Geen SVG (script-
// risico). Afmetingen komen uit de kop van het bestand, vóór het decoderen: een klein bestand met een gigantische
// afbeelding (decompressiebom) wordt zo geweigerd zonder het geheugen van een oude iPad op te blazen.
// Besluit D12 (WP59, op het advies): invoer ≤ 25 MB, opgeslagen langste zijde ≤ 4096 px (iOS-canvasgrens),
// hercodering naar WebP (terugval JPEG) verwijdert ook EXIF/locatie (docs/g4-inn-the-grid.md §2.6).

/** Grenzen: invoer in bytes, opgeslagen langste zijde, en wat we bereid zijn te decoderen */
// maxInPixels: het origineel wordt volledig gedecodeerd (± 4 bytes per pixel): 36 MP ≈ 144 MB, plus bestand en canvas
export const IMG = { maxBytes: 25 * 1024 * 1024, maxSide: 4096, maxInSide: 16384, maxInPixels: 36e6 };

const at = (b, i) => (i < b.length ? b[i] : -1);
const ascii = (b, i, n) => { let s = ""; for (let k = 0; k < n; k++) { const c = at(b, i + k); if (c < 0) return ""; s += String.fromCharCode(c); } return s; };
// getallen uit de kop; buiten het bestand (afgekapt) = NaN, zodat ok() ze weigert
const has = (b, i, n) => i >= 0 && i + n <= b.length;
const u16be = (b, i) => (has(b, i, 2) ? (b[i] << 8) | b[i + 1] : NaN);
const u32be = (b, i) => (has(b, i, 4) ? ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3] : NaN);
const u16le = (b, i) => (has(b, i, 2) ? b[i] | (b[i + 1] << 8) : NaN);
const u24le = (b, i) => (has(b, i, 3) ? b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) : NaN);

/** Soort uit de eerste bytes: "image/png" | "image/jpeg" | "image/webp" (toegestaan), of een code voor een bekende
 *  niet-toegestane soort ("gif", "svg", "heic", "bmp", "tiff", "avif") , of "unknown". b = Uint8Array (eerste ± 64 bytes). */
export function sniff(b) {
  if (at(b, 0) === 0x89 && ascii(b, 1, 3) === "PNG" && at(b, 4) === 0x0d && at(b, 5) === 0x0a && at(b, 6) === 0x1a && at(b, 7) === 0x0a) return "image/png";
  if (at(b, 0) === 0xff && at(b, 1) === 0xd8 && at(b, 2) === 0xff) return "image/jpeg";
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return "image/webp";
  if (ascii(b, 0, 4) === "GIF8") return "gif";
  if (ascii(b, 4, 4) === "ftyp") {
    const brand = ascii(b, 8, 4);
    if (/^(avif|avis)$/.test(brand)) return "avif";
    if (/^(heic|heix|heim|heis|hevc|hevx|mif1|msf1)$/.test(brand)) return "heic";
  }
  if (ascii(b, 0, 2) === "BM") return "bmp";
  if (ascii(b, 0, 4) === "II*\0" || ascii(b, 0, 4) === "MM\0*") return "tiff";
  // SVG (of andere tekst/XML): begint, na een eventuele BOM en witruimte, met "<"
  let i = at(b, 0) === 0xef && at(b, 1) === 0xbb && at(b, 2) === 0xbf ? 3 : 0;
  while ([0x20, 0x09, 0x0a, 0x0d].includes(at(b, i))) i++;
  if (at(b, i) === 0x3c) return /<svg|<\?xml|<!doctype svg/i.test(ascii(b, i, Math.min(256, b.length - i))) ? "svg" : "unknown";
  return "unknown";
}

/** Afmetingen uit de kop: { w, h } of null (kapot, afgekapt of onbekende variant). Voor JPEG het hele bestand meegeven
 *  (de SOF-marker kan na grote EXIF/ICC-blokken staan), voor PNG/WebP volstaan de eerste 64 bytes. */
export function dims(b, mime) {
  if (mime === "image/png") {
    if (ascii(b, 12, 4) !== "IHDR") return null;
    return ok(u32be(b, 16), u32be(b, 20));
  }
  if (mime === "image/webp") {
    const kind = ascii(b, 12, 4);
    if (kind === "VP8X") return ok(u24le(b, 24) + 1, u24le(b, 27) + 1);
    if (kind === "VP8L") {
      if (at(b, 20) !== 0x2f || !has(b, 21, 4)) return null;
      const v = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
      return ok((v & 0x3fff) + 1, ((v >>> 14) & 0x3fff) + 1);
    }
    if (kind === "VP8 ") {
      if (at(b, 23) !== 0x9d || at(b, 24) !== 0x01 || at(b, 25) !== 0x2a) return null;
      return ok(u16le(b, 26) & 0x3fff, u16le(b, 28) & 0x3fff);
    }
    return null;
  }
  if (mime === "image/jpeg") {
    let i = 2;
    while (i + 9 < b.length) {
      if (at(b, i) !== 0xff) return null;
      const m = at(b, i + 1);
      if (m === 0xff) { i++; continue; } // opvulling
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; } // markers zonder lengte
      if (m === 0xd9 || m === 0xda) return null; // einde of scan vóór een SOF: geen afmetingen
      const len = u16be(b, i + 2);
      if (len < 2) return null;
      // SOF0–SOF15 behalve DHT (C4), JPG (C8) en DAC (CC)
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return ok(u16be(b, i + 7), u16be(b, i + 5));
      i += 2 + len;
    }
    return null;
  }
  return null;
}
const ok = (w, h) => (Number.isInteger(w) && Number.isInteger(h) && w > 0 && h > 0 ? { w, h } : null);

/**
 * Bestand controleren vóór het decoderen. size = bestandsgrootte in bytes, b = de bytes (Uint8Array; voor JPEG het hele
 * bestand). Geeft { ok: true, mime, w, h } of { ok: false, code } met code ∈ "empty" | "big" | "gif" | "svg" | "heic" |
 * "other" (andere afbeeldingssoort) | "notimage" | "broken" | "huge" (te veel pixels om te decoderen). De UI maakt er
 * tekst van via de catalogus (maps.bg.err.<code>).
 */
export function checkImage(size, b) {
  if (!(size > 0) || !b || !b.length) return { ok: false, code: "empty" };
  if (size > IMG.maxBytes) return { ok: false, code: "big" };
  const s = sniff(b);
  if (s === "gif" || s === "svg" || s === "heic") return { ok: false, code: s };
  if (s === "bmp" || s === "tiff" || s === "avif") return { ok: false, code: "other" };
  if (s === "unknown") return { ok: false, code: "notimage" };
  const d = dims(b, s);
  if (!d) return { ok: false, code: "broken" };
  if (d.w > IMG.maxInSide || d.h > IMG.maxInSide || d.w * d.h > IMG.maxInPixels) return { ok: false, code: "huge" };
  return { ok: true, mime: s, w: d.w, h: d.h };
}

/** Opgeslagen afmetingen: langste zijde ≤ IMG.maxSide, verhouding behouden, minstens 1 px */
export function fitSize(w, h, max = IMG.maxSide) {
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

/** sha256 als hex (64 tekens) of null (geen hex van de juiste lengte): sleutel van de assetstore */
export const cleanSha = (v) => (typeof v === "string" && /^[0-9a-f]{64}$/.test(v) ? v : null);
/** ArrayBuffer (digest) → hex */
export const toHex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
