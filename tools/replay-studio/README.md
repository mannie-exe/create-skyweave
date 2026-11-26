# Replay Studio

Replay Studio is a separate empack project for recording, editing, and exporting Create: Skyweave footage. It inherits the playable pack's exact content, world generation, shaders, resource packs, controls, and compatibility fixes. It does not install into DEV or share a writable game directory with it.

The modpack release includes a separate Replay Studio Prism ZIP and its checksum alongside the playable distributions. Import it as a new instance; keep editing projects and filming worlds with that installation.

## Build a snapshot

From the repository root, with empack, Python, and PyYAML available:

```sh
empack sync --materialize --yes
python3 scripts/build-pack.py --profile prism
uv run --with PyYAML==6.0.3 python tools/replay-studio/build.py
uv run --with PyYAML==6.0.3 python tools/replay-studio/build.py --check
empack --workdir tools/replay-studio check
```

Prepare the parent through its normal wrapper first so Studio inherits the maintained resources and repaired visual inputs. Studio refuses a missing or incorrectly stamped parent Resource Patches JAR. Release automation passes `--release-tag v<parent-version>` after building the parent in release mode. Studio keeps its own consumer version while inheriting the parent's resource identity; the exporter verifies both identities and the exact carried JAR before staging it for publication.

`--prepare-only` refreshes derived authoring files without acquiring dependencies or exporting. The builder reads the root manifest, lock, bindings, authored overrides, and client templates. It keeps exact transitive selections and their content types. `empack.yml`, `empack.bindings.yml`, and `empack.lock` retain the Studio snapshot; generated overrides and local artifacts remain ignored. Update the root pack deliberately, then regenerate Studio. Do not independently update Studio's providers to different versions.

On first preparation, the builder copies the root authoring baseline and asks empack to remove the excluded providers. This retains exact provider evidence and records the participation change through empack. Native descriptor checks precede the removal; empack's separate warning about unknown provider relationships remains visible. empack owns subsequent reconciliation and materialization; do not hand-edit its lock. Local-only parent artifacts, including the qualified Lootr: Styled candidate, remain local-only here as well. A Studio snapshot does not make them public releases.

The Prism export uses reference delivery and snapshot updates. Import the whole ZIP into a new Prism instance, or preserve the entire exported launcher layout before using empack's `instance install` with `--layout prism` and the embedded release's verified SHA-256. Keep **both** `.empack-tools/` and `.minecraft/.empack-consumer/` in the instance: its pre-launch command needs the consumer release and assets even after game files are installed. Copying only the game files, `instance.cfg`, and launcher helpers leaves an incomplete bootstrap. Verify the actual pre-launch command as well as `instance check`. Do not merge it over a playing instance.

## Rendering choices

`selection.json` owns the excluded dependencies and configuration paths. Studio excludes Dynamic FPS, C2ME, EntityCulling, MoreCulling, ImmediatelyFast, ModernFix, Lithium, FerriteCore, and Sodium Extra. BlueMap is omitted because it is a dedicated-server service.

Sodium and Iris remain because the selected shader/Colorwheel stack requires them. Flywheel remains part of Create. EMF, ETF, Modefite, the animation stack, dynamic lighting, DH, and the visual correctness adapters retain their content roles. Studio disables Sodium's optional entity, fog, and block-face culling shortcuts and visible-only texture animation, Flywheel's distance-limited updates, and EMF's distance and shadow-pass animation skipping. Ordinary engine frustum/depth tests and mandatory renderer internals remain; this is not a replacement renderer with every optimization removed.

Flashback starts with zero extra dummy frames and AAC audio. Dummy frames render before **every saved frame**; eight multiplies the scene-render count by nine. They can help temporal shader effects, but do not guarantee complete chunk loading. The installed Flashback audio writer's Opus sample-format incompatibility is avoided by AAC. Export preferences remain player-owned after the initial installation.

Dynamic FPS 3.11.4's NeoForge renderer can skip Flashback's manually requested export draws while unfocused or hidden. Flashback clears its target before drawing, so skipped draws can be encoded as black frames. The observed black export and installed code support that diagnosis; no controlled native reproduction has been run for Studio.

## Worlds and replay projects

The content and generation providers retain their root-pack versions. The build checks provider relationships and native required mod IDs, including nested JARs and the established Connector/FFAPI bridge. The removed optimizers do not intentionally remove gameplay content. These checks support expected world compatibility; they do not prove an actual saved-world load. World-load and render qualification are separate from these build checks.

Use **copies** of existing Skyweave worlds for filming. Keep their per-world configuration and generation identity. Do not use a new pack ID as permission to reset, convert, or regenerate a world. Native C2ME storage is replaced by ordinary chunk handling, but existing-world loading without that implementation still needs a native check. Studio does not copy worlds automatically.

Copy `flashback/replays/` and `flashback/editor_states/` together. The editor-state UUID links a replay to its camera tracks and scene edits. Copy project skins and other referenced custom assets when present; replay ZIPs alone are not complete editing projects. Never copy an active temporary recording or export staging folder as a completed replay.

Flashback records absolute DH data-directory references in replay metadata. Moving a replay does not embed distant terrain or make those databases independent. Preserve the referenced world/LOD data; copied replays can still refer to DEV's existing paths. Relocating those databases and qualifying safe ownership is a separate operation. Missing paths can remove distant scenery even when nearby replay chunks are present.

Photon retains the pack's unsupported-on-Apple limitation. Removing optimization mods does not establish support for a shader, moving machinery, or replay payload that was already unsupported.
