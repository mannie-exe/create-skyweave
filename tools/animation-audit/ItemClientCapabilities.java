package audit.animation;

import com.google.gson.*;
import java.lang.reflect.*;
import java.util.*;
import net.minecraft.client.multiplayer.ClientLevel;
import net.minecraft.world.flag.FeatureFlagSet;
import net.minecraft.world.flag.FeatureFlags;
import net.minecraft.world.item.Item;
import net.neoforged.neoforge.client.extensions.common.IClientItemExtensions;

/** Native registration/availability queries only; no use, pose, renderer, or animation invocation. */
public final class ItemClientCapabilities {
    private static final List<Method> METHODS = Arrays.stream(IClientItemExtensions.class.getMethods())
        .filter(value -> !Modifier.isStatic(value.getModifiers()))
        .sorted(Comparator.comparing(Method::toGenericString)).toList();
    private final ClientLevel level;
    private final FeatureFlagSet features;
    private final JsonObject implementations = new JsonObject();
    private final JsonArray errors = new JsonArray();
    private final Map<Class<?>, String> availabilityOwners = new HashMap<>();

    public ItemClientCapabilities(ClientLevel level) {
        this.level = level;
        features = level == null ? null : level.enabledFeatures();
    }

    private static JsonArray featureNames(FeatureFlagSet flags) {
        JsonArray names = new JsonArray();
        FeatureFlags.REGISTRY.toNames(flags).stream().map(Object::toString).sorted().forEach(names::add);
        return names;
    }

    public JsonObject item(Item item, String id) {
        JsonObject row = new JsonObject();
        try {
            row.add("requiredFeatures", featureNames(item.requiredFeatures()));
            if (features == null) row.add("enabledInCapturedWorld", JsonNull.INSTANCE);
            else row.addProperty("enabledInCapturedWorld", item.isEnabled(features));
            Class<?> itemClass = item.getClass();
            String owner = availabilityOwners.get(itemClass);
            if (owner == null) {
                owner = itemClass.getMethod("isEnabled", FeatureFlagSet.class).getDeclaringClass().getName();
                availabilityOwners.put(itemClass, owner);
            }
            row.addProperty("availabilityMethodOwner", owner);
            IClientItemExtensions extension = Objects.requireNonNull(IClientItemExtensions.of(item));
            Class<?> type = extension.getClass();
            String name = type.getName();
            if (!implementations.has(name)) {
                JsonObject declaration = new JsonObject();
                JsonArray methods = new JsonArray();
                for (Method method : METHODS) {
                    Method resolved = type.getMethod(method.getName(), method.getParameterTypes());
                    JsonObject entry = new JsonObject();
                    entry.addProperty("method", method.getName());
                    entry.addProperty("interfaceMethod", method.toGenericString());
                    entry.addProperty("owner", resolved.getDeclaringClass().getName());
                    entry.addProperty("signature", resolved.toGenericString());
                    entry.addProperty("nonDefaultDeclaration", resolved.getDeclaringClass() != IClientItemExtensions.class);
                    methods.add(entry);
                }
                declaration.add("methodDeclarations", methods);
                var source = type.getProtectionDomain().getCodeSource();
                declaration.addProperty("classOrigin", source == null ? null : String.valueOf(source.getLocation()));
                implementations.add(name, declaration);
            }
            row.addProperty("extensionClass", name);
            row.addProperty("defaultExtensionInstance", extension == IClientItemExtensions.DEFAULT);
        } catch (ReflectiveOperationException | RuntimeException | LinkageError error) {
            String message = error.getClass().getName() + ": " + error.getMessage();
            row.addProperty("inspectionError", message);
            errors.add(id + ": " + message);
        }
        return row;
    }

    public JsonObject summary() {
        JsonObject result = new JsonObject();
        result.addProperty("scope", "Actual IClientItemExtensions registrations and public interface method owners; no extension action, renderer, pose, or visual fallback invocation. Availability is item.isEnabled(actual client-level feature set), including current item overrides/config; not creative-tab visibility, obtaining, permissions, or every stack variant.");
        result.addProperty("worldPresent", level != null);
        JsonArray interfaceMethods = new JsonArray();
        METHODS.stream().map(Method::toGenericString).forEach(interfaceMethods::add);
        result.add("interfaceMethods", interfaceMethods);
        result.add("enabledFeatures", features == null ? JsonNull.INSTANCE : featureNames(features));
        result.add("implementations", implementations);
        result.add("errors", errors);
        result.addProperty("complete", errors.isEmpty());
        return result;
    }
}
