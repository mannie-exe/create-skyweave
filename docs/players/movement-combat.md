# Movement and combat

The pack uses ordinary Minecraft movement controls and Combat Nouveau 21.1.2 for combat. Movement overhauls are deferred. Punchy and Moves animate actions; their camera and presentation settings do not grant additional movement abilities.

Open **Options → Controls → Key Binds** to change controls. Iris keeps K for shader toggling and F8 for reload. Operators retain G for Wayfinder. Effortless Building keeps its Alt radial menu. CBC cannon pitch uses Comma and Powergrid rotation uses Period. Existing installations retain seeded preferences.

## Combat rules

Combat Nouveau uses the ordinary attack and use buttons without a separate combat mode. These are the authored defaults; multiplayer servers supply their own synchronized server rules.

| Action | Behavior |
| --- | --- |
| Attack | Wait for full attack charge, then click. Earlier attacks are rejected. Holding attack does not automatically repeat attacks. |
| Miss or switch items | Missing still consumes charge. Switching hotbar items does not itself reset the attack timer; the newly held item's attack speed still matters. |
| Sprint and attack | A hit does not stop sprinting. Falling critical hits can also occur while sprinting; ordinary critical-hit conditions still apply. |
| Reach | Swords and maces receive +0.5 blocks of entity reach; hoes and tridents receive +1 block. Default totals are 3.5 and 4 blocks respectively. This does not increase block placement or mining reach. |
| Aim at small mobs | Target selection has a minimum 0.9-block box and additional hitbox inflation. Physical collision sizes remain unchanged. |
| Sweep | Sweeping Edge is required. A charged swing into empty air can also sweep nearby enemies when grounded and moving slowly. Here “air” means missing the central target, not being airborne. The enchantment's sweeping-damage scaling is halved. |
| Shield | Blocking starts immediately. Melee protection covers a 100-degree frontal arc; projectile protection retains its native 180-degree arc. Raising the shield shortly before a melee hit gives stronger knockback, tapering over 20 ticks. |
| Food and drink | Drinking takes 20 ticks. Ordinary damaging attacks interrupt eating and drinking; damage that bypasses armor is excluded from that interruption hook. The optional alternative hunger/regeneration system is off. |
| Projectiles | Snowballs and eggs stack to 64 and have a four-tick throwing cooldown. Drinkable potions stack to 16 when their contents match. Projectile hits remove the usual brief damage immunity, allowing successive hits. |
| Knockback and durability | Airborne targets receive stronger knockback except in water. Snowballs, eggs and fishing hooks can knock players back despite dealing no damage. Axes lose one durability per attack instead of two. |

For a short test, use a sword, axe, Sweeping Edge sword, shield, potion and snowballs. Compare a charged hit with an early click, swing and miss, switch weapons during recovery, then try sprinting criticals. Test the shield against a melee attacker directly ahead and to one side, followed by drinking while under attack. Keep attack timing separate from what the hand animation looks like.

## Animation and camera

Punchy owns first-person hand presentation. Combat Nouveau's alternate swing animation is off, and its passive offhand-hiding list is empty. Its optional animation setting retimes shared vanilla swing progress for renderers using it; it does not supply separate first-person clips or synchronize Punchy's playback. Moves and Fluid & Foolish supply the selected third-person player animations. CN's shield indicator remains enabled. A visible flourish is not a second damaging hit; judge successful attacks by the target and attack charge. Timing against remote players and moving constructs still needs gameplay review.

Punchy! supplies first-person item and hand animations. F9 opens its menu; I inspects the held item. Punchy! Moves uses Fluid & Foolish for third-person animations: F6 toggles its camera, F7 opens its camera editor and J opens emotes. Its separate orbit shortcut starts unbound to preserve B for the backpack; assign it in Controls if wanted.

Compat makes local attack animation follow accepted native swings and uses the actual local critical prediction, including the server's sprint-critical rule. Supported sword, axe and empty-hand clips have faster strikes with separate recovery. Under **Skyweave: Compatibility Patches → Rendering**, the player-animation preferences let you turn first- or third-person pacing off independently for new attacks. Correctness repairs stay active. Other actions and unknown clips retain their native timing; an animation is still not server confirmation of damage.

Touch’n Motion and EMF Compat: Core are installed for procedural interaction poses. Compat supplies an optional bridge between the selected Moves release and Touch’n Motion’s released body/cape API; gameplay and moving-ship pose combinations still need review. FA Player Extension is not selected. See [animation ownership](../development/patches.md#player-animation-ownership) for the boundary. Punched Backpacks supplies Traveler’s Backpack hand-alignment profiles without disabling Punchy’s animations.

Fresh Animations and FA+Details remain installed but deselected pending the next visual choice. FA+Objects stays selected for boats, containers and other object models. The selected mob-rendering stack and the proposed player-animation options are separate decisions.
