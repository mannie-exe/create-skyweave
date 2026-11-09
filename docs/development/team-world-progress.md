# Teams, dimension access and progression

This guide owns team spawn/respawn and dimension-access policy, its current implementation boundaries, and the related mapper requirements. The [quest guide](journal.md) owns writing, dependency and reward direction; the [prison design](prison.md) owns planned dimension content.

## Agreed direction and current behavior

- Different teams should start in separate island clusters. Members of a team
  share a starting secondary island within their assigned cluster.
- A valid personal bed takes priority on ordinary death; the team island is the
  fallback. Team changes should not silently erase personal bed positions.
- Death in the future prison also returns home through normal bed/team fallback.
  This is an intentional escape route, not a defect to prevent.
- Trial FTB Quests for a non-linear capability/progression map, with chapters
  spanning mods rather than following mod boundaries. Both quest mods are installed; quest conversion and replacement authoring remain to implement.
- Close Nether access with Compat policy and dedicated-server defaults. Keep the registered level. The prison is accepted planned content, not an installed external horror mod.

Current `SpawnFallbackMixin` redirects Sky Archipelago's fresh-world default
spawn through `SpawnLanding`. That helper checks actual generated ground,
headroom, fluids and world bounds, with bounded candidate/chunk counts. It does
not assign teams, choose persistent companion islands, or implement respawn.
The server template sets `allow-nether=false`. FTB Quests 2101.1.38, FTB Teams 2101.1.12 and FTB Library 2101.1.39 are materialized alongside Questlog. Grave accent is assigned to FTB Quests and Questlog is explicitly unbound in seeded client options.

## Team identity and spawn ownership

FTB Teams is the selected team provider; FTB Quests already requires it.
The inspected 1.21.1 source provides personal teams, party teams, effective IDs,
creation/membership/deletion events and stable team UUIDs. FTB Chunks is not
required for this use. Vanilla scoreboard teams would need a second bridge to
the quest owner; introducing another party provider has no demonstrated benefit.

Use an optional Compat adapter for the existing island generator plus FTB Teams.
FTB Teams owns membership; world saved data owns the assignment from team UUID
to cluster identity, companion identity, safe landing and generation/profile
provenance. A rename or leader change must not move a team's home.

A practical lifecycle is:

1. Allocate a solo player's personal team a suitable unreserved land cluster.
   Filter accepted companion metadata before requesting terrain. Reject unsafe,
   flooded or unsuitable tiny remnants; verify the actual generated landing.
2. Promote the founder's assignment when creating a party rather than granting
   another fresh island. Existing parties retain their assignment when joined.
3. Joining changes the fallback home. It need not teleport established players
   or overwrite beds; an explicit arrival/return action can be designed separately.
4. Leaving, disbanding and rejoining must preserve ownership history. Do not
   regenerate terrain, reset claims or hand out new resources automatically.

These lifecycle details are recommendations, not settled gameplay policy.
Persisting cluster reservations and defining orphaned assignments remain part of
the implementation design. Existing players require an explicit opt-in/reset or
assignment procedure; new spawn policy is not permission to relocate everyone.

Reuse metadata search and generated-landing checks, but not their current
synchronous startup loop for arbitrary concurrent player arrivals. Allocation
needs a bounded queue, finite search, safe failure and controlled chunk requests.
Do not fall back to an arbitrary fragment or fabricate a platform silently.
Terrain safety is separate from proving a viable survival start with food,
wood, water and a route off the island.

NeoForge's logical-server `PlayerRespawnPositionEvent` exposes both native and
replacement transitions after native respawn-block resolution. Preserve a valid
bed/modded respawn result, handle no-bed and invalid-bed fallback, retain the
future bed setting, and distinguish death from the End's return transition.
Initial arrival and login recovery need their own hooks. Verify event timing
against the first client position/chunk synchronization rather than relying on
repeated post-login teleports.

FTB Team Islands is not the proposed terrain owner. Its inspected public `main`
targets Minecraft 1.18.1 and places template islands/lobbies. That implementation
does not bind existing procedurally generated Skyweave companion islands. A new
supported release would still need an ownership/placement review before use.

## First-entry choice

A proposed first-entry flow offers Join a team, Create a team and Play solo before committing a new spawn assignment. FTB already creates personal teams, so solo does not need a parallel team-less identity. Existing party members should resume normally instead of seeing onboarding on every login.

The inspected Teams 2101.1.12 implementation has `free_to_join`, default false. Public parties can allow immediate joining; private parties require an invitation. Password-protected entry and a hidden/private directory are not established native features. A custom chooser should list public teams and the player's invitations, derive eligibility on the server, enforce native membership/capacity permissions and avoid treating an internal `join` call as authorization. Invite-only membership is not block protection.

Solo placement is unresolved. Two useful choices are a reserved personal cluster ("My own start") and a secondary island in a cluster explicitly open to other independent arrivals ("Shared start"). A shared start need not share quest progress or make neighbors party members. Do not assign random solo arrivals to a party's reserved cluster without its consent. One shared starting cluster is a simpler first design than multiple random shared clusters, but neither scope is approved yet.

Either choice should persist across reconnects and deaths rather than rerolling. Reservations and shared landing slots need one allocator so simultaneous arrivals cannot collide. First login needs a protected pending-arrival state while selection and generated landing validation finish; closing the screen or disconnecting must not expose an unsafe player or create repeated reservations.

Starting-cluster distribution is a separate open policy from membership. One fixed starting region is insufficient for hundreds of players. A proposed scalable allocator would open additional starting regions as suitable local capacity runs low. Each region could contain reserved team/personal clusters and capacity-limited shared clusters. "Near others" would choose a region with available neighboring starts; "Remote" would require more separation. Joining an existing team retains its established home.

Use persistent cluster reservations and shared landing-slot ownership, with deterministic candidate search and clearance measured from actual cluster bounds. A spiral can enumerate candidates without becoming the allocation order. Open another region rather than reducing separation when one fills. Review early-game travel distances, region capacity, empty-region reuse and allocation fairness before choosing numeric defaults. Shared and reserved starts must obey the same suitability checks.

This is a UX proposal, not a feature of the current release. Directory visibility, arrival presentation, solo choices and shared-start capacity need review before implementation.

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
These semantics need native verification on the selected release, including
offline members and manual/automatic reward claims; they are not our own migration.

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
successful flight. Start the trial with a small playable slice before converting
the current 75 entries or investing in another custom journal UI.

Keep one authored content owner. Extend the existing generation/localization
pipeline for FTB's SNBT, stable IDs and native locale files; update Atlas authoring
and validation together. Do not independently maintain GUI-edited output and
generated definitions. Retain useful existing advancement triggers. Questlog UI
adapters can remain optional/absent-target-safe until the trial is accepted.

Skyweave island-combination discoveries need an authoritative adapter or server
advancement: validate the player's actual location and winning terrain owner
against the saved generation profile. Running a locator or approaching a planned
center is not a discovery. Avoid cold hydrology work on every player tick.

## Dimension access policy

Use a Compat access policy plus `allow-nether=false` in dedicated-server defaults. Keep the registered Nether dimension for compatibility; literal removal is not selected. The template is updated, but portal creation, existing portals, integrated servers and non-portal travel still require the new adaptation. No live server setting was changed.

The policy must prevent portal ignition without disabling ordinary fire, flint-and-steel or fire charges. Review ruined-portal templates and placement processors for active portal states or automatic activation; keep recognizable ruins, salvage and useful general-purpose loot unless a specific reviewed change is needed. Preserve a narrow optional future response to a denied ignition attempt without implementing prison entry, graphics or sound now.

Source inspection confirms `PortalSpawnEvent` covers ordinary fire-triggered creation and `EntityTravelToDimensionEvent` covers native `changeDimension`. Direct `teleportTo` paths bypass the latter; an event-only guard is not complete access closure. Reject old-portal destination work before it creates an exit, and handle saved login/respawn destinations deliberately. Retain operator recovery and foreign-dimension behavior as explicit policy, not accidental bypasses.

The [prison content design](prison.md) owns the separate dimension, travel/exit model and presentation. Essential resource routes must be reviewed before claiming the no-Nether pack is survival-complete.

## Mapper findings and progression consequences

The mapper already combines recipes, terrain gathering, mob drops, chest loot,
trades and interactions. Current acquisition is not yet an authoritative model
of enabled dimensions, generator placement and travel.

Observed implementation gaps:

- `web/src/lib/acquisition.mjs` infers some dimension gates from resource names.
  Registered biomes or loot tables do not establish that they generate in an
  enabled dimension. A sampled world block may also be a structure/player block.
- `web/data/authored/acquisition.yml` currently grants `atlas:nether` from
  obsidian and flint-and-steel without consulting an access policy.
- `web/src/lib/progression.mjs` ranks planned routes lexicographically by
  opportunity count, unknown outcomes, random outcomes, then depth. Earliest mode
  ranks depth. Neither measures biome travel, mining effort, density or quantity.
- The inspected item UI selects the solved witness when available, with a first
  method fallback. A future default-policy change must reach both item methods
  and the overall progression graph, not just list sorting.

The inspected compiled snapshot does select gathering for oak logs, sand,
andesite, gravel and raw iron. Stone selects smelting, correctly avoiding a
Silk Touch requirement for collecting stone itself. This does not dismiss earlier
missed routes; common-material regression examples and source/ranking/UI checks
are needed before changing defaults globally.

A read-only no-Nether counterfactual removes routes producing `atlas:nether`
and reruns the existing planned solver. It loses traced access for 1,607 of
10,116 catalog nodes. Quartz, electron tubes, mechanical crafters and crushing
wheels become circular/unresolved; blaze materials, Eyes of Ender, wart and
netherite also lose their current traced routes. This is a diagnostic, not a
complete gameplay classification. Ruined-portal netherrack is an example of an
Overworld source the simplified counterfactual can miss.

The migration needs explicit dimension availability, source provenance and
alternative acquisition paths, with available/blocked/unknown distinctions and
transitive downstream effects. Retain blocked recipes for inspection; show the
reason and viable alternatives. Do not hide every Nether-themed item or treat
an unknown route as impossible. Native declarations, authored knowledge and
saved-world observations need separate evidence labels.

Before closing access in a playable pack, review a low-tier quartz bootstrap,
Blaze Burner/Propulsion heat alternatives, brewing, End access, netherite and
Nether decorations. Decide which branches receive Overworld alternatives and
which are deliberately unavailable. No replacement recipes were approved here.

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

Local source/artifact metadata and the explicitly limited no-Nether counterfactual are retained under `.git/captures/team-world-progress/`. They are not native UI, team lifecycle or survival verification. Personal instances and worlds remain outside these preparation changes.
