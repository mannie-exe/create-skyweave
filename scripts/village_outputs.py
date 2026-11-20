"""Output ownership shared by village generation and configuration inventory."""

BASE = 'resource-patches/data/'
MODIFIERS = BASE + 'skyweave_compat/lithostitched/worldgen_modifier/villages/'
TAGS = BASE + 'skyweave_compat/tags/worldgen/structure/managed/'
SETS = {BASE + 'minecraft/worldgen/structure_set/villages.json',
        BASE + 'minecraft/worldgen/structure_set/pillager_outposts.json',
        BASE + 'towns_and_towers/worldgen/structure_set/towns.json',
        BASE + 'towns_and_towers/worldgen/structure_set/towers.json'}
SOIL_LISTS = {f'{BASE}ctov/worldgen/processor_list/village/{theme}/{kind}.json'
              for theme in ('swamp', 'swamp_fortified') for kind in ('town_center', 'road')}


def owned_paths(root):
    paths = SETS | SOIL_LISTS | {TAGS + family + '.json' for family in ('villages', 'outposts')}
    paths.update(path.relative_to(root).as_posix() for path in (root / MODIFIERS).rglob('*.json'))
    return {path for path in paths if (root / path).is_file()}
