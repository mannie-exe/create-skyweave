package audit.animation;

import com.google.gson.*;
import java.lang.annotation.Annotation;
import java.lang.reflect.Method;
import java.util.*;

/** Read native merged metadata; presence is not an executed hook, conflict, or per-item coverage. */
public final class RenderHookInventory {
    private RenderHookInventory() {}
    public static JsonObject capture() {
        JsonObject result = new JsonObject(); JsonArray targets = new JsonArray(), errors = new JsonArray();
        result.addProperty("scope", "Installed MixinMerged method declarations on selected loaded render/model classes. Not all event handlers, fields, resource transforms, actual invocation, conflicts, or item support.");
        for (String name : List.of("net.minecraft.client.renderer.ItemInHandRenderer",
                "net.minecraft.client.renderer.entity.ItemRenderer", "net.minecraft.client.renderer.entity.layers.ItemInHandLayer",
                "net.minecraft.client.model.HumanoidModel", "net.minecraft.client.model.PlayerModel",
                "net.minecraft.client.renderer.entity.LivingEntityRenderer", "net.minecraft.client.renderer.entity.player.PlayerRenderer",
                "net.minecraft.client.renderer.GameRenderer", "net.minecraft.client.Camera")) {
            JsonObject target = new JsonObject(); target.addProperty("class", name); JsonArray methods = new JsonArray();
            try {
                for (Method method : Class.forName(name).getDeclaredMethods()) {
                    for (Annotation annotation : method.getDeclaredAnnotations()) {
                        Class<? extends Annotation> type = annotation.annotationType();
                        if (!type.getName().equals("org.spongepowered.asm.mixin.transformer.meta.MixinMerged")) continue;
                        String owner = String.valueOf(type.getMethod("mixin").invoke(annotation));
                        JsonObject row = new JsonObject(); row.addProperty("method", method.getName());
                        row.addProperty("returnType", method.getReturnType().getTypeName()); JsonArray parameters = new JsonArray();
                        for (Class<?> parameter : method.getParameterTypes()) parameters.add(parameter.getTypeName());
                        row.add("parameters", parameters); row.addProperty("mixin", owner);
                        row.addProperty("priority", (Integer) type.getMethod("priority").invoke(annotation));
                        row.addProperty("fixtureOnly", owner.startsWith("audit.animation.")); methods.add(row);
                        if (methods.size() > 4096) throw new IllegalStateException("Render-hook inventory bound exceeded");
                    }
                }
            } catch (ReflectiveOperationException | RuntimeException | LinkageError failure) {
                errors.add(name + ": " + failure);
            }
            target.add("mergedMethods", methods); targets.add(target);
        }
        result.add("targets", targets); result.add("errors", errors); result.addProperty("completeSelectedTargets", errors.isEmpty());
        return result;
    }
}
