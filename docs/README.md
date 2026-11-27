# Create: Skyweave documentation

Player guides explain installation and operation. Development documents describe pack authoring, compatibility constraints and verification. Historical decisions record what was tested at the time; they do not define current defaults.

## Players and server owners

| Guide | Contents |
| --- | --- |
| [Getting started](players/getting-started.md) | Installation, world creation and updates |
| [Movement and combat](players/movement-combat.md) | Movement controls and authored defaults |
| [Inventory controls](players/inventory.md) | Gestures, sorting, refill and known screen issues |
| [Journal](players/journal.md) | Local quest conditions and controls |
| [Graphics](players/graphics.md) | DH rendering, shader choices and missing LODs |
| [Filming](players/filming.md) | Replay recording, camera paths, export and local project files |
| [Servers](players/server.md) | Hosting, world preservation and DH generation |
| [Included content](MODLIST.md) | Exact mods, resource packs and shaders in current source |
| [Release notes](RELEASE_NOTES.md) | Current release notes and links to earlier versions |

## Development and maintenance

The [development index](development/README.md) groups the maintained technical guides by responsibility: builds and compatibility, gameplay and progression, world/building authoring, rendering and filming, and the authoring application.

Start with [new-content triage](development/content-triage.md) for additions, [animation and model compatibility](development/animation-compatibility.md) for visual or interaction changes, and [build and release](development/build.md) for producing artifacts. Player instructions stay in the guides above; source findings and incomplete qualification stay in the owning development guide.

## Source and releases

Current defaults live in `overrides/` and `templates/`. Building source does not update a downloaded release or an installed instance. Archived release notes describe their named version; the unreleased notes describe the working tree.

[Archived release notes](releases/) retain version-specific changes and verification. The [changelog](../CHANGELOG.md) records repository history.
