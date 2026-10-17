"""Loading the IBM AML files and the fixed day-based split.

The loaders mirror the `functions` cell in mulenet.ipynb, which has to stay
self-contained because the Kaggle kernel cannot import this package.
"""

from pathlib import Path

import pandas as pd

# The raw header names both account columns "Account", so we supply our own names.
COLUMNS = [
    "timestamp", "from_bank", "from_account", "to_bank", "to_account",
    "amount_received", "receiving_currency", "amount_paid", "payment_currency",
    "payment_format", "is_laundering",
]
# Bank codes have leading zeros ("010"), so keep ids as strings.
DTYPES = {
    "from_bank": str, "from_account": str, "to_bank": str, "to_account": str,
    "receiving_currency": str, "payment_currency": str, "payment_format": str,
    "amount_received": "float64", "amount_paid": "float64", "is_laundering": "int8",
}
TIME_FORMAT = "%Y/%m/%d %H:%M"

# Whole-day split. After LAST_DAY the simulator only emits the tail of laundering
# attempts (~58% positive), so those rows are dropped rather than scored.
SPLITS = {
    "train": ("2022-09-01", "2022-09-06"),
    "val": ("2022-09-07", "2022-09-08"),
    "test": ("2022-09-09", "2022-09-10"),
}
LAST_DAY = SPLITS["test"][1]


def load_transactions(path) -> pd.DataFrame:
    """Load a *_Trans.csv file. Adds `txn_id`, the 0-based row number in the file."""
    df = pd.read_csv(path, header=0, names=COLUMNS, dtype=DTYPES)
    df["timestamp"] = pd.to_datetime(df["timestamp"], format=TIME_FORMAT)
    df.insert(0, "txn_id", range(len(df)))
    return df


def trim_and_split(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    """Drop rows after LAST_DAY, sort by time, and label each row's split.

    Returns (rows sorted by timestamp then txn_id, split name per row).
    """
    day = df["timestamp"].dt.strftime("%Y-%m-%d")
    df = df[day <= LAST_DAY].sort_values(["timestamp", "txn_id"], kind="stable")
    day = df["timestamp"].dt.strftime("%Y-%m-%d")
    split = pd.Series(pd.NA, index=df.index, dtype="string")
    for name, (start, end) in SPLITS.items():
        split[(day >= start) & (day <= end)] = name
    assert split.notna().all(), "rows outside every split"
    return df.reset_index(drop=True), split.reset_index(drop=True)


def trans_path(data_dir, prefix: str) -> Path:
    return Path(data_dir) / f"{prefix}_Trans.csv"


def accounts_path(data_dir, prefix: str) -> Path:
    return Path(data_dir) / f"{prefix}_Accounts.csv"


def patterns_path(data_dir, prefix: str) -> Path:
    return Path(data_dir) / f"{prefix}_Patterns.txt"


PATTERN_TYPES = (
    "FAN-OUT",
    "FAN-IN",
    "GATHER-SCATTER",
    "SCATTER-GATHER",
    "CYCLE",
    "BIPARTITE",
    "STACK",
    "RANDOM",
)


def classify_entity_name(name: str) -> int:
    """Encode entity names into categorical codes:
    0: Unknown
    1: Individual / Person
    2: Corporation / Company / LLC / Ltd / Inc / Corp
    3: Sole Proprietorship
    4: Partnership
    5: Other / Organization
    """
    if not isinstance(name, str) or not name.strip() or name.strip().lower() in ("unknown", "none", "nan", "null"):
        return 0
    n = name.lower()
    if any(w in n for w in ("corp", "inc", "llc", "ltd", "company", "co.", "gmbh", "s.a.")):
        return 2
    if "sole" in n or "proprietor" in n:
        return 3
    if "partner" in n:
        return 4
    if "org" in n or "foundation" in n or "trust" in n or "gov" in n:
        return 5
    # Standard personal entity names map to Individual (1)
    return 1


def load_accounts_metadata(path) -> dict[str, dict]:
    """Load an *_Accounts.csv file if it exists.

    Maps account key (`f"{bank}_{account}"`) to:
      {"entity_id": str, "entity_type_code": float}

    Returns an empty dict if the file does not exist.
    """
    p = Path(path)
    if not p.is_file():
        return {}

    try:
        sample = pd.read_csv(p, nrows=5)
        col_map = {c.lower().replace(" ", "_"): c for c in sample.columns}
        bank_col = col_map.get("bank_id", col_map.get("from_bank", col_map.get("bank", "Bank ID")))
        acct_col = col_map.get("account_number", col_map.get("from_account", col_map.get("account", "Account Number")))
        entity_id_col = col_map.get("entity_id", col_map.get("owner_id", col_map.get("entity", "Entity ID")))
        entity_name_col = col_map.get("entity_name", col_map.get("entity_type", col_map.get("name", "Entity Name")))

        df = pd.read_csv(p, dtype=str)
        out = {}
        for r in df.to_dict(orient="records"):
            bank = str(r.get(bank_col, "")).strip()
            acct = str(r.get(acct_col, "")).strip()
            e_id = str(r.get(entity_id_col, "")).strip()
            e_name = str(r.get(entity_name_col, "")).strip()
            if bank and acct:
                key = f"{bank}_{acct}"
                code = float(classify_entity_name(e_name))
                out[key] = {"entity_id": e_id, "entity_type_code": code}
        return out
    except Exception:
        return {}


def parse_patterns_file(path) -> dict[tuple, str]:
    """Parse a *_Patterns.txt file into a mapping of transaction keys to pattern categories.

    Keys: (timestamp, from_bank, from_account, to_bank, to_account, amount_paid_rounded)
    Values: Pattern category ('FAN-OUT', 'CYCLE', etc.)
    Returns empty dict if the file does not exist.
    """
    p = Path(path)
    if not p.is_file():
        return {}

    import re

    pattern_map = {}
    cur_pattern = None
    with open(p, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            m = re.match(r"^BEGIN LAUNDERING ATTEMPT\s*-\s*([A-Za-z0-9\-]+)", line)
            if m:
                cur_pattern = m.group(1).upper()
                continue
            if line.startswith("END LAUNDERING ATTEMPT"):
                cur_pattern = None
                continue
            if cur_pattern:
                parts = line.split(",")
                if len(parts) >= 8:
                    try:
                        ts = pd.to_datetime(parts[0], format=TIME_FORMAT)
                        from_b = str(parts[1]).strip()
                        from_a = str(parts[2]).strip()
                        to_b = str(parts[3]).strip()
                        to_a = str(parts[4]).strip()
                        amt = round(float(parts[7]), 2)
                        key = (ts, from_b, from_a, to_b, to_a, amt)
                        pattern_map[key] = cur_pattern
                    except Exception:
                        continue
    return pattern_map
