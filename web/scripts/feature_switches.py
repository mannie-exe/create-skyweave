"""Read the authored boolean subset of Compat's startup properties file."""
import re

FILENAME = 'skyweave_compat-features.properties'


def parse_feature_switches(text):
    values = {}
    for number, line in enumerate(text.splitlines(), 1):
        line = line.strip()
        if not line or line.startswith(('#', '!')):
            continue
        match = re.fullmatch(r'([a-z_]+\.[a-z_]+)\s*=\s*(true|false)', line)
        if match is None:
            raise ValueError(f'{FILENAME}:{number}: expected feature.key=true or false')
        key, value = match.groups()
        if key in values:
            raise ValueError(f'{FILENAME}:{number}: duplicate feature {key}')
        values[key] = value == 'true'
    return values
