/* a2.51 - Grow / Shrink as the three-finger slide. */
(function () {
  var out = [], errs = [];
  var _ce = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); _ce.apply(console, arguments); };
  function log(k2, v) { out.push(k2 + '=' + v); }
  var k, A, T3, grid, centre;

  function hudShown() { return document.getElementById('softHud').classList.contains('show'); }
  function sel() { return Array.from(A.selectedElements).sort(function (a, b) { return a - b; }).join(','); }
  function lp(obj, l) { return k.logicalPos(obj, l).clone(); }
  function nearestLogical(obj, x, y, z) {
    var t = obj.mesh.userData.topo, best = -1, bd = 1e9, want = new T3.Vector3(x, y, z);
    for (var l = 0; l < t.logicalCount; l++) { var d = lp(obj, l).distanceTo(want); if (d < bd) { bd = d; best = l; } }
    return best;
  }
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
  // Three fingers land side by side; hand(dx) slides all three together.
  var HX = [300, 340, 380], HY = 400;
  function land() { down(1, HX[0], HY); down(2, HX[1], HY); down(3, HX[2], HY); }
  function hand(dx) { move(1, HX[0] + dx, HY); move(2, HX[1] + dx, HY); move(3, HX[2] + dx, HY); }
  function lift(dx) { up(1, HX[0] + dx, HY); up(2, HX[1] + dx, HY); up(3, HX[2] + dx, HY); }

  function main() {
    k = window.__kubik; A = k.App; T3 = k.THREE;
    // A level is crossed at 0.7 of a step (64px) either side of a boundary, so
    // 70px of travel is level 1 and 140px is level 2. 30px engages: past both
    // the 16px slide threshold and the 24px sideways one.
    var STEP = 70, ENGAGE = 30;

    /* ---- 1. The ring items are gone, in all three component rings ---- */
    var keysIn = function (arr) { return arr.map(function (t) { return t.key; }); };
    var stray = [];
    [['vertex', k.HUB_TOOLS_VERTEX], ['edge', k.HUB_TOOLS_EDGE], ['face', k.HUB_TOOLS_FACE]]
      .forEach(function (p) {
        keysIn(p[1]).forEach(function (key) { if (key === 'grow' || key === 'shrink') stray.push(p[0] + '.' + key); });
      });
    log('1.rings.clean', stray.length ? 'STILL THERE: ' + stray.join(' ') : 'no grow/shrink item in any component ring');
    var seats = k.HUB_TOOLS_EDGE.map(function (t) { return t.seat; });
    log('1.seats.free', (seats.indexOf(12) < 0 && seats.indexOf(13) < 0) ? '12 and 13 are free' : 'SEAT STILL TAKEN');

    /* ---- 2. The commands still work (the keyboard still calls them) ---- */
    k.setMode('object'); k.setSoft(false);
    k.startGeoSetup('plane');
    k.applyGeoParams({ h: 8, v: 8, x: 8, y: 1, z: 8 });
    k.finishGeoSetup(true);
    grid = k.findObject(A.activeObjectId);
    k.ensureHelpers(grid);
    k.setMode('vertex');
    centre = nearestLogical(grid, 0, 0, 0);
    A.selectedElements = new Set([centre]); k.refreshUI();
    k.growSelection();
    var g1 = A.selectedElements.size;
    k.growSelection();
    var g2 = A.selectedElements.size;
    k.shrinkSelection();
    log('2.commands', '1 -> ' + g1 + ' -> ' + g2 + ' -> ' + A.selectedElements.size +
      '  (want 1 -> 5 -> 13 -> 5)');

    /* ---- 3. The slide engages, and right grows ---- */
    A.selectedElements = new Set([centre]); k.refreshUI();
    k.growSelection(); k.growSelection();          // a 13-vertex diamond to work from
    var base = sel(), baseN = A.selectedElements.size;
    var h0 = A.historyIndex;
    land();
    log('3.orbit.before', k.orbit.enabled ? 'enabled' : 'disabled');
    hand(ENGAGE);
    log('3.engaged', k.softSlide ? 'yes, kind=' + k.softSlide.kind : 'NO');
    if (k.softSlide) k.selSlideRebase();   // zero it where the settled hand is
    log('3.level0', k.softSlide ? k.softSlide.level : '-');
    log('3.unchanged.at.0', sel() === base ? 'still exactly what was picked' : 'CHANGED AT LEVEL 0');
    log('3.hud', hudShown() ? 'shown' : 'HIDDEN');
    log('3.orbit.held', k.orbit.enabled ? 'STILL ENABLED' : 'released to the gesture');
    hand(ENGAGE + STEP);
    var lv1 = k.softSlide ? k.softSlide.level : 0, n1 = A.selectedElements.size;
    hand(ENGAGE + STEP * 2);
    var lv2 = k.softSlide ? k.softSlide.level : 0, n2 = A.selectedElements.size;
    log('3.grows', baseN + ' -> ' + n1 + ' (level ' + lv1 + ') -> ' + n2 + ' (level ' + lv2 + ')' +
      '  (levels must be 1 then 2, counts must rise)');
    log('3.hud.reads', document.getElementById('softHudK').textContent + ' ' +
      document.getElementById('softHudV').textContent + ' / ' + document.getElementById('softHudN').textContent);

    /* ---- 4. THE POINT: sliding back to 0 returns the ORIGINAL set ---- */
    hand(ENGAGE);
    log('4.back.to.0', (k.softSlide && k.softSlide.level === 0) ? 'level 0' : 'LEVEL ' + (k.softSlide && k.softSlide.level));
    log('4.identical', sel() === base ? 'the same ' + baseN + ' vertices, exactly' : 'DIFFERENT SET');

    /* ---- 5. Left shrinks, from the same snapshot ---- */
    hand(ENGAGE - STEP);
    var lvm1 = k.softSlide ? k.softSlide.level : 0, m1 = A.selectedElements.size;
    hand(ENGAGE - STEP * 2);
    var lvm2 = k.softSlide ? k.softSlide.level : 0, m2 = A.selectedElements.size;
    log('5.shrinks', baseN + ' -> ' + m1 + ' (level ' + lvm1 + ') -> ' + m2 + ' (level ' + lvm2 + ')' +
      '  (want 13 -> 5 -> 1, levels -1 then -2)');
    // One event may cross at most 3 levels, so walk it down rather than flinging.
    for (var st = 3; st <= 9; st++) hand(ENGAGE - STEP * st);
    log('5.saturates', 'level ' + (k.softSlide && k.softSlide.level) + ', ' + A.selectedElements.size +
      ' left  (must not hang, must not go negative)');
    // Back out the same way: one pointer event may cross at most 3 levels.
    for (var st2 = 9; st2 >= 0; st2--) hand(ENGAGE - STEP * st2);
    log('5.returns.again', sel() === base ? 'back to the same ' + baseN : 'DIFFERENT SET');

    /* ---- 6. It ends, and it is not an edit ---- */
    lift(ENGAGE);
    log('6.ended', k.softSlide ? 'STILL SLIDING' : 'ended');
    log('6.hud.gone', hudShown() ? 'STILL SHOWN' : 'hidden');
    log('6.orbit.back', k.orbit.enabled ? 'enabled' : 'STILL DISABLED');
    log('6.no.history', A.historyIndex === h0 ? 'no step pushed (a selection is not an edit)' :
      'PUSHED ' + (A.historyIndex - h0));

    /* ---- 7. A three-finger TAP still cycles Free/Axis ---- */
    var tm0 = A.transformMode, s0 = sel();
    land(); lift(0);
    log('7.tap.cycles', tm0 + ' -> ' + A.transformMode + (tm0 !== A.transformMode ? '  (still works)' : '  DID NOT CYCLE'));
    log('7.selection.untouched', sel() === s0 ? 'yes' : 'CHANGED ON A TAP');

    /* ---- 8. With Soft ON the same gesture still sizes the falloff ---- */
    k.setSoft(true);
    var r0 = A.softRadius, s8 = sel();
    land(); hand(ENGAGE); hand(ENGAGE + STEP * 2);
    log('8.soft.kind', k.softSlide ? k.softSlide.kind : 'NOT ENGAGED');
    log('8.soft.radius', A.softRadius > r0 ? 'grew ' + r0.toFixed(2) + ' -> ' + A.softRadius.toFixed(2) : 'DID NOT GROW');
    log('8.soft.selection', sel() === s8 ? 'selection untouched' : 'SELECTION MOVED UNDER SOFT');
    lift(ENGAGE + STEP * 2);
    k.setSoft(false);

    /* ---- 9. Nothing selected: the camera keeps the gesture ---- */
    A.selectedElements.clear(); k.refreshUI();
    log('9.allowed', k.selSlideAllowed() ? 'ALLOWED WITH NOTHING SELECTED' : 'refused');
    land(); hand(ENGAGE + STEP);
    log('9.engaged', k.softSlide ? 'ENGAGED ANYWAY' : 'never engaged');
    log('9.orbit', k.orbit.enabled ? 'camera still has it' : 'ORBIT KILLED FOR NOTHING');
    lift(ENGAGE + STEP);

    /* ---- 10. Not under a live op, not in Object mode ---- */
    k.setMode('face');
    A.selectedElements = new Set([0]); k.refreshUI();
    k.insetSelection();
    log('10.under.op', !A.pendingOp ? 'NO OP OPENED - the test says nothing'
      : (k.selSlideAllowed() ? 'ALLOWED UNDER A LIVE OP' : 'refused while the op bar is up'));
    if (A.pendingOp) k.cancelPendingOp();
    k.setMode('object');
    log('10.object.mode', k.selSlideAllowed() ? 'ALLOWED IN OBJECT MODE' : 'refused (three fingers are the isolate pinch there)');
    k.setMode('vertex');

    /* ---- 11. A three-finger VERTICAL swipe is the camera, not a slide ---- */
    A.selectedElements = new Set([centre]); k.refreshUI();
    k.growSelection();
    land();
    move(1, HX[0], HY - 30); move(2, HX[1], HY - 30); move(3, HX[2], HY - 30);
    move(1, HX[0], HY - 90); move(2, HX[1], HY - 90); move(3, HX[2], HY - 90);
    log('11.vertical', k.softSlide ? 'ENGAGED ON A VERTICAL SWIPE' : 'never engaged');
    log('11.orbit', k.orbit.enabled ? 'camera kept it' : 'ORBIT KILLED BY A PAN');
    up(1, HX[0], HY - 90); up(2, HX[1], HY - 90); up(3, HX[2], HY - 90);

    /* ---- 12. The deadband: one spot holds whichever level you came from ----
       Levels are 64px apart and a boundary is crossed only 0.7 of a step past
       it, so 32px is inside the dead zone from either side. Without that,
       finger jitter at a boundary flips the level every frame. */
    A.selectedElements = new Set([centre]); k.refreshUI();
    k.growSelection();
    land(); hand(ENGAGE);
    k.selSlideRebase();
    var flips = 0, last = k.softSlide.level;
    for (var j = 0; j < 6; j++) {
      hand(ENGAGE + 32 + (j % 2 ? 4 : -4));
      if (k.softSlide.level !== last) { flips++; last = k.softSlide.level; }
    }
    var lvA = k.softSlide.level;
    hand(ENGAGE + STEP);            // out to level 1
    hand(ENGAGE + 32);              // and back into the same dead zone
    var lvB = k.softSlide.level;
    log('12.deadband', lvA + '/' + lvB + ' with ' + flips + ' flips while jittering' +
      '  (want 0/1 and 0 flips)');
    lift(ENGAGE + 32);

    /* ---- 13. Changing mode under a live slide ends it ---- */
    A.selectedElements = new Set([centre]); k.refreshUI();
    k.growSelection();
    land(); hand(ENGAGE); hand(ENGAGE + STEP);
    log('13.running', k.softSlide ? 'live at level ' + k.softSlide.level : 'NOT ENGAGED');
    k.setMode('face');
    hand(ENGAGE + STEP * 2);
    log('13.ended', k.softSlide ? 'STILL LIVE AFTER A MODE CHANGE' : 'ended itself');
    log('13.hud.gone', hudShown() ? 'STILL SHOWN' : 'hidden');
    lift(ENGAGE + STEP * 2);
    log('13.orbit.back', k.orbit.enabled ? 'enabled' : 'STILL DISABLED');
    k.setMode('vertex');

    /* ---- 14. Past the bottom, ONE step back brings the selection straight
       back. The level must not go on counting past saturation, or coming back
       costs as many dead steps as you overshot. ---- */
    k.setMode('vertex');
    A.selectedElements = new Set([centre]); k.refreshUI();
    k.growSelection();
    land(); hand(ENGAGE); k.selSlideRebase();
    for (var d = 3; d <= 9; d++) hand(ENGAGE - STEP * d);
    var deep = k.softSlide.level, deepN = A.selectedElements.size;
    hand(ENGAGE - STEP * (Math.abs(deep) - 1));
    log('14.no.dead.zone', 'bottomed out at level ' + deep + ' (' + deepN + ' left), one step back = level ' +
      k.softSlide.level + ' with ' + A.selectedElements.size +
      '  (level must be shallow, not -12, and the count must come back)');
    lift(ENGAGE - STEP * (Math.abs(deep) - 1));

    /* ---- 15. A slide the guard ended must not leave a tap behind ---- */
    k.setMode('vertex');
    A.selectedElements = new Set([centre]); k.refreshUI();
    k.growSelection();
    land(); hand(ENGAGE); k.selSlideRebase(); hand(ENGAGE + STEP);
    var wasLive = !!k.softSlide;
    k.setMode('face');
    hand(ENGAGE + STEP - 2);          // the guard fires on this move
    var before15 = sel();
    hand(0); lift(0);                 // and the fingers lift where they landed
    log('15.guard.ended', (wasLive && !k.softSlide) ? 'was live, ended by the mode change' : 'NOT AS EXPECTED');
    log('15.no.tap', sel() === before15 ? 'the release selected nothing' :
      'A TAP FIRED: ' + before15 + ' -> ' + sel());
    k.setMode('vertex');

    log('final.winding', k.windingAudit().every(function (x) { return x.ok; }) ? 'all ok' : 'BROKEN');
    log('console.errors', errs.length ? errs.length + ' (synthetic pointers make OrbitControls throw on release - see the a2.37 control)' : 'none');
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
