# Structures

## Placement and compatibility

The source includes [Sky Villages 1.0.6 for NeoForge](https://modrinth.com/mod/sky-villages/version/3InSHTOp) with Minecraft 1.21.1, the manifest-pinned NeoForge and Architectury 13.0.11. This is distinct from Create: Sky Village. Sky Villages uses datapack resources rather than a generated TOML. Maintained resources live in `resource-patches/data/skyvillages`; the structures audit register owns their hashes and purpose. Build with `python3 scripts/build-resource-patches.py`.

| Control | Current choice |
| --- | --- |
| Height | Base start Y 160 to 224; Skyweave: Compatibility Patches shifts it relative to the host island in the expanded preset |
| Layout | Upstream jigsaw depth 7 and maximum distance 128 blocks |
| Distribution | Expanded preset: per-anchor allowance 0 to 3, candidate grid 4/2 chunks. Ordinary preset: upstream 70/65 chunks, salt 23734816 |
| Island proximity | Skyweave: Compatibility Patches: minimum gap 64, maximum host distance 128, minimum host radius 96 |
| Biomes | Ocean, river, jungle and forest tags, plus dark forest |
| Pools | Installed templates and explicit empty entries only |
| Village discovery | Include `skyvillages:skyvillage` in `#minecraft:village` |
| Jukeboxes | Keep blocks; clear generated record NBT and reset `has_record` |
| Foundation minerals | One ordered pass: 0.025% diamond ore, 0.15% emerald ore, 20% diorite overall |
| Crops and chest loot | Upstream defaults |

The base height override avoids adding 150 blocks to the upstream surface projection; Skyweave: Compatibility Patches applies its host-relative altitude adaptation separately. It does not guarantee clearance from terrain. Removing 63 absent optional compatibility-template references prevents selections that cannot resolve. Revisit those pools when adding related content. Clearing generated jukebox records avoids the reproduced null-level failure during structure placement; player-inserted records are unaffected. No third-party NBT templates are copied.

Sky Archipelago classifies `skyvillage` as `SKY` before its village-name rule. Village-tag membership supports Delivery Quests lookup without changing that classification. Ocean biomes are eligible; native floating ocean habitats are enabled in the Skyweave profile. Eligibility alone does not establish that a usable village will appear in an ocean void; structure placement rules still apply.

## Settlement encounter policy

Ground villages target 0.889 and mansions 0.32 opportunities per 1024 eligible terrain chunks, capped at 3 and 1 per cluster respectively. Eligible biome area, seeded rounding, layout fitting and other reservations still reduce actual counts; these are not per-island probabilities. Sky Villages retain their separate allowance and require a substantial host body within 64–128 blocks of their final footprint. Detached fringes cannot qualify alone.

Native surveys found losses between allowed opportunities and usable layouts. Rates provide more opportunities without forcing invalid layouts or removing ruins; the existing fit budget and terrain safety checks remain. Intentional ruin variants are not proof of an inhabited settlement. [Compat verification](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/verification.md#village-fitting-and-discovery-0320) owns the exact native counts and limits.

Village fitting has a separate `villageFitting` group in the same authored policy. It controls structural support, retained inhabited buildings and bounded site, assembly and column work. These settings improve usable placement rather than changing the encounter allowance. Native pools and processors remain authoritative; connectivity checks and compatible road endings constrain trimming. Complete building support defaults on: every center, building and farm root must stay within the shallow-repair limit, while roads retain their coverage and short-overhang controls. A failed building can be trimmed or another bounded native layout selected; family allowances are unchanged. This geometric admission does not substitute for the later captured-material, actual-block and access checks. See the [Compat configuration reference](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/configuration.md#structure-distribution) for defaults and units. Foundation blending also follows the island's surface materials instead of imposing generic grass around structures on sandy terrain.

## Cluster discoveries

Skyweave: Compatibility Patches owns the `terrain.structure_distribution` adaptation in the marked preset. Ordinary vanilla families share one allowance across a main island and its companions; eligible terrain/biomes contribute to it, while surrounding void and the number of registered variants do not. Deterministic fractional counts, finite fitting alternatives and native placement checks produce occasional discoveries rather than collecting every nearby source opportunity.

The authored `config/skyweave/skyweave_compat-structures.json` records the pack encounter policy and matches the supported Compat defaults. Runtime edits use this same file; no second placement authority is introduced. Its [configuration reference](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/configuration.md#structure-distribution) lists rates, family caps and tuning units. Rates describe expected allowances, not guaranteed realized starts or independent per-island probabilities.

Portals and ordinary/beached wrecks each have a shared maximum of one per cluster. Multiple fitted ordinary villages may coexist; outposts use the configured square exclusion around successful final village anchors. Ordinary villages and Sky Villages retain separate placement owners. Cities retain their interior, burial and cavern checks. Strongholds, ocean monuments/ruins, unknown modded sets and local placed features retain their existing controls.

Owned igloos and desert pyramids retain their accepted island anchors through native placement and saving. Loot, optional igloo basements, temple traps and archaeology remain native. Placement-policy changes require a fresh world; saved generation identity prevents silent conversion. Recheck family routing, final-space exclusion, reference/locate behavior and physical content when updating Sky Archipelago or Minecraft. Do not infer useful structures from start counts alone.

## Resources, crops and loot

Foundation stone now uses one ordered rule processor: diamond first, emerald second, diorite third. The probabilities for later rules account for earlier matches: `0.00025`, `0.0015 / 0.99975`, and `0.2 / 0.99825`. These are nominal aggregate shares, not guaranteed quotas per building or village.

The original separate processors reused position-seeded random rolls. The first 20% diorite pass masked every later 0.5% diamond candidate, while approximately 4% of foundation stone became emerald ore. Native positive-control sampling confirmed the masked diamond rule. The combined pass fixes that defect while reducing mineral quantities enough that a settlement is not primarily an ore bank.

The 2026-10-22 survey placed 24 complete villages across seeds 1, 42, 8675309 and 20261023 above flat terrain, excluding natural ore. Native piece selection, processors and overlapping placement remained active. Villages had 30 to 83 pieces and bounds within Y 153 to 278.

| Resource per village   | Range   | Median | Total across 24 |
| ---------------------- | ------- | ------ | --------------- |
| Foundation diamond ore | 0 to 5  | 2      | 51              |
| Foundation emerald ore | 5 to 33 | 17     | 397             |
| Chest diamonds         | 0 to 3  | 0      | 17              |
| Chest emeralds         | 0 to 7  | 1      | 28              |

The 361 chest rolls are one no-player sample, not guaranteed seeded yields or multiplayer Lootr entitlements. Ore counts are blocks before Fortune or processing. A median foundation yields roughly one light delivery's 15 to 20 emerald reward before Fortune, with excavation and a finite supply. This is a balance judgment, not a measured comparison of mining and transport time. Keep these rates for playtesting; do not increase delivery payouts to compete with the old foundations.

All 24 villages retained wheat, carrots, potatoes and beetroot. The crop rules remain unchanged: nominal aggregate replacement shares are 30% carrots, 14% potatoes and 5.6% beetroot, leaving 50.4% wheat among processed wheat blocks. Whole-village crops also depend on template contents and placement; those rule shares are not predictions of the final harvest mix.

Eleven chest tables delegate to vanilla village loot; the twelfth is an optional Supplementaries urn table whose registration does not establish accessibility. Template names do not reliably predict chest contents: both libraries, the alchemist and one farm use weaponsmith loot alongside the two weaponsmiths. That table can supply diamonds, obsidian, iron equipment and other valuable loot. Chest loot remains a separate diamond route from the scarce foundation deposits. Lootr behavior and per-player loot multiplication still need a gameplay check.

Useful salvage is already broader than chest loot: one library contains 43 bookshelves, the alchemist has a Brewing Stand, a smithy has three lava blocks, and the mason template includes a spruce sapling. That sapling can start renewable resin production; it is not necessary to find a natural taiga first if this building is present and reachable. None of these templates is guaranteed per village.

## Placement policy

The intended placement is floating **beside** island clusters, with a horizontal void gap. Regular villages and ground structures belong on the terrain. Floating above an island does not satisfy this placement goal.

Sky Archipelago routes `skyvillages:skyvillage` through its SKY placement engine. Native air clearance alone does not establish proximity to an island. The ordinary upstream preset retains the resource pack's 70/65-chunk candidate spacing/separation; those values do not describe the Skyweave preset.

[Skyweave: Compatibility Patches](https://github.com/mannie-exe/skyweave-compat) shifts the village altitude into the host island band and assigns each anchor an independent allowance of zero to three Sky Villages, weighted `96:24:8:3`. Companions share their anchor's allowance. Approximately 73.3% of anchors receive zero before further rejection. This allowance is separate from the ground-village family; the broad `#minecraft:village` discovery tag includes both.

The marked preset uses four-chunk spacing and two-chunk separation. Candidates receive a coarse shaped-exterior screen, seeded ranking and minimum 384-block center separation. The complete native layout must then retain its assigned cluster, pass biome and air checks, avoid terrain overlap and leave a 64-block horizontal gap from all island terrain. A substantial body in that cluster must lie within 128 blocks of the final footprint, with native host radius at least 96. Detached fringes cannot qualify alone. The 16-block host-search grid can conservatively miss a narrow eligible edge. Rejection can leave an allowance unfilled; an allowance is not a promise of a village.

The common proximity controls live in `config/skyweave/skyweave_compat-common.toml`. Existing villages are not relocated. Loot and foundation tuning remain pack-owned. [Compat's placement reference](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/terrain.md#climate-and-villages) owns the detailed implementation and dependency-update contracts.

Village hooks require both Sky Villages and Architectury. ADQ's optional adapter retains the native dry-ground check, retries within the village, holds bounded chunk tickets through route finalization and checks horizontal route distance. Native tests generated and accepted an offer between distinct villages and spawned its cargo. Completed deliveries and cargo clearance still need playtesting. See [world generation](worldgen.md) and the mod's verification guide for samples and limitations.

Further tuning:

- Remeasure actual village counts per archipelago before changing the weighted allowance or candidate grid. An allowance is a maximum, not a guaranteed count.
- Keep the current foundation rates while reviewing repeated chest loot and salvage. Give libraries, farms and alchemist buildings appropriate loot through per-template processors; preserve weaponsmith loot for actual smithies. Keep crops and villager access useful instead of adding artificial recipe gates.
- Check Fortune, multiplayer Lootr yields and usable delivery endpoints before changing payout or trade rules. Delivery contracts move supplied cargo rather than consuming the player's agricultural output.

The expanded preset changes candidate selection and altitude; biome eligibility, loot, crops and progression rules remain pack-owned and unchanged. Existing chunks remain intact. The same seed reproduces terrain only while the relevant generator version and resolved settings also remain the same.

## Verification scope

The Sky Villages 1.0.6 JAR SHA-256 is `5ef7b63c6f1999a632085975afa14f00146369c142fd72980d760cbb617dd52f`. The 2026-10-22 isolated checks loaded 20 templates, resolved all 21 remaining pool references, registered 12 loot tables and confirmed village-tag membership. The repeatable survey uses `pnpm data:structures` followed by `pnpm data:compile` from `web/`. World & ores shows per-village resource counts, natural-start counts, provenance and limitations. Disposable worlds and logs are removed automatically; the compact generated dataset remains local Atlas data.

Natural testing used the same four public seeds, CONSISTENT 1,494-block cluster distance and the unchanged 70/65-chunk village distribution. Across a five-by-five candidate-cell grid around the origin for each seed, valid starts numbered 19, 19, 16 and 20: **74 of 100 candidates**. Two valid starts per seed were fully generated; all eight contained village beds and completed without shielded structure-placement failures. This establishes placement in the sampled worlds, not safe landings, universal biome coverage or a completed cargo delivery. The remaining 66 valid starts were inspected at structure-start stage only.

Controlled placements bypass biome eligibility and natural terrain. Natural bounding-box resource counts include island terrain and must not be reported as foundation yields. No survival playthrough or multiplayer Lootr test was performed.

The resource changes were introduced in 0.1.8; Skyweave: Compatibility Patches later replaced the separate neighbor mod. Updates preserve a world unless its operator chooses a reset. Existing chunks are not retrofitted. Structures Arise and broader structure tuning remain a separate pass. See [progression](progression.md) for the connected fuel, processing, trade and travel decisions.
