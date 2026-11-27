package audit.animation.mixin;

import audit.animation.PoseScene;
import com.mojang.blaze3d.vertex.PoseStack;
import net.minecraft.client.model.geom.ModelPart;
import org.joml.Vector3f;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.*;
import org.spongepowered.asm.mixin.injection.callback.*;

/** Observe the original authored/animated first-person grip and item pretransform. */
@Mixin(targets = "punchy.client.render.PunchyArmRenderer", remap = false)
abstract class PunchyGripTrace {
    @Inject(method = "getGripPos(Lnet/minecraft/client/model/geom/ModelPart;Lnet/minecraft/client/model/geom/ModelPart;Z)Lorg/joml/Vector3f;",
        at = @At("RETURN"), require = 1, remap = false)
    private static void animationAudit$authoredGrip(ModelPart grip, ModelPart arm, boolean left,
            CallbackInfoReturnable<Vector3f> result) {
        PoseScene.gripPosition(grip, arm, left, result.getReturnValue());
    }

    @Inject(method = "getAnimatedGripTranslation(Lnet/minecraft/client/model/geom/ModelPart;)Lorg/joml/Vector3f;",
        at = @At("RETURN"), require = 1, remap = false)
    private static void animationAudit$animatedGrip(ModelPart grip, CallbackInfoReturnable<Vector3f> result) {
        PoseScene.gripTransform("animatedPixels", null, result.getReturnValue(), null, null);
    }

    @Inject(method = "applyGripTranslation(Lcom/mojang/blaze3d/vertex/PoseStack;Lorg/joml/Vector3f;)V",
        at = @At("HEAD"), require = 1, remap = false)
    private static void animationAudit$beforeGrip(PoseStack poses, Vector3f grip, CallbackInfo ci) {
        PoseScene.gripTransform("beforeGrip", poses, grip, null, null);
    }

    @Inject(method = "applyGripTranslation(Lcom/mojang/blaze3d/vertex/PoseStack;Lorg/joml/Vector3f;)V",
        at = @At("RETURN"), require = 1, remap = false)
    private static void animationAudit$afterGrip(PoseStack poses, Vector3f grip, CallbackInfo ci) {
        PoseScene.gripTransform("afterGrip", poses, grip, null, null);
    }

    @Inject(method = "applyItemPreTransform(Lcom/mojang/blaze3d/vertex/PoseStack;Lorg/joml/Vector3f;Lpunchy/client/render/ToolTuning$Profile;Z)V",
        at = @At("HEAD"), require = 1, remap = false)
    private static void animationAudit$beforePre(PoseStack poses, Vector3f grip, @Coerce Object profile,
            boolean alternateRotationOrder, CallbackInfo ci) {
        PoseScene.gripTransform("beforeItemPre", poses, grip, profile, alternateRotationOrder);
    }

    @Inject(method = "applyItemPreTransform(Lcom/mojang/blaze3d/vertex/PoseStack;Lorg/joml/Vector3f;Lpunchy/client/render/ToolTuning$Profile;Z)V",
        at = @At("RETURN"), require = 1, remap = false)
    private static void animationAudit$afterPre(PoseStack poses, Vector3f grip, @Coerce Object profile,
            boolean alternateRotationOrder, CallbackInfo ci) {
        PoseScene.gripTransform("afterItemPre", poses, grip, profile, alternateRotationOrder);
    }
}
