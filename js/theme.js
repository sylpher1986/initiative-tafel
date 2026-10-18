// Weergave: Systeem / Licht / Donker. Gewoon script (geen module) in <head>, zodat het thema
// vóór de eerste paint staat en er geen witte flits is. De CSS luistert naar data-theme op <html>.
(() => {
  const KEY = "it-theme";
  const MODES = ["system", "light", "dark"];
  const BAR = { light: "#8a1f14", dark: "#13161d" }; // statusbalk, gelijk aan de theme-color-metatags
  const root = document.documentElement;

  const get = () => {
    try { const v = localStorage.getItem(KEY); return MODES.includes(v) ? v : "system"; } catch { return "system"; }
  };

  const apply = (mode) => {
    if (mode === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", mode);
    // Bij een vaste keuze moet de statusbalk meekleuren, ook als het systeem iets anders zegt.
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
      const own = (m.getAttribute("media") || "").includes("dark") ? "dark" : "light";
      m.setAttribute("content", BAR[mode === "system" ? own : mode]);
    });
  };

  const set = (mode) => {
    if (!MODES.includes(mode)) mode = "system";
    try { mode === "system" ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, mode); } catch { /* privémodus: alleen deze sessie */ }
    apply(mode);
    return mode;
  };

  window.itTheme = { get, set };
  apply(get());
})();
