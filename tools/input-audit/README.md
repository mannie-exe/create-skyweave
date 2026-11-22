# Native input collector

`KeybindAudit.java` is a disposable NeoForge 1.21.1 client probe. It reads registered mappings after the title screen and resource reload settle, reads loaded IPN/libIPN and EMI bindings through their delivered interfaces, writes `input-capture.json`, and exits. It creates no world and exercises no gameplay or keyboard dispatch. Keep it outside installable pack outputs.

Compile both Java files in this directory with Java 21 against the matching named Minecraft/NeoForge classpath plus the exact staged pack JARs. The collector intentionally requires the pack's IPN/libIPN and EMI interfaces; it is not an optional production adapter. Review those calls on dependency updates. The JSON conversion call for Kotlin serialization is reflective so compilation does not require extracting a second copy of its bundled runtime.

Package the compiled class under this disposable metadata:

```toml
modLoader="javafml"
loaderVersion="[4,)"
license="MIT"
[[mods]]
modId="keybind_audit"
version="1"
displayName="Disposable input audit"
```

Use a new owned directory materialized from the exact Prism reference recipe and its SHA-256 admission. Copy all selected configuration, options, resources and packaged gameplay JARs. Add the probe only to that fixture, create its required `.input-audit` marker, and use a matching prepared client bootstrap. The recorded audit used the sibling Compat project's existing `tools/client_bootstrap.py` with gameplay classes/resources excluded, rather than adding another production launcher. Retain the recipe, bootstrap qualification, launch artifact digests and collector result together. This does not qualify a production Prism launch.

Acquire re:desktop immediately before the visible client launch and release it after the process exits. Use one bounded 4 GiB title-only client, shaders off, no account/server connection, and a verified clean Connector input when the named development bootstrap needs one. Do not point the game directory at a personal instance. A native failure or incomplete custom capture must not be used to refresh the index.

Record an artifact map whose keys are staged JAR basenames and whose values are their SHA-256 digests. Then run:

```sh
python3 scripts/audit-keybinds.py --capture /path/to/input-capture.json --artifacts /path/to/artifacts.json
python3 scripts/audit-keybinds.py --check
python3 -m unittest discover -s tests -p test_keybind_audit.py
```

The first command writes the source-bound [snapshot](../../docs/development/input-bindings.json) and [inventory](../../docs/development/keybind-inventory.md). The check is read-only and fails when listed authored inputs change or the generated inventory is edited. It also rejects known native/OS shortcut reservations in authored native mappings; the [platform boundaries](../../docs/development/input-remap.md#platform-shortcut-boundaries) distinguish those from contextual application conventions. This bounded guard does not inspect arbitrary custom dispatchers or qualify physical event delivery on every OS. The sanitized registration snapshot is tracked alongside the inventory; keep personal/runtime captures private. Include Punchy’s native trigger-preference seed because its deferred registration restores that store after ordinary options loading. It does not discover every future custom dispatcher or prove action priority. Review the maintained [input ownership contract](../../docs/development/keybinds.md), raw/contextual interaction coverage, and relevant native action tests before accepting a control change.

## Post-fix mapping consumer check

`PostFixRemapProbe` runs only when the collector's marked disposable client also has `post-fix-input-fixture.json`, `modifier-review-fixture.json`, a ready integrated player, a focused native window, and an explicit `post-fix-run` request file. This mode replaces title collection; use a separate title boot for the registration snapshot. Stage the exact sibling Compat client-probe JAR and enable its configuration/modifier fixture flags. Its existing configuration controller creates a flat, Creative, Peaceful world with mob spawning off; do not use an installed save.

The probe preserves the actual loaded bindings instead of remapping them to convenient test keys. It queries native U/Mod+U/Shift+U ownership, invokes real keyboard callbacks for orbit/custom-camera/editor actions and compares the editor result with the original native entry and namespaced route, observes the original Effortless history producer, and checks that plain Z/Y and chat do not emit history packets. The existing test-only modifier-polling and packet witnesses provide synthetic input and local observations. Packet emission is not proof that a real build was undone; the upstream fixture owns that separate control. Nothing is injected into physical OS input, and no new production adapter is installed.

The exact private Moves/Punchy observation fields and sibling probe methods are test dependencies, not public compatibility APIs. Reinspect them when Moves or the sibling probe changes; a missing target must fail the check. Retain `post-fix-proof.json`, loaded options/artifact identities, console tail and commands; stop the owned client and release desktop promptly. Neither fixture marker nor probe JAR belongs in an exported modpack.
