package audit.animation.mixin;

import net.minecraft.client.KeyboardHandler;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Invoker;

/** Owned-window callback driver. This exercises the game callback pipeline, not OS delivery. */
@Mixin(KeyboardHandler.class)
public interface NativeInputInvoker {
    @Invoker("keyPress") void animationAudit$keyPress(long window, int key, int scanCode, int action, int modifiers);
}
