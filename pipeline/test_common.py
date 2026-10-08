import unittest
from datetime import date

from apple_music import build_ranges
from common import aggregate

DAY1 = {"KR": [{"rank": 1, "name": "A", "detail": "x", "image": "old.jpg"}, {"rank": 2, "name": "B", "detail": "y"}]}
DAY2 = {"KR": [{"rank": 1, "name": "B", "detail": "y", "image": "b.jpg"}, {"rank": 2, "name": "A", "detail": "x"}]}
DAY3 = {"KR": [{"rank": 1, "name": "B", "detail": "y"}, {"rank": 2, "name": "C", "detail": "z"}]}


class AggregateTest(unittest.TestCase):
    def test_points_and_newest_image(self):
        out = aggregate([DAY3, DAY2, DAY1])  # newest first
        # B: 10 + 10 + 9 = 29, A: 9 + 10 = 19, C: 9
        self.assertEqual([e["name"] for e in out["KR"]], ["B", "A", "C"])
        self.assertEqual(out["KR"][0]["image"], "b.jpg")
        self.assertEqual(out["KR"][1]["image"], "old.jpg")  # every entry keeps its image
        self.assertNotIn("image", out["KR"][2])

    def test_same_name_different_detail_kept_apart(self):
        snap = {"US": [{"rank": 1, "name": "Show", "detail": "Season 1"}, {"rank": 2, "name": "Show", "detail": "Season 2"}]}
        self.assertEqual(len(aggregate([snap])["US"]), 2)


class MusicRangesTest(unittest.TestCase):
    def test_only_day_with_one_snapshot(self):
        ranges, data = build_ranges([(date(2026, 10, 8), DAY1)])
        self.assertEqual([r["id"] for r in ranges], ["day"])

    def test_week_appears_with_history(self):
        history = [(date(2026, 10, 8), DAY3), (date(2026, 10, 7), DAY2), (date(2026, 10, 6), DAY1)]
        ranges, data = build_ranges(history)
        self.assertEqual([r["id"] for r in ranges], ["day", "week"])  # month would equal week, so hidden
        self.assertIn("3 days so far", ranges[1]["note"])
        self.assertEqual(data["week"]["KR"][0]["name"], "B")


if __name__ == "__main__":
    unittest.main()
