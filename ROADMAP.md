# Roadmap

Geordend op soort wijziging. Elk open punt heeft een code (bijv. **IN1**); de **priolijst** hieronder verwijst daarnaar. Afgevinkte punten staan onderaan onder "Klaar".

## Priolijst (21-10-2026)
Opgesteld na persona-test 3 (drie DM's en negen spelers op eigen apparaten, versie 1.34.0; zie "Persona-test 3" onderaan en projectdoc `claude/persona-test-3.md`). Leidraad: eerst wat spelers iets verraadt of het gevecht verkeerd laat lopen, dan tempo en leesbaarheid aan tafel, dan uitbreidingen. De priolijst van 19-10 is af, op RE1–RE6, SC1, TA1 en TS1 na (die staan hieronder ingedeeld).

**P1: nu (fouten en spoilers)**
1. ~~GV6~~ klaar in 1.34.1 (zie Klaar)
2. ~~SC2~~ klaar in 1.35.0 (WP1, zie Klaar)
3. ~~SC3~~ klaar in 1.35.0 (WP1, zie Klaar)
4. ~~RE8~~ klaar in 1.36.0 (WP3, zie Klaar)
5. ~~AF6~~ klaar in 1.35.1 (WP2, zie Klaar)

**P2: volgende (tempo en leesbaarheid aan tafel)**
6. ~~IN8~~ klaar in 1.35.1 (WP2, zie Klaar)
7. ~~GV7~~ klaar in 1.37.0 (WP4, zie Klaar)
8. ~~SP4~~ · ~~AF7~~ · ~~AF15~~ klaar in 1.37.0 (WP4, zie Klaar)
9. ~~GV8~~ klaar in 1.37.1 (WP5, zie Klaar)
10. ~~SC4~~ · ~~SC5~~ klaar in 1.38.0 (WP6, zie Klaar)
11. ~~SC6~~ klaar in 1.39.0 (WP7, zie Klaar)
12. ~~SC7~~ · ~~SC1~~ klaar in 1.39.0 (WP7, zie Klaar)
13. ~~RE10~~ klaar in 1.40.0 (WP8, zie Klaar)
14. ~~RE9~~ klaar in 1.36.0 (WP3, zie Klaar)
15. ~~IN9~~ klaar in 1.35.1 (WP2, zie Klaar)
16. ~~RE12~~ klaar in 1.36.0 (WP3, zie Klaar)
17. ~~RE1/RE2~~ klaar in 1.41.0 (WP9, zie Klaar)
18. ~~RE11~~ klaar in 1.40.0 (WP8, zie Klaar)
19. ~~SP5~~ klaar in 1.43.0 (WP11, zie Klaar)
20. ~~RE13~~ klaar in 1.42.0 (WP10, zie Klaar)

**Eigen test Michiel (21-10-2026, aan tafel)**, ingedeeld in P2 en verdeeld over de werkpakketten:
- ~~**RE18** Schade-spells (Fireball) in AoE: spell kiezen, schade rollen, upcasten~~ klaar in 1.41.0
- ~~**RE17** Concentration save meteen afhandelen vanuit de schade~~ klaar in 1.36.0
- ~~**RE16** Rage (barbarian) als status met alle voordelen~~ klaar in 1.40.0
- ~~**GV12** Reaction gebruikt zichtbaar in de overzichten tot hij terug is~~ klaar in 1.38.0
- ~~**AF13** AC groter op de kaarten van het DM-scherm~~ klaar in 1.35.1
- ~~**SC10** HP-balken op het spelersscherm even lang~~ klaar in 1.35.1

**P3: later**
- Spelersscherm: ~~SC8~~ (klaar in 1.38.0), ~~SC9~~ (klaar in 1.44.0)
- Afwerking: ~~AF8~~ (klaar in 1.40.0), ~~AF10–AF12, AF14~~ (klaar in 1.44.0)
- Regels: ~~RE3~~ (klaar in 1.41.0), **RE4–RE6**, ~~RE14~~ (klaar in 1.42.0), ~~RE15~~ (klaar in 1.44.0)
- Voorbereiding: ~~VB4~~ · ~~VB5~~ (klaar in 1.43.0, WP11)
- Gevecht: ~~GV10~~ (klaar in 1.37.1), ~~GV11~~ (klaar in 1.42.0)
- Taal: **TA1** (uitgewerkt tot TA2–TA16 en WP18–WP33, zie "Taal" en `docs/i18n.md`; alle pakketten klaar, Engels live in 1.53.0)
- Technische schuld: **TS1**, **TS3** (oppakken wanneer je die code toch aanraakt)
- Fase 2 en 3
- Bewust niet: zie "Persona-test 3 → Niet overgenomen"

## Werkpakketten (21-10-2026)
De priolijst hierboven gebundeld tot pakketten die in één sessie te bouwen en te reviewen zijn (zelfde bestanden of zelfde vraag aan de UX-agent). Volgorde = uitvoervolgorde. Details per pakket: projectdoc `claude/werkpakketten.md`.

| WP | Inhoud | Codes | Versie |
|---|---|---|---|
| ~~**WP1**~~ | Spelersscherm: niets verraden, verbinding kwijt zichtbaar (klaar) | SC2, SC3 | 1.35.0 |
| ~~**WP2**~~ | Tikken en lezen op de telefoon: tikdoelen, verspringen, hoofdknop, minteken, AC groter, HP-balken gelijk (klaar) | AF6, IN8, IN9, AF7, AF13, SC10 | 1.35.1 |
| ~~**WP3**~~ | Regels in het gevecht: Hold Person, initiative na eigen beurt, open saves, concentration save vanuit de schade (klaar) | RE8, RE9, RE12, RE17 | 1.36.0 |
| ~~**WP4**~~ | Speler toevoegen en gevecht afronden (klaar) | SP4, GV7, AF9, AF15 | 1.37.0 |
| ~~**WP5**~~ | Undo en toetsenbord (klaar) | GV8, GV10 | 1.37.1 |
| ~~**WP6**~~ | Spelersscherm op de telefoon: sticky kop, "Dit ben ik", teksten, reaction zichtbaar (klaar) | SC4, SC5, SC8, GV12 | 1.38.0 |
| ~~**WP7**~~ | Tv en koppelen: leesbaarheid, zelfde code, QR (klaar) | SC6, SC7, SC1 | 1.39.0 |
| ~~**WP8**~~ | Condities en statussen aan tafel: uitleg, Exhaustion, Rage, Deadly/Verrast (klaar) | RE10, RE11, RE16, AF8 | 1.40.0 |
| ~~**WP9**~~ | Spells van spelers: schade-spells in AoE (Fireball), slots verbruiken, Pact Magic (klaar) | RE18, RE1, RE2, RE3 | 1.41.0 |
| ~~**WP10**~~ | Monsterregels en minder klikken: Undead Fortitude, save-riders, Parry, eigen monster inlezen, multiattack-volgorde (klaar) | RE13, RE14, GV11 | 1.42.0 |
| ~~**WP11**~~ | Voorbereiding: passives, zoeken, lege encounter (klaar) | SP5, VB4, VB5 | 1.43.0 |
| ~~**WP12**~~ | Afwerking: haperingen, kleine fouten, toegankelijkheid, death save-worp, mini-log, dobbelstenen in statblocktekst (klaar) | AF10, AF11, AF12, AF14, RE15, SC9 | 1.44.0 |
| ~~**WP13**~~ | Naam Kev’s Inn itiative + syntaxcheck en vast browsercheck-script (klaar) | HS1 | 1.44.1 |
| ~~**WP14**~~ | Kleur: semantische tokens, goud = actie/focus/beurt, contrasttest (klaar) | HS2, HS3 | 1.45.0 |
| ~~**WP15**~~ | Typografie: Playfair Display + Inter zelf meegeleverd (klaar) | HS4 | 1.46.0 |
| ~~**WP16**~~ | Logo en app-icoon (klaar) | HS5 | 1.47.0 |
| ~~**WP17**~~ | Componenten, lijn-iconen, spelersscherm in huisstijl (klaar) | HS6, HS7, HS8 | 1.48.0 |
| Backlog | Niet ingepland | RE4, RE5, RE6, TS1, TS3, fase 2 en 3 | |

### Werkpakketten meertaligheid (besloten 24-10-2026)
Besluiten van Michiel (V1–V7): `kevs-inn.com` canoniek, alleen localStorage (geen cookie), Engelse padsegmenten, `/` opent de app, Engels live als 1.53.0 (niet 2.0.0: dat nummer is voor het redesign, besluit 26-10), Engelse tekst nagelezen door een aparte vertaalagent met D&D-kennis (zie `docs/i18n.md` §0). Plan en details per pakket (doel, scope, bestanden, acceptatie, risico's, operationele acties): `docs/i18n.md`. Volgorde = uitvoervolgorde; kritiek pad WP19 → WP21 → WP27 → WP28 → WP32 → WP33. Sinds WP33 (1.53.0) zijn Engels en Nederlands live (`LIVE = ["en", "nl"]`).

| WP | Inhoud | Codes | Afhankelijk van | Versie |
|---|---|---|---|---|
| ~~**WP18**~~ | Inventaris NL-tekst (audit + ratel-nulpunt) en architectuurbesluit, open vragen V1–V7 (klaar) | TA2 | – | geen |
| ~~**WP19**~~ | i18n-runtime (`t`, meervoud, formatters, terugval op Engels) en taalbepaling `resolveLang` (klaar) | TA3 | WP18 | 1.48.1 |
| ~~**WP20**~~ | Catalogi (`locales/src/` → `locales/{en,nl,xx}.js`), laden bij opstarten (max. 3 s), debugmodus, tests (klaar) | TA4 | WP19 | 1.48.2 |
| ~~**WP21**~~ | Paden `/{lang}/initiative/(player/)`, doorverwijzers (`/`, `/speler`, `/initiative/`), manifest `id: "/"`, service worker (klaar) | TA5 | WP20 | 1.49.0 |
| ~~**WP22**~~ | Taalkiezer (Instellingen, spelersscherm) en voorkeur per apparaat (klaar) | TA6 | WP21 | 1.49.1 |
| ~~**WP23**~~ | Statische teksten in de pagina's (gegenereerd per taal) (klaar) | TA7 | WP21 | 1.49.2 |
| ~~**WP24**~~ | DM-app 1: Voorbereiden, + Speler, Party, + Monster, moeilijkheid (klaar) | TA8 | WP20, WP23 | 1.49.3 |
| ~~**WP25**~~ | DM-app 2: Gevecht (kaarten, beurtbalk, panelen) (klaar) | TA9 | WP24 | 1.49.4 |
| ~~**WP26**~~ | DM-app 3: Encounters, afronden, kamer, rondleiding, instellingen, import (klaar) | TA10 | WP25 | 1.49.5 |
| ~~**WP27**~~ | Regelmeldingen en logboek als descriptoren (sleutel + waarden) (klaar) | TA11 | WP20, WP26 | 1.50.0 |
| ~~**WP28**~~ | Spelersscherm in de eigen taal: snapshot met codes, overgang v1/v2 (klaar) | TA12 | WP21, WP27 | 1.51.0 |
| ~~**WP29**~~ | D&D-termen: id's vs labels, conditie-uitleg EN, zoekwoorden per taal, getal/datum-formattering (klaar) | TA13 | WP27 | 1.51.1 |
| ~~**WP30**~~ | Publieke homepage `/en/`, `/nl/`: meta, Open Graph, hreflang, canonical, robots, sitemap, 404 (klaar; operationeel: workers.dev en Search Console door Michiel) | TA14 | WP21, WP29 | 1.52.0 |
| ~~**WP31**~~ | Conventies voor alle tools (CLAUDE.md, `docs/i18n.md` §9) (klaar) | TA15 | WP27, WP28 | geen |
| ~~**WP32**~~ | Verificatie: offline, import/export, spelersscherm gemengde talen, gevecht, persona-test EN (klaar) | TA16 | WP22–WP30 | 1.52.1 |
| ~~**WP33**~~ | Engels live: standaard en terugval, kiezer zichtbaar, homepage indexeerbaar (klaar; operationeel: sitemap in Search Console zodra `HIDDEN` uit staat) | TA1 | WP32 | 1.53.0 |


### Werkpakketten huisstijl 2.0 (besloten 26-10-2026)
Plan: projectdoc `claude/werkpakketten-2.0.md`. Gebouwd op branch `redesign`; WP38 voegde samen naar `main`: **2.0.0 live** (26-10-2026). Volgorde: tokens → componenten → kaarten → homepage → QA.

| WP | Inhoud | Codes | Afhankelijk van | Versie |
|---|---|---|---|---|
| ~~**WP34**~~ | Merkpalet en typografie als tokens (DM Sans, Newsreader) (klaar op `redesign`) | HS9, HS10 | – | branch |
| ~~**WP35**~~ | Gedeelde componenten in de nieuwe stijl (klaar op `redesign`) | HS11 | WP34 | branch |
| ~~**WP36**~~ | Deelnemerskaarten: speler/monster via vorm, open monsterkaart (klaar) | HS12, HS13 | WP35 | branch |
| ~~**WP37**~~ | Homepage in de nieuwe stijl, alleen Initiative, hero-illustratie (klaar) | HS14 | WP34 | branch |
| ~~**WP38**~~ | QA, persona-test, release (klaar) | HS15 | WP34–WP37 | 2.0.0 |

### Werkpakketten na 2.0.0 (besloten 27-10-2026)
Plan: projectdoc `claude/werkpakketten-2.1.md`. Volgorde = uitvoervolgorde; WP43 mag op elk moment. RE4 (2024-regels) rust: later een eigen traject dat begint met een inventaris.

| WP | Inhoud | Codes | Versie |
|---|---|---|---|
| ~~**WP39**~~ | Afwerking huisstijl 2.0: donker thema, krap op 320 px, kleine afwerking (klaar) | HS16, HS17, HS18 | 2.0.1 |
| ~~Nazorg~~ | Knoprand ook op seg-keuzes, aanvalsuitklap en doelrijen in donker (klaar) | HS16 | 2.0.2 |
| ~~**WP40**~~ | Engelse tekst P3 (klaar) | TA19 | 2.0.3 |
| ~~**WP41**~~ | Surprise zonder spelers, links naar de spell-uitleg, drie tekstpunten uit de WP40-vertaalcheck (klaar) | RE5, RE6a, TA20 | 2.1.0 |
| ~~**WP42**~~ | Eigen notitie bij niet-SRD-spells, export versie 3 (klaar) | RE6b | 2.2.0 |
| **WP43** | Technische schuld: logboek in undo, pdf.js zelf hosten | TS3, TS1 | 2.x.1 |
| Backlog | 2024-regels (eigen traject, eerst inventaris), fase 2 en 3 | RE4 | |

---

## Persona-test EN (WP32, 26-10-2026)
Rapport: projectdoc `claude/persona-test-en.md`. P1's opgelost in 1.52.1. Vóór WP33 (Engels live) opgepakt:
- [x] **TA17 Engelse tekst P2** (klaar, 1.52.2): `rules.drops` "its next turn" bij spelers → "their"; `init.log.turn` → "{name}'s turn" (gelijk aan `log.turn`); `log.renew` "Exhaustion refreshed" bij een hoger niveau; `rules.dur.sstart` "(active creature)"; effectchip "10r" (vaste tekst in `js/ui/render.js`) → catalogus; `init.aoe.lose` loopt niet. (1.53.0: ook de korte vorm `rules.dur.sstartS`, die nog "(active creature)" had.)
- [x] **TA18 Weergave P2** (klaar, 1.52.2; tv: de rij liep over de rand, HP-kolom nu begrensd): "MAX HP 2D6" (uppercase-label raakt de hit dice); tv: death saves-tag afgekapt; "Stat block"-knop breekt op 320 px; `_mage armor_` zichtbaar in `data/monsters.json` (data, beide talen).
- [x] **TA19 Engelse tekst P3** (klaar, WP40, 2.0.3): "Poisoned and Prone ended" (opsomming via array-param); `init.eff.concBy`; "Legendary Resistance" met hoofdletter; "None" in de save-keuze; "falls unconscious" i.p.v. "gets Unconscious"; Spells-hint inkorten met "More ▸"; "Dexterity" met hoofdletter in de 2014-spelldata. (P3 #2, afkapping op 320 px, valt onder HS17.)
- [x] **TA20 Tekst uit de WP40-vertaalcheck** (klaar, WP41, 2.1.0): NL `player.log.gone` "{what} weg" → "{what} voorbij" (gelijk aan `log.ends`); NL `init.eff.concBy` "Concentratie van" → "Caster (concentratie)" (gelijk aan EN); EN `init.set.spellsHint` "(Sleep 2024 only)" → "(Sleep: 2024 version only)".

## Indeling en navigatie
- Geen open punten (IN8 en IN9 klaar in 1.35.1, zie Klaar).

## Gevecht aan tafel
- Geen open punten (GV11 klaar in 1.42.0, zie Klaar).

## Voorbereiding en encounters
- Geen open punten (VB4 en VB5 klaar in 1.43.0, zie Klaar).

## Spelregels
- [ ] **RE4 2024-regels buiten spells** (rust sinds 27-10: later een eigen traject, eerst een inventaris) (condities zoals Exhaustion en Invisible, concentratie-DC max 30, weapon mastery): als dit komt, de hinttekst bij Instellingen → Spells aanpassen
- [x] **RE5 Surprise:** keuze ook zonder spelers aan tafel (klaar, WP41, 2.1.0: schakelaar "Monsters verrast" naast Start)
- [x] **RE15 Eigen death save-worp invoeren** (P3): getal typen (nat 20 = 1 HP, nat 1 = twee fails), zoals het cijferpad bij initiative.
- [x] **RE6 Spell-uitleg:** ~~**RE6a**~~ link vanuit AoE-Spell en Effect-presets (klaar, WP41, 2.1.0); ~~**RE6b**~~ eigen notitie voor niet-SRD-spells (klaar, WP42, 2.2.0: export versie 3)

## Spelers en D&D Beyond
- Later, als het nodig blijkt: handmatige "Defenses" op de D&D Beyond-sheet (`customDefenseAdjustments`) inlezen; tijdelijke resistances (Rage, Absorb Elements, Protection from Energy) als effect-preset.

## Spelersscherm
- [x] **SC9 Mini-log voor spelers op afstand** (P3): optioneel een paar regels "wat gebeurde er net", alleen wat de DM vrijgeeft en altijd via `toPlayerView` (verborgen monsters en Onbekend wezen mogen niet lekken).

## Afwerking (klein)
- AF4 is opgegaan in **OB1/OB2** (rondleiding, zie Eerste gebruik)
- [x] **AF14 Dobbelstenen in de statblocktekst** (P3, gevonden in WP2): de tikbare worpen in lopende tekst (`.dice`, "+11 to hit", "2d10 + 6") zijn 23 px hoog. Inline in zinnen, dus niet zomaar 44 px (regels zouden uit elkaar vallen; een `::after` naar boven en onder overlapt de regel erboven). UX-agent kiest: ruimere regelafstand in het statblock, of de worpen als knoppen uit de zin halen.
- [x] **AF10 Kleine haperingen** (P3): focus in het naamveld bij + Speler; rondleiding pas tikbaar na de animatie; "Zeker?" bij Stop met delen; tik op een open Instellingen-sectie klapt hem dicht (nalopen of dat bedoeld is); import ook op de welkomstkaart; hint "(bijv. uit de Claude-versie)" weg.
- [x] **AF11 Kleine fouten** (P3): exportbestandsnaam gebruikt UTC (`toISOString` in `js/ui/actions.js`) → lokale tijd; dode wezens uit de lijst "concentratie van"; nalopen of verborgen monsters in de XP-lijst komen (vermoeden, volgens GV2 tellen ze mee).
- [x] **AF12 Toegankelijkheid** (P3): slots als "1st level slot 1 van 4, beschikbaar"; `aria-current` op wie aan de beurt is; monster/speler niet alleen via kleur.

## Eerste gebruik (nice to have)
- Geen open punten (OB1 en OB2 klaar in 1.33.0, zie Klaar).

## Opslag en data
- Geen open punten (DA3 klaar in 1.31.8, zie Klaar).

## Huisstijl Kev's Inn (23-10-2026)
Afgerond in WP13–WP17 (1.44.1–1.48.0); keuzes in CLAUDE.md, overzicht in projectdoc `claude/archief.md`. Logobronnen: `brand/`.
- [x] **HS1** Naam "Kev’s Inn itiative" (WP13)
- [x] **HS2** Kleur-tokens licht/donker naar het nieuwe palet; goud = primaire actie, focus, beurt, selectie; rood alleen fout/destructief/kritiek
- [x] **HS3** Automatische contrasttest WCAG 2.2 AA over alle toestanden, beide thema's
- [x] **HS4** Playfair Display (merk, grote koppen) + Inter (rest), zelf meegeleverd (WP15)
- [x] **HS5** Logo in de kop van Voorbereiden, favicon, app-iconen, lichte variant (WP16)
- [x] **HS6** Componenten: knoppen, perkament-kaarten, chips, meldingen met icoon, lege toestanden, statblock
- [x] **HS7** Lijn-iconen in plaats van tekenglyphs (⚙ ✎ ⋯ ↶ ▸)
- [x] **HS8** Spelersscherm en tv-stand in huisstijl

## Huisstijl 2.0 (26-10-2026)
- [x] **HS9** Merkpalet als tokens, licht/donker/tv/homepage, contrast opnieuw gemeten (WP34)
- [x] **HS10** DM Sans + Newsreader in plaats van Inter + Playfair Display, zelf meegeleverd (WP34; DM Sans heeft geen tabular-nums)
- [x] **HS11** Knoppen, formulieren, dialogen, menu's, dock in de nieuwe stijl (WP35; kaart-HP `.hpn` 5ch; `.lg-meta` en het AC-schildje hadden al een vaste breedte; `.round`/`.hpnum` bestaan niet meer)
- [x] **HS12** Speler rond portret, monster schildvorm (WP36: achthoek, schild botst met het AC-schildje; .hpn 7ch gedaan); identiteit los van HP-kleuren (meenemen: HP-getal op de DM-kaart `.hpn` van 5ch naar 7ch, zodat de HP-balken ook bij 100–999 HP even lang zijn; gemeten na WP35 op 320 px: 999/999 geeft 153 px balk tegen 162 px bij 7/999, kost elke balk ± 9 px; temp HP daarbij nog meten)
- [x] **HS13** Open monsterkaart rustiger op mobiel (WP36: legendary-rijen op één regel)
- [x] **HS14** Homepage volgens de screens, alleen bestaande tools, hero-illustratie (WP37: hero met uitgeveegde illustratie, één toolkaart, taalkiezer; illustratie AI-gegenereerd door Michiel, herkomst in brand/README.md)
- [x] **HS15** QA, persona-test, release 2.0.0 (WP38: volledige developer-review zonder blokkers; spelersscherm HP via `hpPct`/`hpCls`, `unicode-range` homepage; persona-test 0 P1, 5 P2 opgelost)

## Persona-test huisstijl 2.0 (WP38, 26-10-2026)
Rapport: projectdoc `claude/persona-test-2.0.md`. Geen P1; de vijf P2's zijn in 2.0.0 opgelost (multiattack-clamp, aanvalsnaam breekt, legendary-chip volle breedte, ability-modifier op eigen regel, taalkiezer tv). Vervolg:
- [x] **HS16 Donker thema in een schemerige kamer** (klaar in 2.0.1, WP39): "− Damage" is een fel ivoren blok, feller dan Volgende; meldingen ivoor op walnoot verblinden (voorstel `--surface` + `--fg`); secundaire knoppen hebben in donker vrijwel geen rand (`--line` op `--btn` 1,01:1; `.condgrid`, `.drt` lezen als losse tekst; voorstel `--line-strong` als knoprand). Eerst UX-agent (raakt WP35-keuzes).
- [x] **HS17 Krap op 320 px** (klaar in 2.0.1, WP39; ook de afkapping in de mini-log): statblock-titel in Newsreader over drie regels naast Groot/Sluit; "Condition"/"Statblock" raken de knoprand; + Speler-formulier: "AC (OPTIONAL)" breekt en de velden beginnen niet op één hoogte, select afgekapt tot "Other / unkno".
- [x] **HS18 Kleine afwerking** (klaar in 2.0.1, WP39): na Gevecht afronden blijft het statblock open achter het paneel, met twee meldingen over de lijst; homepage-voet (nl, 320) begint een regel met "· Geen account nodig" (`li+li::before`); dock-kop "UP NOW" in kapitalen tegenover "next: …" klein, "‹" los boven "Prev".

## Taal
- [x] **TA1 Taaloptie Nederlands / English** (Instellingen, keuze bewaard op het apparaat). **Klaar in 1.53.0 (WP33): Engels en Nederlands live.** Bij English alle Nederlandse tekst vervangen: knoppen, labels, meldingen, logboek, hints, formulieren, spelersscherm en foutmeldingen (ook van de Worker). D&D-termen zijn al Engels. Aanpak: teksten centraal in een vertaalbestand per taal (`js/i18n/nl.js`, `en.js`) met een `t("sleutel")`-functie; logboekregels als sleutel + waarden opslaan zodat ze na wisselen ook vertaald zijn; test die bewaakt dat elke sleutel in beide talen bestaat
  - **Uitgewerkt (24-10-2026)** voor heel Kev's Inn (Initiative nu, later Characters, Campaigns, Companion): plan in `docs/i18n.md`, pakketten WP18–WP33 hierboven. TA1 zelf = het eindpakket WP33 (Engels live). Bijstellingen op de oorspronkelijke tekst, na inspectie van de code: (1) de Worker geeft al alleen foutcodes terug (`private`, `rate`, …), de tekst maakt de client (`ddbMsg`); (2) catalogi per laag i.p.v. één bestand per taal (`locales/{en,nl}/{common,initiative,rules,log,player,dnd,pages}.js`, ± 1.000 teksten); (3) URL's krijgen een taalprefix (`/en/`, `/nl/`), de keuze in Instellingen blijft daarnaast; (4) Engels wordt standaard en terugval, Nederlands blijft voor bestaande gebruikers; (5) de snapshot naar spelers bevat nu NL-woorden (HP-status, "Onbekend wezen", duur) en gaat naar codes, zodat speler en DM elk hun eigen taal hebben.
  - **Taalbepaling** (`resolveLang`, één functie voor alle tools): 1. prefix in de URL (`/en/…`, `/nl/…`) wint altijd, zonder doorverwijzen of melding, en verandert de opgeslagen voorkeur niet; 2. ongeldig/niet-ondersteund prefix → `/en/…`; 3. zonder prefix (`/`, `/initiative/`, `/speler`): opgeslagen voorkeur (`localStorage` `kevs-lang`) → eerste ondersteunde browsertaal (`nl-BE` → nl) → Engels. Alleen de taalkiezer schrijft de voorkeur; account-opslag volgt met Fase 2 (nieuwste keuze wint). De spelerslink/QR (`/speler?k=`) blijft zonder taal, zodat elke speler zijn eigen taal krijgt en bestaande QR's blijven werken.
  - **Indexeren**: alleen de nieuwe homepage `/en/`, `/nl/` (hreflang + x-default, canonical); de app en het spelersscherm krijgen `noindex`. Er is nu geen publieke pagina: `/` is de app.
  - **Nooit vertalen**: namen van deelnemers, eigen monsters, encounters en notities, logboeknotities, D&D Beyond-sheets. Spelregeldata blijft Engels (SRD); alleen eigen uitleg (conditie-uitleg `CINFO`) krijgt een Engelse versie. Gelokaliseerde D&D-termen voor een derde taal pas na licentie-onderzoek (V7).
  - [x] **TA2** (WP18, 24-10-2026) Inventaris en besluiten: `tools/i18n-audit.mjs`, nulpunt 1.191 teksten in 46 bestanden (`tests/i18n-baseline.json`), ratel `tests/i18n-ratchet.test.js` (meer Nederlandse tekst in een bestand = test faalt; bewust verhogen met `node tools/i18n-audit.mjs --write`)
  - [x] **TA3** (WP19, 1.48.1) Runtime en taalbepaling in `js/i18n/` (core, msg, lang), puur en getest; nog nergens aangesloten
  - [x] **TA4** (WP20, 1.48.2) Catalogi (`locales/src/` → `locales/<taal>.js`), laden bij het opstarten (max. 3 s), debugstand `?i18n=debug|xx|off`, bewakingstests; Engelse woordenlijst in `docs/i18n.md` §3.2.1
  - [x] **TA5** (WP21, 1.49.0) Paden per taal: `/{nl,en}/initiative/(player/)` gegenereerd uit `pages/` (`tools/pages.mjs`), doorverwijzers `/`, `/speler(.html)`, `/player`, `/initiative/(player/)` (ook offline), manifest per taal met `id: "/"`, service worker scope `/`; `/en/` bestaat maar is niet live. Nog te doen door Michiel: iPhone-check (beginscherm-app en offline openen)
  - [x] **TA6** (WP22, 1.49.1) Taalkiezer **Nederlands | English** (seg, elke taal in haar eigen taal) in Instellingen → Weergave (tussen thema en Reaction, label "Taal · Language") en op het spelersscherm (`.pvtools`, smal een eigen rij); voorkeur `kevs-lang`, wisselen = `location.replace` naar dezelfde pagina; tot WP33 alleen in de i18n-debugstand (`offered`), en alleen dan telt een Engelse voorkeur in de doorverwijzer
  - [x] **TA7** (WP23, 1.49.2) Statische tekst van beide sjablonen uit de catalogi: plaatshouders `{{t:sleutel}}` (HTML) en `{{tjs:sleutel}}` (inline script), ingevuld door `tools/pages.mjs`; ratel voor `pages/` op 0, NL-pagina tekstueel gelijk, EN-pagina zonder Nederlands, skelet per taal gelijk (tests)
  - **Afhankelijkheden buiten dit plan**: accounts/sync (Fase 2) alleen voor het bewaren van de voorkeur in een account; `kevs-inn.com` is in het Cloudflare-dashboard gekoppeld (V1, bevestigd 24-10-2026), niet in `wrangler.jsonc`.

## Technische schuld
- [ ] **TS1** pdf.js zelf hosten (nu via CDN, zonder SRI)
- [ ] **TS3** Logboek buiten de undo-snapshots houden (sinds WP27 is een logregel ± 2,5× groter door `m`/`w` naast `msg`/`why`; elke undo-stap bewaart de hele stand incl. max 600 regels, worst case ± 20 MB in IndexedDB bij 80 stappen en ± 300 KB stringify per tik). Simpele tussenstap uit de dev-review WP27: in `S.log` geen `msg`/`why` als er `m`/`w` is en die pas in `buildExport` aanvullen (± 25–30 % per regel; `stepEntries` dan op `msg ?? JSON van m`).

## Fase 2: sync
- [ ] Login en sync tussen apparaten (bijv. Supabase), local-first blijft de basis. Eerste collectie: `encounters` (heeft al `id` + `updatedAt`, nieuwste wint); tot dan wisselen via Delen/Importeren per encounter
- [ ] Delen met een co-DM
- [ ] Spelersscherm-kamer: vaste code per campagne zodra er accounts zijn (`isOwner` in `worker/room.js`)
- [ ] Taalvoorkeur in het account (TA6 levert een opslag-adapter; nieuwste keuze wint, sync wijzigt nooit midden in een sessie)

## Fase 3: AI (via Cloudflare Worker, sleutel nooit in de browser)
- [ ] AI-gestuurde vijanden: voorgestelde actie op basis van statblock, HP, condities en logboek
- [ ] Battle maps: bij voorkeur als gestructureerde data (grid, muren, terrein) die de app tekent
- [ ] Kostenbeheer: login en een limiet per gebruiker voordat dit publiek gaat
- AI en taal (zie `docs/i18n.md` §5): elke Worker-aanroep krijgt `lang`; voorstellen verwijzen naar id's (deelnemer, actie uit het statblock), gegenereerde tekst is daarna inhoud en wordt niet opnieuw vertaald; battle maps met labelsleutels

---

## DM-review 2 (19-10-2026): drie persona's
Op 360/390 px en 1024 px, met het voorbeeld, alle panelen en een paar beurten. Volledig verslag: projectdoc `claude/dm-review-persona-s.md`.
- **Sanne** (beginner, eerste campagne, telefoon): weet niet waarom ze naar Gevecht zou gaan als Start gevecht ook in Voorbereiden staat; schrikt van "level onbekend" in het voorbeeld; vindt Encounters niet onder "Monster toevoegen"; "‹" en "AoE" zeggen haar niets.
- **Joost** (ervaren, homebrew, tablet + tv): wil in Voorbereiden geen Schade/Reaction maar inrichten; mist XP na het gevecht; zijkolom bij een speler zonder sheet is leeg.
- **Gerard** (oude rot, 30 jaar DM): elke tik telt: HP-balk moet direct schade openen; twee verschillende toevoegschermen; initiative bij Start rollen, niet bij toevoegen; Reaction bij spelers overbodig.

## Persona-test 3 (21-10-2026): drie DM's en negen spelers
Op 1.34.0, in Playwright/Chromium met de schermmaat en touch van elk apparaat, spelers op eigen browsers via de kamer. Rapport: artifact "Initiative Tafel persona-test"; beoordeling: projectdoc `claude/persona-test-3.md`.
- **Lotte** (beginner, iPhone, één hand) met Sem (nooit gespeeld), Noor (landscape) en een laatkomer.
- **Daan** (ervaren, MacBook + tv) met tv-publiek, Jesse (wizard) en Fatima (rules lawyer).
- **Marieke** (veteraan, iPad Pro, 18 deelnemers) met Kees (groot lettertype), Ilse (Discord) en Ravi (wifi kwijt).
- Goed bevonden: snelheid en geheimhouding van het spelersscherm, de regels (massive damage, temp HP, concentratie, AoE, DMG-XP), aanval op een doel, 0 HP/death saves, opslag en undo, cijferpad.
- 38 punten beoordeeld; in de code nagelopen: GV6 (breder dan gemeld), SC2b, SC3 (heartbeat 25/60 s), GV8a, AF7, AF11 (UTC). Omgezet naar de codes hierboven.
- **Niet overgenomen:** groepsbeurt op het DM-scherm (bewuste keuze: alleen weergave, elk lid eigen beurt voor recharge/saves/condities); "Groep blijft hangen" (bewust onthouden per sessie in `ui.addOpts`, gedeeld met encounter inladen). Hoofdprioriteit van Delay (P1 in het rapport) en conditie-uitleg/Exhaustion (P1) verlaagd naar P2: geen fout in de lopende regels, wel uitbreiding. "Resistances uit het statblock niet vanzelf": klopt niet voor AoE en het aanvalspaneel (`defMode`), alleen het losse schadepaneel kent geen damage type.

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
- [x] **GV5** Initiative van monsters opnieuw rollen bij Start: "Monsters: Houden | Opnieuw rollen" in het initiative-paneel, per apparaat onthouden; alleen onaangeroerde worpen, groep één worp (1.31.5)
- [x] **AF1–AF3** Afwerking voor beginners (1.31.6): eigen knoppen "… importeren…" i.p.v. de Engelse "Choose File" (vier bestandskiezers); logboek en gekopieerde tekst tonen "Voorbereiding" i.p.v. "R–"/"R0"; Vorige in de beurtbalk heeft het bijschrift "Vorige" onder "‹"
- [x] **TS2** Character sheets en portretten apart van de undo-stappen (1.31.7): één keer per inhoud bewaard (geheugen en IndexedDB `hb:`), de stap verwijst ernaar; scheelt per stap de volle sheet (in de test ± 34 kB → 0,7 kB per stap)
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
- **DA3** (1.31.8) Eén DM-tabblad tegelijk: het nieuwste wint; het oude slaat niets meer op, stuurt niets meer naar spelers en toont "Dit tabblad is gestopt" met **Hier verder werken** (herlaadt met de nieuwste stand en undo).
- **SP1** (1.31.2) Party: "↻ Bijwerken" per lid met D&D Beyond-link, inline bevestigvak met de wijzigingen (ook naam); onzekere AC/HP uit de sheet gaan niet over een bestaande waarde.
- **GV3** (1.31.3) Tablet/desktop: onder een speler zonder sheet staat in een gevecht het statblock van het monster dat nu of hierna aan de beurt is ("Daarna: Goblin ×3"), met klikbare aanvallen; leespositie blijft als dat monster aan de beurt komt.
- **IN7** (1.32.0) Logboek in Gevecht: het rondeblok in de kop ("Gevecht · Logboek ▸ / Ronde N") opent een paneel met alle regels, reden toevoegen en Kopieer; in Gevecht staat het niet meer onder de lijst. Voorbereiden ongewijzigd. UX-agent koos de kop boven een strook bij de dock (dock vol, dubbel met meldingen).
- **GV4** (1.32.1) Instellingen → Weergave → "Reaction van spelers: Knop | Spelers zelf": bij Spelers zelf geen Reaction-knop en geen badge op spelerskaarten (Heal wordt breed); monsters houden de knop.
- **OB1/OB2** (1.33.0) Rondleiding in twee delen: Voorbereiden (na de welkomstkaart, 6 stops) en Gevecht (bij de eerste Start gevecht, 6 stops), met Overslaan/Terug/Volgende; eenmalig per apparaat, bestaande gebruikers niet vanzelf. Opnieuw via Instellingen → Hulp → "Rondleiding opnieuw".
- **AF5** (1.33.1) Instellingen in inklapbare secties (Weergave · Spells · Spelersscherm · Hulp · Opslag), alle dicht, met een statusregel in de kop ("Gedeeld · K7M 3QX · 2 schermen", "Export: 8 dagen geleden"); ⚙ zet Spelersscherm open bij kamer kwijt/gepauzeerd en Opslag als een export nodig is.
- **RE7** (1.33.1) Open saves: ‹ Vorige telt de veroudering terug; monster zonder bekende savebonus (geen statblock/ability score) krijgt ✓/✗ "zelf rollen" i.p.v. "Rol +0", en wordt bij Rol alle monsters, AoE en Spell overgeslagen met een melding.
- **SP3** (1.33.1) + Speler met een bestaand partylid: geen nieuw lid met volle HP meer maar aan tafel met de bewaarde stand (met sheet: eerst bijgewerkt), nooit dubbel aan tafel; item-spells alleen als het item gedragen/geattuned is; een trage PDF overschrijft een net opgehaalde link-sheet niet meer.
- **VB3** (1.34.0) Monsters met een veel lagere CR (XP < 1/10 van het sterkste monster, DMG 2014) tellen niet mee voor de multiplier, hun XP wel; uitleg noemt ze, met **Toch meetellen** (lijst: één undo-stap; per encounter in de bibliotheek, gaat mee bij opslaan/inladen). Level via ⋯ niet gebouwd: al afgedekt door het levelveld op de kaart (IN2) en in de uitleg (VB1).
- **SP2** (1.34.0) Resistances per speler: ⋯ → "Resistances · Wijzig ▸" met Resist | Immuun | Kwetsb. en 13 type-knoppen (in beide modi, ook buiten de party); uit de D&D Beyond-link (bijwerken houdt eigen toevoegingen en meldt "Resist +fire −cold"). Automatisch in AoE ("resistant (opgeslagen)") en het aanvalspaneel; hint in het schadepaneel en het live-blok.
- **SC2** (1.35.0, WP1) Spelersscherm verraadt niets: zonder gevecht alleen spelers (kop "Nog geen gevecht · Wacht op de DM", na afronden "Gevecht voorbij · Na N rondes"); verborgen monster aan de beurt = vorige zichtbare beurt blijft staan (begint hij ronde 1: "Gevecht begint").
- **SC3** (1.35.0, WP1) Verbinding kwijt: spelers pingen 10 s/dood na 20 s, `offline` meteen; amberkleurige balk "Geen verbinding · stand van 21:14" met gedimde lijst, na 2 min lijst weg. DM weg (kamer meldt `dmnet`): na 45 s neutrale balk "De DM is even weg".
- **AF6** (1.35.1, WP2) Tikdoelen ≥ 44 px: knoppen, links, invoervelden, pips/slots/resources, death saves, LA/LR, recharge-chips en conditie-toggles; pips en death saves zijn knoppen van 44×44 met het bolletje als `::before` (geen overlap). Panelen (Conditie, Effect, ⋯) komen boven de dock in beeld. `tests/tap.test.js` bewaakt de CSS.
- **IN8** (1.35.1, WP2) Openen van een lagere kaart: de aangetikte kop blijft direct op dezelfde plek, daarna schuift de open kaart boven de dock.
- **IN9** (1.35.1, WP2) Hoofdknop van panelen (Speler/Monster toevoegen, snel toevoegen, Start gevecht) plakt onderaan; iPad: actieve kaart boven de dock.
- **AF7** (1.35.1, WP2) Minteken op iOS: Dex-mod, initiative (+ Speler) en effectwaarde zonder numeriek toetsenbord. Initiative-totalen elders houden het cijferpad (bewust).
- **AF13** (1.35.1, WP2) AC als schildje met een vet getal in de kaartkop; effect-AC in accentkleur met vulling.
- **SC10** (1.35.1, WP2) HP-balken op het spelersscherm even lang: getal met vaste breedte, temp HP eronder.
- **RE8** (1.36.0, WP3) Hold Person: geen voorselectie meer (één doel); Bless/Bane houden hun voorselectie. Teller "Doelen · 2 van 1 · 3rd-level slot" en dezelfde staart op de knop (niet blokkeren: slots volgen in WP9). Caster wisselen houdt de keuze per doel; alleen de nieuwe caster gaat uit, gerolde saves gelden tegen de nieuwe DC.
- **RE9** (1.36.0, WP3) Initiative tijdens het gevecht: al geweest en naar achteren = deze ronde overgeslagen ("Al geweest deze ronde: speelt pas volgende ronde op 4"); wie aan de beurt is houdt zijn beurtplek; nog niet geweest en naar voren = direct na de huidige beurt ("Nog niet geweest: komt direct na Noor, daarna op 15"). Live in ⋯ en als melding (ook het kaartveld). Een echte Delay/Ready-knop alleen als het nodig blijkt.
- **RE12** (1.36.0, WP3) Open saves vervallen niet meer stil: de rij zegt in zijn laatste beurt "vervalt bij Volgende", daarna de melding "Save vervallen zonder uitslag: Lotte WIS 13 · Paralyzed blijft". Knoppen Geslaagd/Gefaald met tekst. Ttl blijft.
- **RE17** (1.36.0, WP3) Concentration save uit de schade: de melding (schadepaneel, AoE, aanvalspaneel) noemt "concentratie-save CON 10 in de beurtbalk"; de beurtbalk is de enige bediening, nu ook in Voorbereiden tijdens een gevecht; concentratie-saves blijven regels (max 2), de rest achter "Saves · N andere open".
- **SP4** (1.37.0, WP4) + Speler zonder worp: initiative komt bij Start gevecht (kaart "–"); tijdens een gevecht wel een verplicht veld met Rol. Eén veld Init-bonus (stepper) i.p.v. Dex-mod. Eigen Nederlandse foutregels onder het veld; AC 1–40, Max HP 1–999, Level 1–20.
- **AF15** (1.37.0, WP4) Geen lettertoetsenbord meer: init-bonus is een stepper, effectwaarde heeft het cijferpad met het teken in de keuze (AC −, Max HP −); geen contact-autofill in + Speler.
- **GV7** (1.37.0, WP4) Start gevecht vraagt bij monsters uit het vorige gevecht: Oude wissen en starten / Toch starten (alleen oude: Oude monsters wissen). Afrondpaneel: "Condities van spelers" met chips (Prone/Grappled/Restrained en condities met een duur standaard aan) en Wis gekozen.
- **AF9** (1.37.0, WP4) Melding met Ongedaan na Speler toevoegen (haalt ook het nieuwe partylid weg) en na Verwijderen (nu één tik); vinkje "Ook opslaan in vaste party" onthouden per apparaat.
- **GV6** (1.34.1) Verwijderen van wie aan de beurt is (⋯ → Verwijder tijdens een gevecht) beëindigt zijn beurt: eerst door naar de volgende (beurtgrenzen, ronde erbij als de volgorde rondgaat), dan weg (`removeCombatant` in `js/rules/turns.js`). Eerder ging de beurt naar de eerste in de volgorde zonder nieuwe ronde.
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
- **GV8** (1.37.1, WP5) Undo: ⌘⇧Z/Ctrl+Shift+Z deed nóg een undo, nu Opnieuw (ook Ctrl+Y). Melding na ↶ noemt wat er terugging ("Ongedaan: Goblin 2: 30 → 0 HP (−30) +2 meer", bij een beurtwissel "Terug naar beurt van Aram (ronde 2)"), met knop **Opnieuw**; Opnieuw alleen in het geheugen (weg na een nieuwe wijziging of herladen).
- **GV10** (1.37.1, WP5) Sneltoetsen in Gevecht (geen paneel open, niet in een veld): N of spatie = Volgende, Shift+N = Vorige, "?" = overzicht (ook Instellingen → Hulp → Sneltoetsen, alleen met muis/toetsenbord).
- **SC4** (1.38.0, WP6) Spelersscherm: kop "Aan de beurt / Daarna" plus de verbindingsbalk vast bovenaan (`.pvstick`), namen in de kop op één regel met ellipsis; lage schermen (max-height 500 px: telefoon liggend, groot lettertype) een kop op één regel en compactere kaarten. Scrollen naar de beurt houdt rekening met de vaste kop.
- **SC5** (1.38.0, WP6) "Dit ben ik": knop "Wie ben jij?" op het spelersscherm, keuze per apparaat (`it-pv-me`, geen account). Eigen kaart met HP, death saves, tags, slots, daily spells en resources; kop "Jij bent aan de beurt" / "Daarna jij"; eigen rij met "jij". Trillen bij aan de beurt en hierna (niet iOS Safari). Personage weg: "staat nu niet in de lijst" met Kies opnieuw; terug met een nieuwe id: op naam teruggevonden. Slots van spelers (`sl`) in de snapshot, monsters nooit.
- **SC8** (1.38.0, WP6) Spelersscherm-teksten: speler op 0 HP zonder dubbele "Unconscious", death saves in woorden ("1 gelukt · 2 mislukt", "nog geen worp"), lange namen over twee regels.
- **GV12** (1.38.0, WP6) Reaction gebruikt heet overal "Reaction op": chip op de dichte kaart en in het live-blok (tablet), de knop op de open kaart, en als tag op het spelersscherm (volgt Condities en GV4 "Spelers zelf"). Niet bij verrast of op 0 HP; niet in de beurtbalk (komt terug bij de eigen beurt).
- **SC6** (1.39.0, WP7) Tv leesbaar op 3 m: één brede regel per deelnemer met condities en HP op dezelfde regel, HP vet en in tekstkleur; letter passend op de schermhoogte (26 px bij 12 regels op 1920×1080, 51 px bij 6), twee kolommen alleen als noodgreep. In volledig scherm geen titel en knoppen.
- **SC7** (1.39.0, WP7) Stop met delen pauzeert de kamer: Opnieuw delen houdt dezelfde code (12 u), tv en telefoons blijven gekoppeld. "Nieuwe code…" (met bevestiging) heft de oude kamer pas op als de nieuwe er is.
- **SC1** (1.39.0, WP7) QR-code (eigen kleine encoder, geen lib): schermvullend om te laten scannen, en op de tv vóór het gevecht.
- **RE10** (1.40.0, WP8) Tik op een conditie geeft uitleg: paneel met 1–3 regels Nederlands, duur en herhaalsave (DM ook de bron). Op het spelersscherm tikbare tags (niet op de tv); duur en save gaan mee in de snapshot, zonder namen van verborgen of anonieme deelnemers.
- **RE11** (1.40.0, WP8) Exhaustion (2014) niveau 1–6 via Conditie → Exhaustion (−/+): disadvantage op aanvallen en monster-saves vanaf 3, max HP gehalveerd vanaf 4 (loopt mee met Aid en bewerken), 6 = dood; long rest één niveau minder.
- **RE16** (1.40.0, WP8) Rage (2014) als preset bij spelers met bevestigstap: resistance B/P/S (Bear Totem: alles behalve psychic) automatisch in AoE en aanvalspaneel, advantage op STR-saves, rage damage in de chip, concentratie stopt, Rage-teller van de sheet telt af. "Rage loopt door?" in de beurtbalk als hij geen schade nam; voorbij bij bewusteloos; Frenzy geeft exhaustion.
- **AF8** (1.40.0, WP8) Deadly: eerste regel in de uitleg met advies ("Met 1 Goblin minder wordt het Hard"). Verrast: uitleg onder de keuze in het initiative-paneel.
- **RE18** (1.41.0, WP9) Schade-spells in AoE: tab Schade met caster, chips met de schade-spells van de caster en een zoekveld (38 SRD-spells met save, tabel gegenereerd uit `data/spells.json`), slot-segment, veld "Dobbelstenen" (ook XdY+Z voor homebrew) met Rol; type, save, half en DC worden ingevuld, upcast en cantrip-schaling in de dobbelstenen, worp in het logboek. Tab Spell heeft een tegel "Schade-spell". Concentratie-spells starten concentratie; herhaalschade (Moonbeam) kost geen nieuw slot.
- **RE1/RE2** (1.41.0, WP9) Slots verbruiken in dezelfde stap (één Ongedaan): AoE-schade-spell en tab Spell met een slot-segment (standaard laagste vrije slot, Pact eerst; meer doelen = hoger slot), Shield en een nieuwe cast via Effect automatisch. "Zelf" per caster onthouden (alleen als de DM het tikt). Niets meer over: niet blokkeren, wel melden. Monsters: statblock-slots en x/day.
- **RE3** (1.41.0, WP9) Pact Magic apart (`casting.pact`): eigen regel "Pact 3rd" op de kaart, terug na short en long rest. Bestaande warlocks: opnieuw ophalen via D&D Beyond.
- **RE13** (1.42.0, WP10) Monsterregels die je vergeet: **Undead Fortitude** rolt de app bij toepassen (CON DC 5 + schade, geslaagd = 1 HP; niet bij radiant of een crit; schadepaneel met knop "Radiant of kritiek", aanvalspaneel en AoE weten het zelf). **Save-riders** na een treffer (67 SRD-aanvallen: Prone, Poisoned/Paralyzed met duur en herhaalsave, gif-schade met of zonder half; ziekte, Life Drain e.d. als herinnering): rij in het aanvalspaneel met Gefaald/Geslaagd (monster: Rol +N), niet ingevuld = open save in de beurtbalk; één undo-stap met de schade. **Parry**: knop "Parry +2 → mis" in het schadepaneel van het monster (reaction gebruikt) en "Parry +N" in het aanvalspaneel bij monster tegen monster.
- **RE14** (1.42.0, WP10) Eigen monster: geplakt statblock krijgt dezelfde structuur als een SRD-monster (aanvallen, LA, reactions, resistances, ability scores, saving throws); live "Herkend: …" onder de tekst, lege velden (naam, CR, AC, HP, Dex) ingevuld met "uit tekst", Voorbeeld ▾. Ook D&D Beyond-kopie en de 2024-schrijfwijze.
- **GV11** (1.42.0, WP10) Multiattack-volgorde in het aanvalspaneel ("Claw 2/3"): bij een misser "Volgende: Claw ▸", na toepassen meteen de volgende aanval op hetzelfde doel. "+ meer doelen" niet gebouwd: tab Spell in AoE doet dat al (hint in het Effect-paneel).
- **SP5** (1.43.0, WP11) Passives per speler (`js/rules/passives.js`): link-sheet `passive` (10 + skill + passive-bonussen), oudere/PDF-sheets afgeleid uit senses en skills; eigen waarde onder ⋯ (Perc/Ins/Inv, leeg = sheet) gaat voor, ook na Bijwerken. Regel "Passive Perc 14 · Ins 12 · Inv 10" op de kaart in Voorbereiden, regel in het live-blok, "Passive Perc" in de Party-regel en "Passive Perception: …" (hoogste eerst) in het initiative-paneel. Nooit op het spelersscherm.
- **VB4** (1.43.0, WP11) Zoeken met NL-woorden (bandiet, skelet, draak, geest, ondode… ± 200 vormen) en typfouten als terugval bij 0 treffers ("gobin" → goblin, afstand 1 bij 4–6 letters, 2 vanaf 7). Kop "\"bandiet\" = bandit" of "Bedoelde je: goblin". Lege-lijstteksten noemen "Eigen".
- **VB5** (1.43.0, WP11) "+ Nieuwe encounter" opent Bewerken leeg (lege naam → "Nieuwe encounter"); aantal per regel typbaar (leeg/0 = vorige waarde, max 50 en 100 totaal); lair-vinkje bij een monster met legendary actions. Tijdens typen wint één exacte naam (ook via een NL-woord) van een eerdere keuze.
- **AF11** (1.44.0, WP12) Exportbestandsnaam in lokale tijd (`exportName`); "Concentratie van" en "Wie cast?" tonen geen dode of uitgeschakelde wezens (`spellTargets`). Verslagen verborgen monsters tellen al mee in de XP, levende niet (nagelopen, blijft zo).
- **RE15** (1.44.0, WP12) Eigen death save-worp: knop "Eigen worp" opent een cijferpad op de kaart (3–9 gaat meteen door, 1/2 wacht op een tweede cijfer of OK), `dsResult` puur; melding met Ongedaan, ook bij Rol death save. Fix: een stabiele speler die schade krijgt, begint weer met death saves (tellers op nul).
- **SC9** (1.44.0, WP12) "Wat er net gebeurde" op het spelersscherm: afgeleid uit opeenvolgende snapshots (`logLines`/`pushLog`), dus lekvrij; telefoon 2 regels, tv 3, in de vaste kop; huidige en vorige ronde. Instelling Aan/Uit onder "Wat spelers zien" (standaard aan).
- **AF10** (1.44.0, WP12) Geen focus naar het naamveld na Toevoegen op touch; rondleiding scrollt direct en het vak schuift niet; Stop met delen zonder "Zeker?", melding met "Opnieuw delen"; "Heb je een export? Importeren…" op de welkomstkaart; hint zonder "Claude-versie". Open Instellingen-sectie dichtklappen = bedoeld (`<details>`).
- **AF12** (1.44.0, WP12) Pips en death saves met de toestand in het label ("1st-level slot 1 van 4, beschikbaar"), geen aria-pressed; `aria-current` op wie aan de beurt is; "speler"/"monster" in het label; monster-avatar afgeronde rechthoek.
- **AF14** (1.44.0, WP12) Worpen in de statblocktekst blijven inline (WCAG 2.5.8-uitzondering), ± 29 px met ruimere regelafstand; test bewaakt het.
