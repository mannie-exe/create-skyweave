package audit.animation.mixin;

import audit.animation.ExposurePrintScene;
import com.mojang.blaze3d.vertex.PoseStack;
import io.github.mortuusars.exposure.client.render.photograph.PhotographRenderer;
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.world.item.ItemStack;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(value = PhotographRenderer.class, remap = false)
abstract class ExposurePrintProviderTrace {
    @Inject(method = "render(Lnet/minecraft/world/item/ItemStack;ZZLcom/mojang/blaze3d/vertex/PoseStack;Lnet/minecraft/client/renderer/MultiBufferSource;I)Z", at = @At("HEAD"), require = 1)
    private void animationAudit$provider(ItemStack item, boolean front, boolean back, PoseStack poses, MultiBufferSource buffers, int light, CallbackInfoReturnable<Boolean> ci) {
        ExposurePrintScene.provider(item, front, back);
    }
}
