"""Publish a local review page from native captures and exact exported candidates."""
import html
import json
from pathlib import Path
from urllib.parse import quote
from .environment import digest


def write_review(root, output):
    root = Path(root).resolve(strict=True)
    output = Path(output).resolve()
    if output.exists():
        raise FileExistsError(f'Refusing to replace an existing review: {output}')
    report = json.loads((root / 'authoring-result.json').read_text())
    if report.get('status') != 'PASS':
        raise ValueError('Native fixture did not pass; inspect its report before publishing a candidate review')
    brief = json.loads((root / 'brief.json').read_text())
    rows, candidates = [], []
    for variant in brief['variants']:
        identifier = variant['id']
        pictures = [c for c in report['captures'] if c['variant'] == identifier]
        if {c['view'] for c in pictures} != {'exterior', 'interior'}:
            raise ValueError(f'Incomplete review captures: {identifier}')
        images = []
        for picture in pictures:
            file = (root / picture['file']).resolve(strict=True)
            if not file.is_relative_to(root) or not file.is_file():
                raise ValueError('Capture escapes its fixture')
            images.append(f'<figure><a href="{quote(file.as_uri(), safe=":/%")}"><img src="{quote(file.as_uri(), safe=":/%")}" alt="{html.escape(identifier)} {html.escape(picture["view"])}"></a><figcaption>{html.escape(picture["view"].capitalize())}</figcaption></figure>')
        exported = root / 'exports' / (identifier + '-furnished.nbt')
        candidate = {'id': identifier, 'template': str(exported), 'templateSha256': digest(exported),
                     'briefSha256': digest(root / 'brief.json'), 'status': 'awaiting owner selection; remaining qualification required'}
        candidates.append(candidate)
        rows.append(f'<article><h2>{html.escape(identifier.replace("-", " ").capitalize())}</h2><p>{variant["width"]} × {variant["length"]} room footprint. {html.escape(variant["role"])}.</p>{"".join(images)}<p>Candidate <code>{candidate["templateSha256"]}</code></p></article>')
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>White Terrace candidate review</title>'
        '<style>body{font:17px/1.5 system-ui;margin:2rem;background:#f4f2ec;color:#292b27}main{max-width:1440px;margin:auto}.comparison{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2rem}article{min-width:0}figure{margin:1rem 0}img{width:100%;display:block}code{overflow-wrap:anywhere;font-size:12px}figcaption{color:#555}@media(max-width:850px){.comparison{grid-template-columns:1fr}}</style>'
        '<main><h1>White Terrace freight buildings</h1><p>Original Mighty Architectury kit, two widths. Drafts for review; neither is approved or active in village generation.</p>'
        '<p>Compare the covered receiving dock, entrance proportions, freight aisle, and storage capacity. The room floor is two blocks above the shell datum; the court is one block below it. The attachment port shown before the stair is replaced with air during ordinary jigsaw realization.</p>'
        '<p>Native repeated vanilla/modded exports, 90° placement, container-name preservation, and attachment replacement passed in the reduced workshop. Current full-pack, save/reopen, broader fitting, and owner approval are separate gates.</p><div class="comparison">'
        + ''.join(rows) + '</div></main></html>')
    manifest = {'schemaVersion': 1, 'candidates': candidates, 'nativeReportSha256': digest(root / 'authoring-result.json'),
                'reviewSha256': digest(output), 'ownerSelection': None, 'activePoolEntry': False}
    output.with_suffix('.json').write_text(json.dumps(manifest, indent=2) + '\n')
    return manifest
