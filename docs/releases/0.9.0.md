# Create: Skyweave 0.9.0

Update Skyweave: Compatibility Patches to 0.29.0 for construct picking, closer
floating villages, coherent ocean-fragment materials and clearer discovery.
Minecraft remains 1.21.1 and NeoForge 21.1.265.

- Repair the Macaw/Sable picking interaction that could freeze rendering after
  assembling a platform. The optional adaptation defaults on.
- Keep Sky Villages 64–128 blocks from a substantial host body, measured from
  their final footprint. Preserve exact overlap rejection and existing allowances.
- Paint dry Lagoon fragments with sandy shore materials and Broken Reef fragments
  with their exposed native rock palette. Water membership remains separate.
- Set ordinary-village and mansion targets to 0.889 and 0.32 opportunities per 1024
  eligible terrain chunks. Retain family caps, biome/fit checks and intentional
  ruin variants; these values are not per-island probabilities.
- Use independent `shoreline=` and `fringe=` island filters. Island and structure
  commands provide consistent progress, paging and empty/partial-result feedback.
- Use canonical `outline`, `fringe` and `fractures` shape groups. Atlas reads use
  current authorized manifests and reject retired configuration/world inputs.

**Create a fresh Skyweave world.** Generation identity is
`islands_v1-skyarch-1.4-6`; existing saves are not silently converted. Apply the
updated managed profiles; custom profiles must supply their canonical fields.
Island spacing, accepted geometry, HIGH river density and approved coastal
Lagoon settings retain their existing values.

Broad vanilla `/locate` remains synchronous; use `/skyweavecompat structures`
for bounded searches. Native checks and limits are recorded in
[Compat verification](https://github.com/mannie-exe/skyweave-compat/blob/v0.29.0/docs/development/verification.md).
