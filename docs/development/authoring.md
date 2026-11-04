# Pack authoring

The pack owns journal source, the configuration register and model recipes. The local Atlas app
in [`web/`](../../web/README.md) edits those files; it does not own a second copy
or install changes into Minecraft. The [editor guide](web/authoring.md) describes
the journal and disclaimer workbenches; [model authoring](web/models.md) covers
texture extrusion, UV fitting and resource-pack generation.

The [Debug World guide](debug-world.md) owns curated native displays, profile
configuration, regeneration and guarded installation. It is separate from Atlas
world-generation surveys and the playable server world.

The [shader lab](../../tools/shader-lab/README.md) owns BSL and its Colorwheel
patcher inputs. Run its builder before `empack sync` or a pack build. The playable
pack consumes the generated complete shader, not the lab's plain BSL or patcher.

## Journal source

The [journal design reference](journal.md#design-policy) owns entry purpose,
completion evidence and reward budgets. This guide owns source editing and
generation; the Atlas edits the same files and must not maintain separate rules.

| Path | Content |
| --- | --- |
| `authoring/journal/chapters/*.json` | Native chapter properties and quest mechanics, split by chapter |
| `authoring/journal/defaults.json` | Shared native display properties |
| `authoring/journal/locales/<locale>.json` | Chapter names, entry text, shared disclaimers and short objective labels |
| `overrides/common/config/questlog/` | Generated native chapters and quests |
| `pack-fixes/assets/create_skyweave/lang/` | Generated Minecraft language resources |

Each locale entry has `title`, optional `flavor`, full `requirements`, a
`description` paragraph array, a shared `disclaimer` key or null, and `labels`.
The description renders flavor, requirements, description paragraphs and
disclaimer in that order, separated by blank lines. Flavor is currently empty.
Descriptions normally contain one to five paragraphs of two or three sentences.
An empty array marks unfinished explanatory text and is allowed during authoring;
the editor counts those entries. Sentence counts are editorial guidance.

Each locale's `shared` object maps disclaimer keys to nonempty messages. Entries
reference those keys through `disclaimer`; they do not own copies of the text.
Shared messages can serve multiple entries. Keep similar interaction messages
separate when they describe different completion checks.

The app's **Disclaimers** tab creates, edits and deletes these shared messages.
Keys use lowercase letters, numbers and underscores. The editor keeps existing
keys fixed and lists referring entries; reassign those entries before deletion.
The generator rejects invalid keys, blank messages and missing references, including
edits made through Source JSON or external tools. Messages and references resolve through the selected locale. Missing overrides
inherit English; editing English does not overwrite authored translations.

`requirements` here is prose in the **left-hand description**. It does not change
native Questlog's `requirements` array, which controls unlocking. `labels` owns
the short **right-hand objective labels**, indexed by stable objective positions
such as `0` and `0.1`. Full conditions and caveats belong in the left-hand text.
The preview shows section order, not Minecraft's exact font width or truncation.

Keep locale IDs aligned with Minecraft, for example `en_us` and `de_de`. English
is required and owns the complete set of chapter/entry IDs and objective labels.
Additional schema-1 locales can contain sparse `shared`, `chapters` and `entries`
overrides. Missing fields inherit English recursively; arrays such as description
paragraphs replace the complete English array. Explicit empty optional fields do
not inherit. Unknown keys and invalid resolved text fail compilation.

The Atlas creates sparse locales and maintains entry IDs across mechanics and
translations when adding or deleting entries. Existing complete locale files
remain valid. Native keys are derived from stable chapter/entry IDs:
`create_skyweave.journal.<chapter>.<entry>.title`, `.description`, and `.objective.<position>`.
The description key composes the authored sections and resolved disclaimer.
Additional languages receive full resolved output, so mixed translated/fallback
sections agree with the editor preview. Chapter names use
`create_skyweave.journal.chapter.<chapter>`.

Generated descriptions use JSON translation components to retain client-side
locale selection. Inline Markdown-like Questlog links are not parsed inside
these translated strings. Recipe/Ponder actions are not supported by the
generator. See [integration findings](journal-integrations.md) before adding them.

## Save, generate and build

The Atlas **Pack authoring** page edits source files on the configured local pack.
Save validates all journal source and register structure in a temporary directory
before replacing the coordinated changed files. Ordinary replacement failures
roll back; the batch is not crash-atomic. It refuses stale revisions and preserves the
editor's unsaved text on failure. Generation uses saved source only and checks
that its revision still matches. Neither action touches instances or worlds.

From the pack root:

```sh
python3 scripts/generate-journal.py --preview
python3 scripts/generate-journal.py
python3 scripts/generate-journal.py --check
python3 scripts/audit-changes.py
python3 -m unittest discover -s tests -v
python3 scripts/build-fixes.py
```

Generated JSON and exact `managed` policies in `empack.bindings.yml` stay in Git
for review. Generation updates policies for current definitions and removes policies
for retired pack-owned definitions; unrelated configuration retains its policy.
Run `empack sync --materialize` after policy changes before building releases.
The resource JAR is rebuilt and ignored.
The build refuses stale journal output. The preview lists removed quest or locale outputs. Generate removes obsolete
files bearing the journal identity; unrelated native quests are preserved.
Review quest IDs, objective and reward order, locale references and existing
progress before removing or changing mechanics. A category move must not silently
rename saved quests. Adding rewards to completed entries needs an explicit policy
for existing players. Follow the [update checks](journal.md#update-checks).
The regression fixture records the accepted mechanics baseline; deliberate
mechanics changes require a reviewed update to that fixture after inspecting the
semantic diff, not merely to make a failing comparison pass.

Install native quest JSON and the rebuilt resource JAR together during an explicit
instance update. Client translations require the JAR. A successful source build
does not verify language switching, game layout or quest progress in a client.

## Configuration register

`authoring/changes/*.json` separates client, shaders, worldgen, structures, recipes,
drops, journal and gameplay. Each record identifies an authored file, its accepted
SHA-256, review status, reason and owning reference. `baseline` records the initial
source revision. A matching hash establishes file equality, not gameplay validity
or equality with upstream defaults. `inherited` means individual settings still
need review; `reviewed` can cover a specific change within a larger inherited file.

The checker reports drift, missing files and files absent from the register.
It covers distributed client/common config, shader settings, client options,
resource recipes/tags/drops and the server properties template. Generated journal
files have their own semantic check. Dependency selection, live-instance settings,
worlds, LOD caches and private seeds are outside this register. The structures
register covers the Sky Villages integration; broader density tuning remains
deferred. See [structures](structures.md).

The checker is read-only. It does not restore files, generate arbitrary mod
configuration, or accept new hashes automatically. Whole-file hashing is sensitive
to formatting; Git diffs and the owning document explain the actual setting change.

## Update reconciliation

1. Run the audit before an update and retain the Git revision being compared.
2. Compare changed mod defaults and schemas with the authored config. A matching
   pack hash cannot establish that an upgraded mod still recognizes a setting.
3. Edit the smallest relevant file. For a recipe, edit its maintained resource;
   for a quest, edit mechanics or locale source rather than generated JSON.
4. Update the owning rationale and register digest only after reviewing the diff.
   Keep unrelated inherited keys distinguishable from deliberate tuning.
5. Generate, run checks and inspect the resulting exports. Test affected behavior
   in an isolated instance when source checks cannot establish it.
6. Commit the source, generated journal files and rationale together. Schedule
   installation separately, preserving worlds and player progress.

This provides repeatable journal output and traceable config decisions. General
config generation, automatic upstream merges and an in-browser diff editor remain
outside the current implementation.
