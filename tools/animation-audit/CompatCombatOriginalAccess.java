package audit.animation.mixin;

import java.util.function.Supplier;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Invoker;

/** Test-only original-source read scope; never sets an animation or feature flag. */
@Mixin(targets = "design.inherent.skyweavecompat.client.CombatPitch", remap = false)
public interface CompatCombatOriginalAccess {
    @Invoker(value = "original", remap = false)
    static <T> T animationAudit$original(Supplier<T> read) { throw new AssertionError("Mixin invoker missing"); }
}
