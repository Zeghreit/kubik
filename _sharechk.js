/* v2.4: the Home Screen icon is really there and really has a picture in it,
   and a file leaves by the share sheet on a phone and by a download on a
   desk. The share half is driven against stubs - there is no system sheet in
   a headless browser, and what matters is which branch the code takes. */
(function () {
  const lines = [];
  const say = (s) => lines.push(s);
  let pass = 0, fail = 0;
  const ok = (name, good, detail) => {
    (good ? pass++ : fail++);
    say((good ? '  ok    ' : '  FAIL  ') + name.padEnd(38) + (detail || ''));
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

  async function boot() {
    const K = window.__kubik;

    // ---- 1. the icon ------------------------------------------------------
    say('1. Home Screen icon');
    const apple = document.querySelector('link[rel="apple-touch-icon"]');
    const fav = document.querySelector('link[rel="icon"]');
    ok('apple-touch-icon present', !!apple);
    ok('icon present', !!fav);
    if (apple) {
      ok('it is an inline PNG', apple.href.indexOf('data:image/png;base64,') === 0,
         apple.href.slice(0, 28) + '...');
      ok('and not a token amount of one', apple.href.length > 1000,
         apple.href.length + ' chars of data URI');
      const img = new Image();
      const loaded = await new Promise(r => {
        img.onload = () => r(true); img.onerror = () => r(false); img.src = apple.href;
      });
      ok('it decodes', loaded);
      if (loaded) {
        ok('at 180x180', img.naturalWidth === 180 && img.naturalHeight === 180,
           img.naturalWidth + 'x' + img.naturalHeight);
        /* A tile with no glyph on it decodes perfectly well, which is how the
           first two builds of this got made. Count the light pixels. */
        const c = document.createElement('canvas');
        c.width = c.height = 180;
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        const px = g.getImageData(0, 0, 180, 180).data;
        let light = 0, red = 0;
        for (let i = 0; i < px.length; i += 4) {
          if (px[i] > 150 && px[i + 1] > 150 && px[i + 2] > 150) light++;
          if (px[i] > 150 && px[i + 1] < 110 && px[i + 2] < 90) red++;
        }
        ok('there is a glyph on it', light > 400, light + ' light pixels');
        ok('and the signal dot', red > 60, red + ' red pixels');
      }
    }

    // ---- 2. which way a file leaves --------------------------------------
    say('');
    say('2. share sheet vs download');
    const realMatch = window.matchMedia;
    const realCanShare = navigator.canShare;
    const realShare = navigator.share;
    const realClick = HTMLAnchorElement.prototype.click;
    let downloads = 0, shared = null;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download) downloads++; else realClick.call(this);
    };
    const setPointer = (coarse) => {
      window.matchMedia = (q) => (String(q).indexOf('pointer: coarse') >= 0)
        ? { matches: coarse, media: q, addListener() {}, removeListener() {} }
        : realMatch.call(window, q);
    };

    // a desk: share exists, pointer is fine -> download
    navigator.canShare = () => true;
    navigator.share = () => Promise.resolve();
    setPointer(false);
    ok('fine pointer does not want the sheet', K.wantsShareSheet() === false);
    downloads = 0;
    K.downloadBlob(['{}'], 'model.json', 'application/json');
    await sleep(60);
    ok('and a file downloads', downloads === 1, downloads + ' download(s)');

    // a phone: coarse pointer -> the sheet, and no download behind it
    setPointer(true);
    ok('coarse pointer wants the sheet', K.wantsShareSheet() === true);
    downloads = 0; shared = null;
    navigator.share = (d) => { shared = d; return Promise.resolve(); };
    K.downloadBlob(['solid x\n'], 'model.stl', 'model/stl');
    await sleep(60);
    ok('it goes to the sheet', !!shared);
    if (shared) {
      ok('as one file, named right', !!(shared.files && shared.files.length === 1 &&
         shared.files[0].name === 'model.stl'),
         shared.files ? shared.files[0].name : 'no files');
      ok('carrying the mime type', shared.files[0].type === 'model/stl',
         shared.files[0].type);
    }
    ok('and nothing downloaded behind it', downloads === 0, downloads + ' download(s)');

    // cancel is not a failure
    downloads = 0;
    navigator.share = () => Promise.reject(Object.assign(new Error('x'), { name: 'AbortError' }));
    K.downloadBlob(['x'], 'a.obj', 'text/plain');
    await sleep(80);
    ok('cancelling does NOT force a download', downloads === 0, downloads + ' download(s)');

    // a real refusal does fall back
    downloads = 0;
    navigator.share = () => Promise.reject(Object.assign(new Error('x'), { name: 'NotAllowedError' }));
    K.downloadBlob(['x'], 'b.obj', 'text/plain');
    await sleep(80);
    ok('a refusal falls back to the download', downloads === 1, downloads + ' download(s)');

    /* and a browser with no share at all. `delete` is not enough: canShare is
       native on this one, so deleting the stub only uncovers the real thing.
       Define it away instead. */
    downloads = 0;
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
    ok('no canShare, no sheet', K.wantsShareSheet() === false);
    K.downloadBlob(['x'], 'c.obj', 'text/plain');
    await sleep(60);
    ok('it still downloads', downloads === 1, downloads + ' download(s)');

    window.matchMedia = realMatch;
    HTMLAnchorElement.prototype.click = realClick;
    if (realCanShare) navigator.canShare = realCanShare;
    if (realShare) navigator.share = realShare;
    finish();
  }
  const go = () => setTimeout(() => { boot().catch(e => { say('THREW ' + e.message + '\n' + e.stack); finish(); }); }, 2200);
  if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
})();
