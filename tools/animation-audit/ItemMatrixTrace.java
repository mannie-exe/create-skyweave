package audit.animation.mixin;

import audit.animation.PoseScene;
import audit.animation.ItemUseScene;
import com.mojang.blaze3d.vertex.PoseStack;
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.client.renderer.entity.ItemRenderer;
import net.minecraft.client.resources.model.BakedModel;
import net.minecraft.world.item.ItemDisplayContext;
import net.minecraft.world.item.ItemStack;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Read matrices around the original native transform; do not invoke another draw. */
@Mixin(ItemRenderer.class)
abstract class ItemMatrixTrace {
    @Inject(method = "render(Lnet/minecraft/world/item/ItemStack;Lnet/minecraft/world/item/ItemDisplayContext;ZLcom/mojang/blaze3d/vertex/PoseStack;Lnet/minecraft/client/renderer/MultiBufferSource;IILnet/minecraft/client/resources/model/BakedModel;)V",
        at = @At("HEAD"), require = 1)
    private void animationAudit$itemEntry(ItemStack item, ItemDisplayContext context, boolean left,
            PoseStack poses, MultiBufferSource buffers, int light, int overlay, BakedModel model, CallbackInfo ci) {
        PoseScene.itemMatrix("entry", item, context, left, poses, model);
        ItemUseScene.itemMatrix("entry", item, context, left, poses, model);
        audit.animation.ExposureScene.itemMatrix("entry", item, context, left, poses, model);
        audit.animation.ExposurePrintScene.model(item, context, poses, model);
        audit.animation.HoseScene.model(item, context, poses, model);
        audit.animation.ShakerScene.model(item, context, poses, model);
        audit.animation.CarryScene.model("entry", item, context, poses, model);
    }

    @Inject(method = "render(Lnet/minecraft/world/item/ItemStack;Lnet/minecraft/world/item/ItemDisplayContext;ZLcom/mojang/blaze3d/vertex/PoseStack;Lnet/minecraft/client/renderer/MultiBufferSource;IILnet/minecraft/client/resources/model/BakedModel;)V",
        at = @At(value = "INVOKE", target = "Lnet/minecraft/client/resources/model/BakedModel;getRenderPasses(Lnet/minecraft/world/item/ItemStack;Z)Ljava/util/List;"), require = 1)
    private void animationAudit$beforeItemPasses(ItemStack item, ItemDisplayContext context, boolean left,
            PoseStack poses, MultiBufferSource buffers, int light, int overlay, BakedModel model, CallbackInfo ci) {
        PoseScene.itemMatrix("beforePasses", item, context, left, poses, model);
        ItemUseScene.itemMatrix("beforePasses", item, context, left, poses, model);
        audit.animation.CarryScene.model("beforePasses", item, context, poses, model);
    }
}
