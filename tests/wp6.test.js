// WP6: spelersscherm op de telefoon (SC5 "Dit ben ik", SC8 teksten) en GV12 (reaction gebruikt zichtbaar).
import "./_nl.js"; // WP27: Nederlandse catalogus voor descriptoren
import { test } from "node:test";
import assert from "node:assert/strict";
import { toPlayerView, cleanView, findMe, meState, buzzFor, dsText, headHtml, REACT_TAG, VIS } from "../js/playerview.js";
import { reactUsed } from "../js/rules/turns.js";

const pc = (o) => ({ kind: "pc", cond: [], dex: 0, ac: 15, hp: 20, max: 20, ...o });
const mon = (o) => ({ kind: "monster", cond: [], dex: 0, ac: 13, hp: 10, max: 10, ref: "Goblin", ...o });
const S = (list, extra = {}) => ({ list, round: 1, active: list[0]?.id ?? null, ...extra });

test("GV12 reactUsed: gebruikt, niet verrast, niet neer, spelers volgens de instelling", () => {
  const s = { round: 1 };
  assert.equal(reactUsed(pc({ reaction: true }), s), true);
  assert.equal(reactUsed(pc({ reaction: false }), s), false);
  assert.equal(reactUsed(pc({ reaction: true }), s, false), false, "Spelers zelf: niet bij spelers");
  assert.equal(reactUsed(mon({ reaction: true }), s, false), true, "monsters altijd");
  assert.equal(reactUsed(mon({ reaction: true, sur: true }), s), false, "verrast heeft een eigen badge");
  assert.equal(reactUsed(mon({ reaction: true, sur: true }), { round: 2 }), true);
  assert.equal(reactUsed(pc({ reaction: true, hp: 0 }), s), false, "op 0 HP geen reaction-chip");
});

test("GV12 spelersscherm: 'Reaction op' als tag, volgt Condities en GV4", () => {
  const list = [pc({ id: "a", name: "A", init: 15, reaction: true }), mon({ id: "b", name: "Goblin 1", init: 10, reaction: true })];
  let V = toPlayerView(S(list));
  assert.deepEqual(V.list.map((c) => c.tags), [[REACT_TAG], [REACT_TAG]]);
  V = toPlayerView(S(list), undefined, VIS, null, { pcReact: false });
  assert.deepEqual(V.list.map((c) => c.tags), [[], [REACT_TAG]]);
  V = toPlayerView(S(list), undefined, { ...VIS, tags: "pc" });
  assert.deepEqual(V.list.map((c) => c.tags), [[REACT_TAG], []]);
  V = toPlayerView(S(list), undefined, { ...VIS, tags: "none" });
  assert.deepEqual(V.list.map((c) => c.tags), [[], []]);
  assert.deepEqual(cleanView(JSON.parse(JSON.stringify(toPlayerView(S(list))))).list[0].tags, [REACT_TAG]);
});

test("SC8: speler op 0 HP zonder dubbele 'Unconscious', monster en levende speler houden hun condities", () => {
  const V = toPlayerView(S([
    pc({ id: "a", name: "A", hp: 0, cond: ["Unconscious", "Prone"], ds: { s: 1, f: 0 } }),
    pc({ id: "b", name: "B", cond: ["Unconscious"] }), // slaapt (Sleep) maar heeft HP
    mon({ id: "c", name: "Goblin", cond: ["Unconscious"] }),
  ]));
  assert.deepEqual(V.list.map((c) => c.tags), [["Prone"], ["Unconscious"], ["Unconscious"]]);
  assert.equal(V.list[0].hp.st, "Bewusteloos");
});

test("SC8: death saves in woorden", () => {
  assert.equal(dsText({ s: 0, f: 0 }), "Death saves: nog geen worp");
  assert.equal(dsText({ s: 1, f: 2 }), "Death saves: 1 gelukt · 2 mislukt");
  assert.equal(dsText({ s: 0, f: 1 }), "Death saves: 0 gelukt · 1 mislukt");
});

test("SC5: slots, daily en resources alleen bij spelers, opgeschoond", () => {
  const V = toPlayerView(S([
    pc({ id: "a", name: "A", casting: { slots: [{ lvl: 1, max: 4, left: 2, spells: ["x"] }, { lvl: 2, max: 0, left: 0 }], daily: [{ label: "1/day", items: [{ n: "Misty Step", max: 1, left: 0 }] }] }, res: [{ n: "Ki", max: 5, left: 3 }] }),
    pc({ id: "b", name: "B" }),
    mon({ id: "c", name: "Mage", casting: { slots: [{ lvl: 1, max: 4, left: 4 }], daily: [] } }),
  ]));
  assert.deepEqual(V.list[0].sl, { s: [{ l: 1, left: 2, max: 4 }], d: [{ n: "Misty Step", left: 0, max: 1 }], r: [{ n: "Ki", left: 3, max: 5 }] });
  assert.equal(V.list[1].sl, undefined, "geen slots: niets meesturen");
  assert.equal(V.list[2].sl, undefined, "monsterslots blijven geheim");
  assert.ok(!JSON.stringify(V).includes("spells"), "geen spellijst in de snapshot");
  const back = cleanView(JSON.parse(JSON.stringify(V)));
  assert.deepEqual(back.list[0].sl, V.list[0].sl);
});

test("SC5 cleanView: rare slots worden opgeschoond of weggelaten", () => {
  const raw = { v: 1, round: 1, list: [
    { id: "a", kind: "pc", name: "A", sl: { s: [{ l: 12, left: 1, max: 1 }, { l: 3, left: -4, max: 999 }, null, "x"], d: "nee", r: [{ n: "<b>Ki</b>".repeat(20), left: 2, max: 3 }, { n: "", left: 1, max: 1 }] } },
    { id: "b", kind: "pc", name: "B", sl: { s: [], d: [], r: [] } },
    { id: "c", kind: "monster", name: "M", sl: { s: [{ l: 1, left: 1, max: 1 }] } },
    { id: "d", kind: "pc", name: "D", sl: { s: Array.from({ length: 30 }, () => ({ l: 1, left: 1, max: 1 })) } },
  ] };
  const V = cleanView(raw);
  assert.deepEqual(V.list[0].sl.s, [{ l: 3, left: 0, max: 99 }]);
  assert.deepEqual(V.list[0].sl.d, []);
  assert.equal(V.list[0].sl.r.length, 1);
  assert.equal(V.list[0].sl.r[0].n.length, 40);
  assert.equal(V.list[1].sl, undefined);
  assert.equal(V.list[2].sl, undefined, "monsters hebben geen sl");
  assert.equal(V.list[3].sl.s.length, 12);
});

test("SC5 findMe: op id, anders op exacte naam, nooit een monster", () => {
  const V = { v: 1, round: 1, list: [{ id: "x", kind: "pc", name: "Aria" }, { id: "m", kind: "monster", name: "Bram" }] };
  assert.equal(findMe(V, { id: "x", name: "Oud" }).id, "x");
  assert.equal(findMe(V, { id: "weg", name: "Aria" }).id, "x", "DM zette hem opnieuw aan tafel");
  assert.equal(findMe(V, { id: "m", name: "Bram" }), null, "monster met dezelfde id/naam telt niet");
  assert.equal(findMe(V, { id: "weg", name: "" }), null);
  assert.equal(findMe(V, null), null);
  assert.equal(findMe(null, { id: "x" }), null);
});

test("SC5 meState en headHtml: jij aan de beurt, daarna jij, buiten een gevecht niets", () => {
  const V = { v: 1, round: 2, active: "a", next: "b", list: [{ id: "a", kind: "pc", name: "Aria" }, { id: "b", kind: "pc", name: "Bram" }] };
  assert.equal(meState(V, "a"), "turn");
  assert.equal(meState(V, "b"), "next");
  assert.equal(meState(V, "c"), "");
  assert.equal(meState({ ...V, round: 0 }, "a"), "");
  assert.equal(meState({ ...V, active: "g1", group: ["g1", "a"] }, "a"), "turn");
  assert.match(headHtml(V, "a"), /Jij bent aan de beurt/);
  assert.match(headHtml(V, "a"), /Ronde 2/);
  const h = headHtml(V, "b");
  assert.match(h, /class="r me"/);
  assert.match(h, /Aria/);
  assert.doesNotMatch(h, /Bram/);
  assert.equal(headHtml(V), headHtml(V, null));
  assert.match(headHtml({ ...V, round: 0 }, "a"), /Wacht op de DM/);
});

test("SC5 buzzFor: alleen bij een overgang, nooit bij de eerste stand", () => {
  assert.equal(buzzFor(null, "turn"), null, "eerste stand na laden/herverbinden");
  assert.equal(buzzFor("turn", "turn"), null);
  assert.deepEqual(buzzFor("", "turn"), [200, 100, 200]);
  assert.deepEqual(buzzFor("next", "turn"), [200, 100, 200]);
  assert.deepEqual(buzzFor("", "next"), [60]);
  assert.equal(buzzFor("turn", ""), null);
});

test("SC5 randgevallen: dubbele namen, anoniem monster met slots, groep, zonder opts", () => {
  const V = { v: 1, round: 1, list: [{ id: "a", kind: "pc", name: "Kim" }, { id: "b", kind: "pc", name: "Kim" }] };
  assert.equal(findMe(V, { id: "weg", name: "Kim" }).id, "a", "dubbele naam: de eerste (id wint als die er is)");
  assert.equal(findMe(V, { id: "b", name: "Kim" }).id, "b");
  const W = toPlayerView(S([mon({ id: "m", name: "Mage", anon: 1, casting: { slots: [{ lvl: 1, max: 4, left: 4 }], daily: [] } })]));
  assert.equal(W.list[0].sl, undefined);
  const G = { v: 1, round: 1, active: "g1", group: ["g1", "a"], gname: "Groep ×2", list: [{ id: "g1", kind: "monster", name: "X" }, { id: "a", kind: "pc", name: "Aria" }] };
  assert.match(headHtml(G, "a"), /Jij bent aan de beurt/);
  const list = [pc({ id: "a", name: "A", reaction: true })];
  assert.deepEqual(toPlayerView(S(list)).list[0].tags, toPlayerView(S(list), undefined, VIS, null, { pcReact: true }).list[0].tags);
});

test("SC5 + SC2b: verborgen beurt na 'jij' houdt de kop vast, zonder vlag die het verraadt", () => {
  const list = [pc({ id: "a", name: "A", init: 20 }), mon({ id: "h", name: "Lurker", init: 15, hidden: true }), pc({ id: "b", name: "B", init: 10 })];
  const V = toPlayerView(S(list, { active: "h" }), undefined, VIS, { id: "a", round: 1 });
  assert.equal(V.active, "a");
  assert.equal(meState(V, "a"), "turn");
  assert.deepEqual(Object.keys(V).sort(), ["active", "list", "next", "round", "tg", "v"], "geen extra veld dat een verborgen beurt verraadt (tg = vaste instelling)");
});
