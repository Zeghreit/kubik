"""Pre-ship check for index.html. Run: python _verify.py [file]

Two checks, because they catch different things:

  1. node --check on the extracted <script> block. Real parse, real errors.
  2. Duplicate top-level declarations. This is the one that matters most and
     the one _syntax.py CANNOT catch - esprima parses a second copy of a
     function quite happily, but the browser throws a hard SyntaxError and
     the whole app renders blank. Left-behind duplicates after a rewrite
     have done this more than once.

Node lives in %USERPROFILE%\\Tools\\node-*-win-x64 (portable, no installer),
so this finds it rather than relying on PATH.
"""
import glob
import os
import re
import subprocess
import sys
import tempfile

TARGET = sys.argv[1] if len(sys.argv) > 1 else 'index.html'


def find_node():
    exe = os.path.join(os.environ.get('USERPROFILE', ''), 'Tools', 'node-*-win-x64', 'node.exe')
    hits = sorted(glob.glob(exe))
    if hits:
        return hits[-1]
    for p in os.environ.get('PATH', '').split(os.pathsep):
        cand = os.path.join(p, 'node.exe')
        if os.path.isfile(cand):
            return cand
    return None


def main():
    src = open(TARGET, encoding='utf-8').read()
    blocks = re.findall(r'<script[^>]*>(.*?)</script>', src, re.S)
    if not blocks:
        print('FAIL: no <script> block found in', TARGET)
        return 1
    big = max(blocks, key=len)
    ok = True

    # --- duplicate top-level declarations ---
    names = {}
    for m in re.finditer(r'^(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)', big, re.M):
        names.setdefault(m.group(1), []).append(m.start())
    dups = {k: len(v) for k, v in names.items() if len(v) > 1}
    if dups:
        ok = False
        print('FAIL: duplicate top-level declarations ->', dups)
    else:
        print('OK  : no duplicate top-level declarations')

    # --- real parse ---
    node = find_node()
    if not node:
        print('WARN: node not found, skipped the parse check')
    else:
        tmp = os.path.join(tempfile.gettempdir(), '_kubik_check.mjs')
        open(tmp, 'w', encoding='utf-8').write(big)
        r = subprocess.run([node, '--check', tmp], capture_output=True, text=True)
        os.remove(tmp)
        if r.returncode == 0:
            print('OK  : node --check passed (%d lines)' % (big.count('\n') + 1))
        else:
            ok = False
            print('FAIL: node --check\n' + (r.stderr or r.stdout))

    print('\n' + ('PASS' if ok else 'DO NOT SHIP'))
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
