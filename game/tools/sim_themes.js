// Every duelist's deck, campaign and tournament, checked against their own theme: what types they lean on, what the
// upgrade swapped in, and any monster that does not belong to the character at all.
// usage: node tools/sim_themes.js [duelist key]
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const win = { addEventListener() {}, removeEventListener() {} };
win.window = win; win.document = { getElementById: () => null, createElement: () => ({ getContext: () => ({}) }) };
win.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }; win.console = console; win.Math = Math;
const ctx = vm.createContext(win);
for (const f of ["data/cards.js", "data/fusions.js", "data/decks.js", "js/data/cardsdb.js", "js/data/banlist.js", "js/data/effects.js", "js/data/shop.js", "js/data/duelists.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f });
}
const { CardDB, Duelists } = win;

// the theme the deck builder itself uses, so the audit and the game always agree
function theme(d) { const t = Duelists.themeOf(d); return { types: t.types, els: t.els || new Set(), ids: t.ids, gen: !!d.gen }; }
const shape = (deck) => {
  const ty = {};
  for (const id of deck) { const c = CardDB.get(id); if (c && c.kind === "M") ty[c.ty] = (ty[c.ty] || 0) + 1; }
  return Object.keys(ty).sort((a, b) => ty[b] - ty[a]).map((k) => k + " " + ty[k]).join(", ");
};
const topAtk = (deck) => { const a = deck.map((id) => CardDB.get(id)).filter((c) => c.kind === "M").map((c) => c.atk).sort((x, y) => y - x); return Math.round(a.slice(0, 10).reduce((x, y) => x + y, 0) / 10); };

const only = process.argv[2];
let strays = 0;
for (const d of Duelists.all) {
  if (only && d.key !== only) continue;
  const t = theme(d);
  const camp = Duelists.deck(d, 0), cup = Duelists.deck(d, 99, { skill: 4, max: true });
  const odd = (deck) => {
    const out = {};
    for (const id of deck) {
      const c = CardDB.get(id); if (!c || c.kind !== "M") continue;
      // a duelist's own calling card is in character by definition, whatever type it is - Rex's Red-eyes is a Dragon
      // in a Dinosaur deck because the user says it is his
      if (id === 420 || t.ids.has(id) || t.types.has(c.ty) || t.els.has(c.el)) continue;  // every ritual deck carries a Cyber-Stein
      if ((Duelists.SIGNATURE_OF[d.key] || []).includes(id)) continue;
      out[c.name + " [" + c.ty + "/" + c.el + " " + c.atk + "]"] = (out[c.name + " [" + c.ty + "/" + c.el + " " + c.atk + "]"] || 0) + 1;
    }
    return Object.keys(out);
  };
  const oc = odd(camp), ot = odd(cup);
  strays += oc.length + ot.length;
  console.log(d.name + "  (" + (t.gen ? "generated: " + [...t.types].join("/") : "types " + [...t.types].join("/") + (t.els.size ? ", element " + [...t.els].join("/") : "")) + ")");
  console.log("   campaign   ATK " + String(topAtk(camp)).padStart(4) + "  " + shape(camp));
  if (oc.length) console.log("     off theme: " + oc.join(", "));
  console.log("   tournament ATK " + String(topAtk(cup)).padStart(4) + "  " + shape(cup));
  if (ot.length) console.log("     off theme: " + ot.join(", "));
}
console.log("\noff-theme monsters across every deck: " + strays);
