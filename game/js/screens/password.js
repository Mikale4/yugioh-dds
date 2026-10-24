// PASSWORD: enter the 8-digit code printed on real cards (each code works once) plus the special codes.
window.Screens = window.Screens || {};
(function () {
  const C = G.C;
  const SPECIAL = {
    "65437205": { text: "Yugi's Grandpa: 'From now on I'll give you a card every time you win!'", flag: "grandpa", key: "grandpa" },
    "70715281": { text: "Yami Yugi appears in the Heavens!", flag: "pw_yamiyugi", key: "yamiyugi" },
    "07119986": { text: "Yami Bakura appears in the Heavens!", flag: "pw_yamibakura", key: "yamibakura" },
    "43504084": { text: "Nitemare appears in the Heavens!", flag: "pw_nitemare", key: "nitemare" },
    "70592699": { text: "Shadi appears in the Heavens!", flag: "pw_shadi", key: "shadi" },
    "06987398": { text: "Marik appears in the Heavens!", flag: "pw_marik", key: "marik" },
    "42382443": { text: "...", ending: true },
  };
  Screens.password = function () {
    let digits = [0, 0, 0, 0, 0, 0, 0, 0], pos = 0, msg = null, shown = null, showKey = null, endingNext = false;
    return {
      enter() { Music.play("password"); window.addEventListener("keydown", this.onKey); },
      exit() { window.removeEventListener("keydown", this.onKey); },
      onKey(e) { if (/^[0-9]$/.test(e.key)) { digits[pos] = parseInt(e.key); pos = Math.min(7, pos + 1); } },
      update() {
        if (msg) { if (msg.update()) { msg = null; shown = null; showKey = null; if (endingNext) { endingNext = false; Game.push(Screens.ending()); } } return; }
        if (Input.pressed("left")) { pos = (pos + 7) % 8; Sfx.move(); }
        if (Input.pressed("right")) { pos = (pos + 1) % 8; Sfx.move(); }
        if (Input.pressed("up")) { digits[pos] = (digits[pos] + 1) % 10; Sfx.move(); }
        if (Input.pressed("down")) { digits[pos] = (digits[pos] + 9) % 10; Sfx.move(); }
        for (let i = 0; i < 8; i++) { if (Input.hit(16 + i * 16, 40, 16, 12)) { pos = i; digits[i] = (digits[i] + 1) % 10; Sfx.move(); } if (Input.hit(16 + i * 16, 68, 16, 12)) { pos = i; digits[i] = (digits[i] + 9) % 10; Sfx.move(); } }
        if (Input.pressed("a") || Input.hit(40, 96, 80, 14)) this.submit();
        if (Input.pressed("b")) { Sfx.cancel(); Game.pop(); }
      },
      submit() {
        const code = digits.join("");
        const d = Save.data; pos = 0;
        if (SPECIAL[code]) {
          const sp = SPECIAL[code];
          if (sp.ending) { if (Save.winsFor("darknite") > 0) { endingNext = true; msg = new UI.MessageBox({ text: "The credits roll once more...", y: 96, h: 40 }); } else { Sfx.error(); msg = new UI.MessageBox({ text: "Nothing happened...", y: 96, h: 40 }); } return; }
          if (sp.key !== "grandpa" && !Save.data.flags.ending && Save.winsFor("darknite") === 0) { Sfx.error(); msg = new UI.MessageBox({ text: "Nothing happened... (beat the game first)", y: 96, h: 40 }); return; }
          if (d.flags[sp.flag]) { Sfx.error(); msg = new UI.MessageBox({ text: "That code is already active.", y: 96, h: 40 }); return; }
          d.flags[sp.flag] = true; Save.save(); Sfx.reward(); showKey = sp.key;
          msg = new UI.MessageBox({ text: sp.text, y: 96, h: 46 }); return;
        }
        let c = CardDB.byCode(code);
        if (!c) { Sfx.error(); msg = new UI.MessageBox({ text: "That password is not valid.", y: 96, h: 40 }); return; }
        if (d.codesUsed.includes(code)) { Sfx.error(); msg = new UI.MessageBox({ text: "You already used that password.", y: 96, h: 40 }); return; }
        let note = "";
        if (Banlist.ritualOnly(c.id) && Effects.ritualSpellFor[c.id]) { note = " (" + c.name + " is summoned by it)"; c = CardDB.get(Effects.ritualSpellFor[c.id]); }
        d.codesUsed.push(code); Save.addCard(c.id, 1); Save.save(); Sfx.reward(); shown = c.id;
        msg = new UI.MessageBox({ text: "You got " + c.name + "!" + note, y: 96, h: 46 });
      },
      draw() {
        Assets.drawBG(2);
        if (showKey) { Screens.drawScene(showKey); }
        else {
          G.box(4, 4, 152, 26, "talk"); G.text(8, 8, "Enter the 8-digit", C.white); G.text(8, 17, "password of a card.", C.white);
          G.box(8, 36, 144, 48, "list");
          for (let i = 0; i < 8; i++) {
            const x = 16 + i * 16;
            G.tri(x + 4, 42, "up", i === pos ? C.red : C.gray);
            if (i === pos) G.fill(x + 1, 54, 14, 12, "#c8e8ff");
            G.text(x + 4, 56, String(digits[i]), C.black);
            G.tri(x + 4, 70, "down", i === pos ? C.red : C.gray);
          }
          G.box(40, 96, 80, 14, "menu"); G.textC(80, 99, "A: ENTER", C.white);
          G.text(8, 116, "Used: " + Save.data.codesUsed.length + "  B: back", C.white);
        }
        if (shown) { G.box(88, 2, 70, 86, "card"); Assets.drawCard(shown, 91, 5); }
        if (msg) msg.draw();
      },
    };
  };
})();
