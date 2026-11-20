# Create: Skyweave 0.22.1

Include Radars 5.1.1's native `damageableBlocksOnly = true` default in the managed server configuration template. Its runtime writer already adds this field; matching that output prevents a recurring managed-file conflict when preparing the client again. Other configured values remain equal.

This corrects the configuration delivered with [0.22.0](https://github.com/mannie-exe/create-skyweave/releases/tag/v0.22.0), retaining its seven authored village profiles and public Compat 0.41.0/re:form 0.1.0 dependencies. Saved generation identity remains `islands_v1-skyarch-1.4-18`, with watersheds `island_watersheds_v7`. Existing generation-17 worlds still require their original release or a fresh matching world; this correction introduces no further generation change.
