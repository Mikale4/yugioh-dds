const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const win = { addEventListener() {}, removeEventListener() {} };
win.window = win; win.document = { getElementById: () => null, createElement: () => ({ getContext: () => ({}) }) };
win.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }; win.console = console; win.Math = Math;
const ctx = vm.createContext(win);
for (const f of ["data/cards.js", "data/fusions.js", "data/decks.js", "js/data/cardsdb.js", "js/data/banlist.js", "js/data/effects.js", "js/data/shop.js", "js/data/duelists.js", "js/game/duel.js", "js/game/ai.js"]) vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f });
const { CardDB, Duelists, Duel, DuelPlayer, AI } = win;
const counts = {};
let games = 0;
for (const A of Duelists.all) for (const B of Duelists.all) {
  if (A === B || Math.random() > 0.15) continue;
  const a = new DuelPlayer(A.name, Duelists.deck(A), true, null); a.skill = 4;
  const b = new DuelPlayer(B.name, Duelists.deck(B), true, null); b.skill = 4;
  const duel = new Duel(a, b, {}); let g = 0; games++;
  while (duel.winner === null && g++ < 3000) {
    const pl = duel.cur(); if (!pl.ai) AI.beginTurn(pl);
    const r = AI.step(duel, pl);
    for (const e of duel.events) counts[e.type] = (counts[e.type] || 0) + 1;
    duel.events.length = 0;
    if (r.type === "end") pl.ai = null;
  }
}
console.log("games", games, JSON.stringify(counts));
