# Resource authoring

Open **Pack authoring → Resources** (`/resource-authoring`) in `pnpm dev`.
Find an object, choose its part/material or fixed pose, then compare its model or
textures. Desktop uses a side inspector; narrow screens put controls below the
preview and collapse the object browser and filters.

**Native object**, **Selected packs**, and **Modpack result** are explicit resource
stacks. Identical supported renders collapse to one option. Lootr starts from its
native mod assets, not a vanilla chest presented as Lootr. Unsupported loaders,
poses and resource conflicts report their limits. Effective resources expose the
winning source and lower contributors; select a contributor to preview the stack
through that layer. Comparison B also accepts a temporary reordered stack of
registered inputs. None of these actions enables a pack or changes recipes.

**Edit model** and **Edit texture** open the existing source tools for the selected
object. Drafts survive switches between cases, source views and comparisons.
Source links and browser history retain the corresponding object/case. Save
recipes validates and writes the recipe document; Generate resource pack builds
the saved enabled recipes into `Create Skyweave Resource Patches.zip`. Installation is
separate. Refresh previews rebuilds the disposable object catalogue; Export static
models refreshes the admitted client meshes before rebuilding that catalogue.
Both run through named jobs and Activity; neither changes installed instances.

**Recipe JSON** keeps unapplied text separately for each recipe, including invalid
or incomplete JSON. Apply it to validate and update the draft, or use **Discard
JSON edits** to restore the current form values. That recipe's form controls are
disabled while its JSON is being edited. Saving and generation wait until all
JSON drafts are applied or discarded. Reloading or leaving with unsaved work
requires confirmation.

## Sources and output

`authoring/model-recipes.json` owns model IDs, input bindings, extrusion settings,
fitting edits and inclusion switches. `authoring/resource-patches.json` owns exact
archive versions, hashes and acquisition URLs. Add new input sources there after
reviewing their selected empack versions and active resource overlays.

The editor reads materialized inputs only. Run the pack's normal materialization
procedure before opening recipes with missing archives. A changed input hash or
provider selection stops generation; it does not silently accept new geometry.
Recipes refer to explicit archive assets, not an inferred live resource-pack
order. A higher-priority texture replacement must be selected as the recipe's
input and reviewed before using its silhouette.

`scripts/workspace/models.ts` separates source reads, draft previews, validated
saves and resource generation. Preview JSON travels as a checked artifact instead
of a large socket message. Input revisions include exact source/tool hashes and
pinned archive bytes; large archives reuse a digest only while their filesystem
identity is unchanged. Update the declared Python tool list when its imports change.

Resource generation writes a candidate ZIP to an owned staging directory. The
existing builder's `--check-output` validates paths, format and checksums before
publication. Source revisions and the previous output hash are checked again before
atomic replacement of the pack ZIP. Failed or stale candidates keep the prior ZIP;
an unchanged result avoids replacing it. Publishing the result artifact is separate
from building or installing any client/server instance.

`textures.generate` separately rebuilds the texture catalogue from saved sources.
It stages PNGs and JSON, checks the source/tool vector and prior resource pack,
then publishes one immutable generation. Image and preview links resolve to that
generation's scoped artifact references; the live legacy catalogue URL selects
the active manifest. Missing output or changed inputs preserve the previous
catalogue. Its provenance records the runtime/profile, adapter and input revision.
The CLI builder accepts trusted `--root` and `--output` directories; its default
still produces the static snapshot. This operation does not rebuild or install
the resource pack.

Disabled recipes remain editable and previewable, but emit no model override.
Each output resource ID has one owner, including disabled recipes. Models reuse
original texture IDs unless a recipe composes derived artwork. Derived textures
belong to that recipe; other models sharing the input remain untouched. Keep the
generated patch above its input packs.

## Texture composition

The side inspector edits an ordered stack of region copies for the selected
texture. Add, remove, reorder or disable regions without changing the pinned input.
Source and destination rectangles use UV coordinates from 0 to 16 and must align
with source pixels. Flip U/V before applying clockwise quarter-turn rotation;
different destination sizes use nearest-neighbor sampling. Disable a region to
compare its contribution with the preceding artwork.

Each operation reads a snapshot of the preceding result, including when regions
overlap. The same operations run independently on every animation frame. Both the
texture preview and extrusion masks use the composed pixels. Preview lighting
still differs from Minecraft's renderer.

Recipe JSON stores `texture_edits`, keyed by a bound texture resource ID. Each
entry contains ordered `source` and `target` rectangles, optional `flip_u`,
`flip_v`, `rotation` and `enabled` fields. Generation emits recipe-owned PNGs
under `create_skyweave:generated/<recipe>/` and retains the input texture metadata.
Disabled recipes emit neither models nor derived artwork. Color adjustment and
cross-texture compositing are not implemented.

Lootr's approved relighting is generated as direct texture resources, rather than
texture-edit operations attached to its model recipes. The enabled material-mask
recipes `lootr-barrel-clasps` and `lootr-barrel-looted-clasps` supply their corner
clasp geometry; the texture catalogue links each model output to its loot state.
Generation combines the geometry with directional artwork in both closed/open
barrel leaves. Disabling a clasp recipe retains the textured native cube.

### Operation workflow

A compact operation list opens one inspector when a recipe declares texture edits.
The panel is hidden when no edits exist. Previews, Save and Generate all evaluate
the complete ordered stack; there are no per-step comparison controls.

Operation `label` is optional, limited to 80 characters, and has no effect on pixels.
The shared `SortableList` uses dnd-kit handles for pointer and keyboard reordering.
Space starts or drops a keyboard drag; arrows move it and Escape cancels. Selection
stays attached to the operation when its position changes. Add, duplicate, move
and remove actions use compact Material icons with accessible names and Base UI
tooltips. Reduced-motion preferences disable reorder transitions.

React owns this list and its action bar; the existing editor owns recipe state,
fields and preview jobs. Stable UI IDs are local to the tab, not stored in recipes.
Selection resets when changing recipe or texture. There are no persisted
snapshots or operation groups. When updating dnd-kit or Base UI, recheck pointer,
keyboard, cancellation, tooltip dismissal and unapplied-JSON locking together.
Icon paths and attribution live in `lib/ui-icons.ts` and `public/licenses/`.

### Models and textures

Models and Textures are artifacts of the same logical object. Corresponding
source tools have literal links; subjects are not duplicated per contributor.
Legacy model/study links resolve their source recipe or artwork case within the
object browser. The URL records the object, case and active source view.

In an editable recipe, **Resource preview → Show modpack changes** appears above
Extrusion or Model fitting only when built texture overrides affect that model.
It starts enabled and changes preview textures without replacing the working
geometry, editing source, changing inclusion or saving. Directional barrel parts
receive their corresponding side texture. Unchecking restores the recipe input.

Models and Textures describe artifacts, not where an object came from. A vanilla
object can need extrusion or artwork repair just as a modded object can. The
catalogue records object IDs and origin separately from input archives and the
winning pack-owned layer. Cross-view relationships use shared resource IDs rather
than labels. Only registered changes are shown; this is not a full asset browser.
Lootr has a native mod baseline, not a fictitious vanilla equivalent. Donor packs
used by our Lootr adapter are inputs to our patch, not independent native support.

The texture view lists approval and generated-pack status, source IDs, file
previews and a static 3D render. Search retains the selection. **Show modpack
changes** starts enabled.

`authoring/texture-resources.json` owns the texture catalogue and review status.
All four Lootr storage/state entries are approved. Approval includes a generated
artwork fingerprint; changed output is marked Needs review on regeneration. Run
`python3 scripts/build-texture-resources.py`, or use Rebuild previews in the local
workbench. The named `textures.generate` job accepts no browser parameters and
writes only `web/public/generated/texture-resources/`. It does not modify selected
resource packs, recipes, instances or the shipping ZIP. The resource-patch builder
separately consumes enabled approved entries and emits their runtime resources. Generated previews are
rebuildable; approval belongs to the authored catalogue, not the cache.

The generator in `scripts/lootr_artwork.py` retains the material/palette analysis
and relighting implementation. Its authored shading uses front-right (+X,+Z),
broad highlights, a six-pixel falloff and softer bounce highlights on the other
faces. Upper and middle trim stay brighter than undersides. Each loot state's
palette uses its own cube-root luminance range; the brightest entry is reserved
for short specular glints beside the primary corner. Other entries shade the
metal body. This is object-local artwork, not recovered physical lighting.

The gold layout defines a conservative shared trim boundary; gray colors intersect
it so glints painted over wood stay untouched. Only recognized side trim and outer
barrel cap rims are relit. Both barrel lid knobs rotate 180 degrees within their
2×2 regions. Chest main caps rotate 270 degrees clockwise from the pinned atlas;
reversed native UVs put their highlight at front-right. The separate 2×1 latch
cap flips U, including the gold latch's native gray accent. Side wood, alpha and
unused atlas regions remain unchanged. The native body's coincident lid/body
strips at rows 14/42 share palette values to prevent artwork depth fighting.

### Geometry and resource layers

**Show modpack changes** switches the geometry and textures together: off shows
the native carrier and pinned original artwork; on shows the generated modpack
model and resolved pack-owned textures. The labeled preview fieldset is hidden
when a resource has neither model nor texture changes. Chests use the actual CEM in the ZIP. The latter uses
Fresh Objects with the selected 3D Default composition. `scripts/cem_geometry.py`
flattens that rig's unrotated closed pose using EMF's axis and explicit-face UV
conventions. It rejects unsupported transforms or texture rebinding. The
[coverage reference](#preview-coverage-and-deferred-features) records runtime limits.
The Lootr-specific CEM exterior UVs are fitted to the approved native atlas when
shipping artwork is enabled. Donor interior mappings are retained.

Pack-owned layers resolve texture bytes from the resource-patch ZIP, then
`pack-fixes`, with the pinned Lootr original as fallback. The inspector records
the winning owner per binding and the generated index records the patch ZIP hash.
The generated resource pack now supplies the approved Lootr PNGs and directional
barrel bindings. The inspector verifies its per-resource output hashes before
reporting inclusion; enabled source alone does not establish generated content. This is not a complete resolver for arbitrary
third-party resource-pack stacks. Barrel previews use the actual generated clasp
geometry and directional bindings; source-off shows the native cube.

The checkbox compares the built ZIP and pack-fixes resources with their upstream
baseline; it does not preview an ungenerated artwork draft. Barrels display every face in a two-column
pseudo-atlas with small labels; chests show one large atlas. Generating previews
does not install resources. Recheck material boundaries, atlas mappings, the
maintained CEM composition and EMF's [part transforms](https://github.com/Traben-0/Entity_Model_Features/blob/master/src/main/java/traben/entity_model_features/models/jem_objects/EMFPartData.java)
and [custom cuboid UVs](https://github.com/Traben-0/Entity_Model_Features/blob/master/src/main/java/traben/entity_model_features/models/parts/EMFModelPartCustom.java)
when updating dependencies. Exact input pin checks cannot establish artwork meaning.

Reload previews preserves the case and camera. URLs include content hashes to
avoid stale textures. The local middleware serves newly generated hashed previews without a Vite restart. The fixed Top view places the
front below.

Relighting remains code-authored. A future editor can reuse the material-mask and
region compositor primitives for texture zones, palette-response gradient stops,
remapped palettes and light controls. Those would edit authored inputs and use
the same preview/generation path; generated measurements must not become a second
authoring source. No gradient or lighting controls are implemented in this pass.

## Extrusion

Each plane selects a texture, UV crop, axis, center and rectangular bounds. The
recipe sets depth and an alpha threshold. UV coordinates run from 0 to 16 and
must align with source pixels; model coordinates use Minecraft's block units.
Individual planes may bind different textures, such as Deco's post and side.
X/Z planes use horizontal/vertical bounds; Y planes use X/Z bounds. The axis
selector and labels follow that distinction.

Recipe JSON exposes optional `key` and `rotation` fields on a plane, plus a `base`
with an explicit model, retained element indices and texture bindings. These keep
lamp bodies and child texture variables while replacing only cage or hood surfaces.
Fitting edits also accept element rotations. Inspect the pinned template before
changing indices or bindings; the ordinary form preserves these JSON fields.

Opacity or an explicit material palette selects the mask. Material selection
supports color tolerance, restricted regions and included/excluded pixel corrections.
The generator merges adjacent occupied regions into
rectangles for the front and back surfaces, then emits only the exposed perimeter.
Concave holes retain their boundaries; internal faces are omitted. Perimeter UVs
sample the adjacent opaque texel strip across the depth. This is a deliberate edge
rule, not an inferred material or bevel. The recipe can restrict emitted face
directions to keep post ends separate from vertical surfaces.

The generator accepts bounded, non-interlaced RGBA8 and indexed PNGs. Vertical
animation frames must have identical thresholded masks. Unsupported encodings,
empty crops, excessive geometry, non-finite numbers and invalid resource paths
fail validation. Translucent surfaces and animated changes of silhouette need
different geometry rules.

Keep post, post-end, side and alternate-side outputs separate. Review all native
connection rotations, isolated posts, corners, crossings and stacked blocks.
Static model validity does not establish contraption rendering or performance.

## Artwork fitting

Select a fitting recipe, then an element and face. Edit UV bounds numerically or
drag a region in the texture view; set UV rotation separately. The highlighted
element identifies the affected geometry. Element bounds can also be adjusted.
**Reset element** removes that element's authored edits and reloads its pinned
template values.

Fitting recipes reference explicit template geometry. Changes use element indices
with name guards; updating the pinned template requires reviewing those bindings.
Edits apply only to the selected output model. They do not repaint the source
texture or globally replace the vanilla lantern templates.

For Macaw lanterns, assign metal regions to feet, frames and caps, and illuminated
regions to recessed windows. Covered lanterns need opaque lower window regions.
Review standing and hanging variants independently. Preserve the source's three
animation frames, and check whether repeated UV regions produce the intended
material on every face. If the artwork cannot supply a required region, author a
separate texture rather than stretching an unrelated region to disguise it.

## Preview coverage and deferred features

The browser uses Three.js with nearest-neighbor textures, Minecraft face winding,
UV rotation, and supported element rotation. Drag to orbit, scroll to zoom, or use
**Reset view**. Wireframe exposes emitted geometry. Small gray spinners appear in
the upper-right corners during refresh; they retain the previous content and do
not intercept input.

| Area                          | Current behavior                                                                                                                                                                                                  | Deferred work                                                                                                                     |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Block models and artwork      | Registered model recipes and fixed artwork cases; ordered stack resolution, parents, aliases, matching format overlays and supported filters.                                                                     | Custom loaders, CTM/adjacency, arbitrary block-entity rendering.                                                                  |
| Entity models and FA          | Headless native factories for cow, pig, chicken, creeper and Confectionery gingerbread; explicit static CEM stances for those four vanilla species and mooshroom. Compare native, FA base and selected resources. | FA expressions, model animation, conditional variants, arbitrary mod renderers and unadmitted CEM (including unadmitted species). |
| Animated textures             | Two-dimensional frame layouts, frame order and durations; synchronized pause/play, reduced-motion freeze. Editors use the first frame and compose every frame.                                                    | Interpolation is not reproduced; texture timeline editing remains deferred.                                                       |
| Block states and interactions | Declared fixed components and material cases.                                                                                                                                                                     | General state selection, transitions, redstone or neighbor simulation.                                                            |
| Audio                         | None.                                                                                                                                                                                                             | Event resolution, listening and audio authoring.                                                                                  |

These deferrals concern the web authoring/preview system. They do not disable FA,
block interactions, or audio in Minecraft. Keep the existing harness and archived
captures for behavior that needs the game renderer. Browser previews do not prove
shader, lighting, ambient occlusion, emissive, CTM, moving-construct, or runtime
animation compatibility. Unsupported geometry must report its limitation rather
than substitute a plausible model.

### Rendering research and update boundaries

The following source review applies to Minecraft 1.21.1 and was checked on
2026-11-02. It establishes implementation boundaries, not new runtime verification.

- [NeoForge model definitions](https://docs.neoforged.net/docs/1.21.1/resources/client/models/)
  describe parent inheritance, texture bindings, variants, and multipart assembly.
  Some fixed states can therefore be rendered from data later, without simulating
  their gameplay transitions. Custom loaders and neighbor-dependent rendering
  still need explicit support.
- [Block-entity renderers](https://docs.neoforged.net/docs/1.21.1/blockentities/ber/)
  execute Java rendering logic beyond static models. A browser cannot infer all
  such behavior from resource-pack JSON.
- [CEM animation expressions](https://github.com/sp614x/optifine/blob/master/OptiFineDoc/doc/cem_animation.txt)
  use model hierarchies and runtime variables. A static pose must be supplied or
  exported explicitly; ignoring expressions does not reproduce an idle animation.
  The current `scripts/cem_geometry.py` accepts only the maintained closed chest
  mapping and rejects unsupported transforms, bindings, and attachments. The separate static client exporter admits native factories and bounded quadruped, chicken and Creeper
  CEM adapters; neither evaluates animation expressions.
- [Sound definitions](https://docs.neoforged.net/docs/1.21.1/resources/client/sounds/)
  map events to weighted sound choices. Definitions can merge across resource
  packs, with `replace` changing that behavior. Future audio support needs an
  event-aware resolver as well as file playback; a single highest-priority file
  rule is insufficient for `sounds.json`.

On dependency updates, recheck the exact model/texture inputs, resource-format
overlays, CEM/EMF transforms and UV conventions, and the owning generator before
trusting cached previews. Keep unsupported custom loaders or conditional texture
rules visible. Patch ownership and update procedures remain in the
[patch guide](../patches.md); this page owns preview capabilities and deferrals.

## Stack and static export maintenance

`scripts/resource_stack.py` resolves admitted paths, inheritance and bindings.
`scripts/object_inputs.py` derives participating client assets from the empack lock
and enabled order from `overrides/client/options.txt`, including the selected
Analog Audio built-in pack. Native mod assets and the resource-only pack-fixes JAR
are native inputs, not arbitrarily top-priority ZIPs. Conflicting unequal native
mod definitions remain unresolved unless a known higher pack supplies the path.
Filters follow Minecraft 1.21.1 namespace/path matching; format-34 overlays and the
installed Fusion override convention are supported. Winning PNGs cannot inherit
animation metadata from lower image owners.

`authoring/resource-objects.json` declares only extra entity associations, admitted
factory IDs and explicit inspection poses. Existing recipes, texture records,
selected features and registries own the rest. Generated catalogues associate
recipes through actual blockstate/model dependencies; unresolved associations
remain visible. Object origin uses the registry namespace and declared native mod
owner, independently of donor or output namespaces.

`web/scripts/export-models.py` invokes repository-owned model factories through
`web/tools/resource-exporter/StaticModels.java`; it does not launch Minecraft or
initialize mods. Configure `mappedClient` in ignored `web/data/local.json` to an
exact mapped Minecraft/NeoForge client JAR. The fallback is the disposable pack
`.cache/resource-inputs/mapped-client.jar`. Materialize the locked loader libraries
at the configured server path. The Confectionery factory is optional: when its
locked client artifact is present, verify its digest and admit its classpath and
reflective factory together. Vanilla factories do not link that mod. Entity
associations whose owning optional mod is absent are omitted from the catalogue.
The export records Java/Python source, model, CEM and mapped-client hashes plus runtime
versions, with optional factory inputs and digest sets recorded separately.
Do not distribute the mapped client or extracted meshes as authored source.

The workspace refresh sequence is explicit: fetch any missing comparison inputs,
optionally export static factories, generate texture previews, then generate object
previews. Each named worker receives registered pack/web roots, staged output and
admitted input locations. Export publishes only its three checked JSON inputs;
compiled Java classes remain disposable staging files. Object catalogue/preview
publication uses current scoped texture and native generations, not an implicit
`pack/web` or public-directory copy. CLI commands retain their standalone defaults.
Source revisions, input digests and current authority are rechecked before
publication. An outdated catalogue must be refreshed before changing its stack.

After updating Minecraft, NeoForge, Confectionery, EMF or Fresh Animations, inspect
the admitted factories, ModelPart polygon/UV conventions, attachment transforms
and actual CEM includes. Export again, then refresh previews. Recheck hierarchy,
face orientation and explicit pose limits; runtime animation still needs native
captures. Changed export source or relevant inputs makes cached mob data
unsupported until refreshed. Changing only Confectionery's artifact invalidates
its factory without discarding valid vanilla models. Preview hashes include ordered input hashes, adapter
code and source documents; geometry equivalence and resource-byte differences are
recorded separately. The generated index is published last from one checked source
snapshot. Source edits, refreshes, shipping generation and installation remain
separate operations.

The environment's format profile is an admission boundary, not a porting switch.
Update its corresponding Python/Java and browser adapters before admitting another
Minecraft/loader pair. Static cache identity includes both exporter sources and
the mapped-client bytes; optional factory digests remain separate.

## Selected features and comparison sources

`authoring/resource-objects.json` pins six additional input archives and their
review scopes, separate from shipping selections. Fetch candidate inputs uses
`objects.inputs` to download only those authored CDN URLs into the disposable
cache, validating size and SHA-512 before publication. It accepts no browser
parameters. CLI equivalent: `python3 scripts/build-resource-objects.py
--materialize-inputs` from the pack root. Fetching does not enable resource packs.

Candidate profiles put one candidate above the current selected stack, including
our patches. Fixed cases resolve the winning blockstate's actual model references
and declared properties. Weighted alternatives deliberately use their first entry.
The whole pitcher-plant and mature-crop cases combine declared lower/upper halves;
there is no general state editor, neighbor evaluation or interaction simulation.
Unsupported UV lock or differently rotated multipart components remain explicit.
Zero-area faces have no rendered surface and need no texture; a visible unbound
face still stops the preview. RGB8 PNG support retains optional transparent-color
samples without altering downloaded images or existing generated artwork.

The catalogue’s Object comparisons section links these comparisons. Scope is
workstations and utility blocks (UltiCraft, Jacob, 3D Vanilla), pitcher/seagrass
(Vervada and Toasty), and fuller kelp (Montana). Only approved object closures are included in the generated resource ZIP; the
whole donor packs stay disabled. Source profiles still expose the untouched
upstream inputs for comparison. Raw Toasty V3 element angles are rejected by
Minecraft 1.21.1. The selected output preserves those angles through NeoForge's
built-in composite loader and per-element 3×4 root matrices. The static preview
reads the same maintained format. It does not round angles or require another mod.
Empty upper-half models remain empty; the bottom model supplies the whole plant.
Jacob's unselected loom still has a visible unbound texture face and stays blocked.
Other custom loaders remain unsupported unless explicitly adapted.
Montana uses fuller planes and
texture animation rather than solid extruded kelp leaves.

Actually 3D's current release was screened out of this pass because it adds Puzzle
and Modefite runtime requirements. 3D Plus mostly overlaps the selected stack and
its current metadata targets newer resource formats. Faithful 3D requires a
32-pixel texture base. These are different tradeoffs, not rejected visual votes.
No donor assets are committed by this survey; pins and source links are retained.

## Editing boundary

The loopback middleware shares the existing host/origin, body-size and serialized
operation restrictions. Saves validate through the Python generator and check a
revision covering both recipes and input pins. Stale or invalid saves leave disk
content unchanged. Source and temporary symlinks are rejected. Static deployments
have no authoring endpoints. Generation captures the recipes, pins and empack
documents, then checks them again before replacing the ZIP. If they changed,
generation stops and preserves the previous output. External editors are not
locked; finish their edits before generating and review the resulting diff.

## Implementation

Paths in this table are relative to the pack repository root.

| Responsibility                                       | Owner                                    |
| ---------------------------------------------------- | ---------------------------------------- |
| Object catalogue and preview stacks                  | `scripts/build-resource-objects.py`      |
| Native/static CEM export                             | `web/scripts/export-models.py`           |
| Object navigation and comparison                     | `web/src/components/objects/`            |
| Archive selection and hash verification              | `scripts/resource_inputs.py`             |
| PNG decoding, masks, geometry and fitting validation | `scripts/model_authoring.py`             |
| Read-only editor bridge                              | `scripts/model-workbench.py`             |
| Deterministic combined resource pack                 | `scripts/build-resource-patches.py`      |
| Local file revisions, saves and generation requests  | `web/scripts/workspace/models.ts`        |
| Recipe controls and draft state                      | `web/src/lib/model-authoring.ts`         |
| Built artwork/model preview and catalogue            | `web/src/lib/resource-preview.ts`        |
| View-only recipe texture overlay                     | `web/src/lib/model-resource-textures.ts` |
| Model-to-preview conversion and renderer lifecycle   | `web/src/lib/model-preview.ts`           |

Use `python3 scripts/model-workbench.py --validate` to validate saved recipes
without publishing. `--stdin` validates or previews an unsaved JSON document.
Run `python3 scripts/build-resource-patches.py --check` to check existing output,
or omit `--check` to generate it. The owning [patch guide](../patches.md) covers
dependency updates and the separate Lootr/Fresh Objects renderer integration.

The full resource build also includes the approved per-feature donor selections
from `authoring/resource-selections.json`. Those are separate from procedural
model recipes. Changes to either selection source or input pins invalidate the
editor revision before saving or generating; reload to review current inputs.

External input changes preserve edited recipes and unapplied JSON. When a current saved preview exists, a clean editor can refresh it without executing a worker. If the new source needs generation, the existing view remains visible with a reload notice. Object comparisons likewise preserve custom layers and embedded editing; **Load updated previews** reads the published catalogue after leaving those staged views. Neither notification installs resources or changes Minecraft instances.

### Mob comparisons

The object catalogue includes Creeper, cow, pig, chicken and mooshroom resource
comparisons, plus the Confectionery gingerbread factory. Native models come from
the pinned Minecraft factories. The FA-base profile excludes Fresh Details and
our generated resource patch, while Modpack result uses the selected stack.
The explicit FA control remains selectable even when its result is identical.

CEM stances fix adult attachment positions from the installed rig's standing
expressions; they do not run that expression language. Pig inspection hides
feeding props, saddle parts and conditional tusks. Hidden subtrees are excluded
from snapshots. Entity mesh previews use the native no-cull treatment so flat
features remain visible from either side. CEM explicit-face UVs own their
orientation: EMF ignores mirror flags on those faces. Offset-box horizontal
mirroring remains supported; vertical mirroring and per-part texture overrides
remain unsupported.

Mooshroom's selected rig contains its mushroom geometry. The native cow factory
alone omits Minecraft's mushroom feature renderer, so that native comparison is
explicitly unavailable. Do not substitute a bare cow and label it a complete
vanilla mooshroom. Random skins, biome/name rules, baby transforms, animation and
renderer-only equipment/features still require an admitted case or native check.
After a Minecraft, EMF or FA update, review factory/attachment names, UV conventions,
visibility and the fixed stance values before exporting again.

### Generated-resource update checks

Refreshing the source catalogue is separate from rebuilding and publishing
previews. After changing texture inputs or the visual builder, generate the saved
resource pack, then refresh texture and object projections through the workspace
service. A changed ZIP on disk does not update an already published projection.
Include new generator helpers in the resource input vector so loaded-code changes
require a restart and old previews cannot be presented as current.

Lootr's four authored material records also cover the trapped chest variants.
Compare each texture against its own source, including variants that share one
record but have no separate visible preview binding. See
[patch boundaries](../patches.md#registered-texture-artwork) for native rendering contracts.

Resource comparisons may use different dated runs. Review notes are keyed by
capture run and feature; new repair evidence must not replace older choices or
silently change the selected output. Native media and the unresolved bridge-lantern
rotation belong in the existing comparison catalogue.
