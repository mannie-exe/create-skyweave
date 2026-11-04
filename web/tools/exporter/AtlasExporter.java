package design.inherent.atlas;

import com.google.gson.*;
import com.mojang.serialization.*;
import net.minecraft.core.registries.*;
import net.minecraft.resources.RegistryOps;
import net.minecraft.server.MinecraftServer;
import net.minecraft.world.item.*;
import net.minecraft.world.item.crafting.*;
import net.minecraft.world.level.storage.loot.LootTable;
import net.minecraft.advancements.Advancement;
import net.neoforged.fml.common.Mod;
import net.neoforged.neoforge.common.NeoForge;
import net.neoforged.neoforge.event.server.ServerStartedEvent;
import net.neoforged.neoforge.event.tick.ServerTickEvent;
import java.nio.file.*;
import java.util.*;

/** Developer instrumentation, installed only in the disposable audit server. */
@Mod("create_sky_atlas_exporter")
public final class AtlasExporter {
  private static final Gson GSON = new GsonBuilder().disableHtmlEscaping().create();
  private boolean pending;
  private int stopTicks;
  public AtlasExporter() {
    NeoForge.EVENT_BUS.addListener((ServerStartedEvent event) ->
        pending = System.getProperty("atlas.export.dir") != null);
    NeoForge.EVENT_BUS.addListener(this::tick);
  }
  private void tick(ServerTickEvent.Post event) {
    if (stopTicks > 0 && --stopTicks == 0) event.getServer().halt(false);
    if (!pending) return;
    pending = false;
    // Complete startup listeners before exporting; allow fixture cleanup before stopping.
    export(event.getServer());
    stopTicks = 5;
  }
  private void export(MinecraftServer server) {
    String destination = System.getProperty("atlas.export.dir");
    if (destination == null) return;
    try {
      Path out = Path.of(destination); Files.createDirectories(out);
      var ops = RegistryOps.create(JsonOps.INSTANCE, server.registryAccess());
      Files.writeString(out.resolve("debug_registry.json"), GSON.toJson(DebugRegistry.capture(server)));
      JsonArray items = new JsonArray(), blocks = new JsonArray(), recipes = new JsonArray(), entities = new JsonArray();
      JsonArray errors = new JsonArray();
      JsonArray interactions = new JsonArray(), hooks = new JsonArray(), fluids = new JsonArray();
      Set<String> seenClasses = new HashSet<>();
      for (var item : BuiltInRegistries.ITEM) {
        JsonObject row = new JsonObject();
        row.addProperty("id", BuiltInRegistries.ITEM.getKey(item).toString());
        row.addProperty("translation", item.getDescriptionId());
        row.addProperty("class", item.getClass().getName());
        if (seenClasses.add(item.getClass().getName())) {
          JsonObject hook = new JsonObject(); hook.addProperty("id",item.getClass().getName());
          JsonArray methods = new JsonArray();
          for (Class<?> type=item.getClass(); type!=null && type!=Item.class; type=type.getSuperclass()) {
            for (var method:declaredHooks(type)) methods.add(type.getName()+"#"+method);
          }
          hook.add("methods",methods); hook.addProperty("evidence","registered item class bytecode; method presence is not a behavioral proof"); hooks.add(hook);
        }
        row.addProperty("stackSize", item.getDefaultMaxStackSize());
        row.add("tags", GSON.toJsonTree(item.builtInRegistryHolder().tags().map(t -> t.location().toString()).sorted().toList()));
        try {
          row.add("stack", ItemStack.CODEC.encodeStart(ops, new ItemStack(item)).getOrThrow());
          row.add("components",net.minecraft.core.component.DataComponentMap.CODEC.encodeStart(ops,item.components()).getOrThrow());
        }
        catch (Exception e) { row.addProperty("stackError", e.toString()); }
        items.add(row);
      }
      for (var block : BuiltInRegistries.BLOCK) {
        JsonObject row = new JsonObject();
        row.addProperty("id", BuiltInRegistries.BLOCK.getKey(block).toString());
        row.addProperty("item", BuiltInRegistries.ITEM.getKey(block.asItem()).toString());
        row.addProperty("class", block.getClass().getName());
        row.addProperty("requiresCorrectTool", block.defaultBlockState().requiresCorrectToolForDrops());
        row.addProperty("destroyTime", block.defaultDestroyTime());
        row.add("tags", GSON.toJsonTree(block.builtInRegistryHolder().tags().map(t -> t.location().toString()).sorted().toList()));
        blocks.add(row);
        var stripped=AxeItem.getAxeStrippingState(block.defaultBlockState());
        if (stripped!=null) transformation(interactions,"strip",block,stripped.getBlock(),"minecraft:wooden_axe");
        var waxed=HoneycombItem.getWaxed(block.defaultBlockState());
        if (waxed.isPresent()) transformation(interactions,"wax",block,waxed.get().getBlock(),"minecraft:honeycomb");
        var oxidized=net.minecraft.world.level.block.WeatheringCopper.getNext(block);
        if(oxidized.isPresent()) transformation(interactions,"oxidize",block,oxidized.get(),"atlas:overworld");
        var scraped=net.minecraft.world.level.block.WeatheringCopper.getPrevious(block);
        if(scraped.isPresent()) transformation(interactions,"scrape",block,scraped.get(),"minecraft:wooden_axe");
        var unwaxed=HoneycombItem.WAX_OFF_BY_BLOCK.get().get(block);
        if(unwaxed!=null) transformation(interactions,"unwax",block,unwaxed,"minecraft:wooden_axe");
      }
      for (var fluid:BuiltInRegistries.FLUID) {
        JsonObject row=new JsonObject(); row.addProperty("id",BuiltInRegistries.FLUID.getKey(fluid).toString());
        row.addProperty("bucket",BuiltInRegistries.ITEM.getKey(fluid.getBucket()).toString());
        row.add("tags",GSON.toJsonTree(fluid.builtInRegistryHolder().tags().map(t->t.location().toString()).toList()));
        row.addProperty("class",fluid.getClass().getName()); fluids.add(row);
      }
      for(var entry:net.minecraft.world.level.block.ComposterBlock.COMPOSTABLES.object2FloatEntrySet()) {
        JsonObject row=new JsonObject();String id=BuiltInRegistries.ITEM.getKey(entry.getKey().asItem()).toString();row.addProperty("id","compost/"+id);row.addProperty("title","Compost "+id);row.add("inputs",GSON.toJsonTree(List.of(List.of(id),List.of("minecraft:composter"))));row.add("outputs",GSON.toJsonTree(List.of("minecraft:bone_meal")));row.addProperty("chancePerLevel",entry.getFloatValue());row.addProperty("detail","Fill a composter to level 7, wait for maturation, then collect bone meal. Each addition has the recorded chance; this is not a one-item yield.");interactions.add(row);
      }
      for (var holder : server.getRecipeManager().getRecipes()) {
        JsonObject row = new JsonObject(); row.addProperty("id", holder.id().toString());
        var recipe = holder.value();
        row.addProperty("type", BuiltInRegistries.RECIPE_TYPE.getKey(recipe.getType()).toString());
        row.addProperty("special", recipe.isSpecial());
        row.addProperty("class", recipe.getClass().getName());
        try {
          row.add("json", Recipe.CODEC.encodeStart(ops, recipe).getOrThrow());
          var result = recipe.getResultItem(server.registryAccess());
          row.addProperty("output", BuiltInRegistries.ITEM.getKey(result.getItem()).toString());
          row.addProperty("count", result.getCount());
          JsonArray ingredients = new JsonArray();
          for (var ingredient : recipe.getIngredients()) {
            ingredients.add(GSON.toJsonTree(Arrays.stream(ingredient.getItems()).map(i -> BuiltInRegistries.ITEM.getKey(i.getItem()).toString()).distinct().toList()));
          }
          row.add("ingredients", ingredients);
        } catch (Exception e) { row.addProperty("error", e.toString()); errors.add(holder.id()+": "+e); }
        recipes.add(row);
      }
      for (var entity : BuiltInRegistries.ENTITY_TYPE) {
        JsonObject row = new JsonObject();
        row.addProperty("id", BuiltInRegistries.ENTITY_TYPE.getKey(entity).toString());
        row.addProperty("category", entity.getCategory().getName());
        row.addProperty("width", entity.getWidth()); row.addProperty("height", entity.getHeight());
        row.addProperty("lootTable", entity.getDefaultLootTable().location().toString());
        if (net.minecraft.world.entity.ai.attributes.DefaultAttributes.hasSupplier(entity)) {
          @SuppressWarnings("unchecked") var living=(net.minecraft.world.entity.EntityType<? extends net.minecraft.world.entity.LivingEntity>)entity;
          var attributes=net.minecraft.world.entity.ai.attributes.DefaultAttributes.getSupplier(living);JsonObject values=new JsonObject();
          for(var attribute:BuiltInRegistries.ATTRIBUTE.holders().toList()) if(attributes.hasAttribute(attribute))values.addProperty(attribute.key().location().toString(),attributes.getValue(attribute));
          row.add("defaultAttributes",values);
        }
        entities.add(row);
      }
      JsonObject loot = new JsonObject(), advancements = new JsonObject();
      JsonObject patchChecks = new JsonObject();
      var lootRegistry = server.reloadableRegistries().get().registryOrThrow(Registries.LOOT_TABLE);
      var lootOps = RegistryOps.create(JsonOps.INSTANCE, server.reloadableRegistries().get());
      for (var entry : lootRegistry.entrySet()) {
        try { loot.add(entry.getKey().location().toString(), LootTable.DIRECT_CODEC.encodeStart(lootOps, entry.getValue()).getOrThrow()); }
        catch (Exception e) { errors.add(entry.getKey()+": "+e); }
      }
      for(String name:List.of("copycat_wing","copycat_wing_8","copycat_wing_12","platinum_casing")) {
        var block=BuiltInRegistries.BLOCK.get(net.minecraft.resources.ResourceLocation.parse("createpropulsion:"+name));
        var params=new net.minecraft.world.level.storage.loot.LootParams.Builder(server.overworld())
          .withParameter(net.minecraft.world.level.storage.loot.parameters.LootContextParams.ORIGIN,net.minecraft.world.phys.Vec3.ZERO)
          .withParameter(net.minecraft.world.level.storage.loot.parameters.LootContextParams.BLOCK_STATE,block.defaultBlockState())
          .withParameter(net.minecraft.world.level.storage.loot.parameters.LootContextParams.TOOL,new ItemStack(Items.DIAMOND_PICKAXE))
          .create(net.minecraft.world.level.storage.loot.parameters.LootContextParamSets.BLOCK);
        var table=lootRegistry.get(net.minecraft.resources.ResourceLocation.parse("createpropulsion:blocks/"+name));
        JsonArray drops=new JsonArray();if(table!=null)for(var stack:table.getRandomItems(params))drops.add(ItemStack.CODEC.encodeStart(ops,stack).getOrThrow());
        patchChecks.add(name,drops);
      }
      Files.writeString(out.resolve("patch_checks.json"),GSON.toJson(patchChecks));
      for (var advancement : server.getAdvancements().getAllAdvancements()) {
        try { advancements.add(advancement.id().toString(), Advancement.CODEC.encodeStart(ops, advancement.value()).getOrThrow()); }
        catch (Exception e) { errors.add(advancement.id()+": "+e); }
      }
      JsonArray lootModifiers=new JsonArray();
      var managerAccessor=net.neoforged.neoforge.common.NeoForgeEventHandler.class.getDeclaredMethod("getLootModifierManager");
      managerAccessor.setAccessible(true);
      var lootModifierManager=(net.neoforged.neoforge.common.loot.LootModifierManager)managerAccessor.invoke(null);
      for(var modifier:lootModifierManager.getAllLootMods()) {
        lootModifiers.add(net.neoforged.neoforge.common.loot.IGlobalLootModifier.DIRECT_CODEC.encodeStart(ops,modifier).getOrThrow());
      }
      Files.writeString(out.resolve("loot_modifiers.json"),GSON.toJson(lootModifiers));
      JsonArray blockRecipes=new JsonArray();
      for(var recipe:rbasamoyai.createbigcannons.crafting.BlockRecipesManager.getRecipes()) {
        blockRecipes.add(rbasamoyai.createbigcannons.crafting.BlockRecipe.CODEC.encodeStart(ops,recipe).getOrThrow());
      }
      Files.writeString(out.resolve("block_recipes.json"),GSON.toJson(blockRecipes));
      // Rechiseled has its own registry, outside Minecraft RecipeManager.
      JsonArray chiseling = new JsonArray();
      for (var recipe : com.supermartijn642.rechiseled.api.chiseling.ChiselingRecipeManager.get(false).getAllRecipes()) {
        JsonObject row=new JsonObject(); JsonArray entries=new JsonArray();
        for(var entry:recipe.entries()) {
          JsonObject e=new JsonObject(); e.addProperty("owner",entry.owner().toString());e.addProperty("recipe",entry.recipe().toString());
          JsonArray variants=new JsonArray();
          for(var shape:com.supermartijn642.rechiseled.api.chiseling.ChiselingBlockShape.values()) {
            for(boolean connected:List.of(false,true)) {
              if(!(connected?entry.hasConnectingItem(shape):entry.hasRegularItem(shape)))continue;
              var value=connected?entry.getConnectingItem(shape):entry.getRegularItem(shape);
              JsonObject v=new JsonObject();v.addProperty("id",BuiltInRegistries.ITEM.getKey(value.item()).toString());v.addProperty("worth",value.worth());v.addProperty("shape",shape.toString());v.addProperty("connecting",connected);variants.add(v);
            }
          }
          e.add("variants",variants);entries.add(e);
        }
        row.add("entries",entries);chiseling.add(row);
      }
      Files.writeString(out.resolve("chiseling.json"),GSON.toJson(chiseling));
      // Probe registered brewing behavior, retaining potion components as states.
      JsonArray brewing=new JsonArray(), potionFluids=new JsonArray();var brewer=server.potionBrewing();
      var potionRegistry=server.registryAccess().registryOrThrow(Registries.POTION);
      var reagents=BuiltInRegistries.ITEM.stream().filter(i->brewer.isIngredient(new ItemStack(i))).toList();
      for(var potion:potionRegistry.holders().toList())for(var container:List.of(Items.POTION,Items.SPLASH_POTION,Items.LINGERING_POTION)) {
        var input=net.minecraft.world.item.alchemy.PotionContents.createItemStack(container,potion);
        var potionFluid=com.simibubi.create.content.fluids.potion.PotionFluidHandler.getFluidFromPotionItem(input);
        JsonObject fluidRow=new JsonObject();fluidRow.add("item",ItemStack.CODEC.encodeStart(ops,input).getOrThrow());fluidRow.add("fluid",net.neoforged.neoforge.fluids.FluidStack.CODEC.encodeStart(ops,potionFluid).getOrThrow());potionFluids.add(fluidRow);
        for(var reagent:reagents) {
          var ingredient=new ItemStack(reagent);if(!brewer.hasMix(input,ingredient))continue;
          JsonObject row=new JsonObject();row.add("input",ItemStack.CODEC.encodeStart(ops,input).getOrThrow());row.add("ingredient",ItemStack.CODEC.encodeStart(ops,ingredient).getOrThrow());row.add("output",ItemStack.CODEC.encodeStart(ops,brewer.mix(ingredient,input)).getOrThrow());brewing.add(row);
        }
      }
      Files.writeString(out.resolve("brewing.json"),GSON.toJson(brewing));
      Files.writeString(out.resolve("potion_fluids.json"),GSON.toJson(potionFluids));
      // Seeded offer samples, not an exhaustive list of random enchantment/NBT variants.
      JsonArray trades=new JsonArray();
      var villager=new net.minecraft.world.entity.npc.Villager(net.minecraft.world.entity.EntityType.VILLAGER,server.overworld());
      for(var profession:net.minecraft.world.entity.npc.VillagerTrades.TRADES.entrySet()) {
        for(var level:profession.getValue().int2ObjectEntrySet()) {
          villager.setVillagerData(villager.getVillagerData().setProfession(profession.getKey()).setLevel(level.getIntKey()));
          int listingIndex=0;
          for(var listing:level.getValue()) {
            // Map trades can search/generate terrain. Do not invoke them in an audit.
            if(listing.getClass().getName().contains("TreasureMap")){listingIndex++;continue;}
            Set<String> seen=new HashSet<>();
            for(int seed=0;seed<8;seed++)try {
              var offer=listing.getOffer(villager,net.minecraft.util.RandomSource.create(seed));if(offer==null)continue;
              var json=net.minecraft.world.item.trading.MerchantOffer.CODEC.encodeStart(ops,offer).getOrThrow();if(!seen.add(json.toString()))continue;
              JsonObject row=new JsonObject();row.addProperty("profession",BuiltInRegistries.VILLAGER_PROFESSION.getKey(profession.getKey()).toString());row.addProperty("level",level.getIntKey());row.addProperty("listing",listingIndex);row.addProperty("seed",seed);row.addProperty("implementation",listing.getClass().getName());row.add("offer",json);trades.add(row);
            }catch(Exception e){errors.add("trade "+listing.getClass().getName()+": "+e);}
            listingIndex++;
          }
        }
      }
      var trader=new net.minecraft.world.entity.npc.WanderingTrader(net.minecraft.world.entity.EntityType.WANDERING_TRADER,server.overworld());
      for(var level:net.minecraft.world.entity.npc.VillagerTrades.WANDERING_TRADER_TRADES.int2ObjectEntrySet()) {
        int index=0;for(var listing:level.getValue()) {
          if(listing.getClass().getName().contains("TreasureMap")){index++;continue;}
          Set<String> seen=new HashSet<>();
          for(int seed=0;seed<8;seed++)try {
            var offer=listing.getOffer(trader,net.minecraft.util.RandomSource.create(seed));if(offer==null)continue;
            var json=net.minecraft.world.item.trading.MerchantOffer.CODEC.encodeStart(ops,offer).getOrThrow();if(!seen.add(json.toString()))continue;
            JsonObject row=new JsonObject();row.addProperty("profession","minecraft:wandering_trader");row.addProperty("level",level.getIntKey());row.addProperty("listing",index);row.addProperty("seed",seed);row.addProperty("implementation",listing.getClass().getName());row.add("offer",json);trades.add(row);
          }catch(Exception e){errors.add("wandering trade: "+e);}index++;
        }
      }
      trader.discard();villager.discard();Files.writeString(out.resolve("trades.json"),GSON.toJson(trades));
      // Effective resource-manager view retains pack priority and full conditions.
      JsonObject resources = new JsonObject();
      for (var prefix : List.of("recipe", "loot_table", "advancement", "worldgen", "tags", "neoforge", "data_maps", "thruster_fuels", "solid_thruster_fuels", "coral_generator_fuels", "hostile_skies", "chiseling_recipes", "createbigcannons", "powergrid", "loot_modifiers")) {
      for (var entry : server.getResourceManager().listResources(prefix, p -> p.getPath().endsWith(".json")).entrySet()) {
        try (var reader = entry.getValue().openAsReader()) {
          JsonObject row = new JsonObject(); row.addProperty("pack", entry.getValue().sourcePackId());
          row.add("json", JsonParser.parseReader(reader)); resources.add(entry.getKey().toString(), row);
        } catch (Exception e) { errors.add(entry.getKey()+": "+e); }
      }
      }
      for (var entry : Map.of("items",items,"blocks",blocks,"recipes",recipes,"entities",entities,"loot",loot,"advancements",advancements,"resources",resources,"errors",errors).entrySet()) {
        Files.writeString(out.resolve(entry.getKey()+".json"), GSON.toJson(entry.getValue()));
      }
      Files.writeString(out.resolve("interactions.json"),GSON.toJson(interactions));
      Files.writeString(out.resolve("hooks.json"),GSON.toJson(hooks));
      Files.writeString(out.resolve("fluids.json"),GSON.toJson(fluids));
      exportHeat(server, out);
      exportJournal(server, out);
      WorldgenProbe.export(server, out);
      Files.writeString(out.resolve("complete.json"), "{\"minecraft\":\""+server.getServerVersion()+"\",\"time\":\""+java.time.Instant.now()+"\"}");
      System.out.println("ATLAS_EXPORT_COMPLETE items="+items.size()+" recipes="+recipes.size()+" errors="+errors.size());
    } catch (Exception e) { e.printStackTrace(); }
  }
  private static void exportHeat(MinecraftServer server, Path out) throws Exception {
    var world=server.overworld();var pos=new net.minecraft.core.BlockPos(4,200,4);
    var previous=world.getBlockState(pos);var previousAbove=world.getBlockState(pos.above());var id=net.minecraft.resources.ResourceLocation.parse("createpropulsion:solid_burner");
    var block=BuiltInRegistries.BLOCK.get(id);JsonObject result=new JsonObject();
    try {
      world.setBlock(pos,net.minecraft.world.level.block.Blocks.AIR.defaultBlockState(),3);
      world.setBlock(pos,block.defaultBlockState(),3);
      // A basin requests heat through the default thermostat; a bare burner idles.
      world.setBlock(pos.above(),BuiltInRegistries.BLOCK.get(net.minecraft.resources.ResourceLocation.parse("create:basin")).defaultBlockState(),3);
      Object burner=world.getBlockEntity(pos);
      var initialize=burner.getClass().getMethod("initialize");var tickMethod=burner.getClass().getMethod("tick");
      initialize.invoke(burner);tickMethod.invoke(burner);
      var heatMethod=Class.forName("com.simibubi.create.content.processing.basin.BasinBlockEntity").getMethod("getHeatLevelOf",net.minecraft.world.level.block.state.BlockState.class);
      var cold=(com.simibubi.create.content.processing.burner.BlazeBurnerBlock.HeatLevel)heatMethod.invoke(null,world.getBlockState(pos));
      if(com.simibubi.create.content.processing.recipe.HeatCondition.HEATED.testBlazeBurner(cold))throw new IllegalStateException("Unfueled solid burner satisfies heated mixing after tick");
      var inventory=(net.neoforged.neoforge.items.IItemHandler)burner.getClass().getMethod("getItemHandler",net.minecraft.core.Direction.class).invoke(burner,net.minecraft.core.Direction.UP);
      var remainder=inventory.insertItem(0,new ItemStack(Items.COAL,64),false);
      if(remainder.getCount()==64)throw new IllegalStateException("Solid burner rejected coal");
      int heatedAt=-1,superheatedAt=-1;
      for(int tick=1;tick<=12000;tick++) {
        tickMethod.invoke(burner);var heat=(com.simibubi.create.content.processing.burner.BlazeBurnerBlock.HeatLevel)heatMethod.invoke(null,world.getBlockState(pos));
        if(heatedAt<0 && com.simibubi.create.content.processing.recipe.HeatCondition.HEATED.testBlazeBurner(heat))heatedAt=tick;
        if(superheatedAt<0 && com.simibubi.create.content.processing.recipe.HeatCondition.SUPERHEATED.testBlazeBurner(heat))superheatedAt=tick;
      }
      if(heatedAt<0)throw new IllegalStateException("Coal-fired solid burner did not reach heated mixing state");
      result.addProperty("solidBurnerCold",cold.toString());result.addProperty("coalAccepted",64-remainder.getCount());
      result.addProperty("manualTicks",12000);result.addProperty("heatedAtTick",heatedAt);result.addProperty("superheatedAtTick",superheatedAt);
      result.addProperty("remainingCoal",((ItemStack)burner.getClass().getMethod("getFuelStack").invoke(burner)).getCount());
      result.addProperty("scope","Actual isolated-world burner ticks and Create basin heat predicate; no working mixer, loaded heat consumer or real-time throughput test");
    } finally {world.setBlock(pos,net.minecraft.world.level.block.Blocks.AIR.defaultBlockState(),3);world.setBlock(pos,previous,3);world.setBlock(pos.above(),previousAbove,3);}
    Files.writeString(out.resolve("heat_checks.json"),GSON.toJson(result));
  }
  private static void exportJournal(MinecraftServer server, Path out) throws Exception {
    if (!net.neoforged.fml.ModList.get().isLoaded("questlog")) return;
    org.infernalstudios.questlog.core.DefinitionUtil.loadFromConfig();
    // NeoForge's normal fake-player advancements deliberately discard progress.
    // Keep real advancement state in this disposable probe, never a user save.
    var player = new net.neoforged.neoforge.common.util.FakePlayer(server.overworld(), new com.mojang.authlib.GameProfile(java.util.UUID.fromString("874aeb32-b798-4f24-9b56-78988f09071a"), "AtlasJournal")) {
      private net.minecraft.server.PlayerAdvancements journalAdvancements;
      @Override public net.minecraft.server.PlayerAdvancements getAdvancements() {
        if (journalAdvancements == null) journalAdvancements = new net.minecraft.server.PlayerAdvancements(server.getFixerUpper(), server.getPlayerList(), server.getAdvancements(), out.resolve("journal-probe-advancements.json"), this);
        return journalAdvancements;
      }
    };
    var manager = new org.infernalstudios.questlog.core.QuestManager(player) {
      @Override public void sync(net.minecraft.resources.ResourceLocation id) {}
    };
    var managersField = org.infernalstudios.questlog.core.ServerPlayerManager.class.getDeclaredField("questManagers");
    managersField.setAccessible(true);
    @SuppressWarnings("unchecked")
    var managers = (java.util.Map<java.util.UUID, org.infernalstudios.questlog.core.QuestManager>) managersField.get(org.infernalstudios.questlog.core.ServerPlayerManager.INSTANCE);
    managers.put(player.getUUID(), manager);
    var context = new org.infernalstudios.questlog.network.IPacketContext() {
      @Override public net.minecraft.world.entity.player.Player getSender() { return player; }
      @Override public org.infernalstudios.questlog.network.IPacketContext.Direction getDirection() { return org.infernalstudios.questlog.network.IPacketContext.Direction.CLIENT_TO_SERVER; }
    };
    JsonArray rows = new JsonArray();
    for (var id : org.infernalstudios.questlog.core.DefinitionUtil.getCachedQuestKeys()) {
      var definition = org.infernalstudios.questlog.core.DefinitionUtil.getCachedQuest(id);
      var quest = org.infernalstudios.questlog.core.quests.Quest.create(definition, id, manager);
      manager.addQuest(quest);
      if (quest.objectives.isEmpty()) throw new IllegalStateException("Empty quest: " + id);
      if (org.infernalstudios.questlog.core.DefinitionUtil.getCachedChapter(net.minecraft.resources.ResourceLocation.parse(definition.get("chapter").getAsString())) == null) throw new IllegalStateException("Missing chapter: " + id);
      int checks = 0;
      for (int i = 0; i < quest.objectives.size(); i++) checks += checkJournalObjective(definition.getAsJsonArray("objectives").get(i).getAsJsonObject(), quest.objectives.get(i), player);
      if (!quest.isCompleted()) throw new IllegalStateException("Objective did not complete: " + id);
      int rewardChecks = 0;
      for (int i = 0; i < quest.rewards.size(); i++) {
        if (!(quest.rewards.get(i) instanceof org.infernalstudios.questlog.core.quests.rewards.ItemReward reward)) throw new IllegalStateException("Untested journal reward: " + id);
        var data = definition.getAsJsonArray("rewards").get(i).getAsJsonObject();
        var expected = BuiltInRegistries.ITEM.get(net.minecraft.resources.ResourceLocation.parse(data.get("item").getAsString()));
        int amount = data.get("count").getAsInt();
        if (expected == Items.AIR || reward.isAutoClaim() || reward.hasRewarded()) throw new IllegalStateException("Invalid fixed manual reward: " + id);
        if (!reward.getStack().is(expected) || reward.getStack().getCount() != amount) throw new IllegalStateException("Reward decoded incorrectly: " + id);
        player.getInventory().clearContent();
        var packet = new org.infernalstudios.questlog.network.packet.QuestRewardCollectPacket(id, i, List.of());
        org.infernalstudios.questlog.network.packet.QuestRewardCollectPacket.handle(packet, context);
        if (!reward.hasRewarded() || player.getInventory().countItem(expected) != amount) throw new IllegalStateException("Reward grant failed: " + id);
        org.infernalstudios.questlog.network.packet.QuestRewardCollectPacket.handle(packet, context);
        if (player.getInventory().countItem(expected) != amount) throw new IllegalStateException("Repeated claim duplicated reward: " + id);
        rewardChecks++;
      }
      var restored = org.infernalstudios.questlog.core.quests.Quest.create(definition, id, manager);
      restored.deserialize(quest.serialize());
      if (!restored.isCompleted()) throw new IllegalStateException("Journal progress did not restore: " + id);
      for (var reward : restored.rewards) if (!reward.hasRewarded()) throw new IllegalStateException("Reward claim did not restore: " + id);
      JsonObject row = new JsonObject(); row.addProperty("id", id.toString()); row.add("definition", definition);
      row.addProperty("checkedLeaves", checks); row.addProperty("negativeAndPositiveHandlers", true); row.addProperty("nbtRoundTrip", true);
      row.addProperty("fixedRewardGrants", rewardChecks); row.addProperty("repeatClaimRejected", true); row.addProperty("rewardClaimNbtRoundTrip", true); rows.add(row);
    }
    // Inventory overflow is intentionally tested on one ordinary fixed reward.
    var overflow = manager.getAllQuests().stream().filter(quest -> !quest.rewards.isEmpty()).findFirst().orElseThrow();
    var overflowReward = (org.infernalstudios.questlog.core.quests.rewards.ItemReward) overflow.rewards.getFirst();
    var overflowStack = overflowReward.getStack();
    overflowReward.revokeReward();
    player.setPos(0, 10, 0);
    server.overworld().getChunkAt(player.blockPosition());
    for (int slot = 0; slot < player.getInventory().items.size(); slot++) player.getInventory().setItem(slot, new ItemStack(Items.BARRIER, 64));
    var bounds = player.getBoundingBox().inflate(8);
    var before = new java.util.HashSet<>(server.overworld().getEntitiesOfClass(net.minecraft.world.entity.item.ItemEntity.class, bounds));
    org.infernalstudios.questlog.network.packet.QuestRewardCollectPacket.handle(new org.infernalstudios.questlog.network.packet.QuestRewardCollectPacket(overflow.getId(), 0, List.of()), context);
    var drops = server.overworld().getEntitiesOfClass(net.minecraft.world.entity.item.ItemEntity.class, bounds).stream().filter(entity -> !before.contains(entity)).toList();
    int dropped = drops.stream().filter(entity -> entity.getItem().is(overflowStack.getItem())).mapToInt(entity -> entity.getItem().getCount()).sum();
    if (dropped != overflowStack.getCount() || !overflowReward.hasRewarded() || player.getInventory().countItem(overflowStack.getItem()) != 0) throw new IllegalStateException("Journal reward overflow was not dropped safely");
    drops.forEach(net.minecraft.world.entity.Entity::discard);
    managers.remove(player.getUUID());
    player.getInventory().clearContent();
    Files.writeString(out.resolve("journal.json"), GSON.toJson(rows));
    Files.writeString(out.resolve("journal_rewards.json"), "{\"manualClaims\":true,\"repeatClaimsRejected\":true,\"overflowDropped\":true,\"scope\":\"Native packet handler in isolated server; no client input or gameplay completion implied\"}");
  }
  private static int checkJournalObjective(JsonObject data, org.infernalstudios.questlog.core.quests.objectives.Objective objective, net.minecraft.server.level.ServerPlayer player) throws Exception {
    if (data.get("type").getAsString().equals("questlog:or")) {
      int checks = 0;
      for (int i = 0; i < objective.getChildren().size(); i++) checks += checkJournalObjective(data.getAsJsonArray("objectives").get(i).getAsJsonObject(), objective.getChildren().get(i), player);
      return checks;
    }
    if (objective.isCompleted()) throw new IllegalStateException("Objective starts complete");
    if (data.get("type").getAsString().equals("questlog:item_obtain")) {
      var id = net.minecraft.resources.ResourceLocation.parse(data.get("item").getAsString());
      if (!BuiltInRegistries.ITEM.containsKey(id)) throw new IllegalStateException("Unknown journal item: " + id);
      var eventType = Class.forName("com.evandev.triggers.event.events.TriggerPlayerEvent$Tick");
      var event = eventType.getConstructor(net.minecraft.world.entity.player.Player.class).newInstance(player);
      var handler = objective.getClass().getDeclaredMethod("onPlayerTick", eventType); handler.setAccessible(true);
      var timer = objective.getClass().getDeclaredField("ticksUntilCheck"); timer.setAccessible(true);
      player.getInventory().clearContent(); player.getInventory().setItem(0, new ItemStack(Items.BARRIER));
      timer.setInt(objective, 0); handler.invoke(objective, event);
      if (objective.getUnits() != 0) throw new IllegalStateException("Wrong item accepted: " + id);
      int count = objective.getRequiredAmount();
      if (count > 1) {
        player.getInventory().setItem(0, new ItemStack(BuiltInRegistries.ITEM.get(id), count - 1));
        timer.setInt(objective, 0); handler.invoke(objective, event);
        if (objective.isCompleted()) throw new IllegalStateException("Insufficient item count accepted: " + id);
      }
      player.getInventory().setItem(0, new ItemStack(BuiltInRegistries.ITEM.get(id), count));
      timer.setInt(objective, 0); handler.invoke(objective, event);
    } else if (data.get("type").getAsString().equals("questlog:advancement")) {
      var id = net.minecraft.resources.ResourceLocation.parse(data.get("advancement").getAsString());
      var advancement = player.getServer().getAdvancements().get(id);
      if (advancement == null) throw new IllegalStateException("Unknown journal advancement: " + id);
      var eventType = Class.forName("com.evandev.triggers.event.events.TriggerPlayerEvent$Tick");
      var event = eventType.getConstructor(net.minecraft.world.entity.player.Player.class).newInstance(player);
      var handler = objective.getClass().getDeclaredMethod("onPlayerTick", eventType); handler.setAccessible(true);
      var timer = objective.getClass().getDeclaredField("ticksUntilCheck"); timer.setAccessible(true);
      for (String criterion : advancement.value().criteria().keySet()) player.getAdvancements().revoke(advancement, criterion);
      timer.setInt(objective, 0); handler.invoke(objective, event);
      if (objective.getUnits() != 0) throw new IllegalStateException("Missing advancement accepted: " + id);
      try {
        for (String criterion : advancement.value().criteria().keySet()) player.getAdvancements().award(advancement, criterion);
        if (!player.getAdvancements().getOrStartProgress(advancement).isDone()) throw new IllegalStateException("Fixture failed to grant advancement: " + id + "; " + player.getAdvancements().getClass().getName());
        timer.setInt(objective, 0); handler.invoke(objective, event);
      } finally {
        for (String criterion : advancement.value().criteria().keySet()) player.getAdvancements().revoke(advancement, criterion);
      }
    } else if (data.get("type").getAsString().equals("questlog:block_interact")) {
      var id = net.minecraft.resources.ResourceLocation.parse(data.get("block").getAsString());
      if (!BuiltInRegistries.BLOCK.containsKey(id)) throw new IllegalStateException("Unknown journal block: " + id);
      var eventType = Class.forName("com.evandev.triggers.event.events.TriggerBlockEvent$Interact");
      var ctor = eventType.getConstructor(net.minecraft.world.level.block.state.BlockState.class, net.minecraft.core.BlockPos.class, net.minecraft.world.entity.LivingEntity.class, ItemStack.class);
      var handler = objective.getClass().getDeclaredMethod("onBlockInteract", eventType); handler.setAccessible(true);
      handler.invoke(objective, ctor.newInstance(net.minecraft.world.level.block.Blocks.AIR.defaultBlockState(), net.minecraft.core.BlockPos.ZERO, player, ItemStack.EMPTY));
      if (objective.isCompleted()) throw new IllegalStateException("Wrong block accepted: " + id);
      handler.invoke(objective, ctor.newInstance(BuiltInRegistries.BLOCK.get(id).defaultBlockState(), net.minecraft.core.BlockPos.ZERO, player, ItemStack.EMPTY));
    } else throw new IllegalStateException("Untested journal objective: " + data);
    if (!objective.isCompleted()) throw new IllegalStateException("Matching event rejected: " + data);
    return 1;
  }
  private static void transformation(JsonArray records,String action,net.minecraft.world.level.block.Block from,net.minecraft.world.level.block.Block to,String tool) {
    String input=BuiltInRegistries.ITEM.getKey(from.asItem()).toString(), output=BuiltInRegistries.ITEM.getKey(to.asItem()).toString();
    if (input.equals("minecraft:air")||output.equals("minecraft:air"))return;
    JsonObject row=new JsonObject(); row.addProperty("id",action+"/"+input);row.addProperty("title",action+" "+input);
    row.add("inputs",GSON.toJsonTree(List.of(List.of(input),List.of(tool))));row.add("outputs",GSON.toJsonTree(List.of(output)));
    row.addProperty("evidence","runtime transformation registry");row.addProperty("detail",action.equals("wax")?"Honeycomb applied to placed block; honeycomb is consumed.":action.equals("oxidize")?"Placed copper ages through random ticks. Time, neighboring copper and exposed area affect oxidation; not instantaneous.":"Axe use on placed block; tool is reusable and durability may be spent.");records.add(row);
  }
  /** Read method names without resolving client-only parameter types on a server. */
  private static List<String> declaredHooks(Class<?> type) throws java.io.IOException {
    List<String> result=new ArrayList<>();
    try (var stream=type.getResourceAsStream("/"+type.getName().replace('.','/')+".class")) {
      if(stream==null)return result;
      var in=new java.io.DataInputStream(stream);in.readInt();in.readInt();int count=in.readUnsignedShort();String[] utf=new String[count];
      for(int i=1;i<count;i++) {
        int tag=in.readUnsignedByte();
        switch(tag) {
          case 1 -> utf[i]=in.readUTF();
          case 3,4,9,10,11,12,17,18 -> in.skipNBytes(4);
          case 5,6 -> {in.skipNBytes(8);i++;}
          case 7,8,16,19,20 -> in.skipNBytes(2);
          case 15 -> in.skipNBytes(3);
          default -> throw new java.io.IOException("Unknown class constant "+tag);
        }
      }
      in.skipNBytes(6);int interfaces=in.readUnsignedShort();in.skipNBytes(interfaces*2L);
      int fields=in.readUnsignedShort();
      for(int i=0;i<fields;i++){in.skipNBytes(6);skipAttributes(in);}
      int methods=in.readUnsignedShort();
      for(int i=0;i<methods;i++) {
        in.readUnsignedShort();String name=utf[in.readUnsignedShort()];in.readUnsignedShort();
        if(Set.of("use","useOn","finishUsingItem","interactLivingEntity","releaseUsing","onUseTick","hurtEnemy","mineBlock","inventoryTick").contains(name))result.add(name);
        skipAttributes(in);
      }
    }
    return result;
  }
  private static void skipAttributes(java.io.DataInputStream in) throws java.io.IOException {
    int attributes=in.readUnsignedShort();for(int j=0;j<attributes;j++){in.readUnsignedShort();in.skipNBytes(Integer.toUnsignedLong(in.readInt()));}
  }
}
