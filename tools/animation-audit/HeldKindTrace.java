package audit.animation.mixin;

import audit.animation.PoseScene;
import audit.animation.ItemUseScene;
import net.minecraft.world.item.ItemStack;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.*;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Read the actual first-person consumer decision; never change the returned kind. */
@Mixin(targets = "punchy.client.render.ToolKindResolver", remap = false)
abstract class HeldKindTrace {
    @Inject(method = "resolveItemKind(Lnet/minecraft/world/item/ItemStack;Lpunchy/client/renderer/layer/VanillaFirstPersonItemLayer$ToolKind;)Lpunchy/client/renderer/layer/VanillaFirstPersonItemLayer$ToolKind;",
        at = @At("RETURN"), require = 1, remap = false)
    private static void animationAudit$itemKind(ItemStack item, @Coerce Object fallback, CallbackInfoReturnable<Object> result) {
        PoseScene.kind("item", item, fallback, result.getReturnValue());
        ItemUseScene.kind("item", item, fallback, result.getReturnValue());
    }

    @Inject(method = "resolveArmKind(Lnet/minecraft/world/item/ItemStack;Lpunchy/client/renderer/layer/PlayerArmModelLayer$ToolKind;)Lpunchy/client/renderer/layer/PlayerArmModelLayer$ToolKind;",
        at = @At("RETURN"), require = 1, remap = false)
    private static void animationAudit$armKind(ItemStack item, @Coerce Object fallback, CallbackInfoReturnable<Object> result) {
        PoseScene.kind("arm", item, fallback, result.getReturnValue());
        ItemUseScene.kind("arm", item, fallback, result.getReturnValue());
    }
}
