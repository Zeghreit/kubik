/* v2.5: a picture of the view. The questions are (1) is there a seat for it,
   (2) does the shot leave the workshop out and put it straight back, (3) is
   the PNG a real picture rather than the blank one preserveDrawingBuffer
   hands you if the read slips a tick, and (4) does it go out the same way
   every other file does. Verified against _bak_v24.html, where there is no
   button and no function and every section fails. */
(function () {
  const lines = [];
  const say = (s) => lines.push(s);
  let pass = 0, fail = 0;
  const ok = (name, good, detail) => {
    (good ? pass++ : fail++);
    say((good ? '  ok    ' : '  FAIL  ') + name.padEnd(40) + (detail || ''));
  };
  let done = false;
  function finish() {
    if (done) return; done = true;
    say('');
    say(fail ? 'VERDICT=FAIL (' + fail + ' of ' + (pass + fail) + ')'
             : 'VERDICT=PASS (' + pass + ' checks)');
    try { fetch('/report', { method: 'POST', body: lines.join('\n') }); } catch (_) {}
  }
  window.addEventListener('error', (e) => say('PAGE ERROR ' + e.message));
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // How many pixels of an image are not its top-left corner colour. A blank
  // PNG decodes perfectly well - that is the whole trap - so counting is the
  // only honest way to ask whether there is a model in the shot.
  async function inkOf(dataUrl) {
    const img = new Image();
    const loaded = await new Promise(r => {
      img.onload = () => r(true); img.onerror = () => r(false); img.src = dataUrl;
    });
    if (!loaded) return { w: 0, h: 0, ink: 0 };
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, c.width, c.height).data;
    const r0 = px[0], g0 = px[1], b0 = px[2];
    let ink = 0;
    for (let i = 0; i < px.length; i += 4) {
      if (Math.abs(px[i] - r0) + Math.abs(px[i + 1] - g0) + Math.abs(px[i + 2] - b0) > 12) ink++;
    }
    return { w: c.width, h: c.height, ink: ink };
  }

  const asDataUrl = (blob) => new Promise(r => {
    const fr = new FileReader();
    fr.onload = () => r(String(fr.result));
    fr.readAsDataURL(blob);
  });

  async function boot() {
    const K = window.__kubik;

    // ---- 1. is there a seat for it ---------------------------------------
    say('1. the seat');
    const btn = document.getElementById('btnShot');
    ok('a button in the drawer', !!btn, btn ? btn.textContent : 'absent');
    ok('inside the Files section', !!(btn && btn.closest('.drawer-sec') &&
       /Files/.test(btn.closest('.drawer-sec').textContent)));
    ok('savePictureAction exists', typeof K.savePictureAction === 'function');
    ok('pictureHiddenParts exists', typeof K.pictureHiddenParts === 'function');
    if (typeof K.savePictureAction !== 'function') { finish(); return; }

    // ---- 2. what goes dark, and what comes back --------------------------
    say('');
    say('2. the workshop leaves the shot and comes straight back');
    const scene = K.scene, App = K.App;
    const grid = scene.children.find(o => o.type === 'GridHelper');
    ok('there is a grid to hide', !!grid);
    const obj = App.objects[0];
    ok('and a model to photograph', !!obj, obj ? obj.name : 'none');
    K.ensureHelpers(obj);
    const dots = obj.mesh.userData.vertexPoints;
    dots.visible = true;        // as Vertex mode leaves it
    if (grid) grid.visible = true;

    const hid = [];
    K.pictureHiddenParts(hid);
    ok('the grid goes dark', !!grid && grid.visible === false);
    ok('so do the model-s own dots', dots.visible === false);
    ok('the model itself does not', obj.mesh.visible === true);
    ok('and the lights do not', scene.children.every(o => !o.isLight || o.visible));
    ok('it hands back what it hid', hid.length >= 2, hid.length + ' object(s)');
    hid.forEach(o => { o.visible = true; });

    // ---- 3. the picture itself -------------------------------------------
    say('');
    say('3. the PNG');
    /* The workshop as it stands, for comparison - rendered and read in the
       same tick, which is the rule the shot itself has to keep. */
    K.renderer.render(K.scene, K.camera);
    const workshop = K.renderer.domElement.toDataURL('image/png');

    const realCreate = URL.createObjectURL, realRevoke = URL.revokeObjectURL;
    const realClick = HTMLAnchorElement.prototype.click;
    let blob = null, name = null, downloads = 0;
    URL.createObjectURL = function (b) { blob = b; return 'blob:probe'; };
    URL.revokeObjectURL = function () {};
    HTMLAnchorElement.prototype.click = function () {
      if (this.download) { downloads++; name = this.download; } else realClick.call(this);
    };

    K.savePictureAction();
    /* Read in the SAME TASK, before any await - the buffer is gone after it.
       This is the frame the browser is about to composite, so if the second
       render is missing it is the dimmed one and the grid blinks. */
    const after = K.renderer.domElement.toDataURL('image/png');
    await sleep(60);

    ok('one file leaves', downloads === 1, downloads + ' download(s)');
    ok('named for what it is', name === 'kubik-picture.png', String(name));
    ok('carrying the mime type', !!blob && blob.type === 'image/png', blob ? blob.type : 'no blob');
    let shot = '';
    if (blob) {
      const u8 = new Uint8Array(await blob.arrayBuffer());
      ok('and it really is a PNG', u8[0] === 0x89 && u8[1] === 0x50 &&
         u8[2] === 0x4E && u8[3] === 0x47, u8.length + ' bytes');
      ok('not a token amount of one', u8.length > 2000, u8.length + ' bytes');
      shot = await asDataUrl(blob);
    }

    if (shot) {
      const a = await inkOf(shot), b = await inkOf(workshop);
      ok('the same size as the viewport', a.w === b.w && a.h === b.h && a.w > 100,
         a.w + 'x' + a.h);
      /* THE TRAP. preserveDrawingBuffer is false, so a read one tick late
         decodes into a perfectly good picture of nothing. */
      ok('there is a model in it', a.ink > 2000, a.ink + ' pixels of model');
      ok('and the workshop is not', a.ink < b.ink, a.ink + ' vs ' + b.ink + ' with the grid');
      ok('so the two pictures differ', shot !== workshop);
    }

    // ---- 4. and afterwards ------------------------------------------------
    say('');
    say('4. afterwards');
    ok('the grid is back', !!grid && grid.visible === true);
    ok('the dots are back', dots.visible === true);
    ok('and drawn back in the same task', after === workshop,
       after === workshop ? '' : 'the dimmed frame would have been composited');
    dots.visible = false;

    // Nothing to photograph is a message, not a blank PNG.
    const keep = App.objects;
    App.objects = [];
    downloads = 0; blob = null;
    K.savePictureAction();
    await sleep(40);
    App.objects = keep;
    ok('an empty scene saves nothing', downloads === 0 && !blob, downloads + ' download(s)');

    /* A THROW HALF WAY THROUGH THE HIDING. An object with no mesh gets past
       the keep walk and past the scene sweep - so the grid is already dark -
       and throws on the children pass. The workshop still has to come back. */
    if (grid) grid.visible = true;
    App.objects.push({ id: -1, name: 'broken', mesh: null });
    downloads = 0; blob = null;
    K.savePictureAction();
    await sleep(40);
    App.objects.pop();
    ok('a throw mid-hide gives the grid back', !!grid && grid.visible === true);
    ok('and saves nothing', downloads === 0 && !blob, downloads + ' download(s)');

    URL.createObjectURL = realCreate;
    URL.revokeObjectURL = realRevoke;
    HTMLAnchorElement.prototype.click = realClick;
    finish();
  }
  const go = () => setTimeout(() => { boot().catch(e => { say('THREW ' + e.message + '\n' + e.stack); finish(); }); }, 2200);
  if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
})();
