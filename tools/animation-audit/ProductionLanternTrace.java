package audit.animation.mixin;

import audit.animation.PoseScene;
import net.minecraft.client.model.geom.ModelPart;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Coerce;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Passive source-to-result witness; it never replaces the production rotation. */
@Mixin(targets = "design.inherent.skyweavecompat.client.LanternGrip", remap = false)
abstract class ProductionLanternTrace {
    @Inject(method = "pose", at = @At("RETURN"), require = 1)
    private static void animationAudit$lanternResult(ModelPart arm, @Coerce Object nativePose,
            CallbackInfoReturnable<Object> result) {
        PoseScene.productionLanternPose(arm, nativePose, result.getReturnValue());
    }
}
