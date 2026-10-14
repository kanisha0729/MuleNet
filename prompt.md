## Dataset download
Use the Kaggle CLI to fetch only the files we need from `ealtman2019/ibm-transactions-for-anti-money-laundering-aml`. Do not download the whole dataset (it includes very large Medium/Large variants).

Required:
- `HI-Small_Trans.csv`
- `HI-Small_Patterns.txt`

Optional (robustness check, download only if I say yes):
- `LI-Small_Trans.csv`
- `LI-Small_Patterns.txt`

Steps:
1. Check `kaggle --version` and that `~/.kaggle/kaggle.json` exists. If not, stop and tell me how to set up the token.
2. Create `data/raw/` and add `data/` to `.gitignore` before downloading.
3. Download each file individually:
```bash
   kaggle datasets download -d ealtman2019/ibm-transactions-for-anti-money-laundering-aml -f HI-Small_Trans.csv -p data/raw
   kaggle datasets download -d ealtman2019/ibm-transactions-for-anti-money-laundering-aml -f HI-Small_Patterns.txt -p data/raw
```
   Kaggle may deliver a file as a `.zip`; unzip it in place and delete the zip.
4. Verify: both files exist, print their sizes, print the header row of the CSV, count rows and `Is Laundering = 1` rows, and count `BEGIN` blocks in the patterns file. Record these numbers in summary.md (computed, not copied from anywhere).
5. Local runs read from `data/raw/`. On Kaggle, do NOT download: attach the dataset in `kernel-metadata.json` and read from `/kaggle/input/...`. Make the notebook detect which environment it's in and pick the right path automatically.
6. LinuxONE never needs the raw dataset; it only uses the exported check set and model artifacts.
7. Never commit data files or push them anywhere.

## Model
Predict `Is Laundering` per transaction with gradient-boosted trees on transaction + account-graph features, then roll scores up to flag mule accounts.

Data and split:
1. Use HI-Small for training and evaluation. After 2022-09-10 the simulator stops generating normal activity and the remaining rows are ~58% laundering, so drop everything after 2022-09-10 (it would make the test set trivially easy).
2. Split by whole days: train 09-01..09-06, validation 09-07..09-08, test 09-09..09-10. No shuffling.
3. Robustness check: score LI-Small's 09-09..09-10 window with the HI-trained model (no retraining).

Features (one row per transaction, using only transactions strictly before it; no labels, no future data):
- Transaction: log USD amounts, received/paid ratio, currency mismatch, payment format, currencies, hour, weekday, self-transfer, same bank, round amount.
- Account key is `bank + account`. For sender and receiver over the past 6h/24h: outgoing and incoming counts, USD sums, distinct counterparties, minutes since previous transaction; plus prior transactions on the same sender→receiver pair.
- USD rates are implied from cross-currency rows in the training days and saved with the model.

Model:
- XGBoost (`binary:logistic`, hist), early stopping on validation PR-AUC. Pick the alert threshold on validation (max laundering-class F1); never tune on test.
- Account score = max transaction score over transactions the account sends or receives. An account is a mule (for evaluation) if it touches a laundering transaction in the window.
- Report on test: laundering-class F1, precision, recall, PR-AUC; account PR-AUC and precision@100.

Artifacts (`artifacts/`, small, no raw rows): `model.json` (XGBoost), `model.onnx`, `meta.json` (feature list, vocab, USD rates, threshold, metrics).

## Demo
- `python -m mulenet export-check` writes the check set to `data/check/` (gitignored): the HI test window with ids, precomputed features, label and the training machine's score.
- `python -m mulenet score` loads the check set + artifacts (backend `xgboost` or `onnx`), verifies its scores match the stored ones, computes metrics, and writes `reports/report.html` (metrics, PR curve, top flagged accounts). This is the command LinuxONE runs; it needs numpy, pandas and xgboost or onnxruntime, never the raw dataset.

## Testing
- Unit tests on small fixtures: features use only the past (appending future rows does not change earlier features), window counts are exact, split has no overlap, artifacts round-trip, ONNX matches XGBoost, scorer CLI produces a report.
- End-to-end test on real data (skipped if `data/raw/` is missing): train, export, score; test metrics must be in `meta.json` and scorer parity must hold.
