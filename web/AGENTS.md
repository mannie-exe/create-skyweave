# Create: Skyweave Atlas

Maintain the internal Create Skyweave progression map. Start with `../docs/development/web/README.md` and
read only the setup, data or verification sections needed for the task.

## Boundaries

- Authored YAML owns interpretation and scenarios; runtime exports own observed
  registered content. Generated projections are rebuildable, not editable authority.
- Keep assumptions, source inspection and runtime verification distinct.
  Potential reachability does not establish resource budgets or playability.
- Keep Minecraft instances and worlds read-only during routine app work.
  Publishing, applying recipe patches and syncing instances require task authorization.
- Keep extracted assets, third-party binaries, private paths, worlds and logs out
  of version control. The exporter stays in the disposable audit server.
- Preserve unrelated workspace changes. Do not treat the current uncommitted tree
  as disposable bootstrap output.

## Architecture and authoring

Keep Astro pages and shared layouts; use React islands for interactive workbenches
and React Flow views. Reuse components, recipe adapters and semantic style tokens
before adding variants. Keep item slots fixed in proportion, labels outside them,
and input/output layouts usable at narrow widths. Graph views need usable detail,
navigation and a minimap without mounting every recipe editor at once.

Run authoring through named, allowlisted jobs with bounded inputs, output and
concurrency. Do not add arbitrary shell/Python execution or filesystem access.
Keep source editing, generation, snapshot refresh and instance sync distinct.
Refresh triggers are sufficient unless evidence warrants a live state system.

Journal mechanics, locale prose and keyed disclaimers have separate owners.
Preserve the distinction between left-hand requirements and short right-hand
objective labels. Preview flavor, requirements, description and disclaimer in that
order; optional flavor must not obscure detectable completion conditions.

Show source, uncertainty and missing coverage where they help decisions. Recipe
diagrams represent exported data, not simulated game GUIs; do not imply that a
placeholder output proves dynamic crafting behavior. Keep controls and prose
direct, without introductory marketing sections.

## Interface design

Improve one interaction at a time. Use working previews and user discussion to
approve substantial visual changes; references inform decisions, not approval.
Balance content and whitespace before adding containers, decoration or copy.

Reuse shared UI across Astro, React and DOM consumers. Express spacing, alignment,
typography and action states through semantic roles and composition. Derive values
where meaning permits; equal values alone do not justify merging distinct roles.
Recheck other consumers when extracting components, and remove superseded styles.
Destructive actions must remain distinguishable beyond color alone.

Icons must earn their space through recognition, orientation or interaction.
Prefer Material Symbols for interface icons, with consistent outlined/filled
variants for meaningful distinctions. Evaluate exceptions deliberately; do not
mix families casually or decorate every label. Share sizing and treatment through
components/tokens, retain accessible action names, and keep game imagery separate.

Keep drafts, saved files, generated output and displayed snapshots distinguishable.
Preserve edits on errors or stale-source conflicts. Place actionable feedback near
its owner; transient notifications must not be the only record of failures or jobs.
Use the game's versioned locale catalogue for language choices, readable text in
editors, and shared keyed messages rather than duplicated prose.

## Verification

Run `pnpm verify` for application changes and `pnpm test:python` for Python changes.
Use browser tests for interaction changes. Runtime exporter or adapter changes need
relevant snapshot checks; a static build does not validate game behavior.
Record commands, tested source or artifact identifiers, and limitations in
`../docs/development/web/verification.md`. Do not rerun expensive world scans for prose edits.

## Documentation

Follow the inherent.design prose reference when available. Web guides live in
`../docs/development/web/`; pack schemas and release procedures stay in the parent
development guides.
Use direct prose and a single owner for each topic. README owns the entry point;
setup owns commands; data owns implementation and authority; usage owns controls;
verification owns dated evidence. Link between them instead of duplicating contracts.
Consolidate completed reviews into these documents and remove temporary reports.
Keep maintained tests and source tooling; remove disposable run output after checks.
