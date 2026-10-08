import unittest

from youtube import score


def item(title, channel):
    return {"snippet": {"title": title, "channelTitle": channel}}


class ScoreTest(unittest.TestCase):
    def test_netflix_channel_beats_other_uploaders(self):
        official = item("Fauda | Official Trailer", "Netflix")
        reupload = item("Fauda Season 4 Official Trailer", "CHROMA Music")
        self.assertGreater(score(official, "tv", "Fauda"), score(reupload, "tv", "Fauda"))

    def test_fan_and_parody_videos_are_rejected(self):
        self.assertLess(score(item("The Rip trailer (concept)", "Movie Predictor"), "movies", "The Rip"), 0)
        self.assertLess(score(item("The Rip | Trailer", "Notflix"), "movies", "The Rip"), 0)

    def test_game_own_channel_preferred(self):
        own = item("Clash of Clans: New Update Trailer", "Clash of Clans")
        fan = item("Clash of Clans official game trailer", "MAXY")
        self.assertGreater(score(own, "games", "Clash of Clans"), score(fan, "games", "Clash of Clans"))


if __name__ == "__main__":
    unittest.main()
