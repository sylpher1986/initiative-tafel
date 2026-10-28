// Inn the Grid (G4, WP61): tekeningen van de ingebouwde onderdelen laden en tekenklaar houden. Een SVG wordt één keer als
// <img> geladen (data/maps-assets/<id>.svg, in de Maps-cache van de service worker: werkt offline) en per onderdeel op
// één rastergrootte in een eigen canvas gezet (macht van 2 pixels per cel, 32–256), zodat 2000 objecten per frame een
// snelle drawImage van een bitmap zijn en geen SVG die steeds opnieuw rasterd wordt. Zoomt de kaart zo ver dat een
// grotere stap nodig is, dan vervangt die de vorige (één bitmap per onderdeel: weinig geheugen, ook op een oude iPad).
import { builtin, assetUrl } from "../model/assets.js";

const MIN = 32, MAX = 256;
/** Pixels per cel voor de bitmap bij een gewenste schermgrootte per cel (apparaatpixels) */
export const bucket = (px) => Math.min(MAX, Math.max(MIN, 2 ** Math.ceil(Math.log2(Math.max(1, px)))));

/** onReady() wordt aangeroepen zodra een tekening geladen is (dan opnieuw tekenen) */
export function createArt(onReady) {
  const imgs = new Map(); // id → { img, ok: true | false | null (laadt) }
  const bmps = new Map(); // id → { s, c } (bitmap op s px per cel)
  const load = (id) => {
    const d = builtin(id);
    if (!d) return null;
    let e = imgs.get(id);
    if (!e) {
      const img = new Image();
      e = { img, ok: null };
      imgs.set(id, e);
      img.onload = () => { e.ok = true; onReady(); };
      img.onerror = () => { e.ok = false; onReady(); };
      img.src = assetUrl(id);
    }
    return e.ok ? e : null;
  };
  return {
    /** Tekenbare bitmap voor onderdeel id bij px apparaatpixels per cel, of null (onbekend, laadt nog of mislukt: de
     *  render tekent dan een plaatshouder) */
    get(id, px) {
      const e = load(id);
      if (!e) return null;
      const s = bucket(px), have = bmps.get(id);
      if (have && have.s === s) return have.c;
      const d = builtin(id), c = document.createElement("canvas");
      c.width = Math.round(d.w * s); c.height = Math.round(d.h * s);
      try { c.getContext("2d").drawImage(e.img, 0, 0, c.width, c.height); } catch { return null; }
      bmps.set(id, { s, c });
      return c;
    },
    /** Alvast laden (bibliotheek geopend), zodat het eerste object niet als plaatshouder verschijnt */
    preload(ids) { for (const id of ids) load(id); },
  };
}
