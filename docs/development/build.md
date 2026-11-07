# Build and release maintenance

Use empack **0.8.2-beta** and Java **21** from the repository root. Builds use the
recorded lock and explicit distribution profiles. They do not update installed
clients or servers.

## Source layout

| Path                    | Owner of the setting                                               |
| ----------------------- | ------------------------------------------------------------------ |
| `empack.yml`            | Pack version, runtime, dependency intent and distribution profiles |
| `empack.lock`           | Resolved content and hashes                                        |
| `empack.bindings.yml`   | Selected files, names and placement                                |
| `overrides/common/`     | Shared authored configuration                                      |
| `authoring/`            | Journal, model/texture authoring, visual inputs, and configuration register |
| `resource-patches/`     | Shared gameplay data, translations, and resource-only mod metadata |
| `overrides/client/`     | Client-only content and shader presets                             |
| `templates/`            | Prism memory and Java arguments, and server properties             |
| `web/`                  | Internal map and journal editor; excluded from pack payloads       |
| `tools/shader-lab/`     | Pinned shader inputs and shared-engine author builds         |
| `docs/players/`         | Player and server-owner instructions                               |
| `docs/development/`     | Maintainer procedures and dated evidence                           |
| `docs/RELEASE_NOTES.md` | Notes consumed by release CI                                       |

Generated JARs and archives are ignored by Git. Both resource builders accept
`--check` and preserve existing output timestamps when the bytes are unchanged. Keep worlds, credentials, server
lists, raw logs and machine-specific paths out of distributed overrides.

The root `.gitignore` adapts Toptal templates for macOS, Windows, Linux, common
editors and Python tools. `web/.gitignore` adds Node, Astro and extracted game
data. Shared editor settings, dependency locks, `web/src/lib/` and Minecraft tag
files remain trackable; generated assets and local credentials stay ignored.

## Editable installation defaults

`empack.bindings.yml` marks `icon.png`, `options.txt` and the authored shader preset
TXT files as `seed`: initial installation writes the default, while later preparation
preserves edits. Prism rewrites `icon.png` before its pre-launch hook. Server properties
come from the server template and remain installation-local. When a visual pack filename changes, update only its matching saved resource-pack ID during an authorized stopped-client sync; seeded `options.txt` will not replace an existing player's selection. Preserve the rest of the list, its order, and other player settings. Generated Questlog
definitions have exact `managed` policies so journal edits and removals apply on
updates. See [journal updates](journal.md#update-checks) for older seeded definitions.

## Local builds

After editing dependency intent, synchronize and materialize the selected files,
then rebuild maintained resources and build all supported exports:

```sh
python3 tools/shader-lab/build.py
python3 scripts/generate-journal.py --check
python3 scripts/audit-changes.py
python3 scripts/build-resource-patches.py
empack status
empack sync --materialize --yes
python3 scripts/build-visual-patches.py
empack build --profile prism --profile modrinth --profile server --yes --optional-defaults
python3 scripts/patch-server-archives.py
```

The [shader lab](../../tools/shader-lab/README.md) qualifies both recipes through
Compat's shared Java engine. Authoring/CI builds materialize exact inputs and
produce complete review ZIPs; exports reference original shader/payload inputs in
`shader-inputs/` and include the managed recipes. The client generates its finished
ZIPs before Iris opens them. Complete merged shaders are not published as pack
assets or simultaneously managed by empack. Euphoria and Colorwheel retain their
runtime roles. The lab owns recipe and input update procedures.

The defaults build reference Modrinth, Prism and server archives under `dist/`.
Prism and server recipients need empack 0.8.2-beta on `PATH`; the generated hooks
prepare and verify exact files before launch. Modrinth-compatible launchers handle
the `.mrpack` downloads. Authored files remain included, and empack includes prepared
server-runtime assets. Check content sources and installation as well as archive integrity.

Local edits can change an export without changing its filename. Use the published
release's checksums to identify released bytes; a local rebuild is not a substitute
for verifying downloaded release assets.

`authoring/visual-patches.json` pins the archive inputs for the client model patch.
`build-visual-patches.py` checks selected empack versions for installed inputs
and SHA-512 hashes for all archives, then writes `skyweave-visual-patches-0.1.0.zip` in client overrides.
It combines four Crops plants with Fresh Flower Pots, restores Macaw's chain
texture bindings, and includes enabled model-authoring recipes and compatibility
adapters. Approved texture inclusion comes from `authoring/texture-resources.json`;
the same generator supplies the web preview and shipping PNGs, with approval
fingerprints checked before publication. `authoring/resource-selections.json` adds approved per-feature donor
models and the Fresh chest composition. Source-only archives remain outside the
enabled resource stack; required donor textures and licenses are copied into the
generated ZIP. [Model authoring](web/models.md)
owns extrusion and artwork-fitting controls.
Keep this generated pack above its inputs. Unknown versions or model structures
stop generation for review; follow the [update procedure](patches.md#update-sequence). CI runs
the same generator, downloading exact inputs when they are not materialized.

### Copycat renderer

[Copycat Bar Extrusion](https://github.com/mannie-exe/copycat-bar-extrusion) is a
client-only URL dependency pinned by release and SHA-1/SHA-512 in `empack.yml`.
Empack materializes it like the other referenced mods; clean CI needs no local
source checkout or hand-copied override. Do not keep another copy in client overrides.

Its source repository owns the Java 21 Gradle build, exact Create artifact check,
transform tests and native rendering evidence. Review that hook before upgrading
Create. The [compatibility guide](compatibility.md#visual-compatibility-pass) identifies
the tested JAR and limits; no server installation or saved-data migration is needed.

### Terrain and rendering mods

[Skyweave: Compatibility Patches](https://github.com/mannie-exe/skyweave-compat) owns optional
terrain, gameplay, and rendering adapters and belongs on both pack sides. It
incorporates the former Veil Iris Fix; do not include that standalone JAR or Sky
Village Neighbors in any payload. Runtime code does not belong in the resource-only
`skyweave-resource-patches` JAR.

Publish and verify Skyweave: Compatibility Patches before updating its URL and digest pins in `empack.yml`.
Use empack to regenerate bindings and the lock; inspect exports for duplicate or
obsolete JARs. `overrides/common/config/skyweave_compat-features.properties`
explicitly selects the pack's adaptations. Unknown feature keys fail startup, so
review this file whenever removing or renaming upstreamed adapters. The local
configuration sidebar edits this same file for next startup; existing keys and
omitted defaults remain authoritative. Review Skyweave: Compatibility Patches’
[editor maintenance](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/configuration.md)
when updating its configuration facilities.

Remove retired dependencies with `empack remove`, then inspect the lock and exports.
Deleting an intent entry and running `sync` can retain its previous selection.
If URL dependencies lack metadata, review the removal plan before acknowledging
unknown dependency evidence; `--forget` deliberately retains installed content.

The mod itself requires no content mods. The pack deliberately installs Sky
Archipelago and enables its expanded preset. Geometry remains in
`skyweave_compat-generation.json`; village tuning remains in
`skyweave_compat-common.toml`. Structure-family defaults belong to Compat’s
`skyweave_compat-structures.json`; [structure policy](structures.md#cluster-discoveries)
explains its native exceptions and update checks. Client defaults and the server template select
`skyweave_compat:islands_v1` only for new worlds. Distributed seeds remain blank.

For development, use a marked disposable empack workspace with local JAR inputs
and the same three reference profiles. Never publish local-input manifests or
install changed generation into existing play saves.

### Distant Horizons updates

Keep DH and Skyweave: Compatibility Patches' supported version pins aligned. Before updating either,
review Skyweave: Compatibility Patches' [DH hooks](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/lod.md)
and the separate DH Polygon Fix implementation. Shader behavior also depends on
Iris, Complementary/Euphoria and Skyweave: Compatibility Patches’ optional rendering adapters; a successful
terrain-generation check does not establish renderer compatibility.

SeedGen is excluded. Do not add native worker inputs, prediction settings or seed
sharing to distributed defaults. Preserve existing world and LOD cache identities
when syncing an authorized update. Preserve explicit cache-isolation choices: selecting a new key does not migrate
old client data, even though stable adaptations default on in new installations.

### Generation profiles

Geometry, interiors, water and ocean profiles are shared authored JSON files in
`overrides/common/config/`. Keep them together with the qualified artifact and
their categorized audit baselines. New terrain must use a fresh world; the saved
generation marker is not a migration switch.

Skyweave: Compatibility Patches’ verification guide owns adapter loading, terrain, and rendering evidence.
Historical standalone Ponder checks do not establish native rendering behavior
for a new combined artifact; retain pending interactive checks explicitly.
[Patch maintenance](patches.md) owns coupled updates and removal criteria.

## Server webmap

BlueMap is an exact Modrinth dependency with `side: server`. Its authored defaults
live in `overrides/server/config/bluemap/`; both the JAR and config must be absent
from Prism payloads and client requirements. Modrinth archives use server-only file
metadata and server overrides. Check the resulting archives after dependency changes.

BlueMap configuration uses empack's `seed` policy to preserve operator settings,
including download acceptance, ports and map definitions. Fresh installs leave
resource-download consent to the owner. The default Overworld map has no X/Z limits
and includes the complete Skyweave: Compatibility Patches vertical range. New local defaults do not replace
existing seed files automatically; review and apply intended changes separately.
See [server webmap setup](../players/server.md#webmap).

Skyweave: Compatibility Patches optionally adapts the BlueMap 5.7 browser viewer on dedicated
servers. `overrides/server/config/skyweave_compat-bluemap.json` selects `world`;
its seed policy preserves operator edits. Other maps retain the stock renderer.
The adapter uses actual world bounds, extends detailed rendering with bounded
loading, and clips empty-edge triangles in the finest overview layer. It does not
change generation, DH data or stored tiles. Keep full-height map bounds and cave
culling disabled to retain island undersides in detailed tiles. Coarse overview
layers remain height fields: distant stacked terrain and undersides are not fully
represented, and coarse sheets can remain visible from below. The adapter's
configuration and update checks are owned by Skyweave: Compatibility Patches'
`docs/development/bluemap.md`.

## Dependency updates

Use [dependency and patch maintenance](patches.md) for coupled versions, URL pins,
resource overrides and required update checks. `empack outdated` reports provider
candidates; it does not validate gameplay or replace exact-artifact review.
For pinned provider updates, unpin only the reviewed keys, run `update` with their
retained required dependents, then pin the resulting selections and materialize.
Review the selected release policy: `prefer-stable` can choose an older stable
release on a previously selected beta line. Confirm exact version IDs afterward.

Ponder's explicit upstream Maven URL is valid in the referenced archives, but
Modrinth hosting does not allow that download domain. GitHub distributions remain
the publication target; review hosting eligibility before any Modrinth upload.

## Release procedure

1. Review the unreleased notes and required checks in [patch maintenance](patches.md).
   Update `pack.version` in `empack.yml` and write `docs/RELEASE_NOTES.md` for that
   version; archive the previous published notes under `docs/releases/`. Keep unreleased behavior distinct from published behavior in guides.
2. Synchronize and build all three profiles. Inspect client/server mod placement,
   shader presets, configuration and archive integrity. Run the relevant runtime
   checks from [verification](compatibility.md#verification-scope).
3. Record checks, tested versions and limitations in the relevant verification
   guide. Update [decisions](decisions.md) only when policy changes. Commit and
   push the reviewed source.
4. After content commits, run `git-cliff --tag v<version> --output CHANGELOG.md`
   with git-cliff 2.14.2. Review the generated history, then commit it with the
   version and notes as `chore(release): <version>`. Push the matching `v<version>`
   tag to trigger publication.
5. Wait for validation and release jobs. Download the published assets, verify
   `SHA256SUMS`, and check the critical payloads before announcing the release.

Publishing is a separate action from editing or building. Tag only when the
release is prepared and publication is authorized.

## CI maintenance

The pack validation and release workflows select `modrinth`, `prism` and `server`,
use Temurin 21, and pin GitHub Actions to commits. `.github/scripts/empack-ci.py` comes from the empack
scaffold, reviewed against `v0.8.2-beta` at `f29064dc`, with a project-specific
release-notes option. Its build-explanation check expects schema 2.

The helper verifies the downloaded empack binary against GitHub's asset digest,
rejects stale locks and tag/version mismatches, and stages only the outputs named
by `build --explain --json`. It normalizes filenames before hashing and publishes
a draft only after uploads succeed. Published names use hyphens for spaces,
such as `Create-Sky-0.1.7-prism-references.zip`.

Both pack workflows rebuild maintained resources before packaging. The separate
web workflows run from `web/`; [web setup](web/setup.md) describes their checks
and deployment dry run. Pack profiles assemble `pack/`, `overrides/` and
`templates/`, so the app and its local generated assets are outside their inputs.

Retain these choices when refreshing the scaffold:

- `cliff.toml` groups conventional commit history; release/merge commits are excluded.
  `CHANGELOG.md` is the generated repository history; `docs/RELEASE_NOTES.md` owns
  the player-facing summary and archived notes retain that context.
- Release checkout fetches full history. The pinned git-cliff action/tool generates
  the latest tagged section and appends it to the authored summary in a temporary
  file. `EMPACK_RELEASE_NOTES` passes that file through `--notes-file`.
  This follows empack's own GitHub workflow; git-cliff is not an empack CLI command.
- All three reference profiles are selected through `build.default`; CI uses that default.
- Prism overrides memory to 512 MiB minimum and 8192 MiB maximum.
- Prism defaults to Java 21 Generational ZGC through `OverrideJavaArgs=true` and
  `JvmArgs=-XX:+UseZGC -XX:+ZGenerational`; retain player overrides in existing installs.
- Servers enforce the whitelist and create Sky Islands worlds.
- Checkout credentials are not persisted.

Windows server launchers support `EMPACK_NO_PAUSE=1` for unattended tests.
A successful build verifies packaging; it does not establish gameplay or GPU
compatibility.

## Maintained resources

`resource-patches/` contains the resource-only fixes mod and journal client assets.
Rebuild it before exporting. The generated JAR is an ignored build artifact;
its source files are maintained. Quest definitions ship from common config and
client presentation settings ship from client config. See [journal authoring](journal.md).

## Unix terminal wrapper

Empack 0.8.2-beta starts runtimes in a separate process group without transferring
foreground terminal control. An interactive Java server can consequently stop
while initializing its console. The pack retains empack preparation and runtime
supervision and adds a small terminal-handoff helper until the upstream fix lands.

After every local build, run:

```sh
python3 scripts/patch-server-archives.py
```

This selects the current default server reference ZIP from `empack build --explain`.
Explicit archive paths are also accepted. It checks the exact generated scripts,
adds `foreground-runtime.py`, and replaces only the Unix runtime command. Unknown
scripts or helpers fail without modifying the archive; rerunning is a no-op.
Use `python3 scripts/patch-server-archives.py --check` to verify existing exports
without rewriting them. Explicit archive paths work in check mode too; an
unpatched or unfamiliar archive fails the check.
The immutable release recipe, game content, Windows launchers and preparation
script remain byte-identical. CI runs the same step before staging and checksums.

Unix server recipients need Python 3 in addition to Java and empack. The helper
hands the terminal to its process group before replacing itself with Java; the
runtime lease and process-tree supervision remain active. It skips terminal work
when stdin is not a TTY and does not take the terminal from an unrelated foreground
job. Windows and Modrinth installations do not use this helper.

Remove this packaging step only after an empack upgrade passes real terminal
input, Ctrl-C and shutdown checks. The patcher deliberately rejects unfamiliar
launcher templates rather than silently accommodating an upstream change.

The `create_skyweave` pack identity starts a distinct consumer lineage. Existing `create_sky` instances and saves are not converted or synchronized by this release. Install a fresh instance for the renamed registry identities.
