"""Tests for the mulenet package.

Fast tests use hand-made or synthetic transactions. Tests marked `slow` run the
whole pipeline on data/raw/ and are skipped unless selected: pytest -m slow
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from mulenet import model, pipeline
from mulenet.__main__ import main
from mulenet.pipeline import TOLERANCE
from mulenet.data import COLUMNS, load_transactions, trim_and_split
from mulenet.features import FEATURES, MAX_WINDOW, build_features, fit_usd_rates

ROOT = Path(__file__).resolve().parent.parent
HEADER = (
    "Timestamp,From Bank,Account,To Bank,Account,Amount Received,Receiving Currency,"
    "Amount Paid,Payment Currency,Payment Format,Is Laundering"
)
USD = {"US Dollar": 1.0}


def txns(rows) -> pd.DataFrame:
    """rows: (time 'MM-DD HH:MM', from, to, usd amount[, label]) on bank '001'."""
    out = []
    for r in rows:
        when, src, dst, amount = r[:4]
        out.append({
            "timestamp": pd.Timestamp(f"2022-{when}"), "from_bank": "001", "from_account": src,
            "to_bank": "001", "to_account": dst, "amount_received": amount, "receiving_currency": "US Dollar",
            "amount_paid": amount, "payment_currency": "US Dollar", "payment_format": "ACH",
            "is_laundering": r[4] if len(r) > 4 else 0,
        })
    df = pd.DataFrame(out)
    df.insert(0, "txn_id", range(len(df)))
    return df


# ---------- features ----------

def test_window_counts_sums_and_gaps_are_exact():
    df = txns([
        ("09-01 00:00", "A", "B", 10.0),
        ("09-01 05:00", "A", "C", 20.0),
        ("09-01 05:00", "A", "C", 30.0),
        ("09-01 10:00", "A", "B", 40.0),   # row 3
        ("09-02 06:00", "A", "D", 50.0),   # row 4
        ("09-02 07:00", "C", "A", 60.0),   # row 5: C pays A
    ])
    f = build_features(df, USD)

    # Row 3 at 10:00: 6h window [04:00, 10:00) holds the two 05:00 payments; 24h holds three.
    assert f.loc[3, "src_out_cnt_6h"] == 2
    assert f.loc[3, "src_out_cnt_24h"] == 3
    assert f.loc[3, "src_out_usd_24h"] == pytest.approx(60.0)
    assert f.loc[3, "src_out_uniq_24h"] == 2          # B and C
    assert f.loc[3, "src_out_mins_since_prev"] == 300
    assert f.loc[3, "pair_cnt_24h"] == 1              # the 00:00 A->B payment
    # Row 4 next day 06:00: 24h window [09-01 06:00, 09-02 06:00) holds only the 10:00 payment.
    assert f.loc[4, "src_out_cnt_24h"] == 1
    assert f.loc[4, "src_out_cnt_6h"] == 0
    assert f.loc[4, "src_out_mins_since_prev"] == 20 * 60
    # Row 5 at 09-02 07:00: C's receipts (09-01 05:00) are outside 24h; receiver A paid 50 at 06:00.
    assert f.loc[5, "src_in_cnt_24h"] == 0
    assert f.loc[5, "dst_out_cnt_6h"] == 1
    assert f.loc[5, "dst_out_usd_6h"] == pytest.approx(50.0)
    assert f.loc[4, "src_out_cnt_7d"] == 4
    # First transaction: no history anywhere, gaps capped at the longest window.
    assert f.loc[0, ["src_out_cnt_7d", "dst_in_cnt_7d", "pair_cnt_7d"]].sum() == 0
    assert f.loc[0, "src_out_mins_since_prev"] == MAX_WINDOW


def test_streaming_state_store_matches_window_stats():
    from mulenet.streaming import StreamingAccountStateStore
    from mulenet.features import _window_stats

    ev_key = np.array([1, 1, 1, 2, 1, 2], dtype=np.int64)
    ev_t = np.array([100, 300, 600, 700, 1500, 1600], dtype=np.int64)
    ev_usd = np.array([50.0, 100.0, 200.0, 75.0, 300.0, 120.0], dtype=np.float64)

    batch_stats = _window_stats(ev_key, ev_t, {"usd": ev_usd}, ev_key, ev_t)
    store = StreamingAccountStateStore()
    stream_cnt_6h, stream_usd_6h = [], []
    stream_cnt_24h, stream_usd_24h = [], []
    stream_cnt_7d, stream_usd_7d = [], []
    stream_mins = []

    for k, t, u in zip(ev_key, ev_t, ev_usd):
        q = store.query(k, t)
        stream_cnt_6h.append(q["cnt_6h"])
        stream_usd_6h.append(q["usd_6h"])
        stream_cnt_24h.append(q["cnt_24h"])
        stream_usd_24h.append(q["usd_24h"])
        stream_cnt_7d.append(q["cnt_7d"])
        stream_usd_7d.append(q["usd_7d"])
        stream_mins.append(q["mins_since_prev"])
        store.update(k, t, {"usd": u})

    np.testing.assert_array_equal(stream_cnt_6h, batch_stats["cnt_6h"])
    np.testing.assert_allclose(stream_usd_6h, batch_stats["usd_6h"])
    np.testing.assert_array_equal(stream_cnt_24h, batch_stats["cnt_24h"])
    np.testing.assert_allclose(stream_usd_24h, batch_stats["usd_24h"])
    np.testing.assert_array_equal(stream_cnt_7d, batch_stats["cnt_7d"])
    np.testing.assert_allclose(stream_usd_7d, batch_stats["usd_7d"])
    np.testing.assert_array_equal(stream_mins, batch_stats["mins_since_prev"])


def test_invariant_and_cold_start_features_exact():
    df = txns([
        ("09-01 00:00", "A", "B", 10.0),
        ("09-01 00:15", "B", "C", 9.8),  # B receives 10, then pays 9.8 15 mins later
    ])
    f = build_features(df, USD)
    assert "src_throughput_ratio_24h" in f.columns
    assert "src_retention_ratio_24h" in f.columns
    assert "src_rapid_turnaround_flag" in f.columns
    assert "src_dormancy_spurt" in f.columns
    assert "sub_ctr_structuring" in f.columns
    assert "src_fan_ratio_24h" in f.columns
    assert "src_usd_acceleration_6h_24h" in f.columns
    assert "src_is_gnn_cold_start" in f.columns
    assert "src_entity_type" in f.columns
    assert "dst_entity_type" in f.columns
    assert "same_entity_transfer" in f.columns
    assert len(f.columns) == len(FEATURES)
    assert f.loc[1, "src_rapid_turnaround_flag"] == 1.0
    assert f.loc[1, "src_throughput_ratio_24h"] == pytest.approx(1.0 / 11.0)
    assert f.loc[1, "sub_ctr_structuring"] == 0.0  # 9.8 is not in structuring range [7500, 10000)
    assert f.loc[1, "src_is_gnn_cold_start"] == 1.0
    assert f.loc[1, "both_cold_start"] == 1.0
    assert f.loc[1, "same_entity_transfer"] == 0.0


def test_accounts_metadata_loader_and_entity_features(tmp_path):
    from mulenet.data import classify_entity_name, load_accounts_metadata

    assert classify_entity_name("Acme Corp LLC") == 2
    assert classify_entity_name("John Doe") == 1
    assert classify_entity_name("Bob Sole Proprietorship") == 3
    assert classify_entity_name("Smith & Jones Partnership") == 4
    assert classify_entity_name("") == 0

    # Test fallback on missing file
    missing = load_accounts_metadata(tmp_path / "Nonexistent_Accounts.csv")
    assert missing == {}

    # Test loading actual CSV
    csv_file = tmp_path / "Test_Accounts.csv"
    csv_file.write_text(
        "Bank ID,Account Number,Entity ID,Entity Name\n"
        "001,A,E100,Acme Corp LLC\n"
        "001,B,E100,Acme Branch Corp\n"
        "001,C,E200,Jane Individual\n"
    )
    loaded = load_accounts_metadata(csv_file)
    assert "001_A" in loaded
    assert loaded["001_A"]["entity_id"] == "E100"
    assert loaded["001_A"]["entity_type_code"] == 2.0

    # Test build_features with accounts metadata
    df = txns([
        ("09-01 00:00", "A", "B", 10.0),  # Both owned by E100 -> same_entity_transfer == 1.0
        ("09-01 01:00", "A", "C", 20.0),  # E100 -> E200 -> same_entity_transfer == 0.0
    ])
    f = build_features(df, USD, accounts_metadata=loaded)
    assert f.loc[0, "src_entity_type"] == 2.0
    assert f.loc[0, "dst_entity_type"] == 2.0
    assert f.loc[0, "same_entity_transfer"] == 1.0
    assert f.loc[1, "same_entity_transfer"] == 0.0


def test_patterns_parser_and_fallback(tmp_path):
    from mulenet.data import parse_patterns_file

    # Fallback on missing file
    assert parse_patterns_file(tmp_path / "Nonexistent_Patterns.txt") == {}

    # Parse sample pattern file
    txt_file = tmp_path / "Test_Patterns.txt"
    txt_file.write_text(
        "BEGIN LAUNDERING ATTEMPT - FAN-OUT: Max 10-degree Fan-Out\n"
        "2022/09/01 00:00,010,A,020,B,10.0,US Dollar,10.0,US Dollar,ACH,1\n"
        "END LAUNDERING ATTEMPT - FAN-OUT\n"
    )
    parsed = parse_patterns_file(txt_file)
    assert len(parsed) == 1
    key = list(parsed.keys())[0]
    assert parsed[key] == "FAN-OUT"


def test_features_use_only_the_past():
    rng = np.random.default_rng(1)
    accounts = list("ABCDEFG")
    rows = [
        (f"09-0{1 + i // 300} {(i % 300) // 13:02d}:{(i * 7) % 60:02d}",
         rng.choice(accounts), rng.choice(accounts), float(rng.integers(1, 1000)))
        for i in range(900)
    ]
    df = txns(rows).sort_values("timestamp", kind="stable").reset_index(drop=True)
    cut = df["timestamp"] < pd.Timestamp("2022-09-03")
    full = build_features(df, USD)
    past_only = build_features(df[cut], USD)
    pd.testing.assert_frame_equal(full[cut], past_only)


def test_features_do_not_depend_on_row_order():
    df = txns([
        ("09-01 00:00", "A", "B", 1.0), ("09-01 00:00", "A", "B", 2.0), ("09-01 01:00", "A", "C", 3.0),
        ("09-01 02:00", "B", "A", 4.0), ("09-01 03:00", "A", "B", 5.0), ("09-01 03:00", "C", "B", 6.0),
    ])
    shuffled = df.sample(frac=1, random_state=3)
    pd.testing.assert_frame_equal(build_features(df, USD), build_features(shuffled, USD).sort_index())


def test_usd_rates_come_from_cross_currency_rows():
    df = txns([("09-01 00:00", "A", "B", 1.0)] * 3)
    df["payment_currency"] = ["Euro", "US Dollar", "Euro"]
    df["receiving_currency"] = ["US Dollar", "Euro", "US Dollar"]
    df["amount_paid"] = [100.0, 117.0, 200.0]
    df["amount_received"] = [117.0, 100.0, 234.0]
    rates = fit_usd_rates(df)
    assert rates["US Dollar"] == 1.0
    assert rates["Euro"] == pytest.approx(1.17)
    f = build_features(df, rates)
    assert f.loc[0, "log_usd_paid"] == pytest.approx(np.log1p(117.0), rel=1e-6)


# ---------- split ----------

def test_split_is_by_day_and_drops_the_tail():
    df = txns([
        ("09-01 00:00", "A", "B", 1.0), ("09-06 23:59", "A", "B", 1.0), ("09-07 00:00", "A", "B", 1.0),
        ("09-08 12:00", "A", "B", 1.0), ("09-09 00:00", "A", "B", 1.0), ("09-10 23:59", "A", "B", 1.0),
        ("09-11 00:00", "A", "B", 1.0, 1),
    ])
    kept, split = trim_and_split(df.iloc[::-1])
    assert split.tolist() == ["train", "train", "val", "val", "test", "test"]
    assert kept["timestamp"].is_monotonic_increasing
    assert kept["is_laundering"].sum() == 0  # the 09-11 row is gone


# ---------- metrics ----------

def test_metrics_match_sklearn():
    from sklearn.metrics import average_precision_score, precision_recall_curve

    rng = np.random.default_rng(0)
    y = rng.random(2000) < 0.05
    p = np.round(rng.random(2000) * 0.5 + y * 0.3, 2)  # rounding creates ties
    assert model.average_precision(y, p) == pytest.approx(average_precision_score(y, p))
    precision, recall, thresholds = model.pr_curve(y, p)
    sk_p, sk_r, sk_t = precision_recall_curve(y, p)
    # sklearn lists thresholds ascending and appends (1, 0); compare over its thresholds.
    sk = dict(zip(np.round(sk_t, 6), zip(sk_p[:-1], sk_r[:-1])))
    for t_, p_, r_ in zip(thresholds, precision, recall):
        assert sk[round(t_, 6)] == pytest.approx((p_, r_))


def test_classification_metrics_and_threshold():
    y = np.array([1, 1, 0, 0, 0])
    p = np.array([0.9, 0.4, 0.5, 0.1, 0.0])
    assert model.best_f1_threshold(y, p) == pytest.approx(0.4)  # P=2/3, R=1 beats P=1, R=1/2
    m = model.classification_metrics(y, p, 0.4)
    assert (m["tp"], m["fp"], m["fn"], m["alerts"]) == (2, 1, 0, 3)
    assert m["f1"] == pytest.approx(0.8)


def test_account_scores_take_the_riskiest_transaction():
    src = pd.Series(["A", "B", "C"])
    dst = pd.Series(["B", "C", "D"])
    acc = model.account_scores(src, dst, np.array([0, 1, 0]), np.array([0.1, 0.9, 0.3]))
    assert acc.index.tolist()[:2] == ["B", "C"]
    assert acc.loc["B", "score"] == pytest.approx(0.9) and acc.loc["B", "txns"] == 2
    assert acc["is_mule"].to_dict() == {"B": True, "C": True, "D": False, "A": False}
    assert model.account_metrics(acc, k=2)["precision_at_2"] == 1.0


# ---------- whole pipeline on synthetic data ----------

def write_synthetic(path: Path, seed: int = 0) -> None:
    """Ten days of random payments plus planted fan-out laundering, in the raw IBM format."""
    rng = np.random.default_rng(seed)
    accounts = [f"{i:08X}" for i in range(400)]
    lines = [HEADER]

    def line(ts, src, dst, amount, label, fmt="Cheque", cur="US Dollar"):
        paid_cur, recv_cur = (cur, "US Dollar") if cur != "US Dollar" else (cur, cur)
        rate = 1.17 if cur == "Euro" else 1.0
        lines.append(f"{ts:%Y/%m/%d %H:%M},001,{src},002,{dst},{amount * rate:.2f},{recv_cur},{amount:.2f},{paid_cur},{fmt},{label}")

    for day in pd.date_range("2022-09-01", "2022-09-10"):
        for _ in range(500):
            ts = day + pd.Timedelta(minutes=int(rng.integers(0, 1440)))
            src, dst = rng.choice(accounts, 2, replace=False)
            cur = "Euro" if rng.random() < 0.1 else "US Dollar"
            line(ts, src, dst, rng.lognormal(6, 1.5), 0, fmt=rng.choice(["Cheque", "Credit Card", "ACH"]), cur=cur)
        for _ in range(4):  # fan-out: one mule pays many fresh accounts within two hours
            mule = rng.choice(accounts)
            start = day + pd.Timedelta(minutes=int(rng.integers(0, 1300)))
            for dst in rng.choice(accounts, 8, replace=False):
                line(start + pd.Timedelta(minutes=int(rng.integers(0, 120))), mule, dst, rng.uniform(4000, 6000), 1, fmt="ACH")
    line(pd.Timestamp("2022-09-12 01:00"), accounts[0], accounts[1], 100, 1)  # post-cutoff tail
    rows = lines[1:]
    rows.sort()
    path.write_text("\n".join([lines[0], *rows]) + "\n")


@pytest.fixture(scope="module")
def trained(tmp_path_factory):
    tmp = tmp_path_factory.mktemp("pipeline")
    data_dir, artifacts = tmp / "raw", tmp / "artifacts"
    data_dir.mkdir()
    write_synthetic(data_dir / "HI-Small_Trans.csv")
    meta = pipeline.train(data_dir, artifacts, log=lambda m: None)
    return tmp, data_dir, artifacts, meta


def test_train_writes_artifacts_and_learns_the_planted_pattern(trained):
    _, _, artifacts, meta = trained
    assert {"model.json", "model.onnx", "meta.json", "gnn_embeddings.npz"}.issubset({p.name for p in artifacts.iterdir()})
    assert json.loads((artifacts / "meta.json").read_text())["features"] == FEATURES
    assert meta["usd_rates"]["Euro"] == pytest.approx(1.17, rel=1e-3)
    test = meta["metrics"]["HI-Small/test"]["transactions"]
    assert test["positives"] == 2 * 4 * 8
    assert test["pr_auc"] > 0.7, test
    assert "LI-Small/test" not in meta["metrics"]


def test_onnx_matches_xgboost(trained):
    tmp, data_dir, artifacts, _ = trained
    df, _ = trim_and_split(load_transactions(data_dir / "HI-Small_Trans.csv"))
    meta = model.load_meta(artifacts)
    gnn_embeddings = model.load_gnn_embeddings(artifacts)
    X = build_features(df, meta["usd_rates"], gnn_embeddings).to_numpy()
    a = model.load_predictor(artifacts, "xgboost")(X)
    b = model.load_predictor(artifacts, "onnx")(X)
    assert np.abs(a - b).max() < 1e-5


@pytest.mark.parametrize("backend", ["xgboost", "onnx"])
def test_export_then_score_reproduces_training_metrics(trained, backend):
    tmp, data_dir, artifacts, meta = trained
    check = tmp / "check.csv.gz"
    if not check.exists():
        pipeline.export_check(data_dir, artifacts, check, log=lambda m: None)
    report = tmp / f"report-{backend}.html"
    code = main(["score", "--check", str(check), "--artifacts", str(artifacts), "--backend", backend, "--report", str(report)])
    assert code == 0

    html = report.read_text()
    for section in ("Transactions", "Mule accounts", "Precision vs recall", "Top flagged accounts", "Scores match"):
        assert section in html
    assert (tmp / "alerts.csv").is_file()

    result = pipeline.score(check, artifacts, report, backend=backend, log=lambda m: None)
    expected = meta["metrics"]["HI-Small/test"]
    assert result["parity_ok"]
    # ONNX runs in float32, so scores (and hence PR-AUC) may move by up to the parity tolerance.
    assert result["transactions"] == pytest.approx(expected["transactions"], abs=TOLERANCE)
    assert result["accounts"] == pytest.approx(expected["accounts"], abs=TOLERANCE)


def test_score_fails_when_scores_do_not_match(trained):
    tmp, data_dir, artifacts, _ = trained
    check = tmp / "check.csv.gz"
    if not check.exists():
        pipeline.export_check(data_dir, artifacts, check, log=lambda m: None)
    tampered = tmp / "tampered.csv.gz"
    df = pd.read_csv(check)
    df.loc[0, "expected_score"] += 0.01
    df.to_csv(tampered, index=False, float_format="%.9g")
    report = tmp / "tampered.html"
    assert main(["score", "--check", str(tampered), "--artifacts", str(artifacts), "--report", str(report)]) == 1
    assert "Scores differ" in report.read_text()


# ---------- real data (slow) ----------

@pytest.mark.slow
@pytest.mark.skipif(not (ROOT / "data/raw/HI-Small_Trans.csv").is_file(), reason="data/raw not downloaded")
def test_real_data_end_to_end(tmp_path):
    artifacts, check = tmp_path / "artifacts", tmp_path / "check.csv.gz"
    meta = pipeline.train(ROOT / "data/raw", artifacts, log=lambda m: None)
    pipeline.export_check(ROOT / "data/raw", artifacts, check, log=lambda m: None)
    result = pipeline.score(check, artifacts, tmp_path / "report.html", backend="onnx", log=lambda m: None)

    expected = meta["metrics"]["HI-Small/test"]
    assert result["parity_ok"]
    assert result["transactions"]["rows"] == 862_792
    assert result["transactions"]["positives"] == 956
    assert result["transactions"] == pytest.approx(expected["transactions"], abs=TOLERANCE)
