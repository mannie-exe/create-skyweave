# Create: Skyweave 0.21.0

Update the selected Minecraft 1.21.1 dependencies and pair them with Skyweave: Compatibility Patches 0.40.0. See the [content list](MODLIST.md) for exact pins.

- Rebase Complementary and Euphoria to r5.10 and 1.11.1. Keep Skyweave's window material, sky environment and DH shadow adjustments. Shader-lab carries forward a valid generated preset and keeps the other two shader recipes available.
- Update Create Radars to 5.1.1. Recreate links authored before 5.1 if their order changed. The legacy T-Pitch block has been removed upstream. The pack keeps only the malformed directional-jammer recipe repair.
- Give Redstone Additions 1.0.6 ownership of gate placement and updates, wrench rotation, copper scraping, drops and inverter models. Compat retains the Crossroad signal scope correction.
- Use Curios 9.6.0 with a temporary Compat bridge for Accessories. It preserves equipment slot assignments through world loading and datapack reload.
- Carry forward the Modefite, held-item, resource-option and chain fixes. Add Artifacts with its authored presentation and use Visual Workbench with the selected workstation accessories.
- Add client-only Flashback and CMDCam recording tools. See the [filming guide](players/filming.md).
- Use 12 GiB maximum-heap defaults for fresh client and server installs. An existing server's JVM arguments remain operator-owned. Use 12 GiB system memory at minimum and leave headroom beyond the configured heap for the operating system and native memory.

Generation remains `islands_v1-skyarch-1.4-17` with `island_watersheds_v7`. Dynamic Waters remains on 13.1.0.
