/* The v2.1 render loop, on a REAL clock: does it sleep when nothing is
   happening, does invalidate wake it, does a sustained touch gesture draw
   half as many frames, and is the viewport back at full resolution the
   moment the finger lifts. POSTs its own answer back - a virtual clock
   cannot ask any of these. */
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
  window.addEventListener('error', (e) => { say('PAGE ERROR ' + e.message); });
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  async function boot() {
    const K = window.__kubik;
    if (!K) { say('NO __kubik'); finish(); return; }
    const cv = K.renderer.domElement;
    const r = cv.getBoundingClientRect();
    const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
    const fire = (type, x, y, id) => cv.dispatchEvent(new PointerEvent(type, {
      pointerId: id, pointerType: 'touch', isPrimary: true, bubbles: true,
      cancelable: true, clientX: x, clientY: y, buttons: type === 'pointerup' ? 0 : 1
    }));

    say('LIVE_PIXEL_RATIO=' + K.LIVE_PIXEL_RATIO + '  LIVE_FPS_AFTER_MS=' + K.LIVE_FPS_AFTER_MS +
        '  LIVE_FRAME_MS=' + K.LIVE_FRAME_MS);
    say('full pixel ratio: ' + K.renderer.getPixelRatio());

    // ---- 1. does it sleep -------------------------------------------------
    await sleep(1500);
    const a = K.PERF.render, at = K.PERF.tick;
    await sleep(2000);
    const idleFps = (K.PERF.render - a) / 2;
    say('');
    say('1. idle             ' + idleFps.toFixed(1) + ' frames/sec   (heartbeat only = 1.0)');
    say('   loop ran         ' + ((K.PERF.tick - at) / 2).toFixed(1) +
        ' times/sec   (before v2.1 this was 60, drawn or not)');
    say('   rafPending=' + K.rafPending + '  heartTimer=' + (K.heartTimer ? 'armed' : 'none') +
        '   (asleep = rafPending 0 and a timer armed)');

    // ---- 2. does invalidate wake it ---------------------------------------
    const b = K.PERF.render;
    K.invalidate();
    const wokeSync = K.rafPending !== 0;
    await sleep(120);
    say('2. invalidate       rafPending set at once: ' + wokeSync +
        ';  frames in the 120ms after: ' + (K.PERF.render - b));

    // ---- 3. a gesture, before the cap can apply ---------------------------
    fire('pointerdown', cx, cy, 7);
    let t0 = performance.now(), c0 = K.PERF.render, n = 0;
    while (performance.now() - t0 < 500) {
      n++;
      fire('pointermove', cx + 12 + (n % 7), cy + (n % 5), 7);
      await sleep(14);
    }
    let dt = (performance.now() - t0) / 1000;
    const fpsEarly = (K.PERF.render - c0) / dt;
    const ratioLive = K.renderer.getPixelRatio();

    // ---- 4. the same gesture, once it is sustained ------------------------
    await sleep(250);                       // now past LIVE_FPS_AFTER_MS
    t0 = performance.now(); c0 = K.PERF.render; n = 0;
    while (performance.now() - t0 < 1400) {
      n++;
      fire('pointermove', cx + 12 + (n % 9), cy + (n % 6), 7);
      await sleep(14);
    }
    dt = (performance.now() - t0) / 1000;
    const fpsLate = (K.PERF.render - c0) / dt;
    const cappedNow = K.liveFrameCapped(performance.now());
    fire('pointerup', cx + 20, cy + 5, 7);

    say('');
    say('3. gesture, first 500ms   ' + fpsEarly.toFixed(1) + ' frames/sec   capped=' + false);
    say('4. same gesture, past ' + K.LIVE_FPS_AFTER_MS + 'ms  ' + fpsLate.toFixed(1) +
        ' frames/sec   capped=' + cappedNow);
    say('   the cap is working if 4 is about half of 3, and about 30');
    say('   pixel ratio during the gesture: ' + ratioLive +
        '   (wanted ' + Math.min(K.renderer.getPixelRatio(), K.LIVE_PIXEL_RATIO) + ' or lower)');

    // ---- 5. back to full, at once -----------------------------------------
    await sleep(200);
    say('5. after the finger lifts  pixel ratio ' + K.renderer.getPixelRatio() +
        '   renderScaleLive=' + K.renderScaleLive + '   liveTouches=' + K.liveTouches.size);

    // ---- 6. and asleep again ----------------------------------------------
    await sleep(2200);
    const c = K.PERF.render;
    await sleep(2000);
    say('6. idle again       ' + ((K.PERF.render - c) / 2).toFixed(1) + ' frames/sec' +
        '   rafPending=' + K.rafPending + '  heartTimer=' + (K.heartTimer ? 'armed' : 'none'));
    say('');
    say('PERF.render total ' + K.PERF.render + ', rescale switches ' + K.PERF.rescale);
    finish();
  }
  const go = () => setTimeout(() => { boot().catch(e => { say('THREW ' + e.message + '\n' + e.stack); finish(); }); }, 2500);
  if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
})();
