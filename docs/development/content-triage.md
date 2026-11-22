# New-content triage

Review a mod, resource pack, dependency update, or interaction change through the behavior it adds and the owners it crosses. A matching loader label, successful startup, or available recipe does not establish working gameplay. This guide routes the review; the linked domain guides own detailed contracts and current selections.

## Establish the change

Record the intended player-visible behavior, an unchanged comparison, and what must remain intact. Inspect the exact downloaded artifact, runtime mod ID/version, nested libraries, physical sides, and dependency closure against `empack.yml` and `empack.lock`. Connector translation, a bundled library, and a compatibility add-on each have their own API and lifecycle boundaries. Check the actual installed implementation before adopting fields or promises from newer documentation.

Identify the effective owners, including resource priority and conditional definitions: who selects the item/model or recipe, consumes input, permits the action, renders it, and persists its result? Search existing Compat features, standalone patches, pack overrides, and native integrations before adding another fix. Similar appearance is insufficient to remove unique content or assume equivalent physics. Keep standalone defaults distinct from deliberate pack tuning.

## Put the change with its owner

| Change | Owner and review route |
| --- | --- |
| Supported native settings | Existing authored configuration and rationale register; [installation policies](authoring.md#installation-file-policies) determine managed/seed delivery. Check the actual reader, writer, and application timing. |
| Recipes, loot, tags, or other static gameplay data | Resource Patches or the existing data generator; [shared data overrides](patches.md#shared-data-overrides) and [progression](progression.md) own the behavior and update checks. |
| Models, textures, display transforms, or static held-item fitting | Existing visual authoring/generator and resource profiles; [animation and model compatibility](animation-compatibility.md) owns fitting and renderer review. |
| Shader-pack source changes | [Shader lab](../../tools/shader-lab/README.md) owns exact source inputs, recipes, presets, and generated outputs. Shader recipes and crafting recipes have different consumers. |
| Runtime input, renderer, coordinate-frame, authority, or lifecycle defects | An independently optional Compat feature, or the existing standalone adapter when it already owns the boundary; [patch maintenance](patches.md#ownership-and-coupling) routes coupled changes. |

Keep one effective writer for each value or replacement resource. An additional authoring record, resource option, or runtime hook must not silently compete with the existing owner. A resource repair cannot restore a missing runtime callback, and a runtime adapter is unnecessary when the supported native data/configuration contract already expresses the change.

## Rendering and resource definitions

Trace the winning resource through active pack order, overlays, options, parent models, component predicates, tint sources, and custom renderers. Compare the effective model and draw path rather than only the file edited. A Punchy model-part definition can replace the held mesh independently of the ordinary item model. A newer pack format, a supported rotation, and a supported item-definition selector are separate capabilities.

For transparent, emissive, outlined, or custom-framebuffer content, identify geometry, material, render type, and pass ownership separately. The held-bottle repair required different liquid/glass hand-pass placement; changing texture alpha or adding backfaces would not have addressed that depth problem. Iris also has hand paths that bypass ordinary effect hooks. Preserve native transforms, per-leaf tint, pose evaluation count, buffered emission, and render-target/depth/blend restoration, including skipped and failed passes. Do not globally allow unknown shaders, disable culling/depth, or replay animation to hide a local defect.

Use the affected contexts: held in either hand, both filled hands, GUI/ground/fixed, placed blocks, block entities, or moving geometry as relevant. Compare shaders off and the supported Complementary/Euphoria and BSL chains when their passes are affected. Keep Photon preprocessing/compile evidence separate from supported-GPU visual and cost qualification. Resource reload and pipeline/renderer replacement must retire stale draws and cached models. [Rendering maintenance](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/rendering.md) owns the runtime details; [visual patch boundaries](patches.md#visual-patch-boundaries) own pack-side repairs.

## Player, combat, and mob animations

Use the [animation ownership map](animation-compatibility.md#renderer-ownership) before adding poses, weapons, movement, equipment, or animated mobs. Punchy! owns first-person hands, Moves + Fluid & Foolish own the selected third-person presentation, and native gameplay/Better Combat own permitted attacks and outcomes. Touch’n Motion, equipment layers, EMF/ETF, and Fresh packs cross specific attachment or entity channels. These are current owners, not blanket compatibility guarantees.

Follow the actual action from input to use/attack admission, animation start, interruption, impact, and completion. Compare attack wind-up and accepted hits, ordinary Use/placement, item switching, and relevant movement or carried-object states. A client pose or animation callback must not grant an attack, duplicate a use, or change damage. Resource priority and script registration do not prove the intended action callback runs. Inspect animation/controller APIs and effective resource definitions before applying offsets or suppressing another producer. Review Punchy's existing Better Combat/Carry On adapters and Moves' actual attack mappings first: the selected Fluid & Foolish locomotion does not itself establish an attack override, and Better Combat can supply the attack pose. [Player animation maintenance](patches.md#player-animation-ownership) owns the selected settings and bindings.

Qualify both hands and first/third person where the change touches them; include a real observing client when synchronization is claimed. Review grip, mesh, item/bone attachments, armor/backpacks, camera/cape layers, and interrupted/failed actions at their actual boundaries. Retain one owner per action/channel, with explicit layering where supported. A first-person correction does not qualify the observer pose, and a player hook in a shared living-entity renderer does not establish mob support.

For mobs, distinguish model/texture/animation replacement from AI, collision, hitboxes, and attack mechanics. Check supported species, variants, juveniles, equipment, and relevant idle/walk/attack/hurt/death states. EMF/CEM, ETF texture behavior, and GeckoLib controllers are different systems; a shared library does not guarantee a compatible rig or consistent style. Preserve suitable native controllers. Use a specific bounded adapter or item-specific fallback when necessary, with a reason and removal check for any blacklist; do not blanket-disable modded content.

## Recipes, acquisition, and inventories

Inspect effective recipes after conditions, tags, unification, and competing data packs have loaded. Verify exact resource IDs, the selected Minecraft schema and native codec, real registered ingredient membership, output components/counts, processing-time semantics, and container remainders. Empty or optional tags and absent optional mods need their own controls. Do not infer loaded behavior from JSON validity or an EMI/JEI listing.

Keep intended alternatives distinct from accidental collisions. Almost Unified's broad ore matching previously merged stone/deepslate processing with different yields; the pack retains geological identity while unifying selected manufactured materials. Propulsion processing repairs preserve work values and other acquisition routes while suppressing specific overlaps. Do not solve a single collision by removing an entire recipe family or broadening all ingredients.

For custom inventories, crafting, fluids, or automation, observe actual accepted/rejected operations and item custody. Check simulation versus committed extraction/insertion, partial acceptance, stack/component preservation, remainders, repeated invocation, cancellation, and save/reopen where the path uses them. UI stacks and recipe availability alone do not prove an inventory implementation conserves contents. Update affected [equipment acquisition](equipment.md), [progression](progression.md), and [journal assumptions](journal.md#update-checks) when behavior changes; refresh Atlas evidence only for the relevant changed consumer.

## Inputs and interactions

Follow the [input ownership index](keybinds.md) and current authored remap. Inventory registered mappings and custom chord/raw/polling/configuration paths; compare conflicts by overlapping contexts and event consumption, not key names alone. Record native defaults, pack-authored seeds, saved player overrides, and actual runtime bindings separately.

Check text focus, nested/search widgets, deliberate inventory mouse actions, native keybinding capture, held/release order, screen/focus changes, and fresh input after leaving an editor. Do not cancel raw events or skip release bookkeeping to prevent an action. A modifier framework does not automatically cover an independent dispatcher such as IPN's. Preserve existing mouse-gesture and inventory-movement owners, keyboard-layout/device constraints, and intentional contextual reuse. An input-protection proposal is not evidence that the native fix already ships.

## Sable and moving machinery

Review the existing Sable, Simulated, Create, and mod-native integrations before adding mass or assembly logic. [Building weights](weights.md) distinguishes registered states, multipart positions, collision/volume, and actual assembled mass. Ordinary Copycats retain facade semantics and native base properties; copying a material is not permission to inherit its mass or other physics. Do not double-account machinery that already participates through a native integration.

Name each coordinate and vector frame: physical world, plot/ship, block-local, body-local, and orientation where applicable. Distances, hits, fluid contact, menus, particles, and force/velocity each need their own conversion contract. Establish an impulse's frame through its actual physics consumer and resulting velocity; a method name, recorded argument, or wake flag is insufficient. Do not carry an inverse-rotation rule from another handle/API or historical fixture into a new integration without that check. Test translated, rotated, and tilted cases when the behavior depends on those frames. A stationary identity pose cannot establish general compatibility.

Check actual assembly, movement, interaction, unload/removal/disassembly, and reopening for the affected block/entity family. Keep server authority over inventory, damage, and world writes. Validate both native menu actions and custom packets, target identity, permission, and frame-aware reach before mutation. Preserve the existing transport and do not activate distant physics or load chunks merely to present a preview or effect. [Compat adapter maintenance](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/adapters.md) owns runtime hooks; [pack compatibility](compatibility.md) records selected behavior and limits.

## Shared lifecycle and terrain assumptions

New integrations must respect the current world/generator, session, player, resource revision, and rendering or storage owner. Scope caches and queued work accordingly. Recheck disconnect/reconnect, teleport/dimension changes, resource/pipeline reload, failed actions, and late asynchronous results for the affected path. Cancellation is not rollback, a saved config is not necessarily applied, and data present on disk is not necessarily ready for rendering.

Terrain-sensitive spawning, structures, fluids, climate, and previews need island/layer-aware queries where the owning integration supplies them. Review stage ordering, physical versus reference height, local water versus sea level, missing/void data, and saved generation identity. Preserve foreign-generator behavior and ordinary presets. Use [world generation](worldgen.md) and [structures](structures.md) for these contracts; a single heightmap or loaded spawn fixture does not qualify stacked islands or every settlement.

Keep optional adapters optional before target classes load, including client/server boundaries and explicit opt-outs for unsupported dependencies. Measure changed scheduling, allocations, retention, GPU passes, and loaded-chunk work when those costs are affected, using the matched workloads in [performance investigation](performance.md). Preserve correctness while optimizing; do not silently replace a working path with a cheaper approximation or remove required teardown. A visual correction without acceptable measured cost can remain held.

## Qualify and retain the decision

Choose checks from the boundaries the change actually touches. Start with the unchanged input and a concrete expected outcome; reproduce a suspected defect before fixing it when practical. Compare the correction under the same conditions, retain native fallback/disabled and relevant dependency-absence cases, and test the real owner/consumer. Source inspection, archive checks, native loading, rendered output, and observed gameplay each support different claims. Report the missing scope instead of making every addition run an unrelated full-pack matrix.

Record exact artifact/resource/configuration identities, commands, results, and the supported combinations in the existing authoring record or owning development guide. Distinguish a native-qualified selection, a source-reviewed candidate, and a held change with a specific unresolved boundary. Do not create another manifest or duplicate the configuration, input, equipment, or resource indexes. Keep transient diagnostic history and large captures with their private evidence owner.

Use the [dependency update sequence](patches.md#update-sequence), [authoring ownership](authoring.md), and [build/verification](build.md) for delivery. Rebuild through owning generators, inspect selected client/server exports, preserve explicit opt-outs and edited-file conflicts, and verify fresh defaults separately from retained seed preferences. Record coupled dependencies, target/resource preconditions, and the upstream behavior that would allow a repair to be retired. Confirm that behavior in the released artifact before removing a patch. Publication, personal sync, and world changes retain their separate authorization.
