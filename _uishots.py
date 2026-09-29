"""UI screenshots for the design pass (cloud). Several states in one run.
Run: python3 _uishots.py <outdir> [WxH] [dpr]
States: 01 cube, object; 02 model, face mode with a selection; 03 tool ring
held on the model; 04 drawer open; 05 Boolean bar open (cube + ball)."""
import os, sys, threading, http.server, socketserver
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1]
W, H = (int(x) for x in (sys.argv[2] if len(sys.argv) > 2 else '390x844').split('x'))
DPR = float(sys.argv[3]) if len(sys.argv) > 3 else 2
os.makedirs(OUT, exist_ok=True)
LIB = os.path.join(ROOT, '_dev', 'csg', 'node_modules')
ADDONS = os.path.join(ROOT, '_dev', 'three-r184', 'examples', 'jsm')
src = open(os.environ.get('KUBIK_INDEX') or os.path.join(ROOT, 'index.html'), encoding='utf-8').read()

class Hd(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw): super().__init__(*a, directory=ROOT, **kw)
    def log_message(self, *a): pass
    def do_GET(self):
        if self.path.split('?')[0] == '/_p.html':
            b = src.encode('utf-8'); self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8'); self.send_header('Content-Length', str(len(b)))
            self.end_headers(); self.wfile.write(b); return
        super().do_GET()
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(('127.0.0.1', 0), Hd); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
CDN = 'https://cdn.jsdelivr.net/npm/'
MAP = [(CDN + 'three@0.184.0/build/', os.path.join(LIB, 'three', 'build')),
       (CDN + 'three@0.184.0/examples/jsm/', ADDONS),
       (CDN + 'three-mesh-bvh@0.9.7/build/', os.path.join(LIB, 'three-mesh-bvh', 'build')),
       (CDN + 'three-bvh-csg@0.0.18/build/', os.path.join(LIB, 'three-bvh-csg', 'build'))]
def route(r):
    u = r.request.url
    if u.startswith('http://127.0.0.1:%d/' % port): return r.continue_()
    for pre, d in MAP:
        if u.startswith(pre):
            f = os.path.join(d, u[len(pre):].split('?')[0])
            return r.fulfill(path=f, content_type='application/javascript') if os.path.isfile(f) else r.fulfill(status=404, body='')
    if u.startswith('https://fonts.'): return r.continue_()
    return r.abort()

CLEAR = """() => { const K = window.__kubik; K.App.objects.slice().forEach(o => { try { o.mesh.parent.remove(o.mesh); } catch (e) {} });
  K.App.objects.length = 0; K.setMode('object'); }"""
MK = """([n, k, x]) => { const K = window.__kubik; const ed = K.buildPrimitiveEditable(k, k === 'sphere' ? { h: 16, v: 8 } : {});
  const o = K.createObjectFromEditable(n, new K.THREE.Vector3(x, 0, 0), ed, K.makeMaterialSet(ed.groups.length, 0x9aa3b2), {});
  K.ensureHelpers(o); return o.id; }"""

with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=DPR, has_touch=W < 700)
    pg.route('**/*', route)
    pg.goto('http://127.0.0.1:%d/_p.html?debug=1' % port)
    pg.wait_for_function('() => window.__kubik && window.__kubik.App', timeout=60000)
    pg.wait_for_timeout(2500)
    def shot(name):
        pg.wait_for_timeout(900); pg.screenshot(path=os.path.join(OUT, name + '.png'))
    # 01 a cube, Object mode
    pg.evaluate(CLEAR); a = pg.evaluate(MK, ['Cube', 'cube', 0])
    pg.evaluate("id => { const K = window.__kubik; K.App.selectedObjectIds = new Set([id]); K.App.activeObjectId = id; K.frameBox && K.frameBox(new K.THREE.Box3(new K.THREE.Vector3(-1,-1,-1), new K.THREE.Vector3(1,1,1))); }", a)
    shot('01-object')
    # 02 the model, Face mode, a few faces selected
    pg.evaluate(CLEAR)
    pg.evaluate("async () => { const K = window.__kubik; const doc = await (await fetch('/_dev/female.json')).json(); K.restoreDoc(doc); }")
    pg.wait_for_timeout(800)
    pg.evaluate("""() => { const K = window.__kubik; const A = K.App.objects[0]; K.App.selectedObjectIds = new Set([A.id]); K.App.activeObjectId = A.id;
      K.frameBox(new K.THREE.Box3().setFromObject(A.mesh)); K.setMode('face'); }""")
    pg.wait_for_timeout(600)
    pg.mouse.click(W / 2, H * 0.42)
    shot('02-face')
    # 03 the tool ring: press and hold on the model
    pg.mouse.move(W / 2, H * 0.45); pg.mouse.down(); pg.wait_for_timeout(1200)
    shot('03-ring')
    pg.mouse.up(); pg.wait_for_timeout(300); pg.keyboard.press('Escape')
    # 04 drawer
    pg.evaluate("() => document.getElementById('btnMenu').click()")
    shot('04-drawer')
    pg.evaluate("() => { document.getElementById('scrim').click(); }")
    # 05 Boolean bar
    pg.evaluate(CLEAR); a = pg.evaluate(MK, ['Cube', 'cube', 0]); c = pg.evaluate(MK, ['Ball', 'sphere', 0.5])
    pg.evaluate("([a, c]) => { const K = window.__kubik; K.App.selectedObjectIds = new Set([a, c]); K.App.activeObjectId = null; K.booleanSelection(); }", [a, c])
    pg.wait_for_timeout(1500)
    shot('05-boolean')
    b.close()
print('done', sorted(os.listdir(OUT)))
