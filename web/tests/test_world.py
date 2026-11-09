import sys, unittest, tempfile, gzip, struct, json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import numpy as np
from world import chunk_locations, palette_indices, chunk_metrics, survey_source

class WorldTests(unittest.TestCase):
    def test_empty_pregen_placeholder_is_not_1024_chunks(self):
        self.assertEqual(chunk_locations(b''),[])
        self.assertEqual(chunk_locations(bytes(4096)),[])
        header=bytearray(4096);header[0:4]=bytes([0,0,2,1])
        self.assertEqual(chunk_locations(header),[(0,2)])
    def test_truncated_header_is_rejected(self):
        with self.assertRaises(ValueError):chunk_locations(b'\0'*10)
    def test_palette_padded_longs(self):
        values=np.array([i%17 for i in range(4096)],dtype=np.uint64)
        words=np.zeros(342,dtype=np.uint64)
        for i,v in enumerate(values):words[i//12]|=v<<np.uint64((i%12)*5)
        result=palette_indices({'palette':[{}]*17,'data':words})
        np.testing.assert_array_equal(result,values)
    def test_ore_y_and_land_columns(self):
        result=chunk_metrics({'sections':[{'Y':-2,'block_states':{'palette':[{'Name':'minecraft:iron_ore'}]}}]})
        self.assertEqual(result['ores']['minecraft:iron_ore'],4096)
        self.assertEqual(result['levels']['minecraft:iron_ore']['-32'],256)
        self.assertEqual(result['landColumns'],256)

class ProvenanceTests(unittest.TestCase):
    def test_seed_is_exact_and_player_data_is_not_exported(self):
        def string(value):
            raw=value.encode(); return struct.pack('>H',len(raw))+raw
        def tag(name,value):
            if isinstance(value,dict): return b'\x0a'+string(name)+b''.join(tag(k,v) for k,v in value.items())+b'\x00'
            if isinstance(value,int): return b'\x04'+string(name)+struct.pack('>q',value)
            return b'\x08'+string(name)+string(value)
        seed=-9007199254740993
        data={'Data':{'WorldGenSettings':{'seed':seed,'dimensions':{'minecraft:overworld':{'type':'skyweave_compat:islands_v1','generator':{'type':'sky_archipelago:sky_island','settings':'skyweave_compat:islands_v1'}}}},'Player':{'private':'omit'}}}
        with tempfile.TemporaryDirectory() as temporary:
            world=Path(temporary)
            (world/'level.dat').write_bytes(gzip.compress(tag('',data)))
            (world/'skyweave-generation.json').write_text(json.dumps({'seed':seed,'dimension':{'min_y':-128,'height':896}}))
            result=survey_source(world)
            self.assertEqual(result['seed'],str(seed))
            self.assertEqual(result['generationIdentity']['seed'],str(seed))
            self.assertEqual(result['dimensionType'],'skyweave_compat:islands_v1')
            self.assertEqual(len(result['generationIdentitySha256']),64)
            self.assertNotIn('Player',json.dumps(result))
            self.assertNotIn('private',json.dumps(result))
            (world/'create-sky-generation.json').write_text('{}')
            with self.assertRaises(ValueError): survey_source(world)
            (world/'skyweave-generation.json').unlink()
            (world/'create-sky-generation.json').unlink()
            self.assertIsNone(survey_source(world)['generationIdentity'])

if __name__=='__main__':unittest.main()
