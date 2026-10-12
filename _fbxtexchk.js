/* v3.14c: an FBX's embedded map reaches the material on the file-picker path
   (importFbxBuffer with no base). Fixture: _fbxtex.fbx (ASCII 7.4, one quad,
   a red 8x8 PNG in Video.Content). Run: python3 _cloudprobe.py _fbxtexchk.js */
(async function () {
  const out = [];
  const say = s => { out.push(s); try { const x = new XMLHttpRequest(); x.open('POST', '/p', true); x.send(s); } catch (e) {} };
  const post = b => { try { const x = new XMLHttpRequest(); x.open('POST', '/result', true); x.send(b); } catch (e) {} };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  let fails = 0;
  const check = (n, ok, note) => { if (!ok) fails++; say((ok ? 'PASS ' : 'FAIL ') + n + (note != null ? '  ' + note : '')); };
  try {
    while (!(window.__kubik && window.__kubik.App)) await wait(50);
    await wait(1500);
    const K = window.__kubik;
    const buf = await (await fetch('_fbxtex.fbx?cb=' + Date.now())).arrayBuffer();
    const n0 = K.App.objects.length;
    await K.importFbxBuffer(buf, 'tex');
    for (let i = 0; i < 100 && K.App.objects.length === n0; i++) await wait(50);
    const o = K.App.objects[K.App.objects.length - 1];
    check('the quad landed', K.App.objects.length > n0, K.App.objects.length);
    await wait(500);
    const mats = o ? (Array.isArray(o.mesh.material) ? o.mesh.material : [o.mesh.material]) : [];
    const withMap = mats.filter(m => m && m.map);
    check('its material wears a colour map', withMap.length > 0, mats.map(m => m && m.name).join(','));
    const img = withMap[0] && withMap[0].map.image;
    check('the map has a picture', !!img && (img.width || img.naturalWidth) > 0, img ? (img.width || img.naturalWidth) : 'none');
  } catch (e) { fails++; say('ERROR ' + (e && e.stack || e)); }
  say(fails ? 'FAILURES ' + fails : 'ALL GREEN');
  post(out.join('\n'));
})();
