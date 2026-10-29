// Inn the Grid (G4, WP61): tekeningen van de ingebouwde onderdelen laden en tekenklaar houden. Een SVG wordt één keer als
// <img> geladen (data/maps-assets/<id>.svg, in de Maps-cache van de service worker: werkt offline) en per onderdeel op
// één rastergrootte in een eigen canvas gezet (macht van 2 pixels per cel, 32–256; WP66: kleine onderdelen tot 512), zodat 2000 objecten per frame een
// snelle drawImage van een bitmap zijn en geen SVG die steeds opnieuw rasterd wordt. Zoomt de kaart zo ver dat een
// grotere stap nodig is, dan vervangt die de vorige (één bitmap per onderdeel: weinig geheugen, ook op een oude iPad).
// WP64: een eigen asset (sha256) komt uit de opslag (custom(sha) → tekenbare afbeelding of null) en wordt direct getekend
// (opgeslagen ≤ 1024 px, geen bitmap per zoomstap); trim(keep) laat alleen de eigen afbeeldingen van de open kaart staan.
import { builtin, assetUrl } from "../model/assets.js";
import { isCustom } from "../model/mine.js";

// WP66: kleine onderdelen (≤ 2 cellen) tot 512 px per cel, zodat ze bij dpr 3 en 400 % (576 px per cel) scherp blijven;
// grotere blijven op 256 (een boom van 2 × 2 cellen op 512 = 4 MB). Meest 1 MB per bitmap van 1 cel.
const MIN = 32, MAX = 256, MAX_SMALL = 512, SMALL = 2;
/** Pixels per cel voor de bitmap bij een gewenste schermgrootte per cel (apparaatpixels); cells = oppervlak in cellen */
export const bucket = (px, cells = 1) => Math.min(cells <= SMALL ? MAX_SMALL : MAX, Math.max(MIN, 2 ** Math.ceil(Math.log2(Math.max(1, px)))));

/** onReady() wordt aangeroepen zodra een tekening geladen is (dan opnieuw tekenen) */
export function createArt(onReady0, { custom = null } = {}) {
  let ver = 0; // WP66: telt elke wijziging aan wat get() teruggeeft (laden, mislukken, vrijgeven): sleutel van de kaartbuffer
  const onReady = () => { ver++; onReady0(); };
  const imgs = new Map(); // id → { img, ok: true | false | null (laadt) }
  const own = new Map(); // WP64: sha → { img, ok } (eigen assets)
  const loadOwn = (sha) => {
    let e = own.get(sha);
    if (!e) {
      e = { img: null, ok: null };
      own.set(sha, e);
      Promise.resolve(custom ? custom(sha) : null).then((img) => {
        if (own.get(sha) !== e) { if (img && img.close) img.close(); return; } // intussen weggegooid (trim)
        e.img = img; e.ok = !!img; onReady();
      }, () => { e.ok = false; onReady(); });
    }
    return e.ok ? e.img : null;
  };
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
      if (isCustom(id)) return loadOwn(id);
      const e = load(id);
      if (!e) return null;
      const d = builtin(id), s = bucket(px, d.w * d.h), have = bmps.get(id);
      if (have && have.s === s) return have.c;
      const c = document.createElement("canvas");
      c.width = Math.round(d.w * s); c.height = Math.round(d.h * s);
      try { c.getContext("2d").drawImage(e.img, 0, 0, c.width, c.height); } catch { return null; }
      bmps.set(id, { s, c });
      return c;
    },
    /** Alvast laden (bibliotheek geopend), zodat het eerste object niet als plaatshouder verschijnt */
    preload(ids) { for (const id of ids) load(id); },
    /** WP66: zijn alle onderdelen in ids geladen (of mislukt)? (meetstand: openen is klaar als alles getekend kan worden) */
    done(ids) { return ids.every((id) => { const e = imgs.get(id); return !!e && e.ok !== null; }); },
    /** WP66: geschat geheugen van de bitmaps en eigen afbeeldingen (bytes, 4 per pixel) */
    bytes() {
      let n = 0;
      for (const { c } of bmps.values()) n += c.width * c.height * 4;
      for (const e of own.values()) if (e.img) n += (e.img.width || 0) * (e.img.height || 0) * 4;
      return n;
    },
    /** WP64: eigen afbeeldingen vrijgeven behalve die in keep (Set van sha's); een mislukte mag opnieuw proberen */
    trim(keep) { for (const [sha, e] of own) if (!keep.has(sha) || e.ok === false) { if (e.img && e.img.close) e.img.close(); own.delete(sha); ver++; } },
    /** WP66: versie (zie ver) */
    ver: () => ver,
  };
}
