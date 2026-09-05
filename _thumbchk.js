/* WHAT THE MATERIAL TRAY SHOWS (v2.9). The shape masks - Cavity and Edges -
   read the model's own edge field, and the preview ball had none, so the
   shader fell back to a 1x1 black texture meaning "everywhere is an edge"
   and every shape-masked thumbnail came out a uniform flood. A flood has no
   slope, so the v2.6 bump was invisible in the tray: a bump material and a
   plain one drew the same picture.

   These checks read the thumbnails the app actually produces - the same data
   URLs buildMatTray puts in the <img> tags - and ask three things of them:
   that a shape mask paints a BAND and not the whole ball, that Cavity and
   Edges paint DIFFERENT places, and that a bump-only mask changes the
   picture at all. The third is the one the bug was. */
(function () {
  const lines = [];
  const say = (s) => lines.push(s);
  let pass = 0, fail = 0;
  const ok = (name, good, detail) => {
    (good ? pass++ : fail++);
    say((good ? '  ok    ' : '  FAIL  ') + name.padEnd(46) + (detail || ''));
  };
  let done = false;
  function finish() {
    if (done) return; done = true;
    say('');
    say(fail ? 'VERDICT=FAIL (' + fail + ' of ' + (pass + fail) + ')'
             : 'VERDICT=PASS (' + pass + ' checks)');
    try { fetch('/report', { method: 'POST', body: lines.join('\n') }); } catch (_) {}
  }
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const mark = (w) => { try { fetch('/mark', { method: 'POST', body: lines.join('\n') + '\n>>> ' + w }); } catch (_) {} };
  const shot = (tag, url) => { try { fetch('/shot', { method: 'POST', body: tag + '|' + url }); } catch (_) {} };

  /* A shape mask. Its THREE SLIDERS ARE THE CLOTH ONES REUSED - `scale` is
     Width as a fraction of the field's reach, `contrast` is Blur, `detail`
     is Noise - and which shape it reads comes from the TYPE, because `curv`
     lives on the catalogue entry (cavity 1, edges 2) and not on the mask.
     Getting that wrong gives a mask that is live, patched, and inert. */
  const shapeMask = (type, o) => Object.assign({
    on: true, type: type, blend: 'normal',
    colorOn: true, color: '#e02020', roughOn: false, rough: 0.3,
    /* THE CATALOGUE'S OWN DEFAULTS - width 0.25, blur 0.5, noise 0 - so the
       pictures this writes out are the pictures a user gets on a mask they
       have just added, not a wide one chosen to make the check pass. */
    amount: 1, scale: 0.25, contrast: 0.5, detail: 0,
    nscale: 1, seed: 1
  }, o || {});

  // Decode a data URL into pixels, once, so every measure below is on bytes.
  function pixels(url) {
    return new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => {
        const c = document.createElement('canvas');
        c.width = im.naturalWidth; c.height = im.naturalHeight;
        const g = c.getContext('2d');
        g.clearRect(0, 0, c.width, c.height);
        g.drawImage(im, 0, 0);
        res({ d: g.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height });
      };
      im.onerror = () => rej(new Error('thumbnail did not decode'));
      im.src = url;
    });
  }

  /* THE BALL, NOT THE TILE. The rig renders with alpha, so the corners are
     transparent and counting them would dilute every fraction below by the
     4/pi the square costs. Alpha over half is the ball. */
  const onBall = (p, i) => p.d[i * 4 + 3] > 127;
  function ballCount(p) {
    let n = 0;
    for (let i = 0; i < p.w * p.h; i++) if (onBall(p, i)) n++;
    return n;
  }
  // Pixels where the mask's red has clearly won over the grey base.
  function reddish(p) {
    const set = new Uint8Array(p.w * p.h);
    let n = 0;
    for (let i = 0; i < p.w * p.h; i++) {
      if (!onBall(p, i)) continue;
      const r = p.d[i * 4], g = p.d[i * 4 + 1], b = p.d[i * 4 + 2];
      if (r > g + 40 && r > b + 40) { set[i] = 1; n++; }
    }
    return { set: set, n: n };
  }
  // Mean absolute luminance difference over the ball, in 0-255.
  function lumaDiff(a, b) {
    let sum = 0, n = 0;
    for (let i = 0; i < a.w * a.h; i++) {
      if (!onBall(a, i) || !onBall(b, i)) continue;
      const la = (a.d[i * 4] * 299 + a.d[i * 4 + 1] * 587 + a.d[i * 4 + 2] * 114) / 1000;
      const lb = (b.d[i * 4] * 299 + b.d[i * 4 + 1] * 587 + b.d[i * 4 + 2] * 114) / 1000;
      sum += Math.abs(la - lb); n++;
    }
    return n ? sum / n : 0;
  }

  async function boot() {
    const K = window.__kubik;
    setTimeout(() => { if (!done) { say(''); say('*** WATCHDOG ***'); finish(); } }, 120000);

    const def = (id, name, masks, extra) => {
      K.MATERIALS.set(id, Object.assign({ id: id, name: name, color: '#9AA0A8',
        roughness: 0.5, metalness: 0, bevel: 0, masks: masks }, extra || {}));
    };
    /* One render of ONE definition, straight to pixels. The URL is kept
       from the RETURN VALUE, not from K.matPreviews: renderMatPreviews only
       writes into that cache when it already exists, and nothing here has
       built the tray. */
    const thumbOf = async (id) => {
      const url = K.renderMatPreviews(id)[id];
      const p = await pixels(url);
      p.url = url;
      return p;
    };

    say('1. the ball has edges of its own');
    mark('1');
    const rig = K.matPreviewRig();
    const ke = rig.ball.geometry.userData.kubikEdges;
    ok('the preview ball carries an edge set', !!ke);
    if (!ke) { finish(); return; }
    ok('two rings of 20', ke.kind.length === 40, ke.kind.length + ' segment(s)');
    let convex = 0, concave = 0;
    for (let i = 0; i < ke.kind.length; i++) (ke.kind[i] === 1 ? convex++ : concave++);
    ok('one convex, one concave', convex === 20 && concave === 20,
       convex + ' convex, ' + concave + ' concave');
    /* ON the sphere, not floating near it: a ring off the surface would put
       the whole band under the skin and the "is it behind the wall" test
       would kill it, silently, and this file would still say PASS. */
    let worstR = 0;
    for (let e = 0; e < ke.kind.length; e++) {
      for (let v = 0; v < 2; v++) {
        const o = e * 6 + v * 3;
        const r = Math.hypot(ke.pos[o], ke.pos[o + 1], ke.pos[o + 2]);
        worstR = Math.max(worstR, Math.abs(r - 0.8));
      }
    }
    ok('every point sits on the ball', worstR < 1e-5, 'worst radius error ' + worstR.toFixed(7));

    say('');
    say('2. a shape mask paints a band, not the ball');
    mark('2');
    def('t_plain', 'Plain', []);
    def('t_edges', 'Edges', [shapeMask('edges')]);
    def('t_cav', 'Cavity', [shapeMask('cavity')]);

    const plain = await thumbOf('t_plain');
    const edges = await thumbOf('t_edges');
    const cav = await thumbOf('t_cav');
    shot('plain', plain.url);
    shot('edges', edges.url);
    shot('cavity', cav.url);

    const ball = ballCount(plain);
    ok('the ball fills a good part of the tile', ball > 1500, ball + ' px');
    const rp = reddish(plain), re = reddish(edges), rc = reddish(cav);
    ok('a plain finish has no mask on it', rp.n === 0, rp.n + ' px');
    const fe = re.n / ball, fc = rc.n / ball;
    ok('Edges paints some of the ball', fe > 0.04, (fe * 100).toFixed(1) + '% of the ball');
    /* THE WHOLE BUG IN ONE NUMBER. Before v2.9 this was 100%: the 1x1 black
       field said every pixel was on an edge. A band has to leave most of the
       ball alone or it is not telling you anything a colour swatch would not. */
    ok('and LEAVES MOST OF IT ALONE', fe < 0.6, (fe * 100).toFixed(1) + '% of the ball');
    ok('Cavity paints some of the ball', fc > 0.04, (fc * 100).toFixed(1) + '% of the ball');
    ok('and leaves most of it alone', fc < 0.6, (fc * 100).toFixed(1) + '% of the ball');

    /* Different places, or the two masks are indistinguishable in the tray
       and the rings might as well be one ring. Jaccard over the painted sets. */
    let inter = 0, uni = 0;
    for (let i = 0; i < re.set.length; i++) {
      if (re.set[i] || rc.set[i]) uni++;
      if (re.set[i] && rc.set[i]) inter++;
    }
    const j = uni ? inter / uni : 1;
    ok('Cavity and Edges paint DIFFERENT places', j < 0.25, 'overlap ' + (j * 100).toFixed(1) + '%');

    say('');
    say('3. the bump has a slope to read');
    mark('3');
    /* Bump only - no colour, no roughness - so the ONLY thing that can move a
       pixel is the normal. Against the same mask with the depth at zero, so
       the two differ in one number and nothing else. */
    def('t_bump0', 'Bump 0', [shapeMask('edges', { colorOn: false, bump: 0 })]);
    def('t_bump', 'Bump', [shapeMask('edges', { colorOn: false, bump: 0.9 })]);
    const b0 = await thumbOf('t_bump0');
    const b1 = await thumbOf('t_bump');
    shot('bump0', b0.url);
    shot('bump', b1.url);
    const dB = lumaDiff(b0, b1);
    /* Before v2.9 this was 0.00 and that is the entire report: a flood has no
       derivative, so the bump shader did nothing at all on the preview ball. */
    ok('a bump-only mask CHANGES the thumbnail', dB > 1.5, 'mean luma diff ' + dB.toFixed(2));
    def('t_carve', 'Carve', [shapeMask('edges', { colorOn: false, bump: -0.9 })]);
    const bc = await thumbOf('t_carve');
    shot('carve', bc.url);
    const dC = lumaDiff(b1, bc);
    ok('carving is not the same picture as bumping', dC > 1.5, 'mean luma diff ' + dC.toFixed(2));

    say('');
    say('4. and it costs one bake');
    mark('4');
    /* The field is baked from the ball ONCE for the life of the page - the
       gen never moves - so walking the whole library must not re-bake it per
       definition. That is 40 segments x the grid, inside a render, on every
       tray rebuild. */
    const before = K.PERF.bake;
    K.renderMatPreviews();
    const spent = K.PERF.bake - before;
    ok('a full tray rebuild bakes no field at all', spent === 0, spent + ' bake(s)');

    ok('the probe ran to the end', true);
    finish();
  }
  const go = () => setTimeout(() => {
    boot().catch(e => { say('THREW ' + e.message); ok('the probe ran to the end', false, e.message); finish(); });
  }, 2500);
  if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
})();
