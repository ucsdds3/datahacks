"""Compose approved 2D backgrounds from unmodified Minecraft 26.2 block tiles.
Run with Pillow; vanilla textures are read from the local game JAR once.
Nearest-neighbor scale preserves source pixels. No generated ores are used.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageEnhance
import zipfile, random, json, hashlib

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/images/minecraft/layers'
TEX = ROOT / 'public/images/minecraft/textures'
OUT.mkdir(parents=True, exist_ok=True)
TEX.mkdir(parents=True, exist_ok=True)
JAR = Path.home() / 'Library/Application Support/minecraft/versions/26.2/26.2.jar'
names = '''stone coal_ore copper_ore iron_ore redstone_ore andesite granite diorite gravel sulfur cinnabar glow_lichen cobbled_deepslate deepslate deepslate_diamond_ore deepslate_redstone_ore deepslate_lapis_ore deepslate_iron_ore deepslate_bricks cracked_deepslate_bricks deepslate_tiles reinforced_deepslate_side oak_planks oak_log cobweb rail torch sculk sculk_vein sculk_sensor_top sculk_sensor_side sculk_sensor_tendril_inactive sculk_shrieker_side sculk_shrieker_top obsidian nether_portal lava_still bedrock sulfur_spike_up_tip sulfur_spike_up_middle'''.split()
manifest = {'source': 'Minecraft Java Edition 26.2 client block textures (Mojang)', 'pixel_scale': 8, 'textures': {}, 'layers': {}}
names += ['end_portal_frame_top', 'end_portal_frame_eye']
with zipfile.ZipFile(JAR) as archive:
    for name in names:
        raw = archive.read(f'assets/minecraft/textures/block/{name}.png')
        (TEX / f'{name}.png').write_bytes(raw)
        manifest['textures'][name] = hashlib.sha256(raw).hexdigest()
    end_surface = archive.read('assets/minecraft/textures/entity/end_portal/end_portal.png')
    (TEX / 'end_portal_surface.png').write_bytes(end_surface)
    manifest['textures']['end_portal_surface'] = hashlib.sha256(end_surface).hexdigest()
textures = {n: Image.open(TEX / f'{n}.png').convert('RGBA').crop((0,0,16,16)).resize((32,32), Image.Resampling.NEAREST) for n in names}
W, H = 480, 256

def tile(im, name, x, y, brightness=1):
    t = textures[name]
    if brightness != 1:
        t = ImageEnhance.Brightness(t).enhance(brightness)
    im.alpha_composite(t, (int(x), int(y)))

def fill(im, name, box, brightness=1):
    x,y,w,h = box
    slab = Image.new('RGBA',(w,h))
    for yy in range(0,h,textures[name].width):
        for xx in range(0,w,textures[name].width): tile(slab,name,xx,yy,brightness)
    im.alpha_composite(slab,(x,y))

def rock(seed, base, pockets, cavern=False):
    rng = random.Random(seed)
    im = Image.new('RGBA', (W,H), '#141a1e')
    for y in range(0,H,32):
        for x in range(0,W,32):
            edge = x < 64 or x >= W-64 or y < 16 or y >= H-32
            tile(im,base,x,y, .34 if cavern and not edge else 1)
    # Small irregular deposits, placed at the outer sides of the reading space.
    for material, positions in pockets.items():
        for x,y in sorted(set((int(x/2)*32,int(y/2)*32) for x,y in positions)): tile(im,material,x,y)
    return im

def save(im, slug, info):
    im = im.convert('RGB').resize((W*4,H*4),Image.Resampling.NEAREST)
    im.save(OUT / f'{slug}.png', optimize=True)
    im.save(OUT / f'{slug}.webp', lossless=True, method=6)
    manifest['layers'][slug] = info
    return im

about = rock(12,'stone',{'coal_ore':[(2,3),(3,3),(25,10)],'copper_ore':[(27,4),(27,5),(4,12)],'andesite':[(1,8)],'diorite':[(28,11)],'gravel':[(2,14),(3,14)]})
def enrich_stone(im):
    # Connected deposits across the wall, including areas visible around the panels.
    deposits = {
        'granite': [(0,0),(1,0),(1,1),(2,1),(10,6),(11,6),(11,7),(12,7)],
        'andesite': [(5,0),(6,0),(6,1),(0,4),(0,5),(1,5),(13,2),(14,2),(14,3)],
        'diorite': [(11,0),(12,0),(12,1),(0,6),(1,6),(2,7),(3,7),(14,5),(14,6)],
        'gravel': [(7,7),(8,7),(14,0)],
    }
    for material, cells in deposits.items():
        for x,y in cells: tile(im,material,x*32,y*32)
enrich_stone(about)
for x,y in [(3,0),(3,1),(4,1),(9,7),(10,7),(14,4)]: tile(about,'coal_ore',x*32,y*32)
save(about,'01-about','Stone with connected granite, andesite, diorite and gravel deposits, coal seams and sparse copper. Original texture colors preserved.')
tracks = rock(7,'stone',{'iron_ore':[(3,5)],'copper_ore':[(26,9)],'redstone_ore':[(27,3),(28,3)],'andesite':[(1,2),(2,2),(2,3),(27,12)],'granite':[(28,6),(28,7),(29,7)],'diorite':[(2,10),(3,10)],'gravel':[(0,13),(1,13),(1,14),(28,14)]})
enrich_stone(tracks)
save(tracks,'02-tracks','Stone mixed with andesite, granite, diorite and gravel; exactly one iron and one copper ore block; two redstone blocks.')
sulfur = rock(2,'sulfur',{'stone':[(1,2),(2,2),(2,3),(3,3),(26,2),(27,2),(27,3),(28,11),(27,12)],'cinnabar':[(0,13),(1,13),(28,13),(29,14)]},True)
for x,y in [(2,2),(3,3),(27,2),(28,11)]: tile(sulfur,'glow_lichen',int(x/2)*32,int(y/2)*32)
for x in [24,56,408,440]:
    tile(sulfur,'sulfur_spike_up_middle',x,207)
    tile(sulfur,'sulfur_spike_up_tip',x,191)
save(sulfur,'03-sponsors','Sulfur cavern, stone deposits, original glow lichen and sulfur spikes, small cinnabar pockets. No lava or netherrack.')
shaft=rock(6,'stone',{'andesite':[(1,3),(28,5)],'granite':[(2,11),(3,11)],'diorite':[(27,3),(28,3)],'gravel':[(1,13),(2,13)],'iron_ore':[(2,5),(27,7)],'cobbled_deepslate':[(0,11),(0,12),(1,12),(28,10),(29,10),(29,11)]},True)
fill(shaft,'cobbled_deepslate',(0,224,W,32))
# Flat side-elevation oak fence posts and plank beams; all wood sampled from vanilla planks.
for x in [64,408]:
    fill(shaft,'oak_planks',(x,31,8,193))
    for y in [58,66,148,156]: fill(shaft,'oak_planks',(x-24,y,56,4))
    for xx in [x-24,x+28]: fill(shaft,'oak_planks',(xx,48,4,32))
fill(shaft,'oak_planks',(32,16,416,16))
fill(shaft,'oak_log',(64,16,8,16))
fill(shaft,'oak_log',(408,16,8,16))
for x,y in [(48,34),(416,33),(33,179)]: tile(shaft,'cobweb',x,y)
for x in [66,410]: tile(shaft,'torch',x-5,110)
# Side-view rail sleepers, rails, and an empty minecart at the edge.
d=ImageDraw.Draw(shaft)
for x in range(0,W,12): fill(shaft,'oak_planks',(x,223,3,9))
d.line((0,225,W,225),fill='#b6b7b4',width=2); d.line((0,231,W,231),fill='#656668',width=2)
d.rectangle((375,202,412,220),fill='#424448'); d.rectangle((373,200,414,204),fill='#b5b7b9'); d.rectangle((379,207,408,217),fill='#73767a')
d.rectangle((378,220,384,224),fill='#18191b'); d.rectangle((403,220,409,224),fill='#18191b')
save(shaft,'04-speakers','Oak mineshaft, fence supports, plank beams, cobwebs, rails, minecart, torches and stone/deepslate variety. Ore tiles are original, unlike the AI layout reference.')
prizes=rock(9,'deepslate',{'deepslate_diamond_ore':[(2,3),(3,3),(26,9),(26,10)],'deepslate_redstone_ore':[(27,3),(28,3),(2,11)],'deepslate_lapis_ore':[(1,7),(2,7),(28,12)],'cobbled_deepslate':[(0,14),(1,14),(28,14)]})
save(prizes,'05-prizes','Full deepslate with original diamond, redstone and lapis ore textures. No color tint, glow, iron, or cyan lighting overlay.')
faq=rock(14,'deepslate_tiles',{},True)
# Distant flat city silhouette with reinforced central arch. Foreground ruins frame the reading area.
for x,height in [(16,96),(64,144),(112,72),(352,80),(400,144),(448,112)]:
    fill(faq,'deepslate_bricks',(x,224-height,16,height),.8)
    fill(faq,'cracked_deepslate_bricks',(x-8,216-height,32,8),.85)
fill(faq,'reinforced_deepslate_side',(176,48,16,80),.55)
fill(faq,'reinforced_deepslate_side',(288,48,16,80),.55)
fill(faq,'reinforced_deepslate_side',(176,32,128,16),.55)
fill(faq,'sculk',(0,224,W,32))
for x,y in [(0,192),(16,208),(64,192),(80,208),(384,208),(400,192),(448,208),(464,192)]:
    tile(faq,'sculk',x,y)
    tile(faq,'sculk_vein',x,y-16)
# Leave the four sensor locations to the live interactive controls, avoiding duplicate baked sensors.
save(faq,'06-faq','Ancient city, reinforced arch, ruined deepslate pillars and original sculk floor/veins. Four sensors are separate interactive sprites, not painted into the background.')
apply=rock(8,'deepslate',{},True)
fill(apply,'lava_still',(0,192,W,64))
# Recessed cave ledges and stepping platforms. Middle platform holds the live portal.
for x,y,w,h in [(0,160,64,64),(48,192,32,48),(400,176,80,64),(384,208,32,32),(144,176,192,32)]:
    fill(apply,'cobbled_deepslate',(x,y,w,h))
    fill(apply,'deepslate_tiles',(x,y,w,8))
save(apply,'07-apply','2D lava cavern with flat recessed stone wall, overlapping ledges and an isolated central platform for the live clickable End portal. No bedrock footer.')
# A reusable portal and four sensor/shrieker sprites preserve alpha and first-frame vanilla texels.
textures = {n: Image.open(TEX / f'{n}.png').convert('RGBA').crop((0,0,16,16)) for n in names}
portal=Image.new('RGBA',(64,96))
fill(portal,'obsidian',(0,0,64,96))
fill(portal,'nether_portal',(16,16,32,64))
portal.resize((192,288),Image.Resampling.NEAREST).save(OUT/'portal.png')
# Orthographic overhead End portal: twelve original eye frames around a 3x3 void.
end_portal=Image.new('RGBA',(80,80))
sky=Image.open(TEX/'end_portal_surface.png').convert('RGBA').resize((48,48),Image.Resampling.NEAREST)
end_portal.alpha_composite(sky,(16,16))
for turn in range(4):
    for i in range(1,4):
        frame=textures['end_portal_frame_top'].copy()
        frame.alpha_composite(textures['end_portal_frame_eye'])
        frame=frame.rotate(90*turn)
        x,y=[(i*16,0),(0,i*16),(i*16,64),(64,i*16)][turn]
        end_portal.alpha_composite(frame,(x,y))
end_portal.resize((400,400),Image.Resampling.NEAREST).save(OUT/'end-portal.png')
for kind in ['sensor','shrieker']:
    sprite=Image.new('RGBA',(32,32))
    tile(sprite,f'sculk_{kind}_side',8,16)
    tile(sprite,f'sculk_{kind}_top',8,8)
    if kind=='sensor':
        tile(sprite,'sculk_sensor_tendril_inactive',0,0)
        tile(sprite,'sculk_sensor_tendril_inactive',16,0)
    sprite.resize((128,128),Image.Resampling.NEAREST).save(OUT/f'{kind}.png')
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
# Overview for artwork review only; not a production image.
preview=Image.new('RGB',(960,len(manifest['layers'])*292),'#111820')
d=ImageDraw.Draw(preview)
for i,(slug,info) in enumerate(manifest['layers'].items()):
    d.text((16,i*292+8),slug.upper(),fill='#eef3ef')
    thumb=Image.open(OUT/f'{slug}.png').resize((960,256),Image.Resampling.NEAREST)
    preview.paste(thumb,(0,i*292+28))
preview.save(ROOT/'output/imagegen/layer-overview.jpg',quality=92)
print('Built 7 backgrounds, Nether/End portals and sculk sprites; source hashes recorded in manifest.json')
