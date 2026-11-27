# Culinary integration

Cookery 1.6.0 and Tavern 1.2.0 retain their cooking, farming, brewing, furniture, and food-effect systems. Resource Patches owns the selected recipe, ingredient, and drink-data changes. Visual Patches owns held bucket bindings. The native configuration files own their supported gameplay switches; optional Compat adaptations own behavior that resources cannot express.

## Ordinary wheat flour and dough

Create wheat flour and Cookery flour belong to `c:flours/wheat`; `c:flours` and Cookery's `c:flour` expose that family to existing recipes. Create dough and Cookery raw dough belong to `c:foods/dough/wheat`, with the generic food-dough and legacy dough tags bridged without cycles. Flour and dough remain separate families. Raw wheat, Create cinder flour, and Confectionery's flavored intermediates are not ordinary wheat substitutes.

Cookery raw dough is the preferred ordinary output. Create mixing and fan washing produce it, preserving their native input, 1,000 mB mixing-water cost, output count, and processing behavior. Its native hand-use still stretches dough into noodles. Tagged Cookery chopping-board recipes continue to accept ordinary dough; their three-noodle cutting yield differs from the one-noodle hand-stretch yield and is unchanged.

Eight shapeless recipes under `create_skyweave:crafting/dough_from_wheat_flour_1` through `_8` combine one to eight ordinary wheat flour with one water bucket and yield the same number of Cookery raw dough. Vanilla crafting returns the empty bucket. They preserve the native batch choices, accept either flour or a mixture, and have matching flour-based recipe discovery. The misleading `minecraft:flour_from_N_wheat` recipes and rewards, plus Create's duplicate one-flour crafting recipe, are disabled.

Both dough items remain valid for Create bread/slime recipes, Factory cake paste, Power Grid board assembly, and the pack's leads and two hook recipes. Output and transitional items, fluid costs, processing timings, and other ingredients stay with their native recipe owners. Existing Create dough remains usable; this is ingredient interoperability, not an inventory migration or automatic conversion of saved items.

Cookery's dropped flour converts to dough in water through `FlourItem`, outside recipe data. Its requested removal is saved for an optional runtime repair and is not accomplished by these tag changes. Create's fan-washing route also uses persistent water; it remains deliberately available. Do not describe the selected policy as requiring consumable water for every dough route.

## Milling decisions

The Cookery animal millstone is retired from normal fresh-survival acquisition. Resource Patches disables its crafting recipe, all 85 original milling recipes, the station recipe unlock, and the animal-mill advancement. Dough stretching remains under Cookery's root advancement, so it does not depend on the retired station. The selected artifact's data resources contain no other millstone-producing recipe, loot, trade, or structure placement; block/item registration and the existing insertion-conservation repair remain unchanged.

Two culinary routes move to Create milling:

| Input | Output | Processing work |
| --- | --- | --- |
| One item in `c:seeds` | One `kaleidoscope_cookery:oil` item | 150 |
| One `kaleidoscope_cookery:rice_panicle` | Three `kaleidoscope_cookery:rice` | 150 |

Both replacements require Create and Cookery. They retain the original input breadth and deterministic quantities. Oil remains an item for Cookery's oil-pot system, not a new fluid. The 150 work value matches Create's early wheat milling workload; elapsed time depends on native rotational speed, not the animal mill's cadence.

The other 83 Cookery milling routes are removed rather than imported into Create. Create's existing wheat recipe is unchanged: one guaranteed Create flour, a 25% chance of two extra flour, and a 25% seed chance, averaging 1.5 flour and 0.25 seed. Other valid Create milling/crushing recipes and addon contributions keep their native inputs, yields, timings, and power requirements. Existing flour/dough interoperability is unchanged.

Cookery 1.6.0 has no native config switch for its millstone or Create fallback. The bridge runs **from Create into Cookery**, not in reverse: a mill obtained through creative/commands or retained in an existing world can still process loaded Create milling recipes. Resource removal does not disable this runtime bridge. The alpha policy closes normal acquisition and does not migrate or destroy placed machines, unregister saved IDs, or add a Compat prohibition.

When updating Cookery, enumerate its exact native milling IDs and acquisition/discovery resources again. Compare the original recipes with the explicit overrides; new upstream routes require review. Create 6.0.10 declares 47 core and 199 conditional integration recipes, but conditions and populated tags decide what actually loads. Keep this dated source comparison distinct from the native loaded-manager and actual machine checks.

## Drying and wetting trays

The one-rotten-flesh-to-one-leather drying recipe is disabled. JRFTL's selected four-flesh prepared-flesh chain remains the leather shortcut. No new prepared-flesh tray recipe is added.

Other tray routes remain for review: drying tea, kelp, wet sponge, and mud; wetting all 16 concrete powders, leather to rotten flesh, dried tea/kelp, clay or dirt to mud, sponge, and copper to fully oxidized copper. They preserve their native one-to-one quantities. Fuel-free sponge drying and fast copper oxidation are conveniences with progression implications, not selected removals. Native durations are 1,800/900 ticks for drying/wetting, subject to weather/exposure, loading, and server tick rate. Roofs and stacked islands can affect native sky checks.

## Food, drinks, and taps

The managed Cookery common file explicitly retains native Satiated Shield settings for gameplay testing. Always-edible foods, buff refresh, Sulfur, Mustard, and other Cookery effects remain available. Tavern effects including Zenith, Shriek Attack, and active incense are also retained; these are gameplay mechanics, not just presentation.

Screwdriver's existing drink-effect resource now contains an empty effect tier, preventing new Upside Down grants while retaining the drink. This avoids new permanent `Grumm` renaming from that route. Previously serialized signature cocktails and an already applied effect need the separately selected runtime guard; data reload does not erase them or restore prior mob names.

| Tap behavior | Current authored policy |
| --- | --- |
| Renewable lava-cauldron filling | Disabled by managed native `InfiniteLavaFromTap=false`. |
| Molotov production | Retained independently of the lava-fill switch. |
| Water cauldrons and waterlogged water | Retained. |
| Melon juice | Retained. |
| Hive honey | Native five bottles per full hive remains until the requested optional three-bottle repair is adopted. No native yield setting exists. |
| Dragon-head breath | Requested disabled; requires the saved optional behavior repair. The direct breath-bottle placement switch is a different feature. |

Rice consumption/ingredient bowls, placed-versus-held saturation, signature potion effects, placed-bottle components, knife durability, bound-animal equipment, oil-pot custody, boards, and moving seats are runtime concerns. Their source/upstream reports are not broad native pack qualifications. Keep these fixes separate from food/effect balancing and do not silently disable their whole stations.

## Bucket presentation and seats

Visual Patches binds all six Tavern juice buckets to the existing Refined Buckets body, normal/first-person meshes, and Punchy definitions. It references Tavern's six static native fluid surfaces, preserves GUI/frame/ground models, and changes no fluid, consumption, vessel, or item-use behavior. Cookery's oil is an item/oil-pot system in this selection, not another registered juice bucket.

Cookery includes Sable seat-retention and destruction tags. Tavern 1.2.0 does not. A separately reproduced native admission defect leaves required conditional Quark IDs in Cookery's own item tag and Carry On's shared blacklist. [The upstream finding](upstream.md#cookery-conditional-furniture-tags) records the repair boundary; the tag loads remain unresolved by this data pass.

Both native seat entities validate the block at their current position and suppress ordinary movement, so adding a tag alone is not qualification of moving-seat lifecycle or rider frames. Review current Sable/Aeronautics/Simulated/Beyond ownership before adding a competing seat adapter. Land seating remains distinct from translation, rotation, tilt, disassembly, and reopening.

## Updating and verification

On updates, compare the exact recipes and discovery resources, common tag graph, native food/container registration, dropped-item action, Create fallback/event API, custom drink-data loader, tap behaviors, seat entities, and fluid registrations. Resource Patches declares optional ordering after Create, Cookery, Tavern, Factory, and Power Grid so its recipe/effect replacements win consistently. Reconcile each override against the selected upstream resource; retire native-equivalent repairs instead of keeping duplicate owners. Keep the exact Tavern source pin and bucket catalogue aligned with the selected dependency and rebuild through the existing visual generator.

Use native recipe/tag/crafting controls for both flours/doughs, mixed batches, water-bucket remainders, bread/slime and non-food consumers, disabled originals, tray policy, and effect-map loading. Review actual first-/third-person bucket use with the current animation/render stack separately from resource generation. Source checks and archive builds do not prove gameplay custody or shader correctness. Publication and installed-instance sync require their own owner selection.
