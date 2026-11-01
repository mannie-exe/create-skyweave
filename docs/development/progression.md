# Progression review

The current source combines island exploration, Create production and Aeronautics
transport. The Atlas records potential acquisition; it does not prove affordable
quantities, working machinery or a safe outward and return journey. Saved-world surveys and isolated generation samples have separate dates and
provenance; use [world generation](worldgen.md) for the selected terrain profile.

## Resources and processing

Keep geological variants distinct while unifying interchangeable manufactured
materials. Almost Unified previously replaced specific ore inputs with broad ore
tags: stone and deepslate iron matched both crushing recipes despite different
outputs and durations. Ore tags are now excluded from unification; ingots,
plates and the Create Deco zinc-sheet preference remain unified.

Platinum uses Create's existing crushing family. The three overlapping Propulsion
ore/raw-block recipes are disabled through native data-load conditions. This
chooses consistent metal and XP yields rather than leaving recipe selection to
resolve conflicting alternatives. Propulsion still owns platinum items, worldgen,
washing, smelting and other processing. The spruce-log and copycat-wing recipes
also now use Create 6's `processing_time` field, preserving their authored
150- and 50-tick work durations. These are recipe work values, not fixed wall time
independent of machine speed.

Native exports verified that exact-input crushing collision groups fell from nine
to zero. This does not establish that all partial overlaps across every recipe
system are gone. Existing crafting alternatives, including copycat shapes and
vault conversions, remain selectable through Polymorph; no blanket recipe removal
was applied to decorative choices.

The archived survey supports vertical resource specialization: iron and coal were
common, while diamonds and most redstone were concentrated in deepslate. Preserve
that reason to explore deeper terrain before increasing global ore rates. Create Sky Compat maps those bands into each anchor's geological span;
[generated samples](worldgen.md#geology-and-features) now confirm zinc and
other starting resources, with diamond/platinum in deep interiors. Mining access,
travel time and whole-island quantities remain separate gameplay checks. Gold washing supplies a separate 5% platinum-nugget chance. At that
rate, one ingot takes 180 crushed-gold washes on average, not a guaranteed batch.

## Mechanical alternatives

Linear Bearing supplies passive guides with powered brakes, short-range magnetic
couplings, spring-linked transmission and a gyro/converter angular-rate sensor.
All transmission uses a real external drive and its stress budget. These are
alternatives for reusable moving machinery, not a mandatory technology tier or
free energy. The guide is not a powered actuator. Equipment journal entries
explain setup without claiming a working installation; see
[compatibility](compatibility.md#linear-bearing).

[Transmission & Linkage](https://modrinth.com/mod/create-aeronautics-transmission-linkage)
remains a candidate. Its hydraulic rods, redstone length controls, joints and
rotational energy conversion cover a broader role than a guide rail; it is not
a direct replacement merely because both move structures. Review extension,
return force and damping as control choices before adding journal routes.
[Absolute Kinematics](https://www.curseforge.com/minecraft/mc-mods/absolute-kinematics)
1.0.1 adds a shaft-driven 180-degree hinge and a passive ball joint. Both pass
rotation into attached machinery. Their two recipes retain native wooden slabs,
industrial iron blocks and a gearbox or brass ingot. No new compulsory tier or
recipe gate is introduced; the journal distinguishes equipment from working joints.
Native fixtures verified interaction assembly, a real 16-RPM hinge drive reaching
its 90-degree stop, ball-joint redstone lock/release, and payload recovery.
Large articulated aircraft and long-term constraint behavior remain play checks.

## Equipment maintenance

Easy Anvils retains repair-material and XP costs, but removes the 40-level cap,
ignores prior-work penalties for repairs/renames and limits penalty growth when
adding enchantments. Book application costs are halved. Renaming is free; repair
materials restore 25% durability per unit. Iron blocks repair anvil damage, with
dispenser support. These defaults support keeping useful equipment instead of
replacing it solely because accumulated penalties make repairs impractical.

Easy Magic retains 15 bookshelves for maximum power. A reroll costs one lapis and
five XP points, not five levels. All offered enchantments are visible; rerolls
remain paid. Bookshelves behind non-full collision blocks still count, and facing
chiseled bookshelves supply power from stored books. Existing vanilla workstations
remain usable; new placements and generated replacements use the enhanced blocks.

Inventory Totem allows a totem in the main inventory to satisfy an ordinary totem
save. It consumes the totem and does not create a rescue item, teleport route or
return journey. Repair, enchanting and totem acquisition still depend on existing
resources. No new mandatory journal step or crafting gate was added.

## Production and travel

Basic balloon hardware does not require brass. The installed assembler, adjustable
burner and andesite/wooden propeller use andesite alloys, iron sheets, redstone and
wooden parts. Iron nuggets can supply the alloys without zinc. Zinc remains
important for brass and subsequent machinery; its presence alone does not establish
an initial aircraft route.

A hand-crafted parts subtotal for one mechanical press, hand crank, eight shafts,
assembler, adjustable burner, propeller and super glue is 20 andesite, 21 iron
ingots, one redstone dust and two slimeballs, plus wood, stone and a burner-fire
ingredient. An iron pickaxe adds three ingots. This uses the current one-alloy
crafting yield and leaves spare shafts/nuggets. It excludes the envelope, hull,
control/power system and machinery needed for an alternate slime source; it is
not a complete flyable-ship budget. The native loaded-flight fixture used creative
power. All six distributed island samples contained iron, andesite and redstone,
but mining access and wool/slime acquisition still require survival playtesting.

| System | Current behavior | Design implication |
| --- | --- | --- |
| Early brass | A fueled Propulsion Solid Burner supplies basin heat without blaze capture. | Metalworking can precede the Nether; fuel and a working mixer still matter. |
| Superheat | Native heat checks accept a coal-fired solid burner as superheated. | This overlaps blaze cakes. The steam-engine superheat switch is not a basin-specific control. Do not pretend a cake gate exists. |
| Turpentine | Crushing spruce logs gives resin at 60%; one resin and 250 mB water mix into 250 mB fuel without heat. | Spruce access and Crushing Wheels matter; a heated fuel refinery is not required. |
| Liquid thrust | A standard 1,000 mB tank at full throttle lasts about 33.3 s on turpentine or 50 s on lava at 20 TPS. Turpentine has 100% thrust, lava 75%. | Turpentine is stronger but currently slightly worse in thrust per fuel volume. These budgets exclude multiblocks/oxidizer and do not measure flight range. |
| Gliding | Membranes supply crafting and repair; tagged heat blocks provide a 15-block updraft range. | Gliders suit local crossings and prepared ascent points. Sleeping habits affect membrane encounters; no artificial membrane gate is needed. |
| Ropes | Connector ranges are 10/20/40 blocks by hand/launcher/mount; the plunger reaches 64. | Useful for docking and nearby gaps, not for crossing whole cluster intervals. |
| Flywheel Bearing | The block is enabled, but kinetic storage is disabled. Its recipe already requires brass. | It currently has no storage role. Do not describe it as an early energy buffer until that feature is enabled and tested. |
| Backpacks | Base storage is 27 slots, with larger tiers and portable processing upgrades. | Ships need roles beyond carrying a player's normal inventory: mounted machines, bulk flows and physical delivery cargo. |

The quartz bootstrap deserves a practical check. Crushing diorite and washing
crushed gold provide later quartz routes, but Crushing Wheels themselves require
mechanical crafters and electron tubes. The Atlas's restricted no-exploration,
no-Nether scenario still blocks that bootstrap. An early Nether trip is a valid
route; adding an alternate quartz source would be a progression choice, not an
obvious missing-recipe repair. The journal's three-crafter checkpoint also does
not satisfy the 21-crafter crushing-wheel arrangement.

## Settlements and deliveries

[Sky Villages](structures.md) adds destinations, crops, villagers and salvage.
Scarce foundation minerals now give a finite exploration reward: the 24-village
survey found medians of two diamond ore and 17 emerald ore. Keep chest loot,
salvage and Fortune in the comparison with repeatable delivery rewards; these
measurements do not establish mining/travel time or simulated settlement demand.

Delivery Quests is in `CUSTOM` mode. The pack owns its six stock templates in
`config/aeronautics_delivery_quests/custom_quests.json`, with direct titles and
descriptions. Schematics, masses, rewards and automatic endpoints are unchanged.
The available jobs award 15 to 50 emeralds
plus items, including one Mechanical Arm for a medium machinery shipment.

These contracts transport supplied schematic cargo; they do not buy the player's
farm output or simulate village consumption. Do not design a farming economy on
that assumption. Existing villager trades are the actual item-demand mechanism.
Village lookup, safe pickup placement and delivery completion remain separate
checks. The structure search samples offsets from 500 to 6,000 blocks, with a
120-minute limit and four offers. ADQ 1.1.1 checks the minimum after locating the
nearest structure but does not enforce the configured maximum on that result;
actual village routes can be longer. This is an implementation finding, not a
reason to increase rewards or change settlement density automatically.
Hostile Skies automatic raids remain disabled; captain orders are intentionally
outside normal progression until deliberate encounters are designed.

## Candidates for playtesting

These are proposals, not applied settings or verified builds:

- Give settlements value as places to revisit. Test the scarce foundation rates
  alongside building-specific loot before increasing payouts or restricting
  trades. Keep crop variety; there is no reason to gate basic carrots.
- Compare one renewable turpentine route with a lava supply route. A turpentine
  burn-rate reduction from 150% to 125% would yield 40 seconds per internal tank
  while retaining stronger thrust; first measure loaded round-trip costs.
- Build one modest powered cargo ship with separate fuel reserve, dock transfer
  and a stock delivery crate. This tests whether logistics has a useful role
  alongside backpacks without nerfing personal inventory convenience.
- Try a campfire/updraft landing tower for repeatable short crossings. Its purpose
  is to recover local altitude and connect docks, not replace long-distance flight.
- Test Flywheel Bearing storage separately before enabling it. A persistent role
  could be short power bursts or operations while a fueled engine is stopped.
  Brass access is already a natural constraint; an extra recipe gate is unnecessary.

## Journal and verification

[Journal design](journal.md#design-policy) owns capability-based routes, completion
claims and reward budgets. Use the resource and operating constraints above when
selecting entries. Equipment entries distinguish possession from operation;
verified advancements cover pressing, mixing, fan processing, hot-air fill,
propeller rotation, packaging, motor use and selected ordinary activities.
None proves a complete factory, successful flight or completed delivery.

Local travel, workshop processing and airship operation connect preparation,
detectable use and modest expansion. Supplies, controls, cargo, electricity and
optional projects retain their own useful roles. The journal guide records exact
trigger attribution and reward reference budgets; recheck those assumptions when
upstream recipes or behavior change.

The [Atlas verification guide](web/verification.md) owns capture scope and limits.
[Structures](structures.md) and [world generation](worldgen.md#evidence-and-limits)
own their measured results. The [0.1.8 release record](../releases/0.1.8.md) retains
historical processing and settlement checks. A current recipe export or successful
build does not establish an affordable survival route or safe round trip.

## Airship building materials

[Building weights](weights.md) owns the pack's classification policy, retained
upstream behavior, multipart decisions and native verification. Use it when
choosing comparable construction blocks or updating Sable/building dependencies.

## Moving machinery

Transmission & Linkage adds flexible shaft connections, configurable pneumatic
rods and kinetic conversion bearings alongside Linear Bearing guides and Absolute
Kinematics hinges. These are alternatives with different motion/control roles,
not a compulsory tier sequence. Both joint rod types use the craftable brass
heads; andesite holds close to its linked rest length while brass permits a
shorter elastic connection.

Normal and giant actuators retain their native self-contained operation. A
regulator separately requires Create rotation to automate target length; it does
not represent a fluid supply. Conversion bearings recover actual physical
rotation through their rear output. No artificial fuel requirement or converter
output nerf is applied. The stock rod range stays below upstream's long-model
limit. Keep clearance and rest-length limits visible when planning mechanisms.

Three optional Workshop inventory entries introduce these capabilities. They do
not certify a working linkage or generator. The flexible-shaft setup adds one
common shaft; pneumatic and conversion equipment entries add no reward. Native
recipes retain their precision mechanisms, sheets and spring requirements; giant
rods also need mechanical crafting and their honey-bucket input.
