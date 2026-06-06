import html
import re
from urllib.request import Request, urlopen


url = "https://www.thenews.pk/today"
page = urlopen(Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=25).read().decode("utf-8", "replace")
text = html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", page)))
index = text.lower().find("opinion")

print("length:", len(page))
print("opinion index:", index)
if index >= 0:
    print(text[max(0, index - 900): index + 2500])

print("\nlinks containing opinion/category:")
links = re.findall(r"""<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)</a>""", page, re.I | re.S)
for href, label in links:
    label = html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", label))).strip()
    if "opinion" in href.lower() or "opinion" in label.lower() or "print" in href.lower():
        print(f"{label} => {href}")
