// Zoekwoorden per taal voor monsters (VB4, WP29; docs/i18n.md §4.2): woord in de taal → Engelse naamdelen of types (SRD).
// Sleutels en doelen met | gescheiden; meervouden staan erbij waar ze onregelmatig zijn. Engelse namen werken altijd.
// De synoniemen van alle talen staan samen in js/data/syn.js en gelden in elke UI-taal (helpt een NL-DM op Engels).
// Geen catalogus (geen t-sleutels): gewone data, door de browser direct geladen en in sw.js gecachet.
export default {
  "bandiet|bandieten|rover|rovers": "bandit", "skelet|skeletten|geraamte": "skeleton", "draak|draken": "dragon", "draakje": "wyrmling|pseudodragon",
  "reus|reuzen": "giant", "spin|spinnen": "spider", "rat|ratten": "rat", "wolf|wolven": "wolf", "beer|beren": "bear", "slang|slangen": "snake",
  "geest|geesten|spook|spoken": "ghost|specter|wraith", "schim": "shadow|specter", "vampier|vampiers": "vampire", "weerwolf|weerwolven": "werewolf", "weerdier": "were",
  "duivel|duivels": "devil", "demoon|demonen": "demon", "ridder|ridders": "knight", "wacht|wachter|wachters|bewaker|bewakers": "guard",
  "soldaat|soldaten": "guard|veteran|warrior", "priester|priesters": "priest|acolyte", "tovenaar|tovenaars|magiër": "mage", "heks|heksen": "hag",
  "dwerg|dwergen": "duergar", "kabouter|kabouters|gnoom": "gnome", "ork|orks": "orc", "trol|trollen": "troll", "aap|apen": "ape|baboon",
  "paard|paarden": "horse|pony|warhorse|pegasus", "krokodil|krokodillen": "crocodile", "nijlpaard|nijlpaarden": "hippopotamus", "zeepaardje|zeepaardjes": "seahorse", "piraat|piraten": "pirate", // WP49: SRD 5.2-namen
  "haai|haaien": "shark", "adelaar|arend": "eagle",
  "uil|uilen": "owl", "vleermuis|vleermuizen": "bat", "kat|katten": "cat", "hond|honden": "dog|mastiff|jackal|hound", "everzwijn|zwijn": "boar",
  "kever|kevers": "beetle", "zwerm": "swarm", "slijm": "ooze|pudding|jelly|cube", "raaf|raven|kraai": "raven", "kikker|kikkers": "frog",
  "pad|padden": "toad", "schorpioen|schorpioenen": "scorpion", "sekte|sektelid|sekteleden": "cult", "schurk|schurken|boef|boeven": "thug|tough",
  "boer|boeren|burger|burgers": "commoner", "edelman|edele": "noble", "tijger|tijgers": "tiger", "leeuw|leeuwen": "lion", "olifant": "elephant",
  "mummie|mummies": "mummy", "gargouille": "gargoyle", "eenhoorn": "unicorn", "griffioen": "griffon", "minotaurus": "minotaur", "harpij|harpijen": "harpy",
  "sater": "satyr", "nimf|boomnimf": "dryad", "meermin|zeemeermin|meermens": "merfolk", "inktvis": "octopus|kraken", "wesp|wespen": "wasp",
  "hagedis|hagedissen": "lizard", "gier|gieren": "vulture", "havik": "hawk", "geit|geiten": "goat", "hert|herten": "deer|elk", "kameel": "camel",
  "ezel|muilezel": "mule", "das|dassen": "badger", "wezel": "weasel", "neushoorn": "rhinoceros", "mammoet": "mammoth", "duizendpoot": "centipede",
  "insect|insecten": "insect", "boom|bomen": "tree|treant", "struik": "shrub", "zwaard": "sword", "harnas": "armor", "elementaal": "elemental",
  "vuur": "fire", "ijs": "ice", "aarde": "earth", "lucht": "air", "engel|engelen": "deva|planetar|solar", "ondode|ondoden": "undead",
  "beest|beesten|dier|dieren": "beast", "reuzenspin": "giant spider", "reuzenrat": "giant rat", "huurling|huurlingen": "veteran|thug|tough", "spion": "spy",
  "verkenner": "scout", "moordenaar|sluipmoordenaar": "assassin", "gladiator": "gladiator", "dinosaurus": "triceratops|tyrannosaurus|plesiosaurus",
};
