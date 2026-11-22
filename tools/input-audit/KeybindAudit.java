package audit;
import com.google.gson.*;
import java.nio.file.*;
import java.util.*;
import net.minecraft.client.*;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.network.chat.Component;
import net.neoforged.api.distmarker.Dist;
import net.neoforged.fml.ModList;
import net.neoforged.fml.common.Mod;
import net.neoforged.neoforge.common.NeoForge;
import net.neoforged.neoforge.client.event.ClientTickEvent;

@Mod(value="keybind_audit",dist=Dist.CLIENT)
public final class KeybindAudit {
 private int ticks;private boolean done;
 public KeybindAudit(){if(!Files.isRegularFile(Minecraft.getInstance().gameDirectory.toPath().resolve(".input-audit")))throw new IllegalStateException("Missing disposable input marker");NeoForge.EVENT_BUS.addListener(this::tick);}

 private void captureCustom(JsonObject result) throws Exception {
  var ipn=new JsonArray();
  for(String name:List.of("org.anti_ad.mc.ipnext.config.Modpacks","org.anti_ad.mc.ipnext.config.Debugs","org.anti_ad.mc.ipnext.config.Hotkeys","org.anti_ad.mc.ipnext.config.ScrollSettings","org.anti_ad.mc.ipnext.config.LockedSlotsSettings","org.anti_ad.mc.ipnext.config.AutoRefillSettings","org.anti_ad.mc.ipnext.config.ModSettings","org.anti_ad.mc.ipnext.config.ConfigScreenSettings")){
   Class<?> c=Class.forName(name);Object instance=c.getField("INSTANCE").get(null);
   for(var m:c.getMethods())if(m.getParameterCount()==0&&m.getReturnType()==org.anti_ad.mc.common.config.options.ConfigHotkey.class){
    var o=(org.anti_ad.mc.common.config.options.ConfigHotkey)m.invoke(instance);var b=o.getMainKeybind();var r=new JsonObject();r.addProperty("id",c.getSimpleName()+"."+m.getName().substring(3));r.addProperty("display",b.getDisplayText());r.add("keyCodes",new Gson().toJsonTree(b.getKeyCodes()));r.add("defaultKeyCodes",new Gson().toJsonTree(b.getDefaultKeyCodes()));r.addProperty("settings",b.getSettings().toString());r.addProperty("defaultSettings",b.getDefaultSettings().toString());var alternatives=new JsonArray();for(var a:o.getAlternativeKeybinds()){var alt=new JsonObject();alt.addProperty("display",a.getDisplayText());alt.add("keyCodes",new Gson().toJsonTree(a.getKeyCodes()));alt.add("defaultKeyCodes",new Gson().toJsonTree(a.getDefaultKeyCodes()));alt.addProperty("settings",a.getSettings().toString());alt.addProperty("defaultSettings",a.getDefaultSettings().toString());alternatives.add(alt);}r.add("alternatives",alternatives);r.add("serialized",JsonParser.parseString(o.getClass().getMethod("toJsonElement").invoke(o).toString()));ipn.add(r);
   }
  }result.add("ipnBindings",ipn);
  var emi=new JsonArray();for(var f:dev.emi.emi.config.EmiConfig.class.getFields())if(java.lang.reflect.Modifier.isStatic(f.getModifiers())&&f.getType()==dev.emi.emi.input.EmiBind.class){var b=(dev.emi.emi.input.EmiBind)f.get(null);var r=new JsonObject();r.addProperty("id",f.getName());r.addProperty("translation",b.translationKey);var current=new JsonArray();for(var k:b.boundKeys)current.add(k.toName());var defaults=new JsonArray();for(var k:b.defaultKeys)defaults.add(k.toName());r.add("keys",current);r.add("defaultKeys",defaults);emi.add(r);}result.add("emiBindings",emi);
 }
 private void tick(ClientTickEvent.Post event){var mc=Minecraft.getInstance();if(Files.isRegularFile(mc.gameDirectory.toPath().resolve("post-fix-input-fixture.json"))){PostFixRemapProbe.tick(mc);return;}if(done||mc.getOverlay()!=null||!(mc.screen instanceof TitleScreen)||++ticks<20)return;done=true;var result=new JsonObject();
 try{var bindings=new JsonArray();var mods=new JsonObject();ModList.get().getMods().forEach(m->mods.addProperty(m.getModId(),m.getVersion().toString()));result.add("mods",mods);result.addProperty("scope","Actual Options.keyMappings registration and effective keys on TitleScreen in a marked owned client; no world or input-dispatch qualification");
 var keys=mc.options.keyMappings.clone();Arrays.sort(keys,Comparator.comparing(KeyMapping::getCategory).thenComparing(KeyMapping::getName));
 for(var k:keys){var r=new JsonObject();r.addProperty("id",k.getName());r.addProperty("label",Component.translatable(k.getName()).getString());r.addProperty("categoryId",k.getCategory());r.addProperty("category",Component.translatable(k.getCategory()).getString());r.addProperty("input",k.getKey().getName());r.addProperty("defaultInput",k.getDefaultKey().getName());r.addProperty("modifier",k.getKeyModifier().name());r.addProperty("defaultModifier",k.getDefaultKeyModifier().name());r.addProperty("context",String.valueOf(k.getKeyConflictContext()));r.addProperty("contextClass",k.getKeyConflictContext().getClass().getName());r.addProperty("class",k.getClass().getName());r.addProperty("display",k.getTranslatedKeyMessage().getString());bindings.add(r);}result.add("bindings",bindings);captureCustom(result);
 var pairs=new JsonArray();for(int i=0;i<keys.length;i++)for(int j=i+1;j<keys.length;j++)if(!keys[i].isUnbound()&&!keys[j].isUnbound()&&keys[i].same(keys[j])){var p=new JsonArray();p.add(keys[i].getName());p.add(keys[j].getName());pairs.add(p);}result.add("nativeConflictPairs",pairs);result.addProperty("complete",true);
 }catch(Throwable failure){result.addProperty("complete",false);result.addProperty("failure",failure.toString());}
 try{Files.writeString(mc.gameDirectory.toPath().resolve("input-capture.json"),new GsonBuilder().setPrettyPrinting().create().toJson(result));}catch(Exception ex){throw new RuntimeException(ex);}mc.stop();}
}
