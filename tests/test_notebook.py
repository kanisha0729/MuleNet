"""Tests for mulenet.ipynb.

Unit tests run the notebook's `functions`-tagged cell against tiny fixture files.
The end-to-end test executes the whole notebook against data/raw/ and is skipped
when the data has not been downloaded.

Run: .venv/bin/python -m pytest tests -v        (add -m slow for the end-to-end run)
"""

from pathlib import Path

import nbformat
import pytest
from nbclient import NotebookClient

ROOT = Path(__file__).resolve().parent.parent
NOTEBOOK = ROOT / "mulenet.ipynb"

HEADER = (
    "Timestamp,From Bank,Account,To Bank,Account,Amount Received,Receiving Currency,"
    "Amount Paid,Payment Currency,Payment Format,Is Laundering\n"
)


@pytest.fixture(scope="module")
def fns():
    nb = nbformat.read(NOTEBOOK, as_version=4)
    cells = [c for c in nb.cells if "functions" in c.metadata.get("tags", [])]
    assert len(cells) == 1, "expected exactly one cell tagged 'functions'"
    namespace = {}
    exec(cells[0].source, namespace)
    return namespace


def test_load_transactions_names_both_account_columns(fns, tmp_path):
    csv = tmp_path / "t.csv"
    csv.write_text(
        HEADER
        + "2022/09/01 00:20,010,8000EBD30,001,8000F5340,3697.34,US Dollar,3697.34,US Dollar,Reinvestment,0\n"
        + "2022/09/01 09:14,021174,800737690,020,80006A5E0,35642.49,Yuan,35642.49,Yuan,ACH,1\n"
    )
    df = fns["load_transactions"](csv)

    assert list(df.columns) == fns["COLUMNS"]
    assert df.loc[0, "from_account"] == "8000EBD30"
    assert df.loc[0, "to_account"] == "8000F5340"
    assert df.loc[0, "from_bank"] == "010"  # leading zero kept
    assert df["is_laundering"].tolist() == [0, 1]
    assert str(df["timestamp"].dtype).startswith("datetime64")
    assert df.loc[1, "timestamp"].hour == 9


def test_load_patterns_parses_blocks(fns, tmp_path):
    txt = tmp_path / "p.txt"
    txt.write_text(
        "BEGIN LAUNDERING ATTEMPT - FAN-OUT:  Max 2-degree Fan-Out\n"
        "2022/09/01 00:06,021174,800737690,012,80011F990,2848.96,Euro,2848.96,Euro,ACH,1\n"
        "2022/09/01 04:33,021174,800737690,020,80020C5B0,8630.40,Euro,8630.40,Euro,ACH,1\n"
        "END LAUNDERING ATTEMPT - FAN-OUT\n"
        "\n"
        "BEGIN LAUNDERING ATTEMPT - CYCLE:  Max 3 hops\n"
        "2022/09/02 10:00,001,AAA,002,BBB,10.00,US Dollar,10.00,US Dollar,Wire,1\n"
        "END LAUNDERING ATTEMPT - CYCLE\n"
    )
    df, begins, ends = fns["load_patterns"](txt)

    assert (begins, ends) == (2, 2)
    assert df["attempt"].tolist() == [0, 0, 1]
    assert df["pattern"].tolist() == ["FAN-OUT", "FAN-OUT", "CYCLE"]
    assert df.loc[0, "from_bank"] == "021174"
    assert df.loc[2, "amount_paid"] == 10.0
    assert (df["is_laundering"] == 1).all()


def test_load_patterns_rejects_row_outside_block(fns, tmp_path):
    txt = tmp_path / "p.txt"
    txt.write_text("2022/09/02 10:00,001,AAA,002,BBB,10.00,US Dollar,10.00,US Dollar,Wire,1\n")
    with pytest.raises(ValueError, match="outside a BEGIN/END block"):
        fns["load_patterns"](txt)


@pytest.mark.slow
@pytest.mark.skipif(
    not (ROOT / "data/raw/HI-Small_Trans.csv").is_file(), reason="data/raw not downloaded"
)
def test_notebook_runs_end_to_end():
    nb = nbformat.read(NOTEBOOK, as_version=4)
    NotebookClient(nb, timeout=1800, resources={"metadata": {"path": str(ROOT)}}).execute()

    text = "".join(
        out.get("text", "")
        for cell in nb.cells
        if cell.cell_type == "code"
        for out in cell.get("outputs", [])
    )
    assert "environment: local" in text
    assert "all data checks passed" in text
