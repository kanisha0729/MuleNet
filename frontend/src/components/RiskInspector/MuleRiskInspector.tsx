import React, { useState } from 'react';
import { 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  FileCheck, 
  UserCheck, 
  Building2, 
  CreditCard, 
  Clock, 
  Zap, 
  FileText, 
  ArrowRight,
  ShieldBan,
  SendHorizontal
} from 'lucide-react';
import { Transaction, MuleTypology } from '../../types';
import { RiskGauge } from './RiskGauge';
import { FeatureAttribution } from './FeatureAttribution';
import { StatusBadge } from '../StreamTable/StatusBadge';

interface MuleRiskInspectorProps {
  transaction: Transaction | null;
  onDecision: (txnId: string, action: 'APPROVE' | 'BLOCK' | 'KYC_STEPUP', notes: string) => void;
  onOpenSAR: (txn: Transaction) => void;
}

export const MuleRiskInspector: React.FC<MuleRiskInspectorProps> = ({
  transaction,
  onDecision,
  onOpenSAR
}) => {
  const [analystNotes, setAnalystNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!transaction) {
    return (
      <div className="bg-slate-900 border border-slate-700/80 rounded-lg p-8 flex flex-col items-center justify-center text-slate-500 font-mono text-center h-full">
        <ShieldAlert className="h-10 w-10 text-slate-700 mb-2" />
        <p className="text-sm">Select a transaction from the live stream to inspect mule risk</p>
      </div>
    );
  }

  const handleAction = async (action: 'APPROVE' | 'BLOCK' | 'KYC_STEPUP') => {
    setIsSubmitting(true);
    await onDecision(transaction.id, action, analystNotes);
    setAnalystNotes('');
    setIsSubmitting(false);
  };

  const getTypologyLabel = (typ: string) => {
    switch (typ) {
      case 'RAPID_DISPERSAL':
        return { label: 'Rapid In-and-Out Dispersal', color: 'bg-rose-500/20 text-rose-300 border-rose-500/40' };
      case 'STRUCTURING_SMURF':
        return { label: 'Layered Structuring (Smurfing)', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40' };
      case 'DORMANT_ACTIVATION':
        return { label: 'Dormant Account Re-activation', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
      case 'CROSS_BORDER_FUNNEL':
        return { label: 'Cross-Border Funnel Corridor', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' };
      case 'SYNTHETIC_IDENTITY':
        return { label: 'Synthetic Identity Mule Node', color: 'bg-rose-500/20 text-rose-300 border-rose-500/40' };
      default:
        return { label: 'Standard Commercial Transit', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
    }
  };

  const isReal = transaction.modelDecision !== undefined;
  const typoInfo = isReal
    ? {
        label:
          transaction.typology === 'CLEAN'
            ? 'No alert'
            : transaction.typology === 'MODEL_FLAGGED'
            ? 'Flagged (no topology tag)'
            : `Graph topology: ${transaction.typology}`,
        color:
          transaction.decision === 'ALLOW'
            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
            : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
      }
    : getTypologyLabel(transaction.typology);

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-700/80 rounded-lg overflow-hidden shadow-lg">
      {/* Top Header of Selected Transaction */}
      <div className="p-3 border-b border-slate-700/80 bg-slate-900/90 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono font-bold text-sm text-white">
              {transaction.id}
            </span>
            <StatusBadge status={transaction.decision} size="md" />
            {transaction.humanReviewed && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-ibm-blue/20 text-ibm-cyan border border-ibm-blue/40 flex items-center gap-1">
                <UserCheck className="h-3 w-3" />
                <span>REVIEWED</span>
              </span>
            )}
          </div>
          <span className="text-slate-500 text-xs">•</span>
          <span className="text-xs text-slate-400 font-mono">
            {transaction.channel} ({transaction.timestamp})
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-[11px] font-mono bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-slate-300 flex items-center gap-1">
            <Zap className="h-3 w-3 text-ibm-cyan" />
            <span>{isReal ? 'Source:' : 'SIMULATED latency:'}</span>
            <span className="text-emerald-400 font-bold">{isReal ? 'results.csv (real model output)' : `${transaction.latencyMs} ms`}</span>
          </div>

          <button
            onClick={() => onOpenSAR(transaction)}
            className="px-2.5 py-1 rounded bg-ibm-blue/20 hover:bg-ibm-blue/30 border border-ibm-blue/50 text-ibm-cyan text-xs font-mono font-medium flex items-center gap-1.5 transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>SAR draft (not filed)</span>
          </button>
        </div>
      </div>

      {/* Main Inspection Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Upper Row: Radial Gauge + Typology & Account Routing */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Radial Gauge & Typology: 4 cols */}
          <div className="md:col-span-4 bg-slate-950/80 border border-slate-800 rounded-lg p-3 flex flex-col items-center justify-between">
            <div className="w-full flex items-center justify-between text-[11px] font-mono text-slate-400 border-b border-slate-800/80 pb-1.5 mb-2">
              <span>{isReal ? 'Model score x100' : 'Mule Prediction Score (simulated)'}</span>
              <span className="text-slate-500">{isReal ? 'not a probability' : 'mock'}</span>
            </div>

            <RiskGauge
              score={transaction.muleRiskScore}
              size={150}
              decision={isReal ? transaction.decision : undefined}
              valueLabel={isReal ? transaction.muleRiskScore.toFixed(1) : undefined}
            />

            <div className="w-full mt-2 pt-2 border-t border-slate-800/80 text-center">
              <div className="text-[10px] text-slate-400 font-mono mb-1 uppercase tracking-wider">
                Predicted Archetype
              </div>
              <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-mono font-semibold border ${typoInfo.color}`}>
                {typoInfo.label}
              </span>
            </div>
          </div>

          {/* Account Routing & Counterparties: 8 cols */}
          <div className="md:col-span-8 bg-slate-950/80 border border-slate-800 rounded-lg p-3 flex flex-col justify-between">
            <div>
              <div className="text-[11px] font-mono text-slate-400 border-b border-slate-800/80 pb-1.5 mb-2.5 flex items-center justify-between">
                <span>Transaction & Counterparty Dossier</span>
                <span className="font-mono text-white text-xs font-bold">
                  {(() => {
                    const c = (transaction.currency && transaction.currency.length === 3) ? transaction.currency : 'USD';
                    try {
                      return transaction.amount.toLocaleString('en-US', { style: 'currency', currency: c });
                    } catch {
                      return `$${transaction.amount.toLocaleString()}`;
                    }
                  })()}
                </span>
              </div>

              {/* Sender & Receiver Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {/* Sender (Origin) */}
                <div className="bg-slate-900 border border-slate-800 rounded p-2 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono mb-1">
                    <span className="uppercase tracking-wider">Originating Account</span>
                    <span>{transaction.sender.flag} {transaction.sender.country}</span>
                  </div>
                  <div className="font-semibold text-slate-200 text-xs truncate" title={transaction.sender.name}>
                    {transaction.sender.name}
                  </div>
                  <div className="font-mono text-[11px] text-slate-400 truncate mt-0.5">
                    {transaction.sender.account}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-1 pt-1 border-t border-slate-800 flex justify-between">
                    <span>{transaction.sender.bank}</span>
                    <span className="text-slate-400">{transaction.sender.kycTier}</span>
                  </div>
                </div>

                {/* Receiver (Suspect Mule Node) */}
                <div className={`rounded p-2 flex flex-col justify-between border ${
                  transaction.receiver.isSuspectedMule 
                    ? 'bg-rose-950/20 border-rose-500/40 text-slate-200' 
                    : 'bg-slate-900 border-slate-800 text-slate-200'
                }`}>
                  <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono mb-1">
                    <span className="uppercase tracking-wider text-rose-400 font-bold">
                      Beneficiary (Target Hub)
                    </span>
                    <span>{transaction.receiver.flag} {transaction.receiver.country}</span>
                  </div>
                  <div className="font-semibold text-white text-xs truncate" title={transaction.receiver.name}>
                    {transaction.receiver.name}
                  </div>
                  <div className="font-mono text-[11px] text-slate-300 truncate mt-0.5">
                    {transaction.receiver.account}
                  </div>
                  <div className="text-[10px] font-mono mt-1 pt-1 border-t border-slate-800 flex justify-between">
                    <span className="text-slate-400">{transaction.receiver.bank}</span>
                    <span className="text-rose-400 font-semibold">
                      Graph Centrality: {transaction.receiver.degreeCentrality}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Rule Alerts / Compliance Triggers */}
            {transaction.ruleAlerts.length > 0 && (
              <div className="mt-2.5 pt-2 border-t border-slate-800/80">
                <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-amber-400" />
                  <span>Automated Rule Violations & Triggers</span>
                </div>
                <div className="space-y-1">
                  {transaction.ruleAlerts.map((alert, i) => (
                    <div 
                      key={i}
                      className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/25 text-amber-300 flex items-center gap-1.5"
                    >
                      <span className="text-amber-500">•</span>
                      <span>{alert}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Feature attribution (mock data only) / dataset label (real data) */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3">
          {transaction.features.length > 0 ? (
            <FeatureAttribution features={transaction.features} />
          ) : (
            <div className="text-xs font-mono text-slate-300 space-y-1">
              <div className="text-slate-400">Evaluation reveal (the model never sees this label)</div>
              <div>
                Dataset ground truth:{' '}
                <span className={transaction.datasetLabel === 1 ? 'text-rose-300 font-bold' : 'text-emerald-300 font-bold'}>
                  {transaction.datasetLabel === 1 ? 'laundering' : 'not laundering'}
                </span>{' '}
                | Model decision: <span className="font-bold">{transaction.modelDecision}</span>
              </div>
              <div className="text-slate-500">
                Per-feature attribution is not available in this replay; the alert signals above are what the pipeline recorded.
              </div>
            </div>
          )}
        </div>

        {/* Human In The Loop (HITL) Decision Console */}
        <div className="bg-slate-950 border border-ibm-blue/40 rounded-lg p-3 shadow-inner">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-white">
              <UserCheck className="h-4 w-4 text-ibm-cyan" />
              <span>Human-In-The-Loop (HITL) Operator Decision Console</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              Desk: Tier-2 Financial Crimes Unit
            </span>
          </div>

          {/* Notes Input */}
          <div className="mb-2.5">
            <textarea
              value={analystNotes}
              onChange={(e) => setAnalystNotes(e.target.value)}
              placeholder="Enter compliance justification notes, KYC verification notes, or reason for block..."
              rows={2}
              className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-ibm-blue font-sans resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleAction('APPROVE')}
              disabled={isSubmitting}
              className="flex-1 py-1.5 px-3 rounded bg-emerald-600/90 hover:bg-emerald-500 text-white font-mono text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>APPROVE & RELEASE FUNDS</span>
            </button>

            <button
              onClick={() => handleAction('KYC_STEPUP')}
              disabled={isSubmitting}
              className="py-1.5 px-3 rounded bg-amber-600/90 hover:bg-amber-500 text-white font-mono text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>STEP-UP 2FA / KYC</span>
            </button>

            <button
              onClick={() => handleAction('BLOCK')}
              disabled={isSubmitting}
              className="flex-1 py-1.5 px-3 rounded bg-rose-600/90 hover:bg-rose-500 text-white font-mono text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm shadow-rose-900/50 disabled:opacity-50"
            >
              <ShieldBan className="h-3.5 w-3.5" />
              <span>BLOCK & FREEZE ACCOUNT</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
