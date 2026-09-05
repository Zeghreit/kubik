/* a2.57a - one theme, a readable help glyph, and a destructive floor.

   Every assertion is a MEASUREMENT off the live DOM: what colour a thing
   actually resolves to, not what the stylesheet says. The light theme was
   retired for a measured contrast failure, so the replacement gets held to
   the same standard rather than to an opinion. */
(function () {
  var out = [], errs = [];
  var _ce = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); _ce.apply(console, arguments); };
  function log(k, v) { out.push(k + '=' + v); }
  var k, A;

  function rgb(str) {
    var m = /rgba?\(([^)]+)\)/.exec(str);
    if (!m) return null;
    var p = m[1].split(',').map(function (x) { return parseFloat(x); });
    return [p[0], p[1], p[2]];
  }
  function lum(c) {
    var a = c.map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }
  function ratio(fg, bg) {
    var a = lum(fg) + 0.05, b = lum(bg) + 0.05;
    return Math.round((a > b ? a / b : b / a) * 10) / 10;
  }
  function hx(h) {
    h = h.trim().replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function tok(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function main() {
    k = window.__kubik; A = k.App;

    /* ---- 1. Daylight is gone, not hidden behind a default ---- */
    log('1.data_theme_attr', document.documentElement.hasAttribute('data-theme')
      ? 'STILL THERE: ' + document.documentElement.getAttribute('data-theme') : 'gone');
    log('1.theme_button', document.getElementById('btnTheme') ? 'STILL THERE' : 'gone');
    log('1.tokens', '--bg ' + tok('--bg') + ' · --panel ' + tok('--panel') +
      ' · --text ' + tok('--text') + ' · --danger ' + tok('--danger'));
    log('1.body_bg', getComputedStyle(document.body).backgroundColor + '  (must be rgb(11, 13, 16))');
    log('1.scene_bg', '#' + k.scene.background.getHexString() + '  (must be 0b0d10)');

    /* ---- 2. The help glyph, measured ---- */
    var h = document.getElementById('btnHelp');
    var hs = getComputedStyle(h);
    var fg = rgb(hs.color), bg = rgb(hs.backgroundColor);
    log('2.help_glyph', hs.color + ' on ' + hs.backgroundColor);
    var r2 = ratio(fg, bg);
    log('2.help_contrast', r2 + ':1  ' + (r2 >= 4.5 ? 'passes AA' : 'FAILS AA (was 3.6:1)'));

    /* ---- 3. The destructive floor ---- */
    k.setMode('object');
    A.selectedObjectIds = new Set([A.objects[0].id]);
    k.refreshUI();
    var r3 = k.renderer.domElement.getBoundingClientRect();
    k.bloomToolRing(r3.left + r3.width / 2, r3.top + r3.height / 2, k.currentHubTools(), 1, null);
    var items = Array.prototype.slice.call(document.querySelectorAll('#touchToolRing .hub-item'));
    var marked = items.filter(function (el) { return el.classList.contains('danger'); });
    log('3.ring_items', items.length + ' seats');
    log('3.marked', marked.length + ' marked danger: [' +
      marked.map(function (el) { return el.dataset.key; }).join(', ') + ']  (must be just delete)');
    var del = items.filter(function (el) { return el.dataset.key === 'delete'; })[0];
    if (!del) { log('3.delete', 'NO DELETE SEAT IN THIS RING'); }
    else {
      var ds = getComputedStyle(del);
      var other = items.filter(function (el) { return el.dataset.key !== 'delete'; })[0];
      var os = other ? getComputedStyle(other) : null;
      log('3.delete_border', ds.borderTopColor + (os ? '  vs a constructive seat ' + os.borderTopColor : ''));
      log('3.delete_differs', os && ds.borderTopColor !== os.borderTopColor
        ? 'the floor no longer wears the constructive border' : 'IDENTICAL TO EVERY OTHER SEAT');
      var dr = ratio(rgb(ds.color), rgb(ds.backgroundColor));
      log('3.delete_contrast', dr + ':1  ' + (dr >= 3 ? 'legible' : 'TOO DIM'));
      /* a2.105: the STRIPES are what say danger, now that danger and the
         signal are one colour - a flat --danger disc is the Apply slab. The
         armed state used to drop them, and nothing here could tell: a
         gradient leaves backgroundColor transparent, so the contrast line
         above passes whatever the seat actually looks like. Read the image. */
      var striped = function (el) {
        return /repeating-linear-gradient/.test(getComputedStyle(el).backgroundImage);
      };
      var wasStriped = striped(del);
      del.classList.add('active');
      var armedStriped = striped(del);
      del.classList.remove('active');
      log('3.delete_striped', (wasStriped ? 'idle striped' : 'IDLE IS NOT STRIPED') +
        ' · ' + (armedStriped ? 'armed striped' : 'ARMED LOSES ITS STRIPES'));
    }
    k.closeToolRing();

    /* ---- 4. Mode Hue: the chrome takes the mode's colour ---- */
    var o0 = A.objects[0];
    var seen = {}, viewport = [];
    ['object', 'vertex', 'edge', 'face'].forEach(function (m) {
      A.selectedObjectIds = new Set([o0.id]);
      A.activeObjectId = o0.id;
      k.setMode(m);
      /* ARMED (a2.67). The hue hangs off a selection now, not off the mode,
         so a suite that measured it with nothing picked would report four
         neutrals and call Mode Hue dead. setMode clears the element
         selection, so arm it after. */
      if (m !== 'object') { k.ensureHelpers(o0); A.selectedElements = new Set([0]); }
      k.refreshUI();
      /* CSS transitions are why an earlier version of this suite reported
         the SAME colour for all four modes: getComputedStyle mid-transition
         returns the interpolated value, and at t=0 that is the old one.
         Finish every running animation first, then measure. */
      [document.getElementById('hubBtn'), document.getElementById('modeBar')].forEach(function (el) {
        if (el && el.getAnimations) el.getAnimations().forEach(function (an) { an.finish(); });
      });
      var attr = document.documentElement.dataset.mode;
      var acc = tok('--accent');
      /* a2.106: the hub's fill moved to ::before, because the rhomb is a
         clip-path and the element itself has to stay square for the ring.
         So the element's own backgroundColor is transparent now and reading
         it made all four hues measure 1.2:1 - the same blind spot the delete
         seat had. Read the layer that is actually painted. */
      var hubEl = document.getElementById('hubBtn');
      var hub = getComputedStyle(hubEl).backgroundColor;
      if (/rgba\(0, 0, 0, 0\)|transparent/.test(hub)) {
        hub = getComputedStyle(hubEl, '::before').backgroundColor;
      }
      var bar = getComputedStyle(document.getElementById('modeBar')).opacity;
      var panel = getComputedStyle(document.getElementById('drawer')).backgroundColor;
      var cAcc = ratio(rgb(hub), rgb(panel));
      var cOn = ratio(rgb(getComputedStyle(document.getElementById('hubBtn')).color), rgb(hub));
      seen[acc] = (seen[acc] || 0) + 1;
      log('4.' + m, 'data-mode=' + attr + ' · --accent ' + acc + ' · hub ' + hub + ' · bar ' + bar +
        ' · hue/panel ' + cAcc + ':1 ' + (cAcc >= 4.5 ? 'ok' : 'TOO DIM') +
        ' · label/hue ' + cOn + ':1 ' + (cOn >= 4.5 ? 'ok' : 'TOO DIM'));
      // Nothing in the SCENE may move when the chrome does.
      k.ensureHelpers(o0);
      var vc = o0.mesh.userData.vertexPoints.geometry.attributes.color.array;
      var ec = o0.mesh.userData.edgeLines.geometry.attributes.color.array;
      viewport.push(m + ':bg' + k.scene.background.getHexString() +
        '/v' + [vc[0], vc[1], vc[2]].map(function (x) { return x.toFixed(3); }).join(',') +
        '/e' + [ec[0], ec[1], ec[2]].map(function (x) { return x.toFixed(3); }).join(','));
    });
    log('4.four_distinct_hues', Object.keys(seen).length === 4
      ? 'four modes, four accents' : 'ONLY ' + Object.keys(seen).length + ' DISTINCT: ' + Object.keys(seen).join(' '));

    /* ---- 4b. THE HUE IS THE SELECTION, NOT THE MODE (a2.67) ----
       Reported from use: the first press of the mode button lands in Face -
       the lastComponentMode default - and the chrome went salmon before
       anything was picked. Both directions are asserted, because the bug
       was not that the colour was wrong but that it arrived too early. */
    var neutral = null;
    ['vertex', 'edge', 'face'].forEach(function (m) {
      k.setMode(m);
      A.selectedElements = new Set();      // in the mode, nothing picked
      k.refreshUI();
      [document.getElementById('hubBtn'), document.getElementById('modeBar')].forEach(function (el) {
        if (el && el.getAnimations) el.getAnimations().forEach(function (an) { an.finish(); });
      });
      var acc = tok('--accent');
      var bar = getComputedStyle(document.getElementById('modeBar')).opacity;
      if (neutral === null) neutral = acc;
      log('4b.' + m + '_unarmed', acc + ' · bar ' + bar +
        (acc === neutral && +bar === 0 ? ' - neutral, stripe down' : ' - STILL HUED WITH NOTHING PICKED'));
    });
    log('4b.matches_object', neutral === '#d5dce4'
      ? 'an unarmed component mode is Object mode\'s neutral'
      : 'UNARMED IS ' + neutral + ', NOT THE OBJECT NEUTRAL');

    /* And it comes back the moment something is picked, and drains again. */
    k.setMode('face'); k.ensureHelpers(o0);
    A.selectedElements = new Set([0]); k.refreshUI();
    document.getElementById('modeBar').getAnimations().forEach(function (a) { a.finish(); });
    var armed = tok('--accent'), armedBar = getComputedStyle(document.getElementById('modeBar')).opacity;
    A.selectedElements = new Set(); k.refreshUI();
    document.getElementById('modeBar').getAnimations().forEach(function (a) { a.finish(); });
    var drained = tok('--accent');
    log('4b.arrives_on_select', armed === '#b48cff' && +armedBar === 1
      ? 'picking a face turns the chrome violet and raises the stripe'
      : 'SELECTING DID NOT ARM IT (' + armed + ', bar ' + armedBar + ')');
    log('4b.drains_on_clear', drained === neutral
      ? 'clearing the selection puts it back to neutral'
      : 'IT STAYED HUED AFTER CLEARING (' + drained + ')');
    k.setMode('object'); A.selectedElements = new Set(); k.refreshUI();
    /* ---- 5. ...and the HUE still stops there ----
       Rewritten at a2.62. The original assertion was that NOTHING in the
       viewport moved with the mode, which was the a2.58 rule; a2.59 gave
       the selection the mode's colour and a2.62 gave the wireframe the
       mode's weight, both on purpose. What still has to hold is the part
       that was ever really at stake: no mode may change the scene's own
       colours. The background, and the colour of an UNSELECTED vertex dot -
       whose SIZE carries the mode, not its hue. The wireframe's per-mode
       weight is measured in section 10, against the theme's own edge
       colour, so a hue shift there would show up as a broken ratio. */
    var vsame = viewport.every(function (x) {
      var a = x.split('/e')[0], b = viewport[0].split('/e')[0];
      return a.slice(a.indexOf(':')) === b.slice(b.indexOf(':'));
    });
    log('5.scene_untouched', vsame
      ? 'background and dot colours identical in all four modes'
      : 'THE HUE LEAKED INTO THE MODEL: ' + viewport.join(' | '));

    /* ---- 5b. What must NOT go neutral when nothing is picked (a2.67) ----
       The first cut of a2.67 gated every accent consumer on the selection.
       The ring broke outright: .hub-item already wears an accent BORDER, so
       .on differs from off by tint and glyph alone, and at the neutral an
       "on" toggle read dimmer than an off one. setMode clears the selection,
       so a hold straight after a mode switch showed it every time. */
    k.setMode('face'); A.selectedElements = new Set(); k.refreshUI();
    log('5b.unarmed_for_the_ring', tok('--accent') === '#d5dce4' && tok('--accent-mode') === '#b48cff'
      ? 'accent neutral, accent-mode still the mode hue'
      : 'THE TWO VARIABLES DISAGREE (' + tok('--accent') + ' / ' + tok('--accent-mode') + ')');
    /* The on-state needs a cue that is not hue at all. */
    var probeItem = document.createElement('div');
    probeItem.className = 'hub-item';
    document.getElementById('touchToolRing').appendChild(probeItem);
    var offW = getComputedStyle(probeItem).borderTopWidth;
    probeItem.classList.add('on');
    var onW = getComputedStyle(probeItem).borderTopWidth;
    var onTint = getComputedStyle(probeItem).backgroundColor;
    probeItem.remove();
    log('5b.on_is_not_only_colour', parseFloat(onW) > parseFloat(offW)
      ? 'an on ring item is heavier as well as tinted (' + offW + ' -> ' + onW + ')'
      : 'THE ON STATE IS HUE ALONE (' + offW + ' -> ' + onW + ')');
    log('5b.on_tint_is_the_mode', onTint !== 'rgba(0, 0, 0, 0)' ? 'tinted ' + onTint : 'NO TINT AT ALL');

    /* A knife clears the selection on purpose and then runs modal with the
       op bar up. Its commit button must not read as an idle control. */
    A.selectedElements = new Set();
    A.pendingOp = { live: false, kind: 'probe' };
    k.refreshUI();
    var armedByOp = tok('--accent');
    A.pendingOp = null; k.refreshUI();
    log('5b.a_live_op_is_armed', armedByOp === '#b48cff'
      ? 'a pending op keeps the chrome armed with an empty selection'
      : 'A LIVE OP READS NEUTRAL (' + armedByOp + ')');
    k.setMode('object'); k.refreshUI();

    /* ---- 6. What the a2.58 review found ---- */
    // The bar must be HIDDEN by default, or a cold load paints a grey rule
    // across the top until the module that writes the attribute has run.
    var root = document.documentElement, held = root.getAttribute('data-mode');
    root.removeAttribute('data-mode');
    var mb = document.getElementById('modeBar');
    if (mb.getAnimations) mb.getAnimations().forEach(function (a) { a.finish(); });
    log('6.default_hidden', getComputedStyle(mb).opacity === '0'
      ? 'no attribute, no bar' : 'GREY BAR ON EVERY COLD LOAD');
    root.setAttribute('data-mode', held);

    // The accent must not simply BE the dim text colour, or every "chosen"
    // cue that works by colour says what "not chosen" says.
    log('6.object_accent_vs_dim', (function () {
      root.setAttribute('data-mode', 'object');
      var a = tok('--accent'), d = tok('--text-dim');
      root.setAttribute('data-mode', held);
      return a === d ? 'IDENTICAL (' + a + ')' : a + ' vs dim text ' + d + ' - distinct';
    })());

    // A tinted "on" chip has to read as tinted, and its glyph has to read
    // on the tint.
    ['object', 'vertex', 'edge', 'face'].forEach(function (m) {
      root.setAttribute('data-mode', m);
      /* ARMED (a2.67): this drives the attribute directly rather than going
         through setMode, so it has to set the second one directly too - or
         it measures the object neutral four times and calls that four
         passes. The tints are only reachable with something selected. */
      if (m === 'object') root.removeAttribute('data-armed');
      else root.setAttribute('data-armed', '');
      var acc = tok('--accent'), dim = tok('--accent-dim'), p2 = tok('--panel2');
      var t = ratio(hx(dim), hx(p2)), g = ratio(hx(acc), hx(dim));
      log('6.tint_' + m, 'dim ' + dim + ' reads ' + t + ':1 on the panel ' +
        (t >= 1.25 ? 'ok' : 'INVISIBLE TINT') + ' · glyph on it ' + g + ':1 ' +
        (g >= 3 ? 'ok' : 'TOO DIM'));
    });
    root.setAttribute('data-mode', held);

    // The delete seat must differ from its neighbours by more than hue - in
    // Face mode --danger and the mode accent are two warm reds.
    ['object', 'face'].forEach(function (m) {
      A.selectedObjectIds = new Set([A.objects[0].id]);
      A.activeObjectId = A.objects[0].id;
      k.setMode(m);
      k.refreshUI();
      k.bloomToolRing(r3.left + r3.width / 2, r3.top + r3.height / 2, k.currentHubTools(), 1, null);
      var its = Array.prototype.slice.call(document.querySelectorAll('#touchToolRing .hub-item'));
      var d = its.filter(function (e) { return e.dataset.key === 'delete'; })[0];
      var n = its.filter(function (e) { return e.dataset.key !== 'delete'; })[0];
      if (d && n) {
        var db = getComputedStyle(d).backgroundColor, nb = getComputedStyle(n).backgroundColor;
        log('6.delete_fill_' + m, db + ' vs neighbour ' + nb + ' - ' +
          (db !== nb ? 'a disc no other seat has' : 'SAME FILL, HUE IS THE ONLY CUE'));
      }
      k.closeToolRing();
    });

    /* ---- 7. The selection follows the mode (a2.59) ---- */
    var o7 = A.objects[0];
    function selCol(o) {                       // the colour a SELECTED vertex wears
      var pts = o.mesh.userData.vertexPoints;
      if (!pts) return 'no dots';
      var c = pts.geometry.attributes.color.array;
      var lo = o.mesh.userData.topo, n = c.length / 3, i;
      for (i = 0; i < n; i++) {                // the one that is not the base colour
        if (Math.abs(c[i * 3] - c[0]) > 0.01 || Math.abs(c[i * 3 + 1] - c[1]) > 0.01) break;
      }
      void lo;
      return i < n ? [c[i * 3], c[i * 3 + 1], c[i * 3 + 2]].map(function (x) { return x.toFixed(2); }).join(',')
                   : 'nothing selected';
    }
    var got = {};
    ['vertex', 'edge', 'face'].forEach(function (m) {
      A.selectedObjectIds = new Set([o7.id]);
      A.activeObjectId = o7.id;
      k.setMode(m);
      k.ensureHelpers(o7);
      A.selectedElements = new Set([0]);
      k.refreshElementColors(o7);
      k.refreshUI();
      var mat = m === 'vertex' ? (o7.mesh.userData.selPoints || {}).material
              : m === 'edge' ? (o7.mesh.userData.selLines || {}).material
              : (o7.mesh.userData.faceOverlay || {}).material;
      var hexv = mat && mat.color ? '#' + mat.color.getHexString() : 'NO OVERLAY';
      got[m] = hexv;
      log('7.' + m, 'selection overlay ' + hexv);
    });
    log('7.three_distinct', (got.vertex !== got.edge && got.edge !== got.face && got.vertex !== got.face)
      ? 'each mode selects in its own colour' : 'MODES SHARE A SELECTION COLOUR');

    /* The stale-buffer trap the review found: an object that STOPS being
       active keeps the colours it was last painted with, and the re-target
       paths do not repaint. Painting only the active object would leave a
       phantom selection in the wrong hue. */
    A.selectedObjectIds = new Set([o7.id]);
    A.activeObjectId = o7.id;
    k.setMode('vertex');
    k.ensureHelpers(o7);
    A.selectedElements = new Set([0]);
    k.refreshElementColors(o7);           // o7's buffer now holds gold
    A.activeObjectId = null;              // walk away, as the re-target paths do
    A.selectedElements.clear();
    k.refreshUI();
    k.setMode('edge');                    // the colour moves while o7 is not active
    k.refreshUI();
    log('7.stale_buffer', selCol(o7) === 'nothing selected'
      ? 'the object left behind was repainted too'
      : 'PHANTOM LEFT ON ' + o7.name + ': ' + selCol(o7));

    /* ---- 8. The view cube (a2.60) ---- */
    var vc = k.viewCube, cs = k.cubeScene, cc = k.cubeCam;
    log('8.exists', vc && cs && cc ? 'scene, camera and widget present' : 'MISSING PIECES');
    if (vc && cs && cc) {
      var mesh = cs.children.filter(function (o) { return o.isMesh; })[0];
      log('8.mesh', mesh ? mesh.material.length + ' face materials, ' +
        mesh.children.length + ' child (the edge outline)' : 'NO CUBE MESH IN THE SCENE');
      if (mesh) {
        var textured = mesh.material.filter(function (m) { return !!m.map; }).length;
        log('8.textures', textured + '/6 faces carry a label texture');
      }
      // cubeSync puts the little camera on the same unit vector as the real
      // one, so the picture is a pure function of the camera's direction.
      vc.render({ render: function () {} });
      var dirMain = k.camera.position.clone().sub(k.orbit.target).normalize();
      var dirCube = cc.position.clone().normalize();
      log('8.tracks_camera', dirMain.dot(dirCube).toFixed(3) +
        '  (1.000 = the cube looks from where you look)');
      log('8.cam_frustum', 'ortho ' + cc.left + '..' + cc.right + ' x ' + cc.bottom + '..' + cc.top +
        ', at ' + cc.position.length().toFixed(2) + ' units - cube half-diagonal is 0.87');

      // A tap in the middle of the widget must hit a face and start a swing.
      var cr = document.getElementById('viewCube').getBoundingClientRect();
      var hit = vc.handleClick({ clientX: cr.left + cr.width / 2, clientY: cr.top + cr.height / 2 });
      log('8.centre_tap', hit ? 'hits a face and starts the swing' : 'TAP MISSED THE CUBE');
      log('8.animating', vc.animating ? 'swinging' : 'NOT ANIMATING AFTER A HIT');
      // A tap in the corner of the box, off the cube, must be refused so it
      // falls through to the viewport.
      var miss = vc.handleClick({ clientX: cr.left + 2, clientY: cr.top + 2 });
      log('8.corner_tap', miss ? 'CORNER CLAIMED BY THE CUBE' : 'falls through to the model');

      /* A gesture has to be able to take the camera back. Without this the
         swing kept rewriting camera.position under the drag, and then the
         orthographic snap fired anyway at whatever angle the drag reached. */
      vc.handleClick({ clientX: cr.left + cr.width / 2, clientY: cr.top + cr.height / 2 });
      vc.cancel();
      log('8.cancel', vc.animating ? 'CANCEL DID NOT STOP THE SWING'
        : 'a gesture abandons the swing');

      /* DOES IT ACTUALLY DRAW? Everything above could pass on a widget that
         paints nothing. The cube's renderer has no preserveDrawingBuffer,
         so the pixels have to be read in the same turn as the draw. */
      try {
        vc.render(k.cubeRenderer);
        var gl = k.cubeRenderer.getContext();
        var w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
        var px = new Uint8Array(w * h * 4);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
        var lit = 0, hues = {};
        for (var q = 0; q < px.length; q += 4) {
          if (px[q + 3] > 8) {
            lit++;
            var key = (px[q] >> 5) + ',' + (px[q + 1] >> 5) + ',' + (px[q + 2] >> 5);
            hues[key] = (hues[key] || 0) + 1;
          }
        }
        var pct = Math.round(lit / (w * h) * 100);
        log('8.paints', pct + '% of the ' + w + 'x' + h + ' canvas is drawn on ' +
          (pct > 15 && pct < 80 ? '- a cube-sized shape' : '- SUSPECT'));
        log('8.palette', Object.keys(hues).length + ' distinct tones (faces, labels, edges)');
      } catch (e) {
        log('8.paints', 'COULD NOT READ THE CANVAS: ' + e);
      }
    }

    /* ---- 9. Perspective / orthographic (a2.61) ----
       The rule: only TURNING the view leaves the flat one. Panning and
       zooming stay in it, because drafting is what it is for. */
    var T3 = k.THREE, orb = k.orbit;
    /* NO CAPTURED CAMERA. Since a2.85 the pill SWAPS the camera object,
       and a reference taken before an engage points at the lens that is
       no longer being drawn. This probe held one and moved it while the
       flat camera was live, so the direction the watch measures changed
       under it and every pan and zoom read as a turn - four sections
       failed and none of them was the app's fault. Read `k.camera`. */
    /* THE PILL IS GONE (a2.90b) - projection is a seat in the world ring
       now, beside See-through, Floor grid and Snap. This section stops
       measuring a rectangle and starts driving a seat. */
    function projSeat() {
      return k.HUB_TOOLS_WORLD.filter(function (t) { return t.key === 'proj'; })[0];
    }
    /* The seat wears a glyph rather than a word, so read which
       glyph: the flat one is the box with parallel edges (h13.3), the other
       is the one whose edges converge. */
    function pillSays() {
      var st = projSeat();
      var ic = typeof st.icon === 'function' ? st.icon() : st.icon;
      return ic + (st.on() ? ' (lit)' : ' (quiet)');
    }
    function dir() { return k.camera.position.clone().sub(orb.target).normalize(); }
    function gesture(fn) {                       // start ... move ... change
      orb.dispatchEvent({ type: 'start' });
      fn();
      orb.dispatchEvent({ type: 'change' });
      orb.dispatchEvent({ type: 'end' });
    }

    k.disengageOrtho(true);
    log('9.starts_perspective', k.orthoOn ? 'ALREADY FLAT' : 'perspective · pill says ' + pillSays());

    /* WHERE IT ACTUALLY SITS. The gap under the cube is 84px wide and the
       material tab owns the edge beside it, so this is the one placement in
       the file that can silently run off the screen. */
    var seat = projSeat();
    var vp = document.getElementById('viewport').getBoundingClientRect();
    var mt = document.getElementById('matFly');
    var mr = mt ? mt.getBoundingClientRect() : null;
    var cbr = document.getElementById('viewCube').getBoundingClientRect();
    log('9.no_pill_on_screen', document.getElementById('projPill')
      ? 'THE PILL IS STILL IN THE VIEWPORT' : 'nothing on the edge - it is a ring seat now');
    /* a2.109 retired the halves; a2.110 put the ring on eight literal
       bearings, 0 = straight up and clockwise, so the LEFT side is 5, 6, 7.
       Flat view is still a VIEW toggle: it has to keep a bearing over there
       with the other state toggles, and never the downward one (4). */
    log('9.seat_is_a_view_toggle', seat
      ? 'seat=' + seat.seat + ', with ' +
        k.HUB_TOOLS_WORLD.filter(function (t) { return t.on && t.key !== 'proj'; })
          .map(function (t) { return k.toolLabel(t) + '@' + t.seat; }).join(', ') +
        (seat.seat >= 5 && seat.seat <= 7 ? '' : ' -- WRONG SIDE')
      : 'THERE IS NO PROJECTION SEAT IN THE WORLD RING');
    log('9.seat_shows_state', (function () {
      if (!seat) return 'no seat';
      k.disengageOrtho(true);
      var offIcon = seat.icon(), offOn = seat.on();
      k.engageOrtho('pill');
      var onIcon = seat.icon(), onOn = seat.on();
      return 'off: ' + offIcon + '/' + offOn + ', on: ' + onIcon + '/' + onOn +
        (offIcon === 'persp' && !offOn && onIcon === 'ortho' && onOn
          ? ' - the glyph says which projection, the accent says it is a state'
          : ' -- THE SEAT DOES NOT FOLLOW THE PROJECTION');
    })());
    var tab = document.getElementById('matTab');
    var tr = tab ? tab.getBoundingClientRect() : null;
    /* SYMMETRY IS BACK IN THIS STRIP AT a2.90, as a row of three axis
       switches beside the projection pill - and there is no toggle any more,
       a lit axis being symmetry on. It went top-left at a2.89 and came back
       one version later, which is worth saying rather than quietly
       rewriting: the corner was the wrong home, and the toast landing on the
       switches was how that showed.

       `_symaxes_probe` owns how the switches BEHAVE. What belongs here is
       the strip they share with the pill. */
    var sym = document.getElementById('symAxes');
    var sr = sym.getBoundingClientRect();
    /* RECTANGLES, NOT X RANGES (a2.65). The pair sits in the strip UNDER the
       cube and the material flyout moved down to 194 to leave it that strip,
       so sharing a column with the tray is the design rather than a fault.
       Comparing right edges alone reported the new layout as broken while
       nothing on screen was touching anything. */
    function menuRect() {
      var m = document.getElementById('btnMenu');
      return m ? m.getBoundingClientRect() : { left: 0, right: 0, top: 0, bottom: 0 };
    }
    function hits(a, b) {
      return a.left < b.right - 0.5 && a.right > b.left + 0.5 &&
             a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;
    }
    log('9.sym_box', 'x ' + Math.round(sr.left) + '..' + Math.round(sr.right) +
      ' y ' + Math.round(sr.top) + '..' + Math.round(sr.bottom));
    /* The pill was measured for being 44px; a ring seat has no rect of its
       own until the ring blooms, and the ring already sizes every seat the
       same. What is worth asserting instead is that the seat carries a
       LABEL, since the ring is the only place its name is ever shown. */
    log('9.seat_has_a_label', seat && seat.label && seat.label.length > 2
      ? 'labelled "' + seat.label + '"'
      : 'THE PROJECTION SEAT HAS NO LABEL');
    /* HOW DEEP THE TOP-LEFT COLUMN IS. a2.65 tore this corner out because
       menu over symmetry over lighting ran to 211pt on a phone before the
       model got a look in, and a2.90b wrote down what replaced that rule:
       two items is the most it has ever carried well.

       So the question is not "is it empty" - a2.90b asked that and a2.91
       rightly failed it by putting the outliner tab there. The question is
       DEPTH. What lives here is named, and how far down the stack reaches is
       printed, so a third arrival has to argue with a number. */
    log('9.left_column_depth', (function () {
      /* a2.100: the menu lives in the header's right cell, so the left
         column is measured from the header's bottom-left instead. */
      var hr = document.getElementById('hdr').getBoundingClientRect();
      var m = { left: hr.left, right: hr.left + 44, top: hr.top, bottom: hr.bottom }, stack = [], bottom = m.bottom;
      Array.prototype.forEach.call(
        document.querySelectorAll('#viewport > *'), function (el) {
          if (el.id === 'btnMenu' || el.id === 'hdr' || el.id === 'toolChip' || !el.id) return;
          var r = el.getBoundingClientRect();
          if (!r.width || !r.height) return;
          // Down the left edge, below the menu, in the band above the hub.
          if (r.left < m.right + 40 && r.top > m.bottom - 1 && r.top < m.bottom + 200) {
            stack.push(el.id);
            bottom = Math.max(bottom, r.bottom);
          }
        });
      var deep = 1 + stack.length;
      return deep + ' deep (menu' + (stack.length ? ' + ' + stack.join(' + ') : '') +
        '), reaching y ' + Math.round(bottom) +
        /* a2.103: the left edge is THE RAIL by decision - the outliner and the
           material shelf are its two seats under the header. Three deep
           counting the header is the design, not drift.

           The reach moved at v2.2 and the bound moves with it: the rail
           starts at 81 now (one readout-gap under the readout) and each tab
           is 96 rather than 64, because each carries its own name turned on
           its side. 81 + 96 + 8 + 96 = 281, so 300 is that with air. If a
           THIRD seat ever arrives the depth catches it; this number only
           ever describes how tall two seats are. */
        (deep <= 3 && bottom < 300
          ? ' - the rail: two seats under the header (a2.103)'
          : ' -- THE COLUMN a2.65 REMOVED IS GROWING BACK');
    })());
    /* a2.100: the axes are header cells, and the menu is the last cell - so
       "on the edge" now means flush against the menu cell. */
    log('9.axes_on_the_edge', Math.abs(sr.right - menuRect().left) < 3
      ? 'the row sits against the menu cell, in the header'
      : 'THE ROW IS NOT AGAINST THE MENU (right ' + Math.round(sr.right) +
        ' vs menu ' + Math.round(menuRect().left) + ')');
    /* With the pill gone at a2.90b the viewport edge holds one thing up
       here, and everything the pill used to be measured against is measured
       against the axes row instead. */
    log('9.axes_clear_the_tab', tr ? (!hits(sr, tr)
      ? 'the axes clear the material tab' : 'THE AXES HIT THE MATERIAL TAB (tab y ' +
        Math.round(tr.top) + '..' + Math.round(tr.bottom) + ')') : 'no material tab found');
    log('9.axes_clear_the_flyout', mr ? (!hits(sr, mr)
      ? 'the axes clear the whole material flyout' : 'THE FLYOUT HITS THE AXES (flyout y ' +
        Math.round(mr.top) + '..' + Math.round(mr.bottom) + ')') : 'no flyout found');
    log('9.sym_clears_everything', (!tr || !hits(sr, tr)) && (!mr || !hits(sr, mr)) &&
      !hits(sr, cbr) && !hits(sr, menuRect())
      ? 'the axes touch nothing - not the cube, the tab, the flyout or the menu'
      : 'THE SYMMETRY AXES OVERLAP SOMETHING');
    /* The cube's faces are the one surface that must stay unambiguous: its
       taps mean look-down-this-axis, and a switch over them would make that
       a guess. */
    // a2.100: ABOVE the cube now, in the header; the rule is the same - never on it.
    log('9.sym_below_the_cube', sr.bottom <= cbr.top + 0.5 || sr.top >= cbr.bottom - 0.5
      ? 'clear of the cube, never on it'
      : 'THE AXES SIT ON THE CUBE (cube ' + Math.round(cbr.top) + '..' + Math.round(cbr.bottom) + ')');
    /* THE PROJECTION PILL CARRIES NO WORD - it is a glyph, because "which
       projection am I in" has no natural one-letter name. The symmetry axes
       DO carry letters, and should: X, Y and Z are the names of the thing,
       not a description of it, and no glyph says "Z" better than Z does.
       This section is about the pill; the letters are checked for being
       exactly one character each. */
    log('9.no_words_on_the_pill', (function () {
      var words = [];
      var st = projSeat();
      if (st && typeof st.icon !== 'function' && String(st.icon).length > 2) {
        words.push('the projection seat carries "' + st.icon + '"');
      }
      if (document.getElementById('lightPill')) words.push('lightPill is still here');
      return words.length ? 'STILL CARRYING TEXT: ' + words.join(', ')
                          : 'the pill carries no word';
    })());
    log('9.axes_are_letters', (function () {
      var got = [];
      document.querySelectorAll('#symAxes button').forEach(function (b) {
        got.push((b.textContent || '').trim());
      });
      return got.join('') === 'XYZ' ? 'X, Y, Z - one character each'
                                    : 'THE AXES SAY "' + got.join(',') + '"';
    })());
    log('9.lighting_in_drawer', (function () {
      var lm = document.getElementById('lightMenu');
      if (!lm) return 'THERE IS NO LIGHT MENU AT ALL';
      var n = lm.querySelectorAll('button').length;
      return lm.closest('#drawer') ? 'in the drawer, ' + n + ' presets'
                                   : 'STILL FLOATING OVER THE VIEWPORT';
    })());

    /* AND AT PHONE WIDTH. The probe window is a laptop; the app is a phone
       app. Squeezing the viewport is enough, because every one of these is
       positioned against it. */
    var vpEl = document.getElementById('viewport');
    var held9 = vpEl.style.width;
    vpEl.style.width = '375px';
    var sr2 = sym.getBoundingClientRect();
    var mr2 = mt && mt.getBoundingClientRect();
    var vp2 = vpEl.getBoundingClientRect();
    log('9.at_375', 'axes x ' + Math.round(sr2.left) + '..' + Math.round(sr2.right) +
      ' · sym x ' + Math.round(sr2.left) + '..' + Math.round(sr2.right) +
      (mr2 ? ' · flyout y ' + Math.round(mr2.top) + '..' + Math.round(mr2.bottom) : '') +
      ' · viewport ends at ' + Math.round(vp2.right));
    log('9.at_375_fits', sr2.right <= vp2.right + 0.5 && sr2.left >= vp2.left - 0.5 &&
      (!mr2 || !hits(sr2, mr2))
      ? 'the axes fit and clear the flyout'
      : 'DOES NOT FIT AT PHONE WIDTH');
    vpEl.style.width = held9;

    k.engageOrtho();
    log('9.engaged', k.orthoOn ? 'flat · pill says ' + pillSays() + ' · fov ' + (k.camera.isOrthographicCamera ? 'parallel projection' : 'fov ' + k.camera.fov)
      : 'ENGAGE DID NOTHING');

    // PAN moves the camera and its target together: the direction you look
    // FROM does not change, so the flat view must survive it.
    gesture(function () {
      var d = new T3.Vector3(0.4, 0.15, -0.2);
      k.camera.position.add(d); orb.target.add(d);
    });
    log('9.pan_keeps_it', k.orthoOn ? 'still flat after a pan' : 'A PAN DROPPED THE FLAT VIEW');

    // A DOLLY only changes the distance.
    gesture(function () {
      var d = k.camera.position.clone().sub(orb.target);
      k.camera.position.copy(orb.target).addScaledVector(d, 0.72);
    });
    log('9.zoom_keeps_it', k.orthoOn ? 'still flat after a zoom' : 'A ZOOM DROPPED THE FLAT VIEW');

    // A wobble under a degree is not a turn.
    gesture(function () {
      var d = k.camera.position.clone().sub(orb.target);
      d.applyAxisAngle(new T3.Vector3(0, 1, 0), 0.3 * Math.PI / 180);
      k.camera.position.copy(orb.target).add(d);
    });
    log('9.wobble_keeps_it', k.orthoOn ? 'still flat after 0.3 degrees'
      : 'A SUB-DEGREE WOBBLE DROPPED THE FLAT VIEW');

    /* A TURN KEEPS THE PILL'S FLAT VIEW (a2.86, scoped by a2.87). These
       sections engage through `engageOrtho()` with no `via`, which is the
       sticky kind - a decision, not a glance. The CUBE's flat view still
       ends on a turn, and `_proj_probe` sections 13-15 own that half of the
       rule; leaving both halves here would put one behaviour in two probes
       and let them drift apart. */
    var before9 = dir();
    gesture(function () {
      var d = k.camera.position.clone().sub(orb.target);
      d.applyAxisAngle(new T3.Vector3(0, 1, 0), 6 * Math.PI / 180);
      k.camera.position.copy(orb.target).add(d);
    });
    log('9.turn_keeps_it', k.orthoOn ? 'still flat after a six-degree turn'
      : 'A TURN DROPPED THE FLAT VIEW - the a2.61 rule is still in there');
    log('9.turn_kept_framing', 'direction moved ' +
      (Math.acos(Math.min(1, before9.dot(dir()))) * 180 / Math.PI).toFixed(1) + ' degrees');

    /* THE FLICK. A fast turn has barely moved by the time the finger leaves;
       damping delivers the rest afterwards, and the controls keep firing
       `change` the whole time. That coast used to be the subtlest way to
       lose the flat view; now nothing about it should touch the projection.
       Kept as a section because a coast is still the longest run of camera
       events the app ever sees without a finger on the glass. */
    k.engageOrtho();
    orb.dispatchEvent({ type: 'start' });
    (function () {
      var d = k.camera.position.clone().sub(orb.target);
      d.applyAxisAngle(new T3.Vector3(0, 1, 0), 0.2 * Math.PI / 180);
      k.camera.position.copy(orb.target).add(d);
    })();
    orb.dispatchEvent({ type: 'change' });
    orb.dispatchEvent({ type: 'end' });          // finger up, still flat
    var stillFlat = k.orthoOn;
    (function () {                                // ...and now the coast
      var d = k.camera.position.clone().sub(orb.target);
      d.applyAxisAngle(new T3.Vector3(0, 1, 0), 8 * Math.PI / 180);
      k.camera.position.copy(orb.target).add(d);
    })();
    orb.dispatchEvent({ type: 'change' });
    log('9.flick_coast', stillFlat && k.orthoOn
      ? 'flat through the finger-up and through the whole coast'
      : 'THE COAST CHANGED THE PROJECTION (flat at finger-up: ' + stillFlat + ')');

    /* ZOOMING STAYS FLAT, so the fog band and the far plane have to follow
       it. They used to be computed once at engage, which was only correct
       at the distance they were computed for: the flat view sits ~27x
       further out, the fog is banded by camera distance, and three wheel
       notches out used to leave the whole model solid background colour. */
    k.disengageOrtho(true);
    k.engageOrtho();
    /* The model sits at the target, so it is drawn at about `d` from the
       camera. Being NEARER than fog.near is the healthy case - no fog at
       all; being past fog.far is the failure, where the model is 100%
       background colour. The band should also sit the same distance ahead
       of the model as it does in perspective, which is what "the fade looks
       identical" means - reported so a drift shows up. */
    function bandOk(tag) {
      var d = k.camera.position.distanceTo(orb.target);
      var f = k.scene.fog;
      var ok = (!f || d < f.far) && d < k.camera.far && d > k.camera.near;
      log('9.band_' + tag, 'camera ' + d.toFixed(0) + ' · fog ' +
        (f ? f.near.toFixed(0) + '..' + f.far.toFixed(0) +
          ' (band starts ' + (f.near - d).toFixed(1) + ' ahead of the model)' : 'none') +
        ' · far ' + k.camera.far.toFixed(0) + ' — ' +
        (ok ? 'model is visible' : 'MODEL IS FOGGED OUT OR CLIPPED'));
    }
    bandOk('at_engage');
    gesture(function () {                       // zoom out hard
      var d = k.camera.position.clone().sub(orb.target);
      k.camera.position.copy(orb.target).addScaledVector(d, 2.5);
    });
    bandOk('zoomed_out');
    gesture(function () {                       // and back in
      var d = k.camera.position.clone().sub(orb.target);
      k.camera.position.copy(orb.target).addScaledVector(d, 0.15);
    });
    bandOk('zoomed_in');
    log('9.zoom_still_flat', k.orthoOn ? 'and it is still flat' : 'ZOOM LEFT THE FLAT VIEW');

    /* Framing has to be measured in the lens you will be LOOKING through.
       animateCameraTo leaves the flat view on the way out, so reading
       camera.fov while flat reads 2 and over-fits by about 27x - a focus
       that put the object on screen as a dot. */
    k.disengageOrtho(true);
    k.focusOnObject(o7);
    var wantD = k.camAnim ? k.camAnim.toPos.distanceTo(k.camAnim.toTarget) : null;
    k.engageOrtho();
    k.focusOnObject(o7);
    var flatD = k.camAnim ? k.camAnim.toPos.distanceTo(k.camAnim.toTarget) : null;
    log('9.focus_while_flat', (wantD && flatD)
      ? 'frames at ' + flatD.toFixed(2) + ' vs ' + wantD.toFixed(2) + ' in perspective — ' +
        (Math.abs(flatD - wantD) < 0.05 ? 'same framing' : 'WRONG LENS')
      : 'NO CAMERA FLIGHT TO MEASURE');

    // And the seat itself switches both ways.
    projSeat().run();
    var wasOn = k.orthoOn;
    projSeat().run();
    log('9.seat_toggles', wasOn && !k.orthoOn ? 'the ring seat switches both ways'
      : 'PILL DID NOT TOGGLE (on after first tap: ' + wasOn + ')');
    k.disengageOrtho(true);

    /* ---- 10. Mode, all the way down (a2.62) ----
       Four numbers per mode, and not one of them touches a material: the
       helpers are unlit and the model is not, so turning the LIGHTS down
       steps the surface back and leaves the components alone. */
    var hemiL = null, dirs = [];
    k.scene.traverse(function (o) {
      if (o.isHemisphereLight && !hemiL) hemiL = o;
      if (o.isDirectionalLight) dirs.push(o);
    });
    // The KEY is the brightest of the three; which one that is depends on
    // the lighting preset, so pick it by intensity rather than by identity.
    var dirL = dirs.slice().sort(function (a, b) { return b.intensity - a.intensity; })[0] || dirs[0];
    var o10 = A.objects[0];
    /* The mode's weight on the wireframe is BAKED per edge now, not carried
       by the material - so read it back out of the buffer. 0x65 is the red
       channel of the theme's own edge colour. */
    var EDGE_R = 0x65 / 255;
    function look(tag) {
      k.ensureHelpers(o10);
      var lines = o10.mesh.userData.edgeLines, pts = o10.mesh.userData.vertexPoints;
      var c = lines.geometry.attributes.color.array;
      log('10.' + tag, 'hemi ' + hemiL.intensity.toFixed(2) +
        ' · key ' + dirL.intensity.toFixed(2) +
        ' · env ' + (k.scene.environmentIntensity || 0).toFixed(2) +
        ' · hemisphere ' + (hemiL.color.getHex() === hemiL.groundColor.getHex() ? 'FLAT' : 'graded') +
        ' · wire x' + (c[0] / EDGE_R).toFixed(2) +
        ' · material x' + lines.material.color.r.toFixed(2) +
        ' · dot ' + pts.material.size.toFixed(1) + 'px');
    }
    ['object', 'vertex', 'edge', 'face'].forEach(function (m) {
      A.selectedObjectIds = new Set([o10.id]);
      A.activeObjectId = o10.id;
      k.setMode(m);
      k.refreshUI();
      look(m);
    });

    // Every mode must actually differ from Object, or the table is inert.
    k.setMode('object'); k.refreshUI();
    var base = hemiL.intensity;
    var moved = 0;
    ['vertex', 'edge', 'face'].forEach(function (m) {
      k.setMode(m); k.refreshUI();
      if (Math.abs(hemiL.intensity - base) > 1e-6) moved++;
    });
    log('10.all_four_differ', moved === 3 ? 'each mode lights the model its own way'
      : 'ONLY ' + moved + '/3 MODES CHANGED THE LIGHTING');

    /* THE TRAY SUSPENDS IT. A mode that dims the surface hides the material
       you are choosing, so with the tray open the viewport goes plain. */
    k.setMode('vertex'); k.refreshUI();
    var dim = hemiL.intensity;
    k.setMatTrayOpen(true);
    var open10 = hemiL.intensity;
    k.setMatTrayOpen(false);
    var shut10 = hemiL.intensity;
    log('10.tray_suspends', (open10 > dim + 1e-6 && Math.abs(shut10 - dim) < 1e-6)
      ? 'plain while the tray is open (' + dim.toFixed(2) + ' → ' + open10.toFixed(2) +
        ' → ' + shut10.toFixed(2) + ')'
      : 'TRAY DID NOT SUSPEND IT (' + dim.toFixed(2) + ' / ' + open10.toFixed(2) +
        ' / ' + shut10.toFixed(2) + ')');
    log('10.suspend_flag', k.modeViewSuspended ? 'FLAG LEFT ON' : 'flag cleared');

    /* THE MARKS ARE NOT THE WIREFRAME. Crease, sharp and the selected edge
       share one colour buffer with the plain wireframe, so a multiplier on
       the material scaled all four: Face mode dimmed the crease mark to a
       third in the mode you set creases in, and Edge mode drove crease and
       sharp up the tone-mapping roll-off toward the same white. */
    A.selectedObjectIds = new Set([o10.id]);
    A.activeObjectId = o10.id;
    k.setMode('edge');
    k.ensureHelpers(o10);
    A.selectedElements = new Set([0]);
    k.creaseSelection();
    A.selectedElements.clear();
    var creased = Object.keys(o10.mesh.userData.creases || {}).length;
    function markAt(idx) {
      var c = o10.mesh.userData.edgeLines.geometry.attributes.color.array;
      return [c[idx * 6], c[idx * 6 + 1], c[idx * 6 + 2]];
    }
    var marks = {};
    ['object', 'edge', 'face'].forEach(function (m) {
      k.setMode(m); k.refreshUI();
      k.refreshElementColors(o10);
      marks[m] = markAt(0);
    });
    // CREASE_COLOR is 0xff7a45: red channel 1.0 at its true value.
    var same = Math.abs(marks.object[0] - marks.edge[0]) < 0.01 &&
               Math.abs(marks.object[0] - marks.face[0]) < 0.01;
    log('10.crease_holds', creased === 0 ? 'NO CREASE WAS SET - check ran on nothing'
      : (same ? 'the crease mark is the same colour in every mode (r=' +
          marks.object[0].toFixed(2) + ')'
        : 'THE MODE SCALED THE CREASE MARK: object ' + marks.object[0].toFixed(2) +
          ' · edge ' + marks.edge[0].toFixed(2) + ' · face ' + marks.face[0].toFixed(2)));

    k.setMode('object'); k.refreshUI();

    /* ---- 11. The op bar and the tray handle (a2.63) ---- */
    /* The accent is READ AFTER the mode is set, because since a2.58 the
       accent IS the mode - reading it in Object mode and then opening the
       bar in Face mode compares a neutral against a salmon and finds
       nothing accented at all. */
    function isAccent(c) {
      /* a2.97: the primary is --signal, not the mode's accent - both count,
         because the point is that only ONE thing in the bar wears either. */
      var g = rgb(c);
      return !!g && [hx(tok('--accent')), hx(tok('--signal'))].some(function (a) {
        return Math.abs(a[0] - g[0]) < 3 && Math.abs(a[1] - g[1]) < 3 && Math.abs(a[2] - g[2]) < 3; });
    }
    var o11 = A.objects[0];
    A.selectedObjectIds = new Set([o11.id]);
    A.activeObjectId = o11.id;
    k.setMode('face');
    k.ensureHelpers(o11);
    A.selectedElements = new Set([0, 1]);
    k.refreshUI();
    k.insetSelection();
    var bar = document.getElementById('opBar');
    if (!bar || !bar.classList.contains('show')) {
      log('11.opbar', 'THE OP BAR DID NOT OPEN');
    } else {
      var bs = getComputedStyle(bar);
      /* ONE PRIMARY. Count everything in the bar wearing the accent as a
         BORDER or a FILL; the answer has to be the confirm button and
         nothing else. */
      var hits = [];
      if (isAccent(bs.borderTopColor)) hits.push('the bar outline');
      Array.prototype.slice.call(bar.querySelectorAll('*')).forEach(function (el) {
        var st = getComputedStyle(el);
        if (st.display === 'none') return;
        if (isAccent(st.backgroundColor)) hits.push(el.id || el.className || el.tagName);
      });
      log('11.accent_spent', hits.length + ' accented: [' + hits.join(', ') + ']  ' +
        (hits.length === 1 && hits[0] === 'opOk' ? 'once, on the button that commits' : 'MORE THAN ONE PRIMARY'));
      var vr = document.getElementById('opValue');
      log('11.value_readout', 'reads "' + vr.value + '" · ' + getComputedStyle(vr).borderTopWidth +
        ' border · ' + (vr.value.indexOf(',') < 0 ? 'a point, like every other readout' : 'A COMMA, UNLIKE EVERY OTHER READOUT'));
      log('11.ok_label', '"' + document.getElementById('opOk').textContent + '"');
    /* FINISH THE ANIMATION BEFORE MEASURING. The bar surfaces with a
       scale .94 -> 1 since a2.73, so a height read mid-animation comes back
       at 94% of the real one - 60px for a 64px bar. This file's own notes
       already say a transitioned property must be settled first; an
       animated one is the same trap. */
    bar.getAnimations().forEach(function (a) { a.finish(); });
      log('11.bar_height', Math.round(bar.getBoundingClientRect().height) + 'px' +
        ' (one row of 44 plus padding is 56)');

      /* THE CHOSEN SEGMENT HAS TO LOOK CHOSEN. A neutral tile on a dark
         track can measure 1.2:1 and vanish - and if plain hover is brighter
         than the chosen one, hovering an unchosen chip makes it read as
         chosen. */
      var chips = bar.querySelectorAll('.group button');
      var act = null, idle = null;
      Array.prototype.forEach.call(chips, function (b) {
        if (b.classList.contains('active')) { if (!act) act = b; }
        else if (!idle) idle = b;
      });
      if (act && idle) {
        var as = getComputedStyle(act), gs = getComputedStyle(act.parentNode);
        var vsTrack = ratio(rgb(as.backgroundColor), rgb(gs.backgroundColor));
        var lblOn = ratio(rgb(as.color), rgb(as.backgroundColor));
        log('11.chip_reads', 'chosen ' + as.backgroundColor + ' on track ' + gs.backgroundColor +
          ' = ' + vsTrack + ':1 ' + (vsTrack >= 3 ? 'ok' : 'INVISIBLE') +
          ' · label ' + lblOn + ':1 ' + (lblOn >= 4.5 ? 'ok' : 'TOO DIM'));
        log('11.chip_widths', Math.abs(act.getBoundingClientRect().width -
          act.getBoundingClientRect().width) < 0.01 &&
          getComputedStyle(idle).borderTopWidth === as.borderTopWidth
          ? 'chosen and unchosen carry the same border, so the row cannot shift'
          : 'BORDER MISMATCH: ' + getComputedStyle(idle).borderTopWidth + ' vs ' + as.borderTopWidth);
      } else { log('11.chip_reads', 'no grouping chips in this op'); }

      /* ARROW KEYS. A number input gave these for free; a text input does
         not, and the global stepper shortcut bails on any INPUT target. */
      var vEl = document.getElementById('opValue');
      var before11 = A.pendingOp ? A.pendingOp.amount : null;
      vEl.focus();
      vEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
      var after11 = A.pendingOp ? A.pendingOp.amount : null;
      log('11.arrow_keys', (before11 !== null && after11 !== null && after11 > before11)
        ? 'up steps the amount ' + before11.toFixed(3) + ' to ' + after11.toFixed(3) +
          ' and the field follows (' + vEl.value + ')'
        : 'ARROWS DO NOTHING (' + before11 + ' to ' + after11 + ')');
      vEl.blur();

      k.cancelPendingOp();
      k.refreshUI();
    }

    /* WELDED: the tab is the tray's left shoulder, not a chip beside it. */
    k.setMatTrayOpen(true);
    var tab = document.getElementById('matTab'), tray = document.getElementById('matTray');
    // The tab's width and the tray's height are transitioned, and
    // getBoundingClientRect mid-transition returns the FROM value.
    [tab, tray].forEach(function (el) {
      if (el.getAnimations) el.getAnimations().forEach(function (an) { an.finish(); });
    });
    var tabR = tab.getBoundingClientRect(), trayR = tray.getBoundingClientRect();
    log('11.tab_box', 'tab x ' + Math.round(tabR.left) + '..' + Math.round(tabR.right) +
      ' y ' + Math.round(tabR.top) + '..' + Math.round(tabR.bottom) +
      ' · tray x ' + Math.round(trayR.left) + '..' + Math.round(trayR.right) +
      ' y ' + Math.round(trayR.top) + '..' + Math.round(trayR.bottom));
    log('11.welded', Math.abs(tabR.right - trayR.left) < 1.5 && Math.abs(tabR.top - trayR.top) < 1.5
      ? 'one silhouette - the tab is the left shoulder of the tray'
      : 'STILL TWO CHIPS (gap ' + (trayR.left - tabR.right).toFixed(1) +
        'px, top offset ' + (trayR.top - tabR.top).toFixed(1) + 'px)');
    log('11.tab_target', Math.round(tabR.width) + 'x' + Math.round(tabR.height) +
      (tabR.height >= 44 ? ' - grabbable' : ' - TOO SMALL'));
    /* The strip has to clear the flyout OPEN as well as closed. Since a2.65
       the clearance is vertical - the tray starts at 194, below the 44px
       strip - so this is a box test like section 9's. It was "the pair"
       until a2.90b took the projection pill into the world ring; the axes
       row is what is left up there. */
    var flyR = document.getElementById('matFly').getBoundingClientRect();
    var symR = document.getElementById('symAxes').getBoundingClientRect();
    function hits11(a, b) {
      return a.left < b.right - 0.5 && a.right > b.left + 0.5 &&
             a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;
    }
    log('11.strip_clears_open_tray', !hits11(symR, flyR)
      ? 'the axes are clear of the open flyout too'
      : 'THE OPEN FLYOUT REACHES THE AXES (flyout y ' + Math.round(flyR.top) +
        '..' + Math.round(flyR.bottom) + ', axes y ' + Math.round(symR.top) +
        '..' + Math.round(symR.bottom) + ')');
    k.setMatTrayOpen(false);

    /* ---- 12. The recorded debt (a2.64) ---- */
    var o12 = A.objects[0];
    A.selectedObjectIds = new Set([o12.id]);
    A.activeObjectId = o12.id;
    k.setMode('face');
    k.ensureHelpers(o12);

    /* THE FACE OVERLAY DOES NOT REBUILD ON A DRAG. The standing note said a
       drag select abandoned an index buffer per pointermove; the truth is
       that a drag cannot change WHICH faces are selected, so the early
       return does the work and nothing is allocated at all. That is the
       property worth holding onto - not which attribute object is used. */
    A.selectedElements = new Set([0, 1, 2]);
    k.refreshElementColors(o12);
    k.syncFaceOverlay(o12);
    var ov = o12.mesh.userData.faceOverlay;
    var firstIdx = ov && ov.geometry.index;
    k.syncFaceOverlay(o12);                    // same selection, as a frame does
    k.syncFaceOverlay(o12);
    log('12.overlay_idle', !ov ? 'NO FACE OVERLAY TO CHECK'
      : (ov.geometry.index === firstIdx
        ? 'an unchanged selection rebuilds nothing'
        : 'THE OVERLAY REBUILT ITSELF WITH NOTHING TO DO'));
    A.selectedElements = new Set([0]);
    k.refreshElementColors(o12);
    k.syncFaceOverlay(o12);
    log('12.overlay_redraw', ov && ov.geometry.index !== firstIdx
      ? 'and a real change does rebuild it'
      : 'A CHANGED SELECTION DID NOT REACH THE OVERLAY');

    /* The selection overlay belongs to ONE object. App.selectedElements is
       global, so drawing it against a passer-by paints that model's vertex
       2 because vertex 2 of something else is selected. */
    k.setMode('vertex');
    A.selectedElements = new Set([0]);
    var other12 = A.objects[1] || null;
    if (!other12) {
      k.setMode('object'); A.selectedObjectIds = new Set([o12.id]);
      k.duplicateSelection();
      other12 = A.objects[A.objects.length - 1];
      k.setMode('vertex');
    }
    A.activeObjectId = o12.id;
    A.selectedElements = new Set([0]);
    k.ensureHelpers(other12);
    k.refreshElementColors(other12);          // a passer-by, as a weld does
    var od = other12.mesh.userData;
    log('12.overlay_is_owned', (!od.selPoints && !od.selLines)
      ? 'nothing drawn on the object that is not being edited'
      : 'PHANTOM SELECTION ON ' + other12.name +
        (od.selPoints ? ' (dots)' : '') + (od.selLines ? ' (edges)' : ''));
    k.refreshElementColors(o12);
    log('12.overlay_still_drawn', o12.mesh.userData.selPoints
      ? 'and the active object still has its own'
      : 'THE ACTIVE OBJECT LOST ITS OVERLAY TOO');

    /* Forking a material keeps what made it worth forking. */
    k.setMode('object'); k.refreshUI();
    var srcDef = k.getMaterialDef('standard');
    if (!srcDef) { log('12.fork_masks', 'NO STANDARD MATERIAL TO FORK'); }
    else {
      var heldMasks = srcDef.masks;
      srcDef.masks = [{ kind: 'noise', amount: 0.5, scale: 3 }];
      var idsBefore = Array.from(k.MATERIALS.keys());
      k.setMatTrayOpen(true);
      var addCard = document.querySelector('.mat-card.add');
      if (!addCard) { log('12.fork_masks', 'NO + CARD IN THE TRAY'); }
      else {
        addCard.click();
        var newId = Array.from(k.MATERIALS.keys()).filter(function (id) {
          return idsBefore.indexOf(id) < 0;
        })[0];
        var nd = newId && k.MATERIALS.get(newId);
        log('12.fork_masks', !nd ? 'THE + CARD MADE NOTHING'
          : ((nd.masks && nd.masks.length === 1)
            ? 'the fork carries its source’s mask'
            : 'THE FORK LOST THE MASKS (' + JSON.stringify(nd.masks) + ')'));
        if (nd && nd.masks && nd.masks.length) {
          nd.masks[0].amount = 0.9;
          log('12.fork_independent', srcDef.masks[0].amount === 0.5
            ? 'and owns them - editing the fork leaves the original alone'
            : 'THE FORK SHARES ITS MASK OBJECTS WITH THE ORIGINAL');
        }
        if (newId) k.MATERIALS.delete(newId);     // leave the library as found
      }
      k.setMatTrayOpen(false);
      srcDef.masks = heldMasks;
      k.saveMaterialLibrary();
    }

    /* The view cube's corners fall through to the model. */
    var cubeEl = document.getElementById('viewCube');
    var cr12 = cubeEl.getBoundingClientRect();
    var clip = getComputedStyle(cubeEl).clipPath;
    var atCorner = document.elementFromPoint(cr12.left + 3, cr12.top + 3);
    var atCentre = document.elementFromPoint(cr12.left + cr12.width / 2, cr12.top + cr12.height / 2);
    log('12.cube_corner', 'clip-path ' + clip + ' · corner hits <' +
      (atCorner ? (atCorner.id || atCorner.tagName) : 'nothing') + '> · centre hits <' +
      (atCentre ? (atCentre.id || atCentre.tagName) : 'nothing') + '>');
    // closest, because the centre lands on the cube's CANVAS, not the box.
    function inCube(el) { return !!(el && el.closest && el.closest('#viewCube')); }
    log('12.cube_corner_falls_through',
      (!inCube(atCorner) && inCube(atCentre))
        ? 'the corners are the model, the middle is the cube'
        : 'THE BOX STILL SWALLOWS ITS CORNERS');

    /* ...but a near miss must not CLEAR the selection. Falling through to
       empty space is right for a drag - it orbits - and wrong for a tap
       aimed at a control a few pixels away. */
    A.selectedObjectIds = new Set([A.objects[0].id]);
    A.activeObjectId = A.objects[0].id;
    k.setMode('object');
    k.refreshUI();
    k.onEmptySpaceTap({ clientX: cr12.left + 3, clientY: cr12.top + 3 });
    var keptSel = A.selectedObjectIds.size;
    k.onEmptySpaceTap({ clientX: cr12.left - 60, clientY: cr12.bottom + 60 });
    log('12.near_miss_keeps_selection', (keptSel === 1 && A.selectedObjectIds.size === 0)
      ? 'a miss at the cube keeps the selection; real empty space still clears it'
      : 'WRONG: kept ' + keptSel + ' at the cube, ' + A.selectedObjectIds.size + ' in open space');

    k.setMode('object'); k.refreshUI();

    /* ---- 13. The one thing the app says unasked (a2.66) ----
       Sections 3 and 8 have already bloomed rings by now, and a ring
       dismisses the chip - which is the behaviour, not a problem. So put it
       back and measure it where it lives. */
    k.forgetLearned();
    k.maybeShowFirstHint();
    var fh = document.getElementById('firstHint');
    // SHOWN means painted, not "the attribute we just cleared".
    function fhShown() { return getComputedStyle(fh).display !== 'none'; }
    var fr = fh.getBoundingClientRect();
    var qr = document.getElementById('quickRow').getBoundingClientRect();
    var hb = document.getElementById('hubBtn').getBoundingClientRect();
    var hp = document.getElementById('btnHelp').getBoundingClientRect();
    function hits13(a, b) {
      return a.left < b.right - 0.5 && a.right > b.left + 0.5 &&
             a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;
    }
    log('13.shows', fhShown() ? 'the chip is up on a browser that has not been told'
                              : 'THE CHIP DID NOT SHOW');
    /* The attribute has to actually hide it. It did not until a2.66's review:
       [hidden] has no rule in this file and author display:flex beat the UA
       sheet, so the chip painted for every user for ever. */
    fh.hidden = true;
    log('13.hidden_hides_it', !fhShown() ? 'the hidden attribute is honoured'
                                         : 'THE HIDDEN ATTRIBUTE DOES NOTHING');
    fh.hidden = false;
    log('13.above_the_row', fr.bottom <= qr.top + 0.5
      ? 'clear of the undo row' : 'OVERLAPS THE UNDO ROW');
    log('13.clear_of_the_corners', !hits13(fr, hb) && !hits13(fr, hp) && !hits13(fr, qr)
      ? 'clear of the hub, undo and help'
      : 'THE CHIP COVERS A BUTTON');
    log('13.on_screen', fr.left >= 0 && fr.right <= window.innerWidth + 0.5
      ? 'fully on screen' : 'RUNS OFF THE EDGE (' + Math.round(fr.left) + '..' + Math.round(fr.right) + ')');
    log('13.says', (fh.textContent || '').replace(/\s+/g, ' ').trim());
    /* SHAPE, not just position. `left:50%` shrink-to-fit measures against
       half the viewport, so without width:max-content this chip built itself
       at ~187px and wrapped to three lines - on screen, clear of everything,
       and wrong. Two lines is the most a one-sentence chip may be. */
    var lh = parseFloat(getComputedStyle(fh).lineHeight) || 17;
    var lines = Math.round((fr.height - 18) / lh);
    log('13.shape', Math.round(fr.width) + 'x' + Math.round(fr.height) +
      ' - ' + lines + ' line' + (lines === 1 ? '' : 's'));
    log('13.not_a_block', lines <= 2
      ? 'one sentence, at most two lines'
      : 'THE CHIP WRAPPED INTO A BLOCK (' + lines + ' lines at ' +
        Math.round(fr.width) + 'px wide)');

    /* Only the x is hit-testable - the body is pointer-events:none so a hold
       reaches the canvas instead of dying on the words that describe it. */
    log('13.body_lets_the_hold_through', getComputedStyle(fh).pointerEvents === 'none'
      ? 'the chip does not eat press-and-hold' : 'THE CHIP SWALLOWS ITS OWN GESTURE');
    var fx = fh.querySelector('.fh-x');
    log('13.x_is_tappable', fx && getComputedStyle(fx).pointerEvents === 'auto'
      ? 'the x can still be tapped' : 'THE X CANNOT BE TAPPED');

    /* Dismissing it is learning it, and learning it is permanent. */
    fx.click();
    log('13.dismiss_records_it', k.hasLearned('hold')
      ? 'a tap on the chip is remembered' : 'THE TAP WAS NOT REMEMBERED');
    k.maybeShowFirstHint();
    log('13.never_returns', !fhShown() || fh.classList.contains('going')
      ? 'and it does not come back' : 'IT CAME BACK');

    /* And the other silent thing: taps ADD, permanently, and until a2.66
       nothing ever said so. Said once, at the tap that first makes it true. */
    k.forgetLearned();
    var toastEl = document.getElementById('toast');
    var o1 = A.objects[0], o2 = A.objects[1] || A.objects[0];
    A.selectedObjectIds = new Set();
    k.selectObjectClick(o1.id, true);
    var afterFirst = (toastEl && toastEl.textContent) || '';
    k.selectObjectClick(o2.id, true);
    var afterSecond = (toastEl && toastEl.textContent) || '';
    log('13.silent_on_the_first', afterFirst.indexOf('Taps add') < 0
      ? 'one selected, nothing said' : 'IT SPOKE ON THE FIRST TAP');
    log('13.speaks_on_the_second', A.selectedObjectIds.size < 2
      ? 'only one object in the scene - could not reach two'
      : (afterSecond.indexOf('Taps add') >= 0 ? 'said once, at one -> two'
                                              : 'IT NEVER SAID IT'));
    if (toastEl) toastEl.textContent = '';
    A.selectedObjectIds = new Set();
    k.selectObjectClick(o1.id, true);
    k.selectObjectClick(o2.id, true);
    log('13.and_only_once', ((toastEl && toastEl.textContent) || '').indexOf('Taps add') < 0
      ? 'and never again' : 'IT SAID IT TWICE');
    /* The toast has to be in front of the drawer: the object list raises one
       through the same call, and a sentence said once in the life of the
       browser cannot be spent behind an opaque panel. */
    log('13.toast_clears_the_drawer',
      (+getComputedStyle(toastEl).zIndex || 0) > (+getComputedStyle(document.getElementById('drawer')).zIndex || 0)
        ? 'the toast paints over the drawer' : 'THE DRAWER COVERS THE TOAST');
    k.forgetLearned();

    log('console.errors', errs.length ? errs.join(' | ').slice(0, 400) : 'none');
  }

  window.addEventListener('error', function (e) { errs.push('onerror: ' + (e.message || e) + ' @' + (e.lineno || '')); });
  function ready(cb, t) {
    t = t || 0;
    if (window.__kubik && window.__kubik.App) return cb();
    if (t > 250) {
      /* SAY WHY. "no __kubik" on its own reads as a hang and sent a2.86
         chasing the app when the app was fine. The page's own errors are
         already being collected - print them. */
      out.push('ERROR=no __kubik after ' + (t * 20) + 'ms');
      out.push('page.errors=' + (errs.length ? errs.join(' | ').slice(0, 600) : 'none'));
      out.push('page.readyState=' + document.readyState +
        ' scripts=' + document.querySelectorAll('script').length +
        ' hasTHREE=' + (typeof window.THREE));
      return finish();
    }
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
