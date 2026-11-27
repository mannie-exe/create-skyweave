package audit.animation.mixin;

import audit.animation.ExposureScene;
import io.github.mortuusars.exposure.client.animation.CameraPoses;
import net.minecraft.client.model.HumanoidModel;
import net.minecraft.world.entity.HumanoidArm;
import net.minecraft.world.entity.LivingEntity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Read the original provider's actual model; never call or alter its pose. */
@Mixin(value = CameraPoses.class, remap = false)
abstract class ExposureCameraPoseTrace {
    @Inject(method = "applyHolding", at = @At("HEAD"), require = 1)
    private void animationAudit$holdingBefore(HumanoidModel<?> model, LivingEntity actor, HumanoidArm arm, CallbackInfo ci) {
        ExposureScene.pose("exposure-holding-before", model, actor);
    }
    @Inject(method = "applyHolding", at = @At("RETURN"), require = 1)
    private void animationAudit$holdingAfter(HumanoidModel<?> model, LivingEntity actor, HumanoidArm arm, CallbackInfo ci) {
        ExposureScene.pose("exposure-holding-after", model, actor);
    }
    @Inject(method = "applySelfie", at = @At("HEAD"), require = 1)
    private void animationAudit$selfieBefore(HumanoidModel<?> model, LivingEntity actor, HumanoidArm arm, boolean assisted, CallbackInfo ci) {
        ExposureScene.pose("exposure-selfie-before", model, actor);
    }
    @Inject(method = "applySelfie", at = @At("RETURN"), require = 1)
    private void animationAudit$selfieAfter(HumanoidModel<?> model, LivingEntity actor, HumanoidArm arm, boolean assisted, CallbackInfo ci) {
        ExposureScene.pose("exposure-selfie-after", model, actor);
    }
}
