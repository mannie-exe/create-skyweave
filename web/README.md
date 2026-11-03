# Create Sky Atlas

Internal item, recipe and progression map, pack authoring and resource-pack review
for the Create Sky modpack.

## Local development

From the pack repository root, use the Node version in `web/.node-version` and
pnpm version in `web/package.json`.

```sh
cd web
pnpm install --frozen-lockfile
pnpm dev
```

Open <http://127.0.0.1:4321>. An existing local snapshot loads immediately; a fresh
checkout shows an empty shell until you [configure and capture game data](../docs/development/web/setup.md).
The resource-pack review at `/resourcepacks` uses checked-in research and works
without a game snapshot. The app binds loopback and is not deployed.

## Documentation

- [Documentation index](../docs/development/web/README.md)
- [Map and editing guide](../docs/development/web/usage.md)
- [Setup, refresh and checks](../docs/development/web/setup.md)
- [Data pipeline, textures and recipe modeling](../docs/development/web/data.md)
- [Verification and limits](../docs/development/web/verification.md)

Astro serves a static page and browser code. A local development plugin provides
the shared workspace service, WebSocket updates and named authoring jobs. React graph views provide interactive recipe nodes, pan/zoom, a minimap and
viewport culling alongside the item grid. Minecraft runtime exports, JAR resources and
authored domains compile into scoped, ignored artifact generations. The CLI and app share publication; static builds materialize the admitted public projections.
Static builds support browsing; editing requires the local development server.

This is a private workspace. No distribution license is selected. Extracted game
assets retain their upstream licenses and are excluded from version control.
