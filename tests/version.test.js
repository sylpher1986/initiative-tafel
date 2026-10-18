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
