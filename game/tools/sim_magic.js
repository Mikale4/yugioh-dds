// Does the AI actually play every spell, trap and ritual card?  node tools/sim_magic.js [all]
// For each card it builds a board where playing the card is clearly the right move, hands the AI one copy, and runs
// a turn. A spell must be activated; a trap must at least be set (traps fire by themselves afterwards). Cards that
// never fire are listed - that is the report worth reading. `all` prints every card, fired or not.
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const win = { addEventListener() {}, removeEventListener() {} };
win.window = win; win.document = { getElementById: () => null, createElement: () => ({ getContext: () => ({}) }) };
win.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }; win.console = console; win.Math = Math;
const ctx = vm.createContext(win);
for (const f of ["data/cards.js", "data/fusions.js", "data/decks.js", "js/data/cardsdb.js", "js/data/banlist.js", "js/data/effects.js", "js/data/shop.js", "js/data/duelists.js", "js/game/duel.js", "js/game/ai.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f });
}
const { CardDB, Effects, Banlist, Duel, DuelPlayer, DuelMonster, AI } = win;
const byName = (n) => CardDB.all.find((c) => c.name.toLowerCase().includes(n.toLowerCase())).id;
const BIG = byName("Judge Man"), WEAK = byName("Mushroom Man"), MID = byName("Axe Raider");

// a board that suits the card: own monsters, enemy monsters, our LP, their LP, cards in our deck
const CASE = {
  // field spells want their own types out; the equips want something they fit
  342: { lp: 3000 }, 339: { lp: 3000 }, 338: { lp: 3000 }, 340: { lp: 3000 }, 341: { lp: 3000 },
  343: { enemyLp: 400 }, 344: { enemyLp: 400 }, 345: { enemyLp: 400 }, 346: { enemyLp: 400 }, 347: { enemyLp: 400 }, 350: { enemy: [WEAK] },
  336: { own: [], enemy: [BIG, BIG] }, 337: { enemy: [BIG, BIG] }, 661: { enemy: [BIG, BIG] },
  781: { enemy: [BIG] }, 784: { enemy: [BIG] }, 785: { own: [MID] }, 790: { enemyHand: [1, 1] },
  348: { enemy: [BIG] }, 349: { enemy: [BIG, BIG] }, 669: { enemy: [BIG, BIG] }, 320: { own: [MID], enemyDef: [WEAK] },
  652: { enemy: [BIG] }, 655: { enemy: [MID], enemyEquip: true }, 657: { own: [MID] }, 672: { enemySet: [683] }, 789: {},
  350: { enemyFaceDown: [WEAK] },
  // a field card is only worth playing with something of its own types on the board
  330: { own: [byName("Silver Fang")] },              // Beast
  331: { own: [byName("Dragon Zombie")] },            // Zombie
  332: { own: [byName("Koumori Dragon")] },           // Dragon
  334: { own: [byName("7 Colored Fish")] },           // Fish
  335: { own: [byName("Dark Elf")] },                 // Magician
  333: { own: [byName("Axe Raider")] },               // Meadow: Warrior
  813: { grave: [BIG] }, 783: { enemy: [BIG] },
  652: { deck: new Array(6).fill(366).concat(new Array(34).fill(WEAK)), enemy: [BIG] },   // the Labyrinth needs a wall left in the deck: with one copy the opening draw takes it and the AI summons it instead
  // the second batch of added cards: each wants something in a grave, a deck or a hand before it is worth anything
  818: { grave: [BIG] },
  820: { deck: new Array(6).fill(byName("Celtic Guardian")).concat(new Array(34).fill(WEAK)) },   // several, or the opening draw can empty the deck of them
  822: { deck: new Array(6).fill(767).concat(new Array(34).fill(WEAK)) },
  823: { own: [728] },
  819: { own: [], deck: [BIG].concat(new Array(39).fill(WEAK)) },
  329: { enemy: [byName("Koumori Dragon")] }, 653: { enemy: [byName("Axe Raider")] }, 656: { enemy: [byName("Dragon Zombie")] },
  660: { enemy: [byName("Machine King")] }, 662: { enemy: [byName("Kuwagata")] }, 663: { enemy: [byName("Stone D.")] },
  664: { enemy: [byName("7 Colored Fish")] }, 786: { enemy: [byName("Summoned Skull")] }, 787: { enemy: [byName("Dark Elf")] },
};
const EQUIP_HOST = {};   // an equip needs a monster it fits
for (const c of CardDB.all) if (CardDB.isEquip(c.id)) {
  const host = CardDB.all.find((m) => m.kind === "M" && Banlist.limit(m.id) > 0 && CardDB.equipFits(c.id, m) && m.atk >= 1000 && m.atk <= 1800);
  if (host) EQUIP_HOST[c.id] = host.id;
}

function run(id) {
  const c = CardDB.get(id), fx = Effects.magic[id] || Effects.trap[id] || Effects.ritual[id];
  const cfg = CASE[id] || {};
  const a = new DuelPlayer("A", (cfg.deck || new Array(40).fill(WEAK)).slice(), false, null);
  const b = new DuelPlayer("B", new Array(40).fill(WEAK), true, null);
  const duel = new Duel(a, b, { first: 0 }); duel.endTurn(); duel.endTurn();
  a.skill = 4;
  a.hand = [id];
  a.grave = (cfg.grave || []).slice();
  if (cfg.lp) a.lp = cfg.lp;
  if (cfg.enemyLp) b.lp = cfg.enemyLp;
  b.hand = (cfg.enemyHand || [WEAK, WEAK]).slice();
  const put = (p, mid, pos) => { const m = new DuelMonster(mid, p); m.faceUp = true; m.pos = pos || "atk"; m.canAttack = true; duel.p[p].mon[duel.p[p].freeMonSlot()] = m; return m; };
  // a ritual needs what it names, in the hand: the named cards, one of its `oneOf` list, and any extra offerings
  if (c.kind === "R" && Effects.ritual[id]) {
    const r = Effects.ritual[id];
    for (const n of r.need) a.hand.push(n);
    if (r.oneOf) a.hand.push(r.oneOf[0]);
    const filler = r.anyType ? (CardDB.all.find((m) => m.kind === "M" && m.ty === r.anyType && Banlist.limit(m.id) > 0 && m.atk < 1500) || { id: WEAK }).id : WEAK;
    for (let i = 0; i < (r.any || 0); i++) a.hand.push(filler);
  }
  const own = cfg.own || (EQUIP_HOST[id] ? [EQUIP_HOST[id]] : c.kind === "T" ? [MID] : [MID]);
  for (const o of own) put(0, o);
  for (const e of (cfg.enemy || (c.kind === "T" ? [BIG] : []))) put(1, e);
  for (const e of (cfg.enemyDef || [])) put(1, e, "def");
  for (const e of (cfg.enemyFaceDown || [])) { const m = put(1, e, "def"); m.faceUp = false; m.summonTurn = 0; }
  if (cfg.enemyEquip && duel.p[1].mon[0]) duel.p[1].mon[0].levels = 1;
  (cfg.enemySet || []).forEach((sid, i) => { b.spells[i] = { id: sid, faceUp: false }; });
  if (fx && fx.kind === "field" && cfg.field !== undefined) duel.field = cfg.field;
  duel.events.length = 0;
  const real = Math.random; Math.random = () => 0;          // the AI sits on spells at random; force the decision
  AI.beginTurn(a);
  let played = false;
  for (let i = 0; i < 20; i++) {
    const r = AI.step(duel, a);
    for (const e of duel.events) {
      if ((e.type === "magic" || e.type === "ritual") && e.player === 0 && e.id === id && !e.fail) played = true;
      if (e.type === "set" && e.player === 0 && e.id === id) played = true;
    }
    duel.events.length = 0;
    if (r.type === "end") break;
  }
  Math.random = real;
  return played;
}

const cards = CardDB.all.filter((c) => (c.kind === "S" || c.kind === "T" || c.kind === "R") && Banlist.limit(c.id) > 0);
const fails = [];
for (const c of cards) { let ok = false; try { ok = run(c.id); } catch (e) { fails.push([c, "ERROR " + e.message]); continue; } if (!ok) fails.push([c, "never played"]); }
console.log((cards.length - fails.length) + "/" + cards.length + " spells, traps and ritual cards are played on a board that suits them");
if (process.argv[2] === "all") for (const c of cards) console.log("  " + String(c.id).padStart(3) + " " + c.name.padEnd(28) + (fails.some((f) => f[0].id === c.id) ? "NOT PLAYED" : "ok"));
if (fails.length) {
  console.log("\nnot played:");
  for (const [c, why] of fails) console.log("  " + String(c.id).padStart(3) + " " + c.name.padEnd(28) + c.kind + "  " + why + "   " + ((Effects.magic[c.id] || Effects.trap[c.id] || {}).text || "").slice(0, 50));
}
