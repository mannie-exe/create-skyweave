package audit.animation;

import audit.animation.mixin.NativeMouseInputInvoker;
import com.google.gson.*;
import com.github.ysbbbbbb.kaleidoscopetavern.item.ShakerItem;
import com.mojang.blaze3d.vertex.PoseStack;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import net.minecraft.client.*;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.client.model.HumanoidModel;
import net.minecraft.client.model.PlayerModel;
import net.minecraft.client.renderer.entity.LivingEntityRenderer;
import net.minecraft.client.resources.model.BakedModel;
import net.minecraft.core.registries.*;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.*;
import net.minecraft.world.entity.*;
import net.minecraft.world.item.*;
import net.minecraft.world.level.*;
import net.minecraft.world.level.levelgen.WorldOptions;
import net.neoforged.neoforge.client.event.*;
import net.neoforged.neoforge.client.extensions.common.IClientItemExtensions;
import net.neoforged.neoforge.common.NeoForge;
import net.neoforged.neoforge.items.ItemStackHandler;
import org.lwjgl.glfw.GLFW;

/** Marked native shaker action/provider observation. Storage setup is not a crafting/filling claim. */
public final class ShakerScene {
    private static final Gson JSON = new GsonBuilder().setPrettyPrinting().create();
    private static volatile ShakerScene active;
    private final Path root = Minecraft.getInstance().gameDirectory.toPath().toAbsolutePath().normalize();
    private final JsonObject result = new JsonObject();
    private final JsonArray states = new JsonArray(), models = new JsonArray(), poses = new JsonArray(), transforms = new JsonArray(), images = new JsonArray();
    private final Queue<JsonObject> actions = new ConcurrentLinkedQueue<>();
    private final Map<HumanoidModel<?>, Integer> modelIds = new IdentityHashMap<>();
    private final List<Case> cases = new ArrayList<>();
    private final List<String> errors = new ArrayList<>();
    private CompletableFuture<JsonObject> pending;
    private UUID playerId;
    private volatile Case selected;
    private int ticks, worldTicks, index = -1, step, age, frame, sequence, drops;
    private boolean opened, done, pressed;
    private String pendingShot;
    public ShakerScene() {
        require(Files.isRegularFile(root.resolve(".animation-audit")), "Owned marker");
        for (boolean first : List.of(true, false)) for (HumanoidArm arm : HumanoidArm.values()) cases.add(new Case(first, arm, "full", 45));
        for (String guard : List.of("empty", "partial", "result", "short")) cases.add(new Case(true, HumanoidArm.RIGHT, guard, guard.equals("short") ? 12 : 5));
        result.addProperty("scope", "Original mapped shaker use/release with filled-container setup, four main-hand view/arm contexts and empty/partial/result/short controls. No recipe-window/filling/pouring, offhand, reference fitting, moving/remote/shader acceptance.");
        result.addProperty("caseCount", cases.size()); active = this;
        NeoForge.EVENT_BUS.addListener(this::tick); NeoForge.EVENT_BUS.addListener(this::frame);
    }
    private void tick(ClientTickEvent.Post ignored) {
        Minecraft mc = Minecraft.getInstance(); if (done || mc.getOverlay() != null || ++ticks < 100) return;
        try {
            if (!opened && mc.screen instanceof TitleScreen) { opened = true; mc.tell(() -> mc.createWorldOpenFlows().createFreshLevel("animation-shaker-flat", new LevelSettings("Animation Shaker Audit", GameType.SURVIVAL, false, Difficulty.PEACEFUL, true, new GameRules(), WorldDataConfiguration.DEFAULT), new WorldOptions(1527L, false, false), r -> r.registryOrThrow(Registries.WORLD_PRESET).get(ResourceLocation.withDefaultNamespace("flat")).createWorldDimensions(), mc.screen)); return; }
            if (mc.player == null || mc.level == null || mc.getSingleplayerServer() == null || ++worldTicks < 40) return;
            if (playerId == null) { playerId = mc.player.getUUID(); GLFW.glfwFocusWindow(mc.getWindow().getWindow()); boolean actualPunchy = (Boolean)Class.forName("punchy.config.PunchyConfig").getMethod("isModEnabled").invoke(null); result.addProperty("actualPunchyEnabled", actualPunchy); require(actualPunchy == JsonParser.parseString(Files.readString(root.resolve("animation-shaker.json"))).getAsJsonObject().get("expectedPunchy").getAsBoolean(), "Actual Punchy enable-state admission"); Item scroll = item("yigd:death_scroll"); result.addProperty("deathScrollEnabledAtNativeWorld", scroll.isEnabled(mc.level.enabledFeatures())); require(!scroll.isEnabled(mc.level.enabledFeatures()), "Pinned disabled death-scroll admission"); result.add("activePacks", JSON.toJsonTree(mc.getResourceManager().listPacks().map(p -> p.packId()).toList())); }
            if (selected == null) { next(mc); return; }
            require(++age < 180, "Shaker stage bound " + selected.name() + "/" + step);
            if (step == 0 && take()) { step++; age = 0; }
            else if (step == 1 && age >= 25) { require(held().getItem() instanceof ShakerItem, "Native shaker sync"); require(IClientItemExtensions.of(held()).getClass().getName().equals("com.github.ysbbbbbb.kaleidoscopetavern.client.animation.ShakerAnimation$ShakerExtensions"), "Actual registered native extensions"); mc.gui.getChat().clearMessages(false); mc.getToasts().clear(); shot("held"); step++; age = 0; }
            else if (step == 2 && pendingShot == null) { use(true); step++; age = 0; }
            else if (step == 3) {
                if (age == Math.min(selected.hold - 2, 15)) { if (selected.guard.equals("full") || selected.guard.equals("short")) require(mc.player.isUsingItem(), "Native shaker use began"); else require(!mc.player.isUsingItem(), "Native shaker refused use"); shot("action"); }
                if (age >= selected.hold) { use(false); step++; age = 0; }
            } else if (step == 4 && age >= 8 && !mc.player.isUsingItem()) { request("after"); step = 6; age = 0; }
            else if (step == 6 && pendingShot == null && take()) { JsonObject after = states.get(states.size() - 1).getAsJsonObject(); String expected = selected.guard.equals("full") || selected.guard.equals("result") ? "kaleidoscope_tavern:mystery_cocktail" : "minecraft:air"; require(after.get("result").getAsString().equals(expected), "Native result branch"); require(after.get("storedCount").getAsInt() == (selected.guard.equals("empty") ? 0 : selected.guard.equals("partial") ? 1 : 3), "Stored ingredients preserved until pour"); shot("after"); step = 5; age = 0; }
            else if (step == 5 && age >= 8 && pendingShot == null) next(mc);
        } catch (Throwable failure) { errors.add(failure.toString()); finish(mc); }
    }
    private void next(Minecraft mc) {
        if (++index == cases.size()) { finish(mc); return; } selected = cases.get(index); step = age = 0; mc.options.mainHand().set(selected.arm); mc.player.setMainArm(selected.arm); mc.options.setCameraType(selected.first ? CameraType.FIRST_PERSON : CameraType.THIRD_PERSON_FRONT); mc.options.hideGui = false;
        Case current = selected; var server = mc.getSingleplayerServer(); pending = server.submit(() -> { ServerPlayer p = Objects.requireNonNull(server.getPlayerList().getPlayer(playerId)); p.stopUsingItem(); p.getInventory().clearContent(); p.getInventory().selected = 0; p.setMainArm(current.arm); p.connection.teleport(p.getX(), p.getY(), p.getZ(), 0, 0);
            ItemStack stack = new ItemStack(item("kaleidoscope_tavern:shaker")); if (!current.guard.equals("empty")) { ItemStackHandler storage = new ItemStackHandler(3); int count = current.guard.equals("partial") ? 1 : 3; for (int i = 0; i < count; i++) storage.setStackInSlot(i, new ItemStack(item("kaleidoscope_tavern:wine"))); ShakerItem.setStorage(stack, storage); } if (current.guard.equals("result")) ShakerItem.setResult(stack, new ItemStack(item("kaleidoscope_tavern:mystery_cocktail"))); p.setItemInHand(InteractionHand.MAIN_HAND, stack); p.inventoryMenu.broadcastChanges(); return snapshot(p, current, "seeded"); });
    }
    private static Item item(String id) { return BuiltInRegistries.ITEM.get(ResourceLocation.parse(id)); }
    private ItemStack held() { return Minecraft.getInstance().player.getMainHandItem(); }
    private JsonObject snapshot(ServerPlayer p, Case current, String stage) { ItemStack stack = p.getMainHandItem(); JsonObject row = new JsonObject(); row.addProperty("case", current.name()); row.addProperty("stage", stage); row.addProperty("nanos", System.nanoTime()); row.addProperty("serverTick", p.server.getTickCount()); row.addProperty("result", BuiltInRegistries.ITEM.getKey(ShakerItem.getResult(stack).getItem()).toString()); ItemStackHandler storage = ShakerItem.getStorage(stack); int count = 0; List<String> contents = new ArrayList<>(); for (int i = 0; i < storage.getSlots(); i++) { ItemStack value = storage.getStackInSlot(i); count += value.getCount(); contents.add(BuiltInRegistries.ITEM.getKey(value.getItem()).toString()); } row.addProperty("storedCount", count); row.add("storage", JSON.toJsonTree(contents)); return row; }
    private void request(String stage) { Case current = selected; var server = Minecraft.getInstance().getSingleplayerServer(); pending = server.submit(() -> snapshot(Objects.requireNonNull(server.getPlayerList().getPlayer(playerId)), current, stage)); }
    private boolean take() { if (pending == null || !pending.isDone()) return false; states.add(pending.join()); pending = null; return true; }
    private JsonObject state() { Minecraft mc = Minecraft.getInstance(); JsonObject row = new JsonObject(); row.addProperty("case", selected.name()); row.addProperty("step", step); row.addProperty("age", age); row.addProperty("frame", frame); row.addProperty("using", mc.player.isUsingItem()); row.addProperty("useTicks", mc.player.getTicksUsingItem()); row.addProperty("remaining", mc.player.getUseItemRemainingTicks()); row.addProperty("cameraType", mc.options.getCameraType().name()); return row; }
    private void shot(String label) { require(pendingShot == null, "Pending screenshot"); pendingShot = selected.name() + "-" + label; }
    private void frame(RenderFrameEvent.Post ignored) { frame++; if (done || pendingShot == null || Minecraft.getInstance().player == null) return; String name = pendingShot; pendingShot = null; var mc = Minecraft.getInstance(); Screenshot.grab(root.toFile(), name + ".png", mc.getMainRenderTarget(), message -> {}); JsonObject row = state(); row.addProperty("file", "screenshots/" + name + ".png"); images.add(row); }
    private void use(boolean down) { Minecraft mc = Minecraft.getInstance(); ((NativeMouseInputInvoker)mc.mouseHandler).animationAudit$mousePress(mc.getWindow().getWindow(), GLFW.GLFW_MOUSE_BUTTON_RIGHT, down ? GLFW.GLFW_PRESS : GLFW.GLFW_RELEASE, 0); pressed = down; }
    private void finish(Minecraft mc) { if (done) return; if (pressed) use(false); done = true; result.addProperty("completedCases", index); result.addProperty("traceDrops", drops); result.add("errors", JSON.toJsonTree(errors)); result.add("states", states); result.add("models", models); result.add("poses", poses); result.add("handTransforms", transforms); result.add("images", images); result.add("actions", JSON.toJsonTree(actions)); try { Files.writeString(root.resolve("shaker-result.json"), JSON.toJson(result)); } catch (Exception failure) { throw new IllegalStateException(failure); } mc.tell(mc::stop); }
    public static void action(String label, ItemStack stack, Level level, LivingEntity actor, InteractionHand hand, int remaining, String outcome) { ShakerScene s = active; if (s == null || s.done || s.selected == null || !actor.getUUID().equals(s.playerId)) return; JsonObject row = new JsonObject(); row.addProperty("case", s.selected.name()); row.addProperty("event", label); row.addProperty("side", level.isClientSide ? "client" : "server"); row.addProperty("actorTick", actor.tickCount); row.addProperty("nanos", System.nanoTime()); row.addProperty("nativeResult", BuiltInRegistries.ITEM.getKey(ShakerItem.getResult(stack).getItem()).toString()); row.addProperty("remainingArgument", remaining); row.addProperty("usingTicks", actor.getTicksUsingItem()); row.addProperty("duration", stack.getUseDuration(actor)); row.addProperty("outcome", outcome); row.addProperty("hand", hand == null ? null : hand.name()); if (s.actions.size() < 1000) s.actions.add(row); else s.drops++; }
    public static void pose(String stage, HumanoidModel<?> model, LivingEntity actor) { ShakerScene s = active; if (s == null || s.done || s.selected == null || actor != Minecraft.getInstance().player || !(model instanceof PlayerModel<?>)) return; JsonObject row = s.state(); row.addProperty("stage", stage); row.addProperty("modelId", s.modelIds.computeIfAbsent(model, ignored -> s.modelIds.size() + 1)); row.addProperty("sequence", ++s.sequence); row.add("rightArm", JSON.toJsonTree(new float[]{model.rightArm.xRot, model.rightArm.yRot, model.rightArm.zRot})); row.add("leftArm", JSON.toJsonTree(new float[]{model.leftArm.xRot, model.leftArm.yRot, model.leftArm.zRot})); if (s.poses.size() < 12000) s.poses.add(row); else s.drops++; }
    public static void body(LivingEntityRenderer<?, ?> renderer, LivingEntity entity) { if (renderer.getModel() instanceof HumanoidModel<?> model) pose("body-final", model, entity); }
    public static void model(ItemStack stack, ItemDisplayContext context, PoseStack matrix, BakedModel model) { ShakerScene s = active; if (s == null || s.done || s.selected == null || !(stack.getItem() instanceof ShakerItem)) return; JsonObject row = s.state(); row.addProperty("context", context.name()); row.addProperty("custom", model.isCustomRenderer()); row.add("matrix", JSON.toJsonTree(matrix.last().pose().get(new float[16]))); if (s.models.size() < 6000) s.models.add(row); else s.drops++; }
    public static void handTransform(String stage, LivingEntity actor, HumanoidArm arm, PoseStack matrix, Boolean accepted) { ShakerScene s = active; if (s == null || s.done || s.selected == null || actor != Minecraft.getInstance().player) return; JsonObject row = s.state(); row.addProperty("stage", stage); row.addProperty("arm", arm.name()); row.addProperty("accepted", accepted); row.add("matrix", JSON.toJsonTree(matrix.last().pose().get(new float[16]))); if (s.transforms.size() < 6000) s.transforms.add(row); else s.drops++; }
    private static void require(boolean ok, String message) { if (!ok) throw new IllegalStateException(message); }
    private record Case(boolean first, HumanoidArm arm, String guard, int hold) { String name() { return (first ? "first" : "third") + "-" + arm.name().toLowerCase(Locale.ROOT) + "-" + guard; } }
}
