"""Browser probe runner for the CLOUD session (no Chrome, no CDN there).

Run: python3 _cloudprobe.py _lc278a.js [out.txt]

Same contract as _clean_probe.py: the probe JS is appended before </body>
and POSTs its lines to /result. Differences, all because the cloud blocks
cdn.jsdelivr.net:
  - three / three-mesh-bvh / three-bvh-csg come from _dev/csg;
  - three/addons/ from a sparse clone of mrdoob/three.js at r184 (GitHub is
    reachable); set THREE_ADDONS to its examples/jsm or let it clone one;
  - every other external request is aborted (analytics, eruda).
Needs: pip install playwright (Chromium is already in the image).
"""
import os, subprocess, sys, threading, http.server, socketserver
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.abspath(__file__))
JS = sys.argv[1] if len(sys.argv) > 1 else '_lc278a.js'
OUT = sys.argv[2] if len(sys.argv) > 2 else None
LIB = os.path.join(ROOT, '_dev', 'csg', 'node_modules')
ADDONS = os.environ.get('THREE_ADDONS') or os.path.join(ROOT, '_dev', 'three-r184', 'examples', 'jsm')
if not os.path.isdir(ADDONS):
    dst = os.path.join(ROOT, '_dev', 'three-r184')
    subprocess.run(['git', 'clone', '-q', '--depth', '1', '--branch', 'r184', '--filter=blob:none',
                    '--sparse', 'https://github.com/mrdoob/three.js', dst], check=True)
    subprocess.run(['git', '-C', dst, 'sparse-checkout', 'set', 'examples/jsm'], check=True)

src = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
js = open(os.path.join(ROOT, JS), encoding='utf-8').read()
page_html = src.replace('</body>', '<script>\n' + js + '\n</script>\n</body>', 1)

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)
    def log_message(self, *a):
        pass
    def do_GET(self):
        if self.path.split('?')[0] == '/_probe.html':
            b = page_html.encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(b)))
            self.end_headers()
            self.wfile.write(b)
            return
        super().do_GET()

socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(('127.0.0.1', 0), H)
port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()

CDN = 'https://cdn.jsdelivr.net/npm/'
MAP = [
    (CDN + 'three@0.184.0/build/', os.path.join(LIB, 'three', 'build')),
    (CDN + 'three@0.184.0/examples/jsm/', ADDONS),
    (CDN + 'three-mesh-bvh@0.9.7/build/', os.path.join(LIB, 'three-mesh-bvh', 'build')),
    (CDN + 'three-bvh-csg@0.0.18/build/', os.path.join(LIB, 'three-bvh-csg', 'build')),
]
result = {'text': None}
posts = []
done = threading.Event()

def route(r):
    url = r.request.url
    if url.startswith('http://127.0.0.1:%d/' % port):
        if r.request.method == 'POST':
            # /result ends the run; any other POST path is a progress line.
            path = url.split('?')[0].split('/', 3)[-1]
            body = r.request.post_data or ''
            if path == 'result':
                result['text'] = body
                done.set()
            else:
                posts.append(path + ': ' + body)
            return r.fulfill(status=204, body='')
        return r.continue_()
    for pre, d in MAP:
        if url.startswith(pre):
            f = os.path.join(d, url[len(pre):].split('?')[0])
            if os.path.isfile(f):
                return r.fulfill(path=f, content_type='application/javascript')
            return r.fulfill(status=404, body='missing ' + f)
    return r.abort()

with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 1100, 'height': 800})
    logs = []
    pg.on('console', lambda m: logs.append(m.type + ': ' + m.text) if m.type in ('error',) else None)
    pg.on('pageerror', lambda e: logs.append('pageerror: ' + str(e)))
    pg.route('**/*', route)
    pg.goto('http://127.0.0.1:%d/_probe.html?debug=1' % port)
    t = 0
    while not done.is_set() and t < 150:
        pg.wait_for_timeout(500)
        t += 0.5
        # The other contract: a <pre id=probeOut> and the title PROBE-DONE.
        try:
            if pg.title() == 'PROBE-DONE':
                result['text'] = pg.inner_text('#probeOut')
                break
        except Exception:
            pass
    b.close()

text = result['text'] if result['text'] is not None else ('\n'.join(posts) if posts else 'NO RESULT (timeout)\n' + '\n'.join(logs[:20]))
if OUT:
    open(os.path.join(ROOT, OUT), 'w', encoding='utf-8').write(text)
print(text)
