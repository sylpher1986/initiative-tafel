// Inn Sight (G4, WP58): autosave met status, zonder DOM (timers in te spuiten, Node-testbaar). Elke wijziging roept
// touch() aan; na DELAY ms stilte schrijft hij één keer (write() leest dan de actuele kaart). Bij pagehide/verbergen:
// flush() schrijft meteen. Status: "saved" · "pending" (wijziging wacht) · "saving" · "error" · "off" (geen opslag hier).
// "error" blijft staan tot een volgende schrijfpoging echt lukt; een nieuwe wijziging maakt er geen "pending" van
// (de rode status mag niet wegflitsen terwijl er nog niets bewaard is). Na een fout blijft de wijziging "vuil", dus de
// volgende touch of flush probeert opnieuw.
export const DELAY = 500;

export function createSaver({ write, onStatus = () => {}, delay = DELAY, set = setTimeout, clear = clearTimeout } = {}) {
  let status = "saved", dirty = false, writing = null, again = false, timer = null;
  const to = (s) => { if (s !== status) { status = s; onStatus(s); } };
  const stop = () => { if (timer !== null) { clear(timer); timer = null; } };

  function run() {
    stop();
    if (status === "off") return Promise.resolve(false);
    if (writing) { again = true; return writing; }
    if (!dirty) return Promise.resolve(status !== "error");
    dirty = false;
    if (status !== "error") to("saving");
    // write() synchroon starten, niet in een microtask: bij pagehide moet de transactie nu beginnen
    writing = new Promise((r) => r(write())).then((ok) => ok === true, () => false).then((ok) => {
      writing = null;
      if (!ok) { dirty = true; to("error"); }
      else to(dirty ? "pending" : "saved");
      if (again) { again = false; if (ok && dirty) return run(); }
      return ok;
    });
    return writing;
  }

  return {
    /** Er is iets gewijzigd: over `delay` ms opslaan */
    touch() {
      if (status === "off") return;
      dirty = true;
      if (status !== "error" && !writing) to("pending");
      stop();
      timer = set(run, delay);
    },
    /** Nu opslaan wat er nog wacht (pagehide, kaart wisselen, Opnieuw). Belofte: true = alles bewaard. */
    flush: run,
    /** Opslag werkt hier niet (privémodus): vast "off", touch doet niets */
    off() { stop(); dirty = false; to("off"); },
    /** Begin van een andere kaart die net bewaard is: schone lei */
    reset() { stop(); dirty = false; again = false; if (status !== "off") to("saved"); },
    get status() { return status; },
    get dirty() { return dirty || !!writing; },
  };
}
