// WP16 (HS5): embleem in de h1 van beide pagina's (zelfde tekening als de app-iconen), tagline op het spelersscherm,
// manifest-iconen bestaan met de juiste maat.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EMBLEM } from "../tools/icons.mjs";

const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root));

test("h1 van beide pagina's heeft het embleem, verborgen voor schermlezers, zelfde tekening als de iconen", () => {
  for (const f of ["index.html", "speler.html"]) {
    const h1 = read(f).toString().match(/<h1>([\s\S]*?)<\/h1>/)[1];
    const svg = h1.match(/<svg class="emb"[^>]*>([\s\S]*?)<\/svg>/);
    assert.ok(svg, f + ": geen embleem in de h1");
    assert.match(svg[0], /aria-hidden="true"/);
    assert.equal(svg[1], EMBLEM, f + ": embleem wijkt af van tools/icons.mjs");
    assert.match(h1, /Kev’s Inn <span>itiative<\/span>$/);
  }
});

test("tagline alleen op het spelersscherm", () => {
  assert.match(read("speler.html").toString(), /<p class="pvtag" id="pv-tag">Your home between adventures\.<\/p>/);
  assert.doesNotMatch(read("index.html").toString(), /between adventures/);
});

test("manifest- en apple-iconen bestaan met de opgegeven maat", () => {
  const png = (p) => { const b = read(p); assert.equal(b.toString("latin1", 1, 4), "PNG", p); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
  const man = JSON.parse(read("manifest.webmanifest"));
  assert.ok(man.icons.some((i) => i.purpose === "maskable"));
  for (const i of man.icons) { const n = +i.sizes.split("x")[0]; assert.deepEqual(png(i.src), [n, n], i.src); }
  assert.deepEqual(png("icons/icon-180.png"), [180, 180]);
  assert.match(read("icons/icon.svg").toString(), /^<svg [^>]*viewBox="0 0 64 64"/);
});
