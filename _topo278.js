/* ===== TOPOLOGY AFTER A BOOLEAN (v2.78) =====================================

   Pure functions: (positions, triangles, seam) in, face groups out. No scene,
   no THREE, no App - so the future Retopo op can call exactly this, and a node
   fixture can call it without a browser.

   THE INVARIANT: THE SHAPE DOES NOT MOVE. positions is never written. Only
   connectivity changes, and only inside flat patches that carry a seam
   vertex. A vertex may disappear (a collinear one, dissolved), no vertex is
   ever added and none is ever moved.

   Input is what healTJunctions returns: positions already welded at the
   app's 1e-4, so an index IS a position. */

const TOPO_COLLINEAR_EPS = 1e-4;          // the app's own weld tolerance
const TOPO_STRAIGHT_SIN = Math.sin(10 * Math.PI / 180);
const TOPO_CONTINUE_COS = Math.cos(20 * Math.PI / 180);
const TOPO_PAIR_BUDGET = 4e6;             // hole x outer x edges, per bridge
/* A bridge may not pass closer than this to any vertex it does not end at,
   nor leave its ends closer than this to the loop edges beside them (found
   by fable, v2.78). The weld grid is 1e-4 and the heal tolerance 3.5e-4, so
   anything tighter builds slivers out of rounding noise - and a sliver whose
   corner sits a grid step off the plane has a normal pointing anywhere. */
const TOPO_GRAZE = 3.5e-4;

/* WHERE A FLAT SURFACE WAS DIVIDED BY HAND (v2.78, Zeghreit 26.09: a
   boolean must not erase a loop cut). An edge shared by two faces of the SAME
   input that lie in one plane is a division someone made on purpose - there
   is no other reason for it to exist. Returned as world segments, so they
   survive whatever the evaluator does to the triangles around them.

   Only same-input, only coplanar. A fold needs no protection (the flood
   already stops at one), and two inputs meeting in a plane - two cubes
   unioned in a line - is exactly what SHOULD merge. */
function topoDivisions(P, faces, dot) {
  const key = i => Math.round(P[i * 3] * 1e4) + '_' + Math.round(P[i * 3 + 1] * 1e4) + '_' + Math.round(P[i * 3 + 2] * 1e4);
  const byEdge = new Map();
  faces.forEach(tris => {
    let n = null;
    for (let i = 0; i < tris.length && !n; i++) n = importTriNormal(P, tris[i]);
    if (!n) return;
    const cnt = new Map();
    tris.forEach(t => {
      for (let k = 0; k < 3; k++) {
        const a = t[k], b = t[(k + 1) % 3], ka = key(a), kb = key(b);
        if (ka === kb) continue;
        const e = ka < kb ? ka + '|' + kb : kb + '|' + ka;
        const c = cnt.get(e);
        cnt.set(e, c ? { n: c.n + 1, a: a, b: b } : { n: 1, a: a, b: b });
      }
    });
    cnt.forEach((c, e) => {
      if (c.n !== 1) return;                        // interior to the face
      let l = byEdge.get(e);
      if (!l) byEdge.set(e, l = []);
      l.push({ n: n, a: c.a, b: c.b });
    });
  });
  const segs = [];
  byEdge.forEach(l => {
    for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) {
      const n = l[i].n, m = l[j].n;
      if (n[0] * m[0] + n[1] * m[1] + n[2] * m[2] < dot) continue;
      const a = l[i].a, b = l[i].b;
      segs.push(P[a * 3], P[a * 3 + 1], P[a * 3 + 2], P[b * 3], P[b * 3 + 1], P[b * 3 + 2]);
      return;
    }
  });
  return segs;
}

/* Result edges lying on a division: both ends within tol of the segment and
   inside its span. The evaluator may have cut a division into pieces, and
   every piece is still the division. Null when the product of the two
   counts is past the budget - the caller then merges as before rather than
   stall the main thread. */
function topoBlockedEdges(P, tris, segs, tol) {
  const nV = P.length / 3, nS = segs.length / 6;
  const out = new Set();
  if (!nS) return out;
  const edges = new Map();
  tris.forEach(t => { for (let k = 0; k < 3; k++) {
    const a = t[k], b = t[(k + 1) % 3];
    edges.set(a < b ? a * nV + b : b * nV + a, a < b ? [a, b] : [b, a]);
  } });
  if (edges.size * nS > 2e7) return null;
  const onSeg = (s, v) => {
    const ax = segs[s], ay = segs[s + 1], az = segs[s + 2];
    const ux = segs[s + 3] - ax, uy = segs[s + 4] - ay, uz = segs[s + 5] - az;
    const L2 = ux * ux + uy * uy + uz * uz;
    if (L2 < 1e-16) return false;
    const wx = P[v * 3] - ax, wy = P[v * 3 + 1] - ay, wz = P[v * 3 + 2] - az;
    const t = (wx * ux + wy * uy + wz * uz) / L2;
    const L = Math.sqrt(L2);
    if (t * L < -tol || (t - 1) * L > tol) return false;
    const dx = wx - t * ux, dy = wy - t * uy, dz = wz - t * uz;
    return dx * dx + dy * dy + dz * dz <= tol * tol;
  };
  edges.forEach((ab, k) => {
    for (let s = 0; s < segs.length; s += 6) {
      if (onSeg(s, ab[0]) && onSeg(s, ab[1])) { out.add(k); return; }
    }
  });
  return out;
}

/* Flat patches: flood over shared edges, same material, normal within
   `dot` of the seed - the same rule mergeCoplanarTriangles floods by, so a
   patch here is exactly a face there. Each patch is walked into its boundary
   loops, outer loop first (CCW about the patch normal), holes after (CW).

   unsafe: a directed edge used twice, a pinch vertex, a loop that does not
   close, or not exactly one CCW loop. Those go to the pairs fallback,
   exactly as they do today. */
function topoPatches(P, tris, matOf, seam, dot, blocked) {
  const nV = P.length / 3;
  const normals = tris.map(t => importTriNormal(P, t));
  const ek = (a, b) => (a < b ? a * nV + b : b * nV + a);
  const edgeTris = new Map();
  tris.forEach((t, ti) => {
    if (!normals[ti]) return;
    for (let k = 0; k < 3; k++) {
      const key = ek(t[k], t[(k + 1) % 3]);
      let l = edgeTris.get(key);
      if (!l) edgeTris.set(key, l = []);
      l.push(ti);
    }
  });

  /* Counted over EVERY triangle, normal or not (found by fable, v2.78): a
     degenerate cap the heal left behind still shares edges, and an edge used
     three times reads as "interior" from inside one patch. */
  const allEdge = new Map(), vertTris = new Map();
  tris.forEach(t => { for (let k = 0; k < 3; k++) {
    const key = ek(t[k], t[(k + 1) % 3]);
    allEdge.set(key, (allEdge.get(key) || 0) + 1);
    vertTris.set(t[k], (vertTris.get(t[k]) || 0) + 1);
  } });

  const seen = new Uint8Array(tris.length);
  const patches = [];
  for (let s = 0; s < tris.length; s++) {
    if (seen[s] || !normals[s]) continue;
    const n = normals[s], mat = matOf(s);
    const region = [];
    const queue = [s];
    seen[s] = 1;
    while (queue.length) {
      const ti = queue.pop();
      region.push(ti);
      const t = tris[ti];
      for (let k = 0; k < 3; k++) {
        const ekey = ek(t[k], t[(k + 1) % 3]);
        if (blocked && blocked.has(ekey)) continue;     // a hand-made division
        (edgeTris.get(ekey) || []).forEach(nb => {
          if (seen[nb] || !normals[nb] || matOf(nb) !== mat) return;
          const m = normals[nb];
          if (n[0] * m[0] + n[1] * m[1] + n[2] * m[2] < dot) return;
          seen[nb] = 1;
          queue.push(nb);
        });
      }
    }

    let unsafe = false, touched = false;
    const dir = new Map(), vIn = new Map();
    region.forEach(ti => {
      const t = tris[ti];
      for (let k = 0; k < 3; k++) {
        if (seam.has(t[k])) touched = true;
        if (allEdge.get(ek(t[k], t[(k + 1) % 3])) > 2) unsafe = true;
        vIn.set(t[k], (vIn.get(t[k]) || 0) + 1);
        const key = t[k] * nV + t[(k + 1) % 3];
        const c = (dir.get(key) || 0) + 1;
        if (c > 1) unsafe = true;
        dir.set(key, c);
      }
    });
    const next = new Map();
    dir.forEach((_c, key) => {
      const a = Math.floor(key / nV), b = key - a * nV;
      if (dir.has(b * nV + a)) return;              // interior edge
      if (next.has(a)) unsafe = true;               // pinch
      next.set(a, b);
    });
    const loops = [];
    if (!unsafe) {
      const used = new Set();
      next.forEach((_b, a0) => {
        if (unsafe || used.has(a0)) return;
        const loop = [];
        let v = a0;
        do {
          loop.push(v);
          used.add(v);
          v = next.get(v);
        } while (v !== undefined && v !== a0 && loop.length <= next.size);
        if (v !== a0 || loop.length < 3) unsafe = true;
        else loops.push(loop);
      });
    }
    /* A vertex inside the patch (on no loop) must belong to the patch alone;
       re-triangulating the patch drops it, and any triangle outside still
       pointing at it would be left with an open edge. */
    if (!unsafe) {
      const onLoop = new Set();
      loops.forEach(l => l.forEach(v => onLoop.add(v)));
      vIn.forEach((c, v) => { if (!onLoop.has(v) && vertTris.get(v) !== c) unsafe = true; });
    }
    if (!unsafe) {
      const area = loops.map(l => topoLoopArea3(P, l, n));
      const outer = area.map((a, i) => (a > 0 ? i : -1)).filter(i => i >= 0);
      if (outer.length !== 1) unsafe = true;
      else loops.unshift(loops.splice(outer[0], 1)[0]);
    }
    patches.push({ tris: region, mat: mat, n: n, loops: unsafe ? [] : loops,
                   touched: touched, unsafe: unsafe, changed: false });
  }
  return { patches: patches, edgeTris: edgeTris, normals: normals, ek: ek };
}

// Signed area of a closed 3D loop about the unit normal n.
function topoLoopArea3(P, loop, n) {
  let x = 0, y = 0, z = 0;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i] * 3, b = loop[(i + 1) % loop.length] * 3;
    x += P[a + 1] * P[b + 2] - P[a + 2] * P[b + 1];
    y += P[a + 2] * P[b] - P[a] * P[b + 2];
    z += P[a] * P[b + 1] - P[a + 1] * P[b];
  }
  return 0.5 * (x * n[0] + y * n[1] + z * n[2]);
}

/* v lies on segment ab, strictly between the ends. Absolute AND relative:
   1e-4 is the weld grid, so a point the evaluator put on an edge can sit up
   to that far off it after welding; the relative bound stops a tiny edge
   hiding a real corner under the absolute one. */
function topoCollinear(P, a, v, b) {
  const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2];
  const ux = P[b * 3] - ax, uy = P[b * 3 + 1] - ay, uz = P[b * 3 + 2] - az;
  const wx = P[v * 3] - ax, wy = P[v * 3 + 1] - ay, wz = P[v * 3 + 2] - az;
  const L2 = ux * ux + uy * uy + uz * uz;
  if (L2 < 1e-16) return false;
  const t = (wx * ux + wy * uy + wz * uz) / L2;
  if (!(t > 0 && t < 1)) return false;
  const dx = wx - t * ux, dy = wy - t * uy, dz = wz - t * uz;
  const d = Math.hypot(dx, dy, dz);
  const L = Math.sqrt(L2);
  return d <= TOPO_COLLINEAR_EPS && d <= 0.02 * Math.min(t * L, (1 - t) * L);
}

// A 2D frame on the patch plane with u x v = n, so CCW stays CCW.
function topoFrame(n) {
  const a = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  let u = [n[1] * a[2] - n[2] * a[1], n[2] * a[0] - n[0] * a[2], n[0] * a[1] - n[1] * a[0]];
  const l = Math.hypot(u[0], u[1], u[2]);
  u = [u[0] / l, u[1] / l, u[2] / l];
  const v = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
  return { u: u, v: v };
}

/* Ear clipping of one simple CCW polygon. Null when it cannot finish, and
   the caller then gives the whole result back to the old path - a face this
   pass could not triangulate is not a face it gets to half-emit. */
function topoEarClip(xy, ids, eps) {
  const idx = ids.map((_v, i) => i);
  const out = [];
  const cr = (i, j, k) => (xy[j][0] - xy[i][0]) * (xy[k][1] - xy[i][1]) -
                          (xy[j][1] - xy[i][1]) * (xy[k][0] - xy[i][0]);
  let guard = 0;
  while (idx.length > 3) {
    if (guard++ > 100000) return null;
    /* THE FATTEST EAR, not the first one (v2.78, fable's fuzz). Any valid ear
       triangulates, but the first one found on a polygon with a near-straight
       run is routinely a sliver a grid step high - and the face's normal is
       then read off noise. */
    let cut = -1, bestQ = -1;
    for (let k = 0; k < idx.length; k++) {
      const i0 = idx[(k + idx.length - 1) % idx.length], i1 = idx[k], i2 = idx[(k + 1) % idx.length];
      if (cr(i0, i1, i2) <= eps) continue;
      let ok = true;
      for (let m = 0; m < idx.length && ok; m++) {
        const j = idx[m];
        if (j === i0 || j === i1 || j === i2) continue;
        if (cr(i0, i1, j) >= -eps && cr(i1, i2, j) >= -eps && cr(i2, i0, j) >= -eps) ok = false;
      }
      if (!ok) continue;
      const q = cr(i0, i1, i2) / Math.max(
        Math.hypot(xy[i1][0] - xy[i0][0], xy[i1][1] - xy[i0][1]),
        Math.hypot(xy[i2][0] - xy[i1][0], xy[i2][1] - xy[i1][1]),
        Math.hypot(xy[i0][0] - xy[i2][0], xy[i0][1] - xy[i2][1]));
      if (q > bestQ) { bestQ = q; cut = k; }
    }
    if (cut < 0) return null;
    const n = idx.length;
    out.push([idx[(cut + n - 1) % n], idx[cut], idx[(cut + 1) % n]]);
    idx.splice(cut, 1);
  }
  if (cr(idx[0], idx[1], idx[2]) <= eps) return null;
  out.push([idx[0], idx[1], idx[2]]);
  topoFlip(xy, out, eps);
  return out.map(t => [ids[t[0]], ids[t[1]], ids[t[2]]]);
}

/* Diagonal flips inside one polygon until the thinnest triangle stops
   improving (v2.78). Greedy ear choice alone still leaves a sliver where the
   only ear available at some step is thin; a flip across an interior
   diagonal fixes it without touching the boundary, and the boundary is the
   face. Only diagonals are flipped - an edge used once is the outline. */
function topoFlip(xy, T, eps) {
  const cr = (i, j, k) => (xy[j][0] - xy[i][0]) * (xy[k][1] - xy[i][1]) -
                          (xy[j][1] - xy[i][1]) * (xy[k][0] - xy[i][0]);
  const h = t => {
    const a = xy[t[0]], b = xy[t[1]], c = xy[t[2]];
    return cr(t[0], t[1], t[2]) / Math.max(Math.hypot(b[0] - a[0], b[1] - a[1]),
      Math.hypot(c[0] - b[0], c[1] - b[1]), Math.hypot(a[0] - c[0], a[1] - c[1]));
  };
  for (let pass = 0; pass < 8 * T.length + 8; pass++) {
    const at = new Map();
    T.forEach((t, ti) => { for (let k = 0; k < 3; k++) at.set(t[k] + ',' + t[(k + 1) % 3], [ti, k]); });
    let flipped = false;
    for (let ti = 0; ti < T.length && !flipped; ti++) {
      for (let k = 0; k < 3 && !flipped; k++) {
        const t = T[ti], a = t[k], c = t[(k + 1) % 3], b = t[(k + 2) % 3];
        const o = at.get(c + ',' + a);
        if (!o) continue;                            // outline edge
        const u = T[o[0]], d = u[(o[1] + 2) % 3];
        // (a,c,b) and (c,a,d) -> (b,a,d) and (d,c,b), if the quad is convex.
        const n1 = [b, a, d], n2 = [d, c, b];
        if (cr(n1[0], n1[1], n1[2]) <= eps || cr(n2[0], n2[1], n2[2]) <= eps) continue;
        if (Math.min(h(n1), h(n2)) > Math.min(h(t), h(u)) * (1 + 1e-9)) {
          T[ti] = n1; T[o[0]] = n2; flipped = true;
        }
      }
    }
    if (!flipped) return;
  }
}

/* A patch with holes -> simple polygons, by bridges between EXISTING
   vertices (a new vertex would move nothing, but it would change the set of
   positions, and v2.78 promises that set is untouched).

   Two bridges per hole: the first alone would leave a keyhole, which is one
   loop that walks the same edge twice - getGroupBoundaryLoopAttr cannot read
   that and Inset would tear it. The second splits the keyhole in two.

   WHERE THE BRIDGES GO (Zeghreit, 26.09: "continuation"). Ranked:
     tier 0 - from an outer vertex on a STRAIGHT stretch of boundary where an
              edge of a neighbouring face arrives (a loop cut on the wall), in
              the direction that loop would continue across this face;
     tier 1 - from any outer vertex with an arriving edge (a corner of the
              host face), along its inward bisector;
     tier 2 - anything valid.
   Inside a tier: shortest, best aligned, and for the second bridge the most
   even split of area. */
function topoBridge(P, patch, nbr, ek) {
  const fr = topoFrame(patch.n);
  const xy = new Map();
  const put = id => {
    if (xy.has(id)) return;
    const x = P[id * 3], y = P[id * 3 + 1], z = P[id * 3 + 2];
    xy.set(id, [x * fr.u[0] + y * fr.u[1] + z * fr.u[2], x * fr.v[0] + y * fr.v[1] + z * fr.v[2]]);
  };
  patch.loops.forEach(l => l.forEach(put));
  const pe = new Set();
  patch.loops.forEach(l => l.forEach((v, i) => pe.add(ek(v, l[(i + 1) % l.length]))));

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  xy.forEach(p => { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
                    minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); });
  const scale = Math.max(maxX - minX, maxY - minY, 1e-9);
  const eps = 1e-9 * scale;

  const orient = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const onSeg = (a, b, c) => Math.min(a[0], b[0]) - eps <= c[0] && c[0] <= Math.max(a[0], b[0]) + eps &&
                             Math.min(a[1], b[1]) - eps <= c[1] && c[1] <= Math.max(a[1], b[1]) + eps;
  const sgn = x => (x > eps * scale ? 1 : x < -eps * scale ? -1 : 0);
  function segHit(p1, p2, p3, p4) {                 // closed intersection
    const d1 = sgn(orient(p3, p4, p1)), d2 = sgn(orient(p3, p4, p2));
    const d3 = sgn(orient(p1, p2, p3)), d4 = sgn(orient(p1, p2, p4));
    if (d1 * d2 < 0 && d3 * d4 < 0) return true;
    if (d1 === 0 && onSeg(p3, p4, p1)) return true;
    if (d2 === 0 && onSeg(p3, p4, p2)) return true;
    if (d3 === 0 && onSeg(p1, p2, p3)) return true;
    if (d4 === 0 && onSeg(p1, p2, p4)) return true;
    return false;
  }
  const TAU = 2 * Math.PI;
  const ang = d => Math.atan2(d[1], d[0]);
  const norm = a => ((a % TAU) + TAU) % TAU;
  // d leaves v strictly into the region's side (left of the directed loop).
  function inCone(prev, v, next, d) {
    const P0 = xy.get(v), Pn = xy.get(next), Pp = xy.get(prev);
    const a1 = ang([Pn[0] - P0[0], Pn[1] - P0[1]]);
    const a2 = ang([Pp[0] - P0[0], Pp[1] - P0[1]]);
    const span = norm(a2 - a1), t = norm(ang(d) - a1);
    return t > 1e-7 && t < span - 1e-7;
  }
  const unit = (a, b) => { const x = b[0] - a[0], y = b[1] - a[1], l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
  // What an edge arriving at v from outside this patch asks of a bridge.
  function pull(prev, v, next) {
    const ext = Array.from(nbr.get(v) || []).filter(x => !pe.has(ek(v, x)));
    if (!ext.length) return null;
    const p = xy.get(prev), c = xy.get(v), q = xy.get(next);
    const ei = unit(p, c), eo = unit(c, q);
    let bx = -ei[1] - eo[1], by = ei[0] + eo[0];
    const bl = Math.hypot(bx, by);
    if (bl < 1e-9) return null;
    bx /= bl; by /= bl;
    const straight = Math.abs(ei[0] * eo[1] - ei[1] * eo[0]) < TOPO_STRAIGHT_SIN && ei[0] * eo[0] + ei[1] * eo[1] > 0;
    return { dir: [bx, by], straight: straight };
  }
  const nbOf = (loop, i) => [loop[(i + loop.length - 1) % loop.length], loop[(i + 1) % loop.length]];
  function areaOf(poly) {
    let s = 0;
    for (let i = 0; i < poly.length; i++) {
      const a = xy.get(poly[i]), b = xy.get(poly[(i + 1) % poly.length]);
      s += a[0] * b[1] - a[1] * b[0];
    }
    return s / 2;
  }
  function inside(poly, pt) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = xy.get(poly[i]), b = xy.get(poly[j]);
      if ((a[1] > pt[1]) !== (b[1] > pt[1]) &&
          pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  }
  const edgesOf = poly => poly.map((v, i) => [v, poly[(i + 1) % poly.length]]);

  /* Best bridge from `outer` (with its own neighbours) to `hole`, avoiding
     every edge in `walls`. skipO / skipH: the first bridge's ends, which the
     second may not reuse. split: the keyhole, when choosing the second. */
  function best(outer, hole, walls, skipO, skipH, split) {
    let win = null;
    if (outer.length * hole.length * walls.length > TOPO_PAIR_BUDGET) return null;
    const area0 = split ? Math.abs(areaOf(split)) : 0;
    const others = new Set();
    walls.forEach(e => { others.add(e[0]); others.add(e[1]); });
    const dSeg = (p, a, b) => {
      const ux = b[0] - a[0], uy = b[1] - a[1], L2 = ux * ux + uy * uy;
      let t = L2 > 0 ? ((p[0] - a[0]) * ux + (p[1] - a[1]) * uy) / L2 : 0;
      t = Math.max(0, Math.min(1, t));
      return Math.hypot(p[0] - a[0] - t * ux, p[1] - a[1] - t * uy);
    };
    for (let i = 0; i < outer.length; i++) {
      const o = outer[i];
      if (o === skipO) continue;
      const [op, on] = nbOf(outer, i);
      const po = xy.get(o);
      const wantO = pull(op, o, on);
      for (let j = 0; j < hole.length; j++) {
        const h = hole[j];
        if (h === skipH) continue;
        const ph = xy.get(h);
        const d = unit(po, ph), len = Math.hypot(ph[0] - po[0], ph[1] - po[1]);
        if (!inCone(op, o, on, d)) continue;
        const [hp, hn] = nbOf(hole, j);
        if (!inCone(hp, h, hn, [-d[0], -d[1]])) continue;
        let clear = true;
        for (let w = 0; w < walls.length && clear; w++) {
          const e = walls[w];
          if (e[0] === o || e[1] === o || e[0] === h || e[1] === h) continue;
          if (segHit(po, ph, xy.get(e[0]), xy.get(e[1]))) clear = false;
        }
        if (!clear) continue;
        for (const x of others) {
          if (x === o || x === h) continue;
          if (dSeg(xy.get(x), po, ph) < TOPO_GRAZE) { clear = false; break; }
        }
        if (!clear) continue;
        /* And the triangle the bridge makes with each loop edge beside it must
           not be a sliver either - a hole edge pointing almost straight at the
           corner the bridge runs to is the case (fuzz, v2.78): no vertex is near
           the bridge, yet the two share a line. Height of (a, b, x), taken off
           its longest side, the same measure the fixture checks. */
        const tall = (a, b, x) => {
          const cr2 = Math.abs((b[0] - a[0]) * (x[1] - a[1]) - (b[1] - a[1]) * (x[0] - a[0]));
          const L = Math.max(Math.hypot(b[0] - a[0], b[1] - a[1]), Math.hypot(x[0] - a[0], x[1] - a[1]),
                             Math.hypot(x[0] - b[0], x[1] - b[1]));
          return cr2 / L >= TOPO_GRAZE;
        };
        if (!tall(po, ph, xy.get(op)) || !tall(po, ph, xy.get(on)) ||
            !tall(po, ph, xy.get(hp)) || !tall(po, ph, xy.get(hn))) continue;
        const wantH = pull(hp, h, hn);
        const aO = wantO ? wantO.dir[0] * d[0] + wantO.dir[1] * d[1] : 0;
        const aH = wantH ? -(wantH.dir[0] * d[0] + wantH.dir[1] * d[1]) : 0;
        const tier = wantO && wantO.straight && aO >= TOPO_CONTINUE_COS ? 0 : wantO ? 1 : 2;
        let cost = len / scale + (1 - aO) + 0.5 * (1 - aH);
        let pieces = null;
        if (split) {
          const a = split.indexOf(o), b = split.indexOf(h);
          const p1 = a < b ? split.slice(a, b + 1) : split.slice(a).concat(split.slice(0, b + 1));
          const p2 = b < a ? split.slice(b, a + 1) : split.slice(b).concat(split.slice(0, a + 1));
          const A1 = areaOf(p1), A2 = areaOf(p2);
          if (A1 <= eps * scale || A2 <= eps * scale) continue;
          cost += Math.abs(A1 - A2) / area0;
          pieces = [p1, p2];
        }
        if (!win || tier < win.tier || (tier === win.tier && cost < win.cost - 1e-12)) {
          win = { o: o, h: h, tier: tier, cost: cost, pieces: pieces };
        }
      }
    }
    return win;
  }

  // Faces still holding holes, split one hole at a time.
  const done = [];
  const work = [{ poly: patch.loops[0].slice(), holes: patch.loops.slice(1).map(h => h.slice()) }];
  while (work.length) {
    const f = work.pop();
    if (!f.holes.length) { done.push(f.poly); continue; }
    const hole = f.holes[0];
    const others = f.holes.slice(1);
    const walls = edgesOf(f.poly).concat(edgesOf(hole));
    others.forEach(h => walls.push.apply(walls, edgesOf(h)));
    const b1 = best(f.poly, hole, walls, -1, -1, null);
    if (!b1) return null;
    const oi = f.poly.indexOf(b1.o), hi = hole.indexOf(b1.h);
    const polyR = f.poly.slice(oi).concat(f.poly.slice(0, oi));
    const holeR = hole.slice(hi).concat(hole.slice(0, hi));
    const key = [b1.o].concat(holeR, [b1.h, b1.o], polyR.slice(1));
    const walls2 = edgesOf(key);
    others.forEach(h => walls2.push.apply(walls2, edgesOf(h)));
    // The keyhole lists o and h twice; b2 may use neither, so its own two
    // ends are each unique in `key` and indexOf finds the one it splits at.
    const b2 = best(f.poly, hole, walls2, b1.o, b1.h, key);
    if (!b2) return null;
    const pieces = b2.pieces;
    [0, 1].forEach(k => {
      const mine = others.filter(h => inside(pieces[k], xy.get(h[0])));
      work.push({ poly: pieces[k], holes: mine });
    });
  }
  return done;
}

/* Whole result -> face groups, like mergeCoplanarTriangles, plus: collinear
   vertices dissolved and holes bridged, inside patches that touch the seam.
   Returns null when anything here could not finish; the caller then uses
   the old path, so this pass can make a result better and never worse. */
function topoNgon(P, tris, matOf, seam, dot, blocked) {
  const T = topoPatches(P, tris, matOf, seam, dot, blocked);
  const patches = T.patches, ek = T.ek, edgeTris = T.edgeTris;
  patches.forEach(p => {
    p.mode = p.unsafe ? 'pairs'
           : p.loops.length === 1 ? 'simple'
           : p.touched ? 'bridge' : 'pairs';
  });

  // The polygon graph: every edge that will be a face edge.
  const nbr = new Map();
  const link = (a, b) => {
    if (!nbr.has(a)) nbr.set(a, new Set());
    if (!nbr.has(b)) nbr.set(b, new Set());
    nbr.get(a).add(b); nbr.get(b).add(a);
  };
  const frozen = new Set();
  const patchesOf = new Map();
  patches.forEach((p, pi) => {
    if (p.mode === 'pairs') {
      p.tris.forEach(ti => tris[ti].forEach(v => frozen.add(v)));
      p.tris.forEach(ti => { const t = tris[ti]; link(t[0], t[1]); link(t[1], t[2]); link(t[2], t[0]); });
      return;
    }
    p.loops.forEach(l => l.forEach((v, i) => {
      link(v, l[(i + 1) % l.length]);
      if (!patchesOf.has(v)) patchesOf.set(v, []);
      patchesOf.get(v).push(pi);
    }));
  });

  // Dissolve: degree 2 in the polygon graph, collinear, next to the seam.
  let dissolved = 0;
  const work = Array.from(nbr.keys());
  while (work.length) {
    const v = work.pop();
    if (frozen.has(v) || !nbr.has(v)) continue;
    const nb = nbr.get(v);
    if (nb.size !== 2) continue;
    const pl = patchesOf.get(v) || [];
    if (!pl.some(pi => patches[pi].touched)) continue;
    const it = nb.values(), a = it.next().value, b = it.next().value;
    if (nbr.get(a).has(b)) continue;
    if (!topoCollinear(P, a, v, b)) continue;
    let ok = true;
    const hits = [];
    pl.forEach(pi => patches[pi].loops.forEach(l => {
      const i = l.indexOf(v);
      if (i < 0) return;
      if (l.length <= 3) ok = false;
      hits.push([pi, l, i]);
    }));
    if (!ok || !hits.length) continue;
    hits.forEach(h => { h[1].splice(h[2], 1); patches[h[0]].changed = true; });
    nbr.delete(v);
    nbr.get(a).delete(v); nbr.get(b).delete(v);
    link(a, b);
    dissolved++;
    work.push(a, b);
  }

  // Emit.
  const groups = [];
  let bridged = 0;
  for (let pi = 0; pi < patches.length; pi++) {
    const p = patches[pi];
    if (p.mode === 'pairs') { topoPairs(p, tris, edgeTris, ek, groups); continue; }
    if (p.mode === 'simple' && !p.changed) {
      groups.push({ triangles: p.tris.map(ti => tris[ti]), mat: p.mat });
      continue;
    }
    const polys = p.mode === 'bridge' ? topoBridge(P, p, nbr, ek) : [p.loops[0]];
    if (!polys) return null;
    if (p.mode === 'bridge') bridged += p.loops.length - 1;
    const fr = topoFrame(p.n);
    for (const poly of polys) {
      const xy = poly.map(id => {
        const x = P[id * 3], y = P[id * 3 + 1], z = P[id * 3 + 2];
        return [x * fr.u[0] + y * fr.u[1] + z * fr.u[2], x * fr.v[0] + y * fr.v[1] + z * fr.v[2]];
      });
      let s = 0;
      for (let i = 0; i < xy.length; i++) s = Math.max(s, Math.abs(xy[i][0]), Math.abs(xy[i][1]));
      const tri = topoEarClip(xy, poly, 1e-12 * Math.max(s * s, 1e-12));
      if (!tri) return null;
      groups.push({ triangles: tri, mat: p.mat });
    }
  }
  return { groups: groups, dissolved: dissolved, bridged: bridged, frozen: frozen };
}

// The old fallback, unchanged in meaning: coplanar pairs across a clean edge.
function topoPairs(p, tris, edgeTris, ek, out) {
  const inP = new Set(p.tris);
  const paired = new Set();
  p.tris.forEach(ti => {
    if (paired.has(ti)) return;
    const t = tris[ti];
    let mate = -1;
    for (let k = 0; k < 3 && mate < 0; k++) {
      const occ = edgeTris.get(ek(t[k], t[(k + 1) % 3])) || [];
      if (occ.length !== 2) continue;
      const o = occ[0] === ti ? occ[1] : occ[0];
      if (o !== ti && !paired.has(o) && inP.has(o)) mate = o;
    }
    paired.add(ti);
    if (mate >= 0) { paired.add(mate); out.push({ triangles: [t, tris[mate]], mat: p.mat }); }
    else out.push({ triangles: [t], mat: p.mat });
  });
}
/* ===== end topology ======================================================= */
