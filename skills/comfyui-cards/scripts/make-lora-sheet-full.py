import sys, os
from PIL import Image, ImageDraw
out = sys.argv[1]
pairs = [a.split("=", 1) for a in sys.argv[2:]]
TW, TH = 300, 440
sheet = Image.new("RGB", (TW*len(pairs), TH+26), (250,250,250))
dr = ImageDraw.Draw(sheet)
ok = []
for i,(tag,p) in enumerate(pairs):
    if not os.path.exists(p): print("missing", p); continue
    im = Image.open(p).convert("RGB")
    w,h = im.size
    s = min((TW-8)/w, (TH-8)/h)
    im = im.resize((max(1,int(w*s)), max(1,int(h*s))), Image.LANCZOS)
    sheet.paste(im, (i*TW + (TW-im.size[0])//2, 26 + (TH-im.size[1])//2))
    dr.text((i*TW+6, 8), tag, fill=(0,0,0))
    ok.append(tag)
sheet.save(out)
print("OK", out, sheet.size, ok)