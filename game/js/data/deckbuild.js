// Deck building, shared by the deck editor's AUTO BUILD and the demo runner.
// A card is worth what it does in a duel, not what is printed on it: a monster's value is its body plus the ATK its
// effect is worth (Effects.bonus), and effects whose worth depends on the rest of the deck (SYNERGY below) are priced
// against the deck being built. The builder then runs a local search over the chest, so partners, Insect swarms,
// fusion material, ritual offerings and the Cyber-Stein package find each other instead of being ranked one by one.
(function () {
  const SPELL_VALUE = {
    337: 3000, 784: 2600, 657: 2400, 336: 2400, 348: 2200, 781: 2200, 661: 2200, 686: 2200, 789: 2000, 685: 2000,
    684: 1500, 785: 1500, 790: 1500, 669: 1400, 672: 1300, 652: 1300, 683: 1000, 349: 900, 788: 800, 320: 600,
    682: 500, 690: 400, 655: 300, 350: 200, 681: 200,
    // the Life Point cards, priced for what they actually do in a duel: buy a turn, maybe
    342: 600, 341: 300, 347: 350, 346: 200,
    814: 2000, 813: 1800, 815: 900,        // Mirror Force, Call of the Haunted, Trap Hole
  };
  // spells that wipe a whole type off both fields: a liability in a deck built around that type
  const TYPE_KILL = { 329: "Dragon", 653: "Warrior", 656: "Zombie", 660: "Machine", 662: "Insect", 663: "Rock", 664: "Fish", 786: "Fiend", 787: "Magician" };

  // ---------------------------------------------------------------- deck context
  // what the deck is made of, so a card's effect can be priced against it
  function context(deckMonsters) {
    if (!deckMonsters || !deckMonsters.length) return null;
    const ctx = { id: {}, ty: {}, el: {}, weak: 0, equips: 0, n: 0 };
    for (const id of deckMonsters) {
      const c = CardDB.get(id); if (!c) continue;
      ctx.id[id] = (ctx.id[id] || 0) + 1;
      if (c.kind !== "M") { const fx = Effects.magic[id]; if (fx && fx.kind === "equip") ctx.equips++; continue; }
      ctx.n++; ctx.ty[c.ty] = (ctx.ty[c.ty] || 0) + 1; ctx.el[c.el] = (ctx.el[c.el] || 0) + 1;
      if (c.atk <= 500) ctx.weak++;
    }
    return ctx;
  }
  const has = (ctx, id) => (ctx.id[id] || 0);
  const ty = (ctx, t) => (ctx.ty[t] || 0);
  const el = (ctx, e) => (ctx.el[e] || 0);
  const cap = (v, hi) => Math.min(hi, Math.round(v));

  // effects whose worth is decided by the rest of the deck. Each returns an ATK-equivalent, the same scale as
  // Effects.bonus, which is what they replace once the deck around them is known.
  const SYNERGY = {
    // Morphing Jar throws both hands away: worth a look in a normal deck, worth nothing in one holding Exodia
    591: (c) => (has(c, 17) || has(c, 18) || has(c, 19) || has(c, 20) || has(c, 21) ? -1500 : 300),
    // ---- counters: how many of a kind the deck can put on the field and in the graveyard
    762: (c) => 200 + cap(200 * ty(c, "Insect") * 0.6, 1600),              // Insect Queen: 200 per Insect anywhere
    67: (c) => 150 + cap(100 * ty(c, "Insect") * 0.8, 900),                // Perfectly Ultimate Great Moth
    57: (c) => 150 + cap(100 * ty(c, "Insect") * 0.5, 600),                // Great Moth
    764: (c) => 100 + cap(200 * ty(c, "Insect") * 0.25, 600),              // Skull-Mark Ladybug: 200 per other own Insect
    407: (c) => 200 + cap(100 * ty(c, "Machine") * 0.7, 1200),             // Machine King: 100 per Machine anywhere
    760: (c) => 150 + (has(c, 35) ? 700 : 0),                              // D. Magician Girl: 500 per D. Magician held, played or buried
    369: (c) => 100 + cap(500 * has(c, 366) * 0.6, 1200),                  // Labyrinth Wall counts
    370: (c) => 100 + cap(500 * has(c, 366) * 0.6, 1200),
    493: (c) => 150 + cap(500 * c.equips * 0.5, 1200),                     // Maha Vailo: 500 more per power-up spell the deck runs
    // ---- partners: the bonus only exists while the other card is on the field with it
    1: (c) => 1200 + (has(c, 2) ? 250 : 0),                                // B.eyes White Dragon and its Mystical Elf
    2: (c) => (has(c, 1) ? 400 : 0),
    386: (c) => 200 + cap(500 * has(c, 62) * 0.4 + 1000 * has(c, 63) * 0.5, 1400), // Harpie's Pet Dragon
    62: (c) => 300 + (has(c, 386) ? 200 : 0),
    63: (c) => 350 + (has(c, 386) ? 300 : 0),
    160: (c) => 100 + (has(c, 161) ? 300 : 0),                             // M-warrior #1 and #2
    161: (c) => 100 + (has(c, 160) ? 300 : 0),
    375: (c) => 100 + (has(c, 376) ? 300 : 0),                             // Dungeon Worm under Monster Tamer
    // ---- auras: worth what they add to the rest of the deck
    376: (c) => 300 + cap(120 * (ty(c, "Beast") + ty(c, "BeastWar")), 1100), // Monster Tamer
    99: (c) => 150 + cap(150 * ty(c, "Zombie"), 900),                      // Pumpking: own Zombies x1.3
    753: (c) => 150 + cap(150 * ty(c, "Warrior"), 900),                    // Swordsman of Landstar: own Warriors x1.3
    90: (c) => 100 + cap(150 * c.weak, 700),                               // Gyakutenno Megami lifts the 500 ATK and under
    83: (c) => 150 + cap(100 * (ty(c, "Zombie") + ty(c, "Fiend") + el(c, "Shadow")), 900), // Castle of Dark Illusions
    // ---- auras that work on both fields: only worth it when the deck leans the right way
    492: (c) => 100 + cap(150 * el(c, "Light") - 150 * el(c, "Shadow"), 900),
    524: (c) => 100 + cap(150 * (el(c, "Aqua") + ty(c, "Aqua")) - 150 * (el(c, "Pyro") + ty(c, "Pyro")), 900),
    609: (c) => 100 + cap(150 * (el(c, "Wind") + el(c, "Forest")) - 150 * (el(c, "Earth") + ty(c, "Rock")), 900),
    628: (c) => 100 + cap(200 * el(c, "Shadow") - 200 * el(c, "Light"), 1000),
  };
  // the ATK an effect is worth inside this deck (Effects.bonus is the context-free answer)
  function effectWorth(id, ctx) {
    const f = SYNERGY[id];
    if (f && ctx) return f(ctx);
    return Effects.bonus[id] || 0;
  }

  // ---------------------------------------------------------------- one card
  function cardValue(id, deckMonsters) {
    const c = CardDB.get(id); if (!c || Banlist.ritualOnly(id)) return -1;
    const ctx = deckMonsters ? (deckMonsters.ctx || context(deckMonsters)) : null;
    if (c.kind === "M") {
      const body = c.atk + c.def * 0.2;
      // Magician of Faith, Penguin Soldier, Man-eater Bug: you do not play these to win a fight, you play them to be
      // attacked, so their 300 ATK body is not what they are worth - their trigger is
      const trigger = Effects.bait.has(id) || Effects.onDestroy[id] !== undefined;
      return (trigger ? Math.max(body, 1000) : body) + (Effects.isEffect(id) ? 50 : 0) + effectWorth(id, ctx);
    }
    if (TYPE_KILL[id]) return 700 - (ctx ? ty(ctx, TYPE_KILL[id]) : 0) * 250; // clears a whole type off both fields - unless that type is ours
    if (SPELL_VALUE[id] !== undefined) return SPELL_VALUE[id];
    if (c.kind === "R") { // worth it when the deck carries every named offering - or Cyber-Stein, which needs none
      const r = Effects.ritual[id]; if (!r || !deckMonsters) return 0;
      const res = CardDB.get(r.result); if (!res) return 0;
      const stein = deckMonsters.includes(420) ? res.atk : 0; // Cyber-Stein summons the deck's best ritual monster for free (one is enough: addSteinPackage picks it)
      const have = {}; for (const m of deckMonsters) have[m] = (have[m] || 0) + 1;
      const needed = {}; for (const n of r.need) needed[n] = (needed[n] || 0) + 1;
      for (const n in needed) if ((have[n] || 0) < needed[n]) return stein;
      return Math.max(stein, res.atk - 1200); // the card plus its named offering buy a special summon
    }
    const fx = Effects.magic[id];
    if (fx && fx.kind === "equip") {
      if (!deckMonsters) return 0;
      const fits = deckMonsters.filter((m) => CardDB.equipFits(id, CardDB.get(m))).length;
      let v = fits ? Math.round(200 + 900 * fits / Math.max(1, deckMonsters.length)) : 50; // +500 ATK, but only on monsters it fits
      if (ctx && has(ctx, 493)) v += 250;                                                  // Maha Vailo turns every power-up into +1000
      return v;
    }
    if (fx && fx.kind === "destroy") return 600;
    // Life Points buy time and nothing else: a duel is won by clearing the board, so a heal or a burn is worth a
    // fraction of what it says on the card (the user's rule, 2026-09-24 - "these effects aren't that great")
    if (fx && fx.kind === "heal") return fx.amount / 8;
    if (fx && fx.kind === "damage") return fx.amount / 3;
    return 100;
  }

  // ---------------------------------------------------------------- one deck
  // deck worth = card values (priced against the deck itself) + what the best hand fusion partner adds to each monster
  const fuseVal = new Map();                        // the builder asks for the same fusion results thousands of times
  const resultValue = (id) => { let v = fuseVal.get(id); if (v === undefined) { v = cardValue(id); fuseVal.set(id, v); } return v; };
  function fusionGain(a, b, va, vb) { const r = CardDB.fuse(a, b); if (!r) return 0; return Math.max(0, resultValue(r) - Math.max(va, vb)); }
  function deckScore(deck) {
    const mons = deck.filter((id) => CardDB.get(id).kind === "M");
    mons.ctx = context(deck);                       // priced once for the whole deck, not once per card
    const val = {}; for (const id of deck) if (val[id] === undefined) val[id] = cardValue(id, mons);
    let total = 0;
    for (const id of deck) total += Math.max(0, val[id]);
    // what the best partner in the deck adds when the two are fused in the hand (copies of a card share the answer)
    const uniq = []; for (const id of mons) if (!uniq.includes(id)) uniq.push(id);
    const gain = {};
    for (const x of uniq) {
      let best = 0;
      for (const y of uniq) { if (y === x && mons.filter((m) => m === x).length < 2) continue; const g = fusionGain(x, y, val[x], val[y]); if (g > best) best = g; }
      gain[x] = best;
    }
    for (const id of mons) total += gain[id] * 0.5;
    return total;
  }

  // ---------------------------------------------------------------- packages
  // drop the weakest monsters that are not part of the bundle to make room for it, and keep the swap only if it helps
  function swapIn(deck, bundle) {
    const mons = deck.filter((id) => CardDB.get(id).kind === "M"); mons.ctx = context(deck);
    const order = deck.map((id, i) => ({ i, v: cardValue(id, mons) })).filter((x) => !bundle.includes(deck[x.i]) && CardDB.get(deck[x.i]).kind === "M").sort((a, b) => a.v - b.v);
    if (order.length < bundle.length) return deck;
    const trial = deck.slice(); const drop = order.slice(0, bundle.length).map((x) => x.i).sort((a, b) => b - a);
    for (const i of drop) trial.splice(i, 1);
    trial.push(...bundle);
    return deckScore(trial) > deckScore(deck) + 50 ? trial : deck;
  }
  // Cyber-Stein plus the strongest ritual card we own go in together: that monster for free, no offerings needed
  function addSteinPackage(deck, pool) {
    const stein = pool.find((p) => p.id === 420); if (!stein) return deck;
    const rituals = pool.filter((p) => Effects.ritual[p.id] && !deck.includes(p.id)).map((p) => ({ id: p.id, atk: CardDB.get(Effects.ritual[p.id].result).atk })).sort((a, b) => b.atk - a.atk);
    const best = rituals[0]; if (!best || best.atk < 2300) return deck;
    return swapIn(deck, deck.includes(420) ? [best.id] : [420, best.id]);
  }
  // a ritual card plus the named offerings it needs go in together when the whole bundle makes the deck better
  function addRitualPackages(deck, pool) {
    const inPool = {}; for (const p of pool) inPool[p.id] = p.copies;
    const count = (arr, id) => arr.filter((x) => x === id).length;
    for (const p of pool) {
      const r = Effects.ritual[p.id]; if (!r || deck.includes(p.id)) continue;
      const missing = [];
      for (const n of r.need) if (count(deck, n) + count(missing, n) < count(r.need, n)) missing.push(n);
      if (missing.some((n) => count(missing, n) > (inPool[n] || 0))) continue; // offerings we do not own
      deck = swapIn(deck, [p.id].concat(missing));
    }
    return deck;
  }

  // ---------------------------------------------------------------- the chest
  // every card we own, capped by the Limit list (ritual monsters and Wall Shadow are not deck cards: limit 0)
  function poolFrom(chest) {
    const pool = [];
    for (const k in chest) { const id = Number(k), n = Math.min(chest[k], Banlist.limit(id)); if (n > 0 && CardDB.get(id)) pool.push({ id, copies: n }); }
    return pool;
  }

  // local search: swap deck monsters for chest monsters whenever the deck as a whole gets better. This is where
  // synergy is found - a card that is mediocre on its own (Insect Queen, a Harpie Lady, a fusion half) raises the
  // score once its partners are in, so the pieces walk into the deck together over the passes.
  function improve(deck, pool) {
    const used = {}; for (const id of deck) used[id] = (used[id] || 0) + 1;
    const ranked = pool.filter((p) => CardDB.get(p.id).kind === "M" && (used[p.id] || 0) < p.copies).map((p) => p.id).sort((x, y) => cardValue(y) - cardValue(x));
    const cands = ranked.slice(0, 36);
    for (const id of ranked.slice(36)) if (SYNERGY[id] && cands.length < 52) cands.push(id); // synergy cards are cheap bodies: they never rank on their own
    let score = deckScore(deck);
    for (let pass = 0; pass < 3; pass++) {
      let improved = false;
      for (const y of cands) {
        if ((used[y] || 0) >= Math.min(Save.owned(y), Banlist.limit(y))) continue;
        let bestK = -1, bestS = score;
        for (let k = 0; k < deck.length; k++) {
          const x = deck[k]; if (CardDB.get(x).kind !== "M" || x === y) continue;
          deck[k] = y; const sc = deckScore(deck); deck[k] = x;
          if (sc > bestS + 1) { bestS = sc; bestK = k; }
        }
        if (bestK >= 0) { const x = deck[bestK]; deck[bestK] = y; used[y] = (used[y] || 0) + 1; used[x]--; score = bestS; improved = true; }
      }
      if (!improved) break;
    }
    return deck;
  }

  // Ranking every monster on one scale builds a deck of the 30 biggest bodies; a real deck keeps a few slots for
  // the effects that swing a duel (a searcher, a bouncer, a card that kills whatever eats it).
  const UTILITY_SLOTS = 5, UTILITY_BAR = 600;
  function addUtility(deck, pool) {
    const used = {}; for (const id of deck) used[id] = (used[id] || 0) + 1;
    const worth = (id) => effectWorth(id, null);
    // a utility card is a small body carrying a big effect - the beaters have effects too, but they earn their slot
    // with their ATK, so they are the ones that make room
    const isUtility = (id) => { const c = CardDB.get(id); return !!c && c.kind === "M" && c.atk <= 1400 && worth(id) >= UTILITY_BAR; };
    // ranked by the effect, since that is what the slot is for; the body only breaks ties
    const cand = pool.filter((p) => isUtility(p.id) && !Banlist.ritualOnly(p.id))
      .sort((a, b) => (worth(b.id) - worth(a.id)) || (cardValue(b.id) - cardValue(a.id)));
    let added = 0;
    for (const p of cand) {
      if (added >= UTILITY_SLOTS) break;
      if ((used[p.id] || 0) >= Math.min(p.copies, Save.owned(p.id), Banlist.limit(p.id))) continue;
      const mons = deck.filter((id) => CardDB.get(id).kind === "M"); mons.ctx = context(deck);
      // the weakest monster that is not itself one of these makes room
      let worst = -1, wv = Infinity;
      deck.forEach((id, i) => {
        const c = CardDB.get(id);
        if (!c || c.kind !== "M" || isUtility(id)) return;
        const v = cardValue(id, mons); if (v < wv) { wv = v; worst = i; }
      });
      if (worst < 0) break;
      deck[worst] = p.id; used[p.id] = (used[p.id] || 0) + 1; added++;
    }
    return deck;
  }

  const MAX_SPELLS = 10;
  // the best 40 cards the chest allows. Built twice: once with the spells priced against the deck being built (which
  // is what finds a Harpie package or a Maha Vailo's equips) and once with them priced on their own, and the better
  // of the two is kept. Without that guard a single Maha Vailo in the chest made every equip look essential and the
  // builder filled all ten spell slots with them, dropping eight monsters for a deck it scored 8000 lower itself
  // (2026-09-24, found while answering what the demo does with the cards it buys).
  function bestDeck(chest) {
    const pool = poolFrom(chest || Save.data.chest);
    const a = assemble(pool, true), b = assemble(pool, false);
    return deckScore(b) > deckScore(a) ? b : a;
  }
  function assemble(pool, priceInContext) {
    const isM = (p) => CardDB.get(p.id).kind === "M";
    // monsters ranked, expanded per copy. There is no cap on the big ones any more: nothing is offered for a summon,
    // so the only thing rationing them is the limit list, and `copies` already carries that.
    const mons = pool.filter(isM).map((p) => ({ id: p.id, copies: p.copies, v: cardValue(p.id) })).sort((a, b) => b.v - a.v);
    const monList = [], extraMons = [];
    for (const m of mons) for (let i = 0; i < m.copies; i++) monList.push(m.id);
    const core = monList.slice(0, 32);
    const spells = pool.filter((p) => !isM(p)).map((p) => ({ id: p.id, copies: p.copies, v: cardValue(p.id, priceInContext ? core : undefined) })).sort((a, b) => b.v - a.v);
    const deck = [], spare = [];
    for (const s of spells) for (let i = 0; i < s.copies; i++) { if (s.v >= 500 && deck.length < MAX_SPELLS) deck.push(s.id); else spare.push(s.id); }
    for (const id of monList) { if (deck.length >= 40) break; deck.push(id); }
    for (const id of spare.concat(extraMons)) { if (deck.length >= 40) break; deck.push(id); } // only when the chest is thin
    return addUtility(addSteinPackage(addRitualPackages(improve(deck, pool), pool), pool), pool);
  }

  window.DeckBuild = { SPELL_VALUE, SYNERGY, TYPE_KILL, context, effectWorth, cardValue, deckScore, fusionGain, bestDeck, improve, addRitualPackages, addSteinPackage, poolFrom, MAX_SPELLS };
})();
