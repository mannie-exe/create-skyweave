# Dependency and patch maintenance

Update coupled components together, then verify the behavior the patch protects.
The manifest and lock own exact selections. This guide owns update procedures;
[compatibility](compatibility.md), [structures](structures.md) and
[progression](progression.md) own behavior and measured limits.

## Ownership and coupling

| Component                       | Source / output                                                              | Update together                                                                                                                                                    | Required check or removal condition                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DH Polygon Fix 1.0.2            | Separate `dh-polygon-fix` repository; URL pin and placement in empack        | DH 3.3.3, SSRD, Iris/Sodium and the native GL query                                                                                                                | The patch requires DH 3.3.3. When updating DH, verify the upstream query fix and remove the incompatible patch; test native query/restore and shader pipelines.                                                                                                                                                                                                                   |
| Skyweave: Compatibility Patches               | `skyweave-compat` source project; common referenced JAR                    | Sky Archipelago 1.3.6; optional Sky Villages 1.0.6 + Architectury 13.x, Sable 2.0.6 and ADQ 1.1.1                                                                  | Revalidate terrain, geology, climate, village footprint/count policy, pressure and generation identity. For ADQ, review private route calls, horizontal-distance checks, chunk-ticket lifetime and success/failure cleanup. Rerun native endpoint checks; retain safety predicates. Replace the old neighbor dependency rather than installing both; see [worldgen](worldgen.md). |
| Copycat Bar Extrusion 0.1.0     | Separate `copycat-bar-extrusion` repository; client-only URL JAR             | Create 6.0.10 (`UjX6dr61`), Create Deco 2.1.3 bar artwork and active resource stack                                                                                | Recheck `CopycatBarsModel` delegation, exact Create SHA-512 and required Mixin; run `./gradlew check build`, then six facings, adjacency, reload, supported materials and shader-off/on native checks. Retire only if the selected Create version supplies equivalent bounded depth and native fallback behavior.                                                                 |
| Worldgen configuration          | `overrides/common/config/sky_archipelago*`, `zfastnoise.mixin.properties`    | Sky Archipelago, Zfastnoise and generation/optimization mods                                                                                                       | Preserve CONSISTENT 1494 for ordinary legacy Sky worlds. The expanded preset owns its embedded terrain settings. Recheck biome redirects and generation identity before generating new terrain.                                                                                                                                                                                   |
| Shared data fixes               | `pack-fixes/data/` → `create-skyweave-fixes-0.1.0.jar`                            | Mods owning the replaced recipe, loot, tag or processor resources                                                                                                  | Compare new upstream JSON by exact resource ID. Remove bug overrides only when the installed artifact contains the fix; retain deliberate pack policy. Run native recipe/loot checks.                                                                                                                                                                                             |
| Journal                         | `authoring/journal/` → Questlog config and language assets in the shared JAR | Questlog, item/tag/advancement IDs, recipes and condition handlers                                                                                                 | Follow [journal update checks](journal.md#update-checks): review saved IDs and positions, trigger meaning, setup costs and rewards; generate and validate native behavior, persistence and label fit. Locale edits alone do not change mechanics.                                                                                                                                 |
| Visual model patch              | `authoring/resource-patches.json`, `build-resource-patches.py` → client ZIP  | Fresh Flower Pots, 3D Crops, Better Lanterns, Macaw's Lights and Lamps, Create, Create Deco, DnD, Macaw’s Bridges, Fresh Animations/Details/Objects, EMF and Lootr | Exact versions/hashes and model contracts must pass. Compare pots/chains, bar connections, lantern variants and chest motion in Resource Review.                                                                                                                                                                                                                                  |
| Carry On Animation Fix          | Client-only upstream URL dependency                                          | Carry On, EMF/ETF and Fresh Animations                                                                                                                             | Check pickup, movement, camera views, placement and ordinary animation. Its optional injections can stop applying after an upstream method change; successful loading alone is insufficient. Remove when the selected Carry On version supplies stable entity identity and animation inputs.                                                                                      |
| Ponder sprite registration      | Explicit upstream Ponder dependency                                          | Create's bundled Ponder, Create Deco and other Catnip users                                                                                                        | Retain the thread-safe sprite registry from Ponder 1.0.87. Remove the explicit dependency when Create bundles a verified replacement; check startup and Ponder scenes.                                                                                                                                                                                                            |
| Server terminal wrapper         | `foreground-runtime.py`, `patch-server-archives.py` → Unix launch scripts    | empack 0.8.2-beta and its generated launch templates                                                                                                               | Unknown templates must fail. Remove only after an upgraded empack passes real terminal input, Ctrl-C, direct SIGINT, non-TTY execution and clean shutdown.                                                                                                                                                                                                                        |
| BlueMap viewer adaptation       | Skyweave: Compatibility Patches; server-only settings                                      | BlueMap 5.7 API and exact browser bundle                                                                                                                           | Keep the physical-server/version gates, explicit map opt-in and actual dimension bounds. Rerun native absence, selection/reload and browser budget/teardown checks. Do not clear tiles for viewer-only changes; see [server webmap](build.md#server-webmap).                                                                                                                      |
| Analog Audio radio registration | Skyweave: Compatibility Patches optional runtime hook                                      | Analog Audio 0.1.5-hotfix.1 and Create 6.0.10                                                                                                                      | Recheck erased method signatures and public registry access. Remove the hook when upstream fixes registration; otherwise revalidate its exact-version gates, absence matrix and native registry/callback checks. Client playback and GUI support need separate testing.                                                                                                           |
| Atlas exporter                  | `web/tools/exporter/` and runtime/extraction scripts                         | Minecraft/NeoForge, Create recipe codecs and queried mod APIs                                                                                                      | Align the installed server with the selected pack, compile with Java 21, capture into the isolated audit server and run `pnpm data:check`. Never install the exporter in play instances.                                                                                                                                                                                          |

The shared fixes JAR and visual patch have different load paths. The first supplies
server datapack resources and journal translations; the second overrides client
models at the top of the selected resource stack. Neither replaces DH Polygon Fix
or Skyweave: Compatibility Patches, which now owns the incorporated Veil/Iris framebuffer adapter.
Executable Java remains separate from both resource artifacts. A successful resource build cannot validate Java mixins,
world generation, recipe execution or GPU behavior.

## Routine dependency upgrades

Resolve JEI and its retained parents together, including Aeronautics Covers.
Review the bundled MezzConfig range as well as any standalone selection; a
compatible installed library can remain old unless it is explicitly updated.
The current set uses JEI 19.70.0.469 and MezzConfig 0.6.11. Preserve the reviewed
release-channel choice rather than allowing a new dependency operation to select
an older stable JEI implicitly.

Colorwheel 1.3.2 must be paired with Compat's corresponding version/hash guards
and the BSL recipe's runtime requirement. Keep Colorwheel Patcher 1.0.5 and the
shader inputs pinned unless their own implementations change. Upstream buffer
repairs alone do not establish that Compat's sampler/material hooks can retire.

When updating Reliable Gliders, review newly introduced defaults explicitly.
The pack retains updraft strength 0.7, height 15 and speed 1.0, permits the previous
dimension coverage, and disables automatic deployment in creative mode. Backpack
updates must preserve YiGD's ownership of death recovery. Fresh Animations and
Rails updates also require selection filenames and Atlas archive inspections to
match; existing captures are not evidence for newly changed animation behavior.

NeoForge updates affect Compat builds, native probes, shader-lab and registry
captures. Debug World selects the loader from its captured registry. The Atlas
exporter can use `--libraries` for an isolated matching installation without
changing the playing server. Keep Sky Archipelago 1.3.6 pinned;
the separately planned 1.4 port requires reworking terrain hooks and new worlds,
not a provider-pin substitution.

### File-source exceptions

Prefer exact provider version IDs when their metadata resolves the intended
runtime and sides. A URL containing a provider version ID is still a file source:
empack cannot use it for ordinary provider update assessment. Keep its digest and
review the provider record separately. The 2026-11-05 review matched every
Modrinth-hosted file below by SHA-512 before considering a conversion.

| Content | Why the exact file source remains |
| --- | --- |
| Hostile Skies 0.2.6 | Provider requires Sable 2.0.5's Fabric version; the pack uses NeoForge Sable 2.0.6. |
| Aeronautics/Rechiseled Compatibility 1.2.2 | Provider requires Aeronautics 1.2.1 and Rechiseled's Minecraft 1.21.11 artifact, unlike the verified 1.21.1 stack. |
| Throwable Rope Connector 0.4.3; Vibrant Vaults 0.3.2 | Provider exact requirements select Aeronautics 1.2.1 or Create 6.0.2 rather than the pack's 1.3.2 / 6.0.10. |
| Hoofprint 1.3.0; Surveyor 1.2.4 | Provider requirements include exact Fabric API versions; Hoofprint also forces older Surveyor. Preserve the reviewed NeoForge/Connector selections. |
| McQoy 0.4.1 | Provider forces YACL 3.7.0, while the pack selects 3.8.2. |
| LambDynamicLights 4.8.11 | Shared provider record requires Fabric API; the tested bridge uses Forgified Fabric API and Connector. |
| Rechiseled 1.2.6; Rechiseled Create 1.1.1; SSRD 1.8.8 | Exact provider versions and bytes match, but empack 0.8.2-beta conversion refuses retained dependency participation. Its required closure propagates both-side participation to currently client-only Fusion/Sodium. Both add previews and a combined source-conversion sync preview failed; do not install these renderer libraries on servers merely to enable provider tracking. |
| Absolute Kinematics 1.0.1 | CurseForge file 8511680 resolves, but the provider closure duplicates the Modrinth Create/Aeronautics/Sable selections and collides on destinations. |
| Ponder; Carry On Animation Fix; Copycat Bar Extrusion; DH Polygon Fix; Skyweave: Compatibility Patches | Exact maintained Maven/GitHub artifacts; no matching Modrinth artifact was found. Managed-mod publication remains on GitHub. |

Revisit these exceptions when upstream dependency records or empack's resolution
and side handling change. Preview the complete closure before conversion; compare
artifact hashes, filenames, sides and the removal of the old file selection.
Avoid duplicate provider identities and dependency downgrades. A successful native
run validates the recorded files, not the provider's different dependency closure.

## Coupled update boundaries

Audio and recovery updates couple Analog Audio's bundled AnalogLib, Sable, YiGD,
Accessories and Traveler's Backpack with Skyweave: Compatibility Patches' independent adapters. Inspect
the exact nested playback engine and native inventory integrations. Recheck
loading/standby timing, plot ownership, removal/unload/disassembly, single claims,
compass locations and equipped nested contents. Keep ordinary attenuation and
backpack item protections separate from death-placement policy. The mod's
[adapter reference](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/adapters.md)
owns hook maintenance; [pack compatibility](compatibility.md#audio-and-death-recovery)
owns the selected configuration.

Journal updates cross source, generated config, translations and Atlas evidence.
Recipe, loot, mass, fuel or worldgen changes can invalidate a useful setup or reward
budget even when every item ID still resolves. The journal owns those gameplay
assumptions; the authoring generator owns output and the shared fixes JAR owns
language assets and any pack-authored advancement or loot resources. Regenerate
and install affected outputs together. Refresh relevant Atlas records and captures
when mechanics change; wording changes alone do not require a world survey.

A Sable update affects more than mass tags: inspect its bundled Veil, Aeronautics'
bundled Simulated, Skyweave: Compatibility Patches' pressure adapter, and Escalated/CBC paths.
Recheck Skyweave: Compatibility Patches’ framebuffer, construct material-ID, single-block model-data, and
balloon adapters before changing Sable, Veil, Iris, Sodium, or Aeronautics. Their
startup switches and exact artifact guards have independent removal conditions. A successful weight comparison does not validate rendering.

A Create update requires reviewing Copycat Bar Extrusion's required renderer hook,
Ponder registration, Analog Audio movement registration, the visual model patch
and modded machine counterparts. Static
bar models and Copycat Panel extrusion have different owners and cannot replace
each other's checks. A DH update requires reviewing DH Polygon Fix's exact-version
constraint alongside the Skyweave: Compatibility Patches terrain/preview integration and shader stack.

The independent patch repositories own their builds and detailed procedures:
[DH Polygon Fix](https://github.com/mannie-exe/dh-polygon-fix/blob/main/docs/development.md),
[Skyweave: Compatibility Patches rendering](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/rendering.md),
[Copycat Bar Extrusion](https://github.com/mannie-exe/copycat-bar-extrusion/blob/main/docs/development.md),
and [Skyweave: Compatibility Patches](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/README.md).
Publish changed runtime mods first, verify downloaded release assets, then update
the pack's URL/version/hash and placement bindings together. Never manufacture a
mod release for resource-only policy changes. Retain client-only placement for standalone rendering patches. Skyweave: Compatibility Patches and shared
data belong on both sides; Skyweave: Compatibility Patches selects its rendering hooks only on clients.

Skyweave: Compatibility Patches’ [adapter reference](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/adapters.md)
owns its supported combinations and retirement procedures. Every adaptation can
be disabled before target mixins/classes load, including for unsupported installed
versions. Keep the pack’s explicit feature file aligned with that reference.
Rendering corrections do not change mass tiers, recipes, or resources. The
[compatibility guide](compatibility.md) records native shader, Ponder, balloon and
material checks and their limits. Flickering or gapped airship shadows remain
unresolved.

## Shared data overrides

| Family                                                                                                 | Intent                                                                                                                        | Recheck on update                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create Radars jammer and warning receiver                                                              | Repair output, shaft item and copper-plate tag references                                                                     | Registered outputs and nonempty ingredients; keep the resource JAR ordered after `create_radar` and remove overrides once upstream recipes are valid                                                                                                                                                                                                                                                                                          |
| Create Deco placard; Interiors recoloring; Bells & Whistles metro window; Design n' Decor cogwheel tag | Repair ingredient/tag references                                                                                              | Native item/tag decoding and intended ingredient membership                                                                                                                                                                                                                                                                                                                                                                                   |
| Sable mass tags                                                                                        | Extend existing weight conventions to equivalent modded construction and machine variants; see [building weights](weights.md) | Recheck registered IDs, optional family membership, overlapping property selectors and priority against exact Sable/building-mod artifacts. Remove redundant entries when upstream provides equivalent behavior; do not override newly authored upstream weights. Compare all-state mass/zero-mass controls and assembled fixtures, including double slabs and multipart doors/lights. Rebuild the shared fixes JAR and update audit digests. |
| Aero Cables and TFMG overrides                                                                         | Condition recipes on optional mods                                                                                            | Startup with optional mods absent; retain recipes when their dependencies are present                                                                                                                                                                                                                                                                                                                                                         |
| Propulsion loot and processing                                                                         | Correct singular loot paths and processing-time keys; suppress overlapping platinum crushing                                  | Four block-drop rolls, preserved 150/50-tick work values, and no exact crushing collisions                                                                                                                                                                                                                                                                                                                                                    |
| Almost Unified config                                                                                  | Unify manufactured materials while preserving stone/deepslate ore identity                                                    | Ingredient alternatives, zinc-sheet ownership and crushing yields                                                                                                                                                                                                                                                                                                                                                                             |
| Sky Villages structures, pools and processor                                                           | Height/placement, ordered scarce foundation minerals, crop resources and record-NBT workaround                                | Native processor counts, full villages, biome eligibility, jukebox loading and loot; do not infer full outcomes from per-block probabilities                                                                                                                                                                                                                                                                                                  |
| Vanilla village structure tag                                                                          | Admit Sky Villages as delivery destinations                                                                                   | Registered tag membership and actual delivery offers/routes                                                                                                                                                                                                                                                                                                                                                                                   |

[Upstream findings](upstream.md) distinguish reported defects, local observations
and intentional policy. An upstream issue closing is not proof that a downloaded
release contains its fix. Resource IDs can survive while their schemas or meaning
change, so copying an old override forward is not sufficient review.

## Update sequence

1. Read the relevant row above and the owning guide. Record current exact versions
   and the behavior to preserve. Keep Minecraft pinned unless explicitly approved.
2. Run `empack outdated --strict --json` for provider candidates. URL-pinned content
   needs a separate artifact/metadata check. Do not replace metadata workarounds
   merely because a newer catalog entry exists.
3. Update intent through empack, inspect the resulting lock and synchronize the
   author workspace. When a URL file changes, update its digests and placement
   filename in `empack.bindings.yml` together. Check both runtime metadata and side
   requirements; resource packs and visual patches belong on clients only.
4. Compare affected upstream resources against local overrides. For visual inputs,
   update `authoring/resource-patches.json` only after inspecting the new model
   structure, active overlays and texture variables. The generator intentionally
   stops on unreviewed versions or hashes.
5. Regenerate journal/resources, review categorized config changes and build all
   reference profiles using the [build guide](build.md#local-builds). Confirm one
   intended artifact per dependency, correct sides and no stale renamed files.
6. Test in disposable instances. Recheck the affected native conditions and the
   actual client interaction, not just JSON/ZIP validity. Update the Atlas capture
   after the installed server selections are aligned. Do not start expensive world
   surveys for text-only changes.
7. Update the owning docs and unreleased notes. Sync stopped play instances only
   when authorized, preserving worlds, LODs, access lists and player settings.
   Publishing and world regeneration require their own authorization.

## Visual patch boundaries

The generated ZIP combines four 3D Crops plants and the selected Vervada azaleas
with Fresh pot/soil elements and
adds Better Lanterns' `1` texture binding to Macaw's copper/golden chains. It also
composes the approved selective models and chest geometry. Selected donor helpers,
textures and animation metadata are isolated in private namespaces. Keep it above
its source packs; Crops remains above Fresh Flower Pots
as the fallback when the patch is disabled. Dedicated Sugar Cane and RAY's Rails
retain their own priority over overlapping upstream assets.

`authoring/resource-selections.json` owns the per-feature selection. `apply` selects
explicit block roots and dependency closure; `compose` enables the reviewed single
chest treatment; `keep` and `defer` introduce no overrides. Campfires and azaleas isolate shared donor templates rather than replacing them
globally. Resolve their actual blockstate roots; similarly named leaf blocks are
not substitutes for a shrub model. The comparison baseline
and approved selection are separate from notes saved in the Atlas.

Inputs marked `selection: build-only` in `authoring/resource-patches.json` are exact
source archives, not enabled empack dependencies. SHA-512 remains required. They
are acquired from fixed URLs in fresh CI checkouts; installed inputs still require
matching empack selections. Installed URL inputs must match both the effective
download URL and the lock's SHA-512 content assertion; a provider version label
alone is insufficient. `empack outdated` does not track these source-only
archives. Review their upstream versions separately, inspect active overlays and
geometry/texture closure, then update pins and re-run the relevant visual review.
Do not enable the whole packs to satisfy the builder.

The ZIP includes donor license texts, `CREDITS.txt`, reproducible input URLs/hashes
and the selection source in `SOURCES.json`. 3D Default and Classic 3D declare
GPL-3.0-only; Nautilus declares AGPL-3.0-only. The original assets retain those
licenses. The generator source and pinned source archives describe the adaptations.

The recipe pins input versions and SHA-512 hashes. Output bytes and timestamps are
stable when inputs are unchanged. Both resource builders accept `--check` to verify
existing output without publishing it. Generate before starting empack builds;
concurrent source edits can still invalidate acquisition.

Vanilla resource filters affect every matching lower-priority path, not one named
pack. Source-specific subtraction needs derived input archives or a resource-loader
adapter; neither is implemented. Review upstream terms before publishing derived
third-party models. The generated ZIP includes source attribution and links in
`CREDITS.txt`, maintained in `authoring/resource-patches.json`.

The 2026-10-24 review found explicit add-on terms in Fresh Flower Pots and remix
terms in [Fresh Objects](https://modrinth.com/resourcepack/fresh-animations-objects).
[Macaw’s FAQ](https://modrinth.com/mod/macaws-lights-and-lamps) permits credited
modpack inclusion, but does not explicitly cover adapted model redistribution.
[3D Crops](https://modrinth.com/resourcepack/3d-crops) is listed as all rights
reserved; no explicit adaptation grant was found in the archive or linked project
material. Publication of the full compatibility patch was authorized by the pack
owner with this uncertainty acknowledged; that is not permission from the upstream
authors. Retain original attribution and revisit affected outputs if terms change
or an author objects. Only selected adapted resources are embedded; complete upstream packs remain external.

### Registered texture artwork

`authoring/texture-resources.json` owns inclusion and approval fingerprints.
The client patch builder evaluates the same pure generator as the authoring
preview, checks enabled artwork against its approved hash, and emits its PNGs and
model bindings. Preview caches are not shipping inputs. Unapproved changes stop
publication. `texture-resources.json` inside the ZIP records the owned output hashes;
`SOURCES.json` includes the authored catalogue and exact upstream inputs.

Lootr barrels bind four directional side textures and relit top/bottom artwork
through their native leaf models. Existing loader wrappers, facing rotations,
player-specific material selection and legacy branches remain intact. Open-top
artwork retains its interior and receives the same approved rim shading. Particles
and shared side consumers use the approved front face. Enabled material-mask
recipes add 0.5-pixel corner-clasp depth on four sides. The texture catalogue links
their model outputs to each loot state; the builder combines geometry and artwork
for both closed/open barrel leaves. Disabling extrusion retains the textured
native cube. Eight explicit block-atlas sources admit the generated directional
sprites; PNGs under `textures/generated` are not discovered by the vanilla
`block/` sprite scan. Flattened barrel leaves inherit `minecraft:block/block`
to retain vanilla GUI, hand, ground and item-frame transforms. The item still
uses Lootr's native block-model parent; it does not need a custom renderer.
Barrel open/close behavior is unchanged.

Lootr chest PNGs retain the native 64×64 atlas and state filenames. Exterior UVs
in the Lootr-specific CEMs are fitted to that atlas in closed model coordinates;
internal donor surfaces retain their existing mapping. Fresh geometry, part IDs,
animation expressions and the vanilla chest CEMs are preserved. No fixed material
is assigned to a Lootr rig, so its normal/looted texture selection continues.
Normal and trapped chest atlases share the approved relighting. The trapped
variant retains its ten original red-marker pixels; generation rejects a changed
upstream marker layout. The visual ZIP owns these changes; the shared pack-fixes
JAR has no added resources.

### Bridge-lantern placement review

The approved sloped-bridge appearance uses the pinned Better Lanterns hanging
model and a short link beneath the rail. Flat bridges retain their standing
lantern. The pack enables Skyweave: Compatibility Patches’ `macaw.bridge_lantern_shape` to match the hanging
outline and select its overhang. The same adaptation now matches the standing
flat-bridge model’s one-pixel overhang as well. Native physical collision remains
empty. Resource geometry and the runtime switch must be updated together.
Review media and the repeatable study builder live in the Resource Review harness.

### Model authoring

Use the [model workbench](web/models.md) to edit extrusion and artwork-fitting
recipes, preview their geometry and save the source. `authoring/model-recipes.json`
owns those recipes; the existing pinned-input builder owns the combined ZIP.
Source saves do not generate the pack, and generation does not install it.

Extrusion uses separate texture/UV crops for post, post-end and side geometry.
It preserves holes in the alpha mask, merges front/back regions and emits exposed
perimeter faces. Test native connection rotations, stacking and moving geometry
before selecting an output. Artwork fitting changes selected model UVs and bounds,
without rewriting a shared texture or replacing vanilla parent models globally.

Extrusion also supports horizontal planes, per-plane element rotation and explicit
retained body elements. Child texture keys remain intact for cage materials and
frontlight variants. The vanilla iron overlay input is the SHA-512-pinned official
Minecraft client JAR; review its version alongside the pack's Minecraft pin.

### Window connections and Copycat panels

Window models remain owned by their upstream packs. Keep
`compatibility.window_interior_faces` disabled: removing every `cullface`
exposes matching interfaces and does not establish correct connected textures.
Other model, artwork and potted-plant repairs remain independent.

Skyweave: Compatibility Patches separates two visibility decisions:

- `create.window_culling` and `rechiseled.glass_culling` preserve exposed material
  and orientation boundaries while retaining matching/opaque neighbor occlusion.
- `create.glass_backfaces` and `fusion.glass_backfaces` make those exposed surfaces
  visible from behind, after native connected-texture processing. These adapters
  default on when their optional dependencies qualify.

Create omits CT context for hidden directions. Adding reversed resource geometry
can therefore select missing CT data from the opposite direction, even when the
original boundary remains visible. Skyweave: Compatibility Patches copies final processed quads instead,
retaining UVs and native cull groups. Neither the visual ZIP nor resource-only JAR
adds a second set of backfaces; Fusion modifier dispatch remains native.

The targets are Create connected-glass/window/pane implementations, including
Create Deco and Design n’ Decor subclasses, and Fusion-backed vanilla glass/panes
and Rechiseled glass pillars. Explicit static-model adapters also cover Macaw's
mosaic blocks/panes, caramel bricks and their slab/stair variants, bubble gum,
ornate grate and industrial grating. Each optional family has its own client
switch; scaffolding retains its existing inward-facing geometry.
This is not a general two-sided material setting for fluids, block-entity
renderers, Copycats or DH terrain. Review native face removal, CT/Fusion processing,
vertex format and Sodium batching together when updating these dependencies.
[Native comparisons](web/verification.md#glass-backfaces-2026-11-03) record tested
cases; [Skyweave: Compatibility Patches](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/rendering.md#glass-backfaces)
owns runtime hooks and update/removal conditions.

Create 6.0.10 owns its glass connections through `AllSpriteShifts` and window/pane
CT behaviours. Framed glass uses omnidirectional connections; wood windows use
vertical connections; industrial and weathered iron use rectangular connections.
Weathered iron also selects among four target sprites. Their remaining mullions
are not evidence that connected textures are absent. Create Deco 2.1.3 registers
horizontal window connections. Rechiseled Create 1.1.1 supplies separate Fusion
connecting variants with state predicates.

Midnighttigger's pack supplies Fusion models and texture metadata for vanilla
resources. It does not automatically extend to another namespace. Adding Fusion
to a block that already has Create CT would introduce a second model-processing
path; inspect and test the native system before replacing it. The current selected
packs do not override these window assets. Keep intentional frame patterns and
mixed-material boundaries unless a specific artwork change is selected.

Create's standard Copycat Panel sends bar materials through `CopycatBarsModel`,
which transfers their sprite onto special flat panel geometry. Normal bar model
overrides therefore do not change that panel. The client dependency
[Copycat Bar Extrusion](https://github.com/mannie-exe/copycat-bar-extrusion)
applies Minecraft's native item-mask extrusion
to supported bar materials, preserves the panel envelope and bounds its mesh cache.
Create Deco uses its full bar sheet instead of its narrow particle/post sprite.
Missing sheets, textures above 64×64 and meshes above 2,048 quads retain native
rendering. The patch adds no blocks or saved data.
It does not provide general arbitrary-model support for Copycats+ shapes.

### Authored model composition

Fitting recipes can omit explicit template elements and append selected elements
from another pinned model through `attachments`. Attachment texture keys must be
bound without replacing unrelated bindings. `additional_elements` holds small
explicit cuboids such as the cage's eight 45-degree corner connectors. The generator
validates the complete model after composition; source templates remain unchanged.

The tavern, chain and striped lantern recipes reuse the fitted detailed body.
Eight wall variants retain Macaw's bracket and attachment position. The DnD hood
uses two plates extending two and one pixels, with the outer plate inset one pixel
at each side. Cage connectors overlap the side and top struts; they do not form
continuous bends or remove intersecting geometry. These are authored cuboids and
texture-mask extrusion, not boolean geometry. See the generator's
[extrusion limits](web/models.md#extrusion).
The combined models were inspected in Resource Review with shaders off and with
Complementary Unbound/Euphoria; see [verification](compatibility.md#visual-compatibility-pass).

### Fresh Details animation rigs

Fresh Details 2.4 uses the current Fresh Animations 1.11 shared rigs for
mooshrooms, villagers, traders, guardians, donkeys and mules. The selected archive
has no missing external JPM references in its base CEM models. Its native models
own sleeping poses, juvenile geometry and chest straps; no pack rig replacement
is generated.

Update both input pins together. Review active Minecraft overlays, sleep/wake and
walking poses, juveniles, chest/saddle visibility and representative swimming or
airborne states. Valid filenames alone do not establish every animation state or
rare variant. Do not copy old animation files forward to satisfy removed names;
variables and model hierarchies can differ from current rigs.

### Lootr and Fresh Objects

`lootr_models.py` binds Fresh Objects' normal and trapped chest rigs to the model
names requested by the installed Lootr/EMF renderer:
`assets/minecraft/emf/cem/lootr_lootr_chest.jem` and
`lootr_lootr_trapped_chest.jem`. Confirm those names in EMF's model-creation log
after dependency updates. Files under `assets/lootr/emf/cem/lootr_chest.jem` were
not selected in the native check; a plausible namespace is not a lookup contract.

The adapter changes attachment targets to `bottom` and `lock`, keeps custom rig
IDs intact, and changes animation targets/references from `base.*` to `bottom.*`.
The separate `lootr_chest_animations.jpm` avoids replacing Fresh's vanilla JPM.
The adapter retains Fresh's ordinary/trapped motion and leaves material selection to Lootr.
Do not add a fixed texture override or enable Lootr's `vanilla_textures` setting.
The compatibility switch in `authoring/resource-patches.json` controls inclusion;
renderer and resource archives are pinned alongside the other inputs.

After an input update, verify model selection, body/latch attachments and animation
execution independently. Compare ordinary vanilla and Lootr chests through opening
and closing; ender chests deliberately use stronger motion. Check unopened/opened
materials, trapped chests, independent neighboring chests, contents, resource reload
and shader-on/off rendering. A model loading without an error does not prove motion.
Barrels use another renderer/state model and are outside this adapter.

## Storage and evidence

Keep maintained scripts/tests, exact input recipes, compact native surveys and
selected comparison captures. Remove disposable clients, audit worlds, raw logs,
compiler classes and obsolete exports after their findings enter the owning docs.
The Atlas's active generated data and textures are needed for local browsing;
`web/dist/` is a duplicate build output and can be removed after checks.

Retain reusable visual fixtures and the source of testing harnesses. Cleanup of
build output does not authorize deleting play worlds, LODs, backups, unrelated
instances or dependency caches shared with other projects.

### Transmission & Linkage

Keep the pack on the artifact reviewed by Skyweave: Compatibility Patches' interaction and Jade adapters.
Review settings/removal packet handlers, remapped binding locals, endpoint
protection and native Ponder behavior together before updating. The resource-only
fixes JAR owns English Ponder corrections for all six native tutorials. They
clarify rod distance, Return Force versus Stretch Resistance, regulator drive,
brass versus andesite strain limits and externally driven conversion bearings.
Keep actual setting labels such as Expected Length so players can find them.
Remove individual overrides when the selected upstream supplies equivalent
wording. These are language resources, not Skyweave: Compatibility Patches mixins or replacement scenes.

The 2026-11-01 client check compiled and sought all six scenes and visually played
the rod properties/settings scenes with the pack overrides. Upstream animation,
pointers, overlays and timing remain unchanged; compilation does not establish
playback of every tutorial. The settings tutorial still points toward the lower
head while explaining rod-body interaction. A scene adjustment would be a separate
runtime change; the text identifies the correct target explicitly.

Native actuation, recipes, output limits and mass defaults are retained. Generate
and inspect fresh upstream configs during upgrades rather than treating supplied
pressure/flow labels as implemented fluid plumbing. Keep default link lengths
until upstream rendering and selection support a larger configured range. The
Atlas and three Workshop entries must follow any actual capability change.

### Selective plant and workstation models

`authoring/resource-selections.json` owns the approved object list. Five additional
build-only source pins supply the selected workstation, azalea and pitcher models;
unselected features are excluded. Do not enable their entire archives to reproduce
these choices. Source versions, hashes and credits stay in `resource-patches.json`.

Toasty V3 includes element angles unsupported by Minecraft 1.21.1. The named
`neoforge-root-rotations` adaptation re-expresses each element through the built-in
NeoForge composite loader, retaining its pivot, UVs and rotation. It requires
self-contained models and rejects unknown loaders or rotated cull faces. When
updating Toasty, review this contract against the exact NeoForge model loader,
rebuild the ZIP and object previews, and check whole plants and every crop stage
in Resource Review on valid soil. See the model guide for browser support.
