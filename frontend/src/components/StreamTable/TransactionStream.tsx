import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  ArrowUpRight, 
  ArrowDownLeft, 
  ChevronRight, 
  Check, 
  Ban, 
  SlidersHorizontal,
  Lock,
  Unlock,
  Eye
} from 'lucide-react';
import { Transaction, DecisionStatus } from '../../types';
import { StatusBadge } from './StatusBadge';

interface TransactionStreamProps {
  transactions: Transaction[];
  selectedTxn: Transaction | null;
  onSelectTxn: (txn: Transaction) => void;
  filterStatus: 'ALL' | DecisionStatus;
  onFilterChange: (status: 'ALL' | DecisionStatus) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onQuickDecision: (txnId: string, action: 'APPROVE' | 'BLOCK') => void;
}

export const TransactionStream: React.FC<TransactionStreamProps> = ({
  transactions,
  selectedTxn,
  onSelectTxn,
  filterStatus,
  onFilterChange,
  searchQuery,
  onSearchChange,
  onQuickDecision
}) => {
  const [autoScrollLocked, setAutoScrollLocked] = useState(false);

  // Status counts for badge tabs
  const counts = {
    all: transactions.length,
    allow: transactions.filter(t => t.decision === 'ALLOW').length,
    review: transactions.filter(t => t.decision === 'REVIEW').length,
    block: transactions.filter(t => t.decision === 'BLOCK').length,
  };

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

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-700/80 rounded-lg overflow-hidden shadow-lg">
      {/* Stream Header & Filters */}
      <div className="p-3 border-b border-slate-700/80 bg-slate-900/90 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-white tracking-tight flex items-center gap-1.5">
              <span>Incoming Transaction Stream</span>
              <span className="text-[11px] font-mono text-slate-400 font-normal">
                ({transactions.length} buffered)
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setAutoScrollLocked(!autoScrollLocked)}
              title={autoScrollLocked ? "Auto-scroll paused (Pinned view)" : "Auto-scroll active"}
              className={`p-1 rounded text-xs border flex items-center gap-1 font-mono transition-colors ${
                autoScrollLocked 
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              {autoScrollLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
              <span className="text-[10px] hidden sm:inline">
                {autoScrollLocked ? 'PINNED' : 'AUTO-SCROLL'}
              </span>
            </button>
          </div>
        </div>

        {/* Filter Tabs & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Status Pills */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded border border-slate-700/80 text-xs font-mono">
            <button
              onClick={() => onFilterChange('ALL')}
              className={`px-2 py-1 rounded transition-colors ${
                filterStatus === 'ALL'
                  ? 'bg-ibm-blue text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ALL
            </button>
            <button
              onClick={() => onFilterChange('ALLOW')}
              className={`px-2 py-1 rounded transition-colors flex items-center gap-1 ${
                filterStatus === 'ALLOW'
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-emerald-400'
              }`}
            >
              <span>ALLOW</span>
              <span className="text-[10px] opacity-75">({counts.allow})</span>
            </button>
            <button
              onClick={() => onFilterChange('REVIEW')}
              className={`px-2 py-1 rounded transition-colors flex items-center gap-1 ${
                filterStatus === 'REVIEW'
                  ? 'bg-amber-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-amber-400'
              }`}
            >
              <span>REVIEW</span>
              <span className="text-[10px] opacity-80 px-1 rounded-full bg-amber-500/30 text-amber-200">
                {counts.review}
              </span>
            </button>
            <button
              onClick={() => onFilterChange('BLOCK')}
              className={`px-2 py-1 rounded transition-colors flex items-center gap-1 ${
                filterStatus === 'BLOCK'
                  ? 'bg-rose-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-rose-400'
              }`}
            >
              <span>BLOCK</span>
              <span className="text-[10px] opacity-80 px-1 rounded-full bg-rose-500/30 text-rose-200">
                {counts.block}
              </span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search Txn ID, counterparty, account..."
              className="w-full bg-slate-950 border border-slate-700/80 rounded pl-8 pr-3 py-1 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-ibm-blue font-sans"
            />
          </div>
        </div>
      </div>

      {/* High-density Transaction Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="sticky top-0 bg-slate-950/95 border-b border-slate-700/90 text-slate-400 font-mono text-[10px] uppercase tracking-wider backdrop-blur-sm z-10">
            <tr>
              <th className="py-2 px-2.5 font-semibold">Txn ID & Time</th>
              <th className="py-2 px-2 font-semibold">Sender (Origin)</th>
              <th className="py-2 px-2 font-semibold">Receiver (Suspect Hub)</th>
              <th className="py-2 px-2 font-semibold text-right">Amount & FX</th>
              <th className="py-2 px-2 font-semibold text-center">Mule Risk</th>
              <th className="py-2 px-2 font-semibold text-center">Status</th>
              <th className="py-2 px-2.5 font-semibold text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-500 font-mono">
                  No matching transactions in stream buffer
                </td>
              </tr>
            ) : (
              transactions.map((txn) => {
                const isSelected = selectedTxn?.id === txn.id;
                const isHighRisk = txn.decision === 'BLOCK';
                const isReview = txn.decision === 'REVIEW';

                return (
                  <tr
                    key={txn.id}
                    onClick={() => onSelectTxn(txn)}
                    className={`cursor-pointer transition-colors duration-150 group select-none ${
                      isSelected
                        ? 'bg-ibm-blue/15 border-l-2 border-l-ibm-cyan text-slate-100'
                        : isHighRisk
                        ? 'hover:bg-rose-950/20 bg-rose-950/5'
                        : isReview
                        ? 'hover:bg-amber-950/20 bg-amber-950/5'
                        : 'hover:bg-slate-800/60'
                    }`}
                  >
                    {/* Txn ID & Time */}
                    <td className="py-2 px-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-medium text-slate-300 text-[11px] group-hover:text-ibm-cyan">
                          {txn.id}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 flex items-center gap-1 mt-0.5">
                        <span>{txn.timestamp}</span>
                        <span>•</span>
                        <span className="text-[9px] text-slate-400">{txn.channel}</span>
                      </div>
                    </td>

                    {/* Sender */}
                    <td className="py-2 px-2 max-w-[150px]">
                      <div className="flex items-center gap-1 truncate text-slate-300 font-medium">
                        <span className="text-xs">{txn.sender.flag}</span>
                        <span className="truncate" title={txn.sender.name}>
                          {txn.sender.name}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 truncate">
                        {txn.sender.bank} • {txn.sender.account}
                      </div>
                    </td>

                    {/* Receiver */}
                    <td className="py-2 px-2 max-w-[150px]">
                      <div className="flex items-center gap-1 truncate text-slate-300 font-medium">
                        <span className="text-xs">{txn.receiver.flag}</span>
                        <span className="truncate" title={txn.receiver.name}>
                          {txn.receiver.name}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 truncate flex items-center gap-1">
                        <span>{txn.receiver.bank}</span>
                        {txn.receiver.isSuspectedMule && (
                          <span className="text-[9px] text-rose-400 font-bold px-1 rounded bg-rose-500/10">
                            SUSPECT
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Amount & Currency */}
                    <td className="py-2 px-2 text-right whitespace-nowrap font-mono tabular-nums">
                      <div className="font-semibold text-slate-200">
                        {formatCurrency(txn.amount, txn.currency)}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {txn.currency}
                      </div>
                    </td>

                    {/* Mule Risk Meter */}
                    <td className="py-2 px-2 text-center whitespace-nowrap">
                      <div className="flex flex-col items-center">
                        <span className={`font-mono text-[11px] font-bold ${
                          txn.muleRiskScore >= 80 
                            ? 'text-rose-400' 
                            : txn.muleRiskScore >= 35 
                            ? 'text-amber-400' 
                            : 'text-emerald-400'
                        }`}>
                          {txn.muleRiskScore}%
                        </span>
                        <div className="w-12 bg-slate-800 rounded-full h-1 mt-0.5 overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              txn.muleRiskScore >= 80 
                                ? 'bg-rose-500' 
                                : txn.muleRiskScore >= 35 
                                ? 'bg-amber-400' 
                                : 'bg-emerald-400'
                            }`}
                            style={{ width: `${txn.muleRiskScore}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Decision Status */}
                    <td className="py-2 px-2 text-center whitespace-nowrap">
                      <StatusBadge status={txn.decision} size="sm" />
                    </td>

                    {/* Quick Action */}
                    <td className="py-2 px-2.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectTxn(txn);
                          }}
                          title="Inspect Mule Deep-Dive"
                          className="p-1 rounded hover:bg-ibm-blue/20 text-slate-400 hover:text-ibm-cyan transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        {txn.decision !== 'ALLOW' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onQuickDecision(txn.id, 'APPROVE');
                            }}
                            title="Quick Approve / Allow"
                            className="p-1 rounded hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400 transition-colors"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {txn.decision !== 'BLOCK' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onQuickDecision(txn.id, 'BLOCK');
                            }}
                            title="Quick Block & Freeze"
                            className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                          >
                            <Ban className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer with Summary Telemetry */}
      <div className="p-2 border-t border-slate-700/80 bg-slate-950 text-[11px] font-mono text-slate-400 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
            Allow: {counts.allow}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
            Review: {counts.review}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400"></span>
            Block: {counts.block}
          </span>
        </div>
        <div className="text-[10px] text-slate-500">
          Click row to inspect risk graph & model attribution
        </div>
      </div>
    </div>
  );
};
