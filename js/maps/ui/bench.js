// Inn Sight (G4, WP66): meetstand /maps/?bench (of ?bench=square). Draait het script van model/bench.js: per fase eerst
// even inlopen, dan BENCH.phase ms lang elk frame de view zetten en tekenen; gemeten wordt de tijd tussen opeenvolgende
// frames (requestAnimationFrame, dus wat je echt ziet) en de tekentijd zelf. De uitslag staat daarna in een paneel met
// dim (zelfde vorm als het sneltoetsenoverzicht), zodat Michiel hem op elk toestel kan aflezen of fotograferen.
import { t, i18n } from "../../i18n/boot.js";
import { BENCH, PHASES, benchView, frameStats, fpsTarget } from "../model/bench.js";
import { LIMITS } from "../model/limits.js";
import { esc } from "./dom.js";

const raf = () => new Promise((res) => requestAnimationFrame(res));

/** Script draaien. frame(view) zet de view en tekent synchroon, geeft { ms, full } (tekentijd, volledig getekend zonder buffer); b = kaartgrenzen; size() =
 *  { w, h } in CSS-px; onPhase(id, i, n) voor de strook. Geeft { [fase]: frameStats + full (aantal volledige tekeningen), frames }: bij zoomen zijn de meeste frames een
 *  geschaald voorbeeld, dus het aantal volledige tekeningen hoort bij het cijfer. */
export async function runPhases({ frame, b, size, onPhase = () => {}, phase = BENCH.phase, warm = BENCH.warm }) {
  const out = {};
  for (let i = 0; i < PHASES.length; i++) {
    const id = PHASES[i];
    onPhase(id, i, PHASES.length);
    const stamps = [], draws = [];
    let full = 0;
    const t0 = await raf();
    for (;;) {
      const now = await raf(), { w, h } = size(), el = now - t0;
      if (el > warm + phase) break;
      const f = frame(benchView(id, Math.min(0.9999, Math.max(0, (el - warm) / phase)), b, w, h));
      if (el >= warm) { stamps.push(now); draws.push(f.ms); if (f.full) full++; }
    }
    out[id] = { ...frameStats(stamps, draws), full, frames: stamps.length };
  }
  return out;
}

/** Uitslag als HTML (alles uit de catalogus, getallen via i18n().num) */
export function resultHtml({ res, openMs, touch, dev, mem, noBg = false }) {
  const n = (v, d = 0) => i18n().num(v, { maximumFractionDigits: d, minimumFractionDigits: d });
  const target = fpsTarget(touch), okSym = (ok) => `<span class="mbench-${ok ? "ok" : "bad"}">${esc(t(ok ? "maps.bench.ok" : "maps.bench.bad"))}</span>`;
  const rows = PHASES.map((id) => {
    const r = res[id];
    return `<dt>${esc(t("maps.bench.ph." + id))}</dt><dd>${okSym(r.fps >= target)} ${esc(t("maps.bench.fps", { fps: n(r.fps), ms: n(r.p95), worst: n(r.worst), draw: n(r.draw, 1), full: n(r.full), frames: n(r.frames) }))}</dd>`;
  });
  const openOk = openMs < BENCH.target.openMs;
  rows.unshift(`<dt>${esc(t("maps.bench.open"))}</dt><dd>${okSym(openOk)} ${esc(t("maps.bench.secs", { s: n(openMs / 1000, 1) }))}</dd>`);
  return `<p>${esc(t("maps.bench.target", { fps: n(target), s: n(BENCH.target.openMs / 1000), cells: n(LIMITS.maxCells), objs: n(LIMITS.objs), px: String(LIMITS.bgSide) }))}</p><dl class="keys mbench">${rows.join("")}</dl>`
    + `<p class="hint">${esc(t("maps.bench.dev", { w: n(dev.w), h: n(dev.h), dpr: n(dev.dpr, 1), cw: n(dev.cw), ch: n(dev.ch) }))}</p>`
    + `<p class="hint">${esc(t("maps.bench.mem", { mb: n(mem.mb) }))}${mem.heap ? " " + esc(t("maps.bench.heap", { mb: n(mem.heap) })) : ""}</p>`
    + (noBg ? `<p class="hint">${esc(t("maps.bench.nobg"))}</p>` : "")
    + `<p class="hint">${esc(t("maps.bench.hint"))}</p>`;
}
