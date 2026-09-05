/* a2.65a - the material library across a file.

   Two standing notes were retested here and one of them was wrong. "Masks
   added to a preset material do not survive a project file" had been true
   once; by a2.65 materialDefSig included masks, so the file's masked Metal
   no longer matched the local plain one and the import path adopted it
   under a fresh id. Nothing was being lost. Nobody had re-measured.

   So this suite exists to stop that note being written again. Every
   assertion is about what the USER gets back - the mask on the model, the
   faces pointing at it - never about internals for their own sake. */
(function () {
  var out = [], errs = [];
  var _ce = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); _ce.apply(console, arguments); };
  function log(k, v) { out.push(k + '=' + v); }
  var k, A;

  var MASK = { type: 'scratches', amount: 0.8, scale: 2.5, detail: 0.5, contrast: 0.6,
               seed: 7, blend: 'multiply', color: '#ff3020', useColor: true,
               roughness: 0.9, useRough: true };

  function defOf(id) { return k.getMaterialDef(id); }
  function maskCount(id) { var d = defOf(id); return (d && d.masks || []).length; }
  function finishesOf(o) { return Object.values(o.mesh.userData.finishes || {}); }
  // What every face of the first object is actually wearing.
  function wornDefs() {
    var o = A.objects[0];
    return finishesOf(o).map(defOf);
  }
  function ids() { var a = []; k.MATERIALS.forEach(function (v, id) { a.push(id); }); return a; }

  function main() {
    k = window.__kubik; A = k.App;
    var o = A.objects[0];
    A.selectedObjectIds = new Set([o.id]);
    A.activeObjectId = o.id;
    k.applyFinishToSelection('metal');
    log('0.painted', finishesOf(o).join(',') + ' on ' + finishesOf(o).length + ' groups');

    /* ---- 1. A mask on a PRESET reaches the file ---- */
    var def = k.MATERIALS.get('metal');
    def.masks = [Object.assign({}, MASK)];
    k.saveMaterialLibrary();
    k.updateMaterialEverywhere('metal');
    /* DEEP COPY AT ONCE. serializeDoc's materialLib is Array.from(MATERIALS
       .values()).map(normaliseDefMasks), and normaliseDefMasks returns the
       SAME object when masks is already an array - so the "file" aliases the
       live definitions. Clearing the local mask below emptied the file too,
       and the first run of this probe reported the app losing a mask it had
       never been given. Harmless in the app, where every save stringifies
       immediately; fatal to a test that holds the doc and then edits state. */
    var doc = JSON.parse(JSON.stringify(k.serializeDoc()));
    var inFile = (doc.materialLib || []).filter(function (d) { return d.id === 'metal'; })[0];
    log('1.metal_in_file', inFile ? 'written, ' + ((inFile.masks || []).length) + ' mask(s)'
                                 : 'THE PRESET WAS NOT WRITTEN TO THE FILE AT ALL');

    /* ---- 2. Opening it in a library that has never seen the mask ----
       The fresh-browser condition without a reload: put the local preset
       back to how loadMaterialLibrary seeds it, then open the file. This is
       the exact case the old note claimed dropped the mask. */
    def.masks = [];
    delete def.srcSig;
    ids().forEach(function (id) { if (/_i\d*$/.test(id)) k.MATERIALS.delete(id); });
    log('2.library_before', ids().join(',') + ' · metal masks ' + maskCount('metal'));

    k.restoreDoc(JSON.parse(JSON.stringify(doc)));
    var worn = wornDefs();
    var carried = worn.filter(function (d) { return d && (d.masks || []).length; });
    log('2.library_after', ids().join(','));
    log('2.mask_survived', carried.length === worn.length && worn.length > 0
      ? 'every face wears a masked material (' + worn[0].name + ')'
      : 'THE MASK WAS LOST - ' + carried.length + ' of ' + worn.length + ' faces carry it');
    log('2.preset_left_alone', maskCount('metal') === 0
      ? 'the Metal preset is still plain, as seeded'
      : 'THE PRESET WAS OVERWRITTEN BY THE FILE');
    log('2.faces_repointed', finishesOf(A.objects[0]).every(function (f) { return f !== 'metal'; })
      ? 'faces follow the imported material, not the plain preset'
      : 'FACES STILL POINT AT THE PLAIN PRESET');

    /* ---- 3. The SAME library must not mint a second copy ----
       Re-opening a file whose material the library already has, byte for
       byte, has to match by signature and change nothing. This is the case
       that used to mint "Metal (imported)" beside Metal on every load. */
    var n1 = ids().length;
    k.restoreDoc(JSON.parse(JSON.stringify(doc)));
    var n2 = ids().length;
    log('3.no_duplicate', n2 === n1
      ? 'reopening the same file added nothing (' + n2 + ' materials)'
      : 'A SECOND COPY WAS MINTED (' + n1 + ' -> ' + n2 + ')');

    /* ---- 4. envMapIntensity is retired (a2.65a) ----
       Verified inert in three r184: the per-material value only applies when
       the material owns an envMap, and the environment here comes from
       scene.environment, which is scaled by scene.environmentIntensity
       alone. It was carried in every definition, every file and the
       signature - where it could split two identical materials over a
       number that does nothing. It must not creep back. */
    var carriers = [];
    k.MATERIALS.forEach(function (d, id) {
      if (Object.prototype.hasOwnProperty.call(d, 'envMapIntensity')) carriers.push(id);
    });
    log('4.not_in_defs', carriers.length ? 'STILL IN: ' + carriers.join(',') : 'gone from every definition');
    log('4.not_in_signature', k.materialDefSig({ name: 'x', roughness: 1, metalness: 0 })
        .indexOf('envMapIntensity') < 0 ? 'gone from the signature' : 'STILL IN THE SIGNATURE');
    var a = k.materialDefSig({ name: 'x', roughness: 1, metalness: 0, envMapIntensity: 0.5 });
    var b = k.materialDefSig({ name: 'x', roughness: 1, metalness: 0, envMapIntensity: 9 });
    log('4.cannot_split_a_pair', a === b
      ? 'two materials differing only by it are one material'
      : 'IT STILL SPLITS TWO IDENTICAL MATERIALS');
    var sd = k.serializeDoc();
    log('4.not_in_file', JSON.stringify(sd.materialLib || []).indexOf('envMapIntensity') < 0
      ? 'gone from the saved file' : 'STILL WRITTEN INTO THE FILE');

    /* ---- 5. A signature written by an OLDER build still matches ----
       srcSig is a materialDefSig string kept on an imported material and
       persisted, so a library written before a2.65a holds strings carrying
       the retired key - strings the current signature can never produce.
       Without a migration each of those materials mints one more copy of
       itself on the next open of its file, which is the exact failure srcSig
       exists to prevent. The stale form is built here by putting the key
       back where stableStringify's alphabetical order had it, between
       "color" and "masks". */
    var imported = null;
    k.MATERIALS.forEach(function (d, id) { if (/_i\d*$/.test(id)) imported = d; });
    if (!imported) {
      log('5.setup', 'NO IMPORTED MATERIAL TO AGE - section 2 must have failed');
    } else {
      var live = k.materialDefSig(imported);
      var stale = (imported.srcSig || live).replace('"masks"', '"envMapIntensity":1,"masks"');
      log('5.stale_is_stale', stale.indexOf('envMapIntensity') >= 0 && stale !== live
        ? 'built a pre-a2.65a signature' : 'COULD NOT BUILD A STALE SIGNATURE');
      imported.srcSig = stale;
      var n3 = ids().length;
      k.restoreDoc(JSON.parse(JSON.stringify(doc)));
      var n4 = ids().length;
      log('5.old_sig_still_matches', n4 === n3
        ? 'a library written before a2.65a mints nothing (' + n4 + ' materials)'
        : 'A STALE SIGNATURE MINTED A DUPLICATE (' + n3 + ' -> ' + n4 + ')');
      log('5.sig_was_migrated', (imported.srcSig || '').indexOf('envMapIntensity') < 0
        ? 'and the stored signature was rewritten to the current format'
        : 'THE STALE SIGNATURE IS STILL STORED');
    }

    log('console.errors', errs.length ? errs.slice(0, 3).join(' | ') : 'none');
  }

  function ready(cb, t) {
    t = t || 0;
    if (window.__kubik && window.__kubik.App) return cb();
    if (t > 250) { out.push('ERROR=no __kubik'); return finish(); }
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
