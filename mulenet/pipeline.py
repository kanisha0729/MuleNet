"""The three CLI steps: train, export-check, score."""

import datetime as dt
from pathlib import Path

import numpy as np
import pandas as pd

from . import model
from .data import (
    PATTERN_TYPES,
    SPLITS,
    accounts_path,
    load_accounts_metadata,
    load_transactions,
    parse_patterns_file,
    patterns_path,
    trans_path,
    trim_and_split,
)
from .features import FEATURES, account_keys, build_features, fit_usd_rates

ID_COLUMNS = ["txn_id", "timestamp", "from_account", "to_account", "usd_paid", "is_laundering"]
TOLERANCE = 1e-5  # max |score difference| allowed between the training machine and the scorer


def _prepare(data_dir, prefix, usd_rates=None, gnn_embeddings=None, log=print):
    """Load, trim, split and featurize one dataset. Fits USD rates on train days if not given."""
    log(f"loading {prefix}")
    df, split = trim_and_split(load_transactions(trans_path(data_dir, prefix)))
    if usd_rates is None:
        usd_rates = fit_usd_rates(df[split == "train"])
    acct_meta = load_accounts_metadata(accounts_path(data_dir, prefix))
    if acct_meta:
        log(f"loaded entity metadata for {len(acct_meta):,} accounts from {prefix}_Accounts.csv")
    log(f"building features for {len(df):,} rows")
    X = build_features(df, usd_rates, gnn_embeddings, accounts_metadata=acct_meta)
    return df, split, X, usd_rates


def train(data_dir, artifacts_dir, log=print) -> dict:
    log("loading HI-Small")
    df, split = trim_and_split(load_transactions(trans_path(data_dir, "HI-Small")))
    rates = fit_usd_rates(df[split == "train"])
    
    from .gnn import train_gnn
    gnn_embeddings = train_gnn(df[split == "train"])

    acct_meta = load_accounts_metadata(accounts_path(data_dir, "HI-Small"))
    if acct_meta:
        log(f"loaded entity metadata for {len(acct_meta):,} accounts")
    
    log(f"building features for {len(df):,} rows")
    X = build_features(df, rates, gnn_embeddings, accounts_metadata=acct_meta)
    
    y = df["is_laundering"].to_numpy()
    idx = {name: (split == name).to_numpy() for name in SPLITS}
    for name, mask in idx.items():
        log(f"{name}: {mask.sum():,} rows, {y[mask].sum():,} laundering")

    booster = model.train(X[idx["train"]], y[idx["train"]], X[idx["val"]], y[idx["val"]], log=log)
    predict = lambda m: booster.predict(_dmatrix(X[m]))  # noqa: E731

    threshold = model.best_fbeta_threshold(y[idx["val"]], predict(idx["val"]), beta=2.0)
    src, dst = account_keys(df)
    metrics = {}
    for name in ("val", "test"):
        m = idx[name]
        p = predict(m)
        acc = model.account_scores(src[m], dst[m], y[m], p)
        metrics[f"HI-Small/{name}"] = {
            "transactions": model.classification_metrics(y[m], p, threshold),
            "accounts": model.account_metrics(acc),
        }

    # Evaluate laundering pattern breakdown on test split if patterns file exists
    pat_map = parse_patterns_file(patterns_path(data_dir, "HI-Small"))
    patterns_summary = {}
    if pat_map:
        test_m = idx["test"]
        test_df = df[test_m].reset_index(drop=True)
        test_y = y[test_m]
        test_p = predict(test_m)
        test_patterns = []
        for row in test_df.itertuples():
            if row.is_laundering:
                key = (row.timestamp, str(row.from_bank), str(row.from_account), str(row.to_bank), str(row.to_account), round(float(row.amount_paid), 2))
                test_patterns.append(pat_map.get(key, "UNPATTERNED"))
            else:
                test_patterns.append("")
        test_patterns = np.array(test_patterns)
        laun_mask = test_y == 1
        for p_type in list(PATTERN_TYPES) + ["UNPATTERNED"]:
            sub_mask = laun_mask & (test_patterns == p_type)
            tot = int(sub_mask.sum())
            if tot > 0:
                det = int((test_p[sub_mask] >= threshold).sum())
                patterns_summary[p_type] = {
                    "total": tot,
                    "detected": det,
                    "recall": float(round(det / tot, 4)),
                }
        log(f"evaluated pattern recall across {len(patterns_summary)} pattern topologies")

    if trans_path(data_dir, "LI-Small").is_file():
        li, li_split, li_X, _ = _prepare(data_dir, "LI-Small", usd_rates=rates, gnn_embeddings=gnn_embeddings, log=log)
        m = (li_split == "test").to_numpy()
        li_y = li["is_laundering"].to_numpy()[m]
        p = booster.predict(_dmatrix(li_X[m]))
        li_src, li_dst = account_keys(li[m])
        metrics["LI-Small/test"] = {
            "transactions": model.classification_metrics(li_y, p, threshold),
            "accounts": model.account_metrics(model.account_scores(li_src, li_dst, li_y, p)),
        }

    meta = {
        "created": dt.datetime.now().isoformat(timespec="seconds"),
        "trained_on": "HI-Small",
        "splits": SPLITS,
        "features": FEATURES,
        "usd_rates": rates,
        "threshold": threshold,
        "params": model.PARAMS,
        "trees": booster.num_boosted_rounds(),
        "metrics": metrics,
        "pattern_recall": patterns_summary,
        "feature_importance_gain": dict(sorted(
            booster.get_score(importance_type="total_gain").items(), key=lambda kv: -kv[1],
        )),
    }
    model.save_artifacts(artifacts_dir, booster, meta, gnn_embeddings=gnn_embeddings)
    log(f"saved artifacts to {artifacts_dir}")
    return meta


def export_check(data_dir, artifacts_dir, out_path, prefix="HI-Small", log=print) -> Path:
    """Write the test window with ids, features, label and this machine's score."""
    meta = model.load_meta(artifacts_dir)
    gnn_embeddings = model.load_gnn_embeddings(artifacts_dir)
    df, split, X, _ = _prepare(data_dir, prefix, usd_rates=meta["usd_rates"], gnn_embeddings=gnn_embeddings, log=log)
    m = (split == "test").to_numpy()
    df, X = df[m].reset_index(drop=True), X[m].reset_index(drop=True)
    src, dst = account_keys(df)
    paid_rate = df["payment_currency"].map(meta["usd_rates"]).astype("float64")

    # Map laundering patterns if patterns file is present
    pat_map = parse_patterns_file(patterns_path(data_dir, prefix))
    pat_col = []
    for row in df.itertuples():
        if row.is_laundering:
            key = (row.timestamp, str(row.from_bank), str(row.from_account), str(row.to_bank), str(row.to_account), round(float(row.amount_paid), 2))
            pat_col.append(pat_map.get(key, "UNPATTERNED") if pat_map else "UNPATTERNED")
        else:
            pat_col.append("")

    check = pd.DataFrame({
        "txn_id": df["txn_id"],
        "timestamp": df["timestamp"].dt.strftime("%Y-%m-%d %H:%M"),
        "from_account": src,
        "to_account": dst,
        "usd_paid": (df["amount_paid"] * paid_rate).round(2),
        "is_laundering": df["is_laundering"],
        "pattern": pat_col,
    })
    check["expected_score"] = model.load_predictor(artifacts_dir, "xgboost")(X.to_numpy())
    check = pd.concat([check, X], axis=1)

    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    # %.9g round-trips float32 exactly, so the scorer sees bit-identical features.
    check.to_csv(out, index=False, float_format="%.9g")
    log(f"wrote {len(check):,} rows ({check['is_laundering'].sum():,} laundering) to {out}")
    return out


def score(check_path, artifacts_dir, report_path, backend="xgboost", log=print) -> dict:
    """Score a check set, verify parity with the stored scores, and write the HTML report."""
    import platform
    import time
    from .report import write_report

    meta = model.load_meta(artifacts_dir)
    if meta["features"] != FEATURES:
        raise SystemExit("feature list in artifacts/meta.json differs from this code version")

    arch = platform.machine()
    system = platform.system()
    log(f"scoring on architecture: {arch} ({system}) with backend {backend}")

    log(f"loading check set {check_path}")
    check = pd.read_csv(check_path, dtype={"from_account": str, "to_account": str, "pattern": str})
    X = check[FEATURES].to_numpy(dtype=np.float32)
    predictor = model.load_predictor(artifacts_dir, backend)
    p = predictor(X)

    # Benchmark latency on individual transactions
    sample_n = min(500, len(X))
    if sample_n > 0:
        _ = predictor(X[:1])  # warmup
        times_ms = []
        for i in range(sample_n):
            t0 = time.perf_counter()
            _ = predictor(X[i:i+1])
            times_ms.append((time.perf_counter() - t0) * 1000.0)
        p50 = float(np.percentile(times_ms, 50))
        p95 = float(np.percentile(times_ms, 95))
        p99 = float(np.percentile(times_ms, 99))
        log(f"inference latency per transaction: p50={p50:.3f} ms, p95={p95:.3f} ms, p99={p99:.3f} ms")
    else:
        p50, p95, p99 = 0.0, 0.0, 0.0

    max_diff = float(np.max(np.abs(p - check["expected_score"].to_numpy()))) if len(p) else 0.0
    y = check["is_laundering"].to_numpy()
    acc = model.account_scores(check["from_account"], check["to_account"], y, p)

    # Pattern recall summary
    patterns_summary = {}
    if "pattern" in check.columns:
        threshold = meta["threshold"]
        laun_mask = y == 1
        for p_type in list(PATTERN_TYPES) + ["UNPATTERNED"]:
            sub_mask = laun_mask & (check["pattern"] == p_type)
            tot = int(sub_mask.sum())
            if tot > 0:
                det = int((p[sub_mask] >= threshold).sum())
                patterns_summary[p_type] = {
                    "total": tot,
                    "detected": det,
                    "recall": float(round(det / tot, 4)),
                }
    elif "pattern_recall" in meta:
        patterns_summary = meta.get("pattern_recall", {})

    result = {
        "check_set": str(check_path),
        "backend": backend,
        "machine": arch,
        "latency_ms": {"p50": p50, "p95": p95, "p99": p99},
        "parity_max_abs_diff": max_diff,
        "parity_ok": max_diff <= TOLERANCE,
        "threshold": meta["threshold"],
        "transactions": model.classification_metrics(y, p, meta["threshold"]),
        "accounts": model.account_metrics(acc),
        "patterns": patterns_summary,
    }
    pr = model.pr_curve(y, p)
    scored_check = check.copy()
    scored_check["score"] = p
    write_report(report_path, result, meta, pr, acc, scored_check)
    acc.head(1000).to_csv(Path(report_path).with_name("alerts.csv"))
    log(f"wrote {report_path}")
    return result


def _dmatrix(X):
    import xgboost as xgb

    return xgb.DMatrix(X, feature_names=FEATURES)
