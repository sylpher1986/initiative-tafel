// Inn Sight (G4, WP66): alle grenzen op één plek, puur. De modules die ze handhaven (grid.js, objects.js, image.js,
// mine.js, file.js, history.js, terrain.js) lezen hun waarden hier; hun eigen exports (LIMITS in grid.js, OBJ, IMG, MINE,
// FILE_MAX, HIST_MAX, TERR) blijven bestaan, zodat aanroepers niet veranderen. Bijstellen = alleen hier; tests in
// tests/maps-limits.test.js bewaken dat elke module dezelfde waarde gebruikt en dat de meetkaart (model/bench.js) precies
// op de grenzen zit. Gemeten in WP66 (CLAUDE.md, "Gemaakte keuzes → Inn Sight").
const MB = 1024 * 1024;
export const LIMITS = Object.freeze({
  // kaart (D10, WP57): kolommen en rijen
  minCells: 1, maxCells: 100,
  // objecten (D10, WP61): aantal per kaart, grootte in cellen, positie in kaarteenheden
  objs: 2000, objMinSize: 0.25, objMaxSize: 20, objMaxPos: 1000,
  // terrein (WP63): soorten per kaart (één teken per cel)
  terrIds: 35,
  // uploads (D12, WP59): invoer, opgeslagen achtergrond, decompressiebom
  inBytes: 25 * MB, bgSide: 4096, inSide: 16384, inPixels: 36e6,
  // Mijn assets (WP64): items per apparaat, opgeslagen zijde, miniatuur
  mine: 500, mineSide: 1024, thumb: 128, thumbBytes: 256 * 1024,
  // projectbestand (WP60): grootte bij import en export
  fileBytes: 35 * MB,
  // undo-stappen per open kaart (WP61), alleen in het geheugen
  hist: 100,
  // namen (WP58, WP64): codepunten
  mapName: 60, itemName: 40,
});
