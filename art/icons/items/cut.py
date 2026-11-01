"""Cut the user's Grok item pictures (magenta background) into game icons.
python3 cut.py <raw dir> <out dir>  -> <out>/<name>.png (single item) or <name>-closed/-open.png (chests)."""
import os, sys
from PIL import Image, ImageFilter

def is_bg(p):
    r, g, b = p[:3]
    return r > 140 and b > 90 and g < 110 and r - g > 90 and b - g > 40

def key(im):
    im = im.convert('RGBA')
    px = im.load(); W, H = im.size
    for y in range(H):
        for x in range(W):
            if is_bg(px[x, y]):
                px[x, y] = (0, 0, 0, 0)
    # eat the pink fringe: opaque pixels touching transparency that still lean magenta
    a = im.getchannel('A')
    edge = a.filter(ImageFilter.MinFilter(3))
    e = edge.load(); al = a.load()
    for y in range(H):
        for x in range(W):
            if al[x, y] and not e[x, y]:
                r, g, b, _ = px[x, y]
                if r - g > 60 and b - g > 30:
                    px[x, y] = (0, 0, 0, 0)
    return im

def runs(im, gap):
    W, H = im.size; px = im.load()
    cols = [sum(1 for y in range(0, H, 2) if px[x, y][3]) > 1 for x in range(W)]
    out, start, g = [], None, 0
    for x, on in enumerate(cols + [False] * (gap + 1)):
        if on:
            if start is None: start = x
            g = 0
        elif start is not None:
            g += 1
            if g > gap:
                out.append((start, x - g + 1)); start, g = None, 0
    return out

def fit(im, box):
    im = im.crop(im.getbbox())
    s = min((box - 2) / im.width, (box - 2) / im.height)
    im = im.convert('RGBa').resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS).convert('RGBA')
    c = Image.new('RGBA', (box, box), (0, 0, 0, 0))
    c.paste(im, ((box - im.width) // 2, (box - im.height) // 2), im)
    return c

def main(src, out):
    os.makedirs(out, exist_ok=True)
    for f in sorted(os.listdir(src)):
        if not f.endswith('.png'): continue
        name = f[:-4]
        im = key(Image.open(os.path.join(src, f)))
        if name.startswith('chest'):
            rs = sorted(sorted(runs(im, 18), key=lambda r: r[1] - r[0], reverse=True)[:2])
            if len(rs) != 2:
                print('skip', f, rs); continue
            for tag, (a, b) in zip(('closed', 'open'), rs):
                fit(im.crop((a, 0, b, im.height)), 128).save(os.path.join(out, f'{name}-{tag}.png'), optimize=True)
        else:
            fit(im, 128).save(os.path.join(out, f'{name}.png'), optimize=True)
        print('ok', name)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
