# Dependency and patch maintenance

Update coupled components together, then verify the behavior the patch protects.
The manifest and lock own exact selections. This guide owns update procedures;
[compatibility](compatibility.md), [structures](structures.md) and
[progression](progression.md) own behavior and measured limits.

## Ownership and coupling

| Component | Source / output | Update together | Required check or removal condition |
| --- | --- | --- | --- |
| DH Polygon Fix 1.0.2 | Separate `dh-polygon-fix` repository; URL pin and placement in empack | DH 3.3.3, SSRD, Iris/Sodium and the native GL query | The patch requires DH 3.3.3. When updating DH, verify the upstream query fix and remove the incompatible patch; test native query/restore and shader pipelines. |
| Create Sky Compat | `create-sky-compat` source project; common referenced JAR | Sky Archipelago 1.3.6; optional Sky Villages 1.0.6 + Architectury 13.x, Sable 2.0.6 and ADQ 1.1.1 | Revalidate terrain, geology, climate, village footprint/count policy, pressure and generation identity. For ADQ, review private route calls, horizontal-distance checks, chunk-ticket lifetime and success/failure cleanup. Rerun native endpoint checks; retain safety predicates. Replace the old neighbor dependency rather than installing both; see [worldgen](worldgen.md). |
| Copycat Bar Extrusion 0.1.0 | Separate `copycat-bar-extrusion` repository; client-only URL JAR | Create 6.0.10 (`UjX6dr61`), Create Deco 2.1.3 bar artwork and active resource stack | Recheck `CopycatBarsModel` delegation, exact Create SHA-512 and required Mixin; run `./gradlew check build`, then six facings, adjacency, reload, supported materials and shader-off/on native checks. Retire only if the selected Create version supplies equivalent bounded depth and native fallback behavior. |
| Worldgen configuration | `overrides/common/config/sky_archipelago*`, `zfastnoise.mixin.properties` | Sky Archipelago, Zfastnoise and generation/optimization mods | Preserve CONSISTENT 1494 for ordinary legacy Sky worlds. The expanded preset owns its embedded terrain settings. Recheck biome redirects and generation identity before generating new terrain. |
| Shared data fixes | `pack-fixes/data/` → `create-sky-fixes-0.1.0.jar` | Mods owning the replaced recipe, loot, tag or processor resources | Compare new upstream JSON by exact resource ID. Remove bug overrides only when the installed artifact contains the fix; retain deliberate pack policy. Run native recipe/loot checks. |
| Journal | `authoring/journal/` → Questlog config and language assets in the shared JAR | Questlog, item/tag/advancement IDs, recipes and condition handlers | Follow [journal update checks](journal.md#update-checks): review saved IDs and positions, trigger meaning, setup costs and rewards; generate and validate native behavior, persistence and label fit. Locale edits alone do not change mechanics. |
| Visual model patch | `authoring/resource-patches.json`, `build-resource-patches.py` → client ZIP | Fresh Flower Pots, 3D Crops, Better Lanterns, Macaw's Lights and Lamps, Create, Create Deco, DnD, Macaw’s Bridges, Fresh Animations/Details/Objects, EMF and Lootr | Exact versions/hashes and model contracts must pass. Compare pots/chains, bar connections, lantern variants and chest motion in Resource Review. |
| Carry On Animation Fix | Client-only upstream URL dependency | Carry On, EMF/ETF and Fresh Animations | Check pickup, movement, camera views, placement and ordinary animation. Its optional injections can stop applying after an upstream method change; successful loading alone is insufficient. Remove when the selected Carry On version supplies stable entity identity and animation inputs. |
| Ponder sprite registration | Explicit upstream Ponder dependency | Create's bundled Ponder, Create Deco and other Catnip users | Retain the thread-safe sprite registry from Ponder 1.0.87. Remove the explicit dependency when Create bundles a verified replacement; check startup and Ponder scenes. |
| Server terminal wrapper | `foreground-runtime.py`, `patch-server-archives.py` → Unix launch scripts | empack 0.8.2-beta and its generated launch templates | Unknown templates must fail. Remove only after an upgraded empack passes real terminal input, Ctrl-C, direct SIGINT, non-TTY execution and clean shutdown. |
| BlueMap viewer adaptation | Create Sky Compat; server-only settings | BlueMap 5.7 API and exact browser bundle | Keep the physical-server/version gates, explicit map opt-in and actual dimension bounds. Rerun native absence, selection/reload and browser budget/teardown checks. Do not clear tiles for viewer-only changes; see [server webmap](build.md#server-webmap). |
| Analog Audio radio registration | Create Sky Compat optional runtime hook | Analog Audio 0.1.5-hotfix.1 and Create 6.0.10 | Recheck erased method signatures and public registry access. Remove the hook when upstream fixes registration; otherwise revalidate its exact-version gates, absence matrix and native registry/callback checks. Client playback and GUI support need separate testing. |
| Atlas exporter | `web/tools/exporter/` and runtime/extraction scripts | Minecraft/NeoForge, Create recipe codecs and queried mod APIs | Align the installed server with the selected pack, compile with Java 21, capture into the isolated audit server and run `pnpm data:check`. Never install the exporter in play instances. |

The shared fixes JAR and visual patch have different load paths. The first supplies
server datapack resources and journal translations; the second overrides client
models at the top of the selected resource stack. Neither replaces DH Polygon Fix
or Create Sky Compat, which now owns the incorporated Veil/Iris framebuffer adapter.
Executable Java remains separate from both resource artifacts. A successful resource build cannot validate Java mixins,
world generation, recipe execution or GPU behavior.

## Coupled update boundaries

Journal updates cross source, generated config, translations and Atlas evidence.
Recipe, loot, mass, fuel or worldgen changes can invalidate a useful setup or reward
budget even when every item ID still resolves. The journal owns those gameplay
assumptions; the authoring generator owns output and the shared fixes JAR owns
language assets and any pack-authored advancement or loot resources. Regenerate
and install affected outputs together. Refresh relevant Atlas records and captures
when mechanics change; wording changes alone do not require a world survey.

A Sable update affects more than mass tags: inspect its bundled Veil, Aeronautics'
bundled Simulated, Create Sky Compat's pressure adapter, and Escalated/CBC paths.
Recheck Compat’s framebuffer, construct material-ID, single-block model-data, and
balloon adapters before changing Sable, Veil, Iris, Sodium, or Aeronautics. Their
startup switches and exact artifact guards have independent removal conditions. A successful weight comparison does not validate rendering.

A Create update requires reviewing Copycat Bar Extrusion's required renderer hook,
Ponder registration, Analog Audio movement registration, the visual model patch
and modded machine counterparts. Static
bar models and Copycat Panel extrusion have different owners and cannot replace
each other's checks. A DH update requires reviewing DH Polygon Fix's exact-version
constraint alongside the Compat terrain/preview integration and shader stack.

The independent patch repositories own their builds and detailed procedures:
[DH Polygon Fix](https://github.com/mannie-exe/dh-polygon-fix/blob/main/docs/development.md),
[Compat rendering](https://github.com/mannie-exe/create-sky-compat/blob/main/docs/development/rendering.md),
[Copycat Bar Extrusion](https://github.com/mannie-exe/copycat-bar-extrusion/blob/main/docs/development.md),
and [Create Sky Compat](https://github.com/mannie-exe/create-sky-compat/blob/main/docs/development/README.md).
Publish changed runtime mods first, verify downloaded release assets, then update
the pack's URL/version/hash and placement bindings together. Never manufacture a
mod release for resource-only policy changes. Retain client-only placement for standalone rendering patches. Compat and shared
data belong on both sides; Compat selects its rendering hooks only on clients.


Compat’s [adapter reference](https://github.com/mannie-exe/create-sky-compat/blob/main/docs/development/adapters.md)
owns its supported combinations and retirement procedures. Every adaptation can
be disabled before target mixins/classes load, including for unsupported installed
versions. Keep the pack’s explicit feature file aligned with that reference.
Rendering corrections do not change mass tiers, recipes, or resources. The
[compatibility guide](compatibility.md) records native shader, Ponder, balloon and
material checks and their limits. Flickering or gapped airship shadows remain
unresolved.

## Shared data overrides

| Family | Intent | Recheck on update |
| --- | --- | --- |
| Create Radars jammer and warning receiver | Repair output, shaft item and copper-plate tag references | Registered outputs and nonempty ingredients; keep the resource JAR ordered after `create_radar` and remove overrides once upstream recipes are valid |
| Create Deco placard; Interiors recoloring; Bells & Whistles metro window; Design n' Decor cogwheel tag | Repair ingredient/tag references | Native item/tag decoding and intended ingredient membership |
| Sable mass tags | Extend existing weight conventions to equivalent modded construction and machine variants; see [building weights](weights.md) | Recheck registered IDs, optional family membership, overlapping property selectors and priority against exact Sable/building-mod artifacts. Remove redundant entries when upstream provides equivalent behavior; do not override newly authored upstream weights. Compare all-state mass/zero-mass controls and assembled fixtures, including double slabs and multipart doors/lights. Rebuild the shared fixes JAR and update audit digests. |
| Aero Cables and TFMG overrides | Condition recipes on optional mods | Startup with optional mods absent; retain recipes when their dependencies are present |
| Propulsion loot and processing | Correct singular loot paths and processing-time keys; suppress overlapping platinum crushing | Four block-drop rolls, preserved 150/50-tick work values, and no exact crushing collisions |
| Almost Unified config | Unify manufactured materials while preserving stone/deepslate ore identity | Ingredient alternatives, zinc-sheet ownership and crushing yields |
| Sky Villages structures, pools and processor | Height/placement, ordered scarce foundation minerals, crop resources and record-NBT workaround | Native processor counts, full villages, biome eligibility, jukebox loading and loot; do not infer full outcomes from per-block probabilities |
| Vanilla village structure tag | Admit Sky Villages as delivery destinations | Registered tag membership and actual delivery offers/routes |

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

The generated ZIP combines four 3D Crops plants with Fresh pot/soil elements and
adds Better Lanterns' `1` texture binding to Macaw's copper/golden chains. It copies
no textures. Keep it above all four inputs; Crops remains above Fresh Flower Pots
as the fallback when the patch is disabled. Dedicated Sugar Cane and RAY's Rails
retain their own priority over overlapping upstream assets.

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
or an author objects. No textures or complete upstream packs are embedded.

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
at each side. Cage connectors bridge the transition between side struts and top
struts. These are authored cuboids and texture-mask extrusion, not boolean geometry.
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

Keep the pack on the artifact reviewed by Compat's interaction and Jade adapters.
Review settings/removal packet handlers, remapped binding locals, endpoint
protection and native Ponder behavior together before updating. The resource-only
fixes JAR corrects the English rod-settings tutorial target; remove that key when
the selected upstream release supplies correct wording. It contains no machinery
runtime code.

Native actuation, recipes, output limits and mass defaults are retained. Generate
and inspect fresh upstream configs during upgrades rather than treating supplied
pressure/flow labels as implemented fluid plumbing. Keep default link lengths
until upstream rendering and selection support a larger configured range. The
Atlas and three Workshop entries must follow any actual capability change.
