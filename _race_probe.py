# Races a2.82's rewritten union-find against the one it replaces, in ONE run
# on the SAME geometry, and compares the normals it produces vertex for
# vertex. index.html is never touched - the legacy loop is injected into a
# copy in memory, exactly as _prof_probe.py does its instrumentation.
#
# This is the method a2.77 used and the reason its 20% is believable: a
# cross-version timing on this machine drifts 3x, and "faster" is worthless
# without "and identical".
import io, os, shutil, tempfile, sys, subprocess, threading
import http.server, socketserver

ROOT = r'C:\Users\a.bodrov\Projects\kubik'
# A FRESH profile of this probe's own. Sharing Chrome's default profile
# makes the run exit in seconds whenever a Chrome is open; a FIXED
# directory makes the next run open this run's autosaved scene.
PROF = tempfile.mkdtemp(prefix='_prof_')
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
PORT = 8861
OUT = '_race_out.txt'

src = io.open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()

# NOTE: this anchor sits on the very line a2.82c changed (stamp++ became
# stamp = ++UF.stamp0), and the harness aborted loudly rather than injecting
# nothing - which is the behaviour to keep. If the union-find is edited
# again, expect ANCHOR MISS and update this first.
ANCHOR = """    trisAt.forEach((tris, l) => {
      stamp = ++UF.stamp0;"""

# A lever to make one shade fail PART WAY THROUGH the vertex loop, injected
# into the copy so the shipped file carries no test hook. The first attempt
# reached for geo.userData.shadeTopo from the probe instead - which is null
# outside a direct drag (a2.77), so the section passed while testing nothing.
THROW_LEVER = """      if (window.__FORCE_THROW && --window.__FORCE_THROW === 0) {
        throw new Error('forced mid-shade failure');
      }
"""

LEGACY = """    /* ---- INJECTED BY _race_probe.py - not in the shipped file ---- */
    window.__RACE = window.__RACE || { oldMs: 0, newMs: 0, runs: 0, worst: 0, checked: 0 };
    const _baseline = normals.slice();
    const _r0 = performance.now();
    {
      // The loop a2.82 replaces, reading the SAME records so the comparison
      // isolates the data structures rather than the two changes together.
      const parent = new Map();
      const findOld = (g) => { while (parent.get(g) !== g) { parent.set(g, parent.get(parent.get(g))); g = parent.get(g); } return g; };
      const acc = new Map();
      trisAt.forEach((tris, l) => {
        parent.clear(); acc.clear();
        for (let i = 0; i < tris.length; i++) { const g = triGroup[tris[i]]; if (!parent.has(g)) parent.set(g, g); }
        const inc = incident.get(l);
        if (inc) for (let i = 0; i < inc.length; i++) {
          const rec = inc[i];
          if (rec.sharp) continue;
          const fs = rec.faces;
          for (let j = 0; j < fs.length; j++) if (!parent.has(fs[j])) parent.set(fs[j], fs[j]);
          for (let j = 1; j < fs.length; j++) {
            const r1 = findOld(fs[0]), r2 = findOld(fs[j]);
            if (r1 !== r2) parent.set(r1, r2);
          }
        }
        for (let i = 0; i < tris.length; i++) {
          const t = tris[i], r = findOld(triGroup[t]);
          let v = acc.get(r);
          if (!v) { v = new THREE.Vector3(); acc.set(r, v); }
          v.add(triNormal[t]);
        }
        acc.forEach(v => { if (v.lengthSq() > 1e-12) v.normalize(); });
        const ais = logicalGroups[l];
        for (let i = 0; i < ais.length; i++) {
          const ai = ais[i], g = groupOfAttr[ai];
          if (g < 0 || !parent.has(g)) continue;
          const v = acc.get(findOld(g));
          if (!v || v.lengthSq() < 1e-12) continue;
          normals[ai * 3] = v.x; normals[ai * 3 + 1] = v.y; normals[ai * 3 + 2] = v.z;
        }
      });
    }
    const _r1 = performance.now();
    const _oldOut = normals.slice();
    normals.set(_baseline);          // back to what the new loop will start from
    const _r2 = performance.now();
    /* ---- and now the shipped loop, timed from here ---- */
"""

TAIL = """    {
      const _r3 = performance.now();
      window.__RACE.oldMs += (_r1 - _r0);
      window.__RACE.newMs += (_r3 - _r2);
      window.__RACE.runs++;
      let worst = 0;
      for (let i = 0; i < normals.length; i++) {
        const d = Math.abs(normals[i] - _oldOut[i]);
        if (d > worst) worst = d;
      }
      window.__RACE.worst = Math.max(window.__RACE.worst, worst);
      window.__RACE.checked += normals.length;
    }
"""

if src.count(ANCHOR) != 1:
    print('ANCHOR MISS (%d)' % src.count(ANCHOR)); sys.exit(1)
src = src.replace(ANCHOR, LEGACY + ANCHOR + '\n' + THROW_LEVER, 1)

END = """    geo.attributes.normal.needsUpdate = true;"""
if src.count(END) != 1:
    print('END MISS (%d)' % src.count(END)); sys.exit(1)
src = src.replace(END, TAIL + END, 1)
print('injected the legacy loop')

JS = io.open(os.path.join(ROOT, '_race_probe.js'), encoding='utf-8').read()
assert '</body>' in src
io.open(os.path.join(ROOT, '_race_probe.html'), 'w', encoding='utf-8', newline='').write(
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

url = 'http://127.0.0.1:%d/_race_probe.html?debug=1' % PORT
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
