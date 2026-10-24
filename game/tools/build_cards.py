"""Rebuilds CARDS.html: every card in the game, its art, its stats and the text its card page shows.

    python game/tools/build_cards.py

Reads the game's own data (through tools/build_cards.js, so the wording is exactly what the game prints) and cuts
the pictures out of assets/cards.png. Run it after any rules change that touches cards - the limit list, an
effect's wording, a new card - so the reference page never disagrees with the game.
"""
import base64, io, json, os, subprocess
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.dirname(HERE)
OUT = os.path.join(os.path.dirname(GAME), "CARDS.html")
COLS, CW, CH = 20, 64, 80

data = subprocess.run(["node", os.path.join(HERE, "build_cards.js")], capture_output=True, check=True)
cards = json.loads(data.stdout.decode("utf-8"))
atlas = Image.open(os.path.join(GAME, "assets", "cards.png")).convert("RGBA")

blank = 0
for c in cards:
    i = c["id"] - 1
    cell = atlas.crop(((i % COLS) * CW, (i // COLS) * CH, (i % COLS) * CW + CW, (i // COLS) * CH + CH))
    if not cell.getbbox():
        blank += 1
    buf = io.BytesIO()
    cell.save(buf, format="PNG", optimize=True)
    c["img"] = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")

count = lambda k: sum(1 for c in cards if c["kind"] == k)
limited = sum(1 for c in cards if c["copies"] == 1)
semi = sum(1 for c in cards if c["copies"] == 2)
summon_only = sum(1 for c in cards if not c["deckable"])

HTML = """<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Dark Duel Stories - Cards</title>
<style>
  body { font-family: Segoe UI, Arial, sans-serif; background: #1b1f24; color: #e6e6e6; margin: 0; padding: 16px; }
  h1 { margin: 0 0 4px; } p.sub { margin: 0 0 12px; color: #9aa4ad; max-width: 78ch; line-height: 1.5; }
  .bar { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 14px; }
  #search { width: 260px; padding: 8px 10px; font-size: 14px; border-radius: 6px; border: 1px solid #444; background: #262c33; color: #eee; }
  select { padding: 8px 10px; font-size: 14px; border-radius: 6px; border: 1px solid #444; background: #262c33; color: #eee; }
  #count { color: #9aa4ad; font-size: 13px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
  figure { margin: 0; background: #262c33; border-radius: 6px; padding: 8px; text-align: center; cursor: pointer; border: 2px solid transparent; position: relative; }
  figure:hover { border-color: #e0b040; }
  figure img { image-rendering: pixelated; display: block; margin: 0 auto 6px; width: 128px; height: 160px; }
  figcaption { font-size: 13px; line-height: 1.3; }
  figcaption .sub2 { color: #9aa4ad; }
  .tag { position: absolute; top: 6px; right: 6px; font-size: 11px; padding: 1px 5px; border-radius: 4px; background: #c04040; color: #fff; }
  .tag.r { background: #8050c0; } .tag.s { background: #c08040; }
  .kind { position: absolute; top: 6px; left: 6px; font-size: 11px; padding: 1px 5px; border-radius: 4px; background: #33404d; color: #cfe0f0; }
  #overlay { position: fixed; inset: 0; background: rgba(0,0,0,.7); display: none; align-items: center; justify-content: center; z-index: 10; }
  #overlay.open { display: flex; }
  #card { background: #f4f0e4; color: #222; border-radius: 10px; padding: 18px 20px; width: min(560px, 92vw); max-height: 90vh; overflow: auto; box-shadow: 0 8px 40px #000; display: grid; grid-template-columns: 192px 1fr; gap: 16px; }
  #card img { image-rendering: pixelated; width: 192px; height: 240px; display: block; }
  #card h2 { margin: 0 0 2px; font-size: 20px; } #card .no { color: #666; font-size: 13px; margin-bottom: 8px; }
  #card .stats { background: #e2dcc8; border-radius: 6px; padding: 8px 10px; font-size: 14px; margin-bottom: 10px; }
  #card .stats b { display: inline-block; min-width: 90px; }
  .pg { border-left: 4px solid #999; padding: 6px 10px; margin: 8px 0; background: #fbf9f3; border-radius: 0 6px 6px 0; font-size: 14px; line-height: 1.4; }
  .pg small { display: block; text-transform: uppercase; letter-spacing: .5px; font-size: 11px; color: #777; margin-bottom: 2px; }
  .pg.flavour { border-color: #444; font-style: italic; }
  .pg.effect { border-color: #a06020; } .pg.ritual { border-color: #7040a0; }
  .foot { margin-top: 10px; font-size: 12px; color: #666; }
  .nav { margin-top: 10px; display: flex; gap: 8px; align-items: center; font-size: 13px; color: #666; }
  .nav button { font-size: 13px; padding: 4px 10px; border-radius: 6px; border: 1px solid #bbb; background: #eee; cursor: pointer; }
</style></head><body>
<h1>Cards</h1>
<p class="sub">__SUB__</p>
<div class="bar">
  <input id="search" placeholder="search by name or card number">
  <select id="filter">
    <option value="all">every card</option>
    <option value="M">monsters</option>
    <option value="S">spells</option>
    <option value="T">traps</option>
    <option value="R">ritual cards</option>
    <option value="equip">equip spells</option>
    <option value="field">field spells</option>
    <option value="summon">summon-only monsters</option>
    <option value="limited">Limited (1 copy)</option>
    <option value="semi">Semi-Limited (2 copies)</option>
    <option value="effect">has an effect</option>
  </select>
  <span id="count"></span>
</div>
<div class="grid" id="grid"></div>
<div id="overlay"><div id="card"></div></div>
<script>
const CARDS = __DATA__;
const grid = document.getElementById("grid"), overlay = document.getElementById("overlay"), card = document.getElementById("card");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const KIND = { M: "", S: "spell", T: "trap", R: "ritual" };
const tagOf = (c) => !c.deckable ? '<span class="tag r">summon</span>' : c.copies === 1 ? '<span class="tag">1</span>' : c.copies === 2 ? '<span class="tag s">2</span>' : "";
const lineOf = (c) => c.kind === "M" ? c.atk + " / " + c.def : (KIND[c.kind] || "");
grid.innerHTML = CARDS.map((c, i) => '<figure data-i="' + i + '">' + tagOf(c) + (KIND[c.kind] ? '<span class="kind">' + KIND[c.kind] + '</span>' : "") +
  '<img src="' + c.img + '" alt="' + esc(c.name) + '" loading="lazy"><figcaption><b>' + c.id + '</b> ' + esc(c.name) +
  '<br><span class="sub2">' + lineOf(c) + '</span></figcaption></figure>').join("");
let cur = -1;
function show(i) {
  const c = CARDS[i]; if (!c) return; cur = i;
  const pages = ['<div class="pg flavour"><small>Card text</small>' + esc(c.desc || "-") + '</div>'];
  if (c.effect) pages.push('<div class="pg effect"><small>' + (c.kind === "M" ? "Effect (always on)" : c.kind === "R" ? "Ritual" : "What it does") + '</small>' + esc(c.effect) + '</div>');
  if (c.spcl) pages.push('<div class="pg effect"><small>SPCL - ' + esc(c.spcl.name) + '</small>' + esc(c.spcl.text) + '</div>');
  if (c.spcl2) pages.push('<div class="pg effect"><small>SPCL 2 - ' + esc(c.spcl2.name) + '</small>' + esc(c.spcl2.text) + '</div>');
  for (const u of (c.usedIn || [])) pages.push('<div class="pg ritual"><small>Used in ' + esc(u.spell) + '</small>' + esc(u.text) + '</div>');
  if (c.summonHow) pages.push('<div class="pg ritual"><small>Never a deck card - how it arrives</small>' + esc(c.summonHow) + '</div>');
  const copies = !c.deckable ? "never in a deck" : c.copies + " per deck" + (c.limit ? " (" + c.limit + ")" : "");
  const stats = c.kind === "M"
    ? '<b>ATK / DEF</b> ' + c.atk + ' / ' + c.def + '<br><b>Attribute</b> ' + esc(c.el) + '<br><b>Type</b> ' + esc(c.ty) + '<br><b>Copies</b> ' + esc(copies)
    : '<b>Kind</b> ' + (c.kind === "S" ? (c.equip ? "Equip spell" : c.field ? "Field spell" : "Spell") : c.kind === "T" ? "Trap" : "Ritual card") +
      (c.fits ? '<br><b>Fits</b> ' + esc(c.fits) : "") + (c.summons ? '<br><b>Summons</b> ' + esc(c.summons) : "") + '<br><b>Copies</b> ' + esc(copies);
  card.innerHTML = '<img src="' + c.img + '" alt="">' +
    '<div><h2>' + esc(c.name) + '</h2><div class="no">No. ' + c.id + '</div>' +
    '<div class="stats">' + stats + '</div>' + pages.join("") +
    '<div class="foot">' + (c.deckable ? "Shop: " + esc(c.rarity) + ", " + c.price + " Domino" : "not sold") +
      ((c.recipes && c.recipes.length) ? " - " + c.recipes.length + " fusion recipe" + (c.recipes.length === 1 ? "" : "s") + (c.recipes.length <= 4 ? ": " + esc(c.recipes.join(", ")) : "") : "") + '</div>' +
    '<div class="nav"><button id="prev">&#9664; previous</button><span>Esc closes, arrow keys move</span><button id="next">next &#9654;</button></div></div>';
  document.getElementById("prev").onclick = (e) => { e.stopPropagation(); show(i - 1); };
  document.getElementById("next").onclick = (e) => { e.stopPropagation(); show(i + 1); };
  overlay.classList.add("open");
}
grid.addEventListener("click", (e) => { const f = e.target.closest("figure"); if (f) show(Number(f.dataset.i)); });
overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.classList.remove("open"); });
document.addEventListener("keydown", (e) => {
  if (!overlay.classList.contains("open")) return;
  if (e.key === "Escape") overlay.classList.remove("open");
  else if (e.key === "ArrowLeft") show(cur - 1);
  else if (e.key === "ArrowRight") show(cur + 1);
});
const search = document.getElementById("search"), filter = document.getElementById("filter"), count = document.getElementById("count");
function refresh() {
  const q = search.value.trim().toLowerCase(), f = filter.value;
  let n = 0;
  for (const fig of grid.children) {
    const c = CARDS[Number(fig.dataset.i)];
    const okText = !q || c.name.toLowerCase().includes(q) || String(c.id) === q;
    const okKind = f === "all" || c.kind === f || (f === "equip" && c.equip) || (f === "field" && c.field)
      || (f === "summon" && !c.deckable) || (f === "limited" && c.copies === 1) || (f === "semi" && c.copies === 2)
      || (f === "effect" && (c.effect || c.spcl || c.spcl2));
    const on = okText && okKind;
    fig.style.display = on ? "" : "none";
    if (on) n++;
  }
  count.textContent = n + " shown";
}
search.addEventListener("input", refresh);
filter.addEventListener("change", refresh);
refresh();
</script>
</body></html>
"""

sub = ("Every card in the game: %d monsters, %d spells, %d traps and %d ritual cards. There are no levels any more and "
       "nothing is ever offered for a summon except a Toon, so what limits a deck is the limit list, and it counts ATK: "
       "2500 ATK or more is Limited to 1 copy, 2100 or more is Semi-Limited to 2, and a few cards are held down for what "
       "they do rather than what they hit for (%d Limited, %d Semi-Limited in all). %d monsters are never deck cards at "
       "all - they only arrive by ritual, by fusion, by an equip or by another monster's effect, and their page says which."
       % (count("M"), count("S"), count("T"), count("R"), limited, semi, summon_only))

html = HTML.replace("__SUB__", sub).replace("__DATA__", json.dumps(cards, separators=(",", ":")))
with io.open(OUT, "w", encoding="utf-8", newline="\n") as f:
    f.write(html)
print("CARDS.html", "%.1f MB" % (len(html.encode("utf-8")) / 1048576.0), "-", len(cards), "cards:",
      "%d monsters, %d spells, %d traps, %d rituals; %d limited, %d semi, %d summon-only"
      % (count("M"), count("S"), count("T"), count("R"), limited, semi, summon_only),
      ("(%d had no picture)" % blank) if blank else "")
