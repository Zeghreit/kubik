/* _ptedit - curve point editing (v2.19).

   The three gestures are one gesture with three meanings, decided by what is
   under the finger and whether it moved, so every section here drives the
   real pointer path rather than the edit underneath it. A probe that called
   curveEditInsert directly would pass while the tap that reaches it was
   unreachable, which is the whole failure mode of a gesture. */
(function () {
  const OUT = [];
  let fails = 0;
  const say = s => OUT.push(s);
  const ok = (name, cond, detail) => {
    if (!cond) fails++;
    say((cond ? 'PASS ' : 'FAIL ') + name + (detail === undefined ? '' : '  ' + detail));
  };
  const post = (p, b) => { try { const x = new XMLHttpRequest(); x.open('POST', p, true); x.send(b); } catch (e) {} };
  const mark = s => post('/mark', 'at: ' + s + '\n' + OUT.join('\n'));
  function finish(extra) {
    if (extra) say(extra);
    say('VERDICT=' + (fails ? 'FAIL' : 'PASS') + ' (' + fails + ' failed)');
    post('/done', OUT.join('\n'));
  }

  let K = null, rect = null;
  const V = (x, y, z) => new K.THREE.Vector3(x, y, z);

  function clearScene() {
    K.App.objects.slice().forEach(o => { try { o.mesh.parent.remove(o.mesh); } catch (e) {} });
    K.App.objects.length = 0;
    K.App.selectedObjectIds = new Set();
    K.App.activeObjectId = null;
    K.App.mode = 'object';
  }

  function mkCurve(name, pts, opts) {
    return K.createCurveObject(name, V(0, 0, 0), pts.map(a => V(a[0], a[1], a[2])), opts || {});
  }

  // A world point, in client pixels - which is what a pointer event carries.
  function at(v) {
    const sp = K.worldToScreenPx(v);
    return sp ? { x: rect.left + sp.x, y: rect.top + sp.y } : null;
  }
  const ev = (x, y) => ({ clientX: x, clientY: y, pointerId: 4, button: 0 });

  // One tap: down and up in the same place, the way a still finger does it.
  function tap(pt) {
    K.curveEditPointerDown(ev(pt.x, pt.y));
    K.curveEditPointerUp(ev(pt.x, pt.y));
  }
  // One drag: down, past the decide threshold, then up.
  function drag(from, to) {
    K.curveEditPointerDown(ev(from.x, from.y));
    K.curveEditPointerMove(ev(from.x + (to.x - from.x) * 0.5, from.y + (to.y - from.y) * 0.5));
    K.curveEditPointerMove(ev(to.x, to.y));
    K.curveEditPointerUp(ev(to.x, to.y));
  }
  const pts = (o) => o.mesh.userData.kubikCurve.pts;
  const radii = (o) => o.mesh.userData.kubikCurve.radii;

  async function run() {
    K = window.__kubik;
    if (!K) { finish('__kubik is undefined - the app never started'); return; }
    rect = document.getElementById('viewport').getBoundingClientRect();
    ok('0.boot  app up, the point editor exported',
       !!K.App && typeof K.startCurveEdit === 'function' &&
       typeof K.curveEditPointerUp === 'function');
    if (typeof K.startCurveEdit !== 'function') { finish(); return; }
    mark('0.boot');

    /* 1 -- THE DOOR. Component mode on a curve used to refuse outright. All
       three buttons open the editor now, and App.mode must NOT move: every
       picker and overlay in the app reads it and none of them knows what a
       curve is. */
    clearScene();
    const c1 = mkCurve('C', [[-1, 0, 0], [0, 0, 0], [1, 0, 0]], { type: 'poly', res: 4 });
    K.App.selectedObjectIds = new Set([c1.id]);
    K.setMode('vertex');
    ok('1.door   Component mode on a curve opens the point editor',
       !!K.curveEdit && K.curveEdit.objId === c1.id, 'edit=' + !!K.curveEdit);
    ok('1.door   and the app is still in Object mode underneath it',
       K.App.mode === 'object', 'mode=' + K.App.mode);
    K.setMode('edge');
    ok('1.door   a second component button does not restart it',
       !!K.curveEdit && K.curveEdit.objId === c1.id);
    K.setMode('object');
    ok('1.door   Object mode closes it, keeping the points',
       !K.curveEdit && pts(c1).length === 3, 'points=' + pts(c1).length);

    // Two curves at once is still a refusal - it names one object or none.
    const c1b = mkCurve('D', [[0, 2, 0], [1, 2, 0]], { type: 'poly', res: 4 });
    K.App.selectedObjectIds = new Set([c1.id, c1b.id]);
    K.setMode('vertex');
    ok('1.door   two curves at once is refused, not guessed at',
       !K.curveEdit && K.App.mode === 'object');
    mark('1.door');

    /* 2 -- DRAG A POINT. On the curve's own plane, written back in the
       curve's own space - the middle point of a flat line, pulled up. */
    clearScene();
    const c2 = mkCurve('C', [[-1, 0, 0], [0, 0, 0], [1, 0, 0]], { type: 'poly', res: 4 });
    K.App.selectedObjectIds = new Set([c2.id]);
    K.startCurveEdit(c2);
    K.curveEdit.plane = 'z';          // the plane the camera faces down
    const midPx = at(V(0, 0, 0));
    ok('2.drag   the middle point is on screen', !!midPx);
    drag(midPx, { x: midPx.x, y: midPx.y - 80 });
    ok('2.drag   dragging a point moves THAT point, and only it',
       Math.abs(pts(c2)[1][1]) > 0.05 &&
       Math.abs(pts(c2)[0][0] + 1) < 1e-9 && Math.abs(pts(c2)[2][0] - 1) < 1e-9,
       JSON.stringify(pts(c2)));
    ok('2.drag   and it did not add one',
       pts(c2).length === 3, 'points=' + pts(c2).length);
    ok('2.drag   the point it moved is the selected one',
       K.curveEdit.sel === 1, 'sel=' + K.curveEdit.sel);
    mark('2.drag');

    /* 3 -- TAP THE LINE INSERTS, and it inserts INTO THAT SPAN rather than at
       the end. Tapped between points 0 and 1, so the new one has to land at
       index 1 and the old middle has to shift to 2. */
    clearScene();
    const c3 = mkCurve('C', [[-1, 0, 0], [0, 0, 0], [1, 0, 0]], { type: 'poly', res: 4 });
    K.App.selectedObjectIds = new Set([c3.id]);
    K.startCurveEdit(c3);
    tap(at(V(-0.5, 0, 0)));
    ok('3.insert tapping the line adds a point in THAT span',
       pts(c3).length === 4 && Math.abs(pts(c3)[1][0] + 0.5) < 0.05,
       JSON.stringify(pts(c3)));
    ok('3.insert the points either side are untouched',
       Math.abs(pts(c3)[0][0] + 1) < 1e-9 && Math.abs(pts(c3)[2][0]) < 1e-9,
       JSON.stringify(pts(c3)));
    ok('3.insert and the new point is the selected one',
       K.curveEdit.sel === 1, 'sel=' + K.curveEdit.sel);

    /* The radius comes with it. A taper with a point inserted into it must
       not grow a bulge - the new point takes the thickness that was already
       there, which is the average of its two neighbours halfway along. */
    radii(c3)[0] = 1; radii(c3)[1] = 1; radii(c3)[2] = 3; radii(c3)[3] = 3;
    K.rebuildCurveGeometry(c3);
    tap(at(V(0.5, 0, 0)));
    const ins = K.curveEdit.sel;
    ok('3.insert the new point takes the thickness already at that spot',
       pts(c3).length === 5 && radii(c3)[ins] > 2.5 && radii(c3)[ins] <= 3.0001,
       'radii=' + JSON.stringify(radii(c3).map(v => +v.toFixed(3))));
    ok('3.insert one radius per point, still',
       radii(c3).length === pts(c3).length,
       radii(c3).length + ' vs ' + pts(c3).length);
    mark('3.insert');

    /* 4 -- TAP AWAY APPENDS, which is how you carry on a curve you drew
       yesterday. It goes on the END, not into the nearest span. */
    clearScene();
    const c4 = mkCurve('C', [[-1, 0, 0], [0, 0, 0]], { type: 'poly', res: 4 });
    K.App.selectedObjectIds = new Set([c4.id]);
    K.startCurveEdit(c4);
    K.curveEdit.plane = 'z';
    radii(c4)[1] = 2.5;
    tap(at(V(2, 1.5, 0)));
    ok('4.append a tap in open space carries the curve on from its end',
       pts(c4).length === 3 && Math.abs(pts(c4)[2][0] - 2) < 0.2,
       JSON.stringify(pts(c4).map(a => a.map(v => +v.toFixed(2)))));
    ok('4.append and it carries on at the thickness it ended at',
       Math.abs(radii(c4)[2] - 2.5) < 1e-9, 'radii=' + JSON.stringify(radii(c4)));
    mark('4.append');

    /* 5 -- DELETE takes the point, and refuses to take the curve. */
    clearScene();
    const c5 = mkCurve('C', [[-1, 0, 0], [0, 0, 0], [1, 0, 0]], { type: 'poly', res: 4 });
    K.App.selectedObjectIds = new Set([c5.id]);
    K.startCurveEdit(c5);
    tap(at(V(0, 0, 0)));                       // select the middle one
    ok('5.delete tapping a point selects it without moving it',
       K.curveEdit.sel === 1 && pts(c5).length === 3 &&
       Math.abs(pts(c5)[1][0]) < 1e-9, 'sel=' + K.curveEdit.sel);
    K.curveEditDelete();
    ok('5.delete Delete takes that point and its radius together',
       pts(c5).length === 2 && radii(c5).length === 2 &&
       Math.abs(pts(c5)[1][0] - 1) < 1e-9, JSON.stringify(pts(c5)));
    K.curveEditDelete();
    ok('5.delete and it refuses to leave a curve with one point',
       pts(c5).length === 2 && K.App.objects.length === 1,
       'points=' + pts(c5).length + ' objects=' + K.App.objects.length);
    mark('5.delete');

    /* 6 -- ONE STEP, AND A ✕ THAT MEANS IT. Everything above happens in the
       live curve from the first tap, so the bar's two buttons are the whole
       contract: OK is one history step for the lot, ✕ puts back exactly what
       was there. */
    clearScene();
    const c6 = mkCurve('C', [[-1, 0, 0], [0, 0, 0], [1, 0, 0]], { type: 'poly', res: 4 });
    K.App.selectedObjectIds = new Set([c6.id]);
    K.pushHistory();
    K.startCurveEdit(c6);
    K.curveEdit.plane = 'z';
    tap(at(V(-0.5, 0, 0)));
    tap(at(V(0.5, 0, 0)));
    drag(at(V(0, 0, 0)), { x: at(V(0, 0, 0)).x, y: at(V(0, 0, 0)).y - 60 });
    ok('6.commit nothing has reached the history yet',
       K.App.history.length === K.App.historyIndex + 1, 'index=' + K.App.historyIndex);
    K.finishCurveEdit(false);
    ok('6.commit Cancel puts every point back exactly as it was',
       pts(c6).length === 3 && Math.abs(pts(c6)[1][0]) < 1e-9 &&
       Math.abs(pts(c6)[1][1]) < 1e-9, JSON.stringify(pts(c6)));

    K.startCurveEdit(c6);
    K.curveEdit.plane = 'z';
    tap(at(V(-0.5, 0, 0)));
    tap(at(V(0.5, 0, 0)));
    K.finishCurveEdit(true);
    const after = pts(c6).length;
    K.undo();
    const back = K.App.objects.filter(K.isCurve)[0];
    ok('6.commit OK is ONE step, however many points it took',
       after === 5 && !!back && pts(back).length === 3,
       after + ' -> ' + (back ? pts(back).length : 'gone'));
    mark('6.commit');

    /* 7 -- A BEZIER'S LINE IS NOT ITS CONTROL POLYGON. Tapping the curve you
       can SEE has to insert into the span that piece of line came out of, and
       on a bend the two lines are a long way apart - so a hit test against the
       control polygon would either miss the tap or blame the wrong span. */
    clearScene();
    const c7 = mkCurve('C', [[-1, 0, 0], [0, 1.2, 0], [1, 0, 0], [2, 1.2, 0]],
                       { type: 'bezier', res: 8 });
    K.App.selectedObjectIds = new Set([c7.id]);
    K.startCurveEdit(c7);
    /* THE SAMPLE FURTHEST FROM ANY HANDLE, and the distance is asserted before
       it is tapped. The first draft took the third sample of the span, which
       on this curve sits INSIDE the grab radius of control point 1 - so the
       tap selected that point, correctly, and the section failed a working
       insert. A gesture test has to aim somewhere the other gesture cannot
       claim, and say so rather than assume it. */
    const S = [], sample = K.curveSamplePoints(c7.mesh.userData.kubikCurve, [], S);
    const handles = pts(c7).map(a => at(V(a[0], a[1], a[2])));
    const clearOf = (w) => {
      const q = at(w);
      if (!q) return -1;
      return Math.min.apply(null, handles.map(h => Math.hypot(h.x - q.x, h.y - q.y)));
    };
    let k = -1, kClear = -1;
    for (let i = 0; i < S.length; i++) {
      if (S[i] !== 1) continue;
      const c = clearOf(sample[i]);
      if (c > kClear) { kClear = c; k = i; }
    }
    ok('7.bezier the sampler names the span every sample came from',
       k > 0 && S[k] === 1, 'k=' + k + ' span=' + (k > 0 ? S[k] : 'none'));
    ok('7.bezier and the spot it aims at is clear of every handle',
       kClear > 40, 'nearest handle ' + kClear.toFixed(1) + 'px');
    tap(at(sample[k]));
    ok('7.bezier tapping the drawn line inserts into ITS span',
       pts(c7).length === 5 && K.curveEdit.sel === 2,
       'points=' + pts(c7).length + ' sel=' + K.curveEdit.sel);
    K.finishCurveEdit(false);
    mark('7.bezier');

    /* 8 -- IT LETS GO OF EVERYTHING IT TOOK. The editor turns the camera off
       for its own gesture and owns the Delete key; both have to come back
       however it ends, including the way restoreDoc ends it. */
    clearScene();
    const c8 = mkCurve('C', [[-1, 0, 0], [0, 0, 0], [1, 0, 0]], { type: 'poly', res: 4 });
    K.App.selectedObjectIds = new Set([c8.id]);
    K.startCurveEdit(c8);
    K.curveEditPointerDown(ev(at(V(0, 0, 0)).x, at(V(0, 0, 0)).y));
    K.finishCurveEdit(true);
    ok('8.release finishing mid-press hands the camera back',
       K.orbit.enabled === true && !K.curveEdit, 'orbit=' + K.orbit.enabled);

    K.startCurveEdit(c8);
    K.restoreDoc(K.serializeDoc(), {});
    ok('8.release a document loading underneath it drops it, quietly',
       !K.curveEdit && K.orbit.enabled === true);
    mark('8.release');

    /* 9 -- WHAT THE REVIEW FOUND (v2.19) ----------------------------------
       Nine defects, none in the arithmetic and all in the lifecycle. Each of
       these passed every section above while it was broken. */

    /* (a) A DRAG MUST NOT TELEPORT THE POINT ONTO A PLANE THROUGH THE ORIGIN.
       The work plane passes through the pivot, which is right for the first
       point of a new curve and wrong for one that already exists somewhere
       else: move the curve up and every point fell back to the ground on the
       first frame of the grab, before the finger had said anything. */
    clearScene();
    const c9 = mkCurve('C', [[-1, 0, 0], [0, 0, 0], [1, 0, 0]], { type: 'poly', res: 4 });
    c9.mesh.position.set(0, 5, 0);
    c9.mesh.updateMatrixWorld(true);
    K.App.selectedObjectIds = new Set([c9.id]);
    K.startCurveEdit(c9);
    K.curveEdit.plane = 'y';                  // the ground plane, five below
    const g0 = at(V(0, 5, 0));
    K.curveEditPointerDown(ev(g0.x, g0.y));
    K.curveEditPointerMove(ev(g0.x + 30, g0.y));
    ok('9.plane  a grab on a moved curve keeps the point in ITS plane',
       Math.abs(pts(c9)[1][1]) < 0.001, 'local y = ' + pts(c9)[1][1].toFixed(4));
    K.curveEditPointerUp(ev(g0.x + 30, g0.y));
    K.finishCurveEdit(false);

    /* (b) THE MODE BUTTON IS THE WAY OUT AS WELL AS THE WAY IN. The editor
       leaves App.mode alone, so the button's first branch ran every time and
       setMode's guard sent it straight back in - ten presses, nothing. */
    K.App.selectedObjectIds = new Set([c9.id]);
    K.cycleEditMode();
    ok('9.button the mode button opens it', !!K.curveEdit);
    K.cycleEditMode();
    ok('9.button and the same button closes it again', !K.curveEdit);

    /* (c) THE EDITOR CANNOT OUTLIVE WHAT IT EDITS. Stale, it held every
       single-finger press: no orbit, no selection, no ring. */
    K.startCurveEdit(c9);
    K.removeObjects([c9]);
    ok('9.gone   deleting the curve closes the editor and frees the camera',
       !K.curveEdit && K.orbit.enabled === true, 'edit=' + !!K.curveEdit);

    /* (d) ONE EDITOR AT A TIME, and picking another object ends this one.
       Re-entering used to overwrite the snapshot, leaving the first curve's
       edits live, outside the history and beyond recovery. */
    clearScene();
    const cA = mkCurve('A', [[-1, 0, 0], [0, 0, 0], [1, 0, 0]], { type: 'poly', res: 4 });
    const cB = mkCurve('B', [[-1, 3, 0], [0, 3, 0], [1, 3, 0]], { type: 'poly', res: 4 });
    K.App.selectedObjectIds = new Set([cA.id]);
    K.pushHistory();
    K.startCurveEdit(cA);
    K.curveEdit.plane = 'z';
    tap(at(V(-0.5, 0, 0)));                       // A now has four points
    K.selectObjectClick(cB.id, false, true);
    ok('9.swap   picking another object closes the editor it was in',
       !K.curveEdit && pts(cA).length === 4, 'edit=' + !!K.curveEdit);
    K.startCurveEdit(cB);
    ok('9.swap   and the second one edits the second curve',
       !!K.curveEdit && K.curveEdit.objId === cB.id);
    K.finishCurveEdit(false);
    ok('9.swap   whose Cancel leaves the FIRST curve alone',
       pts(cA).length === 4 && pts(cB).length === 3,
       'A=' + pts(cA).length + ' B=' + pts(cB).length);

    /* (e) A PUSH FROM ANYWHERE ELSE TAKES THE POINTS WITH IT. The outliner
       swipes push history over the top of the editor, and serializeDoc writes
       the LIVE curve - so the step carried points nothing had accepted and a
       ✕ afterwards left the scene and the history disagreeing. */
    clearScene();
    const cP = mkCurve('P', [[-1, 0, 0], [0, 0, 0], [1, 0, 0]], { type: 'poly', res: 4 });
    K.App.selectedObjectIds = new Set([cP.id]);
    K.pushHistory();
    K.startCurveEdit(cP);
    K.curveEdit.plane = 'z';
    tap(at(V(-0.5, 0, 0)));
    K.pushHistory();                              // something else commits
    ok('9.push   an outside push closes the editor into its own step',
       !K.curveEdit && pts(cP).length === 4, 'edit=' + !!K.curveEdit);
    K.undo();
    const backP = K.App.objects.filter(K.isCurve)[0];
    ok('9.push   and that step is one undo, with nothing left over',
       !!backP && pts(backP).length === 3, backP ? pts(backP).length : 'gone');

    /* (f) DELETING A POINT MUST NOT RE-AIM A DRAG THAT IS STILL HELD. The bar
       is DOM, so a second finger on Delete point is never seen by the pointer
       tracker and the two-finger bail-out does not fire: the first finger
       carried on dragging whatever had slid into that index. */
    clearScene();
    const cD = mkCurve('D', [[-2, 0, 0], [-1, 0, 0], [0, 0, 0], [1, 0, 0], [2, 0, 0]],
                       { type: 'poly', res: 4 });
    K.App.selectedObjectIds = new Set([cD.id]);
    K.startCurveEdit(cD);
    K.curveEdit.plane = 'z';
    const hold = at(V(0, 0, 0));
    K.curveEditPointerDown(ev(hold.x, hold.y));   // holding point 2
    K.curveEditDelete();                          // ...and it goes away
    K.curveEditPointerMove(ev(hold.x, hold.y - 90));
    ok('9.held   deleting the held point drops the drag rather than re-aiming it',
       pts(cD).length === 4 && pts(cD).every(a => Math.abs(a[1]) < 1e-9),
       JSON.stringify(pts(cD).map(a => a.map(v => +v.toFixed(2)))));
    K.curveEditPointerUp(ev(hold.x, hold.y - 90));
    K.finishCurveEdit(false);

    /* (g) A GRAB THAT DRIFTS IS STILL A GRAB. The press claims a point within
       34px; a release may drift 15px and still count as still - so a press
       30px from a point, drifting away from it, missed on the way out and
       ADDED one instead. */
    clearScene();
    const cG = mkCurve('G', [[-1, 0, 0], [0, 0, 0], [1, 0, 0]], { type: 'poly', res: 4 });
    K.App.selectedObjectIds = new Set([cG.id]);
    K.startCurveEdit(cG);
    K.curveEdit.plane = 'z';
    const near = at(V(0, 0, 0));
    K.curveEditPointerDown(ev(near.x + 30, near.y));
    K.curveEditPointerUp(ev(near.x + 44, near.y));
    ok('9.drift  a press that grabbed a point never adds one on the way out',
       pts(cG).length === 3 && K.curveEdit.sel === 1,
       'points=' + pts(cG).length + ' sel=' + K.curveEdit.sel);

    /* (h) A BARE MODIFIER MUST NOT COMMIT A SESSION YOU ARE STILL IN. */
    const key = (k, o) => window.dispatchEvent(new KeyboardEvent('keydown',
      Object.assign({ key: k, bubbles: true }, o || {})));
    key('Shift');
    ok('9.keys   leaning on Shift does not end the editing',
       !!K.curveEdit, 'edit=' + !!K.curveEdit);
    key('Escape');
    ok('9.keys   and Escape still does', !K.curveEdit);
    mark('9.review');

    /* 10 -- STEPPING BACK, HERE TOO (v2.21). The point editor is the other
       bar you sit in, and it had the same problem: one mis-drag and ✕ was
       the only way out, which took every good point with it. */
    clearScene();
    const cS = mkCurve('S', [[-1, 0, 0], [0, 0, 0], [1, 0, 0]], { type: 'poly', res: 4 });
    K.App.selectedObjectIds = new Set([cS.id]);
    K.pushHistory();
    K.startCurveEdit(cS);
    K.curveEdit.plane = 'z';
    ok('10.back  a fresh editor has nothing to step back yet',
       !K.curveEditHasSteps());

    tap(at(V(-0.5, 0, 0)));                      // insert
    tap(at(V(2, 1, 0)));                         // append
    ok('10.back  two edits are two steps',
       pts(cS).length === 5 && K.curveEdit.steps.length === 2,
       'points=' + pts(cS).length + ' steps=' + K.curveEdit.steps.length);

    K.undo();
    ok('10.back  Undo takes back the last edit and stays in the editor',
       !!K.curveEdit && pts(cS).length === 4,
       'points=' + pts(cS).length + ' edit=' + !!K.curveEdit);
    K.undo();
    ok('10.back  and then the one before it',
       !!K.curveEdit && pts(cS).length === 3 &&
       Math.abs(pts(cS)[1][0]) < 1e-9,
       JSON.stringify(pts(cS)));

    K.undo();
    ok('10.back  with nothing left inside, Undo backs out of the editor',
       !K.curveEdit && pts(cS).length === 3,
       'edit=' + !!K.curveEdit + ' points=' + pts(cS).length);

    // A drag is ONE step, however many frames it took.
    K.startCurveEdit(cS);
    K.curveEdit.plane = 'z';
    const mid10 = at(V(0, 0, 0));
    drag(mid10, { x: mid10.x, y: mid10.y - 80 });
    ok('10.back  a whole drag is one step',
       K.curveEdit.steps.length === 1 && Math.abs(pts(cS)[1][1]) > 0.05,
       'steps=' + K.curveEdit.steps.length + ' y=' + pts(cS)[1][1].toFixed(3));
    K.undo();
    ok('10.back  and one press puts it back where it was',
       !!K.curveEdit && Math.abs(pts(cS)[1][1]) < 1e-9,
       'y=' + pts(cS)[1][1]);
    K.finishCurveEdit(false);
    mark('10.back');

    finish();
  }

  setTimeout(() => {
    run().catch(e => { say('THREW ' + (e && e.stack ? e.stack : e)); fails++; finish(); });
  }, 3000);
})();
