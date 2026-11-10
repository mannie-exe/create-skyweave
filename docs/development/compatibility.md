# Compatibility constraints

This reference describes constraints behind the current pack configuration.
Player instructions belong in [graphics](../players/graphics.md) and
[server maintenance](../players/server.md). Exact versions are in the
[content list](../MODLIST.md), with authoritative selections in `empack.yml` and
`empack.lock`.

## Island water and environment

Skyweave's marked island preset disables Sky Archipelago's native rivers and
lakes. Dynamic Waters 13.1.0 supplies terrain-following mountain watersheds and
basin lakes through Compat's supported-column bridge. Its lowland mode remains
`VANILLA`; `NONE` also rewrites density inputs. Mountain tunnels are disabled.
Native Lagoon/Broken Reef habitats remain independent. Coastal Lagoon treatment
is enabled; the perimeter variant is disabled in current defaults. Generation settings belong to the saved world identity;
these changes require a fresh world rather than modifying old chunks in place.

Temperature-sensitive island consumers use reference Y64 while block positions,
light and collision remain real. Cloud height maps to Y469.3333. Native void
height darkening is disabled only in marked worlds; the supported shader recipes
use scoped exposure signals for their corresponding cave/void heuristics.
Other shaders retain their own behavior. Settings and limitations belong to
Compat's [configuration](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/configuration.md)
and [verification](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/verification.md).

Native full-pack checks include ordinary fluid ticks, a natural edge waterfall,
reopening, source/height-query agreement, and bounded Sable current submission.
A real DH job persists terrain and water palettes. These checks do not certify
all boats, Create machines, distant fluid colors, aquatic progression or scarcity.

## Redstone control

Redstone Link GUI keeps Create's ghost frequencies and personal presets. Open it
with an empty hand and Shift + right-click on a frequency slot. The native range
remains 24 blocks. Compat checks server permissions and menu identity, projects
Sable coordinates and limits relocation to ordinary links within one coordinate
frame. Vector-thruster frequency menus remain available; machinery relocation
is intentionally refused.

Redstone Additions supplies optional gates, crossings and resistors alongside
Create controls. Compat repairs placement/input side effects, feedback, support
loss, wrench behavior, successful-only copper scraping and inverter transparency.
Crossroad strong output through solid blocks loses one signal level; wire behavior
retains its native contract. Treat it as an analog detail when designing circuits.
The Skyweave: Resource Patches JAR restores nine block drops using the 1.21 loot directory
and supplies the missing Ponder category translations. Carry On's existing Create
exclusion already covers these components; no additional pickup rule is required.

The journal introduces copper scraping and acquiring signal components without
claiming a completed circuit or making them mandatory for flight. Existing remote
control guidance explains the frequency UI. Recipes remain upstream-owned; scarce
materials are not granted through these entries. Recheck the exact dependency pins,
resource overrides and [adapter contract](https://github.com/mannie-exe/skyweave-compat/blob/v0.14.0/docs/development/redstone.md)
together when upgrading. Remove overlapping repairs after native verification.

## Audio and death recovery

Analog Audio's server-owned radio and speaker ranges are 128 blocks. Existing
volume, filtering, spatial modes and attenuation remain unchanged; this extends
the quieter tail rather than adding a new falloff. Compat's independently gated
client timeline adaptation joins the current media position after loading and
reconciles standby resumes. It uses AnalogLib 0.1.0 bundled in the selected Analog
Audio release, independently of the existing Create registration repair.

YiGD 2.0.13 owns recoverable inventory and XP, including the Accessories-equipped
Traveler's Backpack and nested contents. Owner-only recovery has no random item
loss, key/cost requirement, expiry or teleport feature. XP uses `VANILLA`, with no
kept percentage. The Overworld minimum is -127, leaving support space above the
pack's -128 build floor; other dimension minima retain their native defaults.
Global last-ground placement stays disabled so ordinary airborne deaths are not
silently relocated to an old landing point.

`backpackDeathPlace=false` disables competing backpack placement. Retain
`voidProtection=true`: it also protects loose backpack item entities, and YiGD
captures the equipped item through Accessories. The backpack's native grave-mod
detection avoids separate death placement; disabling item protections is unnecessary.
Carry On's existing `yigd:*` exclusion keeps graves out of its pickup path.

Compat's optional Sable/YiGD adapter stores construct-placement metadata in the
same YiGD record. It places graves in real plots, projects tracking into world
coordinates and uses bounded local fallback without duplicating contents.
Temporary unloading differs from construct removal. Spawn protection and the
adapter's cancellable placement event are checked; compatibility with every
external claims mod is not established. See the maintained
[recovery contract](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/recovery.md)
and [audio boundary](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/audio.md)
before upgrading their dependencies.

## Carry On machinery

Carry On 2.2.6.13 handles empty-hand pickup before native block use. A successful
pickup removes the block entity and block; it does not run Sable's assembly-move
callbacks. Coordinate-bearing links and native sneak interactions therefore need
separate review from ordinary inventories.

The common blacklist references `#create_skyweave:carry_on_restricted`, owned by the
Skyweave: Resource Patches JAR. Carry On supports [tag-based exclusions](https://github.com/Tschipp/CarryOn/wiki/Black---and-Whitelist-Config). Its optional block IDs cover these reviewed families:

| Content                | Restricted parts                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Simulated              | Assembler, swivel bearing and plate, merging glue, rope winch/connector, docking connector, torsion spring and spring |
| Absolute Kinematics    | Hinges, ball joints and their paired parts                                                                            |
| Transmission & Linkage | All eight linked machinery/auxiliary blocks, including heads, regulator and conversion bearing                        |
| Linear Bearing         | Bearing/carriage, magnetic port, torsional anchor and gyroscopic gearbox                                              |
| Aerocables             | The two cable endpoint blocks                                                                                         |
| Aeroworks              | Control Desk, Control Stand, both Copycat variants and Joystick                                                       |

Carry On configuration uses the seed policy. Existing installations must merge
`#create_skyweave:carry_on_restricted` into `blacklist.forbiddenTiles` and restart;
replacing the resource JAR alone does not add the blacklist reference. Preserve
other operator settings.

Keep the upstream Create/Copycats, protected-container, grave and entity exclusions.
Backpacks were already excluded by the loaded rules; no duplicate namespace rule
was needed. Ordinary chests, barrels and furnaces remain carryable. The Linear
Bearing redstone converter also remains eligible. Other Simulated controls,
Aeroworks' gyroscope and servos, Power Grid networks and modded inventories need
individual evidence before changing their rules; a block entity alone is not a
reason for exclusion.

Aeroworks 1.5.0's five excluded controls share `ConsoleBlock`, including its
Shift-right-click configuration and active-user handling. Joystick and both
Copycat variants inherit that same interaction boundary. The added exclusions
are source-reviewed; they have not had a new native pickup comparison.

A 2026-11-01 isolated native comparison covered the complete block registry and
fourteen pickup cases. The tag removed exactly 25 previously eligible block-entity
types without changing other eligibility. Actual pickup changed from allowed to
refused for pneumatic heads/regulator/conversion bearing, Simulated assembler and
bearing, and an Absolute Kinematics hinge. Positive container and converter cases
still passed. Paired helper blocks without block entities are included to keep
assembly families together; default `pickupAllBlocks=false` already excludes
ordinary non-block-entity states.

Sable's interaction-distance mapping permits ordinary chest pickup from a plot
while the player remains at its projected world location. A settled-world check
also removed a single-block chest construct and shut down cleanly. This does not
prove every container's placement, linked inventory behavior, carried passenger,
protection integration or active machine relocation. Retain the targeted policy
rather than treating all ship storage as either unsafe or verified.

On Carry On updates, review event priority, list/tag matching and block-entity
serialization/removal order. On machinery updates, review assembly callbacks,
paired block cleanup and native sneak-use before changing this tag. Check both
native refusal and an unaffected carryable object; do not infer safety solely
from a blacklist string or a registry ID.

## Transmission & Linkage

Transmission & Linkage 0.2.9 uses Compat 0.11.1's optional interaction and Jade
adapters. Visible rods disconnect by sneak-using a Create wrench, rather than
ordinary attacks. Server checks protect endpoint/settings edits and resolved
binding selections; Jade reports actual link, actuator and extra kinetic output
state. The [adapter reference](https://github.com/mannie-exe/skyweave-compat/blob/v0.11.1/docs/development/transmission-linkage.md)
owns exact pins, protection limits and update/removal procedures.

Native world-to-ship and rotated ship-to-ship fixtures retained mutual references,
one rod constraint per pair and cold-reload behavior. Both stock actuator types
move without an external supply; this documented upstream behavior is retained.
No recipe, power-limit or mass changes are applied. Stock link lengths avoid the
known enlarged-range visual cap. A controlled converter drive is verified; a
self-powered loop and practical production balance are not established.

The isolated client exercised settings and deliberate removal, Jade inspection,
normal/giant rod rendering with shaders off and the default Complementary/Euphoria
stack, native converter assembly and representative Ponder playback. The pack
corrects the tutorial's rod-body interaction target. Broader claim integrations,
arbitrary hinge builds and unsupported GPUs remain separate playtesting scope.

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

The [mod's machinery reference](https://github.com/mannie-exe/skyweave-compat/blob/v0.9.0/docs/development/linear-bearing.md)
owns the contracts and dependency-update procedure. Native tests cover free/braked
motion, multiple orientations, moving parents, recovery, cold reload, driven
coupling controls, overload and source removal. An isolated client also exercised
assembly, braking, recovery and reopening. Old upstream injected-source network
saves and arbitrary foreign assembly exceptions remain outside that evidence.

## Articulated joints and machinery guidance

Absolute Kinematics 1.0.1 adds hinges and ball joints on both sides. Its exact
CurseForge CDN URL is digest-pinned because a CurseForge API key is not configured;
its JAR metadata omits Create, Sable and Simulated requirements. Keep the pack's
reviewed Create 6.0.10, Sable 2.0.6 and Aeronautics/Simulated 1.3.2 selections together.
The native fixture used real empty-hand interaction assembly, a 16-RPM side-shaft
hinge drive reaching its 90-degree stop, ball-joint lock/release and recovery of
both stone payloads. Both joints retain their native mass of 1.0. No recipe or
weight adjustment was justified. Large articulated craft remain a play check.

Compat's `linear_bearing.ponder` and `linear_bearing.jade` switches add machinery
tutorials and server-backed inspection. The shared Resource Patches assets supply English
names for internal carriage blocks and corrects the gyro acquisition advancement's
old stabilization claim. Guidance does not add another drive or progression gate.
The mod's [machinery reference](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/linear-bearing.md#ponder-and-jade)
owns registration, optional loading and update procedures.

## Dependency update constraints

Minecraft remains 1.21.1. The current preset targets Sky Archipelago 1.4 and its
saved generation identity. Keep old saves with their matching generator/config;
a provider update is not a terrain migration. [World generation](worldgen.md)
owns the preset boundary and [patch maintenance](patches.md) owns coupled updates.

Questlog retains its exact supported-version gate while the empty FTB Quests book
is trialed. Updating the FTB trio requires reviewing Library/Teams/Quests together,
Architectury resolution and the current authoring boundary. Do not describe the
planned authoring replacement or spawn policy as implemented behavior.

JEI, Reliable EMI, MezzConfig and Aeronautics Covers need joint provider/runtime
review: Covers' provider metadata can force an older JEI although its native
requirement is optional. Use the exact file-source exceptions and procedure in
[patch maintenance](patches.md#file-source-exceptions), then inspect the resolved
lock for unintended downgrades before materializing.

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

The manifest selects client-only Colorwheel 1.3.2+mc1.21.1 with Compat's optional
rendering adaptations. Explicit client placements keep Colorwheel, Iris, Sodium
and generated shader content out of server exports. Existing renderer versions remain
pinned.

Compat supplies terrain/emission metadata on Sable's direct non-AO model path
and releases unused OIT sampler slots when Colorwheel's own renderer guard
disables OIT. On the tested Apple driver, the unadapted embedded translucent
program failed at `shadowtex0`; the adapted selection renders with the current
Complementary/Euphoria configuration unchanged. Do not replace supported OIT
allocation or disable shaders to mask that failure.

Native checks cover shader on/off backend selection, static and assembled glass /
Copycats, moving Sable/Create geometry, press/propeller Ponder, a Macaw lamp,
shader reload, and minimum optional loading. Full dedicated-server startup selects
no client hooks. See the [exact verification and limits](https://github.com/mannie-exe/skyweave-compat/blob/v0.8.0/docs/development/verification.md#release-080).
No measured performance gain or general shadow repair is claimed. Keep patch
retirement tied to the actual released Colorwheel/Sable implementations.

Colorwheel 1.3.2 requires the updated version guards introduced in Compat 0.21.1.
The playable pack and shader-lab runner use the same verified engine. Keep their
exact pins aligned when its shared implementation or recipe schema changes;
qualify generated outputs against the playable runtime. Colorwheel's sampler,
material and buffer adapters remain separate from the offline shader engine.
[Patch maintenance](patches.md) owns their individual update/removal checks.

### Shader patching

The [shader lab](../../tools/shader-lab/README.md) owns exact inputs, recipe and
payload versions, update checks and distribution requirements. It invokes
Compat's file-only Java engine for deterministic author builds. Recipients use
that same engine before Iris opens the selected shader. empack manages original
inputs under `shader-inputs/` and the recipes; finished cached ZIPs are generated
locally. Neither plain BSL nor an intermediate Complementary/Euphoria result
belongs in the selectable list alongside its final Skyweave result.

The BSL chain combines BSL 10.1.8, Colorwheel Patcher 1.0.5 and Skyweave environment
edits. Colorwheel's runtime remains installed; the patcher archive is build input.
Complementary Unbound r5.9.3 plus Euphoria 1.10.5 adds independently versioned
Skyweave Glass material corrections and Skyweave environment edits. The glass
policy uses texture alpha to distinguish cutout frames from partial-alpha glazing,
preserving custom PBR and Create's connected-texture ownership. It does not fix
coincident backfaces or pane intersections; those belong to Compat's renderer.

Both supported recipes consume scoped world/void/open-sky signals. Foreign
worlds, real enclosed rooms, underwater rendering and status effects retain their
own paths. Unknown shaderpacks and Photon on unsupported Apple GPUs remain
outside native qualification. Review exact historical captures through
[verification](verification.md); shader compilation alone does not prove visible
materials, occlusion, weather behavior or cross-platform performance.

Compat groups configuration by gameplay system and mod page, with setting
anchors and localized search. Rendering → Iris exposes independent
text-display/nametag lighting and cast-shadow options; these stable adaptations
default on when Iris qualifies. Neutral lighting uses Iris fallback programs for selected text batches;
later color grading/exposure can still affect color. Entity-body shading, signs,
item/block displays and other text keep their native paths. Custom nametags that
bypass Minecraft's base renderer are outside coverage. Review the
[rendering contracts](https://github.com/mannie-exe/skyweave-compat/blob/v0.19.0/docs/development/rendering.md#world-text-lighting)
when updating Minecraft, Iris or shaders.

Complementary r5.9.3, Euphoria 1.10.5 and Photon 1.4 have native Colorwheel support.
The patcher's older Photon 1.3a patch must not be forced onto 1.4. Select the
official Photon release rather than an older compatibility fork. Photon also
provides DH shaders, but its author does not support Apple GPUs. Its stock settings
exceeded this Mac's 16-sampler limit in `deferred4`; that is not evidence of a
failure on supported GPUs. Further Photon runtime testing and macOS workarounds
remain deferred.

The Photon preset retains native High lighting, adds block-entity shadows, uses
128-block shadows at 2048 resolution, and disables depth of field/motion blur.
It does not override SH Skylight, colored shadows or colored-lighting controls to
accommodate macOS. The options were checked against the exact 1.4 sources; the
preset has not been GPU-tested on a supported platform. Complementary/Euphoria
remains the default. No additional runtime adapter is introduced.

The lab README owns acquisition, generation and dependency-update procedures.
Recheck exact patch contents, output/preset names, Iris/Colorwheel startup, moving
geometry and DH when updating either input. Euphoria retains its independent
client-side generator; the lab does not replace it.

Sources: [Colorwheel](https://modrinth.com/mod/colorwheel),
[Patcher](https://modrinth.com/mod/colorwheel-patcher),
[Photon](https://modrinth.com/shader/photon-shader).

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
[Compat lighting checks](https://github.com/mannie-exe/skyweave-compat/blob/v0.8.0/docs/development/lighting.md#artifacts-and-updates).
Keep that pair aligned with Compat's exact version guards. Do not add another
Fabric API or a competing dynamic-light engine for this integration.

Native lighting evidence covers moving and nested contraptions, source removal,
dimension travel and client/server light separation. It does not prove complete
wall occlusion or fix the unreproduced upstream hang. Keep new pack verification
separate from those earlier renderer observations.

## Distant Sable rendering

Compat 0.22.1 supplies two independent default-on client adaptations. The distance
repair requires SSRD 1.8.8, Sable 2.0.6 and Iris 1.8.14-beta.1; the opaque-occlusion
repair additionally requires DH 3.3.3. Both preserve their startup switches and
physical-side/version checks. No authored view distance or terrain generation
changes are required.

The native fixture reproduced shader-only disappearance beyond native view distance
without the repair. With both adapters, the hull renders at distance and remains
hidden behind opaque DH terrain in the qualified BSL/Colorwheel and
Complementary/Euphoria/Skyweave shaders. Shader switching, resize and dimension
transitions were checked. Single-block and chunked construct draws retain scoped
state restoration. Translucent composition, distant block entities/Flywheel,
other shaderpacks and multiplayer visuals are not established by those checks.
See Compat's [rendering contract](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/rendering.md#distant-constructs-with-shaders)
and [verification](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/verification.md#ssrd-shader-adaptations)
for exact scope, shader-fog limits and dependency-update checks. Upstream tracking:
[SSRD issue 68](https://github.com/RanoldStranold/SSRD/issues/68).

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

New worlds use Skyweave: Compatibility Patches' expanded preset and geometry configuration.
The **eee** preset and common Sky Archipelago TOML apply to ordinary upstream
worlds; their RANDOM sizing leaves SPECIFIC bands dormant. Keep those files with
ordinary saves. See [world generation](worldgen.md) for preset boundaries.

SeedGen is excluded because its reconstructed vanilla noise terrain does not
match Sky Archipelago. Do not use it to fill missing island LODs. Preserve world
and LOD identity when troubleshooting; renderer visibility and network transfer
are separate problems. See [graphics](../players/graphics.md) for diagnosis.

The renderer uses a 256-chunk radius with cave culling disabled so island
undersides remain visible. Compat supplies per-world cache identities; retain the saved world identity when diagnosing LODs.

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
fluids and other shaders remain untested. See Skyweave: Compatibility Patches'
[DH development notes](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/lod.md)
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

- Complementary r5.9.3 is paired with Euphoria Patcher 1.10.5. Shader assembly publishes the complete generated result; see [shader patching](#shader-patching) for startup/cache ownership.
- JEI remains alongside EMI for recipe integrations.
- Connector and Forgified Fabric API support the Hoofprint/Surveyor/McQoy stack.
- URL pins handle provider metadata conflicts involving old exact versions,
  Connector/Forgified Fabric API and client-only dependencies. Check runtime
  metadata before replacing them with provider roots or downgrading dependencies.
- Published URL pins select DH Polygon Fix, Copycat Bar Extrusion, Skyweave: Compatibility Patches
  with content digests. The compatibility mod itself requires no content mods; this pack
  enables its Sky Archipelago 1.4 preset and Sky Villages/Architectury adapters.
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
[Compat investigation](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/hoofprint.md)
owns the source/bytecode evidence and proposed fractional client zoom, including
initialization, dimension changes and pointer anchoring. It is not implemented
or verified in game; the pack retains the existing default.

## Controls and resource packs

FTB Quests 2101.1.38, FTB Teams 2101.1.12 and FTB Library 2101.1.39 pass an
isolated full-pack dedicated startup and clean shutdown with Questlog retained
(2026-11-09, NeoForge 21.1.265 / Java 21). Exact JAR metadata satisfies the shared
Architectury 13.0.11 requirement. The native key IDs are inspected and source
defaults/export payloads verified; client key dispatch, FTB UI, shared quest
gameplay and the planned spawn/Nether adapters are not qualified by that startup.
The [team/access guide](team-world-progress.md) owns the selected policy and
remaining implementation boundaries.

Better Climbing, Ping Wheel, Easy Anvils, Easy Magic and
Inventory Totem ship on both sides. Camera/UI/rendering mods and resource
packs are client-only. EMF/ETF support Fresh Animations; Puzzles Lib, Collective
and Searchables satisfy the corresponding dependencies. Exact selections are in [MODLIST](../MODLIST.md).

| Domain             | Authored choice                                                                                                                                                                                                              |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Flight camera      | Elytra retain vanilla steering and firework propulsion. Better Third Person's independent elytra camera stays off.                                                                                                           |
| Inventory movement | Preserve sneaking and prevent dismounting. Text focus disables movement. Unknown screens default off; books, advancements and all Ponder browsing views also disable movement. EMI/JEI compatibility modules remain enabled. |
| Communication      | Ping Wheel keeps its range, channel and rate-limit defaults, with ten-second markers and 50% volume. Chat Heads retains its defaults.                                                                                        |
| Tooltips           | Keep durability/enchantment information, omit extra blank-line spacing. Shulker Box Tooltip retains its native preview defaults.                                                                                             |
| Workstations       | Keep generated Easy Anvils costs and maintenance settings. Easy Magic shows all enchantments while retaining paid rerolls. Do not disable old vanilla workstations.                                                          |
| Visual resources   | Use the current selection and ordering in [Graphics](../players/graphics.md#resource-packs). Retain EMF/ETF defaults. Existing options remain seed-managed; explicit syncs update only the reviewed selection.               |

Mouse Tweaks 2.26.1, Inventory Profiles Next 2.2.5 and libIPN 6.6.3 are client-only. The isolated full-pack survival fixture verifies one-item wheel transfer, Shift-drag of two stacks, middle-click sorting/stack merging and IPN's manual transfer button with conserved counts. A worn iron pick (damage 245) is retained in inventory while a replacement is selected and used (damage 1). Authored IPN settings disable scrolling, swipe movement, equipment profiles, armor refill and hotbar restocking. Mouse Tweaks owns wheel/drag; IPN sorting uses middle-click to preserve R recipe lookup. Auto Refill also handles consumed stacks. These checks do not cover every machine/filter/result slot or every modded tool. Update boundaries live in [patch maintenance](patches.md#routine-dependency-upgrades).

Creative-flight inventory sneaking uses InvMove's `MaintainWhilePressed`: descent
already active when the screen opens continues until the sneak key is released.
A fresh Shift press inside the screen does not start descent, so Shift-clicking
items does not move the flying player down. Ordinary inventory sneaking remains
`Maintain` for edge protection. This policy is source-reviewed for held sneak;
toggle-sneak behavior and a new native flight check remain separate verification.
Existing installations retain their seeded config until explicitly updated.

InvMove 0.9.3 applies this flight policy in its held-sneak path. Toggle crouch
uses a separate path, so it needs its own native check before claiming the same
protection. Its key polling refreshes keyboard key-symbol bindings, not mouse or
scan-code bindings. Text-focus protection covers vanilla edit boxes, recipe-book
search and supported integrations; arbitrary nested mod widgets are not covered
by that inspection alone. Ctrl/sprint, Space/jump and passenger dismount behavior
also need separate checks when changing bindings or adding interactive screens.

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

| Preset               | Overworld maximum | Nether maximum | End maximum |
| -------------------- | ----------------- | -------------- | ----------- |
| Complementary r5.9.3 | 12                | 7              | 12          |
| Euphoria 1.10.5      | 12                | 7              | 12          |
| BSL 10.1.8           | 10                | 10             | 10          |

These are measured composite/deferred sampler counts. Instrumented construction
of all nine shader/dimension pipelines passed with DH 3.3.3, SSRD and Polygon Fix
1.0.0 present. The test did not exercise actual dimension travel, terrain visuals
or frame rates. Version 1.0.1 preserves that patch's runtime query implementation.

The presets retain most HIGH effects, reduce shadow distance to 128 blocks and
lower Complementary/Euphoria light-shaft sampling. Reduced shadow coverage and
sampling suggest less work; no fixed-scene FPS improvement was measured. Lower
light-shaft sampling may show more noise in motion.

## Verification scope

The 0.13.0 release pins Compat 0.32.0 and the same published JAR as the shader-lab
runner. Its local qualification passes 82 pack tests, 37 Atlas Python tests
(one skipped), Atlas lint/unused-code/JavaScript/build checks, the configuration
and village/quest generation audits, and all three distribution builds. Archive
inspection verifies one Compat JAR, the seven authored village-fitting defaults,
client/server separation and portable Prism commands. Native village, material,
locator, persistence and Wayfinder evidence is owned by
[Compat verification](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/verification.md#village-fitting-and-discovery-0320).
These bounded checks do not establish world-wide encounter rates.

Choose checks that exercise the change:

| Change                    | Relevant checks                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------ |
| Documentation             | Local links and anchors, source paths, commands and claims against current files                       |
| Configuration             | Parse files; compare the intended keys; inspect affected exports when packaging changes                |
| Dependencies or placement | Sync, build all profiles, compare payload hashes and side exclusions                                   |
| Shaders or rendering mods | Construct pipelines, then test island edges, water/glass, ships, lighting and dimension travel in-game |
| Generation or physics     | Test a disposable world and representative ships; preserve production world data                       |
| Release                   | Verify CI, downloaded checksums and critical published archive contents                                |

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

Skyweave: Visual Patches composes selected models, textures and animation resources
above the retained source packs. Skyweave: Resource Patches owns shared data and
supporting translations. Runtime renderer and collision fixes belong to Compat.
[Patch maintenance](patches.md) owns exact inputs, generators and coupled update
checks; [resource authoring](web/models.md) owns browser editing and preview limits.
A resource reload or correct browser model alone does not verify in-game collision,
block-entity animation, connected textures or shader behavior.

### Category review world

Use the generated [Debug World](debug-world.md) for native comparisons. It replaces
the old hand-reviewed Resource Review fixture. The generator, placement manifest
and native probes own coverage; labels and screenshots do not prove every expected
state was placed. Keep personal worlds separate from disposable comparisons.

### Selective model comparisons

Accepted selections and pending resource comparisons live in Atlas authoring and
its source manifests. Preserve the chosen per-object resources and explicit review
decisions when upgrading a broad source pack. Do not enable an entire candidate
pack merely because selected objects passed review.

### Visual compatibility pass

Review resource inheritance, UVs, render type, animation ownership and resource
priority together. Inspect both unchanged controls and touched objects in game.
The [historical visual evidence](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/compatibility.md#visual-compatibility-pass)
retains the tested objects and exact earlier artifacts.

## BlueMap model parsing

The optional Skyweave: Compatibility Patches viewer adapter targets BlueMap 5.7 on dedicated
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

Server LOD availability, client cache coverage and renderer visibility are separate
states. DH can retrieve generated server sections without a prior player visit;
movement changes nearest-first request priority and native chunks also contribute
LODs. Incomplete client coverage is not evidence of a missing server world.
Check the handshake, dimension/cache identity, negotiated limits and errors before
clearing caches or regenerating terrain. [Player graphics](../players/graphics.md)
owns the troubleshooting sequence.

### Transfer tuning

Authored endpoints use 2048 KB/s per-player bandwidth, 64 generation/download
requests and 100 sync-on-load requests. DH uses the lower negotiated client/server
limits. Four workers, a 256-chunk render radius and CHUNKS_ONLY / INTERNAL_SERVER
remain pack choices, not universally optimal performance settings. The progress
overlay is a local preference. A world reset or shader change does not justify
silently deleting caches. [Server operation](../players/server.md) owns pregen.

Island-aware request ordering remains a proposal. It would need conservative
occupancy and fairness without changing generated terrain or starving empty-sky
requests; no such DH scheduler is claimed here.

## Resource rendering repairs

The visual ZIP admits eight generated Lootr barrel sprites to the block atlas.
Missing admission caused pink/black sides despite valid PNGs and model bindings.
Normal and trapped Lootr chests are distinct blocks with the same display name;
the trapped variants now receive the approved artwork while retaining their red
marker. The fixture labels the trapped specimen explicitly.

Selected azalea plant geometry is composed with Fresh pots and soil. Their donor
uses shared templates, so selection follows actual shrub roots rather than the
similarly named leaf models. Existing mushroom/fungus pots and potted cactus keep
their selected treatments; the cactus donor's simpler potted model is not adopted.

Create/Rechiseled missing interior window faces originate in native face-removal
rules. Disabling MoreCulling's block-state option did not restore them. The broad
resource workaround is disabled and native culling definitions are restored:
uncullable faces exposed matching-window interfaces and lacked Create CT context.
Compat supplies independent client repairs for Create material boundaries
and Rechiseled pillar axes while retaining native CT/Fusion processing. Both are
enabled in the pack startup defaults. Pane models are unchanged.
See [patch boundaries](patches.md#window-connections-and-copycat-panels) for update
requirements and [verification](web/verification.md#resource-rendering-repairs-2026-11-02)
for the tested cases and limitations.

`create.glass_backfaces` and `fusion.glass_backfaces` additionally show exposed
surfaces from behind after native texture processing. Both default on when their
optional dependencies qualify. Neighbor visibility remains a
separate decision, so matching interfaces and opaque-neighbor occlusion retain
their native rules. The [patch reference](patches.md) owns coverage and update checks.

The [generated Debug World](debug-world.md) classifies glass blocks, panes and
mesh/grates by registered inheritance, tags and explicit family choices. Doors
and pipes are excluded from those groups. The
Macaw's sloped chain-hung appearance is approved; flat bridges retain the regular
standing lantern. The matching optional Compat adaptation moves the stair outline and preserves
selection outside its owning cell. Physical collision remains empty. Their matched views are in the
Atlas at `/resourcepacks/reviews?feature=bridge-lantern`.

## Evidence history

[Pack verification](verification.md) records released artifact checks. Older event
records remain available in the published 0.10.0 tree; they are not current
operating procedures. Relevant resource comparison records are linked below.

<a id="release-0100"></a>
- [Release 0.10.0](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/compatibility.md#release-0100)

<a id="release-082"></a>
- [Release 0.8.2](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/compatibility.md#release-082)

<a id="release-080"></a>
- [Release 0.8.0](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/compatibility.md#release-080)

<a id="release-060"></a>
- [Release 0.6.0](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/compatibility.md#release-060)

<a id="release-040"></a>
- [Release 0.4.0](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/compatibility.md#release-040)

<a id="release-023"></a>
- [Release 0.2.3](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/compatibility.md#release-023)

<a id="shader-assembly-022"></a>
- [Shader assembly, 0.2.2](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/compatibility.md#shader-assembly-022)

<a id="pack-verification-0124"></a>
- [Pack verification, 0.1.24](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/compatibility.md#pack-verification-0124)

<a id="pack-verification-0123"></a>
- [Pack verification, 0.1.23](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/compatibility.md#pack-verification-0123)

<a id="journal-adaptation-2026-10-31"></a>
- [Journal adaptation, 2026-10-31](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/compatibility.md#journal-adaptation-2026-10-31)

<a id="rendering-baseline-2026-10-29"></a>
- [Rendering baseline, 2026-10-29](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/compatibility.md#rendering-baseline-2026-10-29)

<a id="weight-classification-verification"></a>
- [Weight classification verification](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/compatibility.md#weight-classification-verification)

<a id="analog-audio-release-verification-0119"></a>
- [Analog Audio release verification, 0.1.19](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/compatibility.md#analog-audio-release-verification-0119)

<a id="release-verification-2026-10-29"></a>
- [Release verification, 2026-10-29](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/compatibility.md#release-verification-2026-10-29)

<a id="compatibility-fixture"></a>
- [Compatibility fixture](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/compatibility.md#compatibility-fixture)

<a id="release-0126-verification"></a>
- [Release 0.1.26 verification](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/compatibility.md#release-0126-verification)
