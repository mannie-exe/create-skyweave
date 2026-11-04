"""Read saved native states using the Atlas Anvil decoder; never edit chunks."""

import gzip
import importlib
from pathlib import Path
import sys
import zlib

from .registry import read_json


def world_module():
    scripts = Path(__file__).resolve().parents[2] / "web/scripts"
    sys.path.insert(0, str(scripts))
    return importlib.import_module("world")


def nbt_reader():
    return world_module().NBT


class SavedWorld:
    def __init__(self, world):
        self.world = Path(world)
        self.module = world_module()
        self.chunks = {}
        self.sections = {}

    def chunk(self, cx, cz, folder="region"):
        key = (folder, cx, cz)
        if key not in self.chunks:
            path = self.world / folder / f"r.{cx // 32}.{cz // 32}.mca"
            with path.open("rb") as f:
                f.seek(((cx % 32) + (cz % 32) * 32) * 4)
                location = f.read(4)
                offset = int.from_bytes(location[:3], "big") * 4096
                if not offset:
                    raise ValueError(f"Missing saved chunk {key}")
                f.seek(offset)
                size = int.from_bytes(f.read(4), "big")
                kind = f.read(1)[0]
                data = f.read(size - 1)
            if kind == 1:
                data = gzip.decompress(data)
            elif kind == 2:
                data = zlib.decompress(data)
            elif kind != 3:
                raise ValueError(f"Unsupported Anvil compression {kind} in {path}")
            self.chunks[key] = self.module.NBT(data).root()
        return self.chunks[key]

    def block(self, pos):
        x, y, z = pos
        key = x // 16, y // 16, z // 16
        if key not in self.sections:
            section = next(
                (
                    s
                    for s in self.chunk(x // 16, z // 16)["sections"]
                    if s["Y"] == y // 16
                ),
                None,
            )
            if not section or "block_states" not in section:
                self.sections[key] = None
            else:
                self.sections[key] = (
                    section["block_states"]["palette"],
                    self.module.palette_indices(section["block_states"]),
                )
        section = self.sections[key]
        return (
            {"Name": "minecraft:air"}
            if section is None
            else section[0][int(section[1][(y % 16) * 256 + (z % 16) * 16 + x % 16])]
        )

    def tile(self, pos):
        x, y, z = pos
        return next(
            (
                e
                for e in self.chunk(x // 16, z // 16).get("block_entities", [])
                if (e["x"], e["y"], e["z"]) == (x, y, z)
            ),
            {},
        )


def verify_world(world, require_complete=True):
    world = Path(world)
    manifest = read_json(world / "datapacks/debug_world/debug-world-manifest.json")
    saved = SavedWorld(world)
    errors = []
    for expected in manifest["blocks"]:
        try:
            actual = saved.block(expected["position"])
            properties = {k: str(v).lower() for k, v in expected["properties"].items()}
            if actual["Name"] != expected["id"] or any(
                actual.get("Properties", {}).get(k) != v for k, v in properties.items()
            ):
                errors.append(
                    {
                        "position": expected["position"],
                        "expected": expected,
                        "actual": actual,
                    }
                )
        except (OSError, ValueError, KeyError) as e:
            errors.append({"position": expected["position"], "error": str(e)})
    for expected in manifest["connections"]:
        actual = saved.block(expected["position"]).get("Properties", {})
        for side, on in expected["sides"].items():
            connected = actual.get(side) not in (None, "false", "none")
            if connected != on:
                errors.append(
                    {
                        "position": expected["position"],
                        "connection": side,
                        "expected": on,
                        "actual": actual,
                    }
                )
    for expected in manifest["inventory"]:
        items = saved.tile(expected["position"]).get("Items", [])
        if not any(
            i.get("Slot") == expected["slot"] and i.get("id") == expected["id"]
            for i in items
        ):
            errors.append({"inventory": expected})
    for expected in manifest.get("tiles", []):
        tile = saved.tile(expected["position"])
        for path, value in expected["values"].items():
            actual = tile
            for key in path.split("."):
                actual = actual.get(key) if isinstance(actual, dict) else None
            if actual != value:
                errors.append(
                    {
                        "blockEntity": expected["position"],
                        "field": path,
                        "expected": value,
                        "actual": actual,
                    }
                )
    entities = []
    for region in (world / "entities").glob("r.*.*.mca"):
        _, rx, rz = region.stem.split(".")
        rx, rz = int(rx), int(rz)
        with region.open("rb") as f:
            header = f.read(4096)
        for i in range(1024):
            if int.from_bytes(header[i * 4 : i * 4 + 3], "big"):
                entities += saved.chunk(
                    rx * 32 + i % 32, rz * 32 + i // 32, "entities"
                ).get("Entities", [])
    for expected in manifest["entities"]:
        matches = [
            e
            for e in entities
            if e.get("id") == expected["id"] and expected["tag"] in e.get("Tags", [])
        ]
        if len(matches) != 1:
            errors.append({"entity": expected, "found": len(matches)})
            continue
        actual = matches[0]
        if expected.get("static") and not actual.get("OnGround"):
            errors.append(
                {"entity": expected, "reason": "static specimen is not grounded"}
            )
        x, y, z = expected["position"]
        px, py, pz = actual["Pos"]
        if abs(px - x) > 3 or abs(pz - z) > 3 or not y - 0.1 <= py <= y + 2:
            errors.append(
                {
                    "entity": expected,
                    "position": actual["Pos"],
                    "reason": "outside supported habitat",
                }
            )
        if expected["baby"] and actual.get("Age", 0) >= 0:
            errors.append({"entity": expected, "reason": "young specimen became adult"})
        if (
            expected.get("equipment")
            and [i.get("id") for i in actual.get("ArmorItems", [])]
            != expected["equipment"]
        ):
            errors.append({"entity": expected, "reason": "equipped armor differs"})
    storage = world / "data/command_storage_debug_world.dat"
    complete = None
    if storage.is_file():
        nbt = saved.module.NBT(gzip.decompress(storage.read_bytes())).root()
        state = nbt.get("data", {}).get("contents", {}).get("state", {})
        complete = state.get("complete")
        if state.get("busy") or state.get("failed"):
            errors.append({"reason": "native builder incomplete or failed"})
    if require_complete and complete != manifest["sourceSha256"]:
        errors.append(
            {
                "reason": "missing or mismatched native completion marker",
                "actual": complete,
            }
        )
    forced = world / "data/chunks.dat"
    if forced.exists():
        nbt = saved.module.NBT(gzip.decompress(forced.read_bytes())).root()
        if len(nbt.get("data", {}).get("Forced", [])):
            errors.append({"reason": "temporary force-loaded chunks remain"})
    return {
        "passed": not errors,
        "sourceSha256": manifest["sourceSha256"],
        "cases": manifest["plan"]["caseCount"],
        "blocksChecked": len(manifest["blocks"]),
        "connectionChecks": len(manifest["connections"]),
        "entitiesChecked": len(manifest["entities"]),
        "inventoryChecks": len(manifest["inventory"]),
        "blockEntityChecks": len(manifest.get("tiles", [])),
        "errorCount": len(errors),
        "errors": errors[:50],
    }
