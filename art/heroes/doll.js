// "Paper doll" sprite builder: heroes are assembled from shapes (ellipses, polygons, tapered limbs),
// each shape a separate part with a material. Rendering gives every part rounded, 3D-style shading lit
// from the top left (a dome height field per part), glossy highlights on shiny materials, a dark line
// where a part is overlapped by one in front of it, and a coloured outline around the silhouette.
const { Canvas, hex } = require('../backgrounds/png');

// Mostly frontal light from the upper left: forms read as round, but faces (on the right) stay lit.
const LIGHT = norm([-0.45, -0.65, 1.5]);
function norm(v) { const l = Math.hypot(...v); return v.map(c => c / l); }
const mix = (a, b, t) => { const A = hex(a), B = hex(b); return A.map((v, i) => Math.round(v + (B[i] - v) * t)); };
const toHex = rgb => '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');

// A material: [light, base, dark] plus options. Ramp: deep, dark, base, light, (spec if gloss).
function material(tones, { gloss = false, flat = false } = {}) {
  const [light, base, dark] = tones;
  return {
    flat,
    ramp: [toHex(mix(dark, '#24122e', 0.45)), dark, base, light, gloss ? toHex(mix(light, '#ffffff', 0.65)) : light],
    edge: toHex(mix(dark, '#1a0c10', 0.6)),
  };
}

class Doll {
  constructor(size = 48) {
    this.size = size;
    this.mat = Array.from({ length: size }, () => Array(size).fill(null));
    this.part = Array.from({ length: size }, () => Array(size).fill(-1));
    this.parts = 0;
    this.detail = new Set(); // parts drawn with pixels() never cast overlap lines
  }
  _put(x, y, m, p) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return;
    this.mat[y][x] = m; this.part[y][x] = p;
  }
  _fill(test, m, box) {
    const p = this.parts++;
    const [x0, y0, x1, y1] = box || [0, 0, this.size - 1, this.size - 1];
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(this.size - 1, Math.ceil(y1)); y++)
      for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(this.size - 1, Math.ceil(x1)); x++)
        if (test(x + 0.5, y + 0.5)) this._put(x, y, m, p);
    return this;
  }
  ellipse(cx, cy, rx, ry, m) {
    return this._fill((x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1, m, [cx - rx, cy - ry, cx + rx, cy + ry]);
  }
  poly(pts, m) {
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const inside = (x, y) => {
      let c = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
    return this._fill(inside, m, [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]);
  }
  // Tapered capsule from (x1,y1,r1) to (x2,y2,r2): limbs, blades, staffs.
  limb(x1, y1, x2, y2, r1, r2, m) {
    const dx = x2 - x1, dy = y2 - y1, len2 = dx * dx + dy * dy || 1;
    const test = (x, y) => {
      const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len2));
      const r = r1 + (r2 - r1) * t;
      return (x - x1 - dx * t) ** 2 + (y - y1 - dy * t) ** 2 <= r * r;
    };
    const R = Math.max(r1, r2);
    return this._fill(test, m, [Math.min(x1, x2) - R, Math.min(y1, y2) - R, Math.max(x1, x2) + R, Math.max(y1, y2) + R]);
  }
  // Single pixels / short runs for faces and fine detail; each call is one part.
  pixels(list, m) {
    const p = this.parts++;
    this.detail.add(p);
    for (const [x, y] of list) this._put(x, y, m, p);
    return this;
  }
  rect(x, y, w, h, m) { return this._fill(() => true, m, [x, y, x + w - 1, y + h - 1]); }

  render(materials, outline = '#2e1a16') {
    const N = this.size, c = new Canvas(N, N);
    const partAt = (x, y) => (x < 0 || y < 0 || x >= N || y >= N ? -1 : this.part[y][x]);
    // Distance from each pixel to the edge of its part, for the dome height field.
    const dist = Array.from({ length: N }, () => Array(N).fill(0));
    const edges = {};
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const p = this.part[y][x];
      if (p < 0) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => { const q = partAt(x + a, y + b); return q !== p && (q < 0 || !this.detail.has(q) || this.detail.has(p)); })) (edges[p] ||= []).push([x, y]);
    }
    const maxD = {};
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const p = this.part[y][x];
      if (p < 0) continue;
      let best = 1e9;
      for (const [ex, ey] of edges[p]) { const d = (ex - x) ** 2 + (ey - y) ** 2; if (d < best) best = d; }
      dist[y][x] = Math.sqrt(best) + 0.5;
      maxD[p] = Math.max(maxD[p] || 0, dist[y][x]);
    }
    const height = (x, y, p) => {
      if (partAt(x, y) !== p && !this.detail.has(partAt(x, y))) return 0;
      const C = Math.max(2, Math.min(7, maxD[p])); // big parts get gentle domes, small ones stay crisp
      const t = Math.min(1, dist[y][x] / C);
      return Math.sqrt(1 - (1 - t) ** 2) * C * 0.9;
    };
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const p = this.part[y][x];
      if (p < 0) continue;
      const m = materials[this.mat[y][x]];
      if (!m) throw new Error(`no material '${this.mat[y][x]}'`);
      if (m.flat) { c.set(x, y, m.ramp[2]); continue; }
      const n = norm([height(x - 1, y, p) - height(x + 1, y, p), height(x, y - 1, p) - height(x, y + 1, p), 2]);
      const v = n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2];
      let i = v < 0.42 ? 0 : v < 0.66 ? 1 : v < 0.86 ? 2 : v < 0.97 ? 3 : 4;
      // Occlusion line: this pixel touches a part drawn in front of it.
      const front = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => { const q = partAt(x + a, y + b); return q > p && !this.detail.has(q); });
      if (front) i = 0;
      c.set(x, y, m.ramp[i]);
    }
    // Coloured outline: the darkened edge colour of the neighbouring material, warm-dark by default.
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (this.part[y][x] >= 0) continue;
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => (partAt(x + a, y + b) >= 0 ? this.mat[y + b][x + a] : null)).filter(Boolean);
      if (nb.length) c.set(x, y, outline);
    }
    return c;
  }
}

module.exports = { Doll, material, mix, toHex };
