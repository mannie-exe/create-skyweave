package audit.animation.mixin;

import audit.animation.HoseScene;
import net.minecraft.world.entity.player.Player;
import net.minecraft.server.network.ServerCommonPacketListenerImpl;
import net.minecraft.network.protocol.Packet;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.*;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Observe original delivery boundaries only; no packet, clock, counter, or item mutations. */
@Mixin(Player.class)
abstract class HoseCompletionTrace {
    @Inject(method = "handleEntityEvent(B)V", at = @At("HEAD"), require = 1)
    private void animationAudit$eventBefore(byte event, CallbackInfo ci) { HoseScene.entityEvent("clientEvent9Head", (Player)(Object)this, event); }
    @Inject(method = "handleEntityEvent(B)V", at = @At("RETURN"), require = 1)
    private void animationAudit$eventAfter(byte event, CallbackInfo ci) { HoseScene.entityEvent("clientEvent9Return", (Player)(Object)this, event); }
}

@Mixin(ServerCommonPacketListenerImpl.class)
abstract class HosePacketSendTrace {
    @Inject(method = "send(Lnet/minecraft/network/protocol/Packet;)V", at = @At("HEAD"), require = 1)
    private void animationAudit$send(Packet<?> packet, CallbackInfo ci) { HoseScene.packetSent(packet); }
}
