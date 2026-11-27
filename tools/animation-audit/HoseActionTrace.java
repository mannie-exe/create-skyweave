package audit.animation.mixin;

import audit.animation.HoseScene;
import net.minecraft.world.*;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.*;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(targets = "com.tiviacz.travelersbackpack.items.HoseItem", remap = false)
abstract class HoseActionTrace {
    @Inject(method = "use(Lnet/minecraft/world/level/Level;Lnet/minecraft/world/entity/player/Player;Lnet/minecraft/world/InteractionHand;)Lnet/minecraft/world/InteractionResultHolder;", at = @At("HEAD"), require = 1)
    private void animationAudit$use(Level level, Player player, InteractionHand hand, CallbackInfoReturnable<InteractionResultHolder<ItemStack>> result) { HoseScene.action("useHead", player.getItemInHand(hand), level, player, hand, null); }
    @Inject(method = "use(Lnet/minecraft/world/level/Level;Lnet/minecraft/world/entity/player/Player;Lnet/minecraft/world/InteractionHand;)Lnet/minecraft/world/InteractionResultHolder;", at = @At("RETURN"), require = 1)
    private void animationAudit$return(Level level, Player player, InteractionHand hand, CallbackInfoReturnable<InteractionResultHolder<ItemStack>> result) { HoseScene.action("useReturn", player.getItemInHand(hand), level, player, hand, result.getReturnValue().getResult().name()); }
    @Inject(method = "finishUsingItem(Lnet/minecraft/world/item/ItemStack;Lnet/minecraft/world/level/Level;Lnet/minecraft/world/entity/LivingEntity;)Lnet/minecraft/world/item/ItemStack;", at = @At("HEAD"), require = 1)
    private void animationAudit$finishHead(ItemStack stack, Level level, LivingEntity entity, CallbackInfoReturnable<ItemStack> result) { HoseScene.action("finishHead", stack, level, entity, null, null); }
    @Inject(method = "finishUsingItem(Lnet/minecraft/world/item/ItemStack;Lnet/minecraft/world/level/Level;Lnet/minecraft/world/entity/LivingEntity;)Lnet/minecraft/world/item/ItemStack;", at = @At("RETURN"), require = 1)
    private void animationAudit$finishReturn(ItemStack stack, Level level, LivingEntity entity, CallbackInfoReturnable<ItemStack> result) { HoseScene.action("finishReturn", stack, level, entity, null, null); }
}
