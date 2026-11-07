"""Export actual registered content in a disposable server, never open the user's world."""
import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path
from paths import ROOT, paths, write_json, tool
from fingerprint import fingerprint
from runtime_capture import run_capture

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--worldgen", action="store_true", help="Read the configured world seed/settings for a chunk-free spacing comparison")
parser.add_argument("--installed-mods", action="store_true", help="Capture the configured installation instead of the complete materialized pack selection")
parser.add_argument('--output', type=Path, help='Write runtime JSON to this trusted staging directory')
parser.add_argument('--work', type=Path, help='Use this private capture directory instead of the CLI cache')
parser.add_argument('--libraries', type=Path, help='Read locked runtime libraries from an isolated installation without changing the configured server')
args_cli = parser.parse_args()
p = paths()
subprocess.run([sys.executable, str(p['pack'] / 'scripts/build-resource-patches.py'), '--check'], check=True)
mod_source = 'installed' if args_cli.installed_mods else 'pack'
source_fingerprint = fingerprint(mod_source)
inputs = json.loads(subprocess.check_output([tool('node', 'node'), str(ROOT / 'scripts/runtime-inputs.mjs'), str(p['pack'])], text=True))
work = args_cli.work.resolve() if args_cli.work else ROOT / '.cache'
audit = work / 'audit-server'
audit.mkdir(parents=True, exist_ok=True)
libraries = (args_cli.libraries or p['server'] / 'libraries').expanduser().resolve()
loader_version = inputs['runtime']['loader-version']
game_jar = libraries / 'net/neoforged/neoforge' / loader_version / f'neoforge-{loader_version}-server.jar'
if not game_jar.is_file(): raise RuntimeError('Missing locked NeoForge server JAR in configured libraries')
if not (audit / 'libraries').exists():
    (audit / 'libraries').symlink_to(libraries, target_is_directory=True)
# Select one complete source; never merge new authoring dependencies into an old installation.
mods = audit / 'mods'
if mods.exists():
    shutil.rmtree(mods)
mods.mkdir()
selected_mods = (sorted((p['server'] / 'mods').glob('*.jar')) if args_cli.installed_mods
                 else [Path(item['path']) for item in inputs['mods']])
for source in selected_mods:
    (mods / source.name).symlink_to(source)
# Overlay maintained local fixes without mounting any live save.
for layer in ['common', 'server']:
    for source in (p['pack'] / 'overrides' / layer / 'mods').glob('*.jar'):
        target = mods / source.name
        if target.exists() and target.resolve() == source.resolve(): continue
        if target.exists() and not args_cli.installed_mods:
            raise RuntimeError(f'Authored override conflicts with selected mod: {source.name}')
        target.unlink(missing_ok=True)
        target.symlink_to(source)
for folder in ['config', 'defaultconfigs']:
    target = audit / folder
    if target.exists(): shutil.rmtree(target)
    if (p['server'] / folder).exists(): shutil.copytree(p['server'] / folder, target)
    # Journal definitions are a complete authored set. Do not retain retired
    # installed entries when testing a source reorganization before final sync.
    if folder == 'config' and (p['pack'] / 'overrides/common/config/questlog').exists():
        shutil.rmtree(target / 'questlog', ignore_errors=True)
    for layer in ['common', 'server']:
        authored = p['pack'] / 'overrides' / layer / folder
        if authored.exists(): shutil.copytree(authored, target, dirs_exist_ok=True)
# Registry capture does not need a web server or downloaded map assets.
bluemap = audit / 'config/bluemap'
if bluemap.is_dir():
    (bluemap / 'webserver.conf').write_text('enabled: false\n')
    (bluemap / 'core.conf').write_text('accept-download: false\nmetrics: false\n')
# Existing-world SERVER configs override defaultconfigs. Copy only configuration,
# never chunks, level.dat, players, saved data or LOD databases.
world_config=p['server']/'world/serverconfig'
if world_config.exists(): shutil.copytree(world_config,audit/'audit-world/serverconfig',dirs_exist_ok=True)
classes = work / 'exporter-classes'
if classes.exists():
    shutil.rmtree(classes)
# Installer libraries also contain raw/unmapped MinecraftServer classes. The patched game must win.
classpath = ':'.join(str(f) for f in [game_jar, *sorted(libraries.rglob('*.jar')), *mods.glob('*.jar')])
subprocess.run([tool('javac', p.get('java', Path('.')) / 'javac'), '-proc:none', '-cp', classpath, '-d', str(classes), *[str(f) for f in sorted((ROOT / 'tools/exporter').glob('*.java'))]], check=True)
with zipfile.ZipFile(mods / 'create-skyweave-atlas-exporter.jar', 'w') as jar:
    for f in classes.rglob('*.class'): jar.write(f, f.relative_to(classes))
    jar.write(ROOT / 'tools/exporter/neoforge.mods.toml', 'META-INF/neoforge.mods.toml')
(audit / 'eula.txt').write_text((p['server'] / 'eula.txt').read_text())
(audit / 'server.properties').write_text('server-ip=127.0.0.1\nserver-port=0\nonline-mode=false\nlevel-name=audit-world\nlevel-type=minecraft:flat\ngenerate-structures=false\nview-distance=2\nsimulation-distance=10\nmax-tick-time=0\nspawn-protection=0\nsync-chunk-writes=false\n')
args = libraries / 'net/neoforged/neoforge' / inputs['runtime']['loader-version'] / 'unix_args.txt'
if inputs['runtime']['minecraft'] != '1.21.1' or inputs['runtime']['loader'] != 'neoforge' or not args.is_file():
    raise RuntimeError('Atlas requires the locked Minecraft 1.21.1 / NeoForge runtime in the configured libraries')
out = args_cli.output.resolve() if args_cli.output else ROOT / 'data/generated/runtime'
out.mkdir(parents=True, exist_ok=True)
print('Starting isolated audit server; live world is never mounted.', flush=True)
worldgen_args = ['-Datlas.worldgen.level='+str(p['server'] / 'world/level.dat')] if args_cli.worldgen else []
run_capture([tool('java', p.get('java', Path('.')) / 'java'), '-Xmx4G', *worldgen_args, '-Datlas.export.dir='+str(out), '@'+str(args), 'nogui'],
            cwd=audit, log=work / 'runtime.log', complete=out / 'complete.json',
            nested=bool(os.environ.get('ATLAS_WORKSPACE_CONTEXT')))
inventory = {f.name: hashlib.sha256(f.read_bytes()).hexdigest() for f in mods.glob('*.jar')}
write_json(out / 'snapshot.json', {'mods': inventory, 'runtime': inputs['runtime'], 'modSource':mod_source, 'sourceFingerprint':source_fingerprint,'sourceChangedDuringExport':source_fingerprint!=fingerprint(mod_source),'lockSha256': hashlib.sha256((p['pack'] / 'empack.lock').read_bytes()).hexdigest()})
print('Runtime export complete:', json.loads((out / 'complete.json').read_text()))
