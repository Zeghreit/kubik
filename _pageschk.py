import time, re, sys, urllib.request
want = sys.argv[1]
for i in range(20):
    try:
        req = urllib.request.Request('https://zeghreit.github.io/kubik/?cb=%d' % i,
                                     headers={'Cache-Control': 'no-cache'})
        h = urllib.request.urlopen(req, timeout=20).read().decode('utf-8', 'replace')
        m = re.search(r'class="brand">Kubik.*?>([a-z0-9.]+)<', h, re.S)
        v = m.group(1) if m else '?'
        print(i, v, len(h))
        if v == want:
            print('LIVE')
            break
    except Exception as e:
        print(i, 'err', e)
    time.sleep(20)
