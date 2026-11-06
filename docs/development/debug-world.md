# Debug World

Debug World is a generated, empty-world fixture for inspecting registered blocks,
entities and maintained resources. It uses colored floating districts at different
heights, a teleport directory, enlarged labels and group reset buttons. Terrain
and structure-generation surveys remain separate.

Neighboring districts have approximately 12-block flight lanes and floors at
Y 152, 160 or 168. Specimen spacing stays at 14 blocks. District headings,
specimen names and directory destinations use platform-matched colors on black;
IDs and neutral controls use black on white. Backgrounds are 96% opaque, with
fully opaque text. Label colors use lighter shades of dark platform hues for
contrast; these roles and colors are editable in `world.json`.

Labels use native `text_display` brightness overrides of block 15 and sky 15.
This keeps their lightmap full-bright without a renderer patch. Shaders can still
apply fog, tone mapping and shadow-pass behavior; brightness does not exclude
labels from casting shader shadows.

Text scales are 2.5 for specimen names, 1.3 for IDs, 4.4 for headings and 1.7 for
controls. Each line has an added space on both sides, approximately 0.4 em with
the current game font. Labels wrap at 28 characters before padding so wrapped
lines retain their inset. Minecraft's vertical background inset is fixed; its
physical size grows with text scale, but its proportion cannot be configured.

## Source and outputs

| Source                                   | Owner                                                                         |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| `authoring/debug-world/world.json`       | Layout, hub, label roles and fixture gamerules                                |
| `authoring/debug-world/profiles.json`    | Runtime and district selection                                                |
| `authoring/debug-world/districts/*.json` | Curated subjects, state choices and placement recipes                         |
| `web/tools/exporter/DebugRegistry.java`  | Exact registry properties, inheritance, tags and build bounds                 |
| `scripts/debug_world/`                   | Planning, native commands, save verification and installation                 |
| `.cache/debug-world/`                    | Disposable captures, compiled packs, native runs and generated saves; ignored |

The manifest records stable case IDs, positions, source/config/compiler hashes,
exact runtime JAR hashes, expected states and explicit omissions. Adding a case
moves later layout rows when needed; its identity does not depend on coordinates.
The datapack belongs only in marked debug saves, never normal pack overrides.

The profiles are `create_skyweave`, `smoke` and `vanilla`. Smoke exercises placement
strategies in one compact district. Vanilla uses genuine Mojang reports and the
original vanilla server, without NeoForge, Compat or a required client probe.
A namespace filter on modpack metadata is not a vanilla-runtime check.

## Generate and install

Run from the repository root. Use the Atlas Python environment for verification;
its Anvil decoder requires NumPy. Java must be 21. The native runtime must match
the captured registry's adjacent `snapshot.json`; generation rejects different
JAR inventories. The current runner targets Minecraft 1.21.1 and selects the
exact NeoForge 21.1 version recorded by the registry capture. Missing or
mismatched loader libraries stop generation rather than selecting another version. If the
playing server is on an older release, prepare a separate server-reference
installation and use its game directory as `--server`; do not upgrade the playing
server merely to generate this fixture.

```sh
PY=web/.cache/python/bin/python
JAVA=/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home/bin/java
SERVER="$HOME/Minecraft/create_sky-server/game"
REGISTRY=.cache/debug-world/runtime/debug_registry.json

# Creates an isolated exporter runtime; does not read the playing server world.
$PY web/scripts/runtime.py --output .cache/debug-world/runtime --work .cache/debug-world/capture
$PY scripts/debug-world.py plan --registry "$REGISTRY" --profile create_skyweave
$PY scripts/debug-world.py compile --registry "$REGISTRY" --profile create_skyweave --output .cache/debug-world/compiled
$PY scripts/debug-world.py generate --compiled .cache/debug-world/compiled --output .cache/debug-world/world --work .cache/debug-world/native --server "$SERVER" --java "$JAVA"
$PY scripts/debug-world.py verify --world .cache/debug-world/world
$PY scripts/debug-world.py install --world .cache/debug-world/world --client-game "$HOME/Library/Application Support/PrismLauncher/instances/Create Skyweave/.minecraft"
```

Choose fresh `--work` and world `--output` paths for another native generation.
Compilation replaces only its own marked output through staging. Failed native
construction leaves the previous published world untouched and names its log.
Generation copies configurations and reads runtime JARs/libraries, accepts no new
EULA on the owner's behalf, binds a disposable server to loopback on an ephemeral
port, and disables its BlueMap listener. The playing server is not restarted.

Install only after saving and leaving the affected world. Installation verifies
its source, stages the copy, checks ownership and holds the native world lock
immediately before replacing an existing destination. Use `--replace` explicitly
to replace a marked Debug World, or `--name` for a different save name. Unmarked
saves are refused. Other saves are not part of replacement.
Prism and Minecraft may remain open when the affected debug save is unloaded;
this does not authorize editing other instance files.

## Vanilla

Generate reports from the original Mojang 1.21.1 bundled server JAR. Its SHA-1 is
`59353fb40c36d304f2035d51e7d6e6baa98dc05c`; the runner checks it. Create the report
working directory before running Java there:

```sh
mkdir -p .cache/debug-world/vanilla
VANILLA_JAR="$SERVER/libraries/net/minecraft/server/1.21.1/server-1.21.1.jar"
(cd .cache/debug-world/vanilla && "$JAVA" -Xmx2G -DbundlerMainClass=net.minecraft.data.Main -jar "$VANILLA_JAR" --reports --output reports)
$PY scripts/debug-world.py vanilla-registry --reports .cache/debug-world/vanilla/reports/reports --output .cache/debug-world/vanilla/registry.json
$PY scripts/debug-world.py compile --registry .cache/debug-world/vanilla/registry.json --profile vanilla --output .cache/debug-world/compiled-vanilla
$PY scripts/debug-world.py generate --compiled .cache/debug-world/compiled-vanilla --output .cache/debug-world/world-vanilla --work .cache/debug-world/native-vanilla --server "$SERVER" --java "$JAVA" --vanilla-jar "$VANILLA_JAR"
```

`--server` supplies the existing accepted EULA even for vanilla; no mod JAR is
loaded in that mode. Use a vanilla client profile to inspect the vanilla save.
Do not infer vanilla rendering from the modpack client.

## Controls and reset

The white hub has named, color-coded destination buttons and time, weather and
mode controls. Each group has a **Hub** button and a separate red **Reset this
group** station. Equipment displays include a chest with the shown armor. Use
Creative for interaction and Spectator for inside-face or freely positioned views.
Creative players still need to activate flight before stepping into the void.

Useful commands:

```mcfunction
/function debug_world:hub
/function debug_world:travel/lighting
/function debug_world:reset/storage/lootr
/data get storage debug_world:state
```

Group IDs and case positions are in `datapacks/debug_world/debug-world-manifest.json`.
Resets rebuild only that group's strips and tagged specimens; they do not move
players or erase other districts. Lootr containers begin unopened. Open an
interaction specimen to compare its looted state; the separate reference group
stays unopened until interacted with. Reset creates fresh containers.

First load initializes the fixture once. Unchanged reloads preserve interactions.
A changed compiled pack does not silently wipe an existing world: generate a new
save for layout changes. `/function debug_world:build/start` explicitly rebuilds
the current compiled layout; use it only in this disposable fixture. Native
construction loads one bounded strip, waits for chunks, places it, checks states
and releases its temporary loads. A failed stage cannot mark the world complete.

## Extend and maintain

Add or adjust a group in its district JSON. Use explicit IDs for intentional
comparisons, inheritance/tags for coherent families, and exclusions for unrelated
content. Required absent IDs fail; optional absent content is recorded. IDs alone
do not establish transparency. Keep doors, trapdoors and pipes outside glass-wall
families. Missing properties or recipes fail rather than substituting air.

Recipes own support geometry, neighbor updates, NBT and saved-state checks.
Reuse one before adding another. Plants use valid soil and hydration; tall plants
have both halves. Two solid platform layers support replaced sand and soil.
Random growth is disabled, while scheduled ticks, physics,
container interaction and animations remain active. Entity pens have floors and
walls, static specimens retain grounded/gravity semantics, and motion pens are
explicit. Aquatic specimens have enclosed source-water tanks and are checked
within that habitat rather than required to stand on the floor. Authored entity
variants round-trip through saved NBT checks; fixture identity, persistence and
safety fields cannot be overridden. Copycat panels, blocks and ladders receive
and verify their actual materials. The powered Create reference is a bounded
32 RPM motor/shaft/cogwheel network.

`samples` makes up to six labeled state comparisons with explicit floor, wall or
ceiling supports; it checks the requested properties after native updates.
Wall-mounted bells face their support, unlike wall buttons. The `circuit` recipe
uses native levers, wire, repeaters/comparators, lamps and pistons; no command block
simulates their signal. Use the lever to operate a circuit and reset its group to
restore the initial arrangement. Intentional player interactions can therefore
change a later verification result without indicating a failed initial placement.

Plan first, run the smoke profile for new placement strategies, then generate the
full profile. Inspect native rendering with the existing desktop harness; saved
block states do not prove correct textures, animation or ray selection. Exercise
controls/reset, save/reopen and verify the closed save. Keep captures with their
runtime/resource hashes and camera state. Current commands/check evidence lives
in [verification](web/verification.md#debug-world).

Copy resource-pack files into an isolated review client and confirm its actual
selected pack list before capturing. Minecraft rejects unapproved pack symlinks;
an options file listing those packs does not prove that they loaded. The optional
Compat probe is harness instrumentation, not a dependency of the generated world.

When Minecraft, NeoForge or participating mods change, recapture the registry,
review selected inheritance/property changes, revise recipe contracts and rerun
native checks. Update the pinned vanilla server/report and datapack-format
contracts for a Minecraft change. Recheck special NBT for Lootr, Copycat and
Create speed; matching IDs do not prove compatible block-entity formats.

The earlier `modpack-testing/projects/create-sky-resources/fixture.py` layout and
its camera coordinates remain historical comparison tools. New fixtures use this
compiler; do not run both generators against the same save. Preserve archived
media/run identifiers. Delete this task's disposable native runs and duplicate
worlds after keeping useful evidence; never prune personal backups or LODs as
part of fixture cleanup.

## Coverage

The curated Create: Skyweave profile has 1,088 comparison cases in 67 groups across 17 districts. A case may contain a connected wall, several labeled states or a
working circuit rather than one block. Coverage is curated from current registered
content, selected resource subjects, maintained fixes and useful native comparisons.

| District | Cases | Purpose |
| --- | ---: | --- |
| Glass | 202 | Full blocks, mosaics, caramel, bubble gum, corners and material boundaries |
| Window frames | 179 | Macaw window families |
| Panes | 58 | Connected strips, corners and isolated panes |
| Bars and mesh | 51 | Bars, grates, industrial grating, Rechiseled meshes and Copycat materials |
| Crops and water plants | 63 | Growth stages, rooted/hanging plants, fruit stems and aquatics |
| Pots and shrubs | 34 | Potted plants and pot models |
| Lanterns and lamps | 82 | Standing/wall lamps, four bridge facings, rope/stone supports and chains |
| Storage | 21 | Single/double storage, Lootr directions and reference containers |
| Connections and partial blocks | 80 | Ladders, grab rails, stairs/slabs, all vanilla doors/trapdoors, tracks and waterlogging |
| Entities and equipment | 69 | Grounded adults/young, variants, aquatic tanks, motion pens and armor |
| Workstations | 14 | Workstation models and native interaction |
| Props and materials | 18 | Selected surfaces, campfires, bulbs and material accents |
| Fluids and effects | 10 | Contained falls, material boundaries, bubbles, smoke and fire |
| Create mechanisms | 53 | Create/addon components, flight parts, Linear Bearing, linkage and bounded rotation |
| Redstone and circuits | 57 | Buttons/lever mounts, plates, signal components, working circuits and modded gates |
| Interactions and states | 18 | Use/inventory blocks, attachment/fill states and materialized Copycats |
| Building materials | 79 | Masonry, wood, leaf transparency, copper weathering and Create finishes |

This is not an exhaustive block/entity catalogue. It does not cover every wood,
color, state combination, rare entity variant or animation. Flying-entity
habitats, automatic moving-ship fixtures, structure/biome generation, and every
modded machine's operation remain outside the profile. Create vaults and shipping
containers are omitted because they do not provide the container interaction
being compared. Interactive windows, doors and machinery are not evidence that
all surfaces should use connected textures. Native rendering retains the selected
pack's actual CT, culling and backface policies.
