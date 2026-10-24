// Does every duelist still hold the cards their PLAN needs?  node tools/sim_plans.js
// sim_themes.js only checks that a deck's monster TYPES match the character; this checks that the cards the plan is
// built on are actually in the deck, campaign and tournament. Run it after any balance pass: a negative BOOST swaps
// out a deck's biggest card, which is usually the ace, and a limit-list change can quietly remove the gaps a
// duelist's RESERVE was filling.
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const win = { addEventListener() {}, removeEventListener() {} };
win.window = win; win.document = { getElementById: () => null, createElement: () => ({ getContext: () => ({}) }) };
win.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }; win.console = console; win.Math = Math;
const ctx = vm.createContext(win);
for (const f of ["data/cards.js", "data/fusions.js", "data/decks.js", "js/data/cardsdb.js", "js/data/banlist.js", "js/data/effects.js", "js/data/shop.js", "js/data/duelists.js"]) vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f });
const { CardDB, Duelists } = win;
// what each duelist's plan cannot do without
const PLAN = {
  yugi:     { need: [35, 38, 39], why: "Dark Magician; Gaia + Curse of Dragon make the Champion" },
  tristan:  { need: [773], why: "Sword Hunter leads the battleguards" },
  joey:     { need: [82, 4, 16, 658, 22], why: "Red-eyes, and its three payoffs" },
  mai:      { need: [63, 62, 318], why: "Harpie's Pet Dragon, the Ladies, Elegant Egotist" },
  mako:     { need: [441, 334], why: "the Whale's Oath and Umi" },
  esproba:  { need: [752], why: "Jinzo shuts the traps down" },
  rex:      { need: [32, 81], why: "the two halves of Bracchio-raidus" },
  weevil:   { need: [278, 72, 762], why: "the moth line and the Queen" },
  kaiba:    { need: [1, 675, 420], why: "Blue-eyes, the Ultimate Dragon ritual, Cyber-Stein to pay it" },
  pandora:  { need: [35], why: "the Dark Magician he is built around" },
  seeker:   { need: [17, 18, 19, 20, 21, 789], why: "the five pieces, and the Pot that digs for them" },
  paradox:  { need: [679, 160, 161], why: "Novox's Prayer wants both M-warriors" },
  pseto:    { need: [1, 808], why: "his Blue-eyes" },
  ishizu:   { need: [676, 698], why: "her two rituals" },
  slysheen: { need: [693, 102], why: "masks to pay the Contract" },
  darknite: { need: [652], why: "Magical Labyrinth calls the maze" },
  yamiyugi: { need: [670, 722, 35], why: "Black Luster Soldier and the Magician of Black Chaos" },
  yamibakura: { need: [368, 759, 813, 83], why: "Shadow Ghoul, the Doll, the Call and the Castle over them" },
  nitemare: { need: [376, 641, 781, 784], why: "the cards that take what you play: everything you own ends up his" },
  shadi:    { need: [678], why: "Revival of Sennen Genjin" },
  marik:    { need: [671, 674], why: "his three rituals" },
  // Lord of D. is Kaiba's calling card by the user's signature list (2026-09-23), so the little brother brings the
  // borrowed dragon and the machines he props it up with, and not the flute
  mokuba:   { need: [1], why: "the borrowed Blue-eyes, with his machines around it" },
  tea:      { need: [], why: "life point gain" },
  bakura:   { need: [501, 135], why: "monsters that take their killer down" },
  keith:    { need: [743, 658], why: "Barrel Dragon and Metalmorph" },
  para:     { need: [371, 372, 373, 366], why: "the Gate Guardian and the Labyrinth Wall" },
  panik:    { need: [], why: "big fiends" },
  pegasus:  { need: [783, 767], why: "Relinquished and the Toons" },
  solomon:  { need: [17, 18, 19, 20, 21, 789], why: "Exodia and the draw engine" },
};
let bad = 0;
for (const d of Duelists.all) {
  const p = PLAN[d.key]; if (!p) continue;
  const camp = Duelists.deck(d, 0), cup = Duelists.deck(d, 99, { skill: 4, max: true });
  const miss = p.need.filter((id) => !camp.includes(id));
  const missCup = p.need.filter((id) => !cup.includes(id));
  // a ritual card counts when its spell is there: its monster is never a deck card
  if (miss.length || missCup.length) {
    bad++;
    console.log(d.name.padEnd(12) + " MISSING " + (miss.length ? "campaign: " + miss.map((id) => CardDB.get(id).name).join(", ") : "") +
      (missCup.length ? "  | cup: " + missCup.map((id) => CardDB.get(id).name).join(", ") : "") + "   (" + p.why + ")");
  }
}
console.log(bad ? bad + " decks have lost part of their plan" : "every plan's key cards are still in the deck");
