import importlib
import scrapers.press_scraper as p

source = next(s for s in p.SOURCES if s["name"] == "The Express Tribune")
target = "2026-06-05"
url = source["urls"](target)[0]
print('listing', url)
page = p.fetch_url(url)
links = p.extract_listing_links(page, url, source["allow"])
print('links', len(links))
for link in links:
    print(link)

for link in links[:8]:
    try:
        item = p.extract_article(link, target, source["assume_url_date"])
    except Exception as exc:
        print('failed', link['url'], exc)
    else:
        print('item', item and item['title'][:160], item and item['dateIso'])
