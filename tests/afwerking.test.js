import "./_nl.js"; // WP27: Nederlandse catalogus voor descriptoren
import { test } from "node:test";
import assert from "node:assert/strict";
import { logRound, logText } from "../js/log.js";

test("logRound: R + ronde tijdens het gevecht, anders Voorbereiding", () => {
  assert.equal(logRound(1), "R1");
  assert.equal(logRound(12), "R12");
  assert.equal(logRound("3"), "R3");
  for (const r of [0, -1, undefined, null, "", "x", NaN, Infinity]) assert.equal(logRound(r), "Voorbereiding");
});

test("logText: regels vóór het gevecht krijgen Voorbereiding, geen R0 of Rundefined", () => {
  const t = logText([
    { r: 0, turn: "", msg: "Goblin 1 doet mee" },
    { msg: "Oude regel zonder ronde" },
    { type: "round", msg: "Ronde 1" },
    { r: 1, turn: "Ayla", msg: "Goblin 1: 5 schade", why: "Longsword" },
  ]);
  assert.equal(t, "Voorbereiding Goblin 1 doet mee\nVoorbereiding Oude regel zonder ronde\n\n== Ronde 1 ==\nR1 [Ayla] Goblin 1: 5 schade (Longsword)");
  assert.doesNotMatch(t, /R0|Rundefined/);
});

test("bestandsknoppen (data-file) wijzen naar een verborgen file-input", async () => {
  const { readFile } = await import("node:fs/promises");
  const src = (await readFile(new URL("../pages/initiative.html", import.meta.url), "utf8")) + (await readFile(new URL("../js/ui/encounters.js", import.meta.url), "utf8"));
  const ids = [...src.matchAll(/data-file="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids.sort(), ["enc-file", "imp-backup", "imp-file", "pc-pdf"]);
  for (const id of ids) assert.match(src, new RegExp(`<input id="${id}" type="file"[^>]* hidden>`), id);
  assert.doesNotMatch(src, /type="file"(?![^>]*hidden)[^>]*>/, "geen zichtbare file-input (Engelse browserknop)");
});
