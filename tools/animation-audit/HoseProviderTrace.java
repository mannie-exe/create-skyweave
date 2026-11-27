package audit.animation.mixin;

import audit.animation.HoseScene;
import net.minecraft.client.Minecraft;
import net.minecraft.client.model.PlayerModel;
import net.minecraft.client.player.AbstractClientPlayer;
import org.spongepowered.asm.mixin.*;
import org.spongepowered.asm.mixin.injection.*;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Pseudo
@Mixin(targets = "punchymoves.client.PlayerAnimationEngine", remap = false)
abstract class HoseMovesTrace {
    @Inject(method = "applyPoseBase(Lnet/minecraft/client/player/AbstractClientPlayer;Lnet/minecraft/client/model/PlayerModel;Lpunchymoves/client/PlayerPoseState;)V", at = @At("HEAD"), require = 1)
    private static void animationAudit$before(AbstractClientPlayer actor, PlayerModel<?> model, @Coerce Object state, CallbackInfo ci) { HoseScene.pose("moves-before", model, actor); }
    @Inject(method = "applyPoseBase(Lnet/minecraft/client/player/AbstractClientPlayer;Lnet/minecraft/client/model/PlayerModel;Lpunchymoves/client/PlayerPoseState;)V", at = @At("RETURN"), require = 1)
    private static void animationAudit$after(AbstractClientPlayer actor, PlayerModel<?> model, @Coerce Object state, CallbackInfo ci) { HoseScene.pose("moves-after", model, actor); }
}

@Pseudo
@Mixin(targets = "punchy.client.state.ConsumeStateMachine", remap = false)
abstract class HoseConsumeTrace {
    @Inject(method = "tick(Lnet/minecraft/client/Minecraft;)V", at = @At("RETURN"), require = 1)
    private void animationAudit$consume(Minecraft mc, CallbackInfo ci) { HoseScene.consume(this); }
}
