# Animation audit sources

These Java sources support isolated client fixtures. They are excluded from pack exports and are not a normal gameplay mod. Never install the observer archive in a personal instance or a server.

`AnimationAudit` dispatches only the selected fixture marker. Registry and resource capture, pose playback, original input, and native renderer observations have separate scopes. A successful registry capture does not qualify an action or a rendered attachment. Native input scenes additionally verify the original server effect and release behavior.

Retain the exact compiled observer, selected Mixin roster, source hashes, provider archives, marker, resource order, feature flags, native result, and process exit with each private receipt. Different rosters intentionally expose different consumer boundaries; combining every observer can introduce competing hooks or change what is being measured. The maintained [animation guide](../../docs/development/animation-compatibility.md) records findings and limitations.

Some sources retain earlier repair experiments. Their explicit private write flags must stay off when verifying a production Compat repair. Observe the production return and actual native consumer instead of applying the same correction twice. Keep failed assumptions and unchanged controls with their original evidence.

Native graphical runs require the current desktop grant. Disable Dynamic FPS through its native configuration only in timing-sensitive fixtures, verify the effective state, preserve the selected resource order, and release desktop access when the owned client and wrapper terminate. Fixture settings are not distributed player defaults.
