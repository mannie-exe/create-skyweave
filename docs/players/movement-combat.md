# Movement and combat

Better Combat supplies melee combat. Omnidirectional Movement lets you sprint and sprint-jump sideways or backward. Use the ordinary attack, use, sprint, and movement controls.

Open **Options → Controls → Key Binds** to change controls. Iris keeps K for shader toggling and F8 for reload. G opens Ping; operators use F12 for Wayfinder. Effortless Building keeps Left Alt for its radial and uses F4 for modifier settings; Right Alt groups Create tool menus and Copycat fill. CBC cannon pitch uses Comma, Power Grid editor rotation and the held Simulated tool use Period in their separate contexts. Backpack tool cycling uses = and the spyglass shortcut uses −. Existing installations retain seeded preferences.

## Combat rules

Better Combat uses weapon profiles for attack range, swing shape, wind-up, and combos. Try successive sword attacks, then repeat with an axe and with a compatible weapon in each hand. Give the wind-up time to finish and watch when the target actually takes damage. Test an offhand shield and a placeable block as ordinary Use controls. [Better Combat features](https://github.com/ZsoltMolnarrr/BetterCombat#features).

Try sideways and backward sprinting with the sprint key, then repeat while attacking with a weapon. Omnidirectional Movement changes how sprinting starts and moves. Better Combat's attack timing and movement restrictions still apply. [Omnidirectional Movement](https://modrinth.com/mod/omnidirectional-movement).

## Grappling

Skybound adds the Grappling Hook, crafted from an iron pickaxe and a lead. The pack sets its default maximum rope length to **255 blocks**, the native customization ceiling, for the long-range trial. Throw speed and gravity remain native, so that length does not guarantee the same horizontal firing distance. Upgrades are available through smithing. The pack retains native recipes and upgrade limits.

Existing hooks with an explicitly customized length retain that value. The new default applies when no per-hook length overrides it.

Hold the hook in either hand and press Use to fire. Press Use again to detach, or Jump to release with a jump. While attached, Crouch plus Forward/Back climbs or lowers the rope. These controls reuse the ordinary bindings; optional separate hook controls start unbound. Skybound controls airborne movement while its rope controller is active. Its bundled Create and Sable integrations handle moving attachment targets.

## Animation and camera

Punchy can present Better Combat's first-person attacks when **Better Combat Support** is enabled in Punchy's Compatibility settings. Moves and Fluid & Foolish supply the third-person locomotion. Better Combat supplies the third-person attack poses with the selected Fluid & Foolish pack. Use the target's response to judge the hit timing. [Punchy settings](https://www.punchymod.com/projects/punchy).

Punchy! supplies first-person item and hand animations. F9 opens its menu; I inspects the held item. Punchy! Moves uses Fluid & Foolish for third-person animations: Mod+U toggles its custom camera, U toggles orbit while that custom camera is active, Shift+U opens its camera editor and J opens emotes. Mod means Command on macOS and Control elsewhere. These defaults use the selected Compat modifier repairs; saved player bindings remain unchanged until deliberately updated.

Touch’n Motion and EMF Compat: Core are installed for procedural interaction poses. Compat supplies an optional bridge between the selected Moves release and Touch’n Motion’s released body/cape API; gameplay and moving-ship pose combinations still need review. FA Player Extension is not selected. See [animation ownership](../development/patches.md#player-animation-ownership) for the boundary. Punched Backpacks supplies Traveler’s Backpack hand-alignment profiles without disabling Punchy’s animations.

Fresh Animations and FA+Details are selected for mob presentation, with FA+Objects above them for boats, containers and other object models.
