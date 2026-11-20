# Create: Skyweave

A Minecraft modpack about sky islands, airships and engineering, built around Create, Create Aeronautics, Sable and Sky Archipelago. By **mannie-exe** and **TimdoesLive**. Survival progression and ship interactions are still being tested.

Minecraft **1.21.1** · NeoForge **21.1.265** · Java **21**

## Installation

Download a [release](https://github.com/mannie-exe/create-skyweave/releases). Import the `prism-references.zip` into Prism Launcher, or the `.mrpack` into a compatible launcher. Prism and server reference packs include a Java bootstrap that downloads and verifies their exact empack engine before preparing released files. The Modrinth pack uses its launcher for downloads. Select Java 21 for the instance. The client and server default to a 12 GiB maximum Java heap. At least 12 GiB of system memory is required; leave additional memory for the operating system, native rendering and other processes. See the [launch requirements](docs/players/getting-started.md#memory-requirements) before running a client and server together.

New worlds default to Skyweave Islands. Shaders are optional; Skyweave Glass adapts [Complementary](https://www.complementary.dev/) and [Euphoria Patches](https://www.euphoriapatches.com/). BSL is assembled with Colorwheel support from pinned inputs. Distant Horizons rendering is enabled by default.

## Player and server guides

- [Installation, worlds and updates](docs/players/getting-started.md)
- [Distant Horizons, shaders and missing terrain](docs/players/graphics.md)
- [Server setup and maintenance](docs/players/server.md)
- [Included mods and shaders](docs/MODLIST.md)
- [Release notes](docs/RELEASE_NOTES.md)

## Development

Builds use empack **0.8.7-beta**. Start with the [build and release guide](docs/development/build.md). The [local web map and authoring app](web/README.md) lives in `web/`. Its [setup guide](docs/development/web/setup.md) covers installation and game data. The [documentation index](docs/README.md) separates player instructions from maintainer references and historical test evidence.

Mod and shader authors retain their respective licenses; this repository does not relicense their work. User worlds, accounts and server lists are not distributed.
