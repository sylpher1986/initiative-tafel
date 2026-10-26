// WP36 (HS12, HS13): speler/monster via vorm, HP-kleuren voor iedereen gelijk, rustiger open monsterkaart.
import "./_nl.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hpCls, hpPct } from "../js/ui/hpbar.js";
import { avatar, avBox, avKind } from "../js/ui/avatar.js";

const css = readFileSync(new URL("../css/app.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const render = readFileSync(new URL("../js/ui/render.js", import.meta.url), "utf8");
const speler = readFileSync(new URL("../js/speler.js", import.meta.url), "utf8");

test("HP-klasse: zelfde fractie geeft dezelfde klasse voor speler en monster (gezond, gewond, kritiek)", () => {
  const pc = (hp, max) => ({ kind: "pc", hp, max }), mon = (hp, max) => ({ kind: "monster", hp, max });
  for (const [hp, max, want] of [[20, 20, ""], [11, 20, ""], [10, 20, "mid"], [6, 20, "mid"], [5, 20, "low"], [0, 20, "low"], [-3, 20, "low"]]) {
    const a = pc(hp, max), b = mon(hp, max);
    assert.equal(hpCls(a.hp, a.max), want, `speler ${hp}/${max}`);
    assert.equal(hpCls(b.hp, b.max), hpCls(a.hp, a.max), `monster ${hp}/${max}`);
  }
  assert.equal(hpPct(5, 0), 1, "zonder max HP: vol"); assert.equal(hpPct(30, 20), 1, "boven max: niet breder dan de baan");
  // gezonde speler tegenover gezond monster, kritieke speler tegenover kritiek monster (andere max HP)
  assert.equal(hpCls(24, 24), hpCls(195, 195)); assert.equal(hpCls(3, 24), hpCls(40, 195));
});

test("HP-balk: render gebruikt alleen hpCls; geen kleur per soort op of naast de balk", () => {
  assert.match(render, /class="\$\{hpCls\(c\.hp, c\.max\)\}"/);
  assert.doesNotMatch(render, /pct <= 0\.25/, "geen tweede drempelregel in render");
  // spelersscherm en tv: zelfde helpers, geen eigen drempels (bij max 0 anders een lege kritieke balk tegenover een volle op de DM-kaart)
  assert.match(speler, /class="\$\{hpCls\(h\.hp, h\.max\)\}"/);
  assert.doesNotMatch(speler, /<= 0\.25/, "geen tweede drempelregel op het spelersscherm");
  // geen soort-selector op de balk, de baan, het HP-getal of de HP-knop (DM-kaart en spelersscherm)
  const bad = css.match(/[^{}]*\.(pc|mon|monster|av-pc|av-mon)\b[^{}]*\.(bar|hpw|hpn|khp|pvhp|thp)\b[^{}]*\{/g) || [];
  assert.deepEqual(bad.map((s) => s.trim()), []);
  // Forest/Copper bestaan niet als token of hex (geen identiteitskleur, nooit als kaartvlak)
  assert.doesNotMatch(css, /#4e6652|#a86442/i);
});

test("avatar: vorm hangt aan het soort, niet aan de plek; rand als buitenste laag", () => {
  assert.equal(avKind("pc"), "av-pc"); assert.equal(avKind("monster"), "av-mon"); assert.equal(avKind("lair"), "av-lair");
  assert.equal(avKind(undefined), "av-mon", "onbekend = monster (nooit de spelersvorm)");
  assert.match(avatar({ kind: "pc", race: "Elf" }), /^<span class="av av-pc" aria-hidden="true"><span class="avi"><svg/);
  assert.match(avatar({ kind: "monster" }, "Huge dragon, chaotic evil"), /class="av av-mon".*#m-dragon"/);
  assert.match(avatar({ kind: "monster" }, ""), /#m-monstrosity"/, "eigen monster zonder type: terugval-icoon");
  const img = "data:image/jpeg;base64,AAAA";
  assert.match(avatar({ kind: "pc", img }), /class="av av-pc img".*<img src="data:image\/jpeg/);
  assert.equal(avBox("lair", ""), '<span class="av av-lair" aria-hidden="true"><span class="avi"></span></span>');
  // spelersscherm via dezelfde helper; geen oude plek-selectors meer
  assert.match(speler, /avBox\(c\.kind, icon\(c\.icon\)\)/);
  assert.doesNotMatch(css, /\.c\.k\.mon \.av\b|\.pvc\.monster \.av\b|\.c\.k\.pc \.av\b|\.pvc\.pc \.av\b|\.pm \.av\b/);
  assert.match(css, /\.av\{[^}]*background:var\(--line-strong\)[^}]*border-radius:50%/, "neutrale rand, standaard rond");
  assert.match(css, /\.av-mon,\.av-mon \.avi\{border-radius:0;clip-path:polygon\(25% 0,75% 0,100% 25%,100% 75%,75% 100%,25% 100%,0 75%,0 25%\)\}/);
  assert.match(css, /\.c\.k\.mon::before\{background:var\(--mon\)\}/, "zijstreep monsters blijft (alleen DM-lijst)");
  assert.match(css, /\.hpn\{[^}]*min-width:7ch/, "HP-getal 7ch: balken even lang tot 999/999");
});

test("open monsterkaart (HS13): legendary-label en pips op één regel, volledig label voor de schermlezer", () => {
  assert.match(render, /pips\(c\.lr, "lr", "Legendary resistance", t\("init\.card\.lrPer"\)\)/);
  assert.match(render, /pipState\(full, i, o\)/);
  assert.match(css, /\.pips\{display:flex;[^}]*min-height:44px/);
  assert.match(css, /\.pips \.pg\{[^}]*margin-left:auto/);
});
