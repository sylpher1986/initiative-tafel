// Syntaxcheck (`node --check`) van alle JS-bestanden, ook DOM-modules die geen test importeert
// (js/ui/*, kamer.js, speler.js, sw.js). Zo valt een tikfout daar op vóór de browsercheck.
// package.json heeft "type": "module", dus elk .js-bestand wordt als ES-module gecontroleerd; sw.js is een gewoon
// worker-script en wordt apart als script geparst (een import of top-level await is daar een fout).
import "./_nl.js"; // WP27: Nederlandse catalogus voor descriptoren
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, statSync, readFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { Script } from "node:vm";

const run = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
const walk = (dir) => readdirSync(root + dir).flatMap((n) => {
  const p = dir + n;
  return statSync(root + p).isDirectory() ? walk(p + "/") : [p];
});
const files = ["js/", "locales/", "worker/", "tools/"].flatMap(walk).filter((p) => /\.m?js$/.test(p));

test("alle JS-bestanden zijn syntactisch geldig", async () => {
  assert.ok(files.length > 30, "te weinig bestanden gevonden");
  const res = await Promise.all(files.map((f) =>
    run(process.execPath, ["--check", f], { cwd: root }).then(() => null, (e) => `${f}: ${String(e.stderr).split("\n").find((l) => /Error/.test(l)) || e.message}`)));
  assert.deepEqual(res.filter(Boolean), []);
});

test("sw.js is een geldig gewoon script (geen module)", () => {
  assert.doesNotThrow(() => new Script(readFileSync(root + "sw.js", "utf8"), { filename: "sw.js" }));
});
