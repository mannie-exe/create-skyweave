# Create: Skyweave 0.18.0

Add installed pack identity to the main-menu footer with Skyweave: Compatibility Patches 0.37.0. Minecraft remains 1.21.1; NeoForge remains 21.1.265.

- Preserve the Minecraft, NeoForge/mod-count, ModernFix and other existing footer lines. Add `Create: Skyweave <pack version> + Compat <installed version>` through the native branding cache.
- Derive release identity from `empack.yml` during resource preparation. Normal local and branch builds display `DEV`; an explicit, validated release build embeds the manifest version. Resource Patches keeps its own mod version and installed filename.
- Keep the presentation adaptation client-only and default-on. Missing or invalid pack metadata falls back to the installed Compatibility Patches version.
- Verify the Resource Patches identity inside every selected export before publication. Use the repository pack builder when preparing development or release exports.
- Keep footer text clear of menu buttons in small windows by closing excess row gaps. Preserve existing button sizes, actions, logo and copyright.
- Use the canonical `Create: Skyweave` Prism title. The portable pack/export name is `Create - Skyweave`; machine identities stay unchanged.

Generation identity remains `islands_v1-skyarch-1.4-17`, with watersheds `island_watersheds_v7`. This presentation update does not require another world reset. Other dependency selections, gameplay settings, distances and JVM policies are unchanged.
