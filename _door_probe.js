/* a2.110: eight fixed bearings, and doors.
   Six questions a screenshot cannot answer:
     1. does every seat land on its LITERAL bearing, 45 degrees apart?
     2. do the other bearings hold still when a conditional seat comes and
        goes? (that is the whole promise of fixing them)
     3. does pulling past the arm open a door, and does coming back inside
        the dead zone close it again?
     4. does lifting ON a door run its first op, not the door?
     5. is the star CUT at an empty bearing rather than drawn straight
        through it?
     6. is every op that shipped before still reachable - top level or one
        layer down? Nothing may be lost in the reshuffle.
*/
(function () {
  var out = [], errs = [], fails = 0;
  window.addEventListener('error', function (e) { errs.push(e.message); });

  function log(k, v) { out.push(k + '=' + v); }
  function verdict(ok, good, bad) { if (!ok) fails++; return '  - ' + (ok ? good : bad); }

  function ringEl() { return document.getElementById('touchToolRing'); }
  function seatEls() {
    return Array.prototype.slice.call(ringEl().querySelectorAll('.hub-item'));
  }
  function origin() {
    var host = ringEl().parentElement.getBoundingClientRect(), el = ringEl();
    return { x: host.left + parseFloat(el.style.left || '0'),
             y: host.top + parseFloat(el.style.top || '0') };
  }
  // Bearing of each seat, in degrees, 0 = right and rising anticlockwise.
  function bearings() {
    var o = origin(), m = {};
    seatEls().forEach(function (el) {
      var r = el.getBoundingClientRect();
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      m[el.dataset.key] = Math.atan2(-(cy - o.y), cx - o.x) * 180 / Math.PI;
    });
    return m;
  }
  function keys() { return seatEls().map(function (e) { return e.dataset.key; }); }
  /* The drawn radius, measured off a seat. Every distance below is a fraction
     of it: the ring is 89..160 depending on the screen and where you pressed,
     and the arm is 0.6 of whatever it came out as, so fixed pixels would test
     a different point in the stroke on every viewport. */
  function ringRadius() {
    var o = origin(), el = seatEls()[0];
    if (!el) return 0;
    var r = el.getBoundingClientRect();
    return Math.hypot(r.left + r.width / 2 - o.x, r.top + r.height / 2 - o.y);
  }

  function main() {
    var k = window.__kubik, A = k.App;
    var host = ringEl().parentElement.getBoundingClientRect();
    var mx = host.left + host.width / 2, my = host.top + host.height / 2;
    var bloom = function (tools) { k.bloomToolRing(mx, my, tools, undefined, { x: mx, y: my }); };
    var move = function (dx, dy) {
      k.updateToolRingHover({ clientX: mx + dx, clientY: my + dy });
    };

    /* ---- 1. literal bearings ---- */
    var RINGS = { vertex: k.HUB_TOOLS_VERTEX, edge: k.HUB_TOOLS_EDGE,
                  face: k.HUB_TOOLS_FACE, world: k.HUB_TOOLS_WORLD };
    var worstErr = 0, worstWho = '';
    Object.keys(RINGS).forEach(function (name) {
      bloom(RINGS[name]);
      var b = bearings();
      RINGS[name].forEach(function (t) {
        var want = 90 - t.seat * 45;
        var got = b[t.key];
        var d = Math.abs(((got - want) % 360 + 540) % 360 - 180);
        if (d > worstErr) { worstErr = d; worstWho = name + '.' + t.key; }
      });
    });
    log('1.literal_bearings', 'worst deviation ' + worstErr.toFixed(2) + 'deg (' + worstWho + ')' +
      verdict(worstErr < 0.5,
        'every seat sits on 90 - seat*45, exactly',
        'A SEAT IS NOT ON ITS OWN BEARING'));

    /* ---- 2. a conditional seat does not move the others ----
       Object mode's grouping seat comes and goes with the selection. Under
       the old even spread that re-rotated the entire ring; the whole point
       of fixing the bearings is that it no longer can. */
    k.setMode('object');
    if (A.objects.length < 2) {
      A.selectedObjectIds = new Set([A.objects[0].id]);
      k.duplicateSelection();
    }
    var objs = A.objects.slice(0, 2);
    A.selectedObjectIds = new Set([objs[0].id]); k.refreshUI();
    bloom(k.currentHubTools());
    var solo = bearings(), soloKeys = keys();
    A.selectedObjectIds = new Set(objs.map(function (o) { return o.id; })); k.refreshUI();
    bloom(k.currentHubTools());
    var pair = bearings(), pairKeys = keys();
    var moved = 0, movedWho = '';
    Object.keys(solo).forEach(function (key) {
      if (pair[key] === undefined) return;
      var d = Math.abs(solo[key] - pair[key]);
      if (d > moved) { moved = d; movedWho = key; }
    });
    log('2.bearings_hold_still',
      soloKeys.length + ' seats -> ' + pairKeys.length +
      ' (grouping ' + (pairKeys.indexOf('grouping') >= 0 ? 'present in both' : 'ABSENT') +
      '), worst shift ' + moved.toFixed(2) + 'deg' + (movedWho ? ' (' + movedWho + ')' : '') +
      verdict(moved < 0.5 && soloKeys.length === 8 && pairKeys.length === 8 &&
              pairKeys.indexOf('grouping') >= 0 && soloKeys.indexOf('grouping') >= 0,
        /* Since a2.112 the seat is always there and only changes STATE, so
           this is stronger than it was: the count cannot change either. */
        'eight bearings before and after, and not one of them moved',
        'A SEAT LEFT ITS BEARING, OR THE RING ROTATED'));

    /* ---- 3. the arm opens a door, the dead zone closes it ---- */
    k.setMode('edge');
    bloom(k.HUB_TOOLS_EDGE);
    var top = keys();
    var R3 = ringRadius();
    var doorTool = k.HUB_TOOLS_EDGE.filter(function (t) { return t.door; })[0];
    var ang = (90 - doorTool.seat * 45) * Math.PI / 180;
    // Just short of the arm (0.6R): still the parent ring, door seat aimed.
    move(Math.cos(ang) * R3 * 0.4, -Math.sin(ang) * R3 * 0.4);
    var atAim = keys();
    // Past it.
    move(Math.cos(ang) * R3 * 0.85, -Math.sin(ang) * R3 * 0.85);
    var opened = keys();
    // And back to the middle.
    move(Math.cos(ang) * 10, -Math.sin(ang) * 10);
    var closed = keys();
    log('3.door_opens_on_the_arm',
      'R=' + R3.toFixed(0) + '; top=' + top.length + ' seats; at 0.4R=' + atAim.length +
      '; past the arm=[' + opened.join(', ') + ']; back inside=' + closed.length +
      verdict(atAim.length === top.length &&
              opened.length === doorTool.door.length &&
              opened[0] === doorTool.door[0].key &&
              closed.join(',') === top.join(','),
        'aiming holds, the arm swaps the seats, the dead zone puts them back',
        'THE DOOR DID NOT OPEN AND CLOSE ON THE ARM'));

    /* ---- 4. the door delivers what its second word promised ----
       Two ways to reach it, and BOTH must run the same op:
         a) lift short of the arm, on the door seat itself
         b) keep pulling to the seat's own radius, where the door has already
            opened and its first op must be sitting straight ahead
       (b) is the one that failed before a2.110b: the arm (70) is inside the
       ring radius (~107), so a finger travelling to the seat always crossed
       it, and whatever the sub-ring put on that bearing ran instead. */
    var ran = null;
    var first = doorTool.door[0];
    var realRun = first.run;
    first.run = function () { ran = first.key; };

    bloom(k.HUB_TOOLS_EDGE);
    move(Math.cos(ang) * R3 * 0.4, -Math.sin(ang) * R3 * 0.4);   // arm not crossed
    k.closeToolRing(true);
    var shortLift = ran;

    ran = null;
    bloom(k.HUB_TOOLS_EDGE);
    var atSeat = ringRadius();
    move(Math.cos(ang) * atSeat, -Math.sin(ang) * atSeat);
    var openKeys = keys();
    k.closeToolRing(true);
    var fullLift = ran;
    first.run = realRun;

    log('4.lift_on_a_door', 'short of the arm ran "' + shortLift +
      '"; all the way to the seat (' + atSeat.toFixed(0) + 'px, door open) ran "' +
      fullLift + '"; expected "' + first.key + '" both times' +
      verdict(shortLift === first.key && fullLift === first.key,
        'the door runs the op its second word names, at any distance',
        'THE DOOR RAN SOMETHING ITS SEAT NEVER SHOWED'));

    /* ---- 4b. and the sub-ring is turned onto the door's bearing ---- */
    bloom(k.HUB_TOOLS_EDGE);
    move(Math.cos(ang) * R3 * 0.85, -Math.sin(ang) * R3 * 0.85);
    var b4 = bearings();
    var want4 = 90 - doorTool.seat * 45;
    var d4 = Math.abs(((b4[first.key] - want4) % 360 + 540) % 360 - 180);
    log('4b.sub_ring_is_turned', first.key + ' sits at ' + b4[first.key].toFixed(1) +
      'deg, the ' + doorTool.key + ' door at ' + want4 + 'deg' +
      verdict(d4 < 0.5,
        'the first op is straight ahead of the finger, not back at the top',
        'THE SUB-RING WAS NOT TURNED ONTO THE DOOR BEARING'));

    /* ---- 5. the figure is one cut outline, and the seats belong to it
       v2.0: ONE closed polyline - the diamond, cut by whichever screen edges
       are close. Three things have to hold. In open space the diamond's
       edges pass through the four DIAGONAL seats exactly, which is what
       ringR*SQRT2 buys and the reason the figure is drawn at all (the four
       cardinal seats sit inside it by design - that is the cost of one
       square rather than two). Near a corner the outline must actually be
       CUT, i.e. gain vertices, rather than be left whole and cropped by the
       frame - a cropped ring reads as one that fell off the edge. And it is
       never filled: a polyline fills by default, and the day that rule went
       missing a black wedge covered the model. */
    function outlinePts() {
      var st = document.getElementById('ringStar');
      var pl2 = st ? st.querySelector('polyline') : null;
      if (!pl2) return null;
      var sr2 = st.getBoundingClientRect();
      return pl2.getAttribute('points').trim().split(/\s+/).map(function (p) {
        var xy = p.split(',');
        return { x: sr2.left + parseFloat(xy[0]), y: sr2.top + parseFloat(xy[1]) };
      });
    }
    function distToOutline(px, py, pts) {
      var best = 1e9;
      for (var i = 0; i + 1 < pts.length; i++) {
        var a = pts[i], b = pts[i + 1];
        var vx = b.x - a.x, vy = b.y - a.y, L = vx * vx + vy * vy;
        var t = L ? Math.max(0, Math.min(1, ((px - a.x) * vx + (py - a.y) * vy) / L)) : 0;
        best = Math.min(best, Math.hypot(px - (a.x + vx * t), py - (a.y + vy * t)));
      }
      return best;
    }

    k.setMode('edge');
    bloom(k.HUB_TOOLS_EDGE);            // centre of the viewport: nothing cuts
    var star8 = document.getElementById('ringStar');
    var full = star8 ? star8.querySelectorAll('polyline').length : -1;
    var poly8 = star8 ? star8.querySelectorAll('polygon').length : -1;
    var pl = star8 ? star8.querySelector('polyline') : null;
    var plFill = pl ? getComputedStyle(pl).fill : 'no polyline';
    var openPts = outlinePts();
    // A closed diamond is five points - four corners and the repeat.
    var openN = openPts ? openPts.length : -1;
    /* Only the DIAGONALS. A seat's bearing is where it sits, and the four on
       the 45s are the ones the edges are built to pass through. */
    var o5 = origin(), worstOff = 0, diagSeen = 0;
    seatEls().forEach(function (el) {
      var r = el.getBoundingClientRect();
      var cx5 = r.left + r.width / 2, cy5 = r.top + r.height / 2;
      var deg = Math.atan2(-(cy5 - o5.y), cx5 - o5.x) * 180 / Math.PI;
      var off45 = Math.abs(((deg - 45) % 90 + 135) % 90 - 45);
      if (off45 > 1) return;            // a cardinal seat; not this test
      diagSeen++;
      worstOff = Math.max(worstOff, distToOutline(cx5, cy5, openPts));
    });

    /* CUT, not cropped. A corner press has two walls in range, so the
       diamond loses two corners and gains two vertices - and every point of
       what is left stays inside the frame. */
    var hostR = document.getElementById('touchToolRing')
                        .parentElement.getBoundingClientRect();
    k.bloomToolRing(hostR.left + 6, hostR.top + 6, k.HUB_TOOLS_EDGE, undefined,
                    { x: hostR.left + 6, y: hostR.top + 6 });
    var cutPts = outlinePts();
    var cutN = cutPts ? cutPts.length : -1;
    var outside = 0;
    (cutPts || []).forEach(function (p) {
      if (p.x < hostR.left - 0.5 || p.x > hostR.right + 0.5 ||
          p.y < hostR.top - 0.5 || p.y > hostR.bottom + 0.5) outside++;
    });

    log('5.the_outline_is_cut',
      'open: ' + full + ' polyline of ' + openN + ' points, ' + diagSeen +
      ' diagonal seats worst ' + worstOff.toFixed(2) + 'px off it; corner: ' +
      cutN + ' points, ' + outside + ' past the frame; ' + poly8 +
      ' filled shapes; fill ' + plFill +
      verdict(full === 1 && poly8 === 0 && plFill === 'none' &&
              openN === 5 && diagSeen === 4 && worstOff < 1.0 &&
              cutN > 5 && outside === 0,
        'a diamond through its diagonal seats, cut square at a corner, unfilled',
        'THE OUTLINE IS NOT CUT, NOT THROUGH ITS SEATS, OR IS FILLED'));

    /* ---- 6. nothing was lost in the reshuffle ----
       Every op key that had a seat before a2.110, and where it lives now. */
    var WAS = {
      vertex: ['connect', 'weld', 'merge', 'setflow', 'circularize', 'slide', 'delete'],
      edge: ['extrude', 'bevel', 'collapse', 'loopcut', 'knife', 'split', 'bridge',
             'cap', 'delete', 'setflow', 'circularize', 'slide', 'sharp', 'crease'],
      face: ['extrude', 'inset', 'detach', 'knife', 'bridge', 'cap', 'delete',
             'setflow', 'circularize', 'shade', 'flipnorm'],
      object: ['duplicate', 'array', 'mirror', 'separate', 'centre', 'cap', 'delete',
               'shade', 'flipnorm', 'solidify', 'cleanup', 'subdivide', 'autosmooth',
               'join', 'grouping'],
      world: ['addgeo', 'pivot', 'xray', 'grid', 'snap', 'proj', 'selmode']
    };
    var NOW = {
      vertex: k.HUB_TOOLS_VERTEX, edge: k.HUB_TOOLS_EDGE, face: k.HUB_TOOLS_FACE,
      object: (function () {
        k.setMode('object');
        A.selectedObjectIds = new Set(A.objects.slice(0, 2).map(function (o) { return o.id; }));
        k.refreshUI();
        return k.currentHubTools();
      })(),
      world: k.HUB_TOOLS_WORLD
    };
    var lost = [];
    Object.keys(WAS).forEach(function (ring) {
      var reach = {};
      (NOW[ring] || []).forEach(function (t) {
        reach[t.key] = 'top';
        (t.door || []).forEach(function (d) { reach[d.key] = t.key; });
      });
      WAS[ring].forEach(function (key) {
        if (!reach[key]) lost.push(ring + '.' + key);
      });
    });
    log('6.nothing_lost', (lost.length ? 'MISSING: ' + lost.join(', ') : 'every op still reachable') +
      verdict(lost.length === 0,
        'every placement survives, top level or one layer down',
        'AN OP LOST ITS SEAT'));

    /* ---- how each ring now reads ---- */
    Object.keys(NOW).forEach(function (ring) {
      out.push('  [' + ring + '] ' + (NOW[ring] || []).map(function (t) {
        return t.seat + ':' + t.key + (t.door ? '{' + t.door.map(function (d) {
          return d.key; }).join(' ') + '}' : '');
      }).join(' '));
    });

    /* ---- 7. no bearing ever empties (a2.112) ----
       Object mode with ONE ungrouped object is the commonest state the app
       has, and it is the one that used to show a hole at bearing 5. The seat
       is there now, hatched, and it un-hatches the moment a second object
       makes Group mean something. */
    k.setMode('object');
    A.selectedObjectIds = new Set([A.objects[0].id]); k.refreshUI();
    bloom(k.currentHubTools());
    var soloSeats = seatEls().length;
    var g1 = seatEls().filter(function (e) { return e.dataset.key === 'grouping'; })[0];
    var hatched = !!g1 && g1.classList.contains('off');
    A.selectedObjectIds = new Set(A.objects.slice(0, 2).map(function (o) { return o.id; }));
    k.refreshUI();
    bloom(k.currentHubTools());
    var g2 = seatEls().filter(function (e) { return e.dataset.key === 'grouping'; })[0];
    var live2 = !!g2 && !g2.classList.contains('off');

    k.setMode('object');
    A.selectedObjectIds = new Set();
    bloom(k.HUB_TOOLS_WORLD);
    var worldSeats = seatEls().length;
    var iso = seatEls().filter(function (e) { return e.dataset.key === 'isolate'; })[0];
    var isoOff = !!iso && iso.classList.contains('off');

    log('7.no_bearing_empties',
      'object, one loose object: ' + soloSeats + ' seats, grouping ' +
      (hatched ? 'hatched' : (g1 ? 'LIVE' : 'MISSING')) +
      '; two selected: grouping ' + (live2 ? 'live' : 'STILL HATCHED OR MISSING') +
      '; world: ' + worldSeats + ' seats, isolate ' +
      (iso ? (isoOff ? 'hatched with nothing selected' : 'LIVE') : 'MISSING') +
      verdict(soloSeats === 8 && hatched && live2 && worldSeats === 8 && isoOff,
        'eight seats in both, and a seat that cannot run says so instead of leaving',
        'A BEARING IS STILL EMPTY, OR A DEAD SEAT DOES NOT LOOK DEAD'));

    /* ---- 8. a flick still divides the compass, wherever you pressed ----
       Sweep all 360 degrees of flick direction at each of four press points
       and see which seat lights. Two things have to hold at every one of
       them: all eight seats are reachable, and none is reduced to a sliver.
       45 degrees each is the ideal; 20 is the floor, below which a seat is
       a coin toss with its neighbour on a thumb that wobbles. */
    k.setMode('edge');
    var STEP = 2, FLOOR = 20, PROBE_R = 50;   // between the dead zone (26) and the arm (72)
    var sweeps = [], sweepBad = [];
    [['centre', mx, my],
     ['left', host.left + 6, my],
     ['top-left', host.left + 6, host.top + 6],
     ['bottom-right', host.right - 6, host.bottom - 6]].forEach(function (p) {
      k.bloomToolRing(p[1], p[2], k.HUB_TOOLS_EDGE, undefined, { x: p[1], y: p[2] });
      var seen = {};
      for (var d = 0; d < 360; d += STEP) {
        var a = d * Math.PI / 180;
        k.updateToolRingHover({ clientX: p[1] + Math.cos(a) * PROBE_R,
                                clientY: p[2] - Math.sin(a) * PROBE_R });
        var lit = ringEl().querySelector('.hub-item.active');
        var key = lit ? lit.dataset.key : '(none)';
        seen[key] = (seen[key] || 0) + STEP;
      }
      var names = Object.keys(seen);
      var worst = 360, worstKey = '';
      names.forEach(function (n) {
        if (seen[n] < worst) { worst = seen[n]; worstKey = n; }
      });
      var ok8 = names.length === 8 && !seen['(none)'] && worst >= FLOOR;
      sweeps.push(p[0] + ': ' + names.length + ' seats, narrowest ' +
                  worst + 'deg (' + worstKey + ')');
      if (!ok8) sweepBad.push(p[0]);
    });
    log('8.the_flick_divides_the_compass', sweeps.join('; ') +
      verdict(sweepBad.length === 0,
        'eight reachable seats and none under ' + FLOOR + ' degrees, at every press point',
        'SEATS COLLAPSED OR WENT UNREACHABLE AT ' + sweepBad.join(',')));

    out.push('---');
    out.push('VERDICT=' + (fails ? 'FAIL' : 'PASS'));
    out.push('page.errors=' + (errs.length ? errs.join(' | ').slice(0, 400) : 'none'));
  }

  function finish() {
    var pre = document.createElement('pre');
    pre.id = 'probeOut';
    pre.textContent = '<<<PROBE\n' + out.join('\n') + '\nPROBE>>>';
    document.body.appendChild(pre);
    document.title = 'PROBE-DONE';
  }
  function ready(cb, t) {
    t = t || 0;
    if (window.__kubik && document.getElementById('touchToolRing')) return cb();
    if (t > 300) { out.push('ERROR=no __kubik'); return finish(); }
    setTimeout(function () { ready(cb, t + 1); }, 20);
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
