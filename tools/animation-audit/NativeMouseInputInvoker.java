package audit.animation.mixin;

import net.minecraft.client.MouseHandler;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Invoker;

/** Owned-window mouse callback, preserving the original callback and its installed hooks. */
@Mixin(MouseHandler.class)
public interface NativeMouseInputInvoker {
    @Invoker("onPress") void animationAudit$mousePress(long window, int button, int action, int modifiers);
}
