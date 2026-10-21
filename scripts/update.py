"""Optional, manual RSS/Atom import. Only source excerpts, never generated analysis.

No third-party dependencies. Existing articles are never truncated or overwritten.
"""
import argparse
import datetime as dt
import hashlib
import html
import json
import os
from pathlib import Path
import re
import sys
import tempfile
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
FEEDS = [
    ('https://github.com/openai/codex/releases.atom', 'news', 'Codex 版本更新'),
    ('https://github.com/anthropics/claude-code/releases.atom', 'news', 'Claude Code 版本更新'),
    ('https://github.com/comfyanonymous/ComfyUI/releases.atom', 'tools', 'ComfyUI 版本更新'),
    ('https://github.com/godotengine/godot/releases.atom', 'tools', 'Godot 引擎更新'),
]
SHANGHAI = ZoneInfo('Asia/Shanghai')


def canonical_url(value):
    try:
        parsed = urllib.parse.urlsplit(value)
        if parsed.scheme != 'https' or not parsed.hostname or parsed.username:
            return ''
        query = [(k, v) for k, v in urllib.parse.parse_qsl(parsed.query) if not k.lower().startswith('utm_')]
        return urllib.parse.urlunsplit(('https', parsed.netloc.lower(), parsed.path.rstrip('/'), urllib.parse.urlencode(query), ''))
    except ValueError:
        return ''


def clean(value, limit=300):
    return ' '.join(html.unescape(re.sub(r'<[^>]+>', ' ', value or '')).split())[:limit]


def parse_date(value):
    try:
        date = dt.datetime.fromisoformat(value.replace('Z', '+00:00'))
    except (ValueError, TypeError):
        try:
            date = parsedate_to_datetime(value)
        except (ValueError, TypeError):
            return None
    # A timezone-less source date is ambiguous; never guess its timezone.
    return date.astimezone(dt.timezone.utc) if date.tzinfo else None


def parse_feed(payload):
    root = ET.fromstring(payload)
    entries = []
    atom = '{http://www.w3.org/2005/Atom}'
    nodes = root.findall(f'{atom}entry') if root.tag == f'{atom}feed' else root.findall('./channel/item')
    if root.tag not in (f'{atom}feed', 'rss'):
        raise ValueError('Not an RSS/Atom document')
    for node in nodes:
        is_atom = node.tag == f'{atom}entry'
        ns = atom if is_atom else ''
        def value(name):
            element = node.find(ns + name)
            return ''.join(element.itertext()) if element is not None else ''
        if is_atom:
            links = node.findall(atom + 'link')
            link = next((x.get('href', '') for x in links if x.get('rel', 'alternate') == 'alternate'), '')
        else:
            link = value('link')
        published = value('published') if is_atom else value('pubDate')
        date_value = published or value('updated')
        entries.append({'title': clean(value('title'), 200), 'url': canonical_url(link),
                        'published': parse_date(date_value), 'dateKind': 'published' if published else 'updated',
                        'summary': clean(value('summary') or value('description') or value('content'))})
    return entries


def collect(data, feeds=FEEDS, fetcher=None, now=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    if not isinstance(data.get('items'), list):
        raise ValueError('Invalid existing dataset; refusing to overwrite it')
    # Clone before adding: callers can retry or inspect the original after a failure.
    result = json.loads(json.dumps(data))
    items = result['items']
    if any(not item.get('id') for item in items):
        raise ValueError('Existing items must have stable IDs')
    known = {canonical_url(item.get('url', '')) for item in items}
    ids = {item['id'] for item in items}
    if len(ids) != len(items):
        raise ValueError('Duplicate existing IDs')
    statuses = []
    added = 0
    for url, category, label in feeds:
        try:
            entries = parse_feed((fetcher or fetch)(url))
            statuses.append({'url': url, 'ok': True, 'entries': len(entries)})
        except Exception as error:
            statuses.append({'url': url, 'ok': False, 'error': type(error).__name__})
            continue
        for entry in entries:
            date, link = entry['published'], entry['url']
            if not link or link in known or not entry['title'] or date is None:
                continue
            if not dt.timedelta(0) <= now - date <= dt.timedelta(days=14):
                continue
            identity = 'feed-' + hashlib.sha256(link.encode()).hexdigest()[:20]
            if identity in ids:
                continue
            items.append({'id': identity, 'category': category, 'type': '版本更新', 'origin': 'feed',
                          'label': label, 'title': entry['title'], 'date': date.astimezone(SHANGHAI).date().isoformat(),
                          'publishedAt': date.isoformat(), 'dateKind': entry['dateKind'],
                          'summary': entry['summary'] or '官方发布源已更新，请阅读原始说明。',
                          'url': link, 'sources': [{'url': link, 'title': '官方发布说明'}]})
            known.add(link)
            ids.add(identity)
            added += 1
    if not any(status['ok'] for status in statuses):
        raise RuntimeError('All feeds failed; existing data is unchanged')
    if added:
        result['updated'] = now.astimezone(SHANGHAI).date().isoformat()
    result['schemaVersion'] = 2
    return result, statuses, added


def fetch(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'AI-Indie-Lab-Manual-Importer/2', 'Accept': 'application/atom+xml, application/rss+xml, application/xml'})
    with urllib.request.urlopen(request, timeout=20) as response:
        payload = response.read(2_000_001)
        if len(payload) > 2_000_000:
            raise ValueError('Feed exceeds size limit')
        return payload


def atomic_write(path, data):
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=path.parent, delete=False) as out:
            temporary = Path(out.name)
            json.dump(data, out, ensure_ascii=False, indent=2)
            out.write('\n')
            out.flush()
            os.fsync(out.fileno())
        os.replace(temporary, path)
    finally:
        if temporary and temporary.exists():
            temporary.unlink()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, default=ROOT / 'data/news.json')
    parser.add_argument('--output', type=Path, help='Write a candidate dataset here; default: update input atomically')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    data = json.loads(args.input.read_text(encoding='utf-8'))
    result, statuses, added = collect(data)
    for status in statuses:
        print(json.dumps(status, ensure_ascii=False))
    print(f'Added {added}; retained all {len(data["items"])} existing articles')
    if not args.dry_run and (added or args.output):
        atomic_write(args.output or args.input, result)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(f'Import failed: {error}', file=sys.stderr)
        sys.exit(1)
