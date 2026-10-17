import os
import pandas as pd
import streamlit as st

HERE = os.path.dirname(__file__)
RESULTS = os.path.join(HERE, "..", "data", "results.csv")

st.set_page_config(page_title="MuleNet", layout="wide")
st.title("MuleNet: transaction risk recommendations")
st.caption("Recommendations for human review. Not automated blocking.")

if os.path.exists(RESULTS):
    df = pd.read_csv(RESULTS)
else:
    st.warning("MOCK DATA: data/results.csv not found yet. Placeholder rows only.")
    df = pd.DataFrame({
        "txn_id": ["T1", "T2", "T3"],
        "risk_score": [0.05, 0.55, 0.93],
        "decision": ["ALLOW", "REVIEW", "HOLD RECOMMENDED"],
        "reason": ["MOCK", "MOCK", "MOCK"],
        "source": ["MOCK", "MOCK", "MOCK"],
    })

counts = df["decision"].value_counts()
cols = st.columns(3)
for col, label in zip(cols, ["ALLOW", "REVIEW", "HOLD RECOMMENDED"]):
    col.metric(label, int(counts.get(label, 0)))

choice = st.multiselect("Filter by decision", df["decision"].unique(),
                        default=list(df["decision"].unique()))
st.dataframe(df[df["decision"].isin(choice)], use_container_width=True)

txn = st.selectbox("Inspect a transaction", df["txn_id"])
st.write(df[df["txn_id"] == txn].iloc[0])