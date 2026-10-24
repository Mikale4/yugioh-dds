const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const win = { addEventListener() {}, removeEventListener() {} };
win.window = win; win.document = { getElementById: () => null, createElement: () => ({ getContext: () => ({}) }) };
win.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }; win.console = console; win.Math = Math;
const ctx = vm.createContext(win);
for (const f of ["data/cards.js", "data/fusions.js", "data/decks.js", "js/data/cardsdb.js", "js/data/banlist.js", "js/data/effects.js", "js/data/shop.js", "js/data/duelists.js", "js/game/duel.js", "js/game/ai.js"]) vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f });
const { CardDB, Duelists, Duel, DuelPlayer, AI } = win;
const A = Duelists.byKey[process.argv[2] || "seeker"], B = Duelists.byKey[process.argv[3] || "paradox"];
for (let g = 0; g < 200; g++) {
  const a = new DuelPlayer(A.name, Duelists.deck(A), true, null); a.skill = A.stage;
  const b = new DuelPlayer(B.name, Duelists.deck(B), true, null); b.skill = B.stage;
  const duel = new Duel(a, b, {});
  let guard = 0;
  while (duel.winner === null && guard++ < 3000) { const pl = duel.cur(); if (!pl.ai) AI.beginTurn(pl); const r = AI.step(duel, pl); duel.events.length = 0; if (r.type === "end") pl.ai = null; }
  if (duel.winner === null) {
    console.log("STALL game", g, "turn", duel.turnNo, "quiet", duel.quietTurns);
    for (const p of duel.p) console.log(p.name, "LP", p.lp, "hand", p.hand.map(i => CardDB.get(i).name.slice(0, 12)), "deck", p.deck.length, "swords", p.swords, "\n   mons", p.mon.map(m => m ? CardDB.get(m.id).name.slice(0, 12) + "/" + m.pos + "/" + duel.atk(m) + "-" + duel.def(m) + (m.frozen ? "F" : "") + (m.sleep ? "S" : "") + (m.canAttack ? "" : "x") : "-"), "\n   spells", p.spells.map(s => s ? CardDB.get(s.id).name.slice(0, 10) : "-"));
    console.log("last events", duel.log.slice(-12).map(e => e.type + (e.id ? ":" + CardDB.get(e.id).name.slice(0, 10) : "") + (e.why ? ":" + e.why : "")));
    break;
  }
}
console.log("done");
