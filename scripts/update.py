"""Ingest source-linked updates; never invent headlines, dates, or analyses."""
import datetime as dt
import html
import json
import pathlib
import re
import feedparser

ROOT = pathlib.Path(__file__).resolve().parents[1]
PATH = ROOT / "data/news.json"
FEEDS = [
    ("https://github.com/openai/codex/releases.atom", "news", "Codex 版本更新"),
    ("https://github.com/anthropics/claude-code/releases.atom", "news", "Claude Code 版本更新"),
    ("https://github.com/comfyanonymous/ComfyUI/releases.atom", "tools", "ComfyUI 版本更新"),
    ("https://github.com/godotengine/godot/releases.atom", "tools", "Godot 引擎更新"),
]
def clean(value):
    value = re.sub(r"<[^>]+>", " ", value or "")
    return " ".join(html.unescape(value).split())[:400]

data = json.loads(PATH.read_text(encoding="utf-8"))
items = data.get("items", [])
known = {i.get("url") for i in items}
now = dt.datetime.now(dt.timezone.utc)
for url, category, label in FEEDS:
    feed = feedparser.parse(url)
    if getattr(feed, "bozo", False) and not feed.entries:
        print("feed unavailable:", url)
        continue
    for entry in feed.entries[:4]:
        link = entry.get("link", "")
        if not link.startswith("https://") or link in known:
            continue
        published = entry.get("published_parsed") or entry.get("updated_parsed")
        if not published:
            continue
        date = dt.datetime(*published[:6], tzinfo=dt.timezone.utc)
        if not dt.timedelta(0) <= now - date <= dt.timedelta(days=7):
            continue
        title = clean(entry.get("title", ""))
        if not title:
            continue
        summary = clean(entry.get("summary", ""))[:190]
        items.append({
            "category": category, "label": label,
            "date": date.date().isoformat(),
            "title": title,
            "summary": summary or "官方更新已发布，点击展开查看原始来源。",
            "facts": "该条目自动收录自项目官方发布源。详情和兼容性请以原始发布说明为准。",
            "value": "建议先检查兼容性、变更记录和项目实际需求，再决定是否升级。",
            "action": "在隔离的测试项目中验证更新，确认稳定后再应用于正式开发。",
            "url": link,
        })
        known.add(link)
data["items"] = sorted(items, key=lambda x: x.get("date", ""), reverse=True)[:250]
data["updated"] = now.date().isoformat()
PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("items:", len(data["items"]))
