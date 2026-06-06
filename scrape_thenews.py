import argparse
import html
import json
import re
import sys
from datetime import date, datetime
from html.parser import HTMLParser
from urllib.parse import urljoin
from urllib.request import Request, urlopen


USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
)

LISTING_URLS = [
    "https://www.thenews.com.pk/latest/category/opinion",
    "https://www.thenews.com.pk/print/category/opinion",
    "https://www.thenews.com.pk/print/category/editorial",
]

MONTHS = {
    "jan": "01",
    "january": "01",
    "feb": "02",
    "february": "02",
    "mar": "03",
    "march": "03",
    "apr": "04",
    "april": "04",
    "may": "05",
    "jun": "06",
    "june": "06",
    "jul": "07",
    "july": "07",
    "aug": "08",
    "august": "08",
    "sep": "09",
    "sept": "09",
    "september": "09",
    "oct": "10",
    "october": "10",
    "nov": "11",
    "november": "11",
    "dec": "12",
    "december": "12",
}


def clean_text(value):
    value = html.unescape(value or "")
    value = re.sub(r"<script[\s\S]*?</script>", " ", value, flags=re.I)
    value = re.sub(r"<style[\s\S]*?</style>", " ", value, flags=re.I)
    value = re.sub(r"<[^>]+>", " ", value)
    value = re.sub(r"\s+", " ", value)
    value = re.sub(r"\s+([,.;:])", r"\1", value)
    return value.strip()


def fetch(url, timeout=18):
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,*/*"})
    with urlopen(request, timeout=timeout) as response:
        return response.read().decode(response.headers.get_content_charset() or "utf-8", "replace")


def date_iso_from_text(text):
    text = clean_text(text)

    match = re.search(r"\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})\b", text, re.I)
    if match:
        month = MONTHS.get(match.group(1).lower())
        if month:
            return f"{match.group(3)}-{month}-{int(match.group(2)):02d}"

    match = re.search(r"\b(\d{1,2})\s+([A-Za-z]{3,9}),?\s+(\d{4})\b", text, re.I)
    if match:
        month = MONTHS.get(match.group(2).lower())
        if month:
            return f"{match.group(3)}-{month}-{int(match.group(1)):02d}"

    match = re.search(r"\b([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})\b", text, re.I)
    if match:
        month = MONTHS.get(match.group(1).lower())
        if month:
            return f"{match.group(3)}-{month}-{int(match.group(2)):02d}"

    match = re.search(r"\b(\d{4})-(\d{2})-(\d{2})\b", text)
    return match.group(0) if match else ""


class LinkParser(HTMLParser):
    def __init__(self, base_url):
        super().__init__()
        self.base_url = base_url
        self.links = []
        self._href = None
        self._text = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() == "a":
            attrs = dict(attrs)
            self._href = attrs.get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            title = clean_text(" ".join(self._text))
            url = urljoin(self.base_url, self._href)
            self.links.append({"title": title, "url": url})
            self._href = None
            self._text = []


def extract_meta(html_text, names):
    for name in names:
        escaped = re.escape(name)
        patterns = [
            rf'<meta\b(?=[^>]*(?:name|property)=["\']{escaped}["\'])(?=[^>]*content="(?P<content>[^"]*)")[^>]*>',
            rf"<meta\b(?=[^>]*(?:name|property)=[\"']{escaped}[\"'])(?=[^>]*content='(?P<content>[^']*)')[^>]*>",
        ]
        for pattern in patterns:
            match = re.search(pattern, html_text, re.I | re.S)
            if match:
                value = clean_text(match.group("content"))
                if value:
                    return value
    return ""


def looks_like_article_link(link):
    title = clean_text(link["title"])
    url = link["url"]
    if len(title) < 8 or len(title) > 160:
        return False
    if not re.search(r"thenews\.com\.pk/(print|latest)/\d+-", url, re.I):
        return False
    if re.search(r"top-story|sports|business|national|world|entertainment", url, re.I):
        return False
    if re.search(r"home|latest|video|photo|subscribe|epaper", title, re.I):
        return False
    return True


def extract_listing_links(url):
    page = fetch(url)
    parser = LinkParser(url)
    parser.feed(page)
    seen = set()
    links = []
    for link in parser.links:
        if not looks_like_article_link(link):
            continue
        key = (link["title"], link["url"])
        if key in seen:
            continue
        seen.add(key)
        links.append(link)
    return links


def extract_article(link):
    page = fetch(link["url"])
    title = extract_meta(page, ["og:title", "twitter:title"])
    if not title:
        match = re.search(r"<h1[^>]*>(?P<title>[\s\S]*?)</h1>", page, re.I)
        title = clean_text(match.group("title")) if match else link["title"]
    title = re.sub(r"\s*\|\s*The News.*$", "", title).strip()

    author = extract_meta(page, ["author", "article:author"])
    if not author:
        match = re.search(r"\bBy\s+([A-Z][A-Za-z.' -]{2,60})\b", clean_text(page))
        author = match.group(1).strip() if match else "Editorial"
    author = re.sub(r"\s+Published\s+.*$", "", author, flags=re.I).strip()

    article_date = date_iso_from_text(page)
    summary = extract_meta(page, ["og:description", "description", "twitter:description"])
    if not summary:
        paragraphs = re.findall(r"<p[^>]*>([\s\S]*?)</p>", page, re.I)
        for paragraph in paragraphs:
            text = clean_text(paragraph)
            if len(text) > 45:
                summary = text
                break

    return {
        "title": title,
        "author": author,
        "dateIso": article_date,
        "summary": summary,
        "url": link["url"],
    }


def scrape_thenews(target_date, debug=False, latest=False):
    candidates = []
    for listing_url in LISTING_URLS:
        try:
            links = extract_listing_links(listing_url)
            if debug:
                print(f"{listing_url}: {len(links)} candidate links", file=sys.stderr)
                for link in links[:12]:
                    print(f"  - {link['title']} -> {link['url']}", file=sys.stderr)
            candidates.extend(links)
        except Exception as exc:
            print(f"listing failed: {listing_url}: {exc}", file=sys.stderr)

    seen_urls = set()
    articles = []
    for link in candidates[:35]:
        if link["url"] in seen_urls:
            continue
        seen_urls.add(link["url"])
        try:
            article = extract_article(link)
        except Exception as exc:
            print(f"article failed: {link['url']}: {exc}", file=sys.stderr)
            continue
        if debug:
            print(f"article date {article['dateIso'] or 'unknown'}: {article['title']} -> {article['url']}", file=sys.stderr)
        if latest or article["dateIso"] == target_date:
            articles.append(article)
        if latest and len(articles) >= 12:
            break

    return articles


def main():
    parser = argparse.ArgumentParser(description="Scrape The News International opinion/editorial articles by date.")
    parser.add_argument("--date", default=date.today().isoformat(), help="Target date in YYYY-MM-DD format.")
    parser.add_argument("--debug", action="store_true", help="Print listing candidates and parsed article dates to stderr.")
    parser.add_argument("--latest", action="store_true", help="Return latest scraped opinion rows regardless of date.")
    args = parser.parse_args()

    datetime.strptime(args.date, "%Y-%m-%d")
    articles = scrape_thenews(args.date, debug=args.debug, latest=args.latest)
    print(json.dumps({"source": "The News International", "date": args.date, "count": len(articles), "items": articles}, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
