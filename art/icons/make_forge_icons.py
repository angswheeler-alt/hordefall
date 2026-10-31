"""Draws the 16x16 pixel icons for weapon materials (Scouting rewards) into src/assets/ui/.
Run: python3 art/icons/make_forge_icons.py"""
from PIL import Image
import os

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'assets', 'ui')
O = (30, 20, 30, 255)  # outline

def draw(rows, pal, name):
    img = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != '.':
                img.putpixel((x, y), pal[ch])
    img.resize((32, 32), Image.NEAREST).save(os.path.join(OUT, name))

ORE = [
    '................',
    '................',
    '.....oooo.......',
    '...oollmmoo.....',
    '..olllmmmmmo....',
    '..olmcmmmmmmo...',
    '.olmmmmmdcmmmo..',
    '.ommcmmmmmmdmo..',
    '.ommmmmmcmmmdo..',
    '.odmmmdmmmmmdo..',
    '.oddmmmmmmcddo..',
    '..oddddmmddddo..',
    '...oodddddooo...',
    '.....ooooo......',
    '................',
    '................',
]
draw(ORE, {'o': O, 'l': (176, 168, 160, 255), 'm': (128, 118, 112, 255), 'd': (84, 74, 72, 255), 'c': (232, 146, 64, 255)}, 'mat-ore.png')

CRYSTAL = [
    '................',
    '.......o........',
    '......olo.......',
    '..o...olmo......',
    '.olo..olmo..o...',
    '.olmo.olmmo.olo.',
    '.olmo.olmmo.olmo',
    '.olmo.olmmoolmmo',
    '.olmmoolmmoolmdo',
    '.olmmoolmdoolmdo',
    '..ommoolmdoomddo',
    '..oddddddddddo..',
    '..obbbbbbbbbbo..',
    '...oooooooooo...',
    '................',
    '................',
]
draw(CRYSTAL, {'o': O, 'l': (220, 250, 255, 255), 'm': (110, 210, 240, 255), 'd': (60, 130, 200, 255), 'b': (120, 100, 90, 255)}, 'mat-crystal.png')

CORE = [
    '................',
    '.....oooooo.....',
    '...oohhhhhhoo...',
    '..ohhooooooddo..',
    '..ohoallmmoodo..',
    '.ohoalllmmmdodo.',
    '.ohoallmmmmdodo.',
    '.ohoammmmmddodo.',
    '.ohoammmmmddodo.',
    '.ohoaammmddddo..',
    '..odoaadddddodo.',
    '..oddoooooooddo.',
    '...ooddddddoo...',
    '.....oooooo.....',
    '................',
    '................',
]
METAL = {'h': (210, 200, 180, 255), 'd': (120, 104, 92, 255)}
for name, (l, m, d) in {
    'mat-core-c.png': ((250, 250, 250, 255), (200, 200, 205, 255), (130, 130, 140, 255)),
    'mat-core-r.png': ((190, 230, 255, 255), (80, 160, 255, 255), (40, 90, 200, 255)),
    'mat-core-e.png': ((240, 200, 255, 255), (190, 100, 255, 255), (110, 50, 180, 255)),
}.items():
    pal = {'o': O, 'a': l, 'l': l, 'm': m, **METAL}
    pal['d'] = METAL['d']
    # The gem's dark side uses the gem's own dark colour inside the ring.
    rows = [r for r in CORE]
    img_pal = dict(pal)
    draw(rows, img_pal, name)
    # Recolour the inner dark pixels of the gem.
    img = Image.open(os.path.join(OUT, name)).resize((16, 16), Image.NEAREST)
    for y in range(4, 11):
        for x in range(4, 12):
            if CORE[y][x] == 'd':
                img.putpixel((x, y), d)
    img.resize((32, 32), Image.NEAREST).save(os.path.join(OUT, name))

WILD = [
    '................',
    '....oooooooo....',
    '...oyyyyyyyyo...',
    '..oyrrrggbbpyo..',
    '..oyrrwggbbpyo..',
    '..oyrrwwgbbpyo..',
    '..oyrwwwwwbpyo..',
    '..oyrrwwwbbpyo..',
    '..oyrrwgwbbpyo..',
    '...oyrrggbbyo...',
    '....oyrgbpyo....',
    '.....oyggyo.....',
    '......oyyo......',
    '.......oo.......',
    '................',
    '................',
]
draw(WILD, {'o': O, 'y': (255, 210, 80, 255), 'r': (240, 90, 90, 255), 'g': (110, 210, 110, 255), 'b': (90, 150, 250, 255), 'p': (190, 110, 240, 255), 'w': (255, 255, 255, 255)}, 'mat-wild.png')

SWORD = [
    '..............oo',
    '.............olo',
    '............olmo',
    '...........olmo.',
    '..........olmo..',
    '.........olmo...',
    '........olmo....',
    '...o...olmo.....',
    '...ogoolmo......',
    '....oggmo.......',
    '.....oggo.......',
    '....ohoggo......',
    '...ohho.ogo.....',
    '..ohho...o......',
    '.oppo...........',
    '.oo.............',
]
for name, (l, m, g) in {
    'weapon-1.png': ((240, 200, 150, 255), (190, 120, 60, 255), (150, 90, 40, 255)),
    'weapon-2.png': ((250, 250, 255, 255), (170, 180, 195, 255), (110, 120, 140, 255)),
    'weapon-3.png': ((255, 250, 190, 255), (240, 190, 40, 255), (180, 120, 20, 255)),
}.items():
    draw(SWORD, {'o': O, 'l': l, 'm': m, 'g': g, 'h': (120, 70, 40, 255), 'p': g}, name)
print('ok')
