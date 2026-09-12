/* v2.13 Booleans. Copies _fixchk's shape: prints VERDICT=PASS/FAIL, and is
   verified against a copy with the fix removed (_mkboolbroken.py). A probe
   that has never been shown to fail proves nothing.

   Running marks after every section, per the _poolchk rule: a stall then
   names the section it stalled in instead of saying nothing. */
(function () {
  const OUT = [];
  let fails = 0;
  const say = s => OUT.push(s);
  const ok = (name, cond, detail) => {
    if (!cond) fails++;
    say((cond ? 'PASS ' : 'FAIL ') + name + (detail === undefined ? '' : '  ' + detail));
  };
  const post = (path, body) => {
    try {
      const x = new XMLHttpRequest();
      x.open('POST', path, true);
      x.send(body);
    } catch (e) { /* nothing useful to do */ }
  };
  const mark = s => post('/mark', 'at: ' + s + '\n' + OUT.join('\n'));

  function finish(extra) {
    if (extra) say(extra);
    say('VERDICT=' + (fails ? 'FAIL' : 'PASS') + ' (' + fails + ' failed)');
    post('/done', OUT.join('\n'));
  }

  // ---- helpers -------------------------------------------------------
  let K = null;

  // toEditable, locally: the probe must be able to count open edges itself
  // rather than trust the op's own answer about whether it closed anything.
  function edOf(mesh) {
    const geo = mesh.geometry;
    const positions = Array.from(geo.attributes.position.array);
    const index = geo.index.array;
    const gs = K.faceRanges(geo);
    const groups = gs.map(g => {
      const triangles = [];
      for (let i = g.start; i < g.start + g.count; i += 3) {
        triangles.push([index[i], index[i + 1], index[i + 2]]);
      }
      return { triangles: triangles };
    });
    return { positions: positions, groups: groups };
  }

  function mk(name, kind, params, x, y, z) {
    const ed = K.buildPrimitiveEditable(kind, params || {});
    const mats = K.makeMaterialSet(ed.groups.length || 1, 0x9aa3b2);
    const p = new K.THREE.Vector3(x || 0, y || 0, z || 0);
    return K.createObjectFromEditable(name, p, ed, mats, {});
  }

  function clearScene() {
    K.App.objects.slice().forEach(o => { try { o.mesh.parent.remove(o.mesh); } catch (e) {} });
    K.App.objects.length = 0;
    K.App.selectedObjectIds = new Set();
    K.App.activeObjectId = null;
  }

  function select(objs) {
    K.App.selectedObjectIds = new Set(objs.map(o => o.id));
    K.App.activeObjectId = null;
  }

  function only() { return K.App.objects[K.App.objects.length - 1]; }

  /* BOOLEAN IS A SETUP NOW (v2.17): the result appears at once, the chips
     switch between the three live, and OK is the first moment anything is
     destroyed. Driven here the way a finger drives it - open, chip, OK -
     so every section below exercises the real path rather than a shortcut
     past the bar. The first call of a session waits on the CSG import; the
     rest open with no wait at all. */
  async function runBool(kind, keep) {
    K.App.boolKeep = !!keep;
    K.booleanSelection();
    for (let i = 0; i < 240 && !K.opSetup; i++) {
      await new Promise(r => setTimeout(r, 25));
    }
    if (!K.opSetup) return false;
    if (K.opSetup.p.kind !== kind) {
      K.opSetup.p.kind = kind;
      K.refreshOpSetupMesh();
    }
    K.finishOpSetup(true);
    return true;
  }

  // Every face group is either a single triangle or a region whose boundary
  // is ONE simple loop. This is the assertion the whole post-pass exists for:
  // a merged region with a hole in it is a face Inset would pull inward while
  // the hole stayed put, self-intersecting with no refusal.
  function holedFaces(obj) {
    const ed = edOf(obj.mesh);
    let bad = 0;
    ed.groups.forEach((g, gi) => {
      if (g.triangles.length === 1) return;
      if (K.getGroupBoundaryLoopAttr(ed, gi).length < 3) bad++;
    });
    return { bad: bad, groups: ed.groups.length };
  }

  function w(obj) { return K.auditWinding(obj); }
  function groupCount(obj) { return K.faceCount(obj.mesh.geometry); }

  async function run() {
    K = window.__kubik;
    if (!K) { finish('__kubik is undefined - the app never started'); return; }
    ok('0.boot  app up, boolean exported',
       !!K.App && typeof K.booleanBuild === 'function' &&
       typeof K.booleanSelection === 'function' && typeof K.booleanSurvey === 'function');
    if (typeof K.booleanSelection !== 'function') { finish(); return; }
    mark('0.boot');

    // 1 -- two overlapping cubes, Union ---------------------------------
    clearScene();
    let a = mk('A', 'cube'), b = mk('B', 'cube');
    b.mesh.position.set(0.5, 0.5, 0.5); b.mesh.updateMatrixWorld(true);
    select([a, b]);
    await runBool('union', false);
    let r = only(), x = r && w(r);
    ok('1.union  inputs consumed, one object left', K.App.objects.length === 1,
       'objects=' + K.App.objects.length);
    ok('1.union  watertight', !!x && x.boundary === 0, x && ('boundary=' + x.boundary));
    ok('1.union  winding agrees everywhere',
       !!x && x.conflictEdges === 0 && x.nonManifold === 0 && x.reversed === 0,
       x && JSON.stringify(x));
    ok('1.union  one shell', !!x && x.shells === 1, x && ('shells=' + x.shells));
    ok('1.union  faces, not soup', !!r && groupCount(r) <= 24,
       r && ('groups=' + groupCount(r)));
    mark('1.union');

    // 2 -- a rod through a cube: the face with a hole in it --------------
    clearScene();
    a = mk('Cube', 'cube');
    let rod = mk('Rod', 'cylinder');
    rod.mesh.scale.set(0.3, 2.2, 0.3); rod.mesh.updateMatrixWorld(true);
    select([a, rod]);
    await runBool('difference', false);
    r = only(); x = r && w(r);
    const h = r ? holedFaces(r) : null;
    ok('2.hole   watertight', !!x && x.boundary === 0, x && ('boundary=' + x.boundary));
    ok('2.hole   winding agrees', !!x && x.conflictEdges === 0 && x.nonManifold === 0,
       x && JSON.stringify(x));
    ok('2.hole   the hole was actually cut', !!r && groupCount(r) > 6,
       r && ('groups=' + groupCount(r)));
    ok('2.hole   NO face has a second boundary loop', !!h && h.bad === 0,
       h && ('bad=' + h.bad + ' of ' + h.groups));
    mark('2.hole');

    // 3 -- Intersect ------------------------------------------------------
    clearScene();
    a = mk('Cube', 'cube');
    let sph = mk('Sphere', 'sphere');
    sph.mesh.position.set(0.3, 0.3, 0); sph.mesh.updateMatrixWorld(true);
    select([a, sph]);
    await runBool('intersect', false);
    r = only(); x = r && w(r);
    ok('3.inter  something survived', K.App.objects.length === 1 && !!r && groupCount(r) > 0,
       r && ('groups=' + groupCount(r)));
    ok('3.inter  watertight', !!x && x.boundary === 0, x && ('boundary=' + x.boundary));
    ok('3.inter  winding agrees', !!x && x.conflictEdges === 0 && x.nonManifold === 0,
       x && JSON.stringify(x));
    mark('3.inter');

    // 4 -- two cubes sharing EXACTLY one face -----------------------------
    // The coplanar case. This is where CSG implementations fail, and it is
    // the reason this app does not have a hand-written one.
    clearScene();
    a = mk('A', 'cube'); b = mk('B', 'cube');
    b.mesh.position.set(1, 0, 0); b.mesh.updateMatrixWorld(true);
    select([a, b]);
    await runBool('union', false);
    r = only(); x = r && w(r);
    ok('4.coplan watertight', !!x && x.boundary === 0, x && ('boundary=' + x.boundary));
    ok('4.coplan one shell, no shared wall left inside',
       !!x && x.shells === 1 && x.nonManifold === 0, x && JSON.stringify(x));
    mark('4.coplan');

    // 5 -- objects that do not touch each other ---------------------------
    clearScene();
    a = mk('A', 'cube'); b = mk('B', 'cube');
    b.mesh.position.set(3, 0, 0); b.mesh.updateMatrixWorld(true);
    select([a, b]);
    await runBool('union', false);
    r = only(); x = r && w(r);
    ok('5.apart  union of two disjoint solids is two shells',
       !!x && x.shells === 2 && x.boundary === 0, x && JSON.stringify(x));

    clearScene();
    a = mk('A', 'cube'); b = mk('B', 'cube');
    b.mesh.position.set(3, 0, 0); b.mesh.updateMatrixWorld(true);
    select([a, b]);
    await runBool('difference', false);
    r = only();
    ok('5.apart  difference by something that misses leaves A alone',
       !!r && groupCount(r) === 6, r && ('groups=' + groupCount(r)));
    mark('5.apart');

    // 6 -- a MIRRORED input: negative determinant, reversed winding -------
    // Baking a negative-determinant transform into the vertices reverses
    // triangle order and leaves a model that is invisible from outside and
    // solid from within. Same trap the importer records.
    clearScene();
    a = mk('A', 'cube'); b = mk('B', 'cube');
    b.mesh.scale.set(-1, 1, 1);
    b.mesh.position.set(0.5, 0.4, 0.4);
    b.mesh.updateMatrixWorld(true);
    select([a, b]);
    await runBool('union', false);
    r = only(); x = r && w(r);
    ok('6.mirror watertight', !!x && x.boundary === 0, x && ('boundary=' + x.boundary));
    ok('6.mirror nothing came out inside-out',
       !!x && x.reversed === 0 && x.conflictEdges === 0, x && JSON.stringify(x));
    mark('6.mirror');

    // 7 -- rotation and non-uniform scale, baked ---------------------------
    clearScene();
    a = mk('A', 'cube'); b = mk('B', 'cube');
    a.mesh.rotation.set(0, Math.PI / 4, 0);
    a.mesh.scale.set(2, 1, 1);
    a.mesh.updateMatrixWorld(true);
    b.mesh.position.set(0.4, 0.4, 0.2); b.mesh.updateMatrixWorld(true);
    const aBox = new K.THREE.Box3().setFromObject(a.mesh);
    select([a, b]);
    await runBool('union', false);
    r = only(); x = r && w(r);
    const rBox = r ? new K.THREE.Box3().setFromObject(r.mesh) : null;
    ok('7.xform  watertight', !!x && x.boundary === 0, x && ('boundary=' + x.boundary));
    ok('7.xform  winding agrees', !!x && x.conflictEdges === 0 && x.reversed === 0,
       x && JSON.stringify(x));
    ok('7.xform  result sits where the inputs were',
       !!rBox && rBox.intersectsBox(aBox) &&
       Math.abs(rBox.max.x - Math.max(aBox.max.x, 0.9)) < 0.35,
       rBox && ('result=' + JSON.stringify(rBox.max) + ' A=' + JSON.stringify(aBox.max)));
    mark('7.xform');

    // 8 -- the refusal, and that it names what the file needs -------------
    clearScene();
    a = mk('Cube', 'cube');
    const plane = mk('Plane', 'plane');
    let why = K.booleanSurvey([a, plane]);
    ok('8.refuse an open object is refused', typeof why === 'string', String(why));
    ok('8.refuse the refusal names the object', typeof why === 'string' && why.indexOf('Plane') === 0,
       String(why));
    ok('8.refuse the refusal names the fix',
       typeof why === 'string' && why.indexOf('Cap holes') >= 0, String(why));
    ok('8.refuse two closed objects are not refused', K.booleanSurvey([a, mk('B', 'cube')]) === null);
    // ...and the chooser refuses BEFORE it opens the bar.
    clearScene();
    a = mk('Cube', 'cube');
    const pl2 = mk('Plane', 'plane');
    select([a, pl2]);
    K.hideOpBar();
    K.booleanSelection();
    ok('8.refuse the preview never opened on a refused pair', !K.opSetup);
    mark('8.refuse');

    // 9 -- Keep originals --------------------------------------------------
    clearScene();
    a = mk('A', 'cube'); b = mk('B', 'cube');
    b.mesh.position.set(0.5, 0.5, 0.5); b.mesh.updateMatrixWorld(true);
    select([a, b]);
    await runBool('union', true);
    ok('9.keep   both inputs still standing beside the result',
       K.App.objects.length === 3 && !!K.findObject(a.id) && !!K.findObject(b.id),
       'objects=' + K.App.objects.length);
    ok('9.keep   the result is what is selected', K.App.selectedObjectIds.size === 1);
    mark('9.keep');

    // 10 -- materials, and finishes derived not guessed ---------------------
    clearScene();
    a = mk('A', 'cube'); b = mk('B', 'cube');
    b.mesh.position.set(0.5, 0.5, 0.5); b.mesh.updateMatrixWorld(true);
    select([a, b]);
    await runBool('union', false);
    r = only();
    const mats = r && (Array.isArray(r.mesh.material) ? r.mesh.material : [r.mesh.material]);
    const fin = r && (r.mesh.userData.finishes || {});
    const stamped = mats ? mats.filter(m => m && m.userData && m.userData.kubikDef).length : -1;
    ok('10.mats  one material per face group',
       !!mats && mats.length === groupCount(r), mats && (mats.length + ' vs ' + groupCount(r)));
    ok('10.mats  every material carries its kubikDef stamp',
       stamped === (mats ? mats.length : -2), stamped + '/' + (mats && mats.length));
    ok('10.mats  finishes has an entry per group',
       !!fin && Object.keys(fin).length === groupCount(r),
       fin && (Object.keys(fin).length + ' vs ' + groupCount(r)));
    ok('10.mats  no material is shared with a deleted input',
       !!mats && mats.every(m => m !== a.mesh.material && m !== b.mesh.material));
    mark('10.mats');

    // 11 -- Undo puts back what went in ------------------------------------
    clearScene();
    a = mk('A', 'cube'); b = mk('B', 'cube');
    b.mesh.position.set(0.5, 0.5, 0.5); b.mesh.updateMatrixWorld(true);
    K.pushHistory();
    select([a, b]);
    await runBool('union', false);
    const after = K.App.objects.length;
    K.undo();
    ok('11.undo  the two inputs come back',
       after === 1 && K.App.objects.length === 2,
       'after=' + after + ' undone=' + K.App.objects.length);
    mark('11.undo');

    // 12 -- coplanar faces MERGE ACROSS THE A/B SEAM ----------------------
    // Two unit cubes overlapping along x only. Their union is one 1.6 x 1 x 1
    // box, so the answer is six faces and nothing else. It came back twelve
    // while the brushes carried cloned materials: the evaluator collapses
    // duplicate materials by reference, and mergeCoplanarTriangles will not
    // flood across a material boundary.
    clearScene();
    a = mk('A', 'cube'); b = mk('B', 'cube');
    b.mesh.position.set(0.6, 0, 0); b.mesh.updateMatrixWorld(true);
    select([a, b]);
    await runBool('union', false);
    r = only(); x = r && w(r);
    ok('12.seam  a box unioned with a box is a box', !!r && groupCount(r) === 6,
       r && ('groups=' + groupCount(r)));
    ok('12.seam  watertight', !!x && x.boundary === 0, x && ('boundary=' + x.boundary));
    mark('12.seam');

    // 13 -- a face wound the wrong way is refused --------------------------
    clearScene();
    const edc = K.buildPrimitiveEditable('cube', {});
    edc.groups[0].triangles = edc.groups[0].triangles.map(t => [t[0], t[2], t[1]]);
    const flipped = K.createObjectFromEditable('Flipped', new K.THREE.Vector3(0, 0, 0),
      edc, K.makeMaterialSet(edc.groups.length, 0x9aa3b2), {});
    let whyF = K.booleanSurvey([flipped, mk('B', 'cube')]);
    ok('13.wound a reversed face is refused', typeof whyF === 'string', String(whyF));
    ok('13.wound the refusal says what is wrong',
       typeof whyF === 'string' && whyF.indexOf('wound the wrong way') >= 0, String(whyF));
    mark('13.wound');

    // 14 -- a MIRRORED cutter removes the right half ------------------------
    // Not just "the result is closed": a brush entering the evaluator with a
    // negative determinant could be read as its own complement, and that
    // comes back watertight and wrong. B occupies x in [0,1], so A - B must
    // leave x in [-0.5, 0] and nothing else.
    clearScene();
    a = mk('A', 'cube'); b = mk('B', 'cube');
    b.mesh.scale.set(-1, 1, 1);
    b.mesh.position.set(0.5, 0, 0);
    b.mesh.updateMatrixWorld(true);
    select([a, b]);
    await runBool('difference', false);
    r = only(); x = r && w(r);
    let box = r ? new K.THREE.Box3().setFromObject(r.mesh) : null;
    let size = box ? box.getSize(new K.THREE.Vector3()) : null;
    ok('14.mirror  watertight', !!x && x.boundary === 0, x && ('boundary=' + x.boundary));
    ok('14.mirror  half the cube is gone, the right half',
       !!size && Math.abs(size.x - 0.5) < 0.02 && Math.abs(size.y - 1) < 0.02 &&
       !!box && Math.abs(box.max.x) < 0.02,
       box && ('size=' + JSON.stringify(size) + ' max=' + JSON.stringify(box.max)));
    mark('14.mirror');

    // 15 -- a boolean ON a boolean -----------------------------------------
    // The reason T-junctions had to be healed rather than tolerated: the
    // survey refuses an open object, so a result that is open cannot be fed
    // to a second boolean, and chaining is most of what booleans are for.
    clearScene();
    a = mk('A', 'cube');
    rod = mk('Rod', 'cylinder');
    rod.mesh.scale.set(0.3, 2.2, 0.3); rod.mesh.updateMatrixWorld(true);
    select([a, rod]);
    await runBool('difference', false);
    const first = only();
    ok('15.chain the first result is not refused by the survey',
       K.booleanSurvey([first, mk('C', 'cube')]) === null,
       String(K.booleanSurvey([first, K.App.objects[K.App.objects.length - 1]])));
    const c2 = K.App.objects[K.App.objects.length - 1];
    c2.mesh.position.set(0.4, 0.4, 0.4); c2.mesh.updateMatrixWorld(true);
    select([first, c2]);
    await runBool('difference', false);
    r = only(); x = r && w(r);
    ok('15.chain the second boolean also comes back closed',
       !!x && x.boundary === 0 && x.nonManifold === 0 && x.conflictEdges === 0,
       x && JSON.stringify(x));
    mark('15.chain');

    /* 16 -- THE PREVIEW ITSELF (v2.17) -------------------------------------
       Union, difference and intersect are three answers you cannot tell apart
       without looking at them, and this used to commit on the tap and delete
       both inputs on the way out. What has to be true now: the result stands
       before anything is destroyed, a chip rebuilds it in place, and Cancel
       gives back exactly what went in - visible, not just present. */
    clearScene();
    a = mk('A', 'cube'); b = mk('B', 'cube');
    b.mesh.position.set(0.5, 0.5, 0.5); b.mesh.updateMatrixWorld(true);
    select([a, b]);
    K.pushHistory();
    K.App.boolKeep = false;
    K.booleanSelection();
    ok('16.preview the result is there the moment you tap it',
       !!K.opSetup && K.App.objects.length === 3, 'objects=' + K.App.objects.length);
    ok('16.preview and it opens on Union',
       !!K.opSetup && K.opSetup.p.kind === 'union', K.opSetup && K.opSetup.p.kind);
    ok('16.preview both inputs are out of the way while it stands',
       K.App.hidden.has(a.id) && K.App.hidden.has(b.id),
       'hidden=' + K.App.hidden.size);
    ok('16.preview but NOTHING has been destroyed yet',
       !!K.findObject(a.id) && !!K.findObject(b.id));

    let pvw = K.findObject(K.opSetup.objId);
    const unionX = new K.THREE.Box3().setFromObject(pvw.mesh)
                     .getSize(new K.THREE.Vector3()).x;
    K.opSetup.p.kind = 'difference';
    K.refreshOpSetupMesh();
    pvw = K.findObject(K.opSetup.objId);
    const diffX = new K.THREE.Box3().setFromObject(pvw.mesh)
                    .getSize(new K.THREE.Vector3()).x;
    ok('16.preview a chip rebuilds it in place - still one result, smaller',
       K.App.objects.length === 3 && diffX < unionX - 0.1,
       'union x=' + unionX.toFixed(3) + ' difference x=' + diffX.toFixed(3));
    ok('16.preview and the NAME followed the chip', /cut$/.test(pvw.name), pvw.name);

    K.finishOpSetup(false);
    ok('16.preview Cancel gives both inputs back, visible and selected',
       K.App.objects.length === 2 &&
       !K.App.hidden.has(a.id) && !K.App.hidden.has(b.id) &&
       K.App.selectedObjectIds.has(a.id) && K.App.selectedObjectIds.has(b.id),
       'objects=' + K.App.objects.length + ' hidden=' + K.App.hidden.size);
    mark('16.preview');

    /* 17 -- OK IS ONE STEP, AND KEEP DECIDES WHAT SURVIVES IT --------------
       Every chip tried on the way is a rebuild, not an edit: one undo has to
       put both inputs back whatever route the preview took to get here. */
    clearScene();
    a = mk('A', 'cube'); b = mk('B', 'cube');
    b.mesh.position.set(0.5, 0.5, 0.5); b.mesh.updateMatrixWorld(true);
    select([a, b]);
    K.pushHistory();
    K.App.boolKeep = false;
    K.booleanSelection();
    K.opSetup.p.kind = 'intersect'; K.refreshOpSetupMesh();
    K.opSetup.p.kind = 'union'; K.refreshOpSetupMesh();
    K.finishOpSetup(true);
    const left = K.App.objects.length;
    ok('17.commit and nothing is left hidden behind it',
       K.App.hidden.size === 0, 'hidden=' + K.App.hidden.size);
    K.undo();
    ok('17.commit OK consumes the inputs, and one undo brings both back',
       left === 1 && K.App.objects.length === 2,
       left + ' -> ' + K.App.objects.length);

    // Keep originals is a question about what SURVIVES, not what you look at.
    clearScene();
    a = mk('A', 'cube'); b = mk('B', 'cube');
    b.mesh.position.set(0.5, 0.5, 0.5); b.mesh.updateMatrixWorld(true);
    select([a, b]);
    K.App.boolKeep = true;
    K.booleanSelection();
    ok('17.commit the inputs are hidden while it previews even with Keep on',
       K.App.hidden.has(a.id) && K.App.hidden.has(b.id));
    K.finishOpSetup(true);
    ok('17.commit ...and standing, visible, beside the result afterwards',
       K.App.objects.length === 3 && K.App.hidden.size === 0 &&
       !!K.findObject(a.id) && !!K.findObject(b.id),
       'objects=' + K.App.objects.length + ' hidden=' + K.App.hidden.size);
    K.App.boolKeep = false;
    mark('17.commit');

    /* 18 -- WHAT A PREVIEW HAS TO SURVIVE (v2.17, all six found in review) --
       A refused chip, an Undo, another op opening on top of it, a primitive
       already half made, and a document that changed while the engine was
       still on its way. */
    clearScene();
    a = mk('A', 'cube'); b = mk('B', 'cube');
    b.mesh.position.set(4, 0, 0); b.mesh.updateMatrixWorld(true);   // they miss
    select([a, b]);
    K.booleanSelection();
    let pw = K.findObject(K.opSetup.objId);
    const g0 = K.faceCount(pw.mesh.geometry);
    K.opSetup.p.kind = 'intersect';      // two solids that miss share nothing
    K.refreshOpSetupMesh();
    pw = K.findObject(K.opSetup.objId);
    ok('18.guard a refused chip leaves BOTH the shape and the chip on Union',
       K.opSetup.p.kind === 'union' && K.faceCount(pw.mesh.geometry) === g0,
       K.opSetup.p.kind + ' ' + K.faceCount(pw.mesh.geometry) + '/' + g0);
    K.finishOpSetup(false);
    mark('18.guard.chip');

    // Undo takes back the preview, and NOT the committed step under it.
    clearScene();
    a = mk('A', 'cube'); b = mk('B', 'cube');
    b.mesh.position.set(0.5, 0.5, 0.5); b.mesh.updateMatrixWorld(true);
    select([a, b]);
    K.pushHistory();
    K.booleanSelection();
    K.undo();
    ok('18.guard Undo takes back the preview and nothing else',
       !K.opSetup && K.App.objects.length === 2 && K.App.hidden.size === 0,
       'objects=' + K.App.objects.length + ' setup=' + !!K.opSetup);

    // No slider op opens on top of it - they would share one bar and one OK.
    clearScene();
    a = mk('A', 'cube'); b = mk('B', 'cube');
    b.mesh.position.set(0.5, 0.5, 0.5); b.mesh.updateMatrixWorld(true);
    select([a, b]);
    K.booleanSelection();
    const faces0 = K.faceCount(K.findObject(K.opSetup.objId).mesh.geometry);
    K.subdivideSelection();
    ok('18.guard Subdivide will not open over a preview',
       !K.App.pendingOp && !!K.opSetup &&
       K.faceCount(K.findObject(K.opSetup.objId).mesh.geometry) === faces0,
       'pendingOp=' + !!K.App.pendingOp);
    K.finishOpSetup(false);

    // ...and a boolean will not open over a primitive that is still being set.
    clearScene();
    a = mk('A', 'cube'); b = mk('B', 'cube');
    b.mesh.position.set(0.5, 0.5, 0.5); b.mesh.updateMatrixWorld(true);
    K.startGeoSetup('cube');
    select([a, b]);
    K.booleanSelection();
    ok('18.guard a boolean will not open over a half-made primitive',
       !K.opSetup && !!K.App.geoSetup, 'setup=' + !!K.opSetup);
    K.finishGeoSetup(false);
    mark('18.guard.states');

    /* THE FAR SIDE OF THE WAIT. Ids are handed out from 1 and a load renumbers
       from 1, so the same two ids can name two entirely different meshes by
       the time the engine lands. Reproduced exactly: same ids, new objects. */
    clearScene();
    a = mk('A', 'cube'); b = mk('B', 'cube');
    const stale = [a, b];
    clearScene();
    K.App.nextId = stale[0].id;
    const a2 = mk('A', 'cube'); mk('B', 'cube');
    ok('18.guard (the ids really were handed back out)',
       K.findObject(stale[0].id) === a2 && a2 !== stale[0]);
    K.openBooleanSetup(stale);
    ok('18.guard a document swapped under the wait is refused by identity',
       !K.opSetup, 'setup=' + !!K.opSetup);
    mark('18.guard.wait');

    finish();
  }

  /* A PLAIN TIMER, not `load`: if the module graph stalls, load never fires
     and the probe says nothing at all - which reads exactly like a build
     that will not open. Three seconds, then report whatever is true. */
  setTimeout(() => {
    run().catch(e => {
      say('THREW ' + (e && e.stack ? e.stack : e));
      fails++;
      finish();
    });
  }, 3000);
})();
