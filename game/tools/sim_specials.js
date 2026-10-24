// Every SPCL ability, each on the board it was made for: does the AI fire it?  node sim_specials.js
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const win = { addEventListener() {}, removeEventListener() {} };
win.window = win; win.document = { getElementById: () => null, createElement: () => ({ getContext: () => ({}) }) };
win.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }; win.console = console; win.Math = Math;
const ctx = vm.createContext(win);
for (const f of ["data/cards.js", "data/fusions.js", "data/decks.js", "js/data/cardsdb.js", "js/data/banlist.js", "js/data/effects.js", "js/data/shop.js", "js/data/duelists.js", "js/game/duel.js", "js/game/ai.js"]) vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f });
const { CardDB, Effects, Duel, DuelPlayer, DuelMonster, AI } = win;
const byName = (n) => { const c = CardDB.all.find((x) => x.name === n); if (!c) throw new Error("no card " + n); return c.id; };
const DINO = CardDB.all.find((c) => c.ty === "Dinosaur" && c.kind === "M").id;
const INSECT = CardDB.all.find((c) => c.ty === "Insect" && c.kind === "M" && c.atk >= 1000).id;
const DRAGON = byName("Koumori Dragon"), SMALL = byName("Petit Dragon"), BIG = byName("B.eyes White Dragon");
const WEAK = 8; // Mushroom Man

// per ability: the board that should make the AI use it
const CASE = {
  15: { enemy: [DINO] }, 84: { enemySet: [683] }, 224: { enemySet: [683] }, 744: { enemySet: [683] },
  469: { enemySet: [345] }, 266: { enemySet: [683, 684] }, 586: { enemySet: [683, 684] },
  89: { own: [BIG], enemyLp: 1500 }, 732: { own: [BIG], enemyLp: 1200 }, 512: { enemyLp: 400 },
  179: { enemy: [BIG] }, 36: { enemy: [BIG] }, 148: { enemy: [BIG] }, 263: { enemy: [BIG] }, 285: { enemy: [BIG] },
  460: { enemy: [BIG] }, 531: { enemy: [BIG] }, 610: { enemy: [BIG] }, 725: { enemy: [BIG] },
  262: { own: [SMALL] }, 417: { enemy: [BIG] }, 500: { enemy: [DRAGON] }, 40: { enemy: [DRAGON] },
  762: { enemy: [INSECT] }, 715: { enemy: [BIG] }, 525: { own: [DRAGON] }, 637: { own: [byName("Mushroom Man")], field: 331 },
  583: { swords: 2 }, 721: { grave: [337], hand: [WEAK] }, 723: { enemy: [byName("Judge Man")], own: [byName("Axe Raider")] },
  731: { enemy: [BIG] }, 734: { enemy: [BIG] }, 26: { enemy: [byName("Flame Swordsman")] },
  16: { own: [byName("Baby Dragon")] }, 39: { own: [byName("Skull Servant")] }, 74: { field: 334, own: [byName("Jinzo #7")] },
  42: { enemy: [BIG, WEAK] }, 506: { enemy: [byName("Black Luster Soldier")] }, 733: { enemy: [BIG, WEAK] },
  48: { hand: [] }, 540: { hand: [] }, 428: { hand: [] }, 35: { hand: [], deck: [337, 8, 8] }, 65: { deck: [337, 8, 8] },
  817: { hand: [], deck: [337, 8, 8] },                       // Dark Sage digs for a spell, like the Magician he was
  62: { deck: [byName("Harpie Lady Sister"), 8, 8], hand: [] }, 749: { deck: [byName("Gazelle the King of Dreams"), 8, 8], hand: [] },
  102: { grave: [683] }, 166: { enemy: [BIG] }, 376: { enemy: [BIG] }, 641: { enemy: [BIG] }, 720: { enemy: [BIG] },
  1: { enemy: [BIG] }, 364: { enemy: [BIG] }, 22: { enemy: [BIG] }, 217: { enemy: [BIG] }, 743: { enemy: [BIG] },
  185: { enemy: [BIG] },
  // these three put a monster on the board out of the hand, which is only worth doing once the normal summon is gone
  187: { hand: [BIG], summoned: true }, 739: { hand: [byName("D. Magician")], summoned: true }, 741: { hand: [BIG], summoned: true },
  229: { lp: 5000 }, 462: { lp: 4000 }, 363: { lp: 5000 }, 490: {}, 154: {}, 429: {}, 83: { own: [WEAK, WEAK], enemy: [BIG] },
  103: { enemy: [BIG, BIG] }, 260: { enemy: [BIG, BIG] }, 261: { enemy: [BIG, BIG] },
  117: {}, 140: {}, 186: {}, 249: {}, 387: {}, 420: { lp: 8000, deck: [675, 8, 8, 8] },
  733: { enemy: [BIG, WEAK] }, 740: { enemy: [BIG, WEAK] }, 754: { enemyEquip: true, enemy: [BIG] },
  402: { enemyHand: [1, 8] }, 790: { enemyHand: [1, 8] }, 84.1: null,
  73: { deck: [334, 8, 8], hand: [] },                   // Kairyu-shin fishes the Umi out of the deck
  806: { grave: [byName("Kuriboh")] },                   // Junk Synchron brings a monster back
};

function run(id, c) {
  c = c || {};
  const a = new DuelPlayer("A", (c.deck || new Array(40).fill(8)).concat(new Array(40).fill(8)), false, null);
  const b = new DuelPlayer("B", new Array(40).fill(8), true, null);
  const duel = new Duel(a, b, { first: 0 }); duel.endTurn(); duel.endTurn();
  a.skill = 4;
  a.hand = (c.hand || []).slice();   // an empty hand by default, so no fusion or summon eats the monster first
  a.grave = (c.grave || []).slice();
  if (c.deck) a.deck = c.deck.slice();
  if (c.lp) a.lp = c.lp;
  if (c.enemyLp) b.lp = c.enemyLp;
  if (c.swords) a.swords = c.swords;
  if (c.field) duel.field = c.field;
  if (c.summoned) a.summoned = true;
  b.hand = (c.enemyHand || [8, 8]).slice();
  const put = (p, mid, faceUp) => { const m = new DuelMonster(mid, p); m.faceUp = faceUp !== false; m.pos = "atk"; m.canAttack = true; const s = duel.p[p].freeMonSlot(); duel.p[p].mon[s] = m; return m; };
  const self = put(0, id);
  for (const o of c.own || []) put(0, o);
  for (const e of c.enemy || []) put(1, e);
  if (c.enemyEquip && duel.p[1].mon[0]) duel.p[1].mon[0].levels = 1;
  (c.enemySet || []).forEach((sid, i) => { b.spells[i] = { id: sid, faceUp: false }; });
  duel.events.length = 0;
  AI.beginTurn(a);
  for (let i = 0; i < 20; i++) { const r = AI.step(duel, a); if (r.type === "special" && r.id === id) return true; if (r.type === "end") break; }
  return false;
}
const ids = Object.keys(Effects.special).map(Number).sort((x, y) => x - y);
const fails = ids.filter((id) => !run(id, CASE[id]));
console.log(ids.length - fails.length + "/" + ids.length + " SPCL abilities fire on their own board");
if (fails.length) console.log("not fired: " + fails.map((id) => id + " " + CardDB.get(id).name + " [" + Effects.special[id].name + "]").join(" | "));
