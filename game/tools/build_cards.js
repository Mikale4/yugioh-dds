// Dumps every card in the game as JSON, with the text its card page shows. Feeds tools/build_cards.py, which adds
// the pictures and writes CARDS.html.   usage: node tools/build_cards.js > cards.json
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const win = { addEventListener() {}, removeEventListener() {} };
win.window = win; win.document = { getElementById: () => null, createElement: () => ({ getContext: () => ({}) }) };
win.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }; win.console = { log() {}, warn() {}, error() {} }; win.Math = Math;
const ctx = vm.createContext(win);
for (const f of ["data/cards.js", "data/fusions.js", "data/decks.js", "js/data/cardsdb.js", "js/data/banlist.js", "js/data/effects.js", "js/data/shop.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f });
}
const { CardDB, Effects, Banlist, Shop } = win;
const name = (id) => { const c = CardDB.get(id); return c ? c.name : "?" + id; };

const out = [];
for (const c of CardDB.all) {
  const card = {
    id: c.id, name: c.name, kind: c.kind, desc: c.desc || "",
    deckable: Banlist.limit(c.id) > 0,
    copies: Banlist.limit(c.id),
    limit: Banlist.label(c.id),
    rarity: Shop.NAMES[Shop.rarity(c.id)],
    price: Shop.price(c.id),
  };
  if (c.kind === "M") {
    card.el = c.el; card.ty = c.ty; card.atk = c.atk; card.def = c.def;
    card.effect = Effects.passive[c.id] || null;
    card.spcl = Effects.special[c.id] ? { name: Effects.special[c.id].name, text: Effects.special[c.id].text } : null;
    card.spcl2 = Effects.special2[c.id] ? { name: Effects.special2[c.id].name, text: Effects.special2[c.id].text } : null;
    // the ritual cards that name this monster as an offering
    card.usedIn = [];
    for (const sid in Effects.ritual) {
      const r = Effects.ritual[sid];
      if (!r.need.includes(c.id) && !(r.oneOf || []).includes(c.id)) continue;
      card.usedIn.push({ spell: name(Number(sid)), text: Effects.ritualText(Number(sid)) });
    }
    card.summonHow = Banlist.ritualOnly(c.id) ? (Effects.summonHow(c.id) || "").replace(/^Summon: /, "") : null;
    card.recipes = CardDB.recipesFor(c.id).map((p) => name(p[0]) + " + " + name(p[1]));
    if (c.id === 807) card.recipes.push("Junk Synchron + any monster");
  } else if (c.kind === "R") {
    const r = Effects.ritual[c.id];
    card.effect = r ? Effects.ritualText(c.id) : null;
    card.summons = r ? name(r.result) : null;
  } else {
    const fx = Effects.magic[c.id] || Effects.trap[c.id];
    card.effect = (fx && fx.text) || null;
    card.equip = CardDB.isEquip(c.id);
    card.field = CardDB.isField(c.id);
    if (card.equip) {
      // which monsters it fits, said in terms of what a player would look for
      const fits = CardDB.all.filter((m) => m.kind === "M" && CardDB.equipFits(c.id, m));
      const types = [...new Set(fits.map((m) => m.ty))];
      card.fits = fits.length + " monsters" + (types.length <= 4 ? " (" + types.join(", ") + ")" : "");
    }
  }
  out.push(card);
}
process.stdout.write(JSON.stringify(out));
