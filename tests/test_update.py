import datetime as dt
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('update', Path(__file__).resolve().parents[1] / 'scripts/update.py')
u = importlib.util.module_from_spec(spec)
spec.loader.exec_module(u)
NOW = dt.datetime(2026, 10, 21, 2, tzinfo=dt.timezone.utc)
ATOM = b'''<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Release</title><link href="https://example.com/release?utm_source=feed#body"/><published>2026-10-20T23:30:00Z</published><summary>&lt;b&gt;Fixes&lt;/b&gt;</summary></entry></feed>'''
FEEDS = [('https://example.com/feed', 'news', 'Official')]

class UpdateTests(unittest.TestCase):
    def test_timezone_and_dedup(self):
        result, _, count = u.collect({'items':[]}, FEEDS, lambda _: ATOM, NOW)
        self.assertEqual(count, 1)
        self.assertEqual(result['items'][0]['date'], '2026-10-21')
        self.assertEqual(result['items'][0]['url'], 'https://example.com/release')
        self.assertEqual(result['items'][0]['summary'], 'Fixes')
        self.assertNotIn('value', result['items'][0])
        again, _, count = u.collect(result, FEEDS, lambda _: ATOM, NOW)
        self.assertEqual(count, 0)
        self.assertEqual(again, result)

    def test_history_over_250_is_never_truncated(self):
        original = {'items':[{'id':f'old-{n}', 'url':f'https://example.com/old/{n}', 'custom':'preserve'} for n in range(300)]}
        result, _, count = u.collect(original, FEEDS, lambda _: ATOM, NOW)
        self.assertEqual(len(result['items']), 301)
        self.assertEqual(result['items'][:300], original['items'])
        self.assertEqual(len(original['items']), 300)

    def test_all_failed_preserves_input_and_raises(self):
        original = {'items':[{'id':'old', 'url':'https://example.com/old'}]}
        before = json.dumps(original)
        with self.assertRaises(RuntimeError):
            u.collect(original, FEEDS, lambda _: b'not XML', NOW)
        self.assertEqual(json.dumps(original), before)

    def test_partial_failure_is_reported(self):
        result, statuses, _ = u.collect({'items':[]}, FEEDS + [('https://bad.example/feed','news','Bad')], lambda url: ATOM if url == FEEDS[0][0] else b'bad', NOW)
        self.assertEqual(len(result['items']), 1)
        self.assertFalse(statuses[1]['ok'])

    def test_undated_and_future_items_are_skipped(self):
        for date in [b'', b'<published>2027-01-01T00:00:00Z</published>', b'<published>2026-10-20T23:30:00</published>']:
            xml = ATOM.replace(b'<published>2026-10-20T23:30:00Z</published>', date)
            result, _, count = u.collect({'items':[]}, FEEDS, lambda _: xml, NOW)
            self.assertEqual(count, 0)

    def test_rss_and_atomic_write(self):
        rss = b'<rss><channel><item><title>RSS</title><link>https://example.com/rss</link><pubDate>Tue, 20 Oct 2026 23:30:00 GMT</pubDate></item></channel></rss>'
        self.assertEqual(u.parse_feed(rss)[0]['published'].hour, 23)
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'news.json'
            path.write_text('{"items": []}')
            u.atomic_write(path, {'items':[{'id':'test'}]})
            self.assertEqual(json.loads(path.read_text())['items'][0]['id'], 'test')
            self.assertEqual(len(list(Path(folder).iterdir())), 1)

if __name__ == '__main__':
    unittest.main()
