// Difficulty curve: a reference deck (AUTO strength, skill 4) against every duelist, in campaign order, at a given
// number of prior wins against them (the rematch ramp). Prints the reference deck's win rate and the average turns.
//   node sim_curve.js [games=20] [wins=0] [deck=mid|strong] [keys] [boostJson] [forceSkill]
//   tournament setting: node sim_curve.js 30 99 strong "" "" 4
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const win = { addEventListener() {}, removeEventListener() {} };
win.window = win; win.document = { getElementById: () => null, createElement: () => ({ getContext: () => ({}) }) };
win.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }; win.console = console; win.Math = Math;
const ctx = vm.createContext(win);
for (const f of ["data/cards.js", "data/fusions.js", "data/decks.js", "js/data/cardsdb.js", "js/data/banlist.js", "js/data/effects.js", "js/data/shop.js", "js/data/duelists.js", "js/game/duel.js", "js/game/ai.js"]) vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f });
const { CardDB, Duelists, Duel, DuelPlayer, AI, Banlist } = win;
const N = parseInt(process.argv[2] || "20"), WINS = parseInt(process.argv[3] || "0"), WHICH = process.argv[4] || "mid";
const ONLY = process.argv[5] ? process.argv[5].split(",") : null; // duelist keys to measure
const BOOST_OVERRIDE = process.argv[6] ? JSON.parse(process.argv[6]) : null; // e.g. '{"nitemare":24}'
const FORCE_SKILL = process.argv[7] ? parseInt(process.argv[7]) : 0;          // the tournament plays everyone at 4
if (BOOST_OVERRIDE) Object.assign(win.Duelists.BOOST, BOOST_OVERRIDE);
// The player's yardstick is the game's own AUTO BUILD, run over the collection a player would have at that point:
// whatever the deck builder makes of a mid-game chest is what the curve is measured against. (The old hand-written
// list is gone - it still held fusion monsters, which are summon-only now, so it measured something unbuildable.)
win.Save = { data: { chest: {} }, owned(id) { return win.Save.data.chest[id] || 0; } };
vm.runInContext(fs.readFileSync(path.join(root, "js/data/deckbuild.js"), "utf8"), ctx, { filename: "deckbuild.js" });
// "mid" is a collection part way through the campaign: the commons and uncommons a player turns up, two of each,
// with the odd rare. "strong" is a finished collection. Both are handed to the game's own deck builder.
function chestDeck(topTier, rareEvery) {
  const chest = {};
  let n = 0;
  for (const c of CardDB.all) {
    if (win.Banlist.limit(c.id) <= 0) continue;
    const t = win.Shop.rarity(c.id);
    if (t > topTier) continue;
    if (t === topTier && topTier > 1 && (n++ % rareEvery)) continue;
    chest[c.id] = 2;
  }
  // Every duelist is guaranteed the five staples (Raigeki, Dark Hole, Mirror Force, Pot of Greed, Feather Duster),
  // so the yardstick gets one of each too - otherwise the curve measures a player who was never allowed to shop.
  for (const id of [337, 336, 814, 789, 672]) chest[id] = 1;
  win.Save.data.chest = chest;
  return win.DeckBuild.bestDeck();
}
// A collection grows with the campaign, so each stage is measured against the deck a player would have by then:
// commons at the start, every common and uncommon by stage 2, the rares filling in through stage 3, and by the
// Heavens the odd Super Rare as well. (Updated 2026-09-23: with the earnings rework a player reaching the Heavens
// has beaten 100+ duelists and banked tens of thousands of Domino, so a yardstick with no Supers in it at all was
// measuring a player who had not been to the shop.)
const BY_STAGE = { 1: chestDeck(0, 1), 2: chestDeck(1, 1), 3: chestDeck(2, 1), 4: chestDeck(3, 3) };
const MID = BY_STAGE[2];
function strongDeck() {   // everything the limit list allows, built the same way
  win.Save.data.chest = {};
  for (const c of CardDB.all) if (win.Banlist.limit(c.id) > 0) win.Save.data.chest[c.id] = 3;
  return win.DeckBuild.bestDeck();
}
function oldStrongDeck() { // the best 40 the limit list allows: top no/one-offering monsters plus the power spells
  const val = (c) => c.atk + c.def * 0.2 - (CardDB.tributesFor(c) === 2 ? 1500 : CardDB.tributesFor(c) === 1 ? 650 : 0);
  const mons = CardDB.all.filter((c) => c.kind === "M" && Banlist.limit(c.id) > 0).sort((a, b) => val(b) - val(a));
  const deck = [337, 336, 784, 781, 348, 342, 789, 686, 685, 661];
  for (const c of mons) { if (deck.length >= 40) break; for (let k = 0; k < Banlist.limit(c.id) && deck.length < 40; k++) deck.push(c.id); }
  return deck;
}
const ref = Banlist.apply(WHICH === "strong" ? strongDeck() : MID).deck; // the limit list applies to the player too
console.log(`reference deck: ${WHICH}${WHICH === "mid" ? " (a collection that grows with the stage)" : ""}, ${N} games per duelist, ${WINS} prior wins against each`);
for (let stage = 1; stage <= 4; stage++) for (const k of Duelists.STAGES[stage].keys) {
  const d = Duelists.byKey[k]; let w = 0, t = 0;
  if (ONLY && !ONLY.includes(k)) continue;
  for (let i = 0; i < N; i++) {
    const a = new DuelPlayer("me", WHICH === "mid" ? BY_STAGE[stage] : ref, true, null); a.skill = 4;
    // From The Heavens on every duelist is at full strength (Save.fullStrength), so stage 4 is only ever met that
    // way: tournament deck, skill 4. Measuring it any other way measures a duel the player can no longer have.
    const full = stage === 4 || (FORCE_SKILL >= 4 && WINS >= 99);
    const b = new DuelPlayer(d.name, Duelists.deck(d, full ? 99 : WINS, { skill: full ? 4 : (FORCE_SKILL || undefined), max: full }), true, d); b.skill = full ? 4 : b_skill(d);
    const duel = new Duel(a, b, {}); let g = 0;
    while (duel.winner === null && g++ < 3000) { const pl = duel.cur(); if (!pl.ai) AI.beginTurn(pl); const r = AI.step(duel, pl); duel.events.length = 0; if (r.type === "end") pl.ai = null; }
    if (duel.winner === 0) w++; t += duel.turnNo;
  }
  const deck = Duelists.deck(d, stage === 4 ? 99 : WINS, { skill: stage === 4 ? 4 : (FORCE_SKILL || undefined), max: stage === 4 || (FORCE_SKILL >= 4 && WINS >= 99) }), mons = deck.map((id) => CardDB.get(id)).filter((c) => c.kind === "M").sort((a, b) => b.atk - a.atk);
  const top = mons.slice(0, 10).reduce((s, c) => s + c.atk, 0) / 10;
  console.log(`  st${stage} ${d.name.padEnd(12)} skill ${stage === 4 ? 4 : b_skill(d)}  ref wins ${String(Math.round(100 * w / N)).padStart(3)}%  turns ${(t / N).toFixed(0).padStart(2)}  top10 ATK ${top.toFixed(0)}`);
}
function b_skill(d) { return FORCE_SKILL || (Duelists.skillFor ? Duelists.skillFor(d, WINS) : (d.skill || d.stage)); }
