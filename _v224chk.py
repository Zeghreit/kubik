import io, os, shutil, subprocess, sys, tempfile, threading, time
import http.server, socketserver

ROOT = r'C:\Users\a.bodrov\Projects\kubik'
PROF = tempfile.mkdtemp(prefix='_prof_')
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
PORT = 8863
TARGET = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
RESULT = {}

src = io.open(os.path.join(ROOT, TARGET), encoding='utf-8').read()
js = io.open(os.path.join(ROOT, '_v224chk.js'), encoding='utf-8').read()
io.open(os.path.join(ROOT, '_v224chk.html'), 'w', encoding='utf-8', newline='').write(
    src.replace('</body>', '<script>\n' + js + '\n</script>\n</body>', 1))

# A STATIC HALF, because which constant each site reads is the whole change and
# a running probe can only see one of the three sites at a time.
STATIC = []
def stat_ok(name, cond, detail=''):
    STATIC.append(('PASS ' if cond else 'FAIL ') + name + ('  ' + detail if detail else ''))
    return cond

import re
def block(fn):
    i = src.index('\nfunction %s(' % fn)
    j = src.index('\nfunction ', i + 10)
    return src[i:j]

b_bool = block('booleanBuild')
b_tube = block('tubeCurveOp')
b_land = block('landImport')
stat_ok('0.src    boolean reads OP_FACE_BUDGET and not the import one',
        'OP_FACE_BUDGET' in b_bool and 'MESH_FACE_BUDGET' not in b_bool)
stat_ok('0.src    the tube sweep reads OP_FACE_BUDGET and not the import one',
        'OP_FACE_BUDGET' in b_tube and 'MESH_FACE_BUDGET' not in b_tube)
stat_ok('0.src    landImport reads MESH_FACE_BUDGET and not the op one',
        'MESH_FACE_BUDGET' in b_land and 'OP_FACE_BUDGET' not in b_land)
# v2.24a: the two ops the review found ungated, and the one whose budget was
# in the caller instead of where both callers reach it.
b_sub = block('subdivideOp')
b_rev = block('revolveSweep')
stat_ok('0.src    subdivide is gated, and by the HOLD ceiling',
        'MESH_FACE_BUDGET' in b_sub and 'OP_FACE_BUDGET' not in b_sub)
stat_ok('0.src    every sweep of revolution is gated, inside revolveSweep',
        'OP_FACE_BUDGET' in b_rev)
stat_ok('0.src    lathe therefore has a budget at all',
        'OP_FACE_BUDGET' in b_rev and 'revolveSweep(' in block('latheCurveOp'))
stat_ok('0.src    and the pairing pass is short-circuited above 2x the ceiling',
        'MESH_FACE_BUDGET * 2' in b_land)
# The `) {` is load-bearing: the short-circuit added in v2.24a reads
# `faceTotal > MESH_FACE_BUDGET * 2` and sits ABOVE the pass on purpose, so
# matching the bare name found that one and called the order wrong.
stat_ok('0.src    landImport pairs BEFORE it checks the face budget',
        b_land.index('pairTrisInEditable') < b_land.index('faceTotal > MESH_FACE_BUDGET) {'))
stat_ok('0.src    and recounts faceTotal after pairing',
        'faceTotal = 0;' in b_land.split('pairTrisInEditable')[1].split('MESH_FACE_BUDGET')[0])
# WHICH QUESTION landImport ASKS THE CORE. It supplies the two callbacks
# itself, and a constant in either place is a real defect the running half can
# only see when the flattest pairing happens to cross a material boundary -
# which is what 4b builds on purpose, and this is the cheap exact version.
_call = b_land[b_land.index('pairTrisInEditable'):]
_call = _call[:_call.index(');')]
stat_ok('0.src    and asks the FILE material key, not a constant',
        '.mat' in _call, _call.replace('\n', ' ')[:120])


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

url = 'http://127.0.0.1:%d/_v224chk.html?debug=1&t=%d' % (PORT, int(time.time()))
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
rfails = len([x for x in txt.split('\n') if x.startswith('FAIL')])
head = '\n'.join(STATIC) + '\n'
txt = '\n'.join([x for x in txt.split('\n') if not x.startswith('VERDICT=')])
total = sfails + rfails
out = head + txt + '\nVERDICT=%s (%d failed: %d in source, %d in the browser)' % (
    'FAIL' if total else 'PASS', total, sfails, rfails)
io.open(os.path.join(ROOT, '_v224chk_out.txt'), 'w', encoding='utf-8').write(out + '\n')
print('TARGET %s\n%s' % (TARGET, out))
