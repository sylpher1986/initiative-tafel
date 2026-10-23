// WP15: lettertypes zelf meegeleverd. Elk @font-face-bestand bestaat, de preload wijst naar een gebruikt bestand,
// en Playfair Display blijft beperkt tot merk en grote koppen (via --brand).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const root = new URL("../", import.meta.url);
const css = readFileSync(new URL("css/app.css", root), "utf8");
const faces = [...css.matchAll(/@font-face\{[^}]*\}/g)].map((m) => m[0]);
const urls = faces.map((f) => f.match(/url\("\.\.\/(fonts\/[^"]+)"\)/)?.[1]);

test("elk @font-face-bestand bestaat en heeft font-display swap", () => {
  assert.ok(faces.length >= 2);
  for (const [i, u] of urls.entries()) {
    assert.ok(u, "geen url in " + faces[i]);
    assert.ok(existsSync(new URL(u, root)), u + " ontbreekt");
    assert.match(faces[i], /font-display:swap/);
  }
});

test("preload in index.html wijst naar een gebruikt lettertype", () => {
  const html = readFileSync(new URL("index.html", root), "utf8");
  const pre = [...html.matchAll(/<link rel="preload" href="([^"]+)" as="font"[^>]*>/g)];
  assert.ok(pre.length, "geen font-preload");
  for (const [tag, href] of pre) {
    assert.ok(urls.includes(href), href + " staat niet in een @font-face");
    assert.match(tag, /crossorigin/, "font-preload zonder crossorigin wordt twee keer geladen");
  }
});

test("geen oude lettertypes; Playfair alleen via --brand", () => {
  assert.doesNotMatch(css, /Alegreya/);
  const uses = [...css.matchAll(/([^{}]+)\{[^}]*var\(--brand\)/g)].map((m) => m[1].trim().split("\n").pop());
  assert.deepEqual(uses.sort(), [".sb h2", "h1"]);
});
