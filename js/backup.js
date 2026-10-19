// Export/import van alle data als één JSON-bestand met versienummer.
// Hetzelfde formaat exporteert de Claude-versie, zodat je daarmee kunt overstappen.
import { sanitizeOwn } from "./data/monsters.js";
import { CONDS } from "./rules/turns.js";
import { cleanImg } from "./ui/avatar.js";

export const FORMAT = "initiative-tafel";
export const VERSION = 1;

export function buildExport(app) {
  return {
    format: FORMAT, version: VERSION, exported: new Date().toISOString(),
    state: app.S, party: app.party, lairs: app.lairs, custom: app.custom, imported: app.imported,
  };
}

/* ---------- opschonen: een bestand kan van iemand anders komen ---------- */
const str = (v, max = 2000) => (v == null ? "" : String(v).slice(0, max));
const num = (v, def = 0) => (Number.isFinite(+v) ? +v : def);
const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : null);
const arr = (v) => (Array.isArray(v) ? v : []);
/** Teller (legendary actions/resistance): hele getallen, max 0–20, left 0–max (een import kan rare waarden bevatten) */
const counter = (o) => { if (!obj(o)) return null; const max = Math.min(20, Math.max(0, Math.trunc(num(o.max)))); return { max, left: Math.min(max, Math.max(0, Math.trunc(num(o.left)))) }; };

function cleanCasting(k) {
  if (!obj(k)) return null;
  return {
    slots: arr(k.slots).map((s) => ({ lvl: Math.min(9, Math.max(1, num(s.lvl, 1))), max: num(s.max), left: num(s.left), spells: str(s.spells) })),
    daily: arr(k.daily).map((g) => ({ label: str(g.label, 40), items: arr(g.items).map((i) => ({ n: str(i.n, 200), max: num(i.max), left: num(i.left) })) })),
  };
}
function cleanSheet(h) {
  if (!obj(h)) return null;
  const pairs = (a) => arr(a).map((p) => [str(p[0], 60), str(p[1], 20)]);
  return {
    name: str(h.name, 120), cls: str(h.cls, 120), race: str(h.race, 120), ac: num(h.ac), max: num(h.max),
    initBonus: num(h.initBonus), dex: num(h.dex), speed: str(h.speed, 120), prof: str(h.prof, 10),
    ab: arr(h.ab).slice(0, 6).map((x) => num(x, 10)), saves: pairs(h.saves), saveNotes: str(h.saveNotes), skills: pairs(h.skills), senses: str(h.senses),
    attacks: arr(h.attacks).map((a) => ({ n: str(a.n, 120), hit: str(a.hit, 10), dmg: str(a.dmg, 120), notes: str(a.notes, 300) })),
    levels: arr(h.levels).map((l) => ({ lvl: num(l.lvl), max: num(l.max), spells: arr(l.spells).map((s) => ({ n: str(s.n, 120), src: str(s.src, 120), hit: str(s.hit, 20), time: str(s.time, 20), range: str(s.range, 60), dur: str(s.dur, 80), notes: str(s.notes, 200) })) })),
    spellDC: str(h.spellDC, 10), spellAtk: str(h.spellAtk, 10), spellAbility: str(h.spellAbility, 10), features: str(h.features, 20000),
    casting: cleanCasting(h.casting), res: cleanRes(h.res),
  };
}
const cleanRes = (r) => arr(r).map((x) => ({ n: str(x.n, 80), max: num(x.max), left: num(x.left), rest: x.rest === "Short Rest" ? "Short Rest" : "Long Rest" }));
const cleanDs = (ds) => (obj(ds) ? { s: num(ds.s), f: num(ds.f), stable: !!ds.stable, dead: !!ds.dead } : null);

/** Duur van een conditie of effect */
const cleanDur = (e) => ({ kind: str(e.kind, 10), who: str(e.who, 40), at: e.at === "end" ? "end" : "start", count: num(e.count),
  ...(obj(e.save) ? { save: { ab: str(e.save.ab, 3), dc: num(e.save.dc) } } : {}),
  ...(e.by ? { by: str(e.by, 40), spell: str(e.spell, 120), cast: str(e.cast, 60) } : {}) }); // conditie van een concentratie-spell (spellcast.js)
const lim = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(num(v))));
/** Tijdelijk effect (js/rules/effects.js) */
const cleanEff = (e) => {
  const st = ["ac", "max"].includes(e.st) ? e.st : "";
  return { id: str(e.id, 40) || Math.random().toString(36).slice(2, 9), n: str(e.n, 60) || "Effect", st,
    op: st === "ac" && ["+", "=", "min"].includes(e.op) ? e.op : "+", v: st === "ac" ? lim(e.v, -20, 40) : st ? lim(e.v, -999, 999) : 0, txt: str(e.txt, 120), end: str(e.end, 120),
    d: obj(e.d) ? cleanDur(e.d) : null, lr: !!e.lr, by: e.by ? str(e.by, 40) : null, spell: e.spell ? str(e.spell, 120) : null, ...(e.by && e.cast ? { cast: str(e.cast, 60) } : {}), hpd: st === "max" ? lim(e.hpd, -9999, 9999) : 0 };
};

export function cleanCombatant(c) {
  const kind = ["pc", "monster", "lair"].includes(c.kind) ? c.kind : "monster";
  const out = {
    id: str(c.id, 40) || Math.random().toString(36).slice(2, 9), name: str(c.name, 120), kind,
    init: num(c.init), dex: num(c.dex), cond: arr(c.cond).filter((x) => CONDS.includes(x)),
  };
  if (kind === "lair") return { ...out, key: str(c.key || c.name, 120), last: c.last ? str(c.last, 120) : null };
  Object.assign(out, {
    hidden: kind === "monster" && c.hidden ? true : undefined,
    grp: kind === "monster" && typeof c.grp === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(c.grp) ? c.grp : undefined,
    ac: num(c.ac), hp: num(c.hp), max: num(c.max), temp: num(c.temp), reaction: !!c.reaction,
    pid: c.pid ? str(c.pid, 40) : null, ddbId: /^[1-9]\d{0,11}$/.test(String(c.ddbId)) ? String(c.ddbId) : undefined, race: typeof c.race === "string" ? str(c.race, 120) : undefined, img: (kind === "pc" && cleanImg(c.img)) || undefined, ref: c.ref ? str(c.ref, 120) : undefined, roll: c.roll != null ? num(c.roll) : undefined,
    initBonus: c.initBonus != null ? num(c.initBonus) : undefined, concSpell: c.concSpell ? str(c.concSpell, 120) : null,
    ds: cleanDs(c.ds), la: counter(c.la), lr: counter(c.lr),
    rc: c.rc === undefined ? undefined : arr(c.rc).map((r) => ({ n: str(r.n, 120), min: r.min == null ? null : num(r.min), rest: !!r.rest, ready: !!r.ready })),
    casting: c.casting === undefined ? undefined : cleanCasting(c.casting), res: cleanRes(c.res), sheet: cleanSheet(c.sheet),
  });
  if (obj(c.cd)) {
    out.cd = {};
    for (const [n, e] of Object.entries(c.cd)) if (CONDS.includes(n) && obj(e)) out.cd[n] = cleanDur(e);
  }
  if (Array.isArray(c.eff)) out.eff = c.eff.filter(obj).slice(0, 40).map(cleanEff);
  return out;
}

/** Bestand → schone data, of een Error met een leesbare melding */
export function parseImport(json) {
  if (!obj(json) || json.format !== FORMAT) throw new Error("Dit is geen export van Initiative Tafel.");
  if (num(json.version) > VERSION) throw new Error("Deze export komt uit een nieuwere versie van de app. Werk de app eerst bij.");
  // Hier komen migraties per versie, bijv.: if (json.version === 1) json = migrate1to2(json);
  const S = obj(json.state) || { list: [], round: 0, active: null };
  const lairs = {};
  for (const [k, v] of Object.entries(obj(json.lairs) || {})) lairs[str(k, 120)] = arr(v).map((a) => ({ n: str(a.n, 120), t: str(a.t, 4000) }));
  return {
    S: {
      list: arr(S.list).map(cleanCombatant), round: Math.max(0, num(S.round)), active: S.active ? str(S.active, 40) : null, sample: false,
      log: arr(S.log).slice(-600).map((e) => ({ id: str(e.id, 40), r: num(e.r), turn: str(e.turn, 120), type: ["round", "turn"].includes(e.type) ? e.type : "", msg: str(e.msg, 1000), why: str(e.why, 1000), note: str(e.note, 1000) })),
    },
    party: arr(json.party).map((m) => ({ ...cleanCombatant({ ...m, kind: "pc", id: m.pid }), pid: str(m.pid, 40) })).map(({ id, kind, init, cond, reaction, ...m }) => m),
    lairs,
    custom: arr(json.custom).filter((m) => obj(m) && m.n).map((m) => ({ ...sanitizeOwn(m), custom: true })),
    imported: arr(json.imported).filter((m) => obj(m) && m.n).map(sanitizeOwn),
  };
}
