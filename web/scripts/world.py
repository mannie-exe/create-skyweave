"""Read-only stratified Anvil survey. Header census is exact; block counts are estimates.
Run --samples 0 for a complete scan. Records generation identity and seed, never player data.
"""
import argparse, collections, gzip, hashlib, json, math, random, struct, time, zlib
from pathlib import Path
import numpy as np
from paths import ROOT, paths, write_json

class NBT:
    def __init__(self, data): self.data, self.pos = data, 0
    def take(self, n):
        v = self.data[self.pos:self.pos+n]; self.pos += n
        if len(v) != n: raise ValueError('Truncated NBT')
        return v
    def number(self, fmt): return struct.unpack(fmt, self.take(struct.calcsize(fmt)))[0]
    def string(self): return self.take(self.number('>H')).decode('utf-8', errors='replace')
    def payload(self, t):
        if t in range(1,7): return self.number({1:'>b',2:'>h',3:'>i',4:'>q',5:'>f',6:'>d'}[t])
        if t == 7: return self.take(self.number('>i'))
        if t == 8: return self.string()
        if t == 9:
            tag, length = self.number('>B'), self.number('>i')
            return [self.payload(tag) for _ in range(length)]
        if t == 10:
            result = {}
            while (tag := self.number('>B')) != 0:
                key = self.string(); result[key] = self.payload(tag)
            return result
        if t in (11,12):
            length = self.number('>i'); width = 4 if t == 11 else 8
            return np.frombuffer(self.take(length*width), dtype='>i4' if t==11 else '>u8')
        raise ValueError(f'Unknown NBT tag {t}')
    def root(self):
        tag = self.number('>B'); self.string(); return self.payload(tag)

def palette_indices(states):
    palette = states['palette']
    if len(palette) == 1: return np.zeros(4096, dtype=np.uint16)
    bits = max(4, (len(palette)-1).bit_length())
    per = 64 // bits
    words = np.asarray(states['data'], dtype=np.uint64)
    values = ((words[:,None] >> (np.arange(per, dtype=np.uint64)*bits)) & ((1<<bits)-1)).reshape(-1)[:4096]
    if len(values) != 4096 or int(values.max()) >= len(palette): raise ValueError('Invalid palette array')
    return values

def chunk_locations(header):
    if not header: return [] # Pregen leaves empty region placeholders.
    if len(header) != 4096: raise ValueError('Truncated Anvil location header')
    return [(i,int.from_bytes(header[i*4:i*4+3],'big')) for i in range(1024)
            if int.from_bytes(header[i*4:i*4+3],'big') != 0]

def chunk_metrics(chunk):
    ores, levels, blocks = collections.Counter(), {}, collections.Counter()
    land = np.zeros(256, dtype=bool)
    air = {'minecraft:air','minecraft:cave_air','minecraft:void_air'}
    liquids = {'minecraft:water','minecraft:lava'}
    for section in chunk.get('sections', []):
        states = section.get('block_states')
        if not states: continue
        palette = [p['Name'] for p in states['palette']]
        if len(palette)==1 and palette[0] in air: continue
        indices = palette_indices(states)
        counts = np.bincount(indices.astype(np.int64), minlength=len(palette))
        nonair = np.array([name not in air for name in palette])
        solid = np.array([name not in air|liquids for name in palette])
        land |= solid[indices].reshape(16,256).any(axis=0)
        sy = section['Y']*16
        for i,name in enumerate(palette):
            if name not in air: blocks[name] += int(counts[i])
            if name.endswith('_ore') or name in ('minecraft:ancient_debris','minecraft:raw_iron_block','minecraft:raw_copper_block'):
                ores[name] += int(counts[i])
                ys = np.count_nonzero(indices.reshape(16,256)==i, axis=1)
                levels.setdefault(name, {}).update({str(sy+y):int(n) for y,n in enumerate(ys) if n})
    return {'ores': dict(ores), 'levels': levels, 'blocks': dict(blocks), 'landColumns': int(land.sum())}

def survey_source(world):
    level_bytes = (world/'level.dat').read_bytes()
    data = NBT(gzip.decompress(level_bytes)).root()['Data']
    settings = data['WorldGenSettings']
    dimension = settings['dimensions']['minecraft:overworld']
    marker = world/'skyweave-generation.json'
    if (world/'create-sky-generation.json').exists():
        raise ValueError('Retired generation marker; provide the canonical skyweave-generation.json')
    identity_bytes = marker.read_bytes() if marker.exists() else None
    identity = json.loads(identity_bytes) if identity_bytes else None
    if identity and 'seed' in identity: identity['seed'] = str(identity['seed'])
    return {
        'seed': str(settings['seed']),
        'dimensionType': dimension.get('type'),
        'generatorType': dimension['generator'].get('type'),
        'generatorSettings': dimension['generator'].get('settings'),
        'levelDatSha256': hashlib.sha256(level_bytes).hexdigest(),
        'generationIdentitySha256': hashlib.sha256(identity_bytes).hexdigest() if identity_bytes else None,
        'generationIdentity': identity,
    }

def scan(samples, source=None):
    world = source if source is not None else paths()['server']/'world'
    source_metadata = survey_source(world)
    regions = sorted((world/'region').glob('r.*.*.mca'))
    if not regions: raise ValueError('No Overworld region files in the selected source')
    result = {'method':'stratified random chunk sample per region; weights = populated chunks / sampled chunks',
              'samplesPerRegion':samples, 'startedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),
              'regionCount':len(regions),'populatedChunks':0,'sampledChunks':0,'fullChunksSampled':0,
              'regions':[],'ores':{},'byY':{},'blocks':{},'errors':[],'changedRegions':[],
              'limitations':['Overworld only. Existing chunks reflect historical generation, not necessarily current settings.',
                'Non-air blocks and land columns include builds, trees and liquids as labelled; no ore visibility or mining-access assumption.',
                'Region samples cannot establish island connectivity or exact inter-island gaps.',
                'No new chunks are generated; newly added ores are not retro-generated.']}
    result['provenance'] = source_metadata
    ore_est, by_y, block_est = collections.Counter(), {}, collections.Counter()
    for index,path in enumerate(regions):
        before = path.stat(); parts=path.stem.split('.'); rx,rz=int(parts[1]),int(parts[2])
        row={'x':rx,'z':rz,'samples':[]}
        with path.open('rb') as f:
            header=f.read(4096); locations=chunk_locations(header)
            row['chunks']=len(locations); result['populatedChunks']+=len(locations)
            # Stable sampling salt preserves comparable historical world evidence.
            rng=random.Random(f'create-sky-atlas-v1:{rx}:{rz}')
            chosen=locations if samples==0 else rng.sample(locations,min(samples,len(locations)))
            for ci,offset in chosen:
                try:
                    f.seek(offset*4096); length=int.from_bytes(f.read(4),'big'); compression=f.read(1)[0]; body=f.read(length-1)
                    if compression & 128: raise ValueError('External chunk payload; requires separate reader')
                    raw={1:gzip.decompress,2:zlib.decompress,3:lambda b:b}[compression](body)
                    chunk=NBT(raw).root(); status=chunk.get('Status','unknown')
                    metrics=chunk_metrics(chunk)
                    row['samples'].append({'x':rx*32+ci%32,'z':rz*32+ci//32,'status':status,'landColumns':metrics['landColumns'],'ores':metrics['ores']})
                    result['sampledChunks']+=1
                    result['fullChunksSampled']+=status in ('full','minecraft:full')
                    weight=len(locations)/len(chosen)
                    for ore,n in metrics['ores'].items(): ore_est[ore]+=n*weight
                    for block,n in metrics['blocks'].items(): block_est[block]+=n*weight
                    for ore,ys in metrics['levels'].items():
                        target=by_y.setdefault(ore,collections.Counter())
                        for y,n in ys.items(): target[y]+=n*weight
                except Exception as e: result['errors'].append({'region':path.name,'chunk':ci,'error':str(e)})
        after=path.stat()
        if (before.st_mtime_ns,before.st_size)!=(after.st_mtime_ns,after.st_size):result['changedRegions'].append(path.name)
        row['landFraction']=sum(s['landColumns'] for s in row['samples'])/(256*len(row['samples'])) if row['samples'] else None
        result['regions'].append(row)
        if index%500==0: print(f'{index}/{len(regions)} regions, {result["sampledChunks"]} sampled chunks',flush=True)
    result['ores']={}
    for ore,total in ore_est.items():
        variance=0.0
        for region in result['regions']:
            values=[sample['ores'].get(ore,0) for sample in region['samples']];k=len(values);n=region['chunks']
            if k>1 and n>k:variance+=n*n*(1-k/n)*float(np.var(values,ddof=1))/k
        per_chunk=total/max(1,result['populatedChunks']);margin=1.96*math.sqrt(variance)/max(1,result['populatedChunks'])
        result['ores'][ore]={'estimatedBlocks':round(total),'estimatedPerChunk':per_chunk,'approx95PerChunk':[max(0,per_chunk-margin),per_chunk+margin]}
    result['blocks']={k:round(v) for k,v in block_est.items()}
    result['byY']={k:{y:round(n) for y,n in v.items()} for k,v in by_y.items()}
    populated=[r for r in result['regions'] if r['chunks']]
    if not populated: raise ValueError('No populated chunks in the selected source')
    result['boundsBlocks']={'minX':min(r['x'] for r in populated)*512,'maxX':(max(r['x'] for r in populated)+1)*512-1,'minZ':min(r['z'] for r in populated)*512,'maxZ':(max(r['z'] for r in populated)+1)*512-1}
    result['limitations'].append('Bounds are the envelope of nonempty region files, not exact island edges. Approximate 95% intervals use within-region sample variance; four samples per region can miss rare clusters entirely.')
    result['sourceChangedDuringScan'] = source_metadata != survey_source(world)
    if result['sourceChangedDuringScan']: result['limitations'].append('World metadata changed during the scan; this is not a consistent snapshot.')
    result['completedAt']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
    write_json(ROOT/'data/generated/world.json',result)
    print(json.dumps({k:result[k] for k in ['regionCount','populatedChunks','sampledChunks','fullChunksSampled','boundsBlocks']}))

if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--samples',type=int,default=4)
    parser.add_argument('--world', type=Path, help='Read a stopped world or consistent snapshot instead of the configured server world')
    args=parser.parse_args()
    if args.samples<0:parser.error('--samples must be nonnegative')
    scan(args.samples, args.world)
