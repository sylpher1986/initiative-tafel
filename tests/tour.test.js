import test from "node:test";
import assert from "node:assert/strict";
import { STOPS, seen, withSeen, silenceFor, placeTip, unionRect } from "../js/tour.js";

test("tour: gezien-delen lezen en bijwerken", () => {
  assert.deepEqual([...seen(null)], []);
  assert.deepEqual([...seen("fpx")].sort(), ["f", "p"]);
  assert.equal(withSeen(null, "p"), "p");
  assert.equal(withSeen("f", "p"), "pf");
  assert.equal(withSeen("pf", "f"), "pf");
  assert.equal(withSeen("rommel", "f"), "f");
});

test("tour: bestaande gebruiker met data krijgt hem niet vanzelf", () => {
  assert.equal(silenceFor(null, true), "pf");
  assert.equal(silenceFor(null, false), ""); // nieuw apparaat: vastleggen dat er nog niets gezien is (herladen zet hem dan niet stil)
  assert.equal(silenceFor("p", true), null);   // al eerder gezien: niets veranderen
  assert.equal(silenceFor("", true), null);
});

test("tour: uitlegvak boven doelen onderin, eronder bij doelen bovenin, altijd binnen het scherm", () => {
  const vw = 360, vh = 740, w = 320, h = 140;
  const dock = placeTip({ top: 680, bottom: 730, left: 200, right: 344 }, vw, vh, w, h);
  assert.equal(dock.above, true);
  assert.equal(dock.y, 680 - 12 - h);
  assert.equal(dock.x, 360 - 320 - 16); // rechts vastgeklemd
  const head = placeTip({ top: 10, bottom: 90, left: 16, right: 200 }, vw, vh, w, h);
  assert.equal(head.above, false);
  assert.equal(head.y, 102);
  assert.equal(head.x, 16);
  // doel net onder de rand: vak blijft in beeld
  const low = placeTip({ top: 700, bottom: 760, left: 0, right: 50 }, vw, vh, w, h);
  assert.ok(low.y >= 16 && low.y + h <= vh - 16);
  // heel klein scherm: geen negatieve positie
  const tiny = placeTip({ top: 10, bottom: 20, left: 0, right: 10 }, 200, 120, 320, 140);
  assert.equal(tiny.x, 16); assert.equal(tiny.y, 16);
});

test("tour: één kader om twee knoppen", () => {
  const r = unionRect([{ top: 10, left: 10, bottom: 50, right: 60 }, { top: 12, left: 70, bottom: 52, right: 120 }]);
  assert.deepEqual(r, { top: 6, left: 6, bottom: 56, right: 124, width: 118, height: 50 });
});

test("tour: stops hebben selectors, een korte titel en tekst (WP26: sleutels; per taal gecontroleerd)", async () => {
  const cats = { en: (await import("../locales/en.js")).default, nl: (await import("../locales/nl.js")).default };
  for (const part of ["p", "f"]) for (const s of STOPS[part]) {
    assert.ok(s.sel.length >= 1);
    for (const [l, c] of Object.entries(cats)) {
      assert.ok(c[s.t] && c[s.t].split(" ").length <= 4, `${l} ${s.t}: ${c[s.t]}`);
      assert.ok(c[s.x] && c[s.x].length <= 120, `${l} ${s.x}: ${c[s.x]}`);
    }
  }
});
