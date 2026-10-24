// Boot splash, title screen (New / Continue), name entry and the opening scene with Yugi.
window.Screens = window.Screens || {};
(function () {
  const C = G.C;

  Screens.boot = function () {
    let t = 0;
    return {
      enter() { t = 0; },
      update() {
        t++;
        if (Input.pressed("a") || Input.pressed("start") || Input.click) t = 999;
        if (t > 150) Game.goto(Screens.title());
      },
      draw() {
        if (t < 60) { G.clear("#000"); G.textC(80, 62, "LICENSED BY", C.white); G.textC(80, 74, "NINTENDO", C.white); }
        else { G.clear("#f8f8f8"); G.fill(48, 48, 64, 26, "#e02020"); G.fill(52, 52, 56, 18, "#f8f8f8"); G.textC(80, 57, "KONAMI", "#e02020"); G.textC(80, 90, "Konami Computer", C.black); G.textC(80, 100, "Entertainment Japan", C.black); }
      },
    };
  };

  Screens.title = function () {
    let sel = 0, anySave = false, t = 0, confirm = null, picker = null, pickMode = "";
    // New / Continue on one row, Demo (the computer plays a whole game) underneath
    const items = () => [{ label: "New", x: 30, y: 102 }, { label: "Continue", x: 84, y: 102 }, { label: "Demo", x: 64, y: 114 }];
    // one row per save file: number, name, wins/losses (demo games in gold)
    function fileRow(n) {
      const d = Save.peek(n);
      if (!d) return { label: n + " -- empty --", value: n, color: C.gray, empty: true };
      return { label: n + " " + d.name.slice(0, 8).padEnd(8) + " " + d.stats.wins + "-" + d.stats.losses, value: n, color: d.demo ? C.gold : C.white };
    }
    function openPicker(mode) {
      pickMode = mode;
      const rows = []; for (let n = 1; n <= Save.SLOTS; n++) rows.push(fileRow(n));
      if (mode === "continue") for (const r of rows) if (r.empty) r.disabled = true;
      picker = new UI.Menu(rows, { x: 6, y: 34, w: 148, style: "menu", clickOutsideCancels: true });
      picker.header = mode === "continue" ? "Load which file?" : mode === "demo" ? "Demo: which file?" : "New game: file?";
      const first = rows.findIndex((r) => mode === "continue" ? !r.empty : r.empty);
      picker.sel = first >= 0 ? first : 0;
    }
    function startIn(n) {
      Save.slot = n; Save.erase(n);
      if (pickMode === "demo") { if (!window.Runner) { Sfx.error(); return; } Runner.start({ human: true, demo: true, quiet: true }); }
      else Game.transition(() => { Game.stack.length = 0; Game.push(Screens.nameEntry()); });
    }
    return {
      enter() { anySave = Save.anyExists(); sel = anySave ? 1 : 0; t = 0; picker = null; confirm = null; Music.play("title"); },
      update() {
        t++;
        if (confirm) {
          const r = confirm.update();
          if (r === "ok" && confirm.value) { const n = confirm.slot; confirm = null; startIn(n); }
          else if (r) confirm = null;
          return;
        }
        if (picker) {
          const r = picker.update();
          if (r === "cancel") { picker = null; return; }
          if (r === "ok") {
            const n = picker.value, row = picker.items[picker.sel]; picker = null;
            if (pickMode === "continue") { Save.load(n); Game.goto(Screens.mainMenu()); return; }
            if (!row.empty) { confirm = UI.confirm({ text: "Overwrite file " + n + "?", defaultNo: true, x: 52, y: 60 }); confirm.slot = n; return; }
            startIn(n);
          }
          return;
        }
        if (Input.pressed("left")) { sel = sel === 2 ? 1 : sel === 1 ? 0 : 2; Sfx.move(); }
        if (Input.pressed("right")) { sel = sel === 2 ? 0 : sel + 1; Sfx.move(); }
        if (Input.pressed("up") || Input.pressed("down")) { sel = sel === 2 ? 0 : 2; Sfx.move(); }
        for (let i = 0; i < 3; i++) { const it = items()[i]; if (Input.hit(it.x - 12, it.y - 2, it.label.length * 8 + 16, 12)) { sel = i; this.choose(); return; } }
        if (Input.pressed("a") || Input.pressed("start")) this.choose();
      },
      choose() {
        if (sel === 1 && !anySave) { Sfx.error(); return; }
        Sfx.ok(); openPicker(sel === 0 ? "new" : sel === 1 ? "continue" : "demo");
      },
      draw() {
        G.imgFull(Assets.img.title, 0, 0);
        const it = items();
        for (let i = 0; i < 3; i++) {
          G.text(it[i].x + 1, it[i].y + 1, it[i].label, "#103828"); G.text(it[i].x, it[i].y, it[i].label, i === sel ? C.gold : "#a8e8c8");
          if (i === sel) G.text(it[i].x - 10, it[i].y, "\x8f", C.gold);
        }
        G.textC(80, 130, "\x8b1996 K.TAKAHASHI", "#c8e8d8");
        if (picker) {
          G.dim(0.5);
          G.box(picker.x, picker.y - 13, picker.w, 14, "dark"); G.text(picker.x + 4, picker.y - 10, picker.header, C.white);
          picker.draw();
          G.text(picker.x + 4, picker.y + picker.h + 3, "W-L", C.white); G.textR(picker.x + picker.w - 4, picker.y + picker.h + 3, "gold=demo", C.gold);
        }
        if (confirm) { G.dim(0.5); G.box(10, 40, 140, 18, "talk"); G.text(16, 45, confirm.question, C.white); confirm.draw(); }
      },
    };
  };

  Screens.nameEntry = function () {
    const rows = ["ABCDEFGHIJKLM", "NOPQRSTUVWXYZ", "abcdefghijklm", "nopqrstuvwxyz", "0123456789 .-"];
    let cx = 0, cy = 0, name = "";
    const maxLen = 8;
    return {
      enter() { name = ""; cx = 0; cy = 0; Music.play("name"); window.addEventListener("keydown", this.onKey); },
      exit() { window.removeEventListener("keydown", this.onKey); },
      onKey(e) { if (e.key.length === 1 && /[A-Za-z0-9 .\-]/.test(e.key) && name.length < maxLen && !["z", "x", "Z", "X", " "].includes(e.key)) { name += e.key; } },
      update() {
        if (Input.pressed("left")) { cx = (cx + 12) % 13; Sfx.move(); }
        if (Input.pressed("right")) { cx = (cx + 1) % 13; Sfx.move(); }
        if (Input.pressed("up")) { cy = (cy + 5) % 6; Sfx.move(); }
        if (Input.pressed("down")) { cy = (cy + 1) % 6; Sfx.move(); }
        // mouse on grid
        for (let r = 0; r < 5; r++) for (let c = 0; c < 13; c++) if (Input.hit(8 + c * 11, 44 + r * 12, 11, 12)) { cx = c; cy = r; this.pick(); return; }
        if (Input.hit(8, 106, 40, 12)) { cy = 5; cx = 0; this.pick(); return; }
        if (Input.hit(56, 106, 40, 12)) { cy = 5; cx = 1; this.pick(); return; }
        if (Input.pressed("a")) this.pick();
        if (Input.pressed("b")) { if (name.length) { name = name.slice(0, -1); Sfx.cancel(); } }
        if (Input.pressed("start")) this.finish();
      },
      pick() {
        if (cy === 5) { if (cx < 6) this.finish(); else { name = name.slice(0, -1); Sfx.cancel(); } return; }
        const ch = rows[cy][cx];
        if (name.length < maxLen) { name += ch; Sfx.ok(); } else Sfx.error();
      },
      finish() {
        const n = name.trim();
        if (!n) { Sfx.error(); return; }
        Sfx.ok();
        Game.transition(() => { Game.stack.length = 0; Game.push(Screens.starterPick(n)); });
      },
      draw() {
        Assets.drawBG(4);
        G.box(8, 4, 144, 30, "talk");
        G.text(14, 9, "Enter your name:", C.white);
        G.text(14, 20, name, C.gold); if (G.blink()) G.fill(14 + name.length * 8, 27, 7, 1, C.gold);
        G.box(4, 40, 152, 64, "list");
        for (let r = 0; r < 5; r++) for (let c = 0; c < 13; c++) {
          const on = r === cy && c === cx;
          if (on) G.fill(8 + c * 11, 44 + r * 12, 11, 12, "#c8e8ff");
          G.text(10 + c * 11, 46 + r * 12, rows[r][c], C.black);
        }
        G.box(4, 104, 152, 16, "list");
        G.text(12, 108, "END", cy === 5 && cx < 6 ? C.red : C.black);
        G.text(60, 108, "BACK", cy === 5 && cx >= 6 ? C.red : C.black);
        G.text(8, 126, "A:pick B:erase", C.white); G.text(8, 134, "C:finish", C.white);
      },
    };
  };

  // three rolled starter decks: pick one with left/right and A (the file is created only now)
  Screens.starterPick = function (playerName) {
    let rolls = [], sel = 0, flash = 0;
    const CX = [4, 48, 92]; // the three signature cards, fanned
    return {
      name: "starterPick",
      enter() { rolls = Starters.rollThree(); sel = 0; Music.play("name"); },
      update() {
        flash++;
        if (Input.pressed("left")) { sel = (sel + 2) % 3; Sfx.move(); }
        if (Input.pressed("right")) { sel = (sel + 1) % 3; Sfx.move(); }
        if (Input.hit(0, 36, 40, 90)) { sel = (sel + 2) % 3; Sfx.move(); }
        else if (Input.hit(120, 36, 40, 90)) { sel = (sel + 1) % 3; Sfx.move(); }
        else if (Input.pressed("a") || Input.hit(40, 36, 80, 90) || Input.hit(0, 126, 160, 18)) this.take();
      },
      take() {
        const r = rolls[sel]; Sfx.ok();
        Save.newGame(playerName, r.deck, r.theme.key);
        Game.transition(() => { Game.stack.length = 0; Game.push(Screens.intro()); });
      },
      draw() {
        Assets.drawBG(4); G.dim(0.35);
        const r = rolls[sel]; if (!r) return;
        G.box(0, 0, 160, 12, "dark"); G.text(3, 2, "PICK A DECK", C.gold); G.textR(157, 2, (sel + 1) + " of 3", C.white);
        G.box(8, 14, 144, 22, "talk");
        G.textC(80, 17, r.theme.name + " deck", C.gold);
        G.textC(80, 26, r.theme.blurb.slice(0, 18), C.white);
        for (let i = 0; i < 3; i++) Assets.drawCard(r.cards[i], CX[i], 40);
        if (sel > 0 && flash % 40 < 28) G.tri(1, 78, "left", C.white);
        if (sel < 2 && flash % 40 < 28) G.tri(155, 78, "right", C.white);
        G.box(0, 122, 160, 22, "dark");
        G.text(4, 125, "Mons " + r.m.monsters + "  Spells " + r.m.spells, C.white);
        G.text(4, 134, "A: take it", C.gold); G.textR(156, 134, "arrows", C.gray);
      },
      state() { return { sel, decks: rolls.map((x) => x.deck), themes: rolls.map((x) => x.theme.key) }; }, // for the automated runner
    };
  };
  Screens.intro = function () {
    const lines = [
      "Welcome to the world of Yu-Gi-Oh!",
      "I'm Yugi. The town is full of duelists. Beat each one 5 times and new areas will open up.",
      "You win a card after every victory. Build your deck in the CHEST and the DECK editor.",
      "Try fusing monsters in your hand: play one onto another and see what happens. If they don't fuse you keep both, but you can't fuse again that turn.",
      "Some powerful cards are Limited to 1 or 2 copies. Check the Limit list in OPTIONS before you build your deck.",
      "Good luck, " + Save.data.name + "! It's time to duel!",
    ];
    let i = 0, box = null;
    return {
      enter() { box = new UI.MessageBox({ text: lines[0] }); Music.play("intro"); },
      update() {
        if (box.update()) { i++; if (i >= lines.length) { Game.goto(Screens.mainMenu()); return; } box = new UI.MessageBox({ text: lines[i] }); }
      },
      draw() { G.imgFull(Assets.img.intro, 0, 0); box.draw(); },
    };
  };
})();
