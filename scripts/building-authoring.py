#!/usr/bin/env python3
"""Prepare isolated building authoring inputs without changing the playable pack."""
import argparse
import json
from pathlib import Path
from building_authoring.theme import write_theme


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    theme = commands.add_parser('theme', help='Compile an editable brief into a Mighty theme resource pack')
    theme.add_argument('--brief', type=Path, required=True)
    theme.add_argument('--output', type=Path, required=True, help='New resource-pack ZIP; existing files are refused')
    environment = commands.add_parser('environment', help='Derive an isolated empack recipe from locked production content')
    environment.add_argument('--pack', type=Path, required=True)
    environment.add_argument('--selection', type=Path, required=True)
    environment.add_argument('--output', type=Path, required=True)
    native = commands.add_parser('prepare-api-proof', help='Compile and prepare an isolated native theme/export witness; does not launch')
    for flag in ('brief', 'theme', 'mighty', 'bootstrap-tools', 'java-home', 'output'):
        native.add_argument('--' + flag, type=Path, required=True)
    native.add_argument('--preview', action='store_true', help='Place and furnish both drafts, check the aisle, and capture four native views')
    native.add_argument('--templates-from', type=Path, help='Qualify frozen furnished templates instead of composing; excludes Mighty from the staged mods')
    native.add_argument('--candidate', help='Limit template qualification to one brief variant; this does not record owner approval')
    native.add_argument('--compare-exports-from', type=Path, help='Compare all rebuilt native exports with a retained control directory')
    runtime = commands.add_parser('prepare-runtime', help='Stage isolated content, matching configs/resources, and the prepared native witness')
    for flag in ('pack', 'project', 'prepared-probe', 'output'):
        runtime.add_argument('--' + flag, type=Path, required=True)
    runtime.add_argument('--full-pack', action='store_true', help='Use the exact current client lock and full authored data/resources for baked-template qualification')
    runtime.add_argument('--interactive', action='store_true', help='Prepare the workshop without the automatic observer or automatic shutdown')
    runtime.add_argument('--island', action='store_true', help='Qualify frozen templates using the pack’s configured world preset')
    review = commands.add_parser('review', help='Write a local comparison page from passed native captures and exact candidate exports')
    review.add_argument('--root', type=Path, required=True)
    review.add_argument('--output', type=Path, required=True)
    production = commands.add_parser('production-bootstrap', help='Prepare an owned production NeoForge fixture from public Prism metadata only; does not launch')
    for flag in ('root', 'prism-root', 'java-home'):
        production.add_argument('--' + flag, type=Path, required=True)
    reopen = commands.add_parser('prepare-reopen', help='Copy a completed owned fixture save into a separately prepared matching runtime')
    reopen.add_argument('--root', type=Path, required=True)
    reopen.add_argument('--source', type=Path, required=True)
    run = commands.add_parser('run', help='Launch one marked disposable fixture; coordinate desktop access before invoking')
    run.add_argument('--root', type=Path, required=True)
    args = parser.parse_args()
    if args.command == 'theme':
        print(json.dumps(write_theme(args.brief, args.output), indent=2))
    elif args.command == 'environment':
        from building_authoring.environment import derive
        report = derive(args.pack, args.selection, args.output)
        print(json.dumps({'selected': len(report['selected']), 'dependencyOnly': report['dependencyOnly'], 'pending': report['pending']}, indent=2))
    elif args.command == 'prepare-api-proof':
        from building_authoring.probe import prepare
        report = prepare(args.brief, args.theme, args.mighty, args.bootstrap_tools, args.java_home, args.output,
                         preview=args.preview, placement=args.templates_from is not None, templates_from=args.templates_from,
                         compare_exports_from=args.compare_exports_from, candidate=args.candidate)
        print(json.dumps(report, indent=2))
    elif args.command == 'prepare-runtime':
        from building_authoring.runtime import prepare_runtime
        print(json.dumps(prepare_runtime(args.pack, args.project, args.prepared_probe, args.output,
                                        full_pack=args.full_pack, interactive=args.interactive, island=args.island), indent=2))
    elif args.command == 'review':
        from building_authoring.review import write_review
        print(json.dumps(write_review(args.root, args.output), indent=2))
    elif args.command == 'production-bootstrap':
        from building_authoring.production import prepare_production
        print(json.dumps(prepare_production(args.root, args.prism_root, args.java_home), indent=2))
    elif args.command == 'prepare-reopen':
        from building_authoring.runtime import prepare_reopen
        print(json.dumps(prepare_reopen(args.root, args.source), indent=2))
    elif args.command == 'run':
        from building_authoring.runner import run
        print(json.dumps(run(args.root), indent=2))


if __name__ == '__main__':
    main()
