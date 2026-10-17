# MuleNet: Real-Time Detection of Money Mule Accounts on IBM LinuxONE
> **Complete Technical Architecture, Domain Context, and Implementation Specification**  
> *Prepared as full context for advanced LLM reasoning, code generation, and domain expansion.*

---

## 1. Project Overview & Competition Context

- **Project Name:** MuleNet (Mule Account Network Detector)
- **Target Competition:** IBM Z Datathon 2026
- **Competition Theme:** Real-Time AI for Critical Decisions
- **Target Hardware Architecture:** IBM LinuxONE / IBM z16 (s390x architecture with IBM Telum on-chip AI accelerator)
- **Team:** Cryptic Vectors — Department of Artificial Intelligence and Data Science, Sona College of Technology, Salem, Tamil Nadu, India
- **Core Mission:** Provide sub-millisecond, in-transaction scoring of incoming and outgoing bank transfers on core banking mainframes to detect, warn, and freeze money mule accounts before fraudulent funds can exit the financial perimeter.

---

## 2. Problem Statement & Domain Understanding

### 2.1 The Money Mule Vulnerability
In cyber fraud (phishing, social engineering, investment scams, identity theft), fraudsters do not move stolen funds directly into their own accounts. Instead, they use **money mules**:
- **Complicit Mules:** Individuals who rent or sell their bank accounts or crypto wallets for a fee.
- **Unwitting Mules:** Victims (frequently university students, elderly, or low-income job seekers) duped into receiving funds and forwarding them under the guise of "currency exchange" or "work-from-home" tasks.
- **Layering & Velocity:** Stolen money is rapidly dispersed through a succession of mule accounts within minutes, using rapid pass-through transfers, smurfing (splitting amounts), and cross-border currency conversion.

### 2.2 Why Traditional Anti-Money Laundering (AML) Fails
1. **Batch Latency:** Traditional rule engines (e.g., alert on transactions $> \$10,000$) run in overnight or T+1 batch SQL jobs. By the time an AML officer reviews an alert, the funds have long cleared the bank.
2. **Transaction Isolation:** Legacy systems evaluate transactions as standalone events rather than evaluating the dynamic graph topology and temporal velocity of the account itself.
3. **Data Egress Hazards:** Modern cloud-based AI requires piping raw transaction PII to external cloud data centers, violating strict banking data sovereignty regulations.

### 2.3 The Real-World Precedent: MuleHunter.AI
In India, the Reserve Bank Innovation Hub (RBIH) launched **MuleHunter.AI**, deployed across 31 commercial banks, to identify mules collaboratively. MuleNet is engineered on the premise of running similar intelligence **inside the live core-banking transaction stream on IBM LinuxONE hardware**.

---

## 3. Dataset & Data Partitioning Scheme

### 3.1 Data Source
The system uses the benchmark **IBM Transactions for Anti-Money Laundering (AML)** dataset (*Altman et al., 2023*, published on Kaggle as `ealtman2019/ibm-transactions-for-anti-money-laundering-aml`).

We utilize two official splits:
1. **`HI-Small` (High Illicit - Small size) — Primary Development & Evaluation:**
   - Transaction CSV (`HI-Small_Trans.csv`): 5,078,345 rows, 453.6 MiB uncompressed.
   - Illicit rows: 5,177 (exact laundering rate: **0.1019%**).
   - Graph Patterns File (`HI-Small_Patterns.txt`): 323,844 bytes, 370 structured laundering attempt blocks.
2. **`LI-Small` (Low Illicit - Small size) — Cross-Distribution Transferability Benchmark:**
   - Transaction CSV (`LI-Small_Trans.csv`): 6,924,049 rows, 620.3 MiB uncompressed.
   - Illicit rows: 3,565 (exact laundering rate: **0.0515%**).
   - Patterns File (`LI-Small_Patterns.txt`): 117 structured laundering blocks.

### 3.2 Raw Schema
Each row contains 11 fields:
- `Timestamp`: Datetime string `YYYY/MM/DD HH:MM` (Sept 01, 2022 to Sept 18, 2022).
- `From Bank`: Bank routing identifier (string, e.g., `"010"`, keeping leading zeros).
- `Account` (Column 1): Sender account number $\rightarrow$ Renamed `from_account`.
- `To Bank`: Receiver bank routing identifier.
- `Account` (Column 2): Receiver account number $\rightarrow$ Renamed `to_account`.
- `Amount Received`: Numerical float received.
- `Receiving Currency`: One of 15 currencies (`US Dollar`, `Euro`, `UK Pound`, `Bitcoin`, etc.).
- `Amount Paid`: Numerical float debited.
- `Payment Currency`: Currency of debit.
- `Payment Format`: One of 7 channels (`ACH`, `Wire`, `Cash`, `Cheque`, `Credit Card`, `Bitcoin`, `Reinvestment`).
- `Is Laundering`: Binary target (`0` = legitimate, `1` = money laundering).

### 3.3 The Injected Graph Patterns
The dataset injects 8 specific topological laundering structures:
1. **CYCLE:** Money loops through accounts and returns to originator ($A \rightarrow B \rightarrow C \rightarrow A$).
2. **FAN-OUT:** Single staging account disperses funds across multiple mule accounts.
3. **FAN-IN:** Dispersed mule accounts funnel funds into a single accumulator account.
4. **GATHER-SCATTER:** Funds converge into a hub account and are instantly dispersed.
5. **SCATTER-GATHER:** Classic "smurfing" — large amounts broken down and re-aggregated.
6. **BIPARTITE:** Parallel multi-sender to multi-receiver matrix transfers.
7. **STACK:** Linear sequential layering chain ($A \rightarrow B \rightarrow C \rightarrow D$).
8. **RANDOM:** Unstructured random-hop layering designed to evade static thresholds.

*Note:* In `HI-Small`, 62% of positive rows belong to these explicit patterns; the remaining 38% are unpatterned laundering rows. In `LI-Small`, only 29% follow these patterns (71% unpatterned).

### 3.4 Strict Forward-in-Time Splitting (Dropping the Simulator Tail)
```
[Sept 1 – Sept 6]           [Sept 7 – Sept 8]          [Sept 9 – Sept 10]        [Sept 11+]
      TRAIN                       VAL                       TEST                   TAIL
 3,248,921 rows              965,524 rows              862,792 rows             (DROPPED)
(2,530 laundering)          (1,036 laundering)          (956 laundering)      (~58% laundering)
```
- **The Tail Drop:** In the IBM simulator, normal customer traffic terminates after **2022-09-10**, causing the remaining tail to spike to **~58% laundering**. Many academic papers erroneously keep this tail in their test split, artificially inflating benchmark scores. MuleNet strictly **discards all rows after 2022-09-10** to preserve the true 0.1% real-world imbalanced distribution.
- **Split Windows:**
  - **Train:** `2022-09-01` to `2022-09-06` (6 days, 3,248,921 rows)
  - **Validation:** `2022-09-07` to `2022-09-08` (2 days, 965,524 rows)
  - **Test:** `2022-09-09` to `2022-09-10` (2 days, 862,792 rows)

---

## 4. Feature Engineering Engine (`mulenet/features.py`)

The pipeline computes **87 features** per transaction with mathematical guarantees of **zero temporal leakage**.

### 4.1 Causal Binary Search Algorithm (`_window_stats`)
For a transaction occurring at minute $t$, features must only use transactions occurring strictly in the interval $[t - W, t)$ (earlier minutes). The current transaction's own label or dollar amounts must never leak into historical stats.

**Implementation:**
1. Global integer minute coordinate: $t = (\text{timestamp} - \text{"2022-01-01"}) // \text{1 minute}$.
2. Unique entity key: $\text{CombinedKey} = \text{AccountCode} \times 2^{32} + t$.
3. Lexicographical sorting: Arrays are ordered by `(CombinedKey, t)` using `np.lexsort`.
4. Binary Search (`np.searchsorted`):
   - Query upper bound: `hi = np.searchsorted(CombinedKey, query_key * 2^32 + t, side='left')`. Using `side='left'` excludes the current transaction at time $t$.
   - Query lower bound: `lo = np.searchsorted(CombinedKey, query_key * 2^32 + (t - W), side='left')`.
   - Event Count: $\text{Count} = \text{hi} - \text{lo}$.
   - Sums: Computed in $O(1)$ time via precomputed prefix cumulative sums: $\text{Sum} = \text{CumSum}[\text{hi}] - \text{CumSum}[\text{lo}]$.
   - Time Gap: Minutes since previous event: $t - t_{\text{prev}}$ (capped at $W_{\max} = 10,080\text{ min}$).

### 4.2 Feature Taxonomy (87 Total Features)
1. **Transaction Level (12 features):**
   - `log_usd_paid`, `log_usd_received`, `usd_ratio` ($\frac{\text{usd\_recv}}{\text{usd\_paid}}$).
   - `currency_mismatch` (boolean), `self_transfer` (`src == dst`), `same_bank` (`from_bank == to_bank`), `whole_amount` (round integer check).
   - Categorical codes: `payment_format` (7 categories), `payment_currency` (15 categories), `receiving_currency` (15 categories), `hour` (0–23), `weekday` (0–6).
2. **Account Flow Dynamics (40 features):**
   - Evaluated across 4 directed flows:
     - `src_out`: Sender's historical outbound payments.
     - `src_in`: Inbound funds entering sender's account earlier (detects rapid pass-through/layering).
     - `dst_in`: Receiver's historical inbound deposits (detects fan-in accumulation).
     - `dst_out`: Receiver's historical outbound disbursements.
   - Evaluated across 3 rolling time windows: **6 hours** (360 min), **24 hours** (1,440 min), **7 days** (10,080 min).
   - Statistics per flow/window: `cnt` (count), `usd` (volume sum), `uniq` (unique counterparty count).
   - Recency gaps: `mins_since_prev` for each of the 4 flows.
3. **Directed Pair Counter (3 features):**
   - `pair_cnt_6h`, `pair_cnt_24h`, `pair_cnt_7d`: Prior transfers directly between this exact `(Sender, Receiver)` pair.
4. **GraphSAGE Embeddings (32 features):**
   - `src_gnn_0` .. `src_gnn_15`: 16-dimensional continuous topological embedding of the sender.
   - `dst_gnn_0` .. `dst_gnn_15`: 16-dimensional continuous topological embedding of the receiver.
5. **Implied USD Forex Conversion (`fit_usd_rates`):**
   - Computed purely from multi-currency transactions involving USD in the **training split only** using median cross-rates. Frozen into `meta.json`. Never refit on validation or test sets.

---

## 5. Machine Learning Architecture

```
       [Live Transaction Stream]
                   │
                   ▼
    ┌──────────────────────────────┐
    │  Causal Rolling Window Store │ ◄── [t - W, t) zero-leakage binary search
    │  (6h, 24h, 7d Flow Counters) │
    └──────────────┬───────────────┘
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
┌─────────────────┐ ┌──────────────────┐
│ GraphSAGE       │ │ Tabular Flow     │
│ Embeddings      │ │ & Forex Rates    │
│ (16-dim / node) │ │ (55 features)    │
└────────┬────────┘ └────────┬─────────┘
         └─────────┬─────────┘
                   ▼
    ┌──────────────────────────────┐
    │ XGBoost Gradient Boosted Tree│ ◄── depth=8, scale_pos_weight=5,
    │ (ONNX Runtime Engine)        │     early stopping on val PR-AUC
    └──────────────┬───────────────┘
                   ▼
    ┌──────────────────────────────┐
    │   Account Risk Roll-Up       │ ──► AccountRisk(A) = max(TxnScores)
    │   (Allow / Warn / Hold)      │ ──► Precision@100 = 1.00 (100% true mules)
    └──────────────────────────────┘
```

### 5.1 Relational GraphSAGE (`mulenet/gnn.py`)
- **Framework:** PyTorch Geometric (`torch_geometric`).
- **Graph Topology:** Homogeneous directed graph where nodes = account entities (`Bank_Account`), edges = transaction flows.
- **Model:** 2-layer `GraphSAGE` (`SAGEConv`) with ReLU activations and linear edge classifier.
- **Training Strategy:** Trained with `BCEWithLogitsLoss` using dynamic positive class weighting $\text{pos\_weight} = \frac{N_{\text{neg}}}{N_{\text{pos}}}$.
- **Extraction:** Extracts 16-dimensional node embeddings from the training partition into `artifacts/gnn_embeddings.npz`. Accounts not present in training default to a zero-vector $\vec{0}$ to prevent future leakage.

### 5.2 XGBoost Decision Engine (`mulenet/model.py`)
- **Hyperparameters:**
  ```python
  PARAMS = {
      "objective": "binary:logistic",
      "eval_metric": "aucpr",
      "tree_method": "hist",
      "max_depth": 8,
      "eta": 0.05,
      "subsample": 0.8,
      "colsample_bytree": 0.8,
      "min_child_weight": 5,
      "scale_pos_weight": 5,
      "seed": 0,
  }
  ```
- **Cost-Sensitive Weighting:** `scale_pos_weight=5` heavily penalizes false negatives, compelling tree splits to isolate the rare 0.1% positive class.
- **Tuning Discipline:** Alert threshold ($\tau \approx 0.245$) is tuned strictly to maximize laundering F1 on the **validation partition**; it is never tuned on test data.
- **Pure NumPy Scoring:** All validation metrics (`pr_curve`, `average_precision`, `classification_metrics`) are written in native NumPy to eliminate scikit-learn runtime dependencies during production scoring.

### 5.3 Account-Level Risk Roll-up
A transaction score represents the probability that a single transfer is money laundering. To identify the mule account operating the transfer, MuleNet aggregates transaction risk across touchpoints:
$$\text{AccountRisk}(A) = \max_{t \in \text{Transactions}(A)} \text{Score}(t)$$
An account is classified as a mule if its maximum transaction score exceeds the operational decision threshold.

### 5.4 Three-Tier Operational Decision Protocol
Instead of an aggressive binary freeze (which harms legitimate customers), MuleNet deploys a 3-tier action matrix:
1. **Low Risk ($\text{Score} < 0.20$) $\rightarrow$ `✅ ALLOW`:** Immediate clearance ($<1.0\text{ ms}$).
2. **Medium Risk ($0.20 \le \text{Score} < 0.50$) $\rightarrow$ `⚠️ WARN HOLDER`:** Automated SMS / push notification to account holder (educates students/unwitting victims without freezing legitimate banking operations).
3. **High Risk ($\text{Score} \ge 0.50$) $\rightarrow$ `🚨 HOLD & ALERT`:** Outbound transfer settlement held immediately; account frozen; case escalated to AML compliance with TreeSHAP feature attributions.

---

## 6. Hardware Acceleration on IBM LinuxONE & z16 Telum

### 6.1 The Hardware Narrative
- **Data Gravity Co-location:** Major financial institutions run core transactional ledgers on IBM Z / LinuxONE. Scoring transactions directly on the mainframe eliminates data egress latency and prevents sensitive PII from crossing external network boundaries.
- **Sub-Millisecond In-Transaction Latency:** Traditional external cloud AI models introduce **$\approx 200\text{ ms}$** of network round-trip overhead—too slow to evaluate before payment settlement. The **IBM Telum on-chip integrated AI accelerator** executes inference in **$\approx 0.4\text{ to } 1.0\text{ ms}$**, enabling in-flight intervention.
- **Zero-Dependency LinuxONE Scorer (`requirements-score.txt`):** The trained XGBoost model is compiled to ONNX (`model.onnx`, 6.3 MB). Production scoring on LinuxONE s390x requires **only NumPy, Pandas, and ONNX Runtime**. It requires no PyTorch, no CUDA, and no raw training CSVs.

### 6.2 Bit-Accurate Parity Verification (`pipeline.py: TOLERANCE = 1e-5`)
To ensure mathematical consistency across heterogeneous architectures (x86 development machine vs. s390x LinuxONE mainframe), MuleNet enforces a strict parity contract:
$$\max |\text{Score}_{\text{ONNX}} - \text{Score}_{\text{Training}}| \le 10^{-5}$$
Empirical verification achieved a maximum absolute difference of **$2.68 \times 10^{-7}$**, proving bit-level alignment.

---

## 7. Empirical Results & Comparative Experiments

### 7.1 Primary Benchmark (IBM AML HI-Small)

| Metric | Validation (09-07 .. 09-08) | Test Window (09-09 .. 09-10) |
|---|---|---|
| **Evaluated Transactions** | 965,524 | 862,792 |
| **True Laundering Positives** | 1,036 | 956 |
| **Precision** | 74.8% | 62.1% |
| **Recall** | 45.4% | 35.5% |
| **Transaction F1 Score** | **0.565** | **0.451** |
| **Transaction PR-AUC** | 0.536 | 0.411 |
| **Account Precision@100** | **1.00 (100%)** | **1.00 (100%)** |

> **Crucial Metric for Judges:** **Precision@100 = 100%**. In the top 100 highest-risk accounts flagged by MuleNet on unseen test data, **every single account was a true money mule**.

### 7.2 Experimental Ablations & Discoveries
1. **The 7-Day Window Discovery:** With only 6h and 24h windows, validation PR-AUC plateaued at $0.29$. Adding the 7-day window raised validation PR-AUC to $0.54$, proving that money mule layering unfolds over multi-day spans.
2. **Weekday Ablation (`scripts/ablate_weekday.py`):** Dropping `weekday` was hypothesized to prevent calendar overfitting. However, test PR-AUC degraded ($0.411 \rightarrow 0.373$) and precision dropped ($62.1\% \rightarrow 54.4\%$). Calendar rhythms correlate with business banking hours vs. illicit nocturnal layering; `weekday` was retained.
3. **Anomaly Hybrid Experiment (`scripts/anomaly_hybrid_compare.py`):** An unsupervised Isolation Forest was trained on normal transactions and its anomaly score fed into XGBoost.
   - Result: Test PR-AUC was $0.4172$, F1 was $0.4509$ (identical to baseline).
   - Core Finding: The `anomaly_score` did not appear in the top 10 features by gain. **Money laundering is not a statistical anomaly of dollar amounts; it is a structural anomaly of network flow.** Criminals intentionally keep amounts and frequencies within normal statistical bands.
4. **Cross-Split Robustness Check (LI-Small):** When the model trained on HI-Small was evaluated on LI-Small (0.05% laundering rate), F1 dropped to $0.148$. In LI-Small, 71% of laundering is unpatterned. This proves supervised models trained on explicit synthetic patterns require unsupervised graph fallbacks in diffuse environments.

---

## 8. Codebase Structure & File Guide

```text
/home/benny/Projects/mulenet/
├── artifacts/                  # Committable model artifacts (No raw data)
│   ├── model.onnx              # 6.3 MB ONNX computation graph
│   ├── model.json              # Native XGBoost booster
│   ├── meta.json               # Schema, USD rates, threshold, metrics, feature gains
│   └── gnn_embeddings.npz      # Compressed 16-dim topological embeddings
├── mulenet/                    # Core Python package
│   ├── data.py                 # CSV loading, bank-account keying, temporal splits
│   ├── features.py             # 87 strictly past-only causal features (binary search)
│   ├── gnn.py                  # PyTorch Geometric 2-layer GraphSAGE architecture
│   ├── model.py                # XGBoost training, NumPy metrics, ONNX export
│   ├── pipeline.py             # CLI orchestrator (train, export-check, score)
│   ├── report.py               # Standalone self-contained HTML report generator
│   └── app.py                  # Live Streamlit demonstration dashboard
├── scripts/
│   ├── verify_data.py          # Validates raw CSV rows, hashes, pattern block counts
│   ├── ablate_weekday.py       # Calendar feature ablation script
│   └── anomaly_hybrid_compare.py # Isolation Forest vs. GraphSAGE benchmark script
├── tests/
│   ├── test_model.py           # Unit tests, past-only leakage checks, parity checks
│   └── test_notebook.py        # Kaggle environment parser tests
├── prompt.md                   # Original design specification
├── summary.md                  # Chronological experiment log
├── requirements-dev.txt        # Full training dependencies (includes PyTorch & PyG)
└── requirements-score.txt      # Minimal scoring dependencies (numpy, pandas, onnxruntime)
```

---

## 9. Known Vulnerabilities, Edge Cases & Defense Strategy

| Edge Case / Vulnerability | Attack Vector or Failure Mode | Built-in Mitigation / Defense |
|---|---|---|
| **Cold-Start Burner Accounts** | New mule account used once and discarded; rolling flow history and GNN embeddings evaluate to 0. | Relies on transaction-level attributes (format, amount ratio). Production systems pair MuleNet with initial KYC / Customer Due Diligence tiers. |
| **"Sleep & Wake" Window Attack** | Laundering syndicate deposits funds and waits **8 days** before moving money, exceeding the 7-day rolling window. | 7-day flow counters reset to 0. Production mitigation: augment rolling windows with 30-day cumulative ledger balance checks. |
| **Smurfing (Micro-Structuring)** | Dispersing $\$50,000$ into 100 transfers of $\$500$ to stay below dollar threshold gain. | While `log_usd_paid` drops, `src_out_cnt_24h` and `src_out_uniq_24h` velocity counters spike, maintaining high alert probability. |
| **Payroll & Merchant Traps** | Corporate payroll accounts exhibit high fan-out; e-commerce merchants exhibit high fan-in. | Without merchant codes, flows look like laundering. Mitigation: whitelist verified corporate accounts or incorporate Merchant Category Codes (MCC). |
| **Innocent Duped Victims** | Unwitting student receives scam funds; max account roll-up spikes to high risk. | The **3-Tier Triage** (`WARN HOLDER`) prevents automatic account freezing, sending educational alerts instead of disruption. |

---

## 10. CLI Quickstart & Operational Commands

```bash
# 1. Activate Virtual Environment
source .venv/bin/activate

# 2. Run Fast Unit & Zero-Leakage Tests (~15s)
python -m pytest tests/test_model.py -k "not slow"

# 3. Full End-to-End Real-Data Slow Test (~44 min)
python -m pytest tests/test_model.py -m slow

# 4. Retrain Hybrid Model (Writes artifacts/)
python -m mulenet train

# 5. Export Test Window Check Set (data/check/HI-Small_check.csv.gz)
python -m mulenet export-check

# 6. Score on LinuxONE via ONNX Engine (Generates reports/report.html)
python -m mulenet score --backend onnx

# 7. Launch Live Interactive Streamlit Dashboard
streamlit run mulenet/app.py
```
