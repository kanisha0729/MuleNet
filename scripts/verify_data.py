"""Verify the downloaded IBM AML files and print the numbers recorded in summary.md.

Usage: python -I scripts/verify_data.py [data_dir] [prefix]   (defaults: data/raw, HI-Small)
"""

import csv
import os
import sys
from collections import Counter

data_dir = sys.argv[1] if len(sys.argv) > 1 else "data/raw"
prefix = sys.argv[2] if len(sys.argv) > 2 else "HI-Small"
trans_path = os.path.join(data_dir, f"{prefix}_Trans.csv")
patterns_path = os.path.join(data_dir, f"{prefix}_Patterns.txt")

for path in (trans_path, patterns_path):
    if not os.path.isfile(path):
        sys.exit(f"missing: {path}")
    size = os.path.getsize(path)
    print(f"{os.path.basename(path)}: {size:,} bytes ({size / 2**20:.1f} MiB)")

with open(trans_path, newline="") as f:
    reader = csv.reader(f)
    header = next(reader)
    label_idx = header.index("Is Laundering")
    rows = 0
    labels = Counter()
    for row in reader:
        rows += 1
        labels[row[label_idx]] += 1

print(f"header: {','.join(header)}")
print(f"rows (excluding header): {rows:,}")
print(f"Is Laundering = 1: {labels['1']:,} ({labels['1'] / rows:.4%})")
print(f"label values: {dict(labels)}")

begins = Counter()
with open(patterns_path) as f:
    for line in f:
        if line.startswith("BEGIN"):
            # "BEGIN LAUNDERING ATTEMPT - FAN-OUT:  Max 16-degree Fan-Out" -> "FAN-OUT"
            begins[line.split(" - ", 1)[1].split(":", 1)[0].strip()] += 1

print(f"BEGIN blocks: {sum(begins.values()):,}")
for kind, n in begins.most_common():
    print(f"  {kind}: {n:,}")
