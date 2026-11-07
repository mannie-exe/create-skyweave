# Create: Skyweave 0.4.0

Update Skyweave: Compatibility Patches to 0.24.0 for configurable island-cluster
structure distribution and enable existing floating ocean habitats by default.
Minecraft remains 1.21.1 and NeoForge remains 21.1.265.

- Variants share family allowances across each main island and its companions.
  Eligible terrain/biomes supply the allowance; surrounding void does not.
- Portals and ordinary/beached wrecks each share a one-per-cluster limit. Multiple
  ordinary villages remain possible, with outposts checked against final village
  anchors. Sky Villages retains its independent weighted allowance.
- Preserve native layouts, loot, temple traps, archaeology and city interior rules.
  Correct island-relative portal/igloo anchors and unsupported temple placement.
- Keep native reservation and duplicate guards isolated by generator lifetime;
  initialize vanilla rotation lookups before parallel native layout planning.
- Expose validated family rates, limits and the global multiplier in the existing
  configuration screen. Unknown/reclassified native sets retain their own rules.

This changes generation identity and requires a fresh world. Existing marked
worlds are not silently converted. Floating habitats are enabled in new pack
settings; the continuous global ocean layer remains disabled. General survival
balance and ocean progression still require playtesting. Existing player controls,
resource selections and settings remain local during normal updates.

Native checks include minimum/full installations, C2ME, configuration editing,
materialized structures, loot/traps, locate, save/reopen and generation-order
comparisons. See [world generation](development/worldgen.md) and
[structure policy](development/structures.md#cluster-discoveries) for scope.

Previous release: [0.3.1](releases/0.3.1.md).
