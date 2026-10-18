import React, { useState } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  X, 
  CheckCircle2, 
  ArrowRight, 
  Cpu, 
  MessageSquare, 
  AlertOctagon,
  Info,
  ExternalLink,
  Lock
} from 'lucide-react';
import { ScoreResponse } from '../../services/consumerScoreService';

interface SpamAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: ScoreResponse | null;
  onProceed: () => void;
  onCancel: () => void;
  onOpenAiChat?: (initialQuestion?: string) => void;
}

export const SpamAlertModal: React.FC<SpamAlertModalProps> = ({
  isOpen,
  onClose,
  result,
  onProceed,
  onCancel,
  onOpenAiChat
}) => {
  const [showOverrideWarning, setShowOverrideWarning] = useState(false);

  if (!isOpen || !result) return null;

  const isMule = result.decision === 'HOLD';
  const isCaution = result.decision === 'REVIEW';
  const isSafe = result.decision === 'ALLOW';

  const formatCurrency = (amt: number, curr: string) => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: curr || 'USD',
        maximumFractionDigits: 0
      }).format(amt);
    } catch {
      return `$${amt.toLocaleString()}`;
    }
  };

  const formattedAmount = formatCurrency(result.amount, result.currency);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className={`w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl border transition-all duration-300 ${
          isMule 
            ? 'bg-gradient-to-b from-rose-950/90 via-slate-950 to-slate-950 border-rose-500/50 shadow-rose-950/60 ring-2 ring-rose-500/30' 
            : isCaution
            ? 'bg-gradient-to-b from-amber-950/80 via-slate-950 to-slate-950 border-amber-500/50 shadow-amber-950/50'
            : 'bg-gradient-to-b from-emerald-950/80 via-slate-950 to-slate-950 border-emerald-500/50 shadow-emerald-950/50'
        }`}
      >
        {/* Top Header / Banner (Truecaller / Spam Call Detector style) */}
        <div className={`p-6 text-center border-b ${
          isMule 
            ? 'bg-rose-900/40 border-rose-800/50 text-rose-100' 
            : isCaution
            ? 'bg-amber-900/40 border-amber-800/50 text-amber-100'
            : 'bg-emerald-900/40 border-emerald-800/50 text-emerald-100'
        }`}>
          <div className="flex justify-end -mt-2 -mr-2">
            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex flex-col items-center">
            {/* Animated Icon Avatar */}
            <div className={`h-20 w-20 rounded-full flex items-center justify-center mb-3 shadow-lg ${
              isMule
                ? 'bg-rose-600 text-white animate-bounce ring-4 ring-rose-400/40'
                : isCaution
                ? 'bg-amber-500 text-slate-950 ring-4 ring-amber-400/30'
                : 'bg-emerald-500 text-white ring-4 ring-emerald-400/30'
            }`}>
              {isMule && <ShieldAlert className="h-10 w-10" />}
              {isCaution && <AlertTriangle className="h-10 w-10" />}
              {isSafe && <ShieldCheck className="h-10 w-10" />}
            </div>

            {/* Loud Headline */}
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              {isMule && '🚨 HOLD RECOMMENDED'}
              {isCaution && '⚠️ STEP-UP VERIFICATION RECOMMENDED'}
              {isSafe && '🛡️ No alert raised'}
            </h2>

            <p className={`text-sm mt-1 font-medium ${
              isMule ? 'text-rose-200' : isCaution ? 'text-amber-200' : 'text-emerald-200'
            }`}>
              {isMule && 'The MuleNet model flagged this destination for officer review.'}
              {isCaution && 'The model recommends extra verification before sending.'}
              {isSafe && 'Model score is below the alert threshold.'}
            </p>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Recipient & Amount Badge */}
          <div className="bg-slate-900/80 rounded-2xl p-4 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
                Destination Recipient
              </span>
              <span className="text-base font-bold font-mono text-white">
                {result.receiver}
              </span>
              <span className="text-xs text-slate-400 block mt-0.5">
                From: <span className="font-mono text-slate-300">{result.sender}</span>
              </span>
            </div>

            <div className="text-right">
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
                Amount
              </span>
              <span className="text-xl font-black text-white font-mono">
                {formattedAmount}
              </span>
              <span className={`inline-block text-[10px] font-mono font-bold px-2 py-0.5 rounded-full mt-1 ${
                isMule ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' :
                isCaution ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              }`}>
                Model score: {typeof result.model_score === 'number' ? result.model_score.toFixed(4) : 'n/a'}
              </span>
            </div>
          </div>

          {/* Plain-English AI Explanation (Why is it fake?) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 text-indigo-400" />
                Why was this account flagged?
              </span>
              {onOpenAiChat && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenAiChat('Why do you think this is a scam account?');
                  }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <MessageSquare className="h-3 w-3" />
                  <span>Ask MuleNet AI</span>
                </button>
              )}
            </div>

            <div className="space-y-2">
              {(result.spam_flags || []).map((flag, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                    isMule
                      ? 'bg-rose-950/40 border-rose-800/40'
                      : isCaution
                      ? 'bg-amber-950/40 border-amber-800/40'
                      : 'bg-emerald-950/40 border-emerald-800/40'
                  }`}
                >
                  <span className="text-base shrink-0">{isSafe ? '✅' : '🚩'}</span>
                  <p className="text-xs text-slate-300 leading-relaxed">{flag}</p>
                </div>
              ))}
              <p className="text-[11px] text-slate-500">
                Signals are indicators attached by the scoring pipeline, not proof of laundering.
              </p>
            </div>
          </div>

          {/* Data provenance note */}
          <div className="bg-slate-900/60 rounded-xl px-3.5 py-2.5 border border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <div className="flex items-center gap-2">
              <Cpu className="h-3.5 w-3.5 text-indigo-400" />
              <span>Real MuleNet model output (replayed from results.csv)</span>
            </div>
          </div>

          {/* Human-in-the-Loop Autonomous Decision Note */}
          <p className="text-[11px] text-center text-slate-400 italic">
            Nothing is blocked automatically. You have the final decision.
          </p>

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            {isMule ? (
              <>
                {/* Cancel Transfer (Recommended) */}
                <button
                  onClick={onCancel}
                  className="w-full py-3.5 px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm tracking-wide shadow-xl shadow-rose-950/50 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <AlertOctagon className="h-4 w-4" />
                  <span>🛑 Cancel Transfer (Recommended)</span>
                </button>

                {/* Send Anyway Option with Safety Guard */}
                {!showOverrideWarning ? (
                  <button
                    onClick={() => setShowOverrideWarning(true)}
                    className="w-full py-2.5 px-4 text-xs font-medium text-slate-400 hover:text-rose-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>⚠️ I Trust This Person — Send Anyway</span>
                  </button>
                ) : (
                  <div className="p-3 rounded-xl bg-slate-900 border border-rose-500/50 text-center space-y-2 animate-in fade-in duration-150">
                    <p className="text-xs text-rose-300 font-medium">
                      Are you certain? If this is a scam, your funds will NOT be recoverable once sent.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={onCancel}
                        className="flex-1 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-medium cursor-pointer"
                      >
                        Keep Funds Safe
                      </button>
                      <button
                        onClick={onProceed}
                        className="flex-1 py-1.5 px-3 rounded-lg bg-rose-700 hover:bg-rose-600 text-xs text-white font-bold cursor-pointer"
                      >
                        Confirm Override & Send
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : isCaution ? (
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={onCancel}
                  className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Cancel Transfer
                </button>
                <button
                  onClick={onProceed}
                  className="flex-1 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Proceed with Caution</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={onProceed}
                className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm tracking-wide shadow-xl shadow-emerald-950/50 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>Proceed to Pay {formattedAmount}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
