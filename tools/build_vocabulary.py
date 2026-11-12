"""Build redistributable read-only dictionaries from pinned upstream snapshots.

Usage: python tools/build_vocabulary.py DOWNLOAD_DIRECTORY
User dictionaries are never opened or modified by this builder.
"""
from pathlib import Path
import csv,gzip,hashlib,json,re,sqlite3,sys,unicodedata

def norm(value):
    return ' '.join(unicodedata.normalize('NFKC',value).casefold().replace('_',' ').split())

SCHEMA='''CREATE TABLE entries(id INTEGER PRIMARY KEY,label TEXT NOT NULL,output TEXT NOT NULL,
 category TEXT NOT NULL,sense TEXT NOT NULL,post_count INTEGER NOT NULL,source TEXT NOT NULL);
 CREATE TABLE names(normalized TEXT NOT NULL,entry_id INTEGER NOT NULL,PRIMARY KEY(normalized,entry_id)) WITHOUT ROWID;
 CREATE INDEX names_entry ON names(entry_id);
 CREATE INDEX output_exact ON entries(output);
 CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);'''

def build(downloads, dest):
    dest.mkdir(parents=True,exist_ok=True)
    manifest=json.loads((downloads/'manifest.json').read_text(encoding='utf-8'))
    for entry in manifest['files']:
        if entry['file'].endswith('.argosmodel'):continue
        if hashlib.sha256((downloads/entry['file']).read_bytes()).hexdigest()!=entry['sha256']:
            raise ValueError('Source checksum mismatch: '+entry['file'])
    # Find traditional-only Han characters from aligned CC-CEDICT forms.
    # They are used only to keep traditional aliases out of the autocomplete
    # index; the licensed raw snapshot remains bundled for reproducibility.
    cedict=gzip.decompress((downloads/'cedict.txt.gz').read_bytes()).decode('utf-8').splitlines()
    traditional_only=set(); simplified_chars=set()
    for line in cedict:
        match=re.match(r'^(\S+) (\S+) \[',line)
        if not match:continue
        traditional,simplified=match.groups()
        traditional_only.update(traditional);simplified_chars.update(simplified)
    traditional_only.difference_update(simplified_chars)
    stats={}
    for kind in ['translation','danbooru']:
        path=dest/(kind+'.sqlite3');tmp=path.with_suffix('.building')
        if tmp.exists():tmp.unlink()
        db=sqlite3.connect(tmp);db.executescript(SCHEMA)
        count=0
        def add(label,output,names,category='',sense='',post_count=0,source=''):
            nonlocal count
            if not label or not output or len(output)>160:return
            count+=1
            db.execute('INSERT INTO entries VALUES(?,?,?,?,?,?,?)',(count,label,output,category,sense,post_count,source))
            db.executemany('INSERT OR IGNORE INTO names VALUES(?,?)',[(norm(n),count) for n in set(names+[label,output]) if n])
        if kind=='danbooru':
            category_names={'0':'通用标签','1':'画师','3':'作品','4':'角色','5':'元标签'}
            curated={'long_hair':['长头发'],'very_long_hair':['超长头发'],'huge_ass':['大屁股','大臀部','巨臀'],
                     'apple':['苹果水果'],'table':['桌子','餐桌'],'desk':['办公桌']}
            for path_in in sorted(downloads.glob('tags-*.csv')):
                for row in csv.DictReader(path_in.open(encoding='utf-8-sig')):
                    raw=row['tag'];alias=row['aliases'].split('|')+curated.get(raw,[])
                    # Keep only simplified aliases in the prompt-facing index.
                    alias=[value for value in alias if not any(char in traditional_only for char in value)]
                    label=row['zh'] or raw
                    add(label,raw,alias,category_names.get(row['category'],'标签'),row['notes'],int(row['count'] or 0),'ame-la/danbooru-tags-data-zh')
        else:
            for line in gzip.decompress((downloads/'cedict.txt.gz').read_bytes()).decode('utf-8').splitlines():
                if not line or line.startswith('#'):continue
                match=re.match(r'^(\S+) (\S+) \[([^]]+)\] /(.*)/$',line)
                if not match:continue
                traditional,simplified,pinyin,definitions=match.groups()
                for index,gloss in enumerate(definitions.split('/')):
                    # Explanatory dictionary cross-references/classifiers are not
                    # English phrases suitable for insertion into a prompt.
                    if re.search(r'[\u3400-\u9fff]|\[[^]]+\]',gloss) or re.match(r'(?:CL:|variant of |old variant |see |abbr\. for |surname |Taiwan pr\.)',gloss,re.I):continue
                    # Grammar-only headwords cannot stand alone in a prompt.
                    # Keep them out of autocomplete instead of exposing CEDICT
                    # editorial labels such as "(bound form)" to users.
                    if re.search(r'\((?:bound form|classifier|measure word)\)',gloss,re.I):continue
                    if not re.search('[A-Za-z]',gloss) or len(gloss)>100:continue
                    output=re.sub(r'^\((?:coll\.|literary|slang|dialect|fig\.)\)\s*','',gloss).strip()
                    add(simplified,output,[], '中英词典',gloss,0,'CC-CEDICT')
            # DSH-authored colloquial equivalents; never invent booru membership.
            for zh,en,aliases in [('长发','long hair',['长头发']),('大屁股','big butt',['大臀部','丰满臀部']),('首领','chief',['首长','负责人'])]:
                add(zh,en,aliases,'常用表达',zh,0,'DSH authored supplement')
        db.execute('INSERT INTO metadata VALUES(?,?)',('kind',kind))
        db.execute('INSERT INTO metadata VALUES(?,?)',('count',str(count)))
        db.commit();db.execute('PRAGMA optimize');db.close();tmp.replace(path)
        stats[kind]={'entries':count,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
        print(kind,stats[kind],flush=True)
    (dest/'manifest.json').write_text(json.dumps({'format':1,'sources':manifest,'catalogs':stats},ensure_ascii=False,indent=2),encoding='utf-8')
    return stats

if __name__=='__main__':build(Path(sys.argv[1]),Path(__file__).resolve().parents[1]/'plugin/vocabulary')
