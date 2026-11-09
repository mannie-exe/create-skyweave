"""Cheap change detector. Runtime exports separately hash every loaded JAR."""
import hashlib, json
from paths import ROOT, paths

def fingerprint(mod_source=None):
    p=paths();files={}
    if mod_source is None:
        snapshot = ROOT / 'data/generated/runtime/snapshot.json'
        mod_source = json.loads(snapshot.read_text()).get('modSource', 'installed') if snapshot.exists() else 'installed'
    if mod_source not in {'pack', 'installed'}: raise ValueError('Unknown runtime mod source')
    sources = [p['server']/'mods'] if mod_source == 'installed' else [p['pack']/'pack/mods',p['pack']/'overrides/server/mods']
    authored = [p['pack']/'overrides'/layer/folder for layer in ['common', 'server'] for folder in ['config', 'defaultconfigs']]
    for base in [*sources,p['server']/'config',p['server']/'defaultconfigs',p['server']/'world/serverconfig',*authored,p['pack']/'overrides/common/mods']:
        if base.exists():
            for file in sorted(base.rglob('*')):
                if file.is_file() and file.suffix in ('.jar','.json','.toml','.properties','.snbt'):
                    stat=file.stat();files[str(file)]={'size':stat.st_size,'mtimeNs':stat.st_mtime_ns}
    template=p['pack']/'templates/server/game/server.properties.template'
    files['serverTemplateSha256']=hashlib.sha256(template.read_bytes()).hexdigest() if template.is_file() else None
    files['lockSha256']=hashlib.sha256((p['pack']/'empack.lock').read_bytes()).hexdigest()
    return hashlib.sha256(json.dumps(files,sort_keys=True).encode()).hexdigest()

if __name__=='__main__':print(fingerprint())
