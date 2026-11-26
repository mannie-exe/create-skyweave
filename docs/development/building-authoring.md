# Building authoring

The building workshop derives a Creative editing environment from Create: Skyweave's locked content. It keeps useful construction and decorative providers, their required dependencies, matching configurations, and visual resources. Mighty Architectury is an authoring tool; a baked village template must not require it at runtime.

The White Terrace freight kit has two appearance-approved variants: an 11×22 depot and a 17×27 hall. The smaller depot is selected for the first proposed entry. Both remain outside active village pools; the selected revision still needs current natural-island support, approach, and saved-reopen qualification. Candidate approval, placement qualification, and pool activation are separate decisions.

## Inputs and tools

- `authoring/buildings/environment.json` selects content by logical dependency key and records the authoring-only Mighty artifact. Production versions come from `empack.lock`, not a second handwritten version list.
- `authoring/buildings/white-terrace/brief.json` owns the pilot's purpose, dimensions, entrance and aisle expectations, palettes, and original voxel parts. A04 frontage and A07 detailing are reference observations; their provider geometry is not copied.
- `scripts/building-authoring.py` compiles theme resources, derives the empack project, and prepares disposable native fixtures. Importing its modules does not launch Minecraft.
- Python is sufficient for theme compilation. Environment derivation also requires PyYAML 6.0.3. Use a tool virtual environment rather than changing the Atlas environment.
- Native preparation uses Java 21 and the existing Compat `tools/client_bootstrap.py` plus its prepared NeoForge 21.1.265 client inputs. Supply that read-only tools directory explicitly. Run the owning `preparePackagedClient` task if those inputs are unavailable; use `--no-daemon`, bounded workers, and verify owned process exits.

## Prepare the workshop

Use a new output directory for each preparation. Commands refuse to overwrite existing candidates or runtimes.

```sh
python scripts/building-authoring.py theme \
  --brief authoring/buildings/white-terrace/brief.json \
  --output /absolute/work/white-terrace.zip

python scripts/building-authoring.py environment \
  --pack . \
  --selection authoring/buildings/environment.json \
  --output /absolute/work/authoring-project

empack --workdir /absolute/work/authoring-project sync --materialize
empack --workdir /absolute/work/authoring-project check
```

The derivation checks recorded file digests and follows required provider relationships and native metadata, including nested JARs. Universal JARs use their NeoForge descriptor; their Fabric-only nested contents are not additional NeoForge dependencies. Connector's Fabric loader surface is treated as such only when Connector is selected. Static metadata closure does not prove API compatibility; load the actual derived runtime.

The derived project's `authoring-environment.json` records parent manifest, lock, bindings, and selector identities, selected and omitted content, and pending checks. A changed parent requires a fresh derivation. Preserve provider pins and local artifact digests when reviewing that change.

```sh
python scripts/building-authoring.py prepare-api-proof \
  --brief authoring/buildings/white-terrace/brief.json \
  --theme /absolute/work/white-terrace.zip \
  --mighty /absolute/downloads/mightyarchitect-3.2.2+mc1.21.1-neoforge.jar \
  --bootstrap-tools /absolute/compat/tools \
  --java-home /absolute/java-21 \
  --output /absolute/work/api-proof

python scripts/building-authoring.py prepare-runtime \
  --pack . \
  --project /absolute/work/authoring-project \
  --prepared-probe /absolute/work/api-proof \
  --output /absolute/work/authoring-client
```

To open a manual editing workshop, add `--interactive` to `prepare-runtime` using an authoring preparation, rather than a template-only preparation. That removes the automatic observer and shutdown. The isolated workshop uses G for Mighty composition and F6 for its tool menu, leaving Effortless Building's Alt menu intact. On macOS, function-key handling can require Fn-F6. These are authoring-instance defaults; production controls are unchanged.

Mighty's manual room planner requires an odd façade width. The draft pilots use 11- and 17-block widths. The narrow draft has an explicitly authored nine-block wall span between its corners; the other walls use the five-block repeating bay. An unsupported span is refused before export. The scripted route checks both wall directions, corners, and roof against the loaded theme and rejects fallback components. Manual experiments should use supported room heights and wall spans. Select the White Terrace theme and flat roof in the native controls. The earlier 12-block narrow export remains a comparison artifact, rather than a manual-planner input.

Preparation does not launch a client. The marked fixture's `launch.json` contains an argument array for its exact game directory. Launch it as an argument array with that directory as the working directory; do not pass it through shell interpolation. Coordinate graphical access through re:desktop before starting. Preserve personal clients and worlds. Capture the process exit and verify the actual owned JVM has exited; a completed wrapper alone is insufficient.

Add `--preview` to `prepare-api-proof` to place and furnish both drafts, check the aisle, and capture exterior/interior views. This is a scripted fixture; it closes after retaining its results.

For a repeatability check, also pass `--compare-exports-from /absolute/work/retained-authoring-client/exports`. Preparation freezes the control files; the native observer compares every rebuilt vanilla, modded, and furnished template as typed NBT. Retain the archive digests as well. A changed input requires a new review rather than replacement of the control.

After obtaining desktop access, use the same runner for a scripted fixture or an interactive workshop:

```sh
python scripts/building-authoring.py run --root /absolute/work/authoring-client
```

Scripted runs retain their actual exit and native report in `run-result.json` and require a fresh fixture. Interactive runs report only the session exit and make no automatic qualification claim. Relaunch the same interactive workshop with the same command; it preserves its worlds and numbered logs/results in `interactive-sessions/`, with `run-result.json` storing the latest result. A native file lock prevents simultaneous launchers; an unfinished live process must be inspected before reopening. Scripted runs have a bounded duration. Interactive sessions remain open until closed. An interrupted run attempts graceful termination of its own process and retains the PID if it cannot confirm exit.

The native observer creates its own flat world, discovers the custom theme through the real resource manager, composes both variants, and exports each twice. It refuses absent palette blocks and invalid properties rather than accepting Mighty's fallback. `authoring-result.json` reports that witness. A successful Java process exit does not imply a passing report.

## Theme and bake boundary

Mighty's editable designs use palette-letter voxel slices. The compiler emits wall bays, width-specific entrance façades, corners, foundations, and a flat roof from one original kit. The façades retain the same material roles and adjust opening parity so rotated front and rear entrances align. Space is an absent design cell; `Q` is Mighty's clearing role. Native exports include explicit air within their bounds. Neither is implicitly structure void.

The exported bounds include roof overhangs and can differ from the room dimensions. Retain the native origin and ground datum when normalizing or joining an approach. Never assume that an export's coordinate zero is its entrance.

Mighty's sketch view contains block states, returns no block entities, and exports without entities. Its optional blueprint post-process fails to compile on the observed Mac/Iris host. The fixture uses the native `ClientSettings.setBlueprintView(false)` preference and unloads the composer before captures; no shader patch or rendering bypass is added. Use Mighty for the architectural shell. Furnish the placed shell through explicit repeatable operations, then capture the final volume with native `StructureTemplate`, preserving relevant block/entity data. Do not round-trip arbitrary native payloads through the simpler village JSON cell compiler: that compiler is not a general NBT importer.

The editing runtime carries native configs and resources from authored pack files. It does not copy personal settings. Its scoped Resource Patches view uses the owning resource collector and contains assets only; gameplay recipes, quests, village pools, and generation data are omitted. This is a Creative design boundary, not a claim of identical gameplay. Shaders start disabled, with the available authored shader resources retained for deliberate review.

## Frozen-template qualification

Use the exact furnished NBT exports selected for review. `--templates-from` prepares a separate consumer observer with no Mighty runtime dependency. Staging excludes the exact authoring-tool artifact from the derived editing project, and the native consumer refuses to qualify a scene if Mighty is loaded. `--full-pack` stages the current client-side lock, full authored Resource Patches data, and current visual resources. It excludes artifacts explicitly marked unsupported on the client.

Add `--candidate narrow-depot` or `--candidate wide-freight-hall` to `prepare-api-proof` to qualify only that exact brief variant. Omitting it retains the two-candidate comparison. This selects a fixture input; the exact approved hashes and chosen entry belong to the admission proposal, not the command-line option.

```sh
python scripts/building-authoring.py prepare-api-proof \
  --brief authoring/buildings/white-terrace/brief.json \
  --theme /absolute/work/white-terrace.zip \
  --mighty /absolute/downloads/mightyarchitect-3.2.2+mc1.21.1-neoforge.jar \
  --bootstrap-tools /absolute/compat/tools \
  --java-home /absolute/java-21 \
  --templates-from /absolute/work/authoring-client/exports \
  --output /absolute/work/template-proof

python scripts/building-authoring.py prepare-runtime \
  --pack . \
  --project /absolute/work/authoring-project \
  --prepared-probe /absolute/work/template-proof \
  --output /absolute/work/full-pack-placement \
  --full-pack
```

On the qualified macOS ARM64 host, prepare the actual production bootstrap from public Prism component metadata and installed libraries. This reads neither account data nor personal instances:

```sh
python scripts/building-authoring.py production-bootstrap \
  --root /absolute/work/full-pack-placement \
  --prism-root /absolute/PrismLauncher \
  --java-home /absolute/java-21

python scripts/building-authoring.py run --root /absolute/work/full-pack-placement
```

A production run differs from a ModDev run: their transformed Minecraft bytecode can differ even at the same game version. The production adapter currently supports only the exact documented 1.21.1/NeoForge 21.1.265/macOS ARM64 metadata combination. Requalify it before widening that contract. Game arguments are passed as an argument array; BootstrapLauncher does not expand a post-main `@file` itself.

The same production preparation accepts an authoring runtime. It preserves the fixture's `--preview` selection so native composition proceeds to furnishing and captures. Preparing launch arguments does not prove that the client, export, or captures pass.

For an independent saved-world check, prepare another matching template runtime, then copy the completed owned fixture save under its native session lock. Existing destination saves are refused. The product/resource cohort must match; only the observer JAR may differ.

```sh
python scripts/building-authoring.py prepare-reopen \
  --root /absolute/work/full-pack-reopen \
  --source /absolute/work/full-pack-placement

python scripts/building-authoring.py run --root /absolute/work/full-pack-reopen
```

The template consumer checks both normal and 90° placement, actual registered states, explicit air, native empty processors and jigsaw replacement, and required block-entity payload fields. Reopen performs inspection without placing the templates again. It records native resource owners and sampled model geometry. These are bounded placement and rendering witnesses; a flat fixture's solid base cells do not establish terrain fitting on a natural island. Current freight candidates contain no template entities; adding them requires a corresponding entity-custody check.

Island reopen uses the retained placement report's exact template, rotation, and origin rather than searching for a new site. The saved-world helper checks the preset and terrain mode as well as product/resource identity. The explicit two-step companion used by the north-facing pilot has its own native bearing, dry landing, and headroom checks. It is fixture scenery outside the unchanged baked bounds, not an automatically generated road.

For island captures, the observer waits for matching client blocks from the candidate's occupied sections and a compiled front section before its settling interval. Server placement and a fixed number of client ticks alone do not prove a ready image. `client-scene-status.json` records bounded readiness diagnostics, including client height bounds; an incomplete image is not a visual acceptance result. Headroom uses dry, non-block-entity native collision space, with a solid obstruction control. Native replaceable vegetation may occupy an intended stair placement cell; bearing rules remain separate.

Add `--island` to the full-pack `prepare-runtime` command for a separate natural-terrain check. It reads the authored Default World Type preset; upstream Sky Archipelagos presets do not necessarily reproduce the pack's generator settings. The observer uses the pinned Compat island/style index to shortlist sites, then checks actual stored terrain, biome, dry bearing, shallow cavities, and the native complete-support evaluator. It refuses excessive slope and missing terrain. Its bounded stone footings are fixture work, not a production grading change. A passing footprint or clear entrance does not prove an external road connection or automatic settlement planning. Retain rejected sites as evidence; do not relax the rules merely to obtain a placement.

Read the heightmap from an explicitly loaded native chunk. `Level.getHeight` returns the minimum world height when its chunk is not loaded, so that result cannot establish void. `LevelChunk.getHeight` returns the occupied surface Y; the level-level convenience method returns one above it. `MOTION_BLOCKING_NO_LEAVES` still includes trunks, so the fixture conservatively refuses those columns instead of calling them natural bearing.

Write a local comparison from a completed authoring preview:

```sh
python scripts/building-authoring.py review \
  --root /absolute/work/authoring-client \
  --output /absolute/work/white-terrace-review.html
```

## Review and admission

Present both variants with exterior, interior, and comparison views. Show the work performed, loading access, floor and entrance elevations, and road/court connection. Keep native export equality, appearance review, and functional qualification separate. Owner approval identifies an exact candidate, not every future output of a theme.

Before proposing a village entry, qualify its real registered states, directional and paired blocks, support, mandatory approaches, aisle clearance, connector data, relevant processors, mod requirements, inventories, and other payloads. Verify placement, an appropriate rotation, and save/reopen in a disposable current full-pack fixture. Include meaningful refusal cases. A reduced workshop startup or an exported NBT file does not satisfy that gate.

`authoring/buildings/white-terrace/admission-proposal.json` is an inactive proposal outside the generation manifest. It names the target profile/pool, exact candidate identities, original attribution, native processor/projection choice, and a bounded role entry. It is not consumed by `generate-villages.py`.

Keep the proposed pool/profile association inactive until separately approved. Record its role, weight or limit, exact template and source identities, attribution, and test limits. Preserve the existing annotated Architecture Study world. Installing another preview save, changing production pins, syncing personal instances, or publishing requires the corresponding owner authorization.

## Update and test

Run the focused tool checks:

```sh
python -m unittest discover -s tests -p test_building_authoring.py -v
```

When updating Mighty, inspect the exact packaged theme codecs, palette resolution, composition, fallback, and export behavior before changing the pinned authoring artifact. Repeat native discovery and export controls. Requalify registry/resource winners when a material provider, model library, Compat adaptation, or relevant configuration changes. Retain useful results and previews before removing only task-owned disposable runs; never remove annotated worlds or another task's evidence.
