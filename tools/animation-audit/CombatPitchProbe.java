package audit.animation;

import audit.animation.mixin.AdjustmentSourceAccess;
import dev.kosmx.playerAnim.api.firstPerson.FirstPersonMode;
import dev.kosmx.playerAnim.api.layered.modifier.AdjustmentModifier;
import dev.kosmx.playerAnim.core.util.Vec3f;
import java.util.Optional;
import java.util.function.Supplier;

/** Private fitting experiment, never a distributed modpack adaptation. */
public final class CombatPitchProbe {
    private static final float BODY_LIMIT = (float) Math.toRadians(20);
    private static final ThreadLocal<Boolean> ORIGINAL = ThreadLocal.withInitial(() -> false);
    private static final ThreadLocal<Boolean> INTERNAL = ThreadLocal.withInitial(() -> false);
    private CombatPitchProbe() {}

    public static void install(AdjustmentModifier modifier) {
        if (!PoseScene.combatPitchEnabled()) return;
        var access = (AdjustmentSourceAccess) (Object) modifier;
        var nativeSource = access.animationAudit$getSource();
        access.animationAudit$setSource(part -> {
            Optional<AdjustmentModifier.PartModifier> original = nativeSource.apply(part);
            if (ORIGINAL.get() || !PoseScene.combatPitchEnabled() || original.isEmpty()) return original;
            boolean first = FirstPersonMode.isFirstPersonPass();
            var adjusted = redistribute(part, original.get(), first);
            PoseScene.pitchDecision(part, first, original.get(), adjusted);
            return Optional.of(adjusted);
        });
        PoseScene.pitchInstalled();
    }

    public static <T> T original(Supplier<T> read) {
        boolean previous = ORIGINAL.get();
        ORIGINAL.set(true);
        try {
            return PoseScene.productionCombatReference()
                ? audit.animation.mixin.CompatCombatOriginalAccess.animationAudit$original(read) : read.get();
        }
        finally { ORIGINAL.set(previous); }
    }

    public static boolean readingOriginal() { return ORIGINAL.get(); }

    public static boolean internalRead() { return INTERNAL.get(); }

    public static <T> T withoutObserver(Supplier<T> read) {
        boolean previous = INTERNAL.get();
        INTERNAL.set(true);
        try { return read.get(); }
        finally { INTERNAL.set(previous); }
    }

    public static Vec3f compensateOrientation(Vec3f originalBody, Vec3f adjustedBody, Vec3f originalArm) {
        if (originalBody.equals(adjustedBody)) return originalArm;
        for (Vec3f value : new Vec3f[]{originalBody, adjustedBody, originalArm})
            if (!Float.isFinite(value.getX()) || !Float.isFinite(value.getY()) || !Float.isFinite(value.getZ()))
                throw new IllegalStateException("Non-finite native orientation");
        // PAL applies global body ZYX before Minecraft's model reflection, then local arm ZYX.
        // S * B_new^-1 * B_old * S * A_old keeps B_new * S * A_new = B_old * S * A_old.
        var target = new org.joml.Matrix3f().scaling(-1, -1, 1)
            .mul(rotation(adjustedBody).transpose()).mul(rotation(originalBody))
            .mul(new org.joml.Matrix3f().scaling(-1, -1, 1)).mul(rotation(originalArm));
        // Decompose the native Rz * Ry * Rx convention directly, including its gimbal limit.
        double cosineY = Math.hypot(target.m00(), target.m01());
        float y = (float) Math.atan2(-target.m02(), cosineY);
        float x = cosineY > 1e-6
            ? (float) Math.atan2(target.m12(), target.m22())
            : (float) Math.atan2(-target.m21(), target.m11());
        float z = cosineY > 1e-6 ? (float) Math.atan2(target.m01(), target.m00()) : 0;
        return new Vec3f(x, y, z);
    }

    private static org.joml.Matrix3f rotation(Vec3f value) {
        return new org.joml.Matrix3f().rotation(
            new org.joml.Quaternionf().rotationZYX(value.getZ(), value.getY(), value.getX()));
    }

    public static AdjustmentModifier.PartModifier redistribute(String part,
            AdjustmentModifier.PartModifier nativeValue, boolean firstPerson) {
        if (firstPerson) return nativeValue;
        Vec3f rotation = nativeValue.rotation();
        float x = rotation.getX();
        if (!Float.isFinite(x)) throw new IllegalStateException("Non-finite native combat pitch");
        float adjusted;
        switch (part) {
            case "body", "rightLeg", "leftLeg" -> {
                if (x <= BODY_LIMIT) return nativeValue;
                adjusted = BODY_LIMIT;
            }
            case "rightArm", "leftArm" -> {
                // BC's third-person source contributes one quarter of pitch to each arm.
                // Move only the excess upward torso contribution into the arm contribution.
                if (x >= 0 || -x * 3 <= BODY_LIMIT) return nativeValue;
                adjusted = x - (-x * 3 - BODY_LIMIT);
            }
            default -> { return nativeValue; }
        }
        return new AdjustmentModifier.PartModifier(
            new Vec3f(adjusted, rotation.getY(), rotation.getZ()), nativeValue.scale(), nativeValue.offset());
    }
}
