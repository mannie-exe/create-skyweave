# Performance investigation

Use a fixed question, a small repeatable workload and a bounded recording. Start with the shipped pack and existing harnesses. Do not add a monitoring stack or tune several JVM flags before identifying what consumes time. These procedures cover startup, disconnect/teardown, GC, terrain generation and other server-side calculations; GPU/rendering optimization is separate.

## Scope and baseline

Use disposable fixtures by default. Do not pause or reconfigure a playing server, attach expensive diagnostics, stop its pregen, clear its caches or reproduce a watchdog failure without authorization. An already-started pregen stays unpolled unless the task requests status or a failure requires investigation. A fixture may use a finite isolated DH workload to measure contention.

Record the exact pack/Compat revisions, artifact/configuration hashes, Minecraft/loader and JDK build, collector, effective heap bounds, OS/architecture, CPU quota/core count, available memory, worker limits and active background jobs. Java 21 is the supported baseline; a production JVM on another release is a different environment, not proof of a Java bug. Reproduce on the observed JVM before comparing versions independently. Redact accounts, tokens, addresses and unrelated command-line arguments from shared evidence.

Do not equate process memory with Java heap. Also track RSS, host memory pressure/swap, thread counts and direct/native allocations where relevant. Do not add heap, native, mapped-cache and RSS values as if they were disjoint categories. Thread stacks, LOD/native buffers and operating-system file cache can matter even when heap occupancy is modest.

Separate fresh generated data, saved/reopened data, JIT warmup and operating-system cache warmth. State which condition was tested. Do not purge host caches just to label a run cold. Perform one bounded diagnostic run; use three comparable repetitions for a claimed improvement and retain individual results rather than only the best. Change one cause at a time.

## Choose the endpoint

| Question | Workload and measured endpoint | Useful distinctions |
| --- | --- | --- |
| Startup delay | Java process start to dedicated-server `Done`; client process start to a responsive title screen | Launcher/empack preparation, mod loading, resource/shader reload and world loading are separate durations |
| Dedicated disconnect delay | Controlled disconnect to server removal/save acknowledgement and client return | Client UI/network teardown is not server shutdown; record both clocks and avoid inferring one from the other |
| Integrated-world exit | Leave a disposable singleplayer world and wait for return to title | Includes world saving, chunk/LOD unload and integrated-server termination; do not compare directly with dedicated disconnect |
| Server shutdown | Graceful stop to process exit after saving | Separate drain, serialization, LOD database close and worker termination |
| GC stutters | Fixed movement or machine workload with tick/operation timestamps and JFR GC events | Correlate pauses, allocation stalls and safepoints; a long tick without a matching GC pause has another cause |
| Terrain generation | Fixed seed, region and requested chunk status | Metadata, exterior columns, completed snapshots, STRUCTURE_STARTS and FULL are different workloads |
| Structure lookup | Exact query, origin, search scope and cold/warm start state | Count candidate checks and actual chunk requests; test DH idle/active only in isolated fixtures |
| Heavy server calculation | One reproducible operation at known input size | Pathfinding, machine/physics updates, searches, serialization and database work need separate cases |

Use monotonic time within a process for intervals. For cross-process events, preserve timestamps, timezone and synchronization limits. Log timestamps alone cannot establish sub-millisecond latency. Minecraft's periodic average tick-time events are not an individual-tick histogram; do not derive p95/p99 tick latency from averages.

## Recording tools

Java Flight Recorder and the JDK's `jcmd`/`jfr` commands are the first tools. Minecraft also exposes `jfr start`, `jfr stop` and `--jfrProfile`; [Mojang's introduction](https://feedback.minecraft.net/hc/en-us/articles/4415128577293-Minecraft-Java-Edition-1-18) describes its CPU, allocation, tick and chunk-generation events. Verify command support and event names against the installed version. A generic `jcmd` recording does not necessarily activate Minecraft's own profiling callbacks, so missing custom events must be reported rather than treated as zero work.

For a bounded running-JVM recording, using the matching JDK and a PID verified by executable and working directory:

```sh
PROFILE_JDK=/absolute/path/to/jdk
target_pid=12345
run_dir=/absolute/path/to/private/performance/case-timestamp
mkdir -p "$run_dir"
"$PROFILE_JDK/bin/jcmd" "$target_pid" help JFR.start
"$PROFILE_JDK/bin/jcmd" "$target_pid" JFR.start name=skyweave settings=profile duration=90s maxsize=128m filename="$run_dir/profile.jfr"
```

The path is interpreted by the target JVM. Use an absolute writable path, the same OS account and one known target PID; do not attach to every Java process. Duration and size bound this recording. Wait for recording completion before reading the file: its existence alone does not mean it has been finalized. Choose the duration to contain the operation; a timer ending before disconnect/shutdown cannot explain its tail. For startup, attach is too late: add `-XX:StartFlightRecording=name=skyweave,settings=profile,duration=90s,maxsize=128m,filename=/absolute/path/profile.jfr` to the disposable JVM launch instead. Capturing an earlier launcher phase requires separate timestamps.

When native Minecraft events are needed, use the Minecraft profiling commands or startup flag in the fixture, and arrange a bounded stop in its harness. Do not start an unattended indefinite recording on a personal server. Enable detailed allocation events or an alternative sampler only when the initial capture cannot discriminate the suspected cause; document the additional overhead.

[Oracle's JDK 21 diagnostic command reference](https://docs.oracle.com/en/java/javase/21/docs/specs/man/jcmd.html) owns JVM command syntax. Inspect available views and events before using version-specific names:

```sh
"$PROFILE_JDK/bin/jfr" summary "$run_dir/profile.jfr"
"$PROFILE_JDK/bin/jfr" help view
"$PROFILE_JDK/bin/jfr" view --width 180 hot-methods "$run_dir/profile.jfr"
"$PROFILE_JDK/bin/jfr" view --width 180 gc-pauses "$run_dir/profile.jfr"
"$PROFILE_JDK/bin/jfr" print --json --events jdk.GCPhasePause "$run_dir/profile.jfr" > "$run_dir/gc-pauses.json"
```

An absent view/event or an empty sample is a coverage limitation. CPU samples describe sampled execution, not a precise accounting of all wall time. Waiting and blocked threads need their wait stacks and task dependencies. Use up to three spaced thread dumps during a controlled stall only when necessary; dump size and capture overhead must remain bounded. Do not repeatedly rerun an identical failing experiment without new evidence.

Inspect recording metadata before retaining or sharing it. The profile preset can include environment variables, system properties, process command lines and JVM arguments. An owned fixture can exclude `jdk.InitialEnvironmentVariable`, `jdk.InitialSystemProperty`, `jdk.SystemProcess` and `jdk.JVMInformation` in its recording settings. If scrubbing an existing recording, verify that the selected CPU, allocation, GC and lifecycle observations remain equivalent afterward.

## Heap and collector decisions

Keep the documented [server collector baseline](../players/server.md#garbage-collection). Begin with measured heap use after representative collections, allocation rate, longest pauses, allocation stalls and host memory pressure. `used` heap before collection is not the retained live set, and one short capture is not a cache-leak diagnosis.

Compare a small explicit set of heap limits on the same workload only if memory pressure or GC cost is implicated. More `-Xmx` can reduce collection frequency but consume host headroom; raising `-Xms` can change startup/commit behavior and is not a universal stutter fix. Record effective JVM values, not just launcher intentions. Do not force full GC between gameplay samples or use heap dumps in a routine timing run.

Keep G1 defaults first, as [Oracle recommends](https://docs.oracle.com/en/java/javase/21/gctuning/garbage-first-garbage-collector-tuning.html). Compare collectors separately from heap/cache changes. ZGC's shorter-pause objective is not a promise of greater terrain throughput, and flags differ across JDK releases. Cache limits should follow retained-size and hit/eviction evidence; an unbounded cache is not an optimization. Client and server heap/collector decisions require separate measurements.

The current launch policy retains these settings. Changes take effect on the next JVM launch; ordinary pack preparation preserves existing launcher preferences and the native server argument file.

| Setting | Retained value and owner | Decision and override |
| --- | --- | --- |
| Client heap | 512 MiB initial, 8 GiB maximum in `templates/client/instance.cfg.template` | The corrected full-client shader/integrated-world check loads 609 chunks and reopens without loaded-world allocation stalls. Do not lower the maximum from older 6 GiB default-G1 fixtures. Players control both bounds in Prism; increasing the initial heap is not justified by this check. |
| Client collector | Java 21 generational ZGC in the Prism template | Keep both existing flags. The observed short pauses do not prove a terrain-throughput or FPS improvement; startup resource loading still has allocation stalls. |
| Dedicated-server heap | Java ergonomics unless the operator sets bounds in native `game/user_jvm_args.txt` | No portable fixed bound is shipped. Earlier full-server startup fails at 2 GiB; a successful small 4 GiB scene is not a populated-server recommendation. Preserve host choices and leave room for native buffers, a co-resident client and other processes. |
| Dedicated-server collector | Java 21 default G1 | No measured basis for a collector replacement or generic tuning bundle. The client's ZGC arguments do not apply here. |
| CPU, pre-touch and diagnostic flags | No added distribution flags | Fixture worker limits, processor counts, JFR, GC logging and error paths are diagnostic inputs only. |

The tested client has transient allocation stalls during resource loading, with a longest observed single-thread wait of 283 ms, then no allocation stalls after the world-ready endpoint. Aggregate waits on different threads overlap; do not add them into a single player-visible delay. This does not qualify arbitrary factories, fleets, prolonged exploration, multiplayer or every cache size. Keep the exact workload, collector and individual observations in verification rather than promising that JVM defaults remove all stutter.

The reopened eight-GiB dedicated diagnostic records one `System.gc()` full collection, with a longest pause of 506 ms. That is separate from concurrent G1 cycles and does not establish capacity thrashing. Preserve explicit-GC semantics until its actual caller and cleanup contract are qualified; do not add `DisableExplicitGC` merely to shorten this measurement.

## Terrain and lookup procedure

Reuse Compat's existing isolated `tools/probe.py --benchmark`, terrain survey and native structure fixtures. Its repository owns exact commands and result schemas. Retain the same registry inputs, world seed, generation identity, coordinates and requested status. Do not use a different island to claim a sampler speedup.

Use representative void, ordinary land, HOLLOW/NOISE, river/lake, ocean and structure-bearing inputs. Separate planning/cache-miss cost from warm sampling and cold chunk generation from reopening saved chunks. Count actual work: candidate/accepted clusters, sampled columns and spans, biome queries, interior evaluations, native cleanup, structure fits/accepted starts, generated chunks and serialization. Throughput needs a named unit and completion criterion, not just elapsed time.

Use existing phase counters where sufficient. If attribution remains unclear, add bounded aggregate timers or optional per-chunk JFR events in the owning integration; do not log every voxel or make per-column timing a permanent cost. Record whether measurements include BlueMap rendering, DH generation or both. Test a no-background-work control before attributing latency to contention. None of this requires changing the playing server's pregen.

For a foreground-only DH 3.3.3 control, explicitly set `generatorPlan = "DISABLED"` under `[common.worldGenerator]` in the owned fixture and verify its effective configuration. DH can still process ordinary chunk updates; this is not a DH-free control. Count actual saved chunks and statuses after stopping: native dependency halos can exceed the requested FULL-chunk targets. For BlueMap 5.7, set the render-worker limit in `core.conf`, bound the map's X/Z render area, and record tile work separately from resource loading and static web assets. Verify completed output rather than treating queue admission or a completed wrapper future as proof that all background work drained.

For `/locate`, a timeout does not establish rarity. Capture the watchdog report first, identify the command and blocking stage, then test a bounded fixture. Compare saved/unknown candidates, selected/rejected placements, policy on/off and DH idle/active. A source fast path must preserve real starts and native references. Do not increase spawn rates, erase burial checks, disable the watchdog or simply enlarge its limit to conceal expensive lookup.

## Progress and shutdown ownership

For a queue, distinguish loop passes, not-yet-due retries, rejected submissions, useful dispatch and completed durable output. A nonempty queue may contain no eligible work. Preserve its ordering, debounce, coalescing, capacity and close behavior when testing a worker wait/wakeup change. Lower CPU with missing or starved updates is a failure.

For shutdown, identify the exact awaited pool, active/queued/completed work and completion result. Correlate worker stacks with any task queue owned by the blocked caller. A native completion-aware wait reaching its deadline does not mean the deadline itself is the cause. Test busy and idle exits separately. Do not cancel futures, skip persistence or shorten a timeout to make the foreground measurement smaller. Render-task experiments must preserve the actual thread, current GL context and buffer lifetime; a normal process exit alone does not prove those contracts.

Keep fatal JVM diagnostics outside a disposable runtime with an explicit `-XX:ErrorFile=/absolute/capture/path/hs_err_pid%p.log`. Retain the collector, flags and native frame before cleanup. A crash during loading cannot qualify a later shutdown intervention. Likewise, a parent observer timeout does not establish a game deadlock: record the exact owned PID and command, check its actual terminal state, and collect a bounded owned-process stack only when needed. A wrapper's zero exit code must be accompanied by the requested native completion receipt.

Save/reopen claims require nonempty useful data and its identities or quantities after reopening. An empty database passing an integrity check proves neither work preservation nor world equivalence. Keep an in-memory result, graceful stop, second-JVM readback and real network dispatch as separate evidence boundaries.

## Concise result contract

Keep each run with its selected task's private evidence, following the [work and evidence convention](../../AGENTS.md#work-and-evidence), or in an existing ignored harness run directory. The case name describes the question. A manifest records revisions/hashes, environment, inputs, workload endpoints, completion/timeout and recording coverage. Keep one compact machine-readable summary and one short human conclusion; link raw `.jfr` and relevant logs rather than pasting them into chat.

The summary should contain measured elapsed time/throughput, operation or tick latency where available, GC count/total/longest pause, allocation information if captured, heap/RSS observations with their provenance, relevant phase/candidate/cache counters and at most ten ranked hotspots or blocking stacks. Include counts/units and missing fields as unavailable. Do not invent percentiles, precise memory peaks, CPU percentages or a speedup from stack appearances alone.

Separate observation, explanation and proposed change. Preserve the exact failing error, source boundary and a reproducer with a stopping condition. For a comparison, show baseline/candidate repetitions and the tested snapshot. Successful tool invocation is not performance validation. Promote only useful reproduction/maintenance instructions into docs; raw recordings and private paths are not public documentation.

Compress or remove disposable copies after preserving the evidence needed to reproduce a meaningful finding. Keep personal backups, world data and unrelated investigations untouched. Review JFR event names, native profiler lifecycle, chunk-status boundaries, counters and JVM flags when upgrading Java, Minecraft, NeoForge, C2ME, DH or Compat. A new dependency version requires remeasurement only at affected boundaries, not another unrestricted pack-wide benchmark.
