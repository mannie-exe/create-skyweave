package design.inherent.atlas;

import com.google.gson.*;
import java.util.Comparator;
import net.minecraft.SharedConstants;
import net.minecraft.core.registries.*;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.packs.PackType;
import net.minecraft.world.level.block.state.properties.Property;

/** Exact placement metadata; independent from authored specimen choices and layout. */
final class DebugRegistry {
  private DebugRegistry() {}

  static JsonObject capture(MinecraftServer server) {
    JsonObject result = new JsonObject();
    result.addProperty("schema", 1);
    result.addProperty("minecraft", SharedConstants.getCurrentVersion().getName());
    result.addProperty("loader", "neoforge");
    result.addProperty("loaderVersion", net.neoforged.fml.ModList.get().getModContainerById("neoforge")
        .orElseThrow().getModInfo().getVersion().toString());
    result.addProperty("dataPackFormat", SharedConstants.getCurrentVersion().getPackVersion(PackType.SERVER_DATA));
    JsonObject bounds = new JsonObject();
    bounds.addProperty("minY", server.overworld().getMinBuildHeight());
    bounds.addProperty("maxYExclusive", server.overworld().getMaxBuildHeight());
    result.add("buildBounds", bounds);
    JsonArray blocks = new JsonArray();
    for (var block : BuiltInRegistries.BLOCK.stream()
        .sorted(Comparator.comparing(b -> BuiltInRegistries.BLOCK.getKey(b).toString())).toList()) {
      JsonObject row = new JsonObject();
      row.addProperty("id", BuiltInRegistries.BLOCK.getKey(block).toString());
      row.addProperty("translation", block.getDescriptionId());
      row.addProperty("item", BuiltInRegistries.ITEM.getKey(block.asItem()).toString());
      row.addProperty("class", block.getClass().getName());
      JsonArray hierarchy = new JsonArray();
      for (Class<?> type = block.getClass(); type != null; type = type.getSuperclass()) hierarchy.add(type.getName());
      row.add("hierarchy", hierarchy);
      row.addProperty("canOcclude", block.defaultBlockState().canOcclude());
      row.addProperty("blockEntity", block.defaultBlockState().hasBlockEntity());
      row.addProperty("renderShape", block.defaultBlockState().getRenderShape().name());
      JsonArray tags = new JsonArray();
      block.builtInRegistryHolder().tags().map(t -> t.location().toString()).sorted().forEach(tags::add);
      row.add("tags", tags);
      JsonObject properties = new JsonObject(), defaults = new JsonObject();
      for (Property<?> property : block.getStateDefinition().getProperties()) {
        JsonArray values = new JsonArray();
        property.getPossibleValues().stream().map(value -> name(property, value)).sorted().forEach(values::add);
        properties.add(property.getName(), values);
        defaults.addProperty(property.getName(), name(property, block.defaultBlockState().getValue(property)));
      }
      row.add("properties", properties);
      row.add("defaultState", defaults);
      blocks.add(row);
    }
    result.add("blocks", blocks);
    JsonArray items = new JsonArray(), entities = new JsonArray(), biomes = new JsonArray();
    BuiltInRegistries.ITEM.keySet().stream().sorted().forEach(id -> items.add(id.toString()));
    BuiltInRegistries.ENTITY_TYPE.keySet().stream().sorted().forEach(id -> {
      var type = BuiltInRegistries.ENTITY_TYPE.get(id);
      JsonObject row = new JsonObject(); row.addProperty("id", id.toString());
      row.addProperty("width", type.getWidth()); row.addProperty("height", type.getHeight());
      row.addProperty("category", type.getCategory().getName()); entities.add(row);
    });
    server.registryAccess().registryOrThrow(Registries.BIOME).keySet().stream().sorted().forEach(id -> biomes.add(id.toString()));
    result.add("items", items); result.add("entities", entities); result.add("biomes", biomes);
    return result;
  }

  @SuppressWarnings({"rawtypes", "unchecked"})
  private static String name(Property property, Comparable value) { return property.getName(value); }
}
