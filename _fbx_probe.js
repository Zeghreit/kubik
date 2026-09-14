/* v2.31: .fbx import.

   Fixtures - three.js's own example models, fetched by the runner, plus one
   written by _mkfbx.py:

     _fbxfix_cube.fbx   1.7kB ASCII 7.4, 6 quads, 2 materials  (WRITTEN)
     _fbxfix_nurbs.fbx  4kB   ASCII 7.2, NURBS curves and NO MESH
     _fbxfix_samba.fbx  3.7MB binary, a skinned Mixamo character
     _fbxfix_bunny.fbx  8MB   binary, a scan far over every budget

   The cube is written rather than downloaded because three ships nothing
   under Kubik's budget: every real file it has proves a REFUSAL, and without
   a small one this probe would never once prove that an .fbx opens.

   What is tested is the KUBIK side - the refusals, the picker, the lazy
   fetch, the conversion into `ed`, the material mapping and landImport's
   budgets. FBXLoader is three's and is tested upstream; the seam is new.

   A FAIL line starts at column 0 and carries its section number, because
   _fbxbrokenrun.py reads those to check the probe is not blind.
*/
(function () {
  var out = [], errs = [], fails = 0;
  window.addEventListener('error', function (e) { errs.push(e.message); });
  window.addEventListener('unhandledrejection', function (e) {
    errs.push('unhandled: ' + (e.reason && e.reason.message || e.reason));
  });
  function log(s) { out.push(s); }
  function verdict(id, ok, good, bad) {
    if (!ok) fails++;
    return ok ? '  ok  ' + good : 'FAIL ' + id + ' ' + bad;
  }

  async function main() {
    var k = window.__kubik, A = k.App;

    /* The toast is the whole user-visible answer for a refusal, so the probe
       reads it rather than inferring from "nothing appeared". */
    var toasts = [];
    (function () {
      var el = document.getElementById('toast');
      if (!el) return;
      new MutationObserver(function () {
        var t = (el.textContent || '').trim();
        if (t && toasts[toasts.length - 1] !== t) toasts.push(t);
      }).observe(el, { childList: true, characterData: true, subtree: true });
    })();
    function lastToast() { return toasts.length ? toasts[toasts.length - 1] : '(none)'; }
    function clearToasts() { toasts.length = 0; }

    function clearScene() { A.objects.slice().forEach(function (o) { k.removeObjects([o]); }); }
    function objCount() { return A.objects.length; }
    function faceTotal() {
      var n = 0;
      A.objects.forEach(function (o) { if (!k.isCurve(o)) n += k.faceCount(o.mesh.geometry); });
      return n;
    }
    function allFinite() {
      var bad = 0;
      A.objects.forEach(function (o) {
        if (k.isCurve(o)) return;
        var p = o.mesh.geometry.attributes.position;
        for (var i = 0; i < p.count; i++) {
          if (!Number.isFinite(p.getX(i)) || !Number.isFinite(p.getY(i)) || !Number.isFinite(p.getZ(i))) bad++;
        }
      });
      return bad;
    }
    async function grab(name) {
      var r = await fetch(name + '?cb=' + Date.now());
      if (!r.ok) throw new Error(name + ' -> ' + r.status);
      return await r.arrayBuffer();
    }
    function ascii(str) {
      var b = new Uint8Array(str.length);
      for (var i = 0; i < str.length; i++) b[i] = str.charCodeAt(i);
      return b.buffer;
    }

    /* ---- 1. the picker offers it ---- */
    var accept = (document.getElementById('fileImport') || {}).accept || '';
    log('1.1 the file picker' +
      '\n  accept="' + accept + '"' +
      '\n' + verdict('1.1', accept.indexOf('.fbx') >= 0,
        'a person can pick an .fbx at all',
        'THE PICKER STILL REFUSES .fbx - the reader is unreachable'));

    /* ---- 2. refused early, before the 110kB fetch ---- */
    log('');
    log('=== 2. refused early, with a reason ===');

    var notFbx = ascii('PK this is a zip, not a model at all. ' + new Array(200).join('x'));
    var why = k.fbxRefusal(notFbx);
    log('2.1 a file that is not an fbx' +
      '\n  "' + why + '"' +
      '\n' + verdict('2.1', !!why && /fbx/i.test(why),
        'named, not "could not read that file"',
        'A RENAMED FILE IS NOT CAUGHT BEFORE THE PARSE'));

    // "Kaydara FBX Binary  \0\x1a\0" then a uint32 version at offset 23.
    function binHeader(version, len) {
      // Built whole, THEN cut - writing the version into a buffer already
      // shortened to 24 bytes throws in the probe rather than testing
      // anything about the app.
      var b = new Uint8Array(64);
      var m = 'Kaydara FBX Binary  ';
      for (var i = 0; i < m.length; i++) b[i] = m.charCodeAt(i);
      b[20] = 0x00; b[21] = 0x1a; b[22] = 0x00;
      new DataView(b.buffer).setUint32(23, version, true);
      return len ? b.buffer.slice(0, len) : b.buffer;
    }
    why = k.fbxRefusal(binHeader(6000));
    log('2.2 binary fbx older than three can read (6000)' +
      '\n  "' + why + '"' +
      '\n' + verdict('2.2', !!why && /6400|re-export/i.test(why),
        'says which versions do work',
        'AN UNREADABLE VERSION REACHES THE PARSER AND THROWS INSTEAD'));

    why = k.fbxRefusal(binHeader(7400, 24));
    log('2.3 a truncated binary header' +
      '\n  "' + why + '"' +
      '\n' + verdict('2.3', !!why,
        'refused rather than read past the end',
        'A TRUNCATED FILE IS NOT CAUGHT'));

    why = k.fbxRefusal(binHeader(7400));
    log('2.4 a current binary header is NOT refused' +
      '\n  ' + (why === null ? 'null' : '"' + why + '"') +
      '\n' + verdict('2.4', why === null,
        'the guard lets a normal file through',
        'THE GUARD REFUSES A FILE IT SHOULD ACCEPT - every fbx would bounce'));

    /* Size is the one refusal that has to come first: parse() is a single
       synchronous call that inflates every embedded texture before the
       triangle budget is ever consulted. */
    var huge = new ArrayBuffer(70 * 1024 * 1024);
    why = k.fbxRefusal(huge);
    log('2.5 a 70MB file' +
      '\n  "' + why + '"' +
      '\n' + verdict('2.5', !!why && /MB/.test(why),
        'refused on size before the parse, and says the size',
        'A 70MB FILE IS PARSED BEFORE ANYTHING REFUSES IT'));

    /* ---- 3. the 110kB reader is lazy ---- */
    log('');
    log('=== 3. the reader is fetched on first use ===');
    function loaderFetched() {
      return performance.getEntriesByType('resource')
        .some(function (e) { return e.name.indexOf('FBXLoader') >= 0; });
    }
    var beforeAny = loaderFetched();
    log('3.1 before any .fbx is opened' +
      '\n  FBXLoader requested: ' + beforeAny +
      '\n' + verdict('3.1', !beforeAny,
        'a cold load does not pay for a format it never opens',
        'FBXLoader IS FETCHED ON EVERY LOAD'));

    /* ---- 4. real files ---- */
    log('');
    log('=== 4. files ===');
    clearScene(); clearToasts();
    var before = objCount();
    await k.importFbxBuffer(await grab('_fbxfix_nurbs.fbx'), 'nurbs');
    log('4.1 nurbs.fbx - ASCII 7.2, curves only' +
      '\n  objects ' + before + ' -> ' + objCount() + ', toast: "' + lastToast() + '"' +
      '\n' + verdict('4.1', objCount() === before && /no mesh/i.test(lastToast()),
        'says there is no mesh, and adds nothing',
        'A FILE WITH NO MESH EITHER ADDED SOMETHING OR SAID NOTHING'));

    var afterFirst = loaderFetched();
    log('4.2 and NOW the loader is there' +
      '\n  FBXLoader requested: ' + afterFirst +
      '\n' + verdict('4.2', afterFirst,
        'fetched on first use',
        'THE DYNAMIC IMPORT DID NOT HAPPEN - section 3 proved nothing'));

    /* The one that proves an .fbx OPENS rather than that it is refused. */
    clearScene(); clearToasts();
    before = objCount();
    await k.importFbxBuffer(await grab('_fbxfix_cube.fbx'), 'cube');
    var madeCube = objCount() - before;
    var fc = faceTotal();
    var vcount = 0, cubeBox = null;
    if (madeCube > 0) {
      var mesh = A.objects[A.objects.length - 1].mesh;
      vcount = mesh.userData.topo ? mesh.userData.topo.logicalCount : -1;
      cubeBox = new k.THREE.Box3().setFromObject(mesh);
    }
    log('4.3 a 6-quad cube with two materials' +
      '\n  objects +' + madeCube + ', faces ' + fc + ', logical verts ' + vcount +
      (cubeBox ? ', size ' + cubeBox.getSize(new k.THREE.Vector3()).toArray()
        .map(function (v) { return v.toFixed(2); }).join(' x ') : '') +
      '\n  toast: "' + lastToast() + '"' +
      '\n' + verdict('4.3', madeCube === 1 && fc === 6 && vcount === 8 && allFinite() === 0,
        'six quads and eight corners - the polygons survived as polygons, not 12 triangles',
        'THE CUBE DID NOT COME IN AS 6 FACES / 8 VERTICES'));

    /* The materials are the half that is easy to lose and that nothing else
       notices: the mesh is the right shape either way, just uniformly grey. */
    var libNames = [];
    if (k.MATERIALS && k.MATERIALS.forEach) {
      k.MATERIALS.forEach(function (d) { if (d && d.name) libNames.push(d.name); });
    }
    var gotBoth = libNames.indexOf('CrimsonPaint') >= 0 && libNames.indexOf('BrassTrim') >= 0;
    log('4.4 and its two materials' +
      '\n  library: ' + (libNames.length ? libNames.join(' | ') : '(could not read)') +
      '\n' + verdict('4.4', gotBoth,
        'both names came across, so three faces are red and three are brass',
        'THE MATERIALS WERE DROPPED - the cube landed uniformly grey'));

    /* Two named parts under one FBX null. FBXLoader makes a Group for every
       null, and collectImportableMeshes' owner rule - written for glTF, where
       a Group means "the primitives of one mesh" - used to swallow both into
       one object with one name and no way to separate them. */
    clearScene(); clearToasts();
    before = objCount();
    await k.importFbxBuffer(await grab('_fbxfix_two.fbx'), 'tank');
    var madeTwo = objCount() - before;
    var names = A.objects.map(function (o) { return o.name; });
    var widest = 0;
    A.objects.forEach(function (o) {
      var b = new k.THREE.Box3().setFromObject(o.mesh);
      widest = Math.max(widest, b.getSize(new k.THREE.Vector3()).x);
    });
    log('4.5 three meshes, two of them under one FBX null' +
      '\n  objects +' + madeTwo + ': ' + names.join(', ') +
      '\n  widest single object ' + widest.toFixed(2) + ' (merged would be 3.00, apart 1.00)' +
      '\n' + verdict('4.5', madeTwo === 3 && widest < 1.5,
        'each part is its own object, movable and deletable on its own',
        'THE PARTS UNDER THE NULL WERE MERGED INTO ONE INSEPARABLE OBJECT'));

    /* ---- 4.6 gloss survives Phong -> roughness ---- */
    clearScene(); clearToasts();
    await k.importFbxBuffer(await grab('_fbxfix_cube.fbx'), 'cube');
    var roughs = [];
    if (k.MATERIALS && k.MATERIALS.forEach) {
      k.MATERIALS.forEach(function (d) {
        if (d && (d.name === 'CrimsonPaint' || d.name === 'BrassTrim')) {
          roughs.push(d.name + '=' + (d.roughness === undefined ? 'undef' : d.roughness));
        }
      });
    }
    // ShininessExponent 20 -> sqrt(2/22) = 0.30, NOT the 1.0 fallback.
    var glossy = roughs.length === 2 && roughs.every(function (r) {
      var v = parseFloat(r.split('=')[1]);
      return Number.isFinite(v) && v < 0.6;
    });
    log('4.6 FBX shininess reaches the material as roughness' +
      '\n  ' + (roughs.length ? roughs.join(', ') : '(no entries found)') +
      '\n' + verdict('4.6', glossy,
        'a gloss-painted fbx is not flattened to dead matte',
        'EVERY FBX MATERIAL TOOK THE roughness=1 FALLBACK - phong has no roughness field'));

    /* ---- 5. a skinned character, the case this whole tail is for ---- */
    clearScene(); clearToasts();
    before = objCount();
    var t0 = performance.now();
    await k.importFbxBuffer(await grab('_fbxfix_samba.fbx'), 'samba');
    var ms = Math.round(performance.now() - t0);
    var refusedForSize = /too heavy|too many/i.test(lastToast());
    var made = objCount() - before;
    log('5.1 Samba Dancing.fbx - binary, a skinned Mixamo character' +
      '\n  objects +' + made + ', faces ' + faceTotal() + ', ' + ms + 'ms' +
      '\n  toast: "' + lastToast() + '"' +
      '\n' + (refusedForSize
        ? verdict('5.1', made === 0,
          'over budget, refused with the count - and added nothing',
          'REFUSED FOR SIZE YET STILL ADDED GEOMETRY')
        : verdict('5.1', made > 0 && faceTotal() > 0 && allFinite() === 0,
          'a skinned character comes in as editable faces, all coordinates finite',
          'A CHARACTER THAT FITS THE BUDGET DID NOT LAND')));

    /* ---- 6. far over every budget ---- */
    clearScene(); clearToasts();
    before = objCount();
    await k.importFbxBuffer(await grab('_fbxfix_bunny.fbx'), 'bunny');
    log('6.1 stanford-bunny.fbx - a scan, far over the budget' +
      '\n  objects ' + before + ' -> ' + objCount() + ', toast: "' + lastToast() + '"' +
      '\n' + verdict('6.1', objCount() === before && /too heavy|too many|triangles|faces/i.test(lastToast()),
        'refused with the number, and nothing was added',
        'AN 8MB SCAN EITHER LANDED OR WAS REFUSED WITHOUT SAYING WHY'));

    /* ---- 7. nothing threw ---- */
    clearScene();
    log('');
    log('7.1 page errors after all of it' +
      '\n  ' + (errs.length ? errs.join(' | ').slice(0, 300) : 'none') +
      '\n' + verdict('7.1', errs.length === 0,
        'no throw reached the window',
        'SOMETHING THREW'));

    out.push('');
    out.push('VERDICT=' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
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
    if (window.__kubik && window.__kubik.App && window.__kubik.App.objects) return cb();
    if (t > 300) { out.push('ERROR=no __kubik'); return finish(); }
    setTimeout(function () { ready(cb, t + 1); }, 20);
  }
  setTimeout(function () {
    ready(function () {
      setTimeout(function () {
        main().catch(function (e) {
          out.push('ERROR=' + (e && e.stack ? e.stack.split('\n').slice(0, 10).join(' / ') : e));
          out.push('VERDICT=FAIL (threw)');
        }).then(finish);
      }, 600);
    });
  }, 300);
})();
