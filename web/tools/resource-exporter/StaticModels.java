import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonArray;
import com.google.gson.JsonParser;
import com.mojang.blaze3d.vertex.PoseStack;
import java.lang.reflect.Field;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import net.minecraft.client.model.CowModel;
import net.minecraft.client.model.CreeperModel;
import net.minecraft.client.model.PigModel;
import net.minecraft.client.model.ChickenModel;
import net.minecraft.client.model.geom.ModelPart;
import net.minecraft.client.model.geom.builders.CubeDeformation;
import net.minecraft.core.Direction;
import java.util.Set;
import net.minecraft.client.model.geom.builders.LayerDefinition;
import org.joml.Vector3f;

/** Exports baked fixed geometry only; never starts a client, server, entity, or animation. */
public final class StaticModels {
    private static Object field(Object value, String name) throws ReflectiveOperationException {
        Field field = value.getClass().getDeclaredField(name);
        field.setAccessible(true);
        return field.get(value);
    }

    private static Map<String, Object> snapshot(ModelPart root) {
        List<Object> meshes = new ArrayList<>();
        Set<String> hiddenPaths = new java.util.HashSet<>();
        hiddenPaths(root,"",hiddenPaths);
        root.visit(new PoseStack(), (pose, part, index, cube) -> {
            if(hiddenPaths.stream().anyMatch(path -> part.equals(path) || part.startsWith(path+"/"))) return;
            try {
                for (Object polygon : (Object[]) field(cube, "polygons")) {
                    List<Float> positions = new ArrayList<>();
                    List<Float> uv = new ArrayList<>();
                    for (Object vertex : (Object[]) field(polygon, "vertices")) {
                        Vector3f position = new Vector3f((Vector3f) field(vertex, "pos"));
                        position.div(16).mulPosition(pose.pose()).mul(16);
                        positions.add(position.x + 8);
                        positions.add(24 - position.y);
                        positions.add(8 - position.z);
                        uv.add((float) field(vertex, "u"));
                        uv.add(1 - (float) field(vertex, "v"));
                    }
                    meshes.add(Map.of("name", part + "/" + index, "positions", positions, "uv", uv, "texture", "surface"));
                }
            } catch (ReflectiveOperationException error) {
                throw new IllegalStateException("Minecraft ModelPart export contract changed", error);
            }
        });
        return Map.of("textures", Map.of("surface", "surface"), "elements", List.of(), "meshes", meshes, "doubleSided", true);
    }

    @SuppressWarnings("unchecked")
    private static void hiddenPaths(ModelPart part, String path, Set<String> hidden) {
        if(!part.visible) { hidden.add(path); return; }
        try {
            for(var child:((Map<String,ModelPart>)field(part,"children")).entrySet())
                hiddenPaths(child.getValue(),path+"/"+child.getKey(),hidden);
        } catch(ReflectiveOperationException error) {
            throw new IllegalStateException("ModelPart visibility contract changed",error);
        }
    }

    private static float number(JsonObject object, String key, float fallback) {
        return object.has(key) ? object.get(key).getAsFloat() : fallback;
    }

    private static float[] vector(JsonObject object, String key, float[] fallback) {
        if (!object.has(key)) return fallback;
        JsonArray array = object.getAsJsonArray(key);
        float[] result = new float[array.size()];
        for (int i=0; i<result.length; i++) result[i] = array.get(i).getAsFloat();
        return result;
    }

    private static ModelPart cemPart(JsonObject data, int[] size, Set<String> hidden) throws Exception {
        if (data.has("texture") || data.has("sprites") || data.has("attachments") || data.has("baseId"))
            throw new IllegalArgumentException("Unsupported CEM texture/sprite/attachment/inheritance");
        String inverse = data.has("invertAxis") ? data.get("invertAxis").getAsString() : "";
        String mirror = data.has("mirrorTexture") ? data.get("mirrorTexture").getAsString() : "";
        if (mirror.contains("v"))
            throw new IllegalArgumentException("Unsupported CEM vertical mirroring");
        float[] signs = {inverse.contains("x") ? -1 : 1, inverse.contains("y") ? -1 : 1, inverse.contains("z") ? -1 : 1};
        List<ModelPart.Cube> cubes = new ArrayList<>();
        if (data.has("boxes")) for (var value : data.getAsJsonArray("boxes")) {
            JsonObject box = value.getAsJsonObject();
            float[] c = vector(box,"coordinates", new float[0]);
            if(c.length != 6) throw new IllegalArgumentException("Invalid CEM box");
            for(int i=0;i<3;i++) if(signs[i]<0) c[i] = -c[i]-c[i+3];
            float[] offset=vector(box,"textureOffset",new float[]{0,0});
            float grow=number(box,"sizeAdd",0);
            float[] growth=vector(box,"sizesAdd",new float[]{grow,grow,grow});
            ModelPart.Cube cube = new ModelPart.Cube((int)offset[0],(int)offset[1],c[0],c[1],c[2],c[3],c[4],c[5],
                    growth[0],growth[1],growth[2],box.has("textureOffset") && mirror.contains("u"),size[0],size[1],Set.of(Direction.values()));
            // EMF ignores mirror flags for explicit face UVs; the endpoints own orientation.
            if(!box.has("textureOffset")) {
                List<Object> polygons = new ArrayList<>();
                for(Object polygon:(Object[])field(cube,"polygons")) {
                    Vector3f normal=(Vector3f)field(polygon,"normal");
                    String face=normal.y>0 ? "uvUp" : normal.y<0 ? "uvDown" : normal.z>0 ? "uvSouth" : normal.z<0 ? "uvNorth" : normal.x>0 ? "uvEast" : "uvWest";
                    if(!box.has(face)) continue;
                    float[] uv=vector(box,face,new float[0]);
                    if(uv.length!=4) throw new IllegalArgumentException("Invalid CEM face UV");
                    Object[] vertices=(Object[])field(polygon,"vertices");
                    float[][] pairs={{uv[2],uv[1]},{uv[0],uv[1]},{uv[0],uv[3]},{uv[2],uv[3]}};
                    var remap=vertices[0].getClass().getDeclaredMethod("remap",float.class,float.class);remap.setAccessible(true);
                    for(int i=0;i<4;i++)vertices[i]=remap.invoke(vertices[i],pairs[i][0]/size[0],pairs[i][1]/size[1]);
                    polygons.add(polygon);
                }
                Object original=field(cube,"polygons");
                Object filtered=java.lang.reflect.Array.newInstance(original.getClass().getComponentType(),polygons.size());
                for(int i=0;i<polygons.size();i++)java.lang.reflect.Array.set(filtered,i,polygons.get(i));
                Field polygonsField=cube.getClass().getDeclaredField("polygons");polygonsField.setAccessible(true);polygonsField.set(cube,filtered);
            }
            cubes.add(cube);
        }
        Map<String,ModelPart> children=new LinkedHashMap<>();
        if(data.has("submodels"))for(var value:data.getAsJsonArray("submodels")) {
            JsonObject child=value.getAsJsonObject();
            String id=child.has("id")?child.get("id").getAsString():"part"+children.size();
            if(children.put(id,cemPart(child,size,hidden))!=null)throw new IllegalArgumentException("Duplicate CEM child");
        }
        ModelPart part=new ModelPart(cubes,children);
        float[] t=vector(data,"translate",new float[3]),r=vector(data,"rotate",new float[3]);
        part.setPos(t[0]*signs[0],t[1]*signs[1],t[2]*signs[2]);
        part.setRotation((float)Math.toRadians(r[0]*signs[0]),(float)Math.toRadians(r[1]*signs[1]),(float)Math.toRadians(r[2]*signs[2]));
        part.xScale=part.yScale=part.zScale=number(data,"scale",1);
        part.visible = !data.has("id") || !hidden.contains(data.get("id").getAsString());
        return part;
    }

    @SuppressWarnings("unchecked")
    private static void applyCem(ModelPart root, JsonObject rig, JsonObject pose, String adapter, Set<String> hidden) throws Exception {
        String[] nativeParts, names;
        if (adapter.equals("creeper") || adapter.equals("quadruped")) {
            nativeParts=new String[]{"head","body","right_hind_leg","left_hind_leg","right_front_leg","left_front_leg"};
            names=new String[]{"head","body","leg1","leg2","leg3","leg4"};
        } else if (adapter.equals("chicken")) {
            nativeParts=new String[]{"head","body","right_leg","left_leg","right_wing","left_wing","beak","red_thing"};
            names=new String[]{"head","body","right_leg","left_leg","right_wing","left_wing","bill","chin"};
        } else throw new IllegalArgumentException("Unadmitted static CEM adapter: "+adapter);
        Map<String,ModelPart> named=new LinkedHashMap<>();named.put("root",root);
        for(int i=0;i<names.length;i++)named.put(names[i],root.getChild(nativeParts[i]));
        for(var entry:pose.entrySet()) {
            ModelPart part=named.get(entry.getKey());
            JsonObject values=entry.getValue().getAsJsonObject();
            if(part==null)throw new IllegalArgumentException("Unknown inspection pose part");
            part.setPos(number(values,"x",part.x),number(values,"y",part.y),number(values,"z",part.z));
            part.setRotation(number(values,"rx",part.xRot),number(values,"ry",part.yRot),number(values,"rz",part.zRot));
        }
        JsonArray size=rig.getAsJsonArray("textureSize");
        for(var entry:rig.getAsJsonArray("models")) {
            JsonObject data=entry.getAsJsonObject();
            ModelPart parent=named.get(data.get("part").getAsString());
            if(parent==null)throw new IllegalArgumentException("Unknown static CEM attachment");
            Field cubes=ModelPart.class.getDeclaredField("cubes");cubes.setAccessible(true);
            if(!data.has("attach")||!data.get("attach").getAsBoolean())cubes.set(parent,List.of());
            ((Map<String,ModelPart>)field(parent,"children")).put("preview_"+data.get("id").getAsString(),cemPart(data,new int[]{size.get(0).getAsInt(),size.get(1).getAsInt()},hidden));
        }
    }

    public static void main(String[] args) throws Exception {
        if (args.length < 1 || args.length > 2 || (args.length == 2 && !args[1].equals("--confectionery")))
            throw new IllegalArgumentException("Expected output directory and an optional admitted factory flag");
        Map<String, LayerDefinition> layers = new LinkedHashMap<>();
        layers.put("minecraft:cow", CowModel.createBodyLayer());
        layers.put("minecraft:creeper", CreeperModel.createBodyLayer(CubeDeformation.NONE));
        layers.put("minecraft:pig", PigModel.createBodyLayer(CubeDeformation.NONE));
        layers.put("minecraft:chicken", ChickenModel.createBodyLayer());
        if (args.length == 2)
            layers.put("create_confectionery:little_gingerbread_man", (LayerDefinition) Class.forName(
                    "net.mcreator.createconfectionery.client.model.Modelgingerbread_man").getMethod("createBodyLayer").invoke(null));
        Map<String, Object> result = new LinkedHashMap<>();
        for (var entry : layers.entrySet()) {
            ModelPart root = entry.getValue().bakeRoot();
            Map<String, Object> variants = new LinkedHashMap<>();
            variants.put("rest", snapshot(root));
            if (root.hasChild("head")) {
                root.getChild("head").yRot += 0.45f;
                variants.put("look-right", snapshot(root));
            }
            result.put(entry.getKey(), variants);
        }
        Path output = Path.of(args[0]);
        Path cemFile = output.resolve("cem-inputs.json");
        if(Files.isRegularFile(cemFile)) {
            JsonObject inputs=JsonParser.parseString(Files.readString(cemFile)).getAsJsonObject();
            for(var entry:inputs.entrySet()) {
                JsonObject input=entry.getValue().getAsJsonObject();
                String factory=input.get("factory").getAsString();
                if(!layers.containsKey(factory))throw new IllegalArgumentException("Unadmitted static factory: "+factory);
                ModelPart root=layers.get(factory).bakeRoot();
                Set<String> hidden=new java.util.HashSet<>();
                for(var part:input.getAsJsonArray("hiddenParts"))hidden.add(part.getAsString());
                applyCem(root,input.getAsJsonObject("rig"),input.getAsJsonObject("pose"),input.get("adapter").getAsString(),hidden);
                result.put(entry.getKey(),Map.of("inspection",snapshot(root)));
            }
        }
        Files.createDirectories(output);
        Files.writeString(output.resolve("native-models.json"), new Gson().toJson(Map.of("schema", 1, "models", result)));
        System.out.println("Exported " + result.size() + " static client model definitions; no Minecraft instance started");
    }
}
