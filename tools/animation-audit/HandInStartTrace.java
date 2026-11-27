package audit.animation.mixin;

import audit.animation.PoseScene;
import net.minecraft.world.entity.HumanoidArm;
import net.minecraft.world.item.ItemStack;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.*;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Observe the original native trigger; never request or replace an animation. */
@Mixin(targets = "punchymoves.client.animation.LocomotionController", remap = false)
abstract class HandInStartTrace {
    @Inject(method = "startHandIn(Lpunchymoves/client/animation/AnimationLibrary;Lnet/minecraft/world/item/ItemStack;Lnet/minecraft/world/entity/HumanoidArm;Z)Z",
        at = @At("RETURN"), require = 1, remap = false)
    private void animationAudit$handIn(@Coerce Object library, ItemStack item, HumanoidArm arm,
            boolean forced, CallbackInfoReturnable<Boolean> result) {
        PoseScene.nativeHandIn(item, arm, forced, result.getReturnValue());
    }
}
