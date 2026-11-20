"""Output ownership shared by village generation and configuration inventory."""

BASE = 'resource-patches/data/'
MODIFIERS = BASE + 'skyweave_compat/lithostitched/worldgen_modifier/villages/'
TAGS = BASE + 'skyweave_compat/tags/worldgen/structure/managed/'
PROFILES = BASE + 'skyweave_compat/worldgen/structure/villages/'
POOLS = BASE + 'skyweave_compat/worldgen/template_pool/villages/'
BIOMES = BASE + 'skyweave_compat/tags/worldgen/biome/villages/'
COMPOSITION = BASE + 'skyweave_compat/village_composition/villages/'
TEMPLATES = BASE + 'skyweave_compat/structure/villages/'
SETS = {BASE + 'minecraft/worldgen/structure_set/villages.json',
        BASE + 'minecraft/worldgen/structure_set/pillager_outposts.json',
        BASE + 'towns_and_towers/worldgen/structure_set/towns.json',
        BASE + 'towns_and_towers/worldgen/structure_set/towers.json'}
SOIL_LISTS = {f'{BASE}ctov/worldgen/processor_list/village/{theme}/{kind}.json'
              for theme in ('swamp', 'swamp_fortified') for kind in ('town_center', 'road')}


def owned_paths(root):
    """Include retired outputs so the generator can detect and remove them."""
    paths = SETS | SOIL_LISTS | {TAGS + family + '.json' for family in ('villages', 'outposts')}
    if (root / (TAGS + 'composed_villages.json')).is_file():
        paths.add(TAGS + 'composed_villages.json')
    for folder, suffix in ((MODIFIERS, '*.json'), (PROFILES, '*.json'),
                           (POOLS, '*.json'), (BIOMES, '*.json'),
                           (TEMPLATES, '*.nbt'), (COMPOSITION, '*.json')):
        paths.update(path.relative_to(root).as_posix() for path in (root / folder).rglob(suffix))
    return {path for path in paths if (root / path).is_file()}
