// What AUTO BUILD makes of a chest. Prints the deck it builds, how long it takes and the effect cards it kept, so a
// regression in the shared builder (js/data/deckbuild.js) shows up as a deck full of vanilla beaters.
// usage: node tools/sim_deckbuild.js [full|starter|insect|harpie]
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const ctx = vm.createContext({ console, Math, Date, JSON, Object, Array, Number, String, Set, Map, isNaN, parseInt, parseFloat });
ctx.window = ctx;
for (const f of ["data/cards.js", "data/fusions.js", "data/decks.js", "js/data/cardsdb.js", "js/data/banlist.js", "js/data/effects.js", "js/data/shop.js", "js/data/duelists.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f });
}
// a stand-in for the save file: the builder only asks it for the chest and how many copies we own
ctx.Save = { data: { chest: {} }, owned(id) { return ctx.Save.data.chest[id] || 0; } };
vm.runInContext(fs.readFileSync(path.join(root, "js/data/deckbuild.js"), "utf8"), ctx, { filename: "deckbuild.js" });
const { CardDB, Effects, Banlist, DeckBuild, Save } = ctx;

const name = (id) => CardDB.get(id).name;
function chestOf(ids, n) { const c = {}; for (const id of ids) c[id] = n; return c; }
const ALL = CardDB.all.map((c) => c.id);

const CHESTS = {
  full: () => chestOf(ALL, 3),                                                   // everything, three copies each
  starter: () => chestOf(ALL.filter((id) => CardDB.get(id).cost <= 30), 3),      // the cheap half of the card pool
  insect: () => Object.assign(chestOf(CardDB.all.filter((c) => c.ty === "Insect").map((c) => c.id), 3),
    chestOf(CardDB.all.filter((c) => c.kind === "M" && c.atk >= 1500 && c.atk <= 1900).map((c) => c.id), 3)), // bugs vs plain beaters
  harpie: () => Object.assign(chestOf([62, 63, 386, 316, 317, 318, 321], 3),
    chestOf(CardDB.all.filter((c) => c.kind === "M" && c.atk >= 1400 && c.atk <= 1800).map((c) => c.id), 3)),
};

const which = process.argv[2] || "full";
for (const key of which === "all" ? Object.keys(CHESTS) : [which]) {
  Save.data.chest = CHESTS[key]();
  const t0 = Date.now();
  const deck = DeckBuild.bestDeck();
  const ms = Date.now() - t0;
  const mons = deck.filter((id) => CardDB.get(id).kind === "M");
  const counts = {}; for (const id of deck) counts[id] = (counts[id] || 0) + 1;
  const eff = deck.filter((id) => CardDB.get(id).kind === "M" && Effects.isEffect(id)).length;
  const rows = Object.keys(counts).map(Number).sort((a, b) => DeckBuild.cardValue(b, mons) - DeckBuild.cardValue(a, mons))
    .map((id) => "  " + String(Math.round(DeckBuild.cardValue(id, mons))).padStart(5) + "  " + name(id) + (counts[id] > 1 ? " x" + counts[id] : "") + (Banlist.limit(id) < 3 ? "  [" + Banlist.limit(id) + "]" : ""));
  console.log("== " + key + ": " + deck.length + " cards, " + mons.length + " monsters (" + eff + " with effects), score " + Math.round(DeckBuild.deckScore(deck)) + ", built in " + ms + "ms");
  console.log(rows.join("\n"));
  const types = {}; for (const id of mons) { const c = CardDB.get(id); types[c.ty] = (types[c.ty] || 0) + 1; }
  console.log("  types: " + Object.keys(types).sort((a, b) => types[b] - types[a]).slice(0, 6).map((t) => t + " " + types[t]).join(", "));
  console.log("");
}
