package audit.animation;

import com.google.gson.*;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.core.registries.Registries;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.item.*;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.Difficulty;
import net.minecraft.world.level.*;
import net.minecraft.world.level.levelgen.WorldOptions;
import net.neoforged.api.distmarker.Dist;
import net.neoforged.fml.ModList;
import net.neoforged.fml.common.Mod;
import net.neoforged.neoforge.client.event.ClientTickEvent;
import net.neoforged.neoforge.common.NeoForge;

/** Read-only registry/resource capture in a marked disposable client; no support inference. */
@Mod(value = "animation_audit", dist = Dist.CLIENT)
public final class AnimationAudit {
    private static final Gson JSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Set<String> USE_METHODS = Set.of("use", "useOn", "interactLivingEntity",
        "onUseTick", "releaseUsing", "finishUsingItem", "getUseAnimation", "getUseDuration",
        "canPerformAction", "initializeClient", "onLeftClickEntity", "onEntitySwing");
    private static final List<String> MOVES_ACTION_QUERIES = List.of(
        "attack", "mining", "hand_in", "pose", "use", "use_item", "consume", "bow", "lantern");
    private int ticks;
    private boolean done;
    private boolean opened;
    private int worldTicks;

    public AnimationAudit() {
        if (!Files.isRegularFile(Minecraft.getInstance().gameDirectory.toPath().resolve(".animation-audit")))
            throw new IllegalStateException("Animation audit requires a disposable-client marker");
        if (Files.isRegularFile(Minecraft.getInstance().gameDirectory.toPath().resolve("animation-combat-input.json"))) {
            new CombatInputScene();
            return;
        }
        if (Files.isRegularFile(Minecraft.getInstance().gameDirectory.toPath().resolve("animation-carry.json"))) {
            new CarryScene();
            return;
        }
        if (Files.isRegularFile(Minecraft.getInstance().gameDirectory.toPath().resolve("animation-shaker.json"))) {
            new ShakerScene();
            return;
        }
        if (Files.isRegularFile(Minecraft.getInstance().gameDirectory.toPath().resolve("animation-hose.json"))) {
            new HoseScene();
            return;
        }
        if (Files.isRegularFile(Minecraft.getInstance().gameDirectory.toPath().resolve("animation-exposure-print.json"))) {
            new ExposurePrintScene();
            return;
        }
        if (Files.isRegularFile(Minecraft.getInstance().gameDirectory.toPath().resolve("animation-exposure.json"))) {
            new ExposureScene();
            return;
        }
        if (Files.isRegularFile(Minecraft.getInstance().gameDirectory.toPath().resolve("animation-use.json"))) {
            new ItemUseScene();
            return;
        }
        if (Files.isRegularFile(Minecraft.getInstance().gameDirectory.toPath().resolve("animation-touch.json"))) {
            new TouchGeometryScene();
            return;
        }
        if (Files.isRegularFile(Minecraft.getInstance().gameDirectory.toPath().resolve("animation-pose.json"))) {
            new PoseScene();
            return;
        }
        NeoForge.EVENT_BUS.addListener(this::tick);
    }

    private static JsonArray hierarchy(Class<?> type) {
        JsonArray result = new JsonArray();
        for (; type != null; type = type.getSuperclass()) result.add(type.getName());
        return result;
    }

    private static Object field(Class<?> type, Object target, String name) throws Exception {
        Field field = type.getDeclaredField(name);
        field.setAccessible(true);
        return field.get(target);
    }

    private static String failure(Throwable error) {
        if (error instanceof InvocationTargetException wrapped) error = wrapped.getCause();
        return error.getClass().getName() + ": " + error.getMessage();
    }

    private static void resource(Minecraft mc, JsonArray rows, ResourceLocation id) {
        mc.getResourceManager().getResource(id).ifPresent(value -> {
            JsonObject row = new JsonObject();
            row.addProperty("path", id.toString());
            row.addProperty("sourcePack", value.sourcePackId());
            rows.add(row);
        });
    }

    private void tick(ClientTickEvent.Post event) {
        Minecraft mc = Minecraft.getInstance();
        if (done || mc.getOverlay() != null || ++ticks < 100) return;
        boolean world = Files.isRegularFile(mc.gameDirectory.toPath().resolve(".animation-audit-world"));
        if (world) {
            if (!opened && mc.screen instanceof TitleScreen) {
                opened = true;
                mc.tell(() -> mc.createWorldOpenFlows().createFreshLevel("animation-audit-flat",
                    new LevelSettings("Animation audit", GameType.CREATIVE, false, Difficulty.PEACEFUL,
                        true, new GameRules(), WorldDataConfiguration.DEFAULT),
                    new WorldOptions(1527L, false, false),
                    registries -> registries.registryOrThrow(Registries.WORLD_PRESET)
                        .get(ResourceLocation.withDefaultNamespace("flat")).createWorldDimensions(), mc.screen));
                return;
            }
            if (mc.level == null || mc.player == null || mc.getSingleplayerServer() == null || ++worldTicks < 40) return;
        }
        done = true;
        JsonObject result = new JsonObject();
        result.addProperty("scope", world
            ? "Actual joined-flat-world registry, model, tags, and default-state matching; no action execution, rendered placement, or visually qualified fallback"
            : "Actual title/menu-phase registry, model, and default-state matching; no world, action execution, rendered placement, or visually qualified fallback");
        result.addProperty("screen", mc.screen == null ? null : mc.screen.getClass().getName());
        result.addProperty("joinedWorld", mc.level != null && mc.player != null);
        result.addProperty("serverTicks", mc.getSingleplayerServer() == null ? -1 : mc.getSingleplayerServer().getTickCount());
        try {
            JsonObject mods = new JsonObject();
            ModList.get().getMods().forEach(mod -> mods.addProperty(mod.getModId(), mod.getVersion().toString()));
            result.add("mods", mods);
            result.add("selectedResourcePacks", JSON.toJsonTree(mc.options.resourcePacks));
            result.add("activeResourcePacks", JSON.toJsonTree(mc.getResourceManager().listPacks().map(pack -> pack.packId()).toList()));
            JsonObject origins = new JsonObject();
            for (String name : List.of("net.minecraft.client.Minecraft", "punchy.config.PunchyTuningConfig",
                    "punchymoves.client.PlayerAnimationEngine", "strm.touchnmotion.blockuse.BlockUse")) {
                Class<?> type = Class.forName(name);
                origins.addProperty(name, String.valueOf(type.getProtectionDomain().getCodeSource().getLocation()));
            }
            result.add("classOrigins", origins);

            Class<?> groups = Class.forName("punchymoves.client.animation.ItemAnimationBindings");
            Method groupFor = groups.getDeclaredMethod("groupFor", ItemStack.class);
            groupFor.setAccessible(true);
            Class<?> engine = Class.forName("punchymoves.client.PlayerAnimationEngine");
            Object library = field(engine, null, "animations");
            result.addProperty("movesLibraryPresent", library != null);
            result.addProperty("movesBetterCombatOverride", (Boolean) engine.getMethod("isBetterCombatOverrideEnabled").invoke(null));
            Method clipFor = library == null ? null : library.getClass().getMethod("clipFor", ItemStack.class, String.class);
            Method hasBinding = library == null ? null : library.getClass().getMethod("hasItemBinding", ItemStack.class, String.class);
            Class<?> libraryClass = Class.forName("punchymoves.client.animation.AnimationLibrary");
            Class<?> sequenceController = Class.forName("punchymoves.client.animation.ItemSequenceController");
            Method sequenceBehavior = sequenceController.getDeclaredMethod("behavior", libraryClass, ItemStack.class);
            sequenceBehavior.setAccessible(true);
            Class<?> useController = Class.forName("punchymoves.client.animation.ItemUseController");
            Method handlesUse = useController.getDeclaredMethod("handles", libraryClass, ItemStack.class, boolean.class);
            handlesUse.setAccessible(true);
            result.add("movesActionQueryNames", JSON.toJsonTree(MOVES_ACTION_QUERIES));
            result.addProperty("movesUseDispatchScope", "Original default-stack controller eligibility for both handed flags; not action execution, played clips, or visually correct fallback");
            Class<?> kinds = Class.forName("punchy.client.render.ToolKindResolver");
            Class<?> itemKind = Class.forName("punchy.client.renderer.layer.VanillaFirstPersonItemLayer$ToolKind");
            Class<?> armKind = Class.forName("punchy.client.renderer.layer.PlayerArmModelLayer$ToolKind");
            Method resolveItem = kinds.getMethod("resolveItemKind", ItemStack.class, itemKind);
            Method resolveArm = kinds.getMethod("resolveArmKind", ItemStack.class, armKind);
            Object itemFallback = itemKind.getField("INGREDIENT").get(null);
            Object armFallback = armKind.getField("AXE").get(null);

            JsonArray items = new JsonArray();
            ItemClientCapabilities clientCapabilities = new ItemClientCapabilities(mc.level);
            for (Item item : BuiltInRegistries.ITEM) {
                ResourceLocation id = BuiltInRegistries.ITEM.getKey(item);
                JsonObject row = new JsonObject();
                row.addProperty("id", id.toString());
                row.add("hierarchy", hierarchy(item.getClass()));
                row.add("clientCapabilities", clientCapabilities.item(item, id.toString()));
                try {
                    ItemStack stack = new ItemStack(item);
                    row.addProperty("useAnimation", stack.getUseAnimation().name());
                    row.addProperty("movesGroup", String.valueOf(groupFor.invoke(null, stack)));
                    JsonArray methods = new JsonArray();
                    JsonArray declarations = new JsonArray();
                    Arrays.stream(item.getClass().getMethods()).filter(method -> USE_METHODS.contains(method.getName()) && !method.isBridge())
                        .sorted(Comparator.comparing(Method::toGenericString)).forEach(method -> {
                            methods.add(method.toGenericString());
                            JsonObject declaration = new JsonObject();
                            declaration.addProperty("method", method.getName());
                            declaration.addProperty("owner", method.getDeclaringClass().getName());
                            declaration.addProperty("signature", method.toGenericString());
                            declarations.add(declaration);
                        });
                    row.add("useMethods", methods);
                    row.add("methodDeclarations", declarations);
                    JsonObject firstPerson = new JsonObject();
                    firstPerson.addProperty("scope", "Default-stack matcher queries with explicit supplied fallbacks; not actual held draw, action, or visual fallback qualification");
                    firstPerson.addProperty("itemFallback", "INGREDIENT");
                    firstPerson.addProperty("itemResolved", String.valueOf(resolveItem.invoke(null, stack, itemFallback)));
                    firstPerson.addProperty("armFallback", "AXE");
                    firstPerson.addProperty("armResolved", String.valueOf(resolveArm.invoke(null, stack, armFallback)));
                    row.add("firstPersonKindQueries", firstPerson);
                    row.add("tags", JSON.toJsonTree(stack.getTags().map(tag -> tag.location().toString()).sorted().toList()));
                    var model = mc.getItemRenderer().getModel(stack, null, null, 0);
                    row.addProperty("bakedModelClass", model.getClass().getName());
                    row.addProperty("customRenderer", model.isCustomRenderer());
                    JsonObject transforms = new JsonObject();
                    for (ItemDisplayContext context : ItemDisplayContext.values()) {
                        var transform = model.getTransforms().getTransform(context);
                        JsonObject value = new JsonObject();
                        value.addProperty("rotation", transform.rotation.toString());
                        value.addProperty("translation", transform.translation.toString());
                        value.addProperty("scale", transform.scale.toString());
                        transforms.add(context.getSerializedName(), value);
                    }
                    row.add("bakedDisplayTransforms", transforms);
                    JsonArray resources = new JsonArray();
                    resource(mc, resources, ResourceLocation.fromNamespaceAndPath(id.getNamespace(), "models/item/" + id.getPath() + ".json"));
                    resource(mc, resources, ResourceLocation.fromNamespaceAndPath(id.getNamespace(), "items/" + id.getPath() + ".json"));
                    row.add("namedItemResources", resources);
                    if (library != null) {
                        JsonObject actions = new JsonObject();
                        for (String action : MOVES_ACTION_QUERIES) {
                            Object clip = clipFor.invoke(library, stack, action);
                            JsonObject value = new JsonObject();
                            value.addProperty("itemBinding", (Boolean) hasBinding.invoke(library, stack, action));
                            if (clip != null) value.addProperty("clip", String.valueOf(clip.getClass().getMethod("name").invoke(clip)));
                            actions.add(action, value);
                        }
                        row.add("movesActionQueries", actions);
                        JsonObject useDispatch = new JsonObject();
                        useDispatch.addProperty("sequenceBehavior", String.valueOf(sequenceBehavior.invoke(null, library, stack)));
                        useDispatch.addProperty("handedFalse", (Boolean) handlesUse.invoke(null, library, stack, false));
                        useDispatch.addProperty("handedTrue", (Boolean) handlesUse.invoke(null, library, stack, true));
                        row.add("movesUseDispatch", useDispatch);
                    }
                } catch (Throwable error) {
                    row.addProperty("inspectionError", failure(error));
                }
                items.add(row);
            }
            result.add("items", items);
            result.add("clientCapabilities", clientCapabilities.summary());

            Class<?> blockUse = Class.forName("strm.touchnmotion.blockuse.BlockUse");
            List<?> targets = (List<?>) field(blockUse, null, "TARGETS");
            JsonArray blocks = new JsonArray();
            for (var block : BuiltInRegistries.BLOCK) {
                JsonObject row = new JsonObject();
                row.addProperty("id", BuiltInRegistries.BLOCK.getKey(block).toString());
                row.add("hierarchy", hierarchy(block.getClass()));
                row.addProperty("stateCount", block.getStateDefinition().getPossibleStates().size());
                JsonArray matches = new JsonArray();
                for (Object target : targets) {
                    try {
                        Method method = target.getClass().getMethod("matches", BlockState.class);
                        method.setAccessible(true);
                        if (Boolean.TRUE.equals(method.invoke(target, block.defaultBlockState()))) matches.add(target.getClass().getName());
                    } catch (Throwable error) {
                        row.addProperty("inspectionError", failure(error));
                    }
                }
                row.add("touchBlockUseDefaultStateMatches", matches);
                blocks.add(row);
            }
            result.add("blocks", blocks);
            JsonArray entities = new JsonArray();
            Map<?, ?> renderers = (Map<?, ?>) field(mc.getEntityRenderDispatcher().getClass(), mc.getEntityRenderDispatcher(), "renderers");
            for (var type : BuiltInRegistries.ENTITY_TYPE) {
                JsonObject row = new JsonObject();
                row.addProperty("id", BuiltInRegistries.ENTITY_TYPE.getKey(type).toString());
                Object renderer = renderers.get(type);
                if (renderer != null) row.add("rendererHierarchy", hierarchy(renderer.getClass()));
                entities.add(row);
            }
            result.add("entities", entities);
            result.addProperty("complete", true);
        } catch (Throwable error) {
            result.addProperty("complete", false);
            result.addProperty("failure", failure(error));
            result.add("failureStack", JSON.toJsonTree(Arrays.stream(error.getStackTrace()).map(Object::toString).toList()));
        }
        try {
            Files.writeString(mc.gameDirectory.toPath().resolve("animation-native.json"), JSON.toJson(result));
        } catch (Exception error) {
            throw new RuntimeException(error);
        }
        mc.tell(mc::stop);
    }
}
