/* Does the op bar's bottom row fit, at phone widths, with the widest set of
   cells the bar ever puts up - edge bevel's Flat/Round plus the segment
   stepper plus Cancel plus Apply? Reports every cell's box and any overlap.
   Real clock: the deck surfaces with an animation. */
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

  const IDS = ['opGrouping', 'opToggleWrap', 'opSegments', 'opCancel', 'opOk'];

  function report(tag, ids) {
    const bar = document.getElementById('opBar').getBoundingClientRect();
    say(tag + '   bar ' + Math.round(bar.left) + '..' + Math.round(bar.right) +
        '  h=' + Math.round(bar.height));
    const seen = [];
    (ids || IDS).forEach(id => {
      const el = document.getElementById(id);
      if (!el || el.offsetParent === null) { say('  ' + id.padEnd(13) + '(hidden)'); return; }
      const r = el.getBoundingClientRect();
      say('  ' + id.padEnd(13) + 'x ' + Math.round(r.left) + '..' + Math.round(r.right) +
          '   y ' + Math.round(r.top) + '..' + Math.round(r.bottom) + '   w=' + Math.round(r.width));
      seen.push({ id: id, r: r });
    });
    let bad = 0;
    for (let i = 0; i < seen.length; i++) {
      for (let j = i + 1; j < seen.length; j++) {
        const a = seen[i].r, b = seen[j].r;
        if (a.right > b.left + 0.5 && b.right > a.left + 0.5 &&
            a.bottom > b.top + 0.5 && b.bottom > a.top + 0.5) {
          say('  OVERLAP: ' + seen[i].id + ' and ' + seen[j].id); bad++;
        }
      }
    }
    /* Rows by vertical OVERLAP, not by matching tops: the chips are 52 tall
       and the two commit buttons 44, centred against them, so a row is three
       different tops and counting tops said "2 rows" for every fit. */
    const rows = [];
    seen.slice().sort((a, b) => a.r.top - b.r.top).forEach(s => {
      const row = rows.find(r => s.r.top < r.bottom - 0.5 && s.r.bottom > r.top + 0.5);
      if (row) { row.top = Math.min(row.top, s.r.top); row.bottom = Math.max(row.bottom, s.r.bottom); }
      else rows.push({ top: s.r.top, bottom: s.r.bottom });
    });
    say('  ' + (bad ? bad + ' OVERLAPS' : 'no overlaps') + ', ' + rows.length + ' row(s)');
    // Everything must sit inside the bar's own padding box.
    const over = seen.filter(s => s.r.left < bar.left + 11 || s.r.right > bar.right - 11);
    say('  ' + (over.length ? 'OUT OF THE BAR: ' + over.map(s => s.id).join(', ')
                            : 'all cells inside the bar'));
  }

  async function boot() {
    const K = window.__kubik;
    const A = K.App, o = A.objects[0];
    K.setMode('edge');
    A.activeObjectId = o.id; A.selectedObjectIds = new Set([o.id]);
    K.ensureHelpers(o);
    A.selectedElements = new Set([0]);
    K.refreshUI();
    await sleep(200);
    K.bevelSelection();
    await sleep(600);
    /* Headless Chrome will not go below about 500px of window, so the phone
       widths are imposed on the VIEWPORT element instead - the op bar is
       absolutely positioned left:0 right:0 inside it, so its row lays out at
       exactly this width. The safe-area insets are 0 on a desktop either
       way, which is the one thing this cannot measure. */
    const vp = K.viewportEl;
    const was = vp.style.width;
    for (const w of [430, 393, 375, 360, 320]) {
      vp.style.width = w + 'px';
      vp.getBoundingClientRect();
      await sleep(120);
      report(String(w).padEnd(5));
    }
    /* v3.14: Punch's two pages, with the widest things each one shows -
       the cutter page under a long pattern name, the pattern page with
       both counters and Mirror. */
    K.cancelPendingOp();
    K.setMode('object');
    A.selectedObjectIds = new Set([o.id]); A.activeObjectId = null;
    K.punchSelection();
    for (let i = 0; i < 400 && !A.opSetup; i++) await sleep(25);
    if (!A.opSetup) { say('PUNCH DID NOT OPEN'); vp.style.width = was; finish(); return; }
    const P_IDS = ['opGrouping', 'opPageWrap', 'opGrouping2', 'opToggleWrap', 'opSegments', 'opSegments2',
                   'opExtraWrap', 'opCancel', 'opOk'];
    Object.assign(A.opSetup.p, { pat: 'line', count: 12, mirror: true, kind: 'dent' });
    K.refreshOpSetupMesh();
    document.getElementById('opPage').click();            // pattern page
    for (const pg of ['pattern', 'cutter']) {
      say('punch, ' + pg + ' page: "' + document.getElementById('opPage').textContent + '"');
      for (const w of [430, 393, 375, 360, 320]) {
        vp.style.width = w + 'px';
        vp.getBoundingClientRect();
        await sleep(120);
        // The readout's own line is a max-width: 520px rule, and this window
        // is 900 wide whatever the viewport element is narrowed to - so its
        // width here says nothing about a phone (checked in the browser pane).
        report(String(w).padEnd(5), P_IDS);
      }
      document.getElementById('opPage').click();
    }
    K.finishOpSetup(false);
    vp.style.width = was;
    finish();
  }
  const go = () => setTimeout(() => { boot().catch(e => { say('THREW ' + e.message); finish(); }); }, 2200);
  // Без window.load (урок v2.61): событие ждёт подресурсы, а __kubik
  // создаётся модулем до него; опрос внутри и так есть.
  go();
})();
