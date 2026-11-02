# Pack authoring

Run `pnpm dev` and open `/authoring`. The editor reads the pack configured in
`data/local.json`; static builds have no editing endpoints. Journal, Config audit,
Resources and Source JSON share the authoring navigation. Resource authoring has its
own [guide](models.md).

## Journal

Entries, Disclaimers and Localization share one draft. Moving between them retains
edits. **Save journal** validates and saves all changed journal source files
together, including new locales. **Generate Questlog files** uses saved source and
lists both writes and deletions. Neither operation builds the resource JAR or
installs files into Minecraft.

**Entries** lists actual titles grouped and ordered by chapter. New entry creates
an English title and a one-item inventory objective in an existing chapter, with
no rewards. Edit its native conditions and properties through Definition JSON;
apply that JSON to the draft before saving. IDs stay fixed because changing them
can affect player progress. Deletion removes mechanics and all locale overrides;
references from other quests must be removed first. Generated deletion happens
only on Generate.

The text preview resolves the selected locale, including English fallback, in
Questlog section order: flavor, full requirements, description, shared disclaimer.
Short objective labels remain separate on the right. **Edit strings** opens the
entry's localized fields. The preview does not simulate game fonts or wrapping.
New or reordered objective positions need a label and prose review.

Reward authoring supports Questlog item, experience, command, loot-table, choice
and weighted-random definitions. Common rewards have dedicated fields. Nested
options, custom item components and other native properties use Reward JSON.
Unrecognized properties survive ordinary edits. Collection can be manual or
automatic. Creating authoring controls does not add rewards to existing quests.
Server commands are stored as native definitions, never executed by the web app.

## Disclaimers and localization

Disclaimers owns shared keys and their entry references. Create a key with an
English message, assign it in Entries, and edit its translations in Localization.
The usage list displays resolved entry titles. Deletion is blocked while any
locale references the key; removing an unused key removes its translations too.
Keys use lowercase letters, numbers and underscores.

Localization groups strings by chapter and shared disclaimers. Search matches
source paths, titles and resolved text. The source column edits English; another
locale shows English beside its overrides. Keys are secondary details, not the
reader-facing content. Entry title edits immediately update lists and previews.

**Manage locales** offers Minecraft's language list, with native language names,
regions and codes. Already-added locales are omitted. Choose a language to add an
empty locale; it does not create translations. Existing custom locale files remain
editable through their codes. Additional locales can be deleted. Missing
fields inherit English; **Use English** removes an override. Intentionally empty
optional flavor or description remains empty. An empty required title, requirement
or label fails validation. No translations are invented or copied silently.
English is required and cannot be deleted.

The checked-in catalogue in `web/src/lib/minecraft-locales.json` comes from the
pinned Minecraft version's vanilla `pack.mcmeta` asset. On a Minecraft update, run
`pnpm data:locales <version.json> <assets-directory>` from `web/` using an installed
vanilla or Prism version manifest and its assets directory. This reads local files,
checks the version against `empack.yml`, verifies the asset index and metadata
hashes, and records source provenance. Format the generated JSON before committing.
The picker works without Minecraft installed; it does not use operating-system
locale lists or require a game launch.

The [pack source reference](../authoring.md) owns the locale schema and native
Questlog key composition. The editor and generator consume the same chapter and
locale files. Tests round-trip CRUD and sparse translations through the actual
compiler in a temporary pack.

## Drafts and source edits

Open Activity from the shared header. Pin it beside authoring when enough width
remains; on narrow screens and dense resource/map views it opens as an overlay.
Close or Escape returns focus to the header button. Open and pin preferences last
for the browser session. It records complete actions, including validation and file writes.
Routine source reads and previews do not replace those results. Editor feedback
stays beside the relevant actions; recent outcomes remain in Activity after a
toast disappears. See [data](data.md#filesystem-boundary) for retention and polling.

An acknowledged save followed by a failed view refresh remains a successful save.
The journal retains the saved revision and any other drafts, labels generation
status unavailable, and disables further writes until source is reloaded. Reload
still asks before discarding drafts. Successful generation is likewise distinct
from refreshing its displayed comparison.

Save validates the complete source set before replacing files. Stale revisions
fail without discarding local edits. Reload asks before discarding drafts. Browser
navigation warns about unsaved changes. Unapplied JSON is retained across views
and prevents saving until applied or discarded; its disclosure lists outstanding
buffers even if their original entry was removed.

Source JSON retains advanced access to existing mechanics, defaults, locale and
configuration-register files. Apply changes to the draft, then save. Journal saves
remain coordinated; register files save individually. Entry CRUD handles linked
mechanics and string edits without a second manual migration. New chapter creation
is still a filesystem operation.

Config audit compares the categorized register with pack files. Matching hashes
are not gameplay verification. Its Check files action is scoped to that view;
there is no automatic baseline acceptance or restoration.
Questlog output status appears only in journal views and when editing journal
source files; it does not describe configuration-register or audit freshness.

## Filesystem and generation boundaries

`scripts/authoring.mjs` accepts allowlisted source paths, rejects symlinks and
traversal, stages combined source in a temporary directory and invokes named
validators. It rechecks revisions before replacement, stages writes exclusively
and rolls back ordinary replacement failures. Multi-file writes are not a
crash-atomic transaction. Do not edit the same files externally during a save.

Loopback, host, same-origin, request-size and serialized-operation restrictions
remain in the workspace middleware. Browser input cannot supply programs or shell
commands. Temporary validation files are removed after each operation.

Generation removes obsolete outputs only when they carry the journal's generated
identity. Unrelated native quests are preserved. Review the output comparison and
Git diff, then build/install the native JSON and resource JAR together through the
pack's separate build and sync procedures.

These operations do not refresh the mapper's runtime export or the saved-world
ore survey. Their respective capture/import/compile jobs remain authoritative;
changing journal copy does not imply fresh world measurements. See [data](data.md).
Only English content is currently authored. Native translation components and
reward definitions are generated, but language switching, reward claims and game
layout require a client check before shipping changed journal content.
