# Input ownership and controls

Use this index when adding a mod, changing an interaction, or updating controls. It separates actual configured bindings from the conditions under which a consumer may use them. Player instructions remain in [getting started](../players/getting-started.md#controls), [inventory](../players/inventory.md), [movement and combat](../players/movement-combat.md), [journal](../players/journal.md), and [filming](../players/filming.md).

The [registered inventory](keybind-inventory.md) lists every mapping in the reviewed fresh client, including inherited and resource-loaded bindings. Its [machine snapshot](input-bindings.json) contains exact configuration/artifact identities, native conflict pairs, and IPN/EMI settings. These are observed reference data, not a second settings authority. `empack.yml`, `empack.lock`, authored config files, and seeded installation policy retain their current owners.

## Evidence and limits

The audit captures the exact packaged modpack after resource reload in a disposable native client on Minecraft 1.21.1 / NeoForge 21.1.265, using the pinned ModDev bootstrap with project classes/resources excluded. It reads registered mappings and loaded custom configuration; it does not open a world or exercise competing action handlers. Source/bytecode inspection establishes additional eligibility and modifier conditions below. Treat an observed shared key, a source-confirmed competing consumer, and a reproduced unwanted action as different findings.

The Controls menu does not enumerate every input system. IPN/libIPN uses its own chord/state dispatcher; EMI has its own alternatives and registered JEI bridge mappings; several tools poll keys or interpret modifiers and scrolling. Conversely, native conflict counts include deliberately shared mouse buttons and disjoint screens. `UNIVERSAL` in registration does not prove an action runs in chat. An unassigned mapping is not necessarily disabled: Skybound falls back to existing semantic actions.

The independent IPN text-input protection work owns reproduction and its optional Compat repair. Its reviewed exact 2.2.5/libIPN 6.6.3 paths include an ANY-context R+Y reload, a world/player-only admission check, direct-child focus checks for some inventory input, and separate state bookkeeping. The owner's original gesture is not a reproduced witness here. Keep the IPN defaults/refill design separate, and share ownership decisions before changing its config.

## Interaction index

The table records cross-mod context and known constraints. Exact IDs, alternative/unassigned keys, constructor defaults, and loaded IPN chord settings are in the generated inventory. Native item/block interactions reuse the ordinary Attack/Use/Sneak controls; this table groups their contracts instead of attempting a separate binding for every block.

| Interaction family | Authored binding or gesture | Eligible owner and constraints |
| --- | --- | --- |
| Ordinary movement, inventory, chat and hotbar | WASD, Space, Shift, Control, E, T, 1–9; native alternatives in inventory | Preserve rebound actions. Character input and gameplay key events are different paths. |
| Kaleidoscope contextual actions | Existing Use/Sneak; Cookery Flatulence effect observes the rebound crouch key | Cookery consumes a crouch click and adds upward motion only during its effect, in game with no screen. Tavern also uses Sneak+Use for bottle placement. These are gameplay observers, not new registered keymaps; the title capture does not qualify competing action order or moving-station reach. |
| Attack and Use | Left/right mouse | Native item/block/entity dispatch and Better Combat. A consumed/cancelled interaction, raw key poll, and a server-accepted action are different admission boundaries. |
| Better Combat | Attack; V feint; mining-mode shortcut unassigned | Weapon/action state owns attack timing. First-person and third-person presentation do not arbitrate unrelated input. |
| Omnidirectional Movement / Better Third Person | Existing directional and sprint inputs; camera motion | No separate traversal action keys in the native capture. Inspect movement/camera ownership when adding movement features. |
| Skybound base hook | Use to fire/retract, Jump to detach, Crouch plus Forward/Back to climb/lower | Main/offhand hook and active controller required. Unassigned hook mappings fall back to the player's current actions. Airborne input is redirected while grappling. |
| Skybound upgrades | Attack fallback for ender launch and rocket; Crouch fallback for motor/swing controls | Upgrade-specific. Offhand upgraded hook plus main-hand weapon can have competing Attack consumers; the base-hook check does not qualify these combinations. Separate native bindings are available, but setting them unassigned restores fallback rather than disabling an ability. |
| Reliable Gliders / Better Climbing | Native item use, movement, jump, crouch; see unassigned glider mapping | Airborne, held/equipped and collision conditions matter. These are not interchangeable with the grappling controller. |
| Punchy inspection | I; legacy resource shortcuts explicitly unassigned | Retain general inspection and deliberate opt-in bindings. Unique clip access/persistence remains a review point. |
| Moves camera | U orbit, Mod+U custom camera, Shift+U editor | Qualified optional Compat admission preserves native contexts and modified/plain priority. Give one camera ownership per shot; camera-controller handoff remains separate. |
| Moves emotes | J menu; four direct emotes unassigned | Menu access remains. Inspect resource registration, reset/reload and custom-store persistence; no new modifier bank before repair. |
| Punchy settings | F9 | Settings/menu action. Editing or binding capture owns its own keys. |
| Accessories and backpack | H and B | Open their respective inventory screens. `Open Backpack` in authored options is an absent legacy ID, not a second registered B action. |
| Backpack tool cycle | = | Native equipped/tool-slot state and queued click consumer. Mod+= belongs to CMDCam; qualify native precedence and screen transitions. |
| Spyglass Improvements / Radar binoculars | − / Mod+V; Radar fire uses Attack | Held optical equipment and target state remain authoritative; test both hands and competing action admission. |
| Effortless Building | Left Alt radial; F4 modifiers; Mod+Z/Y undo/redo | History uses explicit native CONTROL modifiers. The qualified radial repair retains fresh hold/release ownership across native screen resets; unmodified history bindings retain the upstream physical-Control fallback. |
| Create tools / Copycats | Right Alt alternate/toolbox/schematic/fill group; native Shift/Control modifiers | Separate from Left Alt building. Preserve native tool/target ordering; actual offhand combinations and AltGr/layout qualification remain required. |
| Simulated assembly tools | Period rotate mode; native tool Use and scroll | Held-tool and operation-state admission differ from the circuit editor. Tab remains the player-list control. |
| Ponder | Hold W over a supported item; native scene navigation | Tooltip/item support and the opened scene determine ownership. W also moves the player; InvMove's Ponder exclusions remain authoritative. |
| Power Grid | Control alternate wire; Period component rotation | Held wire/component state. Preserve native targeted placement and modifier handling. |
| Power Grid circuit editor | T place trace, D delete area, S pick component, X layer switch | Editor-local actions; these are candidates for safe reuse of chat/movement/creative-toolbar keys, subject to its actual editor focus checks. |
| Aeroworks joystick / climbable ropes | Shift joystick free-camera / Mod+Semicolon rope camera lock | Active joystick/rope state required. Inventory sneaking and dismount policy remain separate. |
| Create Big Cannons | Comma pitch mode, Attack for a controlled cannon | Actual controlled/mounted cannon and server permissions are required. Native Attack sharing alone is not a collision proof. |
| Analog Audio | Mod+F4 input-mode switch; native device Use | Native queued key and device/permission/menu guards retain authority; do not confuse settings visibility with action admission. |
| Carry On | Shift/Use with eligible empty hands and target | The carried/eligible-target action competes with native sneak-use. Existing machinery/grave exclusions and actual pickup guards retain authority. |
| Manual inventory transfers | Native Shift-click; Mouse Tweaks left/right drag and wheel | Mouse Tweaks owns scrolling/drag gestures. IPN item scrolling and swipe movement are disabled in the shipped preferences. |
| IPN sorting and transfers | Middle-click main sort, toolbar buttons; other chords in inventory | libIPN context/settings, target container, slot and actual text focus apply. Some registered settings describe disabled features; configuration presence does not activate them. |
| IPN locking / refill controls | Left Alt slot click; Ctrl+left-click / Ctrl+R refill toggle; physical Right Control temporary tool bypass | Preserve libIPN custom contexts/settings, focused input and source/destination slot rules. Tool bypass no longer shares Left Alt building. |
| IPN profiles / configuration | R-prefixed chords; full effective list in inventory | Some require no screen/player inventory, while config reload uses ANY context. Overlapping held letters can form chords while typing; do not mistake them for a sequential command interface. |
| Recipe browser | EMI/JEI R recipes, U uses, A favorite, Ctrl+F search, Ctrl+O visibility; contextual mouse alternatives | Hover/search/sidebar/recipe state determines owner. Their shared bridge registrations are not proof of two simultaneous actions. Preserve focused search and explicit mouse targeting. |
| InvMove | Ordinary movement in admitted inventories | Authored focused-text protection; unknown screens default off. Ponder, books, advancements and the journal remain excluded. Creative held-sneak preservation differs from a fresh Shift-click. |
| FTB Quests / Questlog | Grave accent opens quests; Questlog opening key unassigned | Questlog inventory button remains. FTB's additional search/navigation/editor bindings are screen-local; editor operations need appropriate permissions. Grave accent can be a poor choice on some layouts. |
| FTB Teams | Mod+T / native menus | Preserve team permissions and GUI-local ownership; avoid running gameplay shortcuts in text/editors. |
| Ping Wheel | G; settings shortcut unassigned | Keyboard-first pointing communication; mouse-side-button rebinding remains optional. Native target/context rules apply. |
| Wayfinder | F12 | Operator/editor action with unchanged permission, sight and target/load rules. Existing saved G is not overwritten by a seed update. |
| Iris / Outline Effects | K toggle, O shader selection, F8 reload / Mod+O Outline settings | Qualified native modifier dispatch must retain Iris plain O, Outline no-screen action, and EMI visibility in its GUI context. |
| Jade / tooltip previews | Backslash config; Mod+Backslash overlay; Mod+[ fluid; Mod+] narrate; Shift+[/] recipes/uses | No keypad required. Retain native tooltip/target conditions, focused-input ownership and normal Shift details/preview. |
| Interactive Foliage / Artifacts / Exposure | Foliage opt-in settings; Helium Sprint fallback; Shift+H shrinking and Mod+P/K/L/N equipment toggles; Mod+E Exposure controls | Native equipment, item, target, mode and server requirements retain authority; full registered entries remain in the ledger. |
| TreeChop | N settings overlay; other mappings unassigned | Tool/block and sneak-behavior policy are distinct from the overlay key. |
| Flashback / CMDCam | Four Mod+navigation marker keys; Mod+arrows/± live camera; Mod+Enter point, F10 play, Mod+Backspace clear | Use actual pause-menu recording and native replay editor. Live and replay cameras have separate ownership; hardware/OS and focus require qualification. |
| Fzzy configuration UI | Page Up, Page Down and Home in its native keybind config | Library-local GUI navigation, not universal gameplay actions. Preserve focused widgets, traversal and rebinding. |
| Shared GUI interactions | Escape/back, Tab/Shift+Tab, Enter, arrows, scroll, clipboard shortcuts, text editing | Current screen, focused descendant, modal/capture owner and platform text handling decide eligibility. Never treat a global duplicate list as permission to consume these events. |

## Baseline findings and disposition

These describe the original audit. The complete ledger records subsequent authored remedies; source changes do not establish all runtime outcomes.

| Finding | Evidence and disposition |
| --- | --- |
| H/J/K/L quick emotes share existing actions | Native registration plus Moves no-screen consumer inspection. Strong candidate conflicts; dispatch outcomes were not exercised. Propose unassigning the four quick emotes and retaining deliberate menu selection. |
| G/J resource-loaded sword inspections share Wayfinder/emote menu | Native registrations and trigger-state inspection. Item-qualified, not universally active. Propose unassigning these legacy shortcuts, retaining I and reviewing any unique clip access before adoption. |
| O opens two settings systems | Native registration and Outline's delivered consumer. Propose leaving Iris on O and unassigning Outline's shortcut; retain Mods configuration. |
| Z appears three times | Native spyglass/backpack/building mappings; building handler requires Control. Do not report a plain-Z triple action. Qualify Ctrl+Z against the other consumers before changing it. |
| Many Left Alt owners | Mixed world, held-tool, inventory and camera contexts. Keep the owner's Effortless Building radial preference; investigate native contextual admission before moving every modifier. A single menu/key change is not a full interaction fix. |
| IPN action while typing | Existing exact source/bytecode findings and owner report. Separate active Compat intent owns native reproduction and repair. Do not hide the bug by removing all shortcuts. |
| Skybound Attack fallbacks with weapon/offhand upgrades | Exact base-mod input design and current Better Combat ownership. Source-level conflict candidate; native upgraded-hook actions remain unqualified. |
| `Open Backpack` option | Absent from current registration. Candidate cleanup only; the valid `key.travelersbackpack.inventory` B binding remains. |
| Numeric keypad, Mouse 5 and punctuation dependencies | Present in native/configured mappings. Real accessibility/layout limitation; ergonomic alternatives are part of the proposed scheme. |
| Native duplicate counts | Includes shared mouse buttons, JEI bridge entries and screen-local FTB actions. Retain the full evidence; do not equate the count with defects or clear it through blanket unbinding. |

## Authored remap and review ledger

The [complete remap](input-remap.md) records the post-fix decisions for all 224 native mappings, 61 IPN definitions, 25 EMI definitions, and configured Fzzy screen shortcuts. Core controls stay familiar; filming/editing receive a usable key group. Existing seeded player choices stay unchanged until deliberate reconciliation.

The source map gives Moves only plain keys, separates Left Alt building from Right Alt Create tools, moves Ping/Wayfinder to G/F12, relocates spyglass/backpack cycling off undo keys, and supplies non-keypad Jade controls. Native-state consumers use their own modifier registration; actual action/lifecycle qualification remains separate. The ledger states every retained, moved, optional and fallback action.

The selected public Compat repair owns Moves event/observer, Effortless radial/undo and Power Grid dispatch fixes. This map uses only its qualified capabilities; startup flags and exact runtime artifacts belong to the source-bound audit basis. Saved DEV CMDCam G/H/J controls are a separate seeded-preference conflict, not a Moves defect or proof of an automatic world-entry overwrite.

## Keyboard layouts and platforms

Use native KeyMappings and layout-aware display text for supported controls. NeoForge recommends portable GLFW key tokens over platform-specific scancodes. GLFW distinguishes key events from text characters, supports layout-dependent printable key names, and exposes platform-specific scancodes; none of these alone supplies ergonomic translation of a whole modpack. [NeoForge 1.21.1 key mappings](https://docs.neoforged.net/docs/1.21.1/misc/keymappings/), [GLFW keyboard input](https://www.glfw.org/docs/latest/input_guide.html#input_keyboard).

Keep the baseline's familiar positions/semantics and let users rebind through Controls. For future alternate-layout presets, explicitly review AZERTY, QWERTZ and Dvorak movement positions plus nearby inventory, inspect, tool, quest and communication keys. Translate action intent, not just the character printed in a tutorial. Keep current/alternative profiles complete across native and custom binding systems, and never import raw numeric scancodes from another operating system. Display actual bindings in help where supported; static letter hints are a documented fallback. Effortless Building's inspected radial helper passes the bound key's numeric value to keyboard polling without dispatching on its input type; mouse/scancode assignments need separate qualification rather than assuming everything accepted by Controls is honored by that consumer.

macOS Control/Command/Option, AltGr, dead keys, IME composition, compact keyboards, function/media layers, and two-button mice need actual platform checks. In particular, Effortless Building's raw Control test is not a promise of Command equivalence. Avoid mass assigning Ctrl/Alt chords until each consumer honors them. No alternate layout, Windows/Linux input path, IME behavior, Amecs installation, or automatic profile-selection facility was qualified by this audit. Controlling improves discovery and conflict display; it does not govern raw polls, custom chord dispatch, or text-focus policy.

## Updating the index

1. Capture a fresh disposable client from the current exact packaged recipe, after resource reload and dynamic binding registration. Collect `Options.keyMappings`, constructor defaults, native modifiers/conflict contexts, loaded IPN main/alternative bindings and settings, and EMI alternatives. The collector is in `tools/input-audit/KeybindAudit.java`. It reads configuration at the title screen and exits; it does not qualify action dispatch.
2. Record launch artifact SHA-256 values, excluding the disposable probe from pack content. Preserve the distinction between ModDev bootstrap qualification and a production launcher test. Compare captured settings with authored files; never use a personal options file as an unlabelled default snapshot.
3. Regenerate with `python3 scripts/audit-keybinds.py --capture PATH --artifacts PATH`. The generator refuses incomplete captures or keys that disagree with authored seeded values. Review the generated diff and the custom/interaction table together. Runtime callbacks and focused-text behavior still require native action tests.
4. Run `python3 scripts/audit-keybinds.py --check` and the focused audit tests. The check reports source changes instead of blessing stale registrations. Recheck dependency/config inputs, resource-defined shortcuts, aliases, native fallback bindings and actual handler contexts. It is a freshness/consistency check, not an input correctness proof.
5. For an accepted default change, update its existing authoring rationale and seeded policy, player instructions, and relevant snapshot together. Test fresh and existing edited preferences, rebind/reset, reload/reconnect, opening/closing text inputs while keys are held, and release cleanup. Runtime changes belong to optional Compat adapters, with their own side/version/lifetime and removal checks. Do not add a second settings or global input framework without a demonstrated consumer requirement.
