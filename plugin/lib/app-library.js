function libTab() {
	// 0.7.79：词库「粘贴 JSON」兜底（文件对话框在某些环境不弹，导入就等于没有）
	const [dictPasteOpen2, setDictPasteOpen2] = React.useState(false);
	const [dictPasteText2, setDictPasteText2] = React.useState("");
	// 0.7.67：选中的分类要留住 —— 插入、切页再回来都不能自动跳回默认「全部」
	const [cardCat, _setCardCat] = React.useState(() => {
		const saved = String((USER && USER.dictCat) || "");
		if (!saved) return "pose";
		try {
			const gs = dictGroups();
			if (gs.some((x) => x.key === saved)) return saved;
		} catch (e) { }
		return "pose";
	});
	const setCardCat = (k) => {
		const key = String(k || "");
		if (USER) { USER.dictCat = key; try { saveUser(); } catch (e) { } }
		_setCardCat(key);
	};
	const [cardQ, setCardQ] = React.useState("");
	const [cardSel, setCardSel] = React.useState([]);   // 单选池：卡片不带词性，插入时按胶囊词性分流
	const [, repaint] = React.useReducer((x) => x + 1, 0);   // 词库是外部可变数据，改完手动重画
	const [cardEdit, setCardEdit] = React.useState(null);   // 正在编辑的词条 {cat, cn, en, c, e2}
	const clickTimer = React.useRef(null);
	const dragRef = React.useRef(null);          // 正在拖的卡片 {cat, cn, en}
	const [dragAt, setDragAt] = React.useState("");   // 悬停目标：卡片 key 或 chip:xxx                  // 单击延时，等双击
	const [polFilter, setPolFilter] = React.useState("all");   // 显示范围：all / pos / neg

	const groups = dictGroups();
	const g = groups.find((x) => x.key === cardCat) || groups[0] || { key: "cat:空", name: "（没有分类）", src: [], custom: true };
	const items = dictGroupItems(g);
	const q = cardQ.trim().toLowerCase();
	const byQ = q ? items.filter((it) => (it.cn + " " + it.en).toLowerCase().indexOf(q) >= 0) : items;
	const shown = polFilter === "all" ? byQ : byQ.filter((it) => {
		const has = String(it.en || "").split(",").map((x) => x.trim()).filter(Boolean);
		const neg = has.some((x) => capPolOf(x) === "neg");
		return polFilter === "neg" ? neg : !neg;   // 只负＝含负面胶囊；只正＝一颗负面都没有
	});
	const sel = cardSel;
	const isOn = (it) => cardSel.some((s) => s.cn === it.cn && s.en === it.en);
	const toggle = (it) => {
		setCardSel((st) => {
			if (st.some((s) => s.cn === it.cn && s.en === it.en)) return st.filter((s) => !(s.cn === it.cn && s.en === it.en));
			return st.concat([{ cat: it.cat, cn: it.cn, en: it.en }]);
		});
	};

	/** 选中卡片里的全部英文标签（按出现顺序、大小写不敏感去重） */
	const selTags = () => {
		const out = [];
		cardSel.forEach((s) => String(s.en || "").split(",").map((x) => x.trim()).filter(Boolean).forEach((x) => {
			if (!out.some((y) => y.toLowerCase() === x.toLowerCase())) out.push(x);
		}));
		return out;
	};

	/** 与生成页胶囊视图共用同一份合并实现 */
	const mergeTags = (cur, add) => mergeCsvTags(cur, add);

	/** 插入：按每颗胶囊自己的词性分流 —— 标了「负」的进负面，其余进正向，两栏原有内容都不动 */
	const insertSel = () => {
		const tags = selTags();
		if (!tags.length) { setMsg("还没选卡片：先在卡片上点选"); return; }
		const posT = [], negT = [];
		tags.forEach((x) => (capPolOf(x) === "neg" ? negT : posT).push(x));
		if (typeof setPos !== "function" || typeof setNeg !== "function") { setMsg("这个版本没有写入接口"); return; }
		try {
			if (posT.length) setPos((cur) => mergeTags(cur, posT.join(", ")));
			if (negT.length) setNeg((cur) => mergeTags(cur, negT.join(", ")));
			setMsg("已插入：正向 " + posT.length + " 个" + (negT.length ? "、负面 " + negT.length + " 个" : "（没有标负的胶囊）"));
		} catch (e) { setMsg("插入失败：" + errText(e)); }
	};

	/** 右键词条：改名 / 删除；内置、自建都允许 */

	/** 新卡片的落盘分类：自建组用它自己的名字，内置组写回它的源分类（改过名也不跑偏） */

	/** 创建新卡片：直接开编辑器弹层（分类 / 中文 / 英文 / 极性），保存才落盘 */
	const addCard = () => {
		USER.frags = USER.frags || {};
		setCardEdit({ isNew: true, cat: dictCardTargetCat(g), cn: "", en: "", c: "", e2: "" });
	};

	/** 一组卡片 → 可分发 JSON（带中文备注与极性） */
	const packCards = (items) => {
		const notes = {};
		const tagPol = {};
		const cards = items.map((it) => {
			String(it.en || "").split(",").map((s) => s.trim()).filter(Boolean).forEach((tk) => {
				const n = capNoteOf(tk);
				if (n) notes[tk] = n;
				const pl = capPolOf(tk);
				if (pl) tagPol[tk] = pl;
			});
			return { cat: it.cat, cn: it.cn, en: it.en };
		});
		return { kind: "dsh-dict-cards", v: 1, at: new Date().toISOString(), cards: cards, notes: notes, tagPol: tagPol };
	};
	const exportCards = (items, label) => {
		if (!items || !items.length) { setMsg("没有可导出的卡片"); return; }
		const pack = packCards(items);
		const fn = "词库卡片-" + String(label || "全部").replace(/[\\/:*?"<>|]/g, "-") + "-" + items.length + ".json";
		if (downloadText(JSON.stringify(pack, null, 2), fn)) setMsg("已导出 " + items.length + " 张卡片 → " + fn);
		else setMsg("导出失败：浏览器拦了下载");
	};
	/** 导出范围：勾选过就用勾选，否则当前分类当前筛选结果 */
	const exportPicked = () => {
		const picked = (cardSel.pos || []).concat(cardSel.neg || []);
		exportCards(picked.length ? picked : shown, picked.length ? "选中" : g.name);
	};
	/** 合并一个 dsh-dict-cards 包进词库（中文同名＝覆盖提示词，备注与极性一起带进来） */
	const applyDictPack = (obj) => {
		{
			const cards = Array.isArray(obj) ? obj : (obj && obj.cards);
			if (!Array.isArray(cards) || !cards.length) { setMsg("导入失败：文件里没有卡片"); return; }
			let added = 0, updated = 0, skipped = 0, notes = 0;
			cards.forEach((c) => {
				const cn = String((c && c.cn) || "").trim();
				const en = String((c && c.en) || "").trim();
				const cat = String((c && c.cat) || "").trim() || PR_HOME_CAT;
				if (!cn || !en) { skipped++; return; }
				USER.frags = USER.frags || {};
				const list = (USER.frags[cat] || []).slice();
				const at = list.findIndex((x) => String(x[0]).trim() === cn);
				if (at >= 0) { list[at] = [cn, en]; updated++; } else { list.push([cn, en]); added++; }
				USER.frags[cat] = list;
				// 老文件的卡片极性 → 摊到这张卡的每颗胶囊上；新文件走 tagPol
				if (c.polarity === "pos" || c.polarity === "neg") {
					en.split(",").map((s) => s.trim()).filter(Boolean).forEach((tk) => setCapPol(tk, c.polarity));
				}
			});
			const tp = (obj && obj.tagPol && typeof obj.tagPol === "object") ? obj.tagPol : null;
			if (tp) Object.keys(tp).forEach((k) => setCapPol(k, tp[k]));
			const nk = (obj && obj.notes && typeof obj.notes === "object") ? obj.notes : null;
			if (nk) Object.keys(nk).forEach((k) => {
				const v = String(nk[k] || "").trim();
				if (!v) return;
				USER.capNote = USER.capNote || {};
				USER.capNote[String(k).trim().toLowerCase()] = v;
				notes++;
			});
			// 0.7.80：新分类要同时进 USER.cats，并直接跳到第一个导入的分类 —— 否则面板停在旧分类，看着像「没变化」
			const newCats = [];
			cards.forEach((c) => {
				const cat = String((c && c.cat) || "").trim();
				if (cat && newCats.indexOf(cat) < 0) newCats.push(cat);
			});
			if (newCats.length) {
				USER.cats = Array.from(new Set((USER.cats || []).concat(newCats)));
				try { setCardQ(""); } catch (e) { }
				try { setPolFilter("all"); } catch (e) { }
				try { setCardCat("cat:" + newCats[0]); } catch (e) { }
			}
			saveUser(); repaint();
			try { dictFlush(); } catch (e) { }
			try { clientLog("dictImport", "cards=" + cards.length + " new=" + added + " upd=" + updated + " skip=" + skipped + " notes=" + notes + " cats=" + newCats.join("/")); } catch (e) { }
			setMsg("导入 " + cards.length + " 张：新建 " + added + " · 覆盖 " + updated + " · 跳过 " + skipped + " · 备注 " + notes
				+ (newCats.length ? " · 分类 " + newCats.join(" / ") + "（已跳到「" + newCats[0] + "」）" : ""));
		};
	};
	/** 0.7.79：文件导入与「粘贴 JSON」共用 applyDictPack */
	const importCards = (file) => {
		const rd = new FileReader();
		rd.onload = () => {
			let obj = null;
			try { obj = JSON.parse(String(rd.result || "")); } catch (e) { setMsg("导入失败：不是合法 JSON"); return; }
			applyDictPack(obj);
		};
		rd.onerror = () => setMsg("读取文件失败");
		rd.readAsText(file, "utf-8");
	};
	const dictPasteModal2 = () => h("div", {
		onClick: () => setDictPasteOpen2(false),
		style: { position: "fixed", inset: 0, zIndex: 2147483000, background: "rgba(0,0,0,.38)",
			display: "flex", alignItems: "center", justifyContent: "center" },
	},
		h("div", {
			onClick: (e) => e.stopPropagation(),
			style: { width: "min(680px, 92vw)", background: "var(--c-panel)", color: "var(--c-fg)",
				border: "1px solid var(--c-line)", borderRadius: "12px", padding: "14px 16px",
				display: "flex", flexDirection: "column", gap: "8px", boxShadow: "0 18px 48px rgba(0,0,0,.38)" },
		},
			h("div", { style: { fontSize: "13px", fontWeight: 600 } }, "粘贴词库 JSON"),
			h("div", { style: { fontSize: "11.5px", color: "var(--c-fg5)" } }, "dsh-dict-cards 格式：{ \"cards\": [ { \"cat\", \"cn\", \"en\" } ], \"notes\": {…}, \"tagPol\": {…} }。不依赖文件对话框，任何环境都能用。"),
			h("textarea", {
				value: dictPasteText2, onChange: (e) => setDictPasteText2(e.target.value), spellCheck: false,
				placeholder: '{ "kind": "dsh-dict-cards", "v": 1, "cards": [ { "cat": "姿势·极限", "cn": "撑地张腿坐", "en": "sitting, spread legs" } ] }',
				style: Object.assign({}, S.input || S.inp, { width: "100%", boxSizing: "border-box", height: "240px",
					fontFamily: "ui-monospace,Consolas,monospace", fontSize: "12px" }),
			}),
			h("div", { style: { display: "flex", gap: "8px" } },
				h("button", { style: S.btn, onClick: () => {
					const raw = String(dictPasteText2 || "").trim();
					if (!raw) { setMsg("先粘贴词库 JSON"); return; }
					let obj = null;
					try { obj = JSON.parse(raw); } catch (e) { setMsg("不是合法 JSON：" + String((e && e.message) || e).slice(0, 80)); return; }
					setDictPasteOpen2(false);
					applyDictPack(obj);
				} }, "导入"),
				h("button", { style: S.btn2, onClick: () => setDictPasteOpen2(false) }, "取消"),
				h("span", { style: { marginLeft: "auto", fontSize: "11.5px", color: "var(--c-fg5)" } }, "Ctrl+V 粘贴 · Esc 取消"))));

	const chipOne = (x) => h("span", {
		key: x.key,
		title: x.name + (x.all ? "\u000A固定分类：跨所有分类显示全部词条（不可改名 / 删除）" : "\u000A左键切换 · 右键改名字/删除这个分类"),
		onClick: () => { setCardCat(x.key); },
		onContextMenu: (e) => { e.preventDefault(); groupMenu(x); },
		onDragOver: (e) => {
			if (!dragRef.current) return;
			e.preventDefault();
			try { e.dataTransfer.dropEffect = "move"; } catch (x2) { }
			if (dragAt !== "chip:" + x.key) setDragAt("chip:" + x.key);
		},
		onDragLeave: () => { if (dragAt === "chip:" + x.key) setDragAt(""); },
		onDrop: (e) => { e.preventDefault(); e.stopPropagation(); dropOnChip(x); },
		style: Object.assign({}, S.chip, {
			padding: "4px 10px 4px 12px", fontSize: "12.5px", display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer",
			outline: dragAt === "chip:" + x.key ? "2px dashed var(--c-ok, #16a34a)" : "none",
			background: x.key === cardCat ? "var(--c-accent)" : "var(--c-accent-bg2)",
			color: x.key === cardCat ? "var(--c-accent-on)" : "var(--c-fg2)",
			borderColor: x.key === cardCat ? "var(--c-accent)" : "var(--c-line)",
			borderStyle: "solid",
		}),
	},
		x.name,
		x.all ? null : h("span", {
			title: x.custom ? "删除这个自建分类（连同词条）" : "隐藏这个内置分类（词条还在 dict.js）",
			onClick: (e) => {
				e.stopPropagation();
				if (dictDeleteGroup(x)) { if (cardCat === x.key) setCardCat(""); setMsg(x.custom ? ("已删除分类「" + x.name + "」") : ("已隐藏「" + x.name + "」，可点「恢复分类」找回")); repaint(); }
			},
			style: { opacity: 0.5, fontSize: "12px", lineHeight: 1, padding: "0 2px", borderRadius: "4px" },
		}, "\u00D7"));

	const chipGroup = (x) => chipOne(x);

	/** 拖到分类 chip：换分类（内置卡转成目标分类的自建卡，原分类里隐藏） */
	const dropOnChip = (x) => {
		const d = dragRef.current;
		dragRef.current = null; setDragAt("");
		if (!d) return;
		if (x.all) { setMsg("「全部」是集合视图，不能当目标；拖到具体分类 chip 上"); return; }
		const dst = dictCardTargetCat(x);
		if (!dst || dst === d.cat) { setMsg("已经在这个分类里了"); return; }
		if (dictMoveEntry(d.cat, d.cn, d.en, dst)) { setMsg("「" + d.cn + "」→「" + dst + "」"); repaint(); }
		else setMsg("没搬动：「" + d.cn + "」不在词库里？");
	};

	/** 拖到另一张卡：同分类改顺序（插到它前/后），跨分类先搬再排 */
	const dropOnCard = (target, e) => {
		const d = dragRef.current;
		dragRef.current = null; setDragAt("");
		if (!d || (d.cat === target.cat && d.cn === target.cn)) return;
		const rect = e.currentTarget.getBoundingClientRect();
		const after = (e.clientY - rect.top) > rect.height / 2;
		if (d.cat !== target.cat && !dictMoveEntry(d.cat, d.cn, d.en, target.cat)) {
			setMsg("没搬动：「" + d.cn + "」不在词库里？");
			return;
		}
		const cat = target.cat;
		const names = dictOrdered(dictGroupItems({ src: [cat] })).map((it) => it.cn).filter((n) => n !== d.cn);
		let at = names.indexOf(target.cn);
		if (at < 0) at = after ? names.length : 0;
		else at = after ? at + 1 : at;
		names.splice(at, 0, d.cn);
		USER.order = USER.order || {};
		USER.order[cat] = names;
		saveUser(); repaint();
		setMsg("「" + d.cn + "」顺序已记下（" + cat + " 第 " + (at + 1) + " 位）");
	};

	/** 右键分类：改名（自建）/ 删除 / 恢复隐藏 */
	const groupMenu = (x) => {
		if (x.all) { setMsg("「全部」是固定分类：列出所有分类的词条，不能改名也不能删除"); return; }
		const what = x.custom ? "自建分类" : "内置分类";
		const tip = "「" + x.name + "」是" + what + "。输入新名字＝改名" + (x.custom ? "" : "（只改显示，dict.js 不动）") + "；输入 - ＝删除。";
		const v = String(window.prompt(tip, x.name) || "").trim();
		if (!v || v === x.name) return;
		if (v === "-") {
			if (dictDeleteGroup(x)) { if (cardCat === x.key) setCardCat(""); setMsg("已删除「" + x.name + "」"); repaint(); }
			return;
		}
		const nm = v.replace(/[\\/:*?"<>|]/g, "-").slice(0, 24);
		if (dictGroups().some((o) => o.name === nm)) { setMsg("已有同名分类：" + nm); return; }
		USER.groupRename = USER.groupRename || {};
		USER.groupRename[x.key] = nm;
		saveUser();
		setMsg("「" + x.name + "」→「" + nm + "」");
		repaint();
	};

	const newGroup = () => {
		const nm = dictNewGroup();
		if (!nm) { setMsg(LAST_ERR || "没建分类"); return; }
		setCardCat("cat:" + nm);
		setMsg("已新建分类「" + nm + "」，接着点「＋ 词条」往里加词");
		repaint();
	};

	const restoreGroups = () => {
		if (USER.hideBuiltinDict) { USER.hideBuiltinDict = false; saveUser(); repaint(); setMsg("已恢复内置词库"); return; }
		const n = dictRestoreGroups();
		if (!n) { setMsg("没有隐藏的内置分类"); return; }
		setMsg("已恢复 " + n + " 个内置分类");
		repaint();
	};

	const cell = (it) => {
		const on = isOn(it);
		return h("div", {
			key: it.cat + "\u0000" + it.cn,
			onClick: () => {
				// 等 200ms：双击时把这次单击撤掉，别让卡片先闪一下选中再弹编辑
				if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; return; }
				clickTimer.current = setTimeout(() => { clickTimer.current = null; toggle(it); }, 200);
			},
			onDoubleClick: (e) => {
				e.preventDefault();
				if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; }
				openEdit(it);
			},
			onContextMenu: (e) => { e.preventDefault(); openEdit(it); },
			draggable: true,
			onDragStart: (e) => {
				dragRef.current = { cat: it.cat, cn: it.cn, en: it.en };
				try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", it.cn); } catch (x) { }
			},
			onDragEnd: () => { dragRef.current = null; setDragAt(""); },
			onDragOver: (e) => {
				if (!dragRef.current) return;
				e.preventDefault();
				try { e.dataTransfer.dropEffect = "move"; } catch (x) { }
				const k = it.cat + "\u0000" + it.cn;
				if (dragAt !== k) setDragAt(k);
			},
			onDragLeave: () => { if (dragAt === it.cat + "\u0000" + it.cn) setDragAt(""); },
			onDrop: (e) => { e.preventDefault(); e.stopPropagation(); dropOnCard(it, e); },
			title: it.cn + "\u000A" + it.en + "\u000A单击选中 / 双击改词条 / 右键同双击 / 拖动改顺序、拖到分类改分类（词性在胶囊上标）",
			style: {
				aspectRatio: "1 / 1", borderRadius: "10px", padding: "7px 7px 6px", cursor: "pointer",
				display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "3px",
				background: on ? "var(--c-accent-bg)" : "var(--c-panel2)",
				border: "1.5px solid " + (dragAt === it.cat + "\u0000" + it.cn ? "var(--c-ok, #16a34a)"
					: (on ? "var(--c-accent)" : "var(--c-line)")),
				boxShadow: dragAt === it.cat + "\u0000" + it.cn ? "0 0 0 2px var(--c-ok, #16a34a) inset" : "none",
				overflow: "hidden", userSelect: "none", boxSizing: "border-box",
			},
		},
			h("div", { style: { display: "flex", alignItems: "flex-start", gap: "4px" } },
				h("div", { style: { fontSize: "12.5px", fontWeight: 600, lineHeight: 1.25, flex: 1, wordBreak: "break-all", color: on ? "var(--c-accent-fg)" : "var(--c-fg)" } }, it.cn),
		),
			h("div", { style: { fontSize: "9.5px", lineHeight: 1.15, color: "var(--c-fg5)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", wordBreak: "break-all" } }, it.en));
	};

	/** 选中池（单一列表）：每张卡下面列出它的胶囊，标了负的胶囊用红点 */
	const selRow = () => {
		const tagsOf = (s) => String(s.en || "").split(",").map((x) => x.trim()).filter(Boolean);
		return h("div", { style: { display: "flex", gap: "5px", alignItems: "flex-start", flexWrap: "wrap", minHeight: "26px" } },
			h("span", { style: { fontSize: "12px", padding: "3px 8px", borderRadius: "6px", border: "1px solid var(--c-line)", color: "var(--c-fg4)", whiteSpace: "nowrap" } },
				"选中 " + cardSel.length),
			cardSel.length ? cardSel.map((s, i) => h("span", {
				key: "sel-" + i + "-" + s.en,
				title: s.en + "\u000A点 × 取消选中；插入时按胶囊词性分流",
				style: Object.assign({}, S.chip, { fontSize: "12px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }),
			},
				s.cn,
				h("span", {
					style: { opacity: 0.6, fontSize: "11px" },
				}, "(" + tagsOf(s).filter((x) => capPolOf(x) === "neg").length + "负/" + tagsOf(s).length + ")"),
				h("span", {
					style: { opacity: 0.55 },
					onClick: (e) => { e.stopPropagation(); setCardSel((st) => st.filter((x) => !(x.cn === s.cn && x.en === s.en))); },
				}, "\u00D7")))
				: h("span", { style: { fontSize: "11.5px", color: "var(--c-fg5)", paddingTop: "4px" } }, "点上面的卡片选中；插入时按胶囊词性分流"));
	};

	const openEdit = (it) => {
		setCardEdit({ cat: it.cat, cn: it.cn, en: it.en, c: it.cn, e2: it.en });
	};
	const closeEdit = () => setCardEdit(null);
	const saveEdit = () => {
		if (!cardEdit) return;
		const cn = String(cardEdit.c || "").trim();
		const en = String(cardEdit.e2 || "").trim();
		if (!cn || !en) { setMsg("中文名和英文标签都要填"); return; }
		if (cardEdit.isNew) {
			const cat = String(cardEdit.cat || "").trim();
			if (!cat) { setMsg("先选一个分类"); return; }
			USER.frags = USER.frags || {};
			const list = (USER.frags[cat] || []).slice();
			if (list.some((x) => String(x[0]).trim() === cn)) { setMsg("「" + cn + "」已经在「" + cat + "」里了，换个中文名"); return; }
			list.push([cn, en]);
			USER.frags[cat] = list;
			saveUser();
			repaint();
			// 不关弹层：切成「编辑这张卡」，可以直接继续往里加新胶囊
			setCardEdit({ cat: cat, cn: cn, en: en, c: cn, e2: en });
			setMsg("已新建卡片「" + cn + "」→ " + en + "，放进「" + cat + "」；弹层留着，可以继续加胶囊");
			return;
		}
		if (dictRenameEntry(cardEdit.cat, cardEdit.cn, cn, en)) {
			setMsg("已改「" + cardEdit.cn + "」→「" + cn + "」：" + en);
			closeEdit(); repaint();
		} else setMsg("没找到这条词条");
	};
	const deleteEdit = () => {
		if (!cardEdit) return;
		const builtin = Object.prototype.hasOwnProperty.call(LIB, cardEdit.cat);
		const tip = builtin
			? "隐藏词条「" + cardEdit.cn + "」？\n内置词条只是从界面隐藏，lib/dict.js 不动。"
			: "删除词条「" + cardEdit.cn + "」？\n自建词条删了就找不回来。";
		if (!window.confirm(tip)) return;
		if (dictHideEntry(cardEdit.cat, cardEdit.cn)) { setMsg("已删除「" + cardEdit.cn + "」"); closeEdit(); repaint(); }
		else setMsg("没找到这条词条");
	};


	// 二级视图：提示词段构建（顶部按钮切回分类词库）
	if (segOn) return segBuilder();

	return h("div", { style: { display: "flex", flexDirection: "column", gap: "10px" } },
		h("div", { style: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", padding: "6px 10px", borderRadius: "8px", border: "1px solid var(--c-line)", background: "var(--c-panel2)" } },
			h("span", { style: { fontSize: "12px", color: "var(--c-fg4)" } }, "词库模式："),
			h("button", { style: S.btn, onClick: () => setSegOn(true), title: "六个槽位各选一段，自动拼成完整提示词" }, "提示词段构建 →"),
			h("span", { style: { fontSize: "11.5px", color: "var(--c-fg5)" } }, "风格 · 人物 · 衣服 · 动作 · 场景 · 取景，选完即完整提示词")),
		h("div", { style: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" } },
			h("input", { value: cardQ, placeholder: "搜词条 / 英文标签", onChange: (e) => setCardQ(e.target.value), style: Object.assign({}, S.input || S.inp, { width: "220px" }) }),
			["all", "pos", "neg"].map((k) => h("span", {
				key: k, onClick: () => setPolFilter(k),
				title: k === "all" ? "全部卡片" : (k === "pos" ? "只看不含负面胶囊的卡" : "只看含负面胶囊的卡"),
				style: Object.assign({}, S.chip, { fontSize: "12px", cursor: "pointer", padding: "4px 10px",
					background: polFilter === k ? "var(--c-accent)" : "transparent",
					color: polFilter === k ? "var(--c-accent-on)" : "var(--c-fg4)",
					borderColor: polFilter === k ? "var(--c-accent)" : "var(--c-line)" }),
			}, k === "all" ? "全部" : k === "pos" ? "纯正向" : "含负面")),
			h("button", { style: S.btn2, onClick: addCard, title: "在这个分类里新建一张卡片（中文名 + 提示词本体）" }, "＋ 新卡片"),
			h("button", { style: S.btn2, onClick: exportPicked, title: "把勾选过的卡片（没勾就导出当前分类）导出成 .json，可发给别人导入" }, "导出"),
			h("button", { style: S.btn2, onClick: () => revealCardFile("dict", ""), title: "打开词库 JSON 的落盘目录（本地绘画\词库）" }, "打开文件位置"),
			h("button", { style: S.btn2, onClick: () => syncKindFromDisk("dict", { force: true }), title: "重新读 本地绘画\词库：目录里删掉的文件，面板上对应的词条也消失" }, "同步目录"),
			h("button", { style: S.btn2, onClick: () => dirClear("dict", "词库"), title: "把 词库 目录整包搬到 _清空备份，并清空面板（可逆）" }, "清空"),
			h("button", { style: S.btn2, onClick: () => {
				if (!window.confirm("清空词库：\n· 自建词条全清\n· 内置词库（代码里那几千条）也一起隐藏\n\n磁盘文件搬去 _清空备份，内置词库可用「恢复分类」找回。继续？")) return;
				USER.frags = {}; USER.dictFiles = {}; USER.hideBuiltinDict = true; USER.groupHide = [];
				saveUser(); repaint();
				fetch(EXPANDER + "/dir/clear", { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, CONSOLE_HEADERS), body: JSON.stringify({ kind: "dict" }) })
					.then((r) => r.json())
					.then((d) => setMsg(d && d.ok ? ("词库已清空（含内置）：搬走 " + String(d.count || 0) + " 个文件 → " + String(d.backup || "")) : ("清空失败：" + String((d && d.error) || "侧车没响应"))))
					.catch((e) => setMsg("清空失败：" + String((e && e.message) || e)));
			}, title: "自建词条清空，并且把内置词库整体隐藏（可恢复）" }, "清空含内置"),
			USER.hideBuiltinDict ? h("button", { style: S.btn2, onClick: () => {
				USER.hideBuiltinDict = false; saveUser(); repaint(); setMsg("已恢复内置词库");
			}, title: "把内置词库放回面板（之前点过「清空含内置」）" }, "恢复内置") : null,
			h("label", { style: Object.assign({}, S.btn2, { position: "relative", overflow: "hidden", display: "inline-flex", alignItems: "center", cursor: "pointer" }), title: "从导出的 .json 导入小卡片（中文同名＝覆盖提示词；备注与词性一起带进来）" }, "导入",
				h("input", { type: "file", accept: ".json,application/json",
					style: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", fontSize: "100px" },
					onChange: (e) => { const f = e.target.files && e.target.files[0]; try { e.target.value = ""; } catch (x) { } if (f) importCards(f); else setMsg("没拿到文件：这个环境没弹文件对话框，改用右边「粘贴 JSON」"); } })),
			h("button", { style: S.btn2, onClick: () => { setDictPasteText2(""); setDictPasteOpen2(true); }, title: "不依赖文件对话框：把词库包 JSON 粘进来" }, "粘贴 JSON"),
			dictPasteOpen2 ? dictPasteModal2() : null,
			h("span", { style: { marginLeft: "auto", fontSize: "11.5px", color: "var(--c-fg4)" } }, g.name + " " + shown.length + " 条")),
		// 内置词库被隐藏时不提示的话，用户只会觉得"词条/新卡片怎么没了"。
		// 「清空含内置」和右键隐藏分类都会写进 localStorage，刷新也不会自己回来。
		(() => {
			const hiddenCats = dictHiddenCats().filter((k) => k.indexOf("cat:") !== 0);
			const libOff = !!(USER && USER.hideBuiltinDict);
			if (!libOff && !hiddenCats.length) return null;
			const names = groups.filter((x) => hiddenCats.indexOf(x.key) >= 0).map((x) => x.name);
			const extra = hiddenCats.length - names.length;
			return h("div", {
				style: {
					display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap",
					padding: "6px 10px", marginBottom: "2px", fontSize: "12.5px", lineHeight: "1.5",
					border: "1px solid rgba(220,160,60,.5)", background: "rgba(220,160,60,.10)",
					borderRadius: "6px", color: "var(--c-fg2)",
				},
			},
				h("span", null, libOff
					? "内置词库整体被隐藏了（点过「清空含内置」）—— 所以新加的分类和词条都看不到"
					: ("有 " + hiddenCats.length + " 个内置分类被隐藏" + (names.length ? "：" + names.join("、") + (extra > 0 ? " 等" : "") : ""))),
				h("button", {
					style: Object.assign({}, S.btn2, { marginLeft: "auto" }),
					onClick: () => {
						USER.hideBuiltinDict = false;
						USER.groupHide = (USER.groupHide || []).filter((k) => k.indexOf("cat:") === 0);
						saveUser(); repaint();
						setMsg("已恢复内置词库与全部分类");
					},
				}, "全部恢复"));
		})(),
		h("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" } },
			groups.map(chipGroup),
			h("span", {
				onClick: newGroup, title: "新建一个大分类",
				style: Object.assign({}, S.chip, {
					padding: "4px 12px", fontSize: "12.5px", cursor: "pointer", borderStyle: "dashed",
					background: "transparent", color: "var(--c-fg4)", borderColor: "var(--c-line)",
				}),
			}, "＋ 分类"),
			dictHiddenCats().filter((k) => k.indexOf("cat:") !== 0).length
				? h("span", {
					onClick: restoreGroups, title: "把隐藏掉的内置分类找回来",
					style: Object.assign({}, S.chip, { padding: "4px 10px", fontSize: "12px", cursor: "pointer", background: "transparent", color: "var(--c-fg4)" }),
				}, "恢复分类 " + dictHiddenCats().filter((k) => k.indexOf("cat:") !== 0).length)
				: null),
		h("div", Object.assign({ style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: "8px", maxHeight: "46vh", overflowY: "auto", padding: "2px" } },
			// 拖词库 JSON 进网格 = 导入（和「导入」按钮同一条通道）
			dropFileProps(["json"], (good) => good.forEach((f) => importCards(f)),
				{ onReject: () => setMsg("拖错了：词库只收 .json（导出时也是这个格式）"),
				  onEmpty: () => setMsg("拖拽没拿到文件（桌面版常见）：点「导入」按钮选") })),
			shown.length ? shown.map(cell) : h("div", { style: { gridColumn: "1 / -1", fontSize: "12px", color: "var(--c-fg5)", padding: "12px" } }, q ? "没有匹配「" + cardQ + "」的词条" : "这个分类还没有卡片，点「＋ 新卡片」建一张")),
		h("div", { style: { borderTop: "1px solid var(--c-line)", paddingTop: "8px", display: "flex", flexDirection: "column", gap: "6px" } },
			selRow(),
			h("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap", paddingTop: "2px" } },
				h("button", { style: Object.assign({}, S.btn2, { fontWeight: 600 }), onClick: insertSel, title: "标了「负」的胶囊进负面，其余进正向；两栏原有内容都不动" }, "插入提示词（按胶囊词性）"),
				h("button", { style: S.btn2, onClick: () => { setTab("gen"); setZoneMode("prompt"); setMsg("已切到生成页；提示词区若要胶囊视图，点一下「切换 ▸」"); } }, "去生成页看"),
				h("button", { style: S.btn2, onClick: () => { setCardSel([]); setMsg("已清空选中"); } }, "清空选中"))),
		cardEdit ? h(DictCardEditor, {
			draft: cardEdit,
			groups: groups, group: g,
			patch: (kv) => setCardEdit(Object.assign({}, cardEdit, kv)),
			onChanged: repaint,          // 弹层里改胶囊词性后，卡片区跟着重画
			onClose: closeEdit,
			onSave: saveEdit,
			onDelete: deleteEdit,
			onExportThis: () => {
				const cn0 = String(cardEdit.c || "").trim();
				const en0 = String(cardEdit.e2 || "").trim();
				if (!cn0 || !en0) { setMsg("中文名和提示词本体都要有才能导出"); return; }
				exportCards([{ cat: cardEdit.cat, cn: cn0, en: en0 }], cn0);
			},
		}) : null);
}


	/** 角色卡：一张卡 = 一个角色的整套标签，点一下整组加入提示词 */
				/** 角色卡标签的模块归类（按关键词，英文标签小写匹配） */
		const CARD_GROUPS = [
			["hair", "发型", ["hair", "bangs", "ponytail", "twintails", "braid", "bun", "fringe", "ahoge", "hairband", "hairclip", "ornament"]],
			["eyes", "眼睛", ["eyes", "pupil", "eyelash", "eyebrow"]],
					["glasses", "眼镜 · 配饰", ["glasses", "eyewear", "spectacles", "earring", "necklace", "choker", "ribbon", "bow"]],
			["outfit", "服饰", ["shirt", "skirt", "dress", "coat", "jacket", "uniform", "necktie", "tie", "stocking", "sock", "shoe", "boot", "glove", "scarf", "sweater", "hoodie", "vest", "pants", "trouser", "belt", "hat", "cap", "apron", "kimono", "cape", "cloak"]],
			["base", "基础", ["1girl", "1boy", "solo", "group"]],
		];
		const CARD_ORDER = ["trigger", "base", "hair", "eyes", "glasses", "outfit", "proportion", "extra"];   /* 0.7.130：角色卡也吃 proportion（此前只有风格卡有，角色卡里填了会被 joinCardParts 丢掉） */

		/** 风格卡的模块划分：画风 / 线条 / 上色 / 光影 */
		const STYLE_GROUPS = [
		  ["proportion", "比例", ["chibi", "super deformed", "big head", "small body", "proportion", "head-to-body", "tall", "mature", "petite", "loli"]],
		  ["style", "画风", ["illustration", "anime", "art style", " style", "painterly", "realistic", "sketch", "watercolor", "cel", "brush", "stroke", "texture"]],
		  ["line", "线条", ["lineart", "line weight", "outline", "ink", "pencil", "line"]],
		  ["color", "上色", ["color", "coloring", "palette", "tone", "shading", "gradient", "flat"]],
		  ["light", "光影", ["light", "lighting", "shadow", "glow", "highlight", "rim", "cinematic"]],
		];
		const STYLE_ORDER = ["trigger", "proportion", "style", "line", "color", "light", "extra"];
		/** 风格标签的中文备注（点胶囊时显示） */
		const STYLE_ZH = {
		  "@mochizuki_kei": "画师触发", "mochizuki_kei style": "望月けい画风", "2d anime illustration": "2D 动漫插画",
		  "prominent clean lineart": "干净线稿", "expressive variable line weight": "线条粗细变化", "(lineart:1.4)": "加重线稿",
		  "flat style": "平涂", "flat color": "平涂上色", "cel shading": "赛璐璐阴影", "crisp clean outline": "干净轮廓",
		  "painterly illustration": "厚涂插画", "thick brush strokes": "厚笔触", "rich texture": "质感丰富",
		  "soft rim light": "柔和轮廓光", "cinematic lighting": "电影感打光", "subtle glow": "微光",
		  "detailed background": "精细背景", "extreme aesthetic": "极高美感", "masterpiece": "杰作",
		  "best quality": "最佳质量", "amazing quality": "惊异质量", "very aesthetic": "很美",
		  "absurdres": "超高分辨率", "HDR": "HDR", "newest": "最新",
		};
		/** 比例预设：卡的 proportion 只存 preset 名，插入时展开成词（2026-10-29） */
		const PROPORTION_PRESETS = [
		  ["chibi", "Q版 3头身", ["chibi", "super deformed"]],
		  ["half", "半身 5-6头身", ["portrait", "upper body"]],
		  ["adult", "成年 7-8头身", ["tall", "mature proportions"]],
		  ["none", "不锁比例", []],
		  ["custom", "自定义", null],
		];
		/** 把 proportion 展开成词串：兼容老卡（数组）与新卡（{preset,custom}） */
		function proportionTags(v) {
		  if (!v) return "";
		  if (Array.isArray(v)) return normPart(v).map((x) => String(x.t || "").trim()).filter(Boolean).join(", ");
		  const preset = String((v || {}).preset || "");
		  if (preset === "custom") return String((v || {}).custom || "").trim();
		  const hit = PROPORTION_PRESETS.filter((x) => x[0] === preset)[0];
		  return (hit && hit[2]) ? hit[2].join(", ") : "";
		}
		/** 把一整串风格标签拆进各模块（每项 {t,n}） */
		function splitStyleTags(tags) {
		  const parts = { trigger: "", proportion: { preset: "none", custom: "" }, style: [], line: [], color: [], light: [], extra: [] };
		  const toks = String(tags || "").split(",").map((x) => x.trim()).filter(Boolean);
		  let first = true;
		  for (const t of toks) {
		    const low = t.toLowerCase();
		    let hit = "";
		    for (const g of STYLE_GROUPS) { if (g[2].some((k) => low.indexOf(k) >= 0)) { hit = g[0]; break; } }
		    if (!hit && first && low.indexOf(" ") < 0) hit = "trigger";
		    first = false;
		    if (!hit) hit = "extra";
		    if (hit === "trigger") { parts.trigger = t; continue; }
		    if (hit === "proportion") {
		      const low2 = t.toLowerCase();
		      if (low2.indexOf("chibi") >= 0 || low2.indexOf("deformed") >= 0) parts.proportion.preset = "chibi";
		      else if (low2.indexOf("tall") >= 0 || low2.indexOf("mature") >= 0) parts.proportion.preset = "adult";
		      else { parts.proportion.preset = "custom"; parts.proportion.custom = t; }
		      continue;
		    }
		    parts[hit].push({ t: t, n: STYLE_ZH[t] || "" });
		  }
		  return parts;
		}
		/** 各模块按固定顺序拼回完整风格串 */
		function joinStyleParts(p) {
		  const out = [];
		  const trg = String((p || {}).trigger || "").trim();
		  if (trg) out.push(trg);
		  for (const k of STYLE_ORDER) {
		    if (k === "trigger") continue;
		    if (k === "proportion") { const sp = proportionTags((p || {})[k]); if (sp) out.push(sp); continue; }
		    const arr = normPart((p || {})[k]);
		    const s = arr.map((x) => String(x.t || "").trim()).filter(Boolean).join(", ");
		    if (s) out.push(s);
		  }
		  return out.join(", ");
		}
		
		

				/** 把一整串标签拆进各模块（每项 {t,n}） */
		function splitCardTags(tags) {
			const parts = { trigger: "", base: [], hair: [], eyes: [], glasses: [], outfit: [], extra: [] };
			const toks = String(tags || "").split(",").map((x) => x.trim()).filter(Boolean);
			let first = true;
			for (const t of toks) {
				const low = t.toLowerCase();
				let hit = "";
				for (const g of CARD_GROUPS) { if (g[2].some((k) => low.indexOf(k) >= 0)) { hit = g[0]; break; } }
				if (!hit && first && low.indexOf(" ") < 0) hit = "trigger";
				first = false;
				if (!hit) hit = "extra";
				if (hit === "trigger") { parts.trigger = t; continue; }
		if (!parts[hit]) hit = "extra";
				parts[hit].push({ t: t, n: zhOf(t) });
			}
			return parts;
		}

				/** 各模块按固定顺序拼回完整提示词（只用提示词本体，不含中文备注） */
		function joinCardParts(p) {
			const out = [];
			const trg = String((p || {}).trigger || "").trim();
			if (trg) out.push(trg);
			for (const k of CARD_ORDER) {
				if (k === "trigger") continue;
				if (k === "proportion") { const sp = proportionTags((p || {})[k]); if (sp) out.push(sp); continue; }
				const arr = normPart((p || {})[k]);
				const s = arr.map((x) => String(x.t || "").trim()).filter(Boolean).join(", ");
				if (s) out.push(s);
			}
			return out.join(", ");
		}

/** 角色卡界面统一按钮样式：实心灰底 + 纯白字加粗，杜绝半透明看不清 */
const CARD_BTN = { fontSize: "12px", fontWeight: 600, padding: "6px 14px", borderRadius: "6px", border: "1px solid var(--c-fg4)", background: "var(--c-line)", color: "var(--c-fg)", cursor: "pointer" };
const CARD_BTN_ACCENT = Object.assign({}, CARD_BTN, { border: "1px solid var(--c-accent)" });
const CARD_BTN_DANGER = Object.assign({}, CARD_BTN, { border: "1px solid var(--c-bad)", background: "var(--c-bad-bg)" });

/** 统一成 [{t:提示词, n:中文备注}]；兼容旧的纯字符串 */
function normPart(v) {
	if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? { t: x, n: zhOf(x) } : { t: String((x && x.t) || ""), n: String((x && x.n) || "") })).filter((x) => x.t || x.n);
	if (typeof v === "string") return v.split(",").map((x) => x.trim()).filter(Boolean).map((t) => ({ t: t, n: zhOf(t) }));
	return [];
}

/** 0.7.55：先让侧车落盘（Electron 里 a.download 不落地），侧车不在才退回浏览器下载 */
function downloadText(text, filename) {
	const fn = String(filename || "export.json");
	try {
		fetch(EXPANDER + "/save-json", {
			method: "POST",
			headers: Object.assign({ "Content-Type": "application/json" }, CONSOLE_HEADERS),
			body: JSON.stringify({ filename: fn, text: String(text) }),
		})
			.then((r) => r.json())
			.then((d) => {
				if (d && d.ok && d.path) {
					MSG("已保存 " + fn + " → " + d.path);
					revealCardFile("pack", d.path);
				} else {
					MSG("落盘失败（" + String((d && (d.error || d.message)) || "侧车没响应") + "）");
				}
			})
			.catch(() => {});
		return true;
	} catch (e) { return false; }
}

/** 把一张卡（或草稿）序列化成可导入的 JSON */
/** 导出全部自建卡（含对内置卡的改封面/改标签覆盖） */
function exportAllCards() {
	const src = (USER.cards || []).filter((c) => c && String(c.name || "").trim());
	const cards = src.map((c) => ({
		name: String(c.name || "").trim(),
		tags: String(c.tags || joinCardParts(c.parts || {})).trim(), locks: normLocks(c.locks),
		note: String(c.note || ""),
		cover: String(c.cover || ""),
		parts: (c.parts && typeof c.parts === "object") ? c.parts : splitCardTags(String(c.tags || "")),
		neg: normPart(c.neg),
		lora: String(c.lora || ""),
		loraW: Number(c.loraW) > 0 ? Number(c.loraW) : 0.7,
		conditioning: condForSave(c.conditioning),
	})).filter((c) => c.tags);
	if (!cards.length) { setMsg("还没有自建角色卡可导出（内置卡写在代码里，不用导出）"); return; }
	const obj = { version: 1, exportedAt: new Date().toISOString(), cards: cards };
	const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
	const fn = "角色卡-全部-" + cards.length + "张-" + day + ".json";
	const ok = downloadText(JSON.stringify(obj, null, 2), fn);
	setMsg(ok ? ("已导出全部 " + cards.length + " 张角色卡 → " + fn) : "导出失败：浏览器不允许下载");
}

/** 拖拽导入：.json / .dslcard / .dslrecipe 都能拖（和「导入」按钮同一条通道） */
function dropJsonProps(onFile) {
  return {
    onDragOver: (e) => { e.preventDefault(); e.currentTarget.style.outline = "2px dashed var(--c-accent)"; e.currentTarget.style.outlineOffset = "3px"; },
    onDragLeave: (e) => { e.currentTarget.style.outline = "none"; },
    onDrop: (e) => {
      e.preventDefault();
      if (e.currentTarget) e.currentTarget.style.outline = "none";
      const dt = e.dataTransfer || (e.nativeEvent && e.nativeEvent.dataTransfer);
      const f = dt && dt.files && dt.files[0];
      if (!f) { setMsg("拖拽没拿到文件（桌面版常见）：把卡放进 cardsDir 后点「重扫磁盘」，或用「粘贴 JSON」"); return; }
      if (!/\.(json|dslcard|dslrecipe)$/i.test(String(f.name || ""))) { setMsg("拖错了：只认 .json / .dslcard / .dslrecipe（松手的是「" + String(f.name || "") + "」）"); return; }
      onFile(f);
    },
  };
}

function importCards(e) {
  const f = e && e.target && e.target.files && e.target.files[0];
  try { if (e && e.target) e.target.value = ""; } catch (err) {}
  if (!f) { setMsg("没拿到文件：这个环境没弹文件对话框（桌面版常见）—— 用右边「粘贴 JSON」或把卡放进 cardsDir 再点「重扫磁盘」"); return; }
  importCardsFromFile(f);
}

/** 导入分流：先看扩展名，再看文件头魔数 DSLCARD2 —— 改名成 .json、或没有扩展名的卡包也能进
 *  命中卡包 → 走侧车解包；否则按 JSON 卡表导入（applyJson 由调用方给） */
function openCardFile(f, applyJson) {
  if (!f) return;
  if (/\.(dslcard|dslrecipe)$/i.test(String(f.name || ""))) { importDslCard(f); return; }
  const sniff = new FileReader();
  sniff.onload = () => {
    if (String(sniff.result || "") === "DSLCARD2\n") { importDslCard(f); return; }
    const rd = new FileReader();
    rd.onload = () => {
      let raw = null;
      try { raw = JSON.parse(String(rd.result || "null")); } catch (err) { setMsg("导入失败：既不是卡包（.dslcard / .dslrecipe），也不是合法 JSON"); return; }
      applyJson(raw);
    };
    rd.onerror = () => setMsg("读取文件失败");
    rd.readAsText(f, "utf-8");
  };
  sniff.onerror = () => setMsg("读取文件失败");
  sniff.readAsText(f.slice(0, 9), "utf-8");
}

function importCardsFromFile(f) {
  if (!f) { setMsg("没拿到文件：拖拽没把 files 交过来（桌面版常见）—— 用「粘贴 JSON」"); return; }
  setMsg("收到文件：" + String(f.name || "") + "（" + Math.round(Number(f.size || 0) / 1024) + " KB），正在解析…");
  openCardFile(f, applyCardImport);
}

/** 角色卡导入核心：按卡名 upsert（同名覆盖、保留 id / 封面 / 来源文件） */
function applyCardImport(raw) {
  const list = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.cards) ? raw.cards : (raw ? [raw] : []));
  clientLog("applyCardImport", "in=" + list.length + " 条 · 现有 " + ((USER.cards || []).length) + " 张");
  try { _applyCardImportBody(list); }
  catch (e) {
    clientLog("applyCardImport", "异常 " + ((e && e.message) || e) + " @ " + String((e && e.stack) || "").split("\n").slice(1, 3).join(" | "));
    setMsg("导入出错（" + ((e && e.message) || e) + "）—— 已写日志 client-err.log（v" + CLIENT_VER + "）");
  }
}
function _applyCardImportBody(list) {
  const ok = [];
  for (const c of list) {
    if (!c) continue;
    const rec = cardFromJson(c);
    if (rec) ok.push(rec);
  }
  if (!ok.length) {
    const why = list.slice(0, 3).map((c) => {
      const nm = String((c && c.name) || "").trim();
      const tg = String((c && c.tags) || "").trim();
      return "「" + (nm || "(无 name)") + "」" + (nm ? (tg ? "tags 空且 parts 拼不出词" : "缺 tags") : "缺 name");
    }).join("；");
    clientLog("applyCardImport", "0 张可用 · 收到 " + list.length + " 条 · " + why);
    setMsg("没有可导入的角色卡：" + why + "（v" + CLIENT_VER + "）");
    return;
  }
  USER.cards = USER.cards || [];
  let added = 0, updated = 0;
  for (const c of ok) {
    const nm = String(c.name || "").trim();
    const hit = USER.cards.findIndex((x) => String((x && x.name) || "").trim() === nm);
    if (hit >= 0) {
      if (!c.cover && USER.cards[hit].cover) c.cover = USER.cards[hit].cover;
      c.id = USER.cards[hit].id;
      if (!c.file && USER.cards[hit].file) c.file = USER.cards[hit].file;
      USER.cards[hit] = c; updated++;
    } else { USER.cards.push(c); added++; }
  }
  saveUser();
  setMsg("已解析 " + ok.length + " 张：新增 " + added + "，更新 " + updated + "，正在落盘…");
  persistCards(ok, "cards").then((r) => {
    if (r.ok) {
      setMsg("已导入 " + ok.length + " 张（新增 " + added + "、更新 " + updated + "）· 落盘 " + r.ok + " 张到角色卡目录");
    } else {
      setMsg("导入失败：磁盘写不进去（" + (r.errors[0] || "未知原因") + "）—— 卡没留下来。检查 config.json 的 cardsDir 是否可写");
    }
    materializeEmbedded(ok);
  });
}


/** 0.7.74：导入的卡**先落盘**再算成功。
 *  以前 applyCardImport / applyStyleImport 只写 localStorage，磁盘上什么都没有；
 *  下一次「目录即真相」同步（切页 / 重开面板 / mount 后 1.2s）看到目录为空，
 *  就把面板整类清空 —— 表现就是「导入瞬间成功，绘图台里没有」。
 *  kind: "cards" | "style" | "dict"
 */
function persistCards(list, kind) {
	const arr = (list || []).filter(Boolean);
	if (!arr.length) return Promise.resolve({ ok: 0, fail: 0, errors: [] });
	return Promise.all(arr.map((rec) => {
		rec.pendingDisk = true;
		// 0.7.92：以前这里也是白名单 —— 导入的卡落盘时丢 cover / id / embeddedDir / schemaVersion。
		// 现在以整条记录为底（剔除运行时键），白名单字段再覆盖上去，和 writeCardToDisk 0.7.85 同一套写法。
		const keep = Object.assign({}, rec || {});
		["fromDisk", "diskDir", "pendingDisk", "busy", "edit", "__file"].forEach((k) => { delete keep[k]; });
		const card = Object.assign({}, keep, {
			name: rec.name, tags: rec.tags, note: rec.note, parts: rec.parts,
			// neg 原样保留 {t,n}（中文备注不能丢），纯字符串也兼容
			neg: (rec.neg || []).map((x) => (x && typeof x === "object")
				? { t: String(x.t || ""), n: String(x.n || "") }
				: String(x || "")).filter((x) => (x && typeof x === "object") ? x.t : x),
			lora: rec.lora || "", loraW: rec.loraW, loraAlt: rec.loraAlt || "",
			locks: (rec.locks || []), conditioning: rec.conditioning || null,
		});
		if (rec.id) card.id = String(rec.id);
		if (rec.cover) card.cover = String(rec.cover);
		return jpost(EXPANDER + "/dir/write", { kind: kind, card: card, path: String(rec.file || "") }, 60000)
			.then((d) => {
				if (!d || !d.ok) throw new Error(String((d && d.error) || "写入失败"));
				rec.file = String(d.path || rec.file || "");
				rec.fromDisk = true;
				delete rec.pendingDisk;
				return { name: rec.name, ok: true, conflict: !!d.conflict, existingTags: d.existingTags || "" };
			})
			.catch((e) => ({ name: rec.name, ok: false, error: String((e && e.message) || e) }));
	})).then((rs) => {
		const ok = rs.filter((x) => x.ok).length;
		const fail = rs.length - ok;
		const errors = rs.filter((x) => !x.ok).map((x) => x.name + "：" + x.error);
		const conflicts = rs.filter((x) => x.conflict).map((x) => x.name);
		try { saveUser(); } catch (e) { }
		clientLog("persistCards", "kind=" + kind + " ok=" + ok + " fail=" + fail +
			(conflicts.length ? " conflict=" + conflicts.join(",") : "") + (errors.length ? " errors=" + errors.join(" | ") : ""));
		// 落盘成功后按磁盘重建面板：面板 = 目录，避免「内存有、界面没有」
		// 0.7.78 修：kind='cards' 以前也调 syncKindFromDisk → 走进 mergeDiskDict，
		// 会把角色卡当词库分类写进 USER.frags 和 词库 目录。角色卡必须走 syncCardsFromDisk。
		if (ok) {
			try {
				if (kind === "cards") syncCardsFromDisk({ quiet: true });
				else syncKindFromDisk(kind);
			} catch (e) { clientLog("persistCards", "sync 失败 " + e); }
		}
		return { ok: ok, fail: fail, errors: errors, conflicts: conflicts };
	});
}

/** 把磁盘上的一张卡写回它来源的文件（面板改锁 / 改词后落盘，保持文件是活的） */
function writeCardToDisk(rec) {
  try {
    /**
     * 0.7.85：落盘曾经只写上面这份白名单 —— 卡 JSON 里白名单之外的字段（`id`、`schemaVersion`、
     * `loraNote`、`cover`、`packMode` …）会被**悄悄抹掉**：面板里还在，存一次盘就没了。
     * 2026-10-22 实测 <角色卡>.json 少了 `schemaVersion: 2` 与整条 `loraNote`（只有备份里还有）。
     * 现在以「面板里那张卡」为底，白名单字段覆盖上去，其余原样保留。
     */
    const keep = Object.assign({}, rec || {});
    ["fromDisk", "diskDir", "pendingDisk", "busy", "edit", "__file"].forEach((k) => { delete keep[k]; });
    const card = {
      name: rec.name, locks: normLocks(rec.locks), tags: rec.tags, note: rec.note, parts: rec.parts,
      neg: normPart(rec.neg).map((x) => String(x.t || "")).filter(Boolean),
      lora: rec.lora, loraW: rec.loraW, loraAlt: rec.loraAlt, conditioning: condForSave(rec.conditioning),
    };
    if (rec.id) card.id = String(rec.id);
    Object.keys(keep).forEach((k) => { if (!(k in card) && keep[k] !== undefined) card[k] = keep[k]; });
    const body = { path: String((rec && rec.file) || ""), card: card };
    // 0.7.60：没有来源文件也要落盘（新建一张 <角色卡目录>/<卡名>.json），这样目录即真相才成立
    jpost(EXPANDER + "/dir/write", { kind: "cards", card: body.card, path: body.path }, 30000)
      .then((d) => {
        if (!d || !d.ok) throw new Error((d && d.error) || "unknown");
        if (!rec.file && d.path) { rec.file = d.path; rec.fromDisk = true; }
        return d;
      })
      .catch((e) => MSG("磁盘写回失败：" + ((e && e.message) || e)));
  } catch (e) { /* ignore */ }
}

function openInExplorer(url) {
	const u = String(url || "");
	const m = u.match(/[?&]filename=([^&]+)/);
	if (!m) { setMsg("这张图没有文件名信息，无法定位"); return; }
	let sub = "";
	const ms = u.match(/[?&]subfolder=([^&]*)/);
	if (ms) sub = decodeURIComponent(ms[1]);
	const payload = { filename: decodeURIComponent(m[1]), subfolder: sub };
	try {
		fetch(EXPANDER + "/open", { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, CONSOLE_HEADERS), body: JSON.stringify(payload) })
			.then((r) => r.json().then((d) => ({ status: r.status, d: d })))
			.then((res) => {
				const d = res.d || {};
				if (d.ok) setMsg("已在资源管理器定位：" + (d.path || ""));
				else if (res.status === 404) setMsg("定位失败：sidecar 还是旧版本，重启一次 dsh web 后再试");
				else setMsg("定位失败：" + (d.error || d.message || "未知原因"));
			})
			.catch(() => setMsg("定位失败：连不上本地 sidecar（8199）"));
	} catch (e) { setMsg("定位失败：" + e); }
}

function cardCoverOf(c) {
		const u = (USER.cards || []).filter((x) => x && x.id === c.id)[0];
		return (u && u.cover) || c.cover || "";
	}

	/** 没有封面时按名字取色的渐变，保证每张卡都有辨识度 */
	function cardGrad(name) {
		let s = 0;
		const t = String(name || "?");
		for (let i = 0; i < t.length; i++) s = (s * 31 + t.charCodeAt(i)) % 360;
		return "linear-gradient(160deg,hsl(" + s + ",48%,45%),hsl(" + ((s + 42) % 360) + ",40%,27%))";
	}

		function cardCoverBox(c, hpx) {
		const cover = cardCoverOf(c);
		const box = { backgroundSize: "cover", backgroundPosition: "center top" };
		if (hpx) box.height = hpx + "px"; else box.aspectRatio = "3 / 4";
		if (cover) { box.backgroundImage = "url(" + cover + ")"; return h("div", { style: box }); }
		box.background = cardGrad(c.name);
		box.display = "flex"; box.alignItems = "center"; box.justifyContent = "center";
		return h("div", { style: box }, h("span", { style: { fontSize: hpx ? "30px" : "46px", fontWeight: 700, color: "rgba(var(--c-ink-rgb),.35)" } }, String(c.name || "?").slice(0, 1)));
	}

		function newCard() {
		loadLlllite();
		setCardEdit({ id: "", name: "", note: "", cover: "", neg: [], isNew: true, locks: normLocks([]), file: "", cond: normCond(null), baseModels: [], baseModelsText: ckpt ? String(ckpt).split(/[\\/]/).pop().replace(/\.(safetensors|ckpt)$/i, "") : "", parts: { trigger: "", base: "", hair: "", eyes: "", glasses: "", outfit: "", extra: "" } });   /* 新卡默认预填当前底模 */
	}

		/** 拉一次 LLLite 资产/权重表（侧车 /lllite），编辑器与卡片角标都吃这张表 */
		async function loadLlllite() {
			try {
				const t = await jget(EXPANDER + "/lllite", 8000);
				setLllliteT(t && typeof t === "object" ? t : { assets: {}, weights: {} });
			} catch (e) {
				setLllliteT({ assets: {}, weights: {}, error: errText(e) });
			}
		}

		function editCard(c) {
		const u = (USER.cards || []).filter((x) => x && x.id === c.id)[0];
		const parts = (u && u.parts) || splitCardTags(c.tags);
		setCardEdit({ id: c.id, name: c.name || "", note: c.note || "", cover: cardCoverOf(c), parts: parts, lora: String(c.lora || ""), loraW: Number(c.loraW) > 0 ? Number(c.loraW) : 0.7, loraAlt: String(c.loraAlt || ""), cond: normCond(c.conditioning), neg: normPart((u && u.neg) || c.neg || []), isNew: false, locks: normLocks(c.locks), file: String(c.file || ""), builtin: !!c.builtin, baseModels: Array.isArray(c.baseModels) ? c.baseModels.slice() : [], baseModelsText: c.baseModelsText != null ? String(c.baseModelsText) : (Array.isArray(c.baseModels) ? c.baseModels.join(", ") : ""), training: c.training, trainingText: c.trainingText, regression: c.regression, regressionText: c.regressionText });   /* 0.7.130：这几项以前没带进草稿 → 编辑器输入框永远空 → 一保存 baseModels 就被写成 []，训练脚本标的底模存不住 */
		loadLlllite();
		setTimeout(() => COND.check({ name: c.name || "", id: c.id || "", conditioning: normCond(c.conditioning) }, [Number(w), Number(hh)]), 0);
	}

	function delCard(c) {
		if (c.builtin) { setMsg("内置卡不能删除，可以点 ✎ 修改它的封面与标签"); return; }
		if (!window.confirm("确定删除角色卡「" + c.name + "」？\n\n会同时从磁盘文件里删掉这张卡；文件里只剩它一个时，连文件一起删。")) return;
		// 0.7.91：同 delStyleCard —— mergeDiskCards 也是「磁盘为准」，只删内存刷一次就复活。
		const nm = String(c.name || "").trim();
		const _real = (USER.cards || []).filter((x) => x && String(x.id || "") === String(c.id || ""))[0] || {};
		const _file0 = String(c.file || _real.file || "").trim();
		const dropLocal = () => {
			USER.cards = (USER.cards || []).filter((x) => x && (x.id !== c.id || String(x.name || "").trim() !== nm));
			saveUser();
		};
		const finish = (d) => {
			dropLocal();
			setMsg("已删除角色卡「" + nm + "」" + (d.deletedFile ? " · 文件已删除"
				: (d.noop ? " · 文件早已不在" : " · 从文件移除 " + String(d.removed || 0) + " 张")));
			repaintAll();
		};
		const del1 = (path) => fetch(EXPANDER + "/dir/del", {
			method: "POST",
			headers: Object.assign({ "Content-Type": "application/json" }, CONSOLE_HEADERS),
			body: JSON.stringify({ kind: "cards", path: path, name: nm, id: String(c.id || "") }),
		}).then((r) => r.json()).then((d) => {
			if (!d || !d.ok) throw new Error(String((d && d.error) || "侧车拒绝"));
			return d;
		});
		const byName = () => fetch(EXPANDER + "/dir/list?kind=cards", { headers: CONSOLE_HEADERS })
			.then((r) => r.json())
			.then((j) => {
				const lst = j.cards || j.items || [];
				const hit = lst.filter((x) => String((x && x.name) || "").trim() === nm)[0];
				if (!hit) throw new Error("磁盘上没有同名卡文件");
				return String(hit.__file || hit.file || "");
			});
		try { clientLog("delCard", "name=" + nm + " file=" + (_file0 || "(空)") + " 有真实记录=" + (!!_real.file)); } catch (e) {}
		Promise.resolve(_file0 || byName())
			.then((path) => { if (!path) throw new Error("找不到对应文件"); return del1(path); })
			.then(finish)
			.catch((e) => {
				dropLocal();
				setMsg("已从面板删除「" + nm + "」，但磁盘没删掉：" + String((e && e.message) || e) + " —— 同步后会回来");
				repaintAll();
			});
	}

/**
 * 0.7.87：封面「设了却没落盘」的根因修复。
 * 以前「选择图片…」「用最近一张出图」「清除封面」只改卡编辑器的内存态（setCardEdit / setStyleEdit），
 * 不按「保存」就整条丢掉 —— 表现就是「每次进控制台，卡片封面掉」。
 * 现在只要这张卡已经在磁盘上（有 d.file），设/清封面立刻写 localStorage + 卡 JSON；
 * 新卡还没落盘时才退回「先记在编辑器里，按保存一起写」。
 */
function cardRecFromEdit(d, name, id) {
  const parts = (d && d.parts) || {};
  return {
    id: id || (d.id || ("u" + String(Date.now()))), name: name, locks: normLocks(d.locks),
    tags: joinCardParts(parts), note: String(d.note || "").trim(), cover: String(d.cover || ""),
    parts: parts, neg: normPart(d.neg), lora: String(d.lora || ""),
    loraW: Number(d.loraW) > 0 ? Number(d.loraW) : 0.7, loraAlt: String(d.loraAlt || ""),
    file: String(d.file || ""), conditioning: condForSave(d.cond),
  };
}

function applyCardCover(url, note) {
  const d = cardEdit || {};
  const cover = String(url || "");
  setCardEdit((p) => Object.assign({}, p, { cover: cover }));
  const name = String(d.name || "").trim();
  const file0 = String(d.file || "").trim();
  if (!name || !file0) {
    setMsg(note || (cover ? "封面已载入（新卡要按「保存」才落盘）" : "封面已清除"));
    return;
  }
  const rec = Object.assign(cardRecFromEdit(Object.assign({}, d, { cover: cover }), name, d.id), { file: file0, cover: cover });
  USER.cards = USER.cards || [];
  let i = rec.id ? USER.cards.findIndex((x) => x && x.id && String(x.id) === String(rec.id)) : -1;
  if (i < 0) i = USER.cards.findIndex((x) => x && String(x.file || "") === file0);
  const merged = Object.assign({}, (i >= 0 ? USER.cards[i] : {}), rec);
  if (i >= 0) USER.cards[i] = merged; else USER.cards.push(merged);
  saveUser();
  writeCardToDisk(merged);
  setMsg(note || (cover ? "封面已写入卡文件" : "封面已清除并写回卡文件"));
}

function applyStyleCover(url, note) {
  const d = styleEdit || {};
  const cover = String(url || "");
  setStyleEdit((p) => Object.assign({}, p, { cover: cover }));
  const file0 = String(d.file || "").trim();
  if (!file0) { setMsg(note || (cover ? "封面已载入（新卡要按「保存」才落盘）" : "封面已清除")); return; }
  const arr = USER.styleCards || [];
  let i = arr.findIndex((x) => x && ((x.file && String(x.file) === file0) || (d.id && x.id && String(x.id) === String(d.id))));
  if (i < 0) { setMsg(note || (cover ? "封面已载入（按「保存」落盘）" : "封面已清除")); return; }
  const rec = Object.assign({}, arr[i], { cover: cover, file: file0 });
  arr[i] = rec;
  saveUser();
  dirWrite("style", rec, file0).then((r) => {
    if (r && r.ok) setMsg(note || (cover ? "封面已写入风格卡文件" : "封面已清除并写回"));
    else if (r && r.error) setMsg("封面写盘失败：" + r.error);
  }).catch(() => { });
}

/** 封面拖入：包一个伪事件复用选封面那条通道，压缩/尺寸/大小检查全都不用重写 */
/** 风格卡封面拖入：同样包伪事件复用选图通道 */
function dropStyleCoverFile(f) {
	if (!f) return;
	if (!/^image\//.test(f.type || "")) { setMsg("只能拖图片进来"); return; }
	if (typeof pickStyleCoverFile !== "function") { setMsg("这个面板没有封面入口"); return; }
	pickStyleCoverFile({ target: { files: [f] } });
}

function dropCoverFile(f) {
	if (!f) return;
	if (!/^image\//.test(f.type || "")) { setMsg("只能拖图片进来"); return; }
	pickCoverFile({ target: { files: [f] } });
}

function pickCoverFile(e) {
		const f = e && e.target && e.target.files && e.target.files[0];
		if (!f) return;
		if (!/^image\//.test(f.type || "")) { setMsg("只能选图片文件"); return; }
		const rd = new FileReader();
		rd.onload = () => {
			const img = new Image();
			img.onload = () => {
				const MAX = 360;
				const s = Math.min(1, MAX / Math.max(img.width || 1, img.height || 1));
				const w = Math.max(1, Math.round((img.width || MAX) * s));
				const hh = Math.max(1, Math.round((img.height || MAX) * s));
				const cv = document.createElement("canvas");
				cv.width = w; cv.height = hh;
				cv.getContext("2d").drawImage(img, 0, 0, w, hh);
				let url = "";
				try { url = cv.toDataURL("image/jpeg", 0.82); } catch (err) { setMsg("图片转换失败：" + (err && err.message)); return; }
				if (url.length > 180000) { setMsg("压缩后仍偏大（" + Math.round(url.length / 1024) + " KB > 176 KB），换张小点的图或改用「用最近一张出图」"); return; }
				applyCardCover(url, "封面已载入（" + w + "×" + hh + "，" + Math.round(url.length / 1024) + " KB），已写入卡文件");
			};
			img.onerror = () => setMsg("这个文件读不出图片");
			img.src = String(rd.result || "");
		};
		rd.onerror = () => setMsg("读取文件失败");
		rd.readAsDataURL(f);
	}

		/** 卡资产自检：底模在不在本机 + 迁移信息齐不齐（服务端比对 ComfyUI 模型清单） */
		/** 校验任意一张卡（角色卡 / 风格卡共用）；d 缺省取当前编辑的角色卡，put 缺省写角色卡的自检状态 */
		async function validateCardAssets(d, put) {
			const c = d || cardEdit || {};
			const setter = put || setCardChk;
			try {
				const r = await jpost(EXPANDER + "/cards/validate", {
					card: { baseModels: _cardBm(c), training: parseJsonField(c.trainingText, c.training), regression: parseJsonField(c.regressionText, c.regression) },
				});
				setter(r || {});
				if (!r || !r.checked) setMsg("自检完成：ComfyUI 未启动，本次只查了迁移信息");
			} catch (e) { setMsg("自检失败：" + errText(e)); }
		}

		/** 跑回归锚：对卡上的 regression.seeds 逐个出图，参数全部取当前面板；target 缺省取当前角色卡 */
		async function runRegression(target, kind) {
			const d = target || cardEdit || {};
			const isStyle = kind === "style";
			const rg = parseJsonField(d.regressionText, d.regression) || {};
			const seeds = (rg.seeds || []).map((x) => Number(x)).filter((x) => Number.isFinite(x) && x >= 0);
			if (!seeds.length) { setMsg("这张卡没有 regression.seeds。先在上面「回归锚」里填，例如 {\"seeds\":[20261014,20261018]}"); return; }
			if (REG.running) { setMsg("回归锚正在跑（" + REG.cur + "/" + REG.total + "），等它结束或点「停止」"); return; }
			if (!ckpt) { setMsg("先在生成页选一个底模——回归锚用当前面板的底模与参数"); return; }
			const _cur = BG.snapshot();
			if (_cur && (_cur.status === "submitting" || _cur.status === "running")) { setMsg("生成页有任务在跑，等它结束再跑回归锚"); return; }

			let _pos = String(pos || "").trim();
			let _src = "面板当前正向词";
			if (!_pos) {
				_pos = isStyle ? (joinStyleParts(d.parts || {}) || String(d.tags || "").trim())
					: (joinCardParts(d.parts || {}) || String(d.tags || "").trim());
				_src = "卡片自带的词（面板正向为空）";
			}
			if (!_pos) { setMsg("没有可用的正向词：先在生成页插入这张卡，或给卡填标签"); return; }
			const _neg = String(neg || "").trim();

			REG.reset(d.id || d.name || "card", seeds);
			setMsg("回归锚开始：" + seeds.length + " 个 seed，参数取当前面板，正向词来自" + _src);
			let okN = 0;
			try {
				for (let i = 0; i < seeds.length; i++) {
					if (REG.cancel) { REG.update(i, { ok: false, error: "已取消" }); continue; }
					REG.cur = i + 1; REG.emit();
					// 身份控制：与 doGen 同一套 staging；失败就不带这一项，不中断整批
					let _extra = null, _wire = null;
					const _cp = COND.plan;
					if (_cp && _cp.status === "resolved") {
						try {
							const st = await jpost(EXPANDER + "/lllite/stage", { asset: _cp.asset, weights_key: _cp.weights_key }, 60000);
							if (st && st.ok) { _wire = { image: st.image, patch: st.patch, strength: _cp.strength }; _extra = { dsh_lllite: _cp }; }
						} catch (e) { /* 不带身份控制继续 */ }
					}
					const graph = buildGraph({
						ckpt, unet: ckpt, clip, clipType: effectiveClipType(ckpt, clipType, unets), vae, loras: selLoras, pos: _pos, neg: _neg,
						w: Number(w), h: Number(hh), steps: Number(steps), cfg: Number(cfg),
						sampler, scheduler, seed: seeds[i], upscale, upscaleModel, upscaleFactor,
						prefix: String(prefix || "dsh_comfy").replace(/[^\w\-]+/g, "_") + (isStyle ? "_sreg_" : "_reg_") + String(d.id || "card").replace(/[^\w\-]+/g, "_") + "_" + seeds[i],
						lllite: _wire,
					});
					await BG.run(graph, { w, h: hh, steps, cfg, seed: seeds[i], regression: d.id || d.name || "" }, _extra);
					const _pid = (BG.snapshot() || {}).pid || null;
					const r = await waitJob(900000, _pid);
					if (r.ok) okN++;
					REG.update(i, r.ok ? { ok: true, image: r.image } : { ok: false, error: r.error || "失败" });
				}
			} finally {
				REG.done();
			}
			setMsg("回归锚完成：" + okN + "/" + seeds.length + " 张成功" + (okN < seeds.length ? "，失败的 seed 见下方列表" : "，全部通过 ✓"));
		}

		function saveCard() {
		const d = cardEdit || {};
		const name = String(d.name || "").trim();
		if (!name) { setMsg("卡名不能为空"); return; }
		const parts = d.parts || {};
		const tags = joinCardParts(parts);
		if (!tags) { setMsg("至少要填一个标签（触发词或任一模块）"); return; }
		USER.cards = USER.cards || [];
		const rec = { baseModels: _cardBm(d), training: parseJsonField(d.trainingText, d.training), regression: parseJsonField(d.regressionText, d.regression), id: d.id || ("u" + String(Date.now())), name: name, locks: normLocks(d.locks), tags: tags, note: String(d.note || "").trim(), cover: String(d.cover || ""), parts: parts, neg: normPart(d.neg), lora: String(d.lora || ""), loraW: Number(d.loraW) > 0 ? Number(d.loraW) : 0.7, loraAlt: String(d.loraAlt || ""), file: String(d.file || ""), conditioning: condForSave(d.cond) };
		const i = USER.cards.findIndex((x) => x && x.id === rec.id);
		if (i >= 0) USER.cards[i] = Object.assign({}, USER.cards[i], rec); else USER.cards.push(rec);
		saveUser();
		if (rec.file) writeCardToDisk(rec);
  setCardEdit(null);
		setMsg("已保存角色卡「" + name + "」（" + tags.split(",").length + " 条标签）");
	}

		/** 另存为：复制当前草稿成一张**新卡**（不是覆盖） */
		function saveAsCard() {
			const d = cardEdit || {};
			if (!String(d.name || "").trim()) { setMsg("卡名不能为空"); return; }
			const parts = d.parts || {};
			const tags = joinCardParts(parts);
			if (!tags) { setMsg("至少要填一个标签（触发词或任一模块）"); return; }
			const name = String(window.prompt("另存为新的角色卡，名称：", String(d.name || "").trim() + " 2") || "").trim();
			if (!name) return;
			USER.cards = USER.cards || [];
			const rec = { baseModels: _cardBm(d), training: parseJsonField(d.trainingText, d.training), regression: parseJsonField(d.regressionText, d.regression), id: "u" + String(Date.now()), name: name, locks: normLocks(d.locks), tags: tags, note: String(d.note || "").trim(), cover: String(d.cover || ""), parts: JSON.parse(JSON.stringify(parts)), neg: JSON.parse(JSON.stringify(normPart(d.neg))), lora: String(d.lora || ""), loraW: Number(d.loraW) > 0 ? Number(d.loraW) : 0.7, loraAlt: String(d.loraAlt || ""), conditioning: condForSave(d.cond) };
			USER.cards.push(rec);
			saveUser();
			setCardEdit(null);
			setMsg("已另存为新卡「" + name + "」（原卡未改动）");
		}


								function cardEditor() {
									const d = cardEdit || {};
									const parts = d.parts || {};
									const set = (k, v) => setCardEdit((p) => Object.assign({}, p, { [k]: v }));
									const setPart = (k, v) => setCardEdit((p) => Object.assign({}, p, { parts: Object.assign({}, (p || {}).parts || {}, { [k]: v }) }));
									const row = { display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "9px", flexWrap: "wrap", flexShrink: 0 };
									const lab = { width: "78px", fontSize: "12px", color: "var(--c-fg3)", paddingTop: "6px", flex: "none" };
									const inp = { flex: 1, minWidth: 0, padding: "5px 8px", borderRadius: "6px", border: "1px solid rgba(var(--c-ink-rgb),.22)", background: "var(--c-card)", color: "var(--c-fg)", fontSize: "12px" };
									const chipBox = { display: "flex", flexWrap: "wrap", gap: "6px", flex: 1, alignItems: "center", minHeight: "30px" };
  const _bmText = d.baseModelsText != null ? d.baseModelsText : (Array.isArray(d.baseModels) ? d.baseModels.join(", ") : "");
  const _trText = d.trainingText != null ? d.trainingText : (d.training ? JSON.stringify(d.training) : "");
  const _rgText = d.regressionText != null ? d.regressionText : (d.regression ? JSON.stringify(d.regression) : "");
  const locksArr = Array.isArray(d.locks) ? d.locks : [];
  const setLocks = (arr) => set("locks", arr);
  const addCardLock = () => setLocks(locksArr.concat([{ name: "", tags: [], scope: "full" }]));
  const delCardLock = (i) => setLocks(locksArr.filter((_, k) => k !== i));
  const setCardLock = (i, patch) => setLocks(locksArr.map((x, k) => (k === i ? Object.assign({}, x, patch) : x)));
									const chip = { display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 7px", borderRadius: "4px", border: "1px solid var(--c-fg4)", background: "var(--c-panel2)", color: "var(--c-fg)", fontSize: "12px", cursor: "text" };
									const chipX = { cursor: "pointer", color: "var(--c-bad)", padding: "0 1px", fontWeight: 700 };
									const editBox = { display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px", borderRadius: "5px", border: "1px solid var(--c-accent)", background: "rgba(15,23,42,.30)" };
									const ciN = { width: "74px", padding: "3px 6px", borderRadius: "4px", border: "1px solid rgba(var(--c-ink-rgb),.16)", background: "var(--c-card)", border: "1px solid rgba(var(--c-ink-rgb),.18)", color: "var(--c-fg)", fontSize: "12px" };
									const ciT = { width: "150px", padding: "3px 6px", borderRadius: "4px", border: "1px solid rgba(var(--c-ink-rgb),.16)", background: "var(--c-card)", border: "1px solid rgba(var(--c-ink-rgb),.18)", color: "var(--c-fg)", fontSize: "12px" };
									const mini = Object.assign({}, CARD_BTN, { padding: "2px 8px", fontSize: "12px" });
									const addBtn = Object.assign({}, CARD_BTN, { padding: "2px 9px", fontSize: "13px" });

									const mod = (key, label, isNeg) => {
										const arr = normPart(isNeg ? d.neg : parts[key]);
										const put = (a) => { if (isNeg) set("neg", a); else setPart(key, a); setTagAt(""); setTagNote(""); setTagDraft(""); };
										const commit = (i) => {
											const t = tagDraft.trim(), n = tagNote.trim();
											const next = arr.slice();
											if (t || n) next[i] = { t: t, n: n }; else next.splice(i, 1);
											put(next);
										};
										return h("div", { style: row, key: key },
											h("span", { style: lab }, label),
											h("div", { style: chipBox },
												arr.map((x, i) => (tagAt === key + ":" + i
													? h("span", { key: "e" + i, style: editBox },
														h("input", { autoFocus: true, style: ciN, value: tagNote, placeholder: "中文备注", onChange: (e) => setTagNote(e.target.value) }),
														h("input", { style: ciT, value: tagDraft, placeholder: "提示词 tag", onChange: (e) => setTagDraft(e.target.value),
															onKeyDown: (e) => { if (e.key === "Enter") commit(i); else if (e.key === "Escape") { setTagAt(""); setTagNote(""); setTagDraft(""); } } }),
														h("button", { style: mini, onClick: () => commit(i) }, "确定"),
														h("button", { style: mini, onClick: () => { const nx = arr.slice(); nx.splice(i, 1); put(nx); } }, "删"))
													: h("span", { key: "c" + i, style: chip, title: x.t || x.n || "", onClick: () => { setTagAt(key + ":" + i); setTagNote(x.n || ""); setTagDraft(x.t || ""); } },
														(x.n || x.t || "（空）"),
														h("span", { style: chipX, title: "删掉这一条", onClick: (e) => { if (e && e.stopPropagation) e.stopPropagation(); const nx = arr.slice(); nx.splice(i, 1); put(nx); } }, "✕")))),
												tagAt === key + ":new"
													? h("span", { key: "new", style: editBox },
														h("input", { autoFocus: true, style: ciN, value: tagNote, placeholder: "中文备注", onChange: (e) => setTagNote(e.target.value) }),
														h("input", { style: ciT, value: tagDraft, placeholder: "提示词 tag", onChange: (e) => setTagDraft(e.target.value),
															onKeyDown: (e) => {
																if (e.key === "Enter") { const t = tagDraft.trim(), n = tagNote.trim(); if (t || n) put(arr.concat([{ t: t, n: n }])); else put(arr); }
																else if (e.key === "Escape") { setTagAt(""); setTagNote(""); setTagDraft(""); } } }),
														h("button", { style: mini, onClick: () => { const t = tagDraft.trim(), n = tagNote.trim(); if (t || n) put(arr.concat([{ t: t, n: n }])); else put(arr); } }, "加"),
														h("button", { style: mini, onClick: () => { setTagAt(""); setTagNote(""); setTagDraft(""); } }, "取消"))
													: h("button", { key: "add", style: addBtn, title: "加一条标签", onClick: () => { setTagAt(key + ":new"); setTagNote(""); setTagDraft(""); } }, "＋")));
									};

									// ---- 身份控制（LLLite）：与「角色 LoRA」同级，插卡即自动挂条件图 ----
									const _cond = normCond(d.cond);
									const _cTable = (llliteT && llliteT.assets) || {};
									const _wTable = (llliteT && llliteT.weights) || {};
									const _cAssets = Object.keys(_cTable);
									const _cWeights = Object.keys(_wTable);
									const _cCur = _cond.presets[_cond.default] || {};
									const _cCurAsset = _cond.enabled ? String(_cCur.asset || "") : "";
									const _cCurW = String(_cCur.weights || (_cWeights[0] || ""));
									const _cCurS = Number(_cCur.strength) > 0 ? Number(_cCur.strength) : 1;
									const _cKeys = Object.keys(_cond.presets);
									const _putCond = (cond) => {
										setCardEdit((prev) => Object.assign({}, prev, { cond: cond }));
										COND.check({ name: String(d.name || ""), id: String(d.id || ""), conditioning: cond }, [Number(w), Number(hh)]);
									};
									const _chk = (COND.checkOf && COND.checkOf.name === String(d.name || "")) ? COND.checkOf.plan : null;
									const _chkColor = !_chk || _chk.status === "off" ? "var(--c-fg3)" : _chk.status === "resolved" ? "var(--c-ok)" : _chk.status === "blocked" ? "var(--c-bad)" : "var(--c-warn)";
									const _chkText = !_chk ? "未校验"
									  : _chk.status === "resolved" ? ("校验通过 · " + (_chk.preset || "") + " → " + (_chk.weights_key || "") + " · 强度 " + _chk.strength + (_chk.autoPicked ? "（已按画布比例自动换档）" : ""))
									  : _chk.status === "off" ? (_chk.reason || "未绑定")
									  : ((_chk.status === "blocked" ? "✕ " : "⚠ ") + (_chk.reason || ""));
									const _chkNote = (_chk && _chk.note) ? _chk.note : "";
									const _setLllite = (aid) => {
										const cond = normCond(d.cond);
										if (!aid) { cond.enabled = false; _putCond(cond); return; }
										const a = _cTable[aid] || {};
										const key = String(a.framing || "closeup");
										const prev = cond.presets[key] || {};
										cond.presets[key] = Object.assign({}, prev, {
											asset: aid,
											weights: prev.weights || (_cWeights[0] || ""),
											strength: prev.strength || 1,
											framing: key,
										});
										cond.enabled = true;
										cond.default = key;
										_putCond(cond);
									};
									const _patchCur = (patch) => {
										const cond = normCond(d.cond);
										const key = cond.default || (_cKeys[0] || "closeup");
										cond.presets[key] = Object.assign({}, cond.presets[key] || {}, patch, { framing: key });
										cond.enabled = !!cond.presets[key].asset;
										cond.default = key;
										_putCond(cond);
									};

									return h("div", { style: { display: "flex", flexDirection: "column", gap: "2px", maxWidth: "860px", width: "100%", minHeight: 0, paddingBottom: "6px" } },
										h("div", { style: { fontWeight: 700, fontSize: "14px", color: "var(--c-fg)", marginBottom: "10px" } }, d.isNew ? "新建角色卡" : ("编辑「" + (d.name || "") + "」" + (d.builtin ? " · 内置卡" : ""))),
										h("div", { style: row }, h("span", { style: lab }, "名称"), h("input", { style: inp, value: d.name || "", placeholder: "例如：示例角色", onChange: (e) => set("name", e.target.value) })),
										h("div", { style: row }, h("span", { style: lab }, "角色 LoRA"),
										  h("select", { style: Object.assign({}, inp, { flex: "1 1 220px" }), value: String(d.lora || ""), onChange: (e) => set("lora", e.target.value), title: "插入这张卡时自动把它切到 LoRA 列表第一项" },
										    h("option", { value: "" }, "（不用 LoRA）"),
										    (function () {
										      const cur = String(d.lora || "");
										      const list = (loras || []).slice();
										      if (cur && list.indexOf(cur) < 0) list.unshift(cur);
										      return list.map((n) => h("option", { key: n, value: n }, (list.indexOf(n) === 0 && cur && (loras || []).indexOf(cur) < 0) ? (n + "（不在 LoRA 目录）") : n));
										    })()),
										  h("input", { style: Object.assign({}, inp, { flex: "0 0 76px" }), value: String(d.loraW || 0.7), onChange: (e) => set("loraW", Number(e.target.value) || 0.7), title: "LoRA 权重" }),
										  h("button", { style: CARD_BTN, onClick: () => loraImport(), title: "把 LoRA 文件导入 ComfyUI\\models\\loras（选文件上传，或填本机绝对路径）" }, "导入"),
										  h("button", { style: CARD_BTN, onClick: () => loraDelete(d.lora), title: "把选中的这支 LoRA 搬进 models\\loras\\_trash（可恢复）" }, "删除")),
										h("div", { style: row }, h("span", { style: lab }, "LLLite"),
										  h("select", {
										    style: Object.assign({}, inp, { flex: "1 1 240px" }),
										    value: _cCurAsset,
										    title: "选中即绑定：插入这张卡时自动挂上这张控制图，与「角色 LoRA」同级，不用每次手动加",
										    onChange: (e) => _setLllite(e.target.value),
										  },
										    h("option", { value: "" }, "（不绑定条件图）"),
										    (function () {
										      const list = _cAssets.slice();
										      if (_cCurAsset && list.indexOf(_cCurAsset) < 0) list.unshift(_cCurAsset);
										      return list.map((aid) => {
										        const a = _cTable[aid] || {};
										        const missing = !_cTable[aid];
										        return h("option", { key: aid, value: aid }, aid + (missing ? "（资产表里没有）" : " · " + (a.framing || "?") + " · " + (a.w || "?") + "×" + (a.h || "?")));
										      });
										    })()),
										  h("select", {
										    style: Object.assign({}, inp, { flex: "0 0 118px" }),
										    value: _cCurW,
										    title: "权重档（LLLite safetensors）",
										    onChange: (e) => _patchCur({ weights: e.target.value }),
										  }, _cWeights.length ? _cWeights.map((k) => h("option", { key: k, value: k }, k)) : h("option", { value: "" }, "（无）")),
										  h("input", {
										    style: Object.assign({}, inp, { flex: "0 0 64px" }),
										    value: String(_cCurS),
										    title: "条件强度：1.0 为准；超过 1.3 会把线稿笔触带进画面",
										    onChange: (e) => _patchCur({ strength: Number(e.target.value) || 1 }),
										  }),
										  h("button", {
										    style: CARD_BTN,
										    title: "按当前画布尺寸校验一遍：控制图/权重是否就位、framing 与宽高比是否匹配",
										    onClick: () => COND.check({ name: String(d.name || ""), id: String(d.id || ""), conditioning: normCond(d.cond) }, [Number(w), Number(hh)]),
										  }, "校验"),
										  h("button", {
										    style: CARD_BTN,
										    title: "把本地 PNG 线条稿导入控制图库（写到 _cond/ 并登记 assets.json），导入后自动绑到当前档",
										    onClick: () => { const el = document.getElementById("dsh-cond-import"); if (el) el.click(); },
										    // 也可以把 PNG 线条稿直接拖到这个按钮上
										    ...dropFileProps(["png"], async (good) => {
										      const f = good[0];
										      try {
										        const b64 = await new Promise((res, rej) => {
										          const fr = new FileReader();
										          fr.onload = () => res(String(fr.result || "").split(",")[1] || "");
										          fr.onerror = rej;
										          fr.readAsDataURL(f);
										        });
										        const r = await jpost(EXPANDER + "/lllite/assets/add", { name: f.name, b64: b64, framing: "closeup" }, 30000);
										        if (!r || !r.ok) { setMsg("导入失败：" + ((r && r.error) || "sidecar 没响应")); return; }
										        await loadLlllite();
										        _setLlllite(r.asset);
										        setMsg("已导入 " + r.asset + "（" + r.w + "×" + r.h + "，比例 " + r.ratio + "），并绑到当前档");
										      } catch (err) { setMsg("导入失败：" + errText(err)); }
										    }, { onReject: () => setMsg("拖错了：控制图只收 .png 线条稿") }),
										  }, "导入控制图"),
										  h("input", {
										    id: "dsh-cond-import", type: "file", accept: "image/png", style: { display: "none" },
										    onChange: async (e) => {
										      const f = e.target.files && e.target.files[0];
										      e.target.value = "";
										      if (!f) return;
										      try {
										        const b64 = await new Promise((res, rej) => {
										          const fr = new FileReader();
										          fr.onload = () => res(String(fr.result || "").split(",")[1] || "");
										          fr.onerror = rej;
										          fr.readAsDataURL(f);
										        });
										        const r = await jpost(EXPANDER + "/lllite/assets/add", { name: f.name, b64: b64, framing: "closeup" }, 30000);
										        if (!r || !r.ok) { setMsg("导入失败：" + ((r && r.error) || "sidecar 没响应")); return; }
										        await loadLlllite();
										        _setLlllite(r.asset);
										        setMsg("已导入 " + r.asset + "（" + r.w + "×" + r.h + "，比例 " + r.ratio + "），并绑到当前档");
										      } catch (err) { setMsg("导入失败：" + errText(err)); }
										    },
										  }),
										  h("span", { style: { fontSize: "11.5px", color: _chkColor, fontWeight: 600, maxWidth: "320px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: _chkText }, _chkText)),
										h("div", { style: { fontSize: "11.5px", color: "var(--c-fg4)", margin: "-4px 0 10px" } },
										  _cond.enabled
										    ? ("已绑定：" + (_cCurAsset || "（未选资产）") + " · " + (_cCurW || "无权重档") + " · 档位「" + (_cond.default || "-") + "」" + (_cKeys.length > 1 ? "（卡内另有 " + (_cKeys.length - 1) + " 档保留）" : "") + " ✓ 插入卡即自动挂上；生图时按画布比例校验，不匹配会在消息里明说")
										    : "未绑定条件图：插入只加标签与 LoRA（老卡行为）。选一张控制图，这张卡就自带身份约束。导入的线条稿按自身比例参与相称判定，比例不对会自动换档或明说。"),
										_chkNote ? h("div", { style: { fontSize: "11.5px", color: "var(--c-warn)", margin: "-6px 0 10px" } }, _chkNote) : null,
										h("div", { style: row }, h("span", { style: lab }, "触发词"), h("input", { style: inp, value: parts.trigger || "", placeholder: "一个词，例如 @mychar", onChange: (e) => setPart("trigger", e.target.value) })),
										h("div", { style: { fontSize: "12px", color: "var(--c-fg4)", margin: "2px 0 10px" } }, "胶囊显示的是中文备注 ✓ 点胶囊可同时改「中文备注」和「提示词本体」✓ Enter 确定 · Esc 取消 · ✕ 删除 · ＋ 添加 ✓ 保存时只把提示词本体按顺序拼成完整串"),
										mod("base", "基础"),
										mod("hair", "发型"),
										mod("eyes", "眼睛"),
																		mod("glasses", "眼镜 · 配饰"),
										mod("outfit", "服饰"),
										mod("extra", "其它"),
		h("div", { style: { fontWeight: 600, fontSize: "12px", color: "var(--c-fg2)", margin: "8px 0 4px" } }, "负面词条（插入时自动进「负面」提示词，用来稳住角色）"),
		mod("neg", "负面", true),
										h("div", { style: { fontSize: "12px", color: "var(--c-fg3)", margin: "4px 0 10px", wordBreak: "break-word" } }, "拼出来的完整提示词：" + (joinCardParts(parts) || "（空）")),
										        h("div", { style: row }, h("span", { style: lab }, "特征锁（" + locksArr.length + " 条）"),
          h("div", { style: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "6px" } },
            locksArr.map((L, i) => h("div", { key: "lk" + i, style: { display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" } },
              h("input", { style: Object.assign({}, inp, { flex: "0 0 92px" }), value: L.name || "", placeholder: "名称", title: "中文备注，仅显示用", onChange: (e) => setCardLock(i, { name: e.target.value }) }),
              h("input", { style: Object.assign({}, inp, { flex: "1 1 200px" }), value: (L.tags || []).join(", "), placeholder: "要锁住的词，逗号分隔（例：blonde hair, red eyes）", onChange: (e) => setCardLock(i, { tags: String(e.target.value).split(",").map((x) => x.trim()).filter(Boolean) }) }),
              h("select", { style: Object.assign({}, inp, { flex: "0 0 96px" }), value: L.scope || "full", title: "什么时候生效", onChange: (e) => setCardLock(i, { scope: e.target.value }) },
                h("option", { value: "full" }, "完整插入"),
                h("option", { value: "swap" }, "换装"),
                h("option", { value: "both" }, "两者")),
              h("button", { style: CARD_BTN, title: "删掉这条锁", onClick: () => delCardLock(i) }, "✕"))),
            h("div", { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
h("button", { style: CARD_BTN, onClick: addCardLock }, "＋ 新增特征锁"),
              h("span", { style: { fontSize: "11.5px", color: "var(--c-fg4)" } }, "每条锁干两件事：命中禁词就从正向剔进负向；生效时正向里有裙装就强制 black skirt。范围由「完整插入 / 换装 / 两者」决定")))),

        h("div", { style: row }, h("span", { style: lab }, "备注"), h("input", { style: inp, value: d.note || "", placeholder: "可选，例如：主角色 / 备用服装", onChange: (e) => set("note", e.target.value) })),
										h("div", { style: row }, h("span", { style: lab }, "封面"),
											h("div", { style: { width: "54px", height: "72px", borderRadius: "6px", overflow: "hidden", border: "1px solid rgba(var(--c-ink-rgb),.12)", flex: "none" } }, cardCoverBox(d, 72)),
											h("div", { style: { display: "flex", flexDirection: "column", gap: "6px", flex: 1 } },
												h("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap" } },
													h("label", Object.assign({ style: CARD_BTN },
														// 也可以把图片直接拖到这个按钮上
														dropFileProps(["png", "jpg", "jpeg", "webp", "gif"], (good) => dropCoverFile(good[0]),
															{ onReject: () => setMsg("拖错了：封面只收图片") })), "选择图片…",
														h("input", { type: "file", accept: "image/*", style: { display: "none" }, onChange: pickCoverFile })),
													(job && job.image) ? h("button", { style: CARD_BTN_ACCENT, onClick: () => applyCardCover(job.image, "已用最近一张出图当封面，并写入卡文件") }, "用最近一张出图") : null,
													h("button", { style: CARD_BTN, onClick: () => applyCardCover("") }, "清除封面")),
												h("input", { style: Object.assign({}, inp, { flex: "none" }), value: String(d.cover || "").indexOf("data:") === 0 ? "（本地图片，已压缩内嵌）" : (d.cover || ""), placeholder: "或粘贴图片地址 https://…", onChange: (e) => set("cover", e.target.value), onBlur: (e) => applyStyleCover(e.target.value) }))),
										h("div", { style: { display: "flex", gap: "8px", marginTop: "12px", alignItems: "center" } },
											h("div", { style: { fontWeight: 600, fontSize: "12px", color: "var(--c-fg2)", margin: "12px 0 4px" } }, "资产与迁移（可选 · 让这张卡能跨机器、跨底模活下去）")),
										h("div", { style: row }, h("span", { style: lab }, "底模"),
											h("input", { style: inp, value: _bmText, placeholder: "逗号分隔，例如 anima-aesthetic-v1.1.safetensors", onChange: (e) => { set("baseModelsText", e.target.value); setCardChk(null); } })),
										h("div", { style: { fontSize: "11.5px", color: "var(--c-fg4)", margin: "-4px 0 8px" } }, "写清这张卡是在哪个底模上调出来的。换机或换底模之后，点「自检」就能知道还能不能用。"),
										h("div", { style: row }, h("span", { style: lab }, "训练记录"),
											h("textarea", { style: Object.assign({}, inp, { minHeight: "46px", fontFamily: "Consolas, monospace", lineHeight: "1.45" }), value: _trText, placeholder: '{"steps":3000,"rank":64,"datasetHash":"..."}', onChange: (e) => { set("trainingText", e.target.value); setCardChk(null); } })),
										h("div", { style: row }, h("span", { style: lab }, "回归锚"),
											h("textarea", { style: Object.assign({}, inp, { minHeight: "46px", fontFamily: "Consolas, monospace", lineHeight: "1.45" }), value: _rgText, placeholder: '{"seeds":[20261014,20261018],"framing":"portrait"}', onChange: (e) => { set("regressionText", e.target.value); setCardChk(null); } })),
										h("div", { style: row }, h("span", { style: lab }, "自检"),
											h("div", { style: { flex: 1, minWidth: 0 } },
												h("button", { style: CARD_BTN, onClick: () => validateCardAssets(cardEdit, setCardChk) }, "校验底模与迁移信息"),
												cardChk ? h("div", { style: { fontSize: "11.5px", marginTop: "6px", whiteSpace: "pre-wrap", color: (cardChk.missingBaseModels && cardChk.missingBaseModels.length) ? "var(--c-bad)" : "var(--c-ok)" } },
													(cardChk.checked ? ((cardChk.missingBaseModels || []).length ? "缺失底模：" + cardChk.missingBaseModels.join(", ") : "底模齐全 ✓") : "ComfyUI 未启动，未校验底模") + ((cardChk.notes || []).length ? " ｜ " + (cardChk.notes || []).join(" ｜ ") : "")) : null)),
										h("div", { style: row }, h("span", { style: lab }, "跑回归"),
											h("div", { style: { flex: 1, minWidth: 0 } },
												h("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" } },
													h("button", { style: CARD_BTN, onClick: () => runRegression(cardEdit, "role"), title: "对这张卡的 regression.seeds 逐个出图；底模、尺寸、步数、CFG、采样品都取当前面板" }, REG.running ? ("回归中 " + REG.cur + "/" + REG.total + "…") : "跑回归锚"),
													REG.running ? h("button", { style: CARD_BTN, onClick: () => REG.stop() }, "停止") : null,
													h("span", { style: { fontSize: "11px", color: "var(--c-fg4)" } }, "同一套参数换 seed 逐个跑，结果留在下方（本机历史里也能查到）")),
												(REG.results && REG.results.length) ? h("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" } },
													REG.results.map((r, i) => h("div", { key: "rgres" + i, style: { width: "86px" } },
														r.image ? h("img", { src: r.image, style: { width: "86px", borderRadius: "6px", border: "1px solid rgba(var(--c-ink-rgb),.12)", display: "block" } }) : null,
														h("div", { style: { fontSize: "10.5px", marginTop: "2px", wordBreak: "break-all", color: r.ok === true ? "var(--c-ok)" : (r.ok === false ? "var(--c-bad)" : "var(--c-fg4)") } },
															"seed " + r.seed + (r.ok === true ? " ✓" : (r.ok === false ? " ✗ " + (r.error || "") : " 等待")))))) : null)),
										h("div", {
											style: {
												display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px",
												marginTop: "16px", padding: "10px 0 6px",
												borderTop: "1px solid rgba(var(--c-ink-rgb),.10)",
												flex: "0 0 auto", background: "var(--c-card)",
												flexShrink: 0,
											},
										},
											h("button", { style: Object.assign({}, CARD_BTN_ACCENT, { padding: "6px 20px", flexShrink: 0 }), onClick: saveCard, title: "保存这张卡（也可以按 Ctrl+Enter）" }, "保存"),
											h("button", { style: Object.assign({}, CARD_BTN, { flexShrink: 0 }), onClick: saveAsCard, title: "复制成一张新的角色卡，原卡保持不变" }, "另存为"),
											h("button", { style: Object.assign({}, CARD_BTN, { flexShrink: 0 }), onClick: () => exportCardPack([d], "role", "all"), title: "全量卡包：角色 LoRA + 两支 LLLite 权重 + 5 张控制图，对方解包即用（约 235 MB）" }, "导出全量卡包"),
											h("button", { style: Object.assign({}, CARD_BTN, { flexShrink: 0 }), onClick: () => revealCardFile("cards", d.file || ""), title: d.file ? ("在资源管理器里选中这张卡的 JSON：" + d.file) : "这张卡还没落盘（点保存才写进 cardsDir）—— 先打开角色卡目录" }, "打开文件位置"),
											h("button", { style: Object.assign({}, CARD_BTN, { flexShrink: 0 }), onClick: () => { setTagAt(""); setTagNote(""); setTagDraft(""); setCardEdit(null); setMsg("已取消"); } }, "取消"),
											(d.isNew || d.builtin) ? null : h("button", { style: Object.assign({}, CARD_BTN_DANGER, { flexShrink: 0 }), onClick: () => { const cc = cardEdit; setCardEdit(null); delCard(cc); } }, "删除这张"),
											h("span", { style: { fontSize: "11px", color: "var(--c-fg3)", flex: "1 1 160px", minWidth: 0 } }, "封面自动压缩到 ≤560px 存本地")));
								}

		/** 插入风格卡：core=false 全量；core=true 去掉「光影 / 其它」，方便试不同氛围 */
		function applyStyleInsert(c, core) {
		  const parts0 = (c.parts && typeof c.parts === "object") ? c.parts : null;
		  const _fromParts = parts0 ? joinStyleParts(parts0) : "";
		  const full = _fromParts.trim() || String(c.tags || "").trim();
		  let tags = full;
		  if (core) {
		    const pp = parts0 || splitStyleTags(full);
		    tags = joinStyleParts(Object.assign({}, pp, { light: [], extra: [] }));
		  }
		  const ng = normPart(c.neg).map((x) => String(x.t || "").trim()).filter(Boolean).join(", ");
		  const add = (cur, extra) => {
		    const have = new Set(String(cur || "").toLowerCase().split(",").map((x) => x.trim()).filter(Boolean));
		    const list = String(extra || "").split(",").map((x) => x.trim()).filter(Boolean).filter((t) => !have.has(t.toLowerCase()));
		    const base = String(cur || "").replace(/[\s,]+$/, "");
		    // 返回字段名与角色卡的 appendTags() 保持一致的形状，便于两处共用调用习惯
		    if (!list.length) return { t: base, n: 0, text: base, added: 0 };
		    return { t: base ? base + ", " + list.join(", ") : list.join(", "), n: list.length, text: base ? base + ", " + list.join(", ") : list.join(", "), added: list.length };
		  };
		  const _rp = add(String(pos || ""), tags);
		  const _rn = add(String(neg || ""), ng);
		  const np = _rp.n, nn = _rn.n;
		  setPos(_rp.t);
		  setNeg(_rn.t);
		  const chain = normStyleLoras(c);
		  const mk = (l) => ({ name: l.name, model: l.w, clip: l.w, src: "style" });
		  let loraMsg = "";
		  /* 多卡插入：不删任何已有 LoRA，新卡的链叠上去；同名只更新强度。
		     允许多张风格卡同时生效，各自可用「解除插入」单独撤。 */
		  if (chain.length) {
		    const list = (selLoras || []).filter(Boolean).map((x) => Object.assign({}, x));
		    const added = [];
		    for (const l of chain) {
		      const i = list.findIndex((x) => x && x.name === l.name);
		      if (i >= 0) list[i] = Object.assign({}, list[i], { model: l.w, clip: l.w, src: list[i].src || "style" });
		      else { list.push(mk(l)); added.push(shortLora(l.name) + " " + l.w); }
		    }
		    loraMsg = " · 多卡叠加：新增 " + (added.length ? added.join(" + ") : "0 个（都已存在，只更新强度）") + "，现有共 " + list.length + " 个 LoRA";
		    setSelLoras(list);
		  } else {
		    loraMsg = " · 这张卡没挂 LoRA，现有 LoRA 不动";
		  }
		  let metaMsg = "";
		  if (c.ckpt) {
		    if (!ckpts || !ckpts.length || ckpts.indexOf(c.ckpt) >= 0) { setCkpt(c.ckpt); metaMsg += " · 底模 " + shortLora(c.ckpt); }
		    else metaMsg += " · 底模 " + shortLora(c.ckpt) + "（本机没有，跳过）";
		  }
		  if (c.gen) {
		    const g = c.gen || {};
		    if (Number(g.w) > 0) setW(Number(g.w));
		    if (Number(g.h) > 0) setHh(Number(g.h));
		    if (Number(g.steps) > 0) setSteps(Number(g.steps));
		    if (Number(g.cfg) > 0) setCfg(Number(g.cfg));
		    if (g.sampler) setSampler(String(g.sampler));
		    if (g.scheduler) setScheduler(String(g.scheduler));
		    metaMsg += " · " + (Number(g.w) > 0 && Number(g.h) > 0 ? g.w + "×" + g.h : "") + (Number(g.steps) > 0 ? " / " + g.steps + " 步" : "") + (Number(g.cfg) > 0 ? " / CFG " + g.cfg : "") + (g.sampler ? " / " + g.sampler : "") + (g.scheduler ? " + " + g.scheduler : "");
		  }
		  /* 插入登记：只记差集，解除时按记录精确撤（不碰你原有的同名词） */
		  let _insErr = "";
		  try {
			const _sid = String(c.id || c.name || "");
			INSERTED.set(_sid, {
			  id: _sid, kind: "style", name: String(c.name || ""), core: !!core, direct: false,
			  posTokens: diffTokens(pos, _rp.t), negTokens: diffTokens(neg, _rn.t),   /* 0.7.130：add() 返回的是 {t,n}，原来读 .text 恒为 undefined → tokList 得空数组 → 差集永远 []，取消插入撤不掉任何词 */
			  loras: (chain || []).map((l) => ({ name: String(l.name), w: Number(l.w) })),
			  locks: [], cond: null,
			});
		  } catch (e) { _insErr = e && (e.message || String(e)); }
		  let _regMsg = "";
		  try {
		    const _k = String(c.id || c.name || "");
		    const _hit = INSERTED.get(_k);
		    _regMsg = " · 登记键=" + (_k || "(空)") + (_hit ? "（已登记）" : "（登记失败）")
		      + " · 词数 " + ((_hit && _hit.posTokens) ? _hit.posTokens.length : 0)
		      + " · 现有卡片 " + INSERTED.all().length + (_insErr ? " · 登记报错：" + _insErr : "");
		  } catch (e) { }
		  setMsg("已插入风格「" + c.name + "」" + (core ? "（核心画风）" : "") + " · 正向新增 " + np + " 条" + (ng ? " · 负面新增 " + nn + " 条" : "") + loraMsg + metaMsg + _regMsg + " · 再点这张卡可解除");
		  setStyleSel("");
		  setStyleMenu("");
		  setStyleSub("");
		}
		
		/** 风格卡封面：和角色卡同一套渐变/压缩逻辑 */
		function styleCoverOf(c) {
		  const u = (USER.styleCards || []).filter((x) => x && x.id === c.id)[0];
		  return (u && u.cover) || c.cover || "";
		}
		
		function newStyleCard() {
		  setStyleEdit({ id: "", name: "", note: "", cover: "", neg: [], isNew: true, parts: { trigger: "", style: [], line: [], color: [], light: [], extra: [] }, loras: [], ckpt: "", gen: {} });
		  setStyleSel("");
		}
		
		function editStyleCard(c) {
		  const u = (USER.styleCards || []).filter((x) => x && x.id === c.id)[0];
		  const parts = (u && u.parts) || splitStyleTags(c.tags);
		  setStyleEdit({ id: c.id, name: c.name || "", note: c.note || "", cover: styleCoverOf(c), neg: normPart(c.neg), parts: parts, loras: normStyleLoras(c), ckpt: String(c.ckpt || ""), gen: Object.assign({}, c.gen || {}), file: String((u && u.file) || c.file || ""), diskDir: String((u && u.diskDir) || c.diskDir || ""), isNew: false, builtin: !!c.builtin });
		}
		
		function delStyleCard(c) {
		  if (c.builtin) { setMsg("内置风格卡不能删除，可以点「编辑」改它的标签与封面"); return; }
		  if (!window.confirm("确定删除风格卡「" + c.name + "」？\n\n会同时从磁盘文件里删掉这张卡；文件里只剩它一个时，连文件一起删。")) return;
		  // 0.7.91：不再依赖记录上的 c.file —— 从 localStorage 恢复的老卡、导入未落盘的卡都没有这个字段，
		  // 那样只能删内存，而 mergeDiskStyle 是「磁盘为准」，同步一次就复活。
		  // 这里统一走「先按 name 去磁盘清单里找文件，再让侧车删」，file 有值也走同一条路，只有一处真相。
		  const nm = String(c.name || "").trim();
		  // 删除按钮传进来的是编辑器对象（editStyleCard 构造），历史版本里没有 file 字段 ——
		  // 所以先从 USER 里的真实记录取，取不到再按 name 去磁盘清单查。
		  const _real = (USER.styleCards || []).filter((x) => x && String(x.id || "") === String(c.id || ""))[0] || {};
		  const _file0 = String(c.file || _real.file || "").trim();
		  const dropLocal = () => {
		    USER.styleCards = (USER.styleCards || []).filter((x) => x && (x.id !== c.id || String(x.name || "").trim() !== nm));
		    saveUser();
		  };
		  const finish = (d) => {
		    dropLocal();
		    setMsg("已删除风格卡「" + nm + "」" + (d.deletedFile ? " · 文件已删除"
		      : (d.noop ? " · 文件早已不在" : " · 从文件移除 " + String(d.removed || 0) + " 张")));
		    repaintAll();
		  };
		  const del1 = (path) => fetch(EXPANDER + "/dir/del", {
		    method: "POST",
		    headers: Object.assign({ "Content-Type": "application/json" }, CONSOLE_HEADERS),
		    body: JSON.stringify({ kind: "style", path: path, name: nm, id: String(c.id || "") }),
		  }).then((r) => r.json()).then((d) => {
		    if (!d || !d.ok) throw new Error(String((d && d.error) || "侧车拒绝"));
		    return d;
		  });
		  const byName = () => fetch(EXPANDER + "/dir/list?kind=style", { headers: CONSOLE_HEADERS })
		    .then((r) => r.json())
		    .then((j) => {
		      const lst = j.cards || j.items || [];
		      const hit = lst.filter((x) => String((x && x.name) || "").trim() === nm)[0];
		      if (!hit) throw new Error("磁盘上没有同名卡文件");
		      return String(hit.__file || hit.file || "");
		    });
		  try { clientLog("delStyleCard", "name=" + nm + " file=" + (_file0 || "(空)") + " 有真实记录=" + (!!_real.file)); } catch (e) {}
		  Promise.resolve(_file0 || byName())
		    .then((path) => { if (!path) throw new Error("找不到对应文件"); return del1(path); })
		    .then(finish)
		    .catch((e) => {
		      dropLocal();
		      setMsg("已从面板删除「" + nm + "」，但磁盘没删掉：" + String((e && e.message) || e) + " —— 同步后会回来");
		      repaintAll();
		    });
		}
		
		function pickStyleCoverFile(e) {
		  const f = e && e.target && e.target.files && e.target.files[0];
		  if (!f) return;
		  if (!/^image\//.test(f.type || "")) { setMsg("只能选图片文件"); return; }
		  const rd = new FileReader();
		  rd.onload = () => {
		    const img = new Image();
		    img.onload = () => {
		      const MAX = 360;
		      const sc = Math.min(1, MAX / Math.max(img.width || 1, img.height || 1));
		      const w = Math.max(1, Math.round((img.width || MAX) * sc));
		      const hgt = Math.max(1, Math.round((img.height || MAX) * sc));
		      const cv = document.createElement("canvas");
		      cv.width = w; cv.height = hgt;
		      cv.getContext("2d").drawImage(img, 0, 0, w, hgt);
		      let url = "";
		      try { url = cv.toDataURL("image/jpeg", 0.82); } catch (err) { setMsg("图片转换失败：" + (err && err.message)); return; }
		      if (url.length > 180000) { setMsg("压缩后仍偏大（" + Math.round(url.length / 1024) + " KB > 176 KB），换张小点的图"); return; }
		      applyStyleCover(url, "封面已载入（" + w + "×" + hgt + "），已写入卡文件");
		    };
		    img.onerror = () => setMsg("这个文件读不出图片");
		    img.src = String(rd.result || "");
		  };
		  rd.onerror = () => setMsg("读取文件失败");
		  rd.readAsDataURL(f);
		}
		
		function saveStyleCard(asNew) {
		  const d = styleEdit || {};
		  const name = String(d.name || "").trim();
		  if (!name) { setMsg("卡名不能为空"); return; }
		  const parts = d.parts || {};
		  const tags = joinStyleParts(parts);
		  if (!tags) { setMsg("至少要填一个标签（触发词或任一模块）"); return; }
		  let nm = name;
		  if (asNew) {
		    nm = String(window.prompt("另存为新的风格卡，名称：", name + " 2") || "").trim();
		    if (!nm) return;
		  }
		  USER.styleCards = USER.styleCards || [];
		  const rec = { id: asNew ? ("s" + String(Date.now())) : (d.id || ("s" + String(Date.now()))), name: nm, tags: tags, note: String(d.note || "").trim(), cover: String(d.cover || ""), parts: parts, neg: normPart(d.neg), loras: normStyleLoras(d), ckpt: String(d.ckpt || ""), gen: Object.assign({}, d.gen || {}), baseModels: _styleBm(d), training: parseJsonField(d.trainingText, d.training), regression: parseJsonField(d.regressionText, d.regression) };
			  if (!asNew) { const i = USER.styleCards.findIndex((x) => x && x.id === rec.id); if (i >= 0) USER.styleCards[i] = rec; else USER.styleCards.push(rec); }
	  else USER.styleCards.push(rec);
	  saveUser();
	  dirWrite("style", rec, String(d.file || rec.file || "")).then((r) => {
	    if (r && r.ok) { rec.file = r.path; rec.fromDisk = true; saveUser(); }
	    else if (r && r.error) setMsg("风格卡已存面板，但写盘失败：" + r.error);
	  }).catch(() => { });
		  setStyleEdit(null);
		  setMsg((asNew ? "已另存为新卡「" : "已保存风格卡「") + nm + "」（" + tags.split(",").length + " 条）");
		}
		
		function exportAllStyleCards() {
		  const withBuiltin = !!window.confirm("导出时是否包含内置的 3 张风格卡？\n确定 = 包含，取消 = 只导自建卡");
  const src = (withBuiltin ? allStyleCards() : (USER.styleCards || [])).filter((c) => c && String(c.name || "").trim());
		  const cards = src.map((c) => ({ name: String(c.name || "").trim(), tags: String(c.tags || joinStyleParts(c.parts || {})).trim(), note: String(c.note || ""), cover: String(c.cover || ""), neg: normPart(c.neg), loras: normStyleLoras(c), ckpt: String(c.ckpt || ""), gen: Object.assign({}, c.gen || {}), baseModels: _styleBm(c), training: c.training || null, regression: c.regression || null, parts: (c.parts && typeof c.parts === "object") ? c.parts : splitStyleTags(String(c.tags || joinStyleParts(c.parts || {}))) })).filter((c) => c.tags);
		  if (!cards.length) { setMsg("还没有自建风格卡可导出（内置卡写在代码里）"); return; }
		  const obj = { version: 1, exportedAt: new Date().toISOString(), styleCards: cards };
		  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
		  const ok = downloadText(JSON.stringify(obj, null, 2), "风格卡-全部-" + cards.length + "张-" + day + ".json");
		  setMsg(ok ? ("已导出 " + cards.length + " 张风格卡" + (withBuiltin ? "（含内置）" : "")) : "导出失败：浏览器不允许下载");
		}
		
		function importStyleCards(e) {
  const f = e && e.target && e.target.files && e.target.files[0];
  try { if (e && e.target) e.target.value = ""; } catch (err) {}
  if (f) importStyleCardsFromFile(f);
}

function importStyleCardsFromFile(f) {
  if (!f) return;
  openCardFile(f, applyStyleImport);
}

/** 导出卡包：幂等打包当前卡（baked=完整导出 / hybrid=快速导出 / recipe=配方导出）
 *  逐支勾选通过「内嵌哪几支」文本输入完成；留空 = 默认半烘焙两支 */

/** 自包含卡导入后：把卡内嵌的控制图落到 _cond 并写 assets.json（侧车 /cards/import） */
function materializeEmbedded(list) {
  const withImg = (list || []).filter((c) => c && c.conditioning && Object.keys(c.conditioning.presets || {}).some((k) => (c.conditioning.presets[k] || {}).image && (c.conditioning.presets[k] || {}).image.b64));
  if (!withImg.length) return;
  withImg.forEach((c) => {
    jpost(EXPANDER + "/cards/import", { card: c }, 60000).then((r) => {
      if (r && r.ok) setMsg("控制图已还原 " + (r.written || []).length + " 张（跳过 " + (r.skipped || []).length + " 张已存在）" + (r.bad && r.bad.length ? " · " + r.bad.length + " 张 sha 不符" : ""));
      else setMsg("控制图还原失败：" + ((r && r.error) || "sidecar 没响应"));
    }).catch(() => setMsg("控制图还原失败：连不上 sidecar（8199）"));
  });
}

/** 导出自包含卡（单 .json）：控制图内嵌 base64、权重清单内嵌 sha256 */

function exportCardPack(cards, cardType, presetMode) {
  const list = (cards || []).filter((c) => c && c.name);
  if (!list.length) { setMsg("没有可导出的卡"); return; }
  let card = list[0];
  if (list.length > 1) {
    const pick = window.prompt("导出哪一张？\n" + list.map((c, i) => (i + 1) + ") " + c.name).join("\n"), "1");
    if (pick === null) return;
    const idx = parseInt(pick, 10);
    card = list[Number.isFinite(idx) && idx >= 1 && idx <= list.length ? idx - 1 : 0];
  }
  // 0.7.57：没有 LoRA 就没有权重可内嵌，先本地拦下（不要等侧车回 400 让人猜）
  const _ls = [].concat(
    (Array.isArray(card.loras) ? card.loras.map((l) => (l && l.name) || l) : []),
    card.lora ? [card.lora] : []
  ).map((x) => String(x || "").trim()).filter(Boolean);
  if (!_ls.length) {
    setMsg("这张卡没挂 LoRA，全量卡包没有权重可打包 —— 先挂一支 LoRA，或用「导出全部」只存 JSON（那个不内嵌权重）");
    return;
  }
  const packAll = (presetMode === "all");
  const embedLL = (presetMode === "full" || packAll);
  if (packAll) presetMode = "baked";
  else if (presetMode === "full") presetMode = "recipe";
  let mode = presetMode;
  if (!mode) {
    mode = (window.prompt("导出档位：baked=完整导出 / hybrid=快速导出 / recipe=配方导出", "hybrid") || "").trim().toLowerCase();
    if (!mode) return;
  }
  if (["baked", "hybrid", "recipe"].indexOf(mode) < 0) { setMsg("档位只能是 baked（完整导出）/ hybrid（快速导出）/ recipe（配方导出）"); return; }
  let embed = packAll ? [String(card.lora || "").replace(/^.*[\\/]/, "").replace(/\.safetensors$/i, "")].filter(Boolean) : [];
  if (mode === "hybrid" && !packAll) {
    const def = cardType === "role" ? String(card.lora || "").replace(/^.*[\\/]/, "").replace(/\.safetensors$/i, "") : "";
    const t = window.prompt("hybrid 内嵌哪几支（逗号分隔；留空 = 默认）\n默认：" + def, def);
    if (t === null) return;
    embed = t.split(",").map((x) => x.trim()).filter(Boolean).map((x) => x.replace(/^.*[\\/]/, "").replace(/\.safetensors$/i, ""));
  }
  // 0.7.89：编辑器里的卡用 `cond` 存身份控制，卡 JSON 里叫 `conditioning`。
  // 以前把编辑器记录原样丢给打包接口 → 侧车按 `conditioning` 找权重/控制图，一个都找不到，
  // 「导出全量卡包」实际只内嵌了 LoRA。这里先翻成卡形态，再顺手剔掉编辑器专用键。
  const cardForPack = (() => {
    const c = Object.assign({}, card);
    if (!c.conditioning && c.cond) {
      try { const cc = condForSave(c.cond); if (cc) c.conditioning = cc; } catch (e) { }
    }
    ["cond", "isNew", "builtin", "edit", "busy", "pendingDisk", "fromDisk", "diskDir", "__file"].forEach((k) => { delete c[k]; });
    return c;
  })();
  setMsg("正在打包「" + card.name + "」（" + (PACK_MODE_CN[mode] || mode) + "）…");
  const sendBody = { card: cardForPack, cardType: cardType || "style", mode: mode, embed: embed, embedPatches: embedLL, embedAssets: embedLL, toDisk: true };
  fetch(EXPANDER + "/stylecards/pack", {
    method: "POST",
    headers: Object.assign({ "Content-Type": "application/json" }, sidecarHeaders(EXPANDER)),
    body: JSON.stringify(sendBody),
  })
    .then((r) => {
      const ctype = String(r.headers.get("Content-Type") || "");
      if (!r.ok || ctype.indexOf("application/json") >= 0) {
        return r.json().then((j) => {
          if (!r.ok || !j || j.ok === false) throw new Error((j && (j.error || j.message)) || ("HTTP " + r.status));
          return { disk: j };
        });
      }
      let meta = {};
      try { meta = JSON.parse(r.headers.get("X-Card-Meta") || "{}"); } catch (e) {}
      return r.blob().then((b) => ({ b: b, meta: meta }));
    })
    .then((o) => {
      if (o.disk) {
        const un0 = o.disk.unresolved || [];
        setMsg("已导出到 " + o.disk.path + "（" + (o.disk.bytes / 1048576).toFixed(2) + " MB" + (o.disk.cover ? " · 含封面" : "") + "） 内嵌 " +
               (o.disk.embed || []).length + " 支 / 配方 " + (o.disk.refs || []).length + " 支" +
               (un0.length ? " ▸ " + un0.length + " 支本机没有权重（sha 为空）：" + un0.join("、") : ""));
        revealCardFile("pack", o.disk.path);
        return;
      }
      const safeName = (s) => String(s || "").replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, " ").trim() || "card";
      const name = safeName(o.meta.filename || (card.name + (mode === "recipe" ? ".dslrecipe" : ".dslcard")));
      const url = URL.createObjectURL(o.b);
      const a2 = document.createElement("a");
      a2.href = url; a2.download = name; a2.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      const un = o.meta.unresolved || [];
      setMsg("已导出 " + name + "（" + (PACK_MODE_CN[mode] || mode) + " · " + (o.b.size / 1048576).toFixed(2) + " MB） 内嵌 " +
             (o.meta.embed || []).length + " 支 / 配方 " + (o.meta.refs || []).length + " 支" +
             (un.length ? " ▸ " + un.length + " 支本机没有权重（sha 为空）：" + un.join("、") : ""));
    })
    .catch((e) => {
      const detail = (e && (e.name ? e.name + ": " : "") + (e.message || String(e))) || "未知错误";
      clientLog("exportCardPack", "card=" + String((card && card.name) || "") + " mode=" + mode + " err=" + detail);
      setMsg("导出失败（v" + CLIENT_VER + "）：" + detail + " —— 细节已写 client-err.log，另：若一直这样请确认侧车 8199 在线");
    });
}

/** 卡片容器（.dslcard / .dslrecipe）导入：三档统一走 sidecar 解析
 *  baked  全内嵌 → 全部落盘
 *  hybrid 半烘焙 → 内嵌件落盘，其余按 名字+sha256 本地解析
 *  recipe 配方 → 全部本地解析；缺件可就地一键下载（带 url 的） */
function importDslCard(f) { uploadCardPack(f, false); }

function uploadCardPack(f, auto) {
	// 0.7.72：改成 XHR —— 有上传/解析进度、有超时、侧车掉线/返回非 JSON 都会明确报错。
	// 旧版用 fetch 且只在 promise 链上挂 catch：请求一旦悬着（侧车重启、包太大卡住），
	// 界面就永远停在「正在解析…」，看不出是传文件慢还是侧车没回。
	const nm = String((f && f.name) || "卡包");
	const mb = Math.round(Number((f && f.size) || 0) / 1048576);
	const t0 = Date.now();
	let pct = 0, tick = null, done = false;
	const stop = () => { if (tick) { clearInterval(tick); tick = null; } };
	const fail = (why) => {
		if (done) return; done = true; stop();
		try { clientLog("uploadCardPack", "file=" + nm + " mb=" + mb + " err=" + why); } catch (e) { }
		setMsg("导入失败：" + why + "（v" + CLIENT_VER + "）");
	};
	const applyUnpack = (d) => {
		if (done) return; done = true; stop();
      if (!d || !d.ok) {
        clientLog("uploadCardPack", "resp ok=false err=" + ((d && d.error) || "unknown") + " type=" + ((d && d.cardType) || ""));
        setMsg("导入失败：" + ((d && d.error) || "未知错误") + "（v" + CLIENT_VER + "）");
        return;
      }
      const miss = d.missing || [], conf = d.conflicts || [], bm = d.baseMismatch || [], dd = d.dedup || [];
      const dl = miss.filter((m) => m.source && m.source.url);
      if (!auto && dl.length) {
        const lines = dl.map((m) => "  · " + m.name + "  " + m.size + " B  ← " + m.source.url).join("\n");
        if (window.confirm("缺 " + miss.length + " 支 LoRA，其中 " + dl.length + " 支有下载地址：\n" + lines + "\n\n现在自动下载并重试？")) {
          uploadCardPack(f, true); return;
        }
      }
      let finished = false;
      const finish = (list) => {
        // 0.7.78：.then(finish) 和 .catch(() => finish(null)) 都会调到这里，
        // 以前没有守卫 → 一次导入跑两遍（日志里同秒两条 applyCardImport、两次落盘）
        if (finished) return;
        finished = true;
        const healed = healCardLoras(d.card, list);
        if (d.cardType === "role") { applyCardImport(d.card); } else { applyStyleImport(d.card); }
        const modeCn = PACK_MODE_CN[d.mode] || d.mode || "未知档位";
        setImpRep({ f: f, d: d });
        const parts = ["已导入「" + d.card.name + "」（" + modeCn + "）"];
        if (d.count) parts.push("内嵌落盘 " + d.count + " 支");
        if (dd.length) parts.push("复用本机同名同内容 " + dd.length + " 支");
        if ((d.resolved || []).length) parts.push("本地解析 " + d.resolved.length + " 支");
        if (healed.length) parts.push("路径自愈 " + healed.length + " 支");
        if (miss.length) parts.push("缺 " + miss.length + " 支");
        if (conf.length) parts.push("同名不同内容 " + conf.length + " 支");
        if (bm.length) parts.push("底模不符 " + bm.length + " 支");
        parts.push("明细见右下角导入报告");
        setMsg(parts.join("；"));
        if (healed.length) console.warn("[卡片导入] 路径自愈（卡改名/目录变动）:", healed);
        if (miss.length) console.warn("[卡片导入] 缺失 LoRA:", miss);
        if (conf.length) console.warn("[卡片导入] 同名不同内容:", conf);
        if ((d.shadowed || []).length) console.warn("[卡片导入] 全局同名但内容不同，已另存一份:", d.shadowed);
      };
      fetch(COMFY + "/object_info/LoraLoader")
        .then((r) => r.json())
        .then((oi) => {
          let list = [];
          try { list = comboOptions(oi, "LoraLoader", "lora_name"); } catch (e) {}
          finish(list);
          try { if (window.__dshSetLoras) window.__dshSetLoras(list); } catch (e) {}
        })
        .catch(() => finish(null));
	};
	const xhr = new XMLHttpRequest();
	try { xhr.open("POST", EXPANDER + "/stylecards/unpack" + (auto ? "?auto=1" : ""), true); } catch (e) { fail("打不开请求：" + e); return; }
	const hdrs = Object.assign({ "Content-Type": "application/octet-stream" }, sidecarHeaders(EXPANDER));
	Object.keys(hdrs).forEach((k) => { try { xhr.setRequestHeader(k, hdrs[k]); } catch (e) { } });
	xhr.timeout = Math.max(180000, mb * 8000);          // 每秒 8MB 的余量，175MB 包 ≈ 23 分钟上限
	xhr.upload.onprogress = (e) => { if (e.lengthComputable) pct = Math.min(99, Math.round((e.loaded / e.total) * 100)); };
	xhr.onload = () => {
		if (xhr.status !== 200) { fail("侧车返回 HTTP " + xhr.status + "：" + String(xhr.responseText || "").slice(0, 160)); return; }
		let d = null;
		try { d = JSON.parse(String(xhr.responseText || "null")); } catch (e) { fail("侧车返回的不是 JSON：" + String(xhr.responseText || "").slice(0, 120)); return; }
		clientLog("uploadCardPack", "resp ok=" + (d && d.ok) + " type=" + (d && d.cardType) + " mode=" + (d && d.mode) +
			" name=" + ((d && d.card && d.card.name) || "") + " count=" + (d && d.count) + " err=" + ((d && d.error) || ""));
		applyUnpack(d);
	};
	xhr.onerror = () => fail("上传中断：连不上侧车 8199（侧车在重启？）");
	xhr.ontimeout = () => fail("超时 " + Math.round(xhr.timeout / 1000) + "s 没返回（包 " + mb + " MB）—— 先看 8199 是否在线，再点一次导入");
	xhr.onabort = () => fail("请求被取消");
	clientLog("uploadCardPack", "send file=" + nm + " mb=" + mb + " auto=" + (auto ? 1 : 0));
	setMsg("正在解析 " + nm + "（" + mb + " MB）…");
	tick = setInterval(() => {
		const sec = Math.round((Date.now() - t0) / 1000);
		setMsg("正在解析 " + nm + " · " + sec + "s" + (pct < 100 && pct > 0 ? " · 已传 " + pct + "%" : " · 侧车处理中") + "（v" + CLIENT_VER + "）");
	}, 1000);
	try { xhr.send(f); } catch (e) { fail("发不出去：" + e); }
}

/** 卡内 LoRA 路径自愈：卡被改名、或 _dshcards/<旧卡名>/ 被删之后，
 *  按文件名在本机现有 LoRA 列表里重新对上（优先全局同名，其次子目录里的）。
 *  返回 [{from, to}]；一个都对不上就保持原样，由 missing 标记兜底。 */
function healCardLoras(card, list) {
  const out = [];
  if (!card || !list || !list.length) return out;
  const baseOf = (p) => String(p || "").split(/[\\/]/).pop().toLowerCase();
  const byBase = {};
  for (const x of list) { const b = baseOf(x); (byBase[b] = byBase[b] || []).push(String(x)); }
  const resolve = (name) => {
    const n = String(name || "");
    if (!n) return "";
    if (list.some((x) => String(x) === n)) return n;
    const cands = byBase[baseOf(n)] || [];
    if (!cands.length) return "";
    const pref = cands.filter((x) => !/[\\/]_dshcards[\\/]/i.test(x));
    return pref.length ? pref[0] : cands[0];
  };
  const fix = (obj, key) => {
    const v = obj && obj[key];
    if (!v) return;
    const r = resolve(v);
    if (r && r !== v) { out.push({ from: String(v), to: r }); obj[key] = r; }
  };
  if (Array.isArray(card.loras)) for (const l of card.loras) fix(l, "name");
  if (card.lora) fix(card, "lora");
  return out;
}

/** 风格卡导入核心：按卡名覆盖（保留 id 与封面），带 parts 就不再重切模块 */
/** 导入报告：把侧车返回的 written / dedup / resolved / missing / conflicts / baseMismatch 全摊开
 *  导出侧已经把档位、sha、来源都摆出来了，导入侧不能只闪一行字 */
function importReportPanel() {
  const d = (impRep && impRep.d) || {};
  const card = d.card || {};
  const miss = d.missing || [], conf = d.conflicts || [], bm = d.baseMismatch || [];
  const dl = miss.filter((m) => m.source && m.source.url);
  const mb = (n) => (n ? (n / 1048576).toFixed(1) + " MB" : "—");
  const sh = (s) => (s ? String(s).slice(0, 12) : "—");
  const rowStyle = { display: "flex", gap: "6px", alignItems: "baseline", fontSize: "11.5px", color: "var(--c-fg2)", wordBreak: "break-all" };
  const dim = { marginLeft: "auto", flex: "none", color: "var(--c-fg4)" };
  const tag = (txt, bg) => h("span", { style: { flex: "none", fontSize: "10.5px", padding: "0 5px", borderRadius: "999px", background: bg || "rgba(var(--c-ink-rgb),.08)", color: "var(--c-fg)" } }, txt);
  const sec = (label, arr, render) => (arr && arr.length) ? h("div", { style: { marginTop: "8px" } },
    h("div", { style: { fontSize: "11.5px", fontWeight: 700, color: "var(--c-fg)", marginBottom: "3px" } }, label + " · " + arr.length + " 支"),
    h("div", { style: { display: "flex", flexDirection: "column", gap: "3px" } }, arr.map(render))) : null;
  const modeBg = d.mode === "baked" ? "rgba(29,78,216,.14)" : (d.mode === "hybrid" ? "rgba(217,119,6,.16)" : "rgba(5,150,105,.16)");
  return h("div", { style: { position: "fixed", right: "16px", bottom: "16px", width: "410px", maxHeight: "62vh", overflow: "auto", zIndex: 2147483000, background: "var(--c-card)", color: "var(--c-fg)", border: "1px solid rgba(var(--c-ink-rgb),.16)", borderRadius: "10px", boxShadow: "0 14px 40px rgba(var(--c-ink-rgb),.28)", padding: "10px 12px" } },
    h("div", { style: { display: "flex", alignItems: "center", gap: "6px" } },
      h("span", { style: { fontWeight: 700, fontSize: "13px" } }, "导入报告"),
      tag(PACK_MODE_CN[d.mode] || d.mode || "未知档位", modeBg),
      tag(d.cardType === "role" ? "角色卡" : "风格卡"),
      h("span", { style: { flex: 1 } }),
      h("button", { style: CARD_BTN, onClick: () => setImpRep(null) }, "关闭")),
    h("div", { style: { fontSize: "12.5px", marginTop: "5px", fontWeight: 600, wordBreak: "break-all" } }, card.name || "（无名卡）"),
    h("div", { style: { fontSize: "11px", color: "var(--c-fg3)", marginTop: "2px", wordBreak: "break-all" } }, "落盘目录：" + (d.dir || "—")),
    sec("内嵌落盘（包里带权重）", d.written, (w) => h("div", { key: "w" + w.name, style: rowStyle },
      tag(w.sha256_ok === false ? "sha 不符" : "写入", w.sha256_ok === false ? "rgba(185,28,28,.12)" : "rgba(29,78,216,.14)"), h("span", null, w.name),
      h("span", { style: dim }, mb(w.size) + " · sha " + sh(w.sha256)))),
    sec("复用本机同名同内容（零落盘）", d.dedup, (w) => h("div", { key: "d" + w.name, style: rowStyle },
      tag(w.reused === "global" ? "全局复用" : "复用", "rgba(5,150,105,.14)"), h("span", null, w.name),
      h("span", { style: dim }, mb(w.size) + " · sha " + sh(w.sha256)))),
    sec("本地解析（包里只有配方）", d.resolved, (w) => h("div", { key: "r" + w.name, style: rowStyle },
      tag(w.sha_ok ? "sha 命中" : "sha 未校验", w.sha_ok ? "rgba(5,150,105,.14)" : "rgba(217,119,6,.16)"),
      h("span", null, w.name), h("span", { style: dim }, mb(w.size)))),
    sec("缺件（本机没有，卡里已标记缺）", miss, (m) => h("div", { key: "m" + m.name, style: rowStyle },
      tag(((m.source && m.source.kind) || "未知来源"), "rgba(185,28,28,.12)"), h("span", null, m.name),
      h("span", { style: dim }, mb(m.size) + (m.source && m.source.url ? " · 有下载地址" : " · 无地址")))),
    sec("同名不同内容（已另存一份，不覆盖）", conf, (c2) => h("div", { key: "c" + c2.name, style: rowStyle },
      tag("冲突", "rgba(217,119,6,.16)"), h("span", null, c2.name),
      h("span", { style: dim }, "卡内 " + sh(c2.want_sha) + " / 本机 " + sh(c2.got_sha)))),
    sec("底模不符（卡要求的底模本机没有）", bm, (b) => h("div", { key: "b" + b.name, style: rowStyle },
      tag("底模", "rgba(185,28,28,.12)"), h("span", null, b.name))),
    sec("已另存（全局同名但内容不同）", d.shadowed, (s2) => h("div", { key: "s" + s2.name, style: rowStyle },
      tag("另存", "rgba(var(--c-ink-rgb),.08)"), h("span", null, s2.name))),
    dl.length ? h("button", {
      style: Object.assign({}, CARD_BTN_ACCENT, { marginTop: "10px", width: "100%" }),
      onClick: () => { const ff = impRep && impRep.f; setImpRep(null); if (ff) { uploadCardPack(ff, true); } },
    }, "自动下载缺件并重试（" + dl.length + " 支有地址）") : null);
}

function applyStyleImport(raw) {
  const list = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.styleCards) ? raw.styleCards : (raw && Array.isArray(raw.cards) ? raw.cards : (raw ? [raw] : [])));
  clientLog("applyStyleImport", "in=" + list.length + " 条 · 现有 " + ((USER.styleCards || []).length) + " 张");
  const ok = [];
  let added = 0, updated = 0;
  USER.styleCards = USER.styleCards || [];
  for (const c of list) {
    if (!c) continue;
    const nm = String(c.name || "").trim();
    if (!nm) continue;
    const tags = String(c.tags || joinStyleParts(c.parts || {})).trim();
    if (!tags) continue;
    const rec = { id: "s" + String(Date.now()) + "_" + ok.length, name: nm, tags: tags, note: String(c.note || ""), cover: String(c.cover || ""), parts: (c.parts && typeof c.parts === "object") ? c.parts : splitStyleTags(tags), neg: normPart(c.neg), loras: normStyleLoras(c), ckpt: String(c.ckpt || ""), gen: Object.assign({}, c.gen || {}), baseModels: (typeof _styleBm === "function" ? _styleBm(c) : (Array.isArray(c.baseModels) ? c.baseModels : [])), baseModelsText: (function () { const ok = (v) => { const s = String(v == null ? "" : v).trim(); return s && s.indexOf("<") < 0 && s.indexOf(">") < 0 ? s : ""; }; return ok(c.baseModelsText) || ok(c.ckpt) || ((Array.isArray(c.baseModels) && c.baseModels.length) ? ok(c.baseModels[0]) : "") || ""; })(), modelFamily: String(c.modelFamily || ""), training: c.training || null, regression: c.regression || null };
    const hit = USER.styleCards.findIndex((x) => x && String(x.name || "").trim() === nm);
    if (hit >= 0) { rec.id = USER.styleCards[hit].id; if (!rec.cover && USER.styleCards[hit].cover) rec.cover = USER.styleCards[hit].cover; USER.styleCards[hit] = rec; updated++; }
    else { USER.styleCards.push(rec); added++; }
    ok.push(rec);
  }
  if (!ok.length) { setMsg("没有可导入的风格卡（每条至少要有 name 与 tags）"); return; }
  saveUser();
  setMsg("已解析 " + ok.length + " 张风格卡：新增 " + added + "，覆盖 " + updated + "，正在落盘…");
  persistCards(ok, "style").then((r) => {
    if (r.ok) setMsg("已导入 " + ok.length + " 张风格卡（新增 " + added + "、覆盖 " + updated + "）· 落盘 " + r.ok + " 张到画风目录");
    else setMsg("导入失败：磁盘写不进去（" + (r.errors[0] || "未知原因") + "）—— 检查 config.json 的 cardsDir");
  });
}
		
		/** 风格卡卡片（与角色卡同款：封面 + 名称 + 条数 + 标签预览 + 插入 ▾ / 编辑） */
		/**
		 * 已插入卡片：统一的记录查询（风格卡 / 角色卡共用一份）
		 *
		 * 插入登记用的键是 String(c.id || c.name || "")。历史上还出现三种情况：
		 * 只用纯 id 存过的旧记录、没有 id 只有 name 的内置卡、卡改名后留下的老记录。
		 * 三档查询一次覆盖：
		 *   1) 组合键（与登记完全一致）  2) 纯 id（旧记录）  3) kind + 卡名反查
		 * 两处徽标、两处点击解除都走这里，口径不再各写一套。
		 */
		function insertedRecOf(c, kind) {
		  if (!c) return null;
		  const key = String(c.id || c.name || "");
		  return INSERTED.get(key)
		    || (c.id ? INSERTED.get(String(c.id)) : null)
		    || INSERTED.all().find((r) => r && r.kind === kind && String(r.name || "") === String(c.name || ""))
		    || null;
		}

		/** 已插入 / 部分移除 徽标：与卡片右上角那一列同款 */
		function insertedBadge(ins) {
		  if (!ins) return null;
		  return h("span", {
		    style: { fontSize: "11px", lineHeight: "16px", padding: "0 7px", borderRadius: "999px", color: "#fff",
		      background: ins.partial ? "rgba(200,140,30,.95)" : "rgba(45,105,225,.95)", boxShadow: "0 1px 4px rgba(0,0,0,.25)" },
		  }, ins.partial ? "部分移除" : "已插入");
		}

		function styleTile(c) {
		  /* 插入登记的键是 String(c.id || c.name || "")（见 applyStyleInsert 的 _sid）。
		     这里原来只用 c.id 查 —— 没有 id 的内置风格卡登记后永远查不到，
		     徽标就一直不显示「已插入」。取键必须与登记口径一致。 */
		  const _sk = String(c.id || c.name || "");
		  const on = String(styleSel || "") === _sk;
		  const ins = insertedRecOf(c, "style");
		  return h("div", { key: c.id || c.name, style: { display: "flex", flexDirection: "column", gap: "6px" } },
		    h("div", {
		      style: { position: "relative", borderRadius: "10px", overflow: "hidden", border: on ? "2px solid rgba(130,190,255,.95)" : (ins ? "2px solid " + (ins.partial ? "rgba(230,170,60,.95)" : "rgba(60,120,235,.95)") : "1px solid rgba(var(--c-ink-rgb),.14)"), background: "var(--c-panel)", cursor: "pointer" },
		      title: (c.tags || "") + (c.note ? "\n备注：" + c.note : ""),
		      onClick: () => { const _r = insertedRecOf(c, "style"); if (_r) { removeInserted(_r); return; } setStyleSel(on ? "" : _sk); },
		    },
		    cardCoverBox(c),
		    /* 右上角一列：插入状态（条件）在上、适配底模（always）在下，共用一个纵向容器免得互相压住 */
		    h("div", {
		      style: { position: "absolute", top: "6px", right: "6px", zIndex: 6, display: "flex",
		        flexDirection: "column", alignItems: "flex-end", gap: "4px",
		        maxWidth: "calc(100% - 12px)", pointerEvents: "none" },
		    },
		      insertedBadge(ins),
		      (() => { const b = bmBadge(c); return h("span", {
		        style: Object.assign({ maxWidth: "100%", fontSize: "10.5px", lineHeight: "15px", padding: "0 6px", borderRadius: "5px",
		          background: "rgba(10,10,12,.66)", color: "rgba(255,255,255,.92)",
		          border: "1px solid rgba(255,255,255,.16)", whiteSpace: "nowrap",
		          overflow: "hidden", textOverflow: "ellipsis", letterSpacing: ".2px" },
		          b.muted ? { background: "rgba(10,10,12,.42)", color: "rgba(255,255,255,.62)", borderStyle: "dashed" } : null),
		        title: b.full,
		      }, b.text); })(),
		    ),
		      h("div", { style: { padding: "8px 10px 10px" } },
		        h("div", { style: { display: "flex", alignItems: "baseline", gap: "6px" } },
		          h("span", { style: { fontWeight: 700, fontSize: "13px", color: "var(--c-fg)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: "1 1 auto", minWidth: 0 } }, c.name), c.packMode ? h("span", { style: { flex: "none", fontSize: "10px", padding: "0 4px", borderRadius: "999px", background: "rgba(29,78,216,.10)", color: "var(--c-accent)" }, title: "这张卡是从「" + (PACK_MODE_CN[c.packMode] || c.packMode) + "」卡包导入的" }, (PACK_MODE_CN[c.packMode] || c.packMode)) : null, 
		          null),
		        h("div", { style: { marginTop: "3px", fontSize: "12px", color: "var(--c-fg2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, c.tags || "（空）"))),
		    on ? h("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end", minWidth: 0 } },
		      h("div", { style: { position: "relative", flex: 1, display: "flex" } },
		        h("button", {
		          style: Object.assign({}, CARD_BTN_ACCENT, { flex: 1 }),
		          title: "完整 = 全部画风条目；核心 = 去掉光影/其它（去掉光影/其它）",
		          onClick: (e) => { if (e && e.stopPropagation) e.stopPropagation(); setStyleMenu(styleMenu === c.id ? "" : c.id); },
		        }, "插入 ▾"),
		        styleMenu === c.id ? h("div", {
		          style: { position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 60, minWidth: "206px", background: "var(--c-card)", border: "1px solid rgba(var(--c-ink-rgb),.18)", borderRadius: "8px", boxShadow: "0 10px 26px rgba(var(--c-ink-rgb),.18)", padding: "4px", display: "flex", flexDirection: "column", gap: "3px" },
		        },
		          h("button", { style: Object.assign({}, CARD_BTN_ACCENT, { textAlign: "left", padding: "6px 10px" }), title: "插入这张卡的全部画风条目。已有 LoRA 一个不删 —— 多张风格卡可同时生效，各自用「解除插入」单独撤", onClick: () => { applyStyleInsert(c, false); setStyleMenu(""); } }, "插入（全部画风）"),
		          h("button", { style: Object.assign({}, CARD_BTN, { textAlign: "left", padding: "6px 10px" }), title: "只插入画风/线条/上色，去掉光影与其它。已有 LoRA 不动", onClick: () => { applyStyleInsert(c, true); setStyleMenu(""); } }, "只插核心（去掉光影/其它）")
		        ) : null),h("button", { style: Object.assign({}, CARD_BTN, { flex: 1 }), onClick: () => { setStyleSel(""); editStyleCard(c); } }, "编辑")) : null);
		}
		
		/** 风格卡编辑器（与角色卡同一套：模块 → 中文备注胶囊） */
		function styleCardEditor() {
		  const d = styleEdit || {};
		  const parts = d.parts || {};
		  const _bmText = d.baseModelsText != null ? d.baseModelsText : ((Array.isArray(d.baseModels) && d.baseModels.length) ? d.baseModels.join(", ") : String(d.ckpt || ""));
		  const _trText = d.trainingText != null ? d.trainingText : (d.training ? JSON.stringify(d.training) : "");
		  const _rgText = d.regressionText != null ? d.regressionText : (d.regression ? JSON.stringify(d.regression) : "");
		  const set = (k, v) => setStyleEdit((p) => Object.assign({}, p, { [k]: v }));
		  const setPart = (k, v) => setStyleEdit((p) => Object.assign({}, p, { parts: Object.assign({}, (p || {}).parts || {}, { [k]: v }) }));
		  const row = { display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "9px", flexWrap: "wrap", flexShrink: 0 };
		  const lab = { width: "78px", fontSize: "12px", color: "var(--c-fg3)", paddingTop: "6px", flex: "none" };
		  const inp = { flex: 1, minWidth: 0, padding: "5px 8px", borderRadius: "6px", border: "1px solid rgba(var(--c-ink-rgb),.18)", background: "var(--c-card)", color: "var(--c-fg)", fontSize: "12px" };
		  const chipBox = { display: "flex", flexWrap: "wrap", gap: "6px", flex: 1, alignItems: "center", minHeight: "30px" };

		  const chip = { display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 7px", borderRadius: "4px", border: "1px solid rgba(var(--c-ink-rgb),.16)", background: "var(--c-panel2)", fontSize: "12px", cursor: "pointer" };
		  const chipX = { cursor: "pointer", color: "var(--c-bad)", padding: "0 1px", fontWeight: 700 };
		  const editBox = { display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px", borderRadius: "5px", border: "1px dashed rgba(29,78,216,.6)", background: "var(--c-accent-bg2)" };
		  const ciN = { width: "74px", padding: "3px 6px", borderRadius: "4px", border: "1px solid rgba(var(--c-ink-rgb),.16)", fontSize: "12px" };
		  const ciT = { width: "150px", padding: "3px 6px", borderRadius: "4px", border: "1px solid rgba(var(--c-ink-rgb),.16)", fontSize: "12px" };
		  const mini = Object.assign({}, CARD_BTN, { padding: "2px 8px", fontSize: "12px" });
		  const addBtn = Object.assign({}, CARD_BTN, { padding: "2px 9px", fontSize: "13px" });
		  const mod = (key, label, isNeg) => {
		    const arr = normPart(isNeg ? d.neg : parts[key]);
		    const put = (a) => { if (isNeg) set("neg", a); else setPart(key, a); setTagAt(""); setTagNote(""); setTagDraft(""); };
		    const commit = (i) => {
		      const t = tagDraft.trim(), n = tagNote.trim();
		      const next = arr.slice();
		      if (t || n) next[i] = { t: t, n: n }; else next.splice(i, 1);
		      put(next);
		    };
		    return h("div", { style: row, key: key },
		      h("span", { style: lab }, label),
		      h("div", { style: chipBox },
		        arr.map((x, i) => (tagAt === key + ":" + i
		          ? h("span", { key: "e" + i, style: editBox },
		            h("input", { autoFocus: true, style: ciN, value: tagNote, placeholder: "中文备注", onChange: (e) => setTagNote(e.target.value) }),
		            h("input", { style: ciT, value: tagDraft, placeholder: "提示词 tag", onChange: (e) => setTagDraft(e.target.value),
		              onKeyDown: (e) => { if (e.key === "Enter") commit(i); else if (e.key === "Escape") { setTagAt(""); setTagNote(""); setTagDraft(""); } } }),
		            h("button", { style: mini, onClick: () => commit(i) }, "确定"),
		            h("button", { style: mini, onClick: () => { const nx = arr.slice(); nx.splice(i, 1); put(nx); } }, "删除"))
		          : h("span", { key: "c" + i, style: chip, title: x.t || x.n || "", onClick: () => { setTagAt(key + ":" + i); setTagNote(x.n || ""); setTagDraft(x.t || ""); } },
		            (x.n || x.t || "（空）"),
		            h("span", { style: chipX, title: "删掉这一条", onClick: (e) => { if (e && e.stopPropagation) e.stopPropagation(); const nx = arr.slice(); nx.splice(i, 1); put(nx); } }, "×")))),
		        tagAt === key + ":new"
		          ? h("span", { key: "new", style: editBox },
		            h("input", { autoFocus: true, style: ciN, value: tagNote, placeholder: "中文备注", onChange: (e) => setTagNote(e.target.value) }),
		            h("input", { style: ciT, value: tagDraft, placeholder: "提示词 tag", onChange: (e) => setTagDraft(e.target.value),
		              onKeyDown: (e) => {
		                if (e.key === "Enter") { const t = tagDraft.trim(), n = tagNote.trim(); if (t || n) put(arr.concat([{ t: t, n: n }])); }
		                else if (e.key === "Escape") { setTagAt(""); setTagNote(""); setTagDraft(""); } } }),
		            h("button", { style: mini, onClick: () => { const t = tagDraft.trim(), n = tagNote.trim(); if (t || n) put(arr.concat([{ t: t, n: n }])); } }, "添加"),
		            h("button", { style: mini, onClick: () => { setTagAt(""); setTagNote(""); setTagDraft(""); } }, "取消"))
		          : h("button", { key: "add", style: addBtn, title: "加一条标签", onClick: () => { setTagAt(key + ":new"); setTagNote(""); setTagDraft(""); } }, "+")));
		  };
		  		  		  		  const gen = d.gen || {};
		  		  const setGen = (k, v) => setStyleEdit((p) => Object.assign({}, p, { gen: Object.assign({}, (p || {}).gen || {}, { [k]: v }) }));
const addLora = () => {
		    const nm = String(d.loraPick || "").trim();
		    if (!nm) { setMsg("先在下拉里选一个 LoRA"); return; }
		    const w = Number(d.loraW2) > 0 ? Number(d.loraW2) : 0.6;
		    const cur = (d.loras || []).filter((x) => x && x.name !== nm);
		    set("loras", cur.concat([{ name: nm, w: w }]));
		    set("loraPick", "");
		  };
		  return h("div", { style: { display: "flex", flexDirection: "column", gap: "2px", maxWidth: "860px", width: "100%", minHeight: 0, paddingBottom: "6px" } },
		    h("div", { style: { fontWeight: 700, fontSize: "14px", color: "var(--c-fg)", marginBottom: "10px" } }, d.isNew ? "新建风格卡" : ("编辑风格卡 · " + (d.name || ""))),
		    h("div", { style: row }, h("span", { style: lab }, "名称"), h("input", { style: inp, value: d.name || "", placeholder: "例如：干净线稿 · 平涂", onChange: (e) => set("name", e.target.value) })),
		    h("div", { style: row }, h("span", { style: lab }, "触发词"), h("input", { style: inp, value: parts.trigger || "", placeholder: "画师/风格触发词，一般放最前面（可空）", onChange: (e) => setPart("trigger", e.target.value) })),
		    h("div", { style: { fontSize: "12px", color: "var(--c-fg4)", margin: "2px 0 10px" } }, "胶囊显示中文备注 ✓ 点胶囊可同时改「中文备注」与「提示词 tag」✓ 点 + 加一条"),
		    		    		    		    h("div", { style: row }, h("span", { style: lab }, "底模"),
		    		      h("select", { style: Object.assign({}, inp, { flex: "1 1 300px" }), value: String(d.ckpt || ""), onChange: (e) => set("ckpt", e.target.value), title: "插入这张卡时顺带切底模（Anima 走 UNET，不是 checkpoint）" },
		    		        h("option", { value: "" }, "（不改底模）"),
		    		        (ckpts || []).map((n) => h("option", { key: n, value: n }, n))),
		    		      h("span", { style: { fontSize: "11px", color: "var(--c-fg4)" } }, "Anima 要 aesthetic / base 这类 UNET")),
		    		    h("div", { style: row }, h("span", { style: lab }, "出图参数"),
		    		      h("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap", flex: 1, alignItems: "center" } },
		    		        h("input", { style: Object.assign({}, inp, { flex: "0 0 64px" }), value: String(gen.w || ""), placeholder: "宽", title: "宽（px）", onChange: (e) => setGen("w", Number(e.target.value) || 0) }),
		    		        h("span", { style: { fontSize: "12px", color: "var(--c-fg3)" } }, "×"),
		    		        h("input", { style: Object.assign({}, inp, { flex: "0 0 64px" }), value: String(gen.h || ""), placeholder: "高", title: "高（px）", onChange: (e) => setGen("h", Number(e.target.value) || 0) }),
		    		        h("input", { style: Object.assign({}, inp, { flex: "0 0 56px" }), value: String(gen.steps || ""), placeholder: "步数", title: "采样步数", onChange: (e) => setGen("steps", Number(e.target.value) || 0) }),
		    		        h("input", { style: Object.assign({}, inp, { flex: "0 0 56px" }), value: String(gen.cfg || ""), placeholder: "CFG", title: "CFG", onChange: (e) => setGen("cfg", Number(e.target.value) || 0) }),
		    		        h("select", { style: Object.assign({}, inp, { flex: "0 0 150px" }), value: String(gen.sampler || ""), onChange: (e) => setGen("sampler", e.target.value), title: "采样器" },
		    		          h("option", { value: "" }, "（不改采样器）"),
		    		          (samplers || []).map((n) => h("option", { key: n, value: n }, n))),
		    		        h("select", { style: Object.assign({}, inp, { flex: "0 0 150px" }), value: String(gen.scheduler || ""), onChange: (e) => setGen("scheduler", e.target.value), title: "调度器" },
		    		          h("option", { value: "" }, "（不改调度器）"),
		    		          (schedulers || []).map((n) => h("option", { key: n, value: n }, n))))),
h("div", { style: row }, h("span", { style: lab }, "画风 LoRA"),
		      h("div", { style: { flex: 1, display: "flex", flexDirection: "column", gap: "6px" } },
		        h("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" } },
		          h("select", { style: Object.assign({}, inp, { flex: "1 1 260px" }), value: String(d.loraPick || ""), onChange: (e) => set("loraPick", e.target.value), title: "插入这张卡时自动把这些 LoRA 换到 LoRA 列；只替换上次由风格卡挂上的，角色 LoRA 不动" },
		            h("option", { value: "" }, "选一个画风 LoRA…"),
		            (loras || []).map((n) => h("option", { key: n, value: n }, n))),
		          h("input", { style: Object.assign({}, inp, { flex: "0 0 66px" }), value: String(d.loraW2 || 0.6), onChange: (e) => set("loraW2", Number(e.target.value) || 0.6), title: "强度" }),
		          h("button", { style: CARD_BTN, onClick: addLora }, "＋ 加入"),
		          h("button", { style: CARD_BTN, onClick: () => loraImport(), title: "把 LoRA 文件导入 ComfyUI\\models\\loras（选文件上传，或填本机绝对路径）" }, "导入"),
		          h("button", { style: CARD_BTN, onClick: () => loraDelete(d.loraPick), title: "把选中的这支 LoRA 搬进 models\\loras\\_trash（可恢复）" }, "删除")),
		        h("div", { style: { display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" } },
		          (d.loras || []).length
		            ? (d.loras || []).map((l, i) => h("span", { key: "lw" + i, style: Object.assign({}, chip, { cursor: "default" }), title: l.name },
		              shortLora(l.name),
		              h("input", { style: Object.assign({}, ciN, { width: "54px" }), value: String(l.w), onChange: (e) => { const a = (d.loras || []).slice(); a[i] = { name: l.name, w: Number(e.target.value) || 0.6 }; set("loras", a); } }),
		              h("span", { style: chipX, title: "移除这个 LoRA", onClick: () => set("loras", (d.loras || []).filter((x, j) => j !== i)) }, "×")))
		            : h("span", { style: { fontSize: "12px", color: "var(--c-fg4)" } }, "还没挂 LoRA（只插文字）")),
		        h("div", { style: { fontSize: "12px", color: "var(--c-fg4)" } }, "插入 = 把这张卡的全部画风条目追加进来，已有 LoRA 一个不删；多张风格卡可同时生效，各自用「解除插入」单独撤 · 触发词写最前 · 官方 LoRA 建议 0.35~0.5，自训 0.5~0.7"))),
h("div", { style: row }, h("span", { style: lab }, "比例"),
		      h("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap", flex: 1, alignItems: "center" } },
		        h("select", {
		          style: Object.assign({}, inp, { flex: "0 0 170px" }),
		          value: String((parts.proportion || {}).preset || "none"),
		          title: "插入这张卡时按这个比例注入头身比词",
		          onChange: function (e) {
		            var cur = parts.proportion || {};
		            setPart("proportion", { preset: e.target.value, custom: String(cur.custom || "") });
		          },
		        }, PROPORTION_PRESETS.map(function (pv) { return h("option", { key: pv[0], value: pv[0] }, pv[1]); })),
		        String((parts.proportion || {}).preset || "none") === "custom"
		          ? h("input", {
		              style: Object.assign({}, inp, { flex: "1 1 260px" }),
		              value: String((parts.proportion || {}).custom || ""),
		              placeholder: "自定义头身比词，逗号分隔",
		              onChange: function (e) { setPart("proportion", { preset: "custom", custom: e.target.value }); },
		            })
		          : h("span", { style: { fontSize: "12px", color: "var(--c-fg4)", flex: "1 1 220px" } },
		              "插入时注入：" + (proportionTags(parts.proportion) || "（不注入）")))),
mod("style", "画风"),
		    mod("line", "线条"),
		    mod("color", "上色"),
		    mod("light", "光影"),
		    mod("extra", "其它"),
		    h("div", { style: { fontWeight: 600, fontSize: "12px", color: "var(--c-fg2)", margin: "8px 0 4px" } }, "负面词条（插入时自动进「负面」提示词）"),
		    mod("neg", "负面", true),
		    h("div", { style: { fontSize: "12px", color: "var(--c-fg3)", margin: "4px 0 10px", wordBreak: "break-word" } }, "拼出来的风格串：" + (joinStyleParts(parts) || "（空）")),
		    h("div", { style: row }, h("span", { style: lab }, "备注"), h("input", { style: inp, value: d.note || "", placeholder: "这张卡适合什么场景", onChange: (e) => set("note", e.target.value) })),
		    h("div", { style: row }, h("span", { style: lab }, "底模"),
		      h("input", { style: inp, value: _bmText, placeholder: "这张画风依赖的底模，逗号分隔", onChange: (e) => set("baseModelsText", e.target.value) })),
		    h("div", { style: row }, h("span", { style: lab }, "训练记录"),
		      h("textarea", { style: Object.assign({}, inp, { minHeight: "46px", fontFamily: "Consolas, monospace", lineHeight: "1.45" }), value: _trText, placeholder: '{"dataset":"…","steps":3000,"lr":0.0001,"note":"…"}', onChange: (e) => set("trainingText", e.target.value) })),
		    h("div", { style: row }, h("span", { style: lab }, "回归锚"),
		      h("textarea", { style: Object.assign({}, inp, { minHeight: "46px", fontFamily: "Consolas, monospace", lineHeight: "1.45" }), value: _rgText, placeholder: '{"seeds":[20261014,20261018]}', onChange: (e) => set("regressionText", e.target.value) })),
		    h("div", { style: row }, h("span", { style: lab }, "自检"),
		      h("div", { style: { flex: 1, minWidth: 0 } },
		        h("button", { style: CARD_BTN, onClick: () => validateCardAssets(styleEdit || {}, setStyChk) }, "校验底模与迁移信息"),
		        styChk ? h("div", { style: { fontSize: "11.5px", marginTop: "6px", whiteSpace: "pre-wrap", color: ((styChk.missingBaseModels || []).length) ? "var(--c-bad)" : "var(--c-ok)" } },
		          (styChk.checked ? ((styChk.missingBaseModels || []).length ? "缺失底模：" + styChk.missingBaseModels.join(", ") : "底模齐全 ✓") : "ComfyUI 未启动，未校验底模") + ((styChk.notes || []).length ? " ｜ " + (styChk.notes || []).join(" ｜ ") : "")) : null)),
		    h("div", { style: row }, h("span", { style: lab }, "回归锚跑批"),
		      h("div", { style: { flex: 1, minWidth: 0 } },
		        h("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" } },
		          h("button", { style: CARD_BTN, onClick: () => runRegression(styleEdit || {}, "style"), title: "对这张风格卡的 regression.seeds 逐个出图；参数取当前面板" }, REG.running ? ("回归中 " + REG.cur + "/" + REG.total + "…") : "跑回归锚"),
		          REG.running ? h("button", { style: CARD_BTN, onClick: () => REG.stop() }, "停止") : null),
		        (REG.results && REG.results.length) ? h("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" } },
		          REG.results.map((r, i) => h("div", { key: "srg" + i, style: { width: "86px" } },
		            r.image ? h("img", { src: r.image, style: { width: "86px", borderRadius: "6px", border: "1px solid rgba(var(--c-ink-rgb),.12)", display: "block" } }) : null,
		            h("div", { style: { fontSize: "10.5px", marginTop: "2px", wordBreak: "break-all", color: r.ok === true ? "var(--c-ok)" : (r.ok === false ? "var(--c-bad)" : "var(--c-fg4)") } },
		              "seed " + r.seed + (r.ok === true ? " ✓" : (r.ok === false ? " ✗ " + (r.error || "") : " 等待")))))) : null)),
		    h("div", { style: row }, h("span", { style: lab }, "封面"),
		      h("div", { style: { width: "54px", height: "72px", borderRadius: "6px", overflow: "hidden", border: "1px solid rgba(var(--c-ink-rgb),.14)", flex: "none" } }, cardCoverBox(Object.assign({}, d, { name: d.name || "?" }), 72)),
		      h("div", { style: { display: "flex", flexDirection: "column", gap: "6px", flex: 1 } },
		        h("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap" } },
		          h("label", Object.assign({ style: CARD_BTN },
		            // 也可以把图片直接拖到这个按钮上
		            dropFileProps(["png", "jpg", "jpeg", "webp", "gif"], (good) => dropStyleCoverFile(good[0]),
		              { onReject: () => setMsg("拖错了：封面只收图片") })), "选择图片…",
		            h("input", { type: "file", accept: "image/*", style: { display: "none" }, onChange: pickStyleCoverFile })),
		          (job && job.image) ? h("button", { style: CARD_BTN_ACCENT, onClick: () => applyStyleCover(job.image, "封面已用最近一张出图，并写入卡文件") }, "用最近一张出图") : null,
		          h("button", { style: CARD_BTN, onClick: () => applyStyleCover("") }, "清除封面")),
		        h("input", { style: Object.assign({}, inp, { flex: "none" }), value: String(d.cover || "").indexOf("data:") === 0 ? "（本地上传的图片）" : String(d.cover || ""), placeholder: "也可以贴图片 URL", onChange: (e) => set("cover", e.target.value), onBlur: (e) => applyCardCover(e.target.value) }))),
		    h("div", {
		      style: {
		        display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px",
		        marginTop: "16px", padding: "10px 0 6px",
		        borderTop: "1px solid rgba(var(--c-ink-rgb),.10)",
		        flex: "0 0 auto", background: "var(--c-card)",
		        flexShrink: 0,
		      },
		    },
		      h("button", { style: Object.assign({}, CARD_BTN_ACCENT, { padding: "6px 20px", flexShrink: 0 }), onClick: () => saveStyleCard(false) }, "保存"),
		      h("button", { style: Object.assign({}, CARD_BTN, { flexShrink: 0 }), onClick: () => saveStyleCard(true), title: "复制成一张新的风格卡，原卡不变" }, "另存为"),
		      h("button", { style: Object.assign({}, CARD_BTN, { flexShrink: 0 }), onClick: () => exportCardPack([d], "style", "baked"), title: "全量卡包：风格 LoRA 与相关权重全部内嵌，对方解包即用" }, "导出全量卡包"),
		h("button", { style: Object.assign({}, CARD_BTN, { flexShrink: 0 }), onClick: () => revealCardFile("style", ""), title: "风格卡存在浏览器本地；这里打开导出的 .json / .dslcard 卡包该放的目录（本地绘画\画风）" }, "打开文件位置"),
		      h("button", { style: Object.assign({}, CARD_BTN, { flexShrink: 0 }), onClick: () => { setTagAt(""); setTagNote(""); setTagDraft(""); setStyleEdit(null); } }, "取消"),
		      (d.isNew || d.builtin) ? null : h("button", { style: Object.assign({}, CARD_BTN_DANGER, { flexShrink: 0 }), onClick: () => { const cc = styleEdit; setStyleEdit(null); delStyleCard(cc); } }, "删除这张"),
		      h("span", { style: { fontSize: "11px", color: "var(--c-fg3)", flex: "1 1 160px", minWidth: 0 } }, "封面自动压缩到 ≤560px 存本地")));
		}
		
		/** 风格卡页：与角色卡同一套布局 */
		function styleCardTab() {
		  if (styleEdit) return styleCardEditor();
		  const cards = allStyleCards();
		  const nB = cards.filter((c) => c.builtin).length;
		  return h("div", { style: { display: "flex", flexDirection: "column", gap: "14px", padding: "4px 2px", width: "100%" } },
		    h("div", { style: { display: "flex", alignItems: "center", gap: "10px" } },
		      h("span", { style: { fontWeight: 700, fontSize: "15px", color: "var(--c-fg)" } }, "风格卡"),
		      h("span", { style: { fontSize: "12px", color: "var(--c-fg3)" } }, cards.length + " 张 · 内置 " + nB + " · 自建 " + (cards.length - nB)),
		      h("span", { style: { fontSize: "12px", fontWeight: 700, color: "var(--c-accent)" }, title: "INSERTED 登记表里的记录数。为 0 而词已进提示词 = 插入了但没登记；不为 0 而卡片没徽标 = 登记了但徽标没渲染" }, "· 已插入 " + INSERTED.all().length + " 张（风格 " + INSERTED.all().filter((r) => r && r.kind === "style").length + " / 角色 " + INSERTED.all().filter((r) => r && r.kind === "char").length + "）"),
		      h("span", { style: { flex: 1 } }),
		      h("button", { style: CARD_BTN, onClick: exportAllStyleCards, title: "把自建风格卡全部导出成一个 .json" }, "导出全部"),
		      h("label", { style: Object.assign({}, CARD_BTN, { display: "inline-flex", alignItems: "center" }), title: "从 .json / .dslcard / .dslrecipe 导入风格卡" }, "导入", h("input", { type: "file", accept: ".json,.dslcard,.dslrecipe,application/json,application/octet-stream", style: { display: "none" }, onChange: importStyleCards })),
		h("button", { style: CARD_BTN, onClick: () => revealCardFile("style", ""), title: "在资源管理器里打开风格卡导出目录（本地绘画\画风）" }, "打开文件夹"),
		      h("button", { style: CARD_BTN_ACCENT, onClick: () => syncKindFromDisk("style", { force: true }), title: "重新读 本地绘画\\画风：目录里删掉的文件，面板上对应的卡也消失" }, "同步目录"),
			h("button", { style: CARD_BTN, onClick: () => dirClear("style", "风格卡"), title: "把 画风 目录整包搬到 _清空备份，并清空面板（可逆）" }, "清空"),
			h("button", { style: CARD_BTN, onClick: newStyleCard }, "+ 新建")),
		    cards.length
		      ? h("div", Object.assign({ style: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: "14px" } }, dropJsonProps(importStyleCardsFromFile)), cards.map((c) => styleTile(c)))
		      : h("div", { style: { padding: "32px", textAlign: "center", fontSize: "13px", color: "var(--c-fg3)", border: "1px dashed rgba(var(--c-ink-rgb),.12)", borderRadius: "10px" } }, "还没有风格卡，点右上角「+ 新建」"),
		    h("div", { style: { fontSize: "12px", color: "var(--c-fg3)" } }, "点卡片 = 选中 · 「插入 ▾」两个动作：插入（全部画风）/ 只插核心（去掉光影与其它）· 多张卡可同时插、互不清空 · 提示词都追加到末尾、自动去重 · 封面可自定义 · 可导入导出，也可直接拖 .json / .dslcard / .dslrecipe 到卡片区"));
		}
		
		
		/** 插入角色卡：**追加**到正向/负面末尾（自动去重，不清空已有内容）
		 *  withOutfit=false 时把「服饰」模块剥掉，只插角色本体，方便同一个角色换不同衣服试 */
		function applyCardInsert(c, withOutfit) {
		  const parts0 = (c.parts && typeof c.parts === "object") ? c.parts : null;
		  /* 0.7.130：原来 tags 优先。tags 是落盘缓存、parts 才是编辑真相，两者不同步时
		     （比如老卡 parts 里有 proportion 但 tags 没重算）插入会静默丢掉整段词，
		     表现就是「同样提示词换张角色卡，头身比和透视全变了」。改为 parts 优先、tags 兜底。 */
		  const _fromParts = parts0 ? joinCardParts(parts0) : "";
		  const full = _fromParts.trim() || String(c.tags || "").trim();
		  let tags = full;
		  if (!withOutfit) {
		    const parts = parts0 || splitCardTags(full);
		    tags = joinCardParts(Object.assign({}, parts, { outfit: [] }));
		  }
		  let ng = normPart(c.neg).map((x) => String(x.t || "").trim()).filter(Boolean).join(", ");
  let lockHit = [];
  // 特征锁：卡片自定义禁词，按 scope 决定完整插入 / 换装 / 两者
  const _scope = withOutfit ? ["full", "both"] : ["swap", "both"];
  const _allLocks = normLocks(Array.isArray(c.locks) ? c.locks : []);   // 插入只认卡里现有的锁，不再擅自补三道锁
  const _locks = _allLocks.filter((L) => L && Array.isArray(L.tags) && L.tags.length && _scope.indexOf(L.scope || "full") >= 0);
  for (const L of _locks) {
    const r = applyTagLocks(tags, ng, L.tags, L.allow);
    tags = r.pos; ng = r.neg; lockHit = lockHit.concat(r.hit);
  }
		  /** 把 extra 追加到 cur 末尾：去重（不区分大小写）、不吃掉已有内容 */
		  const appendTags = (cur, extra) => {
		    const have = new Set(String(cur || "").toLowerCase().split(",").map((x) => x.trim()).filter(Boolean));
		    const add = String(extra || "").split(",").map((x) => x.trim()).filter(Boolean).filter((t) => !have.has(t.toLowerCase()));
		    const base = String(cur || "").replace(/[\s,]+$/, "");
		    if (!add.length) return { text: base, added: 0 };
		    return { text: base ? base + ", " + add.join(", ") : add.join(", "), added: add.length };
		  };
		  const _rp2 = appendTags(String(pos || ""), tags);
		  const _rn2 = appendTags(String(neg || ""), ng);
		  const addedPos = _rp2.added, addedNeg = _rn2.added;
		  setPos(_rp2.text);
		  setNeg(_rn2.text);
		  if (c.lora) {
		    setSelLoras((cur) => {
		      const wgt = Number(c.loraW) > 0 ? Number(c.loraW) : 0.7;
		      return [{ name: c.lora, model: wgt, clip: wgt }].concat((cur || []).filter((x) => x && x.name !== c.lora));
		    });
		  }
		  lockCards = lockCards.filter((x) => x.id !== (c.id || c.name)).concat([{ id: c.id || c.name, lora: c.lora || "", locks: _allLocks }]);
		  // 身份控制：与 LoRA 同构——卡若声明 conditioning，插入即自动解析条件图 + 权重档
		  if (c.conditioning && c.conditioning.enabled) COND.resolve(c, [Number(w), Number(hh)]);
		  /* 插入登记：只记差集；卡片蓝框、解除、多角色计数都靠它 */
		  try {
			const _cid = String(c.id || c.name || "");
			const _cpick = (c.conditioning && c.conditioning.enabled) ? COND.pickOf(c, Object.keys(c.conditioning.presets || {})) : "";
			INSERTED.set(_cid, {
			  id: _cid, kind: "char", name: String(c.name || ""), mode: withOutfit ? "full" : "noOutfit",
			  posTokens: diffTokens(pos, _rp2.text), negTokens: diffTokens(neg, _rn2.text),
			  loras: c.lora ? [{ name: String(c.lora), w: Number(c.loraW) > 0 ? Number(c.loraW) : 0.7 }] : [],
			  locks: [{ id: _cid, lora: c.lora || "", locks: _allLocks }],
			  cond: _cpick ? { name: String(c.name || ""), preset: _cpick } : null,
			});
		  } catch (e) { }
  let _regMsg = "";
  try {
    const _k = String(c.id || c.name || "");
    const _hit = INSERTED.get(_k);
    _regMsg = " · 登记键=" + (_k || "(空)") + (_hit ? "（已登记）" : "（登记失败）")
      + " · 词数 " + ((_hit && _hit.posTokens) ? _hit.posTokens.length : 0)
      + " · 现有卡片 " + INSERTED.all().length;
  } catch (e) { }
  setMsg("已追加「" + c.name + "」" + (withOutfit ? "（完整）" : "（不含服饰）") + " · 正向新增 " + addedPos + " 条" + (ng ? " · 负面新增 " + addedNeg + " 条" : "") + (lockHit.length ? " · 三道锁剔 " + lockHit.length + " 条→负向" : "") + (c.lora ? " · LoRA 已切到 " + c.lora : "") + (c.conditioning && c.conditioning.enabled ? " · 条件图解析中…" : "") + _regMsg);
		  setCardSel("");
		  setInsMenu("");
		}

/** 特征锁：卡片自定义的禁词表。tag 与锁词精确相等、或以「锁词 + 空格」开头才算命中
 *  allow：同一张卡声明的放行短语，先按整短语豁免，再判锁（否则 trench coat 会吃掉 beige long trench coat）
 *  返回 { pos, neg, hit, allowed }：命中词从正向剔除并追加到负向 */
function applyTagLocks(tags, negText, words, allow) {
  const ws = (words || []).map((x) => String(x || "").trim().toLowerCase()).filter(Boolean);
  const as = (allow || []).map((x) => String(x || "").trim().toLowerCase()).filter(Boolean);
  if (!ws.length) return { pos: String(tags || ""), neg: String(negText || ""), hit: [], allowed: [] };
  const list = String(tags || "").split(",").map((x) => x.trim()).filter(Boolean);
  const isAllowed = (t) => { const s = t.toLowerCase(); return as.some((a) => s === a || s.indexOf(a + " ") === 0); };
  const isHit = (t) => { const s = t.toLowerCase(); return ws.some((w) => s === w || s.indexOf(w + " ") === 0); };
  const allowed = list.filter(isAllowed);
  const hit = list.filter((t) => !isAllowed(t) && isHit(t));
  const pos = list.filter((t) => !(!isAllowed(t) && isHit(t))).join(", ");
  let neg = String(negText || "");
  if (hit.length) neg = mergeTags(neg, hit.join(", "));
  return { pos: pos, neg: neg, hit: hit, allowed: allowed };
}

/** 生图前稳定角色特征：把「已插入的角色卡」的锁套到最终正向/负向上
 *  - scope=swap 的锁只管「换装插入」那一刻，生图时不参与
 *  - 命中词从正向剔进负向；有锁生效且出现裙装 → 补 black skirt
 *  返回 { pos, neg, moved }：moved = 被移进负向的词数 */
function stabilizePrompt(text, negText, cards) {
  let pos = String(text || "");
  let neg = String(negText || "");
  const applied = [];
  let moved = 0;
  for (const c of (cards || [])) {
    for (const L of normLocks(c && c.locks)) {
      if ((L.scope || "full") === "swap") continue;
      applied.push(L);
      const r = applyTagLocks(pos, neg, L.tags, L.allow);
      pos = r.pos; neg = r.neg; moved += r.hit.length;
    }
  }
  return { pos: pos, neg: neg, moved: moved + (pos !== String(text || "") && !moved ? 1 : 0), locks: applied.length };
}

	function cardTile(c) {
				const on = cardSel === c.id;
				const ins = insertedRecOf(c, "char");
		return h("div", { key: c.id || c.name, style: { display: "flex", flexDirection: "column", gap: "6px" } },
			h("div", {
				style: { position: "relative", borderRadius: "10px", overflow: "hidden", border: on ? "2px solid rgba(130,190,255,.95)" : (ins ? "2px solid " + (ins.partial ? "rgba(230,170,60,.95)" : "rgba(60,120,235,.95)") : "1px solid rgba(var(--c-ink-rgb),.14)"), background: "rgba(var(--c-ink-rgb),.05)", cursor: "pointer" },
				title: (c.tags || "") + (c.note ? "\n备注：" + c.note : ""),
				onClick: () => { const _r = insertedRecOf(c, "char"); if (_r) { removeInserted(_r); return; } setCardSel(on ? "" : String(c.id || c.name)); },
			},
			cardCoverBox(c),
			/* 右上角一列：插入状态（条件）在上、适配底模（always）在下，和风格卡同款 */
			h("div", {
				style: { position: "absolute", top: "6px", right: "6px", zIndex: 6, display: "flex",
					flexDirection: "column", alignItems: "flex-end", gap: "4px",
					maxWidth: "calc(100% - 12px)", pointerEvents: "none" },
			},
				insertedBadge(ins),
				(() => { const b = bmBadge(c); return h("span", {
					style: Object.assign({ maxWidth: "100%", fontSize: "10.5px", lineHeight: "15px", padding: "0 6px", borderRadius: "5px",
						background: "rgba(10,10,12,.66)", color: "rgba(255,255,255,.92)",
						border: "1px solid rgba(255,255,255,.16)", whiteSpace: "nowrap",
						overflow: "hidden", textOverflow: "ellipsis", letterSpacing: ".2px" },
						b.muted ? { background: "rgba(10,10,12,.42)", color: "rgba(255,255,255,.62)", borderStyle: "dashed" } : null),
					title: b.full,
				}, b.text); })(),
			),
				h("div", { style: { padding: "8px 10px 10px" } },
					h("div", { style: { display: "flex", alignItems: "baseline", gap: "6px" } },
						h("span", { style: { fontWeight: 700, fontSize: "13px", color: "var(--c-fg)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: "1 1 auto", minWidth: 0 } }, c.name), c.packMode ? h("span", { style: { flex: "none", fontSize: "10px", padding: "0 4px", borderRadius: "999px", background: "rgba(29,78,216,.10)", color: "var(--c-accent)" }, title: "这张卡是从「" + (PACK_MODE_CN[c.packMode] || c.packMode) + "」卡包导入的" }, (PACK_MODE_CN[c.packMode] || c.packMode)) : null, 
						null),
					h("div", { style: { marginTop: "3px", fontSize: "12px", color: "var(--c-fg2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, c.tags || "（空）"))),
			on ? h("div", { style: { display: "flex", gap: "6px" } },
				h("div", { style: { position: "relative", flex: 1, display: "flex" } },
				  h("button", {
				    style: Object.assign({}, CARD_BTN_ACCENT, { flex: 1 }),
				    title: "完整插入 = 连服饰一起写进去（范围含完整插入的锁生效）；不插入服饰 = 只写角色本体，方便换装试衣服（只有范围含换装的锁生效）",
				    onClick: (e) => { if (e && e.stopPropagation) e.stopPropagation(); setInsMenu(insMenu === c.id ? "" : c.id); },
				  }, "插入 ▾"),
				  insMenu === c.id ? h("div", {
				    style: { position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 60, minWidth: "170px", background: "var(--c-card)", border: "1px solid rgba(var(--c-ink-rgb),.18)", borderRadius: "8px", boxShadow: "0 10px 26px rgba(var(--c-ink-rgb),.18)", padding: "4px", display: "flex", flexDirection: "column", gap: "3px" },
				  },
				    h("button", { style: Object.assign({}, CARD_BTN_ACCENT, { textAlign: "left", padding: "6px 10px" }), onClick: () => applyCardInsert(c, true) }, "完整插入（含服饰）"),
				    h("button", { style: Object.assign({}, CARD_BTN, { textAlign: "left", padding: "6px 10px" }), title: "去掉服饰标签，只保留角色本体", onClick: () => applyCardInsert(c, false) }, "不插入服饰（换装）"),
				  ) : null
				),
				h("button", { style: Object.assign({}, CARD_BTN, { flex: 1 }), onClick: () => { setCardSel(""); editCard(c); }, title: (c.conditioning && c.conditioning.enabled) ? "身份控制在这张卡的编辑界面里" : "编辑标签、LoRA 与身份控制" }, "编辑")) : null);
	}

		function cardTab() {
		if (cardEdit) return cardEditor();
		const importPasted = () => {
			const raw = String(pasteText || "").trim();
			if (!raw) { setMsg("先粘贴卡 JSON"); return; }
			let obj = null;
			try { obj = JSON.parse(raw); } catch (e) { setMsg("不是合法 JSON：" + String((e && e.message) || e).slice(0, 80)); return; }
			if (!obj) { setMsg("粘贴的内容是空的"); return; }
			setPasteOpen(false);
			applyCardImport(obj);
		};
		const pasteModal = () => h("div", {
			onClick: () => setPasteOpen(false),
			style: { position: "fixed", inset: 0, zIndex: 2147483000, background: "rgba(0,0,0,.38)", display: "flex", alignItems: "center", justifyContent: "center" },
		},
			h("div", {
				onClick: (e) => e.stopPropagation(),
				style: { width: "min(640px, 92vw)", background: "var(--c-panel)", color: "var(--c-fg)", border: "1px solid var(--c-line)",
					borderRadius: "12px", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "8px", boxShadow: "0 18px 48px rgba(0,0,0,.38)" },
			},
				h("div", { style: { fontSize: "13px", fontWeight: 600 } }, "粘贴角色卡 JSON"),
				h("div", { style: { fontSize: "11.5px", color: "var(--c-fg5)" } }, "整张卡、卡数组、或 { \"cards\": [ … ] } 都能进：每条至少要有 name 与 tags。不依赖文件对话框，任何环境都能用。"),
				h("textarea", {
					value: pasteText, onChange: (e) => setPasteText(e.target.value), spellCheck: false,
					placeholder: '{ "name": "角色名", "tags": "1girl, solo, …", "neg": [], "locks": [] }',
					style: Object.assign({}, S.input || S.inp, { width: "100%", boxSizing: "border-box", height: "240px", fontFamily: "ui-monospace,Consolas,monospace", fontSize: "11.5px", lineHeight: 1.45, resize: "vertical" }),
				}),
				h("div", { style: { display: "flex", gap: "8px" } },
					h("button", { style: S.btn, onClick: importPasted }, "导入"),
					h("button", { style: S.btn2, onClick: () => setPasteOpen(false) }, "取消"),
					h("span", { style: { marginLeft: "auto", fontSize: "11.5px", color: "var(--c-fg5)" } }, "Ctrl+V 粘贴 · Esc 取消"))));
		const cards = allCards();
		const nB = cards.filter((c) => c.builtin).length;
		return h("div", { style: { display: "flex", flexDirection: "column", gap: "14px", padding: "4px 2px", width: "100%" } },
			h("div", { style: { display: "flex", alignItems: "center", gap: "10px" } },
				h("span", { style: { fontWeight: 700, fontSize: "15px", color: "var(--c-fg)" } }, "角色卡"),
				h("span", { style: { fontSize: "12px", color: "var(--c-fg3)" } }, cards.length + " 张 · 内置 " + nB + " · 自建 " + (cards.length - nB)),
				h("span", { style: { fontSize: "12px", fontWeight: 700, color: "var(--c-accent)" }, title: "INSERTED 登记表里的记录数。为 0 而词已进提示词 = 插入了但没登记；不为 0 而卡片没徽标 = 登记了但徽标没渲染" }, "· 已插入 " + INSERTED.all().length + " 张（风格 " + INSERTED.all().filter((r) => r && r.kind === "style").length + " / 角色 " + INSERTED.all().filter((r) => r && r.kind === "char").length + "）"),
				h("span", { style: { flex: 1 } }),
				
				      h("button", { style: CARD_BTN, onClick: exportAllCards, title: "把自建卡全部导出成一个 .json 备份" }, "导出全部"),
				      h("label", { style: Object.assign({}, CARD_BTN, { position: "relative", overflow: "hidden", display: "inline-block" }), title: "从 .json / .dslcard / .dslrecipe 导入角色卡（弹不出对话框就用「粘贴 JSON」）" }, "导入",
				        h("input", { type: "file", accept: ".json,.dslcard,.dslrecipe,application/json,application/octet-stream",
				          style: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", fontSize: "100px" },
				          onChange: importCards })),
				      h("button", { style: CARD_BTN, onClick: () => syncCardsFromDisk({ force: true }), title: "重新扫描 config.json 的 cardsDir：磁盘上的卡直接进面板" }, "重扫磁盘"),
				      h("button", { style: CARD_BTN, onClick: () => { setPasteText(""); setPasteOpen(true); }, title: "不依赖文件对话框：把卡 JSON 粘进来" }, "粘贴 JSON"),
				h("button", { style: CARD_BTN, onClick: () => revealCardFile("cards", ""), title: "在资源管理器里打开角色卡目录（config.json 的 cardsDir）" }, "打开文件夹"),
				      h("button", { style: CARD_BTN, onClick: newCard }, "＋ 新建")),
			cards.length
				? h("div", Object.assign({ style: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: "14px" } }, dropJsonProps(importCardsFromFile)), cards.map((c) => cardTile(c)))
				: h("div", { style: { padding: "32px", textAlign: "center", fontSize: "13px", color: "var(--c-fg3)", border: "1px dashed rgba(var(--c-ink-rgb),.12)", borderRadius: "10px" } }, "还没有角色卡"),
			pasteOpen ? pasteModal() : null,
			h("div", { style: { fontSize: "12px", color: "var(--c-fg3)" } }, "点卡片 = 选中 · 下方「插入 ▾」可选完整插入 / 不插入服饰（换装用），追加到正向/负面末尾（自动去重，不清空已有） · 封面可自定义 · 可导入导出，也可直接拖 .json / .dslcard / .dslrecipe 到卡片区；磁盘上的卡由「重扫磁盘」同步 · v1051"));
	}


	// ==================== 预设页 ====================
			
	/**
	 * 实验性功能：这里的东西不进主流程，随时可能改或撤。
	 * 放的都是"当场就能给出结论"的诊断入口，不写任何用户数据。
	 */
	async function runLabProbe() {
		const t0 = Date.now();
		const out = [];
		out.push("时间：" + new Date().toLocaleString());
		try {
			const hh = await jget(EXPANDER + "/health", 6000);
			out.push("侧车 /health：" + (hh && hh.ok === true ? "在线 ✓" : "返回异常")
				+ "　service=" + ((hh && hh.service) || "?") + "　apiVersion=" + ((hh && hh.apiVersion) || "?"));
		} catch (e) {
			out.push("侧车 /health：连不上（" + ((e && e.message) || e) + "）");
		}
		try {
			const vv = await jget(EXPANDER + "/version", 6000);
			out.push("侧车 /version：loaded=" + vv.loaded + "　disk=" + vv.disk
				+ "　stale=" + vv.stale + "　pid=" + vv.pid + "　configVersion=" + vv.configVersion);
		} catch (e) {
			out.push("侧车 /version：读不到（" + ((e && e.message) || e) + "）");
		}
		try {
			const cs = await jget(COMFY + "/system_stats", 6000);
			out.push("ComfyUI " + COMFY + "：" + (cs && cs.system ? "在线 ✓（" + (cs.system.os || "?") + "）" : "返回异常"));
		} catch (e) {
			out.push("ComfyUI " + COMFY + "：连不上（" + ((e && e.message) || e) + "）");
		}
		out.push("浏览器：" + (navigator.userAgent || "?"));
		out.push("耗时：" + (Date.now() - t0) + " ms");
		setLabProbe(out.join("\n"));
	}

	function exportLabDiag() {
		let ports = {};
		try { ports = JSON.parse(window.localStorage.getItem(PORTS_KEY) || "{}") || {}; } catch { ports = {}; }
		const data = {
			at: new Date().toISOString(),
			href: String(window.location && window.location.href || ""),
			ua: navigator.userAgent || "",
			probe: labProbe || "(还没跑体检)",
			ports: ports,
			errors: readClientErrors(),
		};
		downloadText(JSON.stringify(data, null, 2), "comfy-cards-next-diagnostics.json");
		setMsg("诊断包已下载（不含提示词与图片）");
	}

	function clearPortsCache() {
		try {
			window.localStorage.removeItem(PORTS_KEY);
			window.localStorage.removeItem("dsh-comfyui-console/ports");
		} catch { /* ignore */ }
		setMsg("端口缓存已清；刷新页面后会重新探测");
	}

	function experimentalTab() {
		const preStyle = {
			margin: "6px 0 0", padding: "10px 12px", borderRadius: "8px",
			background: "rgba(127,127,127,.10)", border: "1px solid rgba(127,127,127,.22)",
			fontSize: "12.5px", lineHeight: "1.6", whiteSpace: "pre-wrap", wordBreak: "break-all",
			maxHeight: "320px", overflow: "auto",
		};
		return h(React.Fragment, null,
			h("div", { style: S.card },
				h("span", { style: S.label }, "实验性功能"),
				h("span", { style: S.dim }, "这里的入口不进主流程、随时可能改或撤；下面的诊断都只读，不写你的预设、词库和出图目录。")),


						/* 实验性页 · 手 / 脚局部重绘：参数存在 Console 的 detail 状态里，走 buildGraph 的 40 号节点段。 */
			h("div", { style: S.card },
				h("span", { style: S.label }, "手 / 脚局部重绘（实验）"),
				h("span", { style: S.dim }, "裁出目标区域 → 放大到引导尺寸 → 只重画这块 → 羽化贴回。全程只用 ComfyUI 内置节点，不装 Impact Pack、不下载检测器。区域是按画面比例猜的：全身竖图默认值可用；半身、坐姿、举手过头、趴姿会框偏。框偏不会崩，只是那块被重新画了一遍。"),
				h("div", { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "10px" } },
					h("span", { style: { fontSize: "12px", opacity: .8 } }, "重绘范围"),
					h("select", { value: detail.mode, style: { fontSize: "12px", padding: "3px 6px", borderRadius: "6px" }, onChange: (e) => setDetail(Object.assign({}, detail, { mode: e.target.value })) },
						[["off", "关闭"], ["hands", "手"], ["feet", "脚"], ["both", "手 + 脚"]].map((pair) => h("option", { key: pair[0], value: pair[0] }, pair[1]))),
					detail.mode === "off" ? null : h("span", { style: { display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" } }, "强度",
						h("input", { type: "number", min: 0.1, max: 0.85, step: 0.05, value: detail.denoise, title: "0.35 轻改、0.55 重画；超过 0.6 容易把手指画成新的样子", style: { width: "64px", fontSize: "12px", padding: "3px 6px", borderRadius: "6px" }, onChange: (e) => setDetail(Object.assign({}, detail, { denoise: Number(e.target.value) })) })),
					detail.mode === "off" ? null : h("span", { style: { display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" } }, "引导尺寸",
						h("select", { value: String(detail.guide), title: "区域放大到多高再重采：越大越细，也越慢（1024 约等于再跑半张图）", style: { fontSize: "12px", padding: "3px 6px", borderRadius: "6px" }, onChange: (e) => setDetail(Object.assign({}, detail, { guide: Number(e.target.value) })) },
							[512, 768, 1024].map((g) => h("option", { key: g, value: String(g) }, g + "px"))))),
				h("span", { style: { fontSize: "12px", opacity: .72, marginTop: "6px" } }, detail.mode === "off" ? "当前：关闭（不影响出图）" : ("当前：" + (detail.mode === "hands" ? "只手" : detail.mode === "feet" ? "只脚" : "手 + 脚") + " · 强度 " + detail.denoise + " · 引导 " + detail.guide + "px · 每张多花约 15–35% 时间")),
				h("span", { style: { fontSize: "12px", opacity: .72 } }, "位置：二次采样之后、超分之前。开了二次采样时按放大后的画面框区域。")),
			h("div", {
				style: Object.assign({}, S.card, upd && upd.ok && upd.hasUpdate
					? { borderColor: "rgba(150,200,120,.62)", background: "rgba(150,200,120,.08)" }
					: {}),
			},
				h("span", { style: S.label }, "版本更新"),
				h("div", { style: S.row },
					h("button", { style: S.btn, onClick: checkUpdateNow, title: "问一次 GitHub（force 绕开 6 小时缓存）" },
						updBusy ? "检查中…" : "立即检查"),
					upd && upd.ok && upd.url
						? h("button", { style: S.btn2, onClick: () => window.open(upd.url, "_blank", "noopener") }, "打开 Release 页")
						: null,
					h("span", { style: S.dim },
						upd && upd.ok
							? ("当前 " + upd.current + " · 最新 " + upd.latest
								+ (upd.hasUpdate ? " · 有新版本" : " · 已是最新")
								+ "（" + (upd.source === "tag" ? "按 tag" : "按 Release") + "，" + (upd.cached ? "缓存" : "刚查") + "）")
							: upd && upd.error
								? ("查不到：" + upd.error)
								: "启动 6 秒后自动查一次，也可以点「立即检查」")),
				upd && upd.ok && upd.notes
					? h("pre", { style: preStyle }, String(upd.notes).slice(0, 1200))
					: null,
				upd && upd.hint ? h("span", { style: S.dim }, upd.hint) : null,
				upd && upd.configured === false
					? h("span", { style: S.dim }, "配置方式：config.json 加 \"updateRepo\": \"owner/repo\"（GitHub 仓库全名），走代理再加 \"updateProxy\"")
					: null),

			h("div", { style: S.card },
				h("span", { style: S.label }, "侧车 / ComfyUI 体检"),
				h("div", { style: S.row },
					h("button", { style: S.btn, onClick: runLabProbe, title: "分别问侧车 /health、/version 和 ComfyUI /system_stats" }, "跑一次体检"),
					h("button", { style: S.btn2, onClick: () => { setLabProbe(""); setMsg("已清空体检结果"); } }, "清空"),
					h("span", { style: S.dim }, "连不上、版本对不上、端口被别的程序占了，先用这个看")),
				labProbe ? h("pre", { style: preStyle }, labProbe) : null),

			h("div", { style: S.card },
				h("span", { style: S.label }, "诊断包"),
				h("div", { style: S.row },
					h("button", { style: S.btn2, onClick: exportLabDiag, title: "版本 + 体检输出 + 前端错误日志 + 端口缓存" }, "下载 diagnostics.json"),
					h("span", { style: S.dim }, "发给别人排查用；里面没有提示词、没有图片、没有卡包"))),

			h("div", { style: S.card },
				h("span", { style: S.label }, "端口缓存"),
				h("div", { style: S.row },
					h("button", { style: S.btn2, onClick: clearPortsCache, title: "删掉 localStorage 里记的 comfy / sidecar 地址" }, "清掉并重新探测"),
					h("span", { style: S.dim }, "侧车端口换过、或者界面一直显示连不上时用（清完刷新页面）"))),

		);
	}

function presetTab() {
		const list = USER.presets || [];
		const cats = Array.from(new Set(list.map((p) => p.cat)));
		return h(React.Fragment, null,
			h("div", { style: S.card },
				h("span", { style: S.label }, "把当前参数与提示词存成预设"),
				h("div", { style: S.row },
					h("input", { style: Object.assign({}, S.inp, { width: "150px" }), placeholder: "预设名", value: presetName, onChange: (e) => setPresetName(e.target.value) }),
			h("button", { style: Object.assign({}, CARD_BTN, { color: "var(--c-bad, #d33)" }), onClick: () => dirClear("cards", "角色卡"), title: "把 角色卡 目录里的文件整包搬到 _清空备份，并清空面板（可逆）" }, "清空"),
					h("input", { style: Object.assign({}, S.inp, { width: "130px" }), placeholder: "分类(默认)", value: presetCat, onChange: (e) => setPresetCat(e.target.value) }),
					h("button", { style: S.btn, onClick: savePreset }, "保存为预设"),
					h("span", { style: S.dim }, "存的是：正/负提示词 + 底模 + LoRA + 尺寸步数 CFG 采样器")),
				h("span", { style: S.dim }, "同名同分类会覆盖。数据存在本机 localStorage，换机器不带。")),

			// ---- 从 ComfyUI 工作流导入 ----
			h("div", {
				style: Object.assign({}, S.card, {
					borderColor: "rgba(150,120,225,.55)",
					background: "rgba(150,120,225,.08)",
				}),
			},
				h("span", { style: S.label }, "从 ComfyUI 工作流导入（支持 UI 格式与 API 格式）"),
				h("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap" } },
					h("button", { style: S.btn2, onClick: pickWfFile }, "选择 .json 文件"),
					h("button", { style: S.btn, onClick: doParseWf }, "解析"),
					wfResult && wfResult.ok ? h("button", { style: S.btn, onClick: saveWfAsPreset }, "存成预设并套用") : null,
					wfText ? h("button", { style: S.btn2, onClick: () => { setWfText(""); setWfResult(null); setMsg("已清空"); } }, "清空") : null),
				h("textarea", Object.assign({
					style: Object.assign({}, S.ta, { height: "90px" }),
					placeholder: "把 ComfyUI 的工作流 JSON 粘到这里，或直接把 .json / .png 拖进来",
					value: wfText, onChange: (e) => setWfText(e.target.value),
				},
					// 拖工作流进来：直接读进输入框（.png 里也常带 workflow，交给解析器判断）
					dropFileProps(["json", "png", "webp"], (good) => {
						const f = good[0];
						const rd = new FileReader();
						rd.onload = () => { setWfText(String(rd.result || "")); setMsg("已读入 " + f.name + "（" + Math.round(f.size / 1024) + " KB），点「解析」"); };
						rd.onerror = () => setMsg("读文件失败");
						rd.readAsText(f, "utf-8");
					}, { onReject: (l) => setMsg("拖错了：工作流只收 " + l.map((x) => "." + x).join(" / ")) }))),
				wfResult ? (wfResult.ok
					? h("div", { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "12.5px" } },
						h("span", { style: S.ok }, "解析成功（格式：" + wfResult.format + "）"),
						h("span", null, "底模：" + (wfResult.ckpt || "（没找到）")),
						h("span", null, "CLIP：" + (wfResult.clip || "（没找到）") + (wfResult.clipType ? " / " + wfResult.clipType : "")),
						h("span", null, "VAE：" + (wfResult.vae || "（没找到）")),
						h("span", null, "LoRA：" + (wfResult.loras.length
							? wfResult.loras.map((l) => l.name.replace(/\.safetensors$/, "") + "@" + l.model).join("、")
							: "（无）")),
						h("span", null, "尺寸：" + wfResult.w + "×" + wfResult.h + "　步数：" + wfResult.steps
							+ "　CFG：" + wfResult.cfg + "　采样：" + wfResult.sampler + "/" + wfResult.scheduler),
						h("span", null, "正向 " + (wfResult.pos || "").length + " 字符　负向 " + (wfResult.neg || "").length + " 字符"),
						wfResult.dangling && wfResult.dangling.length
							? h("span", { style: S.warn }, "⚠ 悬空 LoRA（输出没接任何节点，已忽略）：" + wfResult.dangling.join("；"))
							: null,
						wfResult.ignored && wfResult.ignored.length
							? h("span", { style: S.warn }, "⚠ 这些节点没有对等字段，不会带进预设：" + wfResult.ignored.join("、"))
							: null,
						h("span", { style: S.dim }, wfResult.notes.join(" | ")),
						h("span", { style: S.dim }, "※ 导入只提取预设能表达的字段；放大 / ControlNet / 细节修复等节点不会被复现。"))
					: h("span", { style: S.bad }, "解析失败：" + wfResult.error)) : null),

			list.length === 0
				? h("div", { style: S.card }, h("span", { style: S.dim }, "还没有预设。填个名字点「保存为预设」即可。"))
				: cats.map((c) => h("div", { key: c, style: S.card },
					h("span", { style: S.label }, "分类：" + c),
					h("div", { style: { display: "flex", flexDirection: "column", gap: "5px" } },
						list.filter((p) => p.cat === c).map((p, i) => h("div", {
							key: i,
							style: { display: "flex", gap: "8px", alignItems: "center", padding: "4px 6px", borderRadius: "5px", background: "rgba(127,127,127,.08)" },
						},
							h("span", { style: { flex: 1, fontSize: "12.5px" } }, p.name),
							h("span", { style: S.dim }, (p.w || "?") + "×" + (p.h || "?") + " · " + (p.steps || "?") + "步 · cfg" + (p.cfg || "?")),
							h("button", { style: S.btn2, onClick: () => loadPreset(p) }, "套用"),
							h("button", { style: S.btn2, onClick: () => delPreset(p) }, "删除")))))));
	}


	// ==================== 组装 ====================
	return h("div", { ref: rootRef, className: "dcomfy-panel", style: (() => { const tv = resolveTheme(theme, systemDark); return Object.assign({}, S.wrap, tv, ccVarsFromC(tv), availH ? { height: availH + "px", maxHeight: availH + "px", minHeight: 0 } : null); })() },
		h("style", { key: "dcomfy-theme-css" }, PANEL_CSS),
		// 顶栏
		h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" } },
			h("div", { style: { display: "flex", gap: "10px", alignItems: "baseline", flexWrap: "wrap", minWidth: 0, flex: "1 1 auto" } },
				h("strong", { style: { fontSize: "15px" } }, "Comfy Cards Next"),
						h("span", { style: { fontSize: "11px", color: "var(--c-fg5)", letterSpacing: ".3px" }, title: "插件版本（/version 的 loaded 字段，= 当前进程装载的代码版本）" }, (ver && ver.loaded ? "v" + ver.loaded : "v?") + " · " + (rW > 0 ? rW + "px" : "?")),
						(ver && ver.stale)
							? h("span", {
								style: { fontSize: "11px", color: "var(--c-bad2)", border: "1px solid var(--c-bad2)", borderRadius: "4px", padding: "0 4px" },
								title: "磁盘上已是 v" + ver.disk + "，本进程还跑着 v" + ver.loaded + "。ESM 缓存按进程，刷新页面无效——重启 dsh web。"
							}, "需重启 · 磁盘 " + ver.disk)
							: null,
				status,
				h("span", { style: S.dim }, ckpts.length + " 底模 · " + loras.length + " LoRA · " + (USER.presets || []).length + " 预设")),
			h("div", { style: { display: "flex", gap: "6px", marginLeft: "auto", justifyContent: "flex-end", flexWrap: "wrap", minWidth: 0 } },
				(launchAtt || !online) ? h("button", {
					style: Object.assign({}, S.btn2, launchAtt
						? { background: "#c62828", borderColor: "#c62828", color: "#fff", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 7, minWidth: 128 }
						: { fontWeight: 700, minWidth: 128 }),
					title: launchAtt ? "点击停止本次启动并回收进程" : "手动拉起 ComfyUI（约 20~60 秒）",
					"data-cc-guide": "connection-action",
					onClick: launchAtt ? stopLaunch : beginLaunch,
				},
					launchAtt
						? h(React.Fragment, null,
							h("span", {
								style: { display: "inline-block", width: 11, height: 11, borderRadius: "50%",
									border: "2px solid rgba(255,255,255,.45)", borderTopColor: "#fff",
									animation: "cc-spin .7s linear infinite" },
							}),
							"停止启动")
						: "启动 ComfyUI") : null,
				!online && !launchAtt ? h("button", { style: S.btn2, onClick: () => { setOnline(null); setMsg(""); setConn((c) => c + 1); } }, "重试连接") : null,
				online ? h("button", {
					style: S.btn2, title: "重新读一遍 ComfyUI 状态与模型清单（不重启进程）",
					onClick: () => { setOnline(null); setMsg("重新连接中…"); setConn((c) => c + 1); },
				}, "重新连接") : null,
				online ? h("button", {
					style: S.btn2, title: "让 ComfyUI 卸载模型释放显存，进程保留",
					onClick: async () => {
						setMsg("释放显存中…");
						try {
							const r = await jpost(EXPANDER + "/comfy/unload", {}, 40000);
							setMsg(r && r.ok ? "已释放显存" : "失败：" + ((r && r.message) || "?"));
						} catch (e) { setMsg("失败：" + errText(e)); }
					},
				}, "释放显存") : null,
				online ? h("button", {
					style: S.btn2, title: "彻底关闭 ComfyUI 进程",
					onClick: async () => {
						setMsg("关闭中…");
						try {
							const r = await jpost(EXPANDER + "/comfy/stop", {}, 40000);
							if (r && r.ok) { setOnline(false); setMsg("已关闭"); } else { setMsg("失败：" + ((r && r.message) || "?")); }
						} catch (e) { setMsg("失败：" + errText(e)); }
					},
				}, "完全关闭") : null,
				h("button", { style: S.btn2, onClick: () => window.open(COMFY, "_blank") }, "原界面"),
				h("select", {
					style: Object.assign({}, S.sel, { minWidth: "86px", padding: "3px 6px", fontSize: "12px" }),
					title: "面板配色：跟随系统 / 浅色 / 深色 / 纯白 / 纯黑 / 自定义",
					value: (theme && theme.mode) || "auto",
					onChange: (e) => setTheme(Object.assign({}, THEME_DEFAULTS, theme || {}, { mode: e.target.value })),
				}, THEME_MODES.map((m) => h("option", { key: m[0], value: m[0] }, m[1]))),
				(theme && theme.mode === "custom") ? h("input", {
					type: "color", title: "自定义背景色",
					value: (theme && theme.bg) || THEME_DEFAULTS.bg,
					style: { width: "34px", height: "26px", padding: "1px", border: "1px solid rgba(127,127,127,.35)", borderRadius: "6px", background: "transparent", cursor: "pointer" },
					onChange: (e) => setTheme(Object.assign({}, THEME_DEFAULTS, theme || {}, { mode: "custom", bg: e.target.value })),
				}) : null,
				(theme && theme.mode === "custom") ? h("input", {
					type: "color", title: "自定义文字色",
					value: (theme && theme.fg) || THEME_DEFAULTS.fg,
					style: { width: "34px", height: "26px", padding: "1px", border: "1px solid rgba(127,127,127,.35)", borderRadius: "6px", background: "transparent", cursor: "pointer" },
					onChange: (e) => setTheme(Object.assign({}, THEME_DEFAULTS, theme || {}, { mode: "custom", fg: e.target.value })),
				}) : null)),

		// 后台任务条（跨面板存活；即使切走再回来也在）
		job ? h("div", {
			style: {
				border: "1px solid " + (job.status === "error" ? "rgba(224,106,106,.55)" : job.status === "done" ? "rgba(74,192,122,.5)" : "rgba(90,160,235,.5)"),
				background: job.status === "error" ? "rgba(224,106,106,.10)" : job.status === "done" ? "rgba(74,192,122,.10)" : "rgba(90,160,235,.10)",
				borderRadius: "8px", padding: "8px 12px", display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap",
			},
		},
			h("span", { style: { fontSize: "12.5px" } }, "后台任务：" + (job.message || job.status)),
			job.status === "running" || job.status === "submitting"
				? h("button", { style: S.btn2, onClick: () => BG.cancel() }, "取消")
				: null,
			h("button", { style: S.btn2, onClick: () => BG.clear() }, "清除"),
			h("span", { style: S.dim }, "切到别的面板也会继续跑")) : null,

		// 状态条：单独占页签上方一行。原来挤在页签右侧用省略号截断，
		// 「磁盘同步（D:\…\角色卡）：6 张 · 新增 0 · 更新 6 · 保护跳过 0 · 移除 0」这种长串看不全。
		msg ? h("div", {
			key: "statusline",
			title: msg,
			style: {
				display: "flex", alignItems: "flex-start", justifyContent: "flex-end", gap: "6px",
				padding: "2px 2px 6px", fontSize: "12.5px", lineHeight: "1.55",
				color: /失败|连不上|离线|没认出来/.test(msg) ? "var(--c-bad, #d33)" : "var(--c-fg3)",
				whiteSpace: "normal", wordBreak: "break-word", overflowWrap: "anywhere",
			},
		}, h("span", { style: { textAlign: "right" } }, msg)) : null,

		// 标签页
		h("div", { style: { display: "flex", gap: "2px", alignItems: "center", borderBottom: "1px solid rgba(127,127,127,.25)" } },
			  [["gen", "生成"], ["style", "风格卡"], ["card", "角色卡"], ["lib", "词库"], ["pv-output", "历史"], ["preset", "预设"], ["lab", "实验性功能"]].map(([k, label]) =>
			    h("div", {
			      key: k, onClick: () => setTab(k),
			      style: Object.assign({}, S.tab, tab === k ? S.tabOn : S.tabOff),
			    }, label)),
					  null),

		// 模型库是二级页：只在生成页那个「模型库」按钮拉起时出现，tab 条上没有它的位置，
		// 所以给它一条返回生成页的导航条，否则进来就出不去（其它 tab 都不高亮）。
		tab === "pv-online" ? h("div", { key: "pv-online-back", style: { display: "flex", alignItems: "center", gap: "8px", padding: "5px 2px", borderBottom: "1px solid rgba(127,127,127,.18)" } },
			h("button", { style: S.btn2, onClick: () => setTab("gen"), title: "回到生成页" }, "◂ 返回生成"),
			h("span", { style: S.dim }, "模型库")) : null,

		h("div", { key: "pvhost", style: { display: (tab === "pv-output" || tab === "pv-online") ? "flex" : "none", flexDirection: "column", flex: 1, minHeight: 0, minWidth: 0, overflow: "hidden" } },
			h(PreviewConsole, { page: tab === "pv-output" ? "output" : tab === "pv-online" ? "online" : "" })),
		h(TabBoundary, { key: tab },
			tab === "gen" ? genTab() : null,   /* 内联调用：genTab 是 Console 内的嵌套函数，h(genTab) 每次渲染都是新类型 → 整棵子树卸载重建 → 输入框每敲一个字就失焦 */
			tab === "style" ? styleCardTab() : null,
			tab === "card" ? cardTab() : null,
			tab === "lib" ? h(libTab, { key: "lib" }) : null,
			tab === "preset" ? h(presetTab, { key: "preset" }) : null,
			tab === "lab" ? h(experimentalTab, { key: "lab" }) : null),
		impRep ? importReportPanel() : null,
		/* 图生图二级面板（2026-11-10 从实验性页提到页面级）：
		   画布右下角的「图生图 ▸」和词库页原按钮共用这一个弹窗，切到哪页都能弹。 */
			// 图生图的二级选择面板。
			// 走项目统一的 OverlayModal：它 portal 到 document.body、带 --cc-* 主题变量、
			// 有 Esc 关闭与焦点陷阱；自己写 fixed div 会拿不到宿主主题色（上一版就是这个问题）。
			initOpen
				? h(OverlayModal, {
					title: "选择图生图的参考图",
					onClose: () => setInitOpen(false),
					width: 780,
					theme: ccVars,
					zIndex: 2147482600,
				},
					h("div", { style: { display: "flex", gap: "6px", alignItems: "center" } },
						[["history", "从历史选"], ["upload", "上传自己的图"]].map(([k, lb]) => h("button", {
							key: k, type: "button",
							style: Object.assign({}, S.btn2, initTab === k ? { fontWeight: 600, borderColor: "var(--cc-accent, rgba(120,170,255,.7))" } : null),
							onClick: () => { setInitTab(k); if (k === "history" && !initHistory.length) loadInitHistory(); },
						}, lb)),
						h("span", { style: Object.assign({}, S.dim, { marginLeft: "auto" }) },
							initTab === "history" ? ("output 目录最近 " + initHistory.length + " 张") : "png / jpg / webp，≤48MB")),

					initTab === "upload"
						? h("div", { style: { display: "flex", flexDirection: "column", gap: "10px", padding: "22px 8px", alignItems: "center", border: "1px dashed var(--cc-border, rgba(127,127,127,.45))", borderRadius: "8px" } },
							h("input", { type: "file", accept: "image/png,image/jpeg,image/webp", disabled: initBusy, onChange: (e) => uploadInitFile(e.target.files) }),
							h("span", { style: S.dim }, "选好即自动铺到 ComfyUI 的 input/dsh_init/ 并设为初始图"))
						: h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(98px, 1fr))", gap: "8px", overflowY: "auto", minHeight: "120px", maxHeight: "min(52vh, 420px)", paddingRight: "2px", alignContent: "start" } },
							initBusy && !initHistory.length
								? h("span", { style: S.dim }, "读取中…")
								: initHistory.length
									? initHistory.map((it) => h("button", {
										key: it.id || it.path, type: "button", disabled: initBusy,
										title: it.filename + "　" + (it.width || "?") + "×" + (it.height || "?"),
										style: { padding: 0, border: "1px solid var(--cc-border, rgba(127,127,127,.3))", borderRadius: "6px", overflow: "hidden", background: "var(--cc-surface, rgba(127,127,127,.08))", cursor: initBusy ? "wait" : "pointer", aspectRatio: "3/4" },
										onClick: () => pickInitFromHistory(it),
									}, h("img", {
										src: EXPANDER + "/outputs/thumb?path=" + encodeURIComponent(it.path) + "&m=" + Math.round((it.mtime || 0) * 1000),
										alt: it.filename, loading: "lazy",
										style: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
									})))
									: h("span", { style: S.dim }, "output 目录里还没有图 —— 先去生成一张，或者切到「上传自己的图」")),

					h("div", { style: Object.assign({}, S.dim, { fontSize: "12px" }) }, "选中的图会复制到 ComfyUI input/dsh_init/，不动原文件；工作流里接 LoadImage → VAEEncode → 主采样。"))
				: null,


);
}

// ==================== Cordis 注册 ====================
const inject = ["slots"];
const PANEL_ID = "comfyui";

function apply(ctx) {
	ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
		name: "sidebar.panellist", id: PANEL_ID, order: 100, label: "ComfyUI 绘图",
	}, PanelIcon));
	ctx.slots.inject("main", () => ctx.slots.register({
		name: "main", key: PANEL_ID,
	}, ConsoleSafe));
	ctx.slots.inject("settings.plugins.tab", () => ctx.slots.register({
		name: "settings.plugins.tab", id: "comfyui-console", order: 90, label: "ComfyUI 绘图",
	}, ConsoleSafe));
}
