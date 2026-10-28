// Inn the Grid (WP60): maakt de importbestanden in tests/fixtures/maps/ (geldig, kapot, kwaadaardig) voor tests/maps-file.test.js
// en de browsercheck (wp60). Gebruik: node tools/maps-fixtures.mjs tests/fixtures/maps
import { deflateSync, crc32 } from "node:zlib";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
const dir = process.argv[2];
// echte PNG 140x70 (2x1 cellen à 70 px), schaakbord
const W = 140, H = 70;
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td) >>> 0); return Buffer.concat([len, td, c]); };
const raw = Buffer.alloc((W * 3 + 1) * H);
for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; for (let x = 0; x < W; x++) { const on = ((x / 10 | 0) + (y / 10 | 0)) % 2; const o = y * (W * 3 + 1) + 1 + x * 3; raw[o] = on ? 200 : 60; raw[o + 1] = on ? 150 : 40; raw[o + 2] = on ? 60 : 30; } }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
const sha = createHash("sha256").update(png).digest("hex");
const b64 = png.toString("base64");
const map = { schema: 2, name: "Test fixture", createdAt: 1761600000000, updatedAt: 1761600000000, grid: { type: "square", orient: "pointy", cols: 2, rows: 1, show: true, color: "auto", alpha: 50 }, bg: { asset: sha, w: W, h: H, ppc: 70, x: 0, y: 0 } };
const base = () => ({ format: "kevs-inn-maps", version: 1, exported: "2026-10-28T12:00:00.000Z", app: "Inn the Grid 0.5.0", map: structuredClone(map), assets: { [sha]: { mime: "image/png", w: W, h: H, data: b64 } } });
const put = (n, v) => writeFileSync(`${dir}/${n}`, typeof v === "string" ? v : JSON.stringify(v));
put("valid.json", base());
put("valid-plain.json", { format: "kevs-inn-maps", version: 1, exported: "2026-10-28T12:00:00.000Z", app: "Inn the Grid 0.5.0", map: { schema: 1, name: "Zonder achtergrond", createdAt: 1, updatedAt: 1, grid: { type: "hex", orient: "flat", cols: 12, rows: 9, show: true, color: "gold", alpha: 75 } }, assets: {} });
put("err-notjson.json", "dit is geen json {");
put("err-empty.json", "   ");
let d;
d = base(); d.format = "initiative-tafel"; put("err-format.json", d);
d = base(); d.version = 2; put("err-newer.json", d);
d = base(); d.map.schema = 9; put("err-newer-schema.json", d);
d = base(); d.assets[sha].data = b64.slice(0, -3) + "!!="; put("err-b64.json", d);
d = base(); const p2 = Buffer.from(png); p2[p2.length - 20] ^= 0xff; d.assets[sha].data = p2.toString("base64"); put("err-sha.json", d);
d = base(); d.assets = {}; put("err-missing.json", d);
d = base(); d.assets[sha].data = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>").toString("base64"); d.assets[sha].mime = "image/png"; put("err-image-svg.json", d);
d = base(); d.assets[sha].w = 999; put("err-image-dims.json", d);
d = base(); d.assets[sha].mime = "image/svg+xml"; put("err-image-mime.json", d);
d = base(); d.map = [1, 2]; put("err-badmap.json", d);
d = base(); d.map.bg.asset = "../../etc"; put("err-badmap-bg.json", d);
// kwaadaardig maar bruikbaar: wordt opgeschoond
d = base(); delete d.map.bg; d.assets = {}; d.map.schema = 1; d.map.name = '<img src=x onerror="alert(1)">‮' + "x".repeat(500); d.map.grid.cols = 1e9; d.map.grid.extra = new Array(10000).fill(7); d.map.layers = new Array(10000).fill({ a: 1 });
put("evil.json", JSON.stringify(d).replace('"map":{', '"map":{"__proto__":{"polluted":1},"constructor":{"prototype":{"polluted":1}},'));
console.log(sha, png.length);
