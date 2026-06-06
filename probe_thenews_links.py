import html
import re
import sys
from urllib.parse import urljoin
from urllib.request import Request, urlopen


url = sys.argv[1] if len(sys.argv) > 1 else "https://www.thenews.com.pk/latest/category/opinion"
page = urlopen(Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=25).read().decode("utf-8", "replace")
links = re.findall(r"""<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)</a>""", page, re.I | re.S)
print("url:", url)
print("bytes:", len(page))
print("links:", len(links))
for href, label in links[:120]:
    text = html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", label))).strip()
    full = urljoin(url, href)
    if text or "thenews" in full:
        print(f"{text[:90]} => {full}")
