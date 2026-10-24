const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const win = { addEventListener() {}, removeEventListener() {} };
win.window = win; win.document = { getElementById: () => null, createElement: () => ({ getContext: () => ({}) }) };
win.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }; win.console = console; win.Math = Math;
const ctx = vm.createContext(win);
for (const f of ["data/cards.js", "data/fusions.js", "data/decks.js", "js/data/cardsdb.js", "js/data/banlist.js", "js/data/effects.js", "js/data/shop.js", "js/data/duelists.js", "js/game/duel.js", "js/game/ai.js"]) vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f });
const { CardDB, Duelists, Duel, DuelPlayer, AI } = win;
const N = parseInt(process.argv[2] || "20");
const starter = Duelists.starterDeck();
for (const key of ["yugi", "tristan", "joey", "mai", "mako"]) {
  const d = Duelists.byKey[key];
  let w = 0, turns = 0, reasons = {};
  for (let i = 0; i < N; i++) {
    const a = new DuelPlayer("me", starter, true, null); a.skill = 3;
    const b = new DuelPlayer(d.name, Duelists.deck(d), true, null); b.skill = d.skill || d.stage;
    const duel = new Duel(a, b, {});
    let g = 0;
    while (duel.winner === null && g++ < 3000) { const pl = duel.cur(); if (!pl.ai) AI.beginTurn(pl); const r = AI.step(duel, pl); duel.events.length = 0; if (r.type === "end") pl.ai = null; }
    if (duel.winner === 0) w++; turns += duel.turnNo; reasons[duel.reason] = (reasons[duel.reason] || 0) + 1;
  }
  console.log(d.name.padEnd(10), "skill-3 starter wins", w + "/" + N, "avg turns", (turns / N).toFixed(0), JSON.stringify(reasons));
}
