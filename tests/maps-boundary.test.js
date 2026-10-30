// Inn Sight (G4, WP56): "helemaal los van Initiative" technisch afgedwongen (docs/g4-inn-the-grid.md §2.1).
// js/maps/ importeert alleen eigen modules en gedeelde infrastructuur (js/i18n/*); omgekeerd importeert niets buiten
// js/maps/ iets uit js/maps/, behalve de brug js/ui/encmap.js (WP69, fase 3). Pure modellaag zonder DOM.
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

// WP69 (fase 3): alleen js/ui/encmap.js mag js/maps/ gebruiken, alleen dynamisch (Initiative laadt geen kaartcode bij
// het opstarten en breekt niet als de Maps-cache offline ontbreekt), en alleen deze modules.
// WP70: kaart bekijken (mapViewer) gebruikt ook de renderer, view, raster, invoer en assetImage van Inn Sight.
const BRIDGE = "js/ui/encmap.js", BRIDGE_OK = ["js/maps/store.js", "js/maps/ui/export.js", "js/maps/model/map.js", "js/maps/model/file.js",
  "js/maps/render/canvas.js", "js/maps/render/art.js", "js/maps/model/view.js", "js/maps/model/grid.js", "js/maps/ui/input.js", "js/maps/ui/upload.js", "js/maps/model/assets.js",
  "js/maps/model/fog.js"]; // WP73: fog bewerken in de kaartviewer
test("buiten js/maps/ importeert alleen de brug js/ui/encmap.js iets uit js/maps/, dynamisch en uit een vaste lijst", () => {
  const bad = [];
  for (const f of walk("js/").filter((p) => !p.startsWith("js/maps/"))) for (const s of specs(readFileSync(ROOT + f, "utf8"))) {
    if (!target(f, s).startsWith("js/maps/")) continue;
    if (f !== BRIDGE || !BRIDGE_OK.includes(target(f, s))) bad.push(`${f} → ${s}`);
  }
  assert.deepEqual(bad, []);
  const src = readFileSync(ROOT + BRIDGE, "utf8");
  assert.doesNotMatch(src, /^\s*import\s[^(]*["'`][^"'`]*maps\//m, "statische import van js/maps/ in de brug");
  assert.ok(BRIDGE_OK.every((m) => src.includes(`import("../${m.slice(3)}")`)), "brug gebruikt de toegestane modules dynamisch");
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
