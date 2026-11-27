package audit.animation.mixin;

import dev.kosmx.playerAnim.core.impl.AnimationProcessor;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Accessor;

@Mixin(value = AnimationProcessor.class, remap = false)
public interface AnimationClockAccess {
    @Accessor("tickDelta") float animationAudit$partial();
}
