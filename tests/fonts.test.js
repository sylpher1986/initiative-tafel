// WP15: lettertypes zelf meegeleverd. Elk @font-face-bestand bestaat, de preload wijst naar een gebruikt bestand,
// en Newsreader (WP34) blijft beperkt tot merk en enkele koppen (via --brand); DM Sans voor de rest.
import "./_nl.js"; // WP27: Nederlandse catalogus voor descriptoren
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

test("preload in de DM-pagina wijst naar een gebruikt lettertype", () => {
  const html = readFileSync(new URL("pages/initiative.html", root), "utf8");
  const pre = [...html.matchAll(/<link rel="preload" href="([^"]+)" as="font"[^>]*>/g)];
  assert.ok(pre.length, "geen font-preload");
  for (const [tag, href] of pre) {
    assert.ok(urls.includes(href.replace(/^\//, "")), href + " staat niet in een @font-face");
    assert.match(href, /^\//, "preload-pad moet absoluut zijn (pagina onder /{taal}/initiative/, WP21)");
    assert.match(tag, /crossorigin/, "font-preload zonder crossorigin wordt twee keer geladen");
  }
});

test("geen oude lettertypes; Newsreader alleen via --brand", () => {
  assert.doesNotMatch(css, /Alegreya|\bInter\b|Playfair/);
  assert.match(css, /--body:"DM Sans"/);
  assert.match(css, /--brand:Newsreader,/);
  const uses = [...css.matchAll(/([^{}]+)\{[^}]*var\(--brand\)/g)].map((m) => m[1].trim().split("\n").pop());
  assert.deepEqual(uses.sort(), [".esheet .shead h3", ".sb h2", ".tabstop h2", ".welcome h2", "h1"]);
});

test("oude letterbestanden zijn weg uit fonts/, sw.js en de pagina's (WP34)", () => {
  const sw = readFileSync(new URL("sw.js", root), "utf8");
  for (const u of urls) assert.ok(sw.includes("./" + u), u + " staat niet in sw.js");
  for (const f of ["sw.js", "pages/initiative.html", "pages/player.html", "pages/home.html", "tools/icons.mjs"]) {
    assert.doesNotMatch(readFileSync(new URL(f, root), "utf8"), /inter-latin|playfair/i, f);
  }
  for (const f of ["inter-latin-wght.woff2", "inter-latin-wght-italic.woff2", "playfair-display-latin-wght.woff2"]) assert.ok(!existsSync(new URL("fonts/" + f, root)), f);
});
