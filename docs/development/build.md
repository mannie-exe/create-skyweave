# Build and release maintenance

Use empack **0.8.2-beta** and Java **21** from the repository root. Builds use the
recorded lock and explicit distribution profiles. They do not update installed
clients or servers.

## Source layout

| Path | Owner of the setting |
| --- | --- |
| `empack.yml` | Pack version, runtime, dependency intent and distribution profiles |
| `empack.lock` | Resolved content and hashes |
| `empack.bindings.yml` | Selected files, names and placement |
| `overrides/common/` | Shared authored configuration |
| `authoring/` | Journal source and categorized configuration register |
| `overrides/client/` | Client-only content and shader presets |
| `templates/` | Prism memory and Java arguments, and server properties |
| `web/` | Internal map and journal editor; excluded from pack payloads |
| `docs/players/` | Player and server-owner instructions |
| `docs/development/` | Maintainer procedures and dated evidence |
| `docs/RELEASE_NOTES.md` | Notes consumed by release CI |

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
come from the server template and remain installation-local. Generated Questlog
definitions have exact `managed` policies so journal edits and removals apply on
updates. See [journal updates](journal.md#update-checks) for older seeded definitions.

## Local builds

After editing dependency intent, synchronize and materialize the selected files,
then rebuild maintained resources and build all supported exports:

```sh
python3 scripts/generate-journal.py --check
python3 scripts/audit-changes.py
python3 scripts/build-fixes.py
empack status
empack sync --materialize --yes
python3 scripts/build-resource-patches.py
empack build --profile prism --profile modrinth --profile server --yes --optional-defaults
python3 scripts/patch-server-archives.py
```

The defaults build reference Modrinth, Prism and server archives under `dist/`.
Prism and server recipients need empack 0.8.2-beta on `PATH`; the generated hooks
prepare and verify exact files before launch. Modrinth-compatible launchers handle
the `.mrpack` downloads. Authored files remain included, and empack includes prepared
server-runtime assets. Check content sources and installation as well as archive integrity.

Local edits can change an export without changing its filename. Use the published
release's checksums to identify released bytes; a local rebuild is not a substitute
for verifying downloaded release assets.

`authoring/resource-patches.json` pins the archive inputs for the client model patch.
`build-resource-patches.py` checks their selected empack versions and archive
SHA-512 hashes, then writes `Create Sky Resource Patches.zip` in client overrides.
It combines four Crops plants with Fresh Flower Pots, restores Macaw's chain
texture bindings, and includes enabled model-authoring recipes and compatibility
adapters. The models reference existing textures. [Model authoring](web/models.md)
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

[Create Sky Compat](https://github.com/mannie-exe/create-sky-compat) owns optional
terrain, gameplay, and rendering adapters and belongs on both pack sides. It
incorporates the former Veil Iris Fix; do not include that standalone JAR or Sky
Village Neighbors in any payload. Runtime code does not belong in the resource-only
`create-sky-fixes` JAR.

Publish and verify Compat before updating its URL and digest pins in `empack.yml`.
Use empack to regenerate bindings and the lock; inspect exports for duplicate or
obsolete JARs. `overrides/common/config/create_sky_compat-features.properties`
explicitly selects the pack's adaptations. Unknown feature keys fail startup, so
review this file whenever removing or renaming upstreamed adapters. The local
configuration sidebar edits this same file for next startup; existing keys and
omitted defaults remain authoritative. Review Compat’s
[editor maintenance](https://github.com/mannie-exe/create-sky-compat/blob/main/docs/development/configuration.md)
when updating its configuration facilities.

Remove retired dependencies with `empack remove`, then inspect the lock and exports.
Deleting an intent entry and running `sync` can retain its previous selection.
If URL dependencies lack metadata, review the removal plan before acknowledging
unknown dependency evidence; `--forget` deliberately retains installed content.

The mod itself requires no content mods. The pack deliberately installs Sky
Archipelago and enables its expanded preset. Geometry remains in
`create_sky_compat-generation.json`; village tuning remains in
`create_sky_compat-common.toml`. Client defaults and the server template select
`create_sky_compat:islands_v1` only for new worlds. Distributed seeds remain blank.

For development, use a marked disposable empack workspace with local JAR inputs
and the same three reference profiles. Never publish local-input manifests or
install changed generation into existing play saves.

### Distant Horizons updates

Keep DH and Compat's supported version pins aligned. Before updating either,
review Compat's [DH hooks](https://github.com/mannie-exe/create-sky-compat/blob/main/docs/development/lod.md)
and the separate DH Polygon Fix implementation. Shader behavior also depends on
Iris, Complementary/Euphoria and Compat’s optional rendering adapters; a successful
terrain-generation check does not establish renderer compatibility.

SeedGen is excluded. Do not add native worker inputs, prediction settings or seed
sharing to distributed defaults. Preserve existing world and LOD cache identities
when syncing an authorized update. Opt-in cache isolation requires an explicit
operator decision because selecting a new key does not migrate old client data.

### Generation profiles

Geometry, interiors, water and ocean profiles are shared authored JSON files in
`overrides/common/config/`. Keep them together with the qualified artifact and
their categorized audit baselines. New terrain must use a fresh world; the saved
generation marker is not a migration switch.

Compat’s verification guide owns adapter loading, terrain, and rendering evidence.
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
and includes the complete Compat vertical range. New local defaults do not replace
existing seed files automatically; review and apply intended changes separately.
See [server webmap setup](../players/server.md#webmap).

Create Sky Compat optionally adapts the BlueMap 5.7 browser viewer on dedicated
servers. `overrides/server/config/create_sky_compat-bluemap.json` selects `world`;
its seed policy preserves operator edits. Other maps retain the stock renderer.
The adapter uses actual world bounds, extends detailed rendering with bounded
loading, and clips empty-edge triangles in the finest overview layer. It does not
change generation, DH data or stored tiles. Keep full-height map bounds and cave
culling disabled to retain island undersides in detailed tiles. Coarse overview
layers remain height fields: distant stacked terrain and undersides are not fully
represented, and coarse sheets can remain visible from below. The adapter's
configuration and update checks are owned by Create Sky Compat's
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
4. Push the matching `v<version>` tag to trigger publication.
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

- `EMPACK_RELEASE_NOTES` points to `docs/RELEASE_NOTES.md` and uses `--notes-file`.
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

`pack-fixes/` contains the resource-only fixes mod and journal client assets.
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
