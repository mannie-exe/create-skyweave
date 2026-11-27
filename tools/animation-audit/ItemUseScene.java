package audit.animation;

import com.google.gson.*;
import com.mojang.blaze3d.vertex.PoseStack;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import net.minecraft.client.*;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.client.model.PlayerModel;
import net.minecraft.client.renderer.entity.LivingEntityRenderer;
import net.minecraft.client.resources.model.BakedModel;
import net.minecraft.core.registries.*;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.*;
import net.minecraft.world.entity.*;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.entity.monster.Zombie;
import net.minecraft.world.entity.animal.Cow;
import net.minecraft.world.effect.MobEffects;
import net.minecraft.world.item.*;
import net.minecraft.world.level.*;
import net.minecraft.world.level.levelgen.WorldOptions;
import net.minecraft.world.phys.HitResult;
import net.minecraft.world.phys.Vec3;
import net.neoforged.neoforge.client.event.*;
import net.neoforged.neoforge.common.NeoForge;
import net.neoforged.fml.ModList;

/** Native use-key mapping in one marked, disposable survival world; no direct animation/item-use call. */
public final class ItemUseScene {
    private static final Gson JSON = new GsonBuilder().setPrettyPrinting().create();
    private static volatile ItemUseScene active;
    private final Path root = Minecraft.getInstance().gameDirectory.toPath();
    private final List<Case> cases = new ArrayList<>();
    private final JsonObject result = new JsonObject();
    private final JsonArray states = new JsonArray(), images = new JsonArray(), kinds = new JsonArray();
    private final JsonArray matrices = new JsonArray(), poses = new JsonArray(), properties = new JsonArray(), lidProperties = new JsonArray(), bows = new JsonArray();
    private final JsonArray caseAdmissions = new JsonArray(), usePoseProbes = new JsonArray();
    private final Map<UUID, String> ownedTargets = new LinkedHashMap<>();
    private final boolean umbrellaHorn;
    private final Queue<JsonObject> useEvents = new ConcurrentLinkedQueue<>(), serverSnapshots = new ConcurrentLinkedQueue<>();
    private final Queue<String> errors = new ConcurrentLinkedQueue<>();
    private final Map<ItemStack, StackContext> stackContexts = Collections.synchronizedMap(new IdentityHashMap<>());
    private final AtomicInteger eventCount = new AtomicInteger();
    private final Set<String> seenKinds = new HashSet<>(), seenProperties = new HashSet<>(), seenBows = new HashSet<>();
    private volatile Case selected;
    private volatile UUID playerId;
    private volatile int phaseTick, frame;
    private volatile boolean done;
    private boolean opened, prepared;
    private int ticks, age, index = -1;
    private CompletableFuture<?> pendingSeed, pendingFinal;
    private Field bowUsing, bowClip;
    private Method describeClip;
    private Method shouldGlide, uprightUmbrella;
    private Vec3 floorAnchor;

    public ItemUseScene() {
        JsonObject admission;
        try { admission = JSON.fromJson(Files.readString(root.resolve("animation-use.json")), JsonObject.class); }
        catch (Exception failure) { throw new IllegalArgumentException("Invalid owned use scene marker", failure); }
        String plan = admission.has("subjects") ? admission.get("subjects").getAsString() : "dough-package";
        umbrellaHorn = plan.equals("umbrella-horn");
        if (umbrellaHorn) {
            for (String item : List.of("minecraft:shield", "minecraft:goat_horn"))
                for (boolean first : List.of(true, false))
                    cases.add(new Case(item.substring(item.indexOf(':') + 1) + "-control-" + view(first), item,
                        first, HumanoidArm.RIGHT, EquipmentSlot.MAINHAND, 40, 1));
            for (String[] item : List.of(new String[]{"umbrella", "artifacts:umbrella"},
                    new String[]{"sight-horn", "illagerinvasion:horn_of_sight"}))
                for (boolean first : List.of(true, false))
                    for (HumanoidArm dominant : HumanoidArm.values())
                        for (EquipmentSlot slot : List.of(EquipmentSlot.MAINHAND, EquipmentSlot.OFFHAND))
                            cases.add(subject(item[0], item[1], first, dominant, slot, 40, 1));
            for (boolean first : List.of(true, false))
                for (EquipmentSlot slot : List.of(EquipmentSlot.MAINHAND, EquipmentSlot.OFFHAND))
                    cases.add(subject("umbrella-glide", "artifacts:umbrella", first, HumanoidArm.RIGHT, slot, 40, 1));
        } else if (plan.equals("shield-spyglass")) {
            for (String item : List.of("minecraft:shield", "minecraft:spyglass"))
                for (boolean first : List.of(true, false))
                    cases.add(new Case(item.substring(item.indexOf(':') + 1) + "-control-" + view(first), item,
                        first, HumanoidArm.RIGHT, EquipmentSlot.MAINHAND, 40, 1));
            for (String[] item : List.of(new String[]{"lid", "kaleidoscope_cookery:stockpot_lid"},
                    new String[]{"binoculars", "create_radar:binoculars"}))
                for (boolean first : List.of(true, false))
                    for (HumanoidArm dominant : HumanoidArm.values())
                        for (EquipmentSlot slot : List.of(EquipmentSlot.MAINHAND, EquipmentSlot.OFFHAND))
                            cases.add(subject(item[0], item[1], first, dominant, slot, 40, 1));
        } else if (plan.equals("dough-package")) {
        for (boolean first : List.of(true, false))
            cases.add(new Case("bow-control-" + view(first), "minecraft:bow", first, HumanoidArm.RIGHT, EquipmentSlot.MAINHAND, 40, 1));
        for (int hold : new int[]{12, 40})
            for (boolean first : List.of(true, false))
                for (HumanoidArm dominant : HumanoidArm.values())
                    for (EquipmentSlot slot : List.of(EquipmentSlot.MAINHAND, EquipmentSlot.OFFHAND))
                        cases.add(subject("dough", "kaleidoscope_cookery:raw_dough", first, dominant, slot, hold, 3));
        for (boolean first : List.of(true, false))
            for (HumanoidArm dominant : HumanoidArm.values())
                for (EquipmentSlot slot : List.of(EquipmentSlot.MAINHAND, EquipmentSlot.OFFHAND))
                    cases.add(subject("package", "create:cardboard_package_12x12", first, dominant, slot, 40, 1));
        if (admission.has("includeScopeControls") && admission.get("includeScopeControls").getAsBoolean()) {
            for (String[] item : List.of(new String[]{"spyglass-clock", "minecraft:spyglass"},
                    new String[]{"binoculars-clock", "create_radar:binoculars"}))
                for (boolean first : List.of(true, false))
                    cases.add(new Case(item[0] + "-control-" + view(first), item[1], first,
                        HumanoidArm.RIGHT, EquipmentSlot.MAINHAND, 40, 1));
            result.addProperty("includeScopeControls", true);
        }
        } else throw new IllegalArgumentException("Unknown owned use scene: " + plan);
        result.addProperty("subjects", plan);
        result.addProperty("scope", "Native registered use-key mapping, actual ItemStack.use/releaseUsing and original dispatch/property observations. Owned survival flat world, first and player-camera third-front, selected subject controls and both arms/slots. No physical OS-input, all-item fallback, moving/shader/remote or repair claim.");
        result.addProperty("caseCount", cases.size());
        result.addProperty("privateOverlayBoneRepair", OverlayBoneProbe.enabled());
        active = this;
        NeoForge.EVENT_BUS.addListener(this::tick);
        NeoForge.EVENT_BUS.addListener(this::frame);
    }

    private static String view(boolean first) { return first ? "first" : "third"; }
    private GameRules worldRules() {
        GameRules rules = new GameRules();
        if (umbrellaHorn) rules.getRule(GameRules.RULE_DOMOBSPAWNING).set(false, null);
        return rules;
    }
    private static JsonObject umbrellaSettings() throws ReflectiveOperationException {
        Object config = Class.forName("artifacts.Artifacts").getField("CONFIG").get(null);
        Object items = config.getClass().getField("items").get(config);
        Object umbrella = items.getClass().getField("umbrella").get(items);
        Method get = Class.forName("artifacts.config.value.ConfigValue").getMethod("get");
        JsonObject result = new JsonObject();
        for (String name : List.of("isShield", "isGlider"))
            result.addProperty(name, (Boolean) get.invoke(umbrella.getClass().getField(name).get(umbrella)));
        return result;
    }
    private synchronized JsonObject umbrellaState(LivingEntity actor) {
        try {
            if (shouldGlide == null) {
                Class<?> type = Class.forName("artifacts.item.UmbrellaItem");
                shouldGlide = type.getMethod("shouldGlide", LivingEntity.class);
                uprightUmbrella = type.getMethod("isHoldingUmbrellaUpright", LivingEntity.class);
            }
            JsonObject row = new JsonObject();
            row.addProperty("nativeShouldGlide", (Boolean) shouldGlide.invoke(null, actor));
            row.addProperty("nativeUpright", (Boolean) uprightUmbrella.invoke(null, actor));
            row.addProperty("onGround", actor.onGround()); row.addProperty("fallDistance", actor.fallDistance);
            row.addProperty("y", actor.getY()); row.addProperty("velocityY", actor.getDeltaMovement().y);
            return row;
        } catch (ReflectiveOperationException failure) { throw new IllegalStateException("Native umbrella observation failed", failure); }
    }
    private static Case subject(String family, String item, boolean first, HumanoidArm arm, EquipmentSlot slot, int hold, int count) {
        HumanoidArm physical = slot == EquipmentSlot.MAINHAND ? arm : arm.getOpposite();
        return new Case(family + "-" + (hold < 30 ? "short" : "long") + "-" + (slot == EquipmentSlot.MAINHAND ? "main" : "off")
            + "-" + physical.name().toLowerCase(Locale.ROOT) + "-" + view(first), item, first, arm, slot, hold, count);
    }

    private void tick(ClientTickEvent.Post ignored) {
        if (done) return;
        Minecraft mc = Minecraft.getInstance();
        try {
            if (++ticks > 4500) throw new IllegalStateException("Unique-use fixture tick bound exceeded");
            if (!opened && mc.screen instanceof TitleScreen && mc.getOverlay() == null) {
                opened = true;
                mc.tell(() -> mc.createWorldOpenFlows().createFreshLevel("animation-use-flat",
                    new LevelSettings("Animation unique use", GameType.SURVIVAL, false, umbrellaHorn ? Difficulty.NORMAL : Difficulty.PEACEFUL,
                        true, worldRules(), WorldDataConfiguration.DEFAULT), new WorldOptions(1527L, false, false),
                    access -> access.registryOrThrow(Registries.WORLD_PRESET).get(ResourceLocation.withDefaultNamespace("flat")).createWorldDimensions(), mc.screen));
                return;
            }
            if (mc.level == null || mc.player == null || mc.getOverlay() != null || mc.screen != null) return;
            if (++age < 80) return;
            if (!prepared) {
                prepared = true; playerId = mc.player.getUUID(); floorAnchor = mc.player.position();
                JsonObject hooks = new JsonObject();
                for (String[] target : new String[][]{
                        {"net.minecraft.world.item.ItemStack", "animationAudit$useHead"},
                        {"net.minecraft.world.item.ItemStack", "animationAudit$releaseReturn"},
                        {"net.minecraft.client.renderer.entity.ItemRenderer", "animationAudit$itemEntry"},
                        {"punchy.client.render.ToolKindResolver", "animationAudit$itemKind"},
                        {"punchy.client.state.BowStateMachine", "animationAudit$bowState"},
                        {"com.github.ysbbbbbb.kaleidoscopecookery.item.RawDoughItem", "animationAudit$doughProperty"},
                        {"com.github.ysbbbbbb.kaleidoscopecookery.item.StockpotLidItem", "animationAudit$lidProperty"}}) {
                    boolean installed = Arrays.stream(Class.forName(target[0]).getDeclaredMethods())
                        .anyMatch(method -> method.getName().contains(target[1]));
                    hooks.addProperty(target[0] + "#" + target[1], installed);
                }
                result.add("nativeHookPresence", hooks);
                if (hooks.entrySet().stream().anyMatch(entry -> !entry.getValue().getAsBoolean()))
                    throw new IllegalStateException("Native use observer hooks are not transformed: " + hooks);
                boolean punchyEnabled = (Boolean) Class.forName("punchy.config.PunchyConfig")
                    .getMethod("isModEnabled").invoke(null);
                result.addProperty("nativePunchyEnabled", punchyEnabled);
                if (umbrellaHorn) result.add("nativeUmbrellaSettings", umbrellaSettings());
                JsonObject admission = JSON.fromJson(Files.readString(root.resolve("animation-use.json")), JsonObject.class);
                if (admission.has("renderHookInventory") && admission.get("renderHookInventory").getAsBoolean())
                    result.add("nativeRenderHookInventory", RenderHookInventory.capture());
                if (admission.has("expectedNativeUsePose")) {
                    boolean transformed = Arrays.stream(Class.forName("punchymoves.client.PlayerAnimationEngine").getDeclaredMethods())
                        .anyMatch(method -> method.getName().contains("animationAudit$nativeUse"));
                    result.addProperty("nativeUsePoseHook", transformed);
                    result.addProperty("nativeUsePoseEnabled", NativeUsePoseProbe.enabled());
                    if (!transformed || admission.get("expectedNativeUsePose").getAsBoolean() != NativeUsePoseProbe.enabled())
                        throw new IllegalStateException("Native use pose probe differs from this fixture's admission");
                }
                if (admission.has("expectedPunchyEnabled")
                        && admission.get("expectedPunchyEnabled").getAsBoolean() != punchyEnabled)
                    throw new IllegalStateException("Actual Punchy enable state differs from this fixture's expectation");
                JsonObject providers = new JsonObject(), providerVersions = new JsonObject();
                for (String id : List.of("punchy", "punchy_moves", "touch_n_motion"))
                    providers.addProperty(id, ModList.get().isLoaded(id));
                ModList.get().getMods().forEach(mod -> {
                    if (providers.has(mod.getModId())) providerVersions.addProperty(mod.getModId(), mod.getVersion().toString());
                });
                result.add("loadedAnimationProviders", providers);
                result.add("loadedAnimationProviderVersions", providerVersions);
                if (admission.has("expectedProviders"))
                    for (var entry : admission.getAsJsonObject("expectedProviders").entrySet())
                        if (!providers.has(entry.getKey())
                                || providers.get(entry.getKey()).getAsBoolean() != entry.getValue().getAsBoolean())
                            throw new IllegalStateException("Loaded animation providers differ from this fixture's expectation: " + providers);
                result.add("requestedResourcePacks", JSON.toJsonTree(mc.options.resourcePacks));
                result.add("activeResourcePacks", JSON.toJsonTree(mc.getResourceManager().listPacks().map(p -> p.packId()).toList()));
                result.addProperty("useKey", mc.options.keyUse.getKey().getName());
                result.addProperty("useKeyDriver", "setDown + KeyMapping.click(actual configured key), release by setDown(false); native Minecraft handles interaction and release");
            }
            if (selected == null || phaseTick >= 80) {
                if (pendingFinal != null && !pendingFinal.isDone()) return;
                mc.options.keyUse.setDown(false);
                if (++index == cases.size()) { finish(mc, "completed"); return; }
                selected = cases.get(index); phaseTick = 0; pendingFinal = null;
                seed(mc, selected);
                return;
            }
            if (pendingSeed != null && !pendingSeed.isDone()) return;
            Case current = selected;
            mc.player.setYRot(180); mc.player.yRotO = 180;
            mc.player.yBodyRot = mc.player.yBodyRotO = 180;
            mc.player.yHeadRot = mc.player.yHeadRotO = 180;
            mc.player.setXRot(-15); mc.player.xRotO = -15;
            phaseTick++;
            if (phaseTick == 20) {
                if (mc.getCameraEntity() != mc.player || mc.hitResult == null || mc.hitResult.getType() != HitResult.Type.MISS)
                    throw new IllegalStateException("Use driver refuses a non-player camera or non-miss target: " + mc.hitResult);
                mc.options.keyUse.setDown(true);
                KeyMapping.click(mc.options.keyUse.getKey());
            }
            if (phaseTick == 20 + current.holdTicks) mc.options.keyUse.setDown(false);
            JsonObject state = clientState(mc); states.add(state);
            if (phaseTick == 26 || phaseTick == 18 + current.holdTicks || phaseTick == 74)
                snapshotServer(mc, current, "tick" + phaseTick, phaseTick == 74);
        } catch (Throwable failure) {
            errors.add(failure.toString());
            result.add("failureStack", JSON.toJsonTree(Arrays.stream(failure.getStackTrace()).map(Object::toString).toList()));
            finish(mc, "error");
        }
    }

    private void seed(Minecraft mc, Case current) throws ReflectiveOperationException {
        Item item = BuiltInRegistries.ITEM.getOptional(ResourceLocation.parse(current.item)).orElseThrow();
        mc.options.keyUse.setDown(false);
        mc.player.getInventory().clearContent(); mc.player.getInventory().selected = 0;
        mc.player.setMainArm(current.dominant);
        mc.player.setItemSlot(current.slot, new ItemStack(item, current.count));
        if (umbrellaHorn) {
            mc.player.getCooldowns().removeCooldown(item);
            JsonObject admission = new JsonObject(); admission.addProperty("case", current.name);
            admission.addProperty("nativeDuration", mc.player.getItemBySlot(current.slot).getUseDuration(mc.player));
            admission.addProperty("initialCooldown", mc.player.getCooldowns().isOnCooldown(item));
            if (item instanceof InstrumentItem) {
                Method method = InstrumentItem.class.getDeclaredMethod("getInstrument", ItemStack.class);
                method.setAccessible(true);
                Optional<?> instrument = (Optional<?>) method.invoke(item, mc.player.getItemBySlot(current.slot));
                admission.addProperty("instrumentPresent", instrument.isPresent());
                if (instrument.orElse(null) instanceof net.minecraft.core.Holder<?> holder)
                    admission.addProperty("instrument", holder.unwrapKey().map(key -> key.location().toString()).orElse("direct"));
                if (instrument.isEmpty() || admission.get("nativeDuration").getAsInt() <= current.holdTicks)
                    throw new IllegalStateException("Native horn instrument is unavailable or too short: " + admission);
            }
            caseAdmissions.add(admission);
        }
        if (current.item.equals("minecraft:bow")) mc.player.getInventory().setItem(9, new ItemStack(Items.ARROW, 16));
        mc.setCameraEntity(mc.player);
        mc.options.setCameraType(current.first ? CameraType.FIRST_PERSON : CameraType.THIRD_PERSON_FRONT);
        mc.options.hideGui = !current.first;
        var server = mc.getSingleplayerServer(); UUID id = playerId;
        pendingSeed = server.submit(() -> {
            var player = Objects.requireNonNull(server.getPlayerList().getPlayer(id));
            player.setGameMode(GameType.SURVIVAL);
            player.getInventory().clearContent(); player.getInventory().selected = 0;
            player.setMainArm(current.dominant);
            player.setItemSlot(current.slot, new ItemStack(item, current.count));
            if (umbrellaHorn) {
                player.getCooldowns().removeCooldown(item);
                for (UUID target : ownedTargets.keySet()) {
                    Entity entity = player.serverLevel().getEntity(target);
                    if (entity != null) entity.discard();
                }
                ownedTargets.clear();
                player.connection.teleport(floorAnchor.x, floorAnchor.y + (current.name.startsWith("umbrella-glide") ? 128 : 0),
                    floorAnchor.z, 180, -15);
                player.setDeltaMovement(Vec3.ZERO); player.fallDistance = 0;
                if (item instanceof InstrumentItem) {
                    Zombie near = EntityType.ZOMBIE.create(player.serverLevel());
                    Zombie far = EntityType.ZOMBIE.create(player.serverLevel());
                    Cow neutral = EntityType.COW.create(player.serverLevel());
                    for (Map.Entry<net.minecraft.world.entity.Mob, String> target : Map.<net.minecraft.world.entity.Mob, String>of(
                            Objects.requireNonNull(near), "near-enemy", Objects.requireNonNull(far), "far-enemy",
                            Objects.requireNonNull(neutral), "near-neutral").entrySet()) {
                        var entity = target.getKey();
                        entity.setPos(floorAnchor.x + (target.getValue().equals("far-enemy") ? 60 : 8),
                            floorAnchor.y, floorAnchor.z + 5);
                        entity.setNoAi(true); entity.setInvulnerable(true); entity.setSilent(true); entity.setPersistenceRequired();
                        if (!player.serverLevel().addFreshEntity(entity)) throw new IllegalStateException("Owned horn target spawn refused");
                        ownedTargets.put(entity.getUUID(), target.getValue());
                    }
                }
            }
            if (current.item.equals("minecraft:bow")) player.getInventory().setItem(9, new ItemStack(Items.ARROW, 16));
            player.inventoryMenu.broadcastChanges();
            server.overworld().setDayTime(6000);
            serverSnapshots.add(serverState(player, current, "seed", 0));
        }).whenComplete((value, failure) -> { if (failure != null) errors.add("Seed: " + failure); });
    }

    private void snapshotServer(Minecraft mc, Case current, String stage, boolean last) {
        UUID id = playerId; int observed = phaseTick;
        var future = mc.getSingleplayerServer().submit(() -> {
            ServerPlayer player = Objects.requireNonNull(mc.getSingleplayerServer().getPlayerList().getPlayer(id));
            serverSnapshots.add(serverState(player, current, stage, observed));
        }).whenComplete((value, failure) -> { if (failure != null) errors.add("Server snapshot: " + failure); });
        if (last) pendingFinal = future;
    }

    private static JsonObject stack(ItemStack stack) {
        JsonObject row = new JsonObject(); row.addProperty("id", BuiltInRegistries.ITEM.getKey(stack.getItem()).toString());
        row.addProperty("count", stack.getCount()); return row;
    }
    private static JsonObject inventory(Player player) {
        Map<String, Integer> counts = new TreeMap<>();
        for (int i = 0; i < player.getInventory().getContainerSize(); i++) {
            ItemStack stack = player.getInventory().getItem(i);
            if (!stack.isEmpty()) counts.merge(BuiltInRegistries.ITEM.getKey(stack.getItem()).toString(), stack.getCount(), Integer::sum);
        }
        return JSON.toJsonTree(counts).getAsJsonObject();
    }
    private JsonObject serverState(ServerPlayer player, Case current, String stage, int observed) {
        JsonObject row = new JsonObject(); row.addProperty("case", current.name); row.addProperty("stage", stage);
        row.addProperty("phaseTickObserved", observed); row.addProperty("serverTick", player.server.getTickCount());
        row.addProperty("using", player.isUsingItem()); row.addProperty("usingTicks", player.getTicksUsingItem());
        row.addProperty("blocking", player.isBlocking()); row.addProperty("scoping", player.isScoping());
        row.addProperty("heldDuration", player.getItemBySlot(current.slot).getUseDuration(player));
        row.addProperty("cooldown", player.getCooldowns().isOnCooldown(player.getItemBySlot(current.slot).getItem()));
        JsonArray targets = new JsonArray();
        for (var target : ownedTargets.entrySet()) {
            Entity entity = player.serverLevel().getEntity(target.getKey()); JsonObject value = new JsonObject();
            value.addProperty("role", target.getValue()); value.addProperty("uuid", target.getKey().toString());
            value.addProperty("present", entity != null); value.addProperty("alive", entity != null && entity.isAlive());
            if (entity instanceof LivingEntity living) {
                value.addProperty("distance", living.distanceTo(player));
                value.addProperty("glowing", living.hasEffect(MobEffects.GLOWING));
                value.addProperty("glowingTicks", living.hasEffect(MobEffects.GLOWING) ? living.getEffect(MobEffects.GLOWING).getDuration() : 0);
            }
            targets.add(value);
        }
        row.add("ownedTargets", targets);
        if (current.item.equals("artifacts:umbrella")) row.add("umbrella", umbrellaState(player));
        row.add("main", stack(player.getMainHandItem())); row.add("off", stack(player.getOffhandItem())); row.add("inventory", inventory(player));
        List<String> packages = new ArrayList<>();
        for (Entity entity : player.serverLevel().getAllEntities())
            if (entity.getType().toString().contains("package") || entity.getClass().getName().endsWith("PackageEntity")) packages.add(entity.getUUID().toString());
        row.add("packageEntities", JSON.toJsonTree(packages)); return row;
    }
    private JsonObject clientState(Minecraft mc) {
        JsonObject row = base(); row.addProperty("using", mc.player.isUsingItem()); row.addProperty("usingTicks", mc.player.getTicksUsingItem());
        row.addProperty("blocking", mc.player.isBlocking()); row.addProperty("scoping", mc.player.isScoping());
        row.addProperty("useAnimation", mc.player.getUseItem().getUseAnimation().name());
        row.addProperty("heldDuration", mc.player.getItemBySlot(selected.slot).getUseDuration(mc.player));
        row.addProperty("cooldown", mc.player.getCooldowns().isOnCooldown(mc.player.getItemBySlot(selected.slot).getItem()));
        if (selected.item.equals("artifacts:umbrella")) row.add("umbrella", umbrellaState(mc.player));
        row.addProperty("usingHand", mc.player.getUsedItemHand().name()); row.add("usingStack", stack(mc.player.getUseItem()));
        row.add("main", stack(mc.player.getMainHandItem())); row.add("off", stack(mc.player.getOffhandItem()));
        row.addProperty("useKeyDown", mc.options.keyUse.isDown()); row.addProperty("cameraType", mc.options.getCameraType().name());
        row.addProperty("cameraIsPlayer", mc.getCameraEntity() == mc.player);
        var camera = mc.gameRenderer.getMainCamera();
        row.addProperty("actualCameraInitialized", camera.isInitialized());
        row.addProperty("actualCameraDetached", camera.isDetached());
        row.addProperty("actualCameraEntityIsPlayer", camera.getEntity() == mc.player);
        row.add("actualCameraPosition", JSON.toJsonTree(new double[]{camera.getPosition().x, camera.getPosition().y, camera.getPosition().z}));
        row.add("actualCameraRotation", JSON.toJsonTree(new float[]{camera.getXRot(), camera.getYRot()}));
        row.add("playerEyePosition", JSON.toJsonTree(new double[]{mc.player.getEyePosition().x, mc.player.getEyePosition().y, mc.player.getEyePosition().z}));
        row.addProperty("hitType", mc.hitResult == null ? "none" : mc.hitResult.getType().name()); return row;
    }
    private JsonObject base() {
        JsonObject row = new JsonObject(); row.addProperty("case", selected.name); row.addProperty("phaseTick", phaseTick);
        row.addProperty("frame", frame); row.addProperty("firstPerson", selected.first); return row;
    }
    private static boolean subject(ItemStack item) {
        ItemUseScene scene = active;
        return scene != null && !scene.done && scene.selected != null && BuiltInRegistries.ITEM.getKey(item.getItem()).toString().equals(scene.selected.item);
    }
    private boolean sampleTick() { return phaseTick >= 18 && phaseTick <= 64; }

    private void frame(RenderFrameEvent.Post ignored) {
        frame++;
        if (done || selected == null || !Set.of(18, 26, 30, 38, 54, 66, 76).contains(phaseTick)) return;
        Minecraft mc = Minecraft.getInstance(); if (mc.player == null || mc.level == null) return;
        Path file = root.resolve(selected.name + "-" + phaseTick + ".png"); if (Files.exists(file)) return;
        try (var image = Screenshot.takeScreenshot(mc.getMainRenderTarget())) {
            image.writeToFile(file);
            JsonObject witness = clientState(mc); witness.addProperty("file", file.getFileName().toString()); images.add(witness);
        } catch (Exception failure) { errors.add("Capture: " + failure); }
    }

    public static void useEvent(String stage, ItemStack item, Level level, LivingEntity actor, InteractionHand hand, int remaining, String returned) {
        ItemUseScene scene = active;
        if (scene == null || scene.done || scene.selected == null || !actor.getUUID().equals(scene.playerId)) return;
        StackContext context = scene.stackContexts.get(item);
        if (context == null && subject(item)) {
            context = new StackContext(scene.selected.name, scene.selected.item);
            scene.stackContexts.put(item, context);
        }
        if (context == null) return;
        if (scene.eventCount.incrementAndGet() > scene.cases.size() * 40) { scene.errors.add("Native use-event bound exceeded"); return; }
        JsonObject row = new JsonObject(); row.addProperty("case", context.name); row.addProperty("sourceItem", context.item);
        row.addProperty("stage", stage); row.addProperty("side", level.isClientSide ? "client" : "server");
        row.addProperty("phaseTickObserved", scene.phaseTick); row.addProperty("using", actor.isUsingItem());
        row.addProperty("actorTick", actor.tickCount); row.addProperty("levelGameTime", level.getGameTime());
        if (actor instanceof ServerPlayer serverPlayer) row.addProperty("serverTick", serverPlayer.server.getTickCount());
        row.addProperty("monotonicNanos", System.nanoTime()); row.addProperty("callbackThread", Thread.currentThread().getName());
        row.addProperty("usingTicks", actor.getTicksUsingItem()); row.addProperty("remaining", remaining);
        row.addProperty("hand", hand == null ? actor.getUsedItemHand().name() : hand.name());
        row.addProperty("nativeDuration", item.getUseDuration(actor));
        row.addProperty("returned", returned); row.add("stackAfterStage", stack(item));
        scene.useEvents.add(row);
    }
    public static void kind(String channel, ItemStack item, Object fallback, Object resolved) {
        if (!subject(item)) return; ItemUseScene scene = active;
        String key = scene.selected.name + ":" + channel + ":" + fallback + ":" + resolved + ":" + Minecraft.getInstance().player.isUsingItem();
        if (!scene.seenKinds.add(key)) return;
        JsonObject row = scene.base(); row.addProperty("channel", channel); row.addProperty("fallback", String.valueOf(fallback));
        row.addProperty("resolved", String.valueOf(resolved)); row.addProperty("using", Minecraft.getInstance().player.isUsingItem()); scene.kinds.add(row);
    }
    public static void itemMatrix(String stage, ItemStack item, ItemDisplayContext context, boolean left, PoseStack poses, BakedModel model) {
        if (!subject(item) || context == ItemDisplayContext.GUI || context == ItemDisplayContext.GROUND || context == ItemDisplayContext.NONE || context == ItemDisplayContext.FIXED) return;
        ItemUseScene scene = active; if (!scene.sampleTick()) return;
        if (scene.matrices.size() >= scene.cases.size() * 800) { scene.errors.add("Item draw trace bound exceeded"); return; }
        JsonObject row = scene.base(); row.addProperty("stage", stage); row.addProperty("left", left); row.addProperty("context", context.name());
        row.addProperty("using", Minecraft.getInstance().player.isUsingItem()); row.addProperty("usingTicks", Minecraft.getInstance().player.getTicksUsingItem());
        row.addProperty("sameUseStackObject", item == Minecraft.getInstance().player.getUseItem());
        row.addProperty("modelClass", model.getClass().getName()); row.addProperty("modelIdentity", System.identityHashCode(model));
        row.addProperty("particle", model.getParticleIcon().contents().name().toString());
        row.add("matrix", JSON.toJsonTree(poses.last().pose().get(new float[16]))); scene.matrices.add(row);
    }
    public static void usePoseSample(LivingEntity player, Map<String, Object> sample) {
        ItemUseScene scene = active;
        if (scene == null || scene.done || scene.selected == null || player != Minecraft.getInstance().player || !scene.sampleTick()) return;
        if (scene.usePoseProbes.size() >= scene.cases.size() * 300) throw new IllegalStateException("Use pose probe bound exceeded");
        JsonObject row = scene.base(); row.add("probe", JSON.toJsonTree(sample)); scene.usePoseProbes.add(row);
    }
    public static void draw(LivingEntityRenderer<?, ?> renderer, LivingEntity entity, PoseStack pose) {
        ItemUseScene scene = active; Minecraft mc = Minecraft.getInstance();
        if (scene == null || scene.done || scene.selected == null || entity != mc.player || !(renderer.getModel() instanceof PlayerModel<?> model) || !scene.sampleTick()) return;
        if (scene.poses.size() >= scene.cases.size() * 300) { scene.errors.add("Actor pose trace bound exceeded"); return; }
        JsonObject row = scene.base(); row.addProperty("using", mc.player.isUsingItem()); row.addProperty("usingTicks", mc.player.getTicksUsingItem());
        row.addProperty("leftArmPose", model.leftArmPose.name()); row.addProperty("rightArmPose", model.rightArmPose.name());
        row.add("leftArm", JSON.toJsonTree(new float[]{model.leftArm.xRot, model.leftArm.yRot, model.leftArm.zRot}));
        row.add("rightArm", JSON.toJsonTree(new float[]{model.rightArm.xRot, model.rightArm.yRot, model.rightArm.zRot})); scene.poses.add(row);
    }
    public static void doughProperty(ItemStack item, LivingEntity player, float value) {
        itemProperty("dough", item, player, value);
    }
    public static void itemProperty(String property, ItemStack item, LivingEntity player, float value) {
        if (!subject(item) || player != null && player != Minecraft.getInstance().player) return; ItemUseScene scene = active;
        if (!scene.sampleTick()) return;
        String key = scene.selected.name + ":" + scene.phaseTick + ":" + scene.frame + ":" + System.identityHashCode(item)
            + ":" + (player == null) + ":" + Float.floatToRawIntBits(value);
        if (!scene.seenProperties.add(key)) return;
        JsonObject row = scene.base(); row.addProperty("property", property); row.addProperty("actorNull", player == null);
        row.addProperty("using", player != null && player.isUsingItem()); row.addProperty("usingTicks", player == null ? -1 : player.getTicksUsingItem());
        row.addProperty("sameUseStackObject", player != null && item == player.getUseItem()); row.addProperty("originalValue", value);
        row.add("callers", JSON.toJsonTree(StackWalker.getInstance().walk(stream -> stream.limit(12)
            .map(frame -> frame.getClassName() + "#" + frame.getMethodName()).toList())));
        (property.equals("stockpot_lid") ? scene.lidProperties : scene.properties).add(row);
    }
    public static void bowState(Object state) {
        ItemUseScene scene = active; Minecraft mc = Minecraft.getInstance();
        if (scene == null || scene.done || scene.selected == null || mc.player == null || !scene.sampleTick()) return;
        String key = scene.selected.name + ":" + scene.phaseTick; if (!scene.seenBows.add(key)) return;
        try {
            if (scene.bowUsing == null) {
                scene.bowUsing = state.getClass().getDeclaredField("wasUsing"); scene.bowUsing.setAccessible(true);
                scene.bowClip = state.getClass().getDeclaredField("activeClip"); scene.bowClip.setAccessible(true);
                scene.describeClip = Class.forName("punchy.client.animation.PunchyAnimationManager").getMethod("describeClip", Class.forName("punchy.client.animation.data.AnimationClip"));
            }
            Object clip = scene.bowClip.get(state); JsonObject row = scene.base();
            row.addProperty("nativeWasUsing", scene.bowUsing.getBoolean(state));
            row.addProperty("clip", clip == null ? null : String.valueOf(scene.describeClip.invoke(null, clip))); scene.bows.add(row);
        } catch (Exception failure) { scene.errors.add("Bow dispatch observation: " + failure); }
    }

    private void finish(Minecraft mc, String status) {
        done = true; mc.options.keyUse.setDown(false); result.addProperty("status", errors.isEmpty() ? status : "error");
        result.add("clientStates", states); result.add("images", images); result.add("kindDecisions", kinds);
        result.add("itemMatrices", matrices); result.add("actorPoses", poses); result.add("doughProperties", properties);
        result.add("lidProperties", lidProperties);
        result.add("caseAdmissions", caseAdmissions);
        result.add("usePoseProbes", usePoseProbes);
        result.add("bowDispatch", bows); result.add("nativeUseEvents", JSON.toJsonTree(useEvents));
        result.add("serverSnapshots", JSON.toJsonTree(serverSnapshots)); result.add("errors", JSON.toJsonTree(errors));
        try { Files.writeString(root.resolve("native-use-result.json"), JSON.toJson(result)); }
        catch (Exception failure) { throw new RuntimeException(failure); }
        mc.tell(mc::stop);
    }
    private record StackContext(String name, String item) {}
    private record Case(String name, String item, boolean first, HumanoidArm dominant, EquipmentSlot slot, int holdTicks, int count) {}
}
