/* Ring geometry probe (a2.104; a2.108 the ring shrinks rather than deforms;
   v2.0 the ring is an ENVELOPE and neither shrinks nor deforms - it is cut).

   The invariants CHANGED at v2.0, and deliberately. Up to a2.108 the ring was
   a circle, so "one radius for every seat, at every press point" was the
   whole test. v2.0 draws a diamond cut by whatever screen edges are close -
   a flat side against one wall, a triangle in a corner - and spaces the seats
   evenly along that outline. Near a wall the seats therefore sit at DIFFERENT
   radii and on DIFFERENT bearings on purpose, so the old assertions would now
   fail on correct behaviour. What has to hold instead:

     1. nothing spills past the 14px frame margin - unchanged, and the reason
        the whole clamp exists;
     2. neighbouring seats still clear each other - now the load-bearing one,
        because redistributing along a cut outline is exactly what stops the
        three seats behind a wall from piling up (v20d did pile them up);
     3. the ORDER round the ring never changes - a bearing may give way, but
        the sequence you learn must not;
     4. the seat straight ahead of the finger is straight ahead at every
        press point - the one bearing that never gives way;
     5. where nothing is in the way, the ring is still exactly the regular
        circle it always was, at the SAME radius wherever it blooms;
     6. the centre lands on the finger except within one clamp of the frame.

   Run against the sparse world ring AND a dense 14-seat ring, because the
   crowding only bites at a tight angular gap.
*/
(function () {
  var out = [], errs = [];
  window.addEventListener('error', function (e) { errs.push(e.message); });

  // Two seats touch at exactly 2*TIP of L1 clearance. No slack: the layout
  // either keeps them apart or it does not.
  var EDGE = 14, CLEAR_MIN = 2 * 52 * Math.SQRT1_2;
  /* Where nothing is in the way the ring is still a circle. 1px covers
     sub-pixel layout rounding of the seat boxes. */
  var ROUND_TOL = 1.0;
  var NORTH_TOL = 0.75;
  // RING_EDGE_PX + TOOL_RING_TIP + 60, the centre clamp. Kept as a literal so
  // the probe fails loudly if the app quietly widens it.
  // Diagonal, because a corner press is clamped on BOTH axes at once.
  var CLAMP = (14 + 52 * Math.SQRT1_2 + 60 + 1) * Math.SQRT2;

  function ringEl() { return document.getElementById('touchToolRing'); }
  function hostRect() { return ringEl().parentElement.getBoundingClientRect(); }

  function readSeats() {
    var host = hostRect(), el = ringEl();
    var ox = host.left + parseFloat(el.style.left || '0');
    var oy = host.top + parseFloat(el.style.top || '0');
    var list = [];
    Array.prototype.forEach.call(el.querySelectorAll('.hub-item'), function (it) {
      var r = it.getBoundingClientRect();
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      list.push({
        key: it.dataset.key,
        deg: Math.atan2(-(cy - oy), cx - ox) * 180 / Math.PI,
        r: Math.hypot(cx - ox, cy - oy),
        x: cx, y: cy, l: r.left, t: r.top, rt: r.right, b: r.bottom
      });
    });
    return { list: list, ox: ox, oy: oy, host: host };
  }

  /* CLEARANCE, NOT DISTANCE. A seat is a 52px square turned 45 degrees, so
     it is an L1 ball of radius TIP - and two of them overlap exactly when
     |dx| + |dy| < 2*TIP. Centre-to-centre EUCLIDEAN distance, which this
     probe used up to a2.108, is the wrong measure and flatters a diagonal
     pair while condemning a stacked one: two seats 60px apart vertically
     overlap, two 60px apart diagonally do not.

     It matters now because the envelope has CORNERS. Two seats straddling a
     right-angle corner of the cut sit at a euclidean distance well under
     their arc spacing - but their L1 separation is exactly that arc spacing,
     because the corner is square and so are they. Even spacing along the
     curve is therefore even clearance, corners included, and this is the
     number that says so. */
  function minClear(list) {
    var m = 1e9;
    for (var i = 0; i < list.length; i++)
      for (var j = i + 1; j < list.length; j++)
        m = Math.min(m, Math.abs(list[i].x - list[j].x) +
                        Math.abs(list[i].y - list[j].y));
    return m;
  }

  /* The sequence round the ring, clockwise from straight up. This is what a
     hand learns, and it is what may not change. Compared as a CYCLE, rotated
     to start at the north seat: which seat the sort happens to call "first"
     flips on a hundredth of a degree, and that is not a change in order. */
  function order(list, northKey) {
    var k = list.slice().sort(function (a, b) {
      var ka = (((90 - a.deg) % 360) + 360) % 360;
      var kb = (((90 - b.deg) % 360) + 360) % 360;
      return ka - kb;
    }).map(function (t) { return t.key; });
    var at = k.indexOf(northKey);
    if (at > 0) k = k.slice(at).concat(k.slice(0, at));
    return k.join('>');
  }

  function byKey(s) { var o = {}; s.list.forEach(function (t) { o[t.key] = t; }); return o; }

  function runSet(label, tools, clearMatters) {
    var K = window.__kubik;
    var bloom = function (x, y) { K.bloomToolRing(x, y, tools, undefined, { x: x, y: y }); };
    var h = hostRect();
    var mx = h.left + h.width / 2, my = h.top + h.height / 2;

    bloom(mx, my);
    var refS = readSeats();
    var ref = byKey(refS);
    var refR = refS.list.map(function (a) { return a.r; });
    var openR = (Math.min.apply(null, refR) + Math.max.apply(null, refR)) / 2;
    // The seat that starts due north, followed by name through every press.
    var northKey = null, bestN = 1e9;
    refS.list.forEach(function (a) {
      var d = Math.abs(a.deg - 90); if (d < bestN) { bestN = d; northKey = a.key; }
    });
    var refOrder = order(refS.list, northKey);
    var refPitch = minClear(refS.list);

    var pad = 8;
    var pts = [['centre', mx, my],
               ['left', h.left + pad, my], ['right', h.right - pad, my],
               ['top', mx, h.top + pad], ['bottom', mx, h.bottom - pad],
               ['TL', h.left + pad, h.top + pad], ['TR', h.right - pad, h.top + pad],
               ['BL', h.left + pad, h.bottom - pad], ['BR', h.right - pad, h.bottom - pad]];

    var drift = 0, spill = 0, pitch = 1e9, band = 0;
    var northErr = 0, orderBad = [];
    var openSpread = 0, openRmin = 1e9, openRmax = 0, openN = 0;
    pts.forEach(function (p) {
      bloom(p[1], p[2]);
      var s = readSeats();
      var d = Math.hypot(s.ox - p[1], s.oy - p[2]);
      drift = Math.max(drift, d);
      pitch = Math.min(pitch, minClear(s.list));
      if (order(s.list, northKey) !== refOrder) orderBad.push(p[0]);
      var n = byKey(s)[northKey];
      if (n) {
        var nd = Math.abs(n.deg - 90) % 360; if (nd > 180) nd = 360 - nd;
        northErr = Math.max(northErr, nd);
      }
      /* UNOBSTRUCTED presses only. The centre landing exactly on the finger
         means no wall pushed it, which means no wall cut the outline either -
         and there the ring must still be the same regular circle it has
         always been, at the same radius every time. */
      if (d < 0.5) {
        var rr = s.list.map(function (a) { return a.r; });
        var lo = Math.min.apply(null, rr), hi = Math.max.apply(null, rr);
        openSpread = Math.max(openSpread, hi - lo);
        openRmin = Math.min(openRmin, lo); openRmax = Math.max(openRmax, hi);
        openN++;
      }
      s.list.forEach(function (a) {
        var o = Math.max((s.host.left + EDGE) - a.l, a.rt - (s.host.right - EDGE),
                         (s.host.top + EDGE) - a.t, a.b - (s.host.bottom - EDGE));
        if (o > 0.5) spill = Math.max(spill, o);
      });
    });

    // The legal band for the centre, measured rather than derived: how wide
    // a strip of the screen lets the ring bloom exactly under the finger.
    for (var x = h.left; x <= h.right; x += 2) {
      bloom(x, my);
      if (Math.abs(readSeats().ox - x) < 0.5) band += 2;
    }

    out.push('[' + label + '] seats=' + Object.keys(ref).length +
             ' openR=' + openR.toFixed(1) + ' openClear=' + refPitch.toFixed(1) +
             ' north=' + northKey);
    out.push('  maxDrift=' + drift.toFixed(1) + ' (clamp ' + CLAMP.toFixed(1) + ')' +
             ' maxSpill=' + spill.toFixed(1) +
             ' minClear=' + pitch.toFixed(1) + '/' + CLEAR_MIN.toFixed(1) +
             (clearMatters ? '' : ' (not asserted)') +
             ' centreBand=' + band + 'px of ' + Math.round(h.width));
    out.push('  order=' + (orderBad.length ? 'CHANGED at ' + orderBad.join(',') : 'held') +
             ' northErr=' + northErr.toFixed(2) + 'deg');
    out.push('  unobstructed: n=' + openN + ' spread=' + openSpread.toFixed(2) +
             ' R=' + openRmin.toFixed(1) + '..' + openRmax.toFixed(1));
    var ok = spill <= 0.5 && (!clearMatters || pitch >= CLEAR_MIN) &&
             drift <= CLAMP && orderBad.length === 0 && northErr <= NORTH_TOL &&
             openN >= 1 && openSpread <= ROUND_TOL &&
             (openRmax - openRmin) <= ROUND_TOL;
    out.push('  ' + (ok ? 'PASS' : 'FAIL'));
    return ok;
  }

  function main() {
    var K = window.__kubik, h = hostRect();
    out.push('host=' + Math.round(h.width) + 'x' + Math.round(h.height));

    var ok1 = runSet('world 8', K.HUB_TOOLS_WORLD, true);

    /* A dense ring, well past anything the app draws. Every mode ring is
       exactly 8 seats since a2.113, and the three ringS that are not (Add
       geo, Pivot, the empty-scene ring) carry 4 to 6 and bloom at the
       viewport CENTRE, where nothing is cut. So 14 is a CEILING PROBE, not a
       requirement: clearance is reported and not asserted, because a corner
       press leaves a curve about 590px long and fourteen 52px seats do not
       fit on it. What is asserted here is everything that must hold at any
       count - order, north, no spill, and a regular ring in open space. */
    var base = K.HUB_TOOLS_WORLD, dense = [];
    for (var i = 0; i < 14; i++) {
      var t = base[i % base.length];
      dense.push({ key: 'dense' + i, label: 'SEAT ' + i, icon: t.icon, seat: i });
    }
    var ok2 = runSet('dense 14', dense);

    out.push('---');
    out.push('VERDICT=' + ((ok1 && ok2) ? 'PASS' : 'FAIL'));
    out.push('page.errors=' + (errs.length ? errs.join(' | ').slice(0, 400) : 'none'));
  }

  function ready(cb, t) {
    t = t || 0;
    if (window.__kubik && document.getElementById('touchToolRing')) return cb();
    if (t > 300) {
      out.push('ERROR=no __kubik after ' + (t * 20) + 'ms');
      out.push('page.errors=' + (errs.length ? errs.join(' | ').slice(0, 600) : 'none'));
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
