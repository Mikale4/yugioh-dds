// Watches the AI play out whole duels and flags monster-effect uses that look like bad play: a monster thrown away
// for nothing, a copy that made the monster smaller, a once-per-duel removal spent on a 500 ATK wall, healing at full
// LP, a freeze on something we already beat. usage: node tools/sim_odd_plays.js [duels per card]
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

const FREEZE = new Set([36, 148, 179, 263, 285, 460, 531, 610, 725]);   // stop their strongest
const REMOVE = new Set([1, 15, 22, 26, 217, 364, 417, 500, 506, 743]);  // destroy a monster outright
const ONCE = new Set([...REMOVE].filter((id) => Effects.special[id] && Effects.special[id].once));
const GAMBLE = new Set([16, 429, 723, 743]);                            // coin flips: a bad result is not a bad decision
const HEAL = new Set([229, 363, 462]);
const flags = {};
function flag(kind, id, detail) {
  const key = kind + "|" + id;
  if (!flags[key]) flags[key] = { kind, id, n: 0, detail };
  flags[key].n++;
}

const origSpecial = Duel.prototype.special;
Duel.prototype.special = function (pl, slot, alt) {
  const self = pl.mon[slot], id = self && self.id;
  if (!id) return origSpecial.call(this, pl, slot, alt);
  const opp = this.opp(pl);
  const before = {
    mine: pl.monsters().map((m) => ({ m, atk: this.atk(m) })),
    theirs: opp.monsters().map((m) => this.atk(m)),
    theirIds: opp.monsters().map((m) => m.id),
    myLp: pl.lp, theirLp: opp.lp, selfAtk: this.atk(self),
  };
  const r = origSpecial.call(this, pl, slot, alt);
  if (!r || !r.ok) return r;
  if (GAMBLE.has(id)) return r;
  const lost = before.mine.filter((x) => !pl.monsters().includes(x.m));
  const traded = pl.monsters().length >= before.mine.length;   // we kept the same number of bodies: a swap, not a sacrifice
  const dealt = before.theirLp - opp.lp;
  const theirBest = before.theirs.length ? Math.max(...before.theirs) : 0;
  const myBest = before.mine.length ? Math.max(...before.mine.map((x) => x.atk)) : 0;
  // 1. our own monsters went to the graveyard and it neither killed them nor traded for something bigger
  if (lost.length && !traded && opp.lp > 0) {
    const given = lost.reduce((t, x) => t + x.atk, 0);
    const tookDown = before.theirs.length - opp.monsters().length;
    if (given >= 1000 && dealt < given / 2 && tookDown <= 0) flag("gave up a monster for nothing", id, given + " ATK given, " + dealt + " damage, lost " + lost.map((x) => CardDB.get(x.m.id).name).join("+") + ", their field was " + (before.theirs.length ? opp.grave.slice(-2).map((g) => CardDB.get(g).name).join("/") : "empty"));
  }
  // 2. a copy that made the monster smaller
  if (pl.monsters().includes(self) && this.atk(self) < before.selfAtk - 1) flag("the effect made it weaker", id, before.selfAtk + " -> " + this.atk(self));
  // 3. a once-per-duel removal spent on something small
  // (clearing their last blocker when the kill is on is not waste, it is the win - and neither is taking a small
  // card off the field that battle cannot answer cleanly: a 250 ATK Steel Scorpion takes its killer with it, and
  // that is exactly what the ability is for, by the user's rule of 2026-09-24)
  const opening = before.theirs.length === 1 && opp.lp <= myBest;
  const problem = before.theirIds.some((x) => Effects.retaliate.has(x) || Effects.locksAttacks.has(x) || [736, 756, 769, 768, 748].includes(x));
  if (ONCE.has(id) && before.theirs.length && theirBest < 1200 && dealt < opp.lp && !opening && !problem) flag("once per duel spent on a small target", id, "their best was " + theirBest);
  // 4. healing that ran into the ceiling (8000 is the starting score, not a cap: 3000 more is 3000 more)
  if (HEAL.has(id) && pl.lp - before.myLp < 500) flag("healed with nothing to gain", id, "LP " + before.myLp + " -> " + pl.lp);
  // 5. a freeze on a monster we already outgun
  if (FREEZE.has(id) && theirBest && myBest > theirBest + 300) flag("froze a monster we already beat", id, myBest + " vs " + theirBest);
  return r;
};

const filler = CardDB.all.filter((c) => c.kind === "M" && c.atk >= 1200 && c.atk <= 1800 && !Effects.special[c.id] && !Effects.passive[c.id] && CardDB.tributesFor(c) === 0).map((c) => c.id);
function deckWith(id, n) { const d = []; for (let i = 0; i < n; i++) d.push(id); while (d.length < 40) d.push(filler[Math.floor(Math.random() * filler.length)]); return d; }
function play(deckA, deckB, skillA, skillB) {
  const a = new DuelPlayer("A", deckA, true, null); a.skill = skillA;
  const b = new DuelPlayer("B", deckB, true, null); b.skill = skillB;
  const duel = new Duel(a, b, {});
  let guard = 0;
  while (duel.winner === null && guard++ < 4000) {
    const pl = duel.cur();
    if (!pl.ai) AI.beginTurn(pl);
    const r = AI.step(duel, pl);
    duel.events.length = 0;
    if (r.type === "end") pl.ai = null;
  }
  return duel.winner;
}

const N = parseInt(process.argv[2] || "6");
const ids = Object.keys(Effects.special).map(Number).sort((a, b) => a - b);
const opponents = Duelists.all.map((d) => Duelists.deck(d));
let errors = 0, duels = 0;
for (const id of ids) {
  const deck = deckWith(id, 3);
  for (let i = 0; i < N; i++) {
    try { play(deck.slice(), opponents[(id + i) % opponents.length].slice(), 3, 3); duels++; }
    catch (e) { errors++; console.log("ERROR " + CardDB.get(id).name + ": " + e.message); break; }
  }
}
// every duelist against every other, so their own effect cards get a turn too
for (let i = 0; i < opponents.length; i++) for (let j = i + 1; j < opponents.length; j += 2) {
  try { play(opponents[i].slice(), opponents[j].slice(), 3, 4); duels++; } catch (e) { errors++; }
}
const rows = Object.values(flags).sort((a, b) => b.n - a.n);
console.log("== odd plays ==");
console.log(rows.length ? rows.map((f) => String(f.n).padStart(4) + "x  " + CardDB.get(f.id).name.padEnd(24) + f.kind + "  (" + f.detail + ")").join("\n") : "  (none)");
console.log("\nduels " + duels + ", errors " + errors);
