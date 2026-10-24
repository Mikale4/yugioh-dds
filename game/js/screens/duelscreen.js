// The duel screen: field view, hand view, action menus, event narration and the AI turn driver.
window.Screens = window.Screens || {};
(function () {
  const C = G.C;
  const ZX = 78, ZP = 16; // zone x origin and pitch
  const ROW_Y = { oppSpell: 0, oppMon: 15, myMon: 114, mySpell: 129 }; // monsters nearest the middle, spells/traps outside
  const CARD_X = 88, CARD_Y = 30;

  function el(c) { return c && c.kind === "M" ? c.el : ""; }
  function short(name, n) { return name.length > n ? name.slice(0, n) : name; }

  Screens.duel = function (params) {
    const duel = params.duel, opp = params.opponent, spectate = !!params.spectate; // spectate: two computer players (tournament)
    const me = duel.p[0], ai = duel.p[1];
    // ---- UI state
    let mode = "field";          // field | hand | menu | target | tribute | info | play | reveal | end | quit
    let row = 2, col = 0;        // field cursor in visual order: rows 0 oppSpell,1 oppMon,2 myMon,3 mySpell,4 buttons
    let handSel = 0, handTop = 0, menu = null, menuCtx = null, infoId = null, infoMon = null, infoBack = "field"; // the hand list scrolls
    // 5 rows normally; while the player has to discard down to 5, a notice takes the top of the box and 4 rows remain
    const discarding = () => duel.turn === 0 && duel.mustDiscard(me);
    const handRows = () => discarding() ? 4 : 5;
    const handRowY = (i) => 31 + (discarding() ? 10 : 0) + (i - handTop) * 16;
    function showHandRow(i) { const R = handRows(); if (i < handTop) handTop = i; if (i >= handTop + R) handTop = i - R + 1; handTop = Math.max(0, Math.min(handTop, Math.max(0, me.hand.length - R))); }
    let target = { kind: "", idx: 0, list: [] };
    let tribute = { need: 0, chosen: [], handIdx: -1, pos: "atk" };
    let queue = [], cur = null, curT = 0, battle = null, lpShow = [8000, 8000], flash = null, shake = 0;
    let aiTurn = false, aiWait = 0, endInfo = null, revealHand = null, revealPick = false, pickSel = 0, msgLine = "", msgT = 0, quitMenu = null;
    let auto = false, autoWait = 0;   // AUTO: the computer plays your turns until you switch it off
    let selectedId = null, selectedMon = null;
    let viewMode = "field"; // 'field' or 'battle'

    // ------------------------------------------------------------ event narration
    function name(id) { const c = CardDB.get(id); return c ? c.name : "?"; }
    function pn(p) { return p === 0 ? (spectate ? short(me.name, 9) : "You") : short(opp.name, 9); }
    function pushStep(text, dur, extra) {
      // only two lines of narration are drawn: a longer text is reported to the runner
      if (window.Runner && G.wrap(text, 18).length > 2 && !Runner.overflows.has("narration:" + text)) Runner.overflows.set("narration:" + text, { screen: "duel narration", text, x: 0, y: 0 });
      queue.push(Object.assign({ text, dur: dur || 40 }, extra || {}));
    }
    function drain() {
      for (const e of duel.events) narrate(e);
      duel.events.length = 0;
    }
    // the first time the player brings out a monster that cannot be owned, it goes on the summon list
    function tick(id) {
      if (spectate || !Save.data) return;
      if (!Save.recordSummon(id)) return;
      duel.newSummons = (duel.newSummons || 0) + 1;      // worth Domino on the earnings screen afterwards
      pushStep("First summon!\n" + short(CardDB.get(id).name, 18), 55, { sfx: "reward" });
    }
    function narrate(e) {
      const who = pn(e.player);
      switch (e.type) {
        case "turn": pushStep(e.player === 0 && !spectate ? "Your turn." : (e.player === 0 ? me.name : opp.name) + "'s turn.", 35, { sfx: "draw" }); break;
        case "draw": if (e.player === 1) pushStep(who + " draws a card.", 20); break;
        case "drawn": if (e.player === 1) pushStep(who + " draws " + e.n + (e.n === 1 ? " card." : " cards."), 25); break;
        case "summon": {
          const c = CardDB.get(e.id);
          if (e.pos === "def" && !e.special) pushStep(who + (e.player === 0 && !spectate ? " set a monster." : " sets a monster."), 45, { sfx: "summon", flash: [e.player, "mon", e.slot] });
          else if (e.special) pushStep(short(c.name, 12) + " appears!", 45, { sfx: "summon", flash: [e.player, "mon", e.slot], showCard: e.id });
          else pushStep(who + (e.player === 0 && !spectate ? " summon " : " summons ") + short(c.name, 12) + "!", 45, { sfx: "summon", flash: [e.player, "mon", e.slot], showCard: e.id });
          if (e.player === 0) tick(e.id);
          break;
        }
        case "fuse":
          pushStep("Fusion: " + short(name(e.a), 10) + "\n& " + short(name(e.b), 16), 55, { sfx: "fuse" });
          pushStep(short(name(e.result), 18) + (e.slot >= 0 ? "\njoins the field!" : "\njoins the hand!"), 55, e.slot >= 0 ? { showCard: e.result, flash: [e.player, "mon", e.slot] } : { showCard: e.result });
          if (e.player === 0) tick(e.result);
          break;
        case "fusefail": pushStep("No fusion. No more fusing this turn.", 60, { sfx: "error" }); break;
        case "set": pushStep(who + (e.player === 0 ? " set a card." : " sets a card face down."), 35, { sfx: "ok", flash: [e.player, "spell", e.slot] }); break;
        case "magic": {
          const c = CardDB.get(e.id);
          if (e.fail) pushStep(short(c.name, 14) + " has no effect!", 60, { sfx: "error", showCard: e.id });
          else pushStep(who + " used " + short(c.name, 16) + "!", 55, { sfx: "magic", showCard: e.id });
          break;
        }
        case "ritual": pushStep(who + " performs " + short(name(e.id), 14) + "!", 55, { sfx: "magic", showCard: e.id }); pushStep(name(e.result) + " appears!", 55, { flash: [e.player, "mon", e.slot], showCard: e.result, sfx: "fuse" }); if (e.player === 0) tick(e.result); break;
        case "trap": pushStep("Trap card! " + name(e.id) + "!", 60, { sfx: "trap", showCard: e.id }); break;
        case "powerup": pushStep(short(name(e.id), 12) + (e.doubled ? " doubles its ATK!" : " powers up!"), 40, { sfx: "heal", flash: [e.player, "mon", e.slot] }); break;
        case "coin":
          if (e.id === 743) pushStep(e.heads ? "Heads! Barrel Dragon fires!" : "Tails... the barrel jams.", 55, { sfx: e.heads ? "magic" : "error" });
          else if (e.id === 429) pushStep(e.heads ? "Heads! Its ATK doubles!" : "Tails... its ATK is halved.", 55, { sfx: e.heads ? "magic" : "error" });
          else pushStep(e.heads ? "Heads! Time is on " + (e.player === 0 && !spectate ? "your" : pn(e.player) + "'s") + " side!" : "Tails... time runs out!", 55, { sfx: e.heads ? "magic" : "error" });
          break;
        case "search": pushStep(short(name(e.id), 12) + " comes to " + (e.player === 0 && !spectate ? "your" : "the") + " hand.", 45, { sfx: "draw", showCard: e.id }); break;
        case "bounce": pushStep(short(name(e.id), 12) + " returns to hand.", 45, { sfx: "cancel", flash: [e.player, "mon", e.slot] }); break;
        case "breakset": pushStep(short(name(e.id), 14) + " is destroyed!", 40, { sfx: "destroy", flash: [e.player, "spell", e.slot], showCard: e.id }); break;
        case "shield": pushStep(e.fromHand ? "Hand Kuriboh blocks " + e.amount + "!" : "Kuriboh blocks " + e.amount + " damage!", 55, { sfx: "trap", showCard: 58 }); break;
        case "negate": pushStep("Gate Guardian shrugs it off!", 55, { sfx: "trap", showCard: e.id }); break;
        case "mill": pushStep(e.n + " cards fall off " + (e.player === 0 && !spectate ? "your" : pn(e.player) + "'s") + " deck!", 50, { sfx: "destroy" }); break;
        case "morph": pushStep("Morphing Jar: both hands redrawn!", 60, { sfx: "magic" }); break;
        case "turnend": pushStep("Unhappy Maiden ends the turn!", 60, { sfx: "trap" }); break;
        case "infest": pushStep("Parasite hides in " + (e.player === 0 && !spectate ? "your" : pn(e.player) + "'s") + " deck!", 55, { sfx: "error" }); break;
        case "shieldwall": pushStep("Millennium Shield stops the attack!", 55, { sfx: "trap", flash: [e.player, "mon", e.slot], showCard: 362 }); break;
        // a freezer went down fighting: whoever cut it down loses their next attack phase
        case "noattack": pushStep((e.id ? short(name(e.id), 11) + " falls:\n" : "") + short(e.player === 0 && !spectate ? "You" : pn(e.player), 6) + " cannot attack", 60, { sfx: "trap", showCard: e.id || undefined }); break;
        case "mimic": pushStep(short(name(e.id), 12) + " copies " + short(name(e.target), 9) + "!", 50, { sfx: "magic", flash: [e.player, "mon", e.slot] }); break;
        case "powerdown": pushStep(short(name(e.id), 12) + " powers down!", 50, { sfx: "error" }); break;
        case "field": pushStep("The field becomes " + (e.id ? CardDB.fieldInfo(e.id).name : "Arena") + ".", 45, { sfx: "magic" }); break;
        case "pos": if (e.player === 1) pushStep(who + " changes a position.", 30); break;
        case "special": pushStep((e.player === 0 && !spectate ? "Your SPCL:" : who + "'s SPCL:") + "\n" + short(name(e.id), 18), 50, { sfx: "magic", showCard: e.id, flash: [e.player, "mon", e.slot] }); break;
        case "evolve": pushStep(name(e.id) + " appears!", 50, { sfx: "fuse", flash: [e.player, "mon", e.slot], showCard: e.id }); break;
        case "steal": pushStep(who + (e.temp ? " controls " : " takes ") + short(name(e.id), 14) + "!", 55, { sfx: "magic", flash: [e.player, "mon", e.slot] }); break;
        case "return": pushStep(short(name(e.id), 14) + " returns.", 35); break;
        case "sleep": pushStep("Enemy monsters fall asleep!", 45, { sfx: "magic" }); break;
        case "duster": pushStep(e.fake ? "Fake Trap takes the hit!" : "Set cards are blown away!", 45, { sfx: "destroy" }); break;
        case "retrieve": pushStep(short(name(e.id), 14) + " returns to hand.", 40, { sfx: "draw" }); break;
        case "reveal": if (e.player === 0 && !spectate) pushStep(e.pick ? "Pick a card they must throw away!" : "Enemy hand revealed!", 30, { reveal: e.hand, pick: !!e.pick }); else pushStep(who + " peeks at " + (e.player === 1 && !spectate ? "your" : pn(1 - e.player) + "'s") + " hand!", 40); break;
        case "attack": {
          const a = CardDB.get(e.id);
          if (e.direct) { pushStep(short(a.name, 12) + " attacks directly!", 45, { sfx: "attack", battle: { a: e.id, d: null, aAtk: duel.atk(duel.p[e.player].mon[e.slot] || { card: a, levels: 0, temp: 0, ty: a.ty, el: a.el, owner: e.player }), player: e.player } }); break; }
          const b = { a: e.id, d: e.target, aAtk: e.aAtk, dAtk: e.dAtk, dDef: e.dDef, dPos: e.dPos, player: e.player };
          pushStep(short(a.name, 18) + "\nattacks " + short(name(e.target), 9) + "!", 50, { sfx: "attack", battle: b });
          if (e.result === "win") pushStep(short(name(e.target), 14) + " is destroyed!", 45, { battle: b, sfx: "hit" });
          else if (e.result === "lose") pushStep(short(a.name, 14) + " is destroyed!", 45, { battle: b, sfx: "hit" });
          else if (e.result === "tie") pushStep("Both monsters are destroyed!", 45, { battle: b, sfx: "hit" });
          else if (e.result === "bounce") pushStep("The defence holds!", 45, { battle: b, sfx: "hit" });
          break;
        }
        case "destroy": if (e.why === "offer") pushStep(short(name(e.id), 14) + " is offered.", 30, { sfx: "destroy" }); else if (e.why === "shield") break; else if (!["element", "battle"].includes(e.why)) pushStep(short(name(e.id), 14) + (e.why === "absorb" ? " is absorbed!" : e.why === "retaliate" ? " is taken down too!" : " is destroyed!"), 35, { sfx: "destroy", flash: [e.player, "mon", e.slot] }); break;
        case "damage": pushStep(e.why === "cost" ? pn(e.player) + (e.player === 0 && !spectate ? " pay " : " pays ") + e.amount + " LP!" : e.why === "bounder" ? "Reflect Bounder hits back: " + e.amount + "!" : pn(e.player) + (e.player === 0 && !spectate ? " take " : " takes ") + e.amount + " damage!", 45, { sfx: "damage", lp: e.player, shake: true }); break;
        case "heal": pushStep(pn(e.player) + (e.player === 0 ? " recover " : " recovers ") + e.amount + " LP!", 40, { sfx: "heal", lp: e.player }); break;
        case "exodia": pushStep("EXODIA OBLITERATE!", 90, { sfx: "win" }); break;
        case "deckout": pushStep(pn(e.player) + " can't draw a card!", 60, { sfx: "error" }); break;
        case "end": pushStep(spectate ? pn(e.winner) + " wins!" : (e.winner === 0 ? "You win!" : "You lose..."), 90, { sfx: e.winner === 0 || spectate ? "win" : "lose", end: e }); break;
        case "discard": pushStep(e.offer ? short(name(e.id), 14) + " is offered." : who + (e.player === 0 ? " discard " : " discards ") + short(name(e.id), 14) + ".", 35, { sfx: e.offer ? "destroy" : "cancel" }); break;
        case "msg": pushStep(e.text, 40); break;
      }
    }
    function startStep() {
      cur = queue.shift(); curT = 0;
      if (!cur) { viewMode = "field"; battle = null; return; }
      if (cur.sfx && Sfx[cur.sfx]) Sfx[cur.sfx]();
      if (cur.flash) flash = { p: cur.flash[0], kind: cur.flash[1], slot: cur.flash[2], t: 20 };
      if (cur.shake) shake = 10;
      if (cur.battle) { battle = cur.battle; viewMode = "battle"; } else { battle = null; viewMode = "field"; }
      if (cur.showCard) {
        // a card the narration is pointing at: when it is a monster on the field, show what it is hitting for now
        selectedId = cur.showCard; selectedMon = null;
        const f = cur.flash;
        if (f && f[1] === "mon") { const fm = duel.p[f[0]].mon[f[2]]; if (fm && fm.id === cur.showCard) selectedMon = fm; }
      }
      if (cur.reveal) { revealHand = cur.reveal; revealPick = !!cur.pick; pickSel = 0; }
      if (cur.end) endInfo = cur.end;
    }
    function playing() { return cur !== null || queue.length > 0; }
    function beginPlayback() { drain(); if (!cur && queue.length) startStep(); }

    // ------------------------------------------------------------ selection helpers
    function fieldSlot() { // returns {player, kind, slot}
      if (row === 0) return { p: 1, kind: "spell", slot: col };
      if (row === 1) return { p: 1, kind: "mon", slot: col };
      if (row === 2) return { p: 0, kind: "mon", slot: col };
      if (row === 3) return { p: 0, kind: "spell", slot: col };
      return { p: -1, kind: "button", slot: col };
    }
    function updateSelectionFromCursor() {
      const fs = fieldSlot();
      selectedMon = null; selectedId = null;
      if (fs.kind === "mon") { const m = duel.p[fs.p].mon[fs.slot]; if (m && (m.faceUp || fs.p === 0)) { selectedMon = m; selectedId = m.id; } }
      else if (fs.kind === "spell") { const s = duel.p[fs.p].spells[fs.slot]; if (s && (s.faceUp || fs.p === 0)) selectedId = s.id; }
    }
    function setMode(m) { mode = m; }
    function openMenu(items, ctx, x, y) { menu = new UI.Menu(items, { x: x === undefined ? 4 : x, y: y === undefined ? 60 : y, w: 76, style: "menu", clickOutsideCancels: true }); menuCtx = ctx; setMode("menu"); }

    // ------------------------------------------------------------ player actions
    function doSummon(handIdx, pos) {
      const chk = duel.canSummon(me, handIdx);
      if (!chk.ok) { toast(chk.why); Sfx.error(); return; }
      if (chk.need > 0) { tribute = { need: chk.need, chosen: [], handIdx, pos }; row = 2; col = me.mon.findIndex((m) => m) ; if (col < 0) col = 0; setMode("tribute"); toast("Choose " + chk.need + " offering" + (chk.need > 1 ? "s" : "")); return; }
      const r = duel.summon(me, handIdx, pos, []);
      if (!r.ok) { toast(r.why); Sfx.error(); return; }
      finishAction();
    }
    function finishAction() { setMode("field"); menu = null; beginPlayback(); }
    function toast(t) { msgLine = t; msgT = 90; }

    function handMenu() {
      const id = me.hand[handSel]; const c = CardDB.get(id); if (!c) return;
      const items = [];
      if (c.kind === "M") {
        const chk = duel.canSummon(me, handSel);
        items.push({ label: "Summon", value: "atk", disabled: !chk.ok });
        items.push({ label: "Set", value: "def", disabled: !chk.ok });
        items.push({ label: "Fuse", value: "fuse", disabled: me.fuseLocked || (me.hand.filter((x) => CardDB.get(x).kind === "M").length < 2 && !me.mon.some((m) => m && !m.attackedThisTurn && !m.control)) });
      } else {
        if (c.kind !== "T") items.push({ label: "Use", value: "use" });
        items.push({ label: "Set", value: "set", disabled: me.freeSpellSlot() < 0 });
      }
      items.push({ label: "Info", value: "info" });
      items.push({ label: "Discard", value: "discard" });
      items.push({ label: "Back", value: "back" });
      if (duel.mustDiscard(me)) items.unshift(items.splice(items.findIndex((it) => it.value === "discard"), 1)[0]); // over the limit: Discard on top
      openMenu(items, { from: "hand", handIdx: handSel, card: c }, 4, 40);
    }
    function fieldMenu() {
      const fs = fieldSlot();
      if (fs.kind === "button") { if (fs.slot === 0) { setMode("hand"); handSel = 0; Sfx.ok(); } else endTurn(); return; }
      if (fs.p === 1) { const em = fs.kind === "mon" ? duel.p[1].mon[fs.slot] : null; const id = fs.kind === "mon" ? (em && em.faceUp ? em.id : null) : (duel.p[1].spells[fs.slot] && duel.p[1].spells[fs.slot].faceUp ? duel.p[1].spells[fs.slot].id : null); if (id) showInfo(id, "field", em); else { toast("Face down"); Sfx.error(); } return; }
      if (fs.kind === "mon") {
        const m = me.mon[fs.slot]; if (!m) { setMode("hand"); handSel = 0; Sfx.ok(); return; }
        const items = [];
        const ca = duel.canAttackWith(me, fs.slot);
        items.push({ label: "Attack", value: "attack", disabled: !ca.ok });
        items.push({ label: m.pos === "atk" ? "To DEF" : "To ATK", value: "pos", disabled: m.id === 797 || m.turnedThisTurn || m.summonTurn === duel.turnNo || m.attackedThisTurn || m.frozen > 0 || m.sleep > 0 });
        const sealed = duel.negated(m), stuck = sealed || m.usedSpecial || m.frozen > 0 || m.sleep > 0;
        const spent = (fx) => fx && fx.once && me.onceUsed.has(m.id); // a once-per-duel ability the player already used
        if (Effects.special[m.id]) items.push({ label: Effects.special2[m.id] ? "SPCL " + Effects.special[m.id].name.slice(0, 5) : "SPCL", value: "spcl", disabled: stuck || spent(Effects.special[m.id]) });
        if (Effects.special2[m.id]) items.push({ label: "SPCL " + Effects.special2[m.id].name.slice(0, 5), value: "spcl2", disabled: stuck || spent(Effects.special2[m.id]) });
        items.push({ label: "Info", value: "info" }); items.push({ label: "Back", value: "back" });
        openMenu(items, { from: "mon", slot: fs.slot }, 4, 60);
        return;
      }
      if (fs.kind === "spell") {
        const s = me.spells[fs.slot]; if (!s) { setMode("hand"); handSel = 0; Sfx.ok(); return; }
        const c = CardDB.get(s.id);
        const items = [];
        if (c.kind !== "T") items.push({ label: "Use", value: "use" });
        items.push({ label: "Info", value: "info" }); items.push({ label: "Back", value: "back" });
        openMenu(items, { from: "spell", slot: fs.slot, card: c }, 4, 60);
      }
    }
    function showInfo(id, back, mon) { infoId = id; infoMon = mon || null; infoBack = back; setMode("info"); Sfx.ok(); }
    function toggleAuto() {
      auto = !auto; Sfx.ok();
      menu = null; menuCtx = null;
      if (auto) { if (mode !== "play" && mode !== "end" && mode !== "done") setMode("field"); toast("AUTO on: Select to stop"); }
      else { me.ai = null; if (duel.turn === 0 && !aiTurn && mode === "play") setMode("field"); toast("AUTO off"); }
    }
    function endTurn() {
      if (duel.mustDiscard(me)) { setMode("hand"); handSel = 0; toast("Discard down to 5 cards"); Sfx.error(); return; }
      Sfx.ok(); duel.endTurn(); aiTurn = duel.turn === 1 && duel.winner === null; if (aiTurn) AI.beginTurn(ai); setMode("play"); beginPlayback();
    }

    function useMagic(src, c) {
      const fx = Effects.magic[c.id];
      if (c.kind === "R") { const r = duel.activate(me, src); if (!r.ok) { toast(r.why); Sfx.error(); return; } finishAction(); return; }
      if (!fx) { toast("No effect"); Sfx.error(); return; }
      if (fx.target === "ownMonster") {
        if (!me.hasMonsters()) { toast("No monster to equip"); Sfx.error(); return; }
        target = { kind: "equip", src, list: [0, 1, 2, 3, 4].filter((i) => me.mon[i]), idx: 0 }; setMode("target"); toast("Pick your monster"); return;
      }
      const r = duel.activate(me, src);
      if (!r.ok) { toast(r.why); Sfx.error(); return; }
      finishAction();
    }
    function handleMenu() {
      const r = menu.update();
      if (r === "cancel") { menu = null; setMode(menuCtx.from === "hand" ? "hand" : "field"); return; }
      if (r !== "ok") return;
      const v = menu.value, ctx = menuCtx;
      if (v === "back") { menu = null; setMode(ctx.from === "hand" ? "hand" : "field"); return; }
      if (v === "info") { const mon = ctx.from === "mon" ? me.mon[ctx.slot] : null; const id = ctx.from === "hand" ? me.hand[ctx.handIdx] : (mon ? mon.id : me.spells[ctx.slot].id); menu = null; showInfo(id, ctx.from === "hand" ? "hand" : "field", mon); return; }
      if (ctx.from === "hand") {
        if (v === "atk" || v === "def") { menu = null; doSummon(ctx.handIdx, v); return; }
        if (v === "fuse") {
          menu = null;
          const list = [];
          for (let i = 0; i < me.hand.length; i++) if (i !== ctx.handIdx && CardDB.get(me.hand[i]).kind === "M") list.push({ kind: "hand", slot: i });
          for (let s = 0; s < 5; s++) { const m = me.mon[s]; if (m && !m.attackedThisTurn && !m.control) list.push({ kind: "mon", slot: s }); }
          if (!list.length) { toast("Nothing to fuse with"); Sfx.error(); setMode("hand"); return; }
          target = { kind: "fuse", handIdx: ctx.handIdx, list, idx: 0 }; setMode("target"); toast("Fuse onto which card?"); return;
        }
        if (v === "set") { menu = null; const rr = duel.setSpell(me, ctx.handIdx); if (!rr.ok) { toast(rr.why); Sfx.error(); setMode("hand"); return; } finishAction(); return; }
        if (v === "use") { menu = null; useMagic({ hand: ctx.handIdx }, ctx.card); return; }
        if (v === "discard") { menu = null; duel.discard(me, ctx.handIdx); finishAction(); return; }
      } else if (ctx.from === "mon") {
        menu = null;
        if (v === "attack") {
          const m = me.mon[ctx.slot];
          const enemies = [0, 1, 2, 3, 4].filter((i) => ai.mon[i] && duel.canTarget(ai.mon[i]));
          if (!ai.hasMonsters() || (Effects.direct.has(m.id) && duel.live(m))) { const rr = duel.attack(me, ctx.slot, null); if (!rr.ok) { toast(rr.why); Sfx.error(); setMode("field"); return; } finishAction(); return; }
          if (!enemies.length) { toast("Nothing can be targeted"); Sfx.error(); setMode("field"); return; }
          target = { kind: "attack", slot: ctx.slot, list: enemies, idx: 0 }; setMode("target"); toast("Choose a target"); return;
        }
        if (v === "pos") { const rr = duel.changePos(me, ctx.slot); if (!rr.ok) { toast(rr.why); Sfx.error(); } else Sfx.ok(); setMode("field"); return; }
        if (v === "spcl" || v === "spcl2") { const rr = duel.special(me, ctx.slot, v === "spcl2"); if (!rr.ok) { toast(rr.why); Sfx.error(); setMode("field"); return; } finishAction(); return; }
      } else if (ctx.from === "spell") {
        menu = null;
        if (v === "use") { useMagic({ slot: ctx.slot }, ctx.card); return; }
      }
      setMode("field");
    }
    function handleTarget() {
      const t = target; const n = t.list.length;
      if (Input.pressed("left") || Input.pressed("up")) { t.idx = (t.idx - 1 + n) % n; Sfx.move(); }
      if (Input.pressed("right") || Input.pressed("down")) { t.idx = (t.idx + 1) % n; Sfx.move(); }
      // mouse
      for (let i = 0; i < n; i++) { const r = targetRect(t.list[i]); if (Input.hit(r.x, r.y, r.w, r.h)) { t.idx = i; Input.click = null; confirmTarget(); return; } }
      if (Input.pressed("b") || Input.click) { Sfx.cancel(); setMode(t.kind === "attack" ? "field" : "hand"); return; }
      if (Input.pressed("a")) confirmTarget();
    }
    function targetRect(item) {
      const s = typeof item === "number" ? item : item.slot;
      if (target.kind === "attack") return { x: ZX + s * ZP, y: ROW_Y.oppMon, w: 14, h: 14 };
      if (target.kind === "equip") return { x: ZX + s * ZP, y: ROW_Y.myMon, w: 14, h: 14 };
      if (item.kind === "mon") return { x: ZX + s * ZP, y: ROW_Y.myMon, w: 14, h: 14 };
      return { x: 2, y: handRowY(s), w: 74, h: 16 };
    }
    function confirmTarget() {
      const t = target, item = t.list[t.idx];
      if (t.kind === "attack") { const rr = duel.attack(me, t.slot, item); if (!rr.ok) { toast(rr.why); Sfx.error(); setMode("field"); return; } finishAction(); return; }
      if (t.kind === "equip") { const rr = duel.activate(me, t.src, item); if (!rr.ok) { toast(rr.why); Sfx.error(); setMode("hand"); return; } finishAction(); return; }
      if (t.kind === "fuse") {
        const rr = item.kind === "mon" ? duel.fuseField(me, t.handIdx, item.slot) : duel.fuseHand(me, t.handIdx, item.slot);
        if (!rr.ok) { toast(rr.why); Sfx.error(); setMode("hand"); return; }
        finishAction(); return;
      }
    }
    function handleTribute() {
      const t = tribute;
      const slots = [0, 1, 2, 3, 4].filter((i) => me.mon[i]);
      if (Input.pressed("left")) { const i = slots.indexOf(col); col = slots[(i - 1 + slots.length) % slots.length]; Sfx.move(); }
      if (Input.pressed("right")) { const i = slots.indexOf(col); col = slots[(i + 1) % slots.length]; Sfx.move(); }
      for (const s of slots) if (Input.hit(ZX + s * ZP, ROW_Y.myMon, 14, 14)) { col = s; Input.click = null; toggleTribute(); return; }
      if (Input.pressed("a")) toggleTribute();
      if (Input.pressed("b") || Input.click) { Sfx.cancel(); setMode("hand"); }
    }
    function toggleTribute() {
      const t = tribute;
      if (t.chosen.includes(col)) { t.chosen = t.chosen.filter((x) => x !== col); Sfx.cancel(); return; }
      t.chosen.push(col); Sfx.ok();
      if (t.chosen.length >= t.need) { const r = duel.summon(me, t.handIdx, t.pos, t.chosen); if (!r.ok) { toast(r.why); Sfx.error(); setMode("hand"); return; } finishAction(); }
    }

    // ------------------------------------------------------------ update
    function update() {
      if (msgT > 0) msgT--;
      if (shake > 0) shake--;
      if (flash && --flash.t <= 0) flash = null;
      // LP tween
      for (let i = 0; i < 2; i++) { const d = duel.p[i].lp - lpShow[i]; if (d !== 0) lpShow[i] += Math.sign(d) * Math.min(Math.abs(d), Math.max(25, Math.ceil(Math.abs(d) / 8))); }
      if (revealHand) {
        if (revealPick) {
          const n = revealHand.length;
          if (auto) { duel.resolvePick(me); revealHand = null; revealPick = false; beginPlayback(); return; } // AUTO picks for you
          if (Input.pressed("up")) { pickSel = (pickSel - 1 + n) % n; Sfx.move(); }
          if (Input.pressed("down")) { pickSel = (pickSel + 1) % n; Sfx.move(); }
          for (let i = 0; i < n; i++) if (Input.hit(10, 31 + i * 9, 140, 9)) { pickSel = i; Input.click = null; }
          if (Input.pressed("a") || Input.click) { Input.consumeAll(); duel.resolvePick(me, pickSel); revealHand = null; revealPick = false; Sfx.ok(); beginPlayback(); }
          return;
        }
        if (Input.pressed("a") || Input.pressed("b") || Input.click) { revealHand = null; Input.consumeAll(); }
        return;
      }
      if (quitMenu) {
        const r = quitMenu.update();
        if (r === "ok" && quitMenu.value) { params.onFinish(false, true); quitMenu = null; return; }
        if (r) quitMenu = null;
        return;
      }
      // event playback has priority
      if (playing() || cur) {
        if (!cur) startStep();
        if (cur) {
          curT++;
          const skip = Input.pressed("a") || Input.click;
          // narration pace: the text speed setting, and the enemy's turn fast-forwarded when the player asked for it
          const dur = Math.max(4, Math.round(cur.dur * Settings.stepMul() * (Settings.fastEnemy && aiTurn && !cur.end ? 0.25 : 1)));
          if (curT >= dur || (skip && curT > 6)) { if (cur.end) { setMode("end"); Music.play(cur.end.winner === 0 ? "victory" : "defeat", false); cur = null; queue.length = 0; return; } startStep(); }
        }
        if (cur) return;
      }
      if (mode === "end") {
        if (Input.pressed("a") || Input.click || spectate) { Input.consumeAll(); params.onFinish(endInfo.winner === 0, false); mode = "done"; }
        return;
      }
      if (mode === "done") return;
      const handOpen = mode === "hand" || (mode === "menu" && menuCtx && menuCtx.from === "hand") || (mode === "target" && target.kind === "fuse");
      if (!spectate && (Input.pressed("select") || (Input.hit(0, 100, 34, 12) && !handOpen) || (auto && Input.hit(40, 128, 36, 14)))) { toggleAuto(); return; }
      // AI turn driver
      if (aiTurn) {
        if (duel.winner !== null) { beginPlayback(); return; }
        if (aiWait > 0) { aiWait--; return; }
        const r = AI.step(duel, ai);
        beginPlayback();
        aiWait = 12;
        if (r.type === "end") { aiTurn = false; ai.ai = null; if (duel.winner === null) { beginPlayback(); setMode("field"); row = 2; col = 0; } }
        return;
      }
      if (duel.turn !== 0) return;
      if (Input.pressed("start") && !spectate) { quitMenu = UI.confirm({ text: "Give up this duel?", defaultNo: true, x: 52, y: 70 }); return; }
      // AUTO: let the computer take our turn, one action at a time
      if (auto) {
        if (duel.winner !== null) { beginPlayback(); return; }
        if (autoWait > 0) { autoWait--; return; }
        if (!me.ai) { AI.beginTurn(me); if (!spectate) me.skill = 4; }
        const r = AI.step(duel, me);
        beginPlayback();
        autoWait = 12;
        if (r.type === "end") { me.ai = null; aiTurn = duel.turn === 1 && duel.winner === null; if (aiTurn) { AI.beginTurn(ai); setMode("play"); } }
        else if (mode !== "play") setMode("play");
        return;
      }
      if (duel.forceEnd && !playing()) {
        if (duel.mustDiscard(me)) { if (mode !== "hand" && mode !== "menu") { setMode("hand"); handSel = 0; toast("Turn over: discard to 5"); } }
        else { toast("Your turn is over!"); endTurn(); return; }
      }
      if (mode === "play") setMode("field");
      switch (mode) {
        case "field": updateField(); break;
        case "hand": updateHand(); break;
        case "menu": handleMenu(); break;
        case "target": handleTarget(); break;
        case "tribute": handleTribute(); break;
        case "info": if (UI.detailInput()) break; if (Input.pressed("a") || Input.pressed("b") || Input.click) { Sfx.cancel(); setMode(infoBack); Input.consumeAll(); } break;
      }
    }
    function updateField() {
      const rowsMax = 4;
      if (Input.pressed("up")) { row = Math.max(0, row - 1); if (row === 4) col = Math.min(col, 1); Sfx.move(); }
      if (Input.pressed("down")) { row = Math.min(rowsMax, row + 1); if (row === 4) col = Math.min(col, 1); Sfx.move(); }
      if (Input.pressed("left")) { col = (col - 1 + (row === 4 ? 2 : 5)) % (row === 4 ? 2 : 5); Sfx.move(); }
      if (Input.pressed("right")) { col = (col + 1) % (row === 4 ? 2 : 5); Sfx.move(); }
      // mouse: slots
      const zones = [["oppMon", 1, 1], ["oppSpell", 0, 1], ["myMon", 2, 0], ["mySpell", 3, 0]];
      for (const [k, r, p] of zones) for (let i = 0; i < 5; i++) {
        if (Input.over(ZX + i * ZP, ROW_Y[k], 14, 14)) { if (Input.hover.x !== this_hx || Input.hover.y !== this_hy) { row = r; col = i; this_hx = Input.hover.x; this_hy = Input.hover.y; } if (Input.click) { row = r; col = i; Input.click = null; updateSelectionFromCursor(); fieldMenu(); return; } }
      }
      if (Input.hit(2, 128, 36, 14)) { row = 4; col = 0; fieldMenu(); return; }
      if (Input.hit(40, 128, 36, 14)) { row = 4; col = 1; fieldMenu(); return; }
      if (Input.hit(CARD_X, CARD_Y, 64, 80) && selectedId) { showInfo(selectedId, "field", selectedMon); return; }
      updateSelectionFromCursor();
      if (Input.pressed("a")) fieldMenu();
      if (Input.pressed("b")) { setMode("hand"); handSel = Math.min(handSel, Math.max(0, me.hand.length - 1)); Sfx.ok(); }
    }
    let this_hx = -1, this_hy = -1;
    function updateHand() {
      const n = me.hand.length;
      if (n === 0) { if (Input.pressed("b") || Input.pressed("a") || Input.click) { setMode("field"); Sfx.cancel(); } selectedId = null; return; }
      if (handSel >= n) handSel = n - 1;
      if (Input.pressed("up")) { handSel = (handSel - 1 + n) % n; Sfx.move(); }
      if (Input.pressed("down")) { handSel = (handSel + 1) % n; Sfx.move(); }
      showHandRow(handSel);
      for (let i = handTop; i < Math.min(n, handTop + handRows()); i++) if (Input.over(2, handRowY(i), 74, 16)) { if (Input.hover.x !== this_hx || Input.hover.y !== this_hy) { handSel = i; this_hx = Input.hover.x; this_hy = Input.hover.y; } if (Input.click) { handSel = i; Input.click = null; handMenu(); return; } }
      if (n > handRows()) { if (Input.hit(66, 29, 12, 10)) { handSel = Math.max(0, handSel - 1); showHandRow(handSel); } if (Input.hit(66, 102, 12, 10)) { handSel = Math.min(n - 1, handSel + 1); showHandRow(handSel); } }
      
      if (Input.hit(CARD_X, CARD_Y, 64, 80)) { showInfo(me.hand[handSel], "hand"); return; }
      if (Input.click) { setMode("field"); Sfx.cancel(); return; }
      selectedId = me.hand[handSel]; selectedMon = null;
      if (Input.pressed("a")) handMenu();
      if (Input.pressed("b")) { setMode("field"); Sfx.cancel(); }
    }

    // ------------------------------------------------------------ drawing
    function drawSlotIcon(x, y, p, kind, slot, highlight) {
      const pl = duel.p[p];
      const isSpell = kind === "spell";
      const h = isSpell ? 12 : 14;
      if (isSpell) {
        const s = pl.spells[slot];
        if (!s) { G.rect(x, y, 14, h, "#a0d0e0"); return; }
        G.fill(x, y, 14, h, C.black); G.fill(x + 1, y + 1, 12, h - 2, s.faceUp ? (CardDB.get(s.id).kind === "T" ? "#c060c0" : "#40a060") : "#c07830");
        if (!s.faceUp) { G.fill(x + 3, y + 3, 8, h - 6, "#804010"); G.fill(x + 5, y + 5, 4, h - 10, "#e0a040"); }
        else G.text(x + 3, y + 2, CardDB.get(s.id).kind, C.white);
      } else {
        const m = pl.mon[slot];
        if (!m) { G.rect(x, y, 14, h, "#a0d0e0"); return; }
        G.fill(x, y, 14, h, C.black);
        if (!m.faceUp) { G.fill(x + 1, y + 1, 12, 12, "#c07830"); G.fill(x + 3, y + 3, 8, 8, "#804010"); G.fill(x + 5, y + 5, 4, 4, "#e0a040"); }
        else { Assets.drawCardScaled(m.id, x + 1, y + 1, 12, 12); }
        // position marker
        if (m.pos === "def") { G.fill(x + 9, y + 9, 5, 5, C.black); G.fill(x + 10, y + 10, 3, 3, "#40c0ff"); }
        if (m.control) { G.fill(x, y, 4, 4, p === 0 ? "#f83030" : "#40c040"); }
        if (m.sleep > 0 || m.frozen > 0) { G.fill(x, y + 10, 4, 4, "#8080ff"); }
        if (m.levels > 0 || m.temp > 0) G.px(x + 12, y + 1, C.gold);
      }
      if (highlight) G.rect(x - 1, y - 1, 16, h + 2, G.blink(8) ? C.gold : C.red);
      if (flash && flash.p === p && flash.kind === kind && flash.slot === slot && G.blink(4)) G.fill(x, y, 14, h, C.white);
    }
    function drawField() {
      G.clear(C.panel);
      const sx = shake > 0 ? (shake % 2 ? 1 : -1) : 0;
      G.ctx.save(); G.ctx.translate(sx, 0);
      // LP boxes
      G.box(0, 0, 66, 16, "duel"); Assets.icon("lp", 5, 4); G.textR(62, 4, Math.round(lpShow[1]), C.black);
      G.box(0, 112, 66, 16, "duel"); Assets.icon("lp", 5, 116); G.textR(62, 116, Math.round(lpShow[0]), C.black);
      // names / hand counts
      G.text(2, 18, short(opp.name, 4), C.black); G.textR(76, 18, "H" + ai.hand.length + "D" + ai.deck.length, C.darkgray);
      G.box(0, 100, 34, 12, auto ? "talk" : "menu"); G.textC(17, 102, "AUTO", auto ? (G.blink(16) ? C.gold : C.white) : C.gray);
      G.textR(76, 102, "H" + me.hand.length + "D" + me.deck.length, C.darkgray);
      // zones
      const fs = fieldSlot();
      for (let i = 0; i < 5; i++) {
        drawSlotIcon(ZX + i * ZP, ROW_Y.oppMon, 1, "mon", i, mode === "field" && fs.p === 1 && fs.kind === "mon" && fs.slot === i);
        drawSlotIcon(ZX + i * ZP, ROW_Y.oppSpell, 1, "spell", i, mode === "field" && fs.p === 1 && fs.kind === "spell" && fs.slot === i);
        drawSlotIcon(ZX + i * ZP, ROW_Y.mySpell, 0, "spell", i, mode === "field" && fs.p === 0 && fs.kind === "spell" && fs.slot === i);
        drawSlotIcon(ZX + i * ZP, ROW_Y.myMon, 0, "mon", i, (mode === "field" && fs.p === 0 && fs.kind === "mon" && fs.slot === i) || (mode === "tribute" && col === i));
        if (mode === "tribute" && tribute.chosen.includes(i)) G.text(ZX + i * ZP + 3, ROW_Y.myMon + 3, "\x8f", C.gold);
      }
      // target highlights
      if (mode === "target") for (let i = 0; i < target.list.length; i++) { const r = targetRect(target.list[i]); G.rect(r.x - 1, r.y - 1, r.w + 2, r.h + 2, i === target.idx ? (G.blink(6) ? C.red : C.gold) : "#e08040"); }
      // buttons
      const btn = mode === "field" && row === 4;
      G.box(2, 128, 36, 14, btn && col === 0 ? "talk" : "menu"); G.textC(20, 131, "HAND", btn && col === 0 ? C.gold : C.white);
      if (auto) { G.box(40, 128, 36, 14, "talk"); G.textC(58, 131, "AUTO", G.blink(16) ? C.gold : C.white); }
      else { G.box(40, 128, 36, 14, btn && col === 1 ? "talk" : "menu"); G.textC(58, 131, "END", btn && col === 1 ? C.gold : C.white); }
      // left column: field box + info / hand list
      if (mode === "hand" || (mode === "target" && target.kind === "fuse") || (mode === "menu" && menuCtx && menuCtx.from === "hand")) {
        G.box(0, 29, 78, 83, "list");
        if (mode === "target") { const it = target.list[target.idx]; if (it && it.kind === "hand") showHandRow(it.slot); } else showHandRow(handSel);
        const scrolling = me.hand.length > handRows(), nameMax = scrolling ? 8 : 9, valR = scrolling ? 66 : 74; // scroll markers need the right edge
        if (discarding()) { G.fill(2, 30, 74, 9, C.red); G.textC(39, 31, "Discard " + (me.hand.length - 5), C.white); }
        for (let i = handTop; i < Math.min(me.hand.length, handTop + handRows()); i++) {
          const c = CardDB.get(me.hand[i]);
          const y = handRowY(i);
          if (i === handSel && mode !== "target") G.fill(2, y, 74, 16, "#c8e8ff");
          G.text(4, y, short(c.name, nameMax), C.black);
          if (c.kind === "M") { G.text(4, y + 8, c.el.slice(0, scrolling ? 2 : 3), C.darkgray); Assets.icon("atk", scrolling ? 22 : 34, y + 8); G.textR(valR, y + 8, c.atk, C.darkgray); }
          else G.text(4, y + 8, CardDB.kindName(c).slice(0, 7), C.purple);
        }
        if (!me.hand.length) G.text(6, 40, "No cards", C.gray);
        if (handTop > 0) G.tri(70, discarding() ? 41 : 31, "up", C.darkgray);
        if (handTop + handRows() < me.hand.length) G.tri(70, 104, "down", C.darkgray);
      } else {
        const f = CardDB.fieldInfo(duel.field);
        G.box(0, 29, 78, 14, "duel"); G.textC(39, 32, f ? f.name : "Arena", C.black);
        G.box(0, 44, 78, 55, "duel");
        const c = selectedId ? CardDB.get(selectedId) : null;
        if (c) { const st = selectedMon ? duel.describeMonster(selectedMon) : null; UI.cardStats(6, 47, c, st); }
        else if (mode === "field") { const fs2 = fieldSlot(); if ((fs2.kind === "mon" && duel.p[fs2.p] && duel.p[fs2.p].mon[fs2.slot]) || (fs2.kind === "spell" && duel.p[fs2.p] && duel.p[fs2.p].spells[fs2.slot])) G.text(6, 66, "Face down", C.darkgray); }
        // status line: Swords of Revealing Light turns left (red = on you, blue = on the enemy) and a controlled monster
        const status = [];
        if (me.swords > 0) status.push({ t: "S" + me.swords, long: "Swords " + me.swords, col: C.red });
        if (ai.swords > 0) status.push({ t: "S" + ai.swords, long: "Swords " + ai.swords, col: C.blue });
        if (selectedMon && selectedMon.control) status.push({ t: "ctl", long: "controlled", col: C.red });
        if (status.length === 1) G.text(6, 89, status[0].long, status[0].col);
        else { let sx = 6; for (const it of status) { G.text(sx, 89, it.t, it.col); sx += it.t.length * 8 + 8; } }
      }
      // card art panel
      G.fill(CARD_X - 2, CARD_Y - 2, 68, 84, C.black);
      if (selectedId) Assets.drawCard(selectedId, CARD_X, CARD_Y);
      else { G.fill(CARD_X, CARD_Y, 64, 80, "#c07830"); G.fill(CARD_X + 6, CARD_Y + 6, 52, 68, "#804010"); G.fill(CARD_X + 14, CARD_Y + 14, 36, 52, "#e0a040"); G.fill(CARD_X + 22, CARD_Y + 22, 20, 36, "#804010"); }
      // turn marker
      if (duel.turn === 1) G.rect(0, 0, 66, 16, C.red); else G.rect(0, 112, 66, 16, C.red);
      G.ctx.restore();
    }
    function drawBattle() {
      const b = battle;
      G.clear("#a8e8f8");
      const left = b.player === 0 ? { id: b.a, atk: b.aAtk, lp: lpShow[0], label: "ATK", who: 0 } : { id: b.d, atk: b.dPos === "def" ? b.dDef : b.dAtk, lp: lpShow[0], label: b.dPos === "def" ? "DEF" : "ATK", who: 0 };
      const right = b.player === 1 ? { id: b.a, atk: b.aAtk, lp: lpShow[1], label: "ATK", who: 1 } : { id: b.d, atk: b.dPos === "def" ? b.dDef : b.dAtk, lp: lpShow[1], label: b.dPos === "def" ? "DEF" : "ATK", who: 1 };
      const sides = [left, right];
      for (let i = 0; i < 2; i++) {
        const s = sides[i]; const x = i === 0 ? 6 : 86;
        G.fill(x - 2, 2, 68, 84, C.black);
        if (s.id) Assets.drawCard(s.id, x, 4); else { G.fill(x, 4, 64, 80, "#c07830"); G.textC(x + 32, 40, "----", C.white); }
        G.box(x - 4, 84, 72, 34, "duel");
        if (s.id) { const c = CardDB.get(s.id); G.text(x, 87, short(c.name, 8), C.black); Assets.icon(s.label === "DEF" ? "def" : "atk", x + 2, 96); G.textR(x + 62, 96, s.atk, C.black); }
        else G.text(x, 91, "Direct", C.black);
        Assets.icon("lp", x + 2, 106); G.textR(x + 62, 106, Math.round(s.lp), C.black);
      }
      if (shake > 0 && G.blink(2)) G.dim(0.15);
    }
    function draw() {
      if (viewMode === "battle" && battle) drawBattle(); else drawField();
      if (mode === "info" && infoId) { UI.cardDetail(infoId, infoMon ? { live: duel.describeMonster(infoMon) } : {}); return; }
      if (mode === "menu" && menu) menu.draw();
      if (cur && cur.text) { const my = viewMode === "battle" ? 118 : 100; G.box(2, my, 156, 26, "talk"); const lines = G.wrap(cur.text, 18); G.text(8, my + 5, lines[0], C.white); if (lines[1]) G.text(8, my + 14, lines[1], C.white); }
      else if (msgT > 0) { G.box(2, 100, 156, 16, "talk"); G.text(8, 104, msgLine.slice(0, 18), C.gold); }
      if (revealHand) {
        G.box(10, 16, 140, 108, "list"); G.text(16, 20, revealPick ? "Throw away which?" : "Enemy hand:", C.black);
        revealHand.slice(0, 8).forEach((id, i) => { if (revealPick && i === pickSel) G.fill(12, 30 + i * 9, 136, 9, "#c8e8ff"); G.text(16, 31 + i * 9, short(name(id), 16), C.black); });
        G.text(16, 112, revealPick ? "A: throw it away" : "A: close", C.darkgray);
      }
      if (mode === "end" && endInfo) {
        G.dim(0.4); G.box(20, 50, 120, 44, "talk");
        G.textC(80, 58, endInfo.winner === 0 ? "YOU WIN!" : "YOU LOSE", endInfo.winner === 0 ? C.gold : C.red);
        G.textC(80, 70, endInfo.reason === "exodia" ? "Exodia!" : endInfo.reason === "deckout" ? "Deck out" : "", C.white);
        G.textC(80, 82, "Press A", C.white);
      }
      if (quitMenu) { G.dim(0.4); G.box(20, 54, 120, 14, "talk"); G.text(26, 57, quitMenu.question, C.white); quitMenu.draw(); }
    }

    return {
      enter() { Game.currentDuel = duel; lpShow = [duel.p[0].lp, duel.p[1].lp]; if (spectate) { auto = true; AI.beginTurn(me); me.skill = me.skill || 4; } row = 2; col = 0; beginPlayback(); if (duel.turn === 1) { aiTurn = true; AI.beginTurn(ai); setMode("play"); } },
      update, draw,
      // for the automated runner / tests
      state() { return { mode, auto, aiTurn, turn: duel.turnNo, winner: duel.winner, playing: !!cur || queue.length > 0, reveal: !!revealHand, quit: !!quitMenu }; },
    };
  };
})();
