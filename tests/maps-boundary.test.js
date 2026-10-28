// Inn the Grid (G4, WP56): "helemaal los van Initiative" technisch afgedwongen (docs/g4-inn-the-grid.md §2.1).
// js/maps/ importeert alleen eigen modules en gedeelde infrastructuur (js/i18n/*); omgekeerd importeert niets buiten
// js/maps/ iets uit js/maps/ (koppeling pas in fase 3, met een eigen besluit). Pure modellaag zonder DOM.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";

const ROOT = new URL("../", import.meta.url).pathname;
const walk = (d) => readdirSync(ROOT + d).flatMap((n) => (statSync(ROOT + d + n).isDirectory() ? walk(d + n + "/") : [d + n])).filter((p) => p.endsWith(".js"));
const specs = (src) => [...src.matchAll(/(?:^|[;\s])(?:import|export)\s[^"'`]*?from\s*["'`]([^"'`]+)["'`]|import\(\s*["'`]([^"'`$]+)/gm)].map((m) => m[1] || m[2]);
const target = (file, s) => (s.startsWith("/") ? s.slice(1) : relative(ROOT, resolve(dirname(ROOT + file), s)));

test("js/maps/ importeert alleen js/maps/ en js/i18n/", () => {
  const bad = [];
  for (const f of walk("js/maps/")) for (const s of specs(readFileSync(ROOT + f, "utf8"))) {
    const t = target(f, s);
    if (!t.startsWith("js/maps/") && !t.startsWith("js/i18n/") && !t.startsWith("locales/maps/")) bad.push(`${f} → ${s}`);
  }
  assert.deepEqual(bad, []);
  assert.ok(walk("js/maps/").length >= 6);
});

test("niets buiten js/maps/ importeert js/maps/ (koppeling met Initiative pas in fase 3)", () => {
  const bad = [];
  for (const f of walk("js/").filter((p) => !p.startsWith("js/maps/"))) for (const s of specs(readFileSync(ROOT + f, "utf8"))) if (target(f, s).startsWith("js/maps/")) bad.push(`${f} → ${s}`);
  assert.deepEqual(bad, []);
});

test("modellaag puur: geen DOM, window, document of opslag", () => {
  for (const f of walk("js/maps/model/")) {
    const code = readFileSync(ROOT + f, "utf8").replace(/\/\/.*$/gm, "");
    assert.doesNotMatch(code, /\b(document|window|localStorage|indexedDB|navigator|getComputedStyle)\b/, f);
  }
});

test("scanner vindt statische, export- en dynamische imports", () => {
  assert.deepEqual(specs(`import { a } from "./x.js";\nexport { b } from '../y.js';\nconst c = import("/locales/maps/en.js");`), ["./x.js", "../y.js", "/locales/maps/en.js"]);
});
