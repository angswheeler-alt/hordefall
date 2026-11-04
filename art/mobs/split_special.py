# Cuts the user's sheets for the special mob kinds (2026-11-04: shieldbearer, bomber, summoner, burrower; 3 rows:
# standing, attack, walk, facing left on magenta) into art/mobs/<id>/{idle,attack,walk}_sheet.png, mirrored to face
# right like the other mobs. Run: python3 art/mobs/split_special.py <folder with <id>.png>
# The summoner's 4th attack frame is the summoned minion on its own (no summoner in it), so it is painted out.
import numpy as np, os, sys
from PIL import Image
S = sys.argv[1].rstrip('/') + '/'
D = os.path.dirname(os.path.abspath(__file__)) + '/'
MAGENTA = (210, 20, 168)


def bg(a):
    r, g, b = [a[..., i].astype(int) for i in range(3)]
    l = 0.3 * r + 0.59 * g + 0.11 * b
    return (b - r <= 20) & (l < 130) & (((r - g > 80) & (b - g > 40)) | ((r > 60) & (g < 30) & (b > 40) & (r - g > 50)))


def rows(a):
    fg = (~bg(a)).sum(1) >= 3
    out = []
    y = 0
    H = len(fg)
    while y < H:
        if fg[y]:
            y0 = y
            while y < H and fg[y]:
                y += 1
            if y - y0 > 40:
                out.append((y0, y))
        else:
            y += 1
    return out


def cols(a):
    """Column runs of figures in a row strip (gaps of 6+ empty columns split frames)."""
    fg = (~bg(a)).sum(0) >= 2
    out = []
    x = 0
    W = len(fg)
    while x < W:
        if fg[x]:
            x0 = x
            gap = 0
            while x < W and gap < 6:
                gap = 0 if fg[x] else gap + 1
                x += 1
            out.append((x0, x - gap))
        else:
            x += 1
    return [c for c in out if c[1] - c[0] > 30]


def save(img, mob, name):
    os.makedirs(D + mob, exist_ok=True)
    img.transpose(Image.FLIP_LEFT_RIGHT).convert('RGBA').save(D + mob + '/' + name + '_sheet.png')


for mob in ['shieldbearer', 'bomber', 'summoner', 'burrower']:
    im = Image.open(S + mob + '.png').convert('RGB')
    a = np.array(im)
    rs = rows(a)
    print(mob, rs)
    assert len(rs) == 3, rs
    for (y0, y1), n in zip(rs, ['idle', 'attack', 'walk']):
        crop = im.crop((0, max(0, y0 - 8), im.width, min(im.height, y1 + 8)))
        if mob == 'summoner' and n == 'attack':
            ca = np.array(crop)
            cs = cols(ca)
            print('  summoner attack runs', cs)
            # The minion stands alone around x 760-905 of the 1168 px sheet (neighbours touch each other, not it).
            x0, x1 = next(c for c in cs if c[0] <= 835 <= c[1])
            assert x1 - x0 < 200, (x0, x1)
            ca[:, x0:x1 + 1] = MAGENTA
            crop = Image.fromarray(ca)
        save(crop, mob, n)
