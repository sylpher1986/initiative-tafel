# Backlog Kev’s Inn

Kleine punten: bugs, kleine functionele, UX/UI- en technische verbeteringen, losse ideeën. Eén punt = één sessie (patch- of minor-versie). Groter dan dat → project in `docs/ROADMAP.md`. Afgerond = regel weghalen; een blijvende keuze gaat naar `docs/DECISIONS.md`.

**Codes:** K-nummers lopen door (laatste: K11; K10 is afgerond). **Prio:** H/M/L, alleen waar vastgelegd; anders volgt de volgorde van de tabel (voorstel). **Status:** Open · Wacht op besluit · Op signaal · In uitvoering.

## Open punten

K1–K3 merkt de gebruiker, K4–K7 zijn technisch, K8–K9 zijn wensen met lage prio.

| Code | Soort | Onderdeel | Prio | Status | Wat | Waar | Opmerking |
|---|---|---|---|---|---|---|---|
| **K1** | Bug | Initiative | — | Open | Foutbalk toont fouten van browserextensies als app-fout (Safari: `webkit-masked-url://hidden/`, "runtime.sendMessage(). Tab not found") | inline foutvanger in `pages/initiative.html` (r. 16–26; het spelersscherm heeft er geen) | Pure `isOwnError(file, stack, own = location.origin)`: alleen tonen als bestand of stack bij de eigen origin hoort; rejection zonder stack wel tonen; "Script error." zonder bestand niet. Rest naar `console.warn`. Test `tests/errfilter.test.js` met `webkit-masked-url`, `safari-web-extension://`, `chrome-extension://`, `moz-extension://`. Geen tekstwijziging. |
| **K2** | Bug | Initiative | — | Open | Initiative-paneel telt monsters uit het vorige gevecht mee in de monster-hint, ook als "Oude wissen en starten" ze weghaalt | `monRollHtml` in `js/ui/render.js` (via `paintInit`) | Telt alle monsters in `S.list`. Bekend sinds 1.37.0. |
| **K3** | Bug | Spelersscherm | — | Open | Mini-log: toegevoegde condities nog met komma ("Poisoned, Prone"), weggevallen al als opsomming ("Poisoned and Prone ended") | `js/playerview.js` | Array-param aan de sleutel, zoals `player.log.gone`. |
| **K4** | Techniek | Initiative | — | Open | pdf.js als echte Worker laden in plaats van op de hoofdthread | `js/ddb.js` | Kan sinds het zelf hosten (2.2.1). Meten op een oudere iPad. |
| **K5** | Techniek | Initiative | — | Open | pdf.js geminificeerd (nu ± 2,5 MB in een eigen sw-cache, voor iedereen) | `vendor/pdfjs/`, `sw.js` | De release-zip had geen min-build en npm/cdnjs waren niet bereikbaar. Nieuwe cachenaam bij een wissel. |
| **K6** | Techniek | Initiative | — | Wacht op besluit | Undo-opslag verder verkleinen: het logboek helemaal buiten de snapshots | `js/state.js`, `js/log.js` | Eerst besluit Michiel (`docs/DECISIONS.md` O2). Nu 147 KB per stap bij 600 logregels (na −23 % in 2.2.1). |
| **K7** | Techniek | Initiative | — | Op signaal | Een sheet die in place wijzigt, wordt bij elke commit opnieuw gestringifyd | `js/histpack.js`, `js/state.js` | Alleen als een meting bij een grote party het rechtvaardigt. |
| **K8** | UX/UI | Homepage | L | Open | Desktop: logo groter, naast de kop en boven de hoofdtekst | `pages/home.html` (eigen inline CSS) | Logo-vorm niet wijzigen; gedeeld bestand, dus Initiative-versie omhoog. |
| **K9** | UX/UI | Homepage | L | Open | Mobiel: heldafbeelding onderaan uitlijnen, bovenkant alleen voor zover er ruimte is (onderkant met taveerne en d20 zegt meer) | `pages/home.html`, `img/hero-tavern-*` | Waarschijnlijk `object-position`/`background-position` op bottom onder een breekpunt. |
| **K11** | Techniek (alleen commentaar) | Alle | L | Open | Codecommentaar verwijst nog naar `CLAUDE.md` ("Gemaakte keuzes", "Communicatie", WP63, "Assets hertekend") en naar het opgeheven `docs/g1-regels-2024.md` | o.a. `js/maps/main.js`, `js/maps/model/limits.js`, `js/maps/model/assets.js`, `js/maps/version.js`, `js/i18n/term.js`, `tests/maps-objects.test.js`, `tests/encounters.test.js` | Vervangen door `docs/DECISIONS.md` (zelfde kopnamen). Meenemen bij een eerstvolgende codewijziging in die bestanden; geen eigen release nodig. Ontstaan bij de documentatieherstructurering van 31-10-2026. |

## Op signaal (pas bouwen als het aan tafel nodig blijkt)
- Initiative: Delay/Ready-knop (nu: initiative via ⋯ aanpassen, met de RE9-logica).
- D&D Beyond-import: handmatige "Defenses" van de sheet (`customDefenseAdjustments`) inlezen; tijdelijke resistances (Rage, Absorb Elements, Protection from Energy) als effect-preset.
- Initiative: negatieve waarden typen in initiative-totalen (cijferpad zonder minteken; bewust zo gelaten).
- Gevecht: Undead Fortitude bij rider-schade.
- D&D Beyond-import: condition immunities en vaste aftrek (Heavy Armor Master).
- Spelersscherm: DM-kant "N schermen (was M)": vraagt een scherm-id per tabblad, anders vals alarm.
- 2024-regels (uit G1): "4 in Lair" / "4/Day in Lair" gebruiken (wordt gelezen, niet toegepast); Incapacitated (disadvantage) en Invisible (advantage) op initiative 2024 automatisch (nu alleen in de uitleg); CR 0-monsters met "XP 0" tellen als 10 XP (`crXp` gaat vóór `xp`); Sphinx of Valor "Roar" heeft drie DC's, de app neemt de eerste; Nederlandse zoeksynoniemen voor meer SRD 5.2-namen.
- Inn Sight: meervoudige selectie (WP62/WP74: later, op signaal).

## Operationeel (Michiel, geen code)
- `*.workers.dev`: doorsturen naar `kevs-inn.com` of uitzetten (besluit open, `docs/DECISIONS.md` O1).
- Live check 2.3.0/2.3.1: `kevs-inn.com/en/initiative/` → 301 naar `/initiative/`; `/` = Engelse homepage; geïnstalleerde iPhone-app start in het Nederlands; versie 2.3.1 onderaan Instellingen; app offline openen vanaf het beginscherm. **Let op:** het punt over de iPhone-app gaat uit van gedrag van vóór K10 (`docs/DECISIONS.md` O3).
- Live check G1 (2.11.x) op de telefoon: Instellingen → Regels → 2024; "Start met voorbeeld" geeft Goblin Warriors; zoek "zombie 2024" en voeg toe; Exhaustion 4 op een speler halveert max HP niet; wisselen tijdens een gevecht kan niet; spelersscherm (QR) legt Grappled uit volgens 2024; export → import houdt "2024" in Instellingen; terug naar 2014 en offline openen werkt.
- Inn Sight: handcheck installeren op Android en iPhone (uit G4).
- Inn Sight WP65: "handmatige check (3) door Michiel staat nog open" (onduidelijk welke; `docs/DECISIONS.md` O6).
- Site vindbaar maken: `HIDDEN = true` in `tools/pages.mjs` (robots `Disallow: /`). Op `false`, `node tools/pages.mjs`, daarna de sitemap in Search Console.
