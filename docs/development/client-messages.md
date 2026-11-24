# Client messages and onboarding

Distinguish mod onboarding, update/support prompts, operational warnings, and gameplay feedback. They have separate owners and persistence. This inventory records authored settings and the inspected native dismissal mechanisms; the current selections below distinguish adopted settings from remaining proposals. A language entry alone does not establish that a message is active.

## Current messages and state

| Producer | Current setting or mechanism | Persistence and review |
| --- | --- | --- |
| Create 6.0.10 / Sable Beyond 0.5.0 | Main-menu and pause-menu config buttons hidden | Seeded local preferences; open Mods → Create or Sable Beyond → Config to edit settings or restore buttons. |
| Effortless Building 4.2 | Native server default `showWelcomeMessage = true`; first-join chat explains the radial-menu key through a native keybind component | World-owned `effortlessbuilding/server_config.json` controls it; `effortlessbuilding/welcome_messages.json` remembers player UUIDs. A new world can show it again. This is not a client dismissal flag. |
| Sodium 0.8.13 | Authored `notifications.has_seen_donation_prompt = false` and `has_cleared_donation_button = false` in `config/sodium-options.json` | The video settings screen can show its donation prompt after the native fingerprint is three days old. Showing it writes the first flag; hiding the donation button writes the second. The two actions are independent. The file is seeded, preserving normal player graphics and dismissal edits. |
| Euphoria Patcher 1.11.2 | Separate Sodium-integrated support prompt; inspected eligibility requires at least seven settings changes and three days after first opening its options | Native `.data.json` uses `clickedSupportPopup`; this is independent of Sodium's donation flags. No dedicated donation switch is present in the authored `settings.toml`. Do not distribute another user's history or assume the popup-logging setting is its switch. |
| Iris | `config/iris.properties`: `disableUpdateMessage=false` | Seeded client preference; update-message suppression is separate from proving that network update checks stop. |
| DH 3.3.3 updater | `client.advanced.autoUpdater.enableAutoUpdater=false`, `enableSilentUpdates=false` | The pack disables the native updater and retains silent updates off. Dependency updates remain with the qualified pack workflow. |
| Euphoria update/shader notices | `updates.doUpdateChecking="none"`, `display.doDisplayShaderInGameMessage=true`, `display.doPopUpLogging=true` | Seeded settings. The updater is disabled; shader-created messages, support prompts, and popup logging retain their existing behavior. |
| Dynamic Waters | `showWelcomeMessage=false` in its common config | The welcome is already disabled through its owning configuration. |
| Punchy! Moves | Authored `config/punchy_moves/tutorial_seen_v1` marker | Native 1.0.9 checks marker presence; the pack already skips the initial guide. The marker is seeded. |
| Inventory Profiles Next | Authored `ModSettings.first_run=false` | The initial setup state is already seeded as completed. Refill failure feedback and profile-change feedback are separate operational/gameplay controls. |
| Vanilla | Authored `options.txt`: `tutorialStep:none` | The introductory tutorial is skipped. This does not disable every toast, recipe, or advancement. |
| YACL | `config/yacl.json5`: `showColorPickerIndicator=true` | Native help disables the flashing indicator after first use. This seeded, contextual hint is separate from startup or donation prompts. |

The current mod language scan also finds ordinary menu introductions, Ponder help, support links, and advancement titles such as “Welcome to Create.” Those are not evidence of unsolicited startup messages and do not justify blanket suppression.

## Keep useful feedback

Keep NeoForge's `showLoadWarnings=true` and EMF's `showReloadErrorToast=true`: they identify broken installations and resources. Sodium Extra currently leaves the general toast categories enabled, including system, tutorial, recipe, and advancement toasts. Disabling that entire layer would hide unrelated feedback rather than solve individual prompts.

DH currently retains startup low-memory, mod-compatibility, replay, high-vanilla-distance, pooled-memory, and GC warnings. Its repeated update-queue chat warning and explicit-GC warning/log are already disabled. Review each against current runtime policy; do not suppress the remaining memory/compatibility warnings merely to reduce chat. Generation progress also has an instructional-message duration setting; that is progress presentation, not a remembered dismissal.

Analog Audio and AnalogLib retain their Lavaplayer/audio-dependency welcome screens. These are conditional dependency/consent workflows, so inspect actual installed capability before hiding them. Do not seed download consent or claim an unavailable audio backend works. Likewise, keep useful recording, item-refill failure, quest completion, and ordinary action feedback; those have consequences beyond mod onboarding.

## Proposed policy

1. Suppress modal donation/support prompts for the curated pack while retaining accessible author-credit/support links. For Sodium, setting only `has_seen_donation_prompt=true` in fresh defaults would skip the modal while leaving the donation button available. Preserve the file's seed ownership; do not manage the entire graphics file to enforce one flag.
2. Review Euphoria's separate support prompt independently. Its user-history file is not a suitable shared pack seed. Prefer a native dedicated switch if available in a future update, or a narrowly optional adapter if this remains worth changing. Do not blanket-disable logging or shader warnings as a shortcut.
3. DH and Euphoria updater checks are disabled. Iris update messages remain unchanged. Keep mod/version compatibility and resource/load failures visible; updater suppression does not imply global message suppression.
4. Keep short, accurate first-use controls where they teach something otherwise hard to discover. Effortless's keybind-aware welcome is useful for editors, but repeating it across newly created test worlds can be distracting. A pack-wide default would need its actual server/world configuration owner; adding an invented client config path would not work. World-specific operator configuration can already disable it. Pack-wide suppression remains deferred; no new adapter or saved-world edit is selected.
5. Retain existing Vanilla/IPN/Moves intro suppression and contextual help such as YACL's color hint. A broader onboarding redesign is separate work.

## Ownership and test resets

[Configuration authoring](authoring.md) and `empack.bindings.yml` own installation policy. Keep native dismissal, graphics, and history files seeded or installation-local as appropriate. Do not ship `sodium-fingerprint.json`, another user's Euphoria history, or world-specific welcome ledgers. Native history and a pack-wide feature default are different objects.

An explicitly authorized DEV default reset can restore undismissed states in seeded files. Explain that effect and follow the owner’s backup/reset instructions; do not diagnose the resulting repeated prompt as failed native persistence without checking what was reset. Ordinary updates preserve existing seeds. Remaining proposals require their own selection. The adopted updater switches and existing Moves seen marker do not change donation prompts, operational warnings, or other onboarding choices.
