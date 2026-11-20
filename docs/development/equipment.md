# Equipment evaluation

Use this register to review equipment, acquisition and presentation together. The Atlas owns current registry/acquisition evidence; this document owns pack decisions and review boundaries. A recipe/loot route is an opportunity, not proof of affordable progression or a working setup. Keep native values until an explicit balance decision; do not invent a blanket reduction across unrelated items.

## Review domains

Include tools, weapons, armor, accessories, storage, travel gear, portable utilities and functional stations/machinery. Exclude ordinary materials, decorative building palettes, mobs and terrain generation; note their dependencies where they supply equipment. Use exact registry IDs in Atlas searches. Native type evidence and curated selectors in `authoring/equipment.json` define the register; they do not change item behavior or acquisition.

`web/data/generated/equipment.json` is the rebuildable item-level review index. Each row retains its actual loaded provider/version, default components and export errors, associated blocks, review families and references to the Atlas's existing acquisition routes. Recipe, loot, trade, brewing, transformation and other indexed routes preserve their original conditions and raw probabilities. Missing routes remain explicit. A referenced route can be disabled by pack policy or unavailable in the current world; this index does not certify reachability, yield or gameplay functionality.

The 2026-11-18 native capture contains 9,928 items and 9,267 blocks from 212 loaded mod identities. The current rules classify 1,361 unique equipment items and leave 462 unclassified custom or block-entity items visible for triage, with 3,823 relevant potential acquisition routes. Families overlap; their counts must not be summed as distinct items. Plain ingredient items are not presumed to be equipment, so these counts are a review classification rather than an exhaustive functional assertion about every registry entry.

| Family | Items | Review boundary |
| --- | --: | --- |
| Tools | 66 | Harvesting, maintenance and inspection; preserve durability, actions and custom renderers. |
| Weapons | 61 | Native attack/projectile behavior, ammunition and Combat Nouveau timing; models do not establish mechanics. |
| Armor | 42 | Native protection and equipment slots, held versus worn appearance and synchronization. |
| Accessories | 96 | Curios/Accessories slot authority, active effects, duplicate capabilities and equipped layers. |
| Mobility | 47 | Flight, riding, falling, return journeys and moving-ship interactions. |
| Storage | 295 | Containers, Traveler's Backpacks, packages and related portable storage; capacity, custody and recovery need actual checks. |
| Portable utilities | 115 | Fluids, observation, recovery, reusable consumables and usable encounter items. |
| Workstations | 54 | Crafting, repair, enchanting and other placed work, including Illager Invasion's imbuing table. |
| Controls | 91 | Signals, commands and operating interfaces; authorization and real machinery operation remain separate. |
| Machinery | 579 | Power, production, transport and airship equipment; inspect fuel/cargo/assembly rather than assuming a recipe proves operation. |
| Parts and upgrades | 43 | Intermediate assemblies and equipment-changing components, distinguished from finished tools and ordinary ingredients. |

### Refresh and review

From `web/`, refresh the native registry with `pnpm data:runtime`, decorate it with `pnpm data:extract`, then run `pnpm data:equipment`. The exporter adds registered item/block type hierarchies, default-state block-entity evidence and actual loaded mod versions. A metadata placeholder such as `${file.jarVersion}` is not a resolved runtime version. The classifier refuses captures lacking the required type evidence.

For an isolated export, use explicit matching inputs rather than replacing the displayed Atlas snapshot:

```sh
pnpm data:equipment --runtime /path/to/runtime --catalog /path/to/catalog.json --output /path/to/equipment.json
```

The command requires a complete, unchanged Minecraft 1.21.1 export and a catalog with matching item IDs. It hashes the input files, classification definitions and authored acquisition/progression sources, records runtime/lock/capture identity, and publishes the index atomically. Registry, block and route iteration order does not determine row ordering. Native component arrays retain their semantics and are not claimed byte-identical across boots.

Review `entries` by family/provider and `uncertain` for missing classifications. Follow each row's `acquisition` IDs into `routes`; retain conditions, alternatives and enabled-item filtering when proposing balances. Extend the canonical selectors for new equipment, regenerate, and inspect the resulting additions/removals. Item types and block interfaces are separate: a machine accepting a wrench does not make its held block item a tool. Functional correctness, renderer qualification and owner acceptance remain per-item decisions. The resource comparison workbench is a separate saved intent, not an implemented interface in this register.

## Artifacts

The selected equipment source is [Artifacts 13.2.5](https://modrinth.com/mod/artifacts/version/lMfuK0o7). `config/artifacts/general.toml` is a managed pack rule. Campsite attempts are disabled; their native global-Y placement and campsite-driven mimics require a separate island/encounter decision. Preserve native rarity, entity-equipment and archaeology settings for this review. The generated client/preferences and untouched per-item defaults are not distributed as extra authored files.

Two independent dedicated boots with the existing Curios/Accessories/compatibility-layer/owo stack retained identical general, item and client config bytes. This qualifies loading and unchanged serialization, not equipment actions, slot semantics or visual presentation. The native general file retains rarity 1.0, entity-equipment chance 0.0015 and archaeology chance 0.0625. The rarity adjustment for an eligible loot pool is `p / (p + r - r*p)`; at the retained `r=1` it equals that pool's declared `p`. Other weights, rolls, enabled-item conditions and actual queried loot-table IDs still apply.

Village/world counts are not denominators for these chances. A matching vanilla loot-table hook may be used by a donated structure piece, but a regional village name alone does not establish its loot-table identity. The following references describe upstream resource routes; campsite/mimic routes are inactive under the current policy, and external or conditional references remain explicit.

[Artifacts 3D](https://modrinth.com/resourcepack/artifacts-3d/version/kYgAZhY6) supplies 47 item definitions through Modefite and item-specific Punchy tuning. It does not replace equipped Artifacts models; the animated umbrella retains its native held path. The controls below qualify default equipped poses; real actions, equipment combinations, remaining held cases and shader/reload behavior need separate native checks.

### Native slot and rendering checks

The 2026-11-18 isolated packaged client checks all 45 wearable Artifacts through the installed Curios/Accessories compatibility stack. Native eligibility and inventory validation select real slots, and client-side inventory reads confirm receipt before each capture. The resulting slot families are anklet, belt, feet, hands, head and necklace; these are observed through the bridge, not assumed from source tags. Empty hands separate equipped layers from the 3D held-item pack. Representative hats, goggles, gloves and footwear remain attached to the Moves player model.

The 93 shader-off captures report no GL errors or model-load failures. Crystal Heart raises the client's synchronized maximum health from 20 to 30; removing equipment restores the original maximum health, attack speed, movement speed, scale and luck. This qualifies the native slot/synchronization path, default equipped poses and that attribute effect. It does not prove every ability, equipment combination, combat/moving-ship interaction, resource option/reload, shader or remote-server behavior. The separate Compat model-rotation adapter repairs four held meshes; it does not own these equipped models. Follow the [coupled dependency release rule](patches.md) before shipping artwork that needs this adapter.

### Item decisions

All rows retain native effect/loot values for owner triage. The effect wording comes from the pinned configuration definitions; it is not a measured gameplay claim. Source references identify the corresponding table definitions below.

| Registry item | Effect or native setting | Loot references |
| --- | --- | --- |
| `artifacts:anglers_hat` (Angler's Hat) | The amount of extra levels of luck of the sea that are granted by the Angler's Hat | L01, L02, L05, L11, L12, L13, L17, L25, L33, L37 |
| `artifacts:antidote_vessel` (Antidote Vessel) | the Antidote Vessel reduces the duration of negative effects | L01, L02, L05, L11, L12, L24, L34, L37 |
| `artifacts:aqua_dashers` (Aqua-Dashers) | the Aqua-Dashers allow the wearer to sprint on water | L01, L02, L06, L07, L08, L09, L11, L12, L13, L24, L37 |
| `artifacts:bunny_hoppers` (Bunny Hoppers) | How much the Bunny Hoppers reduce or increase fall damage | L01, L02, L06, L11, L12, L13, L17, L33, L37 |
| `artifacts:charm_of_shrinking` (Charm of Shrinking) | How much the Charm of Shrinking decreases or increases the player's Scale | L01, L02, L07, L11, L12, L18, L20, L22, L36, L37 |
| `artifacts:charm_of_sinking` (Charm of Sinking) | the Charm of Sinking removes the wearer's collision with water | L01, L02, L04, L09, L11, L12, L14, L21, L34, L37 |
| `artifacts:chorus_totem` (Chorus Totem) | the Chorus Totem is consumed after activating | L01, L02, L11, L12, L15, L37 |
| `artifacts:cloud_in_a_bottle` (Cloud in a Bottle) | the Cloud in a Bottle allows the wearer to double jump | L01, L02, L07, L08, L11, L12, L15, L19, L25, L37 |
| `artifacts:cowboy_hat` (Cowboy Hat) | How much the Cowboy Hat increases the speed of ridden mounts | L01, L02, L03, L11, L12, L18, L20, L37 |
| `artifacts:cross_necklace` (Cross Necklace) | The amount of extra ticks the player stays invincible for after taking damage while wearing the Cross Necklace | L01, L02, L11, L12, L18, L19, L25, L34, L37 |
| `artifacts:crystal_heart` (Crystal Heart) | The amount of extra health points that are granted by the Crystal Heart | L01, L02, L11, L12, L15, L19, L37 |
| `artifacts:digging_claws` (Digging Claws) | How much the Digging Claws increase the wearer's mining speed | L01, L02, L05, L08, L11, L12, L13, L35, L37 |
| `artifacts:eternal_steak` (Eternal Steak) | Reusable cooked food with a 15-second cooldown | Cook `artifacts:everlasting_beef`: furnace 200 ticks, smoker 100 or campfire 600 (`artifacts:eternal_steak_furnace`, `_smoker`, `_campfire`) |
| `artifacts:everlasting_beef` (Everlasting Beef) | the Everlasting Beef can be eaten | L01, L02, L11, L12, L27, L37, L38, L39 |
| `artifacts:feral_claws` (Feral Claws) | How much the Feral Claws increase the wearer's attack speed | L01, L02, L07, L11, L12, L13, L21, L36, L37 |
| `artifacts:fire_gauntlet` (Fire Gauntlet) | How long an entity is set on fire for after being attacked by an entity wearing the Fire Gauntlet | L01, L02, L05, L11, L12, L20, L25, L37 |
| `artifacts:flame_pendant` (Flame Pendant) | The duration in seconds the Flame Pendant goes on cooldown for after setting an entity on fire | L01, L02, L07, L11, L12, L14, L37 |
| `artifacts:flippers` (Flippers) | How much the Flippers increase the wearer's swim speed | L01, L02, L11, L12, L13, L21, L25, L37 |
| `artifacts:golden_hook` (Golden Hook) | The amount of extra experience dropped by entities that are killed by players wearing the Golden Hook | L01, L02, L11, L12, L13, L21, L37 |
| `artifacts:helium_flamingo` (Helium Flamingo) | The duration in seconds the Helium Flamingo goes on cooldown for when stopping flight | L01, L02, L09, L11, L12, L15, L24, L37 |
| `artifacts:kitty_slippers` (Kitty Slippers) | Repels creepers, hisses at phantoms and changes hurt sounds | L01, L02, L03, L11, L12, L13, L17, L33, L37 |
| `artifacts:lucky_scarf` (Lucky Scarf) | The amount of extra levels of fortune that are granted by the Lucky Scarf | L01, L02, L05, L11, L12, L13, L16, L20, L24, L25, L37 |
| `artifacts:night_vision_goggles` (Night Vision Goggles) | The strength of the night vision effect applied by the Night Vision Goggles | L01, L02, L03, L08, L11, L12, L18, L20, L21, L37 |
| `artifacts:novelty_drinking_hat` (Novelty Drinking Hat) | Increases eating and drinking speed; native bonus fields remain unchanged. | L01, L02, L04, L08, L11, L12, L13, L18, L37 |
| `artifacts:obsidian_skull` (Obsidian Skull) | The amount of time in seconds the Obsidian Skull goes on cooldown for after taking fire damage | L01, L02, L03, L08, L11, L12, L20, L21, L37 |
| `artifacts:onion_ring` (Onion Ring) | The duration of haste that is applied per food point eaten while wearing the Onion Ring | L01, L02, L06, L08, L09, L11, L12, L14, L37 |
| `artifacts:panic_necklace` (Panic Necklace) | The duration in seconds the Panic Necklace goes on cooldown for after taking damage | L01, L02, L08, L11, L12, L19, L37 |
| `artifacts:pickaxe_heater` (Pickaxe Heater) | the Pickaxe Heater smelts mined ores | L01, L02, L07, L08, L09, L11, L12, L24, L37 |
| `artifacts:plastic_drinking_hat` (Plastic Drinking Hat) | Increases eating and drinking speed; native bonus fields remain unchanged. | L01, L02, L04, L08, L11, L12, L13, L18, L37 |
| `artifacts:pocket_piston` (Pocket Piston) | The amount of extra knockback that is granted by the Pocket Piston | L01, L02, L07, L11, L12, L18, L19, L35, L37 |
| `artifacts:power_glove` (Power Glove) | The amount of extra damage that is dealt by melee attacks from players wearing the Power Glove | L01, L02, L03, L11, L12, L19, L20, L24, L25, L37 |
| `artifacts:rooted_boots` (Rooted Boots) | the Rooted Boots replenish hunger when standing on grass | L01, L02, L07, L09, L11, L12, L17, L19, L24, L37 |
| `artifacts:running_shoes` (Running Shoes) | How much the Running Shoes increase the wearer's sprinting speed | L01, L02, L06, L11, L12, L18, L21, L26, L37 |
| `artifacts:scarf_of_invisibility` (Scarf of Invisibility) | the Scarf of Invisibility makes players invisible | L01, L02, L11, L12, L14, L19, L21, L33, L37 |
| `artifacts:shock_pendant` (Shock Pendant) | the Shock Pendant cancels damage from lightning | L01, L02, L03, L09, L11, L12, L14, L37 |
| `artifacts:snorkel` (Snorkel) | the Snorkel's water breathing effect depletes when underwater | L01, L02, L03, L11, L12, L13, L21, L25, L37 |
| `artifacts:snowshoes` (Snowshoes) | the Snowshoes allow the wearer to walk on powdered snow | L01, L02, L07, L10, L11, L12, L16, L31, L32, L37 |
| `artifacts:steadfast_spikes` (Steadfast Spikes) | How much knockback resistance is granted by the Steadfast Spikes | L01, L02, L07, L11, L12, L19, L21, L26, L37 |
| `artifacts:strider_shoes` (Strider Shoes) | the Strider Shoes allow sneaking on lava | L01, L02, L06, L11, L12, L18, L20, L22, L37 |
| `artifacts:superstitious_hat` (Superstitious Hat) | The amount of extra levels of Looting that are granted by the Superstitious Hat | L01, L02, L04, L08, L11, L12, L19, L24, L25, L26, L37 |
| `artifacts:thorn_pendant` (Thorn Pendant) | The duration in seconds the Thorn Pendant goes on cooldown for after activating | L01, L02, L07, L11, L12, L14, L20, L37 |
| `artifacts:umbrella` (Umbrella) | the Umbrella slows the player's falling speed when held | L01, L02, L04, L11, L12, L13, L14, L33, L37 |
| `artifacts:universal_attractor` (Universal Attractor) | The level of the magnetism effect that is applied by the Universal Attractor | L01, L02, L04, L11, L12, L14, L20, L21, L37 |
| `artifacts:vampiric_glove` (Vampiric Glove) | The probability that damage is absorbed when attacking an entity with the Vampiric Gloves | L01, L02, L06, L08, L11, L12, L14, L26, L37 |
| `artifacts:villager_hat` (Villager Hat) | The amount of extra reputation that is granted by the Villager Hat when trading with villagers | L01, L02, L07, L11, L12, L16, L28, L29, L30, L31, L32, L37 |
| `artifacts:warp_drive` (Warp Drive) | the Warp Drive causes ender pearls to not be consumed | L01, L02, L04, L09, L11, L12, L15, L22, L34, L37 |
| `artifacts:whoopee_cushion` (Whoopee Cushion) | The probability that a fart sound plays when sneaking or double jumping while wearing the Whoopee Cushion | L01, L02, L07, L11, L12, L14, L23, L33, L37 |
| `artifacts:withered_bracelet` (Withered Bracelet) | The duration the Withered Bracelet goes on cooldown for after inflicting wither on an entity | L01, L02, L05, L11, L12, L18, L22, L37 |

### Loot-source definitions

These are source-resource links, not final rates. Each table can contain more than one pool and can be disabled by configuration or absent from a given world. The table shows pool rolls and the sum of top-level entry weights before enabled-item filtering. Nested alternatives, conditional entries and luck can change the effective denominator; inspect the linked resource for a particular roll. Archaeology additionally uses the configured 0.0625 injection chance. Camp and mimic tables remain inactive under the selected campsite policy.

| Reference | Upstream table | Pool eligibility and choice denominator |
| --- | --- | --- |
| L01 | `artifacts:chests/campsite_chest` | 1.0–3.0 rolls, 17 top-level choices / total weight 36; 1.0–4.0 rolls, 11 top-level choices / total weight 45; 1.0–4.0 rolls, 5 top-level choices / total weight 16; p=0.3, 1 roll, 3 top-level choices / total weight 13; rarity-adjusted p=0.15, 1 roll, 1 top-level choices / total weight 1 |
| L02 | `artifacts:entities/mimic` | 1 roll, 1 top-level choices / total weight 1 |
| L03 | `artifacts:inject/archaeology/desert_pyramid` | 1 roll, 7 top-level choices / total weight 7 |
| L04 | `artifacts:inject/archaeology/desert_well` | 1 roll, 6 top-level choices / total weight 6 |
| L05 | `artifacts:inject/archaeology/ocean_ruin_cold` | 1 roll, 6 top-level choices / total weight 6 |
| L06 | `artifacts:inject/archaeology/ocean_ruin_warm` | 1 roll, 6 top-level choices / total weight 6 |
| L07 | `artifacts:inject/archaeology/trail_ruins_rare` | 1 roll, 13 top-level choices / total weight 13 |
| L08 | `artifacts:inject/chests/abandoned_mineshaft` | rarity-adjusted p=0.3, 1 roll, 11 top-level choices / total weight 12 |
| L09 | `artifacts:inject/chests/ancient_city` | rarity-adjusted p=0.15, 1 roll, 8 top-level choices / total weight 8 |
| L10 | `artifacts:inject/chests/ancient_city_ice_box` | rarity-adjusted p=0.2, 1 roll, 1 top-level choices / total weight 1 |
| L11 | `artifacts:inject/chests/bastion_hoglin_stable` | rarity-adjusted p=0.25, 1 roll, 7 top-level choices / total weight 21 |
| L12 | `artifacts:inject/chests/bastion_treasure` | rarity-adjusted p=0.65, 1 roll, 8 top-level choices / total weight 18 |
| L13 | `artifacts:inject/chests/buried_treasure` | rarity-adjusted p=0.25, 1 roll, 12 top-level choices / total weight 44 |
| L14 | `artifacts:inject/chests/desert_pyramid` | rarity-adjusted p=0.2, 1 roll, 10 top-level choices / total weight 14 |
| L15 | `artifacts:inject/chests/end_city_treasure` | rarity-adjusted p=0.3, 1 roll, 5 top-level choices / total weight 14 |
| L16 | `artifacts:inject/chests/igloo_chest` | rarity-adjusted p=0.3, 1 roll, 3 top-level choices / total weight 4 |
| L17 | `artifacts:inject/chests/jungle_temple` | rarity-adjusted p=0.35, 1 roll, 4 top-level choices / total weight 6 |
| L18 | `artifacts:inject/chests/nether_bridge` | rarity-adjusted p=0.15, 1 roll, 9 top-level choices / total weight 9 |
| L19 | `artifacts:inject/chests/pillager_outpost` | rarity-adjusted p=0.25, 1 roll, 10 top-level choices / total weight 10 |
| L20 | `artifacts:inject/chests/ruined_portal` | rarity-adjusted p=0.15, 1 roll, 10 top-level choices / total weight 10 |
| L21 | `artifacts:inject/chests/shipwreck_treasure` | rarity-adjusted p=0.15, 1 roll, 11 top-level choices / total weight 13 |
| L22 | `artifacts:inject/chests/simple_dungeon` | rarity-adjusted p=0.15, 1 roll, 4 top-level choices / total weight 4 |
| L23 | `artifacts:inject/chests/spawn_bonus_chest` | rarity-adjusted p=1.0, 1 roll, 1 top-level choices / total weight 1 |
| L24 | `artifacts:inject/chests/stronghold_corridor` | rarity-adjusted p=0.3, 1 roll, 8 top-level choices / total weight 8 |
| L25 | `artifacts:inject/chests/underwater_ruin_big` | rarity-adjusted p=0.45, 1 roll, 9 top-level choices / total weight 13 |
| L26 | `artifacts:inject/chests/village/village_armorer` | rarity-adjusted p=0.1, 1 roll, 4 top-level choices / total weight 4 |
| L27 | `artifacts:inject/chests/village/village_butcher` | rarity-adjusted p=0.05, 1 roll, 1 top-level choices / total weight 1 |
| L28 | `artifacts:inject/chests/village/village_desert_house` | rarity-adjusted p=0.05, 1 roll, 1 top-level choices / total weight 1 |
| L29 | `artifacts:inject/chests/village/village_plains_house` | rarity-adjusted p=0.05, 1 roll, 1 top-level choices / total weight 1 |
| L30 | `artifacts:inject/chests/village/village_savanna_house` | rarity-adjusted p=0.05, 1 roll, 1 top-level choices / total weight 1 |
| L31 | `artifacts:inject/chests/village/village_snowy_house` | rarity-adjusted p=0.08, 1 roll, 2 top-level choices / total weight 2 |
| L32 | `artifacts:inject/chests/village/village_taiga_house` | rarity-adjusted p=0.08, 1 roll, 2 top-level choices / total weight 2 |
| L33 | `artifacts:inject/chests/village/village_tannery` | rarity-adjusted p=0.2, 1 roll, 6 top-level choices / total weight 9 |
| L34 | `artifacts:inject/chests/village/village_temple` | rarity-adjusted p=0.2, 1 roll, 4 top-level choices / total weight 4 |
| L35 | `artifacts:inject/chests/village/village_toolsmith` | rarity-adjusted p=0.15, 1 roll, 2 top-level choices / total weight 2 |
| L36 | `artifacts:inject/chests/village/village_weaponsmith` | rarity-adjusted p=0.1, 1 roll, 2 top-level choices / total weight 3 |
| L37 | `artifacts:inject/chests/woodland_mansion` | rarity-adjusted p=0.4, 1 roll, 2 top-level choices / total weight 3 |
| L38 | `artifacts:inject/entities/cow` | Configured cow/mooshroom drop; configured chance, 1 roll, 1 top-level choices / total weight 1 |
| L39 | `artifacts:inject/entities/mooshroom` | Configured cow/mooshroom drop; configured chance, 1 roll, 1 top-level choices / total weight 1 |

### Update and retirement checks

Update the mod, slot libraries and visual addon deliberately. Recheck registered IDs, native common/client settings, serialization and explicit opt-outs, inventory/slot authority, loot hooks and denominator semantics, and ordinary/Punchy/equipped render ownership. Repeat an isolated generated-config reopen before changing file ownership. Keep campsite/world-height work separate from equipment introduction. The current resource and native-config findings do not qualify arbitrary ship physics, modded mob equipment or new encounter balancing.
