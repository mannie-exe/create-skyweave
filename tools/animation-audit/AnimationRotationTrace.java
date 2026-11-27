package audit.animation.mixin;

import audit.animation.CombatPitchProbe;
import audit.animation.PoseScene;
import dev.kosmx.playerAnim.api.TransformType;
import dev.kosmx.playerAnim.core.impl.AnimationProcessor;
import dev.kosmx.playerAnim.core.util.Vec3f;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Observe original and probe results with the actual native incoming pose and clock. */
@Mixin(AnimationProcessor.class)
abstract class AnimationRotationTrace {
    @Shadow private float tickDelta;

    @Inject(method = "get3DTransform(Ljava/lang/String;Ldev/kosmx/playerAnim/api/TransformType;Ldev/kosmx/playerAnim/core/util/Vec3f;)Ldev/kosmx/playerAnim/core/util/Vec3f;",
        at = @At("RETURN"), cancellable = true, require = 1)
    private void animationAudit$nativeRotation(String part, TransformType type, Vec3f input,
            CallbackInfoReturnable<Vec3f> ci) {
        if (type != TransformType.ROTATION || CombatPitchProbe.readingOriginal() || CombatPitchProbe.internalRead()
                || !PoseScene.combatFullAxisEnabled() && !PoseScene.wantsNativeRotationSamples()) return;
        var callers = StackWalker.getInstance().walk(frames -> frames
            .filter(frame -> !frame.getClassName().startsWith("audit.animation.")
                && !frame.getMethodName().contains("animationAudit$"))
            .limit(14).map(frame -> frame.getClassName() + "#" + frame.getMethodName()).toList());
        String scope = callers.stream().anyMatch(s -> s.contains("#updatePart")) ? "model-part"
            : callers.stream().anyMatch(s -> s.contains("applyBodyTransforms")) ? "body-global" : null;
        if (scope == null) return;
        if (PoseScene.productionCombatReference() && scope.equals("model-part")) return;
        var processor = (AnimationProcessor) (Object) this;
        Vec3f original = CombatPitchProbe.original(() -> processor.get3DTransform(part, type, input));
        Vec3f actual = ci.getReturnValue();
        if (PoseScene.combatFullAxisEnabled() && scope.equals("model-part")
                && (part.equals("rightArm") || part.equals("leftArm"))
                && !dev.kosmx.playerAnim.api.firstPerson.FirstPersonMode.isFirstPersonPass()) {
            Vec3f originalBody = CombatPitchProbe.original(() -> processor.get3DTransform("body", type, Vec3f.ZERO));
            Vec3f adjustedBody = CombatPitchProbe.withoutObserver(() -> processor.get3DTransform("body", type, Vec3f.ZERO));
            if (!originalBody.equals(adjustedBody)) {
                actual = CombatPitchProbe.compensateOrientation(originalBody, adjustedBody, original);
                ci.setReturnValue(actual);
            }
        }
        PoseScene.nativeRotationSample(part, scope, input, actual, original, tickDelta,
            System.identityHashCode(this), callers);
    }
}
