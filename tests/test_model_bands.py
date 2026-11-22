"""Closed native bands have disjoint cells, real holes and defined UV turns."""
import io
import itertools
import json
import math
from pathlib import Path
import sys
import unittest
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from model_composition import band_elements, compose, cuboid_corners, cuboid_meshes, cross, dot, subtract
from model_authoring import encode_rgba, generate


def band(**patch):
    return {'id': 'belt', 'kind': 'band', 'plane': 'xz', 'origin': [0, 4, 0],
            'rectangle': [0, 0, 16, 16], 'height': 1, 'depth': .5,
            'winding': 'clockwise', 'corner_owner': 'start', 'texture': '#surface',
            'uv': {'surface': [0, 11, 16, 12], 'edge': [0, 11, 16, 12]}, **patch}


def volume(element):
    return math.prod(b-a for a, b in zip(element['from'], element['to']))


class BandTests(unittest.TestCase):
    def test_native_partition_closes_every_corner_without_overlap_or_internal_caps(self):
        for plane, winding, owner in itertools.product(
            ('xy', 'yz', 'xz'), ('clockwise', 'counterclockwise'), ('start', 'end')
        ):
            with self.subTest(plane=plane, winding=winding, owner=owner):
                elements, meshes, provenance = compose([band(plane=plane, winding=winding, corner_owner=owner)])
                self.assertEqual(meshes, [])
                self.assertEqual(len(elements), 8)
                self.assertEqual(provenance, [{'id': 'belt', 'elements': list(range(8))}])
                self.assertAlmostEqual(sum(map(volume, elements)), 17*17-16*16)
                for a, b in itertools.combinations(elements, 2):
                    overlap = math.prod(max(0, min(x1,y1)-max(x0,y0)) for x0,x1,y0,y1 in
                                        zip(a['from'],a['to'],b['from'],b['to']))
                    self.assertEqual(overlap, 0)
                area = 0
                for face in cuboid_meshes(elements):
                    p = [face['positions'][i:i+3] for i in range(0, 12, 3)]
                    direction = cross(subtract(p[1], p[0]), subtract(p[2], p[0]))
                    length = math.sqrt(dot(direction, direction))
                    area += length
                    center = [sum(q[i] for q in p)/4+direction[i]/length*1e-5 for i in range(3)]
                    self.assertFalse(any(all(lo+1e-8 < v < hi-1e-8 for lo, v, hi in
                                             zip(element['from'], center, element['to'])) for element in elements))
                # Both annular faces, outer wall and inner wall; the central hole remains open.
                self.assertAlmostEqual(area, 2*(17*17-16*16)+4*17+4*16)

    def test_winding_and_corner_owner_change_order_and_ownership_not_geometry(self):
        baseline = band_elements(band())
        boxes = sorted((e['from'], e['to']) for e in baseline)
        self.assertTrue(baseline[0]['name'].endswith('/0/corner'))
        self.assertEqual(volume(baseline[0]), .25)
        for patch in ({'winding': 'counterclockwise'}, {'corner_owner': 'end'}):
            changed = band_elements(band(**patch))
            self.assertEqual(sorted((e['from'], e['to']) for e in changed), boxes)
            self.assertNotEqual(changed, baseline)
            if 'corner_owner' in patch:
                self.assertTrue(changed[0]['name'].endswith('/0/run'))
                self.assertTrue(changed[1]['name'].endswith('/0/corner'))

    def test_outer_and_inner_loop_uvs_agree_at_shared_positions(self):
        for winding in ('clockwise', 'counterclockwise'):
            points = {}
            for face in cuboid_meshes(band_elements(band(winding=winding))):
                if face['name'].endswith(('/up', '/down')):
                    continue
                for i in range(4):
                    point = tuple(face['positions'][i*3:i*3+3])
                    # U=0 and U=1 meet at the one deliberate loop seam.
                    uv = (face['uv'][i*2] % 1, face['uv'][i*2+1])
                    if point in points:
                        self.assertAlmostEqual(points[point][0], uv[0])
                        self.assertAlmostEqual(points[point][1], uv[1])
                    points[point] = uv

    def test_side_fitting_preserves_repeated_artwork_orientation_at_every_turn(self):
        elements = band_elements(band(uv_mode='sides'))
        faces = cuboid_meshes(elements)
        for x, z in ((-.5,-.5), (16.5,-.5), (16.5,16.5), (-.5,16.5)):
            u = [face['uv'][i*2] for face in faces if not face['name'].endswith(('/up','/down'))
                 for i in range(4) if face['positions'][i*3:i*3+3] == [x,5,z]]
            self.assertEqual(set(u), {0, 1})

    def test_attachment_has_separate_neighbor_groups_for_unowned_endpoints(self):
        elements = band_elements(band(inner_faces=False, cull_sides=True))
        self.assertEqual(len(elements), 12)
        self.assertEqual(sum(len(e['faces']) for e in elements), 40)
        culled = [(name, face['cullface']) for e in elements for name,face in e['faces'].items() if 'cullface' in face]
        self.assertEqual(len(culled), 40)
        self.assertTrue(all(cull in ('north','east','south','west') for _, cull in culled))
        self.assertAlmostEqual(sum(map(volume, elements)), 17*17-16*16)

    def test_adjacent_filled_bales_keep_one_visible_face_at_each_shared_band_corner(self):
        directions = {'west':(-1,0,0),'east':(1,0,0),'north':(0,0,-1),'south':(0,0,1)}
        def overlaps(winding, owner, offset, old_policy=False):
            elements = band_elements(band(depth=1, inner_faces=False, cull_sides=True,
                                           winding=winding, corner_owner=owner))
            blocks = [(0,0,0), offset]
            faces = []
            for block in blocks:
                for element in elements:
                    for direction, data in element['faces'].items():
                        cull = data['cullface']
                        if old_policy and direction in ('up','down'):
                            cull = None
                        neighbor = tuple(block[i]+16*v for i,v in enumerate(directions[cull])) if cull else None
                        if neighbor in blocks:
                            continue
                        vertices = [[v+block[i] for i,v in enumerate(p)]
                                    for p in cuboid_corners(element['from'],element['to'])[direction]]
                        center = [sum(p[i] for p in vertices)/4 for i in range(3)]
                        if any(other != block and all(other[i] < center[i] < other[i]+16 for i in range(3)) for other in blocks):
                            continue
                        faces.append((block,direction,vertices))
            count = 0
            for (a,da,va),(b,db,vb) in itertools.combinations(faces,2):
                if a == b or da != db:
                    continue
                axis = 1 if da in ('up','down') else 0 if da in ('west','east') else 2
                if va[0][axis] != vb[0][axis]:
                    continue
                other = [i for i in range(3) if i != axis]
                area = math.prod(max(0,min(max(p[i] for p in va),max(p[i] for p in vb))
                                      -max(min(p[i] for p in va),min(p[i] for p in vb))) for i in other)
                count += area > 1e-8
            return count
        self.assertGreater(overlaps('clockwise','start',(16,0,0),old_policy=True),0)
        for winding,owner,offset in itertools.product(('clockwise','counterclockwise'),('start','end'),
                                                      ((16,0,0),(-16,0,0),(0,0,16),(0,0,-16))):
            with self.subTest(winding=winding,owner=owner,offset=offset):
                self.assertEqual(overlaps(winding,owner,offset),0)

    def test_bounds_policies_and_degenerate_holes_fail(self):
        for patch in ({'rectangle': [0,0,0,16]}, {'height': float('nan')}, {'depth': 0},
                      {'origin': [32,0,0]}, {'winding': 'guess'}, {'corner_owner': 'both'},
                      {'uv_mode': 'stretch? '}, {'inner_faces': 1}, {'cull_sides': 'yes'},
                      {'uv': {'surface': [0,0,16,16]}}):
            with self.subTest(patch=patch), self.assertRaises(ValueError):
                band_elements(band(**patch))

    def test_source_and_band_variant_share_explicit_bindings_and_retain_native_base(self):
        template = {'textures': {'side': 'block/side', 'end': 'block/top'},
                    'display': {'gui': {'rotation': [30, 225, 0]}},
                    'elements': [{'from': [0,0,0], 'to': [16,16,16], 'faces': {
                        'up': {'texture': '#end', 'uv': [0,0,16,16], 'cullface': 'up'},
                        'north': {'texture': '#side', 'uv': [0,0,16,16], 'cullface': 'north'}}}]}
        data = io.BytesIO()
        with zipfile.ZipFile(data, 'w') as archive:
            archive.writestr('assets/test/models/block/hay.json', json.dumps(template))
            horizontal = json.loads(json.dumps(template))
            horizontal['elements'][0]['faces']['up']['rotation'] = 180
            archive.writestr('assets/test/models/block/hay_horizontal.json', json.dumps(horizontal))
            for name, color in [('side',(200,50,50,255)), ('top',(200,180,60,255))]:
                archive.writestr('assets/test/textures/block/'+name+'.png', encode_rgba([[color]]))
        bindings = {key: {'source': 'test', 'id': 'test:block/'+name} for key,name in [('side','side'),('end','top')]}
        source = {'source': 'test', 'id': 'test:block/hay'}
        recipe = {'id': 'hay', 'label': 'Hay', 'kind': 'fitting', 'enabled': False,
                  'output': 'test:block/hay', 'texture': bindings['side'], 'texture_bindings': bindings,
                  'model': source, 'edits': [], 'base': {'model': source, 'elements': [0], 'textures': {}},
                  'targets': [{'output': 'test:block/hay_horizontal',
                               'model': {'source': 'test', 'id': 'test:block/hay_horizontal'}}],
                  'variants': [{'id': 'closed', 'label': 'Closed', 'kind': 'composition',
                                'parts': [band(texture='#side', inner_faces=False)]}]}
        document = {'schema': 1, 'recipes': [recipe]}
        with zipfile.ZipFile(data) as archive:
            outputs, previews = generate(document, {'test': archive})
            self.assertEqual(outputs, {})
            self.assertEqual(previews[0]['model']['elements'], template['elements'])
            expected = {key: binding['id'] for key,binding in bindings.items()}
            self.assertEqual(previews[0]['model']['textures'], expected)
            recipe['variant'] = 'closed'
            outputs, previews = generate(document, {'test': archive})
            self.assertEqual(outputs, {})
            model = previews[0]['model']
            self.assertEqual(model['elements'][-1], template['elements'][0])
            self.assertEqual(model['display'], template['display'])
            self.assertEqual(model['textures']['end'], expected['end'])
            recipe['enabled'] = True
            outputs, _ = generate(document, {'test': archive})
            self.assertEqual(list(outputs), ['assets/test/models/block/hay.json','assets/test/models/block/hay_horizontal.json'])
            self.assertTrue(all('loader' not in value for value in outputs.values()))
            self.assertEqual(outputs['assets/test/models/block/hay_horizontal.json']['elements'][-1], horizontal['elements'][0])
            recipe['enabled'] = False
            other = {**recipe, 'id': 'conflict', 'output': 'test:block/hay_horizontal', 'targets': []}
            with self.assertRaisesRegex(ValueError, 'Duplicate generated model'):
                generate({'schema': 1, 'recipes': [recipe,other]}, {'test': archive})


if __name__ == '__main__':
    unittest.main()
