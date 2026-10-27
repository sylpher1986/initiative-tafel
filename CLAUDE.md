# Kev’s Inn itiative: werkafspraken

Initiative/encounter tracker voor D&D 5e (2014) van Michiel (voorheen Initiative Tafel; onderdeel van Kev’s Inn). Eén DM, aan tafel op telefoon of tablet.
Live: https://kevs-inn.com (canoniek) en https://initiative-tafel.ft4mgzj72j.workers.dev; Cloudflare Workers publiceert automatisch bij push naar `main`.

Dit bestand bevat de geldende regels en keuzes. Open werk staat in `ROADMAP.md`. De volledige historie per pakket (WP1–WP45, met meetwaarden en afwegingen) staat in de git-geschiedenis: CLAUDE.md van commit `4e83db1`.

## Communicatie
- Nederlands, pragmatisch en technisch direct. App-teksten in Engels en Nederlands via de catalogus; in het Nederlands blijven D&D-termen Engels (Concentrating, Recharge, Legendary actions).
- Michiel werkt vaak vanaf zijn telefoon: geef instructies die zonder laptop uitvoerbaar zijn.

## Techniek
- Geen build-stap, geen dependencies: gewone ES-modules die de browser direct laadt. Geen framework of bundler zonder overleg.
- Spelregels puur en testbaar in `js/rules/` (geen DOM). UI in `js/ui/`. Toestand, undo en logboek in `js/state.js`.
- Regels-functies passen een deelnemer aan en geven `{ msgs, why }` terug: `msgs` = tekst via `say(sleutel, waarden)` (`js/rules/combat.js`), `why[].t` = descriptor `M(sleutel, waarden)` of `J(delen, scheiding)` (`js/i18n/msg.js`). Nooit een zin in `js/rules/`.
- Logregels in de stand hebben `m` (descriptor) óf `msg` (tekst) en `w` óf `why`; de export vult `msg`/`why` als tekst aan (`exportLog`). Tonen altijd via `logMsg`/`logWhy` (`js/log.js`), nooit `e.msg` rechtstreeks; een descriptor wordt alleen vertaald als elke sleutel bekend is (`descKnown`/`known`), anders wint de bewaarde tekst.
- Render past nooit data aan. UI-toestand (open kaart, panelen) staat in `ui` in `js/ui/render.js` en hoort niet in undo of opslag.
- Data lokaal in IndexedDB (`js/storage.js`). Export/import als JSON met `format`/`version` (`js/backup.js`, nu versie 3); bij een formaatwijziging: versie ophogen en een migratie toevoegen. Optionele velden mogen zonder nieuwe versie (een oudere app laat ze weg).
- Alles uit een bestand, import of de lijn is onbetrouwbaar: opschonen (`cleanCombatant`, `sanitizeOwn`, `cleanView`, `cleanDesc`) en altijd `esc()` bij HTML.
- Paden in JS altijd absoluut (`/icons/ui.svg`, `/data/monsters.json`); enige uitzondering `window.open("player/")`.
- Browser-valkuilen die al eens misgingen:
  - geen `color-mix` en geen `backdrop-filter` (oudere iPads); `:has` alleen voor verfraaiing (zoals de meldingenpositie), niet voor wat moet werken;
  - invoervelden ≥ 16 px (iOS-zoom); focus zetten **in** de tik, niet uitgesteld (anders geen toetsenbord op iOS);
  - het iOS-cijferpad heeft geen minteken: een veld dat negatief mag zijn krijgt geen `inputmode="numeric"`;
  - `inert` werkt niet op Safari < 15.5: toetsen ook in `onKey` blokkeren;
  - geen "share" in id's/classes/data-attributen (Safari-contentblokkers verbergen ze);
  - de klasse `dim` alleen op `<div class="dim" data-…>` (paneel-achtergrond; `tests/klassen.test.js`).
- Panelen staan in een `.sheet-wrap`: rondleiding, sneltoetsen (`panelOpen`) en de positie van meldingen herkennen een paneel daaraan.
- `c.max` 0 betekent "HP onbekend": een effect of exhaustion zet max HP nooit lager dan 1 (op 0 = dood via de regels).
- Undo dekt alleen `S`. Wijzigingen aan partyleden die niet aan tafel zitten, encounters en spellnotities vallen erbuiten; wissen daarvan krijgt een eigen Ongedaan-knop. Normalisatie (`tidy`) draait in `commit()` én `resetBaseline()`, anders wordt hij een onuitwisbare undo-stap.
- Geen meldingen, pop-ups of stippen die bij het opstarten aan tafel verschijnen; herinneringen staan als strook in Voorbereiden.
- Geen CSP in de repo (geen `_headers`). Komt die er, dan hebben de inline scripts (thema, launch, foutbalk) een hash nodig.

## Meertaligheid (geldt voor elke tool)
Regels in het kort; het hoe, de stappen voor een nieuwe tool of taal en de reviewchecklist staan in `docs/i18n.md` §9.
- **Route**: Engels zonder taalcode `/{tool}/`, andere talen `/{lang}/{tool}/` (+ `…/<subpagina>/`), homepage `/` en `/{lang}/`; `/en/…` = 301 (Worker en sw; regel nooit weghalen). Padsegmenten Engels in elke taal. Taal komt uit `<html lang>` van de gegenereerde pagina, uit het pad alleen via `langFromPath`; adressen alleen via `pathFor`/`switchPath`/`joinUrl` (`js/i18n/lang.js`), nooit `"/en/"` of `"/{lang}/"` in een string. Geen automatische taalredirect, behalve `launchRedirect` in een geïnstalleerde app.
- **Pagina's** alleen als sjabloon in `pages/` met `{{lang}}`, `{{base}}` (`""` voor Engels), `{{t:…}}`/`{{tjs:…}}`, gegenereerd door `node tools/pages.mjs` (regel in `APP_PAGES`). Nooit letterlijke tekst in een sjabloon.
- **Tekst** alleen via `t(sleutel, params)` uit `js/i18n/boot.js`, aangeroepen bij het tekenen (nooit op moduleniveau), `esc(t(…))` in HTML. Geen HTML in een catalogus; vet midden in een zin via `tb`; opsommingen als array-param; Ongedaan-knop via `undoBtn()`.
- **Catalogi** per tool een namespace: `locales/src/{en,nl}/<tool>.js` met eigen voorvoegsel (regel in `NS`, `tools/i18n-build.mjs`); gedeeld in `common.*`, D&D-uitleg in `dnd.*`, paginatekst in `page.*`. Eerst Engels, dan Nederlands; één sleutel = één betekenis; daarna `node tools/i18n-build.mjs`. Engelse stijl en woordenlijst: `docs/i18n.md` §3.2.1. Engelse tekst laten nalezen door een aparte vertaalagent met D&D-kennis.
- **Pure code** geeft codes of descriptoren terug, nooit een zin. Opgeslagen descriptoren worden bij import opgeschoond (`cleanDesc`, voorvoegsel-allowlist).
- **Id's, geen labels** in opslag, export, snapshot en logica: D&D-termen als Engelse id, label via `term(kind, id)`; logica nooit op een vertaalde tekst.
- **Gebruikersinhoud wordt nooit vertaald** (namen, notities, eigen monsters, encounters, sheetdata); een opgeslagen standaardtekst wordt in de actieve taal geschreven en is daarna inhoud.
- **Snapshot en API zonder UI-tekst**: codes over de lijn, de ontvanger vertaalt. Een Worker-/AI-aanroep die tekst teruggeeft krijgt `lang` mee.
- **Bewaking**: `npm test` (pariteit, placeholders, actualiteit, ongebruikte sleutels, ratel op Nederlandse tekst in `tests/i18n-baseline.json`), browsercheck met `--lang=nl,en` en `--i18n=xx` (een `⟦` op het scherm is FOUT). Een nieuw sjabloon in `auditFiles` (`tools/i18n-audit.mjs`) en `codeFiles` (`tests/i18n.test.js`); door de code samengestelde sleutels in `DYNAMIC`.

## Twee vaste reviewers (verplicht)
Bij elk nieuw idee of elke wijziging kijken twee rollen mee, waar mogelijk als **aparte agent** die het werk niet zelf maakte.

**Senior UX-designer: vóór het bouwen** (alleen bij een zichtbare wijziging met meerdere redelijke opties)
- Bekijkt het vanuit het gebruik aan tafel: één DM, telefoon in de hand, snel, soms zonder internet.
- Zet minstens twee opties naast elkaar, kiest en zegt waarom (aantal tikken, duimbereik, tikdoelen ≥ 44 px, leesbaarheid, wat er weg kan). Bij grotere wijzigingen eerst een schets of mockup ter goedkeuring.
- Bewaakt consistentie met de keuzes hieronder, inclusief wat daar als afgewezen staat.

**Senior developer: na het bouwen, vóór de push**
- Scope: de diff plus wat er direct aan raakt (aanroepers, bijbehorende regels in `js/rules/` en hun tests). Volledige review bij een `x.y.0`- of `x.0.0`-versie, een formaatwijziging in `js/backup.js`, of op verzoek. `npm test` draait altijd volledig.
- Logica tegen de 5e 2014-regels en randgevallen (0 HP, dood, lege lijst, undo, import van oude of rare data); dekken de tests het?
- Eenvoudigste oplossing: geen dubbele code, geen onnodig werk per tik, regels puur, render zonder bijwerkingen.
- Veiligheid (escapen, import opschonen) en geen verlies van bestaande functionaliteit.
- Bij tekst, pagina's of opgeslagen data: checklist `docs/i18n.md` §9.5.

Meld bij oplevering in één of twee regels wat beide reviewers vonden en besloten.

## Bij elke wijziging
1. `npm test` (Node 18+, geen installatie); nieuwe regels-logica krijgt een test.
2. Browsercheck op 320, 360 en 390 px, licht en donker: geen horizontaal scrollen (`node tools/browsercheck.mjs`, per pakket een scenario in `SCEN`).
3. Versie ophogen in `js/version.js`, `sw.js` én `<meta name="it-version">` in `pages/initiative.html`, daarna `node tools/pages.mjs` (tests bewaken gelijkheid). Schema: `x.y.z` kleine aanpassing, `x.y.0` grotere, `x.0.0` volledig nieuw. Alleen documentatie of bestanden buiten de app: geen versie.
4. Commit in het Nederlands, push naar `main`.
5. Na afloop: keuze toevoegen of bijwerken onder "Gemaakte keuzes" (kort: wat geldt, waar het zit, wat is afgewezen) en het punt uit `ROADMAP.md` halen.

Geplande bouwtaken: een geplande taak die een **nieuwe sessie** start, krijgt de repo niet en kan niet pushen (403). Plan bouwwerk als vervolgtaak in hetzelfde gesprek waar de repo gekoppeld is en `git push --dry-run` slaagt. Lukt pushen toch niet: werk als patch in het claude.ai-project, "NIET GEPUSHT" in de status, melding sturen.

## Gemaakte keuzes

### Basis
- Regels: D&D 5e **2014**; spells kunnen ook 2024 (zie Spells). Data: 322 SRD 5.1-monsters (`data/monsters.json`, Open5e), 319 SRD 5.1-spells (`data/spells.json`, 5e-bits, `tools/spells_srd.py`) en ter uitleg 339 SRD 5.2-spells (`data/spells-2024.json`, Open5e, `tools/spells_srd2024.py`), alle CC-BY-4.0. Geen niet-SRD content in de repo.
- Local-first zonder accounts (fase 2 = sync, zie roadmap G2). Hosting op Cloudflare Workers: statische assets (`wrangler.jsonc`, uitsluitingen in `.assetsignore`), alleen `/api/*`, `/en`, `/en/*` lopen via `worker/index.js` (`run_worker_first`). Workers gekozen omdat AI later een server-sleutel nodig heeft.
- Naam **Kev’s Inn itiative** (`APP` in `js/version.js`; manifest `short_name` "Inn itiative"). Bewust **niet** hernoemd: `FORMAT`/`ENC_FORMAT` ("initiative-tafel…"), IndexedDB-naam, `it-*`-sleutels, BroadcastChannel, sw-cachevoorvoegsel, Worker-user-agent, repo/URL.
- Foutbalk (inline script in `pages/initiative.html`, `window.__itErr`) en `<meta name="it-version">` ("· pagina X" in Instellingen bij een versieverschil) blijven voor diagnose op de telefoon.

### Modi en indeling
- **Modus = toestand**: zonder gevecht altijd Voorbereiden; tijdens een gevecht Gevecht, tenzij de DM naar Voorbereiden gaat (`mode()`, `ui.mode`). Geen tabs of seg-knop.
- Voorbereiden: fase-aanduiding "1 Voorbereiden — 2 Gevecht" (niet tikbaar); dockrij **[+ Monster] [+ Speler] [Party] [⚙]** opent `#psheet` met statische formulieren (alleen `hidden` wisselt, nooit `innerHTML`: listeners, lopende ophaal en gekozen PDF blijven). Kaarten zijn om in te richten (`prepFields`/`prepActions`): geen Schade/Heal/Reaction/aanvallen. Velden slaan op bij verlaten **zonder render** (`prepField` + `commit()`), `main.js` rendert na `focusout`/`pointerup`; Enter = blur. Dit patroon geldt voor alle direct invulbare velden (kaart, level, logreden, encounter-aantal).
- Gevecht: eigen kop `.fhead` ("Gevecht · Logboek ▸", ronde, Party/Vijanden, ✎ Voorbereiden (onder 480 px alleen icoon), + snel toevoegen). Voorbereiden tijdens een gevecht: amberbalk "Gevecht loopt", dock = prep-rij + [↶][Terug naar gevecht]. In de kop geen goud of rood en geen zijstreep.
- Welkomstkaart bij lege lijst én party ("Start met voorbeeld" / "Begin leeg", import-link); voorbeeld-banner zolang `S.sample`. "Encounter wissen" en "Gevecht afronden" onder de lijst, bewust buiten duimbereik.
- Rondleiding (`js/tour.js` puur, `js/ui/tour.js`): deel p na de welkomstkeuze, deel f na de eerste Start; nooit bij opstarten; overlay met `inert` op de rest; gezien in `it-tour`; opnieuw via Instellingen → Hulp. Afgewezen: één doorlopende tour, losse hints op de plek.
- Instellingen in `<details class="setsec">`-secties met status in de kop; alles dicht bij opstarten, niet bewaard; Spelersscherm/Opslag gaan vanzelf open bij kamerprobleem of exportherinnering.
- Eén kaart tegelijk open (standaard wie aan de beurt is). Scrollen via `reveal(el)` (boven dock/statblock, niet boven 64 px); de aangetikte kaart blijft op zijn schermplek (`keepCard`, `overflow-anchor:none`).
- Tikdoelen ≥ 44 px overal (pips en death saves zijn zelf 44 px-knoppen met het bolletje als `::before`; `tests/tap.test.js`). Uitzondering: tikbare worpen inline in statblocktekst (`.dice`, WCAG-uitzondering, ruimere regelafstand). Hoofdknop van een paneel plakt onderaan (`.sfoot`).
- Meldingen (`js/ui/util.js`): stapel boven de dock, max 3, 5 s (met knop 7 s); **alleen de nieuwste melding houdt knoppen** (Ongedaan draait altijd de laatste stap terug); met een open paneel bovenaan. `toastBad` alleen bij weigeringen en fouten (icoon + verborgen "Let op:", geen `role="alert"`).
- Bestandskiezer = verborgen `<input type="file">` + echte knop `data-file` (geen label om de input).
- Sneltoetsen (`js/ui/keys.js`, alleen modus Gevecht zonder open paneel): N/spatie Volgende, Shift+N Vorige, ⌘Z/⌘⇧Z (Ctrl+Y), "?" = overzicht. Bewust geen toetsen voor schade/condities/AoE.

### Spelers en D&D Beyond
- Spelers handmatig, via **D&D Beyond-link** (publieke sheets) of de PDF-export (`js/ddb.js`, pdf.js zelf gehost in `vendor/pdfjs/`, eigen sw-cache `VENDOR`) als terugval.
- Worker `GET /api/ddb/:id` geeft de onofficiële character-service-JSON ongewijzigd door (niet parsen: CPU-limiet 10 ms; geen cache) en `/avatar` haalt het portret met de url uit de data. Geen open proxy: numerieke id's, vaste hosts, geen CORS, limieten. Parser puur in `js/ddbjson.js`: AC/HP berekend, onzekere waarden gemarkeerd ("· controleer").
- Opnieuw ophalen werkt de bestaande speler bij (op `ddbId`, anders unieke naam) via een bevestigvak (`mergeSheet`); schade en verbruik blijven. Ook vanuit Party ("↻ Bijwerken", `partyUpdate`: onzekere AC/max HP overschrijven geen bestaande waarde). Geen "Alles bijwerken".
- + Speler: geen initiative buiten een gevecht (`init: null`, gevraagd bij Start), één stepper Init-bonus, eigen foutregels (`pcValid`), bestaand partylid → bijwerken/aan tafel via `seatPlan` (nooit een tweede deelnemer voor hetzelfde lid). Melding met Ongedaan (haalt ook een net aangemaakt partylid weg). Vinkje "Ook in vaste party" per apparaat (`it-pc-party`).
- Resistances per speler `c.dr = { r, i, v }` (via ⋯ "Wijzig ▸", uit de sheet via `drOf`, eigen toevoegingen blijven bij bijwerken). Gebruikt in AoE en aanvalspaneel (`targetMode`); bewust niet op kaart of spelersscherm.
- Passives (`js/rules/passives.js`): eigen waarde > sheet > senses > 10 + skill; regel op de kaart in Voorbereiden en in het initiative-paneel; invullen via ⋯; nooit op het spelersscherm.
- Editie per sheet-spell (`spellEd`): 2014 als alle bronnen 2014 zijn, anders 2024; `edFor(caster, naam, instelling)` kiest per caster.
- Avatars (`js/ui/avatar.js`): portret (link/PDF, max 128 px) > icoon op ras > algemeen; monsters icoon op creature type (game-icons.net, CC BY 3.0, `icons/creatures.svg`). Geen echte monsterafbeeldingen (geen vrije bron).

### Voorbereiden: monsters en encounters
- Zoeken (`parseQuery`/`filterMonsters`, `js/data/monsters.js`, puur): één veld; alle woorden moeten passen op naam, type of subtype; CR-filter (`cr 5`, `cr 2-4`, `cr 10+`); Nederlandse synoniemen (`locales/<taal>/search.js`) en typfouttolerantie alleen bij 0 treffers; tijdens typen wint een exacte naam. Geen filterchips.
- Toevoegblok gedeeld door Monster-paneel en snel toevoegen (`addBlockHtml`): Aantal, HP Gemiddeld | Rollen, Initiative Per monster | Groep | Invullen. Verborgen/naam onbekend staan na elke toevoeging weer uit.
- Preview (`monCard`) en op tablet/desktop het statblock als "Voorbeeld" in de zijkolom tot er iets toegevoegd wordt.
- Eigen monster uit plaktekst (`js/data/statparse.js`, puur): de plaktekst blijft de bron in opslag; herkend wordt live getoond; niet-herkende regels worden de trait "Other"/"Overig" (pas bij tekenen vertaald).
- Encounters (`js/rules/encounters.js`, UI `js/ui/encounters.js`): bibliotheek in IndexedDB (`encounters`), niet in undo; `id` + `updatedAt` (sync-klaar). Derde tab in het Monster-paneel. Inladen bij een gevulde lijst vraagt Vervangen | Toevoegen; één undo-stap en één logregel (`logAs`). Delen/import per encounter met statblocks erbij (nooit stil overschrijven). Grenzen: 1–50 per regel, 40 regels, 100 monsters, 500 encounters.
- Ingeladen encounter: kopie van naam en notitie in `S.enc` (strook "Tactiek ▸"), **nooit op het spelersscherm**.
- Moeilijkheid (DMG 2014, `difficulty`): XP uit de CR-tabel, multiplier op aantal en partygrootte; monsters met XP < 1/10 van het sterkste tellen niet voor het aantal ("Toch meetellen", `S.allMon`). Level uit de sheet of het veld `lvl` (bij de party), nooit gokken; invullen in de uitleg. Deadly-uitleg zegt wat er weg moet voor Hard (`deadlyTip`). Alleen in Voorbereiden.

### Initiative en beurten
- Start gevecht met levende spelers opent het initiative-paneel (`#isheet`, eigen cijferpad, Rol = d20 + `initBonus ?? dex`); zonder spelers start het direct. Monsters: **Houden | Opnieuw rollen** (`it-init-reroll`; alleen onaangeroerde worpen). Verrast: **Niemand | Monsters | Spelers**; zonder spelers de schakelaar "Monsters verrast" naast Start. Alles in één undo-stap met de start.
- Monsters uit het vorige gevecht bij Start: vraag in de dock (Oude wissen en starten / Toch starten).
- Surprise (PHB 2014): verrasten slaan ronde 1 over (`c.sur`), reaction uit; individueel via ⋯.
- Groepen (`grp`, `groupOf`) zijn **alleen weergave**: elk lid houdt een eigen beurt (recharge, saves, condities). Afgewezen: één groepsbeurt.
- Initiative wijzigen tijdens een gevecht (`initPlan`, `turnOrder`, `S.ai`): al geweest en naar achteren = deze ronde overgeslagen; zelf aan de beurt = beurt loopt door; nog niet geweest en naar voren = direct na de huidige beurt. Geen Delay/Ready-knop.
- Verwijderen via ⋯: één tik met Ongedaan; wie aan de beurt is, eindigt eerst zijn beurt (`removeCombatant`). "Uit party" houdt zijn bevestiging (niet in undo).
- Monsters op 0 HP in Gevecht onderaan in een ingeklapt blok **Neer (N)**; dode spelers blijven staan.
- Volgende encounter: "Encounter wissen" → "Monsters wissen, spelers houden" (`clearMonsters`) of Alles.

### Gevecht: kaarten en panelen
- HP-rij is in Gevecht een eigen knop (`.khp`) die het schadepaneel opent. Schade via cijferpaneel met tabs Temp HP; Immuun/Resist; Parry-knop bij monsters met Parry.
- Statblock en speler-sheet (`js/ui/statblock.js`): telefoon half hoog boven de dock, volgt de beurt tot Sluit; tablet/desktop zijkolom altijd gevuld, volgt de beurt, Vastzetten; speler zonder sheet toont vooruit het volgende monster (`readAhead`).
- Aanvallen op de monsterkaart (`js/rules/attacks.js`): bij wie aan de beurt is open (max 4 + "+N meer"), anders ingeklapt; spelersaanvallen bewust niet (die rollen zelf). To-hit opent het **aanvalspaneel** (`#xsheet`): doel kiezen, Auto-advantage uit condities (PHB 2014), altijd twee d20's, crit verdubbelt dice, resist per type, Shield +5 / Parry bij een net-treffer, save-riders ("Daarna · STR DC 11 · of Prone"), multiattack-volgorde (`multiSeq`), vanuit het legendary-paneel "−N LA".
- Legendary actions (`js/rules/legendary.js`): vaste regel in de dock (chips of paneel bij 3+); uit bij eigen beurt, 0 over of incapacitated. De app dwingt "einde beurt van een ander" niet af.
- Save-acties op de kaart (DC + schade) openen het AoE-paneel met alles ingevuld; recharge gaat bij toepassen op "op".
- AoE (`js/rules/aoe.js`): één worp, per doel save en Normaal/Resist/×2/Immuun (eerst save, dan resist), resist uit statblock of opgeslagen spelers-resistances. Tab **Spell** (`js/rules/spellcast.js`): presets (Bless, Bane, Hold Person, Hypnotic Pattern, Web, Sleep 2024) en + Eigen, caster-DC, doelen met standaardselectie, Rol monsters, concentratie bij de caster. Schade-spells (Fireball e.d.) in tab Schade via caster-chips/zoeken (`js/rules/dmgtable.js`, gegenereerd door `node tools/dmg_spells.mjs`), upcast en cantrip-schaal.
- Slots (`js/rules/slots.js`): segment per cast met slimme standaard (vrij Pact, dan laagste passende slot, "Zelf"); niet blokkeren bij 0 over. Pact Magic apart (`casting.pact`, terug bij elke rust). Shield en concentratie-presets via Effect schrijven automatisch af.
- Effecten (`js/rules/effects.js`): presets (SRD) of eigen (AC +/−/wordt/minimaal, max HP ±, notitie) met duur; concentratie-effecten hangen aan de caster; opnieuw casten in een latere beurt vervangt de oude doelen ("Hoort erbij" voor dezelfde cast); Haste → Lethargy; Rage (`startRage`, rage damage, resistances via `withEff`, loopt door/voorbij-check). Eigen effect met de naam Exhaustion of Rage wordt geweigerd.
- Condities: chips in de open kaart openen de uitleg (`#csheet`, `js/ui/condinfo.js`, ook op het spelersscherm, niet op de tv). Exhaustion is een effect met niveau (4+ halveert max HP, 6 = dood, long rest −1, vanaf 3 disadvantage). Duur en herhaalsaves via `makeDur`/`cd.save`.
- Open saves (`js/rules/saves.js`, `S.saves`): condition-saves openen bij het begin van de beurt van het doelwit, concentration saves uit de schade (DC max(10, ½)); ≤ 2 als regel in de dock, daarboven een paneel; vervallen na één beurtwissel **met melding** (afgewezen: laten staan tot beantwoord); monster zonder bekende savebonus = ✓/✗ "zelf rollen".
- Monsterregels (`js/rules/monrules.js`): Undead Fortitude rolt bij toepassen (niet bij radiant/crit; afgewezen: als open save, dan hangt het monster op 0 HP in Neer); save-riders; Parry.
- Death saves: "Rol death save" of "Eigen worp" met eigen cijferpad (`dsResult`); stabiel en toch geraakt = opnieuw beginnen.
- Reaction: label "Reaction op" (`reactUsed`); per apparaat "Reaction van spelers: Knop | Spelers zelf" (`it-pc-react`, alleen weergave).
- Spell-uitleg (`js/ui/spellinfo.js`, `#rsheet`): tik op spellnamen in statblock, sheet, slots en (buiten de tegel) in AoE/Effect; nooit op een preset-tegel zelf. Laadt beide edities bij de eerste tik; niet-SRD: sheetgegevens + eigen notitie (`js/data/spellnotes.js`, IndexedDB `spellNotes`, in export versie 3) + "Zoek op D&D Beyond ↗".
- Spells 2014 | 2024 (Instellingen, `it-spell-rules`): geldt alleen voor spells (presets via `presetsFor(ed)`, concentratie via `isConc`, `js/rules/conclist.js` gegenereerd door `tools/conc_lists.py`); de rest blijft 2014 (de hinttekst in Instellingen moet mee als dat verandert). Regels krijgen de editie als parameter, nooit uit de instelling.

### Gevecht afronden, undo en logboek
- Gevecht afronden (`finishFight`, `js/ui/einde.js`): één undo-stap, paneel `#esheet` met rondes, duur, ruwe XP (DMG 2014) per speler, verslagen, gevlucht-chips, condities van spelers wissen; sluit op de telefoon het statblock. Beurtbalk toont "Alle monsters neer · Gevecht afronden". Niet automatisch stoppen.
- Undo (`js/state.js`): elke stap in IndexedDB (`h:…`, sheets/portretten apart via `js/histpack.js`), na herladen hersteld tenzij de laatste stap > 6 uur oud is of van een andere versie; max 80. Opnieuw alleen in het geheugen (melding na Ongedaan, ⌘⇧Z). Melding na Ongedaan/Opnieuw beschrijft de stap uit de logregels (`stepText`).
- Logboek: hele regel tikbaar voor een reden; in Gevecht als paneel `#gsheet` via de kop; ronde 0 heet "Voorbereiding".

### Opslag en data
- Eén DM-tabblad tegelijk (`js/tablock.js`, `it-tab`): het nieuwste wint, het oude krijgt een afdekkend stopscherm met "Hier verder werken"; write-guard in `js/storage.js`.
- Exportherinnering (`js/exportnudge.js`): strook in Voorbereiden als waardevolle data (party, lairs, encounters, eigen monsters, spellnotities) ≥ 14 dagen niet geëxporteerd is; Later = 7 dagen. Geen melding of stip. Export via deelmenu of download (`exportFile`), bestandsnaam in lokale tijd.
- Backup: versie 1 → 2 (`encounters`) → 3 (`spellNotes`), migraties in `js/backup.js`; volledige import vervangt alles en wist de undo-geschiedenis.

### Spelersscherm
- Krijgt alleen de snapshot uit `toPlayerView` (`js/playerview.js`), nooit de volledige toestand; taalneutraal (`v: 2`, codes, ontvanger vertaalt); ontvangen data altijd door `cleanView`.
- Verraadt niets: `toPlayerView` bouwt elke rij expliciet (whitelist, nooit een spread), zodat passives, resistances en monsterslots niet lekken. Zonder gevecht alleen spelers; verborgen monsters bestaan niet, ook hun beurt niet (de laatste zichtbare beurt blijft staan; geen vlag in de snapshot die dat verraadt); "Naam onbekend voor spelers" (`c.anon`, "Unknown creature N" met eigen icoon; verborgen monsters tellen niet mee in de nummering; nooit vanzelf onthuld, ook niet bij Neer); encounternaam/-notitie nooit.
- Zichtbaarheid per DM-apparaat (`it-player-vis`): monster-HP Status/Geen/Exact, initiative Volgorde/Getallen, condities Tonen/Alleen spelers/Verbergen, "Wat er net gebeurde" Aan/Uit. Spelers-HP altijd exact.
- Transport `js/share.js`: `localChannel` (BroadcastChannel, ook offline) en `roomChannel` (WebSocket naar Durable Object `Room`, `worker/room.js`). Kamer: code van 6 tekens, token alleen als hash, eigenaarscontrole alleen in `isOwner`, rate-limit `ROOM_LIMIT` per IP, limieten op berichten/portretten/schermen. Pauze na 30 min zonder wijziging, weg na 12 uur; "Stop met delen" = pauze (zelfde code), "Nieuwe code…" alleen met bevestiging. Spelerslink in de taal van de DM-pagina (`joinUrl`), QR via eigen encoder (`js/qr.js`). Portretten gaan als data via de kamer (één keer per id), niet als `/api/ddb`-url. Geen "(was 3)" bij het aantal schermen (vals alarm zonder scherm-id per tabblad).
- Verbinding: spelerskant toont "Geen verbinding · stand van HH:MM" en dimt de lijst, na 2 min weg; "De DM is even weg" na 45 s zonder DM (`dmnet`). Een oude stand mag op een tv nooit als live lezen.
- "Dit ben ik" per apparaat (`it-pv-me`): eigen kaart met HP, death saves en slots, "Jij bent aan de beurt", trillen waar mogelijk.
- Tv (`body.tv`: liggend, ≥ 900 × ≥ 501): één brede regel per deelnemer, letter passend op de hoogte (`js/tvfit.js`), twee kolommen als dat groter uitvalt; QR rechtsonder in de wachtstand.
- Mini-log "Wat er net gebeurde": alleen afgeleid uit twee opeenvolgende snapshots (`logLines`), nooit uit het DM-logboek.

### Huisstijl
- **Kleurtokens** in één blok bovenaan `css/app.css` (licht `:root`, donker twee keer gelijk); componenten zonder hex; `tests/contrast.test.js` bewaakt WCAG 2.2 AA over alle paren en beide thema's. Homepage-tokens in `pages/home.html` moeten gelijk blijven (test).
- **Eigenaarschap**: goud (Lantern `--act`) = primaire actie, focus, beurt, selectie; **één gouden knop per context** (op het Gevecht-scherm alleen Volgende); in licht tekst/ringen in `--act-ink`. Groen gelukt, amber aandacht, rood alleen fout/destructief/kritiek, blauw info/delen. "− Damage" heeft eigen tokens (`--dmg*`), niet goud.
- Merkpalet: Walnut #241811, Dark Oak #3a281e, Lantern #e3a83b, Parchment #e9ddc4, Warm Ivory #faf6ec; statuskleuren met afgeleide tinten per thema (waarden en waarom in het commentaar bij het tokenblok). Donker is volledig warm, zonder ivoren vlakken (knoprand `--btn-line`, meldingen `--toast-*`).
- **Speler/monster via vorm, nooit via kleur**: speler rond, monster achthoek, lair afgeronde rechthoek (`avKind`/`avBox`), neutrale rand; monsters op de DM-lijst ook een neutrale zijstreep. HP-kleur alleen uit `hpCls`/`hpPct`, gelijk voor iedereen (`tests/wp36.test.js`). Afgewezen: Forest/Copper als identiteit (botsen met Success/Warning), schild als vorm (botst met het AC-schildje).
- Beurt = Lantern-vlak achter de initiative + ▶ (+ `aria-current`); geopend = ring `--sel`.
- Componenten: secundaire knop `--btn` met `--btn-line`-rand; schakelaars ingedrukt `--act-soft` + `--sel`-rand; `.seg`/`.seg2` één patroon (onderstreep); paneeltjes binnen een kaart zonder eigen rand op `--sunk`; radiusschaal `--r-s`/`--r`/`--r-l`; chips rond, `.tag` rechthoekig; lege toestanden gestippeld.
- **Letters**: DM Sans (`--body`) en Newsreader (`--brand`, alleen h1, statblock-naam, welkomstkaart, stopscherm, afrondpaneel), zelf meegeleverd in `fonts/` (Fontsource, OFL, ongewijzigd). DM Sans heeft geen tabular-nums: uitlijning via vaste breedtes (`.hpn` 7ch, initiative-kolom). Nieuw lettertype = `fonts/` + `@font-face` + `sw.js` (tests). Afgewezen: root-letter 15 px, afkortingen ("React."), condensed of negatieve letter-spacing op lopende tekst; krapte per onderdeel oplossen.
- Lijn-iconen in de sprite `icons/ui.svg` via `ico()` (`js/ui/icons.js`); icoonknoppen hebben een `aria-label` (`tests/icons.test.js`).
- Embleem (zeshoek + lantaarn, `EMBLEM` in `tools/icons.mjs`) inline in de h1; app-iconen en favicon via `node tools/icons.mjs`; logobronnen in `brand/` (niet gepubliceerd). Logo-vorm niet wijzigen.
- Homepage (`pages/home.html`): eigen inline CSS zonder app.css, werkt zonder JS; hero met illustratie (`img/hero-tavern-*`, niet in de offline-cache), één toolkaart (alleen tools die bestaan), taalkiezer als links; thema volgt de app-keuze `it-theme` (inline script), anders het systeem.
- Weergave Systeem/Licht/Donker per apparaat (`js/theme.js`, `it-theme`, gezet vóór de eerste paint).

### Meertaligheid: implementatie
- Runtime `js/i18n/` (puur): `createI18n`/`t` (placeholders, meervoud `{one, other}`, array = opsomming, terugval actieve taal → Engels → sleutel), `initI18n` laadt de catalogus vóór de eerste render (max 3 s, gooit nooit), debugstand `?i18n=debug|xx|off`.
- Catalogi: bron `locales/src/<taal>/<namespace>.js` → `node tools/i18n-build.mjs` → één bestand per taal `locales/{en,nl,xx}.js`.
- Taalkiezer (`js/ui/langpick.js`): seg "Nederlands | English" in Instellingen → Weergave en op het spelersscherm; voorkeur `kevs-lang`; wisselen = `location.replace(switchPath(…))`. Bestaande gebruikers kregen eenmalig `nl` (`adoptExisting`).
- Geïnstalleerde app: manifesten houden `id "/"`, `scope "/"`, `start_url "/initiative/"`; `launchRedirect` (inline script vóór de eerste paint in de Engelse app-pagina, vangnet in `main.js`) kiest in standalone keuze-in-venster → voorkeur → browsertaal → Engels.
- SEO: canonical, hreflang (`en` en `x-default` naar `https://kevs-inn.com/`, `nl` naar `/nl/`), Open Graph en sitemap uit `tools/pages.mjs`; app-pagina's `noindex`; `HIDDEN = true` = `robots.txt` `Disallow: /` (site nog verborgen); op `false` komt er géén Disallow, want de `noindex` van de app-pagina's moet leesbaar blijven. 404-pagina's per taal (`not_found_handling: "404-page"`).

### Gereedschap
- `tests/`: `npm test` (± 680 tests, ± 10 s), o.a. syntaxcheck van alle JS, contrast, fonts, iconen, tikdoelen, pagina's, i18n, versies.
- `tools/browsercheck.mjs`: matrix 320/360/390 × licht/donker met touch, telt horizontaal scrollen en JS-fouten (FOUT) en tikdoelen < 44 px; `--lang=nl,en,xx`, `--shots=naam` → `shots/` (gitignored). Playwright via `PW_MODULE` of `/opt/npm-tools`, niet in package.json. Na een schrijfactie in IndexedDB pas herladen als de waarde er echt staat (`idbHas`).
- Gegenereerde bestanden: pagina's/manifests/robots/sitemap (`tools/pages.mjs`), catalogi (`tools/i18n-build.mjs`), iconen (`tools/icons.mjs`), spelldata (`tools/spells_srd*.py`), concentratielijst (`tools/conc_lists.py`), schade-spells (`tools/dmg_spells.mjs`). Tests bewaken dat ze actueel zijn.
- Lokaal de kamer testen zonder wrangler: nagebootste runtime in `tests/room.test.js`.
