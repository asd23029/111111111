#!/usr/bin/env python3
"""Collect publicly indexed Taichung birthday-restaurant mentions, without bypassing robots/auth.

Output: data/social_signals.json and data/source_status.json
Sources: Dcard, Threads, Facebook public pages, and Instagram public posts.

Discovery uses Bing's public RSS search index. For indexed hits, optionally check the
original public page ONLY when robots.txt explicitly permits it. Private/logged-in
content is NEVER requested with spoofed sessions, proxies or scraped credentials.
All records are *mentions*, never fabricated ratings, likes, or endorsements.
"""
from __future__ import annotations
import argparse
import datetime as dt
import email.utils
import html
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
USER_AGENT = "TaichungBirthdayDiscoveryBot/1.0 (public index; no authentication)"
DOMAINS = {
    "Dcard": ("dcard.tw",),
    "Threads": ("threads.net", "threads.com"),
    "Facebook": ("facebook.com",),
    "Instagram": ("instagram.com",),
}
KEYWORDS = [
    '"台中" "慶生" "餐廳" "推薦"',
    '"台中" "生日" "牛排" "餐廳"',
    '"台中" "生日" "燒肉" "推薦"',
    '"台中" "慶生" "餐酒館"',
]
SEED = [
    ("Dcard", "https://www.dcard.tw/f/food/p/258493755", "台中慶生餐廳（內有選手）", ["gulu-dining"]),
    ("Dcard", "https://www.dcard.tw/f/food/p/255337771", "台中餐酒館推薦 GULU dining", ["gulu-dining"]),
    ("Dcard", "https://www.dcard.tw/f/food/p/255943899", "台中慶生餐廳（內有選手）", ["meatgq"]),
    ("Dcard", "https://www.dcard.tw/f/food/p/255981012", "台中慶生餐廳求推薦", ["laffection"]),
    ("Dcard", "https://www.dcard.tw/f/food/p/237862078", "問 台中慶生餐廳", ["umai-zhonggang", "chaliu-gongyi", "laffection"]),
]
ALIASES = {
    "umai-zhonggang": ["屋馬燒肉", "屋馬"],
    "chaliu-gongyi": ["茶六燒肉", "茶六"],
    "orange-taichung": ["橘色涮涮屋"],
    "meatgq": ["MEATGQ", "MEAT GQ", "橡木炙烤牛排館"],
    "fore": ["FORE柴燒", "FORE 柴燒", "FORE STEAK"],
    "laffection": ["法森小館", "L'affection"],
    "jingcheng-yishan": ["精誠壹山", "精誠一山"],
    "gulu-dining": ["GULU Dining", "GULU餐酒館", "GULU dining"],
    "minsuizenraku": ["明水然樂", "明水然・樂", "明水然·樂"],
}
ROBOTS: dict[str, bool] = {}

def fetch(url: str, *, maxbytes: int = 600_000, timeout: int = 12) -> bytes:
    req = urllib.request.Request(url, headers={
        "User-Agent": USER_AGENT,
        "Accept": "application/rss+xml,application/xml,text/xml,text/html;q=0.8,*/*;q=0.2",
    })
    with urllib.request.urlopen(req, timeout=timeout) as response:
        if response.status != 200:
            raise ValueError(f"HTTP {response.status}")
        return response.read(maxbytes + 1)[:maxbytes]

def robots_allowed(url: str) -> bool:
    parsed = urllib.parse.urlparse(url)
    host = parsed.hostname or ""
    if host not in ROBOTS:
        try:
            rp = urllib.robotparser.RobotFileParser()
            rp.set_url(f"{parsed.scheme}://{host}/robots.txt")
            rp.read()
            ROBOTS[host] = bool(rp.can_fetch(USER_AGENT, url))
        except Exception:
            ROBOTS[host] = False  # fail closed
    return ROBOTS[host]

class PageMeta(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = ""
        self.description = ""
        self.og_title = ""
        self._in_title = False
    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if tag == "title":
            self._in_title = True
        if tag == "meta":
            key = d.get("property") or d.get("name") or ""
            if key == "og:description" or (key == "description" and not self.description):
                self.description = d.get("content", "")[:500]
            if key == "og:title":
                self.og_title = d.get("content", "")[:160]
    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False
    def handle_data(self, data):
        if self._in_title:
            self.title += data[:200]

def page_metadata(url: str) -> dict:
    # Disallow any direct request prohibited by robots or requiring authentication.
    if not robots_allowed(url):
        return {}
    try:
        p = PageMeta()
        p.feed(fetch(url).decode("utf-8", errors="replace"))
        return {"title": html.unescape(p.og_title or p.title).strip()[:150],
                "description": html.unescape(p.description).strip()[:300]}
    except Exception:
        return {}

def restaurant_ids(text: str) -> list[str]:
    low = re.sub(r"\s+", "", html.unescape(text).lower())
    found = []
    for key, names in ALIASES.items():
        if any(re.sub(r"\s+", "", s.lower()) in low for s in names):
            found.append(key)
    return found

def domain_ok(url: str, platform: str) -> bool:
    host = (urllib.parse.urlparse(url).hostname or "").lower()
    return any(host == d or host.endswith("." + d) for d in DOMAINS[platform])

def discovery(platform: str):
    for keyword in KEYWORDS:
        for domain in DOMAINS[platform]:
            query = f"site:{domain} {keyword}"
            url = "https://www.bing.com/search?format=rss&q=" + urllib.parse.quote(query)
            try:
                root = ET.fromstring(fetch(url))
                items = root.findall("./channel/item")
            except Exception as exc:
                yield {"error": type(exc).__name__, "platform": platform}
                continue
            for item in items[:15]:
                target = (item.findtext("link") or "").strip()
                title = html.unescape(item.findtext("title") or "").strip()
                desc = html.unescape(re.sub(r"<[^>]+>", " ", item.findtext("description") or "")).strip()
                if not domain_ok(target, platform):
                    continue
                ids = restaurant_ids(title + " " + desc)
                if not ids:
                    # Do not assume a matching restaurant from generic keywords.
                    continue
                yield {"platform": platform, "url": target, "title": title[:150],
                       "restaurants": ids, "note": "公開搜尋索引提及餐廳；立場與評價未驗證",
                       "origin": "public_index", "lastChecked": dt.date.today().isoformat()}
            time.sleep(1.1)  # polite rate-limiting

def read_previous():
    path = DATA / "social_signals.json"
    if path.exists():
        try:
            rows = json.loads(path.read_text(encoding="utf-8"))
            return [r for r in rows if isinstance(r, dict) and r.get("origin") == "reviewed_index"]
        except Exception:
            pass
    return []

def run(no_network=False):
    today = dt.date.today().isoformat()
    records = {}
    for row in read_previous():
        records[row["url"]] = row
    for platform, url, title, matched in SEED:
        records.setdefault(url, {"platform": platform, "url": url, "title": title,
                                 "restaurants": matched, "note": "人工核對的公開文章；僅表示被提及",
                                 "origin": "reviewed_index", "lastChecked": today})
    status = {"checkedAt": dt.datetime.now(dt.timezone.utc).isoformat(), "mode": "public_search_index_only" if not no_network else "offline_seed_only", "platforms": {}}
    if not no_network:
        for platform in DOMAINS:
            count = errors = 0
            for hit in discovery(platform):
                if "error" in hit:
                    errors += 1
                    continue
                old = records.get(hit["url"])
                if old:
                    old["restaurants"] = sorted(set(old["restaurants"] + hit["restaurants"]))
                    continue
                # Validate page metadata only when robots permits access.
                meta = page_metadata(hit["url"])
                if meta and not restaurant_ids(meta.get("title", "") + " " + meta.get("description", "")):
                    # Search snippets can contain unrelated matches. Skip the false positive.
                    continue
                if meta.get("title"):
                    hit["title"] = meta["title"]
                records[hit["url"]] = hit
                count += 1
            status["platforms"][platform] = {
                "newIndexedMentions": count,
                "discoveryErrors": errors,
                "note": "公開文章索引；無私人貼文、留言抓取或登入繞過",
            }
    else:
        status["platforms"] = {p: {"newIndexedMentions": 0, "note": "離線測試，未進行新的公開網頁搜尋"} for p in DOMAINS}
    rows = sorted(records.values(), key=lambda r: (r.get("origin") != "reviewed_index", r["platform"], r["url"]))
    DATA.mkdir(exist_ok=True, parents=True)
    (DATA / "social_signals.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (DATA / "source_status.json").write_text(json.dumps(status, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Recorded {len(rows)} public article links; status={json.dumps(status['platforms'],ensure_ascii=False)}")
    return 0

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--offline", action="store_true", help="Check outputs without external requests")
    args = parser.parse_args()
    sys.exit(run(no_network=args.offline))
