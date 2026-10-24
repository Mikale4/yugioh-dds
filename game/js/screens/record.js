// RECORD: duelist profile and campaign progress.
window.Screens = window.Screens || {};
(function () {
  const C = G.C;
  Screens.record = function () {
    let page = 0;
    return {
      enter() { Music.play("records"); },
      update() {
        if (Input.pressed("left") || Input.hit(0, 0, 80, 144)) { page = (page + 5) % 6; Sfx.move(); }
        if (Input.pressed("right") || Input.hit(80, 0, 80, 144)) { page = (page + 1) % 6; Sfx.move(); }
        if (Input.pressed("b") || Input.pressed("a")) { Sfx.cancel(); Game.pop(); }
      },
      draw() {
        Assets.drawBG(3); G.dim(0.35);
        const d = Save.data;
        G.box(4, 4, 152, 136, "talk");
        if (page === 0) {
          G.text(10, 10, "DUELIST RECORD", C.gold);
          const rows = [["Name", d.name], ["Deck", d.deck.length + " cards"], ["Cards owned", Object.values(d.chest).reduce((a, b) => a + b, 0)], ["Collection", Save.chestList().length + ":" + Save.collectTotal()], ["Summon list", Save.summonCount() + ":" + Save.summonTotal()], ["Duels", d.stats.duels], ["Wins", d.stats.wins], ["Losses", d.stats.losses], ["Fusions", d.stats.fusions], ["Flawless", d.stats.flawless || 0], ["Domino", d.domino || 0], ["Stage", Save.maxStage()], ["Starter", (window.Starters && Starters.THEMES.find((t) => t.key === d.starter) || { name: "Classic" }).name]];
          rows.forEach((r, i) => { G.text(10, 22 + i * 9, r[0], C.white); G.textR(150, 22 + i * 9, String(r[1]), C.gold); });
        } else {
          // pages 1-4 are the campaign areas, page 5 the Free Duel challengers
          const free = page === 5;
          const list = free ? Duelists.all.filter((x) => x.free).map((x) => x.key) : Duelists.STAGES[page].keys;
          G.text(10, 10, free ? "CHALLENGERS" : Duelists.STAGES[page].name.toUpperCase(), C.gold);
          let y = 22;
          for (const k of list) {
            const du = Duelists.byKey[k];
            const avail = Save.duelistAvailable(k);
            G.text(10, y, avail ? du.name.slice(0, 11) : "???", avail ? C.white : C.gray);
            G.textR(150, y, avail ? "W" + Save.winsFor(k) + " L" + (d.losses[k] || 0) : free ? "stage " + du.stage : "", avail && Save.winsFor(k) >= 5 ? C.gold : C.white);
            y += 10;
          }
          if (page === 4) { G.text(10, 100, "Hidden duelists:", C.gray); G.text(10, 109, "password, or beat", C.gray); G.text(10, 118, "Yami Yugi 5 times.", C.gray); }
          if (free) { G.text(10, 118, "Free Duel only.", C.gray); }
        }
        G.text(10, 128, "L,R:pages B:back", C.gray);
      },
    };
  };
})();
