# World runtime authoring and adoption

The world-runtime program combines individual-mod tuning with cross-mod correctness and efficiency. Runtime adapters and exact native seams belong to the `skyweave-compat` repository's `docs/development/world-runtime.md`, `longshot.md`, `water.md`, `lod.md`, and `rendering.md`. This page owns pack configuration/resource decisions, candidate assembly, and adoption gates. It does not enable proposed adapters or select a DW14 release.

## Workstream ownership

| Workstream | Pack-owned inputs | Adoption requirement |
| --- | --- | --- |
| Baseline profiling and tuning | Native effective C2ME/DH/RPL settings, installation policy, fixed workload and graphics inputs | Useful completed output plus individual and affected combined measurements; no universal host-independent thread claim |
| Interaction integrity and visibility | Existing tool ranges, native CBC loading policy, controls, content and resources | Exact native action/custody/authority/constraint and tracking outcomes; mathematical reach or startup is insufficient |
| DW14 migration | One qualified Compat/DW pair, native registered config, generation/data/profile identity and review defaults | Complete physical terrain/features/fluid/current lifecycle and fresh-world exports, separate from baseline improvements |
| Renderer/shader integration | Exact shader/patch inputs, recipes, models/materials, output provenance and player preferences | Actual DH/Iris/Veil/Sable paths, three pack chains, recipient byte equality, supported-hardware visuals and cost |
| Lifecycle and durability | Realistic effective view/heap/background work, nonempty saved/LOD/current data | Normal close, useful second-JVM readback and same-process reconnect; no discarded work to improve timing |

Independent baseline candidates may be reviewed and released without finishing DW14. Do not bundle an unqualified water migration into an unrelated tuning release or claim water acceptance from baseline success. The separate Skyweave mod retains its own generator/save authority; its native experiments inform this program without making it a pack dependency.

## Configuration and resource owners

Use `empack.yml` and the lock for exact dependency acquisition and `empack.bindings.yml` for installation policy. A materialized local candidate can differ from committed declarations; qualify one explicit assembly rather than silently mixing them. Generated data/resources retain their authoring scripts and audit reasons. Editing a generated copy does not establish ownership.

| Input | Owner and timing | Required review |
| --- | --- | --- |
| Compat feature switches | Startup-selected common file; explicit false survives | Exact selector/dependency/side and inactive behavior; no unknown retired keys |
| Geometry, water and structure generation | Existing authored common JSON/TOML and saved identity | Freeze effective generation/data inputs; preserve foreign worlds and reject incompatible owned saves before writes |
| Native DW14 configuration | Actual registered native spec/file and qualified re:form binding | Complete14 defaults/keys, field application timing, generation allowlist, obsolete-key removal, player edit conflicts |
| C2ME and DH workers | Native config/preset writers with explicit managed/seed decision | Effective host values, coupled pools/queues, useful output and foreground latency; no launcher-only assumption |
| RPL/CBC loading and tools | Native server config plus existing gameplay rationale | Saved versus missing/generation/ticking policy, range shapes, cleanup and real completed actions |
| Beyond current forces | Native enabled/force/contact policy plus qualified Compat producer retirement | Actual whole-tick force ownership, frame/contact/damping and mass behavior; never delete the whole compound water bridge blindly |
| Shader recipes and resources | Existing shader-lab/recipient engine and client authoring sources | Exact hashes/preconditions, capability and material/pass contracts; preserve user settings/selections |
| JVM/renderer preferences | Existing templates and justified seed ownership | Actual effective values and host headroom; fixture limits/profiling flags never become distribution defaults implicitly |

Default distributed files to managed ownership unless the [installation policy](authoring.md#installation-file-policies) justifies seed. Preserve normal edited-file conflict handling. Use one authoritative setting per owner; a new Compat adapter does not duplicate a native separation/range/current field. Source, native comments and an editable screen alone cannot decide ownership.

The authored tool settings are connector 16/64/128, Simulated rope ceiling 255, Skybound rope 64, plunger separation 64, pulley 512 and ejector 64. Their units/endpoint semantics remain native; longer flight and new preparation behavior require a separate selected gameplay decision. Both native CBC projectile/smoke loading switches remain selected until an equivalent replacement or explicit policy change qualifies. See [Longshot interactions](longshot-interactions.md).

For the future water review candidate, retain native DW14 defaults with the selected DYNAMIC lowland mode, VALLEY_GORGE_TUNNEL, arches/fords enabled for review, mountain tunnels false and an alternate GORGE_TUNNEL control. Preserve intentional menu/panorama/welcome choices, current preferences, and native Sky Arch river/lake planners disabled under Compat ownership. Experimental review defaults must work through actual native effects; do not leave their field enabled while suppressing the feature in an unqualified bridge.

## Candidate and release gates

1. Freeze one explicit source/product/library/native/resource/config assembly. Record relevant uncommitted prerequisites and local inputs; a branch name or existing DEV snapshot is not an immutable candidate. Keep local candidate URLs out of a public manifest.
2. Qualify each changed optional boundary and its useful native behavior. Then run affected combined scenarios with real current pack settings, C2ME, DH, physics, networking and selected shader/resource paths. The [performance procedure](performance.md) owns measurement and compact retention; Compat's package qualification owns native authority/output controls.
3. For DW14, establish fresh generation/watershed identity from the actual rewritten source and effective data. Verify terrain/biome/query parity, actual structures and enabled features, physical fluid ticks/reopen, live current and force/publication, malformed-data and lifecycle behavior. A target JAR plus inactive old VANILLA mode or a sibling prepared-field receipt is not a migration.
4. Review all port/keep/retire decisions. Remove obsolete selectors, patches, generated metadata and duplicate resources only after native replacement controls pass. Preserve independent global/frame/climate/render/input fixes. Native source/credits/licensing remain with their actual owners.
5. Build the reference profiles with the owning scripts and inspect each archive. Use one immutable qualified Compat/DW/re:form set, include matching Resource/Visual Patches scope, exclude client shader/render payloads from server output, and verify managed/seed policies and generation defaults. Reference and bundled delivery exercise different acquisition paths.
6. Supply a review-ready disposable candidate artifact and guide with seed/coordinates, effective feature states, expected actions/output, hardware limits and remaining decisions. Personal installation, resetting old worlds, server operations, publication and pushing require their own selected authority.

The existing reference build command is:

```sh
python3 scripts/build-pack.py --profile prism --profile modrinth --profile server
```

For an explicitly selected future release, publish and verify Compat first, replace local pins with immutable public artifacts, regenerate through empack, qualify the resulting pack exports, and then publish the pack. Do not turn a documentation commit, generated archive or old rollout authorization into a current publication/install operation. Keep local baseline and water-migration candidates independently reviewable until their release scopes are selected.

## Maintenance and bounded evidence

Update owning [compatibility](compatibility.md), [world-generation](worldgen.md), [build](build.md), [authoring](authoring.md), [patch-maintenance](patches.md), graphics and content indexes when the actual implementation changes. Player guides describe installed behavior and usage, not private experiments or future API proposals. Remove contradictory retirement/default claims rather than appending another migration diary.

Reuse the existing native probes, source-bound input inventories, JFR capture/analysis helpers and shader recipient engine. A new scenario must exist in its actual parser/observer before a command is documented as supported. Keep exact inputs, commands, meaningful outputs, failures and compact per-run metrics; retain only consequential raw traces. Do not copy vendor trees, worlds, caches or recordings for every package, and never prune personal or predecessor evidence as a side effect.

When dependencies change, recheck their actual callers, coordinate frames/stages, target descriptors, worker/task ownership, native payload/store formats and source/buffer lifetimes. Individual-mod gains need affected combined checks before adoption. Renderer delivery, terrain residency and active simulation remain separate; pack config cannot make DH a native collision authority or make an archived body active by displaying it.
