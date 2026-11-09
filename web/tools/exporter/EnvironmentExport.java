package design.inherent.atlas;

import com.google.gson.*;
import com.mojang.serialization.JsonOps;
import net.minecraft.core.registries.Registries;
import net.minecraft.nbt.*;
import net.minecraft.resources.*;
import net.minecraft.server.MinecraftServer;
import net.minecraft.world.level.biome.BiomeSource;
import net.minecraft.world.level.levelgen.feature.ConfiguredFeature;
import net.minecraft.world.level.levelgen.placement.PlacedFeature;
import net.minecraft.world.level.levelgen.structure.Structure;
import java.nio.file.*;
import java.util.*;

/** Chunk-free declarations. No seed search, placement fitting, player data or terrain generation. */
final class EnvironmentExport {
  private static final Gson GSON = new GsonBuilder().disableHtmlEscaping().create();
  static void capture(MinecraftServer server, Path out) throws Exception {
    var ops = RegistryOps.create(JsonOps.INSTANCE, server.registryAccess());
    var result = new JsonObject(); result.addProperty("schema", 1);
    result.addProperty("evidence", "Effective preset/registry/template declarations; placement, yields and access are not guaranteed");
    String properties = System.getProperty("atlas.environment.properties");
    if (properties != null) {
      byte[] bytes = Files.readAllBytes(Path.of(properties));
      var values = new Properties();
      values.load(new java.io.StringReader(new String(bytes, java.nio.charset.StandardCharsets.UTF_8)));
      var defaults = new JsonObject(); defaults.addProperty("source", "templates/server/game/server.properties.template");
      defaults.addProperty("sha256", java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(bytes)));
      defaults.addProperty("levelType", values.getProperty("level-type"));
      String nether = values.getProperty("allow-nether");
      if (nether != null && !nether.equals("true") && !nether.equals("false")) throw new IllegalArgumentException("Invalid template allow-nether");
      if (nether != null) defaults.addProperty("allowNether", Boolean.parseBoolean(nether));
      result.add("serverDefaults", defaults);
    }
    var errors = new JsonArray();
    var features = new JsonObject();
    if (net.neoforged.fml.ModList.get().isLoaded("skyweave_compat")) {
      var type = Class.forName("design.inherent.skyweavecompat.Feature");
      var enabled = Class.forName("design.inherent.skyweavecompat.OptionalIntegrations").getMethod("enabled", type);
      for (var feature : type.getEnumConstants())
        features.addProperty((String)type.getField("key").get(feature), (Boolean)enabled.invoke(null, feature));
      var configuration = Class.forName("design.inherent.skyweavecompat.terrain.structure.StructureConfiguration");
      result.add("structurePolicy", GSON.toJsonTree(configuration.getMethod("policy").invoke(null)));
    }
    result.add("features", features);
    var presets = new JsonObject();
    for (var entry : server.getResourceManager().listResources("worldgen/world_preset", id -> id.getPath().endsWith(".json")).entrySet()) {
      try (var reader = entry.getValue().openAsReader()) {
        var source = JsonParser.parseReader(reader).getAsJsonObject(); var dimensions = new JsonObject();
        for (var dimension : source.getAsJsonObject("dimensions").entrySet()) {
          var definition = dimension.getValue().getAsJsonObject(); var generator = definition.getAsJsonObject("generator");
          var row = new JsonObject(); row.add("generator", generator.deepCopy()); row.add("type", definition.get("type"));
          if (generator.has("biome_source")) {
            var biomes = BiomeSource.CODEC.parse(ops, generator.get("biome_source")).getOrThrow().possibleBiomes();
            row.add("biomes", GSON.toJsonTree(biomes.stream().map(holder -> holder.unwrapKey().orElseThrow().location().toString()).sorted().toList()));
          } else row.addProperty("unknown", "This generator has no admitted biome-source adapter");
          dimensions.add(dimension.getKey(), row);
        }
        var row = new JsonObject(); row.add("dimensions", dimensions); row.addProperty("pack", entry.getValue().sourcePackId());
        presets.add(resourceId(entry.getKey(), "worldgen/world_preset/", ".json"), row);
      } catch (Exception exception) { errors.add(entry.getKey() + ": " + exception); }
    }
    result.add("presets", presets);
    var placed = new JsonObject();
    for (var holder : server.registryAccess().registryOrThrow(Registries.PLACED_FEATURE).holders().toList())
      placed.add(holder.key().location().toString(), PlacedFeature.DIRECT_CODEC.encodeStart(ops, holder.value()).getOrThrow());
    var configured = new JsonObject();
    for (var holder : server.registryAccess().registryOrThrow(Registries.CONFIGURED_FEATURE).holders().toList())
      configured.add(holder.key().location().toString(), ConfiguredFeature.DIRECT_CODEC.encodeStart(ops, holder.value()).getOrThrow());
    result.add("placedFeatures", placed); result.add("configuredFeatures", configured);
    var biomes = new JsonObject();
    for (var holder : server.registryAccess().registryOrThrow(Registries.BIOME).holders().toList()) {
      var row = new JsonObject(); var values = new JsonArray();
      for (var stage : holder.value().getGenerationSettings().features()) for (var feature : stage) {
        String id = feature.unwrapKey().map(key -> key.location().toString()).orElse(null);
        if (id == null) {
          var encoded = PlacedFeature.DIRECT_CODEC.encodeStart(ops, feature.value()).getOrThrow();
          id = "atlas:inline/" + java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(encoded.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8)));
          placed.add(id, encoded);
        }
        values.add(id);
      }
      row.add("features", values);
      var spawns = new JsonArray();
      for (var category : net.minecraft.world.entity.MobCategory.values())
        for (var spawn : holder.value().getMobSettings().getMobs(category).unwrap())
          if (spawn.getWeight().asInt() > 0) spawns.add(net.minecraft.core.registries.BuiltInRegistries.ENTITY_TYPE.getKey(spawn.type).toString());
      row.add("spawns", spawns); biomes.add(holder.key().location().toString(), row);
    }
    result.add("biomes", biomes);
    var memberships = new TreeMap<String, List<String>>();
    for (var set : server.registryAccess().registryOrThrow(Registries.STRUCTURE_SET).holders().toList())
      for (var entry : set.value().structures()) if (entry.weight() > 0)
        memberships.computeIfAbsent(entry.structure().getRegisteredName(), ignored -> new ArrayList<>()).add(set.key().location().toString());
    var structures = new JsonObject();
    Class<?> membership = net.neoforged.fml.ModList.get().isLoaded("skyweave_compat")
        ? Class.forName("design.inherent.skyweavecompat.terrain.structure.StructureMembership") : null;
    Map<?, ?> replacements = membership == null ? Map.of() : (Map<?, ?>)Class.forName("design.inherent.skyweavecompat.terrain.structure.YungReplacements").getMethod("capture").invoke(null);
    for (var holder : server.registryAccess().registryOrThrow(Registries.STRUCTURE).holders().toList()) {
      var row = new JsonObject(); row.add("definition", Structure.DIRECT_CODEC.encodeStart(ops, holder.value()).getOrThrow());
      row.add("biomes", GSON.toJsonTree(holder.value().biomes().stream().map(value -> value.unwrapKey().orElseThrow().location().toString()).sorted().toList()));
      row.add("sets", GSON.toJsonTree(memberships.getOrDefault(holder.key().location().toString(), List.of())));
      if (membership != null) {
        var family = membership.getMethod("family", net.minecraft.core.Holder.class).invoke(null, holder);
        if (family != null) row.addProperty("family", (String)family.getClass().getField("key").get(family));
      }
      String type = net.minecraft.core.registries.BuiltInRegistries.STRUCTURE_TYPE.getKey(holder.value().type()).toString();
      row.addProperty("suppressedByYung", Boolean.TRUE.equals(replacements.get(type)));
      structures.add(holder.key().location().toString(), row);
    }
    result.add("structures", structures);
    var poolDefinitions = new JsonObject();
    for (var holder : server.registryAccess().registryOrThrow(Registries.TEMPLATE_POOL).holders().toList())
      poolDefinitions.add(holder.key().location().toString(), net.minecraft.world.level.levelgen.structure.pools.StructureTemplatePool.DIRECT_CODEC.encodeStart(ops, holder.value()).getOrThrow());
    result.add("pools", poolDefinitions);
    var templates = new JsonObject();
    for (var entry : server.getResourceManager().listResources("structure", id -> id.getPath().endsWith(".nbt")).entrySet()) {
      try (var input = entry.getValue().open()) {
        var tag = NbtIo.readCompressed(input, NbtAccounter.create(64L * 1024 * 1024));
        var blocks = new TreeSet<String>(); var loot = new TreeSet<String>(); var pools = new TreeSet<String>();
        var entities = new TreeSet<String>(); var spawners = new TreeSet<String>();
        var used = new TreeSet<Integer>();
        for (var value : tag.getList("blocks", Tag.TAG_COMPOUND)) {
          if (!((CompoundTag)value).contains("state", Tag.TAG_INT)) throw new IllegalArgumentException("Missing template palette index");
          used.add(((CompoundTag)value).getInt("state"));
        }
        if (tag.contains("palette", Tag.TAG_LIST)) palette(tag.getList("palette", Tag.TAG_COMPOUND), used, blocks);
        for (var palette : tag.getList("palettes", Tag.TAG_LIST)) palette((ListTag)palette, used, blocks);
        for (var value : tag.getList("blocks", Tag.TAG_COMPOUND)) {
          var nbt = ((CompoundTag)value).getCompound("nbt");
          add(nbt.getString("LootTable"), loot); add(nbt.getString("pool"), pools);
          add(nbt.getCompound("SpawnData").getCompound("entity").getString("id"), spawners);
          for (var potential : nbt.getList("SpawnPotentials", Tag.TAG_COMPOUND))
            add(((CompoundTag)potential).getCompound("data").getCompound("entity").getString("id"), spawners);
        }
        for (var value : tag.getList("entities", Tag.TAG_COMPOUND)) add(((CompoundTag)value).getCompound("nbt").getString("id"), entities);
        var row = new JsonObject(); row.addProperty("pack", entry.getValue().sourcePackId());
        row.add("blocks", GSON.toJsonTree(blocks)); row.add("loot", GSON.toJsonTree(loot)); row.add("pools", GSON.toJsonTree(pools));
        row.add("entities", GSON.toJsonTree(entities)); row.add("spawners", GSON.toJsonTree(spawners));
        templates.add(resourceId(entry.getKey(), "structure/", ".nbt"), row);
      } catch (Exception exception) { errors.add(entry.getKey() + ": " + exception); }
    }
    result.add("templates", templates); result.add("errors", errors);
    Files.writeString(out.resolve("environment.json"), GSON.toJson(result));
  }
  private static void palette(ListTag palette, Set<Integer> used, Set<String> blocks) {
    for (int index : used) {
      if (index < 0 || index >= palette.size()) throw new IllegalArgumentException("Template palette index is out of range");
      add(palette.getCompound(index).getString("Name"), blocks);
    }
  }
  private static void add(String id, Set<String> values) { if (!id.isEmpty() && ResourceLocation.tryParse(id) != null) values.add(ResourceLocation.parse(id).toString()); }
  private static String resourceId(ResourceLocation location, String prefix, String suffix) {
    String path = location.getPath();
    if (!path.startsWith(prefix) || !path.endsWith(suffix)) throw new IllegalArgumentException("Unexpected resource: " + location);
    return location.getNamespace() + ":" + path.substring(prefix.length(), path.length() - suffix.length());
  }
}
