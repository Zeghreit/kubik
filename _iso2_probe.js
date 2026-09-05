/* The seven defects the a2.38 review found. Six of them were one design
   mistake - holding "which objects survive" instead of "which are hidden" -
   so these are the sequences that mistake broke. */
(function () {
  var out = [], errs = [];
  var _ce = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); _ce.apply(console, arguments); };
  function log(k, v) { out.push(k + '=' + v); }
  var k, A;

  function newCube(x) {
    k.startGeoSetup('cube');
    var id = A.geoSetup.objId;
    k.finishGeoSetup(true);
    var o = k.findObject(id);
    o.mesh.position.set(x, 0.5, 0);
    o.mesh.updateMatrixWorld(true);
    return o;
  }
  function visibleCount() { return A.objects.filter(function (o) { return o.mesh.visible; }).length; }
  function chipN() { return document.getElementById('isoChipN').textContent; }
  // Every object that is drawn but cannot be picked, or hidden but pickable -
  // the two states that should never exist.
  function mismatched() {
    return A.objects.filter(function (o) {
      return o.mesh.visible !== k.objectPickable(o);
    }).length;
  }
  function scene() {
    /* The chip's SHOWN state, not its text. Since a2.73 the chip sinks over
       180ms and keeps its last count while it does - blanking it mid-fade
       looks like the chip breaking - so the text of a chip that is already
       hidden says nothing about the app. Whether it is up does. */
    var ch = document.getElementById('isoChip');
    var chOn = ch && ch.classList.contains('show');
    return visibleCount() + '/' + A.objects.length + ' visible, ' + A.hidden.size +
      ' hidden, chip ' + (chOn ? 'up "' + chipN() + '"' : 'down');
  }
  // Does the whole picture agree with itself?
  function coherent() {
    var bad = [];
    if (mismatched()) bad.push(mismatched() + ' drawn-but-unpickable');
    A.hidden.forEach(function (id) { if (!k.findObject(id)) bad.push('dead id ' + id); });
    if (A.hidden.size >= A.objects.length && A.objects.length) bad.push('EVERYTHING hidden');
    if (visibleCount() === 0 && A.objects.length) bad.push('EMPTY VIEWPORT');
    var shown = document.getElementById('isoChip').classList.contains('show');
    if (shown !== (A.hidden.size > 0)) bad.push('chip disagrees');
    if (shown && chipN() !== A.hidden.size + ' hidden') bad.push('chip count wrong');
    if (A.hidden.has(A.activeObjectId)) bad.push('active object is hidden');
    return bad.length ? bad.join('; ') : 'coherent';
  }

  function setup(n) {
    // A fresh scene of n cubes, spread out, with the first isolated.
    k.setMode('object');
    k.exitIsolation(true);
    if (A.objects.length) k.removeObjects(A.objects.slice());
    A.selectedObjectIds = new Set(); A.activeObjectId = null;
    var made = [];
    for (var i = 0; i < n; i++) made.push(newCube((i - (n - 1) / 2) * 3));
    return made;
  }

  function main() {
    k = window.__kubik; A = k.App;

    /* ---- 1. Join, while isolated ---- */
    var o = setup(4);
    A.selectedObjectIds = new Set([o[0].id, o[1].id, o[2].id]);
    k.enterIsolation();
    A.selectedObjectIds = new Set([o[0].id, o[1].id]);
    k.joinSelection();
    log('1.join', scene());
    log('1.join.ok', coherent());
    log('1.join.result.visible', (function () {
      var id = Array.from(A.selectedObjectIds)[0], j = k.findObject(id);
      return j ? (j.mesh.visible ? 'the joined object is on screen' : 'THE JOINED OBJECT IS HIDDEN') : 'no result';
    })());

    /* ---- 2. Duplicate, while isolated ---- */
    o = setup(4);
    A.selectedObjectIds = new Set([o[0].id]);
    k.enterIsolation();
    k.duplicateSelection();
    log('2.duplicate', scene());
    log('2.dup.ok', coherent());
    log('2.dup.pickable', (function () {
      var id = Array.from(A.selectedObjectIds)[0], d = k.findObject(id);
      if (!d) return 'no copy';
      return (d.mesh.visible && k.objectPickable(d)) ? 'drawn and pickable'
        : 'drawn:' + d.mesh.visible + ' pickable:' + k.objectPickable(d) + '  DRAWN BUT UNTOUCHABLE';
    })());

    /* ---- 3. Object-mode Delete, while isolated ---- */
    o = setup(5);
    A.selectedObjectIds = new Set([o[0].id, o[1].id]);
    k.enterIsolation();
    k.deleteSelection();
    log('3.delete', scene());
    log('3.delete.ok', coherent());

    /* ---- 4. Separate and Mirror ---- */
    o = setup(3);
    A.selectedObjectIds = new Set([o[0].id]);
    k.enterIsolation();
    k.separateSelection();
    log('4.separate', scene());
    log('4.separate.ok', coherent());

    o = setup(3);
    A.selectedObjectIds = new Set([o[0].id]);
    k.enterIsolation();
    k.mirrorSelectedObjects('x');
    log('4.mirror', scene());
    log('4.mirror.ok', coherent());

    /* ---- 5. Loading a document drops isolation; undo keeps it ---- */
    o = setup(4);
    A.selectedObjectIds = new Set([o[0].id]);
    k.enterIsolation();
    var doc = k.serializeDoc();
    k.restoreDoc(doc, { keepAppearance: true, keepSelection: true });   // an undo
    log('5.undo.keeps', k.isolationOn() ? 'still ' + A.hidden.size + ' hidden' : 'ISOLATION LOST ON UNDO');
    k.restoreDoc(doc);                                                   // a load
    log('5.load.drops', k.isolationOn() ? 'STILL ISOLATED AFTER A LOAD' : 'isolation dropped');
    log('5.load.visible', visibleCount() + ' of ' + A.objects.length + '  want all');

    /* ---- 6. Component mode cannot open on a hidden object ---- */
    o = setup(3);
    A.activeObjectId = o[1].id;                    // active is NOT what we isolate
    A.selectedObjectIds = new Set([o[0].id]);
    k.enterIsolation();
    k.refreshUI();
    log('6.active.cleared', A.hidden.has(A.activeObjectId) ? 'ACTIVE IS HIDDEN' : 'active is not a hidden object');
    k.setMode('vertex');
    log('6.after.setMode', A.activeObjectId === null ? 'no active object'
      : (A.hidden.has(A.activeObjectId) ? 'EDITING A HIDDEN OBJECT' : 'editing ' + k.findObject(A.activeObjectId).name));
    k.setMode('object');

    /* ---- 7. The outliner: hidden rows are marked, and a tap brings one back ---- */
    o = setup(3);
    A.selectedObjectIds = new Set([o[0].id]);
    k.enterIsolation();
    k.refreshUI();
    /* a2.91: the object list is the OUTLINER now, not chips in the drawer -
       and it is built only while the shelf is open, so open it first. */
    k.setOutlinerOpen(true);
    var rows = document.querySelectorAll('.outRow');
    var dim = document.querySelectorAll('.outRow.is-hidden');
    log('7.rows', rows.length + ' rows, ' + dim.length + ' marked hidden  want ' + A.objects.length + ' and ' + A.hidden.size);
    if (dim.length) {
      dim[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      log('7.tap.unhides', A.hidden.size + ' still hidden (was ' + (A.objects.length - 1) + ')');
      log('7.ok', coherent());
    } else {
      log('7.tap.unhides', 'NO HIDDEN ROW TO TAP');
    }

    /* ---- 8. Every object visible again ends it, however it got there ---- */
    o = setup(3);
    A.selectedObjectIds = new Set([o[0].id]);
    k.enterIsolation();
    A.hidden.forEach(function (id) { k.unhideObject(id); });
    k.refreshUI();
    log('8.all.shown', k.isolationOn() ? 'STILL ON with nothing hidden' : 'isolation ended by itself');
    log('8.ok', coherent());

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
