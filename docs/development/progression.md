# Progression review

The current source combines island exploration, Create production and Aeronautics transport. The Atlas records potential acquisition; it does not prove affordable quantities, working machinery or a safe outward and return journey. Saved-world surveys and isolated generation samples have separate dates and provenance; use [world generation](worldgen.md) for the selected terrain profile.

## Resources and processing

Keep geological variants distinct while unifying interchangeable manufactured materials. Almost Unified previously replaced specific ore inputs with broad ore tags: stone and deepslate iron matched both crushing recipes despite different outputs and durations. Ore tags are now excluded from unification; ingots, plates and the Create Deco zinc-sheet preference remain unified.

Platinum uses Create's existing crushing family. The three overlapping Propulsion ore/raw-block recipes are disabled through native data-load conditions. This chooses consistent metal and XP yields rather than leaving recipe selection to resolve conflicting alternatives. Propulsion still owns platinum items, worldgen, washing, smelting and other processing. The spruce-log and copycat-wing recipes also now use Create 6's `processing_time` field, preserving their authored 150- and 50-tick work durations. These are recipe work values, not fixed wall time independent of machine speed.

Native exports verified that exact-input crushing collision groups fell from nine to zero. This does not establish that all partial overlaps across every recipe system are gone. Existing crafting alternatives, including copycat shapes and vault conversions, remain selectable through Polymorph; no blanket recipe removal was applied to decorative choices.

The archived survey supports vertical resource specialization: iron and coal were common, while diamonds and most redstone were concentrated in deepslate. Preserve that reason to explore deeper terrain before increasing global ore rates. Skyweave: Compatibility Patches maps those bands into each anchor's geological span; [generated samples](worldgen.md#geology-and-features) now confirm zinc and other starting resources, with diamond/platinum in deep interiors. Mining access, travel time and whole-island quantities remain separate gameplay checks. Gold washing supplies a separate 5% platinum-nugget chance. At that rate, one ingot takes 180 crushed-gold washes on average, not a guaranteed batch.

## Leather

JRFTL 1.8.0 supplies prepared flesh, with its managed `general.enableHardMode` set to `true`. Craft four rotten flesh in a 2×2 grid into one prepared flesh, then cook it into one leather: 200 ticks in a furnace, 100 in a smoker, or 600 on a campfire. The campfire recipe belongs to Resource Patches and loads only with JRFTL installed. Direct rotten-flesh cooking is disabled by the native hard-mode conditions. Restart after changing hard mode.

The chain requires no water, cattle, or machinery. Existing animal, loot, and other leather acquisition remains available. Create fan smoking uses the native smoking recipe; there is no second custom automation recipe. The intermediate is a registered item supplied on both sides, so recipe JSON alone cannot replace the JRFTL dependency. Keep its config and campfire recipe aligned when updating or removing it.

## Grappling hooks and leads

Grappling hooks have two shaped crafting-table recipes. Both use the pattern below and produce one identical Skybound hook:

```text
. H B
. C H
R . .
```

`.` is an empty slot. `B` is either ordinary wheat dough or leather, `C` is a chain, and `R` is a Simulated rope coupling. The improvised recipe requires an iron pickaxe in **both** `H` slots; the manufactured recipe requires an iron sheet in **both**. A pickaxe/sheet mixture is rejected. The press route reduces the head material from six iron ingots’ worth of pickaxes to two iron sheets. Rope coupling adds three string and two iron nuggets, and the chain has its own shared cost. Milling and water supply dough; JRFTL prepared-flesh cooking supplies leather without cattle or water. These are alternative acquisition paths, not extra hook capabilities.

The native pickaxe-plus-lead hook recipe is replaced. Leads retain their vanilla four-string shape and two-lead output, with **ordinary wheat dough replacing the slimeball**. This removes the lime-dye/slime requirement from lead crafting without changing slime production or other slime consumers. Leads are no longer a hook ingredient.

Resource Patches owns the two hook recipes, the lead override, and their recipe-book unlock adjustments. Keep exact recipe IDs aligned on Skybound/Create/Simulated updates, inspect new native alternatives before replacing them, and retain binder alternatives and separate head ingredients. These are pack recipes; conditional resources avoid missing optional item references, and the lead override requires Create. Saved crafting knowledge can retain an earlier unlock, while new-player discovery must follow the current ingredients. Rebuild Resource Patches after edits; do not patch installed mod JARs.

## Ropes and connection limits

Simulated's managed `blocks.max_rope_range` sets the rope-connection ceiling to 255 blocks; its native accepted range is 0–1000. This changes connection admission, not the throwable addon's projectile range: configured hand throws are 16, handheld launchers 64, and mounted launchers 128 blocks. The Compat startup repair preserves those preferences before the native server ceiling is available. Projectile trajectory and useful attachment reach still need their own qualification. Retain native-generated configuration comments for byte-stable startup; their upstream default descriptions are not the pack’s effective values. The plunger launcher has its own 64-block separation limit. Existing world-local server configs can override installation defaults; inspect the loaded world's `serverconfig/simulated-server.toml` during a local update.

Skybound's separate managed `maxRopeLength` default is 64 blocks. Explicit lengths already stored on customized hooks remain authoritative; the native customization ceiling is still 255. These settings do not extend chunk loading or guarantee a projectile can reach its nominal length.

Authored connection and transport limits:

| Mechanism | Current limit | Separate consideration |
| --- | --- | --- |
| Throwable rope connector | Hand 16, handheld launcher 64, mounted launcher 128 blocks | Native tool maxima are 128/1000/1000; Simulated's 255-block ceiling also applies. Raising the connection ceiling alone does not extend these shots. |
| Plunger launcher | 64 blocks between launched plungers | Independent of rope-connector and Skybound limits. |
| Create mechanical belt | 20 blocks | A kinetic transport link, not a physical rope constraint. |
| Create chain conveyor | 32 blocks per connection, 4 connections per conveyor | Longer spans and more branches are separate settings. |
| Create rope pulley | 512 blocks of rope | Vertical contraption travel; independent of Simulated connectors. |
| Coupled minecarts | 32 blocks separation | Independent of rope and railway placement limits. |
| Weighted ejector | 64 blocks | Relevant to short player/cargo crossings; increasing range does not provide safe landing or return travel. |
| Redstone link | 256 blocks | Signal range does not load distant chunks. The relocation GUI has a separate 24-block move limit. |
| Display link | 64 blocks to target | Independent of redstone signal range. |
| Mechanical arm / package port | 5 blocks each | Local inventory-transfer reach. |
| Mechanical pump / hose pulley | 16 blocks of pipe on each pump side / 128-block fluid search | Pipe reach and fluid-body search are different costs. |
| Escalated walkway / escalator | 128 blocks long / 32 blocks high | Fixed infrastructure, not a dynamic rope. |
| Simulated honey glue / merging glue | 48 / 4 blocks | Initial assembly/merge placement reach. |
| Simulated docking connectors | 0.5-block distance and 20-degree angular tolerance | Alignment tolerances, not a long-distance connection system. |

Keep the selected 16/64/128 profile while qualifying actual flight, targeting and custody. The 255-block connection ceiling does not select a 255-block projectile profile. The selected firing ranges are 16/64/128 blocks, with 512-block vertical pulley travel for tall islands. Pulley travel is also bounded by the remaining world depth below its position; it is independent of the 255-block Simulated connector limit. In pinned throwable-connector 0.4.3, both launchers fire gravity-affected projectiles at speed 3 blocks/tick. A discrete vanilla-air estimate at 30-degree elevation gives about 153 horizontal blocks at the same height, before muzzle corrections, collisions, and moving-ship transforms. Thus 255 is a connection/range ceiling, not a guarantee of level-to-level anchor placement. Newer upstream 0.5.0 sources add gravity-free coupling redocking; those mechanics are absent from the selected 0.4.3 artifact. Conveyor, signal, and fluid changes should follow specific builds rather than a blanket range increase. These are configuration/source observations, not long-span physics or throughput measurements. Their owners are `create_aeronautics_throwable_rope_connector-common.toml`, `simulated-server.toml`, `create-server.toml`, `createredstonelinkgui-common.toml`, and `escalated-server.toml` under the shared config overrides.

### Ballistic limits

The [longshot interaction index](longshot-interactions.md) owns cross-system discovery requirements for extended targeting, presentation, server authority, and deliberate loading. Current settings and the observations below remain separate from proposed future ranges.

Range settings are separate from the flight model, attachment rules, client tracking, and loaded simulation area. The current review uses the selected released JARs: throwable connector 0.4.3, Skybound 1.1, Create 6.0.10, and Simulated 1.3.2 before the current 1.3.3 migration. Requalify version-sensitive observations against the runtime candidate; these are retained source findings, not new 1.3.3 flight qualification. Newer upstream connector source is not evidence of behavior in 0.4.3.

| System | Actual limiting mechanisms | Consequence of a larger range setting |
| --- | --- | --- |
| Throwable connector | Hand speed 1.5 blocks/tick; both launchers use fixed speed 3. Vanilla air drag is about 0.99 per tick and gravity 0.03 blocks/tick². Mounted pitch is limited to ±30 degrees. The distance check is radial from the launch origin. | Hand velocity is configurable; launcher velocity is not exposed in the selected addon config. A larger range cap changes neither speed nor gravity. Equal-height mounted reach is about 153 blocks in a simplified static-air estimate, before muzzle corrections and moving frames. |
| Connector startup | Its COMMON-config listener limits all three ranges using Simulated's rope ceiling. When that SERVER config is unavailable, the lookup catches the failure and substitutes 40. | Above-40 authored launcher values can be reduced before the real 255-block ceiling loads. With Compat’s optional `throwable_rope_connector.range_limits` adaptation enabled, configured values remain intact; effective readers apply the loaded server ceiling, including zero. JSON/TOML editing alone cannot repair the native lifecycle boundary. Existing saved values already reduced to 40 need an explicit owner-selected restore. |
| Connector presentation | The projectile type declares a base tracking range of 4 chunks (about 64 blocks before server scaling) and update interval of 10 ticks. It also inherits ThrowableProjectile’s size-based render-distance test: its 0.25-block dimensions yield about 64 blocks at ordinary client scaling. | Tracking may end before a 128-block shot does. This is a source-identified visibility risk, not a captured disappearance. Review server tracking, client render distance, frustum bounds, and rope-trail geometry together before changing packet cadence; shared client prediction means a ten-tick interval is not proof of visible stutter. |
| Skybound | Default launch speed 2 plus positive shooter motion along the throw; base gravity 0.1 times its multiplier, with air drag. Registered customization bounds are rope length 1–255, throw speed 0.01–5, and gravity multiplier 0–8. Rope bends consume the available path length. | A longer rope does not launch the hook farther by itself. A stationary default shot has only about 35 blocks of equal-height reach in a simple air model, while falling, lower targets, movement, and customizations change its useful reach. Existing customized items retain their values. |
| Skybound movement | Current horizontal and upward speed caps are each 4 blocks/tick before its slowness factor. Its vertical cap applies to positive upward motion, not all falling speed. Create/Sable attachment tracing uses a separate guarded flight path near moving geometry. | Hook flight, rope allowance, and player movement are separate controls. Preserve moving-frame collision and rope-wrap behavior when tuning; no hook changes are selected by this review. |
| Simulated plunger | Gravity-affected projectile, normal corrected launch velocity 1.35, fixed 48-block aim-correction ray, and a separate 64-block owner/pair separation limit. Pull strength stops growing with separation after its 12-block force-vector clamp, before mass/timestep scaling. | Raising the separation setting alone does not improve aim correction, flight, or pulling strength. It is a temporary pulling/attachment tool, independent of Simulated's 255-block rope-connector allowance. |
| Create weighted ejector | Its native solver recalculates launch velocity for the selected destination, then applies separate horizontal and absolute vertical clamps. At 64, the solver retains a 64-block horizontal destination with finite flight time. | This scales differently from a fixed-speed projectile. A valid calculated trajectory is not a measured landing: intervening blocks, movement inputs, equipment, and moving launch surfaces still need gameplay checks. |
| Create potato cannon | Projectile gravity and drag depend on its ammunition type; the projectile applies its own movement update. | Connector or ejector range changes do not affect it. Any later ammunition rebalance must inspect the selected ammo definition and its native callbacks rather than applying one global projectile adjustment. |
| Create Big Cannons | Ammunition JSON owns per-projectile gravity, drag, and charge requirements; propellant JSON owns charge strength. The pack enables Sable projectile velocity inheritance. | Artillery has its own data-driven profiles. Rope/ejector limits do not scale shell range; retain its existing moving-ship integration when reviewing later ballistics changes. |

The air-flight estimates are calculations, not observed shots. They assume a stationary origin, equal-height destination, and no intervening collisions; they omit muzzle offsets, holder motion, rope bends, and Sable transforms. None of these range settings grants chunk tickets or makes DH terrain into loaded collision data. Do not force distant terrain loads as a side effect of aiming or previewing a shot.

The optional startup adaptation addresses the configuration mutation. Qualifying projectile tracking across the configured range is the next separate engineering step. Keep optional repairs local to their native owner. Retain swept collision, launch-origin and moving-target frame conversions, server attachment authority, and missing-host cleanup. Broader flight-profile changes should come with useful aiming feedback and an actual range/height test, rather than globally changing projectile gravity or speed.

## Mechanical alternatives

Linear Bearing supplies passive guides with powered brakes, short-range magnetic couplings, spring-linked transmission and a gyro/converter angular-rate sensor. All transmission uses a real external drive and its stress budget. These are alternatives for reusable moving machinery, not a mandatory technology tier or free energy. The guide is not a powered actuator. Equipment journal entries explain setup without claiming a working installation; see [compatibility](compatibility.md#linear-bearing).

[Transmission & Linkage](https://modrinth.com/mod/create-aeronautics-transmission-linkage) is installed. Its hydraulic rods, redstone length controls, joints and rotational energy conversion cover a broader role than a guide rail; it is not a direct replacement merely because both move structures. Review extension, return force and damping as control choices before adding journal routes. [Absolute Kinematics](https://www.curseforge.com/minecraft/mc-mods/absolute-kinematics) 1.0.1 adds a shaft-driven 180-degree hinge and a passive ball joint. Both pass rotation into attached machinery. Their two recipes retain native wooden slabs, industrial iron blocks and a gearbox or brass ingot. No new compulsory tier or recipe gate is introduced; the journal distinguishes equipment from working joints. Native fixtures verified interaction assembly, a real 16-RPM hinge drive reaching its 90-degree stop, ball-joint redstone lock/release, and payload recovery. Large articulated aircraft and long-term constraint behavior remain play checks.

## Equipment maintenance

Easy Anvils retains repair-material and XP costs, but removes the 40-level cap, ignores prior-work penalties for repairs/renames and limits penalty growth when adding enchantments. Book application costs are halved. Renaming is free; repair materials restore 25% durability per unit. Iron blocks repair anvil damage, with dispenser support. These defaults support keeping useful equipment instead of replacing it solely because accumulated penalties make repairs impractical.

Easy Magic retains 15 bookshelves for maximum power. A reroll costs one lapis and five XP points, not five levels. All offered enchantments are visible; rerolls remain paid. Bookshelves behind non-full collision blocks still count, and facing chiseled bookshelves supply power from stored books. Existing vanilla workstations remain usable; new placements and generated replacements use the enhanced blocks.

Inventory Totem allows a totem in the main inventory to satisfy an ordinary totem save. It consumes the totem and does not create a rescue item, teleport route or return journey. Repair, enchanting and totem acquisition still depend on existing resources. No new mandatory journal step or crafting gate was added.

## Production and travel

Basic balloon hardware does not require brass. The installed assembler, adjustable burner and andesite/wooden propeller use andesite alloys, iron sheets, redstone and wooden parts. Iron nuggets can supply the alloys without zinc. Zinc remains important for brass and subsequent machinery; its presence alone does not establish an initial aircraft route.

A hand-crafted parts subtotal for one mechanical press, hand crank, eight shafts, assembler, adjustable burner, propeller and super glue is 20 andesite, 21 iron ingots, one redstone dust and two slimeballs, plus wood, stone and a burner-fire ingredient. An iron pickaxe adds three ingots. This uses the current one-alloy crafting yield and leaves spare shafts/nuggets. It excludes the envelope, hull, control/power system and machinery needed for an alternate slime source; it is not a complete flyable-ship budget. The native loaded-flight fixture used creative power. All six distributed island samples contained iron, andesite and redstone, but mining access and wool/slime acquisition still require survival playtesting.

| System | Current behavior | Design implication |
| --- | --- | --- |
| Early brass | A fueled Propulsion Solid Burner supplies basin heat without blaze capture. | Metalworking can precede the Nether; fuel and a working mixer still matter. |
| Superheat | Native heat checks accept a coal-fired solid burner as superheated. | This overlaps blaze cakes. The steam-engine superheat switch is not a basin-specific control. Do not pretend a cake gate exists. |
| Turpentine | Crushing spruce logs gives resin at 60%; one resin and 250 mB water mix into 250 mB fuel without heat. | Spruce access and Crushing Wheels matter; a heated fuel refinery is not required. |
| Liquid thrust | A standard 1,000 mB tank at full throttle lasts about 33.3 s on turpentine or 50 s on lava at 20 TPS. Turpentine has 100% thrust, lava 75%. | Turpentine is stronger but currently slightly worse in thrust per fuel volume. These budgets exclude multiblocks/oxidizer and do not measure flight range. |
| Gliding | Membranes supply crafting and repair; tagged heat blocks provide a 15-block updraft range. | Gliders suit local crossings and prepared ascent points. Sleeping habits affect membrane encounters; no artificial membrane gate is needed. |
| Ropes | Rope connections allow 255 blocks; throwable hand/launcher/mount ranges are 16/64/128 and the plunger reaches 64. | The connection ceiling and tool firing ranges are separate. See [connection limits](#ropes-and-connection-limits). |
| Personal grappling | Skybound's hook uses a rope coupling, chain, dough/leather binder, and two matching pickaxes or iron sheets. The pack sets the default rope length to 64 blocks. | Cordage/binder acquisition, projectile drop, and a reachable anchor still matter. Throw physics and upgrade bounds remain native; rope length alone does not establish horizontal crossing range. |
| Flywheel Bearing | The block is enabled, but kinetic storage is disabled. Its recipe already requires brass. | It currently has no storage role. Do not describe it as an early energy buffer until that feature is enabled and tested. |
| Backpacks | Base storage is 27 slots, with larger tiers and portable processing upgrades. | Ships need roles beyond carrying a player's normal inventory: mounted machines, bulk flows and physical delivery cargo. |

The no-Nether quartz bootstrap requires review. Crushing diorite and washing crushed gold provide later quartz routes, but Crushing Wheels themselves require mechanical crafters and electron tubes. The Atlas's restricted no-exploration, no-Nether scenario still blocks that bootstrap. Nether access is now selected for closure, so verify existing Overworld acquisition before designing a low-tier alternative; do not rely on a Nether trip in the new capability questline. The [dimension/access guide](team-world-progress.md#mapper-findings-and-progression-consequences) owns graph limitations and affected resources. The legacy journal's three-crafter checkpoint also does not satisfy the 21-crafter crushing-wheel arrangement.

## Settlements and deliveries

[Sky Villages](structures.md) adds destinations, crops, villagers and salvage. Scarce foundation minerals now give a finite exploration reward: the 24-village survey found medians of two diamond ore and 17 emerald ore. Keep chest loot, salvage and Fortune in the comparison with repeatable delivery rewards; these measurements do not establish mining/travel time or simulated settlement demand.

Delivery Quests is in `CUSTOM` mode. The pack owns its six stock templates in `config/aeronautics_delivery_quests/custom_quests.json`, with direct titles and descriptions. Schematics, masses, rewards and automatic endpoints are unchanged. The available jobs award 15 to 50 emeralds plus items, including one Mechanical Arm for a medium machinery shipment.

These contracts transport supplied schematic cargo; they do not buy the player's farm output or simulate village consumption. Do not design a farming economy on that assumption. Existing villager trades are the actual item-demand mechanism. Village lookup, safe pickup placement and delivery completion remain separate checks. The structure search samples offsets from 500 to 6,000 blocks, with a 120-minute limit and four offers. ADQ 1.1.1 checks the minimum after locating the nearest structure but does not enforce the configured maximum on that result; actual village routes can be longer. This is an implementation finding, not a reason to increase rewards or change settlement density automatically. Hostile Skies automatic raids remain disabled; captain orders are intentionally outside normal progression until deliberate encounters are designed.

## Candidates for playtesting

These are proposals, not applied settings or verified builds:

- Give settlements value as places to revisit. Test the scarce foundation rates alongside building-specific loot before increasing payouts or restricting trades. Keep crop variety; there is no reason to gate basic carrots.
- Compare one renewable turpentine route with a lava supply route. A turpentine burn-rate reduction from 150% to 125% would yield 40 seconds per internal tank while retaining stronger thrust; first measure loaded round-trip costs.
- Build one modest powered cargo ship with separate fuel reserve, dock transfer and a stock delivery crate. This tests whether logistics has a useful role alongside backpacks without nerfing personal inventory convenience.
- Try a campfire/updraft landing tower for repeatable short crossings. Its purpose is to recover local altitude and connect docks, not replace long-distance flight.
- Test Flywheel Bearing storage separately before enabling it. A persistent role could be short power bursts or operations while a fueled engine is stopped. Brass access is already a natural constraint; an extra recipe gate is unnecessary.

## Journal and verification

[Journal design](journal.md#design-policy) owns capability-based routes, completion claims and reward budgets. Use the resource and operating constraints above when selecting entries. Equipment entries distinguish possession from operation; verified advancements cover pressing, mixing, fan processing, hot-air fill, propeller rotation, packaging, motor use and selected ordinary activities. None proves a complete factory, successful flight or completed delivery.

Local travel, workshop processing and airship operation connect preparation, detectable use and modest expansion. Supplies, controls, cargo, electricity and optional projects retain their own useful roles. The journal guide records exact trigger attribution and reward reference budgets; recheck those assumptions when upstream recipes or behavior change.

The [Atlas verification guide](web/verification.md) owns capture scope and limits. [Structures](structures.md) and [world generation](worldgen.md#evidence-and-limits) own their measured results. The [0.1.8 release record](../releases/0.1.8.md) retains historical processing and settlement checks. A current recipe export or successful build does not establish an affordable survival route or safe round trip.

## Airship building materials

[Building weights](weights.md) owns the pack's classification policy, retained upstream behavior, multipart decisions and native verification. Use it when choosing comparable construction blocks or updating Sable/building dependencies.

## Moving machinery

Transmission & Linkage adds flexible shaft connections, configurable pneumatic rods and kinetic conversion bearings alongside Linear Bearing guides and Absolute Kinematics hinges. These are alternatives with different motion/control roles, not a compulsory tier sequence. Both joint rod types use the craftable brass heads; andesite holds close to its linked rest length while brass permits a shorter elastic connection.

Normal and giant actuators retain their native self-contained operation. A regulator separately requires Create rotation to automate target length; it does not represent a fluid supply. Conversion bearings recover actual physical rotation through their rear output. No artificial fuel requirement or converter output nerf is applied. The stock rod range stays below upstream's long-model limit. Keep clearance and rest-length limits visible when planning mechanisms.

Three optional Workshop inventory entries introduce these capabilities. They do not certify a working linkage or generator. The flexible-shaft setup adds one common shaft; pneumatic and conversion equipment entries add no reward. Native recipes retain their precision mechanisms, sheets and spring requirements; giant rods also need mechanical crafting and their honey-bucket input.

## Culinary processing

[The culinary integration guide](culinary.md) owns ordinary flour/dough tags and outputs, the selected milling policy, tray policy, and Cookery/Tavern effects. Cookery raw dough preserves noodle stretching while both ordinary dough items remain valid in leads, hooks, bread, slime, cake paste, and circuit-board ingredients. The one-flesh tray leather shortcut is disabled; other tray routes remain unchanged for review. Cookery animal milling is retired from normal acquisition; seed oil and rice-panicle processing use Create milling, with other Create recipes and wheat yields unchanged.
