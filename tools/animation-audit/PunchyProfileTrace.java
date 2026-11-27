package audit.animation.mixin;

import audit.animation.PoseScene;
import net.minecraft.world.item.ItemStack;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.*;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Observe actual profile resolution, retaining the original returned object. */
@Mixin(targets = "punchy.client.render.ToolTuning", remap = false)
abstract class PunchyProfileTrace {
    @Inject(method = "resolveProfile(Lnet/minecraft/world/item/ItemStack;Lpunchy/client/renderer/layer/VanillaFirstPersonItemLayer$ToolKind;Z)Lpunchy/client/render/ToolTuning$Profile;",
        at = @At("RETURN"), require = 1, remap = false)
    private static void animationAudit$itemProfile(ItemStack item, @Coerce Object kind, boolean left, CallbackInfoReturnable<Object> result) {
        PoseScene.profile("item", item, kind, left, result.getReturnValue());
    }
}

@Mixin(targets = "punchy.client.renderer.layer.ArmToolTuning", remap = false)
abstract class PunchyArmProfileTrace {
    @Inject(method = "resolveProfile(Lnet/minecraft/world/item/ItemStack;Lpunchy/client/renderer/layer/PlayerArmModelLayer$ToolKind;Z)Lpunchy/client/renderer/layer/ArmToolTuning$Profile;",
        at = @At("RETURN"), require = 1, remap = false)
    private static void animationAudit$armProfile(ItemStack item, @Coerce Object kind, boolean left, CallbackInfoReturnable<Object> result) {
        PoseScene.profile("arm", item, kind, left, result.getReturnValue());
    }
}
