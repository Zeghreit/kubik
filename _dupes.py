import re
s = open('index.html', encoding='utf-8').read()
tag = '<script type="module">'
i = s.index(tag) + len(tag)
js = s[i:s.index('</script>', i)]

names = {}
for n, ln in enumerate(js.split('\n'), 1):
    m = re.match(r'(?:async\s+)?function\s+([\w$]+)', ln)
    if m and ln and not ln[0].isspace():
        names.setdefault(m.group(1), []).append(n)

print("DUPLICATE top-level function declarations:")
found = False
for k, v in sorted(names.items()):
    if len(v) > 1:
        found = True
        print(f"  {k}: lines {v}")
if not found:
    print("  none")

print()
print("also check const/let duplicates:")
consts = {}
for n, ln in enumerate(js.split('\n'), 1):
    m = re.match(r'(?:const|let|var)\s+([\w$]+)', ln)
    if m and ln and not ln[0].isspace():
        consts.setdefault(m.group(1), []).append(n)
for k, v in sorted(consts.items()):
    if len(v) > 1:
        print(f"  {k}: lines {v}")
# name collisions between const and function
both = set(names) & set(consts)
print()
print("declared as BOTH function and const/let:", sorted(both) or "none")
