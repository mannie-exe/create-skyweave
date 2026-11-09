# Inventory controls

Mouse Tweaks owns drag and wheel gestures. Inventory Profiles Next (IPN) adds
manual sorting, transfers, slot locking and refill. Neither replaces the game's
ordinary Shift-click transfer or crafting behavior.

## Authored defaults

| Interaction | Owner and behavior |
| --- | --- |
| Drag and wheel transfer | Mouse Tweaks; IPN scrolling and swipe movement are disabled to avoid overlap |
| Manual sorting | IPN, middle-click over an inventory; the three sort buttons remain available |
| Recipe lookup | EMI; the pack leaves R available |
| Tool replacement | IPN Auto Refill replaces worn tools before they break |
| Stack replenishment | IPN Auto Refill replenishes consumed stacks |
| Equipment profiles | Available for deliberately configured, manual gear switching |
| Armor refill and hotbar restocking | Disabled in the authored defaults |
| IPN settings and overlay-editor inventory buttons | Hidden in source defaults; use the mod's configuration screen instead |

Open **Mods → Inventory Profiles Next → Config** to change these preferences.
Seeded settings do not replace an existing player's choices. A source change does
not prove an installed instance has it. Refill indicators keep their current
magenta artwork; a quieter texture treatment is deferred.

## Crafting and automation

Vanilla Shift-click on a crafting result makes as many outputs as the grid and
inventory permit. IPN continuous crafting can additionally refill the grid and
repeat output collection. Those are different operations; Mouse Tweaks is not a
sorting or recipe-planning system. Optional profiles, locking, refill, crafting
and trading assistance should be configured deliberately rather than assuming
that an enabled feature runs automatically in every inventory.

## Known creative-screen issue

Compat 0.30.0 repairs FTB Library's return to an existing creative inventory
screen when native closing reset its client menu. It preserves survival/chest
behavior and a newly active server menu. With the adapter disabled or on older
builds, close and reopen the inventory to clear misplaced IPN controls. Texture
changes cannot repair stale screen or container ownership.

InvMove movement and focused-input rules are described in
[getting started](getting-started.md#controls). Report the screen, game mode and
sequence of actions when an inventory interaction differs from these defaults.
