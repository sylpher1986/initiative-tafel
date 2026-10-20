# Roadmap

Geordend op soort wijziging. Elk open punt heeft een code (bijv. **IN1**); de **priolijst** hieronder verwijst daarnaar. Afgevinkte punten staan onderaan onder "Klaar".

## Priolijst (19-10-2026)
Opgesteld na de DM-review met drie persona's (beginner, ervaren DM, oude rot; zie "DM-review 2" onderaan). Leidraad: eerst wat elke sessie verwarring of tikken kost, dan voorbereiding, dan uitbreidingen.

**P1: nu (indeling, elke sessie)**
1. ~~IN1–IN4~~ klaar in 1.29.0 en 1.30.0 (zie Klaar)
3. ~~VB1~~ klaar in 1.30.1 (zie Klaar)

**P2: volgende (tempo en voorbereiding)**
6. ~~GV1~~ klaar in 1.30.2 (zie Klaar)
7. ~~IN5, VB2, GV2~~ klaar in 1.31.0 (zie Klaar)
10. ~~IN6, DA1~~ klaar in 1.31.1 (zie Klaar)
12. ~~SP1~~ klaar in 1.31.2 (zie Klaar)
13. ~~GV3~~ klaar in 1.31.3 (zie Klaar)
14. ~~DA2~~ klaar in 1.31.4 (zie Klaar)

**P3: later**
- Afwerking: **AF1–AF3**, **AF5**
- Nice to have: **OB1** rondleiding bij eerste gebruik, daarna **OB2** opnieuw starten
- Regels: **RE1–RE7**
- Encounters: **VB3**
- Spelers en D&D Beyond: **SP2–SP3**
- Gevecht: **GV4–GV5**, **IN7**
- Spelersscherm: **SC1**
- Taal: **TA1**
- Technische schuld: **TS1–TS2** (oppakken wanneer je die code toch aanraakt)
- Fase 2 en 3

---

## Indeling en navigatie
- [ ] **IN7 Logboek dichter bij de beurtbalk:** eigen tab, of de laatste 2 gebeurtenissen onder de beurtbalk.

## Gevecht aan tafel
- [ ] **GV4 Reaction-knop bij spelers optioneel** (Instellingen): veel tafels laten spelers dat zelf bijhouden; scheelt een knop op elke spelerskaart.
- [ ] **GV5 Initiative van monsters opnieuw rollen bij Start** (keuze in het initiative-paneel): nu wordt bij toevoegen gerold, ook als dat uren vóór de sessie was.

## Voorbereiding en encounters
- [ ] **VB3 Encounters:** level ook via ⋯ Bewerken voor spelers buiten de party; DMG-regel "monsters met veel lagere CR niet meetellen" (nu telt alles mee).

## Spelregels
- [ ] **RE1 Slots en effecten:** Bless via Effect verbruikt geen slot. Voorstel: niet koppelen maar spelers-slots optioneel maken (spelers houden die vaak zelf bij)
- [ ] **RE2 Spell op doelen:** slots verbruiken en maximaal aantal doelen
- [ ] **RE3 Pact Magic-slots apart bijhouden** (komen terug na een short rest); nu opgeteld bij de gewone slots
- [ ] **RE4 2024-regels buiten spells** (condities zoals Exhaustion en Invisible, concentratie-DC max 30, weapon mastery): als dit komt, de hinttekst bij Instellingen → Spells aanpassen
- [ ] **RE5 Surprise:** keuze ook zonder spelers aan tafel (paneel opent dan niet)
- [ ] **RE6 Spell-uitleg:** link vanuit AoE-Spell en Effect-presets; eigen notitie voor niet-SRD-spells (vraagt opslag + exportversie)
- [ ] **RE7 Open saves:** ‹ Vorige telt de ttl niet terug (vervalt dan een beurt eerder); monster zonder statblock toont "Rol +0" zonder hint

## Spelers en D&D Beyond
- [ ] **SP2 Resistances/immunities per speler opslaan** (nu handmatig in het AoE-paneel); kan uit de D&D Beyond-data komen
- [ ] **SP3 D&D Beyond-randgevallen:** speler die al in de party staat toevoegen zonder Bijwerken zet de opgeslagen HP terug op vol (ook bij de PDF); spells van items tonen ook als het item niet gedragen/geattuned is; een PDF die nog gelezen wordt kan een net opgehaalde link-sheet overschrijven (klein risico)

## Spelersscherm
- [ ] **SC1 QR-code bij de kamercode** (alleen als een kleine zelf-gehoste lib past)

## Afwerking (klein)
- [ ] **AF1** Bestandskiezers tonen de Engelse browserknop "Choose File" (encounter-import, backup, monsterbestand): eigen knop "Kies bestand…"
- [ ] **AF2** Logboek vóór het gevecht toont "R–": vervangen door "Voorbereiding"
- [ ] **AF3** Knop "‹" in de beurtbalk zonder tekst: "‹ Vorige" of een duidelijk aria-label + tooltip
- AF4 is opgegaan in **OB1/OB2** (rondleiding, zie Eerste gebruik)
- [ ] **AF5** Instellingen is één lange lijst: kopjes inklapbaar of een korte inhoud bovenaan (Weergave · Spells · Spelersscherm · Opslag)

## Eerste gebruik (nice to have)
- [ ] **OB1 Visuele rondleiding bij de eerste keer openen.** Elementen één voor één uitlichten (rest van het scherm gedimd) met een korte uitleg en Volgende / Overslaan, zoals veel apps dat doen. Stops bijvoorbeeld: modus Voorbereiden/Gevecht, + Monster / + Speler / Party / ⚙, een kaart (tik = openen), Start gevecht, en in Gevecht de beurtbalk (Volgende, ‹ Vorige, ↶ Ongedaan, AoE). Eenmalig per apparaat (`localStorage`), niet in undo of export; nooit over een open paneel heen. Zelf bouwen (geen tour-library: geen dependencies). Pas bouwen na IN1–IN4, anders wijzen de stops naar een indeling die nog verandert. UX-agent: rondleiding vs losse hints op de plek zelf naast elkaar zetten.
- [ ] **OB2 Rondleiding opnieuw starten** vanuit Instellingen (bijv. "Rondleiding opnieuw bekijken"), zodat een DM hem later nog eens kan zien of aan een co-DM kan laten zien. Bouwt op OB1.

## Opslag en data
- [ ] **DA3 Twee tabbladen met de DM-app tegelijk:** ze schrijven elkaars stand en (sinds DA2) undo-geschiedenis stil over. Oplossing zoals bij de kamer (4001): via BroadcastChannel wint het nieuwste tabblad, het oude toont "Hier verder werken".

## Taal
- [ ] **TA1 Taaloptie Nederlands / English** (Instellingen, keuze bewaard op het apparaat). Bij English alle Nederlandse tekst vervangen: knoppen, labels, meldingen, logboek, hints, formulieren, spelersscherm en foutmeldingen (ook van de Worker). D&D-termen zijn al Engels. Aanpak: teksten centraal in een vertaalbestand per taal (`js/i18n/nl.js`, `en.js`) met een `t("sleutel")`-functie; logboekregels als sleutel + waarden opslaan zodat ze na wisselen ook vertaald zijn; test die bewaakt dat elke sleutel in beide talen bestaat

## Technische schuld
- [ ] **TS1** pdf.js zelf hosten (nu via CDN, zonder SRI)
- [ ] **TS2** Character sheets zitten in elke undo-stap; apart opslaan scheelt geheugen
- Open saves (RE7) en D&D Beyond-randgevallen (SP3) stonden eerder hier en staan nu bij hun onderwerp.

## Fase 2: sync
- [ ] Login en sync tussen apparaten (bijv. Supabase), local-first blijft de basis. Eerste collectie: `encounters` (heeft al `id` + `updatedAt`, nieuwste wint); tot dan wisselen via Delen/Importeren per encounter
- [ ] Delen met een co-DM
- [ ] Spelersscherm-kamer: vaste code per campagne zodra er accounts zijn (`isOwner` in `worker/room.js`)

## Fase 3: AI (via Cloudflare Worker, sleutel nooit in de browser)
- [ ] AI-gestuurde vijanden: voorgestelde actie op basis van statblock, HP, condities en logboek
- [ ] Battle maps: bij voorkeur als gestructureerde data (grid, muren, terrein) die de app tekent
- [ ] Kostenbeheer: login en een limiet per gebruiker voordat dit publiek gaat

---

## DM-review 2 (19-10-2026): drie persona's
Op 360/390 px en 1024 px, met het voorbeeld, alle panelen en een paar beurten. Volledig verslag: projectdoc `claude/dm-review-persona-s.md`.
- **Sanne** (beginner, eerste campagne, telefoon): weet niet waarom ze naar Gevecht zou gaan als Start gevecht ook in Voorbereiden staat; schrikt van "level onbekend" in het voorbeeld; vindt Encounters niet onder "Monster toevoegen"; "‹" en "AoE" zeggen haar niets.
- **Joost** (ervaren, homebrew, tablet + tv): wil in Voorbereiden geen Schade/Reaction maar inrichten; mist XP na het gevecht; zijkolom bij een speler zonder sheet is leeg.
- **Gerard** (oude rot, 30 jaar DM): elke tik telt: HP-balk moet direct schade openen; twee verschillende toevoegschermen; initiative bij Start rollen, niet bij toevoegen; Reaction bij spelers overbodig.

## Klaar

### Fase 1 (basis)
- Initiative, beurten, rondes, undo, logboek met oorzaken en eigen notities
- 322 SRD-monsters, eigen monsters, monsterimport (Open5e / 5e-bits)
- Spelers handmatig of via D&D Beyond PDF; vaste party met short/long rest
- HP, temp HP, resistance/vulnerability, death saves, condities met duur en herhaal-saves
- Spell slots en innate spells (monsters en spelers), concentration gekoppeld aan spells (incl. upcasting)
- Recharge, legendary actions/resistance, lair actions (zelf in te voeren en bewaard), reactions
- Export/import (JSON, versie 2 sinds 1.28.0: met encounters), offline PWA, Cloudflare-hosting
- Weergave Systeem/Licht/Donker (tab Instellingen, keuze bewaard op het apparaat)
- UX-ronde 1: compacte kaarten (één open), vaste beurtbalk, schade-paneel, meldingen met Ongedaan
- Avatars: icoon per creature type (monsters) en ras (spelers), portret uit de D&D Beyond-PDF als die er een heeft
- AoE-schade op meerdere doelen: save ½/0, resist/kwetsbaar/immuun (ook uit statblock), monster-saves rollen, legendary resistance; Immuun ook in het gewone schade-paneel
- Twee modi: **Voorbereiden** (spelers, monsters, party, lair actions, instellingen) en **Gevecht** (alleen lijst + beurtbalk); modus volgt het gevecht, wisselen kan altijd
- Snel toevoegen in Gevecht (+): monsters die halverwege aansluiten, initiative rollen of invullen
- Deelnemer bewerken (naam, AC, max HP, initiative) en tijdelijke effecten met duur en concentratie (Shield, Shield of Faith, Haste, Mage Armor, Barkskin, cover, Aid, Bless, Bane, eigen effect)
- Effecten in saves: cover (Dex) en Bless/Bane-d4 bij monster-saves in het AoE-paneel; Bless opnieuw casten vervangt de oude doelen ("Hoort erbij" als het toch een extra doel was); max HP tot 0 = dood; Lethargy na Haste als echt effect
- Spelersscherm in een tweede venster (zelfde apparaat): volgorde, beurt, HP-status van monsters; monsters verbergen voor spelers
- Spelers via D&D Beyond-link (publieke sheets, via de Worker): portret, AC/HP berekend met controle-markering, slots en resources; opnieuw ophalen werkt de speler in de party bij
- Open saves in de beurtbalk: condition- en concentration saves met één tik rollen (monster) of ✓/✗ (speler), met Ongedaan
- Legendary actions in de beurtbalk: per monster wat er over is, één tik naar de opties met kosten en worpen, Gebruik met logregel en Ongedaan
- Aanval op een doel vanaf kaart, statblock en legendary-paneel, met advantage/disadvantage automatisch uit condities
- Spell op meerdere doelen (tab Spell in AoE): effecten en condities met save per doel, gekoppeld aan de concentratie van de caster
- Monsterbeurt zonder statblock: aanvallen op de kaart (open bij wie aan de beurt is, ingeklapt bij andere monsters voor opportunity attacks en legendary actions); statblock op telefoon half hoog boven de beurtbalk, volgt de beurt

### DM-review 1 (oktober 2026)
Uit een volledige testsessie als DM (spelers, bugbears, Adult Black Dragon, lair, AoE, Bless, death saves, spelersscherm) op 320/390/1024 px.
- [x] Monsterbeurt zonder statblock openen: aanvallen compact op de kaart (to hit · damage, DC), statblock op telefoon half hoog boven de beurtbalk en volgt de beurt (1.7.0)
- [x] Legendary actions-herinnering: vaste regel in de beurtbalk per LA-monster (●●○), licht op na Volgende; paneel met opties, kosten (2/3 LA), worp of verwezen aanval en Gebruik (1.9.0)
- [x] Saves afhandelen: open saves als regels in de beurtbalk (condition-save al bij het begin van de beurt, "einde beurt"; concentration save na schade, ook uit AoE). Monster: "Rol +N" (statblock + Bless/Bane/cover), Legendary Resistance en "Spell? Advantage" in de melding; speler: ✓/✗; 3+: paneel met "Rol alle monsters"; niet afgehandeld vervalt na één extra beurtwissel (1.10.0)
- [x] Recharge-aanval ↔ AoE: "DC 18 DEX · AoE" op de aanvalsregel van elke save-actie met schade opent AoE met gerolde schade, type, save en DC; spelers aangevinkt; recharge pas bij toepassen op "op" (één Ongedaan); klare recharge-actie staat direct onder Multiattack (1.11.0)
- [x] Worp direct toepassen: to-hit-knop op de monsterkaart → doel kiezen → raak/mis tegen de AC (met effecten), damage met crit, resist per type, Shield +5, toepassen met Ongedaan (1.12.0)
- [x] Aanval op een doel ook vanuit het statblock en het legendary-paneel (zelfde paneel, LA aftrekken met schakelaar "−N LA"); advantage/disadvantage automatisch uit condities (Auto/Adv/Dis/Normaal, reden per doel en in de uitslag) (1.14.0)
- [x] Volgende encounter: "Encounter wissen" vraagt "Monsters wissen, spelers houden" of "Alles"; spelers blijven met HP, slots en effecten, één Ongedaan (1.12.1)
- [x] Initiative van spelers bij Start gevecht: paneel met alle spelers (oude waarden ingevuld), cijferpad, Rol per speler, Volgende/Start; één Ongedaan (1.13.0)
- [x] Effect/conditie op meerdere doelen tegelijk: tab Spell in het AoE-paneel (Bless, Bane, Hold Person, Hypnotic Pattern, Web, eigen conditie) met caster, DC, saves per doel en Rol monsters; condities hangen aan de concentratie van de caster; Bless op 3 doelen 4–5 tikken i.p.v. 9 (1.15.0); Hypnotic Pattern en Sleep vervallen bij schade (1.21.0)
- [x] Groepsbeurten: leden van een groepsworp tonen als groepsbeurt ("Bugbear 2 · 2/3" in de beurtbalk, hele groep aan de beurt op het spelersscherm); beurten blijven per lid zodat recharge, saves en condities per lid kloppen; namen sorteren numeriek (1.16.0)
- [x] Monsters zoeken op naam, type, subtype en CR ("undead cr 2-4", "cr 1/4", "cr 10+", "demon") met kopregel en telling; compacte preview van de keuze (AC/HP/CR, verdediging, eerste aanvallen) met "Volledig statblock", op tablet/desktop in de zijkolom; ook bij snel toevoegen (1.18.0)
- [x] Desktop en tablet: zijkolom altijd gevuld en volgt de beurt (monster: statblock, speler: sheet met live HP/AC/condities/effecten/slots, plus de D&D Beyond-sheet als die er is); Vastzetten met "Beurt: X →"; zonder gevecht het laatst geopende of toegevoegde (1.8.0)
- [x] Spell-uitleg: tik op een spellnaam in het statblock (Spellcasting), de speler-sheet of bij de slots op de kaart → paneel met level/school, casting time, range, components, duration, conc/ritual, tekst (tabellen, worpen tikbaar) en At Higher Levels. Alle 319 SRD 5.1-spells, pas geladen bij de eerste tik en offline beschikbaar; PHB-namen (Tasha's, Melf's, Bigby's) gevonden; niet-SRD: sheet-gegevens van de speler + zoeken op D&D Beyond (1.19.0). SRD 5.2 (2024)-spells als tweede editie: voorkeur in Instellingen, schakelaar 2014 | 2024 in het paneel, spells die alleen in één editie staan (Hex, Branding Smite) vallen terug op die editie (1.20.0)
- [x] Voorbereiden-indeling: knoppen + Monster / + Speler / Party / ⚙ in de beurtbalk openen een paneel; lijst blijft staan, geen scrollen naar tabs, Instellingen altijd bereikbaar (1.17.0)
- [x] Na herladen, uit de achtergrond of na import springt de lijst naar wie aan de beurt is (1.6.4)
- [x] Meldingen net boven de beurtbalk als stapel (max 3, nieuwste onderaan, alleen de nieuwste houdt Ongedaan); bij een open paneel bovenaan; tik sluit (1.24.3)
- [x] Logboek: geen "+ reden" meer per regel; tik op een regel opent het redenveld (1.24.3)
- [x] Bug: één los monster kreeg "groepsworp" in het logboek (1.6.4)
- [x] Monster-tab: knoptekst met aantal (1.6.4)
- [x] Spelersscherm op tv: liggend ≥ 900 px schaalt de letter met de hoogte en vanaf 7 regels twee kolommen; 11 deelnemers + "Neer" passen op 720p (1.24.3)
- [x] Dode monsters: in Gevecht onderaan in een ingeklapt blok "Neer (N)"; net neergegaan en open blijft op zijn plek tot de kaart dicht gaat of de beurt wisselt; dode spelers blijven staan; spelersscherm: één regel "Neer: …" (1.23.0)
- [x] Surprise (2014): "Verrast: Niemand | Monsters | Spelers" in het initiative-paneel, per deelnemer via ⋯ in ronde 1; eerste beurt overgeslagen (beurtgrenzen tellen af), geen reaction en geen legendary actions tot die beurt voorbij is (1.23.0)
- [x] Statblock-paneel op telefoon (vervangen door half/Groot boven de beurtbalk, 1.7.0)
- [x] Lettertypes zelf meeleveren in plaats van Google Fonts (offline en privacy)
- [x] Welkomstkaart bij een lege start ("Start met voorbeeld" / "Begin leeg"), voorbeeld-banner boven de lijst (1.17.0)

### Modi (1.29.0, uit DM-review 2)
- **IN1** Modus volgt de toestand: vóór Start altijd Voorbereiden (fase-aanduiding 1 → 2), Gevecht met eigen kop (grote ronde, ✎ Voorbereiden, +), tussendoor Voorbereiden met een amberkleurige balk en "Terug naar gevecht". Seg-knop weg. UX-agent koos dit boven tabs met een donkere kop (optie B).
- **IN2** Kaart in Voorbereiden = inrichten: monster Init en Max HP direct (AC onder ⋯), Verbergen, Conditie, Effect, Statblock; speler huidige HP, AC en Level (als de sheet het mist), Conditie, Effect, Sheet. Geen Schade/Heal/Reaction. Velden slaan op bij verlaten.
- **IN4** (1.30.0) Eén blok voor monsters toevoegen in het Monster-paneel én bij snel toevoegen: Aantal-stepper, HP Gemiddeld | Rollen, Initiative Per monster | Groep | Invullen. Encounter inladen volgt de groepen uit de encounter en alleen de HP-keuze.
- **VB1** (1.30.1) "level onbekend" tikbaar: de uitleg bij de moeilijkheid (strook en encounter-rij) heeft per speler zonder level een invulveld; de tik zet de focus erop. Voorbeeldspelers hebben level 3 (voorbeeld = Hard).
- **GV1** (1.30.2) Tik op de HP-rij (balk + getal) in Gevecht opent direct het schadepaneel: eigen knop onder de kop, 44 px hoog, ook bij dichte kaarten en spelers. Voorbereiden ongewijzigd.
- **IN5** (1.31.0) Gecontroleerd op 360 × 740: Voorbereiden tijdens een gevecht heeft geen beurtbalk; dock = prep-rij + [↶][Terug naar gevecht] (129 px), 611 px blijft over voor de lijst. Gesloten.
- **VB2** (1.31.0) Encounters vindbaar: paneeltitel "Encounters", knop "Encounters klaarzetten ▸" in Party, hint in de welkomstkaart. Naam van de ingeladen encounter boven de lijst, notitie ("Tactiek ▸") ingeklapt, ook in Gevecht; niet op het spelersscherm.
- **GV2** (1.31.0) Gevecht afronden: paneel met rondes, duur, totale XP, XP per speler, verslagen, gevlucht meetellen, wie deelt, neer geweest, gestorven; Kopieer en Monsters wissen; ook als logregel. "Alle monsters neer · Gevecht afronden" in de beurtbalk.
- **IN6** (1.31.1) Monsterkaart in Gevecht: alleen nog de knop "Statblock" in de actiebalk; de link "Volledig statblock" onder de aanvallen is weg ("+N meer" blijft, 44 px).
- **DA1** (1.31.1) Exportherinnering: strook "Geen recente export" met Exporteer / Later in Voorbereiden (nooit in een gevecht) als een wijziging aan party, encounters, lairs of eigen monsters 14 dagen niet geëxporteerd is; Later = 7 dagen. Instellingen → Opslag toont "Laatste export: …".
- **DA2** (1.31.4) Undo-geschiedenis blijft bewaard na herladen (iOS gooit tabs weg), tot 80 stappen; vervalt stil als de laatste stap ouder is dan 6 uur, na een app-update of na een volledige import.
- **SP1** (1.31.2) Party: "↻ Bijwerken" per lid met D&D Beyond-link, inline bevestigvak met de wijzigingen (ook naam); onzekere AC/HP uit de sheet gaan niet over een bestaande waarde.
- **GV3** (1.31.3) Tablet/desktop: onder een speler zonder sheet staat in een gevecht het statblock van het monster dat nu of hierna aan de beurt is ("Daarna: Goblin ×3"), met klikbare aanvallen; leespositie blijft als dat monster aan de beurt komt.
- **IN3** Geen lege Gevecht-modus en geen "Gevecht vóór Start" meer; geen leeg logboek; uitleg onder een uitgeschakelde Start.

### Functies
- [x] Encounters vooraf klaarzetten en per sessie inladen: tab Encounters in het Monster-paneel (opslaan uit de lijst, inladen met Vervangen/Toevoegen in één Ongedaan, bewerken, dupliceren, verwijderen met Ongedaan), delen/importeren per encounter als bestand met eigen statblocks; snelkoppeling "Encounter inladen" bij een lege lijst (1.28.0)
- [x] Moeilijkheid berekenen: XP-budget tegen partylevel (DMG 2014, Trivial/Easy t/m Deadly): live boven de lijst in Voorbereiden en per encounter, tik = uitleg; level uit de sheet of een levelveld per partylid (1.28.0)
- [x] Spelersscherm op andere apparaten: kamer (Durable Object) met kamercode en link, "Delen met spelers" in Instellingen met aantal verbonden schermen, code invoeren op het spelersscherm, herverbinden na slapen/netwerkwissel, portretten apart en één keer per id (1.24.0)
- [x] Spelersscherm-kamer: rate-limit op `POST /api/room`: max 10 nieuwe kamers per minuut per IP (Cloudflare rate limiting binding), daarboven 429 en een melding bij Delen met spelers (1.24.4)
- [x] Spelersscherm-kamer: delen pauzeert na 30 min zonder gewijzigde stand (timer in de kamer); spelers zien "De DM deelt op dit moment niet", de DM "Opnieuw delen" met dezelfde code (1.27.0)
- [x] Spelersscherm: zichtbaarheid instelbaar (HP monsters, initiativegetallen, condities: tonen/alleen spelers/verbergen), lair verbergen op zijn kaart, "Verborgen voor spelers" bij snel toevoegen en in de Monster-tab (1.25.0)
- [x] Spelersscherm: naam onbekend per monster (⋯ of bij toevoegen): spelers zien "Onbekend wezen (N)" met een algemeen icoon, ook in groepsnaam en "Neer: …" (1.26.0)
- [x] Spellregels 2014 | 2024 (Instellingen, alleen spells): Barkskin 17 zonder concentratie, Lethargy = Incapacitated, concentratie per editie, Sleep 2024 (Incapacitated → Unconscious); concentratielijst uit de SRD-data (Enthrall/Forcecage eruit, o.a. Hideous Laughter, Spike Growth, Vampiric Touch erbij); Web duurt zolang de concentratie (1.21.0)
- [x] Spells per speler volgens de versie op zijn D&D Beyond-sheet (bronnen per spell), tag "2024 · sheet" waar het afwijkt van de instelling (1.22.0)
