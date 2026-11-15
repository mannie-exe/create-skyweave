# Create: Skyweave 0.16.0

Update Skyweave: Compatibility Patches to 0.35.0, remove Macaw's Bridges and Macaw's Lights and Lamps, and move reference distributions to empack 0.8.5-beta. Minecraft remains 1.21.1 and NeoForge remains 21.1.265.

- Preserve floor embeddings, repair native scaffold/stair bearing and isolate terrain-overlay palettes in village support.
- Keep routed river junctions and outlets connected while retaining void falls and refusing uphill receivers. Existing HOLLOW water seals remain protected.
- Remove both Macaw mods, their visual recipes, generated resources, Sable weight entries, Debug World cases and active Atlas review subjects. Other installed Macaw mods remain included.
- Include a Java bootstrap in Prism/server references. It acquires the exact verified empack engine, prepares content and supervises launch without requiring a global empack or Python installation. Keep its generated tool files and invocation records together.
- Use native Unix terminal handling instead of the previous Python wrapper. Generated full-pack server checks cover console input, clean stop, Ctrl-C and direct SIGINT.
- Update authoring, shader-lab, CI and Atlas readers to current empack formats without changing the remaining dependency selections.

The terrain fixes advance saved generation identity and require a fresh marked world with matching client/server builds. Installation does not reset a world automatically. Do not edit saved generation markers to bypass the guard. For older reference installations, reimport the current archive rather than combining old launcher commands or release schemas with the new content; retain reviewed personal settings and saves separately.

The client keeps its Java 21 generational-ZGC policy, 8 GiB maximum heap and 512 MiB initial heap. Server view/simulation distances remain 16/12. The native G1 server policy and explicit installation-local preferences remain unchanged. See [build maintenance](development/build.md) and [Compat verification](https://github.com/mannie-exe/skyweave-compat/blob/v0.35.0/docs/development/verification.md) for qualification boundaries.
