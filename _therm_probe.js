/* Where the fragment budget actually goes. Not a pass/fail probe: it renders
   the SAME scene under a series of renderer/material settings and reports
   ms/frame for each, so "the materials are doing their part" becomes a number
   instead of a hypothesis. Needs a REAL GPU - run it without swiftshader. */
(function () {
  const lines = [];
  const say = (s) => lines.push(s);
  function finish() {
    const txt = lines.join('\n');
    const pre = document.createElement('pre');
    pre.id = 'probeOut';
    pre.textContent = '<<<PROBE\n' + txt + '\nPROBE>>>';
    document.body.appendChild(pre);
    try { fetch('/report', { method: 'POST', body: txt }); } catch (_) {}
  }
  window.addEventListener('error', (e) => { say('ERROR ' + e.message); finish(); });
  function boot() {
    const K = window.__kubik;
    if (!K || !K.renderer) { say('NO __kubik'); finish(); return; }
    const renderer = K.renderer, scene = K.scene, camera = K.camera;
    const gl = renderer.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    say('gl: ' + (dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)));
    say('ctx: samples=' + gl.getParameter(gl.SAMPLES) + '  dpr=' + renderer.getPixelRatio() +
        '  drawing=' + gl.drawingBufferWidth + 'x' + gl.drawingBufferHeight);

    // Fill the viewport with the model: this measures FRAGMENTS, and a cube
    // in the corner of an empty canvas measures the background instead.
    try { K.frameBox && K.App.objects && K.App.objects[0] && K.frameBox(K.App.objects[0].mesh); } catch (_) {}
    camera.position.multiplyScalar(0.55);
    camera.updateMatrixWorld();
    renderer.render(scene, camera);
    const info = renderer.info.render;
    say('scene: calls=' + info.calls + ' tris=' + info.triangles);

    const base = { dpr: renderer.getPixelRatio(), env: scene.environment, tone: renderer.toneMapping };
    const mats = [];
    scene.traverse(o => { if (o.isMesh && o.material) [].concat(o.material).forEach(m => { if (m.isMeshStandardMaterial) mats.push(m); }); });
    say('standard materials in scene: ' + mats.length);

    function bench(label, frames) {
      for (let i = 0; i < 6; i++) renderer.render(scene, camera);
      gl.finish();
      const t0 = performance.now();
      for (let i = 0; i < frames; i++) {
        camera.rotateZ(0.0002);          // defeat any frame-to-frame reuse
        renderer.render(scene, camera);
      }
      gl.finish();
      const t1 = performance.now();
      const ms = (t1 - t0) / frames;
      say(label.padEnd(34) + ms.toFixed(3) + ' ms/frame');
      return ms;
    }

    const N = 90;
    const setDpr = (r) => { renderer.setPixelRatio(r); renderer.setSize(K.viewportEl.clientWidth, K.viewportEl.clientHeight); };

    say('');
    say('-- pixel ratio (everything else as shipped) --');
    setDpr(2); const p2 = bench('dpr 2.00  (idle / after lift)', N);
    setDpr(1.25); const p125 = bench('dpr 1.25  (a2.96 gesture)', N);
    setDpr(1.0); const p10 = bench('dpr 1.00  (proposed gesture)', N);
    say('  1.25 costs ' + (p125 / p2 * 100).toFixed(0) + '% of 2.00;  1.00 costs ' +
        (p10 / p2 * 100).toFixed(0) + '% of 2.00, ' + (p10 / p125 * 100).toFixed(0) + '% of 1.25');

    say('');
    say('-- what each part of the material costs, at dpr 2 --');
    setDpr(2);
    bench('as shipped', N);
    scene.environment = null;
    bench('scene.environment = null', N);
    scene.environment = base.env;
    const sides = mats.map(m => m.side);
    mats.forEach(m => { m.side = 0; m.needsUpdate = true; });
    renderer.render(scene, camera);
    bench('FrontSide instead of Double', N);
    mats.forEach((m, i) => { m.side = sides[i]; m.needsUpdate = true; });
    renderer.render(scene, camera);
    renderer.toneMapping = 0;
    bench('no tone mapping', N);
    renderer.toneMapping = base.tone;
    scene.environment = null;
    mats.forEach(m => { m.side = 0; m.needsUpdate = true; });
    renderer.render(scene, camera);
    bench('no env + FrontSide together', N);
    mats.forEach((m, i) => { m.side = sides[i]; m.needsUpdate = true; });
    scene.environment = base.env;
    renderer.toneMapping = base.tone;
    setDpr(base.dpr);
    renderer.render(scene, camera);
    finish();
  }
  if (document.readyState === 'complete') setTimeout(boot, 2000);
  else window.addEventListener('load', () => setTimeout(boot, 2000));
})();
