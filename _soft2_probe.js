/* Soft mode's UI half: the three-position button, the three-finger slide, and
   the tint that makes the reach visible. */
(function () {
  var out = [], errs = [];
  var _ce = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); _ce.apply(console, arguments); };
  function log(k, v) { out.push(k + '=' + v); }
  var k, A, T3;

  function hub() { return document.getElementById('hubBtn'); }
  function state() { return A.mode + (A.soft ? '+soft' : '') + (hub().classList.contains('soft') ? ' [ring]' : ''); }
  function hudShown() { return document.getElementById('softHud').classList.contains('show'); }
  function lp(obj, l) { return k.logicalPos(obj, l).clone(); }
  function nearestLogical(obj, x, y, z) {
    var t = obj.mesh.userData.topo, best = -1, bd = 1e9, want = new T3.Vector3(x, y, z);
    for (var l = 0; l < t.logicalCount; l++) { var d = lp(obj, l).distanceTo(want); if (d < bd) { bd = d; best = l; } }
    return best;
  }
  // Colour of one vertex dot, as the buffer holds it.
  function dotCol(obj, l) {
    var c = obj.mesh.userData.vertexPoints.geometry.attributes.color.array;
    return [c[l * 3], c[l * 3 + 1], c[l * 3 + 2]];
  }
  function sameCol(a, b) { return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 0.004; }

  // A pointer the tracker will accept, since the gesture reads its own map.
  function down(id, x, y) {
    k.renderer.domElement.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, pointerId: id, pointerType: 'touch', clientX: x, clientY: y, isPrimary: id === 1
    }));
  }
  function move(id, x, y) {
    k.renderer.domElement.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true, pointerId: id, pointerType: 'touch', clientX: x, clientY: y
    }));
  }
  function up(id, x, y) {
    k.renderer.domElement.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true, pointerId: id, pointerType: 'touch', clientX: x, clientY: y
    }));
  }

  function main() {
    k = window.__kubik; A = k.App; T3 = k.THREE;

    /* ---- 1. Three positions, in order, and back round ---- */
    k.setMode('object');
    k.setSoft(false);
    var seen = [state()];
    for (var i = 0; i < 3; i++) { k.cycleEditMode(); seen.push(state()); }
    log('1.cycle', seen.join('  ->  '));
    log('1.returns', seen[3] === seen[0] ? 'back to the start' : 'DOES NOT CYCLE');

    /* ---- 2. Soft does not disturb the component type or the selection ---- */
    k.setMode('object'); k.setSoft(false);
    k.startGeoSetup('plane');
    k.applyGeoParams({ h: 8, v: 8, x: 8, y: 1, z: 8 });
    k.finishGeoSetup(true);
    var grid = k.findObject(A.activeObjectId);
    k.ensureHelpers(grid);
    k.setMode('vertex');
    var centre = nearestLogical(grid, 0, 0, 0);
    var r1 = nearestLogical(grid, 1, 0, 0), r2 = nearestLogical(grid, 2, 0, 0), r4 = nearestLogical(grid, 4, 0, 0);
    A.selectedElements = new Set([centre]);
    k.refreshUI();
    var modeBefore = A.mode, selBefore = A.selectedElements.size;
    k.setSoft(true);
    log('2.mode.kept', A.mode + '/' + A.selectedElements.size + '  want ' + modeBefore + '/' + selBefore);
    log('2.radius.seeded', A.softRadius.toFixed(3) + '  want a quarter of the 8x8 plane diagonal (~2.9)');
    k.setSoft(false);
    log('2.off.keeps', A.mode + '/' + A.selectedElements.size + '  want ' + modeBefore + '/' + selBefore);

    /* ---- 3. The tint follows the weights ---- */
    k.setSoft(true);
    A.softRadius = 3;
    k.refreshSoftField(grid);
    k.refreshElementColors(grid);
    var f = k.softField;
    log('3.field', f ? f.size + ' verts' : 'NONE');
    var cSel = dotCol(grid, centre), c1 = dotCol(grid, r1), c2 = dotCol(grid, r2), cOut = dotCol(grid, r4);
    log('3.selected.full', cSel.map(function (v) { return v.toFixed(2); }).join(','));
    log('3.ring1.vs.ring2', c1.map(function (v) { return v.toFixed(2); }).join(',') + ' vs ' +
      c2.map(function (v) { return v.toFixed(2); }).join(','));
    log('3.graded', (!sameCol(c1, c2) && !sameCol(c1, cOut) && !sameCol(c2, cOut)) ? 'three distinct tints' : 'NOT GRADED');
    log('3.outside.plain', sameCol(cOut, dotCol(grid, nearestLogical(grid, 4, 0, 4))) ? 'yes' : 'NO');

    /* ---- 4. Three fingers slide the radius ---- */
    var r0 = A.softRadius;
    down(1, 300, 400); down(2, 340, 400); down(3, 380, 400);
    log('4.orbit.before', k.orbit.enabled ? 'enabled' : 'disabled');
    move(1, 340, 400); move(2, 380, 400); move(3, 420, 400);   // 40px right
    log('4.engaged', k.softSlide ? 'yes' : 'NO');
    log('4.hud', hudShown() ? 'shown' : 'HIDDEN');
    log('4.orbit.held', k.orbit.enabled ? 'STILL ENABLED' : 'released to the gesture');
    log('4.grew', (A.softRadius > r0) ? 'right = bigger (' + r0.toFixed(2) + ' -> ' + A.softRadius.toFixed(2) + ')' : 'DID NOT GROW');
    move(1, 240, 400); move(2, 280, 400); move(3, 320, 400);   // back past the start
    log('4.shrank', (A.softRadius < r0) ? 'left = smaller (' + A.softRadius.toFixed(2) + ')' : 'DID NOT SHRINK');
    log('4.hud.reads', document.getElementById('softHudV').textContent + ' / ' + document.getElementById('softHudN').textContent);
    up(1, 240, 400); up(2, 280, 400); up(3, 320, 400);
    log('4.ended', k.softSlide ? 'STILL SLIDING' : 'ended');
    log('4.hud.gone', hudShown() ? 'STILL SHOWN' : 'hidden');
    log('4.orbit.back', k.orbit.enabled ? 'enabled' : 'STILL DISABLED');

    /* ---- 5. A three-finger TAP still cycles Free/Axis ---- */
    A.softRadius = 2;
    var tm0 = A.transformMode, rr0 = A.softRadius;
    down(1, 300, 400); down(2, 340, 400); down(3, 380, 400);
    up(1, 300, 400); up(2, 340, 400); up(3, 380, 400);
    log('5.tap.cycles', tm0 + ' -> ' + A.transformMode + (tm0 !== A.transformMode ? '  (still works)' : '  DID NOT CYCLE'));
    log('5.radius.untouched', A.softRadius === rr0 ? 'yes' : 'CHANGED to ' + A.softRadius);
    log('5.no.slide', k.softSlide ? 'ENGAGED ON A TAP' : 'never engaged');

    /* ---- 6. Object mode drops it ---- */
    k.setSoft(true);
    k.setMode('object');
    log('6.object.clears', A.soft ? 'STILL SOFT' : 'soft off');
    k.cycleEditMode();
    log('6.back.in', state() + '  want vertex, no ring (Component, not Soft)');

    /* ---- 7. Soft with nothing selected is harmless ---- */
    k.setSoft(true);
    A.selectedElements.clear();
    k.refreshSoftField(grid);
    k.refreshElementColors(grid);
    log('7.empty.field', k.softField === null ? 'null' : 'NOT NULL');
    log('7.hud.text', (k.refreshSoftHud(), document.getElementById('softHudN').textContent));

    /* ---- 8. THE CONTROL for the console noise ----

       Synthetic pointer events are never really captured, so OrbitControls'
       own pointerup - which is not guarded by `enabled` - throws when it
       releases a capture it never took. That has nothing to do with soft
       mode; this proves it by doing the same three-finger press and release
       with Soft OFF, where none of the new code runs at all. A real finger IS
       captured, so the release succeeds. */
    var before = errs.length;
    k.setSoft(false);
    down(1, 300, 400); down(2, 340, 400); down(3, 380, 400);
    move(1, 340, 400); move(2, 380, 400); move(3, 420, 400);
    up(1, 340, 400); up(2, 380, 400); up(3, 420, 400);
    log('8.control.soft.off', (errs.length - before) + ' of the same errors with Soft OFF' +
      ((errs.length - before) > 0 ? '  (so they are the harness, not the feature)' : '  (SO THEY ARE MINE)'));
    log('8.orbit.after', k.orbit.enabled ? 'enabled' : 'STILL DISABLED');

    log('final.winding', k.windingAudit().every(function (x) { return x.ok; }) ? 'all ok' : 'BROKEN');
    log('console.errors', errs.length ? errs.length + ': ' + errs.join(' | ').slice(0, 200) : 'none');
  }

  window.addEventListener('error', function (e) { errs.push('onerror: ' + (e.message || e) + ' @' + (e.lineno || '')); });
  function finish() {
    var pre = document.createElement('pre');
    pre.id = 'probeOut';
    pre.textContent = '<<<PROBE\n' + out.join('\n') + '\nPROBE>>>';
    document.body.appendChild(pre);
    document.title = 'PROBE-DONE';
  }
  function ready(t) {
    t = t || 0;
    if (window.__kubik && window.__kubik.App) {
      return setTimeout(function () {
        try { main(); } catch (e) { out.push('ERROR=' + (e && e.stack ? e.stack.split('\n').slice(0, 5).join(' / ') : e)); }
        finish();
      }, 700);
    }
    if (t > 250) { out.push('ERROR=no __kubik'); return finish(); }
    setTimeout(function () { ready(t + 1); }, 20);
  }
  setTimeout(function () { ready(); }, 300);
})();
