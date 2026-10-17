"""Training, metrics, account roll-up and model artifacts.

Everything the scorer imports from here needs only numpy, pandas and one of
xgboost / onnxruntime, so it can run on LinuxONE without scikit-learn.
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd

from .features import FEATURES

PARAMS = {
    "objective": "binary:logistic",
    "eval_metric": "aucpr",
    "tree_method": "hist",
    "max_depth": 8,
    "eta": 0.05,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "min_child_weight": 5,
    "scale_pos_weight": 25,
    "seed": 0,
}
NUM_ROUNDS = 2000
EARLY_STOPPING = 100


# ---------- metrics (numpy only) ----------

def pr_curve(y, p) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Precision, recall and threshold at every distinct score, highest score first.

    Predicting positive means score >= threshold.
    """
    y = np.asarray(y, dtype=np.float64)
    p = np.asarray(p, dtype=np.float64)
    order = np.argsort(-p, kind="stable")
    p, y = p[order], y[order]
    last = np.r_[np.flatnonzero(p[1:] != p[:-1]), len(p) - 1]  # last index of each distinct score
    tp = np.cumsum(y)[last]
    fp = (last + 1) - tp
    return tp / (tp + fp), tp / max(y.sum(), 1), p[last]


def average_precision(y, p) -> float:
    """Area under the PR curve as a step sum (same definition as sklearn)."""
    precision, recall, _ = pr_curve(y, p)
    return float(np.sum(np.diff(np.r_[0.0, recall]) * precision))


def best_fbeta_threshold(y, p, beta: float = 2.0) -> float:
    """Threshold that maximizes F-beta score. beta=2.0 gives recall 2x the weight of precision."""
    precision, recall, thresholds = pr_curve(y, p)
    b2 = beta ** 2
    denom = b2 * precision + recall
    fbeta = np.where(denom > 0, (1 + b2) * precision * recall / denom, 0.0)
    return float(thresholds[np.argmax(fbeta)])


def best_f1_threshold(y, p) -> float:
    return best_fbeta_threshold(y, p, beta=1.0)


def classification_metrics(y, p, threshold: float) -> dict:
    y = np.asarray(y).astype(bool)
    pred = np.asarray(p) >= threshold
    tp = int((pred & y).sum())
    fp = int((pred & ~y).sum())
    fn = int((~pred & y).sum())
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return {
        "rows": int(len(y)), "positives": int(y.sum()), "alerts": int(pred.sum()),
        "tp": tp, "fp": fp, "fn": fn,
        "precision": precision, "recall": recall, "f1": f1,
        "pr_auc": average_precision(y, p),
    }


def account_scores(src: pd.Series, dst: pd.Series, y, p) -> pd.DataFrame:
    """Roll transaction scores up to accounts.

    score = max score over transactions the account sends or receives;
    is_mule = the account touches at least one laundering transaction.
    """
    both = pd.DataFrame({
        "account": pd.concat([src, dst], ignore_index=True),
        "score": np.r_[p, p],
        "is_laundering": np.r_[y, y].astype(bool),
    })
    acc = both.groupby("account").agg(
        score=("score", "max"), is_mule=("is_laundering", "any"), txns=("score", "size"),
    )
    return acc.sort_values("score", ascending=False, kind="stable")


def account_metrics(acc: pd.DataFrame, k: int = 100) -> dict:
    top = acc.head(k)
    return {
        "accounts": int(len(acc)),
        "mules": int(acc["is_mule"].sum()),
        "pr_auc": average_precision(acc["is_mule"], acc["score"]),
        f"precision_at_{k}": float(top["is_mule"].mean()),
    }


# ---------- training ----------

def train(X_train, y_train, X_val, y_val, log=print):
    import xgboost as xgb

    # Feature names come from the DataFrame columns (not the FEATURES constant), so this also
    # works for an ablation that trains on a subset of FEATURES.
    dtrain = xgb.DMatrix(X_train, label=y_train)
    dval = xgb.DMatrix(X_val, label=y_val)
    class Progress(xgb.callback.TrainingCallback):
        def after_iteration(self, model, epoch, evals_log):
            if epoch % 100 == 0:
                log(f"round {epoch}: val aucpr {evals_log['val']['aucpr'][-1]:.4f}")
            return False

    booster = xgb.train(
        PARAMS, dtrain, NUM_ROUNDS, evals=[(dval, "val")],
        early_stopping_rounds=EARLY_STOPPING, verbose_eval=False, callbacks=[Progress()],
    )
    log(f"best iteration {booster.best_iteration}, val aucpr {booster.best_score:.4f}")
    # Keep only the trees up to the best iteration so every backend scores identically.
    return booster[: booster.best_iteration + 1]


# ---------- artifacts ----------

def save_artifacts(out_dir, booster, meta: dict, gnn_embeddings: dict[str, np.ndarray] = None) -> None:
    import onnxmltools
    from onnxmltools.convert.common.data_types import FloatTensorType

    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    booster.save_model(out / "model.json")
    # The ONNX converter wants f0..fN feature names.
    onnx_booster = booster.copy()
    onnx_booster.feature_names = None
    onx = onnxmltools.convert_xgboost(
        onnx_booster, initial_types=[("input", FloatTensorType([None, len(FEATURES)]))], target_opset=15,
    )
    (out / "model.onnx").write_bytes(onx.SerializeToString())
    (out / "meta.json").write_text(json.dumps(meta, indent=2) + "\n")
    if gnn_embeddings is not None:
        keys = np.array(list(gnn_embeddings.keys()))
        vals = np.array(list(gnn_embeddings.values()), dtype=np.float32)
        np.savez_compressed(out / "gnn_embeddings.npz", keys=keys, values=vals)


def load_meta(artifacts_dir) -> dict:
    return json.loads((Path(artifacts_dir) / "meta.json").read_text())


def load_gnn_embeddings(artifacts_dir) -> dict[str, np.ndarray]:
    path = Path(artifacts_dir) / "gnn_embeddings.npz"
    if not path.is_file():
        return {}
    data = np.load(path)
    return dict(zip(data["keys"], data["values"]))


def load_predictor(artifacts_dir, backend: str = "xgboost"):
    """Return predict(X: float32 array [n, len(FEATURES)]) -> probability of laundering."""
    path = Path(artifacts_dir)
    if backend == "xgboost":
        import xgboost as xgb

        booster = xgb.Booster()
        booster.load_model(path / "model.json")
        return lambda X: booster.predict(xgb.DMatrix(X, feature_names=FEATURES))
    if backend == "onnx":
        import os
        import onnxruntime as ort

        so = ort.SessionOptions()
        so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        # Configurable intra-op threads for s390x Telum co-processors
        so.intra_op_num_threads = int(os.environ.get("ORT_INTRA_OP_NUM_THREADS", min(4, os.cpu_count() or 1)))
        so.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL

        session = ort.InferenceSession(str(path / "model.onnx"), sess_options=so, providers=["CPUExecutionProvider"])
        name = session.get_inputs()[0].name
        return lambda X: session.run(None, {name: np.ascontiguousarray(X, dtype=np.float32)})[1][:, 1]
    raise ValueError(f"unknown backend {backend!r} (use 'xgboost' or 'onnx')")
