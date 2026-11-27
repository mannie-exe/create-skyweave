package audit.animation;

import com.google.gson.*;
import com.mojang.blaze3d.vertex.PoseStack;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import net.minecraft.client.*;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.client.model.HumanoidModel;
import net.minecraft.client.model.PlayerModel;
import net.minecraft.client.renderer.block.model.ItemTransform;
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
import org.lwjgl.glfw.GLFW;

/** Passive held-item observation. Inventory setup only; never starts use or writes a model pose. */
public final class CarryScene {
    private static final Gson JSON = new GsonBuilder().setPrettyPrinting().create();
    private static CarryScene active;
    private final Path root = Minecraft.getInstance().gameDirectory.toPath().toAbsolutePath().normalize();
    private final JsonObject result = new JsonObject();
    private final JsonArray states = new JsonArray(), poses = new JsonArray(), models = new JsonArray(), images = new JsonArray();
    private final Map<HumanoidModel<?>, Integer> modelIds = new IdentityHashMap<>();
    private final List<Case> cases = new ArrayList<>();
    private final List<String> errors = new ArrayList<>();
    private CompletableFuture<JsonObject> pending;
    private UUID playerId;
    private Case selected;
    private int ticks, worldTicks, index = -1, step, age, frame, sequence, drops;
    private boolean opened, done;
    private String pendingShot;

    public CarryScene() {
        require(Files.isRegularFile(root.resolve(".animation-audit")), "Owned marker");
        for (boolean first : List.of(true, false)) for (HumanoidArm arm : HumanoidArm.values())
            for (InteractionHand hand : InteractionHand.values()) cases.add(new Case(first, arm, hand, "kaleidoscope_cookery:cold_cut_ham_slices"));
        for (boolean first : List.of(true, false)) cases.add(new Case(first, HumanoidArm.RIGHT, InteractionHand.MAIN_HAND, "minecraft:stone"));
        result.addProperty("scope", "Passive held ham in both views, dominant arms and held hands; ordinary stone control. Inventory/arm/camera setup only, no use or model-pose writes. Native callbacks and final components/matrices are not full rig, mesh attachment, moving/remote/shader or fallback acceptance.");
        result.addProperty("caseCount", cases.size());
        result.add("armComponentFields", JSON.toJsonTree(List.of("x", "y", "z", "xRot", "yRot", "zRot", "xScale", "yScale", "zScale")));
        active = this;
        NeoForge.EVENT_BUS.addListener(this::tick);
        NeoForge.EVENT_BUS.addListener(this::frame);
    }

    private void tick(ClientTickEvent.Post ignored) {
        Minecraft mc = Minecraft.getInstance();
        if (done || mc.getOverlay() != null || ++ticks < 100) return;
        try {
            if (!opened && mc.screen instanceof TitleScreen) {
                opened = true;
                mc.tell(() -> mc.createWorldOpenFlows().createFreshLevel("animation-carry-flat",
                    new LevelSettings("Animation Carry Audit", GameType.SURVIVAL, false, Difficulty.PEACEFUL,
                        true, new GameRules(), WorldDataConfiguration.DEFAULT), new WorldOptions(1527L, false, false),
                    r -> r.registryOrThrow(Registries.WORLD_PRESET).get(ResourceLocation.withDefaultNamespace("flat")).createWorldDimensions(), mc.screen));
                return;
            }
            if (mc.player == null || mc.level == null || mc.getSingleplayerServer() == null || ++worldTicks < 40) return;
            if (playerId == null) {
                playerId = mc.player.getUUID();
                GLFW.glfwFocusWindow(mc.getWindow().getWindow());
                boolean punchy = (Boolean) Class.forName("punchy.config.PunchyConfig").getMethod("isModEnabled").invoke(null);
                result.addProperty("actualPunchyEnabled", punchy);
                JsonObject marker = JsonParser.parseString(Files.readString(root.resolve("animation-carry.json"))).getAsJsonObject();
                require(marker.has("expectedPunchy") && marker.get("expectedPunchy").isJsonPrimitive()
                    && marker.getAsJsonPrimitive("expectedPunchy").isBoolean(), "Explicit expected Punchy state");
                boolean expectedPunchy = marker.get("expectedPunchy").getAsBoolean();
                result.addProperty("expectedPunchyEnabled", expectedPunchy);
                require(punchy == expectedPunchy, "Actual Punchy enable-state admission");
                result.add("activePacks", JSON.toJsonTree(mc.getResourceManager().listPacks().map(p -> p.packId()).toList()));
            }
            if (selected == null) { next(mc); return; }
            require(++age < 180, "Carry stage bound " + selected.name() + "/" + step);
            if (step == 0 && pending.isDone()) { states.add(pending.join()); pending = null; step = 1; age = 0; }
            else if (step == 1 && age >= 25) {
                require(BuiltInRegistries.ITEM.getKey(held().getItem()).toString().equals(selected.item), "Native held item sync");
                require(mc.player.getMainArm() == selected.arm && !mc.player.isUsingItem(), "Passive arm/use state");
                String extension = IClientItemExtensions.of(held()).getClass().getName();
                if (selected.item.startsWith("kaleidoscope_cookery:")) require(extension.equals("com.github.ysbbbbbb.kaleidoscopecookery.client.init.ClientSetupEvent$1"), "Actual registered lift extension");
                mc.gui.getChat().clearMessages(false); mc.getToasts().clear();
                JsonObject ready = state(); ready.addProperty("extensionClass", extension); ready.addProperty("stage", "client-ready");
                ready.add("transformQueries", transformQueries(mc)); states.add(ready);
                step = 2; age = 0;
            } else if (step == 2) {
                require(!mc.player.isUsingItem(), "Passive capture never uses item");
                if (age == 10) pendingShot = selected.name() + "-held";
                if (age >= 25 && pendingShot == null) next(mc);
            }
        } catch (Throwable failure) { errors.add(failure.toString()); finish(mc); }
    }

    private void next(Minecraft mc) {
        if (++index == cases.size()) { finish(mc); return; }
        selected = cases.get(index); step = age = 0;
        mc.options.mainHand().set(selected.arm); mc.player.setMainArm(selected.arm);
        mc.options.setCameraType(selected.first ? CameraType.FIRST_PERSON : CameraType.THIRD_PERSON_FRONT);
        mc.options.hideGui = false;
        Case current = selected;
        var server = mc.getSingleplayerServer();
        pending = server.submit(() -> {
            ServerPlayer p = Objects.requireNonNull(server.getPlayerList().getPlayer(playerId));
            p.stopUsingItem(); p.getInventory().clearContent(); p.getInventory().selected = 0;
            p.setMainArm(current.arm); p.connection.teleport(p.getX(), p.getY(), p.getZ(), 0, 0);
            p.setItemInHand(current.hand, new ItemStack(BuiltInRegistries.ITEM.get(ResourceLocation.parse(current.item))));
            p.inventoryMenu.broadcastChanges();
            JsonObject row = new JsonObject(); row.addProperty("case", current.name()); row.addProperty("stage", "server-seeded");
            row.addProperty("item", BuiltInRegistries.ITEM.getKey(p.getItemInHand(current.hand).getItem()).toString());
            row.addProperty("count", p.getItemInHand(current.hand).getCount()); row.addProperty("using", p.isUsingItem());
            row.addProperty("serverTick", server.getTickCount());
            return row;
        });
    }

    private ItemStack held() { return Minecraft.getInstance().player.getItemInHand(selected.hand); }
    private JsonObject transformQueries(Minecraft mc) throws ReflectiveOperationException {
        ItemStack stack = held();
        BakedModel rootModel = mc.getItemRenderer().getModel(stack, mc.level, mc.player, 0);
        var resolver = Class.forName("punchy.client.render.ResourcePackItemTransformResolver")
            .getMethod("resolve", ItemStack.class, ItemDisplayContext.class);
        var baseline = Class.forName("punchy.client.render.PunchyArmRenderer")
            .getMethod("resolveBaselineUseTransform", ItemStack.class, ItemDisplayContext.class, LivingEntity.class);
        JsonObject out = new JsonObject();
        out.addProperty("scope", "Public transform queries on current held stack and fresh PoseStacks, not additional draws or player/model pose changes. Calling resolver/baseline can warm their native resource caches; no timing acceptance.");
        out.addProperty("rootModelClass", rootModel.getClass().getName());
        for (ItemDisplayContext context : List.of(ItemDisplayContext.FIRST_PERSON_LEFT_HAND, ItemDisplayContext.FIRST_PERSON_RIGHT_HAND,
                ItemDisplayContext.THIRD_PERSON_LEFT_HAND, ItemDisplayContext.THIRD_PERSON_RIGHT_HAND)) {
            JsonObject row = new JsonObject();
            row.add("rootTransform", transform(rootModel.getTransforms().getTransform(context)));
            row.add("resourceResolver", transform((ItemTransform) resolver.invoke(null, stack, context)));
            row.add("punchyBaseline", transform((ItemTransform) baseline.invoke(null, stack, context, mc.player)));
            PoseStack fresh = new PoseStack();
            BakedModel child = rootModel.applyTransform(context, fresh,
                context == ItemDisplayContext.FIRST_PERSON_LEFT_HAND || context == ItemDisplayContext.THIRD_PERSON_LEFT_HAND);
            row.addProperty("returnedModelClass", child.getClass().getName());
            row.add("returnedModelTransform", transform(child.getTransforms().getTransform(context)));
            row.add("freshAppliedMatrix", JSON.toJsonTree(fresh.last().pose().get(new float[16])));
            out.add(context.name(), row);
        }
        return out;
    }
    private static JsonElement transform(ItemTransform t) {
        if (t == null) return JsonNull.INSTANCE;
        JsonObject row = new JsonObject();
        row.add("rotation", JSON.toJsonTree(new float[]{t.rotation.x, t.rotation.y, t.rotation.z}));
        row.add("translation", JSON.toJsonTree(new float[]{t.translation.x, t.translation.y, t.translation.z}));
        row.add("scale", JSON.toJsonTree(new float[]{t.scale.x, t.scale.y, t.scale.z}));
        return row;
    }
    private JsonObject state() {
        var mc = Minecraft.getInstance();
        JsonObject row = new JsonObject(); row.addProperty("case", selected.name()); row.addProperty("step", step);
        row.addProperty("age", age); row.addProperty("frame", frame); row.addProperty("using", mc.player.isUsingItem());
        row.addProperty("mainArm", mc.player.getMainArm().name()); row.addProperty("hand", selected.hand.name());
        row.addProperty("heldArm", (selected.hand == InteractionHand.MAIN_HAND ? mc.player.getMainArm() : mc.player.getMainArm().getOpposite()).name());
        row.addProperty("cameraType", mc.options.getCameraType().name());
        return row;
    }

    private void frame(RenderFrameEvent.Post ignored) {
        frame++;
        if (done || pendingShot == null || Minecraft.getInstance().player == null) return;
        String name = pendingShot; pendingShot = null;
        Screenshot.grab(root.toFile(), name + ".png", Minecraft.getInstance().getMainRenderTarget(), message -> {});
        JsonObject row = state(); row.addProperty("file", "screenshots/" + name + ".png"); images.add(row);
    }

    private void finish(Minecraft mc) {
        if (done) return;
        done = true; result.addProperty("completedCases", index); result.addProperty("traceDrops", drops);
        result.add("errors", JSON.toJsonTree(errors)); result.add("states", states); result.add("poses", poses);
        result.add("models", models); result.add("images", images);
        try { Files.writeString(root.resolve("carry-result.json"), JSON.toJson(result)); }
        catch (Exception failure) { throw new IllegalStateException(failure); }
        mc.tell(mc::stop);
    }

    private static float[] arm(net.minecraft.client.model.geom.ModelPart p) {
        return new float[]{p.x, p.y, p.z, p.xRot, p.yRot, p.zRot, p.xScale, p.yScale, p.zScale};
    }
    public static void pose(String stage, HumanoidModel<?> model, LivingEntity actor, HumanoidArm nativeArm) {
        CarryScene s = active;
        if (s == null || s.done || s.selected == null || s.step != 2 || actor != Minecraft.getInstance().player || !(model instanceof PlayerModel<?>)) return;
        JsonObject row = s.state(); row.addProperty("stage", stage); row.addProperty("sequence", ++s.sequence);
        row.addProperty("modelId", s.modelIds.computeIfAbsent(model, ignored -> s.modelIds.size() + 1));
        row.addProperty("nativeCallbackArm", nativeArm == null ? null : nativeArm.name());
        row.addProperty("rightArmPose", model.rightArmPose.name()); row.addProperty("leftArmPose", model.leftArmPose.name());
        row.add("rightArm", JSON.toJsonTree(arm(model.rightArm))); row.add("leftArm", JSON.toJsonTree(arm(model.leftArm)));
        if (s.poses.size() < 12000) s.poses.add(row); else s.drops++;
    }
    public static void model(String stage, ItemStack stack, ItemDisplayContext context, PoseStack matrix, BakedModel model) {
        CarryScene s = active;
        if (s == null || s.done || s.selected == null || s.step != 2 || !BuiltInRegistries.ITEM.getKey(stack.getItem()).toString().equals(s.selected.item) || !context.name().contains("HAND")) return;
        JsonObject row = s.state(); row.addProperty("stage", stage); row.addProperty("context", context.name());
        row.addProperty("custom", model.isCustomRenderer()); row.add("matrix", JSON.toJsonTree(matrix.last().pose().get(new float[16])));
        if (s.models.size() < 6000) s.models.add(row); else s.drops++;
    }
    private static void require(boolean ok, String message) { if (!ok) throw new IllegalStateException(message); }
    private record Case(boolean first, HumanoidArm arm, InteractionHand hand, String item) {
        String name() { return (first ? "first" : "third") + "-" + arm.name().toLowerCase(Locale.ROOT) + "-" + hand.name().toLowerCase(Locale.ROOT) + "-" + (item.startsWith("minecraft:") ? "stone" : "ham"); }
    }
}
