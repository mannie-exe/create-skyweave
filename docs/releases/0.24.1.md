# Create: Skyweave 0.24.1

## Gameplay and processing

- Retire Cookery's animal millstone from normal survival crafting and disable all 85 of its original milling recipes. Ore, dye, and general-resource processing retain Create's existing progression.
- Add Create milling of one seed-tag item into one Cookery oil item and one rice panicle into three rice. Both recipes use 150 processing work and Create's native rotational processing.
- Preserve Create's wheat-to-flour outputs, chances, and processing time, along with the existing flour/dough integrations and other Create milling and crushing recipes.
- Remove the retired station's recipe unlock and animal-mill advancement. Keep Cookery's dough-stretching advancement available beneath its root.

## Compatibility and update instructions

- This is a resource-only change. Create 6.0.10, Cookery 1.6.0, Skyweave: Compatibility Patches 0.44.0, re:form 0.4.0, and Lootr: Styled 0.2.0 remain pinned; no runtime adapter or config toggle is added.
- Existing or creative/command-obtained Cookery millstones remain registered and can still use Cookery's native Create-recipe fallback. No placed-machine removal or saved-item migration is performed.
- Update the client and server together while stopped. Preserve worlds, generation settings, LODs, replays, and player/operator preferences; no world reset is required.

## Verification

- Native before/after recipe-manager checks preserve existing Create milling IDs and exact wheat yields while adding only the two culinary routes. A registered Create millstone consumes the intended inputs and produces the expected oil/rice quantities; unpowered and invalid-input controls pass.
- Native fixtures also check retired crafting/discovery, retained dough advancement and flour/dough consumers, plus Create-absent, Cookery-absent, and both-absent resource admission. These are bounded dedicated culinary fixtures, not a new whole-pack graphical or moving-machinery qualification.
