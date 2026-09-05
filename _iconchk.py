import io, re
s = io.open('index.html', encoding='utf-8').read()
i = s.index('const HELP_QUICKSTART')
j = s.index('function helpRow(r)')
used = set(re.findall(r"^\s*\['([a-z_]+)',", s[i:j], re.M))
k = s.index("bevel:   '<path")
blk = s[k - 4000:k + 9000]
have = set(re.findall(r"^\s*([a-z_]+):\s*'<", blk, re.M))
print('used  :', ' '.join(sorted(used)))
print('missing:', ' '.join(sorted(used - have)) or 'NONE')
print('table  :', len(have), 'entries')
