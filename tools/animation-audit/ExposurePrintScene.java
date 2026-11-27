package audit.animation;

import audit.animation.mixin.NativeInputInvoker;
import audit.animation.mixin.NativeMouseInputInvoker;
import com.google.gson.*;
import com.mojang.blaze3d.platform.NativeImage;
import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.serialization.JsonOps;
import io.github.mortuusars.exposure.Exposure;
import io.github.mortuusars.exposure.ExposureServer;
import io.github.mortuusars.exposure.client.image.renderable.RenderableImage;
import io.github.mortuusars.exposure.world.camera.frame.Frame;
import io.github.mortuusars.exposure.world.item.PhotographItem;
import io.github.mortuusars.exposure.world.item.StackedPhotographsItem;
import java.lang.reflect.Field;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;
import net.minecraft.client.*;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.client.player.AbstractClientPlayer;
import net.minecraft.client.resources.model.BakedModel;
import net.minecraft.core.registries.*;
import net.minecraft.resources.*;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.*;
import net.minecraft.world.entity.*;
import net.minecraft.world.item.*;
import net.minecraft.world.level.*;
import net.minecraft.world.level.levelgen.WorldOptions;
import net.minecraft.world.level.storage.LevelResource;
import net.neoforged.neoforge.client.event.*;
import net.neoforged.neoforge.common.NeoForge;
import org.lwjgl.glfw.GLFW;

/** Genuine native photograph data in a fresh marked world. Inventory is setup, actions/draws are original. */
public final class ExposurePrintScene {
    private static final Gson JSON = new GsonBuilder().setPrettyPrinting().create();
    private static final ThreadLocal<Integer> HANDS = ThreadLocal.withInitial(() -> 0);
    private static volatile ExposurePrintScene active;
    private final Path root = Minecraft.getInstance().gameDirectory.toPath().toAbsolutePath().normalize();
    private final JsonObject input, result = new JsonObject();
    private final JsonArray snapshots = new JsonArray(), images = new JsonArray(), actions = new JsonArray(), draws = new JsonArray(), models = new JsonArray(), armCalls = new JsonArray(), providers = new JsonArray();
    private final Queue<JsonObject> uses = new ConcurrentLinkedQueue<>();
    private final List<String> errors = new ArrayList<>();
    private final List<Case> cases = new ArrayList<>();
    private final Map<String, Integer> readyViewerDraws = new HashMap<>();
    private List<Frame> frames;
    private CompletableFuture<JsonObject> pending;
    private CompletableFuture<Void> reload;
    private final JsonArray resourceEpochs = new JsonArray();
    private JsonObject seeded;
    private volatile Case selected;
    private UUID playerId;
    private String pendingShot;
    private Runnable afterCapture;
    private boolean opened, initialized, copiedData, done, releaseUse, shiftDown, reloaded;
    private int ticks, worldTicks, index = -1, age, stageAge, frame, drops;
    private volatile int step;

    public ExposurePrintScene() {
        try {
            require(Files.isRegularFile(root.resolve(".animation-audit")), "Missing owned marker");
            require(Path.of("").toAbsolutePath().normalize().equals(root), "Native relative exports must stay inside owned working directory");
            input = JsonParser.parseString(Files.readString(root.resolve("animation-exposure-print.json"))).getAsJsonObject();
        } catch (Exception failure) { throw new IllegalStateException("Owned print inputs", failure); }
        for (boolean first : List.of(true, false)) for (HumanoidArm arm : HumanoidArm.values()) for (EquipmentSlot slot : List.of(EquipmentSlot.MAINHAND, EquipmentSlot.OFFHAND))
            for (String kind : List.of("photograph", "aged_photograph", "stacked_photographs")) {
                cases.add(new Case(kind, first, arm, slot, false));
                if (first && slot == EquipmentSlot.MAINHAND) cases.add(new Case(kind, true, arm, slot, true));
            }
        result.addProperty("scope", "Native held print and viewer/stack-cycle paths using genuine recorded Exposure frames. No crafting/development, OS input, moving/remote/shader or full fit acceptance.");
        result.addProperty("caseCount", cases.size()); active = this;
        NeoForge.EVENT_BUS.addListener(this::tick); NeoForge.EVENT_BUS.addListener(this::frame);
    }
    private void tick(ClientTickEvent.Post ignored) {
        Minecraft mc = Minecraft.getInstance(); if (done || mc.getOverlay() != null || ++ticks < 100) return;
        try {
            if (!opened && mc.screen instanceof TitleScreen) {
                opened = true; mc.tell(() -> mc.createWorldOpenFlows().createFreshLevel("animation-print-flat",
                    new LevelSettings("Animation Print Audit", GameType.SURVIVAL, false, Difficulty.PEACEFUL, true, new GameRules(), WorldDataConfiguration.DEFAULT), new WorldOptions(1527L, false, false),
                    r -> r.registryOrThrow(Registries.WORLD_PRESET).get(ResourceLocation.withDefaultNamespace("flat")).createWorldDimensions(), mc.screen)); return;
            }
            if (mc.player == null || mc.level == null || mc.getSingleplayerServer() == null || ++worldTicks < 40) return;
            if (releaseUse) { use(GLFW.GLFW_RELEASE); releaseUse = false; }
            if (afterCapture != null) { if (pendingShot == null) { Runnable action = afterCapture; afterCapture = null; action.run(); } return; }
            if (reload != null) { if (reload.isDone()) { reload.join(); inspectResources(mc, 1); for (HumanoidArm arm : HumanoidArm.values()) { cases.add(new Case("aged_photograph", true, arm, EquipmentSlot.MAINHAND, false, 1)); cases.add(new Case("aged_photograph", true, arm, EquipmentSlot.MAINHAND, true, 1)); cases.add(new Case("aged_photograph", true, arm, EquipmentSlot.OFFHAND, false, 1)); } selected = null; reload = null; } return; }
            require(++age <= 6000, "Print total observation bound");
            if (!initialized) { initialized = true; playerId = mc.player.getUUID(); GLFW.glfwFocusWindow(mc.getWindow().getWindow()); inspectResources(mc, 0);
                result.add("requestedResourcePacks", JSON.toJsonTree(mc.options.resourcePacks)); result.add("activeResourcePacks", JSON.toJsonTree(mc.getResourceManager().listPacks().map(p -> p.packId()).toList())); }
            if (selected == null) { next(mc); return; }
            require(++stageAge <= 150, "Print stage bound: " + state());
            if (step == 1 && stageAge == 20) { mc.gui.getChat().clearMessages(false); mc.getToasts().clear(); }
            switch (step) {
                case 0 -> { if (takePending()) { seeded = lastSnapshot(); advance(); } }
                case 1 -> { if (stageAge >= 25) { require(ids(held()).equals(idsFrom(seeded)), "Actual client frame/container sync"); require(other().isEmpty() != selected.occupied, "Actual other-hand occupancy sync"); observe("held"); afterCapture = () -> { use(GLFW.GLFW_PRESS); releaseUse = true; advance(); }; } }
                case 2 -> { if (stageAge >= 15 && mc.screen != null && mc.screen.getClass().getSimpleName().equals("PhotographScreen") && readyViewerDraws.getOrDefault(selected.name(), 0) > 0) { observe("viewer"); afterCapture = () -> { escape(); advance(); }; } }
                case 3 -> { if (mc.screen == null && stageAge >= 8) { if (selected.kind.equals("stacked_photographs")) { shift(true); advance(); } else { request("after-viewer"); step = 7; stageAge = 0; } } }
                case 4 -> { if (stageAge >= 3 && mc.player.isShiftKeyDown()) { use(GLFW.GLFW_PRESS); releaseUse = true; advance(); } }
                case 5 -> { if (stageAge >= 8) { require(mc.screen == null, "Stack cycle must not open viewer"); shift(false); request("after-cycle"); advance(); } }
                case 6 -> { if (takePending()) { require(!ids(held()).equals(idsFrom(seeded)), "Native client stack order changed"); require(!idsFrom(lastSnapshot()).equals(idsFrom(seeded)), "Native server stack order changed"); observe("cycled"); step = 8; stageAge = 0; } }
                case 7 -> { if (takePending()) { require(idsFrom(lastSnapshot()).equals(idsFrom(seeded)), "Viewer preserves actual photograph component"); observe("restored"); advance(); } }
                case 8 -> { if (stageAge >= 8 && pendingShot == null) next(mc); }
                default -> throw new IllegalStateException("Unknown print step");
            }
        } catch (Throwable failure) { errors.add(failure.toString()); finish(mc); }
    }
    private void next(Minecraft mc) {
        if (++index == cases.size()) { if (!reloaded && input.has("reloadAfterInitial") && input.get("reloadAfterInitial").getAsBoolean()) { reloaded = true; index--; reload = mc.reloadResourcePacks(); return; } finish(mc); return; }
        selected = cases.get(index); step = stageAge = 0; mc.options.mainHand().set(selected.arm); mc.player.setMainArm(selected.arm);
        mc.options.setCameraType(selected.first ? CameraType.FIRST_PERSON : CameraType.THIRD_PERSON_FRONT); mc.options.hideGui = false;
        mc.player.setYRot(0); mc.player.yRotO = 0; mc.player.setXRot(0); mc.player.xRotO = 0;
        var server = mc.getSingleplayerServer(); Case current = selected;
        pending = server.submit(() -> { ServerPlayer player = Objects.requireNonNull(server.getPlayerList().getPlayer(playerId));
            if (!copiedData) installData(player); player.setMainArm(current.arm); player.getInventory().clearContent(); player.getInventory().selected = 0;
            ItemStack stack;
            if (current.kind.equals("stacked_photographs")) { stack = new ItemStack(item("exposure:stacked_photographs")); StackedPhotographsItem container = (StackedPhotographsItem) stack.getItem();
                container.addPhotographOnTop(stack, print("photograph", frames.get(0))); container.addPhotographOnTop(stack, print("aged_photograph", frames.get(1))); }
            else stack = print(current.kind, frames.get(0));
            player.setItemSlot(current.slot, stack); if (current.occupied) player.setItemSlot(EquipmentSlot.OFFHAND, new ItemStack(Items.STICK)); player.inventoryMenu.broadcastChanges();
            server.overworld().setDayTime(6000); server.overworld().getGameRules().getRule(GameRules.RULE_DOMOBSPAWNING).set(false, server); return snapshot(player, current, "seed"); });
    }
    private void installData(ServerPlayer player) {
        try { Path world = player.server.getWorldPath(LevelResource.ROOT).toAbsolutePath().normalize(); require(world.startsWith(root.resolve("saves")), "World outside owned root");
            Field field = ExposureServer.exposureRepository().getClass().getDeclaredField("exposuresFolderPath"); field.setAccessible(true); Path repo = ((Path) field.get(ExposureServer.exposureRepository())).toAbsolutePath().normalize();
            require(repo.startsWith(world), "Repository outside owned world"); Files.createDirectories(repo);
            for (JsonElement element : input.getAsJsonArray("files")) { JsonObject row = element.getAsJsonObject(); String name = row.get("name").getAsString(); require(name.matches("[A-Za-z0-9_.-]+\\.dat"), "Unsafe native exposure filename");
                Path source = root.resolve("print-input/exposures").resolve(name); require(!Files.isSymbolicLink(source), "Symlink input refused"); byte[] data = Files.readAllBytes(source);
                require(HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(data)).equals(row.get("sha256").getAsString()), "Genuine native photo checksum"); Files.copy(source, repo.resolve(name)); }
            frames = new ArrayList<>(); for (JsonElement value : input.getAsJsonArray("frames")) { Frame valueFrame = Frame.CODEC.parse(RegistryOps.create(JsonOps.INSTANCE, player.registryAccess()), value).getOrThrow();
                require(valueFrame.identifier().id().matches("[A-Za-z0-9_-]+"), "Non-native identifier refused"); var data = ExposureServer.exposureRepository().load(valueFrame.identifier().id()).getData().orElseThrow(); require(data.getWidth() == 320 && data.getHeight() == 320, "Native source image dimensions"); frames.add(valueFrame); }
            require(frames.size() == 8, "Eight genuine native frame records"); copiedData = true;
        } catch (Exception failure) { throw new IllegalStateException("Owned native repository setup", failure); }
    }
    private static Item item(String id) { return BuiltInRegistries.ITEM.get(ResourceLocation.parse(id)); }
    private void inspectResources(Minecraft mc, int epoch) {
        try { JsonObject row = new JsonObject(); row.addProperty("epoch", epoch); boolean enabled = (Boolean) Class.forName("punchy.config.PunchyConfig").getMethod("isModEnabled").invoke(null); row.addProperty("nativePunchyEnabled", enabled); require(enabled, "Punchy must remain enabled in matched resource-rule controls");
            String rule = input.has("ruleResource") ? input.get("ruleResource").getAsString() : "create_skyweave_audit:punchy_rules/exposure_aged_native.json";
            var resource = mc.getResourceManager().getResource(ResourceLocation.parse(rule)); boolean expected = input.has("expectedAgedRule") && input.get("expectedAgedRule").getAsBoolean(); row.addProperty("ruleResource", rule); row.addProperty("actualRulePresent", resource.isPresent()); require(resource.isPresent() == expected, "Actual native rule resource differs from fixture");
            if (resource.isPresent()) { byte[] bytes; try (var stream = resource.get().open()) { bytes = stream.readAllBytes(); } String sha = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)); row.addProperty("ruleSha256", sha); row.addProperty("sourcePack", resource.get().sourcePackId()); require(sha.equals(input.get("expectedRuleSha256").getAsString()), "Native rule bytes differ"); }
            row.add("activeFilePacks", JSON.toJsonTree(mc.getResourceManager().listPacks().map(p -> p.packId()).filter(s -> s.startsWith("file/")).toList())); resourceEpochs.add(row);
        } catch (Exception failure) { throw new IllegalStateException("Native print control admission", failure); }
    }
    private static ItemStack print(String kind, Frame frame) { ItemStack stack = new ItemStack(item("exposure:" + kind)); stack.set(Exposure.DataComponents.PHOTOGRAPH_FRAME, frame); return stack; }
    private ItemStack held() { return Minecraft.getInstance().player.getItemBySlot(selected.slot); }
    private ItemStack other() { return Minecraft.getInstance().player.getItemBySlot(selected.slot == EquipmentSlot.MAINHAND ? EquipmentSlot.OFFHAND : EquipmentSlot.MAINHAND); }
    private static List<String> ids(ItemStack stack) { if (stack.getItem() instanceof PhotographItem p) return List.of(p.getFrame(stack).identifier().id());
        if (stack.getItem() instanceof StackedPhotographsItem p) return p.getPhotographs(stack).photographsCopy().stream().flatMap(s -> ids(s).stream()).toList(); return List.of(); }
    private static List<String> idsFrom(JsonObject row) { List<String> ids = new ArrayList<>(); row.getAsJsonArray("frames").forEach(v -> ids.add(v.getAsString())); return ids; }
    private JsonObject snapshot(ServerPlayer player, Case current, String stage) { JsonObject row = new JsonObject(); row.addProperty("case", current.name()); row.addProperty("stage", stage); row.addProperty("serverTick", player.server.getTickCount()); row.add("frames", JSON.toJsonTree(ids(player.getItemBySlot(current.slot)))); return row; }
    private void request(String stage) { require(pending == null, "Overlapping observation"); var server = Minecraft.getInstance().getSingleplayerServer(); Case current = selected; pending = server.submit(() -> snapshot(Objects.requireNonNull(server.getPlayerList().getPlayer(playerId)), current, stage)); }
    private boolean takePending() { if (pending == null || !pending.isDone()) return false; snapshots.add(pending.join()); pending = null; return true; }
    private JsonObject lastSnapshot() { return snapshots.get(snapshots.size() - 1).getAsJsonObject(); }
    private void advance() { step++; stageAge = 0; }
    private JsonObject state() { Minecraft mc = Minecraft.getInstance(); JsonObject row = new JsonObject(); row.addProperty("case", selected == null ? "boot" : selected.name()); row.addProperty("step", step); row.addProperty("stageAge", stageAge); row.addProperty("frame", frame); row.addProperty("handsScope", HANDS.get());
        row.addProperty("screen", mc.screen == null ? null : mc.screen.getClass().getName()); row.addProperty("cameraType", mc.options.getCameraType().name()); row.addProperty("cameraDetached", mc.gameRenderer.getMainCamera().isDetached());
        if (selected != null && mc.player != null) { row.add("frames", JSON.toJsonTree(ids(held()))); row.addProperty("held", held().getItem().toString()); row.addProperty("otherItem", other().getItem().toString()); row.addProperty("otherEmpty", other().isEmpty()); row.addProperty("playerShift", mc.player.isShiftKeyDown()); } return row; }
    private void observe(String label) { require(pendingShot == null, "Previous screenshot pending"); JsonObject row = state(); row.addProperty("stage", label); actions.add(row); pendingShot = selected.name() + "-" + label + ".png"; }
    private void frame(RenderFrameEvent.Post ignored) { frame++; if (done || pendingShot == null) return; String file = pendingShot; pendingShot = null;
        try (var image = Screenshot.takeScreenshot(Minecraft.getInstance().getMainRenderTarget())) { image.writeToFile(root.resolve(file)); JsonObject row = state(); row.addProperty("file", file); images.add(row); } catch (Exception failure) { errors.add(failure.toString()); } }
    private void use(int action) { Minecraft mc = Minecraft.getInstance(); require(mc.options.keyUse.getKey().getType() == com.mojang.blaze3d.platform.InputConstants.Type.MOUSE && mc.options.keyUse.getKeyModifier() == net.neoforged.neoforge.client.settings.KeyModifier.NONE, "Mapped native mouse use required");
        ((NativeMouseInputInvoker) mc.mouseHandler).animationAudit$mousePress(mc.getWindow().getWindow(), mc.options.keyUse.getKey().getValue(), action, shiftDown ? GLFW.GLFW_MOD_SHIFT : 0); }
    private void key(int code, int action) { Minecraft mc = Minecraft.getInstance(); ((NativeInputInvoker) mc.keyboardHandler).animationAudit$keyPress(mc.getWindow().getWindow(), code, 0, action, shiftDown ? GLFW.GLFW_MOD_SHIFT : 0); }
    private void shift(boolean down) { shiftDown = down; key(Minecraft.getInstance().options.keyShift.getKey().getValue(), down ? GLFW.GLFW_PRESS : GLFW.GLFW_RELEASE); }
    private void escape() { key(GLFW.GLFW_KEY_ESCAPE, GLFW.GLFW_PRESS); key(GLFW.GLFW_KEY_ESCAPE, GLFW.GLFW_RELEASE); }
    private void finish(Minecraft mc) { if (done) return; done = true; if (releaseUse) use(GLFW.GLFW_RELEASE); if (shiftDown) shift(false);
        result.addProperty("status", errors.isEmpty() && index == cases.size() ? "completed" : "error"); result.addProperty("completedCases", Math.min(index, cases.size())); result.addProperty("caseCount", cases.size()); result.addProperty("traceDrops", drops); result.add("resourceEpochs", resourceEpochs);
        result.add("serverStates", snapshots); result.add("actions", actions); result.add("images", images); result.add("imageDraws", draws); result.add("itemModels", models); result.add("nativeArmCalls", armCalls); result.add("nativeProviders", providers); result.add("useEvents", JSON.toJsonTree(uses)); result.add("errors", JSON.toJsonTree(errors));
        try { Files.writeString(root.resolve("native-exposure-print-result.json"), JSON.toJson(result)); } catch (Exception failure) { throw new RuntimeException(failure); } mc.tell(mc::stop);
    }
    private static boolean printItem(ItemStack item) { return item.getItem() instanceof PhotographItem || item.getItem() instanceof StackedPhotographsItem; }
    private static void require(boolean ok, String message) { if (!ok) throw new IllegalStateException(message); }
    public static void enterHands() { HANDS.set(HANDS.get() + 1); }
    public static void leaveHands() { HANDS.set(HANDS.get() - 1); }
    public static void arm(ItemStack item, InteractionHand hand) { ExposurePrintScene s = active; if (s == null || s.done || s.selected == null || !printItem(item)) return; JsonObject row = s.state(); row.addProperty("hand", hand.name()); row.add("itemFrames", JSON.toJsonTree(ids(item))); if (s.armCalls.size() < 10000) s.armCalls.add(row); else s.drops++; }
    public static void model(ItemStack item, ItemDisplayContext context, PoseStack poses, BakedModel model) { ExposurePrintScene s = active; if (s == null || s.done || s.selected == null || !printItem(item)) return; JsonObject row = s.state(); row.addProperty("context", context.name()); row.addProperty("bakedClass", model.getClass().getName()); row.add("itemFrames", JSON.toJsonTree(ids(item))); row.add("matrix", JSON.toJsonTree(poses.last().pose().get(new float[16]))); if (s.models.size() < 10000) s.models.add(row); else s.drops++; }
    public static void provider(ItemStack item, boolean front, boolean back) { ExposurePrintScene s = active; if (s == null || s.done || s.selected == null || !printItem(item)) return; JsonObject row = s.state(); row.addProperty("front", front); row.addProperty("back", back); row.add("itemFrames", JSON.toJsonTree(ids(item)));
        String route = StackWalker.getInstance().walk(frames -> frames.filter(f -> f.getClassName().equals("net.minecraft.client.renderer.ItemInHandRenderer")).map(StackWalker.StackFrame::getMethodName).filter(n -> n.equals("exposure$renderOneHandedPhotograph") || n.equals("exposure$renderTwoHandedPhotograph")).findFirst().orElse("other")); row.addProperty("nativeHandRoute", route);
        if (s.providers.size() < 10000) s.providers.add(row); else s.drops++; }
    public static void image(RenderableImage image, NativeImage pixels, boolean requiresUpload, PoseStack poses) { ExposurePrintScene s = active; if (s == null || s.done || s.selected == null) return; JsonObject row = s.state(); row.addProperty("identifier", image.getIdentifier().toString()); row.addProperty("width", image.width()); row.addProperty("height", image.height()); row.addProperty("requiresUpload", requiresUpload);
        List<String> callers = StackWalker.getInstance().walk(stack -> stack.limit(32).map(f -> f.getClassName() + "." + f.getMethodName()).toList());
        String origin = HANDS.get() > 0 ? "first-person-hands" : callers.stream().anyMatch(n -> n.startsWith("net.minecraft.client.renderer.entity.layers.ItemInHandLayer.")) ? "third-person-item-layer" : Minecraft.getInstance().screen != null && Minecraft.getInstance().screen.getClass().getSimpleName().equals("PhotographScreen") ? "native-viewer" : "other";
        row.addProperty("drawOrigin", origin); if (s.draws.size() < 20 || !s.readyViewerDraws.containsKey(s.selected.name())) row.add("callers", JSON.toJsonTree(callers));
        boolean ready = pixels != null && image.width() == 320 && image.height() == 320 && pixels.getWidth() == 320 && pixels.getHeight() == 320 && !requiresUpload;
        row.addProperty("readyNativePixels", ready); if (ready) { row.add("sampleABGR", JSON.toJsonTree(new int[]{pixels.getPixelRGBA(0, 0), pixels.getPixelRGBA(160, 160), pixels.getPixelRGBA(319, 319)})); if (origin.equals("native-viewer")) s.readyViewerDraws.merge(s.selected.name(), 1, Integer::sum); }
        row.add("matrix", JSON.toJsonTree(poses.last().pose().get(new float[16]))); if (s.draws.size() < 20000) s.draws.add(row); else s.drops++;
    }
    public static void useEvent(String stage, ItemStack item, Level level, LivingEntity actor, InteractionHand hand) { ExposurePrintScene s = active; if (s == null || s.done || s.selected == null || !actor.getUUID().equals(s.playerId) || !printItem(item)) return; JsonObject row = new JsonObject(); row.addProperty("case", s.selected.name()); row.addProperty("step", s.step); row.addProperty("stage", stage); row.addProperty("side", level.isClientSide ? "client" : "server"); row.addProperty("hand", hand.name()); row.addProperty("actorTick", actor.tickCount); row.addProperty("shift", actor.isShiftKeyDown()); row.add("itemFrames", JSON.toJsonTree(ids(item))); s.uses.add(row); }
    private record Case(String kind, boolean first, HumanoidArm arm, EquipmentSlot slot, boolean occupied, int epoch) {
        Case(String kind, boolean first, HumanoidArm arm, EquipmentSlot slot, boolean occupied) { this(kind, first, arm, slot, occupied, 0); }
        String name() { return (epoch == 0 ? "" : "reload" + epoch + "-") + kind + "-" + (first ? "first" : "third") + "-" + arm.name().toLowerCase(Locale.ROOT) + "-" + slot.name().toLowerCase(Locale.ROOT) + "-" + (occupied ? "occupied" : "empty"); }
    }
}
