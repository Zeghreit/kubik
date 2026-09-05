# a2.83 investigation. applyShading opens with a full geo.computeVertexNormals()
# whose answer is then overwritten by the per-vertex union-find - except where
# the union-find CONTINUEs. _prof_probe says that baseline is 12-15% of a warm
# shade, so the question worth answering before touching anything is: WHO still
# reads it?
#
# This instruments a COPY of index.html (index.html is never touched) to count,
# for every shade, exactly which attribute vertices the write loop leaves alone
# and what the baseline is giving them.
import io, os, shutil, tempfile, sys, subprocess, threading
import http.server, socketserver

ROOT = r'C:\Users\a.bodrov\Projects\kubik'
# A FRESH profile of this probe's own. Sharing Chrome's default profile
# makes the run exit in seconds whenever a Chrome is open; a FIXED
# directory makes the next run open this run's autosaved scene.
PROF = tempfile.mkdtemp(prefix='_prof_')
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
PORT = 8862
OUT = '_fan_out.txt'

src = io.open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()

HEAD_ANCHOR = "    const normals = geo.attributes.normal.array;"
HEAD_ADD = """
    /* ---- INJECTED BY _fan_probe.py - not in the shipped file ---- */
    var _F = window.__FAN = window.__FAN || { shades: 0, verts: 0, used: 0,
      noGroup: 0, notEnrolled: 0, noAcc: 0, degen: 0, unwritten: 0,
      degenBaseZero: 0, degenBaseNonZero: 0, degenIslands: 0,
      unwrittenBaseZero: 0, unwrittenBaseNonZero: 0, maxBaseGap: 0 };
    var _base = normals.slice();
    var _wrote = new Uint8Array(posAttr.count);
"""

LOOP_OLD = """      const ais = logicalGroups[l];
      for (let i = 0; i < ais.length; i++) {
        const ai = ais[i], g = groupOfAttr[ai];
        if (g < 0 || ufStamp[g] !== stamp) continue;
        const r = find(g);
        if (accStamp[r] !== stamp) continue;
        const x = accX[r], y = accY[r], z = accZ[r];
        if (x * x + y * y + z * z < 1e-12) continue;   // degenerate fan: keep the baseline
        normals[ai * 3] = x; normals[ai * 3 + 1] = y; normals[ai * 3 + 2] = z;
      }"""

LOOP_NEW = """      const ais = logicalGroups[l];
      for (let i = 0; i < ais.length; i++) {
        const ai = ais[i], g = groupOfAttr[ai];
        if (g < 0) { _F.noGroup++; continue; }
        if (ufStamp[g] !== stamp) { _F.notEnrolled++; continue; }
        const r = find(g);
        if (accStamp[r] !== stamp) { _F.noAcc++; continue; }
        const x = accX[r], y = accY[r], z = accZ[r];
        if (x * x + y * y + z * z < 1e-12) {
          _F.degen++;
          _F.degenIslands += touched.length;
          var _bx = _base[ai * 3], _by = _base[ai * 3 + 1], _bz = _base[ai * 3 + 2];
          if (_bx * _bx + _by * _by + _bz * _bz < 1e-12) _F.degenBaseZero++;
          else _F.degenBaseNonZero++;
          continue;
        }
        _wrote[ai] = 1;
        /* HOW FAR THE BASELINE WAS FROM THE ANSWER. If these agreed the
           baseline would be harmless as a fallback; where they disagree it
           is a second shading model answering for the first. */
        var _dx = _base[ai * 3] - x, _dy = _base[ai * 3 + 1] - y, _dz = _base[ai * 3 + 2] - z;
        var _gap = Math.sqrt(_dx * _dx + _dy * _dy + _dz * _dz);
        if (_gap > _F.maxBaseGap) _F.maxBaseGap = _gap;
        normals[ai * 3] = x; normals[ai * 3 + 1] = y; normals[ai * 3 + 2] = z;
      }"""

TAIL_ANCHOR = "    geo.attributes.normal.needsUpdate = true;"
TAIL_ADD = """    {
      /* WHO IS LEFT. Only vertices the INDEX actually references matter -
         an unused attribute vertex is never rasterised. */
      _F.shades++;
      _F.verts += posAttr.count;
      var _used = new Uint8Array(posAttr.count);
      for (var _u = 0; _u < index.count; _u++) _used[index.getX(_u)] = 1;
      for (var _v = 0; _v < posAttr.count; _v++) {
        if (!_used[_v]) continue;
        _F.used++;
        if (_wrote[_v]) continue;
        _F.unwritten++;
        var _qx = _base[_v * 3], _qy = _base[_v * 3 + 1], _qz = _base[_v * 3 + 2];
        if (_qx * _qx + _qy * _qy + _qz * _qz < 1e-12) _F.unwrittenBaseZero++;
        else _F.unwrittenBaseNonZero++;
      }
    }
"""

ENTRY_ANCHOR = """  // Safe baseline: if anything below throws, the mesh is still shaded.
  geo.computeVertexNormals();"""
ENTRY_ADD = """  {
    /* ---- INJECTED BY _fan_probe.py ---- */
    var _G = window.__FAN0 = window.__FAN0 || { calls: 0, noAttr: 0, allZero: 0, wrongSize: 0, live: 0 };
    _G.calls++;
    var _na = geo.attributes.normal;
    if (!_na) _G.noAttr++;
    else if (geo.attributes.position && _na.count !== geo.attributes.position.count) _G.wrongSize++;
    else {
      var _z = true;
      for (var _i = 0; _i < _na.array.length; _i++) if (_na.array[_i] !== 0) { _z = false; break; }
      if (_z) _G.allZero++; else _G.live++;
    }
  }
"""

for name, old, new in (('entry', ENTRY_ANCHOR, ENTRY_ADD + ENTRY_ANCHOR),
                       ('head', HEAD_ANCHOR, HEAD_ANCHOR + HEAD_ADD),
                       ('loop', LOOP_OLD, LOOP_NEW),
                       ('tail', TAIL_ANCHOR, TAIL_ADD + TAIL_ANCHOR)):
    if src.count(old) != 1:
        print('%s ANCHOR MISS (%d)' % (name, src.count(old)))
        sys.exit(1)
    src = src.replace(old, new, 1)
print('instrumented the write loop')

JS = io.open(os.path.join(ROOT, '_fan_probe.js'), encoding='utf-8').read()
assert '</body>' in src
io.open(os.path.join(ROOT, '_fan_probe.html'), 'w', encoding='utf-8', newline='').write(
    src.replace('</body>', '<script>\n' + JS + '\n</script>\n</body>', 1))

result = {'text': None}
done = threading.Event()


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, *a):
        pass

    def do_POST(self):
        n = int(self.headers.get('Content-Length', 0))
        result['text'] = self.rfile.read(n).decode('utf-8', 'replace')
        self.send_response(204)
        self.end_headers()
        done.set()


socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(('127.0.0.1', PORT), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()

url = 'http://127.0.0.1:%d/_fan_probe.html?debug=1' % PORT
cmd = [CHROME, '--headless=new', '--disable-gpu-sandbox', '--no-sandbox',
       '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
       '--window-size=900,700', '--user-data-dir=' + PROF,
       # SHARED, and deliberately not the fresh profile: the app pulls three.js
       # from a CDN on every load, and a cold cache is what actually broke
       # _imp_probe. State fresh, network warm.
       '--disk-cache-dir=' + os.path.join(ROOT, '_httpcache'),
       '--no-first-run', '--no-default-browser-check', '--disable-sync',
       '--disable-background-networking', '--disable-component-update',
       '--disable-default-apps', '--disable-extensions', '--metrics-recording-only',
       '--mute-audio',
       url]
p = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
ok = done.wait(timeout=180)
try:
    p.terminate(); p.wait(timeout=20)
except Exception:
    p.kill()
srv.shutdown()
shutil.rmtree(PROF, ignore_errors=True)

txt = result['text'] if ok and result['text'] else 'NO PROBE OUTPUT (timed out)'
io.open(os.path.join(ROOT, OUT), 'w', encoding='utf-8').write(txt)
print(txt)
