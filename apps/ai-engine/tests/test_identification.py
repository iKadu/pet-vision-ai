from core.identification import TrackIdentificationManager


def test_track_is_not_requested_again_before_the_interval():
    manager = TrackIdentificationManager(min_interval_seconds=3, max_idle_seconds=30)

    assert manager.is_due(7, timestamp=10)
    manager.mark_requested(7, timestamp=10)

    assert not manager.is_due(7, timestamp=12.9)
    assert manager.is_due(7, timestamp=13)


def test_matches_are_attached_to_their_track_detection():
    manager = TrackIdentificationManager()
    manager.apply_matches(
        [
            {
                "track_id": 7,
                "match": {
                    "petId": "pet-1",
                    "petName": "Thor",
                    "similarity": 0.92,
                },
            },
            {"track_id": 9, "match": None},
        ],
        timestamp=10,
    )

    detections = manager.enrich_detections(
        [{"track_id": 7}, {"track_id": 9}, {"track_id": 11}],
        timestamp=11,
    )

    assert detections[0]["identification"] == {
        "status": "identified",
        "pet_id": "pet-1",
        "pet_name": "Thor",
        "similarity": 0.92,
        "updated_at": 10,
    }
    assert detections[1]["identification"] == {"status": "unknown", "updated_at": 10}
    assert "identification" not in detections[2]


def test_only_a_new_pet_association_creates_an_identification_event():
    manager = TrackIdentificationManager()
    thor_match = {"petId": "pet-1", "petName": "Thor", "similarity": 0.92}

    first_events = manager.apply_matches([{"track_id": 7, "match": thor_match}], timestamp=10)
    repeated_events = manager.apply_matches([{"track_id": 7, "match": thor_match}], timestamp=13)
    unknown_events = manager.apply_matches([{"track_id": 7, "match": None}], timestamp=16)

    assert first_events == [{"track_id": 7, "match": thor_match}]
    assert repeated_events == []
    assert unknown_events == []
