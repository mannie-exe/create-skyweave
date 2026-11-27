package audit.animation.mixin;

import audit.animation.PoseScene;
import com.mojang.blaze3d.vertex.PoseStack;
import net.minecraft.client.player.AbstractClientPlayer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.*;
import org.spongepowered.asm.mixin.injection.callback.*;

/** Bind the original item-bone result to the actual third-person matrix consumer. */
@Mixin(targets = "punchymoves.client.PlayerAnimationEngine", remap = false)
abstract class ThirdItemSourceTrace {
    @Inject(method = "avatarItemPose(Lnet/minecraft/client/player/AbstractClientPlayer;Ljava/lang/String;)Lpunchymoves/client/animation/LocomotionController$ItemPose;",
        at = @At("RETURN"), require = 1, remap = false)
    private static void animationAudit$poseSource(AbstractClientPlayer player, String bone,
            CallbackInfoReturnable<Object> result) {
        PoseScene.thirdItemPose("source", player, bone, result.getReturnValue(), null);
    }
}

@Mixin(targets = "punchymoves.client.render.HeldItemAnimation", remap = false)
abstract class ThirdItemPoseTrace {
    @Inject(method = "apply(Lcom/mojang/blaze3d/vertex/PoseStack;Lpunchymoves/client/animation/LocomotionController$ItemPose;)V",
        at = @At("HEAD"), require = 1, remap = false)
    private static void animationAudit$beforeItemPose(PoseStack poses, @Coerce Object value, CallbackInfo ci) {
        PoseScene.thirdItemPose("beforeApply", null, null, value, poses);
    }

    @Inject(method = "apply(Lcom/mojang/blaze3d/vertex/PoseStack;Lpunchymoves/client/animation/LocomotionController$ItemPose;)V",
        at = @At("RETURN"), require = 1, remap = false)
    private static void animationAudit$afterItemPose(PoseStack poses, @Coerce Object value, CallbackInfo ci) {
        PoseScene.thirdItemPose("afterApply", null, null, value, poses);
    }
}
