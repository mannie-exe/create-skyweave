"""Compiler and world-write boundaries; scenery is checked in the native game."""

import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from debug_world.compiler import compile_pack
from debug_world.plan import make_plan
from debug_world.registry import Registry
from debug_world.runtime import marked, neoforge_args, world_lock

ROOT = Path(__file__).resolve().parents[1]


class DebugWorld(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.config = self.root / "config"
        (self.config / "districts").mkdir(parents=True)
        settings = json.loads((ROOT / "authoring/debug-world/world.json").read_text())
        (self.config / "world.json").write_text(json.dumps(settings))
        (self.config / "profiles.json").write_text(
            json.dumps(
                {
                    "schema": 1,
                    "profiles": {"test": {"loader": "vanilla", "districts": ["test"]}},
                }
            )
        )
        self.district = {
            "id": "test",
            "title": "Test",
            "anchor": [100, 128, 100],
            "color": "white",
            "groups": [
                {
                    "id": "blocks",
                    "title": "Blocks",
                    "recipe": "block",
                    "selector": {"ids": ["minecraft:glass"]},
                }
            ],
        }
        self.write_district()
        # Small explicit metadata fixture, not evidence of native registry behavior.
        blocks = []
        for id in (
            "air",
            "smooth_stone",
            "white_concrete",
            "command_block",
            "stone_button",
            "glass",
        ):
            blocks.append(
                {
                    "id": "minecraft:" + id,
                    "properties": {"face": ["floor"]} if id == "stone_button" else {},
                    "hierarchy": ["test.GlassBlock"] if id == "glass" else [],
                    "tags": [],
                }
            )
        path = self.root / "registry.json"
        path.write_text(
            json.dumps(
                {
                    "schema": 1,
                    "minecraft": "1.21.1",
                    "loader": "vanilla",
                    "dataPackFormat": 48,
                    "buildBounds": {"minY": -64, "maxYExclusive": 320},
                    "blocks": blocks,
                    "items": [],
                    "entities": [{"id": "minecraft:text_display"}],
                }
            )
        )
        self.registry = Registry(path)

    def write_district(self):
        (self.config / "districts/test.json").write_text(json.dumps(self.district))

    def test_exact_ids_properties_and_required_optional_selections(self):
        with self.assertRaisesRegex(ValueError, "Unknown block"):
            self.registry.state("minecraft:missing")
        with self.assertRaisesRegex(ValueError, "invalid facing"):
            self.registry.state("minecraft:glass", {"facing": "north"})
        with self.assertRaisesRegex(ValueError, "Missing required"):
            self.registry.select({"ids": ["minecraft:missing"]})
        self.assertEqual(
            self.registry.select({"ids": ["minecraft:missing"], "optional": True}),
            ([], ["minecraft:missing"]),
        )
        self.assertEqual(
            self.registry.select({"classes": ["GlassBlock"]}), (["minecraft:glass"], [])
        )
        self.assertEqual(
            self.registry.select(
                {"classes": ["GlassBlock"], "excludeClasses": ["GlassBlock"]}
            ),
            ([], []),
        )

    def test_wrong_runtime_and_overlapping_floors_are_rejected(self):
        self.registry.data["loader"] = "neoforge"
        with self.assertRaisesRegex(ValueError, "genuine vanilla"):
            make_plan(self.config, self.registry, "test")
        self.registry.data["loader"] = "vanilla"
        self.district["anchor"] = [0, 250, 0]
        self.write_district()
        with self.assertRaisesRegex(ValueError, "Overlapping district"):
            make_plan(self.config, self.registry, "test")

    def test_group_paths_and_duplicate_groups_are_rejected(self):
        self.district["groups"][0]["id"] = "../outside"
        self.write_district()
        with self.assertRaisesRegex(ValueError, "Invalid group ID"):
            make_plan(self.config, self.registry, "test")
        self.district["groups"][0]["id"] = "blocks"
        self.district["groups"].append(copy.deepcopy(self.district["groups"][0]))
        self.write_district()
        with self.assertRaisesRegex(ValueError, "Duplicate group ID"):
            make_plan(self.config, self.registry, "test")

    def test_determinism_plan_ownership_and_failed_publication(self):
        plan = make_plan(self.config, self.registry, "test")
        before = copy.deepcopy(plan)
        a, b = self.root / "a", self.root / "b"
        first = compile_pack(plan, self.registry, a)
        second = compile_pack(plan, self.registry, b)
        self.assertEqual(plan, before)
        self.assertEqual(first, second)
        self.assertEqual(
            {p.relative_to(a): p.read_bytes() for p in a.rglob("*") if p.is_file()},
            {p.relative_to(b): p.read_bytes() for p in b.rglob("*") if p.is_file()},
        )
        previous = (a / "debug-world-manifest.json").read_bytes()
        bad = copy.deepcopy(plan)
        bad["districts"][0]["color"] = "missing"
        with self.assertRaisesRegex(ValueError, "Unknown block"):
            compile_pack(bad, self.registry, a)
        self.assertEqual((a / "debug-world-manifest.json").read_bytes(), previous)
        self.assertIn(
            "unless data storage debug_world:state schema",
            (a / "data/debug_world/function/load.mcfunction").read_text(),
        )
        self.assertIn(
            "execute in minecraft:overworld",
            (a / "data/debug_world/function/reset/test/blocks.mcfunction").read_text(),
        )

    def test_native_loader_uses_the_capture_without_falling_back(self):
        for version in ("21.1.264", "21.1.265"):
            args = (
                self.root
                / "libraries/net/neoforged/neoforge"
                / version
                / "unix_args.txt"
            )
            args.parent.mkdir(parents=True)
            args.write_text("fixture")
        self.assertEqual(neoforge_args(self.root, "21.1.265").parent.name, "21.1.265")
        with self.assertRaisesRegex(ValueError, "Expected captured"):
            neoforge_args(self.root, "21.1.266")
        for invalid in (None, "../21.1.265", "21.2.1"):
            with self.assertRaisesRegex(ValueError, "exact NeoForge"):
                neoforge_args(self.root, invalid)

    def test_unmarked_and_loaded_worlds_refuse_writes(self):
        world = self.root / "world"
        world.mkdir()
        with self.assertRaisesRegex(ValueError, "unmarked"):
            marked(world)
        (world / "session.lock").write_bytes(b"lock")
        child = subprocess.Popen(
            [
                sys.executable,
                "-c",
                'import fcntl,sys; f=open(sys.argv[1],"r+b"); fcntl.lockf(f,fcntl.LOCK_EX); '
                'print("locked",flush=True); sys.stdin.readline()',
                str(world / "session.lock"),
            ],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            text=True,
        )
        try:
            self.assertEqual(child.stdout.readline().strip(), "locked")
            with self.assertRaisesRegex(ValueError, "World is loaded"):
                with world_lock(world):
                    self.fail("must not obtain a live world lock")
        finally:
            child.communicate("\n", timeout=5)
        with world_lock(world):
            pass


if __name__ == "__main__":
    unittest.main()
