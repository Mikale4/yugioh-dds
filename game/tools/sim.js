// Headless duel simulator: node sim.js [games per pairing]
// Loads the data + engine files into a fake window and plays AI vs AI duels to catch exceptions and check balance.
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
console.log("cards", CardDB.all.length, "fusions", CardDB.fusionCount);

function play(dA, dB, deckA, deckB, skillA, skillB) {
  const a = new DuelPlayer(dA, deckA, true, null); a.skill = skillA;
  const b = new DuelPlayer(dB, deckB, true, null); b.skill = skillB;
  const duel = new Duel(a, b, {});
  let guard = 0;
  while (duel.winner === null && guard++ < 4000) {
    const pl = duel.cur();
    if (!pl.ai) AI.beginTurn(pl);
    const r = AI.step(duel, pl);
    duel.events.length = 0;
    if (r.type === "end") pl.ai = null;
  }
  if (duel.winner === null) return { winner: -1, turns: duel.turnNo, events: duel.log.length };
  return { winner: duel.winner, turns: duel.turnNo, reason: duel.reason, fus: a.stats.fusions + b.stats.fusions };
}

const N = parseInt(process.argv[2] || "4");
const names = Duelists.all.map((d) => d.key);
const starter = Duelists.starterDeck();
let errors = 0;
// 1) starter deck vs every duelist
console.log("\n== starter deck (skill 1) vs each duelist ==");
for (const d of Duelists.all) {
  let w = 0, t = 0, dead = 0, reasons = {};
  for (let i = 0; i < N; i++) {
    try {
      const r = play("starter", d.name, starter, Duelists.deck(d), 1, d.skill || d.stage);
      if (r.winner === 0) w++; if (r.winner === -1) dead++; t += r.turns; reasons[r.reason] = (reasons[r.reason] || 0) + 1;
    } catch (e) { errors++; console.log("ERROR vs", d.name, e.stack.split("\n").slice(0, 3).join(" | ")); }
  }
  console.log(d.name.padEnd(12), "starter wins", w + "/" + N, "avg turns", (t / N).toFixed(1), dead ? "STALLED " + dead : "", JSON.stringify(reasons));
}
// 2) mirror / cross matches between duelists (catches rare effect paths)
console.log("\n== cross matches ==");
let games = 0;
for (let i = 0; i < Duelists.all.length; i++) for (let j = i + 1; j < Duelists.all.length; j += 3) {
  const A = Duelists.all[i], B = Duelists.all[j];
  try { const r = play(A.name, B.name, Duelists.deck(A), Duelists.deck(B), A.skill || A.stage, B.skill || B.stage); games++; if (r.winner === -1) console.log("STALL", A.name, B.name, r); }
  catch (e) { errors++; console.log("ERROR", A.name, "vs", B.name, e.stack.split("\n").slice(0, 3).join(" | ")); }
}
console.log("cross games", games, "errors", errors);
// 3) random decks from the whole pool to exercise every card
console.log("\n== random-pool decks ==");
const all = CardDB.all.filter((c) => c.cost < 255 || c.kind !== "M").map((c) => c.id);
function randDeck() { const d = []; while (d.length < 40) d.push(all[Math.floor(Math.random() * all.length)]); return d; }
let stalls = 0;
for (let i = 0; i < N * 10; i++) {
  try { const r = play("r1", "r2", randDeck(), randDeck(), 3, 3); if (r.winner === -1) stalls++; }
  catch (e) { errors++; console.log("ERROR random", e.stack.split("\n").slice(0, 4).join(" | ")); }
}
console.log("random games", N * 10, "stalls", stalls, "errors", errors);
