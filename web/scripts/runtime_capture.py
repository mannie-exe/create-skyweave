"""Accept an export only after its isolated server exits cleanly."""
import os
from pathlib import Path
import shutil
import signal
import subprocess
import threading
import time


def stage_configuration(installed, authored, destination):
    """Copy read-only inputs into a disposable capture with pack-owned precedence."""
    retired = sorted(path.name for path in installed.glob('skyweave_compat-*')
                     if path.is_file() and path.suffix in {'.json', '.toml', '.properties'})
    if retired or (installed / 'skyweave-shaders/recipes').exists():
        raise ValueError('Retired Skyweave configuration inputs; use config/skyweave: ' + ', '.join(retired))
    if destination.exists():
        shutil.rmtree(destination)
    owned = [relative for relative in ['questlog', 'ftbquests/quests']
             if any((layer / relative).is_dir() for layer in authored)]

    def ignored(directory, names):
        relative = Path(directory).relative_to(installed)
        return [Path(name).name for name in owned if Path(name).parent == relative]

    if installed.exists():
        shutil.copytree(installed, destination, ignore=ignored)
    for layer in authored:
        if layer.exists():
            shutil.copytree(layer, destination, dirs_exist_ok=True)


def run_capture(command, *, cwd, log, complete, timeout=600,
                max_bytes=32 * 1024 * 1024, nested=False):
    complete.unlink(missing_ok=True)
    child = None
    reader = None
    overflow = threading.Event()
    fatal = threading.Event()
    errors = []
    separate_group = os.name == 'posix' and not nested
    markers = ('Encountered an unexpected exception', 'Exception stopping the server',
               'Uncaught exception in server thread', 'OutOfMemoryError')

    def stop():
        if child is None:
            return
        try:
            if separate_group:
                os.killpg(child.pid, signal.SIGKILL)
            elif child.poll() is None:
                child.kill()
        except ProcessLookupError:
            pass
        child.wait(timeout=5)

    try:
        with log.open('wb') as output:
            child = subprocess.Popen(command, cwd=cwd, stdout=subprocess.PIPE,
                                     stderr=subprocess.STDOUT,
                                     start_new_session=separate_group)

            def drain():
                written, tail = 0, ''
                try:
                    for chunk in iter(lambda: child.stdout.read(8192), b''):
                        text = tail + chunk.decode(errors='replace')
                        if any(marker in text for marker in markers):
                            fatal.set()
                        tail = text[-256:]
                        room = max(0, max_bytes - written)
                        output.write(chunk[:room])
                        written += len(chunk)
                        if written > max_bytes:
                            overflow.set()
                except BaseException as error:
                    errors.append(error)

            reader = threading.Thread(target=drain, daemon=True)
            reader.start()
            deadline = time.monotonic() + timeout
            while child.poll() is None:
                if overflow.is_set():
                    raise RuntimeError('Runtime export exceeded its log limit')
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise subprocess.TimeoutExpired(command, timeout)
                try:
                    child.wait(timeout=min(0.1, remaining))
                except subprocess.TimeoutExpired:
                    pass
            reader.join(timeout=1)
            if reader.is_alive():
                raise RuntimeError('Runtime export left an output stream open')
            if overflow.is_set():
                raise RuntimeError('Runtime export exceeded its log limit')
            if errors:
                raise RuntimeError('Runtime export log could not be read') from errors[0]
        if child.returncode or not complete.is_file() or fatal.is_set():
            raise RuntimeError(f'Runtime export failed; inspect {log}')
    except BaseException:
        complete.unlink(missing_ok=True)
        stop()
        raise
    finally:
        if child is not None:
            if separate_group:
                stop()  # Also stop descendants that outlive a normally exiting parent.
            if reader is not None:
                reader.join(timeout=1)
            if child.stdout is not None:
                child.stdout.close()
