"""Indexed, read-only source catalogs, kept separate from personal SQLite data."""
from pathlib import Path
import hashlib,json,os,re,shutil,sqlite3,unicodedata,uuid

def norm(value):
    return ' '.join(unicodedata.normalize('NFKC',str(value)).casefold().replace('_',' ').split())

class Vocabulary:
    def __init__(self,root,cache=None):
        self.root=Path(root)
        guidance=self.root/"prompt_guidance.json"
        self.guidance=json.loads(guidance.read_text(encoding="utf8")) if guidance.is_file() else {}
        manifest=self.root/'manifest.json'
        if cache and manifest.is_file():
            meta=json.loads(manifest.read_text(encoding='utf-8'))
            revision=hashlib.sha256(manifest.read_bytes()).hexdigest()[:20]
            local=Path(cache)/revision
            local.mkdir(parents=True,exist_ok=True)
            for kind in ['danbooru','translation']:
                expected=meta['catalogs'][kind]['sha256']
                if not re.fullmatch('[a-f0-9]{64}',expected):raise ValueError('内置词库校验信息无效')
                target=local/(kind+'.sqlite3')
                if target.is_file() and hashlib.sha256(target.read_bytes()).hexdigest()==expected:continue
                temp=target.with_name(target.name+'.'+uuid.uuid4().hex+'.tmp')
                try:
                    shutil.copyfile(self.root/target.name,temp)
                    if hashlib.sha256(temp.read_bytes()).hexdigest()!=expected:raise ValueError('内置词库文件校验不匹配')
                    os.replace(temp,target)
                finally:temp.unlink(missing_ok=True)
            temporary=local/('manifest-'+uuid.uuid4().hex+'.tmp')
            temporary.write_bytes(manifest.read_bytes());os.replace(temporary,local/'manifest.json')
            self.root=local

    def status(self):
        manifest=self.root/'manifest.json'
        if not manifest.is_file():return {'ready':False,'counts':{}}
        meta=json.loads(manifest.read_text(encoding='utf-8'))
        return {'ready':all((self.root/(kind+'.sqlite3')).is_file() for kind in meta['catalogs']),
                'counts':{k:v['entries'] for k,v in meta['catalogs'].items()},'format':meta['format']}

    def search(self,query,limit=60,exact=False,completion=False):
        query=norm(query)
        if not query:return []
        rows=[]
        for kind in ['danbooru','translation']:
            path=self.root/(kind+'.sqlite3')
            if not path.is_file():continue
            db=sqlite3.connect(path.resolve().as_uri()+'?mode=ro&immutable=1',uri=True)
            db.row_factory=sqlite3.Row
            try:
                predicate='n.normalized=?' if exact else 'n.normalized>=? AND n.normalized<?'
                args=(query,) if exact else (query,query+'\U0010ffff')
                # Limit exact and prefix independently: very common short prefixes
                # must not hide an exact match behind arbitrary source order.
                ids={r['entry_id']:0 for r in db.execute('SELECT entry_id FROM names WHERE normalized=? LIMIT 300',(query,))}
                if not exact:
                    for r in db.execute('SELECT entry_id FROM names n WHERE '+predicate+' LIMIT 1200',args):ids.setdefault(r[0],1)
                if not ids:continue
                marks=','.join('?'*len(ids))
                names={}
                for alias in db.execute('SELECT entry_id,normalized FROM names WHERE entry_id IN ('+marks+')',list(ids)):
                    if re.search(r'[\u3400-\u9fff]',alias['normalized']): names.setdefault(alias['entry_id'],[]).append(alias['normalized'])
                for stored in db.execute('SELECT * FROM entries WHERE id IN ('+marks+')',list(ids)):
                    row=dict(stored);row.update(id=kind+':'+str(row['id']),kind='tag' if kind=='danbooru' else 'translation',
                        types=['标签'] if kind=='danbooru' else ['翻译'],namespace='danbooru' if kind=='danbooru' else '',
                        translations=list(dict.fromkeys([row['label']]+names.get(stored['id'],[])))[:12],preferred=0,disabled=0,confidence=1,relation=('exact' if query in (norm(row['label']),norm(row['output'])) else 'alias') if ids[stored['id']]==0 else 'prefix',
                        catalog=True)
                    rows.append(row)
            finally:db.close()
        # A one-character Chinese headword is highly polysemous. For exact
        # single-character queries, keep only the first (primary) CC-CEDICT
        # sense per simplified headword; users can refine the phrase for less
        # common meanings instead of seeing unrelated English glosses.
        if len(query)==1 and re.search(r'[\u3400-\u9fff]',query):
            primary={}
            for row in rows:
                if row['kind']!='translation' or row.get('source')!='CC-CEDICT' or row['relation']!='exact' or len(row['label'])!=1:continue
                try:ordinal=int(str(row['id']).rsplit(':',1)[-1])
                except ValueError:ordinal=10**12
                label=norm(row['label'])
                if label not in primary or ordinal<primary[label][0]:primary[label]=(ordinal,row['id'])
            keep={item[1] for item in primary.values()}
            rows=[row for row in rows if not (row['kind']=='translation' and row.get('source')=='CC-CEDICT' and row['relation']=='exact' and len(row['label'])==1 and row['id'] not in keep)]

        # CC-CEDICT is Chinese→English, so English words and phrases can match
        # many Chinese character senses that are technically valid but poor
        # standalone prompt translations.
        # Keep autocomplete prompt-focused: exact Danbooru terms win, rare
        # single-character reverse senses are omitted, and at most two useful
        # dictionary senses are shown for one English word. Chinese searches
        # and multiword phrases still retain the full dictionary results.
        if re.fullmatch(r'[a-z]+(?: [a-z]+)*',query):
            exact_tags=[r for r in rows if r['kind']=='tag' and r['relation']=='exact' and norm(r['output'])==query]
            tag_names={norm(value) for row in exact_tags for value in [row['label']]+row['translations']
                       if re.search(r'[\u3400-\u9fff]',value)}
            reverse=[r for r in rows if r['kind']=='translation' and r['source']=='CC-CEDICT'
                     and r['relation']=='exact' and norm(r['output'])==query]
            if reverse:
                db=sqlite3.connect((self.root/'translation.sqlite3').resolve().as_uri()+'?mode=ro&immutable=1',uri=True)
                try:
                    labels=list(dict.fromkeys(r['label'] for r in reverse))
                    marks=','.join('?'*len(labels))
                    frequencies={label:count for label,count in db.execute(
                        'SELECT label,count(*) FROM entries WHERE label IN ('+marks+') GROUP BY label',labels)}
                finally:db.close()
                by_output={}
                for row in reverse:
                    chinese_names={norm(value) for value in [row['label']]+row['translations']
                                   if re.search(r'[\u3400-\u9fff]',value)}
                    # Keep only a translation that agrees with an exact
                    # verified tag; unrelated dictionary senses add noise.
                    if exact_tags and not chinese_names.intersection(tag_names):
                        continue
                    label=row['label']
                    # Single-character Chinese glosses are not useful reverse
                    # translations for an English word (e.g. chief → 长/头).
                    # Keep them only when they corroborate a verified exact tag.
                    if len(label)==1 and not (exact_tags and chinese_names.intersection(tag_names)):
                        continue
                    has_rare_extension=any(0x20000<=ord(char)<=0x3134F for char in label)
                    if len(label)==1 and (frequencies.get(label,0)<6 or has_rare_extension):
                        continue
                    row['_label_frequency']=frequencies.get(label,0)
                    by_output.setdefault(norm(row['output']),[]).append(row)
                keep=set()
                for group in by_output.values():
                    group.sort(key=lambda r:(-r.get('_label_frequency',0),len(r['label']),str(r['id'])))
                    keep.update(r['id'] for r in group[:2])
                rows=[r for r in rows if r not in reverse or r['id'] in keep]
                for row in reverse:row.pop('_label_frequency',None)
        if completion:rows=self.prompt_rows(rows,query)
        rows.sort(key=lambda r:({'exact':0,'alias':1,'prefix':2}.get(r['relation'],3),r['kind']!='tag',r.get('source')!='DSH authored supplement',-r['post_count'],str(r['id'])))
        return rows[:max(1,min(int(limit),300))]

    def prompt_rows(self, rows, query):
        """Prompt-facing quality policy. Never changes source or personal databases."""
        common=self.guidance.get('common',[])
        overrides={norm(row[0]) for row in common}
        cleaned=[]
        simplified=str.maketrans(self.guidance.get('simplified_chars',{}))
        common_query=any(query in [norm(v) for v in [en,label]+aliases] for en,label,aliases in common)
        common_names={norm(en):[label]+aliases for en,label,aliases in common}
        editorial=re.compile(r'\b(?:archaic|obsolete|literary|dialect|surname|romanization|variant|classifier|phonetic|abbr|abbreviation|bound form|see also)\b',re.I)
        for original in rows:
            row=dict(original)
            row['label']=row['label'].translate(simplified)
            row['translations']=list(dict.fromkeys(value.translate(simplified) for value in row.get('translations',[row['label']])))
            if row.get('kind')=='tag' and norm(row['output']) in common_names:
                row['translations']=common_names[norm(row['output'])]
                row['label']=row['translations'][0]
            if common_query and row.get('category') in ('画师','作品','角色') and query not in (norm(row['output']),norm(row['label'])):
                continue
            if row.get('source')=='CC-CEDICT':
                meaning=row.get('sense','')+' '+row['output']
                if norm(row['output']) in overrides or editorial.search(meaning):continue
                if any(ord(c)>0xffff for c in row['label']):continue
                if len(row['output'].split())>12 or row['output'].startswith('('):continue
                if re.search(r'\b(?:used as|used in|refers to|lit\.|fig\.|e\.g\.)',meaning,re.I):continue
            cleaned.append(row)
        for index,(output,label,aliases) in enumerate(common):
            names=[output,label]+aliases
            exact=any(norm(name)==query for name in names)
            if not exact and not any(norm(name).startswith(query) for name in names):continue
            cleaned.append(dict(id='prompt-common:'+str(index),label=label,output=output,category='常用表达',sense='',
                post_count=0,source='DSH authored supplement',kind='translation',types=['翻译'],namespace='',
                translations=[label]+aliases,preferred=0,disabled=0,confidence=1,relation='exact' if exact else 'prefix',catalog=True))
        # Repeated general dictionary views become one compact candidate. Keep
        # attested tags and user-authored meanings distinct in merge_candidates.
        grouped={};result=[];fallback=0
        for row in cleaned:
            if row.get('source')=='CC-CEDICT':
                key=norm(row['output'])
                if key in grouped:
                    target=grouped[key]
                    target['translations']=list(dict.fromkeys(target['translations']+row['translations']))[:3]
                    continue
                if fallback>=8:continue
                fallback+=1;grouped[key]=row
            result.append(row)
        return result

    def related(self, rows):
        """Small authored suggestions resolved to verified local tags, not synonyms."""
        anchor=next((row for row in rows if row.get('kind')=='tag' and row.get('relation') in ('exact','alias')),None)
        if not anchor:return None,[]
        outputs=self.guidance.get('related',{}).get(norm(anchor['output']),[])
        result=[];seen={norm(anchor['output'])}
        for output in outputs[:8]:
            choices=self.search(output,20,exact=True,completion=True)
            row=next((item for item in choices if item.get('kind')=='tag' and norm(item['output'])==norm(output)),None)
            if row and norm(row['output']) not in seen:
                seen.add(norm(row['output']));result.append({**row,'relation':'related','recommendation_source':'DSH authored prompt guidance'})
        return anchor,result[:6]


def kinds(row):
    if row.get('types'):return list(row['types'])
    if row.get('kind')=='translation':return ['翻译']
    # A historical storage type is not a booru attestation. Only a verified
    # Danbooru namespace can confer the 标签 badge.
    if row.get('kind')=='tag':return ['标签'] if row.get('namespace')=='danbooru' else ['翻译']
    output=row.get('output','')
    return ['词组'] if re.search(r'[,\n\r]',output) or len(output.split())>5 else ['翻译']

def merge_candidates(local,external,limit=30):
    items=[]
    for original in local+external:
        row=dict(original);row['types']=kinds(row)
        row['translations']=list(row.get('translations') or [row['label']])
        # Equal English text alone never establishes equal meaning. Require a
        # shared Chinese name, preserving Apple/company and other homonyms.
        names={norm(v) for v in [row['label']]+row['translations'] if re.search(r'[\u3400-\u9fff]',v)}
        existing=next((r for r in items if norm(r['output'])==norm(row['output']) and names.intersection(r['_names'])
                       and ('词组' in r['types'])==('词组' in row['types'])),None)
        if existing:
            existing['types']=list(dict.fromkeys(existing['types']+row['types']))
            existing['translations']=list(dict.fromkeys(existing['translations']+row['translations']))
            existing['_names'].update(names)
            existing['post_count']=max(existing.get('post_count',0),row.get('post_count',0))
            if row.get('relation')=='exact':existing['relation']='exact'
            if row.get('kind')=='tag':
                existing.update(kind='tag',namespace=row.get('namespace',''),output=row['output'])
                if not existing.get('preferred') and existing.get('source')!='user':existing['category']=row['category']
        else:row['_names']=names;items.append(row)
    verified={norm(r['output']) for r in items if '标签' in r['types']}
    items=[r for r in items if not (r.get('source')=='CC-CEDICT' and len(r['label'])==1 and norm(r['output']) in verified)]
    items.sort(key=lambda r:({'exact':0,'alias':1,'prefix':2}.get(r.get('relation'),3),-r.get('preferred',0),
                             r.get('source') not in ('user','DSH authored supplement'),
                             '标签' not in r['types'],-r.get('post_count',0),str(r['id'])))
    for row in items:
        row.pop('_names',None)
        row['types'].sort(key=lambda value:['词组','翻译','标签'].index(value))
    return items[:limit]
