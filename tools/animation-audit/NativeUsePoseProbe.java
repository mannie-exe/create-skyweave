package audit.animation;

import java.lang.reflect.*;
import java.util.*;
import net.minecraft.client.model.PlayerModel;
import net.minecraft.client.model.geom.ModelPart;
import net.minecraft.client.player.AbstractClientPlayer;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.entity.HumanoidArm;
import net.minecraft.world.item.ItemStack;
import punchymoves.client.PlayerAnimationEngine;
import punchymoves.client.animation.AnimationLibrary;
import punchymoves.client.animation.LocomotionController;
import punchymoves.client.compat.SpatialGuiCompat;
import punchymoves.client.render.FirstPersonHandRender;

/** Private exact-Moves experiment. No pack switch, item-use mutation, or new animation dispatch. */
public final class NativeUsePoseProbe {
    private NativeUsePoseProbe() {}
    public static boolean enabled() { return Boolean.getBoolean("animationAudit.nativeUsePose"); }

    public record Frame(AbstractClientPlayer player, PlayerModel<?> model, ItemStack stack,
            InteractionHand hand, HumanoidArm arm, String pose, String refusal, float[] nativeArm) {}

    public static Frame before(AbstractClientPlayer player, PlayerModel<?> model) {
        HumanoidArm arm = player.getUsedItemHand() == InteractionHand.MAIN_HAND
            ? player.getMainArm() : player.getMainArm().getOpposite();
        String pose = (arm == HumanoidArm.RIGHT ? model.rightArmPose : model.leftArmPose).name();
        return new Frame(player, model, player.getUseItem(), player.getUsedItemHand(), arm, pose,
            refusal(player, pose), capture(arm == HumanoidArm.RIGHT ? model.rightArm : model.leftArm));
    }

    public static void after(Frame frame) {
        AbstractClientPlayer player = frame.player(); PlayerModel<?> model = frame.model();
        ModelPart arm = frame.arm() == HumanoidArm.RIGHT ? model.rightArm : model.leftArm;
        float[] movesArm = capture(arm);
        String refusal = frame.refusal();
        if (refusal.isEmpty()) refusal = refusal(player, frame.pose());
        if (refusal.isEmpty() && (player.getUseItem() != frame.stack() || player.getUsedItemHand() != frame.hand()))
            refusal = "use-owner-changed";
        boolean restored = enabled() && refusal.isEmpty();
        if (restored) restore(arm, frame.nativeArm());
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("enabled", enabled()); row.put("pose", frame.pose()); row.put("arm", frame.arm().name());
        row.put("refusal", refusal); row.put("restored", restored);
        row.put("nativeArm", frame.nativeArm()); row.put("movesArm", movesArm); row.put("returnedArm", capture(arm));
        ItemUseScene.usePoseSample(player, row);
    }

    private static String refusal(AbstractClientPlayer player, String pose) {
        if (FirstPersonHandRender.active()) return "first-person-owner";
        if (!player.isUsingItem()) return "not-using";
        if (!Set.of("TOOT_HORN", "SPYGLASS", "BLOCK").contains(pose)) return "unselected-native-pose";
        if (!player.getUseItem().getUseAnimation().name().equals(pose)) return "action-pose-mismatch";
        if (player.isPassenger() || player.isFallFlying() || player.isSwimming() || player.getAttackAnim(1) > 0)
            return "native-motion-or-attack-owner";
        if (SpatialGuiCompat.posesAvatar(player) || SpatialGuiCompat.hidesEquippedItems(player)) return "spatial-owner";
        if (PlayerAnimationEngine.isExternalLocomotion(player)) return "external-locomotion-owner";
        try {
            Object state = ((Map<?, ?>) Access.players.get(null)).get(player);
            if (state == null) return "no-moves-state";
            if (Access.poseDriven.getBoolean(state) || Access.yielding.getBoolean(state)) return "foreign-pose-owner";
            Object combat = Access.packCombat.get(state);
            if ((boolean) Access.combatActive.invoke(combat)) return "combat-owner";
            AnimationLibrary library = (AnimationLibrary) Access.animations.get(null);
            if (library == null) return "no-moves-library";
            if (!((String) Access.behavior.invoke(null, library, player.getUseItem())).isBlank()) return "sequence-owner";
            if (library.hasItemBinding(player.getUseItem(), "use_item")
                    || (boolean) Access.handles.invoke(null, library, player.getUseItem(), false)
                    || (boolean) Access.handles.invoke(null, library, player.getUseItem(), true)) return "custom-use-owner";
            LocomotionController controller = (LocomotionController) Access.controller.get(state);
            if (controller.isEmotePlaying() || controller.isAlignmentActive() || controller.isTimedPoseActive()
                    || controller.isSwimmingActive() || controller.isElytraFlyingActive() || controller.isPassengerAnimationActive())
                return "moves-action-owner";
            // This native API protects Moves' own actions FROM Touch; it is not Touch ownership.
            if (PlayerAnimationEngine.touchMotionProtectedArms(player) != 0) return "moves-protected-action-owner";
            return "";
        } catch (ReflectiveOperationException | LinkageError failure) {
            throw new IllegalStateException("Exact pinned Moves ownership inspection failed; no fallback applied", failure);
        }
    }

    private static float[] capture(ModelPart part) {
        return new float[]{part.x, part.y, part.z, part.xRot, part.yRot, part.zRot, part.xScale, part.yScale, part.zScale};
    }
    private static void restore(ModelPart part, float[] value) {
        part.x = value[0]; part.y = value[1]; part.z = value[2]; part.xRot = value[3]; part.yRot = value[4]; part.zRot = value[5];
        part.xScale = value[6]; part.yScale = value[7]; part.zScale = value[8];
    }
    private static final class Access {
        static final Field players, animations, controller, poseDriven, yielding, packCombat;
        static final Method behavior, handles, combatActive;
        static {
            try {
                Class<?> state = Class.forName("punchymoves.client.PlayerAnimationEngine$PlayerState");
                players = field(PlayerAnimationEngine.class, "PLAYERS"); animations = field(PlayerAnimationEngine.class, "animations");
                controller = field(state, "controller"); poseDriven = field(state, "poseDriven");
                yielding = field(state, "yieldingLocomotion"); packCombat = field(state, "packCombat");
                combatActive = packCombat.getType().getMethod("active");
                behavior = Class.forName("punchymoves.client.animation.ItemSequenceController")
                    .getDeclaredMethod("behavior", AnimationLibrary.class, ItemStack.class);
                handles = Class.forName("punchymoves.client.animation.ItemUseController")
                    .getDeclaredMethod("handles", AnimationLibrary.class, ItemStack.class, boolean.class);
                behavior.setAccessible(true); handles.setAccessible(true);
            } catch (ReflectiveOperationException failure) { throw new ExceptionInInitializerError(failure); }
        }
        private static Field field(Class<?> type, String name) throws ReflectiveOperationException {
            Field field = type.getDeclaredField(name); field.setAccessible(true); return field;
        }
    }
}
