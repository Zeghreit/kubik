import io, os, shutil, tempfile, re, subprocess, threading, functools, time
import http.server, socketserver

ROOT = r'C:\Users\a.bodrov\Projects\kubik'
# A FRESH profile of this probe's own. Sharing Chrome's default profile
# makes the run exit in seconds whenever a Chrome is open; a FIXED
# directory makes the next run open this run's autosaved scene.
PROF = tempfile.mkdtemp(prefix='_prof_')
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
PORT = 8841
RESULT = {}

src = io.open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
js = io.open(os.path.join(ROOT, '_therm_probe.js'), encoding='utf-8').read()
assert '</body>' in src
io.open(os.path.join(ROOT, '_therm_probe.html'), 'w', encoding='utf-8', newline='').write(
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

# NO swiftshader and NO virtual clock: this one has to be a real GPU and a
# real wall clock or every number it prints is a lie. The page POSTs its own
# result back rather than being dumped, because --dump-dom fires at load.
url = 'http://127.0.0.1:%d/_therm_probe.html?debug=1' % PORT
prof = os.path.join(ROOT, '_therm_prof')
cmd = [CHROME, '--headless=new', '--no-sandbox', '--user-data-dir=' + PROF,
       # SHARED, and deliberately not the fresh profile: the app pulls three.js
       # from a CDN on every load, and a cold cache is what actually broke
       # _imp_probe. State fresh, network warm.
       '--disk-cache-dir=' + os.path.join(ROOT, '_httpcache'),
       '--no-first-run', '--no-default-browser-check', '--disable-sync',
       '--disable-background-networking', '--disable-component-update',
       '--disable-default-apps', '--disable-extensions', '--metrics-recording-only',
       '--mute-audio',
       '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization',
       '--window-size=900,760', url]
p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
t0 = time.time()
while time.time() - t0 < 180 and 'txt' not in RESULT:
    time.sleep(0.5)
p.kill()
srv.shutdown()
shutil.rmtree(PROF, ignore_errors=True)

if 'txt' in RESULT:
    io.open(os.path.join(ROOT, '_therm_out.txt'), 'w', encoding='utf-8').write(RESULT['txt'])
    print(RESULT['txt'])
else:
    print('NO PROBE OUTPUT after 180s')
    try:
        print((p.stderr.read() or b'').decode('utf-8', 'replace')[-2000:])
    except Exception as e:
        print('stderr unreadable', e)
