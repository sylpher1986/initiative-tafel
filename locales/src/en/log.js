// Logboekregels uit js/log.js (WP27).
// Sleutels beginnen met "log." (tests/i18n.test.js). Zelfde sleutels in elke taal; Engels is de terugval.
// Na een wijziging: node tools/i18n-build.mjs (maakt locales/<taal>.js, dat de app laadt).
// Engelse tekst: D&D 5e (2014)-termen zoals in de PHB/SRD; nagelezen door de vertaalagent (docs/i18n.md §0, V6).
export default {
  "log.round": "Round {n} begins",
  "log.stopped": "Combat stopped",
  "log.turn": "{name}'s turn",
  "log.joins": "{name} joins",
  "log.joinsInit": "{name} joins (initiative {init})",
  "log.hidden": "hidden from players",
  "log.shown": "visible to players",
  "log.anon": "name hidden from players",
  "log.named": "name shown to players",
  "log.changes": "{name}: {what}", // what = wijzigingen, met komma's
  "log.renamed": "renamed from {name}",
  "log.ac": "AC {a} → {b}",
  "log.pas": "passive {a} → {b}",
  "log.fromSheet": "from the sheet",
  "log.maxHp": "max HP {a} → {b}",
  "log.init": "initiative {v}",
  "log.initCh": "initiative {a} → {b}",
  "log.renew": "{name} refreshed",
  "log.gets": "gets {name}", // effect of conditie
  "log.getsX": "gets {name} ({x})",
  "log.ends": "{name} ends",
  "log.hp": "{a} → {b} HP ({d})",
  "log.temp": "temp HP {a} → {b}",
  "log.concOn": "concentrates on {spell}",
  "log.concEnd": "concentration ends",
  "log.concEndOn": "concentration on {spell} ends",
  "log.concNow": "now concentrates on {spell}",
  "log.concNowWas": "now concentrates on {spell} (was {old})",
  "log.sur": "surprised (no turn in round 1)",
  "log.surOff": "no longer surprised",
  "log.react": "reaction used",
  "log.slotUsed": "{lv}-level slot used ({n}/{max} left)",
  "log.slotBack": "{lv}-level slot back ({n}/{max})",
  "log.pactUsed": "Pact slot used ({n}/{max} left)",
  "log.pactBack": "Pact slot back ({n}/{max})",
  "log.dailyUsed": "{name} used ({n}/{max} {per})", // per = 3/day uit het statblock
  "log.resUsed": "{name} used ({n}/{max})",
  "log.resBack": "{name} restored ({n}/{max})",
  "log.la": "legendary action used ({n}/{max} left)",
  "log.lr": "legendary resistance used ({n}/{max} left)",
  "log.rcUsed": "{name} used",
  "log.rcBack": "{name} available again",
  "log.dsS": "death save: success ({n}/3)",
  "log.dsF": "death save: failure ({n}/3)",
  "log.dies": "dies",
  "log.stable": "is stable",
  "log.up": "gets back up",
  "log.lair": "lair action: {name}",
  "log.removed": "{name} removed",
  "log.r": "R{n}", // ronde-label van een logregel
  "log.prep": "Prep", // ronde-label vóór het gevecht
  "log.undoW": "Undo: {what}", // melding na Ongedaan
  "log.redoW": "Redo: {what}", // melding na Opnieuw
  "log.atTurn": "{name}'s turn (round {n})",
  "log.fightAgain": "Combat resumed · {at}",
  "log.start": "Start combat",
  "log.backTo": "Back to {at}",
  "log.undone": "Undone.",
  "log.redone": "Redone.",
  "log.w.initSet": "initiative entered", // log reason when a monster is added
  "log.w.grp": "group roll",
  "log.w.hpRoll": "HP rolled ({hd})",
  "log.w.edited": "edited",
  "log.w.dr": "{kind} {type}", // kind = Resist/Immune/Vuln., type = damage type
  "log.w.drWas": "{kind} {type} (was {was})",
  "log.w.drOff": "{kind} {type} removed",
  "log.w.oldGone": { one: "{n} old monster cleared at Start combat", other: "{n} old monsters cleared at Start combat" },
  "log.w.oldWiped": "old monsters cleared",
  "log.w.rageOver": "Rage over",
  "log.w.prep": "adjusted in Prep",
  "log.w.prepHp": "HP updated in Prep",
  "log.w.ddb": "{name} updated from D&D Beyond",
  "log.w.seat1": "added from the party",
  "log.w.seatAll": "party added",
  "log.w.midFight": "added during combat",
  "log.w.wiped": "cleared after combat",
  "log.w.enc": "encounter \"{name}\"",
  "log.encLoaded": { one: "Encounter \"{name}\" loaded: {n} monster{lair}", other: "Encounter \"{name}\" loaded: {n} monsters{lair}" }, // lair = ' + lair' or empty
  "log.encLoadedRepl": { one: "Encounter \"{name}\" loaded: {n} monster{lair} (replaces {gone})", other: "Encounter \"{name}\" loaded: {n} monsters{lair} (replaces {gone})" },
  "log.w.ended": "ended", // DM ended concentration by hand
  "log.w.cast": "{who}{roll}{type}", // who = 'Ayla cast ' or empty
  "log.w.castAdj": "{who}{roll}, adjusted to {n}{type}",
};
