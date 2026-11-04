# Upstream findings

Issue states below were inspected on 2026-10-21 unless a later date is given.
They are dated evidence, not a live tracker; recheck the linked artifact/issue
before removing a workaround during an update.

Read-only review of GitHub issues/PRs (open and closed), project metadata and
selected current source files. No issue, comment or PR was published. The entries below distinguish upstream reports from local pack policy.

## Existing reports
- Create Deco 2.1.3 placard ingredient: open issue #282.
  https://github.com/talrey/CreateDeco/issues/282
- Interiors 0.6.1 dye tags: open issue #61; fix PR #60 merged 2026-07-27.
  A source merge does not establish that the installed artifact contains the fix.
  https://github.com/aesefficio/CreateInteriorsMod/issues/61
  https://github.com/aesefficio/CreateInteriorsMod/pull/60
- Bells & Whistles 0.4.7 metro glass tag: open issue #46 and open PR #54.
  https://github.com/sudoLev/BellsAndWhistlesMod/issues/46
  https://github.com/sudoLev/BellsAndWhistlesMod/pull/54
- Design n' Decor 2.2b industrial cogwheel tag: open issue #133.
  https://github.com/DrMango14/Create-Design-n-Decor/issues/133
- Propulsion 1.1.5 platinum casing disappearing on mining/wrenching: issue #98
  closed 2026-10-20. Current main has singular loot_table/blocks/platinum_casing.json.
  https://github.com/Propulsion-Team/create-propulsion-simulated/issues/98

## Provider assessment limits

The 2026-10-31 empack assessment could not complete Fresh Animations because an
upstream version record was rejected as invalid/unsupported. Retain its reviewed
1.11.1 archive; this is incomplete catalog evidence, not proof that it is current.
JEI/Covers also required an explicit provider-identified file batch: Covers'
catalog edge points to an older exact JEI while its native dependency is optional
and unrestricted. The selected current JEI/EMI pair rendered AK's hinge recipe in
the isolated updated client. No empack or provider issue was submitted.

## New-report candidates

- Linear Bearing 1.3.5 includes an undiscovered Ponder service declaration and an
  Item/Object-array call against Ponder's ResourceLocation-array registration API.
  Its lone scene describes kinetic-driven movement, while the installed mechanism
  is a passive guide. Compat provides independently registered guidance. English
  internal-carriage names are also missing; the pack's resource fixes supply them.
  These findings come from exact released JARs and native client checks on
  2026-10-31; no report has been submitted.
- Absolute Kinematics 1.0.1 declares Minecraft/NeoForge requirements but omits its
  runtime Create/Sable/Simulated requirements. The pack explicitly supplies the
  reviewed combination. Both joint assemblies, a driven hinge, ball lock/release,
  and payload recovery passed; omission of metadata is not evidence of a broken
  mechanism. Source: [upstream repository](https://github.com/RCXcrafter/Absolute-Kinematics).

- Aero Cables 0.4.0: condition ae_cable, rs_cable and cc_cable recipes on ae2,
  refinedstorage and computercraft respectively. Installed runtime produced
  recipe errors without those optional mods. The pack's three conditions remove them.
  Current ae_cable JSON still lacks a condition at main revision
  a455e5639941745765657910ce3b73964fd0e2c6.
  https://github.com/tom5454/AeroCables/issues
- Create Addon Compatibility 1.0.0: condition three TFMG distillation overrides
  on tfmg. Current crude_oil JSON remains unconditional on 1.21.1 revision
  a26d68941319ec0fa143a6d24e7cccfb214ba55d. Older datapack startup reports concern
  other versions and are not established duplicates of this missing condition.
  https://github.com/Amronos/createaddoncompatibility/issues
- Propulsion 1.1.5 copycat_wing, copycat_wing_8 and copycat_wing_12 drops:
  installed loot tables only occupied obsolete loot_tables directory; the pack's
  singular-directory copies pass native loot rolls. Current main revision
  161ea5a8d1ec27080e9fe0327b6ac774495a21b6 retains those plural-path files;
  no corresponding singular files appeared in the tree. Report separately
  from casing #98, after checking a current build's actual wing behavior.
  https://github.com/Propulsion-Team/create-propulsion-simulated/issues
- Hostile Skies 0.2.6 Modrinth version HaZ4GxKd still pins Sable version
  e11C0I1A (2.0.3), while the shipped loader constraint accepts 2.0.3+ and the
  Sable 2.0.6 runtime boots. Metadata prevents normal empack resolution.
  Ask for compatible dependency metadata; this is not a demonstrated game crash.
  https://github.com/TheBlueTaco/Hostile-Skies/issues
  https://api.modrinth.com/v2/version/HaZ4GxKd

## Remaining diagnostics
- Design n' Decor's 256 optional Dye Depot loot tables: open issue #139.
  PR #140 was CLOSED WITHOUT MERGE; do not describe it as an upstream fix.
  https://github.com/DrMango14/Create-Design-n-Decor/issues/139
  https://github.com/DrMango14/Create-Design-n-Decor/pull/140
- Analog Audio 0.1.5-hotfix.1 requests a typed reflective registry method that
  Create 6.0.10 exposes with erased parameters. Create Sky Compat 0.5.2 repairs
  this lookup and restores the upstream radio movement handler. Recheck the
  [adapter procedure](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/README.md#analog-audio)
  when updating either dependency; remove the hook when upstream fixes the lookup.
  Ordinary contraption GUI support and audible moving playback remain separate
  checks. Upstream issue #114 is closed, but the selected Analog Audio binary
  still needs the fix; issue #123 tracks broader contraption limitations.
  https://github.com/palmmc/AnalogAudio/issues/114
  https://github.com/palmmc/AnalogAudio/issues/123
- Power Grid 0.6.2 reports an unsupported native backend on macOS. Its native
  loader supports Linux and Windows; networks start with JavaMNA and reject a
  switch to an unsupported backend. Keep `NATIVE` selected so supported hosts
  retain acceleration. An isolated Java 21 / NeoForge 21.1.264 check against
  Create Sky 0.1.18 on 2026-10-29 retained JavaMNA and produced 2 A through 6 Ω
  at 12 V, 1 A after changing to 12 Ω, and 0 A with the source off.
  Large-network fallback performance remains unmeasured.

Analog Audio's Sable integration is separate from Create movement registration.
The same isolated 0.1.18 check confirmed an active Sable hook, an assembled radio
with its block entity intact, and correct shipyard-to-world position projection.
Normal radio client ticking uses that projection. This does not establish audible
playback or sound tracking during flight. The maintained Compat probe owns
registration verification; no runtime changes are required for Power Grid.

## Ponder and Iris, 2026-10-24

A playtest found disappearing scene/UI content in Aeronautics' propeller Ponder;
other tested tutorials worked. Installed Aeronautics 1.3.2's
`propeller_bearing/thrust.nbt` contains an adjustable burner at `(6,4,9)`.
`PropellerScenes.propellerBearingThrust` powers it at signal 8 through
`RedstoneSignalInstruction`, invoking the burner's Veil flame shader.

Bytecode inspection with Java 21 `javap -c -p` confirms that Veil 4.3.2, bundled
inside Sable 2.0.6, has the faulty Iris `ShaderWrapperMixin`: `apply` binds Iris's
framebuffer, while `clear` attempts restoration using `@Share("drawn")` from a
different target method. That reference does not persist across the two calls.
The redirect also lacks a GUI/world-render guard. This explains a credible path
for subsequent scene/UI draws to go offscreen while animation continues.

[Aeronautics #1270](https://github.com/Creators-of-Aeronautics/Simulated-Project/issues/1270)
reports the same propeller section and shader-dependent behavior.
[Veil PR #213](https://github.com/FoundryMC/Veil/pull/213), open and unmerged when
checked, proposes restoring framebuffer bindings, restricting redirection to the
appropriate world pass, and choosing Iris's active color target. The installed
Veil JAR SHA-256 is
`774b83887d882dc47cd4d29d140cef0c8677747a6fe7799649f490926a4e0265`.

The isolated native client reproduced the propeller failure with
Complementary/Euphoria enabled; disabling shaders restored it. Adding only Veil
Iris Fix restored the affected scene with shaders, while the working mechanical
press, world burner, inventory and shader reload continued to render. The exact
A/B procedure and renderer limits live in its
[verification guide](https://github.com/mannie-exe/veil-iris-fix/blob/main/docs/verification.md).

`./gradlew check build` also passes actual-class transformation and controlled
framebuffer checks. The tested JAR is
`31c784adc24fa2e8d83b5bcebf0aed4e61d9f0be568d630ac1e28767ef34487f`.
The server-side mixin probe leaves the target byte-identical. Native checks used
Java 21.0.13/macOS arm64; other graphics drivers and shader packs remain unverified.
That standalone 0.1.0 release is now incorporated in Compat 0.6.0. Existing
Veil uniform-type warnings remain outside the correction. Compat’s
[rendering reference](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/rendering.md)
owns active update/removal procedures. Native checks of the combined release
remain pending; the earlier A/B observation above is historical evidence.

## Delivery endpoint integration, 2026-10-24

Installed ADQ 1.1.1's `QuestGenerator.lambda$generateNewQuestAsync$4` resolves the
structure locate position to a dry 3×3 surface. In two native Skyweave Compat
villages, locate returned a start-chunk corner beside void and that predicate
rejected the route despite valid ground two blocks away. Compat's optional,
version-guarded adapter retries within eight blocks and the known village bounds,
retaining the original predicate. Both endpoints and negative scope controls passed
before and after save/reopen. The owning mod's verification guide records hashes
and coordinates. Cargo placement and completion are not established by this check.

Bytecode inspection of `lambda$generateNewQuestAsync$9` also shows that the
configured maximum distance bounds the sampled search offset, not the final
structure route. After `findNearestMapStructure`, only the minimum distance and
world border are checked. The configured maximum is therefore not a hard route cap in VILLAGE mode. The
pack now selects a 6,000-block search offset; Compat's horizontal-distance
correction below affects minimum checks, not that maximum. Existing upstream issue coverage has not been checked for these
findings and no report was submitted.

The live isolated server then reproduced a separate loading failure: ADQ's paired
background FULL requests returned `Unloaded chunk`, but route finalization ignored
the failed `ChunkResult`s. A native control on the same two Sky Village chunks
failed without explicit tickets and succeeded with retained tickets. Compat
retains bounded endpoint neighborhoods through finalization and releases them
on success, rejection, failure or shutdown. This is reproduced with the installed
stack; it has not been isolated to vanilla or C2ME alone.

After loading worked, ADQ generated a one-block route from `(2240, 518, -3887)`
to `(2240, 518, -3888)`. Before surface resolution, one locator position had Y=0;
that artificial vertical difference satisfied the native 500-block minimum.
Compat uses horizontal distance for structure-origin and route checks in
the new preset. The corrected native run produced a roughly 3,021-block route to
`(-775, 524, -4079)` and released all 18 temporary tickets. It generated an offer;
acceptance, cargo placement and completed delivery were not established by that
run. Later acceptance and cargo pickup checks are recorded in
[world generation](worldgen.md#evidence-and-limits); full deliveries remain unverified.

## Pack decisions
- Zinc-sheet preference is pack unification policy.
- Disabled automatic raids and delivery tuning express pack design.
- Missing adapters, environment assumptions and graph false cycles were mapper
  limitations. They do not by themselves establish mod defects.

## Progression evidence
- Hostile Skies #4 reports ships spawning into Sky Archipelago terrain/trees,
  losing altitude and captured ships disappearing. External report, not locally
  reproduced. Keep automatic raids off while evaluating deliberate encounters.
  https://github.com/TheBlueTaco/Hostile-Skies/issues/4
- Propulsion #92 explicitly raises pre-Nether brass via solid/liquid burners;
  maintainer leaves that balance to pack/server authors. Evaluate it as an
  intentional alternative route before imposing any Nether gate.
  https://github.com/Propulsion-Team/create-propulsion-simulated/issues/92


See [patch maintenance](patches.md) for override ownership and update/removal checks.

## Generation compatibility, 2026-10-21

The installed Zfastnoise 1.0.13 biome redirect wins over Sky Archipelago 1.3.6's
Deep Dark biome projection redirect. This is reproduced in both the existing
server log and the isolated default-config capture. Disabling only
`mixin.perf.biome` removes the conflict in the candidate capture. Noise optimization
remains enabled. This is a report candidate; existing upstream issue coverage
has not been established and no report was submitted.

- [FastNoise repository and issue tracker](https://codeberg.org/ZenXArch/FastNoise)
- [Local configuration and verification limits](worldgen.md)

Sky Archipelago DYNAMIC spacing is explicitly seed-wide in the installed code
and config comment. Choosing CONSISTENT for this pack is a policy decision,
not a demonstrated upstream defect.

## Sky Villages placement, 2026-10-22

Sky Villages 1.0.6 with the current 1.21.1 pack reproduced a shielded natural
placement failure: `JukeboxBlockEntity#setTheItem:129` dereferences a null `level`
while loading a generated jukebox. Clearing generated record NBT through the
house processor removed the error in a fresh same-seed repeat. The loaded-area
structure command also succeeded. See [structures](structures.md) for the
artifact and workaround.

This is a report candidate, not an isolated attribution to Sky Villages, vanilla
Minecraft or another mod. Existing upstream coverage has not been checked and
no report was submitted. A minimal reproduction should include a record-bearing
template and compare vanilla/NeoForge, Sky Archipelago and the pack's optimizers.

Its ore processor also masks its own diamond rule: separate rule processors use
the same position seed, so the 20% diorite pass consumes every candidate for the
later 0.5% diamond pass. Native sampling and a positive ore-pass-only control
confirm this. The pack now uses a single ordered pass with scarce mineral rates;
see [structures](structures.md) for whole-village measurements. This has not been
reported upstream.

## Processing compatibility

Propulsion 1.1.5 uses `processingTime` in five Create recipes, while the installed
Create codec reads `processing_time`. Native exports omit those durations until
corrected. The pack repairs the spruce-log and copycat-wing keys; overlapping
platinum recipes instead defer to Create's existing family. Separately, broad
ore unification erased Create's stone/deepslate input distinctions. That is a
pack configuration problem, repaired by retaining geological ore identity.
See [progression](progression.md) for the resulting policy and validation.
Existing upstream coverage of the duration issue has not been checked and no
report was submitted.

## Client startup observation, 2026-10-23

One isolated resource-fixture launch stopped at texture stitching with Ponder
1.0.82, Create 6.0.10 and NeoForge 21.1.264:
`StitchedSprite.onTextureStitchPost(StitchedSprite.java:35)` attempted
`StitchedSprite.loadSprite(...)` on a null entry. An unchanged retry reached the
integrated world. No cause or pack-specific attribution is established.

[Ponder #92](https://github.com/Creators-of-Create/Ponder/issues/92) concerns a
null **sprite field** in a late-created entry; this capture had a null entry in
the stitch loop, so it is not an established duplicate. Preserve that distinction
if reproducing or reporting it. No upstream report or workaround was submitted.

## Fzzy Config fix1 packaging

The Modrinth NeoForge artifact `bp6Aw3FM` (`0.7.7+fix1+1.21+neoforge`)
contains literal `version = "${version}"` in `META-INF/neoforge.mods.toml`.
An isolated NeoForge 21.1.264 / Java 21.0.13 server rejected it with
`InvalidModFileException: Illegal version number specified version`; EMI Loot then
reported its missing Fzzy dependency. The previous `uG7oHgw6` artifact contains
a concrete version. Keep that selection until a corrected artifact passes native
loading. This was reproduced locally on 2026-10-25; no upstream issue was filed.

[Rejected artifact](https://modrinth.com/mod/fzzy-config/version/bp6Aw3FM).

## Create Radars 5.0.1 recipes

The 5.0.1 artifact registers `create_radar:directional_jammer`, but its jammer
recipe produces the absent `create_radar:jammer` and requires an empty
`create:shaft` item tag. Its warning-receiver recipe uses `c:plates/copper` as an
item ID rather than a tag. Native loading rejected both recipes on 2026-10-25.
The pack fixes the jammer output and shaft ingredient, and restores the copper
plate tag; shapes and other quantities remain upstream values. This makes the
registered directional jammer craftable; it does not restore the removed item.
Recheck these exact recipe IDs when updating Radars and retire the overrides when
upstream provides valid equivalents. No upstream issue was filed.

## Recipe-viewer shutdown observation, 2026-10-25

Closing the isolated client while an EMI recipe screen was open logged a caught
`NullPointerException` in `JemiPlugin.lambda$register$3`: JEI had already announced
its runtime unavailable, while the remaining tooltip render queried that runtime.
Recipe viewing worked before shutdown. Normal window close then stalled in
`Minecraft.disconnect`; the integrated server remained in its tick wait, so the
disposable test process was terminated. A causal link between that stall and
the tooltip error has not been established. This is a shutdown-order observation with
JEI 19.70.0.460, EMI 1.1.24 and Reliable EMI 4.8.0, not an established regression
or gameplay failure. No upstream issue was filed.
