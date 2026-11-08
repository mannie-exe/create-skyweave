# Create: Skyweave 0.6.0

Update Skyweave: Compatibility Patches to 0.26.0 and add Dynamic Waters 13.1.0.
Minecraft remains 1.21.1 and NeoForge remains 21.1.265.

- Add shorter, uneven granular island edges with varied fragments that shrink
  and thin outward. Mixed remains the ordinary profile; Disintegrating adds
  broader breakup around an intact core. Existing spacing and geology remain.
- Replace this preset's native Sky Archipelago rivers/lakes with supported
  Dynamic Waters mountain rivers, basin lakes and edge falls. Keep continental
  density rewriting and mountain tunnels off. Native ocean habitats remain.
- Increase Deep Dark selection to 10% of eligible native underground hosts.
  An island profile does not guarantee an Ancient City.
- Align island temperature-sensitive weather and Iris precipitation at reference
  Y64, map native clouds to Y469.3333, and remove height-triggered native void
  darkening in marked worlds.
- Generate the versioned Skyweave 0.2.0 environment corrections with the existing
  Complementary/Euphoria and BSL/Colorwheel shader chains. Glass material policy
  remains Skyweave Glass 0.1.0. Original inputs stay outside Iris's shader list.
- Continue bounded island locator searches automatically, with concise progress,
  cancellation and clickable results. Add typed water settings and protect live
  singleplayer generation from registered config saves.

**Create a fresh world for these terrain changes.** Existing marked worlds are
not converted. Main shape, water and profile controls remain editable for future
experiments; changing generation inputs can require another fresh world.

Native checks cover generated water and fluid ticks, reopening, remote-client
flow/reconnection, conservative fragment bounds, the four land archetypes,
climate/environment controls and optional loading. A bounded Sable current test
is not a certification of every vessel or machine. Unknown shaders and Photon
on unsupported Apple hardware retain their existing limitations.
