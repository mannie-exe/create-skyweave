package design.inherent.atlas;

import com.google.gson.*;
import dev.ftb.mods.ftblibrary.snbt.SNBT;
import dev.ftb.mods.ftbquests.quest.*;
import dev.ftb.mods.ftbquests.quest.task.ItemTask;
import net.minecraft.nbt.*;
import net.minecraft.server.MinecraftServer;
import java.nio.file.*;
import java.util.*;

/** Native definition evidence only. Gameplay/claims belong to isolated behavior fixtures. */
final class QuestExport {
  static void capture(MinecraftServer server, Path out) throws Exception {
    var file = ServerQuestFile.getInstance().orElseThrow(() -> new IllegalStateException("FTB quest file is not loaded"));
    var objects = file.getAllObjects().stream().sorted(Comparator.comparing((QuestObjectBase object) -> object.getCodeString())).toList();
    var rows = new JsonArray(); var ids = new HashSet<String>();
    var samples = net.minecraft.core.registries.BuiltInRegistries.ITEM.stream().map(net.minecraft.world.item.ItemStack::new).toList();
    for (var object : objects) {
      String id = object.getCodeString();
      if (!ids.add(id) || !object.isValid()) throw new IllegalStateException("Invalid or duplicate FTB object: " + id);
      var tag = new CompoundTag(); object.writeData(tag, server.registryAccess());
      var lines = SNBT.writeLines(tag);
      if (!tag.equals(SNBT.readLines(lines))) throw new IllegalStateException("FTB SNBT round trip failed: " + id);
      var row = new JsonObject();
      row.addProperty("id", id); row.addProperty("type", object.getObjectType().name().toLowerCase(Locale.ROOT));
      row.addProperty("parent", QuestObjectBase.getCodeString(object.getParentID()));
      row.addProperty("class", object.getClass().getName()); row.addProperty("title", object.getTitle().getString());
      row.addProperty("nativeRoundTrip", true);
      row.add("definition", NbtOps.INSTANCE.convertTo(com.mojang.serialization.JsonOps.INSTANCE, tag));
      row.addProperty("snbt", String.join("\n", lines));
      if (object instanceof Quest quest) {
        row.addProperty("progression", quest.getProgressionMode().name().toLowerCase(Locale.ROOT));
        row.add("dependencies", json(quest.streamDependencies().map(value -> value.getCodeString()).sorted().toList()));
        row.add("tasks", json(quest.getTasks().stream().map(value -> value.getCodeString()).toList()));
        row.add("rewards", json(quest.getRewards().stream().map(value -> value.getCodeString()).toList()));
      }
      if (object instanceof dev.ftb.mods.ftbquests.quest.task.Task task)
        row.addProperty("nativeType", task.getType().getTypeId().toString());
      if (object instanceof dev.ftb.mods.ftbquests.quest.reward.Reward reward) {
        row.addProperty("nativeType", reward.getType().getTypeId().toString());
        row.addProperty("teamReward", reward.isTeamReward());
        row.addProperty("collection", reward.getAutoClaimType().name().toLowerCase(Locale.ROOT));
      }
      if (object instanceof ItemTask task) {
        var matching = java.util.stream.Stream.concat(samples.stream(), java.util.stream.Stream.of(task.getItemStack())).filter(task).map(stack -> net.minecraft.core.registries.BuiltInRegistries.ITEM.getKey(stack.getItem()).toString()).distinct().sorted().toList();
        if (matching.isEmpty() || matching.contains("ftbquests:missing_item")) throw new IllegalStateException("Unresolved FTB item task: " + id);
        row.add("matchingItems", json(matching));
        row.addProperty("maximumProgress", task.getMaxProgress());
      }
      rows.add(row);
    }
    var result = new JsonObject(); result.addProperty("schema", 1); result.addProperty("system", "ftbquests");
    result.addProperty("format", BaseQuestFile.VERSION); result.addProperty("progression", file.getProgressionMode().name().toLowerCase(Locale.ROOT));
    result.addProperty("evidence", "Loaded native objects and native SNBT write/read; no gameplay, reward-claim or saved-player evidence implied");
    result.add("objects", rows);
    Files.writeString(out.resolve("quests.json"), new GsonBuilder().disableHtmlEscaping().create().toJson(result));
  }
  private static JsonElement json(Object value) { return new Gson().toJsonTree(value); }
}
