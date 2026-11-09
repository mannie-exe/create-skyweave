# Prison dimension

The prison is accepted planned Create: Skyweave content. Its generator, entry/exit structures and presentation are not implemented. Nether access closure is a separate policy owned by [team/world progress](team-world-progress.md#dimension-access-policy); retaining a registered but inaccessible Nether does not implement this dimension.

## Experience

Build a largely unmodifiable, apparently endless prison of corridors and liminal rooms. Use doctor4t's environmental work, Backrooms offices/pools and Dimensional Doors' older Limbo sky/effects as references, not a requirement to install or copy those mods. Begin with atmosphere, generation, lighting and restrained camera/shader effects. No new mobs or combat encounters are requested.

Exploration provides compressed travel between Overworld island clusters. There is no arbitrary exit or player-built portal: generated return structures provide the normal way out. Death deliberately returns the player to a valid personal bed or team-island fallback. Preserve existing YiGD inventory/grave behavior and permit its intended recovery interactions; do not invent a new death penalty or keep-inventory policy.

## Geography and exits

Use a dedicated dimension ID rather than changing `minecraft:the_nether`. Bind prison macrocells to accepted Overworld cluster cells. A provisional 1:8 scale maps the present 2,400-block lattice to approximately 300-block prison intervals; the scale remains a tuning proposal.

Actual activation, jitter, clearance rejection and saved generation identity determine whether a destination exists. Active return structures lead to a validated generated landing. Missing/rejected destinations may have damaged or inactive counterparts. Planned metadata is not proof of saved terrain or a safe landing, and the scale alone does not establish teleport behavior.

Room/corridor connectivity must be deterministic across chunk boundaries and provide meaningful routes between return structures. Keep layout generation independent of player visitation order and runtime island searching. Entry method, structure distribution and room variants still need design; no portal-ignition effect is enabled by documenting a future hook.

## Protection and presentation

Protection is server-authoritative and dimension-scoped. Restrict normal breaking and placing while allowing the chosen return and grave interactions. Review explosions, fluids, machinery, Sable assembly, modded tools and teleport facilities; Adventure mode alone does not establish immutability. Arrival, death, relog and disconnect recovery must not leave an invalid player position.

Custom sky/fog effects and shader-lab mappings must target the prison ID explicitly. Shader-off clients need coherent navigation and atmosphere. Provide reduced-motion controls for camera effects. Impossible spaces, view-through portals and non-Euclidean rendering are separate optional renderer work, not prerequisites for the first dimension implementation.

Keep new content generation/assets separate from Compat's small spawn/access policies, whether it eventually ships as a dedicated module or an optional world pack. The initial implementation should prove one connected region, working entry/return, protection, death/grave behavior and save/reopen before expanding room variety.
