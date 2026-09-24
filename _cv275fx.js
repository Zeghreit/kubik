// v2.75 curve handles - node fixture for the evaluator.
// Runs curveSamplePoints from HEAD (old) and the working copy (new) side by side.
const fs = require('fs');
const cp = require('child_process');
const cur = fs.readFileSync(__dirname + '/index.html', 'utf8');
const head = cp.execSync('git show HEAD:index.html', { cwd: __dirname, maxBuffer: 1 << 30 }).toString('utf8');
function cut(src, a, b) { const i = src.indexOf(a), j = src.indexOf(b, i); if (i < 0 || j < 0) throw a; return src.slice(i, j); }

class V3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  clone() { return new V3(this.x, this.y, this.z); }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
  multiplyScalar(k) { this.x *= k; this.y *= k; this.z *= k; return this; }
  fromArray(a) { this.x = a[0]; this.y = a[1]; this.z = a[2]; return this; }
  distanceToSquared(v) { const a = this.x - v.x, b = this.y - v.y, c = this.z - v.z; return a * a + b * b + c * c; }
  lerp(v, t) { this.x += (v.x - this.x) * t; this.y += (v.y - this.y) * t; this.z += (v.z - this.z) * t; return this; }
}
const THREE = { Vector3: V3 };
const PRE = 'const CURVE_RES_DEF = 8, CURVE_RES_MAX = 32;';
function load(src, extra) {
  const code = cut(src, 'function cubicPointAt(', 'function rebuildCurveGeometry(');
  return new Function('THREE', PRE + code + '; return { curveSamplePoints, normaliseCurveRadii' + extra + ' };')(THREE);
}
const OLD = load(head, '');
const NEW = load(cur, ', normaliseCurveHandles, curveAutoHandle');

let fails = 0, n = 0;
function check(name, ok, note) { n++; if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (note ? '  ' + note : '')); }
let seed = 4242;
function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; }
function curve(np, closed, dbl) {
  const pts = [];
  for (let i = 0; i < np; i++) pts.push([rnd() * 4, rnd() * 4, rnd() * 4]);
  if (dbl && np > 3) pts[2] = pts[1].slice();          // a doubled corner
  return { pts, closed, type: 'bezier', res: 1 + ((Math.abs(rnd()) * 12) | 0),
           radii: pts.map(() => 0.5 + Math.abs(rnd())) };
}
function run(K, cv) { const W = [], S = []; const P = K.curveSamplePoints(JSON.parse(JSON.stringify(cv)), W, S); return { P, W, S }; }
function same(a, b, tol) {
  if (a.P.length !== b.P.length || a.W.length !== b.W.length || a.S.length !== b.S.length) return false;
  for (let i = 0; i < a.P.length; i++) {
    const d = Math.max(Math.abs(a.P[i].x - b.P[i].x), Math.abs(a.P[i].y - b.P[i].y), Math.abs(a.P[i].z - b.P[i].z));
    if (tol ? d > tol : d !== 0) return false;
  }
  for (let i = 0; i < a.W.length; i++) if (a.W[i] !== b.W[i] || a.S[i] !== b.S[i]) return false;
  return true;
}

// 1. Auto = today, byte for byte (open, closed, doubled, poly, 2-point, old file with no field)
{
  let bad = 0, tot = 0;
  for (let k = 0; k < 400; k++) {
    const cv = curve(2 + (k % 7), k % 2 === 1, k % 5 === 0);
    if (k % 13 === 0) cv.type = 'poly';
    tot++; if (!same(run(OLD, cv), run(NEW, cv))) bad++;
    const cv2 = Object.assign({}, cv, { handles: cv.pts.map(() => null) });
    tot++; if (!same(run(OLD, cv), run(NEW, cv2))) bad++;
    const cv3 = Object.assign({}, cv, { handles: 'garbage' });
    tot++; if (!same(run(OLD, cv), run(NEW, cv3))) bad++;
  }
  check('auto == HEAD byte for byte', bad === 0, bad + '/' + tot + ' differ');
}
// 2. Every point switched to Smooth with its auto handles = the same curve (nothing jumps)
{
  let worst = 0;
  for (let k = 0; k < 200; k++) {
    const cv = curve(2 + (k % 7), k % 2 === 1, false);
    const base = run(NEW, cv);
    const h = cv.pts.map((_, i) => Object.assign({ mode: k % 3 ? 'smooth' : 'corner' }, NEW.curveAutoHandle(cv, i)));
    const r = run(NEW, Object.assign({}, cv, { handles: h }));
    for (let i = 0; i < r.P.length; i++) worst = Math.max(worst, Math.abs(r.P[i].x - base.P[i].x), Math.abs(r.P[i].y - base.P[i].y), Math.abs(r.P[i].z - base.P[i].z));
    if (r.P.length !== base.P.length) worst = Infinity;
  }
  check('seeded from auto = auto curve', worst < 1e-12, 'max dev ' + worst.toExponential(2));
}
// 3. A handle is local: only the two spans touching the point move
{
  let bad = 0;
  for (let k = 0; k < 200; k++) {
    const cv = curve(6, k % 2 === 1, false); cv.res = 4;
    const base = run(NEW, cv);
    const i = 2;
    const h = cv.pts.map(() => null);
    h[i] = { mode: 'corner', hIn: [1, 2, 3], hOut: [-2, 1, 0.5] };
    const r = run(NEW, Object.assign({}, cv, { handles: h }));
    for (let q = 0; q < r.P.length; q++) {
      const span = r.S[q], changed = r.P[q].distanceToSquared(base.P[q]) > 0;
      const touching = span === i - 1 || span === i;
      if (changed && !touching) bad++;
    }
    // and the curve still passes through the point itself
    const at = r.P[i * cv.res];
    if (at.distanceToSquared(new V3().fromArray(cv.pts[i])) > 1e-20) bad++;
  }
  check('handle only moves its own two spans, point still on curve', bad === 0, bad + ' bad');
}
// 4. Corner kinks, Smooth does not
function turnAt(cv, i) {                       // angle between the spans at point i, from samples
  const r = run(NEW, cv), k = i * cv.res;
  const a = r.P[k].clone().sub(r.P[k - 1]), b = r.P[k + 1].clone().sub(r.P[k]);
  const d = (a.x * b.x + a.y * b.y + a.z * b.z) / Math.sqrt((a.x * a.x + a.y * a.y + a.z * a.z) * (b.x * b.x + b.y * b.y + b.z * b.z));
  return Math.acos(Math.max(-1, Math.min(1, d))) * 180 / Math.PI;
}
{
  const cv = { pts: [[0, 0, 0], [2, 0, 0], [4, 0, 0], [6, 0, 0]], closed: false, type: 'bezier', res: 32 };
  cv.handles = [null, { mode: 'corner', hIn: [-0.6, 0.6, 0], hOut: [0.6, 0.6, 0] }, null, null];
  const corner = turnAt(cv, 1);
  cv.handles[1] = { mode: 'smooth', hIn: [-0.3, -0.5, 0], hOut: [0.9, 1.5, 0] };   // opposite, different lengths
  const smooth = turnAt(cv, 1);
  check('corner kinks', corner > 60, corner.toFixed(1) + ' deg');
  check('smooth stays tangent (aligned, unequal lengths)', smooth < 4, smooth.toFixed(2) + ' deg');
}
// 5. Closed wrap: the handle on point 0 drives the LAST span's end and the first span's start
{
  let bad = 0;
  for (let k = 0; k < 100; k++) {
    const cv = curve(5, true, false); cv.res = 4;
    const base = run(NEW, cv);
    const h = cv.pts.map(() => null);
    h[0] = { mode: 'corner', hIn: [0, 3, 0], hOut: [0, 0, 3] };
    const r = run(NEW, Object.assign({}, cv, { handles: h }));
    const moved = new Set();
    r.P.forEach((q, j) => { if (q.distanceToSquared(base.P[j]) > 0) moved.add(r.S[j]); });
    if (!moved.has(0) || !moved.has(4) || moved.size !== 2) bad++;
  }
  check('closed: point 0 handles drive spans 0 and n-1 only', bad === 0, bad + ' bad');
}
// 6. Normaliser: one row per point whatever it is given
{
  const cv = { pts: [[0, 0, 0], [1, 0, 0], [2, 0, 0]], handles: [{ mode: 'x', hIn: [1, 'a'], hOut: null }, 7] };
  const h = NEW.normaliseCurveHandles(cv);
  const ok = h.length === 3 && h[0].mode === 'smooth' && h[0].hIn.join() === '1,0,0' &&
             h[0].hOut.join() === '0,0,0' && h[1] === null && h[2] === null;
  check('normaliser pads, cleans, keeps mode', ok, JSON.stringify(h));
}
console.log((fails ? 'FAIL ' : 'PASS ') + (n - fails) + '/' + n);
