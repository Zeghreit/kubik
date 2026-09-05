import io, os, shutil, subprocess, sys, tempfile, threading, time
import http.server, socketserver

ROOT = r'C:\Users\a.bodrov\Projects\kubik'
# A FRESH profile per run: the app autosaves into localStorage, so a fixed
# --user-data-dir means the next run opens this run's scene.
PROF = tempfile.mkdtemp(prefix='_prof_')
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
PORT = 8855
TARGET = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
RESULT = {}

src = io.open(os.path.join(ROOT, TARGET), encoding='utf-8').read()
js = io.open(os.path.join(ROOT, '_rotchk.js'), encoding='utf-8').read()
io.open(os.path.join(ROOT, '_rotchk.html'), 'w', encoding='utf-8', newline='').write(
    src.replace('</body>', '<script>\n' + js + '\n</script>\n</body>', 1))

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)
    def log_message(self, *a): pass
    def do_POST(self):
        n = int(self.headers.get('Content-Length') or 0)
        RESULT['txt'] = self.rfile.read(n).decode('utf-8', 'replace')
        self.send_response(204); self.end_headers()

socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(('127.0.0.1', PORT), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()

url = 'http://127.0.0.1:%d/_rotchk.html?debug=1&t=%d' % (PORT, int(time.time()))
cmd = [CHROME, '--headless=new', '--no-sandbox', '--user-data-dir=' + PROF,
       # SHARED, and deliberately not the fresh profile: the app pulls three.js
       # from a CDN on every load, and a cold cache is what actually broke
       # _imp_probe. State fresh, network warm.
       '--disk-cache-dir=' + os.path.join(ROOT, '_httpcache'),
       '--no-first-run', '--no-default-browser-check', '--disable-sync',
       '--disable-background-networking', '--disable-component-update',
       '--disable-default-apps', '--disable-extensions', '--metrics-recording-only',
       '--mute-audio',
       '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
       '--hide-scrollbars', '--window-size=900,900', url]
p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
t0 = time.time()
while time.time() - t0 < 120 and 'txt' not in RESULT:
    time.sleep(0.3)
p.kill(); srv.shutdown()
shutil.rmtree(PROF, ignore_errors=True)
txt = RESULT.get('txt', 'NO OUTPUT after 120s')
io.open(os.path.join(ROOT, '_rot_out.txt'), 'w', encoding='utf-8').write(txt + '\n')
print('TARGET %s\n%s' % (TARGET, txt))
