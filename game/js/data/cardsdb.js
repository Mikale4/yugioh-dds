// Card database: the 800 cards, fusion lookup and rules tables.
(function () {
  const cards = window.DDS_CARDS;
  const byId = new Map();
  for (const c of cards) byId.set(c.id, c);

  // ---------------------------------------------------------- fusion table
  const B32 = "0123456789abcdefghijklmnopqrstuv";
  const fusions = new Map();
  (function unpack() {
    const s = window.DDS_FUSIONS_PACKED;
    const dec = (i) => B32.indexOf(s[i]) * 32 + B32.indexOf(s[i + 1]);
    for (let i = 0; i + 5 < s.length; i += 6) fusions.set(dec(i) * 1000 + dec(i + 2), dec(i + 4));
  })();

  const fusionResults = new Set(fusions.values());
  let byResult = null;

  // ---------------------------------------------------------- rules tables
  const FIELDS = { // field card id -> { name, plus:[types], minus:[types] }
    330: { name: "Forest", plus: ["Beast", "BeastWar", "Insect", "Plant", "WngBeast"], minus: [] },
    331: { name: "Wasteland", plus: ["Zombie", "Rock", "Dinosaur"], minus: [] },
    332: { name: "Mountain", plus: ["Dragon", "WngBeast", "Thunder"], minus: [] },
    333: { name: "Meadow", plus: ["Warrior", "BeastWar"], minus: [] },
    334: { name: "Sea", plus: ["Aqua", "Thunder", "Fish", "SeaDragn"], minus: ["Machine", "Pyro"] },
    335: { name: "Dark", plus: ["Magician", "Fiend"], minus: ["Fairy"] },
  };
  const FEMALE = ["lady", "girl", "queen", "witch", "maiden", "elf", "harpie", "princess", "goddess", "amazon", "mermaid", "nekogal",
    "headhuntress", "swordmistress", "megami", "muse", "sorceress", "dancer", "beautiful", "lamoon", "eldeen", "arlownay", "hibikime",
    "nurse", "dryad", "angelwitch", "faith", "empress", "mistress", "sister", "kanan", "water girl", "bishoujo", "hostess", "lady"];
  function isFemale(c) { const n = c.name.toLowerCase(); return FEMALE.some((f) => n.includes(f)); }
  // equip card id -> predicate(card) ; returns true when the equip fits the monster
  const EQUIP = {
    301: (c) => c.ty === "Warrior" && c.el !== "Shadow",
    302: (c) => c.ty === "Warrior" && c.el === "Shadow",
    303: (c) => c.ty === "Fiend" || c.el === "Shadow",
    304: (c) => c.ty === "Fiend" || c.ty === "BeastWar",
    305: (c) => c.ty === "Insect",
    306: (c) => c.ty === "Insect",
    307: (c) => c.name.toLowerCase().includes("elf") || (c.ty === "Magician" && c.el === "Light"),
    308: (c) => c.ty === "Beast",
    309: (c) => c.ty === "Aqua" || c.ty === "Reptile" || c.ty === "Fish",
    310: (c) => c.ty === "Plant",
    311: (c) => c.ty === "Magician" && c.el === "Shadow",
    312: (c) => c.ty === "Fairy",
    313: (c) => (c.ty === "Beast" || c.ty === "BeastWar" || c.ty === "Dinosaur") && c.el !== "Shadow",
    314: (c) => c.el === "Shadow" && (c.ty === "Beast" || c.ty === "BeastWar" || c.ty === "Fiend"),
    315: (c) => c.ty === "Dragon",
    316: (c) => isFemale(c),
    317: (c) => isFemale(c),
    319: (c) => c.ty === "Beast" || c.ty === "BeastWar",
    321: (c) => isFemale(c) || c.el === "Shadow",
    322: (c) => c.ty === "Zombie",
    323: (c) => c.ty === "Magician" && c.el !== "Fiend",
    324: (c) => c.ty === "Rock" || c.ty === "Pyro",
    325: (c) => c.ty === "Machine",
    326: (c) => c.ty === "Dinosaur",
    327: (c) => c.ty === "WngBeast",
    328: (c) => c.ty === "Aqua" || c.ty === "Fish" || c.ty === "SeaDragn",
    651: (c) => true,
    654: (c) => c.ty === "Pyro" || c.el === "Pyro",
    657: (c) => true,
    659: (c) => c.ty === "Fairy",
    668: (c) => c.el === "Light",
  };
  const STARS = "\x8f"; // filled star glyph

  const CardDB = {
    all: cards,
    get(id) { return byId.get(id); },
    isMonster(c) { return c && c.kind === "M"; },
    // Junk Synchron takes any one monster with it and comes back as Junk Warrior (the user's rule, 2026-09-23).
    // That is 800 pairs no table wants to hold, so the lookup answers for it.
    fuse(a, b) {
      const ca = byId.get(a), cb = byId.get(b);
      if ((a === 806 || b === 806) && a !== b && ca && cb && ca.kind === "M" && cb.kind === "M") return 807;
      const lo = Math.min(a, b), hi = Math.max(a, b);
      return fusions.get(lo * 1000 + hi) || 0;
    },
    fusionCount: fusions.size,
    isFusionResult(id) { return id === 807 || fusionResults.has(id); },   // a monster no hand can hold: it only arrives from a fusion
    // the pairs that make a monster, for the card page and the fusion finder
    recipesFor(id) {
      if (!byResult) {
        byResult = new Map();
        for (const [k, r] of fusions) {
          const list = byResult.get(r) || []; list.push([Math.floor(k / 1000), k % 1000]); byResult.set(r, list);
        }
      }
      return byResult.get(id) || [];
    },
    fieldInfo(id) { return FIELDS[id] || null; },
    isField(id) { return !!FIELDS[id]; },
    isEquip(id) { return !!EQUIP[id]; },
    equipFits(id, monsterCard) { const f = EQUIP[id]; return f ? f(monsterCard) : false; },
    isFemale,
    // Monsters have no levels any more (the user's rule, 2026-09-23): every monster that is a deck card is summoned
    // or set for free. What stops a board of 3000 ATK monsters is the limit list, which now counts ATK instead.
    tributesFor() { return 0; },
    stars(n) { let s = ""; for (let i = 0; i < n; i++) s += STARS; return s; },
    kindName(c) { return { M: "Monster", S: "Spell", T: "Trap", R: "Ritual" }[c.kind]; },
    byCode(code) { for (const c of cards) if (c.code === code) return c; return null; },
    // short name for 8-char boxes
    short(c, n) { return c.name.length > n ? c.name.slice(0, n) : c.name; },
  };
  window.CardDB = CardDB;
})();
