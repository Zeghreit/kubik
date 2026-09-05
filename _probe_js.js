/* a2.28 harness. Appended to a COPY of index.html; never shipped. */
(function () {
  var out = [], errs = [], shots = [];
  var _ce = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); _ce.apply(console, arguments); };
  function log(k, v) { out.push(k + '=' + v); }
  function K() { return window.__kubik; }

  function grab() {
    var k = K();
    k.renderer.render(k.scene, k.camera);
    var gl = k.renderer.getContext();
    var w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    var px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return { w: w, h: h, px: px };
  }
  // Mean over an EXACT object mask, never over the whole frame.
  function meanIn(g, mask) {
    var s = 0, n = 0;
    for (var i = 0; i < mask.length; i++) {
      if (!mask[i]) continue;
      s += 0.299 * g.px[i * 4] + 0.587 * g.px[i * 4 + 1] + 0.114 * g.px[i * 4 + 2];
      n++;
    }
    return n ? s / n : 0;
  }
  function objectMask(a, b) {
    var m = new Uint8Array(a.w * a.h), n = 0;
    for (var i = 0; i < m.length; i++) {
      var d = Math.abs(a.px[i * 4] - b.px[i * 4]) + Math.abs(a.px[i * 4 + 1] - b.px[i * 4 + 1]) + Math.abs(a.px[i * 4 + 2] - b.px[i * 4 + 2]);
      if (d > 12) { m[i] = 1; n++; }
    }
    m.count = n;
    return m;
  }
  function defOf(obj) {
    var m = obj.mesh.material;
    if (Array.isArray(m)) m = m[0];
    return K().getMaterialDef(m.userData.kubikDef);
  }
  function mk(type, extra) {
    var o = { on: true, type: type, blend: 'normal', colorOn: true, color: '#000000',
              roughOn: false, rough: 0.25, amount: 1, scale: 0.25, detail: 0, contrast: 0.5, seed: 1 };
    for (var q in (extra || {})) o[q] = extra[q];
    return o;
  }
  function shotOf(k, d, masks) {
    d.masks = masks;
    k.updateMaterialEverywhere(d.id);
    k.renderer.render(k.scene, k.camera);
    return k.renderer.domElement.toDataURL('image/png');
  }
  function edgeStats(obj) {
    var e = obj.mesh.geometry.userData.kubikEdges;
    if (!e) return 'NONE';
    var cx = 0, cv = 0;
    for (var i = 0; i < e.kind.length; i++) { if (e.kind[i] === 2) cv++; else cx++; }
    return 'convex:' + cx + ' concave:' + cv;
  }

  // ---- shapes whose answer is known in advance ---------------------------

  // 3x3 verts, four quads EACH ITS OWN GROUP, middle column raised or dropped.
  function foldEditable(h) {
    var pos = [];
    for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) pos.push((c - 1) * 1.0, c === 1 ? h : 0, (r - 1) * 1.0);
    var groups = [];
    for (var rr = 0; rr < 2; rr++) for (var cc = 0; cc < 2; cc++) {
      var a = rr * 3 + cc, b = rr * 3 + cc + 1, d = (rr + 1) * 3 + cc + 1, e = (rr + 1) * 3 + cc;
      groups.push({ triangles: [[a, d, b], [a, e, d]] });
    }
    return { positions: pos, groups: groups };
  }

  // A closed cylinder: n wall quads plus two cap n-gons. At n = 12 the seams
  // are 30 degrees, under the 33 default, so they shade smooth and are NOT
  // edges; at n = 8 they are 45 and they are.
  function tubeEditable(n, h, rad) {
    var pos = [];
    for (var i = 0; i < n; i++) pos.push(Math.cos(i * 2 * Math.PI / n) * rad, -h / 2, Math.sin(i * 2 * Math.PI / n) * rad);
    for (var j = 0; j < n; j++) pos.push(Math.cos(j * 2 * Math.PI / n) * rad, h / 2, Math.sin(j * 2 * Math.PI / n) * rad);
    var groups = [];
    for (var w = 0; w < n; w++) {
      var b0 = w, b1 = (w + 1) % n, t0 = n + w, t1 = n + ((w + 1) % n);
      groups.push({ triangles: [[b0, t0, t1], [b0, t1, b1]] });
    }
    var bot = [], top = [];
    for (var c = 1; c < n - 1; c++) { bot.push([0, c + 1, c]); top.push([n, n + c, n + c + 1]); }
    groups.push({ triangles: bot });
    groups.push({ triangles: top });
    return { positions: pos, groups: groups };
  }

  // An L-shaped face - the shape no fitted model could ever handle.
  function lshapeEditable() {
    return { positions: [0,0,0, 3,0,0, 3,0,1, 1,0,1, 1,0,3, 0,0,3],
             groups: [{ triangles: [[0,2,1],[0,3,2],[0,4,3],[0,5,4]] }] };
  }

  // A plate with a square recess pressed into its top - an inward extrude.
  // The rim of the recess is CONCAVE, the plate's own top edge is CONVEX,
  // and the gap between them (0.2) is inside the field's range (0.3).
  function panEditable(g) {
    var ring = [[-1, 1], [1, 1], [1, -1], [-1, -1]];
    var pos = [];
    for (var a = 0; a < 4; a++) pos.push(ring[a][0], 0, ring[a][1]);            // 0-3  outer top
    for (var b = 0; b < 4; b++) pos.push(ring[b][0] * g, 0, ring[b][1] * g);    // 4-7  rim
    for (var c = 0; c < 4; c++) pos.push(ring[c][0] * g, -0.12, ring[c][1] * g); // 8-11 floor
    for (var e = 0; e < 4; e++) pos.push(ring[e][0], -1, ring[e][1]);           // 12-15 bottom
    var groups = [];
    function quad(a, b, c, d) { groups.push({ triangles: [[a, b, c], [a, c, d]] }); }
    for (var k = 0; k < 4; k++) {
      var n = (k + 1) % 4;
      quad(k, n, 4 + n, 4 + k);              // top ring
      quad(4 + k, 4 + n, 8 + n, 8 + k);      // recess wall
      quad(n, k, 12 + k, 12 + n);            // outer wall
    }
    quad(8, 9, 10, 11);                      // recess floor
    quad(12, 15, 14, 13);                    // bottom
    return { positions: pos, groups: groups };
  }

  /* Reads the baked atlas directly, at one object-space point. Nearest
     voxel, not bilinear - this is asking what the field SAYS, not what the
     shader sees. Returns [convex, concave], both 0..1 of the range. */
  function fieldAt(obj, x, y, z) {
    var f = obj.mesh.geometry.userData.kubikField;
    if (!f) return null;
    var dx = f.dim.x, dy = f.dim.y, dz = f.dim.z;
    var hx = (1 / f.inv.x) / (dx - 1), hy = (1 / f.inv.y) / (dy - 1), hz = (1 / f.inv.z) / (dz - 1);
    function cl(v, m) { return Math.max(0, Math.min(m - 1, Math.round(v))); }
    var i = cl((x - f.min.x) / hx, dx), j = cl((y - f.min.y) / hy, dy), k = cl((z - f.min.z) / hz, dz);
    var tx = (k % f.tiles.x) * dx, ty = Math.floor(k / f.tiles.x) * dy;
    var at = (((ty + j) * f.tex.image.width) + tx + i) * 4;
    var d = f.tex.image.data;
    return [d[at] / 255, d[at + 1] / 255];
  }

  function main() {
    var k = K();
    var id = k.App.activeObjectId;
    if (!id && k.App.selectedObjectIds && k.App.selectedObjectIds.size) id = Array.from(k.App.selectedObjectIds)[0];
    var obj = k.findObject(id);
    log('object', obj ? obj.name : 'NONE id=' + id);
    var d = defOf(obj);

    // ---------- 1. the edge list ----------------------------------------
    log('cube.edges', edgeStats(obj));

    // ---------- 2. pixels, on an exact object mask ----------------------
    d.masks = [];
    k.updateMaterialEverywhere(d.id);
    var base = grab();
    obj.mesh.visible = false;
    var empty = grab();
    obj.mesh.visible = true;
    var mask = objectMask(base, empty);
    log('mask.px', mask.count);
    var mBase = meanIn(base, mask);
    log('mean.nomask', mBase.toFixed(2));

    [0.05, 0.15, 0.4, 1.0].forEach(function (w) {
      d.masks = [mk('edges', { scale: w })];
      k.updateMaterialEverywhere(d.id);
      log('delta.edges@' + w, (meanIn(grab(), mask) - mBase).toFixed(2));
    });

    // a cube has no concave edges at all
    d.masks = [mk('cavity', { scale: 0.4 })];
    k.updateMaterialEverywhere(d.id);
    log('delta.cavity', (meanIn(grab(), mask) - mBase).toFixed(2));

    // blur and noise must both move the result
    d.masks = [mk('edges', { scale: 0.3, contrast: 0 })];
    k.updateMaterialEverywhere(d.id);
    var hard = meanIn(grab(), mask);
    d.masks = [mk('edges', { scale: 0.3, contrast: 1 })];
    k.updateMaterialEverywhere(d.id);
    var soft = meanIn(grab(), mask);
    log('blur.hard-vs-soft', (hard - mBase).toFixed(2) + ' / ' + (soft - mBase).toFixed(2));
    d.masks = [mk('edges', { scale: 0.3, contrast: 0.5, detail: 0.8 })];
    k.updateMaterialEverywhere(d.id);
    log('delta.noisy', (meanIn(grab(), mask) - mBase).toFixed(2));

    // the cloth path must be untouched
    d.masks = [mk('fbm', { scale: 4, detail: 3, contrast: 1.4 })];
    k.updateMaterialEverywhere(d.id);
    k.rebakeMaskTexture(d);
    log('delta.clouds', (meanIn(grab(), mask) - mBase).toFixed(2));

    /* A geometry with no edge list at all is the material preview ball: it
       must read distance ZERO and paint, or a thumbnail shows nothing. */
    d.masks = [mk('edges', { scale: 0.15 })];
    k.updateMaterialEverywhere(d.id);
    var banded = meanIn(grab(), mask);
    delete obj.mesh.geometry.userData.kubikEdges;
    delete obj.mesh.geometry.userData.kubikField;
    log('delta.edges.nofield', (meanIn(grab(), mask) - mBase).toFixed(2) + ' (banded ' + (banded - mBase).toFixed(2) + ')');
    k.applyShading(obj);

    /* ROUNDED EDGES, shading only. No mask at all: the bevel has to pull
       the patch in by itself and it must change the SHADING near the edges,
       which on a lit cube means the mean moves. */
    d.masks = [];
    d.bevel = 0;
    k.updateMaterialEverywhere(d.id);
    var flatG = grab();
    d.bevel = 0.5;
    k.ensureMaskPatches();
    k.updateMaterialEverywhere(d.id);
    grab();                                  // first draw files the uniforms
    var roundG = grab();
    /* Mean ABSOLUTE difference per pixel. A plain mean is useless here: a
       chamfer darkens one side of every edge and brightens the other, so the
       average barely moves whether it works or not. */
    var diff = 0, dn = 0;
    for (var bi = 0; bi < mask.length; bi++) {
      if (!mask[bi]) continue;
      diff += Math.abs(flatG.px[bi * 4] - roundG.px[bi * 4]);
      dn++;
    }
    log('bevel.meanAbsDiff', (dn ? diff / dn : 0).toFixed(2));
    log('bevel.means', meanIn(flatG, mask).toFixed(2) + ' / ' + meanIn(roundG, mask).toFixed(2));
    shots.push(shotOf(k, d, []));
    /* And at the BOTTOM of the slider, which a bad gradient guard silently
       switched off entirely - the numbers at 0.5 looked healthy throughout. */
    d.bevel = 0.06;
    k.ensureMaskPatches();
    k.updateMaterialEverywhere(d.id);
    grab();
    var thinG = grab();
    var diff2 = 0;
    for (var ti = 0; ti < mask.length; ti++) {
      if (!mask[ti]) continue;
      diff2 += Math.abs(flatG.px[ti * 4] - thinG.px[ti * 4]);
    }
    log('bevel.thin@0.06', (dn ? diff2 / dn : 0).toFixed(2));
    d.bevel = 0;
    k.ensureMaskPatches();
    k.updateMaterialEverywhere(d.id);

    shots.push(shotOf(k, d, [mk('edges', { scale: 0.15, contrast: 0.4 })]));
    shots.push(shotOf(k, d, [mk('edges', { scale: 0.35, contrast: 0.8, detail: 0.7 })]));
    d.masks = [];
    k.updateMaterialEverywhere(d.id);

    // ---------- 3. convex vs concave, on a fold whose answer is known ----
    k.rebuildFromEditable(obj, foldEditable(0.5));
    log('fold.up', edgeStats(obj));
    k.rebuildFromEditable(obj, foldEditable(-0.5));
    log('fold.down', edgeStats(obj));
    k.rebuildFromEditable(obj, foldEditable(0));
    log('fold.flat', edgeStats(obj));

    // ---------- 4. an L-shape needs no model any more --------------------
    k.rebuildFromEditable(obj, lshapeEditable());
    log('lshape.edges', edgeStats(obj));

    // ---------- 5. the tube: 12 sides smooth, 8 sides not ----------------
    [12, 8].forEach(function (n) {
      k.rebuildFromEditable(obj, tubeEditable(n, 2, 0.6));
      log('tube' + n + '.edges', edgeStats(obj));
      shots.push(shotOf(k, d, [mk('edges', { scale: 0.3, contrast: 0.5 })]));
      d.masks = [];
      k.updateMaterialEverywhere(d.id);
    });

    // ---------- 6. the field itself --------------------------------------
    k.rebuildFromEditable(obj, tubeEditable(12, 2, 0.6));
    d.masks = [mk('edges', { scale: 0.3 })];
    k.updateMaterialEverywhere(d.id);
    grab();
    var f = obj.mesh.geometry.userData.kubikField;
    log('field.present', !!f);
    if (f) {
      log('field.dim', [f.dim.x, f.dim.y, f.dim.z].join('x') + ' tiles ' + f.tiles.x + 'x' + f.tiles.y);
      log('field.range', f.range.toFixed(3));
      log('field.tex', f.tex.image.width + 'x' + f.tex.image.height);
    }
    d.masks = [];
    k.updateMaterialEverywhere(d.id);

    /* ---------- 7. cavity must not climb out over a convex edge ---------
       Zeghreit's tank: the rust sat correctly in the turret's inward extrude
       AND along the hull's outer top edges, which are not cavities at all.
       The field is a distance through SPACE with no idea where the surface
       goes, so a recess 0.2 away paints straight over the lip between. */
    k.rebuildFromEditable(obj, panEditable(0.8));
    log('pan.edges', edgeStats(obj));
    d.masks = [mk('cavity', { scale: 1 })];
    k.updateMaterialEverywhere(d.id);
    grab();
    var pf = obj.mesh.geometry.userData.kubikField;
    log('pan.range', pf ? pf.range.toFixed(3) : 'NONE');
    [['lip', 0.98, 0, 0], ['justout', 0.85, 0, 0], ['rim', 0.8, 0, 0],
     ['inrecess', 0.7, -0.12, 0], ['farfloor', 0, -0.12, 0],
     ['side', 1.0, -0.5, 0]].forEach(function (q) {
      var v = fieldAt(obj, q[1], q[2], q[3]);
      log('pan.' + q[0], v ? 'convex=' + v[0].toFixed(2) + ' concave=' + v[1].toFixed(2) : 'NONE');
    });
    /* And in pixels. The pan's own mask, cavity at full width: before the
       cross-mask this painted the whole top ring and both outer lips. */
    d.masks = [];
    k.updateMaterialEverywhere(d.id);
    var pBase = grab();
    obj.mesh.visible = false;
    var pEmpty = grab();
    obj.mesh.visible = true;
    var pMask = objectMask(pBase, pEmpty);
    var pM0 = meanIn(pBase, pMask);
    d.masks = [mk('cavity', { scale: 1, contrast: 0.5 })];
    k.updateMaterialEverywhere(d.id);
    log('pan.delta.cavity', (meanIn(grab(), pMask) - pM0).toFixed(2));

    /* From above, where the recess is actually visible. The side view sees
       almost none of it, so its number cannot tell "cavity confined to the
       recess" from "cavity switched off". */
    var camWas = k.camera.position.clone();
    k.camera.position.set(0.4, 3.2, 0.9);
    k.camera.lookAt(0, 0, 0);
    k.camera.updateMatrixWorld();
    d.masks = [];
    k.updateMaterialEverywhere(d.id);
    var tBase = grab();
    obj.mesh.visible = false;
    var tEmpty = grab();
    obj.mesh.visible = true;
    var tMask = objectMask(tBase, tEmpty);
    var tM0 = meanIn(tBase, tMask);
    d.masks = [mk('cavity', { scale: 1, contrast: 0.5 })];
    k.updateMaterialEverywhere(d.id);
    log('pan.top.delta.cavity', (meanIn(grab(), tMask) - tM0).toFixed(2));
    shots.push(shotOf(k, d, [mk('cavity', { scale: 1, contrast: 0.5 })]));
    d.masks = [];
    k.updateMaterialEverywhere(d.id);
    k.camera.position.copy(camWas);
    k.camera.lookAt(0, 0, 0);
    k.camera.updateMatrixWorld();
    shots.push(shotOf(k, d, [mk('cavity', { scale: 1, contrast: 0.5 })]));
    d.masks = [];
    k.updateMaterialEverywhere(d.id);

    /* ---------- 8. one face wound backwards -----------------------------
       Every material is DOUBLE_SIDED, so a face with reversed winding still
       lights correctly and looks perfect. The convexity test reads the
       triangle's own normal, though, so every edge whose first face is that
       one comes back inverted - convex read as concave, cavity in the open.
       "Sometimes, on some edges" is exactly what that looks like. */
    var pe = panEditable(0.8);
    var flipped = { positions: pe.positions, groups: pe.groups.map(function (gp, gi) {
      return gi === 0 ? { triangles: gp.triangles.map(function (t) { return [t[0], t[2], t[1]]; }) } : gp;
    }) };
    k.rebuildFromEditable(obj, flipped);
    log('pan.oneflipped', edgeStats(obj));
    var allflip = { positions: pe.positions, groups: pe.groups.map(function (gp) {
      return { triangles: gp.triangles.map(function (t) { return [t[0], t[2], t[1]]; }) };
    }) };
    k.rebuildFromEditable(obj, allflip);
    log('pan.allflipped', edgeStats(obj));

    log('console.errors', errs.length ? errs.join(' | ').slice(0, 500) : 'none');
  }

  window.addEventListener('error', function (e) { errs.push('onerror: ' + (e.message || e) + ' @' + (e.filename || '') + ':' + (e.lineno || '')); });
  window.addEventListener('unhandledrejection', function (e) { errs.push('rejection: ' + ((e.reason && (e.reason.stack || e.reason.message)) || e.reason)); });

  function ready(cb, tries) {
    tries = tries || 0;
    if (window.__kubik && window.__kubik.renderer && window.__kubik.App) return cb();
    if (tries > 250) {
      out.push('ERROR=__kubik never appeared');
      log('errors', errs.length ? errs.join(' | ').slice(0, 900) : 'none');
      return finish();
    }
    setTimeout(function () { ready(cb, tries + 1); }, 20);
  }

  function finish() {
    var pre = document.createElement('pre');
    pre.id = 'probeOut';
    pre.textContent = '<<<PROBE\n' + out.join('\n') + '\nPROBE>>>';
    document.body.appendChild(pre);
    shots.forEach(function (u, i) {
      var p = document.createElement('pre');
      p.id = 'probeShot' + i;
      p.textContent = u;
      document.body.appendChild(p);
    });
    document.title = 'PROBE-DONE';
  }

  setTimeout(function () {
    ready(function () {
      setTimeout(function () {
        try { main(); } catch (e) { out.push('ERROR=' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' / ') : e)); }
        finish();
      }, 600);
    });
  }, 300);
})();
