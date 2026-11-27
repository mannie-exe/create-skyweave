package audit.animation.mixin;

import audit.animation.ShakerScene;
import com.mojang.blaze3d.vertex.PoseStack;
import net.minecraft.client.model.HumanoidModel;
import net.minecraft.client.model.PlayerModel;
import net.minecraft.client.player.AbstractClientPlayer;
import net.minecraft.client.player.LocalPlayer;
import net.minecraft.world.*;
import net.minecraft.world.entity.*;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import org.spongepowered.asm.mixin.*;
import org.spongepowered.asm.mixin.injection.*;
import org.spongepowered.asm.mixin.injection.callback.*;

@Mixin(targets = "com.github.ysbbbbbb.kaleidoscopetavern.item.ShakerItem", remap = false)
abstract class ShakerTrace {
    @Inject(method = "use", at = @At("RETURN"), require = 1)
    private void animationAudit$use(Level level, Player player, InteractionHand hand, CallbackInfoReturnable<InteractionResultHolder<ItemStack>> result) { ShakerScene.action("useReturn", player.getItemInHand(hand), level, player, hand, -1, result.getReturnValue().getResult().name()); }
    @Inject(method = "releaseUsing", at = @At("HEAD"), require = 1)
    private void animationAudit$release(ItemStack item, Level level, LivingEntity actor, int remaining, CallbackInfo ci) { ShakerScene.action("releaseHead", item, level, actor, null, remaining, null); }
    @Inject(method = "releaseUsing", at = @At("RETURN"), require = 1)
    private void animationAudit$return(ItemStack item, Level level, LivingEntity actor, int remaining, CallbackInfo ci) { ShakerScene.action("releaseReturn", item, level, actor, null, remaining, null); }
}

@Mixin(targets = "com.github.ysbbbbbb.kaleidoscopetavern.client.animation.ShakerAnimation", remap = false)
abstract class ShakerPoseTrace {
    @Inject(method = "lambda$static$0", at = @At("HEAD"), require = 1)
    private static void animationAudit$before(HumanoidModel<?> model, LivingEntity actor, HumanoidArm arm, CallbackInfo ci) { ShakerScene.pose("shaker-before", model, actor); }
    @Inject(method = "lambda$static$0", at = @At("RETURN"), require = 1)
    private static void animationAudit$after(HumanoidModel<?> model, LivingEntity actor, HumanoidArm arm, CallbackInfo ci) { ShakerScene.pose("shaker-after", model, actor); }
}

@Mixin(targets = "com.github.ysbbbbbb.kaleidoscopetavern.client.animation.ShakerAnimation$ShakerExtensions", remap = false)
abstract class ShakerHandTrace {
    @Inject(method = "applyForgeHandTransform", at = @At("HEAD"), require = 1)
    private void animationAudit$before(PoseStack poses, LocalPlayer player, HumanoidArm arm, ItemStack item, float partial, float equip, float swing, CallbackInfoReturnable<Boolean> ci) { ShakerScene.handTransform("native-hand-before", player, arm, poses, null); }
    @Inject(method = "applyForgeHandTransform", at = @At("RETURN"), require = 1)
    private void animationAudit$after(PoseStack poses, LocalPlayer player, HumanoidArm arm, ItemStack item, float partial, float equip, float swing, CallbackInfoReturnable<Boolean> ci) { ShakerScene.handTransform("native-hand-after", player, arm, poses, ci.getReturnValue()); }
}

@Pseudo
@Mixin(targets = "punchymoves.client.PlayerAnimationEngine", remap = false)
abstract class ShakerMovesTrace {
    @Inject(method = "applyPoseBase(Lnet/minecraft/client/player/AbstractClientPlayer;Lnet/minecraft/client/model/PlayerModel;Lpunchymoves/client/PlayerPoseState;)V", at = @At("HEAD"), require = 1)
    private static void animationAudit$before(AbstractClientPlayer actor, PlayerModel<?> model, @Coerce Object state, CallbackInfo ci) { ShakerScene.pose("moves-before", model, actor); }
    @Inject(method = "applyPoseBase(Lnet/minecraft/client/player/AbstractClientPlayer;Lnet/minecraft/client/model/PlayerModel;Lpunchymoves/client/PlayerPoseState;)V", at = @At("RETURN"), require = 1)
    private static void animationAudit$after(AbstractClientPlayer actor, PlayerModel<?> model, @Coerce Object state, CallbackInfo ci) { ShakerScene.pose("moves-after", model, actor); }
}
