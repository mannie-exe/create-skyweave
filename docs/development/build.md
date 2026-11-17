# Build and release maintenance

Use empack **0.8.6-beta** and Java **21** from the repository root. Author manifests use schema 6 with `runtime.java.preferred: 21`; locks use schema 3 and retain the resolved `java-policy`. Bindings remain schema 1. Regenerate metadata with the native engine and review exact selected files, placement and policies; do not translate old locks by changing their schema number. Builds use the recorded lock and explicit distribution profiles. They do not update installed clients or servers.

## Source layout

| Path | Owner of the setting |
| --- | --- |
| `empack.yml` | Pack version, runtime, dependency intent and distribution profiles |
| `empack.lock` | Resolved content and hashes |
| `empack.bindings.yml` | Selected files, names and placement |
| `overrides/common/` | Shared authored configuration |
| `authoring/` | Journal, model/texture authoring, visual inputs, and configuration register |
| `resource-patches/` | Shared gameplay data, translations, and resource-only mod metadata |
| `overrides/client/` | Client-only content and shader presets |
| `templates/` | Prism memory and Java arguments, and server properties |
| `web/` | Internal map and journal editor; excluded from pack payloads |
| `tools/shader-lab/` | Pinned shader inputs and shared-engine author builds |
| `docs/players/` | Player and server-owner instructions |
| `docs/development/` | Maintainer procedures and dated evidence |
| `docs/RELEASE_NOTES.md` | Notes consumed by release CI |

Generated JARs and archives are ignored by Git. Both resource builders accept `--check` and preserve existing output timestamps when the bytes are unchanged. Keep worlds, credentials, server lists, raw logs and machine-specific paths out of distributed overrides.

The root `.gitignore` adapts Toptal templates for macOS, Windows, Linux, common editors and Python tools. `web/.gitignore` adds Node, Astro and extracted game data. Shared editor settings, dependency locks, `web/src/lib/` and Minecraft tag files remain trackable; generated assets and local credentials stay ignored.

## Installed pack identity

`empack.yml` owns the pack ID and release version. `scripts/build-resource-patches.py` reads empack's native build explanation and stamps an in-memory copy of `META-INF/neoforge.mods.toml`; it never rewrites the authored metadata. Resource Patches keeps mod ID `skyweave_resource_patches`, its own version `0.1.0`, stable filename, dependencies and other properties.

The generated `[modproperties.skyweave_resource_patches]` table contains integer `"skyweave:identity-schema" = 1`, `"skyweave:pack-id" = "create_skyweave"`, and string `"skyweave:pack-version"`. Versions are bounded single-line ASCII tokens, at most 128 characters. Normal local builds and branch validation stamp `DEV`. An explicit `--release-tag v<manifest-version>` validates the tag and current lock before preparation, then stamps the complete manifest version. The tag cannot supply a different version; an authored duplicate property owner is refused. Use the same mode with `--check`.

Use `python3 scripts/build-pack.py` for supported local exports. It prepares the DEV resource JAR, builds the selected native profiles and inspects the JAR actually delivered inside each export. Use `python3 scripts/build-pack.py --release-tag v<manifest-version>` for a release-mode build; repeatable `--profile` arguments select native profiles. Raw empack consumes prepared files and does not run this identity preparation automatically. The CI helper calls the same orchestration, and release CI validates/stamps its explicit tag before the other maintained-resource steps. Missing, stale, duplicated or mismatched exported identity stops publication.

The same wrapper prepares the pinned resource-pack option repairs before exporting. Their generated client ZIPs retain the selected pack filenames; explicit client overrides replace the original provider files in client exports. Keep the original source archives intact and run `python3 scripts/build-resource-pack-repairs.py --check` when checking prepared content. See [resource repair maintenance](patches.md#held-item-resources) for update and removal conditions.

Compat's client-only footer combines this installed pack baseline with Compat's actual loaded version. A modified installation keeps its baseline identity; missing or invalid properties select the standalone Compat label. Resource/language reload uses native branding-cache invalidation. Pack identity is presentation metadata and does not change terrain identity, server policy or early loading screens. Recheck NeoForge/FML properties, branding/ModernFix composition, empack explanation/recipe formats and all three exports when their dependencies change.

Empack's pack name is the portable **Create - Skyweave**, while `templates/client/instance.cfg.template` supplies the canonical Prism display name **Create: Skyweave**. The [naming policy](../../AGENTS.md#naming-and-artifact-identity) owns restricted-character fallbacks; display changes do not rename the pack ID or existing instance folder.

## Editable installation defaults

`empack.bindings.yml` marks `icon.png`, `options.txt` and the authored shader preset TXT files as `seed`: initial installation writes the default, while later preparation preserves edits. Prism rewrites `icon.png` before its pre-launch hook. Server properties come from the server template and remain installation-local. When a visual pack filename changes, update only its matching saved resource-pack ID during an authorized stopped-client sync; seeded `options.txt` will not replace an existing player's selection. Preserve the rest of the list, its order, and other player settings. Generated FTB definitions and frozen Questlog resources have exact `managed` policies. FTB source generation rejects external definition edits before replacing outputs; native world/team progress is separate. See [quest maintenance](journal.md) for source ownership and update checks.

## Existing reference installations

`empack instance install` updates owned game files and installed state. The reference archive's bootstrap snapshot and launcher files have a separate owner. Refresh the verified `release.json` and its content-addressed `assets/` together: under `.minecraft/.empack-consumer/` for Prism, and at the instance root's `.empack-consumer/` for the server. A new installed version alongside an old bootstrap snapshot is inconsistent.

Update Prism's pre-launch digest and the server install scripts to that same published payload. Preserve local executable paths, memory/Java preferences and other host settings when updating launcher files. Do not extract the entire archive over a playing installation or replace seeded preferences as a shortcut. Use the consumer install preview and deliberately reconcile any seed-to-managed transitions against the configuration register. Conflict-choice arguments use release destinations such as `config/example.toml`, without the `.minecraft/` or `game/` display prefix.

With Minecraft stopped, run preparation through the installed bootstrap recipe and exact digest. Use `empack pending list`, `pending show`, `pending resume` or `pending discard` for durable unfinished operations. Preparation is `instance ensure`; a completed update should have no pending managed-file changes or downloads. Verify the selected JAR and runtime, then start normally. Launcher bootstrap refresh does not authorize a world reset or a generation-marker edit.

## Local builds

After editing dependency intent, synchronize and materialize the selected files, then rebuild maintained resources and build all supported exports:

```sh
python3 tools/shader-lab/build.py
python3 -m unittest discover -s tests -v
python3 scripts/generate-quests.py --check
python3 scripts/audit-changes.py
python3 scripts/build-resource-patches.py
empack status
empack sync --materialize --yes
python3 scripts/build-visual-patches.py
python3 scripts/build-resource-pack-repairs.py
python3 scripts/build-pack.py --profile prism --profile modrinth --profile server
```

The [shader lab](../../tools/shader-lab/README.md) qualifies all three recipes through Compat's shared Java engine. Authoring/CI builds materialize exact inputs and produce complete review ZIPs; exports reference original shader/payload inputs in `shader-inputs/` and include the managed recipes. The client generates its finished ZIPs before Iris opens them. Complete merged shaders are not published as pack assets or simultaneously managed by empack. Euphoria and Colorwheel retain their runtime roles. The lab owns recipe and input update procedures.

The defaults build reference Modrinth, Prism and server archives under `dist/`. Prism and server references include a Java bootstrap that acquires and verifies the exact empack 0.8.6-beta engine before preparation and launch; recipients need Java, not a global empack installation or Python. Modrinth-compatible launchers handle the `.mrpack` downloads. Authored files remain included, and empack includes prepared server-runtime assets. Check content sources and installation as well as archive integrity.

The shared resource builder excludes Finder/AppleDouble and Windows desktop metadata while retaining authored assets. Archives use stable ordering and publication avoids rewriting unchanged output. Verify generated archives before release; source-directory cleanliness alone does not prove archive cleanliness.

Local edits can change an export without changing its filename. Use the published release's checksums to identify released bytes; a local rebuild is not a substitute for verifying downloaded release assets.

`authoring/visual-patches.json` pins the archive inputs for the client model patch. `build-visual-patches.py` checks selected empack versions for installed inputs and SHA-512 hashes for all archives, then writes `skyweave-visual-patches-0.1.0.zip` in client overrides. It combines four Crops plants with Fresh Flower Pots and includes enabled model-authoring recipes and compatibility adapters. Approved texture inclusion comes from `authoring/texture-resources.json`; the same generator supplies the web preview and shipping PNGs, with approval fingerprints checked before publication. `authoring/resource-selections.json` adds approved per-feature donor models and the Fresh chest composition. Source-only archives remain outside the enabled resource stack; required donor textures and licenses are copied into the generated ZIP. [Model authoring](web/models.md) owns extrusion and artwork-fitting controls. Keep this generated pack above its inputs. Unknown versions or model structures stop generation for review; follow the [update procedure](patches.md#update-sequence). CI runs the same generator, downloading exact inputs when they are not materialized.

### Copycat renderer

[Copycat Bar Extrusion](https://github.com/mannie-exe/copycat-bar-extrusion) is a client-only URL dependency pinned by release and SHA-1/SHA-512 in `empack.yml`. Empack materializes it like the other referenced mods; clean CI needs no local source checkout or hand-copied override. Do not keep another copy in client overrides.

Its source repository owns the Java 21 Gradle build, exact Create artifact check, transform tests and native rendering evidence. Review that hook before upgrading Create. The [compatibility guide](compatibility.md#visual-compatibility-pass) identifies the tested JAR and limits; no server installation or saved-data migration is needed.

### Terrain and rendering mods

[Skyweave: Compatibility Patches](https://github.com/mannie-exe/skyweave-compat) owns optional terrain, gameplay, and rendering adapters and belongs on both pack sides. It incorporates the former Veil Iris Fix; do not include that standalone JAR or Sky Village Neighbors in any payload. Runtime code does not belong in the resource-only `skyweave-resource-patches` JAR.

Publish and verify Skyweave: Compatibility Patches before updating its URL and digest pins in `empack.yml`. Use empack to regenerate bindings and the lock; inspect exports for duplicate or obsolete JARs. `overrides/common/config/skyweave/skyweave_compat-features.properties` explicitly selects the pack's adaptations. Unknown feature keys fail startup, so review this file whenever removing or renaming upstreamed adapters. The local configuration sidebar edits this same file for next startup; existing keys and omitted defaults remain authoritative. Review Skyweave: Compatibility Patches’ [editor maintenance](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/configuration.md) when updating its configuration facilities.

Remove retired dependencies with `empack remove`, then inspect the lock and exports. Deleting an intent entry and running `sync` can retain its previous selection. If URL dependencies lack metadata, review the removal plan before acknowledging unknown dependency evidence; `--forget` deliberately retains installed content.

The mod itself requires no content mods. The pack deliberately installs Sky Archipelago and enables its expanded preset. Geometry remains in `skyweave_compat-generation.json`; village tuning remains in `skyweave_compat-common.toml`. Structure-family defaults belong to Compat’s `skyweave_compat-structures.json`; [structure policy](structures.md#cluster-discoveries) explains its native exceptions and update checks. Client defaults and the server template select `skyweave_compat:islands_v1` only for new worlds. Distributed seeds remain blank.

For development, use a marked disposable empack workspace with local JAR inputs and the same three reference profiles. Never publish local-input manifests or install changed generation into existing play saves.

### Distant Horizons updates

Keep DH and Skyweave: Compatibility Patches' supported version pins aligned. Before updating either, review Skyweave: Compatibility Patches' [DH hooks](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/lod.md) and the separate DH Polygon Fix implementation. Shader behavior also depends on Iris, Complementary/Euphoria and Skyweave: Compatibility Patches’ optional rendering adapters; a successful terrain-generation check does not establish renderer compatibility.

SeedGen is excluded. Do not add native worker inputs, prediction settings or seed sharing to distributed defaults. Preserve existing world and LOD cache identities when syncing an authorized update. Preserve explicit cache-isolation choices: selecting a new key does not migrate old client data, even though stable adaptations default on in new installations.

### Generation profiles

Geometry, interiors, water and ocean profiles are shared authored JSON files in `overrides/common/config/`. Keep them together with the qualified artifact and their categorized audit baselines. New terrain must use a fresh world; the saved generation marker is not a migration switch.

Skyweave: Compatibility Patches’ verification guide owns adapter loading, terrain, and rendering evidence. Historical standalone Ponder checks do not establish native rendering behavior for a new combined artifact; retain pending interactive checks explicitly. [Patch maintenance](patches.md) owns coupled updates and removal criteria.

## Server webmap

BlueMap is an exact Modrinth dependency with `side: server`. Its authored defaults live in `overrides/server/config/bluemap/`; both the JAR and config must be absent from Prism payloads and client requirements. Modrinth archives use server-only file metadata and server overrides. Check the resulting archives after dependency changes.

BlueMap configuration uses empack's `seed` policy to preserve operator settings, including download acceptance, ports and map definitions. Fresh installs leave resource-download consent to the owner. The default Overworld map has no X/Z limits and includes the complete Skyweave: Compatibility Patches vertical range. New local defaults do not replace existing seed files automatically; review and apply intended changes separately. See [server webmap setup](../players/server.md#webmap).

Skyweave: Compatibility Patches optionally adapts the BlueMap 5.7 browser viewer on dedicated servers. `overrides/server/config/skyweave/skyweave_compat-bluemap.json` selects `world`; its seed policy preserves operator edits. Other maps retain the stock renderer. The adapter uses actual world bounds, extends detailed rendering with bounded loading, and clips empty-edge triangles in the finest overview layer. It does not change generation, DH data or stored tiles. Keep full-height map bounds and cave culling disabled to retain island undersides in detailed tiles. Coarse overview layers remain height fields: distant stacked terrain and undersides are not fully represented, and coarse sheets can remain visible from below. The adapter's configuration and update checks are owned by Skyweave: Compatibility Patches' `docs/development/bluemap.md`.

## Dependency updates

Use [dependency and patch maintenance](patches.md) for coupled versions, URL pins, resource overrides and required update checks. `empack update --all --json` previews provider candidates without applying them; it does not validate gameplay or replace exact-artifact review. For pinned provider updates, unpin only the reviewed keys, run `update` with their retained required dependents, then pin the resulting selections and materialize. Review the selected release policy: `prefer-stable` can choose an older stable release on a previously selected beta line. Confirm exact version IDs afterward.

Ponder's explicit upstream Maven URL is valid in the referenced archives, but Modrinth hosting does not allow that download domain. GitHub distributions remain the publication target; review hosting eligibility before any Modrinth upload.

## Release procedure

1. Review the unreleased notes and required checks in [patch maintenance](patches.md). Update `pack.version` in `empack.yml` and write `docs/RELEASE_NOTES.md` for that version; archive the previous published notes under `docs/releases/`. Keep unreleased behavior distinct from published behavior in guides.
2. Synchronize and build all three profiles. Inspect client/server mod placement, shader presets, configuration and archive integrity. Run the relevant runtime checks from [verification](compatibility.md#verification-scope).
3. Record checks, tested versions and limitations in the relevant verification guide. Update [decisions](decisions.md) only when policy changes. Commit and push the reviewed source.
4. After content commits, run `git-cliff --tag v<version> --output CHANGELOG.md` with git-cliff 2.14.2. Review the generated history, then commit it with the version and notes as `chore(release): <version>`. Push the matching `v<version>` tag to trigger publication.
5. Wait for validation and release jobs. Download the published assets, verify `SHA256SUMS`, and check the critical payloads before announcing the release.

Publishing is a separate action from editing or building. Tag only when the release is prepared and publication is authorized.

## CI maintenance

The pack validation and release workflows select `modrinth`, `prism` and `server`, use Temurin 21, and pin GitHub Actions to commits. `.github/scripts/empack-ci.py` comes from the empack scaffold, reviewed against `v0.8.6-beta` at `a709c854`, with project-specific pack-identity verification, release notes, title and filename normalization. Its build-explanation check expects schema 2.

The helper verifies the downloaded empack binary against GitHub's asset digest, rejects stale locks and tag/version mismatches, and stages only the outputs named by `build --explain --json`. It normalizes filenames before hashing and publishes a draft only after uploads succeed. Published names use hyphens for spaces, such as `Create-Sky-0.1.7-prism-references.zip`.

Both pack workflows rebuild maintained resources before packaging. The separate web workflows run from `web/`; [web setup](web/setup.md) describes their checks and deployment dry run. Pack profiles assemble `pack/`, `overrides/` and `templates/`, so the app and its local generated assets are outside their inputs.

Retain these choices when refreshing the scaffold:

- `cliff.toml` groups conventional commit history; release/merge commits are excluded. `CHANGELOG.md` is the generated repository history; `docs/RELEASE_NOTES.md` owns the player-facing summary and archived notes retain that context.
- Release checkout fetches full history. The pinned git-cliff action/tool generates the latest tagged section and appends it to the authored summary in a temporary file. `EMPACK_RELEASE_NOTES` passes that file through `--notes-file`. This follows empack's own GitHub workflow; git-cliff is not an empack CLI command.
- All three reference profiles are selected through `build.default`; CI uses that default.
- Prism overrides memory to 512 MiB minimum and 8192 MiB maximum.
- Prism defaults to Java 21 Generational ZGC through `OverrideJavaArgs=true` and `JvmArgs=-XX:+UseZGC -XX:+ZGenerational`; retain player overrides in existing installs.
- Servers enforce the whitelist and create Sky Islands worlds.
- Checkout credentials are not persisted.

Windows server launchers support `EMPACK_NO_PAUSE=1` for unattended tests. A successful build verifies packaging; it does not establish gameplay or GPU compatibility.

## Maintained resources

`resource-patches/` contains Skyweave: Resource Patches, including journal client assets. Rebuild it before exporting. The generated JAR is an ignored build artifact; its source files are maintained. Quest definitions ship from common config and client presentation settings ship from client config. See [journal authoring](journal.md).

Visual Patches metadata and icon are authored in `authoring/visual-patches/pack.mcmeta` and `authoring/visual-patches/pack.png`. Both enter the builder's source-change checks. Minecraft 1.21.1 resource packs use format 34; their supported metadata describes the pack but does not replace the filename-derived title in the pack list. Keep the archive filename stable unless its saved resource-pack selection is deliberately updated.

Product images have separate editable sources:

| Product or surface | Source | Consumer |
| --- | --- | --- |
| Compatibility Patches | `skyweave-compat/src/main/resources/logo.png` in its sibling repository | NeoForge mod-list logo, declared in that mod's metadata |
| Resource Patches | `resource-patches/pack.png` | NeoForge mod-list logo, declared in the resource JAR's metadata |
| Visual Patches | `authoring/visual-patches/pack.png` | Generated resource-pack ZIP's root `pack.png` |
| Modpack | `templates/client/icon.png` | Prism export's root icon; source for future publishing uploads |
| Game window | `overrides/client/icon.png` | Seeded game-root icon; Prism may replace this copy at launch |

These are opaque, plain-white indexed PNG placeholders, with lossless compression. Resource and Visual Patches may use matching artwork while retaining independent files. Replace the owning image, then rebuild its artifact; do not edit generated archives. The modpack's Prism icon key is `create-skyweave`; importing another pack must not overwrite a generic shared icon key. Existing launcher selections remain local. Publishing icons are not uploaded automatically by the release workflow; use the modpack source when a publishing integration is added.

## Native bootstrap and terminal ownership

Reference exports contain `.empack-tools/empack-bootstrap.jar`, `prepare.json` and `launch.json` outside the game payload. The invocation records select the exact exporting engine, bind the release digest and distinguish preparation from launch. Prism uses its selected `$INST_JAVA`; server scripts use `JAVA_HOME` or PATH Java. The bootstrap checks a matching local engine, its private cache and then the official release, without following a latest-version pointer or changing a global installation. Its UTF-8 setting applies only to its own JVM; preserve the game's authored Java arguments.

Keep the generated JAR, invocation records, scripts and immutable release assets together. Refresh these launcher files when changing the selected engine; installing game content alone does not rewrite them. Old launchers and native release schemas are not an interoperability path: reimport the current reference distribution, preserving only reviewed installation-local settings and authorized saves.

Empack owns Unix foreground process-group transfer, console input, interrupt forwarding and terminal restoration. No pack-specific Python wrapper or archive rewriting step remains. Qualify terminal input, Ctrl-C and clean shutdown through the generated bootstrap when updating empack; archive inspection alone does not establish console behavior.
