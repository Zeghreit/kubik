/* Stage 2 of the UV plan: what a real textured model costs.

   WHAT THIS HARNESS CAN AND CANNOT ANSWER, said first, because half of the
   plan's stage 2 is not measurable here and reporting a number anyway would
   be worse than reporting none.

     CAN  - counts and CPU-side cost: draw calls, triangles, shader programs,
            geometries and textures held, the cost of an OP (every one funnels
            through rebuildFromEditable), the cost of a finger pick, the size
            of a history step, and the weight of what the autosave writes.
     CANNOT - fps, heat, and how a touch feels. This runs headless on
            SwiftShader, a software rasteriser: its frame time is a number
            about this CPU, not about a phone's GPU, and quoting it as "fps"
            would be the stale-estimate failure this project keeps a list of.
            Those three need the phone in Zeghreit's hand.

   So the frame time below is printed as what it is - a software raster cost,
   useful only against ITSELF between two builds - and never as fps. */
(function () {
  var out = [], errs = [], done = false, at = 'start';
  window.addEventListener('error', function (e) { errs.push(e.message); });
  window.addEventListener('unhandledrejection', function (e) {
    errs.push('rejected: ' + (e.reason && e.reason.message ? e.reason.message : e.reason));
  });
  setTimeout(function () { if (!done) { out.push('WATCHDOG at ' + at); finishUp(); } }, 120000);
  function log(s) { out.push(s); }
  function mark(s) { at = s; }
  function pad(s, n) { s = String(s); while (s.length < n) s += ' '; return s; }
  /* A CLOCK THAT DOES NOT MOVE PRINTS ITS OWN NAME. The first run of this
     probe reported every timing as "0ms" - it inherited a runner that uses
     --virtual-time-budget, under which performance.now() does not advance
     across synchronous work. The runner is fixed; this stays so that a future
     one cannot quietly report free work again. */
  function ms(x) {
    if (!(x > 0.0005)) return 'UNMEASURABLE (the clock did not move)';
    return (Math.round(x * 100) / 100) + 'ms';
  }
  function kb(x) { return Math.round(x / 1024) + 'kb'; }

  async function main() {
    var k = window.__kubik, A = k.App, THREE = k.THREE;
    function sleep(t) { return new Promise(function (r) { setTimeout(r, t); }); }
    function clearScene() { A.objects.slice().forEach(function (o) { k.removeObjects([o]); }); }

    /* A sheet with real detail in it. A flat colour compresses to nothing and
       would make every byte measured below a lie about what a textured model
       weighs. */
    function sheet(size, tint) {
      var c = document.createElement('canvas');
      c.width = c.height = size;
      var g = c.getContext('2d');
      g.fillStyle = tint; g.fillRect(0, 0, size, size);
      var im = g.createImageData(size, size);
      for (var i = 0; i < im.data.length; i += 4) {
        var v = (Math.random() * 90) | 0;
        im.data[i] = v + 90; im.data[i + 1] = v + 80; im.data[i + 2] = v + 100;
        im.data[i + 3] = 255;
      }
      g.putImageData(im, 0, 0);
      g.globalAlpha = 0.35; g.fillStyle = tint; g.fillRect(0, 0, size, size);
      g.globalAlpha = 1;
      return c;
    }
    function tex(cvs, srgb) {
      var t = new THREE.CanvasTexture(cvs);
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.flipY = false;
      return t;
    }

    /* ---- the fixture: ~20 shells, ~7k triangles, UVs and maps ---- */
    mark('fixture');
    clearScene();
    var SHELLS = 20;
    var base = sheet(1024, '#b08040'), nrm = sheet(1024, '#8080ff'), rgh = sheet(1024, '#909090');
    var mats = [];
    for (var m = 0; m < 4; m++) {
      var mt = new THREE.MeshStandardMaterial({
        name: 'Heavy ' + (m + 1), color: 0xffffff, roughness: 0.5, metalness: m === 3 ? 0.9 : 0.1
      });
      mt.map = tex(base, true);
      mt.normalMap = tex(nrm, false);
      mt.roughnessMap = tex(rgh, false);
      mats.push(mt);
    }
    var grp = new THREE.Group();
    for (var i = 0; i < SHELLS; i++) {
      var geo = new THREE.SphereGeometry(0.5, 16, 10);
      var mesh = new THREE.Mesh(geo, mats[i % mats.length]);
      mesh.position.set((i % 5) * 1.4 - 2.8, Math.floor(i / 5) * 1.4 - 2.1, 0);
      grp.add(mesh);
    }
    grp.updateMatrixWorld(true);
    var t0 = performance.now();
    // flat: one object per mesh, which is what "20 shells" means
    var parts = k.collectImportableMeshes(grp, true), built = [];
    parts.forEach(function (p) {
      var ed = k.editableFromImportedMeshes(p.meshes);
      if (ed && ed.groups.length) built.push({ name: p.name, ed: ed });
    });
    k.landImport(built, 'Heavy');
    var landMs = performance.now() - t0;
    await sleep(500);

    var tris = 0, faces = 0, withUV = 0;
    A.objects.forEach(function (o) {
      var g = o.mesh.geometry;
      tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
      faces += k.faceCount(g);
      if (g.getAttribute('uv')) withUV++;
    });
    log('=== the fixture ===');
    log('  ' + A.objects.length + ' objects, ' + tris + ' triangles, ' + faces +
      ' faces, ' + withUV + ' with UVs, landed in ' + ms(landMs));
    log('  library ' + k.MATERIALS.size + ' materials, store ' + k.TEX_STORE.size + ' pictures');
    if (A.objects.length < 10 || tris < 3000) {
      log('  THE FIXTURE IS NOT HEAVY - every number below is about something else');
      finishUp(); return;
    }

    /* ---- what the GPU is asked for ---- */
    mark('draw');
    k.camera.position.set(0, 0, 9);
    k.camera.lookAt(0, 0, 0);
    k.camera.updateMatrixWorld(true);
    function draw() { k.renderer.render(k.scene, k.camera); }
    draw(); await sleep(300); draw();      // warm: JIT, and the lazy edge field
    var info = k.renderer.info;
    var t1 = performance.now();
    for (var f = 0; f < 30; f++) draw();
    var frameMs = (performance.now() - t1) / 30;
    log('');
    log('=== what one frame asks for ===');
    log('  ' + info.render.calls + ' draw calls, ' + info.render.triangles +
      ' triangles rasterised, ' + info.programs.length + ' shader programs');
    log('  ' + info.memory.geometries + ' geometries and ' + info.memory.textures +
      ' textures held');
    log('  software raster ' + ms(frameMs) + ' a frame - THIS CPU, not a phone GPU;' +
      ' comparable only against another run of this probe');

    /* ---- what the pictures cost ---- */
    mark('vram');
    var urlBytes = 0, texels = 0;
    k.TEX_STORE.forEach(function (e) {
      urlBytes += e.url.length;
      e.tex.forEach(function () { texels += 1; });
    });
    // Every store entry, at TEX_MAX, uploaded once per colour space it is
    // asked for, with mipmaps (the 4/3 tail).
    var vram = 0;
    k.TEX_STORE.forEach(function (e) {
      var n = 0; e.tex.forEach(function () { n++; });
      vram += (n || 1) * k.TEX_MAX * k.TEX_MAX * 4 * 4 / 3;
    });
    log('');
    log('=== what the pictures cost ===');
    log('  ' + kb(urlBytes) + ' of data URL held in strings for the session');
    log('  ~' + Math.round(vram / 1048576) + 'MB of video memory, at ' + k.TEX_MAX +
      ' square with mipmaps, over ' + texels + ' uploads');

    /* ---- what an OP costs. Every one funnels through rebuildFromEditable. ---- */
    mark('op');
    var victim = A.objects[0];
    var ed0 = k.toEditable(victim.mesh);
    var t2 = performance.now();
    for (var r = 0; r < 5; r++) k.rebuildFromEditable(victim, k.toEditable(victim.mesh));
    var rebuildMs = (performance.now() - t2) / 5;
    log('');
    log('=== what one operation costs ===');
    log('  rebuildFromEditable on one ' + (k.faceCount(victim.mesh.geometry)) +
      '-face shell: ' + ms(rebuildMs));

    /* ---- what a finger costs ---- */
    mark('pick');
    A.activeObjectId = victim.id;
    A.selectedObjectIds = new Set([victim.id]);
    k.setMode('vertex');
    k.ensureHelpers(victim);
    var rect = k.viewportRect ? k.viewportRect() : { left: 0, top: 0, width: 512, height: 900 };
    var ev = { clientX: rect.left + rect.width * 0.5, clientY: rect.top + rect.height * 0.5 };
    var t3 = performance.now();
    var hits = 0;
    for (var p = 0; p < 40; p++) { if (k.pickVertexOnActive(ev) != null) hits++; }
    var pickMs = (performance.now() - t3) / 40;
    log('');
    log('=== what a finger costs ===');
    log('  pickVertexOnActive: ' + ms(pickMs) + ' a tap (' + hits + '/40 found something)' +
      ', BVH ' + (k.bvhUsable ? 'usable' : 'not usable'));

    /* ---- what the document costs, which is the new part ---- */
    mark('doc');
    var t4 = performance.now();
    var doc = k.serializeDoc();
    var serMs = performance.now() - t4;
    var step = k.estimateDocBytes(doc);
    var plainLen = JSON.stringify(doc).length;
    var withTex = JSON.stringify(k.serializeDoc({ withTextures: true })).length;
    var saved = 0;
    try { saved = (localStorage.getItem('kubik.autosave') || '').length; } catch (e) {}
    var lib = 0;
    try { lib = (localStorage.getItem('kubik.materials.v1') || '').length; } catch (e) {}
    var texLib = 0;
    try { texLib = (localStorage.getItem('kubik.textures.v1') || '').length; } catch (e) {}
    log('');
    log('=== what the document costs ===');
    log('  serializeDoc ' + ms(serMs) + ', estimateDocBytes says ' + kb(step) + ' a step');
    log('  the step as JSON: ' + kb(plainLen) + '; the same doc WITH pictures: ' + kb(withTex));
    log('  localStorage: autosave ' + kb(saved) + ', library ' + kb(lib) +
      ', textures ' + kb(texLib) + ' - about ' + kb(saved + lib + texLib) +
      ' of a ~5MB origin quota');
    var steps = Math.floor(48 * 1024 * 1024 / Math.max(1, step));
    log('  at that size the 48MB history ceiling is ' + steps + ' steps' +
      (steps > 60 ? ' - past the 60-step cap, so the cap is what bites first' :
        ' - BEFORE the 60-step cap, so the BYTES bite first'));

    /* ---- the quota, MEASURED rather than remembered ----
       "about 5MB" is the number everyone quotes and no two browsers agree on;
       whether the texture store needs to leave localStorage is decided by the
       real one. This runs in a throwaway profile, so filling it costs nothing
       that outlives the probe. */
    mark('quota');
    var probeKey = '__kubik_quota_probe';
    var chunk = new Array(64 * 1024 + 1).join('x');   // 64k of UTF-16
    var wrote = 0;
    try {
      for (var q = 0; q < 512; q++) {
        localStorage.setItem(probeKey + q, chunk);
        wrote += chunk.length;
      }
    } catch (e) { /* the ceiling */ }
    var already = saved + lib + texLib;
    for (var q2 = 0; q2 < 512; q2++) {
      try { localStorage.removeItem(probeKey + q2); } catch (e) {}
    }
    log('');
    log('=== the quota, measured in this browser ===');
    log('  ' + kb(wrote) + ' more would go in on top of the ' + kb(already) +
      ' already there - a ceiling of about ' + kb(wrote + already));
    var perPic = k.TEX_STORE.size ? urlBytes / k.TEX_STORE.size : 0;
    var room = perPic > 0 ? Math.floor((wrote + already) / perPic) : 0;
    log('  at ' + kb(perPic) + ' a picture, that is room for about ' + room +
      ' of them in total' +
      (room < 12 ? ' - a character with two materials and four maps each does not fit' : ''));

    /* ---- and the question stage 2 exists to answer ---- */
    log('');
    log('=== what only the phone can answer ===');
    log('  fps and heat on a real GPU, and whether a vertex tap feels immediate.');
    log('  Recipe: open the live URL on the phone, import a 5-10k model with maps,');
    log('  orbit for a minute, then tap vertices. Anything above is CPU and bytes.');

    finishUp();
  }

  function finishUp() {
    if (done) return;
    done = true;
    out.push('');
    out.push('VERDICT=MEASURED');
    out.push('page.errors=' + (errs.length ? errs.join(' | ').slice(0, 400) : 'none'));
    try { fetch('/report', { method: 'POST', body: out.join('\n') }); } catch (e) {}
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
