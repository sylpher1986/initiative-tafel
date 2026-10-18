# Roadmap

## Klaar (fase 1)
- Initiative, beurten, rondes, undo, logboek met oorzaken en eigen notities
- 322 SRD-monsters, eigen monsters, monsterimport (Open5e / 5e-bits)
- Spelers handmatig of via D&D Beyond PDF; vaste party met short/long rest
- HP, temp HP, resistance/vulnerability, death saves, condities met duur en herhaal-saves
- Spell slots en innate spells (monsters en spelers), concentration gekoppeld aan spells (incl. upcasting)
- Recharge, legendary actions/resistance, lair actions (zelf in te voeren en bewaard), reactions
- Export/import (JSON, versie 1), offline PWA, Cloudflare-hosting
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

## DM-review (oktober 2026), op prioriteit
Uit een volledige testsessie als DM (spelers, bugbears, Adult Black Dragon, lair, AoE, Bless, death saves, spelersscherm) op 320/390/1024 px.

### Prioriteit 1: speelt elke beurt
- [ ] Monsterbeurt zonder statblock openen: aanvallen compact op de open kaart (Bite +11 · 2d10+6 …). Statblock op telefoon als half-hoog paneel bóven de beurtbalk dat bij Volgende meeschuift (nu dekt het de beurtbalk af: Volgende niet aan te tikken). Vervangt "Statblock-paneel versleepbaar" hieronder.
- [ ] Legendary actions-herinnering: na elke beurt van een ander "Draak: 3 LA over" met één tik om er een te gebruiken (nu geen melding)
- [ ] Saves afhandelen in de melding: condition-save einde beurt en concentration save. Monsters: knop "Rol (WIS +0)" met uitslag, geslaagd = conditie weg. Spelers: Geslaagd/Gefaald; gefaald = concentratie weg. Condition-save-melding komt nu pas bij de start van de volgende deelnemer
- [ ] Recharge-aanval ↔ AoE: "Gebruik" op de recharge-chip opent AoE met gerolde schade, type, save en DC uit het statblock en zet de aanval op "op" (nu blijft Acid Breath "klaar" na de AoE)
- [ ] Worp direct toepassen: damage-worp uit het statblock met één tik op een doel; "+4 to hit" vergelijken met de AC van het doel; crit = dubbele dice

### Prioriteit 2: voorbereiding en tempo
- [ ] Volgende encounter: "Monsters wissen, spelers houden" (nu wist "Encounter wissen" ook de party). Samen met encounters vooraf klaarzetten en XP-moeilijkheid (zie Functies)
- [ ] Initiative van spelers bij Start gevecht: één paneel met alle spelers en een cijferpad
- [ ] Effect/conditie op meerdere doelen tegelijk (Bless, Hold Person, Hypnotic Pattern, Web), met de doelkeuze uit AoE; Bless op 3 doelen kost nu 9 tikken
- [ ] Groepsbeurten: zelfde monster met dezelfde groepsworp als één beurt
- [ ] Monsters zoeken op CR en type (nu alleen naam: "undead" of "cr 5" geeft niets) en statblock-preview vóór toevoegen
- [ ] Desktop en tablet (breed scherm): statblock standaard open in de rechterkolom (er is ruimte genoeg), en die volgt het actieve monster; bij een speler aan de beurt blijft het laatste monster staan
- [ ] Spell-uitleg makkelijk lezen: tik op een spellnaam (statblock, spell slots, effecten zoals Bless) opent de beschrijving (level, casting time, range, duur, concentratie, tekst) in een paneel. Alleen SRD 5.1-spells meeleveren (CC-BY-4.0, zoals de monsters); andere spells via een eigen notitie
- [ ] Voorbereiden-indeling: tabs staan onder de hele lijst (veel scrollen bij 10+ deelnemers) en "Instellingen" valt op 390 px buiten beeld; tabs bovenaan of toevoegen als paneel (samen met de welkomstkaart hieronder)

### Prioriteit 3: kleine bugs en afwerking
- [x] Na herladen, uit de achtergrond of na import springt de lijst naar wie aan de beurt is (1.6.4)
- [ ] Undo-geschiedenis is weg na herladen
- [ ] Meldingen staan bovenaan over modusknop, + en kaarten; meerdere meldingen in één blok. Liever net boven de beurtbalk
- [ ] Logboek: "+ reden" bij elke regel is ruis (pas tonen bij tik)
- [x] Bug: één los monster kreeg "groepsworp" in het logboek (1.6.4)
- [x] Monster-tab: knoptekst met aantal (1.6.4); was ("Bugbear toevoegen" bij aantal 3; snel toevoegen zegt wel "3× …")
- [ ] Spelersscherm op tv: 11 deelnemers passen niet op 720p; compacter of twee kolommen
- Tablet: statblock rechts volgt de beurt niet → opgenomen in "Desktop en tablet" bij prioriteit 2
- [ ] Dode monsters inklappen of onderaan zetten
- [ ] Surprise (2014): vinkje "verrast" bij start, eerste beurt overslaan
- [ ] Slots en effecten: Bless via Effect verbruikt geen slot. Voorstel: niet koppelen maar spelers-slots optioneel maken (spelers houden die vaak zelf bij)

## UX-verbeterpunten (uit review)
- [ ] Logboek dichter bij de beurtbalk: eigen tab, of de laatste 2 gebeurtenissen onder de beurtbalk
- [ ] Statblock-paneel op telefoon versleepbaar (half/heel) en dicht met veeg omlaag
- [x] Lettertypes zelf meeleveren in plaats van Google Fonts (offline en privacy)
- [ ] Welkomstkaart bovenaan ("Start met voorbeeld" / "Begin leeg") in plaats van de voorbeeld-hint onderaan

## Functies
- [ ] Resistances/immunities per speler opslaan (nu handmatig in het AoE-paneel); kan uit de D&D Beyond-data komen
- [ ] Knop "Bijwerken" per lid in de Party-tab (voor wie een D&D Beyond-link heeft), met hetzelfde bevestigvak
- [ ] Pact Magic-slots apart bijhouden (komen terug na een short rest); nu opgeteld bij de gewone slots
- [ ] Encounters vooraf klaarzetten en per sessie inladen
- [ ] Moeilijkheid berekenen: XP-budget tegen partylevel (DMG 2014, easy t/m deadly)
- [ ] Herinnering om af en toe een export te maken
- [ ] Spelersscherm op andere apparaten: WebSocket-kamer (Durable Object) met kamercode, zelfde send/on als `js/share.js`; portretten apart en één keer per id sturen
- [ ] Spelersscherm: zichtbaarheid (`VIS`) instelbaar maken; verbergen ook bij snel toevoegen


## Fase 2: sync
- [ ] Login en sync tussen apparaten (bijv. Supabase), local-first blijft de basis
- [ ] Delen met een co-DM

## Fase 3: AI (via Cloudflare Worker, sleutel nooit in de browser)
- [ ] AI-gestuurde vijanden: voorgestelde actie op basis van statblock, HP, condities en logboek
- [ ] Battle maps: bij voorkeur als gestructureerde data (grid, muren, terrein) die de app tekent
- [ ] Kostenbeheer: login en een limiet per gebruiker voordat dit publiek gaat

## Technische schuld (uit code-review)
- [ ] pdf.js zelf hosten (nu via CDN, zonder SRI)
- [ ] Character sheets zitten in elke undo-stap; apart opslaan scheelt geheugen
- [ ] D&D Beyond: speler die al in de party staat toevoegen zonder Bijwerken zet de opgeslagen HP terug op vol (zelfde als bij de PDF)
- [ ] D&D Beyond: spells van items tonen ook als het item niet gedragen/geattuned is
- [ ] D&D Beyond: een PDF die nog gelezen wordt kan een net opgehaalde link-sheet overschrijven (klein risico)
