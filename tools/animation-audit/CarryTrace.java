package audit.animation.mixin;

import audit.animation.CarryScene;
import net.minecraft.client.model.HumanoidModel;
import net.minecraft.client.model.PlayerModel;
import net.minecraft.client.player.AbstractClientPlayer;
import net.minecraft.world.entity.*;
import org.spongepowered.asm.mixin.*;
import org.spongepowered.asm.mixin.injection.*;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(targets = "com.github.ysbbbbbb.kaleidoscopecookery.client.animation.CustomArmPose", remap = false)
abstract class CarryNativePoseTrace {
    @Inject(method = "lambda$static$0", at = @At("HEAD"), require = 1)
    private static void animationAudit$before(HumanoidModel<?> model, LivingEntity actor, HumanoidArm arm, CallbackInfo ci) { CarryScene.pose("native-before", model, actor, arm); }
    @Inject(method = "lambda$static$0", at = @At("RETURN"), require = 1)
    private static void animationAudit$after(HumanoidModel<?> model, LivingEntity actor, HumanoidArm arm, CallbackInfo ci) { CarryScene.pose("native-after", model, actor, arm); }
}

@Pseudo
@Mixin(targets = "punchymoves.client.PlayerAnimationEngine", remap = false)
abstract class CarryMovesTrace {
    @Inject(method = "applyPoseBase(Lnet/minecraft/client/player/AbstractClientPlayer;Lnet/minecraft/client/model/PlayerModel;Lpunchymoves/client/PlayerPoseState;)V", at = @At("HEAD"), require = 1)
    private static void animationAudit$before(AbstractClientPlayer actor, PlayerModel<?> model, @Coerce Object state, CallbackInfo ci) { CarryScene.pose("moves-before", model, actor, null); }
    @Inject(method = "applyPoseBase(Lnet/minecraft/client/player/AbstractClientPlayer;Lnet/minecraft/client/model/PlayerModel;Lpunchymoves/client/PlayerPoseState;)V", at = @At("RETURN"), require = 1)
    private static void animationAudit$after(AbstractClientPlayer actor, PlayerModel<?> model, @Coerce Object state, CallbackInfo ci) { CarryScene.pose("moves-after", model, actor, null); }
}
