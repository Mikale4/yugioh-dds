// Does the AI actually use every monster effect in a real duel? sim_specials.js proves each SPCL has a rule and fires
// on a board built for it; this one plays whole duels with the card in the deck and reports the effects that were on
// the field, usable, and never used. usage: node tools/sim_effect_use.js [duels per card]
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const win = { addEventListener() {}, removeEventListener() {} };
win.window = win; win.document = { getElementById: () => null, createElement: () => ({ getContext: () => ({}) }) };
win.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
win.console = console; win.Math = Math;
const ctx = vm.createContext(win);
for (const f of ["data/cards.js", "data/fusions.js", "data/decks.js", "js/data/cardsdb.js", "js/data/banlist.js", "js/data/effects.js", "js/data/shop.js", "js/data/duelists.js", "js/game/duel.js", "js/game/ai.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f });
}
const { CardDB, Duelists, Duel, DuelPlayer, AI, Effects } = win;

const used = {}, seen = {};                    // uses, and turns the effect sat there ready
const origSpecial = Duel.prototype.special;
Duel.prototype.special = function (pl, slot, alt) {
  const m = pl.mon[slot], id = m && m.id;
  const r = origSpecial.call(this, pl, slot, alt);
  if (r && r.ok && id) used[id] = (used[id] || 0) + 1;
  return r;
};

// a plain deck to put the card under test into: mid-range bodies and nothing that steals the spotlight
const filler = CardDB.all.filter((c) => c.kind === "M" && c.atk >= 1200 && c.atk <= 1800 && !Effects.special[c.id] && !Effects.passive[c.id] && CardDB.tributesFor(c) === 0).map((c) => c.id);
function deckWith(id, n) {
  const d = []; for (let i = 0; i < n; i++) d.push(id);
  while (d.length < 40) d.push(filler[Math.floor(Math.random() * filler.length)]);
  return d;
}
function play(deckA, deckB, skillA, skillB, watch) {
  const a = new DuelPlayer("A", deckA, true, null); a.skill = skillA;
  const b = new DuelPlayer("B", deckB, true, null); b.skill = skillB;
  const duel = new Duel(a, b, {});
  let guard = 0;
  while (duel.winner === null && guard++ < 4000) {
    const pl = duel.cur();
    if (!pl.ai) { // a fresh turn: note every effect this side could fire right now
      AI.beginTurn(pl);
      if (pl === a) for (const m of pl.monsters()) if (m.id === watch && Effects.special[m.id] && !m.usedSpecial && duel.live(m)) seen[m.id] = (seen[m.id] || 0) + 1;
    }
    const r = AI.step(duel, pl);
    duel.events.length = 0;
    if (r.type === "end") pl.ai = null;
  }
  return duel.winner;
}

const N = parseInt(process.argv[2] || "6");
const ids = Object.keys(Effects.special).map(Number).sort((x, y) => x - y);
const opponents = Duelists.all.filter((d) => (d.skill || d.stage) >= 2).map((d) => Duelists.deck(d));
let errors = 0;
for (const id of ids) {
  const deck = deckWith(id, 3);
  for (let i = 0; i < N; i++) {
    const opp = opponents[(id + i) % opponents.length];
    try { play(deck, opp.slice(), 3, 3, id); } catch (e) { errors++; console.log("ERROR " + CardDB.get(id).name + ": " + e.message); break; }
  }
}
const never = [], rare = [], all = [];
for (const id of ids) {
  const s = seen[id] || 0, u = used[id] || 0;
  const line = String(id).padStart(3) + " " + CardDB.get(id).name.padEnd(24) + " ready " + String(s).padStart(4) + " turns, used " + String(u).padStart(4) + (s ? "  (" + Math.round(100 * Math.min(1, u / s)) + "%)" : "");
  all.push(line);
  if (s >= 3 && u === 0) never.push(line); else if (s >= 10 && u / s < 0.1) rare.push(line);
}
if (process.argv[3] === "all") console.log(all.join("\n") + "\n");
console.log("== never used, though the AI had them ready ==");
console.log(never.length ? never.join("\n") : "  (none)");
console.log("\n== used on fewer than one ready turn in ten ==");
console.log(rare.length ? rare.join("\n") : "  (none)");
console.log("\nspecials " + ids.length + ", duels " + ids.length * N + ", errors " + errors);
