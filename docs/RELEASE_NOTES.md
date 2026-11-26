# Create: Skyweave 0.24.0

## Gameplay and equipment

- Add JRFTL's prepared-flesh route to leather, with campfire support alongside its native furnace and smoker recipes. Disable Cookery's one-to-one tray leather shortcut.
- Unify ordinary wheat-flour and dough tags, prefer Cookery dough in Create's recipes, and preserve noodle stretching. Replace the misnamed flour-to-dough recipe IDs with pack-owned batch recipes and bucket remainders.
- Craft leads with dough. Grappling hooks use rope coupling, chain, a dough or leather binder, and either two iron pickaxes or two iron sheets in separate shaped recipes.
- Set the Skybound rope default to 64 blocks, rope pulley to 512, connector hand throw to 16, handheld launcher to 64, mounted launcher to 128, and Simulated rope ceiling to 255. Weighted ejectors reach 64 blocks. Native projectile physics and existing per-item overrides remain independent.
- Add Lamb Lanterns 1.2.0 and a dedicated glider slot so the back slot can remain available for a backpack. Glider item-use policy and ordinary hook Use arbitration remain separate pending work.

## Visuals and world presentation

- Add Motschen's Better Leaves 9.6 and Grassrise 2.0.0. Grassrise's generated-shader bridge supports the selected BSL, Complementary/Euphoria, and Photon recipe identities without renaming archives.
- Update Euphoria Patcher to 1.11.2 and its corresponding shader recipe. Photon remains unsupported on the current Apple GPU.
- Restore Refined Tools arrow geometry for the selected EMF version. Coordinate the bow mesh with Punchy's real nocking event through Modefite.
- Add Snow Under Trees 1.7, Simple Snowy Fix 2.2.1, and Snow! Real Magic! 12.2.7 with Kiwi 15.8.7. Keep snowlogging, snow cushioning, falling-snow ice creation, and spawning through eight snow layers; disable weather accumulation. Optional island-climate adapters preserve ordinary-world behavior.
- Use MoreCulling's CHECK leaf mode, 256-block item-frame LOD distance, and 16-block three-face distance. Preserve selected hooks, launched plungers, fangs, and cannon projectiles through the relevant EntityCulling exceptions.

## Compatibility and dependencies

- Update to public re:form 0.4.0, Lootr: Styled 0.2.0, and Skyweave: Compatibility Patches 0.44.0. Update these together; Styled requires exactly re:form 0.4.0. Preserve existing settings and profiles.
- Shared settings retain the current draft, source, permissions, and staged versus saved state. Styled adds a complete Appearance draft preview and read-only Profiles auditions with explicit staging.
- Retain the qualified connector startup-range repair, Curios/Accessories glider-break repair, initial-light ordering and Sodium sentinel fixes, and bounded Aeronautics Quests chunk admission. Manual structure searches remain progressive; island search behavior is unchanged.
- Add five independently configurable DH 3.3.3 lifecycle repairs for completion, resources, requests, executors, and queue progress. Explicit opt-outs remain authoritative.
- Adopt the reviewed Aeronautics/Simulated 1.3.3 and Moves 1.0.9b cohort, retire the superseded balloon-shadow feature, and make Omnidirectional Movement client-only.
- Update Climbable Ropes to 2.2.3, Create Radars to 5.1.2, EntityCulling to 1.12.2, and RAY's 3D Ladders to 2.5.
- Remove Zfastnoise because its biome redirect conflicts with Sky Archipelago in dedicated startup.

## Controls and defaults

- Hide the optional Create and Sable Beyond main/pause-menu buttons by default. Their configuration files and native settings access remain available.
- Disable DH automatic updating and Euphoria update checking in the authored defaults. Saved player-owned preferences remain preserved on ordinary updates.
- Enable Flashback quicksave when finishing a recording; recording itself remains manual.

## Recording and authoring

- Add Keybind Atlas 3.0.0 for visual control review. Keep saved bindings and native modifier handling.
- Publish a separate empack-managed Replay Studio Prism snapshot with the visual/gameplay content and selected shaders, excluding optional rendering suppression and runtime optimizers. Its default export uses AAC and zero dummy frames.
- Add isolated White Terrace building-authoring tools and preserve the selected Visual Patches producer closure. New authoring previews are not automatically new village templates or pools.
- Update maintenance, ownership, attribution, and build documentation. Atlas/web application work is excluded from this release.

## Updating and known limits

- Requires Minecraft 1.21.1, NeoForge 21.1.265, and Java 21. Keep one compatible re:form library. Reference snapshots require access to their exact dependency downloads.
- Preserve player-owned settings, resource selections, worlds, and LOD identities. This release does not request a world reset, clean old snow, or migrate Dynamic Waters 14.
- Studio replay projects can reference external DH databases. Keep those inputs with the project; moving a replay ZIP does not embed distant terrain.
- Cookery milling and several runtime culinary repairs remain pending. Native dropped-flour water conversion, five-bottle honey tapping, and dragon-head tapping are not disabled by the current recipe/data pass.
- Clean-source checks pass 293 tests, the 404-source configuration audit, 14 quest outputs, 165 village resources, all three shader recipes, and four release-mode export identity/integrity checks. Producer qualification includes native bow/snow and delivery controls, DH lifecycle/resource checks, shared-settings persistence, and Styled previews. Some isolated NeoForge world-unload controls intermittently stalled in native ChunkMap code; successful later controls do not establish a fix. No universal gameplay, GPU, or high-resolution export guarantee is implied.
