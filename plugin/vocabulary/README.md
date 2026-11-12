# 内置词库来源与许可

这些是可重新生成的公共只读数据，不是用户词库或缓存。

## 翻译词典

CC-CEDICT，MDBG 与 CC-CEDICT 编辑者/贡献者；基于 Paul Andrew Denisowski 的 CEDICT。
原始下载：https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz
项目：https://cc-cedict.org/editor/editor.php?handler=Download
许可：Creative Commons Attribution-ShareAlike 4.0 International。
完整许可：https://creativecommons.org/licenses/by-sa/4.0/legalcode
translation.sqlite3 及其派生数据依此许可提供。变更：拆分可插入英文词义、仅构建简体中文候选索引（原始来源仍保留用于署名与重建），排除繁体别名、不可独立使用的构词标记、量词、交叉引用与过长解释；额外的三条常用译名由 DSH 编写。源摘要和重建方法随本包提供，工具位于 tools/build_vocabulary.py。

## Danbooru 标签与中文译名

ame-la/danbooru-tags-data-zh，MIT。详见 LICENSE-DANBOORU.txt。
来源：https://huggingface.co/datasets/ame-la/danbooru-tags-data-zh
固定版本：8c82a48deb6f5548d893a1b1e82943a5bcf15c2e。
变更：构建 SQLite 查询索引，并增加少量 DSH 中文口语检索别名；不改变来源原始标签名称。

每份数据的下载地址、大小、SHA-256 及生成数据库的校验值见 manifest.json。
