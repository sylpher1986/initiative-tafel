// Catalogus en: alle namespaces samen (js/i18n/boot.js laadt alleen dit bestand). Nieuwe namespace = hier importeren.
import common from "./common.js";
import initiative from "./initiative.js";
import rules from "./rules.js";
import log from "./log.js";
import player from "./player.js";
import dnd from "./dnd.js";
import pages from "./pages.js";

export default { ...common, ...initiative, ...rules, ...log, ...player, ...dnd, ...pages };
