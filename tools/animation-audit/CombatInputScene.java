package audit.animation;

import audit.animation.mixin.NativeMouseInputInvoker;
import com.google.gson.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import net.minecraft.client.*;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.core.registries.Registries;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.Difficulty;
import net.minecraft.world.entity.*;
import net.minecraft.world.entity.ai.attributes.Attributes;
import net.minecraft.world.entity.animal.Cow;
import net.minecraft.world.item.*;
import net.minecraft.world.level.*;
import net.minecraft.world.level.levelgen.WorldOptions;
import net.minecraft.world.phys.EntityHitResult;
import net.neoforged.fml.ModList;
import net.neoforged.neoforge.client.event.ClientTickEvent;
import net.neoforged.neoforge.common.NeoForge;
import net.neoforged.neoforge.event.entity.living.LivingDamageEvent;
import org.lwjgl.glfw.GLFW;

/** Bounded original input-to-server-damage journey in an owned, fresh flat world. */
final class CombatInputScene {
    private static final Gson JSON = new GsonBuilder().setPrettyPrinting().create();
    private final Path root = Minecraft.getInstance().gameDirectory.toPath();
    private final JsonObject result = new JsonObject();
    private final JsonArray frames = new JsonArray();
    private final ConcurrentLinkedQueue<JsonObject> damage = new ConcurrentLinkedQueue<>();
    private final JsonObject selection;
    private CompletableFuture<Integer> setup;
    private volatile UUID targetUuid;
    private UUID playerUuid;
    private java.lang.reflect.Field nativeAttackField;
    private int ticks, age, phase;
    private boolean opened, done, pressed;

    CombatInputScene() {
        try {
            selection = JsonParser.parseString(Files.readString(root.resolve("animation-combat-input.json"))).getAsJsonObject();
            Class<?> feature = Class.forName("design.inherent.skyweavecompat.Feature");
            boolean enabled = (boolean) Class.forName("design.inherent.skyweavecompat.OptionalIntegrations")
                .getMethod("enabled", feature).invoke(null, feature.getField("COMBAT_ATTACK_PITCH").get(null));
            if (enabled != selection.get("expectedCombatFeature").getAsBoolean()) throw new IllegalStateException("Wrong effective combat feature");
            Path jar = ModList.get().getModFileById("skyweave_compat").getFile().getFilePath();
            String sha = HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(jar)));
            if (!sha.equals(selection.get("compatArchiveSha256").getAsString())) throw new IllegalStateException("Wrong actual Compat archive");
            result.addProperty("actualCompatSha256", sha);
            result.addProperty("combatFeature", enabled);
            boolean bones = (boolean) Class.forName("design.inherent.skyweavecompat.OptionalIntegrations")
                .getMethod("enabled", feature).invoke(null, feature.getField("MOVES_OVERLAY_BONES").get(null));
            if (bones != selection.get("expectedCombatFeature").getAsBoolean()) throw new IllegalStateException("Wrong effective bone-filter control");
            result.addProperty("boneFeature", bones);
            result.addProperty("scope", "Owned-window original mouse callback, native Better Combat accepted attack, original integrated-server player damage, then native input release. One level first-person target; no multiplayer or complete gameplay claim.");
            NeoForge.EVENT_BUS.addListener(this::tick);
            NeoForge.EVENT_BUS.addListener(this::damaged);
        } catch (Exception failure) { throw new RuntimeException(failure); }
    }

    private void damaged(LivingDamageEvent.Post event) {
        if (done || event.getEntity().level().isClientSide || !event.getEntity().getUUID().equals(targetUuid)) return;
        JsonObject row = new JsonObject();
        row.addProperty("serverTick", event.getEntity().level().getGameTime());
        row.addProperty("target", event.getEntity().getUUID().toString());
        row.addProperty("source", event.getSource().getMsgId());
        row.addProperty("playerSource", event.getSource().getEntity() != null && event.getSource().getEntity().getUUID().equals(playerUuid));
        row.addProperty("damage", event.getNewDamage());
        row.addProperty("health", event.getEntity().getHealth());
        damage.add(row);
    }

    private void tick(ClientTickEvent.Post event) {
        if (done) return;
        Minecraft mc = Minecraft.getInstance();
        try {
            if (++ticks > 1800) throw new IllegalStateException("Input fixture exceeded tick bound");
            if (!opened && mc.screen instanceof TitleScreen && mc.getOverlay() == null) {
                opened = true;
                mc.tell(() -> mc.createWorldOpenFlows().createFreshLevel("animation-combat-input-flat",
                    new LevelSettings("Combat input control", GameType.CREATIVE, false, Difficulty.PEACEFUL,
                        true, new GameRules(), WorldDataConfiguration.DEFAULT), new WorldOptions(1527L, false, false),
                    access -> access.registryOrThrow(Registries.WORLD_PRESET).get(ResourceLocation.withDefaultNamespace("flat")).createWorldDimensions(), mc.screen));
                return;
            }
            if (mc.player == null || mc.level == null || mc.screen != null || mc.getOverlay() != null || ++age < 60) return;
            if (setup == null) {
                Object config = Class.forName("dynamic_fps.impl.config.DynamicFPSConfig").getField("INSTANCE").get(null);
                boolean enabled = (boolean) config.getClass().getMethod("enabled").invoke(config);
                boolean disabled = (boolean) Class.forName("dynamic_fps.impl.DynamicFPSMod").getMethod("isDisabled").invoke(null);
                if (enabled || !disabled) throw new IllegalStateException("Timing fixture is throttled");
                result.addProperty("nativeDynamicFpsDisabled", disabled);
                playerUuid = mc.player.getUUID();
                double x = mc.player.getX(), y = mc.player.getY(), z = mc.player.getZ();
                setup = mc.getSingleplayerServer().submit(() -> {
                    var player = mc.getSingleplayerServer().getPlayerList().getPlayer(playerUuid);
                    player.setItemSlot(EquipmentSlot.MAINHAND, new ItemStack(Items.DIAMOND_SWORD));
                    player.setItemSlot(EquipmentSlot.OFFHAND, ItemStack.EMPTY);
                    Cow target = EntityType.COW.create(player.serverLevel());
                    target.setNoAi(true);
                    target.getAttribute(Attributes.MAX_HEALTH).setBaseValue(100);
                    target.setHealth(100);
                    target.moveTo(x, y, z - 2.0, 0, 0);
                    targetUuid = target.getUUID();
                    player.serverLevel().addFreshEntity(target);
                    return target.getId();
                });
                mc.player.setItemSlot(EquipmentSlot.MAINHAND, new ItemStack(Items.DIAMOND_SWORD));
                mc.player.setItemSlot(EquipmentSlot.OFFHAND, ItemStack.EMPTY);
                mc.setCameraEntity(mc.player);
                mc.options.setCameraType(CameraType.FIRST_PERSON);
                return;
            }
            if (!setup.isDone()) return;
            int targetId = setup.join();
            if (mc.level.getEntity(targetId) == null) return;
            mc.player.setYRot(180);
            mc.player.yRotO = 180;
            mc.player.setXRot(15);
            mc.player.xRotO = 15;
            phase++;
            Object attack = mc.player.getClass().getMethod("getCurrentAttack").invoke(mc.player);
            boolean animationActive = nativeAttackActive(mc);
            JsonObject frame = new JsonObject();
            frame.addProperty("tick", phase);
            frame.addProperty("selectedAttackProfile", String.valueOf(attack));
            frame.addProperty("nativeAttackAnimationActive", animationActive);
            frame.addProperty("attackDown", mc.options.keyAttack.isDown());
            frame.addProperty("targetInCrosshair", mc.hitResult instanceof EntityHitResult hit && hit.getEntity().getId() == targetId);
            frame.addProperty("cameraIsPlayer", mc.getCameraEntity() == mc.player);
            frames.add(frame);
            if (phase == 10) result.add("armFilterKernel", ArmFilterKernel.capture(mc));
            if (phase == 30) {
                if (animationActive || mc.options.keyAttack.isDown())
                    throw new IllegalStateException("Owned click baseline already has an active attack/input");
                if (!(mc.hitResult instanceof EntityHitResult hit) || hit.getEntity().getId() != targetId)
                    throw new IllegalStateException("Actual pick did not reach owned target");
                mouse(mc, GLFW.GLFW_PRESS);
                pressed = true;
            }
            if (phase == 31) { mouse(mc, GLFW.GLFW_RELEASE); pressed = false; }
            if (phase == 60) result.addProperty("damageEventsAt60", damage.size());
            if (phase >= 100) {
                if (damage.stream().noneMatch(row -> row.get("playerSource").getAsBoolean() && row.get("damage").getAsFloat() > 0))
                    throw new IllegalStateException("No original server player damage observed");
                if (frames.asList().stream().map(JsonElement::getAsJsonObject).noneMatch(row -> row.get("tick").getAsInt() > 30 && row.get("nativeAttackAnimationActive").getAsBoolean()))
                    throw new IllegalStateException("No accepted native Better Combat attack observed");
                if (mc.options.keyAttack.isDown() || animationActive) throw new IllegalStateException("Native input/animation did not settle after release");
                if (damage.size() != 1 || result.get("damageEventsAt60").getAsInt() != 1)
                    throw new IllegalStateException("Additional damage after the original click/release cycle");
                finish(mc, "completed");
            }
        } catch (Throwable failure) {
            result.addProperty("failure", failure.toString());
            result.add("stack", JSON.toJsonTree(Arrays.stream(failure.getStackTrace()).map(Object::toString).toList()));
            finish(mc, "error");
        }
    }

    private static void mouse(Minecraft mc, int action) {
        ((NativeMouseInputInvoker) mc.mouseHandler).animationAudit$mousePress(mc.getWindow().getWindow(), GLFW.GLFW_MOUSE_BUTTON_LEFT, action, 0);
    }

    private boolean nativeAttackActive(Minecraft mc) throws ReflectiveOperationException {
        // The pinned native updateAnimationsOnTick uses base.getAnimation().isActive(), not AttackHand selection.
        if (nativeAttackField == null) {
            for (Class<?> type = mc.player.getClass(); type != null; type = type.getSuperclass())
                for (var field : type.getDeclaredFields())
                    if (field.getType() == net.bettercombat.client.animation.AttackAnimationSubStack.class) {
                        if (nativeAttackField != null) throw new IllegalStateException("Ambiguous native attack animation owner");
                        nativeAttackField = field; nativeAttackField.setAccessible(true);
                    }
            if (nativeAttackField == null) throw new IllegalStateException("Missing native attack animation owner");
        }
        var owner = (net.bettercombat.client.animation.AttackAnimationSubStack) nativeAttackField.get(mc.player);
        var animation = owner.base.getAnimation();
        return animation != null && animation.isActive();
    }

    private void finish(Minecraft mc, String status) {
        if (done) return;
        if (pressed) mouse(mc, GLFW.GLFW_RELEASE);
        mc.options.keyAttack.setDown(false);
        done = true;
        result.addProperty("status", status);
        result.add("frames", frames);
        result.add("serverDamage", JSON.toJsonTree(damage));
        try { Files.writeString(root.resolve("combat-input-result.json"), JSON.toJson(result)); }
        catch (Exception failure) { throw new RuntimeException(failure); }
        mc.tell(mc::stop);
    }
}
