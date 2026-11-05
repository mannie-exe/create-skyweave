# Create: Skyweave

Use **Create: Skyweave** for the modpack; **Skyweave modpack** or **the Skyweave modpack** is also acceptable in prose. Use **Skyweave: Compatibility Patches** for the independent compatibility mod. Preserve machine identities, including `create-skyweave`, `create_skyweave`, `skyweave-compat`, `skyweave_compat`, and Java package/class names. Put naming guidance in AGENTS.md; use the names directly in other documentation and interfaces.

Create: Skyweave is the playable Create/Aeronautics island modpack. Skyweave is
the separate, unfinished civilization mod; Skyweave: Compatibility Patches supplies optional adaptations. Start with `docs/README.md`; read only the
documents relevant to the task. Runtime and dependency pins live in `empack.yml`.

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
- Questlog is a bookless, optional journal. Use detectable conditions, short
  objective labels, clear descriptions and shared disclaimer IDs. Organize around
  useful capabilities and lasting roles; distinguish equipment acquired, actions
  demonstrated and suggested projects. No invented triggers or compulsory gates.
- Follow `docs/development/journal.md` for journal design and reward budgets.
  Rewards supplement useful setups or operating batches without replacing scarce
  discoveries. Budget across a route, including reward-triggered completions.
  Keep multiplayer progress personal; leave final naming and flavor to the owner.

## Work and evidence

- Inspect before editing; preserve unrelated work. Default to one agent and the
  smallest complete change. Ask only consequential questions evidence cannot settle.
- Use empack and the recorded lock; reference builds are the default. Preserve
  Minecraft pins. Verify provider metadata against exact artifacts when it conflicts.
- Keep journal sources in `authoring/journal`, configuration rationale/digests in
  `authoring/changes`, maintained resources in `pack-fixes`, and the Atlas in `web`.
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
