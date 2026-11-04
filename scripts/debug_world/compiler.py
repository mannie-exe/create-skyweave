"""Compile validated cases into bounded native build stages and controls."""

import json
import copy
import hashlib
import shutil
import tempfile
import textwrap
from pathlib import Path

from .plan import fingerprint
from .recipes import build_case, snbt


def text(value, color="white"):
    return json.dumps({"text": value, "color": color}, ensure_ascii=False)


def label(
    x,
    y,
    z,
    value,
    scale=1.25,
    tag="debug_world",
    view=0.5,
    *,
    color="#111111",
    background=-167772161,
    wrap_columns=28,
    padding_spaces=1,
    brightness=None,
):
    # Native backgrounds have fixed vertical insets. Space advances add a
    # proportional horizontal inset; wrap before padding so every line keeps it.
    lines = [
        wrapped
        for line in value.split("\n")
        for wrapped in (
            textwrap.wrap(line, width=wrap_columns, break_on_hyphens=False) or [""]
        )
    ]
    padding = " " * padding_spaces
    value = "\n".join(padding + line + padding for line in lines)
    data = {
        "Tags": ["debug_world", tag],
        "text": text(value, color),
        "billboard": "center",
        "alignment": "center",
        "background": background,
        "text_opacity": -1,
        "line_width": 10000,
        "view_range": view,
        "transformation": {
            "translation": [0.0, 0.0, 0.0],
            "left_rotation": [0.0, 0.0, 0.0, 1.0],
            "right_rotation": [0.0, 0.0, 0.0, 1.0],
            "scale": [scale, scale, scale],
        },
    }
    if brightness is not None:
        data["brightness"] = brightness
    return f"summon minecraft:text_display {x} {y} {z} " + snbt(data)


class Compiler:
    def __init__(self, plan, registry, names=None):
        self.plan, self.registry, self.names = (
            copy.deepcopy(plan),
            registry,
            names or {},
        )
        self.functions = {}
        self.stages = []
        self.blocks = {}
        self.entities = []
        self.inventory = []
        self.connections = []
        self.tiles = []
        self.compiler_hash = fingerprint(
            {
                p.name: hashlib.sha256(p.read_bytes()).hexdigest()
                for p in sorted(Path(__file__).parent.glob("*.py"))
            }
        )
        self.source_hash = fingerprint(
            {
                "plan": {k: v for k, v in plan.items() if k != "omissions"},
                "names": fingerprint(self.names),
                "compiler": self.compiler_hash,
            }
        )

    def function(self, name, commands):
        if name in self.functions:
            raise ValueError("Duplicate function: " + name)
        if len(commands) > self.plan["settings"]["layout"][
            "maxCommandsPerFunction"
        ] or any(len(c) > 30000 for c in commands):
            raise ValueError("Function exceeds command budget: " + name)
        self.functions[name] = commands

    def label(self, *args, district=None, **kwargs):
        style = self.plan["settings"]["labels"]
        color = style["districtColors"][district] if district else style["textColor"]
        background = (
            style["districtBackgroundColor"] if district else style["backgroundColor"]
        )
        alpha = round(255 * style["backgroundOpacity"])
        argb = (alpha << 24) | int(background.removeprefix("#"), 16)
        return label(
            *args,
            **kwargs,
            color=color,
            background=argb - (1 << 32) if argb >= 1 << 31 else argb,
            wrap_columns=style["wrapColumns"],
            padding_spaces=style["horizontalPaddingSpaces"],
            brightness=style["brightness"],
        )

    def button(self, x, y, z, title, command, tag="dwhub", *, district=None):
        self.check_block([x, y, z], "minecraft:command_block")
        self.check_block([x, y + 1, z], "minecraft:stone_button", {"face": "floor"})
        nbt = snbt(
            {
                "Command": "execute as @p[distance=..5] at @s run " + command,
                "TrackOutput": False,
            }
        )
        return [
            f"setblock {x} {y} {z} minecraft:command_block{nbt}",
            f"setblock {x} {y + 1} {z} minecraft:stone_button[face=floor]",
            self.label(
                x + 0.5,
                y + 2.8,
                z + 0.5,
                title,
                self.plan["settings"]["layout"]["controlScale"],
                tag,
                view=0.35,
                district=district,
            ),
        ]

    def check_block(self, position, identifier, properties=None):
        self.blocks[tuple(position)] = {
            "position": position,
            "id": identifier,
            "properties": properties or {},
        }

    def name(self, case):
        id = case.get(
            "block",
            case.get("entity", case.get("material", case.get("variant", "Specimen"))),
        )
        key = self.registry.blocks.get(id, {}).get(
            "translation", "entity." + id.replace(":", ".")
        )
        title = self.names.get(key, id.split(":")[-1].replace("_", " ").title())
        suffix = case.get("variant") or (
            "young" if case.get("baby") else "motion" if case.get("motion") else ""
        )
        if case.get("block") and case.get("material"):
            suffix = case["material"].split(":")[-1].replace("_", " ").title()
        return title + ("\n" + suffix if suffix else "")

    def case(self, group, case, color):
        built = build_case(self.registry, group, case)
        for pos, check in built.blocks.items():
            self.blocks[pos] = check
        self.entities.extend(built.entities)
        self.inventory.extend(built.inventory)
        self.connections.extend(built.connections)
        self.tiles.extend(built.tiles)
        x, y, z = case["position"]
        layout = self.plan["settings"]["layout"]
        commands = built.commands + [
            self.label(
                x + 0.5,
                y + layout["labelClearance"] + 1,
                z - 3,
                self.name(case),
                layout["labelScale"],
                case["tag"],
                district=color,
            )
        ]
        detail = case.get("block", case.get("entity", case.get("material", "")))
        if detail:
            commands.append(
                self.label(
                    x + 0.5,
                    y + layout["labelClearance"],
                    z - 3,
                    detail,
                    layout["detailScale"],
                    case["tag"],
                    0.22,
                )
            )
        name = "cases/" + case["tag"]
        self.function(name, commands)
        case["function"] = "debug_world:" + name
        case["notes"] = built.notes
        return built

    def stage(self, id, bounds, commands, checks, group):
        self.stages.append(
            {
                "id": id,
                "bounds": bounds,
                "commands": commands,
                "checks": checks,
                "group": group,
            }
        )

    def hub(self):
        settings = self.plan["settings"]
        x, y, z = settings["hub"]["anchor"]
        commands = []
        height = settings["layout"]["clearHeight"]
        for a in range(-32, 33, 16):
            commands.append(
                f"fill {x + a} {y + 1} {z - 32} {x + min(a + 15, 32)} {y + height} {z + 32} minecraft:air"
            )
        commands += [
            "kill @e[tag=dwhub]",
            f"fill {x - 32} {y - 1} {z - 32} {x + 32} {y} {z + 32} minecraft:{settings['hub']['color']}_concrete",
            f"fill {x - 30} {y} {z - 30} {x + 30} {y} {z + 30} minecraft:smooth_stone",
            self.label(
                x,
                y + 8,
                z - 28,
                "DEBUG WORLD",
                settings["layout"]["headingScale"],
                "dwhub",
                2,
            ),
        ]
        sx, sy, sz = settings["hub"]["spawn"]
        self.check_block([int(sx), int(sy) - 1, int(sz)], "minecraft:smooth_stone")
        for i, d in enumerate(self.plan["districts"]):
            bx, bz = x - 21 + (i % 4) * 14, z - 12 + (i // 4) * 12
            commands.append(
                f"setblock {bx} {y + 1} {bz} minecraft:{d['color']}_concrete"
            )
            commands += self.button(
                bx,
                y + 2,
                bz,
                d["title"],
                "function debug_world:travel/" + d["id"],
                district=d["color"],
            )
        sx, sy, sz = settings["hub"]["spawn"]
        commands.append(f"setworldspawn {int(sx)} {int(sy)} {int(sz)}")
        for rule, value in settings["gamerules"].items():
            commands.append(f"gamerule {rule} {str(value).lower()}")
        commands += ["time set noon", "weather clear", "difficulty normal"]
        controls = [
            ("Noon", "time set noon"),
            ("Night", "time set midnight"),
            ("Rain", "weather rain"),
            ("Clear", "weather clear"),
            ("Creative", "gamemode creative @s"),
            ("Spectator", "gamemode spectator @s"),
            ("Survival", "gamemode survival @s"),
        ]
        for i, (title, command) in enumerate(controls):
            commands += self.button(x - 24 + i * 8, y + 1, z + 29, title, command)
        self.stage(
            "hub",
            [x - 32, y - 1, z - 32, x + 32, y + height, z + 32],
            commands,
            [],
            "hub",
        )
        self.function(
            "hub", [f"execute in minecraft:overworld run tp @s {sx} {sy} {sz} 0 10"]
        )

    def districts(self):
        layout = self.plan["settings"]["layout"]
        size = layout["cellSize"]
        width = layout["columns"] * size
        height = layout["clearHeight"]
        for district in self.plan["districts"]:
            x, y, z = district["anchor"]
            tag = "dwd_" + district["id"]
            self.function(
                "travel/" + district["id"],
                [
                    f"execute in minecraft:overworld run tp @s {x + width / 2} {y + 1} {z + 3} 0 10"
                ],
            )
            for group in district["groups"]:
                header = z + group["headerRow"] * size
                cmds = self.floor(x, y, header, width, size, district["color"])
                cmds += [
                    f"kill @e[tag={tag},x={x - 2},y={y},z={header},dx={width + 3},dy={height},dz={size - 1}]",
                    self.label(
                        x + width / 2,
                        y + 9,
                        header + size / 2,
                        district["title"] + "\n" + group["title"],
                        layout["headingScale"],
                        tag,
                        2,
                        district=district["color"],
                    ),
                ]
                cmds += self.button(
                    x + 4, y + 1, header + 4, "Hub", "function debug_world:hub", tag
                )
                # Resets are separate red stations, not adjacent to ordinary travel.
                cmds.append(
                    f"setblock {x + width - 7} {y + 1} {header + 4} minecraft:red_concrete"
                )
                cmds += self.button(
                    x + width - 7,
                    y + 2,
                    header + 4,
                    "Reset this group",
                    "function debug_world:reset/" + group["id"],
                    tag,
                )
                self.stage(
                    "header/" + group["id"],
                    [
                        x - 2,
                        y - 1,
                        header,
                        x + width + 1,
                        y + height,
                        header + size - 1,
                    ],
                    cmds,
                    [],
                    group["id"],
                )
                rows = {}
                for case in group["cases"]:
                    row = (case["position"][2] - size // 2 - z) // size
                    rows.setdefault(row, []).append(case)
                for row, cases in sorted(rows.items()):
                    zz = z + row * size
                    cmds = self.floor(x, y, zz, width, size, district["color"])
                    checks = []
                    for case in cases:
                        cmds.append(f"kill @e[tag={case['tag']}]")
                        built = self.case(group, case, district["color"])
                        cmds.append("function " + case["function"])
                        checks += list(built.blocks.values())
                    self.stage(
                        f"row/{group['id']}/{row}",
                        [x - 2, y - 1, zz, x + width + 1, y + height, zz + size - 1],
                        cmds,
                        checks,
                        group["id"],
                    )

    def floor(self, x, y, z, width, size, color):
        height = self.plan["settings"]["layout"]["clearHeight"]
        volume = (width + 4) * size * height
        if volume > 32768:
            raise ValueError("Build strip exceeds native fill limit")
        self.check_block([x - 2, y - 1, z], f"minecraft:{color}_concrete")
        self.check_block([x, y, z], "minecraft:smooth_stone")
        return [
            f"fill {x - 2} {y + 1} {z} {x + width + 1} {y + height} {z + size - 1} minecraft:air",
            f"fill {x - 2} {y - 1} {z} {x + width + 1} {y} {z + size - 1} minecraft:{color}_concrete",
            f"fill {x} {y} {z} {x + width - 1} {y} {z + size - 1} minecraft:smooth_stone",
        ]

    def schedule(self):
        groups = {}
        for i, stage in enumerate(self.stages):
            groups.setdefault(stage["group"], []).append(i)
        self.function(
            "build/start",
            [
                "execute unless data storage debug_world:state {busy:1b} run function debug_world:build/all"
            ],
        )
        self.function(
            "build/all",
            [
                "data remove storage debug_world:state complete",
                "data merge storage debug_world:state "
                + snbt(
                    {
                        "schema": 1,
                        "source": self.source_hash,
                        "busy": True,
                        "failed": False,
                        "group": "all",
                    }
                ),
                "function debug_world:build/p0/prepare",
            ],
        )
        self.function("build/resume", ["$function $(resume)"])
        for group, indices in groups.items():
            if group == "hub":
                continue
            name = "reset/" + group
            self.function(
                name,
                [
                    "execute in minecraft:overworld unless data storage debug_world:state {busy:1b} run function debug_world:reset_begin/"
                    + group
                ],
            )
            self.function(
                "reset_begin/" + group,
                [
                    "data remove storage debug_world:state complete",
                    "data merge storage debug_world:state "
                    + snbt({"busy": True, "failed": False, "group": group}),
                    f"function debug_world:build/p{indices[0]}/prepare",
                ],
            )
        for i, stage in enumerate(self.stages):
            prefix = f"build/p{i}"
            a = stage["bounds"]
            load = f"{a[0]} {a[2]} {a[3]} {a[5]}"
            chunks = [
                (cx, cz)
                for cx in range(a[0] // 16, a[3] // 16 + 1)
                for cz in range(a[2] // 16, a[5] // 16 + 1)
            ]
            if len(chunks) > 64:
                raise ValueError("Stage exceeds 64 temporary loaded chunks")
            loaded = " ".join(
                f"if loaded {cx * 16} {a[1]} {cz * 16}" for cx, cz in chunks
            )
            self.function(
                prefix + "/prepare",
                [
                    "data modify storage debug_world:state resume set value "
                    + json.dumps("debug_world:" + prefix + "/prepare"),
                    f"say [DebugWorld] stage {i + 1}/{len(self.stages)} {stage['id']}",
                    "scoreboard players set #wait dw 0",
                    f"forceload add {load}",
                    f"schedule function debug_world:{prefix}/wait 1t replace",
                ],
            )
            self.function(
                prefix + "/wait",
                [
                    f"schedule function debug_world:{prefix}/wait 1t replace",
                    "scoreboard players add #wait dw 1",
                    f"execute if score #wait dw matches 1200.. run function debug_world:{prefix}/error",
                    f"execute {loaded} run function debug_world:{prefix}/apply",
                ],
            )
            self.function(
                prefix + "/apply",
                [
                    f"schedule clear debug_world:{prefix}/wait",
                    *stage["commands"],
                    f"schedule function debug_world:{prefix}/verify 5t replace",
                ],
            )
            checks = []
            for check in stage["checks"]:
                pos = " ".join(map(str, check["position"]))
                state = self.registry.state(check["id"], check["properties"])
                checks.append(
                    f"execute unless block {pos} {state} run data modify storage debug_world:state failed set value 1b"
                )
            same_next = i + 1 in groups[stage["group"]]
            end = (
                f"function debug_world:build/p{i + 1}/prepare"
                if same_next
                else "function debug_world:build/group_complete"
            )
            cmds = [
                *checks,
                f"forceload remove {load}",
                f"execute if data storage debug_world:state {{failed:1b}} run function debug_world:{prefix}/error",
            ]
            if i + 1 < len(self.stages):
                cmds += [
                    f'execute unless data storage debug_world:state {{failed:1b}} if data storage debug_world:state {{group:"all"}} run function debug_world:build/p{i + 1}/prepare',
                    f'execute unless data storage debug_world:state {{failed:1b}} unless data storage debug_world:state {{group:"all"}} run {end}',
                ]
            else:
                cmds += [
                    "execute unless data storage debug_world:state {failed:1b} run function debug_world:build/complete"
                ]
            self.function(prefix + "/verify", cmds)
            self.function(
                prefix + "/error",
                [
                    f"schedule clear debug_world:{prefix}/wait",
                    f"forceload remove {load}",
                    "data merge storage debug_world:state {busy:0b,failed:1b}",
                    "say [DebugWorld] FAILED " + stage["id"],
                ],
            )
        self.function(
            "build/group_complete",
            [
                "data modify storage debug_world:state busy set value 0b",
                "data modify storage debug_world:state complete set value "
                + json.dumps(self.source_hash),
                "say [DebugWorld] group reset complete",
            ],
        )
        self.function(
            "build/complete",
            [
                "data modify storage debug_world:state busy set value 0b",
                "data modify storage debug_world:state complete set value "
                + json.dumps(self.source_hash),
                "say [DebugWorld] complete " + self.source_hash,
            ],
        )
        self.function(
            "load",
            [
                "execute if data storage debug_world:state {busy:1b} if data storage debug_world:state resume run function debug_world:build/resume with storage debug_world:state",
                "execute unless data storage debug_world:state schema run scoreboard objectives add dw dummy",
                "execute unless data storage debug_world:state schema run function debug_world:build/start",
            ],
        )

    def build(self):
        for id in [
            "minecraft:air",
            "minecraft:smooth_stone",
            "minecraft:white_concrete",
            "minecraft:" + self.plan["settings"]["hub"]["color"] + "_concrete",
            *["minecraft:" + d["color"] + "_concrete" for d in self.plan["districts"]],
        ]:
            self.registry.state(id)
        self.registry.state("minecraft:command_block")
        self.registry.state("minecraft:stone_button", {"face": "floor"})
        if "minecraft:text_display" not in self.registry.entities:
            raise ValueError("Missing text display entity")
        self.hub()
        self.districts()
        self.schedule()
        return {
            "schema": 1,
            "sourceSha256": self.source_hash,
            "compilerSha256": self.compiler_hash,
            "plan": self.plan,
            "blocks": list(self.blocks.values()),
            "entities": self.entities,
            "inventory": self.inventory,
            "tiles": self.tiles,
            "connections": self.connections,
            "stages": [
                {k: v for k, v in s.items() if k not in ("commands", "checks")}
                for s in self.stages
            ],
        }


def compile_pack(plan, registry, output, names=None):
    if Path(output).is_symlink():
        raise ValueError("Refuse symlink output")
    output = Path(output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    compiler = Compiler(plan, registry, names)
    manifest = compiler.build()
    with tempfile.TemporaryDirectory(
        dir=output.parent, prefix=".debug-world-"
    ) as directory:
        stage = Path(directory)
        for name, commands in compiler.functions.items():
            p = stage / "data/debug_world/function" / (name + ".mcfunction")
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text("\n".join(commands) + "\n", encoding="utf-8")
        p = stage / "data/minecraft/tags/function/load.json"
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps({"values": ["debug_world:load"]}) + "\n")
        (stage / "pack.mcmeta").write_text(
            json.dumps(
                {
                    "pack": {
                        "pack_format": 48,
                        "description": "Debug World: " + plan["profile"],
                    }
                }
            )
            + "\n"
        )
        (stage / "debug-world-manifest.json").write_text(
            json.dumps(manifest, indent=2, ensure_ascii=False) + "\n"
        )
        if output.exists():
            if not (output / "debug-world-manifest.json").is_file():
                raise ValueError("Refuse to replace unmarked output")
            previous = output.with_name(output.name + ".previous")
            if previous.exists():
                raise ValueError("Resolve previous staged output first")
            output.rename(previous)
            try:
                shutil.move(str(stage), str(output))
            except BaseException:
                previous.rename(output)
                raise
            shutil.rmtree(previous)
        else:
            shutil.move(str(stage), str(output))
    return manifest
