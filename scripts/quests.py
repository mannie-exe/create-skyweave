"""Compile authored mechanics and locale prose into the pinned FTB Quests format.

This is an emitter for an explicit supported schema, not an SNBT importer. Native
edits are reconciled through output hashes by the publication owner; do not parse
FTB extensions with a generic Minecraft/JSON parser and overwrite unknown data.
"""
from copy import deepcopy
from dataclasses import dataclass
import json
import math
import re
from pathlib import Path

CODE = re.compile(r'[0-9A-F]{16}')
KEY = re.compile(r'[a-z0-9_]+')
FORMAT_VERSION = 13  # FTB Quests 2101.1.38; absence invokes its legacy migrator.
NATIVE_FIELDS = {
    'file': {'default_reward_team', 'default_consume_items', 'default_autoclaim_rewards', 'default_quest_shape',
             'default_quest_disable_jei', 'progression_mode', 'fallback_locale'},
    'group': {'icon'},
    'chapter': {'icon', 'default_quest_shape', 'default_hide_dependency_lines', 'default_quest_size',
                'always_invisible', 'default_min_width', 'progression_mode', 'consume_items',
                'hide_quest_details_until_startable', 'hide_quest_until_deps_visible',
                'hide_quest_until_deps_complete', 'hide_text_until_complete', 'default_repeatable_quest',
                'require_sequential_tasks', 'autofocus_id'},
    'quest': {'icon', 'shape', 'size', 'optional', 'hide_dependency_lines', 'hide_dependent_lines',
              'min_required_dependencies', 'dependency_requirement', 'hide_until_deps_visible',
              'hide_until_deps_complete', 'hide_text_until_complete', 'progression_mode', 'require_sequential_tasks',
              'ignore_reward_blocking', 'hide_details_until_startable', 'hide_lock_icon'},
    'task': {'icon', 'optional_task', 'task_screen_only'},
    'reward': {'icon', 'team_reward', 'auto', 'exclude_from_claim_all', 'ignore_reward_blocking', 'disable_reward_screen_blur'},
}
TASK_FIELDS = {
    'item': {'item', 'match', 'count', 'consume_items', 'only_from_crafting', 'match_components'},
    'advancement': {'advancement', 'criterion'},
    'interaction': {'interaction_type', 'to_interact'},
    'checkmark': set(),
}
REWARD_FIELDS = {'item': {'item', 'count', 'random_bonus', 'only_one'}, 'xp': {'xp'}, 'xp_levels': {'xp_levels'}}


@dataclass(frozen=True)
class Number:
    value: int | float
    kind: str


@dataclass(frozen=True)
class Inline:
    value: dict


def tag_kind(value):
    if isinstance(value, Number):
        return value.kind
    if isinstance(value, Inline):
        return 'compound'
    return {bool: 'byte', int: 'int', float: 'double', dict: 'compound', list: 'list', str: 'string'}.get(type(value))


# Pinned BaseQuestFile.writeData defaults, not another authored configuration.
# Native FTB saves materialize these even when they were omitted on input.
FILE_DEFAULTS = {
    'default_autoclaim_rewards': 'disabled', 'default_consume_items': False,
    'default_quest_disable_jei': False, 'default_quest_shape': '', 'default_reward_team': False,
    'detection_delay': 20, 'disable_gui': False, 'drop_book_on_death': False,
    'drop_loot_crates': False, 'emergency_items_cooldown': 0, 'fallback_locale': '',
    'grid_scale': .5, 'hide_excluded_quests': False, 'lock_message': '',
    'loot_crate_no_drop': {'boss': 0, 'monster': 600, 'passive': 4000}, 'pause_game': False,
    'presets': {'goal': {'shape': 'hexagon', 'size': 2.0}, 'info': {'shape': 'gear', 'size': 1.0},
                'normal': {'shape': 'square', 'size': 1.0}},
    'progression_mode': 'linear', 'show_lock_icons': True, 'verify_on_load': False,
}


def ftb_snbt(value, indent=0, inline=False):
    """Emit the native writer's supported shape, including single-line item stacks.

    This is an emitter, not an importer or semantic comparison of unknown SNBT.
    FTB 2101.1.38 sorts compound keys and compacts single-element lists.
    """
    if isinstance(value, Inline):
        return ftb_snbt(value.value, indent, True)
    if isinstance(value, dict):
        key = lambda k: k if re.fullmatch(r'[A-Za-z0-9_]+', k) else json.dumps(k, ensure_ascii=False)
        if not value:
            return '{ }'
        if inline:
            return '{ ' + ', '.join(key(k) + ': ' + ftb_snbt(v, indent, True) for k, v in sorted(value.items())) + ' }'
        return '{\n' + '\n'.join('\t' * (indent + 1) + key(k) + ': ' + ftb_snbt(v, indent + 1)
                                 for k, v in sorted(value.items())) + '\n' + '\t' * indent + '}'
    if isinstance(value, list):
        if not value:
            return '[ ]'
        if len({tag_kind(v) for v in value}) != 1:
            raise ValueError('Native lists must have one element type')
        if inline:
            return '[ ' + ', '.join(ftb_snbt(v, indent, True) for v in value) + ' ]'
        if all(not isinstance(v, (dict, list, Inline)) for v in value):
            return '[' + ', '.join(ftb_snbt(v, indent, True) for v in value) + ']'
        if len(value) == 1:
            return '[' + ftb_snbt(value[0], indent) + ']'
        return '[\n' + '\n'.join('\t' * (indent + 1) + ftb_snbt(v, indent + 1) for v in value) + '\n' + '\t' * indent + ']'
    if type(value) is bool:
        return 'true' if value else 'false'
    return snbt(value, indent)


def definition_shape(path, value):
    """Apply the pinned native writeData omissions/defaults to supported sources."""
    value = deepcopy(value)
    if path == 'data.snbt':
        return {**deepcopy(FILE_DEFAULTS), **value}
    if not path.startswith('chapters/'):
        return value
    value = {'default_hide_dependency_lines': False, 'default_quest_shape': '', 'images': [], 'quest_links': [], **value}
    for quest in value['quests']:
        for key in ['dependencies', 'rewards']:
            if not quest[key]:
                quest.pop(key)
        for task in quest['tasks']:
            if task['type'] == 'item':
                task['item'].setdefault('count', 1)
                task['item'] = Inline(task['item'])
                if task['count'].value == 1:
                    task.pop('count')
            elif task['type'] == 'advancement':
                task.setdefault('criterion', '')
        for reward in quest.get('rewards', []):
            if reward['type'] == 'item':
                reward['item'].setdefault('count', 1)
                if reward['count'] == 1:
                    reward.pop('count')
                if reward.get('random_bonus') == 0:
                    reward.pop('random_bonus')
                if reward.get('only_one') is False:
                    reward.pop('only_one')
    return value


def snbt(value, indent=0):
    """Write the supported FTB SNBT subset without guessing types of strings."""
    if isinstance(value, Number):
        return str(value.value) + {'byte': 'b', 'short': 's', 'int': '', 'long': 'L', 'float': 'f', 'double': 'd'}[value.kind]
    if type(value) is bool:
        return '1b' if value else '0b'
    if type(value) is int:
        if not -(2**31) <= value < 2**31:
            raise ValueError('Native int outside range; use an explicit typed number')
        return str(value)
    if type(value) is float:
        if not math.isfinite(value):
            raise ValueError('Nonfinite native number')
        return repr(value) + 'd'
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, dict):
        if not value:
            return '{}'
        pad = '\t' * (indent + 1)
        return '{\n' + '\n'.join(pad + json.dumps(k) + ': ' + snbt(v, indent + 1) for k, v in value.items()) + '\n' + '\t' * indent + '}'
    if isinstance(value, list):
        if not value:
            return '[]'
        # Native NBT lists must have one element type. Booleans are bytes, not ints.
        if len({tag_kind(v) for v in value}) != 1:
            raise ValueError('Native lists must have one element type')
        pad = '\t' * (indent + 1)
        return '[\n' + '\n'.join(pad + snbt(v, indent + 1) for v in value) + '\n' + '\t' * indent + ']'
    raise ValueError(f'Unsupported native value: {type(value).__name__}')


def fields(value, allowed, where):
    if not isinstance(value, dict) or set(value) - allowed:
        raise ValueError(f'{where}: unsupported fields {set(value) - allowed if isinstance(value, dict) else value}')
    return deepcopy(value)


def native(value, kind):
    base = {'tags', 'custom_id'} | ({'disable_toast'} if kind in {'chapter', 'quest'} else set())
    result = fields(value, NATIVE_FIELDS[kind] | (base if kind != 'file' else set()), kind)
    if 'icon' in result:
        # Pinned FTB reads a SINGLE_ITEM_CODEC compound here, not an item string.
        if isinstance(result['icon'], str):
            result['icon'] = {'id': result['icon']}
        stack(result['icon'], single=True)
    enums = {'progression_mode': {'linear', 'flexible'} | (set() if kind == 'file' else {'default'}),
             'auto': {'default', 'disabled', 'enabled', 'no_toast', 'invisible'},
             'default_autoclaim_rewards': {'disabled', 'enabled', 'no_toast', 'invisible'},
             'dependency_requirement': {'all_completed', 'one_completed', 'all_started', 'one_started'}}
    for key, field in result.items():
        if key == 'icon':
            continue
        if key in enums:
            valid = isinstance(field, str) and field in enums[key]
        elif key in {'shape', 'default_quest_shape', 'custom_id', 'fallback_locale'}:
            valid = isinstance(field, str)
        elif key == 'autofocus_id':
            code(field)
            valid = True
        elif key in {'min_required_dependencies', 'default_min_width'}:
            valid = type(field) is int and 0 <= field < 2**31
        elif key in {'size', 'default_quest_size'}:
            valid = type(field) in (float, int) and math.isfinite(field) and field > 0
        elif key == 'tags':
            valid = isinstance(field, list) and all(isinstance(v, str) for v in field)
        else:
            valid = type(field) is bool
        if not valid:
            raise ValueError(f'{kind}/{key}: invalid native value {field!r}; omit an inherited setting instead of encoding a default of another type')
    return result


def stack(value, single=False):
    fields(value, {'id', 'components'} if single else {'id', 'count', 'components'}, 'native item stack')
    if not isinstance(value.get('id'), str) or not re.fullmatch(r'[a-z0-9_.-]+:[a-z0-9_./-]+', value['id']):
        raise ValueError('Native stack requires a namespaced item ID')
    if 'count' in value:
        positive(value['count'])
    if 'components' in value and not isinstance(value['components'], dict):
        raise ValueError('Native stack components must be an object')


def code(value):
    if not isinstance(value, str) or not CODE.fullmatch(value) or not 1 < int(value, 16) < 2**63:
        raise ValueError(f'Expected an unreserved positive signed-long uppercase 16-digit FTB ID (0 and 1 are native-owned): {value!r}')
    return value


def positive(value, maximum=2**31 - 1):
    if type(value) is not int or not 1 <= value <= maximum:
        raise ValueError('Expected a positive count inside the native range')
    return value


def item_filter(value):
    """An authored union or tag, interpreted through the optional native FTB adapter."""
    fields(value, {'items', 'tag'}, 'item alternatives')
    valid_id = lambda v: isinstance(v, str) and len(v) <= 256 and re.fullmatch(r'[a-z0-9_.-]+:[a-z0-9_./-]+', v)
    if set(value) == {'items'}:
        values = value['items']
        if (not isinstance(values, list) or not 1 <= len(values) <= 64 or not all(valid_id(v) for v in values)
                or len(set(values)) != len(values)):
            raise ValueError('Item alternatives require 1–64 unique namespaced item IDs')
    elif set(value) != {'tag'} or not valid_id(value['tag']):
        raise ValueError('Choose one item tag or an explicit item list')
    return {'id': 'minecraft:paper', 'count': 1, 'components': {
        'minecraft:custom_data': {'skyweave_compat:quest_items': {'schema': 1, **deepcopy(value)}}}}


def read_sources(root):
    source = root / 'authoring/quests'
    result = {'quests/book.json': json.loads((source / 'book.json').read_text(encoding='utf-8'))}
    for folder in ['chapters', 'locales']:
        for file in sorted((source / folder).glob('*.json')):
            if not KEY.fullmatch(file.stem):
                raise ValueError(f'Invalid source filename: {file.name}')
            result[f'quests/{folder}/{file.name}'] = json.loads(file.read_text(encoding='utf-8'))
    return result


def compile_quests(documents):
    book = fields(documents['quests/book.json'], {'schema', 'native', 'groups'}, 'book')
    if book['schema'] != 1:
        raise ValueError('Unsupported quest schema')
    chapters = [(path, doc) for path, doc in documents.items() if path.startswith('quests/chapters/')]
    for path, chapter in chapters:
        if type(chapter.get('order', 0)) is not int or not 0 <= chapter.get('order', 0) < 2**31:
            raise ValueError(f'{path}: chapter order must be a nonnegative integer')
    chapters.sort(key=lambda entry: (entry[1].get('order', 0), entry[0]))
    locales = {path.rsplit('/', 1)[-1][:-5]: doc for path, doc in documents.items() if path.startswith('quests/locales/')}
    if 'en_us' not in locales:
        raise ValueError('English fallback is required')
    objects = {}
    quests = {}
    source_keys = set()
    def register(row, kind):
        id = code(row['id'])
        if id in objects:
            raise ValueError(f'Duplicate native object ID: {id}')
        objects[id] = kind
        return id
    groups = []
    for row in book.get('groups', []):
        fields(row, {'id', 'key', 'native'}, 'group source')
        groups.append({'id': register(row, 'chapter_group'), **native(row.get('native', {}), 'group')})
    group_ids = {row['id'] for row in groups}
    output = {'data.snbt': {'version': FORMAT_VERSION, **native(book.get('native', {}), 'file')},
              'chapter_groups.snbt': {'chapter_groups': groups}}
    for order, (path, chapter) in enumerate(chapters):
        filename = Path(path).stem
        if not KEY.fullmatch(filename):
            raise ValueError('Invalid chapter filename')
        fields(chapter, {'schema', 'id', 'group', 'order', 'native', 'quests'}, path)
        if chapter['schema'] != 1:
            raise ValueError('Unsupported chapter schema')
        id = register(chapter, 'chapter')
        group = chapter.get('group', '')
        if group and group not in group_ids:
            raise ValueError('Unknown chapter group')
        compiled = {'id': id, 'filename': filename, 'group': group, 'order_index': order,
                    **native(chapter.get('native', {}), 'chapter'), 'quests': []}
        for row in chapter['quests']:
            fields(row, {'id', 'key', 'x', 'y', 'dependencies', 'native', 'tasks', 'rewards', 'covers'}, 'quest source')
            key = row.get('key')
            if not isinstance(key, str) or not KEY.fullmatch(key) or key in source_keys:
                raise ValueError('Quest source keys must be unique lowercase identifiers')
            source_keys.add(key)
            covers = row.get('covers', [])
            if (not isinstance(covers, list)
                    or any(not isinstance(value, str) or not re.fullmatch(r'[a-z0-9_]+/[a-z0-9_]+', value) for value in covers)
                    or len(set(covers)) != len(covers)):
                raise ValueError(f'{key}: invalid legacy coverage references')
            qid = register(row, 'quest')
            if not row.get('tasks'):
                raise ValueError(f'{qid}: a task is required')
            for axis in ['x', 'y']:
                if type(row[axis]) not in (int, float) or not math.isfinite(row[axis]):
                    raise ValueError(f'{qid}: finite positions are required')
            quest = {'id': qid, 'x': float(row['x']), 'y': float(row['y']), **native(row.get('native', {}), 'quest'),
                     'dependencies': row.get('dependencies', []), 'tasks': [], 'rewards': []}
            if (not isinstance(quest['dependencies'], list)
                    or any(not isinstance(id, str) for id in quest['dependencies'])
                    or len(set(quest['dependencies'])) != len(quest['dependencies'])):
                raise ValueError(f'{qid}: dependencies must be a list of unique quest IDs')
            if quest.get('min_required_dependencies', 0) > len(quest['dependencies']):
                raise ValueError(f'{qid}: required dependency count exceeds the available dependencies')
            quests[qid] = quest
            for task in row['tasks']:
                kind = task.get('type')
                if kind not in TASK_FIELDS:
                    raise ValueError(f'{qid}: unsupported native task type {kind}')
                fields(task, {'id', 'type', 'native'} | TASK_FIELDS[kind], 'task source')
                compiled_task = {'id': register(task, 'task'), 'type': kind, **native(task.get('native', {}), 'task')}
                compiled_task.update({k: deepcopy(v) for k, v in task.items() if k in TASK_FIELDS[kind] and k != 'match'})
                for key in ['consume_items', 'only_from_crafting']:
                    if key in task and type(task[key]) is not bool:
                        raise ValueError(f'{key} must be a boolean; omit it to inherit')
                if 'match_components' in task and (not isinstance(task['match_components'], str)
                        or task['match_components'] not in {'none', 'fuzzy', 'strict'}):
                    raise ValueError('Unknown native component matching mode')
                if kind == 'item':
                    if ('item' in task) == ('match' in task):
                        raise ValueError('Item task requires one native stack or item selector')
                    if 'match' in task:
                        if task.get('match_components', 'strict') != 'strict':
                            raise ValueError('Item alternatives require strict fallback matching')
                        compiled_task['item'] = item_filter(task['match'])
                        compiled_task['match_components'] = 'strict'
                    else:
                        stack(task['item'])
                        if task['item'].get('count', 1) != 1:
                            raise ValueError('Use the task count for its amount; the native filter stack has count one')
                    # JSON is also edited in browsers. Keep counts exact there;
                    # native emission still uses LongTag rather than IntTag.
                    compiled_task['count'] = Number(positive(task.get('count', 1), 2**53 - 1), 'long')
                if kind == 'advancement':
                    if not isinstance(task.get('advancement'), str) or not re.fullmatch(r'[a-z0-9_.-]+:[a-z0-9_./-]+', task['advancement']):
                        raise ValueError('Advancement task requires a namespaced advancement ID')
                    if 'criterion' in task and not isinstance(task['criterion'], str):
                        raise ValueError('Advancement criterion must be text')
                if kind == 'interaction':
                    if (task.get('interaction_type') != 'block' or not isinstance(task.get('to_interact'), str)
                            or not re.fullmatch(r'[a-z0-9_.-]+:[a-z0-9_./-]+', task['to_interact'])):
                        raise ValueError('Supported interaction tasks require a namespaced block ID')
                quest['tasks'].append(compiled_task)
            for reward in row.get('rewards', []):
                kind = reward.get('type')
                if kind not in REWARD_FIELDS:
                    raise ValueError(f'{qid}: unsupported native reward type {kind}')
                fields(reward, {'id', 'type', 'native'} | REWARD_FIELDS[kind], 'reward source')
                compiled_reward = {'id': register(reward, 'reward'), 'type': kind, **native(reward.get('native', {}), 'reward')}
                compiled_reward.update({k: deepcopy(v) for k, v in reward.items() if k in REWARD_FIELDS[kind]})
                if kind == 'item':
                    if 'item' not in reward:
                        raise ValueError('Item reward requires a native stack')
                    stack(reward['item'])
                    compiled_reward['count'] = positive(reward.get('count', 1))
                    if 'random_bonus' in reward and (type(reward['random_bonus']) is not int or not 0 <= reward['random_bonus'] < 2**31):
                        raise ValueError('Random bonus must be a nonnegative native integer')
                    if 'only_one' in reward and type(reward['only_one']) is not bool:
                        raise ValueError('Only-one reward policy must be a boolean')
                else:
                    compiled_reward[kind] = positive(reward.get(kind))
                quest['rewards'].append(compiled_reward)
            compiled['quests'].append(quest)
        output['chapters/' + filename + '.snbt'] = compiled
    def visit(id, stack, done):
        if id in stack:
            raise ValueError(f'Cyclic quest dependency at {id}')
        if id in done:
            return
        stack.add(id)
        for dependency in quests[id]['dependencies']:
            if dependency not in quests:
                raise ValueError(f'Unknown quest dependency: {dependency}')
            visit(dependency, stack, done)
        stack.remove(id)
        done.add(id)
    done = set()
    for id in quests:
        visit(id, set(), done)
    english = locales['en_us']
    fields(english, {'schema', 'shared', 'objects'}, 'English locale')
    if set(english['objects']) != set(objects):
        raise ValueError('English text IDs must match all native objects')
    for locale, text in locales.items():
        fields(text, {'schema', 'shared', 'objects'}, locale)
        if text['schema'] != 1 or set(text.get('objects', {})) - set(objects):
            raise ValueError(f'{locale}: unknown locale schema/objects')
        shared = {**english.get('shared', {}), **text.get('shared', {})}
        language = {}
        for id, kind in objects.items():
            words = {**english['objects'][id], **text.get('objects', {}).get(id, {})}
            allowed = {'title'} | ({'quest_subtitle', 'quest_desc'} if kind == 'quest' else {'chapter_subtitle'} if kind == 'chapter' else set())
            fields(words, allowed, f'{locale}/{id}')
            if not isinstance(words.get('title'), str) or not words['title'].strip():
                raise ValueError(f'{locale}/{id}: title is required')
            for key, value in words.items():
                if key in {'quest_desc', 'chapter_subtitle'}:
                    if not isinstance(value, list):
                        raise ValueError(f'{key} must be a list of paragraphs')
                    value = [shared[p['shared']] if isinstance(p, dict) and set(p) == {'shared'} else p for p in value]
                    if any(not isinstance(p, str) for p in value):
                        raise ValueError('Description paragraphs must be text or shared references')
                elif not isinstance(value, str):
                    raise ValueError('Title/subtitle must be text')
                language[f'{kind}.{id}.{key}'] = value
        output[f'lang/{locale}.snbt'] = language
    return {'overrides/common/config/ftbquests/quests/' + path: ftb_snbt(definition_shape(path, data)) + '\n' for path, data in output.items()}


NATIVE_ROOT = 'overrides/common/config/ftbquests/quests/'
MANIFEST = NATIVE_ROOT + '.skyweave-generated.json'


def quest_policies(text, current, retired):
    """Own exact generated-file policies without reserializing foreign YAML."""
    lines = text.splitlines(keepends=True)
    headers = [index for index, line in enumerate(lines) if re.match(r'^policies:\s*(?:#.*)?$', line)]
    if len(headers) > 1:
        raise ValueError('Duplicate policies in empack.bindings.yml')
    if not headers:
        if re.search(r'^policies:', text, re.MULTILINE):
            raise ValueError('Quest policies require a block mapping in empack.bindings.yml')
        lines = [text.rstrip() + '\n', '\n', 'policies:\n']
        headers = [2]
    start = headers[0] + 1
    end = next((index for index in range(start, len(lines)) if re.match(r'^[^\s#]', lines[index])), len(lines))
    policy = re.compile(r'^  [\"\']?(config/ftbquests/quests/(?:[a-z0-9_/]+\.snbt|\.skyweave-generated\.json))[\"\']?:')
    kept = [line for line in lines[start:end] if not (match := policy.match(line)) or match[1] not in current | retired]
    return ''.join(lines[:start] + kept + [f'  {name}: managed\n' for name in sorted(current)] + lines[end:])


def generation_plan(root, outputs):
    """Detect native edits before scheduling any write; never parse them away."""
    import hashlib
    digest = lambda text: hashlib.sha256(text if isinstance(text, bytes) else text.encode('utf-8')).hexdigest()
    previous = {}
    if (root / MANIFEST).is_file():
        manifest = json.loads((root / MANIFEST).read_text(encoding='utf-8'))
        fields(manifest, {'schema', 'files'}, 'generated manifest')
        if manifest['schema'] != 1 or not isinstance(manifest['files'], dict):
            raise ValueError('Invalid generated quest manifest')
        previous = manifest['files']
    for name, expected in previous.items():
        suffix = name.removeprefix(NATIVE_ROOT)
        if not name.startswith(NATIVE_ROOT) or not re.fullmatch(r'(?:chapters/|lang/)?[a-z0-9_]+\.snbt', suffix):
            raise ValueError('Invalid managed quest output path')
        if not isinstance(expected, str) or not re.fullmatch(r'[a-f0-9]{64}', expected):
            raise ValueError('Invalid managed quest output hash')
        file = root / name
        if not file.is_file() or digest(file.read_bytes()) != expected:
            if name not in outputs or not file.is_file() or file.read_bytes() != outputs[name].encode('utf-8'):
                raise ValueError(f'Native quest edit conflict: {name}. Apply the change to authoring/quests or restore the last generated file; no outputs were written.')
    for file in (root / NATIVE_ROOT).rglob('*.snbt'):
        name = file.relative_to(root).as_posix()
        if name not in previous and (name not in outputs or file.read_bytes() != outputs[name].encode('utf-8')):
            raise ValueError(f'Unowned native quest file: {name}. Reconcile it before generating; no outputs were written.')
    result = dict(outputs)
    result[MANIFEST] = json.dumps({'schema': 1, 'files': {name: digest(text) for name, text in sorted(outputs.items())}}, indent=2) + '\n'
    bindings = root / 'empack.bindings.yml'
    current = {name.removeprefix('overrides/common/') for name in result}
    retired = {name.removeprefix('overrides/common/') for name in set(previous) - set(outputs)}
    result['empack.bindings.yml'] = quest_policies(bindings.read_text(encoding='utf-8') if bindings.exists() else 'schema: 1\nbindings: {}\n', current, retired)
    changed = [name for name, text in result.items() if not (root / name).is_file() or (root / name).read_bytes() != text.encode('utf-8')]
    removed = sorted(set(previous) - set(outputs))
    return result, changed, removed
