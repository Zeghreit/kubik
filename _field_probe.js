/* Does the distance field still re-bake on every frame of an op-slider drag?
   PERF.bake counts bakes; rebuildFromEditable + render is exactly one frame
   of that drag. Needs a REAL clock (the 120 ms throttle reads
   performance.now), so it runs without a virtual time budget and POSTs its
   own answer back. */
(function () {
  const lines = [];
  const say = (s) => lines.push(s);
  let done = false;
  function finish() {
    if (done) return; done = true;
    const txt = lines.join('\n');
    const pre = document.createElement('pre');
    pre.id = 'probeOut';
    pre.textContent = '<<<PROBE\n' + txt + '\nPROBE>>>';
    document.body.appendChild(pre);
    try { fetch('/report', { method: 'POST', body: txt }); } catch (_) {}
  }
  window.addEventListener('error', (e) => { say('PAGE ERROR ' + e.message); finish(); });
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  async function boot() {
    const K = window.__kubik;
    if (!K) { say('NO __kubik'); finish(); return; }
    const obj = K.App.objects[0];
    if (!obj) { say('NO OBJECT'); finish(); return; }

    // Rounded edges alone makes defWantsField true - the cheapest way to put
    // an object on the shape-mask path without building a mask stack.
    let d = null;
    K.MATERIALS.forEach(def => { def.bevel = 0.6; d = def; K.updateMaterialEverywhere(def.id); });
    K.ensureMaskPatches();
    say('materials: ' + K.MATERIALS.size + '  bevel=0.6  wantsField=' + K.defWantsField(d));

    const draw = () => K.renderer.render(K.scene, K.camera);
    draw(); await sleep(60); draw();
    say('bakes after first draws: ' + K.PERF.bake);

    async function drag(label, frames, gapMs, fingerDown) {
      /* A real finger does BOTH: it sits in activePointers and it keeps the
         document's pointer clock fresh. v2.1a bounds the throttle's read of
         activePointers by that clock, so faking only the map measures the
         120ms throttle rather than the finger-down one. */
      const tick = () => document.dispatchEvent(new PointerEvent('pointermove', {
        pointerId: 99, pointerType: 'touch', bubbles: true, clientX: 10, clientY: 10
      }));
      if (fingerDown) K.activePointers.set(99, { x: 0, y: 0, t: performance.now(), moved: 40 });
      const b0 = K.PERF.bake;
      const t0 = performance.now();
      for (let i = 0; i < frames; i++) {
        if (fingerDown) tick();
        K.rebuildFromEditable(obj, K.toEditable(obj.mesh));   // one frame of an op slider
        draw();
        if (gapMs) await sleep(gapMs);
      }
      const t1 = performance.now();
      if (fingerDown) K.activePointers.delete(99);
      say(label.padEnd(32) + 'bakes=' + (K.PERF.bake - b0) + '/' + frames +
          '  ' + ((t1 - t0) / frames).toFixed(2) + ' ms/frame');
      return K.PERF.bake - b0;
    }

    say('');
    say('-- an op-slider drag, 20 frames, ~16 ms apart (about 320 ms) --');
    await drag('finger down (touch drag)', 20, 16, true);
    await sleep(200);
    await drag('no finger (mouse on slider)', 20, 16, false);
    say('');
    say('expected after the fix: finger-down 0, mouse ~2-3 (one per 120 ms)');
    say('before the fix both read 20 - one bake per frame');
    say('');
    say('geo has field after drag: ' + !!(obj.mesh.geometry.userData.kubikField));
    say('field texture is live: ' +
        !!(obj.mesh.geometry.userData.kubikField && obj.mesh.geometry.userData.kubikField.tex &&
           obj.mesh.geometry.userData.kubikField.tex.image));
    await sleep(300);
    draw();
    say('bakes after settling + one draw: ' + K.PERF.bake + ' total');
    finish();
  }
  const go = () => setTimeout(() => { boot().catch(e => { say('THREW ' + e.message + '\n' + e.stack); finish(); }); }, 2500);
  if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
})();
