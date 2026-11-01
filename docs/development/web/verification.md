# Verification

Checks apply to the recorded source or artifact, not every later checkout. Browser
checks establish interface behavior; native game checks and survey evidence have
separate owners and limits. Commands and prerequisites live in [setup](setup.md).

## Materialized pack inputs, 2026-10-31

The 0.1.25 capture used all 104 selected server-side pack JARs plus the exporter,
including published Compat 0.10.2, Absolute Kinematics 1.0.1, Questlog 3.5.3,
Radars 5.0.3 and JEI 19.70.0.468. The native server
exported 72 journal entries and 9,221 recipes with zero exporter errors, then shut
down normally. All native objective, fixed-reward and repeated-claim checks passed.
The snapshot records `modSource: pack`, the lock hash and
`sourceChangedDuringExport: false`; extraction and compilation completed with
10,088 items. `pnpm data:check` and `pnpm verify` passed (79 tests, Astro checks and
eight page builds). The existing bundle-size warning remains. The saved-world and
ore survey was retained: this update changes machinery and guidance, not generation.

The client-only Colorwheel Patcher 1.0.5 and Photon 1.4 additions were followed by
`pnpm data:refresh` and `pnpm data:check`. All 104 server-side mod inputs and the
runtime stayed identical; the final export fingerprint was stable. Atlas notes
separate the native BSL check from Photon's source-reviewed preset. Shader evidence
and GPU limits live in the [compatibility guide](../compatibility.md#shader-patching).

## Journal presentation facts, 2026-10-31

For Create Sky 0.1.22, the source configuration and resource-pack notes reflect
64 entries, nineteen rewarded entries, native Questlog artwork and Compat 0.7.0.
`python3 scripts/extract.py` and `pnpm data:compile` refreshed the existing asset /
configuration projection: 10,125 items, 9,253 recipes and 648 unresolved routes.
No world scan or runtime recipe recapture was needed for this presentation change.
`pnpm verify` passes 76 tests, Astro checks and eight page builds. Game-interface
checks belong to the [Compat verification](https://github.com/mannie-exe/create-sky-compat/blob/v0.7.0/docs/development/verification.md#release-070).

## Journal redesign, 2026-10-30

Tested the 0.1.21 worktree against `c8889a2`, with unchanged Minecraft 1.21.1,
NeoForge 21.1.264 and Questlog 3.5.0. The isolated runtime capture completed at
`2026-10-31T00:20:20.352377Z` (UTC). It decoded 64 entries and exercised 118
objective leaves, including absent/present advancement state, native reward
collection packets, all 20 fixed stacks, repeated claims, NBT completion/claim
restoration and one full-inventory overflow case. These are handler checks;
they do not demonstrate each machine operation or a survival playthrough.

- `python3 -m unittest discover -s tests -q`: 30 passed, including policy ownership,
  accepted mechanics, sparse locales and coordinated generation.
- `pnpm verify`: 76 tests, Astro checks and all eight pages passed; the existing
  large-bundle warning remains. `pnpm test:python`: 24 passed.
- `pnpm data:runtime`, `pnpm data:extract`, `pnpm data:compile` and
  `pnpm data:check` passed: 10,125 items, 9,253 recipes, 64 journal entries and
  648 unresolved crafting routes. Portable-engine dyeing adds fifteen reviewed
  representative routes; it does not enumerate every color-to-color permutation.
- Both resource builders passed `--check`; the configuration audit reported
  243 files without drift. All three reference distributions built and passed ZIP
  integrity checks, with 73 journal definitions. Prism and server recipes mark all
  of those definitions managed; the server terminal patch passed.

An isolated Prism client displayed 7/8 food as incomplete, completion at eight,
manual collection of two bread, and the collected state. The final managed-file
candidate displayed the Field supplies chapter, flight chapter, short advancement
labels and scrollable descriptions without localization keys. The upgrade test
caught obsolete seeded definitions; reviewed replacements and retirement restored
one current definition set. No personal instance was used for these checks.

The Prism release recipe tested was
`adb15308546c4f39bae3e42243e177303ff82c84e3da2bbef83601491b320b93`.
Language fallback is covered by generator checks; a non-English client was not
visually tested. Two disposable-client exits stalled during disconnect, with the
render thread in Sodium framebuffer blitting while the integrated server still
ran. They were terminated after collecting evidence. This is an unresolved exit
limitation, not a verified journal regression or a clean-exit result. No graphics
or runtime dependencies changed in this pass. Personal worlds and the existing
Atlas world/ore survey were not regenerated.

## Commit readiness, 2026-10-29

Reviewed the combined Atlas, journal tooling and exporter worktree against
`0110606`. No additional gameplay or dependency changes are pending. Web CI now
also runs for its shared authoring scripts, source documents, pack manifest/lock
and default resource selection inputs.

- `pnpm verify` passed 76 unit tests, Astro checking and the eight-page build.
  It also passed in a temporary source-only copy without generated game data,
  extracted assets or local configuration.
- `PLAYWRIGHT_CHANNEL=chrome pnpm test:browser` passed all 66 checks. Graph checks
  logged ResizeObserver loop notifications; the development toolbar logged an
  audit fetch error. Assertions passed; these development diagnostics remain.
- `pnpm test:python` passed 21 tests; pack `unittest discover -s tests -v` passed
  29 tests. Both resource builders passed `--check`; the configuration audit found
  no changed, missing or unregistered files among 242 entries.
- A new isolated `pnpm data:refresh` completed at `2026-10-29T09:20:27.902965Z`
  with zero exporter errors and no fatal shutdown diagnostics. Extraction,
  compilation and `pnpm data:check` passed. Snapshot SHA-256:
  `bc90f0ac4ac53ed431463c530db8c150cae072d40daeea9c24f6ee1d4f392cf8`.

Tested source fingerprint (sorted JSON mapping `web/`-relative files under `src`,
`scripts`, `tests` and `tools` to SHA-256, excluding Python bytecode):
`1434946e59a801242470a5b424de036efd52dbb1b652362b5cd0de833376af7e`.
Disposable exporter worlds, crash reports and test logs were removed after review;
generated Atlas data, runtime-default configuration and review media were retained.
No commit, publication, instance sync or playing-world change was made.

## Compat 0.6.1 content refresh, 2026-10-29

Tested pack `533dfd8` (0.1.20), Compat `c46db2a` (0.6.1), and the local Atlas
worktree. The config extractor now reads Compat's canonical startup properties
as strict boolean feature values. Both authored and runtime-default projections
contain all 25 switches. Adapter-gated built-in resources remain runtime evidence;
Atlas does not simulate renderer behavior, construct weights, or disabled hooks.
The shared UI/components review required no additional interface changes.

After updating the stopped local server from the checksum-verified release,
`pnpm data:refresh` completed at `2026-10-29T12:05:48.090712Z` with zero exporter
errors and normal shutdown. The disposable audit server never mounted the playing
world. Its loaded Compat SHA-256 is
`fc8aa5c9f4e82dd7daa0e26c0c54e4e9c844881f1ec623348b1bd71a0636370c`.
Runtime snapshot SHA-256:
`7b61d41549de26aa53e167a9b3fbfc10ce63b4a3a056de27121f9d0184f55f5f`.
The source fingerprint stayed unchanged during capture; the lock matches 0.1.20.

- `pnpm data:check` passed: 10,125 items, 9,545 blocks, 9,253 recipes and 48
  journal entries. There are 663 unresolved crafting routes; these are recorded
  coverage limits, not newly proven gameplay failures.
- `pnpm test:python` passed all 24 tests, including strict feature parsing.
- `pnpm verify` passed formatting, 76 unit tests, Astro checking and the eight-page
  build; the existing bundle-size advisory remains.

No browser interaction changed, so browser tests were not repeated. Saved-world,
island and structure surveys were retained without rescanning. The pack's native
rendering evidence and unresolved shadow report live in
[compatibility](../compatibility.md); an Atlas refresh does not establish rendering.
Disposable exporter world/logs were removed after review; generated data and
runtime-default config were retained.

The final worktree review against `533dfd8` repeated `pnpm verify`,
`pnpm test:python` and `pnpm data:check` successfully. Installed JAR hashes still
match the capture, and both feature-file projections match the authored file.
The broader input fingerprint has changed since capture; its stale indication
is retained rather than treating these focused checks as a new runtime export.
Web CI includes the feature file because the parser tests read it directly.

## Authoring activity, 2026-10-29

The wrap-up scopes the output status to Questlog in journal views and journal
source editing. Config audit and configuration-register editing no longer display
that unrelated comparison. On `59ed4fe` plus the worktree, `pnpm verify` passed
(76 unit checks, Astro checking and production build). After correcting the browser
test's select locator, `PLAYWRIGHT_CHANNEL=chrome pnpm test:browser tests/authoring.browser.mjs`
passed all six checks, including switching between these scopes. The final
`src`/`scripts`/`tests` fingerprint using the method below is
`1fbdc4b33f3aee35b5f78e6ade8689b9eac813984a4a275986dcce64ebbbb476`.
Python and the full browser suite were not repeated for this UI-only correction.

The workspace records complete actions independently of their subprocesses.
Journal saves retain acknowledged revisions when the follow-up read fails.
The approved Activity panel is adopted at `/authoring`, alongside the editor on
wide screens and below it on narrow screens. Other pages retain the compact
Activity disclosure. Both presentations share one host for polling and notices;
the A/B simulation and its unused transport/state options have been removed.

Snapshot: `c01417e` plus the local worktree. SHA-256 of sorted JSON mapping files
under `src`, `scripts` and `tests`, relative to `web/`, to SHA-256 hashes:
`fe970c7ed7322327664608f2e36336056e41ce8e48616c3274415ce94727f336`.

- Final `pnpm verify` passed: formatting, 76 unit checks, Astro checking of 88
  files without errors/warnings/hints, and the eight-page production build.
- `PLAYWRIGHT_CHANNEL=chrome pnpm test:browser tests/activity.browser.mjs tests/authoring.browser.mjs tests/ui.browser.mjs`
  passed all 18 checks. After removing the unused preview connection state, the
  four activity browser checks passed again on the recorded snapshot.
- Coverage includes notice lifetime and retention, reconnect behavior, source
  recovery, live panel status/cancellation, literal diagnostics, a single toast
  host, keyboard navigation, legacy preview redirects and responsive placement.
  Writes remain mocked or isolated; no pack files or Minecraft instances were changed.
- Read-only captures of the running authoring page were inspected at 1440 and
  390 pixels. No horizontal overflow or page errors were observed.

Before layout adoption, the shared operation/notification refactor passed the full
66-check browser suite. That run logged a ResizeObserver notification during graph
checks and an Astro dev-toolbar audit fetch error; their assertions passed. The
host mounts client-only to avoid hydration racing an early DOM notification.
The production build retains its large-bundle advisory. No Python code changed,
so Python checks were not repeated. Operation history is process-local, not a
durable audit or restart-recovery system.

## Minecraft locale picker, 2026-10-29

The journal picker uses 143 languages from Minecraft 1.21.1's vanilla metadata.
`pnpm data:locales <Prism-version.json> <assets-directory>` verified the installed
asset index and `pack.mcmeta` hashes and generated the checked-in catalogue.

Snapshot: `8aed6cb` plus the local worktree. SHA-256 of sorted JSON mapping
`src/` paths, relative to `web/`, to file SHA-256 hashes:
`003656b0501c3cde8ac34ba2131b0d0268c0e74c0c04954f11de5306de9acdd3`.

- `pnpm verify` passed: formatting, 73 unit checks, Astro checking of 85 files
  with no errors/warnings/hints, and the eight-page build.
- `PLAYWRIGHT_CHANNEL=chrome pnpm test:browser tests/authoring.browser.mjs tests/ui.browser.mjs`
  passed all 13 checks. These cover locale selection, readable names, duplicate
  exclusion, disabled empty selection, sparse translations, fallback, entry previews
  and existing journal interactions. Writes use mocked authoring endpoints.
- Headless Chrome captures of the running authoring page were inspected at
  1440 and 390 pixels. The narrow page had no horizontal overflow. No translations
  were saved to the real pack, and no Minecraft instance was changed.

The full browser suite and native game language switching were not repeated;
this change selects existing locale identifiers without changing Questlog output.

## Local application checks, 2026-10-29

The release-preparation pass retains the ongoing Atlas work locally. None of its
code, app-only tooling, tests or documentation is included in pack release commits.
The shared header now offers a keyboard skip link to a focusable main landmark on
the item map, journal authoring, model authoring and resource review pages. It uses
existing surface, spacing and focus roles; controls keep their native tab order.

The existing consolidation uses shared fields, source editors, view navigation,
feedback, buttons, disclosures and workbench composition. Reviewed boundaries
remain in [design tokens](design-tokens.md): graph/recipe geometry, renderer colors,
source authority and action availability stay with their owning implementations.

Snapshot: `8aed6cb` plus the local worktree; SHA-256 of sorted JSON mapping
`web/src` paths to file SHA-256 hashes: `7540cafac537580ceda3742190eb3e5439aa941bb5702b50a184035c3b618ed4`.

- `pnpm verify` passed: formatting, 73 unit checks, Astro checking of 84 files
  with no errors/warnings/hints, and the eight-page production build.
- `pnpm test:python` passed all 16 checks.
- `PLAYWRIGHT_CHANNEL=chrome pnpm test:browser` passed all 61 checks. The four
  added keyboard checks cover first focus, visible narrow-screen placement,
  Enter to the main landmark and onward Tab navigation on every primary page.
- Root Python tests passed all 29 checks, including the pack archive check mode.
  Release checkout checks separately establish the committed pack-only scope.

Browser writes used test fixtures or unsaved drafts. No live game instance,
world, runtime export or terrain survey was changed by this app pass. Existing
bundle-size and development diagnostics remain; these checks do not establish
full accessibility certification or Minecraft gameplay. Earlier interface
iteration logs were consolidated; native artifacts and surveys below retain
their historical scope.

## Retained game evidence

| Area                 | Tested scope and limits                                                                                                                                                                                                                                                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Resource fixture     | 2026-10-23, shader off, fixed camera/time/weather; Minecraft 1.21.1, NeoForge 21.1.264, EMF 3.3.12, ETF 7.2.6 and Fusion 1.3.16. Pots, sampled lantern/chain models, chest/Lootr states and glass were inspected. Moving ships, Copycats, shader-on rendering and broad animation behavior remain untested.                                                               |
| Visual model patch   | Four plant/pot composites and two chain overrides passed individual prototype checks. The combined generated ZIP has SHA-256 `9f485b0244be4903203acece5d18361faa53df58af748b50ee7f207bc8e6a35a`; exact inputs and texture references pass static checks. The combined ZIP was subsequently loaded in the retained review world; broader motion coverage is still limited. |
| Local installations  | Barrel Roll removal rebuilt all three exports. Client snapshot `4bc70d4a4e5eac8303e293566c44584fa004c5a0dd0868e17a1a9889d30a6e04` and server snapshot `df13d495f94d2d668af5749d97ff20d71bd26b1aecfd9e3595486757e0ceb5a9` pass `instance prepare --dry-run` with zero changes. All 5,739 captured world/LOD/player-setting hashes are unchanged.                           |
| Resource Review save | Retained category fixture, revision 5, in the local client. Twelve sections, 311 manifest entries, eight ladder families, 27 stationary creatures and a conditional mosquito station. Source lives in the testing harness; native placement and reload checks are described below.                                                                                        |
| Questlog             | Native definitions, negative/positive count thresholds, any-of branches, block interactions and NBT restoration are checked by the exporter. Browser preview is not proof of Minecraft text wrapping, localization or UI integration.                                                                                                                                     |
| Generation           | Native spacing comparisons and controlled/natural village surveys are owned by [worldgen](../worldgen.md) and [structures](../structures.md). Existing terrain samples are historical; they are not a survey of every later playtest world.                                                                                                                               |
| Rendering            | Shader pipeline/sampler measurements and DH patch evidence are owned by [compatibility](../compatibility.md). No FPS or cross-platform performance guarantee follows from compilation.                                                                                                                                                                                    |

The [resource interaction guide](../compatibility.md#resource-interactions) links
the retained local comparison captures. The fixture builder and instructions live
under `~/Minecraft/modpack-testing/projects/create-sky-resources/`. Candidate
archives and disposable launcher copies are not required to browse the evidence.

### Category fixture checks

The 2026-10-23 review uses the installed client snapshot
`4bc70d4a4e5eac8303e293566c44584fa004c5a0dd0868e17a1a9889d30a6e04`.
The optional lantern/Lootr prototype has SHA-256
`b608fddbdbcfabe2afe35bbc881296a7d757557ae6835dae1945d10590b14662`;
it is unselected and absent from the release inputs. Its lantern fallback rendered
correctly. That namespace-only experiment did not establish Lootr animation
equivalence; the later [native model checks](#native-model-checks-2026-10-24)
verified the maintained adapter. chest close clips are
linked from [resource interactions](../compatibility.md#category-review-world).

- `verify_world.py WORLD`, using the Atlas Python environment after stopping
  Minecraft: all 4,476 specified blocks, 32 equipment slots and 27 stationary
  specimen IDs matched the saved world. The checker also refused the world while
  Minecraft held its session lock. It checks IDs, not textures, connection states
  or animation. The conditional mosquito station was exercised in-game.
- Native fixture parsing and display creation completed without function/display
  errors. Save/reload preserved the scene without rebuilding it. Night/noon and
  category buttons worked. The selected stack was restored,
  including the player's enabled shader setting; prototype selection was removed.
- `python3 -m unittest discover -s projects/create-sky-resources -p 'test_*.py'`
  in the harness: four checks passed for the world marker guard, edit bounds,
  Unicode labels and torchflower stage regression.
- `pnpm check` in `web`: 27 files, no errors, warnings or hints.
- `node --test tests/resourcepacks.test.mjs`: both catalog/data checks passed.
  The served resource page contains the local comparison section and all ten
  linked evidence files exist. This is not a browser interaction test.

## Research coverage

The 2026-10-23 catalog review screened 250 download-ranked listings each from
Modrinth, CurseForge and Planet Minecraft: 750 site-local entries, including
cross-site duplicates. It contains 46 detailed reviews, 45 hash-verified inspected
archives and one source-only comparison. `projects.json` records exact inputs and
inspection limits; the Atlas distinguishes that baseline from current selections.
Its galleries show upstream artwork, not the local fixture screenshots.

The original source-gallery check returned image content for all 295 unique
thumbnail/full-image URLs. External availability can change. Browser tests stub
those remote images and separately verify failure fallbacks; they do not repeat
the remote artwork check. Broad 3D packs, Fresh Moves and shader-off sky candidates
remain inspected candidates, not runtime-tested selections.

## Evidence ownership

| File                                          | Authority                                                      |
| --------------------------------------------- | -------------------------------------------------------------- |
| `data/generated/runtime/snapshot.json`        | Loaded JAR hashes, lock hash and input fingerprint             |
| `data/generated/runtime/journal.json`         | Native quest definitions and handler checks                    |
| `data/generated/runtime/patch_checks.json`    | Actual corrected block-drop rolls                              |
| `data/generated/runtime/heat_checks.json`     | Native heat behavior                                           |
| `data/generated/runtime/worldgen_review.json` | Read-only native layout comparison, when captured              |
| `data/generated/diagnostics.json`             | Remaining runtime diagnostics                                  |
| `data/generated/world.json`                   | Dated stored-region census and block sample                    |
| `data/generated/structures.json`              | Controlled/natural village survey and provenance               |
| `data/research/resourcepacks/`                | Catalog, exact archive inspections and source-gallery metadata |
| `public/generated/resource-review/`           | Selected local screenshots; ignored by Git                     |

Keep compact evidence while a current claim depends on it. Completed migration,
bootstrap and selective-sync receipts do not define current configuration. Do not
copy their history into operating guides or treat old pass counts as current tests.

## Model workbench checks, 2026-10-24

The tested model-authoring source digest is
`43969a3043198c3bb99f71f82cf56c0d4fbc7b12aaeaf2ec6e4ace9b37bfbf1b`.
It hashes these paths in order, each followed by NUL, file bytes and NUL:
`authoring/model-recipes.json`, `authoring/resource-patches.json`,
`scripts/model_authoring.py`, `scripts/resource_inputs.py`,
`scripts/lootr_models.py`, `scripts/build-resource-patches.py`,
`web/src/lib/model-authoring.ts`, `web/src/lib/model-preview.ts`, and
`web/scripts/model-authoring.mjs`.

| Check                                                  | Result and scope                                                                                                                                   |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root Python unit discovery                             | 26 pass; guarded publication, mask coverage and exposed surface area, input rejection, isolated fitting, Lootr attachments and native lookup paths |
| `pnpm verify`                                          | Formatting, 32 Node tests, Astro check and static build pass; Three.js produces a chunk-size warning                                               |
| `pnpm test:python`                                     | 9 pass using the project's Python environment                                                                                                      |
| `PLAYWRIGHT_CHANNEL=chrome pnpm test:browser`          | 19 pass, including retained JSON drafts, extrusion/fitting edits, recipe switching, reload protection and narrow-screen layout                     |
| Actual model API read/save/generate/read               | Source roundtrip preserved recipe values; generation uses the saved source                                                                         |
| Browser inspection                                     | Textured lantern geometry, UV selection, element controls and scrollable workbench render                                                          |
| `python3 -B scripts/build-resource-patches.py --check` | Deterministic selected output matches; 14 block models and three Lootr model/animation resources                                                   |
| `python3 -B scripts/audit-changes.py`                  | 228 registered files, no drift or unregistered files                                                                                               |

### Native model checks, 2026-10-24

The final combined resource ZIP has SHA-256
`e44afbb31646a575f6e298f6acb29875cc1a4edea600b6fc9a41425211c43307`.
The disposable client used Minecraft 1.21.1, NeoForge 21.1.264, Temurin
21.0.13+9-LTS/aarch64, EMF 3.3.12, Lootr 1.11.38.127 and Fresh Objects 2.1.2.
Its source was client snapshot
`4bc70d4a4e5eac8303e293566c44584fa004c5a0dd0868e17a1a9889d30a6e04`,
with a cloned Resource Review revision 5 world. The generated model patch was
added above its inputs. The combined candidate passed cold launch/world reload;
the final ZIP differed only in its pack description and passed resource reload.
Playing instances and worlds were not changed by this check.

- Industrial bars: isolated post, three-high corner and crossing fixtures retained
  openings and continuous edges from both sides. Compare
  [baseline](../../../web/public/generated/resource-review/models/baseline-bars.png),
  [extrusion](../../../web/public/generated/resource-review/models/candidate-bars.png),
  and [shader view](../../../web/public/generated/resource-review/models/combined-shader-bars.png).
- Bell and covered lanterns: standing/hanging frames and caps use opaque metal;
  covered windows retain their opaque lower region. Original animated textures
  continue changing with no missing-texture surface. Compare
  [bell before](../../../web/public/generated/resource-review/models/baseline-bell.png),
  [bell fitted](../../../web/public/generated/resource-review/models/candidate-bell.png),
  [covered before](../../../web/public/generated/resource-review/models/baseline-covered.png),
  and [covered fitted](../../../web/public/generated/resource-review/models/candidate-covered.png).
  Shader checks include [bell](../../../web/public/generated/resource-review/models/combined-shader-bell.png),
  [covered](../../../web/public/generated/resource-review/models/combined-shader-covered.png),
  and standing flame clips for [bell](../../../web/public/generated/resource-review/models/final-bell-animation.mp4)
  and [covered](../../../web/public/generated/resource-review/models/final-covered-animation.mp4).
- Lootr: EMF selected both exact JEM paths, attached body/lid/latch branches and
  parsed their animation expressions. Opening/closing, generated inventory contents,
  gold unopened/muted opened materials, trapped chests and
  [neighbor independence](../../../web/public/generated/resource-review/models/neighbors-after.png)
  passed. The [vanilla control](../../../web/public/generated/resource-review/models/vanilla-close-range.mp4)
  and [Lootr recording](../../../web/public/generated/resource-review/models/lootr-close-range.mp4)
  both show the body shake: the left wood edge at image y=720 moves from x=572
  to x=578 and returns to x=572. This is a motion observation, not a timing or
  performance equivalence claim. A separate playtest also observed the shake.
  [Trapped/shader](../../../web/public/generated/resource-review/models/combined-trapped-shader.mp4)
  and [final resource reload](../../../web/public/generated/resource-review/models/final-lootr-reload.mp4)
  clips retain working motion and materials.

Baseline/model comparisons used noon, clear weather, FOV 90 and fixed cameras.
Bars: `(245.5,181,29.5)`, yaw 180, pitch 7. Bell: `(54.5,181,95.8)`, yaw 180,
pitch -5; covered uses `(26.5,181,104.8)` with the same angles. Close-range chest
clips used FOV 50, GUI scale 1 and menu blur 0 so the inventory did not obscure
the body: normal `(70.5,181,76.65)`, Lootr `(70.5,181,89.65)`, yaw 180, pitch 49.
Shader checks used Complementary Unbound r5.9.3 with Euphoria Patches 1.10.5 and
FOV 50. Saved window clips are H.264 at 1708×1016; audio was not evaluated.

These checks cover placed models and one local player's chest interactions.
Moving Create/Sable contraptions, distant LOD appearance, multiplayer state,
other shaders and performance require separate tests. Existing upstream double-chest
animation warnings are not fixed by the single-chest Lootr adapter.

## Visual compatibility pass, 2026-10-24

Tested the worktree based on `7cf5797`, with 73 model recipes and the mooshroom
adapter enabled. The generated and installed client ZIP both have SHA-256
`25b066c28400062abcb69f761c5048ef4aafbcc272872e33f56874a411adaf81`.
The Prism reference snapshot installed through empack is
`e6fc49c6229c0befeeb9aad337279cd59cfa13ebcf79165a159da07f4a06e77c`;
only the visual ZIP changed among game files. Server content did not change.

Commands and outcomes:

- `python3 scripts/model-workbench.py --validate` and
  `python3 scripts/build-resource-patches.py --check`: valid/current.
- Root Python discovery: 26 passed. `pnpm test:python`: 9 passed.
- `pnpm data:compile`, `pnpm data:check` and `pnpm verify`: passed;
  44 JavaScript tests, zero Astro diagnostics. Existing bundle-size warning remains.
- `PLAYWRIGHT_CHANNEL=chrome pnpm exec playwright test tests/models.browser.mjs`:
  3 passed. Bundled Chromium was unavailable; installed Chrome was used.
  The existing browser check reads the recipe count instead of assuming eight;
  original recipe labels were retained. No geometry regression tests were added.
- Harness fixture discovery: 4 passed. After normal Minecraft shutdown,
  `verify_world.py` checked 4,586 blocks, 32 equipment slots and 27 original
  stationary specimens without mismatches. A separate read-only saved-NBT inspection
  confirmed chest halves, nine applied Copycat materials, both storage controllers
  and 16-item transfers, stair mounting, and grounded NoAI specimens.

Native captures remain in the harness's
`projects/create-sky-resources/images/2026-10-24-visual-pass/`. Selected captures
are also available in the relevant Atlas resource-pack galleries.
The retained world has the matching revision-6 builder. Views cover Create/Deco
bar families and overlays, standing/hanging lanterns, bridge/stair mounting,
cage lamps and representative lit/unlit, rotated and no-base frontlights.
Eight registered frontlight materials have identical alpha masks in the pinned
input; the shared hood retains their child texture bindings. Shader comparisons
used the existing Complementary/Euphoria configuration and its disabled state.

The mooshroom clip records idle movement; red/brown adults and babies render with
Details geometry. It does not establish every locomotion, rare variant or creature
rig. Other missing Details animation references remain documented in
[patch maintenance](../patches.md#fresh-details-animation-rigs).
Moving contraptions, multiplayer, other shaders and performance were not tested.

## Candidate generation survey integration

On 2026-10-24, `pnpm data:islands` imported artifact-stamped native density and
generated-resource reports from Create Sky Compat. `pnpm data:compile` retained
those reports separately from the archived saved-world survey. The World & ores
panel labels the development candidate, predicted density, observed blocks and
weighted estimates; source JSON retains depth bins, descriptors and hashes.
Desktop capture review confirmed the tables render, and the browser viewport
check found no document overflow at 390 pixels.

`pnpm verify` passed 52 JavaScript checks, Astro diagnostics and static build;
`pnpm test:python` passed 11 checks, including rejected incomplete/unstamped reports
and invalid count values. `PLAYWRIGHT_CHANNEL=chrome pnpm test:browser` passed
32 checks, including the existing embedded routes, recipes, authoring and new
candidate panel. The initial default-channel attempt could not launch because
Playwright Chromium was not installed; the documented Chrome channel was used.
The static build retains the existing large-chunk warning.

The native mod's verification guide owns resource, spawn, geode and flight
observations. The Atlas import does not itself validate a world or certify gameplay.
The import reads reports; it does not mutate Minecraft worlds or instances.

## Island thickness and clearance evidence

On 2026-10-25, imported five-seed density reports and two three-anchor resource
surveys for Compat 0.4.0. The table distinguishes target and sampled total height,
center elevations, conservative support gaps, sampled shore gaps and surface
openings. Earlier saved-world surveys remain historical. Native evidence and
artifact parity are documented in Compat's verification guide.

The importer preserves signed 64-bit seeds as strings so JavaScript cannot round
them. `pnpm test:python` passed 13 checks, including both signed endpoints and
preserved source hashes. `pnpm data:islands` and `pnpm data:compile` regenerated
the projection. `pnpm verify` passed formatting, 54 JavaScript checks, Astro
diagnostics and build; the existing large-chunk warning remains.
No new interaction or graph layout was introduced; browser interaction tests
were not rerun for these table labels and import changes.

## Saved-world refresh, 2026-10-26

The Atlas sampled a consistent copy of the current server's Overworld, captured
while it was stopped for the BlueMap adapter restart. Only region files, level
metadata and the generation marker were copied; the temporary copy was removed
after inspection. The running world and DH data were preserved.

`pnpm data:world --samples 16 --world PATH` completed at 2026-10-27 04:15:51 UTC
(October 26 locally), replacing the smaller earlier capture. The census found
1,882,676 stored chunk entries across 1,940 regions. It sampled 30,976 chunks,
28,673 with full status, without read errors, changed regions or metadata changes.
Sampling increased from four to sixteen chunks per populated region. Bounds were
X=-12288..10239 and Z=-10240..12287; these are region envelopes, not complete
coverage or island edges. The remaining 2,303 unfinished samples can depress
estimates. This capture does not establish pregen completion.

The seed is `-3702386035254534638`, generation `islands_v1-prototype-10`, with
2400-block spacing, jitter 750 and OVERLAP. The generation identity SHA-256 is
`431c3d63a8281dfda9c6f595fcf3bb93678ecb405976fa3df078f41fbb659066`.
Area-weighted sampled solid-column coverage was about 3.05%. Zinc, diamond,
emerald and platinum were observed; absolute-Y ore distributions combine islands
at different elevations and do not define a universal mining level.

`pnpm data:compile` regenerated the browser projection and `pnpm data:check`
passed. The two targeted Chrome checks passed for the real world/profile and
missing-survey state. No application behavior changed, so the full application
build was not repeated. Runtime item/recipe exports and older isolated island
resource surveys remain separate; they were not recaptured by this world refresh.
The exact-seed spacing and local renderer review is in
[cluster visibility](../worldgen.md#cluster-visibility).

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
