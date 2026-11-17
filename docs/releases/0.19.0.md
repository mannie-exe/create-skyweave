# Create: Skyweave 0.19.0

Update Skyweave: Compatibility Patches to 0.38.0 for final-shape Copycat glass and material contacts. Minecraft remains 1.21.1; NeoForge remains 21.1.265.

- Correct two-sided glass after native Create/Copycats+ crop, rotation, part assembly and culling. Keep connected textures, native layers and original vertex attributes.
- Separate touching ordinary/Copycat and supported multi-material surfaces without introducing early internal sheets. Preserve the existing pane-seam correction and intentional native two-sided/one-way artwork.
- Enable independent Create and Copycats+ glass adapters by default, with explicit opt-outs. Pack-owned mosaic support uses a reloadable, exact registered-ID profile through Resource Patches.
- Prefer Copycats+ for ordinary shapes by hiding Connected's duplicate category. Preserve registered blocks, native saved-block migration and nine one-to-one item conversions. Keep Create panel/step, specialized forms and all Simulated physics variants; copied materials gain no new physical properties.
- Keep the playable and shader-lab pins on the same verified public Compat binary. Qualified static scenes cover shaders off, Complementary/Euphoria and BSL; moving Sable/contraption rendering is not newly qualified by this repair.
- Update reference launchers to empack 0.8.6-beta, which handles Prism's first-launch component saves without a manual retry or profile repair.

Generation identity remains `islands_v1-skyarch-1.4-17`, with watersheds `island_watersheds_v7`. No world reset is required. Client/server distance defaults and JVM policies are unchanged. See [Compat verification](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/verification.md#cohesive-transparency-0380) for exact native coverage and limits.
