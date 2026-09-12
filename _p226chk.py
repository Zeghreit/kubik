import io, os, shutil, subprocess, sys, tempfile, threading, time
import http.server, socketserver

ROOT = r'C:\Users\a.bodrov\Projects\kubik'
PROF = tempfile.mkdtemp(prefix='_prof_')
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
PORT = 8867
TARGET = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
RESULT = {}

src = io.open(os.path.join(ROOT, TARGET), encoding='utf-8').read()
js = io.open(os.path.join(ROOT, '_p226chk.js'), encoding='utf-8').read()
io.open(os.path.join(ROOT, '_p226chk.html'), 'w', encoding='utf-8', newline='').write(
    src.replace('</body>', '<script>\n' + js + '\n</script>\n</body>', 1))

# A STATIC HALF for the one claim a running probe cannot see: the cache is
# cleared BY THE FRAME. Without that line a stale rect survives until the next
# resize or scroll, and every pick in between is offset - which is a wrong
# answer, not a slow one.
STATIC = []


def stat_ok(name, cond, detail=''):
    STATIC.append(('PASS ' if cond else 'FAIL ') + name + ('  ' + detail if detail else ''))
    return cond


def block(fn):
    i = src.index('\nfunction %s(' % fn)
    j = src.index('\nfunction ', i + 10)
    return src[i:j]


_anim = block('animate')
stat_ok('0.src    the frame drops the viewport-rect cache',
        '_vpRect = null;' in _anim)
stat_ok('0.src    and so do resize, orientationchange and scroll',
        src.count("addEventListener('resize', invalidateViewportRect") == 1 and
        src.count("addEventListener('orientationchange', invalidateViewportRect") == 1 and
        src.count("addEventListener('scroll', invalidateViewportRect") == 1)
stat_ok('0.src    no projector reads the rect directly any more',
        'const r = viewportEl.getBoundingClientRect();\n  return new THREE.Vector2((v.x' not in src)
_settle = block('settleShadingAfterDrag')
stat_ok('0.src    the settle recomputes both bounds exactly',
        'computeBoundingSphere()' in _settle and 'computeBoundingBox()' in _settle)


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def log_message(self, *a):
        pass

    def do_POST(self):
        n = int(self.headers.get('Content-Length') or 0)
        body = self.rfile.read(n).decode('utf-8', 'replace')
        RESULT['mark' if self.path.startswith('/mark') else 'txt'] = body
        self.send_response(204)
        self.end_headers()


socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(('127.0.0.1', PORT), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()

url = 'http://127.0.0.1:%d/_p226chk.html?debug=1&t=%d' % (PORT, int(time.time()))
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
while time.time() - t0 < 300 and 'txt' not in RESULT:
    time.sleep(0.3)
p.kill()
srv.shutdown()
shutil.rmtree(PROF, ignore_errors=True)

txt = RESULT.get('txt')
if txt is None:
    txt = 'NO REPORT after 300s\nlast mark:\n' + RESULT.get('mark', '(none - не дошло до boot)')

# ONE NUMBER FOR BOTH HALVES. The static half used to only be able to turn a
# PASS into a FAIL, so a run with failures on both sides reported the browser's
# count and quietly dropped the source checks from the total.
sfails = len([x for x in STATIC if x.startswith('FAIL')])
# A THROW IS A FAILURE. Counting only lines that start with 'FAIL'
# reported VERDICT=PASS for a run that threw in the middle - and a throw
# is exactly the case where the remaining checks never ran.
rfails = len([x for x in txt.split('\n')
              if x.startswith('FAIL') or x.startswith('THREW')
              or x.startswith('NO REPORT')])
head = '\n'.join(STATIC) + '\n'
txt = '\n'.join([x for x in txt.split('\n') if not x.startswith('VERDICT=')])
total = sfails + rfails
out = head + txt + '\nVERDICT=%s (%d failed: %d in source, %d in the browser)' % (
    'FAIL' if total else 'PASS', total, sfails, rfails)
io.open(os.path.join(ROOT, '_p226chk_out.txt'), 'w', encoding='utf-8').write(out + '\n')
print('TARGET %s\n%s' % (TARGET, out))
