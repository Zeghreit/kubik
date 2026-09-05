/* a3.0 section 6.1, measured. Every layout constant the spec names, read off
   the live DOM at 393x852 with no safe-area inset - so the spec's numbers
   minus its 59px safe top are the targets. Reports the delta, because "it
   looks about right" is how a2.89 shipped a control on top of the toast. */
(function () {
  var out = [], errs = [];
  window.addEventListener('error', function (e) { errs.push(e.message); });

  function host() { return document.getElementById('viewport').getBoundingClientRect(); }

  // spec numbers are given from the top of the screen with a 59px safe area;
  // headless has none, so subtract it.
  var SAFE = 59, SAFE_B = 34;

  function box(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    var r = el.getBoundingClientRect(), h = host();
    if (r.width === 0 && r.height === 0) return { missing: true };
    return {
      x: Math.round(r.left - h.left), y: Math.round(r.top - h.top),
      w: Math.round(r.width), h: Math.round(r.height),
      right: Math.round(h.right - r.right), bottom: Math.round(h.bottom - r.bottom)
    };
  }

  /* want: {x|right, y|bottom, w, h} - only the keys given are checked. */
  function check(label, id, want) {
    var b = box(id);
    if (!b) { out.push(label + '=NO ELEMENT #' + id); return; }
    if (b.missing) { out.push(label + '=#' + id + ' HAS NO BOX (0x0 or display:none)'); return; }
    var bad = [];
    Object.keys(want).forEach(function (k) {
      var target = want[k] - (k === 'y' ? SAFE : 0) - (k === 'bottom' ? SAFE_B : 0);
      if (Math.abs(b[k] - target) > 1) bad.push(k + ' ' + b[k] + ' want ' + target);
    });
    out.push(label + '=' + 'x' + b.x + ' y' + b.y + ' ' + b.w + 'x' + b.h +
      ' (right ' + b.right + ', bottom ' + b.bottom + ')' +
      (bad.length ? '  OFF: ' + bad.join(', ') : '  ok'));
    return bad.length === 0;
  }

  function main() {
    var k = window.__kubik, A = k.App, h = host();
    out.push('viewport=' + Math.round(h.width) + 'x' + Math.round(h.height) +
      '  (spec frame 393x852, safe top ' + SAFE + ')');

    // A component mode, so the strip and the mode block are lit.
    var o = A.objects[0];
    k.setMode('face');
    A.activeObjectId = o.id; A.selectedObjectIds = new Set([o.id]);
    k.ensureHelpers(o);
    A.selectedElements = new Set([0]);
    k.refreshUI();

    out.push('--- 6.1 top strip ---');
    check('hue_strip  ', 'modeBar', { y: 59, h: 3 });
    check('drawer_fr  ', 'btnMenu', { x: 14, y: 66, w: 44, h: 44 });
    check('mode_block ', 'hdrMode', { x: 60, y: 66, h: 44 });
    check('axis_locks ', 'symAxes', { right: 14, y: 66, w: 136, h: 44 });
    check('readout    ', 'toolChip', { x: 14, y: 118 });
    check('view_cube  ', 'viewCube', { right: 14, y: 130, w: 56, h: 56 });

    var locks = document.querySelectorAll('#symAxes button');
    out.push('lock_cells=' + locks.length + ' cells' +
      (locks.length ? ', first ' + Math.round(locks[0].getBoundingClientRect().width) + 'px wide' : ''));
    var last = locks[locks.length - 1];
    out.push('locks_on_screen=' + (last && Math.round(last.getBoundingClientRect().right) <= Math.round(h.right) + 1
      ? 'the last lock is inside the viewport' : 'THE LAST LOCK IS OFF SCREEN'));

    // Does the cube actually draw? A box is not a picture.
    var cc = document.querySelector('#viewCube canvas');
    out.push('cube_canvas=' + (cc
      ? Math.round(cc.getBoundingClientRect().width) + 'x' + Math.round(cc.getBoundingClientRect().height) +
        ' css, ' + cc.width + 'x' + cc.height + ' buffer'
      : 'NO CANVAS IN #viewCube'));

    out.push('--- 6.1 the rest ---');
    check('outliner_tab', 'outTab', { x: 0, y: 300, w: 26, h: 64 });
    check('material_tab', 'matTab', { right: 0, y: 300, w: 26, h: 64 });
    check('undo       ', 'btnUndo', { x: 14, bottom: 38, w: 56, h: 44 });
    check('redo       ', 'btnRedo', { bottom: 38, w: 56, h: 44 });
    /* 38, not 6.1's 34: 34 IS the safe-area inset, which headless does not
       have, and the hub keeps a 4px floor so its tip never sits on the glass
       edge of a browser without one. On a phone it lands on 34 exactly. */
    check('hub        ', 'hubBtn', { right: 14, bottom: 38, w: 64, h: 64 });

    /* The material shelf, open. It changed edges, and a shelf that opens
       the wrong way is invisible in a still until you look for it. */
    var fly = document.getElementById('matFly');
    var tray = document.getElementById('matTray');
    // Transitions off first, or every measurement below is the FIRST FRAME of
    // a 220ms open - which reads as a shelf that never opened.
    tray.style.transition = 'none';
    k.setMatTrayOpen(true);
    out.push('mat_open_class=' + (fly.className || '(none)'));
    var fr = fly.getBoundingClientRect(), tr = tray.getBoundingClientRect();
    out.push('mat_fly=[' + Math.round(fr.left - h.left) + ',' + Math.round(fr.top - h.top) +
      ' ' + Math.round(fr.width) + 'x' + Math.round(fr.height) + ']  tray=[' +
      Math.round(tr.left - h.left) + ',' + Math.round(tr.top - h.top) +
      ' ' + Math.round(tr.width) + 'x' + Math.round(tr.height) + ']');
    var ts = getComputedStyle(tray);
    out.push('mat_tray_css=max-height ' + ts.maxHeight + ', opacity ' + ts.opacity +
      ', --mat-max ' + getComputedStyle(fly).getPropertyValue('--mat-max').trim());
    /* Everything visible in the bottom-right quadrant, named. The hub owns
       that corner now; anything else sitting in it was parked there by an
       older layout and nobody has looked since. */
    var corner = [];
    Array.prototype.forEach.call(document.querySelectorAll('body *'), function (el) {
      if (el.children.length && el.tagName !== 'BUTTON') return;
      var r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.opacity === '0') return;
      if (r.left < h.left + h.width * 0.6 || r.top < h.top + h.height * 0.75) return;
      corner.push((el.id || el.tagName.toLowerCase() + '.' + (el.className || '?')) +
        ' [' + Math.round(r.left - h.left) + ',' + Math.round(r.top - h.top) + ' ' +
        Math.round(r.width) + 'x' + Math.round(r.height) + ']');
    });
    out.push('bottom_right=' + (corner.length ? corner.join(' | ') : 'empty'));

    out.push('page.errors=' + (errs.length ? errs.join(' | ').slice(0, 400) : 'none'));
  }

  function ready(cb, t) {
    t = t || 0;
    if (window.__kubik && window.__kubik.App.objects.length) return cb();
    if (t > 300) { out.push('ERROR=no __kubik after ' + (t * 20) + 'ms'); return finish(); }
    setTimeout(function () { ready(cb, t + 1); }, 20);
  }
  function finish() {
    var pre = document.createElement('pre');
    pre.id = 'probeOut';
    pre.textContent = '<<<PROBE\n' + out.join('\n') + '\nPROBE>>>';
    document.body.appendChild(pre);
    document.title = 'PROBE-DONE';
  }
  setTimeout(function () {
    ready(function () {
      setTimeout(function () {
        try { main(); } catch (e) {
          out.push('ERROR=' + (e && e.stack ? e.stack.split('\n').slice(0, 6).join(' / ') : e));
        }
        finish();
      }, 600);
    });
  }, 300);
})();
