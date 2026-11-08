# Create: Skyweave documentation

Player guides explain installation and operation. Development documents describe
pack authoring, compatibility constraints and verification. Historical decisions
record what was tested at the time; they do not define current defaults.

## Players and server owners

| Guide | Contents |
| --- | --- |
| [Getting started](players/getting-started.md) | Installation, world creation and updates |
| [Journal](players/journal.md) | Local quest conditions and controls |
| [Graphics](players/graphics.md) | DH rendering, shader choices and missing LODs |
| [Servers](players/server.md) | Hosting, world preservation and DH generation |
| [Included content](MODLIST.md) | Exact mods, resource packs and shaders in current source |
| [Release notes](RELEASE_NOTES.md) | Current release notes and links to earlier versions |

## Development and maintenance

| Guide | Contents |
| --- | --- |
| [Build and release](development/build.md) | Source layout, empack commands and CI |
| [Dependency and patch maintenance](development/patches.md) | Coupled updates, patch ownership, checks and removal criteria |
| [Compatibility and verification](development/compatibility.md) | Dependency constraints, shader evidence and test scope |
| [Journal design and definitions](development/journal.md) | Capabilities, reward budgets, conditions and update checks |
| [Pack authoring](development/authoring.md) | Journal generation, locale editing and categorized configuration audit |
| [Debug World](development/debug-world.md) | Generated districts, native placement checks and safe fixture installation |
| [Web map and authoring](development/web/README.md) | App setup, editor controls, data pipeline and verification |
| [Journal integrations](development/journal-integrations.md) | EMI/JEI, translation and Ponder findings |
| [World generation](development/worldgen.md) | Spacing policy and biome compatibility |
| [Terrain and structure candidates](development/worldgen-candidates.md) | Selected projects, exclusions and integration review |
| [Performance investigation](development/performance.md) | Bounded startup, teardown, GC, terrain and server-work profiling |
| [Structures](development/structures.md) | Sky Villages placement, loot and delivery integration |
| [Building weights](development/weights.md) | Classification policy, multipart decisions and native verification |
| [Progression review](development/progression.md) | Routes, overlaps and remaining play checks |
| [Upstream findings](development/upstream.md) | Known reports and candidates for submission |
| [Decision history](development/decisions.md) | Accepted pack policies and supporting evidence |

## Source and releases

Current defaults live in `overrides/` and `templates/`. Building source does not
update a downloaded release or an installed instance. Archived release notes
describe their named version; the unreleased notes describe the working tree.

[Archived release notes](releases/) retain version-specific changes and verification. The [changelog](../CHANGELOG.md) records repository history.
