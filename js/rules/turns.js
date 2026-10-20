// Beurtvolgorde, conditie-duur en alles wat aan het begin/einde van een beurt gebeurt.
import { d } from "./dice.js";
import { fx } from "./combat.js";
import { tickEffects, endFightEffects } from "./effects.js";
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
  || a.name.localeCompare(b.name, undefined, { numeric: true })); // Bugbear 2 vóór Bugbear 10

/** Ingevulde initiative ("14", 14, "-1") → heel getal binnen -10..40; leeg of ongeldig → null */
export function parseInit(v) {
  const s = String(v ?? "").trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Math.max(-10, Math.min(40, Math.round(+s)));
}

export const isOut = (c) => (c.kind === "monster" && c.hp <= 0) || !!(c.ds && c.ds.dead);

/**
 * Surprise (PHB 2014): wie verrast is (`sur`) doet in ronde 1 niets; zijn beurt wordt overgeslagen
 * (beurtgrenzen tellen wel af) en hij heeft geen reaction tot die beurt voorbij is.
 * sur: true = nog verrast, 2 = beurt is overgeslagen (blijft in ronde 1 overgeslagen, ook bij ‹ Vorige).
 * Vanaf ronde 2 en bij Gevecht stoppen verdwijnt `sur`.
 */
export const skipsTurn = (c, round) => isOut(c) || (round === 1 && !!c.sur);
/** Nog verrast: geen reaction, geen legendary actions */
export const isSurprised = (c, S) => c.sur === true && S.round === 1 && !isOut(c);
const clearSur = (list) => { for (const c of list) delete c.sur; };

/**
 * Bij Start gevecht (initiative-paneel): wie is verrast. who: "none" | "mon" | "pc".
 * Wie al neer of dood is, telt niet. startCombat zet daarna reaction en het overslaan.
 */
export function setSurprise(list, who) {
  const out = fx();
  for (const c of list) {
    delete c.sur;
    if (c.kind !== "lair" && !isOut(c) && ((who === "mon" && c.kind === "monster") || (who === "pc" && c.kind === "pc"))) c.sur = true;
  }
  return out;
}

/**
 * Verrast aan/uit voor één deelnemer in ronde 1 (⋯): alleen zolang zijn beurt nog moet komen.
 * Uit: reaction weer beschikbaar. Geeft null als het nu niet kan.
 */
export function canToggleSurprise(c, S) {
  if (S.round !== 1 || c.kind === "lair" || isOut(c) || c.id === S.active) return false;
  if (c.sur === true) return true;
  if (c.sur) return false; // beurt al overgeslagen
  const L = sortOrder(S.list);
  return L.findIndex((x) => x.id === c.id) > L.findIndex((x) => x.id === S.active);
}
export function toggleSurprise(c, S) {
  if (!canToggleSurprise(c, S)) return null;
  const out = fx();
  if (c.sur === true) { delete c.sur; c.reaction = false; out.why.push({ t: "toch niet verrast", id: c.id }); }
  else { c.sur = true; c.reaction = true; out.why.push({ t: "verrast", id: c.id }); }
  return out;
}

/** Wie is na `id` aan de beurt (overslaan van wie neer is en, in ronde 1, wie verrast is). skip(c) = extra overslaan. */
export function nextUp(S, L, id, skip = () => false) {
  const i = L.findIndex((c) => c.id === id);
  for (let k = 1; k <= L.length; k++) {
    const j = i + k, c = L[j % L.length], r = S.round + (j >= L.length ? 1 : 0);
    if (c && c.id !== id && !skipsTurn(c, r) && !skip(c)) return c;
  }
  return null;
}

/**
 * Groepsbeurt: monsters die samen met één groepsworp (of ingevulde initiative) zijn toegevoegd (`grp`).
 * Elk lid houdt zijn eigen beurt (beurtgrenzen, recharge, saves per lid); dit is alleen voor de weergave.
 * Groep = aaneengesloten reeks in sortOrder met dezelfde grp én initiative (ander initiative = uit de groep).
 * round: ronde (in ronde 1 tellen verraste leden niet mee). Geeft { live, k } (levende leden en positie 1..n van id daarin) of null als id zelf neer is of er geen groep van 2+ levende leden is.
 */
export function groupOf(L, id, round = 0) {
  const i = L.findIndex((c) => c.id === id), c = L[i];
  if (!c || !c.grp || skipsTurn(c, round)) return null; // wie zelf neer is (bijv. in de eigen beurt gedood) staat los: geen "0/2"
  const same = (x) => x && x.grp === c.grp && x.init === c.init;
  let a = i, b = i;
  while (same(L[a - 1])) a--;
  while (same(L[b + 1])) b++;
  const live = L.slice(a, b + 1).filter((x) => !skipsTurn(x, round)); // ronde 1: verraste leden doen niet mee
  return live.length > 1 ? { live, k: live.indexOf(c) + 1 } : null;
}

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
  const passed = [], sur = [];
  if (dir > 0 && state.active && i >= 0) passed.push(["end", state.active]);
  // met verraste deelnemers kan ronde 1 helemaal overgeslagen worden: dan nog één rondgang in ronde 2
  const lim = L.length * (L.some((c) => c.sur) ? 2 : 1);
  for (let n = 0; n < lim; n++) {
    i += dir;
    if (dir > 0 && n > 0) {
      const skipped = L[(i - 1 + L.length) % L.length];
      passed.push(["start", skipped.id], ["end", skipped.id]);
      if (skipped.sur === true) { skipped.sur = 2; skipped.reaction = false; if (!isOut(skipped)) sur.push(skipped); } // verrassing voorbij (ook als hij nu neer is en later geheald wordt): reaction weer beschikbaar
    }
    if (i >= L.length) { i = 0; state.round++; if (state.round > 1) clearSur(state.list); }
    else if (i < 0) { i = L.length - 1; state.round = Math.max(1, state.round - 1); }
    if (!skipsTurn(L[i], state.round)) break;
  }
  if (sur.length) {
    out.msgs.push(`Verrast, beurt overgeslagen: ${sur.map((c) => c.name).join(", ")}.`);
    for (const c of sur) out.why.push({ t: "verrast: eerste beurt overgeslagen", id: c.id });
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
  for (const c of state.list) {
    if (c.la) c.la.left = c.la.max; // nieuw gevecht: legendary actions vol, ook vóór de eigen beurt
    if (c.sur && !isOut(c)) { c.sur = true; c.reaction = true; } else delete c.sur; // verrast: geen reaction tot de eigen beurt voorbij is
  }
  state.round = 1;
  state.active = null;
  return step(state, 1, rng);
}

/** Gevecht stoppen: ronde-effecten weg, geen ronde of beurt, open saves vervallen */
export function stopCombat(state) {
  const out = endFightEffects(state.list);
  state.round = 0; state.active = null; state.saves = [];
  clearSur(state.list);
  return out;
}

/**
 * Volgende encounter: gevecht stoppen en alle monsters en lairs weghalen (ook verborgen monsters).
 * Spelers blijven met HP, slots, condities, death saves en lange effecten; het logboek blijft.
 * Concentratie-effecten van een weggehaalde caster verdwijnen in commit() (endConcEffects).
 */
export function clearMonsters(state) {
  const out = stopCombat(state);
  delete state.endSum; delete state.enc; // samenvatting en ingeladen encounter horen bij de vorige encounter
  const gone = new Set(state.list.filter((c) => c.kind === "monster" || c.kind === "lair").map((c) => c.id));
  const n = state.list.filter((c) => c.kind === "monster").length;
  state.list = state.list.filter((c) => !gone.has(c.id));
  // conditieduur die aan de beurt van een gewist monster hing telt nooit meer af: conditie blijft, zonder duur
  for (const c of state.list) for (const [k, e] of Object.entries(c.cd || {})) if (e && gone.has(e.who)) {
    const { kind, who, at, count, ...keep } = e; // save en concentratie-koppeling (by/spell/cast) blijven
    if (Object.keys(keep).length) c.cd[k] = { kind: "inf", ...keep }; else delete c.cd[k];
  }
  out.why.push({ t: "volgende encounter: monsters gewist", id: null });
  return Object.assign(out, { n, lairs: gone.size - n });
}

/** Spelers die bij Start gevecht hun initiative opgeven: levend (niet dood), ook verborgen of op 0 HP */
export const initPcs = (list) => sortOrder(list.filter((c) => c.kind === "pc" && !(c.ds && c.ds.dead)));

/**
 * Initiative van spelers vastleggen (paneel bij Start gevecht). map = { id: tekst }.
 * Alles of niets: missing = namen van spelers zonder geldige waarde (parseInit); dan verandert er niets
 * (de UI start het gevecht niet en Annuleer moet daarna echt niets veranderd hebben).
 */
export function setInits(list, map) {
  const L = initPcs(list), vals = L.map((c) => parseInit(map[c.id]));
  const out = Object.assign(fx(), { missing: L.filter((c, i) => vals[i] === null).map((c) => c.name) });
  if (!out.missing.length) L.forEach((c, i) => { if (vals[i] !== c.init) c.init = vals[i]; }); // het logboek noemt de wijziging zelf ("initiative 12 → 17")
  return out;
}
