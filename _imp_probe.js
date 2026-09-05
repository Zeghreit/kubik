/* a2.68 - a model comes back, and comes back EDITABLE.

   The whole feature is one number: how many faces a cube has after a round
   trip. computeTopology exposes an edge only when some face uses it exactly
   once, so a cube that returns as 12 triangle-faces has 18 edges and a seam
   across every side - openable, and useless to model with.

   The export goes through buildExportGroup, the real path. A previous
   session measured GLTFExporter directly instead and reported a bug that
   did not exist. */
(function () {
  var out = [], errs = [];
  var _ce = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); _ce.apply(console, arguments); };
  function log(k, v) { out.push(k + '=' + v); }
  var k, A;

  function topoOf(o) { return o.mesh.userData.topo; }
  function bboxOf(o) {
    o.mesh.geometry.computeBoundingBox();
    var b = o.mesh.geometry.boundingBox;
    return [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z]
      .map(function (n) { return n.toFixed(3); }).join(',');
  }

  async function main() {
    k = window.__kubik; A = k.App;
    var THREE = k.THREE;

    var before = A.objects[0];
    /* a2.69: one face wears a CUSTOM before anything is exported, so the
       round trip has something to lose. Applied through finishes + rebuild
       rather than a UI call: reconcileFinishes reads the map as its
       pre-stamp fallback and stamps the material from it, which is the same
       path a loaded file takes. */
    k.MATERIALS.set('mat_ruby_t', { id: 'mat_ruby_t', preset: false, name: 'Ruby',
      color: '#c0392b', roughness: 0.35, metalness: 0 });
    before.mesh.userData.finishes = before.mesh.userData.finishes || {};
    before.mesh.userData.finishes[0] = 'mat_ruby_t';
    /* The STAMP wins over the map in reconcileFinishes, and a cube born from
       makeMaterialSet is already stamped 'standard' - so setting the map
       alone changed nothing at all and the first run of this section
       measured a cube that was never painted. Clearing the stamp is the
       'pre-stamp material' case reconcileFinishes documents: it is what a
       file saved before a2.24 arrives as. */
    delete before.mesh.material[0].userData.kubikDef;
    k.rebuildFromEditable(before, k.toEditable(before.mesh));
    var libBefore = k.MATERIALS.size;
    k.ensureHelpers(before);
    var t0 = topoOf(before);
    log('0.before', t0.faceGroups.length + ' faces · ' + t0.edges.length +
      ' edges · ' + t0.logicalCount + ' vertices · box ' + bboxOf(before));

    /* ---- 1. Out through the real export path, and back in ---- */
    var mod = await import('https://cdn.jsdelivr.net/npm/three@0.184.0/examples/jsm/exporters/GLTFExporter.js');
    var group = k.buildExportGroup();
    var glb = await new mod.GLTFExporter().parseAsync(group, { binary: true });
    log('1.exported', Math.round(glb.byteLength / 1024) + 'kb of .glb');

    var had = A.objects.length;
    await k.importGltfBuffer(glb, 'Round trip');
    log('1.objects_added', (A.objects.length - had) + ' added');

    var after = A.objects[A.objects.length - 1];
    k.ensureHelpers(after);
    var t1 = topoOf(after);
    log('1.after', t1.faceGroups.length + ' faces · ' + t1.edges.length +
      ' edges · ' + t1.logicalCount + ' vertices · box ' + bboxOf(after));

    /* ---- 2. The assertions that matter ---- */
    log('2.faces_survive', t1.faceGroups.length === t0.faceGroups.length
      ? 'same face count as the original (' + t1.faceGroups.length + ')'
      : 'FACE COUNT CHANGED ' + t0.faceGroups.length + ' -> ' + t1.faceGroups.length);
    log('2.no_phantom_edges', t1.edges.length === t0.edges.length
      ? 'same edge count (' + t1.edges.length + ') - no triangulation diagonals exposed'
      : 'EDGE COUNT CHANGED ' + t0.edges.length + ' -> ' + t1.edges.length +
        ' - the merge let a diagonal through');
    log('2.welded', t1.logicalCount === t0.logicalCount
      ? 'same vertex count (' + t1.logicalCount + ') - it re-welded'
      : 'VERTEX COUNT CHANGED ' + t0.logicalCount + ' -> ' + t1.logicalCount);
    log('2.same_size', bboxOf(after) === bboxOf(before)
      ? 'identical bounding box' : 'GEOMETRY MOVED OR SCALED');

    /* ---- 9. MATERIALS SURVIVE THE ROUND TRIP (a2.69) ----
       Two opposite failures. Minting: the file records the theme's grey as a
       literal colour, so every re-open of an exported cube added an
       "Imported" grey that no longer followed the theme. Losing: the custom
       on face 0 comes back as a nameless duplicate rather than the entry it
       left as. Both are counted, not described.

       BEFORE section 3, which extrudes and therefore grows the material
       array - these counts only mean anything against the six faces that
       came out of the file. */
    log('9.library_size', libBefore + ' before, ' + k.MATERIALS.size + ' after the round trip');
    log('9.no_duplicates_minted', k.MATERIALS.size === libBefore
      ? 'a Kubik file re-imported into Kubik minted nothing'
      : 'IT MINTED ' + (k.MATERIALS.size - libBefore) + ' COPIES OF MATERIALS IT ALREADY HAD');

    var fin9 = after.mesh.userData.finishes || {};
    var mats9 = after.mesh.material;
    var ids9 = Object.keys(fin9).map(function (key) { return fin9[key]; });
    var rubyAt = -1;
    Object.keys(fin9).forEach(function (key) { if (fin9[key] === 'mat_ruby_t') rubyAt = +key; });
    log('9.custom_reunited', rubyAt >= 0
      ? 'the painted face came back on the SAME library entry (group ' + rubyAt + ')'
      : 'THE CUSTOM WAS LOST - groups landed on ' + ids9.join(','));
    log('9.custom_colour', rubyAt >= 0 && mats9[rubyAt] &&
      ('#' + mats9[rubyAt].color.getHexString()) === '#c0392b'
      ? 'and it is still #c0392b on screen'
      : 'AND ITS COLOUR IS ' + (mats9[rubyAt] ? '#' + mats9[rubyAt].color.getHexString() : 'gone'));

    var themedLeft = 0, themedFlag = 0;
    for (var g9 = 0; g9 < mats9.length; g9++) {
      if (g9 === rubyAt) continue;
      if ((fin9[g9] || 'standard') === 'standard') themedLeft++;
      if (mats9[g9] && mats9[g9].userData.themedDefault) themedFlag++;
    }
    log('9.presets_stay_themed', themedLeft === mats9.length - 1 && themedFlag === mats9.length - 1
      ? 'the other ' + themedLeft + ' faces came back on Solid, still following the theme'
      : 'THEY LANDED ON EXPLICIT GREYS (' + themedLeft + ' on Solid, ' +
        themedFlag + ' still themed, of ' + (mats9.length - 1) + ')');

    /* ---- 3. And it is actually editable ----
       A face selected on the import must extrude like any other. This is the
       point of the merge, so assert the consequence, not the mechanism. */
    A.selectedObjectIds = new Set([after.id]);
    A.activeObjectId = after.id;
    k.setMode('face');
    A.selectedElements = new Set([0]);
    var vBefore = after.mesh.geometry.attributes.position.count;
    var ok = true;
    try { k.extrudeRegionOp(after, [0], 0.25); }
    catch (e) { ok = false; log('3.extrude_threw', e && e.message); }
    var vAfter = after.mesh.geometry.attributes.position.count;
    log('3.a_face_extrudes', ok && vAfter > vBefore
      ? 'extruding an imported face added geometry (' + vBefore + ' -> ' + vAfter + ')'
      : 'AN IMPORTED FACE WILL NOT EXTRUDE');

    /* ---- 4. The budget refuses out loud rather than appearing to work ---- */
    var big = new THREE.BufferGeometry();
    var n = 45000 * 3;
    var arr = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) { arr[i * 3] = i % 7; arr[i * 3 + 1] = (i % 5); arr[i * 3 + 2] = (i % 3); }
    big.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    var heavy = new THREE.Mesh(big, new THREE.MeshStandardMaterial());
    var scene2 = new THREE.Scene(); scene2.add(heavy);
    var glb2 = await new mod.GLTFExporter().parseAsync(scene2, { binary: true });
    var countBefore = A.objects.length;
    await k.importGltfBuffer(glb2, 'Too heavy');
    log('4.budget_refuses', A.objects.length === countBefore
      ? 'a 45k-triangle file was refused and nothing was added'
      : 'THE BUDGET LET IT THROUGH (' + (A.objects.length - countBefore) + ' added)');
    var tEl = document.getElementById('toast');
    log('4.and_says_why', tEl && /too heavy/i.test(tEl.textContent || '')
      ? 'and the toast says why: "' + tEl.textContent + '"'
      : 'IT REFUSED SILENTLY');

    /* ---- 5. The merge does not eat a curve ----
       The failure mode opposite to phantom edges: a threshold loose enough
       to swallow a sphere gives you one face and nothing to model with. */
    var sph = new THREE.SphereGeometry(1, 16, 12);
    var sPos = Array.from(sph.attributes.position.array);
    var sTris = [];
    for (var t = 0; t < sph.index.count / 3; t++)
      sTris.push([sph.index.getX(t * 3), sph.index.getX(t * 3 + 1), sph.index.getX(t * 3 + 2)]);
    var sGroups = k.mergeCoplanarTriangles(sPos, sTris, function () { return 0; });
    log('5.sphere_faces', sGroups.length + ' faces from ' + sTris.length + ' triangles');
    log('5.curve_survives', sGroups.length > sTris.length * 0.4
      ? 'a curved surface stays many faces'
      : 'THE MERGE ATE THE CURVE - ' + sGroups.length + ' faces for a sphere');

    /* And the opposite check on something genuinely flat. */
    var pl = new THREE.PlaneGeometry(2, 2, 4, 4);
    var pPos = Array.from(pl.attributes.position.array);
    var pTris = [];
    for (var q = 0; q < pl.index.count / 3; q++)
      pTris.push([pl.index.getX(q * 3), pl.index.getX(q * 3 + 1), pl.index.getX(q * 3 + 2)]);
    var pGroups = k.mergeCoplanarTriangles(pPos, pTris, function () { return 0; });
    log('5.flat_merges', pGroups.length === 1
      ? 'a flat 32-triangle plane becomes one face'
      : 'A FLAT PLANE CAME OUT AS ' + pGroups.length + ' FACES');

    /* ---- 6. A FACE WITH A HOLE stays editable (the design blocker) ----
       getGroupBoundaryLoopAttr walks one boundary loop and has no concept of
       a second, and Inset and Extrude build their rim from it. Merging a
       ring of coplanar triangles into one face made that reachable, so a
       region is merged whole only when its boundary is one simple loop.
       Built here as a square annulus: an outer 3x3 ring of quads with the
       middle one missing - a washer, the most ordinary imported geometry
       there is. */
    var ap = [], at = [];
    for (var gy = 0; gy <= 3; gy++) for (var gx = 0; gx <= 3; gx++) ap.push(gx, gy, 0);
    function gi(x, y) { return y * 4 + x; }
    for (var cy = 0; cy < 3; cy++) for (var cx = 0; cx < 3; cx++) {
      if (cx === 1 && cy === 1) continue;                  // the hole
      at.push([gi(cx, cy), gi(cx + 1, cy), gi(cx + 1, cy + 1)]);
      at.push([gi(cx, cy), gi(cx + 1, cy + 1), gi(cx, cy + 1)]);
    }
    var ring = k.mergeCoplanarTriangles(ap, at, function () { return 0; });
    log('6.annulus_faces', ring.length + ' faces from ' + at.length +
      ' coplanar triangles around a hole');
    log('6.hole_not_swallowed', ring.length > 1
      ? 'the ring did not merge into one face with a hole in it'
      : 'A FACE WITH A HOLE WAS CREATED - inset and extrude will corrupt it');
    var maxTris = 0;
    ring.forEach(function (g) { if (g.triangles.length > maxTris) maxTris = g.triangles.length; });
    log('6.fallback_is_quads', maxTris <= 2
      ? 'the fallback emitted quads and singles, which cannot have a hole'
      : 'A FALLBACK GROUP HAS ' + maxTris + ' TRIANGLES');

    /* A plain square with no hole must still merge whole, or the fallback is
       simply eating the feature. */
    var sp = [0,0,0, 1,0,0, 1,1,0, 0,1,0];
    var st2 = [[0,1,2],[0,2,3]];
    log('6.solid_quad_still_merges', k.mergeCoplanarTriangles(sp, st2, function(){return 0;}).length === 1
      ? 'a hole-free coplanar pair is still one face'
      : 'THE FALLBACK ATE AN ORDINARY FACE');

    /* ---- 7. A MIRRORED node must not import inside-out ----
       applyMatrix4 moves positions and leaves winding alone, and the import
       BAKES the transform, so the mesh's own determinant comes out positive
       and it renders FrontSide: invisible from outside, solid from within.

       Driven straight at editableFromImportedMeshes rather than through a
       file: the fix lives there, and a third glTF round trip pushed this
       suite past the headless virtual-time budget so it produced nothing
       at all. */
    var mir = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
    mir.scale.set(-1, 1, 1);
    mir.updateMatrixWorld(true);
    var edM = k.editableFromImportedMeshes([mir]);
    function signedVolume(ed) {
      var p = ed.positions, v = 0;
      ed.groups.forEach(function (g) {
        g.triangles.forEach(function (t) {
          var ax = p[t[0]*3], ay = p[t[0]*3+1], az = p[t[0]*3+2];
          var bx = p[t[1]*3], by = p[t[1]*3+1], bz = p[t[1]*3+2];
          var cx = p[t[2]*3], cy = p[t[2]*3+1], cz = p[t[2]*3+2];
          v += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
        });
      });
      return v;
    }
    var volM = edM ? signedVolume(edM) : 0;
    log('7.mirrored_winding', volM > 0
      ? 'a negative-scale node comes in facing outwards (volume ' + volM.toFixed(3) + ')'
      : 'IT IMPORTS INSIDE-OUT (volume ' + volM.toFixed(3) + ')');
    /* And the control: an ordinary node must not be flipped BY the fix. */
    var pl8 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
    pl8.updateMatrixWorld(true);
    var edP = k.editableFromImportedMeshes([pl8]);
    log('7.plain_unchanged', edP && signedVolume(edP) > 0
      ? 'and an unmirrored one is left alone'
      : 'THE FIX FLIPPED AN ORDINARY NODE');

    /* ---- 8. Interleaved positions ----
       GLTFLoader builds an InterleavedBufferAttribute whenever a bufferView
       is shared, which is what gltfpack and meshopt produce. Reading .array
       over its length then pushes normals and UVs in among the coordinates.
       Kubik's own exporter packs tightly, so only a hand-built one shows it. */
    var inter = new THREE.BufferGeometry();
    var src8 = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
    var sp8 = src8.attributes.position, cnt8 = sp8.count;
    var buf8 = new Float32Array(cnt8 * 6);              // xyz + rgb, stride 6
    for (var v8 = 0; v8 < cnt8; v8++) {
      buf8[v8 * 6] = sp8.getX(v8); buf8[v8 * 6 + 1] = sp8.getY(v8); buf8[v8 * 6 + 2] = sp8.getZ(v8);
      buf8[v8 * 6 + 3] = 9; buf8[v8 * 6 + 4] = 9; buf8[v8 * 6 + 5] = 9;   // poison
    }
    var ib8 = new THREE.InterleavedBuffer(buf8, 6);
    inter.setAttribute('position', new THREE.InterleavedBufferAttribute(ib8, 3, 0));
    var im8 = new THREE.Mesh(inter, new THREE.MeshStandardMaterial());
    im8.updateMatrixWorld(true);
    var ed8 = k.editableFromImportedMeshes([im8]);
    var poisoned = ed8 ? ed8.positions.some(function (x) { return x === 9; }) : true;
    log('8.interleaved_read', ed8 && !poisoned
      ? 'an interleaved attribute read ' + (ed8.positions.length / 3) + ' clean vertices'
      : 'THE INTERLEAVED BUFFER LEAKED NON-POSITION DATA');
    log('8.interleaved_faces', ed8 ? ed8.groups.length + ' faces from an interleaved cube' : 'nothing');

    /* ---- 10. The mapping itself, asked of one material at a time ---- */
    var ctx = k.importMaterialContext();
    function fake(name, hex, r, m) {
      var f = new THREE.MeshStandardMaterial({ color: hex, roughness: r, metalness: m });
      f.name = name;
      return f;
    }
    var idGold = ctx.idFor(fake('Gold', 0xd4af37, 0.3, 1));
    var dGold = k.getMaterialDef(idGold);
    log('10.pbr_mapped', dGold.color === '#d4af37' && dGold.roughness === 0.3 &&
      dGold.metalness === 1 && /Gold/.test(dGold.name)
      ? 'baseColour, roughness and metalness all landed (' + dGold.name + ' ' +
        dGold.color + ' r' + dGold.roughness + ' m' + dGold.metalness + ')'
      : 'MAPPED WRONG: ' + JSON.stringify([dGold.name, dGold.color, dGold.roughness, dGold.metalness]));

    /* A second, equal-looking material is the same material. This is what
       stops a 40-primitive model filling the tray with one entry each. */
    log('10.dedup', ctx.idFor(fake('Gold', 0xd4af37, 0.3, 1)) === idGold
      ? 'a second material of the same look reuses the entry'
      : 'IT MINTED A SECOND GOLD');
    log('10.float32_tolerated', ctx.idFor(fake('Gold', 0xd4af37, Math.fround(0.3), 1)) === idGold
      ? 'and so does the float32 a real file actually stores'
      : 'A float32 ROUNDING DIFFERENCE MINTED A DUPLICATE');

    /* The cap holds, so a pathological file cannot own the tray. */
    var sizeB = k.MATERIALS.size, fell = 0;
    for (var b = 0; b < 90; b++) {
      if (ctx.idFor(fake('Bulk' + b, 0x101000 + b * 37, 0.5, 0)) === 'standard') fell++;
    }
    log('10.budget_holds', (k.MATERIALS.size - sizeB) <= 64 && fell > 0
      ? 'past the cap of 64 the rest land on Solid (' + (k.MATERIALS.size - sizeB) +
        ' minted, ' + fell + ' refused)'
      : 'THE CAP LEAKED - ' + (k.MATERIALS.size - sizeB) + ' minted');

    /* ---- 11. A RENAMED ENTRY MUST BE FINDABLE AGAIN (the review's §2/§7)
       An imported material whose name collides gets renamed, and is stored
       with srcSig = the signature of the name in the FILE. The index used to
       be `srcSig || materialDefSig(v)` - one key - so the renamed entry was
       reachable only by where it came from, never by what it now is. A
       fresh context is exactly "a later session opening the same file". */
    var sizeA = k.MATERIALS.size;
    var id11 = k.importMaterialContext().idFor(fake('Metal', 0x336699, 0.2, 1));
    var d11 = k.getMaterialDef(id11);
    log('11.rename_on_collision', id11 !== 'metal' && /imported/i.test(d11.name)
      ? 'a file\'s "Metal" that is not ours became "' + d11.name + '"'
      : 'IT LANDED ON ' + id11 + ' (' + d11.name + ')');
    var id11b = k.importMaterialContext().idFor(fake('Metal', 0x336699, 0.2, 1));
    log('11.reopen_finds_it', id11b === id11 && k.MATERIALS.size === sizeA + 1
      ? 'opening the same file again reuses it - one entry, not two'
      : 'A SECOND OPEN MINTED ANOTHER (' + (k.MATERIALS.size - sizeA) + ' entries)');
    /* And by its DISPLAY name, which is what buildExportGroup writes into a
       .glb - so this is the Kubik export -> Kubik import round trip. */
    var id11c = k.importMaterialContext().idFor(fake(d11.name, 0x336699, 0.2, 1));
    log('11.exported_name_finds_it', id11c === id11 && k.MATERIALS.size === sizeA + 1
      ? 'and so does a .glb carrying its renamed display name'
      : 'THE ROUND TRIP MINTED "' + d11.name + ' (imported)"');

    /* ---- 12. The themed shortcut must not eat a NAMED material ----
       Solid/Plastic/Metal carry color:null and follow the theme, so an
       incoming colour that IS the theme grey is one of them. But that test
       used to run BEFORE the library was asked, so a material somebody had
       mixed by hand to exactly that grey, named, exported and re-imported,
       came back as Solid with its name gone. */
    var greyHex = '#' + after.mesh.material[1].color.getHexString();
    k.MATERIALS.set('mat_fog_t', { id: 'mat_fog_t', preset: false, name: 'Fog',
      color: greyHex, roughness: 1, metalness: 0 });
    var ctx12 = k.importMaterialContext();
    var greyNum = parseInt(greyHex.slice(1), 16);
    log('12.named_grey_kept', ctx12.idFor(fake('Fog', greyNum, 1, 0)) === 'mat_fog_t'
      ? 'a hand-mixed material that IS the theme grey keeps its own identity'
      : 'THE PRESET SWALLOWED IT');
    log('12.nameless_grey_is_solid', ctx12.idFor(fake('', greyNum, 1, 0)) === 'standard'
      ? 'while a nameless one still lands on Solid and follows the theme'
      : 'A PLAIN EXPORTED CUBE NO LONGER COMES BACK ON SOLID');

    /* ---- 13. A hostile file must not half-import ----
       A glTF name is whatever the JSON says; GLTFLoader does not coerce it.
       The throw landed inside the object loop, after createCubeObject had
       already put a half-built object in the scene. */
    var sizeC = k.MATERIALS.size, threw13 = false, id13 = null;
    var bad13 = fake('x', 0x112233, 0.5, 0);
    bad13.name = 123;
    try { id13 = k.importMaterialContext().idFor(bad13); }
    catch (e13) { threw13 = true; }
    log('13.numeric_name_survives', !threw13
      ? 'a numeric material name imported without throwing (-> ' + id13 + ')'
      : 'A NUMERIC NAME THREW MID-IMPORT');
    var nan13 = fake('Broken', 0x112233, 0.5, 0);
    nan13.color.setRGB(NaN, NaN, NaN);
    var id13b = k.importMaterialContext().idFor(nan13);
    log('13.nan_colour_refused', id13b === 'standard'
      ? 'a NaN baseColour lands on Solid rather than persisting "#000NaN"'
      : 'IT PERSISTED ' + JSON.stringify(k.getMaterialDef(id13b).color));
    log('13.library_grew_by', (k.MATERIALS.size - sizeC) + ' entries from the two hostile materials');

    log('console.errors', errs.length ? errs.join(' | ').slice(0, 400) : 'none');
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
  window.addEventListener('error', function (e) { errs.push('onerror: ' + (e.message || e)); });
  setTimeout(function () {
    ready(function () {
      setTimeout(function () {
        main().catch(function (e) {
          out.push('ERROR=' + (e && e.stack ? e.stack.split('\n').slice(0, 6).join(' / ') : e));
        }).then(finish);
      }, 600);
    });
  }, 300);
})();
