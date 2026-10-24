// Campaign map (4 stages), duelist selection, and the duel launch / result / reward flow. Also FREE DUEL.
window.Screens = window.Screens || {};
(function () {
  const C = G.C;

  function slotRects(stage) {
    const st = Duelists.STAGES[stage];
    if (stage === 4) {
      const keys = st.keys.filter((k) => Save.duelistAvailable(k));
      return keys.map((k, i) => ({ key: k, x: 12 + (i % 3) * 48 + 6, y: 14 + Math.floor(i / 3) * 44, w: 34, h: 34 }));
    }
    const slots = Assets.json.map_slots[String(st.bg)] || [];
    return st.keys.map((k, i) => { const s = slots[st.slotOrder ? st.slotOrder[i] : i] || [10 + i * 30, 20, 34, 34]; return { key: k, x: s[0], y: s[1], w: s[2], h: s[3] }; });
  }

  Screens.campaign = function () {
    let stage = 1, sel = 0, msg = null;
    return {
      enter() { stage = Math.min(4, Save.maxStage()); sel = 0; this.music(); },
      resume() { const r = slotRects(stage); if (sel >= r.length) sel = 0; this.music(); },
      music() { Music.play(stage === 4 ? (slotRects(4).length > 1 ? "stage5" : "stage4") : "stage" + stage); },
      state() { return { stage, sel, keys: slotRects(stage).map((r) => r.key), msg: !!msg }; }, // for the automated runner
      update() {
        if (msg) { if (msg.update()) msg = null; return; }
        const rects = slotRects(stage);
        const maxStage = Save.maxStage();
        if (Input.pressed("right") || Input.pressed("down")) { sel = (sel + 1) % rects.length; Sfx.move(); }
        if (Input.pressed("left") || Input.pressed("up")) { sel = (sel - 1 + rects.length) % rects.length; Sfx.move(); }
        if (Input.pressed("select") || Input.hit(140, 132, 20, 12)) { if (stage < maxStage) { stage++; sel = 0; Sfx.ok(); this.music(); } else Sfx.error(); }
        if (Input.hit(0, 132, 20, 12)) { if (stage > 1) { stage--; sel = 0; Sfx.ok(); this.music(); } else Sfx.error(); }
        for (let i = 0; i < rects.length; i++) { const r = rects[i]; if (Input.over(r.x, r.y, r.w, r.h) && Input.hover.x !== this._hx) { sel = i; this._hx = Input.hover.x; } if (Input.hit(r.x, r.y, r.w, r.h)) { sel = i; this.pick(); return; } }
        if (Input.pressed("a")) this.pick();
        if (Input.pressed("b")) { Sfx.cancel(); Game.pop(); }
      },
      pick() {
        const rects = slotRects(stage); const r = rects[sel]; if (!r) return;
        if (!Save.legalDecks().length) { Sfx.error(); msg = new UI.MessageBox({ text: "You can't duel yet: " + Save.deckProblems()[0] + ". Fix your deck in the DECK menu.", y: 96, h: 46 }); return; }
        Sfx.ok();
        const d = Duelists.byKey[r.key];
        Screens.withDeck(() => {
          Music.play("campaign");
          Screens.duelistTalk(d, "intro", () => { Game.pop(); Screens.launchDuel(d, "campaign"); });
        });
      },
      draw() {
        const st = Duelists.STAGES[stage];
        Assets.drawBG(st.bg);
        const rects = slotRects(stage);
        for (let i = 0; i < rects.length; i++) {
          const r = rects[i]; const d = Duelists.byKey[r.key];
          if (stage === 4) { G.fill(r.x - 2, r.y - 2, r.w + 4, r.h + 4, "#e8c060"); G.fill(r.x - 1, r.y - 1, r.w + 2, r.h + 2, "#301008"); }
          Assets.drawFace(d.portrait, r.x + 1, r.y + 1);
          const w = Save.winsFor(r.key);
          if (w >= 5) { G.fill(r.x + 22, r.y + 22, 12, 12, "#000"); G.text(r.x + 24, r.y + 24, "\x8f", C.gold); }
          if (i === sel) { const bob = G.blink(12) ? 0 : 1; G.tri(r.x + 14, r.y - 7 + bob, "down", C.red); G.rect(r.x - 1, r.y - 1, r.w + 2, r.h + 2, G.blink(8) ? C.gold : C.white); }
        }
        // info bar
        const cur = rects[sel] ? Duelists.byKey[rects[sel].key] : null;
        G.box(0, 130, 160, 14, "dark");
        if (cur) { G.text(14, 133, cur.name.slice(0, 10), C.white); G.textR(146, 133, "W" + Save.winsFor(cur.key) + " L" + (Save.data.losses[cur.key] || 0), C.gold); }
        if (stage > 1) G.tri(4, 134, "left", C.white); if (stage < Save.maxStage()) G.tri(150, 134, "right", C.white);
        G.box(0, 0, 160, 10, "dark"); G.text(3, 1, st.name, C.white); G.textR(157, 1, "St." + stage, C.gold);
        if (msg) msg.draw();
      },
    };
  };

  // lets the player choose which of the three decks to duel with; goes straight on when only one is legal
  Screens.withDeck = function (go) {
    const legal = Save.legalDecks();
    if (legal.length <= 1) { go(); return; }
    Game.push(Screens.pickDeck(go));
  };
  Screens.pickDeck = function (onChosen) {
    let menu;
    const size = (i) => (i === Save.data.deckSlot ? Save.data.deck : Save.data.decks[i]).length;
    return {
      enter() {
        const legal = Save.legalDecks();
        menu = new UI.Menu([0, 1, 2].map((i) => ({ label: "Deck " + (i + 1) + (legal.includes(i) ? "  " + size(i) + " cards" : "  not ready"), value: i, disabled: !legal.includes(i) })), { x: 16, y: 50, w: 128, style: "menu" });
        menu.sel = Save.data.deckSlot;
      },
      update() {
        const r = menu.update();
        if (r === "cancel") { Game.pop(); return; }
        if (r === "ok") { Save.useDeck(menu.value); Game.pop(); onChosen(); }
      },
      draw() { G.dim(0.5); G.box(16, 36, 128, 14, "dark"); G.text(22, 39, "Duel with which deck?", C.white); menu.draw(); },
      overlay: true,
    };
  };

  // the lines a duelist says, with the portrait for each: a duo answers its partner's line with its own
  Screens.duelistTalk = function (d, kind, onDone, extra) {
    const lines = [pickLine(d, kind)], keys = [d.key];
    if (d.duo && d.duo[kind]) { lines.push(d.duo[kind][Math.floor(Math.random() * d.duo[kind].length)]); keys.push(d.duo.key); }
    for (const line of extra || []) { lines.push(line); keys.push(keys[keys.length - 1]); }
    Game.push(Screens.talk({ key: d.key, keys, lines, onDone }));
  };
  // A Free Duel challenger introduces themselves once: the first duel you finish after they unlock, they are waiting
  // for you. Win or lose, they then point you at FREE DUEL for a rematch.
  Screens.pendingChallenger = function () {
    if (!Save.data) return null;
    return Duelists.all.find((d) => d.free && Save.duelistAvailable(d.key) && !(Save.data.met || {})[d.key]) || null;
  };
  Screens.maybeChallenge = function () {
    const d = Screens.pendingChallenger(); if (!d) return false;
    Save.data.met[d.key] = true; Save.save();
    Music.play("campaign");
    Screens.duelistTalk(d, "intro", () => { Game.pop(); Screens.launchDuel(d, "challenge"); }, ["Hold on - you are not walking away from this one!"]);
    return true;
  };
  function pickLine(d, kind) {
    const arr = d[kind] || [""];
    if (kind === "intro" && Save.winsFor(d.key) > 0 && d.banter) return d.banter[Math.floor(Math.random() * d.banter.length)];
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // builds the duel and wires up the result flow
  Screens.launchDuel = function (d, mode) {
    const human = new DuelPlayer(Save.data.name, Save.data.deck, false, null);
    // rematches get harder: stronger deck, sharper play. The tournament is the top of that scale for everyone in it:
    // best deck, sharpest play, whoever they are (the bracket duels the player watches already ran that way)
    const cup = mode === "tournament";
    // From The Heavens on, everybody plays at full strength: their tournament deck, at the highest skill, whoever
    // they are and wherever they are met. Before that it is the faithful deck and the rematch ramp. (User, 2026-09-24.)
    const full = cup || Save.fullStrength();
    const wins = full ? 99 : Save.winsFor(d.key);
    const skill = full ? 4 : Duelists.skillFor(d, wins);
    const ai = new DuelPlayer(d.name, Duelists.deck(d, wins, { skill, max: full }), true, d);
    ai.skill = skill;
    const duel = new Duel(human, ai, {});
    const DUEL_MUSIC = { darknite: "darknite", yamiyugi: "yamiyugi", shadi: "shadi", marik: "marik", yamibakura: "yamibakura", nitemare: "nitemare" };
    Music.play(DUEL_MUSIC[d.key] || ("duel" + Math.min(3, d.stage)));
    Game.transition(() => {
      Game.push(Screens.duel({ duel, opponent: d, onFinish: (won, quit) => Screens.afterDuel(d, mode, won, quit, duel) }));
    });
  };

  Screens.afterDuel = function (d, mode, won, quit, duel) {
    if (mode === "tournament") Screens.tournamentResult = { key: d.key, won: won && !quit };
    if (quit) { Game.transition(() => { Game.pop(); }); return; }
    const firstWin = won && Save.winsFor(d.key) === 0;
    Save.recordDuel(d.key, won, mode);
    // the duel that opens The Heavens is worth saying out loud, once
    const swept = !Save.data.flags.cupDecks && Save.fullStrength();
    if (swept) { Save.data.flags.cupDecks = true; Save.save(); }
    Save.data.stats.fusions += duel.p[0].stats.fusions;
    let rewardParams = null, earnParams = null;
    if (won && (mode === "campaign" || mode === "free" || mode === "tournament" || mode === "challenge")) {
      const pool = Duelists.drops(d);
      const cardId = pool[Math.floor(Math.random() * pool.length)];
      Save.addCard(cardId, 1);
      let grandpaCard = null;
      if (Save.data.flags.grandpa) { const gp = Duelists.grandpaDrops(); grandpaCard = gp[Math.floor(Math.random() * gp.length)]; Save.addCard(grandpaCard, 1); }
      // What the duel itself was worth: beating the duelist is the first line, the rest is how it was won.
      // A flawless duel - not one Life Point lost - multiplies the whole bill and opens a card pack.
      const flawless = !duel.p[0].stats.tookDamage;
      const earn = Bonus.forDuel(duel, { payout: Shop.payout(d), newSummons: duel.newSummons || 0, flawless });
      Save.data.domino += earn.total;
      // a big night's earnings also shakes extra cards loose, one per Bonus.CARD_STEP
      const bonusCards = [];
      for (let i = 0; i < earn.cards; i++) { const id = pool[Math.floor(Math.random() * pool.length)]; bonusCards.push(id); Save.addCard(id, 1); }
      const pack = flawless || Math.random() < Shop.PACK_CHANCE ? Shop.rollPack() : null;
      if (pack) for (const id of pack) Save.addCard(id, 1);
      Save.data.stats.flawless = (Save.data.stats.flawless || 0) + (flawless ? 1 : 0);
      Save.save();
      rewardParams = { key: d.key, cardId, grandpaCard, bonusCards, flawless, pack };
      earnParams = Object.assign({ key: d.key }, earn);
    }
    Game.transition(() => {
      Game.pop(); // duel screen
      const finish = () => {
        if (won && d.key === "darknite" && firstWin) { Game.transition(() => { Game.pop(); Game.push(Screens.ending()); }); return; }
        // back to the map or the menu - and then the next challenger who has been waiting for a word
        Game.transition(() => { Game.pop(); if (mode !== "tournament" && mode !== "challenge") Screens.maybeChallenge(); }); // one introduction per duel
      };
      // every duelist has now been beaten once: tell the player what that changes, then carry on
      const done = swept ? () => {
        Game.transition(() => {
          Game.pop();
          Game.push(Screens.talk({ key: d.key, onDone: finish, lines: [
            "Ancient Egypt is behind you. The Heavens are open.",
            "And word has gone ahead of you. From here on every duelist you meet brings the deck they take to the tournament, and plays it at their sharpest.",
            "Nobody on this map is holding back any more.",
          ] }));
        });
      } : finish;
      const extra = mode === "challenge" ? ["Come and find me in FREE DUEL whenever you want another go."] : null;
      Screens.duelistTalk(d, won ? "win" : "lose", () => {
        if (rewardParams) {
          const toReward = () => { Game.transition(() => { Game.pop(); Game.push(Screens.reward(Object.assign({ onDone: done }, rewardParams))); }); };
          Game.transition(() => { Game.pop(); Game.push(Screens.earnings(Object.assign({ onDone: toReward }, earnParams))); });
        } else done();
      }, extra);
    });
  };

  // TOURNAMENT: an 8-seat single-elimination cup (you and 7 duelists from the unlocked areas), open once Ancient
  // Egypt is reached and once every 10 duels. Every match is played out on screen - the others as spectator duels -
  // and every duelist fights at full strength (skill 4, its most upgraded deck). Losing knocks you out.
  Screens.CUP = { fee: 1000, roundPay: [0, 500, 1000], champion: 10000, cooldown: 10, minStage: 3 };
  Screens.cupStatus = function () { // null when playable, otherwise the reason it is not
    if (Save.maxStage() < Screens.CUP.minStage) return "Reach Ancient Egypt first";
    const at = Save.data.cupAt; if (at === undefined || at === null) return null;
    const left = Screens.CUP.cooldown - (Save.data.stats.duels - at);
    return left > 0 ? "Next tournament in " + left + " duel" + (left === 1 ? "" : "s") : null;
  };
  // a duel between two computer players, watched by the player
  Screens.launchSpectate = function (dA, dB, onDone) {
    const a = new DuelPlayer(dA.name, Duelists.deck(dA, 99, { skill: 4, max: true }), true, dA); a.skill = 4;
    const b = new DuelPlayer(dB.name, Duelists.deck(dB, 99, { skill: 4, max: true }), true, dB); b.skill = 4;
    const duel = new Duel(a, b, {});
    Music.play("duel3");
    Game.transition(() => {
      Game.push(Screens.duel({ duel, opponent: dB, spectate: true, onFinish: (aWon) => { Game.transition(() => { Game.pop(); onDone(aWon ? 0 : 1); }); } }));
    });
  };
  Screens.tournament = function () {
    const pool = Duelists.all.filter((d) => Save.duelistAvailable(d.key)).sort(() => Math.random() - 0.5).slice(0, 7);
    const seats = [{ player: true }].concat(pool.map((d) => ({ d }))).sort(() => Math.random() - 0.5);
    const rounds = [seats.slice()];      // rounds[r] = entrants of round r (8, 4, 2); rounds[3] = [champion]
    let round = 0, match = 0, msg = null, state = "ready", flash = 0, pendingPlayer = null; // ready | out | done
    const winners = [];                  // winners of the current round, in bracket order
    const pairAt = (i) => [rounds[round][2 * i], rounds[round][2 * i + 1]];
    const matchesInRound = () => rounds[round].length / 2;
    function finishRound() {
      rounds.push(winners.slice()); winners.length = 0; round++; match = 0;
      if (!rounds[round].some((e) => e.player)) { state = "out"; msg = new UI.MessageBox({ text: "You are out of the tournament.", y: 96, h: 40 }); return; }
      if (round === 3) { state = "done"; prize(); return; }
      const pay = Screens.CUP.roundPay[round]; if (pay) { Save.data.domino += pay; Save.save(); }
      msg = new UI.MessageBox({ text: "On to the " + (round === 1 ? "semi-finals" : "final") + (pay ? "! You pocket " + pay + " Domino." : "!"), y: 96, h: 40 });
    }
    function recordWinner(e) { winners.push(e); match++; if (match >= matchesInRound()) finishRound(); }
    function prize() {
      const pay = Screens.CUP.champion; Save.data.domino += pay;
      const pick = (tier) => { const c = CardDB.all.filter((x) => Shop.rarity(x.id) === tier && Banlist.limit(x.id) > 0 && x.kind !== "R"); return c[Math.floor(Math.random() * c.length)].id; };
      const ultra = pick(4), superRare = pick(3); Save.addCard(ultra, 1); Save.addCard(superRare, 1);
      const pack = Shop.rollPack(); for (const id of pack) Save.addCard(id, 1);
      Save.save();
      const last = rounds[round - 1].find((e) => !e.player) || pool[0];
      Game.push(Screens.reward({ key: last.d.key, cardId: ultra, grandpaCard: superRare, domino: pay, pack, champion: true, onDone: () => { Game.transition(() => { Game.pop(); Game.pop(); }); } }));
    }
    return {
      enter() { Music.play("versus"); Save.data.cupAt = Save.data.stats.duels; Save.save(); },
      resume() {
        // back from the player's own match (the screen also resumes when the pre-duel talk closes: no result yet then)
        if (pendingPlayer && Screens.tournamentResult) {
          const [a, b] = pendingPlayer; pendingPlayer = null;
          const r = Screens.tournamentResult; Screens.tournamentResult = null;
          recordWinner(r.won ? (a.player ? a : b) : (a.player ? b : a));
        }
      },
      update() {
        flash++;
        if (msg) { if (msg.update()) msg = null; return; }
        if (state !== "ready") { if (Input.pressed("a") || Input.pressed("b") || Input.click) Game.pop(); return; }
        if (Input.pressed("b")) { Sfx.cancel(); msg = null; Game.pop(); return; }
        if (Input.pressed("a") || Input.click) {
          const [a, b] = pairAt(match); Sfx.ok();
          if (a.player || b.player) {
            const d = Duelists.byKey[(a.player ? b : a).d.key]; pendingPlayer = [a, b]; Screens.tournamentResult = null;
            Music.play("campaign");
            Screens.duelistTalk(d, "intro", () => { Game.pop(); Screens.launchDuel(d, "tournament"); });
          } else {
            Screens.launchSpectate(Duelists.byKey[a.d.key], Duelists.byKey[b.d.key], (w) => recordWinner(w === 0 ? a : b));
          }
        }
      },
      draw() {
        Assets.drawBG(0); G.dim(0.55);
        G.box(0, 0, 160, 12, "dark"); G.text(3, 2, "TOURNAMENT", C.gold); G.textR(157, 2, ["Round 1", "Semi", "Final", "Champion"][round], C.white);
        const name = (e) => e.player ? Save.data.name.slice(0, 6) : e.d.name.slice(0, 6);
        const colX = [2, 56, 110];
        const cur = state === "ready" ? pairAt(match) : [];
        for (let r = 0; r < 3 && rounds[r]; r++) {
          const ents = rounds[r], gap = 14 * (1 << r), y0 = 16 + (gap - 14) / 2;
          ents.forEach((e, i) => {
            const y = y0 + i * gap;
            const out = (r < round && !rounds[r + 1].includes(e)) || (r === round && i < 2 * match && !winners.includes(e));
            const isNext = r === round && cur.includes(e);
            const col = e.player ? C.gold : isNext ? (flash % 30 < 20 ? C.red : C.white) : out ? C.gray : C.white;
            G.text(colX[r], y, name(e), col);
            if (r < 2 && !(i & 1)) G.fill(colX[r] + 50, y + 3, 4, gap + 1, C.gray);
          });
        }
        if (rounds[3]) G.text(110, 4 + 14 * 4 - 8 + 18, name(rounds[3][0]), C.gold);
        G.box(0, 130, 160, 14, "dark");
        if (state === "ready") { const [a, b] = cur; const mine = a.player || b.player; G.text(4, 133, mine ? "Your match: " + (a.player ? b : a).d.name.slice(0, 7) : name(a) + " vs " + name(b), C.white); G.textR(156, 133, "A", C.gray); }
        else G.textC(80, 133, state === "out" ? "Eliminated. A: leave" : "Champion!", state === "out" ? C.red : C.gold);
        if (msg) msg.draw();
      },
      state() { const nm = (e) => e.player ? "YOU" : e.d.key; return { round, match, state, rounds: rounds.map((r) => r.map(nm)), winners: winners.map(nm), pending: !!pendingPlayer }; },
    };
  };

  // FREE DUEL: choose any duelist you have already beaten (or any in an unlocked area)
  Screens.freeDuel = function () {
    let list, msg = null;
    return {
      enter() {
        Music.play("versus");
        const items = Duelists.all.filter((d) => Save.duelistAvailable(d.key)).map((d) => ({ label: d.name, d }));
        if (Save.maxStage() >= Screens.CUP.minStage) items.unshift({ label: "TOURNAMENT", cup: true });
        list = new UI.ListView({ x: 8, y: 20, w: 144, h: 100, rows: 11, items, render: (it, x, y, s) => {
          if (it.cup) { const why = Screens.cupStatus(); G.text(x, y, it.label, why ? C.gray : C.gold); G.textR(x + 130, y, why ? "wait" : String(Screens.CUP.fee) + "D", C.darkgray); return; }
          G.text(x, y, it.label, C.black); G.textR(x + 130, y, "W" + Save.winsFor(it.d.key), C.darkgray);
        } });
      },
      update() {
        if (msg) { if (msg.update()) msg = null; return; }
        const r = list.update();
        if (r === "cancel") { Game.pop(); return; }
        if (r === "ok") {
          if (!Save.legalDecks().length) { Sfx.error(); msg = new UI.MessageBox({ text: "Fix your deck first: " + Save.deckProblems()[0], y: 96, h: 46 }); return; }
          if (list.item.cup) {
            const why = Screens.cupStatus(); if (why) { Sfx.error(); msg = new UI.MessageBox({ text: why + ".", y: 96, h: 46 }); return; }
            if (Save.data.domino < Screens.CUP.fee) { Sfx.error(); msg = new UI.MessageBox({ text: "The entry fee is " + Screens.CUP.fee + " Domino. Come back richer!", y: 96, h: 46 }); return; }
            Screens.withDeck(() => { Save.data.domino -= Screens.CUP.fee; Save.save(); Sfx.ok(); Game.push(Screens.tournament()); });
            return;
          }
          const d = list.item.d;
          Screens.withDeck(() => {
            Music.play("campaign");
            Screens.duelistTalk(d, "intro", () => { Game.pop(); Screens.launchDuel(d, "free"); });
          });
        }
      },
      draw() { Assets.drawBG(0); G.box(0, 0, 160, 14, "dark"); G.text(4, 3, "FREE DUEL", C.gold); list.draw(); G.text(8, 126, "B: back", C.white); G.textR(152, 126, "win = card", C.gray); if (msg) msg.draw(); },
      state() { return { sel: list.sel, cup: !!(list.item && list.item.cup), key: list.item && list.item.d ? list.item.d.key : null, msg: !!msg }; }, // for the automated runner
    };
  };
})();
