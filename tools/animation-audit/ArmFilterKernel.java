package audit.animation;

import com.google.gson.*;
import java.lang.reflect.*;
import java.util.*;
import net.minecraft.client.Minecraft;
import net.minecraft.world.item.*;
import org.joml.Vector3f;

/** Invoke the original loaded FF overlay consumer on fresh scratch poses, never the live player. */
final class ArmFilterKernel {
    static JsonObject capture(Minecraft mc) {
        JsonObject result = new JsonObject();
        result.addProperty("scope", "Original loaded FF throwable overlays and original native applyConfiguredOverlays on fresh scratch poses. No natural bow-action or live gameplay inference.");
        JsonArray rows = new JsonArray();
        result.add("rows", rows);
        try {
            Class<?> engine = Class.forName("punchymoves.client.PlayerAnimationEngine");
            Field animations = engine.getDeclaredField("animations"); animations.setAccessible(true);
            Object library = Objects.requireNonNull(animations.get(null));
            Class<?> libraryType = library.getClass();
            Class<?> controller = Class.forName("punchymoves.client.animation.LocomotionController");
            Class<?> poseType = Class.forName(controller.getName() + "$Pose");
            Method identity = poseType.getDeclaredMethod("identity"); identity.setAccessible(true);
            Method apply = Arrays.stream(controller.getDeclaredMethods()).filter(m -> m.getName().equals("applyConfiguredOverlays")).findFirst().orElseThrow();
            apply.setAccessible(true);
            Method resolve = libraryType.getMethod("handedClipFor", ItemStack.class, String.class, boolean.class);
            ItemStack item = new ItemStack(Items.SNOWBALL);
            String source = "punchy_moves:compat/develop.json";
            var resource = mc.getResourceManager().getResource(net.minecraft.resources.ResourceLocation.parse(source)).orElseThrow();
            result.addProperty("definitionSource", resource.sourcePackId());
            try (var stream = resource.open()) {
                result.addProperty("definitionSha256", HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(stream.readAllBytes())));
            }
            // Pinned CompatFormat.normalize converts FF's equip/use phases into sequence_* actions.
            for (String action : List.of("sequence_equip", "sequence_use")) for (boolean left : List.of(false, true)) {
                Object handed = Objects.requireNonNull(resolve.invoke(library, item, action, left), "Native FF clip absent: " + action);
                Method clipMethod = handed.getClass().getDeclaredMethod("clip"); clipMethod.setAccessible(true);
                Object clip = Objects.requireNonNull(clipMethod.invoke(handed));
                Method name = clip.getClass().getMethod("name");
                Method overlays = libraryType.getDeclaredMethod("overlaysFor", ItemStack.class, String.class, boolean.class, clip.getClass());
                overlays.setAccessible(true);
                List<?> configured = (List<?>) overlays.invoke(library, item, action, left, clip);
                if (configured.isEmpty()) throw new IllegalStateException("Original FF arm overlays absent: " + action);
                for (float time : new float[]{0.125f, 0.25f, 0.5f, 0.75f})
                    for (String bone : List.of("left_arm", "right_arm", "head", "waist", "left_item", "right_item")) {
                        Object input = identity.invoke(null);
                        Object output = apply.invoke(null, input, library, item, action, left, bone, clip, time, 1f);
                        JsonObject row = new JsonObject();
                        row.addProperty("action", action); row.addProperty("left", left);
                        row.addProperty("time", time); row.addProperty("bone", bone);
                        row.addProperty("baseClip", (String) name.invoke(clip));
                        row.addProperty("returnedInputIdentity", input == output);
                        JsonArray bindings = new JsonArray();
                        for (Object overlay : configured) {
                            Method applies = overlay.getClass().getDeclaredMethod("appliesTo", String.class); applies.setAccessible(true);
                            Method bones = overlay.getClass().getDeclaredMethod("bones"); bones.setAccessible(true);
                            JsonObject binding = new JsonObject();
                            binding.addProperty("applies", (boolean) applies.invoke(overlay, bone));
                            binding.add("bones", new Gson().toJsonTree(bones.invoke(overlay)));
                            bindings.add(binding);
                        }
                        row.add("overlays", bindings);
                        for (String channel : List.of("position", "rotation", "scaleDelta")) {
                            Field field = poseType.getDeclaredField(channel); field.setAccessible(true);
                            Vector3f value = (Vector3f) field.get(output);
                            JsonArray vector = new JsonArray(); vector.add(value.x); vector.add(value.y); vector.add(value.z);
                            row.add(channel, vector);
                        }
                        rows.add(row);
                    }
            }
            result.addProperty("status", "captured");
        } catch (Throwable failure) {
            result.addProperty("status", "error");
            result.addProperty("failure", failure.toString());
            if (failure.getCause() != null) result.addProperty("cause", failure.getCause().toString());
        }
        return result;
    }
}
