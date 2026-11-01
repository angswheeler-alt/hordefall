"""Draws the 16x16 pixel icons for Glyphs and Rush into src/assets/ui/ (saved at 32x32).
Glyph stones per family, Glyph Dust, the Unbinder, Glyph Chests and the Rush Coin.
Run: python3 art/icons/make_glyph_icons.py"""
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


def shade(c, f):
    return tuple(max(0, min(255, int(v * f))) for v in c[:3]) + (255,)


# A cut stone; the 5x5 symbol goes in the middle (rows 5-9, columns 5-9).
STONE = [
    '................',
    '.......oo.......',
    '......ollo......',
    '.....ollmmo.....',
    '....ollmmmmo....',
    '...ollmmmmmmo...',
    '..ollmmmmmmmmo..',
    '.ollmmmmmmmmmdo.',
    '.olmmmmmmmmmddo.',
    '..ommmmmmmmddo..',
    '...ommmmmmddo...',
    '....ommmmddo....',
    '.....ommddo.....',
    '......oddo......',
    '.......oo.......',
    '................',
]

SYMBOLS = {
    'attack': ['x...x', '.x.x.', '..x..', '.x.x.', 'x...x'],    # crossed blades
    'health': ['.x.x.', 'xxxxx', 'xxxxx', '.xxx.', '..x..'],    # heart
    'defense': ['xxxxx', 'x...x', 'x...x', '.x.x.', '..x..'],   # shield
    'speed': ['..xx.', '.xx..', 'xxxxx', '..xx.', '.xx..'],     # bolt
    'crit': ['..x..', '..x..', 'xx.xx', '..x..', '..x..'],      # star burst
    'frenzy': ['x.x.x', 'xxxxx', '.xxx.', '.xxx.', '..x..'],    # flame
    'lifesteal': ['..x..', '.xxx.', 'xxxxx', 'xxxxx', '.xxx.'], # drop
    'gold': ['.xxx.', 'x.x.x', '.xxx.', 'x.x.x', '.xxx.'],      # coin
}
COLORS = {
    'attack': (224, 83, 58), 'health': (63, 174, 90), 'defense': (138, 150, 168), 'speed': (65, 182, 230),
    'crit': (170, 110, 240), 'frenzy': (255, 122, 26), 'lifesteal': (192, 50, 107), 'gold': (232, 184, 48),
}
for fam, col in COLORS.items():
    rows = [list(r) for r in STONE]
    for y, line in enumerate(SYMBOLS[fam]):
        for x, ch in enumerate(line):
            if ch == 'x':
                rows[y + 5][x + 5] = 's'
    pal = {'o': O, 'l': shade(col, 1.45), 'm': col + (255,), 'd': shade(col, 0.6), 's': (255, 250, 235, 255)}
    draw([''.join(r) for r in rows], pal, f'glyph-{fam}.png')

DUST = [
    '................',
    '..........l.....',
    '.....l...lwl....',
    '....lwl...l.....',
    '.....l..........',
    '..........l.....',
    '.......oooo.....',
    '.....oolmmmoo...',
    '....olmmmpmmdo..',
    '...olmpmmmmmddo.',
    '..olmmmmmpmmmddo',
    '..ommmpmmmmmdddo',
    '..oddmmmmmmddddo',
    '...oodddddddooo.',
    '.....ooooooo....',
    '................',
]
draw(DUST, {'o': O, 'l': (255, 240, 200, 255), 'w': (255, 255, 255, 255), 'm': (180, 140, 230, 255), 'p': (255, 220, 120, 255), 'd': (110, 80, 170, 255)}, 'glyph-dust.png')

UNBINDER = [
    '................',
    '...........oo...',
    '..........ollo..',
    '.........olllo..',
    '........olllo...',
    '.......olllo....',
    '......olllo.....',
    '.....owwwo......',
    '....obbbo.......',
    '...obbbo........',
    '..obbbo.........',
    '.obbbo..........',
    '.obbo...........',
    '..oo............',
    '................',
    '................',
]
draw(UNBINDER, {'o': O, 'l': (215, 225, 235, 255), 'w': (240, 200, 90, 255), 'b': (150, 95, 55, 255)}, 'unbinder.png')

CHEST = [
    '................',
    '................',
    '...oooooooooo...',
    '..ommmmmmmmmmo..',
    '.ommllllllllmmo.',
    '.omllllllllllmo.',
    '.obbbbbbbbbbbbo.',
    '.oddddosoddddo..',
    '.ommmmossommmmo.',
    '.ommmmmoommmmmo.',
    '.ommmmmmmmmmmmo.',
    '.ommmmmmmmmmmmo.',
    '.obbbbbbbbbbbbo.',
    '..oooooooooooo..',
    '................',
    '................',
]
draw(CHEST, {'o': O, 'm': (70, 120, 160, 255), 'l': (110, 170, 210, 255), 'b': (200, 170, 90, 255), 'd': (40, 80, 120, 255), 's': (180, 240, 255, 255)}, 'glyph-chest.png')
draw(CHEST, {'o': O, 'm': (120, 60, 160, 255), 'l': (180, 110, 220, 255), 'b': (255, 210, 80, 255), 'd': (80, 30, 120, 255), 's': (255, 240, 160, 255)}, 'glyph-grand.png')

COIN = [
    '................',
    '.....oooooo.....',
    '...ooyyyyyyoo...',
    '..oyylllllyydo..',
    '..oylyyyyyyydo..',
    '.oylyyrryyyyddo.',
    '.oylyyrrryyyddo.',
    '.oylyyyrrryyddo.',
    '.oylyyyrrryyddo.',
    '.oylyyrrryyyddo.',
    '.oyyyyrryyyyddo.',
    '..oyyyyyyyyddo..',
    '..oddyyyyyddddo.',
    '...oodddddddo...',
    '.....oooooo.....',
    '................',
]
draw(COIN, {'o': O, 'y': (240, 190, 60, 255), 'l': (255, 240, 170, 255), 'd': (170, 110, 30, 255), 'r': (200, 50, 40, 255)}, 'rush-coin.png')
print('ok')
