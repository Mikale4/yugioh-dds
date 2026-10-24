// Computer opponent (also drives AUTO mode). Each call performs ONE action so the duel screen can animate in between.
// Plays the modern rules: fusions happen in the hand and never touch the summon, rituals are free special summons paid
// from the hand, a normal summon may attack at once, set monsters are flipped to attack when it pays off, a monster
// that attacked cannot switch to defence, and the hand refills to 5 each turn (so dead cards are cycled away).
(function () {
  const AI = {};

  // A set monster is no mystery to the computer: it knows what is under there, stats and effect both, and fights it
  // as what it is (the user's rule, 2026-09-23 - the old guess from what the enemy had shown is gone).
  function bestEnemyAtk(duel, pl) {
    let best = 0;
    for (const m of duel.opp(pl).monsters()) best = Math.max(best, duel.atk(m));
    return best;
  }
  function weakestEnemyAtk(duel, pl) { // the lowest wall on their side: what a monster has to beat to get through
    let w = 1e9;
    for (const m of duel.opp(pl).monsters()) w = Math.min(w, m.pos === "atk" ? duel.atk(m) : duel.def(m));
    return w === 1e9 ? 0 : w;
  }
  function ownBestAtk(duel, pl) { let b = 0; for (const m of pl.monsters()) b = Math.max(b, duel.atk(m)); return b; }
  // what a monster brought out by a ritual is worth: Relinquished is printed 0/0 and still eats their best monster
  function ritWorth(id) { const c = CardDB.get(id); return c ? c.atk + (Effects.bonus[id] || 0) : 0; }
  // The Stein buys a body, and a body that stops the board is worth as much as one that beats it: a 2050/2500
  // guardian is exactly what a duelist who binds the enemy down wants standing in front of them
  function ritBody(id) { const c = CardDB.get(id); return c ? Math.max(c.atk, c.def) + (Effects.bonus[id] || 0) : 0; }
  // ...but only once it has eaten. A printed 0/0 body on an empty field is a present for whatever they summon next
  // turn, so those rituals wait for a target worth absorbing.
  function ritualNeedsTarget(id) { const c = CardDB.get(id); return !!c && c.atk < 1000 && c.def < 1000 && (Effects.bonus[id] || 0) >= 1000; }
  function absorbTarget(duel, pl, min) {
    for (const m of duel.opp(pl).monsters()) if (duel.canTarget(m) && duel.atk(m) >= (min || 0)) return m;
    return null;
  }
  const PAYS_ANYWAY = new Set([48, 574, 739, 750, 763, 764, 766]); // Sangan, Witch, Legion, Chimera, Parasite, Ladybug, Pinch Hopper

  // What a once-per-duel removal is FOR (the user's rule, 2026-09-24): the monsters battle cannot answer cleanly.
  // Anything that punishes whoever fights it - takes its killer with it, burns, bounces the attacker, freezes our
  // next attack phase, ends our turn - is best taken off the field by an EFFECT, because none of those triggers fire
  // that way. So is anything bigger than everything we have. So is a body carrying a genuinely dangerous effect;
  // `Effects.bonus` is the game's own price list for that, and 500+ is the line where an effect is worth a card.
  const PUNISHES = new Set([736, 756, 769, 768, 748]); // Blast Sphere, Reflect Bounder, Wall of Illusion, The Unhappy Maiden, Stone Statue
  function worthRemoving(duel, pl, d) {
    if (!d || PAYS_ANYWAY.has(d.id)) return 0;         // it pays its owner however it dies: bite that one instead
    const body = Math.max(duel.atk(d), duel.def(d));
    const ourBest = pl.monsters().reduce((t, x) => Math.max(t, duel.atk(x)), 0);
    if (Effects.retaliate.has(d.id) || Effects.locksAttacks.has(d.id) || PUNISHES.has(d.id)) return 3000 + body;
    // as big as us counts: crashing 2500 into 2500 trades our monster away, and a free removal takes theirs and
    // keeps ours. (The user watched a Summoned Skull ram a Dark Magician instead of bolting it, 2026-09-24.)
    if (body >= ourBest) return 2000 + body;
    if ((Effects.bonus[d.id] || 0) >= 500) return 1000 + (Effects.bonus[d.id] || 0);
    return 0;
  }
  function topSeen(duel, pl) { // the strongest enemy monster that is face-up: the threat the AI is allowed to know about
    let best = null;
    for (const m of duel.opp(pl).monsters()) if (m.faceUp && duel.live(m) && (!best || duel.atk(m) > duel.atk(best))) best = m;
    return best;
  }
  // Magical Labyrinth calls the wall out of the deck, the hand or the graveyard, so it is live if any of them has it
  const hasWall = (pl) => pl.deck.includes(366) || pl.grave.includes(366) || pl.hand.includes(366);
  // how much a card in the hand is still worth keeping (low = dead weight that should make room for a fresh draw)
  function handCardValue(duel, pl, id) {
    const c = CardDB.get(id); if (!c) return 0;
    const onField = pl.monsters().length;
    if (c.kind === "M") {
      if (Duelists.KEEP.has(id)) return 99999;                                       // an Exodia piece: it wins by sitting in the hand
      if (id === 425 && pl.deck.includes(425)) return 250;                          // Thunder Dragon: throwing it away fetches two more
      if (id === 463) return 250;                                                    // Electric Snake: throwing it away draws 2
      if (id === 58) return 2600 + c.atk;                                            // Kuriboh in the hand is a shield
      if (Effects.substitute.has(id) && pl.hand.some((x) => Effects.ritual[x])) return 8000; // it can pay for the ritual in the hand
      if (id === 805) return duel.p[pl.index].monsters().length ? 2600 + c.atk : 9000;  // Gorz waits in the hand for a blow on an empty field
      const free = Effects.condFree[id] && Effects.condFree[id](duel, pl);
      if (free) return 3400 + c.atk;                                                     // it can walk out on its own this turn
      const need = CardDB.tributesFor(c);
      if (need > onField && Effects.freeSummon[id] === undefined && id !== 755) return c.atk / (1 + need) - (need - onField) * 300; // no offerings for it any time soon
      if (reservedFor(pl, id)) return 9000;                                          // a ritual card in the hand wants it
      return 3000 + c.atk + (Effects.bonus[id] || 0) / 2;
    }
    if (c.kind === "R") { const r = Effects.ritual[id]; const own = (n) => pl.hand.includes(n) || pl.deck.includes(n) || pl.monsters().some((m) => m.id === n); return r && r.need.every((n) => own(n) || [...Effects.substitute].some(own)) ? 2500 : 300; }
    if (c.kind === "T") return duel.jinzoOut() ? 150 : 1800;                        // Jinzo: a set trap would never fire
    const fx = Effects.magic[id]; if (!fx) return 500;
    if (fx.kind === "equip") return pl.hand.concat(pl.deck).some((x) => { const cc = CardDB.get(x); return cc && cc.kind === "M" && CardDB.equipFits(id, cc); }) || pl.monsters().some((m) => CardDB.equipFits(id, duel.liveCard(m))) ? 1600 : 200;
    if (fx.kind === "field") return duel.field === id ? 100 : 1200;
    if (id === 652) return pl.freeMonSlot() >= 0 && hasWall(pl) ? 1900 : 200;   // it is only worth a card if the wall is somewhere to be found
    if (id === 790) return duel.opp(pl).hand.length ? 2000 : 800;
    if (fx.kind === "heal") return pl.lp >= 7000 ? 900 : 2000;
    return 2200;
  }
  function reservedFor(pl, id) { for (const cid of pl.hand) { const r = Effects.ritual[cid]; if (r && r.need.includes(id)) return true; } return false; }
  // Some monsters are only weak until their own special goes off, and that happens the same turn they are summoned:
  // a mimic copies the enemy's best ATK, an absorber adds it, a thief takes the monster away. Judging those on their
  // printed ATK is what used to set an Eyearmor face-down and then copy 2500 ATK from behind a card.
  const MIMIC = new Set([185, 586]);                    // copies the ATK and DEF of the strongest enemy
  const ABSORB = new Set([731, 734]);                   // destroys the strongest enemy and adds its ATK
  const TAKE = { 40: "Dragon", 762: "Insect", 166: null, 376: null, 641: null, 715: null }; // takes the strongest enemy (641 trades places with it)
  // the same question for a monster that is already out: what will it be worth once its special goes off this turn?
  function liveOutlook(duel, pl, m, skill) {
    const fx = Effects.special[m.id];
    const spent = !fx || m.usedSpecial || (fx.once && pl.onceUsed && pl.onceUsed.has(m.id));
    if (spent) return { atk: duel.atk(m), def: duel.def(m), enemyBest: bestEnemyAtk(duel, pl) };
    const look = summonOutlook(duel, pl, CardDB.get(m.id), duel.atk(m), duel.def(m), skill);
    return { atk: Math.max(duel.atk(m), look.atk), def: Math.max(duel.def(m), look.def), enemyBest: look.enemyBest };
  }
  function summonOutlook(duel, pl, c, atk, def, skill) {
    const enemy = duel.opp(pl).monsters();
    const out = { atk, def, enemyBest: bestEnemyAtk(duel, pl) };
    if (!enemy.length || skill < 2) return out;
    const rank = enemy.map((x) => ({ m: x, a: duel.atk(x), d: duel.def(x) })).sort((p, q) => q.a - p.a);
    const without = rank[1] ? rank[1].a : 0;                       // what is left once their best is gone
    if (MIMIC.has(c.id)) { out.atk = Math.max(atk, rank[0].a); out.def = Math.max(def, rank[0].d); }
    else if (ABSORB.has(c.id)) { out.atk = atk + rank[0].a; out.enemyBest = without; }
    else if (c.id in TAKE) {
      const want = TAKE[c.id] ? rank.filter((r) => r.m.ty === TAKE[c.id]) : rank;
      const own = ownBestAtk(duel, pl);
      const fires = want.length > 0 && (c.id === 641 ? want[0].a > atk + 500        // 641 trades itself away, the others need a free slot
        : pl.freeMonSlot() >= 0 && (c.id === 376 || c.id === 166 || c.id === 715 ? want[0].a >= 1200 : true));
      if (fires) {
        if (want[0] === rank[0]) out.enemyBest = without;
        if (c.id === 641) out.atk = Math.max(atk, want[0].a);       // we end up holding their monster instead
      }
    }
    return out;
  }
  // worth of attacking d with a monster of ATK A (positive = profitable); face-up effect monsters are priced in
  function attackValue(duel, pl, m, A, d, skill) {
    if (m && m.id === 478 && d.el === "Wind") A += 1000; // Insect Soldiers of the Sky
    let v, even = false;
    if (d.pos === "atk") {
      const diff = A - duel.atk(d);
      if (diff > 0) v = 500 + diff;
      else if (diff < 0) v = -1500;
      else { // the same ATK: both monsters die. An even trade is always taken - the board ends level and the attacker chooses it
        even = true;
        const opens = duel.opp(pl).monsters().length === 1 && pl.monsters().some((x) => x !== m && x.pos === "atk" && x.canAttack && !x.attackedThisTurn);
        v = 400 + (opens ? 300 : 0);
      }
    }
    else v = A > duel.def(d) ? 300 + (A - duel.def(d)) / 4 : -1000;
    if (!duel.canTarget(d)) return -1e9;                                             // Wing Egg Elf / Mechaleon behind another monster
    // A SET monster is always attacked, full stop (the user's rule, 2026-09-24). Whatever it is hiding - a Swordsman
    // that takes its killer with it, a wall that freezes the next attack, a Reflect Bounder that burns for the
    // attacker's whole ATK, something that simply wants to die - none of it talks the AI out of the swing. A
    // face-down that is never attacked sits on the board for free, and that is worse than any of them. All that is
    // still asked is whether the attack can get through: the plain battle worth, and nothing else.
    if (!d.faceUp) return v;
    if (skill >= 2 && duel.live(d)) {
      if (Effects.retaliate.has(d.id) || d.id === 736) { if (v > 0) v -= Math.max(0, A - 600) * 1.2; if (d.id === 736) v -= A; } // we lose the attacker too (Blast Sphere burns as well)
      if (d.id === 756) { // Reflect Bounder burns us for our ATK: worth it while the LP can take it, and the cheapest killer goes
        const beats = (x) => x.pos === "atk" && x.canAttack && !x.attackedThisTurn && duel.atk(x) > (d.pos === "atk" ? duel.atk(d) : duel.def(d));
        const cheaper = m && pl.monsters().some((x) => x !== m && duel.atk(x) < A && beats(x));
        v -= pl.lp <= A + 500 || cheaper ? 1e6 : A / 4;
      }
      if (d.id === 769 && v > 0) v = 100;                                              // Wall of Illusion: the attacker comes back to the hand
      if (d.id === 768 && duel.opp(pl).monsters().length >= 2 && pl.monsters().some((o) => o !== m && o.pos === "atk" && o.canAttack && !o.attackedThisTurn)) v -= 700; // The Unhappy Maiden ends the turn: other targets first
      if (d.id === 748 && d.pos === "def" && A <= duel.def(d)) v -= duel.def(d) - A;   // Stone Statue doubles the bounce
      if (Effects.bait.has(d.id) && v > 0) v -= 150;                                   // it wants to die
      if (Effects.locksAttacks.has(d.id)) {
        // Cutting one of these down costs us our NEXT attack phase. That is a real price - but it must never make a
        // monster untouchable, because leaving their board standing is worse, and a defence-position kill is only
        // worth `300 + a quarter of the difference` to begin with. It is free when the kill opens the way for
        // another attacker this turn: tempo now beats a turn of waiting.
        const last = duel.opp(pl).monsters().length === 1;
        const opener = last && pl.monsters().some((x) => x !== m && x.pos === "atk" && x.canAttack && !x.attackedThisTurn);
        if (!opener) v -= 200;
      }
    }
    if (even && v > -1e5) v = Math.max(v, 400);                                        // nothing talks us out of an even trade, short of killing ourselves
    return v;
  }
  // worth of the best attack available to a monster with ATK a (the battle phase uses the same scale); positive = profitable
  function bestAttackValue(duel, pl, A, skill, m) {
    let best = -1e9;
    for (const d of duel.opp(pl).monsters()) { const v = attackValue(duel, pl, m, A, d, skill); if (v > best) best = v; }
    return best;
  }
  // can our other attack-position monsters clear the whole enemy field this turn? (then weak ones get free direct hits)
  function canClearField(duel, pl, except) {
    const attackers = pl.monsters().filter((m) => m !== except && m.pos === "atk" && m.canAttack && !m.attackedThisTurn);
    const enemies = duel.opp(pl).monsters();
    if (!enemies.length) return true;
    if (attackers.length < enemies.length) return false;
    const beats = (m, d) => d.pos === "atk" ? duel.atk(m) > duel.atk(d) : duel.atk(m) > duel.def(d);
    return enemies.every((d) => attackers.some((m) => beats(m, d)));
  }
  // what a monster on our field is worth right now: what it actually hits for (Muka Muka's real 3000, not its printed
  // 600), what its effect is worth, and a discount for cards that are happy to be offered
  // what an effect is worth to this player right now: a Cyber-Stein with no ritual card left in the deck has
  // nothing to fetch, so it is only the 700 ATK body it is printed as
  function bonusFor(pl, id) {
    if (id === 420 && !pl.deck.some((x) => Effects.ritual[x]) && !pl.hand.some((x) => Effects.ritual[x])) return 0;
    return Effects.bonus[id] || 0;
  }
  function worthField(duel, m) {
    // a monster part way along the moth line is worth what it is about to become: never offer it, never fuse it away
    const growing = Effects.evolve[m.id] ? 900 : 0;
    return duel.atk(m) + duel.def(m) * 0.3 + growing + (Effects.bait.has(m.id) ? -400 : bonusFor(duel.p[m.owner], m.id) / 2)
      - (m.pos === "def" && !m.faceUp ? 200 : 0); // a set monster is the cheapest to give up
  }
  function weakestSlot(duel, pl, exclude) {
    let s = -1, v = 1e9;
    for (let i = 0; i < 5; i++) {
      const m = pl.mon[i]; if (!m || (exclude && exclude.includes(i))) continue;
      const a = worthField(duel, m);
      if (a < v) { v = a; s = i; }
    }
    return s;
  }
  // what a monster card is worth to us on the field right now: its real ATK there plus half its effect's value
  function worthHand(duel, pl, id) { return duel.previewAtk(pl, id) + bonusFor(pl, id) / 2; }
  function strongestSlot(duel, pl) { let s = -1, v = -1; for (let i = 0; i < 5; i++) { const m = pl.mon[i]; if (m && duel.atk(m) > v) { v = duel.atk(m); s = i; } } return s; }
  function benefitsField(duel, pl, fid) {
    const f = CardDB.fieldInfo(fid); if (!f) return 0;
    let score = 0;
    for (const m of pl.monsters()) { if (f.plus.includes(m.ty)) score += 2; if (f.minus.includes(m.ty)) score -= 2; }
    for (const m of duel.opp(pl).monsters()) { if (f.plus.includes(m.ty)) score -= 2; if (f.minus.includes(m.ty)) score += 2; }
    for (const id of pl.hand) { const c = CardDB.get(id); if (c && c.kind === "M" && f.plus.includes(c.ty)) score += 1; }
    return score;
  }
  // what changing the terrain would actually gain us: the new field minus the one already in play
  function fieldGain(duel, pl, fid) { return benefitsField(duel, pl, fid) - (duel.field ? benefitsField(duel, pl, duel.field) : 0); }
  // ...and it never changes the field out from under itself: the caster has to come out of it no worse
  function fieldCosts(duel, m, fid) {
    const old = duel.field, now = duel.atk(m);
    duel.field = fid; const after = duel.atk(m); duel.field = old;
    return after < now;
  }
  // what a ritual would cost us: the engine pays with hand cards first, then the weakest field monsters
  function ritualPlan(duel, pl, spellIdx, r) {
    const cands = [];
    pl.hand.forEach((cid, i) => { const c = CardDB.get(cid); if (i !== spellIdx && c && c.kind === "M") cands.push({ kind: "hand", id: cid, atk: c.atk }); });
    for (const m of pl.monsters()) if (!m.control) cands.push({ kind: "field", id: m.id, atk: duel.atk(m) });
    const chosen = [];
    const pick = (pred) => cands.find((x) => pred(x) && !chosen.includes(x));
    if (r.oneOf) {
      const c = pick((x) => r.oneOf.includes(x.id) && x.kind === "hand") || pick((x) => r.oneOf.includes(x.id));
      if (!c) return null;
      chosen.push(c);
    }
    for (const need of r.need) {
      const c = pick((x) => x.id === need && x.kind === "hand") || pick((x) => x.id === need) || pick((x) => Effects.substitute.has(x.id) && x.kind === "hand") || pick((x) => Effects.substitute.has(x.id));
      if (!c) return null;
      chosen.push(c);
    }
    const extra = cands.filter((x) => !chosen.includes(x) && (!r.anyType || CardDB.get(x.id).ty === r.anyType));
    if (extra.length < r.any) return null;
    extra.sort((a, b) => (a.kind === b.kind ? a.atk - b.atk : a.kind === "hand" ? -1 : 1));
    chosen.push(...extra.slice(0, r.any));
    const fieldLoss = chosen.filter((x) => x.kind === "field").reduce((s, x) => s + x.atk, 0);
    const handLoss = chosen.filter((x) => x.kind === "hand").reduce((s, x) => s + x.atk, 0);
    return { chosen, fieldLoss, handLoss, usesField: chosen.some((x) => x.kind === "field") };
  }

  AI.beginTurn = function (pl) { pl.ai = { phase: "main", attacked: new Set(), tried: new Set(), fusions: 0, actions: 0 }; };

  // returns a short description of what happened, or {type:'end'} after ending the turn
  AI.step = function (duel, pl) {
    if (!pl.ai) AI.beginTurn(pl);
    const st = pl.ai; const opp = duel.opp(pl); const skill = pl.skill || 1;
    if (duel.winner !== null) return { type: "end" };
    if (++st.actions > 40 || duel.forceEnd) { if (duel.mustDiscard(pl)) return discardWorst(duel, pl); duel.endTurn(); return { type: "end" }; }
    const enemyMons = opp.monsters();
    const enemyBest = bestEnemyAtk(duel, pl), ownBest = ownBestAtk(duel, pl);
    const canBattle = duel.turnNo > 1 && pl.swords === 0 && pl.noAttack === 0;

    // named offerings of ritual cards we hold stay in the hand (rituals pay from the hand first) unless nothing else can be played
    const reserved = new Set();
    if (skill >= 2) for (const cid of pl.hand) { const r = Effects.ritual[cid]; if (r) { for (const n of r.need) reserved.add(n); for (const s of Effects.substitute) reserved.add(s); } }

    if (st.phase === "main") {
      // ---- flip set monsters into attack position when they can win a fight, hit directly, or when the rest of our
      // attackers will sweep the enemy field anyway (so they can join the direct hits) - never leave a monster idle
      if (canBattle) {
        for (let s = 0; s < 5; s++) {
          const m = pl.mon[s]; if (!m || m.pos !== "def" || m.turnedThisTurn || m.summonTurn === duel.turnNo || st.tried.has("flip" + s)) continue;
          st.tried.add("flip" + s);
          const A = Math.max(duel.atk(m), liveOutlook(duel, pl, m, skill).atk);   // a mimic flips up and then copies
          const worth = !enemyMons.length ? A >= 300 : (bestAttackValue(duel, pl, A, skill, m) > (skill >= 2 ? 0 : -200) || (A >= 300 && canClearField(duel, pl, m)));
          if (worth && duel.changePos(pl, s).ok) return { type: "pos" };
        }
      }
      // ---- fusion (stage 2+): two hand cards (the result must be summonable today, or a clear upgrade) or a hand card
      // onto a field monster that has not attacked (the result lands straight on the field) - never a blind try
      if (st.fusions < 2 && skill >= 2 && pl.hand.length >= 1) {
        let best = null;
        const onField = pl.monsters().length;
        for (let s = 0; s < 5; s++) {
          const m = pl.mon[s]; if (!m || m.attackedThisTurn || m.control || m.frozen > 0 || m.sleep > 0 || reserved.has(m.id)) continue;
          for (let b = 0; b < pl.hand.length; b++) {
            const cb = CardDB.get(pl.hand[b]); if (!cb || cb.kind !== "M" || reserved.has(cb.id) || Duelists.KEEP.has(cb.id)) continue;
            const r = CardDB.fuse(m.id, cb.id); if (!r) continue;
            const rc = CardDB.get(r), eff = worthHand(duel, pl, r), gain = eff - Math.max(duel.atk(m) + (Effects.bonus[m.id] || 0) / 2, worthHand(duel, pl, cb.id));
            if (gain >= 400 && (!best || eff > best.atk)) best = { field: s, b, atk: eff };
          }
        }
        for (let a = 0; a < pl.hand.length; a++) for (let b = a + 1; b < pl.hand.length; b++) {
          const ca = CardDB.get(pl.hand[a]), cb = CardDB.get(pl.hand[b]);
          if (!ca || !cb || ca.kind !== "M" || cb.kind !== "M") continue;
          if (reserved.has(ca.id) || reserved.has(cb.id) || Duelists.KEEP.has(ca.id) || Duelists.KEEP.has(cb.id)) continue;
          const r = CardDB.fuse(ca.id, cb.id); if (!r) continue;
          const rc = CardDB.get(r);
          const need = CardDB.tributesFor(rc);
          if (need > onField && !(skill >= 3 && need === 1 && onField === 0 && rc.atk >= 2400)) continue; // keep a big card for later only when it is worth it
          const eff = worthHand(duel, pl, r), gain = eff - Math.max(worthHand(duel, pl, ca.id), worthHand(duel, pl, cb.id));
          if (gain >= (skill >= 3 ? 300 : 400) && (!best || eff > best.atk)) best = { a, b, atk: eff };
        }
        if (best) { st.fusions++; if (best.field !== undefined) duel.fuseField(pl, best.b, best.field); else duel.fuseHand(pl, best.b, best.a); return { type: "fuse" }; }
      }
      // ---- rituals (stage 2+): a free special summon paid mostly from the hand; do it when the result outclasses the field
      for (let h = 0; skill >= 2 && h < pl.hand.length; h++) {
        const c = CardDB.get(pl.hand[h]); if (!c || c.kind !== "R" || st.tried.has("rit" + h)) continue;
        const r = Effects.ritual[c.id]; if (!r) continue;
        const plan = ritualPlan(duel, pl, h, r); if (!plan) continue;
        if (pl.freeMonSlot() < 0 && !plan.usesField) continue;
        // a ritual is judged by the body it brings out, and a wall is a body: Millennium Shield is 0/3000,
        // Sengenjin 750/2500, and measuring them by ATK alone meant those rituals were never performed at all
        const rc = CardDB.get(r.result), rcW = ritBody(r.result);
        const paper = ritualNeedsTarget(r.result) && !absorbTarget(duel, pl, 0);   // a 0/0 absorber with nothing to absorb
        // the 300 margin is there so a ritual does not eat good monsters off the field for a small gain; when the
        // offerings come out of the hand there is nothing to lose, so any improvement is worth it
        const margin = plan.fieldLoss > 0 ? 300 : 0;
        const worth = !paper && rcW >= 1800 && rcW > Math.max(ownBest, plan.fieldLoss) + margin && (rcW >= enemyBest || enemyMons.length === 0 || Effects.special[rc.id]);
        st.tried.add("rit" + h);
        if (worth) { const res = duel.ritual(pl, { hand: h }, c.id); if (res.ok) return { type: "ritual" }; }
      }
      // ---- traps: set when possible, but never while a Jinzo is out to negate them
      for (let h = 0; !duel.jinzoOut() && h < pl.hand.length; h++) {
        const c = CardDB.get(pl.hand[h]); if (!c || c.kind !== "T") continue;
        if (pl.freeSpellSlot() >= 0 && !pl.spells.some((s) => s && s.id === c.id)) { duel.setSpell(pl, h); return { type: "set" }; }
      }
      // ---- spell cards
      for (let h = 0; h < pl.hand.length; h++) {
        const c = CardDB.get(pl.hand[h]); if (!c || c.kind !== "S") continue;
        const key = c.id + ":" + h; if (st.tried.has(key)) continue;
        const fx = Effects.magic[c.id]; if (!fx) continue;
        let use = false, target;
        switch (fx.kind) {
          case "heal": use = pl.lp <= 8000 - fx.amount * 0.8 && pl.lp < 5000; break;
          case "damage": use = true; break;
          // Toon World has no element aura to weigh: what it is worth is the Toons it lets past the board
          case "field":
            if (c.id === 823) use = duel.field !== 823 && pl.hand.concat(pl.monsters().map((x) => x.id)).some((x) => Effects.TOONS.has(x));
            else use = duel.field !== c.id && benefitsField(duel, pl, c.id) >= 2 && fieldGain(duel, pl, c.id) > 0;
            break;
          case "destroy":
            if (c.id === 336) use = enemyMons.length >= 2 && enemyBest > ownBest;
            else if (c.id === 337) use = enemyMons.length >= 2 || (enemyMons.length === 1 && enemyBest > ownBest);
            else if (c.id === 661) use = enemyMons.some((m) => m.faceUp && duel.atk(m) >= 1500) && enemyBest >= ownBest;
            else { const ty = { 329: "Dragon", 653: "Warrior", 656: "Zombie", 660: "Machine", 662: "Insect", 663: "Rock", 664: "Fish", 786: "Fiend", 787: "Magician" }[c.id]; use = enemyMons.filter((m) => m.faceUp && m.ty === ty).length >= 1 && enemyMons.some((m) => m.ty === ty && duel.atk(m) >= 1200); }
            break;
          case "equip": {
            // power up whichever monster ends up BIGGEST, not whichever is biggest now: Maha Vailo turns any
            // power-up into +1000, so the strongest body on the board is often the wrong place to put it. The ATK
            // is read off the engine with the equip pencilled in, so every aura and passive is counted too.
            // Elegant Egotist and Metalmorph turn one monster into a bigger one and merely power up anyone else,
            // so they fit everybody and their real worth is the monster that comes out.
            const MORPH = { 318: { 62: 63 }, 658: { 391: 392, 82: 742 } };
            const morph = MORPH[c.id];
            const afterEquip = (m) => {
              if (morph && morph[m.id]) { const r = CardDB.get(morph[m.id]); return r ? r.atk : duel.atk(m); }
              if (c.id === 657) { const was = m.doubled; m.doubled = true; const v = duel.atk(m); m.doubled = was; return v; }
              const n = (Effects.magic[c.id] && Effects.magic[c.id].levels) || 1;
              m.levels += n; const v = duel.atk(m); m.levels -= n; return v;
            };
            const fitsIt = (m) => (morph ? true : CardDB.equipFits(c.id, duel.liveCard(m)));
            let bestS = -1, bestA = -1;
            for (let i = 0; i < 5; i++) {
              const m = pl.mon[i];
              if (!m || !fitsIt(m) || (c.id === 657 && m.doubled)) continue;
              // the transform is worth more than the ATK says: the new body is permanent, where a power-up dies
              // with its monster and can be blown off the field by anything that destroys spells
              const v = afterEquip(m) + (morph && morph[m.id] ? 600 : 0);
              if (v > bestA && (m.pos === "atk" || bestS < 0)) { bestA = v; bestS = i; }
            }
            // a transforming equip waits for the monster it transforms, while there is still one to come
            if (morph && bestS >= 0 && !Object.keys(morph).some((id) => pl.mon.some((m) => m && m.id === +id))
                && pl.deck.concat(pl.hand).some((id) => morph[id])) bestS = -1;
            if (bestS >= 0 && (canBattle || skill <= 2)) { use = true; target = bestS; }
            break;
          }
          case "misc":
            if (c.id === 348) use = pl.swords === 0 && opp.swords === 0 && ((enemyMons.length > 0 && enemyBest > ownBest) || pl.monsters().some((m) => Effects.evolve[m.id] && enemyMons.length));
            else if (c.id === 349 || c.id === 669) use = enemyMons.length >= 2 || enemyBest > ownBest;
            else if (c.id === 350) use = enemyMons.some((m) => !m.faceUp) && skill >= 3;
            else if (c.id === 320) use = enemyMons.some((m) => m.pos === "def") && ownBest > enemyBest && canBattle;
            else if (c.id === 655) use = enemyMons.some((m) => m.levels > 0 || m.temp > 0);
            else if (c.id === 672) use = opp.spells.some((s) => s);
            else if (c.id === 781) use = enemyBest > ownBest && pl.freeMonSlot() >= 0 && enemyMons.some((m) => m.faceUp) && canBattle;
            else if (c.id === 784) use = enemyMons.length > 0 && pl.freeMonSlot() >= 0 && enemyBest >= 1500;
            else if (c.id === 785) { const k = pl.mon.findIndex((m) => m && m.id === 58), s = strongestSlot(duel, pl); if (pl.freeMonSlot() >= 0 && s >= 0 && (k >= 0 || duel.atk(pl.mon[s]) >= 1400)) { use = true; target = k >= 0 && pl.freeMonSlot() >= 0 && pl.monsters().length <= 2 ? k : s; } }
            else if (c.id === 652) use = pl.freeMonSlot() >= 0 && hasWall(pl) && (enemyMons.length > 0 || ownBest < 1600);
            else if (c.id === 813) { const best = pl.grave.reduce((b, x) => { const cc = CardDB.get(x); return cc && cc.kind === "M" && !Banlist.ritualOnly(x) ? Math.max(b, cc.atk) : b; }, 0); use = pl.freeMonSlot() >= 0 && best >= Math.max(1200, ownBest - 200); }
            else if (c.id === 789) use = pl.hand.length <= 3;
            // the second batch of added cards (the user's list, 2026-09-24)
            // an empty hand at the end of it - so never while holding a piece of Exodia, or the whole plan goes in the bin
            else if (c.id === 816) use = pl.hand.length <= 3 && pl.deck.length >= 3 && skill >= 2 && !pl.hand.some((x) => x >= 17 && x <= 21);
            else if (c.id === 818) { const best = [pl, opp].reduce((b, p) => p.grave.reduce((t, x) => { const cc = CardDB.get(x); return cc && cc.kind === "M" && !Banlist.ritualOnly(x) ? Math.max(t, cc.atk) : t; }, b), 0); use = pl.freeMonSlot() >= 0 && best >= Math.max(1200, ownBest - 200); }
            else if (c.id === 819) use = pl.freeMonSlot() >= 0 && pl.monsters().length < 2 && pl.deck.some((x) => { const cc = CardDB.get(x); return cc && cc.kind === "M" && !Banlist.ritualOnly(x); });
            else if (c.id === 820) use = pl.hand.length <= 5 && pl.deck.some((x) => { const cc = CardDB.get(x); return cc && cc.kind === "M" && cc.ty === "Warrior" && !Banlist.ritualOnly(x); });
            else if (c.id === 822) use = pl.hand.length <= 5 && pl.deck.some((x) => Effects.TOONS.has(x) || x === 823);

            else if (c.id === 790) use = opp.hand.length >= 2 || (opp.hand.length === 1 && skill >= 3);
            break;
        }
        st.tried.add(key);
        // the original AI played its spell cards rather erratically; lower-skill duelists sit on them more often
        const useChance = [0, 0.5, 0.65, 0.8, 0.85, 0.9][Math.min(5, skill)];
        if (use && Math.random() > useChance) use = false;
        if (use && fx.target === "ownMonster" && target === undefined) use = false;
        if (use) { const r = duel.activate(pl, { hand: h }, target); if (r.ok) return { type: "magic", id: c.id }; }
      }
      // ---- the one normal summon / set of the turn (plus the Toons' and The Fiend Megacyber's special summons)
      if (!st.tried.has("summon")) {
        let best = null;
        const mons = pl.monsters();
        for (let h = 0; h < pl.hand.length; h++) {
          const c = CardDB.get(pl.hand[h]); if (!c || c.kind !== "M" || Duelists.KEEP.has(c.id)) continue;
          const chk = duel.canSummon(pl, h); if (!chk.ok) continue;
          const need = chk.need;
          if (need > 0 && skill < 2) continue;           // rookies never offer monsters
          if (need > 1 && skill < 3) continue;
          let atk = duel.previewAtk(pl, c.id); if (c.id === 616 && canBattle) atk *= 2; // Hourglass of Courage
          const look = summonOutlook(duel, pl, c, atk, c.def, skill);                   // its own special fires the same turn
          atk = look.atk;
          let score = atk + look.def * 0.3;
          if (need > 0) {
            // the offerings are the weakest monsters out; never trade them for something that hits softer
            const order = mons.map((m) => worthField(duel, m)).sort((a, b) => a - b);
            const lost = need === 1 ? order[0] : order[0] + order[1];
            const worth = atk + c.def * 0.3 + (Effects.bonus[c.id] || 0) / 2;
            if (worth < lost + 300) continue;
            score -= lost * 0.4;
          }
          if (Effects.special[c.id]) score += 200;
          if (Effects.evolve[c.id]) score += 400;        // the moth line: what it becomes is the point
          if (Effects.bait.has(c.id)) score += 250;
          if (c.id === 752 && opp.spells.some((s) => s)) score += 400;                 // Jinzo shuts down what they have set
          score += bonusFor(pl, c.id) / 3;
          if (reserved.has(c.id)) score -= 5000; // last resort only
          if (!best || score > best.score) best = { h, c, need, score, atk, def: look.def, enemyBest: look.enemyBest };
        }
        if (best) {
          const tributes = [];
          for (let k = 0; k < best.need; k++) tributes.push(weakestSlot(duel, pl, tributes));
          const atk = best.atk, def = best.def, enemyTop = best.enemyBest;   // after its own special: a mimic is as big as their best
          // Summon face-up when it can attack profitably right now (or the enemy field is empty and we may attack);
          // Set face-down when it is a wall or would just die in attack position
          let pos = "atk";
          if (!canBattle) pos = def >= atk ? "def" : "atk";                    // turn 1 / swords: nothing to gain from attack position
          // Nothing to fight: a real body goes face up and hits the Life Points, but a small one is not worth the
          // exposure - 300 damage now against a full-power attack next turn - so it is set instead, unless that 300
          // happens to be lethal. (The user watched a Magician of Faith stand in attack and eat a hit, 2026-09-24.)
          else if (!enemyMons.length) pos = atk >= 1000 || opp.lp <= atk ? "atk" : "def";
          else if (atk > weakestEnemyAtk(duel, pl)) pos = "atk";               // can kill something now
          else if (atk >= 500 && canClearField(duel, pl, null)) pos = "atk";   // the rest of the field sweeps the enemy: join the direct hits
          else if (atk >= enemyTop) pos = "atk";                               // trades with the best they have (an even trade is a trade)
          else if (def > enemyTop || def > atk) pos = "def";                   // survives as a wall
          else pos = "def";
          if (Effects.bait.has(best.c.id) && atk < enemyBest && enemyMons.length) pos = "def"; // a wall the enemy will regret hitting
          if (Effects.evolve[best.c.id] && def >= atk) pos = "def";                            // a cocoon only has to survive
          if (Effects.needFaceUp.has(best.c.id)) pos = "atk";   // set, it can never take or destroy anything
          if (skill <= 1 && Math.random() < 0.3) pos = "atk";
          const r = duel.summon(pl, best.h, pos, tributes);
          if (r.ok) return { type: "summon" }; // next step: another look (a Toon can still follow the normal summon)
        }
        st.tried.add("summon");
      }
      // ---- monster specials
      for (let s = 0; s < 5; s++) {
        // a monster with only a SECOND ability (Time Wizard, since it stopped turning Baby Dragons) has to get in
        // here too, or its block further down is never reached at all
        const m = pl.mon[s]; if (!m || (!Effects.special[m.id] && !Effects.special2[m.id]) || st.tried.has("sp" + s)) continue;
        st.tried.add("sp" + s);
        const id = m.id;
        let use = false;
        if (id === 731 || id === 734) use = enemyMons.length > 0;
        else if (id === 9 || id === 24 || id === 195) use = pl.freeMonSlot() >= 0 && pl.monsters().length <= 3;          // a copy of itself
        else if (id === 84) use = opp.spells.some((s) => s);
        else if ([117, 140, 186, 249, 387].includes(id)) use = pl.freeMonSlot() >= 0;                                     // a free monster from outside the deck
        else if (id === 154) use = true;
        else if (id === 185) { // Eyearmor copies the strongest enemy: any gain on the side it is fighting from is worth taking
          const top = enemyMons.filter((x) => x.faceUp).sort((p, q) => duel.atk(q) - duel.atk(p))[0];
          use = !!top && (m.pos === "atk" ? duel.atk(top) > duel.atk(m) : duel.def(top) > duel.def(m));
        }
        else if (id === 366) use = pl.freeMonSlot() >= 0;                                   // Labyrinth Wall calls the maze out
        else if (id === 73) use = pl.hand.length <= 5 && pl.deck.some((x) => { const c = CardDB.get(x); return c && c.kind === "S" && (x === 334 || (CardDB.isEquip(x) && CardDB.equipFits(x, CardDB.get(70)))); });
        else if (id === 806) { // Junk Synchron pulls anything back out of the graveyard
          use = pl.freeMonSlot() >= 0 && pl.grave.some((x) => { const c = CardDB.get(x); return c && c.kind === "M" && !Banlist.ritualOnly(x); });
        }
        else if (id === 187) use = pl.freeMonSlot() >= 0 && pl.summoned && pl.hand.some((x) => { const c = CardDB.get(x); return c && c.kind === "M" && !reserved.has(x) && c.atk >= 1000; });
        else if (id === 363) use = pl.lp <= 7000;
        else if (id === 525) use = duel.field !== 332 && fieldGain(duel, pl, 332) > 0 && !fieldCosts(duel, m, 332);
        else if (id === 637) use = duel.field !== 330 && fieldGain(duel, pl, 330) > 0 && !fieldCosts(duel, m, 330);
        else if (id === 364) use = enemyMons.length > 0 && !(enemyMons.length === 1 && enemyMons[0].faceUp && PAYS_ANYWAY.has(enemyMons[0].id)); // free and repeatable: clear the way, but do not set off a card that wants to die
        else if (id === 15) use = enemyMons.some((x) => x.faceUp && x.ty === "Dinosaur");
        // once per duel, so it waits for something worth spending it on: a blocker as big as us, a 1800+ body, or the
        // last thing between us and the win. (The Blue-eyes joined this list when its Burst became once a duel.)
        else if (id === 22 || id === 1) {
          // it always takes their biggest, so judge THAT card: is it a problem battle cannot deal with?
          const t = opp.monsters().reduce((b, x) => (!b || duel.atk(x) > duel.atk(b) ? x : b), null);
          use = worthRemoving(duel, pl, t) > 0 || (!!t && enemyMons.length === 1 && opp.lp <= ownBest);
        }
        else if (id === 35 || id === 817) use = pl.hand.length <= 6 && pl.deck.some((x) => CardDB.get(x).kind === "S");
        else if (id === 40) use = pl.freeMonSlot() >= 0 && enemyMons.some((x) => x.faceUp && x.ty === "Dragon");
        else if (id === 65) use = pl.deck.includes(337);
        else if (id === 62) use = pl.hand.length <= 6 && pl.deck.some((x) => [63, 386, 318, 316, 317, 321].includes(x));
        else if (id === 102) use = pl.freeSpellSlot() >= 0 && pl.grave.some((x) => CardDB.get(x).kind === "T");
        else if (id === 720) { const t = topSeen(duel, pl); use = !!t && pl.freeMonSlot() >= 0 && (duel.atk(t) >= 1800 || duel.atk(t) > ownBest); } // once per duel: take something worth keeping
        else if (id === 217) { const t = topSeen(duel, pl); use = !!t && !PAYS_ANYWAY.has(t.id) && (duel.atk(t) >= 1500 || duel.atk(t) >= duel.atk(m) || opp.lp <= duel.atk(t)); } // once per duel, and the burn is the target ATK: pick a big one
        else if (id === 224 || id === 744 || id === 469 || id === 586) use = opp.spells.some((s) => s);
        else if (id === 229) use = pl.lp <= 7000;
        else if (id === 462) use = duel.jinzoOut() || !opp.spells.some((x) => x) || pl.lp <= 3000;
        else if (id === 262) use = canBattle && pl.monsters().some((x) => x !== m && duel.atk(x) <= 700 && !Effects.bait.has(x.id));
        else if (id === 266) use = opp.spells.filter((s) => s).length >= 2 || (opp.spells.some((s) => s) && opp.lp <= 500);
        else if (id === 376 || id === 166 || id === 715) use = enemyMons.length > 0 && pl.freeMonSlot() >= 0 && enemyBest >= 1200;
        else if (id === 417) { const t = topSeen(duel, pl); use = !!t && !PAYS_ANYWAY.has(t.id) && (duel.atk(t) >= duel.atk(m) + 400 || (enemyMons.length === 1 && opp.lp <= ownBest && canBattle)); } // it offers itself: trade up, or open the way for the kill
        else if (id === 420) { // Cyber-Stein: the ritual monster its own rule picks out of the deck, for nothing
          let pick = 0, pickAtk = -1;
          for (const x of pl.deck) { const r = Effects.ritual[x]; if (!r) continue; const c = CardDB.get(r.result); if (c && c.atk > pickAtk) { pickAtk = c.atk; pick = r.result; } }
          const worth = pick ? ritBody(pick) : 0;
          const ready = !ritualNeedsTarget(pick) || !!absorbTarget(duel, pl, 1200);   // Relinquished waits for a meal
          use = skill >= 2 && pl.freeMonSlot() >= 0 && worth >= 1600 && ready;   // free now, so anything worth a body is worth doing
        }
        else if (id === 490) use = true;
        else if (id === 500) use = enemyMons.some((x) => x.faceUp && x.ty === "Dragon");
        else if (id === 506) use = enemyMons.some((x) => x.faceUp && Banlist.ritualOnly(x.id) && x.id !== 369);
        else if (id === 512) { // Cannon Soldier offers our weakest monster for 500: for the kill, or from a board that can spare it
          const spare = pl.monsters().filter((x) => x !== m && duel.atk(x) <= 600 && !Effects.bait.has(x.id) && !Effects.direct.has(x.id));
          use = opp.lp <= 500 || (spare.length > 0 && (!enemyMons.length || pl.monsters().length > enemyMons.length + 1));
        }
        else if (id === 540) use = pl.hand.length <= 5 && pl.deck.length > 3;
        else if (id === 583) use = pl.swords > 0;
        else if (id === 641) use = enemyMons.some((x) => x.faceUp) && enemyBest > duel.atk(m) + 500;
        else if (id === 721) use = pl.hand.length <= 5 && (pl.grave.some((x) => CardDB.get(x).kind === "S") || pl.deck.some((x) => CardDB.get(x).kind === "S"));
        else if (id === 739 || id === 741) { const ty = id === 739 ? "Magician" : "Dragon"; use = pl.freeMonSlot() >= 0 && pl.summoned && pl.hand.some((x) => { const c = CardDB.get(x); return c && c.kind === "M" && c.ty === ty && !reserved.has(x); }); }
        // Barrel Dragon aims like the once-per-duel removals do (the user's rule, 2026-09-24). It is free and
        // repeatable, so the cost of waiting is nothing - and at 2600 it beats a plain body in battle anyway, which
        // is why a coin flip is worth keeping for what battle cannot answer.
        else if (id === 743) {
          const t = opp.monsters().reduce((b, x) => (!b || duel.atk(x) > duel.atk(b) ? x : b), null);
          use = worthRemoving(duel, pl, t) > 0 || (!!t && enemyMons.length === 1 && opp.lp <= ownBest);
        }
        else if (id === 749) use = pl.hand.length <= 6 && pl.deck.includes(747);
        else if (id === 754) use = enemyMons.some((x) => x.levels > 0 || x.temp > 0 || x.doubled);
        else if (id === 762) use = pl.freeMonSlot() >= 0 && enemyMons.some((x) => x.faceUp && x.ty === "Insect");
        else if (id === 429) use = m.whim !== 2 && duel.atk(m) <= 1000 && (enemyBest > duel.atk(m) || !enemyMons.length);
        else if (id === 83) { // Castle hides our field: a bluff worth making only when the battle phase has nothing in it
          const swing = canBattle && pl.monsters().some((x) => x.pos === "atk" && x.canAttack && !x.attackedThisTurn && bestAttackValue(duel, pl, duel.atk(x), skill, x) > 0);
          use = pl.monsters().filter((x) => x.faceUp && x !== m).length >= 2 && enemyBest >= ownBest && !swing;
        }
        else if (id === 723) use = enemyMons.some((x) => x.faceUp) && enemyBest >= ownBest && enemyBest <= ownBest + 500; // Slot Machine: a coin flip that can turn the top matchup
        else if (id === 26) use = enemyMons.some((x) => x.faceUp && (x.el === "Pyro" || x.ty === "Pyro"));
        else if (id === 39 || id === 37) use = duel.field !== 332 && fieldGain(duel, pl, 332) > 0 && !fieldCosts(duel, m, 332);
        else if (id === 74) use = duel.field && benefitsField(duel, pl, duel.field) < 0;
        else if (id === 89) { // Catapult Turtle fires our best other monster for half its ATK: for the kill, or when that monster is stuck anyway
          const top = pl.monsters().filter((x) => x !== m).sort((a, b) => duel.atk(b) - duel.atk(a))[0];
          const dmg = top ? Math.floor(duel.atk(top) / 2) : 0;
          const stuck = !!top && (top.frozen > 0 || !canBattle || (top.pos === "atk" && !top.canAttack && !top.attackedThisTurn));
          use = dmg > 0 && (opp.lp <= dmg || (stuck && dmg >= 1000));
        }
        else if (id === 732) { const dmg = pl.monsters().reduce((t, x) => t + (x === m ? 0 : Math.floor(duel.atk(x) / 2)), 0); use = dmg > 0 && opp.lp <= dmg; } // Jigen Bakudan blows up our own field: only when that wins
        else if (id === 428 || id === 48) use = pl.hand.length <= 3;
        else if (id === 402) use = opp.hand.length >= 1;
        if (use) { const r = duel.special(pl, s); if (r.ok) return { type: "special", id }; }
        if (id === 586 && Effects.special2[id] && !st.tried.has("sp2" + s) && !m.usedSpecial && !opp.spells.some((x) => x)) {
          const top = enemyMons.filter((x) => x.faceUp).sort((p, q) => duel.atk(q) - duel.atk(p))[0];
          if (top && (m.pos === "atk" ? duel.atk(top) > duel.atk(m) : duel.def(top) > duel.def(m))) {
            st.tried.add("sp2" + s); const r = duel.special(pl, s, true); if (r.ok) return { type: "special", id };
          }
        }
        // Time Wizard wipes their whole board once a duel, so it asks the same question the single-target removals
        // ask - is anything over there worth it? - plus the obvious one: two monsters at a time is always worth it.
        if (id === 16 && Effects.special2[id] && skill >= 2 && !st.tried.has("sp2" + s) && !pl.onceUsed.has(16)) {
          st.tried.add("sp2" + s);
          const worth = enemyMons.length >= 2 || opp.monsters().some((x) => worthRemoving(duel, pl, x) > 0);
          if (worth) { const r = duel.special(pl, s, true); if (r.ok) return { type: "special", id }; }
        }
      }
      st.phase = "battle";
    }

    if (st.phase === "battle") {
      const reckless = duel.quietTurns >= 6;
      if (reckless && canBattle) { // nothing has happened for ages: bring everything into attack position
        for (let s = 0; s < 5; s++) { const m = pl.mon[s]; if (m && m.pos === "def" && !m.turnedThisTurn && !st.tried.has("rpos" + s)) { st.tried.add("rpos" + s); if (duel.changePos(pl, s).ok) return { type: "pos" }; } }
      }
      const standing = opp.monsters().length;                 // a monster died since the last step: everyone looks again
      if (st.enemyCount !== undefined && st.enemyCount !== standing) { st.attacked.clear(); st.tried.delete("wall"); }
      st.enemyCount = standing;
      if (canBattle) {
        // weakest first: whoever can already beat a target takes it, and the big monsters are left for the
        // targets that need them (this is also what a Gate Guardian's shield wants - it eats the smallest attack)
        const order = [0, 1, 2, 3, 4].filter((s) => pl.mon[s]).sort((a, b) => duel.atk(pl.mon[a]) - duel.atk(pl.mon[b]));
        for (const s of order) {
          const m = pl.mon[s]; if (!m) continue;
          const key = m.uid + ":" + m.attacksMade; if (st.attacked.has(key)) continue;
          if (!duel.canAttackWith(pl, s).ok) continue;
          const A = duel.atk(m);
          const enemy = opp.monsters();
          if (!enemy.length) { st.attacked.add(key); duel.attack(pl, s, null); return { type: "attack" }; }
          if (Effects.direct.has(m.id) && duel.live(m)) { st.attacked.add(key); duel.attack(pl, s, null); return { type: "attack" }; }
          // pick the best target
          let bestT = -1, bestV = -1e9;
          for (let t = 0; t < 5; t++) {
            const d = opp.mon[t]; if (!d) continue;
            const v = attackValue(duel, pl, m, A, d, skill);
            if (v > bestV) { bestV = v; bestT = t; }
          }
          if (bestT >= 0 && (bestV > (skill >= 2 ? 0 : -200) || reckless)) { st.attacked.add(key); duel.attack(pl, s, bestT); return { type: "attack" }; }
          st.attacked.add(key); // decided not to attack with this one
        }
      }
      // ---- breaking a wall: a monster that takes its killer down with it (Steel Scorpion and friends) is never
      // worth attacking on its own, so a field of them leaves everyone standing still. When nothing else was worth
      // doing, the cheapest monster we have buys the way through and the rest hit the Life Points directly.
      if (canBattle) {
        const wall = opp.monsters();
        const free = [0, 1, 2, 3, 4].filter((s) => pl.mon[s] && pl.mon[s].pos === "atk" && !pl.mon[s].attackedThisTurn && duel.canAttackWith(pl, s).ok);
        if (wall.length && free.length > wall.length && !st.tried.has("wall")) {
          const beats = (m, d) => duel.canTarget(d) && duel.atk(m) > (d.pos === "atk" ? duel.atk(d) : duel.def(d));
          const cheapest = free.slice().sort((a, b) => worthField(duel, pl.mon[a]) - worthField(duel, pl.mon[b]));
          const used = new Set(), pairs = []; let can = true;
          for (const d of wall) {
            if (d.id === 768) { can = false; break; }                       // The Unhappy Maiden ends our turn as it dies
            const pick = cheapest.find((x) => !used.has(x) && beats(pl.mon[x], d));
            if (pick === undefined) { can = false; break; }
            used.add(pick); pairs.push({ s: pick, d });
          }
          const rest = free.filter((x) => !used.has(x));
          if (can && rest.length) {
            const cost = pairs.reduce((t, x) => t + (Effects.retaliate.has(x.d.id) || x.d.id === 736 ? worthField(duel, pl.mon[x.s]) : 0), 0);
            const gain = rest.reduce((t, x) => t + duel.atk(pl.mon[x]), 0);
            if (gain > cost * 0.6) {   // the wall is gone for good: it does not have to pay for itself this turn alone
              const first = pairs[0], t = opp.mon.indexOf(first.d);
              const r = t >= 0 ? duel.attack(pl, first.s, t) : { ok: false };
              if (r.ok) { st.attacked.add(pl.mon[first.s] ? pl.mon[first.s].uid + ":" + pl.mon[first.s].attacksMade : "gone"); return { type: "attack" }; }
              st.tried.add("wall");
            } else st.tried.add("wall");
          } else st.tried.add("wall");
        }
      }
      // defensive repositioning: attack-position monsters that did not attack hide when outgunned
      for (let s = 0; s < 5 && !reckless; s++) {
        const m = pl.mon[s]; if (!m || m.turnedThisTurn || m.attackedThisTurn || st.tried.has("pos" + s)) continue;
        st.tried.add("pos" + s);
        const A = Math.max(duel.atk(m), liveOutlook(duel, pl, m, skill).atk), Dd = duel.def(m);
        if (m.pos === "atk" && A < enemyBest && Dd > A && opp.monsters().length) { if (duel.changePos(pl, s).ok) return { type: "pos" }; }
      }
      // the hand refills to 5 every turn, so a dead card kept in a full hand only blocks a fresh draw: throw the least
      // useful one away (rookies only do it when stuck; nobody does it with the deck nearly gone)
      // (when genuinely stuck - nothing played and nothing happening - it discards even with the deck nearly gone, so a
      // dead game ends by deck-out instead of looping forever)
      // a card that PAYS to be thrown away is thrown away the moment it can be: Electric Snake draws two for
      // itself, Thunder Dragon fetches its own copies. Neither is a discard, it is a card the hand plays.
      if (!st.discarded && skill >= 2 && pl.deck.length > 2) {
        const h = pl.hand.findIndex((id) => (id === 463 && pl.deck.length >= 2) || (id === 425 && pl.deck.includes(425)));
        if (h >= 0) { st.discarded = true; duel.discard(pl, h); return { type: "discard" }; }
      }
      const stuck = !pl.summoned && duel.quietTurns >= 1;
      if (pl.hand.length >= 5 && !st.discarded && (stuck || (pl.deck.length > 6 && skill >= 2))) {
        let worst = -1, wv = 1e9;
        for (let h = 0; h < pl.hand.length; h++) { const v = handCardValue(duel, pl, pl.hand[h]); if (v < wv) { wv = v; worst = h; } }
        if (worst >= 0 && !Duelists.KEEP.has(pl.hand[worst]) && (wv < 1500 || stuck)) { st.discarded = true; duel.discard(pl, worst); return { type: "discard" }; }
      }
      if (duel.mustDiscard(pl)) return discardWorst(duel, pl); // end phase: down to 5 cards
      duel.endTurn();
      return { type: "end" };
    }
    if (duel.mustDiscard(pl)) return discardWorst(duel, pl);
    duel.endTurn();
    return { type: "end" };
  };
  function discardWorst(duel, pl) {
    let worst = 0, wv = 1e9;
    for (let h = 0; h < pl.hand.length; h++) { const v = handCardValue(duel, pl, pl.hand[h]); if (v < wv) { wv = v; worst = h; } }
    duel.discard(pl, worst); return { type: "discard" };
  }
  window.AI = AI;
})();
