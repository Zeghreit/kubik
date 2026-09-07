import io, os, sys, subprocess, threading
import http.server, socketserver

ROOT = r'C:\Users\a.bodrov\Projects\kubik'
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
PORT = 8861
WHICH = sys.argv[1] if len(sys.argv) > 1 else 'wip'   # 'wip' or 'head'

if WHICH == 'head':
    src = subprocess.check_output(['git', 'show', 'HEAD:index.html'], cwd=ROOT)
    src = src.decode('utf-8', 'replace')
    label = 'a2.84 (the long-lens emulation)'
else:
    src = io.open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    label = 'a2.85 (a real orthographic camera)'

js = io.open(os.path.join(ROOT, '_lens_probe.js'), encoding='utf-8').read()
page = '_lens_%s.html' % WHICH
io.open(os.path.join(ROOT, page), 'w', encoding='utf-8', newline='').write(
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

cmd = [CHROME, '--headless=new', '--disable-gpu-sandbox', '--no-sandbox',
       '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
       '--window-size=900,700',
       '--user-data-dir=' + os.path.join(ROOT, '_chrome_lens_' + WHICH),
       'http://127.0.0.1:%d/%s?debug=1' % (PORT, page)]
p = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
ok = done.wait(timeout=110)
try:
    p.terminate(); p.wait(timeout=20)
except Exception:
    p.kill()
srv.shutdown()

print('--- ' + label)
print(result['text'] if ok and result['text'] else 'NO PROBE OUTPUT (timed out)')
