// CHEST (browse every card you own) and DECK (edit the 40-card deck within Capacity / Level limits).
window.Screens = window.Screens || {};
(function () {
  const C = G.C;
  // Space cycles the sort order, Tab the filter (both lists remember them while the screen is open)
  const SORTS = ["No.", "A-Z", "ATK", "DEF", "Attr", "Type", "Rarity"];   // no Lv: monsters have no levels
  const SHOP_SORTS = [{ mode: 6, tag: "Rare" }, { mode: 1, tag: "A-Z" }, { mode: 2, tag: "ATK" }]; // the shop sorts by rarity, name or ATK - nothing else
  // "Ritual mon" is for the gallery (Select in the Chest): those monsters are never owned, they come out of a ritual
  const FILTERS = ["All", "Normal", "Effect", "Ritual mats", "Ritual mon", "Ritual", "Spell", "Trap"];
  const RITUAL_MATS = new Set(); // monsters named as an offering by some ritual card
  for (const sid in Effects.ritual) for (const n of Effects.ritual[sid].need) RITUAL_MATS.add(n);
  function sortCards(ids, mode) {
    const k = (id) => CardDB.get(id);
    const arr = ids.slice();
    switch (mode) {
      case 1: arr.sort((a, b) => k(a).name.localeCompare(k(b).name)); break;
      case 2: arr.sort((a, b) => ((k(b).atk || -1) - (k(a).atk || -1)) || a - b); break;
      case 3: arr.sort((a, b) => ((k(b).def || -1) - (k(a).def || -1)) || a - b); break;
      case 4: arr.sort((a, b) => ((k(a).el || "~").localeCompare(k(b).el || "~")) || a - b); break;
      case 5: arr.sort((a, b) => ((k(a).ty || "~" + k(a).kind).localeCompare(k(b).ty || "~" + k(b).kind)) || a - b); break;
      case 6: arr.sort((a, b) => (Shop.rarity(b) - Shop.rarity(a)) || a - b); break; // rarest first
      default: arr.sort((a, b) => a - b);
    }
    return arr;
  }
  function filterCards(ids, mode) {
    if (!mode) return ids;
    return ids.filter((id) => {
      const c = CardDB.get(id); if (!c) return false;
      switch (mode) {
        case 1: return c.kind === "M" && !Effects.isEffect(id) && !Banlist.ritualOnly(id);
        case 2: return c.kind === "M" && Effects.isEffect(id);
        case 3: return c.kind === "M" && RITUAL_MATS.has(id);
        case 4: return c.kind === "M" && Banlist.ritualOnly(id);
        case 5: return c.kind === "R";
        case 6: return c.kind === "S";
        case 7: return c.kind === "T";
      }
      return true;
    });
  }
  // the two footer lines under a list: current sort order and filter (clicking a line cycles it)
  function drawFooter(line1, line1Color, filterMode, bg) {
    G.fill(0, 122, 94, 22, bg || "#e0e0e0"); G.fill(0, 122, 94, 1, C.gray);
    G.text(2, 124, line1, line1Color || C.darkgray);
    const f = FILTERS[filterMode]; G.text(2, 134, (f.length <= 6 ? "Show " : "") + f, filterMode ? C.purple : C.darkgray);
  }
  // shared row renderer: name, compact stats, cost
  function renderRow(id, x, y, extra, color) {
    const c = CardDB.get(id); if (!c) return;
    color = color || C.black;
    // [name][limit tag][value]: the value ends just before the list's scroll bar, the name takes what is left
    const val = c.kind === "M" ? String(c.atk) : c.kind, tag = Banlist.tag(id);
    const valX = x + 84 - val.length * 8, nameMax = Math.floor((valX - x - 4) / 8) - (tag ? 1 : 0);
    G.text(x, y, c.name.slice(0, nameMax), color);
    if (tag) G.text(valX - 10, y, tag, tag === "R" ? C.purple : C.red);
    G.textR(x + 84, y, val, c.kind === "M" ? color : C.purple);
  }
  // right side card panel
  function sidePanel(id, unknown) {
    G.fill(94, 0, 66, 144, C.yellow); G.fill(94, 0, 1, 144, C.black);
    if (!id) return;
    const c = CardDB.get(id);
    if (unknown) { G.fill(95, 1, 64, 80, "#404050"); G.rect(97, 3, 60, 76, "#8080a0"); G.textC(127, 36, "?", C.white); G.textC(127, 48, "not", "#c0c0d0"); G.textC(127, 57, "owned", "#c0c0d0"); }
    else Assets.drawCard(id, 95, 1);
    if (c.kind === "M") {
      Assets.icon("atk", 97, 84); G.textR(158, 84, c.atk); Assets.icon("def", 97, 93); G.textR(158, 93, c.def);
      G.text(97, 103, c.el.slice(0, 7)); G.text(97, 112, c.ty.slice(0, 7));
    } else { G.text(97, 84, CardDB.kindName(c)); }
    const tag = Banlist.tag(id);
    if (tag) { const short = tag === "F" ? "FORB" : tag === "R" ? "RITL" : "LTD" + tag; if (c.kind === "M") G.text(125, 121, short, tag === "R" ? C.purple : C.red); else G.text(97, 94, Banlist.label(id).slice(0, 7), C.red); }
    G.text(96, 131, "Own" + Save.owned(id) + " Dk" + Save.inDeck(id), C.darkgray);
  }

  Screens.chest = function () {
    let list, sortMode = 0, filterMode = 0, menu = null, info = null, msg = null, gallery = false; // gallery: all 800 cards
    const build = () => {
      const ids = gallery ? CardDB.all.map((c) => c.id) : Save.chestList();
      const items = sortCards(filterCards(ids, filterMode), sortMode);
      const sel = list ? list.sel : 0;
      list = new UI.ListView({ x: 0, y: 12, w: 94, h: 110, rows: 10, lineH: 10, items, render: (id, x, y, s) => { const own = Save.owned(id); renderRow(id, x, y, own ? String(own) + (Save.inDeck(id) ? "*" : " ") : "-", own ? C.black : C.gray); } });
      list.sel = Math.min(sel, Math.max(0, items.length - 1)); list.clamp();
    };
    return {
      enter() { build(); Music.play("prep"); },
      update() {
        if (msg) { if (msg.update()) msg = null; return; }
        if (info) { if (UI.detailInput()) return; if (Input.pressed("a") || Input.pressed("b") || Input.click) { info = null; Input.consumeAll(); Sfx.cancel(); } return; }
        if (menu) {
          const r = menu.update();
          if (r === "cancel") { menu = null; return; }
          if (r === "ok") {
            const v = menu.value, id = list.item; menu = null;
            if (v === "info") info = id;
            else if (v === "fusions") Game.push(Screens.fusions(id));
          }
          return;
        }
        if (Input.pressed("sort") || Input.hit(0, 122, 94, 11)) { sortMode = (sortMode + 1) % SORTS.length; Sfx.ok(); build(); return; }
        if (Input.pressed("filter") || Input.hit(0, 133, 94, 11)) { filterMode = (filterMode + 1) % FILTERS.length; Sfx.ok(); build(); return; }
        if (Input.pressed("select") || Input.hit(0, 0, 94, 12)) { gallery = !gallery; Sfx.ok(); build(); return; } // chest <-> gallery of all 800
        const r = list.update();
        if (r === "cancel") { Game.pop(); return; }
        if (r === "ok") {
          const id = list.item; if (!id) return;
          const items = [{ label: "Details", value: "info" }];
          if (CardDB.get(id).kind === "M") items.push({ label: "Fusions", value: "fusions" });
          items.push({ label: "Back", value: "back" });
          menu = new UI.Menu(items, { x: 8, y: 60, w: 84, style: "menu", clickOutsideCancels: true });
        }
      },
      draw() {
        G.clear(C.white);
        G.box(0, 0, 94, 12, "dark");
        if (gallery) { G.text(3, 2, "ALL", C.gold); G.textR(91, 2, Save.chestList().length + ":" + CardDB.all.length, C.white); } // the font has no slash
        else { G.text(3, 2, "CHEST", C.white); G.textR(91, 2, "x" + Save.chestList().length, C.gold); }
        list.draw();
        // a ritual monster is never owned - it comes out of a ritual - so the gallery shows its picture anyway
        sidePanel(list.item, gallery && !Save.owned(list.item) && !Banlist.ritualOnly(list.item));
        drawFooter("Sort " + SORTS[sortMode], C.darkgray, filterMode);
        if (menu) menu.draw();
        if (info) UI.cardDetail(info, { owned: Save.owned(info), inDeck: Save.inDeck(info) });
        if (msg) msg.draw();
      },
    };
  };

  // FUSIONS: everything a monster fuses with - among the cards you own (Tab: every card in the game) - and what comes out
  Screens.fusions = function (baseId) {
    let list, ownedOnly = true, info = null;
    const base = CardDB.get(baseId);
    const build = () => {
      const rows = [];
      const ids = ownedOnly ? Save.chestList() : CardDB.all.map((c) => c.id);
      for (const pid of ids) {
        if (pid === baseId && Save.owned(pid) < 2 && ownedOnly) continue; // fusing a card with itself needs two copies
        const r = CardDB.fuse(baseId, pid); if (!r) continue;
        rows.push({ partner: pid, result: r });
      }
      rows.sort((a, b) => (CardDB.get(b.result).atk - CardDB.get(a.result).atk) || (a.partner - b.partner));
      const sel = list ? list.sel : 0;
      list = new UI.ListView({ x: 0, y: 12, w: 94, h: 110, rows: 10, lineH: 10, items: rows, render: (it, x, y) => {
        const p = CardDB.get(it.partner), res = CardDB.get(it.result), own = Save.owned(it.partner) > 0;
        const val = String(res.atk), valX = x + 84 - val.length * 8;
        G.text(x, y, p.name.slice(0, Math.floor((valX - x - 4) / 8) - (Save.inDeck(it.partner) ? 1 : 0)) + (Save.inDeck(it.partner) ? "*" : ""), own ? C.black : C.gray);
        G.textR(x + 84, y, val, own ? C.blue : C.gray);
      } });
      list.sel = Math.min(sel, Math.max(0, rows.length - 1)); list.clamp();
    };
    return {
      enter() { build(); },
      update() {
        if (info) { if (UI.detailInput()) return; if (Input.pressed("a") || Input.pressed("b") || Input.click) { info = null; Input.consumeAll(); Sfx.cancel(); } return; }
        if (Input.pressed("filter") || Input.hit(94, 132, 66, 12)) { ownedOnly = !ownedOnly; Sfx.ok(); build(); return; }
        if (Input.hit(95, 1, 64, 80) && list.item) { info = list.item.result; return; }
        const r = list.update();
        if (r === "cancel") { Game.pop(); return; }
        if (r === "ok" && list.item) info = list.item.result; // the result card's page
      },
      draw() {
        G.clear(C.white);
        G.box(0, 0, 94, 12, "dark"); G.text(3, 2, "FUSION", C.gold); G.textR(91, 2, "x" + list.items.length, C.white);
        list.draw();
        sidePanel(list.item ? list.item.result : null);
        // footer: what we are fusing, and the result of the highlighted row
        G.fill(0, 122, 94, 22, "#e0e0e0"); G.fill(0, 122, 94, 1, C.gray);
        G.text(2, 124, base.name.slice(0, 11), C.darkgray);
        if (list.item) G.text(2, 134, "= " + CardDB.get(list.item.result).name.slice(0, 9), C.blue);
        else G.text(2, 134, ownedOnly ? "None owned" : "No fusions", C.darkgray);
        G.fill(94, 132, 66, 12, ownedOnly ? "#d0e8ff" : "#ffe8c0"); G.textC(127, 134, ownedOnly ? "Owned" : "All", C.darkgray); // Tab toggles
        if (info) UI.cardDetail(info, { owned: Save.owned(info), inDeck: Save.inDeck(info) });
      },
      state() { return { sel: list.sel, items: list.items.map((it) => it.partner), ownedOnly, info: !!info }; },
    };
  };

  // CARD SHOP: buy from the 10-card shelf (renewed every 10 duels) or sell spare cards, in Domino
  Screens.shop = function () {
    let side = 0; // 0 = buy, 1 = sell
    let buyList, sellList, sortMode = 0, filterMode = 0, msg = null, info = null, menu = null;
    const stock = () => Shop.ensureStock().stock;
    const sortBy = () => SHOP_SORTS[sortMode].mode;
    const sellable = () => sortCards(filterCards(Save.chestList().filter((id) => Save.spare(id) > 0), filterMode), sortBy());
    const row = (id, x, y, right, sold) => {
      const c = CardDB.get(id); if (!c) return;
      const valX = x + 84 - right.length * 8;
      G.text(x, y, c.name.slice(0, Math.floor((valX - x - 4) / 8)), sold ? C.gray : Shop.COLORS[Shop.rarity(id)]);
      G.textR(x + 84, y, right, sold ? C.gray : C.black);
    };
    const build = () => {
      const bs = buyList ? buyList.sel : 0, ss = sellList ? sellList.sel : 0;
      const order = stock().map((s, i) => i);
      const by = sortCards(stock().map((s) => s.id), sortBy()); order.sort((a, b) => by.indexOf(stock()[a].id) - by.indexOf(stock()[b].id));
      buyList = new UI.ListView({ x: 0, y: 12, w: 94, h: 100, rows: 9, lineH: 10, items: order, render: (i, x, y) => { const s = stock()[i]; row(s.id, x, y, s.sold ? "SOLD" : String(Shop.price(s.id)), s.sold); } });
      sellList = new UI.ListView({ x: 0, y: 12, w: 94, h: 100, rows: 9, lineH: 10, items: sellable(), render: (id, x, y) => row(id, x, y, String(Shop.sellPrice(id)), false) });
      buyList.sel = Math.min(bs, Math.max(0, buyList.items.length - 1)); buyList.clamp();
      sellList.sel = Math.min(ss, Math.max(0, sellList.items.length - 1)); sellList.clamp();
    };
    const say = (t) => { msg = new UI.MessageBox({ text: t, y: 100, h: 40, speed: 4 }); };
    // a fresh shelf on demand: the first one of every stock period is free, the next ones cost Domino
    function doReroll() {
      const p = Shop.rerollPrice(), r = Shop.reroll();
      if (!r.ok) { Sfx.error(); say(r.why + "."); return; }
      Sfx.reward(); build();
      const free = Shop.duelsUntilRefresh();
      say((p ? "New cards, for " + p + " Domino." : "New cards, on the house!") + " Free renew in " + free + " duel" + (free === 1 ? "" : "s") + ".");
    }
    const active = () => side === 0 ? buyList : sellList;
    const selectedId = () => { const a = active(); if (a.item === undefined) return null; return side === 0 ? stock()[a.item].id : a.item; };
    return {
      enter() { build(); Music.play("prep"); },
      exit() { Save.save(); },
      update() {
        if (msg) { if (msg.update()) msg = null; return; }
        if (info) { if (UI.detailInput()) return; if (Input.pressed("a") || Input.pressed("b") || Input.click) { info = null; Input.consumeAll(); Sfx.cancel(); } return; }
        if (menu) {
          const r = menu.update();
          if (r === "cancel") { menu = null; return; }
          if (r === "ok") {
            const v = menu.value; menu = null;
            if (v === "info") info = selectedId();
            else if (v === "fusions") Game.push(Screens.fusions(selectedId()));
            else if (v === "buy") { const i = buyList.item; const res = Shop.buy(i); if (!res.ok) { Sfx.error(); say(res.why); } else { Sfx.reward(); build(); say("You bought " + CardDB.get(res.id).name + "!"); } }
            else if (v === "sell") { const id = sellList.item; const res = Shop.sell(id); if (!res.ok) { Sfx.error(); say(res.why); } else { Sfx.ok(); build(); say("Sold for " + Shop.sellPrice(id) + " Domino."); } }
          }
          return;
        }
        if (Input.pressed("left") || Input.pressed("right") || Input.hit(0, 0, 94, 12)) { side = 1 - side; Sfx.move(); Input.consume("left"); Input.consume("right"); return; }
        // BUY: Space renews the shelf, Tab (or the sort tag) cycles the order. SELL: Space sorts, Tab filters.
        const cycleSort = () => { sortMode = (sortMode + 1) % SHOP_SORTS.length; Sfx.ok(); build(); };
        if (Input.pressed("sort")) { if (side === 0) doReroll(); else cycleSort(); return; }
        if (side === 0 && Input.hit(0, 132, 94, 12)) { doReroll(); return; }
        if (Input.pressed("filter")) { if (side === 0) cycleSort(); else { filterMode = (filterMode + 1) % FILTERS.length; Sfx.ok(); build(); } return; }
        if (Input.hit(0, 112, 94, 10)) { cycleSort(); return; }                                    // the sort tag beside the purse
        if (side === 1 && Input.hit(0, 122, 94, 11)) { cycleSort(); return; }
        if (side === 1 && Input.hit(0, 133, 94, 11)) { filterMode = (filterMode + 1) % FILTERS.length; Sfx.ok(); build(); return; }
        if (Input.hit(95, 1, 64, 80) && selectedId()) { info = selectedId(); return; }
        const r = active().update();
        if (r === "cancel") { Game.pop(); return; }
        if (r === "ok" && selectedId()) {
          const id = selectedId(), items = [];
          if (side === 0) { const s = stock()[buyList.item]; items.push({ label: s.sold ? "Sold out" : "Buy for " + Shop.price(id), value: "buy", disabled: s.sold }); }
          else items.push({ label: "Sell for " + Shop.sellPrice(id), value: "sell" });
          items.push({ label: "Details", value: "info" });
          if (CardDB.get(id).kind === "M") items.push({ label: "Fusions", value: "fusions" });
          items.push({ label: "Back", value: "back" });
          menu = new UI.Menu(items, { x: 8, y: 60, w: 84, style: "menu", clickOutsideCancels: true });
        }
      },
      draw() {
        G.clear(C.white);
        G.box(0, 0, 94, 12, "dark");
        G.text(3, 2, side === 0 ? "BUY" : "SELL", C.gold); G.text(side === 0 ? 35 : 43, 2, side === 0 ? ">SELL" : ">BUY", C.gray);
        active().draw();
        sidePanel(selectedId());
        // footer: your Domino, the selected card's rarity, and when the shelf renews / how big the chest is
        G.fill(0, 112, 94, 32, "#e0e0e0"); G.fill(0, 112, 94, 1, C.gray);
        const dm = Save.data.domino; G.text(2, 114, "D " + Math.min(dm, 99999), C.darkgray); // the purse, then the sort order
        G.textR(92, 114, SHOP_SORTS[sortMode].tag, sortMode ? C.purple : C.darkgray);
        const id = selectedId(); if (id) G.text(2, 124, Shop.NAMES[Shop.rarity(id)], Shop.COLORS[Shop.rarity(id)]);
        if (side === 0) { // the RENEW button: a fresh shelf, free once per stock period, then for Domino
          const p = Shop.rerollPrice(), can = Shop.canReroll().ok;
          G.fill(0, 132, 94, 12, can ? "#c8e8ff" : "#d8d8d8"); G.fill(0, 132, 94, 1, C.gray);
          G.text(2, 134, "RENEW " + (p ? p + "D" : "free"), can ? C.black : C.gray);
        } else G.text(2, 134, "Chest: " + Save.chestTotal(), C.darkgray);
        if (menu) menu.draw();
        if (info) UI.cardDetail(info, { owned: Save.owned(info), inDeck: Save.inDeck(info) });
        if (msg) msg.draw();
      },
      // for the automated runner
      state() { const a = active(); return { side, sel: a.sel, items: side === 0 ? stock().map((s) => s.sold ? 0 : s.id) : a.items.slice(), order: side === 0 ? a.items.slice() : null, msg: !!msg, menu: !!menu, info: !!info, reroll: Shop.rerollPrice() }; },
    };
  };

  Screens.deckEdit = function () {
    let side = 0; // 0 = deck list, 1 = chest list
    let deckList, chestList, sortMode = 0, filterMode = 0, msg = null, info = null, menu = null;
    const deckIds = () => sortCards(filterCards(Save.data.deck, filterMode), sortMode);
    const spareIds = () => sortCards(filterCards(Save.chestList().filter((id) => Save.spare(id) > 0), filterMode), sortMode);
    const build = () => {
      const ds = deckList ? deckList.sel : 0, cs = chestList ? chestList.sel : 0;
      deckList = new UI.ListView({ x: 0, y: 12, w: 94, h: 110, rows: 10, lineH: 10, items: deckIds(), render: (id, x, y) => renderRow(id, x, y, String(CardDB.get(id).cost).padStart(3, " ")) });
      chestList = new UI.ListView({ x: 0, y: 12, w: 94, h: 110, rows: 10, lineH: 10, items: spareIds(), render: (id, x, y) => renderRow(id, x, y, "x" + Save.spare(id)) });
      deckList.sel = Math.min(ds, Math.max(0, deckList.items.length - 1)); deckList.clamp();
      chestList.sel = Math.min(cs, Math.max(0, chestList.items.length - 1)); chestList.clamp();
    };
    const say = (t) => { msg = new UI.MessageBox({ text: t, y: 100, h: 40, speed: 4 }); };
    function autoBuild() {
      // the deck editor and the demo share one builder (js/data/deckbuild.js): cards are ranked by what they do in a
      // duel, not by printed ATK, and the deck is then improved as a whole so effects, partners, fusion material,
      // ritual offerings and the Cyber-Stein package earn their slots
      const deck = DeckBuild.bestDeck();
      Save.data.deck = deck; Save.save(); build();
      say(deck.length === 40 ? "Auto-built a 40 card deck." : "Not enough cards for 40! Win more duels.");
    }
    return {
      enter() { build(); Music.play("prep"); },
      exit() { Save.save(); },
      update() {
        if (msg) { if (msg.update()) msg = null; return; }
        if (info) { if (UI.detailInput()) return; if (Input.pressed("a") || Input.pressed("b") || Input.click) { info = null; Input.consumeAll(); Sfx.cancel(); } return; }
        if (menu) {
          const r = menu.update();
          if (r === "cancel") { menu = null; return; }
          if (r === "ok") {
            const v = menu.value; menu = null;
            if (v === "auto") autoBuild(); else if (v === "clear") { Save.data.deck = []; Save.save(); build(); Sfx.ok(); } else if (v === "sort") { sortMode = (sortMode + 1) % SORTS.length; build(); }
            else if (typeof v === "string" && v.startsWith("slot")) { Save.useDeck(Number(v.slice(4))); build(); Sfx.ok(); say("Now editing Deck " + (Save.data.deckSlot + 1) + "."); }
            else if (v === "info") info = (side === 0 ? deckList : chestList).item;
            else if (v === "fusions") Game.push(Screens.fusions((side === 0 ? deckList : chestList).item));
            else if (v === "move") this.moveCard((side === 0 ? deckList : chestList).item);
          }
          return;
        }
        const active = side === 0 ? deckList : chestList;
        if (Input.pressed("left") || Input.pressed("right") || Input.hit(0, 0, 94, 12)) { side = 1 - side; Sfx.move(); Input.consume("left"); Input.consume("right"); }
        if (Input.pressed("sort") || Input.hit(0, 122, 94, 11)) { sortMode = (sortMode + 1) % SORTS.length; Sfx.ok(); build(); return; }
        if (Input.pressed("filter") || Input.hit(0, 133, 94, 11)) { filterMode = (filterMode + 1) % FILTERS.length; Sfx.ok(); build(); return; }
        if (Input.pressed("select")) {
          const items = [{ label: "Auto build", value: "auto" }, { label: "Sort: " + SORTS[sortMode], value: "sort" }, { label: "Clear deck", value: "clear" }];
          for (let i = 0; i < 3; i++) if (i !== Save.data.deckSlot) items.push({ label: "Edit Deck " + (i + 1) + " (" + Save.data.decks[i].length + ")", value: "slot" + i });
          items.push({ label: "Back", value: "back" });
          menu = new UI.Menu(items, { x: 8, y: 40, w: 84, style: "menu", clickOutsideCancels: true }); return;
        }
        if (Input.hit(95, 1, 64, 80) && active.item) { info = active.item; return; }
        const r = active.update();
        if (r === "cancel") { const p = Save.deckProblems(); if (p.length && !Save.legalDecks().length) say("Warning: " + p[0]); else { Game.pop(); } return; }
        if (r === "ok" && active.item) {
          const items = [{ label: side === 0 ? "To Chest" : "To Deck", value: "move" }, { label: "Details", value: "info" }];
          if (CardDB.get(active.item).kind === "M") items.push({ label: "Fusions", value: "fusions" });
          items.push({ label: "Back", value: "back" });
          menu = new UI.Menu(items, { x: 8, y: 60, w: 84, style: "menu", clickOutsideCancels: true });
        }
      },
      // deck side: one copy goes back to the chest; chest side: one copy joins the deck (if the rules allow)
      moveCard(id) {
        if (!id) return;
        if (side === 0) { const i = Save.data.deck.indexOf(id); if (i >= 0) { Save.data.deck.splice(i, 1); build(); Sfx.cancel(); } }
        else { const ok = Save.canAddToDeck(id); if (!ok.ok) { Sfx.error(); say(ok.why); } else { Save.data.deck.push(id); build(); Sfx.ok(); } }
        Save.save();
      },
      draw() {
        G.clear(C.white);
        const active = side === 0 ? deckList : chestList;
        G.box(0, 0, 94, 12, "dark");
        G.text(3, 2, side === 0 ? "DECK " + (Save.data.deckSlot + 1) : "CHEST", C.gold); G.tri(72, 4, "left", C.gray); G.tri(84, 4, "right", C.gray);
        active.draw();
        sidePanel(active.item);
        const probs = Save.deckProblems();
        const n = Save.data.deck.length, why = n < 40 ? "low" : n > 40 ? "high" : "limit"; // details come up when leaving with B
        drawFooter(probs.length ? n + ":40 " + why : n + ":40 " + SORTS[sortMode], probs.length ? C.red : C.black, filterMode, probs.length ? "#ffd0d0" : "#e0e0e0");
        if (menu) menu.draw();
        if (info) UI.cardDetail(info, { owned: Save.owned(info), inDeck: Save.inDeck(info) });
        if (msg) msg.draw();
      },
      // for the automated runner
      state() { const active = side === 0 ? deckList : chestList; return { side, sel: active.sel, items: active.items.slice(), msg: !!msg, menu: !!menu, info: !!info }; },
    };
  };
})();
