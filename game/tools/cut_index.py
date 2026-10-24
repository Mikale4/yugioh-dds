# Builds one contact sheet over every folder cut_card_art.py has produced, so new art can be named in one pass.
# The pictures are embedded in the page, so the file opens anywhere (a plain file:// page cannot load its neighbours).
#   python game/tools/cut_index.py "<cut dir>"
import os, sys, html, base64, io
from PIL import Image

root = sys.argv[1] if len(sys.argv) > 1 else "."
sheets = sorted(d for d in os.listdir(root) if os.path.isdir(os.path.join(root, d)))
letters = {}
out = ["<!doctype html><meta charset='utf-8'><title>New card art</title>",
       "<style>body{background:#16161c;color:#e8e8ef;font:14px/1.5 system-ui;margin:24px}",
       "h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:28px 0 8px;color:#9fd}",
       "p{color:#aaa;margin:0 0 18px}ul{list-style:none;display:flex;flex-wrap:wrap;gap:16px;padding:0}",
       "li{width:170px;text-align:center}img{image-rendering:pixelated;width:170px;background:#000;border:1px solid #444}",
       "b{display:block;margin-top:6px;font-size:15px;color:#ffd97a}span{color:#888;font-size:12px}</style>",
       "<h1>New card art</h1><p>Give me a name for each number, e.g. <code>A-03 = Kuriboh</code>.</p>"]
total = 0
for i, sheet in enumerate(sheets):
    letter = chr(ord("A") + i)
    letters[sheet] = letter
    files = sorted(f for f in os.listdir(os.path.join(root, sheet)) if f.endswith(".png"))
    out.append("<h2>%s &mdash; sheet %s (%d pictures)</h2><ul>" % (html.escape(sheet), letter, len(files)))
    for f in files:
        n = os.path.splitext(f)[0]
        im = Image.open(os.path.join(root, sheet, f)).convert("RGB")     # a thumbnail keeps the page small
        if im.width > 200:
            im = im.resize((200, max(1, round(im.height * 200 / im.width))), Image.NEAREST)
        buf = io.BytesIO(); im.save(buf, "PNG")
        src = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")
        out.append("<li><img src='%s'><b>%s-%s</b><span>%s</span></li>" % (src, letter, n, html.escape(f)))
    out.append("</ul>")
    total += len(files)
out.append("<p>%d pictures in %d sheets.</p>" % (total, len(sheets)))
with open(os.path.join(root, "index.html"), "w", encoding="utf-8") as fh:
    fh.write("".join(out))
print("%d pictures across %s -> %s" % (total, ", ".join("%s=%s" % (letters[s], s) for s in sheets), os.path.join(root, "index.html")))
