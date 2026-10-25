// DA1: herinnering om af en toe een export te maken (1.31.1).
// Per apparaat in localStorage, niet in undo of export. Logica puur (`exportDue`, `lastExportText`), I/O apart.
// it-exp   = laatste gelukte export of import
// it-dirty = eerste wijziging aan waardevolle data (party, lairs, encounters, eigen/geïmporteerde monsters) na it-exp
// it-snooze = "Later": strook weg tot dit tijdstip

import { t, i18n } from "./i18n/boot.js";

export const DAY = 864e5;
export const DUE_DAYS = 14, SNOOZE_DAYS = 7;
const K = { exp: "it-exp", dirty: "it-dirty", snooze: "it-snooze" };

/** Strook tonen? Alleen als er een niet-geëxporteerde wijziging is van ≥ 14 dagen oud en er geen uitstel loopt */
export function exportDue({ dirty, snooze } = {}, now = Date.now()) {
  if (!(dirty > 0)) return false;
  if (snooze > now && snooze - now <= SNOOZE_DAYS * DAY) return false; // uitstel verder weg dan 7 dagen = klok was verzet
  return now - Math.min(dirty, now) >= DUE_DAYS * DAY;
}

/** "vandaag", "gisteren", "8 dagen geleden": kalenderdagen in lokale tijd (klok teruggezet: nooit negatief) */
function agoText(d, n) {
  const days = Math.max(0, Math.round((new Date(n.getFullYear(), n.getMonth(), n.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / DAY));
  return days === 0 ? t("common.time.today") : days === 1 ? t("common.time.yesterday") : t("common.time.daysAgo", { n: days });
}
/** "Laatste export: 12 okt (8 dagen geleden)" of "Nog nooit geëxporteerd"; jaar alleen als het een ander jaar is */
export function lastExportText(exp, now = Date.now()) {
  if (!(exp > 0)) return t("init.exp.never");
  const d = new Date(exp), n = new Date(now);
  const date = i18n().date(d, { day: "numeric", month: "short", ...(d.getFullYear() !== n.getFullYear() ? { year: "numeric" } : {}) });
  return t("init.exp.last", { date, ago: agoText(d, n) });
}

/** AF5: korte vorm voor de kop van Instellingen → Opslag: "Export: 8 dagen geleden" */
export function exportStat(exp, now = Date.now()) {
  return exp > 0 ? t("init.exp.stat", { ago: agoText(new Date(exp), new Date(now)) }) : t("init.exp.never");
}

/* ---------- localStorage (privémodus of geblokkeerd: dan gewoon geen herinnering) ---------- */
const num = (k) => { try { const v = +globalThis.localStorage?.getItem(k); return v > 0 ? v : 0; } catch { return 0; } };
const put = (k, v) => { try { v ? globalThis.localStorage?.setItem(k, String(v)) : globalThis.localStorage?.removeItem(k); } catch { /* geen opslag: geen herinnering */ } };

export const nudgeState = () => ({ exp: num(K.exp), dirty: num(K.dirty), snooze: num(K.snooze) });
/** Bij elke opslag van waardevolle data; alleen de eerste wijziging na een export telt */
export function markDirty(now = Date.now()) { const d = num(K.dirty); if (!d || d > now) put(K.dirty, now); } // in de toekomst = klok was verzet
/** Na een gelukte export (bestand of tekst) of import: alles weer bij */
export function markExported(now = Date.now()) { put(K.exp, now); put(K.dirty, 0); put(K.snooze, 0); }
export function snoozeNudge(now = Date.now()) { put(K.snooze, now + SNOOZE_DAYS * DAY); }
