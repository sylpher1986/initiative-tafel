// Beurtvolgorde, conditie-duur en alles wat aan het begin/einde van een beurt gebeurt.
import { d } from "./dice.js";
import { fx } from "./combat.js";
import { tickEffects } from "./effects.js";
import { tickSaves, turnSaves } from "./saves.js";

export const CONDS = ["Blinded", "Charmed", "Deafened", "Frightened", "Grappled", "Incapacitated", "Invisible", "Paralyzed", "Petrified", "Poisoned", "Prone", "Restrained", "Stunned", "Unconscious", "Concentrating"];

export const DURS = [
  ["inf", "Onbeperkt"],
  ["tend", "Tot einde volgende beurt (doelwit)"],
  ["tstart", "Tot begin volgende beurt (doelwit)"],
  ["sstart", "Tot begin volgende beurt (wie nu aan de beurt is)"],
  ["r1", "1 ronde"], ["r2", "2 rondes"], ["r3", "3 rondes"],
  ["r10", "1 minuut (10 rondes)"], ["r100", "10 minuten (100 rondes)"],
];

/** init hoog→laag; lair verliest gelijke stand; dan Dex; dan spelers vóór monsters; dan naam */
export const sortOrder = (list) => [...list].sort((a, b) =>
  b.init - a.init
  || ((a.kind === "lair") - (b.kind === "lair"))
  || b.dex - a.dex
  || ((b.kind === "pc") - (a.kind === "pc"))
  || a.name.localeCompare(b.name));

/** Ingevulde initiative ("14", 14, "-1") → heel getal binnen -10..40; leeg of ongeldig → null */
export function parseInit(v) {
  const s = String(v ?? "").trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Math.max(-10, Math.min(40, Math.round(+s)));
}

export const isOut =(c) => (c.kind === "monster" && c.hp <= 0) || !!(c.ds && c.ds.dead);

/**
 * Duur van een nieuwe conditie. Teltrigger: begin of einde van de beurt van `who`.
 * opt: { dur, ab, dc }
 */
export function makeDur(c, opt, activeId) {
  const dur = opt.dur || "inf";
  const act = activeId || c.id;
  let e = null;
  if (dur === "tend") e = { kind: "tend", who: c.id, at: "end", count: activeId === c.id ? 2 : 1 };
  else if (dur === "tstart") e = { kind: "tstart", who: c.id, at: "start", count: 1 };
  else if (dur === "sstart") e = { kind: "sstart", who: act, at: "start", count: 1 };
  else if (dur[0] === "r") e = { kind: "rounds", who: act, at: "start", count: +dur.slice(1) };
  if (opt.ab && opt.dc) (e = e || { kind: "inf" }).save = { ab: opt.ab, dc: +opt.dc };
  return e;
}

export const durText = (c, n, list) => durLabel(c.cd && c.cd[n], list);

/** Resterende duur als korte tekst (condities en effecten) */
export function durLabel(e, list, short = false) {
  if (!e) return "";
  const who = list.find((x) => x.id === e.who);
  let t = e.kind === "rounds" ? `${e.count}r`
    : e.kind === "tend" ? (short ? "einde beurt" : e.count > 1 ? "t/m einde volgende beurt" : "t/m einde beurt")
    : e.kind === "tstart" ? (short ? "begin beurt" : "t/m begin volgende beurt")
    : e.kind === "sstart" ? `${short ? "" : "t/m "}beurt ${who ? who.name : "?"}` : "";
  if (e.save) t += `${t ? ", " : ""}${e.save.ab} ${e.save.dc}`;
  return t;
}

/** Een beurtgrens ("start" of "end" van deelnemer id): duur aftellen (herhaal-saves: saves.js, open bij het begin van de beurt) */
export function turnBoundary(list, at, id) {
  const out = fx();
  for (const c of list) {
    if (!c.cd) continue;
    for (const [n, e] of Object.entries(c.cd)) {
      if (!c.cond.includes(n)) { delete c.cd[n]; continue; }
      if (e.who === id && e.at === at && e.count) {
        e.count--;
        if (e.count <= 0) {
          out.why.push({ t: "duur verlopen", id: c.id });
          c.cond = c.cond.filter((x) => x !== n);
          delete c.cd[n];
          if (n === "Concentrating") c.concSpell = null;
          out.msgs.push(`${c.name}: ${n} is voorbij.`);
        }
      }
    }
  }
  const r = tickEffects(list, at, id);
  out.msgs.push(...r.msgs); out.why.push(...r.why);
  return out;
}

/**
 * Naar de volgende (dir=1) of vorige (dir=-1) beurt. Slaat wie neer is over.
 * Vooruit: einde vorige beurt, begin nieuwe beurt (reaction, legendary, recharge, death save-herinnering).
 */
export function step(state, dir, rng = Math.random) {
  const out = fx();
  const L = sortOrder(state.list);
  if (!L.length) return out;
  let i = L.findIndex((c) => c.id === state.active);
  const passed = [];
  if (dir > 0 && state.active && i >= 0) passed.push(["end", state.active]);
  for (let n = 0; n < L.length; n++) {
    i += dir;
    if (dir > 0 && n > 0) { const skipped = L[(i - 1 + L.length) % L.length]; passed.push(["start", skipped.id], ["end", skipped.id]); }
    if (i >= L.length) { i = 0; state.round++; }
    else if (i < 0) { i = L.length - 1; state.round = Math.max(1, state.round - 1); }
    if (!isOut(L[i])) break;
  }
  const cur = L[i];
  state.active = cur.id;
  if (dir < 0) return out;

  passed.push(["start", cur.id]);
  out.why.push(...tickSaves(state).why);
  for (const [at, id] of passed) {
    const r = turnBoundary(state.list, at, id);
    out.msgs.push(...r.msgs); out.why.push(...r.why);
  }
  turnSaves(state, cur.id);
  cur.reaction = false;
  if (cur.la) cur.la.left = cur.la.max;
  const rc = [];
  for (const r of cur.rc || []) {
    if (r.ready || r.rest) continue;
    const x = d(6, rng);
    r.ready = x >= r.min;
    rc.push(`${r.n}: d6 [${x}] → ${r.ready ? "weer beschikbaar" : "nog niet"}`);
    if (r.ready) out.why.push({ t: `recharge d6 [${x}]`, id: cur.id });
  }
  if (rc.length) out.msgs.push(`${cur.name} recharge: ${rc.join("; ")}`);
  if (cur.kind === "pc" && cur.max && cur.hp <= 0 && cur.ds && !cur.ds.stable && !cur.ds.dead) out.msgs.push(`${cur.name} ligt op 0 HP: death save!`);
  return out;
}

/** Gevecht starten: ronde 1, eerste deelnemer die niet neer is, met start-van-beurt-effecten */
export function startCombat(state, rng = Math.random) {
  for (const c of state.list) if (c.la) c.la.left = c.la.max; // nieuw gevecht: legendary actions vol, ook vóór de eigen beurt
  state.round = 1;
  state.active = null;
  return step(state, 1, rng);
}
