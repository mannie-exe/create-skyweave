# Longshot interactions

Longshot review covers interactions whose useful range can exceed the assumptions of their native aiming, projectile, attachment, networking, rendering, or chunk-loading paths. Connectors, grappling hooks, plungers, and cannon projectiles have different contracts. Increasing one configuration value does not qualify the others.

The source review defines a first repair sequence: connector range/terminal order and ammunition custody, Skybound movement validation, then loaded-only query and ordinary tracking/rendering qualification. These are proposed adaptations, not installed features. Longer flight profiles, DH-assisted targeting, deliberate terrain loading, and extended physics remain gated by their authority, lifecycle, and measured cost. Weighted ejectors retain a 64-block range; chaining stations is the intended way to extend that route.

The broader [world-runtime program](world-runtime.md) owns coupled water, renderer, lifecycle and profiling adoption. This page retains the action-specific pack constraints; proposed runtime selectors and geometry belong to Compat.

## Owning references

| Reference | Owns |
| --- | --- |
| [Connection limits](progression.md#ropes-and-connection-limits) | Current authored ranges, units, configuration owners, and independent link-system limits |
| [Ballistic design](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/longshot.md#4-flight-profiles-and-other-tools) | Exact reviewed mechanisms, calculated reach, and source-versus-gameplay qualification limits |
| [Connector compatibility](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/adapters.md#throwable-rope-connector-range-limits) | Optional startup adaptation and supported native dependency boundary |
| [Compat Longshot design](https://github.com/mannie-exe/skyweave-compat/blob/main/docs/development/longshot.md) | Proposed optional keys, exact implementation seams, dependency order, and acceptance controls |
| [Content triage](content-triage.md#sable-and-moving-machinery) | Native ownership, moving frames, custody, and review routing |
| [Input ownership](keybinds.md) | Controls, custom dispatch, modifiers, and player preferences |
| [Performance investigation](performance.md) | Workload construction, profiling, and cost evidence |
| [Dependency maintenance](patches.md#update-sequence) | Coupled updates, native replacement checks, and adaptation retirement |

Maintain those owners rather than copying their settings into another manifest. This page owns cross-system review requirements and routes findings back to the appropriate guide. Personal discovery tasks and run narration stay outside the repository.

## Separate the bounds

For each selected action, identify its configured and effective limits, units, coordinate frame, and distance shape. Trace target selection, launch speed/gravity/drag, flight lifetime, swept collision, attachment separation or rope path, client tracking, render/frustum bounds, available collision data, and simulation residency. A straight-line distance, a bent rope length, a horizontal launch range, and a server interaction check are different quantities.

Use the actual selected artifact and consumer. Test world, plot, local, and body conversions with translated, rotated, tilted, and moving cases when applicable. Preserve native velocity inheritance and impact callbacks exactly once. Configuration persistence and a successful startup are separate from an observed shot, attachment, landing, or long-running constraint.

The reviewed connector checks range after native impact processing; placement and refunds therefore need a terminal transaction before longer flight. Preserve the distinction between unpaid player shots, prepaid ammunition, dispensers, and creative use. A mounted source's position/type is insufficient identity after replacement. Skybound's custom movement handler needs numeric and authority validation, but native post-detach air-friction movement must remain supported. These are source findings; native exploit and flight qualification remain separate work.

Plunger separation already has a native server setting, `equipment.maxPlungerLauncherRange`; its 48-block correction ray is independent. Simulated checks rope endpoints with a strict distance comparison and constructs points proportional to rope length. Do not promise an exactly 255-block attachment or constant physics cost from the configured ceiling.

## Distant terrain and loading

DH coverage can inform presentation or candidate selection; coarse visual data cannot authorize damage, attachment, placement, or full-voxel collision. Distinguish saved data, loaded chunks, block/entity ticking, and ready LOD rendering. Unknown coverage is not empty terrain. A visible destination alone does not establish collision or simulation along the intervening route.

Native connector tracking also requires the projectile's chunk to be tracked by the receiving player. Raising a tracking radius does not remove that interest gate. Sable modifies native clip/projectile/Create rays; replacing them with a plain block getter can discard moving-body intersections. Qualify the selected native path before claiming loaded-only, frame-correct collision.

Speculative aiming, previews, and effects must not silently activate distant physics or load terrain. Discovery may evaluate deliberate, server-admitted asynchronous loading for an actual action. Loading existing saved chunks and generating missing terrain are separate policies. Reify required regions, quotas, concurrency, backpressure, cancellation, ticket ownership, and release before adopting either. Measure cost rather than choosing arbitrary timers or assuming a larger view distance solves it.

Big Cannons already has a separate native loading owner. The authored `createbigcannons-server.toml` enables both projectile and smoke-cloud chunkloading; projectiles queue requests through Ritchie's Projectile Library. Review that producer, its manager, actual cleanup, and cost before proposing another loader. In the reviewed library, `loadChunkNoGenerate` can request FULL promotion after receiving a protochunk; its name is not a no-generation guarantee. The generic native FULL-chunk future's false ticket flag also does not establish saved-only behavior.

## Authority and qualification

Keep native server authority over target identity, reach, line of sight, permissions/protection, ammunition, inventory, and world mutation. Validate finite values, dimensions, session/ship identity, stale results, replay, partial failure, and consumption/refund behavior. Missing or replaced targets, disconnect, death, teleport, unload, and disassembly must release owned work and constraints without duplicate effects or orphaned tickets. A load request is also a potential resource-exhaustion path.

Compare unchanged and proposed behavior through meaningful action-specific cases, including OFF/absent dependencies, lower/zero ceilings, unavailable terrain, moving frames, and remote clients where claimed. Record actual shots and outcomes separately from mathematical estimates. Measure affected tick/frame latency, CPU, allocation/retention, packets, loaded/ticking chunks, and physics work. Retain traceable refusal reasons and explicit unqualified scope; no global reach, projectile, or loading rewrite follows from discovering one narrow defect.
