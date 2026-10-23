# -*- coding: utf-8 -*-
"""画风检查：每一阶段训练/调参之后，量一次有没有跑偏。

为什么需要它
------------
这个项目已经换过六轮方案（容量、分辨率、风格参考、色调、眼睛、光照），
每一轮都是「看着还行」就过了，直到用户自己发现色调偏了、眼睛崩了、暗部被压死了。
那些问题其实全都是**可量**的，只是当时没有一把固定的尺子。

尺子从哪来
----------
**素材自己**。默认参考集里每张图算一套特征，取均值与标准差，
这就是「这个画风长什么样」的定义。一组新出图的某个轴若超出了素材自身的波动（|z| 太大），
就是跑偏——而不是「我觉得还行」。

轴的选择对应这个项目实际踩过的坑：
  chroma    全局色度        —— 抓「整张图偏向某一种颜色」（第四轮踩过）
  bg        背景色度        —— 偏色往往背景先暴露
  share     主色相集中度    —— 越集中越「只有一个色」
  key       明度基调        —— 整体偏亮 / 偏暗
  highkey   高光占比        —— 画面是否越来越「白」
  deep      深色占比        —— 暗部是否越来越多（光照 LoRA v1 的副作用）
  shadowRB  暗部色温 R-B    —— 阴影偏冷还是偏暖（素材是 -13.3，明显偏冷）
  edge      线条锐度        —— 线条越来越硬 / 越来越糊
  struct    结构丰富度      —— 细节量

用法
----
    python style_check.py                          # 用内置的默认分组
    python style_check.py "本轮=glob1;glob2" ...   # 自定义分组（分号分隔多个通配）
"""
import os, sys, glob, math, statistics as st
import warnings
# Pillow 13 起 getdata() 会打一堆 DeprecationWarning 到 stderr，
# 既刷屏又让命令以非零码结束，这里直接静音。
warnings.filterwarnings("ignore", category=DeprecationWarning)
from PIL import Image, ImageFilter

sys.stdout.reconfigure(encoding="utf-8")

DELIV = r"D:\dsh\训练区\素材\捏Ta-二次元画风训练集-2026-10-11"
REF = os.path.join(DELIV, r"dataset\10_nietastyle")   # 与 light_metric 用同一份素材基准

# 各轴的容差下限。标准差为 0 的轴（例如所有素材高度一致的特征）需要兜底，
# 否则任何微小差异都会被算成无穷大的 z。
FLOOR = {
    "chroma": 0.004, "bg": 0.004, "share": 0.03, "key": 0.025,
    "highkey": 0.02, "deep": 0.02, "shadowRB": 2.0, "edge": 0.012, "struct": 0.004,
}
AXES = ["chroma", "bg", "share", "key", "highkey", "deep", "shadowRB", "edge", "struct"]
LABEL = {
    "chroma": "全局色度", "bg": "背景色度", "share": "主色相集中", "key": "明度基调",
    "highkey": "高光占比", "deep": "深色占比", "shadowRB": "暗部色温", "edge": "线条锐度",
    "struct": "结构丰富",
}


def features(path):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    s = 512.0 / min(w, h)
    im = im.resize((max(1, int(w * s)), max(1, int(h * s))), Image.LANCZOS)
    W, H = im.size

    px = list(im.getdata())
    n = len(px)
    R = sum(p[0] for p in px) / n
    G = sum(p[1] for p in px) / n
    B = sum(p[2] for p in px) / n
    t = R + G + B or 1
    chroma = math.sqrt((R / t - 1 / 3.0) ** 2 + (G / t - 1 / 3.0) ** 2 + (B / t - 1 / 3.0) ** 2)

    top = im.crop((0, 0, W, int(H * 0.30)))
    tp = list(top.getdata())
    tn = len(tp)
    tR = sum(p[0] for p in tp) / tn
    tG = sum(p[1] for p in tp) / tn
    tB = sum(p[2] for p in tp) / tn
    tt = tR + tG + tB or 1
    bg = math.sqrt((tR / tt - 1 / 3.0) ** 2 + (tG / tt - 1 / 3.0) ** 2 + (tB / tt - 1 / 3.0) ** 2)

    hp = list(im.convert("HSV").getdata())
    bins = [0] * 24
    tot = 0
    for Hh, S, V in hp:
        if S > 50 and V > 40:
            bins[Hh * 24 // 256] += 1
            tot += 1
    share = (max(bins) / tot) if tot else 0.0

    lum = sorted(0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2] for p in px)
    key = sum(lum) / n / 255.0
    highkey = sum(1 for x in lum if x > 0.80 * 255) / n
    deep = sum(1 for x in lum if x < 0.25 * 255) / n
    k = max(1, int(n * 0.20))
    lo = lum[:k]
    # 暗部色温要用彩色像素算，所以按亮度重取一次
    thr = lum[k - 1]
    dr = db = dc = 0
    for p in px:
        if 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2] <= thr:
            dr += p[0]; db += p[2]; dc += 1
    shadowRB = ((dr - db) / dc) if dc else 0.0

    g = im.convert("L")
    feat = {}
    for kk, tag in ((0.6, "edge"), (1.6, "struct")):
        e = g.filter(ImageFilter.GaussianBlur(kk)).filter(ImageFilter.FIND_EDGES)
        hist = e.histogram()
        tt2 = sum(hist)
        feat[tag] = sum(hist[40:]) / tt2
    return dict(chroma=chroma, bg=bg, share=share, key=key, highkey=highkey,
                deep=deep, shadowRB=shadowRB, **feat)


def group(files):
    rows = []
    for f in files:
        try:
            rows.append(features(f))
        except Exception as e:
            print("  跳过 %s (%s)" % (os.path.basename(f), e))
    return rows


def main():
    ref_files = sorted(glob.glob(os.path.join(REF, "*.jpg")))
    if not ref_files:
        print("找不到参考素材: %s" % REF); return
    ref = group(ref_files)
    mu = {a: st.mean(r[a] for r in ref) for a in AXES}
    sd = {a: max(st.stdev(r[a] for r in ref) if len(ref) > 1 else 0.0, FLOOR[a]) for a in AXES}
    print("参考素材 n=%d  (%s)" % (len(ref), REF))

    if len(sys.argv) > 1:
        specs = sys.argv[1:]
    else:
        specs = [
            "v5成品=%s" % os.path.join(DELIV, "成品-深邃眼睛-768x1344.png"),
            "本轮-不开光照=%s" % os.path.join(DELIV, "成品-光照LoRA-对照不开-768x1344.png"),
            "本轮-开光照=%s" % os.path.join(DELIV, "成品-光照LoRA-768x1344.png"),
        ]

    print()
    for spec in specs:
        name, _, pats = spec.partition("=")
        files = []
        for p in pats.split(";"):
            files += glob.glob(p.strip())
        files = sorted(set(files))
        if not files:
            print("=== %s ===  （没找到文件）\n" % name); continue
        rows = group(files)
        if not rows:
            continue
        worse = []
        print("=== %s  n=%d ===" % (name, len(rows)))
        print("  %-12s %10s %10s %8s   %s" % ("轴", "素材均值", "本轮均值", "偏离 z", "判定"))
        for a in AXES:
            m = st.mean(r[a] for r in rows)
            z = (m - mu[a]) / sd[a]
            az = abs(z)
            verdict = "正常" if az < 1.5 else ("偏移" if az < 3.0 else "严重偏移")
            if az >= 1.5:
                worse.append((az, a))
            print("  %-12s %10.4f %10.4f %+8.2f   %s" % (LABEL[a], mu[a], m, z, verdict))
        rms = math.sqrt(sum(((st.mean(r[a] for r in rows) - mu[a]) / sd[a]) ** 2 for a in AXES) / len(AXES))
        print("  整体偏离 RMS(z) = %.2f   %s" % (
            rms, "画风在素材自身的波动范围内" if rms < 1.5 else "画风已经跑出素材的波动范围"))
        if worse:
            print("  需要关注的轴: " + "、".join("%s(z=%+.1f)" % (LABEL[a], z) for z, a in sorted(worse, reverse=True)))
        print()


if __name__ == "__main__":
    main()
