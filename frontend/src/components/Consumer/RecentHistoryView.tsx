import React, { useState } from 'react';
import { 
  Search, 
  ArrowUpRight, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert, 
  Clock, 
  Filter, 
  RotateCcw,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { ScoreResponse } from '../../services/consumerScoreService';

interface RecentHistoryViewProps {
  history: ScoreResponse[];
  onSelectTransfer: (item: ScoreResponse) => void;
  onNewCheck: () => void;
}

export const RecentHistoryView: React.FC<RecentHistoryViewProps> = ({
  history,
  onSelectTransfer,
  onNewCheck
}) => {
  const [filterDecision, setFilterDecision] = useState<'ALL' | 'ALLOW' | 'REVIEW' | 'HOLD'>('ALL');
  const [search, setSearch] = useState('');

  const filtered = (history || []).filter((item) => {
    if (!item) return false;
    const matchesDecision = filterDecision === 'ALL' || item.decision === filterDecision;
    const q = search.toLowerCase().trim();
    const sender = item.sender || '';
    const receiver = item.receiver || '';
    const txnId = item.txn_id || '';
    const narrative = item.ai_narrative || '';

    const matchesSearch = !q || 
      sender.toLowerCase().includes(q) ||
      receiver.toLowerCase().includes(q) ||
      txnId.toLowerCase().includes(q) ||
      narrative.toLowerCase().includes(q);

    return matchesDecision && matchesSearch;
  });

  const formatCurrency = (amt?: number | null, curr?: string | null) => {
    const safeAmt = typeof amt === 'number' && !isNaN(amt) ? amt : 0;
    const safeCurr = (curr && typeof curr === 'string' && curr.length === 3) ? curr.toUpperCase() : 'USD';
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: safeCurr,
        maximumFractionDigits: 0
      }).format(safeAmt);
    } catch {
      return `$${safeAmt.toLocaleString()}`;
    }
  };

  const formatTime = (ts?: string | null) => {
    if (!ts) return 'Recent';
    try {
      const d = new Date(ts);
      return isNaN(d.getTime()) ? 'Recent' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Recent';
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Top Search & Filter Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
              <span>Recent Transfer Evaluations</span>
              <span className="text-xs font-mono font-normal text-slate-400">
                ({filtered.length} records)
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Review history of evaluated accounts, AI explanations, and network behavioral scores.
            </p>
          </div>

          <button
            onClick={onNewCheck}
            className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors self-start sm:self-auto shadow-sm cursor-pointer"
          >
            <span>+ Check New Transfer</span>
          </button>
        </div>

        {/* Filter Pills and Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
          {/* Status Tabs */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setFilterDecision('ALL')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                filterDecision === 'ALL'
                  ? 'bg-indigo-600 text-white font-medium'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              ALL
            </button>
            <button
              onClick={() => setFilterDecision('ALLOW')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                filterDecision === 'ALLOW'
                  ? 'bg-emerald-600 text-white font-medium'
                  : 'text-slate-400 hover:text-emerald-400'
              }`}
            >
              <span>Safe</span>
            </button>
            <button
              onClick={() => setFilterDecision('REVIEW')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                filterDecision === 'REVIEW'
                  ? 'bg-amber-600 text-white font-medium'
                  : 'text-slate-400 hover:text-amber-400'
              }`}
            >
              <span>Caution</span>
            </button>
            <button
              onClick={() => setFilterDecision('HOLD')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                filterDecision === 'HOLD'
                  ? 'bg-rose-600 text-white font-medium'
                  : 'text-slate-400 hover:text-rose-400'
              }`}
            >
              <span>Hold</span>
            </button>
          </div>

          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by account ID or explanation..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 font-sans"
            />
          </div>
        </div>
      </div>

      {/* Cards List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center text-slate-500 text-sm font-mono">
            No transfer checks match your current filter.
          </div>
        ) : (
          filtered.map((item) => {
            const isSafe = item.decision === 'ALLOW';
            const isCaution = item.decision === 'REVIEW';
            const isHold = item.decision === 'HOLD';
            const fanIn = item.metrics?.fan_in_count ?? 1;
            const fanOut = item.metrics?.fan_out_count ?? 1;
            const timeSince = item.metrics?.time_since_deposit ?? '3.2 days';
            const ratio = item.metrics?.outflow_inflow_ratio ?? '8%';

            return (
              <div
                key={item.txn_id || Math.random().toString()}
                onClick={() => onSelectTransfer(item)}
                className="bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-lg transition-all cursor-pointer group space-y-3"
              >
                {/* Header row: Account & Amount */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-xl shrink-0 ${
                      isSafe ? 'bg-emerald-500/10 text-emerald-400' :
                      isCaution ? 'bg-amber-500/10 text-amber-400' : 'bg-rose-500/15 text-rose-400'
                    }`}>
                      {isSafe && <CheckCircle2 className="h-4 w-4" />}
                      {isCaution && <AlertTriangle className="h-4 w-4" />}
                      {isHold && <ShieldAlert className="h-4 w-4" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-white">
                          {item.sender}
                        </span>
                        <span className="text-slate-500 text-xs">→</span>
                        <span className="font-mono text-xs font-semibold text-white">
                          {item.receiver}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">
                        {item.txn_id} • {formatTime(item.timestamp)}
                      </span>
                    </div>
                  </div>

                  {/* Amount and Status Pill */}
                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <span className="font-mono text-sm font-bold text-white tabular-nums">
                      {formatCurrency(item.amount, item.currency)}
                    </span>
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold border ${
                      isSafe ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                      isCaution ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                      'bg-rose-500/15 text-rose-400 border-rose-500/35'
                    }`}>
                      {isSafe ? 'Safe / ALLOW' : (isCaution ? 'Caution / REVIEW' : 'Action / HOLD')}
                    </span>
                  </div>
                </div>

                {/* AI Explanation Paragraph */}
                <div className="text-xs text-slate-300 font-sans leading-relaxed flex items-start gap-2 bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/60">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-400 shrink-0 mt-0.5" />
                  <span>{item.ai_narrative || 'Replayed model output.'}</span>
                </div>

                {/* Feature Evidence Badges */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                    <span className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400">
                      Inflow: <span className="text-slate-200 font-semibold">{fanIn} senders</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400">
                      Outflow: <span className="text-slate-200 font-semibold">{fanOut} recipients</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400">
                      Velocity: <span className="text-slate-200 font-semibold">{timeSince}</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400">
                      Pass-Through: <span className="text-slate-200 font-semibold">{ratio}</span>
                    </span>
                  </div>

                  <div className="text-xs text-indigo-400 group-hover:text-indigo-300 font-mono flex items-center gap-1">
                    <span>Re-evaluate</span>
                    <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
