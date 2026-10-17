import json
from pathlib import Path

ROOT = Path("/home/benny/Projects/mulenet")

modules = [
    "__init__.py",
    "data.py",
    "features.py",
    "gnn.py",
    "model.py",
    "streaming.py",
    "pipeline.py",
    "report.py",
]

module_sources = {}
for m in modules:
    module_sources[m] = (ROOT / "mulenet" / m).read_text(encoding="utf-8")

setup_code = """# Step 1: Install prerequisite packages on Kaggle
!pip install -q torch-geometric onnx onnxmltools onnxruntime
"""

package_code = f'''# Step 2: Unpack the upgraded MuleNet package (107 features, GNN, O(1) state store)
import os
from pathlib import Path

os.makedirs("mulenet", exist_ok=True)
os.makedirs("artifacts", exist_ok=True)
os.makedirs("data/check", exist_ok=True)
os.makedirs("reports", exist_ok=True)

modules = {json.dumps(module_sources, indent=2)}

for filename, source in modules.items():
    (Path("mulenet") / filename).write_text(source, encoding="utf-8")

print(f"Extracted {len(modules)} MuleNet modules into ./mulenet/")
'''

find_data_code = """# Step 3: Locate Dataset
import os
from pathlib import Path

REQUIRED_FILES = ["HI-Small_Trans.csv", "HI-Small_Patterns.txt"]
ON_KAGGLE = "KAGGLE_KERNEL_RUN_TYPE" in os.environ or Path("/kaggle/input").is_dir()

def find_data_dir() -> Path:
    if ON_KAGGLE:
        hits = sorted(Path("/kaggle/input").rglob(REQUIRED_FILES[0]))
        if not hits:
            raise FileNotFoundError("Dataset not attached: verify dataset_sources in kernel-metadata.json")
        return hits[0].parent
    for candidate in (Path("data/raw"), Path("../data/raw")):
        if (candidate / REQUIRED_FILES[0]).is_file():
            return candidate.resolve()
    raise FileNotFoundError("data/raw/ not found")

DATA_DIR = find_data_dir()
print(f"Environment: {'Kaggle' if ON_KAGGLE else 'Local'}")
print(f"Data directory: {DATA_DIR}")
"""

train_code = """# Step 4: Run MuleNet Training
import sys
if "." not in sys.path:
    sys.path.insert(0, ".")

import json
from mulenet import pipeline

print("=" * 60)
print("STARTING MULENET TRAINING (GNN + XGBOOST + 107 CAUSAL FEATURES)")
print("=" * 60)

meta = pipeline.train(DATA_DIR, "artifacts")

print("\\n" + "=" * 60)
print("TRAINING METRICS SUMMARY")
print("=" * 60)
print(json.dumps(meta["metrics"], indent=2))
"""

export_score_code = """# Step 5: Export Check Set and Benchmark Inference with ONNX
print("=" * 60)
print("EXPORTING TEST-SPLIT CHECK SET")
print("=" * 60)

check_path = pipeline.export_check(DATA_DIR, "artifacts", "data/check/HI-Small_check.csv.gz", prefix="HI-Small")

print("\\n" + "=" * 60)
print("BENCHMARKING & SCORING WITH ONNX RUNTIME")
print("=" * 60)

result = pipeline.score(check_path, "artifacts", "reports/report.html", backend="onnx")
print(json.dumps(result, indent=2))
"""

verify_code = """# Step 6: Verify Generated Output Files
import os

print("\\nGenerated files in artifacts/:")
if os.path.exists("artifacts"):
    for f in os.listdir("artifacts"):
        print(" -", f)

print("\\nGenerated files in reports/:")
if os.path.exists("reports"):
    for f in os.listdir("reports"):
        print(" -", f)

print("\\nGenerated files in data/check/:")
if os.path.exists("data/check"):
    for f in os.listdir("data/check"):
        print(" -", f)
"""

cells = [
    {
        "cell_type": "markdown",
        "metadata": {},
        "source": [
            "# MuleNet: Multi-Task Causal GNN & XGBoost Hybrid for Money Mule Detection\n",
            "\n",
            "This notebook trains the 107-feature MuleNet pipeline on the IBM Transactions for AML dataset (`HI-Small` split with `LI-Small` cross-distribution evaluation), exports bit-identical ONNX model artifacts, and benchmarks real-time sub-millisecond inference.\n"
        ]
    },
    {"cell_type": "code", "execution_count": None, "metadata": {}, "outputs": [], "source": [setup_code]},
    {"cell_type": "code", "execution_count": None, "metadata": {}, "outputs": [], "source": [package_code]},
    {"cell_type": "code", "execution_count": None, "metadata": {}, "outputs": [], "source": [find_data_code]},
    {"cell_type": "code", "execution_count": None, "metadata": {}, "outputs": [], "source": [train_code]},
    {"cell_type": "code", "execution_count": None, "metadata": {}, "outputs": [], "source": [export_score_code]},
    {"cell_type": "code", "execution_count": None, "metadata": {}, "outputs": [], "source": [verify_code]},
]

nb = {
    "cells": cells,
    "metadata": {
        "kernelspec": {
            "display_name": "Python 3",
            "language": "python",
            "name": "python3"
        },
        "language_info": {
            "name": "python",
            "version": "3.11.0"
        }
    },
    "nbformat": 4,
    "nbformat_minor": 5
}

out_path = ROOT / "mulenet.ipynb"
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(nb, f, indent=1)

print(f"Generated {out_path} ({len(cells)} cells)")
