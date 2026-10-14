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
