// Main menu (CAMPAIGN / FREE DUEL / RECORD / SHOP / CHEST / DECK / OPTIONS) and the options/help screens (Password lives in Options).
window.Screens = window.Screens || {};
(function () {
  const C = G.C;
  // the buttons sit exactly on the seven stone slabs painted in the background (staggered: 4 left, 3 right)
  const ITEMS = [
    { label: "CAMPAIGN", x: 0, y: 16, w: 78, go: () => Screens.campaign() },
    { label: "FREE DUEL", x: 0, y: 48, w: 78, go: () => Screens.freeDuel() },
    { label: "RECORD", x: 0, y: 80, w: 78, go: () => Screens.record() },
    { label: "SHOP", x: 0, y: 112, w: 78, go: () => Screens.shop() },
    { label: "CHEST", x: 80, y: 32, w: 78, go: () => Screens.chest() },
    { label: "DECK", x: 80, y: 64, w: 78, go: () => Screens.deckEdit() },
    { label: "OPTIONS", x: 80, y: 96, w: 78, go: () => Screens.options() },
  ];
  const COLS = [[0, 1, 2, 3], [4, 5, 6]]; // left column, right column (item indices)
  Screens.mainMenu = function () {
    let sel = 0, warn = "";
    return {
      enter() { warn = Save.deckProblems()[0] || ""; Music.play("menu"); },
      resume() { warn = Save.deckProblems()[0] || ""; Music.play("menu"); },
      update() {
        const col = sel < 4 ? 0 : 1, row = COLS[col].indexOf(sel), n = COLS[col].length;
        if (Input.pressed("up")) { sel = COLS[col][(row + n - 1) % n]; Sfx.move(); }
        if (Input.pressed("down")) { sel = COLS[col][(row + 1) % n]; Sfx.move(); }
        if (Input.pressed("left") || Input.pressed("right")) { const o = COLS[1 - col]; sel = o[Math.min(o.length - 1, row)]; Sfx.move(); }
        for (let i = 0; i < ITEMS.length; i++) { const it = ITEMS[i]; if (Input.over(it.x, it.y, it.w, 16) && Input.hover.x !== this._hx) { sel = i; this._hx = Input.hover.x; } if (Input.hit(it.x, it.y, it.w, 16)) { sel = i; this.go(); return; } }
        if (Input.pressed("a")) this.go();
      },
      go() { Sfx.ok(); Game.push(ITEMS[sel].go()); },
      draw() {
        Assets.drawBG(5);
        for (let i = 0; i < ITEMS.length; i++) {
          const it = ITEMS[i];
          G.box(it.x, it.y, it.w, 16, i === sel ? "talk" : "menu");
          if (i === sel && G.blink(8)) G.rect(it.x, it.y, it.w, 16, C.gold);
          G.textC(it.x + it.w / 2, it.y + 4, it.label, i === sel ? C.gold : C.white);
        }
        const d = Save.data;
        G.box(0, 0, 160, 10, "dark");
        G.text(3, 1, d.name.slice(0, 8), C.white); G.textR(157, 1, "W" + d.stats.wins + " L" + d.stats.losses, C.gold);
        if (warn) { G.box(0, 134, 160, 10, "dark"); G.text(3, 135, "!" + warn.slice(0, 18), C.red); }
      },
    };
  };

  Screens.options = function () {
    let menu, confirm = null, help = null;
    const build = () => new UI.Menu([
      { label: "Music: " + (Music.enabled ? "ON" : "OFF"), value: "music" },
      { label: "Music vol: " + Math.round(Music.volume * 10), value: "volume" },
      { label: "Sound FX: " + (Sfx.enabled ? "ON" : "OFF"), value: "sound" },
      { label: "Text: " + Settings.TEXT_NAMES[Settings.textSpeed], value: "text" },
      { label: "Enemy turn: " + (Settings.fastEnemy ? "Fast" : "Full"), value: "enemy" },
      { label: "How to play", value: "help" },
      { label: "Limit list", value: "banlist" },
      { label: "Password", value: "password" },
      { label: "Erase save data", value: "erase" },
      { label: "Back", value: "back" },
    ], { x: 20, y: 30, w: 120, style: "menu" });
    return {
      enter() { menu = build(); },
      update() {
        if (help) { if (help.update()) help = null; return; }
        if (confirm) {
          const r = confirm.update();
          if (r === "ok" && confirm.value) { Save.erase(); Game.goto(Screens.title()); }
          if (r) confirm = null;
          return;
        }
        const r = menu.update();
        if (r === "cancel") { Game.pop(); return; }
        if (r === "ok") {
          const v = menu.value;
          if (v === "sound") { Sfx.enabled = !Sfx.enabled; Music.saveSettings(); const sel = menu.sel; menu = build(); menu.sel = sel; }
          else if (v === "music") { Music.enabled = !Music.enabled; menu = build(); }
          else if (v === "volume") { Music.volume = Music.volume >= 0.95 ? 0 : Math.min(1, Math.round(Music.volume * 10) / 10 + 0.1); const sel = menu.sel; menu = build(); menu.sel = sel; }
          else if (v === "text") { Settings.textSpeed = (Settings.textSpeed + 1) % 4; Settings.save(); const sel = menu.sel; menu = build(); menu.sel = sel; }
          else if (v === "enemy") { Settings.fastEnemy = !Settings.fastEnemy; Settings.save(); const sel = menu.sel; menu = build(); menu.sel = sel; }
          else if (v === "help") help = new UI.MessageBox({ text: HELP, y: 4, h: 136, lines: 15, instant: true });
          else if (v === "banlist") Game.push(Screens.banlist());
          else if (v === "password") Game.push(Screens.password());
          else if (v === "erase") confirm = UI.confirm({ text: "Really erase everything?", defaultNo: true, x: 52, y: 90 });
          else Game.pop();
        }
      },
      draw() {
        Assets.drawBG(1); G.dim(0.3);
        G.text(20, 16, "OPTIONS", C.white);
        menu.draw();
        if (confirm) { G.box(8, 74, 144, 14, "talk"); G.text(12, 77, confirm.question, C.white); confirm.draw(); }
        if (help) help.draw();
      },
    };
  };
  // Forbidden / Limited list viewer
  Screens.banlist = function () {
    let list, info = null;
    return {
      enter() {
        const items = Banlist.entries();
        list = new UI.ListView({ x: 0, y: 12, w: 160, h: 120, rows: 11, lineH: 10, items, render: (it, x, y) => {
          const c = CardDB.get(it.id);
          const tag = it.limit === 0 ? "F" : String(it.limit);
          G.text(x, y, tag + " " + c.name.slice(0, 12), it.limit === 0 ? C.red : it.limit === 1 ? "#a04000" : C.black);
          G.textR(x + 150, y, c.kind === "M" ? String(c.atk) : c.kind, C.darkgray);
        } });
      },
      update() {
        if (info) { if (UI.detailInput()) return; if (Input.pressed("a") || Input.pressed("b") || Input.click) { info = null; Input.consumeAll(); } return; }
        const r = list.update();
        if (r === "cancel") { Game.pop(); return; }
        if (r === "ok" && list.item) info = list.item.id;
      },
      draw() {
        G.clear(C.white);
        G.box(0, 0, 160, 12, "dark"); G.text(3, 2, "LIMIT LIST", C.white); G.textR(157, 2, "A:info", C.gray);
        list.draw();
        G.fill(0, 132, 160, 12, "#e0e0e0"); G.text(2, 134, "1,2 = max copies", C.darkgray);
        if (info) UI.cardDetail(info, { owned: Save.owned(info), inDeck: Save.inDeck(info) });
      },
    };
  };
  const HELP = "HOW TO PLAY\n" +
    "Beat every duelist in an area 5 times to unlock the next area. Every win gives you a card. From Domino Town 2 on, a duelist you beat comes back stronger: a better deck and sharper play each time.\n" +
    "TOURNAMENT DECKS: every duelist has two. The one they bring in the campaign is their own faithful deck - their theme, their plan, their signature cards. Reach The Heavens and they all switch to the deck they take to the tournament, played at the highest skill, wherever you meet them: the same duelist, built to compete, staples and all.\n" +
    "DECK: you have three deck slots (switch in the deck editor's Select menu; before a duel you pick one when more than one is ready). Exactly 40 cards, up to 3 copies of each. Some cards are Limited (1) or Semi-Limited (2) - by ATK, and a few for what they do: see the Limit list in Options.\n" +
    "EARNINGS: every win is totted up on its own screen. Beating the duelist is the first line; the rest is how you won - damage dealt, monsters destroyed in battle, offerings, fusions, rituals, spells and traps used (or none at all), winning on their turn, from behind, in six turns, on your last Life Points or your last card, by deck-out or by Exodia. Every 1500 Domino earned in one duel shakes another card out of the duelist, up to three.\n" +
    "FLAWLESS DUEL: win without losing a single Life Point and the whole bill is multiplied by three, and a 5-card pack comes with it. Paying LP for a card of your own (Time Wizard's tails) counts as losing them; a Kuriboh that takes the hit for you does not.\n" +
    "CHALLENGERS: eight duelists roam outside the campaign (Mokuba, Tea, Ryou Bakura, Bandit Keith, the Paradox Brothers, Panik, Pegasus and Solomon Muto). The first duel you finish after one of them turns up in your area, they stop you for a duel - win or lose, they then wait for you in FREE DUEL. Beating them is never needed to finish the game.\n" +
    "TOURNAMENT (in FREE DUEL once you reach Ancient Egypt, once every 10 duels): 1000 Domino to enter an 8-seat bracket where every duelist fights at full strength. Every match is played out - the others as spectator duels. Round wins pay 500 and 1000 Domino; the champion gets 10000 Domino, an ultra rare, a super rare and a card pack. A loss knocks you out.\n" +
    "SHOP: 10 cards for sale, paid in Domino (you earn Domino by beating duelists). Bought cards sell out; the shelf is restocked every 10 duels. Tab sorts the shelf (by rarity, ATK, name...), and RENEW (the button under the list, or Space) restocks it at once: the first renew after every restock is free, any further one costs 250 Domino. Rarer cards cost more and show up less often. You can also sell spare cards, but your chest never drops below 40 cards.\n" +
    "CHEST and DECK lists: Space changes the sort order, Tab the filter (normal monsters, effect monsters, ritual materials, ritual cards, spells, traps). In the CHEST the Select key (backtick) switches to the gallery of all 800 cards, with the ones you own marked. A on a card opens its menu; Fusions lists what a monster fuses with among your cards (Tab: every card) and what comes out.\n" +
    "RITUAL monsters (Black Luster Soldier, Gate Guardian...) are not deck cards: play their ritual card and offer the monster it names (from your hand or field) to summon them.\n" +
    "DUEL: at the start of your turn you draw back up to 5 cards (no cards left to draw when you need one = you lose); card effects can draw past 5, but a turn cannot end with more than 5 cards in hand: discard the extras first. One Normal Summon (face up, may attack at once) or Set (face down in defence) per turn. Monsters have no levels and nothing is ever offered for them, so the biggest card in your hand comes down for free - what stops a deck of giants is the limit list, which counts ATK: 2100 or more is Semi-Limited (2 copies), 2500 or more is Limited (1). Rituals and fusions are special summons and don't use the normal summon. No position change on the turn a monster arrives, and no attacks on turn 1.\n" +
    "FUSION: play a hand monster onto another hand monster (the result waits in your hand) or onto one of your field monsters that has not attacked this turn (the result takes its place on the field). If they don't fuse you keep both cards but can't fuse again that turn. Fusing never uses your summon.\n" +
    "FIELDS boost the listed types by 30 percent. Equips add 500 if they fit the monster. Both are spell cards on the field: anything that destroys spells (Harpie's Feather Duster, Greenkappa, Armed Ninja) can destroy an equip or the field card too.\n" +
    "SPCL: many monsters have a special ability (brown text on the card page). Use it from the field with the SPCL command, once per turn; the monster can still attack afterwards. Brown 'Effect' text is always on: auras that lift whole types, bonuses that grow with the graveyard or your hand, and triggers when the monster is destroyed, discarded or wins a battle (Sangan searches, Kuriboh takes a hit in your place, Man-eater Bug takes its killer down...). The Toons and The Fiend Megacyber arrive as extra special summons; The Last Warrior seals normal summons for both sides.";
})();
