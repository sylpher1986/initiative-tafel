// Kev’s Inn Initiative (DM-app): per scherm init.prep.*, init.fight.*, init.party.*, init.enc.*, init.set.*, init.room.*, init.tour.*.
// Sleutels beginnen met "init." (tests/i18n.test.js). Zelfde sleutels in elke taal; Engels is de terugval.
// Na een wijziging: node tools/i18n-build.mjs (maakt locales/<taal>.js, dat de app laadt).
export default {
  "init.sb.empty": "Voeg een monster of speler toe: het statblock of de sheet verschijnt hier.", // lege zijkolom (tablet)
  "init.add.title": "Toevoegen", // paneeltitel; js/ui/render.js zet hem per knop
  "init.add.kinds": "Soort monster", // aria-label van de tabs hieronder
  "init.add.list": "Uit de lijst",
  "init.add.custom": "Eigen", // eigen monster
  "init.add.enc": "Encounters",
  "init.pc.ddb": "D&D Beyond-link",
  "init.pc.fetch": "Ophalen",
  "init.pc.public": "Sheet moet op Public staan: Character Settings → Character Privacy → Public.", // menunamen van D&D Beyond blijven Engels
  "init.pc.pdf": "Of PDF-export van D&D Beyond…", // knop, opent de bestandskiezer
  "init.pc.name": "Naam",
  "init.pc.nameEg": "bijv. Thalia", // placeholder
  "init.pc.initPh": "worp + bonus", // placeholder
  "init.pc.rollTip": "d20 + init-bonus", // tooltip op Rol
  "init.pc.roll": "Rol",
  "init.pc.optional": "(optioneel)",
  "init.pc.check": "controleer", // achter een onzeker veld uit de sheet: "AC · controleer"
  "init.pc.bonus": "Init-bonus",
  "init.pc.bonusDown": "Init-bonus lager", // aria-label −
  "init.pc.bonusUp": "Init-bonus hoger", // aria-label +
  "init.pc.bonusHint": "Ook voor gelijke stand.",
  "init.pc.race": "Ras (icoon)",
  "init.pc.raceOther": "Anders / onbekend",
  "init.pc.lvlPh": "uit sheet", // placeholder bij Level
  "init.pc.slots": "Spellcaster? Spell slots invullen",
  "init.pc.sl1": "1e", // label per slot-level, smal
  "init.pc.sl2": "2e", // label per slot-level, smal
  "init.pc.sl3": "3e", // label per slot-level, smal
  "init.pc.sl4": "4e", // label per slot-level, smal
  "init.pc.sl5": "5e", // label per slot-level, smal
  "init.pc.sl6": "6e", // label per slot-level, smal
  "init.pc.sl7": "7e", // label per slot-level, smal
  "init.pc.sl8": "8e", // label per slot-level, smal
  "init.pc.sl9": "9e", // label per slot-level, smal
  "init.pc.party": "Ook opslaan in vaste party",
  "init.pc.add": "Speler toevoegen",
  "init.mon.search": "Zoek monster",
  "init.mon.searchPh": "naam, type of CR: undead cr 2-4", // placeholder; zoekwoorden blijven Engels
  "init.mon.searchHint": "Zoek op naam, type (undead, fiend…) of CR (cr 5, cr 1/2, cr 2-4, cr 10+).",
  "init.mon.hidden": "Verborgen voor spelers",
  "init.mon.anon": "Naam onbekend voor spelers",
  "init.mon.addSample": "Goblin toevoegen", // beginwaarde; js/ui/render.js zet de echte naam
  "init.set.look": "Weergave", // sectie in Instellingen
  "init.set.system": "Systeem", // thema
  "init.set.light": "Licht", // thema
  "init.set.dark": "Donker", // thema
  "init.set.react": "Reaction van spelers",
  "init.set.reactOn": "Knop",
  "init.set.reactOff": "Spelers zelf", // spelers houden hun reaction zelf bij
  "init.set.reactHint": "Spelers zelf: geen Reaction-knop op spelerskaarten. Monsters houden de knop. Verrast en Shield blijven werken.",
  "init.set.spellsHint": "Regels en uitleg van spells: de presets Barkskin, Haste en Sleep (alleen 2024), welke spells concentratie vragen, en welke tekst het spell-paneel toont.", // eerste zin; daarna volgt spellsOnly vet
  "init.set.spellsOnly": "Geldt alleen voor spells:", // vet
  "init.set.spellsRest": "de rest van de app (condities, crits, concentratie-DC) blijft 2014. Spelers met een D&D Beyond-sheet volgen per spell de versie op hun sheet; monsters, spelers zonder sheet en spells die niet op de sheet staan, volgen deze instelling. In het spell-paneel kun je de andere versie bekijken; dat verandert niets aan de regels. Wat al loopt, houdt de regels van het moment van casten.",
  "init.set.player": "Spelersscherm", // sectie in Instellingen
  "init.set.playerHint": "Spelers zien de volgorde, wie aan de beurt is en de HP van spelers. Nooit statblocks, notities of wat je verbergt (monsters via ⋯, de lair op zijn kaart).",
  "init.set.vis": "Wat spelers zien",
  "init.set.visMonHp": "HP monsters",
  "init.set.visNone": "Geen", // HP monsters: niet tonen
  "init.set.visOrder": "Volgorde", // initiative: alleen de volgorde
  "init.set.visNumbers": "Getallen", // initiative: getallen tonen
  "init.set.visTags": "Condities en effecten",
  "init.set.visAll": "Tonen",
  "init.set.visPc": "Alleen spelers",
  "init.set.visHide": "Verbergen",
  "init.set.visLog": "Wat er net gebeurde", // zelfde naam als het blok op het spelersscherm (player.log)
  "init.set.on": "Aan",
  "init.set.off": "Uit",
  "init.set.visHint": "Status = Ongedeerd, Gewond, Bloodied, Bijna dood. \"Wat er net gebeurde\": de laatste 2 regels (tv 3), alleen wat de lijst zelf ook toont. Geldt op dit apparaat, voor alle spelersschermen.", // statusnamen moeten gelijk blijven aan STATUS in js/playerview.js (WP28)
  "init.set.otherDevices": "Op andere apparaten",
  "init.set.roomNotStarted": "Delen met spelers is niet gestart. Ververs de pagina.", // alleen zichtbaar als js/ui/kamer.js niet laadt
  "init.set.thisDevice": "Op dit apparaat",
  "init.set.thisDeviceHint": "Een tweede venster van deze browser (tv via kabel, tweede scherm, tablet in split view). Werkt ook zonder internet. Op iPhone/iPad: open de site in Safari, niet de app op je beginscherm.",
  "init.set.openPlayer": "Open spelersscherm",
  "init.set.help": "Hulp",
  "init.set.tourAgain": "Rondleiding opnieuw",
  "init.set.keys": "Sneltoetsen",
  "init.set.helpHint": "Uitleg van de knoppen, bijvoorbeeld voor een co-DM. Tijdens een gevecht krijg je het gevecht-deel, anders het voorbereiden-deel; dat van het gevecht volgt bij Start gevecht.",
  "init.set.store": "Opslag",
  "init.set.storeHint": "Alles staat op dit apparaat. Maak af en toe een export: als backup, om naar een ander apparaat te gaan, of om je party met een co-DM te delen.",
  "init.set.expFile": "Exporteer als bestand",
  "init.set.expCopy": "Kopieer als tekst",
  "init.set.impFile": "Export importeren…", // knop, opent de bestandskiezer
  "init.set.impPaste": "Of plak de tekst van een export",
  "init.set.impGo": "Importeren",
  "init.custom.hint": "Voor monsters buiten de SRD. Ze worden in deze browser bewaard en verschijnen daarna gewoon in de monsterlijst.",
  "init.custom.name": "Naam",
  "init.custom.fromText": "uit tekst", // achter een veld dat uit de geplakte tekst is ingevuld: "CR · uit tekst"
  "init.custom.hp": "HP of dice",
  "init.custom.hpPh": "22 of 5d8", // placeholder
  "init.custom.dex": "Dex-score",
  "init.custom.text": "Statblock (plak tekst)",
  "init.custom.textHint": "Plak een statblock (bijv. van D&D Beyond): aanvallen, legendary actions, resistances en ability scores worden herkend en lege velden hierboven ingevuld.",
  "init.custom.save": "Monster opslaan",
  "init.custom.file": "Monsterbestand importeren (JSON)…",
  "init.custom.fileWith": "Werkt met", // daarna volgt de bestandsnaam vet
  "init.custom.fileRest": "uit de 5e-database van 5e-bits op GitHub (map src/2014/en) en met een Open5e-export. Je eigen JSON-lijst in hetzelfde formaat mag ook. Meerdere bestanden na elkaar importeren mag; ze worden samengevoegd.",
};
