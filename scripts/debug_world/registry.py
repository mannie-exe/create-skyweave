"""Versioned registry inputs and exact block-state validation."""

import hashlib
import json
import re
from pathlib import Path


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


class Registry:
    def __init__(self, path):
        self.path = Path(path).resolve()
        self.data = read_json(path)
        if self.data.get("schema") != 1 or self.data.get("minecraft") != "1.21.1":
            raise ValueError(
                "Debug World requires registry schema 1 for Minecraft 1.21.1"
            )
        self.blocks = {b["id"]: b for b in self.data["blocks"]}
        self.items = set(self.data["items"])
        self.entities = {e["id"]: e for e in self.data["entities"]}
        self.sha256 = digest(path)
        snapshot = self.path.with_name("snapshot.json")
        self.capture = (
            {"sha256": digest(snapshot), **read_json(snapshot)}
            if snapshot.is_file()
            else self.data.get("source", {})
        )

    def state(self, identifier, properties=None):
        if identifier not in self.blocks:
            raise ValueError(f"Unknown block: {identifier}")
        block = self.blocks[identifier]
        values = {
            key: str(value).lower() if isinstance(value, bool) else str(value)
            for key, value in (properties or {}).items()
        }
        for key, value in values.items():
            if value not in block["properties"].get(key, []):
                raise ValueError(f"{identifier}: invalid {key}={value}")
        suffix = ",".join(f"{k}={v}" for k, v in sorted(values.items()))
        return identifier + ("[" + suffix + "]" if suffix else "")

    def select(self, selector):
        allowed = {
            "ids",
            "classes",
            "excludeClasses",
            "tags",
            "namespaces",
            "exclude",
            "optional",
            "limit",
        }
        if set(selector) - allowed:
            raise ValueError(f"Unknown selector fields: {set(selector) - allowed}")
        ids = set(selector.get("ids", []))
        missing = sorted(ids - self.blocks.keys())
        if missing and not selector.get("optional", False):
            raise ValueError("Missing required blocks: " + ", ".join(missing))
        classes, tags = set(selector.get("classes", [])), set(selector.get("tags", []))
        for identifier, block in self.blocks.items():
            hierarchy = {name.rsplit(".", 1)[-1] for name in block.get("hierarchy", [])}
            if hierarchy & classes or set(block.get("tags", [])) & tags:
                ids.add(identifier)
        namespaces = selector.get("namespaces")
        if namespaces:
            ids = {id for id in ids if id.split(":")[0] in namespaces}
        ids &= self.blocks.keys()
        excluded_classes = set(selector.get("excludeClasses", []))
        ids = {
            id
            for id in ids
            if not excluded_classes
            & {name.rsplit(".", 1)[-1] for name in self.blocks[id].get("hierarchy", [])}
        }
        for pattern in selector.get("exclude", []):
            ids = {id for id in ids if not re.fullmatch(pattern, id)}
        limit = selector.get("limit", 512)
        if not 1 <= limit <= 1024 or len(ids) > limit:
            raise ValueError(f"Selector has {len(ids)} cases; limit is {limit}")
        return sorted(ids), missing


def vanilla_registry(reports, output):
    """Normalize genuine Mojang data reports, without inventing class metadata."""
    reports = Path(reports)
    registries, blocks = (
        read_json(reports / "registries.json"),
        read_json(reports / "blocks.json"),
    )
    items = sorted(registries["minecraft:item"]["entries"])
    result = {
        "schema": 1,
        "minecraft": "1.21.1",
        "loader": "vanilla",
        "dataPackFormat": 48,
        "buildBounds": {"minY": -64, "maxYExclusive": 320},
        "source": {
            "kind": "mojang-data-reports",
            "blocksSha256": digest(reports / "blocks.json"),
            "registriesSha256": digest(reports / "registries.json"),
        },
        "blocks": [],
        "items": items,
        "entities": [
            {"id": id} for id in sorted(registries["minecraft:entity_type"]["entries"])
        ],
    }
    for id, block in sorted(blocks.items()):
        default = next(s for s in block["states"] if s.get("default"))
        result["blocks"].append(
            {
                "id": id,
                "properties": block.get("properties", {}),
                "defaultState": default.get("properties", {}),
                "blockType": block.get("definition", {}).get("type"),
                "translation": "block." + id.replace(":", "."),
                "item": id if id in items else "minecraft:air",
            }
        )
    target = Path(output)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    return target
