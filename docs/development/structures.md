# Structures

## Placement and compatibility

The source includes [Sky Villages 1.0.6 for NeoForge](https://modrinth.com/mod/sky-villages/version/3InSHTOp)
with Minecraft 1.21.1, NeoForge 21.1.264 and Architectury 13.0.11. This is distinct from
Create: Sky Village.
Sky Villages uses datapack resources rather than a generated TOML. Maintained
resources live in `pack-fixes/data/skyvillages`; the structures audit register
owns their hashes and purpose. Build with `python3 scripts/build-fixes.py`.

| Control | Current choice |
| --- | --- |
| Height | Base start Y 160 to 224; Skyweave: Compatibility Patches shifts it relative to the host island in the expanded preset |
| Layout | Upstream jigsaw depth 7 and maximum distance 128 blocks |
| Distribution | Expanded preset: per-anchor allowance 0 to 3, candidate grid 24/12 chunks. Ordinary preset: upstream 70/65 chunks, salt 23734816 |
| Island proximity | Skyweave: Compatibility Patches: minimum gap 64, maximum host distance 512, minimum host radius 96 |
| Biomes | Ocean, river, jungle and forest tags, plus dark forest |
| Pools | Installed templates and explicit empty entries only |
| Village discovery | Include `skyvillages:skyvillage` in `#minecraft:village` |
| Jukeboxes | Keep blocks; clear generated record NBT and reset `has_record` |
| Foundation minerals | One ordered pass: 0.025% diamond ore, 0.15% emerald ore, 20% diorite overall |
| Crops and chest loot | Upstream defaults |

The base height override avoids adding 150 blocks to the upstream surface
projection; Skyweave: Compatibility Patches applies its host-relative altitude adaptation separately.
It does not guarantee clearance from terrain. Removing 63 absent optional
compatibility-template references prevents selections that cannot resolve.
Revisit those pools when adding related content. Clearing generated jukebox
records avoids the reproduced null-level failure during structure placement;
player-inserted records are unaffected. No third-party NBT templates are copied.

Sky Archipelago classifies `skyvillage` as `SKY` before its village-name rule.
Village-tag membership supports Delivery Quests lookup without changing that
classification. Ocean biomes are eligible even though terrain islands over ocean
biomes are disabled. Eligibility alone does not establish that a usable village
will appear in an ocean void; structure placement rules still apply.

## Resources, crops and loot

Foundation stone now uses one ordered rule processor: diamond first, emerald
second, diorite third. The probabilities for later rules account for earlier
matches: `0.00025`, `0.0015 / 0.99975`, and `0.2 / 0.99825`. These are nominal
aggregate shares, not guaranteed quotas per building or village.

The original separate processors reused position-seeded random rolls. The first
20% diorite pass masked every later 0.5% diamond candidate, while approximately
4% of foundation stone became emerald ore. Native positive-control sampling
confirmed the masked diamond rule. The combined pass fixes that defect while
reducing mineral quantities enough that a settlement is not primarily an ore bank.

The 2026-10-22 survey placed 24 complete villages across seeds 1, 42, 8675309 and
20261023 above flat terrain, excluding natural ore. Native piece selection,
processors and overlapping placement remained active. Villages had 30 to 83 pieces
and bounds within Y 153 to 278.

| Resource per village | Range | Median | Total across 24 |
| --- | --- | --- | --- |
| Foundation diamond ore | 0 to 5 | 2 | 51 |
| Foundation emerald ore | 5 to 33 | 17 | 397 |
| Chest diamonds | 0 to 3 | 0 | 17 |
| Chest emeralds | 0 to 7 | 1 | 28 |

The 361 chest rolls are one no-player sample, not guaranteed seeded yields or
multiplayer Lootr entitlements. Ore counts are blocks before Fortune or processing.
A median foundation yields roughly one light delivery's 15 to 20 emerald reward
before Fortune, with excavation and a finite supply. This is a balance judgment,
not a measured comparison of mining and transport time. Keep these rates for
playtesting; do not increase delivery payouts to compete with the old foundations.

All 24 villages retained wheat, carrots, potatoes and beetroot. The crop rules
remain unchanged: nominal aggregate replacement shares are 30% carrots, 14%
potatoes and 5.6% beetroot, leaving 50.4% wheat among processed wheat blocks.
Whole-village crops also depend on template contents and placement; those rule
shares are not predictions of the final harvest mix.

Eleven chest tables delegate to vanilla village loot; the twelfth is an optional
Supplementaries urn table whose registration does not establish accessibility.
Template names do not reliably predict chest contents: both libraries, the
alchemist and one farm use weaponsmith loot alongside the two weaponsmiths.
That table can supply diamonds, obsidian, iron equipment and other valuable loot.
Chest loot remains a separate diamond route from the scarce foundation deposits.
Lootr behavior and per-player loot multiplication still need a gameplay check.

Useful salvage is already broader than chest loot: one library contains 43
bookshelves, the alchemist has a Brewing Stand, a smithy has three lava blocks,
and the mason template includes a spruce sapling. That sapling can start renewable
resin production; it is not necessary to find a natural taiga first if this
building is present and reachable. None of these templates is guaranteed per village.

## Placement policy

The intended placement is floating **beside** island clusters, with a horizontal
void gap. Regular villages and ground structures belong on the terrain. Floating
above an island does not satisfy this placement goal.

Sky Archipelago 1.3.6 deliberately lets SKY structures generate without island
anchoring. Its [changelog](https://modrinth.com/mod/sky-archipelago/version/1.3.6)
confirms that behavior. `StructurePlacementPolicy.categoryFor` classifies
`skyvillages:skyvillage` as SKY through the `sky` token, before its village-name
rule. `StructureRoutingPolicy.shouldRouteSkyToV2` selects the SKY engine before
the legacy whitelist branch.

Sky Archipelago 1.3.6 has these controls before Skyweave: Compatibility Patches applies its filter:

| Control | Effect on Sky Villages |
| --- | --- |
| `customStructureRulesEnabled = true` | Enables the custom placement pipeline; disabling it supplies no island-proximity constraint |
| `skyStructureCategoryTokens` / `skyStructureCategoryOverrides` | Select a placement category; `DEFAULT` still routes to SKY when its ID matches a sky token |
| `skyStructureWhitelist` | Adding this village skips its SKY air-clearance validation; it does not enable the later legacy nearby-terrain guard |
| Ground category overrides | Select ground support/anchoring behavior, not floating placement beside terrain |
| `supportSampleGridSize = 5` | Controls footprint clearance sampling, not minimum or maximum island distance |
| Datapack height, biome and random-spread settings | Control candidate height, eligibility and frequency, not distance to island edges |

`StructureSupportValidator.evaluateSkyAirPlacement` rejects sampled terrain
columns when `structure.minY - column.topY <= 8`. Nine blocks of clearance passes,
including directly above an island. Its `skyNearbyIslandColumns` field counts
terrain samples in a center ±96-block square at 16-block intervals, but that count
is diagnostic: zero nearby terrain does not reject a layout. Neither the eight
block threshold nor that diagnostic radius is a configuration setting.

A disposable NeoForge probe against the installed 1.3.6 / Sky Villages 1.0.6 JARs
verified those branches using the native methods and the saved world's decoded
generator/settings. Clearance 0 and 8 failed; 9 passed; isolated void with zero
nearby samples passed. A native village layout ran SKY air validation normally
and bypassed it when explicitly whitelisted. `DEFAULT` with the current tokens
still selected SKY. The probe read `level.dat` without changing it and generated
no chunks in the live world. These checks establish upstream behavior without Skyweave: Compatibility Patches' neighbor filter.

Ocean biome eligibility compounds the visual effect: villages can pass their
biome check where this pack suppresses natural terrain islands. Removing ocean
eligibility would not establish a distance band or prevent above-island layouts.

The ordinary Sky Archipelago baseline gives one candidate per 1,120 × 1,120-block cell before biome
and placement rejection. The 65-chunk separation leaves only five possible chunk
offsets per axis. Counts are independent of player count and cluster occupancy.
Changing separation alone spreads candidate positions but does not reduce their
number. The earlier four-seed generation survey measured a 74% valid-start rate;
that is a sample, not a universal density guarantee.

[Skyweave: Compatibility Patches](https://github.com/mannie-exe/skyweave-compat) replaces
Sky Village Neighbors. Common placement controls live in
`skyweave_compat-common.toml`. Its expanded preset shifts the structure altitude
into the island band and assigns each anchor an allowance of zero to three
villages, weighted `96:24:8:3`. Biome, layout and terrain rejection can lower the
count. Companions share their anchor's allowance. The preset uses a separate
24-chunk candidate grid with 12-chunk separation; the ordinary baseline's
70/65 spacing no longer describes this preset's frequency.

The neighbor rule retains SKY placement and requires a 64-block horizontal gap
from the village footprint, a host terrain sample within 512 blocks and a native
host radius of at least 96. Clearance checks every column in the exclusion band.
The 16-block host-search grid can conservatively miss a narrow eligible edge.
Existing villages are not relocated. Loot and foundation tuning remain pack-owned.

Village hooks require both Sky Villages and Architectury. ADQ's optional adapter
retains the native dry-ground check, retries within the village, holds bounded
chunk tickets through route finalization and checks horizontal route distance.
Native tests generated and accepted an offer between distinct villages and
spawned its cargo. Completed deliveries and cargo clearance still need playtesting.
See [world generation](worldgen.md) and the mod's verification guide for samples
and limitations.

Further tuning:

- Remeasure actual village counts per archipelago before changing the weighted
  allowance or candidate grid. An allowance is a maximum, not a guaranteed count.
- Keep the current foundation rates while reviewing repeated chest loot and
  salvage. Give libraries, farms and alchemist buildings appropriate loot through
  per-template processors; preserve weaponsmith loot for actual smithies. Keep
  crops and villager access useful instead of adding artificial recipe gates.
- Check Fortune, multiplayer Lootr yields and usable delivery endpoints before
  changing payout or trade rules. Delivery contracts move supplied cargo rather
  than consuming the player's agricultural output.

The expanded preset changes candidate selection and altitude; biome eligibility,
loot, crops and progression rules remain pack-owned and unchanged.
Existing chunks remain intact. The same seed reproduces terrain only while the
relevant generator version and resolved settings also remain the same.

## Verification scope

The Sky Villages 1.0.6 JAR SHA-256 is
`5ef7b63c6f1999a632085975afa14f00146369c142fd72980d760cbb617dd52f`.
The 2026-10-22 isolated checks loaded 20 templates, resolved all 21 remaining pool
references, registered 12 loot tables and confirmed village-tag membership.
The repeatable survey uses `pnpm data:structures` followed by `pnpm data:compile`
from `web/`. World & ores shows per-village resource counts, natural-start counts,
provenance and limitations. Disposable worlds and logs are removed automatically;
the compact generated dataset remains local Atlas data.

Natural testing used the same four public seeds, CONSISTENT 1,494-block cluster
distance and the unchanged 70/65-chunk village distribution. Across a five-by-five
candidate-cell grid around the origin for each seed, valid starts numbered
19, 19, 16 and 20: **74 of 100 candidates**. Two valid starts per seed were fully
generated; all eight contained village beds and completed without shielded
structure-placement failures. This establishes placement in the sampled worlds,
not safe landings, universal biome coverage or a completed cargo delivery. The
remaining 66 valid starts were inspected at structure-start stage only.

Controlled placements bypass biome eligibility and natural terrain. Natural
bounding-box resource counts include island terrain and must not be reported as
foundation yields. No survival playthrough or multiplayer Lootr test was performed.

The resource changes were introduced in 0.1.8; Skyweave: Compatibility Patches later replaced the separate
neighbor mod. Updates preserve a world unless its operator chooses a reset.
Existing chunks are not retrofitted. Structures Arise and broader structure tuning
remain a separate pass. See [progression](progression.md) for the connected fuel,
processing, trade and travel decisions.
