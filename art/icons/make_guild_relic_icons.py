"""Placeholder pixel icons for the six guild relics (24x24, scaled x4 to 96x96) -> src/assets/relics/g_*.png.
Run: python3 art/icons/make_guild_relic_icons.py. Replace with real art by dropping a PNG with the same name."""
from PIL import Image, ImageDraw
import os

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'assets', 'relics')
OL = (24, 16, 10, 255)


def canvas():
    im = Image.new('RGBA', (24, 24), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im)


def save(im, name):
    # 1px dark outline around every opaque pixel, then scale up crisp.
    out = im.copy()
    px = im.load()
    po = out.load()
    for y in range(24):
        for x in range(24):
            if px[x, y][3] == 0 and any(0 <= x + dx < 24 and 0 <= y + dy < 24 and px[x + dx, y + dy][3] > 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                po[x, y] = OL
    out.resize((96, 96), Image.NEAREST).save(os.path.join(OUT, f'{name}.png'))


# Warlord's Standard: pole with a red banner and gold trim
im, d = canvas()
d.rectangle([5, 2, 6, 22], fill=(150, 100, 50, 255))
d.rectangle([4, 1, 7, 2], fill=(240, 200, 80, 255))
d.polygon([(7, 4), (19, 4), (19, 15), (13, 12), (7, 15)], fill=(190, 40, 40, 255))
d.line([(7, 4), (19, 4)], fill=(240, 200, 80, 255))
d.rectangle([11, 7, 14, 9], fill=(240, 200, 80, 255))
save(im, 'g_standard')

# Slayer's Spear: diagonal shaft with a steel head
im, d = canvas()
d.line([(3, 21), (16, 8)], fill=(140, 90, 45, 255), width=2)
d.polygon([(15, 5), (21, 2), (18, 9)], fill=(215, 225, 240, 255))
d.line([(16, 7), (20, 3)], fill=(255, 255, 255, 255))
d.rectangle([13, 9, 15, 11], fill=(240, 200, 80, 255))
save(im, 'g_spear')

# Oathkeeper Aegis: kite shield, blue with gold rim
im, d = canvas()
d.polygon([(4, 3), (20, 3), (20, 12), (12, 21), (4, 12)], fill=(240, 200, 80, 255))
d.polygon([(6, 5), (18, 5), (18, 12), (12, 19), (6, 12)], fill=(50, 90, 170, 255))
d.rectangle([11, 6, 12, 16], fill=(240, 200, 80, 255))
d.rectangle([8, 9, 15, 10], fill=(240, 200, 80, 255))
save(im, 'g_aegis')

# Rallying Drum: drum with skin top and crossed sticks
im, d = canvas()
d.ellipse([4, 8, 19, 13], fill=(235, 220, 190, 255))
d.rectangle([4, 11, 19, 19], fill=(170, 50, 40, 255))
d.ellipse([4, 17, 19, 21], fill=(170, 50, 40, 255))
for x in (6, 10, 14, 18):
    d.line([(x, 12), (x - 2 if x > 6 else x, 19)], fill=(240, 200, 80, 255))
d.line([(6, 2), (11, 9)], fill=(150, 100, 50, 255), width=2)
d.line([(18, 2), (13, 9)], fill=(150, 100, 50, 255), width=2)
save(im, 'g_drum')

# Coinmaster's Ledger: green book with a gold coin
im, d = canvas()
d.rectangle([4, 4, 17, 20], fill=(40, 110, 70, 255))
d.rectangle([5, 5, 6, 19], fill=(25, 70, 45, 255))
d.rectangle([16, 5, 18, 20], fill=(235, 225, 200, 255))
d.ellipse([10, 11, 21, 22], fill=(240, 200, 80, 255))
d.ellipse([12, 13, 19, 20], fill=(255, 225, 120, 255))
d.rectangle([15, 14, 16, 19], fill=(200, 150, 50, 255))
save(im, 'g_ledger')

# Shardseeker Pick: pickaxe over a glowing Warsteel shard
im, d = canvas()
d.polygon([(13, 13), (19, 12), (21, 18), (15, 21)], fill=(210, 150, 80, 255))
d.line([(15, 14), (19, 13)], fill=(255, 225, 160, 255))
d.line([(4, 21), (14, 6)], fill=(140, 90, 45, 255), width=2)
d.arc([5, 1, 23, 15], 200, 340, fill=(190, 200, 215, 255), width=2)
save(im, 'g_pick')
print('ok')
