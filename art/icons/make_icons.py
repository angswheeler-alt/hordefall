"""Stall and relic icons from the generated pictures.

Run: python3 art/icons/make_icons.py            (every picture)
     python3 art/icons/make_icons.py bakery     (just these ids)

art/icons/stalls/<id>.jpg and art/icons/relics/<id>.jpg are single items on a flat magenta background. Each one
becomes src/assets/stalls/<id>.png or src/assets/relics/<id>.png (bundled by Vite): the magenta keyed out (same test as the hero sprites),
stray specks dropped, trimmed, then shrunk by averaging only the item's own pixels in each block, so no pink
fringe survives, and centred on a square canvas.
"""
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(ROOT, '..', '..', 'src', 'assets')
SIZE = {'stalls': 96, 'relics': 96}  # canvas px; shown at 58 and 52 css px, so about 2x for sharp phones
PAD = 2


# Pictures whose item has a hot pink part drawn with no outline against the background (the Alchemist's roof):
# for these only nearly green-free pixels count as background. The background's green is near 0, the roof's 40+.
STRICT = {'alchemist'}


def is_bg(r, g, b, strict=False):
    # art/heroes/animate.js isBg: magenta-ish and dark enough that pink feathers stay.
    lum = 0.3 * r + 0.59 * g + 0.11 * b
    if strict and g > 32:
        return False
    return b - r <= 20 and lum < 130 and ((r - g > 80 and b - g > 40) or (r > 60 and g < 30 and b > 40 and r - g > 50))


def mask_of(img, strict):
    w, h = img.size
    px = img.load()
    bgish = bytearray(1 if is_bg(*px[i % w, i // w], strict) else 0 for i in range(w * h))
    # Magenta-ish areas are background only where they reach the edge, or where an enclosed one (the gap between
    # two boots) has the background's own colour. A deep pink roof walled in by its outline stays.
    edge = sorted(px[x, y] for x, y in ((x, 0) for x in range(w)) if bgish[x])
    ref = edge[len(edge) // 2] if edge else (255, 0, 255)
    fg = bytearray(w * h)
    seen = bytearray(w * h)
    for start in range(w * h):
        if seen[start]:
            continue
        if not bgish[start]:
            fg[start] = 1
            continue
        seen[start] = 1
        stack, blob, border = [start], [], False
        while stack:
            i = stack.pop()
            blob.append(i)
            x, y = i % w, i // w
            border = border or x in (0, w - 1) or y in (0, h - 1)
            for j in (i - 1 if x else -1, i + 1 if x < w - 1 else -1, i - w if y else -1, i + w if y < h - 1 else -1):
                if j >= 0 and bgish[j] and not seen[j]:
                    seen[j] = 1
                    stack.append(j)
        if not border:
            mean = [sum(px[i % w, i // w][c] for i in blob) / len(blob) for c in range(3)]
            if sum((mean[c] - ref[c]) ** 2 for c in range(3)) > 70 ** 2:
                for i in blob:
                    fg[i] = 1
    # Drop specks: shapes far smaller than the biggest one (JPEG noise, a stray sparkle off on its own).
    label = [0] * (w * h)
    sizes = [0]
    for start in range(w * h):
        if not fg[start] or label[start]:
            continue
        lab = len(sizes)
        label[start] = lab
        stack = [start]
        n = 0
        while stack:
            i = stack.pop()
            n += 1
            x, y = i % w, i // w
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h:
                        j = ny * w + nx
                        if fg[j] and not label[j]:
                            label[j] = lab
                            stack.append(j)
        sizes.append(n)
    keep = {lab for lab, n in enumerate(sizes) if lab and n >= max(sizes) * 0.004}
    return bytearray(1 if label[i] in keep else 0 for i in range(w * h))


def make(kind, ident):
    img = Image.open(os.path.join(ROOT, kind, ident + '.jpg')).convert('RGB')
    w, h = img.size
    fg = mask_of(img, ident in STRICT)
    xs = [i % w for i in range(w * h) if fg[i]]
    ys = [i // w for i in range(w * h) if fg[i]]
    x0, x1, y0, y1 = min(xs), max(xs) + 1, min(ys), max(ys) + 1
    side = SIZE[kind] - 2 * PAD
    block = max(x1 - x0, y1 - y0) / side
    ow, oh = max(1, round((x1 - x0) / block)), max(1, round((y1 - y0) / block))
    px = img.load()
    out = Image.new('RGBA', (SIZE[kind], SIZE[kind]), (0, 0, 0, 0))
    op = out.load()
    ox, oy = (SIZE[kind] - ow) // 2, (SIZE[kind] - oh) // 2
    for by in range(oh):
        for bx in range(ow):
            sx0, sx1 = x0 + int(bx * block), x0 + max(int(bx * block) + 1, int((bx + 1) * block))
            sy0, sy1 = y0 + int(by * block), y0 + max(int(by * block) + 1, int((by + 1) * block))
            r = g = b = n = total = 0
            for y in range(sy0, min(sy1, h)):
                for x in range(sx0, min(sx1, w)):
                    total += 1
                    if fg[y * w + x]:
                        c = px[x, y]
                        r += c[0]; g += c[1]; b += c[2]; n += 1
            if total and n * 2 >= total:
                op[ox + bx, oy + by] = (r // n, g // n, b // n, 255)
    os.makedirs(os.path.join(ASSETS, kind), exist_ok=True)
    out.save(os.path.join(ASSETS, kind, ident + '.png'), optimize=True)


if __name__ == '__main__':
    wanted = set(sys.argv[1:])
    for kind in SIZE:
        for f in sorted(os.listdir(os.path.join(ROOT, kind))):
            ident = f[:-4]
            if f.endswith('.jpg') and (not wanted or ident in wanted):
                make(kind, ident)
                print(kind, ident)
