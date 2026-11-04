"""Measure controlled villages and natural starts in disposable worlds; retain only survey data."""
import argparse
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
import time
import zipfile
from pathlib import Path
from fingerprint import fingerprint
from paths import ROOT, paths, write_json


def run():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--seeds', nargs='+', type=int, default=[1, 42, 8675309, 20261023])
    parser.add_argument('--samples', type=int, default=6, help='Controlled villages per seed')
    parser.add_argument('--radius', type=int, default=2, help='Natural placement grid radius in structure cells')
    parser.add_argument('--natural-samples', type=int, default=2, help='Natural starts fully generated per seed')
    args = parser.parse_args()
    if not 1 <= args.samples <= 24 or not 1 <= args.radius <= 4 or not 1 <= args.natural_samples <= 8:
        parser.error('Samples 1–24, radius 1–4 and natural samples 1–8 are supported')
    p = paths()
    audit = ROOT/'.cache/audit-server'
    try:
        # Reuse the established fixture preparation and resource extraction paths.
        subprocess.run([sys.executable, str(ROOT/'scripts/runtime.py')], check=True)
        subprocess.run([sys.executable, str(ROOT/'scripts/extract.py')], check=True)
        source = fingerprint()
        snapshot = json.loads((ROOT/'data/generated/runtime/snapshot.json').read_text())
        if snapshot['sourceChangedDuringExport'] or snapshot['sourceFingerprint'] != source:
            raise RuntimeError('Pack inputs changed during runtime capture; repeat survey')
        report = {'schema': 1, 'capturedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                  'sourceFingerprint': source, 'processorSha256': hashlib.sha256((p['pack']/'pack-fixes/data/skyvillages/worldgen/processor_list/house_processor.json').read_bytes()).hexdigest(),
                  'runs': [], 'limitations': [
                      'Controlled villages use native placement above flat terrain, bypassing biome eligibility; block counts are actual surviving placed blocks.',
                      'Chest contents are a no-player native loot roll, not a multiplayer Lootr entitlement test.',
                      'Natural candidates use Sky Archipelago and normal structure-start generation; only marked samples were fully generated.',
                      'Natural bounding-box counts include underlying terrain and are not attributable exclusively to village foundations.',
                      'This is generation and resource testing, not survival travel or a completed delivery.']}
        with tempfile.TemporaryDirectory(prefix='structure-survey-', dir=ROOT/'.cache') as folder:
            temp = Path(folder); classes = temp/'classes'; tool = ROOT/'tools/structures'
            cp = ':'.join(str(f) for f in [*(audit/'libraries').rglob('*.jar'), *(audit/'mods').glob('*.jar')])
            subprocess.run([str(p['java']/'javac'), '-proc:none', '-cp', cp, '-d', str(classes), str(tool/'StructureSurvey.java')], check=True)
            jar = temp/'structure-survey.jar'
            with zipfile.ZipFile(jar, 'w') as z:
                for f in classes.rglob('*.class'): z.write(f, f.relative_to(classes))
                z.write(tool/'neoforge.mods.toml', 'META-INF/neoforge.mods.toml')
            for seed in args.seeds:
                for mode in ['controlled', 'natural']:
                    fixture = temp/'server'; fixture.mkdir()
                    (fixture/'libraries').symlink_to((audit/'libraries').resolve(), target_is_directory=True)
                    (fixture/'mods').mkdir()
                    for f in (audit/'mods').glob('*.jar'):
                        if f.name != 'create-skyweave-atlas-exporter.jar': (fixture/'mods'/f.name).symlink_to(f.resolve())
                    (fixture/'mods'/jar.name).symlink_to(jar)
                    for name in ['config','defaultconfigs']:
                        if (audit/name).exists(): shutil.copytree(audit/name,fixture/name)
                    shutil.copy2(audit/'eula.txt',fixture/'eula.txt')
                    kind = 'minecraft:flat' if mode=='controlled' else 'sky_archipelago:sky_islands'
                    (fixture/'server.properties').write_text(f'server-ip=127.0.0.1\nserver-port=0\nonline-mode=false\nlevel-name=survey-world\nlevel-type={kind}\nlevel-seed={seed}\ngenerate-structures={str(mode=="natural").lower()}\nview-distance=2\nsimulation-distance=2\nmax-tick-time=0\nspawn-protection=0\nsync-chunk-writes=false\n')
                    output=temp/'result.json'; output.unlink(missing_ok=True); log=temp/'server.log'
                    runtime_args=next((fixture/'libraries').glob('net/neoforged/neoforge/*/unix_args.txt'))
                    print(f'Survey {mode}, seed {seed}',flush=True)
                    with log.open('w') as stream:
                        result=subprocess.run([str(p['java']/'java'),'-Xmx6G',f'-Dsurvey.mode={mode}',f'-Dsurvey.samples={args.samples}',f'-Dsurvey.radius={args.radius}',f'-Dsurvey.naturalSamples={args.natural_samples}',f'-Dsurvey.output={output}','@'+str(runtime_args),'nogui'],cwd=fixture,stdout=stream,stderr=subprocess.STDOUT,timeout=900)
                    log_text=log.read_text(errors='replace')
                    if result.returncode or not output.exists():
                        print(log_text[-16000:],file=sys.stderr)
                        raise RuntimeError(f'{mode} seed {seed} failed')
                    row=json.loads(output.read_text())
                    row['placementFailures']=[line.split(']: ',1)[-1] for line in log_text.splitlines() if 'Shielded structure placement failure' in line]
                    report['runs'].append(row)
                    print(f'Finished {mode}: {len(row["samples"])} samples, {len(row["placementFailures"])} shielded placement failures',flush=True)
                    shutil.rmtree(fixture)
            if fingerprint()!=source: raise RuntimeError('Pack inputs changed during survey; results not published')
            write_json(ROOT/'data/generated/structures.json',report)
            print('Saved data/generated/structures.json; all survey worlds removed',flush=True)
    finally:
        for directory in [audit, ROOT/'.cache/exporter-classes']:
            if directory.exists(): shutil.rmtree(directory)
        (ROOT/'.cache/runtime.log').unlink(missing_ok=True)


if __name__=='__main__': run()
