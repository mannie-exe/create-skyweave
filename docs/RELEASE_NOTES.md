# Create: Skyweave 0.2.3

Update Skyweave: Compatibility Patches to 0.22.1. Configuration now has searchable
mod pages organized by gameplay system, consistent section navigation and inline
JSON/TOML editing with staged saves and conflict checks. The release also restores
distant Sable constructs with the qualified Iris shaders, applies opaque DH
occlusion, extends selected decorative-block backfaces and aligns flat bridge
lantern selection with its model.

Refresh NeoForge to 21.1.265 and compatible dependencies, including Colorwheel
1.3.2, SSRD 1.8.8, Fresh Animations 1.11.2 and Ray's Rails 3.7. Keep Minecraft
1.21.1, Sky Archipelago 1.3.6 and the existing terrain generation. Worlds and LOD
caches do not need regeneration. See [included content](MODLIST.md) for exact pins
and [compatibility](development/compatibility.md) for renderer coverage and limits.

Expand the generated Debug World to 1,088 cases across 17 floating districts,
including more ladders, redstone circuits, construction, interactions and entity
variants. The fixture is maintained separately from normal player worlds. Atlas
resource-pack records match the selected archives; exporter runs can use isolated
matching NeoForge libraries.

Server defaults use view distance 12 and simulation distance 16. Reliable Gliders
keeps its survival tuning and disables automatic deployment in creative mode.
Existing editable instance settings are preserved during updates.

Previous release: [0.2.2](releases/0.2.2.md).
