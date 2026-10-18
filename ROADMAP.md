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
- Spelersscherm in een tweede venster (zelfde apparaat): volgorde, beurt, HP-status van monsters; monsters verbergen voor spelers
- Spelers via D&D Beyond-link (publieke sheets, via de Worker): portret, AC/HP berekend met controle-markering, slots en resources; opnieuw ophalen werkt de speler in de party bij

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

- [ ] Effecten: cover-bonus ook op Dex saves in het AoE-paneel; Bless/Bane-d4 bij monster-saves
- [ ] Lethargy na Haste als echte toestand (nu alleen een melding)
- [ ] Effecten: Bless opnieuw casten op nieuwe doelen haalt de oude doelen niet weg; Life Drain tot max 0 = dood (nu min. 1)

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
