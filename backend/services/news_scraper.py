import feedparser, aiohttp, asyncio

RSS_FEEDS = [
    "https://cointelegraph.com/rss",
    "https://www.coindesk.com/arc/outboundfeeds/rss/",
    "https://www.bloomberght.com/rss/borsa"
]

async def _fetch(url, session):
    async with session.get(url, timeout=30) as resp:
        return await resp.text()

async def news_search(query:str):
    async with aiohttp.ClientSession() as s:
        pages = await asyncio.gather(*[_fetch(u,s) for u in RSS_FEEDS])
    results=[]
    for page in pages:
        for e in feedparser.parse(page).entries:
            if query.lower() in e.title.lower():
                results.append({"title":e.title,"link":e.link,"published":e.published})
    return sorted(results,key=lambda x:x["published"], reverse=True)[:20]
