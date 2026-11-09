# Teams, dimension access and progression

This guide owns initial spawn recovery, deferred team/home policy, dimension-access boundaries and the related mapper requirements. The [quest guide](journal.md) owns writing, dependency and reward direction; the [prison design](prison.md) owns planned dimension content.

## Current scope and behavior

Initial spawn recovery selects a suitable accepted secondary/companion island
instead of the main anchor. This is the shared world spawn, independent of party
membership. Custom team starts, onboarding, home selection and fresh-start
policies remain deferred. FTB Teams provides native party/progress identity for
FTB Quests; it does not assign starting clusters.

`SpawnFallbackMixin` retains upstream's initial-world guard, then delegates to
`SpawnLanding` for bounded companion selection and native terrain validation.
It checks support, headroom, fluids and world bounds after generation. A saved
selection prevents a restart from resetting the companion to the main island.
Existing mature worlds, saved player positions and personal beds keep their
native behavior. This is not a per-login allocator or a custom respawn system.

The dedicated template sets `allow-nether=false`. Compat's default-on, optional
access policy also covers marked integrated worlds and the native entry paths
below. FTB Quests 2101.1.38, Teams 2101.1.12 and Library 2101.1.39 coexist with
Questlog. Seeded options bind grave accent to FTB Quests and leave Questlog
unbound; existing settings require a targeted installation update.

## Deferred team starts and home policy

Retain the direction of separate party clusters with arrival on secondary islands,
but do not implement a partial allocator or chooser. The discussed distribution
uses configurable 4×4 regions of potential placement cells, a two-thirds cap based
on suitable clusters, outward ring/tiling-spiral progression and permanent gaps
once regions close. These are deferred design constraints, not current behavior.

Solo/private/shared starts, shared-cluster capacity, initial-home persistence,
home changes on joining/leaving, explicit relocation and player-progress/fresh-start
rules still need discussion. Keep membership, quest progress, initial arrival,
world spawn, personal bed and home assignment distinct. No custom reset or data
purge is required or implemented for native party membership. Keep normal beds
and current respawn behavior while the integration is deferred.

FTB Teams' stable personal/party IDs and native events are potential future
integration boundaries; FTB Chunks is not required. The inspected FTB Team Islands
source targets Minecraft 1.18.1 and template placement, rather than the current
procedural cluster field. A future team allocator still needs bounded planning,
actual landing validation, persistent ownership and concurrent-arrival handling;
the startup recovery loop is not that system.

The inspected Teams 2101.1.12 implementation has `free_to_join`, default false:
public parties can permit direct joining; private parties use invitations.
Password protection and a hidden directory are not established native features.
Any future custom chooser must authorize membership on the server: an internal
`PartyTeam.join` call is not itself an invitation check. Current native team
controls remain available without introducing custom onboarding now.

## Quest and world progression

Keep three facts distinct: personal achievements, the party's quest completion,
and any future server-wide world milestones. Team completion must not silently
become a global unlock. No world-stage system is currently requested; do not add
one merely to store team progress.

The inspected FTB Quests 1.21.1 branch has team-owned progress, dependency graphs,
optional quests, item/advancement/biome/dimension/structure/interaction tasks,
custom tasks, native translations, and independent per-team/per-player rewards.
Native join behavior merges personal progress into an existing party using the
maximum task value, not a sum. Leaving restores personal progress while retaining
applicable claimed-reward records. Creating a party copies its founder's data.
The native server fixture verifies incoming personal progress/claims, offline
party members, team and personal manual claims, duplicate claims, overflow and
save/reopen. It uses embedded GameTest-style connections, not two remote clients.
Automatic collection is not the authored default. These remain native FTB
semantics; Compat adds no membership/progress migration policy.

Prefer once-per-team infrastructure supplies and per-player personal equipment
where appropriate. Rebudget using the existing journal's modest setup/operating
batch principles. Shared progress does not automatically require shared rewards.
Ordinary quest completion is team-owned; do not promise independent completion
for every teammate just because rewards can be personal.

Candidate capability chapters, with final names/content left open:

| Capability                | Example branches                                          |
| ------------------------- | --------------------------------------------------------- |
| Establish a foothold      | Food, basic tools, storage, first useful processing       |
| Power a workshop          | Rotation, pressing, washing, heat and resource access     |
| Leave the starting island | Gliding/local crossings and first controlled flight       |
| Extend operating range    | Reliable fuel, controls, docking and a return reserve     |
| Move useful cargo         | Packaging, transfers, settlements and complete deliveries |
| Explore unusual habitats  | Rare island combinations and meaningful discoveries       |

Use actual capability dependencies and alternatives. A chapter boundary is not
a compulsory recipe lock, and possession of flight hardware is not proof of
successful flight. Native action evidence and survival testing remain separate
from a completed content conversion.

Keep one authored content owner in `authoring/quests/`. The existing generation/
localization pipeline targets FTB SNBT, stable IDs and native locale files; maintain
Atlas authoring and validation with that contract. Do not independently maintain GUI-edited output and
generated definitions. Retain useful existing advancement triggers. Questlog UI
adapters can remain optional/absent-target-safe until the trial is accepted.

Skyweave island-combination discoveries need an authoritative adapter or server
advancement: validate the player's actual location and winning terrain owner
against the saved generation profile. Running a locator or approaching a planned
center is not a discovery. Avoid cold hydrology work on every player tick.

## Dimension access policy

The optional `minecraft.nether_access` policy applies when the Overworld uses the
marked Skyweave generator. Dedicated defaults also set `allow-nether=false`.
The registered Nether level and existing DIM-1 data remain intact.

Native frame ignition is denied without consuming a charge or damaging a tool;
ordinary fire, candles and campfires remain usable. Creation and portal-destination
hooks cover environmental ignition and old portals before exit search. Entity
travel and direct native teleport boundaries reject Nether entry. Saved Nether
logins recover through an allowed respawn location with inventory/progress intact;
closed-dimension respawn anchors fall back to the Overworld. Other dimensions and
unmarked worlds retain native behavior. Foreign teleport implementations that
bypass these boundaries require their own verified integration.

Ruined-portal templates inspected by the native fixture are inert, so no art or
loot removal is needed. Their salvage remains an Overworld acquisition source.
The denied-activation extension point currently does nothing; it adds no prison,
effects or alternate travel. Operators can deliberately disable the policy and
restart when access is needed. Follow Compat's configuration and adapter guides
when changing hooks or application timing.

The [prison design](prison.md) remains separate planned content. Access closure
and acquisition evidence do not establish a survival-complete resource economy.

## Mapper findings and progression consequences

The mapper combines recipes, terrain gathering, mob drops, chest loot, trades
and interactions. Its explicit environment contract joins native preset biome
membership, features, structures, pools, templates and effective access policy
with authored procedural source bindings. Registration alone does not prove
world generation, and surveyed blocks alone are not free natural resources.
See the [data pipeline](web/data.md) for the capture and availability owners.

Available/potential, blocked and unclassified sources remain distinct. Closed
Nether routes cannot seed the solver; downstream recipes retain missing-access
status. Real Overworld exceptions remain eligible. Unknown custom generation
stays unclassified rather than being guessed from resource names. Both graph
and item views use the same root/method policy and preserve manual selections.

Common-material checks cover logs, stone/cobble, sand/gravel, andesite, iron,
zinc and quartz. Quartz can use Create washing after documented Overworld
soul-sand salvage; this is potential acquisition, not a measured travel or
resource budget. Blaze/netherite branches can remain blocked. No replacement
recipes or economy changes are implied by the environment model.

Planned scoring still orders opportunities, unknown outcomes, randomness and
depth; earliest scoring orders depth. Neither measures mining effort, biome
travel, density or quantities. Definition checks and default-route witnesses do
not replace survival testing. Revisit heat, brewing, End access and intentionally
unavailable content before claiming the whole progression is playable.

## Source and verification boundaries

Source review, not runtime qualification:

- FTB Quests `1.21.1/main` at
  [d76327d](https://github.com/FTBTeam/FTB-Quests/tree/d76327d69f9392961746c6e3fd6e976b88308ef8):
  TeamData, ServerQuestFile, tasks, rewards, translations and NeoForge dependencies.
- FTB Teams `1.21.1/main` at
  [61da411](https://github.com/FTBTeam/FTB-Teams/tree/61da4114cf46c651fa3575bbd00bcf654133dd66):
  Team API, effective identity, party creation and membership events.
- FTB Team Islands `main` at
  [be238ac](https://github.com/FTBTeam/FTB-Team-Islands/tree/be238acb6f2400959c35ba56090be316f75cc4eb):
  Minecraft 1.18.1 properties and template-placement README.
- Exact local NeoForge 21.1.265/Minecraft sources: PlayerRespawnPositionEvent,
  PlayerSetSpawnEvent, PortalSpawnEvent, EntityTravelToDimensionEvent,
  MinecraftServer, DedicatedServer, Entity, ServerPlayer and WorldDimensions.

The selected NeoForge JAR metadata confirms Minecraft 1.21.1, the existing Architectury 13.0.11, FTB Library >=2101.1.39 for Quests and >=2101.1.37 for Teams. FTB XMod Compat is optional and is not installed. Exact official CDN URLs and digests are recorded in empack because 0.8.2-beta's cross-provider required-dependency addition duplicates the existing Modrinth Architectury. Do not change or duplicate that shared JAR merely to normalize provider labels. Revisit provider pins when the resolver can retain one cross-provider identity safely.

Earlier source metadata is retained under `.git/captures/team-world-progress/`. Current native and browser qualification is recorded in Compat’s `.git/captures/misc-changes/` and the [Atlas verification guide](web/verification.md). Source, runtime definitions, native server behavior, client UI and survival evidence are separate; none substitutes for the others.
