import time
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
import xgboost as xgb

from mulenet.data import SPLITS, load_transactions, trans_path, trim_and_split
from mulenet.features import FEATURES, build_features, fit_usd_rates
from mulenet import model

def main():
    data_dir = "data/raw"
    print("Loading HI-Small dataset...")
    df, split = trim_and_split(load_transactions(trans_path(data_dir, "HI-Small")))
    rates = fit_usd_rates(df[split == "train"])
    
    print(f"Building base tabular features for {len(df):,} rows...")
    # Pass None for gnn_embeddings so it fills them with zeros
    X_full = build_features(df, rates, gnn_embeddings=None)
    
    # Drop GNN features to create a pure Tabular baseline for the Anomaly model
    tabular_cols = [c for c in FEATURES if "_gnn_" not in c]
    X_tab = X_full[tabular_cols].copy()
    
    idx = {name: (split == name).to_numpy() for name in SPLITS}
    y = df["is_laundering"].to_numpy()
    
    # 1. Train Isolation Forest
    print("\n[1/2] Training Isolation Forest on train data...")
    t0 = time.time()
    # We use max_samples=100,000 for speed, which is standard for Isolation Forests on massive data
    iso = IsolationForest(n_estimators=100, max_samples=100000, random_state=42, n_jobs=-1)
    
    # Fit on training data only to prevent time-leakage
    iso.fit(X_tab[idx["train"]].values)
    
    # Generate anomaly scores (negated so higher = more anomalous)
    print("Scoring all transactions with Isolation Forest...")
    anomaly_scores = -iso.decision_function(X_tab.values)
    
    # Add anomaly score as a new feature
    X_tab["anomaly_score"] = anomaly_scores.astype(np.float32)
    print(f"Isolation Forest completed in {time.time() - t0:.1f} seconds.")
    
    # 2. Train XGBoost Backbone
    print("\n[2/2] Training Hybrid XGBoost (Tabular + Anomaly Score)...")
    dtrain = xgb.DMatrix(X_tab[idx["train"]], label=y[idx["train"]])
    dval = xgb.DMatrix(X_tab[idx["val"]], label=y[idx["val"]])
    dtest = xgb.DMatrix(X_tab[idx["test"]], label=y[idx["test"]])
    
    booster = xgb.train(
        model.PARAMS, dtrain, model.NUM_ROUNDS, evals=[(dval, "val")],
        early_stopping_rounds=model.EARLY_STOPPING, verbose_eval=100
    )
    booster = booster[: booster.best_iteration + 1]
    
    # 3. Evaluate and Compare
    print("\n=============================================")
    print("        ANOMALY HYBRID RESULTS               ")
    print("=============================================")
    
    val_p = booster.predict(dval)
    test_p = booster.predict(dtest)
    
    threshold = model.best_f1_threshold(y[idx["val"]], val_p)
    
    val_metrics = model.classification_metrics(y[idx["val"]], val_p, threshold)
    test_metrics = model.classification_metrics(y[idx["test"]], test_p, threshold)
    
    print(f"Validation PR-AUC: {val_metrics['pr_auc']:.4f}")
    print(f"Validation F1:     {val_metrics['f1']:.4f}")
    print(f"Test PR-AUC:       {test_metrics['pr_auc']:.4f}  <-- Compare this to GNN!")
    print(f"Test F1:           {test_metrics['f1']:.4f}  <-- Compare this to GNN!")
    
    print("\nTop 5 Features by Gain (Did the anomaly score help?):")
    gains = booster.get_score(importance_type="total_gain")
    sorted_gains = sorted(gains.items(), key=lambda kv: -kv[1])
    for k, v in sorted_gains[:5]:
        print(f"  {k}: {v:.1f}")

if __name__ == "__main__":
    main()
