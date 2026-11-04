"""Native disposable-server construction and guarded stopped-world installation."""

from contextlib import contextmanager
import fcntl
import gzip
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import time

from .registry import read_json

OWNER = "create_skyweave/debug-world"


@contextmanager
def world_lock(world):
    world = Path(world)
    lock = world / "session.lock"
    if not lock.is_file():
        raise ValueError("Expected a native world with session.lock")
    with lock.open("r+b") as handle:
        try:
            fcntl.lockf(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as error:
            raise ValueError(
                "World is loaded; save and leave it before writing"
            ) from error
        yield


def marked(world):
    path = Path(world) / ".debug-world-world"
    if not path.is_file() or read_json(path).get("owner") != OWNER:
        raise ValueError("Refuse to replace an unmarked world")


def enable_commands(world, reader):
    """Change only the verified Boolean in this freshly generated, closed save."""
    marked(world)
    path = Path(world) / "level.dat"
    raw = gzip.decompress(path.read_bytes())
    before = reader(raw).root()
    if before["Data"]["allowCommands"] == 1:
        return
    key = b"\x01\x00\x0dallowCommands\x00"
    if raw.count(key) != 1:
        raise ValueError("Unexpected native allowCommands encoding")
    changed = raw.replace(key, key[:-1] + b"\x01")
    after = reader(changed).root()
    if (
        after["Data"]["allowCommands"] != 1
        or sum(a != b for a, b in zip(raw, changed)) != 1
    ):
        raise ValueError("Unexpected level.dat change")
    stage = path.with_suffix(".new")
    stage.write_bytes(gzip.compress(changed, mtime=0))
    stage.replace(path)


def generate(
    compiled, output, work, *, java, server=None, vanilla_jar=None, timeout=600
):
    compiled, output, work = map(lambda p: Path(p).resolve(), (compiled, output, work))
    manifest = read_json(compiled / "debug-world-manifest.json")
    profile = manifest["plan"]["profile"]
    loader = manifest["plan"]["loader"]
    if output.exists():
        raise ValueError(
            "Generate into a new output; installation handles replacing marked saves"
        )
    if work.exists():
        raise ValueError("Use a fresh native work directory")
    if loader == "neoforge":
        if server is None:
            raise ValueError("NeoForge generation requires a read-only runtime home")
        expected = manifest["plan"].get("runtimeCapture", {}).get("mods")
        if not expected:
            raise ValueError("Capture a fresh registry with its adjacent snapshot.json")
        expected = {
            k: v
            for k, v in expected.items()
            if "exporter" not in k and "probe" not in k
        }
        actual = {
            p.name: hashlib.sha256(p.read_bytes()).hexdigest()
            for p in (Path(server) / "mods").glob("*.jar")
            if "exporter" not in p.name and "probe" not in p.name
        }
        if actual != expected:
            raise ValueError(
                "Native runtime differs from the registry snapshot; recapture before generating"
            )
    work.mkdir(parents=True)
    world_name = "Debug World - Vanilla" if loader == "vanilla" else "Debug World"
    world = work / world_name
    (world / "datapacks").mkdir(parents=True)
    shutil.copytree(compiled, world / "datapacks/debug_world")
    (world / ".debug-world-world").write_text(
        json.dumps(
            {
                "owner": OWNER,
                "profile": profile,
                "sourceSha256": manifest["sourceSha256"],
            }
        )
        + "\n"
    )
    if loader == "neoforge":
        if server is None:
            raise ValueError("NeoForge generation requires a read-only runtime home")
        server = Path(server).resolve()
        libraries = server / "libraries"
        args = libraries / "net/neoforged/neoforge/21.1.264/unix_args.txt"
        if not args.is_file():
            raise ValueError("Expected NeoForge 21.1.264 runtime libraries")
        (work / "libraries").symlink_to(libraries, target_is_directory=True)
        (work / "mods").mkdir()
        for source in (server / "mods").glob("*.jar"):
            if "probe" in source.name or "exporter" in source.name:
                continue
            (work / "mods" / source.name).symlink_to(source.resolve())
        for folder in ("config", "defaultconfigs"):
            if (server / folder).is_dir():
                shutil.copytree(server / folder, work / folder)
        bluemap = work / "config/bluemap"
        bluemap.mkdir(parents=True, exist_ok=True)
        (bluemap / "webserver.conf").write_text("enabled: false\n")
        (bluemap / "core.conf").write_text("accept-download: false\nmetrics: false\n")
        command = [str(java), "-Xms512m", "-Xmx4G", "@" + str(args), "nogui"]
    elif loader == "vanilla":
        if vanilla_jar is None:
            raise ValueError(
                "Vanilla generation requires the original Mojang server JAR"
            )
        vanilla_jar = Path(vanilla_jar).resolve()
        if (
            hashlib.sha1(vanilla_jar.read_bytes()).hexdigest()
            != "59353fb40c36d304f2035d51e7d6e6baa98dc05c"
        ):
            raise ValueError("Expected the original Minecraft 1.21.1 server JAR")
        command = [str(java), "-Xms512m", "-Xmx2G", "-jar", str(vanilla_jar), "nogui"]
    else:
        raise ValueError("Unsupported native runtime")
    if server is not None and (Path(server) / "eula.txt").is_file():
        (work / "eula.txt").write_bytes((Path(server) / "eula.txt").read_bytes())
    else:
        raise ValueError("Supply a runtime with an already accepted eula.txt")
    settings = {
        "server-ip": "127.0.0.1",
        "server-port": "0",
        "online-mode": "false",
        "level-name": world_name,
        "level-type": "minecraft:flat",
        "generator-settings": json.dumps(
            {
                "layers": [{"block": "minecraft:air", "height": 1}],
                "biome": "minecraft:the_void",
                "features": False,
                "lakes": False,
            },
            separators=(",", ":"),
        ),
        "gamemode": "creative",
        "difficulty": "normal",
        "generate-structures": "false",
        "enable-command-block": "true",
        "function-permission-level": "4",
        "spawn-protection": "0",
        "view-distance": "2",
        "simulation-distance": "2",
        "max-tick-time": "0",
        "sync-chunk-writes": "true",
    }
    (work / "server.properties").write_text(
        "".join(k + "=" + v + "\n" for k, v in settings.items())
    )
    started = time.monotonic()
    success = False
    failure = None
    log_path = work / "native.log"
    with log_path.open("w") as log:
        process = subprocess.Popen(
            command,
            cwd=work,
            stdin=subprocess.PIPE,
            stdout=log,
            stderr=subprocess.STDOUT,
            text=True,
        )
        print(
            f"Native {loader} build started: PID {process.pid}; {log_path}", flush=True
        )
        try:
            while process.poll() is None:
                time.sleep(0.5)
                content = log_path.read_text(errors="replace")
                if "[DebugWorld] complete " + manifest["sourceSha256"] in content:
                    success = True
                    break
                if any(
                    marker in content
                    for marker in (
                        "[DebugWorld] FAILED",
                        "Failed to load function",
                        "Encountered an unexpected exception",
                    )
                ):
                    failure = "Native construction failed; inspect " + str(log_path)
                    break
                if time.monotonic() - started > timeout:
                    failure = "Native construction timed out; inspect " + str(log_path)
                    break
            if process.poll() is None:
                process.communicate("stop\n", timeout=90)
        finally:
            if process.poll() is None:
                process.terminate()
                process.wait(timeout=30)
    if not success or process.returncode != 0:
        raise RuntimeError(
            failure or "Native server exited before completed construction"
        )
    from .verify import verify_world, nbt_reader

    with world_lock(world):
        enable_commands(world, nbt_reader())
        result = verify_world(world, require_complete=True)
    if not result["passed"]:
        raise RuntimeError("Saved-world verification failed: " + json.dumps(result))
    output.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(world), str(output))
    result.update(
        seconds=round(time.monotonic() - started, 2), command=command, profile=profile
    )
    (output / "debug-world-verification.json").write_text(
        json.dumps(result, indent=2) + "\n"
    )
    print(f"Native build verified in {result['seconds']}s: {output}", flush=True)
    return result


def install(source, game, name="Debug World", replace=False):
    source, game = Path(source).resolve(), Path(game).resolve()
    marked(source)
    if not name or name in (".", "..") or "/" in name or "\\" in name:
        raise ValueError("Expected a save name, not a path")
    destination = game / "saves" / name
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.is_symlink():
        raise ValueError("Refuse symlink destination")
    if destination.exists() and not replace:
        raise ValueError("World exists; explicit --replace required")
    from .verify import verify_world

    with world_lock(source):
        result = verify_world(source, require_complete=True)
        if not result["passed"]:
            raise ValueError("Source world verification failed")
        with tempfile.TemporaryDirectory(
            dir=destination.parent, prefix=".debug-world-install-"
        ) as directory:
            stage = Path(directory) / name
            shutil.copytree(source, stage)
            if destination.exists():
                marked(destination)
                with world_lock(destination):
                    # Recheck immediately before the atomic replacement while holding the native lock.
                    marked(destination)
                    previous = Path(directory) / "previous"
                    destination.rename(previous)
                    try:
                        stage.rename(destination)
                    except BaseException:
                        previous.rename(destination)
                        raise
                    shutil.rmtree(previous)
            else:
                stage.rename(destination)
    return destination
