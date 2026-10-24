# Cuts a sheet of card art into one file per picture, so new art can be named and imported one card at a time.
# An XY cut: split the sheet into bands of rows that hold something, split each band into panels, then trim the
# frame (the coloured border of a card, or the black bevel around a sprite) back to the artwork itself.
#
#   python game/tools/cut_card_art.py "<sheet>" [out_dir] [folder name]
#
# Writes out_dir/<sheet name>/01.png, 02.png ... and an index.html contact sheet with the numbers on it.
import os, sys, html
from PIL import Image
import numpy as np

MIN_PANEL = 40          # a panel is at least this wide and tall
GAP = 6                 # this many empty rows / columns end a panel


def bands(occupied, gap=GAP, minrun=MIN_PANEL):
    out, start, empty = [], None, 0
    for i, on in enumerate(occupied):
        if on:
            if start is None:
                start = i
            empty = 0
        elif start is not None:
            empty += 1
            if empty >= gap:
                if i - empty - start >= minrun:
                    out.append((start, i - empty))
                start, empty = None, 0
    if start is not None and len(occupied) - start >= minrun:
        out.append((start, len(occupied)))
    return out


def background(a):
    # the sheet's background is whatever fills its corners
    corners = np.array([a[0, 0], a[0, -1], a[-1, 0], a[-1, -1]], dtype=int)
    return corners.mean(0)


def panels(a):
    bg = background(a)
    diff = np.abs(a.astype(int) - bg).sum(2)
    ink = diff > 90                                  # a pixel that is not the sheet background
    out = []
    for r0, r1 in bands(ink[:, :].mean(1) > 0.02):
        strip = ink[r0:r1]
        for c0, c1 in bands(strip.mean(0) > 0.02):
            block = ink[r0:r1, c0:c1]                # tighten to the picture itself
            rr = bands(block.mean(1) > 0.02, gap=2, minrun=MIN_PANEL)
            cc = bands(block.mean(0) > 0.02, gap=2, minrun=MIN_PANEL)
            if not rr or not cc:
                continue
            out.append((c0 + cc[0][0], r0 + rr[0][0], c0 + cc[-1][1], r0 + rr[-1][1]))
    return out


def panels_by_gutter(a, dark=150, ratio=0.55, gap=3):
    """Sheets whose pictures touch have no background to cut on, but they are fenced off from each other by dark
    lines (a black bevel, a printed border). A line that is mostly dark right across the sheet is a fence."""
    d = a.sum(2) < dark
    out = []
    for r0, r1 in bands(d.mean(1) < ratio, gap=gap):
        strip = d[r0:r1]
        for c0, c1 in bands(strip.mean(0) < ratio, gap=gap):
            out.append((c0, r0, c1, r1))
    return out


def panels_by_rows(a, counts, dark=150, ratio=0.5, minrun=3):
    """When a sheet has a known layout ("3,3,4" = three pictures, then three, then four), take the widest dark
    lines as the fences: the biggest gaps between rows, then the biggest gaps inside each row. Dark patches inside
    a picture are never as wide as the gutter between two of them, so this beats guessing at a threshold."""
    d = a.sum(2) < dark
    h, w = d.shape

    def runs(v):
        out, s = [], None
        for i, on in enumerate(v):
            if on and s is None:
                s = i
            elif not on and s is not None:
                if i - s >= minrun:
                    out.append((s, i))
                s = None
        if s is not None and len(v) - s >= minrun:
            out.append((s, len(v)))
        return out

    # a gutter is near black; loosen the definition step by step until the expected number of them turns up
    LEVELS = [(60, 0.85), (80, 0.8), (110, 0.75), (150, 0.65), (210, 0.6), (260, 0.5)]

    def cuts(axis, sub, n, lo, hi, apart):
        if n <= 0:
            return []
        picked = []                               # the clearest gutters first, then looser ones to fill the quota
        for dk, rt in LEVELS:
            v = (sub.sum(2) < dk).mean(axis)
            rs = [r for r in runs(v > rt) if r[0] > lo and r[1] < hi]
            rs.sort(key=lambda r: r[1] - r[0], reverse=True)
            for s, e in rs:
                mid = (s + e) // 2
                if all(abs(mid - p) > apart for p in picked):
                    picked.append(mid)
                if len(picked) == n:
                    return sorted(picked)
        return sorted(picked)

    rowcuts = [0] + cuts(1, a, len(counts) - 1, h * 0.08, h * 0.92, h * 0.12) + [h]
    out = []
    for i, n in enumerate(counts):
        r0, r1 = rowcuts[i], rowcuts[i + 1]
        colcuts = [0] + cuts(0, a[r0:r1], n - 1, w * 0.04, w * 0.96, w * 0.12) + [w]
        for j in range(len(colcuts) - 1):
            out.append((colcuts[j], r0, colcuts[j + 1], r1))
    return out


def variety(line):
    """How many different colours a row or column of pixels holds. A border - flat, or two colours dithered - has a
    handful; artwork has dozens. This is what tells the two apart, whatever colour the border happens to be."""
    return len(np.unique(line // 32, axis=0))


ART = 16            # a line with more colours than this is artwork, not border


def art_box(a, cap=0.16):
    """The rectangle the picture itself occupies inside a crop: peel border lines off each edge."""
    h, w = a.shape[:2]
    maxy, maxx = max(2, int(h * cap)), max(2, int(w * cap))
    top, bottom, left, right = 0, h, 0, w
    for _ in range(max(h, w)):
        moved = False
        if top < maxy and bottom - top > MIN_PANEL and variety(a[top, left:right]) <= ART:
            top += 1; moved = True
        if h - bottom < maxy and bottom - top > MIN_PANEL and variety(a[bottom - 1, left:right]) <= ART:
            bottom -= 1; moved = True
        if left < maxx and right - left > MIN_PANEL and variety(a[top:bottom, left]) <= ART:
            left += 1; moved = True
        if w - right < maxx and right - left > MIN_PANEL and variety(a[top:bottom, right - 1]) <= ART:
            right -= 1; moved = True
        if not moved:
            break
    return left, top, right, bottom


def trim_frame(im, cap=0.16):
    x0, y0, x1, y1 = art_box(np.asarray(im.convert("RGB")).astype(int), cap)
    return im.crop((x0, y0, x1, y1))


def framed_cards(a, rows=3, cols=5, margin=12):
    """Sheets of cards drawn in the game's own style: the border belongs to the card, so find each picture and then
    give it its frame back, out to halfway between it and its neighbour."""
    h, w = a.shape[:2]
    art = np.array([[variety(a[y, x:x + 8]) > 3 for x in range(0, w - 8, 4)] for y in range(h)])  # rough art mask
    rowbands = bands(art.mean(1) > 0.25, gap=4, minrun=h // (rows * 3))[:rows]
    out = []
    for r0, r1 in rowbands:
        band = art[r0:r1]
        colbands = bands(band.mean(0) > 0.25, gap=2, minrun=w // (cols * 3))[:cols]
        for c0, c1 in colbands:
            x0, y0, x1, y1 = c0 * 4, r0, c1 * 4 + 8, r1
            # the art box inside this cell, then grown back over its own border
            bx0, by0, bx1, by1 = art_box(a[y0:y1, x0:x1], cap=0.2)
            out.append((max(0, x0 + bx0 - margin), max(0, y0 + by0 - margin),
                        min(w, x0 + bx1 + margin), min(h, y0 + by1 + margin)))
    return out


def main():
    src = sys.argv[1]
    out_root = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(src) or ".", "cut")
    name = sys.argv[3] if len(sys.argv) > 3 else os.path.splitext(os.path.basename(src))[0].strip()
    out_dir = os.path.join(out_root, name)
    os.makedirs(out_dir, exist_ok=True)
    grid = sys.argv[4] if len(sys.argv) > 4 else None         # "5x3" for a regular grid, "3,3,4" for a row layout
    keep = len(sys.argv) > 5 and sys.argv[5] == "keep"        # the border is part of the card (our own card style)
    im = Image.open(src).convert("RGB")
    arr = np.asarray(im).astype(int)
    if keep and grid and "x" in grid:
        cols, rws = (int(x) for x in grid.lower().split("x"))
        boxes = framed_cards(arr, rws, cols)
    elif grid and "," in grid:
        boxes = panels_by_rows(arr, [int(x) for x in grid.split(",")])
    elif grid:
        cols, rws = (int(x) for x in grid.lower().split("x"))
        w, h = im.size
        boxes = [(round(c * w / cols), round(r * h / rws), round((c + 1) * w / cols), round((r + 1) * h / rws))
                 for r in range(rws) for c in range(cols)]
    else:
        boxes = panels(arr)
        if len(boxes) < 2:                   # the pictures touch: fall back to the dark lines between them
            boxes = panels_by_gutter(arr)
    boxes.sort(key=lambda b: (round(b[1] / 40), b[0]))       # reading order, rows then columns
    rows = []
    for i, (x0, y0, x1, y1) in enumerate(boxes, 1):
        piece = im.crop((x0, y0, x1, y1)) if keep else trim_frame(im.crop((x0, y0, x1, y1)))
        f = os.path.join(out_dir, "%02d.png" % i)
        piece.save(f)
        rows.append((i, os.path.basename(f), piece.size, (x0, y0, x1 - x0, y1 - y0)))
        print("%2d  %-8s %4dx%-4d  from %4d,%-4d %3dx%-3d" % (i, os.path.basename(f), piece.size[0], piece.size[1], x0, y0, x1 - x0, y1 - y0))
    with open(os.path.join(out_dir, "index.html"), "w", encoding="utf-8") as fh:
        fh.write("<!doctype html><meta charset='utf-8'><title>%s</title>" % html.escape(name))
        fh.write("<style>body{background:#202028;color:#eee;font:14px system-ui;margin:20px}"
                 "h1{font-size:16px}ul{list-style:none;display:flex;flex-wrap:wrap;gap:14px;padding:0}"
                 "li{text-align:center}img{image-rendering:pixelated;width:150px;border:1px solid #555;background:#000}"
                 "b{display:block;margin-top:4px}</style>")
        fh.write("<h1>%s &mdash; %d pictures</h1><ul>" % (html.escape(name), len(rows)))
        for i, f, size, _ in rows:
            fh.write("<li><img src='%s'><b>%02d</b><span>%dx%d</span></li>" % (f, i, size[0], size[1]))
        fh.write("</ul>")
    print("\n%d pictures -> %s" % (len(rows), out_dir))


if __name__ == "__main__":
    main()
