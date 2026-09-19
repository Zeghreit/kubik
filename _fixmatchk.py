import io
s = io.open('_uvchk.py', encoding='utf-8').read()
s = s.replace('_uvchk', '_matchk').replace('PORT = 8900', 'PORT = 8902')
io.open('_matchk.py', 'w', encoding='utf-8', newline='').write(s)
print('wrote _matchk.py, cyrillic ok:', 'boot' in s, s.count('_matchk'))
