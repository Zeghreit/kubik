/* v2.34: does a normal map survive Round edges and Bump?

   Until this release it did not. The mask patch set the normal from the
   VERTEX normal and threw the chunk's answer away, so wherever it bent the
   normal the map was simply gone. The measurement is therefore not "does it
   look right" but "does binding the map change one pixel WHERE THE BEND
   HAPPENS" - the same question v2.9 asked of the bump and got 0.00 for.

   WHERE THE BEND HAPPENS is the whole of it, and the first version of this
   file got it wrong. It compared the two shots over the whole model, and the
   broken build PASSED: Round edges only bends the normal near an edge, so on
   the flat faces the map survived even there, and the flat faces are most of
   the pixels. Only Bump - which bends everywhere - showed up as zero. So
   section 1 now masks itself to the pixels the bevel actually moved, which is
   the population the question is about.

   The other half cannot be measured in one run: that the bend, with NO map
   bound, still lands where it used to. `_vsheadnm.py` runs this probe against
   `git show HEAD:index.html` and compares the tile signatures below. */
(function () {
  var out = [], shots = [], errs = [], fails = 0, done = false, at = 'start';
  window.addEventListener('error', function (e) { errs.push(e.message); });
  window.addEventListener('unhandledrejection', function (e) {
    errs.push('rejected: ' + (e.reason && e.reason.message ? e.reason.message : e.reason));
  });
  setTimeout(function () { if (!done) { out.push('WATCHDOG at ' + at); finishUp(); } }, 90000);
  function log(s) { out.push(s); }
  function mark(s) { at = s; }
  function verdict(ok, good, bad) { if (!ok) fails++; return ok ? '  ok  ' + good : '  FAIL ' + bad; }

  async function main() {
    var k = window.__kubik, A = k.App, THREE = k.THREE;
    function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    function clearScene() { A.objects.slice().forEach(function (o) { k.removeObjects([o]); }); }

    /* A CHECKER OF TWO OPPOSITE TILTS, not a gentle ramp. The question is
       whether the map contributes AT ALL, and a map that barely tilts cannot
       tell "ignored" from "applied faintly". */
    function normalSheet(size) {
      var c = document.createElement('canvas');
      c.width = c.height = size;
      var g = c.getContext('2d'), n = 8, q = size / n;
      for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
        var r = ((x + y) % 2) ? 200 : 56;      // +x tilt / -x tilt
        g.fillStyle = 'rgb(' + r + ',128,235)';
        g.fillRect(x * q, y * q, q, q);
      }
      return c;
    }
    function tex(cvs) {
      var t = new THREE.CanvasTexture(cvs);
      t.colorSpace = THREE.NoColorSpace;
      t.flipY = false;
      return t;
    }
    var pixCache = new Map();
    function decode(url) {
      if (pixCache.has(url)) return Promise.resolve(pixCache.get(url));
      return new Promise(function (res) {
        var im = new Image();
        im.onload = function () {
          var c = document.createElement('canvas');
          c.width = im.width; c.height = im.height;
          var g = c.getContext('2d');
          g.drawImage(im, 0, 0);
          var d = { px: g.getImageData(0, 0, im.width, im.height).data, w: im.width, h: im.height };
          pixCache.set(url, d);
          res(d);
        };
        im.onerror = function () { res(null); };
        im.src = url;
      });
    }
    var CHANGED = 6;   // per-pixel sum over rgb, below which it is dither
    /* OVER THE PIXELS THAT MOVED, not over the frame. Most of the canvas is
       background in both shots, and averaging that in turns a real difference
       on the model into a small number about the viewport.

       `within` narrows it further, to the pixels some OTHER pair moved - that
       is how "did the map survive where the bevel bent the normal" is asked
       without the flat faces, where the bevel bends nothing, drowning it. */
    async function diff(aUrl, bUrl, withinA, withinB) {
      var a = await decode(aUrl), b = await decode(bUrl);
      if (!a || !b || a.px.length !== b.px.length) return { mean: -1, moved: -1, of: 0 };
      var mask = null;
      if (withinA) {
        var wa = await decode(withinA), wb = await decode(withinB);
        mask = new Uint8Array(a.px.length / 4);
        for (var j = 0, p = 0; j < wa.px.length; j += 4, p++) {
          var dw = Math.abs(wa.px[j] - wb.px[j]) + Math.abs(wa.px[j + 1] - wb.px[j + 1]) +
                   Math.abs(wa.px[j + 2] - wb.px[j + 2]);
          mask[p] = dw > CHANGED ? 1 : 0;
        }
      }
      var sum = 0, moved = 0, of = 0;
      for (var i = 0, q = 0; i < a.px.length; i += 4, q++) {
        if (mask && !mask[q]) continue;
        of++;
        var d = Math.abs(a.px[i] - b.px[i]) + Math.abs(a.px[i + 1] - b.px[i + 1]) +
                Math.abs(a.px[i + 2] - b.px[i + 2]);
        if (d > CHANGED) { moved++; sum += d / 3; }
      }
      return { mean: moved ? sum / moved : 0, moved: moved, of: of };
    }
    /* A SIGNATURE THAT SURVIVES A LAST BIT. Comparing two builds by the hash
       of a PNG says "moved" for a rounding difference in the fourth decimal
       of a normal, which is not a behaviour change - and this release rewrites
       the arithmetic that produces every one of those normals. Eight by eight
       tiles of mean luma, as integers, is coarse enough to ignore that and
       fine enough to catch anything a person could see. */
    async function tiles(url) {
      var a = await decode(url);
      if (!a) return '';
      var n = 8, out = [];
      for (var ty = 0; ty < n; ty++) for (var tx = 0; tx < n; tx++) {
        var x0 = Math.floor(tx * a.w / n), x1 = Math.floor((tx + 1) * a.w / n);
        var y0 = Math.floor(ty * a.h / n), y1 = Math.floor((ty + 1) * a.h / n);
        var s = 0, c = 0;
        for (var y = y0; y < y1; y++) for (var x = x0; x < x1; x++) {
          var i = (y * a.w + x) * 4;
          s += 0.299 * a.px[i] + 0.587 * a.px[i + 1] + 0.114 * a.px[i + 2];
          c++;
        }
        out.push(Math.round(s / Math.max(1, c)));
      }
      return out.join(',');
    }

    /* THE CAMERA IS PINNED, and this is why the first run of this probe was
       worthless. landImport frames the object it just made with an ANIMATION,
       and in a headless page rAF runs when it likes - so one shot caught the
       cube mid-flight filling the frame and the next caught it settled and
       smaller. The probe reported 216,845 pixels moved with a mean of 171,
       and every word of that was about the cube changing size. The numbers
       looked healthy. Only the pictures said otherwise.

       Pinned per FRAME: the app's own loop is still animating and would put
       it back between the pin and the render. */
    var camPos = null, camQuat = null;
    function pin() {
      if (!camPos) return;
      k.camera.position.copy(camPos);
      k.camera.quaternion.copy(camQuat);
      k.camera.updateMatrixWorld(true);
    }
    // Three frames and a pause before every shot: the edge field Round edges
    // needs is baked lazily FROM the render and throttled to 120ms, so a
    // single draw measures a material that has not got its field yet.
    async function shot(name) {
      for (var i = 0; i < 3; i++) {
        pin();
        k.renderer.render(k.scene, k.camera);
        await sleep(150);
      }
      pin();
      k.renderer.render(k.scene, k.camera);
      var url = k.renderer.domElement.toDataURL();
      shots.push(name + '\t' + url);
      return url;
    }

    /* ---- the fixture: a cube WITH UVs, wearing a normal map ----
       Through the real landing, like _texchk - a primitive has no UVs worth
       sampling and a map on a mesh without them is bound to nothing. */
    mark('fixture');
    clearScene();
    var srcMat = new THREE.MeshStandardMaterial({
      name: 'NmapProbe', color: 0xbfc4c9, roughness: 0.45, metalness: 0
    });
    srcMat.normalMap = tex(normalSheet(256));
    var grp = new THREE.Group();
    grp.add(new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.7, 1.7), srcMat));
    grp.updateMatrixWorld(true);
    var parts = k.collectImportableMeshes(grp, false), built = [];
    parts.forEach(function (p) {
      var ed = k.editableFromImportedMeshes(p.meshes);
      if (ed && ed.groups.length) built.push({ name: p.name, ed: ed });
    });
    k.landImport(built, 'Nmap');

    var id = null;
    k.MATERIALS.forEach(function (d, i) { if (!id && d.maps && d.maps.normal) id = i; });
    var def = id ? k.getMaterialDef(id) : null;
    var nkey = def && def.maps ? def.maps.normal : null;
    log('=== the fixture ===');
    log('  definition ' + id + ', normal key ' + (nkey ? 'present' : 'MISSING') +
      ', objects ' + A.objects.length);
    if (!nkey) {
      log(verdict(false, '', 'THE NORMAL MAP DID NOT ARRIVE - nothing below tests anything'));
      finishUp(); return;
    }
    var live = k.textureFor(nkey, false);
    for (var w = 0; w < 100 && !(live.image && live.image.width); w++) await sleep(20);
    log('  the map decoded: ' + !!(live.image && live.image.width));

    /* One known viewpoint rather than whatever the framing animation was
       doing, and the whole cube inside the frame - a shot cropped by the
       viewport hides exactly the corners Round edges is about. */
    await sleep(900);
    k.camera.position.set(2.9, 2.3, 3.4);
    k.camera.lookAt(0, 0, 0);
    k.camera.updateMatrixWorld(true);
    camPos = k.camera.position.clone();
    camQuat = k.camera.quaternion.clone();

    function set(mapOn, bevel, bump) {
      if (mapOn) def.maps.normal = nkey; else delete def.maps.normal;
      def.bevel = bevel || 0;
      def.masks = bump ? [{ on: true, type: 'fbm', blend: 'normal', colorOn: false,
        roughOn: false, bump: 0.8, amount: 1, scale: 4, detail: 3, contrast: 1.2,
        nscale: 1, seed: 3 }] : [];
      /* The mask texture has to be BAKED. Setting def.masks and calling
         updateMaterialEverywhere leaves the packed texture at whatever it held
         before - mkStructural is the funnel that rebakes - and a probe writing
         the field directly has to do what the funnel does. Without it section
         2 compared two shots of a mask that sampled nothing, and its numbers
         came out identical to section 3's, to the digit. */
      k.rebakeMaskTexture(def);
      k.updateMaterialEverywhere(id);
      k.ensureMaskPatches();
      A.objects.forEach(function (o) { k.dressFromPool(o); });
      /* AND THE WEAR LIST. Round edges reads a distance field baked from
         `geo.userData.kubikEdges`, which applyShading builds only for an
         object something asks it of. ensureWearLists fills it in, and it
         hangs off refreshUI rather than off the patch pass. */
      k.refreshUI();
    }

    // WHAT THE FIXTURE ACTUALLY IS, printed before anything is asserted about
    // it. A bevel that never reached the shader would make section 4 fail for
    // a reason that has nothing to do with normal maps.
    function state() {
      var o = A.objects[0];
      var m = (Array.isArray(o.mesh.material) ? o.mesh.material : [o.mesh.material])[0];
      var e = o.mesh.geometry.userData.kubikEdges;
      return 'patched=' + (k.isMaskPatched ? k.isMaskPatched(m) : '?') +
        ' wantsWear=' + o.mesh.userData.wantsWear +
        ' edges=' + (e ? (e.pos.length / 6) : 'none') +
        ' bevel=' + (def.bevel || 0) +
        ' map=' + (m.normalMap ? 'bound' : 'no');
    }

    /* ---- every shot first, then every question ----
       Section 1 needs the plain shot to know where the bevel bends, and the
       plain shot is section 3's. Taking them all up front is what lets each
       question be asked of the right population. */
    mark('shots');
    set(true, 0.5, false);  var bevelMap = await shot('bevel+map');  var st1 = state();
    set(false, 0.5, false); var bevelOnly = await shot('bevel-only'); var st2 = state();
    set(true, 0, true);     var bumpMap = await shot('bump+map');
    set(false, 0, true);    var bumpOnly = await shot('bump-only');
    set(true, 0, false);    var mapOnly = await shot('map-only');
    set(false, 0, false);   var plain = await shot('plain');
    log('  bevel on, with map: ' + st1);
    log('  bevel on, without : ' + st2);

    mark('measuring');
    /* ---- 1. the defect, asked where the bevel actually bends ---- */
    var d1 = await diff(bevelMap, bevelOnly, bevelOnly, plain);
    log('');
    log('=== 1. Round edges, on the pixels Round edges moved ===');
    log('  ' + d1.moved + ' of ' + d1.of + ' bevelled pixels moved, mean ' +
      d1.mean.toFixed(2) + ' of 255');
    log(verdict(d1.of > 2000 && d1.moved > d1.of * 0.2 && d1.mean > 3,
      'the map still contributes where Round edges bends the normal',
      d1.of <= 2000 ? 'THE BEVEL BENT ALMOST NOTHING (' + d1.of + ' px) - nothing was tested'
        : 'ONLY ' + d1.moved + ' OF ' + d1.of + ' BENT PIXELS MOVED, mean ' +
          d1.mean.toFixed(2) + ' - the bend is throwing the map away'));

    /* ---- 2. and a Bump mask, which bends everywhere ---- */
    var d2 = await diff(bumpMap, bumpOnly);
    log('');
    log('=== 2. a Bump mask, with the map and without it ===');
    log('  ' + d2.moved + ' pixels moved, mean ' + d2.mean.toFixed(2) + ' of 255');
    log(verdict(d2.moved > 500 && d2.mean > 3,
      'the map still contributes while Bump is live',
      d2.moved === 0 ? 'NOT ONE PIXEL MOVED - Bump is throwing the map away'
        : 'ONLY ' + d2.moved + ' PIXELS MOVED, mean ' + d2.mean.toFixed(2)));

    /* ---- 3. the fixture proves itself: the map works on its own ---- */
    var d3 = await diff(mapOnly, plain);
    log('');
    log('=== 3. the map on its own ===');
    log('  ' + d3.moved + ' pixels moved, mean ' + d3.mean.toFixed(2) + ' of 255');
    log(verdict(d3.moved > 500 && d3.mean > 3,
      'the map does something when nothing is bending the normal',
      'THE MAP CHANGES NOTHING AT ALL - sections 1 and 2 tested nothing'));

    /* ---- 4. and the bend still bends ----
       The cheapest way to pass section 1 would be to stop bending the normal
       at all, which would break Round edges. */
    var d4 = await diff(bevelOnly, plain);
    var d5 = await diff(bumpOnly, plain);
    log('');
    log('=== 4. the two bends, with no map in sight ===');
    log('  Round edges: ' + d4.moved + ' pixels, mean ' + d4.mean.toFixed(2));
    log('  Bump       : ' + d5.moved + ' pixels, mean ' + d5.mean.toFixed(2));
    log(verdict(d4.moved > 2000 && d4.mean > 3 && d5.moved > 2000 && d5.mean > 3,
      'both still do what they did',
      'A BEND STOPPED DOING ANYTHING - the map was not the only casualty'));

    /* ---- 5. the signatures another build is compared against ---- */
    mark('tiles');
    log('');
    log('=== 5. tile signatures, for comparing against another build ===');
    log('  bevel-only ' + (await tiles(bevelOnly)));
    log('  bump-only ' + (await tiles(bumpOnly)));
    log('  plain ' + (await tiles(plain)));

    finishUp();
  }

  function finishUp() {
    if (done) return;
    done = true;
    out.push('');
    out.push('VERDICT=' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
    out.push('page.errors=' + (errs.length ? errs.join(' | ').slice(0, 400) : 'none'));
    var pre = document.createElement('pre');
    pre.id = 'probeOut';
    pre.textContent = '<<<PROBE\n' + out.join('\n') + '\nPROBE>>>';
    document.body.appendChild(pre);
    var sh = document.createElement('pre');
    sh.id = 'probeShots';
    sh.textContent = shots.join('\n');
    document.body.appendChild(sh);
    document.title = 'PROBE-DONE';
  }
  function ready(cb, t) {
    t = t || 0;
    if (window.__kubik && window.__kubik.App && window.__kubik.App.objects) return cb();
    if (t > 300) { out.push('ERROR=no __kubik'); return finishUp(); }
    setTimeout(function () { ready(cb, t + 1); }, 20);
  }
  setTimeout(function () {
    ready(function () {
      setTimeout(function () {
        main().catch(function (e) {
          out.push('ERROR=' + (e && e.stack ? e.stack.split('\n').slice(0, 8).join(' / ') : e));
          finishUp();
        });
      }, 600);
    });
  }, 300);
})();
