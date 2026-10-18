import React from 'react';
import { 
  Cpu, 
  ShieldCheck, 
  PieChart, 
  DollarSign, 
  TrendingUp, 
  Server, 
  HardDrive 
} from 'lucide-react';
import { SystemTelemetry } from '../../types';

interface SystemMetricsProps {
  telemetry: SystemTelemetry | null;
}

export const SystemMetrics: React.FC<SystemMetricsProps> = ({ telemetry }) => {
  if (!telemetry) return null;

  const totalDecisions = 
    telemetry.decisionCounts.allow + 
    telemetry.decisionCounts.review + 
    telemetry.decisionCounts.block || 1;

  const allowPct = ((telemetry.decisionCounts.allow / totalDecisions) * 100).toFixed(1);
  const reviewPct = ((telemetry.decisionCounts.review / totalDecisions) * 100).toFixed(1);
  const blockPct = ((telemetry.decisionCounts.block / totalDecisions) * 100).toFixed(1);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      {/* 1. Data source */}
      <div className="bg-slate-900 border border-slate-700/80 rounded-lg p-3 flex flex-col justify-between shadow-md">
        <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
          <span className="flex items-center gap-1.5 font-semibold text-slate-200">
            <Server className="h-3.5 w-3.5 text-ibm-cyan" />
            <span>Data source</span>
          </span>
          <span className="text-[10px] text-amber-400">{telemetry.modelMetrics ? 'REPLAY' : 'SIMULATED'}</span>
        </div>
        <div className="space-y-1.5 text-xs font-mono text-slate-300">
          <div className="text-[11px]">
            {telemetry.modelMetrics
              ? 'Real MuleNet model output replayed from results/results.csv (IBM AML HI-Small test stream).'
              : 'Mock generator: invented accounts and scores. Not model output.'}
          </div>
        </div>
      </div>

      {/* 2. Decision Ratio Distribution */}
      <div className="bg-slate-900 border border-slate-700/80 rounded-lg p-3 flex flex-col justify-between shadow-md">
        <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
          <span className="flex items-center gap-1.5 font-semibold text-slate-200">
            <PieChart className="h-3.5 w-3.5 text-amber-400" />
            <span>Decision Ratio</span>
          </span>
          <span className="text-[10px] text-slate-400">Real-Time</span>
        </div>

        <div>
          {/* Multi-segment bar */}
          <div className="w-full h-3 rounded-full overflow-hidden flex bg-slate-950 mb-2">
            <div style={{ width: `${allowPct}%` }} className="bg-emerald-500" title={`Allow: ${allowPct}%`} />
            <div style={{ width: `${reviewPct}%` }} className="bg-amber-500" title={`Review: ${reviewPct}%`} />
            <div style={{ width: `${blockPct}%` }} className="bg-rose-500" title={`Block: ${blockPct}%`} />
          </div>

          <div className="grid grid-cols-3 text-center text-[10px] font-mono">
            <div>
              <span className="text-emerald-400 font-bold block">{allowPct}%</span>
              <span className="text-slate-500">Allow</span>
            </div>
            <div>
              <span className="text-amber-400 font-bold block">{reviewPct}%</span>
              <span className="text-slate-500">Review</span>
            </div>
            <div>
              <span className="text-rose-400 font-bold block">{blockPct}%</span>
              <span className="text-slate-500">Block</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Model quality (held-out test set, from artifacts/meta.json) */}
      <div className="bg-slate-900 border border-slate-700/80 rounded-lg p-3 flex flex-col justify-between shadow-md">
        <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1">
          <span className="flex items-center gap-1.5 font-semibold text-slate-200">
            <TrendingUp className="h-3.5 w-3.5 text-ibm-blue" />
            <span>Model quality (held-out test)</span>
          </span>
        </div>
        {telemetry.modelMetrics ? (
          <div className="text-xs font-mono text-slate-200 space-y-0.5">
            <div>PR-AUC <span className="font-bold text-amber-300">{telemetry.modelMetrics.testPrAuc?.toFixed(3)}</span></div>
            <div>Precision <span className="font-bold text-amber-300">{telemetry.modelMetrics.testPrecision?.toFixed(3)}</span> | Recall <span className="font-bold text-amber-300">{telemetry.modelMetrics.testRecall?.toFixed(3)}</span></div>
            <div className="text-[10px] text-slate-500">HI-Small test split, alert threshold {telemetry.modelMetrics.threshold?.toFixed(4)}</div>
          </div>
        ) : (
          <div className="text-xs font-mono text-slate-500">n/a (simulated data)</div>
        )}
      </div>

      {/* 4. Total Monitored Capital */}
      <div className="bg-slate-900 border border-slate-700/80 rounded-lg p-3 flex flex-col justify-between shadow-md">
        <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1">
          <span className="flex items-center gap-1.5 font-semibold text-slate-200">
            <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
            <span>Monitored Capital</span>
          </span>
          <span className="text-[10px] text-slate-500 font-mono">USD</span>
        </div>

        <div>
          <div className="text-2xl font-bold font-mono text-emerald-400 tabular-nums tracking-tight">
            ${(telemetry.totalVolumeUSD / 1_000_000).toFixed(2)}M
          </div>
          <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between mt-0.5">
            <span>{telemetry.totalTransactionsProcessed.toLocaleString()} txns</span>
            <span className="text-slate-500">{telemetry.modelMetrics ? 'replayed' : 'simulated'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
