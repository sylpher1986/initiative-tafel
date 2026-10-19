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
- Open saves in de beurtbalk: condition- en concentration saves met één tik rollen (monster) of ✓/✗ (speler), met Ongedaan
- Legendary actions in de beurtbalk: per monster wat er over is, één tik naar de opties met kosten en worpen, Gebruik met logregel en Ongedaan
- Aanval op een doel vanaf kaart, statblock en legendary-paneel, met advantage/disadvantage automatisch uit condities
- Spell op meerdere doelen (tab Spell in AoE): effecten en condities met save per doel, gekoppeld aan de concentratie van de caster
- Monsterbeurt zonder statblock: aanvallen op de kaart (open bij wie aan de beurt is, ingeklapt bij andere monsters voor opportunity attacks en legendary actions); statblock op telefoon half hoog boven de beurtbalk, volgt de beurt

## DM-review (oktober 2026), op prioriteit
Uit een volledige testsessie als DM (spelers, bugbears, Adult Black Dragon, lair, AoE, Bless, death saves, spelersscherm) op 320/390/1024 px.

### Prioriteit 1: speelt elke beurt
- [x] Monsterbeurt zonder statblock openen: aanvallen compact op de kaart (to hit · damage, DC), statblock op telefoon half hoog boven de beurtbalk en volgt de beurt (1.7.0)
- [x] Legendary actions-herinnering: vaste regel in de beurtbalk per LA-monster (●●○), licht op na Volgende; paneel met opties, kosten (2/3 LA), worp of verwezen aanval en Gebruik (1.9.0)
- [x] Saves afhandelen: open saves als regels in de beurtbalk (condition-save al bij het begin van de beurt, "einde beurt"; concentration save na schade, ook uit AoE). Monster: "Rol +N" (statblock + Bless/Bane/cover), Legendary Resistance en "Spell? Advantage" in de melding; speler: ✓/✗; 3+: paneel met "Rol alle monsters"; niet afgehandeld vervalt na één extra beurtwissel (1.10.0)
- [x] Recharge-aanval ↔ AoE: "DC 18 DEX · AoE" op de aanvalsregel van elke save-actie met schade opent AoE met gerolde schade, type, save en DC; spelers aangevinkt; recharge pas bij toepassen op "op" (één Ongedaan); klare recharge-actie staat direct onder Multiattack (1.11.0)
- [x] Worp direct toepassen: to-hit-knop op de monsterkaart → doel kiezen → raak/mis tegen de AC (met effecten), damage met crit, resist per type, Shield +5, toepassen met Ongedaan (1.12.0)
- [x] Aanval op een doel ook vanuit het statblock en het legendary-paneel (zelfde paneel, LA aftrekken met schakelaar "−N LA"); advantage/disadvantage automatisch uit condities (Auto/Adv/Dis/Normaal, reden per doel en in de uitslag) (1.14.0)

### Prioriteit 2: voorbereiding en tempo
- [x] Volgende encounter: "Encounter wissen" vraagt "Monsters wissen, spelers houden" of "Alles"; spelers blijven met HP, slots en effecten, één Ongedaan (1.12.1). Encounters vooraf klaarzetten en XP-moeilijkheid: zie Functies
- [x] Initiative van spelers bij Start gevecht: paneel met alle spelers (oude waarden ingevuld), cijferpad, Rol per speler, Volgende/Start; één Ongedaan (1.13.0)
- [x] Effect/conditie op meerdere doelen tegelijk: tab Spell in het AoE-paneel (Bless, Bane, Hold Person, Hypnotic Pattern, Web, eigen conditie) met caster, DC, saves per doel en Rol monsters; condities hangen aan de concentratie van de caster; Bless op 3 doelen 4–5 tikken i.p.v. 9 (1.15.0); Hypnotic Pattern en Sleep vervallen bij schade (1.21.0). Later: slots verbruiken, maximaal aantal doelen
- [x] Groepsbeurten: leden van een groepsworp tonen als groepsbeurt ("Bugbear 2 · 2/3" in de beurtbalk, hele groep aan de beurt op het spelersscherm); beurten blijven per lid zodat recharge, saves en condities per lid kloppen; namen sorteren numeriek (1.16.0)
- [x] Monsters zoeken op naam, type, subtype en CR ("undead cr 2-4", "cr 1/4", "cr 10+", "demon") met kopregel en telling; compacte preview van de keuze (AC/HP/CR, verdediging, eerste aanvallen) met "Volledig statblock", op tablet/desktop in de zijkolom; ook bij snel toevoegen (1.18.0)
- [x] Desktop en tablet: zijkolom altijd gevuld en volgt de beurt (monster: statblock, speler: sheet met live HP/AC/condities/effecten/slots, plus de D&D Beyond-sheet als die er is); Vastzetten met "Beurt: X →"; zonder gevecht het laatst geopende of toegevoegde (1.8.0)
- [x] Spell-uitleg: tik op een spellnaam in het statblock (Spellcasting), de speler-sheet of bij de slots op de kaart → paneel met level/school, casting time, range, components, duration, conc/ritual, tekst (tabellen, worpen tikbaar) en At Higher Levels. Alle 319 SRD 5.1-spells, pas geladen bij de eerste tik en offline beschikbaar; PHB-namen (Tasha's, Melf's, Bigby's) gevonden; niet-SRD: sheet-gegevens van de speler + zoeken op D&D Beyond (1.19.0). SRD 5.2 (2024)-spells als tweede editie: voorkeur in Instellingen, schakelaar 2014 | 2024 in het paneel, spells die alleen in één editie staan (Hex, Branding Smite) vallen terug op die editie (1.20.0). Later: uitleg-link vanuit AoE-Spell en Effect-presets, eigen notitie voor niet-SRD-spells
- [x] Voorbereiden-indeling: knoppen + Monster / + Speler / Party / ⚙ in de beurtbalk openen een paneel; lijst blijft staan, geen scrollen naar tabs, Instellingen altijd bereikbaar (1.17.0)

### Prioriteit 3: kleine bugs en afwerking
- [x] Na herladen, uit de achtergrond of na import springt de lijst naar wie aan de beurt is (1.6.4)
- [ ] Undo-geschiedenis is weg na herladen
- [x] Meldingen net boven de beurtbalk als stapel (max 3, nieuwste onderaan, alleen de nieuwste houdt Ongedaan); bij een open paneel bovenaan; tik sluit (1.24.3)
- [x] Logboek: geen "+ reden" meer per regel; tik op een regel opent het redenveld (1.24.3)
- [x] Bug: één los monster kreeg "groepsworp" in het logboek (1.6.4)
- [x] Monster-tab: knoptekst met aantal (1.6.4); was ("Bugbear toevoegen" bij aantal 3; snel toevoegen zegt wel "3× …")
- [x] Spelersscherm op tv: liggend ≥ 900 px schaalt de letter met de hoogte en vanaf 7 regels twee kolommen; 11 deelnemers + "Neer" passen op 720p (1.24.3)
- Tablet: statblock rechts volgt de beurt niet → opgenomen in "Desktop en tablet" bij prioriteit 2
- [x] Dode monsters: in Gevecht onderaan in een ingeklapt blok "Neer (N)"; net neergegaan en open blijft op zijn plek tot de kaart dicht gaat of de beurt wisselt; dode spelers blijven staan; spelersscherm: één regel "Neer: …" (1.23.0)
- [x] Surprise (2014): "Verrast: Niemand | Monsters | Spelers" in het initiative-paneel, per deelnemer via ⋯ in ronde 1; eerste beurt overgeslagen (beurtgrenzen tellen af), geen reaction en geen legendary actions tot die beurt voorbij is (1.23.0). Later: keuze ook zonder spelers aan tafel (paneel opent dan niet)
- [ ] Slots en effecten: Bless via Effect verbruikt geen slot. Voorstel: niet koppelen maar spelers-slots optioneel maken (spelers houden die vaak zelf bij)

## UX-verbeterpunten (uit review)
- [ ] Logboek dichter bij de beurtbalk: eigen tab, of de laatste 2 gebeurtenissen onder de beurtbalk
- [x] Statblock-paneel op telefoon versleepbaar (half/heel) en dicht met veeg omlaag (vervangen door half/Groot boven de beurtbalk, 1.7.0)
- [x] Lettertypes zelf meeleveren in plaats van Google Fonts (offline en privacy)
- [x] Welkomstkaart bij een lege start ("Start met voorbeeld" / "Begin leeg"), voorbeeld-banner boven de lijst (1.17.0)

## Functies
- [ ] Taaloptie Nederlands / English (Instellingen, keuze bewaard op het apparaat). Bij English alle Nederlandse tekst vervangen: knoppen, labels, meldingen, logboek, hints, formulieren, spelersscherm en foutmeldingen (ook van de Worker). D&D-termen zijn al Engels. Aanpak: teksten centraal in een vertaalbestand per taal (`js/i18n/nl.js`, `en.js`) met een `t("sleutel")`-functie; logboekregels als sleutel + waarden opslaan zodat ze na wisselen ook vertaald zijn; test die bewaakt dat elke sleutel in beide talen bestaat
- [ ] Resistances/immunities per speler opslaan (nu handmatig in het AoE-paneel); kan uit de D&D Beyond-data komen
- [ ] Knop "Bijwerken" per lid in de Party-tab (voor wie een D&D Beyond-link heeft), met hetzelfde bevestigvak
- [ ] Pact Magic-slots apart bijhouden (komen terug na een short rest); nu opgeteld bij de gewone slots
- [ ] Encounters vooraf klaarzetten en per sessie inladen
- [ ] Moeilijkheid berekenen: XP-budget tegen partylevel (DMG 2014, easy t/m deadly)
- [ ] Herinnering om af en toe een export te maken
- [x] Spelersscherm op andere apparaten: kamer (Durable Object) met kamercode en link, "Delen met spelers" in Instellingen met aantal verbonden schermen, code invoeren op het spelersscherm, herverbinden na slapen/netwerkwissel, portretten apart en één keer per id (1.24.0)
- [x] Spelersscherm-kamer: rate-limit op `POST /api/room`: max 10 nieuwe kamers per minuut per IP (Cloudflare rate limiting binding), daarboven 429 en een melding bij Delen met spelers (1.24.4)
- [ ] Spelersscherm-kamer: QR-code bij de code (alleen als een kleine zelf-gehoste lib past)
- [ ] Spelersscherm-kamer: vaste code per campagne zodra er accounts zijn (fase 2, `isOwner` in `worker/room.js`)
- [ ] Spelersscherm: zichtbaarheid (`VIS`) instelbaar maken; verbergen ook bij snel toevoegen
- [x] Spellregels 2014 | 2024 (Instellingen, alleen spells): Barkskin 17 zonder concentratie, Lethargy = Incapacitated, concentratie per editie, Sleep 2024 (Incapacitated → Unconscious); concentratielijst uit de SRD-data (Enthrall/Forcecage eruit, o.a. Hideous Laughter, Spike Growth, Vampiric Touch erbij); Web duurt zolang de concentratie (1.21.0)
- [x] Spells per speler volgens de versie op zijn D&D Beyond-sheet (bronnen per spell), tag "2024 · sheet" waar het afwijkt van de instelling (1.22.0)
- [ ] 2024-regels buiten spells (condities zoals Exhaustion en Invisible, concentratie-DC max 30, weapon mastery): als dit komt, de hinttekst bij Instellingen → Spells aanpassen


## Fase 2: sync
- [ ] Login en sync tussen apparaten (bijv. Supabase), local-first blijft de basis
- [ ] Delen met een co-DM

## Fase 3: AI (via Cloudflare Worker, sleutel nooit in de browser)
- [ ] AI-gestuurde vijanden: voorgestelde actie op basis van statblock, HP, condities en logboek
- [ ] Battle maps: bij voorkeur als gestructureerde data (grid, muren, terrein) die de app tekent
- [ ] Kostenbeheer: login en een limiet per gebruiker voordat dit publiek gaat

## Technische schuld (uit code-review)
- [ ] Open saves: ‹ Vorige telt de ttl niet terug (vervalt dan een beurt eerder); monster zonder statblock toont "Rol +0" zonder hint
- [ ] pdf.js zelf hosten (nu via CDN, zonder SRI)
- [ ] Character sheets zitten in elke undo-stap; apart opslaan scheelt geheugen
- [ ] D&D Beyond: speler die al in de party staat toevoegen zonder Bijwerken zet de opgeslagen HP terug op vol (zelfde als bij de PDF)
- [ ] D&D Beyond: spells van items tonen ook als het item niet gedragen/geattuned is
- [ ] D&D Beyond: een PDF die nog gelezen wordt kan een net opgehaalde link-sheet overschrijven (klein risico)
