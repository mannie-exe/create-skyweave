# Distant terrain and shaders

Distant Horizons (DH) draws simplified terrain beyond Minecraft's normal render distance. Shader packs change lighting and appearance; they can be enabled separately.

New client instances default to a 12-chunk view distance and 10-chunk simulation distance. Existing instance options are preserved.

## Distant Horizons defaults

DH rendering is enabled by default. To restore it in an existing client, use DH's settings or, with the client stopped, set `rendererMode = "DEFAULT"` under `[client.advanced.debugging]` in `config/DistantHorizons.toml`.

The pack's LOD radius is **256 chunks**. A server pregenerated to 1024 chunks does not automatically make the client draw that full radius. Raising the display radius increases the amount of terrain the client needs to load and render.

Cave culling is disabled (`enableCaveCulling = false`) so its height-based cutoff does not hide low islands and undersides. Existing clients should check this setting if those surfaces disappear. Keep frustum culling enabled.

Keep the release's DH Polygon Fix installed with DH 3.3.3 on clients, including macOS. The fix is version-specific; remove it when upgrading DH.

## Compatibility adaptations

Skyweave: Compatibility Patches includes the Veil/Iris framebuffer correction and optional balloon shadow-pass, construct-material, and single-block render-pass adaptations. Do not install the old standalone Veil Iris Fix JAR. Their `rendering.*` switches live in `config/skyweave/skyweave_compat-features.properties`; change them only with the game stopped and restart to apply. Other feature switches are independent.

Native checks covered the selected shader stack, Ponder, heated balloons, and material controls. Single-block glass rendering is corrected; flickering or gapped airship shadows remain unresolved. Report the shader pack, block types, whether the balloon is inflated, and whether camera or ship motion changes the artifact. Do not clear worlds or LOD caches to troubleshoot it.

The separate `rendering.construct_coverage` adaptation waits for usable terrain between the camera and an already delivered distant ship. Unknown or unmeshed terrain withholds that draw; confirmed void remains valid. The existing opaque-depth guard then decides actual terrain occlusion. Nearby ships retain native behavior. Coverage needs DH, Sable, and SSRD but not Iris; it does not load chunks, increase server tracking limits, or activate dormant ships.

## Colorwheel

Colorwheel enables shader-aware Flywheel rendering with compatible shaders. The generated Complementary/Euphoria/Skyweave selection includes native support. Its Euphoria mod supplies runtime integration. Shader-off rendering keeps Flywheel's ordinary backend. The Mac uses instancing; indirect rendering and Colorwheel OIT are unavailable there. Skyweave: Compatibility Patches releases unused OIT sampler slots on that renderer and supplies material metadata for direct Sable model draws.

These are separate `rendering.colorwheel_samplers` and `rendering.colorwheel_materials` startup switches. They complement the existing framebuffer and glass fixes. This does not promise improved FPS or corrected moving-airship shadows. The BSL alternative is assembled with the Colorwheel overlay on first launch.

## Moving lights

The pack includes Sable Dynamic Lights and LambDynamicLights for moving Create contraptions and Sable ships. Skyweave: Compatibility Patches' `lighting.lifecycle` and `lighting.sodium` startup switches are enabled by default. These are client-only; the server does not need the lighting mods.

Lamb's settings control ordinary dynamic lighting. If a shader already lights your held item, its light can overlap with Lamb's first-person contribution. SDL also supplies a held-block fallback, so Lamb's self-light switch alone may not remove every contribution. Light can leak through ship walls; the adapter does not guarantee fully enclosed cabin lighting.

## Resource packs

The selected stack includes RAY's ladders and rails, Midnighttigger's Fusion connected textures, Low Shield, Soft Weather, Cubic Sun & Moon, Fresh Flower Pots, Create Touch-Ups, Low On Fire, Fresh Animations with Details, Objects, Quivers and Bray’s FA zombie variants, Refined Tools, Refined Torches, Refined Buckets with its Create addon, Luminous Lanterns, Fluid & Foolish, Punched Backpacks, Artifacts 3D, Fresh Vines and the Punchy potion backport. Motschen’s Better Leaves, crops, sugar cane, iron bars and Redstone Tweaks are also selected. The [content list](../MODLIST.md) records exact dependencies.

Dedicated Sugar Cane and RAY's Rails sit above 3D Crops and Redstone Tweaks respectively. Keep 3D Crops above Fresh Flower Pots for the four shared potted mushrooms and fungi as a fallback. **Skyweave: Visual Patches** sits above both and combines the 3D plants with Fresh pots and approved model compositions. Keep the patch at highest priority. Objects owns trapped-chest textures, reducing the front-face distinction from normal chests. Lootr retains its own opened/unopened appearance.

Motschen’s Better Leaves 9.6 adds bushy leaf geometry and supplies its own leaf textures. MoreCulling uses `CHECK` for leaves; no additional leaf-culling mod is required by this selection. Interactive Foliage’s ambient leaf waving remains off. The pack uses ordinary 1.21.1 model geometry, but shader appearance and foliage interactions still need an in-game comparison. Existing players can enable `Better-Leaves-9.6.zip` in Resource Packs; new instances select it by default.

Grassrise supplies short, biome-tinted grass blades through its bundled resource pack; snowy grass retains the native snowy model. Its mod automatically enables and prioritizes that pack, so a separate Grassrise ZIP is unnecessary. Grassrise’s shader corrections are not yet qualified for the generated Skyweave shaders: the current names are rejected by its shader-family checks. Native shader-off lighting and the bundled geometry remain available; do not assume that blade-shadow removal is active until the pending Compat bridge is qualified.

The pinned 3D Crops archive declares a newer format despite its 1.21.1 download tag. Default options explicitly accept this inspected archive so Minecraft does not silently deselect it. This acceptance is specific to the pinned file; review it again on updates. Icons is excluded because its symbols add visual clutter.

Punchy supplies the first-person animations; Hold My Items and InteractiveStuff are alternative animation systems and are not installed. Modefite reads the newer item definitions on Minecraft 1.21.1, and RespackOpts supplies resource-pack options. Luminous owns lanterns. Enchanted Fishing Line adds a client-side simulated fishing line.

Fresh installations receive this selection. Existing installations retain player options unless explicitly synchronized. Reordering packs changes which overlapping models win. These packs do not restyle every modded counterpart; moving ships, Copycats, large farms and shader interactions still need visual testing.

### Model choices

In **Options → Resource Packs**, use the configuration button for **Skyweave: Visual Patches**. Its choices are personal visual preferences; applying them reloads resources. Use **F3+T** after an external resource-pack update.

**Lighting** has separate placed and held redstone torch choices: Nautilus 3D, Refined Torches and vanilla. Both default to Nautilus. **Workstations** offers Nautilus, Classic 3D and vanilla crafting tables, plus independent **Nautilus file** (on) and **Nautilus pencil** (off) controls. Selected accessories appear at every table position; drawers retain their donor variations. The Nautilus enchanting model is fitted to Easy Magic's item surface. These model choices do not change crafting or enchanting rules.

To compare torches, change **Held redstone torch** for the object in your hand or **Placed redstone torches** for blocks in the world. Use **Done** on Lighting, then **Done** on the parent pack page and wait for resource loading to finish. Esc/Cancel is not the tested save path. The saved choices live beside the ZIP in `resourcepacks/skyweave-visual-patches-0.1.0.zip.rpo`; do not delete that preference file during an update. Both styles retain the red glowing head and wooden handle, so compare from the same close viewpoint. Nautilus' ordinary held model has a gray collar below the head; Refined retains its separate animated item model and particles.

**Chains** independently controls vanilla chains, Design n’ Decor's large chains, and Luminous lantern chains/handles. Other categories let you compare the selected plants, doors, lamps, bars, storage and workstation families against lower packs. Keep their source packs selected: switching off a patch reveals lower resources rather than uninstalling them. Required loading repairs remain active.

Fresh Animations and Details are enabled by default. Keep Details above the base, Fresh Objects above both, Quivers above those, and Visual Patches at highest priority. Quivers adds the selected skeleton-family back equipment; Fresh Objects supplies chest/Lootr artwork independently. Punchy's player animations do not by themselves require disabling these mob packs.

## Player and world effects

3D Skin Layers adds depth to the outer skin layer without changing player collision or movement. Its preferences live in `config/skinlayers.json`. Punchy owns first-person animation; Moves owns the selected player and cape animation direction. Compat’s `punchy_moves.touch_n_motion` startup adaptation connects the pinned Touch’n Motion body/contact and pose-copy API without another cape engine.

Interactive Foliage reacts to nearby entities through SWAY. Its supplied defaults use the GPU renderer and disable ambient foliage/leaves waving and weather wind, leaving ambient wind to shaders. Entity interactions remain available with shaders off. Use `config/mc2_interactivefoliage.json` to change these preferences; the CPU renderer remains a fallback for rendering issues. Shader and resource-model compatibility still needs qualification on the selected stack.

Subtle Effects supplies block, entity and environmental particles. Its five configuration files live in `config/subtle_effects/`. Particle culling is enabled at five chunks, and waterfall effects retain distance checks. Entity water-entry splashes and underwater container bubbles remain disabled in the initial defaults. The existing Cool Rain/Sable Cool Rain stack still owns weather rendering.

These files are player-owned seeds: changed pack defaults do not overwrite existing preferences. The native render combinations, custom plant models and moving ships need visual comparison before treating every effect as qualified. See [effect maintenance](../development/patches.md#client-effect-defaults).

## Visual checks

Compare the same blocks with shaders enabled and disabled before changing the resource stack. Check connected blocks from several sides, opening and closing chests, animated textures and moving contraptions. Lootr: Styled follows supported selected vanilla/Fresh chest resources. Visual Patches supplies mooshroom adaptation, held-item resource bindings and authored bar/lamp geometry. These selections do not restyle every mod.

Maintainers can use a disposable scene with labeled samples; the local Resource Review fixture and captured comparisons are described in [Atlas verification](../development/web/verification.md). Test saves and optional comparison packs are not distributed with Create: Skyweave.

## Shader selection

Shaders are off by default. Select a pack through Iris's shader settings:

| Pack | Included version | Notes |
| --- | --- | --- |
| Complementary + Euphoria + Skyweave | r5.10 + 1.11.1 + 0.4.1 | Generated shader with window and island-environment corrections |
| BSL + Colorwheel + Skyweave | 10.1.8 + 1.0.5 + 0.3.1 | Generated alternative with the supplied BSL settings |
| Photon + Skyweave | 1.4 + 0.3.1 | Generated wrapper retaining native Colorwheel; supported GPUs only |

The supplied Complementary, Euphoria and BSL presets use 128-block shadow distance. Complementary and Euphoria also use Low light-shaft sampling. Their clouds, water reflections, ambient occlusion, bloom and anti-aliasing retain the stock HIGH behavior. BSL disables depth of field, motion blur and multicolored blocklight.

The generated shaders retain upstream shadow behavior. Custom DH shadow programs are absent because their coarse-face projection could falsely shadow unobstructed terrain. Distant terrain can still render, but roofs outside native shadow coverage may allow cavern light shafts. Larger shadow distance does not create missing terrain and spreads the same resolution over more ground.

These settings reduce selected rendering costs while retaining most effects; there is no measured FPS guarantee. Check moving ships, water and glass, island edges, and sunrise/sunset after changing settings.

Select `BSL_v10.1.8 + Clrwl_1.0.5 + Skyweave_0.3.1.zip` for the BSL alternative. The installed runner assembles supported outputs before Iris opens them; original inputs stay outside the shader selection list. Current Complementary, Euphoria and Photon support Colorwheel natively.

Photon retains its native High lighting settings, including SH Skylight and colored shadows, with block-entity shadows enabled for machinery. Shadow distance is 128 blocks at 2048 resolution; depth of field and motion blur are disabled. Its Ultra profile and colored-lighting options remain available through the shader menu.

Complementary + Euphoria remains the default selection. Photon is a manually selected alternative for supported GPUs; its author does not support Apple GPUs. Use Complementary/Euphoria on Apple hardware. Shader patching does not change that hardware limitation.

## Texture-unit errors

If Iris reports `No more available texture units while activating sampler shadowcolor1`, restore the supplied Complementary/Euphoria settings, especially **Low block reflections** (`BLOCK_REFLECT_QUALITY=1`). Selecting HIGH or ULTRA can overwrite that choice and exceed the tested macOS texture-unit budget.

Shader settings files live beside their shader packs in `shaderpacks/`. Their names must match the exact shader ZIP or generated folder. Use the settings from the same Create: Skyweave release as the shader. BSL is included as an alternative. The [maintainer reference](../development/compatibility.md#shader-verification) records the sampler measurements and their limits.

## Missing distant terrain

1. Confirm DH rendering is enabled and check the LOD radius. Test with shaders off to separate a DH problem from a shader problem.
2. Check cave culling if low-altitude islands are missing.
3. On multiplayer, allow time for LOD transfer. Look for DH's level key and cache path in `logs/latest.log`, followed by download or synchronization errors.
4. Ask the server owner to confirm that the world still has its DH database. Pregenerated Minecraft chunks and a completed DH database are different things.

A changed server bookmark name can select another client cache directory because this pack uses `serverFolderNameMode = "NAME_ONLY"`. The DH level key identifies the world within that directory. Do not change `serverId` merely because the client and server config values differ; they are installation-specific.

Avoid clearing caches as a first step. It removes usable LODs and forces another transfer or rebuild. If terrain is wrong rather than missing, first check the world generator and [SeedGen compatibility](../development/compatibility.md#world-generation).

## Shader reload shortcut

F8 reloads the selected shader. R remains available for recipe lookup and Power Grid interactions. Existing installations retain their other key choices; check Controls if you have assigned F8 yourself.

## Shader generation

The first client launch assembles the three authored shader choices from verified installed inputs. Later launches check their cache without rewriting shaders. Only complete results appear in Iris. Keep the default Complementary/Euphoria/ Skyweave selection, or select BSL/Colorwheel or Photon on a supported GPU; your enablement and quality options remain yours. Compat settings list recipe status and **Rebuild shaders**. A failed recipe is reported there and in the log; the client does not silently select an unpatched shader. This works with ordinary launchers and needs no Python or launcher-specific patching command.

## Enchanted equipment outlines

Outline Effects adds outlines, animated runes and glow to enchanted held items and armor. Its O shortcut opens the quick settings panel in-world; the Mods menu exposes its configuration as well. The authored defaults retain vanilla glint alongside these effects. Colors, thickness, runes, glow, third-person rendering and saved presets are client preferences. This effect concerns equipment, independently of block-selection outlines.

The independent `iris.hand_effects` Compat adaptation restores the outline, runes, and hand glow through Iris’s actual hand passes. The global unknown-shader setting remains false. Outline Effects still owns colors, item eligibility, glow, and glint preferences. Changing the adaptation requires a game restart; native effect preferences retain their own controls. Shader-off rendering keeps its native path.

## Lootr: Styled

Lootr: Styled adapts supported selected vanilla chest models to Lootr and supplies the default Lootr barrel clasps. Native Lootr loot, per-player looted appearance, trapped identity and opening motion remain. The default profile replaces no artwork.

Use `/lootrstyled` or NeoForge’s Mods configuration button. Model and artwork profiles are independent. Fresh Objects AUTO follows supported installed rigs; OFF retains native chest parts. Apply saves client preferences and reloads resources. The reason view explains requested/effective profiles and source selection. A missing profile ID stays saved while native/inherited resources remain available.

Local profiles live under `config/lootr_styled/`. Export makes an editable copy and never replaces an existing directory; artwork can be included when requested. User choices and local profiles are client preferences. The addon includes Default artwork, while the pack seeds Artwork as Vanilla (Inherited). Choose Default to use the addon’s textures. The pack’s older relighting-editor export remains a separate local preview.
