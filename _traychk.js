/* Do the two shelves actually open, and where do they land? Measured on a
   REAL clock, because a max-height transition does not run under Chrome's
   virtual time and every screenshot of an open tray is a picture of its
   start value. */
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
  const box = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return sel + ' MISSING';
    const r = el.getBoundingClientRect();
    return sel.padEnd(14) + 'x=' + Math.round(r.left) + ' y=' + Math.round(r.top) +
           ' w=' + Math.round(r.width) + ' h=' + Math.round(r.height);
  };
  async function boot() {
    const K = window.__kubik;
    await sleep(600);
    const hdr = document.querySelector('#hdr').getBoundingClientRect();
    const ro = document.querySelector('#toolChip');
    say('closed:');
    say('  ' + box('#hdr'));
    if (ro) say('  readout       y=' + Math.round(ro.getBoundingClientRect().top) +
                ' h=' + Math.round(ro.getBoundingClientRect().height) +
                ' bottom=' + Math.round(ro.getBoundingClientRect().bottom));
    say('  ' + box('#outTab'));
    say('  ' + box('#matTab'));
    say('  ' + box('#viewCube'));
    say('  gap header->readout = ' + (ro ? Math.round(ro.getBoundingClientRect().top - hdr.bottom) : '?'));
    say('  gap readout->outTab = ' + (ro ? Math.round(
      document.querySelector('#outTab').getBoundingClientRect().top - ro.getBoundingClientRect().bottom) : '?'));

    K.setOutlinerOpen(true);
    await sleep(500);
    say('outliner open:');
    say('  ' + box('#outTray'));
    say('  rows=' + document.querySelectorAll('#outList .outRow').length);
    say('  matTray still open? ' + document.querySelector('#matFly').classList.contains('open'));

    K.setMatTrayOpen(true);
    await sleep(500);
    say('materials open:');
    say('  ' + box('#matTray'));
    say('  ' + box('#matTrayInner'));
    say('  cards=' + document.querySelectorAll('#matTrayInner .mat-card').length);
    say('  outliner still open? ' + document.querySelector('#outFly').classList.contains('open'));
    say('  --mat-max = ' + getComputedStyle(document.querySelector('#matFly')).getPropertyValue('--mat-max'));
    finish();
  }
  const go = () => setTimeout(() => { boot().catch(e => { say('THREW ' + e.message); finish(); }); }, 2000);
  if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
})();
