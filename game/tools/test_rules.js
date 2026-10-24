// Rule checks for the duel engine: node test_rules.js
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const win = { addEventListener() {}, removeEventListener() {} };
win.window = win; win.document = { getElementById: () => null, createElement: () => ({ getContext: () => ({}) }) };
win.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }; win.console = console; win.Math = Math;
const ctx = vm.createContext(win);
for (const f of ["data/cards.js", "data/fusions.js", "data/decks.js", "js/data/cardsdb.js", "js/data/banlist.js", "js/data/effects.js", "js/data/shop.js", "js/data/bonuses.js", "js/data/duelists.js", "js/data/starters.js", "js/game/duel.js", "js/game/ai.js"]) vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f });
const { CardDB, Duel, DuelPlayer, DuelMonster, Effects, Duelists } = win;
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) pass++; else { fail++; console.log("FAIL:", msg); } }
function mk(handA, handB) {
  const a = new DuelPlayer("A", new Array(40).fill(8), false), b = new DuelPlayer("B", new Array(40).fill(8), true);
  const d = new Duel(a, b, { first: 0 });
  d.endTurn(); d.endTurn();          // turn 3: attacks are allowed
  a.hand = handA.slice(); b.hand = handB.slice(); d.events.length = 0;
  return d;
}
function put(d, p, id, pos, faceUp) { const m = new DuelMonster(id, p); m.pos = pos || "atk"; m.faceUp = faceUp !== false; m.canAttack = true; const s = d.p[p].freeMonSlot(); d.p[p].mon[s] = m; return m; }
const byName = (n) => CardDB.all.find((c) => c.name === n).id;

// --- summoning: monsters have no levels, so nothing is ever paid for
{
  const d = mk([1, 2, 4], []); const a = d.p[0];
  ok(d.canSummon(a, 0).ok && d.canSummon(a, 0).need === 0, "a 3000 ATK Blue-eyes is summoned for nothing");
  ok(d.summon(a, 1, "atk").ok, "summon Mystical Elf");
  ok(a.mon[0].faceUp && a.mon[0].canAttack, "a normal summon is face-up and may attack this turn");
  ok(!d.changePos(a, 0).ok, "no position change on the turn it was summoned");
  ok(!d.canSummon(a, 1).ok, "only one summon per turn");
  const dd = mk([4], []); dd.summon(dd.p[0], 0, "def"); ok(!dd.p[0].mon[0].faceUp && dd.p[0].mon[0].pos === "def", "a set monster is face-down in defence");
  const d1 = new Duel(new DuelPlayer("A", new Array(40).fill(8), false), new DuelPlayer("B", new Array(40).fill(8), true), { first: 0 });
  put(d1, 0, 1); ok(!d1.canAttackWith(d1.p[0], 0).ok, "no attacks on turn 1");
  d.endTurn(); d.endTurn();
  put(d, 0, 4); // baby dragon
  a.hand = [1]; const r = d.summon(a, 0, "atk");
  ok(r.ok && a.mon.filter(Boolean).length === 3 && a.mon.some((m) => m && m.id === 1), "the Blue-eyes joins the board instead of eating it");
  ok(CardDB.all.every((c) => CardDB.tributesFor(c) === 0), "no card in the game asks for an offering");
}
// --- fusion success and failure
{
  const d = mk([], []); const a = d.p[0];
  const fid = CardDB.fuse(16, 4); ok(fid === 69, "Time Wizard + Baby Dragon = Thousand Dragon (" + fid + ")");
  a.hand = [4, 16];
  const r = d.fuseHand(a, 1, 0); ok(r.ok && r.result === 69 && a.hand.length === 1 && a.hand[0] === 69 && !a.summoned, "hand fusion puts the result in the hand without touching the summon");
  ok(d.canSummon(a, 0).ok, "the fused dragon is summoned like anything else");
  const noFuse = CardDB.all.find((c) => c.kind === "M" && c.id !== 8 && CardDB.fuse(8, c.id) === 0).id;
  a.hand = [8, noFuse];
  const bad = d.fuseHand(a, 1, 0); ok(bad.ok && bad.result === 0 && a.hand.length === 2 && a.hand[0] === 8 && a.hand[1] === noFuse && !a.summoned, "failed fusion keeps both cards, summon untouched");
  ok(!d.fuseHand(a, 1, 0).ok && a.fuseLocked, "no more fusing after a failed attempt this turn");
  d.endTurn(); d.endTurn(); ok(!a.fuseLocked, "fusing is available again next turn");
  // onto the field: the result replaces the field monster, keeps its position and its attack
  const f = mk([16], []); const fm = put(f, 0, 4, "atk"); fm.summonTurn = 0;
  const fr = f.fuseField(f.p[0], 0, 0);
  ok(fr.ok && fr.result === 69 && f.p[0].mon[0].id === 69 && f.p[0].mon[0].faceUp && f.p[0].mon[0].canAttack && f.p[0].hand.length === 0 && !f.p[0].summoned, "field fusion puts Thousand Dragon on the field, ready to attack, summon untouched");
  ok(f.canAttackWith(f.p[0], 0).ok, "the fused field monster can attack this turn");
  const f2 = mk([16], []); put(f2, 0, 4); f2.attack(f2.p[0], 0, null);
  ok(!f2.fuseField(f2.p[0], 0, 0).ok && f2.p[0].hand.length === 1, "a monster that attacked this turn cannot be fused");
  const f3 = mk([noFuse], []); put(f3, 0, 8); const f3r = f3.fuseField(f3.p[0], 0, 0);
  ok(f3r.ok && f3r.result === 0 && f3.p[0].hand.length === 1 && f3.p[0].mon[0].id === 8 && f3.p[0].fuseLocked, "a failed field fusion keeps both cards and locks fusing");
}
// --- the AI does not leave a set monster idle when its attackers sweep the field
{
  // our 2500 Summoned Skull will kill the lone 1200 enemy; the set 800 ATK Kuriboh-ish monster should flip and hit directly after it
  const d = mk([], []); const a = d.p[0]; a.skill = 3;
  put(d, 0, byName("Judge Man"), "atk"); const weak = put(d, 0, 8, "def"); weak.faceUp = false; weak.summonTurn = 0; weak.canAttack = true;
  put(d, 1, byName("Hitotsu-me Giant"), "atk");
  win.AI.beginTurn(a); const types = [];
  for (let i = 0; i < 12; i++) { const r = win.AI.step(d, a); types.push(r.type); if (r.type === "end") break; }
  ok(weak.pos === "atk" && types.filter((t) => t === "attack").length === 2 && d.p[1].lp < 8000, "the set monster is flipped and attacks directly once the field is swept (" + types.join(",") + ")");
  // with a bigger enemy still standing, a weak set monster stays down
  const d2 = mk([], []); const b = d2.p[0]; b.skill = 3;
  put(d2, 0, byName("Summoned Skull"), "atk"); const weak2 = put(d2, 0, 24, "def"); weak2.faceUp = false; weak2.summonTurn = 0;
  put(d2, 1, 1, "atk"); put(d2, 1, byName("Hitotsu-me Giant"), "atk");
  win.AI.beginTurn(b); for (let i = 0; i < 12; i++) { const r = win.AI.step(d2, b); if (r.type === "end") break; }
  ok(weak2.pos === "def", "a weak set monster stays down while an unbeatable enemy remains");
}
// --- a power-up goes where it gains the most, not onto the biggest body
{
  const { AI } = win;
  const run = (duel, pl) => { const real = Math.random; Math.random = () => 0; AI.beginTurn(pl); for (let i = 0; i < 8; i++) { const r = AI.step(duel, pl); if (r.type === "end") break; } Math.random = real; };
  const d = mk([323], []); const p = d.p[0]; p.skill = 3;          // Book of Secret Arts: fits any Magician
  const maha = put(d, 0, 493);                                      // Maha Vailo 1550: every power-up is worth 1000 to her
  const elf = put(d, 0, byName("Dark Elf"));                        // 2000, the bigger body
  put(d, 1, byName("Judge Man"));
  run(d, p);
  ok(maha.levels === 1 && elf.levels === 0 && d.atk(maha) === 2550, "the equip goes on Maha Vailo (" + d.atk(maha) + ") and not on the bigger Dark Elf");
  // and with no Maha Vailo out, it goes on the biggest body after all
  const e = mk([323], []); const q = e.p[0]; q.skill = 3;
  const big = put(e, 0, byName("Dark Elf")); const small = put(e, 0, byName("Gemini Elf"));
  put(e, 1, byName("Judge Man"));
  run(e, q);
  ok(big.levels === 1 && small.levels === 0, "with nobody to double it, the power-up goes to the strongest monster");
  // Metalmorph and Elegant Egotist are equips that TRANSFORM their target: the AI plays them on the card they change
  const f = mk([658], []); const fp = f.p[0]; fp.skill = 3;
  put(f, 0, 82); put(f, 0, byName("Battle Ox")); put(f, 1, byName("Judge Man"));
  run(f, fp);
  ok(fp.mon.some((m) => m && m.id === 742), "Metalmorph goes on the Red-eyes and makes the Metal Dragon, not a +500 on a bigger body");
  const g = mk([318], []); const gp = g.p[0]; gp.skill = 3;
  put(g, 0, 62); put(g, 0, byName("Battle Ox")); put(g, 1, byName("Judge Man"));
  run(g, gp);
  ok(gp.mon.some((m) => m && m.id === 63), "Elegant Egotist goes on the Harpie Lady");
  // and with nothing to transform they are just a power-up
  const h = mk([658], []); const hp = h.p[0]; hp.skill = 3;
  const ax = put(h, 0, byName("Axe Raider")); put(h, 1, byName("Millennium Shield"));
  run(h, hp);
  ok(ax.levels === 1, "with no Red-eyes about, Metalmorph is played as the power-up it also is");
}
// --- set monsters are no mystery: the AI knows what is under there and sends the cheapest killer
{
  const { AI } = win;
  const d = mk([], []); const a = d.p[0]; a.skill = 3;
  const small = put(d, 0, byName("Celtic Guardian"));      // 1400
  put(d, 0, byName("Summoned Skull"));                     // 2500
  const set = put(d, 1, 8, "def"); set.faceUp = false; set.summonTurn = 0;   // Mushroom Man, 600 DEF
  AI.beginTurn(a);
  for (let i = 0; i < 12; i++) { const r = AI.step(d, a); if (r.type === "end") break; }
  const first = d.log.find((e) => e.type === "attack" && e.targetSlot >= 0);
  ok(first && first.id === small.id, "the weakest monster that can win the fight is the one sent into a set monster");
  // A set monster is ALWAYS attacked (the user's rule, 2026-09-24, which overrides the old "it knows what the set
  // card does, so it stays away"): whatever is hiding under there, a face-down nobody attacks sits on the board for
  // free. It still has to be beatable - the AI does not throw itself at a wall it cannot get through.
  const e = mk([], []); const b = e.p[0]; b.skill = 3;
  const big = put(e, 0, byName("Summoned Skull"));
  const bug = put(e, 1, 501, "def"); bug.faceUp = false; bug.summonTurn = 0;  // Man-eater Bug takes its killer with it
  AI.beginTurn(b); b.hand = [];
  for (let i = 0; i < 12; i++) { const r = AI.step(e, b); if (r.type === "end") break; }
  ok(big.attackedThisTurn, "a 2500 ATK monster runs into a set Man-eater Bug anyway: a face-down is always attacked");
  const e2 = mk([], []); const b2 = e2.p[0]; b2.skill = 3;
  const mid = put(e2, 0, byName("Koumori Dragon"));                            // 1500 ATK
  const wall = put(e2, 1, byName("Mystical Elf"), "def"); wall.faceUp = false; wall.summonTurn = 0;   // 800/2000
  AI.beginTurn(b2); b2.hand = [];
  for (let i = 0; i < 12; i++) { const r = AI.step(e2, b2); if (r.type === "end") break; }
  ok(!mid.attackedThisTurn, "...but not a set 2000 DEF wall it cannot break");
  // nothing at all stops the swing, not even a Reflect Bounder that will burn the last Life Points away
  const e3 = mk([], []); const b3 = e3.p[0]; b3.skill = 4; b3.lp = 1200;
  const doomed = put(e3, 0, byName("Summoned Skull"));
  const bounce = put(e3, 1, 756, "def"); bounce.faceUp = false; bounce.summonTurn = 0;
  AI.beginTurn(b3); b3.hand = [];
  for (let i = 0; i < 12; i++) { const r = AI.step(e3, b3); if (r.type === "end") break; }
  ok(doomed.attackedThisTurn, "a set Reflect Bounder is attacked too, on the last Life Points, by the user's rule");
  ok(b3.lp === 1200, "...and it costs nothing: a SET Reflect Bounder never fires, the targeting window is past by the time the attack flips it");
  {
    // face up it still burns, from either position
    const up = mk([], []); put(up, 0, byName("Summoned Skull")); const rb = put(up, 1, 756, "def");
    up.attack(up.p[0], 0, up.p[1].mon.indexOf(rb));
    ok(up.p[0].lp === 8000 - 2500, "a face-up Reflect Bounder burns the attacker for its ATK (" + up.p[0].lp + ")");
  }
}
// --- equips and the field card are spells on the field, and can be destroyed like any other
{
  const d = mk([], []); const gk = put(d, 0, 586);          // Greenkappa: up to 2 spell or trap cards
  const em = put(d, 1, 4); em.levels = 1; em.equips.push(315);   // an equipped Baby Dragon
  d.field = 332;                                            // ...standing on Mountain
  const before = d.atk(em);
  ok(d.special(d.p[0], d.p[0].mon.indexOf(gk)).ok, "Greenkappa fires with only an equip and a field card to break");
  ok(em.equips.length === 0 && em.levels === 0 && d.atk(em) < before, "the equip is destroyed and its power-up goes with it (" + before + " to " + d.atk(em) + ")");
  ok(d.field === 0, "and the field card is blown away as well");
  // a trap-only effect leaves both alone
  const e = mk([], []); const reaper = put(e, 0, 84);
  const em2 = put(e, 1, 4); em2.levels = 1; em2.equips.push(315);
  e.field = 332;
  e.special(e.p[0], e.p[0].mon.indexOf(reaper));
  ok(em2.equips.length === 1 && e.field === 332, "a trap-breaker touches neither");
  // and the Feather Duster takes the lot
  const f = mk([672], []); const em3 = put(f, 1, 4); em3.levels = 1; em3.equips.push(315);
  f.p[1].spells[0] = { id: 683, faceUp: false }; f.field = 332;
  f.activate(f.p[0], { hand: 0 });
  ok(!f.p[1].spells[0] && em3.equips.length === 0 && f.field === 0, "Harpie's Feather Duster clears set cards, equips and the field");
}
// --- the AI cycles dead cards now that the hand refills every turn
{
  const d = mk([722, 722, 722, 722, 722], []); const a = d.p[0]; a.skill = 2; a.deck = new Array(20).fill(8); // five ritual spells and nothing to pay them with
  win.AI.beginTurn(a); const types = [];
  for (let i = 0; i < 12; i++) { const r = win.AI.step(d, a); types.push(r.type); if (r.type === "end") break; }
  ok(types.includes("discard") && a.hand.length === 4, "a skill-2 AI throws away a dead card from a full hand to draw a fresh one (" + types.join(",") + ")");
  const d2 = mk([24, 24, 24, 24, 24], []); const b = d2.p[0]; b.skill = 2; b.deck = new Array(20).fill(8);
  win.AI.beginTurn(b); const t2 = [];
  for (let i = 0; i < 12; i++) { const r = win.AI.step(d2, b); t2.push(r.type); if (r.type === "end") break; }
  ok(!t2.includes("discard"), "playable cards are not thrown away (" + t2.join(",") + ")");
  const d3 = mk([722, 722, 722, 722, 722], []); const c = d3.p[0]; c.skill = 2; c.deck = [8, 8, 8]; d3.quietTurns = 0; d3.acted = true;
  win.AI.beginTurn(c); const t3 = [];
  for (let i = 0; i < 12; i++) { const r = win.AI.step(d3, c); t3.push(r.type); if (r.type === "end") break; }
  ok(!t3.includes("discard"), "no proactive cycling when the deck is nearly gone (" + t3.join(",") + ")");
  const d4 = mk([722, 722, 722, 722, 722], []); const e = d4.p[0]; e.skill = 2; e.deck = [8, 8, 8]; d4.quietTurns = 3;
  win.AI.beginTurn(e); const t4 = [];
  for (let i = 0; i < 12; i++) { const r = win.AI.step(d4, e); t4.push(r.type); if (r.type === "end") break; }
  ok(t4.includes("discard"), "...but a stuck game is cycled anyway so it ends by deck-out (" + t4.join(",") + ")");
}
// --- the AI fuses onto the field
{
  const d = mk([16, 24], []); const a = d.p[0]; a.skill = 2; put(d, 0, 4); a.mon[0].summonTurn = 0; win.AI.beginTurn(a);
  let fused = false; for (let i = 0; i < 8; i++) { const r = win.AI.step(d, a); if (r.type === "fuse") fused = true; if (r.type === "end") break; }
  ok(fused && a.mon.some((m) => m && m.id === 69), "skill 2 AI fuses Time Wizard from the hand onto its Baby Dragon on the field");
}
// --- elements
{
  const d = mk([], []);
  const pyro = CardDB.all.find((c) => c.kind === "M" && c.el === "Pyro" && c.atk === 500) || CardDB.all.find((c) => c.kind === "M" && c.el === "Pyro");
  const forest = CardDB.all.find((c) => c.kind === "M" && c.el === "Forest" && c.atk >= 2000);
  const m = put(d, 0, pyro.id); put(d, 1, forest.id);
  const r = d.attack(d.p[0], 0, 0);
  ok(r.ok && d.p[0].mon[0] === null && d.p[1].mon[0] !== null, "elements do not decide battles: a weak Pyro loses to a strong Forest");
  const d2 = mk([], []); put(d2, 0, forest.id); put(d2, 1, pyro.id); d2.attack(d2.p[0], 0, 0);
  ok(d2.p[1].mon[0] === null && d2.p[0].mon[0] !== null, "...and the strong Forest wins the reverse fight");
}
// --- normal battle & damage, defense
{
  const d = mk([], []); put(d, 0, 1); put(d, 1, 4, "atk"); d.attack(d.p[0], 0, 0);
  ok(d.p[1].lp === 8000 - (3000 - 1200), "damage is the ATK difference: " + d.p[1].lp);
  const d2 = mk([], []); put(d2, 0, 4); put(d2, 1, 2, "def"); d2.attack(d2.p[0], 0, 0);
  ok(d2.p[0].lp === 8000 - 800 && d2.p[1].mon[0] !== null, "attacking a bigger DEF hurts the attacker's owner");
  const d3 = mk([], []); put(d3, 0, 1); d3.attack(d3.p[0], 0, null); ok(d3.p[1].lp === 5000, "direct attack");
  ok(!d3.changePos(d3.p[0], 0).ok, "a monster that attacked cannot change position this turn");
}
// --- traps
{
  const d = mk([], []); put(d, 0, 4); d.p[1].spells[0] = { id: 683, faceUp: false }; // bear trap <1500
  put(d, 1, 8); d.attack(d.p[0], 0, 0);
  ok(d.p[0].mon[0] === null && d.p[1].spells[0] === null, "Bear Trap destroys a 1200 attacker");
  const d2 = mk([], []); put(d2, 0, 1); d2.p[1].spells[0] = { id: 683, faceUp: false }; put(d2, 1, 8); d2.attack(d2.p[0], 0, 0);
  ok(d2.p[0].mon[0] !== null && d2.p[1].spells[0] !== null, "Bear Trap ignores a 3000 attacker");
}
// --- magic: raigeki, dark hole, heal/damage, swords, equips, change of heart, field
{
  const d = mk([337], []); put(d, 1, 4); put(d, 1, 8);
  ok(d.activate(d.p[0], { hand: 0 }).ok && !d.p[1].hasMonsters(), "Raigeki clears the enemy field");
  const d2 = mk([342, 347], []); d2.p[0].lp = 1000; d2.activate(d2.p[0], { hand: 0 }); ok(d2.p[0].lp === 6000, "Dian Keto heals 5000");
  d2.activate(d2.p[0], { hand: 0 }); ok(d2.p[1].lp === 7000, "Tremendous Fire deals 1000");
  const d3 = mk([315, 301], []); const m = put(d3, 0, 4); d3.activate(d3.p[0], { hand: 0 }, 0); ok(d3.atk(m) === 1700, "Dragon Treasure +500 on a dragon");
  const r = d3.activate(d3.p[0], { hand: 0 }, 0); ok(r.ok && r.fail && d3.atk(m) === 1700, "Legendary Sword does not fit a dragon");
  const d4 = mk([784], []); put(d4, 1, 1); d4.activate(d4.p[0], { hand: 0 }); ok(d4.p[0].mon.some((x) => x && x.id === 1) && !d4.p[1].hasMonsters(), "Change of Heart steals the best monster");
  const d5 = mk([334], []); const w = put(d5, 0, byName("Fortress Whale")); d5.activate(d5.p[0], { hand: 0 }); ok(d5.atk(w) === 3055 && d5.def(w) === 2795, "Umi boosts Fortress Whale by 30% (" + d5.atk(w) + ")");
  const d6 = mk([348], []); put(d6, 1, 4); d6.activate(d6.p[0], { hand: 0 }); d6.endTurn(); ok(!d6.canAttackWith(d6.p[1], 0).ok && d6.p[1].swords === 2, "Swords stops attacks for 3 turns");
  const d7 = mk([781], []); put(d7, 1, 1); d7.activate(d7.p[0], { hand: 0 }); ok(d7.p[0].mon.some((x) => x && x.id === 1), "Brain Control takes the monster"); d7.endTurn(); ok(d7.p[1].mon.some((x) => x && x.id === 1), "...and it returns on the owner's turn");
}
// --- rituals
{
  const d = mk([675], []); put(d, 0, 1); put(d, 0, 1); put(d, 0, 1);
  const r = d.activate(d.p[0], { hand: 0 }); ok(r.ok && d.p[0].mon.filter(Boolean).length === 1 && d.p[0].mon.some((m) => m && m.id === 380), "Ultimate Dragon ritual");
  const d2 = mk([670], []); put(d2, 0, 38); put(d2, 0, 4); put(d2, 0, 8);
  const r2 = d2.activate(d2.p[0], { hand: 0 }); ok(r2.ok && d2.p[0].mon.some((m) => m && m.id === 364), "Black Luster Ritual");
  const d3 = mk([670], []); put(d3, 0, 4); ok(!d3.activate(d3.p[0], { hand: 0 }).ok, "ritual refuses without materials");
  const d4 = mk([670, 38, 4, 8], []); const r4 = d4.activate(d4.p[0], { hand: 0 });
  ok(r4.ok && d4.p[0].mon.some((m) => m && m.id === 364) && d4.p[0].hand.length === 2, "ritual paid from the hand takes only the named offering");
  const d5 = mk([670, 38], []); put(d5, 0, 4); put(d5, 0, 8); const r5 = d5.activate(d5.p[0], { hand: 0 });
  ok(r5.ok && d5.p[0].mon.filter(Boolean).length === 3 && d5.p[0].hand.length === 0, "ritual leaves the other field monsters alone");
  const d6 = mk([670], []); put(d6, 0, 38); put(d6, 0, 4); const r6 = d6.activate(d6.p[0], { hand: 0 });
  ok(r6.ok && d6.p[0].mon.filter(Boolean).length === 2 && d6.p[0].mon.some((m) => m && m.id === 364) && !d6.p[0].mon.some((m) => m && m.id === 38), "ritual can take its named offering from the field");
  ok(Effects.ritualSpellFor[364] === 670 && Duelists.fixDrop(364) === 670, "ritual monsters drop as their ritual spell");
}
// --- specials & passives
{
  // Time Wizard no longer turns a Baby Dragon by itself - that is a fusion recipe now (the user's rule, 2026-09-24)
  const d = mk([], []); put(d, 0, 4); put(d, 0, 16);
  ok(!Effects.special[16] && !d.special(d.p[0], 1).ok, "Time Wizard has no Baby Dragon ability any more");
  ok(CardDB.fuse(16, 4) === 69, "...Time Wizard + Baby Dragon is a fusion into Thousand Dragon instead");
  ok(!!Effects.special2[16] && Effects.special2[16].once, "...and its own ability, the once-a-duel board wipe, is untouched");
  const d2 = mk([], []); const pet = put(d2, 0, 386); put(d2, 0, 62); ok(d2.atk(pet) === 2500, "Harpie Lady powers the pet dragon (" + d2.atk(pet) + ")");
  const d3 = mk([], []); put(d3, 1, 1); const rel = put(d3, 0, 731); const r3 = d3.special(d3.p[0], 0); ok(r3.ok && d3.p[1].monsters().length === 0 && d3.atk(rel) === 3000, "Relinquished absorbs the strongest enemy and takes its ATK (" + d3.atk(rel) + ")");
  const d6 = mk([], []); put(d6, 0, 48); d6.p[0].deck = [8, 8, 8]; const before = d6.p[0].hand.length;
  ok(d6.special(d6.p[0], 0).ok && d6.p[0].hand.length === before + 1 && d6.canAttackWith(d6.p[0], 0).ok, "a SPCL ability does not use up the attack");
  ok(!d6.special(d6.p[0], 0).ok, "a SPCL ability is once per turn");
  const d4 = mk([17, 18, 19, 20], []); d4.p[0].deck = [21]; d4.p[0].hand = [17, 18, 19, 20]; d4.drawCard(d4.p[0]); ok(d4.winner === 0 && d4.reason === "exodia", "Exodia wins instantly");
  const d5 = mk([], []); d5.p[1].deck = []; d5.p[1].hand = [4]; d5.endTurn(); ok(d5.winner === 0 && d5.reason === "deckout", "deck out loses");
  const e6 = mk([], []); e6.p[1].hand = [4]; e6.p[1].deck = [8, 8, 8, 8, 8, 8]; e6.endTurn(); ok(e6.p[1].hand.length === 5 && e6.p[1].deck.length === 2, "the hand is refilled to 5 at the start of the turn");
  const d7 = mk([], []); d7.p[1].hand = [4]; d7.p[1].deck = [8, 8]; d7.endTurn(); ok(d7.winner === null && d7.p[1].hand.length === 3 && d7.p[1].deck.length === 0, "a short deck refills what it can without losing yet");
  const d8 = mk([], []); d8.p[1].hand = [4, 4, 4, 4, 4]; d8.p[1].deck = [8]; d8.endTurn(); ok(d8.p[1].hand.length === 5 && d8.p[1].deck.length === 1, "a full hand draws nothing at the start of the turn");
  const d9 = mk([789, 4, 4, 4, 4], []); d9.p[0].deck = [8, 8, 8]; const r9 = d9.activate(d9.p[0], { hand: 0 }); ok(r9.ok && d9.p[0].hand.length === 6, "Pot of Greed draws 2 even from a full hand (" + d9.p[0].hand.length + ")");
  ok(!d9.endTurn().ok && d9.turn === 0, "the turn cannot end with 6 cards in hand");
  d9.discard(d9.p[0], 0); ok(d9.endTurn().ok && d9.turn === 1, "after discarding down to 5 the turn ends");
  const dA = mk([1, 1, 1, 1, 1, 1, 1], []); const pa = dA.p[0]; pa.skill = 3; pa.deck = new Array(20).fill(8); for (let i = 0; i < 5; i++) put(dA, 0, 24); // seven Blue-eyes, a full field
  win.AI.beginTurn(pa); const ta = []; for (let i = 0; i < 20; i++) { const r = win.AI.step(dA, pa); ta.push(r.type); if (r.type === "end") break; }
  ok(ta.includes("discard") && ta[ta.length - 1] === "end" && pa.hand.length <= 5, "the AI discards down to 5 before ending its turn (" + ta.join(",") + ")");
}
// --- the AI keeps a ritual's named offering in the hand and ritual-summons with it
{
  const gaia = byName("Gaia The Fierce Knight"), bls = byName("Black Luster Soldier");
  const d = mk([670, gaia, 24, 9], []); const a = d.p[0]; a.skill = 2; win.AI.beginTurn(a);
  let ritualed = false;
  for (let i = 0; i < 8; i++) { const r = win.AI.step(d, a); if (r.type === "ritual") ritualed = true; if (r.type === "end") break; }
  ok(ritualed && a.mon.some((m) => m && m.id === bls), "skill 2 AI ritual-summons Black Luster Soldier from the hand instead of normal-summoning Gaia");
  const d2 = mk([670, gaia, 24], []); const b = d2.p[0]; b.skill = 2; put(d2, 0, 1); win.AI.beginTurn(b); // a Blue-eyes already out: the ritual is not worth it yet
  for (let i = 0; i < 8; i++) { const r = win.AI.step(d2, b); if (r.type === "end") break; }
  ok(!b.mon.some((m) => m && m.id === gaia) && b.hand.includes(gaia) && b.mon.some((m) => m && m.id === 24), "when the ritual is not worth it yet the AI keeps Gaia in the hand and summons something else");
}
// --- the card shop economy
{
  const { Shop, Banlist } = win;
  ok(Shop.rarity(1) === 4 && Shop.rarity(337) === 4 && Shop.rarity(8) === 0 && Shop.rarity(17) === 4 && Shop.rarity(58) === 3, "rarity: Blue-eyes, Raigeki and Exodia pieces are ultra rare, Kuriboh super rare now, a plain 800 monster common");
  ok(Shop.price(1) === 3000 && Shop.sellPrice(1) === 750 && Shop.price(8) === 80 && Shop.sellPrice(8) === 20, "buy and sell prices per tier");
  win.Save = { data: { stats: { duels: 0 }, shop: null, chest: { 58: 41 }, deck: [], domino: 100 }, save() {}, owned(id) { return this.data.chest[id] || 0; }, spare(id) { return this.owned(id); }, chestTotal() { return 41; }, addCard(id) { this.data.chest[id] = (this.data.chest[id] || 0) + 1; }, removeCard(id) { this.data.chest[id]--; } };
  const st = Shop.ensureStock().stock;
  ok(st.length === 10 && new Set(st.map((s) => s.id)).size === 10 && st.every((s) => !Banlist.ritualOnly(s.id)), "the shelf holds 10 different sellable cards");
  const cheap = st.findIndex((s) => Shop.price(s.id) <= 100);
  if (cheap >= 0) { const r = Shop.buy(cheap); ok(r.ok && st[cheap].sold && !Shop.buy(cheap).ok, "a bought card is sold out"); }
  ok(!Shop.buy(st.findIndex((s) => Shop.price(s.id) > 100)).ok, "no Domino, no card");
  ok(Shop.sell(58).ok, "a spare card sells");
  // RENEW: the first restock of every stock period is free, the next ones cost 250 Domino, and the count resets with the shelf
  win.Save.data.domino = 400; const before = st.map((x) => x.id).join(",");
  ok(Shop.rerollPrice() === 0 && Shop.reroll().ok && win.Save.data.domino === 400, "the first renew is free");
  ok(Shop.rerollPrice() === 250 && Shop.reroll().ok && win.Save.data.domino === 150, "the second costs 250 Domino");
  ok(!Shop.canReroll().ok && !Shop.reroll().ok && win.Save.data.domino === 150, "...and a third is refused without the Domino");
  win.Save.data.domino = 1000; ok(Shop.reroll().ok && win.Save.data.domino === 750 && Shop.rerollPrice() === 250, "every further renew stays 250");
  win.Save.data.stats.duels += Shop.REFRESH; Shop.ensureStock();
  ok(Shop.rerollPrice() === 0, "after the shelf restocks itself the free renew is back");
  ok(Shop.ensureStock().stock.length === 10, "a renewed shelf still holds 10 cards");
  win.Save.chestTotal = () => 40; ok(!Shop.sell(58).ok, "the chest never drops below 40 cards");
  win.Save.data.stats.duels = 10; ok(Shop.ensureStock().stock !== st, "the shelf renews after 10 duels");
  const pack = Shop.rollPack(); ok(pack.length === 5 && pack.every((id) => CardDB.get(id) && !Banlist.ritualOnly(id)), "a pack is 5 ownable cards");
}
// --- balance patch: reworked cards
{
  const { Banlist } = win;
  ok(Banlist.limit(342) === 3 && Banlist.limit(48) === 1 && Banlist.limit(657) === 1 && Banlist.limit(785) === 1 && Banlist.limit(83) === 3, "limits: Dian Keto and Castle free, Sangan 1, Megamorph 1, Multiply 1");
  ok([685, 686, 347, 692].every((id) => Banlist.limit(id) === 3) && [670, 722, 783, 695, 665, 667, 675].every((id) => Banlist.limit(id) === 1),
    "Acid Trap Hole, Widespread Ruin, Tremendous Fire and Turtle Oath are off the list; the seven big rituals are Limited");
  ok(Banlist.limit(369) === 0 && Duelists.fixDrop(369) === 366, "Wall Shadow is not a deck card and drops as Labyrinth Wall");
  // Megamorph doubles ATK
  const d1 = mk([657], []); put(d1, 0, 24); const base = d1.atk(d1.p[0].mon[0]); ok(d1.activate(d1.p[0], { hand: 0 }, 0).ok && d1.atk(d1.p[0].mon[0]) === base * 2, "Megamorph doubles ATK (" + base + " -> " + d1.atk(d1.p[0].mon[0]) + ")");
  // Multiply copies the chosen monster, a Kuriboh fills the field
  const d2 = mk([785], []); put(d2, 0, 24); ok(d2.activate(d2.p[0], { hand: 0 }, 0).ok && d2.p[0].monsters().filter((m) => m.id === 24).length === 2, "Multiply makes a second copy of the chosen monster");
  const d3 = mk([785], []); put(d3, 0, 58); ok(d3.activate(d3.p[0], { hand: 0 }, 0).ok && d3.p[0].monsters().filter((m) => m.id === 58).length === 5, "Multiply on Kuriboh fills the field");
  // Magical Labyrinth digs the wall out of the deck, and does nothing at all without one in there
  const d4 = mk([652], []); d4.p[0].deck = [366, 8, 8];
  ok(d4.activate(d4.p[0], { hand: 0 }).ok && d4.p[0].monsters().some((m) => m.id === 366 && m.pos === "def") && !d4.p[0].deck.includes(366),
    "Magical Labyrinth special summons Labyrinth Wall out of the deck, in defence");
  const d4b = mk([652], []); d4b.p[0].deck = [8, 8, 8];
  ok(!d4b.activate(d4b.p[0], { hand: 0 }).ok && d4b.p[0].monsters().length === 0, "Magical Labyrinth does nothing with no Labyrinth Wall anywhere");
  // ...and it reaches into the graveyard and the hand for it as well (the user's rule, 2026-09-23)
  const d4c = mk([652], []); d4c.p[0].deck = [8, 8, 8]; d4c.p[0].grave = [366];
  ok(d4c.activate(d4c.p[0], { hand: 0 }).ok && d4c.p[0].monsters().some((m) => m.id === 366) && !d4c.p[0].grave.includes(366), "Magical Labyrinth calls the wall back out of the graveyard");
  const d4d = mk([652, 366], []); d4d.p[0].deck = [8, 8, 8];
  ok(d4d.activate(d4d.p[0], { hand: 0 }).ok && d4d.p[0].monsters().some((m) => m.id === 366) && !d4d.p[0].hand.includes(366), "Magical Labyrinth puts the wall out of the hand straight onto the field");
  ok(Banlist.limit(366) === 1, "Labyrinth Wall is Limited to one, and the Labyrinth is how a maze deck keeps finding it");
  const d5 = mk([652], []); for (let i = 0; i < 5; i++) put(d5, 0, 24); ok(!d5.activate(d5.p[0], { hand: 0 }).ok, "...but not onto a full field");
  // the Spy: the computer throws away the enemy's best card, the player is asked
  const d6 = mk([790], [1, 24, 8]); d6.p[0].ai = {}; ok(d6.activate(d6.p[0], { hand: 0 }).ok && !d6.p[1].hand.includes(1) && d6.p[1].hand.length === 2, "the computer's Spy discards the enemy's Blue-eyes");
  const d7 = mk([790], [1, 24, 8]); d7.p[0].ai = null; ok(d7.activate(d7.p[0], { hand: 0 }).ok && d7.pendingPick && d7.p[1].hand.length === 3, "the player's Spy waits for a choice");
  ok(d7.resolvePick(d7.p[0], 1).ok && d7.p[1].hand.length === 2 && !d7.p[1].hand.includes(24) && !d7.pendingPick, "...and the chosen card is thrown away");
  // Fake Trap soaks up Harpie's Feather Duster
  const d8 = mk([672], []); d8.p[1].spells[0] = { id: 690, faceUp: false }; d8.p[1].spells[1] = { id: 683, faceUp: false }; ok(d8.activate(d8.p[0], { hand: 0 }).ok && !d8.p[1].spells[0] && d8.p[1].spells[1] && d8.p[1].spells[1].id === 683, "Fake Trap takes the Duster instead of the Bear Trap");
  // Castle of Dark Illusions boosts Zombies / Fiends / Shadow monsters by 30 percent
  const d9 = mk([], []); const z = put(d9, 0, byName("Dragon Zombie")); const before = d9.atk(z); put(d9, 0, 83); ok(d9.atk(z) === Math.round(before * 1.3), "Castle of Dark Illusions: Dragon Zombie " + before + " -> " + d9.atk(z));
  // Time Wizard ages the enemy board to dust, once a duel
  const rnd = Math.random;
  const dA = mk([], []); put(dA, 0, 16); put(dA, 1, 1); put(dA, 1, 24); ok(dA.special(dA.p[0], 0, true).ok && dA.p[1].monsters().length === 0 && dA.p[0].monsters().length === 1, "Time Wizard destroys every enemy monster and leaves yours alone");
  const dB = mk([], []); const tw = put(dB, 0, 16); put(dB, 1, 1); dB.special(dB.p[0], 0, true); tw.usedSpecial = false; put(dB, 1, 24);
  ok(!dB.special(dB.p[0], 0, true).ok && dB.p[1].monsters().length === 1 && dB.p[0].lp === 8000, "...once per duel, and it costs nothing");
  Math.random = rnd;
}
// --- the 2026-09 monster effect patch
{
  const { Banlist, AI } = win;
  const wrapLines = (str) => { const out = []; let line = ""; for (const w of String(str).split(" ")) { if ((line + (line ? " " : "") + w).length > 18) { out.push(line); line = w; } else line = line ? line + " " + w : w; } out.push(line); return out.length; };
  const longP = Object.keys(Effects.passive).filter((id) => wrapLines("Effect: " + Effects.passive[id]) > 4);
  const longS = Object.keys(Effects.special).filter((id) => wrapLines("SPCL: " + Effects.special[id].text) > 4);
  ok(longP.length === 0 && longS.length === 0, "every Effect / SPCL text fits its 4-line card page: " + longP.concat(longS).join(","));
  ok(Banlist.limit(1) === 1 && Banlist.limit(376) === 3 && Banlist.limit(516) === 1 && Banlist.limit(58) === 3 && Banlist.limit(22) === 1 && Banlist.limit(783) === 1, "limits: Blue-eyes 1, Monster Tamer free again, Muka Muka 1, Kuriboh free, Summoned Skull 1 (2500 ATK), Black Illusion Ritual 1");
  ok(Banlist.limit(35) === 1 && Banlist.limit(48) === 1 && Banlist.limit(574) === 1 && Banlist.limit(229) === 3 && Banlist.limit(342) === 3 && Banlist.limit(462) === 3 && Banlist.limit(490) === 3 && Banlist.limit(591) === 1 && Banlist.limit(733) === 3 && Banlist.limit(740) === 3 && Banlist.limit(750) === 0, "limits: D. Magician / Sangan / Witch / Morphing Jar 1; Hourglass, Dian Keto, Immortal, Needle Ball, Idol, Invitation free");
  ok(Banlist.limit(756) === 1 && Banlist.limit(217) === 0 && Banlist.limit(722) === 1 && Banlist.limit(729) === 1 && Banlist.limit(695) === 1,
    "limits: Reflect Bounder / Dark Magic Ritual / Toon Summoned Skull / Puppet Ritual 1");
  // the once-per-duel batch bought these their freedom back (the user's rule, 2026-09-24)
  ok([9, 24, 195, 166, 376, 420, 463, 641, 187].every((id) => Banlist.limit(id) === 3),
    "off the list now their abilities are once a duel: the Splitters, the Puppeteer, Monster Tamer, Cyber-Stein, Electric Snake, Invader of the Throne, Gate Deeg");
  ok([1, 166, 376, 420, 641].every((id) => Effects.special[id] && Effects.special[id].once), "...and every one of those abilities is flagged once per duel, Blue-eyes included");
  // the ones that copy themselves are free and repeatable again, and the Servant swapped its copy for the Doll's
  // comeback - which, like the Doll's and Blast Sphere's, fires once a duel however many copies are run
  ok([9, 195].every((id) => Effects.special[id] && !Effects.special[id].once) && !Effects.special[24],
    "Shadow Specter and Doron duplicate themselves as often as they like, and Skull Servant no longer copies at all");
  ok([759, 24, 736].every((id) => Effects.onceDestroy.has(id) && Effects.onDestroy[id]),
    "Doll of Demise, Skull Servant and Blast Sphere all fire once a duel");
  ok([185, 584, 249, 586, 428, 562, 83, 669, 349].every((id) => Banlist.limit(id) === 3),
    "off the list entirely: Eyearmor, Binding Chain, Water Omotics, Greenkappa, Magician of Faith, Needle Worm, Castle, Shadow Spell, Spellbinding Circle");
  // reading a hand is free; the answers to a board are one copy each, which is what every duelist is handed
  ok([815, 790, 402, 420].every((id) => Banlist.limit(id) === 3) && [813, 336, 337, 661, 814, 672, 372].every((id) => Banlist.limit(id) === 1),
    "Trap Hole, the Spy, Monster Eye and Cyber-Stein are free; Call of the Haunted, Dark Hole, Raigeki, Crush Card, Mirror Force, the Feather Duster and Kazejin are Limited");
  const tourney = (d) => Duelists.deck(d, 99, { skill: 4, max: true });
  ok(Duelists.all.every((d) => [337, 336, 814, 789, 672].every((id) => tourney(d).includes(id))),
    "every TOURNAMENT deck carries the staples: Raigeki, Dark Hole, Mirror Force, Pot of Greed and the Feather Duster");
  ok(Duelists.all.filter((d) => [337, 336, 814, 789, 672].every((id) => Duelists.deck(d, 0).includes(id))).length <= 2,
    "the campaign decks are not handed the staples - they are the faithful build (the user's rule, 2026-09-23)");
  // a character's calling cards turn up in their own decks and nowhere else, campaign or tournament
  {
    const strays = [];
    for (const [key, ids] of Object.entries(Duelists.SIGNATURE_OF)) for (const id of ids) {
      for (const d of Duelists.all) {
        if (Duelists.SIGNATURE_OF[d.key] && Duelists.SIGNATURE_OF[d.key].includes(id)) continue;
        if (Duelists.deck(d, 0).includes(id) || tourney(d).includes(id)) strays.push(d.name + " has " + CardDB.get(id).name + " (" + key + "'s)");
      }
    }
    ok(strays.length === 0, "every signature card is held only by the character it belongs to" + (strays.length ? ": " + strays.slice(0, 6).join("; ") : ""));
  }
  // and the ATK ceiling underneath it: 2100 and up is Semi-Limited, 2500 and up is Limited
  ok(Banlist.limit(805) === 1 && Banlist.limit(82) === 1 && Banlist.limit(26) === 3 && Banlist.limit(33) === 2,
    "the ATK ceiling: Gorz 2700 -> 1, Battle Ox 1700 -> free, Judge Man 2200 -> 2; Red-eyes is Limited by name");
  ok([752, 773, 407, 762, 808].every((id) => Banlist.limit(id) === 1), "Jinzo, Sword Hunter, Machine King, Insect Queen and White-Horned Dragon are Limited");
  // SPCL: Blue-eyes destroys the strongest enemy; Summoned Skull only what its ATK overpowers
  const d1 = mk([], []); put(d1, 0, 1); put(d1, 1, 24); put(d1, 1, 22); ok(d1.special(d1.p[0], 0).ok && d1.p[1].monsters().length === 1 && d1.p[1].monsters()[0].id === 24, "Blue-eyes' SPCL destroys the enemy's strongest monster");
  const d2 = mk([], []); put(d2, 0, 22); put(d2, 1, 366); put(d2, 1, 24); ok(d2.special(d2.p[0], 0).ok && d2.p[1].monsters().length === 1, "Summoned Skull's bolt destroys the strongest enemy");
  d2.endTurn(); d2.endTurn(); ok(!d2.special(d2.p[0], 0).ok && d2.special(d2.p[0], 0).why === "Once per duel", "...but only once per duel");
  // triggers: Sangan searches when destroyed, Man-eater Bug takes its killer down, Reflect Bounder burns the attacker's owner
  const d3 = mk([], []); const sg = put(d3, 0, 48); d3.p[0].deck = [1, 24, 8]; const h3 = d3.p[0].hand.length; d3.destroyMonster(sg, "magic"); ok(d3.p[0].hand.length === h3 + 1 && d3.p[0].hand.includes(8) && d3.p[0].deck.includes(1), "Sangan destroyed: the best monster of 1500 ATK or less comes from the deck, not the Blue-eyes");
  const d4 = mk([], []); put(d4, 0, 1); put(d4, 1, 501, "def"); d4.attack(d4.p[0], 0, 0); ok(d4.p[0].monsters().length === 0 && d4.p[1].monsters().length === 0, "Man-eater Bug slain in battle destroys the Blue-eyes that killed it");
  const d5 = mk([], []); put(d5, 0, 1); put(d5, 1, 756); const lp5 = d5.p[0].lp; d5.attack(d5.p[0], 0, 0); ok(d5.p[0].lp === lp5 - 3000 && d5.p[1].monsters().length === 0, "Reflect Bounder costs its attacker 3000 LP, then dies in the battle");
  // Kuriboh in the hand eats a direct attack
  const d6 = mk([58], []); put(d6, 1, 1); d6.endTurn(); d6.attack(d6.p[1], 0, null); ok(d6.p[0].lp === 8000 && !d6.p[0].hand.includes(58) && d6.p[0].grave.includes(58), "Kuriboh in the hand takes a 3000 direct attack instead of the LP");
  // Muka Muka grows with the hand; Total Defense Shogun attacks from defence with its DEF
  const d7 = mk([8, 8, 8], []); const mm = put(d7, 0, 516); ok(d7.atk(mm) === 600 + 3 * 600, "Muka Muka: 600 ATK per card in hand (" + d7.atk(mm) + ")");
  const d8 = mk([797], []); put(d8, 0, 24); const s8 = d8.summon(d8.p[0], 0, "atk", [0]).slot; const sh = d8.p[0].mon[s8]; ok(sh.pos === "def" && d8.canAttackWith(d8.p[0], s8).ok && d8.atk(sh) === 2500 && !d8.changePos(d8.p[0], s8).ok, "Total Defense Shogun stays in defence, attacks from there and hits for its DEF");
  // the moth line grows a step on every own turn
  const d9 = mk([278], []); d9.summon(d9.p[0], 0, "def"); d9.endTurn(); d9.endTurn(); ok(d9.p[0].mon[0].id === 56, "Petit Moth becomes Larvae Moth on its owner's next turn");
  d9.endTurn(); d9.endTurn(); ok(d9.p[0].mon[0].id === 72, "...then the Cocoon"); d9.endTurn(); d9.endTurn(); ok(d9.p[0].mon[0].id === 57, "...then Great Moth"); d9.endTurn(); d9.endTurn(); ok(d9.p[0].mon[0].id === 67, "...then Perfectly Ultimate Great Moth");
  // The Last Warrior seals normal summons; a Toon is a special summon that ignores the normal summon
  const dA = mk([4], []); put(dA, 1, 794); ok(!dA.canSummon(dA.p[0], 0).ok, "The Last Warrior from Another Planet seals normal summons");
  // the Toons are the one thing still paid for, and the price comes off the field
  const dB = mk([4, 729], []); put(dB, 0, 24);
  ok(dB.summon(dB.p[0], 0, "atk").ok, "the normal summon goes first");
  const toon = dB.canSummon(dB.p[0], 0);
  ok(toon.ok && toon.free && toon.need === 1, "Toon Summoned Skull is an extra summon that asks for one offering");
  ok(!dB.summon(dB.p[0], 0, "atk").ok, "...and it will not come out for free");
  ok(dB.summon(dB.p[0], 0, "atk", [0]).ok && dB.p[0].monsters().some((m) => m.id === 729), "paid from the field, it arrives after the normal summon");
  // ...but the offerings are the price of that EXTRA summon only: while the normal summon is there, a Toon is
  // played like any other monster, for nothing (the user's rule, 2026-09-24)
  const dB2 = mk([729], []);
  ok(!dB2.canSummon(dB2.p[0], 0).ok, "a Toon on an empty field cannot come out at all: it is never a normal summon");
  const dBx = mk([767], []); put(dBx, 0, 24);
  const toonx = dBx.canSummon(dBx.p[0], 0);
  ok(toonx.ok && toonx.free && toonx.need === 1, "with a monster to offer, every Toon is a free extra summon costing one");
  ok(dBx.summon(dBx.p[0], 0, "atk", [0]).ok && !dBx.p[0].summoned && dBx.p[0].monsters().some((m) => m.id === 767 && m.faceUp),
    "...it arrives face up, and the normal summon is still there afterwards");
  const dB3 = mk([728], []); put(dB3, 0, 24);
  ok(dB3.canSummon(dB3.p[0], 0).need === 1, "Toon Mermaid pays the same one offering as the rest of them");
  ok([727, 728, 729, 767].every((id) => Banlist.limit(id) === 1), "every Toon is Limited to one");
  const dC = mk([755], []); put(dC, 1, 24); put(dC, 1, 8); dC.p[0].summoned = true; ok(dC.canSummon(dC.p[0], 0).ok && dC.canSummon(dC.p[0], 0).need === 0, "The Fiend Megacyber needs no offering against two enemy monsters");
  // B.eyes Ultimate Dragon: no attack on its summon turn, three the turn after
  const dD = mk([675, 1, 1, 1], []); dD.activate(dD.p[0], { hand: 0 }); ok(dD.p[0].mon.some((m) => m && m.id === 380) && !dD.canAttackWith(dD.p[0], 0).ok, "Ultimate Dragon cannot attack the turn it is summoned");
  dD.endTurn(); dD.endTurn(); for (let i = 0; i < 3; i++) put(dD, 1, 24); let hits = 0; for (let i = 0; i < 3; i++) if (dD.attack(dD.p[0], 0, i).ok) hits++; ok(hits === 3 && !dD.canAttackWith(dD.p[0], 0).ok, "...and attacks three times the next turn");
  // Thunder Dragon fetches its copies when discarded; Gate Guardian shrugs off Raigeki once a turn
  const dE = mk([425], []); dE.p[0].deck = [425, 425, 8]; dE.discard(dE.p[0], 0); ok(dE.p[0].hand.filter((x) => x === 425).length === 2 && dE.p[0].deck.length === 1, "discarding Thunder Dragon brings two more from the deck");
  const dF = mk([337, 337], []); put(dF, 1, 374); put(dF, 1, 24); dF.activate(dF.p[0], { hand: 0 }); ok(dF.p[1].monsters().length === 1 && dF.p[1].mon.some((m) => m && m.id === 374), "Gate Guardian survives the first Raigeki of the turn");
  dF.activate(dF.p[0], { hand: 0 }); ok(dF.p[1].monsters().length === 0, "...but not the second");
  const dG = mk([], []); put(dG, 0, 1); put(dG, 1, 374); dG.special(dG.p[0], 0); ok(dG.p[0].monsters().length === 0 && dG.p[1].monsters().length === 1, "Gate Guardian turns Blue-eyes' SPCL back on the dragon");
  // The Unhappy Maiden ends the attacker's turn; the AI obeys
  const dH = mk([], []); put(dH, 1, 768, "def"); put(dH, 0, 24); put(dH, 0, 8); const pa = dH.p[0]; pa.skill = 3; AI.beginTurn(pa); const types = []; for (let i = 0; i < 12; i++) { const r = AI.step(dH, pa); types.push(r.type); if (r.type === "end") break; }
  ok(dH.forceEnd === false && dH.turn === 1 && types.filter((t) => t === "attack").length === 1, "the turn ends as soon as The Unhappy Maiden is slain (" + types.join(",") + ")");
  // Jinzo shuts traps down; Wall of Illusion bounces; Invader of the Throne swaps; Parasite Paracide turns the deck's monsters into Insects
  const dI = mk([], []); put(dI, 0, 752); put(dI, 0, 24); dI.p[1].spells[0] = { id: 686, faceUp: false }; dI.attack(dI.p[0], 1, null); ok(dI.p[1].lp === 8000 - 300 && dI.p[1].spells[0], "Jinzo: the Widespread Ruin under it never fires");
  const dJ = mk([], []); put(dJ, 0, 1); put(dJ, 1, 769, "def"); dJ.attack(dJ.p[0], 0, 0); ok(dJ.p[0].monsters().length === 0 && dJ.p[0].hand.includes(1) && dJ.p[1].monsters().length === 0, "Wall of Illusion sends the Blue-eyes that beat it back to the hand");
  const dK = mk([], []); put(dK, 0, 641); put(dK, 1, 1); ok(dK.special(dK.p[0], 0).ok && dK.p[0].mon[0].id === 1 && dK.p[1].mon[0].id === 641, "Invader of the Throne trades places with the Blue-eyes");
  const dL = mk([], []); dL.p[0].deck.push(763); const bw = put(dL, 0, 1); ok(bw.ty === "Insect", "Parasite Paracide in the deck makes Blue-eyes an Insect"); dL.p[0].deck.pop(); ok(bw.ty === "Dragon", "...and a Dragon again once it leaves");
  // All-seeing goddess stands in for a ritual offering; Cyber-Stein brings a ritual monster out for nothing
  const dM = mk([670, 109], []); ok(dM.activate(dM.p[0], { hand: 0 }).ok && dM.p[0].mon.some((m) => m && m.id === 364), "All-seeing goddess pays for Black Luster Ritual in Gaia's place");
  const dN = mk([], []); put(dN, 0, 420); dN.p[0].deck = [675, 8]; ok(dN.special(dN.p[0], 0).ok && dN.p[0].lp === 8000 && dN.p[0].mon.some((m) => m && m.id === 380), "Cyber-Stein brings out Ultimate Dragon from the deck's ritual, and costs nothing");
  // Red-eyes burns half the victim's ATK; Morphing Jar redraws both hands
  const dO = mk([], []); put(dO, 0, 82); put(dO, 1, 4); dO.attack(dO.p[0], 0, 0); ok(dO.p[1].lp === 8000 - 1200 - 600, "Red-eyes: battle damage plus half of Baby Dragon's ATK");
  const dP = mk([8, 8], [8, 8, 8]); put(dP, 0, 1); put(dP, 1, 591, "def"); dP.p[0].deck = new Array(10).fill(8); dP.p[1].deck = new Array(10).fill(8); dP.attack(dP.p[0], 0, 0); ok(dP.p[0].hand.length === 5 && dP.p[1].hand.length === 5 && dP.p[0].grave.filter((x) => x === 8).length === 2, "Morphing Jar: both hands thrown away and 5 new cards each");
  // auras: Pumpking lifts Zombies, Hoshiningen lifts Light and drops Shadow on both sides
  const dQ = mk([], []); const dz = put(dQ, 0, byName("Dragon Zombie")); const b0 = dQ.atk(dz); put(dQ, 0, 99); ok(dQ.atk(dz) === Math.round(b0 * 1.3), "Pumpking: Dragon Zombie " + b0 + " -> " + dQ.atk(dz));
  const dR = mk([], []); const be = put(dR, 1, 1); const dm = put(dR, 1, 35); put(dR, 0, 492); ok(dR.atk(be) === 3900 && dR.atk(dm) === 1750, "Hoshiningen: enemy Blue-eyes 3900, enemy D. Magician 1750");
  // the AI prices the new monsters: it summons Muka Muka for its real ATK and does not attack into a face-up Man-eater Bug with a big monster
  const dS = mk([516, 24], []); dS.p[0].skill = 3; ok(dS.previewAtk(dS.p[0], 516) === 600 + 600, "previewAtk sees Muka Muka's hand bonus (one other card in hand)");
  const dT = mk([], []); put(dT, 0, byName("Judge Man")); put(dT, 1, 501, "def").faceUp = true; const pt = dT.p[0]; pt.skill = 3; AI.beginTurn(pt); const tt = []; for (let i = 0; i < 10; i++) { const r = AI.step(dT, pt); tt.push(r.type); if (r.type === "end") break; }
  ok(!tt.includes("attack") && dT.p[0].monsters().length === 1, "a skill-3 AI keeps a plain beater away from a face-up Man-eater Bug (" + tt.join(",") + ")");
  // a Sangan pays its owner however it dies, so the Blue-eyes leaves it alone and swings instead
  const dV = mk([], []); put(dV, 0, 1); put(dV, 1, 48); const pv = dV.p[0]; pv.skill = 3; AI.beginTurn(pv); const tv = []; for (let i = 0; i < 10; i++) { const r = AI.step(dV, pv); tv.push(r.type); if (r.type === "end") break; }
  ok(!tv.includes("special") && tv.includes("attack"), "a Blue-eyes does not set off a Sangan with its special (" + tv.join(",") + ")");
  // but a Blue-eyes has an answer that costs it nothing: Burst destroys the bug, then the way is clear
  const dU = mk([], []); put(dU, 0, 1); put(dU, 1, 501, "def").faceUp = true; const pu = dU.p[0]; pu.skill = 3; AI.beginTurn(pu); const tu = []; for (let i = 0; i < 10; i++) { const r = AI.step(dU, pu); tu.push(r.type); if (r.type === "end") break; }
  ok(tu[0] === "special" && dU.p[1].monsters().length === 0 && dU.p[0].monsters().length === 1, "a Blue-eyes destroys the bug with its special instead of biting it (" + tu.join(",") + ")");
  // A once-per-duel removal is saved for what battle cannot answer cleanly (the user's rule, 2026-09-24): a card
  // that takes its killer with it, one that freezes or bounces or burns the attacker, one bigger than anything we
  // have, or one carrying a dangerous effect. A plain body is bitten instead.
  {
    const spends = (theirId) => {
      const d = mk([], []); put(d, 0, 1); put(d, 1, theirId);
      const p = d.p[0]; p.skill = 4; AI.beginTurn(p); p.hand = [];
      const acts = [];
      for (let i = 0; i < 12; i++) { const r = AI.step(d, p); acts.push(r.type); if (r.type === "end") break; }
      return acts.includes("special");
    };
    ok(!spends(byName("Mushroom Man")) && !spends(byName("Battle Ox")), "a Blue-eyes saves its Burst against a plain body");
    ok(spends(1), "...and spends it on a body its own size rather than trading itself away for it");
    ok(spends(399) && spends(394), "...and spends it on a monster that takes its killer with it");
    ok(spends(725) && spends(769) && spends(756) && spends(768), "...on one that freezes, bounces or burns the attacker, or ends our turn");
    ok(spends(byName("Perfectly Ultimate")) && spends(752), "...on one bigger than anything we have, and on a dangerous effect like Jinzo");
    ok(!spends(48), "...but never on a Sangan, which pays its owner however it dies");
    // Barrel Dragon aims the same way, though its coin flip is free and repeatable: at 2600 it beats a plain body in
    // battle, so the flip is kept for what battle cannot answer (the user's rule, 2026-09-24)
    const barrel = (theirId) => {
      const d = mk([], []); put(d, 0, 743); put(d, 1, theirId);
      const p = d.p[0]; p.skill = 4; AI.beginTurn(p); p.hand = [];
      const acts = [];
      for (let i = 0; i < 12; i++) { const r = AI.step(d, p); acts.push(r.type); if (r.type === "end") break; }
      return acts.includes("special");
    };
    ok(!barrel(byName("Battle Ox")) && !barrel(byName("Judge Man")), "Barrel Dragon saves its coin flip against a plain body it can just bite");
    // a Summoned Skull must never ram a Dark Magician when a free Bolt takes it instead (the user, 2026-09-24)
    {
      const d = mk([], []); const skull = put(d, 0, 22); put(d, 1, 35);
      const p = d.p[0]; p.skill = 4; win.AI.beginTurn(p); p.hand = [];
      const acts = [];
      for (let i = 0; i < 15; i++) { const r = win.AI.step(d, p); acts.push(r.type); if (r.type === "end") break; }
      ok(acts[0] === "special" && d.p[1].monsters().length === 0 && d.p[0].monsters().includes(skull),
        "a 2500 Summoned Skull bolts a 2500 Dark Magician instead of trading with it (" + acts.join(",") + ")");
    }
    ok(barrel(399) && barrel(725) && barrel(769) && barrel(752), "...and flips it at what battle cannot answer: a killer-taker, a freezer, a bouncer, a Jinzo");
    ok(barrel(byName("Perfectly Ultimate")) && !barrel(48), "...at anything bigger than it, and never at a Sangan");
    // Time Wizard's board wipe asks the same question, and it has to be reachable at all: the specials loop used to
    // skip a monster with no `special`, which is what Time Wizard became when it stopped turning Baby Dragons
    const wizard = (theirIds) => {
      const d = mk([], []); put(d, 0, 16); put(d, 0, byName("Judge Man"));
      for (const t of theirIds) put(d, 1, t);
      const p = d.p[0]; p.skill = 4; win.AI.beginTurn(p); p.hand = [];
      let wiped = false;   // an attack can clear the board too, so watch for the ability itself
      for (let i = 0; i < 15; i++) { const r = win.AI.step(d, p); if (r.type === "special" && r.id === 16) wiped = true; if (r.type === "end") break; }
      return wiped;
    };
    ok(!wizard([byName("Mushroom Man")]), "Time Wizard saves its board wipe against one small body");
    ok(wizard([byName("Judge Man")]) && wizard([1]) && wizard([byName("Mushroom Man"), byName("Dark Gray")]),
      "...and spends it on a body its own size, a bigger one, or two at once");
  }
  // a monster that can take or destroy an enemy monster is never set - it could never use the ability (user, 2026-09-24)
  {
    const posOf = (id) => {
      const d = mk([], []); put(d, 1, 1);
      const p = d.p[0]; p.skill = 4; win.AI.beginTurn(p); p.hand = [id];
      for (let i = 0; i < 10; i++) { const r = win.AI.step(d, p); if (r.type === "end") break; }
      const m = d.p[0].monsters()[0];
      return m ? (m.faceUp ? "up" : "set") : "none";
    };
    ok([16, 756, 376, 166, 641, 743, 26, 40].every((id) => posOf(id) === "up"),
      "the takers and destroyers all come down face up, Reflect Bounder with them");
    ok(Effects.needFaceUp.has(16) && Effects.needFaceUp.has(756) && !Effects.needFaceUp.has(732) && !Effects.needFaceUp.has(428),
      "...read off the ability texts, and Jigen Bakudan (which destroys its OWN side) is not one of them");
    // ...while a small body with nothing to activate is set rather than left standing in attack
    const small = (id, theirLp) => {
      const d = mk([], []); if (theirLp) d.p[1].lp = theirLp;
      const p = d.p[0]; p.skill = 4; win.AI.beginTurn(p); p.hand = [id];
      for (let i = 0; i < 10; i++) { const r = win.AI.step(d, p); if (r.type === "end") break; }
      const m = d.p[0].monsters()[0];
      return m ? m.pos : "none";
    };
    ok(small(428) === "def" && small(byName("Koumori Dragon")) === "atk",
      "a 300 ATK Magician of Faith is set against an empty field, a 1500 body is not");
    ok(small(428, 200) === "atk", "...unless those 300 points are the duel");
  }
}
// --- the second monster patch (2026-09-22)
{
  const { AI } = win;
  // freezes last one enemy turn; Millennium Shield stops the first attack of a turn; Wing Egg Elf hides behind a friend
  // the freezers do nothing while they stand: they take the enemy's next attack phase with them when they fall
  const d1 = mk([], []); const snake = put(d1, 0, 36); put(d1, 1, 1);
  ok(!Effects.special[36] && Effects.passive[36].includes("cannot attack"), "The Snake Hair has no ability to activate, only the promise it leaves behind");
  d1.endTurn();                                                    // their turn: the Blue-eyes cuts it down
  ok(d1.attack(d1.p[1], 0, d1.p[0].mon.indexOf(snake)).ok && d1.p[1].noAttack === 2, "cutting one down in battle locks the attacker's next turn");
  d1.endTurn(); d1.endTurn();                                      // back round to them
  ok(!d1.canAttackWith(d1.p[1], 0).ok, "...they cannot attack with anything that turn");
  d1.endTurn(); d1.endTurn(); ok(d1.canAttackWith(d1.p[1], 0).ok, "...and are free the turn after");
  // Red Archery Girl sends an arrow after whoever cut her down, on top of the lock
  const d1c = mk([], []); const girl = put(d1c, 0, 725); const killer = put(d1c, 1, 1);
  const was = d1c.atk(killer);
  d1c.endTurn();
  ok(d1c.attack(d1c.p[1], d1c.p[1].mon.indexOf(killer), d1c.p[0].mon.indexOf(girl)).ok, "the Blue-eyes cuts her down");
  ok(d1c.atk(killer) === was - 500, "...and carries the arrow: 500 ATK off, for good (" + d1c.atk(killer) + ")");
  ok(d1c.p[1].noAttack === 2, "...and still loses its next attack phase");
  // an effect that destroys one instead pays nothing
  const d1b = mk([], []); put(d1b, 0, 36); put(d1b, 1, 8);
  d1b.destroyMonster(d1b.p[0].mon[0], "special");
  ok(d1b.p[1].noAttack === 0, "destroyed by anything but battle, it takes nothing with it");
  const d2 = mk([], []); put(d2, 0, 1); put(d2, 0, 24); put(d2, 1, 362, "def"); put(d2, 1, 8); const r2 = d2.attack(d2.p[0], 0, 1); ok(r2.ok && r2.negated && d2.p[1].monsters().length === 2, "Millennium Shield stops the first attack");
  ok(d2.attack(d2.p[0], 1, 1).ok && d2.p[1].monsters().length === 2 && d2.p[1].lp === 8000, "...the second attack goes through (Skull Servant bounces off Mushroom Man)");
  const d3 = mk([], []); put(d3, 0, 1); put(d3, 1, 264); put(d3, 1, 8); ok(!d3.canTarget(d3.p[1].mon[0]) && !d3.attack(d3.p[0], 0, 0).ok && d3.canAttackWith(d3.p[0], 0).ok, "Wing Egg Elf cannot be attacked beside another monster (and the attack is not spent)");
  // Binding Chain seals enemy monster effects: Kuriboh on the field, Pumpking's aura, SPCL abilities
  const d4 = mk([], []); put(d4, 0, 584); put(d4, 0, 1); put(d4, 1, 58); const z = put(d4, 1, byName("Dragon Zombie")); put(d4, 1, 99);
  ok(d4.negated(z) && d4.atk(z) === 1600 && !d4.special(d4.p[1], 2).ok, "Binding Chain: Pumpking's aura and SPCL are sealed");
  d4.attack(d4.p[0], 1, 0); ok(d4.p[1].lp === 8000 - 2700, "...and the enemy Kuriboh no longer shields (Blue-eyes hits for 2700 over it)");
  // B.eye Silv. Zombie makes enemy monsters Zombies; Eyearmor copies stats; Lady of Faith heals on spells; Toon Mermaid is a free special summon
  const d5 = mk([], []); const bw = put(d5, 1, 1); put(d5, 0, 139); ok(bw.ty === "Zombie", "B.eye Silv. Zombie: the enemy Blue-eyes is a Zombie");
  const d6 = mk([], []); const ey = put(d6, 0, 185); put(d6, 1, 1); ok(d6.special(d6.p[0], 0).ok && d6.atk(ey) === 3000 && d6.def(ey) === 2500, "Eyearmor copies Blue-eyes' 3000/2500");
  const d7 = mk([338], []); put(d7, 0, 612); d7.activate(d7.p[0], { hand: 0 }); ok(d7.p[0].lp === 8000 + 200 + 500, "Lady of Faith: 500 LP on top of the spell's heal");
  const d8 = mk([728, 4], []); d8.summon(d8.p[0], 1, "atk");
  ok(d8.canSummon(d8.p[0], 0).ok && d8.summon(d8.p[0], 0, "atk", [0]).ok && d8.p[0].monsters().length === 1 && d8.p[0].monsters()[0].id === 728,
    "Toon Mermaid arrives after the normal summon, by offering what was summoned");
  // once per duel: Summoned Skull shares the rule with its copies; the mirrors stop the enemy's next attacks
  const d9 = mk([], []); const mir = put(d9, 0, 103); put(d9, 1, 1);
  d9.endTurn();
  ok(d9.attack(d9.p[1], 0, d9.p[0].mon.indexOf(mir)).ok && d9.p[1].noAttack === 2, "the mirrors share the same rule now: break one and lose your next attack phase");
  ok(Effects.locksAttacks.size === 17 && [36, 42, 103, 129, 134, 260, 261, 610, 725, 733, 740].every((id) => Effects.locksAttacks.has(id) && !Effects.special[id]), "all seventeen of the freeze family carry it and none of them activates");
  // ...and none of them is ALSO bait: that charged the attacker for the same effect twice and made them untouchable
  ok([...Effects.locksAttacks].every((id) => !Effects.bait.has(id)), "the freeze family is priced once, by the lock and not by bait as well");
  {
    // the proof that matters: a 2200 body attacks a set Nemuriko, and a 1300 one still leaves a 1700 DEF wall alone
    const sets = (tid, atk) => {
      const d = mk([], []); d.endTurn(); d.endTurn();          // nobody may attack on turn 1
      put(d, 0, atk); const t = put(d, 1, tid, "def"); t.faceUp = false; t.summonTurn = 0;
      const pl = d.p[0]; pl.skill = 4; AI.beginTurn(pl);
      pl.hand = [];                                            // one attacker, one target, nothing else to do
      for (let i = 0; i < 10; i++) { const r = AI.step(d, pl); if (r.type === "end") break; }
      return d.p[1].monsters().length === 0;   // `live` still says yes for a monster that has left the field
    };
    const JUDGE = byName("Judge Man");
    ok(sets(129, JUDGE) && sets(725, JUDGE) && sets(733, JUDGE), "a Judge Man cuts down a set Nemuriko, Red Archery Girl and the Idol");
    ok(!sets(531, byName("Mystic Horseman")), "...and a 1300 body still leaves the 1700 DEF Mystical Sand alone");
  }
  // calling a monster from outside the deck is once per duel, even with a second copy of the caller
  const dW = mk([], []); put(dW, 0, 249); put(dW, 0, 249); ok(dW.special(dW.p[0], 0).ok && dW.p[0].mon.some((m) => m && m.id === 442), "Water Omotics calls Aqua Dragon");
  ok(!dW.special(dW.p[0], 1).ok && dW.special(dW.p[0], 1).why === "Once per duel", "...and neither copy can call another this duel");
  // AI: a hand Muka Muka (600 printed, 3000 on the field) is not fused away into a 2000 monster
  const mm = 516, partner = CardDB.all.find((c) => c.kind === "M" && CardDB.fuse(mm, c.id) && CardDB.get(CardDB.fuse(mm, c.id)).atk <= 2200);
  if (partner) { const dA = mk([mm, partner.id, 8, 8], []); const pa = dA.p[0]; pa.skill = 3; AI.beginTurn(pa); const ta = []; for (let i = 0; i < 6; i++) { const r = AI.step(dA, pa); ta.push(r.type); if (r.type === "end") break; }
    ok(pa.hand.includes(mm) || pa.mon.some((m) => m && m.id === mm), "the AI keeps Muka Muka instead of fusing it into " + CardDB.get(CardDB.fuse(mm, partner.id)).name + " (" + ta.join(",") + ")"); }
  // AI: Reflect Bounder is attacked when the LP can take it, by the cheapest monster that beats it
  const dB = mk([], []); put(dB, 0, byName("Gaia The Fierce Knight")); put(dB, 0, byName("Judge Man")); put(dB, 1, 756); const pb = dB.p[0]; pb.skill = 3; AI.beginTurn(pb); const tb = []; for (let i = 0; i < 8; i++) { const r = AI.step(dB, pb); tb.push(r.type); if (r.type === "end") break; }
  ok(dB.p[1].monsters().length === 0 && dB.p[0].lp === 8000 - 2200, "the AI kills Reflect Bounder with Judge Man (2200) rather than Gaia (2300) (" + tb.join(",") + ", LP " + dB.p[0].lp + ")");
  // AI: Cyber-Stein fires with a ritual card in the deck and no offerings anywhere
  const dC = mk([], []); put(dC, 0, 420); dC.p[0].deck = [675, 8, 8, 8, 8, 8]; const pc = dC.p[0]; pc.skill = 3; AI.beginTurn(pc); const tc = []; for (let i = 0; i < 8; i++) { const r = AI.step(dC, pc); tc.push(r.type); if (r.type === "end") break; }
  ok(pc.mon.some((m) => m && m.id === 380) && pc.lp === 8000, "the AI's Cyber-Stein summons Ultimate Dragon from the deck's ritual card (" + tc.join(",") + ")");
}
// --- starter decks: every roll of every theme sits inside the power band, and carries its three power cards
{
  const { Starters, Banlist } = win;
  const POWER_SPELLS = [337, 336, 348, 661, 672, 789, 784, 781, 342], POWER_TRAPS = [814, 686, 685, 815, 684];
  let bad = [];
  for (const t of Starters.THEMES) for (let i = 0; i < 20; i++) {
    const r = Starters.roll(t.key), d = r.deck, count = {}; for (const id of d) count[id] = (count[id] || 0) + 1;
    const mons = d.map((id) => CardDB.get(id)).filter((c) => c.kind === "M");
    const boss = mons.filter((c) => c.atk > Starters.BAND.maxAtk);
    const problems = [];
    if (r.fallback) problems.push("fallback");
    if (d.length !== 40) problems.push("size " + d.length);
    if (Object.keys(count).some((id) => count[id] > Banlist.limit(Number(id)))) problems.push("over the limit");
    if (r.m.avgAtk < Starters.BAND.atkMin - 120 || r.m.avgAtk > Starters.BAND.atkMax + 220) problems.push("avg ATK " + r.m.avgAtk);
    if (r.m.fusions < Starters.BAND.fusions) problems.push("fusions " + r.m.fusions);
    if (r.m.bonus > Starters.BAND.bonus + 1400) problems.push("effects " + r.m.bonus);   // the power spell carries its own worth
    // the theme's own boss, plus the strong body every starter is handed - so two over the band, and the gift may be
    // bigger than a boss is allowed to be
    const gift = Starters.strongMonsters();
    const big = boss.filter((c) => !gift.some((g) => g.id === c.id));
    if (big.length > 1 || big.some((c) => c.atk > Starters.BAND.bossMax)) problems.push("bosses " + big.map((c) => c.atk));
    if (!boss.some((c) => gift.some((g) => g.id === c.id))) problems.push("no strong monster");
    if (!d.some((id) => POWER_SPELLS.includes(id))) problems.push("no power spell");
    if (!d.some((id) => POWER_TRAPS.includes(id))) problems.push("no power trap");
    if (!d.includes(t.field) || !t.equips.some((e) => d.includes(e))) problems.push("no field/equip");
    if (mons.filter((c) => t.types.includes(c.ty)).length < 15) problems.push("off theme");
    if (problems.length) bad.push(t.key + ": " + problems.join(", "));
  }
  ok(bad.length === 0, "180 starter rolls all fit the band: " + bad.slice(0, 3).join(" | "));
  const three = Starters.rollThree(); ok(three.length === 3 && new Set(three.map((r) => r.theme.key)).size === 3 && three.every((r) => r.cards.length === 3), "rollThree offers three different themes with signature cards");
}
// --- the Normal / Effect split: every monster with an ability, a passive or a trigger counts as an effect monster
{
  const trig = new Set([...Object.keys(Effects.onDestroy), ...Object.keys(Effects.onDiscard), ...Effects.direct, ...Effects.substitute,
    ...Effects.untargetable, ...Object.keys(Effects.freeSummon), ...Object.keys(Effects.evolve)].map(Number));
  const noText = [...trig].filter((id) => !Effects.isEffect(id));
  ok(noText.length === 0, "every trigger monster carries Effect or SPCL text: " + noText.join(","));
  const mons = CardDB.all.filter((c) => c.kind === "M");
  const fx = mons.filter((c) => Effects.isEffect(c.id));
  ok(fx.length >= 170, "the game has " + fx.length + " effect monsters");
  const slipped = mons.filter((c) => !Effects.isEffect(c.id) && (trig.has(c.id) || Effects.passive[c.id] || Effects.special[c.id] || Effects.special2[c.id]));
  ok(slipped.length === 0, "no effect monster is left in the Normal group: " + slipped.map((c) => c.name).join(","));
  ok(!Effects.isEffect(8) && Effects.isEffect(48) && Effects.isEffect(58) && Effects.isEffect(516) && Effects.isEffect(2) && Effects.isEffect(397), "Mushroom Man is normal; Sangan, Kuriboh, Muka Muka, Mystical Elf and Leghul are effect monsters");
}
// --- the AI never offers a monster that is worth more than what it summons
{
  const { AI } = win;
  function turn(fieldIds, handIds) {
    const d = mk(handIds, []); const a = d.p[0]; a.skill = 3;
    fieldIds.forEach((id) => put(d, 0, id));
    AI.beginTurn(a); const acts = [];
    for (let i = 0; i < 12; i++) { const r = AI.step(d, a); acts.push(r.type); if (r.type === "end") break; }
    return { d, a, acts };
  }
  const r2 = turn([24], [byName("Summoned Skull"), 8, 8, 8, 8]);
  ok(r2.a.mon.some((m) => m && m.id === byName("Summoned Skull")) && r2.a.mon.some((m) => m && m.id === 24), "the AI summons the biggest card in its hand and keeps what is already out");
  const r3 = turn([516, 8], [byName("Summoned Skull"), 8, 8, 8]);
  ok(r3.a.mon.some((m) => m && m.id === 516), "Muka Muka is played out rather than held back");
}
// --- every SPCL ability has a rule in the AI, and fires on a board that suits it
{
  const { AI } = win;
  const ai = require("fs").readFileSync(require("path").join(root, "js/game/ai.js"), "utf8");
  const block = ai.slice(ai.indexOf("// ---- monster specials"), ai.indexOf("st.phase = \"battle\""));
  const decided = new Set();
  for (const m of block.matchAll(/id === (\d+)/g)) decided.add(Number(m[1]));
  for (const m of block.matchAll(/\[([0-9,\s]+)\]\.includes\(id\)/g)) for (const n of m[1].split(",")) decided.add(Number(n.trim()));
  const noRule = Object.keys(Effects.special).map(Number).filter((id) => !decided.has(id));
  ok(noRule.length === 0, "every SPCL ability has an AI rule: " + noRule.map((id) => CardDB.get(id).name).join(","));
  // a spot check that the rules really fire: a board made for each of four very different abilities
  function fires(id, setup) {
    const d = mk([], []); const a = d.p[0]; a.skill = 4; a.hand = []; setup(d, a);
    put(d, 0, id);
    AI.beginTurn(a);
    for (let i = 0; i < 16; i++) { const r = AI.step(d, a); if (r.type === "special" && r.id === id) return true; if (r.type === "end") break; }
    return false;
  }
  ok(fires(1, (d) => put(d, 1, byName("Summoned Skull"))), "Blue-eyes fires its SPCL at an enemy monster");
  ok(fires(224, (d) => { d.p[1].spells[0] = { id: 683, faceUp: false }; }), "Trap Master fires at a set trap");
  ok(fires(48, (d, a) => { a.deck = [byName("Baby Dragon"), 8, 8]; }), "Sangan draws with a thin hand");
  ok(fires(420, (d, a) => { a.deck = [675, 8, 8, 8]; }), "Cyber-Stein pays for the deck's ritual monster");
}
// --- the AI plays around Jinzo and around Parasite Paracide's type change
{
  const { AI } = win;
  const trap = 683; // Bear Trap
  // with Jinzo on the enemy field a set trap would never fire: the AI keeps it in hand and throws it away as dead weight
  const d1 = mk([trap, 8, 8, 8, 8], []); const a1 = d1.p[0]; a1.skill = 3; put(d1, 1, 752);
  AI.beginTurn(a1); const t1 = []; for (let i = 0; i < 14; i++) { const r = AI.step(d1, a1); t1.push(r.type); if (r.type === "end") break; }
  ok(!d1.p[0].spells.some((x) => x && x.id === trap), "no trap is set while Jinzo is out (" + t1.join(",") + ")");
  const d2 = mk([trap, 8, 8, 8, 8], []); const a2 = d2.p[0]; a2.skill = 3;
  AI.beginTurn(a2); for (let i = 0; i < 14; i++) { const r = AI.step(d2, a2); if (r.type === "end") break; }
  ok(d2.p[0].spells.some((x) => x && x.id === trap), "...but it is set once Jinzo is gone");
  // Jinzo itself is summoned sooner when the enemy is sitting on set cards
  const d3 = mk([752, byName("Judge Man")], []); const a3 = d3.p[0]; a3.skill = 3;
  d3.p[1].spells[0] = { id: trap, faceUp: false }; d3.p[1].spells[1] = { id: 686, faceUp: false };
  put(d3, 0, 24); put(d3, 0, 24);
  AI.beginTurn(a3); for (let i = 0; i < 14; i++) { const r = AI.step(d3, a3); if (r.type === "summon") break; if (r.type === "end") break; }
  ok(a3.mon.some((m) => m && m.id === 752), "Jinzo goes down first when the enemy has cards set");
  // Parasite Paracide in the deck makes every monster an Insect, so an Insect equip now fits them
  const d5 = mk([305], []); d5.p[0].deck.push(763); const m5 = put(d5, 0, 1);
  const r5 = d5.activate(d5.p[0], { hand: 0 }, 0);
  ok(r5.ok && !r5.fail && m5.levels === 1, "with Parasite Paracide in the deck an Insect equip fits the Blue-eyes");
  const d6 = mk([305], []); const m6 = put(d6, 0, 1);
  const r6 = d6.activate(d6.p[0], { hand: 0 }, 0);
  ok(r6.ok && r6.fail && m6.levels === 0, "...and is wasted on it without the Parasite");
}
// --- the AI plays the new cards
{
  const { AI, Effects } = win;
  function turn(setup, skill) {
    const d = mk([], []); const a = d.p[0]; a.skill = skill || 3; setup(d, a);
    AI.beginTurn(a); const acts = [];
    for (let i = 0; i < 16; i++) { const r = AI.step(d, a); acts.push(r.type + (r.id ? ":" + r.id : "")); if (r.type === "end") break; }
    return { d, a, acts: acts.join(",") };
  }
  const judge = byName("Judge Man");
  // Cyber Dragon walks out on its own when the field is empty
  const cd = turn((d, a) => { a.hand = [803]; put(d, 1, judge); });
  ok(cd.a.mon.some((m) => m && m.id === 803), "the AI special summons Cyber Dragon onto an empty field (" + cd.acts + ")");
  // Buster Blader and a D. Magician in hand become Dark Paladin
  const bb = turn((d, a) => { put(d, 0, 801); a.hand = [35]; put(d, 1, judge); });
  ok(bb.a.mon.some((m) => m && m.id === 802), "the AI fuses Buster Blader and D. Magician into Dark Paladin (" + bb.acts + ")");
  // and the Paladin hates dragons just as much
  {
    const d = mk([], []); const dp = put(d, 0, 802); put(d, 1, 1); d.p[1].grave.push(4);
    ok(d.atk(dp) === 2900 + 1000, "Dark Paladin: 500 per Dragon out or buried (" + d.atk(dp) + ")");
  }
  // Junk Synchron brings a small monster back, then trades the pair for Junk Warrior
  const js = turn((d, a) => { put(d, 0, 806); a.grave.push(byName("Kuriboh")); put(d, 1, judge); });
  ok(js.a.mon.some((m) => m && m.id === 807) || js.acts.includes("special:806"), "the AI uses Junk Synchron (" + js.acts + ")");
  // Call of the Haunted brings the best monster in the graveyard back
  // even a skill 4 duelist sits on a spell 15% of the time, so this one case is rolled with a fixed die
  const rndCH = Math.random; Math.random = () => 0;
  const ch = turn((d, a) => { a.hand = [813]; a.grave.push(1, 8); put(d, 1, judge); }, 4);
  Math.random = rndCH;
  ok(ch.a.mon.some((m) => m && m.id === 1), "the AI plays Call of the Haunted for the Blue-eyes (" + ch.acts + ")");
  // Mirror Force and Trap Hole are set, not sat on
  const mf = turn((d, a) => { a.hand = [814, 815]; put(d, 1, judge); });
  ok(mf.a.spells.filter(Boolean).length === 2, "the AI sets both new traps (" + mf.acts + ")");
  // Gorz is never thrown away while it can still answer a blow
  {
    const d = mk([], []); const a = d.p[0]; a.skill = 3;
    a.hand = [805, 8, 8, 8, 8];
    const worst = a.hand.map((id) => AI.handValue ? AI.handValue(d, a, id) : null);
    const kept = Effects.bonus[805] !== undefined;
    ok(kept, "Gorz carries a value the AI can weigh");
    AI.beginTurn(a); for (let i = 0; i < 16; i++) { const r = AI.step(d, a); if (r.type === "end") break; }
    ok(a.hand.includes(805) || a.mon.some((m) => m && m.id === 805), "the AI keeps Gorz in hand instead of discarding it");
  }
}
// --- every summoned-only card tells the player where it comes from
{
  const { Banlist } = win;
  const wrap = (str) => { const out = []; let line = ""; for (const w of String(str).split(" ")) { if ((line + (line ? " " : "") + w).length > 18) { out.push(line); line = w; } else line = line ? line + " " + w : w; } out.push(line); return out.length; };
  const only = CardDB.all.filter((c) => Banlist.ritualOnly(c.id));
  const blank = only.filter((c) => !Effects.summonHow(c.id));
  const long = only.filter((c) => wrap(Effects.summonHow(c.id)) > 4);
  ok(only.length >= 80, "the summoned-only list covers the fusions and rituals (" + only.length + ")");
  ok(blank.length === 0, "every summoned-only card says how it is summoned" + (blank.length ? ": " + blank.map((c) => c.id) : ""));
  ok(long.length === 0, "and it fits the card page" + (long.length ? ": " + long.map((c) => c.id) : ""));
  ok(Effects.summonHow(217).includes("fuse"), "B. Skull Dragon points at its fusion, not at a ritual card");
  ok(Effects.summonHow(731).includes("Black Illusion Ritual"), "Relinquished still names its ritual card");
  ok(Effects.summonHow(392).includes("Metalmorph"), "Metalzoa names the equip that makes it");
  ok(Effects.summonHow(370).includes("Labyrinth Wall"), "the maze monsters point at the wall that calls them");
  ok(Effects.summonHow(802).includes("fuse"), "Dark Paladin names the pieces it is fused from");
  ok(Effects.summonHow(807).includes("any monster"), "Junk Warrior takes anything with it");
  ok(!Effects.summonHow(8), "an ordinary card has no summon line");
}
// --- the cards the remake adds (801-815)
{
  const { Banlist, AI } = win;
  // Buster Blader counts every Dragon on either side, field and graveyard
  {
    const d = mk([], []); const bb = put(d, 0, 801);
    ok(d.atk(bb) === 2600, "Buster Blader starts at 2600");
    put(d, 1, 1);                                   // an enemy Blue-eyes
    d.p[0].grave.push(4); d.p[1].grave.push(82);    // a Baby Dragon and a Red-eyes in the graveyards
    ok(d.atk(bb) === 2600 + 1500, "Buster Blader: 500 per Dragon on the fields and in the graves (" + d.atk(bb) + ")");
  }
  // Buster Blader and D. Magician fold into Dark Paladin, from the field or from the hand
  {
    ok(CardDB.fuse(35, 801) === 802, "D. Magician + Buster Blader = Dark Paladin");
    const d = mk([35, 801], []);
    const r = d.fuseHand(d.p[0], 0, 1);
    ok(r.ok && r.result === 802 && d.p[0].hand.length === 1 && d.p[0].hand[0] === 802, "the pair fuses in the hand");
    const e = mk([35], []); put(e, 0, 801);
    ok(e.fuseField(e.p[0], 0, 0).ok && e.p[0].mon.filter(Boolean).length === 1 && e.p[0].mon.some((m) => m && m.id === 802), "or onto the Buster Blader already out");
    ok(!Effects.special[801] && !Effects.special2[35], "neither piece carries an offering ability any more");
  }
  // Dark Paladin throws a card away to stop an enemy spell, once a turn
  {
    const d = mk([], [8, 8]); put(d, 1, 802); d.p[0].hand = [337];   // Raigeki against a Paladin
    put(d, 1, 4);
    const r = d.activate(d.p[0], { hand: 0 });
    ok(r.ok && r.negated, "Dark Paladin negates the spell");
    ok(d.p[1].hand.length === 1 && d.p[1].mon.some((m) => m && m.id === 4), "it cost a card from the hand and the board survived");
    d.p[0].hand = [337];
    ok(!d.activate(d.p[0], { hand: 0 }).negated, "only once in a turn");
  }
  // Junk Synchron pulls a small monster back, then folds into Junk Warrior
  {
    const d = mk([], []); const js = put(d, 0, 806);
    d.p[0].grave.push(byName("Summoned Skull"));
    ok(d.special(d.p[0], d.p[0].mon.indexOf(js)).ok && d.p[0].mon.some((m) => m && m.id === byName("Summoned Skull")), "Junk Synchron revives a monster whatever its size");
    ok(CardDB.fuse(806, 8) === 807 && CardDB.fuse(806, 1) === 807, "Junk Synchron plus any monster = Junk Warrior");
    const e = mk([806, 8], []);
    ok(e.fuseHand(e.p[0], 0, 1).result === 807, "the pair fuses in the hand");
    const f = mk([], []); const jw = put(f, 0, 807); put(f, 0, byName("Summoned Skull")); put(f, 0, byName("Kuriboh"));
    f.p[0].grave.push(8, 8, 336);                         // two monsters and a spell: the spell does not count
    ok(f.atk(jw) === 2300 + 100 * 5, "Junk Warrior gains 100 ATK per monster out or buried (" + f.atk(jw) + ")");
  }
  // the two that walk out of the hand on their own
  {
    const d = mk([803], []); d.p[0].summoned = true;
    ok(d.canSummon(d.p[0], 0).ok && d.canSummon(d.p[0], 0).free && d.canSummon(d.p[0], 0).need === 0, "Cyber Dragon walks out on its own, summon spent or not");
    put(d, 0, 4); ok(d.canSummon(d.p[0], 0).ok, "...and it does not care what else is on the field either (the user's rework, 2026-09-24)");
    const dm = mk([755], []); dm.p[0].summoned = true;
    ok(dm.canSummon(dm.p[0], 0).ok && dm.canSummon(dm.p[0], 0).need === 0, "The Fiend Megacyber puts itself out for nothing as well");
    ok(Banlist.limit(803) === 1 && Banlist.limit(755) === 1, "...and both are Limited to one for it");
    const e = mk([804], []); put(e, 1, 4); e.p[0].summoned = true;
    const dino = e.canSummon(e.p[0], 0);
    ok(dino.ok && dino.free && dino.need === 0, "Cyber Dinosaur puts itself out for nothing too, whatever they have (the user's rework, 2026-09-24)");
    ok(Banlist.limit(804) === 1, "...and the 2500 ATK ceiling already holds it to one");
    ok(Object.keys(Effects.condFree).length === 0, "nothing is left on the conditional free summon table");
  }
  // Gorz answers a blow taken on an empty field
  {
    const d = mk([805], []); const m = put(d, 1, 1);
    d.p[1].mon[d.p[1].mon.indexOf(m)] = m; d.endTurn();          // the enemy's turn
    d.attack(d.p[1], d.p[1].mon.indexOf(m), null);
    ok(d.p[0].mon.some((x) => x && x.id === 805) && !d.p[0].hand.length, "Gorz comes out of the hand the moment the blow lands");
  }
  // Call of the Haunted brings the best monster back
  {
    const d = mk([813], []); d.p[0].grave.push(4, 1);
    ok(d.activate(d.p[0], { hand: 0 }).ok, "Call of the Haunted is played");
    ok(d.p[0].mon.some((m) => m && m.id === 1), "the Blue-eyes walks back on");
  }
  // Mirror Force answers one attack by clearing the attacking field
  {
    const d = mk([], []); const a1 = put(d, 0, 1); put(d, 0, byName("Judge Man")); put(d, 0, 4, "def");
    d.p[1].spells[0] = { id: 814, faceUp: false }; put(d, 1, 8);
    d.attack(d.p[0], d.p[0].mon.indexOf(a1), 0);
    const left = d.p[0].monsters();
    ok(left.length === 1 && left[0].id === 4, "Mirror Force: every attack-position monster falls, the defender stays");
  }
  // Trap Hole swallows a big newcomer, and lets a small one through
  {
    const d = mk([], [1]); d.p[0].spells[0] = { id: 815, faceUp: false };
    d.endTurn();                                                  // the enemy's turn
    d.p[1].hand = [4]; d.summon(d.p[1], 0, "atk");
    ok(d.p[1].mon.some((m) => m && m.id === 4) === false || d.p[1].monsters().length === 0, "Trap Hole takes a 1200 ATK summon");
    const e = mk([], []); e.p[0].spells[0] = { id: 815, faceUp: false };
    e.endTurn(); e.p[1].hand = [byName("Kuriboh")]; e.summon(e.p[1], 0, "atk");
    ok(e.p[1].monsters().length === 1, "a 300 ATK summon walks past it");
  }
  // White-Horned Dragon drinks the magic the enemy has spent
  {
    const d = mk([], []); const wh = put(d, 0, 808);
    ok(d.atk(wh) === 2200, "White-Horned Dragon starts at 2200");
    d.p[1].grave.push(337, 336, 4);
    ok(d.atk(wh) === 2200 + 600, "300 per spell in the enemy graveyard, monsters do not count (" + d.atk(wh) + ")");
  }
}
// --- a wall that kills its attacker does not get to stop the whole field, and Cyber-Stein is spent by anyone holding it
{
  const { AI } = win;
  function turn(setup, skill) {
    const d = mk([], []); const a = d.p[0]; a.skill = skill || 3; setup(d, a);
    AI.beginTurn(a); const acts = [];
    for (let i = 0; i < 20; i++) { const r = AI.step(d, a); acts.push(r.type); if (r.type === "end") break; }
    return { d, a, acts: acts.join(",") };
  }
  const axe = byName("Axe Raider"); // 1700 vanilla
  // five attackers against one Steel Scorpion (250/300, takes its killer with it): one buys the way through
  const w = turn((d) => { for (let i = 0; i < 5; i++) put(d, 0, axe); put(d, 1, 394, "def"); });
  ok(w.d.p[1].monsters().length === 0, "the Steel Scorpion wall is broken instead of stopping five monsters");
  ok(w.d.p[1].lp <= 8000 - 1700 * 3, "and the monsters left over hit the Life Points directly (" + w.d.p[1].lp + ")");
  // a single monster does not throw itself away on the same wall
  const one = turn((d) => { put(d, 0, axe); put(d, 1, 394, "def"); });
  ok(one.d.p[1].monsters().length === 1 && one.d.p[0].monsters().length === 1, "one monster alone leaves the wall alone");
  // Cyber-Stein: the ritual monster in the deck, even a printed 0/0 Relinquished - but only from skill 2 (stage 2
  // and up), and only when there is a monster worth absorbing, since the body itself is nothing
  const st = turn((d, a) => { put(d, 0, 420); put(d, 1, byName("Judge Man")); a.deck = [783].concat(new Array(39).fill(8)); }, 2);
  ok(st.a.lp === 8000 && (st.a.mon.some((m) => m && m.id === 731) || st.d.p[1].monsters().length === 0), "a skill 2 duelist uses Cyber-Stein for Relinquished, at no cost (" + st.acts + ")");
  const st2 = turn((d, a) => { put(d, 0, 420); a.deck = [783].concat(new Array(39).fill(8)); }, 2);
  ok(st2.a.lp === 8000 && !st2.a.mon.some((m) => m && m.id === 731), "and keeps the 5000 LP while the enemy field is empty: a 0 ATK Relinquished would just be run over");
  const st3 = turn((d, a) => { put(d, 0, 420); put(d, 1, byName("Judge Man")); a.deck = [783].concat(new Array(39).fill(8)); }, 1);
  ok(st3.a.lp === 8000, "a skill 1 rookie never pays 5000 LP for it (" + st3.acts + ")");
}
// --- a monster whose own special makes it bigger is summoned face-up and fires it at once
{
  const { AI } = win;
  function turn(handA, enemyIds, skill) {
    const d = mk(handA, []); const a = d.p[0]; a.skill = skill || 3;
    for (const id of enemyIds) put(d, 1, id);
    AI.beginTurn(a); const acts = [];
    for (let i = 0; i < 14; i++) { const r = AI.step(d, a); acts.push(r.type); if (r.type === "end") break; }
    return { d, a, acts: acts.join(",") };
  }
  const judge = byName("Judge Man"); // 2200 vanilla
  {                                  // Eyearmor: a 600 ATK body that copies the strongest enemy
    const d = mk([185], []); const a = d.p[0]; a.skill = 3;
    put(d, 1, judge);
    AI.beginTurn(a);
    const acts = []; let posAfterSummon = "", upAfterSummon = false, copied = 0;
    for (let i = 0; i < 14; i++) {
      const r = AI.step(d, a); acts.push(r.type);
      const eye = a.mon.find((m) => m && m.id === 185);
      if (r.type === "summon" && eye) { posAfterSummon = eye.pos; upAfterSummon = eye.faceUp; }
      if (r.type === "special" && eye && eye.mimic) copied = eye.mimic.atk;
      if (r.type === "end") break;
    }
    ok(posAfterSummon === "atk" && upAfterSummon, "Eyearmor is summoned face-up, not set: its special makes it a match for their best");
    ok(copied === 2200, "Eyearmor copies the strongest enemy the turn it lands");
    ok(acts.includes("attack") && !d.p[1].mon.some((m) => m && m.id === judge), "and then trades with it");
  }
  // a 1000 ATK vanilla in the same spot still goes face-down
  const v = turn([byName("Ryu-kishin")], [judge]);
  const set = v.a.mon.find((m) => m);
  ok(!!set && set.pos === "def" && !set.faceUp, "a plain weak monster is still set in defence");
}
// --- equal ATK: the AI trades monsters instead of standing still
{
  const { AI } = win;
  function play(mine, theirs, extraMine) {
    const d = mk([], []); const a = d.p[0]; a.skill = 3; a.hand = [];
    const M = put(d, 0, mine); if (extraMine) put(d, 0, extraMine);
    const T = put(d, 1, theirs);
    AI.beginTurn(a); const acts = [];
    for (let i = 0; i < 12; i++) { const r = AI.step(d, a); acts.push(r.type); if (r.type === "end") break; }
    return { traded: !d.p[1].mon.includes(T) && !a.mon.includes(M), acts: acts.join(",") };
  }
  const judge = byName("Judge Man"); // 2200 vanilla
  ok(play(judge, judge).traded, "two 2200 monsters trade: the AI attacks into the same ATK");
  // every even trade is taken, whatever the two cards are worth (Reflect Bounder is worth far more than a vanilla 1700)
  ok(play(756, byName("Axe Raider")).traded, "an even trade happens even when our card is the better one");
  // an even trade that clears their last blocker for a second attacker is taken too
  ok(play(judge, judge, byName("Mushroom Man")).traded, "the trade is taken when it opens the way for another attacker");
}
// --- a flawless duel: the Life Points never moved
{
  const d = mk([], []); put(d, 0, 1); put(d, 1, 8);
  d.attack(d.p[0], 0, 0);
  ok(!d.p[0].stats.tookDamage && d.p[1].stats.tookDamage, "the attacker is untouched, the defender is not");
  // Kuriboh eating a hit keeps the record clean
  const d2 = mk([58], []); put(d2, 1, 1); d2.endTurn(); d2.attack(d2.p[1], 0, null);
  ok(!d2.p[0].stats.tookDamage && d2.p[0].lp === 8000, "a Kuriboh in the hand keeps the duel flawless");
  // a cost paid in Life Points still breaks a flawless run - no card charges one today, so the engine is asked directly
  const d3 = mk([], []); put(d3, 0, 58);              // a Kuriboh on the field may not shield a cost
  d3.damage(d3.p[0], 500, "cost");
  ok(d3.p[0].stats.tookDamage && d3.p[0].lp === 7500 && d3.p[0].monsters().length === 1, "Life Points paid as a cost count as damage, and no Kuriboh takes the hit");
  // the bounce damage from a defending monster counts too
  const d4 = mk([], []); put(d4, 0, 8); put(d4, 1, byName("Labyrinth Wall"), "def");
  d4.attack(d4.p[0], 0, 0);
  ok(d4.p[0].stats.tookDamage, "bouncing off a wall counts");
  ok(win.Shop.FLAWLESS === 3, "a flawless win multiplies the whole bill by three");
}
// --- the bill a won duel adds up to
{
  const { Bonus } = win;
  const row = (e, n) => { const r = e.rows.find((x) => x.name === n); return r ? r.amount : 0; };
  // a single 3000 ATK swing to the face
  const d = mk([], []); put(d, 0, 1);
  d.attack(d.p[0], 0, null);
  const e = Bonus.forDuel(d, { payout: 500 });
  ok(row(e, "Victory") === 500, "beating the duelist is the first line of the bill");
  ok(row(e, "Damage") === 30, "damage dealt pays 1 Domino per 100");
  ok(row(e, "All battle") === 50 && row(e, "Effect dmg") === 0, "damage that was all battle damage pays its own bonus");
  ok(row(e, "Max ATK") === 30 && row(e, "Big hit") === 30, "a 3000 ATK attacker and a 3000 point hit each pay");
  ok(row(e, "No spells") === 100 && row(e, "No traps") === 50 && row(e, "No specials") === 100, "using none of them pays as well");
  ok(row(e, "No damage") === 50, "an untouched duelist is paid for it");
  ok(e.mult === 1 && e.total === e.bonus, "an ordinary win is not multiplied");
  const f = Bonus.forDuel(d, { payout: 500, flawless: true });
  ok(f.mult === 3 && f.total === f.bonus * 3, "a flawless duel triples the whole bill");
  ok(f.cards === Math.min(3, Math.floor(f.total / Bonus.CARD_STEP)), "the bill shakes extra cards loose, up to three");
  // offerings live on ritual cards now that nothing else is paid for, and a monster destroyed in battle
  const d2 = mk([670], []); put(d2, 0, 38); put(d2, 1, byName("Kuriboh"));
  d2.activate(d2.p[0], { hand: 0 });                       // Black Luster Ritual: Gaia is offered for it
  d2.attack(d2.p[0], d2.p[0].mon.findIndex((m) => m && m.id === 364), 0);
  const e2 = Bonus.forDuel(d2, { payout: 0 });
  ok(row(e2, "Offerings") === 30, "a monster offered for a ritual pays its way");
  ok(row(e2, "Destroyed") === 20, "every monster destroyed in battle pays too");
  ok(row(e2, "Rituals") === 100 && row(e2, "No specials") === 0, "a ritual summon is a special summon");
  // effect damage only, and a finish that lands on exactly 0
  const d3 = mk([], []); d3.p[1].lp = d3.p[1].startLp = 500;
  d3.damage(d3.p[1], 500, "reflect");
  const e3 = Bonus.forDuel(d3, { payout: 0 });
  ok(row(e3, "Effect dmg") === 150 && row(e3, "All battle") === 0, "a duel won with effects pays the other way round");
  ok(row(e3, "Exact 0 LP") === 50, "the last blow landing for exactly the rest pays");
  // Exodia, with an empty deck behind it
  const d4 = mk([], []); d4.p[0].hand = [17, 18, 19, 20]; d4.p[0].deck = [21];
  d4.drawCard(d4.p[0]);
  const e4 = Bonus.forDuel(d4, { payout: 0 });
  ok(d4.reason === "exodia" && row(e4, "Exodia!") === 500, "Exodia pays its own bonus");
  ok(row(e4, "Deck empty") === 400, "finishing on an empty deck pays too");
  // a turn that starts from behind
  const d5 = mk([], []); d5.damage(d5.p[0], 4000, "battle"); d5.endTurn(); d5.endTurn();
  ok(row(Bonus.forDuel(d5, { payout: 0 }), "Comeback") === 100, "a turn begun from behind pays a comeback bonus");
  // Life Points paid for a card of your own are not damage dealt by anybody
  const d6 = mk([], []); put(d6, 0, 420); d6.p[0].deck = [675, 8, 8];
  d6.special(d6.p[0], 0);
  ok(row(Bonus.forDuel(d6, { payout: 0, me: 1 }), "Damage") === 0, "a cost the enemy paid is not damage you dealt");
  ok(row(Bonus.forDuel(d6, { payout: 0 }), "No specials") === 0, "Cyber-Stein's ritual monster arrives as a special summon");
}
// --- the Free Duel challengers
{
  const { Banlist } = win;
  const free = Duelists.all.filter((d) => d.free);
  ok(free.length === 8 && free.every((d) => d.gen && d.intro && d.win && d.lose), "eight challengers, each with a deck spec and dialogue");
  const duo = Duelists.byKey.para;
  ok(duo.duo && duo.duo.key === "dox" && duo.duo.intro && duo.duo.win && duo.duo.lose && !Duelists.byKey.dox, "Para & Dox are one opponent with a second speaker");
  // every deck that runs a ritual card also runs the Cyber-Stein that can pay for it
  const ritualists = Duelists.all.filter((d) => Duelists.deck(d, 0).some((id) => CardDB.get(id).kind === "R"));
  ok(ritualists.length >= 8 && ritualists.every((d) => Duelists.deck(d, 0).includes(420)), "every ritual deck carries a Cyber-Stein (" + ritualists.length + " decks)");
  const sharp = ritualists.filter((d) => Duelists.deck(d, 99, { skill: 4, max: true }).filter((id) => id === 420).length === 1);
  ok(sharp.length === ritualists.length, "the Stein is Limited, so even a maxed ritual deck carries exactly one (" + sharp.length + "/" + ritualists.length + ")");
  ok(Duelists.all.filter((d) => !d.gen).some((d) => Duelists.deck(d, 0).some((id) => CardDB.get(id).kind === "R")), "the guide decks' ritual monsters became their ritual cards");
  const inStage = free.filter((d) => Duelists.STAGES[d.stage].keys.includes(d.key));
  ok(inStage.length === 0, "no challenger sits on a campaign map: " + inStage.map((d) => d.key).join(","));
  for (const d of free) {
    const deck = Duelists.deck(d, 0), count = {};
    for (const id of deck) count[id] = (count[id] || 0) + 1;
    const over = Object.keys(count).filter((id) => count[id] > Banlist.limit(Number(id)));
    ok(deck.length === 40 && over.length === 0, d.name + "'s deck is 40 legal cards" + (over.length ? " (over: " + over + ")" : ""));
    const core = (d.gen.core || []).map(([id]) => id).filter((id) => Duelists.mayHold(d, id));
    ok(core.every((id) => deck.includes(id)), d.name + " keeps every card of their own that they are written with");
    ok(Duelists.deck(d, 3).length === 40, d.name + " still has 40 cards after three rematches");
    ok(Duelists.drops(d).length > 0, d.name + " drops cards");
  }
  // Pegasus's Toons, the brothers' Gate Guardian, Solomon's Exodia
  ok(Duelists.deck(Duelists.byKey.pegasus, 0).filter((id) => [727, 728, 729, 767].includes(id)).length >= 3, "Pegasus brings his Toons (one of each now that they are Limited)");
  ok([371, 372, 373, 667].every((id) => Duelists.deck(Duelists.byKey.para, 0).includes(id)), "Para brings Gate Guardian and its three offerings");
  ok([17, 18, 19, 20, 21].every((id) => Duelists.deck(Duelists.byKey.solomon, 0).includes(id)), "Solomon brings all five Exodia pieces");
  // an AI holding Exodia never plays or throws away a piece
  const d = mk([], []); const a = d.p[0]; a.skill = 4; a.hand = [17, 18, 19, 20, 8]; a.deck = new Array(20).fill(8);
  const piece = (x) => x >= 17 && x <= 21;
  const before = a.hand.filter(piece).length;
  win.AI.beginTurn(a); for (let i = 0; i < 20; i++) { const r = win.AI.step(d, a); if (r.type === "end") break; }
  ok(a.hand.filter(piece).length === before && !a.grave.some(piece) && !a.mon.some((m) => m && piece(m.id)), "the AI keeps every Exodia piece in hand");
  const d2 = mk([], []); d2.p[1].hand = [17, 18, 19, 20]; d2.p[1].deck = [21]; d2.endTurn();
  ok(d2.winner === 1 && d2.reason === "exodia", "...and wins the moment it draws the fifth");
}
// --- data sanity
{
  const mons = CardDB.all.filter((c) => c.kind === "M");
  ok(mons.every((c) => c.atk >= 0 && c.def >= 0 && c.lv >= 1 && c.lv <= 12 && c.el && c.ty), "all monsters have stats");
  ok(CardDB.all.every((c) => /^\d{8}$/.test(c.code)), "all cards have 8 digit passwords");
  const codes = new Set(CardDB.all.map((c) => c.code)); ok(codes.size === CardDB.all.length, "passwords unique");
  ok(CardDB.byCode("89631139").id === 1, "BEWD password");
  ok(Object.keys(Effects.magic).length >= 70, "magic effects defined: " + Object.keys(Effects.magic).length);
  const noEffect = CardDB.all.filter((c) => c.kind === "S" && !Effects.magic[c.id]).map((c) => c.id + ":" + c.name);
  ok(noEffect.length === 0, "every magic card has an effect: " + noEffect.join(", "));
  const noTrap = CardDB.all.filter((c) => c.kind === "T" && !Effects.trap[c.id]).map((c) => c.name);
  ok(noTrap.length === 0, "every trap defined: " + noTrap.join(", "));
  const noRit = CardDB.all.filter((c) => c.kind === "R" && !Effects.ritual[c.id]).map((c) => c.id + ":" + c.name);
  ok(noRit.length === 0, "every ritual defined: " + noRit.join(", "));
}
// --- the campaign sweep: beat everyone once and they all bring their tournament decks from then on
{
  const store = {};
  win.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem(k, v) { store[k] = v; }, removeItem(k) { delete store[k]; } };
  vm.runInContext(fs.readFileSync(path.join(root, "js/data/starters.js"), "utf8"), ctx, { filename: "starters.js" });
  vm.runInContext(fs.readFileSync(path.join(root, "js/game/save.js"), "utf8"), ctx, { filename: "save.js" });
  const Save = win.Save;
  Save.data = { wins: {}, losses: {}, flags: {}, stats: { duels: 0 }, decks: [[], [], []], deckSlot: 0, deck: [], chest: {} };
  ok(!Save.fullStrength(), "a fresh save does not face full-strength duelists");
  const upTo = (stage) => { for (let s = 1; s <= stage; s++) for (const k of Duelists.STAGES[s].keys) if (!Duelists.byKey[k].hidden) Save.data.wins[k] = 5; };
  upTo(2);
  ok(Save.maxStage() === 3 && !Save.fullStrength(), "Domino Town cleared: Ancient Egypt is open, and the gloves are still on");
  upTo(3);
  ok(Save.maxStage() === 4 && Save.fullStrength(), "Ancient Egypt cleared: The Heavens are open and everybody plays at full strength");
  // and what a swept campaign deals: the tournament build, staples and all
  const d = Duelists.byKey.yugi;
  const camp = Duelists.deck(d, 0).slice().sort((a, b) => a - b).join(",");
  const cup = Duelists.deck(d, 99, { skill: 4, max: true }).slice().sort((a, b) => a - b).join(",");
  ok(camp !== cup && [337, 336, 814, 789, 672].every((id) => cup.split(",").includes(String(id))),
    "the tournament deck a swept campaign switches to is a different deck, and it carries the staples");
}
// --- every script in the game parses. The rules tests only load the data and engine files, so a screen file could
// (and did, 2026-09-24) sit broken for a whole session: menu.js lost a newline escape in an edit, the string ran on,
// the file never defined Screens.mainMenu, and New Game froze on the last line of the intro with no test saying a word.
{
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith(".js") ? [path.join(dir, e.name)] : []));
  const bad = [];
  for (const f of walk(path.join(root, "js"))) {
    try { new vm.Script(fs.readFileSync(f, "utf8"), { filename: f }); } catch (e) { bad.push(path.relative(root, f) + ": " + e.message); }
  }
  ok(bad.length === 0, "every script under js/ parses" + (bad.length ? ": " + bad.join(" | ") : ""));
}
// --- the eight cards the remake adds second (816-823, the user's list of 2026-09-24)
{
  const { Banlist } = win;
  // Card of Demise: three now, nothing later
  const d1 = mk([816], []); const before = d1.p[0].deck.length;
  ok(d1.activate(d1.p[0], { hand: 0 }).ok && d1.p[0].hand.length === 3 && d1.p[0].deck.length === before - 3, "Card of Demise draws 3");
  d1.endTurn();
  ok(d1.p[0].hand.length === 0, "...and the whole hand goes when the turn ends, hand-size rule and all");
  ok(Banlist.limit(816) === 1 && Banlist.limit(818) === 1 && Banlist.limit(819) === 1, "Card of Demise, Monster Reborn and Reasoning are Limited to one");
  // ...and it must never reach a deck playing for Exodia: it throws away the hand the five pieces are gathered in
  {
    const seeker = Duelists.byKey.seeker;
    const forced = Duelists.deck(seeker, 0).slice(); forced[0] = 816;
    ok(!Duelists.noSelfMill(forced).includes(816) && !Duelists.deck(seeker, 0).includes(816) && !Duelists.deck(Duelists.byKey.solomon, 0).includes(816),
      "Card of Demise is kept out of the Exodia decks, even when something puts it there");
    ok(Duelists.noSelfMill([816, 8, 8, 8]).includes(816), "...but a deck that is not playing for Exodia keeps it");
    const d = mk([816], []); d.p[0].hand = [816, 17]; d.p[0].skill = 4; win.AI.beginTurn(d.p[0]);
    const acts = [];
    for (let i = 0; i < 10; i++) { const r = win.AI.step(d, d.p[0]); acts.push(r.type + (r.id ? ":" + r.id : "")); if (r.type === "end") break; }
    ok(!acts.some((x) => x === "magic:816"), "and the AI will not play it while it is holding a piece of Exodia");
  }

  // Monster Reborn reaches into EITHER graveyard
  const d2 = mk([818], []); d2.p[1].grave.push(1);
  ok(d2.activate(d2.p[0], { hand: 0 }).ok && d2.p[0].monsters().some((m) => m.id === 1), "Monster Reborn takes the Blue-eyes out of THEIR graveyard");

  // Reasoning: the deck picks
  const d3 = mk([819], []); d3.p[0].deck = [1, 8, 8, 8];
  ok(d3.activate(d3.p[0], { hand: 0 }).ok && d3.p[0].monsters().length === 1 && d3.p[0].deck.length === 3, "Reasoning puts a monster from the deck straight onto the field");

  // the two searchers
  const d4 = mk([820], []); d4.p[0].deck = [41, 8, 8];
  ok(d4.activate(d4.p[0], { hand: 0 }).ok && d4.p[0].hand.includes(41), "Reinforcement of the Army fetches a Warrior");
  const d5 = mk([822], []); d5.p[0].deck = [767, 8, 8];
  ok(d5.activate(d5.p[0], { hand: 0 }).ok && d5.p[0].hand.includes(767), "Toon Table of Contents fetches a Toon");

  // Toon World: the Toons walk past the board, one attack a turn is turned away, and they go when it goes
  const d6 = mk([823], []); const toon = put(d6, 0, 767); const theirs = put(d6, 1, 1);
  ok(d6.activate(d6.p[0], { hand: 0 }).ok && d6.field === 823 && d6.fieldOwner === 0, "Toon World is a field card, owned by whoever played it");
  const lp0 = d6.p[1].lp;
  ok(d6.attack(d6.p[0], d6.p[0].mon.indexOf(toon), null).ok && d6.p[1].lp === lp0 - 3000, "a Toon hits the Life Points straight past their Blue-eyes");
  d6.endTurn();
  const myLp = d6.p[0].lp;
  ok(d6.attack(d6.p[1], d6.p[1].mon.indexOf(theirs), d6.p[0].mon.indexOf(toon)).negated && d6.p[0].lp === myLp && d6.p[0].monsters().length === 1,
    "Toon World turns the first attack of their turn away");
  const second = put(d6, 1, 22);
  ok(!d6.attack(d6.p[1], d6.p[1].mon.indexOf(second), d6.p[0].mon.indexOf(toon)).negated, "...and only the first one");
  d6.setField(334, 1);
  ok(!d6.p[0].monsters().some((m) => Effects.TOONS.has(m.id)), "replacing Toon World takes every Toon with it");

  // Dark Sage is made, not drawn
  ok(CardDB.fuse(16, 35) === 817 && Banlist.ritualOnly(817), "Dark Sage is the Time Wizard + D. Magician fusion, and never a deck card");
  const d7 = mk([], []); const sage = put(d7, 0, 817); d7.p[0].deck = [337, 8, 8];
  ok(d7.special(d7.p[0], d7.p[0].mon.indexOf(sage)).ok && d7.p[0].hand.includes(337), "Dark Sage pulls a spell out of the deck");
  ok(!d7.special(d7.p[0], d7.p[0].mon.indexOf(sage)).ok, "...once per duel");

  // Toon D. Magician Girl plays by the Toon rules
  const d8 = mk([821], []);
  ok(!d8.canSummon(d8.p[0], 0).ok, "Toon D. Magician Girl cannot be normal summoned");
  put(d8, 0, 8);
  const ts = d8.canSummon(d8.p[0], 0);
  ok(ts.ok && ts.free && ts.need === 1 && Banlist.limit(821) === 1, "...she is a free extra summon for one offering, Limited to one");
  ok([727, 728, 729, 767, 821].every((id) => Effects.TOONS.has(id)), "all five Toons are on the Toon list");
}
console.log("pass", pass, "fail", fail);
