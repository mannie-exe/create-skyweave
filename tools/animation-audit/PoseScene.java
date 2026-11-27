package audit.animation;

import com.google.gson.*;
import com.mojang.blaze3d.vertex.PoseStack;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import net.minecraft.client.*;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.client.model.PlayerModel;
import net.minecraft.client.model.geom.ModelPart;
import net.minecraft.client.renderer.entity.LivingEntityRenderer;
import net.minecraft.core.registries.*;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.Difficulty;
import net.minecraft.world.entity.*;
import net.minecraft.world.entity.decoration.ArmorStand;
import net.minecraft.world.item.*;
import net.minecraft.world.level.*;
import net.minecraft.world.level.levelgen.WorldOptions;
import net.minecraft.world.phys.Vec3;
import net.neoforged.fml.ModList;
import net.neoforged.neoforge.client.event.*;
import net.neoforged.neoforge.common.NeoForge;

/** Controlled native animation and rendered-pose observations in a disposable flat world. */
public final class PoseScene {
    private static final Gson JSON = new GsonBuilder().setPrettyPrinting().create();
    private static PoseScene active;
    private final Path root = Minecraft.getInstance().gameDirectory.toPath();
    private final JsonObject result = new JsonObject();
    private final JsonArray draws = new JsonArray();
    private final JsonArray kinds = new JsonArray();
    private final JsonArray imageWitnesses = new JsonArray();
    private final JsonArray animationRequests = new JsonArray();
    private final JsonArray itemMatrices = new JsonArray();
    private final JsonArray profiles = new JsonArray();
    private final JsonArray armMatrices = new JsonArray();
    private final JsonArray pitchDecisions = new JsonArray();
    private final JsonArray nativeRotationSamples = new JsonArray();
    private final JsonArray productionLanternCorrections = new JsonArray();
    private final JsonArray resourceAdmissions = new JsonArray();
    private final JsonArray traceErrors = new JsonArray();
    private final JsonArray gripSamples = new JsonArray();
    private final JsonArray thirdItemSamples = new JsonArray();
    private final IdentityHashMap<Object, String> thirdItemBones = new IdentityHashMap<>();
    private final IdentityHashMap<Object, Integer> thirdItemIds = new IdentityHashMap<>();
    private final JsonArray overlayResolutions = new JsonArray();
    private final Set<String> seenOverlayResolutions = new HashSet<>();
    private final Set<String> seenKinds = new HashSet<>();
    private final Set<String> seenProfiles = new HashSet<>();
    private final Set<String> seenPitchDecisions = new HashSet<>();
    private final Set<String> seenNativeRotationSamples = new HashSet<>();
    private final Map<String, Integer> lifecycleSampleFrames = new HashMap<>();
    private final JsonArray lifecycleEvents = new JsonArray();
    private final JsonArray nativeHandInStarts = new JsonArray();
    private final java.util.concurrent.ConcurrentLinkedQueue<JsonObject> lifecycleServerEvents = new java.util.concurrent.ConcurrentLinkedQueue<>();
    private Method cachedArmWorld, baselineUseTransform;
    private ModelPart observedRightArm, observedLeftArm;
    private boolean opened, prepared, done;
    private int ticks, age, phase = -1, phaseTick, drawCount;
    private ArmorStand anchor;
    private String mode;
    private boolean combatPitch;
    private boolean combatNativeSamples;
    private boolean combatFullAxis;
    private boolean productionCombatReference;
    private boolean lanternLifecycle, lanternLifecycleHotbar, reloadRequested, reloadCompleted;
    private int resourceEpoch;
    private int lastNativeActorFrame = -1, initialActorAfterFrame, reloadActorAfterFrame;
    private boolean initialActorReady, waitingForReloadActor;
    private int completedFrames;
    private int pitchInstallations;
    private List<Case> cases = List.of(
        new Case("attack-level", "minecraft:diamond_sword", 0, false),
        new Case("attack-up", "minecraft:diamond_sword", -85, false),
        new Case("attack-down", "minecraft:diamond_sword", 85, false),
        new Case("lantern-right-third", "minecraft:lantern", 0, false),
        new Case("soul-lantern-right-third", "minecraft:soul_lantern", 0, false),
        new Case("lantern-right-first", "minecraft:lantern", 0, true),
        new Case("soul-lantern-right-first", "minecraft:soul_lantern", 0, true));

    PoseScene() {
        try {
            JsonObject selection = JsonParser.parseString(Files.readString(root.resolve("animation-pose.json"))).getAsJsonObject();
            mode = selection.get("mode").getAsString();
            combatPitch = selection.has("combatPitchRepair") && selection.get("combatPitchRepair").getAsBoolean();
            combatNativeSamples = selection.has("combatNativeSamples") && selection.get("combatNativeSamples").getAsBoolean();
            combatFullAxis = selection.has("combatFullAxisRepair") && selection.get("combatFullAxisRepair").getAsBoolean();
            productionCombatReference = selection.has("productionCombatReference") && selection.get("productionCombatReference").getAsBoolean();
            if (productionCombatReference) {
                if (combatPitch || combatFullAxis || OverlayBoneProbe.enabled() || NativeUsePoseProbe.enabled())
                    throw new IllegalStateException("Production reference refuses private repair write flags");
                Class<?> featureClass = Class.forName("design.inherent.skyweavecompat.Feature");
                Class<?> integrations = Class.forName("design.inherent.skyweavecompat.OptionalIntegrations");
                for (String[] feature : List.of(new String[]{"COMBAT_ATTACK_PITCH", "expectedCombatFeature"},
                        new String[]{"MOVES_OVERLAY_BONES", "expectedBoneFeature"})) {
                    Object constant = featureClass.getField(feature[0]).get(null);
                    boolean enabled = (boolean) integrations.getMethod("enabled", featureClass).invoke(null, constant);
                    if (enabled != selection.get(feature[1]).getAsBoolean())
                        throw new IllegalStateException("Actual production feature differs: " + feature[0]);
                    result.addProperty(feature[0], enabled);
                }
                Path archive = ModList.get().getModFileById("skyweave_compat").getFile().getFilePath();
                String sha = HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(archive)));
                if (!sha.equals(selection.get("compatArchiveSha256").getAsString()))
                    throw new IllegalStateException("Actual loaded Compat archive differs");
                result.addProperty("actualCompatArchiveSha256", sha);
                if (selection.has("expectedLanternFeature")) {
                    Object feature = featureClass.getField("LANTERN_GRIP").get(null);
                    boolean enabled = (boolean) integrations.getMethod("enabled", featureClass).invoke(null, feature);
                    if (enabled != selection.get("expectedLanternFeature").getAsBoolean())
                        throw new IllegalStateException("Actual lantern feature differs");
                    result.addProperty("LANTERN_GRIP", enabled);
                }
            }
            lanternLifecycle = selection.has("lanternLifecycle") && selection.get("lanternLifecycle").getAsBoolean();
            lanternLifecycleHotbar = selection.has("lanternLifecycleHotbar") && selection.get("lanternLifecycleHotbar").getAsBoolean();
            if (lanternLifecycleHotbar && !lanternLifecycle) throw new IllegalArgumentException("Hotbar lifecycle requires lifecycle selection");
            if (lanternLifecycle && !(selection.has("lanternHands") && selection.get("lanternHands").getAsBoolean()))
                throw new IllegalArgumentException("Lantern lifecycle requires the explicit lantern hands selection");
            if (combatFullAxis && !combatPitch) throw new IllegalArgumentException("Full-axis probe requires explicit combat pitch probe");
            if (selection.has("combatHands") && selection.get("combatHands").getAsBoolean()) {
                cases = new ArrayList<>();
                for (boolean first : List.of(false, true)) {
                    for (HumanoidArm main : HumanoidArm.values()) {
                        for (int pitch : new int[]{0, -30, -60, -85, 85}) {
                            String name = "attack-" + main.name().toLowerCase(Locale.ROOT) + "-pitch" + pitch
                                + "-" + (first ? "first" : "third");
                            cases.add(new Case(name, "minecraft:diamond_sword", pitch, first, main, EquipmentSlot.MAINHAND));
                        }
                    }
                }
            }
            if (selection.has("lanternHands") && selection.get("lanternHands").getAsBoolean()) {
                cases = new ArrayList<>();
                for (String item : List.of("lantern", "soul_lantern")) {
                    for (boolean first : List.of(false, true)) {
                        for (HumanoidArm main : HumanoidArm.values()) {
                            for (EquipmentSlot slot : List.of(EquipmentSlot.MAINHAND, EquipmentSlot.OFFHAND)) {
                                String hand = (slot == EquipmentSlot.MAINHAND ? main : main.getOpposite()).name().toLowerCase(Locale.ROOT);
                                String name = item + "-" + (slot == EquipmentSlot.MAINHAND ? "main-" : "off-") + hand + "-" + (first ? "first" : "third");
                                cases.add(new Case(name, "minecraft:" + item, 0, first, main, slot));
                            }
                        }
                    }
                }
                if (selection.has("thirdOnly") && selection.get("thirdOnly").getAsBoolean())
                    cases.removeIf(entry -> entry.first);
                if (lanternLifecycle) {
                    List<Case> initial = List.copyOf(cases);
                    for (Case entry : initial)
                        cases.add(new Case(entry.name + "-reloaded", entry.item, entry.pitch, entry.first, entry.mainArm, entry.slot));
                }
            }
            if (productionCombatReference && selection.has("coreBoneCases") && selection.get("coreBoneCases").getAsBoolean()) {
                for (String item : List.of("lantern", "soul_lantern"))
                    for (HumanoidArm main : HumanoidArm.values())
                        for (EquipmentSlot slot : List.of(EquipmentSlot.MAINHAND, EquipmentSlot.OFFHAND)) {
                            String hand = (slot == EquipmentSlot.MAINHAND ? main : main.getOpposite()).name().toLowerCase(Locale.ROOT);
                            cases.add(new Case(item + "-" + (slot == EquipmentSlot.MAINHAND ? "main-" : "off-") + hand
                                + "-third", "minecraft:" + item, 0, false, main, slot));
                        }
                cases.add(new Case("arm-filter-bow-first", "minecraft:bow", 0, true));
                cases.add(new Case("arm-filter-bow-third", "minecraft:bow", 0, false));
            }
            if (!Set.of("full", "no-touch", "no-moves").contains(mode)) throw new IllegalArgumentException("Unknown pose control");
            boolean moves = ModList.get().isLoaded("punchy_moves"), touch = ModList.get().isLoaded("touch_n_motion");
            if (moves != !mode.equals("no-moves") || touch != mode.equals("full")) throw new IllegalStateException("Control provider presence differs from selection");
            result.addProperty("mode", mode);
            result.addProperty("movesPresent", moves);
            result.addProperty("touchPresent", touch);
            result.addProperty("scope", selection.has("combatHands") && selection.get("combatHands").getAsBoolean()
                ? "Native sword-animation pitch matrix: five aim pitches, both dominant arms, first/third person; same-partial original/patched library reads. Private probe only, no gameplay/damage/remote-player acceptance"
                : selection.has("lanternHands") && selection.get("lanternHands").getAsBoolean()
                ? "Native lantern hands matrix: regular/soul, first/third person, main/offhand and both dominant arms. Original render/profile observations; no use, movement, reload, shader, or gameplay qualification"
                : "Registered native sword-animation API, rendered third-person model before original draw, and first-person held screenshots; no gameplay targeting, damage, input-dispatch, or observer-network qualification");
            result.addProperty("caseCount", cases.size());
            result.addProperty("probeOnlyCombatPitchRepair", combatPitch);
            result.addProperty("probeOnlyCombatFullAxisRepair", combatFullAxis);
            result.addProperty("probeOnlyOverlayBoneRepair", OverlayBoneProbe.enabled());
            result.addProperty("productionCombatReference", productionCombatReference);
            if (productionCombatReference)
                result.addProperty("scope", "Passive current-pack production Compat combat/overlay controls; all private repair writes disabled. Original reads use test-only scoped native invoker. No gameplay or complete fitting inference.");
            if (selection.has("thirdOnly") && selection.get("thirdOnly").getAsBoolean())
                result.addProperty("scope", "Original third-person lantern matrix: both lanterns, dominant arms and main/offhand; source and actual item matrix consumers. No first-person qualification from this selection.");
            if (lanternLifecycle)
                result.addProperty("scope", "Selected lantern equipment lifecycle: native slot changes trigger equip/remove/re-equip, sampled item-pose/draw identity and one native resource reload. Both lanterns/hands/views; no real input, movement, shader, remote, or complete transition acceptance inferred.");
            result.addProperty("lanternLifecycle", lanternLifecycle);
            result.addProperty("lanternLifecycleHotbar", lanternLifecycleHotbar);
            Class<?> arms = Class.forName("punchy.client.render.PunchyArmRenderer");
            cachedArmWorld = arms.getMethod("getCachedArmWorld", net.minecraft.client.player.LocalPlayer.class, HumanoidArm.class);
            baselineUseTransform = arms.getMethod("getBaselineUseTransform");
            active = this;
            NeoForge.EVENT_BUS.addListener(this::tick);
            NeoForge.EVENT_BUS.addListener(this::frame);
        } catch (Exception error) {
            throw new RuntimeException(error);
        }
    }

    private void tick(ClientTickEvent.Post event) {
        if (done) return;
        Minecraft mc = Minecraft.getInstance();
        try {
            if (++ticks > 4500) throw new IllegalStateException("Pose fixture exceeded its tick bound");
            if (!opened && mc.screen instanceof TitleScreen && mc.getOverlay() == null) {
                opened = true;
                mc.tell(() -> mc.createWorldOpenFlows().createFreshLevel("animation-pose-flat",
                    new LevelSettings("Animation pose control", GameType.CREATIVE, false, Difficulty.PEACEFUL,
                        true, new GameRules(), WorldDataConfiguration.DEFAULT), new WorldOptions(1527L, false, false),
                    access -> access.registryOrThrow(Registries.WORLD_PRESET).get(ResourceLocation.withDefaultNamespace("flat")).createWorldDimensions(), mc.screen));
                return;
            }
            if (mc.level == null || mc.player == null || mc.getOverlay() != null || mc.screen != null) return;
            if (++age < 60) return;
            if (!prepared) {
                prepared = true;
                if (productionCombatReference && ModList.get().isLoaded("dynamic_fps")) {
                    Class<?> config = Class.forName("dynamic_fps.impl.config.DynamicFPSConfig");
                    Object instance = config.getField("INSTANCE").get(null);
                    boolean enabled = (boolean) config.getMethod("enabled").invoke(instance);
                    boolean disabled = (boolean) Class.forName("dynamic_fps.impl.DynamicFPSMod").getMethod("isDisabled").invoke(null);
                    if (enabled || !disabled) throw new IllegalStateException("Native Dynamic FPS is not disabled");
                    result.addProperty("nativeDynamicFpsEnabled", enabled);
                    result.addProperty("nativeDynamicFpsDisabled", disabled);
                }
                mc.options.hideGui = true;
                anchor = new ArmorStand(mc.level, mc.player.getX(), mc.player.getY() + 0.2, mc.player.getZ() - 1.4);
                anchor.setInvisible(true);
                anchor.setYRot(0);
                anchor.yRotO = 0;
                anchor.setXRot(8);
                anchor.xRotO = 8;
                anchor.setOldPosAndRot();
                mc.setCameraEntity(anchor);
                mc.options.setCameraType(CameraType.THIRD_PERSON_BACK);
                JsonObject mods = new JsonObject();
                ModList.get().getMods().forEach(mod -> mods.addProperty(mod.getModId(), mod.getVersion().toString()));
                result.add("mods", mods);
                JsonArray resources = new JsonArray();
                for (String path : List.of("models/block/lantern.json", "models/block/soul_lantern.json",
                        "models/block/lantern_hanging.json", "models/block/soul_lantern_hanging.json",
                        "items/lantern.json", "items/soul_lantern.json", "punchy/compat/punchy.json")) {
                    ResourceLocation id = ResourceLocation.fromNamespaceAndPath("minecraft", path);
                    var resource = mc.getResourceManager().getResource(id).orElseThrow();
                    JsonObject witness = new JsonObject();
                    witness.addProperty("id", id.toString());
                    witness.addProperty("sourcePack", resource.sourcePackId());
                    try (var stream = resource.open()) {
                        byte[] data = stream.readAllBytes();
                        witness.addProperty("sha256", HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(data)));
                        witness.add("value", JsonParser.parseString(new String(data, java.nio.charset.StandardCharsets.UTF_8)));
                    }
                    resources.add(witness);
                }
                result.add("lanternResources", resources);
                resourceAdmission(mc, "initial");
                initialActorAfterFrame = completedFrames;
            }
            if (lanternLifecycle && !initialActorReady) {
                if (lastNativeActorFrame < initialActorAfterFrame) return;
                initialActorReady = true;
                lifecycleEvent("initialActorDrawReady");
            }
            if (lanternLifecycle && phase == cases.size() / 2 - 1 && phaseTick >= 80 && !reloadRequested) {
                reloadRequested = true;
                lifecycleEvent("reloadRequested");
                mc.tell(() -> mc.reloadResourcePacks().whenComplete((ignored, failure) -> mc.tell(() -> {
                    if (failure != null) {
                        traceErrors.add("Native resource reload: " + failure);
                        finish(mc, "error");
                        return;
                    }
                    resourceEpoch++;
                    reloadCompleted = true;
                    resourceAdmission(mc, "reloaded");
                    reloadActorAfterFrame = completedFrames;
                    waitingForReloadActor = true;
                    mc.setCameraEntity(anchor);
                    mc.options.setCameraType(CameraType.THIRD_PERSON_BACK);
                    lifecycleEvent("reloadCompleted");
                })));
                return;
            }
            if (reloadRequested && !reloadCompleted) return;
            if (waitingForReloadActor) {
                if (lastNativeActorFrame < reloadActorAfterFrame) return;
                waitingForReloadActor = false;
                lifecycleEvent("reloadedActorDrawReady");
            }
            if (phase < 0 || phaseTick >= (lanternLifecycle ? 80 : 60)) {
                mc.options.keyAttack.setDown(false);
                if (productionCombatReference) mc.options.keyUse.setDown(false);
                phase++;
                phaseTick = 0;
                if (phase == cases.size()) { finish(mc, "completed"); return; }
                Case entry = cases.get(phase);
                mc.options.hideGui = !entry.first;
                equipCase(mc, entry, !lanternLifecycle, lanternLifecycle ? "clearBeforeEquip" : "selectCase");
                if (entry.first) {
                    mc.setCameraEntity(mc.player);
                    mc.options.setCameraType(CameraType.FIRST_PERSON);
                } else {
                    mc.setCameraEntity(entry.name.startsWith("arm-filter-bow") ? mc.player : anchor);
                    mc.options.setCameraType(entry.name.startsWith("arm-filter-bow") ? CameraType.THIRD_PERSON_FRONT : CameraType.THIRD_PERSON_BACK);
                }
            }
            Case entry = cases.get(phase);
            mc.player.setYRot(180);
            mc.player.yRotO = 180;
            mc.player.yBodyRot = mc.player.yBodyRotO = 180;
            mc.player.yHeadRot = mc.player.yHeadRotO = 180;
            mc.player.setXRot(entry.pitch);
            mc.player.xRotO = entry.pitch;
            phaseTick++;
            if (entry.name.startsWith("arm-filter-bow")) {
                if (phaseTick == 12) {
                    mc.options.keyUse.setDown(true);
                    net.minecraft.client.KeyMapping.click(mc.options.keyUse.getKey());
                }
                if (phaseTick == 30) mc.options.keyUse.setDown(false);
            }
            if (lanternLifecycle && (phaseTick == 6 || phaseTick == 50 || phaseTick == 66))
                equipCase(mc, entry, phaseTick != 50, phaseTick == 6 ? "equip" : phaseTick == 50 ? "remove" : "reequip");
            if (entry.name.startsWith("attack") && phaseTick == 12) {
                Class<?> helper = Class.forName("net.bettercombat.logic.PlayerAttackHelper");
                Class<?> playerType = net.minecraft.world.entity.player.Player.class;
                Object hand = helper.getMethod("getCurrentAttack", playerType, int.class).invoke(null, mc.player, 0);
                if (hand == null) throw new IllegalStateException("Native registered sword attack is unavailable");
                Object attack = hand.getClass().getMethod("attack").invoke(hand);
                String animation = (String) attack.getClass().getMethod("animation").invoke(attack);
                float length = ((Number) helper.getMethod("getAttackCooldownTicksCapped", playerType).invoke(null, mc.player)).floatValue();
                float upswing = ((Number) hand.getClass().getMethod("upswingRate").invoke(hand)).floatValue();
                Class<?> handType = Class.forName("net.bettercombat.logic.AnimatedHand");
                Object selectedHand = handType.getField("MAIN_HAND").get(null);
                mc.player.getClass().getMethod("playAttackAnimation", String.class, handType, float.class, float.class)
                    .invoke(mc.player, animation, selectedHand, length, upswing);
                JsonObject request = new JsonObject();
                request.addProperty("case", entry.name);
                request.addProperty("animation", animation);
                request.addProperty("lengthTicks", length);
                request.addProperty("upswing", upswing);
                request.addProperty("comboIndex", 0);
                request.addProperty("hand", "MAIN_HAND");
                animationRequests.add(request);
            }
            if (entry.name.startsWith("attack") && phaseTick == 30)
                mc.player.getClass().getMethod("stopAttackAnimation", float.class).invoke(mc.player, 2.0f);
        } catch (Throwable error) {
            result.addProperty("failure", error.toString());
            result.add("stack", JSON.toJsonTree(Arrays.stream(error.getStackTrace()).map(Object::toString).toList()));
            finish(mc, "error");
        }
    }

    private void lifecycleEvent(String stage) {
        JsonObject row = new JsonObject();
        row.addProperty("stage", stage);
        row.addProperty("case", phase >= 0 && phase < cases.size() ? cases.get(phase).name : "none");
        row.addProperty("phaseTick", phaseTick);
        row.addProperty("frame", completedFrames);
        row.addProperty("resourceEpoch", resourceEpoch);
        if (Minecraft.getInstance().player != null)
            row.addProperty("selectedHotbarSlot", Minecraft.getInstance().player.getInventory().selected);
        if (stage.equals("reloadRequested") || stage.equals("reloadCompleted")) {
            JsonArray resources = new JsonArray();
            for (String path : List.of("punchy_moves:compat/develop.json",
                    "punchy_moves:compat/zz_skyweave_lantern_fit19.json",
                    "punchy_moves:animations/create_skyweave/lantern-fit19.animation.json",
                    "minecraft:punchy/compat/punchy.json", "minecraft:items/lantern.json")) {
                JsonObject witness = new JsonObject();
                witness.addProperty("id", path);
                var resource = Minecraft.getInstance().getResourceManager().getResource(ResourceLocation.parse(path));
                witness.addProperty("present", resource.isPresent());
                if (resource.isPresent()) {
                    witness.addProperty("sourcePack", resource.get().sourcePackId());
                    try (var input = resource.get().open()) {
                        witness.addProperty("sha256", HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(input.readAllBytes())));
                    } catch (Exception error) { traceErrors.add("Lifecycle resource witness: " + error); }
                }
                resources.add(witness);
            }
            row.add("resources", resources);
        }
        lifecycleEvents.add(row);
    }

    private void equipCase(Minecraft mc, Case entry, boolean present, String reason) {
        Item item = BuiltInRegistries.ITEM.getOptional(ResourceLocation.parse(entry.item)).orElseThrow();
        var server = mc.getSingleplayerServer();
        UUID playerId = mc.player.getUUID();
        int selectedPhase = phase, selectedTick = phaseTick, selectedEpoch = resourceEpoch;
        server.execute(() -> {
            JsonObject witness = new JsonObject();
            try {
                var player = Objects.requireNonNull(server.getPlayerList().getPlayer(playerId), "Owned fixture player absent");
                if (lanternLifecycleHotbar) player.getInventory().selected = present ? 1 : 0;
                player.setMainArm(entry.mainArm);
                player.setItemSlot(EquipmentSlot.MAINHAND, present && entry.slot == EquipmentSlot.MAINHAND ? new ItemStack(item) : ItemStack.EMPTY);
                player.setItemSlot(EquipmentSlot.OFFHAND, present && entry.slot == EquipmentSlot.OFFHAND ? new ItemStack(item) : ItemStack.EMPTY);
                player.inventoryMenu.broadcastChanges();
                server.overworld().setDayTime(6000);
                witness.addProperty("mainItem", BuiltInRegistries.ITEM.getKey(player.getMainHandItem().getItem()).toString());
                witness.addProperty("offItem", BuiltInRegistries.ITEM.getKey(player.getOffhandItem().getItem()).toString());
                witness.addProperty("serverTick", server.getTickCount());
                witness.addProperty("selectedHotbarSlot", player.getInventory().selected);
            } catch (Throwable failure) {
                if (!lanternLifecycle) throw new RuntimeException("Owned case equipment failed", failure);
                witness.addProperty("failure", failure.toString());
            }
            if (lanternLifecycle) {
                witness.addProperty("case", entry.name); witness.addProperty("stage", reason);
                witness.addProperty("phase", selectedPhase); witness.addProperty("phaseTick", selectedTick);
                witness.addProperty("resourceEpoch", selectedEpoch); lifecycleServerEvents.add(witness);
            }
        });
        if (lanternLifecycleHotbar) mc.player.getInventory().selected = present ? 1 : 0;
        mc.player.setMainArm(entry.mainArm);
        mc.player.setItemSlot(EquipmentSlot.MAINHAND, present && entry.slot == EquipmentSlot.MAINHAND ? new ItemStack(item) : ItemStack.EMPTY);
        mc.player.setItemSlot(EquipmentSlot.OFFHAND, present && entry.slot == EquipmentSlot.OFFHAND ? new ItemStack(item) : ItemStack.EMPTY);
        if (lanternLifecycle) lifecycleEvent(reason);
    }

    private boolean poseSampleFrame(String channel) {
        if (productionCombatReference && channel.equals("overlay"))
            return Set.of(2, 8, 12, 18, 26, 40).contains(phaseTick);
        if (!lanternLifecycle) return phaseTick == 40;
        if (!Set.of(2, 8, 12, 18, 32, 48, 56, 72, 78).contains(phaseTick)) return false;
        String key = channel + ":" + phase + ":" + phaseTick;
        int frame = lifecycleSampleFrames.computeIfAbsent(key, ignored -> completedFrames);
        return frame == completedFrames;
    }

    private void frame(RenderFrameEvent.Post event) {
        completedFrames++;
        if (done || phase < 0 || phase >= cases.size() || Minecraft.getInstance().level == null) return;
        if (lanternLifecycle ? !Set.of(2, 8, 12, 18, 32, 48, 56, 72, 78).contains(phaseTick)
                : phaseTick != 10 && phaseTick != 18 && phaseTick != 26 && phaseTick != 40) return;
        Path file = root.resolve(cases.get(phase).name + "-" + phaseTick + ".png");
        if (Files.exists(file)) return;
        Minecraft mc = Minecraft.getInstance();
        double cameraDistance = mc.gameRenderer.getMainCamera().getPosition().distanceTo(mc.player.position());
        if (!cases.get(phase).first && cameraDistance > 12) throw new IllegalStateException("Observer camera is outside the controlled actor scene");
        JsonObject witness = new JsonObject();
        witness.addProperty("file", file.getFileName().toString());
        witness.addProperty("cameraDistance", cameraDistance);
        witness.addProperty("camera", mc.gameRenderer.getMainCamera().getPosition().toString());
        witness.addProperty("actor", mc.player.position().toString());
        witness.addProperty("hideGui", mc.options.hideGui);
        witness.addProperty("cameraType", mc.options.getCameraType().name());
        Case selected = cases.get(phase);
        witness.addProperty("heldItem", BuiltInRegistries.ITEM.getKey(mc.player.getItemBySlot(selected.slot).getItem()).toString());
        witness.addProperty("mainArm", mc.player.getMainArm().name());
        witness.addProperty("equipmentSlot", selected.slot.name());
        witness.addProperty("mainItem", BuiltInRegistries.ITEM.getKey(mc.player.getMainHandItem().getItem()).toString());
        witness.addProperty("offItem", BuiltInRegistries.ITEM.getKey(mc.player.getOffhandItem().getItem()).toString());
        witness.addProperty("drawCount", drawCount);
        imageWitnesses.add(witness);
        try (var image = Screenshot.takeScreenshot(mc.getMainRenderTarget())) {
            image.writeToFile(file);
        } catch (Exception error) {
            throw new RuntimeException(error);
        }
    }

    public static void draw(LivingEntityRenderer<?, ?> renderer, LivingEntity entity, float partial, PoseStack poses) {
        PoseScene scene = active;
        Minecraft mc = Minecraft.getInstance();
        if (scene == null || scene.done || entity != mc.player || !(renderer.getModel() instanceof PlayerModel<?> model)) return;
        scene.lastNativeActorFrame = scene.completedFrames;
        if (scene.phase < 0 || scene.phase >= scene.cases.size()) return;
        scene.observedRightArm = model.rightArm;
        scene.observedLeftArm = model.leftArm;
        if (++scene.drawCount > 6000) throw new IllegalStateException("Pose draw bound exceeded");
        JsonObject row = new JsonObject();
        row.addProperty("case", scene.cases.get(scene.phase).name);
        row.addProperty("phaseTick", scene.phaseTick);
        row.addProperty("partialTick", partial);
        row.addProperty("actorPitch", entity.getXRot());
        row.addProperty("modelClass", model.getClass().getName());
        row.addProperty("cameraType", mc.options.getCameraType().name());
        row.addProperty("cameraEntity", mc.getCameraEntity().getClass().getName());
        row.addProperty("swinging", mc.player.swinging);
        row.addProperty("heldItem", BuiltInRegistries.ITEM.getKey(mc.player.getItemBySlot(scene.cases.get(scene.phase).slot).getItem()).toString());
        row.addProperty("entityMatrix", poses.last().pose().toString());
        JsonObject parts = new JsonObject();
        for (String name : List.of("head", "body", "leftArm", "rightArm", "leftLeg", "rightLeg")) {
            try {
                ModelPart part = (ModelPart) model.getClass().getField(name).get(model);
                parts.add(name, JSON.toJsonTree(new float[]{part.xRot, part.yRot, part.zRot, part.x, part.y, part.z}));
            } catch (Exception error) { throw new RuntimeException(error); }
        }
        row.add("parts", parts);
        try {
            Object attack = entity.getClass().getMethod("getCurrentAttack").invoke(entity);
            row.addProperty("betterCombatCurrentAttack", String.valueOf(attack));
        } catch (Exception error) { row.addProperty("attackQueryError", error.toString()); }
        try {
            Object stack = entity.getClass().getMethod("getAnimationStack").invoke(entity);
            Class<?> transformType = Class.forName("dev.kosmx.playerAnim.api.TransformType");
            Class<?> vectorType = Class.forName("dev.kosmx.playerAnim.core.util.Vec3f");
            Object zero = vectorType.getField("ZERO").get(null);
            Method sample = stack.getClass().getMethod("get3DTransform", String.class, transformType, float.class, vectorType);
            JsonObject libraryParts = readLibraryParts(stack, sample, transformType, zero, partial);
            row.add("playerAnimationLibrary", libraryParts);
            if (scene.cases.get(scene.phase).name.startsWith("attack")) {
                row.add("playerAnimationLibraryOriginal", CombatPitchProbe.original(() -> {
                    try { return readLibraryParts(stack, sample, transformType, zero, partial); }
                    catch (ReflectiveOperationException error) { throw new RuntimeException(error); }
                }));
            }
            row.addProperty("playerAnimationLibraryActive", (Boolean) stack.getClass().getMethod("isActive").invoke(stack));
        } catch (Exception error) { row.addProperty("libraryQueryError", error.toString()); }
        scene.draws.add(row);
    }

    public static void kind(String channel, ItemStack item, Object fallback, Object resolved) {
        PoseScene scene = active;
        if (scene == null || scene.done || scene.phase < 0 || scene.phase >= scene.cases.size()) return;
        String id = BuiltInRegistries.ITEM.getKey(item.getItem()).toString();
        String key = scene.phase + ":" + channel + ":" + id + ":" + fallback + ":" + resolved;
        if (!scene.seenKinds.add(key)) return;
        JsonObject row = new JsonObject();
        row.addProperty("case", scene.cases.get(scene.phase).name);
        row.addProperty("phaseTick", scene.phaseTick);
        row.addProperty("channel", channel);
        row.addProperty("item", id);
        row.addProperty("fallback", String.valueOf(fallback));
        row.addProperty("resolved", String.valueOf(resolved));
        scene.kinds.add(row);
    }

    public static void itemMatrix(String stage, ItemStack item, ItemDisplayContext context, boolean left, PoseStack poses,
            net.minecraft.client.resources.model.BakedModel model) {
        PoseScene scene = active;
        if (!trackedItem(scene, item) || context == ItemDisplayContext.GUI || context == ItemDisplayContext.GROUND
                || context == ItemDisplayContext.FIXED || context == ItemDisplayContext.NONE) return;
        if (scene.itemMatrices.size() >= scene.cases.size() * 600) throw new IllegalStateException("Item matrix trace bound exceeded");
        JsonObject row = new JsonObject();
        row.addProperty("case", scene.cases.get(scene.phase).name);
        row.addProperty("phaseTick", scene.phaseTick);
        row.addProperty("stage", stage);
        row.addProperty("context", context.name());
        row.addProperty("frame", scene.completedFrames);
        row.addProperty("left", left);
        row.addProperty("item", BuiltInRegistries.ITEM.getKey(item.getItem()).toString());
        row.addProperty("modelClass", model.getClass().getName());
        row.add("itemPose", matrix(poses.last().pose()));
        var transform = model.getTransforms().getTransform(context);
        row.add("modelRotation", JSON.toJsonTree(new float[]{transform.rotation.x, transform.rotation.y, transform.rotation.z}));
        row.add("modelTranslation", JSON.toJsonTree(new float[]{transform.translation.x, transform.translation.y, transform.translation.z}));
        row.add("modelScale", JSON.toJsonTree(new float[]{transform.scale.x, transform.scale.y, transform.scale.z}));
        if (scene.phaseTick == 40) renderCoordinates(row);
        if (scene.cases.get(scene.phase).first) {
            try {
                Object arm = scene.cachedArmWorld.invoke(null, Minecraft.getInstance().player, left ? HumanoidArm.LEFT : HumanoidArm.RIGHT);
                if (arm instanceof org.joml.Matrix4f value) row.add("nativeArmWorldCache", matrix(value));
                Object baseline = scene.baselineUseTransform.invoke(null);
                if (baseline instanceof net.minecraft.client.renderer.block.model.ItemTransform value) {
                    row.add("baselineRotation", JSON.toJsonTree(new float[]{value.rotation.x, value.rotation.y, value.rotation.z}));
                    row.add("baselineTranslation", JSON.toJsonTree(new float[]{value.translation.x, value.translation.y, value.translation.z}));
                    row.add("baselineScale", JSON.toJsonTree(new float[]{value.scale.x, value.scale.y, value.scale.z}));
                }
            } catch (ReflectiveOperationException error) { scene.traceErrors.add(error.toString()); }
        }
        scene.itemMatrices.add(row);
    }

    public static void profile(String channel, ItemStack item, Object kind, boolean left, Object value) {
        PoseScene scene = active;
        if (!trackedItem(scene, item) || value == null) return;
        JsonObject row = new JsonObject();
        row.addProperty("case", scene.cases.get(scene.phase).name);
        row.addProperty("phaseTick", scene.phaseTick);
        row.addProperty("channel", channel);
        row.addProperty("item", BuiltInRegistries.ITEM.getKey(item.getItem()).toString());
        row.addProperty("kind", String.valueOf(kind));
        row.addProperty("left", left);
        JsonObject fields = new JsonObject();
        try {
            for (Field field : value.getClass().getFields()) {
                if (Modifier.isStatic(field.getModifiers())) continue;
                Object member = field.get(value);
                if (member instanceof Number || member instanceof Boolean || member instanceof Enum<?>)
                    fields.add(field.getName(), JSON.toJsonTree(member));
            }
        } catch (IllegalAccessException error) { scene.traceErrors.add(error.toString()); }
        row.add("fields", fields);
        String identity = scene.phase + ":" + channel + ":" + row.get("item") + ":" + left + ":" + fields;
        if (scene.seenProfiles.add(identity)) scene.profiles.add(row);
    }

    private static boolean trackedItem(PoseScene scene, ItemStack item) {
        if (scene == null || scene.done || scene.phase < 0 || scene.phase >= scene.cases.size()) return false;
        String expected = scene.cases.get(scene.phase).item;
        return BuiltInRegistries.ITEM.getKey(item.getItem()).toString().equals(expected);
    }

    private static JsonArray matrix(org.joml.Matrix4f value) {
        return JSON.toJsonTree(value.get(new float[16])).getAsJsonArray();
    }

    public static void thirdItemPose(String stage, net.minecraft.client.player.AbstractClientPlayer player,
            String bone, Object pose, PoseStack matrices) {
        PoseScene scene = active;
        Minecraft mc = Minecraft.getInstance();
        if (scene == null || scene.done || scene.phase < 0 || scene.phase >= scene.cases.size()
                || !scene.poseSampleFrame("third") || scene.cases.get(scene.phase).first || pose == null
                || player != null && player != mc.player) return;
        if (scene.thirdItemSamples.size() >= scene.cases.size() * 120)
            throw new IllegalStateException("Third item pose trace bound exceeded");
        if (bone != null) scene.thirdItemBones.put(pose, bone);
        Integer identity = scene.thirdItemIds.get(pose);
        if (identity == null) { identity = scene.thirdItemIds.size() + 1; scene.thirdItemIds.put(pose, identity); }
        JsonObject row = new JsonObject();
        row.addProperty("case", scene.cases.get(scene.phase).name);
        row.addProperty("phaseTick", scene.phaseTick);
        row.addProperty("frame", scene.completedFrames);
        row.addProperty("resourceEpoch", scene.resourceEpoch);
        row.addProperty("stage", stage);
        row.addProperty("poseIdentity", identity);
        row.addProperty("bone", scene.thirdItemBones.get(pose));
        row.addProperty("creativeFlying", mc.player.getAbilities().flying);
        row.addProperty("onGround", mc.player.onGround());
        if (matrices != null) row.add("matrix", matrix(matrices.last().pose()));
        try {
            for (String channel : List.of("position", "rotation", "scale"))
                row.add(channel, vector((org.joml.Vector3f) pose.getClass().getMethod(channel).invoke(pose)));
        } catch (ReflectiveOperationException error) { scene.traceErrors.add(error.toString()); }
        scene.thirdItemSamples.add(row);
    }

    public static void overlayResolution(ItemStack item, String action, boolean left, Object base, List<?> overlays) {
        PoseScene scene = active;
        if (!trackedItem(scene, item) || !scene.poseSampleFrame("overlay") || scene.cases.get(scene.phase).first) return;
        try {
            JsonObject row = new JsonObject();
            row.addProperty("case", scene.cases.get(scene.phase).name);
            row.addProperty("frame", scene.completedFrames);
            row.addProperty("phaseTick", scene.phaseTick);
            row.addProperty("resourceEpoch", scene.resourceEpoch);
            row.addProperty("action", action); row.addProperty("left", left);
            row.addProperty("baseClipPresent", base != null);
            JsonArray resolved = new JsonArray();
            for (Object overlay : overlays) {
                JsonObject value = new JsonObject();
                for (String name : List.of("bones", "mode")) {
                    Method method = overlay.getClass().getDeclaredMethod(name); method.setAccessible(true);
                    value.add(name, JSON.toJsonTree(method.invoke(overlay)));
                }
                Method applies = overlay.getClass().getDeclaredMethod("appliesTo", String.class); applies.setAccessible(true);
                value.addProperty("appliesRightItem", (Boolean) applies.invoke(overlay, "right_item"));
                value.addProperty("appliesLeftItem", (Boolean) applies.invoke(overlay, "left_item"));
                value.addProperty("appliesRightArm", (Boolean) applies.invoke(overlay, "right_arm"));
                value.addProperty("appliesLeftArm", (Boolean) applies.invoke(overlay, "left_arm"));
                resolved.add(value);
            }
            row.add("resolved", resolved);
            String identity = scene.phase + ":" + (scene.lanternLifecycle ? scene.phaseTick : 40) + ":" + action + ":" + left + ":" + resolved;
            if (scene.seenOverlayResolutions.add(identity)) scene.overlayResolutions.add(row);
        } catch (ReflectiveOperationException error) { scene.traceErrors.add(error.toString()); }
    }

    public static void nativeHandIn(ItemStack item, HumanoidArm arm, boolean forced, boolean started) {
        PoseScene scene = active;
        if (!trackedItem(scene, item) || !scene.lanternLifecycle) return;
        if (scene.nativeHandInStarts.size() >= scene.cases.size() * 8)
            throw new IllegalStateException("Native hand-in start trace bound exceeded");
        JsonObject row = new JsonObject();
        row.addProperty("case", scene.cases.get(scene.phase).name);
        row.addProperty("phaseTick", scene.phaseTick); row.addProperty("frame", scene.completedFrames);
        row.addProperty("resourceEpoch", scene.resourceEpoch); row.addProperty("arm", arm.name());
        row.addProperty("item", BuiltInRegistries.ITEM.getKey(item.getItem()).toString());
        row.addProperty("forced", forced); row.addProperty("started", started);
        row.add("callers", JSON.toJsonTree(StackWalker.getInstance().walk(stream -> stream.limit(12)
            .map(frame -> frame.getClassName() + "#" + frame.getMethodName()).toList())));
        scene.nativeHandInStarts.add(row);
    }

    private static JsonObject gripSample(String stage) {
        PoseScene scene = active;
        if (scene == null || scene.done || scene.phase < 0 || scene.phase >= scene.cases.size()
                || !scene.poseSampleFrame("grip") || !scene.cases.get(scene.phase).name.contains("lantern")) return null;
        if (scene.gripSamples.size() > scene.cases.size() * 160) throw new IllegalStateException("Grip trace bound exceeded");
        JsonObject row = new JsonObject();
        row.addProperty("case", scene.cases.get(scene.phase).name);
        row.addProperty("stage", stage);
        row.addProperty("frame", scene.completedFrames);
        row.addProperty("phaseTick", scene.phaseTick);
        row.addProperty("resourceEpoch", scene.resourceEpoch);
        row.addProperty("sequence", scene.gripSamples.size());
        Case entry = scene.cases.get(scene.phase);
        row.addProperty("expectedLeft", (entry.slot == EquipmentSlot.MAINHAND ? entry.mainArm : entry.mainArm.getOpposite()) == HumanoidArm.LEFT);
        scene.gripSamples.add(row);
        return row;
    }

    public static void gripPosition(ModelPart grip, ModelPart arm, boolean left, org.joml.Vector3f value) {
        JsonObject row = gripSample("authoredPosition");
        if (row == null) return;
        row.addProperty("left", left);
        if (value != null) row.add("returned", vector(value));
        row.add("gripPart", gripPart(grip)); row.add("armPart", gripPart(arm));
        try {
            Class<?> geometry = Class.forName("punchy.client.model.SimpleBedrockGeo");
            Field field = geometry.getDeclaredField("bedrockLocalPivots"); field.setAccessible(true);
            Map<?, ?> pivots = (Map<?, ?>) field.get(null);
            String primary = left ? "itemgrip_left" : "itemgrip_right";
            String alias = left ? "item_grip_left" : "item_grip_right";
            Object authored = pivots.get(primary);
            row.addProperty("pivotKey", authored == null ? alias : primary);
            if (authored == null) authored = pivots.get(alias);
            if (authored instanceof org.joml.Vector3f pivot) row.add("authoredBedrockPivotPixels", vector(pivot));
        } catch (ReflectiveOperationException error) { active.traceErrors.add(error.toString()); }
    }

    public static void gripTransform(String stage, PoseStack poses, org.joml.Vector3f value, Object profile, Boolean alternateRotationOrder) {
        JsonObject row = gripSample(stage);
        if (row == null) return;
        if (alternateRotationOrder != null) row.addProperty("alternateRotationOrder", alternateRotationOrder);
        if (value != null) row.add("value", vector(value));
        if (poses != null) row.add("matrix", matrix(poses.last().pose()));
        if (profile != null) {
            JsonObject fields = new JsonObject();
            try {
                for (Field field : profile.getClass().getFields()) {
                    if (Modifier.isStatic(field.getModifiers())) continue;
                    Object member = field.get(profile);
                    if (member instanceof Number || member instanceof Boolean || member instanceof Enum<?>)
                        fields.add(field.getName(), JSON.toJsonTree(member));
                }
            } catch (IllegalAccessException error) { active.traceErrors.add(error.toString()); }
            row.add("profile", fields);
        }
    }

    private static JsonArray vector(org.joml.Vector3f value) {
        return JSON.toJsonTree(new float[]{value.x, value.y, value.z}).getAsJsonArray();
    }

    private static JsonObject gripPart(ModelPart part) {
        JsonObject row = new JsonObject();
        if (part == null) { row.addProperty("present", false); return row; }
        row.addProperty("present", true);
        row.add("position", JSON.toJsonTree(new float[]{part.x, part.y, part.z}));
        row.add("rotation", JSON.toJsonTree(new float[]{part.xRot, part.yRot, part.zRot}));
        JsonArray cubes = new JsonArray();
        try {
            Field field = ModelPart.class.getDeclaredField("cubes"); field.setAccessible(true);
            for (Object value : (List<?>) field.get(part)) {
                var cube = (ModelPart.Cube) value;
                cubes.add(JSON.toJsonTree(new float[]{cube.minX, cube.minY, cube.minZ, cube.maxX, cube.maxY, cube.maxZ}));
            }
        } catch (ReflectiveOperationException error) { active.traceErrors.add(error.toString()); }
        row.add("cubes", cubes);
        return row;
    }

    private static void renderCoordinates(JsonObject row) {
        row.add("projection", matrix(com.mojang.blaze3d.systems.RenderSystem.getProjectionMatrix()));
        row.add("modelView", matrix(com.mojang.blaze3d.systems.RenderSystem.getModelViewMatrix()));
    }

    public static void armMatrix(ModelPart part, PoseStack poses) {
        PoseScene scene = active;
        if (scene == null || scene.done || scene.phase < 0 || scene.phase >= scene.cases.size()
                || part != scene.observedRightArm && part != scene.observedLeftArm) return;
        if (scene.lanternLifecycle && !scene.poseSampleFrame("third")) return;
        if (scene.armMatrices.size() >= scene.cases.size() * 900) throw new IllegalStateException("Arm trace bound exceeded");
        JsonObject row = new JsonObject();
        row.addProperty("case", scene.cases.get(scene.phase).name);
        row.addProperty("phaseTick", scene.phaseTick);
        row.addProperty("arm", part == scene.observedRightArm ? "right" : "left");
        row.addProperty("frame", scene.completedFrames);
        row.add("pose", matrix(poses.last().pose()));
        if (scene.phaseTick == 40) {
            renderCoordinates(row);
            // The original arm has one cube; observe its bounds without visiting/rendering it again.
            var cube = part.getRandomCube(net.minecraft.util.RandomSource.create(42));
            row.add("observedCubeBounds", JSON.toJsonTree(new float[]{cube.minX, cube.minY, cube.minZ,
                cube.maxX, cube.maxY, cube.maxZ}));
        }
        row.add("callers", JSON.toJsonTree(StackWalker.getInstance().walk(frames -> frames
            .filter(frame -> !frame.getClassName().startsWith("audit.animation."))
            .limit(12).map(frame -> frame.getClassName() + "#" + frame.getMethodName()).toList())));
        scene.armMatrices.add(row);
    }

    private static JsonObject readLibraryParts(Object stack, Method sample, Class<?> type, Object zero, float partial)
            throws ReflectiveOperationException {
        JsonObject parts = new JsonObject();
        for (String part : List.of("body", "head", "rightArm", "leftArm", "rightLeg", "leftLeg")) {
            JsonObject channels = new JsonObject();
            for (String channel : List.of("ROTATION", "BEND")) {
                Object value = sample.invoke(stack, part, type.getField(channel).get(null), partial, zero);
                JsonArray vector = new JsonArray();
                for (String getter : List.of("getX", "getY", "getZ"))
                    vector.add(((Number) value.getClass().getMethod(getter).invoke(value)).floatValue());
                channels.add(channel, vector);
            }
            parts.add(part, channels);
        }
        return parts;
    }

    public static boolean combatPitchEnabled() { return active != null && !active.done && active.combatPitch; }

    public static boolean combatFullAxisEnabled() { return active != null && !active.done && active.combatFullAxis; }

    public static boolean productionCombatReference() { return active != null && !active.done && active.productionCombatReference; }

    public static boolean wantsNativeRotationSamples() {
        return active != null && !active.done && active.combatNativeSamples
            && active.phase >= 0 && active.phase < active.cases.size()
            && (active.phaseTick == 18 || active.phaseTick == 26);
    }

    public static void nativeRotationSample(String part, String scope,
            dev.kosmx.playerAnim.core.util.Vec3f input, dev.kosmx.playerAnim.core.util.Vec3f actual,
            dev.kosmx.playerAnim.core.util.Vec3f original, float partial, int processor, List<String> callers) {
        PoseScene scene = active;
        if (!wantsNativeRotationSamples()) return;
        String key = scene.phase + ":" + scene.phaseTick + ":" + scene.completedFrames + ":" + part + ":" + scope + ":" + processor;
        if (!scene.seenNativeRotationSamples.add(key)) return;
        if (scene.nativeRotationSamples.size() >= scene.cases.size() * 128)
            throw new IllegalStateException("Native rotation sample bound exceeded");
        JsonObject row = new JsonObject();
        row.addProperty("case", scene.cases.get(scene.phase).name);
        row.addProperty("phaseTick", scene.phaseTick);
        row.addProperty("renderFrame", scene.completedFrames);
        row.addProperty("part", part);
        row.addProperty("scope", scope);
        row.addProperty("processor", processor);
        row.addProperty("partialTick", partial);
        row.addProperty("firstPersonPass", dev.kosmx.playerAnim.api.firstPerson.FirstPersonMode.isFirstPersonPass());
        row.add("input", JSON.toJsonTree(new float[]{input.getX(), input.getY(), input.getZ()}));
        row.add("actual", JSON.toJsonTree(new float[]{actual.getX(), actual.getY(), actual.getZ()}));
        row.add("original", JSON.toJsonTree(new float[]{original.getX(), original.getY(), original.getZ()}));
        row.add("callers", JSON.toJsonTree(callers));
        scene.nativeRotationSamples.add(row);
    }

    public static void pitchInstalled() {
        if (active != null) active.pitchInstallations++;
    }

    public static void pitchDecision(String part, boolean first,
            dev.kosmx.playerAnim.api.layered.modifier.AdjustmentModifier.PartModifier nativeValue,
            dev.kosmx.playerAnim.api.layered.modifier.AdjustmentModifier.PartModifier adjusted) {
        PoseScene scene = active;
        if (scene == null || scene.done || scene.phase < 0 || scene.phase >= scene.cases.size()) return;
        String identity = scene.phase + ":" + part + ":" + first + ":" + nativeValue.rotation() + ":" + adjusted.rotation();
        if (!scene.seenPitchDecisions.add(identity)) return;
        if (scene.pitchDecisions.size() >= scene.cases.size() * 32)
            throw new IllegalStateException("Combat pitch decision bound exceeded");
        JsonObject row = new JsonObject();
        row.addProperty("case", scene.cases.get(scene.phase).name);
        row.addProperty("part", part);
        row.addProperty("firstPersonPass", first);
        row.addProperty("sameObject", nativeValue == adjusted);
        row.addProperty("sameScale", nativeValue.scale().equals(adjusted.scale()));
        row.addProperty("sameOffset", nativeValue.offset().equals(adjusted.offset()));
        row.add("nativeRotation", JSON.toJsonTree(new float[]{nativeValue.rotation().getX(), nativeValue.rotation().getY(), nativeValue.rotation().getZ()}));
        row.add("adjustedRotation", JSON.toJsonTree(new float[]{adjusted.rotation().getX(), adjusted.rotation().getY(), adjusted.rotation().getZ()}));
        scene.pitchDecisions.add(row);
    }

    private void finish(Minecraft mc, String status) {
        done = true;
        mc.options.keyAttack.setDown(false);
        mc.options.keyUse.setDown(false);
        result.addProperty("status", status);
        result.addProperty("draws", drawCount);
        result.add("renderedPoses", draws);
        result.add("heldKindDecisions", kinds);
        result.add("imageWitnesses", imageWitnesses);
        result.add("nativeAnimationRequests", animationRequests);
        result.add("itemMatrices", itemMatrices);
        result.add("resolvedProfiles", profiles);
        result.add("armMatrices", armMatrices);
        result.addProperty("combatPitchInstallations", pitchInstallations);
        result.add("combatPitchDecisions", pitchDecisions);
        result.add("nativeRotationSamples", nativeRotationSamples);
        result.add("productionLanternCorrections", productionLanternCorrections);
        result.add("resourceAdmissions", resourceAdmissions);
        result.add("nativeGripSamples", gripSamples);
        result.add("nativeThirdItemSamples", thirdItemSamples);
        result.add("lifecycleEvents", lifecycleEvents);
        result.add("nativeHandInStarts", nativeHandInStarts);
        result.add("lifecycleServerEvents", JSON.toJsonTree(lifecycleServerEvents));
        result.addProperty("nativeResourceReloadCompleted", reloadCompleted);
        result.add("overlayResolutions", overlayResolutions);
        result.add("overlayBoneNormalization", JSON.toJsonTree(OverlayBoneProbe.samples()));
        result.addProperty("overlayBoneNormalizationCalls", OverlayBoneProbe.calls());
        result.add("traceErrors", traceErrors);
        if (!traceErrors.isEmpty()) result.addProperty("status", "error");
        try { Files.writeString(root.resolve("pose-result.json"), JSON.toJson(result)); }
        catch (Exception error) { throw new RuntimeException(error); }
        mc.tell(mc::stop);
    }

    public static void productionLanternPose(ModelPart arm, Object nativePose, Object corrected) {
        PoseScene scene = active;
        if (scene == null || scene.done || scene.phase < 0 || scene.cases.get(scene.phase).first || !scene.poseSampleFrame("third")) return;
        try {
            String bone = scene.thirdItemBones.get(nativePose);
            if (bone == null) throw new IllegalStateException("No native item source for production lantern result");
            scene.thirdItemBones.put(corrected, bone);
            scene.thirdItemIds.computeIfAbsent(corrected, ignored -> scene.thirdItemIds.size() + 1);
            JsonObject row = new JsonObject();
            row.addProperty("case", scene.cases.get(scene.phase).name);
            row.addProperty("phaseTick", scene.phaseTick);
            row.addProperty("frame", scene.completedFrames);
            row.addProperty("resourceEpoch", scene.resourceEpoch);
            row.addProperty("bone", bone);
            row.addProperty("sourcePoseIdentity", scene.thirdItemIds.get(nativePose));
            row.addProperty("correctedPoseIdentity", scene.thirdItemIds.get(corrected));
            row.add("nativeArm", JSON.toJsonTree(new float[]{arm.xRot, arm.yRot, arm.zRot}));
            for (String field : List.of("position", "rotation", "scale")) {
                for (var entry : Map.of("native", nativePose, "corrected", corrected).entrySet()) {
                    org.joml.Vector3f value = (org.joml.Vector3f) entry.getValue().getClass().getMethod(field).invoke(entry.getValue());
                    row.add(entry.getKey() + field, JSON.toJsonTree(new float[]{value.x, value.y, value.z}));
                }
            }
            scene.productionLanternCorrections.add(row);
        } catch (Exception failure) { scene.traceErrors.add("Production lantern observer: " + failure); }
    }

    private void resourceAdmission(Minecraft mc, String stage) {
        JsonObject row = new JsonObject();
        row.addProperty("stage", stage);
        row.add("selectedIds", JSON.toJsonTree(mc.getResourcePackRepository().getSelectedIds()));
        JsonArray sources = new JsonArray();
        for (String name : List.of("skyweave_compat:animation/lantern_grip.json", "minecraft:items/lantern.json",
                "minecraft:items/soul_lantern.json", "minecraft:punchy/compat/skyweave_lantern_grip.json")) {
            var resource = mc.getResourceManager().getResource(ResourceLocation.parse(name));
            JsonObject source = new JsonObject();
            source.addProperty("id", name);
            source.addProperty("present", resource.isPresent());
            if (resource.isPresent()) {
                source.addProperty("sourcePack", resource.get().sourcePackId());
                try (var stream = resource.get().open()) {
                    byte[] bytes = stream.readAllBytes();
                    source.addProperty("sha256", HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(bytes)));
                } catch (Exception failure) { throw new RuntimeException(failure); }
            }
            sources.add(source);
        }
        row.add("resources", sources);
        resourceAdmissions.add(row);
    }

    private record Case(String name, String item, float pitch, boolean first, HumanoidArm mainArm, EquipmentSlot slot) {
        Case(String name, String item, float pitch, boolean first) {
            this(name, item, pitch, first, HumanoidArm.RIGHT, EquipmentSlot.MAINHAND);
        }
    }
}
