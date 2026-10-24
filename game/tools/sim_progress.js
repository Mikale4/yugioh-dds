// Simulates a player who has cleared previous stages: deck auto-built from those stages' drop pools under Capacity/Level limits.
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const win = { addEventListener() {}, removeEventListener() {} };
win.window = win; win.document = { getElementById: () => null, createElement: () => ({ getContext: () => ({}) }) };
win.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }; win.console = console; win.Math = Math;
const ctx = vm.createContext(win);
for (const f of ["data/cards.js", "data/fusions.js", "data/decks.js", "js/data/cardsdb.js", "js/data/banlist.js", "js/data/effects.js", "js/data/shop.js", "js/data/duelists.js", "js/game/duel.js", "js/game/ai.js"]) vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f });
const { CardDB, Duelists, Duel, DuelPlayer, AI } = win;
const N = parseInt(process.argv[2] || "10");
function buildDeck(pool, capacity, level) {
  // pool: card ids available (3 copies each)
  const ids = [];
  for (const id of pool) for (let k = 0; k < 3; k++) ids.push(id);
  const usable = ids.filter((id) => CardDB.get(id).cost <= level);
  const mons = usable.filter((id) => CardDB.get(id).kind === "M").sort((a, b) => (CardDB.get(b).atk + CardDB.get(b).def * 0.3) / (CardDB.get(b).cost + 8) - (CardDB.get(a).atk + CardDB.get(a).def * 0.3) / (CardDB.get(a).cost + 8));
  const spells = usable.filter((id) => CardDB.get(id).kind === "S" && [336, 337, 348, 349, 661, 784, 781, 342, 341, 340].includes(CardDB.get(id).id)).sort((a, b) => CardDB.get(a).cost - CardDB.get(b).cost);
  const deck = []; const cost = () => deck.reduce((s, id) => s + CardDB.get(id).cost, 0);
  for (const id of spells) if (deck.length < 6 && cost() + CardDB.get(id).cost <= capacity - 300) deck.push(id);
  for (const id of mons) { if (deck.length >= 40) break; if (cost() + CardDB.get(id).cost <= capacity && CardDB.tributesFor(CardDB.get(id)) <= 1) deck.push(id); }
  const cheap = usable.slice().sort((a, b) => CardDB.get(a).cost - CardDB.get(b).cost);
  for (const id of cheap) { if (deck.length >= 40) break; if (cost() + CardDB.get(id).cost <= capacity) deck.push(id); }
  return deck;
}
const stages = Duelists.STAGES;
for (let stage = 2; stage <= 4; stage++) {
  const pool = new Set(Duelists.starterDeck());
  for (let s = 1; s < stage; s++) for (const k of stages[s].keys) for (const id of Duelists.drops(Duelists.byKey[k])) pool.add(id);
  const winsSoFar = [0, 0, 25, 55, 75][stage];
  const level = 13 + winsSoFar, capacity = 354 + winsSoFar * 10 + (winsSoFar * 0.3) * 5;
  const deck = buildDeck([...pool], capacity, level);
  const dc = deck.reduce((s, id) => s + CardDB.get(id).cost, 0);
  console.log(`\n== stage ${stage} player: Lv${level} Cap${Math.round(capacity)} deck cost ${dc} (${deck.length} cards) top: ${deck.slice(6, 12).map((id) => CardDB.get(id).name.slice(0, 10) + CardDB.get(id).atk).join(", ")}`);
  for (const k of stages[stage].keys) {
    const d = Duelists.byKey[k]; let w = 0, t = 0;
    for (let i = 0; i < N; i++) {
      const a = new DuelPlayer("me", deck, true, null); a.skill = 3;
      const b = new DuelPlayer(d.name, Duelists.deck(d), true, null); b.skill = d.skill || d.stage;
      const duel = new Duel(a, b, {}); let g = 0;
      while (duel.winner === null && g++ < 3000) { const pl = duel.cur(); if (!pl.ai) AI.beginTurn(pl); const r = AI.step(duel, pl); duel.events.length = 0; if (r.type === "end") pl.ai = null; }
      if (duel.winner === 0) w++; t += duel.turnNo;
    }
    console.log("  " + d.name.padEnd(12), "wins", w + "/" + N, "avg turns", (t / N).toFixed(0));
  }
}
