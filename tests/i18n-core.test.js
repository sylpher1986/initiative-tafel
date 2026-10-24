// Meertaligheid WP19 (TA3): vertaalfunctie t, meervoud, formatters, terugval op Engels, descriptoren.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createI18n, MAX_DEPTH } from "../js/i18n/core.js";
import { M, isMsg } from "../js/i18n/msg.js";

const catalogs = {
  en: {
    "common.close": "Close",
    "x.turn": "{name}'s turn",
    "x.monsters": { one: "{n} monster", other: "{n} monsters" },
    "x.xp": "{xp} XP",
    "x.only.en": "Only in English",
    "x.save": "Save expired: {who} · {cond} remains",
    "x.cond": "{name} remains",
    "x.list": "Missing initiative: {names}",
  },
  nl: {
    "common.close": "Sluit",
    "x.turn": "Beurt van {name}",
    "x.monsters": { one: "{n} monster", other: "{n} monsters" },
    "x.xp": "{xp} XP",
    "x.save": "Save vervallen: {who} · {cond}",
    "x.cond": "{name} blijft",
    "x.list": "Nog geen initiative voor: {names}",
  },
};

test("t: actieve taal, interpolatie, terugval op Engels, anders de sleutel", () => {
  const nl = createI18n({ lang: "nl", catalogs });
  assert.equal(nl.t("common.close"), "Sluit");
  assert.equal(nl.t("x.turn", { name: "Aram" }), "Beurt van Aram");
  assert.equal(nl.t("x.only.en"), "Only in English");
  assert.equal(nl.t("x.nergens"), "x.nergens");
  assert.deepEqual(nl.missing(), ["x.only.en", "x.nergens"]);
  const en = createI18n({ lang: "en", catalogs });
  assert.equal(en.t("x.turn", { name: "Aram" }), "Aram's turn");
  assert.deepEqual(en.missing(), []);
});

test("t: onbekende of lege placeholder blijft zichtbaar, 0 en lege tekst worden ingevuld", () => {
  const { t } = createI18n({ lang: "nl", catalogs });
  assert.equal(t("x.turn"), "Beurt van {name}");
  assert.equal(t("x.turn", { naam: "Aram" }), "Beurt van {name}");
  assert.equal(t("x.turn", { name: null }), "Beurt van {name}");
  assert.equal(t("x.turn", { name: 0 }), "Beurt van 0");
  assert.equal(t("x.turn", { name: "" }), "Beurt van ");
});

test("t escapet niet: de aanroeper gebruikt esc() (waarde komt letterlijk door)", () => {
  const { t } = createI18n({ lang: "nl", catalogs });
  assert.equal(t("x.turn", { name: "<b>" }), "Beurt van <b>");
});

test("meervoud op params.n, met Intl.PluralRules en zonder (oudere Safari)", () => {
  for (const intl of [globalThis.Intl, {}]) {
    const { t } = createI18n({ lang: "nl", catalogs, intl });
    assert.equal(t("x.monsters", { n: 1 }), "1 monster");
    assert.equal(t("x.monsters", { n: 0 }), "0 monsters");
    assert.equal(t("x.monsters", { n: 3 }), "3 monsters");
    assert.equal(t("x.monsters"), "{n} monsters", "zonder n: other");
  }
});

test("meervoud: ontbrekende categorie valt terug op other", () => {
  const { t } = createI18n({ lang: "nl", catalogs: { en: {}, nl: { k: { other: "{n} keer" } } } });
  assert.equal(t("k", { n: 1 }), "1 keer");
});

test("getallen, datums, tijd en opsomming in de taal", () => {
  const nl = createI18n({ lang: "nl", catalogs, locale: "nl-NL" });
  const en = createI18n({ lang: "en", catalogs });
  assert.equal(nl.t("x.xp", { xp: 1950 }), "1.950 XP");
  assert.equal(en.t("x.xp", { xp: 1950 }), "1,950 XP");
  assert.equal(nl.num(0.5), "0,5");
  assert.equal(nl.num(NaN), "NaN");
  assert.equal(nl.list(["Aram", "Brom", "Noor"]), "Aram, Brom en Noor");
  assert.equal(en.list(["Aram", "Brom"]), "Aram and Brom");
  const d = new Date(2026, 9, 12, 21, 14);
  assert.match(nl.date(d), /12.*okt.*2026/);
  assert.match(en.date(d), /Oct.*12.*2026/);
  assert.equal(nl.time(d), "21:14");
  assert.equal(nl.date("geen datum"), "");
});

test("zonder Intl (of een kapotte locale): eenvoudige terugval, nooit een fout", () => {
  const bare = createI18n({ lang: "nl", catalogs, intl: {} });
  assert.equal(bare.num(1950), "1950");
  assert.equal(bare.list(["a", "b"]), "a, b");
  assert.equal(bare.date(new Date(Date.UTC(2026, 9, 12))), "2026-10-12");
  const odd = createI18n({ lang: "nl", catalogs, locale: "!!kapot!!" });
  assert.equal(odd.num(5), "5");
});

test("descriptoren: M maakt { k, p }, t vertaalt geneste descriptoren en arrays", () => {
  assert.deepEqual(M("x.turn"), { k: "x.turn" });
  assert.deepEqual(M("x.turn", {}), { k: "x.turn" });
  assert.deepEqual(M("x.turn", { name: "Aram" }), { k: "x.turn", p: { name: "Aram" } });
  assert.ok(isMsg(M("a")));
  for (const x of [null, "a", [], { k: "" }, { k: 1 }, ["x.turn"]]) assert.ok(!isMsg(x), JSON.stringify(x));
  const { t, tr } = createI18n({ lang: "nl", catalogs });
  const d = M("x.save", { who: "Lotte", cond: M("x.cond", { name: "Paralyzed" }) });
  assert.equal(tr(d), "Save vervallen: Lotte · Paralyzed blijft");
  assert.equal(t("x.list", { names: ["Aram", "Brom"] }), "Nog geen initiative voor: Aram en Brom");
  assert.equal(tr("oude tekst"), "oude tekst", "logregel van vóór de migratie: gewoon tekst");
  assert.equal(tr(null), "");
});

test("debugmodus: ontbrekend valt op met ⟦ ⟧ en onMissing meldt één keer per sleutel", () => {
  const seen = [];
  const { t } = createI18n({ lang: "nl", catalogs, debug: true, onMissing: (k, l, kind) => seen.push([k, l, kind]) });
  assert.equal(t("x.only.en"), "⟦Only in English⟧");
  assert.equal(t("x.nergens"), "⟦x.nergens⟧");
  assert.equal(t("common.close"), "Sluit");
  t("x.nergens");
  assert.deepEqual(seen, [["x.only.en", "nl", "fallback"], ["x.nergens", "nl", "none"]]);
});

test("een fout in onMissing breekt de vertaling niet", () => {
  const { t } = createI18n({ lang: "nl", catalogs, onMissing: () => { throw new Error("x"); } });
  assert.equal(t("x.only.en"), "Only in English");
});

test("sleutels als 'constructor' of '__proto__' bestaan niet (geen prototype-lekken)", () => {
  const { t, has } = createI18n({ lang: "nl", catalogs });
  assert.equal(t("constructor"), "constructor");
  assert.equal(t("__proto__"), "__proto__");
  assert.ok(!has("constructor"));
  assert.ok(has("x.only.en"));
});

test("onbekende taal of ontbrekende catalogi: Engels, en zonder catalogi de sleutel", () => {
  assert.equal(createI18n({ lang: "de", catalogs }).t("common.close"), "Close");
  assert.equal(createI18n({ lang: "nl" }).t("common.close"), "common.close");
  assert.equal(createI18n().t("a"), "a");
});

test("placeholders lezen alleen eigen waarden: {toString} en {constructor} blijven staan", () => {
  const { t } = createI18n({ lang: "nl", catalogs: { en: {}, nl: { k: "{constructor} {toString} {__proto__} {name}" } } });
  assert.equal(t("k", { name: "Aram" }), "{constructor} {toString} {__proto__} Aram");
  assert.equal(t("k", "geen object"), "{constructor} {toString} {__proto__} {name}");
});

test("geneste descriptoren: een lus of te diepe nesting stopt, geen stack overflow", () => {
  const { t, tr } = createI18n({ lang: "nl", catalogs: { en: {}, nl: { a: "<{x}>" } } });
  const loop = { k: "a", p: {} }; loop.p.x = loop;
  const s = tr(loop);
  const n = (s.match(/</g) || []).length;
  assert.ok(n > 1 && n <= MAX_DEPTH + 2, `begrensd op ± MAX_DEPTH niveaus, kreeg ${n}`);
  assert.ok(s.includes(">"));
  let deep = "eind"; for (let i = 0; i < 20000; i++) deep = [deep];
  assert.doesNotThrow(() => t("a", { x: deep }));
});

test("time() zonder Intl geeft HH:MM, date(null) en date('') geven niets, -0 wordt 0", () => {
  const bare = createI18n({ lang: "nl", catalogs, intl: {} });
  assert.equal(bare.time(new Date(2026, 9, 12, 9, 5)), "09:05");
  const nl = createI18n({ lang: "nl", catalogs });
  assert.equal(nl.date(null), "");
  assert.equal(nl.date(""), "");
  assert.equal(nl.time(undefined), "");
  assert.equal(nl.num(-0), "0");
});

test("taal __proto__ of constructor lekt geen catalogus", () => {
  assert.equal(createI18n({ lang: "__proto__", catalogs }).t("common.close"), "Close");
  assert.equal(createI18n({ lang: "constructor", catalogs }).t("hasOwnProperty"), "hasOwnProperty");
});
