import os
import pandas as pd
import streamlit as st

HERE = os.path.dirname(__file__)
RESULTS = os.path.join(HERE, "..", "results", "results.csv")

COLUMNS = ["txn_id", "timestamp", "sender", "receiver", "amount_usd",
           "risk_score", "level", "decision", "reasons", "true_label", "source"]
DECISIONS = ["ALLOW", "STEP_UP_OTP", "HOLD_FOR_OFFICER"]
LEVELS = ["LOW", "MEDIUM", "HIGH"]

st.set_page_config(page_title="MuleNet", layout="wide")
st.title("MuleNet: transaction risk recommendations")
st.caption("Recommendations for human review. Not automated blocking.")

is_mock = not os.path.exists(RESULTS)
if is_mock:
    st.warning("MOCK DATA: results/results.csv not found yet. Placeholder rows only.")
    df = pd.DataFrame({
        "txn_id": ["T1", "T2", "T3", "T4", "T5"],
        "timestamp": ["2022-09-01 09:00", "2022-09-01 09:05", "2022-09-01 09:09",
                      "2022-09-01 09:12", "2022-09-01 09:20"],
        "sender": ["A100", "A101", "A102", "A103", "A104"],
        "receiver": ["B200", "B201", "B202", "B203", "B204"],
        "amount_usd": [120.0, 980.5, 15000.0, 42.0, 9800.0],
        "risk_score": [0.05, 0.31, 0.93, 0.12, 0.74],
        "level": ["LOW", "MEDIUM", "HIGH", "LOW", "HIGH"],
        "decision": ["ALLOW", "STEP_UP_OTP", "HOLD_FOR_OFFICER", "ALLOW", "HOLD_FOR_OFFICER"],
        "reasons": ["MOCK | MOCK | MOCK"] * 5,
        "true_label": [0, 0, 1, 0, 0],
        "source": ["MOCK"] * 5,
    })
else:
    df = pd.read_csv(RESULTS)

missing = [c for c in COLUMNS if c not in df.columns]
if missing:
    st.error("results.csv is missing columns: " + ", ".join(missing))
    st.stop()

st.caption("Source: " + ", ".join(sorted(df["source"].astype(str).unique())))

# Summary
counts = df["decision"].value_counts()
cols = st.columns(3)
for col, label in zip(cols, DECISIONS):
    col.metric(label, int(counts.get(label, 0)))

# Filters
left, right = st.columns(2)
dec_choice = left.multiselect("Decision", DECISIONS, default=DECISIONS)
lvl_choice = right.multiselect("Risk level", LEVELS, default=LEVELS)
view = df[df["decision"].isin(dec_choice) & df["level"].isin(lvl_choice)]
view = view.sort_values("risk_score", ascending=False)

st.subheader("Transactions")
# true_label is not known at decision time, so it is not shown in the main table
st.dataframe(view.drop(columns=["true_label"]), width="stretch")

# Inspect one transaction
st.subheader("Why was this flagged?")
if len(view) == 0:
    st.info("No transactions match the filters.")
else:
    txn = st.selectbox("Inspect a transaction", view["txn_id"])
    row = view[view["txn_id"] == txn].iloc[0]
    a, b, c = st.columns(3)
    a.metric("Risk score", f"{row['risk_score']:.2f}")
    b.metric("Level", row["level"])
    c.metric("Recommendation", row["decision"])
    st.write(f"{row['sender']} to {row['receiver']}, USD {row['amount_usd']:,.2f}, {row['timestamp']}")
    for reason in str(row["reasons"]).split(" | "):
        st.write("- " + reason)

# Evaluation (uses ground truth, not available at decision time)
with st.expander("Evaluation (uses true_label, offline only)"):
    if is_mock:
        st.caption("MOCK numbers: meaningless until real results arrive.")
    pred = df["level"] == "HIGH"
    actual = df["true_label"] == 1
    tp = int((pred & actual).sum())
    precision = tp / int(pred.sum()) if pred.sum() else 0.0
    recall = tp / int(actual.sum()) if actual.sum() else 0.0
    e1, e2 = st.columns(2)
    e1.metric("Precision at HIGH", f"{precision:.2%}")
    e2.metric("Recall at HIGH", f"{recall:.2%}")