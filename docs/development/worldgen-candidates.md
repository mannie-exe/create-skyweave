# Terrain and structure content

This document owns content choices, village composition and qualification limits. Exact versions live in `empack.yml` and `empack.lock`; `authoring/villages.json` owns settlement inputs and weights. [World generation](worldgen.md) owns the terrain preset, [structures](structures.md) owns shared placement policy, and [patch maintenance](patches.md) owns patch updates.

## Direction and selections

Keep a largely vanilla material and gameplay vocabulary while improving exploration, useful settlements and the relationship between geography and travel. Preserve the approved sparse clusters, substantial island bodies, granular edges, climate, geology and ocean/Deep Dark policy. Installing village templates does not implement the separate Skyweave project's NPC economy, live expansion or transport services. Pregeneration must not simulate economic history.

| Content | Decision and purpose |
| --- | --- |
| YUNG's Better Desert Temples, Better Jungle Temples | Selected discoveries with native buried rooms, entrances, puzzles and loot. |
| YUNG's Better Mineshafts | Selected underground variety, with island-relative fitting and bounded supports. |
| YUNG's Better Ocean Monuments | Selected for suitable habitats and ordinary worlds; do not manufacture an island foundation to force placement. |
| YUNG's Better Witch Huts | Selected swamp encounters; preserve witch/cat spawn behavior and supported legs. |
| YUNG's Better Strongholds / Better Nether Fortresses | Rejected: retain the iconic originals preferred by the owner. |
| Other YUNG's / Refresh Studios content | Deferred; installing the API does not approve additional content. |
| Lithostitched | Structure assembly and data modifiers, with a qualified optional island bridge. It does not replace the terrain or hydrology authority. |
| CTOV | Village theme/size organization and native Lithostitched assembly. |
| Better Villages | Selected replacement templates, roads and buildings; no separate vanilla settlement fallback. |
| Towns and Towers | Selected donor pieces and coherent regional layouts; ocean ships excluded. |
| Geophilic | Restrained decoration of existing vanilla biome identities. |
| Sky Villages | Retained as a distinct floating settlement provider; ordinary and floating settlements may be neighbors. |
| Terralith | Rejected: outside the desired vanilla scope. |
| Tectonic | Deferred terrain-provider investigation; not installed. |
| Natural log/root outlet barriers | Deferred until a separate habitat/detail pass; no dam or beaver simulation. |

YUNG's API, Cristel Lib and Library Ferret are required by the selected content. Lithostitched includes Apollib. Keep libraries separate from content choices and retain exact version/side qualification.

## Village composition

A **template** stores blocks, entities and connectors for a piece. A **pool** is a weighted menu of pieces. A **structure** defines an encounter's starting pool, biome eligibility, reach and height rules; a **structure set** schedules opportunities and chooses among structures. **Processors** modify native placement. Sets distribute settlements; pools assemble them. Adding a template neither schedules a village nor makes its connectors compatible.

`authoring/villages.json` pins source archives, selected donor references, size/style weights and shared role limits. `scripts/generate-villages.py` checks the exact archives and generates schedules, managed-family tags, Lithostitched modifiers and audit records. The Resource Patches builder invokes it; `--check` detects drift. Keep source NBT in its provider's artifact: Better Villages declares all-rights-reserved and the inspected CTOV/T&T artifacts declare BY-NC-ND. Do not infer redistribution permission from viewable source or copy templates into the pack.

The available source lineup has CTOV's 21 surface themes at three depths and 25 T&T regional profiles. The active ground-village schedule selects the seven owned profiles listed below through `enabledProfiles`. Underground CTOV villages and T&T ocean ships are excluded. No untouched vanilla settlement entry remains. Better Villages intentionally replaces `minecraft:` templates, so deleting that namespace would also remove its contribution. The shared outpost schedule retains CTOV, T&T and the iconic vanilla outpost; separate floating Sky Villages retain their own schedule.

CTOV's four automatic injection switches are off. T&T town/tower toggles deliberately stay true: Cristel Lib otherwise reconstructs source sets from its JAR and overrides authored replacements. Exclude ships in unified data; only independent ocean wreckage is disabled through its toggle. The original T&T tower set is empty; its town set retains the inactive Wythers-specific Piglin profile. Preserve registered identities needed by saved references.

Selected residences, workshops, farms, roads and centers enter matching CTOV pools through Lithostitched delegating elements. Theme/role limits span providers: two providers do not each get an independent allowance. Defaults allow two donor residences, one workshop, one farm, two roads and one center. Native processors, projection, entities and loot remain attached. Direct aliases route donor vanilla street/house/decor/terminator references into the CTOV theme. Specialized T&T profiles retain their own road topology.

Small/medium/large weights are 10/4/1, with assembly depths 4/5/6. These describe assembly opportunity, not exact building counts, encounter probabilities or guaranteed loot tiers. Regional weight and donor limits are authored tuning. Do not concatenate donor loot tables: CTOV's smith chooses one of four vanilla profession tables, whereas T&T badlands homes retain their clay, terracotta, cactus and small gold outcomes. Keep occupational supplies, infrastructure, crops, animals, salvage and loot in the same reward assessment. Larger footprint alone does not justify a treasure tier.

### Authored profiles

The optional `profiles` array in `authoring/villages.json` creates pack-owned structure definitions under `skyweave_compat:villages/`. Each profile replaces one existing scheduled CTOV or T&T choice while retaining its weight. Owned definitions explicitly select `lithostitched:jigsaw` and declare Lithostitched among their load conditions. They inherit the source's biome eligibility, terrain adaptation, decoration step, and other settings, including its starting pool unless `startPool` selects another. Provider definitions retain their original types. Pool elements retain their native processors; existing CTOV donor aliases also apply to the replacement. Source definitions remain registered and tagged for saved starts and explicit lookup. This does not create another structure set or increase the ground-family encounter allowance.

Top-level `enabledProfiles` is an explicit nonempty list of schedule choices after those replacements. Only those IDs enter the new-generation ground-village schedule; their inherited weights remain intact. Unknown or duplicate IDs are refused. Omitting the field restores the complete composed lineup. Selection does not remove definitions, templates, pools, contracts or family/discovery membership used by saved starts and explicit lookups, and does not change outposts or floating Sky Villages. A biome with no eligible selected profile receives no ground-village fallback.

| Field | Meaning |
| --- | --- |
| `id` | Unique pack-owned structure ID under `skyweave_compat:villages/`. |
| `replaces` | One existing CTOV or T&T schedule entry; two profiles cannot replace the same choice. |
| `depth` | Integer assembly depth from 1 to 20. It is not a building count. |
| `reach` | Integer horizontal reach from 1 to 116, retaining the native 12-block terrain-adaptation margin within 128. |
| `startPool` | Optional registered native starting pool from the selected providers; otherwise inherit the original root. |
| `pools` | Map from local names to a native pool ID or an object with `source`, `donors`, `replace` and/or `fallback`. A new menu can omit `source` and select explicit donors. The selected native root must be included. Native elements, prior additions and retained source repairs enter isolated menus; provider templates remain upstream. |
| `biomes` | Optional nonempty list of distinct native Overworld biome IDs. The generator resolves the pinned native Overworld tag and emits the profile's own eligibility tag. |
| `requiredRoles` | Named requirements with `minimum` and catalog `pieces`. These emit an exact native-element contract and the composed-village tag; they are independent of donor maxima. |

Unknown fields, duplicate identities, missing native resources, and definitions with no growth, root, owned-menu or eligibility choice are refused. Inherited alias modifiers are scoped independently to each replacement and retain its dependency conditions. Selecting another provider's root adds that provider's condition; it does not automatically translate a different connector grammar. New IDs enter the managed ground-village tag, and the standard village discovery tag includes that family alongside optional Sky Villages. Complete source footprints, parent offsets, native references, fitting, and realized contents still require qualification; a legal reach alone does not establish that every inflated bound can be discovered within the native eight-chunk reference horizon.

Owned menus live under `skyweave_compat:villages/<profile>/<local-name>`. Profile aliases redirect original jigsaw requests into them; fallback-holder references are rewritten explicitly when their pool is also owned. Each owned menu's `name` matches its registered resource ID. Fallback-holder references and existing self-fallbacks, such as T&T's Pueblo profession menu, are preserved; Lithostitched owns traversal and cycle handling. Missing fallback resources and ambiguous source mappings are refused. New explicit menus add no alias for an unrelated source or `minecraft:empty`. Source pools and aliases remain unchanged for other definitions. `replace: true` deliberately replaces a cloned menu's choices with its nonempty explicit donors; it does not modify that provider's menu.

A native catalog selection declares `source`, `pool` and `template`. The unambiguous native element supplies processors/projection; its provider must contain the referenced template. An original selection instead declares `source: "authored"`, `template`, `processors` and `projection`. Profile donors can use `{piece, role, weight, limit}` to reference this shared catalog, or declare a selection inline with those counter fields. The role names one shared profile counter across owned pools, with a consistent limit. Existing source restrictions remain intact. A maximum contribution count does not require that donor to appear or establish a settlement's usable capacity.

The top-level `templates` object owns original explicit cells: bounded dimensions, ordered inclusive `fills`, individual `blocks` and jigsaw positions/front-top/name/target/pool/final state/priority. Blocks use native state strings. The generator emits deterministic NBT under `structure/villages/`, with no provider imports, inventories or entity payloads. Cells and connector metadata are reviewable in the recipe. Native loading, rotations, attachment volumes, support and physical output still need qualification; matching connector names alone do not prove a building fits. The Mill windmill uses a dedicated outward court port because the Tudor streets' internal plot volumes cannot admit its complete footprint.

The pinned Lithostitched 1.8.1 redirects vanilla Jigsaw assembly into its generator, but retains a vanilla seed-parity flag on that path. Explicit `lithostitched:jigsaw` definitions use its native selection/fallback path instead. Normalizing the owned types is therefore not a promise of identical new layouts for the same seed. Keep inherited decoration steps, liquid policy, reach, expansion behavior, donor element types and processors unchanged unless separately selected; `minecraft:legacy_single_pool_element` and Jigsaw connector identifiers are not structure-type metadata to rename.

### Settlement identities

| Profile | Regional grammar and numeric growth | Defining original content and retained landmark | Eligible native biomes |
| --- | --- | --- | --- |
| Timber and Rigging Landing | CTOV fortified taiga; depth 7 / reach 96 | Dry loading apron, timber store, working shed and stationary rigging frame; retained CTOV civic center | Taiga and both old-growth taiga variants |
| Mill and Market Common | T&T Tudor; depth 5 / reach 116 | Market stalls, common and crop beds; separately connected sunflower windmill | Plains, sunflower plains, meadow |
| Birch Bellspire Court | T&T Romanian-inspired birch; depth 7 / reach 116 | Low reading/cartography frontage and garden court; retained tall native bellspire/library center | Birch and old-growth birch forest |
| White Terrace Exchange | T&T Mediterranean; depth 4 / reach 116 | Warehouse frontage, exchange shelter and dry cargo promenade; retained native civic/avenue/promenade grammar | Beach, stony shore, savanna, savanna plateau |
| Red Clay Works | T&T Pueblo; depth 5 / reach 116 | Furnace/stonecutting court, shaded workshop and materials yard; retained native inhabited center | Badlands, wooded badlands, eroded badlands |
| Flower Gate Dye Court | T&T Japanese-inspired flower forest, depth 7 / reach 116 | Loom, dye court, flower beds and an empty Create depot alongside the retained stepped meeting point, gates and lamps | Flower forest |
| Snowline Relay Lodge | T&T Viking-inspired snowy taiga, depth 7 / reach 116 | Warming shelter, empty Create depot and a three-block arrival stair into the retained meeting point | Snowy taiga |

An added court consumes one native expansion level before its regional center. Six profiles compensate with one extra depth, and Timber also gains 16 blocks of reach. Mill replaces its root directly. Depth and reach control assembly opportunities. Each assembled layout needs its own area measurement. New courts contain stationary utilities and empty storage. Rigging frames, windmills and dry loading aprons are authored infrastructure.

Each profile requires its original court, regional landmark and at least two distinct canonical residential pieces. One multifunction court may provide several uses; one physical piece cannot count as two homes. These canonical home choices have native authored home-POI intent; retained metadata does not certify every processed bed or an inhabited simulation. Native defender/population requests remain with the regional center; Mill retains the source root's counts in its new center. No guard/golem policy or family encounter allowance changes.

The selection retains Timber's source weight of 1 and the six T&T profiles' weights of 8. Their biome sets are disjoint, so each covered biome has one eligible selected profile. The original Tudor and Mediterranean exclusive biome bindings resolve empty with the selected biome providers. Their owned habitat tags make those choices available. Fit, retained-content refusals, fallback and the shared family allowance still constrain actual delivery. Recompute the loaded eligible mix when changing biome providers, selection or profile bindings.

Release these profiles with a published Skyweave: Compatibility Patches artifact that supports generation revision 18 and composed-village required-content checks. Verify the exact Compat pin and generated Resource Patches in the release exports. Existing revision-17 worlds require their matching release; the current generation guard keeps incompatible policies from being opened on those saves.

The optional Compat village-support adaptation loads bounded immutable contracts from `village_composition/villages/`. Exact template, Single/Legacy type, named processor holder and projection must match. The same original-assembly contract follows fitting, support trimming and final commitment. Missing required content, unavailable elements, exhausted work and missing contracts have separate rejection outcomes. A composed definition tagged as such cannot silently pass without its contract. Unchanged reloads remain valid; changed contracts require a restart and must still match the saved world's generation identity. Changing minimum roles or exact alternatives cannot silently alter an existing adapted world. Ordinary worlds retain native placement without island fitting.

Use `python3 scripts/generate-villages.py --fixture-archive /path/to/villages.zip` to export generated village JSON, original NBT and shared repairs for an isolated native test. `--fixture-recipe /path/to/experiment.json` selects an experimental recipe only for that export; it cannot replace the pack's authored inputs. The fixture records source archive pins, the exact recipe hash, and per-resource hashes. It contains no provider NBT or client assets. The [native comparison fixture](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/testing.md#native-village-composition) verifies the three installed donor archives against those pins before assembly.

Generated definitions live in `resource-patches/data/skyweave_compat/worldgen/structure/villages/`; the generator owns that directory. Preserve published machine identities and review saved-start and processor references before removing or retiring a profile. Village fixture provenance identifies the tested data; it does not replace the terrain save's existing generation identity or retrofit structures into generated chunks.

Snowline's rigid authored court carries a three-block rise on its connecting lane. This lifts the retained meeting point relative to the court's foundation datum, where its legacy piece preserves unplaced air cells. The stair and landing use original template blocks. The meeting point keeps its native processors, roads and population markers.

### Biome coverage

For the pinned Minecraft 1.21.1 registry and village providers, biome eligibility is:

| Lineup | Structure definitions | Distinct eligible Overworld biomes |
| --- | --- | --- |
| Vanilla | 5 village styles | 6: plains, meadow, desert, savanna, snowy plains and taiga |
| CTOV surface lineup | 63 size variants across 21 themes | 23 |
| T&T surface lineup | 25 regional definitions, 17 with nonempty biome eligibility | 20 |
| Combined CTOV/T&T source lineup | 88 definitions | 33 |
| Unrestricted composed lineup, including the seven owned replacements | 88 definitions | 34 |
| Selected owned profiles | 7 definitions | 17, listed above |

The selected profiles retain 16 of the combined source lineup's biome choices and add stony-shore eligibility. Flower forest and snowy taiga qualify only their dedicated profiles. Desert, ordinary and dark forests, cherry grove, jungle variants, swamps, mushroom fields and the remaining snowy and mountain biomes have no selected ground profile. Of the vanilla lineup, plains, meadow, savanna and taiga remain covered. Better Villages contributes pieces within existing biome choices.

These counts describe eligible biome IDs, not terrain area, natural village frequency or successful island fitting. Beaches and stony shores use dedicated shore projections rather than independent island-host selection; an eligible shore ID does not guarantee a suitable coastal site. Existing settlements are not removed by a schedule change. Recheck the resolved native biome holders when changing providers; source tags mentioning absent biome mods do not establish available habitats.

### Connectors and resource repairs

Native attachment requires opposing front directions and matching top directions unless the parent joint is rollable; the parent target must match the child name. Lithostitched then applies fallback, priority, depth, reach and clearance. CTOV's empty connector names can be intentional. A post-placement block processor cannot repair connector metadata already consumed during assembly.

The source audit found 42 exact duplicate groups within providers and no exact cross-provider matches. Another 108 geometry-similar groups differ in connectors, entity/block NBT or loot; do not collapse them by appearance. This comparison preserves orientation and does not prove rotation-equivalence. Raw counts of 246 Better Villages, 2,161 CTOV and 840 T&T templates include inactive/nested addons and are not encounter frequencies.

Resource Patches supplies four missing T&T villager pools, conditional on `t_and_t`, using existing regional adult templates. Swiss population retains the native 1/1/10 nitwit/baby/unemployed weighting. Lighthouse, bishop and chief branches receive ordinary adults, not new professions or trades. The special-NPC source templates are empty placeholders; the lighthouse also references its missing pool. Native placement verifies one villager from each repair with the intended regional types.

Seven obsolete CTOV/Wares warehouse loot tables use removed `minecraft:set_nbt` functions. Scoped NeoForge false-condition resources suppress those tables. Twenty malformed CTOV computer-lab templates contain out-of-palette state indices; their Advanced Peripherals injection resources are false-conditioned. Preserve the valid desert injection and unrelated jobs. Advanced Peripherals is absent from the runtime checks: the winning exclusions are verified, not full addon compatibility. CTOV's optional Create jobs require their declared addons, not Create alone.

## Runtime integration and configuration

Compat admits supported foreign IDs through explicit managed-family tags, not substring classification. Lithostitched's alternate jigsaw and YUNG's jigsaw extend `Structure` directly, so vanilla-jigsaw casts are invalid. The optional bridges retain native assembly and adapt only island ownership, fitting, projection and qualified piece metadata. Ordinary pack worlds intentionally share the authored village data; island height/support hooks remain scoped to marked worlds.

| Owner | Maintained behavior |
| --- | --- |
| `bettervillage_1.properties` | `boolean.villages.enabled_custom_config=false`; retain template replacements without a competing placement grid. |
| `ctov-common.toml` | Automatic source schedule injections off; authored data owns weights and opportunities. |
| `towns_and_towers/structure_enable_or_disable_new.json5` | Keep town/tower toggles inert; exclude source ships through authored sets and disable independent ocean wreckage. |
| Five `better*-neoforge-1_21.toml` files | Native content settings and vanilla-replacement flags remain authoritative. Compat snapshots those registered flags for island attempts and prospective locate checks. |
| `lithostitched.json` | Keep native seed-parity/diagnostic defaults; review shared jigsaw and shipwreck behavior when updating. |
| Geophilic | Versioned datapack resources and Datapack Toolkit controls; no invented NeoForge TOML owner. |

Do not ship Cristel Lib's entire automatically generated per-mod configuration tree. Own only deliberate settings and their audit records. Keep Compat-owned files under `config/skyweave/`; foreign files stay with their registered owners.

### YUNG boundaries

The shared island schedule bypasses YUNG's original spread hooks. Compat therefore carries registered vanilla-suppression flags into actual attempts and prospective lookup. Its qualified temple rules also preserve the native 48-block river/ocean exclusion at projected island surfaces and translate native exclusion sets into shared family separation. Desert temples retain six-chunk village avoidance; jungle temples retain their enhanced exclusions. Unknown exclusion targets require update review rather than silent omission.

Desert and jungle rooms use supported buried fitting and native postprocessing. Mineshaft fitting uses actual room pieces; its vertical entrance center is an absolute coordinate, while big-tunnel metadata is local. Move only the absolute metadata with the layout. Native support loops and hut leg/fence processors stop at the owning island's underside instead of constructing hundreds of blocks into void. Foreign generators and native short bounded support helpers retain their behavior.

Native Water V2 already routes YUNG monuments to local ocean elevation. The start template reserves 115×64×126 blocks with its anchor at local Y43; a vanilla eight-block anchor assumption is incorrect. A bounded deep-ocean Lagoon sample rejected all starts for rough floors, insufficient support or incomplete submersion. This establishes habitat rejection, not a verified island monument. Retain ordinary-world eligibility and existing fit gates.

Huts and witch circles retain their upstream structure definitions and biome eligibility, but share one island-family encounter allowance. Their source weights select eligible alternatives; separate upstream sets do not grant a second island encounter budget.

### Geophilic boundaries

Geophilic 3.7 changes features in 29 active vanilla-biome overlays and grass/foliage tint in 11. It leaves temperature, downfall, precipitation, spawn lists and carvers unchanged. Keep Sky Archipelago/Compat climate, cave and ocean projection authoritative; do not create a second biome map or remap intentional tint differences.

Its resolved placed features have 100 heightmap placements and no height-range placements. Use actual accepted surfaces rather than an ore-style reference-Y remap. Desert lava lakes use `WORLD_SURFACE_WG`; stony-shore pillars use `OCEAN_FLOOR`; shore puddles use `MOTION_BLOCKING_NO_LEAVES`. These local features are not extra Dynamic Waters routes.

Native checks cover BASELINE, NOISE, HOLLOW and additive fragments in forest, desert, snowy taiga and stony shore. Resolved feature lists include Geophilic, plants satisfy sampled survival checks, and direct configured-feature controls include positive supported sites and rejected void/unsuitable sites. Desert and shore controls include Dynamic Waters/C2ME. No Geophilic-specific runtime repair was justified. Direct controls bypass rarity and do not measure natural frequency.

Compat's `tools/probe.py --ecology --fixed-biome minecraft:forest --seed 2026` exercises the existing harness. Stony shore additionally needs `--natural-shore-fixture`, because shipping ordinary shore hosts are disabled. A forced all-shore source without that fixture repeatedly invokes upstream land-host search. Do not enable shipping shore hosts merely to run a test.

## Oceans and water

Lagoon treatments retain normal 270–370 anchor radii, the shared seeded outline and their native floor. COASTAL uses a broad seeded open cove with supported shoulders; PERIMETER permits falling edges. Cached shoreline metadata keeps additive fragments outside native gaps and the cove mouth. Exact controls and defaults live in the owning ocean config, not duplicated here.

Dynamic Waters excludes native wet archetypes and fragment fringes from its generated channel ownership. Rejected cuts are inert, inclusive roof thickness is respected, and supported shallow beds retain coherent lakes. Rivers terminate at physical void sinks instead of resuming on detached remnants. Ordinary falling fluid may still touch lower terrain; that is distinct from generating a new channel there. Natural dams remain deferred.

## Verification and update procedure

Qualification uses exact locked artifacts on Minecraft 1.21.1 and isolated worlds. Native plains profiles retain starts, piece/processor data, containers and save/reopen results with Dynamic Waters/C2ME. Local checks find 76 supported doors and 53 supported beds across two profiles; this is placement evidence, not villager pathfinding. Desert profiles provide additional native composition samples. Finite samples and retained role limits do not establish survival balance, every connector transition or world-wide structure frequencies.

On an update:

1. Audit resolved sets, conditions and source injections before modifying pools. Keep one placement authority and verify no source schedule reappears.
2. Regenerate against verified archives. Review changed types, start pools, aliases, connectors, ground datum, projection, processors, template availability and loot. Reject composite donors rather than stripping companion pieces.
3. Recheck qualified Compat descriptors, registered replacement flags, exclusion codecs, absolute piece metadata, support bounds, optional absence/disable and ordinary-world controls.
4. Run the Resource Patches drift check, config audit and targeted tests, then native starts, complete layouts, loot/containers and reopening. Include water-enabled habitats and bounded query work. A successful startup or `/locate` is insufficient.
5. Refresh Atlas/progression data where obtainable content changes. Keep journal rewards and current gameplay claims tied to actual content; do not infer complete survival balance from a resource graph.

Preserve useful evidence with exact seed/config/artifact identity; remove disposable worlds, downloads and duplicate reports. Maintain development instructions in their owners rather than accumulating migration diaries.

## Deferred terrain direction

The [prison dimension](prison.md) is accepted planned content with its own generation and island-linked exit model. It is separate from Overworld terrain composition and the immediate Nether access policy; no external horror mod or prison generator is installed by this decision.

Tectonic's vanilla density-router replacements do not automatically affect Sky Archipelago's descriptor/density exterior. A future bounded experiment could sample selected Tectonic ridge/height signals within the accepted island envelope, preserving thickness, climate and the shared final field used by water, structures and previews. Replacing Sky Archipelago would also require recovering cluster placement, fragments, oceans, geology and saved identity; no simplification or performance advantage has been demonstrated.

Dynamic Waters has Tectonic-specific integration that can disable its underground rivers. Any future experiment must select one hydrology owner and inspect that mutation. Keep Tectonic deferred; installing both is not an approved terrain composition.
