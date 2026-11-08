# Create: Skyweave 0.5.0

Update Skyweave: Compatibility Patches to 0.25.0 for more varied island outlines,
selective broken edges, fractured biome exteriors and probabilistic ocean habitats.
Minecraft remains 1.21.1 and NeoForge remains 21.1.265.

- Keep sparse cluster spacing, native vertical shaping and island-relative geology.
  Area-preserving elongation and seeded strength variation change horizontal outlines.
- Admit 20% of eligible ocean-biome opportunities. Lagoon and Broken Reef share
  the enabled weights; Ring and Shelf remain available but default off.
- Give Lagoons 25% coastal-outlet, 15% falling-perimeter and 60% native edge modes.
  Separate solid spires may accompany ocean anchors.
- Add configurable fractured Mushroom/Badlands alternatives and rare native-climate
  Deep Dark ecology while preserving independent interiors and ordinary city checks.
- Add the operator-only island metadata locator and reduce unnecessary native
  structure-lookup work. Find supported dry spawn ground around wet hosts.
- Keep startup/editor validation and saved-world identity protection together;
  accept released Ocean configuration files without silently rewriting their values.
- Add bounded performance-investigation guidance; no JVM tuning campaign or new
  profiling infrastructure is included.

These terrain changes require a fresh world. Existing marked saves are not converted.
Existing explicitly edited profiles remain authoritative; review them before creating
new worlds. See the world-generation guide for controls and conditional probabilities.
