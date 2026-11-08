# Create: Skyweave 0.8.0

Update Skyweave: Compatibility Patches to 0.28.0 for river continuity, local
outlets, water-biome freezing and safer structure discovery. Minecraft remains
1.21.1 and NeoForge remains 21.1.265.

- Preserve supported river beds across NOISE and HOLLOW interiors without filling
  the void. Rivers terminate at island rims or actual water connections rather
  than a fictitious global sea-level mouth. Keep Dynamic Waters density HIGH.
- Correct warm water freezing beneath a neighboring cold-air biome while keeping
  genuine cold terrain, snow and ice.
- Vary skylight outlines by seed, opening selected HOLLOW roofs into their
  cavities. NOISE skylights default off; existing side passages remain available.
- Disable falling-perimeter lagoon selection. Admitted lagoons retain the existing
  25% coastal/open-cove treatment and 75% native treatment.
- Add the operator command `/skyweavecompat structures search <radius> family=villages`
  or `structure=<id|#tag>`, with automatic bounded continuation, progress, pages
  and cancellation. Results identify real structure starts and suggest teleports.
  Vanilla `/locate` retains its synchronous behavior.
- Include validated structure-search limits and skylight controls in the existing
  World generation → Sky Archipelago settings, with authored defaults under
  `config/skyweave/`.

**Create a fresh world.** Terrain/drainage identities changed; existing marked
worlds are not silently reinterpreted. Bounded structure searches can save early
chunk metadata, and partial results do not establish absence or the nearest match.
Unsupported placement types and historical starts without current placement grids
remain explicitly outside the command's supported search domain.

Client view12/simulation10 and server view16/simulation12 remain unchanged.
