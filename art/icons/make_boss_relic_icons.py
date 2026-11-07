"""Placeholder pixel icons for the ten boss relics (24x24, scaled x4 to 96x96) -> src/assets/relics/b_*.png.
Run: python3 art/icons/make_boss_relic_icons.py. Replace with real art by dropping a PNG with the same name."""
from PIL import Image, ImageDraw
import os

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'assets', 'relics')
OL = (24, 16, 10, 255)
GOLD = (240, 200, 80, 255)
COL = {'water': (60, 140, 230, 255), 'fire': (230, 80, 40, 255), 'earth': (110, 170, 60, 255), 'light': (250, 230, 130, 255), 'dark': (140, 70, 190, 255)}
HI = {'water': (170, 220, 255, 255), 'fire': (255, 190, 90, 255), 'earth': (190, 230, 140, 255), 'light': (255, 255, 230, 255), 'dark': (210, 160, 255, 255)}


def canvas():
    im = Image.new('RGBA', (24, 24), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im)


def save(im, name):
    out = im.copy()
    px = im.load()
    po = out.load()
    for y in range(24):
        for x in range(24):
            if px[x, y][3] == 0 and any(0 <= x + dx < 24 and 0 <= y + dy < 24 and px[x + dx, y + dy][3] > 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                po[x, y] = OL
    out.resize((96, 96), Image.NEAREST).save(os.path.join(OUT, f'{name}.png'))


# Water 1: Tidecaller Pearl - pearl in a shell
im, d = canvas(); c, h = COL['water'], HI['water']
d.pieslice([2, 6, 21, 25], 180, 360, fill=c)
d.ellipse([7, 4, 16, 13], fill=(235, 240, 250, 255)); d.point([(9, 6), (10, 6), (9, 7)], fill=(255, 255, 255, 255))
for x in (5, 9, 13, 17): d.line([(x, 16), (11, 22)], fill=h)
save(im, 'b_water1')
# Water 2: Abyssal Anchor
im, d = canvas()
d.rectangle([11, 3, 12, 19], fill=(150, 165, 190, 255)); d.ellipse([9, 1, 14, 6], outline=(150, 165, 190, 255), width=2)
d.rectangle([6, 7, 17, 8], fill=(150, 165, 190, 255)); d.arc([3, 9, 20, 22], 20, 160, fill=COL['water'], width=3)
save(im, 'b_water2')
# Fire 1: Cinder Crown
im, d = canvas(); c, h = COL['fire'], HI['fire']
d.polygon([(3, 18), (3, 8), (7, 13), (12, 4), (16, 13), (20, 8), (20, 18)], fill=GOLD)
d.rectangle([3, 17, 20, 20], fill=(200, 150, 50, 255)); d.ellipse([10, 12, 13, 15], fill=c); d.point([(12, 2), (11, 1)], fill=h)
save(im, 'b_fire1')
# Fire 2: Tyrant's Brand - branding iron, glowing head
im, d = canvas()
d.line([(4, 21), (13, 10)], fill=(110, 80, 50, 255), width=2)
d.rectangle([12, 3, 21, 11], fill=COL['fire']); d.rectangle([14, 5, 19, 9], fill=HI['fire'])
save(im, 'b_fire2')
# Earth 1: Heartstone Idol
im, d = canvas(); c, h = COL['earth'], HI['earth']
d.rectangle([6, 3, 17, 20], fill=(130, 110, 90, 255)); d.rectangle([4, 19, 19, 21], fill=(100, 85, 70, 255))
d.rectangle([8, 6, 10, 8], fill=h); d.rectangle([13, 6, 15, 8], fill=h); d.ellipse([9, 11, 14, 16], fill=c)
save(im, 'b_earth1')
# Earth 2: Mountain Bulwark - rock shield
im, d = canvas()
d.polygon([(4, 4), (20, 4), (20, 13), (12, 21), (4, 13)], fill=(120, 115, 105, 255))
d.polygon([(7, 15), (12, 7), (17, 15)], fill=COL['earth']); d.polygon([(10, 10), (12, 7), (14, 10)], fill=(240, 240, 240, 255))
save(im, 'b_earth2')
# Light 1: Halo of Dawn
im, d = canvas(); c, h = COL['light'], HI['light']
d.ellipse([3, 6, 20, 16], outline=c, width=3); d.ellipse([6, 8, 17, 14], outline=h, width=1)
for p in ((11, 1), (2, 18), (21, 18)): d.point(p, fill=h)
save(im, 'b_light1')
# Light 2: Radiant Plume - feather
im, d = canvas()
d.polygon([(5, 21), (8, 12), (14, 4), (19, 2), (17, 8), (11, 16)], fill=HI['light'])
d.line([(5, 21), (18, 3)], fill=COL['light']); d.line([(8, 14), (13, 13)], fill=GOLD)
save(im, 'b_light2')
# Dark 1: Eye of the Void
im, d = canvas(); c, h = COL['dark'], HI['dark']
d.ellipse([2, 6, 21, 17], fill=(40, 20, 60, 255)); d.ellipse([7, 7, 16, 16], fill=c); d.ellipse([10, 9, 13, 14], fill=(10, 0, 20, 255))
d.point([(9, 9)], fill=h)
save(im, 'b_dark1')
# Dark 2: Night Fang
im, d = canvas()
d.polygon([(7, 3), (17, 3), (14, 14), (12, 21), (10, 14)], fill=(235, 230, 215, 255))
d.rectangle([7, 3, 17, 6], fill=COL['dark']); d.line([(13, 7), (12, 17)], fill=(190, 180, 160, 255))
save(im, 'b_dark2')
print('ok')
