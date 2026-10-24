// Forbidden & Limited list. Replaces the cartridge's Duelist Level / Deck Capacity restrictions:
// every card may be run up to 3 times unless it appears here (1 = Limited, 2 = Semi-Limited).
// The same list is applied to the computer's decks.
(function () {
  const L = {};
  const set = (ids, n) => { for (const id of ids) L[id] = n; };
  // Monster destruction is easy to hold but not free (the user's rule, 2026-09-23): with no levels and no offerings
  // a board of giants goes up in one turn, so every deck carries the answers - one copy each. Trap Hole and reading
  // a hand (Monster Eye, the Spy) are unrestricted; Dark Hole, Raigeki, Crush Card and Mirror Force are Limited, and
  // every duelist is handed exactly one of them anyway (STAPLES in duelists.js).
  // What is left on the list is what a second or third copy would make unbeatable, on top of the ATK ceiling below.
  //
  // Limited (1 copy):
  //   17-21 Exodia                         instant win
  //   789 Pot of Greed                     +2 cards for nothing
  //   348 Swords of Revealing Light        three turns without enemy attacks
  //   781 Brain Control, 784 Change of Heart   steal the enemy's best monster
  //   657 Megamorph                        doubles a monster's ATK
  //   785 Multiply                         a second copy of your best monster (or a field of Kuribohs)
  //   813 Call of the Haunted              any monster in either graveyard walks back onto your field
  //   336 Dark Hole, 337 Raigeki, 661 Crush Card, 814 Mirror Force, 672 Harpie's Feather Duster
  //                                        every deck carries one, so one is all anybody needs
  //   722 Dark Magic Ritual, 783 Black Illusion Ritual, 695 Puppet Ritual, 665 Curse of Millennium Shield,
  //   670 Black Luster Ritual, 675 Ultimate Dragon, 667 Gate Guardian Ritual   what they bring out is the duel
  //   monsters:
  //   1 B.eyes White Dragon                3000 ATK that also destroys a monster every turn
  //   516 Muka Muka                        600 ATK per card in hand
  //   794 The Last Warrior from Another Planet   seals all normal summons
  //   641 Invader of the Throne            trades a 1350 body for the enemy's best monster
  //   376 Monster Tamer, 166 Mysterious Puppeteer   they take an enemy monster and keep it
  //   760 D. Magician Girl               500 ATK per Dark Magician held, played or buried
  //   797 Total Defense Shogun           attacks with its 2500 DEF and never leaves defence
  //   35 D. Magician, 48 Sangan, 574 Witch of the Black Forest   searchers
  //   591 Morphing Jar, 756 Reflect Bounder, 463 Electric Snake, 187 Gate Deeg
  //   9 Shadow Specter, 24 Skull Servant, 195 Doron   they copy themselves onto the field
  //   805 Gorz the Emissary                2700 ATK out of the hand the moment a blow lands on an empty field
  //   806 Junk Synchron                    any monster in the hand becomes a Junk Warrior, and it revives one
  //   752 Jinzo, 773 Sword Hunter, 82 Red-eyes B. Dragon, 407 Machine King, 762 Insect Queen,
  //   808 White-Horned Dragon              big bodies that also do something every turn
  //   372 Kazejin                          one third of the Gate Guardian, and a 2400 wall on its own
  //   727, 728, 729, 767 the Toons           they cannot be summoned any other way, and one offering is all they cost
  //   755 The Fiend Megacyber, 803 Cyber Dragon   they put themselves on the field for nothing
  //   816 Card of Demise, 818 Monster Reborn, 819 Reasoning   three cards, anything out of either grave, a free body
  //   821 Toon D. Magician Girl                     a Toon, and the Toons are one apiece
  // Off the list again (2026-09-24), because their abilities are once per duel now and no longer worth three copies:
  //   9 Shadow Specter, 24 Skull Servant, 195 Doron, 166 Mysterious Puppeteer, 376 Monster Tamer, 420 Cyber-Stein,
  //   463 Electric Snake, 641 Invader of the Throne, and 187 Gate Deeg
  //   366 Labyrinth Wall                   3000 DEF that calls the rest of the maze out, Magical Labyrinth finds it
  set([17, 18, 19, 20, 21, 789, 348, 781, 784, 657, 785, 813, 336, 337, 661, 814, 672,
    722, 783, 695, 665, 670, 675, 667,
    1, 516, 794, 35, 48, 574, 591, 756, 805, 806,
    752, 773, 82, 407, 762, 808, 760, 797, 372, 366,
    727, 728, 729, 767, 755, 803,
    816, 818, 819, 821], 1);
  // Semi-Limited (2 copies). Most of what used to sit here is handled by the ATK ceiling now, so only the cards
  // the ceiling cannot see are named:
  // Nothing is Semi-Limited by name any more: the ATK ceiling covers the cards that need covering.
  set([], 2);
  // Wall Shadow is not a deck card either: Labyrinth Wall calls it out of the maze, or it is fused from the Wall
  // and Shadow Ghoul.
  // Monsters that are never deck or chest cards: they only ever arrive on the field, by ritual, by fusion, by a
  // partner's effect or by an equip. Fusing for one in a duel is untouched - that is how most of these are meant to
  // be earned now (2026-09-23, the user's rule).
  //   the cartridge's ritual monsters and Wall Shadow                     356..731, 369
  //   Dark Paladin and Junk Warrior, offered for by their pieces          802, 807
  //   every monster the TCG prints as a Fusion                            15, 30, 37 ... 794
  //   what Metalmorph turns a monster into                                392, 742
  //   the moths, and the Labyrinth's own monsters                         57, 67, 236, 370, 375
  const RITUAL_ONLY = new Set([
    356, 357, 360, 362, 364, 365, 374, 380, 701, 702, 703, 704, 705, 706, 708, 709, 710, 715, 716, 717, 718, 719, 720, 721, 731, 734, 369, 802, 807, 817,
    15, 30, 37, 43, 69, 86, 92, 115, 133, 168, 189, 215, 217, 223, 230, 272, 294, 385, 389, 409, 427, 437, 442, 458, 465, 467, 471, 473, 482, 487,
    495, 508, 509, 521, 531, 533, 545, 564, 565, 572, 594, 613, 617, 618, 639, 707, 713, 750, 794,
    392, 742,
    57, 67, 236, 370, 375,
  ]);

  // Now that nothing is paid for with an offering, the price of a big monster is how many you may deck: 2100 ATK
  // or more is Semi-Limited, 2500 or more is Limited (the user's rule, 2026-09-23). The list above still applies
  // wherever it is stricter - Magician of Faith is Limited for what it does, not for what it hits for.
  const atkCap = [];
  function capFor(id) {
    if (atkCap[id] === undefined) {
      const c = CardDB.get(id);
      atkCap[id] = !c || c.kind !== "M" ? 3 : c.atk >= 2500 ? 1 : c.atk >= 2100 ? 2 : 3;
    }
    return atkCap[id];
  }
  const Banlist = {
    ATK_LIMITED: 2500, ATK_SEMI: 2100,
    limit(id) { return RITUAL_ONLY.has(id) ? 0 : Math.min(id in L ? L[id] : 3, capFor(id)); },
    ritualOnly(id) { return RITUAL_ONLY.has(id); },
    // short label for lists / detail pages ("" when unrestricted)
    label(id) { if (RITUAL_ONLY.has(id)) return id === 369 ? "Maze smn" : "Ritual smn"; const n = this.limit(id); return n === 3 ? "" : n === 0 ? "Forbidden" : n === 1 ? "Limited 1" : "Semi-Ltd 2"; },
    tag(id) { if (RITUAL_ONLY.has(id)) return "R"; const n = this.limit(id); return n === 3 ? "" : n === 0 ? "F" : String(n); },
    // every restricted card, grouped for the list screen
    entries() {
      const ids = Object.keys(L).map(Number).sort((a, b) => (L[a] - L[b]) || a - b);
      return ids.map((id) => ({ id, limit: L[id] }));
    },
    // returns a legal copy of a deck: extra copies are dropped and the deck is refilled from its own legal cards, then
    // from `extra` (a duelist's reserve list), then from plain filler monsters
    apply(deck, extra) {
      const count = {}, out = [], dropped = [];
      const want = {}; for (const id of deck) want[id] = (want[id] || 0) + 1; // never put back more copies than the deck asked for
      for (const id of deck) {
        if (!CardDB.get(id)) { dropped.push(id); continue; } // a gap (0) left by a trimmed card
        const n = count[id] || 0;
        if (n < this.limit(id)) { out.push(id); count[id] = n + 1; } else dropped.push(id);
      }
      // top up from the reserve list first (a duelist's own theme), then with more copies of the deck's own monsters
      // (weakest first so the flavour stays), then anything legal
      for (const id of extra || []) { if (out.length >= deck.length) break; if (this.limit(id) > 0 && (count[id] || 0) < this.limit(id) && CardDB.get(id)) { out.push(id); count[id] = (count[id] || 0) + 1; } }
      const pool = [...new Set(deck)].filter((id) => this.limit(id) > 0 && CardDB.get(id));
      pool.sort((a, b) => (CardDB.get(a).kind === "M" ? 0 : 1) - (CardDB.get(b).kind === "M" ? 0 : 1) || (CardDB.get(a).atk || 0) - (CardDB.get(b).atk || 0));
      let guard = 0;
      while (out.length < deck.length && guard++ < 400) {
        let added = false;
        for (const id of pool) { if (out.length >= deck.length) break; if ((count[id] || 0) < Math.min(this.limit(id), want[id] || 0)) { out.push(id); count[id] = (count[id] || 0) + 1; added = true; } }
        if (!added) break;
      }
      // last resort filler (a deck made almost entirely of forbidden cards): plain monsters with no effects
      const filler = [6, 7, 10, 31, 41, 25, 23, 3, 13, 27];
      for (let i = 0; out.length < deck.length; i++) { const id = filler[i % filler.length]; if ((count[id] || 0) < 3) { out.push(id); count[id] = (count[id] || 0) + 1; } else if (i > 60) break; }
      return { deck: out, dropped };
    },
  };
  window.Banlist = Banlist;
})();
