# Create: Skyweave 0.22.2

Build and bootstrap with public empack 0.8.8-beta. Local exports now generate Visual Patches automatically through the build wrapper, matching release preparation. New dedicated-server installations receive a 12 GiB maximum heap through the supported, seed-owned `game/user_jvm_args.txt` template. Initial heap ergonomics and the default Java 21 G1 collector remain in effect. Existing operator JVM files are preserved during preparation, repair and updates; adjust them manually to change an installed server’s heap.

This packaging update retains the 0.22.1 mod selections, seven authored village profiles and public Compat 0.41.0/re:form 0.1.0 dependencies. Saved generation identity remains `islands_v1-skyarch-1.4-18`, with watersheds `island_watersheds_v7`. No world reset or terrain migration is required when updating a matching generation-18 installation.
