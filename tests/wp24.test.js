// WP24 (TA8): helpers voor vertaalde tekst in HTML
import { test } from "node:test";
import assert from "node:assert/strict";
import { initI18n } from "../js/i18n/boot.js";
import { tb, undoBtn } from "../js/ui/util.js";

await initI18n({ doc: { documentElement: { lang: "nl" } }, search: "", storage: null });

test("tb: naam vet en geëscapet, ook met $-patronen en HTML", () => {
  assert.equal(tb("init.pc.mHere", {}, "Bob$`x"), "<b>Bob$`x</b> staat in de party en zit al aan tafel.");
  assert.equal(tb("init.pc.mHere", {}, "A$&B"), "<b>A$&amp;B</b> staat in de party en zit al aan tafel.");
  assert.equal(tb("init.party.updQ", {}, "<i>x</i>"), "<b>&lt;i&gt;x&lt;/i&gt;</b> bijwerken van D&amp;D Beyond?");
  assert.match(tb("init.pc.mSeat", { hp: " (3/9 HP)", name: "<x>" }, "<x>"), /^<b>&lt;x&gt;<\/b> staat al in de party \(3\/9 HP\)\. Toevoegen zet &lt;x&gt; aan tafel/);
});

test("undoBtn: knop met de vertaalde tekst", () => {
  assert.equal(undoBtn(), '<button class="tundo" id="toast-undo">Ongedaan</button>');
});
