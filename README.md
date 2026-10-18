# MuleNet: Money Mule Account Risk Scoring (built for IBM LinuxONE)

[![Platform: IBM LinuxONE](https://img.shields.io/badge/Platform-IBM%20LinuxONE%20(s390x)-052FAD.svg?logo=ibm)](https://www.ibm.com/products/linuxone-4)
[![Runtime: ONNX](https://img.shields.io/badge/Runtime-ONNX%201.30-005CED.svg?logo=onnx)](https://onnx.ai/)
[![Model: XGBoost + GraphSAGE](https://img.shields.io/badge/Architecture-XGBoost%20%2B%20GraphSAGE-EB5424.svg)](https://github.com/dmlc/xgboost)
[![Python: 3.11+](https://img.shields.io/badge/Python-3.11%2B-3776AB.svg?logo=python)](https://www.python.org/)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

> **IBM Z Datathon 2026** | **Theme:** *Real-Time AI for Critical Decisions*  
> **Team:** Cryptic Vectors — Department of Artificial Intelligence and Data Science, Sona College of Technology, Salem, Tamil Nadu, India

> **Status and disclosure.** This is a prototype. Test PR-AUC is 0.165 (precision 0.18, recall 0.28) on IBM's synthetic HI-Small data; `results/results.csv` is a stratified sample, so alert counts are inflated. The demo UI replays precomputed scores. An IBM LinuxONE (s390x) environment was verified, but scoring was NOT run there, and latency figures, "sub-millisecond" and Telum statements in this README are design targets, not measured results. The model and training code predate the event (commits from Oct 8 and Oct 14); the UI, replay API and LinuxONE verification were built during it, and we disclose this for the organisers' determination.

---

## 📌 Executive Summary

In digital payment fraud and scam operations, illicit funds rarely linger in the fraudster's initial account. Instead, money is routed through **money mule accounts**—often rented, sold, or unwitting individuals—and rapidly layered across multi-bank networks within minutes. Traditional anti-money laundering (AML) workflows discover mule networks post-facto via overnight batch reconciliations, long after the stolen funds have exited the banking perimeter.

Inspired by initiatives like the Reserve Bank Innovation Hub's **MuleHunter.AI** (deployed across 31 commercial banks), **MuleNet** shifts detection from retroactive batch audits to **in-transaction, real-time intervention**. By combining strictly causal rolling behavioral features with Graph Neural Network (GraphSAGE) topological embeddings, MuleNet is designed to evaluate transaction and account risk with low latency on core banking infrastructure. Latency on LinuxONE has not been measured.

---

## 🏛️ Why IBM LinuxONE & z16 Telum?

1. **Data Gravity & Zero Egress:** Core transactional databases already reside on IBM Z / LinuxONE mainframes. Scoring transactions in-situ prevents piping sensitive financial PII over external public cloud networks.
2. **Sub-Millisecond AI Latency ($200\text{ ms} \rightarrow \approx 0.05\text{ ms}$):** Leveraging the **IBM Telum on-chip integrated AI accelerator**, MuleNet eliminates PCIe bus bottlenecks, enabling complex model scoring *inside* the live transaction processing loop without degrading customer payment latency (design target; the latency figures in this README were not measured on LinuxONE or Telum).
3. **Decoupled Scoring Footprint:** MuleNet exports trained models to **ONNX**, enabling scoring via a standalone runtime footprint ($<10\text{ MB}$ memory, pure NumPy/Pandas/ONNX Runtime) requiring zero heavyweight PyTorch dependencies on the s390x mainframe environment.

---

## ⚙️ System Architecture

```text
                                      IBM LinuxONE / s390x
┌────────────────────┐      ┌──────────────────────────────────────────────────────────────┐
│  Live Transaction  │─────►│ 1. Causal Feature Store ([t - W, t) strictly past-only stats)│
│  Stream (ISO 20022)│      │    • 114 features: 6h/24h/7d velocities, fan ratios, CTR      │
└────────────────────┘      └──────────────────────────────┬───────────────────────────────┘
                                                           │
                                                           ▼
                            ┌──────────────────────────────────────────────────────────────┐
                            │ 2. Hybrid Inference Engine (ONNX Runtime / IBM Telum)        │
                            │    • GraphSAGE Topological Embeddings (16-dim)               │
                            │    • XGBoost Hist Gradient Boosting (Tree Depth 8)           │
                            │    • Latency: p50 = 0.046 ms, p95 = 0.054 ms, p99 = 0.062 ms  │
                            └──────────────────────────────┬───────────────────────────────┘
                                                           │
                                                           ▼
                            ┌──────────────────────────────────────────────────────────────┐
                            │ 3. Automated 3-Tier Decision & Human Triage                  │
                            └───────┬──────────────────────┬──────────────────────┬────────┘
                                    │                      │                      │
                                    ▼                      ▼                      ▼
                            [Score < 0.0156]     [0.0156 <= Score < 0.05]   [Score >= 0.05]
                            ┌──────────────┐     ┌────────────────────┐     ┌──────────────┐
                            │  ✅ ALLOW    │     │  ⚠️ STEP-UP OTP    │     │ 🚨 HOLD FOR  │
                            │ Immediate    │     │ Step-up verification/│    │    OFFICER   │
                            │ Settlement   │     │ Push Notification  │     │ Intercept &  │
                            │              │     │ to prevent scams   │     │ Freeze Mule  │
                            └──────────────┘     └────────────────────┘     └──────────────┘
```

---

## 🔬 Core Innovations

### 1. Strictly Causal, Leakage-Free Feature Engineering (`mulenet/features.py`)
Standard AML models inadvertently leak future information by normalizing or calculating graph metrics over the entire static dataset. MuleNet guarantees **strict zero-leakage**:
- All rolling stats use strictly past-only intervals $[t - W, t)$ indexed via binary search (`np.searchsorted`).
- Multi-scale temporal windows: **6-hour**, **24-hour**, and **7-day** tracking inbound/outbound volume, transaction velocity, and counterparty diversity.
- **Direction 1 Feature Additions (114 Total Features):**
  - `sub_ctr_structuring`: Linear proximity feature in $[7500, 10000)$ capturing Currency Transaction Report (CTR) evasion.
  - `src_fan_ratio_24h` / `src_fan_ratio_7d`: Sender counterparty fan ratios detecting funnel and smurfing accounts (ranks as **#5 most important feature** in the model).
  - `src_usd_acceleration_6h_24h`: Ratio of 6h to 24h volume detecting sudden burst transfers.

### 2. Hybrid GraphSAGE + XGBoost Architecture
- **GraphSAGE (`mulenet/gnn.py`):** Learns 16-dimensional topological embeddings per account, detecting complex collusion graphs (`CYCLE`, `FAN-OUT`, `FAN-IN`, `BIPARTITE`, `GATHER-SCATTER`).
- **Cost-Sensitive XGBoost Backbone (`mulenet/model.py`):** Combines topological embeddings with tabular flow features. Handles extreme class imbalance ($0.10\%$ positives) using `scale_pos_weight=25` and $F_\beta$ ($\beta=2.0$) validation threshold calibration.

### 3. Account-Level Risk Roll-up
Account risk is aggregated in real-time across transaction touchpoints:
$$\text{Account Risk} = \max_{t \in \text{Transactions}(A)} \text{Score}(t)$$
MuleNet flags mule accounts with a **65% Precision@100** on top-ranked unseen test accounts (65 of 100 investigated accounts are confirmed money mules).

---

## 📊 Benchmark Results

Evaluated on the official **IBM Transactions for Anti-Money Laundering (AML)** dataset (*Altman et al., 2023*, `HI-Small` split: 5,078,345 transactions, $0.1019\%$ laundering rate):

| Evaluation Metric | HI-Small Validation | HI-Small Test (Unseen) | LI-Small (Cross-Dataset) |
| :--- | :--- | :--- | :--- |
| **Transaction Rows** | 965,524 | 862,792 | 1,174,450 |
| **Ground Truth Laundering** | 1,036 | 956 | 668 |
| **Detected Laundering (TP)** | 440 | **269** | 121 |
| **Transaction Recall** | **42.47%** | **28.14%** | 18.11% |
| **Transaction Precision** | 23.13% | 18.21% | 14.74% |
| **Alert Volume** | 1,902 | 1,477 | 821 |
| **PR-AUC** | **0.3218** | 0.1646 | 0.1168 |
| **Account Precision@100** | **96.0%** | **65.0%** | **67.0%** |

### Laundering Topology Breakdown (HI-Small Test)
- **FAN-OUT:** **72.3%** recall (47 / 65 caught)
- **GATHER-SCATTER:** **56.7%** recall (72 / 127 caught)
- **CYCLE:** **43.6%** recall (24 / 55 caught)
- **BIPARTITE:** **38.6%** recall (17 / 44 caught)
- **SCATTER-GATHER:** **33.6%** recall (37 / 110 caught)
- **FAN-IN:** **31.6%** recall (18 / 57 caught)
- **STACK:** **28.6%** recall (24 / 84 caught)
- **RANDOM:** **27.9%** recall (12 / 43 caught)
- **UNPATTERNED:** **18 transactions caught** (subtle structuring & burst transfers)

### Inference Latency (ONNX Runtime; see status note, not measured on LinuxONE or Telum)
- **p50:** **0.046 ms** (46 microseconds)
- **p95:** **0.054 ms** (54 microseconds)
- **p99:** **0.062 ms** (62 microseconds)
- **Scoring Parity vs XGBoost:** $\max |\Delta| = 1.07 \times 10^{-6}$ (strictly $\le 10^{-5}$)

---

## 📁 Repository Layout

```text
├── app/                        # Streamlit triage frontend (team-developed)
│   ├── app.py                  # Live alert inspector with risk tiers and explainability
│   └── README.md
├── artifacts/                  # Trained model artifacts (Git-tracked, <35MB each)
│   ├── model.onnx              # Optimized ONNX graph for LinuxONE runtime (6.8 MB)
│   ├── model.json              # Native XGBoost booster model (14 MB)
│   ├── meta.json               # 114 feature schemas, thresholds, USD forex rates, metrics
│   └── gnn_embeddings.npz      # Compressed topological account representations (34 MB)
├── mulenet/                    # Core Python package
│   ├── data.py                 # Forward-in-time day splitting
│   ├── features.py             # 114 strictly past-only causal & flow features
│   ├── gnn.py                  # PyTorch Geometric 2-layer GraphSAGE module
│   ├── model.py                # XGBoost training, cost-sensitive loss, ONNX conversion
│   ├── pipeline.py             # CLI pipeline: train, export-check, score
│   ├── report.py               # Self-contained zero-dependency HTML report generator
│   └── app.py                  # Full interactive Streamlit demonstration dashboard
├── results/
│   └── results.csv             # Pre-scored test stream with real ML decisions & explanations
├── scripts/
│   ├── generate_results_csv.py # Generates results.csv from scored test set
│   ├── verify_data.py          # Verifies raw CSV row counts, hashes, pattern blocks
│   ├── ablate_weekday.py       # Empirical ablation script for calendar features
│   └── anomaly_hybrid_compare.py # Isolation Forest vs. GNN comparative experiment
├── tests/
│   ├── test_model.py           # Unit tests, past-only leakage checks, ONNX parity tests
│   └── test_notebook.py        # Notebook environment compatibility tests
├── test_linuxone.py            # IBM LinuxONE (s390x) platform & ONNX verification script
├── requirements.txt            # Production runtime dependencies (ONNX, XGBoost, Streamlit)
├── requirements-dev.txt        # Full development & training dependencies (includes PyTorch)
└── requirements-score.txt      # Minimal scoring dependencies
```

---

## 🚀 Quickstart Guide

### 1. Environment Setup

```bash
# Clone the repository
git clone https://github.com/kanisha0729/MuleNet.git
cd MuleNet

# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Verify IBM LinuxONE & Model Runtime

Run the verification script to confirm platform architecture (`s390x` on LinuxONE) and verify the ONNX model:

```bash
python test_linuxone.py
```

### 3. Launch Interactive Triage Dashboard

Launch the Streamlit triage dashboard powered by real ML decisions:

```bash
streamlit run app/app.py
```
Or launch the full simulator with network graph visualizations:
```bash
streamlit run mulenet/app.py
```

### 4. Run Fast Unit Tests (~5s)

```bash
pytest tests/test_model.py -k "not slow"
```

### 5. Benchmark Real-Time Scoring (LinuxONE / s390x)

```bash
# Score check set using ONNX backend (verifies sub-millisecond latency & numerical parity)
python -m mulenet score --check data/check/HI-Small_check.csv.gz --backend onnx --report reports/report.html
```

---

## 👥 Team: Cryptic Vectors

* **S. Harsha Vardhaan** — Team Lead
* **Benadict Infant A**
* **Ameerkhan S**
* **Kanisha M**
* **B R Devamayookha**
* **Nivethitha A G**

*Department of Artificial Intelligence and Data Science, Sona College of Technology, Salem, Tamil Nadu, India.*

---

## 📚 References

1. **Altman, E., et al. (2023).** *Realistic Synthetic Financial Transactions for Anti-Money Laundering Models.* arXiv:2306.16424.
2. **Kaggle Dataset:** IBM Transactions for Anti-Money Laundering (AML) — `ealtman2019/ibm-transactions-for-anti-money-laundering-aml`.
3. **Reserve Bank Innovation Hub (RBIH):** *MuleHunter.AI: Collaborative mule account detection across commercial banks.*
4. **IBM Telum Processor:** *IBM z16 on-chip AI acceleration for real-time transactional fraud scoring.* IBM Redbooks.
