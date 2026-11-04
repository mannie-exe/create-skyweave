# Map guide

## Item grid

Search by item name or identifier, filter by namespace or route status, and scroll
in both directions. Drag with the mouse to pan; touch and trackpad scrolling remain
available. Scrollbars are hidden. Click or drag the minimap to move across the grid;
arrow keys pan while the grid or minimap is focused, Home returns to the origin,
and End moves to the far corner. The minimap scales the two grid axes independently
to keep both directions usable across the tall layout. Hover for a summary; select an item for its acquisition paths,
recipes, uses, drops, tags, implementation hooks and source records. Direct links
use `/?item=minecraft:iron_ingot`; existing review links redirect to the normal Atlas.

Choose **Planned first access** for paths that prefer fewer opportunistic sources,
unknown-chance stages and chance-based stages before comparing depth. **Earliest
possible access** keeps optimistic shortcuts, including loot. Neither estimates
playtime. The aligned depth labels and jump selector navigate horizontally;
acquisition bands and their selector navigate vertically. Counts follow filters.
Each depth has six columns; families describe the chosen method, not every way
of obtaining an item. Open the item to compare its alternatives.

Coverage distinguishes mapped routes, blocked prerequisites, missing adapters,
internal/creative exclusions and unified variants. Coverage buttons mark mapped
routes in blue, blocked routes in amber and missing adapters with a dashed gray
line. Grid markers, the legend and minimap use those same colors; the minimap's
small points omit the dashed pattern. Internal/creative and unified items stay
neutral. Review notes have a separate corner dot and the **Has review note** filter.
These marks do not indicate the selected filter or verified playability.
A mapped path shows potential
access under its listed assumptions. Supported quantities and conditional odds are
shown separately; working machinery, travel and combat remain constraints.

## Item details

Acquisition places the selected method's diagram first, with the item and method
list beside it on wide screens and below it on narrow screens. Selecting a method
updates both its direct prerequisites and recipe or source conditions. The list
supports search, method-type filters, planned access, chance per eligible attempt,
and fewest/most graph steps. First-supply
methods and methods that depend on an existing supply are compared separately;
unresolved prerequisites stay unranked. **More filters** narrows prerequisite
evidence and output role, including conversions and secondary outputs.

**How are methods compared?** explains the comparison. The selected method's evidence
lists independently traced prerequisites. Depth describes the longest modeled
branch, not total operations or gameplay difficulty. Input counts include machines
and environmental gates; they are not material quantities. Recipes retain their
quantities, alternatives and operating requirements. Filtering does not change the
selected method; a message identifies selections outside the current filters.

Expand **yield and requirements** for conditional odds, expected output, materials
and setup. Unsupported odds say “Chance not calculated.” Attempts are grouped by
unit; a mob kill, chest and crafting execution are different activities. Averages
assume eligible sources and stated conditions, not guaranteed success or equal time.

Select an ingredient to inspect how to obtain it. Back restores the previous item,
selected method and filters. Fit, zoom and the minimap navigate the direct diagram.
**Open item progression** carries the map policy into the full path, which can use a
different acquisition method. Uses lists consuming recipes; Evidence holds drops,
tags, hooks and provenance. Pack notes are expandable. Escape or Close dismisses
details; desktop view navigation remains accessible above the inspector.

## Progression graph

Open **Progression graph** beside Item map. Its tabs answer separate questions:

- **Systems:** possible cross-mod inputs and outputs around a selected namespace.
  Arrow labels count contributing routes, including possible OR ingredients.
  They are not mandatory dependencies or quantities.
- **Processing:** input and output items for a selected machine. Each connection
  retains the routes that mention both. The inputs and outputs summarize separate
  recipes; they are not one combined recipe. Machine requirements come from the
  authored progression model, including machines used in multi-step routes.
- **Item routes:** vertical acquisition diagrams with item icons. **Single route**
  shows acquisition or use alternatives; **Item progression** expands one finite
  chain under its policy selector. The item inspector's **Open item progression** opens
  that path directly. Paths open near the target at a readable scale; use Fit
  for the overview or the minimap to move through earlier steps. Dashed edges are OR choices; ALL input groups feeding an
  operation are required. Separate routes are alternatives, not sequential tasks.
  Single routes show up to four choices per group and twelve outputs. Paths show
  the chosen input per group and at most the last 80 steps; other choices remain
  in group details. Counts state omissions. Empty groups and scenarios stay explicit.
  An unresolved path can still have candidate routes in Single route mode.
- **Coverage:** counts and items by mapping status and namespace. A missing route
  is an atlas gap, not proof that the item is unobtainable in-game.

Systems and Coverage show the top 12 connections by default. Processing splits
that limit between inputs and outputs. Choose Top 24 or All to expand; counts state
how much is shown. The item list is searchable, with 100 entries initially and
Show more for the rest. Selecting an item opens its routes; Processing's list
instead selects the machine. Item details opens the shared inspector with paths,
quantities, conditions and provenance.

Drag the canvas to pan, use the wheel or +/− controls to zoom, and click or drag the
minimap below it to navigate. On the canvas or minimap, arrow keys pan, +/− zoom,
and Home fits the scene. Fit frames the current scene. Reset view clears the item
search and refits the current view. Graph-tab switches remember their camera and selection. `/` focuses
the active map's search. The selectors below the canvas provide keyboard access
to every displayed node and connection, including contributing route records.

Reload data preserves selections and camera while rereading compiled JSON. Direct
source edits require compilation first; saves through Edit data rebuild the projection
and refresh the visible view while retaining graph navigation. Refresh the page to recheck the runtime
fingerprint after external changes.

The canvas mounts a bounded viewport projection. Large scenes simplify at low zoom;
the footer reports visible nodes and connections and any omitted edges. Connections
with off-screen endpoints are not drawn. Full source records remain available;
a summary or partial canvas does not establish a complete production chain.

## Recipe displays

Item details, Evidence recipes and graph route selections share slot displays.
Click an icon to inspect the item. A slot's numbered badge opens its alternatives
in the ingredient list, outside the fixed grid. Counts,
fluid amounts, probabilistic outputs and processing conditions come from recipe
JSON. Cooking/processing times are Minecraft ticks. Operating requirements list
machines and capabilities separately from consumed slots. Wide panels show inputs
→ output; narrow panels stack inputs ↓ output. Large mechanical patterns retain
their geometry with local horizontal scrolling. In the full graph, the selected
recipe appears beside the canvas on wide screens and below it on smaller screens.

Supported layouts include shaped/shapeless crafting, mechanical crafting, cooking,
stonecutting, smithing transforms/trims and common Create processing recipes.
Trimming shows the supplied armor as a modified base rather than treating the
runtime's sample iron chestplate as a fixed output. The trim pattern itself is not
rendered. Trims remain consuming uses and do not create item-acquisition edges. These are
browser reconstructions using extracted icons, not running game GUIs. Sequenced
assembly and other unsupported custom layouts retain an explicit source-record
fallback. Components, source packs and conditions remain available in every record.

## Evidence and world survey

Evidence lists recipes, loot, advancements, trades, configuration, overlaps and
coverage gaps. Search within a domain and expand source data for the captured
record. Source links and identifiers distinguish runtime evidence from authored
interpretation.

World & ores separates saved terrain, isolated island experiments and village
placement samples. The saved survey displays its capture date and recorded world
identity, or an explicit legacy warning when identity was not captured. It is not
a live view. A new server world does not automatically replace these measurements.

Open the survey directly at `/?view=world`. The ore list sits beside the centered
region map and height profile on wide screens; it stacks above them on narrow
screens. Selecting an ore keeps the page in place. Each map square represents a
32 × 32 chunk region. Use the metric menu or availability table to compare its map
and vertical profile. The table
shows area-weighted estimates and approximate sampling intervals; sparse samples
can miss rare ore. Height charts use recorded dimension bounds or the observed
range and include an expandable numeric table. The travel calculator estimates
time at a supplied constant speed; it does not simulate a vehicle. Without a
survey, the view states that measurements are absent.

The separate Village survey compares controlled foundation/chest yields with
natural candidate starts and fully generated samples. Expand Method and limits
for provenance and full block counts. A stale warning means the survey needs to
be repeated against the current runtime and processor inputs.

## Editing

Edit data exposes the eight files in `data/authored`. Save & rebuild validates
the selected domain and recompiles the map. Reload from disk before saving if
another editor changed the same file. Direct YAML edits require `pnpm data:compile`.
The [data reference](data.md#ownership) lists each domain's responsibility.

Recipe edits are scenarios. Export recipe datapack packages complete replacement
recipes or disable conditions; it never installs them. Test and install a reviewed
patch separately. The changed resources must be included in the audit capture
before its results can verify that change; world-only datapacks are not imported.
Other domain edits affect interpretation and assumptions, not game configuration.

Refresh data captures an isolated runtime and rebuilds resources and routes.
It does not rescan the world. A stale indicator calls for review or refresh;
the app does not continuously follow the running game.

Domain drafts survive switching between source files. External source changes keep each draft tied to its original revision; reload discards only the selected file's draft. Editing and refresh controls work only through `pnpm dev`. Static preview and
future static deployments provide browsing only.

## Resource packs

Open **Resource packs** in the header for the dated review at `/resourcepacks`.
**Compare captures** opens `/resourcepacks/reviews`. Choose a feature, scene and
candidate to compare matched original captures on one canvas. **Swipe** lets you
drag across the image or use **Reveal position**; the slider also supports arrow
keys, Home and End. **Vertical halves** fixes current left/candidate right;
**Horizontal halves** fixes current top/candidate bottom. Both fixed modes disable
the slider. Returning to Swipe restores its previous position. The URL retains the
feature, scene and candidate for sharing and reloading. **All variants on one sheet** opens the cropped
comparison; **Chests and Lootr → Closing animations** includes native recordings.
Collapsed recordings pause playback.

**Approved selections** lists the production choices within each feature group.
They can differ within a group. This matrix owns selective donor choices;
procedural models and artwork additionally affect the built result shown in
Resources. A is the dated capture baseline, not today's generated patch. Review notes and
preferences remain separate from that selection source.

In `pnpm dev`, choose a preference, enter notes and select **Save review**. Reviews
are saved by dated capture set and feature; they do not install packs or change
selection status. Unsaved drafts survive feature changes. **Reload saved reviews**
reads changes made elsewhere while retaining drafts; expand **Saved review** to
compare, then save or **Revert draft**. Changed sources refuse stale writes.
A warning identifies saved reviews whose evidence has changed. Static builds show
the saved review snapshot and do not offer editing. Old comparison-preview links
redirect here.

The local service reads current capture catalogues and approved selections as well as saved notes. Clean comparison views update when those sources change. Unsaved notes retain their text and show a notice; **Reload saved reviews** updates the catalogue while keeping drafts and the selected scene where available. Refreshing this view does not capture screenshots or change pack selections.

The catalogue retains its existing navigation.
Search by pack, feature or mod, then narrow by decision or scope. Filters are
stored in the URL; Reset clears them. The numbered index stays beside the continuous
reviews and highlights your reading position. Select a pack to jump to its review;
scrolling does not move keyboard focus. On narrow screens the index sits above the
reviews, with a **Back to pack list** link. Filters apply to both the index and the
reviews. Each row pairs the review and source links
with a gallery. Author images and **Create Skyweave tests** share the viewer, with
separate thumbnail groups. Select an image or recording, then enlarge it if needed.
Arrow keys move through the enlarged gallery; video controls retain their native
keyboard behavior. Escape closes the viewer and pauses playback.

Each included entry shows its artifact kind, side and default priority where
applicable. Higher priority overrides lower entries. **Pack-owned** filters to the
generated visual patch and shared data/JAR repairs; they have different load paths.
The JAR has no gallery capture assigned, and links to its authoring tools instead.

File evidence shows the inspected version, hash, declared resource format,
matching installed asset paths and overlaps. These are inspection results, not
proof of correct rendering. Galleries can depict other versions, shaders and
optional mods. Local captures include their test date, context and before/patched
labels where known; older captures may differ from the current pack.
“Try first” identifies candidates for a controlled playtest, not packs to install
together. Selected stack entries derive from current modpack defaults, not your
personal client. Inspection overlaps retain the dated six-pack baseline recorded
with the survey.

Catalog screening retains all 750 ranked listings and their first-pass screening
reasons. Its search is separate from the detailed review filters. Following a
review link reveals its target even if the current filters hide it. The page is
read-only and does not download, install or reorder resource packs.

## Interrupted work

Activity's Recovery section lists retained interrupted files. **Refresh recovery**
reads their current status; **Clean interrupted files** removes only eligible owned
staging or execution metadata after its owners are confirmed stopped. Source backups
and unknown ownership require inspection and are preserved. Cleanup is explicit and
does not restore source files or remove world data.

## Resource objects

Open Resources under Pack authoring. Find an object, choose a material/component
or fixed pose, then compare models or textures. Filters separate origin,
contributors, supported cases and authored work. The URL retains selection and
filters. On mobile, expand Browse objects or Filters when needed.

Native object, Selected packs and Modpack result are declared stacks. Identical
supported renders share one option. Expand Effective resources to inspect owners
and contributors; Comparison B layers previews a temporary registered stack.
Unsupported cases explain the missing adapter instead of substituting geometry.

Edit model or Edit texture opens the corresponding source tool; Back to comparison
returns without discarding drafts. Refresh previews updates the catalogue. Export
static models updates the admitted client geometry first. Activity records these
jobs; neither action installs or builds the shipping resource pack. Model
animation and shaders still require the native recordings/captures.

The resource editor's **Back to object** action returns to its comparison without
saving or discarding source drafts. The working `?workbench=inspector` layout
preview groups object evidence below the source editor; it is not the default.
