#!/usr/bin/env python3
"""Build complete BSL + Colorwheel archives from the lab's verified empack inputs."""

import argparse
import io
import json
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import sys
import tomllib
import zipfile

LAB = Path(__file__).resolve().parent
ROOT = LAB.parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from archive_output import archive_bytes, publish


def entries(archive):
    result = {}
    for info in archive.infolist():
        name = info.filename
        path = PurePosixPath(name)
        if path.is_absolute() or ".." in path.parts or "\\" in name:
            raise ValueError(f"Unsafe archive member: {name}")
        if info.is_dir():
            continue
        if name in result or info.file_size > 32 * 1024 * 1024:
            raise ValueError(f"Duplicate or oversized archive member: {name}")
        result[name] = archive.read(info)
    return result


def build(empack, check=False):
    # empack owns provider pins, acquisition and digest verification in this workspace.
    subprocess.run(
        [empack, "--workdir", str(LAB), "--yes", "sync", "--materialize"], check=True
    )
    shaders = list((LAB / "pack/shaderpacks").glob("BSL_*.zip"))
    patchers = list((LAB / "pack/mods").glob("colorwheel_patcher-*.jar"))
    if len(shaders) != 1 or len(patchers) != 1:
        raise ValueError(
            "The lab must materialize exactly one BSL input and one patcher"
        )
    base, patcher = shaders[0], patchers[0]
    with zipfile.ZipFile(base) as archive:
        merged = entries(archive)
    with zipfile.ZipFile(patcher) as archive:
        config = json.loads(archive.read("config.json"))
        bsl = [p for p in config["patches"] if p["shaderName"] == "BSL"]
        if len(bsl) != 1 or not any(v in base.name for v in bsl[0]["versions"]):
            raise ValueError("The selected patcher does not advertise this BSL version")
        metadata = tomllib.loads(archive.read("META-INF/neoforge.mods.toml").decode())
        version = next(
            m["version"] for m in metadata["mods"] if m["modId"] == "colorwheel_patcher"
        ).split("+")[0]
        with zipfile.ZipFile(io.BytesIO(archive.read("patches/BSL.zip"))) as patch:
            overlay = entries(patch)
    # Match upstream: unpack BSL, then extract its embedded overlay beside shaders/.
    if not any(n.startswith("shaders/") for n in merged):
        raise ValueError("Review a changed BSL archive root before patching")
    if not overlay or not all(n.startswith("shaders/") for n in overlay):
        raise ValueError("Review changed Colorwheel overlay paths before patching")
    merged.update(overlay)
    destination = LAB / "dist" / f"{base.stem} + Clrwl_{version}.zip"
    publish(destination, archive_bytes(merged, (1980, 1, 1, 0, 0, 0)), check=check)
    print(destination.relative_to(ROOT))
    return destination


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--empack",
        default=shutil.which("empack") or str(Path.home() / ".local/bin/empack"),
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Verify the existing generated archive without replacing it",
    )
    args = parser.parse_args()
    try:
        build(args.empack, args.check)
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        parser.exit(1, f"Shader lab: {error}\n")
