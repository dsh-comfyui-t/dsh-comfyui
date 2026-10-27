function DictCardEditor(props) {
	const d = props.draft || {};
	const patch = props.patch;
	const [capIdx, setCapIdx] = React.useState(-1);
	const [, bump] = React.useState(0);          // 改词性后本弹层自己重画
	const touch = () => { bump((x) => x + 1); if (props.onChanged) props.onChanged(); };
	const tags = Array.from(new Set(String(d.e2 || "").split(/[,，\n]/).map((s) => s.trim()).filter(Boolean)));
	const setTags = (arr) => patch({ e2: arr.join(", ") });
	const pushTag = (cn, en, pol) => {
		const add = String(en || "").split(/[,，\n]/).map((s) => s.trim()).filter(Boolean);
		if (!add.length) return;
		const cur = tags.slice();
		add.forEach((x) => { if (cur.indexOf(x) < 0) cur.push(x); });
		setTags(cur);
		const n = String(cn || "").trim();
		if (n) add.forEach((x) => setCapNote(x, n));
		if (pol === "pos" || pol === "neg") add.forEach((x) => setCapPol(x, pol));
		touch();
	};
	const dropTag = (i) => {
		const cur = tags.slice();
		const t0 = cur[i];
		if (!t0) return;
		cur.splice(i, 1);
		setTags(cur);
		setCapNote(t0, "");
		setCapIdx(-1);
		touch();
	};
	const commitCap = (i, cn, en) => {
		const cur = tags.slice();
		const old = cur[i] || "";
		const t = String(en || "").trim();
		if (t) cur[i] = t;
		setTags(cur);
		if (old && old !== t) setCapNote(old, "");
		if (t) setCapNote(t, String(cn || "").trim());
		setCapIdx(-1);
		touch();
	};
	/** 点胶囊上的词性键：自 → 正 → 负 → 自 */
	const cyclePol = (tk) => {
		const cur = capPolOf(tk);
		setCapPol(tk, cur === "pos" ? "neg" : (cur === "neg" ? "" : "pos"));
		touch();
	};
	/** 胶囊芯片上的词性小标 */
	const polTag = (tk) => {
		const p = capPolOf(tk);
		return h("span", {
			title: (p === "pos" ? "正向：插入时进正向栏" : (p === "neg" ? "负面：插入时进负面栏" : "自动：没标词性，插入时按正向"))
				+ "\u000A点一下：自 → 正 → 负 → 自",
			onClick: (e) => { if (e && e.stopPropagation) e.stopPropagation(); cyclePol(tk); },
			style: { flexShrink: 0, fontSize: "10px", lineHeight: 1.15, padding: "1px 5px", borderRadius: "999px", cursor: "pointer",
				fontWeight: 700,
				background: p === "neg" ? "var(--c-bad-bg)" : (p === "pos" ? "var(--c-accent-bg2)" : "transparent"),
				color: p === "neg" ? "var(--c-bad)" : (p === "pos" ? "var(--c-fg2)" : "var(--c-fg5)"),
				border: "1px solid " + (p === "neg" ? "var(--c-bad)" : (p === "pos" ? "var(--c-accent)" : "var(--c-line)")) },
		}, p === "pos" ? "正" : (p === "neg" ? "负" : "自"));
	};
	return h("div", {
		onClick: props.onClose,
		style: { position: "fixed", inset: 0, zIndex: 2147483000, background: "rgba(0,0,0,.38)", display: "flex", alignItems: "center", justifyContent: "center" },
	},
		h("div", {
			onClick: (e) => e.stopPropagation(),
			onKeyDown: (e) => {
				if (e.key === "Escape") { e.stopPropagation(); props.onClose(); }
				else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); props.onSave(); }
			},
			style: { width: "min(560px, 92vw)", background: "var(--c-panel)", color: "var(--c-fg)", border: "1px solid var(--c-line)",
				borderRadius: "12px", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "8px", boxShadow: "0 18px 48px rgba(0,0,0,.38)" },
		},
			h("div", { style: { fontSize: "13px", fontWeight: 600 } }, d.isNew ? "新建卡片" : ("改词条 · " + d.cat)),
			h("div", { style: { fontSize: "11.5px", color: "var(--c-fg5)" } }, d.isNew
				? "中文＝卡片上显示的字；英文＝真正进提示词的标签。每颗胶囊自己带词性：负 → 插入时进负面，正/自 → 进正向。"
				: "中文＝卡片上显示的字；英文＝真正进提示词的标签。每颗胶囊自己带词性：负 → 插入时进负面，正/自 → 进正向。"),
			d.isNew ? h("div", { style: { display: "flex", gap: "6px", alignItems: "center", fontSize: "12px", color: "var(--c-fg3)" } },
				"分类",
				h("select", {
					value: d.cat,
					onChange: (e) => patch({ cat: e.target.value }),
					style: Object.assign({}, S.sel || S.inp, { flex: "1 1 auto", minWidth: 0 }),
				}, (props.groups.length ? props.groups : [props.group]).filter((x) => !x.all).map((x) => h("option", { key: x.key, value: dictCardTargetCat(x) },
					x.name + "（" + dictCardTargetCat(x) + "）")))) : null,
			h("div", { style: { fontSize: "12px", color: "var(--c-fg3)" } }, "中文"),
			h("input", {
				value: d.c || "", autoFocus: true,
				onChange: (e) => patch({ c: e.target.value }),
				style: Object.assign({}, S.input || S.inp, { width: "100%", boxSizing: "border-box" }),
			}),
			h("div", { style: { display: "flex", alignItems: "baseline", gap: "8px", fontSize: "12px", color: "var(--c-fg3)" } },
				h("span", null, "提示词本体"),
				h("span", { style: { fontSize: "11px", color: "var(--c-fg5)" } }, "每颗胶囊：词性小标（点它 自→正→负）+ 中文备注；点正文改字，× 删掉；底下那行加新胶囊时先选词性")),
			h("div", {
				style: { display: "flex", flexWrap: "wrap", gap: "5px", alignItems: "center", alignContent: "flex-start",
					padding: "6px", borderRadius: "8px", border: "1px solid var(--c-line)", background: "var(--c-panel2)",
					minHeight: "40px", maxHeight: "176px", overflowY: "auto", boxSizing: "border-box" },
			},
				tags.map((tk, i) => (capIdx === i
					? h(CapPairInput, {
						key: "ce" + i, autoFocus: true, accent: true, initCn: capNoteOf(tk), initEn: tk, btn: "确定",
						pol: capPolOf(tk),
						onPol: (v) => { setCapPol(tk, v); touch(); },
						onCommit: (cn, en) => commitCap(i, cn, en), onCancel: () => setCapIdx(-1), onDrop: () => dropTag(i),
					})
					: h("span", {
						key: tk + "-" + i,
						title: (capNoteOf(tk) ? capNoteOf(tk) + "\u000A" : "") + tk + "\u000A点正文：改中文备注 / 英文标签 · 点词性小标：切 自/正/负 · × 删掉这颗",
						style: { display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 6px 2px 4px", borderRadius: "999px",
							border: "1px solid " + (capPolOf(tk) === "neg" ? "var(--c-bad)" : "var(--c-line)"),
							background: "var(--c-card)", fontSize: "11.5px", color: "var(--c-fg2)", maxWidth: "100%", cursor: "pointer" },
					},
						polTag(tk),
						h("span", {
							onClick: () => setCapIdx(i),
							style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
						}, capNoteOf(tk) || tk),
						h("span", {
							title: "删掉这颗",
							onClick: (e) => { if (e && e.stopPropagation) e.stopPropagation(); dropTag(i); },
							style: { cursor: "pointer", color: "var(--c-bad)", fontWeight: 700, padding: "0 1px" },
						}, "×")))),
				h(CapPairInput, {
					grow: true, enHint: tags.length ? "继续加英文…" : "英文标签，回车添加", btn: "加",
					btnTitle: "把这对（中文备注 + 英文标签）按选中的词性加成一颗胶囊",
					onCommit: (cn, en, pol) => pushTag(cn, en, pol),
					onCancel: props.onClose,
					onEmptyBackspace: () => dropTag(tags.length - 1),
					onBlur: (cn, en, pol) => pushTag(cn, en, pol),
				})),
			h("div", { style: { display: "flex", gap: "8px", alignItems: "center", paddingTop: "2px" } },
				h("button", { style: S.btn2, onClick: props.onSave }, d.isNew ? "创建卡片" : "保存"),
				h("button", { style: S.btn2, title: "把这张卡片导出成 .json（含中文备注与词性），别人导入即可用", onClick: props.onExportThis }, "导出这张"),
				d.isNew ? null : h("button", { style: S.btn2, onClick: props.onDelete }, "删除"),
				h("button", { style: S.btn2, onClick: props.onClose }, "取消"),
				h("span", { style: { marginLeft: "auto", fontSize: "11.5px", color: "var(--c-fg5)" } }, "Ctrl+回车保存 · Esc 取消")),
			!d.isNew && (d.en !== d.e2 || d.cn !== d.c)
				? h("div", { style: { fontSize: "11.5px", color: "var(--c-fg4)", borderTop: "1px solid var(--c-line)", paddingTop: "6px" } },
					"原：", d.cn, " → ", d.e2)
				: null));
}

// 词库小卡片的两个组件：一对输入框（中文备注 + 英文标签 + 词性）和整张卡片的编辑弹层。
// 独立成段是为了把 app.js 里 9k 字符的 JSX 挪走；拼接后仍在同一个工厂作用域里。

/** 词性三键：正 / 负 / 自（自＝没标，插入时按正向算） */
function PolKeys(props) {
	const cur = props.pol || "";
	return ["pos", "neg", ""].map((k) => h("button", {
		key: "p" + (k || "auto"),
		type: "button",
		title: k === "pos" ? "永远进正向" : (k === "neg" ? "永远进负面（插入时进负面栏）" : "自动：没标词性，插入时按正向"),
		onClick: (e) => {
			if (e && e.stopPropagation) e.stopPropagation();
			if (props.onPick) props.onPick(k);
		},
		style: {
			fontSize: "10.5px", lineHeight: 1.15, padding: "1px 6px", borderRadius: "999px", cursor: "pointer",
			background: cur === k ? (k === "neg" ? "var(--c-bad-bg)" : (k === "pos" ? "var(--c-accent-bg2)" : "var(--c-panel2)")) : "transparent",
			color: k === "neg" ? "var(--c-bad)" : (k === "pos" ? "var(--c-fg2)" : "var(--c-fg5)"),
			border: "1px solid " + (cur === k ? (k === "neg" ? "var(--c-bad)" : (k === "pos" ? "var(--c-accent)" : "var(--c-line)")) : "var(--c-line)"),
		},
	}, k === "pos" ? "正" : k === "neg" ? "负" : "自"));
}

/** 一对输入：中文备注 + 英文标签 + 词性 + 按钮。草稿自己管，提交交给外面 */
function CapPairInput(props) {
	const [cn, setCn] = React.useState(props.initCn || "");
	const [en, setEn] = React.useState(props.initEn || "");
	const [myPol, setMyPol] = React.useState(props.pol || "");   // 自管词性（新增那行用）
	const curPol = props.onPol ? (props.pol || "") : myPol;      // 外部给了 onPol 就是受控
	const pickPol = (k) => { if (props.onPol) props.onPol(k); else setMyPol(k); };
	const submit = () => {
		const c = String(cn).trim(), e = String(en).trim();
		setCn(""); setEn("");
		props.onCommit(c, e, curPol);
	};
	const inputStyle = { padding: "2px 5px", borderRadius: "999px", fontSize: "11.5px", border: "none", background: "transparent", color: "var(--c-fg)" };
	return h("span", {
		style: { display: "inline-flex", alignItems: "center", gap: "2px", padding: "1px 3px 1px 8px", borderRadius: "999px",
			border: "1px dashed var(--c-line)", background: props.accent ? "var(--c-accent-bg2)" : "transparent",
			flex: props.grow ? "1 1 240px" : "0 0 auto", minWidth: props.grow ? "180px" : "0" },
	},
		h("input", {
			autoFocus: !!props.autoFocus, value: cn, placeholder: "中文备注",
			onChange: (e) => setCn(e.target.value),
			onKeyDown: (e) => {
				if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); submit(); }
				else if (e.key === "Escape") { e.stopPropagation(); props.onCancel(); }
			},
			style: Object.assign({ width: "92px" }, inputStyle),
		}),
		h("span", { style: { width: "1px", height: "14px", background: "var(--c-line)", flexShrink: 0 } }),
		h("input", {
			value: en, placeholder: props.enHint || "英文标签",
			onChange: (e) => setEn(e.target.value),
			onKeyDown: (e) => {
				if (e.key === "Enter" || e.key === "," || e.key === "，") { e.preventDefault(); e.stopPropagation(); submit(); }
				else if (e.key === "Backspace" && !en && props.onEmptyBackspace) { e.preventDefault(); e.stopPropagation(); props.onEmptyBackspace(); }
				else if (e.key === "Escape") { e.stopPropagation(); props.onCancel(); }
			},
			onBlur: () => { const c = String(cn).trim(), e2 = String(en).trim(); if (e2 && props.onBlur) props.onBlur(c, e2, curPol); },
			style: Object.assign({ flex: props.grow ? "1 1 110px" : "0 0 auto", width: props.grow ? null : "136px", minWidth: "88px" }, inputStyle),
		}),
		props.showPol === false ? null : h(PolKeys, { pol: curPol, onPick: pickPol }),
		h("button", {
			style: Object.assign({}, S.btn2, { padding: "1px 9px", fontSize: "11px", borderRadius: "999px" }),
			title: props.btnTitle || "", onClick: submit,
		}, props.btn || "加"),
		props.onDrop ? h("button", {
			style: Object.assign({}, S.btn2, { padding: "1px 8px", fontSize: "11px", borderRadius: "999px", borderColor: "var(--c-bad)", color: "var(--c-bad)" }),
			onClick: () => props.onDrop(),
		}, "删掉") : null);
}

/** 词库小卡片编辑弹层：中文名 + 胶囊提示词（每颗带词性）+ 保存 / 删除 / 导出 */