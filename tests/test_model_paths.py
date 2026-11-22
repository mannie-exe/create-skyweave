"""Independent path silhouettes, closed holes, interfaces and UV continuity."""
import copy
import io
import json
import math
from collections import Counter, defaultdict
from pathlib import Path
import sys
import unittest
from zipfile import ZipFile

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from model_composition import compose, path_solids, cross, dot, obj_assets
from model_paths import path_definition
from model_authoring import generate, encode_rgba
from obj_geometry import read_obj


def path(**fields):
    return {'id':'elbow','kind':'path','plane':'xy','points':[[3,3],[9,3],[9,9]],
            'width':1,'depth':1,'texture':'#surface','projection':'strip',
            'uv':{'surface':[0,0,16,16],'edge':[0,0,16,16],'cap':[0,0,16,16]},**fields}


def triangles(meshes):
    for mesh in meshes:
        yield [mesh['positions'][i:i+3] for i in (0,3,6)]


def metrics(meshes):
    volume=area=0
    edges=Counter()
    for a,b,c in triangles(meshes):
        volume += dot(a,cross(b,c))/6
        ab,ac = [[v[i]-a[i] for i in range(3)] for v in (b,c)]
        value=cross(ab,ac)
        area += math.sqrt(dot(value,value))/2
        for p,q in ((a,b),(b,c),(c,a)):
            edge=tuple(sorted((tuple(round(v,8) for v in p),tuple(round(v,8) for v in q))))
            edges[edge]+=1
    return volume,area,edges


class PathProfiles(unittest.TestCase):
    def assert_closed_surface(self, meshes):
        volume,area,edges=metrics(meshes)
        self.assertGreater(volume,0)
        self.assertTrue(all(n==2 for n in edges.values()), {e:n for e,n in edges.items() if n!=2})
        return volume,area

    def test_butt_and_bevel_have_the_expected_volume_and_no_internal_or_unmatched_edges(self):
        for joint in ('miter','butt','bevel'):
            with self.subTest(joint=joint):
                part=path(joint=joint)
                before=copy.deepcopy(part)
                _,meshes,_=compose([part])
                volume,area=self.assert_closed_surface(meshes)
                self.assertAlmostEqual(volume,12 if joint!='bevel' else 11.875)
                self.assertAlmostEqual(area,50 if joint!='bevel' else 49.45710678118655)
                self.assertEqual(part,before)
                self.assertEqual(obj_assets('geometry',meshes),obj_assets('geometry',compose([part])[1]))
                if joint=='butt': self.assertTrue(any('/grain' in f['name'] for f in meshes))
                if joint=='bevel': self.assertTrue(any('/join/' in f['name'] for f in meshes))

    def test_oblique_left_and_right_turns_match_independent_stroke_area(self):
        for angle in (45,60,90,120,-45,-60,-90,-120):
            theta=math.radians(angle)
            points=[[3,7],[9,7],[9+6*math.cos(theta),7+6*math.sin(theta)]]
            half=0.5
            cut=half*half*(math.tan(abs(theta)/2)-math.sin(abs(theta))/2)
            perimeter_cut=2*half*(math.tan(abs(theta)/2)-math.sin(abs(theta)/2))
            for joint in ('miter','butt','bevel'):
                with self.subTest(angle=angle,joint=joint):
                    _,meshes,_=compose([path(points=points,joint=joint)])
                    volume,area=self.assert_closed_surface(meshes)
                    expected=12-(cut if joint=='bevel' else 0)
                    self.assertAlmostEqual(volume,expected)
                    self.assertAlmostEqual(area,2*expected+26-(perimeter_cut if joint=='bevel' else 0))

    def test_ring_holes_winding_and_all_plane_orientations_are_preserved(self):
        count,radius,half=8,4,0.5
        points=[[8+radius*math.cos(2*math.pi*i/count),8+radius*math.sin(2*math.pi*i/count)] for i in range(count)]
        perimeter=2*count*radius*math.sin(math.pi/count)
        cut=count*half*half*(math.tan(math.pi/count)-math.sin(2*math.pi/count)/2)
        perimeter_cut=2*count*half*(math.tan(math.pi/count)-math.sin(math.pi/count))
        for plane in ('xy','yz','xz'):
            for winding in (points,[points[0],*reversed(points[1:])]):
                for joint in ('miter','butt','bevel'):
                    with self.subTest(plane=plane,joint=joint,clockwise=winding is not points):
                        part=path(points=winding,closed=True,joint=joint,plane=plane)
                        _,meshes,_=compose([part])
                        volume,area=self.assert_closed_surface(meshes)
                        expected=perimeter-(cut if joint=='bevel' else 0)
                        self.assertAlmostEqual(volume,expected)
                        self.assertAlmostEqual(area,2*expected+2*perimeter-(perimeter_cut if joint=='bevel' else 0))
                        center={'xy':[8,8,0],'yz':[0,8,8],'xz':[8,0,8]}[plane]
                        for solid in path_solids(part):
                            self.assertFalse(all(dot(center,axis)<distance-1e-7 for axis,distance in solid['planes']))

    def test_strip_front_and_side_vertices_have_identical_uvs_at_shared_interfaces(self):
        for joint in ('miter','butt','bevel'):
            _,meshes,_=compose([path(joint=joint)])
            for kind in ('/front','/edge/'):
                samples=defaultdict(set)
                for mesh in meshes:
                    if kind not in mesh['name']: continue
                    for i in range(3):
                        p=tuple(round(v,8) for v in mesh['positions'][i*3:i*3+3])
                        samples[p].add(tuple(round(v,8) for v in mesh['uv'][i*2:i*2+2]))
                self.assertTrue(all(len(values)==1 for values in samples.values()), (joint,kind,samples))

    def test_bounds_projection_is_one_global_affine_map_and_open_caps_are_explicit(self):
        for joint in ('miter','butt','bevel'):
            _,meshes,_=compose([path(joint=joint,projection='bounds')])
            points=[p for triangle in triangles(meshes) for p in triangle]
            low=[min(p[i] for p in points) for i in (0,1)]
            high=[max(p[i] for p in points) for i in (0,1)]
            for mesh in meshes:
                if '/front' not in mesh['name']:continue
                for i in range(3):
                    x,y=mesh['positions'][i*3:i*3+2]
                    self.assertAlmostEqual(mesh['uv'][i*2],(x-low[0])/(high[0]-low[0]))
                    self.assertAlmostEqual(mesh['uv'][i*2+1],(y-low[1])/(high[1]-low[1]))
            _,open_meshes,_=compose([path(joint=joint,cap_start=False,cap_end=False)])
            self.assertFalse(any(f['name'].endswith(('/start','/end')) for f in open_meshes))
            self.assertLess(metrics(open_meshes)[1],metrics(meshes)[1])

    def test_closed_strip_has_only_its_declared_zero_to_one_seam(self):
        for joint in ('miter','butt','bevel'):
            part=path(points=[[4,4],[10,4],[10,10],[4,10]],closed=True,joint=joint)
            _,meshes,_=compose([part])
            samples=defaultdict(set)
            for mesh in meshes:
                if '/front' not in mesh['name']:continue
                for i in range(3):
                    p=tuple(round(v,8) for v in mesh['positions'][i*3:i*3+3])
                    samples[p].add(tuple(round(v,8) for v in mesh['uv'][i*2:i*2+2]))
            seams=0
            for values in samples.values():
                if len(values)==1:continue
                seams+=1
                self.assertEqual(len(values),2,(joint,values))
                self.assertEqual({uv[1] for uv in values},{0,1},(joint,values))
                self.assertEqual(len({uv[0] for uv in values}),1,(joint,values))
            self.assertEqual(seams,2,joint)

    def test_opaque_clipping_does_not_change_already_disjoint_joint_cells(self):
        for joint in ('miter','butt','bevel'):
            _,plain,_=compose([path(joint=joint)])
            _,opaque,_=compose([path(joint=joint,occlusion='opaque')])
            expected=metrics(plain)
            volume,area=self.assert_closed_surface(opaque)
            self.assertAlmostEqual(volume,expected[0])
            self.assertAlmostEqual(area,expected[1])

    def test_repetition_reflection_and_quarter_turn_keep_winding_and_leg_provenance(self):
        source=path(joint='butt',route={'start':[3,3],'heading':0,'legs':[
            {'id':'across','length':6},{'id':'rise','length':6,'turn':90}]})
        source.pop('points')
        group={'id':'frame','kind':'group','parts':[source],
               'repeat':{'id':'copies','count':2,'step':[0,0,2]},
               'transform':{'id':'pose','mirror':'x','rotation':{'axis':'y','angle':90}}}
        _,meshes,provenance=compose([group])
        volume,area=self.assert_closed_surface(meshes)
        self.assertAlmostEqual(volume,24)
        self.assertAlmostEqual(area,100)
        self.assertTrue(any('/leg/rise/' in f['name'] for f in meshes))
        self.assertTrue(any('/copies/1/' in f['name'] for f in meshes))
        self.assertEqual(provenance[1]['groups'],['frame'])

    def test_lengths_and_turns_share_geometry_with_points_and_keep_leg_ids(self):
        part=path(route={'start':[3,3],'heading':0,'legs':[{'id':'across','length':6},{'id':'rise','length':6,'turn':90}]})
        part.pop('points')
        before=copy.deepcopy(part)
        points,names=path_definition(part)
        self.assertEqual(points,[[3,3],[9,3],[9,9]])
        self.assertEqual(names,['elbow/leg/across','elbow/leg/rise'])
        route=compose([part])[1]
        reference=compose([path()])[1]
        self.assertEqual([{k:v for k,v in f.items() if k!='name'} for f in route],
                         [{k:v for k,v in f.items() if k!='name'} for f in reference])
        self.assertTrue(all('/leg/' in f['name'] for f in route))
        self.assertEqual(part,before)
        part['route']['legs'][0]['id']='renamed'
        renamed=compose([part])[1]
        self.assertEqual([f for f in renamed if '/rise/' in f['name']],[f for f in route if '/rise/' in f['name']])

    def test_closed_routes_require_a_declared_closing_leg_and_exact_cardinals(self):
        part=path(closed=True,route={'start':[4,4],'heading':0,'legs':[
            {'id':'east','length':4},{'id':'north','length':4,'turn':90},
            {'id':'west','length':4,'turn':90},{'id':'south','length':4,'turn':90}]})
        part.pop('points')
        self.assertEqual(path_definition(part)[0],[[4,4],[8,4],[8,8],[4,8]])
        self.assert_closed_surface(compose([part])[1])
        part['route']['legs'][-1]['length']=3.9
        with self.assertRaisesRegex(ValueError,'closing route'):compose([part])

    def test_invalid_routes_and_unsafe_or_ambiguous_joins_are_refused(self):
        source=path()
        for fields in ({'joint':'round'},{'joint':'bevel','projection':'legacy'},
                       {'joint':'butt','projection':'legacy'},{'projection':'guess'},
                       {'joint':'butt','points':[[3,3],[9,3],[15,3.01]]},
                       {'joint':'bevel','points':[[3,3],[9,3],[3,3]]},
                       {'joint':'butt','points':[[3,3],[3.1,3],[3.1,3.1]]}):
            with self.subTest(fields=fields),self.assertRaises(ValueError):compose([{**source,**fields}])
        for route in (None,{}, {'start':[3,3],'heading':0,'legs':[]},
                      {'start':[3,3],'heading':True,'legs':[{'id':'a','length':1}]},
                      {'start':[3,3],'heading':0,'legs':[{'id':'a','length':0}]},
                      {'start':[3,3],'heading':0,'legs':[{'id':'a','length':True}]},
                      {'start':[3,3],'heading':0,'legs':[{'id':'a','length':float('nan')}]},
                      {'start':[3,3],'heading':0,'legs':[{'id':'a','length':1,'turn':181}]},
                      {'start':[3,3],'heading':0,'legs':[{'id':'a','length':1,'label':True}]},
                      {'start':[3,3],'heading':0,'legs':[{'id':'a','length':1,'label':''}]},
                      {'start':[3,3],'heading':0,'legs':[{'id':'a','length':1,'read':'previous'}]},
                      {'start':[3,3],'heading':0,'legs':[{'id':'a','length':1},{'id':'a','length':1}]}):
            part={**source,'route':route};part.pop('points')
            with self.subTest(route=route),self.assertRaises(ValueError):compose([part])
        with self.assertRaisesRegex(ValueError,'not both'):
            compose([{**source,'route':{'start':[3,3],'heading':0,'legs':[{'id':'a','length':1}]}}])

    def test_generated_obj_round_trip_keeps_profiles_uvs_and_disabled_ownership(self):
        data=io.BytesIO()
        with ZipFile(data,'w') as output:
            output.writestr('assets/test/textures/block/white.png',encode_rgba([[(255,255,255,255)]]))
        with ZipFile(data) as archive:
            for joint in ('miter','butt','bevel'):
                recipe={'id':'route','label':'Route','kind':'composition','enabled':True,
                        'output':'test:block/route','texture':{'source':'test','id':'test:block/white'},
                        'parts':[path(joint=joint)]}
                document={'schema':1,'recipes':[recipe]}
                outputs,previews=generate(document,{'test':archive})
                root=outputs['assets/test/models/block/route.json']
                self.assertEqual(root['loader'],'neoforge:obj')
                loaded=read_obj(root,outputs.__getitem__)
                meshes=previews[0]['model']['meshes']
                self.assertEqual(len(loaded),len(meshes))
                for actual,expected in zip(loaded,meshes):
                    for key in ('positions','uv'):
                        for a,b in zip(actual[key],expected[key]):self.assertAlmostEqual(a,b,places=6)
                self.assertEqual(generate(json.loads(json.dumps(document)),{'test':archive}), (outputs,previews))
                recipe['enabled']=False
                self.assertEqual(generate(document,{'test':archive})[0],{})


if __name__=='__main__':unittest.main()
