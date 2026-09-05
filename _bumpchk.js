/* v2.6: normals from the masks. A mask is a greyscale field and a normal is
   its slope, so the questions are (1) is there a control, (2) does Bump on
   its own make a mask live and actually texture the surface, (3) does it go
   away completely when it is turned off, (4) does it COMPOSE with Round
   edges rather than replace it, (5) does it hold its strength as the camera
   moves - which is the whole reason the sigmas are left unnormalised - and
   (6) does a mask with no bump still serialise byte for byte as it did.
   Verified against _bak_v25.html, where there is no control and no uniform. */
(function () {
  const lines = [];
  const say = (s) => lines.push(s);
  let pass = 0, fail = 0;
  const ok = (name, good, detail) => {
    (good ? pass++ : fail++);
    say((good ? '  ok    ' : '  FAIL  ') + name.padEnd(42) + (detail || ''));
  };
  let done = false;
  const errs = [];
  function finish() {
    if (done) return; done = true;
    say('');
    say(fail ? 'VERDICT=FAIL (' + fail + ' of ' + (pass + fail) + ')'
             : 'VERDICT=PASS (' + pass + ' checks)');
    try { fetch('/report', { method: 'POST', body: lines.join('\n') }); } catch (_) {}
  }
  window.addEventListener('error', (e) => errs.push('window: ' + e.message));
  const realErr = console.error;
  console.error = function () { errs.push(Array.prototype.join.call(arguments, ' ')); realErr.apply(console, arguments); };
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  let K = null;

  /* A clean frame, borrowed whole from v2.5's picture: the grid and every
     overlay out, so a statistic over the picture is a statistic about the
     SURFACE and not about how much grid happens to be behind it. Rendered
     and read in one tick, because the viewport does not preserve its
     drawing buffer. */
  function frame() {
    const hid = [];
    K.pictureHiddenParts(hid);
    K.renderer.render(K.scene, K.camera);
    const url = K.renderer.domElement.toDataURL('image/png');
    hid.forEach(o => { o.visible = true; });
    return url;
  }

  /* Mean and spread of luminance over the MODEL's pixels only - anything
     that is not the corner colour. A bump does not change how bright a face
     is on average; it changes how much the brightness VARIES across it,
     which is the number that says there is now a surface there. */
  async function stats(url) {
    const img = new Image();
    await new Promise(r => { img.onload = () => r(); img.onerror = () => r(); img.src = url; });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, c.width, c.height).data;
    const r0 = px[0], g0 = px[1], b0 = px[2];
    let n = 0, s = 0, s2 = 0;
    for (let i = 0; i < px.length; i += 4) {
      if (Math.abs(px[i] - r0) + Math.abs(px[i + 1] - g0) + Math.abs(px[i + 2] - b0) <= 12) continue;
      const L = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
      n++; s += L; s2 += L * L;
    }
    const m = n ? s / n : 0;
    return { n: n, mean: m, sd: n ? Math.sqrt(Math.max(0, s2 / n - m * m)) : 0 };
  }

  const box = (id) => document.getElementById(id);
  function setBump(on) {
    const b = box('mkBumpOn');
    b.checked = !!on;
    b.dispatchEvent(new Event('change'));
  }

  async function boot() {
    K = window.__kubik;

    // ---- 1. the control ---------------------------------------------------
    say('1. the control');
    const chk = box('mkBumpOn'), sld = box('mkBump');
    ok('a Bump checkbox', !!chk);
    ok('and a depth slider', !!sld, sld ? sld.min + '..' + sld.max : 'absent');
    ok('beside Colour and Roughness', !!(chk && chk.closest('#meMask') &&
       box('mkRoughOn') && box('mkRoughOn').closest('#meMask')));
    if (!chk || !sld) { finish(); return; }

    // ---- 2. a mask with nothing switched on --------------------------------
    say('');
    say('2. Bump alone makes a mask live');
    /* The camera put where the cube fills a useful part of the frame, so the
       statistics below are about the surface and not about a hundred pixels
       of it. */
    K.camera.position.set(1.9, 1.5, 2.5);
    K.orbit.target.set(0, 0.5, 0);
    K.orbit.update();
    K.camera.updateMatrixWorld();

    const d = K.getMaterialDef('standard');
    /* A cloth mask with NO component switched on. maskOf says a mask like
       this does not paint, so the material carries no shader patch at all -
       which is the baseline Bump has to be able to move on its own. */
    d.masks = [{ on: true, type: 'fbm', blend: 'normal',
                 colorOn: false, color: '#7a4a20', roughOn: false, rough: 0.25,
                 amount: 1, scale: 2, detail: 4, contrast: 1.4, nscale: 1, seed: 3 }];
    K.rebakeMaskTexture(d);
    K.openMatEditor('standard');
    await sleep(120);
    const masksBefore = JSON.stringify(d.masks);
    const sigBefore = K.materialDefSig(d);
    ok('the box starts clear', chk.checked === false);

    const imgNone = frame();
    const sNone = await stats(imgNone);
    ok('there is a model in frame', sNone.n > 20000, sNone.n + ' pixels');

    setBump(true);
    await sleep(120);
    ok('ticking it writes a depth', d.masks[0].bump > 0, String(d.masks[0].bump));
    const imgBump = frame();
    const sBump = await stats(imgBump);
    ok('the picture changes', imgBump !== imgNone);
    /* THE MEASUREMENT THAT MATTERS. A flat face lit by one key light is
       nearly uniform; a bumped one is not. */
    ok('the surface gains texture', sBump.sd > sNone.sd * 1.5,
       'spread ' + sNone.sd.toFixed(2) + ' -> ' + sBump.sd.toFixed(2));
    ok('and does not just go dark', Math.abs(sBump.mean - sNone.mean) < 40,
       'mean ' + sNone.mean.toFixed(1) + ' -> ' + sBump.mean.toFixed(1));

    // ---- 3. the strength does not depend on how close you stand -----------
    say('');
    say('3. it holds its strength as the camera moves');
    const near = K.camera.position.clone();
    K.camera.position.set(0.95, 0.75, 1.25);   // half the distance
    K.orbit.update(); K.camera.updateMatrixWorld();
    const sClose = await stats(frame());
    K.camera.position.copy(near);
    K.orbit.update(); K.camera.updateMatrixWorld();
    /* Normalising the position derivatives - which is what three's own
       perturbNormalArb does - makes the height difference shrink with the
       pixel footprint while nothing shrinks with it, so the texture fades
       out as you lean in. Left raw, the ratio is scale free. */
    const ratio = sNone.sd > 0 ? (sClose.sd / sBump.sd) : 0;
    ok('twice as close, same texture', ratio > 0.6 && ratio < 1.7,
       'spread ratio ' + ratio.toFixed(2));

    // ---- 3b. and lets go of it when it stops fitting in a pixel -----------
    say('');
    say('3b. and lets go when a texel no longer covers a pixel');
    /* THE SAME CAMERA AND THE SAME SILHOUETTE - only the mask's own texel
       size moves. Scale is a uniform, not part of the bake, so at 60 the
       identical cloth is sampled ten times finer and one texel is well under
       a pixel. Un-faded, ten times finer is ten times steeper and the cube
       comes back LOUDER - a wall of pixel noise. The footprint fade is the
       only reason this goes the other way. */
    const shot = (tag, url2) => { try { fetch('/shot', { method: 'POST', body: tag + '|' + url2 }); } catch (_) {} };
    shot('none', imgNone);
    shot('half', imgBump);
    d.masks[0].bump = 0.01;
    K.updateMaterialEverywhere(d.id);
    await sleep(120);
    const fTiny = frame();
    const sTiny = await stats(fTiny);
    shot('tiny', fTiny);
    /* THE CHECK THAT FOUND THE REAL BUG. A depth of 0.01 is a fiftieth of
       the one above and has to be a picture almost nobody could tell from no
       bump at all. It was not: it came back with the full spread, because a
       cloth bump reached the shader through an identity normal matrix and
       the depth had nothing to do with what was on screen. Any future
       version where the bump stops being a function of its own depth fails
       here first. */
    ok('a fiftieth of the depth is nearly nothing', Math.abs(sTiny.sd - sNone.sd) < 1.0,
       'spread ' + sNone.sd.toFixed(2) + ' with none, ' + sTiny.sd.toFixed(2) + ' at depth 0.01');
    d.masks[0].bump = 0.5;
    d.masks[0].scale = 60;
    K.updateMaterialEverywhere(d.id);
    await sleep(120);
    const sFine = await stats(frame());
    d.masks[0].scale = 2;
    K.updateMaterialEverywhere(d.id);
    await sleep(120);
    ok('a mask finer than the pixels goes quiet', sFine.sd < sBump.sd * 0.8,
       'spread ' + sBump.sd.toFixed(2) + ' at scale 2 -> ' + sFine.sd.toFixed(2) + ' at 60');

    // ---- 3c. and it goes the other way (v2.7) -----------------------------
    say('');
    say('3c. a negative depth carves instead of standing out');
    // Driven through the REAL slider, so the label and the write are both
    // under test rather than only the shader.
    const drag = (v) => {
      const el = box('mkBump');
      el.value = String(v);
      el.dispatchEvent(new Event('input'));
    };
    drag(-0.5);
    await sleep(120);
    const fDent = frame();
    shot('dent', fDent);
    const sDent = await stats(fDent);
    ok('a mask still lives at a negative depth', K.maskBumped(d.masks[0]) === true,
       String(d.masks[0].bump));
    // The only thing on screen that says the slider has a left half.
    ok('and the control renames itself', box('mkBumpLbl').textContent === 'Carve',
       box('mkBumpLbl').textContent);
    ok('it is not the raised picture', fDent !== imgBump);
    ok('nor the plain one', fDent !== imgNone);
    /* THE SAME RELIEF, INVERTED. Carving is not a weaker bump and not a
       stronger one - it is the same height field with the sign flipped, so
       the surface gets just as much texture, lit from the other side. */
    ok('and it has as much texture as the ridge', Math.abs(sDent.sd - sBump.sd) < sBump.sd * 0.35,
       'spread ' + sBump.sd.toFixed(2) + ' out, ' + sDent.sd.toFixed(2) + ' in');
    /* ZERO IS FLAT AND STILL ON. The switch is the key's existence, not its
       sign, so a depth parked in the middle of the sweep is a live mask that
       happens to be flat - which is what lets the slider cross over at all. */
    drag(0);
    await sleep(120);
    const fFlat = frame();
    ok('zero is flat but still switched on', K.maskBumped(d.masks[0]) === true &&
       fFlat === imgNone, 'bump ' + d.masks[0].bump);
    ok('and the word comes back', box('mkBumpLbl').textContent === 'Bump',
       box('mkBumpLbl').textContent);
    drag(0.5);
    await sleep(120);

    // ---- 4. off means off -------------------------------------------------
    say('');
    say('4. off means off');
    setBump(false);
    await sleep(120);
    const imgOff = frame();
    ok('the key is gone, not set false', !('bump' in d.masks[0]),
       'bump' in d.masks[0] ? String(d.masks[0].bump) : 'absent');
    ok('the picture comes back exactly', imgOff === imgNone);
    ok('and so does the mask, key for key', JSON.stringify(d.masks) === masksBefore);
    /* THE SIGNATURE IS THE POINT OF THAT LAST ONE. materialDefSig
       stringifies the mask objects, and a leftover key is a material that no
       longer matches itself across a file - which is how every masked preset
       once minted a "(imported)" copy of itself on every load. */
    ok('the signature is byte identical', K.materialDefSig(d) === sigBefore);
    setBump(true);
    await sleep(80);
    ok('and turning it on again differs', K.materialDefSig(d) !== sigBefore);

    // ---- 5. it composes with Round edges ----------------------------------
    say('');
    say('5. Round edges and Bump compose');
    setBump(false);
    await sleep(80);
    d.bevel = 0.35;
    K.ensureWearLists();
    K.updateMaterialEverywhere(d.id);
    K.ensureMaskPatches();
    await sleep(200);
    const imgBevel = frame();
    ok('Round edges alone changes the picture', imgBevel !== imgNone);
    setBump(true);
    await sleep(150);
    const imgBoth = frame();
    ok('adding Bump changes it again', imgBoth !== imgBevel);
    /* THE REAL CHECK. Written as two separate blocks each starting from the
       raw vertex normal, whichever ran second would have thrown the other
       away - and "bevel plus bump" would have come out pixel for pixel the
       same as "bump alone". */
    ok('and it did NOT replace the bevel', imgBoth !== imgBump);
    d.bevel = 0;
    setBump(false);
    K.ensureWearLists();
    K.updateMaterialEverywhere(d.id);
    K.ensureMaskPatches();
    await sleep(150);

    // ---- 5b. and a SHAPE mask can drive it too ----------------------------
    say('');
    say('5b. an Edges mask driving nothing but Bump');
    /* The other half of defWantsField. A shape mask reads the distance field
       rather than a texture, and whether an object gets a field baked at all
       is decided by "does any live mask want one" - a question that had to
       learn about Bump as well, or Edges + Bump alone would have rendered a
       solid wash with no edges in it. */
    d.masks[0].type = 'edges';
    d.masks[0].scale = 0.25;
    d.masks[0].contrast = 0.5;
    d.masks[0].detail = 0;
    setBump(true);            // section 5 left it off
    K.ensureWearLists();
    K.updateMaterialEverywhere(d.id);
    K.ensureMaskPatches();
    await sleep(250);
    const fEdge = frame();
    shot('edges', fEdge);
    const sEdge = await stats(fEdge);
    ok('the edges of the cube get relief', Math.abs(sEdge.sd - sNone.sd) > 0.5,
       'spread ' + sNone.sd.toFixed(2) + ' -> ' + sEdge.sd.toFixed(2));
    ok('and it is not the cloth picture', fEdge !== imgBump);

    // ---- 6. nothing complained -------------------------------------------
    say('');
    say('6. the shader');
    const shaderErrs = errs.filter(e => /shader|program|glsl|webgl/i.test(e));
    ok('no shader or program errors', shaderErrs.length === 0,
       shaderErrs.slice(0, 2).join(' | '));
    ok('no page errors at all', errs.length === 0, errs.slice(0, 2).join(' | '));

    // A picture, not only a mean - the lesson every shader round here has
    // had to relearn. _bumpchk.py writes it out beside the report.
    try { await fetch('/shot', { method: 'POST', body: 'bump|' + imgBump }); } catch (_) {}
    finish();
  }
  const go = () => setTimeout(() => { boot().catch(e => { say('THREW ' + e.message + '\n' + e.stack); finish(); }); }, 2600);
  if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
})();
