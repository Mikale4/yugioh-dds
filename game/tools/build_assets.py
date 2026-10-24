"""Builds the game's image assets from the reference sprite sheets.

Run from anywhere:  python build_assets.py
Outputs go to ../assets/.  Intermediate mapping files live next to this script.
"""
import json, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))            # C:\Games\Yugioh DDS
REF = os.path.join(ROOT, "image references")
OUT = os.path.join(os.path.dirname(HERE), "assets")
os.makedirs(OUT, exist_ok=True)

MAGENTA = (255, 0, 127)
TEAL = (0, 85, 127)


def load(path):
    return Image.open(os.path.join(REF, path)).convert("RGBA")


# ---------------------------------------------------------------- card atlas
# cards the remake adds on top of the cartridge's 800: one picture per file, named after the card
EXTRA_CARDS = {
    801: "Buster Blader", 802: "Dark Paladin", 803: "Cyber Dragon", 804: "Cyber Dinosaur",
    805: "Gorz the Emissary of Darkness", 806: "Junk Synchron", 807: "Junk Warrior", 808: "White-Horned Dragon",
    809: "Wingweaver", 810: "Metal Armored Bug", 811: "Flame Champion", 812: "Harpie's Brother",
    813: "Call of the Haunted", 814: "Mirror Force", 815: "Trap Hole",
    816: "Card of Demise", 817: "Dark Sage", 818: "Monster Reborn", 819: "Reasoning",
    820: "Reinforcement of the Army", 821: "Toon Dark Magician Girl", 822: "Toon Table of Contents", 823: "Toon World",
}
# where to look for them: the first batch was cut to size by hand, the second came in as full-size pixel art
EXTRA_DIRS = ["usable cards", "more cards"]


def build_cards():
    sheet = load("card art references/Game Boy _ GBC - Yu-Gi-Oh! Dark Duel Stories - Cards - Cards.png")
    pos_to_id = {int(k): v for k, v in json.load(open(os.path.join(HERE, "sheet_pos_to_id.json"))).items()}
    cols = 20
    last = max(list(pos_to_id.values()) + list(EXTRA_CARDS))
    rows = (last + cols - 1) // cols
    atlas = Image.new("RGBA", (cols * 64, rows * 80), (0, 0, 0, 0))
    for pos, cid in pos_to_id.items():
        r, c = divmod(pos, 10)
        cell = sheet.crop((2 + c * 66, 2 + r * 82, 2 + c * 66 + 64, 2 + r * 82 + 80))
        i = cid - 1
        atlas.paste(cell, ((i % cols) * 64, (i // cols) * 80))
    # the new cards are drawn at twice the card size, so they halve down exactly; odd widths get their edge column
    # repeated first rather than resampled, which would soften the pixels
    for cid, name in sorted(EXTRA_CARDS.items()):
        path = next((p for p in (os.path.join(REF, "card art references", d, name + ".png") for d in EXTRA_DIRS) if os.path.exists(p)), None)
        if not path:
            print("   missing art for", name)
            continue
        art = Image.open(path).convert("RGBA")
        i = cid - 1
        if art.width > 256:
            # pixel art drawn far above card size: average it straight down, which reconstructs the original grid
            cell = art.resize((64, 80), Image.BOX)
        else:
            if art.width % 2:
                art = art.crop((0, 0, art.width + 1, art.height))
            if art.width != 128 or art.height != 160:
                pad = Image.new("RGBA", (128, 160), (0, 0, 0, 255))
                pad.paste(art.resize((min(128, art.width), min(160, art.height)), Image.NEAREST), (0, 0))
                art = pad
            cell = art.resize((64, 80), Image.NEAREST)
        atlas.paste(cell, ((i % cols) * 64, (i // cols) * 80))
    atlas.save(os.path.join(OUT, "cards.png"), optimize=True)
    print("cards.png", atlas.size, "(%d cards, %d of them the remake's own)" % (last, len(EXTRA_CARDS)))


# ---------------------------------------------------------------- portraits
PORTRAITS = [  # (box index in mug_boxes.json, key, erase rects in absolute sheet coords)
    (0, "pandora", [(22, 17, 54, 72)]),
    (1, "kaiba", [(263, 17, 292, 72)]),
    (2, "esproba", [(298, 17, 322, 72)]),
    (3, "ishizu", [(446, 17, 454, 72)]),
    (4, "joey", [(554, 17, 592, 105)]),
    (5, "mai", [(10, 107, 42, 162)]),
    (6, "mako", []),
    (7, "marik", []),
    (8, "darknite", [(439, 107, 467, 142)]),
    (9, "nitemare", []),
    (10, "pseto", [(2, 197, 40, 262)]),
    (11, "paradox", [(164, 197, 200, 262)]),
    (12, "rex", [(338, 197, 350, 262)]),
    (13, "grandpa", [(560, 197, 593, 262)]),
    (14, "shadi", []),
    (15, "slysheen", [(102, 287, 150, 332)]),
    (16, "tea", [(234, 287, 282, 375)]),
    (17, "tristan", [(304, 287, 346, 352)]),
    (18, "weevil", [(449, 287, 457, 340)]),
    (19, "seeker", [(682, 287, 716, 340)]),
    (20, "yamibakura", []),
    (21, "yamiyugi", [(173, 413, 183, 466)]),
    (22, "yugi", []),
]


# the Japanese Duel Monsters II mugshot sheet: the characters the US sheet never shipped (160x88 cells on a plain
# background, so they need no erase rectangles). (cell index in JPN_BOXES, key)
JPN_BOXES = [[8, 16], [176, 16], [344, 16], [512, 16], [680, 16], [8, 112], [176, 112], [344, 112], [512, 112], [680, 112],
             [8, 208], [176, 208], [344, 208], [512, 208], [680, 208], [8, 312], [176, 312], [344, 312], [512, 312], [680, 312],
             [8, 408], [176, 408], [344, 408], [512, 408]]
JPN_PORTRAITS = [
    (14, "keith"),      # Bandit Keith, the stars-and-stripes card sharp
    (15, "pegasus"),    # Pegasus J. Crawford, silver hair over the Millennium Eye
    (9, "mokuba"),      # Mokuba Kaiba
    (11, "bakura"),     # Ryou Bakura, before the Ring takes him
    (13, "panik"),      # Panik, the Player Killer of Darkness
    (17, "solomon"),    # Solomon Muto behind his shop counter
    (20, "para"),       # Para of the Paradox Brothers
    (21, "dox"),        # and Dox
    (10, "shopkeep"),   # the card shop's owner, headband and all (spare)
    (12, "puppeteer"),  # the top-hatted showman with his dolls (spare)
    (16, "heishin"),    # the high priest with the cobra crown (spare)
    (22, "priestess"),  # the Egyptian priestess (spare)
]



# The mugshot sheets pack each character's animation tiles (spare eyes, mouths, hands) right next to the portrait, so a
# 160-wide window catches slivers of them. They are always small and always hug the left or right edge of the window,
# while the portrait itself is one big blob, so a flood fill can tell them apart.
def drop_edge_bits(crop, min_area=400):
    a = np.array(crop)
    solid = a[:, :, 3] > 0
    h, w = solid.shape
    seen = np.zeros_like(solid)
    for sy in range(h):
        for sx in range(w):
            if not solid[sy, sx] or seen[sy, sx]:
                continue
            stack, cells, touches_edge = [(sy, sx)], [], False
            seen[sy, sx] = True
            while stack:
                y, x = stack.pop()
                cells.append((y, x))
                if x <= 1 or x >= w - 2:
                    touches_edge = True
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and solid[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
            if touches_edge and len(cells) < min_area:
                for (y, x) in cells:
                    a[y, x] = (0, 0, 0, 0)
    return Image.fromarray(a)


def build_portraits():
    sheet = load("character art references/Game Boy _ GBC - Yu-Gi-Oh! Dark Duel Stories - Miscellaneous - Character Mugshots.png")
    boxes = json.load(open(os.path.join(HERE, "mug_boxes.json")))
    a = np.array(sheet)
    bg = np.all(a[:, :, :3] == MAGENTA, axis=2) | np.all(a[:, :, :3] == TEAL, axis=2)
    a[bg] = (0, 0, 0, 0)
    for (bi, key, rects) in PORTRAITS:
        for (x0, y0, x1, y1) in rects:
            a[y0:y1, x0:x1] = (0, 0, 0, 0)
    sheet = Image.fromarray(a)
    jsheet = load("character art references/Game Boy _ GBC - Yu-Gi-Oh! Duel Monsters 2_ Dark Duel Stories (JPN) - Characters - Character Mugshots.png")
    ja = np.array(jsheet)
    ja[np.all(ja[:, :, :3] == (60, 60, 90), axis=2)] = (0, 0, 0, 0)
    jsheet = Image.fromarray(ja)
    every = [(sheet, boxes[bi], key) for (bi, key, rects) in PORTRAITS] + [(jsheet, JPN_BOXES[bi] + [160, 88], key) for (bi, key) in JPN_PORTRAITS]
    atlas = Image.new("RGBA", (160, 88 * len(every)), (0, 0, 0, 0))
    index = {}
    for n, (src, (x0, y0, w, h), key) in enumerate(every):
        crop = drop_edge_bits(src.crop((x0, y0, x0 + w, y0 + h)))
        # trim transparent columns/rows
        bbox = crop.getbbox()
        crop = crop.crop(bbox)
        w, h = crop.size
        atlas.paste(crop.crop((0, 0, min(w, 160), min(h, 88))), (max(0, (160 - w) // 2), n * 88 + max(0, 88 - h)))
        index[key] = n
    atlas.save(os.path.join(OUT, "portraits.png"), optimize=True)
    json.dump(index, open(os.path.join(OUT, "portraits.json"), "w"))
    print("portraits.png", atlas.size)
    # 32x32 face icons for the campaign maps: a 64x64 window around the face, halved
    faces = Image.new("RGBA", (32, 32 * len(every)), (0, 0, 0, 0))
    for n, (src, box, key) in enumerate(every):
        cell = atlas.crop((0, n * 88, 160, n * 88 + 88))
        bb = cell.getbbox()
        cx = (bb[0] + bb[2]) // 2 + FACE_DX.get(key, 0)
        top = max(0, min(88 - 64, bb[1] + FACE_DY.get(key, 0)))
        win = cell.crop((cx - 32, top, cx + 32, top + 64))
        bgc = Image.new("RGBA", win.size, (16, 8, 24, 255))
        bgc.alpha_composite(win)
        faces.paste(bgc.resize((32, 32), Image.LANCZOS), (0, n * 32))
    faces.save(os.path.join(OUT, "faces.png"))
    return index


FACE_DX = {"pandora": 10, "kaiba": 14, "joey": -6, "mai": 10, "seeker": 4, "nitemare": 0, "darknite": -6, "slysheen": -14, "esproba": 0, "ishizu": 16, "yamiyugi": 4, "tea": -4,
           "keith": 2, "pegasus": 16, "mokuba": 0, "bakura": 4, "panik": 0, "solomon": 0, "para": 6, "dox": -2, "shopkeep": 8, "puppeteer": 0, "heishin": 0, "priestess": 4}
FACE_DY = {"kaiba": -2, "pandora": 0, "yamiyugi": 6, "yugi": 4,
           "keith": 18, "pegasus": 20, "mokuba": 16, "bakura": 12, "panik": 12, "solomon": 14, "para": 12, "dox": 12, "shopkeep": 10, "puppeteer": 14, "heishin": 18, "priestess": 10}


# ---------------------------------------------------------------- talk scenes (authentic 160x88 framed scenes)
# Some ripped talk scenes carry a stray animation piece (a spare mouth or eye) inside the frame, left of the character.
# Each entry paints over one of them with a strip of the background beside it: (x, y, w, h, source x, source width).
SCENE_PATCHES = {
    "joey": [(11, 32, 26, 42, 2, 9)],
    "mai": [(6, 46, 22, 20, 0, 6)],
}


def cover(scene, x, y, w, h, sx, sw):
    strip = scene.crop((sx, y, sx + sw, y + h))
    for ox in range(x, x + w, sw):
        scene.paste(strip.crop((0, 0, min(sw, x + w - ox), h)), (ox, y))


def build_scenes():
    scenes = {}
    misc = load("lobby background references/Game Boy _ GBC - Yu-Gi-Oh! Dark Duel Stories - Miscellaneous - Miscellaneous.png")
    # these ripped scenes are animation base layers: the eyes/mouths are separate pieces, so the faces are blank.
    # The mugshot portraits are complete, so paste each portrait over its scene at the best-matching offset.
    portraits = Image.open(os.path.join(OUT, "portraits.png")).convert("RGBA")
    pidx = json.load(open(os.path.join(OUT, "portraits.json")))
    for key, (x, y) in {"yugi": (162, 1), "tristan": (326, 1), "mai": (164, 128), "mako": (328, 128), "joey": (336, 258)}.items():
        scene = misc.crop((x, y, x + 160, y + 88))
        port = portraits.crop((0, pidx[key] * 88, 160, pidx[key] * 88 + 88))
        bb = port.getbbox()
        port = port.crop(bb)
        pa = np.array(port)
        sa = np.array(scene)
        mask = pa[:, :, 3] > 0
        best = None
        for dy in range(-24, 25):
            for dx in range(-40, 41):
                ox, oy = bb[0] + dx, bb[1] + dy
                if ox < 0 or oy < 0 or ox + pa.shape[1] > 160 or oy + pa.shape[0] > 88:
                    continue
                region = sa[oy:oy + pa.shape[0], ox:ox + pa.shape[1], :3]
                eq = np.all(region == pa[:, :, :3], axis=2) & mask
                score = eq.sum()
                if best is None or score > best[0]:
                    best = (score, ox, oy)
        score, ox, oy = best
        print("scene", key, "portrait match", round(score / mask.sum(), 3), "at", ox, oy)
        for (px, py, pw, ph, psx, psw) in SCENE_PATCHES.get(key, []):
            cover(scene, px, py, pw, ph, psx, psw)
        scene.alpha_composite(port, (ox, oy))
        scenes[key] = scene
    for key, f in {"kaiba": "misc references/Kaiba-DDS.png", "yamibakura": "misc references/YaBakura-DDS.png"}.items():
        scenes[key] = load(f).crop((0, 0, 160, 88))
    # intro screen (5x exact) -> also a Yugi scene and the dialog-box style
    intro = load("misc references/yu-gi-oh-dark-duel-stories-02_1200x1200.png").resize((160, 144), Image.NEAREST)
    intro.save(os.path.join(OUT, "intro.png"))
    keys = list(scenes)
    atlas = Image.new("RGBA", (160, 88 * len(keys)))
    for i, k in enumerate(keys):
        atlas.paste(scenes[k], (0, i * 88))
    atlas.save(os.path.join(OUT, "scenes.png"), optimize=True)
    json.dump({k: i for i, k in enumerate(keys)}, open(os.path.join(OUT, "scenes.json"), "w"))
    print("scenes.png", atlas.size)


# ---------------------------------------------------------------- backgrounds
def build_backgrounds():
    sheet = load("lobby background references/Game Boy _ GBC - Yu-Gi-Oh! Dark Duel Stories - Miscellaneous - Backgrounds.png")
    tiles = []
    for r in range(3):
        for c in range(5):
            x, y = 2 + 162 * c, 17 + 146 * r
            t = sheet.crop((x, y, x + 160, y + 144))
            if t.getbbox() is None:
                continue
            # skip empty (teal) cells
            arr = np.array(t)
            if np.all(arr[:, :, :3] == TEAL):
                continue
            tiles.append(t)
    atlas = Image.new("RGBA", (160, 144 * len(tiles)))
    boxes = {}
    for i, t in enumerate(tiles):
        atlas.paste(t, (0, i * 144))
        # find bright-green placeholder boxes (map icon slots)
        arr = np.array(t)
        g = (arr[:, :, 0] == 138) & (arr[:, :, 1] == 255) & (arr[:, :, 2] == 0)
        if g.sum() > 200:
            from scipy import ndimage
            lab, n = ndimage.label(g)
            bl = []
            for sl in ndimage.find_objects(lab):
                y0, y1 = sl[0].start, sl[0].stop
                x0, x1 = sl[1].start, sl[1].stop
                if (x1 - x0) >= 16 and (y1 - y0) >= 16:
                    bl.append([int(x0), int(y0), int(x1 - x0), int(y1 - y0)])
            bl.sort(key=lambda b: (b[1] // 20, b[0]))
            boxes[i] = bl
    atlas.save(os.path.join(OUT, "backgrounds.png"), optimize=True)
    json.dump(boxes, open(os.path.join(OUT, "map_slots.json"), "w"))
    print("backgrounds.png", atlas.size, "tiles", len(tiles), "map slot tiles", boxes)


# ---------------------------------------------------------------- font
FONT_ROWS = [
    " 0123456789ABCDE",
    "FGHIJKLMNOPQRSTU",
    "VWXYZabcdefghijk",
    "lmnopqrstuvwxyz,",
    ".':!#*\x01\x02\x03&=\x04\x05\x06\x07\x08",
    "\x09\x0a\x0b\x0c\x0d\x0e\x0f\x10\x11\x12\x13\x14\x15\x16\x17\x18",
    "\x19\x1a\x1b\x1c\x1d\x1e\x1f\x7f\x80\x81\x82\x83\x84\x85\x86\x87",
    "\x88\"\x89-!?\x8a\x8b>\x8c\x8d()~\x8e\x8f",
]


def build_font():
    sheet = load("font references/Game Boy _ GBC - Yu-Gi-Oh! Dark Duel Stories - Miscellaneous - Font.png")
    a = np.array(sheet)
    blk = a[36:36 + 64, 162:162 + 128]
    dark = np.all(blk[:, :, :3] < 80, axis=2)
    font = np.zeros((64, 128, 4), dtype=np.uint8)
    font[dark] = (255, 255, 255, 255)
    Image.fromarray(font).save(os.path.join(OUT, "font.png"))
    # icons strip: LP (16x8), ATK sword (8x8), DEF shield (8x8) at y=26
    strip = a[24:34, 160:224]
    d = np.all(strip[:, :, :3] < 80, axis=2)
    ys, xs = np.where(d)
    print("icon strip dark bounds", ys.min() + 24, ys.max() + 24, xs.min() + 160, xs.max() + 160)
    icons = np.zeros((8, 64, 4), dtype=np.uint8)
    y0 = ys.min() + 24
    sub = a[y0:y0 + 8, 160:224]
    dd = np.all(sub[:, :, :3] < 80, axis=2)
    icons[dd] = (255, 255, 255, 255)
    Image.fromarray(icons).save(os.path.join(OUT, "icons_font.png"))
    charmap = "".join(FONT_ROWS)
    json.dump({"charmap": charmap}, open(os.path.join(OUT, "font.json"), "w"))
    print("font.png ok")


# ---------------------------------------------------------------- title screen
def build_title():
    src = load("misc references/images.png").convert("RGB")
    t = src.resize((160, 144), Image.LANCZOS)
    arr = np.array(t)
    # replace the bottom text area (the source's own New / Continue / copyright) with rock: the clean band above the
    # logo, flipped and shifted so nothing repeats visibly (a tiled 16-row strip used to show as an obvious pattern)
    top = arr[0:24, :, :]                                        # rows 24+ already touch the logo's frame
    arr[96:120, :, :] = top[::-1, ::-1, :]                       # upside down and mirrored
    arr[120:144, :, :] = np.roll(top, 53, axis=1)                # shifted sideways
    Image.fromarray(arr).save(os.path.join(OUT, "title.png"))
    print("title.png ok")


# ---------------------------------------------------------------- small UI bits from the 2x duel screenshot
def build_ui():
    shot = load("misc references/37661692-35d5-427c-84ed-91d1d62eb849.png").resize((160, 144), Image.NEAREST)
    # small card icon (opponent zone) around x=84..97, y=1..15 ; find bbox of non-background
    arr = np.array(shot)
    bgc = arr[70, 120]
    sub = arr[0:18, 80:100]
    m = ~np.all(sub[:, :, :3] == bgc[:3], axis=2)
    ys, xs = np.where(m)
    icon = shot.crop((80 + xs.min(), ys.min(), 80 + xs.max() + 1, ys.max() + 1))
    print("card icon size", icon.size)
    icon.save(os.path.join(OUT, "cardicon.png"))
    shot.save(os.path.join(OUT, "ref_duel.png"))


if __name__ == "__main__":
    build_cards()
    build_portraits()
    build_scenes()
    build_backgrounds()
    build_font()
    build_title()
    print("done")
