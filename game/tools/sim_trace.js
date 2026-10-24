const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const win = { addEventListener() {}, removeEventListener() {} };
win.window = win; win.document = { getElementById: () => null, createElement: () => ({ getContext: () => ({}) }) };
win.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }; win.console = console; win.Math = Math;
const ctx = vm.createContext(win);
for (const f of ["data/cards.js", "data/fusions.js", "data/decks.js", "js/data/cardsdb.js", "js/data/banlist.js", "js/data/effects.js", "js/data/shop.js", "js/data/duelists.js", "js/game/duel.js", "js/game/ai.js"]) vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f });
const { CardDB, Duelists, Duel, DuelPlayer, AI } = win;
const d = Duelists.byKey[process.argv[2] || "yugi"];
const a = new DuelPlayer("me", Duelists.starterDeck(), true, null); a.skill = 3;
const b = new DuelPlayer(d.name, Duelists.deck(d), true, null); b.skill = d.stage;
const duel = new Duel(a, b, { first: 0 });
let g = 0;
const nm = (id) => CardDB.get(id).name.slice(0, 10);
while (duel.winner === null && g++ < 3000) {
  const pl = duel.cur(); if (!pl.ai) AI.beginTurn(pl);
  const r = AI.step(duel, pl);
  for (const e of duel.events) {
    if (e.type === "turn") console.log(`--- turn ${e.no} ${e.player === 0 ? "ME" : d.name} LP ${a.lp}/${b.lp}  field me:[${a.mon.map(m => m ? nm(m.id) + (m.pos === "def" ? "(D)" : "") + duel.atk(m) : "-").join(",")}] opp:[${b.mon.map(m => m ? nm(m.id) + (m.pos === "def" ? "(D)" : "") + duel.atk(m) : "-").join(",")}]`);
    else if (e.type === "summon") console.log(`  ${e.player === 0 ? "ME" : "OP"} summon ${nm(e.id)} ${e.pos}`);
    else if (e.type === "attack") console.log(`  ${e.player === 0 ? "ME" : "OP"} attack ${nm(e.id)}(${e.aAtk}) -> ${e.target ? nm(e.target) + "(" + (e.dPos === "def" ? "D" + e.dDef : "A" + e.dAtk) + ")" : "DIRECT"} ${e.result || e.elem || ""}`);
    else if (e.type === "magic") console.log(`  ${e.player === 0 ? "ME" : "OP"} magic ${nm(e.id)}`);
    else if (e.type === "fuse") console.log(`  ${e.player === 0 ? "ME" : "OP"} fuse ${nm(e.a)}+${nm(e.b)}=${nm(e.result)}`);
    else if (e.type === "damage") console.log(`  ${e.player === 0 ? "ME" : "OP"} takes ${e.amount}`);
    else if (e.type === "end") console.log("END winner", e.winner, e.reason);
  }
  duel.events.length = 0;
  if (r.type === "end") pl.ai = null;
  if (duel.turnNo > 30) break;
}
