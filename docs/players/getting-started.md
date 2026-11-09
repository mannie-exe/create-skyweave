# Installation and worlds

Create: Skyweave runs on Minecraft 1.21.1, the manifest-pinned NeoForge and Java 21.

## Client installation

1. Download a pack from [GitHub Releases](https://github.com/mannie-exe/create-skyweave/releases).
2. Import the `prism-references.zip` into Prism Launcher, or import the `.mrpack`
   into a launcher that supports Modrinth packs. For Prism, install
   [empack 0.8.2-beta](https://github.com/inherent-design/empack/releases/tag/v0.8.2-beta)
   on the launcher process's `PATH`. Its launch hook downloads and verifies the
   released files; keep the generated pre-launch and wrapper commands.
3. Select Java 21 in the instance settings and launch the game. The Prism profile
   sets a maximum heap of 8 GiB; adjust this to fit your machine.

If Prism reports `execve: No such file or directory` before Java starts, check
that its process can find empack. A GUI-launched Prism can have a different `PATH`
from your terminal. Install empack on that path or use its verified absolute path
in this local instance's existing pre-launch and wrapper commands. Preserve the
release path, hash and other generated arguments. Do not put a machine-specific
path into shared templates. A `ModifiedManagedFile` conflict is a different issue:
review the local file before accepting a replacement; do not bypass verification.

Use [graphics settings](graphics.md) to enable shaders or configure distant terrain.
The server archive is for [hosting](server.md), not client installation.

## Controls

Use **Options → Controls → Key Binds** to search bindings with Controlling.
Better Third Person separates walking direction from the third-person camera.
Elytra retain vanilla steering and firework propulsion. Glider and ship controls
remain separate.

InvMove permits movement in ordinary inventories. Focused text fields, Ponder,
books, advancements and unrecognized mod screens keep movement disabled. This
includes the journal by default. Sneaking is retained when opening an inventory;
inventory input does not dismount a seated player.

Grave accent (`) opens FTB Quests in new pack defaults. Questlog remains available
through its inventory button with its opening key unbound; see [quests](journal.md)
for the current content and authoring boundaries.

Mouse Tweaks supplies drag and wheel gestures; Inventory Profiles Next adds
manual sorting, transfers and refill. See [inventory controls](inventory.md) for
ownership, defaults and the current creative-screen workaround.

Ping Wheel uses its **Ping Location** binding, initially Mouse 5; remap it here
if your mouse has no side buttons. Pings last ten seconds with reduced volume.
Hold Shift over a shulker box for its contents preview. Clean Tooltips displays
durability and enchantments without extra blank lines between sections.

## Client garbage collection

Prism exports default to Generational ZGC on Java 21 to reduce collection pauses.
Existing instances and Modrinth imports can set these arguments in their launcher:

```text
-XX:+UseZGC -XX:+ZGenerational
```

In Prism, open **Edit instance → Settings → Java**, enable the Java arguments
override, and enter both flags. Restart the game after changing them. Keep the
memory limits separate in Prism's memory settings; start with the pack's 8 GiB
maximum and adjust based on actual usage. Do not combine these flags with another
collector selection or `-XX:+DisableExplicitGC`.

These defaults are specific to Java 21. Existing player choices remain local;
normal empack preparation does not replace launcher arguments. ZGC cannot address
rendering or chunk-generation bottlenecks, and its gameplay performance still
needs comparison with G1 in this pack. See the
[Java 21 GC guide](https://docs.oracle.com/en/java/javase/21/gctuning/hotspot-virtual-machine-garbage-collection-tuning-guide.pdf).

## New worlds

New single-player worlds default to **Skyweave Islands**. Dedicated-server
creation uses the same preset. Deep large islands have smaller companions and
wide gaps between clusters. Build bounds are Y=-128 through 767; the terrain band
leaves room above the islands for building and flight.

Ore and selected underground features follow the large island's geological
height, rather than the absolute world height. Companions share that frame;
small islands need not contain every resource. Floating villages appear beside
some clusters, with at most three per cluster and zero most common.

Create a new world to use this preset. Existing worlds are not converted. Keep
the generation configuration with each world; changing a marked world's
generation identity is rejected instead of silently altering future chunks.

Operators can use the [island and structure searches](server.md#finding-islands-and-structures) to find places to inspect. These have different generation costs and return suggested teleport coordinates.

Lootr provides personal loot in supported containers; it does not add structures.
Carry On excludes Lootr containers and Aeronautics/Sable objects. Ship storage,
resource access and survival progression still need gameplay testing.

## Death and recovery

YiGD stores recoverable inventory, equipment and the equipped Traveler's Backpack
with its contents in a grave. Right-click your grave to recover them. Graves stay
owner-controlled, with no random item loss or recovery fee. Recoverable XP follows
the vanilla death-drop amount; previous levels are not fully preserved.

A grave on a supported Sable deck moves with the ship. After falling from a
verified deck into the void, recovery prefers that ship. If the construct is lost
or cannot provide space, placement searches near its last verified location. An
unloaded ship's existing grave stays saved. If nearby placement is blocked, the
saved recovery remains pending; ask the server operator rather than assuming the
items were dropped into the void.

Traveler's Backpack does not place a separate death-recovery block. Normal
backpack storage, equipment controls and dropped-item protections remain enabled.
Claim existing graves before removing YiGD or disabling construct recovery.

## Existing installations

Read the target release's notes before updating. Stop the client or server before
replacing its files. Use a fresh instance for a clean client test, and retain any
single-player saves and personal settings you want to carry over.

Use the selected release's complete dependency set. Do not retain obsolete JARs
beside their replacements or update DH independently of its exact-version patch.
Shader presets are separate files, so a JAR-only update does not apply them.

Server updates must retain the world and its generation configuration; see
[server maintenance](server.md#updates). A normal pack update does not require
regenerating terrain or deleting DH caches.

## Issue reports

Include the pack version, operating system, Java version, what you were doing,
and the relevant log or crash report. Mention any changed mods or shader settings.
For missing distant terrain, follow the [LOD checks](graphics.md#missing-distant-terrain)
first. For a native JVM crash, include the `hs_err_pid*.log` file as well as
Minecraft's log.
