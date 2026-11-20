"""Stage the declared local Lootr: Styled candidate; never release or install a personal instance."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import tomllib
import zipfile

ROOT = Path(__file__).resolve().parent.parent


def stage(artifact):
    info = json.loads(subprocess.check_output(
        ['empack', '--workdir', str(ROOT), 'manifest', 'explain', 'lootr-styled', '--json'], text=True))
    source, selection = info['effective']['source'], info['effective']['selection']
    if source['kind'] != 'local' or selection['mode'] != 'content-assertions':
        raise ValueError('The pack no longer declares a local candidate; use its current owner workflow')
    destination = (ROOT / source['path']).resolve()
    if not destination.is_relative_to((ROOT / '.cache/local-candidates').resolve()):
        raise ValueError('Candidate destination must stay under the owned local input cache')
    data = artifact.read_bytes()
    if hashlib.sha256(data).hexdigest() != selection['digests']['sha256']:
        raise ValueError('Built candidate differs from the declared SHA-256; review/update the declaration explicitly')
    with zipfile.ZipFile(artifact) as archive:
        metadata = tomllib.loads(archive.read('META-INF/neoforge.mods.toml').decode())
        if len(metadata['mods']) != 1 or metadata['mods'][0]['modId'] != 'lootr_styled':
            raise ValueError('Not a Lootr: Styled NeoForge artifact')
        game = next(d for d in metadata['dependencies']['lootr_styled'] if d['modId'] == 'minecraft')
        if game['versionRange'] != '[1.21.1]' or game['side'] != 'CLIENT':
            raise ValueError('Wrong candidate target or side')
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=destination.parent, prefix='lootr-styled-', delete=False) as file:
        temporary = Path(file.name)
        file.write(data)
    try:
        temporary.replace(destination)
    finally:
        temporary.unlink(missing_ok=True)
    return destination


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--artifact', type=Path, required=True)
    args = parser.parse_args()
    print(f'Staged declared candidate: {stage(args.artifact).relative_to(ROOT)}')
