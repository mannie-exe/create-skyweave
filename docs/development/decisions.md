# Pack decisions

This index records accepted direction and its consequences. Owning guides contain
current settings and verification limits; Git history and archived release notes
retain superseded implementations and release details.

## Identity and progression

Create Skyweave centers on islands, Create production and Aeronautics transport.
Skyweave remains the separate civilization mod. Automated Logistics is deferred
because that future system should own route/service authority. Earlier technologies
need repeated uses and natural resource constraints, not compulsory recipe gates.
The [progression guide](progression.md) traces current routes and unresolved overlaps.

Questlog provides an optional, bookless journal with game-detectable conditions.
Mechanics are grouped by chapter; prose is grouped by locale, with shared disclaimer
keys and independent short objective labels. The [authoring guide](authoring.md)
owns the schema and generation procedure. No journal rewards impose a progression gate.

Elytra retain vanilla flight. Do a Barrel Roll was removed after reported movement
and rotation jitter; the cause remains unresolved, and ordinary banking/smoothing
does not explain the reported fault. Aileron is deferred: heat-assisted routes and
rechargeable boosts remain useful ideas, but adopting its implementation would
require compatibility and correctness work beyond the current scope. Reliable
Gliders retains its existing heat updrafts.

## Geography and settlements

For ordinary Sky Archipelago worlds, the 2026-10-21 review selected CONSISTENT
1494 over DYNAMIC's seed-wide
32 to 1500 range. The original seed's native layout matched at 1494; other seeds
retain location/shape variation without changing that spacing scale. This is a
pack policy, not a claim that DYNAMIC is defective. See [world generation](worldgen.md).

The expanded preset instead uses the authored Compat geometry, with island-relative
geology and clearance. Its current values belong in [world generation](worldgen.md).

Sky Villages was selected over Create: Sky Village. Skyweave Compat places
floating settlements around sampled archipelago terrain, rather than directly on
islands or anywhere in the void. Foundation ore/crop rules reduce easily stripped
wealth while retaining useful settlement supplies. Placement and resource evidence,
including known sampling limits, live in [structures](structures.md).

## Rendering

SeedGen is excluded because its vanilla noise reconstruction disagrees with island
terrain. DH rendering is enabled after player testing; shaders remain optional.
That default is not a cross-platform performance benchmark.

DH Polygon Fix retains the two-integer native polygon query required by DH 3.3.3.
The 1.0.1 validation included 10,000 Apple GL query/restore cycles and cross-platform
CI with Linux/Mesa testing; 1.0.2 retains that runtime implementation.
[Published patch checks](https://github.com/mannie-exe/dh-polygon-fix/actions/runs/39382246888)
and [compatibility](compatibility.md#dh-polygon-fix) bound the claim.

Shader presets reduce reflection sampler pressure and shadow distance. Measured
pipeline counts are in [shader verification](compatibility.md#shader-verification);
no fixed-scene FPS improvement or universal GPU compatibility is claimed.

Resource choices favor vanilla materials and narrow model changes over full reskins.
Icons was rejected for visual clutter. Reviewed overlaps use explicit pack priority
and small pinned model patches; [resource interactions](compatibility.md#resource-interactions)
and the Atlas retain evidence and outstanding comparisons.

## Distribution and preservation

Reference profiles are the default. Dependencies remain external references;
authored configuration and maintained patches are built from source. Publishing
requires separate authorization, a versioned tag and verified release assets.
Editable launcher/config defaults use seed policies so updates retain player data.
The [build guide](build.md) owns procedures and the Unix terminal workaround.

Verification specific to a release is retained with its [release notes](../README.md#source-and-releases).
