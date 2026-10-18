import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { VERSION } from "../js/version.js";

test("appversie is x.y.z en gelijk aan de service worker", () => {
  assert.match(VERSION, /^\d+\.\d+\.\d+$/);
  const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  assert.equal(sw.match(/const VERSION = "([^"]+)"/)?.[1], VERSION, "VERSION in sw.js en js/version.js lopen uit elkaar");
  assert.ok(sw.includes('"./js/version.js"'), "js/version.js ontbreekt in de cache-lijst van sw.js");
});

test("elk app-bestand staat in de offline-cache van sw.js", async () => {
  const { readdirSync, statSync } = await import("node:fs");
  const root = new URL("../", import.meta.url);
  const sw = readFileSync(new URL("sw.js", root), "utf8");
  const walk = (dir) => readdirSync(new URL(dir, root)).flatMap((n) => {
    const p = dir + n;
    return statSync(new URL(p, root)).isDirectory() ? walk(p + "/") : [p];
  });
  const files = ["css/", "data/", "fonts/", "icons/", "js/"].flatMap(walk).filter((p) => !p.endsWith(".txt"));
  const missing = files.filter((p) => !sw.includes(`"./${p}"`));
  assert.deepEqual(missing, [], "ontbreekt in ASSETS van sw.js");
});
