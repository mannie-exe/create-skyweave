# Create: Skyweave 0.10.0

Add FTB Quests and FTB Teams for the quest/team trial, inventory conveniences,
and independently replaceable product icons. Minecraft remains 1.21.1 and
NeoForge 21.1.265. Skyweave: Compatibility Patches is now 0.29.1.

- Install FTB Quests 2101.1.38, FTB Teams 2101.1.12 and FTB Library 2101.1.39.
  The FTB quest book is intentionally empty. Keep the existing Questlog entries
  available during the trial; new installations bind grave accent to FTB Quests
  and leave Questlog unbound. Existing seeded key bindings require a manual change.
- Add Mouse Tweaks 2.26.1, Inventory Profiles Next 2.2.5 and libIPN 6.6.3 on
  clients. Keep Mouse Tweaks drag/wheel interactions and manual sorting/transfers;
  disable automatic inventory rearrangement and overlapping IPN gestures.
  Enable automatic tool replacement and stack replenishment.
- Give the Compatibility Patches mod, Resource Patches mod, Visual Patches pack
  and published instance separate white placeholder PNG icons. Visual Patches
  now owns its native pack metadata rather than relying on the ZIP filename.
- Set `allow-nether=false` in the dedicated-server template. This is not a complete
  dimension-access policy: integrated-server access and portal ignition remain
  unchanged. Team island allocation, first-entry selection, the prison dimension,
  Hoofprint changes and FTB authoring migration are planned, not included.
- Update player and maintenance documentation for the trial, dependency pins,
  resource generation and private goal/evidence storage.

**No fresh world is required.** Terrain code and managed generation profiles are
unchanged from 0.9.0; generation identity remains `islands_v1-skyarch-1.4-6`.
Keep existing worlds, player progress, BlueMap tiles and Distant Horizons caches.

FTB startup alongside Questlog was checked on an isolated dedicated server.
The first-entry team chooser and shared-quest gameplay have not been implemented
or verified by this release.
