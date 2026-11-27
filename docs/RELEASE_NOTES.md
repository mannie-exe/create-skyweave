# Create: Skyweave 0.24.2

## Animations and held items

- Reduce excessive backward bending during upward Better Combat attacks while preserving the composed arm direction, native combat timing, input, and damage.
- Preserve underscores in Moves overlay bone filters so authored arm and item animations reach their intended bones.
- Restore Exposure’s native first-person aged-photograph renderer, Cookery’s lifted ham model, and Tavern’s shaker renderer and progress bar. Their broader third-person pose conflicts remain deferred.
- Correct vanilla lantern and soul-lantern grip placement in both hands and views. Preserve original arm animation and native item physics; the matching resource bundle is admitted only with its supported Compat feature.
- Preserve equipped Reliable Gliders beside Moves’ third-person items and Punchy’s first-person hands.

## Shaders and constructs

- Rebuild construct material annotations when changing shader packs, preventing stale material IDs.
- Apply the camera rotation once to shader-rendered single-block constructs, preserving their body transform and translucent pass.

## Dependencies and updating

- Update Skyweave: Compatibility Patches from 0.44.0 to public 0.45.0. Retain public re:form 0.4.0 and Lootr: Styled 0.2.0.
- Update clients and the server together while stopped. Preserve worlds, generation settings, LODs, replays, and player/operator preferences; no world reset or settings reset is required.
- Keep explicit Compat opt-outs. Disabling the lantern feature restores upstream resources after restart. The three native first-person handoffs are exact-item resource rules, with no blanket item exclusions.

## Verification

- Native OFF/ON controls cover upward attack poses, actual input through one server hit and release, and original arm/item overlay consumers.
- Lantern controls cover both hands and views, removal and re-equipping, reload, Fluid & Foolish selected and unselected, and explicit feature opt-out. Native physics remains active.
- The final generated-resource check passes all 36 photo cases, including all 12 aged-photo first-person cases, native viewers, stacks, cycling, and reload. Separate shaker and ham controls preserve native storage, results, and ordinary-item behavior.
- These are bounded compatibility checks. Generic native-use poses, Exposure selfie composition, third-person shaker/carry conflicts, and the wider animation audit remain deferred. No performance, complete shader, or multiplayer qualification is claimed.
