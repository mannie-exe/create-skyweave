# Pack authoring

Run `pnpm dev` and open `/authoring`. The editor reads the configured local pack;
static builds have no editing endpoints. Quests, Config audit, Resources and Source
JSON share the authoring navigation. [Resource authoring](models.md) has its own
workbench. The [pack guide](../authoring.md) owns source schemas and generation;
[quest design](../journal.md) owns progression and reward policy.

## Quests

Choose a chapter or search across chapters. Selecting a quest in the list or layout
opens its inspector: Text, Tasks, Rewards, Links and Preview. Text is localized;
mechanics and native IDs are shared. The canvas uses saved chapter coordinates,
with drag, zoom and fit controls. Links provides keyboard-accessible X/Y fields,
chapter membership and prerequisites, including links to quests in other chapters.
The preview resolves content; it does not simulate Minecraft fonts or task execution.

New chapter and New quest allocate native IDs once. Moving a quest keeps its IDs,
tasks, rewards and translations. Remove references before deleting a quest; move
or delete a chapter's quests before deleting the chapter. Book settings owns chapter
groups, progression and default submission/reward policies. Group deletion requires
reassigning its chapters first.

Tasks distinguish inventory detection/submission, native advancements, block
interactions and manual acknowledgement. Item alternatives use one combined count,
with an explicit item list or tag. Rewards expose native personal/team claim scope
and manual/automatic collection. JSON editors retain supported native properties;
unknown fields fail validation. Neither the inspector nor source JSON edits saved
player/team progress or executes a server command.

Quest, Shared text and Localization views share one draft. **Save quests** validates
and saves all changed quest sources together. **Generate FTB Quests files** uses
saved source and lists writes/deletions. Neither operation builds resources, refreshes
the mapper or installs into Minecraft.

## Shared text and localization

Shared text owns reusable paragraph keys and shows their references. Create a key
with English text, select it from a description paragraph and translate it in
Localization. Deletion is blocked while any locale references it. Keys use lowercase
letters, digits and underscores. Switching views does not flatten references to copies.

Localization groups object fields by chapter and shared text. Search matches keys,
titles and resolved text. English is editable source; other locales show English
beside sparse overrides. **Use English** removes an override. Arrays replace whole
paragraph arrays. An explicit empty optional description or subtitle remains empty.
English titles and referenced shared text must remain valid.

**Manage locales** uses Minecraft's language catalogue with native names, regions
and codes. Adding a locale creates an empty override file, not invented translations.
English is required; other locales can be deleted. Refresh the checked-in catalogue
with `pnpm data:locales` when the Minecraft version changes.

## Drafts, conflicts and activity

Unapplied JSON and incomplete numeric fields survive view changes and prevent saves
until applied, corrected or discarded. Reload and browser navigation warn about
unsaved changes. Source JSON exposes the same coordinated quest files and individual
configuration registers; it is not another authoring authority.

External source changes refresh a clean view without generating output. Dirty or
unapplied drafts are retained for deliberate reconciliation. An acknowledged write
followed by a failed refresh remains saved; its revision is retained, generation
status becomes unavailable and further writes wait for reload. Configuration changes
invalidate the audit; **Check files** is an explicit read-only action, not baseline
acceptance or restoration.

The shared header Activity button docks where space permits and overlays dense or
narrow views. Escape/close returns focus to the button. Activity retains operation
outcomes, committed stages and diagnostics beyond transient notifications. Reads
add no operations; explicit previews do. See [data](data.md#filesystem-boundary)
for connection, authorization and retention contracts.

## Filesystem and generation boundaries

`scripts/workspace/quests.ts` registers queries, previews, saves and generation.
Reads launch no worker. Validators use staged inputs with a trusted root. The source
repository checks allowlisted paths, symlinks, revisions and authority before
replacement. Rollback restores only bytes still owned by the failed transaction;
unresolved partial writes retain a recovery record. Multi-file writes are not
crash-atomic.

Generation stages native SNBT, locales, ownership manifest and binding policies,
then rechecks source, compiler and output revisions before publication. External
native edits cause a conflict. Only manifest-owned retired outputs can be removed.
Preview reports are immutable scoped artifacts and never install content.

The existing workspace service owns per-pack admission, WebSocket transport and
ReBAC checks. Browser input cannot supply programs, shell commands, working
directories or arbitrary paths. Owned staging is removed after its worker stops.
Runtime capture, mapper compilation, world imports and instance sync retain their
separate explicit operations. Authored text edits do not refresh world evidence.
