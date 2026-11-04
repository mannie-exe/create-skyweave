#!/usr/bin/env python3
"""Plan, compile, generate, verify and install a marked Debug World."""

import argparse
import json
from pathlib import Path
import sys

from debug_world.registry import Registry, read_json, vanilla_registry
from debug_world.plan import make_plan
from debug_world.compiler import compile_pack

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="operation", required=True)
    for operation in ("plan", "compile"):
        p = sub.add_parser(operation)
        p.add_argument("--config", type=Path, default=ROOT / "authoring/debug-world")
        p.add_argument("--registry", type=Path, required=True)
        p.add_argument("--profile", required=True)
        p.add_argument("--names", type=Path)
        p.add_argument("--output", type=Path, required=operation == "compile")
    p = sub.add_parser("vanilla-registry")
    p.add_argument("--reports", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    p = sub.add_parser("generate")
    p.add_argument("--compiled", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--work", type=Path, required=True)
    p.add_argument("--server", type=Path, required=True)
    p.add_argument("--java", type=Path, required=True)
    p.add_argument("--vanilla-jar", type=Path)
    p.add_argument("--timeout", type=int, default=600)
    p = sub.add_parser("verify")
    p.add_argument("--world", type=Path, required=True)
    p = sub.add_parser("install")
    p.add_argument("--world", type=Path, required=True)
    p.add_argument("--client-game", type=Path, required=True)
    p.add_argument("--name", default="Debug World")
    p.add_argument("--replace", action="store_true")
    args = parser.parse_args()
    if args.operation == "vanilla-registry":
        print(vanilla_registry(args.reports, args.output))
        return
    if args.operation in ("plan", "compile"):
        registry = Registry(args.registry)
        plan = make_plan(args.config, registry, args.profile)
        if args.operation == "plan":
            result = {
                "profile": args.profile,
                "cases": plan["caseCount"],
                "districts": [
                    {
                        "id": d["id"],
                        "cases": sum(len(g["cases"]) for g in d["groups"]),
                        "bounds": d["bounds"],
                    }
                    for d in plan["districts"]
                ],
                "omissions": plan["omissions"],
                "configSha256": plan["configSha256"],
                "runtimeSha256": plan["runtimeSha256"],
            }
            if args.output:
                args.output.parent.mkdir(parents=True, exist_ok=True)
                args.output.write_text(json.dumps(plan, indent=2) + "\n")
            print(json.dumps(result, indent=2))
            return
        manifest = compile_pack(
            plan, registry, args.output, read_json(args.names) if args.names else None
        )
        print(
            json.dumps(
                {
                    "output": str(args.output),
                    "cases": plan["caseCount"],
                    "stages": len(manifest["stages"]),
                    "sourceSha256": manifest["sourceSha256"],
                },
                indent=2,
            )
        )
        return
    from debug_world.runtime import generate, install, world_lock
    from debug_world.verify import verify_world

    if args.operation == "generate":
        generate(
            args.compiled,
            args.output,
            args.work,
            java=args.java,
            server=args.server,
            vanilla_jar=args.vanilla_jar,
            timeout=args.timeout,
        )
    elif args.operation == "install":
        print(install(args.world, args.client_game, args.name, args.replace))
    elif args.operation == "verify":
        with world_lock(args.world):
            result = verify_world(args.world)
        print(json.dumps(result, indent=2))
        if not result["passed"]:
            raise SystemExit(1)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, RuntimeError) as error:
        print(f"Debug World: {error}", file=sys.stderr)
        raise SystemExit(2)
