package audit.animation.mixin;

import audit.animation.OverlayBoneProbe;
import audit.animation.PoseScene;
import com.llamalad7.mixinextras.injector.wrapoperation.*;
import java.util.List;
import net.minecraft.world.item.ItemStack;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.*;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(targets = "punchymoves.client.animation.ItemAnimationBindings", remap = false)
abstract class OverlayBoneNamesProbe {
    @WrapOperation(method = "parseOverlays", at = @At(value = "INVOKE",
        target = "Lpunchymoves/client/animation/ItemAnimationBindings;normalize(Ljava/lang/String;)Ljava/lang/String;"),
        require = 1, remap = false)
    private static String animationAudit$boneNames(String raw, Operation<String> original) {
        return OverlayBoneProbe.result(raw, original.call(raw));
    }
}

@Mixin(targets = "punchymoves.client.animation.AnimationLibrary", remap = false)
abstract class OverlayBoneTrace {
    @Inject(method = "overlaysFor(Lnet/minecraft/world/item/ItemStack;Ljava/lang/String;ZLpunchymoves/client/animation/AnimationLibrary$Clip;)Ljava/util/List;",
        at = @At("RETURN"), require = 1, remap = false)
    private void animationAudit$resolvedOverlays(ItemStack item, String action, boolean left,
            @Coerce Object base, CallbackInfoReturnable<List<?>> result) {
        PoseScene.overlayResolution(item, action, left, base, result.getReturnValue());
    }
}
