# Compatibility constraints

This reference describes constraints behind the current pack configuration. Player instructions belong in [graphics](../players/graphics.md) and [server maintenance](../players/server.md). Exact versions are in the [content list](../MODLIST.md), with authoritative selections in `empack.yml` and `empack.lock`.

## Island water and environment

Skyweave's marked island preset disables Sky Archipelago's native rivers and lakes. Dynamic Waters 13.1.0 supplies terrain-following mountain watersheds and basin lakes through Compat's supported-column bridge. Its lowland mode remains `VANILLA`; `NONE` also rewrites density inputs. Mountain tunnels are disabled. Native Lagoon/Broken Reef habitats remain independent. Coastal Lagoon treatment is enabled; the perimeter variant is disabled in current defaults. Generation settings belong to the saved world identity; these changes require a fresh world rather than modifying old chunks in place.

Temperature-sensitive island consumers use reference Y64 while block positions, light and collision remain real. Cloud height maps to Y469.3333. Native void height darkening is disabled only in marked worlds; the supported shader recipes use scoped exposure signals for their corresponding cave/void heuristics. Other shaders retain their own behavior. Settings and limitations belong to Compat's [configuration](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/configuration.md) and [verification](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/verification.md).

Native full-pack checks include ordinary fluid ticks, a natural edge waterfall, reopening, source/height-query agreement, and bounded Sable current submission. A real DH job persists terrain and water palettes. These checks do not certify all boats, Create machines, distant fluid colors, aquatic progression or scarcity.

## Omnidirectional Movement

Omnidirectional Movement is client-only in the pack. The selected 1.2-OVERHAUL NeoForge artifact's `omni.mixins.json:LivingEntityMixin` references `net.minecraft.client.player.LocalPlayer::input` in a common mixin, which fails dedicated-server startup when the JAR is installed there. Its movement methods guard for the local client player; the released class inventory and initialization expose no required custom gameplay packet protocol. Client-local `/omni` commands remain available. Provider metadata declares both sides required, so keep the explicit client placement override when updating the dependency and verify the server export.

Client title registration passes with this artifact. The bounded native recipe/config fixture uses the Omni-free dedicated selection and starts successfully. A client-only multiplayer movement/session check remains distinct from loader startup; neither title registration nor dedicated startup establishes every movement correction or anti-cheat interaction.

## Throwable rope connector ranges

Compat's optional `throwable_rope_connector.range_limits` adaptation separates the selected addon’s COMMON preferences from Simulated's loaded SERVER ceiling. It preserves the configured 16/64/128 values during startup and applies the effective ceiling at range reads. An independently observed full-pack server check retains those authored values under ceilings 255, 40, and 0, with unchanged config bytes. This qualifies configuration and native range readers, not projectile flight, multiplayer movement, or distant tracking.

The adaptation selects exact throwable connector 0.4.3 and Simulated 1.3.2. Recheck or retire it before upgrading either owner; disabled behavior remains native. Restore already-clamped saved defaults only as an explicit owner action. Runtime maintenance belongs to [Compat’s adapter contract](https://github.com/mannie-exe/skyweave-compat/blob/581c0b18949f7a501d70511c09216f489aac1865/docs/development/adapters.md#throwable-rope-connector-range-limits); pack defaults and separate flight/presentation bounds belong to [progression](progression.md#ballistic-limits).

## Redstone control

Redstone Link GUI keeps Create's ghost frequencies and personal presets. Open it with an empty hand and Shift + right-click on a frequency slot. The native range remains 24 blocks. Compat checks server permissions and menu identity, projects Sable coordinates and limits relocation to ordinary links within one coordinate frame. Vector-thruster frequency menus remain available; machinery relocation is intentionally refused.

Redstone Additions 1.0.6 owns the gate, wrench, scraping, drop and cutout repairs. Compat scopes the remaining Crossroad feedback read by level and thread. The Redstone Link GUI interaction and relocation guards still apply.

The journal introduces copper scraping and acquiring signal components without claiming a completed circuit or making them mandatory for flight. Existing remote control guidance explains the frequency UI. Recipes remain upstream-owned; scarce materials are not granted through these entries. Recheck the exact dependency pins, resource overrides and [adapter contract](https://github.com/mannie-exe/skyweave-compat/blob/v0.14.0/docs/development/redstone.md) together when upgrading. Remove overlapping repairs after native verification.

## Audio and death recovery

Analog Audio's server-owned radio and speaker ranges are 128 blocks. Existing volume, filtering, spatial modes and attenuation remain unchanged; this extends the quieter tail rather than adding a new falloff. Compat's independently gated client timeline adaptation joins the current media position after loading and reconciles standby resumes. It uses AnalogLib 0.1.0 bundled in the selected Analog Audio release, independently of the existing Create registration repair.

YiGD 2.0.13 owns recoverable inventory and XP, including the Accessories-equipped Traveler's Backpack and nested contents. Owner-only recovery has no random item loss, key/cost requirement, expiry or teleport feature. XP uses `VANILLA`, with no kept percentage. The Overworld minimum is -127, leaving support space above the pack's -128 build floor; other dimension minima retain their native defaults. Global last-ground placement stays disabled so ordinary airborne deaths are not silently relocated to an old landing point.

`backpackDeathPlace=false` disables competing backpack placement. Retain `voidProtection=true`: it also protects loose backpack item entities, and YiGD captures the equipped item through Accessories. The backpack's native grave-mod detection avoids separate death placement; disabling item protections is unnecessary. Carry On's existing `yigd:*` exclusion keeps graves out of its pickup path.

Compat's optional Sable/YiGD adapter stores construct-placement metadata in the same YiGD record. It places graves in real plots, projects tracking into world coordinates and uses bounded local fallback without duplicating contents. Temporary unloading differs from construct removal. Spawn protection and the adapter's cancellable placement event are checked; compatibility with every external claims mod is not established. See the maintained [recovery contract](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/recovery.md) and [audio boundary](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/audio.md) before upgrading their dependencies.

## Carry On machinery

Carry On 2.2.6.13 handles empty-hand pickup before native block use. A successful pickup removes the block entity and block; it does not run Sable's assembly-move callbacks. Coordinate-bearing links and native sneak interactions therefore need separate review from ordinary inventories.

The common blacklist references `#create_skyweave:carry_on_restricted`, owned by the Skyweave: Resource Patches JAR. Carry On supports [tag-based exclusions](https://github.com/Tschipp/CarryOn/wiki/Black---and-Whitelist-Config). Its optional block IDs cover these reviewed families:

| Content | Restricted parts |
| --- | --- |
| Simulated | Assembler, swivel bearing and plate, merging glue, rope winch/connector, docking connector, torsion spring and spring |
| Absolute Kinematics | Hinges, ball joints and their paired parts |
| Transmission & Linkage | All eight linked machinery/auxiliary blocks, including heads, regulator and conversion bearing |
| Linear Bearing | Bearing/carriage, magnetic port, torsional anchor and gyroscopic gearbox |
| Aerocables | The two cable endpoint blocks |
| Aeroworks | Control Desk, Control Stand, both Copycat variants and Joystick |

Carry On configuration uses the seed policy. Existing installations must merge `#create_skyweave:carry_on_restricted` into `blacklist.forbiddenTiles` and restart; replacing the resource JAR alone does not add the blacklist reference. Preserve other operator settings.

Keep the upstream Create/Copycats, protected-container, grave and entity exclusions. Backpacks were already excluded by the loaded rules; no duplicate namespace rule was needed. Ordinary chests, barrels and furnaces remain carryable. The Linear Bearing redstone converter also remains eligible. Other Simulated controls, Aeroworks' gyroscope and servos, Power Grid networks and modded inventories need individual evidence before changing their rules; a block entity alone is not a reason for exclusion.

Aeroworks 1.5.0's five excluded controls share `ConsoleBlock`, including its Shift-right-click configuration and active-user handling. Joystick and both Copycat variants inherit that same interaction boundary. The added exclusions are source-reviewed; they have not had a new native pickup comparison.

A 2026-11-01 isolated native comparison covered the complete block registry and fourteen pickup cases. The tag removed exactly 25 previously eligible block-entity types without changing other eligibility. Actual pickup changed from allowed to refused for pneumatic heads/regulator/conversion bearing, Simulated assembler and bearing, and an Absolute Kinematics hinge. Positive container and converter cases still passed. Paired helper blocks without block entities are included to keep assembly families together; default `pickupAllBlocks=false` already excludes ordinary non-block-entity states.

Sable's interaction-distance mapping permits ordinary chest pickup from a plot while the player remains at its projected world location. A settled-world check also removed a single-block chest construct and shut down cleanly. This does not prove every container's placement, linked inventory behavior, carried passenger, protection integration or active machine relocation. Retain the targeted policy rather than treating all ship storage as either unsafe or verified.

On Carry On updates, review event priority, list/tag matching and block-entity serialization/removal order. On machinery updates, review assembly callbacks, paired block cleanup and native sneak-use before changing this tag. Check both native refusal and an unaffected carryable object; do not infer safety solely from a blacklist string or a registry ID.

## Transmission & Linkage

Transmission & Linkage 0.2.9 uses Compat 0.11.1's optional interaction and Jade adapters. Visible rods disconnect by sneak-using a Create wrench, rather than ordinary attacks. Server checks protect endpoint/settings edits and resolved binding selections; Jade reports actual link, actuator and extra kinetic output state. The [adapter reference](https://github.com/mannie-exe/skyweave-compat/blob/v0.11.1/docs/development/transmission-linkage.md) owns exact pins, protection limits and update/removal procedures.

Native world-to-ship and rotated ship-to-ship fixtures retained mutual references, one rod constraint per pair and cold-reload behavior. Both stock actuator types move without an external supply; this documented upstream behavior is retained. No recipe, power-limit or mass changes are applied. Stock link lengths avoid the known enlarged-range visual cap. A controlled converter drive is verified; a self-powered loop and practical production balance are not established.

The isolated client exercised settings and deliberate removal, Jade inspection, normal/giant rod rendering with shaders off and the default Complementary/Euphoria stack, native converter assembly and representative Ponder playback. The pack corrects the tutorial's rod-body interaction target. Broader claim integrations, arbitrary hinge builds and unsupported GPUs remain separate playtesting scope.

## Linear Bearing

Linear Bearing 1.3.5 and Linear Bearings Fix 1.0.3 use Compat 0.9.0's optional carriage, transmission and gyro adapters. The companion owns dedicated startup and bubble-gum loot; Compat suppresses its overlapping bootstrap repair. Keep the companion while the provider declares it required.

The guide remains passive, with a redstone brake capturing its current relative pose. Magnetic and spring links are native Create network edges, including real load and stalling. The gyro is an angular-rate signal with zero stress capacity. Checked assembly and aligned empty-hand recovery preserve cargo and refuse occupied destinations. No recipes, weights or hidden actuator are added.

The [mod's machinery reference](https://github.com/mannie-exe/skyweave-compat/blob/v0.9.0/docs/development/linear-bearing.md) owns the contracts and dependency-update procedure. Native tests cover free/braked motion, multiple orientations, moving parents, recovery, cold reload, driven coupling controls, overload and source removal. An isolated client also exercised assembly, braking, recovery and reopening. Old upstream injected-source network saves and arbitrary foreign assembly exceptions remain outside that evidence.

## Articulated joints and machinery guidance

Absolute Kinematics 1.0.1 adds hinges and ball joints on both sides. Its exact CurseForge CDN URL is digest-pinned because a CurseForge API key is not configured; its JAR metadata omits Create, Sable and Simulated requirements. Keep the pack's reviewed Create 6.0.10, Sable 2.0.6 and Aeronautics/Simulated 1.3.2 selections together. The native fixture used real empty-hand interaction assembly, a 16-RPM side-shaft hinge drive reaching its 90-degree stop, ball-joint lock/release and recovery of both stone payloads. Both joints retain their native mass of 1.0. No recipe or weight adjustment was justified. Large articulated craft remain a play check.

Compat's `linear_bearing.ponder` and `linear_bearing.jade` switches add machinery tutorials and server-backed inspection. The shared Resource Patches assets supply English names for internal carriage blocks and corrects the gyro acquisition advancement's old stabilization claim. Guidance does not add another drive or progression gate. The mod's [machinery reference](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/linear-bearing.md#ponder-and-jade) owns registration, optional loading and update procedures.

## Dependency update constraints

Minecraft remains 1.21.1. The current preset targets Sky Archipelago 1.4 and its saved generation identity. Keep old saves with their matching generator/config; a provider update is not a terrain migration. [World generation](worldgen.md) owns the preset boundary and [patch maintenance](patches.md) owns coupled updates.

Questlog retains its exact supported-version gate while the empty FTB Quests book is trialed. Updating the FTB trio requires reviewing Library/Teams/Quests together, Architectury resolution and the current authoring boundary. Do not describe the planned authoring replacement or spawn policy as implemented behavior.

JEI, Reliable EMI, MezzConfig and Aeronautics Covers need joint provider/runtime review: Covers' provider metadata can force an older JEI although its native requirement is optional. Use the exact file-source exceptions and procedure in [patch maintenance](patches.md#file-source-exceptions), then inspect the resolved lock for unintended downgrades before materializing.

## Rain audio

Cool Rain Reforged 1.0.2 and Sable Cool Rain 1.0.1 are client-only. They add surface-dependent rain audio and copied-material/Sable surface handling, without recipes, weights or a progression gate. Base rain sounds use the existing Weather volume category. No separate gameplay configuration is registered. The exact release JARs matter: the base mod's current source branch targets a newer weather renderer than the selected Minecraft 1.21.1 release.

The isolated full client reached the menu, and its exported `LevelRenderer` bytecode contains calls to both bridge hooks, including the material-return adapter. This verifies actual injection despite their optional `require=0` selectors. It does not establish audio balance, shelter behavior or moving-ship sound positioning. Sable already handles plot-coordinate sound distance; do not add a second coordinate conversion based only on source-space positions.

## Colorwheel

The manifest selects client-only Colorwheel 1.3.2+mc1.21.1 with Compat's optional rendering adaptations. Explicit client placements keep Colorwheel, Iris, Sodium and generated shader content out of server exports. Existing renderer versions remain pinned.

Compat supplies terrain/emission metadata on Sable's direct non-AO model path and releases unused OIT sampler slots when Colorwheel's own renderer guard disables OIT. On the tested Apple driver, the unadapted embedded translucent program failed at `shadowtex0`; the adapted selection renders with the current Complementary/Euphoria configuration unchanged. Do not replace supported OIT allocation or disable shaders to mask that failure.

Native checks cover shader on/off backend selection, static and assembled glass / Copycats, moving Sable/Create geometry, press/propeller Ponder, shader reload, and minimum optional loading. Full dedicated-server startup selects no client hooks. See the [exact verification and limits](https://github.com/mannie-exe/skyweave-compat/blob/v0.8.0/docs/development/verification.md#release-080). No measured performance gain or general shadow repair is claimed. Keep patch retirement tied to the actual released Colorwheel/Sable implementations.

Colorwheel 1.3.2 requires the updated version guards introduced in Compat 0.21.1. The playable pack and shader-lab runner use the same verified engine. Keep their exact pins aligned when its shared implementation or recipe schema changes; qualify generated outputs against the playable runtime. Colorwheel's sampler, material and buffer adapters remain separate from the offline shader engine. [Patch maintenance](patches.md) owns their individual update/removal checks.

### Shader patching

The [shader lab](../../tools/shader-lab/README.md) owns exact inputs, recipe and payload versions, update checks and distribution requirements. It invokes Compat's file-only Java engine for deterministic author builds. Recipients use that same engine before Iris opens the selected shader. empack manages original inputs under `shader-inputs/` and the recipes; finished cached ZIPs are generated locally. Neither plain BSL nor an intermediate Complementary/Euphoria result belongs in the selectable list alongside its final Skyweave result.

The BSL chain combines BSL 10.1.8, Colorwheel Patcher 1.0.5 and Skyweave environment edits. Colorwheel's runtime remains installed; the patcher archive is build input. Complementary Unbound r5.9.3 plus Euphoria 1.10.5 adds independently versioned Skyweave Glass material corrections and Skyweave environment edits. The glass policy uses texture alpha to distinguish cutout frames from partial-alpha glazing, preserving custom PBR and Create's connected-texture ownership. It does not fix coincident backfaces or pane intersections; those belong to Compat's renderer.

Both supported recipes consume scoped world/void/open-sky signals. Foreign worlds, real enclosed rooms, underwater rendering and status effects retain their own paths. Unknown shaderpacks and Photon on unsupported Apple GPUs remain outside native qualification. Review exact historical captures through [verification](verification.md); shader compilation alone does not prove visible materials, occlusion, weather behavior or cross-platform performance.

Compat groups configuration by gameplay system and mod page, with setting anchors and localized search. Rendering → Iris exposes independent text-display/nametag lighting and cast-shadow options; these stable adaptations default on when Iris qualifies. Neutral lighting uses Iris fallback programs for selected text batches; later color grading/exposure can still affect color. Entity-body shading, signs, item/block displays and other text keep their native paths. Custom nametags that bypass Minecraft's base renderer are outside coverage. Review the [rendering contracts](https://github.com/mannie-exe/skyweave-compat/blob/v0.19.0/docs/development/rendering.md#world-text-lighting) when updating Minecraft, Iris or shaders.

Complementary r5.9.3, Euphoria 1.10.5 and Photon 1.4 have native Colorwheel support. The patcher's older Photon 1.3a patch must not be forced onto 1.4. Select the official Photon release rather than an older compatibility fork. Photon also provides DH shaders, but its author does not support Apple GPUs. Its stock settings exceeded this Mac's 16-sampler limit in `deferred4`; that is not evidence of a failure on supported GPUs. Further Photon runtime testing and macOS workarounds remain deferred.

The Photon preset retains native High lighting, adds block-entity shadows, uses 128-block shadows at 2048 resolution, and disables depth of field/motion blur. It does not override SH Skylight, colored shadows or colored-lighting controls to accommodate macOS. The options were checked against the exact 1.4 sources; the preset has not been GPU-tested on a supported platform. Complementary/Euphoria remains the default. No additional runtime adapter is introduced.

The lab README owns acquisition, generation and dependency-update procedures. Recheck exact patch contents, output/preset names, Iris/Colorwheel startup, moving geometry and DH when updating either input. Euphoria retains its independent client-side generator; the lab does not replace it.

Sources: [Colorwheel](https://modrinth.com/mod/colorwheel), [Patcher](https://modrinth.com/mod/colorwheel-patcher), [Photon](https://modrinth.com/shader/photon-shader).

## Moving lights

Lamb Lanterns 1.2.0 adds a dedicated Curios `lantern` slot for vanilla and soul lanterns. Install it on both sides; the existing LambDynamicLights owns client illumination. Its equipped renderer uses the active hanging block model, so Luminous Lanterns remains the resource owner. Keep native position defaults; no extra client config is distributed. Source review identifies render-driven pendulum updates, missing pendulum-state cleanup, and an Iris offhand-light substitution that need separate qualification. Addition does not claim those issues repaired or every player pose/shader combination verified. A disposable minimum dedicated-server boot passes with the selected Curios/Accessories stack, frozen Compat candidate, and the pack's existing Curios-binding adaptation enabled. This establishes server loading, not client geometry or equipped interactions. Portable light does not replace authoritative placed lighting for spawning or block mechanics.

The pack includes client-only Sable Dynamic Lights 2.0.1 (`vjb0hAWB`) and LambDynamicLights 4.8.11+1.21.1 (`ksaGCvSu`) with Compat's `lighting.lifecycle` and `lighting.sodium` adaptations explicitly enabled. SDL owns moving Create/Sable sources; Compat repairs the selected Sodium lookup, keeps their light client-local and clears source owners across unload/disconnect. No server mod or authoritative lighting change is required.

Lamb's exact universal JAR is URL-pinned because its catalog requires Fabric API even though the artifact bundles a native NeoForge runtime and its supporting libraries. Both new JARs match the SHA-256 hashes used in the earlier [Compat lighting checks](https://github.com/mannie-exe/skyweave-compat/blob/v0.8.0/docs/development/lighting.md#artifacts-and-updates). Keep that pair aligned with Compat's exact version guards. Do not add another Fabric API or a competing dynamic-light engine for this integration.

Native lighting evidence covers moving and nested contraptions, source removal, dimension travel and client/server light separation. It does not prove complete wall occlusion or fix the unreproduced upstream hang. Keep new pack verification separate from those earlier renderer observations.

## Distant Sable rendering

Compat 0.22.1 supplies two independent default-on client adaptations. The distance repair requires SSRD 1.8.8, Sable 2.0.6 and Iris 1.8.14-beta.1; the opaque-occlusion repair additionally requires DH 3.3.3. Both preserve their startup switches and physical-side/version checks. No authored view distance or terrain generation changes are required.

The native fixture reproduced shader-only disappearance beyond native view distance without the repair. With both adapters, the hull renders at distance and remains hidden behind opaque DH terrain in the qualified BSL/Colorwheel and Complementary/Euphoria/Skyweave shaders. Shader switching, resize and dimension transitions were checked. Single-block and chunked construct draws retain scoped state restoration. Translucent composition, distant block entities/Flywheel, other shaderpacks and multiplayer visuals are not established by those checks. See Compat's [rendering contract](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/rendering.md#distant-constructs-with-shaders) and [verification](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/verification.md#ssrd-shader-adaptations) for exact scope, shader-fog limits and dependency-update checks. Upstream tracking: [SSRD issue 68](https://github.com/RanoldStranold/SSRD/issues/68).

## DH Polygon Fix

Clients include [DH Polygon Fix 1.0.2](https://github.com/mannie-exe/dh-polygon-fix/releases/tag/v1.0.2) with the original DH 3.3.3 JAR. It backports upstream !126's two-integer polygon-mode query. The earlier scalar query overwrote an adjacent canary on Apple OpenGL and Linux/Mesa and could cause delayed native JVM crashes.

The patch requires exactly DH 3.3.3. Remove it when upgrading DH and verify the replacement includes the upstream fix. Keep it client-only across supported platforms; dedicated servers do not need it. SSRD interfaces are unchanged.

Version 1.0.2 retains the 1.0.1 runtime implementation and adds documentation and release-tool checks. Version 1.0.1 moved the namespace to `design.inherent`. Transformation, missing/duplicate target, server exclusion, three-OS builds and Apple/Mesa native probes passed. See the [release evidence](decisions.md#rendering) for the tested scope.

## World generation

Sky Archipelago requires LODs from its actual island chunks. The pack uses `CHUNKS_ONLY` and `INTERNAL_SERVER`, four workers and a runtime ratio of 1.0. The worker count was chosen for a 14-processor host, not measured as optimal for all machines.

New worlds use Skyweave: Compatibility Patches' expanded preset and geometry configuration. The **eee** preset and common Sky Archipelago TOML apply to ordinary upstream worlds; their RANDOM sizing leaves SPECIFIC bands dormant. Keep those files with ordinary saves. See [world generation](worldgen.md) for preset boundaries.

SeedGen is excluded because its reconstructed vanilla noise terrain does not match Sky Archipelago. Do not use it to fill missing island LODs. Preserve world and LOD identity when troubleshooting; renderer visibility and network transfer are separate problems. See [graphics](../players/graphics.md) for diagnosis.

The renderer uses a 256-chunk radius with cave culling disabled so island undersides remain visible. Compat supplies per-world cache identities; retain the saved world identity when diagnosing LODs.

## DH luminous columns

DH 3.3.3 can transfer glow lichen's tint and emissive material to the entire segment below it when `tintWithAvoidedBlocks=true`. This creates pale, luminous stripes on distant cliffs and can replace a liquid segment's material. A physical client fixture reproduced the transfer onto stone, lava and water; source and flowing lava alone retained the correct orange color.

The authored DH configuration adds `minecraft:glow_lichen` to `ignoredRenderBlockCsv`. Reopening the same fixture and cache removed the stripe and preserved the original stone/fluid materials. This omits lichen from LODs; native lichen, fluids and ordinary foliage tinting remain enabled. It does not delete cached terrain or require a fluid-rendering Mixin.

The check used Complementary Unbound r5.9.3 with Euphoria 1.10.5, with shaders enabled and disabled. Glow lichen was also identified on the reported live cliff. That supports this explanation for the observed pale patches, but does not establish that every historical liquid-color symptom has the same cause. Modded fluids and other shaders remain untested. See Skyweave: Compatibility Patches' [DH development notes](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/lod.md) for the conversion boundary and upstream report candidate.

## Dependency constraints

Carry On Animation Fix stabilizes the client-side entity used for carrying: it preserves render identity and age and aligns current/previous transforms. The isolated cow and villager checks covered pickup, carrying in both camera views, movement and placement. Fresh Animations stays enabled. This does not validate every entity or Carry On script; container exclusions remain separate. See the [upstream implementation](https://github.com/Pelly-the-Crafter/carryon-animation-fix).

Fresh Details' older model references caused missing sleeping-villager feet and incorrect mule chest visibility with Fresh Animations 1.11.1. The generated resource patch binds reviewed models to current rigs; [patch maintenance](patches.md#fresh-details-animation-rigs) owns the source contracts and update procedure.

- Complementary r5.10 is paired with Euphoria Patcher 1.11.2. Shader assembly publishes the complete generated result; see [shader patching](#shader-patching) for startup/cache ownership.
- JEI remains alongside EMI for recipe integrations.
- Connector and Forgified Fabric API support the Hoofprint/Surveyor/McQoy stack.
- URL pins handle provider metadata conflicts involving old exact versions, Connector/Forgified Fabric API and client-only dependencies. Check runtime metadata before replacing them with provider roots or downgrading dependencies.
- Published URL pins select DH Polygon Fix, Copycat Bar Extrusion, Skyweave: Compatibility Patches with content digests. The compatibility mod itself requires no content mods; this pack enables its Sky Archipelago 1.4 preset and Sky Villages/Architectury adapters. Compat also owns the optional client framebuffer, balloon, and construct-model corrections. Do not install the former standalone Veil Iris Fix alongside it. Review coupled versions together; see [patch maintenance](patches.md).
- Carry On excludes Lootr containers and Aeronautics/Sable objects and retains the generated Create/Copycats exclusions. These exclusions do not verify every carried entity or ship-storage interaction.

### Distant terrain content

The 2026-10-27 Atlas world sample contains ten modded terrain block IDs: Create's zinc ores and stone families, and Create Propulsion's platinum ores. Their installed models inherit vanilla `cube_all`, including the randomized Create stone variants. The physical-client DH conversion retained opaque colors, valid texture sprites and full test-column heights for all ten types, with stone, deepslate and grass controls. No missing terrain adapter was identified. The sample is not an inventory of every structure or runtime-placed block.

Animated machinery, moving ships and specialized container renderers are outside this DH pass: their detailed behavior is not required for distant natural island terrain. This is a scope decision, not a claim that DH reproduces those renderers.

## Hoofprint zoom

Inspection on 2026-10-31 of the pinned Hoofprint 1.3.0+1.21 JAR confirms that `config/hoofprint.toml` cannot extend the scroll range. `defaultScale = -1` selects half the GUI scale rounded up; `1` starts at the farthest existing zoom and `10` at the closest. Scrolling is independently hard-coded to integer map scales 1..10, equivalent to display pixels per block. `-2` is outside the declared range and has no additional zoom-out semantics.

Keep the current pack default pending an adapter. The [Compat investigation](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/hoofprint.md) owns the source/bytecode evidence and proposed fractional client zoom, including initialization, dimension changes and pointer anchoring. It is not implemented or verified in game; the pack retains the existing default.

## Controls and resource packs

FTB Quests 2101.1.38, FTB Teams 2101.1.12 and FTB Library 2101.1.39 pass an isolated full-pack dedicated startup and clean shutdown with Questlog retained (2026-11-09, NeoForge 21.1.265 / Java 21). Exact JAR metadata satisfies the shared Architectury 13.0.11 requirement. The native key IDs are inspected and source defaults/export payloads verified; client key dispatch, FTB UI, shared quest gameplay and the planned spawn/Nether adapters are not qualified by that startup. The [team/access guide](team-world-progress.md) owns the selected policy and remaining implementation boundaries.

Better Climbing, Ping Wheel, Easy Anvils, Easy Magic and Inventory Totem ship on both sides. Camera/UI/rendering mods and resource packs are client-only. EMF/ETF support Fresh Animations; Puzzles Lib, Collective and Searchables satisfy the corresponding dependencies. Exact selections are in [MODLIST](../MODLIST.md).

| Domain | Authored choice |
| --- | --- |
| Flight camera | Elytra retain vanilla steering and firework propulsion. Better Third Person's independent elytra camera stays off. |
| Inventory movement | Preserve sneaking and prevent dismounting. Text focus disables movement. Unknown screens default off; books, advancements and all Ponder browsing views also disable movement. EMI/JEI compatibility modules remain enabled. |
| Communication | Ping Wheel keeps its range, channel and rate-limit defaults, with ten-second markers and 50% volume. Chat Heads retains its defaults. |
| Tooltips | Keep durability/enchantment information, omit extra blank-line spacing. Shulker Box Tooltip retains its native preview defaults. |
| Workstations | Keep generated Easy Anvils costs and maintenance settings. Easy Magic shows all enchantments while retaining paid rerolls. Do not disable old vanilla workstations. |
| Visual resources | Use the current selection and ordering in [Graphics](../players/graphics.md#resource-packs). Retain EMF/ETF defaults. Existing options remain seed-managed; explicit syncs update only the reviewed selection. |

Mouse Tweaks 2.26.1, Inventory Profiles Next 2.2.5 and libIPN 6.6.3 are client-only. The isolated full-pack survival fixture verified one-item wheel transfer, Shift-drag of two stacks, middle-click sorting and stack merging, and IPN's manual transfer button with conserved counts. A worn iron pick (damage 245) stayed in inventory while its replacement was selected and used (damage 1). The [inventory guide](../players/inventory.md) owns current defaults and controls. [Patch maintenance](patches.md#routine-dependency-upgrades) owns the update checks.

Creative-flight inventory sneaking uses InvMove's `MaintainWhilePressed`: descent already active when the screen opens continues until the sneak key is released. A fresh Shift press inside the screen does not start descent, so Shift-clicking items does not move the flying player down. Ordinary inventory sneaking remains `Maintain` for edge protection. This policy is source-reviewed for held sneak; toggle-sneak behavior and a new native flight check remain separate verification. Existing installations retain their seeded config until explicitly updated.

InvMove 0.9.3 applies this flight policy in its held-sneak path. Toggle crouch uses a separate path, so it needs its own native check before claiming the same protection. Its key polling refreshes keyboard key-symbol bindings, not mouse or scan-code bindings. Text-focus protection covers vanilla edit boxes, recipe-book search and supported integrations; arbitrary nested mod widgets are not covered by that inspection alone. Ctrl/sprint, Space/jump and passenger dismount behavior also need separate checks when changing bindings or adding interactive screens.

Better Climbing and Inventory Totem expose no generated tuning file in this version. Their native behavior is retained. InvMoveCompats and Ping Wheel are published as beta builds; InvMoveCompats' `1.21.8` filename covers 1.21.1 according to both its version metadata and native loader range.

Disposable Java 21/NeoForge clients and servers were installed from the reference exports on 2026-10-23, against the 0.1.9 working tree based on `25a5a209`. The client joined the isolated server, loaded all six packs, rendered Fresh Animations villagers/golems and showed a shulker preview containing three diamonds. An inventory-only totem survived 100 generic damage, granted Postmortal and was consumed with both hands empty. InvMove moved the player in an inventory; typing in focused EMI search left the teleported position unchanged.

Native configuration loading accepted the authored new settings. A server runtime export completed without exporter errors. Existing Create Radar model warnings, Propulsion compass-model warnings and other inherited content warnings remain; the matching Radar warnings also occur in the prior local client log. Successful startup does not establish moving-ship camera compatibility, flight feel, every modded inventory, all crop/Copycat geometry or shader performance. Those need playtesting.

## Shader verification

The Apple M4 Pro reference client exposes 16 texture units; Iris 1.8.14-beta.1 reserves two for composite passes. Complementary HIGH with DH used 15 active samplers in `composite1`, failing on `shadowcolor1`. Low block reflections (`BLOCK_REFLECT_QUALITY=1`) removed three reflection-buffer samplers.

| Preset               | Overworld maximum | Nether maximum | End maximum |
| -------------------- | ----------------- | -------------- | ----------- |
| Complementary r5.9.3 | 12                | 7              | 12          |
| Euphoria 1.10.5      | 12                | 7              | 12          |
| BSL 10.1.8           | 10                | 10             | 10          |

These are measured composite/deferred sampler counts. Instrumented construction of all nine shader/dimension pipelines passed with DH 3.3.3, SSRD and Polygon Fix 1.0.0 present. The test did not exercise actual dimension travel, terrain visuals or frame rates. Version 1.0.1 preserves that patch's runtime query implementation.

The presets retain most HIGH effects, reduce shadow distance to 128 blocks and lower Complementary/Euphoria light-shaft sampling. Reduced shadow coverage and sampling suggest less work; no fixed-scene FPS improvement was measured. Lower light-shaft sampling may show more noise in motion.

## Verification scope

Create: Skyweave 0.14.0 pins the published Compat 0.33.0 JAR for both game sides and the shader-lab runner. Local qualification covers the pack Python suite, Atlas lint/unused-code/JavaScript/Python/build checks, configuration and village/quest generation audits, and all three distribution builds. Archive inspection verifies a single published Compat artifact, managed climate/shape/structure policies and the unchanged client/server split. The native Atlas registry/environment export was refreshed against all 124 selected server JARs; its snapshot records the release artifact and current lock hashes.

Compat's required Gradle checks pass 329 tests. Its packaged Prism checks exercise both generated BSL/Colorwheel and Complementary/Euphoria shaders, climate controls, precipitation and integrated-world reopening. Native ground support, climate, optional Sable/Dynamic Waters, habitat, persistence and negative controls are owned by [Compat verification](https://github.com/mannie-exe/skyweave-compat/blob/v0.33.0/docs/development/verification.md). The requested independent source/evidence review found no blocking defect in its inspected boundaries. These bounded checks do not certify every donor road, arbitrary feature writers, universal navigation or world-wide encounter rates. Unsafe historical village candidates can now be rejected without changing family allowances.

Choose checks that exercise the change:

| Change | Relevant checks |
| --- | --- |
| Documentation | Local links and anchors, source paths, commands and claims against current files |
| Configuration | Parse files; compare the intended keys; inspect affected exports when packaging changes |
| Dependencies or placement | Sync, build all profiles, compare payload hashes and side exclusions |
| Shaders or rendering mods | Construct pipelines, then test island edges, water/glass, ships, lighting and dimension travel in-game |
| Generation or physics | Test a disposable world and representative ships; preserve production world data |
| Release | Verify CI, downloaded checksums and critical published archive contents |

Record the exact source revision, commands, environment and outcome. A passing packaging check does not establish GPU compatibility. Keep version-specific evidence with [release history](../README.md#source-and-releases), and label untested behavior explicitly.

Earlier logs recorded Create Radars errors for empty model/blockstate JSONs. Those runs reached a title screen and sky world; that finding has not been established as resolved. Analog Audio registration is covered by the 0.1.19 check. The history also retains a separate, unattributed native Apple Metal/IOGPU crash. Do not conflate that report with the confirmed DH polygon-buffer defect.

Survival resource access, structures, moving-ship interactions and acoustics still need broader gameplay coverage. Player testing supports enabling DH by default; it is not a cross-platform performance benchmark.

## Progression and integration

Hostile Skies automatic raids and departure explosions are disabled; capture is enabled. Delivery Quests uses village destinations, four offers and 120-minute deadlines. It samples search offsets from 500 to 6,000 blocks; the installed mod can select a farther structure. These are structure destinations, not a simulated economy. Glider defaults and membrane requirements are retained. [Progression](progression.md) owns production/travel policy and remaining checks.

The [patch maintenance guide](patches.md) owns recipe, loot, tag and generation overrides and their update/removal procedures. Almost Unified retains geological ore identity while preferring interchangeable manufactured materials. Questlog mechanics and client integration are owned by [journal definitions](journal.md) and [journal integrations](journal-integrations.md).

## Resource interactions

Skyweave: Visual Patches composes selected models, textures and animation resources above the retained source packs. Skyweave: Resource Patches owns shared data and supporting translations. Runtime renderer and collision fixes belong to Compat. [Patch maintenance](patches.md) owns exact inputs, generators and coupled update checks; [resource authoring](web/models.md) owns browser editing and preview limits. A resource reload or correct browser model alone does not verify in-game collision, block-entity animation, connected textures or shader behavior.

### Category review world

Use the generated [Debug World](debug-world.md) for native comparisons. It replaces the old hand-reviewed Resource Review fixture. The generator, placement manifest and native probes own coverage; labels and screenshots do not prove every expected state was placed. Keep personal worlds separate from disposable comparisons.

### Selective model comparisons

Accepted selections and pending resource comparisons live in Atlas authoring and its source manifests. Preserve the chosen per-object resources and explicit review decisions when upgrading a broad source pack. Do not enable an entire candidate pack merely because selected objects passed review.

### Visual compatibility pass

Review resource inheritance, UVs, render type, animation ownership and resource priority together. Inspect both unchanged controls and touched objects in game. The [historical visual evidence](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/compatibility.md#visual-compatibility-pass) retains the tested objects and exact earlier artifacts.

### Configurable models

The local resource candidate was checked on Minecraft 1.21.1 / NeoForge 21.1.265 with Visual Workbench 21.1.2, Easy Magic 21.1.4 and the pinned full-pack dependencies. A packaged-JAR ModDev client completed six native reload profiles and discovered all 34 Visual Patches options. The profiles cover defaults, Refined placed torches, Nautilus held torches with Classic 3D workbench, vanilla/lower-pack controls, Fresh base/Details, and Nautilus accessories. Actual native menus display the category labels and enum choices. Workbench inventories reach the client and produce the expected chest recipe; flat and floating workstation presentation are exercised separately.

The final run uses Complementary Unbound r5.9.3 + Euphoria 1.10.5 + Skyweave 0.3.0, freshly generated by the isolated runner. It includes all eight DnD chain materials on all three axes, regular/soul lantern joins, held torches and standing creeper/Enderman comparisons. All six profiles report zero GL errors and five usable chain sound events. Lower DnD sound declarations still emit missing-file warnings before the replacement event definitions are applied; this check verifies final event resolution, not an audible comparison. No conditional-resource/fallback errors were found in this run.

The tested visual ZIP has SHA-256 `e06bfc2ceccf177469cb4fec33b2d8fded3b91bc985f3ad17afed0a73c8a7980`. That run's final ZIP `d9fdd48a29decd7b925487d4833f3d89bd5d739899cf942abddbf1a51a162b09` differs only in `CREDITS.txt`; every runtime resource and option definition is byte-identical. The pack's 125 Python tests, model authoring validation and 418-file configuration audit pass. Compat's check/build passes 480 unit tests and nine tooling tests; the new native scene remains test-only. These checks do not qualify every mob pose, machine chain renderer, dense-scene performance, remote multiplayer or the production Prism launch. [Patch maintenance](patches.md#workstation-models-and-resource-options) owns input-update and removal checks.

A shader-off follow-up directly tests the final ZIP's native menu path rather than setting its configuration branch programmatically. It clicks both torch enums, presses Done on the category and parent pages, forces a resource reload, checks persisted choices and changed block/item resource hashes, then restores and verifies both original hashes. All three profiles pass with zero GL errors; close images confirm the held mesh changes. The fixture waits for native list layout before clicking. This does not reproduce a broken toggle or establish which control/save path was used in an earlier player session; the retained preference file in that inspected session contained the defaults.

Current defaults use Nautilus for both torch views, file on and pencil off. Native resource-option controls retain the stable file preference and add an independent pencil preference. Five real save/reload combinations exercise unconverted, crafted/placed and interaction-converted crafting tables, retained workbench contents and 64 baked-model coordinate seeds per delivered block state. The default authoring projection matches the native winning blockstate bytes. Accessory presence is deterministic; unrelated base/drawer variants retain their weights and rotations. Existing saved opt-outs remain authoritative. [Patch maintenance](patches.md#workstation-models-and-resource-options) owns the generation and update contract.

## BlueMap model parsing

The optional Skyweave: Compatibility Patches viewer adapter targets BlueMap 5.7 on dedicated servers; see [server webmap](build.md#server-webmap). Browser checks on saved tiles confirmed bounded detailed rendering, reduced empty-edge stretching, disable and re-enable behavior, and camera movement across the floating-origin boundary. Coarse sheets remained visible from beneath the islands after the detailed-memory budget was reached; this is a remaining height-field limitation, not fixed 3D LODs.

BlueMap catches up to saved terrain rather than predicting the final pregen area.

The inspected startup resource scan rejected eleven Macaw's Doors models for duplicate `particle` keys and Create Deco's `catwalk_bottom.json` for an invalid `EAST:` face direction. No other tile-generation exceptions were found in that BlueMap debug log; 24 sampled compressed tile files decoded successfully. This checks file integrity, not visual correctness of every block. Clearing tiles does not repair upstream model JSON. No broad resource overrides were added for this.

## DH multiplayer cache filling

Server LOD availability, client cache coverage and renderer visibility are separate states. DH can retrieve generated server sections without a prior player visit; movement changes nearest-first request priority and native chunks also contribute LODs. Incomplete client coverage is not evidence of a missing server world. Check the handshake, dimension/cache identity, negotiated limits and errors before clearing caches or regenerating terrain. [Player graphics](../players/graphics.md) owns the troubleshooting sequence.

### Transfer tuning

Authored endpoints use 2048 KB/s per-player bandwidth, 64 generation/download requests and 100 sync-on-load requests. DH uses the lower negotiated client/server limits. Four workers, a 256-chunk render radius and CHUNKS_ONLY / INTERNAL_SERVER remain pack choices, not universally optimal performance settings. The progress overlay is a local preference. A world reset or shader change does not justify silently deleting caches. [Server operation](../players/server.md) owns pregen.

Island-aware request ordering remains a proposal. It would need conservative occupancy and fairness without changing generated terrain or starving empty-sky requests; no such DH scheduler is claimed here.

## Resource rendering repairs

[Lootr: Styled](#lootr-styled) owns Lootr presentation and native atlas admission for local-profile texture dependencies. The visual ZIP supplies no Lootr-specific artwork or geometry. Normal and trapped Lootr chests remain distinct blocks with the same display name; the fixture labels the trapped specimen explicitly.

Selected azalea plant geometry is composed with Fresh pots and soil. Their donor uses shared templates, so selection follows actual shrub roots rather than the similarly named leaf models. Existing mushroom/fungus pots and potted cactus keep their selected treatments; the cactus donor's simpler potted model is not adopted.

Create/Rechiseled missing interior window faces originate in native face-removal rules. Disabling MoreCulling's block-state option did not restore them. The broad resource workaround is disabled and native culling definitions are restored: uncullable faces exposed matching-window interfaces and lacked Create CT context. Compat supplies independent client repairs for Create material boundaries and Rechiseled pillar axes while retaining native CT/Fusion processing. Both are enabled in the pack startup defaults. Pane models are unchanged. See [patch boundaries](patches.md#window-connections-and-copycat-panels) for update requirements and [verification](web/verification.md#resource-rendering-repairs-2026-11-02) for the tested cases and limitations.

`create.glass_backfaces` and `fusion.glass_backfaces` additionally show exposed surfaces from behind after native texture processing. Both default on when their optional dependencies qualify. Neighbor visibility remains a separate decision, so matching interfaces and opaque-neighbor occlusion retain their native rules. The [patch reference](patches.md) owns coverage and update checks.

The [generated Debug World](debug-world.md) classifies glass blocks, panes and mesh/grates by registered inheritance, tags and explicit family choices. Doors and pipes are excluded from those groups.

## Evidence history

[Pack verification](verification.md) records released artifact checks. Older event records remain available in the published 0.10.0 tree; they are not current operating procedures. Relevant resource comparison records are linked below.

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

## Lootr: Styled

Lootr: Styled owns runtime Lootr model/artwork adaptation. Visual Patches retains the selected vanilla Fresh Objects + 3D Default composition and emits no Lootr-specific CEM, barrel leaf or texture. Its vanilla composition preserves its donor attribution. The Atlas and relighting editor remain here; `build-lootr-styled-profile.py` exports their permission-pending local profile separately. Runtime adaptation preserves effective source geometry and UVs, with explicit Lootr profile slots above inherited presentation.

The empack declaration selects [Lootr: Styled 0.1.0](https://github.com/mannie-exe/lootr-styled/releases/tag/v0.1.0) and its exact public re:form 0.2.0 dependency. Keep one shared re:form installation for Compat and Lootr: Styled. Review the exact release metadata and digests, then apply `empack update lootr-styled --apply` when changing its selected source. Local candidate staging is an explicit development workflow; public builds need no separately staged addon.

Settings are explicitly seeded client preferences; local profiles are not distributed. Do not reactivate the old `storage.lootr` visual-pack option or author Lootr profile recipes into the shipping ZIP. Update the addon’s native dependency/ABI checks and repeat its native resource/reload/container tests when changing Lootr, EMF/ETF or Minecraft. Artwork permission and native rendering qualification remain separate.

## Sable Beyond and Kaleidoscope

The selected native NeoForge 1.21.1 trials are Sable Beyond 0.5.0, Kaleidoscope Cookery 1.6.0 and Kaleidoscope Tavern 1.2.0. Empack pins the exact runtime releases on both sides. Explicit primary-file bindings omit Cookery/Tavern source JARs from runtime and exports. Sable 2.0.6 and Create 6.0.10 remain unchanged. Cookery and Tavern require no additional gameplay mod; KubeJS is an optional Cookery integration and is not added.

[Culinary integration](culinary.md) owns ordinary wheat flour/dough interoperability, preferred Cookery dough outputs, recipe discovery, the disabled one-flesh drying shortcut, and new Screwdriver effect grants. The managed Tavern `tavern.InfiniteLavaFromTap=false` prevents renewable cauldron lava filling while retaining Molotov production and other native taps. Cookery's Satiated Shield and the other food/drink effects remain available for gameplay testing. Milling and other tray routes retain native policy pending review. Honey yield, dragon-head tapping, existing serialized Upside Down effects, and custody repairs require the separately saved optional runtime work; they are not changed by recipe data.

Sable Beyond's default-on features include cross-sublevel fire/lava behavior, flowing-fluid forces, encased-fan forces, mechanical-arm target handling and powered-water-wheel propulsion. Entity mass, dynamic stored-content mass and optional inverted-basin behaviors are off by default. These switches do not disable its separately authored per-position mass overrides; do not assume disabling automatic stored-fluid mass clears previously saved custom masses. Ordinary Copycats remain facades with native base mass and the pack's existing classifications.

### Sable ownership and release checks

Prefer Beyond for equivalent or better functionality. Retire only the replaced Compat producer after comparing the exact versions and behavior; retain independent island/frame repairs. The current ownership comparison is:

| Behavior | Owner and adoption boundary |
| --- | --- |
| Cross-sublevel arms, fan forces, fire/lava interaction and powered-wheel propulsion | Beyond supplies these; no corresponding Compat implementation was found to retire. Review other native Create/Sable/addon hooks on the same action before adding a repair. |
| Fluid forces on constructs | Beyond and Compat/Dynamic Waters have overlapping inputs. Beyond calls `FluidState.getFlow`, which reaches Dynamic Waters' flow mixin and Compat's island-flow context. A hydrology current can therefore feed Beyond's point-force producer and Compat's `IslandWaterShips` impulse producer. Separate callbacks do not establish separate currents. |
| Dedicated-server water-container lookup and sublevel/global projections | Compat repairs these independently of its current impulse. Removing the whole `dynamic_waters.sable_currents` adaptation also removes those repairs and can restore the upstream dedicated-server reflection failure. Split producer ownership from these bridges before retiring the impulse. |
| Island temperature, altitude pressure, lighting, distant rendering, grave recovery and static material classifications | Existing owners remain. Beyond's automatic mass and fluid-force features do not replace these contracts. |

The proposed force handoff is to let Beyond supply the physical force and suppress the competing Dynamic Waters/Compat producer, retaining needed flow queries and frame/server bridges. This is a design direction, not implemented retirement or proof of equivalent motion. Qualify both producers separately and together on actual wet constructs, then verify the handoff, explicit disable/absence, ordinary worlds and marked island worlds. Include yaw/tilt, saved/reopened constructs, dry/unloaded water, native flow overrides, genuine hull contact versus fluid inside a hollow envelope, current direction/magnitude and force cost. Check the actual consumer's frame convention: Beyond's queued point forces and Compat's rigid-body impulse use different APIs, so copying an inverse rotation between them is not a valid repair by itself.

Beyond samples a transformed plot AABB rather than exact hull contact. Its `MAX_SAMPLES_PER_SUBLEVEL=512` chooses a stride; mandatory endpoint sampling and uneven dimensions mean it is not a hard sample-count cap. Each sample can also invoke the Dynamic Waters/Compat flow path. Measure actual callback counts and cost before advertising a bound or assuming void-heavy worlds make this negligible. Upstream reports water-wheel breakage against opposing flow and incomplete cross-sublevel cannon-arm interaction remain separate from this source-confirmed producer overlap.

The fresh disposable packaged-mod title check reached public Compat 0.42.1 and all three new mods with 224 native, 61 IPN and 25 EMI bindings and exited normally. An earlier full selection on Compat 0.42.0 failed with duplicate Create client extensions for `create:cardboard_helmet`; the Beyond-absent control, a read-only registration-observer run and subsequent uninstrumented full retries passed. The observer recorded one helmet builder and one dispatch through Create Deco's early `AllItems` initialization. This does not identify the failed run's duplicate producer, establish that Beyond or Compat caused it, or show that a later release repaired it. Retain the intermittent startup report; the named-bootstrap title checks do not qualify production Prism, world or physics interactions.

Cookery adds its own stove/pot/stockpot, chopping, drying, steaming, tea and animal-driven millstone systems, food effects, crops, equipment and placed food. Tavern adds grapes/pressing, staged fermentation, drinks, shaker recipes, taps, display storage, signs and seating. Their block interfaces are already largely in-world; neither requires a general GUI replacement to use its workstations. Acquisition/production review remains with the Atlas and [equipment register](equipment.md). New crop/vine availability depends on actual native features/biomes; their presence does not prove useful island acquisition or moving-craft operation.

The selected Cookery millstone exposes a confirmed source contract defect: simulated insertion reports the whole matching stack accepted, whereas commit takes at most eight and mutates its caller-owned stack. Upstream reports AE2 duplication; that is not reproduction in this pack. The insertion repair was shipped in [Compat 0.42.1](https://github.com/mannie-exe/skyweave-compat/releases/tag/v0.42.1), and remains in the current Compat candidate. Its optional `kaleidoscope_cookery.millstone_insertion` repair defaults on for exactly `1.6.0-neoforge+mc1.21.1`. No extra pack switch is needed. The adapter's native capability/helper and processing controls reproduce the original defects and qualify bounded acceptance, caller/component retention, occupied/invalid refusal and native wheat-to-flour processing; this is not an AE2 or whole-pack exploit qualification. Recheck exact native capacity, recipe/output/busy controls, caller immutability and item conservation when updating either side. Rice/container loss, reported table culling, oil-pot behavior and moving-seat issues remain separate; the millstone adaptation must not silently claim to repair them.

### In-world presentation adapters

Diegesis/Hands-On Vanilla remain candidates. Hands-On Vanilla's menu-backed stations present existing native menu slots; Cookery's pots and Tavern's barrels primarily use custom block-entity actions instead. Merely listing their blocks under a vanilla station would give the wrong slots, actions or authority. A useful first trial is an optional camera/hover presentation that retains their normal server block-use path. A fuller Diegesis station needs a server-authoritative adapter to the existing `IPot`, `IStockpot`, `IMillstone`, `IBarrel` or `IPressingTub` authority, with original recipes/custody and one backing inventory, rather than a duplicate scene inventory.

Diegesis distinguishes client-only visual state, menu-backed authority and server-backed stations. Client-only visuals cannot safely become an alternative inventory or fluid authority. A future bridge must verify actual item quantities/components, reach, ownership, target removal/unload, concurrent users and native rejection; keep native use as a fallback. Moving Sable stations additionally need frame-correct camera, rays, distance and attachments. Both Kaleidoscope projects have upstream reports of seats losing riders on moving constructs; a presentation adapter does not fix riding physics.

Their inspected player-render hooks only hide the player for specific gameplay states (Cookery trash-can hiding and Tavern grass-stealth effect); they do not replace the player animation skeleton. Ordinary compatibility with Punchy/Moves therefore differs from fitting each new tool, bottle and food model. Follow the [animation contract](animation-compatibility.md) for native hands, both display contexts, special item use and shader checks; no blanket blacklist or animation bridge is installed by this trial. Cookery also observes the existing crouch key during its Flatulence effect, consumes a click and adds upward motion. Treat this as a contextual gameplay overlap to qualify, not a new keymapping or a modifier repair already supplied by Compat.

When updating these mods, review their exact mixins, Sable/Create APIs, default configs, common/client separation, tags/recipes, registry-driven acquisition and upstream issues together. Keep the native resources intact and retire only adaptations that upstream actually replaces. Source code and resource licenses differ for Kaleidoscope; do not treat source redistribution terms as permission for extracted artwork.

## Loconautics candidate

[Create: Loconautics 0.1.3BETA](https://www.curseforge.com/minecraft/mc-mods/createloconautics/files/9627028) is reviewed but not selected for installation. Its released metadata accepts the pack's Create 6.0.10, Sable 2.0.6 and Aeronautics-bundled Simulated line. It adds physical train carriages, bogeys, couplers, hoses, controls, gauges and train mail; ordinary Create trains and Sable train assembly have separate enable switches. The public JAR has 86 common and 48 client entries in its main mixin configuration, crossing assembly, storage, tracking, collisions, train movement and rendering. A successful startup would not establish that those transitions preserve a train.

The released JAR confirms three integration concerns:

- `BlockVariantApplyPacket` validates a same-family choice but replaces the held stack with `new ItemStack(chosenItem, count)`, discarding its existing components, including a custom name. A repair needs to preserve applicable shared components without blindly carrying item-specific defaults into another variant.
- Pickers dispatch through `KeyMapping.matches` in raw key events rather than a complete active mapping/modifier check. The defaults include V, Left Alt and a contextual Tab rotation control. Reconcile these with the pack's modifier/focus rules and contextual building/editor controls before adoption; current Moves/Effortless/Power Grid repairs do not cover Loconautics.
- The grab-arm pose hooks vanilla `ItemInHandRenderer.renderPlayerArm`. Punchy's first-person path needs a specific comparison or bridge; this is an unqualified ownership boundary, not a reproduced broken animation. Third-person presentation and shaders also remain unqualified.

The released block-entity cache still validates its list through a repeated stream scan. [Upstream performance measurements](https://github.com/Creators-of-Locomotion/Create-Loconautics/issues/229) identify this cost on closely matching Create/Sable versions; the development branch contains a newer optimization that is not present in the reviewed public JAR. Do not credit development fixes to 0.1.3 or treat those external measurements as this pack's profile.

Other relevant reports are [link-frequency loss during disassembly](https://github.com/Creators-of-Locomotion/Create-Loconautics/issues/122), [Power Grid wire persistence](https://github.com/Creators-of-Locomotion/Create-Loconautics/issues/166), [unloaded train operation](https://github.com/Creators-of-Locomotion/Create-Loconautics/issues/196) and [duplicate bogey collision bodies after unloading](https://github.com/Creators-of-Locomotion/Create-Loconautics/issues/231). These are upstream reports, not pack reproductions; the link report names Lithium/Create/Sable versions present here, but its whole dependency combination has not been qualified. Reported Sophisticated Storage tank duplication is not an installed-pack witness because that mod is absent. Do not generalize it to Traveler's Backpack.

Hold adoption until a bounded comparison establishes assembly/disassembly and save/reopen custody, frequency/wire retention, partial-consist unloading/reloading and appropriate rail/portal behavior. Include actual contents and retained component data, not just a visible locomotive. Beyond and Compat fluid forces can also reach these Sable bodies; train propulsion and external-force handling need inclusion in the existing single-producer review. Static resources/configuration cannot repair that lifecycle or physics boundary. Prefer upstream fixes for train-core behavior and narrow optional Compat adapters for demonstrated integration defects.

The CurseForge add preview proposes separate provider identities for already selected Create, Sable and Aeronautics, then refuses duplicate destinations. Resolve those identities against the existing selections before any eventual installation; do not add another copy or change their versions just to satisfy the preview. No Loconautics native boot or gameplay test has been run for this candidate. Its released `ExperimentalConfig.enabled` returns true outside a production loader, so a later ModDev fixture must distinguish forced experimental admission from production defaults. Code is MIT; artwork has separate reserved rights, so source availability does not authorize copying its models into Resource Patches.

## Snow and ground cover

Snow Under Trees 1.21.1-v1.7 is the native NeoForge selection for single-layer snow beneath cold-biome tree canopies, both during generation and snowfall. Simple Snowy Fix 2.2.1 repairs missing snow caps when neighboring chunks' tree leaves are placed later. Its optional `placeSnowOnLeavesUnderLeaves` expansion remains false. These are physical snow placement paths, not leaf-whitening shaders. Common configuration is managed pack policy on both distributions; native client config screens do not make these player-only preferences.

The selected pair passed a disposable minimum NeoForge 21.1.265 dedicated startup, placement of the native pine feature, and normal shutdown. This is source/loader/native-feature qualification, not a rendered full-pack snow scene or proof of every modded tree, moving Sable body, stacked island, or C2ME generation order. Generation changes primarily affect new trees/chunks; Snow Under Trees also has its independent snowfall tick path for loaded terrain.

Snow! Real Magic! 12.2.7 with Kiwi 15.8.7 is selected for snowlogging. Both `accumulation.accumulatesDuringSnowfall` and `accumulation.accumulatesDuringSnowstorm` are false. Snow gravity is also disabled. The owner retains falling-snow ice conversion, fall cushioning, and the eight-layer covered-block spawning limit; other native QoL, collision, step, grass-preservation, melting, and overlay defaults remain. Disabling gravity makes falling-snow conversion normally inactive without another falling-snow producer. Its complete native-writer YAML is managed pack gameplay policy, with no added client-preference override. A minimum headless snowy-flat boot accepted its configuration and native Snow Under Trees integration; this is not full-pack rendering or climate qualification.

| Feature | Current selection | Review consequence |
| --- | --- | --- |
| Snowlogging and natural covered-block generation | On | Requested core behavior; plants/fences/slabs/stairs can share snow according to native conversion rules and tags. |
| Snow accumulation in ordinary snowfall / thunderstorms | Off / off | Prevents extra weather-driven layer growth; ordinary single-layer cover and manual placement remain. |
| Blizzard gamerules | Native strength 0 | Off by default; frequency is inert until an operator sets positive strength. No world gamerules are edited. |
| Snow gravity / falling snow turns water sources into ice | Off / on | Falling-snow physics is disabled; ice conversion remains selected for any falling snow produced elsewhere. |
| Fall cushioning / thinner collision | On / on | Retained by the owner for cushioning and easier movement. |
| Step multiplier / maximum increase | 1 / 1 | Native step assistance; retains the mod's movement rules rather than claiming vanilla equivalence. |
| Grass preservation beneath deeper snow | On | Prevents snow cover from killing underlying grass. |
| Snow replacement / scraping / overlay toggle | On | Building and snowball/visual interaction conveniences. |
| Natural melting / warm-biome snow-and-ice melting / never melt | On / off / off | Retains native SRM layer melting and vanilla-style light thresholds, without globally enforcing permanent snow. |
| Covered-block mob spawn layer limit | Maximum 8 | Explicit owner selection; underlying support still has to permit spawning. This does not raise mob caps or spawn-attempt rates. |

Retain the existing island climate authority when adding snow consumers. Snow Under Trees' `canSnow` and SRM's `CommonProxy.coldEnoughToSnow` / `Hooks.placeFeatureExtra` contain direct temperature/precipitation checks without the level-scoped entry used by Compat's native `Biome.shouldSnow`/`shouldFreeze` wrappers. Those call sites need a bounded island-altitude review; a successful ordinary-world boot does not qualify them. Native under-tree worldgen admission restricts feature insertion to cold base biomes, but its recurring weather path still needs its own control. Do not broaden climate projection to every biome query or claim complete stacked-surface coverage from one heightmap.

On updates, inspect the native feature stage and tree mixin injection points, config writers, optional SRM `Hooks.convert` signature, climate scope, and resource/model owners together. Recheck the source guard against snowing on player-grown trees before widening leaf coverage. SnowyLeavesPlus is not selected: the 1.21.1 releases are Fabric-only and its author reports fundamental client/server state issues and abandonment. The separate Fabric Snow project is also not selected; its newest feature list does not describe its older 1.21.1 artifact.
