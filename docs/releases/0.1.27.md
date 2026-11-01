# Create Sky 0.1.27

Add You're in Grave Danger 2.0.13 and update Create Sky Compat to 0.12.1.
YiGD owns recoverable inventory, equipment and equipped backpack contents.
Recovery is owner-controlled, without random item loss, keys, costs, expiry or
teleportation. Recoverable XP follows the vanilla death-drop amount.

Graves on supported Sable decks move with their constructs. Void falls from a
verified deck prefer the original ship; loss uses bounded nearby fallback while
unloaded graves retain their saved recovery. Native owner claims, cold reload,
disassembly and backpack contents were checked. Update both sides together.

Radio and speaker ranges are 128 blocks, with existing volume and attenuation.
The optional client timing adapter joins the current song position after loading
and reconciles standby resumes. Initial internet loading can remain silent.
Two clients were checked with insertion roles swapped, range re-entry and online
playback. This does not promise sample-perfect synchronization.

Keep normal backpack item protections; only separate death placement is disabled.
Update backpack journal guidance and the Atlas's selected content/configuration.
Existing quest IDs, objectives and rewards remain unchanged.

No world regeneration, seed, terrain-generation or LOD-identity changes are needed.
Keep worlds, LODs and personal settings when updating. Partial support shapes,
arbitrary construct splitting and external claim systems need further coverage.

Previous release: [0.1.26](releases/0.1.26.md).
