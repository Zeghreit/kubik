// v2.76 exact insert - node fixture: a split must not move the curve.
const fs = require('fs');
const cur = fs.readFileSync(__dirname + '/index.html', 'utf8');
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
const K = new Function('THREE', 'const CURVE_RES_DEF = 8, CURVE_RES_MAX = 32;' +
  cut(cur, 'function cubicPointAt(', 'function rebuildCurveGeometry(') +
  '; return { curveSamplePoints, curveSplitSpan, curveSpanCtl, cubicPointAt, normaliseCurveRadii };')(THREE);

let fails = 0, n = 0;
function check(name, ok, note) { n++; if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (note ? '  ' + note : '')); }
let seed = 777;
function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; }
const clone = o => JSON.parse(JSON.stringify(o));
function curve(np, closed) {
  const pts = [];
  for (let i = 0; i < np; i++) pts.push([rnd() * 4, rnd() * 4, rnd() * 4]);
  return { pts, closed, type: 'bezier', res: 8, radii: pts.map(() => 1), handles: pts.map(() => null) };
}
function ctl(cv, s) {
  const cc = clone(cv); K.normaliseCurveRadii(cc);
  const P = cc.pts.map(a => new V3().fromArray(a));
  return K.curveSpanCtl(P, cc.handles, !!cc.closed && P.length > 2, s);
}
const ev = (k, u) => K.cubicPointAt(k.p1, k.c1, k.c2, k.p2, u, new V3());
const dist = (a, b) => Math.sqrt(a.distanceToSquared(b));

// 1. split beside a handled end: both halves trace the old span, every other span identical
{
  let worst = 0, other = 0, runs = 0, refused = 0;
  for (let r = 0; r < 600; r++) {
    const np = 2 + (r % 6), closed = r % 3 === 0;
    const cv = curve(np, closed);
    const nn = np, cl = closed && nn > 2;
    const spans = cl ? nn : nn - 1;
    const s = Math.floor(Math.abs(rnd()) * 2 * spans) % spans;
    const iB = cl ? (s + 1) % nn : s + 1;
    const which = r % 3;       // handle on A, on B, or both
    const H = () => ({ mode: rnd() > 0 ? 'smooth' : 'corner', hIn: [rnd(), rnd(), rnd()], hOut: [rnd(), rnd(), rnd()] });
    if (which !== 1) cv.handles[s] = H();
    if (which !== 0) cv.handles[iB] = H();
    const t = 0.02 + Math.abs(rnd()) * 1.9 * 0.49;
    const old = clone(cv);
    const at = K.curveSplitSpan(cv, s, t, 1);
    if (at < 0) { refused++; continue; }
    runs++;
    const k0 = ctl(old, s), kA = ctl(cv, s), kB = ctl(cv, s + 1);
    for (let q = 0; q <= 20; q++) {
      const u = q / 20;
      worst = Math.max(worst, dist(ev(kA, u), ev(k0, u * t)), dist(ev(kB, u), ev(k0, t + u * (1 - t))));
    }
    // every other span, same controls
    for (let j = 0; j < spans; j++) {
      if (j === s) continue;
      const a = ctl(old, j), b = ctl(cv, j < at ? j : j + 1);
      other = Math.max(other, dist(a.p1, b.p1), dist(a.c1, b.c1), dist(a.c2, b.c2), dist(a.p2, b.p2));
    }
    if (cv.pts.length !== np + 1 || cv.handles.length !== np + 1 || cv.radii.length !== np + 1) worst = Infinity;
  }
  check('split halves trace the old span', worst < 1e-12 && runs > 400, 'max ' + worst.toExponential(2) + ' over ' + runs + ' (refused ' + refused + ')');
  check('every other span unchanged', other < 1e-12, 'max ' + other.toExponential(2));
}
// 2. the new point is Smooth and genuinely in line; frozen Auto ends become Smooth, others keep their mode
{
  let bad = 0;
  for (let r = 0; r < 200; r++) {
    const cv = curve(5, r % 2 === 0);
    cv.handles[1] = { mode: 'corner', hIn: [1, 0, 0], hOut: [0, 1, 0] };
    const at = K.curveSplitSpan(cv, 1, 0.3 + 0.4 * Math.abs(rnd()), 1);
    const h = cv.handles[at];
    const cr = [h.hIn[1] * h.hOut[2] - h.hIn[2] * h.hOut[1], h.hIn[2] * h.hOut[0] - h.hIn[0] * h.hOut[2], h.hIn[0] * h.hOut[1] - h.hIn[1] * h.hOut[0]];
    const dot = h.hIn[0] * h.hOut[0] + h.hIn[1] * h.hOut[1] + h.hIn[2] * h.hOut[2];
    if (h.mode !== 'smooth' || Math.hypot(...cr) > 1e-9 || dot >= 0) bad++;
    if (cv.handles[1].mode !== 'corner' || !cv.handles[3] || cv.handles[3].mode !== 'smooth') bad++;
    if (cv.handles[1].hIn.join() !== '1,0,0') bad++;       // the far handle untouched
    if (cv.handles[0] !== null || cv.handles[4] !== null) bad++;   // neighbours further out stay Auto
  }
  check('new point smooth, ends frozen, far handles and far points untouched', bad === 0, bad + ' bad');
}
// 3. two Auto ends: refused, nothing written; poly refused
{
  const cv = curve(5, false); const before = JSON.stringify(cv);
  const a = K.curveSplitSpan(cv, 1, 0.5, 1);
  const cp = curve(5, false); cp.type = 'poly'; cp.handles[1] = { mode: 'smooth', hIn: [1, 0, 0], hOut: [-1, 0, 0] };
  const b = K.curveSplitSpan(cp, 1, 0.5, 1);
  check('auto span and poly are left to the old insert', a === -1 && JSON.stringify(cv).replace(/,"handles":\[[^\]]*\]/, '') === before.replace(/,"handles":\[[^\]]*\]/, '') && b === -1);
}
// 4. t at the ends is pulled off them: no doubled point
{
  const cv = curve(4, false); cv.handles[1] = { mode: 'smooth', hIn: [-0.5, 0, 0], hOut: [0.5, 0, 0] };
  const at = K.curveSplitSpan(cv, 1, 0, 1);
  const d = Math.hypot(cv.pts[at][0] - cv.pts[1][0], cv.pts[at][1] - cv.pts[1][1], cv.pts[at][2] - cv.pts[1][2]);
  check('t = 0 does not double the point', d > 1e-6, d.toExponential(2));
}
// 5. closed wrap span (n-1 -> 0)
{
  const cv = curve(5, true); cv.handles[0] = { mode: 'corner', hIn: [0, 2, 0], hOut: [2, 0, 0] };
  const old = clone(cv);
  const at = K.curveSplitSpan(cv, 4, 0.4, 1);
  const k0 = ctl(old, 4), kA = ctl(cv, 4), kB = ctl(cv, 5);
  let w = 0; for (let q = 0; q <= 20; q++) { const u = q / 20; w = Math.max(w, dist(ev(kA, u), ev(k0, u * 0.4)), dist(ev(kB, u), ev(k0, 0.4 + u * 0.6))); }
  check('closed wrap span splits in place', at === 5 && w < 1e-12 && cv.handles[0].mode === 'corner' && cv.handles[0].hOut.join() === '2,0,0', 'at=' + at + ' dev ' + w.toExponential(2));
}
console.log((fails ? 'FAIL ' : 'PASS ') + (n - fails) + '/' + n);
