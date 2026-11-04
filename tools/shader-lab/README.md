# Shader lab

This author-only empack workspace tracks plain BSL and Colorwheel Patcher. The
playable pack consumes only the complete patched BSL ZIP. Colorwheel itself stays
in the playable pack; the patcher mod does not.

From the repository root, with Python 3.11+ and empack on PATH:

```sh
python3 tools/shader-lab/build.py
empack sync
empack build
```

The builder materializes the lab's recorded inputs through empack, reads the
patcher's embedded BSL overlay, and merges it into a copy of BSL. This matches
the upstream patcher's extract-then-overlay operation. It does not run Minecraft
or alter an installed shader. Entries are sorted with fixed ZIP metadata and
published atomically; identical input bytes produce identical output bytes.
`--check` verifies an existing result without replacing it.

The generated `dist/BSL_v10.1.8 + Clrwl_1.0.5.zip` is a complete shader, not a
standalone patch. The main `empack.yml` records it as a client-only local
shader dependency. Reference builds embed this local artifact; recipients do not
need the lab, plain BSL or the patcher. Validate/release workflows generate it
before building the pack. Downloaded inputs and generated ZIPs are ignored.

## Update

Run `empack --workdir tools/shader-lab outdated`, then review and update the lab's
pins and lock. Check the exact patcher's embedded `config.json`, BSL version
matching and `patches/BSL.zip`. A broad advertised version match does not establish
compatibility with every future revision. The builder rejects changed archive
roots or unexpected overlay paths rather than guessing.

Regenerate, update the main dependency path and matching shader preset filename
if versions change, then run `empack sync` to record the new bytes. Update the
shader configuration register when the preset changes. Verify client-only
placement and the absence of plain BSL/patcher in every distribution. Recheck
Iris compilation, moving Create/Sable geometry and DH in an isolated client.
Keep Complementary/Euphoria as the default selection. Do not force Photon onto
unsupported Apple hardware.

The current generator's 314 file payloads match the archive produced by the real
Colorwheel Patcher 1.0.5 with BSL 10.1.8. ZIP metadata is normalized, so archive
hashes differ from the upstream runtime output. This proves merge equivalence;
it does not establish every shader/rendering path. Shader behavior and hardware
limits belong in [compatibility](../../docs/development/compatibility.md#shader-patching).
