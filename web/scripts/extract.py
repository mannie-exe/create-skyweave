"""Extract versioned source evidence and real textures, including nested mod JARs."""
import argparse, collections, hashlib, io, json, re, subprocess, tomllib, zipfile
from pathlib import Path
from paths import ROOT, paths, write_json, tool
from item_icons import model_textures, texture_path, layered_icon
from feature_switches import FILENAME as FEATURE_FILE, parse_feature_switches

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--runtime', type=Path)
parser.add_argument('--output', type=Path)
parser.add_argument('--icons', type=Path)
parser.add_argument('--work', type=Path)
args_cli = parser.parse_args()
p = paths()
runtime = args_cli.runtime.resolve() if args_cli.runtime else ROOT/'data/generated/runtime'
output = args_cli.output.resolve() if args_cli.output else ROOT/'data/generated'
work = args_cli.work.resolve() if args_cli.work else ROOT/'.cache'
items = json.loads((runtime/'items.json').read_text())
assets, translations, sources, documents, mods = {}, {}, {}, {}, []
def visit(blob, origin):
    digest=hashlib.sha256(blob).hexdigest()
    with zipfile.ZipFile(io.BytesIO(blob)) as jar:
        mod={'file':origin,'sha256':digest,'ids':[]}
        for metadata in ['META-INF/neoforge.mods.toml','META-INF/mods.toml','fabric.mod.json']:
            if metadata in jar.namelist():
                try:
                    info=json.loads(jar.read(metadata)) if metadata.endswith('.json') else tomllib.loads(jar.read(metadata).decode())
                    mod['ids']=[info['id']] if 'id' in info else [m['modId'] for m in info.get('mods',[])]
                    mod['metadata']=info
                    break
                except Exception: pass
        mods.append(mod)
        for name in jar.namelist():
            if name.endswith('.jar'): visit(jar.read(name),origin+'!/'+name)
            elif name.startswith('assets/') and name.endswith(('.json','.png','.png.mcmeta')):
                assets[name]=(jar.read(name),origin)
                if name.endswith('/lang/en_us.json'):
                    try: translations.update(json.loads(jar.read(name)))
                    except Exception: pass
            elif name.startswith('data/') and name.endswith('.json'):
                try:
                    payload=json.loads(jar.read(name)); _,ns,*parts=name.split('/'); key=ns+':'+('/'.join(parts))
                    documents.setdefault(key,[]).append({'origin':origin,'path':name,'sha256':hashlib.sha256(jar.read(name)).hexdigest(),'json':payload})
                except Exception: pass

vanilla=p['vanilla']
if not vanilla.exists(): raise SystemExit('Minecraft client JAR is required for vanilla textures: '+str(vanilla))
visit(vanilla.read_bytes(),vanilla.name)
selection = json.loads(subprocess.check_output([tool('node', 'node'), str(ROOT/'scripts/resource-inputs.mjs'), str(p['pack'])], text=True))
selected = sorted({Path(item['path']) for item in selection['inputs'] if item['destination'].startswith('mods/')})
for jar in [*selected, *sorted((p['pack']/'overrides/common/mods').glob('*.jar'))]:
    visit(jar.read_bytes(),jar.name)

icon_dir=args_cli.icons.resolve() if args_cli.icons else ROOT/'public/generated/icons'
icon_dir.mkdir(parents=True,exist_ok=True)
catalog=[]
for item in items:
    identifier=item['id']; ns,path=identifier.split(':',1)
    textures, flat=model_textures(assets, ns+':item/'+path)
    candidates=[textures.get(k) for k in ['layer0','all','front','side','top','particle']]+list(textures.values())
    icon=None
    layered=layered_icon(assets, textures, flat)
    if layered:
        blob, layer_sources=layered
        name=hashlib.sha256(blob).hexdigest()[:24]+'.svg'
        if not (icon_dir/name).exists():(icon_dir/name).write_bytes(blob)
        icon={'url':'/generated/icons/'+name,'kind':'layered-texture','sources':layer_sources}
    else:
        for texture in candidates:
            key=texture_path(textures, texture)
            if key in assets:
                # Actual texture preview; a full 3D/custom renderer is not fabricated.
                name=hashlib.sha256(assets[key][0]).hexdigest()[:24]+'.png'
                if not (icon_dir/name).exists():(icon_dir/name).write_bytes(assets[key][0])
                icon={'url':'/generated/icons/'+name,'kind':'texture','source':assets[key][1]+'!/'+key};break
    textkey=item.get('translation',''); name=translations.get(textkey,path.replace('_',' ').title())
    ponder={k:v for k,v in translations.items() if '.ponder.' in k and ('.'+path+'.' in k)}
    catalog.append({**item,'name':name,'mod':ns,'icon':icon,'ponder':ponder})

configs=[]
for base,label in [(p['pack']/'overrides/common/config','authored'),(work/'audit-server/config','runtime-defaults')]:
    for file in sorted(base.rglob('*')):
        if not file.is_file() or (file.suffix not in ('.toml','.json') and file.name != FEATURE_FILE) or file.stat().st_size>2_000_000:continue
        try:
            text=file.read_text()
            parsed=(parse_feature_switches(text) if file.name == FEATURE_FILE
                    else tomllib.loads(text) if file.suffix=='.toml' else json.loads(text))
            configs.append({'path':str(file.relative_to(base)),'layer':label,'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'values':parsed,'text':text})
        except Exception: pass
log_path=work/'runtime.log'
log=log_path.read_text(errors='replace') if log_path.exists() else ''
diagnostics=[line for line in log.splitlines() if ('/ERROR]' in line or 'ATLAS_EXPORT_COMPLETE' in line)]
write_json(output/'catalog.json',catalog)
write_json(output/'documents.json',documents)
write_json(output/'mods.json',mods)
write_json(output/'configs.json',configs)
write_json(output/'diagnostics.json',diagnostics)
write_json(output/'translations.json',translations)
print(f'Extracted {len(catalog)} items, {len(documents)} resource paths, {len(mods)} JARs; {sum(bool(i["icon"]) for i in catalog)} texture previews')
