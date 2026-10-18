import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldAlert, 
  AlertTriangle, 
  X, 
  Send, 
  Bot, 
  User, 
  Cpu, 
  Sparkles, 
  AlertOctagon, 
  Info,
  Clock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { ScoreResponse } from '../../services/consumerScoreService';
import { answerUserQuestion, ChatMessage } from '../../services/aiChatService';

interface InFlightSecurityAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  scoreData: ScoreResponse | null;
  amount: number;
  currency: string;
  receiver: string;
  sender: string;
  onCancelPayment: () => void;
  onProceedAnyway: () => void;
}

export const InFlightSecurityAlertModal: React.FC<InFlightSecurityAlertModalProps> = ({
  isOpen,
  onClose,
  scoreData,
  amount,
  currency,
  receiver,
  sender,
  onCancelPayment,
  onProceedAnyway
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initialize micro-chat when modal opens with new score data
  useEffect(() => {
    if (isOpen && scoreData) {
      setShowOverrideConfirm(false);
      const isHighRisk = scoreData.decision === 'HOLD';
      const initialText = isHighRisk
        ? `🚨 Hold recommended for recipient ${scoreData.receiver}. ${scoreData.ai_narrative} No money is sent by this demo. You can ask me anything below.`
        : `⚠️ Step-up verification recommended for recipient ${scoreData.receiver}. ${scoreData.ai_narrative} Feel free to ask me questions.`;

      setMessages([
        {
          id: `ai-init-${Date.now()}`,
          sender: 'AI',
          text: initialText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  }, [isOpen, scoreData?.txn_id]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  if (!isOpen || !scoreData) return null;

  const isMule = scoreData.decision === 'HOLD';
  const riskScore = scoreData.mulenet_score ?? scoreData.risk_score ?? (isMule ? 94 : 68);

  const formatCurrency = (amt: number, curr: string) => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: curr || 'USD',
        maximumFractionDigits: 2
      }).format(amt);
    } catch {
      return `$${amt.toFixed(2)}`;
    }
  };

  const formattedAmount = formatCurrency(amount, currency);

  // Quick clickable prompt chips
  const promptChips = [
    'Is this a scam?',
    'Why does rapid forwarding matter?',
    'Will my payment be blocked if I proceed?'
  ];

  const handleSendMicroChat = (queryText: string) => {
    const q = queryText.trim();
    if (!q) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'USER',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setIsTyping(true);

    setTimeout(() => {
      const reply = answerUserQuestion(q, scoreData);
      const aiReply: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'AI',
        text: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, aiReply]);
      setIsTyping(false);
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className={`w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl border transition-all duration-300 ${
          isMule 
            ? 'bg-slate-950 border-rose-500/50 shadow-rose-950/70 ring-2 ring-rose-500/40' 
            : 'bg-slate-950 border-amber-500/50 shadow-amber-950/60'
        }`}
      >
        {/* 1. Loud, Urgent Header Banner */}
        <div className={`p-4 sm:p-5 text-white border-b relative ${
          isMule 
            ? 'bg-gradient-to-r from-rose-900 via-rose-950 to-slate-950 border-rose-800/60' 
            : 'bg-gradient-to-r from-amber-900 via-amber-950 to-slate-950 border-amber-800/60'
        }`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${
                isMule ? 'bg-rose-600 text-white animate-pulse' : 'bg-amber-500 text-slate-950'
              }`}>
                {isMule ? <ShieldAlert className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                    {isMule ? '🚨 Model recommends: HOLD for review' : '⚠️ Model recommends: step-up verification'}
                  </h2>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    isMule ? 'bg-rose-500/30 text-rose-200 border border-rose-400/40' : 'bg-amber-500/30 text-amber-200 border border-amber-400/40'
                  }`}>
                    Model score: {(riskScore / 100).toFixed(4)}
                  </span>
                </div>

                <p className="text-xs text-slate-300 mt-1 leading-snug">
                  {isMule 
                    ? 'The decision below is the recorded output of the MuleNet model for this recipient. Nothing is sent by this demo.'
                    : 'The model recommends extra verification before releasing funds. This is a recommendation from recorded model output, not a finding of fraud.'
                  }
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors shrink-0"
              title="Close Alert"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Data provenance strip */}
          <div className="mt-3 pt-2.5 border-t border-white/10 flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-300">
            <div className="flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-indigo-400" />
              <span>Real MuleNet model output (replayed from results.csv)</span>
            </div>
            <span className="text-emerald-400 font-semibold">
              {typeof scoreData.model_score === 'number' ? `score ${scoreData.model_score.toFixed(4)}` : ''}
            </span>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-slate-200">
          
          {/* Transaction Metadata Card */}
          <div className="bg-slate-900/90 rounded-2xl p-3 sm:p-4 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                Pending Transfer To
              </span>
              <span className="text-sm sm:text-base font-bold font-mono text-white">
                {receiver}
              </span>
              <span className="text-xs text-slate-400 block mt-0.5">
                From: <span className="font-mono text-slate-300">{sender}</span>
              </span>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                Intercepted Amount
              </span>
              <span className="text-lg sm:text-xl font-black font-mono text-white">
                {formattedAmount}
              </span>
              <span className="text-[10px] text-emerald-400 block font-mono font-medium">
                Protected in Transit
              </span>
            </div>
          </div>

          {/* 2. Core AI Explanation Block (Synthesized Behavioral Explanation) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-300">
              <Sparkles className="h-4 w-4 text-indigo-400" />
              <span>Why This Alert Was Triggered</span>
            </div>

            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans whitespace-pre-line">
              {scoreData.ai_narrative}
            </p>

            {/* Model output */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 font-mono text-xs">
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                <span className="text-[10px] text-slate-500 block">Model score (0 to 1)</span>
                <span className="font-bold text-rose-300 text-xs">
                  {typeof scoreData.model_score === 'number' ? scoreData.model_score.toFixed(4) : 'n/a'}
                </span>
              </div>

              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                <span className="text-[10px] text-slate-500 block">Recommended action</span>
                <span className="font-bold text-rose-300 text-xs">{isMule ? 'Hold for officer' : 'Step-up verification'}</span>
              </div>

              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                <span className="text-[10px] text-slate-500 block">Signals attached</span>
                <span className="font-bold text-amber-300 text-xs">{(scoreData.spam_flags || []).length}</span>
              </div>
            </div>
          </div>

          {/* 3. Interactive "Ask AI" Micro-Chat (Embedded directly in the alert!) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Bot className="h-4 w-4 text-indigo-400" />
                <span>Ask the explainer (template-based, not an LLM)</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                Plain English • Non-Technical
              </span>
            </div>

            {/* Micro-Chat Message Log */}
            <div className="max-h-48 overflow-y-auto space-y-2.5 pr-1 font-sans">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 text-xs ${
                    msg.sender === 'USER' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {msg.sender === 'AI' && (
                    <div className="h-6 w-6 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shrink-0">
                      <Bot className="h-3.5 w-3.5" />
                    </div>
                  )}

                  <div
                    className={`p-2.5 rounded-2xl max-w-[85%] leading-relaxed ${
                      msg.sender === 'USER'
                        ? 'bg-indigo-600 text-white rounded-tr-none'
                        : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-tl-none whitespace-pre-line'
                    }`}
                  >
                    {msg.text}
                  </div>

                  {msg.sender === 'USER' && (
                    <div className="h-6 w-6 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 shrink-0">
                      <User className="h-3.5 w-3.5" />
                    </div>
                  )}
                </div>
              ))}

              {isTyping && (
                <div className="flex items-center gap-2 text-xs text-indigo-400 font-mono">
                  <div className="h-6 w-6 rounded-lg bg-indigo-600/20 flex items-center justify-center">
                    <Bot className="h-3.5 w-3.5 animate-pulse" />
                  </div>
                  <span>MuleNet AI is analyzing...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Clickable Prompt Chips */}
            <div>
              <span className="text-[10px] font-mono text-slate-400 block mb-1.5 uppercase">
                Quick Questions (Tap to Ask):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {promptChips.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMicroChat(chip)}
                    className="px-2.5 py-1 rounded-full bg-slate-950 hover:bg-indigo-950/70 border border-slate-800 hover:border-indigo-500/50 text-[11px] text-slate-300 hover:text-white transition-all cursor-pointer text-left"
                  >
                    💬 {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Micro-Chat Input Box */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMicroChat(inputQuery);
              }}
              className="flex items-center gap-2 pt-1"
            >
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="Ask anything about this safety warning..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <button
                type="submit"
                disabled={!inputQuery.trim()}
                className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-colors cursor-pointer shrink-0"
                title="Send Question"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>

          {/* Autonomy Assurance Note */}
          <p className="text-[11px] text-center text-slate-400 italic">
            Automated blocking is disabled in this mode. You have full autonomy to cancel or proceed.
          </p>
        </div>

        {/* 4. Decision Buttons at Bottom */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/90 space-y-2">
          {/* Primary Button: Cancel Payment & Report */}
          <button
            onClick={onCancelPayment}
            className="w-full py-3.5 px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm sm:text-base tracking-wide shadow-xl shadow-rose-950/60 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <AlertOctagon className="h-5 w-5" />
            <span>🛑 Cancel Payment & Report</span>
          </button>

          {/* Secondary Button: I Know This Person (Send Anyway) */}
          {!showOverrideConfirm ? (
            <button
              onClick={() => setShowOverrideConfirm(true)}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>⚠️ I Know This Person (Send Anyway)</span>
            </button>
          ) : (
            <div className="p-3 rounded-2xl bg-slate-900 border border-rose-500/50 text-center space-y-2 animate-in fade-in duration-150">
              <p className="text-xs text-rose-300 font-medium">
                Are you sure? Once released to a mule account, funds are usually irretrievable.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowOverrideConfirm(false)}
                  className="flex-1 py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-medium cursor-pointer"
                >
                  Keep Money Safe
                </button>
                <button
                  onClick={onProceedAnyway}
                  className="flex-1 py-1.5 px-3 rounded-xl bg-rose-700 hover:bg-rose-600 text-xs text-white font-bold cursor-pointer"
                >
                  Confirm & Transfer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
