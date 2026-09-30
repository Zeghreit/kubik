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
  '; return { editableFromCSGResult, topoDivisions, importTriNormal, topoClosestOnTri, TOPO_Q_SPACE, TOPO_X_SPACE, topoQuadCounts, setThin(v, t) { TOPO_Q_THIN = v; if (t != null) TOPO_Q_THIN_TOL = t; }, get captured() { return captured; } };')(THREE);

let fails = 0, n = 0;
// v2.81 Loops: what each case must do beyond the invariant
const LEXP = {
  'sphere - cylinder': ['both sphere rims divided on every seed', (s, k) => k.length === SPACE && s.rebuilt0 >= 2],
  'sphere U small sphere': ['host cells divided on every seed', (s, k) => k.length === SPACE && s.rebuilt0 >= 1],
  'model - ball (chest)': ['host cells divided on the default seed', (s, k) => k[0] === 0 && s.rebuilt0 >= 10],
  'model U ball (chest)': ['host cells divided on the default seed', (s, k) => k[0] === 0 && s.rebuilt0 >= 10],
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

const summary = [];
function run(name, a, b, op, expect) {
  expect = null;
  if (process.env.ONLY && !new RegExp(process.env.ONLY).test(name)) return;
  const ev = new CSG.Evaluator();
  ev.attributes = ['position', 'normal'];
  ev.useCDTClipping = true; ev.useGroups = true; ev.consolidateGroups = true; ev.removeUnusedMaterials = true;
  const topoIn = [a.userData.topoIn, b.userData.topoIn];
  const res = ev.evaluate(a, b, op);
  lib.editableFromCSGResult(res);                                      // the healed input, captured
  const H = lib.captured;
  const S = surfaceOf(H.positions, H.tris);
  const o0 = openDup([{ triangles: H.tris }], H.positions.length / 3);
  const base = lib.editableFromCSGResult(res, topoIn, { type: 'ngon', seed: 0 });
  if (!base || !base.topo) { check(name + ': N-gon ran', false); return; }
  const P0 = base.positions, nV0 = P0.length / 3;
  // the seam, as the app reads it
  const seam = new Set();
  for (let i = 0; i < nV0; i++) {
    const k = Math.round(P0[i * 3] * 1e4) + '_' + Math.round(P0[i * 3 + 1] * 1e4) + '_' + Math.round(P0[i * 3 + 2] * 1e4);
    let c = 0; topoIn.forEach(t => { if (t.keys.has(k)) c++; });
    if (c !== 1) seam.add(i);
  }
  const baseSig = base.groups.map(faceSig);
  const facesOfV = new Map();
  base.groups.forEach((g, gi) => g.triangles.forEach(t => t.forEach(v => { if (!facesOfV.has(v)) facesOfV.set(v, new Set()); facesOfV.get(v).add(gi); })));
  const band = w => {
    const inB = new Set();
    base.groups.forEach((g, gi) => { if (g.triangles.some(t => t.some(v => seam.has(v)))) inB.add(gi); });
    let front = Array.from(inB);
    for (let r = 1; r < w; r++) { const nx = []; front.forEach(gi => base.groups[gi].triangles.forEach(t => t.forEach(v => facesOfV.get(v).forEach(f => { if (!inB.has(f)) { inB.add(f); nx.push(f); } })))); front = nx; }
    return inB;
  };
  const bands = { 1: band(1), 2: band(2) };
  const seen = new Map();
  let worstD = 0, bad = [], seed0 = null; const okSeeds = [];
  for (let seed = 0; seed < SPACE; seed++) {
    const ed = lib.editableFromCSGResult(res, topoIn, { type: TYPE, seed });
    if (!ed || ed.miss || !ed.topo) { bad.push('seed ' + seed + ': no result'); continue; }
    const G = ed.groups, P = ed.positions, nV = P.length / 3;
    const why = [];
    for (let i = 0; i < P0.length; i++) if (P[i] !== P0[i]) { why.push('an old vertex moved'); break; }

    // outside the band it reports, the same faces; and that band stays within
    // width + 2 rings of the cut (the graze growth adds at most two)
    const width = 2;                       // the widest any variant grows a side
    const outSigs = new Set(G.map(faceSig));
    const rep = new Set(ed.topo.band || []);
    base.groups.forEach((g, gi) => { if (!rep.has(gi) && !outSigs.has(baseSig[gi])) why.push('face ' + gi + ' outside the band changed'); });
    { const ring = new Map(); bands[1].forEach(gi => ring.set(gi, 1)); let fr = Array.from(bands[1]);
      for (let r = 2; r <= width + 2; r++) { const nx = []; fr.forEach(gi => base.groups[gi].triangles.forEach(t => t.forEach(v => facesOfV.get(v).forEach(f => { if (!ring.has(f)) { ring.set(f, r); nx.push(f); } })))); fr = nx; }
      // islands the band took in may sit a ring further; only faces that changed count
      for (let r = width + 3; r <= width + 3; r++) { const nx = []; fr.forEach(gi => base.groups[gi].triangles.forEach(t => t.forEach(v => facesOfV.get(v).forEach(f => { if (!ring.has(f)) { ring.set(f, r); nx.push(f); } })))); fr = nx; }
      rep.forEach(gi => { if (!ring.has(gi) && !outSigs.has(baseSig[gi])) why.push('changed band face ' + gi + ' more than ' + (width + 3) + ' rings from the cut'); }); }
    const od = openDup(G, nV);
    if (od.open > o0.open || od.dup > o0.dup) why.push('open ' + od.open + ' dup ' + od.dup + ' (CSG ' + o0.open + '/' + o0.dup + ')');
    G.forEach((g, gi) => { if (!oneLoop(g)) why.push('face ' + gi + ' not one loop'); });
    // new points on the surface; new faces not folded, and near the CSG surface
    const newFaces = G.filter(g => !baseSig.includes(faceSig(g)));
    let dmax = 0, flips = 0;
    const edgeLen = [];
    newFaces.forEach(g => g.triangles.forEach(t => {
      const n = triN(P, t), l = Math.hypot(...n);
      const q = [0, 1, 2].map(k => (P[t[0] * 3 + k] + P[t[1] * 3 + k] + P[t[2] * 3 + k]) / 3);
      const L = Math.max(...[0, 1, 2].map(k => Math.hypot(P[t[k] * 3] - P[t[(k + 1) % 3] * 3], P[t[k] * 3 + 1] - P[t[(k + 1) % 3] * 3 + 1], P[t[k] * 3 + 2] - P[t[(k + 1) % 3] * 3 + 2])));
      const nr = nearest(S, q, 0.15 * L);
      dmax = Math.max(dmax, nr.d / L);
      if (Math.max(...nr.ns.map(m => (n[0] * m[0] + n[1] * m[1] + n[2] * m[2]) / l)) < 0) { flips++; if (VERBOSE) { const S2 = S.map(t => ({ t, d: (() => { const o = [0,0,0]; lib.topoClosestOnTri(q, t.a, t.b, t.c, o); return Math.hypot(o[0]-q[0], o[1]-q[1], o[2]-q[2]); })() })).sort((x, y) => x.d - y.d).slice(0, 4);
        console.log('      fold: area', (l / 2).toExponential(2), 'L', L.toFixed(3), 'dots', S2.map(x => ((n[0]*x.t.n[0]+n[1]*x.t.n[1]+n[2]*x.t.n[2])/l).toFixed(2) + '@' + x.d.toExponential(1)).join(' '), 'verts', t.map(v => v >= nV0 ? 'new' : seam.has(v) ? 'seam' : 'old').join(',')); } }
      edgeLen.push(L);
    }));
    for (let i = nV0; i < nV; i++) { const d = nearest(S, [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]).d; if (d > 7e-4) { why.push('new point ' + i + ' off the surface by ' + d.toExponential(2)); break; } }
    worstD = Math.max(worstD, dmax);
    if (dmax > 0.25) why.push('face sags ' + dmax.toFixed(3) + ' of its edge off the CSG surface');
    if (flips) why.push(flips + ' triangles folded');
    const again = lib.editableFromCSGResult(res, topoIn, { type: TYPE, seed });
    if (again.topo.hash !== ed.topo.hash) why.push('not deterministic');
    if (why.length) bad.push('seed ' + seed + ': ' + Array.from(new Set(why)).slice(0, 3).join('; '));
    if (!seen.has(ed.topo.hash)) seen.set(ed.topo.hash, seed);
    if (ed.topo.rebuilt) okSeeds.push(seed);
    // Seed 0 (the default: the smaller input kept as cut) is measured for how much
    // it touches; seed 1 (both sides rebuilt) for what a full rebuild makes.
    if (seed === 0 || seed === 1) {
      // how much of each input the default touches (the smaller one: nothing but the cut): its faces that did not come back as they were
      const changedBy = [0, 0];
      base.groups.forEach((g, gi) => { if (outSigs.has(baseSig[gi])) return;
        const v = [0, 0]; g.triangles.forEach(t => t.forEach(x => { const k = Math.round(P0[x * 3] * 1e4) + '_' + Math.round(P0[x * 3 + 1] * 1e4) + '_' + Math.round(P0[x * 3 + 2] * 1e4);
          topoIn.forEach((ti, ii) => { if (ti.keys.has(k)) v[ii]++; }); }));
        if (v[0] || v[1]) changedBy[v[1] > v[0] ? 1 : 0]++; });
      if (seed === 0) { globalThis.__changedBy = changedBy; globalThis.__rebuilt0 = ed.topo.rebuilt; }
      // valence of new interior points
      const nb = new Map();
      G.forEach(g => { const c = new Map(); g.triangles.forEach(t => { for (let k = 0; k < 3; k++) { const x = t[k], y = t[(k + 1) % 3], key = x < y ? x + ',' + y : y + ',' + x; c.set(key, (c.get(key) || 0) + 1); } });
        c.forEach((cc, key) => { if (cc !== 1) return; const [x, y] = key.split(',').map(Number); [[x, y], [y, x]].forEach(([p, q]) => { if (!nb.has(p)) nb.set(p, new Set()); nb.get(p).add(q); }); }); });
      const hist = {};
      for (let i = nV0; i < nV; i++) { const v = nb.has(i) ? nb.get(i).size : 0; hist[v] = (hist[v] || 0) + 1; }
      if (seed === 0) seed0 = { changedBy: globalThis.__changedBy, rebuilt0: globalThis.__rebuilt0, st: ed.topo.stats, rebuilt: ed.topo.rebuilt, failed: ed.topo.failed, ways: ed.topo.ways, added: nV - nV0, hist, newFaces: newFaces.length,
                quadsNew: newFaces.filter(g => g.triangles.length === 2).length };
    }
  }
  const s0 = seed0 || {};
  check(name + ': every Loops layout closed, frozen outside the band, on the surface, unfolded', bad.length === 0, bad.slice(0, 3).join(' | '));
  const qr = s0.newFaces ? s0.quadsNew / s0.newFaces : 0;
  const line = name + ': default touches A/B ' + JSON.stringify(s0.changedBy) + ' (rebuilt ' + s0.rebuilt0 + '); full rebuild ' + s0.rebuilt + ' cells [' + (s0.ways || []).join('; ') + ']' + (s0.failed && s0.failed.length ? ' (kept N-gon: ' + s0.failed.join(', ') + ')' : '') +
    ', +' + s0.added + ' points, new faces ' + s0.newFaces + ' (' + Math.round(qr * 100) + '% quads), readout ' + JSON.stringify(s0.st) +
    ', valence ' + JSON.stringify(s0.hist) + ', worst sag ' + worstD.toFixed(3) + ', distinct layouts ' + seen.size + '/' + SPACE + ', seeds that rebuild [' + okSeeds.join(',') + ']';
  console.log('   ' + line);
  summary.push(line);
  if (expect) expect(s0, seen);
  const L = LEXP[name];
  if (L) check(name + ': ' + L[0], L[1](s0, okSeeds), JSON.stringify({ lines: s0.lines, rebuilt0: s0.rebuilt0, seeds: okSeeds }));
}

console.log('== counts');
{
  let ok = true;
  for (let E = 1; E <= 30; E++) for (let S = 1; S <= 5; S++) {
    const e = lib.topoQuadCounts(E, S);
    if (!e) continue;
    if (e[0] !== E || e[S] !== 1) ok = false;
    for (let j = 0; j < S; j++) if (e[j] < e[j + 1] || e[j] > 3 * e[j + 1]) ok = false;
    // only the last possible step sheds an odd count
    const odd = e.slice(0, S).filter((x, j) => (x - e[j + 1]) & 1).length;
    if (odd > 1) ok = false;
  }
  check('topoQuadCounts: rows reach both ends, at most one odd step', ok);
}

const sph = (r, s, rg) => brushOf(uvSphere(r, s, rg));
console.log('== sphere - cylinder');
run('sphere - cylinder', sph(0.5, 16, 8), brushOf(cylinder(0.18, 2, 12)), CSG.SUBTRACTION, s => {
  check('sphere - cylinder: all 3 pieces rebuilt (2 sphere sides + the hole wall)', s.rebuilt === 3, s.rebuilt + '');
});
console.log('== sphere - tilted cylinder');
run('sphere - tilted cylinder', sph(0.5, 24, 12), brushOf(xf(cylinder(0.15, 2, 16), rot(0.5, 0.2, 0.3))), CSG.SUBTRACTION, s => {
  check('sphere - tilted cylinder: all 3 pieces rebuilt', s.rebuilt === 3, s.rebuilt + '');
});
console.log('== T-pipe');
run('T-pipe', brushOf(xf(cylinder(0.3, 2, 16, 4), rot(0, 0, Math.PI / 2))), brushOf(xf(cylinder(0.18, 1, 12, 2), tr(0, 0.5, 0))), CSG.ADDITION, s => {
  check('T-pipe: both pipes rebuilt at the junction', s.rebuilt >= 2, s.rebuilt + '');
});
console.log('== cube - rod');
run('cube - rod', brushOf(box()), brushOf(cylinder(0.25, 2, 16)), CSG.SUBTRACTION, s => {
  check('cube - rod: every piece rebuilt (top, bottom, wall)', s.rebuilt === 3, s.rebuilt + '');
  check('cube - rod: new faces all quads', s.newFaces > 0 && s.quadsNew === s.newFaces, s.quadsNew + '/' + s.newFaces);
});
console.log('== divided cube - rod');
run('divided cube - rod', brushOf(box(1, 1, 1, 3)), brushOf(cylinder(0.25, 2, 16)), CSG.SUBTRACTION, s => {
  check('divided cube - rod: all 3 pieces rebuilt across the evaluator\'s cracks, all quads', s.rebuilt === 3 && s.quadsNew === s.newFaces, s.rebuilt + ' / ' + s.quadsNew + '/' + s.newFaces);
});
console.log('== sphere U small sphere');
run('sphere U small sphere', sph(0.5, 16, 8), brushOf(xf(uvSphere(0.25, 12, 6), tr(0.5, 0.1, 0))), CSG.ADDITION, s => {
  check('sphere U small sphere: both sides of the junction rebuilt', s.rebuilt === 2, s.rebuilt + '');
});
console.log('== sphere - small sphere (dent)');
run('sphere - small sphere', sph(0.5, 24, 12), brushOf(xf(uvSphere(0.2, 12, 6), tr(0.45, 0.15, 0.1))), CSG.SUBTRACTION, s => {
  check('sphere - small sphere: rim and dent rebuilt', s.rebuilt === 2, s.rebuilt + '');
});
console.log('== sphere & cube (intersect)');
run('sphere & cube', sph(0.5, 16, 8), brushOf(xf(box(0.8, 0.8, 0.8), tr(0.1, 0.05, 0))), CSG.INTERSECTION);
console.log('== box U box in line (no band)');
run('box U box', brushOf(box()), brushOf(xf(box(), tr(0.5, 0, 0))), CSG.ADDITION);
console.log('== ROT far sphere - cylinder');
run('ROT far sphere - cylinder', brushOf(xf(uvSphere(0.5, 16, 8), tr(40, -17, 23))), brushOf(xf(xf(cylinder(0.18, 2, 12), rot(0.37, 0.61, 0.23)), tr(40, -17, 23))), CSG.SUBTRACTION);
// Zeghreit's model (_dev/female.json, NOT in the repo) with a ball on its side,
// placed as _bool280_probe.js places it. Skipped when the file is absent.
if (fs.existsSync(new URL('_dev/female.json', here))) {
  const doc = JSON.parse(fs.readFileSync(new URL('_dev/female.json', here), 'utf8'));
  const o = doc.objects[0], g = o.geometry, P = [];
  for (let i = 0; i < g.position.length; i += 3) P.push(g.position[i] + o.position[0], g.position[i + 1] + o.position[1], g.position[i + 2] + o.position[2]);
  const G = new THREE.BufferGeometry();
  G.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  G.setIndex(g.index);
  g.groups.forEach(gr => G.addGroup(gr.start, gr.count, 0));
  let y0 = Infinity, y1 = -Infinity;
  for (let i = 1; i < P.length; i += 3) { y0 = Math.min(y0, P[i]); y1 = Math.max(y1, P[i]); }
  const H = y1 - y0, midY = y0 + 0.62 * H;
  let best = null;
  for (let i = 0; i < P.length; i += 3) if (Math.abs(P[i + 1] - midY) <= H * 0.05 && (!best || P[i] > best[0])) best = [P[i], P[i + 1], P[i + 2]];
  // On the chest: the front-most point near the middle line at 70% height.
  let chest = null;
  for (let i = 0; i < P.length; i += 3) if (Math.abs(P[i]) < 0.06 * H && Math.abs(P[i + 1] - (y0 + 0.7 * H)) < 0.04 * H && (!chest || P[i + 2] > chest[2])) chest = [P[i], P[i + 1], P[i + 2]];
  const ball = at => brushOf(xf(uvSphere(0.5 * H * 0.07, 16, 8), tr(at[0], at[1], at[2])));
  console.log('== model - ball on the chest');
  run('model - ball (chest)', brushOf(G), ball(chest), CSG.SUBTRACTION, s => check('model - ball (chest): rim and dent rebuilt', s.rebuilt === 2, s.rebuilt + ''));
  console.log('== model U ball on the chest');
  run('model U ball (chest)', brushOf(G), ball(chest), CSG.ADDITION, s => check('model U ball (chest): rim and bump rebuilt', s.rebuilt === 2, s.rebuilt + ''));
  console.log('== model - ball as thick as the arm');
  run('model - ball (arm)', brushOf(G), ball(best), CSG.SUBTRACTION);
  console.log('== model U ball as thick as the arm');
  run('model U ball (arm)', brushOf(G), ball(best), CSG.ADDITION);
}
{
  let rng = 4242;
  const rand = () => (rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const f0 = fails, quiet = console.log;
  for (let it = 0; it < 12; it++) {
    const cyl = xf(xf(cylinder(0.08 + rand() * 0.15, 2, [8, 12, 16][it % 3]), rot(rand() * 3, rand() * 3, rand() * 3)), tr(-0.2 + rand() * 0.4, -0.2 + rand() * 0.4, -0.2 + rand() * 0.4));
    const lines = [];
    console.log = (...a) => { if (/^FAIL/.test(String(a[0]))) lines.push(a.join(' ')); else if (VERBOSE) lines.push(a.join(' ')); };
    try { run('fuzz ' + it, sph(0.5, [12, 16, 24][it % 3], [6, 8, 12][it % 3]), brushOf(cyl), [CSG.SUBTRACTION, CSG.ADDITION, CSG.INTERSECTION][it % 3]); } finally { console.log = quiet; }
    lines.forEach(l => console.log(l));
  }
  console.log('== fuzz: 12 sphere x rod, ' + (fails - f0) + ' failures');
}

// ---- Regressions found by fable (v2.80 review). All three only have to stay
// closed, frozen outside the band and unfolded - the run() check.
function prism(poly, h, hs = 1) {
  const P = [], F = [], rows = [], n = poly.length;
  for (let i = 0; i <= hs; i++) { const y = -h / 2 + h * i / hs, row = []; for (const [x, z] of poly) { P.push(x, y, z); row.push(P.length / 3 - 1); } rows.push(row); }
  for (let i = 0; i < hs; i++) for (let j = 0; j < n; j++) F.push([rows[i][j], rows[i][(j + 1) % n], rows[i + 1][(j + 1) % n], rows[i + 1][j]]);
  F.push(rows[hs].slice()); F.push(rows[0].slice().reverse());
  const g = meshOf(P, F);
  const ix = g.index, pa = g.attributes.position; let vol = 0;
  for (let t = 0; t < ix.count; t += 3) { const a = new THREE.Vector3().fromBufferAttribute(pa, ix.getX(t)), b = new THREE.Vector3().fromBufferAttribute(pa, ix.getX(t + 1)), c = new THREE.Vector3().fromBufferAttribute(pa, ix.getX(t + 2)); vol += a.dot(b.clone().cross(c)); }
  if (vol < 0) return meshOf(P, F.map(f => f.slice().reverse()));
  return g;
}
{
  const scl = (x, y, z) => new THREE.Matrix4().makeScale(x, y, z);
  console.log('== fable: mirrored cutter (the evaluator\'s result is not closed along the cut)');
  run('mirrored cutter', sph(0.5, 16, 8), brushOf(xf(cylinder(0.18, 2, 12), scl(-1, 1, 1).multiply(rot(0.3, 0.1, 0.2)))), CSG.SUBTRACTION);
  console.log('== fable: sphere U star prism (a broken result; a merge must not double an edge)');
  const star = []; for (let k = 0; k < 10; k++) { const r = k % 2 ? 0.12 : 0.3, th = 2 * Math.PI * k / 10; star.push([r * Math.cos(th), r * Math.sin(th)]); }
  run('sphere U star prism', sph(0.5, 24, 12), brushOf(prism(star, 0.8)), CSG.ADDITION);
  console.log('== fable: fuzz 99/19 (a merge across a short cut edge flipped a kept face)');
  let rng = 99;
  const rand = () => (rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const prims = [
    () => uvSphere(0.3 + rand() * 0.4, [8, 12, 16, 24][Math.floor(rand() * 4)], [4, 6, 8, 12][Math.floor(rand() * 4)]),
    () => cylinder(0.1 + rand() * 0.3, 0.5 + rand() * 1.5, [6, 8, 12, 16, 32][Math.floor(rand() * 5)], 1 + Math.floor(rand() * 3)),
    () => box(0.4 + rand(), 0.4 + rand(), 0.4 + rand(), 1 + Math.floor(rand() * 3)),
  ];
  for (let it = 0; it <= 19; it++) {
    const pa = Math.floor(rand() * 3), pb = Math.floor(rand() * 3);
    const A_ = prims[pa](), B_ = xf(xf(prims[pb](), rot(rand() * 3, rand() * 3, rand() * 3)), tr(-0.3 + rand() * 0.6, -0.3 + rand() * 0.6, -0.3 + rand() * 0.6));
    if (it === 19) run('fuzz 99/19', brushOf(A_), brushOf(B_), [CSG.SUBTRACTION, CSG.ADDITION, CSG.INTERSECTION][it % 3]);
  }
}
console.log('\n' + (n - fails) + '/' + n + (fails ? '  FAILURES' : '  all green'));
process.exit(fails ? 1 : 0);
