package audit.animation.mixin;

import audit.animation.CombatPitchProbe;
import audit.animation.PoseScene;
import dev.kosmx.playerAnim.api.TransformType;
import dev.kosmx.playerAnim.core.impl.AnimationProcessor;
import dev.kosmx.playerAnim.core.util.Vec3f;
import java.util.List;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Independent passive witness of the production correction's returned rotation. */
@Mixin(targets = "design.inherent.skyweavecompat.client.CombatPitch", remap = false)
abstract class ProductionCombatReturnTrace {
    @Inject(method = "arm", at = @At("RETURN"), require = 1)
    private static void animationAudit$productionReturn(AnimationProcessor processor, String part,
            TransformType type, Vec3f input, Vec3f nativeArm, CallbackInfoReturnable<Vec3f> result) {
        if (type != TransformType.ROTATION || !PoseScene.productionCombatReference()
                || !PoseScene.wantsNativeRotationSamples()) return;
        Vec3f original = CombatPitchProbe.original(() -> processor.get3DTransform(part, type, input));
        PoseScene.nativeRotationSample(part, "production-arm-return", input, result.getReturnValue(), original,
            ((AnimationClockAccess) processor).animationAudit$partial(), System.identityHashCode(processor),
            List.of("CombatPitch.arm-RETURN-passive"));
    }
}
