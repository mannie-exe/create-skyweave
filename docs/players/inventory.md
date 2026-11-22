# Inventory controls

Mouse Tweaks owns drag and wheel gestures. Inventory Profiles Next (IPN) adds manual sorting, transfers, slot locking and refill. Neither replaces the game's ordinary Shift-click transfer or crafting behavior.

## Authored defaults

| Interaction | Owner and behavior |
| --- | --- |
| Drag and wheel transfer | Mouse Tweaks; IPN scrolling and swipe movement are disabled to avoid overlap |
| Manual sorting | IPN, middle-click over an inventory; the three sort buttons remain available |
| Recipe lookup | EMI; the pack leaves R available |
| Tool replacement | IPN Auto Refill looks for a spare at six durability points remaining |
| Stack replenishment | IPN Auto Refill replenishes consumed stacks |
| Equipment profiles | Available for deliberately configured, manual gear switching |
| Armor refill and hotbar restocking | Disabled in the authored defaults |
| Continuous crafting | The checkbox is visible and starts unchecked when a crafting screen opens |
| IPN settings and overlay-editor inventory buttons | Hidden in source defaults; use the mod's configuration screen instead |

Open **Mods → Inventory Profiles Next → Config** to change these preferences. Seeded settings do not replace an existing player's choices. A source change does not prove an installed instance has it. Refill indicators keep their current magenta artwork; a quieter texture treatment is deferred.

## Crafting and automation

Vanilla Shift-click on a crafting result makes as many outputs as the grid and inventory permit. Check **Continuous Crafting** to let IPN refill the grid and use its repeat controls on the current screen. Opening a new crafting screen resets the checkbox to off.

## Refill and reserved slots

IPN watches the selected hotbar slot and offhand. It draws spares from main inventory storage. Other hotbar slots remain available for deliberate switching. A healthy spare of the same item takes priority. When only another material in the same category is eligible, IPN can swap it in and retain the worn tool in storage.

Hold **Left Alt** and click an inventory slot to edit its lock with the default bindings. **Auto Refill → Use Items From Locked Slots** starts off, so locked storage slots reserve their spares. A lock on a selected hotbar slot still allows refill there. Use **Ctrl+left-click** over a hotbar slot in survival inventory or **Ctrl+R** on the selected slot to toggle refill for that slot. The temporary **Right Control** tool control bypasses pre-break replacement while held and briefly after release. Ordinary replacement after a tool runs out can still occur.

## Known creative-screen issue

Compat 0.30.0 repairs FTB Library's return to an existing creative inventory screen when native closing reset its client menu. It preserves survival/chest behavior and a newly active server menu. With the adapter disabled or on older builds, close and reopen the inventory to clear misplaced IPN controls. Texture changes cannot repair stale screen or container ownership.

InvMove movement and focused-input rules are described in [getting started](getting-started.md#controls). Report the screen, game mode and sequence of actions when an inventory interaction differs from these defaults.

## Pickup notifications

Pick Up Notifier briefly lists collected items, recovered arrows and experience in the lower-right corner. Entries last four seconds, merge matching pickups except specially named items, and use at most a quarter of the screen height. Inventory totals start hidden. Its native client configuration is available through the Mods menu; existing players retain their presentation preferences.
