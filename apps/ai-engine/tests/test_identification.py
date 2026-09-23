from core.identification import TrackIdentificationManager


def test_track_is_not_requested_again_before_the_interval():
    manager = TrackIdentificationManager(min_interval_seconds=3, max_idle_seconds=30)

    assert manager.is_due(7, timestamp=10)
    manager.mark_requested(7, timestamp=10)

    assert not manager.is_due(7, timestamp=12.9)
    assert manager.is_due(7, timestamp=13)


def test_matches_are_attached_to_their_track_detection():
    manager = TrackIdentificationManager(required_confirmations=1)
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
    manager = TrackIdentificationManager(required_confirmations=1)
    thor_match = {"petId": "pet-1", "petName": "Thor", "similarity": 0.92}

    first_events = manager.apply_matches([{"track_id": 7, "match": thor_match}], timestamp=10)
    repeated_events = manager.apply_matches([{"track_id": 7, "match": thor_match}], timestamp=13)
    unknown_events = manager.apply_matches([{"track_id": 7, "match": None}], timestamp=16)

    assert first_events == [{"track_id": 7, "match": thor_match}]
    assert repeated_events == []
    assert unknown_events == []


def test_single_conflicting_match_does_not_replace_a_stable_identity():
    manager = TrackIdentificationManager(required_confirmations=2)
    thor = {"petId": "pet-1", "petName": "Thor", "similarity": 0.92}
    luna = {"petId": "pet-2", "petName": "Luna", "similarity": 0.89}

    manager.apply_matches([{"track_id": 7, "match": thor}], timestamp=10)
    manager.apply_matches([{"track_id": 7, "match": thor}], timestamp=10.5)
    manager.apply_matches([{"track_id": 7, "match": luna}], timestamp=11)
    after_one_conflict = manager.enrich_detections([{"track_id": 7}], timestamp=11)[0]

    assert after_one_conflict["identification"]["pet_name"] == "Thor"

    manager.apply_matches([{"track_id": 7, "match": luna}], timestamp=12)
    after_two_conflicts = manager.enrich_detections([{"track_id": 7}], timestamp=12)[0]

    assert after_two_conflicts["identification"]["pet_name"] == "Luna"


def test_identification_requires_two_safe_matches_before_confirmation():
    manager = TrackIdentificationManager(required_confirmations=2)
    thor = {"petId": "pet-1", "petName": "Thor", "similarity": 0.92, "margin": 0.12}

    first_events = manager.apply_matches([{"track_id": 7, "match": thor}], timestamp=10)
    first_detection = manager.enrich_detections([{"track_id": 7}], timestamp=10)[0]
    second_events = manager.apply_matches([{"track_id": 7, "match": thor}], timestamp=11)

    assert first_events == []
    assert first_detection["identification"]["status"] == "confirming"
    assert second_events == [{"track_id": 7, "match": thor}]


def test_ambiguous_candidate_is_shown_as_possible_without_an_event():
    manager = TrackIdentificationManager()
    possible = {"petId": "pet-2", "petName": "Luna", "similarity": 0.82, "margin": 0.01}

    events = manager.apply_matches([{"track_id": 7, "possible_match": possible}], timestamp=10)
    detection = manager.enrich_detections([{"track_id": 7}], timestamp=10)[0]

    assert events == []
    assert detection["identification"]["status"] == "possible"
    assert detection["identification"]["pet_name"] == "Luna"
