# Create Sky 0.1.29

Restrict Carry On pickup of reviewed construct joints, assembly helpers and linked
endpoints from Simulated, Absolute Kinematics, Transmission & Linkage, Linear
Bearing and Aerocables. Ordinary containers retain their existing behavior.
The targeted tag excludes 25 previously eligible block-entity types without
changing other pickup eligibility. Native checks covered machinery refusal,
ordinary container pickup and chest pickup on Sable constructs.

Rewrite 27 English Ponder passages across Transmission & Linkage's six tutorials.
Clarify target distance, Return Force, Stretch Resistance, regulator controls,
link limits and externally driven conversion bearings. Native animations and
scene timing are unchanged; the settings tutorial still points toward a head
while its corrected text directs players to the rod body.

Both changes are pack-owned resources/configuration. Create Sky Compat remains
0.13.0; dependency selections, quests, generation and LOD identities are unchanged.
No world regeneration is needed.

For existing installations, keep personal settings and add
`#createsky:carry_on_restricted` to `blacklist.forbiddenTiles` in
`config/carryon-common.toml`. This seeded file is preserved by updates. Apply the
rule to dedicated servers and clients used for single-player, then restart them.
Fresh installations include it by default.

Previous release: [0.1.28](releases/0.1.28.md).
