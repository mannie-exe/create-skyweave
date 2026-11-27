package audit.animation.mixin;

import audit.animation.PoseScene;
import audit.animation.ItemUseScene;
import com.mojang.blaze3d.vertex.PoseStack;
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.client.renderer.entity.LivingEntityRenderer;
import net.minecraft.world.entity.LivingEntity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Observe the original model immediately before its original body draw. */
@Mixin(LivingEntityRenderer.class)
abstract class RenderedPoseTrace {
    @Inject(method = "render(Lnet/minecraft/world/entity/LivingEntity;FFLcom/mojang/blaze3d/vertex/PoseStack;Lnet/minecraft/client/renderer/MultiBufferSource;I)V",
        at = @At(value = "INVOKE", target = "Lnet/minecraft/client/model/EntityModel;renderToBuffer(Lcom/mojang/blaze3d/vertex/PoseStack;Lcom/mojang/blaze3d/vertex/VertexConsumer;III)V"), require = 1)
    private void animationAudit$beforeBodyDraw(LivingEntity entity, float yaw, float partialTick,
            PoseStack poses, MultiBufferSource buffers, int light, CallbackInfo ci) {
        PoseScene.draw((LivingEntityRenderer<?, ?>) (Object) this, entity, partialTick, poses);
        ItemUseScene.draw((LivingEntityRenderer<?, ?>) (Object) this, entity, poses);
        audit.animation.ExposureScene.draw((LivingEntityRenderer<?, ?>) (Object) this, entity);
        audit.animation.HoseScene.body((LivingEntityRenderer<?, ?>) (Object) this, entity);
        audit.animation.ShakerScene.body((LivingEntityRenderer<?, ?>) (Object) this, entity);
        if (((LivingEntityRenderer<?, ?>) (Object) this).getModel() instanceof net.minecraft.client.model.HumanoidModel<?> model)
            audit.animation.CarryScene.pose("body-final", model, entity, null);
    }
}
