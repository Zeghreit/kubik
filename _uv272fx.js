// v2.72 Unfold - node fixtures: the shapes the review broke it with.
// Lifts uvIslandFabric + the Unfold block out of index.html and runs them bare.
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/index.html', 'utf8');
function cut(a, b) { const i = src.indexOf(a), j = src.indexOf(b, i); if (i < 0 || j < 0) throw a; return src.slice(i, j); }
const code = cut('function uvIslandFabric(', 'function uvRelaxRun(') +
             cut('const UV_UNFOLD_TRI_CAP', 'function uvUnfold() {');
const K = new Function('performance', code +
  '; return { uvIslandFabric, uvUnfoldIsland, uvUnfoldRun, UV_UNFOLD_STRETCH };')(require('perf_hooks').performance);

let fails = 0, n = 0;
function check(name, ok, note) { n++; if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (note ? '  ' + note : '')); }

function Mesh() { return { P: [], U: [], T: [] }; }
function vert(M, x, y, z, u, v) { M.P.push(x, y, z); M.U.push(u, v); return M.P.length / 3 - 1; }
function quad(M, a, b, c, d) { M.T.push([a, b, c], [a, c, d]); }
function grid(M, cols, rows, f) {           // f(i,j) -> [x,y,z,u,v]
  const id = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) { const q = f(i, j); id.push(vert(M, q[0], q[1], q[2], q[3], q[4])); }
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = j * (cols + 1) + i; quad(M, id[a], id[a + 1], id[a + cols + 2], id[a + cols + 1]);
  }
  return M;
}
let seed = 12345;
function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; }
function damage(M, amp) { for (let k = 0; k < M.U.length; k++) M.U[k] += amp * rnd(); return M; }

function island(M) {
  const lo = M.P.map((_, i) => i).slice(0, M.P.length / 3);
  const fab = K.uvIslandFabric(M.T, M.P, M.U, lo, true);
  return K.uvUnfoldIsland(fab.pts, fab.tri, performance.now() + 5000);
}
function press(M) {                          // the whole press, gates and all
  const lo = M.P.map((_, i) => i).slice(0, M.P.length / 3);
  const ed = { positions: M.P, uvs: M.U.slice(), groups: [{ triangles: M.T }] };
  const isl = new Int32Array(M.P.length / 3);
  const st = K.uvUnfoldRun(ed, isl, lo, null);
  st.uvs = ed.uvs;
  return st;
}
function uvArea(U, T) { let s = 0, a = 0; for (const t of T) { const [p, q, r] = t;
  const d = (U[q*2]-U[p*2])*(U[r*2+1]-U[p*2+1]) - (U[r*2]-U[p*2])*(U[q*2+1]-U[p*2+1]); s += d; a += Math.abs(d); } return { sum: s, abs: a }; }
function f3(x) { return typeof x === 'number' ? x.toFixed(3) : String(x); }
function rep(r) { return r.why ? 'why=' + r.why : 'd ' + f3(r.d0) + '->' + f3(r.d1) + ' e ' + f3(r.e0) + '->' + f3(r.e1) + ' folds ' + r.folds0 + '->' + r.folds1 + ' it ' + r.iters; }

function cylinder(cols, rows, seamAt, uvf) {
  return grid(Mesh(), cols, rows, function (i, j) {
    const a = seamAt + 2 * Math.PI * i / cols, x = Math.cos(a), z = Math.sin(a), y = j * 0.25;
    return [x, y, z].concat(uvf(x, y, z, i, j, a));
  });
}

// 1. damaged cylinder side - the fixture that works
let M = damage(cylinder(24, 6, 0, (x, y, z, i, j) => [i / 24 * 2 * Math.PI * 0.2, y * 0.2]), 0.05);
let r = island(M), st = press(M);
check('cylinder: accepted, even', st.done === 1 && r.d1 < 1.01 && r.folds1 === 0, rep(r));
M.U = st.uvs;
st = press(M);
check('cylinder: second press is "already"', st.done === 0 && st.no.already === 1, st.why);

// 2. bowls laid out equal-area: Unfold must not trade density for angles
for (const deg of [60, 90, 150]) {
  const tm = deg * Math.PI / 180, Mb = Mesh(), R = 8, S = 32, id = [];
  const c = vert(Mb, 0, 1, 0, 0.5, 0.5);
  for (let k = 1; k <= R; k++) { id[k] = [];
    for (let s = 0; s < S; s++) { const th = tm * k / R, ph = 2 * Math.PI * s / S, rr = 2 * Math.sin(th / 2) * 0.2;
      id[k].push(vert(Mb, Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph), 0.5 + rr * Math.cos(ph), 0.5 + rr * Math.sin(ph))); } }
  for (let s = 0; s < S; s++) Mb.T.push([c, id[1][(s + 1) % S], id[1][s]]);
  for (let k = 1; k < R; k++) for (let s = 0; s < S; s++) quad(Mb, id[k][s], id[k][(s + 1) % S], id[k + 1][(s + 1) % S], id[k + 1][s]);
  const w = uvArea(Mb.U, Mb.T); if (w.sum < 0) for (const t of Mb.T) t.reverse();
  r = island(Mb); st = press(Mb);
  check('bowl ' + deg + ': not made worse', st.done === 0 ? st.no.stretch === 1 : r.d1 <= r.d0 * K.UV_UNFOLD_STRETCH, rep(r) + ' press:' + (st.why || 'done'));
}

// 3. square tube, slit, projected along its own side: side faces are lines in UV
{ const Mt = Mesh(), ring = [], L = 3;
  const per = [[-1,-1],[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]];  // 9 columns, slit between first and last
  for (let j = 0; j <= L; j++) { ring[j] = []; for (let i = 0; i < per.length; i++) { const [x, y] = per[i]; ring[j].push(vert(Mt, x, y, j, x * 0.2, j * 0.2)); } }
  for (let j = 0; j < L; j++) for (let i = 0; i < per.length - 1; i++) quad(Mt, ring[j][i], ring[j][i + 1], ring[j + 1][i + 1], ring[j + 1][i]);
  r = island(Mt); st = press(Mt);
  let minD = Infinity; const U = st.uvs;
  for (let a = 0; a < U.length / 2; a++) for (let b = a + 1; b < U.length / 2; b++) minD = Math.min(minD, Math.hypot(U[a*2]-U[b*2], U[a*2+1]-U[b*2+1]));
  check('slit tube: unfolded, no point collapsed', st.done === 1 && minD > 1e-3 && r.d1 < 1.05, rep(r) + ' minDist ' + minD.toExponential(2)); }

// 4. two patches sharing one corner
{ const Mp = Mesh();
  const a = [vert(Mp,0,0,0,0,0), vert(Mp,1,0,0,.1,0), vert(Mp,1,1,0,.1,.1), vert(Mp,0,1,0,0,.1)];
  const b = [a[2], vert(Mp,2,1,0.3,.2,.1), vert(Mp,2,2,0.5,.2,.2), vert(Mp,1,2,0,.1,.2)];
  quad(Mp, a[0], a[1], a[2], a[3]); quad(Mp, b[0], b[1], b[2], b[3]);
  r = island(Mp); check('vertex-pinched pair: refused as pieces', r.why === 'pieces', rep(r)); }

// 5. long strip, folded by its damage
{ const Ms = damage(grid(Mesh(), 200, 2, (i, j) => [i * 0.1, j * 0.1, 0.02 * Math.sin(i * 0.3), i * 0.005, j * 0.005]), 0.012);
  r = island(Ms); st = press(Ms);
  check('200x2 strip: converged and even', !r.why && r.d1 < 1.02 && r.folds1 === 0 && st.done === 1, rep(r)); }

// 6. mirrored and stretched cylinder side
{ const Mm = cylinder(24, 6, 0, (x, y, z, i) => [2 * i / 24 * 2 * Math.PI * 0.2, -y * 0.2]);
  r = island(Mm); st = press(Mm);
  const w = uvArea(st.uvs, Mm.T);
  check('mirrored: accepted, stays mirrored', st.done === 1 && r.mirrored && w.sum < 0 && r.e1 < r.e0 && r.d1 < 1.01, rep(r)); }

// 7. closed tetra, and the same with a fin on one edge
{ const Mc = Mesh(), p = [[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]].map(q => vert(Mc, q[0], q[1], q[2], q[0]*.2 + q[2]*.05, q[1]*.2));
  Mc.T.push([p[0],p[1],p[2]],[p[0],p[3],p[1]],[p[0],p[2],p[3]],[p[1],p[3],p[2]]);
  r = island(Mc); check('closed tetra: refused as closed', r.why === 'closed', rep(r));
  const f = vert(Mc, 2, 2, 0, .4, .4); Mc.T.push([p[0], p[1], f]);
  r = island(Mc); check('tetra + fin: refused as non-manifold', r.why === 'nonmanifold', rep(r)); }

// 8. the banana: cut down one side, projected across - keeps its area
for (const cutA of [0.3, 1.2]) {
  const Mn = cylinder(24, 6, cutA, (x, y, z) => [z * 0.2, y * 0.2]);
  const A0 = uvArea(Mn.U, Mn.T); r = island(Mn); st = press(Mn);
  const A1 = uvArea(st.uvs, Mn.T);
  check('banana cut ' + cutA + ': unfolded at its old area', st.done === 1 && Math.abs(A1.abs / A0.abs - 1) < 1e-6 && r.folds1 === 0, rep(r) + ' area x' + f3(A1.abs / A0.abs)); }

// 9. a strip folded in half: 50/50, the solver's winding wins
{ const Mh = grid(Mesh(), 20, 2, (i, j) => [i * 0.1, j * 0.1, 0, (i <= 10 ? i : 20 - i) * 0.01 + i * 1e-4, j * 0.01]);
  r = island(Mh); st = press(Mh);
  const w = uvArea(st.uvs, Mh.T);
  check('folded in half: flat, front side up', st.done === 1 && r.folds1 === 0 && w.sum > 0, rep(r)); }

// 10. a point in no kept triangle
{ const Mo = Mesh(), q = [vert(Mo,0,0,0,0,0), vert(Mo,1,0,0,.1,0), vert(Mo,1,1,0,.1,.1), vert(Mo,0,1,0,0,.1), vert(Mo,2,0,0,.2,0), vert(Mo,2,1,0,.2,.1)];
  quad(Mo, q[0], q[1], q[2], q[3]); quad(Mo, q[1], q[4], q[5], q[2]);
  const o = vert(Mo, 3, 0, 0, .3, 0); Mo.T.push([q[4], o, vert(Mo, 4, 0, 0, .4, 0)]);   // collinear sliver
  r = island(Mo); check('orphan point: refused, not teleported', r.why === 'pieces', rep(r)); }

console.log((fails ? 'FAIL ' : 'PASS ') + (n - fails) + '/' + n);

// 11. the budget: 60,000 triangles in one island, in the time a press is given
{ const Mg = damage(cylinder(200, 150, 0, (x, y, z, i, j) => [i / 200 * 2 * Math.PI * 0.1, y * 0.1]), 0.0005);
  const t = performance.now(); st = press(Mg); const ms = performance.now() - t;
  check('60k tris: converges inside the press budget', st.done === 1, 'iters ' + st.iters + ' ' + ms.toFixed(0) + 'ms ' + (st.why || '') + ' d ' + f3(st.d0) + '->' + f3(st.d1)); }
console.log((fails ? 'FAIL ' : 'PASS ') + (n - fails) + '/' + n + ' (with budget)');

// --- second pass (fable): tube, washer, flipped face
function tube(amp) {                                 // closed round, open both ends
  const Mt = Mesh(), id = [];
  for (let j = 0; j <= 6; j++) { id[j] = []; for (let i = 0; i < 24; i++) { const a = 2 * Math.PI * i / 24;
    id[j].push(vert(Mt, Math.cos(a), j * 0.25, Math.sin(a), i / 24 * 0.5, j * 0.05)); } }
  for (let j = 0; j < 6; j++) for (let i = 0; i < 24; i++) quad(Mt, id[j][i], id[j][(i + 1) % 24], id[j + 1][(i + 1) % 24], id[j + 1][i]);
  return damage(Mt, amp);
}
seed = 12345; st = press(tube(0));    check('tube, clean: needs a cut', st.done === 0 && st.no.closed === 1, st.why);
seed = 12345; st = press(tube(0.05)); check('tube, damaged: needs a cut', st.done === 0 && st.no.closed === 1, st.why);
{ const Mw = Mesh(), id = [];                        // flat washer: a disk with a hole
  for (let k = 0; k <= 3; k++) { id[k] = []; for (let s = 0; s < 32; s++) { const a = 2 * Math.PI * s / 32, rr = 1 + k * 0.3;
    id[k].push(vert(Mw, rr * Math.cos(a), 0, rr * Math.sin(a), 0.5 + 0.1 * rr * Math.cos(a), 0.5 + 0.1 * rr * Math.sin(a))); } }
  for (let k = 0; k < 3; k++) for (let s = 0; s < 32; s++) quad(Mw, id[k][s], id[k][(s + 1) % 32], id[k + 1][(s + 1) % 32], id[k + 1][s]);
  if (uvArea(Mw.U, Mw.T).sum < 0) for (const t of Mw.T) t.reverse();
  seed = 777; damage(Mw, 0.01);
  r = island(Mw); st = press(Mw);
  check('flat washer: still unfolds', st.done === 1 && r.d1 < 1.05, rep(r)); }
{ const Mf = grid(Mesh(), 6, 6, (i, j) => [i, j, 0, i * 0.1, j * 0.1]);
  Mf.T[20].reverse(); seed = 5; damage(Mf, 0.06);
  r = island(Mf); st = press(Mf);
  check('one face wound backwards: turned round and flattened (v2.72a)',
        st.done === 1 && r.turned === 1 && r.folds1 === 0 && r.d1 < 1.01, rep(r) + ' turned ' + r.turned); }
{ const Mb = Mesh(), top = [], bot = [], K2 = 24;       // Moebius strip: no one side
  for (let i = 0; i < K2; i++) { const a = 2 * Math.PI * i / K2, h = 0.3;
    const c = Math.cos(a / 2), s2 = Math.sin(a / 2);
    top.push(vert(Mb, (1 + h * c) * Math.cos(a), (1 + h * c) * Math.sin(a), h * s2, i / K2, 0.1));
    bot.push(vert(Mb, (1 - h * c) * Math.cos(a), (1 - h * c) * Math.sin(a), -h * s2, i / K2, 0)); }
  for (let i = 0; i < K2 - 1; i++) quad(Mb, bot[i], bot[i + 1], top[i + 1], top[i]);
  quad(Mb, bot[K2 - 1], top[0], bot[0], top[K2 - 1]);   // the half twist closes it
  r = island(Mb); check('Moebius strip: refused as having no one side', r.why === 'winding', rep(r)); }
console.log((fails ? 'FAIL ' : 'PASS ') + (n - fails) + '/' + n + ' (second pass)');
