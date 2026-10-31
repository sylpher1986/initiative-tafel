# Roadmap Kev’s Inn

Grote projecten (G-codes): wat, waarom, status en afhankelijkheden op hoofdlijnen. Geen technische uitwerking: die komt in `docs/work-packages/` zodra een project gepland wordt. Kleine punten staan in `docs/BACKLOG.md`, geldende keuzes in `docs/DECISIONS.md`.

Stand: Initiative **2.18.0**, Inn Sight (Maps) **1.7.0** (30-10-2026).

**Status:** Idee · Plan nodig · Gepland · In uitvoering · Geblokkeerd. **Prioriteit:** alleen ingevuld als Michiel die heeft vastgelegd; anders "—".

## Projecten

| Code | Project | Doel en functionaliteit op hoofdlijnen | Prio | Status | Afhankelijkheden en open besluiten | Werkpakketten |
|---|---|---|---|---|---|---|
| **G2** | **Accounts en sync** (fase 2) | Local-first blijft de basis. Eerste collectie `encounters` (heeft `id` + `updatedAt`, nieuwste wint). Daarna: delen met een co-DM, vaste kamercode per campagne (`isOwner` in `worker/room.js`), taalvoorkeur in het account (nieuwste keuze wint, nooit midden in een sessie). Inn Sight-kaarten zijn sync-klaar (`id` + `updatedAt`, assets op sha256; `docs/g4-inn-the-grid.md` §2.9). | — | Plan nodig | Open: dienst (bijv. Supabase) en kosten; rol van export/import daarna; rate-limit `ROOM_LIMIT` op eigenaar in plaats van IP. | — |
| **G3** | **AI-vijanden** (fase 3) | Voorgestelde actie op basis van statblock, HP, condities en logboek, via de Worker (sleutel nooit in de browser). | — | Plan nodig | Hangt af van **G2**: login en een limiet per gebruiker vóór het publiek gaat. Elke aanroep krijgt `lang`; voorstellen verwijzen naar id's; gegenereerde tekst is daarna inhoud (`docs/i18n.md` §9). | — |
| **G4+** | **Inn Sight: vervolg** | Na G4 (afgerond): muren/deuren op celranden, meervoudige selectie, vrij tekenen, lagenpaneel; later line of sight en licht. | — | Idee | Eerst een vervolgplan als Michiel dat wil. `kevs-inn-maps` (formaat, opslag, cache) blijft de interne naam. Grenzen in `LIMITS` (`js/maps/model/limits.js`). | — |
| **G5** | **Andere Kev’s Inn-tools** | Innhabitants (characters), Inquests (campagnes), Innelligence (AI-companion), naast Initiative en Inn Sight. | — | Idee | Per tool een eigen plan; stappen voor een nieuwe tool in `docs/i18n.md` §9.2. De homepage toont een tool pas als hij bestaat; iconen liggen klaar in `brand/tool-icons/`. Innelligence raakt G3. | — |
| **G6** | **Derde taal** (bijv. Duits) | Volledige app in een derde taal. | — | Idee | Gelokaliseerde D&D-termen pas na licentie-onderzoek (V7, `docs/i18n.md` §4.3); stappen in §9.3. | — |
| **G7** | **Dobbelstenen zichtbaar maken** (gedeelde module, eerst in Initiative) | **Stap 1**: worpen visueel tonen (stenen, welke telt bij advantage/disadvantage, modifiers met naam, crit/nat 1, totaal) en een vrije dobbelsteenworp. **Stap 2**: optionele rolanimatie. Logica en weergave zijn gedeeld (`js/dice/`), zodat Innhabitants en andere tools ze hergebruiken. | — | In uitvoering (fundament WP79 af, 2.18.4; weergave + aanvalspaneel WP80 af, 2.19.0; uitrol naar de overige worpen WP81 af, 2.19.2) | Architectuur: DECISIONS → "Techniek" (Gedeelde dobbelsteenmodule). Geen open besluiten. | WP82–WP83 (`docs/work-packages/g7-dobbelstenen.md`) |

## Afgerond (alleen voor traceerbaarheid)
- **G1** 2024-regels naast 2014: WP46–WP55, Initiative 2.4.0–2.11.1, 28-10-2026. Keuzes en besluiten B1–B10 in `docs/DECISIONS.md`.
- **G4** Inn Sight (was Inn the Grid): WP56–WP75, Maps 0.1.0–1.7.0 / Initiative 2.18.0, 30-10-2026. Keuzes en besluiten in `docs/DECISIONS.md`; architectuur en bestandsformaat in `docs/g4-inn-the-grid.md`.
- WP1–WP45 en de oude codes (IN, GV, VB, RE, SP, SC, AF, OB, DA, HS, TA, TS, WB): roadmap en CLAUDE.md van commit `4e83db1`.
