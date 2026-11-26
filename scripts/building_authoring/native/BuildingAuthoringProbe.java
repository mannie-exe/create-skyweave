package design.inherent.skyweave.authoring;

import com.google.gson.*;
import com.mojang.serialization.JsonOps;
import com.timmie.mightyarchitect.control.ArchitectManager;
import com.timmie.mightyarchitect.control.Schematic;
import com.timmie.mightyarchitect.control.compose.*;
import com.timmie.mightyarchitect.control.design.*;
import com.timmie.mightyarchitect.control.palette.Palette;
import com.timmie.mightyarchitect.control.palette.PaletteDefinition;
import com.timmie.mightyarchitect.control.storage.ClientSettings;
import java.nio.file.*;
import java.util.*;
import net.minecraft.client.Minecraft;
import net.minecraft.client.Screenshot;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.core.BlockPos;
import net.minecraft.core.registries.*;
import net.minecraft.nbt.*;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.Difficulty;
import net.minecraft.world.level.*;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.Rotation;
import net.minecraft.world.level.block.Mirror;
import net.minecraft.world.level.block.entity.BarrelBlockEntity;
import net.minecraft.world.level.block.state.properties.Property;
import net.minecraft.world.level.levelgen.WorldOptions;
import net.minecraft.world.level.levelgen.structure.templatesystem.StructureTemplate;
import net.minecraft.world.level.levelgen.structure.templatesystem.StructurePlaceSettings;
import net.minecraft.world.level.levelgen.structure.templatesystem.JigsawReplacementProcessor;
import net.minecraft.util.RandomSource;
import net.neoforged.fml.common.Mod;
import net.neoforged.fml.loading.FMLPaths;
import net.neoforged.neoforge.client.event.ClientTickEvent;
import net.neoforged.neoforge.common.NeoForge;

/** Explicitly installed only in marked disposable authoring fixtures. */
@Mod("skyweave_building_probe")
public final class BuildingAuthoringProbe {
    private final Path root = FMLPaths.GAMEDIR.get().toAbsolutePath().normalize();
    private final JsonObject report = new JsonObject();
    private boolean opened, done;
    private int ticks;
    private boolean exported;
    private volatile boolean sceneReady, cameraReady;
    private volatile Throwable serverFailure;
    private int view, settle;
    private final List<StructureTemplate> templates = new ArrayList<>();
    private final List<JsonObject> variants = new ArrayList<>();
    private final JsonArray captures = new JsonArray();
    private JsonObject brief;

    public BuildingAuthoringProbe() {
        if (!Files.isRegularFile(root.resolve("building-authoring-fixture.json")))
            throw new IllegalStateException("Refusing an unmarked authoring fixture");
        NeoForge.EVENT_BUS.addListener(this::tick);
    }

    private void tick(ClientTickEvent.Post event) {
        if (done) return;
        Minecraft mc = Minecraft.getInstance();
        try {
            if (++ticks > 3000) throw new IllegalStateException("Authoring fixture exceeded its tick budget");
            if (!opened && mc.screen instanceof TitleScreen && mc.getOverlay() == null) {
                opened = true;
                mc.createWorldOpenFlows().createFreshLevel("white-terrace-authoring",
                    new LevelSettings("White Terrace authoring", GameType.CREATIVE, false, Difficulty.PEACEFUL,
                        true, new GameRules(), WorldDataConfiguration.DEFAULT),
                    new WorldOptions(1527L, false, false),
                    registries -> registries.registryOrThrow(Registries.WORLD_PRESET)
                        .get(ResourceLocation.withDefaultNamespace("flat")).createWorldDimensions(), mc.screen);
                return;
            }
            if (mc.level == null || mc.player == null || mc.getOverlay() != null || mc.screen != null) return;
            if (serverFailure != null) throw new AssertionError("Native scene failed", serverFailure);
            if (exported) { preview(mc); return; }
            brief = JsonParser.parseString(Files.readString(root.resolve("brief.json"))).getAsJsonObject();
            validatePalette(brief.getAsJsonObject("palette"));
            nativeRefusals();
            String themeId = brief.get("theme").getAsString();
            DesignTheme theme = ThemeStorage.getIncluded().stream()
                .filter(t -> t.getFilePath().equals(themeId)).findFirst()
                .orElseThrow(() -> new AssertionError("Custom theme not discovered through native resource manager"));
            // Native preference, confined to this marked fixture. Its legacy GLSL effect fails on this Mac/Iris host.
            ClientSettings.setBlueprintView(false);
            JsonArray outputs = new JsonArray();
            for (JsonElement item : brief.getAsJsonArray("variants")) {
                JsonObject variant = item.getAsJsonObject();
                String id = variant.get("id").getAsString();
                CompoundTag first = compose(theme, brief, variant);
                CompoundTag second = compose(theme, brief, variant);
                if (!first.equals(second)) throw new AssertionError("Native composition differs on identical inputs: " + id);
                Path out = root.resolve("exports");
                Files.createDirectories(out);
                writeExport(first, id + ".nbt");
                JsonObject result = new JsonObject();
                result.addProperty("id", id);
                result.addProperty("nativeRepeatEqual", true);
                result.addProperty("blocks", first.getList("blocks", Tag.TAG_COMPOUND).size());
                result.addProperty("paletteStates", first.getList("palette", Tag.TAG_COMPOUND).size());
                result.addProperty("entityCount", first.getList("entities", Tag.TAG_COMPOUND).size());
                result.addProperty("size", first.get("size").toString());
                if (Boolean.getBoolean("skyweave.authoring.preview")) {
                    validatePalette(brief.getAsJsonObject("moddedPalette"));
                    CompoundTag modded = applyModdedPalette(theme, brief);
                    compose(theme, brief, variant);
                    if (!modded.equals(applyModdedPalette(theme, brief))) throw new AssertionError("Modded materialization differs on repeat");
                    if (modded.equals(first)) throw new AssertionError("Modded palette was not exercised");
                    writeExport(modded, id + "-modded.nbt");
                    result.addProperty("moddedRepeatEqual", true);
                    result.addProperty("moddedDiffersFromVanilla", true);
                }
                outputs.add(result);
                StructureTemplate template = new StructureTemplate();
                template.load(mc.level.holderLookup(Registries.BLOCK), first);
                templates.add(template);
                variants.add(variant);
            }
            report.add("exports", outputs);
            report.addProperty("theme", theme.getFilePath());
            report.addProperty("status", "PASS");
            ArchitectManager.unload();
            mc.options.hideGui = true;
            exported = true;
            if (Boolean.getBoolean("skyweave.authoring.preview")) {
                validatePalette(brief.getAsJsonObject("moddedPalette"));
                report.add("captures", captures);
                mc.getSingleplayerServer().execute(() -> {
                    try { placeScene(mc); sceneReady = true; }
                    catch (Throwable failure) { serverFailure = failure; }
                });
            } else finish(mc);
        } catch (Throwable failure) {
            report.addProperty("status", "FAIL");
            report.addProperty("failure", failure.toString());
            failure.printStackTrace();
            finish(mc);
        }
    }

    private CompoundTag compose(DesignTheme theme, JsonObject brief, JsonObject variant) {
        ArchitectManager.unload();
        theme.getDesignPicker().reset();
        ArchitectManager.compose(theme);
        Schematic model = ArchitectManager.getModel();
        model.seed = brief.get("seed").getAsInt();
        model.setAnchor(new BlockPos(0, 100, 0));
        GroundPlan plan = model.getGroundPlan();
        Room lower = new Room(BlockPos.ZERO, variant.get("width").getAsInt(),
            brief.get("foundationHeight").getAsInt(), variant.get("length").getAsInt());
        lower.designLayer = DesignLayer.Foundation;
        lower.roofType = DesignType.FLAT_ROOF;
        com.timmie.mightyarchitect.control.compose.Stack stack = new com.timmie.mightyarchitect.control.compose.Stack(lower);
        stack.increase();
        plan.addStack(stack);
        ArchitectManager.design();
        for (Room room : stack.getRooms()) {
            var mapping = theme.getDesignPicker().getCachedRoom(room);
            if (mapping == null || !(theme.getDesigns(room.designLayer, DesignType.WALL).contains(mapping.wall1)
                        || theme.getDesigns(room.designLayer, DesignType.FACADE).contains(mapping.wall1))
                    || !(theme.getDesigns(room.designLayer, DesignType.WALL).contains(mapping.wall2)
                        || theme.getDesigns(room.designLayer, DesignType.FACADE).contains(mapping.wall2))
                    || !theme.getDesigns(room.designLayer, DesignType.CORNER).contains(mapping.corner))
                throw new AssertionError("Mighty selected missing/fallback components");
        }
        if (!theme.getDesigns(DesignLayer.Roofing, DesignType.FLAT_ROOF).contains(theme.getDesignPicker().getCachedRoof(stack)))
            throw new AssertionError("Mighty selected a missing/fallback roof");
        StructureTemplate template = model.writeToTemplate();
        CompoundTag saved = template.save(new CompoundTag());
        saved.putInt("DataVersion", 3955);
        if (saved.getList("blocks", Tag.TAG_COMPOUND).isEmpty()) throw new AssertionError("Empty Mighty template");
        return saved;
    }

    private CompoundTag applyModdedPalette(DesignTheme theme, JsonObject brief) {
        PaletteDefinition palette = theme.getDefaultPalette().clone();
        for (var item : brief.getAsJsonObject("moddedPalette").entrySet())
            palette.put(Palette.valueOf(item.getKey()), PaletteDefinition.BLOCK_STATE.parse(JsonOps.INSTANCE, item.getValue()).getOrThrow());
        ArchitectManager.getModel().swapPrimaryPalette(palette);
        CompoundTag result = ArchitectManager.getModel().writeToTemplate().save(new CompoundTag());
        result.putInt("DataVersion", 3955);
        return result;
    }

    private void nativeRefusals() {
        for (String test : List.of("missing-provider", "unknown-property")) {
            JsonObject state = new JsonObject();
            state.addProperty("Name", test.equals("missing-provider") ? "skyweave_missing_provider:wall" : "minecraft:stone");
            if (test.equals("unknown-property")) {
                JsonObject properties = new JsonObject(); properties.addProperty("facing", "north"); state.add("Properties", properties);
            }
            JsonObject palette = new JsonObject(); palette.add("INNER_PRIMARY", state);
            boolean refused = false;
            try { validatePalette(palette); } catch (AssertionError expected) { refused = true; }
            if (!refused) throw new AssertionError("Invalid palette was accepted: " + test);
            report.addProperty("refused:" + test, true);
        }
    }

    private void placeScene(Minecraft mc) throws Exception {
        var server = mc.getSingleplayerServer();
        var level = server.overworld();
        level.getGameRules().getRule(GameRules.RULE_DAYLIGHT).set(false, server);
        level.getGameRules().getRule(GameRules.RULE_WEATHER_CYCLE).set(false, server);
        level.getGameRules().getRule(GameRules.RULE_DOMOBSPAWNING).set(false, server);
        level.setDayTime(6000);
        level.setWeatherParameters(0, 60000, false, false);
        for (int i = 0; i < templates.size(); i++) {
            StructureTemplate template = templates.get(i);
            BlockPos origin = new BlockPos(i * 40, 100, 0);
            int width = template.getSize().getX(), length = template.getSize().getZ();
            for (int x = -5; x < width + 5; x++) for (int z = -10; z < length + 5; z++)
                level.setBlock(origin.offset(x, -1, z), Blocks.SMOOTH_STONE.defaultBlockState(), 3);
            if (!template.placeInWorld(level, origin, origin, new StructurePlaceSettings().setIgnoreEntities(false), RandomSource.create(1527), 3))
                throw new AssertionError("Native shell placement refused");
            int center = width / 2;
            for (JsonElement item : brief.getAsJsonObject("furnishing").getAsJsonArray("operations")) {
                JsonObject operation = item.getAsJsonObject();
                BlockPos from = relative(operation.getAsJsonArray("from"), template.getSize());
                BlockPos to = relative(operation.getAsJsonArray("to"), template.getSize());
                BlockState state = strictState(operation.getAsJsonObject("state"));
                if (from.getX() > to.getX() || from.getY() > to.getY() || from.getZ() > to.getZ()
                        || (long)(to.getX()-from.getX()+1)*(to.getY()-from.getY()+1)*(to.getZ()-from.getZ()+1) > 4096)
                    throw new AssertionError("Invalid furnishing bounds");
                for (BlockPos pos : BlockPos.betweenClosed(from, to)) level.setBlock(origin.offset(pos), state, 3);
            }
            var namedStorage = (BarrelBlockEntity)level.getBlockEntity(origin.offset(width - 4, 3, 11));
            CompoundTag storageData = namedStorage.saveWithFullMetadata(level.registryAccess());
            storageData.putString("CustomName", "{\"text\":\"Dispatch storage\"}");
            namedStorage.loadWithComponents(storageData, level.registryAccess());
            namedStorage.setChanged();
            for (int x = center - 1; x <= center + 1; x++) for (int y = 3; y <= 5; y++) for (int z = 1; z < length - 1; z++)
                if (!level.getBlockState(origin.offset(x, y, z)).getCollisionShape(level, origin.offset(x, y, z)).isEmpty())
                    throw new AssertionError("Freight aisle blocked at " + origin.offset(x, y, z));
            StructureTemplate furnished = new StructureTemplate();
            JsonObject capture = brief.getAsJsonObject("furnishing").getAsJsonObject("capture");
            BlockPos minimum = relative(capture.getAsJsonArray("minimum"), template.getSize());
            BlockPos maximum = relative(capture.getAsJsonArray("maximum"), template.getSize());
            BlockPos captureOrigin = origin.offset(minimum);
            BlockPos captureSize = maximum.subtract(minimum).offset(1, 1, 1);
            JsonObject connection = brief.getAsJsonObject("connection");
            BlockPos port = origin.offset(relative(connection.getAsJsonArray("position"), template.getSize()));
            StructureTemplate entry = new StructureTemplate();
            entry.load(level.holderLookup(Registries.BLOCK), NbtIo.readCompressed(root.resolve("entry-port.nbt"), NbtAccounter.unlimitedHeap()));
            if (!entry.placeInWorld(level, port, port, new StructurePlaceSettings(), RandomSource.create(1527), 3))
                throw new AssertionError("Compiled entry port placement refused");
            furnished.fillFromWorld(level, captureOrigin, captureSize, true, null);
            writeExport(furnished.save(new CompoundTag()), variants.get(i).get("id").getAsString() + "-furnished.nbt");
            verifyRotated(level, furnished, new BlockPos(120 + i * 55, 100, 0));
        }
        server.getPlayerList().getPlayers().forEach(player -> player.setGameMode(GameType.SPECTATOR));
    }

    private void writeExport(CompoundTag data, String name) throws Exception {
        Path retained = root.resolve("comparison-exports").resolve(name);
        if (Files.isDirectory(root.resolve("comparison-exports"))) {
            CompoundTag expected = NbtIo.readCompressed(retained, NbtAccounter.unlimitedHeap());
            if (!expected.equals(data)) throw new AssertionError("Rebuild differs from retained typed NBT: " + name);
            report.addProperty("retainedEqual:" + name, true);
        }
        NbtIo.writeCompressed(data, root.resolve("exports").resolve(name));
    }

    private static int coordinate(JsonElement value, int bound) {
        if (value.getAsJsonPrimitive().isNumber()) return value.getAsInt();
        String text = value.getAsString();
        var match = java.util.regex.Pattern.compile("(center|end)([+-][0-9]+)?").matcher(text);
        if (!match.matches()) throw new AssertionError("Invalid relative coordinate: " + text);
        return (match.group(1).equals("center") ? bound / 2 : bound) + (match.group(2) == null ? 0 : Integer.parseInt(match.group(2)));
    }

    private static BlockPos relative(JsonArray values, net.minecraft.core.Vec3i size) {
        if (values.size() != 3) throw new AssertionError("Expected three coordinates");
        return new BlockPos(coordinate(values.get(0), size.getX()), coordinate(values.get(1), size.getY()), coordinate(values.get(2), size.getZ()));
    }

    private static BlockState strictState(JsonObject specification) {
        JsonObject palette = new JsonObject(); palette.add("INNER_PRIMARY", specification); validatePalette(palette);
        return PaletteDefinition.BLOCK_STATE.parse(JsonOps.INSTANCE, specification).getOrThrow();
    }

    private void verifyRotated(net.minecraft.server.level.ServerLevel level, StructureTemplate template, BlockPos origin) {
        var settings = new StructurePlaceSettings().setRotation(Rotation.CLOCKWISE_90).addProcessor(JigsawReplacementProcessor.INSTANCE);
        if (!template.placeInWorld(level, origin, origin, settings, RandomSource.create(1527), 3))
            throw new AssertionError("Rotated placement refused");
        CompoundTag data = template.save(new CompoundTag());
        ListTag palette = data.getList("palette", Tag.TAG_COMPOUND);
        int checked = 0, named = 0, ports = 0;
        for (Tag element : data.getList("blocks", Tag.TAG_COMPOUND)) {
            CompoundTag cell = (CompoundTag)element;
            ListTag coordinates = cell.getList("pos", Tag.TAG_INT);
            BlockPos local = new BlockPos(coordinates.getInt(0), coordinates.getInt(1), coordinates.getInt(2));
            BlockPos position = StructureTemplate.transform(local, Mirror.NONE, Rotation.CLOCKWISE_90, BlockPos.ZERO).offset(origin);
            BlockState expected = NbtUtils.readBlockState(level.holderLookup(Registries.BLOCK), palette.getCompound(cell.getInt("state"))).rotate(Rotation.CLOCKWISE_90);
            if (expected.is(Blocks.JIGSAW)) { expected = Blocks.AIR.defaultBlockState(); ports++; }
            BlockState actual = level.getBlockState(position);
            if (!expected.equals(actual)) throw new AssertionError("Rotated state differs at " + position + ": " + expected + " / " + actual);
            if (cell.contains("nbt", Tag.TAG_COMPOUND) && cell.getCompound("nbt").contains("CustomName")) {
                var entity = level.getBlockEntity(position);
                if (entity == null || !cell.getCompound("nbt").get("CustomName").equals(entity.saveWithFullMetadata(level.registryAccess()).get("CustomName")))
                    throw new AssertionError("Custom container data lost during rotation");
                named++;
            }
            checked++;
        }
        if (named != 1 || ports != 1) throw new AssertionError("Expected one named storage container and one attachment port");
        JsonObject result = new JsonObject(); result.addProperty("cells", checked); result.addProperty("namedContainers", named); result.addProperty("replacedPorts", ports);
        report.add("rotation:" + origin.getX(), result);
    }

    private void preview(Minecraft mc) throws Exception {
        if (!sceneReady) return;
        if (view >= 4) { finish(mc); return; }
        if (!cameraReady) {
            if (settle != 0) return;
            settle = 1;
            int selectedView = view;
            mc.getSingleplayerServer().execute(() -> {
                try {
                    var player = mc.getSingleplayerServer().getPlayerList().getPlayer(mc.player.getUUID());
                    int offset = (selectedView / 2) * 40;
                    boolean interior = selectedView % 2 == 1;
                    player.connection.teleport(offset + (interior ? templates.get(selectedView / 2).getSize().getX() / 2.0 : -12),
                        interior ? 104.4 : 113, interior ? 2.5 : -18, interior ? 0 : -32, interior ? 6 : 22);
                    cameraReady = true;
                } catch (Throwable failure) { serverFailure = failure; }
            });
            return;
        }
        if (++settle < 90) return;
        String name = "white-terrace-" + view + ".png";
        Screenshot.grab(root.toFile(), name, mc.getMainRenderTarget(), ignored -> {});
        JsonObject capture = new JsonObject();
        capture.addProperty("file", "screenshots/" + name);
        capture.addProperty("variant", variants.get(view / 2).get("id").getAsString());
        capture.addProperty("view", view % 2 == 0 ? "exterior" : "interior");
        captures.add(capture);
        view++;
        cameraReady = false;
        settle = 0;
    }

    private static void validatePalette(JsonObject entries) {
        for (var entry : entries.entrySet()) {
            Palette.valueOf(entry.getKey());
            JsonObject spec = entry.getValue().getAsJsonObject();
            ResourceLocation id = ResourceLocation.parse(spec.get("Name").getAsString());
            if (!BuiltInRegistries.BLOCK.containsKey(id)) throw new AssertionError("Missing palette block: " + id);
            BlockState state = BuiltInRegistries.BLOCK.get(id).defaultBlockState();
            if (spec.has("Properties")) for (var property : spec.getAsJsonObject("Properties").entrySet()) {
                Property<?> definition = state.getBlock().getStateDefinition().getProperty(property.getKey());
                if (definition == null || definition.getValue(property.getValue().getAsString()).isEmpty())
                    throw new AssertionError("Unknown palette property/value: " + id + " " + property);
            }
        }
    }

    private void finish(Minecraft mc) {
        done = true;
        try { Files.writeString(root.resolve("authoring-result.json"), new GsonBuilder().setPrettyPrinting().create().toJson(report) + "\n"); }
        catch (Exception failure) { throw new RuntimeException(failure); }
        if (mc.level != null) mc.level.disconnect();
        mc.disconnect();
        mc.stop();
    }
}
