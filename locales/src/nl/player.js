// Spelersscherm (speler.html, js/speler.js, js/playerview.js; WP28).
// Sleutels beginnen met "player." (tests/i18n.test.js). Zelfde sleutels in elke taal; Engels is de terugval.
// Na een wijziging: node tools/i18n-build.mjs (maakt locales/<taal>.js, dat de app laadt).
export default {
  "player.who": "Wie ben jij?", // knop; js/speler.js zet daarna "Jij: …"
  "player.full": "Volledig scherm",
  "player.map": "Kaart",
  "player.log": "Wat er net gebeurde", // aria-label van de laatste regels
  "player.me": "Jouw personage", // aria-label van de eigen kaart
  "player.qr": "Meekijken op je telefoon", // aria-label van de QR-code op de tv
  "player.wait": "Wacht op het DM-scherm…",
  "player.code": "Code van de DM", // label bij het invoerveld
  "player.follow": "Volg", // knop naast de code
  "player.joinHint": "Of open Kev’s Inn itiative in een ander venster van deze browser.",
  // WP28: alles wat het spelersscherm zelf schrijft (de snapshot bevat codes, zie js/playerview.js)
  "player.anon": "Onbekend wezen", // monster met verborgen naam; ook in de DM-app (uitleg bij + Monster)
  "player.anonN": "Onbekend wezen {n}", // als spelers er meer zien
  "player.lair": "Lair",
  "player.head.round": "Ronde {n}",
  "player.head.roundTurn": "Ronde {n} · aan de beurt",
  "player.head.next": "Daarna",
  "player.head.nextMe": "jij", // "Daarna jij"
  "player.head.myTurn": "Jij bent aan de beurt",
  "player.head.combat": "Gevecht",
  "player.head.begins": "Gevecht begint", // ronde 1, nog geen zichtbare beurt
  "player.head.over": "Gevecht voorbij",
  "player.head.after": { one: "Na {n} ronde", other: "Na {n} rondes" },
  "player.head.done": "Klaar",
  "player.head.none": "Nog geen gevecht",
  "player.head.wait": "Wacht op de DM",
  "player.ds.none": "Death saves: nog geen worp",
  "player.ds.some": "Death saves: {s} gelukt · {f} mislukt",
  "player.log.down": "neer", // "Goblin 1 neer"
  "player.log.gone": "{what} voorbij", // "Aria: Prone voorbij" (zoals log.ends)
  "player.row.me": "jij", // badge bij je eigen personage
  "player.row.next": "volgende", // badge bij wie daarna komt
  "player.tagInfo": "{tag}: uitleg", // aria-label van een tikbare conditie
  "player.down": "Neer", // regel onderaan met dode monsters
  "player.meBtn": "Jij: {name}",
  "player.meMissing": "{name} staat nu niet in de lijst.",
  "player.meNoName": "Je personage",
  "player.meRepick": "Kies opnieuw",
  "player.slots": "Slots",
  "player.pick.title": "Welk personage ben jij?",
  "player.pick.empty": "Er staan nog geen spelers in de lijst.",
  "player.pick.nobody": "Niemand, ik kijk alleen mee",
  "player.pick.buzz": "Trillen als ik bijna aan de beurt ben",
  "player.cinfo.dur": "Duur",
  "player.cinfo.rep": "Herhaalsave",
  "player.qrLabel": "QR-code om mee te kijken, kamer {code}",
  "player.net.lost": "Geen verbinding",
  "player.net.since": "stand van {time}", // achter "Geen verbinding · "
  "player.net.retry": "Opnieuw verbinden…",
  "player.net.dmAway": "De DM is even weg",
  "player.net.dmAwayHint": "Het gevecht gaat hier verder zodra de DM terug is.",
  "player.net.lostLong": "Geen verbinding. Zodra die terug is, verschijnt het gevecht hier vanzelf.",
  "player.net.connected": "Verbonden, wacht op de DM…",
  "player.net.connecting": "Verbinden met kamer {code}…",
  "player.room.ended": "De DM deelt niet meer met deze code. Vraag de nieuwe code.",
  "player.room.gone": "Kamer {code} bestaat niet (meer). Vraag de DM om een nieuwe code.",
  "player.pause": "De DM deelt op dit moment niet.",
  "player.pauseHint": "Zodra de DM weer deelt, verschijnt het gevecht hier vanzelf.",
  "player.room": "Kamer {code}",
  "player.noChannel": "Deze browser kan geen tweede venster koppelen; vul de code van de DM in.",
  "player.codeBad": "Een code heeft 6 tekens, bijvoorbeeld K7M 3QX.",
};
