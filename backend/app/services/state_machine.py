from app.models import ComplaintStatus

# Explicit transition table — the only allowed moves.
TRANSITIONS: dict[ComplaintStatus, set[ComplaintStatus]] = {
    ComplaintStatus.OPEN: {ComplaintStatus.IN_PROGRESS, ComplaintStatus.REJECTED},
    ComplaintStatus.IN_PROGRESS: {ComplaintStatus.RESOLVED, ComplaintStatus.REJECTED},
    ComplaintStatus.RESOLVED: set(),
    ComplaintStatus.REJECTED: set(),
}


class InvalidTransitionError(ValueError):
    def __init__(self, current: ComplaintStatus, requested: ComplaintStatus) -> None:
        super().__init__(
            f"Cannot transition from '{current}' to '{requested}'. "
            f"Allowed: {[s.value for s in TRANSITIONS[current]]}"
        )
        self.current = current
        self.requested = requested


def can_transition(current: ComplaintStatus, next_status: ComplaintStatus) -> bool:
    return next_status in TRANSITIONS[current]


def assert_transition(current: ComplaintStatus, next_status: ComplaintStatus) -> None:
    if not can_transition(current, next_status):
        raise InvalidTransitionError(current, next_status)
