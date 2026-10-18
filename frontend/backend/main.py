"""MuleNet demo API.

Serves the REAL output of the MuleNet model (results/results.csv, produced by
`python -m mulenet score`) to the React UI. There is no scoring logic in this
file: it only looks rows up and reshapes them. Nothing here is randomly
generated and no hardware numbers are invented.

Run from the repo root:
    pip install fastapi uvicorn pandas
    python -m uvicorn frontend.backend.main:app --port 8000
or from this folder:
    python -m uvicorn main:app --port 8000
"""
import asyncio
import hashlib
import json
import os
import time
from pathlib import Path
from typing import Optional

import pandas as pd
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

HERE = Path(__file__).resolve().parent


def _find(rel: str) -> Optional[Path]:
    """Find a repo file whether the app lives in <repo>/frontend/backend or elsewhere."""
    env = os.environ.get("MULENET_REPO")
    bases = ([Path(env)] if env else []) + [HERE.parent.parent, HERE.parent, HERE.parent.parent.parent]
    for b in bases:
        p = b / rel
        if p.is_file():
            return p
    return None


RESULTS_PATH = _find("results/results.csv")
META_PATH = _find("artifacts/meta.json")

app = FastAPI(title="MuleNet demo API (replay of model output)", version="3.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

if RESULTS_PATH is None:
    raise RuntimeError(
        "results/results.csv not found. Run from inside the MuleNet repo, or set MULENET_REPO=<path to repo>."
    )

DF = pd.read_csv(RESULTS_PATH, dtype={"sender": str, "receiver": str})
DF["reasons"] = DF["reasons"].fillna("")
META = json.loads(META_PATH.read_text()) if META_PATH else {}
DECISION_RANK = {"ALLOW": 0, "STEP_UP_OTP": 1, "HOLD_FOR_OFFICER": 2}
UI_DECISION = {"ALLOW": "ALLOW", "STEP_UP_OTP": "REVIEW", "HOLD_FOR_OFFICER": "BLOCK"}
SCORE_DECISION = {"ALLOW": "ALLOW", "STEP_UP_OTP": "REVIEW", "HOLD_FOR_OFFICER": "HOLD"}

DF["_rank"] = DF["decision"].map(DECISION_RANK)
# Highest-risk row per receiving account (recipient-level lookup)
_BEST = (
    DF.sort_values(["_rank", "risk_score"], ascending=False).drop_duplicates("receiver").set_index("receiver")
)
_IN = DF.groupby("receiver").agg(n_in=("txn_id", "count"), senders=("sender", "nunique"), usd_in=("amount_usd", "sum"))
_OUT = DF.groupby("sender").agg(n_out=("txn_id", "count"), receivers=("receiver", "nunique"), usd_out=("amount_usd", "sum"))

audit_log_store: list = []
decisions: dict = {}


def _reasons(row) -> list:
    return [r.strip() for r in str(row["reasons"]).split("|") if r.strip()] if row["decision"] != "ALLOW" else []


def _acct_metrics(acct: str) -> dict:
    n_senders = int(_IN.senders.get(acct, 0))
    n_recv = int(_OUT.receivers.get(acct, 0))
    usd_in = float(_IN.usd_in.get(acct, 0.0))
    usd_out = float(_OUT.usd_out.get(acct, 0.0))
    ratio = f"{min(usd_out / usd_in, 9.99) * 100:.0f}%" if usd_in > 0 and usd_out > 0 else "n/a"
    return {
        "fan_in_count": n_senders,
        "fan_out_count": n_recv,
        "time_since_deposit": "n/a (not measured in replay)",
        "outflow_inflow_ratio": ratio,
    }


def row_to_txn(row) -> dict:
    ui_dec = UI_DECISION[row["decision"]]
    reasons = _reasons(row)
    topo = next((r.split(":", 1)[1].strip() for r in reasons if r.startswith("Graph Topology")), None)
    return {
        "id": str(row["txn_id"]),
        "timestamp": str(row["timestamp"]),
        "sender": {
            "name": str(row["sender"]),
            "account": str(row["sender"]),
            "bank": "IBM AML dataset (synthetic)",
            "country": "-",
            "flag": "",
            "accountAgeDays": 0,
            "kycTier": "n/a",
        },
        "receiver": {
            "name": str(row["receiver"]),
            "account": str(row["receiver"]),
            "bank": "IBM AML dataset (synthetic)",
            "country": "-",
            "flag": "",
            "isSuspectedMule": ui_dec != "ALLOW",
            "degreeCentrality": int(_IN.senders.get(row["receiver"], 0)),
        },
        "amount": float(row["amount_usd"]),
        "currency": "USD",
        "channel": "HI-Small replay",
        # Raw model score x100 (0..100). NOT a calibrated probability.
        "muleRiskScore": round(float(row["risk_score"]) * 100, 1),
        "decision": ui_dec,
        "typology": topo or ("CLEAN" if ui_dec == "ALLOW" else "MODEL_FLAGGED"),
        "features": [],
        "ruleAlerts": reasons,
        "latencyMs": 0,
        "modelDecision": str(row["decision"]),
        "datasetLabel": int(row["true_label"]),
    }


def _telemetry() -> dict:
    counts = DF["decision"].value_counts()
    tm = ((META.get("metrics") or {}).get("HI-Small/test") or {}).get("transactions", {})
    return {
        "platform": "Replay of model output (results.csv)",
        "hostArchitecture": "n/a",
        "accelerator": "none - no accelerator used by this demo API",
        "acceleratorLoad": 0,
        "cpacfCryptoEngine": "SOFTWARE_FALLBACK",
        "throughputTps": 0,
        "avgLatencyMs": 0,
        "p95LatencyMs": 0,
        "p99LatencyMs": 0,
        "auditDbStatus": "IN_MEMORY",
        "hitlModeActive": True,
        "sourceStream": "FASTAPI_REPLAY",
        "totalTransactionsProcessed": int(len(DF)),
        "decisionCounts": {
            "allow": int(counts.get("ALLOW", 0)),
            "review": int(counts.get("STEP_UP_OTP", 0)),
            "block": int(counts.get("HOLD_FOR_OFFICER", 0)),
        },
        "totalVolumeUSD": float(DF["amount_usd"].sum()),
        "modelMetrics": {
            "testPrAuc": tm.get("pr_auc"),
            "testPrecision": tm.get("precision"),
            "testRecall": tm.get("recall"),
            "threshold": META.get("threshold"),
            "trees": META.get("trees"),
        },
    }


class DecisionRequest(BaseModel):
    txnId: str
    action: str
    notes: Optional[str] = ""


class ScoreRequest(BaseModel):
    txn_id: Optional[str] = None
    timestamp: Optional[str] = None
    sender: Optional[str] = ""
    receiver: str
    amount: Optional[float] = 0
    currency: Optional[str] = "USD"


class SarRequest(BaseModel):
    txn: dict
    notes: Optional[str] = ""


@app.post("/score")
def score_transfer(req: ScoreRequest):
    """Recipient-level lookup of the model's decision. No rules, no randomness."""
    acct = req.receiver.strip()
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ")
    base = {
        "txn_id": req.txn_id or f"TXN_{int(time.time() * 1000)}",
        "sender": req.sender,
        "receiver": req.receiver,
        "amount": req.amount,
        "currency": req.currency or "USD",
        "timestamp": now,
        "isSimulated": False,
    }
    if acct not in _BEST.index:
        return {
            **base,
            "risk_score": 0,
            "mulenet_score": 0,
            "decision": "UNSCORED",
            "status_text": "Not scored: this account is not in the replayed dataset",
            "ai_narrative": "MuleNet has no model output for this account. This demo only replays scores that the model produced for the IBM AML test stream; it does not score arbitrary accounts live.",
            "metrics": _acct_metrics(acct),
            "explanation": {
                "incoming_senders": "n/a",
                "outgoing_receivers": "n/a",
                "forwarding_speed": "n/a",
                "passthrough_amount": "n/a",
            },
            "spam_flags": [],
            "features": [],
            "engine": "none (account not in replay)",
        }
    row = _BEST.loc[acct].copy()
    row["receiver"] = acct
    row["txn_id"] = row.get("txn_id")
    decision = SCORE_DECISION[row["decision"]]
    reasons = _reasons(row)
    m = _acct_metrics(acct)
    status = {
        "ALLOW": "No alert: model score below threshold",
        "REVIEW": "Step-up verification recommended",
        "HOLD": "Hold for officer review",
    }[decision]
    narrative = (
        f"Model score {float(row['risk_score']):.4f} (replayed from results.csv). "
        + (("Signals: " + "; ".join(reasons) + ".") if reasons else "No alert signals triggered.")
    )
    return {
        **base,
        "risk_score": round(float(row["risk_score"]) * 100, 1),
        "mulenet_score": round(float(row["risk_score"]) * 100, 1),
        "model_score": float(row["risk_score"]),
        "decision": decision,
        "status_text": status,
        "ai_narrative": narrative,
        "metrics": m,
        "explanation": {
            "incoming_senders": f"{m['fan_in_count']} distinct sender(s) into this account in the replay sample",
            "outgoing_receivers": f"{m['fan_out_count']} distinct receiver(s) out of this account in the replay sample",
            "forwarding_speed": "Not measured in the replay sample",
            "passthrough_amount": m["outflow_inflow_ratio"] if m["outflow_inflow_ratio"] != "n/a" else "Not measured in the replay sample",
        },
        "spam_flags": reasons or ["No alert signals triggered"],
        "features": [{"name": r, "value": "triggered", "impact": "FLAG"} for r in reasons],
        "engine": "MuleNet model output (replay of results.csv)",
        "source_txn_id": str(row["txn_id"]),
    }


@app.get("/api/telemetry")
def get_telemetry():
    return _telemetry()


@app.get("/api/transactions")
def get_transactions(limit: int = 100):
    return [row_to_txn(r) for _, r in DF.head(limit).iterrows()]


@app.get("/api/examples")
def get_examples():
    out = {}
    for key, dec in (("safe", "ALLOW"), ("review", "STEP_UP_OTP"), ("hold", "HOLD_FOR_OFFICER")):
        r = DF[DF.decision == dec].iloc[0]
        out[key] = {"sender": r["sender"], "receiver": r["receiver"], "amount_usd": float(r["amount_usd"])}
    return out


@app.post("/api/decision")
def post_decision(req: DecisionRequest):
    h = hashlib.sha256(f"{req.txnId}{req.action}{time.time()}".encode()).hexdigest()
    decisions[req.txnId] = req.action
    audit_log_store.insert(
        0,
        {
            "id": f"AUD-{int(time.time() * 1000)}",
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "txnId": req.txnId,
            "action": f"HUMAN_{req.action}",
            "analyst": "Demo analyst",
            "notes": req.notes or f"Manual {req.action} recorded",
            "immutableHash": f"sha256:{h}",
        },
    )
    return {"status": "SUCCESS"}


@app.post("/api/sar")
def post_sar(req: SarRequest):
    txn = req.txn
    return {
        "reportId": f"DRAFT-{int(time.time()) % 1000000}",
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "fincenTrackingNo": "NOT FILED (demo draft)",
        "primarySubject": {
            "name": txn["receiver"]["name"],
            "account": txn["receiver"]["account"],
            "bank": txn["receiver"]["bank"],
            "country": txn["receiver"]["country"],
        },
        "suspiciousActivityType": f"Model-flagged: {txn.get('typology', 'n/a')}",
        "amount": txn["amount"],
        "currency": txn["currency"],
        "narrativeSummary": (
            f"DRAFT for analyst review. The MuleNet model flagged this transaction (model score x100 = {txn['muleRiskScore']}). "
            f"Analyst note: {req.notes or 'none'}. This draft is not filed with any authority."
        ),
        "muleRingEvidence": list(txn.get("ruleAlerts") or []),
        "recommendedAction": "Analyst review. Nothing is filed or frozen by this demo.",
    }


@app.get("/api/graph/{txn_id}")
def get_graph(txn_id: str):
    """One-hop neighbourhood of the transaction, taken from the replayed data."""
    hit = DF[DF.txn_id.astype(str) == txn_id]
    if hit.empty:
        return None
    row = hit.iloc[0]
    focus = row["receiver"]
    nb = DF[(DF.receiver == focus) | (DF.sender == focus)].head(12)
    nodes, links, seen = [], [], set()

    def add(acct, kind, score, flagged=False):
        if acct in seen:
            return
        seen.add(acct)
        nodes.append(
            {"id": acct, "label": acct[-8:], "account": acct, "type": kind, "riskScore": round(score * 100, 1), "country": "-", "flagged": flagged}
        )

    add(focus, "SUSPECT_TARGET", float(_BEST.loc[focus].risk_score) if focus in _BEST.index else 0.0, row["decision"] != "ALLOW")
    for _, r in nb.iterrows():
        other = r["sender"] if r["receiver"] == focus else r["receiver"]
        add(other, "MULE_LAYER" if r["decision"] != "ALLOW" else "VICTIM", float(r["risk_score"]), r["decision"] != "ALLOW")
        links.append(
            {
                "source": r["sender"],
                "target": r["receiver"],
                "amount": float(r["amount_usd"]),
                "currency": "USD",
                "timestamp": str(r["timestamp"]),
                "isLayeringHop": bool(r["decision"] != "ALLOW"),
            }
        )
    return {"nodes": nodes, "links": links}


@app.get("/api/audit-log")
def get_audit_log():
    return audit_log_store


@app.websocket("/ws/stream")
async def websocket_stream(websocket: WebSocket):
    """Replays rows of results.csv in file order. First 15 immediately, then one every 1.8 s."""
    await websocket.accept()
    try:
        start = 58  # begin a few rows before the first HOLD so flagged rows appear early
        i = 0
        while True:
            row = DF.iloc[(start + i) % len(DF)]
            await websocket.send_text(json.dumps({"type": "TRANSACTION", "payload": row_to_txn(row)}))
            await websocket.send_text(json.dumps({"type": "TELEMETRY", "payload": _telemetry()}))
            i += 1
            await asyncio.sleep(0 if i <= 15 else 1.8)
    except WebSocketDisconnect:
        pass
    except Exception as e:  # noqa: BLE001
        print("WebSocket exception:", e)
