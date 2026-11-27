package audit.animation.mixin;

import audit.animation.ItemUseScene;
import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.ClientLevel;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResultHolder;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.*;
import org.spongepowered.asm.mixin.injection.callback.*;

@Mixin(ItemStack.class)
abstract class ItemUseTrace {
    @Inject(method = "use(Lnet/minecraft/world/level/Level;Lnet/minecraft/world/entity/player/Player;Lnet/minecraft/world/InteractionHand;)Lnet/minecraft/world/InteractionResultHolder;",
        at = @At("HEAD"), require = 1)
    private void animationAudit$useHead(Level level, Player player, InteractionHand hand,
            CallbackInfoReturnable<InteractionResultHolder<ItemStack>> result) {
        ItemUseScene.useEvent("useHead", (ItemStack)(Object)this, level, player, hand, -1, null);
        audit.animation.ExposureScene.useEvent("useHead", (ItemStack)(Object)this, level, player, hand);
        audit.animation.ExposurePrintScene.useEvent("useHead", (ItemStack)(Object)this, level, player, hand);
    }
    @Inject(method = "use(Lnet/minecraft/world/level/Level;Lnet/minecraft/world/entity/player/Player;Lnet/minecraft/world/InteractionHand;)Lnet/minecraft/world/InteractionResultHolder;",
        at = @At("RETURN"), require = 1)
    private void animationAudit$useReturn(Level level, Player player, InteractionHand hand,
            CallbackInfoReturnable<InteractionResultHolder<ItemStack>> result) {
        ItemUseScene.useEvent("useReturn", (ItemStack)(Object)this, level, player, hand, -1, result.getReturnValue().getResult().toString());
        audit.animation.ExposureScene.useEvent("useReturn", (ItemStack)(Object)this, level, player, hand);
        audit.animation.ExposurePrintScene.useEvent("useReturn", (ItemStack)(Object)this, level, player, hand);
    }
    @Inject(method = "releaseUsing(Lnet/minecraft/world/level/Level;Lnet/minecraft/world/entity/LivingEntity;I)V",
        at = @At("HEAD"), require = 1)
    private void animationAudit$releaseHead(Level level, LivingEntity player, int remaining, CallbackInfo result) {
        ItemUseScene.useEvent("releaseHead", (ItemStack)(Object)this, level, player, null, remaining, null);
    }
    @Inject(method = "releaseUsing(Lnet/minecraft/world/level/Level;Lnet/minecraft/world/entity/LivingEntity;I)V",
        at = @At("RETURN"), require = 1)
    private void animationAudit$releaseReturn(Level level, LivingEntity player, int remaining, CallbackInfo result) {
        ItemUseScene.useEvent("releaseReturn", (ItemStack)(Object)this, level, player, null, remaining, null);
    }
}

@Mixin(targets = "com.github.ysbbbbbb.kaleidoscopecookery.item.RawDoughItem", remap = false)
abstract class DoughPullTrace {
    @Inject(method = "getTexture(Lnet/minecraft/world/item/ItemStack;Lnet/minecraft/client/multiplayer/ClientLevel;Lnet/minecraft/world/entity/LivingEntity;I)F",
        at = @At("RETURN"), require = 1, remap = false)
    private static void animationAudit$doughProperty(ItemStack item, ClientLevel level, LivingEntity player,
            int seed, CallbackInfoReturnable<Float> result) {
        ItemUseScene.doughProperty(item, player, result.getReturnValue());
    }
}

@Mixin(targets = "punchy.client.state.BowStateMachine", remap = false)
abstract class BowDispatchTrace {
    @Inject(method = "tick(Lnet/minecraft/client/Minecraft;)V", at = @At("RETURN"), require = 1, remap = false)
    private void animationAudit$bowState(Minecraft mc, CallbackInfo result) {
        ItemUseScene.bowState(this);
    }
}

@Mixin(targets = "com.github.ysbbbbbb.kaleidoscopecookery.item.StockpotLidItem", remap = false)
abstract class LidUsingTrace {
    @Inject(method = "getTexture(Lnet/minecraft/world/item/ItemStack;Lnet/minecraft/client/multiplayer/ClientLevel;Lnet/minecraft/world/entity/LivingEntity;I)F",
        at = @At("RETURN"), require = 1, remap = false)
    private static void animationAudit$lidProperty(ItemStack item, ClientLevel level, LivingEntity player,
            int seed, CallbackInfoReturnable<Float> result) {
        ItemUseScene.itemProperty("stockpot_lid", item, player, result.getReturnValue());
    }
}
