import base64, io, os, shutil, subprocess, sys, tempfile, threading, time
import http.server, socketserver

ROOT = r'C:\Users\a.bodrov\Projects\kubik'
PROF = tempfile.mkdtemp(prefix='_prof_')
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
PORT = 8865
TARGET = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
RESULT = {}

src = io.open(os.path.join(ROOT, TARGET), encoding='utf-8').read()
js = io.open(os.path.join(ROOT, '_bumpchk.js'), encoding='utf-8').read()
io.open(os.path.join(ROOT, '_bumpchk.html'), 'w', encoding='utf-8', newline='').write(
    src.replace('</body>', '<script>\n' + js + '\n</script>\n</body>', 1))

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)
    def log_message(self, *a): pass
    def do_POST(self):
        n = int(self.headers.get('Content-Length') or 0)
        body = self.rfile.read(n)
        if self.path == '/shot':
            # A picture, not only a mean.
            b = body.decode('ascii', 'replace')
            tag, b = b.split('|', 1)
            b = b[b.find(',') + 1:]
            io.open(os.path.join(ROOT, '_bumpchk_%s.png' % tag), 'wb').write(base64.b64decode(b))
        else:
            RESULT['txt'] = body.decode('utf-8', 'replace')
        self.send_response(204); self.end_headers()

socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(('127.0.0.1', PORT), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()

url = 'http://127.0.0.1:%d/_bumpchk.html?debug=1&t=%d' % (PORT, int(time.time()))
cmd = [CHROME, '--headless=new', '--no-sandbox',
       '--user-data-dir=' + PROF,
       '--disk-cache-dir=' + os.path.join(ROOT, '_httpcache'),
       '--no-first-run', '--no-default-browser-check', '--disable-sync',
       '--disable-background-networking', '--disable-component-update',
       '--disable-default-apps', '--disable-extensions', '--metrics-recording-only',
       '--mute-audio',
       '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
       '--hide-scrollbars', '--window-size=900,900', url]
p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
t0 = time.time()
while time.time() - t0 < 180 and 'txt' not in RESULT:
    time.sleep(0.3)
time.sleep(1.0)          # let the picture land after the report
p.kill(); srv.shutdown()
shutil.rmtree(PROF, ignore_errors=True)
txt = RESULT.get('txt', 'NO OUTPUT after 180s')
io.open(os.path.join(ROOT, '_bumpchk_out.txt'), 'w', encoding='utf-8').write(txt + '\n')
print('TARGET %s\n%s' % (TARGET, txt))
