"""Preserve foliage wind expression grouping through Veil's GLSL processor."""
import hashlib

from model_authoring import require


SHADER = 'assets/mc2_interactivefoliage/shaders/core/foliage_legacy.vsh'
SOURCE_SHA256 = 'a50e83eeeec9fc7d86a6cddb55d64ee2f0e9e87bd785659eee8f75eda46da58e'
MACRO = (b'#define WIND_DIRECTION (mc2_SubLevelDown == vec3(0.0) ? '
         b'vec2(-1.0, 0.0) : mc2_SubLevelWind)')
REPLACEMENT = b'''// Keep conditional grouping intact through Veil GLSL Processor 0.2.3.
vec2 skyweaveWindDirection() {
    if (mc2_SubLevelDown == vec3(0.0)) {
        return vec2(-1.0, 0.0);
    }
    return mc2_SubLevelWind;
}
#define WIND_DIRECTION skyweaveWindDirection()'''


def build(archive):
    source = archive.read(SHADER)
    require(hashlib.sha256(source).hexdigest() == SOURCE_SHA256,
            'Interactive Foliage shader changed; review the Veil grouping repair')
    require(source.count(MACRO) == 1, 'Foliage wind macro changed')
    return {SHADER: source.replace(MACRO, REPLACEMENT)}
