import io, sys

P = r'C:\Users\a.bodrov\Projects\kubik\_sharechk.js'
s = io.open(P, encoding='utf-8').read()
ok = True

def sub(old, new, label):
    global s, ok
    if s.count(old) != 1:
        print('MISS %-16s (%d)' % (label, s.count(old)))
        ok = False
        return
    s = s.replace(old, new)
    print('ok   %s' % label)

# 1. the observer
sub("""    let downloads = 0, shared = null;""",
    """    let downloads = 0, shared = null;
    /* WHAT THE USER IS TOLD, not only what the app did (v2.8e). Counting
       downloads cannot tell "cancel handled quietly" from "cancel handled
       loudly" - and saying "Exported" for a file the user just declined was
       the actual bug. toast() writes textContent and adds .show, and a timer
       1600ms later removes .show only, so textContent is the timer-proof
       reading: blank it before each call, read it after. */
    const toastEl = document.getElementById('toast');
    const clearToast = () => { if (toastEl) toastEl.textContent = ''; };
    const saidWhat = () => (toastEl ? toastEl.textContent : '(no #toast)');""",
    'observer')

# 2. desk download
sub("""    downloads = 0;
    K.downloadBlob(['{}'], 'model.json', 'application/json');
    await sleep(60);
    ok('and a file downloads', downloads === 1, downloads + ' download(s)');""",
    """    downloads = 0; clearToast();
    K.downloadBlob(['{}'], 'model.json', 'application/json', 'Project saved');
    await sleep(60);
    ok('and a file downloads', downloads === 1, downloads + ' download(s)');
    ok('and says so', saidWhat() === 'Project saved', saidWhat());""",
    'desk download')

# 3. successful share
sub("""    downloads = 0; shared = null;
    navigator.share = (d) => { shared = d; return Promise.resolve(); };
    K.downloadBlob(['solid x\\n'], 'model.stl', 'model/stl');""",
    """    downloads = 0; shared = null; clearToast();
    navigator.share = (d) => { shared = d; return Promise.resolve(); };
    K.downloadBlob(['solid x\\n'], 'model.stl', 'model/stl', 'Exported .stl');""",
    'share ok')

sub("""    ok('and nothing downloaded behind it', downloads === 0, downloads + ' download(s)');""",
    """    ok('and nothing downloaded behind it', downloads === 0, downloads + ' download(s)');
    ok('and it says so AFTER the sheet settles', saidWhat() === 'Exported .stl', saidWhat());""",
    'share ok toast')

# 4. cancel
sub("""    downloads = 0;
    navigator.share = () => Promise.reject(Object.assign(new Error('x'), { name: 'AbortError' }));
    K.downloadBlob(['x'], 'a.obj', 'text/plain');
    await sleep(80);
    ok('cancelling does NOT force a download', downloads === 0, downloads + ' download(s)');""",
    """    downloads = 0; shared = null; clearToast();
    navigator.share = (d) => { shared = d;
      return Promise.reject(Object.assign(new Error('x'), { name: 'AbortError' })); };
    K.downloadBlob(['x'], 'a.obj', 'text/plain', 'Exported .obj');
    await sleep(80);
    /* The sheet has to have been REACHED, or the two checks under it pass on
       a downloadBlob that quietly did nothing at all. */
    ok('the cancelled export reached the sheet', !!shared);
    ok('cancelling does NOT force a download', downloads === 0, downloads + ' download(s)');
    ok('and NOTHING is claimed', saidWhat() === '', saidWhat() || '(silent)');""",
    'cancel')

# 5. refusal
sub("""    downloads = 0;
    navigator.share = () => Promise.reject(Object.assign(new Error('x'), { name: 'NotAllowedError' }));
    K.downloadBlob(['x'], 'b.obj', 'text/plain');
    await sleep(80);
    ok('a refusal falls back to the download', downloads === 1, downloads + ' download(s)');""",
    """    downloads = 0; clearToast();
    navigator.share = () => Promise.reject(Object.assign(new Error('x'), { name: 'NotAllowedError' }));
    K.downloadBlob(['x'], 'b.obj', 'text/plain', 'Exported .obj');
    await sleep(80);
    ok('a refusal falls back to the download', downloads === 1, downloads + ' download(s)');
    ok('and that one DOES say so', saidWhat() === 'Exported .obj', saidWhat() || '(silent)');""",
    'refusal')

# 6. no canShare
sub("""    K.downloadBlob(['x'], 'c.obj', 'text/plain');
    await sleep(60);
    ok('it still downloads', downloads === 1, downloads + ' download(s)');""",
    """    clearToast();
    K.downloadBlob(['x'], 'c.obj', 'text/plain', 'Exported .obj');
    await sleep(60);
    ok('it still downloads', downloads === 1, downloads + ' download(s)');
    ok('and says so', saidWhat() === 'Exported .obj', saidWhat() || '(silent)');""",
    'no canShare')

if not ok:
    print('NOT WRITTEN')
    sys.exit(1)
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('written')
