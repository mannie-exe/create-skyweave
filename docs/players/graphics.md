# Distant terrain and shaders

Distant Horizons (DH) draws simplified terrain beyond Minecraft's normal render
distance. Shader packs change lighting and appearance; they can be enabled separately.

## Distant Horizons defaults

DH rendering is enabled by default. To restore it in an existing client, use DH's
settings or, with the client stopped, set `rendererMode = "DEFAULT"` under
`[client.advanced.debugging]` in `config/DistantHorizons.toml`.

The pack's LOD radius is **256 chunks**. A server pregenerated to 1024 chunks does
not automatically make the client draw that full radius. Raising the display
radius increases the amount of terrain the client needs to load and render.

Cave culling is disabled (`enableCaveCulling = false`) so its height-based cutoff
does not hide low islands and undersides. Existing clients should check this setting
if those surfaces disappear. Keep frustum culling enabled.

Keep the release's DH Polygon Fix installed with DH 3.3.3 on clients, including macOS.
The fix is version-specific; remove it when upgrading DH.

## Compatibility adaptations

Create Sky Compat includes the Veil/Iris framebuffer correction and optional
balloon shadow-pass, construct-material, and single-block render-pass adaptations. Do not install the old
standalone Veil Iris Fix JAR. Their `rendering.*` switches live in
`config/create_sky_compat-features.properties`; change them only with the game
stopped and restart to apply. Other feature switches are independent.

Native checks covered the selected shader stack, Ponder, heated balloons, and
material controls. Single-block glass rendering is corrected; flickering or gapped
airship shadows remain unresolved. Report the shader pack,
block types, whether the balloon is inflated, and whether camera or ship motion
changes the artifact. Do not clear worlds or LOD caches to troubleshoot it.

## Colorwheel

Colorwheel enables shader-aware Flywheel rendering with compatible shaders.
Complementary and the generated Euphoria selection include native support; no
Colorwheel Patcher is included. Shader-off rendering keeps Flywheel's ordinary
backend. The Mac uses instancing; indirect rendering and Colorwheel OIT are
unavailable there. Compat releases unused OIT sampler slots on that renderer and
supplies material metadata for direct Sable model draws.

These are separate `rendering.colorwheel_samplers` and
`rendering.colorwheel_materials` startup switches. They complement the existing
framebuffer and glass fixes. This does not promise improved FPS or corrected
moving-airship shadows. BSL has no native Colorwheel programs in the selected
archive and remains an alternative without Colorwheel acceleration.

## Moving lights

The pack includes Sable Dynamic Lights and LambDynamicLights for
moving Create contraptions and Sable ships. Compat's `lighting.lifecycle` and
`lighting.sodium` startup switches are enabled by default. These are client-only;
the server does not need the lighting mods.

Lamb's settings control ordinary dynamic lighting. If a shader already lights
your held item, its light can overlap with Lamb's first-person contribution.
SDL also supplies a held-block fallback, so Lamb's self-light switch alone may
not remove every contribution. Light can leak through ship walls; the adapter
does not guarantee fully enclosed cabin lighting.

## Resource packs

The selected stack includes RAY's ladders and rails, Midnighttigger's Fusion
connected textures, Low Shield, Soft Weather, Cubic Sun & Moon, Fresh Flower Pots,
Create Touch-Ups, Low On Fire, Fresh Animations Details/Objects and Better Lanterns. Crops, sugar cane, iron bars, Redstone Tweaks and base Fresh Animations are also
selected. The [content list](../MODLIST.md) records exact dependencies.

Dedicated Sugar Cane and RAY's Rails sit above 3D Crops and
Redstone Tweaks respectively. Keep 3D Crops above Fresh Flower Pots for the
four shared potted mushrooms and fungi as a fallback. **Create Sky Resource Patches**
sits above both and combines the 3D plants with Fresh pots. It also keeps Macaw's
copper and golden chains correctly colored with Better Lanterns. Keep the patch
at highest priority. Objects owns trapped-chest textures, reducing the front-face distinction
from normal chests. Lootr retains its own opened/unopened appearance.

The pinned 3D Crops archive declares a newer format despite its 1.21.1 download
tag. Default options explicitly accept this inspected archive so Minecraft does
not silently deselect it. This acceptance is specific to the pinned file; review
it again on updates. Icons is excluded because its symbols add visual clutter.

Fresh installations receive this selection. Existing installations retain player
options unless explicitly synchronized. Reordering packs changes which overlapping
models win. These packs do not restyle every modded counterpart; moving ships,
Copycats, large farms and shader interactions still need visual testing.

## Visual checks

Compare the same blocks with shaders enabled and disabled before changing the
resource stack. Check connected blocks from several sides, opening and closing
chests, animated textures and moving contraptions. The maintained patch includes
Lootr/Fresh Objects animation bindings, mooshroom model adaptation, lantern
artwork fitting and authored bar/lamp geometry. It does not restyle every mod.

Maintainers can use a disposable scene with labeled samples; the local Resource
Review fixture and captured comparisons are described in
[Atlas verification](../development/web/verification.md). Test saves and optional
comparison packs are not distributed with Create Sky.

## Shader selection

Shaders are off by default. Select a pack through Iris's shader settings:

| Pack | Included version | Notes |
| --- | --- | --- |
| Complementary Unbound | r5.9.3 | Balanced preset with Low block reflections |
| Complementary + Euphoria | 1.10.5 patches for r5.9.3 | Generated at launch; retains the pack's fog and night-sky settings |
| BSL | 10.1.8 | Alternative preset with advanced materials disabled |

All three use 128-block shadow distance. Complementary and Euphoria also use
Low light-shaft sampling. Their clouds, water reflections, ambient occlusion,
bloom and anti-aliasing retain the stock HIGH behavior. BSL disables depth of
field, motion blur and multicolored blocklight.

These settings reduce selected rendering costs while retaining most effects;
there is no measured FPS guarantee. Check moving ships, water and glass, island
edges, and sunrise/sunset after changing settings.

## Texture-unit errors

If Iris reports `No more available texture units while activating sampler shadowcolor1`,
restore the supplied Complementary/Euphoria settings, especially **Low block
reflections** (`BLOCK_REFLECT_QUALITY=1`). Selecting HIGH or ULTRA can overwrite
that choice and exceed the tested macOS texture-unit budget.

Shader settings files live beside their shader packs in `shaderpacks/`. Their
names must match the exact shader ZIP or generated folder. Use the settings from
the same Create Sky release as the shader. BSL is included as an alternative.
The [maintainer reference](../development/compatibility.md#shader-verification)
records the sampler measurements and their limits.

## Missing distant terrain

1. Confirm DH rendering is enabled and check the LOD radius. Test with shaders
   off to separate a DH problem from a shader problem.
2. Check cave culling if low-altitude islands are missing.
3. On multiplayer, allow time for LOD transfer. Look for DH's level key and cache
   path in `logs/latest.log`, followed by download or synchronization errors.
4. Ask the server owner to confirm that the world still has its DH database.
   Pregenerated Minecraft chunks and a completed DH database are different things.

A changed server bookmark name can select another client cache directory because
this pack uses `serverFolderNameMode = "NAME_ONLY"`. The DH level key identifies
the world within that directory. Do not change `serverId` merely because the
client and server config values differ; they are installation-specific.

Avoid clearing caches as a first step. It removes usable LODs and forces another
transfer or rebuild. If terrain is wrong rather than missing, first check the
world generator and [SeedGen compatibility](../development/compatibility.md#world-generation).

## Shader reload shortcut

F8 reloads the selected shader. R remains available for recipe lookup and
Power Grid interactions. Existing installations retain their other key choices;
check Controls if you have assigned F8 yourself.
