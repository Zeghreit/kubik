/* "A textured .glb opens textured" - measure it, do not reason about it.

   TWO QUESTIONS, and they are not the same one:

     on screen  - is the picture bound to the material, the right way up, in
                  the right colour space, and small enough to draw on a phone
     out of the history - does a step cost a REFERENCE or a megabyte

   The second is the one this app got wrong the last time it grew pictures
   (v2.27: forty mask photos, ~2 MB of base64 per step against a 48 MB
   ceiling, and Undo giving up after twelve presses on a cube). So it is
   asserted in BYTES here, not believed.

   And the lesson from v2.28, which is what this file is shaped around: assert
   that the thing describes THESE vertices, not that it exists. Two checks
   there were empty and it was the deliberately broken build that said so. */
(function () {
  var out = [], errs = [], fails = 0, done = false, at = 'start';
  window.addEventListener('error', function (e) { errs.push(e.message); });
  window.addEventListener('unhandledrejection', function (e) {
    errs.push('rejected: ' + (e.reason && e.reason.message ? e.reason.message : e.reason));
  });
  /* A WATCHDOG, because a probe that hangs prints nothing and a script that
     never ran prints nothing, and those read identically from the runner.
     `at` says how far it got. */
  setTimeout(function () { if (!done) { hardFail = 'the probe hung at ' + at; out.push('WATCHDOG at ' + at); finishUp(); } }, 150000);
  function log(s) { out.push(s); }
  function mark(s) { at = s; }
  var hardFail = '';
  function verdict(ok, good, bad) { if (!ok) fails++; return ok ? '  ok  ' + good : '  FAIL ' + bad; }

  async function main() {
    var k = window.__kubik, A = k.App, THREE = k.THREE;
    var V3 = THREE.Vector3;

    function clearScene() { A.objects.slice().forEach(function (o) { k.removeObjects([o]); }); }
    function matsOf(o) {
      return Array.isArray(o.mesh.material) ? o.mesh.material : [o.mesh.material];
    }
    function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    // A texture's image decodes asynchronously even from a data URL, so
    // "how wide is it" has to be waited for rather than assumed.
    async function settled(t, tries) {
      for (var i = 0; i < (tries || 100); i++) {
        if (t && t.image && t.image.width) return true;
        await sleep(20);
      }
      return false;
    }

    /* A SHEET WHOSE TOP-LEFT IS UNMISTAKABLE. "Is it upside down" is then one
       pixel, not an impression - and an impression is exactly what went wrong
       twice on this project (a2.25's four corner dots that measured as a
       clean band, v2.9's halo that measured as a ring). */
    function sheet(corner, ground, size) {
      size = size || 512;
      var c = document.createElement('canvas');
      c.width = c.height = size;
      var g = c.getContext('2d');
      g.fillStyle = ground; g.fillRect(0, 0, size, size);
      /* NOISE ACROSS THE MIDDLE, and this is not decoration. Section 4 asks
         whether a history step costs a reference or a payload, and a picture
         of two flat rectangles compresses to nothing - the first run of this
         probe reported 12 kb of "payload" against a 7 kb step and could not
         tell the two answers apart. Noise gives the fixture a size worth
         measuring. The corners stay clean, because that is where section 2
         reads its one pixel. */
      var q = Math.round(size / 4);
      var im = g.createImageData(size - 2 * q, size - 2 * q);
      for (var i = 0; i < im.data.length; i += 4) {
        im.data[i] = (Math.random() * 256) | 0;
        im.data[i + 1] = (Math.random() * 256) | 0;
        im.data[i + 2] = (Math.random() * 256) | 0;
        im.data[i + 3] = 255;
      }
      g.putImageData(im, q, q);
      g.fillStyle = corner; g.fillRect(0, 0, q, q);
      return c;
    }
    /* flipY FALSE ON PURPOSE, which is what GLTFLoader hands every texture it
       makes. It keeps the whole chain an identity - canvas top-left, glTF
       top-left, store top-left - so section 2 is asking about THIS code and
       not about how GLTFExporter compensates for a flipped source. The flip
       branch is asked directly in section 7. */
    function tex(cvs, srgb) {
      var t = new THREE.CanvasTexture(cvs);
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.flipY = false;
      return t;
    }
    // One pixel out of a data URL, by fraction of the picture.
    function pixelAt(url, fx, fy) {
      return new Promise(function (res) {
        var im = new Image();
        im.onload = function () {
          var c = document.createElement('canvas');
          c.width = im.width; c.height = im.height;
          var g = c.getContext('2d');
          g.drawImage(im, 0, 0);
          var d = g.getImageData(Math.round(fx * (im.width - 1)),
                                 Math.round(fy * (im.height - 1)), 1, 1).data;
          res({ r: d[0], g: d[1], b: d[2], w: im.width, h: im.height });
        };
        im.onerror = function () { res(null); };
        im.src = url;
      });
    }
    var RED = function (p) { return p && p.r > 180 && p.g < 80 && p.b < 80; };
    var BLUE = function (p) { return p && p.b > 180 && p.r < 80; };

    /* ---- 1. a textured model, through the real landing ----

       NOT through GLTFLoader, and that is a measurement about the harness
       rather than about the app. The first version of this probe exported a
       .glb and pushed it back through importGltfBuffer - the honest round
       trip - and hung every single run: under `--virtual-time-budget` the
       loader's image decode never resolves, so the page timed out with
       nothing to say at all, which reads exactly like a build that will not
       start. (The watchdog above is what turned that into a sentence.)

       What this release changed lives in landImport's material mapping, and
       that is reachable without a file: collectImportableMeshes and
       editableFromImportedMeshes are the same two calls importGltfBuffer
       makes, and landImport is the shared landing every reader ends at. The
       fixture's textures carry flipY FALSE, which is what GLTFLoader hands
       every texture it makes, so the chain is the identity it would be
       through a real file - and the one line that turns a picture over is
       asked directly in section 7 instead. */
    clearScene();
    var libBefore = k.MATERIALS.size, storeBefore = k.TEX_STORE.size;
    var docBefore = k.serializeDoc();
    var bytesBefore = k.estimateDocBytes(docBefore);

    var colourSheet = sheet('#e02020', '#2040e0', 512);   // red corner, blue ground
    var normalSheet = sheet('#8080ff', '#8899ff', 512);
    var colourTex = tex(colourSheet, true);

    var grp = new THREE.Group();
    // TWO materials sharing ONE picture, which is what a real model does and
    // what section 3 is about.
    [['PaintA', 0xffffff, -1], ['PaintB', 0xffcc00, 1]].forEach(function (spec) {
      var m = new THREE.MeshStandardMaterial({
        name: spec[0], color: spec[1], roughness: 0.62, metalness: 0.15
      });
      m.map = colourTex;
      m.normalMap = tex(normalSheet, false);
      var mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), m);
      mesh.position.x = spec[2];
      grp.add(mesh);
    });
    mark('exporting glb');
    grp.updateMatrixWorld(true);
    mark('landing');
    var had = A.objects.length;
    var parts = k.collectImportableMeshes(grp, false);
    var built = [];
    parts.forEach(function (p) {
      var ed = k.editableFromImportedMeshes(p.meshes);
      if (ed && ed.groups.length) built.push({ name: p.name, ed: ed });
    });
    k.landImport(built, 'Textured');
    mark('landed');
    var added = A.objects.length - had;
    log('=== 1. a textured model goes through the real landing ===');
    log('  ' + built.length + ' part(s), ' + added +
      ' object(s), library ' + libBefore + ' -> ' + k.MATERIALS.size +
      ', store ' + storeBefore + ' -> ' + k.TEX_STORE.size);

    var objs = A.objects.slice(had);
    var mats = [];
    objs.forEach(function (o) { matsOf(o).forEach(function (m) { mats.push(m); }); });
    var withMap = mats.filter(function (m) { return !!m.map; });
    /* EVERY face, not one of them. Two cubes painted with two textured
       materials is twelve faces wearing a map; the first run of this probe
       printed TWO, which is how v2.33a's bug was found. three ignores
       geo.groups when a mesh carries a single material, and BoxGeometry
       builds six of them regardless - so five faces in six landed on Solid.
       The count is asserted rather than printed for exactly that reason. */
    log('  ' + withMap.length + ' of ' + mats.length + ' face materials carry a map');
    log(verdict(added > 0 && withMap.length === mats.length && mats.length >= 12,
      'every face the file painted arrived painted',
      withMap.length ? withMap.length + ' OF ' + mats.length +
        ' FACES GOT THE MATERIAL - the rest landed on Solid'
        : 'NOTHING CAME IN WITH A MAP (' + mats.length + ' materials, 0 with one)'));
    if (!withMap.length) { finishUp(); return; }

    /* ---- 2. bound the right way up, in the right space, at a size a phone
             can draw. Every one of these is a different way to be wrong. ---- */
    mark('section2');
    var m0 = withMap[0];
    var def0 = k.getMaterialDef(m0.userData.kubikDef);
    var baseKey = k.mapList(def0).base;
    var entry = k.TEX_STORE.get(baseKey);
    await settled(m0.map);
    var px = entry ? await pixelAt(entry.url, 0.05, 0.05) : null;
    var pxLow = entry ? await pixelAt(entry.url, 0.05, 0.95) : null;
    log('');
    log('=== 2. how it arrived ===');
    log('  definition "' + def0.name + '" carries ' +
      Object.keys(k.mapList(def0)).join(', '));
    log('  colour space ' + (m0.map.colorSpace === THREE.SRGBColorSpace ? 'sRGB' : String(m0.map.colorSpace || 'none')) +
      ', normal ' + (m0.normalMap ? (m0.normalMap.colorSpace === THREE.NoColorSpace ? 'none' : String(m0.normalMap.colorSpace)) : '(absent)') +
      ', flipY ' + m0.map.flipY + ', ' + (px ? px.w + 'x' + px.h : '?'));
    log('  top-left is rgb(' + (px ? [px.r, px.g, px.b].join(',') : '?') +
      '), bottom-left rgb(' + (pxLow ? [pxLow.r, pxLow.g, pxLow.b].join(',') : '?') + ')');
    log(verdict(!!baseKey && m0.map.colorSpace === THREE.SRGBColorSpace &&
      m0.normalMap && m0.normalMap.colorSpace === THREE.NoColorSpace &&
      m0.map.flipY === false && px && px.w <= k.TEX_MAX && px.h <= k.TEX_MAX &&
      RED(px) && BLUE(pxLow),
      'sRGB on colour, none on normal, not flipped, resampled, and the right way up',
      'WRONG: ' +
      (!baseKey ? 'no key on the definition; ' : '') +
      (m0.map.colorSpace !== THREE.SRGBColorSpace ? 'colour map is not sRGB; ' : '') +
      (!(m0.normalMap && m0.normalMap.colorSpace === THREE.NoColorSpace) ? 'normal map has a colour space; ' : '') +
      (m0.map.flipY !== false ? 'flipY is true; ' : '') +
      (px && (px.w > k.TEX_MAX || px.h > k.TEX_MAX) ? 'not resampled; ' : '') +
      (!(px && RED(px)) ? 'the marked corner is NOT at the top-left; ' : '') +
      (!(pxLow && BLUE(pxLow)) ? 'the bottom is not the ground colour; ' : '')));

    /* ---- 3. one picture, one entry, one upload ---- */
    var keys = {};
    k.MATERIALS.forEach(function (d) {
      Object.values(k.mapList(d)).forEach(function (x) { keys[x] = (keys[x] || 0) + 1; });
    });
    var shared = Object.keys(keys).filter(function (x) { return keys[x] > 1; });
    var texA = withMap[0].map, texB = withMap.length > 1 ? withMap[1].map : null;
    log('');
    log('=== 3. two materials, one picture ===');
    log('  ' + withMap.length + ' materials with a colour map, ' +
      Object.keys(keys).length + ' distinct keys, ' + shared.length + ' of them shared');
    log(verdict(withMap.length > 1 && shared.length > 0 && texA === texB,
      'the shared picture is one store entry and one THREE.Texture',
      withMap.length < 2 ? 'ONLY ONE MATERIAL CAME IN - this section tested nothing'
        : (shared.length ? 'TWO TEXTURE OBJECTS FOR ONE PICTURE' : 'THE KEY WAS NOT SHARED')));

    /* ---- 4. THE POINT OF THE WHOLE DESIGN: a step costs a reference ---- */
    var docAfter = k.serializeDoc();
    var bytesAfter = k.estimateDocBytes(docAfter);
    var payload = 0;
    Object.keys(keys).forEach(function (x) {
      var e = k.TEX_STORE.get(x); if (e) payload += e.url.length;
    });
    var plain = JSON.stringify(docAfter);
    log('');
    log('=== 4. what a history step costs ===');
    log('  ' + Math.round(payload / 1024) + 'kb of picture in the store, and the ' +
      'step grew by ' + (bytesAfter - bytesBefore) + ' bytes (two cubes included)');
    log(verdict(payload > 20000 && (bytesAfter - bytesBefore) < payload / 4 &&
      plain.indexOf('data:image/') < 0,
      'the step carries keys, and no picture is in it at all',
      (payload <= 20000 ? 'THE PICTURES ARE TOO SMALL TO TEST THIS (' + payload + ' bytes)' : '') +
      (plain.indexOf('data:image/') >= 0 ? ' A DATA URL IS IN THE SERIALISED DOC' : '') +
      ((bytesAfter - bytesBefore) >= payload / 4 ? ' THE STEP GREW BY THE PAYLOAD' : '')));

    /* ---- 5. and a FILE carries them, because it leaves this browser ---- */
    mark('section5');
    var docT = k.serializeDoc({ withTextures: true });
    var nT = docT.textures ? Object.keys(docT.textures).length : 0;
    log('');
    log('=== 5. the two doors ===');
    log('  plain doc: ' + Math.round(plain.length / 1024) + 'kb, no textures block. ' +
      'with textures: ' + nT + ' picture(s)');
    log(verdict(nT === Object.keys(keys).length && nT > 0 && !docAfter.textures,
      'a file is self-contained and a step is not',
      'EXPECTED ' + Object.keys(keys).length + ' PICTURES IN THE FILE, GOT ' + nT +
      (docAfter.textures ? ' - AND THE PLAIN DOC HAS A TEXTURES BLOCK' : '')));

    /* ---- 6. the round trip, with the session's memory taken away ----
       Deleting the store entries and the definitions is the only way to ask
       whether the FILE brought them back rather than whether they were still
       lying around from the import. */
    var docJson = JSON.parse(JSON.stringify(docT));
    var defIds = [];
    k.MATERIALS.forEach(function (d, id) { if (k.hasMaps(d)) defIds.push(id); });
    Object.keys(keys).forEach(function (x) { k.TEX_STORE.delete(x); });
    defIds.forEach(function (id) { k.MATERIALS.delete(id); });
    clearScene();
    var forgot = k.TEX_STORE.size;
    mark('restoring');
    k.restoreDoc(docJson);
    mark('restored');
    var back = [];
    A.objects.forEach(function (o) { matsOf(o).forEach(function (m) { if (m.map) back.push(m); }); });
    var backKey = back.length ? k.mapList(k.getMaterialDef(back[0].userData.kubikDef)).base : null;
    var backEntry = backKey ? k.TEX_STORE.get(backKey) : null;
    var backPx = backEntry ? await pixelAt(backEntry.url, 0.05, 0.05) : null;
    log('');
    log('=== 6. saved, forgotten, opened again ===');
    log('  store emptied to ' + forgot + ', ' + defIds.length +
      ' definition(s) deleted, then the file opened: ' + back.length +
      ' material(s) with a map, store ' + k.TEX_STORE.size);
    log(verdict(back.length > 0 && backKey && backEntry && RED(backPx),
      'the file brought its own pictures back, the same way up',
      back.length ? 'THE MAP CAME BACK EMPTY OR TURNED OVER' : 'NOTHING CAME BACK WITH A MAP'));

    /* ---- 6b. and back OUT again ----
       An import that keeps its pictures and an export that drops them is half
       a feature. What Kubik owns here is buildExportGroup: it clones every
       material and wipes the geometry's userData, and a clone that lost its
       maps - or a geometry that lost its uv - would leave GLTFExporter
       nothing to write. The exporter's own correctness is three's; this asks
       only about the group handed to it. */
    mark('section6b');
    /* CHECK THE FIXTURE FIRST. This section sits here, straight after the
       round trip, because it needs a textured model in the SCENE - and the
       first version of it sat after section 8, which clears the scene and
       stands up a cube with no UVs on purpose. It failed, and not one word of
       the failure was about the export. */
    var sceneWithMap = 0;
    A.objects.forEach(function (o) {
      matsOf(o).forEach(function (m) { if (m && m.map) sceneWithMap++; });
    });
    var group = k.buildExportGroup();
    var expMats = 0, expWithMap = 0, expNoUV = 0, expMeshes = 0;
    group.traverse(function (n) {
      if (!n.isMesh) return;
      expMeshes++;
      if (!n.geometry.getAttribute('uv')) expNoUV++;
      (Array.isArray(n.material) ? n.material : [n.material]).forEach(function (m) {
        if (!m) return;
        expMats++;
        if (m.map) expWithMap++;
      });
    });
    log('');
    log('=== 6b. what the exporter is handed ===');
    log('  ' + expMeshes + ' mesh(es), ' + expMats + ' material(s), ' +
      expWithMap + ' carrying a colour map, ' + expNoUV + ' without uv');
    log('  (the scene it was built from has ' + sceneWithMap + ' material(s) with a map)');
    log(verdict(sceneWithMap > 0 && expMeshes > 0 && expWithMap > 0 && expNoUV === 0,
      'the export group carries the pictures and the uv they need',
      (!sceneWithMap ? 'NOTHING TEXTURED WAS IN THE SCENE - this section tested nothing. ' : '') +
      (expWithMap ? '' : 'THE CLONES LOST THEIR MAPS - a textured model would export flat. ') +
      (expNoUV ? expNoUV + ' MESH(ES) LOST THEIR UV' : '')));

    /* ---- 6c. the bytes are not in localStorage any more ----
       Measured at 2.35: the origin quota is about 5,090kb and one 1024-square
       picture is about 1,162kb, so four of them filled it for the whole app.
       This asserts where they live now, and that the old road is closed. */
    mark('section6c');
    function idbKeys() {
      return new Promise(function (res) {
        var req;
        try { req = indexedDB.open(k.TEXDB_NAME, 1); } catch (e) { return res(null); }
        req.onsuccess = function () {
          var db = req.result, tx;
          try { tx = db.transaction(k.TEXDB_STORE, 'readonly'); } catch (e) { return res(null); }
          var g = tx.objectStore(k.TEXDB_STORE).getAllKeys();
          tx.oncomplete = function () { res(g.result || []); };
          tx.onerror = function () { res(null); };
        };
        req.onerror = function () { res(null); };
      });
    }
    k.saveTextureLibrary();
    await sleep(500);
    var stored = await idbKeys();
    var inUse = [];
    k.MATERIALS.forEach(function (d) {
      Object.values(k.mapList(d)).forEach(function (x) { if (inUse.indexOf(x) < 0) inUse.push(x); });
    });
    var missing = inUse.filter(function (x) { return !stored || stored.indexOf(x) < 0; });
    var lsLeft = 0;
    try { lsLeft = (localStorage.getItem('kubik.textures.v1') || '').length; } catch (e) {}
    log('');
    log('=== 6c. where the bytes live ===');
    log('  ' + inUse.length + ' pictures in use, ' + (stored ? stored.length : 'NO') +
      ' in IndexedDB, ' + lsLeft + ' bytes left in localStorage');
    log(verdict(!!stored && inUse.length > 0 && missing.length === 0 && lsLeft === 0,
      'the store is IndexedDB and the old road is closed',
      (!stored ? 'INDEXEDDB WAS NOT REACHABLE - this section tested nothing; ' : '') +
      (missing.length ? missing.length + ' PICTURE(S) NEVER REACHED THE STORE; ' : '') +
      (lsLeft ? 'localStorage STILL HOLDS ' + lsLeft + ' BYTES OF PICTURES' : '')));

    /* ---- 6d. and a reload finds them ----
       The cost of the move is that it is async: the pictures arrive after the
       first frame. Forgetting the store and loading it again is the closest a
       probe gets to a reload, and what it has to show is not just that the
       bytes came back but that the MATERIAL was told - a picture nobody
       re-binds is a picture nobody sees. */
    mark('section6d');
    var beforeKey = inUse[0];
    var wasBound = 0;
    A.objects.forEach(function (o) {
      matsOf(o).forEach(function (m) { if (m && m.map) wasBound++; });
    });
    k.TEX_STORE.clear();
    /* AND TAKE THE PICTURES OFF BY HAND. Forgetting the store does not unbind
       anything - the material holds its own THREE.Texture - so without this
       the count was 12 -> 12 no matter what the app did, and a build with
       updateMaterialEverywhere torn out sailed through. Flat materials and an
       empty store is the state a real reload's first frame is in. */
    A.objects.forEach(function (o) {
      matsOf(o).forEach(function (m) {
        if (m && m.map) { m.map = null; m.needsUpdate = true; }
      });
    });
    var boundBefore = 0;
    A.objects.forEach(function (o) {
      matsOf(o).forEach(function (m) { if (m && m.map) boundBefore++; });
    });
    k.loadTextureLibrary();
    for (var w6 = 0; w6 < 150 && !k.TEX_STORE.has(beforeKey); w6++) await sleep(20);
    await sleep(200);
    var boundAfter = 0;
    A.objects.forEach(function (o) {
      matsOf(o).forEach(function (m) { if (m && m.map) boundAfter++; });
    });
    log('');
    log('=== 6d. forgetting the store, and loading it again ===');
    log('  store ' + k.TEX_STORE.size + ' back, materials with a map ' +
      wasBound + ' -> ' + boundBefore + ' (unbound by hand) -> ' + boundAfter);
    log(verdict(k.TEX_STORE.has(beforeKey) && wasBound > 0 && boundBefore === 0 &&
      boundAfter >= wasBound,
      'the pictures came back and the materials were told',
      (!wasBound ? 'NOTHING WAS BOUND TO BEGIN WITH - this section tested nothing; ' : '') +
      (boundBefore ? 'THE UNBIND DID NOT TAKE - this section tested nothing; ' : '') +
      (!k.TEX_STORE.has(beforeKey) ? 'THE BYTES DID NOT COME BACK; ' : '') +
      (boundAfter < wasBound ? 'THEY CAME BACK AND NOTHING RE-BOUND THEM - a picture nobody sees' : '')));

    /* ---- 7. the flip branch, asked directly ----
       Section 2 is an identity chain on purpose, so the one line that turns a
       picture over has no test in it. This is that line. */
    mark('section7');
    var upTex = tex(sheet('#e02020', '#2040e0', 128), true);
    upTex.flipY = true;
    var upUrl = k.encodeImportTexture(upTex, { key: 'base' }, { transparent: false });
    var upTop = upUrl ? await pixelAt(upUrl, 0.05, 0.05) : null;
    var upBot = upUrl ? await pixelAt(upUrl, 0.05, 0.95) : null;
    log('');
    log('=== 7. a source that wants flipping ===');
    log('  top rgb(' + (upTop ? [upTop.r, upTop.g, upTop.b].join(',') : '?') +
      '), bottom rgb(' + (upBot ? [upBot.r, upBot.g, upBot.b].join(',') : '?') + ')');
    log(verdict(!!upUrl && BLUE(upTop) && RED(upBot),
      'flipY on the source turns the stored picture over exactly once',
      'THE FLIP DID NOT HAPPEN, OR HAPPENED TWICE'));

    /* ---- 8. a mesh with no UVs must not be painted in one corner texel ----
       This is the section most at risk of testing nothing, so it checks its
       own fixture first: a primitive that turns out to HAVE uvs would pass
       this vacuously. */
    var texDef = null;
    k.MATERIALS.forEach(function (d, id) { if (!texDef && k.hasMaps(d)) texDef = id; });
    clearScene();
    var ed = k.buildPrimitiveEditable('cube', {});
    var ms = k.makeMaterialSet(ed.groups.length, 0x9aa3ad, null);
    var plainObj = k.createObjectFromEditable('cube', new V3(0, 0, 0), ed, ms, {});
    var noUV = !plainObj.mesh.geometry.getAttribute('uv');
    plainObj.mesh.userData.finishes = {};
    for (var gi = 0; gi < k.faceCount(plainObj.mesh.geometry); gi++) {
      plainObj.mesh.userData.finishes[gi] = texDef;
    }
    mark('section8');
    k.dressFromPool(plainObj);
    var pm = matsOf(plainObj)[0];
    log('');
    log('=== 8. the same material on a mesh with no UVs ===');
    log('  fixture has uv attribute: ' + (!noUV) + ', definition ' + texDef +
      ', material bound map: ' + (pm && pm.map ? 'yes' : 'no'));
    log(verdict(!!texDef && noUV && pm && !pm.map,
      'an unwrapped mesh gets an instance with nothing bound',
      !texDef ? 'NO TEXTURED DEFINITION SURVIVED TO TEST WITH' :
        !noUV ? 'THE FIXTURE HAS UVs - THIS SECTION TESTED NOTHING' :
          'A MAP WAS BOUND ON A MESH WITH NO UVs'));

    /* ---- 9. the second and third explicit field lists ----
       A definition is copied by hand in three places - materialDefSig,
       saveMaterialLibrary's preset overrides, and the tray's + button - and a
       field that is not added to all three is silently dropped by whichever
       one was missed. Review found `maps` missing from two of them. This is
       the library round trip; the fork is section 9b. */
    mark('section9');
    var texDefId = null;
    k.MATERIALS.forEach(function (d, id) { if (!texDefId && k.hasMaps(d)) texDefId = id; });
    var texMaps = texDefId ? k.mapList(k.getMaterialDef(texDefId)) : {};
    // A PRESET carrying a map is the list that was actually wrong.
    var preset = k.getMaterialDef('metal');
    preset.maps = { base: texMaps.base };
    k.saveMaterialLibrary();
    var rawLib = JSON.parse(localStorage.getItem('kubik.materials.v1') || '{}');
    var ovr = (rawLib.presetOverrides || {}).metal;
    var cust = (rawLib.customs || []).filter(function (d) { return d.id === texDefId; })[0];
    delete preset.maps;
    k.saveMaterialLibrary();
    log('');
    log('=== 9. the library writes every field a definition has ===');
    log('  preset override carries maps: ' + !!(ovr && ovr.maps && ovr.maps.base) +
      ', custom carries maps: ' + !!(cust && cust.maps && cust.maps.base));
    log(verdict(!!(ovr && ovr.maps && ovr.maps.base) && !!(cust && cust.maps && cust.maps.base),
      'a preset override and a custom both keep their pictures across a save',
      'A DEFINITION LOST ITS MAPS ON THE WAY INTO localStorage'));

    /* ---- 9b. the fork, driven through the real button ---- */
    mark('section9b');
    var libWas = k.MATERIALS.size, forked = null;
    try { k.buildMatTray(); } catch (e9) { errs.push('buildMatTray: ' + e9.message); }
    var addBtn = document.querySelector('.mat-card.add');
    if (addBtn) {
      k.MATERIALS.forEach(function (d, id) { if (id === texDefId) d._probe = 1; });
      // The + copies the SELECTION's finish, so the selection has to be
      // wearing the textured one for this to test anything.
      A.objects.forEach(function (o) {
        var fin = o.mesh.userData.finishes || {};
        Object.keys(fin).forEach(function (g) { fin[g] = texDefId; });
      });
      A.selectedObjectIds = new Set(A.objects.map(function (o) { return o.id; }));
      A.activeObjectId = A.objects.length ? A.objects[0].id : null;
      k.setMode('object');
      addBtn.click();
      k.MATERIALS.forEach(function (d, id) {
        if (!forked && k.MATERIALS.size > libWas && !d.preset && /^Material /.test(d.name || '')) forked = d;
      });
    }
    log('');
    log('=== 9b. forking a textured material ===');
    log('  + button found: ' + !!addBtn + ', new definition: ' +
      (forked ? forked.name + ' carrying ' + Object.keys(k.mapList(forked)).join(',') : '(none)'));
    log(verdict(!!addBtn && !!forked && k.hasMaps(forked),
      'the fork kept the pictures that made it worth forking',
      !addBtn ? 'NO + BUTTON IN THE TRAY - this section tested nothing' :
        !forked ? 'THE FORK DID NOT HAPPEN - this section tested nothing' :
          'THE FORK CAME OUT WITHOUT ITS MAPS'));

    /* ---- 10. an opaque picture is JPEG, one with holes is PNG ----
       The first version chose by the MATERIAL's flags, so an OPAQUE glTF
       carrying a base colour with a real alpha channel had its see-through
       texels composited against white - a silent content change. */
    mark('section10');
    var solid = k.encodeImportTexture(tex(sheet('#e02020', '#2040e0', 128), true),
      { key: 'base' }, { transparent: false });
    var holed = document.createElement('canvas');
    holed.width = holed.height = 128;
    var hg = holed.getContext('2d');
    hg.fillStyle = 'rgba(224,32,32,0.25)'; hg.fillRect(0, 0, 128, 128);
    var cut = k.encodeImportTexture(tex(holed, true), { key: 'base' }, { transparent: false });
    log('');
    log('=== 10. what the encoder chooses ===');
    log('  opaque -> ' + (solid || '').slice(5, 15) + ', with alpha -> ' + (cut || '').slice(5, 15));
    log(verdict(/^data:image\/jpeg/.test(solid || '') && /^data:image\/png/.test(cut || ''),
      'the pixels decide, not the material flags',
      'THE ENCODER CHOSE THE WRONG FORMAT - alpha would be flattened against white'));

    /* ---- 11. an emissive map that can actually show ----
       three multiplies emissiveMap by material.emissive, which starts black. */
    mark('section11');
    var em = new THREE.MeshStandardMaterial();
    k.applyMaps(em, { maps: { emissive: texMaps.base } }, false);
    var emLit = em.emissive.getHex();
    k.applyMaps(em, { maps: {} }, false);
    var emOff = em.emissive.getHex();
    log('');
    log('=== 11. an emissive map multiplies by something ===');
    log('  with a map emissive is #' + emLit.toString(16) + ', without it #' + emOff.toString(16));
    log(verdict(emLit === 0xffffff && emOff === 0,
      'the map is the emission, and goes back to nothing when it is taken off',
      'AN EMISSIVE MAP WOULD BE MULTIPLIED BY BLACK'));

    /* ---- 12. the pool still retires a private instance ----
       disposeObject retires an object's own instances by SUFFIX, so where the
       new key leg sits decides whether they are ever freed. */
    mark('section12');
    var pm1 = k.pooledMaterial(texDefId, THREE.FrontSide, 'obj_probe', true);
    k.prunePool(null, '|obj_probe');
    var pm2 = k.pooledMaterial(texDefId, THREE.FrontSide, 'obj_probe', true);
    log('');
    log('=== 12. a private instance of a textured, unwrapped mesh ===');
    log('  retired and re-made: ' + (pm1 !== pm2));
    log(verdict(pm1 !== pm2,
      'an object taking its private instance away actually frees it',
      'THE INSTANCE SURVIVED prunePool - it would leak for the session'));

    /* ---- 12c. the editor's own door ----
       DRIVEN THROUGH THE REAL CONTROLS, not through the functions behind
       them. a2.78 passed twelve sections against a worker while the tool
       itself was broken in six places, all of them in the controls - so this
       opens the editor, clicks the chips and fires the file input. */
    mark('section12c');
    var editId = null;
    k.MATERIALS.forEach(function (d, i) { if (!editId && !d.preset && !k.hasMaps(d)) editId = i; });
    if (!editId) {
      editId = 'mp_probe';
      k.MATERIALS.set(editId, { id: editId, preset: false, name: 'Picker probe',
        color: '#8899aa', roughness: 0.5, metalness: 0 });
    }
    var beforeSig = k.materialDefSig(k.getMaterialDef(editId));
    k.openMatEditor(editId);
    var chipRow = document.getElementById('mpChips');
    var chips = chipRow ? Array.prototype.slice.call(chipRow.querySelectorAll('button')) : [];
    var labels = chips.map(function (b) { return b.dataset.slot; }).join(',');

    // A File, made here, handed to the real <input type="file">. Declared
    // with `function` so the sections below reach it too.
    function fileFrom(cvs) {
      return new Promise(function (res) {
        cvs.toBlob(function (b) { res(new File([b], 'probe.png', { type: b.type })); }, 'image/png');
      });
    }
    function handTo(input, file) {
      var dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    var picked = await fileFrom(sheet('#20c020', '#203080', 128));
    // The normal channel, deliberately: it is the one the encoder treats
    // differently, and picking the first chip would not have said so.
    var normalChip = chips.filter(function (b) { return b.dataset.slot === 'normal'; })[0];
    if (normalChip) normalChip.click();
    var onNormal = k.mpEditing;
    handTo(document.getElementById('mpFile'), picked);
    var def2 = k.getMaterialDef(editId);
    for (var t2 = 0; t2 < 150 && !(def2.maps && def2.maps.normal); t2++) await sleep(20);
    var gotKey = def2.maps && def2.maps.normal;
    var gotEntry = gotKey ? k.TEX_STORE.get(gotKey) : null;
    var chipsAfter = Array.prototype.slice.call(chipRow.querySelectorAll('button'));
    var dotted = chipsAfter.filter(function (b) { return /\u2022/.test(b.textContent); })
      .map(function (b) { return b.dataset.slot; }).join(',');
    log('');
    log('=== 12c. assigning a picture in the editor ===');
    log('  chips: ' + labels + ', editing slot ' + onNormal);
    log('  after the pick: key ' + (gotKey ? 'set' : 'MISSING') + ', dotted chips [' + dotted + ']' +
      ', stored as ' + (gotEntry ? gotEntry.url.slice(5, 15) : '?'));
    log(verdict(chips.length === 6 && labels === 'base,normal,rough,metal,ao,emissive' &&
      !!gotKey && dotted === 'normal' && gotEntry &&
      /^data:image\/png/.test(gotEntry.url),
      'the picker put the picture on the channel that was open, and said so',
      (chips.length !== 6 ? 'THE CHIP ROW IS ' + chips.length + ' LONG; ' : '') +
      (!gotKey ? 'NOTHING LANDED ON THE DEFINITION; ' : '') +
      (dotted !== 'normal' ? 'THE DOTS SAY [' + dotted + ']; ' : '') +
      (gotEntry && !/^data:image\/png/.test(gotEntry.url) ? 'A NORMAL MAP WAS ENCODED AS JPEG' : '')));

    /* ---- 12d. and taking it off again leaves NO trace ----
       A definition that has had every picture removed has to sign exactly
       like one that never had any, or it stops matching itself across a file
       and mints a copy on the next open - the a2.65a failure, which this
       release has already had to design around once. */
    mark('section12d');
    document.getElementById('mpClear').click();
    var def3 = k.getMaterialDef(editId);
    var afterSig = k.materialDefSig(def3);
    log('');
    log('=== 12d. and taking it off again ===');
    log('  maps key present after removal: ' + ('maps' in def3) +
      ', signature ' + (afterSig === beforeSig ? 'unchanged' : 'MOVED'));
    log(verdict(!('maps' in def3) && afterSig === beforeSig,
      'the material signs exactly as it did before it ever had a picture',
      ('maps' in def3 ? 'AN EMPTY maps KEY WAS LEFT BEHIND; ' : '') +
      (afterSig !== beforeSig ? 'THE SIGNATURE MOVED - it would mint a copy of itself on the next open' : '')));

    /* ---- 12e. two picks, and the document that has to know ----
       Both halves are review findings. A second pick used to land in DECODE
       order rather than pick order, so a big photo chosen first could arrive
       last and overwrite the small one chosen instead of it. And nothing in
       this editor ever scheduled an autosave, so the last autosaved document
       predated every change made here - which on reload does not lose a
       tweak, it mints "Solid (imported)" and repoints every face. */
    mark('section12e');
    k.openMatEditor('metal');
    var row2 = document.getElementById('mpChips');
    var baseChip = Array.prototype.slice.call(row2.querySelectorAll('button'))
      .filter(function (b) { return b.dataset.slot === 'base'; })[0];
    if (baseChip) baseChip.click();
    // The FIRST one is big and noisy on purpose: it has to be the slower
    // decode, or "the last pick wins" would pass by luck on a build that
    // simply takes whichever finishes last.
    var slowPick = await fileFrom(sheet('#e02020', '#2040e0', 1024));
    var fastPick = await fileFrom(sheet('#20c020', '#101010', 32));
    /* THE KEY IS CLEARED FIRST, AND ONLY AFTER ANY PENDING WRITE HAS FIRED.
       Without this the check passed on the build that never schedules one:
       landImport pushes a history step several sections ago, that schedules
       an autosave on a 900ms debounce, and it lands after this edit and
       writes the map out anyway. The question is whether THIS editor tells
       the document, so the document has to be empty when it is asked. */
    await sleep(1200);
    try { localStorage.removeItem('kubik.autosave'); } catch (e) {}
    var input2 = document.getElementById('mpFile');
    handTo(input2, slowPick);
    handTo(input2, fastPick);
    await sleep(1400);                 // both decodes, and the 900ms autosave
    var metal = k.getMaterialDef('metal');
    var mEntry = metal.maps && metal.maps.base ? k.TEX_STORE.get(metal.maps.base) : null;
    var mPix = mEntry ? await pixelAt(mEntry.url, 0.05, 0.05) : null;
    var GREEN = !!mPix && mPix.g > 150 && mPix.r < 90;
    var saved = '';
    try { saved = localStorage.getItem('kubik.autosave') || ''; } catch (e) { saved = ''; }
    var inDoc = !!(metal.maps && metal.maps.base) && saved.indexOf(metal.maps.base) >= 0;
    log('');
    log('=== 12e. two picks, and the autosave ===');
    log('  landed: ' + (mPix ? 'rgb(' + [mPix.r, mPix.g, mPix.b].join(',') + ')' : 'nothing') +
      ' - the second pick is green, the first is red');
    log('  the autosaved document names the key: ' + inDoc);
    log(verdict(GREEN && inDoc,
      'the pick you made last is the one you get, and the document knows about it',
      (!mPix ? 'NO PICTURE LANDED AT ALL; ' : '') +
      (mPix && !GREEN ? 'THE FIRST PICK OVERWROTE THE SECOND; ' : '') +
      (!inDoc ? 'THE AUTOSAVE PREDATES THE EDIT - a reload would mint a copy of this material' : '')));

    /* ---- 12f. and Reset really resets ----
       MATERIAL_DEFAULTS has no `maps` key, so Object.assign cannot clear one:
       a preset kept its picture through a Reset that said "Reset to default",
       and went on failing to match stock in every file opened afterwards. */
    mark('section12f');
    var stockSig = k.materialDefSig(Object.assign({ id: 'metal', preset: true },
      k.MATERIAL_DEFAULTS.metal));
    document.getElementById('meReset').click();
    var metal2 = k.getMaterialDef('metal');
    var prevEl = document.getElementById('mpPrev');
    log('');
    log('=== 12f. Reset takes the picture off too ===');
    log('  maps key after Reset: ' + ('maps' in metal2) +
      ', signature ' + (k.materialDefSig(metal2) === stockSig ? 'back to stock' : 'STILL MOVED') +
      ', preview src attribute: ' + (prevEl.hasAttribute('src') ? 'set' : 'none'));
    log(verdict(!('maps' in metal2) && k.materialDefSig(metal2) === stockSig &&
      !prevEl.hasAttribute('src'),
      'a reset preset is stock again, down to its signature',
      ('maps' in metal2 ? 'THE PICTURE SURVIVED THE RESET; ' : '') +
      (k.materialDefSig(metal2) !== stockSig ? 'THE SIGNATURE IS NOT STOCK; ' : '') +
      (prevEl.hasAttribute('src') ? 'AN EMPTY PREVIEW STILL CARRIES src - that is a fetch of index.html' : '')));

    /* ---- 13. deleting the material frees the pictures ---- */
    mark('section13');
    var hadStore = k.TEX_STORE.size;
    var doomed = [];
    k.MATERIALS.forEach(function (d, id) { if (k.hasMaps(d)) doomed.push(id); });
    doomed.forEach(function (id) { k.MATERIALS.delete(id); });
    k.pruneTextures();
    log('');
    log('=== 13. nothing wears them any more ===');
    log('  ' + doomed.length + ' definition(s) deleted, store ' + hadStore +
      ' -> ' + k.TEX_STORE.size);
    log(verdict(doomed.length > 0 && k.TEX_STORE.size === 0,
      'the store empties when the last wearer goes',
      doomed.length ? 'THE PICTURES ARE STILL HELD (' + k.TEX_STORE.size + ')'
        : 'NOTHING TEXTURED SURVIVED TO DELETE - this section tested nothing'));

    /* ---- 14. the one step that could carry pictures ---- */
    mark('section14');
    var fake = { objects: [], materialLib: [], textures: { a: { url: 'data:image/png;base64,' + new Array(5000).join('A') } } };
    var counted = k.estimateDocBytes(fake);
    var stripped = k.stripDocTextures(fake);
    log('');
    log('=== 14. a document that IS carrying pictures ===');
    log('  estimateDocBytes sees ' + counted + ' bytes, stripDocTextures leaves ' +
      (stripped.textures ? 'them' : 'none'));
    log(verdict(counted > 4000 && !stripped.textures && !!fake.textures,
      'the accounting can see them and the history is given a copy without them',
      (counted <= 4000 ? 'THE PICTURES ARE INVISIBLE TO THE HISTORY CAP; ' : '') +
      (stripped.textures ? 'STRIP DID NOTHING; ' : '') +
      (!fake.textures ? 'STRIP MUTATED THE ORIGINAL' : '')));

    finishUp();
  }

  function finishUp() {
    if (done) return;
    done = true;
    out.push('');
    if (hardFail) out.push('DID NOT FINISH: ' + hardFail);
    out.push('VERDICT=' + ((fails || hardFail) ?
      'FAIL (' + (fails + (hardFail ? 1 : 0)) + ')' : 'PASS'));
    out.push('page.errors=' + (errs.length ? errs.join(' | ').slice(0, 400) : 'none'));
    var pre = document.createElement('pre');
    pre.id = 'probeOut';
    pre.textContent = '<<<PROBE\n' + out.join('\n') + '\nPROBE>>>';
    document.body.appendChild(pre);
    document.title = 'PROBE-DONE';
    try {
      var x = new XMLHttpRequest();
      x.open('POST', '/__probe', true);
      x.send(out.join('\n'));
    } catch (e) {}
  }
  function ready(cb, t) {
    t = t || 0;
    if (window.__kubik && window.__kubik.App && window.__kubik.App.objects) return cb();
    if (t > 300) { hardFail = 'the app never came up'; out.push('ERROR=no __kubik'); return finishUp(); }
    setTimeout(function () { ready(cb, t + 1); }, 20);
  }
  setTimeout(function () {
    ready(function () {
      setTimeout(function () {
        main().catch(function (e) {
          hardFail = 'it threw';
          out.push('ERROR=' + (e && e.stack ? e.stack.split('\n').slice(0, 8).join(' / ') : e));
          finishUp();
        });
      }, 600);
    });
  }, 300);
})();
