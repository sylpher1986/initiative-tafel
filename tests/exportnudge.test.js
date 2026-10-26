import "./_nl.js"; // WP27: Nederlandse catalogus voor descriptoren
import { test } from "node:test";
import assert from "node:assert/strict";
import { exportDue, lastExportText, markDirty, markExported, snoozeNudge, nudgeState, DAY } from "../js/exportnudge.js";
import { initI18n } from "../js/i18n/boot.js";

const lang = (l) => initI18n({ doc: { documentElement: { lang: l } }, search: "", storage: null });
await lang("nl"); // teksten en datums komen uit de catalogus en Intl (WP24)

const T = new Date(2026, 9, 20, 12).getTime(); // 20 okt 2026, lokale tijd

test("exportDue: alleen bij een niet-geëxporteerde wijziging van 14 dagen of ouder", () => {
  assert.equal(exportDue({}, T), false, "nooit iets gewijzigd (lege app / alleen voorbeeld)");
  assert.equal(exportDue({ dirty: T - 13 * DAY }, T), false);
  assert.equal(exportDue({ dirty: T - 14 * DAY }, T), true, "precies 14 dagen");
  assert.equal(exportDue({ dirty: T - 40 * DAY, exp: T - 50 * DAY }, T), true);
});

test("exportDue: Later stelt uit tot het uitsteltijdstip", () => {
  assert.equal(exportDue({ dirty: T - 20 * DAY, snooze: T + 1 }, T), false);
  assert.equal(exportDue({ dirty: T - 20 * DAY, snooze: T }, T), true, "uitstel voorbij");
});

test("klok verzet: uitstel of wijziging in de toekomst blokkeert niet eeuwig", () => {
  assert.equal(exportDue({ dirty: T - 20 * DAY, snooze: T + 30 * DAY }, T), true, "uitstel > 7 dagen vooruit telt niet");
  assert.equal(exportDue({ dirty: T + 5 * DAY }, T), false, "wijziging in de toekomst: nog niet");
});

test("lastExportText: nooit, vandaag, gisteren, dagen, ander jaar", () => {
  assert.equal(lastExportText(0, T), "Nog nooit geëxporteerd");
  assert.equal(lastExportText(new Date(2026, 9, 20, 1).getTime(), T), "Laatste export: 20 okt (vandaag)");
  assert.equal(lastExportText(new Date(2026, 9, 19, 23).getTime(), T), "Laatste export: 19 okt (gisteren)");
  assert.equal(lastExportText(new Date(2026, 9, 12, 18).getTime(), T), "Laatste export: 12 okt (8 dagen geleden)");
  assert.equal(lastExportText(new Date(2025, 11, 31).getTime(), T), "Laatste export: 31 dec 2025 (293 dagen geleden)");
  assert.equal(lastExportText(T + DAY, T), "Laatste export: 21 okt (vandaag)", "klok teruggezet: geen negatieve dagen");
});

test("opslag: eerste wijziging telt, export zet alles terug, Later = 7 dagen", () => {
  const m = new Map();
  globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  try {
    markDirty(T - 20 * DAY); markDirty(T - 2 * DAY);
    assert.equal(nudgeState().dirty, T - 20 * DAY, "latere wijziging overschrijft de eerste niet");
    assert.equal(exportDue(nudgeState(), T), true);
    snoozeNudge(T);
    assert.equal(exportDue(nudgeState(), T + 6 * DAY), false);
    assert.equal(exportDue(nudgeState(), T + 7 * DAY), true);
    markExported(T);
    assert.deepEqual(nudgeState(), { exp: T, dirty: 0, snooze: 0 });
    assert.equal(exportDue(nudgeState(), T + 100 * DAY), false, "na export zonder wijziging nooit");
    markDirty(T + 30 * DAY); markDirty(T);
    assert.equal(nudgeState().dirty, T, "wijziging in de toekomst wordt bij de volgende opslag rechtgezet");
  } finally { delete globalThis.localStorage; }
});

test("opslag kapot (privémodus): geen fout, geen herinnering", () => {
  globalThis.localStorage = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } };
  try {
    markDirty(T); markExported(T); snoozeNudge(T);
    assert.deepEqual(nudgeState(), { exp: 0, dirty: 0, snooze: 0 });
  } finally { delete globalThis.localStorage; }
});

test("AF5: korte exportstatus voor de kop van Opslag", async () => {
  const { exportStat } = await import("../js/exportnudge.js");
  const now = new Date(2026, 9, 20, 12).getTime();
  assert.equal(exportStat(0, now), "Nog nooit geëxporteerd");
  assert.equal(exportStat(now - 8 * 864e5, now), "Export: 8 dagen geleden");
  assert.equal(exportStat(now, now), "Export: vandaag");
});

test("lastExportText en exportStat in het Engels (en-GB-datum)", async () => {
  await lang("en");
  try {
    assert.equal(lastExportText(0, T), "Never exported");
    assert.equal(lastExportText(new Date(2026, 9, 12, 18).getTime(), T), "Last export: 12 Oct (8 days ago)");
    assert.equal(lastExportText(new Date(2025, 11, 31).getTime(), T), "Last export: 31 Dec 2025 (293 days ago)");
    assert.equal(lastExportText(new Date(2026, 9, 19, 23).getTime(), T), "Last export: 19 Oct (yesterday)");
    const { exportStat } = await import("../js/exportnudge.js");
    assert.equal(exportStat(T - DAY, T), "Export: yesterday");
  } finally { await lang("nl"); }
});
