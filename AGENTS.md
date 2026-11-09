# Create: Skyweave

Use **Create: Skyweave** for the modpack; **Skyweave modpack** or **the Skyweave modpack** is also acceptable in prose. **Skyweave** is the separate civilization mod. Follow the naming and artifact identity rules below; put naming guidance in AGENTS.md and use the names directly in other documentation and interfaces.

Create: Skyweave is the playable Create/Aeronautics island modpack. Skyweave is
the separate, unfinished civilization mod; Skyweave: Compatibility Patches supplies optional adaptations. Start with `docs/README.md`; read only the
documents relevant to the task. Runtime and dependency pins live in `empack.yml`.

## Naming and artifact identity

This table owns the shared naming policy. Canonical slugs apply to new or explicitly authorized renamed identities; they do not establish that existing files, mod IDs, or selections have already changed.

| Display name | Canonical slug | Artifact and responsibility |
| --- | --- | --- |
| Create: Skyweave | `create-skyweave` | Playable modpack; preserve the `create_skyweave` namespace |
| Skyweave: Compatibility Patches | `skyweave-compat` | Executable optional adaptations; mod ID `skyweave_compat` |
| Skyweave: Resource Patches | `skyweave-resource-patches` | Shared resource-only JAR: gameplay data and supporting assets, including translations; mod ID `skyweave_resource_patches` |
| Skyweave: Visual Patches | `skyweave-visual-patches` | Client resource-pack ZIP: selected/composited models, textures, and animation resources; no mod ID |

Use kebab-case for slugs, dependency keys, and artifact basenames; use underscores where Minecraft/NeoForge identifiers require them. Published filenames use `<slug>-<version>.jar` or `.zip`. Repository-local shared source may use `resource-patches/`; keep visual inputs with their existing authoring owners, with `authoring/visual-patches.json` as the visual build definition. Builder names are `build-resource-patches.py` for the JAR and `build-visual-patches.py` for the ZIP. The word “resource” alone must not imply executable code; both artifacts contain resources, while Compatibility Patches owns runtime hooks.

For an authorized rename:

- Inspect actual source paths, metadata, and outputs first. Preserve established machine identities, Java packages/classes, registry/resource IDs, and saved-world/configuration identities unless their change is explicitly in scope. Do not rename foreign namespaces or unrelated modpack content to match an artifact's branding.
- Update source/build definitions, scripts, CI, empack selections/lock, metadata/dependency references, generated provenance, credits, Atlas labels/links, documentation, and relevant checks together. Trace consumers before moving a source or reusing a name. When reusing a builder filename, move its previous producer and consumers first; one builder name must not ambiguously identify both artifacts.
- Handle installed identity separately from display text. A mod ID rename can affect dependency/loading references; a resource-pack filename rename affects Minecraft's saved pack selection. Validate load order and remove superseded managed outputs through the owning build/sync process without installing duplicates, losing user selections, or editing personal instances implicitly.
- Regenerate derived outputs and verify archive contents, sides, priority, references, and affected runtime behavior. Retain one owner per naming rule and link to it from sibling AGENTS.md files. Record rename-specific history privately; maintained docs describe current behavior and maintenance procedures. Naming approval alone is not authorization to publish, sync, or rename unrelated identities.

## Direction

- Make geography, resources, production and travel work together. Evaluate useful
  outward and return journeys, cargo, fuel and repeated use, not just first unlocks.
- Give earlier technologies lasting roles. Prefer natural resource constraints
  and meaningful alternatives over arbitrary recipes, gates or mandatory steps.
- Use the Atlas to trace acquisition, quantities, overlaps and missing links.
  A graph route or inventory objective does not prove a working production chain.
- Airships should support machinery and transport as well as personal travel.
  Existing mods must earn their place through supported, tested interactions.
- Borrow Skyweave's vision without claiming simulated economies or contextual
  NPC behavior that the pack does not implement. Automated Logistics is deferred:
  future Skyweave should own routes/services and civilization authority.
- Sky Villages is the selected settlement candidate, not Create: Sky Village.
  Review placement, loot, salvage and delivery access together. Broader structure
  tuning, including Structures Arise, remains a separate pass.
- Keep automatic Hostile Skies raids disabled pending deliberate encounter design.
- FTB Quests and FTB Teams are the selected quest/team direction; retain Questlog
  during the trial without maintaining two authoring systems. Organize non-linear
  chapters around capability expansion and actual progression across mods.
  Distinguish equipment acquired, actions demonstrated and suggested projects;
  do not invent triggers or impose arbitrary chapter/recipe gates.
- Follow `docs/development/journal.md` for journal design and reward budgets.
  Rewards supplement useful setups or operating batches without replacing scarce
  discoveries. Budget across a route, including reward-triggered completions.
  Separate team completion, personal/team rewards and server-wide milestones;
  leave final naming and flavor to the owner. Follow the accepted spawn, dimension
  access and prison-content direction in `docs/development/team-world-progress.md`
  and `docs/development/prison.md`; planned behavior is not an implemented claim.
  Custom team spawning/onboarding and home/progress-reset policies are deferred;
  team-independent initial spawn recovery onto a nearby secondary island remains in scope.

## Work and evidence

- Inspect before editing; preserve unrelated work. Default to one agent and the
  smallest complete change. Ask only consequential questions evidence cannot settle.
- Use empack and the recorded lock; reference builds are the default. Preserve
  Minecraft pins. Verify provider metadata against exact artifacts when it conflicts.
- Keep quest sources in `authoring/quests`, configuration rationale/digests in
  `authoring/changes`, maintained resources in `resource-patches`, and the Atlas in `web`.
  Regenerate derived content through its owning scripts rather than editing copies.
- Keep static resource/data changes in pack-owned sources and generators;
  distinguish the resource-only JAR from the visual patch resource pack. Runtime
  geometry, framebuffer and terrain hooks belong to their independent mods.
  Review source versions, generated outputs, attribution and removal conditions
  together when updating a patched dependency. Do not silently edit downloaded packs.
- Prefer vanilla-compatible visuals across vanilla and modded content. Inspect
  model inheritance, UVs, animations and renderer ownership before adding overrides.
  Reuse the generated Debug World and existing harness for visual checks; ask before taking
  desktop focus. Preserve the useful fixture, clean up disposable runs, and report
  source inspection separately from what was actually seen in game.
- Verify builds and relevant runtime behavior. Separate inspection, automated
  checks and actual gameplay; report untested compatibility and progression claims.
- Sync instances only when authorized and stopped. Preserve worlds, seeds, LODs,
  player settings and access lists. Permission to inspect or sync is not permission
  to regenerate a world. Keep test worlds and downloads disposable.
- World resets and pregen are task-specific operations, not release defaults.
  After an authorized pregen starts, leave it running without progress polling
  unless a failure is observed or the user asks. Refresh Atlas world evidence from
  the resulting saved world when requested; DH cache data is not a world save.
- Keep existing backups and the preserved empack findings report. Remove temporary
  runs, logs and experiments after incorporating useful evidence into owning docs.
- Goals may remain conversation-only. When saving private goals or supporting
  design documents as files, use each repository's `.git/goals/`; keep retained
  captures and verification evidence in `.git/captures/`.
  Write there directly or consolidate during cleanup; keep goals flat and evidence
  shallow, grouping related captures/runs only when useful. Use file timestamps
  for recency and separate archives for exceptional historical material. Remove
  disposable builds, downloads, runtimes and logs after retaining useful evidence;
  update moved references and never alter Git internals during cleanup.
- Do not commit, push or release without authorization. Never commit credentials,
  worlds, third-party JARs or decompiled sources.

## Writing and commits

Use direct, concise language without marketing or repeated page introductions.
Player guides own usage; development docs own decisions and evidence. Rewrite the
owning document instead of accumulating review reports. Group by purpose; omit
incidental migration history and per-edit commentary. Keep the authoring UI
editable, organized by domain, and aligned with the existing component conventions.

Use a conventional commit subject, a blank line, then relevant
`- [tag]: message` bullets. Bullet messages are
at most 40 characters, have no final period, and use lowercase except proper nouns
and initialisms. Scale detail to the change; do not pad small commits to 15 to 30 bullets.
