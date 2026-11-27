package audit.animation.mixin;

import audit.animation.CombatPitchProbe;
import dev.kosmx.playerAnim.api.layered.modifier.AdjustmentModifier;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Probe-only wrapping preserves the original modifier object, fade, and animation lifecycle. */
@Mixin(targets = "net.bettercombat.client.animation.AttackAnimationSubStack")
abstract class CombatStackPitchProbe {
    @Inject(method = "<init>(Ldev/kosmx/playerAnim/api/layered/modifier/AdjustmentModifier;)V",
        at = @At("RETURN"), require = 1)
    private void animationAudit$combatPitch(AdjustmentModifier modifier, CallbackInfo ci) {
        CombatPitchProbe.install(modifier);
    }
}
