"""Small native placement recipes, with explicit supports and verification records."""

import json


def snbt(value):
    if isinstance(value, bool):
        return "1b" if value else "0b"
    if isinstance(value, dict):
        return (
            "{"
            + ",".join(json.dumps(k) + ":" + snbt(v) for k, v in value.items())
            + "}"
        )
    if isinstance(value, list):
        return "[" + ",".join(snbt(v) for v in value) + "]"
    return json.dumps(value, ensure_ascii=False)


class Specimen:
    def __init__(self, registry, case, group):
        self.registry, self.case, self.group = registry, case, group
        self.commands, self.blocks, self.entities, self.connections = [], {}, [], []
        self.inventory = []
        self.tiles = []
        self.notes = []

    def block(self, dx, dy, dz, id, state=None, nbt=None, check_state=True):
        if not (-6 <= dx <= 6 and -1 <= dy <= 15 and -6 <= dz <= 6):
            raise ValueError(f"{self.case['id']}: recipe exceeds its cell")
        x, y, z = (self.case["position"][i] + v for i, v in enumerate((dx, dy, dz)))
        text = self.registry.state(id, state)
        self.commands.append(
            f"setblock {x} {y} {z} {text}" + (snbt(nbt) if nbt else "")
        )
        self.blocks[x, y, z] = {
            "position": [x, y, z],
            "id": id,
            "properties": state if check_state and state else {},
        }

    def supported(self, dx, dy, dz, id, state=None, support="minecraft:stone"):
        self.block(dx, dy - 1, dz, support)
        self.block(dx, dy, dz, id, state)

    def entity(self, id, dx=0, dy=0, dz=0, data=None):
        if id not in self.registry.entities:
            raise ValueError(f"Unknown entity: {id}")
        x, y, z = (self.case["position"][i] + v for i, v in enumerate((dx, dy, dz)))
        tags = [
            "debug_world",
            self.case["tag"],
            "dwg_" + self.group["id"].replace("/", "_"),
        ]
        nbt = {
            "Tags": tags,
            "Invulnerable": True,
            "PersistenceRequired": True,
            "Silent": True,
            "OnGround": True,
            **(data or {}),
        }
        self.commands.append(f"summon {id} {x + 0.5} {y + 0.02} {z + 0.5} " + snbt(nbt))
        self.entities.append(
            {
                "id": id,
                "tag": self.case["tag"],
                "position": [x + 0.5, y + 0.02, z + 0.5],
                "baby": self.case.get("baby", False),
                "static": not self.case.get("motion", False),
                "equipment": [item.get("id") for item in nbt.get("ArmorItems", [])],
            }
        )

    def items(self, dx, dy, dz, items):
        x, y, z = (self.case["position"][i] + v for i, v in enumerate((dx, dy, dz)))
        for slot, id in enumerate(items):
            if id not in self.registry.items:
                raise ValueError(f"Unknown equipment item: {id}")
            self.commands.append(
                f"item replace block {x} {y} {z} container.{slot} with {id}"
            )
            self.inventory.append({"position": [x, y, z], "slot": slot, "id": id})


def basic(s, case):
    s.block(0, 0, 0, case["block"], case.get("state"))


def glass(s, case):
    id = case["block"]
    for x, z in [(x, 0) for x in range(-2, 3)] + [(2, 1), (2, 2)]:
        for y in range(3):
            s.block(x, y, z, id, case.get("state"))
    # Another material exposes the distinction between CT and hidden interfaces.
    s.block(
        -1,
        0,
        -1,
        "minecraft:glass"
        if id != "minecraft:glass"
        else "minecraft:blue_stained_glass",
    )
    s.block(
        -1,
        1,
        -1,
        "minecraft:glass"
        if id != "minecraft:glass"
        else "minecraft:blue_stained_glass",
    )
    s.block(-3, 0, 3, id, case.get("state"))
    s.notes.append(
        "Same material, corner and mixed-material boundary; view from both sides"
    )


def pane(s, case):
    id = case["block"]
    props = s.registry.blocks[id]["properties"]
    positions = {(x, 0) for x in range(-2, 3)} | {(2, 1), (2, 2)}
    directions = {"north": (0, -1), "east": (1, 0), "south": (0, 1), "west": (-1, 0)}
    for x, z in sorted(positions):
        for y in range(3):
            values = dict(case.get("state", {}))
            for direction, (dx, dz) in directions.items():
                if direction in props:
                    connected = (x + dx, z + dz) in positions
                    values[direction] = (
                        ("true" if connected else "false")
                        if "true" in props[direction]
                        else ("low" if connected else "none")
                    )
            s.block(x, y, z, id, values, check_state=False)
            s.connections.append(
                {
                    "position": s.blocks[next(reversed(s.blocks))]["position"],
                    "sides": {
                        d: (x + dx, z + dz) in positions
                        for d, (dx, dz) in directions.items()
                        if d in props
                    },
                }
            )
    s.block(-3, 0, 3, id)


def window(s, case):
    id = case["block"]
    props = s.registry.blocks[id]["properties"]
    for x in range(-1, 2):
        for y in range(2):
            state = {"facing": "north"} if "north" in props.get("facing", []) else {}
            s.block(x, y, 0, id, state, check_state=False)
    s.notes.append("Native window parts update against adjacent matching windows")


def plant(s, case):
    id = case["block"]
    props = s.registry.blocks[id]["properties"]
    soil = (
        "minecraft:sand"
        if id in ("minecraft:cactus", "minecraft:dead_bush")
        else "minecraft:grass_block"
    )
    if id == "minecraft:sugar_cane":
        s.block(1, -1, 0, "minecraft:water")
    s.block(0, -1, 0, soil)
    if "half" in props:
        s.block(0, 0, 0, id, {"half": "lower"})
        s.block(0, 1, 0, id, {"half": "upper"})
    else:
        s.block(0, 0, 0, id, case.get("state"))
        if id in ("minecraft:sugar_cane", "minecraft:cactus", "minecraft:bamboo"):
            for y in (1, 2):
                s.block(0, y, 0, id)


def crop(s, case):
    id = case["block"]
    age = int(case.get("state", {}).get("age", 0))
    soil = (
        "minecraft:soul_sand"
        if id.endswith("nether_wart")
        else "minecraft:grass_block"
        if id.endswith("sweet_berry_bush")
        else "minecraft:farmland"
    )
    s.block(0, -1, 0, soil, {"moisture": "7"} if soil.endswith("farmland") else {})
    if soil.endswith("farmland"):
        s.block(1, -1, 0, "minecraft:water")
    state = {"age": str(age)}
    if "half" in s.registry.blocks[id]["properties"]:
        state["half"] = "lower"
    s.block(0, 0, 0, id, state)
    if id == "minecraft:pitcher_crop" and age >= 3:
        s.block(0, 1, 0, id, {"age": str(age), "half": "upper"})
    s.block(3, -1, 0, "minecraft:sea_lantern")


def aquatic(s, case):
    for x in range(-2, 3):
        for z in range(-2, 3):
            s.block(x, -1, z, "minecraft:sand")
            for y in (0, 1, 2):
                s.block(
                    x,
                    y,
                    z,
                    "minecraft:glass"
                    if abs(x) == 2 or abs(z) == 2
                    else "minecraft:water",
                )
    id = case["block"]
    if id == "minecraft:lily_pad":
        s.block(0, 3, 0, id)
    elif id == "minecraft:kelp":
        s.block(0, 0, 0, "minecraft:kelp_plant")
        s.block(0, 1, 0, id, {"age": "25"})
    elif id == "minecraft:tall_seagrass":
        s.block(0, 0, 0, id, {"half": "lower"})
        s.block(0, 1, 0, id, {"half": "upper"})
    else:
        s.block(
            0,
            0,
            0,
            id,
            {"waterlogged": "true"}
            if "waterlogged" in s.registry.blocks[id]["properties"]
            else {},
        )


def lantern(s, case):
    s.block(-3, 0, 0, case["block"], {"hanging": "false"})
    s.block(3, 4, 0, "minecraft:stone")
    s.block(3, 3, 0, "minecraft:chain")
    s.block(3, 2, 0, case["block"], {"hanging": "true"})
    s.notes.append("Standing / hanging")


def wall_light(s, case):
    s.block(0, 1, -1, "minecraft:stone")
    props = s.registry.blocks[case["block"]]["properties"]
    state = {"facing": "south"} if "south" in props.get("facing", []) else {}
    s.block(0, 1, 0, case["block"], state)


def light(s, case):
    props = s.registry.blocks[case["block"]]["properties"]
    for x, on in [(-3, False), (3, True)]:
        s.block(x, -1, 0, "minecraft:redstone_block" if on else "minecraft:stone")
        state = {}
        if "facing" in props:
            state["facing"] = "up" if "up" in props["facing"] else "south"
        for name in ("lit", "powered"):
            if name in props:
                state[name] = str(on).lower()
        s.block(x, 0, 0, case["block"], state)
    s.notes.append("Unpowered / powered")


def bridge(s, case):
    variant = case.get("variant", "stair-east")
    if variant == "flat":
        for x in range(-2, 3):
            s.block(x, 0, 0, "mcwbridges:oak_log_bridge_middle")
        s.block(0, 1, 0, case["block"], {"facing": "east", "lightstate": "bridge"})
    else:
        facing = variant.removeprefix("stair-")
        stairs = {"east": "north", "south": "east", "west": "south", "north": "west"}
        s.block(
            0,
            0,
            0,
            "mcwbridges:oak_log_bridge_stair",
            {"facing": stairs[facing], "connection": "base"},
        )
        s.block(0, 1, 0, case["block"], {"facing": facing, "lightstate": "stair"})


def storage(s, case):
    id = case["block"]
    props = s.registry.blocks[id]["properties"]
    state = dict(case.get("state", {}))
    if "facing" in props:
        state.setdefault(
            "facing", "south" if "south" in props["facing"] else props["facing"][0]
        )
    nbt = (
        {"LootTable": "minecraft:chests/simple_dungeon"}
        if id.startswith("lootr:")
        else None
    )
    s.block(0, 0, 0, id, state, nbt)
    if id.startswith("lootr:"):
        s.notes.append("Open to inspect looted material; reset creates a new container")


def double_chest(s, case):
    id = case["block"]
    s.block(0, 0, 0, id, {"facing": "south", "type": "single"})
    s.block(1, 0, 0, id, {"facing": "south", "type": "left"})
    s.block(0, 0, 0, id, {"facing": "south", "type": "right"})


def copycat(s, case):
    material = case["material"]
    s.registry.state(material)
    for x in (-1, 0, 1):
        s.block(
            x,
            0,
            0,
            case["block"],
            {"facing": "north"},
            {"Material": {"Name": material}, "Item": {"id": material, "count": 1}},
        )
    s.tiles.append(
        {"position": s.case["position"], "values": {"Material.Name": material}}
    )


def stairs(s, case):
    for x, half in [(-3, "bottom"), (3, "top")]:
        s.block(
            x,
            0,
            0,
            case["block"],
            {"facing": "north", "half": half, "shape": "straight"},
        )


def slab(s, case):
    for x, kind in [(-3, "bottom"), (0, "top"), (3, "double")]:
        s.block(x, 0, 0, case["block"], {"type": kind})


def waterlogged(s, case):
    for x in range(-2, 3):
        for z in range(-2, 3):
            s.block(x, -1, z, "minecraft:stone")
            s.block(
                x,
                0,
                z,
                "minecraft:glass" if abs(x) == 2 or abs(z) == 2 else "minecraft:water",
            )
    s.block(0, 0, 0, case["block"], {**case.get("state", {}), "waterlogged": "true"})
    s.notes.append("Waterlogged specimen in a contained source pool")


def ladder(s, case):
    for y in range(4):
        s.block(0, y, -1, "minecraft:stone")
        s.block(0, y, 0, case["block"], {"facing": "south"})


def rail(s, case):
    id = case["block"]
    props = s.registry.blocks[id]["properties"]
    for z in range(-3, 4):
        y = 1 if z > 0 else 0
        s.block(
            0,
            y - 1,
            z,
            "minecraft:redstone_block" if "powered" in props else "minecraft:stone",
        )
        s.block(
            0,
            y,
            z,
            id,
            {"shape": "ascending_south" if z == 0 else "north_south"},
            check_state=False,
        )


def door(s, case):
    id = case["block"]
    props = s.registry.blocks[id]["properties"]
    for x, on in [(-3, False), (3, True)]:
        state = {"facing": "south", "open": str(on).lower(), "powered": str(on).lower()}
        if "half" in props and "upper" in props["half"]:
            state["half"] = "lower"
            s.block(x, 0, 0, id, state)
            s.block(x, 1, 0, id, {**state, "half": "upper"})
        else:
            state["half"] = "bottom"
            s.block(x, 0, 0, id, state)
        if on:
            s.block(x, -1, 0, "minecraft:redstone_block")


def entity(s, case):
    for x in range(-3, 4):
        for z in range(-3, 4):
            s.block(x, -1, z, "minecraft:smooth_stone")
            if abs(x) == 3 or abs(z) == 3:
                for y in range(2):
                    s.block(x, y, z, "minecraft:glass")
    data = {"NoAI": not case.get("motion", False), "Rotation": [180, 0]}
    if case["entity"] == "minecraft:piglin":
        data["IsImmuneToZombification"] = True
    if case.get("baby"):
        data["Age"] = -2147483648
    s.entity(case["entity"], data=data)
    s.notes.append(
        "Motion pen" if case.get("motion") else "Stationary specimen; gravity retained"
    )


def equipment(s, case):
    material = case["material"]
    items = [
        "minecraft:" + material + "_" + part
        for part in ["boots", "leggings", "chestplate", "helmet"]
    ]
    for id in items:
        if id not in s.registry.items:
            raise ValueError("Unknown armor item: " + id)
    s.entity(
        "minecraft:armor_stand",
        data={"ShowArms": True, "ArmorItems": [{"id": id, "count": 1} for id in items]},
    )
    s.block(3, 0, 0, "minecraft:chest")
    s.items(3, 0, 0, items)


def workstation(s, case):
    id = case["block"]
    props = s.registry.blocks[id]["properties"]
    state = {}
    if "facing" in props:
        state["facing"] = "south"
    if "orientation" in props:
        state["orientation"] = "north_up"
    if id == "minecraft:brewing_stand":
        state = {f"has_bottle_{i}": "true" for i in range(3)}
    nbt = (
        {"Items": [{"Slot": i, "id": "minecraft:potion", "count": 1} for i in range(3)]}
        if id == "minecraft:brewing_stand"
        else None
    )
    s.block(0, 0, 0, id, state, nbt)


def campfire(s, case):
    for x, on in [(-3, False), (3, True)]:
        s.block(x, 0, 0, case["block"], {"lit": str(on).lower()})


def fluid(s, case):
    for x in range(-2, 3):
        for z in range(-3, 4):
            s.block(x, -1, z, "minecraft:stone")
            if abs(x) == 2 or abs(z) == 3:
                for y in range(4):
                    s.block(x, y, z, "minecraft:glass")
    s.block(0, 2, -2, "minecraft:stone")
    s.block(0, 3, -2, case["block"], {"level": "0"})
    s.notes.append("Source and falling stream; contained basin")


def effect(s, case):
    if case["variant"] == "smoke":
        s.block(0, -1, 0, "minecraft:hay_block")
        s.block(0, 0, 0, "minecraft:campfire", {"lit": "true"})
    elif case["variant"] == "bubbles":
        for x, z in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            for y in range(3):
                s.block(x, y, z, "minecraft:glass")
        s.block(0, -1, 0, "minecraft:soul_sand")
        for y in range(3):
            s.block(0, y, 0, "minecraft:bubble_column", {"drag": "false"})
    else:
        raise ValueError("Unknown effect")


def kinetic(s, case):
    s.block(-2, 0, 0, case["block"], {"facing": "east"}, {"ScrollValue": 32})
    s.block(-1, 0, 0, "create:shaft", {"axis": "x"})
    s.block(0, 0, 0, "create:cogwheel", {"axis": "x"})
    for x in (-2, -1, 0):
        pos = list(s.case["position"])
        pos[0] += x
        s.tiles.append({"position": pos, "values": {"Speed": 32}})
    s.notes.append("Creative rotation reference; no automatic ship assembly")


RECIPES = {
    name: value
    for name, value in globals().copy().items()
    if name
    in {
        "glass",
        "pane",
        "window",
        "plant",
        "crop",
        "aquatic",
        "lantern",
        "wall_light",
        "light",
        "bridge",
        "storage",
        "double_chest",
        "copycat",
        "stairs",
        "slab",
        "waterlogged",
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
    }
}
RECIPES["block"] = basic


def build_case(registry, group, case):
    recipe = case.get("recipe", group["recipe"])
    if recipe not in RECIPES:
        raise ValueError("Unsupported recipe: " + recipe)
    specimen = Specimen(registry, case, group)
    RECIPES[recipe](specimen, case)
    return specimen
