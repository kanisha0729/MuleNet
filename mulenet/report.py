"""Self-contained HTML report (no external requests, so it works offline on LinuxONE)."""

import datetime as dt
import html
import json
from pathlib import Path

import numpy as np

W, H = 640, 340
PAD = {"l": 52, "r": 16, "t": 16, "b": 44}
MULE_BADGE = '<span class="st critical">● laundering</span>'
CLEAN_BADGE = '<span class="st muted">○ none found</span>'


def _esc(value) -> str:
    return html.escape(str(value))


def _pct(x: float) -> str:
    return f"{100 * x:.1f}%"


def _tile(label: str, value: str, note: str = "") -> str:
    note_html = f'<div class="tile-note">{_esc(note)}</div>' if note else ""
    return f'<div class="tile"><div class="tile-label">{_esc(label)}</div><div class="tile-value">{_esc(value)}</div>{note_html}</div>'


def _sample_curve(precision, recall, thresholds, n=400):
    """Keep at most n points, evenly spaced in recall, always keeping the end points."""
    if len(recall) <= n:
        idx = np.arange(len(recall))
    else:
        targets = np.linspace(recall[0], recall[-1], n)
        idx = np.unique(np.r_[0, np.searchsorted(recall, targets).clip(0, len(recall) - 1), len(recall) - 1])
    return [
        {"r": round(float(recall[i]), 4), "p": round(float(precision[i]), 4), "t": round(float(thresholds[i]), 5)}
        for i in idx
    ]


def _pr_svg(points, op) -> str:
    iw, ih = W - PAD["l"] - PAD["r"], H - PAD["t"] - PAD["b"]
    x = lambda r: PAD["l"] + r * iw  # noqa: E731
    y = lambda p: PAD["t"] + (1 - p) * ih  # noqa: E731
    grid, ticks = [], []
    for v in (0, 0.25, 0.5, 0.75, 1.0):
        grid.append(f'<line class="grid" x1="{PAD["l"]}" x2="{W - PAD["r"]}" y1="{y(v):.1f}" y2="{y(v):.1f}"/>')
        ticks.append(f'<text class="tick" x="{PAD["l"] - 8}" y="{y(v) + 4:.1f}" text-anchor="end">{v:.2f}</text>')
        ticks.append(f'<text class="tick" x="{x(v):.1f}" y="{H - PAD["b"] + 18}" text-anchor="middle">{v:.2f}</text>')
    path = "M" + " L".join(f"{x(pt['r']):.1f},{y(pt['p']):.1f}" for pt in points)
    ox, oy = x(op["recall"]), y(op["precision"])
    anchor = "end" if op["recall"] > 0.6 else "start"
    dx = -12 if anchor == "end" else 12
    return f"""
<svg id="pr" viewBox="0 0 {W} {H}" role="img" aria-label="Precision-recall curve on this check set">
  {''.join(grid)}
  <line class="axis" x1="{PAD['l']}" x2="{W - PAD['r']}" y1="{y(0):.1f}" y2="{y(0):.1f}"/>
  {''.join(ticks)}
  <text class="axis-title" x="{PAD['l'] + iw / 2:.1f}" y="{H - 6}" text-anchor="middle">Recall</text>
  <text class="axis-title" transform="translate(14 {PAD['t'] + ih / 2:.1f}) rotate(-90)" text-anchor="middle">Precision</text>
  <path class="series" d="{path}"/>
  <circle class="op-ring" cx="{ox:.1f}" cy="{oy:.1f}" r="6"/>
  <circle class="op" cx="{ox:.1f}" cy="{oy:.1f}" r="4"/>
  <text class="op-label" x="{ox + dx:.1f}" y="{oy - 10:.1f}" text-anchor="{anchor}">alert threshold {op['threshold']:.3f}</text>
  <line id="pr-cross" class="cross" y1="{PAD['t']}" y2="{y(0):.1f}" visibility="hidden"/>
  <circle id="pr-dot" class="hover-dot" r="4" visibility="hidden"/>
  <rect id="pr-hit" x="{PAD['l']}" y="{PAD['t']}" width="{iw}" height="{ih}" fill="transparent" tabindex="0"
        aria-label="Move along the curve to read precision, recall and threshold"/>
</svg>"""


def _importance_bars(meta) -> str:
    gain = meta.get("feature_importance_gain", {})
    if not gain:
        return ""
    total = sum(gain.values())
    top = list(gain.items())[:12]
    rows = []
    for name, g in top:
        share = g / total
        rows.append(
            f'<div class="bar-row" tabindex="0" data-tip="{_esc(name)}: {_pct(share)} of total gain">'
            f'<span class="bar-name">{_esc(name)}</span>'
            f'<span class="bar-track"><span class="bar" style="width:{100 * share / (top[0][1] / total):.1f}%"></span></span>'
            f'<span class="bar-val">{_pct(share)}</span></div>'
        )
    return "".join(rows)


def _metrics_table(meta) -> str:
    rows = []
    for key, m in meta.get("metrics", {}).items():
        t, a = m["transactions"], m["accounts"]
        rows.append(
            f"<tr><td>{_esc(key)}</td>"
            + "".join(f"<td class='num'>{v}</td>" for v in (
                f"{t['rows']:,}", f"{t['positives']:,}", f"{t['pr_auc']:.3f}", f"{t['f1']:.3f}",
                f"{t['precision']:.3f}", f"{t['recall']:.3f}", f"{a['pr_auc']:.3f}", f"{a['precision_at_100']:.2f}",
            ))
            + "</tr>"
        )
    return "".join(rows)


def write_report(path, result, meta, pr, accounts, scored) -> None:
    precision, recall, thresholds = pr
    points = _sample_curve(precision, recall, thresholds)
    t, a = result["transactions"], result["accounts"]
    op = {"precision": t["precision"], "recall": t["recall"], "threshold": result["threshold"]}

    parity_cls = "good" if result["parity_ok"] else "critical"
    parity_icon = "✓" if result["parity_ok"] else "✕"
    parity_text = (
        f"Scores match the training machine (max difference {result['parity_max_abs_diff']:.2g})"
        if result["parity_ok"]
        else f"Scores differ from the training machine by up to {result['parity_max_abs_diff']:.3g}"
    )

    top = accounts.head(25)
    counts = scored.assign(alert=scored["score"] >= result["threshold"])
    alerts_by_acct = (
        counts.melt(id_vars=["alert"], value_vars=["from_account", "to_account"], value_name="account")
        .groupby("account")["alert"].sum()
    )
    acct_rows = "".join(
        f"<tr><td class='num'>{i}</td><td class='mono'>{_esc(acct)}</td><td class='num'>{row.score:.3f}</td>"
        f"<td class='num'>{int(alerts_by_acct.get(acct, 0))}</td><td class='num'>{row.txns}</td>"
        f"<td>{MULE_BADGE if row.is_mule else CLEAN_BADGE}</td></tr>"
        for i, (acct, row) in enumerate(top.iterrows(), start=1)
    )
    curve_rows = "".join(
        f"<tr><td class='num'>{pt['t']:.4f}</td><td class='num'>{pt['p']:.3f}</td><td class='num'>{pt['r']:.3f}</td></tr>"
        for pt in points[:: max(1, len(points) // 25)]
    )
    period = f"{scored['timestamp'].min()} to {scored['timestamp'].max()}" if len(scored) else "empty"

    doc = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>mulenet scoring report</title>
<style>
:root {{
  color-scheme: light;
  --page: #f9f9f7; --surface: #fcfcfb; --ink: #0b0b0b; --ink-2: #52514e; --muted: #898781;
  --grid: #e1e0d9; --axis: #c3c2b7; --border: rgba(11,11,11,0.10);
  --series-1: #2a78d6; --good: #0ca30c; --good-text: #006300; --critical: #d03b3b;
}}
@media (prefers-color-scheme: dark) {{
  :root:not([data-theme="light"]) {{
    color-scheme: dark;
    --page: #0d0d0d; --surface: #1a1a19; --ink: #ffffff; --ink-2: #c3c2b7; --muted: #898781;
    --grid: #2c2c2a; --axis: #383835; --border: rgba(255,255,255,0.10);
    --series-1: #3987e5; --good-text: #0ca30c;
  }}
}}
:root[data-theme="dark"] {{
  color-scheme: dark;
  --page: #0d0d0d; --surface: #1a1a19; --ink: #ffffff; --ink-2: #c3c2b7; --muted: #898781;
  --grid: #2c2c2a; --axis: #383835; --border: rgba(255,255,255,0.10);
  --series-1: #3987e5; --good-text: #0ca30c;
}}
* {{ box-sizing: border-box; }}
body {{ margin: 0; background: var(--page); color: var(--ink);
  font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }}
main {{ max-width: 980px; margin: 0 auto; padding: 32px 16px 64px; }}
h1 {{ font-size: 26px; margin: 0 0 4px; }}
h2 {{ font-size: 17px; margin: 0 0 12px; }}
.sub {{ color: var(--ink-2); margin: 0 0 20px; }}
.card {{ background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-top: 16px; }}
.banner {{ display: flex; gap: 10px; align-items: center; font-weight: 600; }}
.banner .icon {{ display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; color: #fff; font-size: 13px; }}
.banner.good .icon {{ background: var(--good); }} .banner.good {{ color: var(--good-text); }}
.banner.critical .icon {{ background: var(--critical); }} .banner.critical {{ color: var(--critical); }}
.tiles {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }}
.tile {{ border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; }}
.tile-label {{ color: var(--ink-2); font-size: 13px; }}
.tile-value {{ font-size: 26px; font-weight: 600; }}
.tile-note {{ color: var(--muted); font-size: 12px; }}
.hint {{ color: var(--ink-2); font-size: 13px; margin: 8px 0 0; }}
.chart-wrap {{ position: relative; }}
svg {{ width: 100%; height: auto; display: block; }}
.grid {{ stroke: var(--grid); stroke-width: 1; }}
.axis {{ stroke: var(--axis); stroke-width: 1; }}
.tick {{ fill: var(--muted); font-size: 12px; font-variant-numeric: tabular-nums; }}
.axis-title {{ fill: var(--ink-2); font-size: 12px; }}
.series {{ fill: none; stroke: var(--series-1); stroke-width: 2; stroke-linejoin: round; }}
.op {{ fill: var(--series-1); }} .op-ring {{ fill: var(--surface); }}
.op-label {{ fill: var(--ink); font-size: 12px; font-weight: 600; }}
.cross {{ stroke: var(--muted); stroke-width: 1; }}
.hover-dot {{ fill: var(--series-1); stroke: var(--surface); stroke-width: 2; }}
#pr-hit:focus {{ outline: none; }}
.tip {{ position: absolute; pointer-events: none; background: var(--surface); border: 1px solid var(--border);
  border-radius: 8px; padding: 8px 10px; font-size: 13px; box-shadow: 0 4px 16px rgba(0,0,0,.12); white-space: nowrap; }}
.tip strong {{ font-size: 15px; }}
.tip .k {{ color: var(--ink-2); }}
.bar-row {{ display: grid; grid-template-columns: minmax(120px, 210px) 1fr 56px; gap: 10px; align-items: center; padding: 3px 0; }}
.bar-row:hover .bar, .bar-row:focus .bar {{ filter: brightness(1.15); }}
.bar-name {{ font-family: ui-monospace, monospace; font-size: 12px; color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; }}
.bar-track {{ height: 14px; }}
.bar {{ display: block; height: 100%; background: var(--series-1); border-radius: 0 4px 4px 0; min-width: 2px; }}
.bar-val {{ text-align: right; font-size: 12px; font-variant-numeric: tabular-nums; color: var(--ink-2); }}
.table-wrap {{ overflow-x: auto; }}
table {{ border-collapse: collapse; width: 100%; font-size: 13px; }}
th, td {{ text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--grid); }}
th {{ color: var(--ink-2); font-weight: 600; }}
td.num, th.num {{ text-align: right; font-variant-numeric: tabular-nums; }}
.mono {{ font-family: ui-monospace, monospace; }}
.st.critical {{ color: var(--critical); }} .st.muted {{ color: var(--muted); }}
details summary {{ cursor: pointer; color: var(--ink-2); font-size: 13px; margin-top: 10px; }}
</style></head>
<body><main>
<h1>mulenet scoring report</h1>
<p class="sub">{_esc(Path(result['check_set']).name)} · {t['rows']:,} transactions, {_esc(period)} · backend {_esc(result['backend'])} · model trained {_esc(meta.get('created', '?'))} · report {dt.datetime.now().isoformat(timespec='seconds')}</p>

<div class="card banner {parity_cls}"><span class="icon" aria-hidden="true">{parity_icon}</span><span>{_esc(parity_text)}</span></div>

<div class="card">
  <h2>Transactions</h2>
  <div class="tiles">
    {_tile('PR-AUC', f"{t['pr_auc']:.3f}", 'ranking quality, threshold-free')}
    {_tile('F1 (laundering)', f"{t['f1']:.3f}", f"at threshold {result['threshold']:.3f}")}
    {_tile('Precision', _pct(t['precision']), f"{t['tp']:,} of {t['alerts']:,} alerts")}
    {_tile('Recall', _pct(t['recall']), f"{t['tp']:,} of {t['positives']:,} laundering")}
  </div>
  <p class="hint">Threshold was chosen on the validation days (best F1) and is fixed for scoring.</p>
</div>

<div class="card">
  <h2>Mule accounts</h2>
  <div class="tiles">
    {_tile('Account PR-AUC', f"{a['pr_auc']:.3f}", 'account score = its riskiest transaction')}
    {_tile('Precision @ 100', _pct(a['precision_at_100']), 'of the 100 riskiest accounts')}
    {_tile('Mule accounts', f"{a['mules']:,}", f"of {a['accounts']:,} active accounts")}
  </div>
</div>

<div class="card">
  <h2>Precision vs recall</h2>
  <div class="chart-wrap" id="pr-wrap">{_pr_svg(points, op)}<div class="tip" id="pr-tip" hidden></div></div>
  <details><summary>Show as table</summary><div class="table-wrap"><table>
    <thead><tr><th class="num">Threshold</th><th class="num">Precision</th><th class="num">Recall</th></tr></thead>
    <tbody>{curve_rows}</tbody></table></div></details>
</div>

<div class="card">
  <h2>Top flagged accounts</h2>
  <div class="table-wrap"><table>
    <thead><tr><th class="num">#</th><th>Account (bank_account)</th><th class="num">Max score</th><th class="num">Alerts</th><th class="num">Transactions</th><th>Ground truth</th></tr></thead>
    <tbody>{acct_rows}</tbody></table></div>
  <p class="hint">Top 1,000 accounts are also written to alerts.csv next to this report.</p>
</div>

<div class="card">
  <h2>What drives the model</h2>
  <div class="chart-wrap" id="imp-wrap">{_importance_bars(meta)}<div class="tip" id="imp-tip" hidden></div></div>
  <p class="hint">Share of total split gain, top 12 features.</p>
</div>

<div class="card">
  <h2>Training-time evaluation</h2>
  <div class="table-wrap"><table>
    <thead><tr><th>Split</th><th class="num">Rows</th><th class="num">Laundering</th><th class="num">PR-AUC</th><th class="num">F1</th><th class="num">Precision</th><th class="num">Recall</th><th class="num">Acct PR-AUC</th><th class="num">Acct P@100</th></tr></thead>
    <tbody>{_metrics_table(meta)}</tbody></table></div>
  <p class="hint">LI-Small/test is scored by the HI-trained model with the HI threshold (robustness check).</p>
</div>
</main>
<script>
const PTS = {json.dumps(points)};
(() => {{
  const svg = document.getElementById("pr"), hit = document.getElementById("pr-hit");
  const cross = document.getElementById("pr-cross"), dot = document.getElementById("pr-dot");
  const tip = document.getElementById("pr-tip"), wrap = document.getElementById("pr-wrap");
  const L = {PAD['l']}, IW = {W - PAD['l'] - PAD['r']}, T = {PAD['t']}, IH = {H - PAD['t'] - PAD['b']};
  let idx = 0;
  function show(i) {{
    idx = Math.max(0, Math.min(PTS.length - 1, i));
    const p = PTS[idx], x = L + p.r * IW, y = T + (1 - p.p) * IH;
    cross.setAttribute("x1", x); cross.setAttribute("x2", x); cross.setAttribute("visibility", "visible");
    dot.setAttribute("cx", x); dot.setAttribute("cy", y); dot.setAttribute("visibility", "visible");
    tip.replaceChildren();
    for (const [k, v] of [["precision", p.p.toFixed(3)], ["recall", p.r.toFixed(3)], ["threshold", p.t.toFixed(4)]]) {{
      const row = document.createElement("div"), s = document.createElement("strong"), l = document.createElement("span");
      s.textContent = v; l.className = "k"; l.textContent = " " + k; row.append(s, l); tip.append(row);
    }}
    tip.hidden = false;
    const scale = svg.getBoundingClientRect().width / {W};
    const left = x * scale + 12, maxLeft = wrap.clientWidth - tip.offsetWidth;
    tip.style.left = (left > maxLeft ? x * scale - tip.offsetWidth - 12 : left) + "px";
    tip.style.top = Math.max(0, y * scale - tip.offsetHeight / 2) + "px";
  }}
  function nearest(r) {{
    let best = 0;
    for (let i = 1; i < PTS.length; i++) if (Math.abs(PTS[i].r - r) < Math.abs(PTS[best].r - r)) best = i;
    return best;
  }}
  function hide() {{ tip.hidden = true; cross.setAttribute("visibility", "hidden"); dot.setAttribute("visibility", "hidden"); }}
  hit.addEventListener("pointermove", e => {{
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const loc = pt.matrixTransform(svg.getScreenCTM().inverse());
    show(nearest((loc.x - L) / IW));
  }});
  hit.addEventListener("pointerleave", hide);
  hit.addEventListener("focus", () => show(idx));
  hit.addEventListener("blur", hide);
  hit.addEventListener("keydown", e => {{
    if (e.key === "ArrowRight") {{ show(idx + 1); e.preventDefault(); }}
    if (e.key === "ArrowLeft") {{ show(idx - 1); e.preventDefault(); }}
  }});

  const itip = document.getElementById("imp-tip"), iwrap = document.getElementById("imp-wrap");
  for (const row of iwrap.querySelectorAll(".bar-row")) {{
    const on = () => {{
      itip.textContent = row.dataset.tip; itip.hidden = false;
      itip.style.left = "0px"; itip.style.top = (row.offsetTop - itip.offsetHeight - 4) + "px";
    }};
    row.addEventListener("pointerenter", on); row.addEventListener("focus", on);
    row.addEventListener("pointerleave", () => itip.hidden = true); row.addEventListener("blur", () => itip.hidden = true);
  }}
}})();
</script>
</body></html>
"""
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(doc)
