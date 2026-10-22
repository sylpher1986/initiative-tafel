import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { qrMatrix, qrSvg } from "../js/qr.js";

const URL1 = "https://initiative-tafel.ft4mgzj72j.workers.dev/speler?k=K7M3QX";
const bits = (m) => m.map((r) => r.map((b) => (b ? 1 : 0)).join("")).join("\n");

// Bij de bouw (1.39.0) gecontroleerd met een onafhankelijke decoder (OpenCV QRCodeDetector), ook elk masker apart en
// ± 50 andere teksten van 1–210 bytes. Deze vingerafdruk bewaakt dat de encoder niet ongemerkt verandert.
test("spelerslink: versie 5 (37 modules) en ongewijzigde matrix", () => {
  const m = qrMatrix(URL1);
  assert.equal(m.length, 37);
  assert.equal(createHash("sha256").update(bits(m)).digest("hex"), "1a737622466e35d66f487d261e550dbdba3a35507d30db00669fff2597856281");
});

test("versie groeit met de lengte (byte-modus, foutcorrectie M)", () => {
  // capaciteit in bytes bij M: v1 14, v2 26, v3 42, v4 62, v5 84
  for (const [n, size] of [[14, 21], [15, 25], [26, 25], [27, 29], [42, 29], [43, 33], [62, 33], [63, 37], [84, 37], [85, 41], [213, 57]]) {
    assert.equal(qrMatrix("a".repeat(n)).length, size, `${n} bytes`);
  }
  assert.throws(() => qrMatrix("a".repeat(214)), /lang/);
});

test("vaste patronen: finders, timing, donkere module, formaatinfo twee keer gelijk", () => {
  for (const mk of [0, 1, 2, 3, 4, 5, 6, 7]) {
    const m = qrMatrix(URL1, mk), n = m.length;
    for (const [cx, cy] of [[3, 3], [n - 4, 3], [3, n - 4]]) {
      for (let d = -3; d <= 3; d++) {
        assert.equal(m[cy - 3][cx + d], true); assert.equal(m[cy + d][cx - 3], true); // buitenrand donker
        if (Math.abs(d) <= 2) assert.equal(m[cy - 2][cx + d], false); // lichte ring
        if (Math.abs(d) <= 1) assert.equal(m[cy - 1][cx + d], true); // donkere kern
      }
      assert.equal(m[cy][cx], true);
    }
    for (let i = 8; i < n - 8; i++) { assert.equal(m[6][i], i % 2 === 0); assert.equal(m[i][6], i % 2 === 0); }
    assert.equal(m[n - 8][8], true);
    const a = [], b = [];
    for (let i = 0; i <= 5; i++) a.push(m[i][8]);
    a.push(m[7][8], m[8][8], m[8][7]);
    for (let i = 9; i < 15; i++) a.push(m[8][14 - i]);
    for (let i = 0; i < 8; i++) b.push(m[8][n - 1 - i]);
    for (let i = 8; i < 15; i++) b.push(m[n - 15 + i][8]);
    assert.deepEqual(a, b);
    // formaatinfo decoderen: M (00) + gekozen masker
    const v = a.reduce((s, x, i) => s | ((x ? 1 : 0) << i), 0) ^ 0x5412;
    assert.equal(v >>> 10, mk);
  }
});

test("versie-informatie vanaf versie 7", () => {
  const m = qrMatrix("a".repeat(115)), n = m.length; // versie 7 (107–122 bytes) = 45 modules
  assert.equal(n, 45);
  let a = 0, b = 0;
  for (let i = 0; i < 18; i++) {
    if (m[Math.floor(i / 3)][n - 11 + (i % 3)]) a |= 1 << i;
    if (m[n - 11 + (i % 3)][Math.floor(i / 3)]) b |= 1 << i;
  }
  assert.equal(a, b);
  assert.equal(a >>> 12, 7);
});

test("SVG: zwart op wit, stille zone, label geëscapet", () => {
  const s = qrSvg(URL1, 'Code "K7M" <x>');
  assert.match(s, /viewBox="0 0 45 45"/);
  assert.match(s, /fill="#fff"/);
  assert.match(s, /aria-label="Code &quot;K7M&quot; &lt;x&gt;"/);
  assert.doesNotMatch(s, /<x>/);
});
