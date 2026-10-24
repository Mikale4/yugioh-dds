// Starter decks: every new game rolls three themed 40-card decks and the player keeps one. A roll always has the same
// shape (a boss, three cheap effect cards to learn from, theme monsters, plain neutrals, a themed field and equip and a
// few beginner spells) and is re-rolled until it fits a narrow power band, so no start is dead and no start is a gift.
(function () {
  const THEMES = [
    { key: "dragon", name: "Dragon", blurb: "Dragons, Mountain", types: ["Dragon"], field: 332, equips: [315] },
    { key: "warrior", name: "Warrior", blurb: "Warriors, Meadow", types: ["Warrior", "BeastWar"], field: 333, equips: [301, 319] },
    { key: "beast", name: "Beast", blurb: "Beasts, Forest", types: ["Beast", "BeastWar", "WngBeast"], field: 330, equips: [319, 308, 327] },
    { key: "fiend", name: "Fiend", blurb: "Fiends, Zombies", types: ["Fiend", "Zombie"], field: 335, equips: [303, 322] },
    { key: "aqua", name: "Aqua", blurb: "Sea creatures", types: ["Aqua", "Fish", "SeaDragn"], field: 334, equips: [328, 309] },
    { key: "insect", name: "Insect", blurb: "Insects, Plants", types: ["Insect", "Plant"], field: 330, equips: [305, 310] },
    { key: "machine", name: "Machine", blurb: "Machines, Thunder", types: ["Machine", "Thunder"], field: 332, equips: [325] },
    { key: "magician", name: "Magician", blurb: "Magicians, Dark", types: ["Magician"], field: 335, equips: [323, 307] },
    { key: "rock", name: "Rock", blurb: "Rocks, Dinosaurs", types: ["Rock", "Dinosaur"], field: 331, equips: [324, 326] },
  ];
  const SHAPE = { monsters: 32, theme: 18, neutral: 10, teach: 3, boss: 1, spells: 8 };
  // cheap effect monsters a beginner can learn from: one direct attacker, one "slain in battle" card, one utility
  const TEACH = [
    [397, 422, 410, 527, 635, 484, 488, 398],           // attack the LP directly
    [540, 102, 541, 547, 229],                          // Skelengel, Mask of Darkness, Hane-Hane, Griggle, Hourglass of Life
    [148, 179, 263, 285, 154, 363, 583, 264, 536],      // walls whose fall stops the enemy attacking, and the untargetables
  ];
  const BEGINNER_SPELLS = [338, 339, 343, 344, 345, 350, 681, 682]; // small heals, small burns, Darkness Approaches, small trap holes
  const BAND = { atkMin: 1000, atkMax: 1250, maxAtk: 1700, bossMin: 1800, bossMax: 2050, fusions: 3, bonus: 1500, equipFits: 8 };
  // Every starter is also handed three cards with real power in them, rolled at random (the user's rule, 2026-09-24):
  // one big plain body, one power spell and one real trap, so no beginner deck is 40 cards of 400 ATK filler. They go
  // in AFTER the power band has been measured - the band judges the deck the theme builds, not the three it is given -
  // and they take the place of the three weakest cards, so the deck is still 40.
  const POWER_SPELLS = [337, 336, 348, 661, 672, 789, 784, 781, 342];   // Raigeki, Dark Hole, Swords, Crush Card,
                                                                         // Feather Duster, Pot of Greed, Change of
                                                                         // Heart, Brain Control, Dian Keto
  const POWER_TRAPS = [814, 686, 685, 815, 684];                        // Mirror Force, Widespread Ruin, Acid Trap
                                                                         // Hole, Trap Hole, Invisible Wire

  const rnd = (n) => Math.floor(Math.random() * n);
  const pick = (arr) => arr[rnd(arr.length)];
  const plain = (c) => c.kind === "M" && Banlist.limit(c.id) === 3 && !Banlist.ritualOnly(c.id) && (Effects.bonus[c.id] || 0) <= 300;
  const noEffect = (c) => !Effects.isEffect(c.id);
  let pools = null;
  function buildPools() {
    pools = {};
    for (const t of THEMES) {
      pools[t.key] = {
        mons: CardDB.all.filter((c) => plain(c) && t.types.includes(c.ty) && c.atk >= 300 && c.atk <= BAND.maxAtk),
        boss: CardDB.all.filter((c) => plain(c) && noEffect(c) && t.types.includes(c.ty) && c.atk >= BAND.bossMin && c.atk <= BAND.bossMax),
      };
    }
    pools.neutral = CardDB.all.filter((c) => plain(c) && noEffect(c) && c.atk >= 900 && c.atk <= 1400);
    return pools;
  }
  // draws n cards from a pool with at most `max` copies of any one card
  function draw(pool, n, max, count, prefer) {
    const out = [];
    for (let guard = 0; out.length < n && guard < 400; guard++) {
      const c = prefer && Math.random() < 0.5 && prefer.length ? pick(prefer) : pick(pool);
      if ((count[c.id] || 0) >= max) continue;
      count[c.id] = (count[c.id] || 0) + 1; out.push(c.id);
    }
    return out;
  }
  function fusionPairs(deck) {
    const ids = [...new Set(deck.filter((id) => CardDB.get(id).kind === "M"))]; let n = 0;
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) if (CardDB.fuse(ids[i], ids[j])) n++;
    return n;
  }
  function measure(deck) {
    const mons = deck.map((id) => CardDB.get(id)).filter((c) => c.kind === "M");
    const atk = mons.reduce((s, c) => s + c.atk, 0) / Math.max(1, mons.length);
    const bonus = deck.reduce((s, id) => s + (Effects.bonus[id] || 0), 0);
    return { avgAtk: Math.round(atk), monsters: mons.length, spells: deck.length - mons.length, fusions: fusionPairs(deck), bonus };
  }
  function attempt(t, loose) {
    const P = pools || buildPools(), count = {};
    const deck = [];
    const boss = P[t.key].boss.length ? pick(P[t.key].boss) : null;
    if (boss) { deck.push(boss.id); count[boss.id] = 1; }
    // teaching cards: one of each kind, a same-type one when the theme has it
    for (const group of TEACH) {
      const cards = group.map((id) => CardDB.get(id)).filter((c) => c && !count[c.id]);
      const same = cards.filter((c) => t.types.includes(c.ty));
      const c = same.length && Math.random() < 0.7 ? pick(same) : pick(cards);
      deck.push(c.id); count[c.id] = 1;
    }
    deck.push(...draw(P[t.key].mons, SHAPE.theme + (boss ? 0 : 1), 2, count, P[t.key].mons.filter((c) => c.atk >= 700)));
    deck.push(...draw(P.neutral, SHAPE.monsters - deck.length, 2, count));
    // spells: the theme's field, the equip that fits the most, a 500 and a 200 heal, a small trap hole, a burn, two more
    const mons = deck.map((id) => CardDB.get(id));
    const equip = t.equips.map((id) => ({ id, fits: mons.filter((c) => CardDB.equipFits(id, c)).length })).sort((a, b) => b.fits - a.fits)[0];
    deck.push(t.field, equip.id, 339, 338, 681, 344);
    const extra = BEGINNER_SPELLS.filter((id) => id !== 681 && id !== 344); count[339] = 1; count[338] = 1; count[681] = 1; count[344] = 1;
    deck.push(...draw(extra.map((id) => CardDB.get(id)), 40 - deck.length, 2, count));
    const m = measure(deck);
    // a thin theme pool (there are only eleven cheap Dragons) can miss the band many times in a row, so later
    // attempts accept a slightly wider spread rather than falling back to the cartridge's deck
    const slack = loose ? 120 : 0;
    const ok = deck.length === 40 && m.avgAtk >= BAND.atkMin - slack && m.avgAtk <= BAND.atkMax + slack && m.fusions >= BAND.fusions && m.bonus <= BAND.bonus + slack * 2 && equip.fits >= BAND.equipFits - (loose ? 2 : 0)
      && mons.every((c) => c.atk <= BAND.maxAtk || (boss && c.id === boss.id));
    return { ok, deck, boss: boss ? boss.id : deck[0], equip: equip.id, m };
  }
  // three cards that show what the deck is about: the boss, the strongest theme monster, the field
  function signature(t, r) {
    const mons = r.deck.filter((id) => id !== r.boss && CardDB.get(id).kind === "M" && t.types.includes(CardDB.get(id).ty)).sort((a, b) => CardDB.get(b).atk - CardDB.get(a).atk);
    return [r.boss, mons[0] || r.deck[1], t.field];
  }
  // the big bodies anyone can play: no effect to build around, nobody's calling card, and never a ritual monster
  let powerMons = null;
  function strongMonsters() {
    if (!powerMons) {
      const sig = new Set();
      const owned = (window.Duelists && Duelists.SIGNATURE_OF) || {};
      for (const k in owned) for (const id of owned[k]) sig.add(id);
      powerMons = CardDB.all.filter((c) => c.kind === "M" && Banlist.limit(c.id) > 0 && !Banlist.ritualOnly(c.id) && noEffect(c) && c.atk >= 1900 && !sig.has(c.id));
    }
    return powerMons;
  }
  // swap the three weakest cards for a strong monster, a strong spell and a strong trap
  function withPower(deck, t) {
    const out = deck.slice();
    const room = (id) => out.filter((x) => x === id).length < Banlist.limit(id);
    const mons = strongMonsters();
    const same = mons.filter((c) => t && t.types.includes(c.ty));
    // something the deck has not already got, so the gift is a second card to play with and not a second copy
    const roll = (list) => {
      const ids = list.map((c) => (c && c.id !== undefined ? c.id : c));
      const fresh = ids.filter((id) => room(id) && !out.includes(id));
      const any = ids.filter((id) => room(id));
      return fresh.length ? pick(fresh) : any.length ? pick(any) : null;
    };
    const gifts = [roll(same.length ? same : mons), roll(POWER_SPELLS), roll(POWER_TRAPS)].filter((id) => id !== null);
    // What goes: the weakest monsters first (a beginner deck can spare a 300 ATK body sooner than a spell) - but never
    // the last copy of a monster that fuses with another in the deck, or the roll loses the fusion pairs the band
    // just checked for.
    const ids = [...new Set(out.filter((id) => CardDB.get(id).kind === "M"))];
    const pairs = new Set();
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) if (CardDB.fuse(ids[i], ids[j])) { pairs.add(ids[i]); pairs.add(ids[j]); }
    const left = {}; for (const id of out) left[id] = (left[id] || 0) + 1;
    const taken = new Set();
    for (const gift of gifts) {
      let best = -1, bv = 1e9;
      for (let i = 0; i < out.length; i++) {
        const c = CardDB.get(out[i]);
        if (c.kind !== "M" || taken.has(i)) continue;                       // only ever a monster: the field and the
        const last = pairs.has(out[i]) && left[out[i]] <= 1;                // equip are what the theme is built on
        const v = c.atk + (last ? 1e5 : 0);                                 // the last half of a fusion goes last
        if (v < bv) { bv = v; best = i; }
      }
      if (best < 0) break;
      left[out[best]]--; taken.add(best); out[best] = gift;
    }
    return out;
  }
  const Starters = {
    THEMES, SHAPE, BAND, measure, fusionPairs, withPower, strongMonsters,
    // one themed deck inside the power band (the cartridge's own starter when the dice refuse to cooperate)
    roll(theme) {
      const t = typeof theme === "string" ? THEMES.find((x) => x.key === theme) : theme || pick(THEMES);
      for (let i = 0; i < 150; i++) {
        const r = attempt(t, i >= 50);
        if (!r.ok) continue;
        const deck = withPower(r.deck, t);
        return { theme: t, deck, cards: signature(t, r), m: measure(deck) };
      }
      const deck = withPower(Duelists.starterDeck(), t);
      return { theme: t, deck, cards: [deck[0], deck[1], t.field], m: measure(deck), fallback: true };
    },
    // three different themes to choose from
    rollThree() {
      const keys = THEMES.map((t) => t.key).sort(() => Math.random() - 0.5).slice(0, 3);
      return keys.map((k) => this.roll(k));
    },
  };
  window.Starters = Starters;
})();
