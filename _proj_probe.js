/* The real orthographic camera (a2.85). The question the old emulation
   could never fail is the one asked first: are parallel lines PARALLEL on
   screen? A fov-2 camera answers "almost". Every section prints its numbers. */
(function () {
  var out = [], errs = [];
  var _ce = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); _ce.apply(console, arguments); };
  function log(kk, v) { out.push(kk + '=' + v); }
  function verdict(c, good, bad) { return c ? ' - ' + good : ' ' + bad; }
  var k, A, THREE;

  /* Screen position in pixels, straight through whichever camera is live -
     the same call chain the app's own picking and handles use. */
  function px(x, y, z) {
    var v = new THREE.Vector3(x, y, z).project(k.camera);
    var r = k.viewportEl.getBoundingClientRect();
    return { x: (v.x * 0.5 + 0.5) * r.width, y: (-v.y * 0.5 + 0.5) * r.height };
  }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  /* The screen ANGLE of a world segment, in degrees. */
  function ang(p, q) {
    var a = px(p[0], p[1], p[2]), b = px(q[0], q[1], q[2]);
    return Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
  }
  function angDiff(u, v) {
    var d = Math.abs(u - v) % 360;
    if (d > 180) d = 360 - d;
    if (d > 90) d = 180 - d;   // a segment and its reverse are the same line
    return d;
  }

  /* Two rails that ARE parallel in the world, set at different depths.
     Under parallel projection their screen angles must be identical; under
     a lens they converge. This is the property the whole version exists to
     create, so it is measured rather than assumed. */
  var RAIL_A = [[-2, 0, -3], [2, 0, -3]];
  var RAIL_B = [[-2, 0, 3], [2, 0, 3]];
  function railGap() {
    return angDiff(ang(RAIL_A[0], RAIL_A[1]), ang(RAIL_B[0], RAIL_B[1]));
  }
  /* THE PLANE THAT MUST NOT MOVE is the one through the orbit target
     PERPENDICULAR TO THE VIEW, not the world y=0 plane. An ortho frustum
     sized to the lens's height at the target reproduces the picture exactly
     there and nowhere else, so the points have to be built from the
     camera's own right and up. The first cut of this used y=0 and reported
     a 65px jump that was the fixture's fault - the points were at three
     different depths along the view axis, where the two projections are
     supposed to disagree. */
  function planePoints() {
    var c = k.camera, t = k.orbit.target;
    var right = new THREE.Vector3(1, 0, 0).applyQuaternion(c.quaternion);
    var up = new THREE.Vector3(0, 1, 0).applyQuaternion(c.quaternion);
    var fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(c.quaternion);
    return {
      on: [t.clone().addScaledVector(right, 1.5),
           t.clone().addScaledVector(up, 1.2),
           t.clone().addScaledVector(right, -1).addScaledVector(up, -0.8)],
      off: [t.clone().addScaledVector(fwd, 2.5).addScaledVector(right, 1.5),
            t.clone().addScaledVector(fwd, -2.5).addScaledVector(right, 1.5)]
    };
  }
  function shot(list) { return list.map(function (p) { return px(p.x, p.y, p.z); }); }
  /* The screen box of an object, so "framed" can be asserted as a fraction
     of the viewport rather than guessed at from a camera distance. */
  function screenSpan(o) {
    var b = new THREE.Box3().setFromObject(o.mesh), mn = b.min, mx = b.max, ps = [];
    for (var i = 0; i < 8; i++) {
      ps.push(px(i & 1 ? mx.x : mn.x, i & 2 ? mx.y : mn.y, i & 4 ? mx.z : mn.z));
    }
    var xs = ps.map(function (p) { return p.x; }), ys = ps.map(function (p) { return p.y; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var r = k.viewportEl.getBoundingClientRect();
    return { w: (x1 - x0) / r.width, h: (y1 - y0) / r.height,
             cx: (x0 + x1) / 2 / r.width, cy: (y0 + y1) / 2 / r.height };
  }
  function maxMove(a, b) {
    var m = 0;
    for (var i = 0; i < a.length; i++) m = Math.max(m, dist(a[i], b[i]));
    return m;
  }
  function cube(name, pos) {
    var o = k.createPrimitiveObject('cube', k.PRIM_SPECS.cube.def, name || 'C',
      pos || new THREE.Vector3(0, 0, 0));
    A.selectedObjectIds = new Set([o.id]);
    A.activeObjectId = o.id;
    k.setMode('object');
    k.refreshUI();
    return o;
  }
  function camDist() { return k.camera.position.distanceTo(k.orbit.target); }
  /* Drive the pill, not the worker underneath it. */
  function tapPill() { document.getElementById('projPill').click(); }

  function main(done) {
    k = window.__kubik; A = k.App; THREE = k.THREE;
    cube('P1');
    /* The band as the LENS left it. The emulation had to shift this out by
       the same ~27x it backed the camera away, and re-shift it on every
       move; a camera that does not move needs no shift, so the test is that
       these two numbers survive the round trip untouched. */
    var fog0 = k.scene.fog ? { n: k.scene.fog.near, f: k.scene.fog.far } : null;

    // ---- 1. the fixture really is a lens, and the rails really converge ----
    var gapPersp = railGap();
    log('1.fixture', 'isPerspective=' + !!k.camera.isPerspectiveCamera +
      ' orthoOn=' + k.orthoOn + ' railConvergence=' + gapPersp.toFixed(3) + ' deg' +
      verdict(!!k.camera.isPerspectiveCamera && !k.orthoOn && gapPersp > 0.5,
        'a lens, and the two rails visibly converge through it',
        'FIXTURE IS NOT A CONVERGING LENS - section 3 would pass vacuously'));

    // ---- 2. the swap does not move the picture at the target plane ----
    var pp = planePoints();
    var onBefore = shot(pp.on), offBefore = shot(pp.off);
    tapPill();
    var onAfter = shot(pp.on), offAfter = shot(pp.off);
    var movedOn = maxMove(onBefore, onAfter), movedOff = maxMove(offBefore, offAfter);
    log('2.engaged', 'isOrthographic=' + !!k.camera.isOrthographicCamera +
      ' orthoOn=' + k.orthoOn +
      verdict(!!k.camera.isOrthographicCamera && k.orthoOn,
        'the pill swapped in a real orthographic camera',
        'THE PILL DID NOT SWAP THE CAMERA'));
    log('2.invisible_swap', 'onTargetPlane moved ' + movedOn.toFixed(3) + 'px, offPlane moved ' +
      movedOff.toFixed(3) + 'px' +
      verdict(movedOn < 1 && movedOff > 1,
        'the framing held where it must and changed where it should',
        'THE PICTURE JUMPED, or nothing about the projection actually changed'));

    // ---- 3. parallel is PARALLEL. The whole point of the version. ----
    var gapOrtho = railGap();
    log('3.parallel', 'convergence: lens ' + gapPersp.toFixed(3) + ' deg -> flat ' +
      gapOrtho.toFixed(5) + ' deg' +
      verdict(gapOrtho < 0.001,
        'the rails are exactly parallel on screen',
        'STILL CONVERGING - this is a long lens, not a parallel projection'));

    // ---- 4. fog is left alone, because the camera did not move ----
    var fog1 = k.scene.fog ? { n: k.scene.fog.near, f: k.scene.fog.far } : null;
    var fogHeld = !!(fog0 && fog1 && fog0.n === fog1.n && fog0.f === fog1.f);
    log('4.fog_untouched', 'near ' + (fog0 && fog0.n) + ' -> ' + (fog1 && fog1.n) +
      ', far ' + (fog0 && fog0.f) + ' -> ' + (fog1 && fog1.f) +
      ', camDist ' + camDist().toFixed(3) +
      verdict(fogHeld,
        'the band did not have to move, because the camera did not',
        'THE FOG BAND WAS SHIFTED - something still thinks the camera backed away'));

    // ---- 5. one pixel is one length, everywhere ----
    var near = new THREE.Vector3(0, 0, 3), far = new THREE.Vector3(0, 0, -3);
    var wppNear = k.worldPerPixel(near), wppFar = k.worldPerPixel(far);
    var h = k.viewportEl.getBoundingClientRect().height;
    var expect = (k.orthoCam.top - k.orthoCam.bottom) / (k.orthoCam.zoom || 1) / h;
    log('5.worldPerPixel', 'near=' + wppNear.toFixed(6) + ' far=' + wppFar.toFixed(6) +
      ' frustumHeight/zoom/h=' + expect.toFixed(6) +
      verdict(Math.abs(wppNear - wppFar) < 1e-9 && Math.abs(wppNear - expect) < 1e-9,
        'no distance term, and it matches the frustum',
        'IT STILL VARIES WITH DEPTH, or disagrees with the frustum - drags would be wrong'));

    // ---- 6. picking still works through a camera three has to branch on ----
    var hitFlat = k.findObject
      ? null : null;   // findObject wants an event; raycast directly instead
    var rc = new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2(0, 0), k.camera);
    var objs = A.objects.map(function (o) { return o.mesh; });
    var hits = rc.intersectObjects(objs, false);
    var dirFlat = rc.ray.direction.clone();
    log('6.picking_flat', 'hits=' + hits.length +
      ' rayOrigin=' + rc.ray.origin.length().toFixed(2) +
      verdict(hits.length > 0,
        'a centre raycast finds the cube through the flat camera',
        'PICKING IS BLIND IN THE FLAT VIEW'));
    /* An orthographic ray does not fan out. Two rays from opposite corners
       of the screen must point the SAME way, where a lens splays them. */
    rc.setFromCamera(new THREE.Vector2(-0.9, -0.9), k.camera);
    var d1 = rc.ray.direction.clone();
    rc.setFromCamera(new THREE.Vector2(0.9, 0.9), k.camera);
    var splay = d1.angleTo(rc.ray.direction) * 180 / Math.PI;
    log('6.rays_parallel', 'cornerToCorner splay=' + splay.toFixed(5) + ' deg' +
      verdict(splay < 0.001,
        'the picking rays are parallel too, not just the picture',
        'THE RAYS STILL FAN OUT - picking disagrees with what is drawn'));

    // ---- 7. resize keeps the vertical extent and re-derives the horizontal ----
    var topBefore = k.orthoCam.top;
    k.setOrthoFrustum(k.orthoCam.top);
    var r = k.viewportEl.getBoundingClientRect();
    var wantRight = topBefore * (r.width / r.height);
    log('7.resize', 'top ' + topBefore.toFixed(4) + ' -> ' + k.orthoCam.top.toFixed(4) +
      ', right=' + k.orthoCam.right.toFixed(4) + ' expected ' + wantRight.toFixed(4) +
      verdict(Math.abs(k.orthoCam.top - topBefore) < 1e-9 &&
              Math.abs(k.orthoCam.right - wantRight) < 1e-6,
        'height held, width follows the viewport',
        'THE FRUSTUM DRIFTED ON RESIZE'));

    /* 8. A ZOOMED flat view must come back to the picture it was showing,
       not to the one it engaged with. The wheel scales an ortho camera's
       frustum and leaves it where it stands, so the distance the lens needs
       on the way out is derived from the CURRENT height, not the old one. */
    k.orthoCam.zoom = 2.5;
    k.orthoCam.updateProjectionMatrix();
    var pp2 = planePoints();
    var zoomedOn = shot(pp2.on);
    var distFlat = camDist();
    tapPill();
    var backOn = shot(pp2.on);
    var movedBack = maxMove(zoomedOn, backOn);
    log('8.zoom_round_trip', 'zoom 2.5, flat camDist ' + distFlat.toFixed(3) +
      ' -> lens camDist ' + camDist().toFixed(3) +
      ', picture moved ' + movedBack.toFixed(3) + 'px' +
      verdict(movedBack < 1.5 && !k.orthoOn,
        'the lens came back to the zoomed framing, not the engage framing',
        'THE VIEW SPRANG BACK - disengage restored the wrong distance'));

    // ---- 9. and the fog band survived the whole round trip ----
    var fog2 = k.scene.fog ? { n: k.scene.fog.near, f: k.scene.fog.far } : null;
    log('9.fog_round_trip', 'near ' + (fog0 && fog0.n) + ' -> ' + (fog2 && fog2.n) +
      ', far ' + (fog0 && fog0.f) + ' -> ' + (fog2 && fog2.f) +
      verdict(!!(fog0 && fog2 && fog0.n === fog2.n && fog0.f === fog2.f),
        'untouched, there and back',
        'THE BAND CAME BACK CHANGED'));

    // ---- 10. the export is a binding, not a frozen value ----
    var wasPersp = k.camera === k.perspCam;
    tapPill();
    var nowOrtho = k.camera === k.orthoCam;
    log('10.live_binding', 'perspBefore=' + wasPersp + ' orthoAfter=' + nowOrtho +
      ' orbitObjectFollows=' + (k.orbit.object === k.camera) +
      verdict(wasPersp && nowOrtho && k.orbit.object === k.camera,
        'both the export and the controls follow the live lens',
        'SOMETHING IS HOLDING A STALE CAMERA'));

    /* 11. Framing while flat. animateCameraTo drops to the lens on the way
       out, so frameBox must measure with the LENS fov - the live camera has
       no fov at all now, and reading it would give NaN and a flight to
       nowhere. The flight is a 420ms animation, so this half waits for it;
       measuring straight after the call read the pre-flight distance and
       would have passed over a flight that never moved. */
    var big = cube('P2', new THREE.Vector3(0, 0, 0));
    big.mesh.scale.set(2.5, 2.5, 2.5);
    big.mesh.updateMatrixWorld();
    k.focusOnObject(big);
    setTimeout(function () {
      try {
        var sp = screenSpan(big);
        var framed = sp.w > 0.08 && sp.w < 0.98 && sp.h > 0.08 && sp.h < 0.98 &&
                     sp.cx > 0.2 && sp.cx < 0.8 && sp.cy > 0.2 && sp.cy < 0.8;
        log('11.frame_while_flat', 'orthoOn=' + k.orthoOn +
          ' camDist=' + camDist().toFixed(3) +
          ' onScreen ' + (sp.w * 100).toFixed(1) + '% x ' + (sp.h * 100).toFixed(1) +
          '% centred at ' + sp.cx.toFixed(2) + ',' + sp.cy.toFixed(2) +
          verdict(!k.orthoOn && framed,
            'it left the flat view and the object fills a sensible part of the frame',
            'THE FLIGHT WENT NOWHERE - NaN fov, or a 27x over-fit'));

        // ---- 12. a turn keeps the PILL's flat view (a2.86, scoped by a2.87) ----
        tapPill();
        var wasFlat = k.orthoOn;
        k.orbit.dispatchEvent({ type: 'start' });
        var p = k.camera.position.clone().sub(k.orbit.target);
        p.applyAxisAngle(new THREE.Vector3(0, 1, 0), 20 * Math.PI / 180);
        k.camera.position.copy(k.orbit.target).add(p);
        k.orbit.dispatchEvent({ type: 'change' });
        log('12.turn_keeps', 'flatBefore=' + wasFlat + ' flatAfter=' + k.orthoOn +
          verdict(wasFlat && k.orthoOn,
            'twenty degrees of turn and still flat - the pill is the only way out',
            'A TURN STILL DROPS THE FLAT VIEW'));
        tapPill();
        log('12.pill_still_leaves', 'orthoOn=' + k.orthoOn +
          verdict(!k.orthoOn,
            'and the pill does still leave it, from a turned angle',
            'THE PILL CANNOT GET OUT ANY MORE'));

        /* 13-15. THE TWO WAYS IN (a2.87). A cube tap is a glance and a turn
           ends it; the pill is a decision and only the pill takes it back.
           Driven through the widget and the pill, not through engageOrtho,
           because `via` is decided at the call site and calling the worker
           would be asserting the argument this probe is here to check. */
        function turn(deg) {
          k.orbit.dispatchEvent({ type: 'start' });
          var v = k.camera.position.clone().sub(k.orbit.target);
          v.applyAxisAngle(new THREE.Vector3(0, 1, 0), deg * Math.PI / 180);
          k.camera.position.copy(k.orbit.target).add(v);
          k.orbit.dispatchEvent({ type: 'change' });
          k.orbit.dispatchEvent({ type: 'end' });
        }
        function pan(d) {
          k.orbit.dispatchEvent({ type: 'start' });
          k.camera.position.add(d); k.orbit.target.add(d);
          k.orbit.dispatchEvent({ type: 'change' });
          k.orbit.dispatchEvent({ type: 'end' });
        }
        function tapCube() {
          var el = document.getElementById('viewCube');
          var r = el.getBoundingClientRect();
          el.dispatchEvent(new MouseEvent('click', {
            clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
            bubbles: true, cancelable: true
          }));
        }

        if (k.orthoOn) tapPill();          // start from perspective
        tapCube();
        setTimeout(function () {
          try {
            log('13.cube_lands_flat', 'orthoOn=' + k.orthoOn + ' sticky=' + k.orthoSticky +
              verdict(k.orthoOn && !k.orthoSticky,
                'the cube opened a glance, not a decision',
                'A CUBE TAP DID NOT OPEN A NON-STICKY FLAT VIEW'));

            pan(new THREE.Vector3(0.4, 0.15, -0.2));
            var panHeld = k.orthoOn;
            turn(0.3);
            var wobbleHeld = k.orthoOn;
            log('13.glance_survives_the_rest', 'afterPan=' + panHeld +
              ' afterWobble=' + wobbleHeld +
              verdict(panHeld && wobbleHeld,
                'a pan and a sub-degree wobble are not turns',
                'A PAN OR A WOBBLE ENDED THE GLANCE'));

            turn(6);
            log('14.turn_ends_the_glance', 'orthoOn=' + k.orthoOn +
              verdict(!k.orthoOn,
                'six degrees hands the perspective back, as a2.61 had it',
                'THE GLANCE SURVIVED A TURN'));

            // 15. The pill's flat view is not the cube's.
            tapPill();
            var stickyNow = k.orthoSticky;
            turn(20);
            var heldTurn = k.orthoOn;
            tapCube();
            setTimeout(function () {
              try {
                var stillSticky = k.orthoSticky;
                turn(20);
                log('15.decision_outranks_a_glance', 'sticky=' + stickyNow +
                  ' survivedTurn=' + heldTurn + ' stickyAfterCubeTap=' + stillSticky +
                  ' stillFlat=' + k.orthoOn +
                  verdict(stickyNow && heldTurn && stillSticky && k.orthoOn,
                    'the pill holds through a turn, and a cube tap swings the angle without downgrading it',
                    'A PILL VIEW WAS LOST TO A TURN OR DOWNGRADED BY THE CUBE'));
                tapPill();
                log('15.pill_still_leaves_after_all_that', 'orthoOn=' + k.orthoOn +
                  verdict(!k.orthoOn, 'and the pill still lets go',
                    'THE PILL CANNOT GET OUT'));
              } catch (e) {
                out.push('ERROR(part4)=' + (e && e.stack ? e.stack.split('\n').slice(0, 6).join(' / ') : e));
              }
              log('console.errors', errs.length ? errs.join(' | ').slice(0, 300) : 'none');
              done();
            }, 800);
          } catch (e) {
            out.push('ERROR(part3)=' + (e && e.stack ? e.stack.split('\n').slice(0, 6).join(' / ') : e));
            log('console.errors', errs.length ? errs.join(' | ').slice(0, 300) : 'none');
            done();
          }
        }, 800);
      } catch (e) {
        out.push('ERROR(part2)=' + (e && e.stack ? e.stack.split('\n').slice(0, 6).join(' / ') : e));
        log('console.errors', errs.length ? errs.join(' | ').slice(0, 300) : 'none');
        done();
      }
    }, 900);
  }

  function _unused() {
  }

  var posted = false;
  function post() {
    if (posted) return;
    posted = true;
    try { fetch('/result', { method: 'POST', body: out.join('\n') }); }
    catch (e) { /* nothing else to try */ }
  }
  setTimeout(function () {
    if (!posted) { out.push('WATCHDOG=main did not finish - the last line above is where it hung'); post(); }
  }, 30000);
  function ready(cb, t) {
    t = t || 0;
    if (window.__kubik && window.__kubik.App) return cb();
    if (t > 400) { out.push('ERROR=no __kubik'); return post(); }
    setTimeout(function () { ready(cb, t + 1); }, 20);
  }
  window.addEventListener('error', function (e) { errs.push('onerror: ' + (e.message || e)); });
  setTimeout(function () {
    ready(function () {
      setTimeout(function () {
        try { main(post); }
        catch (e) {
          out.push('ERROR=' + (e && e.stack ? e.stack.split('\n').slice(0, 8).join(' / ') : e));
          post();
        }
      }, 800);
    });
  }, 400);
})();
