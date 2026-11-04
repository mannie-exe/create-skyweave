package design.inherent.atlas;

import com.google.gson.*;
import net.neoforged.fml.common.Mod;
import net.neoforged.neoforge.common.NeoForge;
import net.neoforged.neoforge.event.server.ServerStartedEvent;
import net.minecraft.core.*;
import net.minecraft.core.registries.*;
import net.minecraft.resources.*;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.level.ChunkPos;
import net.minecraft.world.level.block.*;
import net.minecraft.world.level.block.entity.RandomizableContainerBlockEntity;
import net.minecraft.world.level.chunk.status.ChunkStatus;
import net.minecraft.world.level.levelgen.structure.*;
import net.minecraft.world.level.levelgen.structure.placement.RandomSpreadStructurePlacement;
import java.nio.file.*;
import java.util.*;

/** Pack-specific instrumentation. Installed only in disposable survey servers. */
@Mod("create_skyweave_structure_survey")
public final class StructureSurvey {
  private static final Gson JSON = new GsonBuilder().disableHtmlEscaping().create();
  private static final ResourceLocation ID = ResourceLocation.parse("skyvillages:skyvillage");
  public StructureSurvey() { NeoForge.EVENT_BUS.addListener(this::run); }

  private void run(ServerStartedEvent event) {
    var server = event.getServer();
    try {
      var level = server.overworld();
      var structure = server.registryAccess().registryOrThrow(Registries.STRUCTURE).get(ID);
      if (structure == null) throw new IllegalStateException("Sky Villages is not loaded");
      String mode = System.getProperty("survey.mode");
      JsonObject report = new JsonObject();
      report.addProperty("mode", mode); report.addProperty("seed", level.getSeed());
      report.addProperty("generator", level.getChunkSource().getGenerator().getClass().getName());
      JsonArray rows = new JsonArray();
      if (mode.equals("controlled")) {
        int samples = Integer.getInteger("survey.samples", 6);
        for (int i = 0; i < samples; i++) {
          var chunk = new ChunkPos(i * 24, 24);
          var gen = level.getChunkSource().getGenerator();
          var start = structure.generate(server.registryAccess(), gen, gen.getBiomeSource(), level.getChunkSource().randomState(), server.getStructureManager(), level.getSeed(), chunk, 0, level, biome -> true);
          if (!start.isValid()) throw new IllegalStateException("Invalid controlled layout");
          var box = start.getBoundingBox(); load(level, box);
          // Native placement into an empty sky above a flat world: no terrain ore is counted.
          for (int x = box.minX() >> 4; x <= box.maxX() >> 4; x++)
            for (int z = box.minZ() >> 4; z <= box.maxZ() >> 4; z++)
              start.placeInChunk(level, level.structureManager(), gen, level.random, new BoundingBox(x*16, level.getMinBuildHeight(), z*16, x*16+15, level.getMaxBuildHeight()-1, z*16+15), new ChunkPos(x,z));
          var row = inspect(level, start, true); rows.add(row);
          System.out.println("SURVEY_VILLAGE " + JSON.toJson(row));
        }
      } else if (mode.equals("natural")) {
        var placement = (RandomSpreadStructurePlacement)server.registryAccess().registryOrThrow(Registries.STRUCTURE_SET).get(ID).placement();
        int radius = Integer.getInteger("survey.radius", 2), full = Integer.getInteger("survey.naturalSamples", 2), completed = 0;
        List<ChunkPos> cells = new ArrayList<>();
        for (int x=-radius;x<=radius;x++) for(int z=-radius;z<=radius;z++) cells.add(new ChunkPos(x,z));
        cells.sort(Comparator.comparingInt(p -> p.x*p.x+p.z*p.z));
        for (var cell : cells) {
          var candidate = placement.getPotentialStructureChunk(level.getSeed(),cell.x*placement.spacing(),cell.z*placement.spacing());
          var chunk = level.getChunk(candidate.x,candidate.z,ChunkStatus.STRUCTURE_STARTS);
          var start = chunk.getStartForStructure(structure);
          JsonObject row = new JsonObject(); row.addProperty("chunkX",candidate.x); row.addProperty("chunkZ",candidate.z);
          row.addProperty("validStart",start!=null && start.isValid());
          if (start!=null && start.isValid()) {
            row.add("bounds",bounds(start.getBoundingBox())); row.addProperty("pieces",start.getPieces().size());
            if (completed < full) { load(level,start.getBoundingBox()); row.add("placed",inspect(level,start,false)); completed++; }
          }
          rows.add(row);
        }
        report.addProperty("spacingChunks",placement.spacing()); report.addProperty("separationChunks",placement.separation());
      } else throw new IllegalArgumentException("Unknown survey mode");
      report.add("samples", rows);
      Files.writeString(Path.of(System.getProperty("survey.output")),JSON.toJson(report));
      System.out.println("STRUCTURE_SURVEY_COMPLETE " + mode + " samples=" + rows.size());
    } catch (Throwable e) { e.printStackTrace(); }
    finally { server.halt(false); }
  }

  private static void load(ServerLevel level, BoundingBox box) {
    if (box.minY()<level.getMinBuildHeight() || box.maxY()>=level.getMaxBuildHeight()) throw new IllegalStateException("Structure exceeds world height: " + box);
    for(int x=box.minX()>>4;x<=box.maxX()>>4;x++) for(int z=box.minZ()>>4;z<=box.maxZ()>>4;z++) level.getChunk(x,z);
  }

  private static JsonArray bounds(BoundingBox box) {
    JsonArray a = new JsonArray(); for(int n:new int[]{box.minX(),box.minY(),box.minZ(),box.maxX(),box.maxY(),box.maxZ()})a.add(n);return a;
  }

  private static JsonObject inspect(ServerLevel level, StructureStart start, boolean controlled) {
    var box=start.getBoundingBox(); Map<String,Integer> blocks=new TreeMap<>(),chests=new TreeMap<>(),lootItems=new TreeMap<>();
    var pos=new BlockPos.MutableBlockPos();
    for(int x=box.minX();x<=box.maxX();x++)for(int z=box.minZ();z<=box.maxZ();z++)for(int y=box.minY();y<=box.maxY();y++){
      pos.set(x,y,z);var state=level.getBlockState(pos);if(state.isAir())continue;
      blocks.merge(BuiltInRegistries.BLOCK.getKey(state.getBlock()).toString(),1,Integer::sum);
      if(controlled && state.hasBlockEntity() && level.getBlockEntity(pos) instanceof RandomizableContainerBlockEntity chest && chest.getLootTable()!=null){
        chests.merge(chest.getLootTable().location().toString(),1,Integer::sum);
        chest.unpackLootTable(null);
        for(int i=0;i<chest.getContainerSize();i++){var item=chest.getItem(i);if(!item.isEmpty())lootItems.merge(BuiltInRegistries.ITEM.getKey(item.getItem()).toString(),item.getCount(),Integer::sum);}
      }
    }
    JsonObject result=new JsonObject();result.add("bounds",bounds(box));result.addProperty("pieces",start.getPieces().size());result.addProperty("controlled",controlled);
    result.add("blocks",JSON.toJsonTree(blocks));result.add("chests",JSON.toJsonTree(chests));result.add("lootItems",JSON.toJsonTree(lootItems));return result;
  }
}
