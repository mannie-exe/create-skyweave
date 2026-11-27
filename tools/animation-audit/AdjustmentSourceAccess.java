package audit.animation.mixin;

import dev.kosmx.playerAnim.api.layered.modifier.AdjustmentModifier;
import java.util.Optional;
import java.util.function.Function;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Accessor;

/** Access only the source on the exact BC-owned modifier passed to its attack substack. */
@Mixin(AdjustmentModifier.class)
public interface AdjustmentSourceAccess {
    @Accessor("source")
    Function<String, Optional<AdjustmentModifier.PartModifier>> animationAudit$getSource();

    @Accessor("source")
    void animationAudit$setSource(Function<String, Optional<AdjustmentModifier.PartModifier>> source);
}
