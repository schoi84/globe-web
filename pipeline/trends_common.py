"""Rate-limit handling shared by the Google Trends scripts."""

from __future__ import annotations

import sys
import time
from typing import Callable, TypeVar

from pytrends.exceptions import TooManyRequestsError

T = TypeVar("T")


def with_backoff(call: Callable[[], T], tries: int = 6, first_wait: float = 60) -> T:
    """Retry a Trends call on 429s, waiting 60s, 120s, 240s... Google's limit resets slowly."""
    wait = first_wait
    for attempt in range(tries):
        try:
            return call()
        except TooManyRequestsError:
            if attempt == tries - 1:
                raise
            print(f"  rate limited, waiting {wait:.0f}s", file=sys.stderr)
            time.sleep(wait)
            wait *= 2
    raise RuntimeError("unreachable")
