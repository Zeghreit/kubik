# Runs _norm_probe.js against BOTH the committed index.html and the working
# copy, and diffs the two reports model by model. Cross-version is fine here
# because nothing is timed - only the normals each version produces.
import io, os, shutil, tempfile, sys, subprocess, threading
import http.server, socketserver

ROOT = r'C:\Users\a.bodrov\Projects\kubik'
# A FRESH profile of this probe's own. Sharing Chrome's default profile
# makes the run exit in seconds whenever a Chrome is open; a FIXED
# directory makes the next run open this run's autosaved scene.
PROF = tempfile.mkdtemp(prefix='_prof_')
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
PORT = 8863

JS = io.open(os.path.join(ROOT, '_norm_probe.js'), encoding='utf-8').read()


def page(src, name):
    assert '</body>' in src
    p = os.path.join(ROOT, name)
    io.open(p, 'w', encoding='utf-8', newline='').write(
        src.replace('</body>', '<script>\n' + JS + '\n</script>\n</body>', 1))
    return name


def run(page_name, tag):
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
           '--user-data-dir=' + os.path.join(ROOT, '_chrome_norm_' + tag),
           'http://127.0.0.1:%d/%s?debug=1' % (PORT, page_name)]
    p = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    ok = done.wait(timeout=180)
    try:
        p.terminate(); p.wait(timeout=20)
    except Exception:
        p.kill()
    srv.shutdown()
shutil.rmtree(PROF, ignore_errors=True)
    return result['text'] if ok and result['text'] else 'NO PROBE OUTPUT'


head = subprocess.run(['git', 'show', 'HEAD:index.html'], cwd=ROOT,
                      capture_output=True)
if head.returncode != 0:
    print('git show failed'); sys.exit(1)
head_src = head.stdout.decode('utf-8')
wip_src = io.open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()

a = run(page(head_src, '_norm_head.html'), 'head')
b = run(page(wip_src, '_norm_wip.html'), 'wip')
io.open(os.path.join(ROOT, '_norm_head.txt'), 'w', encoding='utf-8').write(a)
io.open(os.path.join(ROOT, '_norm_wip.txt'), 'w', encoding='utf-8').write(b)


def rows(t):
    d = {}
    for line in t.split('\n'):
        if '=' in line:
            key, val = line.split('=', 1)
            d[key] = val
    return d


ra, rb = rows(a), rows(b)
if 'NO PROBE OUTPUT' in (a, b):
    print('HEAD:', a[:200]); print('WIP :', b[:200]); sys.exit(1)

same, diff, only = [], [], []
for key in sorted(set(ra) | set(rb)):
    if key not in ra or key not in rb:
        only.append('%s (%s)' % (key, 'HEAD only' if key in ra else 'WIP only'))
    elif ra[key] == rb[key]:
        same.append(key)
    else:
        diff.append('%s\n    HEAD: %s\n    WIP : %s' % (key, ra[key], rb[key]))

print('IDENTICAL: %d of %d models' % (len(same), len(same) + len(diff)))
if only:
    print('ONLY IN ONE: ' + ', '.join(only))
if diff:
    print('DIFFERING:')
    for d in diff:
        print('  ' + d)
else:
    print('no model differs')
