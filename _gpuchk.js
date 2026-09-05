/* v2.8c: what a long session leaves on the GPU. Two counts that are supposed
   to be bounded and were not - the WebGL programs a mask's structural change
   mints, and the packed mask texture a deleted or emptied definition leaves
   behind - and the pool size, which is the v2.8 number this all sits on. */
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
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const mark = (w) => { try { fetch('/mark', { method: 'POST', body: lines.join('\n') + '\n>>> ' + w }); } catch (_) {} };

  const clothMask = () => ({ on: true, type: 'fbm', blend: 'normal',
    colorOn: true, color: '#7a4a20', roughOn: false, rough: 0.25,
    amount: 0.7, scale: 2, detail: 3, contrast: 1.4, nscale: 1, seed: 1 });

  async function boot() {
    const K = window.__kubik, App = K.App;
    setTimeout(() => { if (!done) { say(''); say('*** WATCHDOG ***'); finish(); } }, 90000);
    const progs = () => K.renderer.info.programs.length;
    const draw = () => { K.renderer.render(K.scene, K.camera); };

    const cube = App.objects[0];
    App.mode = 'object';
    App.activeObjectId = cube.id;
    App.selectedObjectIds = new Set([cube.id]);
    App.selectedElements = new Set();

    K.MATERIALS.set('gpu_probe', { id: 'gpu_probe', name: 'GPU probe', color: '#8899aa',
      roughness: 0.5, metalness: 0, bevel: 0, masks: [clothMask()] });
    K.applyFinishToSelection('gpu_probe');
    K.ensureMaskPatches();
    draw();
    await sleep(200);

    // ---- 1. the pool, which everything below rides on ---------------------
    say('1. the pool');
    ok('a handful of materials, not a mesh full', K.matPoolSize <= 8,
       K.matPoolSize + ' pooled instances');

    // ---- 2. programs minted by structural mask changes --------------------
    say('');
    say('2. programs minted by toggling a mask on and off');
    draw();
    const p0 = progs();
    const d = K.getMaterialDef('gpu_probe');
    /* THE REAL PATH, which is the point: the material editor deliberately
       does NOT bump the mask generation for a component toggle - the shader
       source is the same for one mask as for four and an off mask is amount
       zero - so twenty of these must cost nothing at all. Forcing a fresh
       generation instead measures a thing the app does not do. */
    for (let i = 0; i < 20; i++) {
      d.masks[0].colorOn = (i % 2 === 0);
      K.updateMaterialEverywhere('gpu_probe');
      K.ensureMaskPatches();
      draw();
    }
    await sleep(200);
    draw();
    const p1 = progs();
    say('       programs ' + p0 + ' -> ' + p1 + ' over 20 toggles');
    ok('the program count is bounded', p1 - p0 <= 4, 'grew by ' + (p1 - p0));

    /* AND THE THING THE FORK WAS PROTECTING. It existed because a material
       coming back to a key it once compiled under gets no fresh uniform set
       from three - so a slider moved after a component had been off and on
       again wrote into thin air and the model did not change. Removing the
       fork is only safe if that is still false, so ask it directly: with the
       mask back on, move the colour and see whether the picture moves. */
    d.masks[0].colorOn = true;
    d.masks[0].amount = 1;
    d.masks[0].color = '#c0392b';
    K.updateMaterialEverywhere('gpu_probe');
    K.ensureMaskPatches();
    draw();
    const redShot = K.renderer.domElement.toDataURL('image/png');
    d.masks[0].color = '#1188ff';
    K.updateMaterialEverywhere('gpu_probe');
    K.ensureMaskPatches();
    draw();
    const blueShot = K.renderer.domElement.toDataURL('image/png');
    ok('a slider after an off-and-on still lands', redShot !== blueShot,
       redShot === blueShot ? 'THE UNIFORMS ARE ORPHANED' : 'the picture followed the colour');
    mark('3');

    // ---- 2b. and the bake behind them --------------------------------------
    say('');
    say('2b. the cloth is not re-baked for a change it cannot see');
    /* Twenty component toggles change no texel: an off mask's channel is
       zeroed, so `on` reaches the bake, but ticking Colour on and off does
       not. Each avoided bake is 65,536 bytes filled by running the noise over
       16,384 texels per live mask. */
    /* THE COUNTER IS PART OF THE FIX, so an older build cannot be measured
       here at all - and a probe that reads `undefined` as zero would report
       the unfixed build as the best possible result. Said out loud instead. */
    ok('this build can count its bakes', typeof K.PERF.clothBake === 'number',
       typeof K.PERF.clothBake === 'number' ? '' : 'no PERF.clothBake - nothing below is measurable');
    K.PERF.clothBake = 0;
    for (let i = 0; i < 20; i++) {
      d.masks[0].colorOn = (i % 2 === 0);
      K.rebakeMaskTexture(d);
      K.updateMaterialEverywhere('gpu_probe');
      draw();
    }
    say('       cloth bakes over 20 component toggles: ' + K.PERF.clothBake);
    ok('a component tick bakes nothing', K.PERF.clothBake <= 1, K.PERF.clothBake + ' bake(s)');
    /* And the guard must not swallow a change that DOES reach the buffer -
       a different noise is a different cloth. */
    K.PERF.clothBake = 0;
    d.masks[0].seed = 7;
    K.rebakeMaskTexture(d);
    d.masks[0].detail = 5;
    K.rebakeMaskTexture(d);
    ok('but a new seed and a new detail both do', K.PERF.clothBake === 2,
       K.PERF.clothBake + ' bake(s) for 2 real changes');

    // ---- 3. mask textures a definition leaves behind ----------------------
    say('');
    say('3. the packed mask texture');
    const t0 = K.maskTexCount;
    /* Ten definitions with a mask each, used once and then emptied - which is
       what happens every time somebody tries a cloth, decides against it, and
       takes it off again. Each one bakes a 128x128 RGBA DataTexture. */
    for (let i = 0; i < 10; i++) {
      const id = 'gpu_tmp_' + i;
      K.MATERIALS.set(id, { id: id, name: 'tmp ' + i, color: '#777777',
        roughness: 0.5, metalness: 0, bevel: 0, masks: [clothMask()] });
      K.applyFinishToSelection(id);
      K.ensureMaskPatches();
      draw();
      // ...and the mask comes off again.
      K.getMaterialDef(id).masks = [];
      K.rebakeMaskTexture(K.getMaterialDef(id));
      K.updateMaterialEverywhere(id);
      K.ensureMaskPatches();
      draw();
    }
    await sleep(200);
    const t1 = K.maskTexCount;
    say('       mask textures ' + t0 + ' -> ' + t1 + ' over 10 tried-and-dropped masks');
    ok('an emptied definition keeps no texture', t1 - t0 <= 1,
       'grew by ' + (t1 - t0) + ' (' + ((t1 - t0) * 64) + ' KB of RGBA held)');

    // ---- 4. and it still draws --------------------------------------------
    say('');
    say('4. nothing complained');
    draw();
    ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
    finish();
  }
  let started = false;
  const go = () => { if (started) return; started = true;
    boot().catch(e => {
      ok('the probe ran to the end', false, 'THREW ' + (e && e.message));
      say((e && e.stack) || ''); finish();
    }); };
  setTimeout(go, 3000);
})();
