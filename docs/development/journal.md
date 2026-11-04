# Journal design and definitions

Questlog provides an optional, bookless journal for Create Skyweave. The selected
artifact is recorded in `empack.yml`; the current implementation review covers
Questlog 3.5.3 on Minecraft 1.21.1 / NeoForge.

Compat's Questlog adaptations own wrapped rows, reward previews, bookmark preferences and runtime
notifications. The pack enables its three independent startup switches and native
completion flags. Review the exact Questlog pin and Compat hooks together before
upgrading either. Keep the native Questlog panel textures replaceable; adding panel
overrides also requires checking controls, ink colors and per-entry skins. Existing
client palettes may need a reviewed color-only merge rather than replacement of
all user presentation settings.

## Ownership

- `authoring/journal/chapters/` owns chapter properties and quest mechanics.
- `authoring/journal/locales/` owns entry sections, shared disclaimers and short
  objective labels by locale.
- `overrides/common/config/questlog/` contains generated native JSON; the generator
  also owns their exact managed-file policies in `empack.bindings.yml`.
- `overrides/client/config/questlog-client.json` owns client display defaults.
- `pack-fixes/assets/questlog/` owns journal interface wording; native Questlog
  artwork supplies the parchment panels and controls;
  `pack-fixes/assets/create_skyweave/lang/` contains generated entry translations.
- `scripts/build-fixes.py` packages language assets with maintained data fixes.

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

Distinguish three kinds of entry:

| Kind | Completion claim |
| --- | --- |
| Equipment acquired | The player has obtained the stated equipment or supplies. |
| Action demonstrated | A verified event or advancement confirms the stated operation. |
| Suggested project | An explanation proposes a useful arrangement; it does not claim the whole build was detected. |

Suggested projects can live inside descriptions without separate completion or
rewards. Never label an inventory check as successful flight, a functioning
factory or a completed delivery. Prefer an existing verified advancement or
native objective before creating a new detection mechanism. Player crafting
checks do not automatically cover machine output, and names alone do not prove
what an advancement detects or which player receives credit.

For each substantive entry or route, establish:

| Authoring question | Required reasoning |
| --- | --- |
| Purpose | The capability, interaction or discovery introduced. |
| Practical setup | Equipment, materials, quantities, power, fuel, access and supporting machinery. |
| Evidence | Exact completion condition, attribution and limits; distinguish source inspection from runtime checks. |
| Continuing use | Repeated activity, alternatives, trade-offs and adjacent routes. |
| Reward | Its purpose, reference budget and effect on other entries. |
| Maintenance | Owning recipes, tags, config or triggers that must be rechecked on updates. |

These are review questions, not a requirement for a new schema or a parallel
ledger. Put durable explanations in the owning source or document. Use concise,
neutral working titles; final naming and flavor belong to the owner. Keep full
requirements in the left-hand description and short labels in the right-hand
objective rows. Reuse keyed disclaimers without repeating ordinary explanations.

### Coverage

Use these subjects to review coverage, merging or splitting chapters where the
actual content warrants it. They are not final names or mandatory gates.

| Subject | Coverage to consider |
| --- | --- |
| Field supplies and survival | Food, renewable crops, animals, portable rest, backpacks, repair and enchanting. |
| Island access and exploration | Gliders, climbing, ropes, ascent, descent and return access. |
| Workshop and processing | Rotation, transmission, pressing, washing, heat, alloys, crushing and assembly. |
| Airframe and lift | Physics assembly, glue roles, envelope enclosure, heat, mass and levitite. |
| Propulsion and control | Portable engines, propellers, bearings, controllers, transmissions, steering, sensors and fuel alternatives. |
| Cargo and infrastructure | Routing, storage, docking, packaging and existing delivery contracts. |
| Electricity | Generation, wiring, motors, storage and conversion under actual operating constraints. |
| Optional projects and discoveries | Photography, construction, rail transport and appropriate combat activities. |

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

Progress remains personal. Current inventory checks do not consume inputs, so
players can share equipment and independently qualify. Accept that property while
reviewing rewards; do not introduce team progression or an anti-sharing system.

## Current definitions

The authored source contains nine chapters and 75 entries: 59 inventory entries,
fourteen advancement entries and two block interactions. 25 entries offer fixed,
manually collected rewards. All entries have empty native requirements. Chapters
and sort order organize browsing without imposing crafting order or losing events
behind prerequisite gates.

Field supplies and local travel establish repeatable provisioning and access.
Workshop and component production separate owning a machine from processing with
it. Airframes and lift lead into propulsion/control, cargo and electrical systems;
these are related activities rather than a compulsory ladder. Photography, rail
and ranged equipment remain optional projects.

Ingredient-only entries for iron, tubes, sheets and platinum were folded into
capability guidance or operation checks. Possession of a circuit table and delivery
table was consolidated into their interaction entries. Full requirements and short
labels remain separate locale fields. No recipes, loot or world generation changed.

### Linear machinery

Four equipment entries introduce a guide, paired magnetic ports, paired torsional
anchors with separate spring heads, and a gyro/converter sensor. Native inventory
objectives detect supplies only. Descriptions distinguish passive travel, powered
braking, external drive capacity and a zero-capacity sensor; none claims successful
movement or stabilization. There are no prerequisite gates or invented operation
triggers.

The guide reward is two casings toward an example twelve-casing rail setup, about
17% of its rail cost. It supplies no new bearing or scarce slime. Other machinery
entries have no material reward. Recheck the recipes, machinery contract and
cross-entry reward budget when changing Linear Bearing or its Compat adapters.

### Articulated machinery

Two Workshop inventory entries introduce Absolute Kinematics' driven hinge and
passive ball joint. Both require one already acquired joint; neither condition
claims assembly, articulation, locking or successful shaft transmission. Their
native Ponder tutorials explain those operations.

The hinge entry supplies two shafts toward a twelve-shaft drive/control setup,
about 17% of that batch. It supplies neither a gearbox nor a scarce first joint.
The ball-joint entry has no material reward: the component is indivisible and
has no recurring operating consumable that needs a discovery subsidy. Existing
entry IDs, objective positions, and rewards are unchanged.

### Traveler's Backpack

Four Field supplies entries cover the pack and its existing operating controls.
They use Traveler's Backpack 10.1.40's native advancements rather than custom
detectors or possession checks for components that may already be installed.

| Entry | Native condition | Limit |
| --- | --- | --- |
| Carry a backpack | `standard` or `custom_backpack` inventory advancement | Ownership, not equipping or a particular storage tier |
| Deploy a sleeping bag | `use_sleeping_bag` | Successful deployment followed by a sleep attempt; sleep itself can fail |
| Swap carried tools | `tool_slots` | The swap action, including exchanges involving empty slots |
| Draw fluid with a hose | `hose_suck` | The hose's fluid pickup action; bucket filling through another interface does not satisfy it |

Quick sleeping-bag use is enabled and does not set spawn. The leather tier has
27 storage slots and two tool slots; fluid capacity is 1,000 mB per storage row,
so each installed tank holds 3,000 mB. Recheck these configuration consumers and
the advancement call sites when updating Traveler's Backpack. Advancement names
alone do not establish that a night passed or that a nonempty tool was exchanged.

### Reward budgets

These are authoring reference batches, not measured trip durations or proven
minimum installations. Counts are deliberately small and remain subject to
survival playtesting. Do not increase an objective count to justify a payout.

| Route | Total supplement | Reference use and limit |
| --- | --- | --- |
| Food, glider and field rest | 5 bread across three entries | About 21% of a 24-food travel reserve; the one-bread rest supplement is an indivisible rounding exception; no membranes or leather |
| Backpack tool and fluid use | 4 torches and 2 glass | 12.5% of a 32-torch reserve and 17% of the glass for a pair of backpack tanks; no complete upgrade, hose or extra backpack |
| Animal breeding | 4 wheat | 17% of a 24-wheat breeding/feed reserve; no new animal or crop species |
| Enchanting | 3 lapis | 17% of an 18-lapis session; no enchanted equipment or levels |
| Workshop rotation and flexible shafts | 5 shafts across two entries | About 21% of a 24-shaft distribution batch; the extra one-shaft supplement is indivisible and adds no scarce component |
| Pressing, mixing, fan processing | 2 iron ingots, 4 andesite, 4 gravel | Roughly 12–17% of separate 16/32/32 input batches; no zinc, quartz or platinum |
| Mechanical crafting | 3 crafters | 14% of the 21-crafter crushing-wheel arrangement, after the first recipe batch |
| Hot air | 2 wool and 2 sticks | One four-envelope recipe; 12.5% of a 32-envelope expansion, not a claim that 32 encloses a viable balloon |
| Powered propeller | 4 coal | 17% of a 24-coal operating reserve; no measured flight duration implied |
| Turpentine | 4 spruce logs | 12.5% of 32 logs for further probabilistic resin processing; no free resin or fuel |
| Controls | 4 redstone | 17% of a 24-dust wiring/control reserve |
| Cargo handling | 2 funnels and 4 cardboard | 17% of a 12-funnel expansion and a 24-cardboard batch; delivery contracts retain their own rewards |
| Motor operation | 2 copper ingots | 12.5% of a 16-ingot electrical-component reserve; no free energy or complete circuit |
| Printing, rail, ranged equipment | 4 paper, 4 tracks, 4 arrows | 12.5% of separate 32-item expansion/consumable batches |

The crafter and funnel rewards deliberately expand equipment already obtained.
No reward directly completes a different journal entry at its authored quantity.
Shared food rewards remain below the food objective even together. Further
crafting with rewards is expected; rewards never supply a new scarce discovery.
Entries without rewards still explain equipment, constraints or an optional project.

`item_obtain` samples inventory every ten player ticks and retains the highest
matching count. It is not cumulative production or item submission. Existing
items count, progress survives item use, and brief possession between checks can
be missed. Placed blocks and container contents do not count. Each objective
retains its own progress; separately completed conditions do not establish a
complete assembled kit held at one time.

`block_interact` records a right-click on the named block. The delivery-table and
circuit-design-table entries do not prove delivery completion, GUI success or a
valid circuit. OR checks accept supported alternatives such as rotation sources, propellers,
backpacks or colored equipment. Mixed envelope colors do not combine.

Entry text and quantities live in authored source and the Atlas journal editor,
not a second hand-maintained item index. Descriptions explain function, routes
and operating constraints. Full requirements, optional flavor, explanations and
shared disclaimers follow the composition rules in [pack authoring](authoring.md).

## Update checks

Pack definitions use empack's `managed` policy so edits and removals reach installed
instances. Questlog player progress remains separate. Earlier releases seeded these
files: when upgrading those installations, inspect the previous release manifest,
remove only unchanged retired pack definitions, and explicitly replace the reviewed
current definitions to transfer ownership. Preserve custom definitions and player
saves. Do not delete the whole Questlog directory.


Quest IDs are `questlog:<relative path without .json>`. Questlog fixes the namespace
to `questlog` and persists objectives and rewards by position. Moving an entry
between source files can rename its saved identity even if its title is unchanged.
Preserve identity for unchanged semantics; changed meanings, reordered objectives
or reward changes require an explicit existing-player policy. Do not silently
reset progress, reinterpret old completion or award the same reward twice.

1. Review exact selected artifacts and the affected recipes, tags, advancements,
   configuration and operating assumptions. Distinguish acquisition from crafting
   and actual use; check alternatives and automation paths.
2. Recalculate setup and reward budgets when yields, resource access, fuel, mass,
   loot or machine behavior changes. An unchanged item ID is insufficient evidence.
3. Review chapter placement, stable IDs, objective/reward positions, existing
   completion, locale references and shared disclaimers together. Reward additions
   need an explicit decision about previously completed entries.
4. Edit authored source and regenerate through the existing tools. Build the shared
   resource JAR when translations or maintained data change. Review removals and
   update accepted mechanics fixtures only after the semantic change is understood.
5. Check native decoding, relevant negative and positive cases, progress restoration,
   rewards and repeat claims using isolated fixtures. Check representative client
   labels, descriptions, choices and language fallback when behavior or layout changes.
6. Refresh affected Atlas acquisition, interaction and runtime evidence through its
   owning pipeline. Keep authoring, generated files, the resource JAR and player
   documentation aligned. A text edit alone does not require recapturing a world.

[Dependency maintenance](patches.md) owns cross-project update boundaries and
installation order. Builds do not install files into personal instances.

## Evidence and references

The 2026-10-31 scoped pack fixture decoded all 66 entries, including the four
Traveler's Backpack entries. Native checks covered negative/positive objective
handling, NBT restoration, manual reward collection, duplicate claims and overflow.
The action advancements were granted to exercise Questlog's handlers; this is
not an in-game demonstration of the three backpack operations. Their trigger
call sites were inspected in the selected 10.1.40 JAR, including the sleep-attempt
and empty-tool-slot limits above. Existing definitions and rewards were unchanged.

The source review inspected Questlog
[`c77a41e`](https://github.com/infernalstudios/Questlog/tree/c77a41eb54e6fce28981e8d6694862863704268e)
and checked behavior against the installed 3.5.0 bytecode. The 2026-10-30 isolated
Atlas export decoded all 64 entries, exercised 118 objective leaves with negative
and positive handler inputs, granted all 20 fixed reward stacks and restored
completion/claim flags from NBT. Collection used the native reward packet; repeated
claims were rejected and a full inventory dropped the expected reward. It uses real
advancement storage because
NeoForge's ordinary fake player discards advancement progress. This checks the
journal's advancement observation, not the underlying gameplay action.

Create 6.0.10 awards pressing after `onItemPressed`, mixing after basin processing,
and fan processing through `AirCurrent`. Packaging uses `PackagerBlockEntity`.
Their `AdvancementBehaviour` records the placing player, rather than crediting
whoever happens to collect output. Power Grid 0.6.2 similarly uses its motor's
recorded player. Aeronautics 1.3.2 awards hot-air fill above one cubic metre and
nonzero small-propeller rotation to players inside a ten-block inflated block box.
Neither Aeronautics condition proves a successful flight. Exposure's frame and
print advancement criteria name the actual exposure/printing events. Vanilla
breeding and enchanting criteria supply the corresponding activity checks.

Use runtime snapshot hashes to identify exercised artifacts. Constructor/handler
checks do not establish physical input, a survival playthrough or client rendering.
Representative visual and reward-collection checks must accompany release evidence
in [Atlas verification](web/verification.md).

The following downloaded source snapshots informed the design policy. They are
examples, not dependencies or copied content, and were not played through in this
review. Retain the applicable lesson rather than accumulating pack-review reports.

| Source | Useful distinction |
| --- | --- |
| [ATM10 `827e361`](https://github.com/AllTheMods/ATM-10/tree/827e3610c356922e59412834d4b08ca5b16a6ce0/config/ftbquests/quests) | Practical cross-mod subjects alongside mod references; discovery rewards can deliberately accelerate expansion. |
| [Above and Beyond `f551e98`](https://github.com/simibubi/Above-and-Beyond/tree/f551e984ee2a11c20b9aa3d10b670d4589fa34b2/config/ftbquests/quests) | Production routes, optional utility branches and explicit self-reported automation. |
| [Liminal Industries `19929b5`](https://github.com/Appocryptha/Liminal-Industries/tree/19929b596c2251caa57f2ad25a6df60696cf2c25) | Environment-specific processing and rewards for another attempt; verify described chances against scripts. |
| [StoneBlock 4 1.24.1](https://www.curseforge.com/minecraft/modpacks/ftb-stoneblock-4/files/9282328) | Distinguish ordinary supplies from consequential world actions and gated story progression. |
| [Enigmatica 6 `edf25e0`](https://github.com/EnigmaticaModpacks/Enigmatica6/tree/edf25e0f50ce6b8ff052f7d10ff3c748bb90eafe) | Concept-oriented instruction and themed reward families; random distribution is a separate choice. |
| [Bliss `1f56661`](https://github.com/VazkiiMods/Bliss/tree/1f56661bbdbc1fd89ecad77703dbbd405ceddbd7/patchouli_books/blissguide) | Contextual discoveries tied to existing activities; presentation need not imply a material reward. |

- [Player access and current behavior](../players/journal.md)
- [Objective definitions](https://moddedmc.wiki/en/project/questlog/latest/docs/questlog/objective_types)
- [Integration findings](journal-integrations.md)
- [Atlas verification](web/verification.md)
