import io
s = io.open('index.html', encoding='utf-8', errors='replace').read()
for p in ('matrixWorldInverse.copy', 'orthoCam.updateMatrixWorld',
          'perspCam.updateMatrixWorld', 'SETTLE THE NEW LENS'):
    print('%-32s %d' % (p, s.count(p)))
