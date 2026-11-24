# Complete input map

The **post-fix** map is authored in `overrides/client/options.txt` and the existing IPN preference file, with Punchy’s native trigger-preference seed. This ledger covers every audited registration/custom definition, including retained and opt-in entries. It does not establish every action, layout, or input path works. [Input ownership](keybinds.md) owns dispatch evidence and maintenance; [registered inputs](keybind-inventory.md) owns the native capture. Existing players keep seeded choices until deliberate reconciliation; this pass does not update personal instances.

## Controls by workflow

**Mod** on native mappings means NeoForge CONTROL: Command on macOS, Control on Windows/Linux. Custom libraries retain their own modifier semantics. Effortless undo/redo declare CONTROL explicitly and use that platform modifier through the qualified optional Compat repair. Native physical-Control fallback remains upstream behavior only for mappings without a declared modifier. Function keys can require Fn. Preserve fixed native F3/debug, narrator, text/IME, clipboard, and OS shortcuts rather than interpreting every shared key as a defect.

| Workflow | Authored controls |
| --- | --- |
| Core play | Native WASD, Space, Shift, Control, Attack/Use, E inventory, Q drop, F offhand, 1–9 hotbar, T chat, slash command and Tab player list. |
| Combat and equipment | V feint; Mod+V Radar designation; Helium Flamingo retains native Sprint fallback; H Accessories; B backpack; = backpack tool cycle; − spyglass. Native equipment, target, and server admission stay authoritative. |
| Equipment toggles | Shift+H shrinking; Mod+P sinking; Mod+K goggles; Mod+L invisibility; Mod+N attractor. |
| Navigation and communication | G Ping; F12 operator Wayfinder; M map; Grave quests; Shift+Grave tracker visibility; Mod+T teams. |
| Player presentation | I Inspect; J emote menu; U orbit camera; F5 native perspective; Mod+U custom camera; Shift+U editor; F9 Punchy settings. |
| Building | Left Alt Effortless radial; F4 modifier settings; Mod+Z/Y undo/redo. Right Alt Create alternate/toolbox/schematic and Copycat fill. Period Simulated tool rotation. |
| Tools | Mod+F4 Analog Audio input mode; Mod+Semicolon rope camera lock; Mod+E Exposure controls. Retain native item Use, mounting, movement and target rules. |
| Graphics | F7 Keybind Atlas; O shader selection; K shader toggle; F8 shader reload; Mod+O Outline settings; F11 fullscreen. |
| Target information | Backslash Jade config; Mod+Backslash overlay; Mod+[ fluid; Mod+] narrate; Shift+[ recipes; Shift+] uses. No numeric keypad required. |
| Inventory | Native transfers; Mouse Tweaks drag/wheel; IPN middle-sort/buttons; EMI R/U/A, Ctrl+F search and Ctrl+O visibility through its native modifier interpretation. Existing profile chords remain custom, not typed sequences. |
| Refill | Physical Right Control replaces Left Alt for temporary tool-replacement bypass. Inventory slot-lock editing retains Left Alt in its different screen context. |

Right Alt deliberately separates Create's existing contextual group from the owner's Left Alt building wheel. It is not proof all arbitrary offhand/tool combinations are exclusive. Qualify actual held tools, target transitions, and AltGr/platform layouts. No Ctrl+B binding is added; preserve the native narrator shortcut. R stays free of new world actions because IPN uses it as a profile/config chord prefix. An unassigned Helium Flamingo mapping preserves its native Sprint fallback; do not mistake it for an inactive feature.

Moves' U, Mod+U and Shift+U mappings use the qualified native-priority repair. Orbit still requires the native custom camera to be active; Mod+U enables it. F6 remains available for deliberate rebinding; F7 opens Keybind Atlas. Direct emotes remain menu-accessible instead of adding another default shortcut bank.

## Platform shortcut boundaries

Review every new shortcut against the platform and the actual consumer. The source check rejects a small set of known reservations; it does not certify every OS, keyboard layout, custom dispatcher, or user-defined shortcut.

| Input group | Policy and evidence |
| --- | --- |
| Command+H, Command+Grave | Avoid macOS app hiding and app-window cycling. Shrinking uses Shift+H; tracker visibility uses Shift+Grave. |
| Command+Comma | Avoid the standard app-settings convention. Rope camera lock uses Mod+Semicolon, keeping crouch free during rope use. GLFW's default menu does not itself install a settings command. |
| Modified F2/F11 | Minecraft checks screenshot/fullscreen by base-key identity before ordinary modified dispatch. Jade lookups use Shift+[ / Shift+] for recipes/uses. |
| Other Mod letters, punctuation and navigation | No matching reservation in GLFW's default Cocoa menu for the retained map. App-specific meanings such as print, open, paste, or text navigation are not automatically global shortcuts. Retain expected GUI editing and verify focus ownership separately. |
| Function keys and compact navigation | Fn/media mode, Show Desktop, accessibility shortcuts and compact keyboard mappings can intercept or alter delivery. Controls remain rebindable; title registration does not prove physical delivery. |
| Windows/Linux and alternate layouts | No authored Alt+F4/Tab/Escape/Space window commands or Windows-key chords. Linux desktop bindings, AltGr, IME and customized system shortcuts still require local checks. Native CONTROL maps to Command on macOS; a physical Control+arrow test is a different chord. |

Sources: [Apple keyboard shortcuts](https://support.apple.com/en-us/102650), [VoiceOver shortcut](https://support.apple.com/guide/voiceover/turn-voiceover-on-or-off-vo2682/mac), [GLFW Cocoa menu](https://github.com/glfw/glfw/blob/3.4/src/cocoa_init.m), and [Windows keyboard shortcuts](https://support.microsoft.com/en-us/accessibility/windows/keyboard-shortcuts-in-windows). The pinned LWJGL 3.3.3 macOS ARM64 library reports GLFW 3.4.0. Host shortcut preferences are non-exhaustive evidence; default, menu and custom shortcuts can exist outside their explicit entries. No OS shortcuts are disabled by this map.

## Filming and authoring

Filming/editing controls are first-class, not removed to make a conflict count green. Give one camera controller each shot: exit Moves orbit/custom camera before running a CMDCam path; automatic handoff is not qualified. Flashback starts/finishes recording through its real pause-menu controls and opens replay/edit/export from its native entries; this pass invents no global recording API.

| Action | Authored control |
| --- | --- |
| HUD / screenshot / perspective | Native F1 / F2 / F5. |
| Moves orbit / custom camera / editor | U / Mod+U / Shift+U. |
| CMDCam roll left / right / reset | Mod+Left / Mod+Right / Mod+Down. |
| CMDCam zoom in / out / reset | Mod+= / Mod+− / Mod+Up. |
| Add camera-path point | Mod+Enter. |
| Play/stop camera path | F10. |
| Clear camera-path points | Mod+Backspace; clears the native path, so use deliberately. |
| Flashback marker 1 / 2 / 3 / 4 | Mod+Home / Mod+End / Mod+Page Up / Mod+Page Down. |
| Named live paths | Existing /cam save and /cam load commands; see [filming](../players/filming.md). |
| Native replay editor | Keep its native screen-local timeline/input. Source review confirms P pause; other playback, navigation, clipboard/delete and text-capture behavior still need their actual editor checks. |
| Circuit and quest editors | Preserve native screen-local tools, clipboard, selection, save/undo/redo and focus precedence; all registered entries are listed below. |

Compact keyboards can expose navigation keys through Fn+arrows or equivalent native inputs; hardware/OS interception is not certified by registration. Keep accessible native menus/commands where verified and support rebinding; do not promise every operation has a menu fallback.

## Qualified runtime contract and remaining limits

This source map requires the selected input repairs in public Compat 0.42.0 with one public re:form 0.2.0 library. The pack explicitly enables `punchy_moves.keybinding_modifiers`, `effortlessbuilding.keybinding_modifiers`, `powergrid.keybinding_modifiers`, and `inventory_profiles_next.text_input_protection`. Optional provider versions, physical sides and explicit opt-outs retain their native admission. Turning off a repair does not automatically install a different keymap: restore suitable upstream bindings deliberately before using affected raw consumers.

Moves activation and perspective observation now follow native context/modifier priority; deferred dynamic bindings retain their modifier suffix through native saving and reload. The U camera group depends on that contract. Effortless retains its Left Alt radial, with release/focus/context cleanup, and explicit Mod+Z/Y history bindings. Power Grid keeps its screen-local editor keys and physical tool modifiers, including semantic Shift. No shared global matcher or semantic Control-to-Command rewrite is introduced.

The runtime release carries its own bounded native before/after, persistence and lifecycle qualification. This pack's source map and loaded registration have separate evidence; neither implies every tool, camera combination, OS input path, layout, shader or multiplayer interaction is qualified. Unrelated Backpack, Exposure, Punchy legacy and hard-coded Moves paths are not covered by these repairs. Preserve native field focus and test the actual adapted consumer when changing a binding.

Punchy restores `config/punchy/triggerable-keybindings.json` after deferred resource registration. Its explicit legacy unassignments must agree with options.txt on a fresh installation; the native writer retains player edits. I inspection and the J emote menu remain available. Unique legacy clips retain deliberate Controls assignment as a review point, rather than an invented shared menu.

Existing installations keep seeded values. Review the changed stable IDs and reconcile options and native resource-key stores explicitly. Do not replace an entire personal options file merely to update bindings, or overwrite unrelated display/resource/preferences. Authoring a new map does not itself sync a personal instance.

## Complete native ledger

Before means the November 22 packaged audit, not a personal player's saved choices. Authored means this authored source. Every native mapping has an explicit source value. GUI/hover reuse remains contextual; unknown/unassigned is not always disabled. Actual configuration owners remain unchanged.

| Category | Action and stable ID | Before | Authored | Decision |
| --- | --- | --- | --- | --- |
| Better Combat | Feint (`keybinds.bettercombat.feint`) | Unassigned | V | Enable; qualify consumer, context and transitions. |
| Better Combat | Toggle Mine with weapons (`keybinds.bettercombat.toggle_mine_with_weapons`) | Unassigned | Unassigned | Keep opt-in. Controls retains assignment; no menu fallback is assumed. |
| Copycats | Fill Copycat with Material (`keyinfo.copycats.fill_copycat`) | Left Alt | Right Alt | Remap; qualify consumer, context and transitions. |
| Create | Alt Modifier (`create.keyinfo.alt_modifier`) | Left Alt | Right Alt | Remap; qualify consumer, context and transitions. |
| Create | Ctrl Modifier (`create.keyinfo.ctrl_modifier`) | Left Control | Left Control | Keep native context, permission and focus ownership. |
| Create | Open Block Rotation Menu (`create.keyinfo.rotate_menu`) | Unassigned | Unassigned | Keep opt-in. Controls retains assignment; no menu fallback is assumed. |
| Create | Shift Modifier (`create.keyinfo.shift_modifier`) | Left Shift | Left Shift | Keep native context, permission and focus ownership. |
| Create | Access Nearby Toolboxes (`create.keyinfo.toolbelt`) | Left Alt | Right Alt | Remap; qualify consumer, context and transitions. |
| Create | Focus Schematic Overlay (`create.keyinfo.toolmenu`) | Left Alt | Right Alt | Remap; qualify consumer, context and transitions. |
| Create Simulated | Physics Staff Rotate Mode (`simulated.keyinfo.rotate_mode`) | Tab | . | Remap; qualify consumer, context and transitions. |
| Create Simulated | Scroll Down (`simulated.keyinfo.scroll_down`) | Unassigned | Unassigned | Keep opt-in. Controls retains assignment; no menu fallback is assumed. |
| Create Simulated | Scroll Up (`simulated.keyinfo.scroll_up`) | Unassigned | Unassigned | Keep opt-in. Controls retains assignment; no menu fallback is assumed. |
| HT's TreeChop | Cycle Sneak Behavior (`treechop.key.cycle_sneak_behavior`) | Unassigned | Unassigned | Keep opt-in. Controls retains assignment; no menu fallback is assumed. |
| HT's TreeChop | Open Settings Overlay (`treechop.key.open_settings_overlay`) | N | N | Keep native context, permission and focus ownership. |
| HT's TreeChop | Toggle Chopping (`treechop.key.toggle_chopping`) | Unassigned | Unassigned | Keep opt-in. Controls retains assignment; no menu fallback is assumed. |
| Power Grid | Alternate Wire Placement (`powergrid.keyinfo.alternate_wire_placement`) | Left Control | Left Control | Keep native context, permission and focus ownership. |
| Power Grid - Circuit Editor | Delete Area (`powergrid.keyinfo.delete_area`) | D | D | Keep native context, permission and focus ownership. |
| Power Grid - Circuit Editor | Pick Component (`powergrid.keyinfo.pick_component`) | S | S | Keep native context, permission and focus ownership. |
| Power Grid - Circuit Editor | Place Trace (`powergrid.keyinfo.place_trace`) | T | T | Keep native context, permission and focus ownership. |
| Power Grid - Circuit Editor | Rotate Component (`powergrid.keyinfo.rotate_component`) | . | . | Keep native context, permission and focus ownership. |
| Power Grid - Circuit Editor | Switch Layer (`powergrid.keyinfo.switch_layer`) | X | X | Keep native context, permission and focus ownership. |
| Accessories | Open Accessories Screen (`accessories.key.open_accessories_screen`) | H | H | Keep native context, permission and focus ownership. |
| Artifacts | Toggle Charm of Shrinking (`artifacts.key.charm_of_shrinking.toggle`) | Unassigned | Shift+H | Enable; qualify consumer, context and transitions. |
| Artifacts | Toggle Charm of Sinking (`artifacts.key.charm_of_sinking.toggle`) | Unassigned | Mod+P | Enable; qualify consumer, context and transitions. |
| Artifacts | Activate Helium Flamingo (`artifacts.key.helium_flamingo.activate`) | Unassigned | Unassigned | Retain native Sprint fallback; no extra activation key. |
| Artifacts | Toggle Night Vision Goggles (`artifacts.key.night_vision_goggles.toggle`) | Unassigned | Mod+K | Enable; qualify consumer, context and transitions. |
| Artifacts | Toggle Scarf of Invisibility (`artifacts.key.scarf_of_invisibility.toggle`) | Unassigned | Mod+L | Enable; qualify consumer, context and transitions. |
| Artifacts | Toggle Universal Attractor (`artifacts.key.universal_attractor.toggle`) | Unassigned | Mod+N | Enable; qualify consumer, context and transitions. |
| Exposure | Open Camera Controls (`key.exposure.camera_controls`) | Unassigned | Mod+E | Enable; qualify consumer, context and transitions. |
| Hoofprint | Open Map Screen (`key.hoofprint.open`) | M | M | Keep native context, permission and focus ownership. |
| Spyglass Improvements | Use Spyglass (`key.spyglass-improvements.use`) | Z | − | Remap; qualify consumer, context and transitions. |
| Create: Radar | Binocular Fire (`create_radar.key.binocular.fire`) | Mouse Left | Mouse Left | Keep native context, permission and focus ownership. |
| Create: Radar | Binocular Designate (`create_radar.key.binocular.use`) | V | Mod+V | Remap; qualify consumer, context and transitions. |
| Flashback Keybinds | Create Marker #1 (`flashback.keybind.create_marker_1`) | Unassigned | Mod+Home | Enable; qualify consumer, context and transitions. |
| Flashback Keybinds | Create Marker #2 (`flashback.keybind.create_marker_2`) | Unassigned | Mod+End | Enable; qualify consumer, context and transitions. |
| Flashback Keybinds | Create Marker #3 (`flashback.keybind.create_marker_3`) | Unassigned | Mod+Page Up | Enable; qualify consumer, context and transitions. |
| Flashback Keybinds | Create Marker #4 (`flashback.keybind.create_marker_4`) | Unassigned | Mod+Page Down | Enable; qualify consumer, context and transitions. |
| FTB Quests | Pinned Quest Tracker Visibility (`key.ftbquests.cycle_pinned_tracker`) | Unassigned | Shift+Grave | Enable; qualify consumer, context and transitions. |
| FTB Quests | Open Quests (`key.ftbquests.quests`) | Grave | Grave | Keep native context, permission and focus ownership. |
| FTB Quests (GUI) | See Extended Quest Info (`key.ftbquests.gui.extended_info`) | F1 | F1 | Keep native screen/hover/editor scope and focus precedence. |
| FTB Quests (GUI) | Move Selection / Scroll Down (`key.ftbquests.gui.move_down`) | Down | Down | Keep native screen/hover/editor scope and focus precedence. |
| FTB Quests (GUI) | Move Selection / Scroll Left (`key.ftbquests.gui.move_left`) | Left | Left | Keep native screen/hover/editor scope and focus precedence. |
| FTB Quests (GUI) | Move Selection / Scroll Right (`key.ftbquests.gui.move_right`) | Right | Right | Keep native screen/hover/editor scope and focus precedence. |
| FTB Quests (GUI) | Move Selection / Scroll Up (`key.ftbquests.gui.move_up`) | Up | Up | Keep native screen/hover/editor scope and focus precedence. |
| FTB Quests (GUI) | Next Chapter (`key.ftbquests.gui.next_chapter`) | Tab | Tab | Keep native screen/hover/editor scope and focus precedence. |
| FTB Quests (GUI) | Player Preferences (`key.ftbquests.gui.player_prefs`) | Mod+P | Mod+P | Keep native screen/hover/editor scope and focus precedence. |
| FTB Quests (GUI) | Previous Chapter (`key.ftbquests.gui.prev_chapter`) | Shift+Tab | Shift+Tab | Keep native screen/hover/editor scope and focus precedence. |
| FTB Quests (GUI) | Recenter GUI (`key.ftbquests.gui.recenter`) | Space | Space | Keep native screen/hover/editor scope and focus precedence. |
| FTB Quests (GUI) | Search (`key.ftbquests.gui.search`) | Mod+F | Mod+F | Keep native screen/hover/editor scope and focus precedence. |
| FTB Quests (GUI) | Zoom In (`key.ftbquests.gui.zoom_in`) | = | = | Keep native screen/hover/editor scope and focus precedence. |
| FTB Quests (GUI) | Zoom Out (`key.ftbquests.gui.zoom_out`) | − | − | Keep native screen/hover/editor scope and focus precedence. |
| FTB Quests (GUI) | Reset Zoom (`key.ftbquests.gui.zoom_reset`) | 0 | 0 | Keep native screen/hover/editor scope and focus precedence. |
| FTB Quests (GUI Editor Mode) | Force-complete Hovered (`key.ftbquests.gui_editor.complete_object`) | Alt+C | Alt+C | Keep native screen/hover/editor scope and focus precedence. |
| FTB Quests (GUI Editor Mode) | Copy (`key.ftbquests.gui_editor.copy`) | Mod+C | Mod+C | Keep native screen/hover/editor scope and focus precedence. |
| FTB Quests (GUI Editor Mode) | Delete Hovered / Selected (`key.ftbquests.gui_editor.delete`) | Delete | Delete | Keep native screen/hover/editor scope and focus precedence. |
| FTB Quests (GUI Editor Mode) | Force-delete Hovered / Selected (`key.ftbquests.gui_editor.force_delete`) | Shift+Delete | Shift+Delete | Keep native screen/hover/editor scope and focus precedence. |
| FTB Quests (GUI Editor Mode) | Paste (`key.ftbquests.gui_editor.paste`) | Mod+V | Mod+V | Keep native screen/hover/editor scope and focus precedence. |
| FTB Quests (GUI Editor Mode) | Redo (`key.ftbquests.gui_editor.redo`) | Mod+Y | Mod+Y | Keep native screen/hover/editor scope and focus precedence. |
| FTB Quests (GUI Editor Mode) | Reload Theme (`key.ftbquests.gui_editor.reload_theme`) | F5 | F5 | Keep native screen/hover/editor scope and focus precedence. |
| FTB Quests (GUI Editor Mode) | Force-reset Hovered (`key.ftbquests.gui_editor.reset_object`) | Alt+R | Alt+R | Keep native screen/hover/editor scope and focus precedence. |
| FTB Quests (GUI Editor Mode) | Open Reward Table Editor (`key.ftbquests.gui_editor.reward_tables`) | Mod+T | Mod+T | Keep native screen/hover/editor scope and focus precedence. |
| FTB Quests (GUI Editor Mode) | Save Quests Now (`key.ftbquests.gui_editor.save`) | Mod+S | Mod+S | Keep native screen/hover/editor scope and focus precedence. |
| FTB Quests (GUI Editor Mode) | Select All (`key.ftbquests.gui_editor.select_all`) | Mod+A | Mod+A | Keep native screen/hover/editor scope and focus precedence. |
| FTB Quests (GUI Editor Mode) | Select None (`key.ftbquests.gui_editor.select_none`) | Mod+D | Mod+D | Keep native screen/hover/editor scope and focus precedence. |
| FTB Quests (GUI Editor Mode) | Toggle Crosshairs (`key.ftbquests.gui_editor.toggle_crosshairs`) | Mod+R | Mod+R | Keep native screen/hover/editor scope and focus precedence. |
| FTB Quests (GUI Editor Mode) | Undo (`key.ftbquests.gui_editor.undo`) | Mod+Z | Mod+Z | Keep native screen/hover/editor scope and focus precedence. |
| FTB Quests (Quest View Panel) | Insert Line (`key.ftbquests.gui_quest_panel.add_image`) | I | I | Keep native screen/hover/editor scope and focus precedence. |
| FTB Quests (Quest View Panel) | Insert Image (`key.ftbquests.gui_quest_panel.add_line`) | L | L | Keep native screen/hover/editor scope and focus precedence. |
| FTB Quests (Quest View Panel) | Insert Page Break (`key.ftbquests.gui_quest_panel.add_page_break`) | P | P | Keep native screen/hover/editor scope and focus precedence. |
| FTB Quests (Quest View Panel) | Edit Description (`key.ftbquests.gui_quest_panel.edit_desc`) | D | D | Keep native screen/hover/editor scope and focus precedence. |
| FTB Quests (Quest View Panel) | Edit Quest Properties (`key.ftbquests.gui_quest_panel.edit_quest_props`) | Q | Q | Keep native screen/hover/editor scope and focus precedence. |
| FTB Quests (Quest View Panel) | Edit Subtitle (`key.ftbquests.gui_quest_panel.edit_subtitle`) | S | S | Keep native screen/hover/editor scope and focus precedence. |
| FTB Quests (Quest View Panel) | Edit Title (`key.ftbquests.gui_quest_panel.edit_title`) | T | T | Keep native screen/hover/editor scope and focus precedence. |
| Iris | Reload Shaders (`iris.keybind.reload`) | F8 | F8 | Keep native context, permission and focus ownership. |
| Iris | Shaderpack Selection Screen (`iris.keybind.shaderPackSelection`) | O | O | Keep native context, permission and focus ownership. |
| Iris | Toggle Shaders (`iris.keybind.toggleShaders`) | K | K | Keep native context, permission and focus ownership. |
| Iris | Wireframe (SP only) (`iris.keybind.wireframe`) | Unassigned | Unassigned | Keep opt-in. Controls retains assignment; no menu fallback is assumed. |
| JEI (Cheat Mode) | Cheat One Stack (`key.jei.cheatItemStack`) | Shift+Mouse Left | Shift+Mouse Left | Keep native screen/hover/editor scope and focus precedence. |
| JEI (Cheat Mode) | Cheat One Stack (Alternate) (`key.jei.cheatItemStack2`) | Mouse Middle | Mouse Middle | Keep native screen/hover/editor scope and focus precedence. |
| JEI (Cheat Mode) | Cheat One Stack to Inventory (`key.jei.cheatItemStackToInventory`) | Alt+Mouse Left | Alt+Mouse Left | Keep native screen/hover/editor scope and focus precedence. |
| JEI (Cheat Mode) | Cheat One Item (`key.jei.cheatOneItem`) | Mouse Left | Mouse Left | Keep native screen/hover/editor scope and focus precedence. |
| JEI (Cheat Mode) | Cheat One Item (Alternate) (`key.jei.cheatOneItem2`) | Mouse Right | Mouse Right | Keep native screen/hover/editor scope and focus precedence. |
| JEI (Cheat Mode) | Cheat One Item to Inventory (`key.jei.cheatOneItemToInventory`) | Alt+Mouse Right | Alt+Mouse Right | Keep native screen/hover/editor scope and focus precedence. |
| JEI (Cheat Mode) | Toggle Cheat Mode (`key.jei.toggleCheatMode`) | Unassigned | Unassigned | Keep opt-in. Controls retains assignment; no menu fallback is assumed. |
| JEI (Dev Tools) | Copy Recipe ID to Clipboard (`key.jei.copy.recipe.id`) | Unassigned | Unassigned | Keep opt-in. Controls retains assignment; no menu fallback is assumed. |
| JEI (Edit Mode) | Toggle Hide Ingredients Mode (`key.jei.toggleEditMode`) | Unassigned | Unassigned | Keep opt-in. Controls retains assignment; no menu fallback is assumed. |
| JEI (Edit Mode) | Hide Ingredient (`key.jei.toggleHideIngredient`) | Mod+Mouse Left | Mod+Mouse Left | Keep native screen/hover/editor scope and focus precedence. |
| JEI (Edit Mode) | Hide Ingredient (With Wildcard) (`key.jei.toggleWildcardHideIngredient`) | Mod+Mouse Right | Mod+Mouse Right | Keep native screen/hover/editor scope and focus precedence. |
| JEI (Hovering With Mouse Over Config Button) | Toggle Cheat Mode (`key.jei.toggleCheatModeConfigButton`) | Mod+Mouse Left | Mod+Mouse Left | Keep native screen/hover/editor scope and focus precedence. |
| JEI (Hovering With Mouse Over Config Button) | Toggle Hide Ingredients When Not Searching (`key.jei.toggleHideIngredientsWhenNotSearching`) | Mod+Mouse Right | Mod+Mouse Right | Keep native screen/hover/editor scope and focus precedence. |
| JEI (Hovering With Mouse) | Add/Remove Bookmark (`key.jei.bookmark`) | A | A | Keep native screen/hover/editor scope and focus precedence. |
| JEI (Hovering With Mouse) | Craft Bookmarked Recipe (Many) (`key.jei.maxTransferRecipeBookmark`) | Mod+Mouse Left | Mod+Mouse Left | Keep native screen/hover/editor scope and focus precedence. |
| JEI (Hovering With Mouse) | Quick Move Ghost Item (`key.jei.quickMove`) | Shift+Mouse Left | Shift+Mouse Left | Keep native screen/hover/editor scope and focus precedence. |
| JEI (Hovering With Mouse) | Share Item to Chat (`key.jei.shareToChat`) | Unassigned | Unassigned | Keep opt-in. Controls retains assignment; no menu fallback is assumed. |
| JEI (Hovering With Mouse) | Show Recipe for Hovered Ingredient (`key.jei.showRecipe`) | R | R | Keep native screen/hover/editor scope and focus precedence. |
| JEI (Hovering With Mouse) | Show Recipe for Hovered Ingredient (Alternate) (`key.jei.showRecipe2`) | Mouse Left | Mouse Left | Keep native screen/hover/editor scope and focus precedence. |
| JEI (Hovering With Mouse) | Show Uses for Hovered Ingredient (`key.jei.showUses`) | U | U | Keep native screen/hover/editor scope and focus precedence. |
| JEI (Hovering With Mouse) | Show Uses for Hovered Ingredient (Alternate) (`key.jei.showUses2`) | Mouse Right | Mouse Right | Keep native screen/hover/editor scope and focus precedence. |
| JEI (Hovering With Mouse) | Craft Bookmarked Recipe (One) (`key.jei.transferRecipeBookmark`) | Shift+Mouse Left | Shift+Mouse Left | Keep native screen/hover/editor scope and focus precedence. |
| JEI (Overlays) | Select Search Bar (`key.jei.focusSearch`) | Mod+F | Mod+F | Keep native screen/hover/editor scope and focus precedence. |
| JEI (Overlays) | Next Page (`key.jei.nextPage`) | Unassigned | Unassigned | Keep opt-in. Controls retains assignment; no menu fallback is assumed. |
| JEI (Overlays) | Previous Page (`key.jei.previousPage`) | Unassigned | Unassigned | Keep opt-in. Controls retains assignment; no menu fallback is assumed. |
| JEI (Overlays) | Show/Hide Bookmarked Ingredients (`key.jei.toggleBookmarkOverlay`) | Unassigned | Unassigned | Keep opt-in. Controls retains assignment; no menu fallback is assumed. |
| JEI (Overlays) | Show/Hide JEI Overlays (`key.jei.toggleOverlay`) | Mod+O | Mod+O | Keep native screen/hover/editor scope and focus precedence. |
| JEI (Recipes) | Close Recipes GUI (`key.jei.closeRecipeGui`) | Escape | Escape | Keep native screen/hover/editor scope and focus precedence. |
| JEI (Recipes) | Craft Hovered Recipe (Many) (`key.jei.maxTransferRecipeGui`) | Unassigned | Unassigned | Keep opt-in. Controls retains assignment; no menu fallback is assumed. |
| JEI (Recipes) | Next Recipe Category (`key.jei.nextCategory`) | Shift+Page Down | Shift+Page Down | Keep native screen/hover/editor scope and focus precedence. |
| JEI (Recipes) | Next Recipe Page (`key.jei.nextRecipePage`) | Page Down | Page Down | Keep native screen/hover/editor scope and focus precedence. |
| JEI (Recipes) | Pause Recipe Ingredient Cycling (`key.jei.pauseRecipeCycling`) | Left Shift | Left Shift | Keep native screen/hover/editor scope and focus precedence. |
| JEI (Recipes) | Previous Recipe Category (`key.jei.previousCategory`) | Shift+Page Up | Shift+Page Up | Keep native screen/hover/editor scope and focus precedence. |
| JEI (Recipes) | Previous Recipe Page (`key.jei.previousRecipePage`) | Page Up | Page Up | Keep native screen/hover/editor scope and focus precedence. |
| JEI (Recipes) | Previous Recipe (`key.jei.recipeBack`) | Backspace | Backspace | Keep native screen/hover/editor scope and focus precedence. |
| JEI (Recipes) | Next Recipe (`key.jei.recipeForward`) | Unassigned | Unassigned | Keep opt-in. Controls retains assignment; no menu fallback is assumed. |
| JEI (Recipes) | Craft Hovered Recipe (One) (`key.jei.transferRecipeGui`) | Unassigned | Unassigned | Keep opt-in. Controls retains assignment; no menu fallback is assumed. |
| JEI (Search Filter) | Clear Search Filter (`key.jei.clearSearchBar`) | Mouse Right | Mouse Right | Keep native screen/hover/editor scope and focus precedence. |
| JEI (Search Filter) | Next Search (`key.jei.nextSearch`) | Down | Down | Keep native screen/hover/editor scope and focus precedence. |
| JEI (Search Filter) | Previous Search (`key.jei.previousSearch`) | Up | Up | Keep native screen/hover/editor scope and focus precedence. |
| Carry On | Carry (`key.carry.desc`) | Unassigned | Unassigned | Keep opt-in. Controls retains assignment; no menu fallback is assumed. |
| Aeroworks | Free Camera While Controlling Joystick (`key.aeroworks.joystick.free_camera`) | Left Shift | Left Shift | Keep native context, permission and focus ownership. |
| Analog Audio | Switch Input Mode (`key.analogaudio.switch_input_mode`) | Left Alt | Mod+F4 | Remap; qualify consumer, context and transitions. |
| Climbable Ropes | Lock Rope Camera (`key.climbable_ropes.lock_rope_camera`) | Left Alt | Mod+; | Remap; qualify consumer, context and transitions. |
| CMDCam Settings | Reset Zoom (`key.centerzoom`) | Unassigned | Mod+Up | Enable; qualify consumer, context and transitions. |
| CMDCam Settings | Clear Points (`key.clearPoint`) | Unassigned | Mod+Backspace | Enable; qualify consumer, context and transitions. |
| CMDCam Settings | Add Point (`key.point`) | Unassigned | Mod+Enter | Enable; qualify consumer, context and transitions. |
| CMDCam Settings | Reset Roll (`key.rollcenter`) | Unassigned | Mod+Down | Enable; qualify consumer, context and transitions. |
| CMDCam Settings | Roll Left (`key.rollleft`) | Unassigned | Mod+Left | Enable; qualify consumer, context and transitions. |
| CMDCam Settings | Roll Right (`key.rollright`) | Unassigned | Mod+Right | Enable; qualify consumer, context and transitions. |
| CMDCam Settings | Start and Stop (`key.startStop`) | Unassigned | F10 | Enable; qualify consumer, context and transitions. |
| CMDCam Settings | Zoom in (`key.zoomin`) | Unassigned | Mod+= | Enable; qualify consumer, context and transitions. |
| CMDCam Settings | Zoom out (`key.zoomout`) | Unassigned | Mod+− | Enable; qualify consumer, context and transitions. |
| Creative Mode | Load Hotbar Activator (`key.loadToolbarActivator`) | X | X | Keep native held activator plus digit behavior. |
| Creative Mode | Save Hotbar Activator (`key.saveToolbarActivator`) | C | C | Keep native context, permission and focus ownership. |
| Effortless Building | Open Modifier Settings (`key.effortlessbuilding.open_modifiers_screen`) | Keypad Add | F4 | Remap; qualify consumer, context and transitions. |
| Effortless Building | Open Radial Menu (`key.effortlessbuilding.open_radial_menu`) | Left Alt | Left Alt | Keep native context, permission and focus ownership. |
| Effortless Building | Redo (`key.effortlessbuilding.redo.desc`) | Y | Mod+Y | Explicit platform modifier through qualified native history admission. |
| Effortless Building | Undo (`key.effortlessbuilding.undo.desc`) | Z | Mod+Z | Explicit platform modifier through qualified native history admission. |
| FTB Teams | Open Teams GUI (`key.ftbteams.open_gui`) | Unassigned | Mod+T | Enable; qualify consumer, context and transitions. |
| Gameplay | Attack/Destroy (`key.attack`) | Mouse Left | Mouse Left | Keep native context, permission and focus ownership. |
| Gameplay | Pick Block (`key.pickItem`) | Mouse Middle | Mouse Middle | Keep native context, permission and focus ownership. |
| Gameplay | Use Item/Place Block (`key.use`) | Mouse Right | Mouse Right | Keep native context, permission and focus ownership. |
| Glint Outline | Open settings panel (`key.hmioutline.settings`) | O | Mod+O | Remap; qualify consumer, context and transitions. |
| Inventory | Drop Selected Item (`key.drop`) | Q | Q | Keep native context, permission and focus ownership. |
| Inventory | Hotbar Slot 1 (`key.hotbar.1`) | 1 | 1 | Keep native context, permission and focus ownership. |
| Inventory | Hotbar Slot 2 (`key.hotbar.2`) | 2 | 2 | Keep native context, permission and focus ownership. |
| Inventory | Hotbar Slot 3 (`key.hotbar.3`) | 3 | 3 | Keep native context, permission and focus ownership. |
| Inventory | Hotbar Slot 4 (`key.hotbar.4`) | 4 | 4 | Keep native context, permission and focus ownership. |
| Inventory | Hotbar Slot 5 (`key.hotbar.5`) | 5 | 5 | Keep native context, permission and focus ownership. |
| Inventory | Hotbar Slot 6 (`key.hotbar.6`) | 6 | 6 | Keep native context, permission and focus ownership. |
| Inventory | Hotbar Slot 7 (`key.hotbar.7`) | 7 | 7 | Keep native context, permission and focus ownership. |
| Inventory | Hotbar Slot 8 (`key.hotbar.8`) | 8 | 8 | Keep native context, permission and focus ownership. |
| Inventory | Hotbar Slot 9 (`key.hotbar.9`) | 9 | 9 | Keep native context, permission and focus ownership. |
| Inventory | Open/Close Inventory (`key.inventory`) | E | E | Keep native context, permission and focus ownership. |
| Inventory | Swap Item With Off Hand (`key.swapOffhand`) | F | F | Keep native context, permission and focus ownership. |
| Miscellaneous | Advancements (`key.advancements`) | L | L | Keep native context, permission and focus ownership. |
| Miscellaneous | Disable Dynamic FPS (Toggle) (`key.dynamic_fps.toggle_disabled`) | Unassigned | Unassigned | Keep opt-in. Controls retains assignment; no menu fallback is assumed. |
| Miscellaneous | Force Unfocused Mode (Toggle) (`key.dynamic_fps.toggle_forced`) | Unassigned | Unassigned | Keep opt-in. Controls retains assignment; no menu fallback is assumed. |
| Miscellaneous | Toggle Fullscreen (`key.fullscreen`) | F11 | F11 | Keep native context, permission and focus ownership. |
| Miscellaneous | Open journal (`key.questlog.open`) | Unassigned | Unassigned | Keep opt-in. Controls retains assignment; no menu fallback is assumed. |
| Miscellaneous | Take Screenshot (`key.screenshot`) | F2 | F2 | Keep native context, permission and focus ownership. |
| Miscellaneous | Toggle Cinematic Camera (`key.smoothCamera`) | Unassigned | Unassigned | Keep opt-in. Controls retains assignment; no menu fallback is assumed. |
| Miscellaneous | Highlight Players (Spectators) (`key.spectatorOutlines`) | Unassigned | Unassigned | Keep opt-in. Controls retains assignment; no menu fallback is assumed. |
| Miscellaneous | Toggle Perspective (`key.togglePerspective`) | F5 | F5 | Keep native context, permission and focus ownership. |
| Miscellaneous | Toggle First-Person Lighting (`lambdynlights.key.toggle_fps_dynamic_lighting`) | Unassigned | Unassigned | Keep opt-in. Controls retains assignment; no menu fallback is assumed. |
| Movement | Walk Backwards (`key.back`) | S | S | Keep native context, permission and focus ownership. |
| Movement | Walk Forwards (`key.forward`) | W | W | Keep native context, permission and focus ownership. |
| Movement | Jump (`key.jump`) | Space | Space | Keep native context, permission and focus ownership. |
| Movement | Strafe Left (`key.left`) | A | A | Keep native context, permission and focus ownership. |
| Movement | Strafe Right (`key.right`) | D | D | Keep native context, permission and focus ownership. |
| Movement | Sneak (`key.sneak`) | Left Shift | Left Shift | Keep native context, permission and focus ownership. |
| Movement | Sprint (`key.sprint`) | Left Control | Left Control | Keep native context, permission and focus ownership. |
| Multiplayer | Open Chat (`key.chat`) | T | T | Keep native context, permission and focus ownership. |
| Multiplayer | Open Command (`key.command`) | Slash | Slash | Keep native context, permission and focus ownership. |
| Multiplayer | List Players (`key.playerlist`) | Tab | Tab | Keep native context, permission and focus ownership. |
| Multiplayer | Social Interactions Screen (`key.socialInteractions`) | P | P | Keep native context, permission and focus ownership. |
| Ponder | Ponder (`key.ponder.ponder`) | W | W | Keep native context, permission and focus ownership. |
| Punchy! | Inspect (`key.punchy.inspect`) | I | I | Keep native context, permission and focus ownership. |
| Punchy! | Open Punchy Menu (`key.punchy.open_main_menu`) | F9 | F9 | Keep native context, permission and focus ownership. |
| Punchy! | Sword Inspect Classic (`key.punchy.triggerable.punchy_sword_inspect_old`) | J | Unassigned | Unassign competing shortcut; preserve stated menu/opt-in access and unique-clip review. |
| Punchy! | Sword inspect — reworked (`key.punchy.triggerable.punchy_sword_inspect_rework`) | G | Unassigned | Unassign competing shortcut; preserve stated menu/opt-in access and unique-clip review. |
| Punchy Moves | Open Camera Settings (`key.punchy_moves.camera_editor`) | F7 | Shift+U | Share the camera group through qualified native modifier priority. |
| Punchy Moves | Toggle Custom Camera (`key.punchy_moves.camera_toggle_v`) | F6 | Mod+U | Share the camera group through qualified native modifier priority. |
| Punchy Moves | key.punchy_moves.emote.cool_emote (`key.punchy_moves.emote.cool_emote`) | K | Unassigned | Unassign competing shortcut; preserve stated menu/opt-in access and unique-clip review. |
| Punchy Moves | Emote: Hello (`key.punchy_moves.emote.hello`) | H | Unassigned | Unassign competing shortcut; preserve stated menu/opt-in access and unique-clip review. |
| Punchy Moves | Emote: Hello B (`key.punchy_moves.emote.hello_b`) | J | Unassigned | Unassign competing shortcut; preserve stated menu/opt-in access and unique-clip review. |
| Punchy Moves | key.punchy_moves.emote.shuuba_dance (`key.punchy_moves.emote.shuuba_dance`) | L | Unassigned | Unassign competing shortcut; preserve stated menu/opt-in access and unique-clip review. |
| Punchy Moves | Open Emote Wheel (`key.punchy_moves.emote_menu`) | J | J | Keep native context, permission and focus ownership. |
| Punchy Moves | Toggle Orbit Camera (`key.punchy_moves.free_camera`) | Unassigned | U | Enable; qualify consumer, context and transitions. |
| Reliable Gliders | Deploy Glider (`key.reliable_gliders.deploy`) | Unassigned | Unassigned | Keep opt-in. Controls retains assignment; no menu fallback is assumed. |
| Skyweave: Compatibility Patches | Wayfinder (`key.skyweave_compat.wayfinder`) | G | F12 | Remap; qualify consumer, context and transitions. |
| InvMove | Toggle UI Movement (`keybind.invmove.toggleMove`) | Unassigned | Unassigned | Keep opt-in. Controls retains assignment; no menu fallback is assumed. |
| Interactive Foliage | Open Config (`key.mc2_interactivefoliage.open_config`) | Unassigned | Unassigned | Keep opt-in. Controls retains assignment; no menu fallback is assumed. |
| Interactive Foliage | Toggle Mod (`key.mc2_interactivefoliage.toggle`) | Unassigned | Unassigned | Keep opt-in. Controls retains assignment; no menu fallback is assumed. |
| Ping Wheel | Open Settings (`key.pingwheel.open_settings`) | Unassigned | Unassigned | Keep opt-in. Controls retains assignment; no menu fallback is assumed. |
| Ping Wheel | Ping Location (`key.pingwheel.ping_location`) | Mouse 5 | G | Remap; qualify consumer, context and transitions. |
| Create Big Cannons | Fire Controlled Cannon (`key.createbigcannons.fire_controlled_cannon`) | Mouse Left | Mouse Left | Keep native context, permission and focus ownership. |
| Create Big Cannons | Change Carriage Mode (`key.createbigcannons.pitch_mode`) | , | , | Keep native context, permission and focus ownership. |
| Grappling Hook Mod | Throw Hook(s) (`key.boththrow.desc`) | Unassigned | Unassigned | Retain semantic fallback; upgraded/offhand action qualification remains open. |
| Grappling Hook Mod | Climb (`key.climb.desc`) | Unassigned | Unassigned | Retain semantic fallback; upgraded/offhand action qualification remains open. |
| Grappling Hook Mod | Climb down (`key.climbdown.desc`) | Unassigned | Unassigned | Retain semantic fallback; upgraded/offhand action qualification remains open. |
| Grappling Hook Mod | Climb up (`key.climbup.desc`) | Unassigned | Unassigned | Retain semantic fallback; upgraded/offhand action qualification remains open. |
| Grappling Hook Mod | Hook Ender Staff Launch (`key.enderlaunch.desc`) | Unassigned | Unassigned | Retain semantic fallback; upgraded/offhand action qualification remains open. |
| Grappling Hook Mod | Jump and Detach (`key.jumpanddetach.desc`) | Unassigned | Unassigned | Retain semantic fallback; upgraded/offhand action qualification remains open. |
| Grappling Hook Mod | Throw Main Hook (`key.main_throw.desc`) | Unassigned | Unassigned | Retain semantic fallback; upgraded/offhand action qualification remains open. |
| Grappling Hook Mod | Motor On/Off (`key.motoronoff.desc`) | Unassigned | Unassigned | Retain semantic fallback; upgraded/offhand action qualification remains open. |
| Grappling Hook Mod | Throw Off Hook (`key.off_throw.desc`) | Unassigned | Unassigned | Retain semantic fallback; upgraded/offhand action qualification remains open. |
| Grappling Hook Mod | Rocket (`key.rocket.desc`) | Unassigned | Unassigned | Retain semantic fallback; upgraded/offhand action qualification remains open. |
| Grappling Hook Mod | Slow down / Stop swinging (`key.slow.desc`) | Unassigned | Unassigned | Retain semantic fallback; upgraded/offhand action qualification remains open. |
| ModernFix | Open config screen (`key.modernfix.config`) | Unassigned | Unassigned | Keep opt-in. Controls retains assignment; no menu fallback is assumed. |
| Traveler's Backpack | Enable/Disable Special Ability (`key.travelersbackpack.ability`) | Unassigned | Unassigned | Keep opt-in. Controls retains assignment; no menu fallback is assumed. |
| Traveler's Backpack | Swap Tool/Change Hose Mode (`key.travelersbackpack.cycle_tool`) | Z | = | Remap; qualify consumer, context and transitions. |
| Traveler's Backpack | Open Backpack (`key.travelersbackpack.inventory`) | B | B | Keep native context, permission and focus ownership. |
| Traveler's Backpack | Sort Backpack (`key.travelersbackpack.sort`) | Unassigned | Unassigned | Keep opt-in. Controls retains assignment; no menu fallback is assumed. |
| Traveler's Backpack | Toggle Upgrade in the 1st slot (`key.travelersbackpack.toggle_upgrade_0`) | Unassigned | Unassigned | Keep opt-in. Controls retains assignment; no menu fallback is assumed. |
| Traveler's Backpack | Toggle Upgrade in the 2nd slot (`key.travelersbackpack.toggle_upgrade_1`) | Unassigned | Unassigned | Keep opt-in. Controls retains assignment; no menu fallback is assumed. |
| Traveler's Backpack | Toggle Upgrade in the 3rd slot (`key.travelersbackpack.toggle_upgrade_2`) | Unassigned | Unassigned | Keep opt-in. Controls retains assignment; no menu fallback is assumed. |
| Traveler's Backpack | Toggle Upgrade in the 4th slot (`key.travelersbackpack.toggle_upgrade_3`) | Unassigned | Unassigned | Keep opt-in. Controls retains assignment; no menu fallback is assumed. |
| Jade | Open Config (`key.jade.config`) | Keypad 0 | Backslash | Remap; qualify consumer, context and transitions. |
| Jade | Narrate (`key.jade.narrate`) | Keypad 5 | Mod+] | Remap; qualify consumer, context and transitions. |
| Jade | Show Details (`key.jade.show_details`) | Left Shift | Left Shift | Keep native context, permission and focus ownership. |
| Jade | Show Overlay (`key.jade.show_overlay`) | Keypad 1 | Mod+Backslash | Remap; qualify consumer, context and transitions. |
| Jade | Show Recipes (`key.jade.show_recipes`) | Keypad 3 | Shift+[ | Remap; qualify consumer, context and transitions. |
| Jade | Show Uses (`key.jade.show_uses`) | Keypad 4 | Shift+] | Remap; qualify consumer, context and transitions. |
| Jade | Toggle Fluid (`key.jade.toggle_liquid`) | Keypad 2 | Mod+[ | Remap; qualify consumer, context and transitions. |
| EntityCulling | Debug toggle culling (`key.entityculling.toggle`) | Unassigned | Unassigned | Keep opt-in. Controls retains assignment; no menu fallback is assumed. |

## IPN custom definitions

Keep the custom dispatcher and its configured contexts/alternatives; do not turn these into a second native dispatcher. R-prefixed combinations are held chords, not sequences. Disabled scrolling retains inactive definitions. The separate IPN repair owns actual text/IME/context qualification. This pass changes only the tool-refill bypass among custom definitions.

| Stable ID | Before | Authored | Decision |
| --- | --- | --- | --- |
| `AutoRefillSettings.AUTO_REFILL_TEMP_DISABLE_REFILL_FOR_TOOLS` | Alt | Right Control (physical) | Move held bypass off building modifier; preserve release behavior. |
| `ConfigScreenSettings.OpenConfigHotkey` | r + c | r + c | Keep custom scope/settings and alternatives; no text-safety claim. |
| `Debugs.CLEAN_CURSOR` | x + 1 | x + 1 | Keep custom scope/settings and alternatives; no text-safety claim. |
| `Debugs.DEBUG_SCREEN` | z + 1 | z + 1 | Keep custom scope/settings and alternatives; no text-safety claim. |
| `Debugs.SCREEN_DEPTH_TEST` | z + 2 | z + 2 | Keep custom scope/settings and alternatives; no text-safety claim. |
| `Debugs.SCREEN_SPRITE_TEST` | z + 3 | z + 3 | Keep custom scope/settings and alternatives; no text-safety claim. |
| `Hotkeys.APPLY_PROFILE` | r + h | r + h | Keep custom scope/settings and alternatives; no text-safety claim. |
| `Hotkeys.AUTO_REFILL_GAME_TOGGLE_FOR_SLOT` | Ctrl + r | Ctrl + r | Keep custom scope/settings and alternatives; no text-safety claim. |
| `Hotkeys.AUTO_REFILL_GUI_TOGGLE_FOR_SLOT` | Ctrl + Left Button | Ctrl + Left Button | Keep custom scope/settings and alternatives; no text-safety claim. |
| `Hotkeys.COPY_COMPONENTS` | Ctrl + c | Ctrl + c | Keep custom scope/settings and alternatives; no text-safety claim. |
| `Hotkeys.COPY_ITEM_ID` | Ctrl + Shift + c | Ctrl + Shift + c | Keep custom scope/settings and alternatives; no text-safety claim. |
| `Hotkeys.DO_GLOBAL_TRADE` | t | t | Keep custom scope/settings and alternatives; no text-safety claim. |
| `Hotkeys.DO_GLOBAL_TRADE1` | Unassigned | Unassigned | Keep custom scope/settings and alternatives; no text-safety claim. |
| `Hotkeys.DO_GLOBAL_TRADE2` | Unassigned | Unassigned | Keep custom scope/settings and alternatives; no text-safety claim. |
| `Hotkeys.DO_LOCAL_TRADE` | Shift + t | Shift + t | Keep custom scope/settings and alternatives; no text-safety claim. |
| `Hotkeys.DO_LOCAL_TRADE1` | Unassigned | Unassigned | Keep custom scope/settings and alternatives; no text-safety claim. |
| `Hotkeys.DO_LOCAL_TRADE2` | Unassigned | Unassigned | Keep custom scope/settings and alternatives; no text-safety claim. |
| `Hotkeys.DUMP_ITEM_NBT_TO_CHAT` | Unassigned | Unassigned | Keep custom scope/settings and alternatives; no text-safety claim. |
| `Hotkeys.GLOBAL_BOOKMARK_TRADE` | b | b | Keep custom scope/settings and alternatives; no text-safety claim. |
| `Hotkeys.GLOBAL_BOOKMARK_TRADE1` | Unassigned | Unassigned | Keep custom scope/settings and alternatives; no text-safety claim. |
| `Hotkeys.GLOBAL_BOOKMARK_TRADE2` | Unassigned | Unassigned | Keep custom scope/settings and alternatives; no text-safety claim. |
| `Hotkeys.LOCAL_BOOKMARK_TRADE` | l | l | Keep custom scope/settings and alternatives; no text-safety claim. |
| `Hotkeys.LOCAL_BOOKMARK_TRADE1` | Unassigned | Unassigned | Keep custom scope/settings and alternatives; no text-safety claim. |
| `Hotkeys.LOCAL_BOOKMARK_TRADE2` | Unassigned | Unassigned | Keep custom scope/settings and alternatives; no text-safety claim. |
| `Hotkeys.MOVE_ALL_ITEMS` | r + t | r + t | Keep custom scope/settings and alternatives; no text-safety claim. |
| `Hotkeys.NEXT_PROFILE` | r + z | r + z | Keep custom scope/settings and alternatives; no text-safety claim. |
| `Hotkeys.OPEN_CONFIG_MENU` | r + c | r + c | Keep custom scope/settings and alternatives; no text-safety claim. |
| `Hotkeys.OPEN_GUI_EDITOR` | r + g | r + g | Keep custom scope/settings and alternatives; no text-safety claim. |
| `Hotkeys.PREV_PROFILE` | r + x | r + x | Keep custom scope/settings and alternatives; no text-safety claim. |
| `Hotkeys.PROFILE_1` | r + 1 | r + 1 | Keep custom scope/settings and alternatives; no text-safety claim. |
| `Hotkeys.PROFILE_10` | r + 0 | r + 0 | Keep custom scope/settings and alternatives; no text-safety claim. |
| `Hotkeys.PROFILE_2` | r + 2 | r + 2 | Keep custom scope/settings and alternatives; no text-safety claim. |
| `Hotkeys.PROFILE_3` | r + 3 | r + 3 | Keep custom scope/settings and alternatives; no text-safety claim. |
| `Hotkeys.PROFILE_4` | r + 4 | r + 4 | Keep custom scope/settings and alternatives; no text-safety claim. |
| `Hotkeys.PROFILE_5` | r + 5 | r + 5 | Keep custom scope/settings and alternatives; no text-safety claim. |
| `Hotkeys.PROFILE_6` | r + 6 | r + 6 | Keep custom scope/settings and alternatives; no text-safety claim. |
| `Hotkeys.PROFILE_7` | r + 7 | r + 7 | Keep custom scope/settings and alternatives; no text-safety claim. |
| `Hotkeys.PROFILE_8` | r + 8 | r + 8 | Keep custom scope/settings and alternatives; no text-safety claim. |
| `Hotkeys.PROFILE_9` | r + 9 | r + 9 | Keep custom scope/settings and alternatives; no text-safety claim. |
| `Hotkeys.RELOAD_CUSTOM_CONFIGS` | r + y | r + y | Keep custom scope/settings and alternatives; no text-safety claim. |
| `Hotkeys.SAVE_AS_PROFILE` | r + p | r + p | Keep custom scope/settings and alternatives; no text-safety claim. |
| `Hotkeys.SCROLL_TO_CHEST` | Scroll Wheel Up | Scroll Wheel Up | Keep custom scope/settings and alternatives; no text-safety claim. |
| `Hotkeys.SCROLL_TO_INVENTORY` | Scroll Wheel Down | Scroll Wheel Down | Keep custom scope/settings and alternatives; no text-safety claim. |
| `Hotkeys.SORT_INVENTORY` | Middle Button | Middle Button | Keep custom scope/settings and alternatives; no text-safety claim. |
| `Hotkeys.SORT_INVENTORY_IN_COLUMNS` | Unassigned | Unassigned | Keep custom scope/settings and alternatives; no text-safety claim. |
| `Hotkeys.SORT_INVENTORY_IN_ROWS` | Unassigned | Unassigned | Keep custom scope/settings and alternatives; no text-safety claim. |
| `Hotkeys.THROW_ALL_ITEMS` | r + m | r + m | Keep custom scope/settings and alternatives; no text-safety claim. |
| `LockedSlotsSettings.LOCK_SLOTS_CONFIG_KEY` | Left Button | Left Button | Keep custom scope/settings and alternatives; no text-safety claim. |
| `LockedSlotsSettings.LOCK_SLOTS_QUICK_CONFIG_KEY` | Unassigned | Unassigned | Keep custom scope/settings and alternatives; no text-safety claim. |
| `LockedSlotsSettings.LOCK_SLOTS_QUICK_DISABLE` | Unassigned | Unassigned | Keep custom scope/settings and alternatives; no text-safety claim. |
| `LockedSlotsSettings.LOCK_SLOTS_SWITCH_CONFIG_MODIFIER` | Alt | Alt | Keep custom scope/settings and alternatives; no text-safety claim. |
| `ModSettings.INCLUDE_HOTBAR_MODIFIER` | Alt | Alt | Keep custom scope/settings and alternatives; no text-safety claim. |
| `ModSettings.MOVE_ALL_MODIFIER` | Shift | Shift | Keep custom scope/settings and alternatives; no text-safety claim. |
| `ModSettings.MOVE_FOCUS_MACH_MODIFIER` | Ctrl | Ctrl | Keep custom scope/settings and alternatives; no text-safety claim. |
| `ModSettings.MOVE_JUST_REFILL_MODIFIER` | Caps Lock | Caps Lock | Keep custom scope/settings and alternatives; no text-safety claim. |
| `Modpacks.GEN_TEST_ARENA` | Unassigned | Unassigned | Keep custom scope/settings and alternatives; no text-safety claim. |
| `ScrollSettings.SCROLL_FULL_STACK` | Shift | Shift | Keep custom scope/settings and alternatives; no text-safety claim. |
| `ScrollSettings.SCROLL_LEAVE_LAST` | z | z | Keep custom scope/settings and alternatives; no text-safety claim. |
| `ScrollSettings.SCROLL_SPREAD` | x | x | Keep custom scope/settings and alternatives; no text-safety claim. |
| `ScrollSettings.SCROLL_THROW` | c | c | Keep custom scope/settings and alternatives; no text-safety claim. |
| `ScrollSettings.TEMP_DISABLE` | Ctrl | Ctrl | Keep custom scope/settings and alternatives; no text-safety claim. |

## EMI custom definitions

Retain the existing recipe-browser/JEI-bridge workflow. Repeated native bridge mappings are not proof of duplicate execution. Hover, search, edit/cheat mode, permissions, cursor and native focus retain authority; specialized unassigned actions remain opt-in.

| Stable ID | Authored alternatives | Decision |
| --- | --- | --- |
| `back` | key.keyboard.backspace, key.keyboard.unknown | Keep native reader, alternatives and scope. |
| `cheatOneToCursor` | ctrl key.mouse.middle, key.keyboard.unknown | Keep native reader, alternatives and scope. |
| `cheatOneToInventory` | ctrl key.mouse.right, key.keyboard.unknown | Keep native reader, alternatives and scope. |
| `cheatStackToCursor` | key.keyboard.unknown | Keep native reader, alternatives and scope. |
| `cheatStackToInventory` | ctrl key.mouse.left, key.keyboard.unknown | Keep native reader, alternatives and scope. |
| `clearSearch` | key.keyboard.unknown | Keep native reader, alternatives and scope. |
| `copyId` | key.keyboard.unknown | Keep native reader, alternatives and scope. |
| `craftAll` | shift key.mouse.left, key.keyboard.unknown | Keep native reader, alternatives and scope. |
| `craftAllToInventory` | key.keyboard.unknown | Keep native reader, alternatives and scope. |
| `craftOne` | key.mouse.left, key.keyboard.unknown | Keep native reader, alternatives and scope. |
| `craftOneToCursor` | ctrl key.mouse.left, key.keyboard.unknown | Keep native reader, alternatives and scope. |
| `craftOneToInventory` | key.keyboard.unknown | Keep native reader, alternatives and scope. |
| `defaultStack` | ctrl key.mouse.left, key.keyboard.unknown | Keep native reader, alternatives and scope. |
| `deleteCursorStack` | key.mouse.left, key.keyboard.unknown | Keep native reader, alternatives and scope. |
| `favorite` | key.keyboard.a, key.keyboard.unknown | Keep native reader, alternatives and scope. |
| `focusSearch` | ctrl key.keyboard.f, key.keyboard.unknown | Keep native reader, alternatives and scope. |
| `forward` | key.keyboard.unknown | Keep native reader, alternatives and scope. |
| `hideStack` | ctrl key.mouse.left, key.keyboard.unknown | Keep native reader, alternatives and scope. |
| `hideStackById` | ctrl shift key.mouse.left, key.keyboard.unknown | Keep native reader, alternatives and scope. |
| `showCraft` | key.keyboard.left.shift, key.keyboard.unknown | Keep native reader, alternatives and scope. |
| `toggleVisibility` | ctrl key.keyboard.o, key.keyboard.unknown | Keep native reader, alternatives and scope. |
| `viewRecipes` | key.keyboard.r, key.mouse.left, key.keyboard.unknown | Keep native reader, alternatives and scope. |
| `viewStackTree` | key.keyboard.unknown | Keep native reader, alternatives and scope. |
| `viewTree` | key.keyboard.unknown | Keep native reader, alternatives and scope. |
| `viewUses` | key.keyboard.u, key.mouse.right, key.keyboard.unknown | Keep native reader, alternatives and scope. |

## Other input surfaces

| Surface | Pre-Compat decision and remaining qualification |
| --- | --- |
| Mouse Tweaks | Keep right-drag, both left-drag variants and wheel transfer. IPN scrolling/swipe remains disabled. Verify one owner per gesture. |
| InvMove | Preserve admitted ordinary inventory movement and focused-text protection; unknown screens remain off. |
| Carry On | Preserve native empty-hand sneak+Use with target/permission/exclusion rules; unassigned custom carry does not remove this workflow. |
| Skybound | Preserve Use/Jump/Crouch/movement fallbacks; offhand weapon and upgraded rocket/ender activation remain a specific qualification gap. |
| Create/Ponder | Preserve tooltip hold-W, native scene controls and InvMove exclusions; Right Alt tool grouping does not alter Ponder. |
| Mounted/held controls | Retain native cannon, train/linked-controller, joystick, ship, rope and seat rules. Verify actual possession/target transitions. |
| Fixed native input | Keep F3/debug, narrator, HUD/screenshot, text/clipboard/IME and OS ownership. Test F3+F4 against the new F4 mapping. |
| Resource-defined bindings | Test explicit unassignment, registration, reset, reload/restart and custom stores. General inspection/menu remain; unique variants are not declared equivalent. |
| Flashback ImGui / camera | Screen-local input differs from KeyMappings. Test text capture, hold transitions and one camera owner; no global interception. |
| Widgets and editors | Keep Escape/back, Enter, Tab/Shift+Tab, arrows, pointer capture and editing with actual focused descendants/modal owners. |

### Fzzy configured screen controls

These are retained library screen controls. “default” preserves its native rule, not a global wildcard. Runtime/platform interpretation remains library-owned. The TOML metadata version is not an action.

| Entry | Input | Modifiers | Decision |
| --- | --- | --- | --- |
| `pageUp[0]` | keyboard: page.up | ctrl=default, shift=default, alt=default | Keep screen-local. |
| `pageDown[0]` | keyboard: page.down | ctrl=default, shift=default, alt=default | Keep screen-local. |
| `home[0]` | keyboard: home | ctrl=default, shift=default, alt=default | Keep screen-local. |
| `end[0]` | keyboard: end | ctrl=default, shift=default, alt=default | Keep screen-local. |
| `copy[0]` | keyboard: c | ctrl=true, shift=false, alt=false | Keep screen-local. |
| `paste[0]` | keyboard: v | ctrl=true, shift=false, alt=false | Keep screen-local. |
| `cut[0]` | keyboard: x | ctrl=true, shift=false, alt=false | Keep screen-local. |
| `save[0]` | keyboard: s | ctrl=true, shift=false, alt=false | Keep screen-local. |
| `undo[0]` | keyboard: z | ctrl=true, shift=false, alt=false | Keep screen-local. |
| `contextMouse[0]` | mouse: mouse.right | ctrl=default, shift=default, alt=default | Keep screen-local. |
| `back[0]` | keyboard: backspace | ctrl=default, shift=default, alt=default | Keep screen-local. |
| `search[0]` | keyboard: e | ctrl=true, shift=false, alt=false | Keep screen-local. |
| `info[0]` | keyboard: f1 | ctrl=default, shift=default, alt=default | Keep screen-local. |
| `fullExit[0]` | keyboard: escape | ctrl=false, shift=true, alt=false | Keep screen-local. |
| `find[0]` | keyboard: f | ctrl=true, shift=false, alt=false | Keep screen-local. |
| `find[1]` | keyboard: f3 | ctrl=false, shift=false, alt=false | Keep screen-local. |
| `contextKeyboard[0]` | keyboard: f10 | ctrl=false, shift=true, alt=false | Keep screen-local. |
| `contextKeyboard[1]` | keyboard: menu | ctrl=false, shift=false, alt=false | Keep screen-local. |
| `act[0]` | keyboard: enter | ctrl=false, shift=false, alt=false | Keep screen-local. |
| `act[1]` | keyboard: keypad.enter | ctrl=false, shift=false, alt=false | Keep screen-local. |

## Validation and adoption

Recapture the exact packaged client after resource reload. Registration/custom decoding supports only those claims, not gameplay, focus or layout correctness. Exercise new native modifiers, filming/editor actions, tool contexts, F3, mouse/device alternatives, hold/release, reset/reload, existing edited preferences, and custom writers. Keep unresolved limits explicit rather than equating a low duplicate count with correct operation.

Do not copy source defaults over personal options. A separately authorized reconciliation compares old/new defaults and existing preferences, preserves unrelated values, surfaces real conflicts and uses actual dynamic-store owners. No publication or personal sync is part of this source pass. Apply later Compat-dependent refinements only against exact qualified capabilities.
