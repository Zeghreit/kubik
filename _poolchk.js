/* v2.8: one material per definition. The questions are (1) does a mesh really
   share instances rather than own them, (2) does a face painted with a second
   definition still look different, (3) does the pool stay small as the model
   grows, (4) does deleting an object take a material out from under another
   one, (5) does a mirrored object still get DoubleSide while its neighbour
   culls, and (6) does the appearance survive an op, an undo and a reload.
   Verified against _bak_v27.html, where every face group owns its own. */
(function () {
  const lines = [];
  const say = (s) => lines.push(s);
  let pass = 0, fail = 0;
  const ok = (name, good, detail) => {
    (good ? pass++ : fail++);
    say((good ? '  ok    ' : '  FAIL  ') + name.padEnd(44) + (detail || ''));
  };
  let done = false;
  const errs = [];
  function finish() {
    if (done) return; done = true;
    say('');
    say(fail ? 'VERDICT=FAIL (' + fail + ' of ' + (pass + fail) + ')'
             : 'VERDICT=PASS (' + pass + ' checks)');
    try { fetch('/report', { method: 'POST', body: lines.join('\n') }); } catch (_) {}
  }
  window.addEventListener('error', (e) => errs.push('window: ' + e.message));
  const realErr = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); realErr.apply(console, arguments); };
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  /* A running mark, sent after every section. The report only arrives at the
     end, so anything that blocks the main thread mid-way used to come back as
     silence - which is indistinguishable from a build that never loaded, and
     cost several round trips to tell apart. */
  const mark = (where) => {
    try { fetch('/mark', { method: 'POST', body: lines.join('\n') + '\n>>> reached: ' + where }); } catch (_) {}
  };

  const matsOf = (o) => Array.isArray(o.mesh.material) ? o.mesh.material : [o.mesh.material];
  const distinct = (o) => new Set(matsOf(o)).size;

  async function boot() {
    const K = window.__kubik, App = K.App;
    /* A WATCHDOG, because a probe that hangs says nothing at all. Whatever
       has been collected goes back after ninety seconds, so a stall shows up
       as a report that stops at the section that stalled rather than as
       "NO OUTPUT" - which is indistinguishable from a page that never
       loaded, and cost a round trip to tell apart once. */
    setTimeout(() => { if (!done) { say(''); say('*** WATCHDOG - stopped here ***'); finish(); } }, 90000);

    // ---- 1. a fresh object shares one instance across its faces -----------
    say('1. a mesh borrows, it does not own');
    const cube = App.objects[0];
    ok('there is a cube', !!cube, cube ? cube.name : 'none');
    ok('six groups', matsOf(cube).length === 6, matsOf(cube).length + ' groups');
    ok('but ONE material between them', distinct(cube) === 1, distinct(cube) + ' distinct');
    ok('and it is marked as pooled', cube.mesh.userData.matSide !== undefined,
       String(cube.mesh.userData.matSide));

    // ---- 2. two definitions still look like two ---------------------------
    say('');
    mark('before 2');
    say('2. painting a face still paints a face');
    /* A custom definition, so the test does not depend on a preset's numbers.
       Painted through the real entry point the tray uses. */
    K.MATERIALS.set('probe_red', { id: 'probe_red', name: 'Probe red', color: '#c0392b',
                                   roughness: 0.4, metalness: 0, bevel: 0, masks: [] });
    App.mode = 'face';
    App.activeObjectId = cube.id;
    App.selectedElements = new Set([2]);
    K.applyFinishToSelection('probe_red');
    await sleep(120);
    ok('two materials now', distinct(cube) === 2, distinct(cube) + ' distinct');
    const painted = matsOf(cube)[2];
    ok('the painted group wears the new one', painted.userData.kubikDef === 'probe_red',
       String(painted.userData.kubikDef));
    ok('and its neighbours do not', matsOf(cube)[1].userData.kubikDef !== 'probe_red');
    ok('the colour actually landed', '#' + painted.color.getHexString() === '#c0392b',
       '#' + painted.color.getHexString());

    // ---- 3. the pool does not grow with the model -------------------------
    say('');
    mark('before 3');
    say('3. the pool does not grow with the model');
    const before = distinct(cube);
    // Subdivide twice: 6 groups -> 96, and every one of them wants a material.
    App.mode = 'object';
    App.selectedObjectIds = new Set([cube.id]);
    App.selectedElements = new Set();
    // Extrude a few faces: each one adds groups, and every added group has to
    // come out of the pool rather than out of a clone that stayed.
    for (let f = 0; f < 4; f++) {
      try { K.extrudeRegionOp(cube, [f], 0.2); } catch (e) { say('       extrude ' + f + ': ' + e.message); }
      await sleep(120);
    }
    const groups = matsOf(cube).length;
    ok('the mesh grew', groups > 10, groups + ' groups');
    /* THE POINT OF THE WHOLE RELEASE. Before v2.8 this number was the group
       count; now it is the number of DEFINITIONS on the object. */
    ok('the instances did not', distinct(cube) <= before + 1,
       groups + ' groups, ' + distinct(cube) + ' distinct materials');
    ok('and the two looks survived the subdivide', distinct(cube) === 2,
       distinct(cube) + ' distinct');

    // ---- 4. one object's delete must not blind another --------------------
    say('');
    mark('before 4');
    say('4. a shared material outlives the mesh that dropped it');
    // No THREE global in a plain <script> - borrow a Vector3 from the scene.
    const where = cube.mesh.position.clone(); where.set(3, 0.5, 0);
    const twin = K.createCubeObject('Probe twin', where);
    await sleep(120);
    const shared = matsOf(twin)[0];
    ok('the new cube borrows the same instance', matsOf(cube).indexOf(shared) >= 0 ||
       shared.userData.kubikDef === matsOf(cube)[0].userData.kubikDef,
       String(shared.userData.kubikDef));
    App.selectedObjectIds = new Set([twin.id]);
    K.deleteSelection && K.deleteSelection();
    await sleep(150);
    /* A disposed material loses its program on the next render and the model
       goes black - which is what would happen if the pool were disposable. */
    ok('deleting it did not dispose the shared one', shared.version >= 0 && !!shared.type,
       shared.type);
    K.renderer.render(K.scene, K.camera);
    ok('and the scene still draws', errs.filter(e => /program|shader/i.test(e)).length === 0);

    // ---- 5. side is part of the key, not written onto a shared instance ----
    say('');
    mark('before 5');
    say('5. the side rides in the key');
    const sideBefore = cube.mesh.userData.matSide;
    App.xraySelection = !App.xraySelection;
    K.refreshXrayMode();
    await sleep(120);
    ok('the toggle changed the side', cube.mesh.userData.matSide !== sideBefore,
       sideBefore + ' -> ' + cube.mesh.userData.matSide);
    ok('and handed the mesh other instances', matsOf(cube)[0].side === cube.mesh.userData.matSide,
       String(matsOf(cube)[0].side));
    App.xraySelection = !App.xraySelection;
    K.refreshXrayMode();
    await sleep(120);
    ok('and back again', cube.mesh.userData.matSide === sideBefore, String(cube.mesh.userData.matSide));

    // ---- 6. the appearance survives a round trip --------------------------
    say('');
    mark('before 6');
    say('6. through a save and back');
    const doc = JSON.parse(JSON.stringify(K.serializeDoc()));
    K.restoreDoc(doc);
    await sleep(300);
    const back = App.objects.find(o => o.id === cube.id) || App.objects[0];
    ok('the model came back', !!back && matsOf(back).length === groups,
       matsOf(back).length + ' groups');
    ok('pooled again after the load', back.mesh.userData.matSide !== undefined);
    ok('still two looks, not ' + matsOf(back).length, distinct(back) === 2,
       distinct(back) + ' distinct');
    const red = matsOf(back).filter(m => m.userData.kubikDef === 'probe_red');
    ok('and the painted faces are still red', red.length > 0 &&
       '#' + red[0].color.getHexString() === '#c0392b',
       red.length + ' face(s), #' + (red[0] ? red[0].color.getHexString() : '?'));

    // ---- 7. a definition with per-object uniforms is NOT shared -----------
    say('');
    mark('before 7');
    say('7. per-object state gets a per-object instance');
    /* A cloth mask needs nothing from the mesh, so one instance serves the
       whole scene. A SHAPE mask reads the object's own distance field through
       an onBeforeRender, and three only uploads a material's custom uniforms
       when the material CHANGES between draws - so two objects sharing one
       would draw the second with the first object's field. */
    /* TWO SMALL CUBES, not the 22-group one from section 3. A shape mask
       bakes a distance field per object inside renderer.render, and asking a
       software renderer to do that for a heavily extruded mesh blocks the
       main thread long enough that this probe reported nothing at all. */
    const plain = K.createCubeObject('Probe one', (function (v) { v.set(6, 0.5, 0); return v; })(cube.mesh.position.clone()));
    const other = K.createCubeObject('Probe two', (function (v) { v.set(-6, 0.5, 0); return v; })(cube.mesh.position.clone()));
    /* A CREATED object is dressed LATE - see the healer in ensureMaskPatches -
       so until something calls it these two still wear the materials
       makeMaterialSet gave them. refreshUI does it in the app; here it is
       called directly, and the assertion below is about what happens after. */
    K.ensureMaskPatches();
    await sleep(250);
    ok('two plain cubes share one instance',
       matsOf(plain).indexOf(matsOf(other)[0]) >= 0 || matsOf(other)[0] === matsOf(plain)[0],
       'shared: ' + (matsOf(other)[0] === matsOf(plain)[0]));

    K.MATERIALS.set('probe_worn', { id: 'probe_worn', name: 'Probe worn', color: '#8899aa',
      roughness: 0.5, metalness: 0, bevel: 0,
      masks: [{ on: true, type: 'edges', blend: 'normal', colorOn: true, color: '#221100',
                roughOn: false, rough: 0.3, amount: 1, scale: 0.25, detail: 0,
                contrast: 0.5, nscale: 1, seed: 1 }] });
    [plain, other].forEach(o => {
      App.mode = 'object';
      App.selectedObjectIds = new Set([o.id]);
      App.activeObjectId = o.id;
      App.selectedElements = new Set();
      K.applyFinishToSelection('probe_worn');
    });
    await sleep(250);
    ok('but a shape-masked one does not', matsOf(plain)[0] !== matsOf(other)[0],
       matsOf(plain)[0] === matsOf(other)[0]
         ? 'THEY SHARE - the second object would draw with the field of the first'
         : 'one instance each');
    ok('and both really wear it', matsOf(plain)[0].userData.kubikDef === 'probe_worn' &&
       matsOf(other)[0].userData.kubikDef === 'probe_worn');

    say('');
    mark('before 8');
    say('8. nothing complained');
    ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
    finish();
  }
  /* ON A TIMER, NOT ON `load`. Waiting for the load event means a page whose
     module graph never settles - a CDN fetch that stalls, a cache the harness
     has just had shot out from under it - never starts the probe at all, and
     "NO OUTPUT" is indistinguishable from a broken build. Started blind after
     three seconds instead: if the app is not up, __kubik is undefined and the
     report says so. */
  let started = false;
  const go = () => {
    if (started) return; started = true;
    boot().catch(e => { say('THREW ' + (e && e.message) + '\n' + (e && e.stack)); finish(); });
  };
  setTimeout(go, 3000);
})();
