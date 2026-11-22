package audit;

import com.google.gson.*;
import com.mojang.blaze3d.platform.InputConstants;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import net.minecraft.client.*;
import net.minecraft.client.gui.screens.ChatScreen;
import net.neoforged.neoforge.client.settings.KeyMappingLookup;

/** Test-only native events against the authored mappings; never packaged with the modpack. */
final class PostFixRemapProbe {
 private static boolean done;
 private static Class<?> fixture;
 private static Method event;
 private static final KeyMappingLookup LOOKUP = new KeyMappingLookup();
 static void tick(Minecraft mc) {
  Path root=mc.gameDirectory.toPath();
  if(done || !Files.isRegularFile(root.resolve("post-fix-run")) || mc.player==null || mc.getSingleplayerServer()==null || !mc.isWindowActive())return;
  done=true;var result=new JsonObject();
  result.addProperty("scope","Actual authored mappings, native key dispatch and original Moves/Effortless consumers in a disposable integrated world; synthetic events/polling, no physical OS input claim");
  try {
   if(!Files.isRegularFile(root.resolve("modifier-review-fixture.json")))throw new IllegalStateException("Missing native input fixture marker");
   fixture=Class.forName("design.inherent.skyweavecompat.clientprobe.ClientModifierProbe");
   event=fixture.getDeclaredMethod("event",Minecraft.class,int.class,int.class);event.setAccessible(true);
   fixture.getField("controlledInput").setBoolean(null,true);
   mc.setScreen(null);KeyMapping.releaseAll();
   var orbit=mapping(mc,"key.punchy_moves.free_camera");
   var camera=mapping(mc,"key.punchy_moves.camera_toggle_v");
   var editor=mapping(mc,"key.punchy_moves.camera_editor");
   var undo=mapping(mc,"key.effortlessbuilding.undo.desc");
   var redo=mapping(mc,"key.effortlessbuilding.redo.desc");
   check(orbit.getKey().getValue()==85 && orbit.getKeyModifier().name().equals("NONE"),"source orbit binding");
   check(camera.getKey().getValue()==85 && camera.getKeyModifier().name().equals("CONTROL"),"source custom camera binding");
   check(editor.getKey().getValue()==85 && editor.getKeyModifier().name().equals("SHIFT"),"source editor binding");
   check(undo.getKey().getValue()==90 && undo.getKeyModifier().name().equals("CONTROL"),"source undo binding");
   check(redo.getKey().getValue()==89 && redo.getKeyModifier().name().equals("CONTROL"),"source redo binding");
   var admission=new JsonObject();
   for(int modifier:new int[]{0,Minecraft.ON_OSX?343:341,340}) {
    mc.setScreen(null);if(modifier!=0)send(mc,modifier,1);
    var selected=LOOKUP.getAll(InputConstants.Type.KEYSYM.getOrCreate(85));
    var expected=modifier==0?orbit:modifier==340?editor:camera;
    check(selected.contains(expected),"native camera group admits expected owner");
    for(var other:List.of(orbit,camera,editor))if(other!=expected)check(!selected.contains(other),"native camera group excludes competing owner");
    admission.addProperty(Integer.toString(modifier),expected.getName());
    if(modifier!=0)send(mc,modifier,0);
   }
   result.add("cameraGroupAdmission",admission);
   var controller=Class.forName("punchymoves.client.camera.ShoulderCameraController");
   var enabled=controller.getMethod("setEnabledFromEditor",boolean.class);
   var free=controller.getMethod("isFreeCameraActive");
   var requested=controller.getDeclaredField("activationRequested");requested.setAccessible(true);
   enabled.invoke(null,false);mc.options.setCameraType(CameraType.FIRST_PERSON);key(mc,85);
   check(!(boolean)free.invoke(null),"orbit retains native custom-camera prerequisite");
   result.addProperty("orbitRequiresCustomCamera",true);
   enabled.invoke(null,true);
   key(mc,85);
   check((boolean)free.invoke(null),"plain U invokes original orbit consumer");
   result.addProperty("plainOrbitStarted",true);
   enabled.invoke(null,false);
   mc.setScreen(null);controller.getMethod("openEditor").invoke(null);
   var originalEditor=editorObservation(mc);
   check(mc.screen!=null,"original editor entry opens a native screen");
   result.add("directNativeEditor",originalEditor);
   mc.setScreen(null);send(mc,340,1);key(mc,85);send(mc,340,0);
   var keyedEditor=editorObservation(mc);result.add("keyedNativeEditor",keyedEditor);
   check(originalEditor.equals(keyedEditor),"Shift+U matches the original editor entry and route");
   result.addProperty("modifiedEditorOpened",true);
   mc.setScreen(null);enabled.invoke(null,false);
   check(!requested.getBoolean(null),"native custom camera reset");
   int control=Minecraft.ON_OSX?343:341;
   send(mc,control,1);key(mc,85);send(mc,control,0);
   check(requested.getBoolean(null),"Mod+U invokes original custom camera toggle");
   check(mc.screen==null && !(boolean)free.invoke(null),"Mod+U does not open editor or orbit");
   result.addProperty("modifiedCustomCameraStarted",true);
   result.addProperty("customCameraWrongActionsAbsent",true);
   var build=Class.forName("neoforge.nl.requios.effortlessbuilding.NeoForgeClientSetup$GameEvents");
   var tick=build.getMethod("onClientTick",net.neoforged.neoforge.client.event.ClientTickEvent.Post.class);
   int u=fixture.getField("undoPackets").getInt(null),r=fixture.getField("redoPackets").getInt(null);
   keyWithTick(mc,90,tick);keyWithTick(mc,89,tick);
   check(fixture.getField("undoPackets").getInt(null)==u && fixture.getField("redoPackets").getInt(null)==r,"plain Z/Y do not emit history packets");
   send(mc,control,1);keyWithTick(mc,90,tick);keyWithTick(mc,89,tick);send(mc,control,0);
   check(fixture.getField("undoPackets").getInt(null)==u+1 && fixture.getField("redoPackets").getInt(null)==r+1,"platform modifier emits one native undo and redo");
   result.addProperty("nativeHistoryUndo",1);result.addProperty("nativeHistoryRedo",1);
   var chat=new ChatScreen("");mc.setScreen(chat);send(mc,control,1);keyWithTick(mc,90,tick);send(mc,control,0);
   check(mc.screen==chat && fixture.getField("undoPackets").getInt(null)==u+1,"chat retains input without history emission");
   result.addProperty("chatHistorySuppressed",true);
   mc.setScreen(null);enabled.invoke(null,false);mc.options.save();
   result.addProperty("complete",true);
  } catch(Throwable failure) {result.addProperty("complete",false);result.addProperty("failure",failure.toString());}
  finally {
   try {if(fixture!=null){@SuppressWarnings("unchecked") var keys=(Set<Integer>)fixture.getField("heldKeys").get(null);for(int held:Set.copyOf(keys))send(mc,held,0);keys.clear();fixture.getField("controlledInput").setBoolean(null,false);}}
   catch(Exception ignored){}
   KeyMapping.releaseAll();mc.setScreen(null);
   try{Class.forName("punchymoves.client.camera.ShoulderCameraController").getMethod("setEnabledFromEditor",boolean.class).invoke(null,false);}catch(Exception ignored){}
  }
  try {Files.writeString(root.resolve("post-fix-proof.json"),new GsonBuilder().setPrettyPrinting().create().toJson(result));}
  catch(Exception failure){throw new RuntimeException(failure);}
 }
 private static KeyMapping mapping(Minecraft mc,String id){return Arrays.stream(mc.options.keyMappings).filter(k->k.getName().equals(id)).findFirst().orElseThrow();}
 private static JsonObject editorObservation(Minecraft mc)throws Exception{
  var result=new JsonObject();result.addProperty("screen",mc.screen==null?"none":mc.screen.getClass().getName());
  if(mc.screen==null)return result;
  var base=Class.forName("punchy.client.menu.mc.MenuScreen");
  if(base.isInstance(mc.screen)){
   var initial=base.getDeclaredField("initialTab");initial.setAccessible(true);
   result.addProperty("requestedTab",(String)initial.get(mc.screen));
   var shell=base.getDeclaredField("shell");shell.setAccessible(true);var actual=shell.get(mc.screen);
   if(actual!=null)result.addProperty("selectedTab",(String)actual.getClass().getMethod("selectedTab").invoke(actual));
  }
  return result;
 }
 private static void send(Minecraft mc,int key,int action)throws Exception{event.invoke(null,mc,key,action);}
 private static void key(Minecraft mc,int key)throws Exception{send(mc,key,1);send(mc,key,0);}
 private static void keyWithTick(Minecraft mc,int key,Method tick)throws Exception{send(mc,key,1);tick.invoke(null,new net.neoforged.neoforge.client.event.ClientTickEvent.Post());send(mc,key,0);}
 private static void check(boolean ok,String what){if(!ok)throw new IllegalStateException(what);}
}
