# Server setup and maintenance

Use the server archive from the same Create: Skyweave release as your clients.

New server templates set `allow-nether=false`. This blocks ordinary native Nether
portal travel but does not remove the dimension, prevent portal ignition or
configure singleplayer. The complete Compat access policy is planned; existing
server properties remain installation-local until explicitly changed. Do not
delete Nether world files to apply this setting. See the
[dimension policy](../development/team-world-progress.md#dimension-access-policy).

## First launch

1. Extract `server-references.zip` into its own directory. Install
   [empack 0.8.2-beta](https://github.com/inherent-design/empack/releases/tag/v0.8.2-beta)
   on `PATH`. On macOS/Linux, also install Python 3 for the pack's terminal
   wrapper. Keep `foreground-runtime.py` beside the launch scripts. The launch scripts prepare the exact pack before starting Java;
   first preparation needs network access.
2. Set `JAVA_HOME` to a Java 21 installation, or make Java 21 the `java` on your
   `PATH`. Run `start.sh` on macOS/Linux or `start.bat` on Windows and confirm the
   Java version in the startup output.
3. Review Minecraft's EULA and accept it in the generated EULA file if you agree.
4. Start the server and add players with `whitelist add <player>` in its console.

The pack enables and enforces the whitelist. The default port is 25565, normal
view distance is 16 chunks, and simulation distance is 12 chunks. Server files
live under `game/`; the default world is `game/world`.

## Garbage collection

Keep Java 21's default G1 collector as the server baseline. The client ZGC setting
does not apply to the dedicated server. Before changing collectors, measure GC
pauses alongside tick times during normal play and pre-generation. Test ZGC only
if collection pauses contribute to stalls, and compare tick times, CPU use and
memory use with the same workload. No server-specific GC tuning is shipped.

The [performance procedure](../development/performance.md) describes bounded recordings for startup, disconnect/shutdown, GC and terrain/structure lookup. Use isolated fixtures before changing a playing server's JVM or background generation settings.

## Terrain and distant generation

New dedicated worlds use `skyweave_compat:islands_v1`. Keep Skyweave: Compatibility Patches
and the generation configuration with the world. The preset requires a new world;
changing `level-type` does not convert an existing save. Generation identity checks
reject incompatible changes to a marked world.

DH uses `CHUNKS_ONLY` with `INTERNAL_SERVER` to build LODs from the island
generator's actual chunks. The authored worker settings are four threads and
a runtime ratio of 1.0. To recalculate the LOW_IMPACT thread count for the host,
use this server command:

```text
/dh config common.threadPreset LOW_IMPACT
```

DH synchronization on load and real-time updates are enabled. The authored
per-player bandwidth limit is 2048 KB/s, with 64 generation/download requests
and 100 sync requests per second. DH negotiates the lower client/server limits;
existing installations need matching settings on both endpoints. Several players
filling fresh caches can use the sum of their individual bandwidth allowances.
A large pregen does not override the client's LOD display radius or make transfer
immediate. Keep download progress optional in the client UI.
See [missing distant terrain](graphics.md#missing-distant-terrain) for client checks.

## Finding islands and structures

Operators with permission level2 can search without running a broad synchronous
`/locate`. Island search reads planning metadata without generating chunks;
structure search verifies native starts and can save early chunk metadata.

```text
/skyweavecompat islands search 24000
/skyweavecompat structures search 24000 family=villages
/skyweavecompat structures search 24000 structure=ctov:medium/village_plains
/skyweavecompat structures search 24000 structure=#minecraft:village
/skyweavecompat structures status
/skyweavecompat structures page 2
/skyweavecompat structures cancel
```

Use tab completion for island filters and structure families, IDs or tags. Searches
continue automatically within their limits. Click result coordinates to prepare a
teleport; no teleport executes automatically, and the structure's stored altitude
is not a guarantee of a safe landing. A partial search is inconclusive. Unsupported
placements and omitted IDs are reported; historical starts without current
placement grids are outside the structure command's coverage.

Search limits are in `game/config/skyweave/skyweave_compat-search.json`, editable
through World generation → Sky Archipelago on a client installation. They apply
after restart without changing terrain identity. Client settings do not administer
a remote server. See [Compat command details](https://github.com/mannie-exe/skyweave-compat/blob/main/README.md#structure-search).

## Webmap

Server exports include BlueMap. Clients do not
download BlueMap or its configs.

On a fresh server, review BlueMap's resource-download terms and set
`accept-download: true` in `game/config/bluemap/core.conf` if you agree, then
restart. Existing installations retain their acceptance and operator settings.
The enabled web server listens on TCP **8100**; open `http://localhost:8100/`
on the host. Public access requires the owner's routing/firewall configuration.

The Overworld map covers all saved chunks with no horizontal boundary, including
unvisited pregenerated terrain, across Y -128 to 767. It does not generate terrain
itself. One render worker limits competition with gameplay and DH. Disabling cave
culling preserves shaded island undersides but also renders interiors and increases
tile size. Zoom in for accurate island geometry; distant tiles remain a height field.

Configuration under `game/config/bluemap/` is seeded once, so future pack installs
preserve local edits. If upgrading the earlier local setup, remove active `min-x`,
`max-x`, `min-z` and `max-z` from `maps/world.conf`, then restart. Use console command
`bluemap` for status; new saved chunks are picked up automatically.

## Updates

Stop the server cleanly before replacing files. Retain:

- The entire world directory, including dimension data, DH databases and Sable sublevels.
- The world's Sky Archipelago and Skyweave: Compatibility Patches configuration and presets.
- Server-specific settings, whitelist, operators and ban lists.
- DH's installation-specific configuration, including its generated `serverId`.

Apply the new mod set and review configuration changes against those retained
files. Re-extracting an archive over an old installation can leave obsolete
JARs behind; replacing the whole directory without retaining local files can
reset access lists and configuration.

DH's Overworld database is `game/world/data/DistantHorizons.sqlite`. Dimension
folders have their own databases. Do not copy or move a live SQLite database
file by itself; committed data can still be in its WAL. Stop the server first,
or use SQLite's backup API for a consistent snapshot.

The client-only polygon fix and shader presets are excluded from server exports.
An update to those alone does not require changing the server's mod set.

## New-world pregeneration

After stopping the server and verifying a complete world/config backup, remove
the previous world from the configured `level-name` path. Leave `level-seed=`
blank to let Minecraft choose a random seed at next launch. Do not copy the old
`level.dat`, region files or DH databases into the new world. Keep installation
identity, whitelist and operator settings.

With this pack's DH `CHUNKS_ONLY` / `INTERNAL_SERVER` configuration, start the
server and enter these commands in its console (without a leading slash):

```text
dh pregen start minecraft:overworld 0 0 1024
dh pregen status
```

The radius is 1024 chunks (16,384 blocks), centered at block coordinates 0, 0.
`dh pregen stop` cancels the job. The installed DH 3.3.3 command implementation
accepts dimension, X/Z origin and chunk radius. This run generates real chunks
and LODs; allow sufficient disk space. Storage use depends on the generated terrain and LOD data. The example uses the
world origin, not spawn; replace X/Z with the actual spawn coordinates to center
the run there.
