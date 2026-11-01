# Setup and maintenance

## Application tools

Run the commands in this guide from `web/` (`cd web` from the pack root).

The workspace targets macOS/Linux and a Minecraft 1.21.1 NeoForge installation.
Use `.node-version` for Node and `package.json#packageManager` for pnpm. `mise.toml`
pins the local Node/Python environment; Python 3.11 or later is needed by the
scripts. Java 21 must include both `java` and `javac` for runtime capture.

```sh
pnpm install --frozen-lockfile
pnpm setup:python
```

`setup:python` creates `.cache/python` and installs the pinned NumPy requirement.
It is needed for world sampling and Python tests. With mise and pnpm already
available, `mise install` followed by `mise run setup` runs the equivalent setup.
Java and Minecraft instances are configured separately.

## UI dependency updates

Astro, its React integration, React/React DOM and `@xyflow/react` are coupled.
Check their official documentation, peer ranges and Node requirements together;
keep runtime and type packages aligned in the lock. The item grid and authoring
controllers remain TypeScript, so a graph upgrade does not require converting
other pages to React. Keep `client:only="react"` graph islands browser-owned.

After changing these dependencies, run `pnpm verify`, the browser suite and a
private-data-free shell build. Check recipe nodes, fixed slots, narrow layouts,
minimap/keyboard navigation, focus/disclosures across culling, Back navigation,
and repeated graph visits. Compare representative loading and interaction costs;
do not assume a renderer upgrade improves performance. [Data](data.md) owns the
component and projection boundaries, and [verification](verification.md) owns results.

## Local paths

Defaults live in [`data/local.example.json`](../../../web/data/local.example.json).
Create ignored `data/local.json` to override any subset. Paths support `~`;
relative paths resolve from `web/`. The default pack path is `..`; the server
default is `../../create_sky-server/game`, beside the pack checkout. Override these
when using a different installation layout.

| Key       | Expected input                                                                                             |
| --------- | ---------------------------------------------------------------------------------------------------------- |
| `pack`    | Empack directory with `empack.lock`, materialized `pack/mods` and common overrides                         |
| `server`  | Installed server game directory with `mods`, `libraries`, accepted `eula.txt` and NeoForge `unix_args.txt` |
| `vanilla` | Minecraft 1.21.1 client JAR used for vanilla models and textures                                           |
| `java`    | Java 21 JDK `bin` directory                                                                                |

For example, a non-Prism installation can override just the client JAR:

```json
{
  "vanilla": "/path/to/minecraft-1.21.1-client.jar"
}
```

Run `empack sync --materialize --yes` in the pack directory before capturing
additions or removals. The exporter uses the complete locked server selection
from the pack, verifies its bytes, and checks maintained resource JARs before
capture. The configured server supplies the locked NeoForge libraries, accepted
EULA and copied configuration; its installed mod set need not be synchronized.
Use `python3 scripts/runtime.py --installed-mods` for an explicit comparison with
that installed set. Build maintained resources using the pack's own build guide.
The map does not install Minecraft, accept its EULA or synchronize play instances.

## First capture and refresh

```sh
pnpm data:refresh
pnpm data:check
pnpm dev
```

Open <http://127.0.0.1:4321>. `data:refresh` runs runtime capture, JAR extraction and
compilation in order. It requires Java 21 and the configured Minecraft inputs,
uses up to a 4 GiB Java heap, and allows ten minutes for the isolated server.
`data:check` exercises the current pack's recipe, loot, coverage and journal
assertions; it is intentionally specific to this pack.

The same refresh is available in Edit data. The plugin serializes authoring
operations, including reads that run validation or previews. Run one authoring
server per pack; it does not lock separate shell processes or other dev servers.
Do not run concurrent captures or command-line compiles while the editor is saving.
See [named jobs](#named-authoring-jobs) for process limits and cancellation.

World sampling is optional and has its own timestamp:

```sh
pnpm data:world
pnpm data:compile
```

This reads existing Overworld chunks under the configured server's `world/`.
For a consistent survey, use a stopped world or a consistent copy made while the
server was stopped. To select that copy without changing the configured server:

```sh
pnpm data:world --world /path/to/world-copy
pnpm data:compile
```

`--samples 0` scans every stored chunk; the default is four per region. Full scans
can take substantially longer. Metadata and region changes detected during a scan
are recorded, but an in-progress world read is not an atomic snapshot. No chunks
are generated and no world or LOD files are written. Keep new-world refreshes
pending while an unattended pregen is running; do not treat acceptance as completion.

New captures include the exact seed, dimension/generator identifiers and the
recorded Create Sky generation identity when present. Older captures lack that
identity and are labelled as legacy. Without a survey, the map omits terrain-derived
acquisition routes; explicit YAML gathering assumptions still apply.

For village placement and resources, use a separate disposable-world survey:

```sh
pnpm data:structures
pnpm data:compile
```

This refreshes runtime/assets, then tests four fixed seeds with six controlled
villages and 25 natural candidate cells per seed. Two valid natural starts per
seed are fully generated. It uses up to 6 GiB of Java heap and a 15-minute limit
per world. A shorter check is `pnpm data:structures --seeds 1 --samples 2
--natural-samples 1` (on one line). It requires the same installed server inputs
and accepted EULA as runtime capture. Do not run it alongside another capture.
Temporary worlds and server logs are removed on success or failure. The compact
`data/generated/structures.json` snapshot is retained; World & ores shows its
counts and limitations. This never opens or changes the playing world.

## Commands and checks

| Command             | Purpose and requirements                                                               |
| ------------------- | -------------------------------------------------------------------------------------- |
| `pnpm dev`          | Loopback development server with local editing endpoints                               |
| `pnpm data:runtime` | Isolated game export; Java and installed server required                               |
| `pnpm data:extract` | Asset/resource extraction; completed runtime capture and its audit config/log required |
| `pnpm data:compile` | Rebuild browser projection from existing evidence and authored YAML                    |
| `pnpm data:check`   | Check the current generated pack snapshot                                              |
| `pnpm verify`       | Formatting, JavaScript tests, Astro/TypeScript checks and static build                 |
| `pnpm test:python`  | Path resolution and Anvil reader tests; Python setup required                          |
| `pnpm test:browser` | Browser integration tests; populated snapshot and Playwright browser required          |
| `pnpm preview`      | Serve an existing static `dist/` build without editing endpoints                       |

`pnpm build` runs type checks before building; `verify` invokes it once. The root
[web CI workflow](../../../.github/workflows/web-ci.yml) runs
`verify` and the Python suite without Minecraft binaries or generated data.
A successful CI shell build does not verify a game snapshot.

Browser tests can use installed Chrome:

```sh
PLAYWRIGHT_CHANNEL=chrome pnpm test:browser
```

Alternatively, install Chromium with `pnpm exec playwright install chromium`,
then run `pnpm test:browser`. `mise run verify` combines app and Python checks;
browser and game-dependent checks remain explicit.

Browser tests start their own foreground dev server on port 4322 with
`--ignore-lock`. Keep that port free. The normal editor runs on port 4321;
tests do not reuse its potentially stale middleware. Restart a running normal
dev server after changing workspace middleware.

The [pack authoring editor](authoring.md) uses the configured pack's generator
and audit scripts. It requires no runtime export to edit journal source. After
changing `data/local.json`, reload source in the editor.

## Named authoring jobs

`scripts/jobs.mjs` owns the registry and process runner for web-launched Python.
Workbench handlers call a registered name with server-owned directory context;
requests cannot choose a program, shell command, script path or argument vector.
The registry records input validation, fixed arguments, working-directory role,
expected outputs, timeout, output cap and cancellation policy.

| Jobs                                                           | Inputs and output                                                                                                                 | Limits                                                    |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `journal.preview`, `journal.validate`, `journal.generate`      | No process inputs; read configured or temporary journal source; generate native quests and language resources only when requested | 30 s, 2 MiB                                               |
| `config.audit`, `config.validate`                              | No inputs; inspect the register or validate its temporary source copy                                                             | 30 s, 2 MiB                                               |
| `models.preview`, `models.validate`                            | Model document on stdin, at most 1 MB; return preview JSON or validation                                                          | 30 s; 8 MiB for preview, 2 MiB for validation             |
| `resources.generate`                                           | No inputs; generate the selected client resource ZIP                                                                              | 180 s, 2 MiB                                              |
| `snapshot.fingerprint`, `snapshot.capture`, `snapshot.extract` | No inputs; fingerprint or explicitly regenerate implementation evidence                                                           | 30 s for fingerprint, 660 s for capture/extraction; 2 MiB |
| `scenario.export`                                              | No inputs; export the validated recipe scenario                                                                                   | 30 s, 2 MiB                                               |

Activity shows complete user operations and up to 20 recent outcomes for the
development-server session. Reads and automatic previews do not replace them.
An active operation exposes its current named job, bounded diagnostics and Cancel
when supported. The subprocess runner still retains only its current and last job;
there is no persisted history or work queue. Audit exit code 1 means differences
were found and is returned as an audit result, rather than an execution failure.

Preview and validation jobs support cancellation on macOS/Linux. Cancellation or
timeout terminates the process group and escalates to KILL after 500 ms. Output
beyond the cap is discarded and stops the job. Jobs that write generated files do not offer Cancel:
interruption can leave partial generated output, particularly during capture or
multi-file journal generation. Resolve failures and rerun the owning generator.
These are trusted repository scripts, not a sandbox for arbitrary code.

To add a workbench process, add a registry entry, validate its inputs, specify its
outputs and limits, and call `jobs.run` from a protected workspace handler. Keep
revision checks and any source publication in that handler. Add execution/failure
tests and UI feedback; register its user-facing action in `scripts/operations.mjs`
when it needs an Activity result. Quiet reads and previews stay out of history.
Avoid another `spawn` or `execFile` wrapper. To remove a
job, remove its callers, registry entry and applicable tests/docs together.
Restart `pnpm dev` after changing the registry or middleware. Restart it also if
a newly generated public file exists on disk but returns 404: generated paths are
excluded from the watcher to protect editor drafts, and Vite can retain its earlier
public-file index. Save drafts and wait for named jobs to finish before restarting.

Saving source, generating output and installing into Minecraft remain distinct.
After generation, reload another open view if it uses the changed files. Direct
YAML edits still need `pnpm data:compile`; the graph's Reload data button
only rereads existing browser JSON. It does not capture or compile anything.

## Output and cleanup

| Location                                                               | Lifecycle                                                                   |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `data/authored/`, `tools/`, `scripts/`, `tests/`                       | Maintained source; retain                                                   |
| `data/generated/`                                                      | Ignored evidence and survey snapshots; retain while their claims are needed |
| `public/generated/`                                                    | Ignored browser JSON, textures and optional recipe export; rebuildable      |
| `.cache/audit-server`, `.cache/exporter-classes`, `.cache/runtime.log` | Disposable capture outputs; retain until extraction and diagnosis finish    |
| `.cache/python`                                                        | Local Python environment; recreate with `setup:python`                      |
| `dist`, `.astro`, `.wrangler`, `test-results`, `playwright-report`     | Build/tool/run outputs; disposable when not in use                          |

Do not hand-edit generated snapshots. Removing `public/generated` also removes
textures; `data:compile` alone cannot recreate those. Use a full refresh after
cleaning capture dependencies. Retain evidence while it supports a documented claim; remove redundant run output.

## Deployment preparation

The application is not deployed. The root
[web deployment workflow](../../../.github/workflows/web-deploy.yml) is manual and only
builds the empty application shell and runs Wrangler's dry run. `wrangler.toml`
configures static assets with no route, account or domain, and disables public
Workers and preview URLs. There are no editing endpoints in the static output.

A local build includes whatever is currently in `public/generated`, including
source records and extracted assets. Before any future publication, select the
snapshot and access policy and review asset rights and exposed source/config data.
`pnpm deploy` is an actual publication command; it is not part of setup or CI.

## Diagnosis

| Failure                                    | Check                                                                                  |
| ------------------------------------------ | -------------------------------------------------------------------------------------- |
| Empty map on fresh checkout                | Configure inputs and run `data:refresh`                                                |
| Vanilla client JAR missing                 | Set `vanilla` in `data/local.json`                                                     |
| Java compile or server startup failure     | JDK 21, installed NeoForge libraries, pack/server alignment and `.cache/runtime.log`   |
| Missing `complete.json`                    | Capture failed; resolve the log error and repeat refresh                               |
| Missing audit config/log during extraction | Run `data:refresh` to recreate its inputs                                              |
| World view has no survey                   | Run `data:world`, then `data:compile`                                                  |
| YAML revision conflict                     | Reload from disk and reapply the intended edit                                         |
| Recipe scenario rejected in game           | Inspect the target mod's codec; YAML validation cannot validate arbitrary game recipes |

[Data pipeline](data.md) owns implementation behavior and source limitations.
[Verification](verification.md) owns actual check results.

## Optional generation comparison

`pnpm data:runtime --worldgen` adds the maintained Sky Archipelago probe. It reads
only the configured server world's `level.dat`, decodes the seed and generator,
and compares native spacing, island descriptors and column profiles without
opening that world. The normal disposable flat audit server still runs. The
receipt stores a seed hash, not the playing seed. It compares the original
DYNAMIC 32 to 1500 configuration with its seed-equivalent CONSISTENT value.

This probe targets the installed Sky Archipelago 1.3.6 API, including a reflected
private method. Revalidate it after upgrades. It does not generate Sky Archipelago
chunks, validate structures, or replace a world survey. A normal capture without
`--worldgen` does not refresh this optional receipt; check its version and input provenance before using it as current evidence.

## Refresh resource-pack reviews

Edit judgments in `data/authored/resourcepacks.yml`; update dated evidence in
`data/research/resourcepacks/`. This is a manual research snapshot, not an
installation queue or automatic scraper. Recheck the linked catalogs and project
pages, choose an exact Minecraft 1.21.1 file, and compare its published SHA-512
with the downloaded bytes before recording inspection evidence.

To collect selected existing test media, edit `local-media.json` in that research
directory and run `pnpm media:collect`. The equivalent allowlisted job is
`resources.media` (no inputs; 30-second limit). Original archives stay in place;
changed hashes fail rather than overwrite files. Restart the dev server after new
captures are copied. See [media ownership](data.md#resource-pack-research).

Use a temporary directory under `.cache/resourcepacks` for downloaded archives:

```sh
python3 scripts/inspect_resourcepack.py .cache/resourcepacks/candidate.zip \
  --format 34 --fusion --compare .cache/resourcepacks/baseline.zip
```

Repeat `--compare` for each installed baseline. Omit `--fusion` when the target
client lacks Fusion; check the pack's minimum Fusion version separately. The
inspector prints JSON without extracting files or modifying an instance. Preserve
source URLs, exact file metadata, inspection output and review date in the research
data. Recheck installed-JAR asset matches when changing that evidence; the CLI's
overlap comparison only covers the archives supplied to it.

Use images from the author's project gallery, label them as source images, and
check the thumbnail and full-size URLs. A source gallery is not an in-pack render
test. Research data changes reload the page during `pnpm dev`. Generated map data and
scenario-editor domains stay excluded from automatic reloads to protect drafts. Run
`pnpm verify`, `pnpm test:python` and `PLAYWRIGHT_CHANNEL=chrome pnpm test:browser`.
Remove temporary downloads and browser output after recording results in
[verification](verification.md).
