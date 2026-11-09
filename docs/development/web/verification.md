# Verification

Checks apply to the recorded source or artifact, not every later checkout. Browser
checks establish interface behavior; native game checks and survey evidence have
separate owners and limits. Commands and prerequisites live in [setup](setup.md).

## Pack 0.11.0 released-lock refresh

The fresh workspace `snapshot.refresh` loads published Compat 0.30.0 with SHA-256
`fbc64f79844e86824d87c2b77af608ff3cb73edf872afd97a272236b93e9c79c`,
Minecraft 1.21.1 and NeoForge 21.1.265. Its recorded lock hash matches the selected
pack and inputs remain unchanged during capture. `pnpm data:check` passes native
FTB definition/codec/filter checks for all 74 quests, effective Nether closure,
normal-material witnesses and Overworld soul-sand acquisition. It reports
10,136 items, 9,547 blocks, 9,254 recipes, 188 entities and 8,882 mapped nodes;
blocked/unclassified coverage remains explicit. These are potential routes, not
a survival budget or proof that every structure actually generated.

Final targeted browser checks pass 11 authoring, availability and coverage cases.
The new provenance regression first failed, then passed after output-specific
merges stopped mutating shared template contexts. Native-source domains measure
about 56 MiB; map admission, JSON validation and static delivery share an explicit
64 MiB budget while ordinary transport and resource-preview limits stay bounded.
Regression cases cover accepted wide data, over-limit rejection, nonfinite/cyclic
values and preserved limits for other public namespaces. A failed refresh keeps
the active snapshot. One full-suite watch fixture stalled during concurrent work;
its isolated seven cases and a subsequent full run passed. That interruption is
not counted as a successful run.

Native gameplay/party/claim and client interaction evidence remains owned by
Compat's verification guide. Existing world/island/structure surveys retain their
original dates. Private preparation captures are not substituted for this exact
released-lock refresh.

## FTB authoring checks

`pnpm verify` covers formatting, unused-code analysis, application tests, Astro
checks and static generation. `pnpm test:python` covers capture staging, including
replacing the authored FTB book without deleting unrelated FTB configuration.
Targeted browser checks cover coordinated chapter/quest CRUD, stable IDs during
moves, task/reward controls, sparse translations, shared paragraphs, external
changes, invalid field drafts, layout dragging and narrow-width overflow. Activity
and shared-control checks exercise the surrounding pages too. The source service
rejects native edits and compiler changes during generation before publication.

The isolated FTB exporter reads loaded native objects and checks their SNBT
write/read round trip. `quests.json` reports that evidence explicitly; it does not
claim task execution, team claims or reward overflow. Native behavior fixtures own
those checks separately. Verify the final released-lock capture after updating the
Compat pin; a successful private candidate capture is not the published snapshot.

## Environment and default-route checks

Availability regressions cover preset/biome bindings, disabled structure families,
Overworld salvage, closed-dimension prerequisites, unknown survey origins and
cyclic acquisition. Native codec cases include singleton feature lists and the
same ID in placed/configured registries. Output providers exclude predicates and
zero-weight alternatives. Loot modifiers inherit the access policy of their
actual source table.

Browser checks compare the map and open-item policies, retain explicit selections,
show blocked/unclassified reasons and check narrow layouts. Snapshot tests reject
server-template changes during capture. The compiler also requires the template
digest captured by the exporter. `pnpm data:check` verifies the released-lock
environment, supported material witnesses, Overworld soul-sand salvage and closed
Nether routes; a private preview does not replace that check.

Native environment declarations establish potential sources, not generated
quantities or a verified survival playthrough. Bounded template decode failures
remain recorded as coverage limits. Keep implementation checks distinct from
placed-structure, harvest and gameplay evidence.

## Pack 0.10.0 quest/team trial refresh

A fresh isolated runtime capture loads the locked FTB trio alongside Questlog and
published Compat 0.29.1. Its source fingerprint remains unchanged. Extraction
uses that capture's own `--work` directory, including its diagnostics and generated
configuration; it must not read a previous audit's log or defaults. The snapshot
checks pass with 10,136 items, 9,547 blocks, 9,254 recipes and 188 entities.
Extraction finds 34,270 resource paths and 10,070 texture previews across 494 JARs.

Formatting, unused-code checks, 158 application tests, 37 Python tests (one existing
skip), Astro checks and the 16-page static build pass. Static generation correctly
rejects input changes during a build; the final build runs after capture and
compilation finish. Existing world surveys retain their original dates. Neither
this export nor the empty FTB book establishes native team/quest gameplay.

## Evidence ownership

| File                                          | Authority                                                                         |
| --------------------------------------------- | --------------------------------------------------------------------------------- |
| `data/generated/runtime/snapshot.json`        | Loaded JAR hashes, lock hash and input fingerprint                                |
| `data/generated/runtime/quests.json`          | Native FTB definitions and SNBT round trips                                       |
| `data/generated/runtime/environment.json`     | Effective preset, biome, feature, pool and template declarations; access defaults |
| `data/generated/runtime/patch_checks.json`    | Actual corrected block-drop rolls                                                 |
| `data/generated/runtime/heat_checks.json`     | Native heat behavior                                                              |
| `data/generated/runtime/worldgen_review.json` | Read-only native layout comparison, when captured                                 |
| `data/generated/diagnostics.json`             | Remaining runtime diagnostics                                                     |
| `data/generated/world.json`                   | Dated stored-region census and block sample                                       |
| `data/generated/structures.json`              | Controlled/natural village survey and provenance                                  |
| `data/research/resourcepacks/`                | Catalog, exact archive inspections and source-gallery metadata                    |
| `public/generated/resource-review/`           | Selected local screenshots; ignored by Git                                        |

Keep compact evidence while a current claim depends on it. Completed migration,
bootstrap and selective-sync receipts do not define current configuration. Do not
copy their history into operating guides or treat old pass counts as current tests.

## Limits

Mapped acquisition is potential access, not a budget for quantities, chance, XP,
stress/RPM, fuel, safe combat or travel. Trade samples are not exhaustive. Arbitrary
Java interactions and equipment drops still need targeted adapters. Saved-world
surveys are dated samples, not pregen-completion receipts. Structures/builds can
contribute blocks, unfinished chunks can depress estimates, and sampled zero is
not absence.

The audit server does not import playing-world datapacks or gamerules. Check those
separately when evaluating a world-specific change. Optional loot-table and Sable missing-block warnings remain tracked in
[upstream findings](../upstream.md). Automatic Hostile Skies raids remain disabled;
its captain-order route is not enabled merely because the graph can describe it.

## Historical evidence

Completed runs are retained in the published 0.10.0 tree below. Their source,
artifact and fixture dates remain authoritative for those observations; they do
not establish current defaults, current test counts or a new world's contents.
The [Debug World guide](../debug-world.md) owns the current generator and checks,
and [preview coverage](models.md#preview-coverage-and-deferred-features) owns what
the browser can display. Retain compact captures while an active claim needs them.

<a id="pack-090-terrain-and-configuration-refresh"></a>

- [Pack 0.9.0 terrain and configuration refresh](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#pack-090-terrain-and-configuration-refresh)

<a id="pack-071-terrain-and-structure-refresh"></a>

- [Pack 0.7.1 terrain and structure refresh](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#pack-071-terrain-and-structure-refresh)

<a id="pack-060-data-refresh"></a>

- [Pack 0.6.0 data refresh](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#pack-060-data-refresh)

<a id="release-030-checks"></a>

- [Release 0.3.0 checks](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#release-030-checks)

<a id="release-023-checks"></a>

- [Release 0.2.3 checks](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#release-023-checks)

<a id="dependency-refresh-2026-11-05"></a>

- [Dependency refresh, 2026-11-05](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#dependency-refresh-2026-11-05)

<a id="workspace-and-resource-preview-checks-2026-11-04"></a>

- [Workspace and resource-preview checks, 2026-11-04](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#workspace-and-resource-preview-checks-2026-11-04)

<a id="debug-world"></a>

- [Debug World](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#debug-world)

<a id="release-checks-0134"></a>

- [Release checks, 0.1.34](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#release-checks-0134)

<a id="hanging-stair-lanterns-2026-11-03"></a>

- [Hanging stair lanterns, 2026-11-03](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#hanging-stair-lanterns-2026-11-03)

<a id="lootr-barrel-item-transforms-2026-11-03"></a>

- [Lootr barrel item transforms, 2026-11-03](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#lootr-barrel-item-transforms-2026-11-03)

<a id="glass-backfaces-2026-11-03"></a>

- [Glass backfaces, 2026-11-03](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#glass-backfaces-2026-11-03)

<a id="release-checks-0133"></a>

- [Release checks, 0.1.33](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#release-checks-0133)

<a id="release-checks-2026-11-03"></a>

- [Release checks, 2026-11-03](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#release-checks-2026-11-03)

<a id="glass-culling-adapters-2026-11-03"></a>

- [Glass culling adapters, 2026-11-03](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#glass-culling-adapters-2026-11-03)

<a id="conditional-window-faces-2026-11-03"></a>

- [Conditional window faces, 2026-11-03](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#conditional-window-faces-2026-11-03)

<a id="hanging-bridge-lanterns-2026-11-03"></a>

- [Hanging bridge lanterns, 2026-11-03](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#hanging-bridge-lanterns-2026-11-03)

<a id="resource-rendering-repairs-2026-11-02"></a>

- [Resource rendering repairs, 2026-11-02](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#resource-rendering-repairs-2026-11-02)

<a id="workspace-service-2026-11-02"></a>

- [Workspace service, 2026-11-02](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#workspace-service-2026-11-02)

<a id="selected-resources-and-fixture-2026-11-02"></a>

- [Selected resources and fixture, 2026-11-02](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#selected-resources-and-fixture-2026-11-02)

<a id="object-workbench-2026-11-02"></a>

- [Object workbench, 2026-11-02](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#object-workbench-2026-11-02)

<a id="lootr-shipping-resources-and-authoring-preview-2026-11-02"></a>

- [Lootr shipping resources and authoring preview, 2026-11-02](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#lootr-shipping-resources-and-authoring-preview-2026-11-02)

<a id="resource-comparison-page-2026-11-01"></a>

- [Resource comparison page, 2026-11-01](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#resource-comparison-page-2026-11-01)

<a id="selective-resource-comparisons-2026-11-01"></a>

- [Selective resource comparisons, 2026-11-01](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#selective-resource-comparisons-2026-11-01)

<a id="materialized-pack-inputs-2026-10-31"></a>

- [Materialized pack inputs, 2026-10-31](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#materialized-pack-inputs-2026-10-31)

<a id="journal-presentation-facts-2026-10-31"></a>

- [Journal presentation facts, 2026-10-31](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#journal-presentation-facts-2026-10-31)

<a id="journal-redesign-2026-10-30"></a>

- [Journal redesign, 2026-10-30](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#journal-redesign-2026-10-30)

<a id="commit-readiness-2026-10-29"></a>

- [Commit readiness, 2026-10-29](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#commit-readiness-2026-10-29)

<a id="compat-061-content-refresh-2026-10-29"></a>

- [Compat 0.6.1 content refresh, 2026-10-29](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#compat-061-content-refresh-2026-10-29)

<a id="authoring-activity-2026-10-29"></a>

- [Authoring activity, 2026-10-29](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#authoring-activity-2026-10-29)

<a id="minecraft-locale-picker-2026-10-29"></a>

- [Minecraft locale picker, 2026-10-29](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#minecraft-locale-picker-2026-10-29)

<a id="local-application-checks-2026-10-29"></a>

- [Local application checks, 2026-10-29](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#local-application-checks-2026-10-29)

<a id="retained-game-evidence"></a>

- [Retained game evidence](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#retained-game-evidence)

<a id="category-fixture-checks"></a>

- [Category fixture checks](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#category-fixture-checks)

<a id="research-coverage"></a>

- [Research coverage](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#research-coverage)

<a id="model-workbench-checks-2026-10-24"></a>

- [Model workbench checks, 2026-10-24](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#model-workbench-checks-2026-10-24)

<a id="native-model-checks-2026-10-24"></a>

- [Native model checks, 2026-10-24](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#native-model-checks-2026-10-24)

<a id="visual-compatibility-pass-2026-10-24"></a>

- [Visual compatibility pass, 2026-10-24](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#visual-compatibility-pass-2026-10-24)

<a id="candidate-generation-survey-integration"></a>

- [Candidate generation survey integration](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#candidate-generation-survey-integration)

<a id="island-thickness-and-clearance-evidence"></a>

- [Island thickness and clearance evidence](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#island-thickness-and-clearance-evidence)

<a id="saved-world-refresh-2026-10-26"></a>

- [Saved-world refresh, 2026-10-26](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#saved-world-refresh-2026-10-26)

<a id="transmission--linkage-content-refresh-2026-11-01"></a>

- [Transmission & Linkage content refresh, 2026-11-01](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#transmission--linkage-content-refresh-2026-11-01)

<a id="audio-and-recovery-content-refresh-2026-11-01"></a>

- [Audio and recovery content refresh, 2026-11-01](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#audio-and-recovery-content-refresh-2026-11-01)

<a id="configuration-release-refresh-2026-11-01"></a>

- [Configuration release refresh, 2026-11-01](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#configuration-release-refresh-2026-11-01)

<a id="redstone-content-refresh-2026-11-01"></a>

- [Redstone content refresh, 2026-11-01](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#redstone-content-refresh-2026-11-01)

<a id="dependency-and-interface-checks-2026-11-02"></a>

- [Dependency and interface checks, 2026-11-02](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#dependency-and-interface-checks-2026-11-02)

<a id="semantic-ui-consistency-2026-11-02"></a>

- [Semantic UI consistency, 2026-11-02](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/web/verification.md#semantic-ui-consistency-2026-11-02)
