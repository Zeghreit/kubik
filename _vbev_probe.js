/* a2.113: the vertex bevel. Six questions, all of them about geometry.
     1. does one corner of a cube become a triangular face?
     2. do the three new points sit ON the three edges that met there, at the
        distance the slider asks for? (Flat)
     3. does Round put them on a circle - equal radius from the ring's centre?
     4. does Even make it a REGULAR polygon - equal angles too?
     5. is the mesh still closed and outward-facing afterwards? A cap wound
        the wrong way is the one failure a screenshot would not show.
     6. does the selection follow the vertex to the ring it became, and does
        the whole thing undo?
*/
(function () {
  var out = [], errs = [], fails = 0;
  window.addEventListener('error', function (e) { errs.push(e.message); });
  function log(k, v) { out.push(k + '=' + v); }
  function verdict(ok, good, bad) { if (!ok) fails++; return '  - ' + (ok ? good : bad); }

  function main() {
    var k = window.__kubik, A = k.App;
    var V3 = k.THREE.Vector3;

    function freshCube() {
      A.objects.slice().forEach(function (o) { k.removeObjects([o]); });
      k.addPrimitive ? k.addPrimitive('cube') : k.startGeoSetup('cube');
      if (k.finishGeoSetup) k.finishGeoSetup(true);
      var o = A.objects[A.objects.length - 1];
      A.activeObjectId = o.id;
      A.selectedObjectIds = new Set([o.id]);
      k.setMode('vertex');
      k.ensureHelpers(o);
      return o;
    }

    // The logical vertex furthest along (+x,+y,+z) - a corner, valence 3.
    function cornerOf(o) {
      var topo = o.mesh.userData.topo, best = -1, bs = -1e9;
      for (var l = 0; l < topo.logicalCount; l++) {
        var p = k.logicalPos(o, l), s = p.x + p.y + p.z;
        if (s > bs) { bs = s; best = l; }
      }
      return best;
    }
    function faceCount(o) { return o.mesh.geometry.groups.length; }
    function verts(o) {
      var topo = o.mesh.userData.topo, a = [];
      for (var l = 0; l < topo.logicalCount; l++) a.push(k.logicalPos(o, l));
      return a;
    }
    // Signed volume of the whole triangle soup. Positive and matching the box
    // it occupies means every face is wound outward.
    function volume(o) {
      var g = o.mesh.geometry, pa = g.attributes.position, ix = g.index.array, v = 0;
      var a = new V3(), b = new V3(), c = new V3();
      for (var i = 0; i < ix.length; i += 3) {
        a.fromBufferAttribute(pa, ix[i]);
        b.fromBufferAttribute(pa, ix[i + 1]);
        c.fromBufferAttribute(pa, ix[i + 2]);
        v += a.dot(new V3().crossVectors(b, c)) / 6;
      }
      return v;
    }
    // Every edge of the soup must be used by exactly two triangles.
    function openEdges(o) {
      var g = o.mesh.geometry, pa = g.attributes.position, ix = g.index.array;
      var key = function (i) {
        return pa.getX(i).toFixed(4) + ',' + pa.getY(i).toFixed(4) + ',' + pa.getZ(i).toFixed(4);
      };
      var m = {};
      for (var i = 0; i < ix.length; i += 3) {
        for (var e = 0; e < 3; e++) {
          var p = [key(ix[i + e]), key(ix[i + (e + 1) % 3])].sort().join('|');
          m[p] = (m[p] || 0) + 1;
        }
      }
      var bad = 0;
      Object.keys(m).forEach(function (p) { if (m[p] !== 2) bad++; });
      return bad;
    }

    var AMT = 0.25;

    /* The chip keys are checked, not assumed. Setting a key the op does not
       know falls through to Flat, and Flat on a symmetric corner IS a circle -
       so sections 3 and 4 would pass while testing nothing at all. */
    var chips = (k.OP_SPECS ? k.OP_SPECS.vbevel.options : []).map(function (o) { return o.key; });
    log('0.chip_keys', chips.join(', ') +
      verdict(chips.indexOf('vround') === 0 && chips.indexOf('vflat') === 1,
        'the keys the sections below set are the ones the op reads',
        'THE CHIP KEYS MOVED - THE ROUND SECTIONS ARE TESTING NOTHING'));

    /* ---- 1 & 2. Flat: a triangle, on the edges, at the right distance ---- */
    var o = freshCube();
    var before = { f: faceCount(o), v: verts(o).length, vol: volume(o) };
    var c = cornerOf(o), cp = k.logicalPos(o, c).clone();
    // The three neighbours of that corner, before anything moves.
    var topo = o.mesh.userData.topo, nb = [];
    topo.edges.forEach(function (e) {
      if (e[0] === c) nb.push(k.logicalPos(o, e[1]).clone());
      else if (e[1] === c) nb.push(k.logicalPos(o, e[0]).clone());
    });
    A.selectedElements = new Set([c]);
    k.vertexBevelSelection();
    A.pendingOp.amount = AMT; A.pendingOp.groupMode = 'vflat'; A.pendingOp.even = false;
    k.applyPendingOp();

    var after = { f: faceCount(o), v: verts(o).length, vol: volume(o) };
    log('1.a_corner_becomes_a_face',
      'faces ' + before.f + ' -> ' + after.f + ', logical verts ' +
      before.v + ' -> ' + after.v +
      verdict(after.f === before.f + 1 && after.v === before.v + 2,
        'one new face, and the corner became three points',
        'THE CAP OR THE RING IS WRONG'));

    // Each new point must lie on a corner-to-neighbour edge, AMT along it.
    var vs = verts(o), worstOff = 1e9, worstDist = 0;
    nb.forEach(function (n2) {
      var dir = n2.clone().sub(cp), len = dir.length();
      var want = cp.clone().addScaledVector(dir.clone().normalize(), Math.min(AMT, len * 0.45));
      var best = 1e9;
      vs.forEach(function (p) { best = Math.min(best, p.distanceTo(want)); });
      worstOff = Math.min(worstOff, 1e9);
      worstDist = Math.max(worstDist, best);
    });
    log('2.flat_sits_on_the_edges',
      'worst distance from where the slider says: ' + worstDist.toFixed(5) +
      verdict(worstDist < 1e-4,
        'every new point is exactly ' + AMT + ' along its own edge',
        'A NEW POINT IS NOT ON ITS EDGE'));

    /* ---- 5. still a closed, outward solid ---- */
    log('5.still_a_solid',
      'open edges ' + openEdges(o) + ', signed volume ' +
      before.vol.toFixed(4) + ' -> ' + after.vol.toFixed(4) +
      verdict(openEdges(o) === 0 && after.vol > 0 && after.vol < before.vol,
        'closed, wound outward, and slightly smaller for the corner removed',
        'THE MESH IS OPEN OR THE CAP IS WOUND INSIDE OUT'));

    /* ---- 6. the selection followed, and it undoes ---- */
    var sel = Array.from(A.selectedElements);
    var selOnRing = sel.length === 3 && sel.every(function (l) {
      return k.logicalPos(o, l).distanceTo(cp) < AMT * 1.5;
    });
    k.cancelPendingOp();
    var undone = { f: faceCount(o), v: verts(o).length };
    log('6.selection_and_undo',
      sel.length + ' selected after, on the ring: ' + selOnRing +
      '; cancel restores ' + undone.f + ' faces / ' + undone.v + ' verts' +
      verdict(selOnRing && undone.f === before.f && undone.v === before.v,
        'the selection followed the corner to the ring, and cancel puts it back',
        'THE SELECTION WAS LOST, OR CANCEL DID NOT RESTORE'));

    /* ---- 3 & 4. Round, and Even ---- */
    /* The ring is exactly what the op leaves selected - section 6 proves that
       is what it is. Picking "vertices near the old corner" instead was wrong
       the moment the cube got skewed: other corners fell inside the radius. */
    function ringOf() {
      return Array.from(A.selectedElements).map(function (l) { return k.logicalPos(o, l); });
    }
    function spread(pts) {
      var mid = new V3();
      pts.forEach(function (p) { mid.add(p); });
      mid.divideScalar(pts.length);
      var r = pts.map(function (p) { return p.distanceTo(mid); });
      return { lo: Math.min.apply(null, r), hi: Math.max.apply(null, r), mid: mid };
    }

    o = freshCube();
    c = cornerOf(o); cp = k.logicalPos(o, c).clone();
    A.selectedElements = new Set([c]);
    k.vertexBevelSelection();
    A.pendingOp.amount = AMT; A.pendingOp.groupMode = 'vround'; A.pendingOp.even = false;
    k.applyPendingOp();
    var rr = spread(ringOf());
    log('3.round_is_a_circle',
      'ring radius ' + rr.lo.toFixed(5) + ' .. ' + rr.hi.toFixed(5) +
      verdict(rr.hi - rr.lo < 1e-4,
        'every point of the ring is the same distance from its centre',
        'ROUND DID NOT PUT THE RING ON A CIRCLE'));
    k.cancelPendingOp();

    /* Even on an already-regular corner proves nothing, so SKEW the cube
       first - drag one neighbour of the corner well out, and the three edges
       stop being equal. Flat then gives a lopsided triangle; Even must still
       give equal angles. */
    o = freshCube();
    c = cornerOf(o); cp = k.logicalPos(o, c).clone();
    var far = -1, fd = -1;
    o.mesh.userData.topo.edges.forEach(function (e) {
      var other = e[0] === c ? e[1] : (e[1] === c ? e[0] : -1);
      if (other >= 0 && fd < 0) { far = other; fd = 1; }
    });
    (function skew() {
      var ed = k.toEditable(o.mesh), tp = o.mesh.userData.topo;
      var p = k.logicalPos(o, far);
      (tp.logicalGroups[far] || []).forEach(function (ai) {
        ed.positions[ai * 3] = p.x * 2.5;
        ed.positions[ai * 3 + 1] = p.y;
        ed.positions[ai * 3 + 2] = p.z;
      });
      k.rebuildFromEditable(o, ed);
      k.ensureHelpers(o);
    })();
    c = cornerOf(o); cp = k.logicalPos(o, c).clone();
    A.selectedElements = new Set([c]);
    k.vertexBevelSelection();
    A.pendingOp.amount = AMT; A.pendingOp.groupMode = 'vround'; A.pendingOp.even = true;
    k.applyPendingOp();
    var pts = ringOf();
    var sp = spread(pts);
    // Angles about the ring's own normal.
    var nrm = new V3().crossVectors(
      pts[1].clone().sub(pts[0]), pts[2].clone().sub(pts[0])).normalize();
    var uu = pts[0].clone().sub(sp.mid).normalize();
    var ww = new V3().crossVectors(nrm, uu);
    var ang = pts.map(function (p) {
      var d = p.clone().sub(sp.mid);
      return Math.atan2(d.dot(ww), d.dot(uu));
    }).sort(function (a, b) { return a - b; });
    var gaps = [];
    for (var i = 0; i < ang.length; i++) {
      var g2 = ang[(i + 1) % ang.length] - ang[i];
      if (g2 < 0) g2 += Math.PI * 2;
      gaps.push(g2);
    }
    var gLo = Math.min.apply(null, gaps), gHi = Math.max.apply(null, gaps);
    log('4.even_is_regular',
      'skewed corner, ' + pts.length + ' points; radius ' + sp.lo.toFixed(4) +
      '..' + sp.hi.toFixed(4) + ', gaps ' + (gLo * 180 / Math.PI).toFixed(2) +
      '..' + (gHi * 180 / Math.PI).toFixed(2) + 'deg' +
      verdict(pts.length === 3 && sp.hi - sp.lo < 1e-4 && gHi - gLo < 0.01,
        'a lopsided corner still comes out a regular polygon',
        'EVEN DID NOT EQUALISE THE ANGLES'));
    k.cancelPendingOp();

    out.push('---');
    out.push('VERDICT=' + (fails ? 'FAIL' : 'PASS'));
    out.push('page.errors=' + (errs.length ? errs.join(' | ').slice(0, 500) : 'none'));
  }

  function finish() {
    var pre = document.createElement('pre');
    pre.id = 'probeOut';
    pre.textContent = '<<<PROBE\n' + out.join('\n') + '\nPROBE>>>';
    document.body.appendChild(pre);
    document.title = 'PROBE-DONE';
  }
  function ready(cb, t) {
    t = t || 0;
    if (window.__kubik && window.__kubik.App && window.__kubik.App.objects) return cb();
    if (t > 300) { out.push('ERROR=no __kubik'); return finish(); }
    setTimeout(function () { ready(cb, t + 1); }, 20);
  }
  setTimeout(function () {
    ready(function () {
      setTimeout(function () {
        try { main(); } catch (e) {
          out.push('ERROR=' + (e && e.stack ? e.stack.split('\n').slice(0, 8).join(' / ') : e));
        }
        finish();
      }, 600);
    });
  }, 300);
})();
