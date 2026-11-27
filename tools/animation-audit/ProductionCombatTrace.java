package audit.animation.mixin;

import audit.animation.CombatPitchProbe;
import audit.animation.PoseScene;
import com.llamalad7.mixinextras.injector.wrapoperation.Operation;
import com.llamalad7.mixinextras.injector.wrapoperation.WrapOperation;
import dev.kosmx.playerAnim.api.TransformType;
import dev.kosmx.playerAnim.core.util.Vec3f;
import dev.kosmx.playerAnim.impl.animation.AnimationApplier;
import java.util.List;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;

/** Observe the production model-part operand after the original operation, returning it unchanged. */
@Mixin(value = AnimationApplier.class, priority = 500, remap = false)
abstract class ProductionCombatTrace {
    @WrapOperation(method = "updatePart", at = @At(value = "INVOKE", ordinal = 1,
        target = "Ldev/kosmx/playerAnim/impl/animation/AnimationApplier;get3DTransform(Ljava/lang/String;Ldev/kosmx/playerAnim/api/TransformType;Ldev/kosmx/playerAnim/core/util/Vec3f;)Ldev/kosmx/playerAnim/core/util/Vec3f;"), require = 1, allow = 1)
    private Vec3f animationAudit$productionOperand(AnimationApplier applier, String part, TransformType type,
            Vec3f input, Operation<Vec3f> operation) {
        Vec3f actual = operation.call(applier, part, type, input);
        if (type == TransformType.ROTATION && PoseScene.productionCombatReference() && PoseScene.wantsNativeRotationSamples()) {
            Vec3f original = CombatPitchProbe.original(() -> applier.get3DTransform(part, type, input));
            PoseScene.nativeRotationSample(part, "model-part", input, actual, original,
                ((AnimationClockAccess) applier).animationAudit$partial(), System.identityHashCode(applier),
                List.of("production-updatePart-operand-passive"));
        }
        return actual;
    }
}
