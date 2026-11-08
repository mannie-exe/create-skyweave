# Compatibility and verification

This reference describes constraints behind the current pack configuration.
Player instructions belong in [graphics](../players/graphics.md) and
[server maintenance](../players/server.md). Exact versions are in the
[content list](../MODLIST.md), with authoritative selections in `empack.yml` and
`empack.lock`.

## Release 0.6.0

Verified with Minecraft 1.21.1, NeoForge 21.1.265 and public Compat 0.26.0
(SHA-256 `7c4ef971b83fc4efe61ca81c711066f496652691e30bc29d56789463505e2b60`).
The downloaded JAR matches the tested native build and published checksum manifests;
its Linux, Windows and macOS release checks pass. Pack checks pass all 67 Python
tests, the 260-file configuration audit and 88 unchanged journal outputs. Both
resource builders and shader-lab generation with the published runner pass.

All three local distributions build with the new Compat and Dynamic Waters pins.
Archive CRC, duplicate-entry, side placement and shader-input separation checks
pass; the server terminal wrapper is applied. These are local export checks,
separate from verification of the eventual published pack assets.

The Atlas uses a fresh isolated export of the locked dependencies. Data checks,
formatting, unused-code checks, tests and the 16-page build pass. Historical
world/ore surveys retain their recorded inputs; this refresh does not rescan the
personal server world or alter application layouts.

## Island water and environment

Skyweave's marked island preset disables Sky Archipelago's native rivers and
lakes. Dynamic Waters 13.1.0 supplies terrain-following mountain watersheds and
basin lakes through Compat's supported-column bridge. Its lowland mode remains
`VANILLA`; `NONE` also rewrites density inputs. Mountain tunnels are disabled.
Native Lagoon/Broken Reef habitats and their coastal/falling-edge treatments
remain independent. Generation settings belong to the saved world identity;
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

## Release 0.4.0

Verified on 2026-11-07 with Minecraft 1.21.1, NeoForge 21.1.265 and the public
Compat 0.24.0 JAR (`6903219861c1479a29224b1dbed7c21847c1647d50db0d995bed67a4a4ce2ff4`).
Its published bytes match the locally tested build and the Linux/Windows/macOS
release matrix. All 67 pack Python tests, 88 journal outputs and the 258-file
configuration audit pass. Shader-lab and both resource builders retain their
existing outputs. All three distributions build and their archives contain the
new Compat pin and enabled ocean profile; the server terminal wrapper is applied.

Compat's [native verification](https://github.com/mannie-exe/skyweave-compat/blob/v0.24.0/docs/development/verification.md#cluster-structure-distribution)
owns structure-policy fixtures, specialized materialization/loot, configuration,
parallel/order/cache/lifecycle checks and limitations. This pack changes generation
identity and requires a fresh world. It does not qualify every structure layout,
ocean progression or survival scarcity. Existing resource and shader choices are
unchanged; their earlier visual evidence retains its scope.

The Atlas runtime was captured from the complete locked mod set in a disposable
server, then extracted and compiled. Snapshot checks pass. Historical world and
village surveys remain observations of their recorded inputs, not a scan of the
new server world. No Debug World regeneration is required by this update.

## Release 0.2.3

Verified on 2026-11-06 with Minecraft 1.21.1, NeoForge 21.1.265 and public Compat
0.22.1 (`da95628b57af390f5736a6b7838a73299a33847689c359f84a5c1d758f67384f`).
All 64 pack Python tests, 88 journal outputs, the 257-file configuration audit,
shader-lab generation and both resource builders pass. Generated visual patch
SHA-256 remains `c53e933e702961bfb238b953e98afe52f296506daea8250ca721b6c1f895c191`.

All three reference profiles build. Archive inspection checks CRCs, unique
entries and destinations, every embedded asset hash, runtime and Compat pins,
client/server renderer exclusions and the server terminal wrapper. Shader inputs
and recipes are client-only; complete generated BSL/Complementary ZIPs are not
included as managed payloads. The `.mrpack` retains valid external downloads
that Modrinth hosting does not admit, including Ponder's Maven URL and Absolute
Kinematics' CurseForge CDN. GitHub remains the distribution target.

The current native UI and rendering evidence belongs to Compat's
[verification guide](https://github.com/mannie-exe/skyweave-compat/blob/v0.22.1/docs/development/verification.md).
The pack update changes no terrain formulas, saved world identity, seed or ore
distribution. That release precedes the Sky Archipelago 1.4 port.
Atlas checks and Debug World evidence are in [web verification](web/verification.md).

## Shader assembly, 0.2.2

Skyweave: Compatibility Patches 0.21.0 supplies the physical-client runner. Both
qualified chains use the same Java engine for lab and recipient builds. Canonical
recipe and input hashes qualify ordered overlays, Euphoria's binary delta and
Skyweave Glass 0.1.0. The prior shader file payloads are unchanged; controlled ZIP
metadata makes generated archives reproducible across the two build paths.

Native Apple Silicon checks with Java 21.0.13, NeoForge 21.1.264 and Iris
1.8.14-beta.1+mc1.21.1 cover missing-output startup, BSL without Euphoria, the full
Euphoria stack, cached loads, forced rebuilds, shader switching, resource reload,
failed preconditions and same-reload output-name migration. The glass and
static/assembled material fixtures rendered with both shaders. The minimal client
loads without Iris/Euphoria; disposable standalone/full dedicated checks pass.
Native Windows GPU rendering and Photon on Apple hardware were not tested.

A disposable reference export installs managed inputs and recipes without a
finished shader ZIP. After client generation, empack prepare reports zero exact
changes and no file conflicts. Unrelated shaders, option seeds, personal worlds
and LODs are outside runner ownership. The shader lab's exact-byte check, pack
unit tests, journal generator and categorized configuration audit pass. Export
checks enforce client-only inputs/recipes, absent merged-shader assets and a
payload-only Colorwheel Patcher outside `mods/`.

The [shader lab](../../tools/shader-lab/README.md) owns recipes and upgrade checks;
Compat's [rendering guide](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/rendering.md#shader-assembly)
owns runtime hooks and cache/settings behavior. Existing limits for moving
shadows, resource-pack texture assumptions and other GPU paths remain below.

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
The resource-only fixes JAR restores nine block drops using the 1.21 loot directory
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
resource-only fixes JAR. Carry On supports [tag-based exclusions](https://github.com/Tschipp/CarryOn/wiki/Black---and-Whitelist-Config). Its optional block IDs cover these reviewed families:

| Content                | Restricted parts                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Simulated              | Assembler, swivel bearing and plate, merging glue, rope winch/connector, docking connector, torsion spring and spring |
| Absolute Kinematics    | Hinges, ball joints and their paired parts                                                                            |
| Transmission & Linkage | All eight linked machinery/auxiliary blocks, including heads, regulator and conversion bearing                        |
| Linear Bearing         | Bearing/carriage, magnetic port, torsional anchor and gyroscopic gearbox                                              |
| Aerocables             | The two cable endpoint blocks                                                                                         |

Carry On configuration uses the seed policy. Existing installations must merge
`#create_skyweave:carry_on_restricted` into `blacklist.forbiddenTiles` and restart;
replacing the resource JAR alone does not add the blacklist reference. Preserve
other operator settings.

Keep the upstream Create/Copycats, protected-container, grave and entity exclusions.
Backpacks were already excluded by the loaded rules; no duplicate namespace rule
was needed. Ordinary chests, barrels and furnaces remain carryable. The Linear
Bearing redstone converter also remains eligible. Other Simulated and Aeroworks
controls, Power Grid networks and modded inventories need individual evidence
before changing their rules; a block entity alone is not a reason for exclusion.

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
tutorials and server-backed inspection. The shared fixes resource supplies English
names for internal carriage blocks and corrects the gyro acquisition advancement's
old stabilization claim. Guidance does not add another drive or progression gate.
The mod's [machinery reference](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/linear-bearing.md#ponder-and-jade)
owns registration, optional loading and update procedures.

## Dependency update constraints

Minecraft remains 1.21.1. Sky Archipelago 1.4 changes core generation and explicitly
warns that 1.3.6 worlds may be incompatible; retain 1.3.6 and Compat's matching
terrain hooks for existing saves. This is a separate migration review.

Questlog 3.5.3 uses Compat 0.10.2's reviewed journal gate. Radars 5.0.3 replaces
six old jammer thresholds/scales with full-power RPM and directional/severe onset
fractions; native config correction retained every other pack value. JEI and
Reliable EMI update together with existing MezzConfig, EMI and YACL versions.
The two AK recipes and journal requirements/rewards remain unchanged.

Empack's provider graph declares an exact older JEI through Aeronautics Covers,
although Covers' native JAR declares JEI optional with an unrestricted version.
Updating both logical keys selected the old catalog reference. Explicitly adding
the checksummed new JEI JAR with provider identification and Covers in one forced
batch retained Covers and selected the intended JEI. Restore exact author pins
and materialize before building; review joint selections for unintended downgrades.

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
The playable pack and shader-lab runner have independent exact pins. The lab
runner owns offline shader generation; update it when shared-engine behavior or
recipe schemas change, and qualify outputs against the playable runtime. Compat
0.23.0 changes generation without changing that engine, so the lab retains its
0.22.1 runner. The buffer and DSA repairs do not replace the sampler/material adapters: the inspected
`ClrwlProgram` and `GlCompat` classes are unchanged from 1.3.0. The 2026-11-05
candidate check on NeoForge 21.1.265 covered shader-off instancing, generated
BSL and Complementary/Euphoria shaders, static and assembled material samples,
and native emission-buffer writes. It does not repeat the earlier moving-ship,
Ponder or minimum-client checks.

### Shader patching

The Skyweave Glass patch produces the merged Complementary Unbound 5.9.3 /
Euphoria 1.10.5 / Skyweave shader. Euphoria's broad Create translucent-layer override and generic glass
materials caused opaque window frames to receive glass shading. The builder uses
texture alpha to select 32 cutout and six translucent Create blocks, preserving
partial-alpha glazing and glints. Opaque frame texels no longer receive built-in
glass reflections; authored custom PBR is unchanged. Create retains CT ownership.
This material correction does not fix coincident backfaces or pane intersections.
The [lab guide](../../tools/shader-lab/README.md) owns inputs, update checks, and
the unresolved modified-shader distribution requirement.

On 2026-11-04, the isolated Java 21/macOS ARM64 client loaded the generated shader
with Minecraft 1.21.1, NeoForge 21.1.264, Create 6.0.10, Sodium 0.8.13, and the
selected Iris/Colorwheel stack. Eighteen matched captures cover oak, birch,
framed glass, weathered iron, ornate iron, and an oak pane with upstream shaders,
the adaptation, and shaders off. Frame reflections are reduced while glazing and
pane details remain visible. The water, cutout, and shadow programs compile;
inherited derivative-extension warnings remain. Custom PBR, moving constructs,
DH material fidelity, and touching-surface ordering were not verified by this test.
Evidence and the executed protocol remain in the resource harness under
`images/2026-11-04-shader-glass`.

The tested shader SHA-256 is
`4980eb3f34d0100e6c00ab5ca2bc61ec4147d9e862370f9fb7a31325f7d99de3`.
`python3 tools/shader-lab/build.py --check`, 64 pack tests, the 255-file config
audit, and the isolated bundled Prism build pass. Default release profiles remain
references. No personal installation or server was changed.

The [shader lab](../../tools/shader-lab/README.md) pins BSL 10.1.8 and
Colorwheel Patcher 1.0.5 as original inputs. Compat's shared recipient engine
applies the embedded Colorwheel overlay and scoped Skyweave environment edits,
producing `BSL_v10.1.8 + Clrwl_1.0.5 + Skyweave_0.2.0.zip` locally. Neither plain
BSL nor a managed premerged shader is placed in Iris's list. The patcher archive
is input data rather than a runtime mod; Colorwheel's runtime remains installed.

Complementary/Euphoria uses the same engine and adds Skyweave 0.2.0 environment
corrections while retaining the separately versioned Skyweave Glass 0.1.0 material
policy. Native candidate checks compile/reload both corrected chains, distinguish
low open sky from an enclosed room, and preserve the existing material corrections.
Unknown shaderpacks and Photon on Apple hardware remain outside that evidence.
The lab guide owns canonical recipes, payload qualification and distribution.

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
transmission and gyro evidence linked above. Local client/server installation
used downloaded, checksum-verified release archives. Both subsequent preparation
checks reported zero changes. Stopped-world/client-save/LOD metadata and protected
settings matched before restart; the existing server then reached its normal ready
state with the three machinery adapters active. BlueMap returned HTTP 200.

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
[mod verification](https://github.com/mannie-exe/skyweave-compat/blob/v0.7.0/docs/development/verification.md#release-070)
owns artifact identifiers and detailed limits.

## Rendering baseline, 2026-10-29

Create Sky 0.1.20 selects Compat 0.6.1 and removes standalone Veil Iris Fix.
`skyweave_compat-features.properties` explicitly selects pack behavior; the cache
identity option remains off. Compat's own minimum installation needs NeoForge
alone. Disabled adapters select no target mixins, callbacks, or integration data,
and do not reject target versions. Terrain identity remains protected.

Compat 0.6.1 passed 64 JUnit cases, five release-tool checks, exact artifact/package
checks, and standalone/full dedicated-server startup and shutdown. The 0.6.0
boundary matrix passed seven selections, and native minimal island generation /
reopen retained ore counts. No generation algorithms changed in 0.6.1.
See [the exact artifacts and limits](https://github.com/mannie-exe/skyweave-compat/blob/v0.6.1/docs/development/verification.md#release-061).

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

- Complementary r5.9.3 is paired with Euphoria Patcher 1.10.5. Euphoria generates
  its patched shader at launch; its generated folder name determines the preset filename.
- JEI remains alongside EMI for recipe integrations.
- Connector and Forgified Fabric API support the Hoofprint/Surveyor/McQoy stack.
- URL pins handle provider metadata conflicts involving old exact versions,
  Connector/Forgified Fabric API and client-only dependencies. Check runtime
  metadata before replacing them with provider roots or downgrading dependencies.
- Published URL pins select DH Polygon Fix, Copycat Bar Extrusion, Skyweave: Compatibility Patches
  with content digests. The compatibility mod itself requires no content mods; this pack
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
[Compat investigation](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/hoofprint.md)
owns the source/bytecode evidence and proposed fractional client zoom, including
initialization, dimension changes and pointer anchoring. It is not implemented
or verified in game; the pack retains the existing default.

## Controls and resource packs

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

## Weight classification verification

[Building weights](weights.md#verification-2026-10-29) records the exact resource
artifact, all-state comparison, representative assemblies and limits. The
resource-only change needs no Skyweave: Compatibility Patches update.

## Analog Audio release verification, 0.1.19

[Create Sky 0.1.19](https://github.com/mannie-exe/create-skyweave/releases/tag/v0.1.19)
was published from `59ed4fecdb1cdbad2e64475adf03dd829da81ce5` by
[release run 40845603600](https://github.com/mannie-exe/create-skyweave/actions/runs/40845603600).
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
[Compat verification](https://github.com/mannie-exe/skyweave-compat/blob/v0.5.2/docs/development/verification.md#release-052)
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

[Create Sky 0.1.18](https://github.com/mannie-exe/create-skyweave/releases/tag/v0.1.18)
was published from `045784a79d5d7ed75fb6ac4eb5d8c3371733599b` by
[release run 40834796342](https://github.com/mannie-exe/create-skyweave/actions/runs/40834796342).
The isolated pack checkout passed 28 Python tests, the 242-file audit, both
resource builders, all three reference builds and the server archive patch/check.
No Atlas or unrelated journal-authoring edits entered the commit or builds.
Skyweave Compat remained at 0.5.1 because its distributable behavior did not change.

Downloaded assets matched `SHA256SUMS`. Archive CRCs, embedded asset hashes,
runtime pins, dependency sidedness and the native-tested fixes JAR passed inspection.
Only that JAR changed in the client/server managed payloads from 0.1.17.

| Published archive | SHA-256                                                            |
| ----------------- | ------------------------------------------------------------------ |
| Prism references  | `d93b48d4beb1ddc7bd14ca7b3302964a9db76e56d0fab8ef77f32c31ccdf6b2d` |
| Modrinth          | `8bb0f953010482a97eacaf3fc1fa5ddc8c1066d8c1f4d9d1b5a5327cd2e08e83` |
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
Surfaces, Lamp variants, Connections, Barrel details, Workstations, Garden details,
Shelves and hives, Small props, Doors and surfaces, Selected workstations and
Selected garden. `/function resource_lab:hub`
returns to its controls. These are
comparison categories, not a division by mod or resource-pack coverage. The
fixture source, manifest and stopped-world checker live in
`~/Minecraft/modpack-testing/projects/create-sky-resources/`.

The installed registry has no non-vanilla `minecraft:crops` members or additional
crop block implementations in the inspected plant classes. The plant displays
therefore compare vanilla growth stages, stems, cane, fungi and aquatic plants.
All eight ladder families are present: vanilla; Create andesite/brass/copper;
Create Deco iron/industrial iron/zinc; and Copycat. Apply a material to the
Copycat sample yourself. Gingerbread men sit beside the stationary animal specimens.
The equipment chest and enclosed pen support motion checks. A powered adjustable
burner and propeller/press Ponder buttons support shader comparisons. Other
machinery and track samples do not establish working contraptions. The expanded
fixture has bounded rebuilds, ground support, occupied shelf inventories, pond
banks and native navigation. Its writer refuses an open world. The retained local
debug datapack updates its layout on the next load; it selects no resources.

| Family                           | Installed behavior and remaining work                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Macaw lanterns                   | Bell, covered, cross and festive standing/hanging variants use fitted artwork. Flat bridges retain the detailed standing lantern; stair bridges use a short-chain hanging model and matching optional Compat selection. The bridge must be directly below the lantern; its state selects the elevation. Native shader-off/on views cover representative variants. Wall variants retain their brackets with fitted lantern bodies.  |
| Create and Deco bars             | Texture-mask extrusion covers all three Create families and Deco's andesite, brass, copper, industrial iron, iron and zinc model families, including overlays. Native posts, ends, corners, crossings and three-block stacks were reviewed. Deco overlays are connected bars with additional panels, not wall decals. Connection blockstates remain upstream-owned.                                                                |
| Cage lamps and frontlights       | Deco's cage surfaces have depth while its base, light and material/color bindings remain intact. Eight DnD hood templates retain their bodies, texture bindings, rotation, lit and no-base variants. Representative straight/rotated and powered/unpowered views passed with shaders on and off.                                                                                                                                   |
| Mooshrooms                       | Details 2.4 uses the current shared cow rig; no pack rig replacement remains. The isolated updated client rendered adult/baby mooshrooms and a sleeping villager with visible feet. Stationary fixture specimens still need `OnGround:1b`. Rare random variants, every animation state and all equipped models remain untested.                                                                                                    |
| Aquatic plants and pitcher plant | Lily pads now use 3D Default, and pitcher plants/crops use Toasty V3 with the maintained angle adaptation. Kelp and seagrass retain the existing stack by review decision; their flat geometry is not a load-order fault.                                                                                                                                                                                                          |
| Barrels                          | Fresh Objects 2.1.2 supplies no barrel CEM model. A barrel changes its block-state model/texture when opened; it has no chest-style lid renderer. An open-state model can change the silhouette, but smooth lid motion would require a renderer and transition state.                                                                                                                                                              |
| Lootr chests                     | The [adapter](patches.md#lootr-and-fresh-objects) supplies the exact `lootr_lootr_chest` and `lootr_lootr_trapped_chest` model names requested by EMF, with literal body/latch bindings and an isolated animation resource. Native opening/closing, body motion, generated loot, state textures and neighboring-chest independence passed locally. Lootr continues to select its own materials; `vanilla_textures` stays disabled. |
| Other models                     | Connected glass families, decorative machinery and moving objects need family-specific checks. Sharing a texture or parent is not proof of matching UVs, connection rules or renderer behavior. New creature animations need a rig/part mapping; extrusion cannot infer joints or behavior from a sprite.                                                                                                                          |

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

Current unselected experiments are described in [selective model comparisons](#selective-model-comparisons).
The maintained patch uses the model recipes and renderer adapter described above;
review ZIPs do not change its output.

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

### Selective model comparisons

The review captures use Create Sky 0.1.30 (`86752bd`), Compat 0.14.0,
Minecraft 1.21.1 and NeoForge 21.1.264. They remain dated comparisons against the
pre-selection stack. The production selection is owned by
`authoring/resource-selections.json`; the full donor packs are not enabled.

| Feature                                         | Approved treatment                         | Scope                                                                                                                                                               |
| ----------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Crafting table, stonecutter                     | Classic 3D Alpha 9                         | Other workstations are selected individually below.                                                                                                                 |
| Lily pads, cactus                               | 3D Default 1.16.0                          | Existing flowers, mushrooms, fungi, pots, sugar cane and seagrass remain unchanged.                                                                                 |
| Doors and trapdoors                             | 3D Default 1.16.0                          | All supplied vanilla wood, iron and copper families; masonry and other surfaces remain unchanged.                                                                   |
| Lodestone, copper bulbs, hay bales              | 3D Default 1.16.0                          | Bulb oxidation/power variants are included; waxed states use the same native roots.                                                                                 |
| Campfires                                       | 3D Default 1.16.0                          | The shared template is isolated under the lit campfire roots. Earlier selective screenshots did not activate this template; a fresh visual check remains necessary. |
| Redstone torches                                | Nautilus 3D V2.2                           | Floor/wall and on/off models with their required textures.                                                                                                          |
| Single ordinary/trapped and Lootr chests        | C: 3D Default geometry + Fresh Objects rig | All four JEMs match the reviewed prototype. Large and ender chests retain their existing rigs and were controls in C.                                               |
| Smoker, furnace, fletching table                | UltiCraft 3D Models                        | Selected roots and their private model/texture dependencies.                                                                                                        |
| Smithing table, brewing stand                   | Jacob’s 3D Workspace+                      | Other Jacob models remain unselected.                                                                                                                               |
| Cartography table, blast furnace, crafter, loom | 3D Vanilla                                 | Upright crafter cases are explicit in the Atlas.                                                                                                                    |
| Azalea, flowering azalea                        | Vervada’s enhanced plants                  | Dead bush and seagrass retain the existing stack.                                                                                                                   |
| Pitcher plant and crop                          | Toasty’s Perfect Pitchers V3               | Original angles retained through NeoForge composite root transforms.                                                                                                |
| Kelp                                            | Current stack                              | Bushier Kelp deferred after visual review.                                                                                                                          |
| Bookshelves, hives/nests                        | Current stack                              | Connected bookshelf framing is retained.                                                                                                                            |
| Vanilla barrels                                 | Current stack                              | No new vanilla barrel override is selected.                                                                                                                         |
| Lootr barrels                                   | Native cube + approved trim artwork        | Directional artwork and approved corner-clasp extrusion preserve Lootr material/state selection.                                                                    |

The [visual comparison page](http://127.0.0.1:4321/resourcepacks/reviews) displays
this matrix beside the archived evidence. The source gallery also retains those
images and recordings. The captured ZIPs, camera/state metadata and eight native
closing clips remain in the Resource Review harness. They establish the shown
variants, not a new in-game verification of the assembled production ZIP.

Native checks covered six barrel orientations, up-facing vanilla/Lootr opening,
ordinary/trapped double-chest formation, and single ordinary, trapped, ender and
Lootr containers. Closing clips demonstrate the tested single-chest compositions.
Shader-off checks cover the captured families; a subset also uses Complementary
Unbound 5.9.3 with Euphoria 1.10.5. Fixture revision 9 passed 7,119 placements,
31 inventory slots, 27 stationary specimens and save/reopen checks. Multiplayer
loot independence, legacy Lootr styles, every held-item representation and moving
constructs were not verified in that review.

The production builder selects explicit model/blockstate roots and relocates
required donor helpers and textures into per-source namespaces. Copied textures
stay inside the block-atlas discovery directory and retain animation metadata.
Global templates, interfaces, shaders, PBR maps and unselected model families are
excluded. Campfires use vanilla leaves with a private donor template, avoiding a
global template replacement. The expanded door-family coverage and campfire
composition need a new native review before claiming complete visual coverage.

Static checks verified dependency closure, deterministic generation, unchanged
excluded roots and existing repairs. The only changed pre-existing asset bytes
are the two intended Lootr chest JEMs; new ordinary/trapped C JEMs are added above
Fresh Objects. Existing model and animation controls remain available.

#### Lootr storage artwork

All four gold/gray barrel and chest variants are approved and included through
`authoring/texture-resources.json`. Their generator preserves each native palette,
wood and alpha while relighting recognized trim. The brightest color marks short
speculars, with broad connected highlights and softer bounce on shadow sides.
Barrel knobs and chest latch accents follow the selected front-right direction.

The barrel keeps its cube and uses separate side textures; no vanilla hoops,
extra staves or smooth lid animation are introduced. Modern open-cap variants
preserve their interior pixels, and legacy branches remain native. Chest exterior
UV fitting applies only to the Lootr CEMs, retaining Fresh Objects' animation rig
and the composed single-chest geometry. These latest PNG/UV bindings have generated
resource and web-render checks; they do not extend the older native animation
verification to every newly composed state.

### Patch generation boundary

The [client patch builder](build.md#local-builds) pins exact source archives,
checks selected empack versions for installed inputs and SHA-512 for every input,
and validates the pot elements and chain
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

Vanilla Experience+, Fresh Moves and Dramatic Skys remain separate deferred
comparisons. Fresh Moves needs motion/equipment checks; sky rendering needs
day/night and shader-on/off checks, not only a still image.

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

On 2026-10-26, islands became visible from spawn after the player approached them
and returned. The client log at 21:32 confirmed the DH handshake and the current
`create-skyweave-20261026-a0fb6687aa24` level key. Both sides used CHUNKS_ONLY,
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

| Setting                                           | Previous | Tuned value |
| ------------------------------------------------- | -------- | ----------- |
| Per-player bandwidth, both endpoints              | 500 KB/s | 2048 KB/s   |
| Generation/download request limit, both endpoints | 20       | 64          |
| Sync-on-load request limit, both endpoints        | 50       | 100         |
| Client generation/download progress               | DISABLED | OVERLAY     |

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

[Compat's DH integration](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/lod.md)
owns lifecycle and optional cache-isolation hooks. It does not provide a separate
terrain predictor. SeedGen and Voxy/Roxy are not included in the pack.

## Release 0.1.26 verification

The pack adds exact Transmission & Linkage 0.2.9 bytes and published Compat
0.11.1 on both sides. All three reference distributions build; ZIP integrity,
new dependency rows, client exclusion of BlueMap, and the Unix terminal wrapper
check pass. Journal generation checks 86 managed outputs; the configuration
audit checks 243 files without drift. All 30 pack tests pass. The fresh Atlas
export verifies the three added journal definitions and preserves prior mechanics.

Source-level and native machinery evidence is owned by Compat's verification
guide. Native actuation, recipe costs, converter limits, terrain, seed and LOD
identity remain unchanged. Personal-instance installation is verified separately
from distribution construction; archive checks do not establish every gameplay
arrangement or GPU.

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
surfaces from behind after native texture processing. The pack enables both;
standalone Compat installations default them off. Neighbor visibility remains a
separate decision, so matching interfaces and opaque-neighbor occlusion retain
their native rules. The [patch reference](patches.md) owns coverage and update checks.

The [generated Debug World](debug-world.md) classifies glass blocks, panes and
mesh/grates by registered inheritance, tags and explicit family choices. Doors
and pipes are excluded from those groups. The
Macaw's sloped chain-hung appearance is approved; flat bridges retain the regular
standing lantern. The matching optional Compat adaptation moves the stair outline and preserves
selection outside its owning cell. Physical collision remains empty. Their matched views are in the
Atlas at `/resourcepacks/reviews?feature=bridge-lantern`.
