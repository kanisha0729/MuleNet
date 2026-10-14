"""Transaction + account-graph features.

Every feature of a transaction at minute t uses only that transaction's own fields
and transactions in the window [t - W, t), i.e. strictly earlier minutes. Labels are
never used, so features are identical at training and scoring time.
"""

import numpy as np
import pandas as pd

WINDOWS = {"6h": 6 * 60, "24h": 24 * 60, "7d": 7 * 24 * 60}  # minutes
MAX_WINDOW = max(WINDOWS.values())

PAYMENT_FORMATS = ["ACH", "Bitcoin", "Cash", "Cheque", "Credit Card", "Reinvestment", "Wire"]
CURRENCIES = [
    "Australian Dollar", "Bitcoin", "Brazil Real", "Canadian Dollar", "Euro", "Mexican Peso",
    "Ruble", "Rupee", "Saudi Riyal", "Shekel", "Swiss Franc", "UK Pound", "US Dollar", "Yen", "Yuan",
]

TXN_FEATURES = [
    "log_usd_paid", "log_usd_received", "usd_ratio", "currency_mismatch",
    "payment_format", "payment_currency", "receiving_currency",
    "hour", "weekday", "self_transfer", "same_bank", "whole_amount",
]
# (prefix, which account, which direction of that account's flow)
FLOWS = [
    ("src_out", "src", "out"),  # sender's earlier payments
    ("src_in", "src", "in"),    # money that reached the sender earlier (layering)
    ("dst_in", "dst", "in"),    # receiver's earlier receipts (fan-in)
    ("dst_out", "dst", "out"),  # receiver's earlier payments
]
FLOW_FEATURES = [
    f"{prefix}_{stat}_{w}"
    for prefix, _, _ in FLOWS
    for w in WINDOWS
    for stat in ("cnt", "usd", "uniq")
] + [f"{prefix}_mins_since_prev" for prefix, _, _ in FLOWS]
PAIR_FEATURES = [f"pair_cnt_{w}" for w in WINDOWS]
GNN_DIM = 16
GNN_FEATURES = [f"src_gnn_{i}" for i in range(GNN_DIM)] + [f"dst_gnn_{i}" for i in range(GNN_DIM)]
FEATURES = TXN_FEATURES + FLOW_FEATURES + PAIR_FEATURES + GNN_FEATURES

_KEY_SPAN = np.int64(2**32)  # > any minute offset we will see; keeps key*span+t in int64


def fit_usd_rates(df: pd.DataFrame) -> dict[str, float]:
    """USD value of one unit of each currency, implied by cross-currency rows with a USD side."""
    rates = {"US Dollar": 1.0}
    to_usd = df[(df["receiving_currency"] == "US Dollar") & (df["payment_currency"] != "US Dollar")]
    from_usd = df[(df["payment_currency"] == "US Dollar") & (df["receiving_currency"] != "US Dollar")]
    implied = pd.concat([
        pd.DataFrame({"cur": to_usd["payment_currency"],
                      "rate": to_usd["amount_received"] / to_usd["amount_paid"]}),
        pd.DataFrame({"cur": from_usd["receiving_currency"],
                      "rate": from_usd["amount_paid"] / from_usd["amount_received"]}),
    ])
    implied = implied[np.isfinite(implied["rate"]) & (implied["rate"] > 0)]
    rates.update(implied.groupby("cur")["rate"].median().astype(float).to_dict())
    return rates


def account_keys(df: pd.DataFrame) -> tuple[pd.Series, pd.Series]:
    """Account ids are only unique together with their bank."""
    return df["from_bank"] + "_" + df["from_account"], df["to_bank"] + "_" + df["to_account"]


def _window_stats(ev_key, ev_t, ev_vals, q_key, q_t):
    """For each query (key, t): stats over events with the same key and time in [t - W, t).

    ev_vals maps a name to a per-event value to sum. Returns {f"{name}_{w}": sums,
    f"cnt_{w}": counts, "mins_since_prev": minutes to the latest earlier event,
    capped at MAX_WINDOW}.
    """
    order = np.lexsort((ev_t, ev_key))
    combined = ev_key[order] * _KEY_SPAN + ev_t[order]
    sorted_t = ev_t[order]
    q = q_key * _KEY_SPAN + q_t
    hi = np.searchsorted(combined, q, side="left")
    cums = {name: np.concatenate([[0.0], np.cumsum(v[order], dtype=np.float64)])
            for name, v in ev_vals.items()}

    out = {}
    for w, minutes in WINDOWS.items():
        lo = np.searchsorted(combined, q - minutes, side="left")
        out[f"cnt_{w}"] = hi - lo
        for name, cum in cums.items():
            out[f"{name}_{w}"] = cum[hi] - cum[lo]

    prev = np.maximum(hi - 1, 0)
    has_prev = (hi > 0) & (combined[prev] // _KEY_SPAN == q_key)
    since = np.where(has_prev, q_t - sorted_t[prev], MAX_WINDOW)
    out["mins_since_prev"] = np.minimum(since, MAX_WINDOW)
    return out


def _new_counterparty_flags(acct, other, t) -> np.ndarray:
    """1 where this (acct, other) pair had no occurrence in the MAX_WINDOW before t.

    Summing these flags over a window approximates the number of distinct
    counterparties; it depends only on the past, so it is reproducible.
    """
    pair = acct * _KEY_SPAN + other
    order = np.lexsort((t, pair))
    p, ts = pair[order], t[order]
    prev_same = np.r_[False, p[1:] == p[:-1]]
    gap = np.r_[MAX_WINDOW + 1, ts[1:] - ts[:-1]]
    new_sorted = ~prev_same | (gap > MAX_WINDOW)
    flags = np.empty(len(t), dtype=np.float64)
    flags[order] = new_sorted
    return flags


def build_features(df: pd.DataFrame, usd_rates: dict[str, float], gnn_embeddings: dict[str, np.ndarray] = None) -> pd.DataFrame:
    """One float32 feature row per transaction, aligned with df's index."""
    src, dst = account_keys(df)
    codes, _ = pd.factorize(pd.concat([src, dst], ignore_index=True))
    n = len(df)
    src_c, dst_c = codes[:n].astype(np.int64), codes[n:].astype(np.int64)
    t0 = pd.Timestamp("2022-01-01")
    t = ((df["timestamp"] - t0) // pd.Timedelta(minutes=1)).to_numpy(np.int64)

    paid_rate = df["payment_currency"].map(usd_rates).astype("float64").to_numpy()
    recv_rate = df["receiving_currency"].map(usd_rates).astype("float64").to_numpy()
    usd_paid = df["amount_paid"].to_numpy() * paid_rate
    usd_recv = df["amount_received"].to_numpy() * recv_rate

    f = {
        "log_usd_paid": np.log1p(usd_paid),
        "log_usd_received": np.log1p(usd_recv),
        "usd_ratio": usd_recv / np.where(usd_paid > 0, usd_paid, np.nan),
        "currency_mismatch": (df["payment_currency"] != df["receiving_currency"]).to_numpy(),
        "payment_format": _codes(df["payment_format"], PAYMENT_FORMATS),
        "payment_currency": _codes(df["payment_currency"], CURRENCIES),
        "receiving_currency": _codes(df["receiving_currency"], CURRENCIES),
        "hour": df["timestamp"].dt.hour.to_numpy(),
        "weekday": df["timestamp"].dt.weekday.to_numpy(),
        "self_transfer": src_c == dst_c,
        "same_bank": (df["from_bank"] == df["to_bank"]).to_numpy(),
        "whole_amount": (df["amount_paid"] == df["amount_paid"].round()).to_numpy(),
    }

    usd = np.nan_to_num(usd_paid)
    events = {
        "out": (src_c, {"usd": usd, "uniq": _new_counterparty_flags(src_c, dst_c, t)}),
        "in": (dst_c, {"usd": usd, "uniq": _new_counterparty_flags(dst_c, src_c, t)}),
    }
    query = {"src": src_c, "dst": dst_c}
    for prefix, who, direction in FLOWS:
        ev_key, ev_vals = events[direction]
        stats = _window_stats(ev_key, t, ev_vals, query[who], t)
        for name, values in stats.items():
            f[f"{prefix}_{name}"] = values

    pair = pd.factorize(src_c * _KEY_SPAN + dst_c)[0].astype(np.int64)
    pair_stats = _window_stats(pair, t, {}, pair, t)
    for w in WINDOWS:
        f[f"pair_cnt_{w}"] = pair_stats[f"cnt_{w}"]

    # --- Add GNN Embeddings ---
    if gnn_embeddings is not None:
        def get_embs(keys):
            emb_list = [gnn_embeddings.get(k, np.zeros(GNN_DIM, dtype=np.float32)) for k in keys]
            return np.vstack(emb_list).astype(np.float32)

        src_emb = get_embs(src)
        dst_emb = get_embs(dst)
    else:
        src_emb = np.zeros((n, GNN_DIM), dtype=np.float32)
        dst_emb = np.zeros((n, GNN_DIM), dtype=np.float32)

    for i in range(GNN_DIM):
        f[f"src_gnn_{i}"] = src_emb[:, i]
        f[f"dst_gnn_{i}"] = dst_emb[:, i]

    out = pd.DataFrame({name: np.asarray(f[name], dtype=np.float32) for name in FEATURES}, index=df.index)
    return out


def _codes(values: pd.Series, vocab: list[str]) -> np.ndarray:
    """Fixed vocabulary codes; unseen values become -1."""
    return values.map({v: i for i, v in enumerate(vocab)}).fillna(-1).to_numpy()
