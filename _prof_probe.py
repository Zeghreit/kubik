# Breaks applyShading into its phases and times each one.
#
# index.html is NEVER TOUCHED. The instrumentation is applied to a copy in
# memory, exactly like _time_probe.py already builds its page - so there is
# no patch to remember to revert, and no chance of a timer shipping.
#
# Real wall clock, no --virtual-time-budget, results by POST. Same reasons
# as _time_probe.py; read its header.
import io, os, shutil, tempfile, sys, subprocess, threading
import http.server, socketserver

ROOT = r'C:\Users\a.bodrov\Projects\kubik'
# A FRESH profile of this probe's own. Sharing Chrome's default profile
# makes the run exit in seconds whenever a Chrome is open; a FIXED
# directory makes the next run open this run's autosaved scene.
PROF = tempfile.mkdtemp(prefix='_prof_')
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
PORT = 8851
JS = sys.argv[1] if len(sys.argv) > 1 else '_prof_probe.js'
WITH_BASELINE = len(sys.argv) > 3 and sys.argv[3] == 'baseline'
OUT = sys.argv[2] if len(sys.argv) > 2 else '_prof_out.txt'

src = io.open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()

# ---- the instrumentation, as anchored replacements -----------------------
# Each anchor must appear EXACTLY ONCE or the run aborts. A silently
# unplaced mark would report a phase as free.
MARKS = [
 # open the accumulator at the top of applyShading
 ("""function applyShading(obj) {
  PERF.shade++;""",
  """function applyShading(obj) {
  PERF.shade++;
  const _P = window.__PROF || (window.__PROF = {});
  let _pm = performance.now();
  const _pmark = (kk) => { const nn = performance.now(); _P[kk] = (_P[kk] || 0) + (nn - _pm); _pm = nn; };"""),

 # 1. what a2.83 left where the baseline shading pass used to be: an
 #    allocation, and only when the attribute is missing or the wrong size.
 #    `baseline` as a third argument puts the deleted call back, timed here,
 #    so one run can be compared against another that did not.
 ("""  const index = geo.index;
  /* STAMPED EVEN WHEN THERE IS NOTHING TO SAY.""",
  """  RACE_BASELINE_HERE
  _pmark('1_baseNormals');
  const index = geo.index;
  /* STAMPED EVEN WHEN THERE IS NOTHING TO SAY."""),

 # 2. the topology cache (hits when the geometry is reused, misses per op)
 ("""    const topo = shadingTopoFor(geo);""",
  """    const topo = shadingTopoFor(geo);
    _pmark('2_topo');"""),

 # 3. the signed-volume / winding pass
 ("""        if (flip) for (let i = 0; i < comp.length; i++) triSign[comp[i]] = -triSign[comp[i]];
      }
    }""",
  """        if (flip) for (let i = 0; i < comp.length; i++) triSign[comp[i]] = -triSign[comp[i]];
      }
    }
    _pmark('3_signedVolume');"""),

 # 4. triangle + group normals (the pass that duplicates computeVertexNormals)
 ("""    groupNormal.forEach(n => { if (n.lengthSq() > 1e-12) n.normalize(); });""",
  """    groupNormal.forEach(n => { if (n.lengthSq() > 1e-12) n.normalize(); });
    _pmark('4_triNormals');"""),

 # 5. the sharp / wear Map loop over every edge
 ("""      wear.set(k, creased ? true
                : mark === 'sharp' ? true
                : fs.length !== 2 ? true
                : mark === 'smooth' ? false
                : sh);
    });""",
  """      wear.set(k, creased ? true
                : mark === 'sharp' ? true
                : fs.length !== 2 ? true
                : mark === 'smooth' ? false
                : sh);
    });
    _pmark('5_sharpWear');"""),

 # 6. the per-vertex union-find that actually writes the normals
 ("""    geo.attributes.normal.needsUpdate = true;""",
  """    geo.attributes.normal.needsUpdate = true;
    _pmark('6_unionFind');"""),

 # 7. the wear-edge list (a2.75 skips this entirely for most objects)
 ("""    geo.userData.kubikEdges = {
      pos: new Float32Array(wePos),
      kind: new Uint8Array(weKind),
      gen: ++_wearGen
    };""",
  """    geo.userData.kubikEdges = {
      pos: new Float32Array(wePos),
      kind: new Uint8Array(weKind),
      gen: ++_wearGen
    };
    _pmark('7_wearList');"""),

 # ---- buildShadingTopo's own sub-phases (keys 2a..2e) -------------------
 # These are INSIDE 2_topo, so they double-count against the wall clock on
 # purpose. The probe prints them on their own line.
 ("""function buildShadingTopo(geo) {
  PERF.shadeTopo++;""",
  """function buildShadingTopo(geo) {
  PERF.shadeTopo++;
  const _Q = window.__PROF || (window.__PROF = {});
  let _qm = performance.now();
  const _qmark = (kk) => { const nn = performance.now(); _Q[kk] = (_Q[kk] || 0) + (nn - _qm); _qm = nn; };"""),

 ("""  const { logicalOf, logicalGroups } = computeLogicalOf(posAttr);""",
  """  const { logicalOf, logicalGroups } = computeLogicalOf(posAttr);
  _qmark('2a_computeLogicalOf');"""),

 ("""  groupsSrc.forEach((g, gi) => {
    const ts = g.start / 3, tc = g.count / 3;
    for (let t = 0; t < tc; t++) triGroup[ts + t] = gi;
  });""",
  """  groupsSrc.forEach((g, gi) => {
    const ts = g.start / 3, tc = g.count / 3;
    for (let t = 0; t < tc; t++) triGroup[ts + t] = gi;
  });
  _qmark('2b_triGroup');"""),

 ("""      comps.push(comp); compClosed.push(closed);
    }
  }""",
  """      comps.push(comp); compClosed.push(closed);
    }
  }
  _qmark('2c_windingComponents');"""),

 ("""      let lst = trisAt.get(l);
      if (!lst) { lst = []; trisAt.set(l, lst); }
      lst.push(t);
    }
  }""",
  """      let lst = trisAt.get(l);
      if (!lst) { lst = []; trisAt.set(l, lst); }
      lst.push(t);
    }
  }
  _qmark('2d_trisAt');"""),

 ("""      rec.use[gi]++;
    }
  }

  return {""",
  """      rec.use[gi]++;
    }
  }
  _qmark('2e_edgeMaps');

  return {"""),
]

for old, new in MARKS:
    n = src.count(old)
    if n != 1:
        print('ANCHOR MISS (%d occurrences): %r' % (n, old[:70]))
        sys.exit(1)
    src = src.replace(old, new, 1)
src = src.replace('RACE_BASELINE_HERE',
                  '  geo.computeVertexNormals();' if WITH_BASELINE else '')
print('instrumented %d phases; baseline %s' % (len(MARKS),
      'PUT BACK - this run measures a2.82 behaviour'
      if WITH_BASELINE else 'absent - this run measures a2.83'))

js = io.open(os.path.join(ROOT, JS), encoding='utf-8').read()
assert '</body>' in src
io.open(os.path.join(ROOT, '_prof_probe.html'), 'w', encoding='utf-8', newline='').write(
    src.replace('</body>', '<script>\n' + js + '\n</script>\n</body>', 1))

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

url = 'http://127.0.0.1:%d/_prof_probe.html?debug=1' % PORT
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
ok = done.wait(timeout=300)
try:
    p.terminate()
    p.wait(timeout=20)
except Exception:
    p.kill()
srv.shutdown()
shutil.rmtree(PROF, ignore_errors=True)

txt = result['text'] if ok and result['text'] else 'NO PROBE OUTPUT (timed out)'
io.open(os.path.join(ROOT, OUT), 'w', encoding='utf-8').write(txt)
print(txt)
