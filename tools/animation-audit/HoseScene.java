package audit.animation;

import audit.animation.mixin.NativeMouseInputInvoker;
import com.google.gson.*;
import com.mojang.blaze3d.vertex.PoseStack;
import com.tiviacz.travelersbackpack.capability.AttachmentUtils;
import com.tiviacz.travelersbackpack.init.*;
import com.tiviacz.travelersbackpack.inventory.BackpackWrapper;
import com.tiviacz.travelersbackpack.inventory.upgrades.tanks.TanksUpgrade;
import com.tiviacz.travelersbackpack.items.HoseItem;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import net.minecraft.client.*;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.client.resources.model.BakedModel;
import net.minecraft.client.model.HumanoidModel;
import net.minecraft.client.model.PlayerModel;
import net.minecraft.client.renderer.entity.LivingEntityRenderer;
import net.minecraft.core.*;
import net.minecraft.core.registries.*;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.*;
import net.minecraft.world.entity.*;
import net.minecraft.world.item.*;
import net.minecraft.world.level.*;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.levelgen.WorldOptions;
import net.minecraft.world.level.material.Fluids;
import net.neoforged.neoforge.client.event.*;
import net.neoforged.neoforge.common.NeoForge;
import net.neoforged.neoforge.fluids.FluidStack;
import net.neoforged.neoforge.fluids.capability.IFluidHandler.FluidAction;
import org.lwjgl.glfw.GLFW;
import top.theillusivec4.curios.api.CuriosApi;

/** Owned inventory/world setup, original mapped inputs/actions. No forced continuous use or pose writes. */
public final class HoseScene {
    private static final Gson JSON = new GsonBuilder().setPrettyPrinting().create();
    private static volatile HoseScene active;
    private final Path root = Minecraft.getInstance().gameDirectory.toPath().toAbsolutePath().normalize();
    private final JsonObject result = new JsonObject();
    private final JsonArray states = new JsonArray(), draws = new JsonArray(), images = new JsonArray();
    private final JsonArray poses = new JsonArray(), consumes = new JsonArray();
    private final Map<HumanoidModel<?>, Integer> modelIds = new IdentityHashMap<>();
    private final Queue<JsonObject> events = new ConcurrentLinkedQueue<>();
    private final List<Case> cases = new ArrayList<>();
    private final List<String> errors = new ArrayList<>();
    private volatile Case selected;
    private UUID actor;
    private CompletableFuture<JsonObject> pending;
    private JsonObject seeded;
    private BlockPos target;
    private boolean opened, done, pressed;
    private int ticks, worldTicks, index = -1, step, age, frame, drops, poseSequence;
    private String pendingShot;
    public HoseScene() {
        require(Files.isRegularFile(root.resolve(".animation-audit")), "Owned marker");
        for (boolean first : List.of(true, false)) for (HumanoidArm arm : HumanoidArm.values()) for (int mode : List.of(1, 2, 3)) cases.add(new Case(mode, first, arm, "positive"));
        for (String guard : List.of("no-backpack", "no-upgrade", "empty-drink", "off-hand")) cases.add(new Case(3, true, HumanoidArm.RIGHT, guard));
        result.addProperty("scope", "Native water pickup/spill/drink using original main-hand actions; four admission negatives. Inventory/Curios/upgrade/fluid setup is not manual equipping/crafting, mode-key or other fluid/provider acceptance.");
        result.addProperty("caseCount", cases.size()); active = this;
        NeoForge.EVENT_BUS.addListener(this::tick); NeoForge.EVENT_BUS.addListener(this::frame);
    }
    private void tick(ClientTickEvent.Post ignored) {
        Minecraft mc = Minecraft.getInstance(); if (done || mc.getOverlay() != null || ++ticks < 100) return;
        try {
            if (!opened && mc.screen instanceof TitleScreen) { opened = true; mc.tell(() -> mc.createWorldOpenFlows().createFreshLevel("animation-hose-flat", new LevelSettings("Animation Hose Audit", GameType.SURVIVAL, false, Difficulty.PEACEFUL, true, new GameRules(), WorldDataConfiguration.DEFAULT), new WorldOptions(1527L, false, false), r -> r.registryOrThrow(Registries.WORLD_PRESET).get(ResourceLocation.withDefaultNamespace("flat")).createWorldDimensions(), mc.screen)); return; }
            if (mc.player == null || mc.level == null || mc.getSingleplayerServer() == null || ++worldTicks < 40) return;
            if (actor == null) { actor = mc.player.getUUID(); GLFW.glfwFocusWindow(mc.getWindow().getWindow()); result.add("activePacks", JSON.toJsonTree(mc.getResourceManager().listPacks().map(p -> p.packId()).toList())); }
            if (selected == null) { next(mc); return; }
            require(++age < 180, "Hose stage bound: " + selected.name() + "/" + step);
            if (selected.mode == 3 && step == 3) action("clientTick", held(), mc.level, mc.player, null, null);
            if (step == 0 && take()) { seeded = states.get(states.size() - 1).getAsJsonObject(); step++; age = 0; }
            else if (step == 1 && age >= 30) {
                require(held().getItem() instanceof HoseItem && HoseItem.getHoseMode(held()) == selected.mode, "Native client mode sync");
                require(AttachmentUtils.isWearingBackpack(mc.player) == !selected.guard.equals("no-backpack"), "Native client equipment sync");
                mc.gui.getChat().clearMessages(false); mc.getToasts().clear(); shot("held"); step++; age = 0;
            } else if (step == 2 && pendingShot == null) { use(true); step++; age = 0; }
            else if (step == 3) {
                if (selected.mode != 3 || !selected.positive()) { if (age == 1) use(false); if (age >= 8) { shot("action"); request("after"); step++; age = 0; } }
                else { if (age == 10) { require(mc.player.isUsingItem(), "Native drink started"); shot("drinking"); } if (age >= 28) { use(false); request("after"); step++; age = 0; } }
            } else if (step == 4 && pendingShot == null && take()) { JsonObject after = states.get(states.size() - 1).getAsJsonObject();
                if (selected.positive()) { int expected = selected.mode == 1 ? 1000 : 0; require(after.get("leftAmount").getAsInt() == expected, "Native selected tank outcome"); require(after.get("rightAmount").getAsInt() == 250, "Unselected tank preserved"); if (selected.mode < 3) require(after.get("sourceWater").getAsBoolean() == (selected.mode == 2), "Native world fluid outcome"); }
                else require(after.get("leftAmount").getAsInt() == seeded.get("leftAmount").getAsInt(), "Refused action preserves fluid");
                shot("after"); step++; age = 0;
            } else if (step == 5 && age >= 8 && pendingShot == null) next(mc);
        } catch (Throwable failure) { errors.add(failure.toString()); finish(mc); }
    }
    private void next(Minecraft mc) {
        if (++index == cases.size()) { finish(mc); return; } selected = cases.get(index); step = age = 0;
        mc.options.mainHand().set(selected.arm); mc.player.setMainArm(selected.arm); mc.options.setCameraType(selected.first ? CameraType.FIRST_PERSON : CameraType.THIRD_PERSON_FRONT); mc.options.hideGui = false;
        Case current = selected; var server = mc.getSingleplayerServer();
        pending = server.submit(() -> { ServerPlayer p = Objects.requireNonNull(server.getPlayerList().getPlayer(actor)); p.stopUsingItem(); p.getInventory().clearContent(); p.getInventory().selected = 0; p.setMainArm(current.arm); p.clearFire();
            var back = CuriosApi.getCuriosInventory(p).orElseThrow().getCurios().get("back"); require(back != null && back.getStacks().getSlots() > 0, "Authored native Curios back slot"); back.getStacks().setStackInSlot(0, ItemStack.EMPTY);
            if (!current.guard.equals("no-backpack")) { ItemStack backpack = new ItemStack(ModItems.STANDARD_TRAVELERS_BACKPACK.get()); BackpackWrapper.initializeSize(backpack); back.getStacks().setStackInSlot(0, backpack); require(AttachmentUtils.isWearingBackpack(p), "Native equipped backpack"); BackpackWrapper wrapper = AttachmentUtils.getBackpackWrapper(p, AttachmentUtils.LOAD_ALL.get());
                if (!current.guard.equals("no-upgrade")) { wrapper.getUpgrades().setStackInSlot(0, new ItemStack(ModItems.TANKS_UPGRADE.get())); var tank = wrapper.getUpgradeManager().getUpgrade(TanksUpgrade.class).orElseThrow(); if (current.mode != 1 && !current.guard.equals("empty-drink")) tank.getLeftTank().fill(new FluidStack(Fluids.WATER, 1000), FluidAction.EXECUTE); tank.getRightTank().fill(new FluidStack(Fluids.WATER, 250), FluidAction.EXECUTE); }
            }
            ItemStack hose = new ItemStack(ModItems.HOSE.get()); hose.set(ModDataComponents.HOSE_MODES.get(), List.of(current.mode, 1)); p.setItemInHand(current.guard.equals("off-hand") ? InteractionHand.OFF_HAND : InteractionHand.MAIN_HAND, hose);
            target = p.blockPosition().offset(0, 0, 2); for (int y = 0; y < 3; y++) p.serverLevel().setBlock(target.above(y), Blocks.AIR.defaultBlockState(), 3); p.serverLevel().setBlock(target.below(), Blocks.STONE.defaultBlockState(), 3); p.serverLevel().setBlock(target, current.mode == 1 ? Blocks.WATER.defaultBlockState() : Blocks.AIR.defaultBlockState(), 3);
            if (current.mode == 3) { p.setXRot(0); p.setYRot(0); } else { var aim = current.mode == 2 ? target.getCenter().add(0, -0.5, 0) : target.getCenter(); var delta = aim.subtract(p.getEyePosition()); p.setYRot((float)Math.toDegrees(Math.atan2(-delta.x, delta.z))); p.setXRot((float)-Math.toDegrees(Math.atan2(delta.y, Math.sqrt(delta.x * delta.x + delta.z * delta.z)))); }
            p.connection.teleport(p.getX(), p.getY(), p.getZ(), p.getYRot(), p.getXRot()); p.inventoryMenu.broadcastChanges(); return snapshot(p, current, "seeded"); });
    }
    private static JsonObject snapshot(ServerPlayer p, Case current, String stage) { JsonObject row = new JsonObject(); row.addProperty("case", current.name()); row.addProperty("stage", stage); row.addProperty("serverTick", p.server.getTickCount()); row.addProperty("actorTick", p.tickCount); row.addProperty("wearing", AttachmentUtils.isWearingBackpack(p)); int left = 0, right = 0; boolean upgrade = false;
        if (AttachmentUtils.isWearingBackpack(p)) { var tanks = AttachmentUtils.getBackpackWrapper(p, AttachmentUtils.UPGRADES_ONLY.get()).getUpgradeManager().getUpgrade(TanksUpgrade.class); if (tanks.isPresent()) { upgrade = true; left = tanks.get().getLeftTank().getFluidAmount(); right = tanks.get().getRightTank().getFluidAmount(); } }
        row.addProperty("upgrade", upgrade); row.addProperty("leftAmount", left); row.addProperty("rightAmount", right); row.addProperty("using", p.isUsingItem()); row.addProperty("useTicks", p.getTicksUsingItem()); row.addProperty("sourceWater", p.serverLevel().getFluidState(active.target).isSourceOfType(Fluids.WATER)); return row;
    }
    private void request(String label) { Case current = selected; var server = Minecraft.getInstance().getSingleplayerServer(); pending = server.submit(() -> snapshot(Objects.requireNonNull(server.getPlayerList().getPlayer(actor)), current, label)); }
    private boolean take() { if (pending == null || !pending.isDone()) return false; states.add(pending.join()); pending = null; return true; }
    private ItemStack held() { var p = Minecraft.getInstance().player; return p.getItemInHand(selected.guard.equals("off-hand") ? InteractionHand.OFF_HAND : InteractionHand.MAIN_HAND); }
    private JsonObject state() { Minecraft mc = Minecraft.getInstance(); JsonObject row = new JsonObject(); row.addProperty("case", selected.name()); row.addProperty("step", step); row.addProperty("age", age); row.addProperty("frame", frame); row.addProperty("clientTick", mc.player.tickCount); row.addProperty("using", mc.player.isUsingItem()); row.addProperty("useTicks", mc.player.getTicksUsingItem()); row.addProperty("useAnimation", held().getUseAnimation().name()); row.addProperty("mode", HoseItem.getHoseMode(held())); return row; }
    private void shot(String label) { require(pendingShot == null, "Pending screenshot"); pendingShot = selected.name() + "-" + label; }
    private void frame(RenderFrameEvent.Post ignored) { frame++; if (done || pendingShot == null || Minecraft.getInstance().player == null) return; String name = pendingShot; pendingShot = null; var mc = Minecraft.getInstance(); Screenshot.grab(root.toFile(), name + ".png", mc.getMainRenderTarget(), message -> {}); JsonObject row = state(); row.addProperty("file", "screenshots/" + name + ".png"); images.add(row); }
    private void use(boolean down) { Minecraft mc = Minecraft.getInstance(); ((NativeMouseInputInvoker)mc.mouseHandler).animationAudit$mousePress(mc.getWindow().getWindow(), GLFW.GLFW_MOUSE_BUTTON_RIGHT, down ? GLFW.GLFW_PRESS : GLFW.GLFW_RELEASE, 0); pressed = down; }
    private void finish(Minecraft mc) { if (done) return; if (pressed) use(false); done = true; result.addProperty("completedCases", index); result.addProperty("traceDrops", drops); result.add("errors", JSON.toJsonTree(errors)); result.add("states", states); result.add("draws", draws); result.add("images", images); result.add("events", JSON.toJsonTree(events)); result.add("poseStages", poses); result.add("consumeStates", consumes); try { Files.writeString(root.resolve("hose-result.json"), JSON.toJson(result)); } catch (Exception failure) { throw new IllegalStateException(failure); } mc.tell(mc::stop); }
    public static void model(ItemStack stack, ItemDisplayContext context, PoseStack poses, BakedModel model) { HoseScene s = active; if (s == null || s.done || s.selected == null || !(stack.getItem() instanceof HoseItem)) return; JsonObject row = s.state(); row.addProperty("context", context.name()); row.addProperty("custom", model.isCustomRenderer()); row.addProperty("sprite", model.getParticleIcon().contents().name().toString()); row.add("matrix", JSON.toJsonTree(poses.last().pose().get(new float[16]))); if (s.draws.size() < 12000) s.draws.add(row); else s.drops++; }
    public static void action(String label, ItemStack stack, Level level, LivingEntity entity, InteractionHand hand, String outcome) { HoseScene s = active; if (s == null || s.done || s.selected == null || !entity.getUUID().equals(s.actor)) return; JsonObject row = new JsonObject(); row.addProperty("case", s.selected.name()); row.addProperty("event", label); row.addProperty("side", level.isClientSide ? "client" : "server"); row.addProperty("actorTick", entity.tickCount); row.addProperty("nanos", System.nanoTime()); row.addProperty("using", entity.isUsingItem()); row.addProperty("useTicks", entity.getTicksUsingItem()); row.addProperty("remaining", entity.getUseItemRemainingTicks()); row.addProperty("mode", HoseItem.getHoseMode(stack)); row.addProperty("hand", hand == null ? null : hand.name()); row.addProperty("outcome", outcome); if (label.startsWith("finish")) row.add("callers", JSON.toJsonTree(StackWalker.getInstance().walk(frames -> frames.limit(20).map(f -> f.getClassName() + "." + f.getMethodName()).toList()))); if (s.events.size() < 2000) s.events.add(row); else s.drops++; }
    public static void entityEvent(String stage, net.minecraft.world.entity.player.Player player, byte event) { if (event == 9) action(stage, player.getMainHandItem(), player.level(), player, null, "entityEvent9"); }
    public static void packetSent(net.minecraft.network.protocol.Packet<?> packet) { HoseScene s = active; if (s == null || s.done || s.selected == null || !(packet instanceof net.minecraft.network.protocol.game.ClientboundEntityEventPacket event) || event.getEventId() != 9) return; var server = Minecraft.getInstance().getSingleplayerServer(); if (server == null || s.actor == null) return; ServerPlayer player = server.getPlayerList().getPlayer(s.actor); if (player != null && event.getEntity(player.level()) == player) action("serverSendEvent9", player.getMainHandItem(), player.level(), player, null, "entityEvent9"); }
    public static void pose(String stage, HumanoidModel<?> model, LivingEntity entity) { HoseScene s = active; if (s == null || s.done || s.selected == null || entity != Minecraft.getInstance().player || !(model instanceof PlayerModel<?>)) return; JsonObject row = s.state(); row.addProperty("stage", stage); row.addProperty("modelId", s.modelIds.computeIfAbsent(model, ignored -> s.modelIds.size() + 1)); row.addProperty("sequence", ++s.poseSequence); row.add("rightArm", JSON.toJsonTree(new float[]{model.rightArm.xRot, model.rightArm.yRot, model.rightArm.zRot})); row.add("leftArm", JSON.toJsonTree(new float[]{model.leftArm.xRot, model.leftArm.yRot, model.leftArm.zRot})); if (s.poses.size() < 20000) s.poses.add(row); else s.drops++; }
    public static void body(LivingEntityRenderer<?, ?> renderer, LivingEntity entity) { if (renderer.getModel() instanceof HumanoidModel<?> model) pose("body-final", model, entity); }
    public static void consume(Object machine) { HoseScene s = active; if (s == null || s.done || s.selected == null || Minecraft.getInstance().player == null) return; JsonObject row = s.state();
        try { row.addProperty("active", (Boolean)machine.getClass().getMethod("isActive").invoke(machine)); for (String name : List.of("wasConsuming", "finishingConsume", "consumeV2Phase", "activeClip", "consumePlaybackId")) { var field = machine.getClass().getDeclaredField(name); field.setAccessible(true); Object value = field.get(machine); if (value != null && name.equals("activeClip")) value = value.getClass().getMethod("getName").invoke(value); row.addProperty(name, value == null ? null : value.toString()); } }
        catch (ReflectiveOperationException failure) { throw new IllegalStateException("Passive original consume-state observation", failure); }
        if (s.consumes.size() < 2500) s.consumes.add(row); else s.drops++;
    }
    private static void require(boolean ok, String message) { if (!ok) throw new IllegalStateException(message); }
    private record Case(int mode, boolean first, HumanoidArm arm, String guard) { boolean positive() { return guard.equals("positive"); } String name() { return mode + "-" + (first ? "first" : "third") + "-" + arm.name().toLowerCase(Locale.ROOT) + "-" + guard; } }
}
