/* Isolate, driven the way a hand drives it, and checked where it is dangerous:
   what stays pickable, and what an undo does to it. */
(function () {
  var out = [], errs = [];
  var _ce = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); _ce.apply(console, arguments); };
  function log(k, v) { out.push(k + '=' + v); }
  var k, A, T3;

  function down(id, x, y) {
    k.renderer.domElement.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, pointerId: id, pointerType: 'touch', clientX: x, clientY: y, isPrimary: id === 1 }));
  }
  function move(id, x, y) {
    k.renderer.domElement.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true, pointerId: id, pointerType: 'touch', clientX: x, clientY: y }));
  }
  function up(id, x, y) {
    k.renderer.domElement.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true, pointerId: id, pointerType: 'touch', clientX: x, clientY: y }));
  }
  // Three fingers, spread `r` about a centre. Pinch = change r; slide = move cx.
  function hand(r, cx, cy, fn) {
    var pts = [[cx - r, cy], [cx + r, cy], [cx, cy - r]];
    pts.forEach(function (p, i) { fn(i + 1, p[0], p[1]); });
  }
  function chipShown() { return document.getElementById('isoChip').classList.contains('show'); }
  function visibleCount() { return A.objects.filter(function (o) { return o.mesh.visible; }).length; }
  function newCube() {
    k.startGeoSetup('cube');
    var id = A.geoSetup.objId;
    k.finishGeoSetup(true);
    return k.findObject(id);
  }

  function main() {
    k = window.__kubik; A = k.App; T3 = k.THREE;
    k.setMode('object');

    // Three objects, well apart so a pick aimed at one cannot hit another.
    var a = newCube(); a.mesh.position.set(-3, 0.5, 0);
    var b = newCube(); b.mesh.position.set(0, 0.5, 0);
    var c = newCube(); c.mesh.position.set(3, 0.5, 0);
    A.objects.forEach(function (o) { o.mesh.updateMatrixWorld(true); });
    log('0.scene', A.objects.length + ' objects');

    /* ---- 1. Nothing selected refuses, and says so ---- */
    A.selectedObjectIds = new Set();
    log('1.no.selection', k.enterIsolation() === false ? 'refused' : 'ISOLATED NOTHING');
    log('1.state', k.isolationOn() ? 'SET' : 'still off');

    /* ---- 2. Selecting everything refuses too ---- */
    A.selectedObjectIds = new Set(A.objects.map(function (o) { return o.id; }));
    log('2.everything', k.enterIsolation() === false ? 'refused' : 'ISOLATED THE WHOLE SCENE');

    /* ---- 3. The pinch itself ---- */
    A.selectedObjectIds = new Set([b.id]);
    A.activeObjectId = b.id;
    hand(120, 400, 400, down);
    log('3.armed', k.isoPinch ? 'yes (spread ' + k.isoPinch.spread0.toFixed(0) + ')' : 'NO');
    hand(40, 400, 400, move);                       // squeeze in
    log('3.pinch.in', k.isolationOn() ? 'hid ' + A.hidden.size : 'NOTHING HAPPENED');
    log('3.visible', visibleCount() + ' of ' + A.objects.length + '  want 1');
    log('3.chip', chipShown() ? 'shown: ' + document.getElementById('isoChipN').textContent : 'HIDDEN');
    log('3.latched', k.isoPinch && k.isoPinch.fired ? 'fires once per gesture' : 'NOT LATCHED');
    // Keep squeezing: it must NOT isolate again, down to nothing.
    hand(12, 400, 400, move);
    log('3.no.cascade', A.hidden.size === 3 ? 'still 3 hidden, no cascade' : 'CASCADED to ' + A.hidden.size + ' hidden');
    hand(12, 400, 400, up);

    /* ---- 4. A hidden object must not be pickable ---- */
    var vr = document.getElementById('viewport').getBoundingClientRect();
    function tapAt(obj) {
      var sp = k.worldToScreenPx(obj.mesh.position.clone());
      return sp ? k.pickObjectAt({ clientX: sp.x + vr.left, clientY: sp.y + vr.top }) : null;
    }
    var hitB = tapAt(b), hitA = tapAt(a);
    log('4.visible.pickable', hitB && hitB.id === b.id ? 'yes' : 'NO (' + (hitB ? hitB.name : 'nothing') + ')');
    log('4.hidden.pickable', hitA ? 'STILL PICKABLE (' + hitA.name + ')' : 'not pickable');
    // Region select must not sweep it up either.
    k.performRegionSelect({ kind: 'box', x0: 0, y0: 0, x1: 4000, y1: 4000 });
    log('4.box.select', A.selectedObjectIds.size + ' picked  want 1 (only the visible one)');

    /* ---- 5. A new object joins the isolation rather than vanishing ---- */
    A.selectedObjectIds = new Set([b.id]);
    var d = newCube();
    log('5.new.visible', d.mesh.visible ? 'yes' : 'HIDDEN - the thing you just made');
    log('5.in.set', !A.hidden.has(d.id) ? 'not named by the hidden set, so visible' : 'NAMED AS HIDDEN');
    log('5.chip.count', document.getElementById('isoChipN').textContent + '  want ' + A.hidden.size + ' hidden');

    /* ---- 6. Undo rebuilds every mesh - isolation must survive it ---- */
    k.undo();
    log('6.after.undo', k.isolationOn() ? 'still isolated (' + A.hidden.size + ' hidden)' : 'ISOLATION LOST');
    log('6.visibility', visibleCount() + ' of ' + A.objects.length + ' visible  want ' + (A.objects.length - A.hidden.size));
    log('6.consistent', (function () {
      var wrong = A.objects.filter(function (o) { return o.mesh.visible === A.hidden.has(o.id); }).length;
      return wrong ? wrong + ' OBJECT(S) DISAGREE WITH THE SET' : 'every mesh matches the set';
    })());
    log('6.no.ghosts', (function () {
      var ghosts = 0;
      A.hidden.forEach(function (id) { if (!k.findObject(id)) ghosts++; });
      return ghosts ? ghosts + ' DEAD IDS IN THE SET' : 'no dead ids';
    })());
    k.redo();

    /* ---- 7. Deleting the last visible object ends it ---- */
    var keep = A.objects.filter(function (o) { return !A.hidden.has(o.id); }).map(function (o) { return o.id; });
    A.selectedObjectIds = new Set(keep);
    k.removeObjects(keep.map(function (id) { return k.findObject(id); }).filter(Boolean));
    /* removeObjects is the low-level helper; every real caller reassigns the
       selection right after it, so the probe has to as well. Leaving dead ids
       in selectedObjectIds is the harness skipping a step, not the app. */
    A.selectedObjectIds = new Set();
    A.activeObjectId = null;
    log('7.auto.exit', (k.refreshUI(), k.isolationOn()) ? 'STILL ISOLATED with nothing to see' : 'isolation ended');
    log('7.all.back', visibleCount() + ' of ' + A.objects.length + ' visible  want all');
    log('7.chip.gone', chipShown() ? 'STILL SHOWN' : 'hidden');

    /* ---- 8. Pinching out brings it back ---- */
    var e1 = newCube(); e1.mesh.position.set(-3, 0.5, 0);
    var e2 = newCube(); e2.mesh.position.set(3, 0.5, 0);
    A.objects.forEach(function (o) { o.mesh.updateMatrixWorld(true); });
    A.selectedObjectIds = new Set([e1.id]);
    k.enterIsolation();
    log('8.isolated', visibleCount() + ' of ' + A.objects.length);
    hand(40, 400, 400, down);
    hand(150, 400, 400, move);                      // spread out
    log('8.pinch.out', k.isolationOn() ? 'STILL ISOLATED' : 'everything back');
    log('8.visible', visibleCount() + ' of ' + A.objects.length + '  want all');
    hand(150, 400, 400, up);

    /* ---- 9. The other three-finger gestures still work ---- */
    var tm0 = A.transformMode;
    hand(120, 400, 400, down); hand(120, 400, 400, up);      // a still tap
    log('9.tap.still.cycles', tm0 + ' -> ' + A.transformMode + (tm0 !== A.transformMode ? '  (works)' : '  BROKEN'));
    log('9.tap.no.isolate', k.isolationOn() ? 'A TAP ISOLATED' : 'a tap does not isolate');
    // A three-finger SLIDE (centroid moves, spread holds) must not isolate.
    A.selectedObjectIds = new Set([e1.id]);
    hand(120, 300, 400, down);
    hand(120, 520, 400, move);
    log('9.slide.no.isolate', k.isolationOn() ? 'A SLIDE ISOLATED' : 'a slide does not isolate');
    hand(120, 520, 400, up);

    /* ---- 10. Nothing of this reaches the document ---- */
    A.selectedObjectIds = new Set([e1.id]);
    k.enterIsolation();
    var doc = k.serializeDoc();
    var txt = JSON.stringify(doc);
    log('10.not.in.doc', (/isolat|hidden|"visible"/i.test(txt)) ? 'A FIELD LEAKED INTO THE FILE' : 'nothing about isolation in the file');
    log('10.all.objects.saved', doc.objects.length + ' of ' + A.objects.length + ' objects saved  want all of them');
    k.exitIsolation(true);

    /* ---- 11. Object mode only ---- */
    k.setMode('object');
    A.selectedObjectIds = new Set([e1.id]);
    A.activeObjectId = e1.id;
    k.setMode('vertex');
    hand(120, 400, 400, down);
    log('11.not.armed', k.isoPinch ? 'ARMED IN COMPONENT MODE' : 'not armed outside Object mode');
    hand(40, 400, 400, move);
    log('11.component.safe', k.isolationOn() ? 'ISOLATED FROM COMPONENT MODE' : 'a pinch does nothing here');
    hand(40, 400, 400, up);
    k.setMode('object');

    /* ---- 12. Soft's own three-finger slide is untouched ----
       They can never be asked at once - soft cannot be on in Object mode and
       the pinch is not armed outside it - but the two arm off the same
       pointerdown, so this checks they did not tangle. */
    A.selectedObjectIds = new Set([e1.id]);
    A.activeObjectId = e1.id;
    k.setMode('vertex');
    k.ensureHelpers(e1);
    A.selectedElements = new Set([0]);
    k.setSoft(true);
    var r0 = A.softRadius;
    hand(120, 300, 400, down);
    hand(120, 520, 400, move);
    log('12.soft.slide', (k.softSlide && A.softRadius !== r0) ? 'still sizes the radius' : 'SOFT SLIDE BROKEN');
    hand(120, 520, 400, up);
    k.setSoft(false);
    k.setMode('object');

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
