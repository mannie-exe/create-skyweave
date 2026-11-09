# Pack verification

Evidence qualifies its recorded artifact, not arbitrary later changes. The
[build guide](build.md) owns commands and release gates; [patch maintenance](patches.md)
owns dependency checks; [Atlas verification](web/verification.md) owns application
and export results. Keep exact inputs, negative controls and limitations with
native evidence. Archive checks alone do not establish gameplay or GPU behavior.

## Release 0.11.0

Compat 0.30.0 is published after successful Linux, Windows and Intel macOS checks;
its downloaded JAR matches both published checksum manifests and the local build.
The pack lock updates only Compat among 183 selections. The shader-lab runner
uses the same released bytes and qualifies both generated shader recipes.

The pack passes 82 Python tests, the 383-file configuration audit and all 14 quest
generation checks. Resource and Visual Patches checks are current. All three
reference profiles build; Prism and server recipes contain the 12 exact authored
FTB SNBT files and the released Compat hash. Archive CRC checks and the Unix
server-wrapper patch/check pass. Native FTB definitions, environment availability
and the final application build are recorded in [Atlas verification](web/verification.md).

Native Compat fixtures cover selected-site versus native candidate equivalence,
managed/tag/exact-ID and mixed searches, explicit partial/cap behavior, historical
starts, command/access boundaries, shared companion arrival and restart, FTB
party/manual claims and overflow, Hoofprint controls and FTB creative restoration.
See Compat's verification guide for tested artifacts and negative cases. These
checks do not establish natural structure abundance, a complete survival economy,
remote two-client behavior or general rendering performance.

Five owned closed review profiles were removed after preserving native receipts
and captures. Built-in Atlas retention refused unrecognized historical store
entries; that store was preserved without a raw sweep. No personal world reset,
cache purge or player-progress conversion is part of this update.

## Release 0.10.0

Published Compat 0.29.1 matches its SHA-256/SHA-512 manifests and passes the
Linux, Windows and Intel macOS release matrix. Its only runtime-artifact change
from 0.29.0 is native logo metadata/artwork; no terrain code changes. The shader
lab uses the same verified runner as the playable pack and retains both generated
shader outputs. Managed terrain profiles and generation identity are unchanged.

All 73 pack Python tests, the 383-file configuration audit and 88 unchanged
journal outputs pass. The Prism, server and Modrinth reference exports build and
pass CRC checks; both applicable sides contain the three FTB dependencies and
the server excludes the client inventory additions. The Unix server wrapper is
applied and checked. FTB Quests ships without authored chapters. Registry export
and Atlas checks are recorded in [web verification](web/verification.md#pack-0100-questteam-trial-refresh).

## Documentation and tooling maintenance

The maintenance checkout is based on pack `d4add5c` / Compat `30717ff`, with
uncommitted documentation/tooling edits. Node 24.22.0, pnpm 12.16.1 and Python
3.15.0 were used. All 74 pack Python tests pass, including a real archive check
for excluded desktop metadata and retained authored assets. The Resource Patches
rebuild removes only `.DS_Store` and `assets/.DS_Store`; every authored entry is
unchanged. Its subsequent `--check` passes. The 383-file configuration audit and
88 journal outputs remain unchanged.

Atlas formatting, unused-code checks, 158 application tests, 37 Python tests
(one existing skip), snapshot checks, Astro checks, the static build and one read-only static browser
check pass.
The app review covers shared headers, Activity ownership, disclosure/field
components and semantic tokens; the only source cleanup removes a redundant
Activity stylesheet import already owned by the shared layout. No interaction or
visual redesign is claimed. There is no new game/runtime capture for these edits.

Local file/anchor and current-main cross-repository reference checks pass. Historical results remain pinned to their release
sources. Cleanup retains useful captures and current exports while removing
superseded generated exports and byte-identical probe duplicates. Private receipts
record retained paths and hashes. Pending Compat candidate source is unchanged;
its build evidence does not establish native client verification.

## Earlier artifacts

The [published 0.10.0 reference](https://github.com/mannie-exe/create-skyweave/blob/v0.10.0/docs/development/compatibility.md)
retains earlier release checks and native observations. Use its named sections
when tracing an old result. Rerun affected checks against the candidate being
reviewed; do not copy historical pass counts into a new release claim.
