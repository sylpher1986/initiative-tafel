// QR-code (ISO 18004), eigen kleine encoder: alleen byte-modus, foutcorrectie M, versie 1–10 (tot 213 bytes).
// Genoeg voor de spelerslink (`…/speler?k=K7M3QX`, ± 63 tekens → versie 5, 37 × 37 modules). Puur, geen DOM.
// Opzet volgt de bekende referentie-implementatie (Nayuki, MIT): functiepatronen, data + Reed-Solomon, maskers met strafpunten.

// per versie 1–10, foutcorrectie M: ECC-codewoorden per blok en aantal blokken
const ECC = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
const MAX_VER = 10;

/** Aantal modules voor data + ECC (alles behalve functiepatronen) */
function rawModules(v) {
  let r = (16 * v + 128) * v + 64;
  if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; }
  return r;
}
const dataCodewords = (v) => Math.floor(rawModules(v) / 8) - ECC[v] * BLOCKS[v];

function gfMul(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; }
  return z;
}
function rsDivisor(deg) {
  const r = new Array(deg).fill(0); r[deg - 1] = 1;
  let root = 1;
  for (let i = 0; i < deg; i++) {
    for (let j = 0; j < deg; j++) { r[j] = gfMul(r[j], root); if (j + 1 < deg) r[j] ^= r[j + 1]; }
    root = gfMul(root, 2);
  }
  return r;
}
function rsRemainder(data, div) {
  const r = new Array(div.length).fill(0);
  for (const b of data) {
    const f = b ^ r.shift(); r.push(0);
    div.forEach((c, i) => { r[i] ^= gfMul(c, f); });
  }
  return r;
}

const utf8 = (s) => Array.from(new TextEncoder().encode(String(s)));

/** Codewoorden (data + ECC, geïnterleaved) voor deze bytes in versie v */
function codewords(bytes, v) {
  const cap = dataCodewords(v) * 8, bits = [];
  const put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(4, 4); put(bytes.length, v < 10 ? 8 : 16);
  for (const b of bytes) put(b, 8);
  put(0, Math.min(4, cap - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  for (let p = 0xec; data.length < cap / 8; p ^= 0xec ^ 0x11) data.push(p);

  const nb = BLOCKS[v], el = ECC[v], raw = Math.floor(rawModules(v) / 8);
  const short = nb - (raw % nb), shortLen = Math.floor(raw / nb), div = rsDivisor(el), blocks = [];
  for (let i = 0, k = 0; i < nb; i++) {
    const d = data.slice(k, k + shortLen - el + (i < short ? 0 : 1)); k += d.length;
    const e = rsRemainder(d, div);
    if (i < short) d.push(0);
    blocks.push(d.concat(e));
  }
  const out = [];
  for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - el || j >= short) out.push(b[i]); });
  return out;
}

function alignPos(v) {
  if (v === 1) return [];
  const n = Math.floor(v / 7) + 2, size = v * 4 + 17;
  const step = Math.floor((v * 8 + n * 3 + 5) / (n * 4 - 4)) * 2, r = [6];
  for (let p = size - 7; r.length < n; p -= step) r.splice(1, 0, p);
  return r;
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

/** Strafpunten (ISO 18004 §7.8.3): lange reeksen, 2×2-blokken, finder-achtige patronen, verhouding donker/licht */
function penalty(m) {
  const n = m.length; let p = 0, dark = 0;
  const line = (get) => {
    for (let a = 0; a < n; a++) {
      let run = 1;
      for (let b = 1; b <= n; b++) {
        if (b < n && get(a, b) === get(a, b - 1)) run++;
        else { if (run >= 5) p += run - 2; run = 1; }
      }
      for (let b = 0; b + 7 <= n; b++) { // 1:1:3:1:1 met 4 licht ervoor of erna (buiten de rand telt als licht)
        if (!(get(a, b) && !get(a, b + 1) && get(a, b + 2) && get(a, b + 3) && get(a, b + 4) && !get(a, b + 5) && get(a, b + 6))) continue;
        const light = (from, to) => { for (let i = from; i < to; i++) if (i >= 0 && i < n && get(a, i)) return false; return true; };
        if (light(b - 4, b)) p += 40;
        if (light(b + 7, b + 11)) p += 40;
      }
    }
  };
  line((y, x) => m[y][x]); line((x, y) => m[y][x]);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (m[y][x]) dark++;
    if (y + 1 < n && x + 1 < n) { const c = m[y][x]; if (m[y][x + 1] === c && m[y + 1][x] === c && m[y + 1][x + 1] === c) p += 3; }
  }
  return p + (Math.ceil(Math.abs(dark * 20 - n * n * 10) / (n * n)) - 1) * 10;
}

/**
 * Tekst → matrix (array van rijen met booleans, true = donker), zonder stille zone.
 * Gooit Error("lang") als het niet in versie 10 past. forceMask (0–7) alleen voor tests.
 */
export function qrMatrix(text, forceMask) {
  const bytes = utf8(text);
  let v = 1;
  while (v <= MAX_VER && bytes.length + (v < 10 ? 2 : 3) > dataCodewords(v)) v++;
  if (v > MAX_VER) throw new Error("lang");
  const size = v * 4 + 17;
  const m = Array.from({ length: size }, () => new Array(size).fill(false));
  const fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, d) => { m[y][x] = d; fn[y][x] = true; };

  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy));
      if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
    }
  }
  const al = alignPos(v), last = al.length - 1;
  al.forEach((ax, i) => al.forEach((ay, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }));
  const format = (mask) => { // M = 0b00
    const d = mask; let r = d;
    for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const b = ((d << 10) | r) ^ 0x5412, bit = (i) => ((b >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true);
  };
  format(0);
  if (v >= 7) {
    let r = v;
    for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
    const b = (v << 12) | r;
    for (let i = 0; i < 18; i++) { const bit = ((b >>> i) & 1) === 1, a = size - 11 + (i % 3), c = Math.floor(i / 3); set(a, c, bit); set(c, a, bit); }
  }

  const cw = codewords(bytes, v);
  for (let right = size - 1, i = 0; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j, y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
      if (!fn[y][x] && i < cw.length * 8) { m[y][x] = ((cw[i >>> 3] >>> (7 - (i & 7))) & 1) === 1; i++; }
    }
  }

  const apply = (k) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[k](x, y)) m[y][x] = !m[y][x]; };
  let best = 0, bestP = Infinity;
  for (let k = 0; k < 8; k++) {
    apply(k); format(k);
    const p = penalty(m);
    if (p < bestP) { bestP = p; best = k; }
    apply(k); // XOR terug
  }
  if (forceMask >= 0 && forceMask < 8) best = forceMask;
  apply(best); format(best);
  return m;
}

/**
 * SVG (string) met stille zone van 4 modules; altijd zwart op wit (ook in donker: scanners lezen geen negatief).
 * label = toegankelijke naam. Grootte via CSS.
 */
export function qrSvg(text, label = "QR-code") {
  const m = qrMatrix(text), n = m.length + 8;
  let d = "";
  m.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (!row[x]) continue;
      let w = 1; while (x + w < row.length && row[x + w]) w++;
      d += `M${x + 4} ${y + 4}h${w}v1h-${w}z`; x += w - 1;
    }
  });
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  return `<svg class="qr" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" role="img" aria-label="${esc(label)}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
