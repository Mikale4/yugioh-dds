# Cuts a sheet of cards that are drawn in the game's own style, where the border belongs to the card and must survive
# the cut (use cut_card_art.py instead when only the raw art is wanted).
#
#   python game/tools/cut_framed_sheet.py "<sheet>" "<out dir>" [cols] [rows] [col spans] [row spans]
#
# The spans are optional and win over the automatic measurement, as "0-135,140-265,..." - a sheet whose cards are
# spaced by hand is quicker to measure off the keyline read-out this prints than to guess at.
#
# Each card is a bevel: a light keyline, a dark rim, the picture, then the same again. Those keylines are what the
# sheet is measured by - the light rows and columns that run right across a card give the card edges, which a plain
# even grid does not, because sheets like these are rarely spaced evenly.
import os, sys
import numpy as np
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
COLS = int(sys.argv[3]) if len(sys.argv) > 3 else 5
ROWS = int(sys.argv[4]) if len(sys.argv) > 4 else 3

im = Image.open(src).convert("RGB")
a = np.asarray(im).astype(int)
h, w = a.shape[:2]
s = a.sum(2)
bg = np.array([a[0, 0], a[0, -1], a[-1, 0], a[-1, -1]]).mean(0)   # the colour the sheet is laid out on


def keylines(axis, thresh=0.5):
    """centres of the light lines that run all the way across the sheet"""
    v = (s > 520).mean(axis)
    hits = [i for i, x in enumerate(v) if x > thresh]
    out, run = [], []
    for i in hits:
        if run and i - run[-1] > 2:
            out.append((run[0] + run[-1]) // 2); run = []
        run.append(i)
    if run:
        out.append((run[0] + run[-1]) // 2)
    return out


def spans(centres, size, n, rim=3):
    """Turn the keylines into n card spans. Each card shows two of them (its own edges) and the gap to the next card
    is wider than the gap between a card's own pair, which is what separates them."""
    if len(centres) < 2:
        return [(round(i * size / n), round((i + 1) * size / n)) for i in range(n)]
    pitch = size / n
    starts, i = [], 0
    while i < len(centres) and len(starts) < n:
        starts.append(centres[i])
        j = i + 1
        while j < len(centres) and centres[j] - centres[i] < pitch * 0.6:
            j += 1
        i = j
    while len(starts) < n:                                   # fall back to even spacing for anything not found
        starts.append(round(len(starts) * pitch))
    ends = [min(size, starts[k + 1] - rim) if k + 1 < len(starts) else size for k in range(n)]
    return [(max(0, starts[k] - rim), ends[k]) for k in range(n)]


def strip_background(box):
    x0, y0, x1, y1 = box
    isbg = np.abs(a - bg).sum(2) < 120
    while y1 - y0 > 40 and isbg[y0, x0:x1].mean() > 0.5: y0 += 1
    while y1 - y0 > 40 and isbg[y1 - 1, x0:x1].mean() > 0.5: y1 -= 1
    while x1 - x0 > 40 and isbg[y0:y1, x0].mean() > 0.5: x0 += 1
    while x1 - x0 > 40 and isbg[y0:y1, x1 - 1].mean() > 0.5: x1 -= 1
    return x0, y0, x1, y1


os.makedirs(out, exist_ok=True)
for f in os.listdir(out):
    if f.endswith(".png"):
        os.remove(os.path.join(out, f))
def given(arg):
    return [tuple(int(v) for v in part.split("-")) for part in arg.split(",")] if arg else None


print("light columns:", keylines(0))
print("light rows:   ", keylines(1))
cols = given(sys.argv[5] if len(sys.argv) > 5 else None) or spans(keylines(0), w, COLS)
rows = given(sys.argv[6] if len(sys.argv) > 6 else None) or spans(keylines(1), h, ROWS)
n = 0
for (y0, y1) in rows:
    for (x0, x1) in cols:
        n += 1
        bx = strip_background((x0, y0, x1, y1))
        im.crop(bx).save(os.path.join(out, "%02d.png" % n))
        print("%02d  %3dx%-3d  from %d,%d" % (n, bx[2] - bx[0], bx[3] - bx[1], bx[0], bx[1]))
print("%d cards -> %s" % (n, out))
