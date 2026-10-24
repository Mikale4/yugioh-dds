// Automated playthrough ("runner"): drives the real screens through the test hooks (Game.press / Game.click /
// Game.tick), lets AUTO play every duel, rebuilds the deck from the chest after each duel and keeps going until
// every duelist (hidden ones included) has been beaten.
//  - Demo (title screen): plays at normal speed in the save file the player picked; Esc hands control to the player
//    and back (window.Demo). Games started this way are flagged `demo` in their save, so the toggle stays available
//    whenever that file is continued.
//  - Developer runs: Runner.start({...}) from the console or ?runner=1 (&seed=N &speed=N &human=1). These use save
//    the last save file (opts.slot), which is backed up before the run and restored afterwards. Runner.report() sums up a run.
(function () {
  const BACKUP_KEY = (slot) => "dds_save_runner_backup_s" + slot;
  const NO_DEMO_SCREENS = new Set(["boot", "title", "nameEntry", "starterPick"]);
  const R = {
    active: false, status: "idle", speed: 240, frames: 0, opts: {},
    log: [], errors: [], duels: [], deckChanges: [], overflows: new Map(), startedAt: 0,
  };

  // ---------------------------------------------------------------- instrumentation
  // tag every screen object with the name of the factory that made it, so the runner knows where it is
  const NOT_SCREENS = new Set(["drawScene", "launchDuel", "afterDuel"]);
  for (const k of Object.keys(Screens)) {
    if (typeof Screens[k] !== "function" || NOT_SCREENS.has(k)) continue;
    const orig = Screens[k];
    Screens[k] = function () { const s = orig.apply(this, arguments); if (s && typeof s === "object" && !s.name) s.name = k; return s; };
  }
  // count frames and catch text drawn past the edge of the screen while a run is active
  // in human mode the game loop runs at its normal 60 fps and a tick just means "wait that many frames"
  const origTick = Game.tick; let humanStep = false, cooldown = 0;
  Game.tick = function (n) { n = n || 1; R.frames += n; if (humanStep) { cooldown += n; return; } return origTick.call(Game, n); };
  const origText = G.text;
  G.text = function (x, y, str, color) {
    if (R.active && str !== undefined && str !== null) {
      const s = String(str);
      if (s.trim() && (x < 0 || x + s.length * 8 > 160)) {
        const scr = Game.top ? Game.top.name : "?", key = scr + "|" + s;
        if (!R.overflows.has(key)) { R.overflows.set(key, { screen: scr, text: s, x, y }); note("OVERFLOW on " + scr + ': "' + s + '" at x=' + x); }
      }
    }
    return origText.call(G, x, y, str, color);
  };
  // a developer run that was cut short (page closed) left the file's previous contents in the backup slot: put it back
  try { for (let n = 1; n <= Save.SLOTS; n++) { const b = localStorage.getItem(BACKUP_KEY(n)); if (b !== null) { if (b) localStorage.setItem(Save.key(n), b); else localStorage.removeItem(Save.key(n)); localStorage.removeItem(BACKUP_KEY(n)); } } } catch (e) { }
  window.addEventListener("error", (e) => { if (R.active) fail("uncaught error: " + e.message + (e.filename ? " (" + e.filename.split("/").pop() + ":" + e.lineno + ")" : "")); });

  // ---------------------------------------------------------------- helpers
  let hud = null, origRandom = Math.random, pending = null, lastScreen = "", sameFrames = 0, toured = false, tourQueue = [];
  function note(s) { const line = "[" + Math.round(R.frames / 60) + "s] " + s; R.log.push(line); if (R.log.length > 400) R.log.shift(); if (R.opts.quiet !== true) console.log("[runner] " + s); drawHud(); }
  function fail(msg) { R.errors.push(msg); note("ERROR: " + msg); stop("error"); }
  function seedRandom(seed) { // mulberry32: same seed -> same run (decks, draws, drops)
    let a = seed >>> 0;
    Math.random = function () { a = (a + 0x6D2B79F5) | 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const screenName = () => (Game.top && Game.top.name) || "none";
  const need = (d) => !d.hidden ? (d.key === "darknite" ? 1 : 5) : (d.key === "yamiyugi" ? 5 : 1); // wins wanted per duelist
  const finished = () => Duelists.all.every((d) => d.free || Save.winsFor(d.key) >= need(d)); // the Free Duel challengers are optional

  // ---------------------------------------------------------------- deck building
  // the deck editor's AUTO BUILD and the demo use the same valuation and the same builder (js/data/deckbuild.js)
  const cardValue = DeckBuild.cardValue, deckScore = DeckBuild.deckScore, bestDeck = DeckBuild.bestDeck;

  // swap to the best deck the chest allows when it is a real improvement (or the current deck is illegal)
  // the change from the current deck to the best one, or null when it is not worth it: {best, add, remove (card ids), gain}
  function planDeck() {
    const cur = Save.data.deck.slice(), best = bestDeck();
    if (best.length !== 40) { fail("deck builder produced " + best.length + " cards"); return null; }
    const gain = deckScore(best) - deckScore(cur), illegal = Save.deckProblems().length > 0;
    if (!illegal && gain < 100) return null;
    const count = (arr) => { const m = {}; for (const id of arr) m[id] = (m[id] || 0) + 1; return m; };
    const a = count(cur), b = count(best), add = [], remove = [];
    for (const id in b) for (let i = (a[id] || 0); i < b[id]; i++) add.push(Number(id));
    for (const id in a) for (let i = (b[id] || 0); i < a[id]; i++) remove.push(Number(id));
    return { best, add, remove, gain };
  }
  const names = (ids) => { const m = {}; for (const id of ids) m[id] = (m[id] || 0) + 1; return Object.keys(m).map((id) => CardDB.get(Number(id)).name + (m[id] > 1 ? " x" + m[id] : "")); };
  function logDeckChange(reason, plan) {
    R.deckChanges.push({ duel: R.duels.length, plus: names(plan.add), minus: names(plan.remove), gain: Math.round(plan.gain) });
    note("Deck " + reason + ": +" + names(plan.add).join(", +") + "  -" + names(plan.remove).join(", -") + "  (+" + Math.round(plan.gain) + ")");
  }
  // one line per card just won: what the deck builder made of it
  function explainNew(ids, inDeckBefore) {
    const deck = Save.data.deck, mons = deck.filter((id) => CardDB.get(id).kind === "M");
    const vals = deck.map((id) => cardValue(id, mons)), weakest = Math.min(...vals), weakestName = CardDB.get(deck[vals.indexOf(weakest)]).name;
    const planned = deckTodo ? deckTodo.plan.add : [];
    // a ritual card is judged against the whole chest, not just the deck: who can pay for it, and is the monster worth
    // the slots the package would cost
    function whyRitual(id) {
      const r = Effects.ritual[id], res = CardDB.get(r.result);
      const need = {}; for (const n of r.need) need[n] = (need[n] || 0) + 1;
      const missing = Object.keys(need).map(Number).filter((n) => Save.owned(n) < need[n]);
      const stein = Save.owned(420) > 0, steinDecked = Save.inDeck(420) > 0;
      const names = (list) => list.map((n) => CardDB.get(n).name + (need[n] > 1 ? " x" + need[n] : "")).join(" and ");
      if (missing.length) {
        const lack = "no " + names(missing) + " in the chest";
        if (!stein) return lack + " to offer for " + res.name;
        const other = Save.data.deck.find((x) => x !== id && Effects.ritual[x]);
        if (!steinDecked) return lack + ", and Cyber-Stein is not in the deck to pay for it";
        return lack + ", and the decked Cyber-Stein is saved for " + (other ? CardDB.get(other).name : "a stronger ritual than " + res.name);
      }
      const owned = "the chest holds " + names(Object.keys(need).map(Number));
      return owned + ", but " + res.name + " (" + res.atk + " ATK) is not worth the deck slots the package costs";
    }
    return ids.map((id) => {
      const c = CardDB.get(id), v = cardValue(id, mons), fx = Effects.magic[id];
      let why;
      if (planned.includes(id) || Save.inDeck(id) > (inDeckBefore[id] || 0)) why = "goes into the deck";
      else if (Banlist.ritualOnly(id)) why = "a ritual monster is not a deck card";
      else if (Save.inDeck(id) >= Banlist.limit(id)) why = "the deck already has its " + Banlist.limit(id) + (Banlist.limit(id) === 1 ? " copy" : " copies");
      else if (c.kind === "R") why = whyRitual(id);
      else if (fx && fx.kind === "equip") { const fits = mons.filter((m) => CardDB.equipFits(id, CardDB.get(m))).length; why = "only powers up " + fits + " of the deck's " + mons.length + " monsters"; }
      else if (c.kind === "M") {
        // how it compares with everything else in the chest, not only with the 40 cards in the deck
        const better = Save.chestList().filter((x) => CardDB.get(x).kind === "M" && cardValue(x) > cardValue(id)).length;
        why = v > weakest ? "the deck's current cards fuse better together (" + better + " stronger monsters in the chest)"
          : "worth less than " + weakestName + ", the deck's weakest card (" + better + " stronger monsters in the chest)";
      } else why = "worth less than " + weakestName + ", the deck's weakest card";
      return c.name + ": " + why;
    });
  }
  let shopTodo = null; // stock indexes worth buying; in human mode they are bought on the SHOP screen
  function planShopping() {
    const stock = Shop.ensureStock().stock, deck = Save.data.deck, mons = deck.filter((id) => CardDB.get(id).kind === "M");
    const weakest = Math.min(...deck.map((id) => cardValue(id, mons)));
    let money = Save.data.domino - (window.Screens && Screens.CUP && Save.maxStage() >= Screens.CUP.minStage ? Screens.CUP.fee : 0); // the entry fee is spoken for
    const picks = [];
    stock.map((s, i) => ({ s, i, gain: s.sold || Save.owned(s.id) >= Banlist.limit(s.id) ? -1 : cardValue(s.id, mons) - weakest })).filter((x) => x.gain > 200).sort((a, b) => b.gain - a.gain)
      .forEach((x) => { const p = Shop.price(x.s.id); if (p <= money && x.gain >= p / 4) { money -= p; picks.push(x.i); } }); // a card must be worth its price
    return picks;
  }
  // what to sell: surplus copies (a 4th can never be decked) and cards that will not make the deck for the rest of
  // the run - far below the deck's weakest card, no strong fusion with anything owned, not a ritual offering, no
  // effect, not Limited. One entry per copy; the chest keeps a cushion above the 40-card floor.
  const RITUAL_MATS = new Set(); for (const sid in Effects.ritual) for (const n of Effects.ritual[sid].need) RITUAL_MATS.add(n);
  const ritualLive = (id) => { const r = Effects.ritual[id]; return !!r && (Save.owned(420) > 0 || r.need.every((n) => Save.owned(n) > 0)); }; // a ritual card whose offerings (or Cyber-Stein) are in the chest may still get its turn
  function planSelling() {
    const deck = Save.data.deck, mons = deck.filter((id) => CardDB.get(id).kind === "M");
    const weakest = Math.min(...deck.map((id) => cardValue(id, mons)));
    // the deck builder only ever looks at the 28 strongest unused monsters; anything below that line is dead weight
    const bench = Save.chestList().filter((id) => Save.spare(id) > 0 && CardDB.get(id).kind === "M").sort((a, b) => cardValue(b) - cardValue(a));
    const benchLine = bench.length > 28 ? cardValue(bench[27]) : -Infinity;
    const out = []; let room = Save.chestTotal() - 45;
    for (const id of Save.chestList()) {
      const spare = Save.spare(id); if (spare <= 0) continue;
      const c = CardDB.get(id);
      let n = Math.max(0, Save.owned(id) - Banlist.limit(id));    // copies the limit list will never let into a deck
      if (Banlist.limit(id) > 1 && !RITUAL_MATS.has(id) && !Effects.isEffect(id) && !ritualLive(id)) {
        const v = cardValue(id, mons);
        const useless = c.kind === "M" ? v < benchLine && v < weakest + 200 : v < 250; // below the line the builder never looks, fusions included
        if (useless) n = spare;
      }
      n = Math.min(n, Math.max(0, Save.owned(id) - 1));            // never sell the last copy of anything
      for (let k = 0; k < n && room > 0; k++, room--) out.push(id);
    }
    return out;
  }
  let sellTodo = null, renewTodo = 0;
  // a fresh shelf is worth asking for when nothing on it beats the deck: always when it is free, and while the demo is
  // rich enough that the price is pocket change (the tournament fee stays untouched either way)
  function wantRenew() {
    if (!Shop.rerollPrice) return false;
    if (planShopping().length) return false;
    const p = Shop.rerollPrice(), fee = window.Screens && Screens.CUP && Save.maxStage() >= Screens.CUP.minStage ? Screens.CUP.fee : 0;
    return p === 0 || Save.data.domino - fee >= p * 8;
  }
  function goShopping(reason) {
    const sells = planSelling();
    if (R.opts.human) { if (wantRenew()) renewTodo = 1; }       // the demo presses RENEW on the SHOP screen itself
    else for (let i = 0; i < 3 && wantRenew(); i++) {           // a fast run re-rolls before planning
      const p = Shop.rerollPrice(), r = Shop.reroll(); if (!r.ok) break;
      R.spent += p;
      note("Shop: asked for new cards" + (p ? " for " + p + " Domino" : " (free renew)"));
    }
    const picks = planShopping();
    if (R.opts.human) { if (sells.length) sellTodo = sells; if (picks.length || renewTodo) shopTodo = picks; return; }
    for (const id of sells) { const r = Shop.sell(id); if (r.ok) { R.sold += Shop.sellPrice(id); note("Shop: sold " + CardDB.get(id).name + " for " + Shop.sellPrice(id) + " Domino" + (Save.owned(id) >= 3 ? " (spare copy)" : " (no use for it)")); } }
    if (!picks.length) return;
    for (const i of picks) { const id = Save.data.shop.stock[i].id, r = Shop.buy(i); if (r.ok) { R.spent += Shop.price(id); note("Shop: bought " + CardDB.get(id).name + " for " + Shop.price(id) + " Domino (" + Save.data.domino + " left)"); } }
  }
  // SHOP screen driver: pick each planned shelf card, choose Buy in its menu, then leave
  function shopStep() {
    const st = Game.top.state(), P = R.opts.human ? 8 : 2;
    if (st.msg) { Game.press("a", P); return; }
    if (st.info) { Game.press("b", P); return; }
    if (st.menu) {
      if (sellTodo && sellTodo.length && st.side === 1) { const id = sellTodo.shift(); Game.press("a", P); R.sold += Shop.sellPrice(id); note("Shop: sold " + CardDB.get(id).name + " for " + Shop.sellPrice(id) + " Domino"); }
      else if (shopTodo && shopTodo.length && st.side === 0) { const id = st.items[shopTodo[0]]; Game.press("a", P); shopTodo.shift(); if (id) { R.spent += Shop.price(id); note("Shop: bought " + CardDB.get(id).name + " for " + Shop.price(id) + " Domino"); } }
      else if (renewTodo > 0) Game.press("b", P);
      else Game.press("b", P);
      return;
    }
    if (sellTodo && sellTodo.length) {
      if (st.side !== 1) { Game.press("right", P); return; }
      const id = sellTodo[0];
      if (!Shop.canSell(id).ok) { sellTodo.shift(); return; }
      const idx = st.items.indexOf(id);
      if (idx < 0) { sellTodo.shift(); return; }
      if (idx !== st.sel) { const n = st.items.length, d = (idx - st.sel + n) % n; Game.press(d <= n - d ? "down" : "up", P); return; }
      Game.press("a", P); return; // the card menu: Sell is its first entry
    }
    if (renewTodo > 0 && st.side === 0) { // the RENEW button under the buy list
      const p = Shop.rerollPrice(); renewTodo--;
      Game.press("sort", R.opts.human ? 20 : P);
      note("Shop: asked for new cards" + (p ? " for " + p + " Domino" : " (free renew)"));
      if (p) R.spent += p;
      shopTodo = planShopping(); if (wantRenew()) renewTodo++;
      return;
    }
    if (renewTodo > 0 && st.side !== 0) { Game.press("left", P); return; }
    if (!shopTodo || !shopTodo.length) { shopTodo = null; sellTodo = null; deckTodo = null; upgradeDeck("after shopping"); Game.press("b", P); return; }
    if (st.side !== 0) { Game.press("left", P); return; }
    const idx = shopTodo[0];
    if (!st.items[idx] || !Shop.canBuy(idx).ok) { shopTodo.shift(); return; }
    const pos = st.order ? st.order.indexOf(idx) : idx; // the shelf can be sorted: walk to the row, not the index
    if (pos < 0) { shopTodo.shift(); return; }
    if (pos !== st.sel) { const n = st.order ? st.order.length : st.items.length, d = (pos - st.sel + n) % n; Game.press(d <= n - d ? "down" : "up", P); return; }
    Game.press("a", P); // opens the card menu; Buy is its first entry
  }
  // the tournament: entered whenever it is open and the fee is there; every match is on screen (spectated or played)
  let cupWanted = false, cupSkip = -1, cup = null; // cup: the bracket in progress { screen, chest, seen, duels, wins, domino }
  const cupOpen = () => !!(window.Screens && Screens.cupStatus && !Screens.cupStatus() && Save.data.domino >= Screens.CUP.fee && Save.legalDecks().length && Save.data.stats.duels !== cupSkip);
  const cupName = (k) => k === "YOU" ? Save.data.name : Duelists.byKey[k].name;
  function cupMatchLog(ts) { // one line for the match decided since the last look at the bracket
    const pos = ts.round * 10 + ts.match; if (cup.seen === pos) return; cup.seen = pos;
    let pair, winner, r;
    if (ts.match > 0) { pair = ts.rounds[ts.round].slice(2 * ts.match - 2, 2 * ts.match); winner = ts.winners[ts.match - 1]; r = ts.round; }
    else if (ts.round > 0) { const prev = ts.rounds[ts.round - 1]; pair = prev.slice(-2); winner = ts.rounds[ts.round][ts.rounds[ts.round].length - 1]; r = ts.round - 1; }
    else return;
    const label = ["Round 1", "Semi-final", "Final"][r] || "Round " + (r + 1);
    if (pair.includes("YOU")) { const foe = pair.find((k) => k !== "YOU"); note("Tournament " + label + ": " + (winner === "YOU" ? "beat " + cupName(foe) : "knocked out by " + cupName(foe)) + "  W" + Save.data.stats.wins + " L" + Save.data.stats.losses); }
    else note("Tournament " + label + " (watched): " + cupName(winner) + " beats " + cupName(pair.find((k) => k !== winner)));
  }
  function tournamentStep() {
    if (!cup || cup.screen !== Game.top) cup = { screen: Game.top, chest: Object.assign({}, Save.data.chest), seen: -1, duels: Save.data.stats.duels, wins: Save.data.stats.wins, domino: Save.data.domino + Screens.CUP.fee };
    const ts = Game.top.state(); cupMatchLog(ts);
    Game.press("a", R.opts.human ? 30 : 4); // next match; or closes the "you are out" message and leaves
  }
  function cupFinish() { // the bracket screen is gone: count the outcome and evaluate everything it brought in
    const ts = cup.screen.state(); cupMatchLog(ts);
    const won = ts.state === "done", myWins = Save.data.stats.wins - cup.wins;
    R.cups = (R.cups || 0) + 1; if (won) R.cupWins = (R.cupWins || 0) + 1;
    const how = won ? "WON - champion!" : ts.state === "out" ? "over: knocked out in " + (["round 1", "the semi-final", "the final"][ts.round - 1] || "round " + ts.round) : "left early";
    note("Tournament " + how + " (matches " + myWins + "-" + (Save.data.stats.duels - cup.duels - myWins) + ", Domino " + cup.domino + " -> " + Save.data.domino + ")");
    const chest = cup.chest; cup = null; cupWanted = false;
    settle(chest, won ? "with the champion prizes" : "after the tournament", won ? "A card pack came with the trophy" : null);
  }
  function settle(chestBefore, reason, packText) { // shop, rebuild the deck and explain every card gained since the chest snapshot
    const newCards = Object.keys(Save.data.chest).map(Number).filter((id) => (Save.data.chest[id] || 0) > (chestBefore[id] || 0));
    const inDeckBefore = {}; for (const id of newCards) inDeckBefore[id] = Save.inDeck(id);
    if (packText && newCards.length >= 5) { R.packs++; note(packText); }
    goShopping();
    upgradeDeck(reason);
    R.lastNew = explainNew(newCards, inDeckBefore);
    for (const line of R.lastNew) note("New card - " + line);
  }
  let deckTodo = null; // in human mode the swap is done on the DECK screen, card by card, so it can be watched
  function upgradeDeck(reason) {
    const plan = planDeck(); if (!plan) return;
    if (R.opts.human) { deckTodo = { add: plan.add.slice(), remove: plan.remove.slice(), reason, plan }; return; }
    applyDeck(reason, plan);
  }
  function applyDeck(reason, plan) {
    const cur = Save.data.deck;
    Save.data.deck = plan.best;
    const probs = Save.deckProblems();
    if (probs.length) { Save.data.deck = cur; fail("built an illegal deck: " + probs[0]); return; }
    Save.save(); logDeckChange(reason, plan);
  }
  // DECK screen driver: take the planned cards out of the deck list, then add the new ones from the chest list, then leave
  function deckEditStep() {
    const st = Game.top.state(), P = R.opts.human ? 8 : 2;
    if (st.msg) { Game.press("a", P); return; }
    if (st.info) { Game.press("b", P); return; }
    if (st.menu) { // the card menu: "To Chest" / "To Deck" is its first entry
      if (!deckTodo) { Game.press("b", P); return; }
      Game.press("a", P); if (st.side === 0) deckTodo.remove.shift(); else deckTodo.add.shift(); return;
    }
    if (!deckTodo) { Game.press("b", P); return; }
    const todo = deckTodo;
    while (todo.remove.length && !Save.data.deck.includes(todo.remove[0])) todo.remove.shift();
    while (todo.add.length && (Save.spare(todo.add[0]) <= 0 || Save.inDeck(todo.add[0]) >= Banlist.limit(todo.add[0]))) todo.add.shift();
    const moveTo = (idx) => { const n = st.items.length, d = (idx - st.sel + n) % n; Game.press(d <= n - d ? "down" : "up", P); };
    if (todo.remove.length) {
      if (st.side !== 0) { Game.press("left", P); return; }
      const idx = st.items.indexOf(todo.remove[0]);
      if (idx < 0) { todo.remove.shift(); return; }
      if (idx !== st.sel) { moveTo(idx); return; }
      Game.press("a", P); return; // opens the card menu
    }
    if (todo.add.length && Save.data.deck.length < 40) {
      if (st.side !== 1) { Game.press("right", P); return; }
      const idx = st.items.indexOf(todo.add[0]);
      if (idx < 0) { todo.add.shift(); return; }
      if (idx !== st.sel) { moveTo(idx); return; }
      Game.press("a", P); return;
    }
    if (Save.deckProblems().length) { const plan = planDeck(); if (plan) applyDeck("repair", plan); }
    else logDeckChange(todo.reason, todo.plan);
    deckTodo = null;
    Game.press("b", P);
  }

  // ---------------------------------------------------------------- screen drivers
  const NAME_ROWS = ["ABCDEFGHIJKLM", "NOPQRSTUVWXYZ", "abcdefghijklm", "nopqrstuvwxyz", "0123456789 .-"];
  let typed = 0;
  function typeName() {
    const nm = (R.opts.name || "Runner").slice(0, 8);
    const click = (ch) => { const r = NAME_ROWS.findIndex((row) => row.includes(ch)); if (r >= 0) Game.click(8 + NAME_ROWS[r].indexOf(ch) * 11 + 5, 44 + r * 12 + 6, R.opts.human ? 12 : 2); };
    if (R.opts.human && typed < nm.length) { click(nm[typed++]); return; } // one letter per step
    if (!R.opts.human) for (const ch of nm) click(ch);
    Game.click(20, 112, 3); // END
  }
  // --- who to fight next: the duelists we still have to beat; after 3 straight losses to one of them, farm a few
  // duels against a duelist we beat comfortably whose drops would improve the deck the most, then try again
  const streak = {}; let farmLeft = 0, lastProgress = 0;
  function available() {
    const out = [];
    for (let s = 1; s <= Save.maxStage(); s++) for (const k of Duelists.STAGES[s].keys) if (Save.duelistAvailable(k)) out.push({ key: k, stage: s, d: Duelists.byKey[k] });
    return out;
  }
  const winRate = (k) => { const w = Save.winsFor(k), l = Save.data.losses[k] || 0; return w + l ? w / (w + l) : 0; };
  function farmValue(x) { // expected deck improvement from one card of this duelist's drop pool
    const deckMons = Save.data.deck.filter((id) => CardDB.get(id).kind === "M");
    const weakest = Math.min(...Save.data.deck.map((id) => cardValue(id, deckMons)));
    const pool = Duelists.drops(x.d); let sum = 0;
    for (const id of pool) if (Save.owned(id) < Banlist.limit(id)) sum += Math.max(0, cardValue(id, deckMons) - weakest);
    return pool.length ? sum / pool.length : 0;
  }
  function pickOpponent() {
    const avail = available();
    const must = avail.filter((x) => Save.winsFor(x.key) < need(x.d));
    if (!must.length) return null;
    const score = (x) => Save.winsFor(x.key) + 2 * (Save.data.losses[x.key] || 0);
    must.sort((a, b) => score(a) - score(b));
    const target = must[0];
    if (farmLeft <= 0 && (streak[target.key] || 0) >= 3) { farmLeft = 3; streak[target.key] = 0; }
    if (farmLeft > 0) {
      const farms = avail.filter((x) => x.key !== target.key && Save.winsFor(x.key) >= 1 && winRate(x.key) >= 0.5).map((x) => Object.assign({ ev: farmValue(x) }, x));
      farms.sort((a, b) => (b.ev - a.ev) || (winRate(b.key) - winRate(a.key)));
      if (farms.length && farms[0].ev > 0) return Object.assign({ farm: true, why: target.d.name }, farms[0]);
      farmLeft = 0;
    }
    return target;
  }
  function campaignStep() {
    const st = Game.top.state();
    if (st.msg) { note("campaign message shown (deck problem?) " + Save.deckProblems().join("; ")); Game.press("a", 3); upgradeDeck("repair"); return; }
    const target = pickOpponent();
    if (!target) { if (finished()) stop("finished"); else fail("nobody left to fight but the game is not finished"); return; }
    if (st.stage !== target.stage) { if (target.stage > st.stage) Game.press("select", 3); else Game.click(10, 138, 3); return; }
    const idx = st.keys.indexOf(target.key);
    if (idx < 0) { fail(target.key + " is not on the stage " + st.stage + " map"); return; }
    if (st.sel !== idx) { Game.press(idx > st.sel ? "right" : "left", R.opts.human ? 20 : 2); return; }
    if (R.opts.human) Game.tick(30);
    pending = { key: target.key, wins: Save.winsFor(target.key), duels: Save.data.stats.duels, frame: R.frames, stage: st.stage, farm: !!target.farm, chest: Object.assign({}, Save.data.chest) };
    if (target.farm) note("Farming " + target.d.name + " for cards before facing " + target.why + " again");
    Game.press("a", 3);
  }
  function duelStep() {
    const st = Game.top.state();
    if (pending && R.frames - pending.frame > 60000) { fail("duel against " + pending.key + " did not end (turn " + st.turn + ")"); return; }
    if (st.mode === "end" || st.reveal) { Game.press("a", R.opts.human ? 90 : 3); return; }
    if (st.mode === "done") { Game.tick(3); return; }
    if (st.quit) { Game.press("b", 3); return; }
    if (!st.auto) { Game.press("select", 6); return; } // Select toggles AUTO once the narration is over
    if (R.opts.human) { Game.tick(6); return; } // watch the narration like a person would
    Game.press("a", 8); // A skips narration; AUTO does the rest
  }
  function duelReturned() {
    if (!pending || Save.data.stats.duels === pending.duels) return;
    const d = Game.currentDuel, won = Save.winsFor(pending.key) > pending.wins;
    const rec = { key: pending.key, name: Duelists.byKey[pending.key].name, won, turns: d ? d.turnNo : 0, myLp: d ? d.p[0].lp : 0, oppLp: d ? d.p[1].lp : 0, reason: d ? d.reason : "", frames: R.frames - pending.frame, stage: pending.stage, flawless: !!(won && d && !d.p[0].stats.tookDamage) };
    rec.farm = pending.farm; const chestBefore = pending.chest || {}; R.duels.push(rec); pending = null;
    if (won) { streak[rec.key] = 0; if (!rec.farm) lastProgress = R.duels.length; } else streak[rec.key] = (streak[rec.key] || 0) + 1;
    if (rec.farm) farmLeft--;
    note("Duel " + R.duels.length + " vs " + rec.name + ": " + (won ? (rec.flawless ? "FLAWLESS WIN" : "WIN" + (d && d.p[0].stats.firstHit ? " (first hit: " + d.p[0].stats.firstHit + ")" : "")) : "LOSS") + " in " + rec.turns + " turns (LP " + rec.myLp + "-" + rec.oppLp + (rec.reason && rec.reason !== "lp" ? ", " + rec.reason : "") + ")  W" + Save.data.stats.wins + " L" + Save.data.stats.losses + "  chest " + Save.chestList().length + " kinds");
    settle(chestBefore, "upgrade", "A card pack came with the win");
    if (R.duels.length >= (R.opts.maxDuels || 600)) { stop("maxDuels"); return; }
    if (R.duels.length - lastProgress >= 60) { note("No new campaign win in the last 60 duels"); stop("stalled"); }
  }
  // a quick visit to every menu screen (navigation keys only) to shake out crashes and text overflow
  function buildTour() {
    const back = () => { for (let i = 0; i < 6 && screenName() !== "mainMenu"; i++) Game.press("b", 4); };
    const keys = (list) => { for (const k of list) Game.press(k, 2); };
    return [
      () => { note("Tour: Record"); Game.click(39, 88, 3); keys(["right", "right", "right", "right", "right", "left"]); back(); },
      () => { note("Tour: Chest"); Game.click(119, 40, 3); keys(["down", "down", "down", "sort", "sort", "filter", "filter", "filter", "filter", "filter", "filter", "filter", "a"]); Game.tick(4); keys(["a"]); Game.tick(30); back(); },
      () => { note("Tour: Deck"); Game.click(119, 72, 3); keys(["down", "down", "right", "down", "sort", "filter", "filter", "filter", "filter", "filter", "filter", "filter", "select", "left"]); back(); },
      () => { note("Tour: Options"); Game.click(119, 104, 3); keys(["down", "down"]); back(); },
      () => { note("Tour: Limit list"); Game.push(Screens.banlist()); Game.tick(3); keys(["down", "down", "down", "a"]); Game.tick(4); keys(["b", "down", "down"]); back(); },
      () => { note("Tour: Shop"); Game.click(39, 120, 3); keys(["down", "down", "a"]); Game.tick(4); keys(["down", "a"]); Game.tick(30); keys(["b", "right", "sort", "filter", "down"]); back(); },
      () => { note("Tour: Password"); Game.push(Screens.password()); Game.tick(3); keys(["down", "right"]); back(); },
      () => { upgradeDeck("after tour"); },
    ];
  }

  // one decision + a few frames
  function step() {
    if (R.opts.demo && Save.data && !Save.data.demo) { Save.data.demo = true; Save.save(); }
    if (Game.fadeDir !== 0) { Game.tick(2); return; }
    const name = screenName();
    if (cup && !Game.stack.includes(cup.screen)) cupFinish();
    if (name === lastScreen) { sameFrames += 1; if (name !== "duel" && sameFrames > 800) { fail("stuck on screen " + name); return; } } else { lastScreen = name; sameFrames = 0; }
    switch (name) {
      case "boot": case "title": Game.press("a", 3); break;
      case "nameEntry": typeName(); break;
      case "starterPick": {
        const st = Game.top.state(); if (!st.decks.length) { Game.tick(2); break; }
        let best = 0, bv = -Infinity; st.decks.forEach((d, i) => { const v = deckScore(d); if (v > bv) { bv = v; best = i; } });
        if (st.sel !== best) { Game.press("right", R.opts.human ? 25 : 3); break; }
        note("Starter: the " + st.themes[best] + " deck (" + st.themes.join(" / ") + " were offered)");
        Game.press("a", R.opts.human ? 40 : 3); break;
      }
      case "intro": case "talk": case "reward": Game.press("a", R.opts.human ? 45 : 3); break;
      case "ending": Game.tick(250); Game.press("a", 5); break;
      case "mainMenu":
        if (shopTodo || sellTodo || renewTodo) { Game.click(39, 120, 3); break; } // SHOP
        if (deckTodo) { Game.click(119, 72, 3); break; } // DECK
        if (tourQueue.length) { tourQueue.shift()(); break; }
        if (!toured && R.opts.tour !== false) { toured = true; tourQueue = buildTour(); break; }
        if (cupOpen()) { cupWanted = true; note("Tournament is open: entering (" + Save.data.domino + " Domino)"); Game.click(39, 56, 3); break; } // FREE DUEL -> TOURNAMENT
        if (finished()) { stop("finished"); break; }
        Game.click(39, 24, 3); break; // CAMPAIGN
      case "freeDuel": {
        if (!cupWanted) { Game.press("b", 3); break; }
        const fs = Game.top.state();
        if (fs.msg) { note("Tournament entry refused; trying again after the next duel"); cupSkip = Save.data.stats.duels; cupWanted = false; Game.press("a", 3); break; }
        if (!fs.cup) { Game.press("left", R.opts.human ? 10 : 2); break; } // back to the top entry (a page up)
        Game.press("a", R.opts.human ? 20 : 3); break;
      }
      case "tournament": tournamentStep(); break;
      case "campaign": duelReturned(); if (R.active) { if (deckTodo || shopTodo || sellTodo || renewTodo || cupOpen()) Game.press("b", R.opts.human ? 20 : 3); else campaignStep(); } break;
      case "deckEdit": deckEditStep(); break;
      case "pickDeck": Game.press("a", 3); break; // the active deck is preselected
      case "shop": shopStep(); break;
      case "duel": duelStep(); break;
      default: Game.press("b", 3); break;
    }
  }
  function stepSafe() { try { step(); } catch (e) { console.error(e); fail((e && e.message) || String(e)); } }

  // ---------------------------------------------------------------- HUD (a line under the canvas, outside the game)
  function drawHud() {
    if (!hud) { hud = document.createElement("pre"); hud.id = "runner-hud"; hud.style.cssText = "font:12px/1.4 monospace;color:#cfd8dc;background:#1b1f24;padding:6px 10px;margin:8px 0 0;white-space:pre-wrap;max-width:640px;border-radius:4px"; const shell = document.getElementById("shell"); (shell || document.body).appendChild(hud); }
    const d = R.active ? (window.Save && Save.data) : R.finalSave;
    if (d && R.active) R.lastStage = Save.maxStage();
    const head = "RUNNER " + R.status + "  " + Math.round(R.frames / 60) + "s  duels " + R.duels.length + (d ? "  W" + d.stats.wins + " L" + d.stats.losses + "  stage " + (R.active ? Save.maxStage() : R.lastStage || "?") : "") + (pending ? "  vs " + Duelists.byKey[pending.key].name : "") + "  deck changes " + R.deckChanges.length + "  overflow " + R.overflows.size + "  errors " + R.errors.length;
    if (R.opts.demo) {
      const sd = window.Save && Save.data, stats = sd ? " - W" + sd.stats.wins + " L" + sd.stats.losses + ", stage " + Save.maxStage() : "";
      if (R.active) hud.textContent = "DEMO - the computer is playing" + (pending ? " (vs " + Duelists.byKey[pending.key].name + ")" : "") + stats + "\nEsc: take control yourself" + (R.lastNew && R.lastNew.length ? "\nLast card won - " + R.lastNew.join("; ") : "");
      else if (R.status === "finished") hud.textContent = "DEMO finished - the computer beat every duelist" + stats + "\nYou are in control now (Esc lets it play on)";
      else hud.textContent = "DEMO paused - you are in control" + stats + "\nEsc: let the computer play again";
      return;
    }
    hud.textContent = head + "\n" + R.log.slice(-6).join("\n");
  }

  // ---------------------------------------------------------------- driving
  function pumpOnce() {
    if (handover > 0 && !R.active) { // keep pressing Select (once the narration allows it) until AUTO is off
      const t = Game.top, st = t && t.name === "duel" ? t.state() : null;
      if (!st || !st.auto) handover = 0;
      else { if (!st.playing && st.mode !== "end" && st.mode !== "done") Input.inject("select"); handover--; }
      drawHud(); return;
    }
    if (!R.active) return;
    if (R.opts.human) { // the main loop advances the game; the runner only presses buttons, with pauses like a player
      if (cooldown > 0) cooldown--; else { humanStep = true; try { stepSafe(); } finally { humanStep = false; } }
    } else {
      const t0 = performance.now(), f0 = R.frames;
      while (R.active && R.frames - f0 < R.speed && performance.now() - t0 < 60) stepSafe();
    }
    drawHud();
  }
  function pump() {
    if (!R.active && handover <= 0) return;
    pumpOnce();
    if (R.active || handover > 0) { if (document.hidden && !R.opts.human) setTimeout(pump, 0); else requestAnimationFrame(pump); }
  }
  function stop(status) {
    if (!R.active) return;
    R.active = false; R.status = status;
    if (pending && status !== "error") pending = null;
    const secs = Math.round((Date.now() - R.startedAt) / 1000);
    note("Stopped: " + status + " after " + R.duels.length + " duels, " + Math.round(R.frames / 60) + "s of game time (" + secs + "s real)");
    R.finalDeck = Save.data ? Save.data.deck.slice() : [];
    R.finalSave = Save.data ? JSON.parse(JSON.stringify(Save.data)) : null;
    if (R.opts.demo) { handOver(); drawHud(); return; } // the game simply carries on under the player's control
    if (!R.opts.keepSave) restoreSave();
    console.log(report());
  }
  function restoreSave() {
    const slot = R.slot || Save.slot;
    try {
      const b = localStorage.getItem(BACKUP_KEY(slot));
      if (b) { localStorage.setItem(Save.key(slot), b); Save.load(slot); } else { localStorage.removeItem(Save.key(slot)); Save.data = null; }
      localStorage.removeItem(BACKUP_KEY(slot));
      note("File " + slot + " is back to what it was");
    } catch (e) { }
    Game.goto(Screens.title()); Game.tick(1);
  }
  // ---- demo toggle (Esc): pause = the player takes over where the demo is; resume = the demo carries on from there
  let handover = 0; // frames left to switch AUTO off after the player took over a running duel
  function handOver() { handover = 900; }
  function pauseDemo() {
    if (!R.active) return;
    R.active = false; R.status = "paused";
    note("Demo paused: the player takes over"); handOver(); drawHud();
  }
  function resumeDemo() {
    if (R.active) return;
    if (!R.opts.demo) { // continuing a demo file from the title: fresh runner state, no new game
      R.opts = { human: true, demo: true, quiet: true }; R.frames = 0; R.startedAt = Date.now();
      R.log.length = 0; R.errors.length = 0; R.duels.length = 0; R.deckChanges.length = 0; R.overflows.clear();
      farmLeft = 0; lastProgress = 0; toured = true; tourQueue = []; for (const k in streak) delete streak[k];
      Math.random = origRandom;
    }
    const scr = screenName(); handover = 0; deckTodo = null; shopTodo = null; sellTodo = null; cupWanted = scr === "tournament" || scr === "freeDuel";
    if (scr !== "duel") pending = null; // a duel the demo did not start is nobody's business
    lastScreen = ""; sameFrames = 0; cooldown = 0; typed = 0;
    R.active = true; R.status = "running";
    note("Demo on: the computer plays" + (scr === "duel" ? " (from the middle of this duel)" : ""));
    if (scr === "campaign" || scr === "mainMenu") upgradeDeck("resume");
    pump();
  }
  window.Demo = {
    // Esc toggles the demo only while a demo game is loaded and the game itself is running
    available() { return !!(window.Save && Save.data && Save.data.demo && Game.top && !NO_DEMO_SCREENS.has(Game.top.name)); },
    get active() { return R.active && !!R.opts.demo; },
    toggle() { if (R.active) { if (R.opts.demo) pauseDemo(); } else resumeDemo(); },
  };
  function report() {
    const lines = ["=== RUNNER REPORT ===", "status " + R.status + ", seed " + (R.opts.seed === undefined ? "random" : R.opts.seed) + ", " + R.duels.length + " duels (" + R.duels.filter((x) => x.won).length + " won), " + Math.round(R.frames / 60) + "s of game time"];
    const per = {};
    for (const x of R.duels) { const p = per[x.key] || (per[x.key] = { name: x.name, w: 0, l: 0, turns: 0, farm: 0 }); if (x.won) p.w++; else p.l++; p.turns += x.turns; if (x.farm) p.farm++; }
    for (const d of Duelists.all) { const p = per[d.key]; if (p) lines.push("  " + p.name.padEnd(12) + " W" + p.w + " L" + p.l + "  avg " + (p.turns / (p.w + p.l)).toFixed(1) + " turns" + (p.farm ? "  (" + p.farm + " farming)" : "")); }
    lines.push("Domino: " + (Save.data ? Save.data.domino : "?") + " in hand, " + (R.spent || 0) + " spent in the shop, " + (R.sold || 0) + " made selling spares; card packs opened: " + (R.packs || 0) + "; tournaments: " + (R.cups || 0) + " entered, " + (R.cupWins || 0) + " won");
    lines.push("deck changes: " + R.deckChanges.length);
    for (const c of R.deckChanges) lines.push("  after duel " + c.duel + ": +" + c.plus.join(", +") + "  -" + c.minus.join(", -"));
    if (R.finalDeck && R.finalDeck.length) { const cnt = {}; for (const id of R.finalDeck) cnt[id] = (cnt[id] || 0) + 1; lines.push("final deck: " + Object.keys(cnt).map((id) => CardDB.get(Number(id)).name + (cnt[id] > 1 ? " x" + cnt[id] : "")).join(", ")); }
    lines.push("text past the screen edge: " + R.overflows.size);
    for (const o of R.overflows.values()) lines.push('  ' + o.screen + ': "' + o.text + '" at x=' + o.x + " y=" + o.y);
    lines.push("errors: " + R.errors.length); for (const e of R.errors) lines.push("  " + e);
    return lines.join("\n");
  }

  window.Runner = {
    get active() { return R.active; }, get status() { return R.status; }, get frames() { return R.frames; },
    log: R.log, errors: R.errors, duels: R.duels, deckChanges: R.deckChanges, overflows: R.overflows,
    get speed() { return R.speed; }, set speed(v) { R.speed = Math.max(1, v | 0); },
    // opts: { seed, speed, name, maxDuels, tour, keepSave, quiet, slot (developer runs, default: the last file),
    //         human (normal speed, no narration skipping), demo (title-screen demo in the file already selected) }
    start(opts) {
      if (R.active) return "already running";
      R.opts = opts || {}; R.status = "running"; R.frames = 0; R.startedAt = Date.now();
      R.log.length = 0; R.errors.length = 0; R.duels.length = 0; R.deckChanges.length = 0; R.overflows.clear();
      pending = null; lastScreen = ""; sameFrames = 0; toured = false; tourQueue = []; farmLeft = 0; lastProgress = 0; typed = 0; cooldown = 0; deckTodo = null; shopTodo = null; sellTodo = null; renewTodo = 0; cupWanted = false; cupSkip = -1; cup = null; R.spent = 0; R.sold = 0; R.packs = 0; R.cups = 0; R.cupWins = 0; for (const k in streak) delete streak[k];
      if (R.opts.speed) R.speed = R.opts.speed;
      if (R.opts.human) R.opts.tour = false; // real time, no menu tour
      if (R.opts.seed !== undefined) seedRandom(Number(R.opts.seed)); else Math.random = origRandom;
      if (!R.opts.demo) { // developer run: keep the file's previous contents aside (an interrupted run already did)
        R.slot = R.opts.slot || Save.SLOTS; Save.slot = R.slot;
        try { if (localStorage.getItem(BACKUP_KEY(R.slot)) === null) { const cur = localStorage.getItem(Save.key(R.slot)); localStorage.setItem(BACKUP_KEY(R.slot), cur === null ? "" : cur); } } catch (e) { }
      } else R.slot = Save.slot; // the title screen picked and cleared the file
      R.active = true;
      note("Start: fresh game in file " + R.slot + (R.opts.seed !== undefined ? " (seed " + R.opts.seed + ")" : "") + ", speed " + R.speed + " frames/pump");
      // the file is cleared only once the old screen is gone (it may still draw from the save during the fade)
      Game.transition(() => { Game.stack.length = 0; if (!R.opts.demo) Save.erase(); Game.push(Screens.nameEntry()); });
      if (!R.opts.manual) pump();
      return "running";
    },
    stop() { stop("stopped"); }, pause: pauseDemo, resume: resumeDemo,
    // drive synchronously for up to n frames (for tests); returns the status line
    play(n) { const f0 = R.frames; while (R.active && R.frames - f0 < (n || 600)) stepSafe(); drawHud(); return hud.textContent.split("\n")[0]; },
    report, restoreSave, bestDeck, cardValue, upgradeDeck, pumpOnce, explainNew,
  };
  // ?runner=1 starts a run as soon as the game has booted
  const q = location.search;
  if (/[?&]runner(=|&|$)/.test(q)) {
    const get = (k) => { const m = q.match(new RegExp("[?&]" + k + "=([^&]+)")); return m ? decodeURIComponent(m[1]) : undefined; };
    const wait = () => { if (window.Assets && Assets.ready && Game.top) Runner.start({ seed: get("seed"), speed: get("speed") ? Number(get("speed")) : undefined, name: get("name"), maxDuels: get("max") ? Number(get("max")) : undefined, human: !!get("human"), keepSave: !!get("keep"), slot: get("slot") ? Number(get("slot")) : undefined }); else setTimeout(wait, 200); };
    wait();
  }
})();
