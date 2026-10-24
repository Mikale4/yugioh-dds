// Portrait + dialog screens: duelist banter before/after duels, reward presentation, endings.
window.Screens = window.Screens || {};
(function () {
  const C = G.C;

  // draws the 160x88 portrait scene for a duelist key (authentic scene when ripped, else portrait on a framed backdrop)
  Screens.drawScene = function (key, frameIdx) {
    const d = window.Duelists && Duelists.byKey[key];
    if (d && d.portrait && d.portrait !== key && !Assets.hasScene(key)) key = d.portrait; // the duelist's own art
    if (Assets.hasScene(key)) { Assets.drawScene(key, 0, 0); return; }
    const bg = frameIdx === undefined ? (Math.abs(hash(key)) % 5) : frameIdx;
    Assets.drawBGPart(bg, 0, 8, 160, 88, 0, 0);
    G.dim(0.25);
    Assets.drawPortrait(key, 0, 0);
    // ornamental frame
    G.rect(0, 0, 160, 88, "#e8c060"); G.rect(1, 1, 158, 86, "#604010");
  };
  function hash(s) { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0; return h; }

  // params: { key, lines:[...], keys:[...] (one portrait per line, optional), onDone(), sfx }
  Screens.talk = function (params) {
    let idx = 0, box = null;
    const faceAt = (i) => (params.keys && params.keys[i]) || params.key;
    return {
      enter() { idx = 0; box = new UI.MessageBox({ text: params.lines[0] }); },
      update() {
        if (box.update()) {
          idx++;
          if (idx >= params.lines.length) { if (this._done) return; this._done = true; if (params.onDone) params.onDone(); else Game.pop(); return; }
          box = new UI.MessageBox({ text: params.lines[idx] });
        }
      },
      draw() { Screens.drawScene(faceAt(idx)); box.draw(); },
    };
  };

  // reward after a win: the card and Domino, the flawless-duel bonus, grandpa's extra card, and now and then a 5-card
  // pack opened one card at a time
  // params: { key, cardId, grandpaCard, bonusCards:[ids], flawless, domino, pack:[ids], onDone }
  const FLIP = 28; // frames between two pack cards turning over
  Screens.reward = function (params) {
    let step = 0, box = null, t = 0, packT = -1; // packT: frames since the pack started opening (-1 = not yet)
    const steps = [];
    steps.push({ text: (params.champion ? "Tournament champion! You win " : "You won, so you get ") + CardDB.get(params.cardId).name + (params.domino ? " and " + params.domino + " Domino!" : "!"), card: params.cardId });
    for (const id of (params.bonusCards || [])) steps.push({ text: "That duel earned a bonus: " + CardDB.get(id).name + " is yours as well!", card: id });
    if (params.grandpaCard) steps.push(params.champion ? { text: "The runner-up hands over " + CardDB.get(params.grandpaCard).name + "!", card: params.grandpaCard } : { text: "Yugi's Grandpa gives you " + CardDB.get(params.grandpaCard).name + " too!", card: params.grandpaCard, grandpa: true });
    if (params.pack) {
      steps.push({ text: params.flawless ? "Not a scratch on you! A flawless duel opens a whole card pack..." : "And there's more: a card pack! Let's open it...", pack: params.pack });
      steps.push({ text: "Congratulations! The pack had " + params.pack.map((id) => CardDB.get(id).name).join(", ") + ". They are in your chest.", packShow: params.pack });
    }
    const revealed = () => Math.min(params.pack ? params.pack.length : 0, Math.floor(packT / FLIP));
    const next = () => { step++; box = new UI.MessageBox({ text: steps[step].text }); Sfx.reward(); if (steps[step].grandpa) Music.play("grandpa"); };
    return {
      enter() { box = new UI.MessageBox({ text: steps[0].text }); Sfx.reward(); Music.play("reward"); },
      update() {
        t++;
        const s = steps[step];
        if (s.pack && packT >= 0) { // the opening animation: A hurries it along
          const before = revealed();
          packT++; if (Input.pressed("a") || Input.click) { packT += FLIP; Input.consumeAll(); }
          if (revealed() > before) Sfx.draw();
          if (revealed() >= s.pack.length && packT >= s.pack.length * FLIP + 40) { Sfx.win(); next(); }
          return;
        }
        if (box.update()) {
          if (s.pack) { packT = 0; return; }
          if (step + 1 >= steps.length) { if (!this._done) { this._done = true; params.onDone(); } return; }
          next();
        }
      },
      draw() {
        const s = steps[Math.min(step, steps.length - 1)];
        Screens.drawScene(s.grandpa ? "grandpa" : params.key);
        if (s.card) { G.dim(0.35); G.box(45, 1, 70, 86, "card"); Assets.drawCard(s.card, 48, 4); }
        if (s.pack || s.packShow) {
          G.dim(0.35);
          const ids = s.pack || s.packShow, n = s.packShow ? ids.length : revealed();
          for (let i = 0; i < ids.length; i++) {
            const x = 2 + i * 32, y = 6;
            if (i < n) { G.fill(x - 1, y - 1, 30, 37, i === n - 1 && s.pack ? C.gold : C.white); Assets.drawCardScaled(ids[i], x, y, 28, 35); }
            else { G.fill(x - 1, y - 1, 30, 37, C.black); G.fill(x + 1, y + 1, 26, 33, "#703018"); G.rect(x + 3, y + 3, 22, 29, "#e0a040"); G.fill(x + 11, y + 14, 6, 6, "#e0a040"); }
          }
          if (s.pack && n > 0) { const nm = CardDB.get(ids[n - 1]).name; G.box(0, 46, 160, 14, "dark"); G.textC(80, 49, nm.length > 19 ? nm.slice(0, 18) + "." : nm, C.gold); }
          else if (s.pack) { G.box(0, 46, 160, 14, "dark"); G.textC(80, 49, packT < 0 ? "5 random cards!" : "Drawing...", C.white); }
        }
        if (s.pack && packT >= 0) { G.box(2, 92, 156, 50, "talk"); G.text(8, 98, "Opening the pack...", C.white); G.text(8, 108, revealed() + " of " + s.pack.length + " drawn", C.white); if (G.blink(20)) G.text(8, 126, "A: hurry", C.gray); }
        else box.draw();
      },
    };
  };

  // EARNINGS: the bill for a duel, read out one line at a time. Beating the duelist is only the first line; the
  // rest is how it was won. (The bonus tally of Yu-Gi-Oh! Ultimate Masters: World Championship Tournament 2006,
  // paid in Domino.)
  // params: { key, rows:[{name, amount}], bonus, mult, total, flawless, onDone }
  const ROW_H = 10, VIS = 10, STEP = 11;   // line height, lines on screen, frames between two lines landing
  Screens.earnings = function (params) {
    const rows = params.rows || [];
    let shown = 0, t = 0, run = 0, phase = "rows", top = 0;
    const flourish = params.flawless && params.mult > 1;
    function revealAll() { while (shown < rows.length) run += rows[shown++].amount; }
    function endRows() { phase = flourish ? "mult" : "done"; t = 0; if (!flourish) { run = params.total; Sfx.win(); } }
    return {
      enter() { Music.play("reward"); Sfx.reward(); },
      update() {
        t++;
        const hurry = Input.pressed("a") || Input.click;
        if (phase === "rows") {
          if (hurry) { Input.consumeAll(); revealAll(); endRows(); return; }
          if (t >= STEP) { t = 0; if (shown < rows.length) { run += rows[shown++].amount; Sfx.draw(); } else endRows(); }
          top = Math.max(0, shown - VIS);
          return;
        }
        if (phase === "mult") {                       // the flawless multiplier runs the total up on its own
          if (hurry) { Input.consumeAll(); run = params.total; phase = "done"; t = 0; Sfx.win(); return; }
          run = Math.min(params.total, params.bonus + Math.round((params.total - params.bonus) * (t / 40)));
          if (t >= 40) { run = params.total; phase = "done"; t = 0; Sfx.win(); }
          return;
        }
        if (rows.length > VIS) {
          if (Input.pressed("up") && top > 0) { top--; Sfx.move(); }
          if (Input.pressed("down") && top + VIS < rows.length) { top++; Sfx.move(); }
        }
        if (t > 20 && (hurry || Input.pressed("b"))) { Sfx.ok(); if (!this._done) { this._done = true; params.onDone(); } }
      },
      draw() {
        Assets.drawBG(3); G.dim(0.6);
        G.box(0, 0, 160, 12, "dark"); G.text(3, 2, "DUEL EARNINGS", C.gold);
        if (phase === "done") G.textR(157, 2, G.blink(24) ? "A:ok" : "", C.white);
        G.box(2, 13, 156, 105, "talk");
        for (let i = 0; i < VIS; i++) {
          const r = rows[top + i]; if (!r || top + i >= shown) break;
          const y = 17 + i * ROW_H, fresh = top + i === shown - 1 && phase === "rows";
          G.text(8, y, r.name, fresh ? C.gold : C.white);
          G.textR(148, y, String(r.amount), fresh ? C.gold : C.white);   // the last few pixels belong to the scroll arrows
        }
        // the font has no arrows, so the list draws its own: more above, more below
        if (rows.length > VIS && phase === "done") {
          if (top > 0) for (let i = 0; i < 3; i++) G.fill(153 - i, 17 + i, 1 + i * 2, 1, C.gold);
          if (top + VIS < rows.length) for (let i = 0; i < 3; i++) G.fill(151 + i, 110 + i, 5 - i * 2, 1, C.gold);
        }
        G.box(0, 118, 160, 26, "dark");
        if (flourish) G.text(4, 121, "FLAWLESS x" + params.mult, phase === "rows" ? C.gray : G.blink(10) ? C.gold : C.white);
        G.text(4, 133, "TOTAL", C.white);
        G.textR(157, 133, String(run) + " D", phase === "done" ? C.gold : C.white);
      },
    };
  };

  // ending credits after DarkNite falls
  Screens.ending = function () {
    let y = 150, t = 0;
    const lines = [
      "Yu-Gi-Oh!", "Dark Duel Stories", "", "You have defeated", "DarkNite, ruler of", "the Heavens!", "",
      "The three God cards", "appear before you...", "", "The God of Obelisk", "Saint Dragon - God", "of Osiris", "The Sun of God", "Dragon", "",
      "But the story is", "not over yet...", "", "Yami Yugi awaits in", "the Heavens.", "Defeat him 5 times", "and the four Rulers", "will reveal", "themselves.", "",
      "Original game", "KONAMI 2002", "", "Card game & story", "Kazuki Takahashi", "", "This fan recreation", "is for learning only.", "", "", "TO BE CONTINUED....",
    ];
    return {
      enter() { y = 150; t = 0; Music.play("staff"); },
      update() { t++; y -= 0.3; if (t > 240 && (Input.pressed("a") || Input.click)) y = -9999; if (y < -lines.length * 10 - 20) { Save.data.flags.ending = true; Save.save(); Game.goto(Screens.mainMenu()); } },
      draw() {
        Assets.drawBG(12);
        G.dim(0.35);
        for (let i = 0; i < lines.length; i++) { const ly = Math.round(y + i * 10); if (ly > -8 && ly < 144) G.textC(80, ly, lines[i], i < 2 ? C.gold : C.white); }
        if (t > 240) G.text(96, 134, "A:skip", C.gray);
      },
    };
  };
})();
