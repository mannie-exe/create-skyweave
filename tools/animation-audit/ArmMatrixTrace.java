package audit.animation.mixin;

import audit.animation.PoseScene;
import com.mojang.blaze3d.vertex.PoseStack;
import net.minecraft.client.model.geom.ModelPart;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Read the original arm transform in body-render and held-item attachment callers. */
@Mixin(ModelPart.class)
abstract class ArmMatrixTrace {
    @Inject(method = "translateAndRotate(Lcom/mojang/blaze3d/vertex/PoseStack;)V", at = @At("RETURN"), require = 1)
    private void animationAudit$armTransform(PoseStack poses, CallbackInfo ci) {
        PoseScene.armMatrix((ModelPart) (Object) this, poses);
    }
}
