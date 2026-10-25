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
  "init.prep.wiped": "{what} cleared. Players stay; you'll enter their initiative at Start combat.", // what = "2 monsters and lair"
  "init.prep.lair": "the lair", // in de opsomming van init.prep.wiped
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
  "init.empty.toPrep": "Go to Prep",
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
  "init.pc.errAc": "AC between 1 and 40, or leave it empty.",
  "init.pc.errHp": "Max HP between 1 and 999, or leave it empty.",
  "init.pc.errLvl": "Level between 1 and 20, or leave it empty.",
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
  "init.pc.partyKeeps": "Undo keeps the party update.", // na aan tafel zetten: Ongedaan haalt het bijwerken niet weg
  "init.pc.added": "{name} added ({count}).",
  "init.pc.addedInit": "{name} added at initiative {init} ({count}).",
  "init.pc.reading": "Reading {file}…",
  "init.pc.noPdf": "No D&D Beyond form fields found. Is this a PDF export from D&D Beyond?",
  "init.pc.pdfFail": "The PDF reader didn't load, or the file couldn't be opened. Check your connection and try again.",
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
  "init.mon.initFixed": "Fixed", // zelf een getal invullen
  "init.mon.hintFixedN": "All {n} at {v} · one group turn.",
  "init.mon.hintFixedN0": "All {n} at this number · one group turn.",
  "init.mon.hintFixed1": "Initiative {v}.",
  "init.mon.hintFixed10": "Enter initiative.",
  "init.mon.hintGroupN": "One d20 for all {n} · one group turn.",
  "init.mon.hintGroup1": "One d20 (a group needs 2 or more monsters).",
  "init.mon.hintEachN": "Each monster rolls its own d20.",
  "init.mon.hintEach1": "d20 + Dex.",
  "init.mon.hintNoHd": "No hit dice: average HP.",
  "init.mon.hintLate": "If that's ahead of the current turn, they join next round.",
  "init.mon.qty": "Count",
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
  "init.qadd.title": "Join combat", // snel toevoegen tijdens het gevecht
  "init.qadd.none": "Nothing found. Create custom monsters under Prep → + Monster → Custom.",
  "init.custom.none": "No stat block recognized; it will be saved as plain text.",
  "init.custom.found": "Recognized: {list}",
  "init.custom.rest": { one: "Not recognized: {n} line is kept as plain text.", other: "Not recognized: {n} lines are kept as plain text." },
  "init.custom.preview": "Preview",
  "init.custom.errHp": "HP as a number (22) or as dice (5d8 or 5d8+10).",
  "init.custom.errAc": "Enter AC, or paste a stat block with Armor Class.",
  "init.custom.errHp2": "Enter valid HP, or paste a stat block with Hit Points.",
  "init.custom.defName": "Custom monster", // naam zonder invoer; opgeslagen = inhoud
  "init.custom.saved": "{name} saved. Choose a count and add.",
  "init.custom.imported": { one: "{n} imported monster active.", other: "{n} imported monsters active." },
  "init.custom.impClear": "Remove import",
  "init.custom.errJson": "This file isn't valid JSON. Choose the .json file with monsters.",
  "init.custom.errEmpty": "No monsters found in this file.",
  "init.custom.impDone": { one: "{n} monster imported, {k} new.", other: "{n} monsters imported, {k} new." },
  "init.party.empty": "No saved party yet. Players you add with \"Also save to party\" appear here, including imported sheets. HP, spell slots and resources then carry over from combat to combat until a rest.",
  "init.party.encLink": "Prepare encounters",
  "init.party.updAria": "Update {name} from D&D Beyond",
  "init.party.loading": "Loading…",
  "init.party.retry": "Retry",
  "init.party.update": "Update",
  "init.party.updQ": "Update {b} from D&D Beyond?",
  "init.party.updQHere": "Update {b} from D&D Beyond (at the table)?",
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
  "init.diff.lair": "The lair doesn't count.",
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
  "init.fight.round": "Round {b}", // b = rondenummer, vet
  "init.fight.party": "Party {b}", // b = 3/4 (staand/totaal), vet
  "init.fight.foes": "Enemies {b}", // b = 2/5, vet
  "init.fight.head": "Combat", // label in de Gevecht-kop
  "init.fight.log": "Log", // opent het logboek
  "init.fight.roundN": "Round {n}",
  "init.fight.prep": "Prep", // knop in de Gevecht-kop; onder 480 px alleen het icoon
  "init.fight.prepAria": "Prep: edit the list",
  "init.fight.qadd": "Add monster to combat",
  "init.card.hpBtn": "{name}: {hp} of {max} HP. Enter damage", // aria-label van de HP-rij
  "init.card.hpBtnT": "{name}: {hp} of {max} HP, +{temp} temp. Enter damage",
  "init.card.concEnd": "End concentration", // tooltip op de Concentrating-chip
  "init.card.end": "end", // verborgen achter ✕ voor schermlezers
  "init.card.remove": "remove", // verborgen achter ✕ voor schermlezers
  "init.card.explain": "{name}: explanation", // aria-label van een conditiechip
  "init.card.effDel": "Remove effect",
  "init.card.rageEnd": "End Rage",
  "init.card.hiddenTip": "Players can't see this combatant",
  "init.card.hidden": "hidden", // badge
  "init.card.anonTip": "Players see: {name}",
  "init.card.anon": "name hidden", // badge: naam verborgen voor spelers
  "init.card.sur": "Surprised",
  "init.card.surTip": "Surprised: first turn is skipped, no reaction until that turn is over",
  "init.card.dead": "Dead",
  "init.card.stable": "Stable",
  "init.card.rcReady": "ready", // recharge-chip
  "init.card.rcUsed": "used", // recharge-chip: niet herladen
  "init.card.rcRest": "after rest", // recharge-chip
  "init.card.rcTip": "Tap to mark as used or available",
  "init.card.lrDay": "LR {n}/day", // badge legendary resistance
  "init.card.lrPer": "Legendary resistance per day",
  "init.card.pipUsed": "{label} {i} of {n}, used", // aria-label per bolletje
  "init.card.pipFree": "{label} {i} of {n}, available",
  "init.card.defVuln": "Vulnerable",
  "init.card.defRes": "Resistant",
  "init.card.defImm": "Immune",
  "init.card.dsOn": "{label} {i} of 3, checked",
  "init.card.dsOff": "{label} {i} of 3, not checked",
  "init.card.dsS": "Success", // death saves
  "init.card.dsF": "Failure", // death saves
  "init.card.dsRoll": "Roll death save",
  "init.card.dsOwn": "Player's roll", // de speler rolt zelf en noemt het getal
  "init.card.dsCrit": "Critical hit (+2)",
  "init.card.dsPadAria": "Death save of {name}",
  "init.card.dsPadRoll": "Roll of {name}",
  "init.card.padBack": "Backspace", // ⌫ op het cijferpad
  "init.card.dsPadHint": "1 = two failures, 10+ = success, 20 = regains 1 HP.",
  "init.card.pick": "Which spell?",
  "init.card.upcast": "({lv}, upcast)", // lv = 1st, 2nd …
  "init.card.concShort": "conc.",
  "init.card.pickSkip": "Other / skip",
  "init.card.rageNoSpells": "Rage: no spellcasting.",
  "init.card.pactSlot": "Pact slot ({lv})",
  "init.card.slotLv": "{lv}-level slot",
  "init.card.castReset": "Restore all (long rest)",
  "init.card.perSr": "per short rest",
  "init.card.perLr": "per long rest",
  "init.card.none": "none",
  "init.cond.dur": "Duration when applied",
  "init.cond.save": "Save at end of turn",
  "init.cond.exhDown": "Exhaustion one level lower",
  "init.cond.exhUp": "Exhaustion one level higher",
  "init.cond.exhBack": "To go back: Undo.",
  "init.cond.exhLr": "Long rest: one level less.",
  "init.card.edBaseAc": "base AC; {ac} with effects",
  "init.card.edParty": "also changes the party",
  "init.card.edNoName": "name can't be empty",
  "init.card.edDup": "note: this name already exists",
  "init.card.effDelta": "({d} effect)", // achter Max HP in ⋯
  "init.card.toParty": "Save to party",
  "init.card.show": "Show to players",
  "init.card.hide": "Hide from players",
  "init.card.nameShow": "Show name to players",
  "init.card.nameHide": "Hide name from players",
  "init.card.delFight": "Remove from combat",
  "init.card.del": "Remove", // deelnemer uit de lijst
  "init.card.pasHint": "Empty = from the sheet.",
  "init.card.drKind": "Kind",
  "init.card.drNow": "{type}, now {kind}",
  "init.card.drHint": "Tap sets the type to {kind}; tap again to clear it.",
  "init.card.drDdb": "Updating from D&D Beyond keeps what you add here.",
  "init.card.drParty": "Also applies in the party.",
  "init.card.drDone": "Done",
  "init.card.drEdit": "Edit",
  "init.eff.acPlus": "AC +",
  "init.eff.acMinus": "AC −",
  "init.eff.acSet": "AC becomes",
  "init.eff.acMin": "AC minimum",
  "init.eff.maxPlus": "Max HP +",
  "init.eff.maxMinus": "Max HP −",
  "init.eff.txt": "Text only",
  "init.eff.who": "Who casts {b}?", // b = spellnaam, vet
  "init.eff.namePh": "e.g. Life Drain",
  "init.eff.on": "Target",
  "init.eff.value": "Value",
  "init.eff.dur": "Duration",
  "init.eff.durLr": "Until long rest",
  "init.eff.note": "Note",
  "init.eff.notePh": "e.g. +1d4 on saves",
  "init.eff.concBy": "Concentrating caster",
  "init.eff.add": "Add",
  "init.eff.acFirst": "Enter AC first (⋯)",
  "init.eff.custom": "+ Custom effect",
  "init.eff.noAc": "No AC known: AC + is off. Enter AC via ⋯.",
  "init.eff.hintTurn": "Concentration spells: caster is {b} (current turn). Same effect again = refresh. More targets at once (Bless, Bane): AoE → Spell.",
  "init.eff.hintPick": "Concentration spells: you choose the caster. Same effect again = refresh. More targets at once (Bless, Bane): AoE → Spell.",
  "init.rage.left": "{name} {n} of {max} left",
  "init.rage.noRes": "No Rage counter on the sheet: track it yourself.",
  "init.rage.conc": "Concentration ends.",
  "init.rage.concOn": "Concentration on {spell} ends.",
  "init.rage.sum": "{b} rage damage (melee, STR) · resistance {res} · advantage on STR checks and STR saves · no spells, no concentration · 10 rounds", // b = +2; res = B/P/S of allBut
  "init.rage.allBut": "to all but psychic",
  "init.rage.frenzy": "Frenzy: one level of exhaustion afterwards.",
  "init.rage.on": "Rage is already running. To end it: tap the Rage chip.",
  "init.rage.start": "Start Rage",
  "init.rage.start0": "Start Rage (0 left)",
  "init.card.more": "More", // aria-label van ⋯ in Gevecht
  "init.card.dmg": "− Damage",
  "init.card.heal": "+ Heal",
  "init.card.surReact": "Surprised: no reaction until their own turn is over",
  "init.card.reactTip": "Reaction used · tap to reset",
  "init.atk.hitPick": "{label}: attack {hit} to hit, choose target",
  "init.atk.hit": "{label}: attack {hit} to hit",
  "init.atk.aoeOpen": "{label}: DC {dc} {ab}, open AoE panel",
  "init.atk.dmgRoll": "{label}: roll damage",
  "init.atk.fold": "Attacks",
  "init.atk.foldN": "Attacks ({n})",
  "init.atk.more": "+{n} more",
  "init.lair.which": "Which lair",
  "init.lair.used": "Used last time, not allowed now",
  "init.lair.use": "Use",
  "init.lair.del": "Delete", // lair action
  "init.lair.none": "No lair actions for this lair yet. Add them below; they're saved for next time.",
  "init.lair.add": "Add lair action",
  "init.lair.namePh": "e.g. Magma Eruption",
  "init.lair.effect": "Effect",
  "init.lair.init": "Initiative 20, loses ties.",
  "init.lair.remove": "Remove lair",
  "init.card.kindPc": "player",
  "init.card.kindMon": "monster",
  "init.card.open": "open",
  "init.card.close": "close",
  "init.card.down": "down", // op een dichte kaart: monster op 0 HP
  "init.fight.down": "Down ({n})", // ingeklapt blok met monsters op 0 HP
  "init.old.aria": "Monsters from the previous combat",
  "init.old.wipe": "Clear old monsters",
  "init.old.start": "Clear old and start",
  "init.old.go": "Start anyway",
  "init.fight.now": "Up now", // beurtbalk
  "init.fight.grpTip": "Group turn: member {k} of {n}",
  "init.fight.next": "next: {name}", // beurtbalk rechts; kort
  "init.fight.allDown": "All monsters down",
  "init.fight.prevAria": "Previous turn",
  "init.fight.prevTip": "Previous turn (Shift+N)",
  "init.fight.prev": "Prev", // bijschrift onder ‹ in 52 px
  "init.fight.aoeAria": "Area of effect: damage or a spell on multiple targets",
  "init.fight.nextTip": "Next turn (N or space)",
  "init.fight.nextBtn": "Next", // hoofdknop; daarna nextTurn (verborgen op smal scherm)
  "init.fight.nextTurn": "turn", // na "Next"; alleen op brede schermen zichtbaar (spatie staat in de template)
  "init.sv.self": "roll manually", // geen savebonus bekend: de DM rolt zelf
  "init.sv.conc": "concentration",
  "init.sv.or": "or {what}", // rider: of Prone
  "init.sv.half": "half",
  "init.sv.seeSb": "see stat block",
  "init.sv.endTurn": "end of turn",
  "init.sv.rollAria": "{name}: roll {ab} save, DC {dc}",
  "init.sv.roll": "Roll {b}", // b = +4
  "init.sv.okAria": "{name}: {ab} save succeeded",
  "init.sv.ok": "Success", // save
  "init.sv.failAria": "{name}: {ab} save failed",
  "init.sv.fail": "Fail", // save
  "init.sv.expires": "expires on Next",
  "init.sv.rage": "Rage continues? No damage since last turn",
  "init.sv.rageEndAria": "Rage of {name} over",
  "init.sv.rageEnd": "Over",
  "init.sv.open": "Saves · {n} open",
  "init.sv.openConc": "Saves · {n} open · {k} concentration",
  "init.sv.openOther": "Saves · {n} other open",
  "init.sv.title": "Open saves",
  "init.sv.rollAll": "Roll all monsters ({n})",
  "init.sv.selfList": "Roll manually (no save known): {names}.", // names = opsomming
  "init.sv.hint": "Unresolved saves expire after the next turn change, with no effect.",
  "init.la.whyOwn": "regaining", // chip: monster is zelf aan de beurt
  "init.la.tipOwn": "Their turn: legendary actions are regained",
  "init.la.whyEmpty": "0 left",
  "init.la.tipEmpty": "Used up: regained at the start of its turn",
  "init.la.whyInc": "incapacitated",
  "init.la.tipInc": "Incapacitated: no legendary actions",
  "init.la.whySur": "surprised",
  "init.la.tipSur": "Surprised: no legendary actions until their own turn is over",
  "init.la.allAria": "Legendary actions of {n} monsters",
  "init.la.all": "Legendary · {n} monsters",
  "init.la.chipAria": "Legendary actions {name}: {n} of {max} left",
  "init.la.roll": "Roll", // regel in het legendary-paneel met de eigen worp van de optie
  "init.la.useAria": "Use {name} ({n} LA)",
  "init.la.left": "{n}/{max} left",
  "init.la.hint": "At the end of another creature's turn, one at a time. Regained at the start of its turn.",
  "init.dmg.after": "{n} after {mode}", // preview: 7 na resist
  "init.dmg.mResist": "resistance",
  "init.dmg.mVuln": "vulnerability",
  "init.dmg.mImm": "immunity",
  "init.dmg.dies": "dies",
  "init.dmg.noUf": "no Undead Fortitude",
  "init.dmg.uf": "Undead Fortitude CON DC {dc} (rolled when applied)",
  "init.dmg.ufx": "Radiant or crit",
  "init.dmg.ufxHint": "then no Undead Fortitude",
  "init.dmg.unc": "unconscious",
  "init.dmg.now": "Now {hp}/{max} HP",
  "init.dmg.nowT": "Now {hp}/{max} HP (+{temp} temp)",
  "init.dmg.parry": "Parry +{n} → miss",
  "init.dmg.parryHint": "Melee · hit vs {ac}? Then it misses.", // ac = AC 15–16
  "init.dmg.kDmg": "Damage", // tab en veld
  "init.dmg.goDmg": "Apply {n} damage",
  "init.dmg.goHeal": "Heal {n} HP",
  "init.dmg.goThp": "Give {n} temp HP",
  "init.dmg.normal": "Normal",
  "init.dmg.resist": "Resist ½",
  "init.dmg.vuln": "Vuln. ×2",
  "init.dmg.imm": "Immune",
  "init.dmg.rage": "Rage: resistance {res}, halve it.",
  "init.dmg.clear": "Clear all",
  "init.aoe.mResist": "Resist",
  "init.aoe.mVuln": "×2",
  "init.aoe.okHalf": "Success ½",
  "init.aoe.zero": "0", // geen schade (Evasion)
  "init.aoe.ok0": "Success 0",
  "init.aoe.mods": "On the save: {mods}",
  "init.aoe.saved": "stored", // resistance komt uit de opgeslagen gegevens van de speler
  "init.aoe.sb": "stat block",
  "init.aoe.note": "note: {what}",
  "init.aoe.lrOk": "Legendary resistance: save succeeded",
  "init.aoe.lrUse": "Use legendary resistance ({n} left)",
  "init.aoe.evasion": "No damage (e.g. Evasion)",
  "init.aoe.resAria": "Resistance {name}",
  "init.aoe.fill": "Enter the damage",
  "init.slot.aria": "Slot of {name}",
  "init.slot.left": "{slot}, {n} left",
  "init.slot.selfTip": "Track slots yourself (remembered for {name})",
  "init.slot.self": "Self", // segment: slots zelf bijhouden
  "init.slot.empty": "{b}: nothing is deducted.",
  "init.slot.emptyB": "No {slot} left", // vet
  "init.slot.run": "{spell} is already running (concentration): no slot. Tap a slot for a new cast.",
  "init.slot.selfHint": "{name} tracks their own slots: nothing is deducted.",
  "init.aoe.notListed": "Not in the list: enter the dice below yourself.",
  "init.aoe.noCaster": "no caster",
  "init.aoe.curTurn": "{name} (current turn)",
  "init.aoe.dmgSpell": "Damage spell",
  "init.aoe.dmgSpellPh": "Search: fireball, sacred flame…",
  "init.aoe.cantrip": "Cantrip · level {lvl} → {dice}",
  "init.aoe.cantrip0": "Cantrip · level unknown: {dice}",
  "init.aoe.otherSpell": "Choose another spell",
  "init.aoe.lose": "{name} is now concentrating on {spell}: that ends.",
  "init.aoe.title": "AoE damage",
  "init.aoe.dice": "Dice",
  "init.aoe.dicePh": "8d6 or 2d6+3",
  "init.aoe.typeNone": "none / unknown",
  "init.aoe.rollMons": "Roll monsters",
  "init.aoe.selMons": "Monsters",
  "init.aoe.selPcs": "Players",
  "init.aoe.selNone": "Nobody",
  "init.aoe.edited": "edited (rolled {n})",
  "init.aoe.reroll": "Reroll", // worp
  "init.aoe.extra": "{what}: apply separately",
  "init.aoe.alt": "Or {type} (caster's choice): choose the type.",
  "init.aoe.notRc": "{name} hasn't recharged yet",
  "init.aoe.nobody": "Nobody to hit.",
  "init.aoe.cnt": "Targets · {n} selected",
  "init.aoe.total": "Total {n} damage",
  "init.aoe.totalDown": "Total {n} damage · {k} down",
  "init.aoe.pickT": "Choose targets",
  "init.aoe.go": { one: "{dmg} on {n} target", other: "{dmg} on {n} targets" }, // dmg = 28 fire of de spellnaam
  "init.sp.immune": "immune",
  "init.sp.noEff": "no effect",
  "init.sp.hpUnknown": "HP unknown",
  "init.sp.namePh": "e.g. Fear",
  "init.sp.conc": "Concentration",
  "init.sp.title": "Spell on targets",
  "init.sp.own": "+ Custom",
  "init.sp.ownSub": "condition + save",
  "init.sp.pickCaster": "choose who casts",
  "init.sp.noPreset": "{spell} has no preset. Put the condition on the card or use + Custom.", // spell = Sleep 2014
  "init.sp.noPresetHp": "{spell} has no preset (HP pool). Put the condition on the card or use + Custom.",
  "init.sp.pick": "Choose a spell",
  "init.sp.whileConc": "while concentration lasts",
  "init.sp.rep": "repeat {ab} save at end of turn",
  "init.sp.redc": "Rolled saves now against DC {dc} (new caster).",
  "init.sp.nobody": "Nobody to choose.",
  "init.sp.cntOf": "Targets · {n} of {max}",
  "init.sp.cnt": "Targets · {n} selected",
  "init.sp.over9": "more targets than a 9th-level slot",
  "init.sp.hit": "affected", // samenvatting: 3 geraakt
  "init.sp.okN": "{n} no effect",
  "init.sp.pickCasterBtn": "Choose who casts",
  "init.sp.pickT": "Choose targets",
  "init.atk.auto": "Auto",
  "init.atk.adv": "Adv",
  "init.atk.dis": "Dis",
  "init.atk.dmgN": "{n} damage",
  "init.atk.apply": "Apply {what}", // what = 7 damage + Prone
  "init.atk.noDmg": "No damage",
  "init.atk.applySave": "Apply {what} · save in turn bar",
  "init.atk.nothing": "nothing",
  "init.atk.applyNone": "Apply (no effect)",
  "init.atk.then": "Then · {ab} DC {dc} · {what}",
  "init.atk.only": "Only if: {what}",
  "init.atk.note": "Note: on a failed {ab} save (DC {dc}): {what}",
  "init.atk.half": "half {n}",
  "init.atk.autoFail": "unconscious: fails automatically",
  "init.atk.notApp": "n/a",
  "init.atk.cancel": "adv/dis cancel out",
  "init.atk.laOff": "(don't deduct)",
  "init.atk.laDear": "Too costly ({n} left)",
  "init.atk.laNo": "Can't take a legendary action now",
  "init.atk.prev": "previous", // tag: vorige doel
  "init.atk.nobody": "Nobody to attack.",
  "init.atk.free": "Roll without a target",
  "init.atk.manual": "Manual: {mode}",
  "init.atk.normal": "normal",
  "init.atk.normalBoth": "Normal (adv and dis cancel out)",
  "init.atk.crit": "Critical hit!",
  "init.atk.hitW": "Hit",
  "init.atk.forced": "Hit (forced)", // uitslag na Toch raak
  "init.atk.force": "Count as hit", // knop na een misser
  "init.atk.miss1": "Miss (nat 1)",
  "init.atk.miss": "Miss",
  "init.atk.noAc": "AC unknown: compare yourself",
  "init.atk.critNear": "{name}: {conds} · a hit within 5 ft is a critical hit",
  "init.atk.noUf": "no Undead Fortitude ({why})",
  "init.atk.twoFail": "two failures",
  "init.atk.noRoll": "No damage roll in this attack.",
  "init.atk.dmgW": "damage", // kop per damage type zonder type
  "init.atk.resAria": "Resistance {type}",
  "init.atk.critBtn": "Critical", // schakelaar crit
  "init.atk.nextAtk": "Next: {name}", // volgende aanval van de multiattack
  "init.atk.closeLa": "Close (−{n} LA)",
  "init.atk.other": "‹ Other target",
  "init.atk.target": "target?", // paneeltitel: Bite → doel?
  "init.ini.monFixed": "Monsters: initiative fixed ({n}).",
  "init.ini.keep": "Keep",
  "init.ini.reroll": "Reroll",
  "init.ini.atStart": "Rolls at Start: d20 + Dex.",
  "init.ini.kept": "Entered or edited values are kept ({n}).",
  "init.ini.added": "Rolled when added.",
  "init.ini.surNone": "Surprised: anyone who didn't notice the other side when combat started (Stealth vs passive Perception). Single creatures: ⋯ → Surprised.",
  "init.ini.surSome": "Surprised creatures skip their first turn and have no reaction until it's over.",
  "init.ini.rowAria": "{name}: initiative {v}",
  "init.ini.empty": "empty",
  "init.ini.rollAria": "Roll initiative for {name}",
  "init.ini.clear": "Clear",
  "init.ini.next": "Next", // volgende rij in het initiative-paneel
  "init.log.turn": "turn {name}",
  "init.log.whyAria": "Reason for: {msg}",
  "init.log.whyPh": "Why? e.g. Fireball from Wolfim",
  "init.log.why": "Reason",
  "init.log.empty": "Nothing yet. Damage, conditions, spells, death saves and turns appear here automatically, with round and cause.",
  "init.log.title": "Log · round {n}",
  "init.log.tip": "Tap a line to add a reason.",
  "init.log.copy": "Copy as text",
  "init.log.count": { one: "{n} event", other: "{n} events" },
  "init.msg.concSave": "concentration save CON {dc} in the turn bar", // staart van een melding na schade
  "init.msg.concSaves": "{n} concentration saves in the turn bar",
  "init.cinfo.rep": "Repeat save", // regel in de conditie-uitleg
  "init.cinfo.from": "From", // regel in de conditie-uitleg: spell · caster
  "init.cinfo.conc": "(concentration)",
  "init.msg.recast": "{spell}: new cast by {name}. Ends on {names}.", // names = opsomming van oude doelen
  "init.msg.recastSl": "{spell}: new cast by {name} ({sl}). Ends on {names}.",
  "init.msg.join": "Same cast", // knop: het nieuwe doel hoort bij de vorige cast
  "init.msg.removed": "{name} removed.",
  "init.msg.noName": "Name can't be empty.",
  "init.msg.pasRange": "Passive is 1 to 40, or leave it empty.",
  "init.msg.effVal": "Enter a value.",
  "init.msg.effExh": "Set exhaustion via Condition → Exhaustion.",
  "init.msg.effRage": "Use the Rage preset.",
  "init.msg.effName": "Give the effect a name or a note.",
  "init.msg.toParty": "{name} is now in the party.",
  "init.msg.lairFill": "Enter a name and an effect.",
  "init.msg.dsNone": "No death save needed.",
  "init.msg.ds20": "{name}: nat 20, regains 1 HP.",
  "init.msg.dsDead": "{name}: {r}, third failure · died.",
  "init.msg.dsStable": "{name}: {r}, third success · stable.",
  "init.msg.ds1": "{name}: nat 1, two failures ({n}/3).",
  "init.msg.dsOk": "{name}: {r}, success ({n}/3).",
  "init.msg.dsFail": "{name}: {r}, failure ({n}/3).",
  "init.msg.parry": "{name}: Parry, the attack misses · reaction used",
  "init.msg.lastStep": "That was the last step.",
  "init.msg.oldWiped": { one: "{n} old monster cleared.", other: "{n} old monsters cleared." },
  "init.msg.ended": "Combat ended after round {n}.",
  "init.msg.popup": "The window was blocked. Allow pop-ups for this site.",
  "init.msg.svConcOk": "keeps concentrating",
  "init.msg.svConcFail": "concentration lost",
  "init.msg.svGone": "{name} ends", // conditie na een geslaagde save
  "init.msg.svStays": "{name} stays",
  "init.msg.svOk": "{ab} save succeeded",
  "init.msg.svFail": "{ab} save failed",
  "init.msg.selfRoll": "Roll manually: {names} (no {ab} save known).",
  "init.msg.laUsed": "{name}: {opt} (−{n} LA) · {left} left",
  "init.msg.dcFirst": "Enter the DC first.",
  "init.msg.monsFirst": "First choose the monsters that make a save.",
  "init.msg.dcRep": "Enter the DC: it's needed for the repeat save.",
  "init.msg.spNone": "nobody affected",
  "init.msg.spOk": "{n} succeeded",
  "init.msg.spImm": "{n} immune",
  "init.msg.diceFmt": "Dice like 8d6 or 2d6+3.",
  "init.msg.actRead": "This action couldn't be read. Use the AoE button in the turn bar.",
  "init.msg.aoe": { one: "{what}: {n} target, {dmg} damage", other: "{what}: {n} targets, {dmg} damage" },
  "init.msg.aoeDown": { one: "{what}: {n} target, {dmg} damage, {k} down", other: "{what}: {n} targets, {dmg} damage, {k} down" },
  "init.msg.rcUsed": "recharge used",
  "init.msg.crit": "(critical)",
  "init.msg.riderBar": "{ab} save DC {dc} in the turn bar",
  "init.msg.ok": "succeeded",
  "init.msg.fail": "failed",
  "init.msg.miss": "miss",
  "init.msg.parryAc": "{name}: Parry +{n} AC · reaction used",
  "init.msg.noInit": "No initiative yet for: {names}.",
  "init.msg.laLeft": "{name} −{n} LA, {left} left",
  "init.keys.or": "or",
  "init.keys.and": "and",
  "init.keys.space": "space", // toets
  "init.fight.nextTurnL": "Next turn",
  "init.keys.undo": "Undo",
  "init.keys.redo": "Redo (after Undo)",
  "init.keys.esc": "Close panel",
  "init.keys.num": "Type a number in the damage and initiative panels",
  "init.keys.help": "This overview",
  "init.keys.title": "Keyboard shortcuts",
  "init.keys.hint": "Next and Prev work in Combat, when no panel is open and not in an input field.",
  "init.card.dsMini": "Death saves: {s} succeeded, {f} failed",
  "init.sb.crit": "critical!", // losse worp met een natuurlijke 20
  "init.sb.fumble": "nat 1", // losse worp met een natuurlijke 1
  "init.sb.pinTip": "Pin column: a turn change won't change it",
  "init.sb.pinned": "Pinned",
  "init.sb.pin": "Pin",
  "init.sb.big": "Expand",
  "init.sb.half": "Half",
  "init.sb.custom": "Custom monster",
  "init.sb.preview": "Preview · not added yet",
  "init.sb.now": "Up now",
  "init.sb.next": "Up next",
  "init.sb.turn": "Turn:", // balkje met de naam van wie aan de beurt is (vastgezet)
  "init.sb.credit": "Source: System Reference Document 5.1 (2014), Wizards of the Coast, CC-BY-4.0, via Open5e.",
  "init.sb.pc": "Player",
  "init.sb.showAll": "Show all",
  "init.sb.ddb": "Imported from a D&D Beyond character sheet.",
  "init.sb.noSheet": "No sheet · add one via a D&D Beyond link or PDF",
  "init.sb.defVuln": "Vuln.",
  "init.sb.less": "Less",
  "init.sb.full": "Full stat block",
  "init.spell.loadFail": "loading failed",
  "init.spell.calc": "The app uses {ed} rules.",
  "init.spell.calcSheet": "The app uses {ed} rules ({name}'s sheet).",
  "init.spell.notLoaded": "{a} not loaded (offline?); this is the {b}.",
  "init.spell.only": "Only in the {src}.",
  "init.spell.cmp": "For comparison.",
  "init.spell.aka": "Also known as {name}",
  "init.spell.src": "Source: {src}.",
  "init.spell.err": "Spells couldn't be loaded ({reason}). Try again when you're online.",
  "init.spell.noSrd": "This spell isn't in the SRD (5.1 and 5.2), so the app doesn't have its text.",
  "init.spell.notFound": "Not found in the {a}; the {b} isn't loaded (offline?).",
  "init.spell.ddb": "Search on D&D Beyond ↗",
  "init.spell.loading": "Loading…",
  "init.spell.ed": "Edition",
  "init.aoe.tabsAria": "Damage or spell", // aria-label van de tabs in het AoE-paneel
  "init.sp.go": { one: "{spell} on {n} target", other: "{spell} on {n} targets" },
  "init.sp.pickDot": "Choose a spell.",
  "init.msg.acFirst": "Enter AC first (⋯).",
};
