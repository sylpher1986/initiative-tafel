# Werkpakketten

Uitgewerkte, uitvoerbare werkpakketten (WP) per onderdeel van Kev’s Inn. Eén WP = één Claude-gesprek = één push. Alleen **actief** werk staat hier; een afgerond pakket wordt verwijderd (blijvende keuzes → `docs/DECISIONS.md`, historie = git).

## Index

| Bestand | Onderdeel | Actieve WP's |
|---|---|---|
| — | — | Geen (31-10-2026). G1 en G4 zijn afgerond; open projecten in `docs/ROADMAP.md` zijn nog niet uitgewerkt. |

Nummering loopt door: het volgende pakket is **WP76**.

## Bestanden
Eén bestand per onderdeel, aangemaakt zodra er een eerste WP voor is, met de bestaande namen: `initiative.md` (Initiative), `inn-sight.md` (Inn Sight, pad `/maps/`), `homepage.md`, en later bijvoorbeeld `innhabitants.md`, `inquests.md`, `innelligence.md` (G5). Een project met eigen voorbereiding (zoals G7) mag een eigen bestand krijgen, bijvoorbeeld `g7-dobbelstenen.md`. Werk het overzicht hierboven bij bij elk nieuw, gewijzigd of verwijderd pakket.

## Status
`Gepland` (uitgewerkt, wacht op voorgangers of besluit) · `Klaar voor uitvoering` · `In uitvoering` · `Geblokkeerd` (met reden). Afgerond = verwijderen, niet als status bewaren.

## Sjabloon
Het pakket moet zonder projectgeschiedenis uitvoerbaar zijn: noem bestanden, functies en de relevante besluiten (verwijzing naar de kop in `docs/DECISIONS.md`, niet kopiëren).

```
## WPnn · Titel · omvang S/M/L — Status
- Roadmap/backlog: G7 stap 1 (of K-code)
- Doel en scope: …  Buiten scope: …
- Functionele eisen: …
- Technische uitwerking: bestanden, functies, data/formaat, i18n-sleutels
- Relevante besluiten: docs/DECISIONS.md → "…"
- Afhankelijk van: WPxx / besluit Oxx
- Acceptatiecriteria: toetsbaar, incl. tests en browsercheck-scenario
- Volgorde: … (vóór/na WPxx)
- Versie: x.y.z (Initiative en/of Maps)
- Aandachtspunten en risico's: …
```
