"""Placeholder weapon icons: one weapon per hero Type, three looks each (src/weapons.ts WEAPON_LOOK_NAMES:
Forged, Runed, Mythic). These are placeholders: every hero gets its own weapon from the user's Grok art, 16x16 pixel art scaled to 48x48 into src/assets/weapons/<type>-<look>.png.
Grok pictures from the user replace these (art/grok-prompts-weapons.md on the project drive).
Run: python3 art/icons/make_weapon_icons.py"""
from PIL import Image
import os

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'assets', 'weapons')
os.makedirs(OUT, exist_ok=True)
O = (30, 20, 30, 255)

# l light / m mid / d dark metal, h handle, w wrap, g gem (plain metal before Silver), s string/cloth
SHAPES = {
    'samurai': [
        '...............o',
        '..............ol',
        '.............olo',
        '............olo.',
        '...........olo..',
        '..........olo...',
        '.........olo....',
        '........olo.....',
        '.......olo......',
        '...o..olo.......',
        '...ogolo........',
        '....ogg.........',
        '...owoggo.......',
        '..owwo.ogo......',
        '.owwo...o.......',
        '.oo.............',
    ],
    'knight': [
        '..............oo',
        '.............olo',
        '............olmo',
        '...........olmo.',
        '..........olmo..',
        '.........olmo...',
        '........olmo....',
        '...o...olmo.....',
        '..ogo.olmo......',
        '...ogolmo.......',
        '....oggo........',
        '....ohggo.......',
        '...ohho.ogo.....',
        '..ohho...o......',
        '.oggo...........',
        '.oo.............',
    ],
    'barbarian': [
        '.......oooo.....',
        '.....oolllmo....',
        '....olllmmmdo...',
        '...olllmmmdo....',
        '...ollmmgdo.....',
        '....olmmdho.....',
        '.....oooho......',
        '.......oho......',
        '......oho.......',
        '.....oho........',
        '....oho.........',
        '...owo..........',
        '..owwo..........',
        '..owo...........',
        '.oho............',
        '.oo.............',
    ],
    'rogue': [
        '.........o......',
        '........olo..o..',
        '.......olo..olo.',
        '......olo..olo..',
        '.....olo..olo...',
        '..o.olo..olo....',
        '..ogoo..olo.....',
        '...ogg.olo......',
        '..owog.oo.......',
        '.owo.ogo........',
        '.oo...ogg.......',
        '......owog......',
        '.....owo.o......',
        '.....oo.........',
        '................',
        '................',
    ],
    'lancer': [
        '.............ooo',
        '............ollo',
        '...........olmdo',
        '..........olmdo.',
        '.........oogdo..',
        '........ohoo....',
        '.......oho......',
        '......oho.......',
        '.....oho........',
        '....oho.........',
        '...owo..........',
        '..owwo..........',
        '..owo...........',
        '.oho............',
        '.oho............',
        '.oo.............',
    ],
    'ranger': [
        '.......oooo.....',
        '......ohhhho....',
        '.....oho..os....',
        '.....oho...s....',
        '......oho..s....',
        '.......ogo.s....',
        '.......ogo.s....',
        '......oho..s....',
        '.....oho...s....',
        '.....oho..os....',
        '......ohhhho....',
        '.......oooo.....',
        '................',
        '................',
        '................',
        '................',
    ],
    'gunner': [
        '................',
        '................',
        '................',
        '....oooooooooo..',
        '...ollllllllmmo.',
        '...ommmmmmmmdmo.',
        '...oddgdddddddo.',
        '..ohhhooooooooo.',
        '.ohhhho.........',
        '.ohhho..........',
        'ohhho...........',
        'oooo............',
        '................',
        '................',
        '................',
        '................',
    ],
    'magician': [
        '...........ooo..',
        '..........oggo..',
        '.........ogggo..',
        '.........oggo...',
        '........omoo....',
        '.......ohmo.....',
        '......oho.......',
        '.....oho........',
        '....oho.........',
        '...oho..........',
        '...oho..........',
        '..oho...........',
        '..oho...........',
        '.oho............',
        '.oo.............',
        '................',
    ],
    'brawler': [
        '................',
        '................',
        '...ooooooo......',
        '..olllllllo.....',
        '..olmlmlmlmo....',
        '..olmlmlmlmo....',
        '..ommmmmmmmo....',
        '..ommgmmmmmo....',
        '...odmmmmmdo....',
        '...oddddddo.....',
        '...owwwwwwo.....',
        '...owwwwwwo.....',
        '....oooooo......',
        '................',
        '................',
        '................',
    ],
    'support': [
        '..........ooo...',
        '.........olllo..',
        '........olgglo..',
        '........olgglo..',
        '.........olllo..',
        '.........ohoo...',
        '........oho.....',
        '.......oho......',
        '......oswo......',
        '.....oho........',
        '....oho.........',
        '...oho..........',
        '..oho...........',
        '.oho............',
        '.oo.............',
        '................',
    ],
}

LOOKS = {
    1: dict(l=(236, 186, 128), m=(190, 120, 60), d=(130, 78, 40), h=(110, 70, 40), w=(150, 60, 40), s=(220, 210, 180), gem=None, glow=None),
    2: dict(l=(250, 252, 255), m=(196, 206, 224), d=(130, 142, 170), h=(70, 50, 60), w=(50, 90, 170), s=(240, 240, 255), gem=(90, 200, 255), glow=(120, 210, 255, 90)),
    3: dict(l=(255, 246, 180), m=(244, 196, 50), d=(180, 120, 20), h=(120, 30, 40), w=(170, 30, 40), s=(255, 240, 200), gem=(255, 70, 90), glow=(255, 214, 70, 120)),
}
SPARKS = [(1, 1), (14, 13), (2, 9)]

def make(shape, look):
    p = LOOKS[look]
    pal = {'o': O}
    for k in 'lmdhws':
        pal[k] = p[k] + (255,)
    pal['g'] = (p['gem'] or p['m']) + (255,)
    img = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    for y, row in enumerate(shape):
        for x, ch in enumerate(row):
            if ch != '.':
                img.putpixel((x, y), pal[ch])
    if p['glow']:
        glow = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
        for y in range(16):
            for x in range(16):
                if img.getpixel((x, y))[3]:
                    continue
                if any(0 <= x + dx < 16 and 0 <= y + dy < 16 and img.getpixel((x + dx, y + dy))[3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    glow.putpixel((x, y), p['glow'])
        img = Image.alpha_composite(glow, img)
    if look == 3:
        for x, y in SPARKS:
            if not img.getpixel((x, y))[3]:
                img.putpixel((x, y), (255, 255, 255, 255))
    return img.resize((48, 48), Image.NEAREST)

for t, shape in SHAPES.items():
    assert len(shape) == 16 and all(len(r) == 16 for r in shape), t
    for look in LOOKS:
        make(shape, look).save(os.path.join(OUT, f'{t}-{look}.png'), optimize=True)
print('ok', len(SHAPES) * len(LOOKS))
