package design.inherent.skyweave.authoring;

import com.google.gson.*;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;
import net.minecraft.client.Minecraft;
import net.minecraft.client.Screenshot;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.core.*;
import net.minecraft.core.registries.*;
import net.minecraft.nbt.*;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.util.RandomSource;
import net.minecraft.world.Difficulty;
import net.minecraft.world.level.*;
import net.minecraft.world.level.block.*;
import net.minecraft.world.level.block.state.*;
import net.minecraft.world.level.levelgen.WorldOptions;
import net.minecraft.world.level.levelgen.Heightmap;
import net.minecraft.world.level.levelgen.structure.templatesystem.*;
import net.minecraft.world.level.levelgen.structure.pools.StructurePoolElement;
import net.minecraft.resources.RegistryOps;
import com.mojang.serialization.JsonOps;
import net.neoforged.fml.common.Mod;
import net.neoforged.fml.loading.FMLPaths;
import net.neoforged.neoforge.client.event.ClientTickEvent;
import net.neoforged.neoforge.common.NeoForge;

/** Native consumer of exact baked templates. Deliberately has no Mighty dependency. */
@Mod("skyweave_building_probe")
public final class TemplatePlacementProbe {
    private final Path root = FMLPaths.GAMEDIR.get().toAbsolutePath().normalize();
    private final JsonObject report = new JsonObject();
    private final JsonArray placements = new JsonArray();
    private boolean opened, requested, done;
    private int ticks, settle, sceneTicks;
    private volatile boolean ready;
    private volatile Throwable failure;
    private final List<BlockState> visualStates = new ArrayList<>();
    private final Map<BlockPos, BlockState> clientWitnesses = new LinkedHashMap<>();
    private final Set<Long> witnessedSections = new HashSet<>();
    private final boolean reopen = Boolean.getBoolean("skyweave.authoring.reopen");
    private final boolean island = Boolean.getBoolean("skyweave.authoring.island");
    private final boolean resume = Boolean.getBoolean("skyweave.authoring.resume");
    private final String worldPreset = System.getProperty("skyweave.authoring.worldPreset", island ? "skyweave_compat:islands_v1" : "minecraft:flat");
    private final JsonArray siteAttempts = new JsonArray();
    private final List<int[]> occupied = new ArrayList<>();
    private BlockPos cameraOrigin = new BlockPos(0, 100, 0);

    public TemplatePlacementProbe() {
        if (!Files.isRegularFile(root.resolve("building-authoring-fixture.json"))) throw new IllegalStateException("Unmarked template fixture");
        report.addProperty("reopen", reopen);
        report.addProperty("naturalIsland", island);
        report.addProperty("resumedFixture", resume);
        report.addProperty("requestedWorldPreset", worldPreset);
        report.add("siteAttempts", siteAttempts);
        report.add("placements", placements);
        NeoForge.EVENT_BUS.addListener(this::tick);
    }

    private void tick(ClientTickEvent.Post event) {
        if (done) return;
        var mc = Minecraft.getInstance();
        try {
            if (++ticks > 6000) throw new AssertionError("Template fixture tick budget exceeded");
            if (!opened && mc.screen instanceof TitleScreen && mc.getOverlay() == null) {
                if (net.neoforged.fml.ModList.get().isLoaded("mightyarchitect"))
                    throw new AssertionError("Baked-template qualification requires Mighty to be absent");
                report.addProperty("authoringToolAbsent", true);
                opened = true;
                if (reopen || resume) {
                    if (!Files.isRegularFile(root.resolve("saves/white-terrace-placement/.building-placement-world")))
                        throw new AssertionError("Refusing unmarked saved world");
                    mc.createWorldOpenFlows().openWorld("white-terrace-placement", () -> mc.setScreen(new TitleScreen()));
                } else {
                    mc.createWorldOpenFlows().createFreshLevel("white-terrace-placement",
                        new LevelSettings("White Terrace placement", GameType.CREATIVE, false, Difficulty.PEACEFUL,
                            true, new GameRules(), WorldDataConfiguration.DEFAULT), new WorldOptions(1527L, false, false),
                        registries -> registries.registryOrThrow(Registries.WORLD_PRESET)
                            .get(ResourceLocation.parse(worldPreset)).createWorldDimensions(), mc.screen);
                }
                return;
            }
            if ((reopen || resume) && mc.screen instanceof net.minecraft.client.gui.screens.BackupConfirmScreen) {
                if (!Files.isRegularFile(root.resolve("saves/white-terrace-placement/.building-placement-world")))
                    throw new AssertionError("Refusing an unmarked reopen confirmation");
                for (var child : mc.screen.children()) if (child instanceof net.minecraft.client.gui.components.Button button
                        && button.getMessage().getContents() instanceof net.minecraft.network.chat.contents.TranslatableContents text
                        && text.getKey().equals("selectWorld.backupJoinSkipButton")) {
                    report.addProperty("nativeReopenConfirmed", true); button.onPress(); return;
                }
                throw new AssertionError("Native saved-world proceed button unavailable");
            }
            if (failure != null) throw new AssertionError("Server placement failed", failure);
            if (mc.level == null || mc.player == null || mc.screen != null || mc.getOverlay() != null) return;
            if (!requested) {
                requested = true;
                mc.options.hideGui = true;
                mc.getSingleplayerServer().execute(() -> {
                    try { qualify(mc); ready = true; } catch (Throwable error) { failure = error; }
                });
                return;
            }
            if (!ready) return;
            if (island) {
                sceneTicks++;
                int missing = 0;
                for (var witness : clientWitnesses.entrySet())
                    if (!mc.level.getBlockState(witness.getKey()).equals(witness.getValue())) missing++;
                boolean compiled = mc.levelRenderer.isSectionCompiled(cameraOrigin);
                report.addProperty("clientWitnessBlocks", clientWitnesses.size());
                report.addProperty("clientWitnessMissing", missing);
                report.addProperty("frontSectionCompiled", compiled);
                report.addProperty("clientMinimumBuildHeight", mc.level.getMinBuildHeight());
                report.addProperty("clientMaximumBuildHeight", mc.level.getMaxBuildHeight());
                if (sceneTicks == 1 || sceneTicks % 20 == 0) {
                    var scene = new JsonObject();
                    scene.addProperty("ticks", sceneTicks); scene.addProperty("missingBlocks", missing); scene.addProperty("frontCompiled", compiled);
                    scene.addProperty("clientMinY", mc.level.getMinBuildHeight()); scene.addProperty("clientMaxY", mc.level.getMaxBuildHeight());
                    scene.addProperty("playerPosition", mc.player.position().toString());
                    scene.addProperty("cameraPosition", mc.gameRenderer.getMainCamera().getPosition().toString());
                    scene.addProperty("renderer", mc.levelRenderer.getSectionStatistics());
                    Files.writeString(root.resolve("client-scene-status.json"), new Gson().toJson(scene));
                }
                if (cameraOrigin.getY() < mc.level.getMinBuildHeight() || cameraOrigin.getY() >= mc.level.getMaxBuildHeight())
                    throw new AssertionError("Client height window cannot represent the saved candidate");
                if (missing != 0 || !compiled) { settle = 0; return; }
            }
            if (++settle < 100) return;
            JsonArray models = new JsonArray();
            for (BlockState state : new LinkedHashSet<>(visualStates)) {
                if (state.isAir() || state.is(Blocks.JIGSAW)) continue;
                ResourceLocation id = BuiltInRegistries.BLOCK.getKey(state.getBlock());
                var resource = mc.getResourceManager().getResource(ResourceLocation.fromNamespaceAndPath(id.getNamespace(), "blockstates/" + id.getPath() + ".json"));
                JsonObject model = new JsonObject(); model.addProperty("state", state.toString());
                model.addProperty("blockstateOwner", resource.map(value -> value.sourcePackId()).orElse("no blockstate resource"));
                var baked = mc.getBlockRenderer().getBlockModel(state);
                int quads = baked.getQuads(state, null, RandomSource.create(1527)).size();
                for (Direction side : Direction.values()) quads += baked.getQuads(state, side, RandomSource.create(1527)).size();
                model.addProperty("nativeQuads", quads);
                models.add(model);
            }
            report.add("nativeModels", models);
            String screenshot = reopen ? "placement-reopened.png" : "placement.png";
            Screenshot.grab(root.toFile(), screenshot, mc.getMainRenderTarget(), ignored -> {});
            report.addProperty("screenshot", "screenshots/" + screenshot);
            report.addProperty("status", "PASS");
            finish(mc);
        } catch (Throwable error) {
            report.addProperty("status", "FAIL"); report.addProperty("failure", error.toString()); error.printStackTrace(); finish(mc);
        }
    }

    private void qualify(Minecraft mc) throws Exception {
        var server = mc.getSingleplayerServer(); var level = server.overworld();
        report.addProperty("generatorClass", level.getChunkSource().getGenerator().getClass().getName());
        report.addProperty("worldSeed", level.getSeed());
        report.addProperty("minimumBuildHeight", level.getMinBuildHeight());
        report.addProperty("maximumBuildHeight", level.getMaxBuildHeight());
        var encodedGenerator = net.minecraft.world.level.chunk.ChunkGenerator.CODEC.encodeStart(RegistryOps.create(JsonOps.INSTANCE, level.registryAccess()), level.getChunkSource().getGenerator()).getOrThrow();
        report.add("loadedGeneratorType", encodedGenerator.getAsJsonObject().get("type"));
        level.getGameRules().getRule(GameRules.RULE_DAYLIGHT).set(false, server);
        level.getGameRules().getRule(GameRules.RULE_DOMOBSPAWNING).set(false, server);
        level.getGameRules().getRule(GameRules.RULE_WEATHER_CYCLE).set(false, server);
        level.setDayTime(6000); level.setWeatherParameters(0, 60000, false, false);
        Path save = root.resolve("saves/white-terrace-placement");
        if (!reopen) Files.writeString(save.resolve(".building-placement-world"), "Owned native template fixture\n");
        JsonObject manifest = JsonParser.parseString(Files.readString(root.resolve("placement-inputs.json"))).getAsJsonObject();
        var processors = level.registryAccess().registryOrThrow(Registries.PROCESSOR_LIST).get(ResourceLocation.withDefaultNamespace("empty"));
        if (processors == null || !processors.list().isEmpty()) throw new AssertionError("Expected the actual native empty processor list");
        int index = 0;
        for (var item : manifest.getAsJsonObject("templates").entrySet()) {
            Path path = root.resolve("templates").resolve(item.getKey());
            String actual = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(path)));
            if (!actual.equals(item.getValue().getAsString())) throw new AssertionError("Frozen template digest changed: " + path);
            CompoundTag data = NbtIo.readCompressed(path, NbtAccounter.unlimitedHeap());
            ListTag palette = data.getList("palette", Tag.TAG_COMPOUND);
            for (Tag tag : palette) {
                CompoundTag encoded = (CompoundTag)tag;
                ResourceLocation id = ResourceLocation.parse(encoded.getString("Name"));
                if (!BuiltInRegistries.BLOCK.containsKey(id)) throw new AssertionError("Missing template provider: " + id);
                var block = BuiltInRegistries.BLOCK.get(id);
                CompoundTag properties = encoded.getCompound("Properties");
                for (String key : properties.getAllKeys()) {
                    var definition = block.getStateDefinition().getProperty(key);
                    if (definition == null || definition.getValue(properties.getString(key)).isEmpty()) throw new AssertionError("Invalid template property: " + id + " " + key);
                }
                visualStates.add(NbtUtils.readBlockState(level.holderLookup(Registries.BLOCK), encoded));
            }
            if (!data.getList("entities", Tag.TAG_COMPOUND).isEmpty()) throw new AssertionError("This candidate fixture expects no template entities; add explicit entity qualification before changing that contract");
            StructureTemplate template = new StructureTemplate(); template.load(level.holderLookup(Registries.BLOCK), data);
            qualifyPoolElement(level, template, data, item.getKey());
            for (Rotation rotation : island ? List.of(Rotation.NONE) : List.of(Rotation.NONE, Rotation.CLOCKWISE_90)) {
                BlockPos origin;
                if (island && reopen) {
                    var control = JsonParser.parseString(Files.readString(root.resolve("placement-control.json"))).getAsJsonObject();
                    var matches = new ArrayList<JsonObject>();
                    for (var value : control.getAsJsonArray("placements")) {
                        var previous = value.getAsJsonObject();
                        if (previous.get("template").getAsString().equals(item.getKey()) && previous.get("sha256").getAsString().equals(actual)
                                && previous.get("rotation").getAsString().equals(rotation.name())) matches.add(previous);
                    }
                    if (matches.size() != 1) throw new AssertionError("Saved island placement is missing or ambiguous");
                    var point = matches.getFirst().getAsJsonArray("origin");
                    origin = new BlockPos(point.get(0).getAsInt(), point.get(1).getAsInt(), point.get(2).getAsInt());
                } else origin = island ? naturalSite(level, template) : new BlockPos(rotation == Rotation.NONE ? 0 : 60, 100, index * 70);
                if (index == 0 && rotation == Rotation.NONE) cameraOrigin = origin;
                StructurePlaceSettings settings = new StructurePlaceSettings().setRotation(rotation).addProcessor(JigsawReplacementProcessor.INSTANCE);
                if (!reopen) {
                    if (!island) qualifyFixtureBearing(level, template, origin, settings);
                    if (!template.placeInWorld(level, origin, origin, settings, RandomSource.create(1527), 3)) throw new AssertionError("Native template placement refused");
                }
                JsonObject result = verify(level, template, data, origin, rotation);
                if (island) qualifyExternalApproach(level, data, origin, reopen);
                for (Tag value : data.getList("blocks", Tag.TAG_COMPOUND)) {
                    var cell = (CompoundTag)value; var point = cell.getList("pos", Tag.TAG_INT);
                    var position = StructureTemplate.transform(new BlockPos(point.getInt(0), point.getInt(1), point.getInt(2)), Mirror.NONE, rotation, BlockPos.ZERO).offset(origin);
                    var state = level.getBlockState(position);
                    if (!state.isAir() && witnessedSections.add(SectionPos.asLong(position.getX() >> 4, position.getY() >> 4, position.getZ() >> 4)))
                        clientWitnesses.put(position, state);
                }
                if (!reopen) {
                    // The first local connector is a mandatory clear public approach after replacement.
                    CompoundTag connector = null;
                    for (Tag tag : data.getList("blocks", Tag.TAG_COMPOUND)) {
                        CompoundTag cell = (CompoundTag)tag;
                        if (cell.getCompound("nbt").getString("id").equals("minecraft:jigsaw")) { connector = cell; break; }
                    }
                    if (connector == null) throw new AssertionError("Missing mandatory approach");
                    ListTag point = connector.getList("pos", Tag.TAG_INT);
                    BlockPos obstruction = StructureTemplate.transform(new BlockPos(point.getInt(0), point.getInt(1), point.getInt(2)), Mirror.NONE, rotation, BlockPos.ZERO).offset(origin);
                    level.setBlock(obstruction, Blocks.STONE.defaultBlockState(), 3);
                    boolean refused = false;
                    try { verify(level, template, data, origin, rotation); } catch (AssertionError expected) { refused = true; }
                    finally { level.setBlock(obstruction, Blocks.AIR.defaultBlockState(), 3); }
                    if (!refused) throw new AssertionError("Blocked mandatory approach was accepted");
                    result.addProperty("blockedApproachRefused", true);
                    verify(level, template, data, origin, rotation);
                }
                result.addProperty("template", item.getKey()); result.addProperty("sha256", actual); result.addProperty("rotation", rotation.name());
                JsonArray position = new JsonArray(); position.add(origin.getX()); position.add(origin.getY()); position.add(origin.getZ()); result.add("origin", position);
                placements.add(result);
            }
            index++;
        }
        int expectedCount = manifest.has("fixtureCandidate") && !manifest.get("fixtureCandidate").isJsonNull() ? 1 : 2;
        if (index != expectedCount) throw new AssertionError("Template count differs from the explicit qualification scope");
        server.getPlayerList().getPlayers().forEach(player -> {
            player.setGameMode(GameType.SPECTATOR); player.connection.teleport(cameraOrigin.getX()-14, cameraOrigin.getY()+14, cameraOrigin.getZ()-19, -32, 22);
        });
        server.saveEverything(true, false, true);
    }

    private void qualifyExternalApproach(net.minecraft.server.level.ServerLevel level, CompoundTag data, BlockPos origin, boolean inspectOnly) {
        CompoundTag connector = null;
        for (Tag tag : data.getList("blocks", Tag.TAG_COMPOUND)) {
            var cell = (CompoundTag)tag;
            if (cell.getCompound("nbt").getString("id").equals("minecraft:jigsaw")) { connector = cell; break; }
        }
        if (connector == null) throw new AssertionError("Missing approach connector");
        var point = connector.getList("pos", Tag.TAG_INT);
        BlockPos port = origin.offset(point.getInt(0), point.getInt(1), point.getInt(2));
        var stairs = Blocks.SMOOTH_SANDSTONE_STAIRS.defaultBlockState().setValue(net.minecraft.world.level.block.StairBlock.FACING, Direction.SOUTH);
        int fills = 0, replacedPlants = 0;
        // Explicit two-step companion for this north-facing pilot, outside its unchanged baked bounds.
        for (int side = -1; side <= 1; side++) for (int distance = 1; distance <= 2; distance++) {
            BlockPos step = port.offset(side, -distance, -distance);
            if (!inspectOnly) {
                int ground = surfaceY(level, step.getX(), step.getZ());
                if (ground >= step.getY() || step.getY()-1-ground > 3) throw new AssertionError("Approach requires excavation or excessive fill");
                for (int depth = 0; depth <= 3; depth++) {
                    var bearing = new BlockPos(step.getX(), ground-depth, step.getZ());
                    if (!level.getBlockState(bearing).isSolidRender(level, bearing) || !level.getBlockState(bearing).getFluidState().isEmpty())
                        throw new AssertionError("Approach would bridge missing/wet bearing");
                }
                for (int dy = 0; dy <= 3; dy++) {
                    var cell = level.getBlockState(step.above(dy));
                    if (cell.isAir() || dy > 0 && clearWalkSpace(level, step.above(dy))) continue;
                    if (dy == 0 && cell.canBeReplaced() && cell.getFluidState().isEmpty() && !cell.hasBlockEntity()) { replacedPlants++; continue; }
                    throw new AssertionError("Blocked external approach at "+step.above(dy)+": "+cell);
                }
                for (int y = ground+1; y < step.getY(); y++) { level.setBlock(new BlockPos(step.getX(), y, step.getZ()), Blocks.STONE.defaultBlockState(), 3); fills++; }
                level.setBlock(step, stairs, 3);
            }
            if (!level.getBlockState(step).equals(stairs) || !level.getBlockState(step.below()).isSolidRender(level, step.below()))
                throw new AssertionError("External step or bearing changed");
            for (int dy = 1; dy <= 3; dy++) if (!clearWalkSpace(level, step.above(dy))) throw new AssertionError("External step lacks headroom");
        }
        for (int side = -1; side <= 1; side++) {
            BlockPos landing = port.offset(side, -3, -3);
            if (!level.getBlockState(landing).isSolidRender(level, landing) || !level.getBlockState(landing).getFluidState().isEmpty())
                throw new AssertionError("External steps do not meet dry natural landing");
            for (int dy = 1; dy <= 3; dy++) if (!clearWalkSpace(level, landing.above(dy))) throw new AssertionError("Landing lacks headroom");
            if (!inspectOnly && side == 0) {
                var head = landing.above(); var original = level.getBlockState(head);
                try {
                    level.setBlock(head, Blocks.STONE.defaultBlockState(), 3);
                    if (clearWalkSpace(level, head)) throw new AssertionError("Solid head obstruction accepted");
                } finally { level.setBlock(head, original, 3); }
                report.addProperty("externalApproachStoneObstructionRefused", true);
            }
        }
        report.addProperty("externalApproach", "Six native stairs, three-wide dry natural landing, three-block headroom; explicit fixture companion, not part of the baked template or automatic road generation");
        report.addProperty("externalApproachFillCells", fills);
        report.addProperty("externalApproachReplacedPlants", replacedPlants);
    }

    private static boolean clearWalkSpace(net.minecraft.server.level.ServerLevel level, BlockPos position) {
        var state = level.getBlockState(position);
        return state.getFluidState().isEmpty() && !state.hasBlockEntity() && state.getCollisionShape(level, position).isEmpty();
    }

    private void qualifyPoolElement(net.minecraft.server.level.ServerLevel level, StructureTemplate template, CompoundTag data, String filename) throws Exception {
        JsonObject proposal = JsonParser.parseString(Files.readString(root.resolve("admission-proposal.json"))).getAsJsonObject();
        String identifier = filename.replace("-furnished.nbt", "");
        JsonObject candidate = null;
        for (JsonElement entry : proposal.getAsJsonArray("candidates"))
            if (entry.getAsJsonObject().get("id").getAsString().equals(identifier)) candidate = entry.getAsJsonObject();
        if (candidate == null) throw new AssertionError("Missing candidate in the inactive admission proposal");
        ResourceLocation location = ResourceLocation.parse(candidate.get("location").getAsString());
        var manager = level.getServer().getStructureManager();
        manager.getOrCreate(location).load(level.holderLookup(Registries.BLOCK), data);
        JsonObject encoded = proposal.getAsJsonObject("entryPattern").getAsJsonObject("element").deepCopy();
        encoded.getAsJsonObject("delegate").addProperty("location", location.toString());
        StructurePoolElement element = StructurePoolElement.CODEC.parse(RegistryOps.create(JsonOps.INSTANCE, level.registryAccess()), encoded).getOrThrow();
        if (!element.getSize(manager, Rotation.NONE).equals(template.getSize())) throw new AssertionError("Decoded pool element bounds differ from the frozen template");
        var ports = element.getShuffledJigsawBlocks(manager, BlockPos.ZERO, Rotation.NONE, RandomSource.create(1527));
        if (ports.size() != 1) throw new AssertionError("Expected one native pool attachment");
        var port = ports.getFirst();
        var state = port.state().rotate(Rotation.CLOCKWISE_180);
        CompoundTag peerData = port.nbt().copy();
        peerData.putString("name", port.nbt().getString("target")); peerData.putString("target", port.nbt().getString("name"));
        var peer = new StructureTemplate.StructureBlockInfo(port.pos().north(), state, peerData);
        if (!JigsawBlock.canAttach(peer, port)) throw new AssertionError("Native matching entrance connectors did not attach");
        peerData = peerData.copy(); peerData.putString("target", "skyweave_missing:wrong_entrance");
        if (JigsawBlock.canAttach(new StructureTemplate.StructureBlockInfo(peer.pos(), state, peerData), port))
            throw new AssertionError("Native mismatched attachment was accepted");
        JsonObject result = new JsonObject(); result.add("decodedDefinition", encoded); result.addProperty("matchingAttachment", true); result.addProperty("wrongAttachmentRefused", true);
        report.add("pool:" + identifier, result);
    }

    private void qualifyFixtureBearing(net.minecraft.server.level.ServerLevel level, StructureTemplate template,
            BlockPos origin, StructurePlaceSettings placement) throws Exception {
        var box = template.getBoundingBox(placement, origin);
        Class<?> footType = Class.forName("design.inherent.skyweavecompat.terrain.structure.FoundationSupport$Foot");
        Class<?> settingsType = Class.forName("design.inherent.skyweavecompat.terrain.structure.VillageFitSettings");
        var evaluate = Class.forName("design.inherent.skyweavecompat.terrain.structure.FoundationSupport")
            .getMethod("evaluate", java.util.Collection.class, java.util.function.ToIntFunction.class, settingsType, boolean.class);
        Object settings = settingsType.getField("DEFAULT").get(null);
        var feet = new ArrayList<Object>(); var constructor = footType.getConstructor(int.class, int.class, int.class);
        for (int x = box.minX(); x <= box.maxX(); x++) for (int z = box.minZ(); z <= box.maxZ(); z++) {
            level.setBlock(new BlockPos(x, origin.getY()-1, z), Blocks.STONE.defaultBlockState(), 3);
            feet.add(constructor.newInstance(x, origin.getY(), z));
        }
        java.util.function.ToIntFunction<Object> ground = foot -> {
            try {
                int x = (int)footType.getMethod("x").invoke(foot), z = (int)footType.getMethod("z").invoke(foot);
                return surfaceY(level, x, z);
            } catch (Exception error) { throw new IllegalStateException(error); }
        };
        Object accepted = evaluate.invoke(null, feet, ground, settings, true);
        if (!(boolean)accepted.getClass().getMethod("accepted").invoke(accepted)) throw new AssertionError("Native evaluator refused fully bearing fixture platform");
        Object missing = evaluate.invoke(null, feet, (java.util.function.ToIntFunction<Object>)foot -> Integer.MIN_VALUE, settings, true);
        if ((boolean)missing.getClass().getMethod("accepted").invoke(missing)) throw new AssertionError("Native complete support accepted absent terrain");
        BlockPos hole = new BlockPos(box.minX(), origin.getY()-1, box.minZ());
        level.setBlock(hole, Blocks.AIR.defaultBlockState(), 3);
        try {
            Object broken = evaluate.invoke(null, feet, ground, settings, true);
            if ((boolean)broken.getClass().getMethod("accepted").invoke(broken)) throw new AssertionError("Native complete support accepted missing bearing");
        } finally { level.setBlock(hole, Blocks.STONE.defaultBlockState(), 3); }
        report.addProperty("fixtureBearing:"+origin, "native full bearing accepted; absent terrain and one missing bearing refused; authored platform, not natural terrain");
    }

    private BlockPos naturalSite(net.minecraft.server.level.ServerLevel level, StructureTemplate template) throws Exception {
        BlockPos spawn = level.getSharedSpawnPos();
        int width = template.getSize().getX(), length = template.getSize().getZ();
        Class<?> footType = Class.forName("design.inherent.skyweavecompat.terrain.structure.FoundationSupport$Foot");
        Class<?> supportType = Class.forName("design.inherent.skyweavecompat.terrain.structure.FoundationSupport");
        Class<?> settingsType = Class.forName("design.inherent.skyweavecompat.terrain.structure.VillageFitSettings");
        Object settings = settingsType.getField("DEFAULT").get(null);
        var evaluate = supportType.getMethod("evaluate", java.util.Collection.class, java.util.function.ToIntFunction.class, settingsType, boolean.class);
        int allowedGap = (int)settingsType.getMethod("maximumGroundGap").invoke(settings);
        var origins = new ArrayList<int[]>();
        // Use the pack's actual island/style index to shortlist eligible land before loading chunks.
        Object generator = level.getChunkSource().getGenerator();
        Object islandSettings = generator.getClass().getMethod("resolvedSkyIslandSettings").invoke(generator);
        Object field = generator.getClass().getMethod("skyweave$field", net.minecraft.world.level.levelgen.RandomState.class)
            .invoke(generator, level.getChunkSource().randomState());
        Object generation = field.getClass().getMethod("skyweave$profile").invoke(field);
        Object styles = field.getClass().getMethod("skyweave$styles").invoke(field);
        int spacing = (int)generation.getClass().getMethod("spacing").invoke(generation);
        var members = field.getClass().getMethod("skyweave$members", int.class, int.class, islandSettings.getClass());
        var eligible = new ArrayList<int[]>();
        JsonArray descriptors = new JsonArray();
        Map<String, Integer> biomeCounts = new TreeMap<>();
        int inspected = 0;
        for (int dx = -16; dx <= 16; dx++) for (int dz = -16; dz <= 16; dz++) {
            var islands = (List<?>)members.invoke(field, Math.floorDiv(spawn.getX(), spacing)+dx, Math.floorDiv(spawn.getZ(), spacing)+dz, islandSettings);
            for (Object descriptor : islands) {
                var type = descriptor.getClass();
                if ((int)type.getMethod("maxRadius").invoke(descriptor) < Math.max(width, length)+8) continue;
                Object style = styles.getClass().getMethod("style", type).invoke(styles, descriptor);
                String biome = (String)style.getClass().getMethod("hostBiome").invoke(style);
                inspected++;
                biomeCounts.merge(biome, 1, Integer::sum);
                if (!Set.of("minecraft:beach", "minecraft:stony_shore", "minecraft:savanna", "minecraft:savanna_plateau").contains(biome)) continue;
                int x = (int)type.getMethod("centerX").invoke(descriptor), z = (int)type.getMethod("centerZ").invoke(descriptor);
                eligible.add(new int[]{x,z});
                JsonObject item = new JsonObject(); item.addProperty("x", x); item.addProperty("z", z); item.addProperty("hostBiome", biome);
                item.addProperty("radius", (int)type.getMethod("maxRadius").invoke(descriptor)); descriptors.add(item);
            }
        }
        eligible.sort(Comparator.comparingLong(p -> (long)(p[0]-spawn.getX())*(p[0]-spawn.getX())+(long)(p[1]-spawn.getZ())*(p[1]-spawn.getZ())));
        for (int[] center : eligible.subList(0, Math.min(3, eligible.size())))
            for (int dx = -2; dx <= 2; dx++) for (int dz = -2; dz <= 2; dz++)
                origins.add(new int[]{center[0] + dx*8 - width/2, center[1] + dz*8 - length/2});
        report.add("eligibleIslandDescriptors", descriptors);
        report.addProperty("inspectedLargeIslandDescriptors", inspected);
        report.add("hostBiomeCounts", new Gson().toJsonTree(biomeCounts));
        if (eligible.isEmpty()) throw new AssertionError("No White Terrace host biome in the bounded island-index search; no terrain generated for candidate sites");
        if (Files.isRegularFile(root.resolve("site-hints.json"))) {
            var hints = JsonParser.parseString(Files.readString(root.resolve("site-hints.json"))).getAsJsonObject();
            if (!hints.get("worldPreset").getAsString().equals(worldPreset) || hints.get("seed").getAsLong() != level.getSeed())
                throw new AssertionError("Saved site hints do not match this world preset and seed");
            var savedOrigins = new ArrayList<int[]>();
            for (JsonElement value : hints.getAsJsonArray("sites")) {
                JsonObject hint = value.getAsJsonObject();
                if (hint.get("width").getAsInt() == width && hint.get("length").getAsInt() == length && savedOrigins.size() < 5)
                    savedOrigins.add(new int[]{hint.get("x").getAsInt(), hint.get("z").getAsInt()});
            }
            origins.addAll(0, savedOrigins);
        }
        for (int[] candidateOrigin : origins) {
            int x0 = candidateOrigin[0], z0 = candidateOrigin[1];
            boolean overlaps = occupied.stream().anyMatch(box -> x0 < box[2] + 6 && x0 + width + 6 > box[0] && z0 < box[3] + 6 && z0 + length + 6 > box[1]);
            if (overlaps) continue;
            int[][] tops = new int[width][length]; int minimum = Integer.MAX_VALUE, maximum = Integer.MIN_VALUE;
            String refused = null;
            JsonObject row = new JsonObject(); row.addProperty("x", x0); row.addProperty("z", z0);
            for (int x = 0; x < width && refused == null; x++) for (int z = 0; z < length; z++) {
                int y = surfaceY(level, x0+x, z0+z);
                BlockPos ground = new BlockPos(x0+x, y, z0+z); BlockState state = level.getBlockState(ground);
                if (y <= level.getMinBuildHeight()+4) refused = "missing ground";
                else if (!state.getFluidState().isEmpty()) refused = "wet ground";
                else if (!state.isSolidRender(level, ground)) refused = "partial ground";
                else if (!(state.is(net.minecraft.tags.BlockTags.DIRT) || state.is(net.minecraft.tags.BlockTags.SAND)
                         || state.is(net.minecraft.tags.BlockTags.BASE_STONE_OVERWORLD) || state.is(Blocks.GRAVEL)
                         || state.is(Blocks.TERRACOTTA))) refused = "non-natural ground";
                if (refused != null) { row.addProperty("rejectedBlock", state.toString()); row.addProperty("rejectedY", y); break; }
                for (int depth = 1; depth <= 3; depth++) if (!level.getBlockState(ground.below(depth)).isSolidRender(level, ground.below(depth))) {
                    refused = "thin ground or protected cavity"; break;
                }
                tops[x][z] = y; minimum = Math.min(minimum, y); maximum = Math.max(maximum, y);
                if (maximum-minimum > allowedGap) { refused = "slope exceeds the native support gap"; break; }
            }
            if (minimum != Integer.MAX_VALUE) { row.addProperty("minimum", minimum); row.addProperty("maximum", maximum); }
            if (refused != null) { row.addProperty("refused", refused); siteAttempts.add(row); continue; }
            int base = maximum+1;
            String actualBiome = level.getBiome(new BlockPos(x0+width/2,base,z0+length/2)).unwrapKey().orElseThrow().location().toString();
            if (!Set.of("minecraft:beach", "minecraft:stony_shore", "minecraft:savanna", "minecraft:savanna_plateau").contains(actualBiome)) {
                row.addProperty("refused", "actual site biome is outside the White Terrace profile"); row.addProperty("biome", actualBiome); siteAttempts.add(row); continue;
            }
            var feet = new ArrayList<Object>(); var constructor = footType.getConstructor(int.class, int.class, int.class);
            for (int x = 0; x < width; x++) for (int z = 0; z < length; z++) feet.add(constructor.newInstance(x0+x, base, z0+z));
            java.util.function.ToIntFunction<Object> ground = foot -> {
                try { return tops[(int)footType.getMethod("x").invoke(foot)-x0][(int)footType.getMethod("z").invoke(foot)-z0]; }
                catch (Exception error) { throw new IllegalStateException(error); }
            };
            Object result = evaluate.invoke(null, feet, ground, settings, true);
            if (!(boolean)result.getClass().getMethod("accepted").invoke(result)) throw new AssertionError("Native complete-support evaluator refused a supposedly accepted site");
            Object voidControl = evaluate.invoke(null, feet, (java.util.function.ToIntFunction<Object>)foot -> Integer.MIN_VALUE, settings, true);
            if ((boolean)voidControl.getClass().getMethod("accepted").invoke(voidControl)) throw new AssertionError("Native support evaluator accepted missing terrain");
            // Fixture-only short footing fill. Never excavate terrain, bridge a void, or alter production grading.
            int fills = 0;
            for (int x = 0; x < width; x++) for (int z = 0; z < length; z++) for (int y = tops[x][z]+1; y < base; y++) {
                level.setBlock(new BlockPos(x0+x,y,z0+z), Blocks.STONE.defaultBlockState(), 3); fills++;
            }
            for (int x = 0; x < width; x++) for (int z = 0; z < length; z++)
                if (!level.getBlockState(new BlockPos(x0+x,base-1,z0+z)).isSolidRender(level, new BlockPos(x0+x,base-1,z0+z)))
                    throw new AssertionError("Accepted foundation still lacks immediate bearing");
            row.addProperty("accepted", true); row.addProperty("baseY", base); row.addProperty("nativeSupport", result.toString());
            row.addProperty("missingTerrainRefused", true); row.addProperty("fixtureFootingCells", fills);
            row.addProperty("biome", level.getBiome(new BlockPos(x0+width/2,base,z0+length/2)).unwrapKey().orElseThrow().location().toString());
            siteAttempts.add(row); occupied.add(new int[]{x0,z0,x0+width,z0+length});
            report.addProperty("siteScope", "Natural current-generator island, strict native complete-support evaluation and fixture-only bounded stone footings; not automatic village planner/grading admission");
            return new BlockPos(x0,base,z0);
        }
        throw new AssertionError("No qualified island site in the bounded candidate search; inspect siteAttempts");
    }

    private static int surfaceY(net.minecraft.server.level.ServerLevel level, int x, int z) {
        // Level.getHeight returns minimum Y for an unloaded chunk; that is not evidence of void.
        return level.getChunk(Math.floorDiv(x, 16), Math.floorDiv(z, 16))
            .getHeight(Heightmap.Types.MOTION_BLOCKING_NO_LEAVES, x & 15, z & 15);
    }

    private static JsonObject verify(net.minecraft.server.level.ServerLevel level, StructureTemplate template, CompoundTag data, BlockPos origin, Rotation rotation) {
        int checked = 0, named = 0, ports = 0, support = 0, entities = 0;
        for (Tag tag : data.getList("blocks", Tag.TAG_COMPOUND)) {
            CompoundTag cell = (CompoundTag)tag; ListTag xyz = cell.getList("pos", Tag.TAG_INT);
            BlockPos local = new BlockPos(xyz.getInt(0), xyz.getInt(1), xyz.getInt(2));
            BlockPos position = StructureTemplate.transform(local, Mirror.NONE, rotation, BlockPos.ZERO).offset(origin);
            BlockState expected = NbtUtils.readBlockState(level.holderLookup(Registries.BLOCK), data.getList("palette", Tag.TAG_COMPOUND).getCompound(cell.getInt("state"))).rotate(rotation);
            if (expected.is(Blocks.JIGSAW)) { expected = Blocks.AIR.defaultBlockState(); ports++; }
            if (!expected.equals(level.getBlockState(position))) throw new AssertionError("Saved/placed state mismatch at " + position);
            if (local.getY() == 0 && !expected.getCollisionShape(level, position).isEmpty()) support++;
            if (cell.contains("nbt", Tag.TAG_COMPOUND) && !cell.getCompound("nbt").getString("id").equals("minecraft:jigsaw")) {
                var entity = level.getBlockEntity(position);
                if (entity == null) throw new AssertionError("Missing native block entity at " + position);
                CompoundTag actual = entity.saveWithFullMetadata(level.registryAccess()), required = cell.getCompound("nbt");
                for (String key : required.getAllKeys()) {
                    if (!Set.of("x", "y", "z").contains(key) && !required.get(key).equals(actual.get(key)))
                        throw new AssertionError("Native payload lost: " + key + " at " + position);
                }
                if (required.contains("CustomName")) named++;
                entities++;
            }
            checked++;
        }
        if (ports != 1 || named != 1 || entities < 2 || support < template.getSize().getX()) throw new AssertionError("Incomplete connector, payload, or footing witness");
        JsonObject result = new JsonObject(); result.addProperty("cells", checked); result.addProperty("blockEntities", entities);
        result.addProperty("namedContainers", named); result.addProperty("replacedPorts", ports); result.addProperty("solidBaseCells", support);
        return result;
    }

    private void finish(Minecraft mc) {
        done = true;
        String name = reopen ? "placement-reopen-result.json" : "placement-result.json";
        try { Files.writeString(root.resolve(name), new GsonBuilder().setPrettyPrinting().create().toJson(report) + "\n"); }
        catch (Exception error) { throw new RuntimeException(error); }
        if (mc.level != null) mc.level.disconnect(); mc.disconnect(); mc.stop();
    }
}
