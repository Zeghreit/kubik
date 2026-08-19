import re
s = open('index.html', encoding='utf-8').read()
tag = '<script type="module">'
i = s.index(tag) + len(tag)
js = s[i:s.index('</script>', i)]

print("=== TOOL SETS: what appears in the arc, per state ===")
for name in ['HUB_TOOLS_EMPTY','HUB_TOOLS_OBJECT_BASE','HUB_TOOLS_VERTEX',
             'HUB_TOOLS_EDGE','HUB_TOOLS_FACE']:
    a = js.index('const ' + name); b = js.index('];', a)
    labels = re.findall(r"label:\s*'([^']+)'", js[a:b])
    rings  = re.findall(r"ring:\s*(\d)", js[a:b])
    r0 = [l for l, r in zip(labels, rings) if r == '0']
    r1 = [l for l, r in zip(labels, rings) if r == '1']
    print(f"\n{name.replace('HUB_TOOLS_','').replace('_BASE',''):8s} ({len(labels)} tools)")
    print(f"   inner: {', '.join(r0) or '-'}")
    print(f"   outer: {', '.join(r1) or '-'}")

print()
print("=== PERSISTENT CONTROLS: what is always on screen ===")
body = s[:s.index(tag)]
groups = {
 'transform readout': ['toolChip'],
 'history':           ['btnUndo','btnRedo'],
 'selection gesture': ['btnSelFree','btnSelBox','btnSelLasso'],
 'view settings':     ['btnSymmetry','btnGrid','btnSmartCam','btnSnap','btnShade'],
 'camera':            ['viewCube'],
 'mode + tools':      ['hubBtn','hubArc'],
 'chrome':            ['btnMenu','status'],
}
for g, ids in groups.items():
    present = [i for i in ids if f'id="{i}"' in body]
    print(f"  {g:20s} {len(present)}  {', '.join(present)}")
total = sum(len([i for i in ids if ('id="' + i + '"') in body]) for ids in groups.values())
print("\n  total persistent elements:", total)
