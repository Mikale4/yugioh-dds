# Lays every cut-out picture on one numbered sheet per folder, so the pieces can be named by eye.
#   python game/tools/cut_labels.py "<cut dir>"
import os, sys
from PIL import Image, ImageDraw, ImageFont

CELL, PAD, LABEL, COLS = 190, 14, 30, 6
root = sys.argv[1] if len(sys.argv) > 1 else "."
try:
    font = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 22)
except Exception:
    font = ImageFont.load_default(size=22)

for i, sheet in enumerate(sorted(d for d in os.listdir(root) if os.path.isdir(os.path.join(root, d)))):
    letter = chr(ord("A") + i)
    files = sorted(f for f in os.listdir(os.path.join(root, sheet)) if f.endswith(".png"))
    rows = (len(files) + COLS - 1) // COLS
    W = COLS * (CELL + PAD) + PAD
    H = rows * (CELL + LABEL + PAD) + PAD + 40
    sheet_im = Image.new("RGB", (W, H), (22, 22, 28))
    d = ImageDraw.Draw(sheet_im)
    d.text((PAD, 10), "%s  -  sheet %s  -  %d pictures" % (sheet, letter, len(files)), font=font, fill=(160, 230, 210))
    for n, f in enumerate(files):
        im = Image.open(os.path.join(root, sheet, f)).convert("RGB")
        scale = min(CELL / im.width, CELL / im.height)
        im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.NEAREST)
        cx = PAD + (n % COLS) * (CELL + PAD)
        cy = 40 + PAD + (n // COLS) * (CELL + LABEL + PAD)
        sheet_im.paste(im, (cx + (CELL - im.width) // 2, cy + (CELL - im.height) // 2))
        tag = "%s-%s" % (letter, os.path.splitext(f)[0])
        tw = d.textlength(tag, font=font)
        d.text((cx + (CELL - tw) / 2, cy + CELL + 4), tag, font=font, fill=(255, 217, 122))
    out = os.path.join(root, "labels-%s.png" % letter)
    sheet_im.save(out)
    print("%s -> %s (%dx%d)" % (sheet, out, W, H))
