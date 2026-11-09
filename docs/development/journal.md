# Quest design and definitions

FTB Quests and FTB Teams are selected for a non-linear, team-aware capability
graph. Both quest mods remain installed for the trial; the generator and Atlas
editor target FTB Quests exclusively, with one mechanics/text owner. See
[team and world progress](team-world-progress.md) for spawn, membership and
dimension-access boundaries, and [pack authoring](authoring.md) for tool ownership.

## Installed Questlog implementation

Questlog provides an optional, bookless journal for Create: Skyweave. The selected
artifact is recorded in `empack.yml`; the current implementation review covers
Questlog 3.5.3 on Minecraft 1.21.1 / NeoForge.

Skyweave: Compatibility Patches' Questlog adaptations own wrapped rows, reward previews, bookmark preferences and runtime
notifications. The pack enables its three independent startup switches and native
completion flags. Review the exact Questlog pin and Skyweave: Compatibility Patches hooks together before
upgrading either. Keep the native Questlog panel textures replaceable; adding panel
overrides also requires checking controls, ink colors and per-entry skins. Existing
client palettes may need a reviewed color-only merge rather than replacement of
all user presentation settings.

## Ownership

- `authoring/quests/book.json`, `chapters/` and `locales/` own FTB mechanics,
  chapter organization and sparse locale/shared text.
- `scripts/quests.py` and `generate-quests.py` validate source and generate native
  SNBT in `overrides/common/config/ftbquests/quests/`, including translations,
  the ownership manifest and exact managed policies in `empack.bindings.yml`.
- `overrides/common/config/questlog/` and its translations remain frozen legacy
  runtime content. They are not a second authoring workflow.
- `overrides/client/config/questlog-client.json` owns legacy display defaults;
  maintained Questlog interface wording remains in the shared resource JAR.

[Pack authoring](authoring.md) owns editing, localization and generation procedures.
[Progression](progression.md) owns resource, processing and travel assumptions.
The Atlas maps potential acquisition; graph depth does not establish affordable
quantities, working machinery or a safe return journey.

## Design policy

These principles govern the authored entries and their future maintenance.

Organize around capabilities players can use repeatedly. Prepare, use and expand
are useful stages within a route, not a mandatory three-entry template. Keep
alternative travel and production methods visible and give early equipment a
lasting role. Avoid compulsory chapter gates, a quest for every ingredient,
reward-exclusive resources and an assumed universal technology ladder.

For FTB Quests, make chapters meaningful expansions of what a player/team can do,
not a list of mods or item categories. Let workshop power, resource processing,
local crossings, sustained flight, cargo and habitat exploration cross mod
boundaries. Branches may converge on the same capability; dependencies express
actual prerequisites or explicit alternatives. Chapter membership alone must not
lock unrelated tasks or recipes. Preserve progress for observable actions that
happen before a display dependency unlocks where the native task supports it;
verify that behavior instead of assuming it. Rare-island discovery must use an
authoritative actual-location check, not a locator result.

Offer an optional client/game-help chapter or reference area for inventory gestures,
sorting and transfer modes, equipment profiles, locked slots, refill/crafting,
trade bookmarks, party controls and other useful interface features. Keep this
separate from capability progression and mandatory gates. Prefer actual active
key labels where supported, otherwise direct players to Controls/configuration.
Use informational or native manual acknowledgement tasks rather than claiming
server verification of client-only gestures. Help content need not award items.

Distinguish three kinds of entry:

| Kind                | Completion claim                                                                              |
| ------------------- | --------------------------------------------------------------------------------------------- |
| Equipment acquired  | The player has obtained the stated equipment or supplies.                                     |
| Action demonstrated | A verified event or advancement confirms the stated operation.                                |
| Suggested project   | An explanation proposes a useful arrangement; it does not claim the whole build was detected. |

Suggested projects can live inside descriptions without separate completion or
rewards. Never label an inventory check as successful flight, a functioning
factory or a completed delivery. Prefer an existing verified advancement or
native objective before creating a new detection mechanism. Player crafting
checks do not automatically cover machine output, and names alone do not prove
what an advancement detects or which player receives credit.

For each substantive entry or route, establish:

| Authoring question | Required reasoning                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| Purpose            | The capability, interaction or discovery introduced.                                                   |
| Practical setup    | Equipment, materials, quantities, power, fuel, access and supporting machinery.                        |
| Evidence           | Exact completion condition, attribution and limits; distinguish source inspection from runtime checks. |
| Continuing use     | Repeated activity, alternatives, trade-offs and adjacent routes.                                       |
| Reward             | Its purpose, reference budget and effect on other entries.                                             |
| Maintenance        | Owning recipes, tags, config or triggers that must be rechecked on updates.                            |

These are review questions, not a requirement for a new schema or a parallel
ledger. Put durable explanations in the owning source or document. Use concise,
neutral working titles; final naming and flavor belong to the owner. Native task
labels show compact requirements; descriptions explain operation and detection
limits. Reuse shared explanations without repeating ordinary interface text.

### FTB resource contract

FTB Quests 2101.1.38 uses definition format 13. Emit that version explicitly in
`data.snbt`; a missing version invokes its legacy migrator and can rewrite managed
files. Object IDs are positive signed longs written as 16 uppercase hexadecimal
digits. A full unsigned hash is unsafe: values above `7FFFFFFFFFFFFFFF` can be
replaced by new IDs during loading. IDs 0 and 1 are reserved for the native default
group and file. Persist IDs independently of titles, layout
and filenames, and check collisions across chapters, tasks, quests and rewards.

Each chapter must emit its native `filename` alongside its ID. Keep that filename
consistent with the generated path so native saves do not create a second chapter.
Icons use single-item compounds; item tasks and rewards use native stack compounds.
Item-task counts are longs. Translation tables live under `quests/lang/` and use
`<object type>.<ID>.<translation key>`; descriptions and chapter subtitles are lists,
not vanilla language-file strings.

The source compiler rejects unsupported fields, conflicting IDs, cycles and native
type mismatches. Generation must detect edited, deleted or unowned native files
before writing. Reconcile their changes into authored source or restore the known
generated version explicitly; do not parse away unknown FTB syntax or silently
overwrite in-game edits. Recheck native parsing, file stability, translations and
task/reward behavior together whenever FTB Quests or Library changes.

The emitter also follows the pinned native writer's defaults, omitted values,
sorted keys and single-line task stacks. Initial loading alone is insufficient:
verify generated files again after a native save and reopen. Routine native
normalization must not become a managed-file conflict. Keep the writer contract
with the compiler; do not add a second general-purpose SNBT importer.

Item tasks accept one concrete stack or an authored item-list/tag selector.
Skyweave: Compatibility Patches supplies the latter through FTB's common filter
API. Mixed matching stacks contribute to one count. Descriptions must explain
that combined quantity, and generated selectors must retain strict component
matching so ordinary paper cannot satisfy them if the adapter is disabled.
Counts use native longs while remaining exact in the browser's JSON number range.

Use flexible progression for the book. Native FTB retains early task progress
while dependencies are unfinished, then marks completion when they are met.
Progress and completion are distinct observations; verify both, including a
save/reopen, rather than treating a locked completion icon as lost progress.

### Coverage

Use these subjects to review coverage, merging or splitting chapters where the
actual content warrants it. They are not final names or mandatory gates.

| Subject                           | Coverage to consider                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Field supplies and survival       | Food, renewable crops, animals, portable rest, backpacks, repair and enchanting.                             |
| Island access and exploration     | Gliders, climbing, ropes, ascent, descent and return access.                                                 |
| Workshop and processing           | Rotation, transmission, pressing, washing, heat, alloys, crushing and assembly.                              |
| Airframe and lift                 | Physics assembly, glue roles, envelope enclosure, heat, mass and levitite.                                   |
| Propulsion and control            | Portable engines, propellers, bearings, controllers, transmissions, steering, sensors and fuel alternatives. |
| Cargo and infrastructure          | Routing, storage, docking, packaging and existing delivery contracts.                                        |
| Electricity                       | Generation, wiring, motors, storage and conversion under actual operating constraints.                       |
| Optional projects and discoveries | Photography, construction, rail transport and appropriate combat activities.                                 |

Do not invent settlement demand or an economy around ADQ's supplied cargo.
Existing delivery contracts retain their purpose and rewards. Story-driven world
integration is not required for this journal. Disabled mechanics, including
Flywheel Bearing storage, cannot supply an instructional route without a separate
approved gameplay change. Phantom membranes remain a normal early acquisition;
do not manufacture a gate from an assumed rarity.

### Rewards

Rewards should help players exercise a capability they have begun to acquire.
Prefer modest expansion supplies, operating materials, another attempt at a
process or an adjacent activity. Use fixed contents by default and comparable
choices where alternatives matter. Explanatory entries need not all pay out.

Treat 10% to 20% of a small useful setup or operating batch as a starting budget,
not a multiplier on the objective count. Account for bottleneck materials, access,
recipe yields and repeated use rather than assigning one universal item value.
Budget across the entire route so ingredient, machine and operation entries do
not reimburse the same investment repeatedly. Check whether rewards themselves
complete other entries and whether that cascade is intentional.

For example, the current Mechanical Crafter recipe produces three, while the
Crushing Wheel arrangement uses 21. Three extra crafters represent about 14% of
that station. One membrane is already half the glider recipe's membrane cost.
The journal uses the three-crafter expansion and does not reward membranes. Indivisible items justify a
smaller alternative, no material reward or an explicit exception; do not inflate
objectives just to make a percentage work.

Do not supply the scarce discovery that should motivate the next expedition.
Avoid mandatory rewards, lottery-dependent progression and rewarding preparation
as if it established sustained operation. A kit can be several ordinary rewards
collected together; physical crates need a gameplay purpose beyond packaging.
Keep contents understandable before collection and check inventory overflow and
choice behavior in the installed version before enabling a reward design.

The selected FTB system shares quest progress through FTB Teams. Decide reward
scope separately: setup materials can be claimed once per team, while personal
equipment may be claimable per player. Budget accordingly, including join/leave,
offline members and already-claimed rewards. World milestones remain separate;
no team quest silently advances a server-wide stage. Avoid anti-sharing gates.
Existing Questlog inventory checks remain personal and non-consuming during
coexistence; that legacy behavior is not the new shared-progress contract.

## Current definitions

The FTB source contains 74 quests in nine capability/reference chapters. It covers
all 77 retained legacy subjects, consolidating or splitting them for actual
progression rather than duplicating the old chapter layout. Nine optional handbook
entries explain client/team/inventory controls without pretending to detect gestures.

Foothold, workshop, crossings, flight, control, production and electricity form
intersecting capability routes. Projects and the handbook remain optional reference
branches. Flexible progression retains early native task progress while prerequisites
are unfinished. Equipment tasks prove ownership; advancement/interaction tasks prove
only their actual native trigger. Suggested builds and journeys use explicit manual
acknowledgement where no verified trigger exists.

Legacy Questlog remains available with its existing IDs, objective positions and
claim state. Its frozen mechanics baseline is checked independently of the FTB
compiler. No new recipes, loot or world generation are implied by quest conversion.

### Linear machinery

Four equipment entries introduce a guide, paired magnetic ports, paired torsional
anchors with separate spring heads, and a gyro/converter sensor. Native inventory
objectives detect supplies only. Descriptions distinguish passive travel, powered
braking, external drive capacity and a zero-capacity sensor; none claims successful
movement or stabilization. These checks do not invent operation triggers.

The guide reward is two casings toward an example twelve-casing rail setup, about
17% of its rail cost. It supplies no new bearing or scarce slime. Other machinery
entries have no material reward. Recheck the recipes, machinery contract and
cross-entry reward budget when changing Linear Bearing or its Skyweave: Compatibility Patches adapters.

### Articulated machinery

Two Workshop inventory entries introduce Absolute Kinematics' driven hinge and
passive ball joint. Both require one already acquired joint; neither condition
claims assembly, articulation, locking or successful shaft transmission. Their
native Ponder tutorials explain those operations.

The hinge entry supplies two shafts toward a twelve-shaft drive/control setup,
about 17% of that batch. It supplies neither a gearbox nor a scarce first joint.
The ball-joint entry has no material reward: the component is indivisible and
has no recurring operating consumable that needs a discovery subsidy. Keep native IDs stable when adjusting the operating guidance or rewards.

### Traveler's Backpack

Four Field supplies entries cover the pack and its existing operating controls.
They use Traveler's Backpack 10.1.40's native advancements rather than custom
detectors or possession checks for components that may already be installed.

| Entry                  | Native condition                                      | Limit                                                                                        |
| ---------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Carry a backpack       | `standard` or `custom_backpack` inventory advancement | Ownership, not equipping or a particular storage tier                                        |
| Deploy a sleeping bag  | `use_sleeping_bag`                                    | Successful deployment followed by a sleep attempt; sleep itself can fail                     |
| Swap carried tools     | `tool_slots`                                          | The swap action, including exchanges involving empty slots                                   |
| Draw fluid with a hose | `hose_suck`                                           | The hose's fluid pickup action; bucket filling through another interface does not satisfy it |

Quick sleeping-bag use is enabled and does not set spawn. The leather tier has
27 storage slots and two tool slots; fluid capacity is 1,000 mB per storage row,
so each installed tank holds 3,000 mB. Recheck these configuration consumers and
the advancement call sites when updating Traveler's Backpack. Advancement names
alone do not establish that a night passed or that a nonempty tool was exchanged.

### Reward budgets

These are authoring reference batches, not measured trip durations or proven
minimum installations. Counts are deliberately small and remain subject to
survival playtesting. Do not increase an objective count to justify a payout.

| Route                                 | Total supplement                    | Reference use and limit                                                                                                            |
| ------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Food, glider and field rest           | 5 bread across three entries        | About 21% of a 24-food travel reserve; the one-bread rest supplement is an indivisible rounding exception; no membranes or leather |
| Backpack tool and fluid use           | 4 torches and 2 glass               | 12.5% of a 32-torch reserve and 17% of the glass for a pair of backpack tanks; no complete upgrade, hose or extra backpack         |
| Animal breeding                       | 4 wheat                             | 17% of a 24-wheat breeding/feed reserve; no new animal or crop species                                                             |
| Enchanting                            | 3 lapis                             | 17% of an 18-lapis session; no enchanted equipment or levels                                                                       |
| Workshop rotation and flexible shafts | 5 shafts across two entries         | About 21% of a 24-shaft distribution batch; the extra one-shaft supplement is indivisible and adds no scarce component             |
| Pressing, mixing, fan processing      | 2 iron ingots, 4 andesite, 4 gravel | Roughly 12–17% of separate 16/32/32 input batches; no zinc, quartz or platinum                                                     |
| Mechanical crafting                   | 3 crafters                          | 14% of the 21-crafter crushing-wheel arrangement, after the first recipe batch                                                     |
| Hot air                               | 2 wool and 2 sticks                 | One four-envelope recipe; 12.5% of a 32-envelope expansion, not a claim that 32 encloses a viable balloon                          |
| Powered propeller                     | 4 coal                              | 17% of a 24-coal operating reserve; no measured flight duration implied                                                            |
| Turpentine                            | 4 spruce logs                       | 12.5% of 32 logs for further probabilistic resin processing; no free resin or fuel                                                 |
| Controls                              | 4 redstone                          | 17% of a 24-dust wiring/control reserve                                                                                            |
| Cargo handling                        | 2 funnels and 4 cardboard           | 17% of a 12-funnel expansion and a 24-cardboard batch; delivery contracts retain their own rewards                                 |
| Motor operation                       | 2 copper ingots                     | 12.5% of a 16-ingot electrical-component reserve; no free energy or complete circuit                                               |
| Printing, rail, ranged equipment      | 4 paper, 4 tracks, 4 arrows         | 12.5% of separate 32-item expansion/consumable batches                                                                             |

The crafter and funnel rewards deliberately expand equipment already obtained.
No reward directly completes a different journal entry at its authored quantity.
Shared food rewards remain below the food objective even together. Further
crafting with rewards is expected; rewards never supply a new scarce discovery.
Entries without rewards still explain equipment, constraints or an optional project.

Task quantities, text and rewards live in the authored FTB source. Inventory tasks
use native FTB semantics; item-list/tag selectors combine matching stacks through
the optional filter adapter. Advancement tasks do not prove more than their trigger,
and block interactions do not prove GUI success or a valid circuit. Review both
native progress and completion rather than relying on description text.

## Update checks

Generated definitions use empack's managed policy. Preserve FTB native IDs across
moves and title changes, and review dependency/reward changes against existing
team/player progress. Native completion and claim data remain outside authored
source. Do not reset it or reuse a deleted ID for different semantics. Keep legacy
Questlog definitions and progress intact during coexistence.

1. Review exact selected artifacts and the affected recipes, tags, advancements,
   configuration and operating assumptions. Distinguish acquisition from crafting
   and actual use; check alternatives and automation paths.
2. Recalculate setup and reward budgets when yields, resource access, fuel, mass,
   loot or machine behavior changes. An unchanged item ID is insufficient evidence.
3. Review chapter placement, stable IDs, task/reward IDs, existing
   completion, locale references and shared paragraphs together. Reward additions
   need an explicit decision about previously completed entries.
4. Edit authored source and regenerate through the existing tools. Build the shared
   resource JAR when its maintained data/assets change; FTB locale SNBT is separate. Review removals and
   update accepted mechanics fixtures only after the semantic change is understood.
5. Check native decoding, relevant negative and positive cases, progress restoration,
   rewards and repeat claims using isolated fixtures. Check representative client
   labels, descriptions, choices and language fallback when behavior or layout changes.
6. Refresh affected Atlas acquisition, interaction and runtime evidence through its
   owning pipeline. Keep authoring, generated files, the resource JAR and player
   documentation aligned. A text edit alone does not require recapturing a world.

[Dependency maintenance](patches.md) owns cross-project update boundaries and
installation order. Builds do not install files into personal instances.

## Verification boundaries

Compiler tests cover stable IDs, native types, supported properties, dependency
cycles, sparse locale fallback and generated-file conflicts. Native checks must
also cover decoding, save/reopen byte stability, early progress, actual triggers,
manual/team claims, repeat rejection and overflow. Source tests and advancement
grants do not establish a physical machine action or a complete survival route.

Atlas service/browser tests cover coordinated source writes, chapter/quest moves,
rollback, external edits, localized/shared text, drafts, layout editing and responsive
controls. Refresh native runtime exports separately when definitions or dependencies
change. Keep compact artifact/version receipts in private captures and current
procedures in the owning development guides.
