# World generation

New worlds use **Skyweave Islands**, preset `skyweave_compat:islands_v1`, from
[Skyweave: Compatibility Patches](https://github.com/mannie-exe/skyweave-compat). The manifest
pins the installed mod version. Skyweave: Compatibility Patches extends Sky Archipelago 1.4 and is
required on both client and server. Ordinary Sky Archipelago presets retain
upstream generation with the village-neighbor filter.

Sky Archipelago's common config and the selected legacy `eee` preset apply to ordinary upstream worlds. The legacy preset explicitly keeps rivers disabled. The marked Skyweave preset uses its owned profiles and the Dynamic Waters bridge described below. Removed 1.4 blending, fragmentation and old placement-fallback switches are not retained as inactive controls. The native server config keeps diagnostics off, adaptive caching, crash shielding and serialized structure mutations for parallel generation. World-specific server-config overrides take precedence over installation defaults.

## Terrain

The authored profile is `overrides/common/config/skyweave/skyweave_compat-generation.json`.

| Control                   | Pack setting                  | Meaning                                                   |
| ------------------------- | ----------------------------- | --------------------------------------------------------- |
| Build range               | Y=-128 through 767            | Includes terrain and building space                       |
| Cluster grid              | 2400 blocks, jitter 750       | Cell spacing and bounded center displacement              |
| Activation                | 0.85                          | Candidate activation before biome and clearance rejection |
| Anchor center             | Y=200 to 490                  | Intersected with the safe band for the selected body      |
| Anchor height target      | 250 to 400 blocks             | Realized height varies with relief and erosion            |
| Base anchor radius        | 270 to 370 blocks             | Before area-preserving elongation; not an exact shoreline |
| Companion radius/orbit    | 40 to 110 / 470 to 680 blocks | Relative to the host anchor                               |
| Companion vertical offset | -60 to +50 blocks             | Adjusted to fit the dimension                             |
| Floor/building clearance  | 32 / 200 blocks               | Reserved inside the build range                           |
| Minimum cluster gap       | 350 blocks                    | Complete terrain-density supports, not structures         |

Deterministic priority rejects candidates whose complete cluster support bounds
would violate the minimum gap. Wider jitter can therefore remove a candidate;
it does not allow neighboring clusters to overlap. Grid spacing is not a guaranteed
travel distance: shores, companions, biome exclusions and missing clusters affect
the actual crossing. The tallest target requires an anchor center
of at least Y=338. Sky Archipelago 1.4 owns exterior shaping, rims and erosion; Compat does not retain a second taper implementation.
The fresh-world fallback checks generated support and headroom before setting spawn;
it does not relocate existing worlds or create a platform.

### Geology and features

Ores, selected underground features, deepslate, classic carvers and cave biomes
use an anchor-relative geological frame. Reference Y=-64 maps to its geological
bottom and Y=64 to its surface datum. Higher reference positions retain their
vertical offset above that datum. Companions share the frame, so thin islands do
not receive a complete compressed ore column.

Native vein shapes, replacement rules, exposure checks and initial attempt counts
remain authoritative. Coverage includes vanilla Overworld ores, Create zinc and
striated deposits, and Propulsion platinum. Nether/End generation is unchanged.
Skyweave: Compatibility Patches 0.5.0 also restores native large iron/copper veins in
the same geological frame, including their raw-ore blocks and associated stone.
Ordinary ore features remain separate. No large zinc or platinum veins are added.
Temperature queries use reference Y=64 so biome climate is independent of island
altitude. Cold biomes remain cold; altitude cooling above mountains is absent.

### Interiors and local water

The preset explicitly uses OVERLAP to retain lower island bodies. Cavities are
subtracted within each contributing island before surviving rock is combined;
one island's hollow cannot erase another island's rock. The native exterior shape remains independent of interior selection. Geological depth uses the original anchor frame, not
the thickness of a remaining cavern roof.

`skyweave_compat-interiors.json` selects noise interiors with probability 0.55,
hollows with 0.18, and baseline interiors otherwise. These are descriptor choices,
not measured percentages of land. The shell is 12 blocks; selected openings can
cut through it. Hollows retain rock pillars. Native classic carvers remain enabled.
These custom cavities do not import the complete vanilla continental density router.

`skyweave_compat-rivers.json` disables native Sky Archipelago rivers and lakes. Dynamic Waters 13.1.0 supplies island watersheds through the pinned Compat bridge; lowland mode remains `VANILLA` and mountain tunnels are disabled. Global ocean remains disabled. Rejected cuts retain inert heights, supported shallower beds keep lakes coherent over cave roofs, and generated channels stop before detached fragments. Native ocean habitats retain their own beds and seals. Existing chunks are not repaired automatically; the changed generation identity requires a fresh marked world. [Compatibility](compatibility.md#island-water-and-environment) owns the integration boundary; [terrain and structure content](worldgen-candidates.md) owns the selected ecology and settlement composition.

River planning protects supported beds before interior subtraction. Initial and recurring freezing use the actual water-cell biome at the existing Y64 climate reference. Genuine cold biomes and cold surface skins remain. Selected HOLLOW roofs receive bounded irregular skylights by default; NOISE skylights remain opt-in, and side entrances retain their existing selection. The new skylight fields live in the interior profile and enter saved generation identity.

Mangrove surfaces receive mud unless an existing upstream material override applies. Lush and dripstone projection uses island-relative geological depth inside the exterior body. Ordinary cave Deep Dark keeps native 1.4's fixed Y=-48 proxy and lower-45%-of-exterior rule in both stored biomes and structure checks. A separate rare fractured Deep Dark ecology uses native climate eligibility, surface biome projection, and vanilla sculk patches; it does not guarantee a city. Remaining cavity roofs do not redefine that band.

Ancient Cities use actual interior placement and final biome eligibility. `skyweave_compat-ancient-cities.json` sets minimum sampled exterior-body burial to 0.90 for normal/NOISE hosts, with separate core and floor checks. Bounded peripheral exposure is allowed; HOLLOW hosts instead require an existing cavity with floor/roof support. Piece-aware vanilla-style clearance opens room around accepted layouts while retaining the island shell, native foundations and authored water beds. An unsuitable site is rejected without a surface fallback or giant platform. Layouts, canonical starts and locate remain native.

`skyweave_compat-shapes.json` adds seeded horizontal variation: 65% elongation chance up to 1.96 length-to-width ratio, approximately preserving area, and 26-block base broad warp. Strengths vary by up to ±15% per island. Ordinary Mixed fringes retain 30–70% smooth perimeter with an additive fragment fringe; base falloff distance is 64 blocks. The intact-core Disintegrating profile has 15% selection and 1.6 maximum reach multiplier, with uneven local reach and fragments shrinking/thinning outward. Fractured alternatives retain native Mushroom Fields or Badlands ecology independently of NOISE/HOLLOW interiors, with 35% eligible-biome selection. Deep Dark selection is 10% of eligible native-climate hosts. These are conditional settings, not measured worldwide frequencies. Native vertical shaping and ordinary spacing retain their owners.

`skyweave_compat-oceans.json` admits 20% of activated native ocean-biome opportunities; rejected opportunities remain void. The selected defaults equally weight Lagoon and Broken Ocean Reef, disabling Reef Ring and Dead Ocean Shelf. Lagoon-only edge treatments select 25% open-cove horseshoe shore and 75% native rim; falling-perimeter selection is disabled. Ocean anchors use normal radii and seeded aspect, warp and dry outer fragments; the cove mouth stays clear. Separate solid spires may accompany ocean anchors; ordinary land satellites do not. The continuous global ocean layer remains disabled. Settings enter generation identity and require a fresh world; explicit existing opt-outs remain authoritative. Aquatic progression and populations remain unqualified.

The mod's [terrain reference](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/terrain.md) owns feature coverage and implementation. Its [configuration reference](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/configuration.md) owns field validation. Pack configuration above owns the selected values. [Horizontal variation and metadata discovery](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/terrain-variation.md) documents `/skyweavecompat islands search`, bounded continuation, filters, and representative-center limits. Gargantuan islands remain deferred; main-island underside changes are cancelled. The [performance procedure](performance.md) remains guidance for a separate profiling pass.

### Structure discoveries

The marked preset uses Compat's cluster-family distribution defaults. Eligible
terrain area and biome validity supply stable allowances; void relocation sources
and variants cannot each claim another allowance. Fitted native starts retain
layout and delivery checks. Multiple ordinary villages are allowed, with outposts
checked against their final anchors. Sky Villages retains its separate zero-to-three
allowance. [Structures](structures.md#cluster-discoveries) owns pack policy and the
link to the mod's configurable rates. This changes saved generation identity;
existing worlds require their recorded artifact/configuration or a separate fresh world.

Use `/skyweavecompat structures search <radius> family=villages` or `structure=<id|#tag>` for bounded operator searches, with `status`, `page` and `cancel`. Unlike the island metadata locator, it may save early structure-start chunks. The command keeps native starts authoritative and reports partial results when its time/candidate budget is exhausted. It does not change ordinary synchronous `/locate` or map-item lookups. Operational limits live in `config/skyweave/skyweave_compat-search.json`, outside terrain identity; Compat owns their validation and UI.

For commands and their coverage limits, see [operator discovery](../players/server.md#finding-islands-and-structures).

### Villages and atmosphere

Each anchor draws a village allowance of zero to three, weighted `96:24:8:3`.
Companions share it. Biome, layout and clearance rejection can reduce actual
counts. Villages float beside terrain, with their height relative to the host
surface datum. [Structures](structures.md) owns pack loot, crop and salvage policy.

Aeronautics Delivery Quests uses a 500-block horizontal route minimum, a
6000-block destination-search offset limit and a 120-minute time limit. The
locator can resolve farther away; the search offset is not a final route cap.
Skyweave: Compatibility Patches retains endpoint chunk tickets until finalization and retries rejected
Sky Village landings within their bounds using ADQ's original safety predicate.

The Sable integration sets pressure to 1.0 at Y=508, 0.8 at 600, 0.5 at 680 and
zero at the exclusive ceiling of 768. Gravity and drag retain Sable defaults.
Pressure follows world altitude, not each island's local surface.

### Evidence and limits

Earlier density samples cover six anchors across seeds 42 and 8675309.
Each used one chunk per stratum in a 7-by-7 grid. All contained zinc, iron, copper,
coal, redstone, andesite, diamond and platinum. No emerald was observed; sparse
samples cannot establish absence. Observed blocks and area-weighted estimates
are separate, and neither proves mining access or survival scarcity.

The qualified 0.5.0 survey separately samples three anchors on seed 42 with
interiors, large veins and local water enabled. Atlas displays its artifact hash,
reference-depth ore bands and ore adjacent to air or fluid. Exposure excludes
chunk-edge columns and does not establish a reachable mining route. Keep these
samples distinct from the server's dated saved-world survey and older density runs.

Earlier creative flight checks demonstrated a glued cargo balloon, save/reopen
and an outward/return crossing of roughly 1.5 km each way. Those are historical
checks on the earlier terrain version, not current-grid fuel budgets or wing-borne
flight evidence. Delivery endpoint checks do not establish completed deliveries.
Exact versions, hashes, samples and limits belong in the mod's
[verification record](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/verification.md).

The Atlas keeps saved-world surveys separate from imported isolated surveys.
[World data](web/data.md#island-generation-surveys) describes provenance and import.
Remaining play checks include cave access, mining time, flight budgets, survival
controls and delivery completion. No recipe changes compensate for thin terrain.

## Cluster visibility

The 2026-10-26 stopped-world survey uses seed `-3702386035254534638` and
`islands_v1-prototype-10`. Its recorded geometry matches the installed configuration:
2400-block grid, ±750 displacement per horizontal axis, 0.85 candidate activation
and 350-block minimum support gap. Biome admission still rejects ocean-biome
anchors; clearance priority can reject another candidate. Sky Archipelago's
ordinary CONSISTENT/DYNAMIC and size presets do not set this geometry. OVERLAP
retains intersecting vertical bodies; it does not override inter-cluster clearance.

A native descriptor survey using that exact seed, artifact and embedded settings
found 30 anchor centers within 10,000 blocks of the origin. All their center chunks
were stored with full status, and every cluster had saved solid terrain at its
center or a bounded nearby sample; crescent/crater centers need not contain land.
Nearest-other-anchor distances were 1968–3148 blocks, median 2204. Each had 1–6
other anchor centers within 4096 blocks, median 4. These are center distances;
two distinct nearest-center pairs had sampled solid-column shore gaps of 1047
and 1230 blocks on a 16-block grid. Those gaps are neither exact routes nor a
minimum guaranteed shoreline distance. The sampled nearest support gaps were
428–1700 blocks; support bounds deliberately overestimate occupied terrain.

At spawn (-836, 445, 852), other cluster centers are approximately 2144, 2809,
3221 and 3800 blocks away. This supports nearby inter-cluster sightlines in range,
not visibility from every point: foreground terrain, altitude and camera direction
can obscure them. Farther clusters are expected to fall outside a finite view.

### Local rendering limits

| Setting inspected on 2026-10-26             | Value                                   | Effect                                                  |
| ------------------------------------------- | --------------------------------------- | ------------------------------------------------------- |
| Client DH radius                            | 256 chunks / 4096 blocks                | Nominal distant-terrain rendering radius                |
| Client and server vanilla view              | 12 chunks / 192 blocks                  | Nearby full-detail chunks                               |
| Client simulation / server simulation       | 12 / 10 chunks                          | Does not extend distant rendering                       |
| DH pregen request                           | 1024 chunks / 16384 blocks around spawn | Prepared data area, not a camera range                  |
| Server DH sync/generation request caps      | 4096 chunks each                        | Request permission, not a client render setting         |
| Server DH live-update radius                | 256 chunks / 4096 blocks                | Changed-chunk notifications                             |
| Local client/server per-player DH bandwidth | 2048 KB/s                               | Tuned transfer cap; cached LOD delivery is still queued |
| Client DH cave culling                      | Disabled                                | Avoids the stock low-altitude cave cutoff               |

The 4096-chunk request caps are confirmed by DH 3.3.3's
`AbstractDhServerLevel`: it converts section-to-player block distance to chunks
before checking those settings. Client DH renderer mode is DEFAULT, with MEDIUM
horizontal/vertical quality and BLOCK maximum horizontal resolution. The
shader-off DH fog begins at 0.4 of render distance (about 1638 blocks) and reaches
its configured end at 4096, using exponential-squared falloff. These values do not
establish the active shader's fog behavior.

The selected shader is Complementary Unbound r5.9.3 with Euphoria Patches 1.10.5,
with `ATM_FOG_DISTANCE=150`. In its DH path, atmospheric fog uses
`1-exp2(-max(distance-40,0)*(0.4+0.4*rain)/150)`, then applies density, altitude,
weather and cave/light factors. The value 150 is not a 150-block cutoff. Shader
fog can substantially reduce distant contrast even when LOD data is available.
The spacing/fog inspection did not launch a client or change rendering settings.
Later live transfer tuning is recorded in [DH cache filling](compatibility.md#transfer-tuning).
The measured spacing does not by itself justify increasing DH's radius; consider
fog and data-transfer readiness before changing terrain or rendering budgets. The
subsequent [cache-filling investigation](compatibility.md#dh-multiplayer-cache-filling)
found available server LODs missing from the client's cache, nearest-first requests
and logged rate limiting. Visibility after an approach/return is therefore evidence
of data readiness, not sufficient evidence of a render-distance or fog cutoff.

## Ordinary Sky Archipelago worlds

The retained TOML and `eee` preset use CONSISTENT spacing 1494. They preserve the
ordinary preset used before 0.1.12 and do not control Skyweave: Compatibility Patches' expanded geometry.
Keep those settings with existing ordinary worlds.

Native random spacing selects one value for the whole world from its layout
seed, rather than independently varying the distance between clusters. CONSISTENT
1494 keeps that base density stable across seeds. Shapes, biome eligibility and
companions still vary; cell spacing is not the distance between island edges.
The marked Skyweave preset uses its own grid and jitter controls above.

## Biome compatibility and updates

Keep `mixin.perf.biome=false` in `zfastnoise.mixin.properties`: Zfastnoise's biome
optimization conflicts with Sky Archipelago's Deep Dark projection redirect.
`mixin.perf.noise=true` remains enabled. The configured boots no longer reported
the collision; that does not establish ancient-city availability.

Skyweave: Compatibility Patches records generation identity in each expanded-preset world and rejects
incompatible changes or unmarked existing terrain. Preserve the original mod,
configuration and marker with a save. Never delete the marker to force adoption
of incompatible chunks. New geometry requires a separate new world.

Distributed server templates leave the seed blank. Compare disposable worlds
with identical seeds, artifacts and resolved settings, then sample other seeds
before generalizing. [Patch maintenance](patches.md) covers dependency review;
[server maintenance](../players/server.md) covers backups and updates.

## Same-seed world replacement and LODs

DH 3.3.3 sends a seed-derived level key when `server.levelKeyPrefix` is blank.
Different terrain regenerated with the same seed can reuse a client's old LOD key.
For a deliberate world replacement, set a unique new `levelKeyPrefix` in that
server's local DH config before launch. Keep `sendLevelKeys=true`; do not distribute
one fixed prefix to unrelated servers. Clients then select separate caches while
retaining previous files. Ordinary updates preserving terrain should preserve the key.
