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

SCORE_NAMES = ["State", "Opposition", "Reform", "Security", "Civil liberties"]

THEME_KEYWORDS = {
    "State": ["state", "government", "policy", "federal", "province", "china", "diplomacy", "economy", "budget"],
    "Opposition": ["opposition", "pti", "pml", "ppp", "election", "parliament", "party", "political"],
    "Reform": ["reform", "tax", "education", "health", "governance", "water", "energy", "schools", "courts", "system"],
    "Security": ["security", "terror", "border", "iran", "afghan", "gaza", "war", "climate", "maritime", "police"],
    "Civil liberties": ["rights", "liberty", "justice", "women", "children", "minority", "freedom", "speech", "dissent"],
}

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

SOURCES = [
    {
        "name": "Dawn",
        "urls": lambda target_date: [
            "https://www.dawn.com/newspaper/column",
            "https://www.dawn.com/newspaper/editorial",
        ],
        "allow": re.compile(r"dawn\.com/news/\d+", re.I),
        "assume_url_date": False,
    },
    {
        "name": "The Express Tribune",
        "urls": lambda target_date: [f"https://tribune.com.pk/listing/opinion/{target_date}"],
        "allow": re.compile(r"tribune\.com\.pk/story/\d+", re.I),
        "assume_url_date": True,
    },
]


def clean_text(value):
    value = html.unescape(value or "")
    value = re.sub(r"<script[\s\S]*?</script>", " ", value, flags=re.I)
    value = re.sub(r"<style[\s\S]*?</style>", " ", value, flags=re.I)
    value = re.sub(r"<[^>]+>", " ", value)
    value = re.sub(r"\s+", " ", value)
    value = re.sub(r"\s+([,.;:])", r"\1", value)
    return value.strip()


def sanitize_article_text(value):
    value = clean_text(value)
    value = re.sub(r"^#{1,6}\s*", "", value)
    value = re.sub(r"^#{1,6}", "", value)
    value = re.sub(r"\s+#{1,6}\s+", " ", value)
    value = re.sub(r"\s+#{1,6}", " ", value)
    return value.strip()


def normalize_title(value):
    value = sanitize_article_text(value)
    value = re.sub(r"\s*\|\s*The Express Tribune$", "", value, flags=re.I)
    value = re.sub(r"\s*-\s*DAWN\.COM$", "", value, flags=re.I)
    value = re.sub(r"\s*\|\s*The News.*$", "", value, flags=re.I)
    return value.strip()


def is_noisy_text(value):
    value = sanitize_article_text(value)
    if not value:
        return True
    return bool(
        re.search(
            r"^(URL Source|Markdown Content|Title):|EPAPER|LIVE TV|DAWNNEWS|https?://|\[.+\]\(https?://",
            value,
            re.I,
        )
    )


def fetch_url(url, timeout=12):
    errors = []
    for candidate in (url, f"https://r.jina.ai/{url}"):
        try:
            request = Request(candidate, headers={"User-Agent": USER_AGENT, "Accept": "text/html,*/*"})
            with urlopen(request, timeout=timeout) as response:
                return response.read().decode(response.headers.get_content_charset() or "utf-8", "replace")
        except Exception as exc:
            errors.append(f"{candidate}: {exc}")
    raise RuntimeError("; ".join(errors))


def date_iso_from_text(text):
    text = clean_text(text)

    patterns = [
        r"\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})\b",
        r"\b(\d{1,2})\s+([A-Za-z]{3,9}),?\s+(\d{4})\b",
        r"\b([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})\b",
    ]

    for index, pattern in enumerate(patterns):
        match = re.search(pattern, text, re.I)
        if not match:
            continue

        if index == 0:
            month_name, day, year = match.group(1), match.group(2), match.group(3)
        elif index == 1:
            day, month_name, year = match.group(1), match.group(2), match.group(3)
        else:
            month_name, day, year = match.group(1), match.group(2), match.group(3)

        month = MONTHS.get(month_name.lower())
        if month:
            return f"{year}-{month}-{int(day):02d}"

    match = re.search(r"\b(\d{4})-(\d{2})-(\d{2})\b", text)
    return match.group(0) if match else ""


def format_display_date(date_iso):
    return datetime.strptime(date_iso, "%Y-%m-%d").strftime("%d %B %Y")


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
            title = sanitize_article_text(" ".join(self._text))
            url = urljoin(self.base_url, self._href)
            self.links.append({"title": title, "url": url})
            self._href = None
            self._text = []


def looks_like_title(title):
    title = sanitize_article_text(title)
    if len(title) < 8 or len(title) > 170:
        return False
    if re.search(r"https?:|www\.|subscribe|read more|latest|home|videos|sports|business|world", title, re.I):
        return False
    if re.search(r"front page|epaper|logo|image|news updates|top stories|today's paper", title, re.I):
        return False
    if re.search(r"^(opinion|editorial|analysis|pakistan|advertise|careers|national|magazine)$", title, re.I):
        return False
    return True


def extract_html_links(page, base_url, allow_pattern):
    parser = LinkParser(base_url)
    parser.feed(page)
    links = []
    seen = set()

    for link in parser.links:
        if not looks_like_title(link["title"]):
            continue
        if not allow_pattern.search(link["url"]):
            continue
        key = (link["title"], link["url"])
        if key in seen:
            continue
        seen.add(key)
        links.append(link)
        if len(links) >= 18:
            break
    return links


def extract_markdown_links(page, base_url, allow_pattern):
    links = []
    seen = set()
    for match in re.finditer(r"(?is)\[(?P<text>[^\]]{3,180})\]\((?P<href>https?://[^)\s]+)\)", page):
        title = sanitize_article_text(match.group("text"))
        url = urljoin(base_url, match.group("href"))
        if not looks_like_title(title):
            continue
        if not allow_pattern.search(url):
            continue
        key = (title, url)
        if key in seen:
            continue
        seen.add(key)
        links.append({"title": title, "url": url})
        if len(links) >= 18:
            break
    return links


def extract_raw_links(page, base_url, allow_pattern):
    links = []
    seen = set()
    for match in re.finditer(
        r"(?is)<a[^>]+href=[\"'](?P<href>[^\"']+)[\"'][^>]*>(?P<text>[^<]{3,180})</a>",
        page,
    ):
        title = sanitize_article_text(match.group("text"))
        url = urljoin(base_url, match.group("href"))
        if not looks_like_title(title):
            continue
        if not allow_pattern.search(url):
            continue
        key = (title, url)
        if key in seen:
            continue
        seen.add(key)
        links.append({"title": title, "url": url})
        if len(links) >= 18:
            break
    return links


def extract_listing_links(page, base_url, allow_pattern):
    if page.lstrip().startswith("<"):
        links = extract_html_links(page, base_url, allow_pattern)
        if not links:
            links = extract_raw_links(page, base_url, allow_pattern)
        return links
    return extract_markdown_links(page, base_url, allow_pattern)


def extract_meta(page, names):
    for name in names:
        escaped = re.escape(name)
        patterns = [
            rf'<meta\b(?=[^>]*(?:name|property)=["\']{escaped}["\'])(?=[^>]*content="(?P<content>[^"]*)")[^>]*>',
            rf"<meta\b(?=[^>]*(?:name|property)=[\"']{escaped}[\"'])(?=[^>]*content='(?P<content>[^']*)')[^>]*>",
        ]
        for pattern in patterns:
            match = re.search(pattern, page, re.I | re.S)
            if match:
                value = sanitize_article_text(match.group("content"))
                if value and not is_noisy_text(value):
                    return value
    return ""


def first_reader_body_line(page, title):
    for line in page.splitlines():
        text = sanitize_article_text(line)
        if len(text) < 60:
            continue
        if is_noisy_text(text):
            continue
        if title and title.lower() in text.lower() and len(text) < len(title) + 30:
            continue
        return text
    return ""


def extract_article(link, target_date, assume_url_date):
    page = fetch_url(link["url"])

    title = extract_meta(page, ["og:title", "twitter:title"])
    if not title:
        match = re.search(r"<h1[^>]*>(?P<title>[\s\S]*?)</h1>", page, re.I)
        if match:
            title = sanitize_article_text(match.group("title"))
        else:
            match = re.search(r"(?im)^Title:\s*(?P<title>.+)$", page)
            title = sanitize_article_text(match.group("title")) if match else link["title"]
    title = normalize_title(title)

    author = extract_meta(page, ["author", "article:author"])
    if not author:
        match = re.search(r'class=["\']category-source["\'][^>]*>(?P<author>[\s\S]*?)</div>', page, re.I)
        if match:
            author = sanitize_article_text(match.group("author"))
    if not author:
        match = re.search(r"\bBy\s+([A-Z][A-Za-z.' -]{2,70})\b", clean_text(page))
        author = match.group(1).strip() if match else "Editorial"
    author = re.sub(r"\s+Published\s+.*$", "", author, flags=re.I).strip() or "Editorial"

    article_date = date_iso_from_text(page)
    if assume_url_date:
        article_date = target_date
    elif not article_date:
        match = re.search(r"'publish_date'\s*:\s*'(?P<date>[^']+)'", page, re.I)
        if match:
            article_date = date_iso_from_text(match.group("date"))
    if article_date != target_date:
        return None

    teaser = extract_meta(page, ["og:description", "description", "twitter:description"])
    if not teaser:
        paragraphs = re.findall(r"<p[^>]*>([\s\S]*?)</p>", page, re.I)
        for paragraph in paragraphs:
            text = sanitize_article_text(paragraph)
            if len(text) > 45 and not is_noisy_text(text):
                teaser = text
                break
    if not teaser:
        teaser = first_reader_body_line(page, title)

    return make_item(title, author, teaser, link["url"], article_date)


def classify_theme(text):
    haystack = text.lower()
    best_theme = "State"
    best_hits = -1
    for theme, words in THEME_KEYWORDS.items():
        hits = sum(1 for word in words if word in haystack)
        if hits > best_hits:
            best_hits = hits
            best_theme = theme
    return best_theme


def theme_prefix(theme):
    return {
        "State": "casts state capacity as the central question;",
        "Opposition": "reads the political contest through opposition pressure;",
        "Reform": "frames reform as the main test;",
        "Security": "treats the issue as a security and stability risk;",
        "Civil liberties": "places rights and civic protections at the centre;",
    }.get(theme, "frames the argument as a national governance concern;")


def make_item(title, author, teaser, url, date_iso):
    clean_title = normalize_title(title)
    clean_teaser = sanitize_article_text(teaser)
    if is_noisy_text(clean_teaser):
        clean_teaser = ""
    theme = classify_theme(f"{clean_title} {clean_teaser}")
    if len(clean_teaser) > 24:
        summary = f"{theme_prefix(theme)} {clean_teaser[:230]}."
    else:
        summary = f"{theme_prefix(theme)} tracks the argument around {clean_title.lower()} and places it inside Pakistan's daily policy debate."
    tone = "positive" if theme == "State" or re.search(r"china|reform|resilience", summary, re.I) else "critical"
    return {
        "title": clean_title,
        "author": sanitize_article_text(author) or "Editorial",
        "theme": theme,
        "tone": tone,
        "summary": sanitize_article_text(summary),
        "url": url,
        "dateIso": date_iso,
    }


def score_section(items):
    scores = {name: 2.5 for name in SCORE_NAMES}
    for item in items:
        scores[item["theme"]] = min(5, scores[item["theme"]] + 0.55)
        text = f"{item['title']} {item['summary']}".lower()
        for name, words in THEME_KEYWORDS.items():
            for word in words:
                if word in text:
                    scores[name] = min(5, scores[name] + 0.12)
    return {name: round(scores[name] * 2) / 2 for name in SCORE_NAMES}


def empty_scores():
    return {name: 0 for name in SCORE_NAMES}


def unavailable_section(source, message):
    return {
        "source": source,
        "status": "blocked",
        "error": message,
        "scores": empty_scores(),
        "items": [],
    }


def scrape_source(source, target_date):
    try:
        items = []
        seen = set()
        for listing_url in source["urls"](target_date):
            page = fetch_url(listing_url)
            links = extract_listing_links(page, listing_url, source["allow"])
            attempted = 0
            for link in links:
                if attempted >= 14 or len(items) >= 7:
                    break
                attempted += 1
                if link["url"] in seen:
                    continue
                seen.add(link["url"])
                try:
                    item = extract_article(link, target_date, source["assume_url_date"])
                except Exception as exc:
                    print(f"article failed {link['url']}: {exc}", file=sys.stderr)
                    continue
                if item:
                    items.append(item)
            if len(items) >= 7:
                break

        if not items:
            raise RuntimeError(f"No matching articles found for {format_display_date(target_date)}")

        return {
            "source": source["name"],
            "status": "scraped",
            "scores": score_section(items),
            "items": items[:7],
        }
    except Exception as exc:
        return unavailable_section(source["name"], str(exc))


def estimate_read_time(sections):
    words = 0
    for section in sections:
        for item in section["items"]:
            words += len(f"{item['title']} {item['author']} {item['summary']}".split())
    return f"Approx reading time: {max(2, -(-words // 220))} minutes"


def build_report(target_date):
    sections = [scrape_source(source, target_date) for source in SOURCES]
    return {
        "date": format_display_date(target_date),
        "readTime": estimate_read_time(sections),
        "fetchWindow": f"Date filter: only {format_display_date(target_date)} articles/op-eds",
        "fetchedAt": f"Scraped: {datetime.now().strftime('%d %B %Y, %H:%M')}",
        "sections": sections,
    }


def main():
    parser = argparse.ArgumentParser(description="Scrape Pakistan print media opinion/editorial articles by date.")
    parser.add_argument("--date", default=date.today().isoformat(), help="Target date in YYYY-MM-DD format.")
    args = parser.parse_args()
    datetime.strptime(args.date, "%Y-%m-%d")
    print(json.dumps(build_report(args.date), ensure_ascii=False))


if __name__ == "__main__":
    main()
