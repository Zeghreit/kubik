/* Turning the phone. Does the renderer end up laid out for the viewport it
   actually has - and does it recover when the resize EVENT lies, which is
   what iOS does on rotation? Real clock; the recovery paths are a
   ResizeObserver and a once-a-second check on the render loop. */
(function () {
  const lines = [];
  const say = (s) => lines.push(s);
  let done = false;
  function finish() {
    if (done) return; done = true;
    try { fetch('/report', { method: 'POST', body: lines.join('\n') }); } catch (_) {}
  }
  window.addEventListener('error', (e) => say('PAGE ERROR ' + e.message));
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  function report(K, tag) {
    const vp = K.viewportEl.getBoundingClientRect();
    const cv = K.renderer.domElement;
    const gl = K.renderer.getContext();
    const w = Math.round(vp.width), h = Math.round(vp.height);
    const cw = Math.round(cv.getBoundingClientRect().width);
    const ch = Math.round(cv.getBoundingClientRect().height);
    const asp = K.perspCam.aspect;
    const bufAsp = gl.drawingBufferWidth / gl.drawingBufferHeight;
    const ok = (Math.abs(asp - w / h) < 0.01) && cw === w && ch === h &&
               Math.abs(bufAsp - w / h) < 0.02;
    say(tag.padEnd(26) + 'viewport ' + w + 'x' + h +
        '   canvas ' + cw + 'x' + ch +
        '   buffer ' + gl.drawingBufferWidth + 'x' + gl.drawingBufferHeight +
        '   aspect ' + asp.toFixed(3) + ' (want ' + (w / h).toFixed(3) + ')' +
        '   ' + (ok ? 'ok' : '*** STRETCHED'));
    return ok;
  }

  /* The viewport is a flex child of #app, so the honest way to change its
     shape without a real window resize is to change the page's box. */
  function setPage(w, h) {
    const b = document.body.style;
    b.width = w + 'px'; b.height = h + 'px';
    b.inset = 'auto'; b.left = '0'; b.top = '0';
    document.body.getBoundingClientRect();
  }

  async function boot() {
    const K = window.__kubik;
    await sleep(1000);
    say('ResizeObserver: ' + (typeof ResizeObserver === 'function' ? 'present' : 'ABSENT'));
    say('');
    report(K, 'portrait, as loaded');

    // --- 1. a resize event that LIES, which is what iOS rotation does -----
    // The event arrives while the layout is still the old one; the new box
    // lands a few frames later, with no second event.
    say('');
    say('-- turned to landscape, resize fires BEFORE the layout moves --');
    window.dispatchEvent(new Event('resize'));
    setPage(852, 393);
    await sleep(60);
    report(K, '  60ms after');
    await sleep(400);
    report(K, '  400ms after');
    await sleep(1300);
    report(K, '  1.7s after (heartbeat)');

    // --- 2. and back, the same way ---------------------------------------
    say('');
    say('-- turned back to portrait, same lying event --');
    window.dispatchEvent(new Event('resize'));
    setPage(393, 852);
    await sleep(60);
    report(K, '  60ms after');
    await sleep(400);
    report(K, '  400ms after');
    await sleep(1300);
    report(K, '  1.7s after (heartbeat)');

    // --- 3. a size change with NO event at all ---------------------------
    say('');
    say('-- resized with no window event at all --');
    setPage(700, 500);
    await sleep(400);
    report(K, '  400ms after');

    say('');
    say('laid out for: ' + JSON.stringify(K.lastViewSize));
    finish();
  }
  const go = () => setTimeout(() => { boot().catch(e => { say('THREW ' + e.message + '\n' + e.stack); finish(); }); }, 2200);
  if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
})();
