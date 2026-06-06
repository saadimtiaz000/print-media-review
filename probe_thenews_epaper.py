import html
import re
import sys
from urllib.parse import urljoin
from urllib.request import Request, urlopen


url = sys.argv[1] if len(sys.argv) > 1 else "https://e.thenews.com.pk/category/opinion"
page = urlopen(
    Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
            "Accept": "text/html,*/*",
        },
    ),
    timeout=25,
).read().decode("utf-8", "replace")

print("url:", url)
print("bytes:", len(page))

print("\nforms/inputs:")
for match in re.finditer(r"(?is)<(?:form|input|select)[^>]*>", page):
    print(re.sub(r"\s+", " ", match.group(0))[:240])

print("\nlinks:")
links = re.findall(r"""<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)</a>""", page, re.I | re.S)
for href, label in links[:180]:
    text = html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", label))).strip()
    full = urljoin(url, href)
    if text or "thenews" in full:
        print(f"{text[:100]} => {full}")

print("\nscripts/ajax hints:")
for match in re.finditer(r"(?i)(ajax|category|datepicker|calendar|edition|date|api|load)", page):
    start = max(0, match.start() - 140)
    end = min(len(page), match.end() + 180)
    print(re.sub(r"\s+", " ", page[start:end])[:420])
