// WP17 (HS7): lijn-iconen uit één sprite. Elke gebruikte naam bestaat, de sprite staat in de service worker,
// en de oude tekenglyphs (Inter heeft ze niet, iOS tekent ▶ soms als emoji) staan niet meer in de interface.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { ico, chev, dsMini } from "../js/ui/icons.js";
import { initI18n } from "../js/i18n/boot.js";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const sprite = read("icons/ui.svg");
const files = ["js/speler.js", ...readdirSync(new URL("../js/ui/", import.meta.url)).filter((f) => f.endsWith(".js")).map((f) => "js/ui/" + f)];
// Alleen hele commentaarregels weghalen (// …, /* … */, * …) en een staart "  // …" na code; niets binnen strings
// (dev-review: een /* in accept="image/*" of // in een template-literal mag geen code wegknippen).
const code = (s) => s.split("\n").map((l) => (/^\s*(\/\/|\/\*|\*)/.test(l) ? "" : l.replace(/;\s+\/\/ .*$/, ";"))).join("\n");

test("elk gebruikt icoon bestaat in icons/ui.svg", () => {
  const used = new Set(["alert", "chev", "check", "x"]);
  for (const f of files) for (const [, id] of read(f).matchAll(/\bico\(\s*"([a-z-]+)"/g)) used.add(id);
  const missing = [...used].filter((id) => !sprite.includes(`id="i-${id}"`));
  assert.deepEqual(missing, []);
  assert.ok(used.size >= 10);
});

test("sprite en helper in de service worker", () => {
  const sw = read("sw.js");
  assert.match(sw, /"\.\/icons\/ui\.svg"/);
  assert.match(sw, /"\.\/js\/ui\/icons\.js"/);
});

test("geen tekenglyphs meer als knop of uitklappijl", () => {
  const hits = [];
  for (const f of [...files, "pages/initiative.html", "pages/player.html"]) {
    const s = f.endsWith(".js") ? code(read(f)) : read(f).replace(/<!--[\s\S]*?-->/g, "");
    for (const [i, line] of s.split("\n").entries()) if (/[▸▾▴▶↶↻⚠✕]|>⋯</.test(line)) hits.push(`${f}:${i + 1}`);
  }
  const css = code(read("css/app.css"));
  if (/content:"[▸▾▴▶]"/.test(css)) hits.push("css/app.css: content-glyph");
  assert.deepEqual(hits, []);
});

test("een knop met alleen een icoon heeft een aria-label", () => {
  const bad = [];
  for (const f of files) for (const [tag] of read(f).matchAll(/<button[^>]*>\$\{(?:ico\(|PEN|PLUS|GEAR)[^}]*\}<\/button>/g)) if (!/aria-label=/.test(tag)) bad.push(`${f}: ${tag.slice(0, 80)}`);
  assert.deepEqual(bad, []);
});

test("ico, chev en dsMini", async () => {
  await initI18n({ doc: { documentElement: { lang: "nl" } }, search: "", storage: null }); // WP25: tekst uit de NL-catalogus
  assert.equal(ico("x"), '<svg class="li" aria-hidden="true" focusable="false"><use href="/icons/ui.svg#i-x"/></svg>');
  assert.match(chev(true), /class="li dn"/);
  assert.doesNotMatch(chev(false), /dn/);
  const d = dsMini(1, 2);
  assert.match(d, /aria-hidden="true">Death saves/);
  assert.match(d, /class="vh">Death saves: 1 gelukt, 2 mislukt</);
});
