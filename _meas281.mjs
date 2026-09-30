// v2.80 QUADS along the cut - node fixture on the REAL engine.
// run: node _topo280fx.mjs [-v]   (libs: _dev/csg, same versions as the importmap)
import fs from 'fs';
const here = new URL('.', import.meta.url);
const LIB = new URL('_dev/csg/node_modules/', here);
const THREE = await import(new URL('three/build/three.module.js', LIB).href);
const CSG = await import(new URL('three-bvh-csg/build/index.module.js', LIB).href);
const VERBOSE = process.argv.includes('-v');
const TYPE = 'loops';

const html = fs.readFileSync(new URL('index.html', here), 'utf8');
function cut(a, b) { const i = html.indexOf(a), j = html.indexOf(b, i); if (i < 0 || j < 0) throw new Error('cut ' + a); return html.slice(i, j); }
const lib = new Function('THREE', 'const IMPORT_TRI_BUDGET = 40000; const IMPORT_COPLANAR_DOT = 0.9998; const SHARP_ANGLE = 33 * Math.PI / 180; const SHARP_EPS = 1e-6;' +
  cut('const CSG_WELD_TOL =', 'const BOOL_OPS') +
  cut('function importWeldKey(', '/* A budget, refused out loud').replace('function mergeCoplanarTriangles(', 'function legacyMerge(') +
  'let captured = null; function mergeCoplanarTriangles(p, t, m) { captured = { positions: p, tris: t, matOf: m }; return legacyMerge(p, t, m); }' +
  '; return { editableFromCSGResult, topoDivisions, importTriNormal, topoClosestOnTri, TOPO_Q_SPACE, TOPO_X_SPACE, topoQuadCounts, setThin(v, t, n, sl) { TOPO_Q_THIN = v; if (t != null) TOPO_Q_THIN_TOL = t; if (n != null) TOPO_Q_THIN_N = n; if (sl != null) TOPO_Q_SLIDE = sl; }, get captured() { return captured; } };')(THREE);

let fails = 0, n = 0;
// v2.81 Loops: what each case must do beyond the invariant
const LEXP = {
  'sphere - cylinder': ['both sphere sides rebuilt on every seed, every body meridian carried to the cut', (s, k) => k.length === 12 && s.rebuilt0 === 2 && s.lines.every(x => x === 16)],
  'sphere - tilted cylinder': ['rebuilt on every seed, lines carried', (s, k) => k.length === 12 && s.lines.every(x => x >= 8)],
  'cube - rod': ['both faces rebuilt on every seed', (s, k) => k.length === 12 && s.rebuilt0 === 2],
  'sphere U small sphere': ['host rebuilt, body lines carried', (s, k) => k.length === 12 && s.lines[0] >= 16],
  'model - ball (chest)': ['host rebuilt on the default seed, lines carried', (s, k) => k[0] === 0 && s.lines[0] >= 10],
  'model U ball (chest)': ['host rebuilt on the default seed, lines carried', (s, k) => k[0] === 0 && s.lines[0] >= 10],
};
const SPACE = lib.TOPO_X_SPACE;
function check(name, ok, note) { n++; if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (note ? '  ' + note : '')); }

// ---- Meshes the way Kubik makes them: one face per quad, n-gon caps.
function meshOf(P, faces) {         // faces: arrays of vertex ids, CCW from outside
  const I = [], g = new THREE.BufferGeometry();
  const groups = [];
  faces.forEach(f => { const s = I.length; for (let i = 1; i + 1 < f.length; i++) I.push(f[0], f[i], f[i + 1]); groups.push([s, I.length - s]); });
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setIndex(I);
  groups.forEach(([s, c]) => g.addGroup(s, c, 0));
  return g;
}
function uvSphere(r = 0.5, seg = 16, rings = 8) {
  const P = [], F = [];
  const v = (x, y, z) => (P.push(x, y, z), P.length / 3 - 1);
  const top = v(0, r, 0), rowsV = [];
  for (let i = 1; i < rings; i++) {
    const th = Math.PI * i / rings, row = [];
    for (let j = 0; j < seg; j++) { const ph = 2 * Math.PI * j / seg; row.push(v(r * Math.sin(th) * Math.cos(ph), r * Math.cos(th), -r * Math.sin(th) * Math.sin(ph))); }
    rowsV.push(row);
  }
  const bot = v(0, -r, 0);
  for (let j = 0; j < seg; j++) F.push([top, rowsV[0][j], rowsV[0][(j + 1) % seg]]);
  for (let i = 0; i + 1 < rowsV.length; i++) for (let j = 0; j < seg; j++) {
    const a = rowsV[i][j], b = rowsV[i + 1][j], c = rowsV[i + 1][(j + 1) % seg], d = rowsV[i][(j + 1) % seg];
    F.push([a, b, c, d]);
  }
  const L = rowsV[rowsV.length - 1];
  for (let j = 0; j < seg; j++) F.push([bot, L[(j + 1) % seg], L[j]]);
  return meshOf(P, F);
}
function cylinder(r = 0.25, h = 2, seg = 16, hs = 1) {
  const P = [], F = [], rows = [];
  for (let i = 0; i <= hs; i++) {
    const y = -h / 2 + h * i / hs, row = [];
    for (let j = 0; j < seg; j++) { const ph = 2 * Math.PI * j / seg; P.push(r * Math.cos(ph), y, -r * Math.sin(ph)); row.push(P.length / 3 - 1); }
    rows.push(row);
  }
  for (let i = 0; i < hs; i++) for (let j = 0; j < seg; j++) {
    const a = rows[i][j], b = rows[i][(j + 1) % seg], c = rows[i + 1][(j + 1) % seg], d = rows[i + 1][j];
    F.push([a, b, c, d]);
  }
  F.push(rows[hs].slice());                       // top, CCW from +y
  F.push(rows[0].slice().reverse());               // bottom
  return meshOf(P, F);
}
function box(w = 1, h = 1, d = 1, div = 1) {
  const g = new THREE.BoxGeometry(w, h, d, div, div, div);   // one group per side: split into quads
  const P = [], F = [], pa = g.attributes.position, ix = g.index, key = new Map();
  const id = i => { const k = [pa.getX(i), pa.getY(i), pa.getZ(i)].map(x => Math.round(x * 1e5)).join('_');
    if (!key.has(k)) { P.push(pa.getX(i), pa.getY(i), pa.getZ(i)); key.set(k, P.length / 3 - 1); } return key.get(k); };
  for (let t = 0; t < ix.count; t += 6) F.push([id(ix.getX(t)), id(ix.getX(t + 1)), id(ix.getX(t + 4)), id(ix.getX(t + 2))]);
  return meshOf(P, F);
}
function xf(g, m) { return g.clone().applyMatrix4(m); }
const rot = (rx, ry, rz) => new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz));
const tr = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);

const MAT = new THREE.MeshStandardMaterial();
function brushOf(geom) {
  const g = geom.clone();
  const faces = [], ix = g.index;
  g.groups.forEach(gr => { const f = []; for (let i = gr.start; i + 2 < gr.start + gr.count; i += 3) f.push([ix.getX(i), ix.getX(i + 1), ix.getX(i + 2)]); faces.push(f); });
  g.computeVertexNormals();
  g.clearGroups(); g.addGroup(0, ix.count, 0);
  const b = new CSG.Brush(g, [MAT]);
  b.updateMatrixWorld(true);
  // what booleanTopoInput hands over
  const pa = g.attributes.position, P = [];
  for (let i = 0; i < pa.count; i++) P.push(pa.getX(i), pa.getY(i), pa.getZ(i));
  const key = i => Math.round(P[i * 3] * 1e4) + '_' + Math.round(P[i * 3 + 1] * 1e4) + '_' + Math.round(P[i * 3 + 2] * 1e4);
  const keys = new Set(), faceOfKey = new Map(), tri = [];
  for (let i = 0; i < pa.count; i++) keys.add(key(i));
  faces.forEach((f, fi) => f.forEach(t => t.forEach(v => { const k = key(v); let l = faceOfKey.get(k); if (!l) faceOfKey.set(k, l = []); if (l[l.length - 1] !== fi) l.push(fi); })));
  faces.forEach(f => f.forEach(t => tri.push(t[0], t[1], t[2])));
  b.userData.topoIn = { keys, faceOfKey, angle: Math.PI, segs: lib.topoDivisions(P, faces, 0.9998), P, tri };
  return b;
}

// ---- Measurements
function triN(P, t) {
  const a = t[0] * 3, b = t[1] * 3, c = t[2] * 3;
  const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
  const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
  return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
}
function surfaceOf(P, tris) {
  return tris.map(t => { const n = triN(P, t), l = Math.hypot(...n) || 1;
    return { a: [P[t[0] * 3], P[t[0] * 3 + 1], P[t[0] * 3 + 2]], b: [P[t[1] * 3], P[t[1] * 3 + 1], P[t[1] * 3 + 2]],
             c: [P[t[2] * 3], P[t[2] * 3 + 1], P[t[2] * 3 + 2]], n: [n[0] / l, n[1] / l, n[2] / l] }; });
}
// Nearest surface point; at a crease (two surfaces equidistant) every equidistant normal is returned.
function nearest(S, q, slack) {
  let bd = Infinity; const o = [0, 0, 0], ds = [];
  for (const t of S) { lib.topoClosestOnTri(q, t.a, t.b, t.c, o); const d = Math.hypot(o[0] - q[0], o[1] - q[1], o[2] - q[2]); ds.push(d); if (d < bd) bd = d; }
  const ns = [];
  S.forEach((t, i) => { if (ds[i] <= bd * 1.05 + 1e-7 + (slack || 0)) ns.push(t.n); });
  return { d: bd, n: ns[0], ns };
}
function openDup(G, nV) {
  const dir = new Map();
  G.forEach(g => g.triangles.forEach(t => { for (let k = 0; k < 3; k++) { const key = t[k] * nV + t[(k + 1) % 3]; dir.set(key, (dir.get(key) || 0) + 1); } }));
  let open = 0, dup = 0;
  dir.forEach((c, key) => { const x = Math.floor(key / nV), y = key - x * nV; if (c > 1) dup++; if (!dir.has(y * nV + x)) open++; });
  return { open, dup };
}
function oneLoop(g) {
  const cnt = new Map();
  g.triangles.forEach(t => { for (let k = 0; k < 3; k++) { const key = t[k] + ',' + t[(k + 1) % 3]; cnt.set(key, (cnt.get(key) || 0) + 1); } });
  const nxt = new Map(); let nb = 0, pinch = false;
  cnt.forEach((c, key) => { const [x, y] = key.split(',').map(Number); if (!cnt.has(y + ',' + x)) { nb++; if (nxt.has(x)) pinch = true; nxt.set(x, y); } });
  if (pinch || !nb) return false;
  const s = nxt.keys().next().value; let v = s, steps = 0;
  do { v = nxt.get(v); steps++; } while (v !== undefined && v !== s && steps <= nb);
  return steps === nb;
}
const faceSig = g => g.triangles.map(t => t.join(',')).join(';');

// ---- v2.81a measurements: volume and grid evenness, per topology type (seed 0)
function volume(G, P) { let v = 0; G.forEach(g => g.triangles.forEach(t => { const a = t[0] * 3, b = t[1] * 3, c = t[2] * 3;
  v += (P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c])) / 6; })); return v; }
function outline(g) { const d = new Set(), nx = new Map(); g.triangles.forEach(t => { for (let k = 0; k < 3; k++) d.add(t[k] + ',' + t[(k + 1) % 3]); });
  g.triangles.forEach(t => { for (let k = 0; k < 3; k++) { const a = t[k], b = t[(k + 1) % 3]; if (!d.has(b + ',' + a)) nx.set(a, b); } });
  const s = nx.keys().next().value, L = [s]; let v = nx.get(s); while (v !== s && L.length < 64) { L.push(v); v = nx.get(v); } return L; }
const pct = (a, q) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
function measure(name, a, b, op) {
  if (process.env.ONLY && !new RegExp(process.env.ONLY).test(name)) return;
  const ev = new CSG.Evaluator(); ev.attributes = ['position', 'normal']; ev.useCDTClipping = true; ev.useGroups = true; ev.consolidateGroups = true; ev.removeUnusedMaterials = true;
  const topoIn = [a.userData.topoIn, b.userData.topoIn];
  const res = ev.evaluate(a, b, op);
  lib.editableFromCSGResult(res); const Hh = lib.captured; const S = surfaceOf(Hh.positions, Hh.tris);
  const base = lib.editableFromCSGResult(res, topoIn, { type: 'ngon', seed: 0 });
  const baseSig = new Set(base.groups.map(faceSig));
  const V0 = volume(base.groups, base.positions);
  const rows = [];
  for (const type of ['quads', 'quads+thin', 'loops']) {
    lib.setThin(type === 'quads+thin', process.env.TOL ? +process.env.TOL : null, process.env.NN ? +process.env.NN : 0, !!process.env.SLIDE);
    const ed = lib.editableFromCSGResult(res, topoIn, { type: type.split('+')[0], seed: +(process.env.SEED || 0) });
    const P = ed.positions, G = ed.groups;
    const nf = G.filter(g => !baseSig.has(faceSig(g)));
    const ratio = [], ang = [], lens = [];
    nf.forEach(g => { const L = outline(g); const p = i => [P[L[i] * 3], P[L[i] * 3 + 1], P[L[i] * 3 + 2]];
      const e = L.map((_, i) => { const x = p(i), y = p((i + 1) % L.length); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); });
      e.forEach(x => lens.push(x));
      if (L.length !== 4) return;
      ratio.push(Math.max(...e) / Math.min(...e));
      for (let i = 0; i < 4; i++) { const o = p(i), u = p((i + 1) % 4), w = p((i + 3) % 4);
        const d1 = [u[0] - o[0], u[1] - o[1], u[2] - o[2]], d2 = [w[0] - o[0], w[1] - o[1], w[2] - o[2]];
        const c = (d1[0] * d2[0] + d1[1] * d2[1] + d1[2] * d2[2]) / (Math.hypot(...d1) * Math.hypot(...d2));
        ang.push(Math.abs(Math.acos(Math.max(-1, Math.min(1, c))) * 180 / Math.PI - 90)); } });
    // shape: sample every new triangle (corners' midpoints and middle), distance to the CSG surface over the model size
    const Hs = (() => { let lo = [1e9,1e9,1e9], hi = [-1e9,-1e9,-1e9]; for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], P[i+k]); hi[k] = Math.max(hi[k], P[i+k]); } return Math.hypot(hi[0]-lo[0], hi[1]-lo[1], hi[2]-lo[2]); })();
    const dev = [];
    nf.forEach(g => g.triangles.forEach(t => { const q = k => [P[t[k]*3], P[t[k]*3+1], P[t[k]*3+2]];
      const a = q(0), b = q(1), c = q(2);
      [[1/3,1/3,1/3],[.5,.5,0],[0,.5,.5],[.5,0,.5]].forEach(w => { const x = [0,1,2].map(k => w[0]*a[k] + w[1]*b[k] + w[2]*c[k]); dev.push(nearest(S, x).d / Hs); }); }));
    const mean = lens.reduce((s, x) => s + x, 0) / (lens.length || 1), cv = Math.sqrt(lens.reduce((s, x) => s + (x - mean) ** 2, 0) / (lens.length || 1)) / (mean || 1);
    rows.push(type + ': vol ' + ((volume(G, P) / V0 - 1) * 100).toFixed(3) + '%, new ' + nf.length + ' faces, quad side ratio med ' + pct(ratio, 0.5).toFixed(2) + ' p90 ' + pct(ratio, 0.9).toFixed(2) +
      ', angle off 90 med ' + pct(ang, 0.5).toFixed(0) + ' p90 ' + pct(ang, 0.9).toFixed(0) + ', shape dev max ' + (pct(dev, 1) * 1e3).toFixed(2) + ' p90 ' + (pct(dev, 0.9) * 1e3).toFixed(2) + ' (per mille of size), edge CV ' + cv.toFixed(2) + ', rebuilt ' + ed.topo.rebuilt + ' ' + JSON.stringify(ed.topo.failed).slice(0, 160));
  }
  console.log('== ' + name + '  (vol vs N-gon)'); rows.forEach(r => console.log('   ' + r));
}
const sph = (r, s, rg) => brushOf(uvSphere(r, s, rg));
measure('sphere - cylinder', sph(0.5, 16, 8), brushOf(cylinder(0.18, 2, 12)), CSG.SUBTRACTION);
measure('sphere U small sphere', sph(0.5, 16, 8), brushOf(xf(uvSphere(0.25, 12, 6), tr(0.5, 0.1, 0))), CSG.ADDITION);
measure('divided cube - rod', brushOf(box(1, 1, 1, 3)), brushOf(cylinder(0.25, 2, 16)), CSG.SUBTRACTION);
{
  const doc = JSON.parse(fs.readFileSync(new URL('_dev/female.json', here), 'utf8'));
  const o = doc.objects[0], g = o.geometry, P = [];
  for (let i = 0; i < g.position.length; i += 3) P.push(g.position[i] + o.position[0], g.position[i + 1] + o.position[1], g.position[i + 2] + o.position[2]);
  const G = new THREE.BufferGeometry(); G.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); G.setIndex(g.index);
  g.groups.forEach(gr => G.addGroup(gr.start, gr.count, 0));
  let y0 = Infinity, y1 = -Infinity; for (let i = 1; i < P.length; i += 3) { y0 = Math.min(y0, P[i]); y1 = Math.max(y1, P[i]); }
  const H = y1 - y0; let chest = null;
  for (let i = 0; i < P.length; i += 3) if (Math.abs(P[i]) < 0.06 * H && Math.abs(P[i + 1] - (y0 + 0.7 * H)) < 0.04 * H && (!chest || P[i + 2] > chest[2])) chest = [P[i], P[i + 1], P[i + 2]];
  const ball = at => brushOf(xf(uvSphere(0.5 * H * 0.07, 16, 8), tr(at[0], at[1], at[2])));
  measure('model - ball (chest)', brushOf(G), ball(chest), CSG.SUBTRACTION);
  measure('model U ball (chest)', brushOf(G), ball(chest), CSG.ADDITION);
}
