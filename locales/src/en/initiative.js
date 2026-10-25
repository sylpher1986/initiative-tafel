// Kev’s Inn Initiative (DM-app): per scherm init.prep.*, init.fight.*, init.party.*, init.enc.*, init.set.*, init.room.*, init.tour.*.
// Sleutels beginnen met "init." (tests/i18n.test.js). Zelfde sleutels in elke taal; Engels is de terugval.
// Na een wijziging: node tools/i18n-build.mjs (maakt locales/<taal>.js, dat de app laadt).
// Engelse tekst: D&D 5e (2014)-termen zoals in de PHB/SRD; nagelezen door de vertaalagent (docs/i18n.md §0, V6).
export default {
  "init.sb.empty": "Add a monster or player: their stat block or sheet appears here.", // lege zijkolom (tablet)
  "init.add.title": "Add", // paneeltitel; js/ui/render.js zet hem per knop
  "init.add.kinds": "Monster source", // aria-label van de tabs hieronder
  "init.add.list": "From the list",
  "init.add.custom": "Custom", // eigen monster
  "init.add.enc": "Encounters",
  "init.pc.ddb": "D&D Beyond link",
  "init.pc.fetch": "Load",
  "init.pc.public": "The sheet must be public: Character Settings → Character Privacy → Public.", // menunamen van D&D Beyond blijven Engels
  "init.pc.pdf": "Or use a D&D Beyond PDF export…", // knop, opent de bestandskiezer
  "init.pc.name": "Name",
  "init.pc.nameEg": "e.g. Thalia", // placeholder
  "init.pc.initPh": "roll + bonus", // placeholder
  "init.pc.rollTip": "d20 + init bonus", // tooltip op Rol
  "init.pc.roll": "Roll",
  "init.pc.optional": "(optional)",
  "init.pc.check": "verify", // achter een onzeker veld uit de sheet: "AC · controleer"
  "init.pc.bonus": "Init bonus",
  "init.pc.bonusDown": "Lower init bonus", // aria-label −
  "init.pc.bonusUp": "Raise init bonus", // aria-label +
  "init.pc.bonusHint": "Also used to break ties.",
  "init.pc.race": "Race (icon)",
  "init.pc.raceOther": "Other / unknown",
  "init.pc.lvlPh": "from sheet", // placeholder bij Level
  "init.pc.slots": "Spellcaster? Enter spell slots",
  "init.pc.sl1": "1st", // label per slot-level, smal
  "init.pc.sl2": "2nd", // label per slot-level, smal
  "init.pc.sl3": "3rd", // label per slot-level, smal
  "init.pc.sl4": "4th", // label per slot-level, smal
  "init.pc.sl5": "5th", // label per slot-level, smal
  "init.pc.sl6": "6th", // label per slot-level, smal
  "init.pc.sl7": "7th", // label per slot-level, smal
  "init.pc.sl8": "8th", // label per slot-level, smal
  "init.pc.sl9": "9th", // label per slot-level, smal
  "init.pc.party": "Also save to party",
  "init.pc.add": "Add player",
  "init.mon.search": "Search monsters",
  "init.mon.searchPh": "name, type or CR: undead cr 2-4", // placeholder; zoekwoorden blijven Engels
  "init.mon.searchHint": "Search by name, type (undead, fiend…) or CR (cr 5, cr 1/2, cr 2-4, cr 10+).",
  "init.mon.hidden": "Hidden from players",
  "init.mon.anon": "Name hidden from players",
  "init.mon.addSample": "Add Goblin", // beginwaarde; js/ui/render.js zet de echte naam
  "init.set.look": "Display", // sectie in Instellingen
  "init.set.system": "System", // thema
  "init.set.light": "Light", // thema
  "init.set.dark": "Dark", // thema
  "init.set.react": "Player reactions",
  "init.set.reactOn": "Button",
  "init.set.reactOff": "Players", // spelers houden hun reaction zelf bij
  "init.set.reactHint": "Players: they track their own reaction, so player cards have no Reaction button. Monsters keep the button. Surprised and Shield still work.",
  "init.set.spellsHint": "Rules and descriptions for spells: the Barkskin, Haste and Sleep presets (Sleep 2024 only), which spells need concentration, and which text the spell panel shows.", // eerste zin; daarna volgt spellsOnly vet
  "init.set.spellsOnly": "Applies to spells only:", // vet
  "init.set.spellsRest": "the rest of the app (conditions, crits, concentration DC) stays 2014. Players with a D&D Beyond sheet follow the version on their sheet for each spell; monsters, players without a sheet and spells not on the sheet follow this setting. In the spell panel you can view the other version; that doesn't change the rules. Anything already running keeps the rules from when it was cast.",
  "init.set.player": "Player view", // sectie in Instellingen
  "init.set.playerHint": "Players see the order, whose turn it is and player HP. Never stat blocks, notes or anything you hide (monsters via ⋯, the lair on its card).",
  "init.set.vis": "What players see",
  "init.set.visMonHp": "Monster HP",
  "init.set.visNone": "None", // HP monsters: niet tonen
  "init.set.visOrder": "Order", // initiative: alleen de volgorde
  "init.set.visNumbers": "Numbers", // initiative: getallen tonen
  "init.set.visTags": "Conditions and effects",
  "init.set.visAll": "Show",
  "init.set.visPc": "Players only",
  "init.set.visHide": "Hide",
  "init.set.visLog": "What just happened", // zelfde naam als het blok op het spelersscherm (player.log)
  "init.set.on": "On",
  "init.set.off": "Off",
  "init.set.visHint": "Status = Unhurt, Hurt, Bloodied, Near death. \"What just happened\": the last 2 lines (3 on a TV), only what the list also shows. Applies on this device, for all player views.", // statusnamen moeten gelijk blijven aan STATUS in js/playerview.js (WP28)
  "init.set.otherDevices": "On other devices",
  "init.set.roomNotStarted": "Sharing with players didn't start. Reload the page.", // alleen zichtbaar als js/ui/kamer.js niet laadt
  "init.set.thisDevice": "On this device",
  "init.set.thisDeviceHint": "A second window in this browser (TV via cable, second screen, tablet in split view). Works without internet too. On iPhone/iPad: open the site in Safari, not the app on your home screen.",
  "init.set.openPlayer": "Open player view",
  "init.set.help": "Help",
  "init.set.tourAgain": "Replay tour",
  "init.set.keys": "Keyboard shortcuts",
  "init.set.helpHint": "Explains the buttons, e.g. for a co-DM. During combat this shows the combat part, otherwise the prep part; the combat part follows when you tap Start combat.",
  "init.set.store": "Storage",
  "init.set.storeHint": "Everything is stored on this device. Export now and then: as a backup, to move to another device, or to share your party with a co-DM.",
  "init.set.expFile": "Export as file",
  "init.set.expCopy": "Copy as text",
  "init.set.impFile": "Import file…", // knop, opent de bestandskiezer
  "init.set.impPaste": "Or paste the text of an export",
  "init.set.impGo": "Import",
  "init.custom.hint": "For monsters outside the SRD. They're saved in this browser and then appear in the monster list like any other.",
  "init.custom.name": "Name",
  "init.custom.fromText": "from text", // achter een veld dat uit de geplakte tekst is ingevuld: "CR · uit tekst"
  "init.custom.hp": "HP or hit dice",
  "init.custom.hpPh": "22 or 5d8", // placeholder
  "init.custom.dex": "Dex score",
  "init.custom.text": "Stat block (paste text)",
  "init.custom.textHint": "Paste a stat block (e.g. from D&D Beyond): attacks, legendary actions, resistances and ability scores are recognized and empty fields above are filled in.",
  "init.custom.save": "Save monster",
  "init.custom.file": "Import monster file (JSON)…",
  "init.custom.fileWith": "Works with", // daarna volgt de bestandsnaam vet
  "init.custom.fileRest": "from the 5e-database by 5e-bits on GitHub (folder src/2014/en) and with an Open5e export. Your own JSON list in the same format works too. You can import several files one after another; they're merged.",
};
