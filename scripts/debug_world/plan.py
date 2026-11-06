"""Deterministic authored cases and nonoverlapping district rows."""

import hashlib
import json
import re
from pathlib import Path

from .registry import read_json


def fingerprint(value):
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def make_plan(config, registry, profile):
    config = Path(config)
    world, profiles = (
        read_json(config / "world.json"),
        read_json(config / "profiles.json"),
    )
    if (
        world["schema"] != 1
        or profiles["schema"] != 1
        or profile not in profiles["profiles"]
    ):
        raise ValueError("Unknown Debug World profile or configuration schema")
    selected = profiles["profiles"][profile]
    if registry.data["loader"] != selected["loader"]:
        raise ValueError(
            f"{profile} needs a genuine {selected['loader']} registry, not {registry.data['loader']}"
        )
    if (
        world["minecraft"] != registry.data["minecraft"]
        or world["dataPackFormat"] != registry.data["dataPackFormat"]
    ):
        raise ValueError("Profile and registry Minecraft/data-pack versions differ")
    layout = world["layout"]
    if not 1 <= layout["columns"] <= 8 or not 14 <= layout["cellSize"] <= 20:
        raise ValueError("Supported layout: 1 to 8 columns, 14 to 20 block cells")
    if not 17 <= layout["clearHeight"] <= 24:
        raise ValueError("clearHeight must be 17 to 24 blocks")
    districts, omissions, case_ids, group_ids, source = (
        [],
        [],
        set(),
        set(),
        [world, selected],
    )
    namespaces = selected.get("namespaces")
    recipes = {
        "glass",
        "window",
        "pane",
        "copycat",
        "crop",
        "plant",
        "aquatic",
        "block",
        "lantern",
        "wall_light",
        "light",
        "bridge",
        "storage",
        "double_chest",
        "stairs",
        "slab",
        "ladder",
        "rail",
        "door",
        "entity",
        "equipment",
        "workstation",
        "campfire",
        "fluid",
        "effect",
        "kinetic",
        "waterlogged",
        "samples",
        "circuit",
    }
    for district_id in selected["districts"]:
        if not re.fullmatch("[a-z][a-z0-9_-]{0,40}", district_id):
            raise ValueError("Invalid district ID")
        district = read_json(config / "districts" / (district_id + ".json"))
        if district.get("id") != district_id:
            raise ValueError("District ID must match its filename")
        source.append(district)
        x, y, z = district["anchor"]
        if any(type(v) is not int for v in (x, y, z)):
            raise ValueError("District anchors must be integer block positions")
        if (
            not registry.data["buildBounds"]["minY"] < y
            or y + layout["clearHeight"]
            >= registry.data["buildBounds"]["maxYExclusive"]
        ):
            raise ValueError(f"{district_id}: district exceeds build height")
        result = {k: district[k] for k in ("id", "title", "anchor", "color")}
        result["groups"] = []
        row = 0
        for group in district["groups"]:
            if not re.fullmatch("[a-z][a-z0-9_-]{0,40}", group["id"]):
                raise ValueError("Invalid group ID")
            gid = district_id + "/" + group["id"]
            if gid in group_ids:
                raise ValueError("Duplicate group ID: " + gid)
            group_ids.add(gid)
            if group["recipe"] not in recipes:
                raise ValueError(
                    f"{gid}: unsupported placement recipe {group['recipe']}"
                )
            candidates = list(group.get("cases", []))
            if "selector" in group:
                ids, missing = registry.select(group["selector"])
                candidates += [{"block": id} for id in ids]
                omissions.extend(
                    {"group": gid, "id": id, "reason": "optional block absent"}
                    for id in missing
                )
            expanded = []
            for case in candidates:
                if case.get("recipe", group["recipe"]) not in recipes:
                    raise ValueError(f"{gid}: unsupported case recipe")
                identifier = case.get("block", case.get("entity"))
                if (
                    identifier
                    and namespaces
                    and identifier.split(":")[0] not in namespaces
                ):
                    omissions.append(
                        {
                            "group": gid,
                            "id": identifier,
                            "reason": "outside profile namespaces",
                        }
                    )
                    continue
                if (
                    "entity" in case
                    and identifier not in registry.entities
                    or "block" in case
                    and identifier not in registry.blocks
                ):
                    if not group.get("optional", False):
                        raise ValueError(
                            f"{gid}: required resource absent: {identifier}"
                        )
                    omissions.append(
                        {
                            "group": gid,
                            "id": identifier,
                            "reason": "optional resource absent",
                        }
                    )
                    continue
                if "block" in case:
                    registry.state(identifier, case.get("state"))
                if group.get("variants") == "growth":
                    values = sorted(
                        map(int, registry.blocks[identifier]["properties"]["age"])
                    )
                    stages = (
                        values
                        if identifier.endswith("pitcher_crop")
                        else sorted({values[0], values[len(values) // 2], values[-1]})
                    )
                    expanded.extend(
                        {**case, "state": {"age": str(age)}, "variant": f"age-{age}"}
                        for age in stages
                    )
                else:
                    expanded.append(case)
            if selected.get("casesPerGroup"):
                expanded = expanded[: selected["casesPerGroup"]]
            if not expanded:
                omissions.append(
                    {"group": gid, "reason": "no available cases for this profile"}
                )
                continue
            group_out = {
                "id": gid,
                "title": group["title"],
                "recipe": group["recipe"],
                "headerRow": row,
                "cases": [],
            }
            row += 1
            for index, specimen in enumerate(expanded):
                case_id = gid + "/" + fingerprint(specimen)[:16]
                if case_id in case_ids:
                    raise ValueError(f"Duplicate specimen in {gid}")
                case_ids.add(case_id)
                col, offset = index % layout["columns"], index // layout["columns"]
                position = [
                    x + col * layout["cellSize"] + layout["cellSize"] // 2,
                    y + 1,
                    z + (row + offset) * layout["cellSize"] + layout["cellSize"] // 2,
                ]
                group_out["cases"].append(
                    {
                        "id": case_id,
                        "tag": "dw_" + fingerprint(case_id)[:20],
                        "position": position,
                        **specimen,
                    }
                )
            row += (len(expanded) + layout["columns"] - 1) // layout["columns"]
            result["groups"].append(group_out)
        if row:
            result["bounds"] = [
                x - 2,
                y - 1,
                z,
                x + layout["columns"] * layout["cellSize"] + 1,
                y + layout["clearHeight"],
                z + row * layout["cellSize"] - 1,
            ]
            districts.append(result)
    if len(case_ids) > layout["maxCases"]:
        raise ValueError(
            f"Profile has {len(case_ids)} cases; limit is {layout['maxCases']}"
        )
    # Floors must not cover other districts, even at different elevations.
    regions = [
        (
            "hub",
            [
                world["hub"]["anchor"][0] - 32,
                0,
                world["hub"]["anchor"][2] - 32,
                world["hub"]["anchor"][0] + 32,
                0,
                world["hub"]["anchor"][2] + 32,
            ],
        )
    ]
    for district in districts:
        a = district["bounds"]
        for name, b in regions:
            if a[0] <= b[3] and b[0] <= a[3] and a[2] <= b[5] and b[2] <= a[5]:
                raise ValueError(
                    f"Overlapping district footprints: {district['id']}, {name}"
                )
        regions.append((district["id"], a))
    return {
        "schema": 1,
        "profile": profile,
        "minecraft": world["minecraft"],
        "loader": selected["loader"],
        "loaderVersion": registry.data.get("loaderVersion"),
        "runtimeSha256": registry.sha256,
        "runtimeCapture": registry.capture,
        "configSha256": fingerprint(source),
        "settings": world,
        "districts": districts,
        "omissions": omissions,
        "caseCount": len(case_ids),
        "limits": {
            "excluded": [
                "terrain/structure-generation surveys",
                "automatic ship assembly",
                "Create vault/shipping-container GUIs",
                "invalid create:copycat_bars block",
            ]
        },
    }
