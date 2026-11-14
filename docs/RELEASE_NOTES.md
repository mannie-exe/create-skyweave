# Create: Skyweave 0.15.0

Update Skyweave: Compatibility Patches to 0.34.0 for the completed configuration, Wayfinder and terrain follow-up. Minecraft remains 1.21.1, NeoForge remains 21.1.265 and the content-mod selection is unchanged.

- Use typed settings, measured layouts, native text/list/choice controls and staged edits, with complete-file validation, external-edit conflicts and explicit save/application receipts. Local client copies cannot administer a remote server.
- Apply qualified client presentation preferences live. Reload Wayfinder and structure-search operational policy on the owning server without changing saved generation rules.
- Target existing coarse DH terrain through Wayfinder's bounded native destination refinement. Operator diagnostics are live client preferences, private and off by default.
- Preserve island/structure-search ownership through same-connection respawn and distinguish partial zero-result searches from verified absence.
- Keep fractured HOLLOW and special Deep Dark chambers exposed at cellular cuts, and handle qualified local watershed banks without unsupported water fill.
- Remove repeated preset-ID parsing. Three matched native predicate windows reduce allocation from 136,000,072 bytes to 72 bytes per million calls while preserving their terrain outputs. This is not a whole-game speedup claim.
- Deliver managed pack-rule configuration updates while preserving explicit player/operator seed exceptions and edited-file conflicts. Native save/exit checks and the configuration register qualify those ownership choices.

The completed terrain corrections change saved generation identity and require a fresh marked world. Installing the release does not delete a world or migrate an old identity. Retain the previous binary/configuration for an old world, or create a new one; do not edit the marker to bypass the guard.

Before starting an existing installation, remove retired `debugMessages` and `hideHotkeyPermissionMessage` fields from `config/skyweave/skyweave_compat-wayfinder.json`, preserving access and work settings. Local operator visibility now belongs in `config/skyweave/skyweave_compat-wayfinder-client.toml`. Update client and server together.

Keep the existing 8 GiB/512 MiB Java 21 generational-ZGC client policy and native G1 server baseline. Bounded current-build checks qualify loaded terrain, shader activation and save/reopen; startup resource allocation stalls and one explicit server full GC remain observed limitations. No generic JVM flag bundle is added. See [launch policy](development/performance.md#heap-and-collector-decisions) and [Compat verification](https://github.com/mannie-exe/skyweave-compat/blob/v0.34.0/docs/development/verification.md) for exact scopes and limits.
