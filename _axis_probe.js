/* a2.55 - an object-mode axis scale must not shear a rotated object.

   The failing case is arithmetic, not opinion: GIZMO_AXES are WORLD axes, and
   a world-axis scale times a rotated object's matrix has non-orthogonal
   columns. Object3D holds position, quaternion and scale, so decompose has
   nowhere to put the shear and invents a rotation instead - the cube grows on
   two axes and twists.

   Every assertion below is an INVARIANT of any correct axis scale, so none of
   them depends on which axis the gesture happened to name. */
(function () {
  var out = [], errs = [];
  var _ce = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); _ce.apply(console, arguments); };
  function log(k, v) { out.push(k + '=' + v); }
  var k, A, T3;

  function cols(mesh) {
    mesh.updateMatrixWorld(true);
    var m = mesh.matrixWorld, c = [];
    for (var i = 0; i < 3; i++) c.push(new T3.Vector3().setFromMatrixColumn(m, i));
    return c;
  }
  /* Columns at right angles. Kept for completeness, but it is NOT the test:
     decompose cannot PRODUCE a sheared matrix - it forces an orthonormal
     basis and pushes the remainder into the quaternion - so this reads 0
     either way. The shear shows up as `rotation_held` failing and a second
     scale component moving. Measured against a2.54: 2 of 3 components
     changed and the cube twisted 5.12 degrees, with skew still 0. */
  function skew(mesh) {
    var c = cols(mesh), worst = 0;
    [[0, 1], [0, 2], [1, 2]].forEach(function (p) {
      var a = c[p[0]].clone().normalize(), b = c[p[1]].clone().normalize();
      worst = Math.max(worst, Math.abs(a.dot(b)));
    });
    return worst;
  }
  function scaleOf(mesh) { return [mesh.scale.x, mesh.scale.y, mesh.scale.z]; }
  function changed(a, b) {
    var n = 0;
    for (var i = 0; i < 3; i++) if (Math.abs(a[i] - b[i]) > 1e-4) n++;
    return n;
  }
  function ev(x, y) {
    return { clientX: x, clientY: y, pointerId: 1, pointerType: 'touch' };
  }

  function main() {
    k = window.__kubik; A = k.App; T3 = k.THREE;
    var obj = A.objects[0];

    /* ---- 1. A cube turned 45 degrees, scaled on one axis ---- */
    k.setMode('object');
    A.selectedObjectIds = new Set([obj.id]);
    A.activeObjectId = obj.id;
    obj.mesh.rotation.set(0, Math.PI / 4, 0);
    obj.mesh.scale.set(1, 1, 1);
    obj.mesh.updateMatrixWorld(true);
    var q0 = obj.mesh.quaternion.clone();
    var s0 = scaleOf(obj.mesh);
    log('1.skew_before', skew(obj.mesh).toFixed(6) + '  (0 = the columns are square)');

    k.setTransformTool('scale');
    A.transformMode = 'axis';
    k.beginDirectDrag(ev(450, 350));
    k.updateDirectDrag(ev(600, 350));      // well past the decide threshold
    k.updateDirectDrag(ev(640, 350));
    var d = k.directDrag;
    log('1.axis_named', d && d.axis ? d.axis.key : 'NONE CHOSEN');
    log('1.axis_is_the_objects_own', d && d.axis && d.axis.local !== undefined
      ? 'yes - column ' + d.axis.local + ' of the object' : 'NO - A WORLD AXIS');
    var s1 = scaleOf(obj.mesh);
    log('1.one_component', changed(s0, s1) + ' of 3 scale components changed  (must be 1)');
    log('1.scale_now', s1.map(function (n) { return n.toFixed(3); }).join(', '));
    log('1.rotation_held', obj.mesh.quaternion.angleTo(q0) < 1e-6
      ? 'unchanged' : 'TWISTED by ' + (obj.mesh.quaternion.angleTo(q0) * 180 / Math.PI).toFixed(2) + ' deg');
    log('1.skew_after', skew(obj.mesh).toFixed(6) + '  (must still be 0)');
    k.endDirectDrag();

    /* ---- 2. The guide draws the axis that is actually being used ----
       For a 45-degree turn about Y, the object's own X and Z lie at 45
       degrees to the world's, so |dot| with world X is cos(45). */
    k.beginDirectDrag(ev(450, 350));
    k.updateDirectDrag(ev(600, 350));
    var d2 = k.directDrag;
    if (d2 && d2.axis) {
      var dot = Math.abs(d2.axis.dir.dot(new T3.Vector3(1, 0, 0)));
      var expect = (d2.axis.key === 'y') ? 0 : Math.SQRT1_2;
      log('2.guide_axis', 'axis ' + d2.axis.key + ', |dot with world X| = ' + dot.toFixed(4) +
        '  (want ' + expect.toFixed(4) + ' - the object\'s own axis, not the world\'s)');
    } else { log('2.guide_axis', 'NO AXIS'); }
    k.endDirectDrag();

    /* ---- 3. Two objects at different angles each take their own ---- */
    A.selectedObjectIds = new Set([obj.id]);
    k.duplicateSelection();
    var two = A.objects.length > 1;
    if (two) {
      var b = A.objects[A.objects.length - 1];
      b.mesh.rotation.set(0, -Math.PI / 6, 0);
      b.mesh.scale.set(1, 1, 1);
      obj.mesh.rotation.set(0, Math.PI / 4, 0);
      obj.mesh.scale.set(1, 1, 1);
      A.selectedObjectIds = new Set([obj.id, b.id]);
      A.activeObjectId = obj.id;
      var qa = obj.mesh.quaternion.clone(), qb = b.mesh.quaternion.clone();
      var sa0 = scaleOf(obj.mesh), sb0 = scaleOf(b.mesh);
      k.beginDirectDrag(ev(450, 350));
      k.updateDirectDrag(ev(620, 350));
      k.updateDirectDrag(ev(660, 350));
      log('3.both_one_component', changed(sa0, scaleOf(obj.mesh)) + ' and ' +
        changed(sb0, scaleOf(b.mesh)) + '  (must be 1 and 1)');
      log('3.both_held', (obj.mesh.quaternion.angleTo(qa) < 1e-6 && b.mesh.quaternion.angleTo(qb) < 1e-6)
        ? 'neither twisted' : 'A TWIST GOT IN');
      log('3.both_square', skew(obj.mesh).toFixed(6) + ' / ' + skew(b.mesh).toFixed(6) + '  (both 0)');
      k.endDirectDrag();
    } else { log('3.two_objects', 'could not add a second object'); }

    /* ---- 4. Move and rotate keep WORLD axes ----
       Nothing about them needs the object's own frame: a world-axis
       translation or rotation composes into a matrix with no remainder. */
    A.selectedObjectIds = new Set([obj.id]);
    A.activeObjectId = obj.id;
    k.setTransformTool('move');
    k.beginDirectDrag(ev(450, 350));
    k.updateDirectDrag(ev(600, 350));
    var dm = k.directDrag;
    log('4.move_axis_is_world', dm && dm.axis && dm.axis.local === undefined
      ? 'world (' + dm.axis.key + ')' : 'NOT WORLD');
    k.endDirectDrag();
    k.setTransformTool('rotate');
    k.beginDirectDrag(ev(450, 350));
    k.updateDirectDrag(ev(600, 350));
    var dr = k.directDrag;
    log('4.rotate_axis_is_world', dr && dr.axis && dr.axis.local === undefined
      ? 'world (' + dr.axis.key + ')' : 'NOT WORLD');
    k.endDirectDrag();

    /* ---- 5. The helper on its own, where the arithmetic is visible ---- */
    var M = new T3.Matrix4().compose(
      new T3.Vector3(0, 0, 0),
      new T3.Quaternion().setFromAxisAngle(new T3.Vector3(0, 1, 0), Math.PI / 4),
      new T3.Vector3(1, 1, 1));
    var own = new T3.Vector3().setFromMatrixColumn(M, 0).normalize();
    var G = k.scaleAlongDir(own, 2);
    var R = new T3.Matrix4().multiplyMatrices(G, M);
    var p = new T3.Vector3(), q = new T3.Quaternion(), sc = new T3.Vector3();
    R.decompose(p, q, sc);
    log('5.local_axis_scale', 'scale ' + sc.x.toFixed(4) + ', ' + sc.y.toFixed(4) + ', ' + sc.z.toFixed(4) +
      '  (want 2, 1, 1)');
    var world = k.scaleAlongDir(new T3.Vector3(1, 0, 0), 2);
    var Rw = new T3.Matrix4().multiplyMatrices(world, M);
    Rw.decompose(p, q, sc);
    log('5.world_axis_scale', 'scale ' + sc.x.toFixed(4) + ', ' + sc.y.toFixed(4) + ', ' + sc.z.toFixed(4) +
      '  (the OLD behaviour: two components move, and a twist appears)');

    /* ---- 6. The TOOL can change under a drag the axis is already frozen in.
       `s` on the keyboard during a live Move drag used to hand the scale
       branch a WORLD axis with no tag, straight back into the shear. Review
       round 1. ---- */
    A.selectedObjectIds = new Set([obj.id]);
    A.activeObjectId = obj.id;
    obj.mesh.rotation.set(0, Math.PI / 4, 0);
    obj.mesh.scale.set(1, 1, 1);
    obj.mesh.updateMatrixWorld(true);
    k.setTransformTool('move');
    A.transformMode = 'axis';
    k.beginDirectDrag(ev(450, 350));
    k.updateDirectDrag(ev(600, 350));        // commits a WORLD axis, under Move
    var q6 = obj.mesh.quaternion.clone(), s6 = scaleOf(obj.mesh);
    k.setTransformTool('scale');             // ...and the tool changes under it
    k.updateDirectDrag(ev(660, 350));
    log('6.tool_switched_mid_drag', changed(s6, scaleOf(obj.mesh)) +
      ' of 3 scale components changed  (must be 1 - the world axis it was holding' +
      ' has to be read as the object\'s own column)');
    log('6.no_twist', obj.mesh.quaternion.angleTo(q6) < 1e-6
      ? 'no twist' : 'TWISTED by ' + (obj.mesh.quaternion.angleTo(q6) * 180 / Math.PI).toFixed(2) + ' deg');
    k.endDirectDrag();

    /* ---- 7. One flattened object must not shear the healthy ones ----
       transformAxes reads its axes off the FIRST entry. If that one is scaled
       flat on the named axis it has no direction to offer - and an untagged
       fallback sent the whole selection down the world path. ---- */
    var flat = A.objects[A.objects.length - 1];
    flat.mesh.rotation.set(0, 0, 0);
    flat.mesh.scale.set(1e-7, 1, 1);
    obj.mesh.rotation.set(0, Math.PI / 4, 0);
    obj.mesh.scale.set(1, 1, 1);
    flat.mesh.updateMatrixWorld(true); obj.mesh.updateMatrixWorld(true);
    // The flat one FIRST, so it is the reference.
    A.selectedObjectIds = new Set([flat.id, obj.id]);
    A.activeObjectId = null;
    var q7 = obj.mesh.quaternion.clone(), s7 = scaleOf(obj.mesh), f7 = scaleOf(flat.mesh);
    k.setTransformTool('scale');
    k.beginDirectDrag(ev(450, 350));
    k.updateDirectDrag(ev(620, 350));
    k.updateDirectDrag(ev(660, 350));
    log('7.healthy_object', changed(s7, scaleOf(obj.mesh)) + ' of 3 changed on the rotated cube  (must be 1)');
    log('7.healthy_no_twist', obj.mesh.quaternion.angleTo(q7) < 1e-6
      ? 'no twist' : 'TWISTED by ' + (obj.mesh.quaternion.angleTo(q7) * 180 / Math.PI).toFixed(2) + ' deg');
    log('7.flat_held', changed(f7, scaleOf(flat.mesh)) === 0
      ? 'the flattened one took no scale on the axis it is flat on' : 'the flat one moved');
    k.endDirectDrag();

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
        try { main(); } catch (e) {
          out.push('ERROR=' + (e && e.stack ? e.stack.split('\n').slice(0, 6).join(' / ') : e));
        }
        finish();
      }, 600);
    });
  }, 300);
})();
