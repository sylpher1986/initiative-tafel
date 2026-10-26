// Zoekwoorden voor monsters in alle talen samen (WP29, docs/i18n.md §4.2): gelden in elke UI-taal, Engelse namen altijd.
// filterMonsters (js/data/monsters.js) blijft puur en krijgt deze Map als parameter. Een nieuwe taal: locales/<taal>/search.js
// toevoegen en hieronder in synMap opnemen (en in ASSETS van sw.js).
import { synMap } from "./monsters.js";
import nl from "../../locales/nl/search.js";

export const SYN = synMap(nl);
