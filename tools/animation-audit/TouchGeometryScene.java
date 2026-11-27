package audit.animation;

import com.google.gson.*;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.core.*;
import net.minecraft.core.registries.*;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.Difficulty;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.item.*;
import net.minecraft.world.level.*;
import net.minecraft.world.level.block.*;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.levelgen.WorldOptions;
import net.minecraft.world.phys.*;
import net.neoforged.neoforge.client.event.ClientTickEvent;
import net.neoforged.neoforge.common.NeoForge;

/** Real placed-block and native ray/hover observations, never a distributed adaptation. */
public final class TouchGeometryScene {
    private final Minecraft mc = Minecraft.getInstance();
    private final JsonObject result = new JsonObject();
    private final JsonArray rows = new JsonArray();
    private final LinkedHashMap<BlockPos, String> placed = new LinkedHashMap<>();
    private CompletableFuture<Void> placement;
    private boolean opened, done;
    private int ticks, joined;

    TouchGeometryScene() { result.add("rows", rows); NeoForge.EVENT_BUS.addListener(this::tick); }

    private void tick(ClientTickEvent.Post event) {
        if (done) return;
        try {
            if (++ticks > 2400) throw new IllegalStateException("Touch geometry fixture exceeded tick bound");
            if (!opened && mc.screen instanceof TitleScreen && mc.getOverlay() == null) {
                opened = true;
                mc.tell(() -> mc.createWorldOpenFlows().createFreshLevel("animation-touch-flat",
                    new LevelSettings("Touch geometry audit", GameType.CREATIVE, false, Difficulty.PEACEFUL,
                        true, new GameRules(), WorldDataConfiguration.DEFAULT), new WorldOptions(1527L, false, false),
                    registries -> registries.registryOrThrow(Registries.WORLD_PRESET)
                        .get(ResourceLocation.withDefaultNamespace("flat")).createWorldDimensions(), mc.screen));
                return;
            }
            if (mc.level == null || mc.player == null || mc.getSingleplayerServer() == null
                    || mc.screen != null || mc.getOverlay() != null || ++joined < 60) return;
            if (placement == null) {
                int y = mc.player.blockPosition().getY() + 1;
                int x = mc.player.blockPosition().getX(), z = mc.player.blockPosition().getZ();
                placed.put(new BlockPos(x, y, z), "minecraft:chest");
                placed.put(new BlockPos(x + 3, y, z), "create:shaft");
                placed.put(new BlockPos(x + 6, y, z), "create:smart_chute");
                placed.put(new BlockPos(x + 9, y, z), "create:rotation_speed_controller");
                placed.put(new BlockPos(x + 12, y, z), "create:linear_chassis");
                var server = mc.getSingleplayerServer();
                placement = CompletableFuture.runAsync(() -> {
                    var level = server.overworld();
                    placed.forEach((pos, id) -> {
                        Block block = BuiltInRegistries.BLOCK.getOptional(ResourceLocation.parse(id)).orElseThrow();
                        level.setBlock(pos.below(), Blocks.STONE.defaultBlockState(), 3);
                        level.setBlock(pos, block.defaultBlockState(), 3);
                    });
                }, server);
                return;
            }
            if (!placement.isDone() || joined < 100) return;
            placement.join();
            for (var entry : placed.entrySet()) {
                if (!BuiltInRegistries.BLOCK.getKey(mc.level.getBlockState(entry.getKey()).getBlock()).toString()
                        .equals(entry.getValue()) || mc.level.getBlockEntity(entry.getKey()) == null)
                    throw new IllegalStateException("Placed block/entity not synchronized: " + entry.getValue());
            }
            inspect();
            finish("completed", null);
        } catch (Throwable failure) { finish("failed", failure); }
    }

    private void inspect() throws Exception {
        Class<?> providerClass = Class.forName("strm.touchnmotion.blockuse.create.ValuePanel");
        Class<?> playerClass = Class.forName("net.minecraft.client.player.AbstractClientPlayer");
        Object provider = providerClass.getConstructor().newInstance();
        Method matches = providerClass.getMethod("matches", BlockState.class);
        Method hover = providerClass.getMethod("hover", playerClass, BlockPos.class, BlockState.class, BlockHitResult.class);
        Class<?> settings = Class.forName("com.simibubi.create.foundation.blockEntity.behaviour.ValueSettingsBehaviour");
        Class<?> smart = Class.forName("com.simibubi.create.foundation.blockEntity.SmartBlockEntity");
        Class<?> slotClass = Class.forName("com.simibubi.create.foundation.blockEntity.behaviour.ValueBoxTransform");
        Class<?> sided = Class.forName("com.simibubi.create.foundation.blockEntity.behaviour.ValueBoxTransform$Sided");
        Method sideActive = sided.getDeclaredMethod("isSideActive", BlockState.class, Direction.class);
        sideActive.setAccessible(true);
        for (var entry : placed.entrySet()) {
            BlockPos pos = entry.getKey();
            BlockState state = mc.level.getBlockState(pos);
            Object entity = mc.level.getBlockEntity(pos);
            JsonObject row = new JsonObject();
            row.addProperty("id", entry.getValue());
            row.addProperty("entityClass", entity.getClass().getName());
            row.addProperty("predicateMatches", (Boolean) matches.invoke(provider, state));
            row.addProperty("smartEntity", smart.isInstance(entity));
            JsonArray behaviours = new JsonArray(), targets = new JsonArray();
            row.add("behaviours", behaviours); row.add("targets", targets);
            rows.add(row);
            Collection<?> all = smart.isInstance(entity)
                ? (Collection<?>) smart.getMethod("getAllBehaviours").invoke(entity) : List.of();
            for (Object behaviour : all) {
                JsonObject info = new JsonObject();
                info.addProperty("class", behaviour.getClass().getName());
                info.addProperty("valueSettings", settings.isInstance(behaviour));
                behaviours.add(info);
                if (!settings.isInstance(behaviour)) continue;
                info.addProperty("active", (Boolean) settings.getMethod("isActive").invoke(behaviour));
                info.addProperty("wrenchOnly", (Boolean) settings.getMethod("onlyVisibleWithWrench").invoke(behaviour));
                Object slot = settings.getMethod("getSlotPositioning").invoke(behaviour);
                if (slot == null) continue;
                for (Direction face : Direction.values()) {
                    if (sided.isInstance(slot)) {
                        if (!(Boolean) sideActive.invoke(slot, state, face)) continue;
                        sided.getMethod("fromSide", Direction.class).invoke(slot, face);
                    }
                    Vec3 offset = (Vec3) slotClass.getMethod("getLocalOffset", LevelAccessor.class, BlockPos.class, BlockState.class)
                        .invoke(slot, mc.level, pos, state);
                    if (offset == null) continue;
                    Vec3 target = Vec3.atLowerCornerOf(pos).add(offset);
                    for (boolean wrench : List.of(false, true)) {
                        ItemStack hand = wrench ? new ItemStack(BuiltInRegistries.ITEM.getOptional(ResourceLocation.parse("create:wrench")).orElseThrow()) : ItemStack.EMPTY;
                        mc.player.setItemInHand(InteractionHand.MAIN_HAND, hand);
                        targets.add(observeRay(provider, hover, behaviour, settings, pos, state, face, target, wrench, false));
                        targets.add(observeRay(provider, hover, behaviour, settings, pos, state, face, target, wrench, true));
                    }
                }
            }
            // Every predicate match receives an actual central native ray, even with no value behaviour.
            mc.player.setItemInHand(InteractionHand.MAIN_HAND, ItemStack.EMPTY);
            targets.add(observeRay(provider, hover, null, settings, pos, state, Direction.NORTH, Vec3.atCenterOf(pos), false, false));
        }
        result.addProperty("scope", "Placed/synchronized actual block entities; native outline ray from positioned local player; actual ValuePanel.hover. Target geometry only, no rendered hand/click/gesture acceptance.");
        result.add("rows", rows);
        JsonObject mods = new JsonObject();
        net.neoforged.fml.ModList.get().getMods().forEach(mod -> mods.addProperty(mod.getModId(), mod.getVersion().toString()));
        result.add("mods", mods);
    }

    private JsonObject observeRay(Object provider, Method hover, Object behaviour, Class<?> settings,
            BlockPos pos, BlockState state, Direction intendedFace, Vec3 target, boolean wrench, boolean miss) throws Exception {
        Vec3 normal = Vec3.atLowerCornerOf(intendedFace.getNormal());
        Vec3 eye = target.add(normal.scale(2));
        mc.player.setPos(eye.x, eye.y - mc.player.getEyeHeight(), eye.z);
        mc.player.setOldPosAndRot();
        Vec3 actualEye = mc.player.getEyePosition();
        Vec3 end = miss ? target.add(0, 3, 0) : target.subtract(normal.scale(.6));
        BlockHitResult hit = mc.level.clip(new ClipContext(actualEye, end, ClipContext.Block.OUTLINE, ClipContext.Fluid.NONE, mc.player));
        mc.hitResult = hit;
        Object spot = hover.invoke(provider, mc.player, pos, state, hit);
        JsonObject row = new JsonObject();
        row.addProperty("behaviour", behaviour == null ? null : behaviour.getClass().getName());
        row.addProperty("intendedFace", intendedFace.name()); row.addProperty("wrench", wrench); row.addProperty("missControl", miss);
        row.addProperty("hitType", hit.getType().name()); row.addProperty("hitBlock", hit.getBlockPos().toShortString());
        row.addProperty("sameBlock", hit.getBlockPos().equals(pos)); row.addProperty("hitFace", hit.getDirection().name());
        row.add("eye", vector(actualEye)); row.add("slotTarget", vector(target)); row.add("hit", vector(hit.getLocation()));
        row.addProperty("nativeTestHit", behaviour == null ? false : (Boolean) settings.getMethod("testHit", Vec3.class).invoke(behaviour, hit.getLocation()));
        row.addProperty("hoverSpot", spot != null);
        if (spot != null) {
            row.add("spot", vector((Vec3) spot.getClass().getMethod("point").invoke(spot)));
            row.add("out", vector((Vec3) spot.getClass().getMethod("out").invoke(spot)));
        }
        return row;
    }

    private static JsonArray vector(Vec3 v) { JsonArray a = new JsonArray(); a.add(v.x);a.add(v.y);a.add(v.z);return a; }

    private void finish(String status, Throwable failure) {
        if (done) return;
        done = true;
        result.addProperty("status", status); result.addProperty("clientTicks", ticks);
        if (failure != null) { result.addProperty("failure", failure.toString()); failure.printStackTrace(); }
        try { Files.writeString(mc.gameDirectory.toPath().resolve("touch-geometry-result.json"), new GsonBuilder().setPrettyPrinting().create().toJson(result)); }
        catch (Exception write) { throw new RuntimeException(write); }
        mc.tell(mc::stop);
    }
}
