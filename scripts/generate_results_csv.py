import pandas as pd
import numpy as np
from pathlib import Path

def generate_results():
    check_path = "data/check/HI-Small_check.csv.gz"
    print("Reading check set...")
    df = pd.read_csv(check_path)
    print(f"Total rows in check set: {len(df):,}")

    threshold = 0.0155847
    alerts_mask = df["expected_score"] >= threshold
    positives_mask = df["is_laundering"] == 1
    critical_mask = alerts_mask | positives_mask

    df_crit = df[critical_mask]
    df_normal = df[~critical_mask].sample(n=min(8500, len(df) - len(df_crit)), random_state=42)
    sampled = pd.concat([df_crit, df_normal]).sort_values("timestamp").reset_index(drop=True)

    laun_cnt = int(sampled["is_laundering"].sum())
    alert_cnt = int((sampled["expected_score"] >= threshold).sum())
    print(f"Sampled {len(sampled):,} rows ({laun_cnt} laundering, {alert_cnt} alerts)")

    levels = []
    decisions = []
    reasons_list = []

    for idx, row in sampled.iterrows():
        score = row["expected_score"]
        p = str(row["pattern"]) if pd.notna(row["pattern"]) and str(row["pattern"]) != "" else ""
        r_parts = []
        
        if score >= 0.05:
            levels.append("HIGH")
            decisions.append("HOLD_FOR_OFFICER")
        elif score >= threshold:
            levels.append("MEDIUM")
            decisions.append("STEP_UP_OTP")
        else:
            levels.append("LOW")
            decisions.append("ALLOW")
            
        if p and p != "nan":
            r_parts.append(f"Graph Topology: {p}")
        fan_ratio = row.get("src_fan_ratio_7d", 0)
        if fan_ratio > 1.5:
            r_parts.append(f"High 7d sender counterparty fan ratio ({fan_ratio:.1f}x)")
        if row.get("sub_ctr_structuring", 0) > 0:
            r_parts.append("Sub-CTR structuring evasion window ($7,500-$10,000)")
        if row.get("src_usd_acceleration_6h_24h", 0) > 0.5:
            r_parts.append("Sudden 6h velocity acceleration surge")
        if row.get("src_dormancy_spurt", 0) > 0:
            r_parts.append("Sudden dormancy reactivation spurt")
        if row.get("payment_format", 0) in (1, 2, 3):
            r_parts.append("High-risk payment format")
        if not r_parts:
            r_parts.append("Normal historical flow pattern")
            
        reasons_list.append(" | ".join(r_parts[:3]))

    results_df = pd.DataFrame({
        "txn_id": sampled["txn_id"],
        "timestamp": sampled["timestamp"],
        "sender": sampled["from_account"],
        "receiver": sampled["to_account"],
        "amount_usd": sampled["usd_paid"],
        "risk_score": sampled["expected_score"].round(4),
        "level": levels,
        "decision": decisions,
        "reasons": reasons_list,
        "true_label": sampled["is_laundering"],
        "source": "HI-Small Test Stream"
    })

    out_dir = Path("results")
    out_dir.mkdir(exist_ok=True)
    out_file = out_dir / "results.csv"
    results_df.to_csv(out_file, index=False)
    print(f"Saved {out_file}: {len(results_df):,} rows. File size: {out_file.stat().st_size / 1024:.1f} KB")

if __name__ == "__main__":
    generate_results()
