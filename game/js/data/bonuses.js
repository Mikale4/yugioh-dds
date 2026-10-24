// Duel bonuses: what the duel itself was worth, on top of beating the duelist.
// Modelled on the Duel Point bonuses of Yu-Gi-Oh! Ultimate Masters: World Championship Tournament 2006 - the win is
// only the first line of the bill, and how you won is the rest of it. Paid in Domino, with this game's own cards and
// its own summon list in mind.
// Everything is read back out of the duel's own log, so the engine never has to keep score: it just tells the story
// and this counts it afterwards. Life Points are replayed from the same events, which is how a blow that lands for
// exactly the last point, or a win from behind, can still be spotted once the duel is over.
(function () {
  const START_LP = (pl) => pl.startLp || (pl.duelist && pl.duelist.lp) || 8000;
  const CARD_STEP = 1500;   // every this much earned in one duel, the duelist hands over another card (up to 3)

  function tally(duel, me) {
    const foe = 1 - me;
    const t = {
      damage: 0, battle: 0, effect: 0, maxHit: 0, maxAtk: 0, killed: 0, offered: 0, fusions: 0, rituals: 0,
      specials: 0, spells: 0, traps: 0, behind: false, exact: false, peakLp: 0, lastTurn: me,
    };
    const lp = [START_LP(duel.p[0]), START_LP(duel.p[1])];
    t.peakLp = lp[me];
    for (const e of duel.log) {
      switch (e.type) {
        case "damage": {
          const before = lp[e.player];
          lp[e.player] = Math.max(0, before - e.amount);
          if (e.player === foe && e.why !== "cost") {       // Life Points I took off them, not ones they paid themselves
            t.damage += e.amount;
            if (e.why === "battle" || e.why === "direct") t.battle += e.amount; else t.effect += e.amount;
            if (e.amount > t.maxHit) t.maxHit = e.amount;
            if (lp[foe] === 0 && e.amount === before) t.exact = true;   // the last blow landed for exactly the rest
          }
          break;
        }
        case "heal":
          lp[e.player] = Math.min(99999, lp[e.player] + e.amount);
          if (e.player === me && lp[me] > t.peakLp) t.peakLp = lp[me];
          break;
        case "attack": if (e.player === me && e.aAtk > t.maxAtk) t.maxAtk = e.aAtk; break;
        case "destroy":
          if (e.player === foe && e.why === "battle") t.killed++;
          if (e.player === me && e.why === "offer") t.offered++;
          break;
        case "fuse": if (e.player === me) { t.fusions++; t.specials++; } break;
        case "ritual": if (e.player === me) { t.rituals++; t.specials++; } break;
        case "summon": if (e.player === me && e.special) t.specials++; break;
        case "magic": if (e.player === me && !e.fail) t.spells++; break;
        case "trap": if (e.player === me) t.traps++; break;
        case "turn":
          t.lastTurn = e.player;
          if (e.player === me && lp[me] < lp[foe]) t.behind = true;     // a turn that started with the shorter stick
          break;
        default: break;
      }
    }
    return t;
  }

  // the bill itself: every line that earned something, in the order it happened during the duel
  // opts: { payout, newSummons, flawless }
  function forDuel(duel, opts) {
    opts = opts || {};
    const me = opts.me === undefined ? 0 : opts.me, foe = 1 - me;
    const t = tally(duel, me), pl = duel.p[me];
    const rows = [];
    const add = (name, amount) => { if (amount > 0) rows.push({ name, amount: Math.round(amount) }); };
    const turns = duel.turnNo;

    add("Victory", opts.payout || 0);
    // --- how the duel was fought
    add("Damage", Math.floor(t.damage / 100));
    if (t.damage > 0 && t.effect === 0) add("All battle", 50);         // won it the honest way
    if (t.damage > 0 && t.battle === 0) add("Effect dmg", 150);        // and this is the other way
    if (t.maxAtk >= 3000) add("Max ATK", Math.floor(t.maxAtk / 100));
    if (t.maxHit >= 3000) add("Big hit", Math.floor(t.maxHit / 100));
    add("Destroyed", t.killed * 20);
    add("Offerings", t.offered * 30);
    add("Fusions", t.fusions * 50);
    add("Rituals", t.rituals * 100);
    if (t.specials === 0) add("No specials", 100);
    add("Spells", t.spells * 10);
    if (t.spells === 0) add("No spells", 100);
    add("Traps", t.traps * 15);
    if (t.traps === 0) add("No traps", 50);
    add("First summon", (opts.newSummons || 0) * 150);                 // a monster crossed off the summon list
    // --- how it finished
    if (t.lastTurn === foe) add("Their turn", 100);
    if (t.behind) add("Comeback", 100);
    if (!pl.stats.tookDamage) add("No damage", 50);
    if (t.exact) add("Exact 0 LP", 50);
    if (turns <= 6) add("Quick win", (7 - turns) * 50);
    if (pl.lp < 1000) add("Low LP", 100);
    if (pl.lp < 100) add("Last stand", 500);
    if (t.peakLp >= 20000) add("Big life", 100);
    if (pl.deck.length === 0) add("Deck empty", 400);
    else if (pl.deck.length <= 10) add("Low deck", 100);
    if (duel.reason === "deckout" && duel.winner === me) add("Deck out", 300);
    if (duel.reason === "exodia" && duel.winner === me) add("Exodia!", 500);

    const bonus = rows.reduce((s, r) => s + r.amount, 0);
    const mult = opts.flawless ? (window.Shop ? Shop.FLAWLESS : 3) : 1;
    const total = bonus * mult;
    return { rows, bonus, mult, total, flawless: !!opts.flawless, cards: Math.min(3, Math.floor(total / CARD_STEP)), tally: t };
  }

  window.Bonus = { forDuel, tally, CARD_STEP };
})();
