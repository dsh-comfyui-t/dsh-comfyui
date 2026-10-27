"""Local semantic dictionary. SQLite belongs to the sidecar, never to the browser.

External snapshots are read-only inputs. User corrections live in a separate
layer. Import batches are retryable; progress/cancellation never block search.
Only Python's standard library is required.
"""
import base64
from contextlib import closing, contextmanager
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import threading
import time
import unicodedata
import uuid

SCHEMA_VERSION = 1
RELATIONS = {'equivalent', 'similar', 'broader', 'narrower', 'related', 'opposite'}
MAX_UPLOAD = 256 * 1024 * 1024

def norm(text):
    return ' '.join(unicodedata.normalize('NFKC', str(text)).lower().replace('_', ' ').split())

def text(value, size=2048):
    if not isinstance(value, str) or not value.strip() or len(value) > size or '\x00' in value:
        raise ValueError('文字为空、过长或含有无效字符')
    return value.strip()

def data_path(cfg):
    """Resolve on the executing sidecar OS, not Node/WSL's home directory."""
    value = cfg.get('dbPath') or cfg.get('dataDir')
    if value:
        value = str(value)
        if os.name == 'nt':
            m = re.fullmatch(r'/mnt/([a-zA-Z])/(.*)', value.replace('\\', '/'))
            if m:
                value = m[1].upper() + ':\\' + m[2].replace('/', '\\')
            if value.startswith('\\\\'):
                raise ValueError('词库目录必须位于 sidecar 的本机磁盘，不能使用 UNC 共享目录')
        elif re.match(r'^[A-Za-z]:', value) or value.startswith('/mnt/'):
            raise ValueError('Linux sidecar 词库须保存在 Linux 本地目录')
        p = Path(value).expanduser()
        if not p.is_absolute():
            raise ValueError('dataDir / dbPath 必须为 sidecar 所在系统的绝对路径')
        return p if cfg.get('dbPath') else p / 'tags.sqlite3'
    if os.name == 'nt':
        root = Path(os.environ.get('LOCALAPPDATA') or Path.home() / 'AppData' / 'Local')
    else:
        root = Path(os.environ.get('XDG_DATA_HOME') or Path.home() / '.local' / 'share')
    return root / 'DSH' / 'ComfyUIConsole' / 'tags.sqlite3'

SCHEMA = '''
CREATE TABLE IF NOT EXISTS sources (
 id INTEGER PRIMARY KEY, source_key TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
 license TEXT NOT NULL DEFAULT 'unconfirmed', version TEXT NOT NULL DEFAULT '',
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS concepts (
 id INTEGER PRIMARY KEY, source_id INTEGER REFERENCES sources(id), source_key TEXT,
 sense TEXT NOT NULL DEFAULT '', confidence REAL NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(source_id,source_key));
CREATE TABLE IF NOT EXISTS terms (
 id INTEGER PRIMARY KEY, lang TEXT NOT NULL, value TEXT NOT NULL, normalized TEXT NOT NULL,
 UNIQUE(lang,value));
CREATE INDEX IF NOT EXISTS terms_norm ON terms(normalized,lang);
CREATE TABLE IF NOT EXISTS concept_terms (
 concept_id INTEGER NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
 term_id INTEGER NOT NULL REFERENCES terms(id), preferred INTEGER NOT NULL DEFAULT 0,
 context TEXT NOT NULL DEFAULT '', PRIMARY KEY(concept_id,term_id));
CREATE TABLE IF NOT EXISTS tags (
 id INTEGER PRIMARY KEY, namespace TEXT NOT NULL, raw_name TEXT NOT NULL,
 normalized TEXT NOT NULL, category TEXT NOT NULL DEFAULT '', post_count INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(namespace,raw_name));
CREATE INDEX IF NOT EXISTS tags_norm ON tags(normalized);
CREATE TABLE IF NOT EXISTS tag_concepts (
 tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
 concept_id INTEGER NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
 confidence REAL NOT NULL DEFAULT 1, PRIMARY KEY(tag_id,concept_id));
CREATE TABLE IF NOT EXISTS concept_relations (
 source_id INTEGER NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
 target_id INTEGER NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
 relation TEXT NOT NULL CHECK(relation IN ('equivalent','similar','broader','narrower','related','opposite')),
 provenance INTEGER REFERENCES sources(id), PRIMARY KEY(source_id,target_id,relation));
CREATE TABLE IF NOT EXISTS tag_aliases (
 source_id INTEGER NOT NULL REFERENCES sources(id), alias TEXT NOT NULL,
 normalized TEXT NOT NULL, target_id INTEGER NOT NULL REFERENCES tags(id),
 PRIMARY KEY(source_id,alias));
CREATE INDEX IF NOT EXISTS alias_norm ON tag_aliases(normalized);
CREATE TABLE IF NOT EXISTS tag_implications (
 source_id INTEGER NOT NULL REFERENCES sources(id),
 antecedent_id INTEGER NOT NULL REFERENCES tags(id), consequent_id INTEGER NOT NULL REFERENCES tags(id),
 PRIMARY KEY(source_id,antecedent_id,consequent_id));
CREATE INDEX IF NOT EXISTS implication_reverse ON tag_implications(consequent_id,antecedent_id);
CREATE TABLE IF NOT EXISTS prompt_snippets (
 id INTEGER PRIMARY KEY, source_id INTEGER NOT NULL REFERENCES sources(id), source_key TEXT NOT NULL,
 title TEXT NOT NULL, category TEXT NOT NULL, content TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(source_id,source_key));
CREATE TABLE IF NOT EXISTS entries (
 id INTEGER PRIMARY KEY, source_id INTEGER NOT NULL REFERENCES sources(id), source_key TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('tag','snippet')), label TEXT NOT NULL, category TEXT NOT NULL,
 output TEXT NOT NULL, concept_id INTEGER REFERENCES concepts(id), tag_id INTEGER REFERENCES tags(id),
 snippet_id INTEGER REFERENCES prompt_snippets(id), model TEXT NOT NULL DEFAULT '*',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(source_id,source_key));
CREATE INDEX IF NOT EXISTS entries_tag ON entries(tag_id);
CREATE INDEX IF NOT EXISTS entries_concept ON entries(concept_id);
CREATE INDEX IF NOT EXISTS entries_category ON entries(category,id);
CREATE TABLE IF NOT EXISTS entry_overrides (
 entry_id INTEGER PRIMARY KEY REFERENCES entries(id) ON DELETE CASCADE,
 label TEXT, category TEXT, model TEXT, preferred INTEGER NOT NULL DEFAULT 0,
 disabled INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS entry_name_overrides (
 entry_id INTEGER PRIMARY KEY REFERENCES entries(id) ON DELETE CASCADE,
 names TEXT NOT NULL DEFAULT '[]');
CREATE INDEX IF NOT EXISTS entries_output_az ON entries(output COLLATE NOCASE,id);
CREATE TABLE IF NOT EXISTS search_names (
 entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
 normalized TEXT NOT NULL, lang TEXT NOT NULL, PRIMARY KEY(entry_id,normalized,lang));
CREATE INDEX IF NOT EXISTS search_prefix ON search_names(normalized,entry_id);
CREATE TABLE IF NOT EXISTS import_runs (
 id TEXT PRIMARY KEY, source_id INTEGER REFERENCES sources(id), sha256 TEXT NOT NULL,
 status TEXT NOT NULL, processed INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL DEFAULT 0,
 detail TEXT NOT NULL DEFAULT '', mapping TEXT NOT NULL DEFAULT '{}',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS legacy_migrations (
 digest TEXT PRIMARY KEY, payload TEXT NOT NULL, result TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS user_categories (name TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
'''

class Dictionary:
    def __init__(self, path, seed=None, recover=True):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.write_lock = threading.RLock()
        self.jobs_lock = threading.Lock()
        self.jobs = {}
        self.uploads = {}
        inbox=self.path.parent/'inbox'
        if inbox.exists():
            for item in inbox.glob('*.sqlite'):
                if re.fullmatch(r'[a-f0-9]{32}\.sqlite',item.name) and time.time()-item.stat().st_mtime>3600:
                    item.unlink(missing_ok=True)
        with self.connect() as db:
            v = db.execute('PRAGMA user_version').fetchone()[0]
            if v > SCHEMA_VERSION:
                raise ValueError('词库版本高于插件支持的版本，请勿降级写入')
            # executescript owns the complete schema transaction; never partially migrate.
            db.executescript('BEGIN IMMEDIATE;\n' + SCHEMA + '\nPRAGMA user_version=1;\nCOMMIT;')
            if recover:
                db.execute("UPDATE import_runs SET status='interrupted' WHERE status IN ('running','queued')")
        if seed:
            with open(seed, encoding='utf-8') as f:
                self.seed(json.load(f))
            self.seed_semantic_core()

    @contextmanager
    def connect(self):
        db = sqlite3.connect(str(self.path), timeout=20)
        db.row_factory = sqlite3.Row
        db.execute('PRAGMA foreign_keys=ON')
        db.execute('PRAGMA busy_timeout=20000')
        try:
            yield db
            db.commit()
        except BaseException:
            db.rollback()
            raise
        finally:
            db.close()

    def source(self, db, key, license='unconfirmed', version=''):
        db.execute('INSERT OR IGNORE INTO sources(source_key,name,license,version) VALUES(?,?,?,?)',
                   (key, key, license, version))
        return db.execute('SELECT id FROM sources WHERE source_key=?', (key,)).fetchone()[0]

    def _term(self, db, cid, value, lang, preferred=0):
        value, lang = text(value), text(lang, 24)
        db.execute('INSERT OR IGNORE INTO terms(lang,value,normalized) VALUES(?,?,?)', (lang, value, norm(value)))
        tid = db.execute('SELECT id FROM terms WHERE lang=? AND value=?', (lang, value)).fetchone()[0]
        db.execute('INSERT OR REPLACE INTO concept_terms VALUES(?,?,?,?)', (cid, tid, int(bool(preferred)), ''))

    def _tag(self, db, raw, category='', count=0, namespace='danbooru'):
        raw = text(raw)
        db.execute('INSERT OR IGNORE INTO tags(namespace,raw_name,normalized,category,post_count) VALUES(?,?,?,?,?)',
                   (namespace, raw, norm(raw), str(category), max(0, int(count or 0))))
        return db.execute('SELECT id FROM tags WHERE namespace=? AND raw_name=?', (namespace, raw)).fetchone()[0]

    def _index(self, db, eid):
        db.execute('DELETE FROM search_names WHERE entry_id=?', (eid,))
        row = db.execute('SELECT e.*,o.label AS correction FROM entries e LEFT JOIN entry_overrides o ON o.entry_id=e.id WHERE e.id=?', (eid,)).fetchone()
        custom = db.execute('SELECT names FROM entry_name_overrides WHERE entry_id=?',(eid,)).fetchone()
        names = [(row['correction'] or row['label'], 'zh'), (row['output'], 'en')]
        if custom:
            names.extend((value,'zh') for value in json.loads(custom[0]))
        if row['correction']:
            names.append((row['correction'], 'zh'))
        if row['concept_id']:
            names.extend((r['value'], r['lang']) for r in db.execute('SELECT t.* FROM terms t JOIN concept_terms ct ON ct.term_id=t.id WHERE ct.concept_id=?', (row['concept_id'],)) if not custom or r['lang']!='zh')
        db.executemany('INSERT OR IGNORE INTO search_names VALUES(?,?,?)', [(eid,norm(v),lang) for v,lang in names if v])

    def _entry(self, db, sid, key, label, output, category, kind='snippet', confidence=1, concept_id=None, namespace='user'):
        text(output,65536)  # Validate without altering macro whitespace or punctuation.
        label, category = text(label), text(category, 128)
        old = db.execute('SELECT * FROM entries WHERE source_id=? AND source_key=?', (sid,key)).fetchone()
        cid, tid, snippet = None, None, None
        if kind == 'tag':
            if re.search(r'[,\n\r]', output):
                raise ValueError('单 Tag 不能包含逗号或换行，请选择提示词片段')
            cid = concept_id or (old['concept_id'] if old else None)
            if cid and not db.execute('SELECT id FROM concepts WHERE id=?', (cid,)).fetchone():
                raise ValueError('义项不存在')
            if not cid:
                db.execute('INSERT INTO concepts(source_id,source_key,sense,confidence) VALUES(?,?,?,?)', (sid,key,label,confidence))
                cid = db.execute('SELECT last_insert_rowid()').fetchone()[0]
            tid = self._tag(db, output, category, namespace=namespace)
            db.execute('INSERT OR IGNORE INTO tag_concepts VALUES(?,?,?)', (tid,cid,confidence))
            # Replacing a source translation removes its stale binding, without
            # touching any user correction or another concept with the same word.
            if old and old['label'] != label:
                db.execute('DELETE FROM concept_terms WHERE concept_id=? AND term_id IN (SELECT id FROM terms WHERE value=?)', (cid,old['label']))
            if old and old['output'] != output:
                db.execute('DELETE FROM concept_terms WHERE concept_id=? AND term_id IN (SELECT id FROM terms WHERE value=?)', (cid,old['output']))
                if old['tag_id'] != tid and not db.execute('SELECT 1 FROM entries WHERE concept_id=? AND tag_id=? AND id!=?',(cid,old['tag_id'],old['id'])).fetchone():
                    db.execute('DELETE FROM tag_concepts WHERE tag_id=? AND concept_id=?',(old['tag_id'],cid))
            self._term(db,cid,label,'zh',1)
            self._term(db,cid,output,'en',1)
        else:
            db.execute('INSERT INTO prompt_snippets(source_id,source_key,title,category,content) VALUES(?,?,?,?,?) ON CONFLICT(source_id,source_key) DO UPDATE SET title=excluded.title,category=excluded.category,content=excluded.content,updated_at=CURRENT_TIMESTAMP', (sid,key,label,category,output))
            snippet = db.execute('SELECT id FROM prompt_snippets WHERE source_id=? AND source_key=?', (sid,key)).fetchone()[0]
        db.execute('''INSERT INTO entries(source_id,source_key,kind,label,category,output,concept_id,tag_id,snippet_id)
            VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(source_id,source_key) DO UPDATE SET label=excluded.label,
            category=excluded.category,output=excluded.output,concept_id=excluded.concept_id,tag_id=excluded.tag_id,snippet_id=excluded.snippet_id,updated_at=CURRENT_TIMESTAMP''',
            (sid,key,kind,label,category,output,cid,tid,snippet))
        eid = db.execute('SELECT id FROM entries WHERE source_id=? AND source_key=?', (sid,key)).fetchone()[0]
        self._index(db,eid)
        return eid

    def seed(self, payload):
        with self.write_lock, self.connect() as db:
            if db.execute("SELECT 1 FROM metadata WHERE key='builtin-v038'").fetchone():
                return
            sid = self.source(db,'dsh-builtin-v038','legacy bundled dictionary','0.3.8')
            for i, row in enumerate(payload):
                # All historical LIB/EXTRA values are conservative snippets. No
                # heuristic can safely infer whether a natural-language phrase is a tag.
                self._entry(db,sid,str(i),row['label'],row['output'],row['category'])
            db.execute("INSERT INTO metadata VALUES('builtin-v038','done')")

    def seed_semantic_core(self):
        """Small authored sense supplement, independent of lossless legacy macros.

        This is not an imported third-party database. English search words are
        concept terms, never fabricated Danbooru alias/implication edges.
        """
        with self.write_lock, self.connect() as db:
            key = 'semantic-core-v046'
            if db.execute('SELECT 1 FROM metadata WHERE key=?', (key,)).fetchone():
                return
            sid = self.source(db, 'dsh-semantic-core', 'DSH authored labels; MIT', '0.4.6')
            definitions = [
                ('orange-color', '橙色', 'orange', '颜色', '颜色：橙色；普通英文提示词', 'english',
                 [('zh', '橘色'), ('en', 'orange color')]),
                ('orange-fruit', '橙子', 'orange_(fruit)', '水果', '水果：橙子 / 甜橙；区别于颜色和橘子', 'danbooru',
                 [('zh', '甜橙'), ('zh', '柳橙'), ('en', 'orange'), ('en', 'orange fruit')]),
                ('mandarin-fruit', '橘子', 'mandarin_orange', '水果', '水果：橘子；与橙子相关，非等价词', 'danbooru',
                 [('zh', '桔子'), ('en', 'mandarin')]),
            ]
            concepts = {}
            for source_key, label, output, category, sense, namespace, terms in definitions:
                eid = self._entry(db, sid, source_key, label, output, category, 'tag', namespace=namespace)
                cid = db.execute('SELECT concept_id FROM entries WHERE id=?', (eid,)).fetchone()[0]
                concepts[source_key] = cid
                db.execute('UPDATE concepts SET sense=? WHERE id=?', (sense, cid))
                for lang, value in terms:
                    self._term(db, cid, value, lang)
                self._index(db, eid)
            # A related fruit can be discovered from an exact orange query,
            # without claiming that "orange" is a synonym/alias of mandarin.
            db.execute('INSERT OR IGNORE INTO concept_relations(source_id,target_id,relation,provenance) VALUES(?,?,?,?)',
                       (concepts['orange-fruit'], concepts['mandarin-fruit'], 'related', sid))
            db.execute('INSERT INTO metadata VALUES(?,?)', (key, 'done'))

    def _rows(self, db, ids):
        if not ids:
            return []
        if len(ids)>500:
            return [r for i in range(0,len(ids),500) for r in self._rows(db,ids[i:i+500])]
        sql = '''SELECT e.*,COALESCE(o.label,e.label) AS display_label,
            COALESCE(o.category,e.category) AS display_category,COALESCE(o.model,e.model) AS display_model,
            COALESCE(o.preferred,0) AS preferred,COALESCE(o.disabled,0) AS disabled,
            COALESCE(t.namespace,'') AS namespace,
            s.source_key AS source,COALESCE(t.post_count,0) AS post_count,
            COALESCE(c.sense,'') AS sense,COALESCE(c.confidence,1) AS confidence
            FROM entries e JOIN sources s ON s.id=e.source_id
            LEFT JOIN entry_overrides o ON o.entry_id=e.id LEFT JOIN tags t ON t.id=e.tag_id
            LEFT JOIN concepts c ON c.id=e.concept_id WHERE e.id IN (%s)''' % ','.join('?'*len(ids))
        rows = []
        cids = [r[0] for r in db.execute('SELECT DISTINCT concept_id FROM entries WHERE id IN (%s) AND concept_id IS NOT NULL' % ','.join('?'*len(ids)), ids)]
        translations = {}
        if cids:
            marks = ','.join('?'*len(cids))
            # Corrected/disabled provider labels must not reappear as alternate
            # translations. Independently authored concept terms remain visible.
            # CROSS JOIN pins candidate concepts before the language filter;
            # a language-first plan would scan every Chinese term in a big DB.
            for term in db.execute(f'''SELECT ct.concept_id,t.value FROM concept_terms ct
                CROSS JOIN terms t ON t.id=ct.term_id WHERE ct.concept_id IN ({marks}) AND t.lang='zh'
                AND NOT EXISTS(SELECT 1 FROM entries e LEFT JOIN entry_overrides o ON o.entry_id=e.id
                    WHERE e.concept_id=ct.concept_id AND e.label=t.value AND
                    (COALESCE(o.disabled,0)=1 OR (o.label IS NOT NULL AND o.label!=e.label)))
                ORDER BY ct.preferred DESC,t.id''', cids):
                translations.setdefault(term['concept_id'], []).append(term['value'])
        name_overrides={r['entry_id']:json.loads(r['names']) for r in db.execute('SELECT * FROM entry_name_overrides WHERE entry_id IN (%s)' % ','.join('?'*len(ids)),ids)}
        for r in db.execute(sql,ids):
            item = dict(r)
            item['label'],item['category'],item['model'] = item.pop('display_label'),item.pop('display_category'),item.pop('display_model')
            item['translations'] = list(dict.fromkeys([item['label']] + name_overrides.get(item['id'], translations.get(item['concept_id'], []))))
            rows.append(item)
        return rows

    def browse(self, q='', limit=50, offset=0, category='', own=False, disabled=False):
        """Maintenance only: full SQL filtering + global A-Z pagination, no macros."""
        q=norm(str(q)[:200]); limit=min(100,max(1,int(limit))); offset=max(0,min(1000000,int(offset)))
        where="""e.kind='tag' AND (?='' OR COALESCE(o.category,e.category)=?)
            AND (? OR COALESCE(o.disabled,0)=0) AND (?=0 OR s.source_key='user')"""
        args=(category,category,int(disabled),int(own))
        if q:
            where+=' AND e.id IN (SELECT entry_id FROM search_names WHERE normalized>=? AND normalized<?)'
            args+=(q,q+'\U0010ffff')
        with self.connect() as db:
            base=' FROM entries e JOIN sources s ON s.id=e.source_id LEFT JOIN entry_overrides o ON o.entry_id=e.id WHERE '+where
            total=db.execute('SELECT count(*)'+base,args).fetchone()[0]
            ids=[r[0] for r in db.execute('SELECT e.id'+base+' ORDER BY e.output COLLATE NOCASE,e.id LIMIT ? OFFSET ?',(*args,limit,offset))]
            by_id={r['id']:r for r in self._rows(db,ids)}
            return {'items':[by_id[i] for i in ids],'total':total,'has_more':offset+len(ids)<total}

    def duplicates(self, english='', chinese='', exclude=0):
        with self.connect() as db:
            ids=[r[0] for r in db.execute("""SELECT DISTINCT e.id FROM entries e
                JOIN search_names n ON n.entry_id=e.id WHERE e.kind='tag' AND e.id!=?
                AND ((n.lang='en' AND n.normalized=?) OR (n.lang='zh' AND n.normalized=?))
                ORDER BY e.output COLLATE NOCASE,e.id LIMIT 31""",(int(exclude or 0),norm(english),norm(chinese)))]
            rows=self._rows(db,ids[:30]);rows.sort(key=lambda r:(r['output'].casefold(),r['id']))
            return {'items':rows,'has_more':len(ids)>30}

    def search(self, q='', limit=30, offset=0, category='', include_disabled=False, related=True, lang='', completion=False):
        q = norm(str(q)[:200])
        limit, offset = min(100,max(1,int(limit))), min(1000000,max(0,int(offset)))
        with self.connect() as db:
            ranks, reasons = {}, {}
            if q:
                # Indexed exact + bounded prefix probes. Never ship or scan the entire dictionary.
                for r in db.execute('SELECT entry_id,normalized FROM search_names WHERE normalized>=? AND normalized<? AND (?="" OR lang=?) ORDER BY normalized LIMIT 1000', (q,q+'\U0010ffff',lang,lang)):
                    rank = 0 if r['normalized'] == q else 1
                    eid = r['entry_id']
                    if rank < ranks.get(eid,99):
                        ranks[eid],reasons[eid] = rank, ('exact' if rank == 0 else 'prefix')
                for r in db.execute('''SELECT e.id FROM tag_aliases a JOIN entries e ON e.tag_id=a.target_id
                    WHERE a.normalized>=? AND a.normalized<? LIMIT 100''', (q,q+'\U0010ffff')):
                    if r[0] not in ranks:
                        ranks[r[0]], reasons[r[0]] = 2, 'alias'
                exact_ids = [eid for eid in ranks if ranks[eid] == 0][:20]
                if related and exact_ids:
                    marks = ','.join('?'*len(exact_ids))
                    # Each edge is traversed in its declared direction. The reverse
                    # implication is explicitly labelled "more specific".
                    queries = [
                        (f'''SELECT b.id,r.relation FROM entries a JOIN concept_relations r ON r.source_id=a.concept_id JOIN entries b ON b.concept_id=r.target_id WHERE a.id IN ({marks}) LIMIT 80''', None),
                        (f'''SELECT b.id,'same_concept' FROM entries a JOIN entries b ON b.concept_id=a.concept_id WHERE a.id IN ({marks}) AND b.id!=a.id LIMIT 80''', None),
                        (f'''SELECT b.id,'implies' FROM entries a JOIN tag_implications r ON r.antecedent_id=a.tag_id JOIN entries b ON b.tag_id=r.consequent_id WHERE a.id IN ({marks}) LIMIT 80''', None),
                        (f'''SELECT b.id,'more_specific' FROM entries a JOIN tag_implications r ON r.consequent_id=a.tag_id JOIN entries b ON b.tag_id=r.antecedent_id WHERE a.id IN ({marks}) LIMIT 80''', None)]
                    for sql,_ in queries:
                        for r in db.execute(sql,exact_ids):
                            if r[0] not in ranks:
                                ranks[r[0]],reasons[r[0]] = 3,r[1]
                rows = self._rows(db,list(ranks))
            else:
                # Pagination filters in SQL so the category page doesn't skip matching entries.
                ids = [r[0] for r in db.execute('''SELECT e.id FROM entries e
                    LEFT JOIN entry_overrides o ON o.entry_id=e.id
                    WHERE (?='' OR COALESCE(o.category,e.category)=?) AND (? OR COALESCE(o.disabled,0)=0)
                    ORDER BY e.id LIMIT ? OFFSET ?''', (category,category,int(include_disabled),limit+1,offset))]
                rows = self._rows(db,ids)
                ranks = {eid:i for i,eid in enumerate(ids)}
            rows = [r for r in rows if (include_disabled or not r['disabled']) and (not category or r['category']==category)]
            rows.sort(key=lambda r:(ranks.get(r['id'],99),-r['preferred'] if q else 0,int(r['label']==r['output']) if q else 0,-r['post_count'],r['id']))
            if q:
                # Collapse duplicate provider views of the same Tag + explicit sense,
                # preserving different senses and independently authored snippets.
                seen={};unique=[]
                for row in rows:
                    key=(row['tag_id'],row['concept_id']) if row['tag_id'] else ('entry',row['id'])
                    if key not in seen:
                        unique.append(row);seen[key]=row
                    else:
                        target=seen[key]
                        target['translations']=list(dict.fromkeys(target['translations']+row['translations']))
                rows=unique
                if completion:
                    # Preserve legacy snippets in storage and the library page;
                    # hide an identical legacy-only view when a semantic Tag is
                    # present. User macros are never suppressed by this rule.
                    semantic = {(r['label'],r['output']) for r in rows if r['kind']=='tag'}
                    rows=[r for r in rows if not (r['source']=='dsh-builtin-v038' and (r['label'],r['output']) in semantic)]
            if q:
                rows = rows[offset:offset+limit+1]
            for r in rows:
                r['relation'] = reasons.get(r['id'],'entry')
            return {'items':rows[:limit], 'has_more':len(rows)>limit, 'offset':offset,'limit':limit}

    def preview_matches(self, values):
        """Exact indexed lookup for display, including unchanged legacy snippets.

        Unlike interactive prefix search, complete prompt segments must not be
        truncated to 200 characters or resolved through aliases/implications.
        The caller verifies the complete output before using a display label.
        """
        keys = list(dict.fromkeys(norm(value) for value in values if value.strip()))
        if not keys:
            return []
        with self.connect() as db:
            marks = ','.join('?' * len(keys))
            ids = [r[0] for r in db.execute(f'''SELECT DISTINCT e.id FROM search_names n
                JOIN entries e ON e.id=n.entry_id
                LEFT JOIN entry_overrides o ON o.entry_id=e.id
                WHERE n.normalized IN ({marks}) AND COALESCE(o.disabled,0)=0
                ORDER BY COALESCE(o.preferred,0) DESC,e.id LIMIT 500''', keys)]
            return self._rows(db, ids)

    def status(self):
        with self.connect() as db:
            counts = {t:db.execute('SELECT count(*) FROM '+t).fetchone()[0] for t in ('entries','tags','concepts','terms','prompt_snippets','tag_aliases','tag_implications')}
            return {'ok':True,'schema_version':SCHEMA_VERSION,'db_path':str(self.path), 'counts':counts,
                'sources':[dict(r) for r in db.execute('SELECT * FROM sources')],
                'imports':[dict(r) for r in db.execute('SELECT * FROM import_runs ORDER BY created_at DESC LIMIT 10')]}

    def categories(self, tags=False):
        with self.connect() as db:
            counts = {r['name']:r['count'] for r in db.execute("""SELECT COALESCE(o.category,e.category) AS name,count(*) AS count FROM entries e LEFT JOIN entry_overrides o ON o.entry_id=e.id WHERE COALESCE(o.disabled,0)=0 AND (?=0 OR e.kind='tag') GROUP BY name""",(int(tags),))}
            for row in db.execute('SELECT name FROM user_categories'):
                counts.setdefault(row[0],0)
            return {'items':[{'name':k,'count':v} for k,v in sorted(counts.items())]}

    def manage_category(self,payload):
        action=payload.get('action')
        name=text(payload.get('new_name') if action=='create' else payload.get('name'),128)
        with self.write_lock,self.connect() as db:
            if action=='create':
                db.execute('INSERT INTO user_categories VALUES(?)',(name,))
            elif action in ('rename','delete'):
                new_name=text(payload.get('new_name'),128) if action=='rename' else '自定义'
                if name==new_name: raise ValueError('请选择不同的分类名称')
                sid=self.source(db,'user','user-owned')
                # All source reclassification uses the overlay; source records stay immutable.
                ids=[r[0] for r in db.execute("""SELECT e.id FROM entries e LEFT JOIN entry_overrides o ON o.entry_id=e.id WHERE COALESCE(o.category,e.category)=?""",(name,))]
                for eid in ids:
                    db.execute('INSERT INTO entry_overrides(entry_id,category) VALUES(?,?) ON CONFLICT(entry_id) DO UPDATE SET category=excluded.category,updated_at=CURRENT_TIMESTAMP',(eid,new_name))
                db.execute('DELETE FROM user_categories WHERE name=?',(name,))
                db.execute('INSERT OR IGNORE INTO user_categories VALUES(?)',(new_name,))
            else: raise ValueError('分类操作无效')
        return {'ok':True}

    def concept(self, cid):
        with self.connect() as db:
            row = db.execute('SELECT * FROM concepts WHERE id=?',(int(cid),)).fetchone()
            if not row:
                raise ValueError('义项不存在')
            return {**dict(row), 'terms':[dict(r) for r in db.execute('SELECT t.*,ct.preferred,ct.context FROM terms t JOIN concept_terms ct ON ct.term_id=t.id WHERE ct.concept_id=?',(cid,))],
                'tags':[dict(r) for r in db.execute('SELECT t.* FROM tags t JOIN tag_concepts tc ON tc.tag_id=t.id WHERE tc.concept_id=?',(cid,))],
                'relations':[dict(r) for r in db.execute('SELECT * FROM concept_relations WHERE source_id=? OR target_id=?',(cid,cid))]}

    def save_entry(self, payload, eid=None, delete=False):
        with self.write_lock, self.connect() as db:
            sid = self.source(db,'user','user-owned')
            old = db.execute('SELECT * FROM entries WHERE id=?',(int(eid),)).fetchone() if eid else None
            if eid and not old:
                raise ValueError('词条不存在')
            if delete:
                if old['source_id'] == sid:
                    db.execute('DELETE FROM entries WHERE id=?',(eid,))
                    if old['snippet_id']:
                        db.execute('DELETE FROM prompt_snippets WHERE id=?',(old['snippet_id'],))
                else:
                    db.execute('INSERT INTO entry_overrides(entry_id,disabled) VALUES(?,1) ON CONFLICT(entry_id) DO UPDATE SET disabled=1,updated_at=CURRENT_TIMESTAMP',(eid,))
                return {'ok':True}
            if old and payload.get('reset_override'):
                db.execute('DELETE FROM entry_overrides WHERE entry_id=?',(eid,))
                db.execute('DELETE FROM entry_name_overrides WHERE entry_id=?',(eid,))
                self._index(db,eid)
                return {'ok':True,'id':eid}
            if payload.get('maintenance'):
                label=text(payload.get('label')); output=text(payload.get('output'))
                if re.search(r'[,，。\n\r]',output):
                    raise ValueError('请一次添加一个标签，不要输入整段提示词')
                candidates=[r[0] for r in db.execute("""SELECT DISTINCT e.id FROM entries e
                    JOIN search_names n ON n.entry_id=e.id WHERE e.kind='tag' AND e.id!=?
                    AND n.lang='en' AND n.normalized=?""",(int(eid or 0),norm(output)))]
                matches=self._rows(db,candidates)
                if any(norm(label) in {norm(t) for t in r['translations']} for r in matches):
                    raise ValueError('这个标签已经存在，请查看已有标签')
                if not old and matches and not payload.get('allow_new_sense'):
                    raise ValueError('已有相同英文标签，请选择补充已有标签或添加新的含义')
                if old and old['source_id']!=sid and output!=old['output']:
                    raise ValueError('导入标签的英文名称不能修改，请添加新标签')
            if 'names' in payload:
                names=payload['names']
                if not isinstance(names,list) or len(names)>100:
                    raise ValueError('其他叫法最多 100 个')
                names=list(dict.fromkeys(text(value) for value in names))
            if old and old['source_id'] != sid:
                # Source rows are immutable. Only user-owned fields are updatable.
                current = db.execute('SELECT * FROM entry_overrides WHERE entry_id=?',(eid,)).fetchone()
                values = dict(current) if current else {'label':None,'category':None,'model':None,'preferred':0,'disabled':0}
                for k in ('label','category','model'):
                    if k in payload:
                        values[k] = text(payload[k],128 if k=='category' else 2048)
                for k in ('preferred','disabled'):
                    if k in payload:
                        values[k] = int(bool(payload[k]))
                db.execute('''INSERT INTO entry_overrides(entry_id,label,category,model,preferred,disabled) VALUES(?,?,?,?,?,?) ON CONFLICT(entry_id) DO UPDATE SET label=excluded.label,category=excluded.category,model=excluded.model,preferred=excluded.preferred,disabled=excluded.disabled,updated_at=CURRENT_TIMESTAMP''',
                    (eid,values['label'],values['category'],values['model'],values['preferred'],values['disabled']))
            else:
                base = dict(old) if old else {}
                base.update(payload)
                kind = base.get('kind','tag')
                if kind not in ('tag','snippet') or (old and old['kind'] != kind):
                    raise ValueError('类型无效；改变类型请新建词条')
                label,output,category = text(base.get('label')),base.get('output'),text(base.get('category') or '自定义',128)
                text(output,65536)
                duplicate = db.execute('SELECT id FROM entries WHERE source_id=? AND label=? AND output=? AND category=? AND id!=?', (sid,label,output,category,int(eid or 0))).fetchone()
                if duplicate:
                    raise ValueError('已有相同词条，请编辑原条目或区分义项')
                eid = self._entry(db,sid,old['source_key'] if old else uuid.uuid4().hex,label,output,category,kind,concept_id=base.get('concept_id'),namespace='user')
                db.execute('UPDATE entries SET model=? WHERE id=?',(text(base.get('model') or '*',256),eid))
                if kind == 'tag':
                    cid = db.execute('SELECT concept_id FROM entries WHERE id=?',(eid,)).fetchone()[0]
                    if 'sense' in payload:
                        db.execute('UPDATE concepts SET sense=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',(text(payload['sense']),cid))
                    terms = payload.get('terms',[])
                    if not isinstance(terms,list) or len(terms)>100:
                        raise ValueError('多语言词形最多 100 个')
                    removals=payload.get('remove_terms',[])
                    if not isinstance(removals,list) or len(removals)>100: raise ValueError('移除词形列表无效')
                    for t in removals:
                        value,lang=text(t.get('value')),text(t.get('lang'),24)
                        if db.execute('SELECT 1 FROM entries WHERE concept_id=? AND (label=? OR output=?)',(cid,value,value)).fetchone():
                            raise ValueError('不能移除义项中仍被词条使用的名称')
                        db.execute('DELETE FROM concept_terms WHERE concept_id=? AND term_id IN (SELECT id FROM terms WHERE value=? AND lang=?)',(cid,value,lang))
                    for t in terms:
                        self._term(db,cid,t.get('value'),t.get('lang'),t.get('preferred',False))
                    # Shared concepts may have several entries; refresh all their term indexes.
                    for r in db.execute('SELECT id FROM entries WHERE concept_id=?',(cid,)).fetchall():
                        self._index(db,r[0])
                db.execute('INSERT INTO entry_overrides(entry_id,preferred,disabled) VALUES(?,?,?) ON CONFLICT(entry_id) DO UPDATE SET label=NULL,category=NULL,model=NULL,preferred=excluded.preferred,disabled=excluded.disabled', (eid,int(bool(base.get('preferred'))),int(bool(base.get('disabled')))))
            if 'names' in payload:
                db.execute('INSERT OR REPLACE INTO entry_name_overrides VALUES(?,?)',(eid,json.dumps(names,ensure_ascii=False)))
            self._index(db,eid)
            return {'ok':True,'id':eid}

    def relation(self, payload):
        a,b = int(payload.get('source_id')),int(payload.get('target_id'))
        relation = payload.get('relation')
        if relation not in RELATIONS or a==b:
            raise ValueError('关系类型或义项无效')
        with self.write_lock, self.connect() as db:
            sid = self.source(db,'user','user-owned')
            if payload.get('delete'):
                db.execute('DELETE FROM concept_relations WHERE source_id=? AND target_id=? AND relation=?',(a,b,relation))
            else:
                db.execute('INSERT OR REPLACE INTO concept_relations VALUES(?,?,?,?)',(a,b,relation,sid))
        return {'ok':True}

    def migrate(self, payload):
        frags = payload.get('frags')
        if not isinstance(frags,dict) or len(frags)>1000:
            raise ValueError('旧词库结构无效')
        raw = json.dumps(frags,ensure_ascii=False,sort_keys=True,separators=(',',':'))
        digest = hashlib.sha256(raw.encode()).hexdigest()
        with self.write_lock, self.connect() as db:
            old = db.execute('SELECT result FROM legacy_migrations WHERE digest=?',(digest,)).fetchone()
            if old:
                return {**json.loads(old[0]),'already_migrated':True}
            sid = self.source(db,'user','user-owned')
            ids = []
            total=0
            for cat, pairs in frags.items():
                text(cat,128)
                if not isinstance(pairs,list):
                    raise ValueError('旧分类必须是数组')
                for pair in pairs:
                    total+=1
                    if total>20000 or not isinstance(pair,list) or len(pair)!=2:
                        raise ValueError('旧词条无效或超过 20000 条')
                    label,output = text(pair[0]),pair[1]
                    text(output,65536)
                    # Stable per-pair identity handles retries and changed category snapshots.
                    key='legacy-'+hashlib.sha256(json.dumps([cat,label,output],ensure_ascii=False).encode()).hexdigest()
                    exists = db.execute('SELECT id FROM entries WHERE source_id=? AND source_key=?',(sid,key)).fetchone()
                    if not exists:
                        ids.append(self._entry(db,sid,key,label,output,cat,'snippet'))
            result={'ok':True,'digest':digest,'created':len(ids),'ids':ids}
            db.execute('INSERT INTO legacy_migrations VALUES(?,?,?,CURRENT_TIMESTAMP)',(digest,raw,json.dumps(result)))
            return result

    def export(self):
        with self.connect() as db:
            sid=self.source(db,'user','user-owned')
            ids=[r[0] for r in db.execute('SELECT id FROM entries WHERE source_id=?',(sid,))]
            entries=self._rows(db,ids)
            for row in entries:
                if row['concept_id']:
                    row['terms']=[dict(r) for r in db.execute('SELECT t.lang,t.value FROM terms t JOIN concept_terms ct ON ct.term_id=t.id WHERE ct.concept_id=?',(row['concept_id'],))]
            for row in entries:
                custom=db.execute('SELECT names FROM entry_name_overrides WHERE entry_id=?',(row['id'],)).fetchone()
                if custom: row['names']=json.loads(custom[0])
            overrides=[dict(r) for r in db.execute('SELECT o.*,s.source_key AS source,e.source_key AS key FROM entry_overrides o JOIN entries e ON e.id=o.entry_id JOIN sources s ON s.id=e.source_id WHERE e.source_id!=?',(sid,))]
            for row in overrides:
                custom=db.execute('SELECT names FROM entry_name_overrides WHERE entry_id=?',(row['entry_id'],)).fetchone()
                if custom: row['names']=json.loads(custom[0])
            return {'format':'dsh-tag-library-user','version':1,'entries':entries,
                'categories':[r[0] for r in db.execute('SELECT name FROM user_categories')],
                'overrides':overrides,
                'relations':[dict(r) for r in db.execute('SELECT * FROM concept_relations WHERE provenance=?',(sid,))]}

    def restore_user(self,payload):
        if payload.get('format')!='dsh-tag-library-user' or payload.get('version')!=1:
            raise ValueError('不是 DSH 用户词库 JSON')
        entries=payload.get('entries')
        if not isinstance(entries,list) or len(entries)>20000:
            raise ValueError('JSON 词条数量无效')
        backup=self.backup()
        # Validate the full payload before making any mutation. Run restore on a
        # temporary SQLite copy, then copy back under the single writer lock.
        temp=self.path.parent/('restore-'+uuid.uuid4().hex+'.sqlite3')
        try:
            with self.write_lock:
                with self.connect() as db, closing(sqlite3.connect(str(temp))) as out: db.backup(out)
                other=Dictionary(temp,recover=False)
                concept_map={}; imported=0; unresolved=0
                for row in entries:
                    data={k:row[k] for k in ('kind','label','output','category','model','preferred','disabled','sense','terms','names') if k in row}
                    old_cid=row.get('concept_id')
                    if old_cid in concept_map: data['concept_id']=concept_map[old_cid]
                    with other.connect() as db:
                        existing=db.execute("""SELECT e.id FROM entries e JOIN sources s ON s.id=e.source_id WHERE s.source_key='user' AND e.source_key=?""",(row.get('source_key',''),)).fetchone()
                    if existing:
                        eid=existing[0];other.save_entry(data,eid)
                    else:
                        result=other.save_entry(data);eid=result['id']
                        if row.get('source_key'):
                            with other.connect() as db: db.execute('UPDATE entries SET source_key=? WHERE id=?',(text(row['source_key']),eid))
                    if old_cid:
                        with other.connect() as db: concept_map[old_cid]=db.execute('SELECT concept_id FROM entries WHERE id=?',(eid,)).fetchone()[0]
                    imported+=1
                for cat in payload.get('categories',[]):
                    with other.connect() as db: db.execute('INSERT OR IGNORE INTO user_categories VALUES(?)',(text(cat,128),))
                for row in payload.get('overrides',[]):
                    with other.connect() as db:
                        entry=db.execute('SELECT e.id FROM entries e JOIN sources s ON s.id=e.source_id WHERE s.source_key=? AND e.source_key=?',(row.get('source'),row.get('key'))).fetchone()
                    if entry: other.save_entry({k:row[k] for k in ('label','category','model','preferred','disabled','names') if row.get(k) is not None},entry[0])
                    else: unresolved+=1
                for row in payload.get('relations',[]):
                    a,b=concept_map.get(row['source_id']),concept_map.get(row['target_id'])
                    if a and b: other.relation({'source_id':a,'target_id':b,'relation':row['relation']})
                    else: unresolved+=1
                with other.connect() as src,self.connect() as live: src.backup(live)
        finally:
            temp.unlink(missing_ok=True)
        return {'ok':True,'imported':imported,'unresolved_source_links':unresolved,'backup':backup['path']}

    def backup(self):
        folder = self.path.parent/'backups'
        folder.mkdir(exist_ok=True)
        dest=folder/('tags-'+time.strftime('%Y%m%d-%H%M%S')+'-'+uuid.uuid4().hex[:6]+'.sqlite3')
        with self.connect() as db, closing(sqlite3.connect(str(dest))) as out:
            db.backup(out)
        return {'ok':True,'path':str(dest)}

    def translate(self,payload):
        value=text(payload.get('text'),8000)
        choices=payload.get('choices') or {}
        if not isinstance(choices,dict):
            raise ValueError('义项选择无效')
        parts=[]; hits=[]; misses=[]; ambiguities=[]
        # Longest exact match within each Chinese run, using indexed lookups.
        # No first-result guessing when multiple outputs have the same surface word.
        with self.connect() as db:
            for token in re.findall(r'[\u3400-\u9fff]+|[^\u3400-\u9fff]+',value):
                if not re.search(r'[\u3400-\u9fff]',token):
                    parts.append(token); continue
                i=0
                while i<len(token):
                    matched=False
                    for end in range(min(len(token),i+48),i,-1):
                        word=token[i:end]
                        ids=[r[0] for r in db.execute('SELECT entry_id FROM search_names WHERE normalized=? LIMIT 101',(norm(word),))]
                        candidates=[r for r in self._rows(db,ids) if not r['disabled']]
                        if not candidates: continue
                        by_output={}
                        for r in sorted(candidates,key=lambda r:(-r['preferred'],r['id'])):
                            by_output.setdefault(r['output'],r)
                        candidates=list(by_output.values())
                        chosen=next((r for r in candidates if str(r['id'])==str(choices.get(word,''))),None)
                        preferred=[r for r in candidates if r['preferred']]
                        if not chosen and len(preferred)==1: chosen=preferred[0]
                        if not chosen and len(candidates)==1: chosen=candidates[0]
                        if chosen:
                            parts.append(', \x01'+str(len(hits))+'\x02, '); hits.append([word,chosen['output']])
                        else:
                            ambiguities.append({'word':word,'items':candidates[:100]}); parts.append(word)
                        i=end; matched=True; break
                    if not matched:
                        misses.append(token[i]); parts.append(token[i]); i+=1
        out=''.join(parts)
        out=re.sub(r'[,，、；]+\s*',', ',out).strip(', \n')
        out=re.sub(r'\x01(\d+)\x02',lambda m:hits[int(m[1])][1],out)
        return {'out':out,'hits':hits,'misses':sorted(set(misses)),'ambiguities':ambiguities}

    def new_upload(self,payload):
        size=int(payload.get('size',0))
        if not 16<=size<=MAX_UPLOAD:
            raise ValueError('SQLite 数据文件须为 16 字节至 256 MiB')
        folder=self.path.parent/'inbox'
        folder.mkdir(exist_ok=True)
        with self.jobs_lock:
            # Bounded staging, no client-supplied file paths and no arbitrary overwrite.
            now=time.time()
            for key,v in list(self.uploads.items()):
                if now-v['time']>3600:
                    v['path'].unlink(missing_ok=True); self.uploads.pop(key)
            if len(self.uploads)>=3:
                raise ValueError('已有三个待处理上传，请先导入或稍后重试')
            key=uuid.uuid4().hex
            path=folder/(key+'.sqlite')
            path.touch(exist_ok=False)
            self.uploads[key]={'path':path,'size':size,'offset':0,'time':now}
        return {'upload_id':key,'offset':0}

    def upload_chunk(self,key,payload):
        encoded=payload.get('data','')
        if not isinstance(encoded,str) or len(encoded)>1500000:
            raise ValueError('上传分块过大')
        chunk=base64.b64decode(encoded,validate=True)
        with self.jobs_lock:
            item=self.uploads.get(key)
            if not item or int(payload.get('offset',-1))!=item['offset']:
                raise ValueError('上传已过期或分块顺序错误')
            if not chunk or item['offset']+len(chunk)>item['size']:
                raise ValueError('上传长度无效')
            with item['path'].open('ab') as f: f.write(chunk)
            item['offset']+=len(chunk); item['time']=time.time()
            return {'upload_id':key,'offset':item['offset'],'complete':item['offset']==item['size']}

    def cancel_upload(self,key):
        with self.jobs_lock:
            item=self.uploads.pop(key,None)
            if item:item['path'].unlink(missing_ok=True)
        return {'ok':True}

    def start_import(self,payload):
        kind=payload.get('kind')
        if kind not in ('ffdkj','grio43'):
            raise ValueError('支持 ffdkj 中英库或 grio43 关系库')
        with self.jobs_lock:
            if any(j['status'] in ('queued','running') for j in self.jobs.values()):
                raise ValueError('已有导入正在进行')
            item=self.uploads.get(payload.get('upload_id'))
            if not item or item['offset']!=item['size']:
                raise ValueError('请先完整上传 SQLite 文件')
            self.uploads.pop(payload['upload_id'])
            job_id=uuid.uuid4().hex
            job={'id':job_id,'status':'queued','processed':0,'total':0,'detail':'检查数据结构…','cancel':threading.Event()}
            for key in list(self.jobs)[:-20]:
                if self.jobs[key]['status'] not in ('queued','running'):self.jobs.pop(key)
            self.jobs[job_id]=job
        thread=threading.Thread(target=self._import_worker,args=(item['path'],kind,payload,job),daemon=True)
        thread.start()
        return {'ok':True,'id':job_id,'status':'queued'}

    def import_progress(self,key,cancel=False):
        with self.jobs_lock:
            job=self.jobs.get(key)
            if job:
                if cancel: job['cancel'].set()
                return {k:v for k,v in job.items() if k!='cancel'}
        with self.connect() as db:
            row=db.execute('SELECT * FROM import_runs WHERE id=?',(key,)).fetchone()
            if not row: raise ValueError('导入记录不存在')
            return dict(row)

    @staticmethod
    def _tables(src):
        return {r[0]:{c[1] for c in src.execute('PRAGMA table_info("'+r[0].replace('"','""')+'")')}
                for r in src.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")}

    def _import_worker(self,path,kind,payload,job):
        sid=None; digest=''; src=None; final_status='failed'
        try:
            sha=hashlib.sha256()
            with open(path,'rb') as f:
                if f.read(16)!=b'SQLite format 3\x00': raise ValueError('不是有效的 SQLite 数据库')
                f.seek(0)
                for chunk in iter(lambda:f.read(1024*1024),b''):
                    if job['cancel'].is_set(): raise InterruptedError('已取消')
                    sha.update(chunk)
            digest=sha.hexdigest()
            src=sqlite3.connect(Path(path).resolve().as_uri()+'?mode=ro',uri=True)
            src.row_factory=sqlite3.Row
            src.execute('PRAGMA query_only=ON')
            src.execute('PRAGMA trusted_schema=OFF')
            src.set_progress_handler(lambda:1 if job['cancel'].is_set() else 0,10000)
            tables=self._tables(src)
            mapping={}
            if kind=='ffdkj':
                matches=[name for name,cols in tables.items() if {'name','category','cn_name','post_count'}<=cols]
                if len(matches)!=1: raise ValueError('未找到唯一的中英 Tag 表：须含 name/category/cn_name/post_count')
                mapping={'tags':matches[0]}
            else:
                if not all({'a','b','status'}<=tables.get(t,set()) for t in ('aliases','implications')):
                    raise ValueError('关系库须含 aliases/implications(a,b,status)，不猜测未知状态字段')
                for table in ('aliases','implications'):
                    states={r[0] for r in src.execute('SELECT DISTINCT status FROM '+table)}
                    if states-{'active','deleted','pending','retired','processing','queued','rejected','error'}:
                        raise ValueError('未知关系状态：'+str(states))
                mapping={'aliases':['a','b','status'],'implications':['a','b','status']}
            license=text(payload.get('license') or 'unconfirmed',512)
            version=text(payload.get('version') or digest[:12],128)
            with self.write_lock,self.connect() as db:
                sid=self.source(db,kind,license,version)
                db.execute('INSERT INTO import_runs(id,source_id,sha256,status,mapping) VALUES(?,?,?,?,?)', (job['id'],sid,digest,'running',json.dumps(mapping)))
                if kind=='grio43':
                    db.execute('CREATE TABLE IF NOT EXISTS pending_edges(run_id TEXT,kind TEXT,a TEXT,b TEXT,PRIMARY KEY(run_id,kind,a,b))')
            job.update(status='running',detail='导入中…')
            def batches(cursor):
                while True:
                    rows=cursor.fetchmany(500)
                    if not rows: break
                    if job['cancel'].is_set(): raise InterruptedError('已取消；已完成批次保留，可重新导入')
                    yield rows
            if kind=='ffdkj':
                table='"'+mapping['tags'].replace('"','""')+'"'
                job['total']=src.execute('SELECT count(*) FROM '+table).fetchone()[0]
                category_map={0:'常规',1:'艺术家',3:'作品',4:'角色',5:'元数据'}
                for rows in batches(src.execute('SELECT name,category,cn_name,post_count FROM '+table+' ORDER BY CASE WHEN category=0 THEN 0 ELSE 1 END,post_count DESC')):
                    with self.write_lock,self.connect() as db:
                        for r in rows:
                            raw=text(r['name']); cn=text(r['cn_name'] or raw)
                            cat=category_map.get(int(r['category'] or 0),str(r['category']))
                            graph=db.execute("""SELECT e.concept_id FROM entries e JOIN sources s ON s.id=e.source_id JOIN tags t ON t.id=e.tag_id WHERE t.namespace='danbooru' AND t.raw_name=? AND s.source_key='grio43' LIMIT 1""",(raw,)).fetchone()
                            # A graph placeholder refers to exactly this namespaced Tag,
                            # not to a merely identical Chinese translation.
                            eid=self._entry(db,sid,raw,cn,raw,cat,'tag',.35,concept_id=graph[0] if graph else None,namespace='danbooru')
                            if graph:
                                db.execute('UPDATE concepts SET sense=?,confidence=MIN(confidence,.35) WHERE id=?',(cn,graph[0]))
                            db.execute('UPDATE tags SET category=?,post_count=?,updated_at=CURRENT_TIMESTAMP WHERE id=(SELECT tag_id FROM entries WHERE id=?)', (cat,max(0,int(r['post_count'] or 0)),eid))
                        job['processed']+=len(rows)
                        db.execute('UPDATE import_runs SET processed=?,total=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',(job['processed'],job['total'],job['id']))
            else:
                job['total']=sum(src.execute('SELECT count(*) FROM '+t+" WHERE status='active'").fetchone()[0] for t in ('aliases','implications'))
                for table in ('aliases','implications'):
                    for rows in batches(src.execute('SELECT a,b FROM '+table+" WHERE status='active'")):
                        with self.write_lock,self.connect() as db:
                            for r in rows:
                                a,b=text(r['a']),text(r['b'])
                                db.execute('INSERT OR IGNORE INTO pending_edges VALUES(?,?,?,?)',(job['id'],table,a,b))
                                for name in (b,) if table=='aliases' else (a,b):
                                    tid=self._tag(db,name)
                                    if not db.execute('SELECT id FROM entries WHERE tag_id=? LIMIT 1',(tid,)).fetchone():
                                        self._entry(db,sid,name,name,name,'常规','tag',.5,namespace='danbooru')
                            job['processed']+=len(rows)
                            db.execute('UPDATE import_runs SET processed=?,total=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',(job['processed'],job['total'],job['id']))
                # Replace active edges only after the whole snapshot passed validation.
                # Cancelled/invalid snapshots cannot erase the previous valid graph.
                with self.write_lock,self.connect() as db:
                    if job['cancel'].is_set(): raise InterruptedError('已取消')
                    db.execute('DELETE FROM tag_aliases WHERE source_id=?',(sid,))
                    db.execute('DELETE FROM tag_implications WHERE source_id=?',(sid,))
                    for r in db.execute('SELECT * FROM pending_edges WHERE run_id=?',(job['id'],)).fetchall():
                        b=self._tag(db,r['b'])
                        if r['kind']=='aliases':
                            db.execute('INSERT OR REPLACE INTO tag_aliases VALUES(?,?,?,?)',(sid,r['a'],norm(r['a']),b))
                        else:
                            a=self._tag(db,r['a'])
                            db.execute('INSERT OR IGNORE INTO tag_implications VALUES(?,?,?)',(sid,a,b))
                    db.execute('DELETE FROM pending_edges WHERE run_id=?',(job['id'],))
            with self.write_lock,self.connect() as db:
                db.execute('UPDATE sources SET version=?,license=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',(version,license,sid))
            final_status='completed'
            job['detail']='导入完成'
        except Exception as ex:
            final_status='cancelled' if job['cancel'].is_set() or isinstance(ex,InterruptedError) else 'failed'
            job['detail']=str(ex)[:1000]
        finally:
            if src: src.close()
            with self.write_lock,self.connect() as db:
                db.execute('INSERT OR IGNORE INTO import_runs(id,source_id,sha256,status) VALUES(?,?,?,?)',(job['id'],sid,digest,final_status))
                db.execute('UPDATE import_runs SET status=?,processed=?,total=?,detail=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',(final_status,job['processed'],job['total'],job['detail'],job['id']))
                if db.execute("SELECT 1 FROM sqlite_master WHERE name='pending_edges'").fetchone():
                    db.execute('DELETE FROM pending_edges WHERE run_id=?',(job['id'],))
            Path(path).unlink(missing_ok=True)
            # Publish terminal state only after audit commit + staging cleanup.
            job['status']=final_status

    def handle(self,method,path,query,payload):
        """Route dictionary requests only. Returns a JSON-serializable value."""
        tail=path.removeprefix('/dictionary').strip('/')
        get=lambda key,default='':query.get(key,[default])[0]
        if method=='GET':
            if tail=='status': return self.status()
            if tail=='categories': return self.categories(get('tags')=='1')
            if tail=='browse': return self.browse(get('q'),get('limit',50),get('offset',0),get('category'),get('own')=='1',get('disabled')=='1')
            if tail=='duplicates': return self.duplicates(get('english'),get('chinese'),get('exclude',0))
            if tail=='search': return self.search(get('q'),get('limit',30),get('offset',0),get('category'),get('disabled')=='1',get('related','1')!='0',get('lang'),get('completion')=='1')
            if re.fullmatch(r'concepts/\d+',tail): return self.concept(int(tail.split('/')[1]))
            if tail.startswith('imports/'): return self.import_progress(tail.split('/')[1])
            if tail=='export': return self.export()
        if method=='POST':
            if tail=='custom-entry': return self.save_entry(payload)
            if tail=='categories': return self.manage_category(payload)
            if tail=='restore-user': return self.restore_user(payload)
            if tail=='concept-relations': return self.relation(payload)
            if tail=='migrate/legacy': return self.migrate(payload)
            if tail=='translate': return self.translate(payload)
            if tail=='backup': return self.backup()
            if tail=='uploads': return self.new_upload(payload)
            if re.fullmatch(r'uploads/[a-f0-9]{32}',tail): return self.upload_chunk(tail.split('/')[1],payload)
            if re.fullmatch(r'uploads/[a-f0-9]{32}/cancel',tail): return self.cancel_upload(tail.split('/')[1])
            if tail=='import': return self.start_import(payload)
            if re.fullmatch(r'imports/[a-f0-9]{32}/cancel',tail): return self.import_progress(tail.split('/')[1],True)
        if method in ('PATCH','DELETE') and re.fullmatch(r'custom-entry/\d+',tail):
            return self.save_entry(payload,int(tail.split('/')[1]),method=='DELETE')
        raise ValueError('不支持的词库接口')
