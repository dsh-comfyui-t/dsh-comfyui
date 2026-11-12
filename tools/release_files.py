"""Release source selection and upgrade-only runtime preservation."""
from pathlib import Path
import re, shutil

RUNTIME_FILES={'credentials.yaml','.credentials.yaml','sidecar-token.txt','host-plugin.log'}
RUNTIME_DIRS={'logs'}
EXCLUDED_DIRS={'logs','backups','.cache','__pycache__','.git','.build-backup','node_modules','.venv','output','temp','.pytest_cache'}
EXCLUDED_FILES=RUNTIME_FILES|{'config.json','.dsh-port-sync.lock'}

def ignored(directory,names,assets=True):
    # With a release manifest the asset bytes are downloaded by install_assets.py
    # after the code copy; ship the directory, not the bytes. Standalone branches
    # bundle the assets and call with assets=False.
    current=Path(directory)
    if assets:
        if current.name in ('models','fonts','sky') and current.parent.name=='scene3d':
            return list(names)
        if current.name=='vocabulary':
            return [name for name in names if name.endswith(('.sqlite3','.db'))]
    return [name for name in names if name in EXCLUDED_DIRS or name in EXCLUDED_FILES
            or re.search(r'\.(?:pyc|pyo|tmp)$|\.log(?:\.|$)|\.bak(?:[-.]|$)|\.before-',name,re.I)
            or (Path(directory)/name).is_symlink()]


def preserve_runtime(source,target):
    """Keep old diagnostics/credentials only during an upgrade, never in release."""
    source,target=Path(source),Path(target)
    if not source.is_dir():return
    for name in RUNTIME_FILES:
        path=source/name
        if path.is_file() and not path.is_symlink():shutil.copy2(path,target/name)
    for name in RUNTIME_DIRS:
        path=source/name
        if path.is_dir() and not path.is_symlink():
            shutil.copytree(path,target/name,dirs_exist_ok=True,
                ignore=lambda directory,names:[n for n in names if (Path(directory)/n).is_symlink()])
