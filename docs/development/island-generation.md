# Island generation reference

This is the source-backed compatibility and tuning inventory for **Skyweave Islands**, `skyweave_compat:islands_v1`. [World generation](worldgen.md) owns operating policy, geology, climate and saved-world constraints; this page owns the descriptor axes and their combinations. It describes current code and authored defaults, not a new tuning decision or a measured biome-frequency survey.

## Scope and notation

Reviewed for Create: Skyweave 0.14.0: Minecraft 1.21.1, NeoForge 21.1.265, Sky Archipelago 1.4 and Skyweave: Compatibility Patches 0.33.0 (`94812e7`). The native Atlas registry/environment export was refreshed on 2026-11-12 UTC against the complete materialized server selection and the published Compat JAR. This export does not generate a terrain survey.

- `O`: the combination is permitted, subject to the row's stated conditions.
- `X`: that selection route is excluded. It does not mean an adjacent biome can never cross the island's footprint.
- `B/S`: baseline Sky Archipelago 1.4 / the marked Skyweave preset.
- `*`: Skyweave/Compat addition or changed behavior. `G*` identifies a Geophilic replacement of a vanilla biome definition, rather than a new biome ID.
- `†`: supported, but disabled by today's pack weight/chance. Re-enabling requires normal fresh-world generation-identity handling; support is not a fresh runtime qualification of every combination.

For baseline comparisons, use the native 1.4 selection code and new-world defaults, not the modpack's retained ordinary `eee` preset. That preset has its own river and spacing settings. Native new-world rivers are enabled; Skyweave's native rivers and lakes are disabled in favor of Dynamic Waters. Feature opt-outs, custom tags, other presets and saved settings can change these tables.

## Archetypes and effective selection

| Archetype | Environment | Native default weight | Skyweave weight | Basic intent |
| --- | --- | --: | --: | --- |
| CLASSIC | Land | 1 | 1 | Plateau/body with native taper and irregularity |
| BOWL_CRATER | Land | 1 | 1 | Bowl or crater top |
| CRESCENT | Land | 1 | 1 | Open crescent anchor |
| TERRACE | Land | 1 | 1 | Stepped top |
| LAGOON | Water | 1 | 1 | Enclosed wet interior and shore |
| REEF_RING | Water | 1 | 0*† | Ring reef |
| DEAD_OCEAN_SHELF | Water | 1 | 0*† | Exposed/dead shelf |
| BROKEN_OCEAN_REEF | Water | 1 | 1 | Broken, vertically varied reef cells |

Native land and water weights are separate pools. Current land weights are equal; Lagoon and Broken Ocean Reef split the admitted water pool equally. These are conditional weights, not whole-world percentages. Skyweave first requires the native `#sky_archipelago:spawn_ocean_islands` tag, currently `#minecraft:is_ocean`, then admits 20%* of eligible ocean candidates. A failed roll leaves no cluster; it does not substitute a land island. Activation and whole-cluster clearance also apply. The global ocean layer remains disabled; this does not disable floating water archetypes.

The eight names above are the native archetype enum. **NOISE/HOLLOW are interiors; FRACTURED/DEEP_DARK are exterior/ecology styles; COASTAL/PERIMETER are shoreline treatments; MIXED/DISINTEGRATING are fragment-fringe modes.** They are not twelve additional mutually exclusive island archetypes. A standalone spire is a descriptor family, separate from a fragment belonging to an anchor's fringe.

## Biomes and anchor selection

All IDs below have the `minecraft:` namespace. The retained Atlas native export contains 64 vanilla registry IDs and lists exactly these 53 as possible biomes of the marked Overworld preset. The export is from 2026-11-12 UTC; all 124 selected server mod JARs, the shared Resource Patches JAR and the current lockfile match its recorded hashes. Its extra exporter JAR is instrumentation. The Compat JAR is the published 0.33.0 artifact, SHA-256 `d170f8b4e603a173326d8cc0ff725355864acf370f6728db7dfbc5dabc953a70`. Current biome resources confirm Geophilic replaces 29 vanilla definitions without adding biome IDs. The preset still selects `minecraft:multi_noise` / `minecraft:overworld`. Structure biome tags from CTOV, T&T or YUNG's do not add climate-source biomes. A newly installed biome provider must be audited before extending this list.

The matrix is **host-selector eligibility**, not a one-biome-per-island painting promise. Host sampling uses native climate; Skyweave samples the displaced anchor at center Y plus its plateau height*. Other coordinates can cross climate boundaries. A biome's name does not import vanilla terrain geometry into this generator.

Column abbreviations: Cl = CLASSIC, Bo = BOWL_CRATER, Cr = CRESCENT, Te = TERRACE, La = LAGOON, Rr = REEF_RING†, Ds = DEAD_OCEAN_SHELF†, Br = BROKEN_OCEAN_REEF. `c` means the selector has no explicit cave-biome veto **if** its raw sample returns that biome. It does not establish cave-host occurrence at the configured elevated anchor heights; cave generation is qualified separately in the projection table. Shore biomes are explicitly replaced as hosts with `natural_shore_biomes_enabled=false`. River rows differ because the host resolver stops excluding rivers when native river generation is disabled; this is distinct from Dynamic Waters' channel painting.

| Biome ID | Sky Arch relief profile | Definition | Cl B/S | Bo B/S | Cr B/S | Te B/S | La B/S | Rr B/S | Ds B/S | Br B/S |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `badlands` | MESA | Vanilla | O/O | O/O | O/O | O/O | X/X | X/X | X/X | X/X |
| `bamboo_jungle` | ROLLING | G* | O/O | O/O | O/O | O/O | X/X | X/X | X/X | X/X |
| `beach` | FLAT | Vanilla | X/X | X/X | X/X | X/X | X/X | X/X | X/X | X/X |
| `birch_forest` | ROLLING | G* | O/O | O/O | O/O | O/O | X/X | X/X | X/X | X/X |
| `cherry_grove` | ROLLING | G* | O/O | O/O | O/O | O/O | X/X | X/X | X/X | X/X |
| `cold_ocean` | NEUTRAL | Vanilla | X/X | X/X | X/X | X/X | O/O | O/O | O/O | O/O |
| `dark_forest` | ROLLING | G* | O/O | O/O | O/O | O/O | X/X | X/X | X/X | X/X |
| `deep_cold_ocean` | NEUTRAL | Vanilla | X/X | X/X | X/X | X/X | O/O | O/O | O/O | O/O |
| `deep_dark` | NEUTRAL | Vanilla | Oᶜ/Oᶜ | Oᶜ/Oᶜ | Oᶜ/Oᶜ | Oᶜ/Oᶜ | X/X | X/X | X/X | X/X |
| `deep_frozen_ocean` | NEUTRAL | Vanilla | X/X | X/X | X/X | X/X | O/O | O/O | O/O | O/O |
| `deep_lukewarm_ocean` | NEUTRAL | Vanilla | X/X | X/X | X/X | X/X | O/O | O/O | O/O | O/O |
| `deep_ocean` | NEUTRAL | Vanilla | X/X | X/X | X/X | X/X | O/O | O/O | O/O | O/O |
| `desert` | FLAT | G* | O/O | O/O | O/O | O/O | X/X | X/X | X/X | X/X |
| `dripstone_caves` | NEUTRAL | Vanilla | Oᶜ/Oᶜ | Oᶜ/Oᶜ | Oᶜ/Oᶜ | Oᶜ/Oᶜ | X/X | X/X | X/X | X/X |
| `eroded_badlands` | MESA | Vanilla | O/O | O/O | O/O | O/O | X/X | X/X | X/X | X/X |
| `flower_forest` | ROLLING | G* | O/O | O/O | O/O | O/O | X/X | X/X | X/X | X/X |
| `forest` | ROLLING | G* | O/O | O/O | O/O | O/O | X/X | X/X | X/X | X/X |
| `frozen_ocean` | NEUTRAL | Vanilla | X/X | X/X | X/X | X/X | O/O | O/O | O/O | O/O |
| `frozen_peaks` | ALPINE | Vanilla | O/O | O/O | O/O | O/O | X/X | X/X | X/X | X/X |
| `frozen_river` | CHANNELLED | Vanilla | X/O* | X/O* | X/O* | X/O* | X/X | X/X | X/X | X/X |
| `grove` | ROLLING | G* | O/O | O/O | O/O | O/O | X/X | X/X | X/X | X/X |
| `ice_spikes` | NEUTRAL | Vanilla | O/O | O/O | O/O | O/O | X/X | X/X | X/X | X/X |
| `jagged_peaks` | ALPINE | Vanilla | O/O | O/O | O/O | O/O | X/X | X/X | X/X | X/X |
| `jungle` | ROLLING | G* | O/O | O/O | O/O | O/O | X/X | X/X | X/X | X/X |
| `lukewarm_ocean` | NEUTRAL | Vanilla | X/X | X/X | X/X | X/X | O/O | O/O | O/O | O/O |
| `lush_caves` | NEUTRAL | Vanilla | Oᶜ/Oᶜ | Oᶜ/Oᶜ | Oᶜ/Oᶜ | Oᶜ/Oᶜ | X/X | X/X | X/X | X/X |
| `mangrove_swamp` | CHANNELLED | Vanilla | O/O | O/O | O/O | O/O | X/X | X/X | X/X | X/X |
| `meadow` | FLAT | G* | O/O | O/O | O/O | O/O | X/X | X/X | X/X | X/X |
| `mushroom_fields` | NEUTRAL | Vanilla | O/O | O/O | O/O | O/O | X/X | X/X | X/X | X/X |
| `ocean` | NEUTRAL | Vanilla | X/X | X/X | X/X | X/X | O/O | O/O | O/O | O/O |
| `old_growth_birch_forest` | ROLLING | G* | O/O | O/O | O/O | O/O | X/X | X/X | X/X | X/X |
| `old_growth_pine_taiga` | ROLLING | G* | O/O | O/O | O/O | O/O | X/X | X/X | X/X | X/X |
| `old_growth_spruce_taiga` | ROLLING | G* | O/O | O/O | O/O | O/O | X/X | X/X | X/X | X/X |
| `plains` | FLAT | G* | O/O | O/O | O/O | O/O | X/X | X/X | X/X | X/X |
| `river` | CHANNELLED | G* | X/O* | X/O* | X/O* | X/O* | X/X | X/X | X/X | X/X |
| `savanna` | ROLLING | G* | O/O | O/O | O/O | O/O | X/X | X/X | X/X | X/X |
| `savanna_plateau` | ROLLING | G* | O/O | O/O | O/O | O/O | X/X | X/X | X/X | X/X |
| `snowy_beach` | FLAT | Vanilla | X/X | X/X | X/X | X/X | X/X | X/X | X/X | X/X |
| `snowy_plains` | NEUTRAL | G* | O/O | O/O | O/O | O/O | X/X | X/X | X/X | X/X |
| `snowy_slopes` | ALPINE | Vanilla | O/O | O/O | O/O | O/O | X/X | X/X | X/X | X/X |
| `snowy_taiga` | NEUTRAL | G* | O/O | O/O | O/O | O/O | X/X | X/X | X/X | X/X |
| `sparse_jungle` | ROLLING | G* | O/O | O/O | O/O | O/O | X/X | X/X | X/X | X/X |
| `stony_peaks` | ALPINE | Vanilla | O/O | O/O | O/O | O/O | X/X | X/X | X/X | X/X |
| `stony_shore` | NEUTRAL | G* | X/X | X/X | X/X | X/X | X/X | X/X | X/X | X/X |
| `sunflower_plains` | FLAT | G* | O/O | O/O | O/O | O/O | X/X | X/X | X/X | X/X |
| `swamp` | CHANNELLED | G* | O/O | O/O | O/O | O/O | X/X | X/X | X/X | X/X |
| `taiga` | ROLLING | G* | O/O | O/O | O/O | O/O | X/X | X/X | X/X | X/X |
| `warm_ocean` | NEUTRAL | Vanilla | X/X | X/X | X/X | X/X | O/O | O/O | O/O | O/O |
| `windswept_forest` | ALPINE | G* | O/O | O/O | O/O | O/O | X/X | X/X | X/X | X/X |
| `windswept_gravelly_hills` | ALPINE | G* | O/O | O/O | O/O | O/O | X/X | X/X | X/X | X/X |
| `windswept_hills` | ALPINE | G* | O/O | O/O | O/O | O/O | X/X | X/X | X/X | X/X |
| `windswept_savanna` | ALPINE | G* | O/O | O/O | O/O | O/O | X/X | X/X | X/X | X/X |
| `wooded_badlands` | MESA | G* | O/O | O/O | O/O | O/O | X/X | X/X | X/X | X/X |

### Projected biomes and never-generated biomes

A host `X` is not a claim of biome absence. Shore projection paints a bounded surface band on water islands; cave projection places underground biomes inside actual island bodies. Ordinary raw climate also remains spatially varied.

| Biome/route | Cl B/S | Bo B/S | Cr B/S | Te B/S | La B/S | Rr B/S | Ds B/S | Br B/S | Conditions |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `beach`: dedicated shore projection | X/X | X/X | X/X | X/X | O/O | O/O | O/O | X/X | Qualifying BEACH_SHORE column, not cold and not ROCKY |
| `snowy_beach`: dedicated shore projection | X/X | X/X | X/X | X/X | O/O | O/O | O/O | X/X | Qualifying BEACH_SHORE column and cold source climate; cold takes priority over ROCKY |
| `stony_shore`: dedicated shore projection | X/X | X/X | X/X | X/X | O/O | O/O | O/O | X/X | Qualifying BEACH_SHORE column, not cold and ROCKY |
| `river`, `frozen_river`: native river projection | O/X* | O/X* | O/X* | O/X* | X/X | X/X | X/X | X/X | Native land hydrology disabled in Skyweave; physical channels/eligible descriptor size required in baseline |
| `river`, `frozen_river`: Dynamic Waters channel painting* | X/O* | X/O* | X/O* | X/O* | X/X | X/X | X/X | X/X | Accepted land-body watershed, configured biome painting; true cold climate selects frozen river |
| `deep_dark`: native underground projection | O/O | O/O | O/O | O/O | O/O | O/O | O/O | O/O | Baseline: ANCHOR_PLATEAU, lower 45%, proxy Y=-48. Skyweave*: actual contributor exterior/cover and native remapped depth; no guaranteed city |
| `lush_caves`, `dripstone_caves`: relative projection* | X/O* | X/O* | X/O* | X/O* | X/O* | X/O* | X/O* | X/O* | Actual height-aware contributor exterior, minimum 16-block cover and native remapped depth; five other climate axes retain physical quart coordinates |
| `deep_dark`: fractured surface ecology* | X/O* | X/O* | X/O* | X/O* | X/X | X/X | X/X | X/X | Land anchor, cave adapter enabled, native Deep Dark proxy and 10% conditional draw |

The cave rows are not universal placement promises. Thin columns, contributor ownership, protected water seals and reference-depth bounds can exclude individual points. Raw cave biomes can also remain where the source returns them; `X/O*` above means no equivalent **dedicated relative projection**, not that vanilla cave IDs were removed from the baseline source. Shore temperature queries use Skyweave's reference climate height; they do not make all ocean islands tropical. Broken Ocean Reef emits DRY_REEF / DRY_SEABED projection metadata rather than BEACH_SHORE, so it does not use this dedicated beach projector. A shoreline biome crossing its footprint from another contributor is a separate case.

| Never-generated group in this Overworld preset | Status and reason |
| --- | --- |
| Members of the 53-biome Overworld set | None identified as categorically absent from all source/projection routes. This is a possibility audit, not evidence that every seed contains all 53 on usable terrain. |
| Additional modded biome IDs | None in the inspected registry/resources. Geophilic changes existing IDs. Installing a mod is insufficient unless its biomes enter the selected source or a qualified projector. |
| Registered biomes outside the Overworld set | Excluded from this inventory and selected climate preset. Nether/End and `the_void` are not selectable Overworld hosts here. |

Not being an anchor host is therefore a different state from never generating. No biome has been silently deleted or enabled by this audit.

## Shaping parameters

Paths in this and the next table are relative to `overrides/common/config/skyweave/`. `shapes`, `interiors` and `oceans` mean the corresponding `skyweave_compat-*.json`. Native embedded settings are in Compat's `packs/terrain/data/skyweave_compat/worldgen/world_preset/islands_v1.json` resource. The authored installation files and validators own the actual values; tables must be rechecked when those owners change.

| Function/control | Baseline 1.4 | Skyweave value/behavior | Owner and constraint |
| --- | --- | --- | --- |
| Native horizontal archetype and vertical body | Native outline, rim, erosion and land/water intervals | Retained; no second custom taper implementation | Native descriptor/shape/density evaluation |
| Surface relief | Native macro/medium noise plus biome-dependent relief | Embedded `terrain_relief_scale=1`; Compat requires 0–1* | Embedded terrain settings and `GenerationConfiguration`; not a body-height multiplier |
| Outline elongation* | Native independently varied descriptor radii | `aspectChance=.65`, `maximumAspectRatio=1.96` | `shapes.outline`; seeded area-preserving elongation, not an exact land-area guarantee |
| Broad outline warp* | Native local shape noise | `warpAmplitude=26`, `warpWavelength=102` | `shapes.outline`; composes with native masks and reserved bounds |
| Per-island strength variation* | Native seeded variation | `strengthVariation=.15` | `shapes`; independent draws around authored strength |
| Fringe enable and mixed sectors* | No Compat fringe | Enabled; `minimumSmoothFraction=.3`, `maximumSmoothFraction=.7` | `shapes.fringe`; granular sectors add terrain outside the retained useful body |
| Fringe falloff* | No Compat fringe | `falloffDistance=64`, `falloffExponent=1.2` | `shapes.fringe`; maximum reach also capped by radius |
| Disintegration selection/reach* | No Compat fringe | `disintegratingChance=.15`, `disintegratingScale=1.6` | `shapes.fringe`; conditional on fringe-eligible descriptors, not 15% of all clusters |
| Fragment cell scale and thinning* | Native body erosion only | `fragmentScale=28`, `density=.55` | `shapes.fringe`; seeded lobes shrink/thin outward rather than uniform rings |
| Fragment depth/underside accent* | Native body taper | `fragmentDepthRatio=.6`, `undersideAccent=6` | `shapes.fringe`; own bounded fragment interval, not an anchor underside replacement |
| Fractured land admission* | No Compat FRACTURED style | `.35` on Mushroom Fields and the three Badlands IDs | `shapes.fractures`; land anchors only, after Deep Dark choice |
| Fracture geometry* | Native Broken Reef is a water archetype | `cellSize=72`, `gapWidth=6`, `verticalRange=32`, `removalChance=.28` | `shapes.fractures`; independently composed broken land, not a repurposed water enum |
| Deep Dark ecology* | Native buried projection | `deepDarkChance=.1`; deepslate body, coherent sculk cap and bounded HOLLOW cavern | `shapes.fractures` selects; `shapes.deepDark` owns cap/devices; no required city |
| Interior selection* | Native baseline body/classic carvers | `noiseChance=.55`, `hollowChance=.18`, remainder baseline; special Deep Dark uses HOLLOW where the shell fits | `interiors`; descriptor and local thickness constraints below |
| Interior shell/noise* | No Compat cavity fields | Shell 12; horizontal/vertical noise 64/32; passage `.075`, chamber `.48` | `interiors`; subtract per contributor before union |
| Hollow dimensions/openings* | No Compat HOLLOW style | Radius `.58`, height `.24`, opening chance `.35` | `interiors`; native exterior/geological frame retained |
| Skylights* | No Compat irregular hollow skylight | Enabled; NOISE opt-in false; radius 6, warp `.25`, aspect variation `.25` | `interiors.skylights`; opening needs eligible interior and clearance |
| Ocean admission and weights* | Tag eligibility and native weights | Admission `.2`; Lagoon/Reef Ring/Dead Shelf/Broken Reef = `1/0/0/1` | `oceans`; failed ocean draw is void |
| Lagoon shoreline selection* | Native water geometry | Coastal `.25`, Perimeter `0†`, Native remainder `.75` | `oceans`; only Lagoon, independent of fringe |
| Shoreline geometry* | Native seals/rims | Opening 100°, shoulder 20°, outlet depth 2, seal thickness 4 | `oceans`; coast geometry, not independent island-size generation |
| Classic carvers | Native stage | `nativeCarvers=true`, using relative geology* | `interiors` and carver adapter; separate from NOISE/HOLLOW |
| Local water | Native rivers/lakes available | Native off; Dynamic Waters watersheds and lakes, density HIGH* | `rivers`, `dynamicwaters-common.toml`; one qualified hydrology owner |

The fragment reach ceiling is `min(falloffDistance × modeScale, maxRadius × .8)`. Outline/warp can increase conservative support bounds without increasing useful land proportionally. Shape-profile validators bound aspect to 1–2.5, broad warp to 0–48 and falloff to 0–256; changing a number still requires validating bounds, clearance and resulting generation identity. Interpolation cannot substitute for exact thin-fragment/cavity evaluation.

## Sizing and placement parameters

| Function/control | Baseline 1.4 | Marked Skyweave preset* | Ownership / effect |
| --- | --- | --- | --- |
| Dimension envelope | Preset/noise-settings dependent | `[-128,768)` | Dimension type and noise settings; not a live server height change |
| Candidate grid | Native CONSISTENT/DYNAMIC spacing | `spacing=2400` | `generation`; embedded serialized spacing is a capped placeholder |
| Center displacement | Native per-axis jitter `max(10, spacing/3)` | `jitter=750` per axis | `generation`; deterministic source cell and seed |
| Activation | Native `island_density` | `.85` | Before biome admission and clearance, not final occupied-cell fraction |
| Anchor center range | Native LOW/MID_HIGH/VERY_HIGH bands | Requested Y 200–490, intersected with safe body band | `generation.centerMinY/centerMaxY`; actual height-band label no longer directly sets altitude |
| Anchor radius | Native RANDOM or weighted SMALL/MEDIUM/LARGE profile | Independent X/Z draws 270–370 before elongation | `generation.anchorMinRadius/anchorMaxRadius`; not exact shoreline or diameter |
| Anchor plateau | Native family/archetype sizing | 28 | `generation.anchorPlateau`; relief added separately |
| Anchor nominal height | Native size/body calculations and thickness ceiling | Cluster draw 250–400 | `generation.anchorMinHeight/anchorMaxHeight`; converted to cliff depth, mostly below top |
| Anchor cliff conversion | Native descriptor | `round(((height-3.2)/1.18 - plateau)/.97)` | `GenerationProfile.cliffDepth`; approximation of native full-coverage depth |
| Ordinary companion radius | Native size-band/family calculations | X/Z 40–110 | `generation.companionMinRadius/companionMaxRadius` |
| Companion orbit | Native shape/size/tier orbit | 470–680 | `generation.companionMinOrbit/companionMaxOrbit`; also used by separate spires |
| Companion altitude | Native band/clamp policy | Offset -60…+50, fitted to envelope | `generation.companionMinOffsetY/companionMaxOffsetY`; never clip after placement |
| Companion body | Native family formula | Plateau 14, cliff depth 40–90, nominal hang 28 | `IslandGeometry`; fixed implementation constants, not existing UI controls |
| Separate spire size/body | Native factory exists; not added by native cluster-plan builder | Radius 12–28, plateau 6, cliff 95, nominal hang 28 | `IslandGeometry` + `ClusterPlacementMixin`; actual plans added by Compat |
| Native hang budget | Descriptor/family and evaluator limits | Anchor nominal 48, others 28 | Retained native effective cap can be smaller; descriptor hang is not a promised hanging spike length |
| Minimum cluster gap | Native anchor-focused exclusion checks | 350 between conservative complete cluster supports | `generation.minimumClusterGap`; structures/trees are outside the guarantee |
| Floor/build clearance | Native preset-dependent | 32 above floor / 200 reserved above terrain | `generation.floorClearance/buildingHeadroom`; tallest target currently requires center Y≥338 |
| Ocean companion clearance | No native wet satellites/planned spires | Spires enabled, minimum native wet/fringe clearance 16 | `oceans.spireCompanions/spireClearance`; ordinary wet satellites remain excluded |
| Native height-band weights | Native sampled band changes altitude and companion counts | Retained labels/weights `.15/.75/.10`; offsets -18/+12 | Embedded terrain settings; band still affects companion count, but Compat replaces coordinate choice |
| Native size-band weights | Native sampled band changes actual radius | Embedded SMALL 10–173 at `.34`, MEDIUM 174–336 at `.33`, LARGE 337–500 at `.33` | Retained metadata; Compat actual radii come from `generation`, not these ranges |
| Cluster tier | GRAND `.18`, STANDARD `.54`, SCATTERED `.28` | Retained | Native `IslandClusterSampler`; count formula below |
| Companion enable | Native `cluster_companion_islands_enabled` | Retained enabled default | Embedded advanced settings; also gates Compat spire planning |
| Vertical overlap | Native VOID/CRATER/OVERLAP policies | Explicit OVERLAP | Embedded advanced settings; retains bodies before per-contributor cavity composition |

Native tier ranges before height-band adjustment: GRAND has 5–8 satellites and 1–2 spires; STANDARD 3–6 and 0–1; SCATTERED 2–4 and 0–1. LOW subtracts one satellite and spire; VERY_HIGH adds one spire and adds a satellite only for GRAND. Satellite minimum is one in LOW and two otherwise; spires clamp to 0–3. These are requested counts. Water anchors do not get ordinary satellites; wet spire clearance can reject requested spires. Native 1.4's plan builder does not itself emit spires despite carrying their count/factory metadata.

Current profile limits include radius ≤500, target height ≤600, spacing ≤16384, `2*jitter < spacing` and a conflict neighborhood of at most eight cells. They are validation limits, not approved new defaults. Increasing mountain relief would also need a new vertical support/envelope proof; merely raising these values cannot make the surface a mountain range.

## Archetype × metadata compatibility

These tables describe supported combinations, including weight-zero modes. A cell with `O*` is a Compat capability, not a guarantee of selection today. Where only O/X appears, the column/row origin identifies ownership. Conditions remain authoritative; do not infer the Cartesian product is always realizable.

### Family and cluster companions

Here the row is the **parent anchor archetype**. A wet parent's added spire is a CLASSIC descriptor*, not a tiny Lagoon. A land companion retains the parent's archetype enum, although dedicated crescent/water anchor shaping is role-gated.

| Parent archetype  | Anchor B/S | Ordinary SATELLITE B/S | Separate SPIRE B/S |
| ----------------- | ---------- | ---------------------- | ------------------ |
| CLASSIC           | O/O        | O/O                    | X/O*               |
| BOWL_CRATER       | O/O        | O/O                    | X/O*               |
| CRESCENT          | O/O        | O/O                    | X/O*               |
| TERRACE           | O/O        | O/O                    | X/O*               |
| LAGOON            | O/O        | X/X                    | X/O*               |
| REEF_RING†        | O/O        | X/X                    | X/O*               |
| DEAD_OCEAN_SHELF† | O/O        | X/X                    | X/O*               |
| BROKEN_OCEAN_REEF | O/O        | X/X                    | X/O*               |

### Outline and fringe

All eight retain native body rotation/shape. Seeded area-preserving elongation, broad warp and the following fringe modes are Compat additions. Each archetype permits elongation and broad warp; enabling them does not force identical aspect or displacement on every descriptor. Fringes exclude the SPIRE family.

| Archetype | Native body only / fringe NONE | MIXED* | DISINTEGRATING* |
| --- | --- | --- | --- |
| CLASSIC | O | O* | O* |
| BOWL_CRATER | O | O* | O* |
| CRESCENT | O | O* | O* |
| TERRACE | O | O* | O* |
| LAGOON | O | O* | O* |
| REEF_RING† | O | O* | O* |
| DEAD_OCEAN_SHELF† | O | O* | O* |
| BROKEN_OCEAN_REEF | O | O* | O* |

With current positive fringe settings, eligible non-spire descriptors select MIXED or DISINTEGRATING. NONE is the disabled/ineligible path, not an additional random roll. Each added fragment retains parent identity/geology; it is not a separate cluster. Native wet silhouettes constrain fringe placement, and the coastal cove mouth remains clear. Ocean fragments use the wet body's material provenance rather than an unrelated grassy palette*.

### Exterior/ecology style

| Archetype         | NATIVE | FRACTURED* | DEEP_DARK* |
| ----------------- | ------ | ---------- | ---------- |
| CLASSIC           | O      | O*         | O*         |
| BOWL_CRATER       | O      | O*         | O*         |
| CRESCENT          | O      | O*         | O*         |
| TERRACE           | O      | O*         | O*         |
| LAGOON            | O      | X          | X          |
| REEF_RING†        | O      | X          | X          |
| DEAD_OCEAN_SHELF† | O      | X          | X          |
| BROKEN_OCEAN_REEF | O      | X          | X          |

FRACTURED needs one of the four configured host biome IDs. DEEP_DARK needs the proxy climate and cave adaptation; it wins before the ordinary fracture roll. Both apply to land anchors, not satellites/spires. A fractured style can still have a mixed/disintegrating fringe and an eligible NOISE/HOLLOW interior. Fractured HOLLOW and special Deep Dark bodies carry the parent chamber through their admitted cell shifts and expose it at physical cuts; added fringe lobes retain BASELINE interiors. Shell thickness protects surviving parent caps and outer shoulders rather than lining each fractured cell. The 10% draw is **among eligible land anchors**, not a global island probability. No Ancient City is guaranteed by the style.

### Interior and skylight

| Archetype | BASELINE | NOISE* | HOLLOW* | HOLLOW skylight* | NOISE skylight*† |
| --- | --- | --- | --- | --- | --- |
| CLASSIC | O | O* | O* | O* | O* |
| BOWL_CRATER | O | O* | O* | O* | O* |
| CRESCENT | O | O* | O* | O* | O* |
| TERRACE | O | O* | O* | O* | O* |
| LAGOON | O | O* | O* | O* | O* |
| REEF_RING† | O | O* | O* | O* | O* |
| DEAD_OCEAN_SHELF† | O | O* | O* | O* | O* |
| BROKEN_OCEAN_REEF | O | O* | O* | O* | O* |

Interior selection requires descriptor cliff depth ≥4×shell thickness (48 at current defaults). There is no blanket water- or spire-family exclusion in that selector. Local thin fractured remnants fall back to BASELINE; added fringe columns always do. Wet seals and accepted river beds survive cavity subtraction. A skylight still needs an eligible actual cavity/clearance: O does not promise a hole through protected water. BASELINE means no Compat cavity subtraction, not absence of native carvers. NOISE skylights are supported but default off.

### Shoreline treatment

| Archetype         | NONE | NATIVE | COASTAL* | PERIMETER*† |
| ----------------- | ---- | ------ | -------- | ----------- |
| CLASSIC           | O    | X      | X        | X           |
| BOWL_CRATER       | O    | X      | X        | X           |
| CRESCENT          | O    | X      | X        | X           |
| TERRACE           | O    | X      | X        | X           |
| LAGOON            | X    | O      | O*       | O*          |
| REEF_RING†        | X    | O      | X        | X           |
| DEAD_OCEAN_SHELF† | X    | O      | X        | X           |
| BROKEN_OCEAN_REEF | X    | O      | X        | X           |

COASTAL opens a bounded cove in the native Lagoon shore. PERIMETER lowers the rim for overflow; its chance is zero. Neither replaces the native body with a second basin generator. Shoreline and fringe are independent: Lagoon can have COASTAL + MIXED, for example. The old word “apron” denotes this added fringe; it is not another shoreline or a replacement for the native taper.

### Hydrology ownership

| Archetype | Native local river/lake capability | Native wet habitat | Skyweave Dynamic Waters cut* |
| --- | --- | --- | --- |
| CLASSIC | O | X | O* |
| BOWL_CRATER | O | X | O* |
| CRESCENT | O | X | O* |
| TERRACE | O | X | O* |
| LAGOON | X | O | X |
| REEF_RING† | X | O | X |
| DEAD_OCEAN_SHELF† | X | O | X |
| BROKEN_OCEAN_REEF | X | O | X |

These are capabilities, not simultaneous active owners. The pack disables native local rivers/lakes. Dynamic Waters planning excludes water archetypes and detached fringe columns; wet anchors keep native habitat water, beds and seals. River cuts still need actual eligible land support and enough size/drainage. A native ocean mouth and a void discharge have different support rules. No natural-dam system has been implemented.

### Native labels retained across archetypes

| Archetype | LOW | MID_HIGH | VERY_HIGH | RANDOM size | SMALL | MEDIUM | LARGE | GRAND | STANDARD | SCATTERED |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CLASSIC | O | O | O | O | O | O | O | O | O | O |
| BOWL_CRATER | O | O | O | O | O | O | O | O | O | O |
| CRESCENT | O | O | O | O | O | O | O | O | O | O |
| TERRACE | O | O | O | O | O | O | O | O | O | O |
| LAGOON | O | O | O | O | O | O | O | O | O | O |
| REEF_RING† | O | O | O | O | O | O | O | O | O | O |
| DEAD_OCEAN_SHELF† | O | O | O | O | O | O | O | O | O | O |
| BROKEN_OCEAN_REEF | O | O | O | O | O | O | O | O | O | O |

RANDOM is an alternative size-selection mode, not a fourth draw in a weighted SMALL/MEDIUM/LARGE pool. Skyweave's actual radii and elevations use its geometry profile; the native labels survive in descriptors and count rules. “Large” here does not enable the deferred 4–6 km Gargantuan island idea.

## What the descriptors actually say

| Metadata | Native owner / meaning | Skyweave composition* / limitation |
| --- | --- | --- |
| Source cell, layout seed | `ClusterDescriptor` identity and reproducible draws | Displaced center is not source identity; companions retain cell ownership |
| Center, base rotation | Cluster position/orientation | Actual geometry profile replaces center coordinates; native rotation retained |
| Height band, size band, tier | Cluster recipe and count policy | Labels are not authoritative realized altitude/radius measurements |
| Archetype and family | Horizontal/body intent and role | Orthogonal to interior, ecology, shoreline and fringe |
| Satellite/spire counts | Requested recipe counts | Wet satellites excluded; spires explicitly materialized by Compat and may fail clearance |
| Radii, plateau, cliff, hang, tail, erosion | `IslandDescriptor` local geometric parameters | Native masks, relief, rotation and added modifiers determine actual intervals |
| Terrain-plan seeds and bounds | `IslandTerrainPlan` accelerated influence queries | Conservative bounds include extra outline/fringe reach; not solid ground |
| Horizontal sample and prepared density | Native per-column mask/body/wet evaluation | Added fringe/remnant metadata compose here; a radius test is insufficient |
| Solid intervals/contributors | Evaluated terrain and ownership | Cavity subtraction per contributor then union; one top value cannot describe stacked bodies |
| Shoreline/fringe/style | Not native descriptor enum fields | `IslandComponents`, `IslandStyles`, `ShapeProfile` and ocean policy; resolved alongside descriptors |
| Interior | Not a native archetype | `IslandInteriors` choice plus point-specific protection/clearance |
| Geological/climate frame | Different reference responsibilities | Shared anchor-relative resource geology; contributor-relative native biome depth and thermal altitude; neither rewrites physical world Y |
| Complete snapshot and saved chunks | Generated prediction versus realized blocks | Features, structures and gameplay can change saved blocks; do not conflate stages |

This metadata is useful for selecting and locating candidates. It does not prove that a building's foot touches terrain, water has flowed, a mountain exists or all queried chunks have been generated. Compat's support pass separately captures natural material before neighboring features, applies bounded contributor-aware grading and shallow fills, and verifies final required contacts after feature closure. Its candidate refusals, material proofs and native doorway checks are separate evidence; this descriptor audit does not certify a whole village or navigable road network.

## Mountain relief and future terrain work

The named relief profiles in the biome table (ALPINE, ROLLING, FLAT, MESA, CHANNELLED and NEUTRAL) belong to Sky Archipelago's `BiomeTerrainShaper`, not Minecraft's native terrain pipeline. Vanilla combines continuous climate/noise fields through terrain splines and density functions; it does not select these named profiles from biome IDs.

Sky Archipelago does select mountain biomes and an ALPINE terrain profile. That alone does not use vanilla/Tectonic mountain shaping. In the inspected land density evaluator, top relief combines native noise terms scaled by 7.5 and 9, plus `biomeMacro × macroReliefScale × 7 × terrain_relief_scale × .92`, before archetype adjustments. Increasing nominal island height mostly increases body depth below the top. A tall island is therefore not a tall mountain above its plateau. The profile record also contains ridge/basin/channel fields; their names alone are not evidence that all become equivalent independent surface controls.

The preferred experiment is an independent, bounded **surface-relief provider**: reuse qualified vanilla/Tectonic ridge/valley signals in island-local coordinates, scale wavelengths to useful island size and reserve their vertical range before placement. Keep horizontal silhouette, underside, interiors and ecology separate. Update actual density, base columns, material surfaces, hydrology, climate/geology, structure fitting and locator views together. Adding a post-surface hill or raising `terrain_relief_scale` outside Compat's envelope would bypass those contracts.

[Tectonic](https://github.com/Apollounknowndev/tectonic) is a possible relief/data provider, not a replacement village assembler. Its large continental wavelengths need explicit local composition; its global sea/fluid/height/climate hooks must not take ownership accidentally. A native NoiseBasedChunkGenerator-based island pipeline can reuse more Minecraft stages, but must still implement island support, local water and relative-world assumptions. It does not automatically solve every mod integration. The immediate shared support/realization repair and a deferred native pipeline are separate goals. No new mountains or generation defaults have been approved or implemented by this reference.

## Source owners and update checks

Rebuild this audit when generation providers, source biome set/tags, embedded preset, configuration validators or any metadata axis changes. Compare resolved settings, not just a raw preset JSON: `GenerationConfiguration.resolve` replaces water weights and rivers; geometry adapters replace native sizing/coordinates. The retained embedded `rivers.enabled=true` is not the effective setting.

| Concern | Inspected source owner |
| --- | --- |
| Native enum and recipe | Sky Archipelago `IslandShapeArchetype`, `ArchetypeSettings`, `IslandClusterSampler`, `IslandDescriptorFactory`, `IslandField.createClusterTerrainPlans` |
| Native biomes/relief | `BiomeSample`, `BiomeTerrainShaper`, `HostBiomeCache`, `RiverHostBiomeResolver`, `ShoreHostBiomeResolver`, `IslandDensityEvaluator` |
| Stored/projected biomes | `SkyIslandDeepDarkBiomeProjector`, `SkyIslandWaterArchetypeBiomeProjector`; Compat `CaveProjection`, `CaveBiomeMixin`, `ProjectedCaveBiomeMixin`, water/climate adapters |
| Marked defaults | [Authored configs](../../overrides/common/config/skyweave/), Compat embedded preset and `GenerationConfiguration` |
| Geometry/layout* | Compat `GenerationProfile`, `IslandGeometry`, `ClusterPlacementMixin`, `ClusterLayout` |
| Modifiers* | `ShapeProfile`, `IslandStyles`, `IslandComponents`, `FragmentFringes`, `IslandInteriors`, `OceanProfile`, `OceanIslands`, `OceanPerimeter` |
| Water* | `IslandWaterTerrain`, `IslandWaterColumns`, `RiverConfiguration`; Dynamic Waters configuration and bridge |
| Runtime evidence limit | Atlas registry/environment export dated 2026-11-12 UTC, checked against the complete selected server artifact hashes and lockfile; current archive/data inspection. No all-seed/combination terrain survey. |

Detailed implementation ownership remains in Compat's [terrain](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/terrain.md), [terrain variation](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/terrain-variation.md) and configuration docs. [Patch maintenance](patches.md) owns dependency qualification; [terrain candidates](worldgen-candidates.md) owns content adoption, including deferred Tectonic work. Retain compact source/check evidence privately; do not commit third-party JARs or decompiled sources with this reference.
