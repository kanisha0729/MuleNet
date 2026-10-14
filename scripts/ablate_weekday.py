"""Ablation: does the `weekday` feature help, or is it fitting the simulator's 10-day calendar?

Retrains on HI-Small with `weekday` dropped from the feature set, using the same
hyperparameters, splits and threshold rule as mulenet.pipeline.train. Does not touch
artifacts/ (the production model); writes reports/ablation_weekday.json instead.

Usage: .venv/bin/python -I scripts/ablate_weekday.py [data_dir]
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from mulenet import model  # noqa: E402
from mulenet.data import SPLITS, load_transactions, trans_path, trim_and_split  # noqa: E402
from mulenet.features import FEATURES, account_keys, build_features, fit_usd_rates  # noqa: E402

DROP = "weekday"
ABLATED_FEATURES = [f for f in FEATURES if f != DROP]


def log(msg):
    print(msg, file=sys.stderr, flush=True)


def run(data_dir) -> dict:
    log("loading HI-Small")
    df, split = trim_and_split(load_transactions(trans_path(data_dir, "HI-Small")))
    rates = fit_usd_rates(df[split == "train"])
    log(f"building features for {len(df):,} rows")
    X_full = build_features(df, rates)
    X = X_full[ABLATED_FEATURES]  # same features, weekday column removed
    y = df["is_laundering"].to_numpy()
    idx = {name: (split == name).to_numpy() for name in SPLITS}

    # Reuses mulenet.model.train (same params/early stopping as the production model);
    # it takes feature names from the DataFrame columns, so the dropped column just works.
    booster = model.train(X[idx["train"]], y[idx["train"]], X[idx["val"]], y[idx["val"]], log=log)
    log(f"trees {booster.num_boosted_rounds()}")

    import xgboost as xgb

    predict = lambda m: booster.predict(xgb.DMatrix(X[m]))  # noqa: E731
    threshold = model.best_f1_threshold(y[idx["val"]], predict(idx["val"]))
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

    return {
        "dropped_feature": DROP,
        "features": ABLATED_FEATURES,
        "trees": booster.num_boosted_rounds(),
        "threshold": threshold,
        "metrics": metrics,
        "feature_importance_gain": dict(sorted(
            booster.get_score(importance_type="total_gain").items(), key=lambda kv: -kv[1],
        )),
    }


if __name__ == "__main__":
    data_dir = sys.argv[1] if len(sys.argv) > 1 else "data/raw"
    result = run(data_dir)
    out = ROOT / "reports" / "ablation_weekday.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, indent=2) + "\n")
    log(f"wrote {out}")
    print(json.dumps(result["metrics"], indent=2))
