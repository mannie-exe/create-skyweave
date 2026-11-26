"""Run one marked native fixture and retain its actual process outcome."""
import json
import os
from pathlib import Path
import subprocess
import time
from .environment import digest


def run(root):
    root = Path(root).resolve(strict=True)
    marker = json.loads((root / 'building-authoring-fixture.json').read_text())
    if not marker.get('interactive'):
        return _execute(root, marker)
    # A reusable editing session keeps its worlds and history; only one launcher may own it.
    import fcntl
    with (root / '.building-authoring-run.lock').open('a+b') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as error:
            raise RuntimeError('The authoring workshop already has an active launcher') from error
        pid_file, result_file = root / 'run-pid.json', root / 'run-result.json'
        if pid_file.exists():
            previous = json.loads(pid_file.read_text())
            completed = json.loads(result_file.read_text()) if result_file.exists() else {}
            if completed.get('pid') != previous['pid'] or 'exit' not in completed:
                pid = previous['pid']
                if not isinstance(pid, int) or pid <= 0:
                    raise ValueError('Invalid unfinished authoring process identity; inspect run-pid.json')
                try:
                    os.kill(pid, 0)
                except ProcessLookupError:
                    pass
                else:
                    raise RuntimeError('The previous authoring process is still present; inspect run-pid.json before reopening')
        return _execute(root, marker)


def _execute(root, marker):
    interactive = marker.get('interactive', False)
    if not interactive and ((root / 'run-result.json').exists() or (root / 'run.log').exists()):
        raise FileExistsError('Use a fresh fixture; retained native runs are not overwritten')
    log_path, result_paths = root / 'run.log', [root / 'run-result.json']
    if interactive:
        history = root / 'interactive-sessions'
        history.mkdir(exist_ok=True)
        number = 1
        while (history / f'{number:04d}.log').exists() or (history / f'{number:04d}.json').exists():
            number += 1
        log_path = history / f'{number:04d}.log'
        result_paths.insert(0, history / f'{number:04d}.json')
    for relative, expected in marker.get('stagedFiles', {}).items():
        if digest(root / relative) != expected:
            raise ValueError(f'Staged input differs before native launch: {relative}')
    command = json.loads((root / 'launch.json').read_text())
    if not isinstance(command, list) or not command or any(not isinstance(v, str) for v in command):
        raise ValueError('Native launch must be an explicit argument array')
    report_name = ('placement-reopen-result.json' if (root / 'reopen-inputs.json').is_file() else 'placement-result.json') if marker.get('placement') else 'authoring-result.json'
    record = {'schemaVersion': 1, 'command': command, 'started': time.time(), 'log': log_path.relative_to(root).as_posix()}
    with log_path.open('x') as log:
        process = subprocess.Popen(command, cwd=root, stdout=log, stderr=subprocess.STDOUT)
        record['pid'] = process.pid
        (root / 'run-pid.json').write_text(json.dumps(record, indent=2) + '\n')
        try:
            code = process.wait(timeout=None if interactive else 600)
        except (subprocess.TimeoutExpired, KeyboardInterrupt):
            process.terminate()
            try:
                process.wait(timeout=20)
            except subprocess.TimeoutExpired:
                record['state'] = 'Owned process did not terminate; retain its PID and inspect before further native work'
                for path in result_paths:
                    path.write_text(json.dumps(record, indent=2) + '\n')
                raise RuntimeError(record['state'])
            code = process.returncode
            record['interrupted'] = True
    record.update(exit=code, ended=time.time())
    report = json.loads((root / report_name).read_text()) if (root / report_name).is_file() else None
    record['report'] = report_name if report is not None else None
    record['passed'] = None if interactive else code == 0 and report is not None and report.get('status') == 'PASS' and not record.get('interrupted')
    if interactive:
        record['qualification'] = 'Interactive session exit only; no automatic native assertions'
    for path in result_paths:
        path.write_text(json.dumps(record, indent=2) + '\n')
    if code != 0 or (not interactive and not record['passed']):
        raise RuntimeError(f'Client run failed or has no passing report; inspect {record["log"]} and run-result.json')
    return record
