import sys, os, glob
from PIL import Image, ImageDraw
args = sys.argv[1:]
out = args[0]
pairs = [a.split("=", 1) for a in args[1:]]
BOX = (45, 110, 465, 670)
TW, TH = 380, 500
base = [p for t, p in pairs if os.path.exists(p)]
sheet = Image.new("RGB", (TW*len(base), TH+26), (255, 255, 255))
dr = ImageDraw.Draw(sheet)
ok = []
for i, (tag, p) in enumerate(pairs):
    if not os.path.exists(p):
        print("missing", p); continue
    im = Image.open(p).convert("RGB").crop(BOX).resize((TW, TH), Image.LANCZOS)
    sheet.paste(im, (i*TW, 26))
    dr.text((i*TW+8, 7), tag, fill=(0, 0, 0))
    ok.append(tag)
sheet.save(out)
print("OK", out, sheet.size, ok)