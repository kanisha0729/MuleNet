"""CLI: python -m mulenet {train,export-check,score}"""

import argparse
import json
import sys


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="mulenet", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("train", help="train on HI-Small, evaluate, save artifacts")
    p.add_argument("--data-dir", default="data/raw")
    p.add_argument("--artifacts", default="artifacts")

    p = sub.add_parser("export-check", help="write the test-window check set")
    p.add_argument("--data-dir", default="data/raw")
    p.add_argument("--artifacts", default="artifacts")
    p.add_argument("--prefix", default="HI-Small", choices=["HI-Small", "LI-Small"])
    p.add_argument("--out", default=None, help="default: data/check/<prefix>_check.csv.gz")

    p = sub.add_parser("score", help="score a check set and write the HTML report (runs on LinuxONE)")
    p.add_argument("--check", default="data/check/HI-Small_check.csv.gz")
    p.add_argument("--artifacts", default="artifacts")
    p.add_argument("--backend", default="xgboost", choices=["xgboost", "onnx"])
    p.add_argument("--report", default="reports/report.html")

    args = parser.parse_args(argv)
    log = lambda msg: print(msg, file=sys.stderr, flush=True)  # noqa: E731

    from . import pipeline

    if args.command == "train":
        meta = pipeline.train(args.data_dir, args.artifacts, log=log)
        print(json.dumps(meta["metrics"], indent=2))
    elif args.command == "export-check":
        out = args.out or f"data/check/{args.prefix}_check.csv.gz"
        pipeline.export_check(args.data_dir, args.artifacts, out, prefix=args.prefix, log=log)
    elif args.command == "score":
        result = pipeline.score(args.check, args.artifacts, args.report, backend=args.backend, log=log)
        print(json.dumps(result, indent=2))
        if not result["parity_ok"]:
            log(f"PARITY FAILED: max |score diff| {result['parity_max_abs_diff']:.3g} > {pipeline.TOLERANCE}")
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
