# -*- coding: utf-8 -*-
"""月度清理：插件自己的历史、备份与过程产物。

设计原则
--------
1. **只删自己产的**。插件目录下的 _archive\\、plugin\\work\\ 日志、以及绘画过程目录
   （训练区\\过程）里的过期文件。交付区、素材区、本地绘画、角色卡、LoRA 权重、
   config.json 一律不碰 —— 那些不是"过程产物"，删了就找不回来。
2. **可预演**。默认 --dry-run 只报告，不删任何东西；--apply 才真删。
3. **一个月一次**。--auto 只在距上次执行 >= 30 天时动作，供侧车启动时自检调用；
   外部计划任务用 --apply 直接跑。
4. **失败不影响主流程**。被占用、权限不足一律跳过并记日志，不抛异常给调用方。

用法
----
    python tools/cleanup.py            # 预演
    python tools/cleanup.py --apply    # 执行
    python tools/cleanup.py --auto     # 到期才执行（侧车启动时调用）
    python tools/cleanup.py --days 60  # 自定义保留天数
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import time

PLUGIN_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # plugin\
PKG_DIR = os.path.dirname(PLUGIN_DIR)                                     # dsh-comfy-cards-next\
ARCHIVE = os.path.join(PKG_DIR, "_archive")
STATE = os.path.join(ARCHIVE, ".last-cleanup.json")
LOG_DIR = os.path.join(ARCHIVE, "logs")

DEFAULT_DAYS = 30
KEEP_BUILDS = 2       # _archive\build 下最多留几份构建备份
KEEP_WORK_LOGS = 2    # plugin\work 下每类日志最多留几个轮转文件

# 过程产物目录：绘画侧的过程图（对照/候选/失败/草稿），不属于交付物
PROCESS_DIRS = [
    r"<工作区>\训练区\过程",
]

# 无论过期多久都不删的东西（命中即跳过）
PROTECT_NAMES = {
    "config.json", "config.example.json", "package.json", "routes.json",
    "cordis.patch.yml", "dictionary_seed.json", "README.md", "CHANGELOG.md",
}
PROTECT_EXT = {".dslcard", ".safetensors", ".ckpt", ".pt", ".pth", ".gguf", ".sft"}


def _log(path, line):
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass


def _protected(p):
    name = os.path.basename(p)
    if name in PROTECT_NAMES:
        return True
    return os.path.splitext(name)[1].lower() in PROTECT_EXT


def _files_older(path, cutoff):
    """列出 path 下 mtime 早于 cutoff 的普通文件（不递归软链）。"""
    out = []
    if not os.path.isdir(path):
        return out
    for root, dirs, files in os.walk(path):
        dirs[:] = [d for d in dirs if not os.path.islink(os.path.join(root, d))]
        for fn in files:
            fp = os.path.join(root, fn)
            if os.path.islink(fp) or _protected(fp):
                continue
            try:
                if os.path.getmtime(fp) < cutoff:
                    out.append(fp)
            except OSError:
                continue
    return out


def _era():
    """归档基准时间：_archive\\.archive-era 里记的 unix 时间戳。

    归档时文件保留原始 mtime（一眼能看出是哪天的备份），但如果按 mtime 算年龄，
    刚搬进来的旧备份下一次清理就会被当场删掉 —— 归档等于没归档。所以归档目录的
    年龄一律从 max(mtime, 基准) 起算，保证搬进来之后至少活满一个周期。
    新增一批归档后跑一次 `--restamp` 把基准推到当下即可。
    """
    try:
        with open(os.path.join(ARCHIVE, ".archive-era"), encoding="utf-8") as f:
            return float(f.read().strip())
    except Exception:
        return 0.0


ERA = _era()


def _archived_older(path, cutoff):
    """归档目录专用：年龄按 max(mtime, 归档基准) 计算。"""
    out = []
    if not os.path.isdir(path):
        return out
    for root, dirs, files in os.walk(path):
        dirs[:] = [d for d in dirs if not os.path.islink(os.path.join(root, d))]
        for fn in files:
            fp = os.path.join(root, fn)
            if os.path.islink(fp) or _protected(fp):
                continue
            try:
                if max(os.path.getmtime(fp), ERA) < cutoff:
                    out.append(fp)
            except OSError:
                continue
    return out


def _prune_empty_dirs(path):
    if not os.path.isdir(path):
        return
    for root, dirs, files in os.walk(path, topdown=False):
        if root == path:
            continue
        try:
            if not os.listdir(root):
                os.rmdir(root)
        except OSError:
            pass


def plan(days):
    """返回 (待删文件列表, 待删目录列表, 说明行)。纯计算，不落任何改动。"""
    cutoff = time.time() - days * 86400
    files, dirs, notes = [], [], []

    # 1) 插件内归档：版本备份、日志按天数（年龄从归档基准起算）
    for sub in ("bak", "logs", "old"):
        d = os.path.join(ARCHIVE, sub)
        got = _archived_older(d, cutoff)
        if got:
            files += got
            notes.append("_archive\\%s：%d 个超过 %d 天的备份/日志" % (sub, len(got), days))

    # 2) 构建备份：按份数留最新的，不按天数
    bdir = os.path.join(ARCHIVE, "build")
    if os.path.isdir(bdir):
        ents = [e for e in os.scandir(bdir) if e.is_dir()]
        ents.sort(key=lambda e: e.stat().st_mtime, reverse=True)
        for e in ents[KEEP_BUILDS:]:
            dirs.append(e.path)
        if len(ents) > KEEP_BUILDS:
            notes.append("_archive\\build：保留最新 %d 份，回收 %d 份" % (KEEP_BUILDS, len(ents) - KEEP_BUILDS))

    # 3) 编译缓存：无条件清（可再生）
    pc = os.path.join(ARCHIVE, "pycache")
    if os.path.isdir(pc):
        for e in os.scandir(pc):
            (dirs if e.is_dir() else files).append(e.path)
        notes.append("_archive\\pycache：编译缓存全部回收")

    # 4) 插件 work 目录日志：轮转文件留最近若干个
    work = os.path.join(PLUGIN_DIR, "work")
    if os.path.isdir(work):
        for stem in ("sidecar.out.log", "sidecar.err.log", "host-plugin.log"):
            cand = []
            for e in os.scandir(work):
                if e.is_file() and e.name.startswith(stem):
                    try:
                        cand.append((e.stat().st_mtime, e.path))
                    except OSError:
                        pass
            cand.sort(reverse=True)
            for _, p in cand[KEEP_WORK_LOGS:]:
                files.append(p)
            if len(cand) > KEEP_WORK_LOGS:
                notes.append("work\\%s：保留最新 %d 份" % (stem, KEEP_WORK_LOGS))

    # 4b) work 目录里的过期杂项（解包缓存、手动启动残留等）。
    #     token 是活的凭据，任何情况下都不动。
    if os.path.isdir(work):
        KEEP = ("sidecar-token.txt",)
        LOGS = ("sidecar.out.log", "sidecar.err.log", "host-plugin.log")
        stale = []
        for e in os.scandir(work):
            if not e.is_file() or e.name in KEEP or e.name.startswith(LOGS):
                continue
            try:
                if e.stat().st_mtime < cutoff:
                    stale.append(e.path)
            except OSError:
                pass
        if stale:
            files += stale
            notes.append("work\\：%d 个超过 %d 天的杂项" % (len(stale), days))

    # 4c) 插件目录内的 __pycache__：纯派生，无条件回收（每跑一次就重新长）
    for root, subdirs, _ in os.walk(PLUGIN_DIR):
        for d in list(subdirs):
            if d == "__pycache__":
                subdirs.remove(d)
                dirs.append(os.path.join(root, d))
        if os.path.basename(root) == "node_modules":
            subdirs[:] = []
    pycache_in_plugin = [d for d in dirs if d.endswith("__pycache__")]
    if pycache_in_plugin:
        notes.append("插件内 __pycache__：%d 处编译缓存回收" % len(pycache_in_plugin))

    # 5) 绘画过程产物：只清过程目录，超期即回收
    for d in PROCESS_DIRS:
        got = _files_older(d, cutoff)
        if got:
            files += got
            notes.append("%s：%d 个超过 %d 天的过程图" % (d, len(got), days))

    # 去重（同一路径可能被多条规则命中）
    files = sorted(set(files))
    dirs = sorted(set(dirs))
    return files, dirs, notes


def _size(paths):
    total = 0
    for p in paths:
        try:
            if os.path.isdir(p):
                for root, _, fs in os.walk(p):
                    for f in fs:
                        try:
                            total += os.path.getsize(os.path.join(root, f))
                        except OSError:
                            pass
            else:
                total += os.path.getsize(p)
        except OSError:
            pass
    return total


def _mb(n):
    return "%.1f MB" % (n / 1048576.0)


def run(apply=False, days=DEFAULT_DAYS, reason="manual"):
    files, dirs, notes = plan(days)
    stamp = time.strftime("%Y-%m-%d %H:%M:%S")
    logf = os.path.join(LOG_DIR, "cleanup-%s.log" % time.strftime("%Y%m%d"))

    total = _size(files) + _size(dirs)
    head = "[%s] %s  days=%d  文件 %d 个 / 目录 %d 个 / 约 %s" % (
        stamp, "执行" if apply else "预演", days, len(files), len(dirs), _mb(total))
    print(head)
    _log(logf, head)
    for n in notes:
        print("  - " + n)
        _log(logf, "  - " + n)

    failed = 0
    if apply:
        for p in files:
            try:
                os.remove(p)
            except OSError as e:
                failed += 1
                _log(logf, "  跳过 %s（%s）" % (p, e))
        for p in dirs:
            try:
                shutil.rmtree(p, ignore_errors=False)
            except OSError as e:
                failed += 1
                _log(logf, "  跳过 %s（%s）" % (p, e))
        _prune_empty_dirs(ARCHIVE)
        for d in PROCESS_DIRS:
            _prune_empty_dirs(d)
        tail = "  完成，跳过 %d 个（被占用或无权限，详见日志）" % failed if failed else "  完成"
        print(tail)
        _log(logf, tail)
        try:
            os.makedirs(ARCHIVE, exist_ok=True)
            with open(STATE, "w", encoding="utf-8") as f:
                json.dump({"lastRun": time.time(), "lastRunText": stamp,
                           "files": len(files), "dirs": len(dirs),
                           "freedBytes": total, "reason": reason}, f, ensure_ascii=False)
        except Exception:
            pass
    return len(files) + len(dirs)


def due(days=DEFAULT_DAYS):
    """距上次执行是否已满一个月。没有记录就算到期。"""
    try:
        with open(STATE, encoding="utf-8") as f:
            last = float(json.load(f).get("lastRun") or 0)
    except Exception:
        return True
    return (time.time() - last) >= days * 86400


def auto(days=DEFAULT_DAYS):
    if not due(days):
        return 0
    return run(apply=True, days=days, reason="auto-monthly")


def restamp():
    """把归档基准推到当下：之后再搬进来的旧备份从这里开始算一个月。"""
    os.makedirs(ARCHIVE, exist_ok=True)
    ts = time.time()
    with open(os.path.join(ARCHIVE, ".archive-era"), "w", encoding="utf-8") as f:
        f.write("%.0f\n" % ts)
    print("归档基准已更新为 %s" % time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(ts)))


def main(argv=None):
    ap = argparse.ArgumentParser(description="dsh-comfy-cards-next 月度清理")
    ap.add_argument("--apply", action="store_true", help="真正删除（默认只预演）")
    ap.add_argument("--auto", action="store_true", help="距上次满一个月才执行")
    ap.add_argument("--restamp", action="store_true", help="新增归档后重置归档基准")
    ap.add_argument("--days", type=int, default=DEFAULT_DAYS, help="保留天数，默认 30")
    a = ap.parse_args(argv)
    if a.restamp:
        restamp()
        return 0
    if a.auto:
        n = auto(a.days)
        if n == 0:
            print("未到清理周期，跳过。")
        return 0
    run(apply=a.apply, days=a.days)
    return 0


if __name__ == "__main__":
    sys.exit(main())
