# World generation

New worlds use **Skyweave Islands**, preset `skyweave_compat:islands_v1`, from [Skyweave: Compatibility Patches](https://github.com/mannie-exe/skyweave-compat). The manifest pins the installed mod version. Skyweave: Compatibility Patches extends Sky Archipelago 1.4 and is required on both client and server. Ordinary Sky Archipelago presets retain upstream generation with the village-neighbor filter.

The [island generation reference](island-generation.md) inventories biome eligibility, archetypes, descriptor combinations and shaping/placement controls. It separates supported combinations from current selection weights.

Sky Archipelago's common config and the selected legacy `eee` preset apply to ordinary upstream worlds. The legacy preset explicitly keeps rivers disabled. The marked Skyweave preset uses its owned profiles and the Dynamic Waters bridge described below. Removed 1.4 blending, fragmentation and old placement-fallback switches are not retained as inactive controls. The native server config keeps diagnostics off, adaptive caching, crash shielding and serialized structure mutations for parallel generation. World-specific server-config overrides take precedence over installation defaults.

## Terrain

The authored profile is `overrides/common/config/skyweave/skyweave_compat-generation.json`.

| Control | Pack setting | Meaning |
| --- | --- | --- |
| Build range | Y=-128 through 767 | Includes terrain and building space |
| Cluster grid | 2400 blocks, jitter 750 | Cell spacing and bounded center displacement |
| Activation | 0.85 | Candidate activation before biome and clearance rejection |
| Anchor center | Y=200 to 490 | Intersected with the safe band for the selected body |
| Anchor height target | 250 to 400 blocks | Realized height varies with relief and erosion |
| Base anchor radius | 270 to 370 blocks | Before area-preserving elongation; not an exact shoreline |
| Companion radius/orbit | 40 to 110 / 470 to 680 blocks | Relative to the host anchor |
| Companion vertical offset | -60 to +50 blocks | Adjusted to fit the dimension |
| Floor/building clearance | 32 / 200 blocks | Reserved inside the build range |
| Minimum cluster gap | 350 blocks | Complete terrain-density supports, not structures |

Deterministic priority rejects candidates whose complete cluster support bounds would violate the minimum gap. Wider jitter can therefore remove a candidate; it does not allow neighboring clusters to overlap. Grid spacing is not a guaranteed travel distance: shores, companions, biome exclusions and missing clusters affect the actual crossing. The tallest target requires an anchor center of at least Y=338. Sky Archipelago 1.4 owns exterior shaping, rims and erosion; Compat does not retain a second taper implementation. The fresh-world fallback checks generated support and headroom before setting spawn; it does not relocate existing worlds or create a platform.

### Geology and features

Ores, selected underground features, deepslate, classic carvers and cave biomes use an anchor-relative geological frame. Reference Y=-64 maps to its geological bottom and Y=64 to its surface datum. Higher reference positions retain their vertical offset above that datum. Companions share the frame, so thin islands do not receive a complete compressed ore column.

Native vein shapes, replacement rules, exposure checks and initial attempt counts remain authoritative. Coverage includes vanilla Overworld ores, Create zinc and striated deposits, and Propulsion platinum. Nether/End generation is unchanged. Skyweave: Compatibility Patches 0.5.0 also restores native large iron/copper veins in the same geological frame, including their raw-ore blocks and associated stone. Ordinary ore features remain separate. No large zinc or platinum veins are added. Temperature uses a separate contributor-relative altitude: `64 + altitudeScale * (worldY - ownerClimateDatum)`. The natural nominal plateau is the datum, so ordinary high islands retain their climate while substantial hills above that datum can cool. Cold biomes stay cold. `skyweave_compat-climate.json` owns altitude scale, bounded air association and underground-depth tuning. Physical collision, light, fluids and world coordinates remain unchanged.

### Interiors and local water

The preset explicitly uses OVERLAP to retain lower island bodies. Cavities are subtracted within each contributing island before surviving rock is combined; one island's hollow cannot erase another island's rock. The native exterior shape remains independent of interior selection. Geological depth uses the original anchor frame, not the thickness of a remaining cavern roof.

`skyweave_compat-interiors.json` selects noise interiors with probability 0.55, hollows with 0.18, and baseline interiors otherwise. These are descriptor choices, not measured percentages of land. The shell is 12 blocks; selected openings can cut through it. Hollows retain rock pillars. Native classic carvers remain enabled. These custom cavities do not import the complete vanilla continental density router.

`skyweave_compat-rivers.json` disables native Sky Archipelago rivers and lakes. Dynamic Waters 13.1.0 supplies island watersheds through the pinned Compat bridge; lowland mode remains `VANILLA` and mountain tunnels are disabled. Global ocean remains disabled. Rejected cuts retain inert heights, supported shallower beds keep lakes coherent over cave roofs, and generated channels stop before detached fragments. Native ocean habitats retain their own beds and seals. Existing chunks are not repaired automatically; the changed generation identity requires a fresh marked world. [Compatibility](compatibility.md#island-water-and-environment) owns the integration boundary; [terrain and structure content](worldgen-candidates.md) owns the selected ecology and settlement composition.

River planning protects supported beds before interior subtraction. Initial and recurring freezing use the actual water-cell biome at its contributor-relative thermal altitude. Genuine cold biomes and cold surface skins remain. Selected HOLLOW roofs receive bounded irregular skylights by default; NOISE skylights remain opt-in, and side entrances retain their existing selection. The new skylight fields live in the interior profile and enter saved generation identity.

Mangrove surfaces receive mud unless an existing upstream material override applies. Ordinary lush caves, dripstone caves and Deep Dark use the native multi-noise selector with depth mapped between the actual owning exterior roof and bottom, after the configured surface-cover margin. The other five climate axes retain physical quart coordinates. Solid occupancy takes precedence over water and cavity owners at overlapping heights. Underground depth, thermal altitude and the shared geological resource frame remain distinct; a remaining cavity roof does not reset those frames. Special fractured Deep Dark selection remains a separate conditional recipe and never requires a city.

Ancient Cities use actual interior placement and final biome eligibility. `skyweave_compat-ancient-cities.json` sets minimum sampled exterior-body burial to 0.90 for normal/NOISE hosts, with separate core and floor checks. Bounded peripheral exposure is allowed; HOLLOW hosts instead require an existing cavity with floor/roof support. Piece-aware vanilla-style clearance opens room around accepted layouts while retaining the island shell, native foundations and authored water beds. An unsuitable site is rejected without a surface fallback or giant platform. Layouts, canonical starts and locate remain native.

`skyweave_compat-shapes.json` adds seeded horizontal variation: 65% elongation chance up to 1.96 length-to-width ratio, approximately preserving area, and 26-block base broad warp. Strengths vary by up to ±15% per island. Ordinary Mixed fringes retain 30–70% smooth perimeter with an additive fragment fringe; base falloff distance is 64 blocks. The intact-core Disintegrating profile has 15% selection and 1.6 maximum reach multiplier, with uneven local reach and fragments shrinking/thinning outward. Fractured alternatives retain native Mushroom Fields or Badlands ecology independently of NOISE/HOLLOW interiors, with 35% eligible-biome selection. Deep Dark selection is 10% of eligible native-climate hosts. Its selected natural contributors use a deepslate body, a coherent nearly continuous sculk cap and the parent’s bounded HOLLOW cavern/openings. Fractured HOLLOW bodies preserve that chamber through each admitted remnant shift: physical cuts expose chamber air, while surviving parent roofs, floors and outer shoulders retain their shell. Fracture cuts do not receive a new enclosing lining. `deepDark` in the same shape profile owns cap bias/scale and independent per-chunk vein/sensor/catalyst/shrieker chances; cap coverage does not multiply devices. Ordinary native Deep Dark retains its separate ecology. Special-island Ancient City placement is not required; ordinary distribution and burial/clearance still apply. These are conditional settings, not measured worldwide frequencies. Native vertical shaping and ordinary spacing retain their owners.

`skyweave_compat-oceans.json` admits 20% of activated native ocean-biome opportunities; rejected opportunities remain void. The selected defaults equally weight Lagoon and Broken Ocean Reef, disabling Reef Ring and Dead Ocean Shelf. Lagoon-only edge treatments select 25% open-cove horseshoe shore and 75% native rim; falling-perimeter selection is disabled. Ocean anchors use normal radii and seeded aspect, warp and dry outer fragments; the cove mouth stays clear. Separate solid spires may accompany ocean anchors; ordinary land satellites do not. The continuous global ocean layer remains disabled. Settings enter generation identity and require a fresh world; explicit existing opt-outs remain authoritative. Aquatic progression and populations remain unqualified.

The mod's [terrain reference](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/terrain.md) owns feature coverage and implementation. Its [configuration reference](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/configuration.md) owns field validation. Pack configuration above owns the selected values. [Horizontal variation and metadata discovery](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/terrain-variation.md) documents `/skyweavecompat islands search`, bounded continuation, filters, and representative-center limits. Gargantuan islands remain deferred; main-island underside changes are cancelled. The [performance procedure](performance.md) remains guidance for a separate profiling pass.

### Structure discoveries

The marked preset uses Compat's cluster-family distribution defaults. Eligible terrain area and biome validity supply stable allowances; void relocation sources and variants cannot each claim another allowance. Fitted native starts retain layout and delivery checks. Multiple ordinary villages are allowed, with outposts checked against their final anchors. Sky Villages retains its separate zero-to-three allowance. [Structures](structures.md#cluster-discoveries) owns pack policy and the link to the mod's configurable rates. This changes saved generation identity; existing worlds require their recorded artifact/configuration or a separate fresh world.

Use `/skyweavecompat structures search <radius> family=villages` or `structure=<id|#tag>` for bounded operator searches, with `status`, `page` and `cancel`. Unlike the island metadata locator, it may save early structure-start chunks. The command keeps native starts authoritative and reports partial results when its time/candidate budget is exhausted. It does not change ordinary synchronous `/locate` or map-item lookups. Operational limits live in `config/skyweave/skyweave_compat-search.json`, outside terrain identity; Compat owns their validation and UI. The pack selects a 600-second wall-time allowance, a 65,536-candidate admission cap, two concurrent native requests and five milliseconds of per-tick bookkeeping. Enumeration streams into bounded queues rather than retaining every candidate until planning completes. The time allowance includes planning and waiting, not just verification; exhaustion does not prove that the searched radius contains no structures. These startup settings require a server restart to apply and no new world. Same-session respawn preserves discovery ownership and the original search center; disconnect and incompatible dimension changes retire it.

For commands and their coverage limits, see [operator discovery](../players/server.md#finding-islands-and-structures).

### Villages and atmosphere

Each anchor draws a village allowance of zero to three, weighted `96:24:8:3`. Companions share it. Biome, layout and clearance rejection can reduce actual counts. Villages float beside terrain, with their height relative to the host surface datum. [Structures](structures.md) owns pack loot, crop and salvage policy.

Aeronautics Delivery Quests uses a 500-block horizontal route minimum, a 6000-block destination-search offset limit and a 120-minute time limit. The locator can resolve farther away; the search offset is not a final route cap. Skyweave: Compatibility Patches retains endpoint chunk tickets until finalization and retries rejected Sky Village landings within their bounds using ADQ's original safety predicate.

The Sable integration sets pressure to 1.0 at Y=508, 0.8 at 600, 0.5 at 680 and zero at the exclusive ceiling of 768. Gravity and drag retain Sable defaults. Pressure follows world altitude, not each island's local surface.

### Evidence and limits

Earlier density samples cover six anchors across seeds 42 and 8675309. Each used one chunk per stratum in a 7-by-7 grid. All contained zinc, iron, copper, coal, redstone, andesite, diamond and platinum. No emerald was observed; sparse samples cannot establish absence. Observed blocks and area-weighted estimates are separate, and neither proves mining access or survival scarcity.

The qualified 0.5.0 survey separately samples three anchors on seed 42 with interiors, large veins and local water enabled. Atlas displays its artifact hash, reference-depth ore bands and ore adjacent to air or fluid. Exposure excludes chunk-edge columns and does not establish a reachable mining route. Keep these samples distinct from the server's dated saved-world survey and older density runs.

Earlier creative flight checks demonstrated a glued cargo balloon, save/reopen and an outward/return crossing of roughly 1.5 km each way. Those are historical checks on the earlier terrain version, not current-grid fuel budgets or wing-borne flight evidence. Delivery endpoint checks do not establish completed deliveries. Exact versions, hashes, samples and limits belong in the mod's [verification record](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/verification.md).

The Atlas keeps saved-world surveys separate from imported isolated surveys. [World data](web/data.md#island-generation-surveys) describes provenance and import. Remaining play checks include cave access, mining time, flight budgets, survival controls and delivery completion. No recipe changes compensate for thin terrain.

## Cluster visibility

The 2026-10-26 stopped-world survey uses seed `-3702386035254534638` and `islands_v1-prototype-10`. Its recorded geometry matches the installed configuration: 2400-block grid, ±750 displacement per horizontal axis, 0.85 candidate activation and 350-block minimum support gap. Biome admission still rejects ocean-biome anchors; clearance priority can reject another candidate. Sky Archipelago's ordinary CONSISTENT/DYNAMIC and size presets do not set this geometry. OVERLAP retains intersecting vertical bodies; it does not override inter-cluster clearance.

A native descriptor survey using that exact seed, artifact and embedded settings found 30 anchor centers within 10,000 blocks of the origin. All their center chunks were stored with full status, and every cluster had saved solid terrain at its center or a bounded nearby sample; crescent/crater centers need not contain land. Nearest-other-anchor distances were 1968–3148 blocks, median 2204. Each had 1–6 other anchor centers within 4096 blocks, median 4. These are center distances; two distinct nearest-center pairs had sampled solid-column shore gaps of 1047 and 1230 blocks on a 16-block grid. Those gaps are neither exact routes nor a minimum guaranteed shoreline distance. The sampled nearest support gaps were 428–1700 blocks; support bounds deliberately overestimate occupied terrain.

At spawn (-836, 445, 852), other cluster centers are approximately 2144, 2809, 3221 and 3800 blocks away. This supports nearby inter-cluster sightlines in range, not visibility from every point: foreground terrain, altitude and camera direction can obscure them. Farther clusters are expected to fall outside a finite view.

### Rendering and transfer limits

Current authored client defaults are view 12 and simulation 10; dedicated-server defaults are view 16 and simulation 12. Existing seeded settings can differ. [Player graphics](../players/graphics.md) owns renderer choices and troubleshooting; [server operation](../players/server.md) owns transfer limits and pregeneration. Simulation distance does not extend distant rendering, and pregen coverage is not a camera range. Keep terrain density, visibility and data readiness distinct.

The [October 26 rendering analysis](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/worldgen.md#local-rendering-limits) records the then-installed settings, fog formula and DH request-cap interpretation. Those observations do not establish a later client's settings. Shader fog can reduce contrast despite available LOD data; available server data can also be missing from a client cache. Visibility after approaching an island and returning is therefore insufficient evidence of a fog or render-distance cutoff. The [cache-filling investigation](compatibility.md#dh-multiplayer-cache-filling) describes the separate request/transfer boundary.

## Ordinary Sky Archipelago worlds

The retained TOML and `eee` preset use CONSISTENT spacing 1494. They preserve the ordinary preset used before 0.1.12 and do not control Skyweave: Compatibility Patches' expanded geometry. Keep those settings with existing ordinary worlds.

Native random spacing selects one value for the whole world from its layout seed, rather than independently varying the distance between clusters. CONSISTENT 1494 keeps that base density stable across seeds. Shapes, biome eligibility and companions still vary; cell spacing is not the distance between island edges. The marked Skyweave preset uses its own grid and jitter controls above.

## Biome compatibility and updates

Keep `mixin.perf.biome=false` in `zfastnoise.mixin.properties`: Zfastnoise's biome optimization conflicts with Sky Archipelago's Deep Dark projection redirect. `mixin.perf.noise=true` remains enabled. The configured boots no longer reported the collision; that does not establish ancient-city availability.

Skyweave: Compatibility Patches records generation identity in each expanded-preset world and rejects incompatible changes or unmarked existing terrain. Preserve the original mod, configuration and marker with a save. Never delete the marker to force adoption of incompatible chunks. New geometry requires a separate new world.

Distributed server templates leave the seed blank. Compare disposable worlds with identical seeds, artifacts and resolved settings, then sample other seeds before generalizing. [Patch maintenance](patches.md) covers dependency review; [server maintenance](../players/server.md) covers backups and updates.

## Same-seed world replacement and LODs

DH 3.3.3 sends a seed-derived level key when `server.levelKeyPrefix` is blank. Different terrain regenerated with the same seed can reuse a client's old LOD key. For a deliberate world replacement, set a unique new `levelKeyPrefix` in that server's local DH config before launch. Keep `sendLevelKeys=true`; do not distribute one fixed prefix to unrelated servers. Clients then select separate caches while retaining previous files. Ordinary updates preserving terrain should preserve the key.
