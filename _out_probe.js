/* The outliner shelf (a2.91). It is a LIST OF WHAT EXISTS, so what gets
   asserted is that it says what the scene says - and that every guard the
   drawer chips had earned came across with them. */
(function () {
  var out = [], errs = [];
  var _ce = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); _ce.apply(console, arguments); };
  function log(kk, v) { out.push(kk + '=' + v); }
  function verdict(c, good, bad) { return c ? ' - ' + good : ' ' + bad; }
  var k, A, THREE;

  function tab() { return document.getElementById('outTab'); }
  function tray() { return document.getElementById('outTray'); }
  function rows() { return Array.prototype.slice.call(document.querySelectorAll('.outRow')); }
  function names() { return rows().map(function (r) { return r.querySelector('.outName').textContent; }); }
  function groupRows() {
    return Array.prototype.slice.call(document.querySelectorAll('.outRow.outGroup'));
  }
  function groupRowFor(name) {
    return groupRows().filter(function (r) {
      return r.querySelector('.outName').textContent === name;
    })[0];
  }
  // The rows in the order the shelf draws them, tagged by what they are.
  function shape() {
    return Array.prototype.slice.call(document.querySelectorAll('.outRow')).map(function (r) {
      var n = r.querySelector('.outName').textContent;
      if (r.classList.contains('outGroup')) return '[' + n + ' x' + r.querySelector('.outCount').textContent + ']';
      return (r.classList.contains('outChild') ? '  ' : '') + n;
    });
  }
  /* A REAL HOLD: press, wait the timer out without moving, then drag. The
     wait is the whole point - it is what a swipe and a scroll never do. */
  function press(row) {
    var r = row.getBoundingClientRect();
    pt(row, 'pointerdown', r.left + 20, r.top + r.height / 2);
  }
  function moveTo(x, y) { pt(document, 'pointermove', x, y); }
  function dropAt(x, y) { pt(document, 'pointerup', x, y); }
  function midOf(el) {
    var r = el.getBoundingClientRect();
    return { x: r.left + 20, y: r.top + r.height / 2 };
  }
  function edgeOf(el, below) {
    var r = el.getBoundingClientRect();
    return { x: r.left + 20, y: below ? r.bottom - 2 : r.top + 2 };
  }
  // The top-level order as the MODEL sees it, groups in brackets.
  function order() {
    return k.outEntries().map(function (e) {
      return e.kind === 'group' ? '[' + k.findGroup(e.id).name + ']' : k.findObject(e.id).name;
    }).join(' ');
  }
  function objNames() { return A.objects.map(function (o) { return o.name; }).join(' '); }
  function ringKeys() {
    return k.currentHubTools().map(function (t) { return t.key; });
  }
  function rowFor(name) {
    return rows().filter(function (r) {
      return r.querySelector('.outName').textContent === name;
    })[0];
  }
  function cube(name, x) {
    var o = k.createPrimitiveObject('cube', k.PRIM_SPECS.cube.def, name,
      new THREE.Vector3(x || 0, 0, 0));
    A.selectedObjectIds = new Set([o.id]);
    A.activeObjectId = o.id;
    k.setMode('object');
    k.refreshUI();
    return o;
  }
  /* Synthetic pointers. setPointerCapture throws on an id the browser has
     never seen, which the app already swallows - so a probe drag exercises
     the same path a finger does, minus the capture. */
  function pt(el, type, x, y) {
    el.dispatchEvent(new PointerEvent(type, {
      pointerId: 7, bubbles: true, cancelable: true,
      clientX: x, clientY: y, button: 0, isPrimary: true, pointerType: 'touch'
    }));
  }
  function drag(row, dx, dy) {
    var r = row.getBoundingClientRect();
    var x = r.left + 20, y = r.top + r.height / 2;
    pt(row, 'pointerdown', x, y);
    for (var i = 1; i <= 6; i++) pt(row, 'pointermove', x + dx * i / 6, y + dy * i / 6);
    pt(row, 'pointerup', x + dx, y + dy);
    row.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }
  function tap(row) { drag(row, 0, 0); }
  // A drag the browser TAKES AWAY - the long-press menu, or the compositor
  // claiming the touch - rather than one the finger finishes.
  function dragCancelled(row, dx) {
    var r = row.getBoundingClientRect();
    var x = r.left + 20, y = r.top + r.height / 2;
    pt(row, 'pointerdown', x, y);
    for (var i = 1; i <= 6; i++) pt(row, 'pointermove', x + dx * i / 6, y);
    pt(row, 'pointercancel', x + dx, y);
  }
  function shifted(row) {
    var t = row.style.transform;
    return !!(t && t !== 'none' && t !== 'translateX(0px)');
  }
  function hits(a, b) {
    return a.left < b.right - 0.5 && a.right > b.left + 0.5 &&
           a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;
  }

  function main(done) {
    k = window.__kubik; A = k.App; THREE = k.THREE;

    // ---- 1. the drawer no longer carries the list ----
    log('1.left_the_drawer', !document.getElementById('objList')
      ? 'the Scene section and its chips are gone'
      : 'THE DRAWER STILL HAS #objList');

    // ---- 2. the tab, and where it sits ----
    var tr = tab().getBoundingClientRect();
    var menu = document.getElementById('btnMenu').getBoundingClientRect();
    var hub = document.getElementById('hubBtn').getBoundingClientRect();
    var vp = document.getElementById('viewport').getBoundingClientRect();
    log('2.tab_box', 'x ' + Math.round(tr.left) + '..' + Math.round(tr.right) +
      ' y ' + Math.round(tr.top) + '..' + Math.round(tr.bottom) +
      ', menu ends y ' + Math.round(menu.bottom) +
      verdict(Math.round(tr.width) === 44 && tr.left <= vp.left + 2 &&
              tr.top >= menu.bottom - 0.5 && !hits(tr, hub),
        'edge-tucked on the left, below the menu, clear of the hub',
        'THE TAB IS IN THE WRONG PLACE'));
    log('2.closed_at_rest', getComputedStyle(tray()).display === 'none'
      ? 'the shelf starts rolled up' : 'THE SHELF IS OPEN BEFORE IT IS ASKED FOR');

    // ---- 3. it opens and closes on the tab ----
    tab().click();
    var openNow = k.outlinerIsOpen() && getComputedStyle(tray()).display !== 'none';
    tab().click();
    var shutAgain = !k.outlinerIsOpen() && getComputedStyle(tray()).display === 'none';
    tab().click();
    log('3.rolls_both_ways', 'open=' + openNow + ' thenClosed=' + shutAgain +
      verdict(openNow && shutAgain, 'a tap each way', 'THE TAB DOES NOT TOGGLE'));

    // ---- 4. the list IS the scene, in scene order ----
    var a = cube('Alpha', -3), b = cube('Beta', 0), c = cube('Gamma', 3);
    k.refreshOutliner();
    log('4.list_is_the_scene', 'rows: ' + names().join(', ') +
      ' vs objects: ' + A.objects.map(function (o) { return o.name; }).join(', ') +
      verdict(names().join(',') === A.objects.map(function (o) { return o.name; }).join(','),
        'one row per object, in scene order',
        'THE LIST DISAGREES WITH THE SCENE'));

    // ---- 5. a row selects ----
    k.setMode('object');
    A.selectedObjectIds = new Set(); A.activeObjectId = null;
    k.refreshUI();
    rowFor('Beta').click();
    log('5.row_selects', 'selected=' + Array.from(A.selectedObjectIds).length +
      ' active=' + (k.findObject(A.activeObjectId) || {}).name +
      verdict(A.selectedObjectIds.has(b.id),
        'the row put the selection on its own object',
        'THE ROW DID NOT SELECT'));

    // ---- 6. the eye hides, and the row still shows the object exists ----
    rowFor('Gamma').querySelector('.outEye').click();
    var gRow = rowFor('Gamma');
    log('6.eye_hides', 'meshVisible=' + c.mesh.visible +
      ' rowListed=' + !!gRow + ' dimmed=' + (gRow && gRow.classList.contains('is-hidden')) +
      verdict(!c.mesh.visible && gRow && gRow.classList.contains('is-hidden'),
        'gone from the viewport, still listed and struck through',
        'HIDING LOST THE ROW, or did not hide'));

    /* 7. AND TAPPING THE ROW BRINGS IT BACK rather than selecting something
       invisible. This is the trap the drawer chips were fixed for: the row
       selected a hidden object and Delete then acted on a thing nobody could
       see. The guard had to survive the move. */
    A.selectedObjectIds = new Set(); A.activeObjectId = null;
    k.refreshUI();
    rowFor('Gamma').click();
    log('7.hidden_row_unhides', 'visible=' + c.mesh.visible +
      ' selected=' + A.selectedObjectIds.has(c.id) +
      verdict(c.mesh.visible && !A.selectedObjectIds.has(c.id),
        'it came back, and did NOT become the selection',
        'A HIDDEN ROW SELECTED AN INVISIBLE OBJECT'));

    /* 8. THE LAST ONE SHOWING IS REFUSED. The first cut of this hid three
       named cubes and called the third one "the last" - the app starts with
       a Cube 1 of its own, so it was hiding three of four and measuring a
       refusal that never had to happen. Hide everything but one by NAME, off
       the live object list, and then try that one. */
    A.hidden = new Set(); k.refreshUI(); k.refreshOutliner();
    var all = A.objects.map(function (o) { return o.name; });
    var lastName = all[all.length - 1];
    all.slice(0, -1).forEach(function (nm) {
      rowFor(nm).querySelector('.outEye').click();
    });
    var beforeLast = A.hidden.size;
    var visibleBefore = A.objects.filter(function (o) { return o.mesh.visible; }).length;
    rowFor(lastName).querySelector('.outEye').click();
    var visible = A.objects.filter(function (o) { return o.mesh.visible; }).length;
    log('8.last_one_refused', all.length + ' objects, hid ' + beforeLast +
      ' of them (visible ' + visibleBefore + '), then tried "' + lastName + '": hidden now ' +
      A.hidden.size + ', visible ' + visible +
      verdict(visibleBefore === 1 && A.hidden.size === beforeLast && visible === 1,
        'the scene cannot be emptied by hiding, and nothing sprang back',
        'HIDING THE LAST OBJECT EMPTIED THE SCENE or un-hid everything'));
    A.hidden = new Set(); k.refreshUI();

    /* 9. A ROW IN A COMPONENT MODE settles the op it is walking away from.
       The chips learned this the hard way: an open knife kept points that
       belonged to the OLD object while the helpers showed the new one. */
    k.setMode('object');
    A.selectedObjectIds = new Set([a.id]); A.activeObjectId = a.id;
    k.refreshUI();
    k.setMode('face');
    A.selectedElements = new Set([0]);
    k.extrudeSelection();
    var barOpen = !!A.pendingOp;
    k.refreshOutliner();
    rowFor('Beta').click();
    log('9.row_settles_the_op', 'bar was open: ' + barOpen +
      ', after the row: pendingOp=' + !!A.pendingOp +
      ' active=' + (k.findObject(A.activeObjectId) || {}).name +
      verdict(barOpen && !A.pendingOp && A.activeObjectId === b.id,
        'the live op was committed and the lock moved',
        'THE ROW LEFT AN OP OPEN OVER AN OBJECT IT WALKED AWAY FROM'));
    k.setMode('object');

    /* 10. NOT REBUILT WHILE CLOSED. refreshUI runs on every selection change
       and every drag frame that touches the UI; the claim in the code is that
       a shelf nobody is looking at costs nothing, so it is measured rather
       than asserted. */
    k.setOutlinerOpen(false);
    var stamp = document.createElement('div');
    stamp.id = 'outStamp';
    document.getElementById('outList').appendChild(stamp);
    for (var i = 0; i < 5; i++) k.refreshUI();
    var survived = !!document.getElementById('outStamp');
    k.setOutlinerOpen(true);
    var wiped = !document.getElementById('outStamp');
    log('10.closed_costs_nothing', 'survived 5 refreshUI while closed: ' + survived +
      ', rebuilt on open: ' + wiped +
      verdict(survived && wiped,
        'built when you look at it, not when the app twitches',
        'IT REBUILDS WHILE NOBODY IS LOOKING, or fails to rebuild on open'));

    // ---- 11. and it fits the narrow case ----
    var vpEl = document.getElementById('viewport');
    var held = vpEl.style.width;
    vpEl.style.width = '375px';
    k.refreshOutliner();
    var t2 = tab().getBoundingClientRect(), tray2 = tray().getBoundingClientRect();
    var vp2 = vpEl.getBoundingClientRect();
    var matTab = document.getElementById('matTab');
    var mt = matTab ? matTab.getBoundingClientRect() : null;
    log('11.at_375', 'tray x ' + Math.round(tray2.left) + '..' + Math.round(tray2.right) +
      ' of ' + Math.round(vp2.width) + 'px, bottom ' + Math.round(tray2.bottom) +
      verdict(tray2.right < vp2.right - 40 && (!mt || !hits(tray2, mt)) &&
              tray2.bottom <= vp2.bottom + 0.5,
        'the shelf leaves most of the width to the model and clears the material tab',
        'THE SHELF DOES NOT FIT AT PHONE WIDTH'));
    vpEl.style.width = held;


    /* ---- ROW GESTURES (a2.92) ----
       A row is a HANDLE on an object, so every gesture below is aimed at the
       object under the finger and NOT at the selection - which is the one
       thing that could quietly make a swipe delete the wrong thing. */
    var g1 = cube('Gest1', -6), g2 = cube('Gest2', 6);
    k.setOutlinerOpen(true); k.refreshOutliner();

    // 13. left, far enough: that row's object goes - and only that one.
    A.selectedObjectIds = new Set([g1.id]); A.activeObjectId = g1.id;
    k.refreshUI(); k.refreshOutliner();
    var before13 = A.objects.length;
    drag(rowFor('Gest2'), -(k.OUT_SWIPE_COMMIT + 20), 0);
    log('13.swipe_left_deletes', before13 + ' -> ' + A.objects.length +
      ' objects, Gest2 gone=' + !k.findObject(g2.id) +
      ' Gest1 kept=' + !!k.findObject(g1.id) +
      ' (Gest1 was the SELECTED one)' +
      verdict(A.objects.length === before13 - 1 && !k.findObject(g2.id) && !!k.findObject(g1.id),
        'the swipe deleted the row it was on, not the selection',
        'SWIPE-DELETE TOOK THE WRONG OBJECT'));

    // 14. right, far enough: a copy, next to it in the list.
    k.refreshOutliner();
    var before14 = A.objects.length;
    drag(rowFor('Gest1'), k.OUT_SWIPE_COMMIT + 20, 0);
    k.refreshOutliner();
    log('14.swipe_right_duplicates', before14 + ' -> ' + A.objects.length +
      ' objects, rows now: ' + names().join(', ') +
      verdict(A.objects.length === before14 + 1 &&
              names().filter(function (n) { return /Gest1/.test(n); }).length === 2,
        'one copy, listed',
        'SWIPE-DUPLICATE DID NOT MAKE EXACTLY ONE COPY'));

    /* 15. AND A SHORT ONE MEANS NOTHING. Nothing is decided until the finger
       lifts, so a swipe started and thought better of has to spring back
       rather than commit at whatever distance it reached. */
    k.refreshOutliner();
    var before15 = A.objects.length;
    var r15 = rowFor('Gest1');
    drag(r15, -(k.OUT_SWIPE_COMMIT - 30), 0);
    log('15.short_swipe_springs_back', before15 + ' -> ' + A.objects.length +
      ' objects, row still listed=' + !!rowFor('Gest1') +
      verdict(A.objects.length === before15 && !!rowFor('Gest1'),
        'stopping short of the commit distance did nothing',
        'A HALF SWIPE ACTED ANYWAY'));

    /* 16. A DOWNWARD DRAG IS THE TRAY SCROLLING. touch-action hands vertical
       to the browser; the row must not grab it back and slide sideways for
       the diagonal part of a scroll. */
    k.refreshOutliner();
    var before16 = A.objects.length;
    var r16 = rowFor('Gest1');
    drag(r16, -40, 90);
    log('16.vertical_is_a_scroll', 'objects ' + before16 + ' -> ' + A.objects.length +
      ', row moved sideways=' + shifted(r16) +
      verdict(A.objects.length === before16 && !shifted(r16),
        'a mostly-vertical drag scrolls and the row stays put',
        'SCROLLING THE TRAY SWIPED A ROW'));

    /* 17. THE RENAME BOX EATS EVERY KEY. Single letters are shortcuts in this
       app - x deletes, e extrudes - so a name typed into a box that leaks
       would edit the mesh it is naming. */
    k.refreshOutliner();
    var reached = 0;
    var spy = function () { reached++; };
    document.addEventListener('keydown', spy);
    k.outlinerRename(k.outTarget('object', A.objects[0].id));
    var box = document.querySelector('.outRename');
    if (box) {
      ['x', 'e', 'a'].forEach(function (key) {
        box.dispatchEvent(new KeyboardEvent('keydown', { key: key, bubbles: true, cancelable: true }));
      });
      box.value = 'Renamed By Probe';
      box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    }
    document.removeEventListener('keydown', spy);
    k.refreshOutliner();
    log('17.rename_commits_and_swallows', 'box appeared=' + !!box +
      ', keys that reached the document=' + reached +
      ', name now "' + A.objects[0].name + '"' +
      verdict(!!box && reached === 0 && A.objects[0].name === 'Renamed By Probe' &&
              !document.querySelector('.outRename'),
        'typed, committed on Enter, and not one key escaped to the shortcuts',
        'THE RENAME BOX LEAKED KEYS or did not commit'));


    /* 19. A CANCEL IS NOT A LIFT. Android fires pointercancel on the
       long-press menu, and the first cut of this ran the same branch for
       both - so a swipe you never finished deleted the object. */
    k.refreshOutliner();
    var before19 = A.objects.length;
    var r19 = rowFor('Gest1');
    dragCancelled(r19, -(k.OUT_SWIPE_COMMIT + 40));
    log('19.cancel_does_not_commit', before19 + ' -> ' + A.objects.length +
      ' objects after a cancel 40px PAST the commit distance, row still listed=' +
      !!rowFor('Gest1') +
      verdict(A.objects.length === before19 && !!rowFor('Gest1'),
        'a gesture taken away puts the row back and nothing else',
        'A CANCELLED SWIPE DELETED THE OBJECT'));

    /* 20. AND A FLICK IS NOT THE FIRST HALF OF A DOUBLE TAP. The bow-out to
       the scroller ends with the drag never having gone live, which is the
       same shape as a tap unless the distance is checked. */
    k.refreshOutliner();
    drag(rowFor('Gest1'), -20, 80);      // a flick down the list
    tap(rowFor('Gest1'));                // and then one real tap
    var box20 = document.querySelector('.outRename');
    log('20.flick_then_tap_is_not_a_pair', 'rename box after flick+tap=' + !!box20 +
      verdict(!box20,
        'scrolling the list does not arm the rename',
        'A FLICK COUNTED AS THE FIRST TAP OF A PAIR'));

    /* 21. A FACE SELECTION MUST NOT OUTLIVE ITS OBJECT. deleteSelection
       never had to think about this - its object branch only runs in Object
       mode - but a swipe works in any mode, and a stale selection does not
       throw, it LIES: the root keeps data-armed and the HUD goes on
       reporting faces with nothing left to pick. */
    k.setMode('object');
    var g3 = cube('Gest3', -9);
    A.selectedObjectIds = new Set([g3.id]); A.activeObjectId = g3.id;
    k.refreshUI();
    k.setMode('face');
    A.selectedElements = new Set([0, 1, 2]);
    k.refreshUI(); k.refreshOutliner();
    var heldBefore = A.selectedElements.size;
    drag(rowFor('Gest3'), -(k.OUT_SWIPE_COMMIT + 20), 0);
    log('21.no_orphan_selection', 'held ' + heldBefore + ' faces, after the swipe: ' +
      A.selectedElements.size + ' held, active=' + A.activeObjectId +
      ', armed=' + document.documentElement.getAttribute('data-armed') +
      verdict(heldBefore === 3 && A.selectedElements.size === 0 && !A.activeObjectId,
        'the faces went with the mesh they were on',
        'A FACE SELECTION SURVIVED ITS OBJECT'));
    k.setMode('object');


    /* ---- GROUPS (a2.93) ----
       A group is a record, not a THREE.Group: the meshes stay parented to the
       scene, so what is asserted below is that the LIST and the SELECTION
       agree with that record - and that nothing else in the app had to learn
       what a group is. */
    k.setMode('object');
    A.objects.slice().forEach(function (o) { k.removeObjects([o]); });
    A.groups = [];
    var p = cube('Leg A', -3), q = cube('Leg B', 0), r = cube('Loose', 3);
    k.setOutlinerOpen(true);

    /* 22. two selected objects group, and the ONE grouping seat turns over.
       Group and Ungroup share a seat again since a2.109, so the question is
       no longer which key is present but which WORD the seat is wearing. */
    function groupingWord() {
      var t = k.currentHubTools().filter(function (x) { return x.key === 'grouping'; })[0];
      return t ? (typeof t.label === 'function' ? t.label() : t.label) : 'absent';
    }
    A.selectedObjectIds = new Set([p.id, q.id]); A.activeObjectId = null;
    k.refreshUI();
    var wordBefore = groupingWord();
    k.groupSelection();
    var g22 = A.groups[0];
    var wordAfter = groupingWord();
    log('22.ring_groups', 'groups=' + A.groups.length +
      ' members=' + (g22 ? g22.childIds.length : 0) +
      ', seat before "' + wordBefore + '", after "' + wordAfter + '"' +
      verdict(A.groups.length === 1 && g22.childIds.length === 2 &&
              wordBefore === 'Group' && wordAfter === 'Ungroup',
        /* Two loose objects can only be grouped; one whole group can only be
           ungrouped. The seat says which, and section 36 covers the case in
           between, where the answer has to be Group. */
        'one group of two, and the seat named the only op that would do anything',
        'GROUPING DID NOT HAPPEN, or the seat offered a no-op'));

    /* 23. THE LIST NESTS, and the group stands where its first member stood -
       one ordering doing both jobs, so there is no second list to keep in
       step. */
    k.refreshOutliner();
    var shape23 = shape();
    log('23.list_nests', shape23.join(' | ') +
      verdict(shape23.length === 4 && /^\[Group 1 x2\]$/.test(shape23[0]) &&
              shape23[1] === '  Leg A' && shape23[2] === '  Leg B' &&
              shape23[3] === 'Loose',
        'the group took its first member place, children indented beneath it',
        'THE LIST DID NOT NEST'));

    // 24. a group row takes the assembly; a child row takes the one child.
    A.selectedObjectIds = new Set(); k.refreshUI(); k.refreshOutliner();
    groupRowFor('Group 1').click();
    var wholeSel = Array.from(A.selectedObjectIds).sort().join(',');
    /* Cleared first ON PURPOSE. Every tap in this app adds - so measuring the
       child row while the whole group was still selected measured the toggle,
       not the row. */
    A.selectedObjectIds = new Set(); k.refreshUI(); k.refreshOutliner();
    rowFor('Leg A').click();
    var oneSel = Array.from(A.selectedObjectIds).sort().join(',');
    log('24.group_row_vs_child_row', 'group row selected [' + wholeSel + '], ' +
      'child row selected [' + oneSel + '], members are [' + [p.id, q.id].sort().join(',') + ']' +
      verdict(wholeSel === [p.id, q.id].sort().join(',') && oneSel === String(p.id),
        'the assembly from the group row, one member from its child row',
        'A ROW SELECTED THE WRONG THING'));

    /* 25. AND A VIEWPORT TAP TAKES THE WHOLE GROUP. That is what grouping is
       FOR - a tap that grabbed one leg of a chair would make the group an
       outliner decoration rather than a modelling tool. The outliner is where
       one member is still reachable, which is what 24 just measured. */
    A.selectedObjectIds = new Set(); k.refreshUI();
    k.selectObjectClick(q.id, false);
    var tapSel = Array.from(A.selectedObjectIds).sort().join(',');
    log('25.viewport_tap_takes_group', 'tapping Leg B selected [' + tapSel + ']' +
      verdict(tapSel === [p.id, q.id].sort().join(','),
        'one tap on one member picked up the assembly',
        'A VIEWPORT TAP ON A GROUPED OBJECT TOOK ONLY THAT OBJECT'));

    /* 26. THE EYE DECIDES FOR THE WHOLE GROUP. hideObject refuses the last one
       showing ONE AT A TIME, so a group taken member by member would hide some
       and refuse the rest - a switch that did most of what it said. */
    A.hidden = new Set(); k.refreshUI(); k.refreshOutliner();
    groupRowFor('Group 1').querySelector('.outEye').click();
    var hidTwo = A.hidden.size;
    k.refreshOutliner();
    // Now Loose is the only one showing, so the group cannot come off again.
    var backOn = k.unhideGroup(k.findGroup(g22.id));
    k.refreshUI(); k.refreshOutliner();
    A.hidden = new Set([r.id]);
    k.refreshUI(); k.refreshOutliner();
    var refused = !k.hideGroup(k.findGroup(g22.id));
    log('26.group_eye_is_all_or_nothing', 'hid ' + hidTwo + ' of 3, came back=' + backOn +
      ', then with Loose already hidden the group was refused=' + refused +
      ', hidden now ' + A.hidden.size +
      verdict(hidTwo === 2 && backOn && refused && A.hidden.size === 1,
        'the whole group or none of it, and never the whole scene',
        'THE GROUP EYE HALF-HID, or emptied the viewport'));
    A.hidden = new Set(); k.refreshUI();


    /* 27. SWIPING A GROUP ROW TAKES ITS CONTENTS - the decision taken with
       Zeghreit - and undo has to bring all of it back, or the gesture is a
       trapdoor. */
    k.refreshOutliner();
    var before27 = A.objects.length;
    k.pushHistory();
    drag(groupRowFor('Group 1'), -(k.OUT_SWIPE_COMMIT + 20), 0);
    var after27 = A.objects.length, groupsAfter = A.groups.length;
    k.undo();
    log('27.group_swipe_takes_contents', before27 + ' -> ' + after27 +
      ' objects, groups ' + groupsAfter + '; after undo ' + A.objects.length +
      ' objects and ' + A.groups.length + ' groups' +
      verdict(after27 === before27 - 2 && groupsAfter === 0 &&
              A.objects.length === before27 && A.groups.length === 1,
        'the group and both members went, and undo brought the lot back',
        'A GROUP SWIPE LEFT ORPHANS, or undo did not restore it'));

    // 28. and swiping the other way copies the assembly AS an assembly.
    k.refreshUI(); k.refreshOutliner();
    var before28 = A.objects.length, gBefore28 = A.groups.length;
    drag(groupRowFor('Group 1'), k.OUT_SWIPE_COMMIT + 20, 0);
    k.refreshOutliner();
    var newG = A.groups[A.groups.length - 1];
    log('28.group_duplicates_as_a_group', before28 + ' -> ' + A.objects.length +
      ' objects, groups ' + gBefore28 + ' -> ' + A.groups.length +
      ', the new one holds ' + (newG ? newG.childIds.length : 0) +
      verdict(A.objects.length === before28 + 2 && A.groups.length === gBefore28 + 1 &&
              newG && newG.childIds.length === 2,
        'a copy of a group is a group, not a loose pile',
        'DUPLICATING A GROUP DID NOT GROUP THE COPIES'));

    /* 29. A GROUP OF ONE IS NOT A GROUP. Deleting a member leaves the record
       holding one id, and pruneGroups runs from refreshUI - which every op in
       the app already calls - so no op has to know groups exist. */
    var gPrune = A.groups[A.groups.length - 1];
    var victim = k.findObject(gPrune.childIds[0]);
    var gCount29 = A.groups.length;
    k.outlinerDelete(k.outTarget('object', victim.id));
    log('29.group_of_one_dissolves', gCount29 + ' groups, deleted one member of the last one -> ' +
      A.groups.length + ' groups' +
      verdict(A.groups.length === gCount29 - 1,
        'the leftover object went loose instead of keeping a triangle to itself',
        'A GROUP OF ONE SURVIVED'));

    // 30. ungroup hands the members back loose, and the objects stay put.
    k.setMode('object');
    var g30 = A.groups[0];
    A.selectedObjectIds = new Set([g30.childIds[0]]);
    k.refreshUI();
    var kept = A.objects.length;
    k.ungroupSelection();
    log('30.ungroup_keeps_the_objects', 'groups now ' + A.groups.length +
      ', objects ' + kept + ' -> ' + A.objects.length +
      verdict(A.groups.length === 0 && A.objects.length === kept,
        'the grouping went and every object stayed',
        'UNGROUP TOOK THE OBJECTS WITH IT'));

    /* 31. THE FILE. Ids only, `open` deliberately absent, and a document from
       before this version - no `groups` key at all - has to load clean rather
       than throw. */
    k.setMode('object');
    A.selectedObjectIds = new Set([p.id, q.id]);
    k.refreshUI();
    k.groupSelection();
    var doc = k.serializeDoc();
    var wroteOpen = JSON.stringify(doc.groups).indexOf('open') >= 0;
    k.restoreDoc(doc);
    var round = A.groups.length === 1 && A.groups[0].childIds.length === 2;
    var old = k.serializeDoc();
    delete old.groups;
    var threw = '';
    try { k.restoreDoc(old); } catch (e) { threw = String(e && e.message || e); }
    log('31.groups_round_trip', 'saved ' + doc.groups.length + ' group(s), wrote "open"=' + wroteOpen +
      ', reloaded intact=' + round +
      ', a file with no groups key loaded with ' + A.groups.length +
      ' groups' + (threw ? ' AND THREW: ' + threw : '') +
      verdict(round && !wroteOpen && !threw && A.groups.length === 0,
        'grouping survives the round trip, and an older file still opens',
        'THE FILE LOST THE GROUPING, or an older file broke it'));


    /* 32. GROUPING IS AN UNDOABLE STEP. It was not: pushHistory dedupes on a
       signature of the model, `groups` was not in it, and a document that had
       just gained a group looked identical to the one before it - so no step
       was recorded at all and Group could not be taken back. */
    k.setMode('object');
    A.objects.slice().forEach(function (o) { k.removeObjects([o]); });
    A.groups = [];
    var u1 = cube('Undo A', -3), u2 = cube('Undo B', 0);
    A.selectedObjectIds = new Set([u1.id, u2.id]);
    k.refreshUI();
    k.pushHistory();
    var gAtBase = A.groups.length;
    k.groupSelection();
    var gAfter = A.groups.length;
    k.undo();
    var gUndone = A.groups.length;
    k.redo();
    log('32.group_is_undoable', 'groups: base ' + gAtBase + ' -> grouped ' + gAfter +
      ' -> undo ' + gUndone + ' -> redo ' + A.groups.length +
      verdict(gAtBase === 0 && gAfter === 1 && gUndone === 0 && A.groups.length === 1,
        'Group recorded a step, Undo took it back and Redo put it there again',
        'GROUPING WAS NOT RECORDED IN HISTORY'));

    /* 33. A BOX THAT CATCHES PART OF A GROUP TAKES ALL OF IT. Region select
       writes the selection set by hand rather than going through the tap, so
       without expanding it a box over two legs of a grouped chair dragged two
       legs - the group's contract quietly not holding, with nothing on screen
       to say so. */
    A.objects.slice().forEach(function (o) { k.removeObjects([o]); });
    A.groups = [];
    var b1 = cube('Box A', -6), b2 = cube('Box B', -3), b3 = cube('Box C', 9);
    /* Coordinates are VIEWPORT-RELATIVE, the space worldToScreen returns -
       page coordinates would silently shift the whole test region down by the
       toolbars. */
    var vpB = document.getElementById('viewport').getBoundingClientRect();
    var box = { kind: 'box', x0: 0, y0: 0, x1: vpB.width * 0.5, y1: vpB.height };
    // THE FIXTURE PROVES ITSELF FIRST. A box that happened to catch all three
    // would "pass" the real test below while measuring nothing.
    A.selectedObjectIds = new Set(); k.refreshUI();
    k.performRegionSelect(box);
    var raw = A.selectedObjectIds.size;
    A.selectedObjectIds = new Set([b1.id, b2.id, b3.id]);
    k.refreshUI();
    k.groupSelection();
    A.selectedObjectIds = new Set(); k.refreshUI();
    k.performRegionSelect(box);
    var got = A.selectedObjectIds.size;
    k.shrinkSelection();
    var shrunk = A.selectedObjectIds.size;
    log('33.region_takes_whole_group', 'ungrouped, that box caught ' + raw +
      ' of 3; grouped it selected ' + got + '; Shrink then left ' + shrunk +
      verdict(raw > 0 && raw < 3 && got === 3 && shrunk === 3,
        'part of a group in the box is the WHOLE group selected, and Shrink keeps it whole',
        raw <= 0 || raw >= 3
          ? 'THE FIXTURE IS WRONG - the box caught ' + raw + ' of 3 before grouping'
          : 'A BOX SELECT TOOK HALF A GROUP'));

    /* 34. ONE QUESTION, ONE ANSWER. The outliner swipe re-grouped its copies
       and the ring did not, so duplicating the same group two ways gave a
       group one way and a loose pile the other - and the ring is the COMMON
       way, because a viewport tap already takes the whole group. */
    A.objects.slice().forEach(function (o) { k.removeObjects([o]); });
    A.groups = [];
    var d1 = cube('Dup A', -3), d2 = cube('Dup B', 0);
    A.selectedObjectIds = new Set([d1.id, d2.id]);
    k.refreshUI();
    k.groupSelection();
    A.selectedObjectIds = new Set([d1.id, d2.id]);
    k.refreshUI();
    var gDup = A.groups.length;
    k.duplicateSelection();
    var newG34 = A.groups[A.groups.length - 1];
    log('34.ring_duplicate_regroups', 'groups ' + gDup + ' -> ' + A.groups.length +
      ', objects ' + A.objects.length + ', the new group holds ' +
      (newG34 ? newG34.childIds.length : 0) +
      verdict(A.groups.length === gDup + 1 && newG34 && newG34.childIds.length === 2,
        'Duplicate from the ring answers the same as the swipe on the row',
        'THE RING DUPLICATED A GROUP INTO A LOOSE PILE'));

    /* 35. A PARTLY HIDDEN GROUP COMES BACK RATHER THAN BEING SELECTED INTO.
       The first cut asked whether the WHOLE group was hidden, so a group with
       one child hidden on its own fell through and selected an object nobody
       could see - the very trap the object row was fixed for. */
    A.objects.slice().forEach(function (o) { k.removeObjects([o]); });
    A.groups = [];
    var h1 = cube('Hid A', -6), h2 = cube('Hid B', -3), h3 = cube('Hid C', 3);
    A.selectedObjectIds = new Set([h1.id, h2.id]);
    k.refreshUI();
    k.groupSelection();
    A.hidden = new Set([h2.id]);
    A.selectedObjectIds = new Set();
    k.refreshUI(); k.setOutlinerOpen(true); k.refreshOutliner();
    groupRowFor(A.groups[0].name).click();
    log('35.partly_hidden_group_unhides', 'one of two members was hidden; after the tap: hidden=' +
      A.hidden.size + ' selected=' + A.selectedObjectIds.size +
      verdict(A.hidden.size === 0 && A.selectedObjectIds.size === 0,
        'it came back, and did NOT become a selection holding an invisible object',
        'TAPPING A PARTLY HIDDEN GROUP SELECTED WHAT NOBODY COULD SEE'));

    /* 36. AND YOU CAN ADD TO A GROUP. This is the guard that made Group and
       Ungroup two seats at a2.93: sharing one seat on the test "does the
       selection touch a group" made Group vanish the moment any part of the
       selection was grouped, so a group of three could never gain a fourth.

       They share a seat again since a2.109, on a different test - is the
       selection exactly the thing you would dissolve - and this section is
       what proves the old bug did not come back with it. A MIXED selection
       must still say Group, and running the seat must ADD rather than start
       over. */
    A.selectedObjectIds = new Set([h1.id, h2.id, h3.id]);
    k.refreshUI();
    var word36 = groupingWord();
    var t36 = k.currentHubTools().filter(function (x) { return x.key === 'grouping'; })[0];
    if (t36) t36.run(); else k.groupSelection();
    var g36 = A.groups[0];
    log('36.can_add_to_a_group', 'mixed selection, seat says "' + word36 +
      '"; after running it: ' + A.groups.length +
      ' group(s) of ' + (g36 ? g36.childIds.length : 0) +
      verdict(word36 === 'Group' && A.groups.length === 1 && g36.childIds.length === 3,
        'the seat offered Group, and the third object joined the existing group',
        'GROUP WAS UNREACHABLE ONCE ANYTHING WAS GROUPED'));

    // ---- 12. an empty scene says so ----
    A.objects.slice().forEach(function (o) { k.removeObjects([o]); });
    k.refreshOutliner();
    log('12.empty_scene', 'rows=' + rows().length +
      ', says "' + ((document.getElementById('outEmpty') || {}).textContent || '') + '"' +
      verdict(rows().length === 0 && !!document.getElementById('outEmpty'),
        'an empty list explains itself instead of being a blank panel',
        'AN EMPTY SCENE LEAVES A BLANK SHELF'));

    liftTests(function () {
      dblTap(function () {
        log('console.errors', errs.length ? errs.join(' | ').slice(0, 300) : 'none');
        done();
      });
    });
  }

  /* ---- THE PICK-UP (a2.94) ----
     Every section here waits: a hold is a wait by definition, and a probe
     that fired the timer by hand would not be measuring the gesture. */
  function liftTests(done) {
    k.setMode('object');
    A.objects.slice().forEach(function (o) { k.removeObjects([o]); });
    A.groups = [];
    var a = cube('One', -6), b = cube('Two', -3), c = cube('Three', 3);
    k.setOutlinerOpen(true); k.refreshOutliner();

    /* 37. A HOLD THAT MOVES FIRST IS NOT A HOLD. Both other gestures have to
       keep starting instantly - nobody waits out a timer to flick a list. */
    var r37 = rowFor('One');
    press(r37);
    var rr = r37.getBoundingClientRect();
    pt(r37, 'pointermove', rr.left + 20 + 30, rr.top + rr.height / 2);
    setTimeout(function () {
      var liftedAnyway = !!k.outLift;
      pt(r37, 'pointerup', rr.left + 50, rr.top + rr.height / 2);
      log('37.movement_beats_the_hold', 'moved 30px sideways during the hold; lifted=' + liftedAnyway +
        verdict(!liftedAnyway,
          'the hold was dropped by the first few pixels, so the swipe still owns that drag',
          'A MOVING FINGER STILL LIFTED THE ROW'));

      // 38. and a still one does lift.
      k.refreshOutliner();
      var r38 = rowFor('One');
      press(r38);
      setTimeout(function () {
        var lifted = !!k.outLift;
        var cls = lifted && k.outLift.row.classList.contains('outLifted');
        log('38.hold_lifts', 'after ' + k.OUT_HOLD_MS + 'ms still: lifted=' + lifted +
          ' rowMarked=' + cls +
          verdict(lifted && cls, 'holding still picks the row up',
            'A HOLD DID NOT LIFT THE ROW'));
        if (!lifted) { k.endOutlinerLift(false); return step39(); }

        /* 39. DROPPED BETWEEN TWO ROWS IT REORDERS - and nothing else about
           the scene changes. */
        /* MOVED AND DROPPED IN ONE TICK, deliberately: no animation frame gets
           to run in between. This started as a flaky failure and turned out to
           be a real defect - the drop was being read off the last painted
           frame, so a finger that moves fast and lets go immediately landed
           where the stale frame said. It is resolved at the lift now, and this
           is the shape of gesture that proves it. */
        var third = rowFor('Three');
        var e = edgeOf(third, true);
        var before39 = A.objects.length;
        var staleFrame = k.outLift && k.outLift.drop;
        moveTo(e.x, e.y);
        dropAt(e.x, e.y);
        log('39.drop_between_reorders', 'moved and lifted within one tick (the last frame said ' +
          (staleFrame ? staleFrame.kind : 'nothing') + '); order now: ' + order() +
          ' (objects ' + before39 + ' -> ' + A.objects.length +
          ', groups ' + A.groups.length + ')' +
          verdict(order() === 'Two Three One' && A.objects.length === before39 &&
                  A.groups.length === 0,
            'One moved to the end - the drop read the finger, not the last frame',
            'A DROP BETWEEN ROWS DID NOT REORDER'));
        step39();
      }, k.OUT_HOLD_MS + 120);
    }, k.OUT_HOLD_MS + 120);

    function step39() {
      /* 40. DROPPED ONTO A ROW IT GROUPS. The middle band of a row means
         "into", its edges mean "between" - the two are the whole gesture and
         must never be confused. */
      k.refreshOutliner();
      var r40 = rowFor('Two');
      press(r40);
      setTimeout(function () {
        if (!k.outLift) {
          log('40.drop_onto_groups', 'THE ROW DID NOT LIFT');
          return step40();
        }
        var m = midOf(rowFor('Three'));
        moveTo(m.x, m.y);
        setTimeout(function () {
          var painted = !!document.querySelector('.outRow.outDropInto');
          var lineShown = getComputedStyle(document.getElementById('outLine')).display !== 'none';
          dropAt(m.x, m.y);
          log('40.drop_onto_groups', 'target outlined=' + painted + ' insertion line shown=' + lineShown +
            '; groups=' + A.groups.length + ' holding ' +
            (A.groups[0] ? A.groups[0].childIds.length : 0) + ', order: ' + order() +
            verdict(painted && !lineShown && A.groups.length === 1 &&
                    A.groups[0].childIds.length === 2,
              'the outline said group, the line stayed away, and a group of two appeared',
              'A DROP ONTO A ROW DID NOT GROUP, or drew both answers at once'));
          step40();
        }, 60);
      }, k.OUT_HOLD_MS + 120);
    }

    function step40() {
      /* 41. AND A CHILD DRAGGED OUT LEAVES ITS GROUP - which is the only way
         to take one object back out without dissolving the whole thing. */
      k.refreshOutliner();
      var g = A.groups[0];
      if (!g) { log('41.child_dragged_out_ungroups', 'NO GROUP TO DRAG OUT OF'); return step41(); }
      var childName = k.findObject(g.childIds[0]).name;
      var r41 = rowFor(childName);
      press(r41);
      setTimeout(function () {
        if (!k.outLift) { log('41.child_dragged_out_ungroups', 'THE CHILD DID NOT LIFT'); return step41(); }
        var last = k.outSlots()[k.outSlots().length - 1];
        var e = edgeOf(last, true);
        moveTo(e.x, e.y + 20);
        setTimeout(function () {
          var objs = A.objects.length;
          dropAt(e.x, e.y + 20);
          log('41.child_dragged_out_ungroups', 'dragged "' + childName + '" past the end: groups=' +
            A.groups.length + ', still in a group=' + !!k.groupOf(k.findObject(A.objects[0].id).id === 0) +
            ', objects ' + objs + ' -> ' + A.objects.length + ', order: ' + order() +
            verdict(A.objects.length === objs && A.groups.length === 0,
              'it came out, and the group of one dissolved behind it',
              'DRAGGING A CHILD OUT DID NOT UNGROUP IT'));
          step41();
        }, 60);
      }, k.OUT_HOLD_MS + 120);
    }

    function step41() {
      /* 42. A CANCELLED LIFT CHANGES NOTHING AND RECORDS NOTHING. Escape, or
         the browser taking the pointer away - a reorder you backed out of
         must not sit in the undo stack. */
      k.refreshOutliner();
      var was = objNames();
      k.pushHistory();
      var depth = A.history.length;
      var r42 = rowFor(k.findObject(A.objects[0].id).name);
      press(r42);
      setTimeout(function () {
        if (!k.outLift) { log('42.cancel_changes_nothing', 'THE ROW DID NOT LIFT'); return step42(); }
        var lastSlot = k.outSlots()[k.outSlots().length - 1];
        var e = edgeOf(lastSlot, true);
        moveTo(e.x, e.y);
        setTimeout(function () {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
          var stillLifted = !!k.outLift;
          log('42.cancel_changes_nothing', 'order before "' + was + '", after Escape "' + objNames() +
            '", history ' + depth + ' -> ' + A.history.length + ', still lifted=' + stillLifted +
            verdict(!stillLifted && objNames() === was && A.history.length === depth,
              'Escape put the row back, changed nothing and recorded nothing',
              'A CANCELLED LIFT LEFT A CHANGE or a history step'));
          step42();
        }, 60);
      }, k.OUT_HOLD_MS + 120);
    }

    // ---- the five the review turned up ----
    function threeFresh() {
      k.setMode('object');
      A.objects.slice().forEach(function (o) { k.removeObjects([o]); });
      A.groups = [];
      cube('P', -6); cube('Q', -3); cube('R', 3);
      k.setOutlinerOpen(true); k.refreshOutliner();
    }

    function step42() {
      /* 43. A DOWNWARD DROP LANDS WHERE THE LINE SAID. The index used to be
         worked out against the list with the dragged row STILL IN IT, and the
         detach then shifted everything below its old place - so every drop
         downwards landed one slot too low. Dragging UP was correct, which is
         exactly how this survives being tried by hand. Section 39 missed it
         too: it dropped at the very END, where the clamp hides it. */
      threeFresh();
      press(rowFor('P'));
      setTimeout(function () {
        if (!k.outLift) { log('43.downward_drop_is_exact', 'THE ROW DID NOT LIFT'); return step43(); }
        var e = edgeOf(rowFor('Q'), true);     // the LOWER half of Q
        moveTo(e.x, e.y); dropAt(e.x, e.y);
        log('43.downward_drop_is_exact', 'held P and dropped on the lower half of Q: ' + order() +
          verdict(order() === 'Q P R',
            'it landed between Q and R, where the line was',
            'A DOWNWARD DROP LANDED A SLOT TOO LOW'));
        step43();
      }, k.OUT_HOLD_MS + 120);
    }

    function step43() {
      /* 44. AND THE NEUTRAL POSITION IS A NO-OP. Dropping a row back where it
         came from must change nothing AND record nothing - the same off-by-one
         made it move the row and push a history step for a gesture the user
         read as "leave it". */
      threeFresh();
      var was = objNames();
      k.pushHistory();
      var depth = A.history.length;
      press(rowFor('Q'));
      setTimeout(function () {
        if (!k.outLift) { log('44.neutral_drop_is_a_no_op', 'THE ROW DID NOT LIFT'); return step44(); }
        var e = edgeOf(rowFor('Q'), false);   // its own upper edge: put it back
        moveTo(e.x, e.y); dropAt(e.x, e.y);
        log('44.neutral_drop_is_a_no_op', '"' + was + '" -> "' + objNames() +
          '", history ' + depth + ' -> ' + A.history.length +
          verdict(objNames() === was && A.history.length === depth,
            'putting a row back where it was changed nothing and recorded nothing',
            'A NEUTRAL DROP MOVED THE ROW or pushed a step'));
        step44();
      }, k.OUT_HOLD_MS + 120);
    }

    function step44() {
      /* 45. THE GAP BETWEEN TWO ROWS IS A BOUNDARY, NOT THE END OF THE LIST.
         #outList sets gap: 4px, and skipping any slot that did not contain the
         pointer sent every crossing of a row boundary to the fallback - so a
         release in that band moved the row to the very end. */
      threeFresh();
      press(rowFor('P'));
      setTimeout(function () {
        if (!k.outLift) { log('45.the_gap_is_a_boundary', 'THE ROW DID NOT LIFT'); return step45(); }
        var slots = k.outSlots();
        var qs = slots[1].getBoundingClientRect(), rs = slots[2].getBoundingClientRect();
        var gap = rs.top - qs.bottom;
        var y = qs.bottom + gap / 2;
        moveTo(qs.left + 20, y); dropAt(qs.left + 20, y);
        log('45.the_gap_is_a_boundary', 'released in the ' + gap.toFixed(0) +
          'px gap between Q and R: ' + order() +
          verdict(gap > 0 && order() === 'Q P R',
            'the gap resolved to the boundary it sits in, not to the end of the list',
            gap <= 0 ? 'THE FIXTURE IS WRONG - there is no gap between the rows'
                     : 'A RELEASE IN THE GAP JUMPED TO THE END OF THE LIST'));
        step45();
      }, k.OUT_HOLD_MS + 120);
    }

    function step45() {
      /* 46. THE LINE AND THE ACTION AGREE. A group cannot go inside anything,
         so hovering another group's CHILD resolves to a boundary of that whole
         group - and the line has to be drawn at the block edge, not inside the
         group the drop is about to step over. */
      k.setMode('object');
      A.objects.slice().forEach(function (o) { k.removeObjects([o]); });
      A.groups = [];
      var m1 = cube('M1', -6), m2 = cube('M2', -3), lone = cube('Solo', 3);
      A.selectedObjectIds = new Set([m1.id, m2.id]);
      k.refreshUI();
      k.groupSelection();
      A.selectedObjectIds = new Set([lone.id]);
      k.refreshUI();
      A.selectedObjectIds = new Set([lone.id]);
      // A second group, so that a GROUP is what gets lifted.
      var s1 = cube('S1', 6), s2 = cube('S2', 9);
      A.selectedObjectIds = new Set([s1.id, s2.id]);
      k.refreshUI();
      k.groupSelection();
      k.refreshOutliner();
      var lifted = groupRowFor(A.groups[1].name);
      press(lifted);
      setTimeout(function () {
        if (!k.outLift) { log('46.line_matches_the_action', 'THE GROUP DID NOT LIFT'); return step46(); }
        var firstChild = rowFor('M2');           // the SECOND child of group one
        var e = edgeOf(firstChild, false);
        moveTo(e.x, e.y);
        setTimeout(function () {
          var line = document.getElementById('outLine');
          var shown = getComputedStyle(line).display !== 'none';
          var lineTop = line.getBoundingClientRect().top;
          var groupSlot = k.outSlots().filter(function (sl) {
            return sl.dataset.kind === 'group' && sl.dataset.id === String(A.groups[0].id);
          })[0];
          var gTop = groupSlot.getBoundingClientRect().top;
          var childTop = firstChild.getBoundingClientRect().top;
          k.endOutlinerLift(false);
          log('46.line_matches_the_action', 'line shown=' + shown + ' at y ' + lineTop.toFixed(0) +
            '; that group starts at ' + gTop.toFixed(0) + ' and the hovered child at ' + childTop.toFixed(0) +
            verdict(shown && Math.abs(lineTop - gTop) < 4 && Math.abs(lineTop - childTop) > 4,
              'the line sits at the edge of the whole block the drop would step over',
              'THE LINE WAS DRAWN INSIDE A GROUP THE DROP WOULD STEP OVER'));
          step46();
        }, 60);
      }, k.OUT_HOLD_MS + 120);
    }

    function step46() {
      /* 47. A HOLD WHOSE ROW IS REBUILT AWAY MUST NOT LIFT. Its pointerup goes
         with the element, so nothing would ever end the lift: the frame loop
         and four document listeners would run for ever - including the
         non-passive touchmove that preventDefaults EVERY touch on the page.
         On a phone there is no Escape, so that is the app dead until reload. */
      threeFresh();
      var doomed = rowFor('P');
      press(doomed);
      k.refreshOutliner();          // the row the finger is on leaves the page
      setTimeout(function () {
        var lifted = !!k.outLift;
        if (lifted) k.endOutlinerLift(false);
        log('47.detached_row_never_lifts', 'the row was rebuilt away during the hold; lifted=' + lifted +
          ' (still connected=' + doomed.isConnected + ')' +
          verdict(!lifted && !doomed.isConnected,
            'the timer found the row gone and stood down',
            'A LIFT STARTED ON A ROW THAT HAD LEFT THE PAGE'));
        done();
      }, k.OUT_HOLD_MS + 150);
    }
  }

  /* 18. TWO TAPS OPEN THE RENAME - and it has to be measured across a tick,
     because the app defers the box until after the click the second tap
     still has to fire. The pair is remembered by object id, not by element:
     the first tap selects, and selecting rebuilds every row. */
  function dblTap(cb) {
    var d = cube('Dbl', 0);
    k.setOutlinerOpen(true); k.refreshOutliner();
    tap(rowFor('Dbl'));
    tap(rowFor('Dbl'));   // looked up again on purpose - that row is a new one
    setTimeout(function () {
      var box = document.querySelector('.outRename');
      var onRow = box && box.closest('.outRow');
      log('18.double_tap_renames', 'box after two taps=' + !!box +
        ', on the row for "' + (onRow ? onRow.querySelector('.outName').textContent : '-') + '"' +
        verdict(!!box && onRow && onRow.dataset.objId === String(d.id),
          'the second tap opened that row name for editing',
          'A DOUBLE TAP DID NOT OPEN THE RENAME'));
      if (box) box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      cb();
    }, 60);
  }

  var posted = false;
  function post() {
    if (posted) return;
    posted = true;
    try { fetch('/result', { method: 'POST', body: out.join('\n') }); } catch (e) {}
  }
  setTimeout(function () {
    if (!posted) { out.push('WATCHDOG=main did not finish - the last line above is where it hung'); post(); }
  }, 45000);
  function ready(cb, t) {
    t = t || 0;
    if (window.__kubik && window.__kubik.App) return cb();
    if (t > 400) { out.push('ERROR=no __kubik'); return post(); }
    setTimeout(function () { ready(cb, t + 1); }, 20);
  }
  window.addEventListener('error', function (e) { errs.push('onerror: ' + (e.message || e)); });
  setTimeout(function () {
    ready(function () {
      setTimeout(function () {
        try { main(post); }
        catch (e) {
          out.push('ERROR=' + (e && e.stack ? e.stack.split('\n').slice(0, 8).join(' / ') : e));
          post();
        }
      }, 800);
    });
  }, 400);
})();
