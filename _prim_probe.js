/* The five primitives, audited rather than eyeballed.

   For each: face and vertex counts against what the parameters ask for, how
   many faces are quads, the winding audit, the Euler characteristic (2 for
   anything closed, 0 for the torus - which is the cheapest proof its ring
   closed both ways) and the bounding box against the requested size. */
(function () {
  var out = [], errs = [];
  var _ce = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); _ce.apply(console, arguments); };
  function log(k, v) { out.push(k + '=' + v); }
  function K() { return window.__kubik; }

  var k, A, obj;

  function shape(kind, params) {
    k.setPrimitiveGeometry(obj, kind, params);
    var t = obj.mesh.userData.topo;
    var pa = obj.mesh.geometry.attributes.position;
    var lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    for (var i = 0; i < pa.count; i++) {
      var c = [pa.getX(i), pa.getY(i), pa.getZ(i)];
      for (var d = 0; d < 3; d++) { if (c[d] < lo[d]) lo[d] = c[d]; if (c[d] > hi[d]) hi[d] = c[d]; }
    }
    // How many faces are four-sided, which is what makes a cage editable.
    var quads = 0, tris = 0, ngons = 0;
    t.faceGroups.forEach(function (fg, gi) {
      var n = k.groupLogicalLoop(obj, gi).length;
      if (n === 4) quads++; else if (n === 3) tris++; else ngons++;
    });
    var w = k.auditWinding(obj);
    return {
      f: t.faceGroups.length, v: t.logicalCount, e: t.edges.length,
      quads: quads, tris: tris, ngons: ngons,
      euler: t.logicalCount - t.edges.length + t.faceGroups.length,
      w: w,
      size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]],
      centre: [(hi[0] + lo[0]) / 2, (hi[1] + lo[1]) / 2, (hi[2] + lo[2]) / 2],
      pos: pa
    };
  }

  /* Do the vertices sit exactly on the surface the parameters describe?
     That is the real test for a round shape, and it is exact - a bounding
     box only agrees with the diameter when a vertex happens to land on an
     axis. Returns the worst error found. */
  function onSurface(r, kind, p) {
    var worst = 0, pa = r.pos;
    var rx = p.x / 2, ry = p.y / 2, rz = p.z / 2;
    var tr = p.y / 2, Rx = Math.max(tr * 0.05, p.x / 2 - tr), Rz = Math.max(tr * 0.05, p.z / 2 - tr);
    for (var i = 0; i < pa.count; i++) {
      var x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i), e = 0;
      if (kind === 'sphere') {
        e = Math.abs(Math.sqrt((x / rx) * (x / rx) + (y / ry) * (y / ry) + (z / rz) * (z / rz)) - 1);
      } else if (kind === 'cylinder') {
        // The caps' rim is on the ellipse too; the cap centre is not a vertex.
        e = Math.abs(Math.sqrt((x / rx) * (x / rx) + (z / rz) * (z / rz)) - 1);
        var dy = Math.abs(Math.abs(y) - p.y / 2);
        if (dy > 1e-6 && dy < p.y / 2 - 1e-6) e = Math.min(e, 0);   // mid-wall rings
      } else if (kind === 'torus') {
        // distance from the ring's spine, in the tube's own circle
        var th = Math.atan2(z / Rz, x / Rx);
        var cx = Rx * Math.cos(th), cz = Rz * Math.sin(th);
        e = Math.abs(Math.sqrt((x - cx) * (x - cx) + y * y + (z - cz) * (z - cz)) - tr);
      }
      if (e > worst) worst = e;
    }
    return worst;
  }
  function line(r, wantEuler, wantSize, surf) {
    var bad = [];
    if (r.w.reversed) bad.push(r.w.reversed + ' reversed');
    if (r.w.conflictEdges) bad.push(r.w.conflictEdges + ' bad edges');
    if (r.w.nonManifold) bad.push(r.w.nonManifold + ' non-manifold');
    if (typeof wantEuler === 'number' && r.euler !== wantEuler) bad.push('euler ' + r.euler + ' want ' + wantEuler);
    if (typeof wantEuler === 'number' && r.w.boundary) bad.push(r.w.boundary + ' open edges');
    if (wantEuler === 'open' && !r.w.boundary) bad.push('no open edge on a plane');
    if (surf && surf.err > 1e-6) bad.push('off its ' + surf.kind + ' surface by ' + surf.err.toFixed(5));
    if (wantSize) {
      for (var d = 0; d < 3; d++) {
        if (wantSize[d] !== null && Math.abs(r.size[d] - wantSize[d]) > 0.02) {
          bad.push('size' + 'xyz'[d] + ' ' + r.size[d].toFixed(3) + ' want ' + wantSize[d]);
        }
      }
      for (var c = 0; c < 3; c++) if (Math.abs(r.centre[c]) > 1e-6) bad.push('off centre on ' + 'xyz'[c]);
    }
    return (bad.length ? 'FAIL ' + bad.join(', ') + '  ' : 'ok  ') +
      r.f + 'f/' + r.v + 'v/' + r.e + 'e  quads:' + r.quads +
      ' tris:' + r.tris + ' ngons:' + r.ngons +
      ' size:' + r.size.map(function (n) { return n.toFixed(2); }).join('x');
  }

  function main() {
    k = K(); A = k.App;
    var id = A.activeObjectId || Array.from(A.selectedObjectIds)[0];
    obj = k.findObject(id);
    A.activeObjectId = id;
    k.ensureHelpers(obj);

    log('cube.1x1', line(shape('cube', { h: 1, v: 1, x: 1, y: 1, z: 1 }), 2, [1, 1, 1]));
    log('cube.3x2', line(shape('cube', { h: 3, v: 2, x: 2, y: 1, z: 0.5 }), 2, [2, 1, 0.5]));
    log('plane.1', line(shape('plane', { h: 1, v: 1, x: 2, y: 1, z: 2 }), 'open', [2, 0, 2]));
    log('plane.4x3', line(shape('plane', { h: 4, v: 3, x: 2, y: 1, z: 1 }), 'open', [2, 0, 1]));
    function round(name, kind, p, euler) {
      var r = shape(kind, p);
      log(name, line(r, euler, null, { kind: kind, err: onSurface(r, kind, p) }) +
        '  height:' + r.size[1].toFixed(3));
    }
    round('cyl.12', 'cylinder', { h: 12, v: 1, x: 1, y: 2, z: 1 }, 2);
    round('cyl.6x3', 'cylinder', { h: 6, v: 3, x: 1, y: 1, z: 2 }, 2);
    round('cyl.3', 'cylinder', { h: 3, v: 1, x: 1, y: 1, z: 1 }, 2);
    round('sphere.16x8', 'sphere', { h: 16, v: 8, x: 1, y: 1, z: 1 }, 2);
    round('sphere.8x4', 'sphere', { h: 8, v: 4, x: 2, y: 1, z: 1 }, 2);
    round('torus.16x8', 'torus', { h: 16, v: 8, x: 2, y: 0.6, z: 2 }, 0);
    round('torus.8x6', 'torus', { h: 8, v: 6, x: 1, y: 0.3, z: 1 }, 0);

    shape('plane', { h: 2, v: 2, x: 1, y: 1, z: 1 });
    var g = obj.mesh.geometry, ix = g.index, pp = g.attributes.position;
    var ax = ix.getX(0), bx = ix.getX(1), cx2 = ix.getX(2);
    // three.js is a module here, so THREE is not a global in this scope -
    // plain arithmetic instead.
    var A0 = [pp.getX(ax), pp.getY(ax), pp.getZ(ax)];
    var B0 = [pp.getX(bx), pp.getY(bx), pp.getZ(bx)];
    var C0 = [pp.getX(cx2), pp.getY(cx2), pp.getZ(cx2)];
    var u = [B0[0] - A0[0], B0[1] - A0[1], B0[2] - A0[2]];
    var w = [C0[0] - A0[0], C0[1] - A0[1], C0[2] - A0[2]];
    var nx = u[1] * w[2] - u[2] * w[1], ny = u[2] * w[0] - u[0] * w[2], nz = u[0] * w[1] - u[1] * w[0];
    var nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    log('plane.faces.up', (ny / nl) > 0.99 ? 'yes' :
      'NO - normal ' + [nx / nl, ny / nl, nz / nl].map(function (n) { return n.toFixed(2); }).join(','));

    /* Counts have to follow the parameters, not just be self-consistent. */
    var c = shape('cylinder', { h: 10, v: 2, x: 1, y: 1, z: 1 });
    log('counts.cylinder', c.f + ' faces, want ' + (10 * 2 + 2) + ' (10x2 sides + 2 caps)' +
      '  ' + c.v + ' verts, want ' + (10 * 3));
    var sp = shape('sphere', { h: 8, v: 4, x: 1, y: 1, z: 1 });
    log('counts.sphere', sp.f + ' faces, want ' + (8 * 4) + '  ' + sp.v + ' verts, want ' + (8 * 3 + 2));
    var to = shape('torus', { h: 8, v: 6, x: 1, y: 0.3, z: 1 });
    log('counts.torus', to.f + ' faces, want ' + (8 * 6) + '  ' + to.v + ' verts, want ' + (8 * 6));

    /* Clamps: nonsense in, something sane out. */
    var tiny = k.primParams('cylinder', { h: 1, v: 0, x: 0, y: -3, z: NaN });
    log('clamp', JSON.stringify(tiny));
    log('clamp.builds', line(shape('cylinder', { h: 1, v: 0, x: 0, y: -3, z: NaN }), 2, null));
    var huge = k.primParams('sphere', { h: 999, v: 999, x: 1, y: 1, z: 1 });
    log('clamp.max', JSON.stringify(huge));

    /* And the app's own ops have to work on what came out. */
    shape('cylinder', { h: 8, v: 1, x: 1, y: 1, z: 1 });
    A.mode = 'edge';
    A.selectedElements = new Set([0]);
    var before = obj.mesh.userData.topo.faceGroups.length;
    k.edgeLoopSelection();
    if (A.pendingOp) k.confirmPendingOp();
    k.ensureHelpers(obj = k.findObject(id));
    log('loopcut.on.cylinder', before + ' faces -> ' + obj.mesh.userData.topo.faceGroups.length +
      '  winding:' + (k.auditWinding(obj).ok ? 'ok' : 'BROKEN'));

    log('console.errors', errs.length ? errs.join(' | ').slice(0, 400) : 'none');
  }

  window.addEventListener('error', function (e) { errs.push('onerror: ' + (e.message || e) + ' @' + (e.lineno || '')); });
  function ready(cb, t) {
    t = t || 0;
    if (window.__kubik && window.__kubik.App) return cb();
    if (t > 250) { out.push('ERROR=no __kubik'); return finish(); }
    setTimeout(function () { ready(cb, t + 1); }, 20);
  }
  function finish() {
    var pre = document.createElement('pre');
    pre.id = 'probeOut';
    pre.textContent = '<<<PROBE\n' + out.join('\n') + '\nPROBE>>>';
    document.body.appendChild(pre);
    document.title = 'PROBE-DONE';
  }
  setTimeout(function () {
    ready(function () {
      setTimeout(function () {
        try { main(); } catch (e) { out.push('ERROR=' + (e && e.stack ? e.stack.split('\n').slice(0, 5).join(' / ') : e)); }
        finish();
      }, 600);
    });
  }, 300);
})();
