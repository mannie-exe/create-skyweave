"""Generate FTB Quests definitions from the single authored mechanics/text source."""
import argparse
import json
from pathlib import Path
from quests import compile_quests, generation_plan, read_sources


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--check', action='store_true')
    mode.add_argument('--preview', action='store_true')
    args = parser.parse_args()
    outputs, changed, removed = generation_plan(args.root, compile_quests(read_sources(args.root)))
    report = {'changed': changed, 'removed': removed, 'outputs': len(outputs)}
    if args.preview:
        print(json.dumps(report))
        return
    if args.check:
        if changed or removed:
            raise SystemExit('Quest output drift: ' + ', '.join(changed + removed))
    else:
        # Workspace jobs generate into isolated staging and commit the coordinated
        # result with revision checks. Direct CLI use requires a quiescent tree.
        for name in changed:
            destination = args.root / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            temporary = destination.with_name(destination.name + '.tmp')
            temporary.write_text(outputs[name], encoding='utf-8', newline='\n')
            temporary.replace(destination)
        for name in removed:
            (args.root / name).unlink()
    print(f'Quests: {len(outputs)} outputs, {len(changed)} changed, {len(removed)} removed')


if __name__ == '__main__':
    main()
