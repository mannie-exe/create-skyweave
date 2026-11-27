package audit.animation.mixin;

import audit.animation.ExposurePrintScene;
import com.llamalad7.mixinextras.injector.wrapmethod.WrapMethod;
import com.llamalad7.mixinextras.injector.wrapoperation.Operation;
import com.mojang.blaze3d.vertex.PoseStack;
import net.minecraft.client.player.AbstractClientPlayer;
import net.minecraft.client.player.LocalPlayer;
import net.minecraft.client.renderer.ItemInHandRenderer;
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.item.ItemStack;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(value = ItemInHandRenderer.class, priority = 3000)
abstract class ExposurePrintHandsTrace {
    @WrapMethod(method = "renderHandsWithItems")
    private void animationAudit$hands(float partial, PoseStack poses, MultiBufferSource.BufferSource buffers, LocalPlayer player, int light, Operation<Void> original) {
        ExposurePrintScene.enterHands();
        try { original.call(partial, poses, buffers, player, light); } finally { ExposurePrintScene.leaveHands(); }
    }
    @Inject(method = "renderArmWithItem", at = @At("HEAD"), require = 1)
    private void animationAudit$arm(AbstractClientPlayer player, float partial, float pitch, InteractionHand hand, float swing, ItemStack item, float equip, PoseStack poses, MultiBufferSource buffers, int light, CallbackInfo ci) {
        ExposurePrintScene.arm(item, hand);
    }
}
