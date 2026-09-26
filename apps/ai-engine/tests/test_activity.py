import unittest

from core.activity import ActivityClassifier


class ActivityClassifierTests(unittest.TestCase):
    def test_classifies_resting_then_active_and_emits_only_the_transition(self):
        classifier = ActivityClassifier(window_seconds=10, active_distance_threshold=0.1)

        first, first_events = classifier.update(
            [{"track_id": 4, "centroid": {"x": 0.2, "y": 0.2}}], timestamp=0
        )
        resting, resting_events = classifier.update(
            [{"track_id": 4, "centroid": {"x": 0.22, "y": 0.2}}], timestamp=2
        )
        active, active_events = classifier.update(
            [{"track_id": 4, "centroid": {"x": 0.4, "y": 0.2}}], timestamp=3
        )

        self.assertEqual(first[0]["activity"]["state"], "unknown")
        self.assertEqual(resting[0]["activity"]["state"], "resting")
        self.assertEqual(active[0]["activity"]["state"], "active")
        self.assertEqual(first_events, [])
        self.assertEqual(resting_events, [])
        self.assertEqual(active_events[0]["event_type"], "activity_changed")

    def test_forgets_a_track_after_the_idle_timeout(self):
        classifier = ActivityClassifier(max_idle_seconds=5)
        classifier.update([{"track_id": 4, "centroid": {"x": 0.2, "y": 0.2}}], timestamp=0)
        renewed, _ = classifier.update([{"track_id": 4, "centroid": {"x": 0.4, "y": 0.2}}], timestamp=6)

        self.assertEqual(renewed[0]["activity"]["state"], "unknown")


if __name__ == "__main__":
    unittest.main()
