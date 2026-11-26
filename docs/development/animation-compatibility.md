# Animation and model compatibility

Review the rendered actor and action before choosing a repair. Geometry, textures, animation playback and gameplay are separate owners. Exact versions remain in `empack.yml` and `empack.lock`; [patch maintenance](patches.md#player-animation-ownership) owns the current adapters and their update tests.

## Renderer ownership

| Concern | Current owner | Qualification boundary |
| --- | --- | --- |
| First-person hands and held-item animation | Punchy! and selected item resource profiles | Grip, item mesh, arm transforms, custom model parts and action handoff |
| Third-person player animation | Punchy! Moves and Fluid & Foolish | Player rig, item attachments, armor, cape, camera and observer presentation |
| Cape/body-contact behavior | Touch’n Motion through the optional Compat bridge | Native pose-copy and render order; retain one cape authority |
| Fresh mob geometry and animation expressions | Fresh Animations/Details interpreted by EMF | Effective entity model, named parts, expressions and actual mob states |
| Entity textures and variants | ETF plus selected textures/properties | Variant selection, blinking, emissive layers and shader behavior |
| Lootr chest/barrel presentation | Lootr: Styled with native Lootr materials/state and supported effective vanilla/Fresh inputs | Independent model/artwork profiles, resource reload and native opening/closing playback |
| Combat outcomes and permitted attacks | Native game and Better Combat | Weapon profiles, server admission, and the timing of accepted attacks |

[EMF](https://modrinth.com/mod/entity-model-features) interprets OptiFine Custom Entity Model resources, including the model hierarchy and animation expressions used by [Fresh Animations](https://modrinth.com/resourcepack/fresh-animations). JEM models can reference shared JPM parts. EMF requires [ETF](https://modrinth.com/mod/entitytexturefeatures) for shared configuration and texture/model-variant support. ETF handles texture features such as random/conditional variants, emissive textures and blinking; it is not a replacement skeleton animator. These client resources do not themselves replace mob AI, server hitboxes or attack mechanics.

Moves' player animation path is distinct from these mob models. The pinned `LivingEntityRenderer` hook checks for a client player and player model before acquiring its pose; sharing a native renderer class does not mean every living mob receives that pose. When a mob looks wrong, record its entity ID, effective renderer/model, selected packs and state before attributing it to Moves. Player equipment and attached objects still cross multiple rendering layers and need their own checks.

[GeckoLib](https://github.com/bernie-g/geckolib/wiki) supplies a different model/controller system for mods that adopt it. Its bone geometry and keyframe animations do not become CEM merely because both systems animate entities. Installing GeckoLib alone does not restyle vanilla mobs, and a shared library does not guarantee matching proportions, timing or artistic quality. Evaluate new mobs against the selected visual style while retaining their native controller and gameplay integration. A vanilla animation replacement such as [Better Animations Collection](https://modrinth.com/mod/better-animations-collection) is another candidate renderer/model owner, not an automatic additive layer over Fresh. Compare overlapping species separately before selecting a combination.

Content searches include ordinary gameplay and content mods that could be adapted to this FA-based pack, not only projects marketed as animation mods. Evaluate existing compatibility packs, CEM/texture adapters for vanilla-derived variants, equipment/attachment patches and bounded renderer bridges. Retain a custom animation engine when it already supplies suitable motion; converting every rig to CEM is not the goal. Record the adaptation needed, licensing, tested states, maintenance cost and unhandled content before recommending a mod. Separate those integration prospects from candidates that already work unchanged.

## Item models and placement

A resource-pack model change does not automatically require a Punchy patch. Ordinary items can continue through the native baked model and its display transforms. Check the effective mesh, origin, dimensions and context first: an unchanged grip can become unsuitable when a replacement handle or silhouette moves.

Three paths require different work:

- **Native item model:** preserve GUI, ground, fixed and both first/third-person display contexts. Fit the actual grip through the smallest appropriate display or item-specific profile. Avoid changing shared parent transforms to repair one item.
- **Punchy model part:** a separate definition can replace the ordinary held mesh. Changing the block or item JSON may therefore leave the visible first-person object unchanged. Review definition matching, geometry, texture/bone bindings, particles, animation and fallback together. A selectable alternative must suppress the competing definition when necessary.
- **Custom item renderer or action:** a block-entity item renderer, carried block, assembled machine, map, shield, bow or other special-use item may need lifecycle/API coordination beyond offsets. A static profile cannot repair duplicate render calls, lost use actions or incorrect render-pass ownership.

First-person tuning is not proof of third-person attachment correctness. Review left/right handedness, both equipment slots, the local player and an observing player where relevant. Distinguish native item display transforms from Punchy's additional item/arm tuning and Moves' player bone attachment. Do not copy one numeric offset or scale across these coordinate frames without checking the actual composition. Include armor, Accessories/backpacks and carried contents when the item exposes them.

Keep static pack-specific bindings in the visual authoring/build sources, with exact input pins, attribution and removal conditions. [Punchy's compatibility rules](https://wiki.punchymod.com/punchy/compat-rules) and [model-part reference](https://wiki.punchymod.com/punchy/model-parts) describe the resource interfaces; validate the pinned implementation before adopting fields from newer documentation. Use the existing [held-item generator](patches.md#held-item-resources) and authoring tools rather than patching installed ZIPs. Runtime adapters belong in Compat with independent startup gates, supported versions, absence controls and dedicated-server isolation.

The selected Refined Tools/Modefite bow and Punchy nocking animation use Compat's optional `punchy.modefite_bow_handoff`. It defaults on for the admitted client providers and gates the bow's arrow mesh using the active Punchy animation event. Punchy's local held-item renderer requests third-person display transforms, so display context alone cannot identify this first-person draw. Preserve ordinary observer, inventory, dropped-item, charge, and projectile behavior; do not remove the arrow from every bow model. Requalify both hands, actual draw timing, interruption, exclusions, reload, and provider/OFF fallbacks using the [adapter contract](https://github.com/mannie-exe/skyweave-compat/blob/v0.43.3/docs/development/adapters.md#bow-mesh-handoff). The separate Refined Tools/EMF projectile resource repair remains necessary for arrow-entity geometry.

## Review and maintenance

For a new item family, compare an unchanged native control and the proposed resource/profile under identical conditions. Cover inventory, ground, item frame, both hands, first/third person, idle, movement and its actual use/placement action. For mobs, include representative idle, walking, attack, hurt, death, juvenile and equipped/variant states where supported. Check resource reload and representative shader-off/on rendering. Loading a model or counting files does not establish correct motion or interaction.

Record exact source/artifact identities, winning resources, tested states, screenshots and remaining gaps. Preserve pack option preferences across updates; test the real menu save/reload path as well as direct resource evaluation. Blacklist an item only after a specific unsupported path is identified, and retain the reason and removal check. Do not make cosmetic repairs alter recipes, acquisition, collision, damage or other authoritative gameplay.

Keep one owner for each actor/channel, allowing deliberate layering where the APIs support it. New player gameplay/animation mods need an ownership review, but they are not categorically forbidden: disjoint mechanics may need no bridge, while competing pose/action producers need explicit qualification. A mod's advertised compatibility, a shared animation library and a static browser preview each establish different evidence from a native in-game comparison.
