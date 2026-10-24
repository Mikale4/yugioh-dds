// The duel engine: Dark Duel Stories rules.
//  - 8000 LP, 40-card decks: at the start of a turn the player draws back up to 5 cards (card effects can draw past 5;
//    the end phase discards back down to 5)
//  - modern summoning: one Normal Summon (face-up ATK, may attack at once) or Set (face-down DEF) per turn;
//    special summons (rituals, stolen monsters, the Toons, The Fiend Megacyber) are unlimited and never use the
//    normal summon; The Last Warrior from Another Planet seals normal summons and sets for both sides
//  - no position change on the turn a monster arrives or after it attacked; the first player cannot attack on turn 1
//  - fusion: two hand monsters, or a hand monster onto a field monster that has not attacked this turn
//  - Megamorph doubles ATK; auras (Castle of Dark Illusions, Pumpking, Hoshiningen...) add or take 30 percent
//  - monster effects: SPCL abilities (once per turn, no attack spent), always-on passives (Effects.passive), and
//    triggers when a monster is destroyed / discarded / wins a battle (Effects.onDestroy, Effects.onDiscard, attack())
//  - fusion combines two monsters in the hand into an ordinary hand card; a failed attempt keeps both cards
//    but ends fusing for the turn
//  - battles compare ATK against ATK or DEF (elements are flavour only); Total Defense Shogun fights with its DEF
//  - field cards boost/penalise types by 30%; equip cards add +500 per level
(function () {
  let uidSeq = 1, activeDuel = null;

  class Monster {
    constructor(id, owner) {
      const c = CardDB.get(id);
      this.uid = uidSeq++; this.id = id; this.card = c; this.owner = owner;
      this.pos = "atk"; this.faceUp = false; this.levels = 0; this.temp = 0; this.equips = [];
      this.canAttack = false; this.sleep = 0; this.frozen = 0; this.control = null; this.age = 0; this.tyOverride = null;
      this.turnedThisTurn = false; this.summonTurn = 0; this.attackedThisTurn = false; this.usedSpecial = false; this.doubled = false;
      this.attacksMade = 0; this.usedOnce = false; this.guarded = false; this.whim = 0; this.courageUntil = 0; this.mimic = null; this.shieldUsed = false;
    }
    // B.eye Silv. Zombie turns every enemy monster into a Zombie; Parasite Paracide, while it sits in a player's deck,
    // makes every monster of theirs an Insect
    get ty() {
      if (activeDuel && activeDuel.p[this.owner]) {
        const foe = activeDuel.p[1 - this.owner];
        if (foe && foe.mon.some((m) => m && m.id === 139 && activeDuel.live(m))) return "Zombie";
        if (activeDuel.p[this.owner].deck.includes(763)) return "Insect";
      }
      return this.tyOverride || this.card.ty;
    }
    get el() { return this.card.el; }
  }

  class Player {
    constructor(name, deckIds, isAI, duelist) {
      this.name = name; this.isAI = isAI; this.duelist = duelist || null;
      this.lp = (duelist && duelist.lp) || 8000; // the rulers of the Heavens start with more
      this.startLp = this.lp;                    // kept for the earnings tally, which replays the duel from its log
      this.deck = deckIds.slice(); shuffle(this.deck);
      this.hand = []; this.grave = [];
      this.mon = [null, null, null, null, null];
      this.spells = [null, null, null, null, null]; // {id, faceUp}
      this.summoned = false; this.swords = 0; this.noAttack = 0; this.fuseLocked = false;
      this.revive = []; this.serpent = false;     // Doll of Demise comebacks, Sinister Serpent's return
      this.onceUsed = new Set();                  // once-per-duel SPCL abilities already spent (by card)
      this.stats = { attacks: 0, fusions: 0, damageDealt: 0, tookDamage: false, firstHit: "" };
    }
    monsters() { return this.mon.filter((m) => m); }
    hasMonsters() { return this.mon.some((m) => m); }
    freeMonSlot() { return this.mon.indexOf(null); }
    freeSpellSlot() { return this.spells.indexOf(null); }
    counts(id) { return this.hand.filter((x) => x === id).length; }
  }

  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const LOCKED = { ok: false, why: "Turn is over" }; // after The Unhappy Maiden ends the turn only discarding is left

  class Duel {
    constructor(p0, p1, opts) {
      activeDuel = this;
      this.p = [p0, p1]; p0.index = 0; p1.index = 1;
      this.turn = 0; this.turnNo = 0; this.field = 0; this.fieldOwner = -1; this.winner = null; this.reason = "";
      this.quietTurns = 0; this.acted = false; this.forceEnd = false; this.effectSource = null;
      this.events = []; this.opts = opts || {};
      this.log = [];
      for (const pl of this.p) for (let i = 0; i < 5; i++) this.drawCard(pl, true);
      // whoever goes first is random unless specified
      this.turn = this.opts.first !== undefined ? this.opts.first : Math.floor(Math.random() * 2);
      this.startTurn(true);
    }
    // ---------------------------------------------------------- helpers
    cur() { return this.p[this.turn]; }
    opp(pl) { return this.p[1 - pl.index]; }
    emit(type, data) { const e = Object.assign({ type }, data || {}); this.events.push(e); this.log.push(e); return e; }
    msg(text) { this.emit("msg", { text }); }
    drawCard(pl, silent) { // no hand limit here: only the start-of-turn refill stops at 5
      if (pl.deck.length === 0) return false;
      const id = pl.deck.shift(); pl.hand.push(id);
      if (!silent) this.emit("draw", { player: pl.index, id });
      this.checkExodia(pl);
      return true;
    }
    checkExodia(pl) {
      const pieces = [17, 18, 19, 20, 21];
      if (pieces.every((id) => pl.hand.includes(id)) && this.winner === null) {
        this.emit("exodia", { player: pl.index });
        this.end(pl.index, "exodia");
      }
    }
    end(winner, reason) { if (this.winner !== null) return; this.winner = winner; this.reason = reason; this.emit("end", { winner, reason }); }
    // LP loss; returns true when LP were really lost (a Kuriboh in the hand or on the field takes the hit instead)
    damage(pl, amt, why) {
      amt = Math.max(0, Math.round(amt));
      if (amt <= 0 || this.winner !== null) return false;
      if (why !== "cost") {
        const h = pl.hand.indexOf(58);
        if (h >= 0) { pl.hand.splice(h, 1); this.toGrave(pl, 58); this.emit("shield", { player: pl.index, id: 58, fromHand: true, amount: amt }); return false; }
        const k = pl.mon.find((m) => m && m.id === 58 && this.live(m));
        if (k) { this.emit("shield", { player: pl.index, id: 58, amount: amt }); this.destroyMonster(k, "shield"); return false; }
      }
      pl.lp = Math.max(0, pl.lp - amt);
      // a flawless win means these Life Points never moved; the first thing that dented them is kept, because
      // 50 points of chip damage is easy to miss and it is what ends a flawless run
      if (!pl.stats.tookDamage) pl.stats.firstHit = (why || "damage") + " " + amt;
      pl.stats.tookDamage = true;
      if ((why === "battle" || why === "direct") && !pl.monsters().length && pl.freeMonSlot() >= 0) {
        const g = pl.hand.indexOf(805);           // Gorz the Emissary answers a blow taken on an empty field
        if (g >= 0) { pl.hand.splice(g, 1); Effects.summonFree(this, pl, 805, "gorz"); }
      }
      this.opp(pl).stats.damageDealt += amt;
      this.emit("damage", { player: pl.index, amount: amt, why: why || "" });
      if (pl.lp <= 0) this.end(1 - pl.index, "lp");
      return true;
    }
    heal(pl, amt) {
      // Simochi Allergy on the opponent's side turns healing into damage (unless Jinzo shuts the traps down)
      const opp = this.opp(pl);
      const sim = opp.spells.findIndex((s) => s && s.id === 688);
      if (sim >= 0 && !this.jinzoOut()) {
        this.revealSpell(opp, sim); this.emit("trap", { player: opp.index, id: 688 });
        this.toGrave(opp, opp.spells[sim].id); opp.spells[sim] = null;
        this.damage(pl, amt, "allergy"); return;
      }
      pl.lp = Math.min(99999, pl.lp + amt);
      this.emit("heal", { player: pl.index, amount: amt });
    }
    toGrave(pl, id) { pl.grave.push(id); if (id === 475) pl.serpent = true; } // Sinister Serpent comes back next turn
    jinzoOut() { return this.p.some((p) => p.mon.some((m) => m && m.id === 752 && this.live(m))); } // Jinzo: no trap works
    // Binding Chain seals every enemy monster effect (never its own kind); live(m) = the monster's effects work
    negated(m) { return m.id !== 584 && this.p[1 - m.owner].mon.some((x) => x && x.id === 584); }
    live(m) { return !this.negated(m); }
    // Wing Egg Elf and Mechaleon cannot be attacked while another monster stands beside them
    canTarget(d) { return !(Effects.untargetable.has(d.id) && this.live(d) && this.p[d.owner].monsters().length > 1); }
    // ctx (battles): { battle: true, by: the other monster, attacking: whether m was the attacker }
    destroyMonster(m, why, ctx) {
      const pl = this.p[m.owner];
      const slot = pl.mon.indexOf(m);
      if (slot < 0) return;
      // Gate Guardian: once a turn a destroying card effect fails, and the monster behind it is destroyed
      if (m.id === 374 && this.live(m) && !["battle", "offer", "shield"].includes(why) && !m.guarded) {
        m.guarded = true; this.emit("negate", { player: pl.index, id: m.id, why });
        const src = this.effectSource; this.effectSource = null;
        if (src && src.m && src.m !== m && this.p[src.m.owner].mon.includes(src.m)) this.destroyMonster(src.m, "guardian");
        return;
      }
      pl.mon[slot] = null;
      // a stolen monster goes to its original owner's graveyard
      const orig = m.control ? this.p[m.control.orig] : pl;
      this.toGrave(orig, m.id);
      for (const e of m.equips) this.toGrave(orig, e);
      this.emit("destroy", { player: pl.index, slot, id: m.id, why: why || "" });
      const fx = Effects.onDestroy[m.id];
      if (fx && this.winner === null && this.live(m)) {
        // some of these fire once a duel however many copies you run (Doll of Demise, Skull Servant, Blast Sphere)
        if (Effects.onceDestroy.has(m.id)) { if (orig.onceUsed.has(m.id)) return; orig.onceUsed.add(m.id); }
        fx(this, pl, m, Object.assign({ why }, ctx || {}));
      }
    }
    onDiscard(pl, id) {
      const fx = Effects.onDiscard[id]; if (!fx || this.winner !== null) return;
      if (Effects.onceDiscard.has(id)) { if (pl.onceUsed.has(id)) return; pl.onceUsed.add(id); }   // Electric Snake draws once a duel
      fx(this, pl);
    }
    revealSpell(pl, slot) { const s = pl.spells[slot]; if (s) s.faceUp = true; }
    // ---------------------------------------------------------- stats
    fieldMod(m) {
      const f = CardDB.fieldInfo(this.field); if (!f) return 0;
      if (f.plus.includes(m.ty)) return 0.3;
      if (f.minus.includes(m.ty)) return -0.3;
      return 0;
    }
    // auras: monsters that lift or lower whole groups by 30 percent of the base (own side, or both sides for the
    // field-like ones); they add up like the field card does
    auraMod(m) {
      const pl = this.p[m.owner], own = pl.monsters(), all = own.concat(this.opp(pl).monsters());
      const has = (arr, id) => arr.some((o) => o.id === id && this.live(o));
      let f = 0;
      if (m.ty === "Zombie" && has(own, 99)) f += 0.3;                                    // Pumpking the King of Ghosts
      if (m.ty === "Warrior" && has(own, 753)) f += 0.3;                                  // Swordsman of Landstar
      if (m.ty === "Magician" && has(own, 104)) f += 0.3;                                 // Curtain of the Dark Ones
      if ((m.el === "Forest" || m.ty === "Plant") && has(own, 235)) f += 0.3;             // Wodan the Resident of the Forest
      if ((m.id === 12 && has(own, 554)) || (m.id === 554 && has(own, 12))) f += 0.3;     // the Battleguards
      if (has(all, 492)) { if (m.el === "Light") f += 0.3; if (m.el === "Shadow") f -= 0.3; }                       // Hoshiningen
      if (has(all, 524)) { if (m.el === "Aqua" || m.ty === "Aqua") f += 0.3; if (m.el === "Pyro" || m.ty === "Pyro") f -= 0.3; } // Star Boy
      if (has(all, 609)) { if (m.el === "Wind" || m.el === "Forest") f += 0.3; if (m.el === "Earth" || m.ty === "Rock") f -= 0.3; } // Bladefly
      return f;
    }
    passiveBonus(m) {
      const pl = this.p[m.owner], opp = this.opp(pl); let b = 0;
      const mons = pl.monsters().filter((o) => this.live(o)), oppMons = opp.monsters();
      const self = this.live(m);
      const insects = (arr) => arr.filter((o) => o.ty === "Insect" && o !== m).length;
      const graveMons = (p, pred) => p.grave.filter((id) => { const c = CardDB.get(id); return c && c.kind === "M" && (!pred || pred(c)); }).length;
      const isInsect = (c) => c.ty === "Insect";
      // Harpie Lady / Sisters power Harpie's Pet Dragon
      if (m.id === 386 && self) for (const o of pl.monsters()) { if (o.id === 62) b += 500; if (o.id === 63) b += 1000; }
      // Mystical Elf powers B.eyes White Dragon
      if (m.id === 1 && mons.some((o) => o.id === 2 && o !== m)) b += 500;
      // Witch's Apprentice: shadow +500 / light -500 (for every monster on the field, both sides)
      const apprentices = this.p.reduce((n, p) => n + p.monsters().filter((o) => o.id === 628 && this.live(o)).length, 0);
      if (apprentices) { if (m.el === "Shadow" && m.id !== 628) b += 500 * apprentices; if (m.el === "Light") b -= 500 * apprentices; }
      // D. Magician Girl: +500 per D. Magician in the hand, on the field and in the graveyard
      if (m.id === 760 && self) b += 500 * (pl.counts(35) + pl.monsters().filter((o) => o.id === 35).length + pl.grave.filter((id) => id === 35).length);
      // Insect Queen: +200 per Insect on both fields and in both graveyards
      if (m.id === 762 && self) b += 200 * (insects(pl.monsters()) + insects(oppMons) + graveMons(pl, isInsect) + graveMons(opp, isInsect));
      // Great Moth: +100 per Insect with it or in its graveyard; Perfectly Ultimate Great Moth: +100 per Insect anywhere
      if (m.id === 57 && self) b += 100 * (insects(pl.monsters()) + graveMons(pl, isInsect));
      if (m.id === 67 && self) b += 100 * (insects(pl.monsters()) + insects(oppMons) + graveMons(pl, isInsect) + graveMons(opp, isInsect));
      // Skull-Mark Ladybug: +200 per other own Insect
      if (m.id === 764 && self) b += 200 * insects(pl.monsters());
      // Gyakutenno Megami: allies with base ATK <= 500 get +500
      if (m.card.atk <= 500 && mons.some((o) => o.id === 90)) b += 500;
      // Monster Tamer: allied Beasts / BeastWar +300
      if (mons.some((o) => o.id === 376 && o !== m) && (m.ty === "Beast" || m.ty === "BeastWar")) b += 300;
      // M-warriors power each other
      if (m.id === 160 && self && pl.monsters().some((o) => o.id === 161)) b += 500;
      if (m.id === 161 && self && pl.monsters().some((o) => o.id === 160)) b += 500;
      // Dungeon Worm boosted by Monster Tamer? (guide: 376 powers 375)
      if (m.id === 375 && self && pl.monsters().some((o) => o.id === 376)) b += 500;
      return b;
    }
    atkBonus(m) { // ATK-only passives
      const pl = this.p[m.owner], opp = this.opp(pl); let b = 0;
      if (!this.live(m)) return 0;
      const graveMons = (p, pred) => p.grave.filter((id) => { const c = CardDB.get(id); return c && c.kind === "M" && (!pred || pred(c)); }).length;
      if (m.id === 368) b += 100 * graveMons(pl);                                                                     // Shadow Ghoul
      if (m.id === 369 || m.id === 370) b += 500 * this.p.reduce((n, p) => n + p.monsters().filter((o) => o.id === 366).length + p.grave.filter((id) => id === 366).length, 0); // Labyrinth Wall count
      if (m.id === 407) b += 100 * (pl.monsters().filter((o) => o.ty === "Machine").length + opp.monsters().filter((o) => o.ty === "Machine").length + graveMons(pl, (c) => c.ty === "Machine") + graveMons(opp, (c) => c.ty === "Machine")); // Machine King
      if (m.id === 516) b += 600 * pl.hand.length;                                                                     // Muka Muka
      if (m.id === 801 || m.id === 802) { // Buster Blader, and the Paladin it becomes: every Dragon on either field or in either graveyard
        const dragons = (p) => p.monsters().filter((o) => o.ty === "Dragon").length + p.grave.filter((id) => { const c = CardDB.get(id); return c && c.ty === "Dragon"; }).length;
        b += 500 * (dragons(pl) + dragons(opp));
      }
      // Junk Warrior: everyone who ever fought beside it - 100 ATK for every monster out or buried (the user's
      // rule, 2026-09-23; its printed effect counts levels, and there are no levels any more)
      if (m.id === 807) {
        b += 100 * pl.monsters().length;
        for (const id of pl.grave) { const c = CardDB.get(id); if (c && c.kind === "M") b += 100; }
      }
      if (m.id === 808) b += 300 * opp.grave.filter((id) => { const c = CardDB.get(id); return c && c.kind === "S"; }).length; // White-Horned Dragon
      if (m.id === 720) { // Mask of Shine & Darkness: light and dark on both fields and in both graves feed it
        const lit = (c) => c && (c.el === "Light" || c.el === "Shadow");
        let n = 0;
        for (const p of this.p) {
          for (const o of p.monsters()) if (o !== m && lit(o.card)) n++;
          for (const id of p.grave) if (lit(CardDB.get(id))) n++;
        }
        b += 100 * n;
      }
      if (m.id === 493) b += 500 * m.levels;                                                                           // Maha Vailo
      return b;
    }
    atk(m) {
      if ((m.id === 797 || m.id === 362) && this.live(m)) return this.def(m); // Total Defense Shogun and Millennium Shield fight with their DEF
      const base = m.mimic && this.live(m) ? m.mimic.atk : m.card.atk, pl = this.p[m.owner];
      let v = base + base * (this.fieldMod(m) + this.auraMod(m)) + m.levels * 500 + m.temp + this.passiveBonus(m) + this.atkBonus(m);
      // Castle of Dark Illusions: Zombie, Fiend and Shadow monsters on its side hit 30 percent harder
      if ((m.ty === "Zombie" || m.ty === "Fiend" || m.el === "Shadow") && pl.monsters().some((o) => o.id === 83 && this.live(o))) v += base * 0.3;
      if (m.whim) v *= m.whim;                     // Goddess of Whim's coin
      if (m.courageUntil >= this.turnNo) v *= 2;   // Hourglass of Courage
      if (m.doubled) v *= 2;                       // Megamorph
      return Math.max(0, Math.round(v));
    }
    def(m) {
      const base = m.mimic && this.live(m) ? m.mimic.def : m.card.def;
      let v = base + base * (this.fieldMod(m) + this.auraMod(m)) + m.levels * 500 + m.temp + this.passiveBonus(m);
      if (m.courageUntil >= this.turnNo) v *= 2;
      return Math.max(0, Math.round(v));
    }
    // the ATK a hand card would have on our field right now (passives and auras included)
    previewAtk(pl, id) {
      const m = new Monster(id, pl.index); m.faceUp = true;
      const h = pl.hand.indexOf(id); if (h >= 0) pl.hand.splice(h, 1);
      const v = this.atk(m);
      if (h >= 0) pl.hand.splice(h, 0, id);
      return v;
    }
    // An equip sits on a monster and the field card sits under everyone, and both of them are spells: anything that
    // destroys spells on the field can destroy these too (the user's rule, 2026-09-23). Taking an equip off gives
    // back exactly what it gave.
    removeEquip(pl, m, id) {
      const i = m.equips.indexOf(id); if (i < 0) return false;
      m.equips.splice(i, 1);
      const fx = Effects.magic[id];
      if (id === 657) m.doubled = false;
      if (id === 658) m.tyOverride = null;
      if (fx && fx.levels) m.levels = Math.max(0, m.levels - fx.levels);
      this.toGrave(pl, id);
      this.emit("breakset", { player: pl.index, slot: -1, id, equip: true });
      return true;
    }
    clearFieldCard() { return this.field ? this.setField(0, this.turn) : false; }
    // Every field card goes through here, so Toon World can take the Toons with it when it leaves - destroyed or
    // replaced, they go (the user's rule, 2026-09-24).
    setField(id, owner) {
      const prev = this.field, who = owner === undefined ? this.turn : owner;
      this.field = id; this.fieldOwner = id ? who : -1;
      this.emit("field", { player: who, id });
      if (prev === 823 && id !== 823) {
        for (const p of this.p) for (const m of p.monsters()) if (Effects.TOONS.has(m.id)) this.destroyMonster(m, "toonworld");
      }
      return true;
    }
    // ---------------------------------------------------------- turn flow
    startTurn(first) {
      const pl = this.cur();
      this.turnNo++;
      pl.summoned = false; pl.fuseLocked = false;
      for (const p of this.p) for (const m of p.monsters()) { m.guarded = false; m.shieldUsed = false; }
      for (const p of this.p) p.toonGuard = false;                     // Toon World stops one attack a turn
      for (const m of pl.monsters()) {
        m.canAttack = true; m.age++; m.turnedThisTurn = false; m.attackedThisTurn = false; m.usedSpecial = false; m.attacksMade = 0;
        if (m.sleep > 0) { m.sleep--; if (m.sleep > 0) m.canAttack = false; }
        if (m.frozen > 0) { m.frozen--; if (m.frozen > 0) m.canAttack = false; }
      }
      // Brain Control returns monsters at the start of the original owner's turn
      for (const p of this.p) for (let i = 0; i < 5; i++) {
        const m = p.mon[i];
        if (m && m.control && m.control.temp && m.control.orig === pl.index) {
          const back = this.p[m.control.orig];
          const fs = back.freeMonSlot();
          p.mon[i] = null;
          if (fs >= 0) { m.owner = back.index; m.control = null; back.mon[fs] = m; m.canAttack = false; this.emit("return", { player: back.index, slot: fs, id: m.id }); }
          else { this.toGrave(back, m.id); }
        }
      }
      if (pl.swords > 0) pl.swords--;
      if (pl.noAttack > 0) pl.noAttack--;      // the turn a felled monster's last wish takes away
      // the moth line grows a step on each of its owner's turns: Petit Moth > Larvae > Cocoon > Great Moth > Perfectly Ultimate
      for (let i = 0; i < 5; i++) {
        const m = pl.mon[i], next = m && Effects.evolve[m.id];
        if (next && m.age >= 1 && this.live(m)) {
          const nm = new Monster(next, pl.index); nm.faceUp = m.faceUp; nm.pos = m.pos; nm.canAttack = true; nm.summonTurn = m.summonTurn; nm.control = m.control;
          pl.mon[i] = nm; this.toGrave(pl, m.id); this.emit("evolve", { player: pl.index, slot: i, id: next });
        }
      }
      // Doll of Demise rises again; Sinister Serpent slithers back to the hand
      for (const id of pl.revive) { const gi = pl.grave.lastIndexOf(id); if (gi >= 0 && pl.freeMonSlot() >= 0) { pl.grave.splice(gi, 1); Effects.summonFree(this, pl, id, "revive"); } }
      pl.revive = [];
      if (pl.serpent) { pl.serpent = false; const gi = pl.grave.lastIndexOf(475); if (gi >= 0) { pl.grave.splice(gi, 1); pl.hand.push(475); this.emit("retrieve", { player: pl.index, id: 475 }); } }
      if (!first || this.turnNo > 1) {
        // refill the hand to 5; a player who needs a card and has none left loses by deck-out
        if (pl.hand.length < 5) {
          if (pl.deck.length === 0) { this.emit("deckout", { player: pl.index }); this.end(1 - pl.index, "deckout"); return; }
          let n = 0; while (pl.hand.length < 5 && pl.deck.length > 0) { this.drawCard(pl, true); n++; }
          this.emit("drawn", { player: pl.index, n });
          if (this.winner !== null) return; // Exodia completed by the draw
        }
      }
      this.emit("turn", { player: pl.index, no: this.turnNo });
    }
    // true while the turn player still has to discard down to 5 before the turn can end
    mustDiscard(pl) { return pl.hand.length > 5; }
    endTurn() {
      if (this.winner !== null) return { ok: false, why: "Duel is over" };
      const pl = this.cur();
      // Card of Demise: three cards now, and the whole hand at the end of the turn - so the hand-size rule steps
      // aside, there is nothing left to discard down to
      const demise = pl.demise === this.turnNo;
      if (!demise && this.mustDiscard(pl)) return { ok: false, why: "Discard down to 5" };
      if (demise) {
        pl.demise = 0;
        while (pl.hand.length) { const id = pl.hand.pop(); this.toGrave(pl, id); this.onDiscard(pl, id); }
        this.emit("demise", { player: pl.index });
      }
      if (this.acted) this.quietTurns = 0; else this.quietTurns++;
      this.acted = false; this.forceEnd = false;
      this.turn = 1 - this.turn;
      this.startTurn(false);
      return { ok: true };
    }
    // ---------------------------------------------------------- summoning
    // The Toons and The Fiend Megacyber arrive as special summons: they never use up the normal summon
    canSummon(pl, handIdx) {
      const c = CardDB.get(pl.hand[handIdx]);
      if (!c || c.kind !== "M") return { ok: false, why: "Not a monster" };
      if (this.forceEnd) return LOCKED;
      const cond = Effects.condFree[c.id] && Effects.condFree[c.id](this, pl);
      // Anything in `freeSummon` arrives as an EXTRA summon: it never uses up the normal one, and it pays whatever
      // that table says off your own field. The Toons have no other way in at all - they cannot be normal summoned
      // and they cannot be set - and each of them costs one offering. (The user's rule, 2026-09-24.)
      const cost = Effects.freeSummon[c.id];
      const free = cost !== undefined || cond;
      if (pl.summoned && !free) return { ok: false, why: "Already summoned" };
      if (!free && this.p.some((p) => p.mon.some((m) => m && m.id === 794 && this.live(m)))) return { ok: false, why: "Summons are sealed" };
      const need = cond ? 0 : cost !== undefined ? cost : CardDB.tributesFor(c);
      const have = pl.monsters().length;
      if (need > have) return { ok: false, why: "Need " + need + " offering" + (need > 1 ? "s" : "") };
      if (need === 0 && pl.freeMonSlot() < 0) return { ok: false, why: "Field is full" };
      return { ok: true, need, free };
    }
    summon(pl, handIdx, pos, tributeSlots) {
      const chk = this.canSummon(pl, handIdx);
      if (!chk.ok) return chk;
      tributeSlots = tributeSlots || [];
      if (tributeSlots.length < chk.need) return { ok: false, why: "Need " + chk.need + " offerings" };
      const id = pl.hand[handIdx];
      let slot = pl.freeMonSlot();
      for (const s of tributeSlots.slice(0, chk.need)) {
        const m = pl.mon[s]; if (!m) continue;
        this.destroyMonster(m, "offer"); if (slot < 0) slot = s;
      }
      if (slot < 0) slot = pl.freeMonSlot();
      pl.hand.splice(handIdx, 1);
      const m = new Monster(id, pl.index);
      m.pos = pos === "def" ? "def" : "atk"; m.faceUp = m.pos === "atk" || chk.free; m.canAttack = m.pos === "atk"; m.summonTurn = this.turnNo;
      if (id === 797 || id === 362) { m.pos = "def"; m.faceUp = true; m.canAttack = true; } // they always defend, and attack from there
      pl.mon[slot] = m; if (!chk.free) pl.summoned = true;
      this.emit("summon", { player: pl.index, slot, id, pos: m.pos, special: !!chk.free });
      this.afterSummon(pl, m, !chk.free);
      return { ok: true, slot };
    }
    afterSummon(pl, m, normal) {
      if (m.id === 616) m.courageUntil = this.turnNo;                       // Hourglass of Courage: doubled on the turn it arrives
      if (!normal || this.jinzoOut()) return;                               // Trap Hole only opens under a normal summon
      const opp = this.opp(pl);
      for (let i = 0; i < 5; i++) {
        const sp = opp.spells[i]; if (!sp) continue;
        const t = Effects.trap[sp.id]; if (!t || !t.onSummon || !t.onSummon(this, opp, m)) continue;
        sp.faceUp = true; this.emit("trap", { player: opp.index, id: sp.id, slot: i, target: m.id });
        this.toGrave(opp, sp.id); opp.spells[i] = null;
        this.destroyMonster(m, "trap");
        return;
      }
    }
    discard(pl, handIdx) {
      const id = pl.hand[handIdx]; if (id === undefined) return { ok: false };
      pl.hand.splice(handIdx, 1); this.toGrave(pl, id);
      this.emit("discard", { player: pl.index, id });
      this.onDiscard(pl, id);
      return { ok: true };
    }
    // a card thrown out of a hand by an effect (the enemy's Spy or Monster Eye, White Magical Hat, Morphing Jar)
    discardFromHand(pl, idx, why) {
      const id = pl.hand[idx]; if (id === undefined) return false;
      pl.hand.splice(idx, 1); this.toGrave(pl, id);
      this.emit("discard", { player: pl.index, id, why: why || "spy" });
      this.onDiscard(pl, id);
      return true;
    }
    // the player's pick from the revealed enemy hand (see Effects.peekAndDiscard); the computer picks on its own
    resolvePick(pl, idx) {
      if (!this.pendingPick || this.pendingPick.by !== pl.index) return { ok: false };
      this.pendingPick = null;
      const o = this.opp(pl); if (idx === undefined || idx === null) idx = Effects.bestDiscard(o.hand);
      this.discardFromHand(o, Math.max(0, Math.min(o.hand.length - 1, idx)), "spy");
      return { ok: true };
    }
    // ---------------------------------------------------------- fusion (in the hand)
    // handIdx is placed onto targetIdx. Success: both leave, the fused monster joins the hand and can be summoned
    // or set like any other card. Failure: nothing is lost, but no more fusing this turn.
    fuseHand(pl, handIdx, targetIdx) {
      if (handIdx === targetIdx) return { ok: false, why: "Invalid" };
      if (this.forceEnd) return LOCKED;
      if (pl.fuseLocked) return { ok: false, why: "No more fusing" };
      const a = pl.hand[targetIdx], b = pl.hand[handIdx];
      const ca = CardDB.get(a), cb = CardDB.get(b);
      if (!ca || !cb || ca.kind !== "M" || cb.kind !== "M") return { ok: false, why: "Monsters only" };
      const res = CardDB.fuse(a, b);
      this.acted = true;
      if (res) {
        const hi = Math.max(handIdx, targetIdx), lo = Math.min(handIdx, targetIdx);
        pl.hand.splice(hi, 1); pl.hand.splice(lo, 1);
        this.toGrave(pl, a); this.toGrave(pl, b);
        pl.hand.push(res); pl.stats.fusions++;
        this.emit("fuse", { player: pl.index, slot: -1, a, b, result: res });
        return { ok: true, result: res };
      }
      pl.fuseLocked = true;
      this.emit("fusefail", { player: pl.index, slot: -1, a, b });
      return { ok: true, result: 0 };
    }
    // fuse a hand monster onto one of our field monsters: the result takes that monster's place (face-up, same
    // position, still able to attack if the old one could); a monster that attacked this turn can't be fused
    fuseField(pl, handIdx, slot) {
      if (this.forceEnd) return LOCKED;
      if (pl.fuseLocked) return { ok: false, why: "No more fusing" };
      const m = pl.mon[slot]; if (!m) return { ok: false, why: "No monster there" };
      if (m.control) return { ok: false, why: "Not your monster" };
      if (m.attackedThisTurn) return { ok: false, why: "It attacked" };
      const b = pl.hand[handIdx], cb = CardDB.get(b);
      if (!cb || cb.kind !== "M") return { ok: false, why: "Monsters only" };
      const res = CardDB.fuse(m.id, b);
      this.acted = true;
      if (res) {
        pl.hand.splice(handIdx, 1); this.toGrave(pl, b); this.toGrave(pl, m.id);
        const nm = new Monster(res, pl.index);
        nm.faceUp = true; nm.pos = m.pos; nm.canAttack = m.canAttack; nm.summonTurn = m.summonTurn; nm.turnedThisTurn = m.turnedThisTurn;
        nm.frozen = m.frozen; nm.sleep = m.sleep; nm.age = m.age;
        pl.mon[slot] = nm; pl.stats.fusions++;
        this.emit("fuse", { player: pl.index, slot, a: m.id, b, result: res });
        return { ok: true, result: res };
      }
      pl.fuseLocked = true;
      this.emit("fusefail", { player: pl.index, slot, a: m.id, b });
      return { ok: true, result: 0 };
    }
    // ---------------------------------------------------------- spells / traps / rituals
    setSpell(pl, handIdx) {
      const id = pl.hand[handIdx]; const c = CardDB.get(id);
      if (!c || c.kind === "M") return { ok: false, why: "Not a spell card" };
      if (this.forceEnd) return LOCKED;
      const slot = pl.freeSpellSlot();
      if (slot < 0) return { ok: false, why: "No space" };
      pl.hand.splice(handIdx, 1);
      pl.spells[slot] = { id, faceUp: false };
      this.emit("set", { player: pl.index, slot, id });
      return { ok: true, slot };
    }
    // activate a spell card from the hand (handIdx) or from a spell slot (slot); target = own monster slot for equips
    activate(pl, src, target) {
      let id;
      if (src.hand !== undefined) id = pl.hand[src.hand]; else id = pl.spells[src.slot] && pl.spells[src.slot].id;
      const c = CardDB.get(id);
      if (!c) return { ok: false, why: "Invalid" };
      if (this.forceEnd) return LOCKED;
      if (c.kind === "T") return { ok: false, why: "Traps are set" };
      if (c.kind === "R") return this.ritual(pl, src, id);
      const fx = Effects.magic[id];
      if (!fx) return { ok: false, why: "No effect" };
      if (fx.can && !fx.can(this, pl, target)) return { ok: false, why: fx.fail || "Can't use it now" }; // e.g. no room, empty enemy hand
      if (fx.target === "ownMonster") {
        const m = target !== undefined ? pl.mon[target] : null;
        if (!m) return { ok: false, why: "Choose a monster" };
        if (CardDB.isEquip(id) && !CardDB.equipFits(id, this.liveCard(m))) {
          // equip does not fit: the card is wasted
          this.consumeSpell(pl, src);
          this.emit("magic", { player: pl.index, id, fail: true });
          return { ok: true, fail: true };
        }
      }
      const opp0 = this.opp(pl);
      const paladin = opp0.mon.find((m) => m && m.id === 802 && !m.shieldUsed && this.live(m));
      if (paladin && opp0.hand.length) {
        this.consumeSpell(pl, src); this.acted = true;
        paladin.shieldUsed = true; paladin.faceUp = true;
        this.emit("magic", { player: pl.index, id });
        this.discardFromHand(opp0, Effects.bestDiscard(opp0.hand), "paladin");
        this.emit("negatespell", { player: opp0.index, id: 802, spell: id });
        return { ok: true, negated: true };
      }
      this.consumeSpell(pl, src); this.acted = true;
      this.emit("magic", { player: pl.index, id });
      this.ladyOfFaith();
      const traps = !this.jinzoOut();
      // Goblin Fan reflects damage spells
      if (fx.kind === "damage" && traps) {
        const opp = this.opp(pl);
        const gf = opp.spells.findIndex((s) => s && s.id === 687);
        if (gf >= 0) {
          this.revealSpell(opp, gf); this.emit("trap", { player: opp.index, id: 687 });
          this.toGrave(opp, 687); opp.spells[gf] = null;
          this.damage(pl, fx.amount, "reflect");
          return { ok: true };
        }
      }
      // Anti Raigeki reflects Raigeki
      if (id === 337 && traps) {
        const opp = this.opp(pl);
        const ar = opp.spells.findIndex((s) => s && s.id === 782);
        if (ar >= 0) {
          this.revealSpell(opp, ar); this.emit("trap", { player: opp.index, id: 782 });
          this.toGrave(opp, 782); opp.spells[ar] = null;
          for (const m of pl.monsters()) this.destroyMonster(m, "raigeki");
          return { ok: true };
        }
      }
      // Reverse Trap turns power-ups into power-downs
      if (fx.kind === "equip" && traps) {
        const opp = this.opp(pl);
        const rt = opp.spells.findIndex((s) => s && s.id === 689);
        if (rt >= 0) {
          this.revealSpell(opp, rt); this.emit("trap", { player: opp.index, id: 689 });
          this.toGrave(opp, 689); opp.spells[rt] = null;
          const m = pl.mon[target]; m.levels -= (fx.levels || 1); this.toGrave(pl, id);
          this.emit("powerdown", { player: pl.index, slot: target, id: m.id });
          return { ok: true };
        }
      }
      this.effectSource = { spell: id };
      fx.use(this, pl, target, id);
      this.effectSource = null;
      return { ok: true };
    }
    ladyOfFaith() { for (const p of this.p) for (const m of p.monsters()) if (m.id === 612 && this.live(m)) this.heal(p, 500); }
    consumeSpell(pl, src) {
      if (src.hand !== undefined) pl.hand.splice(src.hand, 1);
      else pl.spells[src.slot] = null;
    }
    // Offerings may come from the field or the hand. Hand cards are used first (they are cheaper than a monster in play);
    // among field monsters the weakest go. The summoned monster needs a free slot or a slot freed by an offering.
    // All-seeing goddess, Beastking of the swamp and Versago the destroyer can stand in for a named offering.
    ritual(pl, src, id) {
      const r = Effects.ritual[id];
      if (!r) return { ok: false, why: "No effect" };
      const spellHand = src.hand !== undefined ? src.hand : -1;
      // candidates: {kind:'hand', idx, id, atk} and {kind:'field', m, id, atk}
      const cands = [];
      pl.hand.forEach((cid, i) => { const c = CardDB.get(cid); if (i !== spellHand && c && c.kind === "M") cands.push({ kind: "hand", idx: i, id: cid, atk: c.atk }); });
      for (const m of pl.monsters()) if (!m.control) cands.push({ kind: "field", m, id: m.id, atk: this.atk(m) });
      const chosen = [];
      const pick = (pred) => cands.find((x) => pred(x) && !chosen.includes(x));
      const liveTy = (x) => (x.kind === "field" ? x.m.ty : CardDB.get(x.id).ty);
      if (r.oneOf) {   // any one of the named cards opens it
        const c = pick((x) => r.oneOf.includes(x.id) && x.kind === "hand") || pick((x) => r.oneOf.includes(x.id));
        if (!c) return { ok: false, why: "Need " + CardDB.get(r.oneOf[0]).name.slice(0, 12) };
        chosen.push(c);
      }
      for (const need of r.need) {
        const c = pick((x) => x.id === need && x.kind === "hand") || pick((x) => x.id === need) || pick((x) => Effects.substitute.has(x.id) && x.kind === "hand") || pick((x) => Effects.substitute.has(x.id));
        if (!c) return { ok: false, why: "Need " + CardDB.get(need).name.slice(0, 12) };
        chosen.push(c);
      }
      const extra = cands.filter((x) => !chosen.includes(x) && (!r.anyType || liveTy(x) === r.anyType));
      if (extra.length < r.any) return { ok: false, why: "Need " + r.any + " more " + (r.anyType || "monster") + (r.any > 1 ? "s" : "") };
      extra.sort((a, b) => (a.kind === b.kind ? a.atk - b.atk : a.kind === "hand" ? -1 : 1));
      chosen.push(...extra.slice(0, r.any));
      if (pl.freeMonSlot() < 0 && !chosen.some((x) => x.kind === "field")) return { ok: false, why: "Field is full" };
      // pay: spell first, then hand offerings (highest index first so positions stay valid), then field offerings
      this.consumeSpell(pl, src); this.toGrave(pl, id); this.ladyOfFaith();
      const handIdx = chosen.filter((x) => x.kind === "hand").map((x) => x.idx > spellHand && spellHand >= 0 ? x.idx - 1 : x.idx).sort((a, b) => b - a);
      for (const i of handIdx) { const cid = pl.hand.splice(i, 1)[0]; this.toGrave(pl, cid); this.emit("discard", { player: pl.index, id: cid, offer: true }); }
      let slot = -1;
      for (const x of chosen) if (x.kind === "field") { const s = pl.mon.indexOf(x.m); this.destroyMonster(x.m, "offer"); if (slot < 0) slot = s; }
      if (slot < 0) slot = pl.freeMonSlot();
      const m = new Monster(r.result, pl.index); m.faceUp = true; m.pos = "atk"; m.canAttack = true; m.summonTurn = this.turnNo;
      pl.mon[slot] = m; this.acted = true;
      this.emit("ritual", { player: pl.index, slot, id, result: r.result });
      this.afterSummon(pl, m);
      return { ok: true };
    }
    // ---------------------------------------------------------- position / specials
    changePos(pl, slot) {
      const m = pl.mon[slot]; if (!m) return { ok: false };
      if (this.forceEnd) return LOCKED;
      if (m.id === 797 || m.id === 362) return { ok: false, why: "Always defends" };
      if (m.turnedThisTurn) return { ok: false, why: "Already changed" };
      if (m.summonTurn === this.turnNo) return { ok: false, why: "Not this turn" };
      if (m.attackedThisTurn) return { ok: false, why: "It attacked" };
      if (m.frozen > 0 || m.sleep > 0) return { ok: false, why: "Can't move" };
      m.pos = m.pos === "atk" ? "def" : "atk"; m.faceUp = true; m.turnedThisTurn = true;
      this.emit("pos", { player: pl.index, slot, pos: m.pos });
      return { ok: true };
    }
    special(pl, slot, alt) {
      const m = pl.mon[slot]; if (!m) return { ok: false };
      if (this.forceEnd) return LOCKED;
      const fx = alt ? Effects.special2[m.id] : Effects.special[m.id];
      if (!fx) return { ok: false, why: "No effect" };
      if (this.negated(m)) return { ok: false, why: "Effects sealed" };
      if (m.frozen > 0 || m.sleep > 0) return { ok: false, why: "Can't move" };
      if (m.usedSpecial) return { ok: false, why: "Once per turn" };
      if (fx.once && pl.onceUsed.has(m.id)) return { ok: false, why: "Once per duel" };
      this.effectSource = { m };
      const at = this.events.length, atLog = this.log.length;
      const r = fx.use(this, pl, m, slot);
      this.effectSource = null;
      if (r === false) return { ok: false, why: fx.fail || "Can't use" };
      m.faceUp = true; m.usedSpecial = true; if (fx.once) pl.onceUsed.add(m.id); // a SPCL ability is once per turn and does not use up the attack
      const e = { type: "special", player: pl.index, slot, id: m.id, alt: !!alt }; // told before what it did
      this.events.splice(at, 0, e); this.log.splice(atLog, 0, e);
      return { ok: true };
    }
    // ---------------------------------------------------------- battle
    canAttackWith(pl, slot) {
      const m = pl.mon[slot]; if (!m) return { ok: false };
      if (this.forceEnd) return LOCKED;
      if (this.turnNo === 1) return { ok: false, why: "No attack on turn 1" };
      if (pl.swords > 0) return { ok: false, why: "Swords of Light" };
      if (pl.noAttack > 0) return { ok: false, why: "Cannot attack" };
      if (!m.canAttack) return { ok: false, why: "Can't attack now" };
      if (m.frozen > 0 || m.sleep > 0) return { ok: false, why: "Can't move" };
      if (m.pos !== "atk" && !((m.id === 797 || m.id === 362) && this.live(m))) return { ok: false, why: "In defence" };
      if (m.id === 380 && m.summonTurn === this.turnNo) return { ok: false, why: "Not this turn" };
      return { ok: true };
    }
    attack(pl, slot, targetSlot) {
      const chk = this.canAttackWith(pl, slot); if (!chk.ok) return chk;
      const m = pl.mon[slot]; const opp = this.opp(pl);
      // a Toon under its own Toon World walks straight past the board and hits the Life Points
      const direct = (Effects.direct.has(m.id) || (Effects.TOONS.has(m.id) && this.field === 823 && this.fieldOwner === pl.index)) && this.live(m);
      let d = targetSlot !== null && targetSlot !== undefined && !direct ? opp.mon[targetSlot] : null;
      if (!d && opp.hasMonsters() && !direct) return { ok: false, why: "Choose a target" };
      if (d && !this.canTarget(d)) return { ok: false, why: "Can't be targeted" };
      // Toon World turns one attack a turn away from its owner
      if (this.field === 823 && this.fieldOwner === opp.index && !opp.toonGuard) {
        opp.toonGuard = true; m.faceUp = true; m.attackedThisTurn = true; m.attacksMade++; this.acted = true;
        this.emit("toonguard", { player: opp.index, id: 823, attacker: m.id });
        return { ok: true, negated: true };
      }
      m.faceUp = true; m.attackedThisTurn = true; m.attacksMade++; pl.stats.attacks++; this.acted = true;
      m.canAttack = m.id === 380 && this.live(m) && m.attacksMade < 3; // B.eyes Ultimate Dragon strikes three times a turn
      // the Millennium Shield stops the first enemy attack of every turn
      const shield = opp.mon.find((x) => x && x.id === 362 && !x.shieldUsed && this.live(x));
      if (shield) { shield.shieldUsed = true; shield.faceUp = true; this.emit("shieldwall", { player: opp.index, slot: opp.mon.indexOf(shield), attacker: m.id }); return { ok: true, negated: true }; }
      // trap check on the defender's side (Jinzo shuts every trap down)
      if (!this.jinzoOut()) for (let i = 0; i < 5; i++) {
        const s = opp.spells[i]; if (!s) continue;
        const t = Effects.trap[s.id]; if (!t || !t.onAttack) continue;
        if (t.onAttack(this, opp, m)) {
          s.faceUp = true; this.emit("trap", { player: opp.index, id: s.id, attacker: m.id, slot });
          this.toGrave(opp, s.id); opp.spells[i] = null;
          if (t.resolve) t.resolve(this, opp, m);
          if (t.destroysAttacker) { this.destroyMonster(m, "trap"); return { ok: true, trapped: true }; }
          return { ok: true, trapped: true };
        }
      }
      if (!d) {
        const dmg = this.atk(m);
        this.emit("attack", { player: pl.index, slot, targetSlot: -1, id: m.id, aAtk: dmg, direct: true });
        if (this.damage(opp, dmg, "direct")) this.afterBattleDamage(pl, m);
        return { ok: true, direct: true };
      }
      const wasFaceUp = d.faceUp;
      d.faceUp = true;
      // Reflect Bounder strikes whoever attacks it for the attacker's ATK - but only from face up. Its trigger is
      // "when this card is TARGETED for an attack", and targeting happens in the Battle Step, while a set monster
      // still has no effects at all; by the time the attack flips it, the Damage Step has started and the window has
      // gone. (The user's ruling, 2026-09-24, and the modern TCG's. The old 2004 rulings said the opposite, which is
      // what this engine was doing.)
      if (d.id === 756 && wasFaceUp && this.live(d)) { this.damage(pl, this.atk(m), "bounder"); if (this.winner !== null) return { ok: true }; }
      let A = this.atk(m), Datk = this.atk(d), Ddef = this.def(d);
      if (m.id === 478 && d.el === "Wind" && this.live(m)) A += 1000;                       // Insect Soldiers of the Sky
      if (d.id === 478 && m.el === "Wind" && this.live(d)) { Datk += 1000; Ddef += 1000; }
      const ev = this.emit("attack", { player: pl.index, slot, targetSlot, id: m.id, target: d.id, aAtk: A, dAtk: Datk, dDef: Ddef, dPos: d.pos, flip: !wasFaceUp });
      const ctxD = { battle: true, by: m, attacking: false }, ctxA = { battle: true, by: d, attacking: true };
      if (d.pos === "atk") {
        if (A > Datk) { ev.result = "win"; this.destroyMonster(d, "battle", ctxD); this.onKill(pl, m, Datk); if (this.damage(opp, A - Datk, "battle")) this.afterBattleDamage(pl, m); }
        else if (A < Datk) { ev.result = "lose"; this.destroyMonster(m, "battle", ctxA); this.damage(pl, Datk - A, "battle"); }
        else { ev.result = "tie"; this.destroyMonster(d, "battle", ctxD); this.destroyMonster(m, "battle", ctxA); }
      } else {
        if (A > Ddef) { ev.result = "win"; this.destroyMonster(d, "battle", ctxD); this.onKill(pl, m, Datk); }
        else if (A < Ddef) { ev.result = "bounce"; this.damage(pl, (Ddef - A) * (d.id === 748 && this.live(d) ? 2 : 1), "battle"); } // Stone Statue doubles the bounce
        else ev.result = "tie";
      }
      // Wall of Illusion sends whatever it fought back to the hand
      if (this.winner === null) {
        if (d.id === 769 && this.live(d) && pl.mon.includes(m)) Effects.bounce(this, m);
        if (m.id === 769 && this.live(m) && opp.mon.includes(d)) Effects.bounce(this, d);
      }
      return { ok: true };
    }
    onKill(pl, m, victimAtk) { // the attacker destroyed its target in battle
      if (this.winner !== null || !this.live(m)) return;
      if (m.id === 82) this.damage(this.opp(pl), Math.floor(victimAtk / 2), "redeyes");                       // Red-eyes B. Dragon
      if (m.id === 773 && pl.mon.includes(m)) { m.temp += 200; this.emit("powerup", { player: pl.index, slot: pl.mon.indexOf(m), id: m.id, levels: 0 }); } // Sword Hunter
    }
    afterBattleDamage(pl, m) { // battle damage reached the enemy's LP
      if (this.winner !== null || !this.live(m)) return;
      const o = this.opp(pl);
      if (m.id === 114 && o.hand.length) this.discardFromHand(o, Math.floor(Math.random() * o.hand.length), "hat"); // White Magical Hat
      if (m.id === 220) this.drawCard(pl);                                                                     // Masked Sorcerer
    }
    // ---------------------------------------------------------- misc queries used by UI/AI
    // the card as it stands on the field: the type can differ from the printed one (Parasite Paracide, Metalmorph)
    liveCard(m) { return m.ty === m.card.ty ? m.card : Object.assign({}, m.card, { ty: m.ty }); }
    handCards(pl) { return pl.hand.map((id) => CardDB.get(id)); }
    describeMonster(m) { return { atk: this.atk(m), def: this.def(m), el: m.el, ty: m.ty, lv: m.card.lv, name: m.card.name }; }
  }

  window.Duel = Duel; window.DuelPlayer = Player; window.DuelMonster = Monster; window.shuffleArray = shuffle;
})();
