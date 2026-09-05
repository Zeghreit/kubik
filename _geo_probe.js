/* Add geo, driven the way a finger drives it: bloom the chooser, aim, close
   the ring, work the bar, and check what the scene and the history actually
   hold afterwards. Everything here goes through the same entry points the
   ring and the bar call - nothing is reimplemented. */
(function () {
  var out = [], errs = [];
  var _ce = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); _ce.apply(console, arguments); };
  function log(k, v) { out.push(k + '=' + v); }
  function K() { return window.__kubik; }

  var k, A;
  var steps = [], si = 0;
  function step(fn) { steps.push(fn); }

  // Where an item of the open ring sits on screen, so aiming at it is aiming
  // at the real thing rather than at a guessed angle.
  function aimAt(key) {
    var el = document.querySelector('#touchToolRing .hub-item[data-key="' + key + '"]');
    if (!el) return null;
    var r = el.getBoundingClientRect();
    return { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
  }
  function ringCentre() {
    var r = document.getElementById('touchToolRing').getBoundingClientRect();
    return { clientX: r.left, clientY: r.top };
  }
  function barShown() { return document.getElementById('geoBar').classList.contains('show'); }
  function txt(id) { return (document.getElementById(id).textContent || '').trim(); }
  function vis(id) { return document.getElementById(id).style.display !== 'none'; }
  function faces() {
    var o = k.findObject(A.geoSetup ? A.geoSetup.objId : A.activeObjectId);
    return o ? o.mesh.userData.topo.faceGroups.length : -1;
  }

  var h0, n0;

  step(function () {
    k = K(); A = k.App;
    // The world ring carries Add geo now, and so does the empty-scene ring.
    log('world.addgeo', k.HUB_TOOLS_WORLD.some(function (t) { return t.key === 'addgeo'; }) &&
      !k.HUB_TOOLS_WORLD.some(function (t) { return t.key === 'addcube'; }) ? 'yes' : 'NO');
    log('geo.ring.items', k.HUB_TOOLS_GEO.map(function (t) { return t.key; }).join(','));
    n0 = A.objects.length; h0 = A.historyIndex;
    k.openGeoRing();
  });

  // openGeoRing defers a tick, so the ring is only there on the next turn.
  step(function () {
    var items = document.querySelectorAll('#touchToolRing .hub-item');
    log('ring.bloomed', items.length + ' items');
    log('ring.sticky', document.querySelector('#touchToolRing .hub-item[data-key="geotorus"]') ? 'yes' : 'NO');
    // Aiming a long way past the items means "none of these".
    var c = ringCentre();
    k.updateToolRingHover({ clientX: c.clientX + 600, clientY: c.clientY });
    var lab = document.getElementById('ringLabel');
    log('ring.outer.cancel', (lab && lab.classList.contains('show')) ? 'STILL HIGHLIGHTED' : 'clears');
    // And aiming at an item picks it.
    var a = aimAt('geocyl');
    log('ring.aim.found', a ? 'yes' : 'NO');
    k.updateToolRingHover(a);
    log('ring.aim.label', txt('ringLabel'));
    k.closeToolRing(true);
  });

  step(function () {
    log('setup.open', A.geoSetup ? A.geoSetup.kind : 'NONE');
    log('setup.bar', barShown() ? 'shown' : 'HIDDEN');
    log('setup.label', txt('geoLabel') + ' / ' + txt('geoHCap') + ' / ' + txt('geoVCap'));
    log('setup.objects', A.objects.length + ' (was ' + n0 + ')');
    log('setup.history', A.historyIndex + ' (was ' + h0 + ')');
    log('setup.faces', faces() + '  want 14 (12 sides + 2 caps)');
    log('setup.selected', A.selectedObjectIds.has(A.geoSetup.objId) ? 'yes' : 'NO');
    var o = k.findObject(A.geoSetup.objId);
    log('setup.name', o.name);
    log('setup.pos', o.mesh.position.toArray().map(function (v) { return v.toFixed(2); }).join(',') + '  want 0.00,0.00,0.00');

    // Steppers rebuild the shape in place.
    k.geoStep('h', 1); k.geoStep('h', 1);
    log('step.h', txt('geoHVal') + '  faces ' + faces() + '  want 14 faces->16');
    k.geoStep('v', 1);
    log('step.v', txt('geoVVal') + '  faces ' + faces() + '  want 30');
    log('step.winding', k.auditWinding(k.findObject(A.geoSetup.objId)).ok ? 'ok' : 'BROKEN');

    // The clamp holds at the floor however hard the stepper is pressed.
    for (var i = 0; i < 30; i++) k.geoStep('h', -1);
    log('step.clamp.lo', txt('geoHVal') + '  want 3 (cylinder hMin)');
    for (i = 0; i < 200; i++) k.geoStep('h', 1);
    log('step.clamp.hi', txt('geoHVal') + '  want 64');
    k.applyGeoParams({ h: 12, v: 1, x: 1, y: 1, z: 1 });

    // A size typed into a field, and a size that cannot be built.
    k.applyGeoParams({ h: 12, v: 1, x: 2, y: 3, z: 2 });
    var t = k.findObject(A.geoSetup.objId).mesh.userData.topo;
    var pa = k.findObject(A.geoSetup.objId).mesh.geometry.attributes.position;
    var lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    for (i = 0; i < pa.count; i++) {
      var c2 = [pa.getX(i), pa.getY(i), pa.getZ(i)];
      for (var d = 0; d < 3; d++) { if (c2[d] < lo[d]) lo[d] = c2[d]; if (c2[d] > hi[d]) hi[d] = c2[d]; }
    }
    log('size.y', (hi[1] - lo[1]).toFixed(3) + '  want 3.000');
    k.applyGeoParams({ h: 12, v: 1, x: 0, y: -5, z: 1 });
    log('size.clamp', JSON.stringify(A.geoSetup.params));

    // Done: exactly one step, and the object stays.
    k.finishGeoSetup(true);
    log('done.setup', A.geoSetup ? 'STILL OPEN' : 'closed');
    log('done.bar', barShown() ? 'STILL SHOWN' : 'hidden');
    log('done.objects', A.objects.length + ' (want ' + (n0 + 1) + ')');
    log('done.history', (A.historyIndex - h0) + ' step(s), want 1');
    k.undo();
    log('undo.removes', A.objects.length + ' (want ' + n0 + ')');
    k.redo();
    log('redo.restores', A.objects.length + ' (want ' + (n0 + 1) + ')');
  });

  // A plane: no Y field, and it sits on the floor.
  step(function () {
    n0 = A.objects.length; h0 = A.historyIndex;
    k.startGeoSetup('plane');
    log('plane.caps', txt('geoLabel') + ' / ' + txt('geoHCap') + ' / ' + txt('geoVCap'));
    log('plane.yfield', vis('geoYField') ? 'SHOWN' : 'hidden');
    log('plane.pos', k.findObject(A.geoSetup.objId).mesh.position.toArray().join(',') + '  want 0,0,0');
    // All five arrive at the origin, whatever is already standing there.
    var origins = ['cube', 'cylinder', 'sphere', 'torus', 'plane'].map(function (kind) {
      k.finishGeoSetup(false);
      k.startGeoSetup(kind);
      var p = k.findObject(A.geoSetup.objId).mesh.position;
      return kind + ':' + (p.x === 0 && p.y === 0 && p.z === 0 ? 'origin' : p.toArray().join(','));
    });
    log('spawn.all', origins.join('  '));
    k.finishGeoSetup(false);
    k.startGeoSetup('plane');
    k.geoStep('h', 2); k.geoStep('v', 1);
    log('plane.faces', faces() + '  want 6');
    // Tapping the shape itself is not "outside" - the setup stays open.
    var o = k.findObject(A.geoSetup.objId);
    /* worldToScreenPx answers in VIEWPORT pixels; handleTap reads clientX /
       clientY. The viewport sits below the top bar, so a tap fed the raw
       projection lands ~44px above what it was aimed at - which reads
       exactly like the shape not being pickable. Harness, not app. */
    var vr = document.getElementById('viewport').getBoundingClientRect();
    /* Somewhere nothing else stands. Every primitive now arrives at the
       ORIGIN, where the scene's opening cube already is, so a tap on the new
       plane's centre hits that cube instead - which is the intended
       behaviour, and not what this line is testing. */
    o.mesh.position.set(4.5, 0, 4.5);
    o.mesh.updateMatrixWorld(true);
    var sp = k.worldToScreenPx(o.mesh.position.clone());
    log('tap.aim', sp ? (sp.x + vr.left).toFixed(0) + ',' + (sp.y + vr.top).toFixed(0) : 'BEHIND CAMERA');
    log('tap.hits', (function () {
      var h = k.pickObjectAt({ clientX: sp.x + vr.left, clientY: sp.y + vr.top });
      return h ? h.name : 'nothing';
    })());
    k.handleTap({ clientX: sp ? sp.x + vr.left : 5, clientY: sp ? sp.y + vr.top : 5, shiftKey: false });
    log('tap.on.shape', A.geoSetup ? 'stays open' : 'CANCELLED');
    // A tap that misses throws it away, and nothing reaches the history.
    k.handleTap({ clientX: 4, clientY: 4, shiftKey: false });
    log('tap.outside', A.geoSetup ? 'STILL OPEN' : 'cancelled');
    log('tap.objects', A.objects.length + ' (want ' + n0 + ')');
    log('tap.history', (A.historyIndex - h0) + ' step(s), want 0');
    log('tap.bar', barShown() ? 'STILL SHOWN' : 'hidden');
  });

  // Undo, with a setup open, takes back the primitive rather than the last
  // real edit - there is no step for it to step back to.
  step(function () {
    n0 = A.objects.length; h0 = A.historyIndex;
    k.startGeoSetup('sphere');
    log('sphere.faces', faces() + '  want 128 (16x8)');
    k.undo();
    log('undo.setup', A.geoSetup ? 'STILL OPEN' : 'cancelled');
    log('undo.objects', A.objects.length + ' (want ' + n0 + ')');
    log('undo.history', (A.historyIndex - h0) + ' (want 0)');

    // Reaching for another ring accepts what was being dialled in.
    k.startGeoSetup('torus');
    var id = A.geoSetup.objId;
    k.bloomToolRing(300, 300, k.HUB_TOOLS_WORLD, undefined, null);
    log('ring.commits', A.geoSetup ? 'STILL OPEN' : 'committed');
    log('ring.kept', k.findObject(id) ? 'yes' : 'NO');
    log('ring.history', (A.historyIndex - h0) + ' step(s), want 1');
    k.closeToolRing(false);

    // And switching mode does the same.
    n0 = A.objects.length; h0 = A.historyIndex;
    k.startGeoSetup('cube');
    k.setMode('vertex');
    log('mode.commits', A.geoSetup ? 'STILL OPEN' : 'committed');
    log('mode.objects', A.objects.length + ' (want ' + (n0 + 1) + ')');
    k.setMode('object');

    log('final.winding', k.windingAudit().every(function (w) { return w.ok; }) ? 'all ok' : 'BROKEN');
    log('console.errors', errs.length ? errs.join(' | ').slice(0, 400) : 'none');
  });

  window.addEventListener('error', function (e) { errs.push('onerror: ' + (e.message || e) + ' @' + (e.lineno || '')); });
  function finish() {
    var pre = document.createElement('pre');
    pre.id = 'probeOut';
    pre.textContent = '<<<PROBE\n' + out.join('\n') + '\nPROBE>>>';
    document.body.appendChild(pre);
    document.title = 'PROBE-DONE';
  }
  function run() {
    if (si >= steps.length) return finish();
    try { steps[si++](); } catch (e) {
      out.push('ERROR@' + (si - 1) + '=' + (e && e.stack ? e.stack.split('\n').slice(0, 4).join(' / ') : e));
      return finish();
    }
    setTimeout(run, 120);
  }
  function ready(t) {
    t = t || 0;
    if (window.__kubik && window.__kubik.App) return setTimeout(run, 600);
    if (t > 250) { out.push('ERROR=no __kubik'); return finish(); }
    setTimeout(function () { ready(t + 1); }, 20);
  }
  setTimeout(function () { ready(); }, 300);
})();
