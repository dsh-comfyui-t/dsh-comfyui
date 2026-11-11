#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""annotate_card.py -- 训练结束后把本次底模写进角色卡 / 风格卡的 baseModels。

为什么需要它：卡里的 baseModels 以前只能手打，而 saveCard 重新组装 rec 时
只认 baseModelsText / baseModels，面板保存一次就可能变空。训练脚本收尾时
直接读 -Ckpt 的文件名写回磁盘，省掉手工一步，也避免手打错文件名。

用法：
    python annotate_card.py --card 霜见 --base anima-aesthetic-v1.1.safetensors
    python annotate_card.py --card 霜见 --base <完整路径> --replace
    python annotate_card.py --card 霜见 --base X.safetensors --dry-run

约定：
  * 写盘一律 UTF-8 无 BOM（AGENTS.md 第 1 条）。
  * 卡文件顶层可以是 {"cards":[...]} 也可以是单张卡对象，两种都接。
  * --card 可以是文件名（含或不含 .json）、卡内 name、卡内 id、或完整路径。
  * 默认追加去重；--replace 才覆盖整个清单。
"""

import argparse
import io
import json
import os
import sys

DEFAULT_ROOT = os.path.join(os.environ.get('DSH_HOME', os.path.expanduser('~')), '本地绘画', '角色卡')
EXTS = (".safetensors", ".ckpt", ".pt", ".pth", ".bin", ".gguf", ".onnx")


def short_model(name):
    """取底模在 ComfyUI 清单里的名字：去目录、**保留扩展名**。

    早期版本在这里把扩展名也去掉了，结果侧车拿卡里的短名去对
    /object_info 的清单（清单里是 `anima-aesthetic-v1.1.safetensors`）永远对不上，
    明明文件就在 diffusion_models 下却报「底模不在本机」。
    """
    s = str(name or "").replace("\\", "/").strip()
    base = s.rsplit("/", 1)[-1]
    low = base.lower()
    if any(low.endswith(ext) for ext in EXTS):
        return base
    # 调用方给的是不带扩展名的短名：补回 .safetensors（本机底模都是这个格式）
    return base + ".safetensors" if base else ""


def read_json(path):
    with io.open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def write_json(path, data):
    """UTF-8 无 BOM。先写临时文件再替换，避免中途失败留下半个文件。"""
    tmp = path + ".tmp-annotate"
    text = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    with io.open(tmp, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(text)
    if os.path.exists(path):
        os.replace(tmp, path)
    else:
        os.rename(tmp, path)


def card_list_of(data):
    """返回 (容器类型, 卡数组)。'pack' 表示 {"cards":[...]}，'single' 表示单卡。"""
    if isinstance(data, dict):
        cards = data.get("cards")
        if isinstance(cards, list):
            return "pack", cards
        return "single", [data]
    if isinstance(data, list):
        return "list", data
    raise SystemExit("卡文件结构无法识别：顶层既不是对象也不是数组")


def match_cards(root, key):
    """返回 [(路径, 卡下标或 None)]，None 表示单卡文件。"""
    key = str(key or "").strip()
    if not key:
        raise SystemExit("--card 不能为空")

    # 1) 直接给了存在的文件
    if os.path.isfile(key):
        kind, cards = card_list_of(read_json(key))
        return [(key, None if kind == "single" else i) for i in range(len(cards))]

    fn = key if key.lower().endswith(".json") else key + ".json"
    direct = os.path.join(root, fn)
    if os.path.isfile(direct):
        kind, cards = card_list_of(read_json(direct))
        return [(direct, None if kind == "single" else i) for i in range(len(cards))]

    # 2) 按卡内 name / id 扫目录
    hits = []
    names = []
    if os.path.isdir(root):
        names = sorted(n for n in os.listdir(root) if n.lower().endswith(".json"))
    for name in names:
        fp = os.path.join(root, name)
        try:
            kind, cards = card_list_of(read_json(fp))
        except SystemExit:
            continue
        except Exception:
            continue
        for i, c in enumerate(cards):
            if not isinstance(c, dict):
                continue
            if str(c.get("name", "")).strip() == key or str(c.get("id", "")).strip() == key:
                hits.append((fp, None if kind == "single" else i))

    if not hits:
        raise SystemExit(
            "找不到卡 %r —— 已查 %s 下的文件名与卡内 name/id，都没有匹配。"
            "现有卡：%s" % (key, root, ", ".join(names) or "（空目录）")
        )
    if len(hits) > 1:
        raise SystemExit(
            "卡名 %r 匹配到 %d 处，请改用文件名指定：%s"
            % (key, len(hits), ", ".join(sorted(set(os.path.basename(h[0]) for h in hits))))
        )
    return hits


def main():
    ap = argparse.ArgumentParser(description="把训练底模写进角色卡 / 风格卡")
    ap.add_argument("--card", required=True, help="卡文件名 / 卡名 / 卡 id / 完整路径")
    ap.add_argument("--base", required=True, help="底模文件名或完整路径")
    ap.add_argument("--root", default=DEFAULT_ROOT, help="卡目录（默认 %s）" % DEFAULT_ROOT)
    ap.add_argument("--replace", action="store_true", help="覆盖已有底模清单（默认追加去重）")
    ap.add_argument("--dry-run", action="store_true", help="只打印将要写入的内容，不动文件")
    args = ap.parse_args()

    base = short_model(args.base)
    if not base:
        raise SystemExit("--base 解析后为空")

    hits = match_cards(args.root, args.card)
    path, idx = hits[0]

    data = read_json(path)
    kind, cards = card_list_of(data)
    target = cards[0] if idx is None else cards[idx]

    old = target.get("baseModels")
    if isinstance(old, str):
        old_list = [x.strip() for x in old.split(",") if x.strip()]
    elif isinstance(old, list):
        old_list = [str(x).strip() for x in old if str(x).strip()]
    else:
        old_list = []

    if args.replace:
        new_list = [base]
    else:
        new_list = list(old_list)
        if base not in new_list:
            new_list.append(base)

    changed = new_list != old_list
    verb = "将写入" if args.dry_run else "已写入"
    print("卡文件   : %s" % path)
    print("卡名     : %s  (id=%s)" % (target.get("name", ""), target.get("id", "")))
    print("底模       : %s" % base)
    print("原清单     : %s" % (", ".join(old_list) if old_list else "（空）"))
    print("%s清单   : %s" % (verb, ", ".join(new_list)))
    if not changed:
        print("结果     : 已存在，未改动")
        return 0
    if args.dry_run:
        print("结果     : 干跑，文件未改动")
        return 0

    target["baseModels"] = new_list
    # 旧字段 baseModelsText 是编辑期草稿，落盘时清掉，避免和数组打架
    target.pop("baseModelsText", None)
    write_json(path, data)
    print("结果     : 写入完成（UTF-8 无 BOM）")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except SystemExit:
        raise
    except Exception as exc:  # noqa: BLE001
        sys.stderr.write("annotate_card 失败：%s\n" % exc)
        sys.exit(1)
