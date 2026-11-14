# Create: Skyweave 0.14.0

Update Skyweave: Compatibility Patches to 0.33.0 for height-aware island climate, underground biomes and processed village support. Minecraft remains 1.21.1 and NeoForge remains 21.1.265.

- Blend ground-village foundations with the island’s original materials, preserve roads and intentional damage, and verify shallow contact after feature placement. Inhabited buildings require complete support by default. Bounded alternatives preserve family allowances; unsafe layouts can be rejected.
- Resolve underground-biome depth and temperature from actual solid, water and cavity contributors, including overlapping islands. Synchronize bounded climate context for client weather and qualified shader precipitation.
- Give special Deep Dark islands a deepslate body, coherent sculk coverage and a sheltered cavern with openings. Ordinary Ancient Cities remain independently eligible; the special island does not require or force a city.
- Repair qualified elevated-water habitat and movement, Dynamic Waters floe temperature and cached river-node heights. Keep Sable climate projection and dedicated-server water-force integration independently optional.
- Preserve the owner’s updated Create menu placement and Spyglass Improvements presentation defaults. Add the climate controls to the managed configuration register and document file ownership and the complete island-generation matrix.

This release changes saved generation identity. Create a fresh marked world for the new generation; existing structures are not moved or repaired retroactively. Installing the update does not automatically delete worlds. Update client and server together.

Native checks cover processed contacts, material provenance, bounded alternative layouts, save/reopen, reordered generation, climate publication, elevated-water behavior and optional/disabled controls. A packaged Prism client verifies both generated BSL/Colorwheel and Complementary/Euphoria shaders and integrated-world reopening. Independent source/evidence review found no blocking defect in its inspected boundaries. See [Compat verification](https://github.com/mannie-exe/skyweave-compat/blob/v0.33.0/docs/development/verification.md) for exact evidence and limits.

These checks do not certify every donor road, every modded feature writer or worldwide encounter rates. An existing Euphoria watcher can warn about an unrelated BSL output during an explicit in-process rebuild; both tested generated shaderpacks still render. No content mods are added or removed.
