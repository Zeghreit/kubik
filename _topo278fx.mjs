// v2.78 topology after a boolean - node fixture on the REAL engine.
// run: node _topo278fx.mjs   (libs: _dev/csg, same versions as the importmap)
import fs from 'fs';
const here = new URL('.', import.meta.url);
const LIB = new URL('_dev/csg/node_modules/', here);
const THREE = await import(new URL('three/build/three.module.js', LIB).href);
const CSG = await import(new URL('three-bvh-csg/build/index.module.js', LIB).href);

const html = fs.readFileSync(new URL('index.html', here), 'utf8');
const topoSrc = fs.readFileSync(new URL(process.env.TOPO_SRC || '_topo278.js', here), 'utf8');
function cut(a, b) { const i = html.indexOf(a), j = html.indexOf(b, i); if (i < 0 || j < 0) throw new Error('cut ' + a); return html.slice(i, j); }

// The app's own weld / heal / merge, cut from index.html. mergeCoplanarTriangles
// is wrapped so the fixture sees exactly what the app hands it.
const lib = new Function('THREE', 'const IMPORT_TRI_BUDGET = 40000; const IMPORT_COPLANAR_DOT = 0.9998;' +
  cut('const CSG_WELD_TOL =', 'const BOOL_OPS') +
  cut('function importWeldKey(', '/* A budget, refused out loud').replace('function mergeCoplanarTriangles(', 'function legacyMerge(') +
  'let captured = null; function mergeCoplanarTriangles(p, t, m) { captured = { positions: p, tris: t, matOf: m }; return legacyMerge(p, t, m); }' +
  topoSrc +
  '; return { editableFromCSGResult, legacyMerge, topoNgon, topoDivisions, topoBlockedEdges, topoCollinear, importTriNormal, get captured() { return captured; } };')(THREE);

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

function run(name, a, b, op, expect) {
  const ev = new CSG.Evaluator();
  ev.attributes = ['position', 'normal'];
  ev.useCDTClipping = true; ev.useGroups = true; ev.consolidateGroups = true; ev.removeUnusedMaterials = true;
  const res = ev.evaluate(a, b, op);
  const ed = lib.editableFromCSGResult(res);
  const C = lib.captured;
  const P = C.positions, tris = C.tris;
  // Seam: a result vertex no input had, or one two inputs had (they touch).
  const ka = posKeys(a), kb = posKeys(b);
  const seam = new Set();
  for (let i = 0; i < P.length / 3; i++) {
    const k = Math.round(P[i * 3] * 1e4) + '_' + Math.round(P[i * 3 + 1] * 1e4) + '_' + Math.round(P[i * 3 + 2] * 1e4);
    const ia = ka.has(k), ib = kb.has(k);
    if ((!ia && !ib) || (ia && ib)) seam.add(i);
  }
  const P0 = P.slice();
  const t0 = performance.now();
  // Hand-made divisions of flat faces, per input, then the result edges on them.
  const div = [];
  [a, b].forEach(br => { if (!br.userData.faces) return;
    const pa = br.geometry.attributes.position, Pi = [];
    for (let i = 0; i < pa.count; i++) Pi.push(pa.getX(i), pa.getY(i), pa.getZ(i));
    div.push(...lib.topoDivisions(Pi, br.userData.faces, 0.9998)); });
  const blocked = lib.topoBlockedEdges(P, tris, div, 7e-4);
  const r = lib.topoNgon(P, tris, C.matOf, seam, 0.9998, blocked);
  const ms = performance.now() - t0;
  console.log('\n== ' + name + '  legacy ' + ed.groups.length + ' faces, seam ' + seam.size + ', divisions ' + div.length / 6 + ', blocked ' + (blocked ? blocked.size : 'n/a') + ', ' + ms.toFixed(1) + ' ms');
  check(name + ': topoNgon finished', !!r);
  if (!r) return;
  const G = r.groups;
  console.log('   new ' + G.length + ' faces, dissolved ' + r.dissolved + ', bridged ' + r.bridged);
  check(name + ': positions untouched', P.every((x, i) => x === P0[i]));

  // Watertight, consistently wound: every directed edge exactly once, its reverse exactly once.
  const nV = P.length / 3, dir = new Map();
  let degen = 0;
  G.forEach(g => g.triangles.forEach(t => {
    if (!lib.importTriNormal(P, t)) degen++;
    for (let k = 0; k < 3; k++) { const key = t[k] * nV + t[(k + 1) % 3]; dir.set(key, (dir.get(key) || 0) + 1); }
  }));
  let open = 0, dup = 0;
  dir.forEach((c, key) => { const a = Math.floor(key / nV), b = key - a * nV; if (c > 1) dup++; if (!dir.has(b * nV + a)) open++; });
  const dir0 = new Map();
  tris.forEach(t => { for (let k = 0; k < 3; k++) { const key = t[k] * nV + t[(k + 1) % 3]; dir0.set(key, 1); } });
  let open0 = 0;
  dir0.forEach((_c, key) => { const a = Math.floor(key / nV), b = key - a * nV; if (!dir0.has(b * nV + a)) open0++; });
  check(name + ': no degenerate triangle', degen === 0, 'degen ' + degen);
  let dup0 = 0; { const c0 = new Map(); tris.forEach(t => { for (let k = 0; k < 3; k++) { const key = t[k] * nV + t[(k + 1) % 3]; c0.set(key, (c0.get(key) || 0) + 1); } }); c0.forEach(c => { if (c > 1) dup0++; }); }
  check(name + ': no open or doubled edge beyond the input', open <= open0 && dup <= dup0, 'open ' + open + ' (input ' + open0 + '), dup ' + dup);

  // Volume and area: the shape did not move.
  const vol = ts => ts.reduce((s, t) => { const a = t[0] * 3, b = t[1] * 3, c = t[2] * 3;
    return s + (P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c])) / 6; }, 0);
  const area = ts => ts.reduce((s, t) => { const a = t[0] * 3, b = t[1] * 3, c = t[2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    return s + Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2; }, 0);
  const allT = G.flatMap(g => g.triangles);
  const legacyT = ed.groups.flatMap(g => g.triangles);
  const dv = Math.abs(vol(allT) - vol(legacyT)), da = Math.abs(area(allT) - area(legacyT));
  // A dissolved vertex may sit up to the 1e-4 weld grid off its line, so the
  // shape may move by that much per dissolved vertex, and no more (fable, v2.78).
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], P[i + k]); hi[k] = Math.max(hi[k], P[i + k]); }
  const diag = Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
  const V0 = Math.abs(vol(legacyT)), A0 = area(legacyT), slack = r.dissolved * 1e-4 * diag;
  check(name + ': volume and area unchanged', dv <= 1e-9 * V0 + slack * diag && da <= 1e-9 * A0 + slack,
        'dV ' + dv.toExponential(1) + ' dA ' + da.toExponential(1));
  // No new sliver: every output triangle at least as fat as the input's thinnest, or the heal tolerance.
  const H = t => { const a = t[0] * 3, b = t[1] * 3, c = t[2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const A2 = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
    return A2 / Math.max(Math.hypot(ux, uy, uz), Math.hypot(vx, vy, vz), Math.hypot(P[c] - P[b], P[c + 1] - P[b + 1], P[c + 2] - P[b + 2])); };
  const inMin = Math.min(...legacyT.map(H)), outMin = Math.min(...allT.map(H));
  if (process.env.DBG && outMin < Math.min(3.5e-4, inMin) * 0.999) {
    const t = allT.reduce((b, t) => (H(t) < H(b) ? t : b));
    const g = G.find(g => g.triangles.includes(t));
    const xyz = v => '(' + [0, 1, 2].map(k => P[v * 3 + k].toFixed(5)).join(',') + ')';
    console.log('   THIN', t.map(xyz).join(' '), 'face tris', g.triangles.length, 'seam', t.map(v => seam.has(v) ? 1 : 0).join(''), 'H', H(t).toExponential(2));
  }
  check(name + ': no new sliver', outMin >= Math.min(3.5e-4, inMin) * 0.999, 'min height ' + outMin.toExponential(1) + ' (input ' + inMin.toExponential(1) + ')');

  // Every face: flat, wound with its plane, ONE simple boundary loop.
  let bad = 0, badWhy = '';
  const loopsOf = [];
  G.forEach((g, gi) => {
    const ns = g.triangles.map(t => lib.importTriNormal(P, t));
    const n0 = ns[0];
    if (ns.some(m => !m || m[0] * n0[0] + m[1] * n0[1] + m[2] * n0[2] < 0.9998)) { bad++; badWhy = 'face ' + gi + ' not flat'; return; }
    const d = new Map();
    g.triangles.forEach(t => { for (let k = 0; k < 3; k++) d.set(t[k] * nV + t[(k + 1) % 3], 1); });
    const nx = new Map();
    let pinch = false;
    d.forEach((_c, key) => { const a = Math.floor(key / nV), b = key - a * nV; if (d.has(b * nV + a)) return; if (nx.has(a)) pinch = true; nx.set(a, b); });
    const loop = [];
    let v = nx.keys().next().value;
    const s0 = v;
    do { loop.push(v); v = nx.get(v); } while (v !== undefined && v !== s0 && loop.length <= nx.size);
    if (pinch || v !== s0 || loop.length !== nx.size) { bad++; badWhy = 'face ' + gi + ' boundary is not one simple loop'; return; }
    loopsOf.push({ loop: loop, n: n0 });
  });
  check(name + ': every face flat with one simple loop', bad === 0, badWhy);

  // No dissolvable vertex left next to the seam.
  const nb = new Map(), seamFace = new Set();
  loopsOf.forEach(({ loop }) => loop.forEach((v, i) => {
    const w = loop[(i + 1) % loop.length];
    if (!nb.has(v)) nb.set(v, new Set()); if (!nb.has(w)) nb.set(w, new Set());
    nb.get(v).add(w); nb.get(w).add(v);
  }));
  loopsOf.forEach(({ loop }) => { if (loop.some(v => seam.has(v))) loop.forEach(v => seamFace.add(v)); });
  let left = 0;
  nb.forEach((s, v) => { if (s.size !== 2 || !seamFace.has(v) || r.frozen.has(v)) return; const [a, b] = Array.from(s); if (lib.topoCollinear(P, a, v, b)) left++; });
  check(name + ': no collinear vertex left by the seam', left === 0, 'left ' + left);

  if (expect) expect(G, P, loopsOf, ed);
}

const onPlane = (P, loop, axis, val) => loop.every(v => Math.abs(P[v * 3 + axis] - val) < 1e-6);
const topFaces = (P, L, y) => L.filter(f => onPlane(P, f.loop, 1, y) && f.n[1] > 0.99);

const A = () => brushOf(box());
run('cube - rod', A(), brushOf(rod()), CSG.SUBTRACTION, (G, P, L) => {
  const top = topFaces(P, L, 0.5);
  check('cube - rod: top face with a hole = 2 faces', top.length === 2, top.length + ' faces');
  const shared = top.length === 2 ? top[0].loop.filter(v => top[1].loop.includes(v)) : [];
  const corners = shared.filter(v => Math.abs(Math.abs(P[v * 3]) - 0.5) < 1e-6 && Math.abs(Math.abs(P[v * 3 + 2]) - 0.5) < 1e-6);
  check('cube - rod: bridges leave from two opposite corners', corners.length === 2 &&
        Math.abs(P[corners[0] * 3] + P[corners[1] * 3]) < 1e-6 && Math.abs(P[corners[0] * 3 + 2] + P[corners[1] * 3 + 2]) < 1e-6,
        corners.map(v => '(' + P[v * 3] + ',' + P[v * 3 + 2] + ')').join(' '));
  const bot = L.filter(f => onPlane(P, f.loop, 1, -0.5) && f.n[1] < -0.99);
  check('cube - rod: bottom face with a hole = 2 faces', bot.length === 2, bot.length + ' faces');
});
run('loop-cut cube - rod', brushOf(loopCutCube()), brushOf(rod()), CSG.SUBTRACTION, (G, P, L) => {
  const top = topFaces(P, L, 0.5);
  check('loop-cut: top = 2 faces', top.length === 2, top.length + ' faces');
  const shared = top.length === 2 ? top[0].loop.filter(v => top[1].loop.includes(v)) : [];
  const mids = shared.filter(v => Math.abs(P[v * 3]) < 1e-6 && Math.abs(Math.abs(P[v * 3 + 2]) - 0.5) < 1e-6);
  check('loop-cut: bridges continue the loop cut (x = 0 on both sides)', mids.length === 2,
        shared.map(v => '(' + P[v * 3].toFixed(3) + ',' + P[v * 3 + 2].toFixed(3) + ')').join(' '));
  const straight = shared.filter(v => Math.abs(P[v * 3]) < 1e-6).length;
  check('loop-cut: the whole bridge lies on x = 0', straight === 4, straight + ' of ' + shared.length + ' shared vertices on x=0');
  const front = L.filter(f => f.n[2] > 0.99).length, back = L.filter(f => f.n[2] < -0.99).length;
  check('loop-cut: the walls keep their loop cut (2 + 2 faces)', front === 2 && back === 2, front + ' front, ' + back + ' back');
});
run('cube U cube in line', A(), brushOf(box(), [0.5, 0, 0]), CSG.ADDITION, (G) => {
  check('box U box in line = 6 faces', G.length === 6, G.length + ' faces');
});
run('cube U cube diagonal', A(), brushOf(box(), [0.5, 0.5, 0.5]), CSG.ADDITION);
run('disjoint union', A(), brushOf(box(), [3, 0, 0]), CSG.ADDITION, (G) => {
  check('disjoint = 12 faces', G.length === 12, G.length + ' faces');
});
run('T-cut notch', A(), brushOf(box(0.4, 0.6, 2), [0, 0.5, 0]), CSG.SUBTRACTION, (G) => {
  check('notch = 10 faces', G.length === 10, G.length + ' faces');
});
run('plate - two rods', brushOf(box(2, 0.2, 1)), (() => {
  const g1 = rod(0.15, 1, 12).clone().translate(-0.5, 0, 0), g2 = rod(0.15, 1, 12).clone().translate(0.5, 0, 0);
  const ev = new CSG.Evaluator(); ev.attributes = ['position', 'normal']; ev.useCDTClipping = true;
  return ev.evaluate(brushOf(g1), brushOf(g2), CSG.ADDITION);
})(), CSG.SUBTRACTION, (G, P, L) => {
  const top = topFaces(P, L, 0.1);
  check('plate: two holes in one face = 3 faces', top.length === 3, top.length + ' faces');
});

// Found by fable (v2.78): a rotated scene far from the origin, a blind hole
// (the heal leaves an edge used three times), and a fuzz of two-hole plates.
function rotG(g, rx, ry, rz) { return g.clone().applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz))); }
const R = [0.37, 0.61, 0.23];
run('ROT cube - rod64', brushOf(rotG(box(), ...R)), brushOf(rotG(rod(0.25, 2, 64), ...R)), CSG.SUBTRACTION);
run('ROT far cube - rod', brushOf(rotG(box(), ...R), [40, -17, 23]), brushOf(rotG(rod(), ...R), [40, -17, 23]), CSG.SUBTRACTION);
run('blind hole', A(), brushOf(rod(0.2, 0.6, 12), [0, 0.5, 0]), CSG.SUBTRACTION);
{
  const quiet = console.log; let rng = 12345, runs = 0;
  const rand = () => (rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const f0 = fails;
  for (let it = 0; it < 120 && runs < 60; it++) {
    const seg = [8, 12, 16, 24][it % 4], r1 = 0.08 + rand() * 0.12, r2 = 0.08 + rand() * 0.12;
    const x1 = -0.7 + rand() * 1.4, z1 = -0.3 + rand() * 0.6, x2 = -0.7 + rand() * 1.4, z2 = -0.3 + rand() * 0.6;
    if (Math.hypot(x1 - x2, z1 - z2) < r1 + r2 + 0.02) continue;
    const ev = new CSG.Evaluator(); ev.attributes = ['position', 'normal']; ev.useCDTClipping = true;
    const rods = ev.evaluate(brushOf(rod(r1, 1, seg), [x1, 0, z1]), brushOf(rod(r2, 1, seg), [x2, 0, z2]), CSG.ADDITION);
    const lines = [];
    console.log = (...a) => { if (/^(FAIL|   THIN)/.test(String(a[0]))) lines.push(a.join(' ')); };
    try { run('fuzz ' + it, brushOf(box(2, 0.2, 1)), rods, CSG.SUBTRACTION); } finally { console.log = quiet; }
    lines.forEach(l => console.log(l));
    runs++;
  }
  console.log('\n== fuzz: ' + runs + ' plates, ' + (fails - f0) + ' failures');
}

console.log('\n' + (n - fails) + '/' + n + (fails ? '  FAILURES' : '  all green'));
process.exit(fails ? 1 : 0);
