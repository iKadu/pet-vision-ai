from core.presence import PresenceMonitor


def test_emits_a_single_absence_transition_per_absence_cycle():
    monitor = PresenceMonitor(absence_alert_seconds=10, notification_cooldown_seconds=60)

    assert monitor.mark_seen(0) is not None
    assert monitor.evaluate_absence(9) is None

    transition = monitor.evaluate_absence(10)

    assert transition is not None
    assert transition.event_type == "pet_left"
    assert transition.absent_duration_seconds == 10
    assert transition.should_notify is True
    assert monitor.evaluate_absence(20) is None


def test_presence_restarts_the_absence_cycle():
    monitor = PresenceMonitor(absence_alert_seconds=5, notification_cooldown_seconds=0)

    monitor.mark_seen(0)
    assert monitor.evaluate_absence(5) is not None

    detected = monitor.mark_seen(6)
    left_again = monitor.evaluate_absence(11)

    assert detected is not None
    assert detected.event_type == "pet_detected"
    assert left_again is not None
    assert left_again.should_notify is True


def test_cooldown_suppresses_the_notification_but_not_the_absence_event():
    monitor = PresenceMonitor(absence_alert_seconds=5, notification_cooldown_seconds=60)

    monitor.mark_seen(0)
    assert monitor.evaluate_absence(5).should_notify is True

    monitor.mark_seen(10)
    transition = monitor.evaluate_absence(15)

    assert transition is not None
    assert transition.event_type == "pet_left"
    assert transition.should_notify is False
