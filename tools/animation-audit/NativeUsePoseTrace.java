package audit.animation.mixin;

import audit.animation.NativeUsePoseProbe;
import com.llamalad7.mixinextras.injector.wrapmethod.WrapMethod;
import com.llamalad7.mixinextras.injector.wrapoperation.Operation;
import net.minecraft.client.model.PlayerModel;
import net.minecraft.client.player.AbstractClientPlayer;
import org.spongepowered.asm.mixin.Mixin;
import punchymoves.client.PlayerPoseState;

/** The exact original late-base call still runs once; restoration is private and opt-in. */
@Mixin(targets = "punchymoves.client.PlayerAnimationEngine", remap = false)
abstract class NativeUsePoseTrace {
    @WrapMethod(method = "applyPoseBase(Lnet/minecraft/client/player/AbstractClientPlayer;Lnet/minecraft/client/model/PlayerModel;Lpunchymoves/client/PlayerPoseState;)V")
    private static void animationAudit$nativeUse(AbstractClientPlayer player, PlayerModel<?> model,
            PlayerPoseState state, Operation<Void> original) {
        var frame = NativeUsePoseProbe.before(player, model);
        original.call(player, model, state);
        NativeUsePoseProbe.after(frame);
    }
}
