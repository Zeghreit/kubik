/* "Save under a name holds a textured model" - measure it, do not reason
   about it.

   The claim v2.37 makes is not "projects use IndexedDB now". It is:

     the bytes are THERE      - in IndexedDB, and NOT still in localStorage,
                                because a move that is really a copy leaves
                                the old five-megabyte ceiling exactly where
                                it was and nobody finds out until it bites
     the model is WHOLE       - the record carries its own pictures, so it
                                opens painted rather than flat
     the wall is GONE         - a model that measured as too big at 2.35
                                actually saves, asserted in bytes
     nothing was LOST moving  - a record left in localStorage by an
                                interrupted migration still lists, still
                                opens, and still deletes

   Every section asks its own fixture first, because the lesson from
   _texchk is that a section which cannot reach its subject passes. */
(function () {
  var out = [], errs = [], fails = 0, done = false, at = 'start', hardFail = '';
  window.addEventListener('error', function (e) { errs.push(e.message); });
  window.addEventListener('unhandledrejection', function (e) {
    errs.push('rejected: ' + (e.reason && e.reason.message ? e.reason.message : e.reason));
  });
  setTimeout(function () {
    if (!done) { hardFail = 'the probe hung at ' + at; out.push('WATCHDOG at ' + at); finishUp(); }
  }, 150000);
  function log(s) { out.push(s); }
  function mark(s) { at = s; }
  function verdict(ok, good, bad) { if (!ok) fails++; return ok ? '  ok  ' + good : '  FAIL ' + bad; }
  function kb(n) { return Math.round(n / 1024) + 'kb'; }

  async function main() {
    var k = window.__kubik, A = k.App, THREE = k.THREE;

    function clearScene() { A.objects.slice().forEach(function (o) { k.removeObjects([o]); }); }
    function matsOf(o) {
      return Array.isArray(o.mesh.material) ? o.mesh.material : [o.mesh.material];
    }
    function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    function boundCount() {
      var n = 0;
      A.objects.forEach(function (o) {
        matsOf(o).forEach(function (m) { if (m && m.map) n++; });
      });
      return n;
    }
    /* LOOK IN THE DATABASE, not at the list. The list merges both roads on
       purpose, so it says "the model is there" whichever road it is on -
       which is right for the user and useless for telling moved from copied.
       This opens IndexedDB itself. */
    function idbGet(store, key) {
      return new Promise(function (res) {
        var req;
        try { req = indexedDB.open(k.TEXDB_NAME); } catch (e) { return res(undefined); }
        req.onsuccess = function () {
          var db = req.result, tx;
          try { tx = db.transaction(store, 'readonly'); } catch (e) { return res(undefined); }
          var g;
          try { g = key === null ? tx.objectStore(store).getAllKeys()
                                 : tx.objectStore(store).get(key); }
          catch (e) { return res(undefined); }
          tx.oncomplete = function () { res(g.result); };
          tx.onerror = tx.onabort = function () { res(undefined); };
        };
        req.onerror = req.onblocked = function () { res(undefined); };
      });
    }
    function lsLen(key) {
      try { return (localStorage.getItem(key) || '').length; } catch (e) { return 0; }
    }
    /* A sheet with a corner you can name and noise in the middle, so a record
       has a size worth measuring and "is it the right picture" is one pixel.
       Straight out of _texchk, and for the same two reasons. */
    function sheet(corner, ground, size) {
      var c = document.createElement('canvas');
      c.width = c.height = size;
      var g = c.getContext('2d');
      g.fillStyle = ground; g.fillRect(0, 0, size, size);
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
    /* NOISE EDGE TO EDGE. `sheet` leaves flat colour round a noisy middle,
       which JPEG compresses away - a fixture built from it weighed 2,570kb
       where the 2.35 measurement of six real maps said about 7,000kb, so the
       section that has to clear the old ceiling could not. A real roughness
       or AO bake has detail everywhere; this is that, to an encoder. */
    function noisySheet(size) {
      var c = document.createElement('canvas');
      c.width = c.height = size;
      var g = c.getContext('2d');
      var im = g.createImageData(size, size);
      for (var i = 0; i < im.data.length; i += 4) {
        im.data[i] = (Math.random() * 256) | 0;
        im.data[i + 1] = (Math.random() * 256) | 0;
        im.data[i + 2] = (Math.random() * 256) | 0;
        im.data[i + 3] = 255;
      }
      g.putImageData(im, 0, 0);
      return c;
    }
    function tex(cvs, srgb) {
      var t = new THREE.CanvasTexture(cvs);
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.flipY = false;
      return t;
    }
    // Two cubes, two materials, a shared colour map and a normal map each -
    // through the real landing, the same way _texchk builds its fixture.
    function landTextured(size) {
      var colourSheet = sheet('#e02020', '#2040e0', size);
      var normalSheet = sheet('#8080ff', '#8899ff', size);
      var colourTex = tex(colourSheet, true);
      var grp = new THREE.Group();
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
      grp.updateMatrixWorld(true);
      var built = [];
      k.collectImportableMeshes(grp, false).forEach(function (p) {
        var ed = k.editableFromImportedMeshes(p.meshes);
        if (ed && ed.groups.length) built.push({ name: p.name, ed: ed });
      });
      k.landImport(built, 'Textured');
    }

    /* ---- 1. a textured model saves under a name, and the bytes are in
             IndexedDB ---- */
    mark('section1');
    clearScene();
    // Anything a previous run left behind, so section 1 is about this run.
    await k.deleteProject('Alpha');
    landTextured(512);
    var bound1 = boundCount();
    var saved = await k.saveProject('Alpha');
    await sleep(200);
    var rec = await idbGet(k.DOCDB_STORE, 'Alpha');
    var leftInLs = lsLen(k.PROJECT_PREFIX + 'Alpha');
    log('=== 1. a textured model saves under a name ===');
    log('  ' + bound1 + ' face material(s) wearing a map, saveProject returned ' + saved);
    log('  in IndexedDB: ' + (rec ? 'yes, ' + kb(JSON.stringify(rec).length) : 'NO') +
      ', left in localStorage: ' + leftInLs + ' bytes');
    log(verdict(bound1 >= 12 && saved === true && !!rec && !!rec.doc && leftInLs === 0,
      'the record is in IndexedDB and the old road is closed',
      (bound1 < 12 ? 'THE FIXTURE WAS NOT TEXTURED (' + bound1 + ') - this section tested nothing; ' : '') +
      (saved !== true ? 'SAVE REFUSED; ' : '') +
      (!rec || !rec.doc ? 'NOTHING REACHED THE DATABASE; ' : '') +
      (leftInLs ? 'localStorage STILL HOLDS ' + leftInLs + ' BYTES OF IT' : '')));

    /* ---- 2. and the record is self-contained ----
       The whole reason a named save uses withTextures. A record that names
       keys and carries no bytes opens flat the moment the library is a
       different one - which is exactly what "open it on another machine"
       means, and what the .json door exists for. */
    mark('section2');
    var docKeys = [];
    if (rec && rec.doc && rec.doc.materialLib) {
      rec.doc.materialLib.forEach(function (d) {
        Object.values(k.mapList(d) || {}).forEach(function (x) {
          if (docKeys.indexOf(x) < 0) docKeys.push(x);
        });
      });
    }
    var carried = rec && rec.doc && rec.doc.textures ? Object.keys(rec.doc.textures) : [];
    var absent = docKeys.filter(function (x) { return carried.indexOf(x) < 0; });
    log('');
    log('=== 2. the record carries its own pictures ===');
    log('  its materials name ' + docKeys.length + ' key(s), it carries ' +
      carried.length + ' picture(s)');
    log(verdict(docKeys.length > 0 && absent.length === 0,
      'a saved model is whole, not a list of references',
      (!docKeys.length ? 'NO MATERIAL IN THE RECORD NAMES A PICTURE - this section tested nothing; ' : '') +
      (absent.length ? absent.length + ' KEY(S) HAVE NO BYTES IN THE RECORD - it would open flat' : '')));

    /* ---- 3. forget everything, and open it by name ---- */
    mark('section3');
    clearScene();
    k.TEX_STORE.clear();
    A.objects.forEach(function (o) {
      matsOf(o).forEach(function (m) { if (m && m.map) { m.map = null; m.needsUpdate = true; } });
    });
    await k.loadProject('Alpha');
    await sleep(300);
    var bound3 = boundCount();
    log('');
    log('=== 3. opened again from nothing ===');
    log('  objects ' + A.objects.length + ', store ' + k.TEX_STORE.size +
      ', face materials with a map ' + bound3 + ' (was ' + bound1 + ')');
    log(verdict(A.objects.length > 0 && k.TEX_STORE.size > 0 && bound3 >= bound1,
      'the model came back painted',
      (!A.objects.length ? 'NOTHING CAME BACK; ' : '') +
      (!k.TEX_STORE.size ? 'THE STORE IS EMPTY - the record carried no bytes; ' : '') +
      (bound3 < bound1 ? 'IT CAME BACK FLAT (' + bound3 + ' of ' + bound1 + ')' : '')));

    /* ---- 4. the wall this version exists to remove ----
       Measured at 2.35: the localStorage ceiling is about 5,090kb and a 1024
       picture costs about 1,162kb, so a character with two materials and
       four maps each could not be saved under a name at all. This builds a
       record past that ceiling and asserts it lands. */
    mark('section4');
    clearScene();
    await k.deleteProject('Big');
    landTextured(1024);
    /* Four more 1024 pictures on top, which is the shape that did not fit -
       assigned through the real door so they are held the way the app holds
       them rather than pushed into the store by hand. */
    /* OFF A MATERIAL THAT IS ON SCREEN. MATERIALS still holds section 1's
       definitions - clearScene removes objects, not definitions - so asking
       the library for "the first one with maps" hands back something nothing
       wears, and serializeDoc rightly leaves its pictures out. */
    var defBig = null;
    A.objects.forEach(function (o) {
      matsOf(o).forEach(function (m) {
        if (defBig || !m || !m.userData || !m.userData.kubikDef) return;
        var d = k.liveMaterialDef ? k.liveMaterialDef(m.userData.kubikDef)
                                  : k.MATERIALS.get(m.userData.kubikDef);
        if (d && k.hasMaps(d)) defBig = d;
      });
    });
    if (defBig) {
      ['rough', 'metal', 'ao', 'emissive'].forEach(function (slot) {
        var url = k.encodePicture(noisySheet(1024), 1024, 1024, slot, false);
        if (!url) return;
        var key = k.registerTexture(url, {});
        if (key) { defBig.maps = defBig.maps || {}; defBig.maps[slot] = key; }
      });
      k.updateMaterialEverywhere(defBig.id);
    }
    var storeBytes = 0;
    k.TEX_STORE.forEach(function (e) { storeBytes += (e.url || '').length; });
    var savedBig = await k.saveProject('Big');
    await sleep(400);
    var recBig = await idbGet(k.DOCDB_STORE, 'Big');
    var bigBytes = recBig ? JSON.stringify(recBig).length : 0;
    log('');
    log('=== 4. a model the old ceiling could not hold ===');
    var bigCarried = recBig && recBig.doc && recBig.doc.textures
      ? Object.keys(recBig.doc.textures).length : 0;
    log('  the worn definition carries ' +
      (defBig ? Object.keys(k.mapList(defBig) || {}).length : 0) +
      ' map(s); the record carries ' + bigCarried + ' picture(s)');
    log('  store holds ' + kb(storeBytes) + ' of picture, the record weighs ' + kb(bigBytes));
    log('  (the measured localStorage ceiling at 2.35 was about 5090kb for the whole origin)');
    log(verdict(savedBig === true && bigBytes > 5090 * 1024,
      'a model past the old ceiling saves under a name',
      (savedBig !== true ? 'THE SAVE REFUSED; ' : '') +
      (bigBytes <= 5090 * 1024 ? 'THE FIXTURE IS ONLY ' + kb(bigBytes) +
        ' - it would have fitted the old road, so this section tested nothing' : '')));

    /* ---- 5. a record the migration has not reached yet ----
       The interrupted-migration case, and the one that can lose a model. It
       must still list, still open, and still delete - from the road it is
       actually on. */
    mark('section5');
    /* NO PICTURES IN THIS ONE. It goes into localStorage, and the scene at
       this point is section 4's 5,495kb model - which is precisely what no
       longer fits there. What 5, 6 and 7 ask about is the road, not the
       payload. */
    var legacyDoc = { savedAt: Date.now(), doc: k.serializeDoc() };
    var wrote = true;
    try { localStorage.setItem(k.PROJECT_PREFIX + 'Legacy', JSON.stringify(legacyDoc)); }
    catch (e) { wrote = false; }
    var listed = wrote ? (await k.listProjects()).some(function (r) { return r.name === 'Legacy'; }) : false;
    var readBack = wrote ? await k.readProject('Legacy') : null;
    log('');
    log('=== 5. a model the migration has not reached ===');
    log('  written to localStorage: ' + wrote + ', listed: ' + listed +
      ', readable: ' + !!(readBack && readBack.doc));
    log(verdict(wrote && listed && !!(readBack && readBack.doc),
      'a model left on the old road is not a model that vanished',
      (!wrote ? 'COULD NOT WRITE THE FIXTURE - this section tested nothing; ' : '') +
      (!listed ? 'IT IS NOT IN THE LIST; ' : '') +
      (!(readBack && readBack.doc) ? 'IT CANNOT BE READ' : '')));

    /* ---- 6. and the migration moves it, once, without dropping it ---- */
    mark('section6');
    await k.migrateProjects();
    await sleep(300);
    var movedRec = await idbGet(k.DOCDB_STORE, 'Legacy');
    var legacyLeft = lsLen(k.PROJECT_PREFIX + 'Legacy');
    log('');
    log('=== 6. the migration moves it ===');
    log('  in IndexedDB after migrating: ' + (movedRec && movedRec.doc ? 'yes' : 'NO') +
      ', left in localStorage: ' + legacyLeft + ' bytes');
    log(verdict(!!(movedRec && movedRec.doc) && legacyLeft === 0,
      'it arrived before the old copy was let go',
      (!(movedRec && movedRec.doc) ? 'IT NEVER ARRIVED; ' : '') +
      (legacyLeft ? 'THE OLD COPY IS STILL THERE - a move that is a copy' : '')));

    /* ---- 7. delete clears both roads ----
       Deleting only the new one leaves an un-migrated copy that comes back
       on the next reload, which reads as "delete did not work". */
    mark('section7');
    var back = { savedAt: Date.now(), doc: legacyDoc.doc };
    try { localStorage.setItem(k.PROJECT_PREFIX + 'Legacy', JSON.stringify(back)); } catch (e) {}
    await k.deleteProject('Legacy');
    await sleep(200);
    var goneIdb = await idbGet(k.DOCDB_STORE, 'Legacy');
    var goneLs = lsLen(k.PROJECT_PREFIX + 'Legacy');
    var stillListed = (await k.listProjects()).some(function (r) { return r.name === 'Legacy'; });
    log('');
    log('=== 7. delete clears both roads ===');
    log('  in IndexedDB: ' + (goneIdb ? 'STILL THERE' : 'gone') +
      ', in localStorage: ' + goneLs + ' bytes, listed: ' + stillListed);
    log(verdict(!goneIdb && goneLs === 0 && !stillListed,
      'deleted means deleted, on whichever road it was on',
      (goneIdb ? 'THE DATABASE COPY SURVIVED; ' : '') +
      (goneLs ? 'THE localStorage COPY SURVIVED - it returns on the next reload; ' : '') +
      (stillListed ? 'IT IS STILL IN THE LIST' : '')));

    /* ---- 8. the autosave stayed where it was, on purpose ----
       Not an oversight and not a leftover: it is read synchronously at boot
       to decide whether to build a fresh cube, and it carries no pictures.
       Asserting it means a later version cannot move it by accident and
       leave init reading a promise. */
    mark('section8');
    clearScene();
    k.scheduleAutosave();
    await sleep(1400);
    var autoLen = lsLen(k.AUTOSAVE_KEY);
    var autoDoc = null;
    try { autoDoc = JSON.parse(localStorage.getItem(k.AUTOSAVE_KEY)); } catch (e) {}
    log('');
    log('=== 8. the autosave is still synchronous ===');
    log('  ' + kb(autoLen) + ' in localStorage, carries pictures: ' +
      !!(autoDoc && autoDoc.doc && autoDoc.doc.textures));
    log(verdict(autoLen > 0 && !!(autoDoc && autoDoc.doc) &&
      !(autoDoc.doc && autoDoc.doc.textures),
      'the autosave is readable without waiting, and carries no pictures',
      (!autoLen ? 'THE AUTOSAVE WROTE NOTHING; ' : '') +
      (autoDoc && autoDoc.doc && autoDoc.doc.textures ?
        'IT IS CARRYING PICTURES - a step the history was measured without' : '')));

    /* ---- 9. what the list costs ----
       The drawer needs a name and a date per model. With the date inside the
       record, getting it means deserialising every saved model in full - and
       a record carries its own pictures, so ten models is ninety megabytes
       read and two numbers used, on every save, every delete and every boot.
       The dates live in a small store beside the records; this asserts they
       are actually there and actually match, because a second store that
       drifts is worse than no second store. */
    mark('section9');
    clearScene();
    await k.deleteProject('One');
    await k.deleteProject('Two');
    await k.saveProject('One');
    await sleep(120);
    await k.saveProject('Two');
    await sleep(200);
    var metaKeys = await idbGet(k.DOCMETA_STORE, null) || [];
    var docKeysAll = await idbGet(k.DOCDB_STORE, null) || [];
    var m1 = await idbGet(k.DOCMETA_STORE, 'One');
    var m2 = await idbGet(k.DOCMETA_STORE, 'Two');
    var r2 = await idbGet(k.DOCDB_STORE, 'Two');
    var listed9 = await k.listProjects();
    var iOne = listed9.findIndex(function (r) { return r.name === 'One'; });
    var iTwo = listed9.findIndex(function (r) { return r.name === 'Two'; });
    var orphans = docKeysAll.filter(function (x) { return metaKeys.indexOf(x) < 0; });
    log('');
    log('=== 9. the list reads dates, not models ===');
    log('  ' + docKeysAll.length + ' record(s), ' + metaKeys.length +
      ' date(s), records with no date: ' + orphans.length);
    log('  "Two" date matches its record: ' +
      !!(m2 && r2 && m2.savedAt === r2.savedAt) +
      ', newest first: ' + (iTwo >= 0 && iOne > iTwo));
    log(verdict(docKeysAll.length >= 2 && orphans.length === 0 &&
      !!(m1 && m2 && r2) && m2.savedAt === r2.savedAt && iTwo >= 0 && iOne > iTwo,
      'every record has a date beside it, and it is the record\'s own',
      (docKeysAll.length < 2 ? 'THE FIXTURE DID NOT SAVE - this section tested nothing; ' : '') +
      (orphans.length ? orphans.length + ' RECORD(S) HAVE NO DATE - they sort to the bottom for ever; ' : '') +
      (!(m2 && r2 && m2.savedAt === r2.savedAt) ? 'THE DATE AND THE RECORD DISAGREE - the two stores have drifted; ' : '') +
      (!(iTwo >= 0 && iOne > iTwo) ? 'THE LIST IS NOT NEWEST FIRST' : '')));
    await k.deleteProject('One');
    await k.deleteProject('Two');

    // Leave nothing behind for the next run.
    await k.deleteProject('Alpha');
    await k.deleteProject('Big');
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
      }, 800);
    });
  }, 300);
})();
