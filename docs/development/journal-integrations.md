# Journal integration findings

Inspected on 2026-10-22 against Questlog 3.4.1, EMI 1.1.24, JEI 19.64.0.455,
Reliable EMI 4.7.12 and Create 6.0.10 on Minecraft 1.21.1 / NeoForge.
These findings establish available APIs and source behavior, not a tested bridge.

FTB Quests is now the selected replacement. The Questlog recipe/Ponder bridge
below is legacy research, not an active implementation task. Inspect FTB's own
recipe integration before adding another adapter; existing verified Ponder scenes
remain reusable. [Quest design](journal.md) owns the current direction.

## Recipe viewer

EMI is the active item/recipe interface. The client configuration enables it, and
the client log records EMI's JEMI bridge importing JEI categories including Circuit
Assembly, Designing, Magnetizing, Chiseling, Printing and Stacking Photographs.
JEI therefore supplies integrations used through EMI; removing it would require
checking those categories individually.

Reliable EMI supplies stack groups and creative-tab organization.
`config/emixx/remi.json` enables stack groups in the index and craftables, along
with the group creation button and creative tabs. Stack groups organize related item variants; that is
distinct from grouping recipes into recipe categories.

Questlog has no built-in EMI/JEI integration in the inspected source. Its screens
are ordinary `Screen` subclasses. The installed EMI API exposes generic screen
bounds, exclusion areas and hovered-stack providers, plus `displayRecipes` and
`displayUses`. A client plugin can register `QuestlogScreen` and `QuestDetails`,
reserve their actual panel bounds and expose objective items to EMI. This is a
credible implementation route without first forking Questlog. An overlay and
clickable description actions are separate work.

Test GUI scales, compact/detail modes, search focus, scrolling, recipe hotkeys,
back navigation, stack groups and absence of the optional integration before
shipping. The narrowest initial bridge is recipe/use hotkeys on objective icons;
the full sidebar can follow after layout tests. No bridge is implemented.
See the [EMI source](https://github.com/emilyploszaj/emi/tree/1.1.24%2B1.21.1)
and [release history](https://github.com/emilyploszaj/emi/releases).

## Locales and description actions

Questlog's chapter, quest and objective names support `translatable: true`.
Descriptions accept JSON text components. The generator uses a `translate`
component for descriptions instead of the string path, which calls `getString()`
before inline parsing. Objective translation flags must be set individually,
including nested objectives.

The inspected `QuestDisplayData.parseInlineRichText` recognizes quest links and
image-hover links. `QuestDetails.mouseClicked` handles `CHANGE_PAGE` by opening
another quest. It does not route arbitrary component clicks through Minecraft's
general link/command handler. JSON components do not imply working recipe, URL,
command or Ponder buttons. Image hover support is not an embedded storyboard.

References: [quest definition documentation](https://moddedmc.wiki/en/project/questlog/latest/docs/questlog/quest_definition),
and [Questlog source at 9d5bcda](https://github.com/infernalstudios/Questlog/tree/9d5bcda0c36c2d9901cd3c5974d53044e09a4d14),
specifically `QuestDisplayData`, `ObjectiveDisplayData`, `QuestlogScreen` and
`QuestDetails`. Language switching and translated layout remain client playtests.

## Ponder

The 3D demonstration system is **Ponder**, bundled with Create. The installed
library provides `PonderUI.of(ItemStack)` and `PonderUI.of(ResourceLocation)`.
These are callable client entry points in a foundation package, not a promise
of stable compatibility across versions. Questlog has no native Ponder action.
A small bridge could open an existing item's storyboard and preserve the journal
as the return screen. Custom scenes need their own registration and scene content;
linking an item does not automatically create a demonstration for it.

Existing Create scenes are useful even without new multiblocks. Mechanical
crafter arrangements for crushing wheels, mixer/basin heat and fluid routing are
relevant to these journal routes. A pack-specific scene could explain the
Propulsion solid burner under a basin: placement, fuel and the heated recipe
condition. That should be validated against a working mixer before narration
claims production behavior. Aircraft controls and return crossings are later
candidates requiring actual flight testing.

Propulsion also provides scenes for
2x2x2 and 3x3x3 liquid-thruster assemblies. The installed 1.1.5 language resources
describe eight- and 27-block assemblies and rear fluid intake; the pack's
`multiblockThruster` configuration defines their thrust and fuel modifiers.
These are existing examples to link through a future bridge, not new scenes the
pack needs to author. Assembly and fuel behavior still need an in-game check.

The [Create Ponder guide](https://github.com/Creators-of-Create/Create/wiki/Internal---Ponder-UI)
describes the storyboard concept but predates the installed package layout.
The current API finding above comes from `javap` on Create's bundled Ponder JAR.
