import unittest

from trends import rank

TOPICS = [{"mid": "a", "name": "Anchor"}, {"mid": "b", "name": "B"}, {"mid": "c", "name": "C"}, {"mid": "d", "name": "D"}]


class RankTest(unittest.TestCase):
    def test_batches_are_put_on_the_anchor_scale(self):
        # Batch 1: B is 2x the anchor. Batch 2: C is 3x, D is half. So C > B > Anchor > D.
        batches = [
            {"KR": {"a": 20, "b": 40}},
            {"KR": {"a": 10, "c": 30, "d": 5}},
        ]
        out = rank(TOPICS, batches)
        self.assertEqual([e["name"] for e in out["KR"]], ["C", "B", "Anchor", "D"])
        self.assertNotIn("detail", out["KR"][0])
        self.assertEqual(out["KR"][1]["detail"], "67% of #1's interest")

    def test_batch_ignored_where_anchor_is_zero(self):
        batches = [
            {"US": {"a": 50, "b": 25, "c": 10}},
            {"US": {"a": 0, "d": 100}},  # no common scale: D must not appear
        ]
        out = rank(TOPICS, batches)
        self.assertEqual([e["name"] for e in out["US"]], ["Anchor", "B", "C"])

    def test_sparse_country_dropped(self):
        out = rank(TOPICS, [{"TV": {"a": 100, "b": 0, "c": 0}}])
        self.assertNotIn("TV", out)


if __name__ == "__main__":
    unittest.main()
