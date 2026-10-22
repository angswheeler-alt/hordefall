# Walk fix for run sheets whose feet barely move. Run after animate.js:  python3 art/heroes/legwalk.py
#
# For every hero whose art/heroes/<id>/frames.json has "legwalk" (the run frame to start from), it rebuilds
# public/heroes/<id>_run.png as 6 frames from that one frame: the two legs swing in turn from the hip (front
# leg back while the back leg comes forward), the foot coming forward lifts, and the body bobs 1px on the
# passing frames. Pixels far to the sides of the hips (capes, splashes) stay put. It then sets run: 6 in
# src/heroAnims.ts. animate.js rewrites both files, so run this again after it.
import json, math, os, re
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, '..', '..', 'public', 'heroes')
ANIMS = os.path.join(ROOT, '..', '..', 'src', 'heroAnims.ts')
FRAMES = 6

def walk(i, start, anims):
    m = re.search(rf'  {i}: \{{ frame: \[(\d+),(\d+)\], feet: \[(\d+),(\d+)\], headTop: (\d+), run: (\d+)', anims)
    fw, fh, _, fy, top, nrun = map(int, m.groups())
    strip = np.array(Image.open(os.path.join(OUT, f'{i}_run.png')).convert('RGBA'))
    base = strip[:, start * fw:(start + 1) * fw]
    tall = fy - top
    hip = int(fy - 0.36 * tall)
    # Hip centre: the middle of the widest solid run on the hip row (the body, not stray effects).
    xs = np.where(base[hip, :, 3] > 0)[0]
    runs, st = [], xs[0]
    for a, b in zip(xs, list(xs[1:]) + [None]):
        if b is None or b != a + 1: runs.append((st, a)); st = b
    r0, r1 = max(runs, key=lambda r: r[1] - r[0])
    split, reach, stride, L = (r0 + r1) / 2, 0.38 * tall, 0.16 * tall, fy - hip
    low = base[hip:fy + 1]
    out = []
    for k in range(FRAMES):
        p = 2 * math.pi * k / FRAMES
        bob = 0 if k % 3 == 0 else -1
        img = np.zeros_like(base)
        img[:hip + bob] = base[-bob:hip]
        for leg in ('back', 'front'):
            sgn = -1 if leg == 'front' else 1
            forward = ((leg == 'front') == (math.sin(p) > 0)) and abs(math.sin(p)) > 0.1
            lift = round(3 * abs(math.sin(p))) if forward else 0
            for y in range(L + 1):
                t = y / L
                dx, dy = round(-sgn * stride * math.cos(p) * t), -round(lift * t) + bob
                for x in range(fw):
                    if low[y, x, 3] == 0 or (x < split) != (leg == 'back'): continue
                    far = abs(x - split) > reach
                    nx, ny = x + (0 if far else dx), hip + y + (bob if far else dy)
                    if 0 <= nx < fw and 0 <= ny < fh: img[ny, nx] = low[y, x]
        out.append(img)
    Image.fromarray(np.concatenate(out, 1)).save(os.path.join(OUT, f'{i}_run.png'))
    return re.sub(rf'(  {i}: \{{[^}}]*run: )\d+', rf'\g<1>{FRAMES}', anims)

anims = open(ANIMS).read()
for i in sorted(os.listdir(ROOT)):
    cfg = os.path.join(ROOT, i, 'frames.json')
    if os.path.exists(cfg) and 'legwalk' in json.load(open(cfg)):
        anims = walk(i, json.load(open(cfg))['legwalk'], anims)
        print(i, 'walk rebuilt')
open(ANIMS, 'w').write(anims)
