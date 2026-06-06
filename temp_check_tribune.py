import urllib.request, re
url='https://tribune.com.pk/listing/opinion/2026-06-05'
req=urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0'})
page=urllib.request.urlopen(req, timeout=15).read().decode('utf-8','replace')
print('find', page.find('tribune.com.pk/story/'))
print('count', len(re.findall(r'tribune\.com\.pk/story/\d+', page, flags=re.I)))
for m in re.findall(r'tribune\.com\.pk/story/\d+', page, flags=re.I)[:20]:
    print(m)