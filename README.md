# Yu-Gi-Oh! Dark Duel Stories — fan recreation

A browser recreation of Konami's 2002 Game Boy Color game *Yu-Gi-Oh! Dark Duel Stories*
(*Duel Monsters III: Tri-Holy God Advent* in Japan), built for learning purposes only.
Not for sale. Yu-Gi-Oh!, its characters, card art and music belong to Kazuki Takahashi
and Konami; they are used here non-commercially and will come down on request.

## Play

**In a browser, including a phone: <https://mikale4.github.io/yugioh-dds/>**

Or locally, double-click **`Play Dark Duel Stories.bat`** — it starts a tiny local web server and opens the game in your browser
(`http://localhost:8765`). Python 3 must be installed (it is used only to serve the files).

Alternatively run `python game/tools/serve.py` and open the printed address.

The published site is this repo's `main` branch served by GitHub Pages, so `git push`
updates it. Two things differ from a local checkout: the soundtrack in `game/audio/bgm`
is the 64 kb/s mono web copy (the 320 kb/s rips stay out of git in `game/audio/bgm-src`,
re-encoded by `game/tools/encode_audio.sh`), and off localhost the asset cache-buster in
`game/index.html` is a fixed build tag instead of a timestamp, so phones cache the art.
Bump that tag whenever you rebuild the atlases, or the site will serve the old ones.

Controls (keyboard or mouse/touch):

| Game Boy | Keyboard |
|----------|----------|
| D-pad    | Arrow keys / WASD |
| A        | Z / Enter |
| B        | X |
| Start    | C |
| Select (AUTO in duels) | ` (backtick) |
| Sort / filter a card list | Space / Tab |
| Demo on/off (demo games only) | Esc |

In a duel: **HAND** opens your hand, **END** ends the turn, **AUTO** (or Select) lets the computer play your turns until you
switch it off, Start offers to give up.
Progress is saved automatically in the browser (localStorage), like the cartridge's battery save.

## What's in the game

* All **800 cards** with their real stats, elements, types, costs, descriptions and 8‑digit passwords, plus the ripped card art.
* The full **28,298‑recipe fusion table**.
* The **21 campaign duelists** across Domino Town 1, Domino Town 2, Ancient Egypt and The Heavens, each using their real deck list,
  with authentic drop lists, portraits and stage maps. Beat everyone in an area five times to move on; beat DarkNite for the
  ending, then Yami Yugi five times (or use the passwords) to face Yami Bakura, Nitemare, Shadi and Marik.
* Rules: 8000 LP, 40‑card decks, modern summoning (one Normal Summon or Set per turn, offerings for level 5+ monsters,
  unlimited special summons via rituals, no attacks on turn 1, the hand is refilled to 5 cards at the start of every turn), fusion by stacking a hand monster onto another hand monster or onto a field monster that has not attacked yet (the result is a
  normal hand card; a failed attempt keeps both cards but ends fusing for the turn),
  field cards (+/‑30 %), equips (+500 when they fit), traps, rituals, monster SPCL abilities, Exodia and deck‑out.
  The cartridge's elemental "instant kill" loops are intentionally left out: battles are decided by ATK/DEF like modern Yu‑Gi‑Oh!.
* Deck building uses a modern **Limited / Semi‑Limited list** (Options → Limit list) instead of the cartridge's
  Duelist Level and Deck Capacity numbers: up to 3 copies of anything else. The computer's decks obey the same list.
  Ritual monsters are not deck cards: you win their ritual card instead, and it summons them by offering the required
  monsters from your hand or field. Every deck that runs a ritual card — yours or a duelist's — also gets a Cyber-Stein, which pays 5000 LP for the ritual monster when the offerings never turn up.
* Five save files; a starter-deck pick on every new game; Campaign, Free Duel (wins give a card), Chest, Deck editor (with auto‑build), Card Shop, Password (in Options), and a title-screen Demo that plays the whole game by itself
* **Card Shop** and **Domino**: beating a duelist pays Domino (120–500 by area, 700 for the hidden rulers). The shop sells 10 cards, rolled by rarity (common cards show up far more often than ultra rares; prices 80 → 3000), each sold out once bought, restocked every 10 duels. The shelf can be sorted (Tab, or click the sort tag by your Domino: number, name, ATK, DEF, level, attribute, type or **rarity**). **RENEW** (the button under the buy list, or Space) restocks it on the spot: the first renew after every restock is free, each further one costs 250 Domino, and the free one comes back with the 10-duel restock. Spare cards can be sold back for a quarter of their price, but the chest never goes below 40 cards.
* **Flawless duels**: win without losing a single Life Point and the payout doubles and a second card drops. Paying LP yourself (Cyber‑Stein, Time Wizard's tails) breaks it; a Kuriboh taking the hit for you does not. The Record page counts them.
* **Card packs**: a 10 % chance after each win to also get a 5‑card pack, every card equally likely, opened card by card.
* **Difficulty curve**: every duelist's deck gets a baseline number of "upgrades" (weakest cards swapped for the strongest it can field, its own signature cards first) so the roster lines up in stage order — Domino Town 1 is a walkover, Egypt is a coin flip for a decent deck, the rulers of the Heavens (more LP, skill 4) win most of the time and Nitemare is the hardest. From Domino Town 2 on, each win against a duelist adds upgrades and, every third win, a skill level, capped so a beaten duelist stays farmable. `node game/tools/sim_curve.js` prints the curve.
* **Fusion finder**: any monster's menu (Chest, Deck editor, Shop) lists what it fuses with among your cards — or every card with Tab — and what comes out.
* Card lists sort by number, name, ATK, DEF, level, attribute, type or rarity (Space in the Chest and Deck, Tab in the shop's buy list) and filter by normal / effect / ritual-material / ritual / spell / trap.
* **Three decks per file** (switch in the deck editor's Select menu; a picker appears before a duel when more than one is ready), a **gallery** of all 800 cards (Select in the Chest) with a collection counter on the Record page.
* **Free Duel challengers**: nine faces from the Japanese cartridge's mugshot sheet who never made the campaign map — Mokuba and Tea (stage 1), Ryou Bakura and Bandit Keith (stage 2), the Paradox Brothers and Panik (stage 3), Pegasus and Solomon Muto (stage 4). Para and Dox duel as one opponent and speak in turn, each with their own portrait and lines. The first duel you finish after one of them unlocks, they walk up and challenge you on the spot (once each — win or lose, they tell you to find them in Free Duel afterwards). They are optional: they never gate the campaign or the ending, they appear in the Free Duel list once you reach their stage, join the tournament pool, and drop their own cards. Each brings a themed deck built by `Duelists.genDeck` — Keith's machines and coin flips, Tea's life‑point engine, Bakura's monsters that take their killer with them, the brothers' labyrinth and Gate Guardian, Pegasus's Toons paid for by self‑copying monsters plus every control and absorb card, and Solomon's draw engine around five Exodia pieces he never plays (no AI will summon, fuse or discard them).
* **Tournaments** (top of the Free Duel list once Ancient Egypt is reached, once every 10 duels): 1000 Domino entry, an 8‑seat bracket in which every match is played out on screen (the others as spectator duels) against duelists at full strength; round wins pay 500/1000, the champion gets 10000 Domino, an ultra rare, a super rare and a pack.
* **Reworked cards**: Megamorph doubles a monster's ATK; Multiply copies the chosen monster (Kuriboh still fills the field); Magical Labyrinth special‑summons Wall Shadow from outside the deck; The Inexperienced Spy and Monster Eye reveal the enemy hand and make them throw away a card of your choice; Castle of Dark Illusions boosts Zombie/Fiend/Shadow allies by 30 %; Fake Trap is destroyed in place of your other spells/traps; Time Wizard has a second SPCL, a coin flip that wipes the enemy field or your own (plus half its ATK in LP). The limit list moved with them (`game/js/data/banlist.js`).
* **Monster effects** (about 120 monsters, `game/js/data/effects.js`): SPCL abilities used from the field once per turn (Blue‑eyes destroys a monster, D. Magician fetches a spell, Monster Tamer steals for good, Cyber‑Stein pays 5000 LP for a ritual monster…); always‑on passives — auras that lift whole types by 30 % (Pumpking, Hoshiningen, Star Boy, Bladefly, the Battleguards), stat bonuses that grow with the graveyard or the hand (Shadow Ghoul, Machine King, Muka Muka, the moth line), rules changers (Jinzo shuts traps down, The Last Warrior seals normal summons, Total Defense Shogun fights with its DEF, Gate Guardian shrugs off one destroying effect a turn); and triggers — when destroyed (Sangan / Witch search, Chimera's spawn, Man‑eater Bug and friends take their killer down, The Unhappy Maiden ends the attacker's turn), when discarded (Thunder Dragon, Electric Snake), on battle damage (White Magical Hat, Masked Sorcerer, Red‑eyes' burn) and Kuriboh, which takes a hit in your place from the hand or the field. The Toons and The Fiend Megacyber are extra special summons; the moth line (Petit Moth → Larvae → Cocoon → Great Moth → Perfectly Ultimate) grows a step on each of its owner's turns. Every AI (opponents, AUTO, the demo) prices these effects (`Effects.bonus`), uses every SPCL, and avoids attacking into retaliators, Reflect Bounder or Wall of Illusion; opponent decks upgrade towards in‑character effect monsters (`Duelists.THEME`); the limit list, shop rarities and the difficulty boosts were retuned with them. Second patch: Summoned Skull, D. Magician, Silver Fang, B. Skull Dragon and The Immortal of Thunder are once per duel; ~40 more monsters got effects (freezers, self‑copying Skull Servant / Shadow Specter / Doron, the Mirrors that block the enemy's next attacks, Water Omotics / Toad Master / Mystic Lamp calling monsters from outside the deck, Eyearmor and Greenkappa copying stats, Millennium Shield stopping one attack a turn, Binding Chain sealing enemy monster effects, Wing Egg Elf / Mechaleon hiding behind a friend, Lady of Faith, Toon Mermaid's free summon…); a duelist's guide deck is topped up from a themed reserve list instead of random filler (`Duelists.RESERVE`).
* **Starter decks** (`game/js/data/starters.js`): a new game rolls three themed 40‑card decks (Dragon, Warrior, Beast, Fiend, Aqua, Insect, Machine, Magician, Rock) and shows them with three signature cards each — pick one. Every roll has the same shape: one level‑5 boss, three cheap effect cards to learn from (a direct attacker, a "slain in battle" card, a utility), 18 theme monsters, 10 plain neutrals, the theme's field card, the equip that fits it, small heals, a trap hole and a burn — re‑rolled until it sits in a narrow power band (average ATK 850–1050, nothing over 1500 but the boss, at least three fusion pairs, limited effect value). `node game/tools/sim_specials.js` puts every SPCL ability on a board that suits it and checks the AI fires it (78/78); `node game/tools/sim_starters.js` measures every theme against Domino Town 1 (79–89 % for a learning player, the cartridge's fixed starter scores 88 %). The chosen theme is shown on the Record page; the old fixed list remains the fallback.
* Options: music volume, text speed (Slow/Normal/Fast/Instant), fast‑forwarded enemy turns.
  (real card passwords plus the special codes: 65437205 Grandpa, 70715281 Yami Yugi, 07119986 Yami Bakura,
  43504084 Nitemare, 70592699 Shadi, 06987398 Marik, 42382443 ending) and Record screens.

## Project layout

```
game/index.html            entry point
game/js/core               canvas renderer (160x144, pixel scaled), input, sound, asset loader
game/js/data               card database + rules tables, card effects, duelist roster
game/js/game               duel engine, computer opponent, save data
game/js/screens, js/ui     all screens and widgets
game/data/*.js             generated data (cards, fusions, decks/drops)
game/assets/*.png          generated sprites (card atlas, portraits, faces, scenes, backgrounds, font)
game/tools/build_data.py   rebuilds data/*.js from the GameFAQs guides in "gameplay references"
game/tools/build_assets.py rebuilds assets/*.png from the sheets in "image references"
game/tools/test_rules.js   engine rule checks      (node test_rules.js)
game/tools/sim.js          AI-vs-AI simulations    (node sim.js 5)
game/js/runner.js          automated playthrough (see below)
```

## Automated playthrough (the runner)

`game/js/runner.js` plays the whole game through the real screens: it starts a new game, types a name, clicks
through the intro, picks opponents on the campaign map, switches AUTO on in every duel, collects the rewards and
keeps going until every duelist, hidden ones included, has been beaten. After each duel it rebuilds the deck from
the chest (40 cards, limit list respected) whenever a better deck exists - "better" is ATK/DEF with a penalty for
offerings, the strong spell/trap cards, equips by how many deck monsters they fit, ritual cards together with their
named offerings, and what the monsters can fuse into in the hand; it says what it decided about every card it wins.
When it loses three times
in a row to someone it farms a duelist it can beat whose drops would improve the deck most, then tries again.
It shops after every duel (keeping the tournament fee aside once tournaments are open) and enters every tournament
it can afford, watching the other matches like a player would; the prizes go through the same card evaluation.
It also visits every menu screen once, records text drawn past the screen edge, and stops on any uncaught error.
Your own save is set aside for the run and restored when it stops.

* **Demo** on the title screen: pick one of the five save files and watch it play at normal speed, deck edits
  included (it does them on the DECK screen). **Esc** hands you the controls of that game where it stands; Esc again
  lets the computer carry on. Games started by the demo are marked in gold in the file list and keep the Esc toggle
  whenever you continue them; games you start yourself never have it.
* Developer runs (fast, thousands of frames per second, in save file 5 which is restored afterwards):
  `index.html?runner=1` (optional `&seed=1`, `&max=200`, `&human=1`, `&keep=1`, `&slot=2`), or from the console
  `Runner.start({ seed: 1 })`, `Runner.stop()`, `Runner.report()`

## Credits

Original game © Konami / Kazuki Takahashi. Card data, decks, drop lists and fusion recipes were reconstructed from the
GameFAQs guides by m0gster, pokeeiyuu, Mew Seeker, Mantidactyle, Liikala, NickWhiz1, animesou, Blue_Eyes and Flaid;
sprite sheets ripped by Airshuffler, Ragengow, Ebilun, Silverbolt and Alxala. Sound effects are synthesised; the background music is the game's own soundtrack (`game/audio/bgm`), toggled in Options.
