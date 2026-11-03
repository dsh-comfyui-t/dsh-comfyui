"""提示词扩写：中文场景 -> Danbooru 标签，以及本机 llama.cpp 服务的起停。

从 expander.py 拆出（0.5.4）。提示词常量（NL_SYSTEM / SYSTEM）与清洗规则都在这里，
改扩写质量只需要动这一个文件。
"""

import json
import os
import re
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
from sidecar_util import (
    _port_open,
    _dedupe,
    _http_json,
    _is_cjk,
    _nl_unknown_ok,
    _tags,
    pick_model,
)
from sidecar_routes import (
    find_route,
)


NL_SYSTEM = (
    "You convert a Chinese (or mixed) natural-language scene description into Danbooru tags for an anime image model.\n"
    "Rules:\n"
    "1. Output ONLY JSON: {\"positive\": \"tag, tag, ...\", \"negative\": \"...\", \"unknown\": \"...\"}\n"
    "2. Translate every meaningful word into standard Danbooru tags, lowercase, comma separated. Keep user's own English tags as-is.\n"
    "3. Order them: quality, subject/character identity, hair, eyes, clothing, pose/action, expression, camera/framing, background, lighting, style.\n"
    "4. Never invent colours, hairstyles, props or character identities the user did not describe.\n"
    "5. Framing and lighting may only be inferred when the user's words imply them (e.g. 夕阳 -> sunset, backlighting; 侧头看外面 -> looking away, from side).\n"
    "6. Age and body words are forbidden: never output mature female, adult, tall, long legs, young girl, teenager, petite, or any age/body-shape tag.\n"
    "7. If a skirt is described, always use \"black skirt\" regardless of the colour stated.\n"
    "8. Put anything you truly cannot express as a tag into \"unknown\" (Chinese, short).\n"
    "9. Negative: quality/artifact tags only (worst quality, low quality, bad anatomy, bad hands, extra fingers, jpeg artifacts, signature, watermark, text) plus anything the user explicitly dislikes. Never use score_* tags.\n"
    "10. No explanations, JSON only."
)


SYSTEM = (
    "You are a Danbooru-tag engineer for the Anima / Stable-Diffusion anime model.\n"
    "Input: a user's prompt (may be Chinese, mixed, or rough English).\n"
    "Task: rewrite it into a clean, comma-separated Danbooru tag string, and also produce a negative prompt.\n"
    "Rules:\n"
    "1. Output ONLY JSON: {\"positive\": \"...\", \"negative\": \"...\"}\n"
    "2. Expand Chinese words into standard Danbooru tags (e.g. 比耶 -> peace sign, v sign).\n"
    "3. Keep the user's own tags; do not invent characters or change their design.\n"
    "4. Front-load quality tags: masterpiece, best quality, very aesthetic, absurdres.\n"
    "5. For the anime/anima family, add flat-style tags when the user asks for 平涂: "
    "flat color, cel shading, flat shading, solid color blocks, clean crisp lineart, minimal gradient.\n"
    "6. Negative should cover: worst quality, low quality, bad anatomy, bad hands, extra fingers, "
    "jpeg artifacts, signature, watermark, text. Do NOT include score_* tags (they hurt the anima base model).\n"
    "7. No explanations, JSON only.\n"
    "8. Translate Chinese faithfully and literally; never swap attributes "
    "(白发 = white hair, NOT black hair; 黑裙 = black skirt; 侧马尾 = side ponytail).\n"
    "9. Never invent camera, framing, pose or scene tags the user did not write "
    "(no looking at viewer / full body / upper body / cowboy shot / from behind / "
    "from side / from above / standing / sitting / park bench / classroom).\n"
    "10. Copy every tag the user already wrote verbatim into positive, including "
    "character or LoRA trigger words that may contain Chinese characters (e.g. a private trigger token) "
    "— never drop, rename or translate them.\n"
    "11. Never add hair or eye colours the user did not state."
)









_QUALITY = ["masterpiece", "best quality", "very aesthetic", "absurdres"]
_BAD_TAGS = ["worst quality", "low quality", "bad anatomy", "bad hands",
             "extra fingers", "jpeg artifacts", "signature", "watermark", "text"]
# 用户没写就不许出现的镜头/姿态词（LLM 最爱自己加）
_CAMERA_BLOCK = ["looking at viewer", "looking back", "looking to the side",
                 "full body", "upper body", "lower body", "cowboy shot",
                 "close-up", "close up", "portrait", "from behind", "from side",
                 "from above", "from below", "from front", "profile",
                 "standing", "sitting", "kneeling", "lying", "running",
                 "walking", "crouching", "solo focus", "wide shot", "medium shot"]
# 中文关键词兜底字典（只收明确无歧义的，防模型翻反）
_CN_MAP = {
    "白发": ["white hair"], "银发": ["silver hair"], "黑发": ["black hair"],
    "黑裙": ["black skirt"], "白裙": ["white dress"], "白衬衫": ["white shirt"],
    "侧马尾": ["side ponytail"], "双马尾": ["twintails"], "马尾": ["ponytail"],
    "红丝带": ["red ribbon"], "红瞳": ["red eyes"], "蓝瞳": ["blue eyes"],
    "平涂": ["flat color", "cel shading"],
    "手崩": ["bad hands"], "坏手": ["bad hands"], "低质量": ["low quality"],
    "坐姿": ["sitting"], "站姿": ["standing"], "校园": ["school"],
    "校服": ["school uniform"], "笑": ["smile"], "脸红": ["blush"],
}

# 除了镜头/姿态，模型还爱凭空加场景与外貌，用户没写就删
_INVENT_BLOCK = ["school uniform", "classroom", "park", "bench", "outdoors",
                 "indoors", "city", "sky", "tree", "window", "bed", "beach",
                 "blue eyes", "red eyes", "green eyes", "purple eyes", "yellow eyes",
                 "brown hair", "blonde hair", "blue hair", "red hair", "pink hair",
                 "green hair", "silver hair", "white hair", "black hair",
                 "twintails", "long hair", "short hair", "ponytail", "side ponytail",

                   # 自造画风词：本机 4B 最爱往里塞，直接改画风，一律按"自造"删掉
                   "flat color", "cel shading", "flat shading", "solid color blocks",
                   "clean crisp lineart", "minimal gradient", "lineart", "vector art",
                   "watercolor", "oil painting", "sketch", "anime style", "realistic",
                   "photorealistic", "3d render", "cgi", "cartoon", "chibi",
                   "monochrome", "greyscale", "grayscale", "colorful"]

# 英文互斥对：src 只写了 A，就从结果里删掉 B
_EN_DROP = [("white hair", "black hair"), ("black hair", "white hair"),
            ("silver hair", "black hair"), ("black skirt", "white skirt"),
            ("white skirt", "black skirt"), ("white hair", "silver hair")]

# 允许原样保留的中文触发词（角色 / LoRA token），其余中文标签一律不要
# 中文触发词不写死任何名字：只要该片段出现在用户原文里就保留（公开版规则）
_SRC_TXT = {"v": ""}

# 语义互斥：命中左边的词时，删掉右边这些（防模型翻反）
_CN_DROP = {
    "白发": ["black hair"], "银发": ["black hair"], "黑发": ["white hair", "silver hair"],
    "黑裙": ["white skirt"], "白裙": ["black skirt"],
}








def _keep_cjk(t):
    t = (t or "").strip()
    return bool(t) and t in _SRC_TXT.get("v", "")


def _cn_map_tags(text):
    """把中文属性词翻成标签（长词优先，被长词包含的短词跳过）。"""
    out, matched = [], []
    for cn in sorted(_CN_MAP, key=len, reverse=True):
        if cn in (text or "") and not any(cn in m for m in matched):
            matched.append(cn)
            out.extend(_CN_MAP[cn])
    return out, matched


_NL_BANNED = ["mature female", "adult", "tall", "long legs",
              "young girl", "teenager", "petite", "age", "body"]
_NL_POSE = [('坐着', 'sitting', ['standing', 'walking', 'running']),
             ('坐在', 'sitting', ['standing', 'walking', 'running']),
             ('躺着', 'lying', ['standing', 'sitting']), ('躺在', 'lying', ['standing', 'sitting']),
             ('站着', 'standing', ['sitting', 'lying']), ('站在', 'standing', ['sitting', 'lying'])]
_NL_NEG_BASE = ["worst quality", "low quality", "bad anatomy", "bad hands",
                "extra fingers", "jpeg artifacts", "signature", "watermark", "text"]




def tidy_nl(pos_raw, neg_raw, src_text, src_neg):
    """白话转换结果的收尾：去中文/去重/三锁/黑裙/负面基线，正向最多 90 个标签。"""
    pos = []
    for t in _tags(pos_raw):
        v = t.strip().lower().replace('_', ' ')
        if not v or re.search(r'[\u4e00-\u9fff]', v):
            continue
        if any(v == b or v.startswith(b + ' ') for b in _NL_BANNED):
            continue
        if v.startswith('score_'):
            continue
        pos.append(v)
    pos = _dedupe(pos)
    # 姿态纠正：源文说了坐/躺/站，就以源文为准
    for cn, want, conflicts in _NL_POSE:
        if cn in (src_text or ''):
            pos = [t for t in pos if t not in conflicts]
            if want not in pos:
                pos.append(want)
    if any('skirt' in t or 'dress' in t for t in pos) and 'black skirt' not in pos:
        pos.append('black skirt')
    pos = pos[:90]
    neg = _dedupe([t.strip().lower().replace('_', ' ') for t in _tags(neg_raw)
                   if t.strip() and not t.strip().lower().startswith('score_')])
    for b in _NL_NEG_BASE:
        if b not in neg:
            neg.append(b)
    if src_neg:
        for t in _tags(src_neg):
            v = t.strip().lower()
            if v and v not in neg:
                neg.append(v)
    return ', '.join(pos), ', '.join(neg)


def tidy_expand(pos_raw, neg_raw, src_text, src_neg):
    """收紧 LLM 输出：保原标签/触发词、删自造镜头词、纠翻反、合并负向、去生中文。"""
    _SRC_TXT["v"] = src_text or ""
    src = src_text or ""
    src_low = " , ".join(_tags(src)).lower()
    pos = _dedupe(_tags(pos_raw))
    # 1) 用户没写的镜头/姿态词一律删
    pos = [t for t in pos if not (t.lower() in _CAMERA_BLOCK and t.lower() not in src_low)]
    pos = [t for t in pos if not (t.lower() in _INVENT_BLOCK and t.lower() not in src_low)]
    have = set(t.lower().replace("_", " ") for t in pos)
    # 2) 中文属性词翻译补齐
    cn_tags, matched = _cn_map_tags(src)
    for t in cn_tags:
        if t.lower() not in have:
            pos.append(t)
            have.add(t.lower())
    # 3) 纠翻反（白发就不许留 black hair）
    drop = set()
    for cn, bad in _CN_DROP.items():
        if cn in src:
            others = [o for o in _CN_DROP if o != cn and o in src]
            if not others:
                drop |= set(x.lower() for x in bad)
    # 3b) 英文互斥（src 写了 white hair 就不许留 black hair）
    for keep, bad in _EN_DROP:
        if keep in src_low and bad not in src_low:
            drop.add(bad)
    if drop:
        pos = [t for t in pos if t.lower() not in drop]
        have = set(t.lower().replace("_", " ") for t in pos)
    # 4) 用户写过的英文标签原样补回
    for t in _tags(src):
        k = t.lower().replace("_", " ")
        if _is_cjk(t):
            if _keep_cjk(t) and k not in have:
                pos.append(t)
                have.add(k)
            continue
        if k and k not in have:
            pos.append(t)
            have.add(k)
    # 5) 画质词顺序固定前置
    pos = [t for t in pos if t.lower() not in [q.lower() for q in _QUALITY]]
    pos = list(_QUALITY) + pos
    # 6) 中文标签只留触发词
    pos = [t for t in pos if (not _is_cjk(t)) or _keep_cjk(t)]
    pos = _dedupe(pos)
    # 7) 负向：套话 ∪ 模型给 ∪ 用户原有（中文翻成标签，触发词保留）
    neg = _BAD_TAGS + _tags(neg_raw)
    neg_cn, _ = _cn_map_tags(src_neg)
    neg += neg_cn
    for t in _tags(src_neg):
        if _is_cjk(t) and not _keep_cjk(t):
            continue
        neg.append(t)
    neg = [t for t in _dedupe(neg) if (not _is_cjk(t)) or _keep_cjk(t)]
    return ", ".join(pos), ", ".join(neg)


def expand(text, negative, routes, route_id=None, model=None, kind='expand'):
    if route_id:
        picked = find_route(route_id)
        if picked:
            routes = [picked] + [r for r in routes
                                 if (r.get('base', '').rstrip('/'), r.get('model', '')) !=
                                    (picked['base'], picked['model'])];
    last = None
    for rt in routes:
        try:
            md = pick_model(rt, model)
            if not md:
                continue
            if kind == 'nl2prompt':
                user = '中文描述：\n%s' % text
                sys_p = NL_SYSTEM
            else:
                user = 'PROMPT:\n%s\n\nCURRENT NEGATIVE (may be empty):\n%s' % (text, negative or '(empty)')
                sys_p = SYSTEM
            body = {
                'model': md,
                'messages': [{'role': 'system', 'content': sys_p}, {'role': 'user', 'content': user}],
                'max_tokens': 1200,
            }
            if 'reasoner' not in md.lower():   # 推理模型不吃 temperature
                body['temperature'] = 0.3
            d = _http_json(rt['base'] + '/chat/completions', rt['key'], body, timeout=180)
            out = d['choices'][0]['message']['content']
            m = re.search(r'\{.*\}', out, re.S)
            j = json.loads(m.group(0) if m else out)
            if kind == 'nl2prompt':
                pos_ok, neg_ok = tidy_nl(j.get('positive', ''), j.get('negative', ''), text, negative)
                unk = _nl_unknown_ok(j.get('unknown'))
                return {'positive': pos_ok, 'negative': neg_ok, 'unknown': unk,
                        'parts': j.get('parts') if isinstance(j.get('parts'), dict) else {},
                        'ver': 'nl-v1', 'model': '%s / %s' % (rt['name'], md)}
            pos_ok, neg_ok = tidy_expand(j.get('positive', ''), j.get('negative', ''), text, negative)
            return {'positive': pos_ok, 'negative': neg_ok, 'ver': 'v4-tidy',
                    'model': '%s / %s' % (rt['name'], md)}
        except Exception as e:
            last = '%s: %s' % (rt['name'], e)
            continue
    raise RuntimeError('所有 LLM 路线都不通（最后错误 %s）' % last)

# ---------------------------------------------------------------- 本机大模型（D:\LLM）
LOCAL_LLM_DIR = os.environ.get('LOCAL_LLM_DIR') or 'D:\\LLM'
LOCAL_LLM_PORT = int(os.environ.get('LOCAL_LLM_PORT') or 11434)
_LOCAL_LLM_PID = {'pid': 0}


def _local_llm_paths():
    server = os.path.join(LOCAL_LLM_DIR, 'server', 'openai-server.mjs')
    models_dir = os.path.join(LOCAL_LLM_DIR, 'models')
    node = os.environ.get('LOCAL_LLM_NODE') or 'D:\\node\\node.exe'
    return server, models_dir, node


def _local_llm_models():
    server, models_dir, node = _local_llm_paths()
    out = []
    if os.path.isdir(models_dir):
        for fn in sorted(os.listdir(models_dir)):
            if not fn.lower().endswith('.gguf'):
                continue
            mid = os.path.splitext(fn)[0]
            # 文件名去掉量化后缀当模型 id，与本机 start-local-llm.ps1 的命名保持一致
            mid = re.sub(r'[-_.](?:i?q\d[\w]*|fp16|fp32|bf16|f16)$', '', mid, flags=re.I)
            mid = mid.lower()
            ctx = 16384 if '4b' in mid else 8192
            out.append({'id': mid, 'file': os.path.join(models_dir, fn), 'ctx': ctx})
    return out


def local_llm_status():
    server, models_dir, node = _local_llm_paths()
    base = 'http://127.0.0.1:%d/v1' % LOCAL_LLM_PORT
    running = _port_open(base)
    models = []
    if running:
        try:
            d = _http_json(base + '/models', 'local', timeout=3)
            models = [m.get('id') for m in (d.get('data') or []) if m.get('id')]
        except Exception:
            models = []
    return {'ok': True, 'dir': LOCAL_LLM_DIR, 'base': base, 'port': LOCAL_LLM_PORT,
            'running': running, 'server': server, 'serverExists': os.path.isfile(server),
            'nodeExists': os.path.isfile(node), 'models': models,
            'available': [{'id': m['id'], 'ctx': m['ctx']} for m in _local_llm_models()]}


def start_local_llm():
    st = local_llm_status()
    if st['running']:
        st['ok'] = True
        st['already'] = True
        return st
    if not st['serverExists']:
        return {'ok': False, 'error': '没找到本机模型服务：%s' % st['server']}
    if not st['nodeExists']:
        return {'ok': False, 'error': '没找到 node：%s' % _local_llm_paths()[2]}
    ms = _local_llm_models()
    if not ms:
        return {'ok': False, 'error': '没找到 gguf 模型（%s）' % os.path.join(LOCAL_LLM_DIR, 'models')}
    server, models_dir, node = _local_llm_paths()
    env = dict(os.environ)
    env['LLM_RUNTIME_DIR'] = os.path.join(LOCAL_LLM_DIR, 'node_modules')
    env.setdefault('LLM_SEQUENCES', '2')
    env.setdefault('LLM_IDLE_UNLOAD_SECONDS', '300')
    cuda = os.path.join(LOCAL_LLM_DIR, 'cuda')
    if os.path.isdir(cuda):
        env['CUDA_PATH'] = cuda
        env['PATH'] = os.path.join(cuda, 'bin') + ';' + env.get('PATH', '')
    env['PATH'] = 'D:\\node;' + env.get('PATH', '')
    args = [node, server, '--host', '127.0.0.1', '--port', str(LOCAL_LLM_PORT), '--gpu', 'cuda']
    for m in ms:
        args += ['--model', '%s=%s=%d' % (m['id'], m['file'], m['ctx'])]
    logs = os.path.join(LOCAL_LLM_DIR, 'logs')
    try:
        os.makedirs(logs, exist_ok=True)
    except Exception:
        pass
    flags = 0
    for nm in ('CREATE_NEW_PROCESS_GROUP', 'DETACHED_PROCESS', 'CREATE_NO_WINDOW'):
        flags |= getattr(subprocess, nm, 0)
    out = open(os.path.join(logs, 'server.out.log'), 'ab', buffering=0)
    err = open(os.path.join(logs, 'server.err.log'), 'ab', buffering=0)
    try:
        pr = subprocess.Popen(args, cwd=LOCAL_LLM_DIR, env=env, stdout=out, stderr=err,
                              stdin=subprocess.DEVNULL, creationflags=flags, close_fds=True)
    except Exception as e:
        return {'ok': False, 'error': '启动失败：%s' % e}
    _LOCAL_LLM_PID['pid'] = pr.pid
    try:
        with open(os.path.join(LOCAL_LLM_DIR, 'server.pid'), 'w') as f:
            f.write(str(pr.pid))
    except Exception:
        pass
    for _ in range(60):
        time.sleep(0.5)
        if _port_open('http://127.0.0.1:%d/v1' % LOCAL_LLM_PORT):
            break
    st = local_llm_status()
    st['ok'] = True
    st['started'] = True
    st['pid'] = pr.pid
    return st


def stop_local_llm():
    pids = set()
    if _LOCAL_LLM_PID.get('pid'):
        pids.add(int(_LOCAL_LLM_PID['pid']))
    # 端口上真正在听的进程（未必是我们拉起来的）
    try:
        r = subprocess.run(['netstat', '-ano', '-p', 'tcp'], capture_output=True,
                           text=True, timeout=15, errors='ignore')
        for line in (r.stdout or '').splitlines():
            if ':%d' % LOCAL_LLM_PORT in line and 'LISTENING' in line.upper():
                parts = line.split()
                if parts and parts[-1].isdigit():
                    pids.add(int(parts[-1]))
    except Exception:
        pass
    try:
        with open(os.path.join(LOCAL_LLM_DIR, 'server.pid')) as f:
            v = int((f.read() or '0').strip() or 0)
            if v:
                pids.add(v)
    except Exception:
        pass
    killed = []
    for pid in pids:
        try:
            subprocess.run(['taskkill', '/PID', str(pid), '/T', '/F'],
                           capture_output=True, timeout=20)
            killed.append(pid)
        except Exception:
            pass
    for _ in range(24):
        time.sleep(0.25)
        if not _port_open('http://127.0.0.1:%d/v1' % LOCAL_LLM_PORT):
            break
    _LOCAL_LLM_PID['pid'] = 0
    st = local_llm_status()
    st['killed'] = killed
    return st
