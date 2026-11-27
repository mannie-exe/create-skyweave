package audit.animation.mixin;

import audit.animation.ExposureScene;
import net.minecraft.client.model.PlayerModel;
import net.minecraft.client.player.AbstractClientPlayer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Pseudo;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Coerce;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Optional observation only. No direct Moves type is linked in the absence control. */
@Pseudo
@Mixin(targets = "punchymoves.client.PlayerAnimationEngine", remap = false)
abstract class ExposureMovesPoseTrace {
    @Inject(method = "applyPoseBase(Lnet/minecraft/client/player/AbstractClientPlayer;Lnet/minecraft/client/model/PlayerModel;Lpunchymoves/client/PlayerPoseState;)V", at = @At("HEAD"), require = 1)
    private static void animationAudit$before(AbstractClientPlayer actor, PlayerModel<?> model, @Coerce Object state, CallbackInfo ci) {
        ExposureScene.pose("moves-base-before", model, actor);
    }
    @Inject(method = "applyPoseBase(Lnet/minecraft/client/player/AbstractClientPlayer;Lnet/minecraft/client/model/PlayerModel;Lpunchymoves/client/PlayerPoseState;)V", at = @At("RETURN"), require = 1)
    private static void animationAudit$after(AbstractClientPlayer actor, PlayerModel<?> model, @Coerce Object state, CallbackInfo ci) {
        ExposureScene.pose("moves-base-after", model, actor);
    }
}
