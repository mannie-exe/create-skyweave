#!/usr/bin/env python3
"""Acquire pinned inputs and invoke the same Java recipe engine used by recipients."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import zipfile

LAB = Path(__file__).resolve().parent
ROOT = LAB.parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from archive_output import publish
from materials import classify


def build(empack, check=False, runner=None):
    for name in ("create", "euphoria-patches"):
        pins = []
        for manifest in (ROOT / "empack.yml", LAB / "empack.yml"):
            text = manifest.read_text()
            block = re.search(rf"^  {name}:\n(.*?)(?=^  [a-z0-9_-]+:|\Z)", text, re.M | re.S)
            pin = re.search(r"^    pin: (\S+)$", block[1], re.M) if block else None
            if pin is None:
                raise ValueError(f"Review {name} pin representation in {manifest}")
            pins.append(pin[1])
        if pins[0] != pins[1]:
            raise ValueError(f"Align {name} pins in the pack and shader lab before generating")
    subprocess.run([empack, "--workdir", str(LAB), "--yes", "sync", "--materialize"], check=True)
    runner = Path(runner) if runner else LAB / "pack/shader-tools/runner.jar"
    if not runner.is_file():
        raise ValueError("Shader runner is missing; use --runner with a verified candidate Compat JAR during development")
    workspace = LAB / ".cache/recipient"
    recipes = ROOT / "overrides/client/config/skyweave/shaders/recipes"
    target = workspace / "config/skyweave/shaders/recipes"
    target.mkdir(parents=True, exist_ok=True)
    known = set()
    for recipe_file in sorted(recipes.glob("*.json")):
        recipe = json.loads(recipe_file.read_text())
        known.add(recipe_file.name)
        shutil.copy2(recipe_file, target / recipe_file.name)
        for definition in recipe["inputs"].values():
            name = Path(definition["path"]).name
            sources = [p for p in (LAB / "pack").rglob(name) if p.is_file()]
            if len(sources) != 1:
                raise ValueError(f"Expected one materialized input: {name}")
            if hashlib.sha256(sources[0].read_bytes()).hexdigest() != definition["sha256"]:
                raise ValueError(f"Update the qualified recipe after reviewing changed input: {name}")
            destination = workspace / definition["path"]
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(sources[0], destination)
        # Classification is an authoring qualification, not a second patch implementation.
        for step in recipe["steps"]:
            if step.get("path") == "skyweave-glass.json":
                report = json.loads(step["replace"])["blocks"]
                create = workspace / recipe["inputs"]["create"]["path"]
                with zipfile.ZipFile(create) as archive:
                    if classify(archive, [row["id"] for row in report]) != report:
                        raise ValueError("Create texture bindings/alpha changed; review material policy")
    for old in target.glob("*.json"):
        if old.name not in known:
            old.unlink()  # This entire workspace is lab-owned staging.
    gson = LAB / "pack/shader-tools/gson.jar"
    command = ["java", "-cp", os.pathsep.join([str(runner.resolve()), str(gson)]),
               "design.inherent.skyweavecompat.shader.ShaderCli", str(workspace)]
    if check:
        command.append("--check")
    subprocess.run(command, check=True)
    outputs = []
    for recipe_file in sorted(recipes.glob("*.json")):
        recipe = json.loads(recipe_file.read_text())
        destination = LAB / "dist" / recipe["output"]
        publish(destination, (workspace / "shaderpacks" / recipe["output"]).read_bytes(), check=check)
        outputs.append(destination)
        print(destination.relative_to(ROOT))
    return outputs


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--empack", default=shutil.which("empack") or str(Path.home() / ".local/bin/empack"))
    parser.add_argument("--runner", type=Path, help="Use an explicit candidate Compat JAR instead of the pinned lab runner")
    parser.add_argument("--check", action="store_true", help="Rebuild and compare without replacing generated outputs")
    args = parser.parse_args()
    try:
        build(args.empack, args.check, args.runner)
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        parser.exit(1, f"Shader lab: {error}\n")
