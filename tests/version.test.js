import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { VERSION } from "../js/version.js";

test("appversie is x.y.z en gelijk aan de service worker", () => {
  assert.match(VERSION, /^\d+\.\d+\.\d+$/);
  const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  assert.equal(sw.match(/const VERSION = "([^"]+)"/)?.[1], VERSION, "VERSION in sw.js en js/version.js lopen uit elkaar");
  assert.ok(sw.includes('"./js/version.js"'), "js/version.js ontbreekt in de cache-lijst van sw.js");
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.equal(html.match(/<meta name="it-version" content="([^"]+)">/)?.[1], VERSION, "it-version in index.html loopt uit de pas");
});

test("elk app-bestand staat in de offline-cache van sw.js", async () => {
  const { readdirSync, statSync } = await import("node:fs");
  const root = new URL("../", import.meta.url);
  const sw = readFileSync(new URL("sw.js", root), "utf8");
  const walk = (dir) => readdirSync(new URL(dir, root)).flatMap((n) => {
    const p = dir + n;
    return statSync(new URL(p, root)).isDirectory() ? walk(p + "/") : [p];
  });
  // locales/src/ = bron van de catalogi (tools/i18n-build.mjs), niet gepubliceerd en niet geladen
  const files = ["css/", "data/", "fonts/", "icons/", "js/", "locales/"].flatMap(walk).filter((p) => !p.endsWith(".txt") && !p.startsWith("locales/src/"));
  const missing = files.filter((p) => !sw.includes(`"./${p}"`));
  assert.deepEqual(missing, [], "ontbreekt in ASSETS van sw.js");
});

test("geen 'share' in id's, classes of data-attributen: contentblokkers (Safari) verbergen die als social-knoppen", async () => {
  const { readdirSync } = await import("node:fs");
  const root = new URL("../", import.meta.url);
  const files = ["index.html", "speler.html", "css/app.css", ...readdirSync(new URL("js/ui/", root)).map((f) => "js/ui/" + f), "js/speler.js"];
  const bad = [];
  for (const f of files) {
    const t = readFileSync(new URL(f, root), "utf8");
    const hits = t.match(/(?:id|class|data)[-=]?["'\w-]*share|\.share[\w-]*\s*\{|#share[\w-]*|data-share|share-[\w]+/gi) || [];
    for (const h of hits) if (!/share\.js/.test(h)) bad.push(`${f}: ${h}`);
  }
  assert.deepEqual(bad, []);
});
