// Spelersscherm (speler.html, js/speler.js, js/playerview.js; WP28).
// Sleutels beginnen met "player." (tests/i18n.test.js). Zelfde sleutels in elke taal; Engels is de terugval.
// Na een wijziging: node tools/i18n-build.mjs (maakt locales/<taal>.js, dat de app laadt).
// Engelse tekst: D&D 5e (2014)-termen zoals in de PHB/SRD; nagelezen door de vertaalagent (docs/i18n.md §0, V6).
export default {
  "player.who": "Who are you?", // knop; js/speler.js zet daarna "Jij: …"
  "player.full": "Full screen",
  "player.log": "What just happened", // aria-label van de laatste regels
  "player.me": "Your character", // aria-label van de eigen kaart
  "player.qr": "Follow along on your phone", // aria-label van de QR-code op de tv
  "player.wait": "Waiting for the DM screen…",
  "player.code": "Room code", // label bij het invoerveld
  "player.follow": "Join", // knop naast de code
  "player.joinHint": "Or open Kev’s Inn itiative in another window of this browser.",
  // WP28: alles wat het spelersscherm zelf schrijft (de snapshot bevat codes, zie js/playerview.js)
  "player.anon": "Unknown creature", // monster met verborgen naam; ook in de DM-app (uitleg bij + Monster)
  "player.anonN": "Unknown creature {n}", // als spelers er meer zien
  "player.lair": "Lair",
  "player.head.round": "Round {n}",
  "player.head.roundTurn": "Round {n} · up now",
  "player.head.next": "Up next",
  "player.head.nextMe": "you", // "Up next: you"
  "player.head.myTurn": "It's your turn",
  "player.head.combat": "Combat",
  "player.head.begins": "Combat begins", // ronde 1, nog geen zichtbare beurt
  "player.head.over": "Combat over",
  "player.head.after": { one: "After {n} round", other: "After {n} rounds" },
  "player.head.done": "Done",
  "player.head.none": "No combat yet",
  "player.head.wait": "Waiting for the DM",
  "player.ds.none": "Death saves: no rolls yet",
  "player.ds.some": "Death saves: {s} succeeded · {f} failed",
  "player.log.down": "down", // "Goblin 1 down"
  "player.log.gone": "{what} ended", // "Aria: Prone ended"
  "player.row.me": "you", // badge bij je eigen personage
  "player.row.next": "next", // badge bij wie daarna komt
  "player.tagInfo": "{tag}: details", // aria-label van een tikbare conditie
  "player.down": "Down", // regel onderaan met dode monsters
  "player.meBtn": "You: {name}",
  "player.meMissing": "{name} isn't in the list right now.",
  "player.meNoName": "Your character",
  "player.meRepick": "Choose again",
  "player.slots": "Slots",
  "player.pick.title": "Which character are you?",
  "player.pick.empty": "There are no players in the list yet.",
  "player.pick.nobody": "Nobody, I'm just watching",
  "player.pick.buzz": "Vibrate when my turn is coming up",
  "player.cinfo.dur": "Duration",
  "player.cinfo.rep": "Repeat save",
  "player.qrLabel": "QR code to follow along, room {code}",
  "player.net.lost": "No connection",
  "player.net.since": "as of {time}", // achter "No connection · "
  "player.net.retry": "Reconnecting…",
  "player.net.dmAway": "The DM is away for a moment",
  "player.net.dmAwayHint": "Combat continues here as soon as the DM is back.",
  "player.net.lostLong": "No connection. Combat will show up here again once it's back.",
  "player.net.connected": "Connected, waiting for the DM…",
  "player.net.connecting": "Connecting to room {code}…",
  "player.room.ended": "The DM is no longer sharing with this code. Ask for the new code.",
  "player.room.gone": "Room {code} doesn't exist or has expired. Ask the DM for a new code.",
  "player.pause": "The DM isn't sharing right now.",
  "player.pauseHint": "Combat will show up here again as soon as the DM shares.",
  "player.room": "Room {code}",
  "player.noChannel": "This browser can't link a second window; enter the DM's room code.",
  "player.codeBad": "A code has 6 characters, for example K7M 3QX.",
};
