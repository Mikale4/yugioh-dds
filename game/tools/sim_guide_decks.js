const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const win = { addEventListener() {}, removeEventListener() {} };
win.window = win; win.document = { getElementById: () => null, createElement: () => ({ getContext: () => ({}) }) };
win.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }; win.console = console; win.Math = Math;
const ctx = vm.createContext(win);
for (const f of ["data/cards.js", "data/fusions.js", "data/decks.js", "js/data/cardsdb.js", "js/data/banlist.js", "js/data/effects.js", "js/data/shop.js", "js/data/duelists.js", "js/game/duel.js", "js/game/ai.js"]) vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f });
const { CardDB, Duelists, Duel, DuelPlayer, AI } = win;
const N = parseInt(process.argv[2] || "10");
const con = (u, l) => 24; // constructed cards are gone from the game: the guide's three slots become filler
const DECKS = {
  "Checks and Balances (Lv35 Cap725)": [1, 24, 33, 44, 80, 90, 125, 127, 143, 192, 359, 366, 427, 428, 493, 513, 532, 551, 631, 642, 732, 732, 733, 747, 758, 795, 800, con(6, 25), con(24, 15), con(26, 6), 338, 339, 343, 350, 350, 658, 790, 685, 688, 689],
  "Unleash the Dragon (Lv37 Cap937)": [4, 7, 10, 16, 28, 31, 40, 77, 80, 81, 97, 120, 129, 168, 200, 217, 296, 298, 367, 379, 387, 432, 459, 493, 502, 532, 551, 631, 649, 713, 747, 758, 795, 799, 332, 350, 661, 661, 685, 689],
};
for (const [name, deck] of Object.entries(DECKS)) {
  const cost = deck.reduce((s, id) => s + (CardDB.get(id) ? CardDB.get(id).cost : 0), 0);
  console.log(`\n== ${name}: ${deck.length} cards, cost ${cost}`);
  for (let stage = 2; stage <= 4; stage++) for (const k of Duelists.STAGES[stage].keys) {
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
