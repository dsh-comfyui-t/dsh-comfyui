function SelectMenu({ options, value, onChange, label, theme, minWidth = 140, forceSearch = false, forceOpen = false }) {
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState("");
    const [active, setActive] = React.useState(0);
    const [placement, setPlacement] = React.useState(null);
    const anchor = React.useRef(null);
    const popup = React.useRef(null);
    const search = React.useRef(null);
    const composing = React.useRef(false);
    const items = (options || []).map((o) => typeof o === "object" && o !== null
        ? {value: String(o.value), label: String(o.label)} : {value: String(o), label: String(o)});
    const filtered = query ? items.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase())) : items;
    const chosen = items.find((o) => o.value === String(value));
    const searchable = forceSearch || items.length > 12;
    const selectedLabel = chosen ? chosen.label : items.length ? "请选择…" : "暂无可用选项";
    const close = () => { setOpen(false); setQuery(""); composing.current = false; };
    function position() {
        if (!anchor.current || typeof window === "undefined") return;
        const r = anchor.current.getBoundingClientRect();
        const vw = window.innerWidth || 1024, vh = window.innerHeight || 768;
        const width = Math.max(120, Math.min(Math.max(minWidth, r.width), vw - 24));
        const left = Math.max(12, Math.min(r.left, vw - width - 12));
        const desired = Math.min(320, Math.max(62, items.length * 34 + (searchable ? 52 : 0) + 14));
        const below = Math.max(0, vh - r.bottom - 14), above = Math.max(0, r.top - 14);
        const flip = below < desired && above > below;
        const height = Math.max(48, Math.min(desired, flip ? above : below));
        const top = flip ? Math.max(8, r.top - height - 6) : Math.min(vh - 48, r.bottom + 6);
        setPlacement({ top, left, width, maxHeight: height });
    }
    function choose(item) {
        onChange(item.value);
        close();
        if (anchor.current && anchor.current.focus) anchor.current.focus();
    }
    function openList() {
        if (!items.length) return;
        setQuery("");
        setActive(Math.max(0, items.findIndex((o) => o.value === String(value))));
        position();
        setOpen(true);
    }
    React.useEffect(() => {
        if (forceOpen && !open && items.length) openList();
        else if (!forceOpen && open) close();
    }, [forceOpen]);
    React.useEffect(() => {
        if (!open || typeof document === "undefined") return;
        position();
        const outside = (e) => {
            if ((anchor.current && anchor.current.contains(e.target)) ||
                (popup.current && popup.current.contains(e.target))) return;
            close();
        };
        const keys = (e) => {
            if (composing.current || e.isComposing || e.keyCode === 229) return;
            if (e.key === "Escape") { e.preventDefault(); close(); if (anchor.current) anchor.current.focus(); return; }
            if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
                e.preventDefault();
                setActive((i) => e.key === "Home" ? 0 : e.key === "End" ? Math.max(0, filtered.length - 1)
                    : Math.max(0, Math.min(filtered.length - 1, i + (e.key === "ArrowDown" ? 1 : -1))));
            } else if (e.key === "Enter" || (e.key === " " && e.target !== search.current)) {
                e.preventDefault();
                const item = filtered[Math.min(active, filtered.length - 1)];
                if (item) choose(item);
            }
        };
        const reposition = () => position();
        document.addEventListener("pointerdown", outside, true);
        document.addEventListener("keydown", keys, true);
        window.addEventListener("resize", reposition);
        window.addEventListener("scroll", reposition, true);
        if (searchable && search.current) search.current.focus();
        return () => {
            document.removeEventListener("pointerdown", outside, true);
            document.removeEventListener("keydown", keys, true);
            window.removeEventListener("resize", reposition);
            window.removeEventListener("scroll", reposition, true);
        };
    }, [open, active, query, items.length, value]);
    React.useEffect(() => { if (!open || !popup.current) return;
        const el = popup.current.querySelector('[data-active="true"]');
        if (el && el.scrollIntoView) el.scrollIntoView({block: "nearest"});
    }, [open, active, query]);
    return h(React.Fragment, null,
        h("button", { type: "button", ref: anchor, className: "cc-select-trigger", style: Object.assign({}, S.sel, { minWidth }),
            title: selectedLabel, "aria-label": label, "aria-haspopup": "listbox", "aria-expanded": open,
            disabled: !items.length,
            onClick: () => open ? close() : openList(),
            onKeyDown: (e) => { if (!open && ["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); openList(); } } },
            h("span", {className: "cc-select-label"}, selectedLabel),
            h("span", {className: "cc-select-caret", "aria-hidden": "true"}, "▾")),
        open && placement ? floating(h("div", { ref: popup, className: "dsh-comfy-floating cc-select-popup",
            style: Object.assign({}, popupVars(theme), { position: "fixed", zIndex: forceOpen ? 2147482600 : 2147480500, pointerEvents: forceOpen ? "none" : undefined, ...placement }),
            onMouseDown: (e) => e.stopPropagation() },
            searchable ? h("input", { ref: search, type: "search", className: "cc-select-search", value: query,
                placeholder: "搜索选项…", "aria-label": "搜索" + label,
                onCompositionStart: () => { composing.current = true; },
                onCompositionEnd: () => { composing.current = false; },
                onChange: (e) => { setQuery(e.target.value); setActive(0); },
                onKeyDown: (e) => { if (e.key === " ") e.stopPropagation(); } }) : null,
            h("div", { className: "cc-option-list", role: "listbox", "aria-label": label },
                filtered.length ? filtered.map((o, i) => h("button", { type: "button", role: "option", key: o.value,
                    className: "cc-option", title: o.label, "aria-selected": o.value === String(value),
                    "data-active": i === active ? "true" : "false",
                    onMouseEnter: () => setActive(i), onClick: () => choose(o) }, o.label))
                : h("div", {style: {padding: "12px", fontSize: "12px", color: "var(--cc-muted)"}}, "没有匹配的选项")))) : null);
}

// ==================== 内置 ComfyUI 单色图标 ====================
// 使用 v0.3.1 已有的离线轮廓；不下载任何远程图标，也不依赖网络。
// fill=currentColor 自动跟随 DSH 侧栏主题，亮色/暗色主题都可见。

const COMFY_ICON_PATH =
    "M270 6 H449 C471 6 484 18 480 40 L459 121 C450 156 435 173 398 173 H247 " +
    "C233 173 230 180 225 196 L190 321 C186 335 192 340 206 340 H348 " +
    "C372 340 389 356 382 380 L358 463 C349 494 338 505 304 505 H115 " +
    "C92 505 77 489 83 465 L98 414 C102 401 98 395 85 395 H40 " +
    "C17 395 5 382 11 358 L63 165 C72 131 84 116 119 116 H171 " +
    "C184 116 188 111 193 96 L208 46 C217 18 233 6 270 6 Z";

function OfflineComfyMark({ size }) {
    return h("svg", { width: size, height: size, viewBox: "0 0 512 512", fill: "currentColor",
        focusable: "false", "aria-hidden": "true", style: { display: "block", flexShrink: 0 } },
        h("path", { d: COMFY_ICON_PATH }));
}

let _createPortal = null;
try { _createPortal = require("react-dom").createPortal; } catch (e) { /* 老宿主可不提供 */ }

function floating(node) {
    if (_createPortal && typeof document !== "undefined" && document.body) {
        return _createPortal(node, document.body);
    }
    return node;
}

/**
 * 弹层配色统一（2026-11-10）
 *
 * 所有弹层都经 floating() portal 到 body 下 —— 那里没有 .dsh-comfy-ui 上的
 * --cc-* 变量，所以必须由调用方显式带进来；而调用方手里常常只有「主题设置对象」
 * （mode / bg / fg），它里面一个 --cc-* 都没有，传进去等于没传，CSS 里的
 * background: var(--cc-surface) 就整条失效 —— 表现为二级菜单背景透明。
 *
 * 这里做一次判定：真变量表就用，否则按当前面板的实际底色重新探测。
 */
function popupVars(theme) {
    if (theme && typeof theme === "object") {
        for (const k in theme) {
            if (typeof k === "string" && k.indexOf("--cc-") === 0) return theme;
        }
    }
    if (typeof document === "undefined" || !document.body) return theme || {};
    return hostPalette(document.querySelector(".dsh-comfy-ui") || document.body);
}

/** ComfyUI 启动按钮（2026-10-31）。
 *
 *  原来的「连接 ComfyUI」是一个普通按钮：点下去 setStarting(true)，然后同步等
 *  `/comfy/start` 最多 125 秒，期间只有「处理中…」四个字，看不到卡在哪一步，
 *  也没有任何叫停的办法。
 *
 *  这个组件把那段等待变成可见、可停的：
 *    · 启动中显示转圈；鼠标移上去变成「■ 停止启动」，点一下取消本次启动
 *    · 悬浮或聚焦时在按钮下方展开 console 浮层：阶段文字、PID、耗时、
 *      本次后台的 stdout/stderr（按偏移增量拉，自动跟随到底部）
 *    · 浮层可滚动、可选中复制；鼠标移进浮层不会收起（离开按钮有 160ms 宽限）
 *
 *  进度来源是 sidecar 的 `/comfy/startup?attempt=`，取消走
 *  `/comfy/startup/cancel`。两个端点只对带 attempt 的启动有效，
 *  不影响其它地方同步调用 `/comfy/start` 的老路径。
 */
function ComfyStartupButton({ starting, online, session, stopping, onConnect, onStop, theme }) {
    const [open, setOpen] = React.useState(false);
    const [hover, setHover] = React.useState(false);
    const [data, setData] = React.useState(null);
    const [error, setError] = React.useState("");
    const anchor = React.useRef(null);
    const panel = React.useRef(null);
    const consoleRef = React.useRef(null);
    const follow = React.useRef(true);
    const closeTimer = React.useRef(null);
    const [position, setPosition] = React.useState(null);

    const active = !!(starting && session);

    // 浮层定位：挂在按钮正下方，右侧对齐但不出屏
    const locate = () => {
        const r = anchor.current && anchor.current.getBoundingClientRect();
        if (!r) return;
        const w = Math.min(560, Math.max(240, window.innerWidth - 16));
        setPosition({ top: r.bottom + 6, left: Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)), width: w });
    };
    const show = () => {
        clearTimeout(closeTimer.current);
        if (session) { locate(); setOpen(true); }
    };
    const hide = () => {
        clearTimeout(closeTimer.current);
        closeTimer.current = setTimeout(() => setOpen(false), 160);
    };

    // 换了一次启动就重置浮层里的旧内容
    React.useEffect(() => {
        setData(null); setError(""); follow.current = true;
    }, [session && session.id]);

    // 每秒拉一次进度；启动结束后停掉轮询
    React.useEffect(() => {
        if (!session) return;
        let dead = false, pending = false;
        const tick = async () => {
            if (dead || pending) return;
            pending = true;
            try {
                const r = await jget(EXPANDER + "/comfy/startup?attempt=" + encodeURIComponent(session.id), 6000);
                if (dead) return;
                if (r && r.snapshot) { setData(r.snapshot); setError(""); }
                else if (r && r.message) setError(r.message);
            } catch (e) {
                if (!dead) setError("读取启动进度失败：" + errText(e));
            } finally { pending = false; }
        };
        tick();
        const timer = starting ? setInterval(tick, 1000) : null;
        return () => { dead = true; clearInterval(timer); };
    }, [session && session.id, starting]);

    // 日志跟随到底部（用户手动往上翻就不再抢滚动条）
    React.useEffect(() => {
        if (follow.current && consoleRef.current) {
            consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
        }
    }, [data && data.logs && data.logs.stdout, data && data.logs && data.logs.stderr, open]);

    React.useEffect(() => {
        if (!open) return;
        const dismiss = (e) => { if (e.key === "Escape") { setOpen(false); anchor.current && anchor.current.focus(); } };
        window.addEventListener("keydown", dismiss);
        return () => window.removeEventListener("keydown", dismiss);
    }, [open]);

    React.useEffect(() => () => clearTimeout(closeTimer.current), []);

    const elapsed = (() => {
        if (!data) return 0;
        const base = data.startedAt ? data.startedAt * 1000 : Date.now();
        return Math.max(0, Math.floor((Date.now() - base) / 1000));
    })();

    const logText = [
        data && data.logs && data.logs.stdout ? "[stdout]\n" + data.logs.stdout : "",
        data && data.logs && data.logs.stderr ? "[stderr]\n" + data.logs.stderr : "",
    ].filter(Boolean).join("\n\n");

    const spinner = h("span", { className: "cc-icon-spinner", "aria-hidden": true }, h(PromptIcon, { name: "spinner", size: 15 }));

    const label = stopping ? "正在停止…"
        : active ? (hover ? "停止启动" : "启动中…")
        : starting ? "正在关闭…"
        : online ? "关闭 ComfyUI" : "连接 ComfyUI";
    return h(React.Fragment, null,
        h("button", {
            ref: anchor, type: "button", "data-cc-guide": "connection-action",
            style: Object.assign({}, S.btn2, { display: "inline-flex", alignItems: "center", gap: 7, fontWeight: 700, minWidth: 132 }),
            disabled: stopping || (!active && (starting || online === null)),
            onMouseEnter: () => { setHover(true); show(); },
            onMouseLeave: () => { setHover(false); hide(); },
            onFocus: () => { setHover(true); show(); },
            onBlur: (e) => {
                const to = e.relatedTarget;
                if (!(anchor.current && anchor.current.contains(to)) && !(panel.current && panel.current.contains(to))) hide();
            },
            onClick: active ? onStop : onConnect,
            "aria-label": stopping ? "正在停止启动" : active ? "停止启动" : online ? "关闭 ComfyUI" : "连接 ComfyUI",
            "aria-expanded": !!(open && position && session),
            title: session ? undefined : online
                ? "完全关闭 ComfyUI：终止生成与排队任务、结束进程并释放模型显存"
                : "尝试启动并连接本机 ComfyUI",
        },
            stopping ? spinner
                : active ? (hover ? h(PromptIcon, { name: "stop", size: 15 }) : spinner)
                : starting ? spinner
                : h(OfflineComfyMark, { size: 15 }),
            label),

        (open && position && session) ? floating(h("div", {
            ref: panel, className: "dsh-comfy-floating", role: "region", "aria-label": "ComfyUI 启动进度",
            onMouseEnter: show, onMouseLeave: hide, onFocus: show, onBlur: (e) => {
                const to = e.relatedTarget;
                if (!(anchor.current && anchor.current.contains(to)) && !(panel.current && panel.current.contains(to))) hide();
            },
            style: Object.assign({}, popupVars(theme), {
                position: "fixed", top: position.top, left: position.left, width: position.width,
                zIndex: 2147482000,
                background: "var(--cc-bg, #1b1b1f)", color: "var(--cc-text, #e8e8ea)",
                border: "1px solid var(--cc-border, #34343a)", borderRadius: 10, padding: 12,
                boxShadow: "0 18px 48px rgba(0,0,0,.45)", fontSize: 12, lineHeight: 1.5,
            }),
        },
            h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 } },
                h("strong", null, "ComfyUI · 启动进度"),
                h("span", { style: { color: "var(--cc-muted)", fontVariantNumeric: "tabular-nums" } },
                    "已用 " + elapsed + " 秒")),
            h("div", { role: "status", style: { color: "var(--cc-muted)", marginTop: 6 } },
                stopping ? "正在停止本次启动进程…" : (data && data.phase) || "正在准备启动…",
                data && data.pid ? " · PID " + data.pid : ""),
            error ? h("div", { role: "status", style: { color: "#ff8a80", marginTop: 6 } }, error) : null,
            h("pre", {
                ref: consoleRef, tabIndex: 0, "aria-label": "后台输出",
                onScroll: (e) => {
                    const el = e.currentTarget;
                    follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
                },
                style: {
                    margin: 0, marginTop: 8, padding: 10, minHeight: 100, maxHeight: 260,
                    overflow: "auto", whiteSpace: "pre-wrap", overflowWrap: "anywhere",
                    background: "var(--cc-surface, #141417)", border: "1px solid var(--cc-border, #34343a)",
                    borderRadius: 8, fontSize: 11, lineHeight: 1.45, color: "var(--cc-muted, #d0d0d4)",
                },
            }, logText || "（暂无输出）"),
            h("div", { style: { display: "flex", justifyContent: "space-between", gap: 10, marginTop: 8 } },
                h("span", { style: { color: "var(--cc-muted)" } }, "实时后台输出（stdout / stderr 各保留 32 KiB）"),
                (data && data.ok === true) ? h("span", { style: { color: "#8fd18f" } }, "✔ 已就绪")
                    : (data && data.ok === false) ? h("span", { style: { color: "#ff8a80" } }, "✘ " + (data.message || "失败"))
                    : null))) : null);
}


function CompatibilityCheck({S}) {
    const [report,setReport]=React.useState(null);
    const [busy,setBusy]=React.useState(false);
    const [error,setError]=React.useState("");
    const task=React.useRef({seq:0,ctl:null});
    function stop(){task.current.seq++;task.current.ctl?.abort();task.current.ctl=null;setBusy(false);}
    React.useEffect(()=>()=>{task.current.seq++;task.current.ctl?.abort();},[]);
    async function run(){
        stop();const seq=++task.current.seq,ctl=new AbortController();task.current.ctl=ctl;
        setBusy(true);setError("");setReport(null);
        try {
            const data=await jget(EXPANDER+"/diagnostics/compatibility",6000,ctl.signal);
            if(!Array.isArray(data.items))throw new Error("检查结果格式无效");
            if(task.current.seq===seq)setReport(data);
        }catch(e){if(task.current.seq===seq&&!ctl.signal.aborted)setError(errText(e));}
        finally{if(task.current.seq===seq){task.current.ctl=null;setBusy(false);}}
    }
    return h("details",{className:"cc-details",style:{fontSize:12}},
        h("summary",{className:"cc-summary"},"兼容性检查"),
        h("div",{style:{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",paddingTop:10}},
            h(TaskAction,{busy,label:"检查当前环境",busyLabel:"正在检查当前环境…",onStart:run,onStop:stop}),
            h("span",{style:S.dim},"检查已保存设置；不启动服务、不安装依赖。")),
        error?h("p",{role:"status",style:S.bad},"检查失败："+error):null,
        report?h("div",{"aria-label":"兼容性检查结果",style:{maxHeight:240,overflowY:"auto",overflowWrap:"anywhere",marginTop:8}},
            ...report.items.map(item=>h("div",{key:item.key,style:{padding:"6px 0",borderBottom:"1px solid var(--cc-border)"}},
                h("strong",{style:item.status==="error"?S.bad:{}},item.label+" · "+({ok:"正常",warning:"提示",error:"错误",unverified:"未验证"}[item.status]||item.status)),
                h("div",{style:{...S.dim,marginTop:3}},item.detail)))):null);
}


function OverlayModal({ title, onClose, children, width = 560, theme, className, zIndex = 2147480000, guideTarget }) {
    const dialogRef = React.useRef(null);
    const onCloseRef = React.useRef(onClose);
    onCloseRef.current = onClose;
    React.useEffect(() => {
        if (typeof document === "undefined") return;
        const old = document.activeElement;
        const dialog = dialogRef.current;
        if (dialog && dialog.focus) dialog.focus();
        const onKey = (e) => {
            const active=document.activeElement?.closest('[role="dialog"]');
            if(e.defaultPrevented||(active&&active!==dialog&&!dialog?.contains(active)))return;
            if (e.key === "Escape") { e.preventDefault(); onCloseRef.current(); return; }
            if (e.key !== "Tab" || !dialog) return;
            const selectors = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';
            const focusable = [...dialog.querySelectorAll(selectors)].filter((el) => el.getClientRects().length > 0);
            if (!focusable.length) { e.preventDefault(); dialog.focus(); return; }
            const first = focusable[0], last = focusable[focusable.length - 1];
            if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
                e.preventDefault(); last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault(); first.focus();
            }
        };
        document.addEventListener("keydown", onKey);
        return () => { document.removeEventListener("keydown", onKey);
            if (old && old.focus && old.isConnected) old.focus(); };
    }, []);
    return floating(h("div", { className: "dsh-comfy-floating cc-backdrop",
        style: Object.assign({}, popupVars(theme), { position: "fixed", inset: 0, zIndex,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "14px", boxSizing: "border-box", background: "rgba(0,0,0,.55)" }),
        onMouseDown: (e) => { if (e.target === e.currentTarget) onClose(); },
    },
        h("section", { ref: dialogRef, className, "data-cc-guide": guideTarget || undefined, role: "dialog", "aria-modal": "true", "aria-label": title,
            tabIndex: -1, style: {
                width: "100%", maxWidth: width, maxHeight: "min(760px, calc(100dvh - 28px))",
                minHeight: 0, boxSizing: "border-box", display: "flex", flexDirection: "column",
                overflow: "hidden", borderRadius: "12px", outline: "none",
                background: "var(--cc-surface)", color: "var(--cc-text)",
                border: "1px solid var(--cc-border)", boxShadow: "0 18px 65px rgba(0,0,0,.48)",
            } },
            h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: "12px", flexShrink: 0, padding: "14px 16px",
                borderBottom: "1px solid var(--cc-border)" } },
                h("strong", { style: { fontSize: "15px" } }, title),
                h("button", { type: "button", style: S.btn2, onClick: onClose,
                    "aria-label": "关闭弹窗", title: "关闭 (Esc)" }, "✕")),
            h("div", { style: { display: "flex", flexDirection: "column", gap: "12px",
                padding: "16px", overflowY: "auto", minHeight: 0, overscrollBehavior: "contain" } }, children))));
}

