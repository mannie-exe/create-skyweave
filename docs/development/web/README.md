# Web map and authoring

| Task                                                             | Document                                                             |
| ---------------------------------------------------------------- | -------------------------------------------------------------------- |
| Compare resource-pack candidates and source galleries            | [Resource-pack review](usage.md#resource-packs)                      |
| Browse the item grid, progression graph and evidence             | [Map guide](usage.md)                                                |
| Install tools, capture data or run checks                        | [Setup](setup.md)                                                    |
| Understand sources, textures, schemas and editing boundaries     | [Data pipeline](data.md)                                             |
| Understand visual roles, token adoption and composition          | [Design tokens](design-tokens.md)                                    |
| Check tested behavior and remaining limitations                  | [Verification](verification.md)                                      |
| Create journal entries, localize text and inspect configuration  | [Pack authoring](authoring.md)                                       |
| Check static previews and deferred animation/state/audio support | [Preview coverage](models.md#preview-coverage-and-deferred-features) |
| Author models and review modified textures                       | [Resource authoring](models.md)                                      |

Setup owns commands and prerequisites. The data reference owns source authority
and implementation behavior. Verification records dated checks and their limits.
The map guide describes the interface. Keep proposals in the relevant authored
YAML domain with their evidence and status; do not treat a potential route or
scenario as an installed gameplay change.

The app lives in [`web/`](../../../web/README.md) within the pack repository.
[Pack authoring](../authoring.md) owns journal schemas and generation;
[build and release](../build.md) owns packaging and instance operations.
