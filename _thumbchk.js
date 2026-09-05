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

  /* WHAT THE EYE GETS, NOT WHAT THE RENDERER MADE. The card shows the tile
     at 50 CSS pixels, so on the phone this app is for - devicePixelRatio 3 -
     it lands on 150 device pixels, and every measure below has to be taken
     there or it is measuring a picture nobody sees. Drawn through the same
     smoothing the browser uses for the <img>, so a tile rendered LARGER than
     150 is judged after its downsample, and one rendered smaller is judged
     after its stretch. That distinction is the whole of v2.10. */
  const SEEN = 150;
  function pixels(url) {
    return new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => {
        const c = document.createElement('canvas');
        c.width = SEEN; c.height = SEEN;
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = true;
        g.imageSmoothingQuality = 'high';
        g.clearRect(0, 0, SEEN, SEEN);
        g.drawImage(im, 0, 0, SEEN, SEEN);
        res({ d: g.getImageData(0, 0, SEEN, SEEN).data, w: SEEN, h: SEEN,
              drawn: im.naturalWidth });
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
  /* HOW STEPPED THE RIDGE IS, as a number - and the first version of this
     could not tell. It was a Laplacian over the ball, which answers to any
     hard line, and a bump ridge IS a hard line: a crisp ridge and a stepped
     one both scored high, so the metric could not say whether a change had
     helped. It read 11 on a ridge I could see was smooth.

     THE GROUND TRUTH IS THE GEOMETRY. Both rings are circles about the axis
     the ball is viewed down, so a correct render varies around them only as
     smoothly as the light does - every abrupt change AROUND the circle is
     defect and nothing else. So: walk each radius in polar coordinates,
     bilinearly, and take the mean absolute SECOND difference in the angle.
     Smooth lighting differences away to nearly nothing; a facet does not.

     Radii 20 to 65 of the 150px tile: the ball overflows the square and is
     clipped at the sides, and the two bands sit at about 25 and 57. */
  function ridgeWobble(p) {
    const c = p.w / 2;
    const at = (x, y) => {
      const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
      const L = (xx, yy) => {
        if (xx < 0 || yy < 0 || xx >= p.w || yy >= p.h) return 0;
        const i = (yy * p.w + xx) * 4;
        if (p.d[i + 3] < 127) return 0;
        return (p.d[i] * 299 + p.d[i + 1] * 587 + p.d[i + 2] * 114) / 1000;
      };
      return (L(x0, y0) * (1 - fx) + L(x0 + 1, y0) * fx) * (1 - fy) +
             (L(x0, y0 + 1) * (1 - fx) + L(x0 + 1, y0 + 1) * fx) * fy;
    };
    const N = 360;
    let sum = 0, n = 0;
    for (let r = 20; r <= 65; r++) {
      const ring = new Float64Array(N);
      for (let k = 0; k < N; k++) {
        const a = k / N * Math.PI * 2;
        ring[k] = at(c + Math.cos(a) * r, c + Math.sin(a) * r);
      }
      for (let k = 0; k < N; k++) {
        sum += Math.abs(ring[(k + N - 1) % N] - 2 * ring[k] + ring[(k + 1) % N]);
        n++;
      }
    }
    return n ? sum / n : 0;
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
    /* Drawn at least as big as it is shown, or the card stretches it and no
       amount of care in the shader survives the upscale. */
    ok('the tile is not upscaled to fit the card', plain.drawn >= SEEN,
       'drawn ' + plain.drawn + 'px, shown ' + SEEN + 'px');
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
    say('3b. and the relief is SMOOTH, not stepped');
    mark('3b');
    /* MEASURED, because the eye and the mean disagree here. The bump was
       visibly stepped at v2.9 and every number in section 3 was healthy -
       a facet is a change in the SECOND derivative, which nothing above
       looks at.

       What it turned out to be was the TILE, not the shading: 104 pixels
       drawn for a card that asks for 150 on a phone, so the card stretched
       it. Every other suspect was measured and cleared - see CURRENT_STATE.
       The viewport was never affected, because it draws the same masks
       across hundreds of pixels rather than fifty. */
    const fB = ridgeWobble(b1), fC = ridgeWobble(bc), fP = ridgeWobble(plain);
    ok('a plain ball barely wobbles', fP < 0.2, 'wobble ' + fP.toFixed(3));
    /* THE NUMBER v2.10 MOVED, and the threshold sits BETWEEN THE TWO BUILDS
       rather than at a round figure: 3.20 on the stretched 104px tile, 2.77
       on the drawn-at-208 one, so 3.0 is a regression guard and nothing more.
       It is deliberately not an aspiration. What is left at 2.77 was chased
       and is largely not a defect - about a third of it is the ROOM, which a
       ridge reflects like a curved mirror and should; the rest survived a
       128-cubed field, a 192x128 ball and twice the ring segments unchanged.
       Read the v2.10 section of CURRENT_STATE before trying to move it. */
    ok('and the bump ridge is smooth round the circle', fB < 3.0, 'wobble ' + fB.toFixed(3));
    ok('so is the carve', fC < 3.0, 'wobble ' + fC.toFixed(3));

    say('');
    say('4. and it costs one bake');
    mark('4');
    /* The field is baked from the ball ONCE for the life of the page - the
       gen never moves - so walking the whole library must not re-bake it per
       definition. That is 40 segments x the grid, inside a render, on every
       tray rebuild. */
    const before = K.PERF.bake;
    const t0 = performance.now();
    K.renderMatPreviews();
    const ms = performance.now() - t0;
    const spent = K.PERF.bake - before;
    ok('a full tray rebuild bakes no field at all', spent === 0, spent + ' bake(s)');
    /* THE PART THAT IS NOT FREE. A bigger tile is four times the readback,
       and the readback - a synchronous toDataURL off a preserveDrawingBuffer
       canvas, then a PNG encode, on the main thread - is why renderMatPreviews
       grew an `onlyId` in the first place. Eight definitions here; the budget
       is per definition so it does not drift as this probe gains materials. */
    const each = ms / K.MATERIALS.size;
    ok('and costs a sane amount per definition', each < 60,
       each.toFixed(1) + ' ms each, ' + ms.toFixed(0) + ' ms for ' + K.MATERIALS.size);

    say('');
    say('5. and it still opens at library scale');
    mark('5');
    /* THE RISK v2.10 OPENED. Doubling the tile doubled the readback, and the
       readback is a synchronous toDataURL plus a PNG encode on the main
       thread - PER DEFINITION. Nine of them was measured; a real library is
       not nine. Every one of these is shape-masked, which is the expensive
       kind, so this is the worst case rather than the average.

       ABSOLUTE MILLISECONDS HERE ARE NOT A PHONE'S. This runs on SwiftShader,
       a software rasteriser, so the DRAW is far slower than any real GPU -
       but the encode, which is the dominant term, is CPU either way. Treat
       the per-definition figure as indicative and the SHAPE of the curve as
       the real reading: it must stay linear, with no term that grows with
       the size of the library. */
    for (let i = 0; i < 40; i++) def('t_bulk' + i, 'Bulk ' + i, [shapeMask('edges')]);
    const N = K.MATERIALS.size;
    /* THE RIG'S OWN CONTEXT, not the viewport's - they are separate WebGL
       contexts with separate program caches, and it is the rig that compiles
       one per definition. */
    const progs0 = rig.r.info.programs.length;
    /* COLD, then WARM. Two different costs live in that one number and they
       have different fixes: a definition drawn for the FIRST time compiles
       its own shader program - the mask cache key carries the definition id,
       so identical GLSL still compiles once per definition - and every
       definition drawn at all pays a toDataURL readback and a PNG encode.
       Only the second of those is v2.10's to answer for. */
    const tCold = performance.now();
    K.renderMatPreviews();
    const coldMs = performance.now() - tCold;
    const tWarm = performance.now();
    K.renderMatPreviews();
    const warmMs = performance.now() - tWarm;
    const progs1 = rig.r.info.programs.length;
    say('  ..    ' + N + ' definitions: ' + coldMs.toFixed(0) + ' ms cold, ' +
        warmMs.toFixed(0) + ' ms warm (' + (coldMs / N).toFixed(1) + ' / ' +
        (warmMs / N).toFixed(1) + ' ms each)');
    say('  ..    rig programs ' + progs0 + ' -> ' + progs1 + ' for 40 new masked definitions');
    /* THE READBACK IS THE PART A BIGGER TILE PAYS FOR, and it is the warm
       number. Held against the nine-definition figure measured moments ago
       on this same page, so it compares like with like. */
    ok('the readback cost does not grow with the library',
       (warmMs / N) < each * 1.6, (warmMs / N).toFixed(1) + ' ms each warm vs ' +
       each.toFixed(1) + ' at nine');
    /* THE COMPILE IS NOT v2.10's, and it is asserted as a COUNT rather than a
       time on purpose. The milliseconds here are SwiftShader's - a software
       rasteriser, where a program compile costs ~210ms against single-digit
       to low-tens on real hardware - so a millisecond threshold set here
       would be a number about this machine. The COUNT is the same everywhere.

       One program per masked definition is structural, not a bug: three runs
       onBeforeCompile only on a program-cache MISS, and the custom uniforms
       are injected there, so the cache key has to carry the definition id or
       the second definition to use a shared program never gets its uniforms
       at all. See the onBeforeCompile law in the materials roadmap.

       What this guards is that it stays ONE each. If anything ever makes a
       preview material bounce between keys - the `#n` fork firing on every
       pass, say - this goes quadratic and the first tray open on a real
       library becomes a hang. That is a live hazard: it is exactly what the
       shared preview material used to do before a2.21. */
    const minted = progs1 - progs0;
    ok('a first open compiles one program per definition, not more',
       minted >= 38 && minted <= 44, minted + ' programs for 40 new definitions');
    /* And the shape of the cost, so the next person does not have to
       re-derive which half is which. */
    say('  ..    cold is ' + (coldMs / Math.max(warmMs, 1)).toFixed(1) +
        'x warm - the difference is the compile, paid once');
    ok('one definition alone stays cheap', (() => {
      const t = performance.now();
      K.renderMatPreviews('t_edges');
      return performance.now() - t;
    })() < each * 2.5, 'the slider-release path');

    ok('the probe ran to the end', true);
    finish();
  }
  const go = () => setTimeout(() => {
    boot().catch(e => { say('THREW ' + e.message); ok('the probe ran to the end', false, e.message); finish(); });
  }, 2500);
  if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
})();
