# Development documentation

This index groups the maintained technical guides by responsibility. Player and server instructions remain in the [documentation home](../README.md); implementation details, audit coverage, proposals, and verification limits belong here. Exact dependency pins remain in `empack.yml` and `empack.lock`.

For content additions, start with [new-content triage](content-triage.md), then follow the relevant domain owner. The [animation and model guide](animation-compatibility.md#audit-coverage-and-status) owns the animation audit and its gaps; resource declarations, native matching, and visually correct fallbacks are separate findings.

Use its [item action families](animation-compatibility.md#item-action-families) to inspect captured item classes and inherited method owners, then follow the scoped native reviews. Class grouping does not qualify untested items or variants.

The [registered client extensions and availability](animation-compatibility.md#registered-client-extensions-and-availability) distinguish global pose/render registrations and disabled items from missing animation support.

## Build, inputs, and compatibility

| Guide | Responsibility |
| --- | --- |
| [Build and release](build.md) | Source layout, empack commands and CI |
| [Dependency and patch maintenance](patches.md) | Coupled updates, patch ownership, checks and removal criteria |
| [New-content triage](content-triage.md) | Review mod/resource additions and changes across rendering, animation, inputs, recipes, and moving machinery |
| [Compatibility constraints](compatibility.md) | Dependency interactions and supported boundaries |
| [Animation and model compatibility](animation-compatibility.md) | Renderer ownership, item fitting and native comparison requirements |
| [Input ownership and controls](keybinds.md) | Binding inventory, contextual interactions, overlap findings, keyboard layouts, and proposed defaults |
| [Client messages and onboarding](client-messages.md) | Welcome/update/support prompts, dismissal ownership, useful warnings, and proposed defaults |
| [Complete control remap](input-remap.md) | Pre-Compat defaults, filming controls, and registered/custom dispositions |
| [Pack verification](verification.md) | Artifact checks, evidence ownership and coverage limits |
| [Pack authoring](authoring.md) | Journal generation, locale editing and categorized configuration audit |

## Gameplay and progression

| Guide | Responsibility |
| --- | --- |
| [Journal design and definitions](journal.md) | Capabilities, reward budgets, conditions and update checks |
| [Journal integrations](journal-integrations.md) | EMI/JEI, translation and Ponder findings |
| [Teams and world progress](team-world-progress.md) | Initial spawn, deferred team/home policy, FTB Quests trial and dimension access |
| [Prison dimension](prison.md) | Planned protected liminal dimension and island-linked travel |
| [Progression review](progression.md) | Routes, overlaps and remaining play checks |
| [Culinary integration](culinary.md) | Flour/dough interoperability, milling decisions, trays, drink policy, and runtime repair boundaries |
| [Equipment evaluation](equipment.md) | Equipment families, Artifacts effects/acquisition and renderer decisions |

## Worlds, structures, and building

| Guide | Responsibility |
| --- | --- |
| [Debug World](debug-world.md) | Generated districts, native placement checks and safe fixture installation |
| [World generation](worldgen.md) | Spacing policy and biome compatibility |
| [Island generation reference](island-generation.md) | Biome eligibility, archetypes, descriptor combinations and shaping/placement controls |
| [Terrain and structure candidates](worldgen-candidates.md) | Selected projects, exclusions and integration review |
| [Building authoring](building-authoring.md) | Isolated Mighty workshop, deterministic templates, owner review, and inactive village admission |
| [Structures](structures.md) | Sky Villages placement, loot and delivery integration |
| [Encounters and settlement population](encounters.md) | Illager, guard and biome-variant settings, spawn paths and integration limits |
| [Building weights](weights.md) | Classification policy, multipart decisions and native verification |

## Rendering, filming, and runtime

| Guide | Responsibility |
| --- | --- |
| [Replay Studio](../../tools/replay-studio/README.md) | Separate empack filming snapshot, optimizer exclusions, and replay/world ownership |
| [Performance investigation](performance.md) | Bounded startup, teardown, GC, terrain and server-work profiling |
| [World runtime](world-runtime.md) | Coupled workstreams, ownership and candidate adoption |
| [Longshot interactions](longshot-interactions.md) | Extended-range review, distant terrain authority, loading policy, and qualification boundaries |

## Authoring application and retained decisions

| Guide | Responsibility |
| --- | --- |
| [Web map and authoring](web/README.md) | App setup, editor controls, data pipeline and verification |
| [Upstream findings](upstream.md) | Known reports and candidates for submission |
| [Decision history](decisions.md) | Accepted pack policies and supporting evidence |
