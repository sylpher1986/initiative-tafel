# Roadmap

Stand: **2.11.1** (28-10-2026). G1 (2024-regels) is klaar: regelset per tafel onder Instellingen → Regels; keuzes in CLAUDE.md, plan en besluiten als historie in `docs/g1-regels-2024.md`. Alleen open werk staat hier. Wat klaar is, staat in de code, in CLAUDE.md ("Gemaakte keuzes") en in de git-geschiedenis. De oude roadmap met alle afgevinkte punten (codes IN, GV, VB, RE, SP, SC, AF, OB, DA, HS, TA, TS, WB en WP1–WP45) staat in commit `4e83db1`.

Codes: **K** = kleine fix of optimalisatie (één sessie, patch- of minor-versie), **G** = groot project (eerst een eigen plan met inventaris en besluiten). Een afgerond punt gaat hier weg; de keuze komt in CLAUDE.md.

## Kleine fixes en optimalisaties

Volgorde = voorstel. K1–K3 merkt de gebruiker, K4–K7 zijn technisch, K8–K9 zijn wensen met lage prio.

| Code | Wat | Waar | Opmerking |
|---|---|---|---|
| **K1** | Foutbalk toont fouten van browserextensies als app-fout (Safari: `webkit-masked-url://hidden/`, "runtime.sendMessage(). Tab not found") | inline foutvanger in `pages/initiative.html` (r. 16–26; het spelersscherm heeft er geen) | Pure `isOwnError(file, stack, own = location.origin)`: alleen tonen als bestand of stack bij de eigen origin hoort; rejection zonder stack wel tonen; "Script error." zonder bestand niet. Rest naar `console.warn`. Test `tests/errfilter.test.js` met `webkit-masked-url`, `safari-web-extension://`, `chrome-extension://`, `moz-extension://`. Geen tekstwijziging. |
| **K2** | Initiative-paneel telt monsters uit het vorige gevecht mee in de monster-hint, ook als "Oude wissen en starten" ze weghaalt | `monRollHtml` in `js/ui/render.js` (via `paintInit`) | Telt alle monsters in `S.list`. Bekend sinds 1.37.0. |
| **K3** | Mini-log spelersscherm: toegevoegde condities nog met komma ("Poisoned, Prone"), weggevallen al als opsomming ("Poisoned and Prone ended") | `js/playerview.js` | Array-param aan de sleutel, zoals `player.log.gone`. |
| **K4** | pdf.js als echte Worker laden in plaats van op de hoofdthread | `js/ddb.js` | Kan sinds het zelf hosten (2.2.1). Meten op een oudere iPad. |
| **K5** | pdf.js geminificeerd (nu ± 2,5 MB in een eigen sw-cache, voor iedereen) | `vendor/pdfjs/`, `sw.js` | De release-zip had geen min-build en npm/cdnjs waren niet bereikbaar. Nieuwe cachenaam bij een wissel. |
| **K6** | Undo-opslag verder verkleinen: het logboek helemaal buiten de snapshots | `js/state.js`, `js/log.js` | Eerst besluit Michiel. Nu 147 KB per stap bij 600 logregels (na −23 % in 2.2.1). |
| **K7** | Een sheet die in place wijzigt, wordt bij elke commit opnieuw gestringifyd | `js/histpack.js`, `js/state.js` | Alleen als een meting bij een grote party het rechtvaardigt. |
| **K8** | Homepage desktop: logo groter, naast de kop en boven de hoofdtekst | `pages/home.html` (eigen inline CSS) | Lage prio. Logo-vorm niet wijzigen; gedeeld bestand, dus Initiative-versie omhoog. |
| **K9** | Homepage mobiel: heldafbeelding onderaan uitlijnen, bovenkant alleen voor zover er ruimte is (onderkant met taveerne en d20 zegt meer) | `pages/home.html`, `img/hero-tavern-*` | Lage prio. Waarschijnlijk `object-position`/`background-position` op bottom onder een breekpunt. |

### Op signaal (pas bouwen als het aan tafel nodig blijkt)
- Delay/Ready-knop (nu: initiative via ⋯ aanpassen, met de RE9-logica).
- Handmatige "Defenses" van de D&D Beyond-sheet (`customDefenseAdjustments`) inlezen; tijdelijke resistances (Rage, Absorb Elements, Protection from Energy) als effect-preset.
- Negatieve waarden typen in initiative-totalen (cijferpad zonder minteken; bewust zo gelaten).
- Undead Fortitude bij rider-schade.
- D&D Beyond-import: condition immunities en vaste aftrek (Heavy Armor Master).
- DM-kant "N schermen (was M)": vraagt een scherm-id per tabblad, anders vals alarm.
- 2024-regels (uit G1): "4 in Lair" / "4/Day in Lair" gebruiken (wordt gelezen, niet toegepast); Incapacitated (disadvantage) en Invisible (advantage) op initiative 2024 automatisch (nu alleen in de uitleg); CR 0-monsters met "XP 0" tellen als 10 XP (`crXp` gaat vóór `xp`); Sphinx of Valor "Roar" heeft drie DC's, de app neemt de eerste; Nederlandse zoeksynoniemen voor meer SRD 5.2-namen.

### Bekende beperkingen (geaccepteerd)
- Undead Fortitude: `applyDamage` meldt al "is neer" en laat concentratie vallen vóór de save (zombies concentreren niet).
- Een DM-socket die stil wegvalt (geen close), merkt de kamer pas als de runtime hem sluit.
- DM Sans heeft geen tabular-nums: uitlijning komt uit vaste kolombreedtes.

### Operationeel (Michiel, geen code)
- `*.workers.dev`: doorsturen naar `kevs-inn.com` of uitzetten (besluit V1, nog open).
- Live check 2.3.0/2.3.1: `kevs-inn.com/en/initiative/` → 301 naar `/initiative/`; `/` = Engelse homepage; geïnstalleerde iPhone-app start in het Nederlands; versie 2.3.1 onderaan Instellingen; app offline openen vanaf het beginscherm.
- Live check G1 (2.11.x) op de telefoon: Instellingen → Regels → 2024; "Start met voorbeeld" geeft Goblin Warriors; zoek "zombie 2024" en voeg toe; Exhaustion 4 op een speler halveert max HP niet; wisselen tijdens een gevecht kan niet; spelersscherm (QR) legt Grappled uit volgens 2024; export → import houdt "2024" in Instellingen; terug naar 2014 en offline openen werkt.
- Site vindbaar maken: `HIDDEN = true` in `tools/pages.mjs` (robots `Disallow: /`). Op `false`, `node tools/pages.mjs`, daarna de sitemap in Search Console.
## Grote projecten (lange termijn)

Nog niet uitgewerkt. Elk project begint met een plan: inventaris in de code, open besluiten, werkpakketten.

| Code | Project | Open besluiten en afhankelijkheden |
|---|---|---|
| **G2** | **Accounts en sync** (fase 2), local-first blijft de basis. Eerste collectie `encounters` (heeft `id` + `updatedAt`, nieuwste wint). Daarna: delen met een co-DM, vaste kamercode per campagne (`isOwner` in `worker/room.js`), taalvoorkeur in het account (nieuwste keuze wint, nooit midden in een sessie). | Dienst (bijv. Supabase) en kosten; rol van export/import daarna; rate-limit `ROOM_LIMIT` op eigenaar in plaats van IP. |
| **G3** | **AI-vijanden** (fase 3): voorgestelde actie op basis van statblock, HP, condities en logboek, via de Worker (sleutel nooit in de browser). | Hangt af van G2: login en een limiet per gebruiker vóór het publiek gaat. Elke aanroep krijgt `lang`; voorstellen verwijzen naar id's; gegenereerde tekst is daarna inhoud (`docs/i18n.md` §9). |
| **G4** | **Inn Sight** (was Inn the Grid; battle maps) op `/maps/`, eerst los van Initiative, met een eigen versienummer. Plan, MVP, werkpakketten WP56–WP75 en besluiten in `docs/g4-inn-the-grid.md`. WP56 klaar (Maps 0.1.0: tool-skelet, vierkant raster, pannen en zoomen), WP57 klaar (Maps 0.2.0: hexraster en paneel Kaart), WP58 klaar (Maps 0.3.0: kaarten lokaal bewaren, Mijn kaarten, opslagstatus, één tabblad), WP59 klaar (Maps 0.4.0: achtergrondafbeelding kiezen, verkleinen, uitlijnen), WP60 klaar (Maps 0.5.0: projectbestand v1, exporteren en importeren; **M1 bereikt**), WP61 klaar (Maps 0.6.0: undo/redo, Bibliotheek met 24 ingebouwde onderdelen, Plaatsen), WP62 klaar (Maps 0.7.0: selecteren, verplaatsen, draaien, schalen, laag/volgorde, dupliceren, verwijderen, toetsenbord), WP63 klaar (Maps 0.8.0: terrein per cel verven, tab Terrein in Bibliotheek), WP64 klaar (Maps 0.9.0: eigen assets, tab Eigen = Mijn assets, mee in export/import), WP65 klaar (Maps 0.10.0: zijpaneel vanaf 768 px, sneltoetsenoverzicht, uitleg in een lege kaart, verven met het toetsenbord, foutregels onder de rij, zichtbare naam Inn Sight), WP66 klaar (Maps 0.11.0: kaartbuffer voor pannen en zoomen, hexranden één keer, grenzen centraal met melding, meetstand `/maps/?bench`; iPad-meting 29-10: 34–41 fps, openen 1,8 s, alles Goed). WP67 klaar (Maps 1.0.0: uitgebracht, toolkaart op de homepage met label Beta, documentatie Inn Sight; **M2 bereikt**). WP68 klaar: 68a (Maps 1.1.0, huisstijl), 68b (1.2.0, uitleg + raster-chip), 68c (1.3.0, assets hertekend), 68d (1.4.0, installeerbaar per taal, Beta weg). Volgende in G4: fase 3 (koppeling met Initiative, pas na akkoord; plan §4). Open: handcheck installeren op Android en iPhone (Michiel). Hernoeming naar Inn Sight (D13) afgerond. | D1–D3 besloten (pad `/maps/`, eigen versie, Canvas 2D voor nu), D10 (max 100×100) in WP57, bevestigd met 2000 objecten in WP66 (ook op de oudste iPad), D11 (eigen `maps-tab`, nieuwste wint) in WP58, D12 (25 MB / 4096 px / PNG-JPEG-WebP) in WP59, D4/D5 (één JSON met base64, `.json`) in WP60, D6 (eigen SVG's) in WP61; D8–D9 = aanbevelingen in het plan, per pakket te bevestigen. Koppeling met Initiative en spelersscherm pas na M2. D7 afgerond in WP68d: homepage, installeerbaar per taal (`/maps/` en `/nl/maps/`), `noindex` blijft. D13: pad `/maps/` bevestigd in WP67; `kevs-inn-maps` (formaat, opslag, cache) blijft, dus oude bestanden blijven importeerbaar. |
| **G5** | **Andere Kev's Inn-tools**: Innhabitants (characters), Inquests (campagnes), Innelligence (AI-companion), naast Inn Sight (G4). | Per tool een eigen plan; stappen voor een nieuwe tool in `docs/i18n.md` §9.2. De homepage toont een tool pas als hij bestaat; iconen liggen klaar in `brand/tool-icons/`. |
| **G6** | **Derde taal** (bijv. Duits). | Gelokaliseerde D&D-termen pas na licentie-onderzoek (V7, `docs/i18n.md` §4.3); stappen in §9.3. |
| **G7** | **Dobbelstenen zichtbaar maken** in Initiative. **Stap 1**: betere visuele weergave van wat er gerold is (nu tekst als "d20 [14, 6] dis +2"): per worp de afzonderlijke stenen, welke telt (advantage/disadvantage), modifiers met naam, crit/nat 1, totaal. **Stap 2** (pas na stap 1): optionele rolanimatie. | Inventaris van alle worpen: aanvalspaneel (`atkHtml` in `js/ui/render.js`, `js/rules/attacks.js`), AoE/saves (`js/rules/aoe.js`, `js/rules/monrules.js`, schade-spells `js/rules/dmgspells.js`), initiative (`js/rules/turns.js`, initiative-paneel), death saves, HP rollen bij toevoegen. Regels blijven codes/descriptoren teruggeven (worpdata, geen tekst); weergave in `js/ui/`. Open: één gedeeld worponderdeel voor alle panelen; leesbaar op 320 px en tikdoelen; kleur alleen volgens de eigenaarschapsregels (geen goud, rood alleen kritiek); log en spelersscherm wel of niet. Animatie: kort, overslaan bij `prefers-reduced-motion`, aan/uit per apparaat, nooit wachten aan tafel. |

## Bewust niet (niet opnieuw voorstellen zonder nieuwe aanleiding)
- "Groep blijft hangen" bij monsters toevoegen: de keuze wordt bewust per sessie onthouden (`ui.addOpts`).
- Groepsbeurt als één beurt op het DM-scherm: groepen zijn alleen weergave (recharge, saves, condities per lid).
- Kleur als speler/monster-identiteit (Forest/Copper botsen met Success/Warning); de vorm draagt het verschil.
- Automatische taalredirect op browsertaal of voorkeur (behalve de geïnstalleerde app, `launchRedirect`).
- Resist én kwetsbaar op hetzelfde damage type (komt bijna niet voor).
- Echte monsterafbeeldingen: geen vrij bruikbare bron.
- Op het spelersscherm: encounternaam of -notitie, verborgen monsters of hun beurt.
