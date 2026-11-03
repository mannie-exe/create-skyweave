import json
import os
from pathlib import Path

def invocation():
    value = os.environ.get('ATLAS_WORKSPACE_CONTEXT')
    if not value:
        return None
    file = Path(value)
    if not file.is_absolute() or file.is_symlink():
        raise ValueError('Invalid workspace invocation')
    with file.open('rb') as source:
        raw = source.read(1_000_001)
    if len(raw) > 1_000_000:
        raise ValueError('Workspace invocation exceeds its limit')
    data = json.loads(raw)
    if (data.get('schema') != 1 or not isinstance(data.get('paths'), dict)
            or not isinstance(data.get('tools'), dict)
            or any(not isinstance(value, str) or not Path(value).is_absolute() for value in data['paths'].values())
            or any(key not in ('node', 'python', 'java', 'javac', 'empack')
                   or value is not None and (not isinstance(value, str) or not Path(value).is_absolute())
                   for key, value in data['tools'].items())
            or any(not isinstance(data.get(key), str) or not Path(data[key]).is_absolute()
                   for key in ('web', 'pack'))):
        raise ValueError('Invalid workspace invocation')
    return data


_invocation = invocation()
ROOT = Path(_invocation['web']) if _invocation else Path(__file__).resolve().parent.parent
def paths(root=None):
    root = ROOT if root is None else Path(root)
    if _invocation and root == ROOT:
        return {**{key: Path(value) for key, value in _invocation['paths'].items()},
                'pack': Path(_invocation['pack'])}
    values = json.loads((root / 'data/local.example.json').read_text())
    source = root / 'data/local.json'
    if source.exists():
        values.update(json.loads(source.read_text()))
    resolved = {}
    for key, value in values.items():
        location = Path(value).expanduser()
        resolved[key] = (location if location.is_absolute() else root / location).resolve()
    return resolved


def tool(name, fallback):
    if name not in ('node', 'python', 'java', 'javac', 'empack'):
        raise ValueError('Unknown workspace tool')
    return (_invocation['tools'].get(name) if _invocation else None) or str(fallback)

def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(value, separators=(',', ':'), ensure_ascii=False))
    temporary.replace(path)
