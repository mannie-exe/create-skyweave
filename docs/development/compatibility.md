# Compatibility and verification

This reference describes constraints behind the current pack configuration.
Player instructions belong in [graphics](../players/graphics.md) and
[server maintenance](../players/server.md). Exact versions are in the
[content list](../MODLIST.md), with authoritative selections in `empack.yml` and
`empack.lock`.

## Linear Bearing

Linear Bearing 1.3.5 and Linear Bearings Fix 1.0.3 use Compat 0.9.0's optional
carriage, transmission and gyro adapters. The companion owns dedicated startup
and bubble-gum loot; Compat suppresses its overlapping bootstrap repair. Keep the
companion while the provider declares it required.

The guide remains passive, with a redstone brake capturing its current relative
pose. Magnetic and spring links are native Create network edges, including real
load and stalling. The gyro is an angular-rate signal with zero stress capacity.
Checked assembly and aligned empty-hand recovery preserve cargo and refuse
occupied destinations. No recipes, weights or hidden actuator are added.

The [mod's machinery reference](https://github.com/mannie-exe/create-sky-compat/blob/v0.9.0/docs/development/linear-bearing.md)
owns the contracts and dependency-update procedure. Native tests cover free/braked
motion, multiple orientations, moving parents, recovery, cold reload, driven
coupling controls, overload and source removal. An isolated client also exercised
assembly, braking, recovery and reopening. Old upstream injected-source network
saves and arbitrary foreign assembly exceptions remain outside that evidence.

## Rain audio

Cool Rain Reforged 1.0.2 and Sable Cool Rain 1.0.1 are client-only. They add
surface-dependent rain audio and copied-material/Sable surface handling, without
recipes, weights or a progression gate. Base rain sounds use the existing
Weather volume category. No separate gameplay configuration is registered.
The exact release JARs matter: the base mod's current source branch targets a
newer weather renderer than the selected Minecraft 1.21.1 release.

The isolated full client reached the menu, and its exported `LevelRenderer`
bytecode contains calls to both bridge hooks, including the material-return
adapter. This verifies actual injection despite their optional `require=0`
selectors. It does not establish audio balance, shelter behavior or moving-ship
sound positioning. Sable already handles plot-coordinate sound distance; do not
add a second coordinate conversion based only on source-space positions.

## Colorwheel

The manifest selects client-only Colorwheel 1.3.0+mc1.21.1 with Compat
0.9.0. Minecraft, loader, Iris, Sodium, Create, Sable and shader versions remain
pinned. Explicit client placements keep Colorwheel, Iris and Sodium out of server
exports. Client file names and existing renderer bytes are preserved.

Compat supplies terrain/emission metadata on Sable's direct non-AO model path
and releases unused OIT sampler slots when Colorwheel's own renderer guard
disables OIT. On the tested Apple driver, the unadapted embedded translucent
program failed at `shadowtex0`; the adapted selection renders with the current
Complementary/Euphoria configuration unchanged. Do not replace supported OIT
allocation or disable shaders to mask that failure.

Native checks cover shader on/off backend selection, static and assembled glass /
Copycats, moving Sable/Create geometry, press/propeller Ponder, a Macaw lamp,
shader reload, and minimum optional loading. Full dedicated-server startup selects
no client hooks. See the [exact verification and limits](https://github.com/mannie-exe/create-sky-compat/blob/v0.8.0/docs/development/verification.md#release-080).
No measured performance gain or general shadow repair is claimed. Keep patch
retirement tied to the actual released Colorwheel/Sable implementations.

## Moving lights

The pack includes client-only Sable Dynamic Lights 2.0.1 (`vjb0hAWB`) and
LambDynamicLights 4.8.11+1.21.1 (`ksaGCvSu`) with Compat's
`lighting.lifecycle` and `lighting.sodium` adaptations explicitly enabled.
SDL owns moving Create/Sable sources; Compat repairs the selected Sodium lookup,
keeps their light client-local and clears source owners across unload/disconnect.
No server mod or authoritative lighting change is required.

Lamb's exact universal JAR is URL-pinned because its catalog requires Fabric API
even though the artifact bundles a native NeoForge runtime and its supporting
libraries. Both new JARs match the SHA-256 hashes used in the earlier
[Compat lighting checks](https://github.com/mannie-exe/create-sky-compat/blob/v0.8.0/docs/development/lighting.md#artifacts-and-updates).
Keep that pair aligned with Compat's exact version guards. Do not add another
Fabric API or a competing dynamic-light engine for this integration.

Native lighting evidence covers moving and nested contraptions, source removal,
dimension travel and client/server light separation. It does not prove complete
wall occlusion or fix the unreproduced upstream hang. Keep new pack verification
separate from those earlier renderer observations.

## Pack verification, 0.1.24

The 30 pack Python tests, journal generation, 242-file configuration audit and
maintained resource checks pass. The accepted journal baseline adds four equipment
entries; all 75 previous native chapter/quest definitions have identical mechanics.
All three reference profiles build. Archive checks confirm 70 managed entries,
Linear/Fix on both sides, client-only SDL/Lamb and renderer/audio mods, server-only
BlueMap, embedded asset hashes, unique entries and valid CRCs. Unix launcher patch
verification passes. Only Compat changed among existing dependency records; four
new dependencies were added.

The Atlas recaptured the complete materialized server selection and decoded all
70 entries. Its [verification](web/verification.md#materialized-pack-inputs-2026-10-31)
owns snapshot counts and app checks. This does not establish every quest operation
or a survival playthrough. The mod's native fixtures provide the separate carriage,
transmission and gyro evidence linked above.

## Pack verification, 0.1.23

The selected pack without Linear Bearing or its companion passed all 30 pack
Python tests, the 242-file configuration audit, journal/resource generation checks
and all three reference builds. Archive checks verified dependency removal,
client/server placement, asset hashes, managed journal definitions and preserved
seed-file policies. The isolated dedicated fixture decoded 66 entries and checked
the four new backpack entries' condition handlers, persistence and manual rewards.
It shut down normally. Action advancements were granted for handler checks;
actual backpack use and rain-audio quality still need gameplay review.

## Journal adaptation, 2026-10-31

Create Sky 0.1.22 selects Compat 0.7.0 with independent Questlog interface,
notifications and reward-validation switches. Native Questlog artwork and ink
colors replace the old partial resource reskin. Grouped bookmark preferences are
client-local; authoritative claim validation runs on the server. Quest content,
terrain and LOD settings are unchanged.

Compat passed 73 unit cases, package/pin checks, five dedicated loading/shutdown
selections and isolated minimal/full-pack client checks. Actual reward collection
also works with an unadapted Questlog server. Spoken narration and arbitrary
third-party reward implementations remain unverified. The
[mod verification](https://github.com/mannie-exe/create-sky-compat/blob/v0.7.0/docs/development/verification.md#release-070)
owns artifact identifiers and detailed limits.

## Rendering baseline, 2026-10-29

Create Sky 0.1.20 selects Compat 0.6.1 and removes standalone Veil Iris Fix.
`create_sky_compat-features.properties` explicitly selects pack behavior; the cache
identity option remains off. Compat's own minimum installation needs NeoForge
alone. Disabled adapters select no target mixins, callbacks, or integration data,
and do not reject target versions. Terrain identity remains protected.

Compat 0.6.1 passed 64 JUnit cases, five release-tool checks, exact artifact/package
checks, and standalone/full dedicated-server startup and shutdown. The 0.6.0
boundary matrix passed seven selections, and native minimal island generation /
reopen retained ore counts. No generation algorithms changed in 0.6.1.
See [the exact artifacts and limits](https://github.com/mannie-exe/create-sky-compat/blob/v0.6.1/docs/development/verification.md#release-061).

Full-stack Prism checks on macOS arm64 used Complementary Unbound r5.9.3 and
Euphoria Patches 1.10.5. Ponder, shader toggling/reload, heated balloon fixtures,
static/assembled material controls, and a minimum Compat-only client were reviewed.
Single-block glass and glass Copycats disappeared with shaders when their pass
adaptation was disabled; enabling it restored them. Balloon telemetry confirmed
valid envelopes and filled volume, but the old misplaced overlay was not reproduced
in the disabled control. That guard has source and controlled execution evidence.

Flickering/gapped airship shadows were not reproduced and remain unresolved. These
checks do not establish every shader, driver or special block model. Existing
nonfatal upstream diagnostics remain. No machine weights, recipes or core physics
changed. Offline quickplay/LAN shutdown needed the disposable probe's explicit
server stop; no production shutdown workaround was added from that observation.

## DH Polygon Fix

Clients include [DH Polygon Fix 1.0.2](https://github.com/mannie-exe/dh-polygon-fix/releases/tag/v1.0.2)
with the original DH 3.3.3 JAR. It backports upstream !126's two-integer
polygon-mode query. The earlier scalar query overwrote an adjacent canary on
Apple OpenGL and Linux/Mesa and could cause delayed native JVM crashes.

The patch requires exactly DH 3.3.3. Remove it when upgrading DH and verify the
replacement includes the upstream fix. Keep it client-only across supported
platforms; dedicated servers do not need it. SSRD interfaces are unchanged.

Version 1.0.2 retains the 1.0.1 runtime implementation and adds documentation and
release-tool checks. Version 1.0.1 moved the namespace to `design.inherent`. Transformation, missing/duplicate target, server exclusion,
three-OS builds and Apple/Mesa native probes passed. See the
[release evidence](decisions.md#rendering)
for the tested scope.

## World generation

Sky Archipelago requires LODs from its actual island chunks. The pack uses
`CHUNKS_ONLY` and `INTERNAL_SERVER`, four workers and a runtime ratio of 1.0.
The worker count was chosen for a 14-processor host, not measured as optimal
for all machines.

New worlds use Create Sky Compat's expanded preset and geometry configuration.
The **eee** preset and common Sky Archipelago TOML apply to ordinary upstream
worlds; their RANDOM sizing leaves SPECIFIC bands dormant. Keep those files with
ordinary saves. See [world generation](worldgen.md) for preset boundaries.

SeedGen is excluded because its reconstructed vanilla noise terrain does not
match Sky Archipelago. Do not use it to fill missing island LODs. Preserve world
and LOD identity when troubleshooting; renderer visibility and network transfer
are separate problems. See [graphics](../players/graphics.md) for diagnosis.

The renderer uses a 256-chunk radius with cave culling disabled so island
undersides remain visible. Cache identities remain installation-specific.

## DH luminous columns

DH 3.3.3 can transfer glow lichen's tint and emissive material to the entire
segment below it when `tintWithAvoidedBlocks=true`. This creates pale, luminous
stripes on distant cliffs and can replace a liquid segment's material. A physical
client fixture reproduced the transfer onto stone, lava and water; source and
flowing lava alone retained the correct orange color.

The authored DH configuration adds `minecraft:glow_lichen` to
`ignoredRenderBlockCsv`. Reopening the same fixture and cache removed the stripe
and preserved the original stone/fluid materials. This omits lichen from LODs;
native lichen, fluids and ordinary foliage tinting remain enabled. It does not
delete cached terrain or require a fluid-rendering Mixin.

The check used Complementary Unbound r5.9.3 with Euphoria 1.10.5, with shaders
enabled and disabled. Glow lichen was also identified on the reported live cliff.
That supports this explanation for the observed pale patches, but does not
establish that every historical liquid-color symptom has the same cause. Modded
fluids and other shaders remain untested. See Create Sky Compat's
[DH development notes](https://github.com/mannie-exe/create-sky-compat/blob/main/docs/development/lod.md)
for the conversion boundary and upstream report candidate.

## Dependency constraints

Carry On Animation Fix stabilizes the client-side entity used for carrying:
it preserves render identity and age and aligns current/previous transforms.
The isolated cow and villager checks covered pickup, carrying in both camera
views, movement and placement. Fresh Animations stays enabled. This does not
validate every entity or Carry On script; container exclusions remain separate.
See the [upstream implementation](https://github.com/Pelly-the-Crafter/carryon-animation-fix).

Fresh Details' older model references caused missing sleeping-villager feet and
incorrect mule chest visibility with Fresh Animations 1.11.1. The generated
resource patch binds reviewed models to current rigs; [patch maintenance](patches.md#fresh-details-animation-rigs)
owns the source contracts and update procedure.

- Complementary r5.9.3 is paired with Euphoria Patcher 1.10.5. Euphoria generates
  its patched shader at launch; its generated folder name determines the preset filename.
- JEI remains alongside EMI for recipe integrations.
- Connector and Forgified Fabric API support the Hoofprint/Surveyor/McQoy stack.
- URL pins handle provider metadata conflicts involving old exact versions,
  Connector/Forgified Fabric API and client-only dependencies. Check runtime
  metadata before replacing them with provider roots or downgrading dependencies.
- Published URL pins select DH Polygon Fix, Copycat Bar Extrusion, Create Sky
  Compat with content digests. Compat itself requires no content mods; this pack
  enables its Sky Archipelago 1.3.6 preset and Sky Villages/Architectury adapters.
  Compat also owns the optional client framebuffer, balloon, and construct-model
  corrections. Do not install the former standalone Veil Iris Fix alongside it.
  Review coupled versions together; see [patch maintenance](patches.md).
- Carry On excludes Lootr containers and Aeronautics/Sable objects and retains
  the generated Create/Copycats exclusions. These exclusions do not verify every
  carried entity or ship-storage interaction.

### Distant terrain content

The 2026-10-27 Atlas world sample contains ten modded terrain block IDs:
Create's zinc ores and stone families, and Create Propulsion's platinum ores.
Their installed models inherit vanilla `cube_all`, including the randomized
Create stone variants. The physical-client DH conversion retained opaque colors,
valid texture sprites and full test-column heights for all ten types, with stone,
deepslate and grass controls. No missing terrain adapter was identified.
The sample is not an inventory of every structure or runtime-placed block.

Animated machinery, moving ships and specialized container renderers are outside
this DH pass: their detailed behavior is not required for distant natural island
terrain. This is a scope decision, not a claim that DH reproduces those renderers.

## Hoofprint zoom

Inspection on 2026-10-31 of the pinned Hoofprint 1.3.0+1.21 JAR confirms that
`config/hoofprint.toml` cannot extend the scroll range. `defaultScale = -1`
selects half the GUI scale rounded up; `1` starts at the farthest existing
zoom and `10` at the closest. Scrolling is independently hard-coded to integer
map scales 1..10, equivalent to display pixels per block. `-2` is outside the
declared range and has no additional zoom-out semantics.

Keep the current pack default pending an adapter. The
[Compat investigation](https://github.com/mannie-exe/create-sky-compat/blob/main/docs/development/hoofprint.md)
owns the source/bytecode evidence and proposed fractional client zoom, including
initialization, dimension changes and pointer anchoring. It is not implemented
or verified in game; the pack retains the existing default.

## Controls and resource packs

Better Climbing, Ping Wheel, Easy Anvils, Easy Magic and
Inventory Totem ship on both sides. Camera/UI/rendering mods and resource
packs are client-only. EMF/ETF support Fresh Animations; Puzzles Lib, Collective
and Searchables satisfy the corresponding dependencies. Exact selections are in [MODLIST](../MODLIST.md).

| Domain | Authored choice |
| --- | --- |
| Flight camera | Elytra retain vanilla steering and firework propulsion. Better Third Person's independent elytra camera stays off. |
| Inventory movement | Preserve sneaking and prevent dismounting. Text focus disables movement. Unknown screens default off; books, advancements and all Ponder browsing views also disable movement. EMI/JEI compatibility modules remain enabled. |
| Communication | Ping Wheel keeps its range, channel and rate-limit defaults, with ten-second markers and 50% volume. Chat Heads retains its defaults. |
| Tooltips | Keep durability/enchantment information, omit extra blank-line spacing. Shulker Box Tooltip retains its native preview defaults. |
| Workstations | Keep generated Easy Anvils costs and maintenance settings. Easy Magic shows all enchantments while retaining paid rerolls. Do not disable old vanilla workstations. |
| Visual resources | Use the current selection and ordering in [Graphics](../players/graphics.md#resource-packs). Retain EMF/ETF defaults. Existing options remain seed-managed; explicit syncs update only the reviewed selection. |

Better Climbing and Inventory Totem expose no generated tuning file in this
version. Their native behavior is retained. InvMoveCompats and Ping Wheel are
published as beta builds; InvMoveCompats' `1.21.8` filename covers 1.21.1 according
to both its version metadata and native loader range.

Disposable Java 21/NeoForge clients and servers were installed from the reference
exports on 2026-10-23, against the 0.1.9 working tree based on `25a5a209`.
The client joined the isolated server, loaded all six packs, rendered Fresh
Animations villagers/golems and showed a shulker preview containing three diamonds.
An inventory-only totem survived 100 generic damage, granted Postmortal and was
consumed with both hands empty. InvMove moved the player in an inventory; typing
in focused EMI search left the teleported position unchanged.

Native configuration loading accepted the authored new settings. A server runtime
export completed without exporter errors. Existing Create Radar model warnings,
Propulsion compass-model warnings and other inherited content warnings remain;
the matching Radar warnings also occur in the prior local client log. Successful
startup does not establish moving-ship camera compatibility, flight feel, every
modded inventory, all crop/Copycat geometry or shader performance. Those need
playtesting.

## Shader verification

The Apple M4 Pro reference client exposes 16 texture units; Iris
1.8.14-beta.1 reserves two for composite passes. Complementary HIGH with DH used
15 active samplers in `composite1`, failing on `shadowcolor1`. Low block
reflections (`BLOCK_REFLECT_QUALITY=1`) removed three reflection-buffer samplers.

| Preset | Overworld maximum | Nether maximum | End maximum |
| --- | --- | --- | --- |
| Complementary r5.9.3 | 12 | 7 | 12 |
| Euphoria 1.10.5 | 12 | 7 | 12 |
| BSL 10.1.8 | 10 | 10 | 10 |

These are measured composite/deferred sampler counts. Instrumented construction
of all nine shader/dimension pipelines passed with DH 3.3.3, SSRD and Polygon Fix
1.0.0 present. The test did not exercise actual dimension travel, terrain visuals
or frame rates. Version 1.0.1 preserves that patch's runtime query implementation.

The presets retain most HIGH effects, reduce shadow distance to 128 blocks and
lower Complementary/Euphoria light-shaft sampling. Reduced shadow coverage and
sampling suggest less work; no fixed-scene FPS improvement was measured. Lower
light-shaft sampling may show more noise in motion.

## Weight classification verification

[Building weights](weights.md#verification-2026-10-29) records the exact resource
artifact, all-state comparison, representative assemblies and limits. The
resource-only change needs no Create Sky Compat update.

## Analog Audio release verification, 0.1.19

[Create Sky 0.1.19](https://github.com/mannie-exe/create_sky/releases/tag/v0.1.19)
was published from `59ed4fecdb1cdbad2e64475adf03dd829da81ce5` by
[release run 40845603600](https://github.com/mannie-exe/create_sky/actions/runs/40845603600).
Validation and release CI passed. Downloaded Prism, Modrinth and server archives
match `SHA256SUMS`; archive integrity, Compat path/hash, shared resources,
client visual patches and app-source exclusion checks passed on those downloads.

Create Sky 0.1.19 selects Compat 0.5.2, SHA-256
`0228b2cd34f402114ba6bf57a02e29b6d03c2b294dd8f970b37bd523a828320e`.
The downloaded GitHub artifact matches the locally tested binary, and its binary
and source JARs matched across Linux, Windows and macOS CI. The adapter's exact
pair is Analog Audio 0.1.5-hotfix.1 and Create 6.0.10.

The old Compat release reproduced the missing-handler failure. Five isolated
server selections passed with the new artifact: minimum install, Create alone,
Analog Audio alone, the pair and the full 0.1.18 dependency set. The pair and full
pack registered the original radio handler, retained Create's drill handler, and
completed radio server callbacks without client class loading. The full startup
no longer reported the reflection error. No other dependency selection changed.
[Compat verification](https://github.com/mannie-exe/create-sky-compat/blob/v0.5.2/docs/development/verification.md#release-052)
owns the commands and runtime scope.

The isolated staged source passed 28 Python tests, the 242-file configuration
audit and both resource builders. Both generated resource artifacts match the
working-tree outputs. Prism, Modrinth and server reference exports passed CRC,
Compat path/hash and app-source exclusion checks; server launch patch/check passed.
Only explicitly selected modpack paths enter the release commit.

Atlas source/data review
found no recipe or physics projection requiring a change for this hook; app
verification remains in its [own guide](web/verification.md). App changes are
excluded from this release. Existing block weights and resource patches remain
byte-identical. Audible client playback, moving sound positions and ordinary
Create contraption GUIs are not certified by the server tests.

Both local instances were installed from the verified 0.1.19 release. The client
release descriptor is `0f0a32d61c3be5ed907416f3f31e4d91d3457d321ee9cec7ddc2b974016926bd`;
the server descriptor is `dc249be3609dbf86d8b547b2eb5eeeefdc647d420eea103744b996b2ac237472`.
Both retained exactly one Compat JAR matching the published binary. Consumer
assets and launcher hashes were updated together while preserving other launcher
settings; subsequent prepare dry runs reported zero changes.

The server stopped gracefully before installation and remained off afterward,
as requested. Preservation comparisons passed for 36,144 client and 24,038 server
paths covering worlds, DH data, configuration and settings. Checks compared size
and modification time, plus SHA-256 for files up to 1 MiB and all selected config
files. Large world/database files were not reread in full; BlueMap's generated
tile tree was not enumerated or targeted. No world reset, cache clearing or
pregeneration occurred. The server process exited and port 25565 had no listener.

## Release verification, 2026-10-29

[Create Sky 0.1.18](https://github.com/mannie-exe/create_sky/releases/tag/v0.1.18)
was published from `045784a79d5d7ed75fb6ac4eb5d8c3371733599b` by
[release run 40834796342](https://github.com/mannie-exe/create_sky/actions/runs/40834796342).
The isolated pack checkout passed 28 Python tests, the 242-file audit, both
resource builders, all three reference builds and the server archive patch/check.
No Atlas or unrelated journal-authoring edits entered the commit or builds.
Create Sky Compat remained at 0.5.1 because its distributable behavior did not change.

Downloaded assets matched `SHA256SUMS`. Archive CRCs, embedded asset hashes,
runtime pins, dependency sidedness and the native-tested fixes JAR passed inspection.
Only that JAR changed in the client/server managed payloads from 0.1.17.

| Published archive | SHA-256 |
| --- | --- |
| Prism references | `d93b48d4beb1ddc7bd14ca7b3302964a9db76e56d0fab8ef77f32c31ccdf6b2d` |
| Modrinth | `8bb0f953010482a97eacaf3fc1fa5ddc8c1066d8c1f4d9d1b5a5327cd2e08e83` |
| Server references | `66266c36ed32a39580a1d8d8bce9bae22cb7bb5806ce93afaeb751a999c2d53a` |

The stopped local Prism client and server were installed from the verified release.
Their exact release descriptors are respectively
`47392a1ad8085b06fc0adb91c999f9b5033b8743c2712d36dd8d68c199c12cba` and
`382ebf1d3ee1243fccc9aeb42ace3d00fe87145f9a914586c9a8f9d23659be8c`.
Consumer assets and launch hashes were updated together, preserving other Prism
settings. Both subsequent `instance prepare --dry-run` checks reported zero changes.

Before restarting, preservation comparisons passed for 35,734 client and 24,067
server paths: size/mtime fingerprints for all sampled paths, plus SHA-256 for
files up to 1 MiB and all configuration files. These include worlds, LOD data,
settings and access lists. Large world/database files were not reread in full.
BlueMap's generated tile tree was not enumerated or targeted by installation.
No world reset, migration, cache clearing or pregeneration was performed.

The server stopped gracefully, restarted through its existing blocking console
and empack wrapper, reached `Done`, and listened on Minecraft port 25565. BlueMap
returned HTTP 200 on port 8100. After stripping timestamps, thread prefixes and
ANSI formatting, all 279 startup error signatures already occurred in the previous
log. Existing optional loot resources and Sable's missing Copycat catwalk warnings
remain; this is not an error-free startup claim. The client was updated without
launching a graphical session. Native weight checks are documented in
[building weights](weights.md); app checks remain local in the web verification guide.

## Compatibility fixture

The 2026-10-28 isolated client used the selected 0.1.17 dependencies and generated
patch `21cd22ce029c6a8190c2cc236de9b0b8f787bca5556b77cefc5005063197e5bb`.
Sleeping villagers, standing traders, elder guardians and mule equipment were
viewed. Cow and villager carry recordings were stable; pickup/placement and
return to ordinary AI were checked. Seven actual Sable assemblies matched their
expected mass, including unchanged wood/iron controls. The tag delta affected
308 default states only in the intended building-mod families.

Ponder 1.0.87's published source contains the concurrent sprite registry missing
from bundled 1.0.82. The candidate started normally and rendered the Aeronautics
propeller scene with shaders off/on, plus a Create press control. EMI opened
recipes with JEI 19.70.0.464. Radar's new Sable silhouette/sound defaults were
accepted; existing radar settings and C2ME's configuration were retained.

This ModDev client excludes Connector, Surveyor and Hoofprint because of the
harness's clean-Minecraft lookup limitation. It does not establish a complete
launcher installation or every animation state. Dedicated-server fixtures use
the full server mod set; release archives are verified separately.

Copycats 3.0.9 still logs a physics selector for the absent `copycat_catwalk` block;
Sable skips only that definition. DnD loot resources also reference absent color
variants, and Let's Do EMI Compat contains serializers for uninstalled content.
These inherited, skipped records did not block the fixtures. No dummy blocks,
blanket log suppression or speculative recipes were added to hide them.

## Verification scope

Choose checks that exercise the change:

| Change | Relevant checks |
| --- | --- |
| Documentation | Local links and anchors, source paths, commands and claims against current files |
| Configuration | Parse files; compare the intended keys; inspect affected exports when packaging changes |
| Dependencies or placement | Sync, build all profiles, compare payload hashes and side exclusions |
| Shaders or rendering mods | Construct pipelines, then test island edges, water/glass, ships, lighting and dimension travel in-game |
| Generation or physics | Test a disposable world and representative ships; preserve production world data |
| Release | Verify CI, downloaded checksums and critical published archive contents |

Record the exact source revision, commands, environment and outcome. A passing
packaging check does not establish GPU compatibility. Keep version-specific evidence with
[release history](../README.md#source-and-releases), and label untested behavior explicitly.

Earlier logs recorded Create Radars errors for empty model/blockstate JSONs.
Those runs reached a title screen and sky world; that finding has not been
established as resolved. Analog Audio registration is covered by the 0.1.19 check.
The history also retains a separate, unattributed native Apple Metal/IOGPU crash.
Do not conflate that report with the confirmed DH polygon-buffer defect.

Survival resource access, structures, moving-ship interactions and acoustics still
need broader gameplay coverage. Player testing supports enabling DH by
default; it is not a cross-platform performance benchmark.

## Progression and integration

Hostile Skies automatic raids and departure explosions are disabled; capture is
enabled. Delivery Quests uses village destinations, four offers and 120-minute
deadlines. It samples search offsets from 500 to 6,000 blocks; the installed mod
can select a farther structure. These are structure destinations, not a
simulated economy. Glider defaults and membrane requirements are retained.
[Progression](progression.md) owns production/travel policy and remaining checks.

The [patch maintenance guide](patches.md) owns recipe, loot, tag and generation
overrides and their update/removal procedures. Almost Unified retains geological
ore identity while preferring interchangeable manufactured materials. Questlog
mechanics and client integration are owned by [journal definitions](journal.md)
and [journal integrations](journal-integrations.md).

## Resource interactions

The 2026-10-23 shader-off client fixture used Minecraft 1.21.1, NeoForge 21.1.264,
EMF 3.3.12, ETF 7.2.6 and Fusion 1.3.16. It used a disposable superflat world,
fixed noon/clear weather and fixed camera positions. This tests stationary
appearance, not moving ships, multiplayer state isolation or performance.

- **Crops and pots:** the tagged 3D Crops download declares format 55. Minecraft
  removes it at startup unless `incompatibleResourcePacks` explicitly accepts it.
  Its inspected assets use ordinary blockstates/models, and it loaded with that
  acceptance in the lab. Fresh Flower Pots above it then applies crossed planes
  to the replaced mushroom textures, producing visibly distorted plants. The
  fallback order gives 3D Crops ownership of the four shared potted plants;
  Dedicated Sugar Cane stays above Crops. Other pots retain Fresh Flower Pots.
- **Pot composition:** a lab-only prototype removed the Fresh pot parent's
  `#plant` planes, retained its pot/soil elements and texture bindings, and added
  Crops elements whose faces use `#mushroom`/`#mushroom_top`. The existing stem base
  at y=4 fits inside the soil. Brown/red mushrooms and crimson/warped fungi all
  rendered with their 3D plant and the Fresh pot. The generated client patch
  includes this composition above both upstream packs.
- **Chests:** Objects overrides Redstone Tweaks' three trapped-chest textures.
  Normal and trapped fronts are less distinct. Lootr still showed gold unopened
  and muted opened chests and successfully opened generated loot. That baseline did not
  establish animation support; the later [Lootr adapter](patches.md#lootr-and-fresh-objects)
  does. Preserve
  Lootr's state textures; do not enable `vanilla_textures` just to match artwork.
- **Glass:** vanilla, Create framed and Create tiled glass connected in the
  fixture while retaining their different borders. Midnighttigger does not
  automatically cover arbitrary mod blocks. Target missing families individually;
  Copycat materials and moving geometry remain untested.
- **Better Lanterns:** replacing the vanilla chain parent made Macaw's copper and
  golden chains look like iron. The replacement uses texture variable `1`, while
  Macaw's children bind `all`. Two child overrides adding `1` with the
  existing `all` value restored the correct colors on standing and hanging chains.
  Better Lanterns and these overrides are selected.
  The sampled lanterns rendered, but this is not coverage of all Macaw styles.
- **Interface:** Icons was removed after user playtesting found excessive visual
  clutter. Its temporary disc-label merger was removed too; Clean Tooltips and
  Redstone Tweaks retain their own presentation.

Local comparison captures are generated evidence, excluded from version control:
[pots before](../../web/public/generated/resource-review/pots-selected.png),
[composite prototype](../../web/public/generated/resource-review/pots-composite.png),
[selected pot fallback](../../web/public/generated/resource-review/pots-crops-priority.png),
[lanterns before](../../web/public/generated/resource-review/lanterns-better-unpatched.png),
[chain correction](../../web/public/generated/resource-review/lanterns-better-patched.png),
[Lootr states](../../web/public/generated/resource-review/chests-opened.png),
[glass families](../../web/public/generated/resource-review/glass-selected.png).

### Category review world

**Resource Review** in the local client is organized by Plants, Pots, Ladders,
Bars, Lighting, Storage, Glass, Rails and signals, Machinery, Animals, Equipment,
Surfaces, Lamp variants and Connections. `/function resource_lab:hub` returns to its controls. These are
comparison categories, not a division by mod or resource-pack coverage. The
fixture source, manifest and stopped-world checker live in
`~/Minecraft/modpack-testing/projects/create-sky-resources/`.

The installed registry has no non-vanilla `minecraft:crops` members or additional
crop block implementations in the inspected plant classes. The plant displays
therefore compare vanilla growth stages, stems, cane, fungi and aquatic plants.
All eight ladder families are present: vanilla; Create andesite/brass/copper;
Create Deco iron/industrial iron/zinc; and Copycat. Apply a material to the
Copycat sample yourself. Gingerbread men sit beside the stationary animal specimens.
The equipment chest and enclosed pen support motion
checks. Revision 8 adds a powered adjustable burner and propeller/press Ponder
buttons. Both buttons and the burner rendered with the selected shaders in the
isolated full-stack client on 2026-10-24. The stopped local-world check passed
4,836 block placements, 32 equipment slots and 27 stationary specimens. Other
machinery and track samples do not establish working contraptions.

| Family | Installed behavior and remaining work |
| --- | --- |
| Macaw lanterns | Bell, covered, cross and festive standing/hanging variants use fitted artwork. Bridge and stair lanterns use the detailed template within their original mounting envelope. The bridge must be directly below the lantern; its state selects the elevation. Native shader-off/on views cover representative variants. Wall variants retain their brackets with fitted lantern bodies. |
| Create and Deco bars | Texture-mask extrusion covers all three Create families and Deco's andesite, brass, copper, industrial iron, iron and zinc model families, including overlays. Native posts, ends, corners, crossings and three-block stacks were reviewed. Deco overlays are connected bars with additional panels, not wall decals. Connection blockstates remain upstream-owned. |
| Cage lamps and frontlights | Deco's cage surfaces have depth while its base, light and material/color bindings remain intact. Eight DnD hood templates retain their bodies, texture bindings, rotation, lit and no-base variants. Representative straight/rotated and powered/unpowered views passed with shaders on and off. |
| Mooshrooms | Details 2.2.1 refers to the removed `mooshroom_animations.jpm` in FA 1.11.1. The adapter retains adult/baby geometry, uses the current shared cow rig and replaces obsolete ear/tail expressions. Red/brown adults and babies render; a retained clip shows idle motion. Stationary fixture specimens also require `OnGround:1b`. Other Details rigs with missing references remain outside this fix. |
| Aquatic plants and pitcher plant | The selected stack, including active overlays, supplies no replacement geometry for lily pads, kelp, seagrass or pitcher growth stages. Their flat surfaces are missing coverage, not a priority failure. No new plant pack was added. |
| Barrels | Fresh Objects 2.1.2 supplies no barrel CEM model. A barrel changes its block-state model/texture when opened; it has no chest-style lid renderer. An open-state model can change the silhouette, but smooth lid motion would require a renderer and transition state. |
| Lootr chests | The [adapter](patches.md#lootr-and-fresh-objects) supplies the exact `lootr_lootr_chest` and `lootr_lootr_trapped_chest` model names requested by EMF, with literal body/latch bindings and an isolated animation resource. Native opening/closing, body motion, generated loot, state textures and neighboring-chest independence passed locally. Lootr continues to select its own materials; `vanilla_textures` stays disabled. |
| Other models | Connected glass families, decorative machinery and moving objects need family-specific checks. Sharing a texture or parent is not proof of matching UVs, connection rules or renderer behavior. New creature animations need a rig/part mapping; extrusion cannot infer joints or behavior from a sprite. |

The Bars section uses real Copycat panels with both `Material` and `Item` NBT;
missing item data causes Create to reset the material. The directly placed internal
`create:copycat_bars` helper is removed. Double chests form a shared 54-slot inventory.
Vault and shipping-container automation was previously verified, but those exhibits
are removed from the visual review: neither has a dedicated manual GUI or opening
animation. Connections now compares native window/pane behavior, mixed boundaries,
Rechiseled variants and six Copycat panel facings.

The 2026-10-24 visual pass is retained under
`~/Minecraft/modpack-testing/projects/create-sky-resources/images/2026-10-24-visual-pass/`.
Filenames distinguish shader-on/off views. These checks do not establish moving
contraption rendering, other shader compatibility or performance. No web gallery
was added for this pass.

The optional `Resource Review Prototype.zip` is a local, unselected experiment.
Its builder is in the fixture project. The maintained patch instead uses the
model recipes and renderer adapter described above. Source generation and
installation are separate; consult the model-workbench verification for the tested ZIP.

Shader-off comparisons use fixed noon/clear weather and matching camera poses:
[covered before](../../web/public/generated/resource-review/covered-template-before.png),
[original template](../../web/public/generated/resource-review/covered-template-isolated.png),
[bell before](../../web/public/generated/resource-review/bell-template-before.png),
[original template](../../web/public/generated/resource-review/bell-template-isolated.png),
[industrial bars](../../web/public/generated/resource-review/deco-bars-current.png).
The six-second clips preserve the actual chest interaction:
[Lootr baseline](../../web/public/generated/resource-review/lootr-close-baseline.mp4),
[Lootr alias](../../web/public/generated/resource-review/lootr-close-prototype.mp4),
[trapped alias](../../web/public/generated/resource-review/lootr-trapped-close-prototype.mp4),
[normal chest control](../../web/public/generated/resource-review/vanilla-close-control.mp4).
Those earlier clips document the namespace-only experiment. Current patch checks
and retained comparisons are in [model verification](web/verification.md#native-model-checks-2026-10-24).
Neither set is a frame-time, audio or multiplayer test.

### Patch generation boundary

The [client patch builder](build.md#local-builds) pins exact source archives,
checks empack's selected versions, and validates the pot elements and chain
texture variables before emitting deterministic output. The pot and chain overrides
use the inspected base paths; no active overlay changes those inputs for 1.21.1.
The separate model recipes add explicit extrusion and UV fitting; they do not
infer arbitrary model compatibility.
New inputs require fresh overlay/structure inspection and visual checks.

Additive/composite overrides can live in one top-priority pack. Vanilla resource
filters cannot remove a path from just one named lower pack: they filter matching
resources below them. Source-specific subtraction therefore needs filtered input
copies or a client resource-loader adapter. Filtered copies must preserve upstream
archives, record exact excluded paths and be rebuilt after updates. Reference
releases also need a distribution strategy for derived third-party resources;
do not silently replace referenced inputs with bundled modified archives.

The next visual comparison group remains 3D Default, Nautilus 3D, Classic 3D,
Vanilla Experience+, Fresh Moves and Dramatic Skys with a selected sky renderer.
Their archive inspection is recorded in the Atlas, but this fixture pass did not
run those candidates. Fresh Moves needs motion/equipment checks; sky rendering
needs day/night and shader-on/off checks, not only a still image.

### Visual compatibility pass

The 2026-10-24 compatibility client used Minecraft 1.21.1, NeoForge 21.1.264,
Create 6.0.10, Copycats+ 3.0.9 and Create Deco 2.1.3. Resource patch SHA-256:
`edce4c4265ea017caf638821d8a4b857060ca261b2c870c9c5059b282ba0691e`.
Copycat Bar Extrusion 0.1.0 JAR SHA-256:
`ba32ee265b9bcf838c9cc177398081759e870aadffdadee8bf41fd207bfb99eb`.

Native checks covered lantern standing/hanging/wall samples, the shorter straight
and rotated frontlight hoods, cage bends, window corners/pane intersections and
Copycat bar depth. The renderer generated all six facings for vanilla iron,
Create andesite/brass/copper and Deco industrial iron/zinc, with 10 to 40 quads per
panel. Adjacent brass panels joined visually; stone and unfilled panels retained
native rendering. Resource reload through the pack-selection screen rebuilt the
meshes successfully. Shader-off and Complementary Unbound 5.9.3/Euphoria 1.10.5
views showed the revised silhouettes without missing textures in these samples.

Create framed glass removes internal frame edges; wood and iron windows retain
intentional mullions. Rechiseled's plain and connecting variants remain separate
choices. No competing Fusion override was added to these native connections.
This pass does not establish moving-contraption behavior, every Copycats+ shape,
other shader packs or performance. The patch may keep redundant faces where panels
touch; its cache and mesh limits bound memory/geometry, not measured frame time.

Selected comparison captures remain in the testing harness under
`projects/create-sky-resources/images/2026-10-24-compat-pass/`. The fixture's native
parser exposed an invalid Rechiseled sample ID; it now uses registered oak window
bars, and both fill and individual placement validate registry IDs before generation.

## BlueMap model parsing

The optional Create Sky Compat viewer adapter targets BlueMap 5.7 on dedicated
servers; see [server webmap](build.md#server-webmap). Browser checks on saved tiles
confirmed bounded detailed rendering, reduced empty-edge stretching, disable and
re-enable behavior, and camera movement across the floating-origin boundary.
Coarse sheets remained visible from beneath the islands after the detailed-memory
budget was reached; this is a remaining height-field limitation, not fixed 3D LODs.

BlueMap catches up to saved terrain rather than predicting the final pregen area.

The inspected startup resource scan rejected eleven Macaw's Doors models for
duplicate `particle` keys and Create Deco's `catwalk_bottom.json` for an invalid
`EAST:` face direction. No other tile-generation exceptions were found in that
BlueMap debug log; 24 sampled compressed tile files decoded successfully. This
checks file integrity, not visual correctness of every block. Clearing tiles does
not repair upstream model JSON. No broad resource overrides were added for this.

## DH multiplayer cache filling

On 2026-10-26, islands became visible from spawn after the player approached them
and returned. The client log at 21:32 confirmed the DH handshake and the current
`create-sky-20261026-a0fb6687aa24` level key. Both sides used CHUNKS_ONLY,
INTERNAL_SERVER, enabled synchronization and generation, and 4096-chunk request
caps. No exploration prerequisite was found in the inspected request paths.
DH's [multiplayer FAQ](https://modrinth.com/mod/distanthorizons) distinguishes
client-only exploration from server-provided LODs.

Read-only database inspection found server LODs around the western anchor
(-3516, 1692) dating to about 17:07, while its client's detailed section was first
stored around 21:40. The northwestern anchor (-1892, -1014) likewise had server
data before login and acquired client data during that session. Sampled server
column-generation arrays were complete LIGHT (4096 of 4096 columns); several
client parent sections still contained EMPTY columns. This establishes incomplete
client coverage despite available server data. It does not reconstruct the exact
contents of the rendered frame before the player's flight.

Inspection of the installed DH 3.3.3 implementation found two nearest-first stages:
`LodQuadTree.startQueuedRetrievalTasks` orders missing sections by Manhattan distance,
and `AbstractFullDataNetworkRequestQueue.sendNextRequest` prioritizes by distance
to the player. `RemoteWorldRetrievalQueue` uses the generation-request limit even
when downloading already-generated LODs. The server fulfills complete stored
sections without requiring a player visit. `RemoteFullDataSourceProvider` has a
20-minute `visitedPositions` cache, but it deduplicates section sync requests;
it is not a world-exploration permission system.

Before tuning, both local endpoints limited fresh requests to 20, sync requests to
50, and per-player bandwidth to 500 KB/s. Client logs recorded sync-rate rejection
and requeueing at 21:32 and 21:39. Four DH worker threads also bound the retrieval queue to 80 tasks.
The negotiated limits use the lower client/server value; raising only the server
value may have no effect. The disabled generation-progress display also hid the
multiplayer download-progress indication.

The evidence supports delayed cache filling, with movement changing request
priority and nearby vanilla chunks also contributing LODs. It does not isolate
bandwidth, request concurrency and disk/CPU scheduling as independent bottlenecks.
Do not switch to surface approximation, clear caches or regenerate terrain to
address this symptom.

### Transfer tuning

The connected client and running server were tuned through DH's own UI and console
on 2026-10-26. The same transfer limits are now authored pack defaults. The progress overlay
remains a local preference; new installations keep it hidden.

| Setting | Previous | Tuned value |
| --- | --- | --- |
| Per-player bandwidth, both endpoints | 500 KB/s | 2048 KB/s |
| Generation/download request limit, both endpoints | 20 | 64 |
| Sync-on-load request limit, both endpoints | 50 | 100 |
| Client generation/download progress | DISABLED | OVERLAY |

Server commands were `dh config common.playerBandwidthLimit 2048`,
`dh config generation.requestRateLimit 64`, and `dh config syncOnLoad.rateLimit 100`.
The client exposes the same limits under DH → Advanced options → Server, despite
that category name. Saved TOML readback confirmed all three values on both sides.
Pack cave culling is also disabled to match the client's existing island-friendly
setting; the old Y=60 cutoff is unsuitable for exposed undersides.
Render radius remains 256 chunks, worker count remains four, and generation stays
CHUNKS_ONLY / INTERNAL_SERVER. No restart, movement, cache clearing or pregen
rescheduling was needed.

A read-only client SQLite comparison from 21:59:42 to 22:00:12 PDT found 1454
additional detail-zero sections. The detail-four section containing the eastern
anchor (2930, 1362) improved from 3216 to 4048 LIGHT columns out of 4096. The western,
northwestern and southern sampled sections were complete at both observations.
The visible download overlay and increasing stored coverage confirm stationary
cache filling. This is not a controlled throughput comparison or proof that every
island is rendered: the cache was already warming and no before/after flight or
fresh-client test was performed.

### Optional island-aware request ordering

An adaptation could prioritize coarse coverage of likely land-bearing sections,
then refine nearby terrain, before spending most of its initial budget on empty
space. The inspected client has two scheduling stages, so changing only server
response ordering cannot prioritize sections the client has not requested yet.
A candidate would gate client hooks to the supported DH version and use bounded,
cached island descriptors from the server to rank requests. Existing stored LOD
occupancy could refine predictions without generating chunks to classify them.

Treat these hints as priority, never permission or proof that a section is empty.
Keep age-based fairness and a share of the request budget for all sections: bridges,
structures and player builds can occupy nominal void. Preserve normal DH behavior
without the optional adapter or hints. Descriptor lookup, network payloads and
scheduling hooks still need implementation and runtime verification; no DH adapter
is installed by this tuning pass.

### Release installation

Create Sky 0.1.16's published Prism, server and Modrinth archives passed SHA-256
verification and payload/sidedness checks. Both local instances installed the
release through empack. The client prepare hook then reported zero changes; the
server reopened the existing prototype-10 world and served BlueMap's adapter.
The same pregen request was accepted once and left running. No new Minecraft
client visual pass was performed for this metadata/configuration release.

[Compat's DH integration](https://github.com/mannie-exe/create-sky-compat/blob/main/docs/development/lod.md)
owns lifecycle and optional cache-isolation hooks. It does not provide a separate
terrain predictor. SeedGen and Voxy/Roxy are not included in the pack.
