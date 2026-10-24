"""Builds ../data/*.js from the GameFAQs guides + intermediate JSON next to this script."""
import json, os, re, difflib, html, glob, collections

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
GUIDES = os.path.join(ROOT, "gameplay references")
OUT = os.path.join(os.path.dirname(HERE), "data")
os.makedirs(OUT, exist_ok=True)


def guide_text(name_part):
    f = [p for p in glob.glob(os.path.join(GUIDES, "*.html")) if name_part in p][0]
    raw = open(f, encoding="utf-8", errors="ignore").read()
    m = re.search(r'<div[^>]*class="faqtext"[^>]*>(.*?)</div>\s*<div[^>]*class="ffaq_nav', raw, re.S) or \
        re.search(r'<div[^>]*class="faqtext"[^>]*>(.*)', raw, re.S)
    body = m.group(1) if m else raw
    body = re.sub(r'</pre>', '\n', body)
    body = re.sub(r'<br\s*/?>', '\n', body)
    body = re.sub(r'<script.*?</script>', '', body, flags=re.S)
    body = re.sub(r'<style.*?</style>', '', body, flags=re.S)
    return html.unescape(re.sub(r'<[^>]+>', '', body))


def norm(s):
    return re.sub(r'[^a-z0-9]', '', s.lower())


# ------------------------------------------------------------------ cards
cards_in = json.load(open(os.path.join(HERE, "cards_named.json")))
ELEM = {"fiend": "Fiend", "forest": "Forest", "aqua": "Aqua", "earth": "Earth", "shadow": "Shadow", "light": "Light",
        "wind": "Wind", "pyro": "Pyro", "dreams": "Dreams", "devine": "Devine", "thunder": "Thunder"}
TYPE = {"warrior": "Warrior", "fiend": "Fiend", "magician": "Magician", "aqua": "Aqua", "machine": "Machine", "beast": "Beast",
        "insect": "Insect", "dragon": "Dragon", "zombie": "Zombie", "rock": "Rock", "fairy": "Fairy", "plant": "Plant",
        "wngbeast": "WngBeast", "fish": "Fish", "thunder": "Thunder", "dinosaur": "Dinosaur", "beastwar": "BeastWar",
        "reptile": "Reptile", "pyro": "Pyro", "seadragn": "SeaDragn", "seadragon": "SeaDragn"}
NAME_FIX = {595: "Fiend Reflection #1", 186: "Fiend Reflection #2", 742: "Red-eyes B. Metal Dragon", 151: "Rhaimundos of the Red Sword",
            750: "Chimera the Flying Mythical Beast", 83: "Castle of Dark Illusions", 380: "B.eyes Ultimate Dragon",
            727: "Toon Ryu-ran"}   # the user's call: it is one of the Toons, and it is named like one
# guide typos / commentary that leaked into the card texts
DESC_FIX = {298: "Two-headed dragon double the teeth", 295: "A mistake born in a basement lab",
            62: "Her pet dragon fights harder for her", 738: "One of the three Magnet Warriors", 757: "One of the three Magnet Warriors"}
cards = []
for c in cards_in:
    t = (c["type"] or "").lower().replace(" ", "")
    name = NAME_FIX.get(c["id"], c["name"]).strip()
    desc = (c["desc"] or "").strip()
    desc = re.sub(r'\s*\*.*$', '', desc)          # "*Another typo of the game writers...*" remarks
    desc = re.sub(r'\s+', ' ', desc).strip()
    desc = DESC_FIX.get(c["id"], desc)
    cost = int(re.sub(r'\D', '', c["cost"] or "0") or 0)
    if cost > 255:
        cost = 0
    d = {"id": c["id"], "name": name, "code": (c["code"] or "").strip()[:8], "cost": cost, "desc": desc}
    if c["id"] == 735: c["level"] = "6"
    if c["id"] == 587: c["atkdef"] = "1300/1000"
    if c["id"] == 617: c["atkdef"] = "1700/1600"   # guide typo: 16000 DEF
    if c["id"] == 746: c["atkdef"] = "1200/1400"   # guide typo: 140 DEF
    if c["id"] == 706: c["atkdef"] = "2350/2400"   # guide typo: Serpent Night Dragon is 2350, not 1350
    if c["id"] == 703: c["atkdef"] = "2750/2500"   # guide typo: Sengenjin is 2750, not 750
    if c["id"] == 745: c["level"] = "4"            # the user's call: Panther Warrior duels at its TCG level, not the
                                                   # cartridge's 6 - under modern rules that 6 costs it an offering
    if t in ("magic", "trap", "ritual"):
        d["kind"] = {"magic": "S", "trap": "T", "ritual": "R"}[t]
    else:
        d["kind"] = "M"
        d["lv"] = int(c["level"])
        d["el"] = ELEM[(c["element"] or "").lower()]
        d["ty"] = TYPE[t]
        a, b = re.match(r'^\s*(\d+)\s*/\s*(\d+)\s*$', c["atkdef"]).groups()
        d["atk"], d["def"] = int(a), int(b)
    cards.append(d)
# ------------------------------------------------------------------ cards added to the remake (art in
# "image references/card art references/usable cards", stats and flavour from the TCG, effects in js/data/effects.js)
EXTRA = [
    (801, "Buster Blader", "78193831", 60, "Dragon-slaying swordsman", 7, "Earth", "Warrior", 2600, 2300),
    (802, "Dark Paladin", "98502113", 0, "Dark Magician and Buster Blader as one", 8, "Shadow", "Magician", 2900, 2400),
    (803, "Cyber Dragon", "70095154", 55, "A mechanical dragon that drops in alone", 5, "Light", "Machine", 2100, 1600),
    (804, "Cyber Dinosaur", "63311886", 62, "Machine saurian roused by the enemy", 7, "Light", "Machine", 2500, 1900),
    (805, "Gorz the Emissary", "44330098", 70, "Emissary of darkness answering a blow", 7, "Shadow", "Fiend", 2700, 2500),
    (806, "Junk Synchron", "63977008", 30, "Little machine that wakes the scrapped", 3, "Shadow", "Warrior", 1300, 500),
    (807, "Junk Warrior", "60800381", 0, "Scrap fighter as strong as its friends", 5, "Shadow", "Warrior", 2300, 1300),
    (808, "White-Horned Dragon", "73891874", 52, "Its horn drinks the magic of the enemy", 6, "Shadow", "Dragon", 2200, 1400),
    (809, "Wingweaver", "31447217", 68, "Six-winged fairy praying for peace", 7, "Light", "Fairy", 2750, 2400),
    (810, "Metal Armored Bug", "65957473", 66, "Armoured insect that destroys all in its path", 8, "Earth", "Insect", 2800, 1500),
    (811, "Flame Champion", "42599677", 44, "Warrior with a shield of flame", 5, "Pyro", "Pyro", 1900, 1300),
    (812, "Harpie's Brother", "30532390", 40, "Hawk-eyed master of the sky", 4, "Wind", "WngBeast", 1800, 600),
    (813, "Call of the Haunted", "97077563", 40, "Calls a monster back from the graveyard", None, None, None, None, None),
    (814, "Mirror Force", "44095762", 50, "Turns an attack back on every attacker", None, None, None, None, None),
    (815, "Trap Hole", "04206964", 35, "A pit that swallows a strong newcomer", None, None, None, None, None),
    # the second batch the user asked for (2026-09-24), art in "card art references/more cards"
    (816, "Card of Demise", "59750328", 45, "Three cards now, an empty hand later", None, None, None, None, None),
    (817, "Dark Sage", "92377303", 0, "The magician as the years made him", 6, "Shadow", "Magician", 2800, 3200),
    (818, "Monster Reborn", "83764718", 50, "Calls anything back from either grave", None, None, None, None, None),
    (819, "Reasoning", "58577036", 40, "Your deck picks a monster for you", None, None, None, None, None),
    (820, "Reinforcement of the Army", "32807846", 30, "Calls a warrior up from the deck", None, None, None, None, None),
    (821, "Toon D. Magician Girl", "90960358", 27, "Toon-transformed magician's apprentice", 6, "Shadow", "Magician", 2000, 1700),
    (822, "Toon Table of Contents", "89997728", 30, "Finds a Toon card in your deck", None, None, None, None, None),
    (823, "Toon World", "15259703", 45, "The book the Toons live in", None, None, None, None, None),
]
EXTRA_KIND = {813: "S", 814: "T", 815: "T", 816: "S", 818: "S", 819: "S", 820: "S", 822: "S", 823: "S"}
for (cid, name, code, cost, desc, lv, el, ty, atk, dfn) in EXTRA:
    d = {"id": cid, "name": name, "code": code, "cost": cost, "desc": desc, "kind": EXTRA_KIND.get(cid, "M")}
    if d["kind"] == "M":
        d.update({"lv": lv, "el": el, "ty": ty, "atk": atk, "def": dfn})
    cards.append(d)

cards.sort(key=lambda d: d["id"])
assert [d["id"] for d in cards] == list(range(1, 801 + len(EXTRA)))
byid = {d["id"]: d for d in cards}
# password codes must be unique 8-digit; fix bad ones deterministically
seen = set()
for d in cards:
    if not re.match(r'^\d{8}$', d["code"]) or d["code"] in seen:
        d["code"] = "%08d" % ((d["id"] * 7919 + 12345) % 100000000)
    seen.add(d["code"])

# ------------------------------------------------------------------ fusions
fus_raw = json.load(open(os.path.join(HERE, "fusions_raw.json")))
fmap = json.load(open(os.path.join(HERE, "fusion_name_to_id.json")))
fusions = {}
bad = 0
for a, b, c in fus_raw:
    if a not in fmap or b not in fmap or c not in fmap:
        bad += 1
        continue
    ia, ib, ic = fmap[a], fmap[b], fmap[c]
    k = (min(ia, ib), max(ia, ib))
    if k in fusions:
        continue
    fusions[k] = ic
# ------------------------------------------------------------------ fusion recipes the cartridge never had
# Seventeen monsters the TCG prints as Fusions had no recipe in the guide at all - they were simply deck cards there.
# Now that a Fusion monster can only ever be summoned, each one needs a way onto the field, so they get their official
# TCG materials. Three of them name cards this game does not have, and use the closest thing in the cartridge instead:
#   Kaiser Dragon      Winged Dragon, Guardian of the Fortress #1 -> Winged Dragon #1
#   Pragtical          Trakodon -> Two-headed King Rex, the other dinosaur of its kind
#   The Last Warrior   Zombyra the Dark + Maryokutai -> Dark Assailant + Sword Hunter, dark warriors both
EXTRA_FUSIONS = [
    (35, 801, 802),    # D. Magician + Buster Blader -> Dark Paladin (the user's rule: no offering effects)
    (160, 161, 43),    # M-warrior #1 + M-warrior #2 -> Karbonala Warrior
    (201, 5, 86),      # Frenzied Panda + Ryu-kishin -> Barox
    (2, 104, 115),     # Mystical Elf + Curtain of the dark -> Kamionwizard
    (157, 200, 168),   # Firegrass + Petit Dragon -> Darkfire Dragon
    (387, 647, 223),   # Mystic Lamp + Hyosube -> Roaring Ocean Snake
    (95, 120, 385),    # Crass Clown + Dream Clown -> Bickuribox
    (236, 280, 389),   # Guardian of the Labyrinth + Protector of the Throne -> Giltia the D. Knight
    (7, 603, 427),     # Winged Dragon #1 + Fairy Dragon -> Kaiser Dragon
    (439, 543, 437),   # Bottom Dweller + Tongyo -> Deepsea Shark
    (32, 644, 482),    # Two-headed King Rex + Flame Viper -> Pragtical
    (32, 81, 509),     # Two-headed King Rex + Crawling Dragon #2 -> Bracchio-raidus
    (581, 146, 521),   # Takuhee + Temple of Skulls -> Skullbird
    (474, 646, 565),   # Sea Kamen + Gruesome Goo -> Man-eating Black Shark
    (635, 649, 572),   # Queen's Double + Hibikime -> Empress Judge
    (299, 234, 618),   # Sonic Maid + Beautiful Headhuntress -> Warrior of tradition
    (162, 175, 707),   # Tainted Wisdom + Ancient Brain -> Skull Knight
    (241, 773, 794),   # Dark Assailant + Sword Hunter -> The Last Warrior from Another Planet
    (16, 35, 817),     # Time Wizard + D. Magician -> Dark Sage (the user's rule: the Sage is made, not summoned)
]
for a_, b_, r_ in EXTRA_FUSIONS:
    lo, hi = min(a_, b_), max(a_, b_)
    fusions[(lo, hi)] = r_
print("extra fusion recipes:", len(EXTRA_FUSIONS))

print("fusions:", len(fusions), "bad lines:", bad)
# pack: base-36 3 chars per number? ids < 801 -> 2 chars base 32 is enough (32*32=1024)
B32 = "0123456789abcdefghijklmnopqrstuv"


def enc(n):
    return B32[n // 32] + B32[n % 32]


packed = "".join(enc(a) + enc(b) + enc(c) for (a, b), c in sorted(fusions.items()))

# ------------------------------------------------------------------ opponent decks
decks = json.load(open(os.path.join(HERE, "opp_decks.json")))


def flat(cardlist, target=40):
    out = []
    for cid, n in cardlist:
        out += [cid] * n
    # normalise to 40 cards
    if len(out) > target:
        out = out[:target]
    while len(out) < target:
        out.append(out[len(out) % max(1, len(out))])
    return out


# ------------------------------------------------------------------ drop lists
drop_txt = guide_text("Card Drop List")
sec_start = drop_txt.index("-Listing for the first town\n***")
sec_end = drop_txt.index("-Future edition", sec_start)
drop_sec = drop_txt[sec_start:sec_end]
DUELIST_HEADERS = ["Yugi", "Tristan", "Joey", "Mai", "Mako", "Esp Roba", "Rex", "Weevil", "Seeker", "Pandora", "Kaiba",
                   "Paradox", "P. Seto", "Slysheen", "Ishizu", "DarkNite", "Yami Yugi", "Shadi", "Bakura", "Nitemare", "Marik", "Yugi's Grandpa"]
lines = [ln.strip() for ln in drop_sec.split("\n")]
drops = {}
cur = None
name_keys = {norm(d["name"]): d["id"] for d in cards}
name_list = list(name_keys)
unmatched = []


ALIASES = {"swordofruin": 302, "dwordofruin": 302, "constructofmask": 693, "swordmanfromaf": 399, "swordsmanfromafar": 399,
           "sworsmanfromaf": 399, "charubinfireknight": 133, "insectsoldiersofswarm": 478, "ancienttreeofent": 273, "dragonhuman": 502,
           "blueeyesultradragon": 380, "blackdragonjungleking": 571, "rightlegofforbidden": 17, "castleofdarkmagic": 83, "stonedragon": 426,
           "skull": 707, "knight": None}


def match_name(s):
    s = s.strip()
    if not s:
        return None
    n = norm(s)
    if n in ALIASES:
        return ALIASES[n]
    if n in name_keys:
        return name_keys[n]
    pref = [k for k in name_list if k.startswith(n) and len(n) >= 6]
    if len(pref) == 1:
        return name_keys[pref[0]]
    if len(pref) > 1:
        return name_keys[min(pref, key=len)]
    best = difflib.get_close_matches(n, name_list, n=1, cutoff=0.82)
    if best:
        return name_keys[best[0]]
    return None


for ln in lines:
    if not ln or ln.startswith("*") or ln.startswith("-"):
        continue
    hdr = re.sub(r'\s*\d{8}$', '', ln).replace("P.Seto", "P. Seto")
    if hdr in DUELIST_HEADERS:
        cur = hdr
        drops[cur] = []
        continue
    if cur is None:
        continue
    cid = match_name(ln)
    if cid is None:
        unmatched.append((cur, ln))
    elif cid not in drops[cur]:
        drops[cur].append(cid)
print("drop lists:", {k: len(v) for k, v in drops.items()})
print("unmatched drop names:", len(unmatched))
for u in unmatched:
    print("   ", u)

# ------------------------------------------------------------------ write JS
with open(os.path.join(OUT, "cards.js"), "w", encoding="utf-8") as f:
    f.write("// Generated by tools/build_data.py -- the 800 Dark Duel Stories cards, then the remake's own\n")
    f.write("window.DDS_CARDS = " + json.dumps(cards, separators=(",", ":"), ensure_ascii=False) + ";\n")
with open(os.path.join(OUT, "fusions.js"), "w", encoding="utf-8") as f:
    f.write("// Generated -- %d fusion recipes packed as 6 base-32 chars each (a,b,result)\n" % len(fusions))
    f.write("window.DDS_FUSIONS_PACKED = " + json.dumps(packed) + ";\n")
with open(os.path.join(OUT, "decks.js"), "w", encoding="utf-8") as f:
    f.write("// Generated -- opponent decks (card ids) and drop lists\n")
    dk = {k: flat(v["cards"]) for k, v in decks.items()}
    # the guide lists 39 starter cards; pad with a second Zone Eater instead of a 4th Killer Snake
    st = []
    for cid, n in decks["Your First Deck!"]["cards"]:
        st += [cid] * n
    while len(st) < 40:
        st.append(393)
    dk["Your First Deck!"] = st[:40]
    f.write("window.DDS_DECKS = " + json.dumps(dk, separators=(",", ":")) + ";\n")
    f.write("window.DDS_DROPS = " + json.dumps(drops, separators=(",", ":")) + ";\n")
print("written")
