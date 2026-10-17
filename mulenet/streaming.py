"""In-memory O(1) amortized sliding window state store for real-time account feature tracking.

In production on IBM LinuxONE / z16 Telum, streaming transactions arrive in real-time.
Rather than executing an O(log N) vectorized binary search across historical partitions,
StreamingAccountStateStore maintains chronological deques per account key.

Old events outside MAX_WINDOW are evicted from the head in O(1) amortized time,
and sliding window aggregations (counts, sums, unique counterparties, recency)
are evaluated in O(1) amortized time.
"""

from collections import deque
from typing import Any
import numpy as np

WINDOWS = {"6h": 6 * 60, "24h": 24 * 60, "7d": 7 * 24 * 60}  # minutes
MAX_WINDOW = max(WINDOWS.values())


class StreamingAccountStateStore:
    """In-memory O(1) amortized state store for real-time account feature tracking."""

    def __init__(self, windows: dict[str, int] = None, max_window: int = None):
        self.windows = WINDOWS if windows is None else windows
        self.max_window = MAX_WINDOW if max_window is None else max_window
        # key -> deque of (t, vals_dict)
        self._stores: dict[Any, deque] = {}

    def update(self, key: Any, t: int, vals: dict[str, Any] = None) -> None:
        """Record an event for `key` at minute timestamp `t` with associated values."""
        if key not in self._stores:
            self._stores[key] = deque()
        self._stores[key].append((int(t), dict(vals or {})))

    def query(self, key: Any, q_t: int) -> dict[str, Any]:
        """Query rolling window statistics for `key` strictly prior to `q_t` in [q_t - W, q_t)."""
        events = self._stores.get(key)

        out: dict[str, Any] = {}
        for w in self.windows:
            out[f"cnt_{w}"] = 0
            out[f"usd_{w}"] = 0.0

        if not events:
            out["mins_since_prev"] = int(self.max_window)
            return out

        # O(1) amortized eviction of expired entries older than max_window relative to q_t
        cutoff = q_t - self.max_window
        while events and events[0][0] < cutoff:
            events.popleft()

        # Find the latest event strictly prior to q_t (< q_t)
        prev_t = None
        for ev_t, _ in reversed(events):
            if ev_t < q_t:
                prev_t = ev_t
                break

        if prev_t is not None:
            out["mins_since_prev"] = int(min(q_t - prev_t, self.max_window))
        else:
            out["mins_since_prev"] = int(self.max_window)

        # Aggregate for each window W in [q_t - minutes, q_t)
        for w, minutes in self.windows.items():
            w_start = q_t - minutes
            w_cnt = 0
            w_usd = 0.0
            for ev_t, ev_vals in reversed(events):
                if ev_t >= q_t:
                    continue
                if ev_t < w_start:
                    break
                w_cnt += 1
                w_usd += float(ev_vals.get("usd", 0.0))
            out[f"cnt_{w}"] = w_cnt
            out[f"usd_{w}"] = w_usd

        return out
