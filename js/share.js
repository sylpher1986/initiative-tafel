// Verbinding DM-scherm → spelersscherm. Berichten:
//   { t: "dm" }               DM-scherm is (opnieuw) gestart: spelersschermen melden zich
//   { t: "hallo" }            spelersscherm meldt zich: DM stuurt de huidige stand
//   { t: "stand", d: view }   snapshot uit toPlayerView (js/playerview.js)
// Nu: BroadcastChannel, tussen vensters en tabbladen van dezelfde browser op dit apparaat.
// Later: een WebSocket-kamer (bijv. Durable Object op de Worker) met dezelfde send/on-interface.
const NAME = "initiative-tafel-spelers";

/** Kanaal op dit apparaat, of null als de browser het niet kan */
export function localChannel() {
  if (typeof BroadcastChannel === "undefined") return null;
  const ch = new BroadcastChannel(NAME);
  const subs = new Set();
  ch.onmessage = (e) => { const m = e.data; if (m && typeof m.t === "string") subs.forEach((f) => f(m)); };
  return {
    send: (m) => { try { ch.postMessage(m); } catch { /* gesloten of niet te kopiëren: negeren */ } },
    on: (f) => { subs.add(f); return () => subs.delete(f); },
    close: () => ch.close(),
  };
}

/**
 * DM-kant. getView() maakt de snapshot. Rekent pas als er een spelersscherm is gezien,
 * en verstuurt alleen als er iets veranderde.
 */
export function dmLink(ch, getView) {
  let live = false, last = "";
  const push = (force) => {
    if (!live) return;
    const v = getView(), j = JSON.stringify(v);
    if (!force && j === last) return;
    last = j;
    ch.send({ t: "stand", d: v });
  };
  ch.on((m) => { if (m.t === "hallo") { live = true; push(true); } });
  ch.send({ t: "dm" });
  return { update: () => push(false) };
}
