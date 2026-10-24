// Starter decks vs Domino Town 1: every theme is rolled a few times and played (skill 2, a learning player) against
// each stage-1 duelist; the cartridge's fixed starter is measured the same way for comparison.
//   node sim_starters.js [decksPerTheme=4] [gamesPerDuelist=6]
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const win = { addEventListener() {}, removeEventListener() {} };
win.window = win; win.document = { getElementById: () => null, createElement: () => ({ getContext: () => ({}) }) };
win.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }; win.console = console; win.Math = Math;
const ctx = vm.createContext(win);
for (const f of ["data/cards.js", "data/fusions.js", "data/decks.js", "js/data/cardsdb.js", "js/data/banlist.js", "js/data/effects.js", "js/data/shop.js", "js/data/duelists.js", "js/data/starters.js", "js/game/duel.js", "js/game/ai.js"]) vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f });
const { Duelists, Duel, DuelPlayer, AI, Starters } = win;
const DECKS = parseInt(process.argv[2] || "4"), N = parseInt(process.argv[3] || "6");
function play(deck, d) {
  const a = new DuelPlayer("me", deck, true, null); a.skill = 2;
  const b = new DuelPlayer(d.name, Duelists.deck(d, 0), true, d); b.skill = Duelists.skillFor(d, 0);
  const duel = new Duel(a, b, {}); let g = 0;
  while (duel.winner === null && g++ < 3000) { const pl = duel.cur(); if (!pl.ai) AI.beginTurn(pl); const r = AI.step(duel, pl); duel.events.length = 0; if (r.type === "end") pl.ai = null; }
  return duel.winner === 0;
}
function measure(label, decks) {
  const keys = Duelists.STAGES[1].keys; let total = 0, wins = 0; const per = {};
  for (const deck of decks) for (const k of keys) { const d = Duelists.byKey[k]; let w = 0; for (let i = 0; i < N; i++) if (play(deck, d)) w++; per[k] = (per[k] || 0) + w; wins += w; total += N; }
  console.log(label.padEnd(10) + " wins " + String(Math.round(100 * wins / total)).padStart(3) + "%   " + keys.map((k) => k.slice(0, 4) + " " + Math.round(100 * per[k] / (N * decks.length)) + "%").join("  "));
}
measure("fixed", [Duelists.starterDeck()]);
for (const t of Starters.THEMES) { const decks = []; for (let i = 0; i < DECKS; i++) decks.push(Starters.roll(t.key).deck); measure(t.key, decks); }
