# Werkpakketten homepage

Actieve WP's voor de homepage (`/`, `/nl/`; bron `pages/home.html`). Index en sjabloon: `README.md`.

## WP78 · Homepage: logo desktop en heldafbeelding mobiel · omvang S — Klaar voor uitvoering
- Roadmap/backlog: K8, K9 (`docs/BACKLOG.md`)
- Doel en scope: op desktop een groter embleem bij de kop, op mobiel de onderkant van de heldafbeelding (taveerne en d20) altijd in beeld. Buiten scope: de vorm van het embleem, teksten, de afbeelding zelf.
- Functionele eisen:
  - **K8** (vanaf 900 px): het embleem groter, naast de kop en boven de hoofdtekst. Huidige plek: `.mark` in de `header` (klein, met "Kev’s Inn"). De UX-designer zet minstens twee opties naast elkaar (bijv. het embleem groot in `.hero-txt` links van of boven de `h1`, met de header-mark behouden of verborgen op desktop) en legt de keuze met schermafbeelding (`BC_W=1200 --shots=wp78`) voor ter goedkeuring vóór het afbouwen.
  - **K9** (onder 900 px): de afbeelding onderaan uitlijnen; van de bovenkant alleen zoveel als er ruimte is.
- Technische uitwerking: alleen de inline CSS en markup van `pages/home.html` (r. 44–66: `.hero-img`, `object-position:50% 35%` → richting `50% 100%` onder het breekpunt; desktopregels in `@media (min-width:900px)`). Het embleem staat als inline SVG in de header; bij een tweede plek dezelfde tekening (`EMBLEM` in `tools/icons.mjs`) en `aria-hidden`. Daarna `node tools/pages.mjs`.
- Relevante besluiten: `docs/DECISIONS.md` → "Huisstijl", "Product en communicatie", "Meertaligheid (geldt voor elke tool)" (NL en EN delen de opmaak).
- Afhankelijk van: geen.
- Acceptatiecriteria:
  - `npm test` volledig groen (pagina's, tikdoelen, contrast).
  - Browsercheck `home`, `homeen` en `logo` op 320/360/390, licht en donker, plus `BC_W=1200` (en een tussenmaat rond 900 px): geen horizontaal scrollen, taveerne en d20 zichtbaar op mobiel, embleem niet vervormd. Nieuw scenario `wp78` met schermafbeeldingen.
  - UX-designer vóór het bouwen (meerdere opties), senior developer na het bouwen. Geen vertaalagent (geen tekst).
- Volgorde: na WP77 (afgerond in 2.18.2; lage prio; de site is nog verborgen, `HIDDEN = true`).
- Versie: homepage is gedeeld bestand → Initiative patch (2.18.x); Inn Sight-versie ongewijzigd. Patch, dus alleen de scenario's die de diff raakt (`home`, `homeen`, `logo`, `wp78`); Maps-scenario's niet.
- Aandachtspunten en risico's: "naast de kop en boven de hoofdtekst" laat ruimte voor interpretatie; daarom de goedkeuring van de schets. Grotere desktopkop mag de heldafbeelding niet onder de vouw duwen.
