// Inn Sight (G4, WP61): catalogus van de ingebouwde onderdelen, puur (geen DOM, Node-testbaar). D6 (besloten in WP61
// op het advies): eigen, eenvoudige top-down SVG's uit de repo (data/maps-assets/<id>.svg), licentieschoon; geen
// SVG-uploads (docs/g4-inn-the-grid.md §2.6). De id is wat in de opslag en in een export staat: nooit hernoemen of
// hergebruiken (tests/maps-objects.test.js bevriest de lijst). Naam via de catalogus: maps.asset.<id>, categorie via
// maps.cat.<cat> (DYNAMIC); daarom alleen kleine letters en cijfers (een catalogussleutel kent geen streepje).
// w/h = standaardgrootte in cellen, layer = "floor" (onder) of "object" (erboven).

/** Categorieën in de volgorde van het paneel */
export const CATS = ["floor", "build", "furniture", "nature"];

/** Ingebouwde onderdelen: id → { cat, w, h, layer } (volgorde = volgorde in het paneel) */
export const BUILTIN = Object.freeze({
  flagstone: { cat: "floor", w: 1, h: 1, layer: "floor" },
  planks: { cat: "floor", w: 1, h: 1, layer: "floor" },
  dirt: { cat: "floor", w: 1, h: 1, layer: "floor" },
  rug: { cat: "floor", w: 2, h: 3, layer: "floor" },
  wall: { cat: "build", w: 1, h: 1, layer: "object" },
  door: { cat: "build", w: 1, h: 1, layer: "object" },
  stairs: { cat: "build", w: 1, h: 2, layer: "floor" },
  pillar: { cat: "build", w: 1, h: 1, layer: "object" },
  trapdoor: { cat: "build", w: 1, h: 1, layer: "floor" },
  table: { cat: "furniture", w: 2, h: 1, layer: "object" },
  chair: { cat: "furniture", w: 1, h: 1, layer: "object" },
  bed: { cat: "furniture", w: 1, h: 2, layer: "object" },
  shelf: { cat: "furniture", w: 2, h: 1, layer: "object" },
  chest: { cat: "furniture", w: 1, h: 1, layer: "object" },
  barrel: { cat: "furniture", w: 1, h: 1, layer: "object" },
  crate: { cat: "furniture", w: 1, h: 1, layer: "object" },
  altar: { cat: "furniture", w: 2, h: 1, layer: "object" },
  tree: { cat: "nature", w: 2, h: 2, layer: "object" },
  bush: { cat: "nature", w: 1, h: 1, layer: "object" },
  rock: { cat: "nature", w: 1, h: 1, layer: "object" },
  pond: { cat: "nature", w: 2, h: 2, layer: "floor" },
  log: { cat: "nature", w: 2, h: 1, layer: "object" },
  campfire: { cat: "nature", w: 1, h: 1, layer: "object" },
  tent: { cat: "nature", w: 2, h: 2, layer: "object" },
});

/** Id's van de ingebouwde onderdelen (volgorde van het paneel) */
export const BUILTIN_IDS = Object.keys(BUILTIN);

/** Ingebouwd onderdeel of null (eigen eigenschap: geen "constructor" of "__proto__") */
export const builtin = (id) => (typeof id === "string" && Object.prototype.hasOwnProperty.call(BUILTIN, id) ? BUILTIN[id] : null);

/** Onderdelen van één categorie, in paneelvolgorde */
export const inCat = (cat) => BUILTIN_IDS.filter((id) => BUILTIN[id].cat === cat);

/** Adres van de tekening (absoluut pad, CLAUDE.md) */
export const assetUrl = (id) => `/data/maps-assets/${id}.svg`;

/** Geldige verwijzing in een object: een ingebouwde id (ook een onbekende uit een nieuwere versie of een later pakket
 *  "pakket/naam": die blijft bewaard en wordt als plaatshouder getekend, nooit stil weggegooid) of later een eigen asset
 *  (sha256, WP64). */
export const ASSET_RE = /^(?:[a-z][a-z0-9-]{0,31}(?:\/[a-z][a-z0-9-]{0,31})?|[0-9a-f]{64})$/;
export const cleanAssetRef = (v) => (typeof v === "string" && ASSET_RE.test(v) ? v : null);
