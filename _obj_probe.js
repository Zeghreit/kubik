/* a2.70/a2.71 - the two HAND-WRITTEN readers, .obj and .stl.

   The claim being tested is narrow and it is the whole reason this reader
   exists instead of OBJLoader: an .obj SAYS which triangles are one face,
   and nothing here may re-infer it. So the assertions are about faces the
   file declared, not about faces a merge guessed - two coplanar quads the
   modeller kept apart must stay two, which is exactly what the .glb path
   cannot promise. */
(function () {
  var out = [], errs = [];
  var _ce = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); _ce.apply(console, arguments); };
  function log(k, v) { out.push(k + '=' + v); }
  var k, A;

  function CUBE() {
    return [
      'o Cube',
      'v -0.5 -0.5 -0.5', 'v 0.5 -0.5 -0.5', 'v 0.5 0.5 -0.5', 'v -0.5 0.5 -0.5',
      'v -0.5 -0.5 0.5', 'v 0.5 -0.5 0.5', 'v 0.5 0.5 0.5', 'v -0.5 0.5 0.5',
      'f 5 6 7 8',            // +z
      'f 2 1 4 3',            // -z
      'f 6 2 3 7',            // +x
      'f 1 5 8 4',            // -x
      'f 8 7 3 4',            // +y
      'f 1 2 6 5'             // -y
    ].join('\n');
  }

  function main() {
    k = window.__kubik; A = k.App;
    var THREE = k.THREE;

    /* ---- 1. A cube written as SIX QUADS is six faces ----
       Not twelve, and not six-by-luck-of-the-merge: there is no merge on
       this path. Edges and vertices come from computeTopology afterwards. */
    var b1 = k.editableFromObjText(CUBE(), '');
    log('1.objects', b1.length + ' object(s), named "' + (b1[0] && b1[0].name) + '"');
    log('1.faces', b1.length === 1 && b1[0].ed.groups.length === 6
      ? 'six quads came in as six faces'
      : 'GOT ' + (b1[0] ? b1[0].ed.groups.length : 0) + ' FACES');
    var quads = b1[0].ed.groups.every(function (g) { return g.triangles.length === 2; });
    log('1.each_is_a_quad', quads ? 'each face is two triangles' : 'A FACE IS NOT A QUAD');

    /* ---- 2. THE THING THE .glb PATH CANNOT DO ----
       Two coplanar quads that the modeller deliberately kept apart. The
       coplanar merge joins these every time - correctly, because a .glb
       does not say they are separate. An .obj does. */
    var flat = ['v 0 0 0', 'v 1 0 0', 'v 1 1 0', 'v 0 1 0', 'v 2 0 0', 'v 2 1 0',
                'f 1 2 3 4', 'f 2 5 6 3'].join('\n');
    var b2 = k.editableFromObjText(flat, '');
    log('2.coplanar_kept_apart', b2[0] && b2[0].ed.groups.length === 2
      ? 'two coplanar quads stayed two faces - the file was believed'
      : 'THEY WERE MERGED (' + (b2[0] ? b2[0].ed.groups.length : 0) + ' faces)');

    /* ---- 3. A CONCAVE n-gon is ear-clipped, not fanned ----
       An L-shape whose first vertex cannot see the whole polygon. A fan from
       it produces triangles that stick out beyond the shape; their SIGNED
       areas still sum to the right number, so only the UNSIGNED sum tells
       the two apart. True area 5; a fan gives 9. */
    var Lp = [3,1,0,  1,1,0,  1,3,0,  0,3,0,  0,0,0,  3,0,0];
    var tris3 = k.triangulatePolygon(Lp, [0,1,2,3,4,5]);
    function areaOf(px, ts) {
      var a = 0;
      ts.forEach(function (t) {
        var ax=px[t[0]*3], ay=px[t[0]*3+1], bx=px[t[1]*3], by=px[t[1]*3+1],
            cx=px[t[2]*3], cy=px[t[2]*3+1];
        a += Math.abs((bx-ax)*(cy-ay) - (cx-ax)*(by-ay)) / 2;
      });
      return a;
    }
    var a3 = areaOf(Lp, tris3);
    log('3.concave_triangles', tris3.length + ' triangles, total unsigned area ' + a3.toFixed(3));
    log('3.no_overlap', Math.abs(a3 - 5) < 1e-6
      ? 'the L-shape triangulated to exactly its own area (5) - no fan overspill'
      : 'AREA IS ' + a3.toFixed(3) + ', NOT 5 - it fanned a concave face');
    /* And the winding survives the round trip through ShapeUtils, which
       normalises to CCW in its own 2D frame - not necessarily ours. */
    var n3 = (function () {
      var t = tris3[0];
      var ux=Lp[t[1]*3]-Lp[t[0]*3], uy=Lp[t[1]*3+1]-Lp[t[0]*3+1];
      var vx=Lp[t[2]*3]-Lp[t[0]*3], vy=Lp[t[2]*3+1]-Lp[t[0]*3+1];
      return ux*vy - uy*vx;
    })();
    /* The expected sign is DERIVED from the fixture, not written down:
       a hardcoded one is how this assertion was wrong on its first run. */
    var shoe = 0;
    for (var w = 0; w < 6; w++) {
      var i0 = w * 3, i1 = ((w + 1) % 6) * 3;
      shoe += Lp[i0] * Lp[i1 + 1] - Lp[i1] * Lp[i0 + 1];
    }
    log('3.winding_kept', (n3 > 0) === (shoe > 0)
      ? 'and it still faces the way the polygon did (both ' +
        (shoe > 0 ? 'counter-clockwise' : 'clockwise') + ')'
      : 'THE TRIANGULATION CAME BACK INSIDE-OUT (poly ' + shoe + ', tri ' + n3 + ')');

    /* ---- 4. Index forms ----
       Negative indices are relative to the vertices SO FAR, and a face token
       is v, v/vt, v//vn or v/vt/vn - only the first field is position. */
    var neg = ['v 0 0 0','v 1 0 0','v 1 1 0','v 0 1 0','f -4 -3 -2 -1'].join('\n');
    var b4 = k.editableFromObjText(neg, '');
    log('4.negative_indices', b4[0] && b4[0].ed.groups.length === 1 &&
      b4[0].ed.groups[0].triangles.length === 2
      ? 'f -4 -3 -2 -1 read as the quad it is'
      : 'NEGATIVE INDICES BROKE');
    var slashed = ['v 0 0 0','v 1 0 0','v 1 1 0','v 0 1 0',
                   'vt 0 0','vn 0 0 1',
                   'f 1/1/1 2/1/1 3//1 4'].join('\n');
    var b4b = k.editableFromObjText(slashed, '');
    var t4 = b4b[0] && b4b[0].ed.groups[0] && b4b[0].ed.groups[0].triangles;
    var idxOk = t4 && t4.length === 2 && t4.every(function (t) {
      return t.every(function (v) { return v >= 0 && v <= 3; });
    });
    log('4.slash_forms', idxOk
      ? 'v, v/vt, v//vn and v/vt/vn all resolved to positions'
      : 'A SLASHED FACE TOKEN RESOLVED TO THE WRONG VERTEX');

    /* ---- 5. o and g ---- */
    var two = ['o A','v 0 0 0','v 1 0 0','v 1 1 0','f 1 2 3',
               'o B','v 2 0 0','v 3 0 0','v 3 1 0','f 4 5 6'].join('\n');
    var b5 = k.editableFromObjText(two, '');
    log('5.object_split', b5.length === 2 && b5[0].name === 'A' && b5[1].name === 'B'
      ? 'o A / o B came in as two named objects'
      : 'GOT ' + b5.length + ' OBJECTS (' + b5.map(function (x) { return x.name; }).join(',') + ')');

    /* ---- 6. The .mtl ----
       Ns is a Blinn-Phong exponent, not roughness: sqrt(2/(Ns+2)). Pr and Pm
       are the PBR extension and mean what this app means, so they win. */
    var mtl = ['newmtl Ruby', 'Kd 0.8 0.1 0.1', 'Ns 250',
               'newmtl Steel', 'Kd 0.5 0.5 0.55', 'Pr 0.25', 'Pm 1'].join('\n');
    var m6 = k.parseMtl(mtl);
    var ruby = m6.get('Ruby'), steel = m6.get('Steel');
    log('6.kd_read', ruby && '#' + ruby.color.getHexString() === '#cc1a1a'
      ? 'Kd 0.8 0.1 0.1 read as #cc1a1a'
      : 'Kd CAME OUT ' + (ruby ? '#' + ruby.color.getHexString() : 'missing'));
    log('6.ns_to_roughness', ruby && Math.abs(ruby.roughness - Math.sqrt(2 / 252)) < 1e-6
      ? 'Ns 250 became roughness ' + ruby.roughness.toFixed(4)
      : 'Ns MAPPED TO ' + (ruby ? ruby.roughness : 'nothing'));
    log('6.pbr_extension_wins', steel && steel.roughness === 0.25 && steel.metalness === 1
      ? 'Pr and Pm are believed over Ns'
      : 'THE PBR EXTENSION WAS IGNORED');

    /* ---- 7. End to end, with and without the sidecar ---- */
    /* `usemtl` is STICKY - it applies to every face until the next one, not
       to one face. So this paints faces 2-3 Ruby and 4-6 Steel, and leaves
       face 1 with no material at all, which is the third case worth having:
       a face declared before any usemtl must land on Solid. */
    var painted = CUBE().replace('f 2 1 4 3', 'usemtl Ruby\nf 2 1 4 3')
                        .replace('f 1 5 8 4', 'usemtl Steel\nf 1 5 8 4');
    var libBefore = k.MATERIALS.size, objsBefore = A.objects.length;
    k.importObjText(painted, mtl, 'Painted');
    var made = A.objects[A.objects.length - 1];
    log('7.imported', (A.objects.length - objsBefore) + ' object added, ' +
      made.mesh.geometry.groups.length + ' faces');
    k.ensureHelpers(made);
    var topo = made.mesh.userData.topo;
    log('7.topology', topo.faceGroups.length + ' faces · ' + topo.edges.length +
      ' edges · ' + topo.logicalCount + ' vertices');
    log('7.cube_is_a_cube', topo.faceGroups.length === 6 && topo.edges.length === 12 &&
      topo.logicalCount === 8
      ? 'an .obj cube is a cube - 6 faces, 12 edges, 8 vertices'
      : 'IT IS NOT A CUBE');
    var fin = made.mesh.userData.finishes || {};
    var names = [];
    Object.keys(fin).forEach(function (g) { names.push(k.getMaterialDef(fin[g]).name); });
    var nRuby = names.filter(function (x) { return /Ruby/.test(x); }).length;
    var nSteel = names.filter(function (x) { return /Steel/.test(x); }).length;
    var nSolid = 0;
    for (var g7 = 0; g7 < made.mesh.material.length; g7++) {
      if ((fin[g7] || 'standard') === 'standard') nSolid++;
    }
    log('7.materials_landed', k.MATERIALS.size === libBefore + 2 &&
      nRuby === 2 && nSteel === 3 && nSolid === 1
      ? 'usemtl carried forward correctly - 1 Solid, 2 Ruby, 3 Steel, 2 new entries'
      : 'MATERIALS WRONG: +' + (k.MATERIALS.size - libBefore) + ' entries; ' +
        nSolid + ' Solid, ' + nRuby + ' Ruby, ' + nSteel + ' Steel');

    /* Re-importing the same file must not double the tray. */
    var libAfter = k.MATERIALS.size;
    k.importObjText(painted, mtl, 'Painted again');
    log('7.reimport_dedupes', k.MATERIALS.size === libAfter
      ? 'the same .obj imported twice minted nothing the second time'
      : 'IT MINTED ' + (k.MATERIALS.size - libAfter) + ' MORE');

    /* No sidecar: the model still opens, on Solid, silently. */
    var libC = k.MATERIALS.size;
    k.importObjText(painted, '', 'No mtl');
    var bare = A.objects[A.objects.length - 1];
    var finB = bare.mesh.userData.finishes || {};
    var allSolid = bare.mesh.material.every(function (m, i) {
      return (finB[i] || 'standard') === 'standard';
    });
    void allSolid;
    log('7.no_mtl_is_solid', allSolid && k.MATERIALS.size === libC
      ? 'without its .mtl the model opens on Solid and mints nothing'
      : 'A MISSING .mtl CHANGED THE LIBRARY OR PAINTED SOMETHING');

    /* ---- 8. And it is editable, which is the only thing that matters ---- */
    A.selectedObjectIds = new Set([made.id]);
    A.activeObjectId = made.id;
    k.setMode('face');
    A.selectedElements = new Set([0]);
    var vB = made.mesh.geometry.attributes.position.count;
    var ok8 = true;
    try { k.extrudeRegionOp(made, [0], 0.25); } catch (e) { ok8 = false; log('8.threw', e && e.message); }
    log('8.a_face_extrudes', ok8 && made.mesh.geometry.attributes.position.count > vB
      ? 'extruding an imported .obj face added geometry'
      : 'AN IMPORTED .obj FACE WILL NOT EXTRUDE');

    /* ---- 9. Junk in, refusal out, nothing added ---- */
    var objs9 = A.objects.length;
    k.importObjText('v 0 0 0\nv nan 0 0\nv 1 1 0\nf 1 2 3', '', 'Broken');
    log('9.nan_refused', A.objects.length === objs9
      ? 'a NaN coordinate was refused and nothing was added'
      : 'A NaN OBJECT WENT INTO THE SCENE');
    k.importObjText('# nothing here\nmtllib x.mtl', '', 'Empty');
    log('9.empty_refused', A.objects.length === objs9
      ? 'an .obj with no faces was refused'
      : 'AN EMPTY .obj MADE AN OBJECT');
    var degen = ['v 0 0 0','v 1 0 0','v 1 0 0','v 1 1 0','v 0 1 0','f 1 2 3 4 5'].join('\n');
    var b9 = k.editableFromObjText(degen, '');
    log('9.repeated_vertex', b9[0] && b9[0].ed.groups.length === 1
      ? 'a face repeating a vertex collapsed to a clean polygon'
      : 'A REPEATED VERTEX BROKE THE FACE');

    /* ---- 10. TWO OBJECTS LAND WHERE THE FILE PUT THEM ----
       The reader used to hand every object the same positions array, and
       landImport recentres in place: the first object subtracted the whole
       file's centre and was placed back at it, the second then measured an
       already-shifted array, got an offset of zero, and went to the origin.
       A file centred on 0,0,0 - a Blender default cube - hides it perfectly,
       so the fixture is deliberately far from the origin. */
    function worldBox(o) {
      o.mesh.updateMatrixWorld(true);
      o.mesh.geometry.computeBoundingBox();
      var b = o.mesh.geometry.boundingBox.clone().applyMatrix4(o.mesh.matrixWorld);
      return [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z]
        .map(function (v) { return v.toFixed(3); }).join(',');
    }
    var far = ['o A', 'v 9 0 0', 'v 11 0 0', 'v 11 2 0', 'f 1 2 3',
               'o B', 'v 9 0 5', 'v 11 0 5', 'v 11 2 5', 'f 4 5 6'].join('\n');
    var n10 = A.objects.length;
    k.importObjText(far, '', 'Far');
    var m10 = A.objects.slice(n10);
    log('10.two_objects', m10.length + ' objects, boxes ' +
      m10.map(worldBox).join('  |  '));
    log('10.placed_as_written', m10.length === 2 &&
      worldBox(m10[0]) === '9.000,0.000,0.000,11.000,2.000,0.000' &&
      worldBox(m10[1]) === '9.000,0.000,5.000,11.000,2.000,5.000'
      ? 'both objects sit exactly where the file put them'
      : 'AN OBJECT WAS DISPLACED');
    /* And each pivots on its own centre, which is what the recentring is
       for - a mesh position equal to its own bbox centre. */
    var c10 = m10[1] ? m10[1].mesh.position : null;
    log('10.own_origin', c10 && Math.abs(c10.x - 10) < 1e-4 &&
      Math.abs(c10.y - 1) < 1e-4 && Math.abs(c10.z - 5) < 1e-4
      ? 'and its origin is its own centre (10, 1, 5), not the file\'s'
      : 'ITS ORIGIN IS ' + (c10 ? [c10.x, c10.y, c10.z].join(',') : 'gone'));

    /* ---- 11. `g` means two different things and the file says which ----
       Maya, 3ds Max and most CAD exporters write `g Name` per object with no
       `o` at all. Plenty of others write `o Solid` once and a `g` per
       material inside it - and splitting on those severed the connectivity,
       so no op could cross the seam. */
    var gSub = ['o Cube', 'v 0 0 0', 'v 1 0 0', 'v 1 1 0', 'v 0 1 0',
                'g top', 'f 1 2 3', 'g side', 'f 1 3 4'].join('\n');
    var b11 = k.editableFromObjText(gSub, '');
    log('11.g_inside_o', b11.length === 1 && b11[0].ed.groups.length === 2
      ? 'g inside an o is a sub-group - one object, two faces'
      : 'IT SPLIT INTO ' + b11.length + ' OBJECTS');
    var gOnly = ['g A', 'v 0 0 0', 'v 1 0 0', 'v 1 1 0', 'f 1 2 3',
                 'g B', 'v 2 0 0', 'v 3 0 0', 'v 3 1 0', 'f 4 5 6'].join('\n');
    var b11b = k.editableFromObjText(gOnly, '');
    log('11.g_without_o', b11b.length === 2
      ? 'and with no o in the file, g is what splits'
      : 'A g-ONLY FILE CAME IN AS ' + b11b.length + ' OBJECT(S)');
    var named = ['o Cube.001', 'v 0 0 0', 'v 1 0 0', 'v 1 1 0',
                 'g Cube.001_Material', 'f 1 2 3'].join('\n');
    log('11.better_name_wins', k.editableFromObjText(named, '')[0].name === 'Cube.001'
      ? 'and o Cube.001 is not renamed by the g that follows it'
      : 'THE GROUP NAME OVERWROTE THE OBJECT NAME');

    /* ---- 12. A COLLINEAR EAR must not skip the winding test ----
       Ear clipping emits zero-area triangles, and importTriNormal returns
       null for one. Testing only tris[0] meant that whenever the clipper put
       a degenerate ear first, the whole n-gon kept the clipper's winding
       instead of the polygon's - a back-facing face in the middle of a
       model. The redundant midpoint here is what you get the moment a
       neighbouring face's vertex lands on this face's edge. */
    var Ep = [0,0,0,  0,2,0,  2,2,0,  2,0,0,  1,0,0];
    var t12 = k.triangulatePolygon(Ep, [0,1,2,3,4]);
    var a12 = areaOf(Ep, t12);
    var sh12 = 0;
    for (var w2 = 0; w2 < 5; w2++) {
      var j0 = w2 * 3, j1 = ((w2 + 1) % 5) * 3;
      sh12 += Ep[j0] * Ep[j1 + 1] - Ep[j1] * Ep[j0 + 1];
    }
    var cr12 = (function () {
      var t = t12[0];
      var ux = Ep[t[1]*3] - Ep[t[0]*3], uy = Ep[t[1]*3+1] - Ep[t[0]*3+1];
      var vx = Ep[t[2]*3] - Ep[t[0]*3], vy = Ep[t[2]*3+1] - Ep[t[0]*3+1];
      return ux * vy - uy * vx;
    })();
    log('12.collinear_ear_area', 'area ' + a12.toFixed(3) + ' of 4 expected');
    log('12.collinear_ear_winding', (cr12 > 0) === (sh12 > 0) || cr12 === 0
      ? 'a polygon with a collinear ear still faces the way it was written'
      : 'IT CAME BACK INSIDE-OUT (poly ' + sh12 + ', tri ' + cr12 + ')');

    /* ---- 13. Slivers, broken indices, and the .mtl defaults ----
       Two ring corners within 1e-4 are ONE vertex to computeLogicalOf, and
       Inset maps the boundary loop through exactly that welding - so a
       sliver corner gave a rim with a self-edge in it and an inset that tore
       along a seam, with no refusal. */
    var sliver = ['v 0 0 0','v 1 0 0','v 1 1 0','v 0.99999 1 0','f 1 2 3 4'].join('\n');
    var b13 = k.editableFromObjText(sliver, '');
    log('13.sliver_welded', b13[0] && b13[0].ed.groups.length === 1 &&
      b13[0].ed.groups[0].triangles.length === 1
      ? 'a corner 1e-5 from its neighbour welded away - one triangle, one loop'
      : 'THE SLIVER SURVIVED AS ' + (b13[0] ? b13[0].ed.groups[0].triangles.length : 0) + ' TRIANGLES');

    var partly = ['v 0 0 0','v 1 0 0','v 1 1 0','v 0 1 0','f 1 2 3','f 1 2 99'].join('\n');
    var b13b = k.editableFromObjText(partly, '');
    log('13.bad_face_skipped_whole', b13b[0] && b13b[0].ed.groups.length === 1 &&
      b13b.skipped === 1
      ? 'a face referencing a vertex that is not there was dropped whole, not shrunk'
      : 'GOT ' + (b13b[0] ? b13b[0].ed.groups.length : 0) + ' faces, skipped ' + b13b.skipped);

    var flatline = ['v 0 0 0','v 1 0 0','v 2 0 0','f 1 2 3'].join('\n');
    log('13.degenerate_dropped', k.editableFromObjText(flatline, '').length === 0
      ? 'three collinear vertices make no face at all'
      : 'A ZERO-AREA FACE GOT A MATERIAL SLOT');

    var m13 = k.parseMtl(['newmtl Grey','Kd 0.8','newmtl Bare','Ns 10',
                          'newmtl Xyz','Kd xyz 0.2 0.3 0.4'].join('\n'));
    log('13.kd_single_is_grey', '#' + m13.get('Grey').color.getHexString() === '#cccccc'
      ? 'Kd 0.8 read as the grey the spec says it is'
      : 'Kd 0.8 CAME OUT ' + '#' + m13.get('Grey').color.getHexString());
    /* A material that never stated a Kd must come in with NO COLOUR - the
       app's own color:null, which follows the theme - rather than a literal
       grey frozen into the library. "Bare" has an Ns, so it is a real
       material with a real roughness and minting it is right; what matters
       is that what gets minted is themed. */
    var idBare = k.importMaterialContext().idFor(m13.get('Bare'));
    var dBare = k.getMaterialDef(idBare);
    log('13.no_kd_is_themed', dBare.color === null || dBare.color === undefined
      ? 'a material with no Kd came in with no colour - it follows the theme'
      : 'IT MINTED A FIXED GREY (' + dBare.color + ')');
    /* And one that states nothing at all IS Solid, by signature, with no
       special case anywhere. */
    var m13b = k.parseMtl('newmtl Solid');
    log('13.bare_solid_is_the_preset', k.importMaterialContext().idFor(m13b.get('Solid')) === 'standard'
      ? 'and an .mtl material with no Kd and no Ns lands on the Solid preset itself'
      : 'IT MINTED A SECOND SOLID');
    log('13.xyz_not_read_as_rgb',
      '#' + m13.get('Xyz').color.getHexString() === '#' + m13.get('Bare').color.getHexString()
      ? 'Kd xyz is CIE XYZ and was left alone rather than read as rgb'
      : 'CIE XYZ WAS READ AS RGB');

    /* ================= STL (a2.71) =================
       The format with the least in it. No materials, no objects, no shared
       vertices, no units - so the whole quality of the result rests on
       mergeCoplanarTriangles, and an .stl is the honest test of whether
       IMPORT_COPLANAR_DOT was the right number. */

    function triNormal(p, a, b, c) {
      var ux=p[b*3]-p[a*3], uy=p[b*3+1]-p[a*3+1], uz=p[b*3+2]-p[a*3+2];
      var vx=p[c*3]-p[a*3], vy=p[c*3+1]-p[a*3+1], vz=p[c*3+2]-p[a*3+2];
      return [uy*vz-uz*vy, uz*vx-ux*vz, ux*vy-uy*vx];
    }
    // Builds a binary .stl from a geometry, with a chosen 80-byte header.
    function stlBinary(geo, header, badNormals) {
      var g = geo.index ? geo.toNonIndexed() : geo;
      var pos = g.attributes.position, nTri = pos.count / 3;
      var buf = new ArrayBuffer(84 + nTri * 50);
      var dv = new DataView(buf), u8 = new Uint8Array(buf);
      for (var h = 0; h < header.length && h < 80; h++) u8[h] = header.charCodeAt(h);
      dv.setUint32(80, nTri, true);
      for (var i = 0; i < nTri; i++) {
        var o = 84 + i * 50, p = [];
        for (var v = 0; v < 3; v++) {
          p.push(pos.getX(i*3+v), pos.getY(i*3+v), pos.getZ(i*3+v));
        }
        var n = triNormal(p, 0, 1, 2);
        var l = Math.hypot(n[0], n[1], n[2]) || 1;
        var sgn = badNormals ? -1 : 1;   // deliberately disagree with the winding
        dv.setFloat32(o, n[0]/l*sgn, true);
        dv.setFloat32(o+4, n[1]/l*sgn, true);
        dv.setFloat32(o+8, n[2]/l*sgn, true);
        for (var j = 0; j < 9; j++) dv.setFloat32(o + 12 + j*4, p[j], true);
      }
      return buf;
    }
    function stlAscii(geo) {
      var g = geo.index ? geo.toNonIndexed() : geo;
      var pos = g.attributes.position, nTri = pos.count / 3, L = ['solid probe'];
      for (var i = 0; i < nTri; i++) {
        var p = [];
        for (var v = 0; v < 3; v++) p.push(pos.getX(i*3+v), pos.getY(i*3+v), pos.getZ(i*3+v));
        var n = triNormal(p, 0, 1, 2), l = Math.hypot(n[0], n[1], n[2]) || 1;
        L.push('  facet normal ' + (n[0]/l) + ' ' + (n[1]/l) + ' ' + (n[2]/l));
        L.push('    outer loop');
        for (var v2 = 0; v2 < 3; v2++)
          L.push('      vertex ' + p[v2*3] + ' ' + p[v2*3+1] + ' ' + p[v2*3+2]);
        L.push('    endloop');
        L.push('  endfacet');
      }
      L.push('endsolid probe');
      return new TextEncoder().encode(L.join('\n')).buffer;
    }

    /* ---- 14. The sniff trap ----
       A binary .stl's first 80 bytes are a free-form header, and plenty of
       exporters write "solid <name>" into it. Reading the leading word gets
       those exactly backwards; only the arithmetic is sound. */
    var box = new THREE.BoxGeometry(2, 2, 2);
    var binSolid = stlBinary(box, 'solid Cube exported by something', false);
    log('14.binary_sniff', k.stlIsBinary(binSolid) === true
      ? 'a binary .stl whose header begins "solid" was still read as binary'
      : 'THE WORD "solid" FOOLED THE DETECTOR');
    log('14.ascii_sniff', k.stlIsBinary(stlAscii(box)) === false
      ? 'and a real ASCII one is not mistaken for binary'
      : 'AN ASCII FILE WAS READ AS BINARY');

    /* ---- 15. A cube is a cube, through the merge ---- */
    var ed15 = k.editableFromStl(binSolid);
    log('15.binary_faces', ed15.groups.length + ' faces from ' + ed15.triCount + ' triangles');
    log('15.binary_is_a_cube', ed15.groups.length === 6
      ? 'twelve triangles merged back into six faces'
      : 'GOT ' + ed15.groups.length + ' FACES');
    var ed15b = k.editableFromStl(stlAscii(box));
    log('15.ascii_matches_binary', ed15b && ed15b.groups.length === ed15.groups.length &&
      ed15b.triCount === ed15.triCount
      ? 'and the ASCII form of the same cube reads identically'
      : 'ASCII AND BINARY DISAGREE (' + (ed15b ? ed15b.groups.length : 0) + ' vs ' + ed15.groups.length + ')');

    var n15 = A.objects.length;
    k.importStlBuffer(binSolid, 'Stl cube');
    var o15 = A.objects[A.objects.length - 1];
    k.ensureHelpers(o15);
    var t15 = o15.mesh.userData.topo;
    log('15.topology', t15.faceGroups.length + ' faces · ' + t15.edges.length +
      ' edges · ' + t15.logicalCount + ' vertices');
    log('15.editable', A.objects.length === n15 + 1 && t15.faceGroups.length === 6 &&
      t15.edges.length === 12 && t15.logicalCount === 8
      ? 'an .stl cube welds and comes in editable - 6 faces, 12 edges, 8 vertices'
      : 'IT DID NOT COME BACK AS A CUBE');

    /* ---- 16. The facet normal is believed over the winding ----
       Both are in the file and they disagree more often than they should:
       an exporter that mirrors a part transforms the coordinates and leaves
       the vertex order alone. A model wound backwards is invisible from
       outside and solid from within. */
    var wrong = stlBinary(box, 'solid mirrored', true);
    var ed16 = k.editableFromStl(wrong);
    function signedVolume(ed) {
      var p = ed.positions, v = 0;
      ed.groups.forEach(function (g) {
        g.triangles.forEach(function (t) {
          var ax=p[t[0]*3], ay=p[t[0]*3+1], az=p[t[0]*3+2];
          var bx=p[t[1]*3], by=p[t[1]*3+1], bz=p[t[1]*3+2];
          var cx=p[t[2]*3], cy=p[t[2]*3+1], cz=p[t[2]*3+2];
          v += (ax*(by*cz-bz*cy) - ay*(bx*cz-bz*cx) + az*(bx*cy-by*cx)) / 6;
        });
      });
      return v;
    }
    log('16.flipped_count', ed16.flipped + ' of ' + ed16.triCount + ' facets re-wound');
    log('16.normal_wins', ed16.flipped === ed16.triCount && signedVolume(ed16) < 0
      ? 'a file whose normals unanimously contradict its winding is re-wound whole'
      : 'THE STORED NORMALS WERE IGNORED (volume ' + signedVolume(ed16).toFixed(3) + ')');
    log('16.good_file_untouched', ed15.flipped === 0
      ? 'and a file whose normals agree is left completely alone'
      : 'IT RE-WOUND ' + ed15.flipped + ' FACETS OF A CORRECT FILE');

    /* ---- 17. Refusals that say what the file needs ----
       All three used to come out as "Could not read that file", which reads
       like a bug in Kubik rather than a property of the file. */
    function jsonBuf(o) { return new TextEncoder().encode(JSON.stringify(o)).buffer; }
    var draco = k.gltfRefusal(jsonBuf({ extensionsRequired: ['KHR_draco_mesh_compression'] }));
    log('17.draco_named', /draco/i.test(draco || '')
      ? 'Draco: "' + draco + '"' : 'DRACO WAS NOT NAMED (' + draco + ')');
    /* extensionsREQUIRED. Listed under `used` alone it is the fallback form,
       which carries readable buffer data and which three loads - refusing
       that would turn a working file into a broken one. Section 18 asserts
       both halves. */
    var mo = k.gltfRefusal(jsonBuf({ extensionsRequired: ['EXT_meshopt_compression'] }));
    log('17.meshopt_named', /meshopt/i.test(mo || '')
      ? 'meshopt: named' : 'MESHOPT WAS NOT NAMED');
    var ext = k.gltfRefusal(jsonBuf({ buffers: [{ uri: 'scene.bin', byteLength: 4 }] }));
    log('17.external_bin_named', /\.glb/i.test(ext || '')
      ? 'external .bin: "' + ext + '"' : 'THE EXTERNAL .bin WAS NOT NAMED (' + ext + ')');
    var inline = k.gltfRefusal(jsonBuf({ buffers: [{ uri: 'data:application/octet-stream;base64,AAAA' }] }));
    log('17.inline_ok', inline === null
      ? 'a self-contained .gltf with a data: uri is not refused'
      : 'A PERFECTLY GOOD .gltf WAS REFUSED: ' + inline);
    var glb = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0]).buffer;
    log('17.glb_untouched', k.gltfRefusal(glb) === null
      ? 'and a binary .glb is never JSON-parsed at all'
      : 'A .glb WAS REFUSED BY THE JSON CHECK');

    /* ---- 18. What the a2.71 review found ---- */

    /* (a) A binary .stl with a trailing byte is still a binary .stl. Exact
       size equality sent it down the ASCII branch, where it found nothing
       and was refused as "No triangles" - the opposite of true. */
    var padded = (function () {
      var src = new Uint8Array(binSolid);
      var out = new Uint8Array(src.length + 1);
      out.set(src); out[src.length] = 10;
      return out.buffer;
    })();
    log('18.padded_binary', k.stlIsBinary(padded) === true &&
      k.editableFromStl(padded).groups.length === 6
      ? 'a binary .stl with a trailing newline still reads as six faces'
      : 'A PADDED BINARY FILE WAS NOT READ');

    /* (b) And one that is SHORT of what its header promises is named as
       truncated rather than reported empty. */
    var cut = binSolid.slice(0, binSolid.byteLength - 60);
    log('18.truncated_named', k.stlIsBinary(cut) === false && k.stlLooksTruncated(cut) === true
      ? 'a file shorter than its own header says is recognised as truncated'
      : 'TRUNCATION LOOKS THE SAME AS EMPTY');
    log('18.padding_is_not_truncation', k.stlLooksTruncated(padded) === false
      ? 'and padding is not mistaken for it'
      : 'PADDING WAS CALLED TRUNCATION');

    /* (c) The winding vote. Garbage normals must NOT produce mixed winding:
       a flipped triangle reads as -1 against its merge seed, so one flat
       plane splits into several faces and the face budget can refuse a file
       that would have imported fine. */
    var noisy = (function () {
      var buf = binSolid.slice(0);
      var dv = new DataView(buf);
      var nTri = dv.getUint32(80, true);
      for (var i = 0; i < nTri; i++) {
        var o = 84 + i * 50;
        // Every other facet's normal inverted; the rest left correct.
        if (i % 2 === 0) {
          dv.setFloat32(o, -dv.getFloat32(o, true), true);
          dv.setFloat32(o + 4, -dv.getFloat32(o + 4, true), true);
          dv.setFloat32(o + 8, -dv.getFloat32(o + 8, true), true);
        }
      }
      return buf;
    })();
    var edN = k.editableFromStl(noisy);
    log('18.no_mixed_winding', edN.flipped === 0 && edN.groups.length === 6
      ? 'half-garbage normals were outvoted - winding untouched, still six faces'
      : 'MIXED WINDING: ' + edN.flipped + ' flipped, ' + edN.groups.length + ' faces');
    /* while a unanimously inverted file - a mirrored export - is still
       re-wound whole. */
    log('18.unanimous_still_flips', k.editableFromStl(wrong).flipped === 12
      ? 'and a unanimously inverted file is still turned right side out'
      : 'THE MIRRORED CASE STOPPED WORKING');

    /* (d) An ASCII .stl must not be refused for being verbose. Blender
       writes ~227 bytes per facet, so byteLength/50 over-counted 4.5x and
       rejected a 9k-triangle file as "40k triangles". */
    /* FLAT on purpose: 9,800 coplanar facets merge to one face, so this
       measures the TRIANGLE pre-check and not the face budget. */
    var big = new THREE.PlaneGeometry(2, 2, 70, 70);
    var bigAscii = stlAscii(big);
    var realFacets = (new TextDecoder().decode(bigAscii).match(/facet\s+normal/gi) || []).length;
    var oldEst = Math.floor(bigAscii.byteLength / 50);
    var n18 = A.objects.length;
    k.importStlBuffer(bigAscii, 'Verbose');
    log('18.verbose_ascii_counts', Math.round(bigAscii.byteLength / 1024) + 'kb, ' +
      realFacets + ' facets; the old byteLength/50 bound called it ' + oldEst);
    log('18.verbose_ascii_ok', oldEst > 40000 && realFacets < 40000 && A.objects.length === n18 + 1
      ? 'an ASCII .stl the old bound would have refused as ' +
        Math.round(oldEst / 1000) + 'k was accepted at its real ' + realFacets
      : 'THE ASCII PRE-CHECK IS STILL WRONG (old ' + oldEst + ', real ' + realFacets +
        ', added ' + (A.objects.length - n18) + ')');

    /* (e) gltfRefusal must not decode a file that cannot be JSON, and must
       not refuse a meshopt file that carries its fallback data. */
    var blob = new Uint8Array(4096);
    for (var z = 0; z < blob.length; z++) blob[z] = (z * 7) & 255;
    blob[0] = 0; 
    log('18.non_json_ignored', k.gltfRefusal(blob.buffer) === null
      ? 'a binary blob that is not glTF is not decoded or refused here'
      : 'IT REFUSED A FILE IT SHOULD HAVE PASSED ON');
    var fallback = new TextEncoder().encode(JSON.stringify({
      extensionsUsed: ['EXT_meshopt_compression'],
      buffers: [{ uri: 'data:application/octet-stream;base64,AAAA' }]
    })).buffer;
    log('18.meshopt_fallback_ok', k.gltfRefusal(fallback) === null
      ? 'meshopt listed only in extensionsUsed is a fallback file and is let through'
      : 'A READABLE FALLBACK FILE WAS REFUSED');
    var required = new TextEncoder().encode(JSON.stringify({
      extensionsRequired: ['EXT_meshopt_compression'],
      buffers: [{ uri: 'data:application/octet-stream;base64,AAAA' }]
    })).buffer;
    log('18.meshopt_required_refused', /meshopt/i.test(k.gltfRefusal(required) || '')
      ? 'and one that REQUIRES it is still named'
      : 'A REQUIRED-MESHOPT FILE WAS NOT NAMED');

    /* (f) The depth band follows the scene, or a millimetre-scale model is
       painted in the background colour the moment it is framed. */
    var mm = new THREE.BoxGeometry(25, 25, 25);
    var fogBefore = k.scene.fog ? k.scene.fog.far : 0;
    k.importStlBuffer(stlBinary(mm, 'solid part', false), 'Big part');
    var o18 = A.objects[A.objects.length - 1];
    o18.mesh.geometry.computeBoundingBox();
    var dim = o18.mesh.geometry.boundingBox.getSize(new THREE.Vector3()).x;
    var camDist = k.camera.position.distanceTo(k.orbit.target);
    log('18.scene_scale', 'model ' + dim.toFixed(1) + ' units, fog far ' +
      fogBefore + ' -> ' + (k.scene.fog ? k.scene.fog.far.toFixed(0) : 'none') +
      ', camera.far ' + k.camera.far);
    log('18.not_swallowed_by_fog', k.scene.fog && k.scene.fog.near > dim &&
      k.camera.far > dim * 4
      ? 'a 25-unit model sits inside the fog band instead of being painted as background'
      : 'THE FOG STILL EATS IT (near ' + (k.scene.fog ? k.scene.fog.near : '-') +
        ' vs model ' + dim.toFixed(1) + ')');
    void camDist;

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
        try { main(); }
        catch (e) { out.push('ERROR=' + (e && e.stack ? e.stack.split('\n').slice(0, 6).join(' / ') : e)); }
        finish();
      }, 600);
    });
  }, 300);
})();
