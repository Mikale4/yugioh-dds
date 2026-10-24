// Player profile + persistence: five save files in localStorage (auto-saved like the cartridge's battery save).
(function () {
  const LEGACY_KEY = "dds_save_v1", KEY = (n) => "dds_save_v1_s" + n;
  const S = { data: null, slot: 1, SLOTS: 5 };
  // the old single save becomes file 1
  try { const old = localStorage.getItem(LEGACY_KEY); if (old !== null) { if (localStorage.getItem(KEY(1)) === null) localStorage.setItem(KEY(1), old); localStorage.removeItem(LEGACY_KEY); } } catch (e) { }

  S.key = function (slot) { return KEY(slot || S.slot); };
  S.exists = function (slot) { try { return !!localStorage.getItem(KEY(slot || S.slot)); } catch (e) { return false; } };
  S.anyExists = function () { for (let n = 1; n <= S.SLOTS; n++) if (S.exists(n)) return true; return false; };
  S.peek = function (slot) { try { const j = localStorage.getItem(KEY(slot)); return j ? JSON.parse(j) : null; } catch (e) { return null; } };
  S.load = function (slot) {
    if (slot) S.slot = slot;
    try { const j = localStorage.getItem(KEY(S.slot)); if (!j) return false; S.data = JSON.parse(j); S.migrate(); return true; } catch (e) { return false; }
  };
  S.save = function () { if (S.data && S.data.decks) S.data.decks[S.data.deckSlot] = S.data.deck.slice(); try { localStorage.setItem(KEY(S.slot), JSON.stringify(S.data)); } catch (e) { /* ignore */ } };
  S.erase = function (slot) { try { localStorage.removeItem(KEY(slot || S.slot)); } catch (e) { } if (!slot || slot === S.slot) S.data = null; };
  S.migrate = function () {
    const d = S.data;
    d.flags = d.flags || {}; d.codesUsed = d.codesUsed || []; d.stats = d.stats || { duels: 0, wins: 0, losses: 0, fusions: 0 };
    // card construction was removed: clear any leftovers from older saves
    delete d.parts;
    for (const k of Object.keys(d.chest)) if (Number(k) >= 1000) delete d.chest[k];
    d.deck = d.deck.filter((id) => id < 1000);
    d.wins = d.wins || {}; d.losses = d.losses || {};
    if (typeof d.domino !== "number") d.domino = 300; if (!d.shop) d.shop = null;
    if (!d.decks) { d.decks = [d.deck.slice(), [], []]; d.deckSlot = 0; } // three deck slots; `deck` is the active one
    if (!d.met) d.met = {}; // Free Duel challengers who have already walked up to you
    if (!d.summons) d.summons = {}; // the summon list: monsters that can never be owned, ticked off as they come out
  };
  S.newGame = function (name, starterDeck, starter) {
    const deck = (starterDeck || Duelists.starterDeck()).slice();
    const chest = {};
    for (const id of deck) chest[id] = (chest[id] || 0) + 1;
    S.data = {
      name: name || "Duelist", chest, deck, stage: 1,
      wins: {}, losses: {}, flags: {}, codesUsed: [], stats: { duels: 0, wins: 0, losses: 0, fusions: 0 },
      domino: 300, shop: null, met: {}, summons: {},
      decks: [deck.slice(), [], []], deckSlot: 0,
      starter: starter || "fixed",
      created: Date.now(),
    };
    S.save();
  };
  // ---- the summon list: the 85 monsters that can never be owned, ticked off as they are brought out. It is the
  // collection for cards there is no other way to collect.
  S.recordSummon = function (id) {
    if (!S.data || !Banlist.ritualOnly(id)) return false;
    if (!S.data.summons) S.data.summons = {};
    if (S.data.summons[id]) return false;
    S.data.summons[id] = 1; S.save();
    return true;                                   // first time out: worth saying so
  };
  S.hasSummoned = function (id) { return !!(S.data && S.data.summons && S.data.summons[id]); };
  S.summonCount = function () { return S.data && S.data.summons ? Object.keys(S.data.summons).length : 0; };
  S.summonTotal = function () { return CardDB.all.filter((c) => Banlist.ritualOnly(c.id)).length; };
  // how many cards a chest can ever hold: the summoned-only ones never count towards it
  S.collectTotal = function () { return CardDB.all.filter((c) => Banlist.limit(c.id) > 0).length; };

  // ---- chest helpers
  S.owned = function (id) { return S.data.chest[id] || 0; };
  S.inDeck = function (id) { return S.data.deck.filter((x) => x === id).length; };
  // copies not claimed by any of the three decks (so selling never breaks a stored deck)
  S.usedMax = function (id) { let m = S.inDeck(id); for (let i = 0; i < 3; i++) if (i !== S.data.deckSlot) m = Math.max(m, S.data.decks[i].filter((x) => x === id).length); return m; };
  S.spare = function (id) { return S.owned(id) - S.usedMax(id); };
  // ---- deck slots
  S.DECKS = 3;
  S.useDeck = function (i) { if (i === S.data.deckSlot) return; S.data.decks[S.data.deckSlot] = S.data.deck.slice(); S.data.deckSlot = i; S.data.deck = S.data.decks[i].slice(); S.save(); };
  S.deckProblemsOf = function (deck) {
    const p = [], count = (id) => deck.filter((x) => x === id).length;
    if (deck.length !== 40) p.push("Deck must have 40 cards");
    for (const id of new Set(deck)) {
      const c = CardDB.get(id); if (!c) continue;
      if (count(id) > Banlist.limit(id)) { p.push(c.name.slice(0, 12) + (Banlist.ritualOnly(id) ? " not deckable" : Banlist.limit(id) === 0 ? " is forbidden" : " max " + Banlist.limit(id))); break; }
      if (count(id) > S.owned(id)) { p.push(c.name.slice(0, 12) + " not owned"); break; }
    }
    return p;
  };
  S.legalDecks = function () { const out = []; for (let i = 0; i < 3; i++) if (S.deckProblemsOf(i === S.data.deckSlot ? S.data.deck : S.data.decks[i]).length === 0) out.push(i); return out; };
  S.addCard = function (id, n) { S.data.chest[id] = (S.data.chest[id] || 0) + (n || 1); };
  S.removeCard = function (id) { // one copy out of the chest
    if (!S.data.chest[id]) return false;
    S.data.chest[id]--; if (S.data.chest[id] <= 0) delete S.data.chest[id];
    return true;
  };
  S.chestList = function () { return Object.keys(S.data.chest).map(Number).sort((a, b) => a - b); };
  S.chestTotal = function () { let n = 0; for (const k in S.data.chest) n += S.data.chest[k]; return n; };
  // ---- deck rules
  S.deckProblems = function () { return S.deckProblemsOf(S.data.deck); };
  S.canAddToDeck = function (id) {
    const d = S.data, c = CardDB.get(id);
    if (!c) return { ok: false, why: "Unknown card" };
    if (d.deck.length >= 40) return { ok: false, why: "Deck is full (40)" };
    if (S.spare(id) <= 0) return { ok: false, why: "No spare copies" };
    const lim = Banlist.limit(id);
    if (Banlist.ritualOnly(id)) return { ok: false, why: "Not a deck card" };
    if (lim === 0) return { ok: false, why: "Forbidden card" };
    if (S.inDeck(id) >= lim) return { ok: false, why: lim === 3 ? "Max 3 copies" : "Limited to " + lim };
    return { ok: true };
  };
  // ---- campaign progress
  S.winsFor = function (key) { return S.data.wins[key] || 0; };
  S.stageCleared = function (stage) {
    const st = Duelists.STAGES[stage]; if (!st) return false;
    return st.keys.filter((k) => !Duelists.byKey[k].hidden).every((k) => S.winsFor(k) >= 5);
  };
  S.maxStage = function () {
    let s = 1;
    while (s < 4 && S.stageCleared(s)) s++;
    return s;
  };
  S.duelistAvailable = function (key) {
    const d = Duelists.byKey[key];
    if (d.stage > S.maxStage()) return false;
    if (!d.hidden) return true;
    if (key === "yamiyugi") return S.winsFor("darknite") >= 1 || S.data.flags.pw_yamiyugi;
    return S.winsFor("yamiyugi") >= 5 || S.data.flags["pw_" + key];
  };
  // Reach The Heavens and the gloves come off (the user's rule, 2026-09-24): from then on every duelist brings the
  // deck they take to the tournament instead of their faithful one, and plays it at the highest skill, wherever they
  // are met - the campaign map, a rematch, Free Duel. maxStage() is 4 once Ancient Egypt has been cleared.
  S.fullStrength = function () { return S.maxStage() >= 4; };
  S.recordDuel = function (key, won, mode) {
    const d = S.data;
    d.stats.duels++;
    if (won) { d.stats.wins++; d.wins[key] = (d.wins[key] || 0) + 1; } else { d.stats.losses++; d.losses[key] = (d.losses[key] || 0) + 1; }
    S.save();
  };
  window.Save = S;
})();
