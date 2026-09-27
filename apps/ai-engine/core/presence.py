from dataclasses import dataclass


@dataclass(frozen=True)
class PresenceTransition:
    event_type: str
    absent_duration_seconds: float | None = None
    should_notify: bool = False


class PresenceMonitor:
    """Controla transições de presença e evita alertas repetidos."""

    def __init__(
        self,
        absence_alert_seconds: float = 30,
        notification_cooldown_seconds: float = 300,
    ):
        self.configure(absence_alert_seconds, notification_cooldown_seconds)
        self.reset()

    def configure(
        self,
        absence_alert_seconds: float,
        notification_cooldown_seconds: float,
    ) -> None:
        self.absence_alert_seconds = float(absence_alert_seconds)
        self.notification_cooldown_seconds = float(notification_cooldown_seconds)

    def reset(self) -> None:
        self.is_present = False
        self.last_seen_at: float | None = None
        self.last_absence_notification_at: float | None = None

    def mark_seen(self, timestamp: float) -> PresenceTransition | None:
        self.last_seen_at = timestamp
        if self.is_present:
            return None
        self.is_present = True
        return PresenceTransition(event_type="pet_detected")

    def evaluate_absence(self, timestamp: float) -> PresenceTransition | None:
        if not self.is_present or self.last_seen_at is None:
            return None

        absent_duration = timestamp - self.last_seen_at
        if absent_duration < self.absence_alert_seconds:
            return None

        self.is_present = False
        should_notify = (
            self.last_absence_notification_at is None
            or timestamp - self.last_absence_notification_at
            >= self.notification_cooldown_seconds
        )
        if should_notify:
            self.last_absence_notification_at = timestamp

        return PresenceTransition(
            event_type="pet_left",
            absent_duration_seconds=absent_duration,
            should_notify=should_notify,
        )
