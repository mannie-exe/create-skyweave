"""Authoring qualification for the exact Create textures recorded in a shader recipe."""
import json
from model_authoring import rgba


def block_textures(archive, identifier):
    """Collect Create texture bindings in the blockstate's model closure."""
    namespace, name = identifier.split(":")
    state = json.loads(archive.read(f"assets/{namespace}/blockstates/{name}.json"))
    models, textures, visited = set(), set(), set()

    def walk(value):
        if isinstance(value, dict):
            if isinstance(value.get("model"), str):
                models.add(value["model"])
            for child in value.values():
                walk(child)
        elif isinstance(value, list):
            for child in value:
                walk(child)

    def model(identifier):
        if identifier in visited:
            return
        visited.add(identifier)
        ns, path = identifier.split(":") if ":" in identifier else ("minecraft", identifier)
        if ns == "minecraft":
            return  # Native model parents and opaque wood/edge textures remain unchanged.
        if ns != "create":
            raise ValueError(f"Unreviewed window model namespace: {identifier}")
        value = json.loads(archive.read(f"assets/{ns}/models/{path}.json"))
        if "parent" in value:
            model(value["parent"])
        for key, texture in value.get("textures", {}).items():
            if key != "particle" and texture.startswith("create:"):
                textures.add(texture)

    walk(state)
    for identifier in sorted(models):
        model(identifier)
    if not textures:
        raise ValueError(f"No Create window textures: {identifier}")
    return sorted(textures)


def classify(archive, identifiers):
    report = []
    for identifier in sorted(identifiers):
        textures = []
        for texture in block_textures(archive, identifier):
            ns, path = texture.split(":")
            width, height, pixels = rgba(archive.read(f"assets/{ns}/textures/{path}.png"))
            alphas = sorted({pixel[3] for row in pixels for pixel in row})
            textures.append({"id": texture, "size": [width, height], "alpha": alphas})
        partial = any(any(0 < alpha < 255 for alpha in t["alpha"]) for t in textures)
        report.append({"id": identifier, "layer": "translucent" if partial else "cutout", "textures": textures})
    return report

