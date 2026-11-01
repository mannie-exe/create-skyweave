# Building weights

Sable assigns unclassified colliding blocks a mass of 1.0. Its built-in categories
include 0.25 for lanterns, bars and wooden stairs, 0.5 for planks and stone stairs,
2.0 for natural stone and 4.0 for metal storage blocks. These are gameplay units,
not physical material densities.

The shared resource JAR extends Sable's existing mass tiers through optional,
additive block tags. Class inheritance, resolved tags, collision states and
upstream counterparts determine membership; a missing explicit weight is not
automatically a defect. The policy favors equivalent construction choices over
physical density estimates.

| Family | Mass convention |
| --- | --- |
| Macaw stone paving, platforms and finished slabs/stairs; Rechiseled Create connecting slabs/stairs; Power Grid copper-plating slabs/stairs | 0.5; double slabs use Sable's existing 1.0 override |
| Macaw wooden paths, platforms and ledges | 0.25, matching wooden partial blocks |
| Macaw bridge variants | Wooden rail/red bridges join the existing 0.5 wooden-bridge tier; stone/metal bridge structures retain their defaults |
| Macaw windows, panes, rods, shutters, garage doors and portcullises | Thin panels/bars/doors use 0.25 per colliding position; full glass and thick masonry windows retain 1.0 |
| Copycats ordinary and iron doors | 0.25, matching that mod's already classified sliding/folding doors and trapdoors; copied-material behavior is unchanged |
| Macaw balconies | Connected wooden rails use 0.25 and stone rails 0.5; empty collision states remain zero |
| Macaw decorative lights, DnD lamps/frontlights, Factory jars, Interiors tables, thin Bells & Whistles fittings, Escalated handrails, DnD catwalks/bolts, Create Deco bars | 0.25, extending existing lantern, jar, furniture and thin-fixture conventions |
| Interiors seating, DnD cogwheels/belt, Bits 'n' Bobs encased shafts/cogs/poles, Connected crank wheels, Vibrant Vaults stock links, Lootr barrels/trapped chests | 0.5, matching their Create/vanilla counterparts |
| Connected sequenced pulse generator | 0.25, matching Create's diode-family blocks |
| Bits 'n' Bobs brass lamp | 0.5, matching that mod's existing lightbulb/headlamp policy |
| DnD recolored flywheels | 4.0, matching Create's flywheel; large fans sharing the implementation class are excluded |
| Redden's carved lanterns and narrow stone pillars | 0.5 per component, following finished partial stone; miniature lanterns use 0.25. Lit/unlit and waterlogged variants share their classification. Broad columns and large masonry lanterns retain 1.0 |

These additions fill missing classifications without replacing upstream mass
assignments. Create itself, existing authored Copycats/Simulated Copycats and
Rechiseled weight rules, ballast, specialized machinery, cargo contents and lift
settings retain upstream behavior. Mass tags do not change volume, inertia definitions,
collision geometry or floating properties. Thick architectural stone components,
structural girders, full cubes and machines without a convincing counterpart retain
their defaults; small collision volume alone does not justify a lighter machine.

DnD metal supports, diagonal girders and beams, and Bits 'n' Bobs girder variants
retain 1.0, matching Create's metal girder. Full decorative stone pillars, grates,
display boards and industrial housings also retain their existing counterparts'
defaults. Large chains with empty collision retain zero. These are intentional
retentions, not incomplete classifications.

Collisionless decorations, including Macaw's bridge lantern and curtains, remain
massless. A multi-position door or lamp is weighed per colliding block position,
not once per item. No contents-sensitive or copied-material mass system is added.

After Sable or building-mod updates, check the live mass values and an assembled
structure. A tooltip or a matching tag does not establish the assembled mass.
Use registered blocks rather than asset filenames: DnD ships resources for extra
colors that are not registered in the selected configuration. See the verification
below for measured scope and [patch maintenance](patches.md) for update criteria.

## Multipart machinery

Bits 'n' Bobs 2.3.5 places its gigantic cogwheel in a 3×3 plane. Its center schedules
placement of eight colliding satellites through `GiganticCogwheelBlock.tick`;
`GiganticCogwheelSatelliteBlock` points each part back toward the center. The
satellites have empty rendered models because the center renders the whole wheel,
but they are physical positions, not duplicate mass records.

Retain the current 1.0 per position, 9.0 for the complete wheel. In the native
fixtures, the actual placement tick created the satellites; adhesive backing
attached all nine positions. Simulated moved all nine into the ship in each axis,
and Sable reported 18.0 including nine 1.0 backing blocks. The wheel alone therefore
contributed 9.0 before and after assembly. A large three-block machine has no
established whole-object precedent requiring the ordinary cogwheel's 0.5 mass.
No tag adjustment or Create Sky Compat hook is justified by this accounting.
This does not establish unglued connectivity, powered rotation or every moving
contraption lifecycle.

Escalated 1.3.2 already supplies Sable walkway collision callbacks. CBC 5.11.7
mounted cannons use Create contraptions, which Sable registers and merges into the
containing ship's mass tracker; CBC also supplies Simulated assembly handling.
These implementation paths do not justify duplicate pack accounting. They were
source-inspected, not included in the new powered-machinery runtime fixtures.

## Verification, 2026-10-29

The 2026-10-29 headless comparison used Create Sky source `8aed6cb` before and
after the classifications above, NeoForge 21.1.264, Java 21, Sable 2.0.6 and
Aeronautics/Simulated 1.3.2. The 101 installed
dependency JARs were identical between runs and matched the pack's downloaded
artifacts; only the shared fixes JAR changed. Its SHA-256 changed from
`11eb87e393fa886645a3039ca7f757a3de6de8779e715135704a41202e500ead` to
`08889c597b21623c2353ab677738209ec7e6bacc6a7d2eed8794a270478210c8`.
The packaged delta contains only the Sable `light`, `super_light` and
`super_heavy` block tags. Create Sky Compat `9e674ff` was not modified.

Native property queries covered all 9,545 registered blocks and 330,524 states
at a fixed flat-world fixture coordinate. The independently reviewed selection
changed 23,624 states belonging to 1,005 blocks in 19 mod families. Every other
state retained its mass; all 13,769 zero-mass states and all volume values were
unchanged. Existing explicit upstream mass selectors were excluded from the
additions. Asset-only, unregistered DnD colors were excluded as well.

Each isolated server assembled 194 fixtures through Simulated and compared the
actual Sable mass tracker with the placed states and independently expected
weights. Fixtures include representative implementation families, empty container
shells, Create/vanilla and existing-integration controls, top/bottom/double slabs,
ordinary door halves, open/closed garage and portcullis segments, two-position
lights, connected/empty balcony states, collisionless decorations and flywheel
axes, complete two-part stone lanterns and connected pillar stacks, with dry and
waterlogged variants. Three additional complete BnB wheel fixtures covered X/Y/Z
axes. Wall/ceiling attachments had support cages. Connection-driven placed states
were recorded; explicitly requested state properties were checked. Both runs
completed the checks and shut down normally; their disposable worlds were removed.

`python3 scripts/build-fixes.py --check` and `python3 scripts/audit-changes.py`
passed after regeneration. Local fixture sources, manifests, comparison output
and the work/future-integration ledgers are retained in `.git/weight-review/`;
they are not distributed pack content. The local native commands were
`python3 .git/weight-review/run.py baseline`,
`python3 .git/weight-review/run.py candidate` and
`python3 .git/weight-review/verify.py`.

This establishes state-level classification and representative assembled mass,
not every moving mechanism, contents-dependent inventory/tank behavior, copied
material, inertia equivalence, or aircraft handling. Collision geometry, volume,
inertia definitions, lift and cargo mechanics were not changed. Existing startup
warnings about unregistered optional resources are not evidence of a new weight
regression. The classification policy above distinguishes direct counterparts from deliberate
extrapolations and retained defaults.

## Transmission & Linkage

The reviewed 0.2.9 runtime assigns mass 1.0 to all eight registered blocks,
matching Create's mechanical bearing. Three native moving-head assemblies each
weigh 3.0 with their stone ballast (stone contributes 2.0). These results support
retaining upstream classifications; no additional mass tag is shipped. Link
geometry is not an inventory of extra physical block positions. Recheck native
classification and assembled totals when updating this machinery or Sable.
