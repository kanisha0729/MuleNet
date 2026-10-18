import React, { useState } from 'react';
import { 
  X, 
  FileText, 
  Copy, 
  Check, 
  Send, 
  ShieldAlert, 
  Download,
  AlertCircle 
} from 'lucide-react';
import { Transaction, SARReport } from '../../types';

interface SarExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  onFileSAR: (txn: Transaction, notes: string) => Promise<SARReport | null>;
}

export const SarExportModal: React.FC<SarExportModalProps> = ({
  isOpen,
  onClose,
  transaction,
  onFileSAR
}) => {
  const [sarReport, setSarReport] = useState<SARReport | null>(null);
  const [analystStatement, setAnalystStatement] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedNarrative, setCopiedNarrative] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen || !transaction) return null;

  const handleGenerate = async () => {
    setIsGenerating(true);
    const report = await onFileSAR(transaction, analystStatement);
    setSarReport(report);
    setIsGenerating(false);
  };

  const copyToClipboard = (text: string, isNarrative: boolean) => {
    navigator.clipboard.writeText(text);
    if (isNarrative) {
      setCopiedNarrative(true);
      setTimeout(() => setCopiedNarrative(false), 2000);
    } else {
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                <span>Suspicious Activity Report (SAR) draft generator</span>
              </h3>
              <p className="text-xs text-slate-400 font-sans">
                Draft text for analyst review. Nothing is filed with any authority.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Target Transaction Summary */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
            <div>
              <span className="text-slate-500 block text-[10px]">TRANSACTION ID</span>
              <span className="font-bold text-ibm-cyan">{transaction.id}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">AMOUNT AUDITED</span>
              <span className="font-bold text-white">
                {transaction.amount.toLocaleString()} {transaction.currency}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">MULE RISK SCORE</span>
              <span className="font-bold text-rose-400">{transaction.muleRiskScore}/100</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">STATUS</span>
              <span className="font-bold text-amber-400">{transaction.decision}</span>
            </div>
          </div>

          {!sarReport ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">
                  Compliance Officer's Investigative Statement & Context:
                </label>
                <textarea
                  value={analystStatement}
                  onChange={(e) => setAnalystStatement(e.target.value)}
                  placeholder="Analyst notes to include in the draft..."
                  rows={4}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-ibm-blue font-sans resize-none"
                />
              </div>

              <div className="bg-slate-950/70 border border-slate-800/80 rounded p-3 text-xs text-slate-400 font-mono space-y-1">
                <div className="text-slate-200 font-bold flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-ibm-cyan" />
                  <span>Automated Evidence to be Attached:</span>
                </div>
                <div>• Model score and decision for the transaction</div>
                <div>• Signals the scoring pipeline attached to it</div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full py-2.5 rounded bg-ibm-blue hover:bg-ibm-hover text-white font-mono text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <FileText className="h-4 w-4" />
                <span>{isGenerating ? 'Generating draft...' : 'Generate SAR draft'}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Generated SAR Details */}
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-mono text-slate-400">Filing status:</span>
                  <span className="font-mono text-xs font-bold text-emerald-400">{sarReport.fincenTrackingNo}</span>
                </div>

                <div className="text-xs font-mono text-slate-300">
                  <span className="text-slate-500">Typology: </span>
                  <span className="text-rose-400 font-bold">{sarReport.suspiciousActivityType}</span>
                </div>

                {/* Narrative Statement */}
                <div>
                  <div className="flex items-center justify-between mb-1 mt-2">
                    <span className="text-[11px] font-mono text-slate-400 uppercase">Part V - Narrative Summary</span>
                    <button
                      onClick={() => copyToClipboard(sarReport.narrativeSummary, true)}
                      className="text-[10px] font-mono text-ibm-cyan hover:underline flex items-center gap-1"
                    >
                      {copiedNarrative ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedNarrative ? 'Copied Narrative' : 'Copy Narrative'}</span>
                    </button>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded p-2.5 text-xs text-slate-300 font-sans leading-relaxed">
                    {sarReport.narrativeSummary}
                  </div>
                </div>

                {/* Ring Evidence */}
                <div>
                  <span className="text-[11px] font-mono text-slate-400 uppercase block mb-1">
                    Forensic Indicators & Graph Evidence:
                  </span>
                  <ul className="list-disc list-inside text-xs font-mono text-slate-400 space-y-0.5">
                    {sarReport.muleRingEvidence.map((ev, i) => (
                      <li key={i}><span className="text-slate-300">{ev}</span></li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyToClipboard(JSON.stringify(sarReport, null, 2), false)}
                  className="flex-1 py-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-mono font-medium flex items-center justify-center gap-1.5 transition-colors"
                >
                  {copiedJson ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedJson ? 'JSON Copied' : 'Copy SAR JSON'}</span>
                </button>

                <button
                  onClick={() => {
                    setSubmitted(true);
                    setTimeout(() => {
                      setSubmitted(false);
                      onClose();
                    }, 1800);
                  }}
                  disabled={submitted}
                  className="flex-1 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-md"
                >
                  {submitted ? <Check className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
                  <span>{submitted ? 'Transmitted to FIU Gateway!' : 'Submit to Regulatory Gateway'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
