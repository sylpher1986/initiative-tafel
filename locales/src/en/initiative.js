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
  // WP24 (TA8): Voorbereiden, + Speler, Party, + Monster, welkomstkaart, moeilijkheid, exportherinnering
  "init.prep.phase": "Phase: Prep, then Combat", // aria-label van de fase-aanduiding
  "init.prep.phase1": "Prep",
  "init.prep.phase2": "Combat",
  "init.prep.runbar": "Combat running · round {n} · you're editing the list",
  "init.prep.tPc": "Add player", // paneeltitel
  "init.prep.tMon": "Add monster", // paneeltitel
  "init.prep.tParty": "Party", // paneeltitel
  "init.prep.effDelta": "{d} effect", // achter Max HP: "+5 effect" (Aid)
  "init.prep.hpNow": "Now {hp} of {max} HP",
  "init.prep.hpAria": "Current HP",
  "init.prep.baseAc": "Base AC", // als er een AC-effect loopt
  "init.prep.hideTip": "Players can't see this monster",
  "init.prep.hide": "Hide",
  "init.prep.hidden": "Hidden",
  "init.prep.cond": "Condition",
  "init.prep.eff": "Effect",
  "init.prep.sb": "Stat block",
  "init.prep.morePc": "More: name, max HP, party, remove",
  "init.prep.moreMon": "More: name, AC, name for players, remove",
  "init.prep.sample": "Sample encounter",
  "init.prep.sampleGone": "Sample cleared.",
  "init.prep.wipe": "Clear encounter",
  "init.prep.wipeWhat": "Clear what?",
  "init.prep.wipeMons": "Clear monsters, keep players",
  "init.prep.wipeAll": "Everything",
  "init.prep.wipeAllQ": "Clear everything?",
  "init.prep.wipeYes": "Yes, clear encounter",
  "init.prep.wiped": "{what} cleared. Players stay; they enter initiative at Start combat.", // what = "2 monsters and lair"
  "init.prep.end": "End combat",
  "init.prep.errInit": "Initiative must be a number.",
  "init.prep.errMax": "Max HP must be at least 1.",
  "init.prep.errHp": "HP must be 0 or more.",
  "init.prep.errAc": "AC is 0 to 40.",
  "init.prep.errLvl": "Level is 1 to 20.",
  "init.dock.pc": "Player", // + Speler in de prep-rij
  "init.dock.settings": "Settings",
  "init.dock.undo": "Undo", // aria-label van ↶
  "init.dock.undoTip": "Undo ({key})", // tooltip, key = ⌘Z of Ctrl+Z
  "init.dock.start": "Start combat",
  "init.dock.startWhy": "Add someone first",
  "init.dock.back": "Back to combat · round {n}",
  "init.empty.none": "There's no one left in the list.",
  "init.empty.toPrep": "Go to prep",
  "init.empty.loadEnc": "Load encounter",
  "init.empty.partyReady": "No one at the table yet. Your party is ready.",
  "init.empty.nobody": "No one at the table yet.",
  "init.empty.pcHint": "Add players with + Player at the bottom.",
  "init.empty.hint": "No one at the table yet. Add players and monsters with the buttons at the bottom.",
  "init.welcome.title": "Welcome to the table",
  "init.welcome.text": "Track initiative, hit points, conditions and spell slots for D&D 5e (2014). Everything stays on this device and works offline too.",
  "init.welcome.sample": "Start with sample",
  "init.welcome.empty": "Start empty", // ook de knop in de strook Voorbeeld-encounter
  "init.welcome.import": "Have an export? Import…",
  "init.welcome.hint": "Sample: 2 players, 2 Goblins and a Hobgoblin. Then try Start combat. Prepare encounters under + Monster.",
  "init.sample.pc1": "Thalia (sample)", // naam in de lijst; daarna inhoud
  "init.sample.pc2": "Brom (sample)",
  "init.exp.banner": "No recent export · your data is only on this device",
  "init.exp.now": "Export",
  "init.exp.later": "Later",
  "init.exp.snoozed": { one: "We'll remind you again in {n} day.", other: "We'll remind you again in {n} days." },
  "init.exp.never": "Never exported",
  "init.exp.last": "Last export: {date} ({ago})",
  "init.exp.stat": "Export: {ago}", // kop van Instellingen → Opslag
  "init.ddb.bad": "Not a D&D Beyond link. Paste the sheet link or just the number.",
  "init.ddb.format": "D&D Beyond returned unexpected data.",
  "init.ddb.notfound": "Not found on D&D Beyond. Check the link and that the sheet is Public (Character Settings → Character Privacy → Public).",
  "init.ddb.upstream": "D&D Beyond returned an error. The sheet probably isn't Public (Character Settings → Character Privacy → Public). Otherwise, try again shortly.",
  "init.ddb.private": "Loading didn't work. The sheet probably isn't Public (Character Settings → Character Privacy → Public).",
  "init.ddb.offline": "No internet. Loading only works online.",
  "init.ddb.offlineUpd": "No internet. Updating only works online.",
  "init.ddb.tail": "Otherwise, use the PDF upload below.", // achter de foutmelding in het Speler-formulier
  "init.ddb.tailParty": "Otherwise, update via + Player with the PDF upload.", // achter de foutmelding in de Party
  "init.pc.errName": "Enter a name.",
  "init.pc.errInit": "Enter initiative or tap Roll.",
  "init.pc.errAc": "AC between 1 and 40, or leave empty.",
  "init.pc.errHp": "Max HP between 1 and 999, or leave empty.",
  "init.pc.errLvl": "Level between 1 and 20, or leave empty.",
  "init.pc.count": { one: "{n} player at the table", other: "{n} players at the table" },
  "init.pc.checkWhy": "Verify {what}: {why}.", // what = AC of max HP; why uit de sheet-parser
  "init.pc.slotsNone": "none",
  "init.pc.loaded": "{b} loaded ({what})", // b = naam (vet)
  "init.pc.withImg": ", with portrait",
  "init.pc.noChange": "no changes to class, AC, HP or spell slots",
  "init.pc.mUpdHere": "{b} is already in the party and at the table. Update: {what}. Damage, used resources and initiative stay.",
  "init.pc.mUpd": "{b} is already in the party. Adding updates the sheet: {what}. Damage and used resources stay.",
  "init.pc.mHere": "{b} is in the party and already at the table.",
  "init.pc.mSeat": "{b} is already in the party{hp}. Adding puts {name} at the table with the saved HP and slots.", // hp = " (12/30 HP)" of leeg
  "init.pc.asNew": "As new player",
  "init.pc.asNewDone": "Will be added as a new player.",
  "init.pc.fillInit": "Enter initiative.",
  "init.pc.planUpd": "Update",
  "init.pc.planNone": "Already at the table",
  "init.pc.planUpdSeat": "Update and add to combat",
  "init.pc.planSeat": "Add to combat",
  "init.pc.dup": "Several party members are called {name}. This becomes a new member; add an existing member to combat via Party.",
  "init.pc.fetching": "Loading sheet…",
  "init.pc.hereDone": "{name} is already at the table: updated{what}. Initiative stays.", // what = " (…)" of leeg
  "init.pc.updSeated": "{name} updated{what} and added to combat. Damage and used resources stay.",
  "init.pc.seated": "{name} added to combat with {hp}/{max} HP{st}.", // st = " (dead)" of leeg
  "init.pc.stDead": "dead",
  "init.pc.stUnc": "unconscious",
  "init.pc.partyKeeps": "The party update stays.", // na aan tafel zetten: Ongedaan haalt het bijwerken niet weg
  "init.pc.added": "{name} added ({count}).",
  "init.pc.addedInit": "{name} added at initiative {init} ({count}).",
  "init.pc.reading": "Reading {file}…",
  "init.pc.noPdf": "No D&D Beyond form fields found. Is this a PDF export from D&D Beyond?",
  "init.pc.pdfFail": "The PDF reader couldn't load or couldn't open the file. Check your connection and try again.",
  "init.mon.own": "custom", // achter een eigen monster in de lijst
  "init.mon.none": "Nothing found for {q}. Try a wider range (e.g. cr 1-6) or another type.",
  "init.mon.noneTab": "Nothing found. Add it under \"Custom\".",
  "init.mon.badCr": "CR not recognized. Use e.g. cr 5, cr 1/2 or cr 2-4.",
  "init.mon.found": { one: "{label} · {n} monster", other: "{label} · {n} monsters" },
  "init.mon.addBtn": "Add {what}", // knop: "Add 2× Goblin (hidden)"
  "init.mon.flags": "{what} ({flags})",
  "init.mon.flagHid": "hidden",
  "init.mon.flagAnon": "name hidden",
  "init.mon.hidHint": "Players don't see them, not even their turn. Show them later via ⋯ → Show to players.",
  "init.mon.anonHint": "Players see \"{anon}\" with a generic icon. Show the name later via ⋯ → Show name to players.",
  "init.mon.anonName": "Unknown creature", // gelijk houden met de naam op het spelersscherm (WP28)
  "init.mon.initEach": "Each", // initiative per monster
  "init.mon.initGroup": "Group",
  "init.mon.initFixed": "Set", // zelf een getal invullen
  "init.mon.hintFixedN": "All {n} on {v} · one group turn.",
  "init.mon.hintFixedN0": "All {n} on this number · one group turn.",
  "init.mon.hintFixed1": "Initiative {v}.",
  "init.mon.hintFixed10": "Enter initiative.",
  "init.mon.hintGroupN": "One d20 for all {n} · one group turn.",
  "init.mon.hintGroup1": "One d20 (a group from 2 monsters).",
  "init.mon.hintEachN": "Each monster rolls its own d20.",
  "init.mon.hintEach1": "d20 + Dex.",
  "init.mon.hintNoHd": "No hit dice: average HP.",
  "init.mon.hintLate": "If that's before whoever's turn it is, they join next round.",
  "init.mon.qty": "Number",
  "init.mon.less": "Fewer",
  "init.mon.more": "More",
  "init.mon.hpAvg": "Average",
  "init.mon.hpRoll": "Roll",
  "init.mon.fix": "Number", // getalveld bij Invullen
  "init.mon.fixAll": "Number for all {n}",
  "init.mon.fixPh": "e.g. 14",
  "init.mon.pick": "Choose a monster",
  "init.mon.errPick": "Tap a monster in the list first.",
  "init.mon.errInit": "Enter the initiative.",
  "init.qadd.title": "Join the combat", // snel toevoegen tijdens het gevecht
  "init.qadd.none": "Nothing found. Create custom monsters under Prep → + Monster → Custom.",
  "init.custom.none": "No stat block recognized; it will be saved as plain text.",
  "init.custom.found": "Recognized: {list}",
  "init.custom.rest": { one: "Not recognized: {n} line stays as text under Other.", other: "Not recognized: {n} lines stay as text under Other." },
  "init.custom.preview": "Preview",
  "init.custom.errHp": "HP as a number (22) or as dice (5d8 or 5d8+10).",
  "init.custom.errAc": "Enter AC, or paste a stat block with Armor Class.",
  "init.custom.errHp2": "Enter valid HP, or paste a stat block with Hit Points.",
  "init.custom.defName": "Custom monster", // naam zonder invoer; opgeslagen = inhoud
  "init.custom.saved": "{name} saved. Choose a number and add.",
  "init.custom.imported": { one: "{n} imported monster active.", other: "{n} imported monsters active." },
  "init.custom.impClear": "Remove import",
  "init.custom.errJson": "This file isn't valid JSON. Choose the .json file with monsters.",
  "init.custom.errEmpty": "No monsters found in this file.",
  "init.custom.impDone": "{n} monsters imported, {k} new.",
  "init.party.empty": "No saved party yet. Players you add with \"Also save to party\" appear here, including imported sheets. HP, spell slots and resources then carry over from combat to combat until a rest.",
  "init.party.encLink": "Prepare encounters",
  "init.party.updAria": "Update {name} from D&D Beyond",
  "init.party.loading": "Loading…",
  "init.party.retry": "Retry",
  "init.party.update": "Update",
  "init.party.updQ": "Update {b} from D&D Beyond.",
  "init.party.updQHere": "Update {b} from D&D Beyond (at the table).",
  "init.party.updKeep": "{list}. Damage and used resources stay.",
  "init.party.here": "at the table",
  "init.party.del": "Remove", // in het Party-paneel: uit de vaste party (smal op 320 px)
  "init.party.sure": "Sure? Tap again",
  "init.party.rollAll": "Roll for everyone",
  "init.party.seat": "Add party to combat",
  "init.party.initLater": "Initiative is entered at Start combat.",
  "init.party.restHint": "A rest applies to the whole party, including those at the table. Long rest: full HP, slots and resources. Short rest: resources marked \"per short rest\".",
  "init.party.fresh": "{name}: sheet refreshed, nothing else changed.",
  "init.party.updated": "{name} updated.",
  "init.party.updatedCh": "{name} updated: {list}.",
  "init.party.allHere": "Everyone is already at the table.",
  "init.party.noInit": "No initiative yet for: {names}. Enter it or tap \"Roll for everyone\".",
  "init.party.seated": { one: "{n} player added to combat.", other: "{n} players added to combat." },
  "init.party.long": "Long rest: HP, spell slots and resources restored.{ex}", // ex = " Exhaustion: Brom 3 → 2." of leeg
  "init.party.short": "Short rest: short-rest resources restored.",
  "init.party.shortPact": "Short rest: Pact Magic slots and short-rest resources restored.",
  "init.diff.title": "Difficulty",
  "init.diff.noMons": "No monsters",
  "init.diff.noParty": "no party", // chip zonder oordeel
  "init.diff.noLvl": "level unknown",
  "init.diff.noCr": "CR unknown",
  "init.diff.counted": "{nm} of {n} monsters count",
  "init.diff.mons": { one: "{n} monster", other: "{n} monsters" },
  "init.diff.pcs": { one: "{n} player", other: "{n} players" },
  "init.diff.noPcs": "No players: add the party to combat or add party members.",
  "init.diff.atTable": "At the table: level {lv}",
  "init.diff.saved": "Saved party: level {lv}",
  "init.diff.withoutCr": "No CR (not counted): {names}",
  "init.diff.small": "Small party: multiplier one step higher.",
  "init.diff.big": "Large party: multiplier one step lower.",
  "init.diff.lair": "Lair doesn't count.",
  "init.diff.deadly": "Deadly: a character could die.",
  "init.diff.deadlyOne": "Pick a lower CR for Hard.",
  "init.diff.deadlyStays": "Even with 1 fewer monster it stays Deadly.",
  "init.diff.deadlyLess": "With 1 fewer {name} it becomes {rating}.",
  "init.diff.weakAll": "Counts toward ×, even with a much lower CR: {who}",
  "init.diff.weakNot": "Not counted toward ×: {who} (XP below 1/10 of the strongest monster)",
  "init.diff.countAnyway": "Count anyway",
  "init.diff.lvlLost": "Level unknown: {names} (fill in under Party).",
  "init.diff.lvlFill": "Enter the level.", // vet
  "init.diff.lvlParty": "Saved in the party.",
  "init.diff.lvlMixed": "Party members: saved in the party.",
  "init.diff.lvlPc": "Saved with the player.",
};
