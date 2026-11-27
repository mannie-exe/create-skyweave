package audit.animation.mixin;

import audit.animation.ExposurePrintScene;
import com.mojang.blaze3d.vertex.PoseStack;
import io.github.mortuusars.exposure.client.image.renderable.RenderableImage;
import io.github.mortuusars.exposure.client.render.image.RenderedImageInstance;
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.client.renderer.texture.DynamicTexture;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Reads the pixels after the original draw/upload/vertex submissions; no extra draw or upload. */
@Mixin(value = RenderedImageInstance.class, remap = false)
abstract class ExposurePrintImageTrace {
    @Shadow protected RenderableImage image;
    @Shadow protected DynamicTexture texture;
    @Shadow protected boolean requiresUpload;
    @Inject(method = "draw", at = @At("RETURN"), require = 1)
    private void animationAudit$image(PoseStack poses, MultiBufferSource buffers, float minX, float minY, float maxX, float maxY, float minU, float minV, float maxU, float maxV, int light, int red, int green, int blue, int alpha, CallbackInfo ci) {
        ExposurePrintScene.image(image, texture == null ? null : texture.getPixels(), requiresUpload, poses);
    }
}
