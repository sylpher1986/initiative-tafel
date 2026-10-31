// Gedeelde dobbelsteenweergave (G7, js/dice/view.js), voor alle Kev’s Inn-tools. Sleutels beginnen met "dice.".
// De notatie zelf (d20, 2d10, +6) is taalneutraal en staat niet in de catalogus (docs/i18n.md §4).
// Na een wijziging: node tools/i18n-build.mjs. Engelse tekst nagelezen door de vertaalagent (V6).
export default {
  "dice.nat20": "nat 20", // achter de tellende d20
  "dice.nat1": "nat 1",
  "dice.crit": "crit", // voor de extra crit-dice (CSS zet hoofdletters)
  "dice.no": "not counted", // schermlezer: de d20 die bij advantage/disadvantage niet telt
  "dice.total": "total", // schermlezer, midden in de zin: "…; total 25 vs AC 16"
  "dice.sum": "Total", // somregel onder meerdere schadedelen
  "dice.vs": "vs {k} {n}", // op het scherm; k = AC of DC (afkortingen, taalneutraal)
  "dice.vsSr": "vs {k} {n}", // schermlezer (NL: "tegen", "vs" klinkt als "vee es")
};
