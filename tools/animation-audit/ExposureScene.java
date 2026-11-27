package audit.animation;

import audit.animation.mixin.NativeInputInvoker;
import audit.animation.mixin.NativeMouseInputInvoker;
import com.google.gson.*;
import com.mojang.blaze3d.platform.InputConstants;
import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.serialization.JsonOps;
import io.github.mortuusars.exposure.Exposure;
import io.github.mortuusars.exposure.ExposureServer;
import io.github.mortuusars.exposure.client.camera.CameraClient;
import io.github.mortuusars.exposure.world.entity.CameraOperator;
import io.github.mortuusars.exposure.world.item.camera.Attachment;
import io.github.mortuusars.exposure.world.item.camera.CameraItem;
import io.github.mortuusars.exposure.world.camera.frame.Frame;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import net.minecraft.client.*;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.client.model.PlayerModel;
import net.minecraft.client.model.HumanoidModel;
import net.minecraft.client.renderer.entity.LivingEntityRenderer;
import net.minecraft.client.resources.model.BakedModel;
import net.minecraft.core.BlockPos;
import net.minecraft.core.registries.*;
import net.minecraft.resources.*;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.*;
import net.minecraft.world.entity.*;
import net.minecraft.world.item.*;
import net.minecraft.world.level.*;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.levelgen.WorldOptions;
import net.minecraft.world.level.storage.LevelResource;
import net.neoforged.neoforge.client.event.ClientTickEvent;
import net.neoforged.neoforge.client.event.RenderFrameEvent;
import net.neoforged.neoforge.common.NeoForge;
import org.lwjgl.glfw.GLFW;

/** Real native camera session/shutter/UI in a marked flat world. No forced use/session/animation. */
public final class ExposureScene {
    private static final Gson JSON = new GsonBuilder().setPrettyPrinting().create();
    private static volatile ExposureScene active;
    private final Path root = Minecraft.getInstance().gameDirectory.toPath().toAbsolutePath().normalize();
    private final List<Case> cases = new ArrayList<>();
    private final JsonObject result = new JsonObject();
    private final JsonArray states = new JsonArray(), shots = new JsonArray(), actions = new JsonArray();
    private final JsonArray matrices = new JsonArray(), bodies = new JsonArray(), serverStates = new JsonArray();
    private final JsonArray poseStages = new JsonArray();
    private final Map<HumanoidModel<?>, Integer> modelIds = new IdentityHashMap<>();
    private final Queue<JsonObject> useEvents = new ConcurrentLinkedQueue<>();
    private final List<String> errors = new ArrayList<>();
    private final List<KeyMapping> releaseNext = new ArrayList<>();
    private final Map<KeyMapping, Integer> automaticModifiers = new IdentityHashMap<>();
    private final Set<String> frameIds = new HashSet<>();
    private boolean opened, initialized, done, releasedAfterMenu;
    private int ticks, worldTicks, index = -1, step, age, stageAge, frame;
    private volatile Case selected;
    private UUID playerId;
    private CompletableFuture<JsonObject> pending;
    private String pendingShot;
    private Runnable afterCapture;
    private BlockPos anchor;
    private int readyWait, heldModifiers, matrixDrops, bodyDrops, poseDrops, poseSequence;
    private boolean releaseMiddle, expectedSelfie;

    public ExposureScene() {
        if (!Files.isRegularFile(root.resolve("animation-exposure.json"))) throw new IllegalStateException("Missing owned Exposure marker");
        for (boolean first : List.of(true, false)) for (HumanoidArm arm : HumanoidArm.values())
            for (EquipmentSlot slot : List.of(EquipmentSlot.MAINHAND, EquipmentSlot.OFFHAND))
                cases.add(new Case((first ? "first" : "third") + "-" + arm.name().toLowerCase(Locale.ROOT) + "-" + slot.name().toLowerCase(Locale.ROOT), first, arm, slot));
        result.addProperty("scope", "Actual owned-window keyboard/mouse callbacks and original Exposure session/attachment/shutter/selfie/UI. Not OS-input delivery, full fit, developing/crafting, remote, shaders, or production qualification.");
        result.addProperty("caseCount", cases.size()); active = this;
        NeoForge.EVENT_BUS.addListener(this::tick); NeoForge.EVENT_BUS.addListener(this::frame);
    }

    private void tick(ClientTickEvent.Post ignored) {
        Minecraft mc = Minecraft.getInstance(); if (done || mc.getOverlay() != null || ++ticks < 100) return;
        try {
            if (!opened && mc.screen instanceof TitleScreen) {
                opened = true; mc.tell(() -> mc.createWorldOpenFlows().createFreshLevel("animation-exposure-flat",
                    new LevelSettings("Animation Exposure audit", GameType.SURVIVAL, false, Difficulty.PEACEFUL,
                        true, new GameRules(), WorldDataConfiguration.DEFAULT), new WorldOptions(1527L, false, false),
                    registries -> registries.registryOrThrow(Registries.WORLD_PRESET).get(ResourceLocation.withDefaultNamespace("flat")).createWorldDimensions(), mc.screen));
                return;
            }
            if (mc.player == null || mc.level == null || mc.getSingleplayerServer() == null || ++worldTicks < 40) return;
            for (KeyMapping key : List.copyOf(releaseNext)) input(key, GLFW.GLFW_RELEASE); releaseNext.clear();
            if (releaseMiddle) { mouse(GLFW.GLFW_MOUSE_BUTTON_MIDDLE, GLFW.GLFW_RELEASE); releaseMiddle = false; }
            if (afterCapture != null) { if (pendingShot == null) { Runnable action = afterCapture; afterCapture = null; action.run(); } return; }
            if (++age > 5000) throw new IllegalStateException("Exposure scene observation bound");
            if (!initialized) {
                initialized = true; playerId = mc.player.getUUID(); anchor = mc.player.blockPosition();
                GLFW.glfwFocusWindow(mc.getWindow().getWindow());
                result.add("requestedResourcePacks", JSON.toJsonTree(mc.options.resourcePacks));
                result.add("activeResourcePacks", JSON.toJsonTree(mc.getResourceManager().listPacks().map(p -> p.packId()).toList()));
                result.add("renderHooks", RenderHookInventory.capture());
                var controls = io.github.mortuusars.exposure.client.input.KeyboardHandler.getCameraControlsKey();
                JsonObject bindings = new JsonObject(); bindings.addProperty("controlsKey", controls.getKey().getName()); bindings.addProperty("controlsModifier", controls.getKeyModifier().name());
                bindings.addProperty("inventoryKey", mc.options.keyInventory.getKey().getName()); bindings.addProperty("inventoryMatchesControlsCode", mc.options.keyInventory.matches(controls.getKey().getValue(), 0));
                bindings.addProperty("controlsMatchesOwnCode", controls.matches(controls.getKey().getValue(), 0));
                bindings.addProperty("middleClickControlsEnabled", io.github.mortuusars.exposure.Config.Client.VIEWFINDER_MIDDLE_CLICK_CONTROLS.get()); result.add("loadedBindings", bindings);
                result.addProperty("inputDriver", "Original KeyboardHandler.keyPress/MouseHandler.onPress on this owned GLFW window. Mapped action press/release on separate ticks, Escape callback pair immediate; not OS events");
            }
            if (selected == null) { next(mc); return; }
            if (++stageAge > 450) throw new IllegalStateException("Stage bound: " + selected.name + " step " + step + " " + state());
            if (stageAge % 5 == 0) states.add(state());
            switch (step) {
                case 0 -> { if (takePending()) advance(); }
                case 1 -> { if (stageAge >= 12) { require(cameraStack(mc.player).getItem() instanceof CameraItem, "Camera inventory sync"); observe("held"); input(mc.options.keyShift, GLFW.GLFW_PRESS); advance(); } }
                case 2 -> { if (stageAge >= 3) { pulse(mc.options.keyUse); advance(); } }
                case 3 -> { if (mc.screen != null && mc.screen.getClass().getSimpleName().contains("Attachments")) { observe("attachments"); afterCapture = () -> { escape(); advance(); }; } }
                case 4 -> { if (mc.screen == null) { if (!releasedAfterMenu) { input(mc.options.keyShift, GLFW.GLFW_RELEASE); releasedAfterMenu = true; stageAge = 0; } else if (stageAge >= 8 && !mc.options.keyShift.isDown() && !mc.player.isShiftKeyDown()) { pulse(mc.options.keyUse); advance(); } } }
                case 5 -> { if (stageAge >= 15 && CameraClient.isActive() && cameraItem().isActive(cameraStack(mc.player))) { requestServer("active"); advance(); } }
                case 6 -> { if (takePending()) { require(lastServer().get("cameraActive").getAsBoolean(), "Native server camera session"); observe("active"); afterCapture = () -> { if (CameraClient.viewfinder().isLookingThrough()) { require(io.github.mortuusars.exposure.Config.Client.VIEWFINDER_MIDDLE_CLICK_CONTROLS.get(), "Existing native middle-click controls option"); mouse(GLFW.GLFW_MOUSE_BUTTON_MIDDLE, GLFW.GLFW_PRESS); releaseMiddle = true; advance(); } else { actions.add(named("controls-not-requested-outside-viewfinder")); step = 9; stageAge = 0; } }; } }
                case 7 -> { if (mc.screen != null && mc.screen.getClass().getSimpleName().contains("ViewfinderCameraControls")) { observe("controls"); afterCapture = () -> { escape(); advance(); }; } }
                case 8 -> { if (mc.screen == null && stageAge >= 8) { require(CameraClient.isActive(), "Controls close must retain camera"); advance(); } }
                case 9 -> { if (stageAge >= 12) { pulse(mc.options.keyUse); actions.add(named("native-shutter-use")); advance(); } }
                case 10 -> { if (stageAge % 10 == 0 && pending == null) requestServer("capture"); if (takePending()) { JsonObject s = lastServer(); require(s.get("frameCount").getAsInt() <= 1, "Single shutter must not duplicate frames"); if (s.get("uploaded").getAsBoolean()) { require(s.get("frameCount").getAsInt() == 1 && s.get("pixelKinds").getAsInt() > 1, "Actual uploaded photo pixels"); require(frameIds.add(s.get("frameId").getAsString()), "Unique native frame id"); readyWait = 0; advance(); } } }
                case 11 -> { if (++readyWait >= 20) { observe("captured"); expectedSelfie = !cameraItem().isInSelfieMode(cameraStack(mc.player)); afterCapture = () -> { pulse(mc.options.keyTogglePerspective); advance(); }; } }
                case 12 -> { if (stageAge >= 15 && cameraItem().isInSelfieMode(cameraStack(mc.player)) == expectedSelfie) { observe("perspective-toggled"); afterCapture = () -> { escape(); advance(); }; } }
                case 13 -> { if (stageAge >= 15 && !CameraClient.isActive() && !cameraItem().isActive(cameraStack(mc.player)) && mc.screen == null) { require(mc.options.getCameraType() == (selected.first ? CameraType.FIRST_PERSON : CameraType.THIRD_PERSON_FRONT), "Camera option restored after native close"); requestServer("retired"); advance(); } }
                case 14 -> { if (takePending()) { require(!lastServer().get("cameraActive").getAsBoolean(), "Server camera session retired"); observe("retired"); advance(); } }
                case 15 -> { if (stageAge >= 10 && pendingShot == null) next(mc); }
                default -> throw new IllegalStateException("Unknown Exposure step");
            }
        } catch (Throwable failure) { errors.add(failure.toString()); finish(mc); }
    }

    private void next(Minecraft mc) {
        if (++index == cases.size()) { finish(mc); return; }
        selected = cases.get(index); step = stageAge = 0; releasedAfterMenu = false;
        mc.options.mainHand().set(selected.arm); mc.player.setMainArm(selected.arm);
        mc.options.setCameraType(selected.first ? CameraType.FIRST_PERSON : CameraType.THIRD_PERSON_FRONT); mc.options.hideGui = false;
        mc.player.setYRot(0); mc.player.yRotO = 0; mc.player.setXRot(0); mc.player.xRotO = 0;
        var server = mc.getSingleplayerServer(); Case current = selected;
        pending = server.submit(() -> {
            ServerPlayer player = Objects.requireNonNull(server.getPlayerList().getPlayer(playerId));
            Path world = server.getWorldPath(LevelResource.ROOT).toAbsolutePath().normalize();
            require(world.startsWith(root.resolve("saves")), "World storage outside owned fixture");
            require(repositoryPath().startsWith(world), "Exposure storage outside owned world");
            player.setGameMode(GameType.SURVIVAL); player.setMainArm(current.arm); player.getInventory().clearContent(); player.getInventory().selected = 0;
            ItemStack camera = new ItemStack(item("exposure:camera")); Attachment.FILM.set(camera, new ItemStack(item("exposure:black_and_white_film")));
            player.setItemSlot(current.slot, camera); player.inventoryMenu.broadcastChanges(); player.connection.teleport(anchor.getX() + .5, anchor.getY(), anchor.getZ() + .5, 0, 0);
            server.overworld().setDayTime(6000); server.overworld().getGameRules().getRule(GameRules.RULE_DOMOBSPAWNING).set(false, server);
            for (int x = -2; x <= 2; x++) for (int y = 0; y <= 3; y++)
                player.serverLevel().setBlockAndUpdate(anchor.offset(x, y, 7), (x < 0 ? Blocks.RED_WOOL : Blocks.WHITE_WOOL).defaultBlockState());
            return serverState(player, current, "seed");
        });
    }
    private void requestServer(String stage) {
        if (pending != null) throw new IllegalStateException("Overlapping server observation");
        var server = Minecraft.getInstance().getSingleplayerServer(); Case current = selected;
        pending = server.submit(() -> serverState(Objects.requireNonNull(server.getPlayerList().getPlayer(playerId)), current, stage));
    }
    private JsonObject serverState(ServerPlayer player, Case current, String stage) {
        ItemStack stack = player.getItemBySlot(current.slot); CameraItem item = (CameraItem) stack.getItem();
        JsonObject row = named(stage); row.addProperty("serverTick", player.server.getTickCount());
        row.addProperty("playerShift", player.isShiftKeyDown()); row.addProperty("secondaryUse", player.isSecondaryUseActive());
        row.addProperty("cameraActive", ((CameraOperator) player).getActiveExposureCameraOptional().isPresent()); row.addProperty("stackActive", item.isActive(stack));
        List<Frame> frames = Attachment.FILM.get(stack).getForReading().getOrDefault(Exposure.DataComponents.FILM_FRAMES, List.of());
        row.addProperty("frameCount", frames.size()); row.addProperty("uploaded", false);
        if (!frames.isEmpty()) {
            Frame first = frames.getFirst(); String id = first.identifier().id(); row.addProperty("frameId", id);
            row.add("nativeFrame", Frame.CODEC.encodeStart(RegistryOps.create(JsonOps.INSTANCE, player.registryAccess()), first).getOrThrow());
            var data = ExposureServer.exposureRepository().load(id).getData();
            if (data.isPresent()) { var pixels = data.get().getPixels(); Set<Byte> kinds = new HashSet<>(); for (byte pixel : pixels) kinds.add(pixel);
                row.addProperty("uploaded", true); row.addProperty("width", data.get().getWidth()); row.addProperty("height", data.get().getHeight());
                row.addProperty("pixelCount", pixels.length); row.addProperty("pixelKinds", kinds.size());
            }
        }
        return row;
    }
    private boolean takePending() {
        if (pending == null || !pending.isDone()) return false;
        serverStates.add(pending.join()); pending = null; return true;
    }
    private JsonObject lastServer() { return serverStates.get(serverStates.size() - 1).getAsJsonObject(); }
    private void advance() { step++; stageAge = 0; }
    private void observe(String stage) { require(pendingShot == null, "Previous capture not consumed"); JsonObject row = state(); row.addProperty("stage", stage); actions.add(row); pendingShot = selected.name + "-" + stage + ".png"; }
    private JsonObject named(String stage) { JsonObject row = new JsonObject(); row.addProperty("case", selected == null ? "boot" : selected.name); row.addProperty("step", step); row.addProperty("stage", stage); return row; }
    private JsonObject state() {
        Minecraft mc = Minecraft.getInstance(); JsonObject row = named("state"); row.addProperty("age", age); row.addProperty("stageAge", stageAge); row.addProperty("frame", frame);
        row.addProperty("screen", mc.screen == null ? null : mc.screen.getClass().getName()); row.addProperty("cameraClientActive", CameraClient.isActive());
        row.addProperty("windowFocused", GLFW.glfwGetWindowAttrib(mc.getWindow().getWindow(), GLFW.GLFW_FOCUSED) == GLFW.GLFW_TRUE);
        row.addProperty("lookingThrough", CameraClient.viewfinder() != null && CameraClient.viewfinder().isLookingThrough());
        row.addProperty("cameraType", mc.options.getCameraType().name()); row.addProperty("actualCameraDetached", mc.gameRenderer.getMainCamera().isDetached());
        row.addProperty("shiftMappingDown", mc.options.keyShift.isDown()); row.addProperty("callbackModifiers", heldModifiers);
        if (selected != null && mc.player != null) { ItemStack stack = cameraStack(mc.player); row.addProperty("heldItem", stack.getItem().toString());
            row.addProperty("playerShift", mc.player.isShiftKeyDown()); row.addProperty("inputShift", mc.player.input.shiftKeyDown);
            if (stack.getItem() instanceof CameraItem item) { row.addProperty("stackActive", item.isActive(stack)); row.addProperty("selfie", item.isInSelfieMode(stack)); }
            row.addProperty("nativeUsing", mc.player.isUsingItem()); }
        return row;
    }
    private void frame(RenderFrameEvent.Post ignored) {
        frame++; if (done || pendingShot == null) return; Minecraft mc = Minecraft.getInstance();
        String name = pendingShot; pendingShot = null;
        try (var image = Screenshot.takeScreenshot(mc.getMainRenderTarget())) { image.writeToFile(root.resolve(name)); JsonObject row = state(); row.addProperty("file", name); shots.add(row); }
        catch (Exception failure) { errors.add("Screenshot: " + failure); }
    }
    private ItemStack cameraStack(LivingEntity player) { return player.getItemBySlot(selected.slot); }
    private CameraItem cameraItem() { return (CameraItem) cameraStack(Minecraft.getInstance().player).getItem(); }
    private static Item item(String id) { return BuiltInRegistries.ITEM.get(ResourceLocation.parse(id)); }
    private static Path repositoryPath() {
        try { Field field = ExposureServer.exposureRepository().getClass().getDeclaredField("exposuresFolderPath"); field.setAccessible(true); return ((Path) field.get(ExposureServer.exposureRepository())).toAbsolutePath().normalize(); }
        catch (ReflectiveOperationException failure) { throw new IllegalStateException("Cannot verify native Exposure storage", failure); }
    }
    private void pulse(KeyMapping key) { input(key, GLFW.GLFW_PRESS); releaseNext.add(key); }
    private void escape() { rawKey(GLFW.GLFW_KEY_ESCAPE, GLFW.GLFW_PRESS); rawKey(GLFW.GLFW_KEY_ESCAPE, GLFW.GLFW_RELEASE); }
    private void mouse(int button, int action) { Minecraft mc = Minecraft.getInstance(); JsonObject event = named("native-mouse-callback"); event.addProperty("button", button); event.addProperty("action", action); actions.add(event); ((NativeMouseInputInvoker) mc.mouseHandler).animationAudit$mousePress(mc.getWindow().getWindow(), button, action, heldModifiers); }
    private void rawKey(int code, int action) { Minecraft mc = Minecraft.getInstance(); ((NativeInputInvoker) mc.keyboardHandler).animationAudit$keyPress(mc.getWindow().getWindow(), code, 0, action, heldModifiers); }
    private void input(KeyMapping key, int action) {
        Minecraft mc = Minecraft.getInstance(); var input = key.getKey(); require(input.getValue() >= 0, "Unbound native input: " + key.getName());
        int required = switch (key.getKeyModifier()) { case CONTROL -> Minecraft.ON_OSX ? GLFW.GLFW_MOD_SUPER : GLFW.GLFW_MOD_CONTROL; case SHIFT -> GLFW.GLFW_MOD_SHIFT; case ALT -> GLFW.GLFW_MOD_ALT; default -> 0; };
        if (action == GLFW.GLFW_PRESS && required != 0 && (heldModifiers & required) == 0) {
            heldModifiers |= required; rawKey(modifierCode(required), action); automaticModifiers.put(key, required);
        }
        int ownModifier = input.getValue() == GLFW.GLFW_KEY_LEFT_SHIFT ? GLFW.GLFW_MOD_SHIFT
            : input.getValue() == GLFW.GLFW_KEY_LEFT_CONTROL ? GLFW.GLFW_MOD_CONTROL
            : input.getValue() == GLFW.GLFW_KEY_LEFT_ALT ? GLFW.GLFW_MOD_ALT : 0;
        if (action == GLFW.GLFW_PRESS) heldModifiers |= ownModifier; else heldModifiers &= ~ownModifier;
        JsonObject event = named("input-callback"); event.addProperty("mapping", key.getName()); event.addProperty("code", input.getValue()); event.addProperty("configuredModifier", key.getKeyModifier().name()); event.addProperty("callbackModifiers", heldModifiers); event.addProperty("action", action); actions.add(event);
        if (input.getType() == InputConstants.Type.MOUSE) {
            ((NativeMouseInputInvoker) mc.mouseHandler).animationAudit$mousePress(mc.getWindow().getWindow(), input.getValue(), action, heldModifiers);
        } else { require(input.getType() == InputConstants.Type.KEYSYM, "Unsupported native key type"); rawKey(input.getValue(), action); }
        if (action == GLFW.GLFW_RELEASE && automaticModifiers.containsKey(key)) {
            int modifier = automaticModifiers.remove(key); heldModifiers &= ~modifier; rawKey(modifierCode(modifier), GLFW.GLFW_RELEASE);
        }
    }
    private static int modifierCode(int flag) { return flag == GLFW.GLFW_MOD_SUPER ? GLFW.GLFW_KEY_LEFT_SUPER : flag == GLFW.GLFW_MOD_CONTROL ? GLFW.GLFW_KEY_LEFT_CONTROL : flag == GLFW.GLFW_MOD_SHIFT ? GLFW.GLFW_KEY_LEFT_SHIFT : GLFW.GLFW_KEY_LEFT_ALT; }
    private void finish(Minecraft mc) {
        if (done) return; done = true;
        for (KeyMapping key : List.copyOf(releaseNext)) input(key, GLFW.GLFW_RELEASE); releaseNext.clear(); mc.options.keyShift.setDown(false);
        result.addProperty("status", errors.isEmpty() && index == cases.size() ? "completed" : "error"); result.addProperty("completedCases", Math.min(index, cases.size()));
        result.add("states", states); result.add("actions", actions); result.add("images", shots); result.add("serverStates", serverStates);
        result.add("useEvents", new Gson().toJsonTree(useEvents)); result.add("itemMatrices", matrices); result.add("bodyPoses", bodies); result.add("errors", JSON.toJsonTree(errors));
        result.addProperty("matrixDrops", matrixDrops); result.addProperty("bodyDrops", bodyDrops);
        result.add("poseStages", poseStages); result.addProperty("poseDrops", poseDrops);
        try { Files.writeString(root.resolve("native-exposure-result.json"), JSON.toJson(result)); } catch (Exception failure) { throw new RuntimeException(failure); }
        mc.tell(mc::stop);
    }
    private static void require(boolean test, String reason) { if (!test) throw new IllegalStateException(reason); }
    public static void useEvent(String stage, ItemStack item, Level level, LivingEntity actor, InteractionHand hand) {
        ExposureScene scene = active; if (scene == null || scene.done || scene.selected == null || !actor.getUUID().equals(scene.playerId) || !(item.getItem() instanceof CameraItem camera)) return;
        if (scene.useEvents.size() > 512) throw new IllegalStateException("Exposure use trace bound"); JsonObject row = scene.named(stage);
        row.addProperty("side", level.isClientSide ? "client" : "server"); row.addProperty("hand", hand.name()); row.addProperty("stackActive", camera.isActive(item));
        row.addProperty("playerShift", actor.isShiftKeyDown()); if (actor instanceof net.minecraft.world.entity.player.Player player) row.addProperty("secondaryUse", player.isSecondaryUseActive());
        row.addProperty("actorTick", actor.tickCount); row.addProperty("nanos", System.nanoTime()); scene.useEvents.add(row);
    }
    public static void itemMatrix(String stage, ItemStack item, ItemDisplayContext context, boolean left, PoseStack poses, BakedModel model) {
        ExposureScene scene = active; if (scene == null || scene.done || scene.selected == null || !(item.getItem() instanceof CameraItem) || !stage.equals("entry")) return;
        if (scene.matrices.size() >= 5000) { scene.matrixDrops++; return; } JsonObject row = scene.state(); row.addProperty("context", context.name()); row.addProperty("left", left); row.addProperty("model", model.getClass().getName()); row.add("matrix", JSON.toJsonTree(poses.last().pose().get(new float[16]))); scene.matrices.add(row);
    }
    public static void draw(LivingEntityRenderer<?, ?> renderer, LivingEntity entity) {
        ExposureScene scene = active; if (scene == null || scene.done || scene.selected == null || entity != Minecraft.getInstance().player || !(renderer.getModel() instanceof PlayerModel<?> model)) return;
        if (scene.bodies.size() >= 5000) { scene.bodyDrops++; return; } JsonObject row = scene.poseState(model); scene.bodies.add(row);
    }
    private JsonObject poseState(HumanoidModel<?> model) {
        JsonObject row = state(); row.addProperty("modelId", modelIds.computeIfAbsent(model, ignored -> modelIds.size() + 1)); row.addProperty("poseSequence", ++poseSequence);
        row.add("rightArm", JSON.toJsonTree(new float[]{model.rightArm.xRot, model.rightArm.yRot, model.rightArm.zRot})); row.add("leftArm", JSON.toJsonTree(new float[]{model.leftArm.xRot, model.leftArm.yRot, model.leftArm.zRot}));
        row.add("head", JSON.toJsonTree(new float[]{model.head.xRot, model.head.yRot, model.head.zRot})); return row;
    }
    public static void pose(String stage, HumanoidModel<?> model, LivingEntity actor) {
        ExposureScene scene = active; if (scene == null || scene.done || scene.selected == null || actor != Minecraft.getInstance().player || !(model instanceof PlayerModel<?>)) return;
        if (scene.poseStages.size() >= 20000) { scene.poseDrops++; return; } JsonObject row = scene.poseState(model); row.addProperty("stage", stage); scene.poseStages.add(row);
    }
    private record Case(String name, boolean first, HumanoidArm arm, EquipmentSlot slot) {}
}
