# Create: Skyweave 0.17.0

Update Skyweave: Compatibility Patches to 0.36.0 and preserve village soil and foundations on floating islands. Minecraft remains 1.21.1; NeoForge remains 21.1.265.

- Bound Dynamic Waters post-carver riverbank repair to the correct island column. Dry banks use their local elevation, while connected outlets, falling water, retained shells and separate lower islands remain intact.
- Keep swamp village ambient soil consistent with the original island palette while preserving authored roads, paving, farms and wet walkways. Generated Resource Patches lists use Compat's conditional processor and require 0.36.0 or newer.
- Omit only a safely detachable oasis that cuts beneath an inhabited building. Keep valid oases available and preserve traced rejection/fallback for ambiguous layouts.
- Protect admitted village foundations from conflicting native mangrove roots and recognize bed-bearing dwellings outside conventional house folders. Existing farm roles and family encounter allowances remain unchanged.
- Extend native verification with effective schedules, pool orders, connectors, templates, processors and explicit unsupported routes.

The terrain changes advance saved generation identity to `islands_v1-skyarch-1.4-17` and watersheds to `island_watersheds_v7`. Use a fresh marked world or retain the original artifacts/settings for an existing save. Existing curtains and structures do not repair themselves; installation does not delete worlds or derived map/LOD data automatically. Never edit saved markers to bypass the guard.

Client view/simulation defaults remain 12/10 and server defaults remain 16/12. Heap/collector policies and the remaining dependency selections are unchanged. Native contact, fluid, optional-loading and saved-state checks are bounded; they do not certify every village's appearance or complete navigation. See [Compat verification](https://github.com/mannie-exe/skyweave-compat/blob/v0.36.0/docs/development/verification.md).
