# Create: Skyweave 0.12.0

Add native operator Wayfinder navigation with Skyweave: Compatibility Patches
0.31.0, and protect Aeroworks controls from Carry On pickup. Minecraft remains
1.21.1 and NeoForge remains 21.1.265.

- Operators can press G or use `/skyweavecompat wayfinder` to teleport onto the
  targeted surface. DH-assisted targeting uses available LOD data without a
  configured distance cap; the server checks actual footing and body space.
- Keep accidental hotkey presses silent for players without access by default.
  Rebind through Minecraft Controls; server policy and work limits are available
  in Compat's Maps settings. A successful warp has a two-second cooldown.
- Restrict Carry On pickup of Aeroworks control desks, stands, Copycat control
  variants and joysticks, preserving their own interaction and binding behavior.

Remove the earlier Wayfinder datapack when installing the native replacement;
preserve unrelated player tags and scoreboards. No world reset or cache removal
is required. Existing quests, generation settings and player progress are retained.

Native, client and packaging qualification remain recorded in the development
verification guides. No additional content mods or terrain changes are included.
