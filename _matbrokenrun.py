import io, re, subprocess, sys

EXPECT = {
    'merge':        ['1.1', '1.3', '1.7', '1.10'],
    'unnamed':      ['1.6'],
    'presettarget': ['1.8'],
    'samefile':     ['1.10'],
    'slice':        ['1.11'],
    'namekey':      ['2.2'],
    'harvest':      ['2.1'],
    'protokey':     ['2.3'],
    'strict':       ['3.2', '3.3'],
    'tray':         ['3.6'],
    'trayopen':     ['3.7'],
    'save':         ['3.8'],
    'heal':         ['3.9'],
    'mute':         ['3.3', '3.10'],
}

blind = 0
for m in EXPECT:
    subprocess.run([sys.executable, '_mkmatbroken.py', m], check=True,
                   stdout=subprocess.DEVNULL)
    subprocess.run(['taskkill', '/F', '/IM', 'chrome.exe', '/T'],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    subprocess.run([sys.executable, '-u', '_matchk.py', '_broken_mat.html'],
                   capture_output=True)
    txt = io.open('_matchk_out.txt', encoding='utf-8').read()
    prefixes = sorted(set(x.split()[0] for x in re.findall(r'^FAIL (.+)$', txt, re.M)))
    verdict = 'FAIL' if 'VERDICT=FAIL' in txt else ('PASS' if 'VERDICT=PASS' in txt else '??')
    miss = [w for w in EXPECT[m] if not any(p == w for p in prefixes)]
    good = verdict == 'FAIL' and not miss
    if not good:
        blind += 1
    print('%-13s verdict=%-4s caught=%-28s missing=%-10s -> %s'
          % (m, verdict, ','.join(prefixes) or '-', ','.join(miss) or '-',
             'GOOD' if good else 'PROBE BLIND'))
print('\n%d of %d modes caught' % (len(EXPECT) - blind, len(EXPECT)))
