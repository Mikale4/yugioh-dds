// What a duel actually pays now that earnings are a bill and not a flat fee: the reference deck fights the whole
// ladder and every win is run through Bonus.forDuel, so the economy can be read before anyone plays it.
//   node sim_earnings.js [games=20]
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const win = { addEventListener() {}, removeEventListener() {} };
win.window = win; win.document = { getElementById: () => null, createElement: () => ({ getContext: () => ({}) }) };
win.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }; win.console = console; win.Math = Math;
const ctx = vm.createContext(win);
for (const f of ["data/cards.js", "data/fusions.js", "data/decks.js", "js/data/cardsdb.js", "js/data/banlist.js", "js/data/effects.js", "js/data/shop.js", "js/data/bonuses.js", "js/data/duelists.js", "js/game/duel.js", "js/game/ai.js"]) vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f });
const { CardDB, Duelists, Duel, DuelPlayer, AI, Banlist, Bonus, Shop } = win;
win.Save = { data: { chest: {} }, owned(id) { return win.Save.data.chest[id] || 0; } };
vm.runInContext(fs.readFileSync(path.join(root, "js/data/deckbuild.js"), "utf8"), ctx, { filename: "deckbuild.js" });

const N = parseInt(process.argv[2] || "20");
function chestDeck(topTier, rareEvery) {
  const chest = {}; let n = 0;
  for (const c of CardDB.all) {
    if (Banlist.limit(c.id) <= 0) continue;
    const t = Shop.rarity(c.id); if (t > topTier) continue;
    if (t === topTier && topTier > 1 && (n++ % rareEvery)) continue;
    chest[c.id] = 2;
  }
  win.Save.data.chest = chest;
  return win.DeckBuild.bestDeck();
}
const BY_STAGE = { 1: chestDeck(0, 1), 2: chestDeck(1, 1), 3: chestDeck(2, 2), 4: chestDeck(2, 1) };
const skillOf = (d) => Math.min(4, (d.skill || d.stage) + (d.stage >= 2 ? 1 : 0));

const rowHits = {}, rowSum = {};
const perStage = { 1: [], 2: [], 3: [], 4: [] };
let wins = 0, duels = 0, flaw = 0, cards = 0;
console.log(`reference deck vs the ladder, ${N} duels each  (flawless x${Shop.FLAWLESS}, a card every ${Bonus.CARD_STEP})`);
for (let stage = 1; stage <= 4; stage++) for (const k of Duelists.STAGES[stage].keys) {
  const d = Duelists.byKey[k];
  let tot = 0, w = 0, best = 0, fl = 0;
  for (let i = 0; i < N; i++) {
    const a = new DuelPlayer("me", BY_STAGE[stage], true, null); a.skill = 4;
    const b = new DuelPlayer(d.name, Duelists.deck(d, 0), true, d); b.skill = skillOf(d);
    const duel = new Duel(a, b, {}); let g = 0;
    while (duel.winner === null && g++ < 3000) { const pl = duel.cur(); if (!pl.ai) AI.beginTurn(pl); const r = AI.step(duel, pl); duel.events.length = 0; if (r.type === "end") pl.ai = null; }
    duels++;
    if (duel.winner !== 0) continue;
    w++; wins++;
    const flawless = !duel.p[0].stats.tookDamage; if (flawless) { fl++; flaw++; }
    const e = Bonus.forDuel(duel, { payout: Shop.payout(d), flawless });
    for (const r of e.rows) { rowHits[r.name] = (rowHits[r.name] || 0) + 1; rowSum[r.name] = (rowSum[r.name] || 0) + r.amount; }
    tot += e.total; cards += e.cards; if (e.total > best) best = e.total;
    perStage[stage].push(e.total);
  }
  console.log(`  st${stage} ${d.name.padEnd(12)} won ${String(w).padStart(2)}/${N}  avg ${String(w ? Math.round(tot / w) : 0).padStart(5)} D  best ${String(best).padStart(5)}  flawless ${fl}`);
}
console.log("\n== per stage (Domino per win) ==");
for (let s = 1; s <= 4; s++) {
  const a = perStage[s].slice().sort((x, y) => x - y);
  if (!a.length) { console.log(`  stage ${s}: no wins`); continue; }
  console.log(`  stage ${s}: avg ${Math.round(a.reduce((x, y) => x + y, 0) / a.length)}  median ${a[Math.floor(a.length / 2)]}  low ${a[0]}  high ${a[a.length - 1]}  (flat payout was ${Shop.payout({ stage: s })})`);
}
console.log("\n== how often each line appears (of " + wins + " wins) ==");
for (const k of Object.keys(rowHits).sort((a, b) => rowHits[b] - rowHits[a])) {
  console.log(`  ${k.padEnd(13)} ${String(Math.round(100 * rowHits[k] / wins)).padStart(3)}%  avg when it fires ${Math.round(rowSum[k] / rowHits[k])}`);
}
console.log(`\nwins ${wins}/${duels}, flawless ${flaw} (${Math.round(100 * flaw / Math.max(1, wins))}% of wins), bonus cards handed out ${cards} (${(cards / Math.max(1, wins)).toFixed(2)} per win)`);
