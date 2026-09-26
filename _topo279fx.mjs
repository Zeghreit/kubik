// v2.79 topology TYPES and Generate - node fixture on the REAL engine.
// run: node _topo279fx.mjs   (libs: _dev/csg, same versions as the importmap)
import fs from 'fs';
const here = new URL('.', import.meta.url);
const LIB = new URL('_dev/csg/node_modules/', here);
const THREE = await import(new URL('three/build/three.module.js', LIB).href);
const CSG = await import(new URL('three-bvh-csg/build/index.module.js', LIB).href);

const html = fs.readFileSync(new URL('index.html', here), 'utf8');
function cut(a, b) { const i = html.indexOf(a), j = html.indexOf(b, i); if (i < 0 || j < 0) throw new Error('cut ' + a); return html.slice(i, j); }

// The app's own weld / heal / merge, cut from index.html. mergeCoplanarTriangles
// is wrapped so the fixture sees exactly what the app hands it.
const lib = new Function('THREE', 'const IMPORT_TRI_BUDGET = 40000; const IMPORT_COPLANAR_DOT = 0.9998; const SHARP_ANGLE = 33 * Math.PI / 180; const SHARP_EPS = 1e-6;' +
  cut('const CSG_WELD_TOL =', 'const BOOL_OPS') +
  cut('function importWeldKey(', '/* A budget, refused out loud').replace('function mergeCoplanarTriangles(', 'function legacyMerge(') +
  'let captured = null; function mergeCoplanarTriangles(p, t, m) { captured = { positions: p, tris: t, matOf: m }; return legacyMerge(p, t, m); }' +
  '; return { editableFromCSGResult, legacyMerge, topoNgon, topoDivisions, topoBlockedEdges, topoCollinear, importTriNormal, topoFlipChoices, topoHash, get captured() { return captured; } };')(THREE);

let fails = 0, n = 0;
function check(name, ok, note) { n++; if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (note ? '  ' + note : '')); }

const MAT = new THREE.MeshStandardMaterial();
function brushOf(geom, pos) {
  const g = geom.clone();
  if (pos) g.translate(pos[0], pos[1], pos[2]);
  if (!g.index) { const ix = []; for (let i = 0; i < g.attributes.position.count; i++) ix.push(i); g.setIndex(ix); }
  if (g.attributes.uv) g.deleteAttribute('uv');
  // The input's FACES, as the app would hand them over: one group = one face.
  const faces = [], ix = g.index;
  (g.groups.length ? g.groups : [{ start: 0, count: ix.count }]).forEach(gr => {
    const f = [];
    for (let i = gr.start; i + 2 < gr.start + gr.count; i += 3) f.push([ix.getX(i), ix.getX(i + 1), ix.getX(i + 2)]);
    faces.push(f);
  });
  g.computeVertexNormals();
  g.clearGroups(); g.addGroup(0, g.index.count, 0);
  const b = new CSG.Brush(g, [MAT]);
  b.updateMatrixWorld(true);
  b.userData.faces = faces;
  return b;
}
function posKeys(b) {
  const s = new Set(), p = b.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) s.add(Math.round(p.getX(i) * 1e4) + '_' + Math.round(p.getY(i) * 1e4) + '_' + Math.round(p.getZ(i) * 1e4));
  return s;
}
const box = (w = 1, h = 1, d = 1) => new THREE.BoxGeometry(w, h, d);
const rod = (r = 0.25, h = 2, seg = 16) => new THREE.CylinderGeometry(r, r, h, seg, 1, false);
// A cube whose top is ONE 6-gon: corners plus the two ends of a loop cut that
// runs down the front and back walls at x = 0 (the "continuation" case).
function loopCutCube() {
  const P = [], I = [];
  const v = (x, y, z) => (P.push(x, y, z), P.length / 3 - 1);
  const quad = (a, b, c, d) => I.push(a, b, c, a, c, d);
  const h = 0.5;
  // top: CCW seen from +y
  const t = [v(-h, h, h), v(0, h, h), v(h, h, h), v(h, h, -h), v(0, h, -h), v(-h, h, -h)];
  for (let i = 1; i < 5; i++) I.push(t[0], t[i], t[i + 1]);
  const b = [v(-h, -h, h), v(-h, -h, -h), v(0, -h, -h), v(h, -h, -h), v(h, -h, h), v(0, -h, h)];
  for (let i = 1; i < 5; i++) I.push(b[0], b[i], b[i + 1]);
  // front z=+h, split at x=0
  quad(v(-h, -h, h), v(0, -h, h), v(0, h, h), v(-h, h, h));
  quad(v(0, -h, h), v(h, -h, h), v(h, h, h), v(0, h, h));
  // back z=-h
  quad(v(h, -h, -h), v(0, -h, -h), v(0, h, -h), v(h, h, -h));
  quad(v(0, -h, -h), v(-h, -h, -h), v(-h, h, -h), v(0, h, -h));
  quad(v(h, -h, h), v(h, -h, -h), v(h, h, -h), v(h, h, h));      // +x
  quad(v(-h, -h, -h), v(-h, -h, h), v(-h, h, h), v(-h, h, -h));  // -x
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setIndex(I);
  // Faces: top 6-gon, bottom 6-gon, then six quads (the walls, front and back halved).
  g.addGroup(0, 12, 0); g.addGroup(12, 12, 0);
  for (let i = 0; i < 6; i++) g.addGroup(24 + i * 6, 6, 0);
  return g;
}


// Every layout of every type, as Generate would walk them: seed 0 .. space-1.
function run(name, a, b, op, expect) {
  const ev = new CSG.Evaluator();
  ev.attributes = ['position', 'normal'];
  ev.useCDTClipping = true; ev.useGroups = true; ev.consolidateGroups = true; ev.removeUnusedMaterials = true;
  const topoIn = [a, b].map(br => {
    const pa = br.geometry.attributes.position, Pi = [];
    for (let i = 0; i < pa.count; i++) Pi.push(pa.getX(i), pa.getY(i), pa.getZ(i));
    return { keys: posKeys(br), segs: br.userData.faces ? lib.topoDivisions(Pi, br.userData.faces, 0.9998) : [] };
  });
  const res = ev.evaluate(a, b, op);
  const base = lib.editableFromCSGResult(res, topoIn);                 // v2.78's call, no options
  lib.editableFromCSGResult(res);                                      // the healed input, captured
  const T0 = lib.captured.tris;
  let open0 = 0, dup0 = 0;
  { const nV0 = lib.captured.positions.length / 3, c0 = new Map();
    T0.forEach(t => { for (let k = 0; k < 3; k++) { const key = t[k] * nV0 + t[(k + 1) % 3]; c0.set(key, (c0.get(key) || 0) + 1); } });
    c0.forEach((c, key) => { const x = Math.floor(key / nV0), y = key - x * nV0; if (c > 1) dup0++; if (!c0.has(y * nV0 + x)) open0++; }); }
  if (!base.topo) { check(name + ': topology ran', false); return; }
  const P0 = base.positions;
  const nV = P0.length / 3;
  const area = G => { let s = 0; G.forEach(g => g.triangles.forEach(t => {
    const A = t[0] * 3, B = t[1] * 3, C = t[2] * 3;
    const ux = P0[B] - P0[A], uy = P0[B + 1] - P0[A + 1], uz = P0[B + 2] - P0[A + 2];
    const vx = P0[C] - P0[A], vy = P0[C + 1] - P0[A + 1], vz = P0[C + 2] - P0[A + 2];
    s += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2; })); return s; };
  const used = G => { const s = new Set(); G.forEach(g => g.triangles.forEach(t => t.forEach(v => s.add(v)))); return Array.from(s).sort((x, y) => x - y).join(','); };
  const A0 = area(base.groups), U0 = used(base.groups);
  const out = {};
  for (const type of ['ngon', 'tris']) {
    const seen = new Map();
    let space = 1, misses = 0, bad = [], minH = Infinity;
    for (let seed = 0; seed < space && seed < 400; seed++) {
      const ed = lib.editableFromCSGResult(res, topoIn, { type: type, seed: seed });
      if (ed.miss) { misses++; continue; }
      if (!ed.topo) { bad.push(seed + ' fell back'); continue; }
      if (seed === 0) space = ed.topo.space;
      const G = ed.groups;
      const why = [];
      if (ed.positions.length !== P0.length || !ed.positions.every((x, i) => x === P0[i])) why.push('positions moved');
      if (used(G) !== U0) why.push('vertex set changed');
      if (Math.abs(area(G) - A0) > 1e-9 * Math.max(1, A0)) why.push('area ' + area(G) + ' vs ' + A0);
      // closed, wound, no doubled edge
      const dir = new Map();
      G.forEach(g => g.triangles.forEach(t => { for (let k = 0; k < 3; k++) { const key = t[k] * nV + t[(k + 1) % 3]; dir.set(key, (dir.get(key) || 0) + 1); } }));
      let open = 0, dup = 0;
      dir.forEach((c, key) => { const x = Math.floor(key / nV), y = key - x * nV; if (c > 1) dup++; if (!dir.has(y * nV + x)) open++; });
      if (open > open0 || dup > dup0) why.push('open ' + open + ' dup ' + dup + ' (input ' + open0 + '/' + dup0 + ')');
      // every face flat, one simple outline; triangle heights
      G.forEach((g, gi) => {
        let n0 = null;
        g.triangles.forEach(t => {
          const n = lib.importTriNormal(P0, t);
          if (!n) { why.push('degenerate'); return; }
          if (!n0) n0 = n; else if (n[0] * n0[0] + n[1] * n0[1] + n[2] * n0[2] < 0.9998) why.push('face ' + gi + ' not flat');
          const p = i => [P0[i * 3], P0[i * 3 + 1], P0[i * 3 + 2]];
          const a_ = p(t[0]), b_ = p(t[1]), c_ = p(t[2]);
          const L = Math.max(Math.hypot(b_[0] - a_[0], b_[1] - a_[1], b_[2] - a_[2]), Math.hypot(c_[0] - b_[0], c_[1] - b_[1], c_[2] - b_[2]), Math.hypot(a_[0] - c_[0], a_[1] - c_[1], a_[2] - c_[2]));
          const ux = b_[0] - a_[0], uy = b_[1] - a_[1], uz = b_[2] - a_[2], vx = c_[0] - a_[0], vy = c_[1] - a_[1], vz = c_[2] - a_[2];
          const h = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / L;
          minH = Math.min(minH, h);
        });
        const cnt = new Map();
        g.triangles.forEach(t => { for (let k = 0; k < 3; k++) { const key = t[k] + ',' + t[(k + 1) % 3]; cnt.set(key, (cnt.get(key) || 0) + 1); } });
        const nxt = new Map(); let nb = 0;
        cnt.forEach((c, key) => { const [x, y] = key.split(',').map(Number); if (!cnt.has(y + ',' + x)) { nb++; if (nxt.has(x)) why.push('face ' + gi + ' pinch'); nxt.set(x, y); } });
        let v = nxt.keys().next().value, steps = 0;
        do { v = nxt.get(v); steps++; } while (v !== undefined && steps <= nb && v !== nxt.keys().next().value);
        if (steps !== nb) why.push('face ' + gi + ' not one loop');
      });
      if (type === 'tris' && (ed.topo.stats.quads || ed.topo.stats.ngons)) why.push('tris type left ' + ed.topo.stats.quads + ' quads ' + ed.topo.stats.ngons + ' n-gons');
      if (type === 'ngon' && seed === 0 && ed.topo.hash !== base.topo.hash) why.push('seed 0 is not the v2.78 layout');
      const again = lib.editableFromCSGResult(res, topoIn, { type: type, seed: seed });
      if (again.topo.hash !== ed.topo.hash) why.push('not deterministic');
      if (why.length) bad.push('seed ' + seed + ': ' + Array.from(new Set(why)).slice(0, 4).join('; '));
      if (!seen.has(ed.topo.hash)) seen.set(ed.topo.hash, seed);
    }
    out[type] = { distinct: seen.size, space: space, misses: misses, minH: minH };
    check(name + ' [' + type + ']: every layout closed, flat, same shape', bad.length === 0, bad.slice(0, 3).join(' | '));
    console.log('   ' + type + ': space ' + space + ', distinct ' + seen.size + ', misses ' + misses + ', thinnest h ' + minH.toExponential(2));
  }
  if (expect) expect(out);
}

const A = () => brushOf(box());
console.log('== cube - rod');
run('cube - rod', A(), brushOf(rod()), CSG.SUBTRACTION, o => {
  check('cube - rod: N-gon has more than one layout', o.ngon.distinct > 1, o.ngon.distinct + '');
  check('cube - rod: Tris has more than one layout', o.tris.distinct > 1, o.tris.distinct + '');
});
console.log('== loop-cut cube - rod');
run('loop-cut cube - rod', brushOf(loopCutCube()), brushOf(rod()), CSG.SUBTRACTION);
console.log('== cube U cube in line');
run('cube U cube in line', A(), brushOf(box(), [0.5, 0, 0]), CSG.ADDITION, o => {
  check('box U box: one N-gon layout (no holes)', o.ngon.distinct === 1 && o.ngon.space === 1, o.ngon.distinct + ' / ' + o.ngon.space);
});
console.log('== T-cut notch');
run('T-cut notch', A(), brushOf(box(0.4, 0.6, 2), [0, 0.5, 0]), CSG.SUBTRACTION);
console.log('== disjoint');
run('disjoint union', A(), brushOf(box(), [3, 0, 0]), CSG.ADDITION);
console.log('== plate - two rods');
run('plate - two rods', brushOf(box(2, 0.2, 1)), (() => {
  const g1 = rod(0.15, 1, 12).clone().translate(-0.5, 0, 0), g2 = rod(0.15, 1, 12).clone().translate(0.5, 0, 0);
  const ev = new CSG.Evaluator(); ev.attributes = ['position', 'normal']; ev.useCDTClipping = true;
  return ev.evaluate(brushOf(g1), brushOf(g2), CSG.ADDITION);
})(), CSG.SUBTRACTION);
function rotG(g, rx, ry, rz) { return g.clone().applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz))); }
const R = [0.37, 0.61, 0.23];
console.log('== ROT far cube - rod');
run('ROT far cube - rod', brushOf(rotG(box(), ...R), [40, -17, 23]), brushOf(rotG(rod(), ...R), [40, -17, 23]), CSG.SUBTRACTION);
console.log('== blind hole');
run('blind hole', A(), brushOf(rod(0.2, 0.6, 12), [0, 0.5, 0]), CSG.SUBTRACTION);
{
  let rng = 777, runs = 0;
  const rand = () => (rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const f0 = fails, quiet = console.log;
  for (let it = 0; it < 60 && runs < 20; it++) {
    const seg = [8, 12, 16][it % 3], r1 = 0.08 + rand() * 0.12, r2 = 0.08 + rand() * 0.12;
    const x1 = -0.7 + rand() * 1.4, z1 = -0.3 + rand() * 0.6, x2 = -0.7 + rand() * 1.4, z2 = -0.3 + rand() * 0.6;
    if (Math.hypot(x1 - x2, z1 - z2) < r1 + r2 + 0.02) continue;
    const ev = new CSG.Evaluator(); ev.attributes = ['position', 'normal']; ev.useCDTClipping = true;
    const rods = ev.evaluate(brushOf(rod(r1, 1, seg), [x1, 0, z1]), brushOf(rod(r2, 1, seg), [x2, 0, z2]), CSG.ADDITION);
    const lines = [];
    console.log = (...a) => { if (/^FAIL/.test(String(a[0]))) lines.push(a.join(' ')); };
    try { run('fuzz ' + it, brushOf(box(2, 0.2, 1)), rods, CSG.SUBTRACTION); } finally { console.log = quiet; }
    lines.forEach(l => console.log(l));
    runs++;
  }
  console.log('== fuzz: ' + runs + ' plates, ' + (fails - f0) + ' failures');
}
console.log('\n' + (n - fails) + '/' + n + (fails ? '  FAILURES' : '  all green'));
process.exit(fails ? 1 : 0);
