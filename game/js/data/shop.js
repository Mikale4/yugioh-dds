// The card shop economy: rarity tiers, buy/sell prices, the 10-card stock that renews every 10 duels, and what
// duelists pay out when beaten. The currency is called Domino.
(function () {
  const NAMES = ["Common", "Uncommon", "Rare", "Super Rare", "Ultra Rare"];
  const GC = (window.G && window.G.C) || {};
  const COLORS = [GC.black, GC.green, GC.blue, GC.purple, GC.red];
  const PRICE = [80, 200, 500, 1200, 3000];   // buy price per tier
  const WEIGHT = [50, 28, 14, 6, 2];          // chance of each tier showing up in the stock
  const STOCK = 10, REFRESH = 10;             // cards on the shelf, duels between restocks
  const REROLL = [0, 250];                    // what the shopkeeper charges to restock early: the first one is free
  const PAY = [0, 200, 350, 550, 850];        // Domino for beating a duelist of each stage (hidden ones: 1000)
  // The rest of what a duel pays is worked out by Bonus.forDuel: damage, monsters destroyed, how it finished.
  // spells and traps that are worth more (or less) than their kind suggests
  const SPELL_TIER = {
    337: 4, 784: 4, 336: 4, 342: 4, 348: 4, 789: 4, 781: 4, 672: 4, 657: 4,
    661: 3, 686: 3, 685: 3, 669: 3, 347: 3, 341: 3, 785: 3, 790: 3,
    684: 2, 349: 2, 346: 2, 340: 2, 788: 2, 320: 2, 683: 2, 652: 2,
    682: 1, 681: 1, 782: 1, 687: 1, 688: 1, 689: 1, 690: 1,
    338: 0, 339: 0, 343: 0, 344: 0, 345: 0, 350: 0, 655: 0,
    814: 4, 813: 3, 815: 2,   // Mirror Force, Call of the Haunted, Trap Hole
    // the second batch (2026-09-24): the three Limited ones sit at the top of the shelf, the searchers below them
    818: 4, 819: 4, 816: 4, 823: 3, 822: 2, 820: 2,
  };
  function rarity(id) {
    const c = CardDB.get(id); if (!c) return 0;
    if (c.kind === "M") {
      if (id >= 17 && id <= 21) return 4; // the Exodia pieces
      const a = Math.max(c.atk, c.def * 0.8);
      let t = a >= 2800 ? 4 : a >= 2300 ? 3 : a >= 1800 ? 2 : a >= 1300 ? 1 : 0;
      const bonus = Effects.bonus[id] || 0;
      if (Effects.isEffect(id) && t < 4) t++;
      if (bonus >= 900 && t < 3) t = 3; else if (bonus >= 500 && t < 2) t = 2; // strong effects sell dearly
      // Scarcity is the price now (2026-09-23): with no offerings to pay, what a big monster costs you is that the
      // limit list only lets you deck one. A card you may hold once is the rarest thing in the shop.
      const copies = Banlist.limit(id);
      if (copies === 1 && t < 4) t = 4;
      else if (copies === 2 && t < 3) t = 3;
      return t;
    }
    if (c.kind === "R") { const r = Effects.ritual[id], res = r && CardDB.get(r.result), a = res ? res.atk : 0; return a >= 2800 ? 4 : a >= 2300 ? 3 : a >= 1900 ? 2 : 1; }
    if (SPELL_TIER[id] !== undefined) return SPELL_TIER[id];
    const fx = Effects.magic[id];
    if (fx && fx.kind === "equip") return 1;
    if (fx && fx.kind === "field") return 1;
    if (fx && fx.kind === "destroy") return 2;
    if (fx && fx.kind === "heal") return fx.amount >= 1000 ? 2 : 0;
    if (fx && fx.kind === "damage") return fx.amount >= 500 ? 2 : 0;
    return 1;
  }
  const price = (id) => PRICE[rarity(id)];
  const sellPrice = (id) => Math.max(10, Math.floor(PRICE[rarity(id)] / 4 / 10) * 10);
  // everything that can appear on the shelf: real deck cards (ritual monsters are never sold, their ritual cards are)
  let byTier = null;
  function pools() {
    if (!byTier) { byTier = [[], [], [], [], []]; for (const c of CardDB.all) if (Banlist.limit(c.id) > 0) byTier[rarity(c.id)].push(c.id); }
    return byTier;
  }
  function rollStock() {
    const tiers = pools(), total = WEIGHT.reduce((a, b) => a + b, 0), out = [];
    for (let guard = 0; out.length < STOCK && guard < 500; guard++) {
      let r = Math.random() * total, t = 0; while (t < 4 && r >= WEIGHT[t]) { r -= WEIGHT[t]; t++; }
      const pool = tiers[t]; if (!pool.length) continue;
      const id = pool[Math.floor(Math.random() * pool.length)];
      if (out.some((s) => s.id === id)) continue;
      out.push({ id, sold: false });
    }
    out.sort((a, b) => (rarity(a.id) - rarity(b.id)) || (a.id - b.id));
    return out;
  }
  // the current shelf, rolled fresh when it is missing or REFRESH duels old
  function ensureStock() {
    const d = Save.data;
    if (!d.shop || d.stats.duels - d.shop.duelsAt >= REFRESH) { d.shop = { stock: rollStock(), duelsAt: d.stats.duels, rerolls: 0 }; Save.save(); }
    if (d.shop.rerolls === undefined) d.shop.rerolls = 0;
    return d.shop;
  }
  function duelsUntilRefresh() { const d = Save.data; return d.shop ? Math.max(0, REFRESH - (d.stats.duels - d.shop.duelsAt)) : 0; }
  // the price of the next early restock (the count resets with the shelf, every REFRESH duels); null when there are no more
  function rerollPrice() { const n = ensureStock().rerolls; return n < REROLL.length ? REROLL[n] : REROLL[REROLL.length - 1]; }
  function canReroll() {
    const p = rerollPrice();
    if (Save.data.domino < p) return { ok: false, why: "That costs " + p + " Domino" };
    return { ok: true, price: p };
  }
  function reroll() {
    const r = canReroll(); if (!r.ok) return r;
    const sh = ensureStock();
    Save.data.domino -= r.price; sh.stock = rollStock(); sh.rerolls++; Save.save();
    return { ok: true, price: r.price };
  }
  function payout(duelist) { return duelist.hidden ? 1000 : (PAY[duelist.stage] || PAY[1]); }
  // card packs: a small chance after a win, 5 cards where every card has the same odds (rarity plays no part)
  const PACK_CHANCE = 0.1, PACK_SIZE = 5;
  const FLAWLESS = 3;                         // a win without losing a single Life Point multiplies the whole bill, and opens a card pack
  function rollPack() { const all = [].concat(...pools()), out = []; for (let i = 0; i < PACK_SIZE; i++) out.push(all[Math.floor(Math.random() * all.length)]); return out; }
  // buying / selling (the rules the shop screen and the demo both go through)
  function canBuy(i) {
    const s = Save.data.shop && Save.data.shop.stock[i]; if (!s) return { ok: false, why: "Nothing there" };
    if (s.sold) return { ok: false, why: "Sold out" };
    const max = Banlist.limit(s.id);
    if (Save.owned(s.id) >= max) return { ok: false, why: max === 1 ? "Limited: you own it" : "You own " + max + " already" };
    if (Save.data.domino < price(s.id)) return { ok: false, why: "Not enough Domino" };
    return { ok: true };
  }
  function buy(i) { const r = canBuy(i); if (!r.ok) return r; const s = Save.data.shop.stock[i]; Save.data.domino -= price(s.id); s.sold = true; Save.addCard(s.id, 1); Save.save(); return { ok: true, id: s.id }; }
  function canSell(id) {
    if (Save.spare(id) <= 0) return { ok: false, why: "It is in your deck" };
    if (Save.chestTotal() <= 40) return { ok: false, why: "Keep 40 cards" };
    return { ok: true };
  }
  function sell(id) { const r = canSell(id); if (!r.ok) return r; Save.removeCard(id); Save.data.domino += sellPrice(id); Save.save(); return { ok: true }; }
  window.Shop = { NAMES, COLORS, PRICE, STOCK, REFRESH, REROLL, PACK_CHANCE, PACK_SIZE, FLAWLESS, rarity, price, sellPrice, rollStock, ensureStock, duelsUntilRefresh, rerollPrice, canReroll, reroll, payout, rollPack, canBuy, buy, canSell, sell };
})();
