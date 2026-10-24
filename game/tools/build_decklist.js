// Every duelist's 40 cards, as they are dealt at the start of the campaign (0 wins), for auditing.
//   node decklist.js [md]
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = "C:/Games/Yugioh DDS/game";
const win = { addEventListener() {}, removeEventListener() {} };
win.window = win; win.document = { getElementById: () => null, createElement: () => ({ getContext: () => ({}) }) };
win.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }; win.console = console; win.Math = Math;
const ctx = vm.createContext(win);
for (const f of ["data/cards.js", "data/fusions.js", "data/decks.js", "js/data/cardsdb.js", "js/data/banlist.js", "js/data/effects.js", "js/data/shop.js", "js/data/duelists.js", "js/game/duel.js", "js/game/ai.js"]) vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f });
const { CardDB, Duelists, Effects, Banlist } = win;
const MD = process.argv[2] === "md";

const stageOf = {};
for (let s = 1; s <= 4; s++) for (const k of Duelists.STAGES[s].keys) stageOf[k] = s;
const PLAN = {
  yugi: "Dark Magician and the cast around him; Gaia + Curse of Dragon fuse into Gaia the Dragon Champion",
  tristan: "a plain beatdown - no ace by design",
  joey: "Red-eyes into B. Skull Dragon or Metal Dragon; Time Wizard ages Baby Dragon into Thousand Dragon",
  mai: "Harpie Ladies feeding Harpie's Pet Dragon; Cyber Shield and the Feather Duster",
  mako: "Water and the sea magic; Fortress Whale is the pay-off",
  esproba: "Machines behind Jinzo #7 chip damage",
  rex: "Dinosaurs fusing into Bracchio-raidus",
  weevil: "Insects, the moth line behind Swords and traps",
  kaiba: "Blue-eyes; the Ultimate Dragon ritual with Cyber-Stein to pay it",
  pandora: "mono Dark Magician, support that helps him and nothing that eats him",
  seeker: "Exodia behind a full stall lock",
  paradox: "the M-warriors pay for his guardian; sleep magic holds the board",
  pseto: "Blue-eyes again, played straight and hard",
  ishizu: "Fairies climbing to Cosmo Queen",
  slysheen: "masks pay the ritual, then the graveyard's own fiends",
  mokuba: "small Blue-eyes support, the kid brother's deck",
  tea: "Fairies and healing",
  bakura: "Fiends and the Ouija hand",
  keith: "Machines behind Barrel Dragon",
  para: "the Labyrinth brothers: walls and maze monsters",
  panik: "Castle of Dark Illusions lifting his Fiends",
  pegasus: "Toons - free bodies that hit straight at the Life Points",
  solomon: "Grandpa draws for Exodia; the Blue-eyes is his back-up",
  darknite: "Magical Labyrinth finds the wall, the wall calls the maze out",
  yamiyugi: "Dark Magician into Magician of Black Chaos, and the Dark Magic Ritual",
  shadi: "the Millennium items' guardians",
  marik: "Zera the Mant and the Fiend's Mirror ritual",
  yamibakura: "the graveyard is his hand - Shadow Ghoul grows, Call of the Haunted digs",
  nitemare: "Sanga, Kazejin and Suijin into Gate Guardian",
};
const out = [];
const line = (t) => out.push(t);
for (let stage = 1; stage <= 4; stage++) { line((MD ? "\n## " : "\n== ") + Duelists.STAGES[stage].name + (MD ? "" : " ==")); dump(Duelists.STAGES[stage].keys); }
line((MD ? "\n## " : "\n== ") + "Tournament only" + (MD ? "" : " =="));
dump(Duelists.all.map((d) => d.key).filter((k) => !stageOf[k]));

function dump(keys) {
  for (const k of keys) for (const mode of ["campaign", "tournament"]) {
    const d = Duelists.byKey[k];
    const deck = mode === "tournament" ? Duelists.deck(d, 99, { skill: 4, max: true }) : Duelists.deck(d, 0);
    const n = {}; for (const id of deck) n[id] = (n[id] || 0) + 1;
    const ids = Object.keys(n).map(Number);
    const say = (id) => CardDB.get(id).name + (n[id] > 1 ? " x" + n[id] : "");
    const mon = ids.filter((id) => CardDB.get(id).kind === "M").sort((a, b) => CardDB.get(b).atk - CardDB.get(a).atk);
    const sp = ids.filter((id) => CardDB.get(id).kind === "S").sort((a, b) => a - b);
    const tr = ids.filter((id) => CardDB.get(id).kind === "T").sort((a, b) => a - b);
    const ri = ids.filter((id) => CardDB.get(id).kind === "R").sort((a, b) => a - b);
    const count = (list) => list.reduce((s, id) => s + n[id], 0);
    const types = {}; for (const id of mon) types[CardDB.get(id).ty] = (types[CardDB.get(id).ty] || 0) + n[id];
    const top = mon.slice(0, 10).reduce((s, id) => s + CardDB.get(id).atk, 0) / Math.min(10, mon.length);
    const head = d.name + " - " + mode.toUpperCase() + " deck  |  " + (stageOf[k] ? "stage " + stageOf[k] : "tournament only") +
      " | LP " + (d.lp || 8000) + " | skill " + (mode === "tournament" ? 4 : Duelists.skillFor(d, 0)) + " | boost " + (Duelists.BOOST[k] || 0) + " | top10 ATK " + top.toFixed(0);
    line(MD ? "\n### " + head : "\n" + head);
    if (mode === "campaign") line((MD ? "**Plan:** " : "  plan: ") + (PLAN[k] || "-"));
    if (mode === "campaign" && (Duelists.SIGNATURE_OF[k] || []).length) line((MD ? "**Signature:** " : "  signature: ") + Duelists.SIGNATURE_OF[k].map((id) => CardDB.get(id).name).join(", "));
    line((MD ? "**Types:** " : "  types: ") + Object.keys(types).sort((a, b) => types[b] - types[a]).map((t) => t + " " + types[t]).join(", "));
    line((MD ? "**Monsters (" : "  monsters (") + count(mon) + (MD ? "):** " : "): ") + mon.map((id) => say(id) + " " + CardDB.get(id).atk + "/" + CardDB.get(id).def).join(", "));
    if (ri.length) line((MD ? "**Rituals (" : "  rituals (") + count(ri) + (MD ? "):** " : "): ") + ri.map((id) => say(id) + " -> " + CardDB.get(Effects.ritual[id].result).name).join(", "));
    line((MD ? "**Spells (" : "  spells (") + count(sp) + (MD ? "):** " : "): ") + sp.map(say).join(", "));
    line((MD ? "**Traps (" : "  traps (") + count(tr) + (MD ? "):** " : "): ") + (tr.length ? tr.map(say).join(", ") : "-"));
  }
}
fs.writeFileSync(process.argv[3] || (MD ? "DECKS.md" : "decks.txt"), (MD ? "# Every duelist's deck\n\nTwo decks per duelist. **Campaign / Free Duel** is the faithful build - their identity, theme and plan, with no staples bolted on - as dealt the first time you meet them (0 wins); a rematch swaps 2 more of its weakest cards per win. **Tournament** is the same character built to compete: twelve upgrades and the five staples every tournament player runs.\n" : "") + out.join("\n") + "\n");
console.log("written: " + (process.argv[3] || (MD ? "DECKS.md" : "decks.txt")));
