// Inn Sight (G4, WP62): hit-test en geometrie van objecten, puur (geen DOM, Node-testbaar). Een object is een
// rechthoek van w × h kaarteenheden rond zijn middelpunt (x, y), gedraaid met rot graden met de klok mee (zoals de render:
// canvas rotate). De hit-test kiest het BOVENSTE object onder een punt: de tekenvolgorde (drawOrder) van achter naar voren
// doorlopen en de laatste treffer nemen, dus laag object boven laag floor en binnen een laag later = erboven.
import { drawOrder } from "./objects.js";
import { CELL, toScreen } from "./view.js";

const RAD = Math.PI / 180;

/** Kaartpunt (px, py) in het eigen assenstelsel van o (middelpunt = 0,0, niet gedraaid) */
export function toLocal(o, px, py) {
  const dx = px - o.x, dy = py - o.y;
  if (!o.rot) return { x: dx, y: dy };
  const a = -o.rot * RAD, c = Math.cos(a), s = Math.sin(a);
  return { x: dx * c - dy * s, y: dx * s + dy * c };
}

/** Eigen punt (lx, ly) van o → kaartpunt */
export function toWorld(o, lx, ly) {
  if (!o.rot) return { x: o.x + lx, y: o.y + ly };
  const a = o.rot * RAD, c = Math.cos(a), s = Math.sin(a);
  return { x: o.x + lx * c - ly * s, y: o.y + lx * s + ly * c };
}

/** Ligt kaartpunt (px, py) op o? pad = extra marge in kaarteenheden (kleine objecten op een telefoon: tikdoel) */
export function onObj(o, px, py, pad = 0) {
  const p = toLocal(o, px, py);
  return Math.abs(p.x) <= o.w / 2 + pad && Math.abs(p.y) <= o.h / 2 + pad;
}

/** Alle objecten precies onder kaartpunt (px, py), bovenste eerst (nog eens tikken op het geselecteerde object kiest het
 *  volgende eronder: zo is een vloer onder een tafel bereikbaar) */
export function hitAll(objs, px, py) {
  if (!objs || !objs.length) return [];
  const { list } = drawOrder(objs), out = [];
  for (let i = list.length - 1; i >= 0; i--) if (onObj(list[i], px, py)) out.push(list[i]);
  return out;
}

/** Bovenste object onder kaartpunt (px, py), of null. pad (kaarteenheden) vergroot het tikvlak rondom: een exacte
 *  treffer wint altijd van een treffer alleen binnen de marge (anders pakt een rand van de tafel de stoel ernaast). */
export function hitObj(objs, px, py, pad = 0) {
  if (!objs || !objs.length) return null;
  const { list } = drawOrder(objs);
  for (let i = list.length - 1; i >= 0; i--) if (onObj(list[i], px, py)) return list[i];
  if (pad > 0) for (let i = list.length - 1; i >= 0; i--) if (onObj(list[i], px, py, pad)) return list[i];
  return null;
}

/** Hoekpunten van o in kaarteenheden, met de klok mee vanaf linksboven (eigen assen) */
export function corners(o) {
  const hw = o.w / 2, hh = o.h / 2;
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => toWorld(o, x, y));
}

/** Omsluitende rechthoek (as-evenwijdig) van o */
export function objBox(o) {
  const c = corners(o), xs = c.map((p) => p.x), ys = c.map((p) => p.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Hoek (graden 0…360, met de klok mee, 0 = recht omhoog) van het middelpunt van o naar kaartpunt (px, py): voor de
 *  draaigreep, die boven het object staat */
export function angleTo(o, px, py) {
  const a = Math.atan2(px - o.x, -(py - o.y)) / RAD;
  return ((a % 360) + 360) % 360;
}

/** Handgrepen op het scherm (WP62): vaste schermmaat, buiten het kader, zodat ze op elk zoomniveau en bij kleine objecten
 *  tikbaar blijven. HANDLE = tikdoel (middellijn, CSS-px), HANDLE_OFF = afstand van de rand tot het midden van een greep. */
export const HANDLE = 44, HANDLE_OFF = 30;

/** Schermpunten (CSS-px) van de handgrepen van o bij view v: rot = draaigreep boven het object (eigen assen), size =
 *  schaalgreep rechtsonder, schuin buiten de hoek. Draaien gaat mee met het object. */
export function handles(o, v) {
  const s = CELL * v.z, c = toScreen(v, o.x, o.y), a = (o.rot || 0) * RAD, cs = Math.cos(a), sn = Math.sin(a), d = HANDLE_OFF / Math.SQRT2;
  const at = (lx, ly) => ({ x: c.x + lx * cs - ly * sn, y: c.y + lx * sn + ly * cs });
  return { rot: at(0, -(o.h / 2) * s - HANDLE_OFF), size: at((o.w / 2) * s + d, (o.h / 2) * s + d) };
}

/** Welke handgreep ligt onder schermpunt (sx, sy)? "rot" | "size" | null (binnen HANDLE / 2) */
export function handleAt(o, v, sx, sy) {
  const h = handles(o, v), r = HANDLE / 2, near = (p) => Math.hypot(p.x - sx, p.y - sy) <= r;
  return near(h.rot) ? "rot" : near(h.size) ? "size" : null;
}
