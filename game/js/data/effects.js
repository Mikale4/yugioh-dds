// Card effects: spell cards, traps, ritual recipes and monster "SPCL" abilities.
(function () {
  const magic = {}, trap = {}, ritual = {}, special = {};
  const nameId = (n) => { const c = CardDB.all.find((x) => x.name === n); return c ? c.id : 0; };

  // ------------------------------------------------------------ helpers
  function destroyAll(duel, pl, pred, why) {
    let n = 0;
    for (const m of pl.monsters()) if (!pred || pred(m)) { duel.destroyMonster(m, why); n++; }
    return n;
  }
  function strongest(duel, pl) {
    let best = null;
    for (const m of pl.monsters()) if (!best || duel.atk(m) > duel.atk(best)) best = m;
    return best;
  }
  function steal(duel, pl, m, temp) {
    const opp = duel.opp(pl);
    const fs = pl.freeMonSlot(); if (fs < 0 || !m) return false;
    const os = opp.mon.indexOf(m); opp.mon[os] = null;
    const orig = m.control ? m.control.orig : opp.index;
    m.owner = pl.index; m.control = { orig, temp: !!temp };
    m.canAttack = true; m.faceUp = true; pl.mon[fs] = m;
    duel.emit("steal", { player: pl.index, slot: fs, from: os, id: m.id, temp: !!temp });
    return true;
  }

  // ------------------------------------------------------------ equips
  // who each equip fits (must match CardDB's EQUIP table): a card played on anything else is wasted
  const EQUIP_TEXT = {
    301: "Warriors, not Shadow ones", 302: "Shadow Warriors", 303: "Fiends and Shadow monsters", 304: "Fiends and Beast-Warriors",
    305: "Insects", 306: "Insects", 307: "Elves and Light Magicians", 308: "Beasts", 309: "Aqua, Reptile and Fish", 310: "Plants",
    311: "Shadow Magicians", 312: "Fairies", 313: "Beasts, Beast-Warriors, Dinos (not Shadow)",
    314: "Shadow Beasts, Beast-Warriors and Fiends", 315: "Dragons", 316: "female monsters", 317: "female monsters",
    319: "Beasts and Beast-Warriors", 321: "female and Shadow monsters", 322: "Zombies", 323: "Magicians, not Fiend ones",
    324: "Rock and Pyro monsters", 325: "Machines", 326: "Dinosaurs", 327: "Winged Beasts", 328: "Aqua, Fish and Sea Dragons",
    651: "any monster", 654: "Pyro monsters", 659: "Fairies", 668: "Light monsters",
  };
  const EQUIP_IDS = Object.keys(EQUIP_TEXT).map(Number);
  for (const id of EQUIP_IDS) {
    magic[id] = { kind: "equip", target: "ownMonster", levels: 1, text: "Power up 500: " + EQUIP_TEXT[id], use(duel, pl, slot) {
      const m = pl.mon[slot]; m.levels += 1; m.equips.push(id); m.faceUp = true;
      duel.emit("powerup", { player: pl.index, slot, id: m.id, levels: 1 });
    } };
  }
  magic[657] = { kind: "equip", target: "ownMonster", levels: 0, text: "Doubles the ATK of any monster", use(duel, pl, slot) {
    const m = pl.mon[slot]; m.doubled = true; m.equips.push(657); m.faceUp = true; duel.emit("powerup", { player: pl.index, slot, id: m.id, levels: 0, doubled: true });
  } };
  magic[318] = { kind: "equip", target: "ownMonster", levels: 1, text: "Harpie Lady > Harpie Lady Sisters. Others: power up 500", use(duel, pl, slot) {
    const m = pl.mon[slot];
    if (m.id === 62) { const nm = new DuelMonster(63, pl.index); nm.faceUp = true; nm.pos = m.pos; nm.canAttack = m.canAttack; nm.summonTurn = m.summonTurn; pl.mon[slot] = nm; duel.toGrave(pl, 62); duel.emit("evolve", { player: pl.index, slot, id: 63 }); }
    else { m.levels += 1; m.equips.push(318); duel.emit("powerup", { player: pl.index, slot, id: m.id, levels: 1 }); }
  } };
  magic[658] = { kind: "equip", target: "ownMonster", levels: 1, text: "Zoa, Red-eyes > Metal forms. Others: Machine, power up 500", use(duel, pl, slot) {
    const m = pl.mon[slot];
    const morph = { 391: 392, [nameId("Red-eyes B. Dragon")]: 742 };
    if (morph[m.id]) { const nm = new DuelMonster(morph[m.id], pl.index); nm.faceUp = true; nm.pos = m.pos; nm.canAttack = m.canAttack; nm.summonTurn = m.summonTurn; pl.mon[slot] = nm; duel.toGrave(pl, m.id); duel.emit("evolve", { player: pl.index, slot, id: nm.id }); }
    else { m.tyOverride = "Machine"; m.levels += 1; m.equips.push(658); m.faceUp = true; duel.emit("powerup", { player: pl.index, slot, id: m.id, levels: 1 }); }
  } };
  // The Labyrinth used to hand out a Wall Shadow nobody could otherwise summon; it now calls the wall itself out of
  // wherever it is - deck, hand or graveyard (the user's rework, 2026-09-23) - and the wall's own ability brings the
  // rest of the maze, Wall Shadow included, out after it. The wall is Limited to one, so the spell is how a maze
  // deck finds it, and finds it again after it dies.
  const wallPile = (pl) => (pl.deck.includes(366) ? pl.deck : pl.grave.includes(366) ? pl.grave : pl.hand.includes(366) ? pl.hand : null);
  magic[652] = { kind: "misc", target: "none", text: "Summons Labyrinth Wall from your deck, hand or grave", fail: "No Labyrinth Wall to call",
    can: (duel, pl) => pl.freeMonSlot() >= 0 && !!wallPile(pl), use(duel, pl) {
      const s = pl.freeMonSlot(); if (s < 0) return false;
      const pile = wallPile(pl); if (!pile) return false;
      pile.splice(pile.indexOf(366), 1);
      if (pile === pl.deck) shuffleArray(pl.deck);
      const nm = new DuelMonster(366, pl.index); nm.faceUp = true; nm.pos = "def"; nm.canAttack = true; nm.summonTurn = duel.turnNo; pl.mon[s] = nm;
      duel.emit("summon", { player: pl.index, slot: s, id: 366, pos: "def", special: true, why: "maze" });
      duel.afterSummon(pl, nm);
    } };
  // ------------------------------------------------------------ fields
  for (const id of [330, 331, 332, 333, 334, 335]) {
    const f = CardDB.fieldInfo(id), fieldText = "Field: " + f.plus.join(", ") + " x1.3" + (f.minus.length ? ". " + f.minus.join(", ") + " x0.7" : "");
    magic[id] = { kind: "field", target: "none", text: fieldText, use(duel, pl) { duel.setField(id, pl.index); } };
  }
  // ------------------------------------------------------------ heal / damage
  const HEAL = { 338: 200, 339: 500, 340: 1000, 341: 2000, 342: 5000 };
  for (const id in HEAL) magic[id] = { kind: "heal", target: "none", amount: HEAL[id], text: "Recover " + HEAL[id] + " LP", use(duel, pl) { duel.heal(pl, HEAL[id]); } };
  const DMG = { 343: 50, 344: 100, 345: 200, 346: 500, 347: 1000 };
  for (const id in DMG) magic[id] = { kind: "damage", target: "none", amount: DMG[id], text: "Enemy loses " + DMG[id] + " LP", use(duel, pl) { duel.damage(duel.opp(pl), DMG[id], "magic"); } };
  magic[788] = { kind: "damage", target: "none", amount: 0, text: "Enemy loses 200 LP per card in their hand", use(duel, pl) { duel.damage(duel.opp(pl), 200 * duel.opp(pl).hand.length, "magic"); } };
  // ------------------------------------------------------------ destruction
  magic[336] = { kind: "destroy", target: "none", text: "Destroys every monster on the field, yours too", use(duel, pl) { destroyAll(duel, pl, null, "darkhole"); destroyAll(duel, duel.opp(pl), null, "darkhole"); } };
  magic[337] = { kind: "destroy", target: "none", text: "Destroys every enemy monster", use(duel, pl) { destroyAll(duel, duel.opp(pl), null, "raigeki"); } };
  const TYPE_KILL = { 329: "Dragon", 653: "Warrior", 656: "Zombie", 660: "Machine", 662: "Insect", 663: "Rock", 664: "Fish", 786: "Fiend", 787: "Magician" };
  for (const id in TYPE_KILL) magic[id] = { kind: "destroy", target: "none", text: "Destroys every enemy " + TYPE_KILL[id], use(duel, pl) { destroyAll(duel, duel.opp(pl), (m) => m.ty === TYPE_KILL[id], "magic"); } };
  magic[661] = { kind: "destroy", target: "none", text: "Destroys enemy monsters with 1500 ATK or more", use(duel, pl) { destroyAll(duel, duel.opp(pl), (m) => duel.atk(m) >= 1500, "magic"); } };
  // ------------------------------------------------------------ control / misc
  magic[348] = { kind: "misc", target: "none", text: "Reveals enemy monsters. They can't attack for 3 turns", use(duel, pl) { const o = duel.opp(pl); o.swords = 3; for (const m of o.monsters()) m.faceUp = true; } };
  magic[349] = { kind: "misc", target: "none", text: "All enemy monsters lose 500 ATK and DEF", use(duel, pl) { for (const m of duel.opp(pl).monsters()) { m.temp -= 500; m.faceUp = true; } } };
  magic[669] = { kind: "misc", target: "none", text: "All enemy monsters lose 1000 ATK and DEF", use(duel, pl) { for (const m of duel.opp(pl).monsters()) { m.temp -= 1000; m.faceUp = true; } } };
  magic[350] = { kind: "misc", target: "none", text: "Reveals every face-down monster", use(duel, pl) { for (const p of duel.p) for (const m of p.monsters()) m.faceUp = true; } };
  magic[320] = { kind: "misc", target: "none", text: "Turns all enemy monsters to attack position", use(duel, pl) { for (const m of duel.opp(pl).monsters()) { m.pos = "atk"; m.faceUp = true; } } };
  magic[655] = { kind: "misc", target: "none", text: "Removes every power-up from enemy monsters", use(duel, pl) { for (const m of duel.opp(pl).monsters()) { m.levels = 0; m.temp = 0; m.tyOverride = null; m.equips = []; } } };
  magic[672] = { kind: "misc", target: "none", text: "Destroys every enemy spell and trap, equips and the field with them", use(duel, pl) {
    const o = duel.opp(pl);
    const fake = o.spells.findIndex((s) => s && s.id === 690);
    if (fake >= 0) { duel.toGrave(o, 690); o.spells[fake] = null; duel.emit("duster", { player: o.index, fake: true }); return; } // Fake Trap takes the hit
    for (let i = 0; i < 5; i++) if (o.spells[i]) { duel.toGrave(o, o.spells[i].id); o.spells[i] = null; }
    for (const m of o.monsters()) for (const id of m.equips.slice()) duel.removeEquip(o, m, id);   // their power-ups go too
    duel.clearFieldCard();                                                                        // and the field with them
    duel.emit("duster", { player: o.index });
  } };
  magic[781] = { kind: "misc", target: "none", text: "Take the enemy's strongest monster for 1 turn", use(duel, pl) { const m = strongest(duel, duel.opp(pl)); if (m) steal(duel, pl, m, true); } };
  magic[784] = { kind: "misc", target: "none", text: "Take the enemy's strongest monster for good", use(duel, pl) { const m = strongest(duel, duel.opp(pl)); if (m) steal(duel, pl, m, false); } };
  magic[785] = { kind: "misc", target: "ownMonster", text: "Copies the chosen monster. Kuriboh: fills the empty slots", fail: "Field is full", can: (duel, pl) => pl.freeMonSlot() >= 0, use(duel, pl, slot) {
    const m = pl.mon[slot]; if (!m) return false;
    if (pl.freeMonSlot() < 0) return false;
    const copies = m.id === 58 ? 5 : 1; let made = 0;
    for (let i = 0; i < 5 && made < copies; i++) if (!pl.mon[i]) { const k = new DuelMonster(m.id, pl.index); k.faceUp = true; k.pos = m.pos; k.canAttack = true; k.summonTurn = duel.turnNo; pl.mon[i] = k; made++; duel.emit("summon", { player: pl.index, slot: i, id: m.id, pos: m.pos, special: true }); }
  } };
  magic[789] = { kind: "misc", target: "none", text: "Draw 2 cards from your deck", use(duel, pl) { duel.drawCard(pl); duel.drawCard(pl); } };
  // worth of a card in an enemy hand, for choosing what to make them throw away
  const SPELL_WORTH = { 337: 3000, 784: 2600, 342: 600, 336: 2400, 348: 2200, 781: 2200, 661: 2200, 789: 2000, 669: 1400, 672: 1300, 657: 2400, 785: 1500, 790: 1500, 652: 1300, 814: 2000, 813: 1800, 815: 900,
    818: 2400, 819: 1600, 816: 1800, 820: 1300, 822: 1200, 823: 1500 };
  function handWorth(id) { const c = CardDB.get(id); if (!c) return 0; if (c.kind === "M") return c.atk + (bonus[id] || 0) / 2; if (c.kind === "R") { const r = ritual[id]; return r ? CardDB.get(r.result).atk - 800 : 300; } return SPELL_WORTH[id] || 400; }
  function bestDiscard(hand) { let best = 0; for (let i = 1; i < hand.length; i++) if (handWorth(hand[i]) > handWorth(hand[best])) best = i; return best; }
  // look at the enemy hand and throw one card away: the computer picks the most valuable card, the player is asked
  function peekAndDiscard(duel, pl) {
    const o = duel.opp(pl); if (!o.hand.length) return false;
    if (pl.ai) { duel.emit("reveal", { player: pl.index, hand: o.hand.slice() }); duel.discardFromHand(o, bestDiscard(o.hand), "spy"); }
    else { duel.emit("reveal", { player: pl.index, hand: o.hand.slice(), pick: true }); duel.pendingPick = { by: pl.index }; }
    return true;
  }
  magic[790] = { kind: "misc", target: "none", text: "Look at the enemy's hand and throw away 1 card of your choice", fail: "Enemy hand is empty", can: (duel, pl) => duel.opp(pl).hand.length > 0, use: peekAndDiscard };

  // ------------------------------------------------------------ traps
  const HOLES = { 681: 500, 682: 1000, 683: 1500, 684: 2000, 685: 3000 };
  for (const id in HOLES) trap[id] = { destroysAttacker: true, text: "Destroys an attacking monster with ATK under " + HOLES[id], onAttack(duel, pl, m) { return duel.atk(m) < HOLES[id]; } };
  trap[686] = { destroysAttacker: true, text: "Destroys the attacking monster, whatever its ATK", onAttack() { return true; } };
  trap[687] = { text: "Enemy damage spells hurt the enemy instead" }; trap[688] = { text: "Enemy LP recovery becomes damage to them" }; trap[689] = { text: "Enemy power-ups become power-downs" };
  trap[782] = { text: "Enemy Raigeki destroys their own monsters instead" };

  // ------------------------------------------------------------ rituals
  // a ritual card needs exactly its named offering(s), from the hand or the field - nothing extra
  const R = (need, result) => ({ need, any: 0, result });
  // `oneOf` = any one of these will do; `anyType` = the extra offerings have to be of that type. Two rituals asked
  // for named cards nobody could ever assemble (three Blue-eyes while Blue-eyes is Limited to one, and all three
  // Gate Guardian pieces at once), so they take a named card plus two others instead (the user's rule, 2026-09-23).
  const RAny = (need, anyN, result, extra) => Object.assign({ need, any: anyN, result }, extra || {});
  Object.assign(ritual, {
    665: R([296], 362), 666: R([29], 357), 667: RAny([], 2, 374, { oneOf: [371, 372, 373] }), 670: R([38], 364), 671: R([377], 360),
    673: R([403], 356), 674: R([595, 186], 365), 675: RAny([1], 2, 380, { anyType: "Dragon" }), 676: R([249], 701), 677: R([295], 702),
    678: R([3], 703), 679: R([160, 161], 704), 680: R([571], 705), 691: R([10], 706), 692: R([449], 710),
    693: R([102], 720), 694: R([269], 709), 695: R([166], 715), 696: R([52], 717), 697: R([621], 716),
    698: R([638], 708), 699: R([146], 719), 700: R([441], 718), 722: R([35], 721), 783: R([730], 731),
  });
  // "Offer <named monsters>. Gets <result>" (the two-card offerings get a shorter wording so it fits the card box)
  const RITUAL_NEEDS = { 674: "both Fiend Reflections", 679: "M-warrior #1 & #2",
    667: "Sanga, Kazejin or Suijin and 2 more monsters", 675: "B.eyes White Dragon and 2 more Dragons" };
  const ritualText = (id) => {
    const r = ritual[id]; if (!r) return "";
    let needs = RITUAL_NEEDS[id];
    if (!needs) { const cnt = {}; for (const n of r.need) cnt[n] = (cnt[n] || 0) + 1; needs = Object.keys(cnt).map((n) => CardDB.get(Number(n)).name + (cnt[n] > 1 ? " x" + cnt[n] : "")).join(", "); }
    return "Offer " + needs + ". Gets " + CardDB.get(r.result).name;
  };
  const ritualSpellFor = {};
  for (const sid in ritual) ritualSpellFor[ritual[sid].result] = Number(sid);

  // ------------------------------------------------------------ monster specials
  // a monster's second SPCL ability (Time Wizard's roulette)
  const special2 = {};
  // The coin flip is gone: the Wizard simply ages the enemy's board to dust, once a duel (the user's rework,
  // 2026-09-23). Joey's other half of the card - the Baby Dragon that grows into Thousand Dragon - is untouched.
  special2[16] = { name: "Time", text: "Once per duel: destroys every enemy monster", fail: "No enemy monsters", once: true,
    use(duel, pl) { return destroyAll(duel, duel.opp(pl), null, "time") > 0; } };
  special[402] = { name: "Eye", text: "Look at the enemy's hand and throw away 1 card of your choice", fail: "Enemy hand is empty", use: peekAndDiscard };
  special[26] = { name: "Axe", text: "Destroys the strongest enemy Pyro monster", fail: "No Pyro enemies", use(duel, pl) { return !!killStrongest(duel, duel.opp(pl), (m) => m.el === "Pyro" || m.ty === "Pyro", "special"); } };
  const callMountain = (duel, pl) => { if (duel.field === 332) return false; duel.setField(332, pl.index); return true; };
  special[39] = { name: "Peak", text: "Changes the field to Mountain (Dragon, WngBeast, Thunder x1.3)", fail: "Already Mountain", use: callMountain };
  special[37] = { name: "Peak", text: "Changes the field to Mountain (Dragon, WngBeast, Thunder x1.3)", fail: "Already Mountain", use: callMountain };
  special[74] = { name: "Quake", text: "Removes the field card: back to the plain Arena", fail: "Already Arena", use(duel, pl) { if (!duel.field) return false; duel.setField(0, pl.index); } };
  special[83] = { name: "Veil", text: "Hides all your monsters face-down again", use(duel, pl) { for (const m of pl.monsters()) m.faceUp = false; } };
  special[89] = { name: "Launch", text: "Sacrifices your best other monster: half its ATK as damage", fail: "Need another monster", use(duel, pl, self) {
    const others = pl.monsters().filter((m) => m !== self); if (!others.length) return false;
    others.sort((a, b) => duel.atk(b) - duel.atk(a)); const t = others[0]; const dmg = Math.floor(duel.atk(t) / 2);
    duel.destroyMonster(t, "launch"); duel.damage(duel.opp(pl), dmg, "launch");
  } };
  special[732] = { name: "Blast", text: "Destroys all your monsters: enemy loses half their ATK as LP", use(duel, pl, self) {
    let dmg = 0; for (const m of pl.monsters()) { if (m !== self) dmg += Math.floor(duel.atk(m) / 2); }
    for (const m of pl.monsters()) duel.destroyMonster(m, "blast");
    duel.damage(duel.opp(pl), dmg, "blast");
  } };
  special[723] = { name: "Spin", text: "Enemy's strongest monster gains or loses 500 ATK at random", fail: "No target", use(duel, pl) { const m = strongest(duel, duel.opp(pl)); if (!m) return false; m.temp += Math.random() < 0.5 ? -500 : 500; m.faceUp = true; } };
  special[48] = { name: "Search", text: "Draws a card from your deck", fail: "Deck is empty", use(duel, pl) { return duel.drawCard(pl); } };

  // ------------------------------------------------------------ monster effect helpers (the 2026-09 monster patch)
  const isRitualMon = (id) => Banlist.ritualOnly(id) && id !== 369;
  function strongestOf(duel, pl, pred) { let best = null; for (const m of pl.monsters()) if ((!pred || pred(m)) && (!best || duel.atk(m) > duel.atk(best))) best = m; return best; }
  // a special summon onto a free slot (face-up attack, may attack at once); null when the field is full
  function summonFree(duel, pl, id, why) {
    const s = pl.freeMonSlot(); if (s < 0) return null;
    const m = new DuelMonster(id, pl.index); m.faceUp = true; m.pos = "atk"; m.canAttack = true; m.summonTurn = duel.turnNo; pl.mon[s] = m;
    duel.emit("summon", { player: pl.index, slot: s, id, pos: "atk", special: true, why });
    duel.afterSummon(pl, m);
    return m;
  }
  // the best hand monster that fits goes to the field as a special summon
  function summonFromHand(duel, pl, pred) {
    if (pl.freeMonSlot() < 0) return false;
    let best = -1, bv = -1;
    pl.hand.forEach((id, i) => { const c = CardDB.get(id); if (c && c.kind === "M" && pred(c) && c.atk > bv) { bv = c.atk; best = i; } });
    if (best < 0) return false;
    const id = pl.hand.splice(best, 1)[0];
    return !!summonFree(duel, pl, id, "hand");
  }
  // the best matching deck card comes to the hand (rank: higher is better); the deck is shuffled afterwards
  function fromDeck(duel, pl, pred, rank) {
    let best = -1, bv = -Infinity;
    pl.deck.forEach((id, i) => { const c = CardDB.get(id); if (!c || !pred(c, id)) return; const v = rank ? rank(c) : (c.atk || 0); if (v > bv) { bv = v; best = i; } });
    if (best < 0) return false;
    const id = pl.deck.splice(best, 1)[0]; pl.hand.push(id); shuffleArray(pl.deck);
    duel.emit("search", { player: pl.index, id }); duel.checkExodia(pl);
    return true;
  }
  function fromGrave(duel, pl, pred) {
    for (let i = pl.grave.length - 1; i >= 0; i--) { const c = CardDB.get(pl.grave[i]); if (c && pred(c)) { pl.grave.splice(i, 1); pl.hand.push(c.id); duel.emit("retrieve", { player: pl.index, id: c.id }); return true; } }
    return false;
  }
  // a field monster goes back to its owner's hand (a stolen one to its original owner)
  function bounce(duel, m) {
    const pl = duel.p[m.owner], slot = pl.mon.indexOf(m); if (slot < 0) return false;
    pl.mon[slot] = null; const home = duel.p[m.control ? m.control.orig : m.owner]; home.hand.push(m.id);
    for (const e of m.equips) duel.toGrave(home, e);
    duel.emit("bounce", { player: pl.index, slot, id: m.id, to: home.index });
    return true;
  }
  // destroys the strongest enemy monster that fits; returns { m, atk } or null
  function killStrongest(duel, o, pred, why) { const m = strongestOf(duel, o, pred); if (!m) return null; const atk = duel.atk(m); duel.destroyMonster(m, why); return { m, atk }; }
  // destroys up to n of the enemy's set spell/trap cards of that kind ("S", "T" or null for any)
  function breakSet(duel, o, kind, n) {
    let k = 0;
    for (let i = 0; i < 5 && k < n; i++) { const s = o.spells[i]; if (!s) continue; const c = CardDB.get(s.id); if (kind && c.kind !== kind) continue; duel.toGrave(o, s.id); o.spells[i] = null; duel.emit("breakset", { player: o.index, slot: i, id: s.id }); k++; }
    // equips and the field card are spells on the field as well - a trap-only effect leaves them alone
    if (kind !== "T") {
      for (const m of o.monsters()) { for (const id of m.equips.slice()) { if (k >= n) break; if (duel.removeEquip(o, m, id)) k++; } if (k >= n) break; }
      if (k < n && duel.clearFieldCard()) k++;
    }
    return k;
  }
  function stripBoosts(m) { m.levels = 0; m.temp = 0; m.tyOverride = null; m.equips = []; m.doubled = false; m.whim = 0; m.courageUntil = 0; }
  const SP = (id, name, text, use, fail, extra) => { special[id] = Object.assign({ name, text, fail: fail || "Can't use", use }, extra || {}); };
  const takeStrongest = (pred, temp) => (duel, pl) => { const m = strongestOf(duel, duel.opp(pl), pred); return !!m && steal(duel, pl, m, temp); };

  // ------------------------------------------------------------ SPCL abilities
  SP(1, "Burst", "Destroys the enemy's strongest monster, once a duel", (duel, pl) => !!killStrongest(duel, duel.opp(pl), null, "special"), "No target", { once: true });
  SP(364, "Slash", "Destroys the enemy's strongest monster", (duel, pl) => !!killStrongest(duel, duel.opp(pl), null, "special"), "No target");
  SP(15, "Blaze", "Destroys the strongest enemy Dinosaur", (duel, pl) => !!killStrongest(duel, duel.opp(pl), (m) => m.ty === "Dinosaur", "special"), "No Dinosaurs");
  SP(22, "Bolt", "Destroys the enemy's strongest monster, once per duel", (duel, pl) => !!killStrongest(duel, duel.opp(pl), null, "special"), "No target", { once: true });
  SP(35, "Study", "A spell card comes from your deck, once per duel", (duel, pl) => fromDeck(duel, pl, (c) => c.kind === "S", (c) => handWorth(c.id)), "No spell in deck", { once: true });
  SP(40, "Pipe", "Takes the strongest enemy Dragon for good (needs a slot)", takeStrongest((m) => m.ty === "Dragon", false), "No Dragon / no space");
  SP(65, "Howl", "Raigeki comes from your deck, once per duel", (duel, pl) => fromDeck(duel, pl, (c) => c.id === 337), "No Raigeki in deck", { once: true });
  const HARPIE_RANK = { 318: 5, 386: 4, 63: 3, 317: 2, 316: 1, 321: 1 };
  SP(62, "Call", "A Harpie card or female equip comes from your deck", (duel, pl) => fromDeck(duel, pl, (c) => HARPIE_RANK[c.id] !== undefined, (c) => HARPIE_RANK[c.id]), "None in deck");
  SP(166, "Strings", "Takes their strongest monster for good, once a duel", takeStrongest(null, false), "No target / no space", { once: true });
  SP(715, "Strings", "Takes the strongest enemy monster for good (needs a slot)", takeStrongest(null, false), "No target / no space");
  SP(217, "Molten", "Once per duel: destroys the strongest enemy, its ATK as damage", (duel, pl) => { const r = killStrongest(duel, duel.opp(pl), null, "special"); if (!r) return false; duel.damage(duel.opp(pl), r.atk, "special"); return true; }, "No target", { once: true });
  SP(224, "Disarm", "Destroys an enemy trap card set on the field", (duel, pl) => breakSet(duel, duel.opp(pl), "T", 1) > 0, "No enemy trap");
  SP(744, "Hex", "Destroys an enemy trap card set on the field", (duel, pl) => breakSet(duel, duel.opp(pl), "T", 1) > 0, "No enemy trap");
  SP(229, "Sand", "You gain 1000 LP", (duel, pl) => { duel.heal(pl, 1000); return true; });
  SP(462, "Storm", "You gain 3000 LP, once per duel", (duel, pl) => { duel.heal(pl, 3000); return true; }, "Already used", { once: true });
  SP(262, "Aile", "Offers another of your monsters for 700 more ATK", (duel, pl, self) => {
    const others = pl.monsters().filter((m) => m !== self); if (!others.length) return false;
    others.sort((a, b) => duel.atk(a) - duel.atk(b)); duel.destroyMonster(others[0], "offer");
    self.temp += 700; duel.emit("powerup", { player: pl.index, slot: pl.mon.indexOf(self), id: self.id, levels: 0 }); return true;
  }, "Need another monster");
  SP(266, "Tsurugi", "Enemy loses 500 LP per set card on their field", (duel, pl) => { const n = duel.opp(pl).spells.filter((s) => s).length; if (!n) return false; duel.damage(duel.opp(pl), 500 * n, "special"); return true; }, "No enemy set cards");
  SP(376, "Tame", "Takes their strongest monster for good, once a duel", takeStrongest(null, false), "No target / no space", { once: true });
  SP(417, "Juggle", "Offers itself: destroys the enemy's strongest monster", (duel, pl, self) => {
    const t = strongestOf(duel, duel.opp(pl)); if (!t) return false;
    duel.destroyMonster(self, "offer"); duel.destroyMonster(t, "special"); return true;
  }, "No target");
  // The 5000 LP were the whole cost of the card; the user took them off (2026-09-23) and put it back on the list at
  // one copy instead. It now simply finds the best ritual card left in the deck and summons what that card makes.
  SP(420, "Stein", "A ritual in your deck summons its monster, once a duel", (duel, pl) => {
    if (pl.freeMonSlot() < 0) return false;
    let best = -1, bv = -1; pl.deck.forEach((id, i) => { const r = ritual[id]; if (r && CardDB.get(r.result).atk > bv) { bv = CardDB.get(r.result).atk; best = i; } });
    if (best < 0) return false;
    const sid = pl.deck.splice(best, 1)[0]; duel.toGrave(pl, sid); shuffleArray(pl.deck);
    duel.emit("magic", { player: pl.index, id: sid }); summonFree(duel, pl, ritual[sid].result, "stein"); return true;
  }, "Need a slot and a ritual card in the deck", { once: true });
  SP(469, "Ninja", "Destroys an enemy spell card on the field", (duel, pl) => breakSet(duel, duel.opp(pl), "S", 1) > 0, "No enemy spell");
  SP(490, "Needle", "Enemy loses 1000 LP", (duel, pl) => { duel.damage(duel.opp(pl), 1000, "special"); return true; });
  SP(500, "Hunt", "Destroys the strongest enemy Dragon", (duel, pl) => !!killStrongest(duel, duel.opp(pl), (m) => m.ty === "Dragon", "special"), "No Dragon");
  SP(506, "Gale", "Destroys the strongest enemy ritual monster", (duel, pl) => !!killStrongest(duel, duel.opp(pl), (m) => isRitualMon(m.id), "special"), "No ritual monster");
  SP(512, "Cannon", "Offers one of your monsters: enemy loses 500 LP", (duel, pl, self) => {
    const ms = pl.monsters().filter((m) => m !== self).sort((a, b) => duel.atk(a) - duel.atk(b)); duel.destroyMonster(ms[0] || self, "offer");
    duel.damage(duel.opp(pl), 500, "special"); return true;
  });
  SP(540, "Wing", "Draws a card", (duel, pl) => duel.drawCard(pl), "Deck is empty");
  SP(583, "Clear", "Ends the Swords of Revealing Light holding you", (duel, pl) => { if (!pl.swords) return false; pl.swords = 0; duel.emit("msg", { text: "The swords vanish!" }); return true; }, "No swords on you");
  SP(586, "Kappa", "Destroys up to 2 enemy spell or trap cards", (duel, pl) => breakSet(duel, duel.opp(pl), null, 2) > 0, "No enemy set cards");
  SP(641, "Usurp", "Trades places with their best monster, once a duel", (duel, pl, self) => {
    const o = duel.opp(pl), m = strongestOf(duel, o); if (!m) return false;
    const ms = pl.mon.indexOf(self), os = o.mon.indexOf(m), origS = self.control ? self.control.orig : self.owner, origM = m.control ? m.control.orig : m.owner;
    pl.mon[ms] = m; m.owner = pl.index; m.control = { orig: origM, temp: false }; m.canAttack = true; m.faceUp = true;
    o.mon[os] = self; self.owner = o.index; self.control = { orig: origS, temp: false }; self.canAttack = true; self.faceUp = true;
    duel.emit("steal", { player: pl.index, slot: ms, from: os, id: m.id }); duel.emit("steal", { player: o.index, slot: os, from: ms, id: self.id });
    return true;
  }, "No target", { once: true });
  SP(721, "Chaos", "The best spell card in your deck or grave comes to your hand", (duel, pl) => {
    const best = (arr) => arr.reduce((b, id) => { const c = CardDB.get(id); return c && c.kind === "S" && (b < 0 || handWorth(id) > handWorth(b)) ? id : b; }, -1);
    const d = best(pl.deck), g = best(pl.grave); if (d < 0 && g < 0) return false;
    if (g >= 0 && (d < 0 || handWorth(g) >= handWorth(d))) return fromGrave(duel, pl, (c) => c.id === g);
    return fromDeck(duel, pl, (c) => c.id === d);
  }, "No spell in deck or grave");
  // ---- the second monster patch (2026-09-22)
  // duplicating yourself is free again and as often as you like (the user, 2026-09-24); the Skull Servant left this
  // family for the Doll of Demise's trick
  for (const id of [9, 195]) SP(id, "Split", "Makes a copy of itself on your field (needs a slot)", (duel, pl, self) => !!summonFree(duel, pl, self.id, "split"), "Field is full");
  SP(84, "Reap", "Destroys every enemy trap card set on the field", (duel, pl) => breakSet(duel, duel.opp(pl), "T", 5) > 0, "No enemy trap");
  const CALLS = { 117: 486, 140: 549, 186: 595, 249: 442, 387: 379 }; // Spirit of the Books, Toad Master, Fiend Reflection #2, Water Omotics, Mystic Lamp
  const CALL_NAMES = { 486: "Boo Koo", 549: "Frog The Jam", 595: "Fiend Refl. #1", 442: "Aqua Dragon", 379: "La Jinn" };
  for (const id in CALLS) SP(Number(id), "Call", "Calls " + CALL_NAMES[CALLS[id]] + " from outside the deck, once per duel", (duel, pl) => !!summonFree(duel, pl, CALLS[id], "call"), "Field is full", { once: true });
  SP(154, "Ember", "Enemy loses 50 LP", (duel, pl) => { duel.damage(duel.opp(pl), 50, "special"); return true; });
  const mimicFx = (duel, pl, self) => { const t = strongest(duel, duel.opp(pl)); if (!t) return false; self.mimic = { atk: duel.atk(t), def: duel.def(t) }; duel.emit("mimic", { player: pl.index, slot: pl.mon.indexOf(self), id: self.id, target: t.id }); return true; };
  SP(185, "Mimic", "Copies the ATK and DEF of the strongest enemy monster", mimicFx, "No target");
  special2[586] = { name: "Mimic", text: "Copies the ATK and DEF of the strongest enemy monster", fail: "No target", use: mimicFx };
  SP(187, "Gate", "Special summons the strongest monster in your hand", (duel, pl) => summonFromHand(duel, pl, () => true), "No monster in hand / no space");
  SP(363, "Gift", "You gain 1000 LP", (duel, pl) => { duel.heal(pl, 1000); return true; });
  SP(525, "Peak", "Changes the field to Mountain", (duel, pl) => { if (duel.field === 332) return false; duel.setField(332, pl.index); return true; }, "Already Mountain");
  SP(637, "Grove", "Changes the field to Forest", (duel, pl) => { if (duel.field === 330) return false; duel.setField(330, pl.index); return true; }, "Already Forest");
  const absorbFx = { name: "Absorb", text: "Absorbs the strongest enemy: its ATK is added to this", fail: "No target", use(duel, pl, self) {
    const r = killStrongest(duel, duel.opp(pl), null, "absorb"); if (!r) return false;
    self.temp += r.atk; duel.emit("powerup", { player: pl.index, slot: pl.mon.indexOf(self), id: self.id, levels: 0 }); return true;
  } };
  special[731] = absorbFx; special[734] = absorbFx;
  SP(739, "Conjure", "Special summons a Magician from your hand", (duel, pl) => summonFromHand(duel, pl, (c) => c.ty === "Magician"), "No Magician in hand / no space");
  SP(741, "Flute", "Special summons a Dragon from your hand", (duel, pl) => summonFromHand(duel, pl, (c) => c.ty === "Dragon"), "No Dragon in hand / no space");
  SP(743, "Barrel", "Coin flip: heads destroys the strongest enemy monster", (duel, pl) => {
    if (!duel.opp(pl).hasMonsters()) return false;
    const heads = Math.random() < 0.5; duel.emit("coin", { player: pl.index, heads, id: 743 });
    if (heads) killStrongest(duel, duel.opp(pl), null, "special"); return true;
  }, "No target");
  SP(749, "Fetch", "Gazelle the King of Dreams comes from your deck", (duel, pl) => fromDeck(duel, pl, (c) => c.id === 747), "No Gazelle in deck");
  SP(754, "Raid", "Strips every power-up off the enemy's monsters", (duel, pl) => {
    let n = 0; for (const m of duel.opp(pl).monsters()) if (m.levels || m.temp > 0 || m.doubled || m.equips.length || m.whim > 1) { n++; stripBoosts(m); }
    return n > 0;
  }, "Nothing to strip");
  SP(762, "Hive", "Takes the strongest enemy Insect for good (needs a slot)", takeStrongest((m) => m.ty === "Insect", false), "No Insect / no space");
  SP(429, "Whim", "Coin flip: heads doubles its ATK, tails halves it", (duel, pl, self) => { const heads = Math.random() < 0.5; duel.emit("coin", { player: pl.index, heads, id: 429 }); self.whim = heads ? 2 : 0.5; return true; });

  // ------------------------------------------------------------ triggers
  // Labyrinth Wall calls the maze's own monsters out, one kind at a time (they are summoned-only cards now)
  const LABYRINTH = [236, 370, 369, 375];   // Guardian of the Labyrinth, Labyrinth Tank, Wall Shadow, Dungeon Worm
  SP(720, "Mask", "Takes the strongest enemy monster for good, once per duel", takeStrongest(null, false), "No target / no space", { once: true });
  SP(366, "Maze", "Calls out a Labyrinth monster you do not have yet", (duel, pl) => {
    if (pl.freeMonSlot() < 0) return false;
    const out = pl.monsters().map((m) => m.id);
    const want = LABYRINTH.filter((id) => !out.includes(id));
    if (!want.length) return false;
    return !!summonFree(duel, pl, want[Math.floor(Math.random() * want.length)], "maze");
  }, "The maze is full");
  // Kairyu-shin fetches anything that touches the sea: the field it is fought on, the magic that clears Fish off the
  // board, and every equip that fits an Aqua, Sea Dragon or Fish monster (the user's rework, 2026-09-24)
  const SEA_TYPES = ["Aqua", "SeaDragn", "Fish"];
  const seaCard = (c) => c.kind !== "M" && (c.id === 334 || c.id === 664 ||
    (CardDB.isEquip(c.id) && CardDB.all.some((m) => m.kind === "M" && SEA_TYPES.includes(m.ty) && CardDB.equipFits(c.id, m))));
  SP(73, "Tide", "A card for your Aqua, Fish or Sea Dragons comes from the deck", (duel, pl) => {
    if (pl.hand.length > 6) return false;
    return fromDeck(duel, pl, seaCard, (c) => handWorth(c.id));
  }, "No sea magic in the deck");

  // ---- cards the remake adds (801-815). Dark Paladin and Junk Warrior are not deck cards at all: they are made
  // with the fusion mechanic like every other monster of their kind (the user's rule, 2026-09-23 - the offering
  // abilities their partners used to carry are gone). D. Magician + Buster Blader, and Junk Synchron + anything.
  SP(806, "Scrap", "Brings a monster back from your graveyard", (duel, pl) => {
    if (pl.freeMonSlot() < 0) return false;
    let best = -1, bv = -1;
    pl.grave.forEach((id, i) => { const c = CardDB.get(id); if (c && c.kind === "M" && !Banlist.ritualOnly(id) && c.atk > bv) { bv = c.atk; best = i; } });
    if (best < 0) return false;
    return !!summonFree(duel, pl, pl.grave.splice(best, 1)[0], "scrap");
  }, "Nothing to bring back");
  // Call of the Haunted is a spell in this game: the best monster in the graveyard walks back on
  magic[813] = { kind: "misc", target: "none", text: "Special summons a monster from your graveyard",
    can: (duel, pl) => pl.freeMonSlot() >= 0 && pl.grave.some((id) => { const c = CardDB.get(id); return c && c.kind === "M" && !Banlist.ritualOnly(id); }),
    use(duel, pl) {
      // Whoever comes back is whoever is worth the most - and to a duelist digging for Exodia that is a recruiter,
      // because one more search is worth more than any body on the field (the user's call, 2026-09-23).
      const digging = [17, 18, 19, 20, 21].some((x) => pl.deck.includes(x) || pl.hand.includes(x));
      // ...unless the board is already lost, in which case what is wanted is a body, not another search
      const mine = pl.monsters().reduce((t, m) => Math.max(t, duel.atk(m)), 0);
      const drowning = duel.opp(pl).monsters().some((m) => duel.atk(m) > mine + 500);
      const worth = (id) => (digging && !drowning && (id === 48 || id === 574) ? 9000 : 0) + CardDB.get(id).atk + (bonus[id] || 0);
      let best = -1, bv = -1;
      pl.grave.forEach((id, i) => { const c = CardDB.get(id); if (!c || c.kind !== "M" || Banlist.ritualOnly(id)) return; const v = worth(id); if (v > bv) { bv = v; best = i; } });
      if (best < 0) return false;
      return !!summonFree(duel, pl, pl.grave.splice(best, 1)[0], "haunted");
    } };
  // ---- the second batch the remake adds (816-823, the user's list of 2026-09-24)
  const revivable = (id) => { const c = CardDB.get(id); return !!c && c.kind === "M" && !Banlist.ritualOnly(id); };
  const bodyWorth = (id) => CardDB.get(id).atk + (bonus[id] || 0);
  magic[816] = { kind: "misc", target: "none", text: "Draw 3 cards. Your whole hand goes when the turn ends",
    can: (duel, pl) => pl.deck.length >= 3,
    use(duel, pl) { duel.drawCard(pl); duel.drawCard(pl); duel.drawCard(pl); pl.demise = duel.turnNo; } };
  magic[818] = { kind: "misc", target: "none", text: "Brings a monster back from either graveyard",
    can: (duel, pl) => pl.freeMonSlot() >= 0 && [pl, duel.opp(pl)].some((p) => p.grave.some(revivable)),
    use(duel, pl) {
      // the best body in either graveyard, theirs included - that is what makes it worth a card
      let from = null, best = -1, bv = -1;
      for (const p of [pl, duel.opp(pl)]) p.grave.forEach((id, i) => { if (!revivable(id)) return; const v = bodyWorth(id); if (v > bv) { bv = v; best = i; from = p; } });
      if (!from) return false;
      return !!summonFree(duel, pl, from.grave.splice(best, 1)[0], "reborn");
    } };
  magic[819] = { kind: "misc", target: "none", text: "Your deck picks a monster at random and puts it out",
    can: (duel, pl) => pl.freeMonSlot() >= 0 && pl.deck.some(revivable),
    use(duel, pl) {
      const at = pl.deck.map((id, i) => (revivable(id) ? i : -1)).filter((i) => i >= 0);
      if (!at.length) return false;
      const pick = at[Math.floor(Math.random() * at.length)];
      const id = pl.deck.splice(pick, 1)[0]; shuffleArray(pl.deck);
      return !!summonFree(duel, pl, id, "reasoning");
    } };
  magic[820] = { kind: "misc", target: "none", text: "A Warrior comes from your deck to your hand",
    can: (duel, pl) => pl.hand.length <= 6 && pl.deck.some((id) => { const c = CardDB.get(id); return c && c.kind === "M" && c.ty === "Warrior" && !Banlist.ritualOnly(id); }),
    use: (duel, pl) => fromDeck(duel, pl, (c) => c.kind === "M" && c.ty === "Warrior" && !Banlist.ritualOnly(c.id), (c) => c.atk + (bonus[c.id] || 0)) };
  const isToonCard = (id) => TOONS.has(id) || id === 823 || id === 822;
  magic[822] = { kind: "misc", target: "none", text: "A Toon card comes from your deck to your hand",
    can: (duel, pl) => pl.hand.length <= 6 && pl.deck.some(isToonCard),
    use: (duel, pl) => fromDeck(duel, pl, (c) => isToonCard(c.id), (c) => (c.id === 823 ? 4000 : c.atk || 1000)) };
  // Toon World is a field card with no element aura: what it does is let the Toons past the board, turn one attack
  // a turn away, and take every Toon with it when it goes (duel.setField does that last part)
  magic[823] = { kind: "field", target: "none", text: "Toons hit the LP straight. Stops 1 attack a turn",
    use(duel, pl) { duel.setField(823, pl.index); } };
  SP(817, "Sage", "A spell card comes from your deck, once per duel", (duel, pl) => fromDeck(duel, pl, (c) => c.kind === "S", (c) => handWorth(c.id)), "No spell in deck", { once: true });

  trap[814] = { destroysAttacker: true, text: "Destroys the attacker and every enemy monster in attack position",
    onAttack() { return true; },
    resolve(duel, pl, attacker) { for (const m of duel.opp(pl).monsters()) if (m !== attacker && m.pos === "atk") duel.destroyMonster(m, "trap"); } };
  trap[815] = { text: "Swallows a summoned monster of 1000 ATK or more", onSummon(duel, pl, m) { return duel.atk(m) >= 1000; } };
  // monsters that come down without an offering when their moment comes
  // A summon that is free when some condition holds. Nothing uses it any more - the Cyber Dinosaur was the last one,
  // and it puts itself out unconditionally now (the user, 2026-09-24) - but the engine still reads it, so a card that
  // wants a conditional free summon can be written here and nowhere else.
  const condFree = {};

  const onDestroy = {}, onDiscard = {};
  const searchMon = (pred) => (duel, pl) => fromDeck(duel, pl, (c) => c.kind === "M" && !Banlist.ritualOnly(c.id) && pred(c), (c) => c.atk + (special[c.id] || passive[c.id] ? 200 : 0));
  onDestroy[48] = searchMon((c) => c.atk <= 1500);                                   // Sangan
  onDestroy[574] = searchMon((c) => c.def <= 1500);                                  // Witch of the Black Forest
  onDestroy[739] = (duel, pl) => searchMon((c) => c.ty === "Magician" && c.id !== 739)(duel, pl) || fromGrave(duel, pl, (c) => c.kind === "M" && c.ty === "Magician" && c.id !== 739); // Legion
  onDestroy[750] = (duel, pl) => { summonFree(duel, pl, 749, "chimera"); summonFree(duel, pl, 747, "chimera"); }; // Chimera
  onDestroy[764] = (duel, pl) => duel.heal(pl, 1000);                                // Skull-Mark Ladybug
  onDestroy[766] = (duel, pl) => summonFromHand(duel, pl, (c) => c.ty === "Insect"); // Pinch Hopper
  onDestroy[763] = (duel, pl) => {                                                    // Parasite Paracide burrows into the enemy deck
    const o = duel.opp(pl); for (const p of duel.p) { const gi = p.grave.lastIndexOf(763); if (gi >= 0) { p.grave.splice(gi, 1); break; } }
    o.deck.push(763); shuffleArray(o.deck); duel.emit("infest", { player: o.index });
  };
  const inBattle = (fn) => (duel, pl, m, ctx) => { if (ctx && ctx.battle) fn(duel, pl, m, ctx); };
  // The monsters that used to freeze the enemy all share one rule now (the user's, 2026-09-23): they do nothing
  // while they stand, and when they are cut down in battle the enemy may not attack at all on their next turn.
  // The count is 2 because it ticks down at the start of every one of that player's turns, the way the Swords do.
  const lockAttacks = (duel, pl, m) => {
    const o = duel.opp(pl);
    o.noAttack = Math.max(o.noAttack, 2);
    duel.emit("noattack", { player: o.index, id: m ? m.id : 0 });
  };
  const FREEZERS = [36, 42, 103, 129, 134, 148, 179, 260, 261, 263, 285, 460, 531, 610, 725, 733, 740];
  for (const id of FREEZERS) onDestroy[id] = inBattle(lockAttacks);   // their card text is set with the other passives
  // Red Archery Girl keeps the arrow she always fired: whoever cut her down carries the wound (the user's rule)
  onDestroy[725] = inBattle((duel, pl, m, ctx) => {
    lockAttacks(duel, pl, m);
    const by = ctx && ctx.by;
    if (by && duel.live(by)) {
      by.temp -= 500; by.faceUp = true;
      duel.emit("powerdown", { player: duel.opp(pl).index, slot: duel.opp(pl).mon.indexOf(by), id: by.id });
    }
  });
  onDestroy[602] = inBattle((duel, pl) => { for (const x of duel.opp(pl).monsters().sort((a, b) => duel.atk(b) - duel.atk(a)).slice(0, 2)) bounce(duel, x); }); // Penguin Soldier
  onDestroy[541] = inBattle((duel, pl) => { const x = strongestOf(duel, duel.opp(pl)); if (x) bounce(duel, x); });                          // Hane-Hane
  onDestroy[547] = inBattle((duel, pl) => duel.heal(pl, 3000));                                                                              // Griggle
  onDestroy[562] = inBattle((duel, pl) => { const o = duel.opp(pl); let n = 0; while (n < 5 && o.deck.length) { duel.toGrave(o, o.deck.shift()); n++; } duel.emit("mill", { player: o.index, n }); }); // Needle Worm
  onDestroy[591] = inBattle((duel) => {                                                                                                       // Morphing Jar
    for (const p of duel.p) while (p.hand.length) duel.discardFromHand(p, p.hand.length - 1, "jar");
    duel.emit("morph", {}); for (const p of duel.p) for (let i = 0; i < 5; i++) duel.drawCard(p);
  });
  onDestroy[540] = inBattle((duel, pl) => duel.drawCard(pl));                                                                                // Skelengel
  onDestroy[759] = inBattle((duel, pl) => pl.revive.push(759));                                                                              // Doll of Demise
  onDestroy[24] = inBattle((duel, pl) => pl.revive.push(24));    // Skull Servant: the same trick, and both of them once a duel
  onDestroy[768] = inBattle((duel, pl, m, ctx) => { if (!ctx.attacking && ctx.by && ctx.by.owner !== pl.index) { duel.forceEnd = true; duel.emit("turnend", { player: ctx.by.owner }); } }); // The Unhappy Maiden
  onDestroy[102] = inBattle((duel, pl) => fromGrave(duel, pl, (c) => c.kind === "T"));                                                       // Mask of Darkness
  onDestroy[428] = inBattle((duel, pl) => fromGrave(duel, pl, (c) => c.kind === "S"));                                                       // Magician of Faith
  onDestroy[490] = inBattle((duel, pl) => duel.damage(duel.opp(pl), 1000, "special"));                                                       // Needle Ball
  const retaliate = new Set([256, 393, 394, 399, 501, 135]);
  const strikeBack = (duel, pl, m, ctx) => { const k = ctx.by; if (k && duel.p[k.owner].mon.includes(k)) duel.destroyMonster(k, "retaliate"); };
  for (const id of retaliate) onDestroy[id] = inBattle(strikeBack);
  onDestroy[736] = inBattle((duel, pl, m, ctx) => { const k = ctx.by, a = k ? duel.atk(k) : 0; strikeBack(duel, pl, m, ctx); if (a) duel.damage(duel.p[k.owner], a, "special"); }); // Blast Sphere
  onDiscard[425] = (duel, pl) => { for (let i = 0; i < 2; i++) fromDeck(duel, pl, (c) => c.id === 425); }; // Thunder Dragon
  onDiscard[463] = (duel, pl) => { duel.drawCard(pl); duel.drawCard(pl); };                                  // Electric Snake

  // ------------------------------------------------------------ tables the engine, the AI and the deck builders share
  const direct = new Set([397, 387, 89, 398, 410, 422, 484, 488, 527, 635, 751]);   // attack the LP straight away
  const substitute = new Set([109, 258, 269]);                                       // stand in for any ritual offering
  const evolve = { 278: 56, 56: 72, 72: 57, 57: 67 };                                // the moth line, one step per own turn
  // The Toons are the one thing in the game that is still paid for (the user's rule, 2026-09-23): they arrive as an
  // EXTRA summon - they never use up the normal one - and the price is monsters from YOUR FIELD, never from the hand.
  // Toon Mermaid is the cheap one and asks for nothing.
  // An EXTRA summon: it never uses up the normal one, and the price is monsters from YOUR FIELD, never the hand.
  // The Toons cannot be summoned any other way at all - no normal summon, no setting - and each of them costs one
  // offering. The Megacyber and the Cyber Dragon simply put themselves out for nothing. (The user, 2026-09-24.)
  const TOONS = new Set([727, 728, 729, 767, 821]);
  const freeSummon = { 727: 1, 728: 1, 729: 1, 767: 1, 821: 1, 755: 0, 803: 0, 804: 0 };
  // "happy to be destroyed": knocking one down does the OWNER a favour, so it is worth less to attack it. The freeze
  // family used to belong here, back when their effect fired on being flipped - since the rework (destroyed in
  // battle: the enemy cannot attack next turn) they are priced by `locksAttacks` instead, and having them in both
  // lists charged the attacker twice and left the AI refusing to touch a set Nemuriko at all (the user, 2026-09-24).
  const bait = new Set([48, 574, 739, 750, 764, 766, 602, 541, 547, 562, 591, 540, 759, 24, 768, 736, 256, 393, 394, 399, 501, 763, 102, 428, 490, 135]);
  const untargetable = new Set([264, 536]);                                           // Wing Egg Elf, Mechaleon: safe while another monster is with them
  // what an effect is worth on top of the printed stats (ATK-equivalents): deck builders, the shop and the AI use it
  const bonus = {
    1: 1200, 217: 900, 22: 500, 35: 350, 40: 300, 48: 900, 57: 300, 58: 900, 62: 400, 65: 350, 67: 400, 72: 1000, 82: 400, 99: 300, 26: 250, 15: 200, 417: 450, 490: 900, 102: 400, 428: 900, 586: 500, 721: 500,
    102: 300, 109: 150, 258: 150, 269: 150, 114: 350, 166: 700, 602: 1000, 220: 400, 224: 250, 229: 300, 256: 500, 393: 500, 394: 500,
    399: 500, 501: 800, 262: 300, 266: 250, 278: 600, 56: 800, 368: 500, 369: 200, 370: 200, 376: 1300, 407: 400, 410: 400, 422: 400,
    484: 400, 488: 400, 527: 400, 635: 400, 751: 400, 398: 400, 397: 400, 387: 400, 89: 300, 417: 350, 420: 1800, 425: 500, 429: 200,
    462: 500, 463: 600, 469: 250, 475: 300, 478: 100, 490: 700, 492: 250, 493: 300, 500: 250, 506: 150, 512: 350, 516: 2400, 524: 250,
    540: 1100, 541: 600, 547: 450, 12: 200, 554: 200, 562: 600, 574: 700, 583: 100, 586: 350, 591: 500, 609: 200, 616: 300, 641: 900,
    727: 500, 729: 500, 767: 500, 736: 600, 739: 600, 741: 500, 743: 700, 744: 250, 748: 300, 749: 300, 750: 700, 752: 700, 753: 200,
    754: 250, 755: 500, 756: 800, 759: 500, 760: 300, 762: 600, 763: 150, 764: 300, 766: 300, 768: 400, 769: 800, 773: 300, 794: 800,
    9: 250, 24: 500, 195: 250, 36: 400, 148: 400, 179: 400, 263: 400, 285: 400, 460: 400, 531: 400, 42: 400, 84: 250, 103: 400, 260: 400, 261: 400,
    801: 900, 802: 1200, 803: 650, 804: 500, 805: 900, 806: 700, 807: 700, 808: 500, 366: 900, 73: 400, 720: 1000,
    817: 700, 821: 500,
    104: 200, 117: 300, 140: 350, 186: 500, 249: 900, 387: 700, 129: 400, 134: 400, 135: 500, 139: 400, 154: 100, 185: 500, 187: 700, 235: 200,
    264: 300, 536: 300, 362: 800, 363: 250, 525: 100, 637: 100, 584: 900, 612: 400, 728: 600,
    797: 900, 16: 400, 402: 900, 83: 400, 610: 400, 725: 400, 733: 400, 740: 400, 428: 500, 15: 150, 26: 100, 39: 100, 74: 100, 732: 200, 723: 100,
    731: 2600, 734: 2800, // Relinquished and Thousand-eyes Restrict are printed 0/0: everything they are worth is the absorb
  };

  // ------------------------------------------------------------ passive monster rules (always on, see Duel.passiveBonus and friends)
  const passive = {
    2: "Your B.eyes White Dragon gets 500 ATK and DEF",
    62: "Your Harpie's Pet Dragon gets 500 ATK and DEF",
    63: "Your Harpie's Pet Dragon gets 1000 ATK and DEF",
    386: "500 ATK and DEF per Harpie Lady out, 1000 per Harpie Lady Sister",
    90: "Your other monsters with 500 ATK or less get 500 ATK and DEF",
    160: "Gets 500 ATK and DEF while M-warrior #2 is on your field",
    161: "Gets 500 ATK and DEF while M-warrior #1 is on your field",
    375: "Gets 500 ATK and DEF while Monster Tamer is on your field",
    376: "Your other Beasts and Beast-Warriors get 300 ATK and DEF",
    628: "Shadow monsters get 500 ATK and DEF, Light monsters lose 500",
    760: "500 per D. Magician in your hand, field and grave",
    762: "200 ATK and DEF per Insect on both fields and in both graves",
    57: "100 per Insect with you or in your grave. Evolves next turn",
    67: "100 ATK and DEF per Insect on both fields and in both graves",
    764: "200 per other Insect with you. Destroyed: 1000 LP back",
    278: "Becomes Larvae Moth on your next turn",
    56: "Becomes Cocoon of Evolution on your next turn",
    72: "Hatches into Great Moth on your next turn",
    17: "Win at once with all five Exodia pieces in your hand", 18: "Win at once with all five Exodia pieces in your hand",
    19: "Win at once with all five Exodia pieces in your hand", 20: "Win at once with all five Exodia pieces in your hand",
    21: "Win at once with all five Exodia pieces in your hand",
    // auras and stat passives
    12: "Gets 30 pct more while Lava Battleguard is with you",
    554: "Gets 30 pct more while Swamp Battleguard is with you",
    99: "Your Zombies get 30 pct more ATK and DEF",
    753: "Your Warriors get 30 pct more ATK and DEF",
    492: "Light monsters x1.3, Shadow monsters x0.7, everywhere",
    524: "Aqua monsters x1.3, Pyro monsters x0.7, everywhere",
    609: "Wind and Forest x1.3, Earth and Rock x0.7, everywhere",
    368: "Gets 100 ATK per monster in your graveyard",
    369: "500 ATK per Labyrinth Wall on both fields and graves",
    370: "500 ATK per Labyrinth Wall on both fields and graves",
    407: "100 ATK per Machine on both fields and in both graves",
    516: "Gets 600 ATK per card in your hand",
    366: "Calls a Labyrinth monster you do not have out yet",
    73: "Brings a card for your sea monsters out of the deck",
    720: "100 ATK per Light and Shadow monster out or buried",
    801: "Gets 500 ATK per Dragon on both fields and in both graves",
    807: "100 ATK per monster you have out or buried",
    808: "Gets 300 ATK per spell card in the enemy graveyard",
    802: "500 ATK per Dragon out or buried. Stops one enemy spell a turn",
    803: "Puts itself on the field for nothing, whenever you like",
    804: "Puts itself on the field for nothing, whenever you like",
    805: "Battle damage with no monsters out: it comes at once",
    493: "Each spell power-up gives it 500 more ATK",
    773: "Gets 200 ATK for every monster it destroys in battle",
    478: "Gets 1000 ATK while it battles a Wind monster",
    616: "Twice its ATK and DEF on the turn it is summoned",
    // rules changers
    752: "No trap card can be activated while it is out",
    763: "In your deck it makes your monsters Insects. Slain: enemy deck",
    794: "While it is out nobody can Normal Summon or Set",
    797: "Always in defence, and it attacks with its DEF",
    374: "Once a turn, a destroying effect fails and kills its user",
    748: "Attackers that bounce off it take double the damage",
    769: "Whatever battles it returns to the hand",
    756: "Face-up, whoever attacks it loses LP equal to the attacker's ATK",
    58: "Takes LP damage in your place, from your hand or field",
    380: "Cannot attack the turn it arrives. Attacks 3 times a turn",
    82: "Kills in battle burn the enemy for half the victim's ATK",
    114: "Its battle damage makes the enemy throw away a card",
    220: "Draws a card whenever it deals battle damage",
    109: "Can stand in for any ritual offering", 258: "Can stand in for any ritual offering", 269: "Can stand in for any ritual offering",
    727: "Offer 1 monster: it arrives as a special summon", 767: "Offer 1 monster: it arrives as a special summon", 729: "Offer 1 monster: it arrives as a special summon", 728: "Offer 1 monster: it arrives as a special summon", 821: "Offer 1 monster: it arrives as a special summon",
    755: "Puts itself on the field for nothing, whenever you like",
    // triggers
    48: "Destroyed: a deck monster of 1500 ATK or less joins your hand",
    574: "Destroyed: a deck monster of 1500 DEF or less joins your hand",
    739: "Destroyed: another Magician comes from your deck or grave",
    750: "Destroyed: Berfomet and Gazelle appear on your field",
    766: "Destroyed: an Insect from your hand joins the field",
    602: "Slain in battle: 2 enemy monsters go back to their hand",
    541: "Slain in battle: an enemy monster goes back to their hand",
    547: "Slain in battle: you gain 3000 LP",
    562: "Slain in battle: the enemy's top 5 deck cards are lost",
    591: "Slain in battle: both hands are thrown away and 5 redrawn",
    540: "Slain in battle: you draw a card",
    759: "Slain in battle: it comes back next turn, once a duel",
    24: "Slain in battle: it comes back next turn, once a duel",
    768: "Slain by an attacker: the enemy's turn ends at once",
    256: "Slain in battle: its killer is destroyed too", 393: "Slain in battle: its killer is destroyed too", 394: "Slain in battle: its killer is destroyed too",
    399: "Slain in battle: its killer is destroyed too", 501: "Slain in battle: its killer is destroyed too",
    736: "Slain in battle: its killer dies and burns them, once a duel",
    425: "Thrown from the hand: 2 more copies come from the deck",
    463: "Thrown from the hand: you draw 2 cards, once a duel",
    475: "Sent to the grave, it returns to your hand next turn",
    102: "Slain in battle: a trap returns from your grave to your hand",
    428: "Slain in battle: a spell returns from your grave to your hand",
    129: "Slain in battle: enemy monsters freeze for 1 turn", 134: "Slain in battle: enemy monsters freeze for 1 turn",
    490: "Slain in battle: enemy loses 1000 LP",
    135: "Slain in battle: its killer is destroyed too",
    104: "Your Magicians get 30 pct more ATK and DEF",
    235: "Your Forest and Plant monsters get 30 pct more",
    139: "Every enemy monster counts as a Zombie while it is out",
    264: "Cannot be attacked while another monster is with it", 536: "Cannot be attacked while another monster is with it",
    362: "Attacks with its DEF from defence. Stops 1 attack a turn",
    584: "Enemy monsters lose their effects while it is out",
    612: "You gain 500 LP whenever a spell card is activated",
    728: "Offer 1 of your monsters: a summon of its own",
    727: "Offer 1 of your monsters: a summon of its own",
    729: "Offer 1 of your monsters: a summon of its own",
    767: "Offer 1 of your monsters: a summon of its own",
    821: "Offer 1 of your monsters: a summon of its own",
  };
  for (const id of [397, 387, 89, 398, 410, 422, 484, 488, 527, 635, 751]) passive[id] = "Attacks the enemy's LP directly, past their monsters";
  for (const id of FREEZERS) passive[id] = "Destroyed in battle: the enemy cannot attack next turn";
  passive[725] = "Destroyed in battle: killer -500 ATK, no enemy attack next turn";

  passive[83] = "Zombie, Fiend, Shadow allies get 30 pct more ATK";
  trap[690] = { text: "Destroyed instead of your other spells and traps" };
  // A monster that can take or destroy an enemy monster has to be face up to do it, so it is never set (the user's
  // rule, 2026-09-24). Read off the ability texts rather than listed by hand, so a new card of that kind is covered
  // the day it is written. Reflect Bounder joins them: its burn only answers an attacker from face up.
  // 35 D. Magician, 65 Silver Fang, 73 Kairyu-shin, 516 Muka Muka, 806 Junk Synchron: named by the user (2026-09-24).
  // Each one is doing something from the field - digging, reviving, or growing with the hand - and none of it reads
  // as a face-down card.
  const needFaceUp = new Set([756, 35, 65, 73, 516, 806]);
  for (const tbl of [special, special2]) for (const id in tbl) {
    const t = (tbl[id] || {}).text || "";
    if (/^destroys all your/i.test(t)) continue;                                  // Jigen Bakudan blows up its own side
    if (/(destroys?|takes?|trades places)/i.test(t) && /(enemy|their|strongest|attacker)/i.test(t)
      && !/spell|trap|power-up|equip/i.test(t)) needFaceUp.add(Number(id));
  }
  window.Effects = { magic, trap, ritual, special, special2, passive, condFree, ritualText, ritualSpellFor, handWorth, bestDiscard, needFaceUp,
    onDestroy, onDiscard, onceDiscard: new Set([463]), onceDestroy: new Set([759, 24, 736]), direct, substitute, evolve, freeSummon, TOONS, bait, retaliate, untargetable, bonus, summonFree, bounce, locksAttacks: new Set(FREEZERS),
    text(id) { const c = CardDB.get(id); if (!c) return ""; if (c.kind === "S") return magic[id] ? magic[id].text : c.desc; if (c.kind === "T") return trap[id] ? trap[id].text : c.desc; if (c.kind === "R") return ritualText(id); return special[id] ? "SPCL: " + special[id].text : c.desc; },
    // ritual monsters and Wall Shadow are won / bought as the card that summons them
    summonerOf(id) { return ritualSpellFor[id] || 0; },
    // A summoned-only monster is never a deck card, so its page has to say where it comes from - "Ritual smn" on a
    // B. Skull Dragon sends the player hunting for a ritual card that does not exist.
    summonHow(id) {
      if (!Banlist.ritualOnly(id)) return "";
      const name = (x) => { const c = CardDB.get(x); return c ? c.name : "?"; };
      const spell = ritualSpellFor[id];
      if (spell) return "Summon: play " + name(spell);
      if (id === 392) return "Summon: Metalmorph on " + name(391);
      if (id === 742) return "Summon: Metalmorph on " + name(82);
      if (LABYRINTH.includes(id)) return "Summon: " + name(366) + " calls it out";
      for (const from in evolve) if (evolve[from] === id) return "Summon: " + name(Number(from)) + " grows into it";
      if (id === 807) return "Summon: fuse " + name(806) + " with any monster";
      const r = CardDB.recipesFor(id);
      if (!r.length) return "Summon: not a deck card";
      // name a recipe when there is room for it, otherwise just point at the fusion list
      const one = "Summon: fuse " + name(r[0][0]) + " and " + name(r[0][1]) + (r.length > 1 ? ", one of " + r.length + " ways" : "");
      if (one.length <= 62) return one;
      return r.length > 1 ? "Summon: one of " + r.length + " fusions" : "Summon: by fusion";
    },
    // an effect monster: a SPCL ability, an always-on passive, or a trigger (every one of those carries passive text)
    isEffect(id) { return !!(special[id] || special2[id] || passive[id]); },
  };
})();
