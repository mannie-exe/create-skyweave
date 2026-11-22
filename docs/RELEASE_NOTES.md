# Create: Skyweave 0.23.0

Adds Kaleidoscope Cookery 1.6.0, Kaleidoscope Tavern 1.2.0 and Sable Beyond 0.5.0. Tavern’s renewable lava-cauldron filling is disabled; its other tap behavior remains native. Compat 0.42.1 repairs Cookery’s millstone automation insertion while preserving native recipes and processing. Beyond retains its upstream defaults; wet-construct force ownership with Dynamic Waters remains under review. Loconautics is not included.

Updates the shared settings stack to public re:form 0.2.0 and adopts public Lootr: Styled 0.1.0. Compat’s optional IPN text-input and Moves/Effortless/Power Grid modifier repairs support the new control map. Fresh installations receive gameplay/editor/camera separation, G for Ping, F12 for Wayfinder, and revised IPN defaults. Existing player-owned settings are preserved on ordinary updates; deliberately reset or merge the affected seeds to adopt these defaults.

Replaces Combat Nouveau with Better Combat, adds Omnidirectional Movement and Grappling Hook: Skybound, and sets the grappling rope trial limit to 255 blocks. Retains Punchy, Moves and Fluid & Foolish. Includes the selected shader recipe updates and accepted cage-lamp and hay geometry; cage native visual review remains waived, not newly qualified.

Corrects seven authored village center roofs, the Flowerridge cut-copper slab ID, and owned profile/pool metadata. Owned profiles explicitly use Lithostitched’s assembler. These are static template/metadata corrections; no new village-generation runtime test is claimed, and existing placed blocks are unchanged. Saved generation identity remains `islands_v1-skyarch-1.4-18`, with watersheds `island_watersheds_v7`; this release does not require an automatic world reset or blend saved terrain.

Requires Minecraft 1.21.1, NeoForge 21.1.265 and Java 21. Reference client/server exports retain the 12 GiB maximum-heap defaults and require additional host memory. Source/build checks and an isolated packaged-mod title check pass; the native title check does not establish all gameplay, physics or production-launcher combinations. A prior intermittent Create client-extension registration failure remains unattributed.
