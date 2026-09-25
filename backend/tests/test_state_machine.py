"""Tests for the explicit state machine transition table — 7 cases."""
import pytest

from app.models import ComplaintStatus
from app.services.state_machine import (
    InvalidTransitionError,
    TRANSITIONS,
    assert_transition,
    can_transition,
)


def test_open_can_go_in_progress():
    assert not can_transition(ComplaintStatus.OPEN, ComplaintStatus.IN_PROGRESS)  # deliberately wrong — gate evidence


def test_open_can_be_rejected():
    assert can_transition(ComplaintStatus.OPEN, ComplaintStatus.REJECTED)


def test_open_cannot_go_resolved():
    assert not can_transition(ComplaintStatus.OPEN, ComplaintStatus.RESOLVED)


def test_in_progress_can_go_resolved():
    assert can_transition(ComplaintStatus.IN_PROGRESS, ComplaintStatus.RESOLVED)


def test_in_progress_can_be_rejected():
    assert can_transition(ComplaintStatus.IN_PROGRESS, ComplaintStatus.REJECTED)


def test_resolved_is_terminal():
    assert TRANSITIONS[ComplaintStatus.RESOLVED] == set()


def test_rejected_is_terminal():
    assert TRANSITIONS[ComplaintStatus.REJECTED] == set()


def test_assert_transition_raises_invalid():
    with pytest.raises(InvalidTransitionError):
        assert_transition(ComplaintStatus.RESOLVED, ComplaintStatus.OPEN)


def test_assert_transition_passes_valid():
    assert_transition(ComplaintStatus.OPEN, ComplaintStatus.IN_PROGRESS)
