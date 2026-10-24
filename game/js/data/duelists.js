// The campaign roster: 4 stages, 21 duelists (+ Yugi's Grandpa who only hands out cards).
(function () {
  const D = [];
  function add(key, name, stage, deckKey, dropKey, portrait, opts) {
    D.push(Object.assign({ key, name, stage, deckKey, dropKey, portrait, scene: portrait, skill: stage, level: 0 }, opts || {}));
  }
  // ---- Stage 1: Domino Town 1 (clockwise from Yugi)
  add("yugi", "Yugi", 1, "Yugi", "Yugi", "yugi", {
    intro: ["Welcome! I'm Yugi. Let's have a fun duel and show me your deck!"],
    win: ["Wow, you're strong! My grandpa would be impressed."],
    lose: ["Heh, my Dark Magician came through. Let's duel again sometime!"],
    banter: ["Let's duel again! I've been practising with grandpa."],
  });
  add("tristan", "Tristan", 1, "Tristan", "Tristan", "tristan", {
    intro: ["I'm Tristan Taylor. Beat me 5 times and you can move on. Piece of cake, right?"],
    win: ["Aw man! Joey's never gonna let me hear the end of this."],
    lose: ["Ha! Who's the champ now? Better luck next time, pal."],
  });
  add("joey", "Joey", 1, "Joey", "Joey", "joey", {
    intro: ["Joey Wheeler's the name! My Flame Swordsman is gonna toast ya!"],
    win: ["Nyeh... I lost?! Okay, okay, you got me this time."],
    lose: ["Whoo! That's what I'm talkin' about! Joey wins again!"],
  });
  add("mai", "Mai", 1, "Mai", "Mai", "mai", {
    intro: ["Hmph. I'm Mai Valentine. My Harpie Ladies don't lose to amateurs."],
    win: ["Not bad, hon. Maybe you're not such an amateur after all."],
    lose: ["As expected. Come back when you've learned to duel, sweetie."],
  });
  // Mako duels around his ace: Fortress Whale is a ritual, so he needs the skill to perform one (the AI only rituals
  // from skill 2, and a rookie's ritual cards are stripped out of his deck as dead weight)
  add("mako", "Mako", 1, "Mako", "Mako", "mako", {
    skill: 2,
    intro: ["I am Mako Tsunami! My Fortress Whale will make you fear the ocean!"],
    win: ["The sea has spoken... You are a worthy duelist!"],
    lose: ["The ocean claims another! Ha ha ha!"],
  });
  // ---- Stage 2: Domino Town 2 (clockwise from Esp Roba)
  add("esproba", "Esp Roba", 2, "Esp Roba", "Esp Roba", "esproba", {
    intro: ["I am Esp Roba. My psychic powers already see your defeat!"],
    win: ["Impossible... my powers... they didn't foresee this!"],
    lose: ["Just as I predicted. My ESP never fails."],
  });
  add("rex", "Rex", 2, "Rex", "Rex", "rex", {
    intro: ["Rex Raptor here! My dinosaurs are gonna stomp you flat!"],
    win: ["Grr! My dinos got extinct again!"],
    lose: ["Roar! Nobody beats the dino king!"],
  });
  add("weevil", "Weevil", 2, "Weevil", "Weevil", "weevil", {
    intro: ["Hee hee! I'm Weevil Underwood. My insects will devour your deck!"],
    win: ["My precious bugs... squashed!"],
    lose: ["Hee hee hee! Crushed like a bug!"],
  });
  add("kaiba", "Kaiba", 2, "Kaiba", "Kaiba", "kaiba", {
    intro: ["Seto Kaiba. Don't waste my time. My Blue-eyes will end this quickly."],
    win: ["This can't be... Enjoy it while you can. Next time will be different."],
    lose: ["Pathetic. You never stood a chance against my Blue-eyes."],
  });
  add("pandora", "Pandora", 2, "Pandora", "Pandora", "pandora", {
    intro: ["I am Pandora, the master magician. Prepare for a dark performance!"],
    win: ["My grand finale... ruined!"],
    lose: ["And that concludes the show. Bravo to me!"],
  });
  add("seeker", "Seeker", 2, "Seeker", "Seeker", "seeker", {
    intro: ["I am a Rare Hunter. Your rare cards will soon belong to me!"],
    win: ["Ugh... the master will not be pleased."],
    lose: ["Your cards are as weak as you are."],
  });
  // ---- Stage 3: Ancient Egypt (clockwise from Paradox)
  // "Paradox" is the guide's name for Simone Mooran - Simon Muran, the Pharaoh's advisor. Renamed so he is not
  // mistaken for the Para Dox brothers; the key stays "paradox" so saves and drop lists still find him.
  add("paradox", "Simon", 3, "Paradox", "Paradox", "paradox", {
    intro: ["I am Simon Muran, who counselled the Pharaoh. Let me measure your heart."],
    win: ["Your heart is steady. Heishin's shadow may yet be lifted."],
    lose: ["Not yet, duelist. Come back when your spirit is surer."],
    banter: ["The priest Heishin watches this place. Tread carefully."],
  });
  add("pseto", "P. Seto", 3, "P.Seto", "P. Seto", "pseto", {
    intro: ["I am Seto, high priest of the Pharaoh. Face the might of the white dragon!"],
    win: ["The dragon... has bowed to you. Remarkable."],
    lose: ["Kneel before the priest of the Pharaoh!"],
  });
  add("ishizu", "Ishizu", 3, "Ishizu", "Ishizu", "ishizu", {
    intro: ["My name is Ishizu Ishtar, descendant of Egyptian royalty. Fate has brought you here."],
    win: ["The Millennium Necklace showed me this outcome. Well fought."],
    lose: ["It was written. You could not change your fate."],
  });
  add("slysheen", "Slysheen", 3, "Slysheen", "Slysheen", "slysheen", {
    intro: ["I am Slysheen, keeper of the dark tombs. The fiends obey me!"],
    win: ["The fiends... have abandoned me!"],
    lose: ["The darkness swallows all!"],
  });
  // ---- Stage 4: The Heavens
  add("darknite", "DarkNite", 4, "DarkNite", "DarkNite", "darknite", { skill: 4,
    intro: ["I am DarkNite, ruler of the heavens! No mortal duelist can defeat me!"],
    win: ["Impossible! Defeated by a mortal?! This is not... my true form..."],
    lose: ["Bow before the Card Ruler! Ha ha ha!"],
  });
  add("yamiyugi", "Yami Yugi", 4, "YamiYugi", "Yami Yugi", "yamiyugi", { skill: 4,
    hidden: true, password: "70715281",
    intro: ["I am Yami Yugi. A visitor in my room... Come in, if you dare. It's time to duel!"],
    win: ["You have the heart of the cards. I'm proud to have dueled you."],
    lose: ["The heart of the cards guided me once more."],
  });
  add("yamibakura", "Yami Bakura", 4, "YaBakura", "Bakura", "yamibakura", {
    hidden: true, password: "07119986", skill: 4,
    intro: ["Hehe... Let the Shadow Games begin..."],
    win: ["Grr... my Millennium Ring... it grows dim..."],
    lose: ["Hehehe... your soul belongs to the shadows now."],
  });
  add("nitemare", "Nitemare", 4, "Nitemare", "Nitemare", "nitemare", {
    hidden: true, password: "43504084", skill: 4,
    intro: ["Behold my TRUE FORM! I am Nitemare! What is yours is mine now - monsters and soul alike!"],
    win: ["NOOO! Banished... back to the darkness!"],
    lose: ["Your nightmare has only just begun!"],
  });
  add("shadi", "Shadi", 4, "Shadi", "Shadi", "shadi", {
    hidden: true, password: "70592699", skill: 4,
    intro: ["I am Shadi. I am a descendant of Anubis's disciple. Let the Millennium Scale weigh your heart."],
    win: ["Your heart is pure. The Millennium Items acknowledge you."],
    lose: ["The scales have judged you unworthy."],
  });
  add("marik", "Marik", 4, "Marik", "Marik", "marik", {
    hidden: true, password: "06987398", skill: 4,
    intro: ["I am Marik Ishtar. With the Millennium Rod, I will control your very mind!"],
    win: ["The Rod... it doesn't respond?! You've broken my control!"],
    lose: ["Your mind is mine. Ha ha ha!"],
  });

  // ---- FREE DUEL challengers: eight faces from the Japanese cartridge who never made the campaign map. They are not
  // part of any area (the 5-wins-per-area gates and the ending are untouched): they appear in the FREE DUEL list once
  // you reach their stage, join the tournament pool, and bring the themed decks below (`core` = [card id, copies]).
  function challenger(key, name, stage, portrait, gen, opts) {
    add(key, name, stage, null, null, portrait, Object.assign({ free: true, gen }, opts || {}));
  }
  // Mokuba fights with small machines and the one card he borrowed from his big brother. He never pays an offering
  // at stage 1 skill, so the dragon arrives the way a little brother would do it: Lord of D. flutes it straight out
  // of his hand. The rest of the deck came down to make room (his machines are capped lower than they were).
  challenger("mokuba", "Mokuba", 1, "mokuba", { types: ["Machine", "Dragon"], cap: 1200,
    core: [[1, 1], [741, 2], [736, 1], [512, 2], [422, 2], [410, 3], [325, 2], [344, 2], [339, 2], [681, 2]] }, {
    intro: ["I'm Mokuba Kaiba! My big brother taught me everything, so watch out!"],
    win: ["No fair! I want a rematch... after I borrow some of Seto's cards."],
    lose: ["Ha! Wait till I tell my big brother about this!"],
  });
  // Tea duels on life points: every monster and spell she owns pays LP back
  challenger("tea", "Tea", 1, "tea", { types: ["Fairy", "Magician"], cap: 1650,
    core: [[229, 3], [462, 3], [363, 3], [547, 3], [612, 3], [342, 2], [341, 3], [340, 2], [339, 2], [688, 2]] }, {
    intro: ["Hi, I'm Tea Gardner. Friendship beats brute force any day. Let's duel!"],
    win: ["Nice moves! I'll practise more and we'll do this again."],
    lose: ["See? Believing in your deck really does work!"],
  });
  // Ryou Bakura: monsters that take their killer down with them, and every way to borrow what you played
  challenger("bakura", "R. Bakura", 2, "bakura", { types: ["Fiend", "Zombie"], cap: 1600,
    core: [[135, 3], [501, 3], [256, 3], [393, 2], [394, 2], [399, 2], [736, 1], [769, 2],
           [166, 2], [376, 2], [641, 1], [784, 1], [781, 1], [102, 2]] }, {
    intro: ["Oh, hello. I'm Bakura. My Ring has been ever so quiet today... shall we duel?"],
    win: ["Well played! That was fun - the friendly kind of duel, for once."],
    lose: ["Oh dear. I do hope that wasn't the Ring's doing again."],
  });
  // Keith: machines, the parts that make them stronger, and cards that ride on a coin flip
  challenger("keith", "B. Keith", 2, "keith", { types: ["Machine"], cap: 1900,
    core: [[743, 2], [429, 3], [16, 2], [407, 2], [752, 2], [736, 1], [512, 2], [422, 3], [325, 3], [658, 2], [347, 2], [803, 1], [804, 1]] }, {
    intro: ["Bandit Keith. I don't lose, kid - and when I do, I cheat. Let's play."],
    win: ["You cheated! Nobody beats Keith straight up... nobody!"],
    lose: ["Ha! Made in America, kid. Better luck never."],
  });
  // the Paradox Brothers: the labyrinth itself, and the Gate Guardian waiting at the end of it
  // the Paradox Brothers duel as one opponent: Para speaks, then Dox answers (see `duo` and Screens.duelistTalk)
  // the maze's own monsters (Guardian, Tank, Wall Shadow, Dungeon Worm) are summoned-only, so the wall calls them
  const MAZE = [[366, 1], [652, 3], [667, 2], [371, 2], [372, 2], [373, 2], [324, 2], [684, 2], [748, 2], [669, 1]];
  challenger("para", "Para & Dox", 3, "para", { types: ["Rock", "Fiend"], cap: 1800, core: MAZE }, {
    intro: ["I am Para. My brother and I never lose... and never split up."],
    win: ["A gap in the maze. Dox will close it, mark my words."],
    lose: ["Lost in the labyrinth, and you will not find the way out."],
    duo: {
      key: "dox",
      intro: ["And I am Dox. Two duelists, one deck. Try to keep up."],
      win: ["Impossible... you walked the maze twice and lived."],
      lose: ["Two brothers, one labyrinth. Nobody leaves."],
    },
  });
  challenger("panik", "Panik", 3, "panik", { types: ["Fiend", "Zombie"], cap: 2100,
    core: [[22, 2], [83, 2], [500, 2], [368, 2], [335, 1], [669, 1], [686, 2], [303, 2], [82, 2]] }, {
    intro: ["I am Panik. Fear is a card too - and I hold every copy."],
    win: ["My darkness... you walked straight through it!"],
    lose: ["Panic. Terror. Defeat. In that order, always."],
  });
  // Pegasus: Toons paid for by monsters that copy themselves, plus every way to take or absorb what you play
  challenger("pegasus", "Pegasus", 4, "pegasus", { types: ["Magician"], cap: 1600,
    core: [[823, 1], [822, 3], [728, 1], [729, 1], [727, 1], [767, 1], [821, 1], [9, 2], [195, 2], [785, 1],
           [166, 2], [376, 2], [641, 1], [784, 1], [781, 1], [783, 1], [730, 2], [733, 2], [790, 1]] }, {
    intro: ["Pegasus J. Crawford, at your service. I do so love reading a new hand."],
    win: ["Oh my. You have a most interesting mind, boy... most interesting."],
    lose: ["Toon-derful! Thank you for the entertainment."],
  });
  // Solomon: draw, search, and five pieces he will never let go of
  challenger("solomon", "S. Muto", 4, "solomon", { types: ["Dragon", "Magician"], cap: 1900,
    core: [[17, 1], [18, 1], [19, 1], [20, 1], [21, 1], [789, 1], [813, 1], [540, 3], [463, 1], [425, 3], [48, 1], [574, 1],
           [35, 1], [65, 2], [749, 2], [428, 1], [342, 2], [1, 1], [657, 1], [337, 1], [348, 1],
           [315, 2], [332, 1]] }, {   // Dragon Treasure and Mountain: the Blue-eyes is his second way to win
    intro: ["Solomon Muto, at your service! These old cards still have some fight in them."],
    win: ["Hoho! Beaten by a youngster. Yugi will be delighted."],
    lose: ["Respect your elders - and their card collection!"],
  });

  const byKey = {};
  for (const d of D) byKey[d.key] = d;
  const STAGES = [
    null,
    { name: "Domino Town 1", bg: 9, keys: ["yugi", "tristan", "joey", "mai", "mako"], slotOrder: [0, 1, 3, 4, 2] },
    { name: "Domino Town 2", bg: 10, keys: ["esproba", "rex", "weevil", "kaiba", "pandora", "seeker"], slotOrder: [0, 1, 2, 5, 4, 3] },
    { name: "Ancient Egypt", bg: 11, keys: ["paradox", "pseto", "ishizu", "slysheen"], slotOrder: [0, 1, 3, 2] },
    // DarkNite is the campaign's last gate and Yami Yugi the door past him; the other four unlock together, so they
    // are listed in the order they actually play - measured, easiest first (tools/sim_curve.js)
    { name: "The Heavens", bg: 12, keys: ["darknite", "yamiyugi", "shadi", "marik", "yamibakura", "nitemare"], slotOrder: null },
  ];
  // ---- difficulty: every duelist's deck can be "upgraded" k times (its k weakest cards swapped for the strongest cards
  // it can field, its own signature cards first). BOOST is the baseline that lines the roster up in stage order; from
  // Domino Town 2 on, every win against a duelist adds 2 more upgrades (up to 3/4/3 wins by stage) and every 3 wins add
  // a skill level (one above the stage's base at most), so a beaten duelist comes back harder but stays farmable.
  const BOOST = {
    yugi: -4, tristan: 9, joey: 4, mai: 11, mako: 3,
    esproba: 1, rex: 5, weevil: 1, kaiba: 7, pandora: -1, seeker: 9,
    paradox: 0, pseto: -5, ishizu: 7, slysheen: 1,
    mokuba: 0, tea: 2, bakura: 0, keith: 4, para: 4, panik: 6, pegasus: 5, solomon: 12,
    darknite: -39, yamiyugi: -21, shadi: -10, marik: -17, yamibakura: -17, nitemare: -53,
  };
  // Not a duelist's PLAN, but theirs all the same: a searcher for the type their deck is built on, or a card they
  // are written to borrow. Forced in exactly like an ace, in both builds. (The user, 2026-09-24.)
  const TECH = {
    mako: [73, 73],                // Kairyu-shin: his own card, and the one that digs for the magic of the sea
    tristan: [820], joey: [820],   // Reinforcement of the Army, for the two decks actually built on Warriors
                                   // (R. Bakura's are filler in a Fiend deck, so he does not get it)
    // the thief: the cartridge gave him three each of these, and they are what his duel is about. TECH forces them
    // into his deck and protects them from a balance pass without claiming them off anyone else (2026-09-24)
    nitemare: [376, 376, 166, 166, 641, 641, 781, 784],
    yamiyugi: [16],                               // the Time Wizard he borrows from Joey to make Dark Sage
  };
  const aceOf = (d) => (ACE[d.key] || []).concat(TECH[d.key] || []);
  const KEEP = new Set([17, 18, 19, 20, 21]); // Exodia: held in hand, never summoned, fused or thrown away
  // The cards a duelist is known for, which no upgrade may swap out. Gaia and Curse of Dragon are the only recipe
  // there is for Gaia the Dragon Champion, and Joey's Red-eyes is half of B. Skull Dragon and all of the Metal
  // Dragon that Metalmorph makes of it - a deck that trades one of those away for a bigger body can never show its
  // owner's ace at all.
  // What each duelist's PLAN cannot do without. Nothing here is ever upgraded, downgraded or thinned away, and
  // `ensureAces` puts anything missing back into the deck - a balance pass must never cost a character their plan.
  const ACE = {
    yugi: [35, 760, 38, 39],         // the Dark Magician and his Girl; Gaia + Curse of Dragon = Gaia the Dragon Champion
    tristan: [773],                  // Sword Hunter leads the battleguards
    joey: [82, 658, 22, 4, 16],      // Red-eyes, its Metalmorph, the Summoned Skull it fuses with, Baby Dragon + Time Wizard
    mai: [63, 62, 318],              // Harpie's Pet Dragon, the Ladies, and the Egotist that multiplies them
    mako: [700, 441, 334],           // the Whale's Oath, the Mech Bass that pays it, and the sea it is fought in
    esproba: [752],                  // Jinzo shuts the traps down: without it he is a pile of machines
    rex: [32, 81],                   // the two halves of Bracchio-raidus
    weevil: [278, 72, 762],          // the moth line and the Queen that feeds on the swarm
    kaiba: [1, 675, 332, 741, 315],  // the Blue-eyes, the Ultimate Dragon ritual, and the cards that stand behind it
    pandora: [35],                   // the Dark Magician he is built around
    paradox: [679, 160, 161],        // Novox's Prayer and both M-warriors it is paid with
    pseto: [1, 808],                 // his Blue-eyes, and the White-Horned Dragon beside it
    ishizu: [676, 698],              // her two rituals
    slysheen: [693, 102],            // the Contract and the masks that pay it
    darknite: [652],                 // Magical Labyrinth calls the maze out
    yamiyugi: [670, 722, 35],        // Black Luster Soldier, the Magician of Black Chaos, and the Magician himself
    // (Nitemare's plan lives in TECH - see there: everything you play ends up on his side of the field)
    shadi: [678],                    // Revival of Sennen Genjin brings out Sengenjin
    marik: [671, 674],               // Zera the Mant and the Fiend's Mirror
    seeker: [17, 18, 19, 20, 21, 789, 665, 296],  // the five pieces, the Pot that digs for them, and the wall he hides behind
    yamibakura: [368, 759, 813, 83],    // Shadow Ghoul, the Doll that comes back, the Call, and the Castle over them
  };
  // Every duelist in the game carries these, whoever they are and whatever stage they are on (the user's rule,
  // 2026-09-23): the answers to a board, the answer to a backrow, and a card that digs. A duel should always be
  // winnable from behind, and these are how.
  const STAPLES = [337, 336, 814, 789, 672, 818];   // Raigeki, Dark Hole, Mirror Force, Pot of Greed, Harpie's
                                                    // Feather Duster, Monster Reborn
  function ensureStaples(deck, d) {
    const count = (id) => deck.filter((x) => x === id).length;
    const keep = new Set(aceOf(d).concat(STAPLES, [420]));   // the Stein is what pays a ritual: never its slot
    for (const id of deck) { const r = Effects.ritual[id]; if (r) { keep.add(id); for (const n of r.need) keep.add(n); if (r.oneOf) for (const n of r.oneOf) keep.add(n); } }
    for (const id of (d.gen && d.gen.core || []).map(([x]) => x)) keep.add(id);
    for (const id of STAPLES) {
      if (count(id) > 0) continue;
      let worst = -1, wv = Infinity;
      deck.forEach((x, i) => {
        const c = CardDB.get(x); if (!c || keep.has(x)) return;
        const v = c.kind === "M" ? cardPower(c) : (POWER_SPELLS[x] || 300);
        if (v < wv) { wv = v; worst = i; }
      });
      if (worst < 0) break;
      deck[worst] = id;
      keep.add(id);
    }
    return deck;
  }
  // any ace that fell out of a deck during the upgrade, downgrade or limit pass goes back in, the weakest card first
  function ensureAces(deck, d) {
    const want = aceOf(d);
    if (!want.length) return deck;
    const count = (id) => deck.filter((x) => x === id).length;
    const keep = new Set(want);
    for (const id of deck) { const r = Effects.ritual[id]; if (r) { keep.add(id); for (const n of r.need) keep.add(n); } }
    // listing an id twice asks for two copies: `want` is walked in order, and each pass only stops when the deck
    // already holds as many as have been asked for so far (2026-09-24, so Mako can run more than one Kairyu-shin)
    const asked = {};
    for (const id of want) {
      asked[id] = (asked[id] || 0) + 1;
      if (count(id) >= asked[id] || !CardDB.get(id) || Banlist.limit(id) < asked[id]) continue;
      let worst = -1, wv = Infinity;
      deck.forEach((x, i) => {
        const c = CardDB.get(x); if (!c || keep.has(x)) return;
        const v = c.kind === "M" ? cardPower(c) : 1200;      // a spell is worth about a mid monster to give up
        if (v < wv) { wv = v; worst = i; }
      });
      if (worst < 0) break;
      deck[worst] = id;
      keep.add(id);
    }
    return deck;
  }
  const POWER_SPELLS = { 337: 3000, 784: 2600, 342: 2500, 336: 2400, 348: 2200, 781: 2200, 661: 2200, 686: 2200, 789: 2000, 685: 2000, 684: 1500, 669: 1400, 672: 1300, 347: 1000, 683: 1000, 814: 2000, 813: 1800, 815: 900 };
  function cardPower(c) {
    if (c.kind !== "M") return POWER_SPELLS[c.id] || 300;
    return c.atk + c.def * 0.2 + (Effects.bonus[c.id] || 0);
  }
  // effect monsters in character for each duelist: upgrades reach for these before anything else
  const THEME = {
    yugi: [35, 760, 58, 22, 48, 574, 102, 741, 220, 104, 428, 387, 801, 38, 39, 41, 6],
    kaiba2: [], tristan: [12, 554, 753, 773, 820, 262, 641, 185, 195], joey: [82, 15, 16, 4, 820, 425, 512, 736, 26, 658, 22, 78, 68],
    mai: [62, 63, 386, 429, 768, 616, 260, 363, 812], mako: [524, 602, 583, 393, 398, 484, 475, 547, 140, 249, 728, 285, 536],
    esproba: [752, 754, 736, 420, 512, 417, 407, 422, 410, 460], rex: [15, 500, 748, 773, 263, 531], weevil: [278, 278, 56, 56, 72, 762, 763, 766, 764, 501, 562, 506, 478, 609, 591, 810, 348, 686, 684, 349],
    kaiba: [1, 767, 40, 500, 420, 755, 65, 26], pandora: [35, 744, 739, 741, 114, 220, 102, 721, 104, 42, 179, 129, 728], seeker: [17, 18, 19, 20, 21, 789, 48, 574, 463, 540, 665, 296, 348, 349, 669, 758, 42, 740, 733, 170, 255, 751, 748, 769],
    paradox: [224, 744, 469, 586, 266, 583, 102, 84, 103, 584, 134, 160, 161, 348, 669, 349], pseto: [1, 500, 40, 794, 65, 525, 808], ishizu: [109, 429, 492, 540, 229, 462, 616, 547, 768, 612, 363, 260, 809], slysheen: [99, 368, 83, 102, 574, 749, 750, 759, 769, 217, 9, 24, 135, 139, 148, 36, 154],
    darknite: [369, 370, 366, 794, 797, 755, 217, 187, 362], yamiyugi: [35, 760, 58, 22, 48, 574, 102, 721, 741, 739, 16, 104, 428, 387, 117, 801, 814], yamibakura: [368, 99, 83, 759, 475, 813, 102, 596, 97, 351, 132, 96, 241, 591, 562, 768],
    nitemare: [376, 641, 166, 781, 784, 720, 337, 348, 657, 375, 369, 370, 236, 366, 652, 794, 797, 217, 584], shadi: [109, 429, 748, 751, 641, 166, 376, 462, 362, 103, 612], marik: [641, 166, 376, 40, 762, 743, 752, 584, 187, 805],
  };

  // a themed 40-card deck for a Free Duel challenger, built the same way every time (no dice): the cards that make the
  // deck what it is, then the strongest monsters of its types under the power cap, then whatever else fits.
  const genCache = {};
  function genDeck(d, capBonus) {
    const key = d.key + ":" + (capBonus || 0);
    if (genCache[key]) return genCache[key].slice();
    const g = d.gen, deck = [], count = {}, cap = g.cap + (capBonus || 0);
    // a per-duelist TRIM caps a generated deck the same way it caps a guide deck: Blast Sphere only burns once a
    // duel, so Keith's Machine fill must not keep handing him three of them (2026-09-24)
    const gtrim = TRIM[d.key] || {};
    const put = (id, n) => { const lim = Math.min(Banlist.limit(id), gtrim[id] === undefined ? 99 : gtrim[id]); for (let i = 0; i < n && deck.length < 40; i++) { if ((count[id] || 0) >= lim) break; deck.push(id); count[id] = (count[id] || 0) + 1; } };
    for (const [id, n] of g.core || []) if (mayHold(d, id)) put(id, n);
    const hasRitual = (g.core || []).some(([id]) => CardDB.get(id) && CardDB.get(id).kind === "R");
    // Cyber-Stein is a Machine, so a Machine theme kept picking it up as a 700 ATK body with nothing to fetch
    // ...and it may not reach for a card that belongs to somebody else: this fill is by TYPE, so a Dragon deck was
    // quietly helping itself to the Red-eyes and a Fiend deck to the Summoned Skull (the user's deck audit, 2026-09-23)
    const fits = (c) => c.kind === "M" && Banlist.limit(c.id) > 0 && !Banlist.ritualOnly(c.id) && c.atk <= cap && CardDB.tributesFor(c) <= 1 && !KEEP.has(c.id) && (c.id !== 420 || hasRitual) && mayHold(d, c.id);
    const themed = CardDB.all.filter((c) => fits(c) && g.types.includes(c.ty)).sort((a, b) => cardPower(b) - cardPower(a));
    for (const c of themed) { if (deck.length >= 36) break; put(c.id, 3); }
    // the last few slots are plain monsters: effect cards belong to the deck's own theme, not to the filler
    for (const c of themed) { if (deck.length >= 40) break; put(c.id, 3); }   // more of the theme before anything else
    const rest = CardDB.all.filter((c) => fits(c) && !g.types.includes(c.ty) && !Effects.isEffect(c.id)).sort((a, b) => cardPower(b) - cardPower(a));
    for (const c of rest) { if (deck.length >= 40) break; put(c.id, 2); }
    genCache[key] = deck;
    return deck.slice();
  }
  // ---------------------------------------------------------------- deck themes
  // what each duelist is known for, where their guide deck alone does not say it loudly enough
  const THEME_TYPES = {
    kaiba: ["Dragon", "Machine"], mokuba: ["Machine", "Dragon"], pseto: ["Dragon"], joey: ["Dragon", "Warrior"],
    paradox: ["Magician"], ishizu: ["Fairy"],   // Simon binds with spellcasters, Ishizu strikes with fairies
    mai: ["WngBeast", "Fairy"], mako: ["Fish", "SeaDragn", "Reptile"], rex: ["Reptile"], esproba: ["Thunder", "Machine"],
    yugi: ["Dragon"], yamiyugi: ["Dragon", "Magician"], yamibakura: ["Zombie", "Fiend"], marik: ["Zombie", "Reptile"],
    slysheen: ["Zombie"], panik: ["Fiend"], keith: ["Machine"], pegasus: ["Magician"], tea: ["Fairy"],
    solomon: ["Dragon"], bakura: ["Fiend", "Zombie"], para: ["Rock"], nitemare: ["Fiend"], darknite: ["Fiend"],
  };
  // What a duelist's deck is MADE of, read off their own cards: the monster types their guide deck is built from
  // (or the generated challenger's declared types), plus every card they are associated with. Upgrades are drawn
  // from this, so a stronger Mako is a stronger WATER duelist and never turns up holding a Blue-eyes.
  const themeCache = {};
  function themeOf(d) {
    if (themeCache[d.key]) return themeCache[d.key];
    const ids = new Set(), ty = {}, el = {}, mons = [];
    for (const id of (THEME[d.key] || []).concat(RESERVE[d.key] || [])) ids.add(id);
    if (d.gen) for (const [id] of d.gen.core || []) ids.add(id);
    else for (const raw of (window.DDS_DECKS[d.deckKey] || [])) {
      const id = Banlist.ritualOnly(raw) ? (Effects.summonerOf(raw) || raw) : raw;
      ids.add(id); const c = CardDB.get(id); if (c && c.kind === "M") { mons.push(c); ty[c.ty] = (ty[c.ty] || 0) + 1; el[c.el] = (el[c.el] || 0) + 1; }
    }
    // a type the deck actually leans on: at least three copies and a tenth of its monsters
    const types = new Set((d.gen ? d.gen.types : Object.keys(ty).filter((k) => ty[k] >= 3 && ty[k] >= mons.length * 0.15)).concat(THEME_TYPES[d.key] || []));
    // and the element it is built around, when it really is built around one - that is what makes Mako a water
    // duelist rather than an Aqua-type duelist: it takes in his Sea Dragons, his Fish and his sea serpents too
    const els = new Set(Object.keys(el).filter((k) => el[k] >= 6 && el[k] >= mons.length * 0.5));
    // every monster type the duelist is associated with at all, however thinly - the element rule leans on this
    const kinds = new Set();
    for (const id of ids) { const c = CardDB.get(id); if (c && c.kind === "M") kinds.add(c.ty); }
    for (const t of types) kinds.add(t);
    return (themeCache[d.key] = { ids, types, els, kinds });
  }
  // The signature monsters, exactly as the user listed them (2026-09-23): a character's calling cards, respected
  // between characters EVERYWHERE - the cartridge's own decks included, so Panik does not get to open with Joey's
  // Red-eyes. A ritual card is listed next to what it brings out, because owning the monster means nothing if
  // anybody may run the card that makes it. Tristan, Tea, Yami Bakura, R. Bakura and Panik have none by that list.
  const SIGNATURE_OF = {
    yugi: [35, 760, 38, 41, 58, 785],    // D. Magician and his Girl, Gaia, Celtic Guardian, Kuriboh, Multiply
    joey: [82, 15, 16],                  // Red-eyes, Flame Swordsman, Time Wizard
    mako: [718, 700, 73],                // Fortress Whale and its Oath, Kairyu-shin
    mokuba: [1], pseto: [1],             // the Blue-eyes
    solomon: [17, 18, 19, 20, 21, 1],    // Exodia, and Grandpa's Blue-eyes
    mai: [62, 63],                       // Harpie Lady and her Sister
    esproba: [752],                      // Jinzo
    rex: [706, 691, 82, 32],             // Serpent Night Dragon and its revival, the Red-eyes, Two-headed King Rex
    weevil: [57, 67, 762, 763, 278, 72, 56],   // Great Moth, Perfectly Ultimate, Insect Queen, Paracide, and the line
    seeker: [17, 18, 19, 20, 21, 362, 665],    // Exodia and the Millennium Shield he hides behind
    pandora: [35],                       // the Dark Magician
    kaiba: [1, 380, 675, 379, 378, 26, 741],   // Blue-eyes, the Ultimate Dragon and its ritual, La Jinn, Swordstalker,
                                               // Battle Ox, Lord of D.
    paradox: [704, 679],                 // Skull Guardian and Novox's Prayer
    ishizu: [809],                       // Wingweaver
    slysheen: [720, 693, 715, 695],      // Mask of Shine & Darkness and Psycho-Puppet, with the cards that pay them
    // the maze is shared by the three the cartridge wrote it into; the Gate Guardian is the brothers' alone
    darknite: [366, 369, 370, 236, 375, 652], nitemare: [366, 369, 370, 236, 375, 652],
    para: [366, 369, 370, 236, 375, 652, 374, 667, 371, 372, 373],
    yamiyugi: [35, 721, 722, 801, 364, 670, 16, 817],   // D. Magician, Magician of Black Chaos, Buster Blader, Black
                                               // Luster Soldier, and the Time Wizard he borrows to make Dark Sage
    shadi: [703, 678, 362, 665],         // Sengenjin and the Millennium Shield
    marik: [360, 671, 703, 678, 362, 665],     // Zera the Mant, Sengenjin, the Millennium Shield
    // Nitemare's theft package is in TECH, not here: those cards are generic and half the roster plays them.
    // What is his, shared with the other two the cartridge wrote it into, is the maze.
    keith: [407, 723, 391, 392, 743, 752],     // Machine King, Slot Machine, Zoa into Metalzoa, Barrel Dragon, Jinzo
    pegasus: [727, 728, 729, 767, 821, 823, 822, 731, 783, 734],   // every Toon and the book they live in,
                                                   // Relinquished and its ritual, Thousand-eyes Restrict
  };
  const SIGNATURE = (() => {
    const m = {};
    for (const k in SIGNATURE_OF) for (const id of SIGNATURE_OF[k]) (m[id] = m[id] || []).push(k);
    return m;
  })();
  // cards that belong to a character without being an ace of theirs - the rest of a family whose head already is
  const FAMILY = {
    738: ["yamiyugi"], 757: ["yamiyugi"],   // Alpha and Beta: the Magnet Warriors are Yugi's, not Rex's Rock filler
    386: ["mai"], 812: ["mai"], 318: ["mai"],   // the rest of the Harpie family follows the Ladies: the Pet Dragon,
                                                 // the Brother, and the Egotist that fetches them
  };
  // Two layers of ownership. A SIGNATURE card is a character's calling card and is respected everywhere, even
  // against the cartridge's own deck lists. An ACE is the card a duelist's plan is built on, and nobody else may
  // pick one up from a fill or an upgrade - but a duelist the cartridge WRITES with that card keeps it, because it
  // is part of the deck they were shipped with. (The user's deck audit, 2026-09-23: `inTheme` only ever checked
  // types, so anybody fielding one Magician could reach for anybody else's Magician.)
  const OWNERS = (() => {
    const m = {};
    const add = (id, keys) => { (m[id] = m[id] || new Set()); for (const k of keys) m[id].add(k); };
    for (const id in FAMILY) add(Number(id), FAMILY[id]);
    for (const k in ACE) ACE[k].forEach((id) => add(id, [k]));
    return m;
  })();
  const writtenCache = {};
  function written(d) {
    if (!writtenCache[d.key]) writtenCache[d.key] = new Set(d.gen ? (d.gen.core || []).map(([id]) => id) : (window.DDS_DECKS[d.deckKey] || []));
    return writtenCache[d.key];
  }
  // somebody else's card is not for sale, wherever a deck is being filled from
  function mayHold(d, id) {
    const sig = SIGNATURE[id];
    if (sig) return sig.includes(d.key);          // a calling card: owners only, no exceptions
    const o = OWNERS[id];
    return !o || o.has(d.key) || written(d).has(id);
  }
  // spell and trap cards are not what makes a duelist: every character in the game plays the same magic
  function inTheme(d, id) {
    const c = CardDB.get(id); if (!c) return false;
    if (!mayHold(d, id)) return false;              // somebody else's, whatever types this duelist plays
    if (c.kind !== "M") return true;
    if (SIGNATURE[id] || OWNERS[id]) return true;   // theirs by name: no need to ask the types
    const t = themeOf(d);
    if (t.ids.has(id) || t.types.has(c.ty)) return true;
    return t.els.has(c.el) && t.kinds.has(c.ty);   // the right element, and a type this duelist fields
  }
  let powerAll = null;
  function powerPool(d) { // strongest cards first, but only cards that belong in this duelist's deck
    if (!powerAll) powerAll = CardDB.all.filter((c) => Banlist.limit(c.id) > 0 && c.kind !== "R");
    const own = new Set(Duelists.drops(d).concat(THEME[d.key] || []));
    return powerAll.filter((c) => inTheme(d, c.id)).map((c) => ({ id: c.id, v: cardPower(c) + (own.has(c.id) ? 400 : 0) })).sort((a, b) => b.v - a.v).map((x) => x.id);
  }
  function upgradeDeck(deck, d, k) {
    if (k <= 0) return deck;
    // a challenger's signature cards stay put, and so does every ritual card and the monsters it needs as offerings
    const core = new Set((d.gen && d.gen.core || []).map(([id]) => id));
    for (const id of aceOf(d)) core.add(id);
    for (const id of deck) { const r = Effects.ritual[id]; if (r) { core.add(id); for (const n of r.need) core.add(n); } }
    const pool = powerPool(d), count = (id) => deck.filter((x) => x === id).length;
    // magic outranks monsters on raw power, so without a budget every upgrade slot became another spell and the
    // monster line never improved: most of the swaps have to buy monsters
    const spells = () => deck.filter((id) => { const c = CardDB.get(id); return c && c.kind !== "M"; }).length;
    const spellBudget = Math.max(2, Math.ceil(k / 3));
    let spellsTaken = 0;
    const blocked = (id) => { const c = CardDB.get(id); return !c || (c.kind !== "M" && (spellsTaken >= spellBudget || spells() >= 10)); };
    const order = deck.map((id, i) => ({ i, v: cardPower(CardDB.get(id)) })).filter((x) => !core.has(deck[x.i])).sort((a, b) => a.v - b.v);
    let pi = 0;
    for (let n = 0; n < k && n < order.length; n++) {
      while (pi < pool.length && (count(pool[pi]) >= Banlist.limit(pool[pi]) || blocked(pool[pi]) || cardPower(CardDB.get(pool[pi])) <= order[n].v)) pi++;
      if (pi >= pool.length) break;
      const taken = pool[pi++]; if (CardDB.get(taken).kind !== "M") spellsTaken++;
      deck[order[n].i] = taken;
    }
    return deck;
  }
  // The other end of the same dial: a duelist whose guide deck is already stronger than the stage wants gives its
  // k biggest cards back for weaker ones of ITS OWN theme, so the character is untouched and only the power moves.
  // (BOOST goes negative for that; the tournament ignores it, because there everyone brings their best.)
  function downgradeDeck(deck, d, k) {
    if (k <= 0) return deck;
    const core = new Set((d.gen && d.gen.core || []).map(([id]) => id));
    for (const id of aceOf(d)) core.add(id);
    for (const id of deck) { const r = Effects.ritual[id]; if (r) { core.add(id); for (const n of r.need) core.add(n); } }
    const pool = powerPool(d).filter((id) => CardDB.get(id).kind === "M").reverse();   // their own theme, weakest first
    const count = (id) => deck.filter((x) => x === id).length;
    const order = deck.map((id, i) => ({ i, v: cardPower(CardDB.get(id)) }))
      .filter((x) => !core.has(deck[x.i]) && CardDB.get(deck[x.i]) && CardDB.get(deck[x.i]).kind === "M")
      .sort((a, b) => b.v - a.v);                                                       // the biggest go first
    let pi = 0;
    for (let n = 0; n < k && n < order.length; n++) {
      while (pi < pool.length && (count(pool[pi]) >= Banlist.limit(pool[pi]) || cardPower(CardDB.get(pool[pi])) >= order[n].v)) pi++;
      if (pi >= pool.length) break;
      deck[order[n].i] = pool[pi++];
    }
    return deck;
  }
  // A deck that can fuse is worth more than the sum of its cards. Now that every TCG Fusion monster is summoned-only,
  // an opponent who decks no fusion material has no big monsters at all - so from stage 2 up, a few slots go to
  // partners that pair with what the deck already holds. Everything stays in theme: the partners come from the
  // duelist's own power pool, which is theme-filtered.
  function addFusionPairs(deck, d, slots) {
    if (slots <= 0) return deck;
    // the partner may come from anywhere - except out of another duelist's hands. Marik is written with a Red-eyes,
    // and that was enough for this to hand him Joey's Summoned Skull to fuse it with (the user's audit, 2026-09-23).
    const pool = CardDB.all.filter((c) => c.kind === "M" && Banlist.limit(c.id) > 0 && CardDB.tributesFor(c) === 0 && mayHold(d, c.id)).map((c) => c.id);
    const count = {}; for (const id of deck) count[id] = (count[id] || 0) + 1;
    const core = new Set((d.gen && d.gen.core || []).map(([id]) => id));
    for (const id of aceOf(d)) core.add(id);
    for (const id of deck) { const r = Effects.ritual[id]; if (r) { core.add(id); for (const n of r.need) core.add(n); } }
    const have = [...new Set(deck.filter((id) => CardDB.get(id).kind === "M"))];
    const picks = [];
    for (const a of have) {
      for (const b of pool) {
        const r = CardDB.fuse(a, b); if (!r) continue;
        const res = CardDB.get(r); if (!res || Banlist.limit(r) > 0) continue;        // the prize has to be a summoned-only monster
        // a fusion pays no offerings, so its worth is the whole body - cardPower's tribute penalty does not apply
        const prize = res.atk + res.def * 0.2 + (Effects.bonus[res.id] || 0);
        const gain = prize - Math.max(cardPower(CardDB.get(a)), cardPower(CardDB.get(b)));
        if (gain > 600 && inTheme(d, r)) picks.push({ b, r, gain, power: prize });   // a real prize, and one of theirs
      }
    }
    picks.sort((x, y) => y.power - x.power);
    const added = new Set();
    for (const p of picks) {
      if (added.size >= slots) break;
      if (added.has(p.b) || (count[p.b] || 0) >= Banlist.limit(p.b)) continue;
      // the weakest monster that is not signature, ritual material or half of a pair we just made, steps aside
      let worst = -1, wv = Infinity;
      deck.forEach((id, i) => {
        const c = CardDB.get(id);
        if (!c || c.kind !== "M" || core.has(id) || added.has(id)) return;
        const v = cardPower(c); if (v < wv) { wv = v; worst = i; }
      });
      if (worst < 0) break;
      // a fusion piece is allowed to be a weak card - that is the trade for a monster the deck could not otherwise
      // hold - but it still has to beat giving the slot to another beater outright
      if (cardPower(CardDB.get(p.b)) + p.gain * 0.8 < wv * 0.8) continue;
      count[deck[worst]]--; deck[worst] = p.b; count[p.b] = (count[p.b] || 0) + 1; added.add(p.b);
      themeOf(d).ids.add(p.b);        // material for one of their own monsters belongs to the deck
    }
    return deck;
  }

  // what tops a guide deck up once the limit list has thinned it (DarkNite's deck is mostly limited cards and Wall Shadows)
  const RESERVE = {
    // Seeker's plan is to not lose. Walls that cost the attacker something, magic that holds a board still, and the
    // five pieces he is really playing for - every draw is a chance the duel simply ends.
    seeker: [17, 18, 19, 20, 21, 789, 48, 574, 463, 665, 296, 296, 540, 540, 540, 758, 42, 740, 349, 669, 348, 733, 751, 170, 255, 748],
    // The Ring's spirit does not need a board, he needs a graveyard: Shadow Ghoul grows with every monster in it,
    // Doll of Demise and Sinister Serpent will not stay in it, and Call of the Haunted reaches back into it.
    yamibakura: [368, 759, 813, 99, 83, 475, 102, 596, 97, 351, 132, 96, 241, 562],
    // Kaiba's deck is the Blue-eyes and everything that serves it. The limit list allows him one, so the ace he
    // really wants is the Ultimate Dragon: the ritual asks for a Blue-eyes and two more Dragons, and Cyber-Stein
    // skips the bill entirely - a 4500 ATK dragon out of a 700 ATK body, which is about as Kaiba as a play can be.
    // (withStein sees the ritual card and hands him the Stein automatically.)
    kaiba: [675, 332, 741, 315, 382, 10, 31, 571, 407, 808],
    // Yugi duels with the Dark Magician and the cast around him. Gaia and Curse of Dragon are the two halves of
    // Gaia the Dragon Champion - the only recipe there is for it - so he decks both and fuses them at full skill.
    yugi: [39, 760, 41, 2, 6, 470, 48, 27, 7, 41, 22, 38],
    // Joey's Red-eyes, and the three cards that turn something of his into something bigger: Metalmorph makes it a
    // Red-eyes B. Metal Dragon, Summoned Skull fuses with it into B. Skull Dragon, and Time Wizard ages his Baby
    // Dragon into Thousand Dragon
    joey: [82, 658, 4, 4, 64, 27, 22, 78],
    // the moth line and the cards that buy it the turns it needs: Petit Moth grows for four turns before it is
    // Great Moth, so Weevil decks the whole chain plus swords and traps to sit behind
    weevil: [348, 278, 72, 56, 762, 766, 764],        // swords to sit behind, then more of the line
    // Simon's guardian needs both M-warriors offered for it, and his magic is all about holding the enemy still
    paradox: [160, 161, 740, 323, 740, 323, 160, 161, 348, 669, 740, 134],   // the warriors his guardian is paid
                                                                              // with, sleep magic, and the Book of
                                                                              // Secret Arts his Maha Vailo doubles
    // the mask ritual needs masks to pay it, and the rest of the room goes to the graveyard's own fiends
    slysheen: [102, 102, 368, 99, 83, 95, 351, 746],   // masks to pay the ritual, then the graveyard's own, kept
                                                        // below the mask's own 2000 so the AI reaches for the ace
    // Two-headed King Rex and Crawling Dragon #2 fuse into Bracchio-raidus: his ace is made of his own dinosaurs
    rex: [32, 32, 81, 81, 79, 11, 80],
    // the whale's oath and the Mech Bass it is paid with, then the sea's own magic
    mako: [441, 334, 334, 249, 602, 524, 583, 393],   // one Mech Bass to pay the oath: the whale is a treat, not a routine
    darknite: [652, 652, 652, 370, 370, 366, 366, 797, 797, 22, 22, 217, 217, 187, 794, 1, 368, 375],
    // the thief's reserve: every card that takes a monster, then the magic that clears the way for the ones he took
    nitemare: [376, 166, 641, 40, 781, 784, 337, 348, 657, 375, 369, 370, 236, 794, 797, 217, 584, 261, 42],
  };
  // copies kept of a card a guide deck overdoes (a second Monster Tamer steals a monster every turn; three Gate Guardian
  // Rituals is two too many when only one can ever be paid for). Keys are ids after ritual monsters become ritual cards.
  // cards trimmed out of a guide deck to make room for what the duelist is actually trying to do: Weevil drops his
  // plainest bugs for the moth line and the cards that protect it, Mako his curry for the whale's offerings
  const TRIM = { darknite: { 376: 1 }, keith: { 736: 1 }, mokuba: { 736: 1 }, bakura: { 736: 1 }, nitemare: { 667: 0, 374: 0, 371: 0, 372: 0, 373: 0, 733: 1 }, joey: { 167: 1 },   // two Ancient Jars for the Metalmorph
    weevil: { 446: 0, 141: 0, 221: 0, 54: 0, 306: 1 }, mako: { 338: 0 },
    kaiba: { 23: 0 },                            // the Wicked Worm Beasts: rented muscle, not his
    rex: { 570: 1, 568: 1, 218: 1, 155: 1 },     // room for the pieces of Bracchio-raidus
    // Heishin is a dark priest, not a toy soldier: the dragon, the stuffed animals and the robots go
    slysheen: { 727: 0, 354: 0, 580: 0 },
    paradox: { 433: 0, 595: 0, 126: 1, 795: 0 },     // room for the M-warriors and the sealing magic
    // The Rare Hunter is not fighting, he is waiting: the small insects and the burn go, and what comes in is
    // walls, sealing magic and every way to dig for the five pieces he already carries.
    seeker: { 202: 0, 292: 0, 105: 0, 159: 0, 397: 1, 345: 0, 40: 1 },
    // and the spirit's borrowed dragons go back where they came from, leaving room for the graveyard
    yamibakura: { 442: 0, 31: 0, 571: 1, 737: 0, 367: 1, 551: 1 } };
                                                     // (the Dunames go to Ishizu: she is the fairy duelist)
  // starting LP: the rulers of the Heavens take more beating
  // the post-game four come after DarkNite, so they duel from further ahead: their Life Points climb with the order
  const LP = { darknite: 9000, yamiyugi: 10000, shadi: 11000, marik: 12000, yamibakura: 12000, nitemare: 15000 };
  for (const d of D) if (LP[d.key]) d.lp = LP[d.key];
  window.Duelists = {
    all: D, byKey, STAGES, BOOST, LP, THEME, THEME_TYPES, KEEP, genDeck, themeOf, inTheme, mayHold, SIGNATURE_OF,
    // a deck with a ritual card in it also gets a Cyber-Stein: that ritual's monster, no offerings and no cost
    // The AI only ritual summons from skill 2, so a rookie holding a ritual spell is holding a dead card: it goes,
    // and so do the offerings it named when that was all they were for. The Cyber-Stein stays (the user wants a
    // ritual duelist to be seen holding one, and it keeps the card in their drop pool) - with no ritual spell left
    // in the deck its own rule finds nothing to fetch, so it simply fights as a 700 ATK body.
    dropRituals(deck, d, wins, skill) {
      const isRitual = (id) => { const c = CardDB.get(id); return !!c && c.kind === "R"; };
      if (!d || (skill !== undefined ? skill : this.skillFor(d, wins)) >= 2 || !deck.some(isRitual)) return deck;
      // the offerings the dropped ritual named go with it when that is all they were for (Dark-eyes Illusion is a
      // 0/0 vanilla whose only job is to pay for Relinquished)
      const named = new Set();
      for (const id of deck) { const r = Effects.ritual[id]; if (r) for (const n of r.need) named.add(n); }
      const orphan = (id) => { const c = CardDB.get(id); return named.has(id) && c && c.kind === "M" && !Effects.isEffect(id) && c.atk < 1000; };
      // the freed slots take more of the deck's own low monsters, not the duelist's signature cards: dropping dead
      // weight should not make the easiest duelists in the game stronger
      const out = deck.filter((id) => !isRitual(id) && !orphan(id));
      if (!out.includes(420) && out.length < deck.length) out.push(420);     // the Stein itself stays in the deck
      const count = {}; for (const id of out) count[id] = (count[id] || 0) + 1;
      const spare = [...new Set(out)].filter((id) => { const c = CardDB.get(id); return c && c.kind === "M"; })
        .sort((a, b) => cardPower(CardDB.get(a)) - cardPower(CardDB.get(b)));
      let guard = 0;
      while (out.length < deck.length && guard++ < 200) {
        const pick = spare.find((id) => (count[id] || 0) < Banlist.limit(id));
        if (pick === undefined) break;
        out.push(pick); count[pick] = (count[pick] || 0) + 1;
      }
      return out.length === deck.length ? out : Banlist.apply(out.concat(new Array(deck.length - out.length).fill(0)), RESERVE[d.key] || THEME[d.key] || []).deck;
    },
    // Morphing Jar throws BOTH hands away. In a deck that is trying to hold five particular cards that is not a
    // draw engine, it is a loss condition (the user's call, 2026-09-23), so an Exodia deck never carries one.
    // A deck playing for Exodia must never carry a card that empties its own hand or deck: Morphing Jar makes both
    // players throw everything away, and Card of Demise throws the hand away at the end of the turn - and the hand is
    // exactly where the five pieces are being gathered. (The user caught 816 in Seeker's deck, 2026-09-24.)
    SELF_RUIN: [591, 816],
    noSelfMill(deck) {
      if (!deck.some((id) => KEEP.has(id))) return deck;
      const bad = this.SELF_RUIN.filter((id) => deck.includes(id));
      if (!bad.length) return deck;
      const count = {}; for (const id of deck) count[id] = (count[id] || 0) + 1;
      const spare = [...new Set(deck)]
        .filter((id) => { const c = CardDB.get(id); return c && c.kind === "M" && !KEEP.has(id) && !bad.includes(id) && (count[id] || 0) < Banlist.limit(id); })
        .sort((a, b) => cardPower(CardDB.get(b)) - cardPower(CardDB.get(a)));
      let pi = 0;
      return deck.map((id) => (bad.includes(id) && pi < spare.length ? spare[pi++] : id));
    },
    // a deck with a ritual spell in it carries a Cyber-Stein
    withStein(deck, skill, d) {
      if (!deck.some((id) => CardDB.get(id) && CardDB.get(id).kind === "R")) return deck;
      // one copy, whoever they are: the Stein costs nothing to use now, so the list holds it to one (2026-09-23)
      const want = 1;
      const keep = new Set(d ? aceOf(d) : []);
      for (const id of deck) { const r = Effects.ritual[id]; if (r) for (const n of r.need) keep.add(n); }   // the offerings stay
      for (let have = deck.filter((id) => id === 420).length; have < want; have++) {
        let worst = -1, wv = Infinity;
        deck.forEach((id, i) => { const c = CardDB.get(id); if (!c || c.kind !== "M" || id === 420 || keep.has(id)) return; const v = cardPower(c); if (v < wv) { wv = v; worst = i; } });
        if (worst < 0) break;
        deck[worst] = 420;
      }
      return deck;
    },
    // the deck a duelist brings after `wins` previous defeats by the player. `opts.skill` says how sharply it will
    // be played (the tournament runs everyone at skill 4), which decides whether ritual cards are worth carrying;
    // `opts.max` is the tournament deck: everyone brings their best, including the stage 1 duelists, whose campaign
    // decks never upgrade at all (that is why a tournament Mako used to turn up holding Mooyan Curry).
    deck(d, wins, opts) {
      // Every duelist has two decks (the user's rule, 2026-09-23). The campaign and Free Duel deck is the faithful
      // one: their identity, their theme, their plan, and nothing bolted on. The tournament deck is that deck built
      // to compete - twelve upgrades and the staples every tournament player runs. Only the tournament asks for a
      // max deck by hand; the post-game bosses are maxed too, but they are still playing their own campaign deck.
      const skill = opts && opts.skill, tournament = !!(opts && opts.max);
      const max = tournament || (d.hidden && d.key !== "yamiyugi");
      // the guide deck, trimmed to the limit list and topped up from the duelist's reserve list (its theme) before plain filler
      const fuseSlots = (d.stage >= 2 ? d.stage : 0) + (max ? 2 : 0);   // the higher the stage, the more of the deck is fusion material
      const staple = (deck) => (tournament ? ensureStaples(deck, d) : deck);
      if (d.gen) return this.noSelfMill(staple(this.withStein(addFusionPairs(this.dropRituals(genDeck(d, (BOOST[d.key] || 0) * 50 + (max ? 750 : 150 * Math.min(wins || 0, 3))), d, wins, skill), d, fuseSlots), skill, d)));
      const trim = TRIM[d.key] || {}, seen = {};
      // a ritual monster in the guide deck becomes the ritual card that summons it (the monster itself is not a deck card)
      const raw = window.DDS_DECKS[d.deckKey].map((id) => Banlist.ritualOnly(id) ? (Effects.summonerOf(id) || id) : id)
        .map((id) => (mayHold(d, id) ? id : 0))   // another character's calling card is not theirs to open with
        .filter((id) => { seen[id] = (seen[id] || 0) + 1; return trim[id] === undefined || seen[id] <= trim[id]; });
      while (raw.length < window.DDS_DECKS[d.deckKey].length) raw.push(0); // the gaps are filled from the reserve list
      // What tops the deck up once the limit list has thinned it: the duelist's reserve list, then more cards of
      // their own theme at the power level the deck already plays at. (The plain filler at the end of Banlist.apply
      // is what used to put a Celtic Guardian in an Egyptian deck, and refilling from the top of the theme instead
      // quietly turned stage 2 and 3 duelists into bosses.)
      const kept = raw.map((id) => CardDB.get(id)).filter((c) => c && c.kind === "M");
      const level = kept.length ? kept.reduce((t, c) => t + cardPower(c), 0) / kept.length : 1200;
      // the further up the ladder, the stronger the end of their own theme they reach for
      const band = level * (1.25 + 0.2 * (d.stage - 1));
      // A card this duelist is deliberately capped at (TRIM) must not come straight back through the top-up - that is
      // how Nitemare kept three Shadow Spells after being trimmed to one (2026-09-24).
      const extra = (RESERVE[d.key] || THEME[d.key] || []).filter((id) => mayHold(d, id))
        .concat(powerPool(d).filter((id) => trim[id] === undefined && cardPower(CardDB.get(id)) <= band).slice(0, 40));
      const base = Banlist.apply(raw, extra).deck;
      // a max deck is 12 upgrades on top of the duelist's own baseline, negative baselines included: the four
      // post-game bosses always build one, and a boss who is tuned down should be tuned down there too
      const boost = BOOST[d.key] || 0;
      const k = max ? 12 + boost : boost + (d.stage >= 2 ? 2 * Math.min(wins || 0, d.stage === 4 ? 3 : d.stage + 1) : 0);
      const tuned = ensureAces(k >= 0 ? upgradeDeck(base, d, Math.min(30, k)) : downgradeDeck(base, d, Math.min(30, -k)), d);
      return this.noSelfMill(staple(this.withStein(addFusionPairs(this.dropRituals(tuned, d, wins, skill), d, fuseSlots), skill, d)));
    },
    skillFor(d, wins) { const s = d.skill || d.stage; return d.stage >= 2 ? Math.min(4, s + 1, s + Math.floor((wins || 0) / 3)) : s; },
    cardPower,
    // ritual monsters are never handed out: you win their ritual spell instead
    // Wall Shadow has no spell of its own any more, so a drop of it becomes the Labyrinth Wall that calls it out
    fixDrop(id) { return id === 369 ? 366 : Banlist.ritualOnly(id) ? (Effects.summonerOf(id) || 0) : id; },
    drops(d) { // union of the guide's drop list and the duelist's own deck
      const set = new Set();
      for (const id of (window.DDS_DROPS[d.dropKey] || [])) { const x = this.fixDrop(id); if (x) set.add(x); }
      for (const id of (d.gen ? genDeck(d) : window.DDS_DECKS[d.deckKey])) { const c = CardDB.get(id); if (!c) continue; const x = this.fixDrop(id); if (x && Banlist.limit(x) > 0) set.add(x); }
      return [...set];
    },
    grandpaDrops() { return (window.DDS_DROPS["Yugi's Grandpa"] || []).map((id) => this.fixDrop(id)).filter((x) => x); },
    starterDeck() { return window.DDS_DECKS["Your First Deck!"].slice(); },
  };
})();
