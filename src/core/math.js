// Small math helpers. Boxes are { x, y, w, h } with y pointing down.
CS.M = {
  clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)),
  rand: (a, b) => a + Math.random() * (b - a),
  pick: arr => arr[Math.floor(Math.random() * arr.length)],

  // Move v toward target by at most delta.
  approach(v, target, delta) {
    return v < target ? Math.min(v + delta, target) : Math.max(v - delta, target);
  },

  overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  },

  circleBox(cx, cy, r, b) {
    return cx + r > b.x && cx - r < b.x + b.w && cy + r > b.y && cy - r < b.y + b.h;
  },

  // Segment (x1,y1)->(x2,y2) against a box. Returns the entry fraction 0..1, or -1 on a miss.
  segBox(x1, y1, x2, y2, b) {
    let tmin = 0, tmax = 1;
    const p = [x1, y1], d = [x2 - x1, y2 - y1], lo = [b.x, b.y], hi = [b.x + b.w, b.y + b.h];
    for (let i = 0; i < 2; i++) {
      if (Math.abs(d[i]) < 1e-9) {
        if (p[i] < lo[i] || p[i] > hi[i]) return -1;
        continue;
      }
      let t1 = (lo[i] - p[i]) / d[i], t2 = (hi[i] - p[i]) / d[i];
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return -1;
    }
    return tmin;
  },
};
