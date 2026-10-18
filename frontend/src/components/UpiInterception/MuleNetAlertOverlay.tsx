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
  CheckCircle2,
  Lock,
  ArrowRight
} from 'lucide-react';
import { ScoreResponse } from '../../services/consumerScoreService';
import { answerUserQuestion, ChatMessage } from '../../services/aiChatService';

interface MuleNetAlertOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  scoreData: ScoreResponse | null;
  amount: number;
  currency: string;
  receiverVpa: string;
  upiApp: 'GPAY' | 'PHONEPE' | 'PAYTM';
  onCancelPayment: () => void;
  onProceedAnyway: () => void;
}

export const MuleNetAlertOverlay: React.FC<MuleNetAlertOverlayProps> = ({
  isOpen,
  onClose,
  scoreData,
  amount,
  currency,
  receiverVpa,
  upiApp,
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
        ? `🚨 Payment paused. The MuleNet model recommends holding transfers to ${scoreData.receiver} for officer review. ${scoreData.ai_narrative} Nothing is sent by this demo.`
        : `⚠️ Caution: the MuleNet model recommends step-up verification for ${scoreData.receiver}. ${scoreData.ai_narrative} Ask me anything below before deciding.`;

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
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: curr === 'USD' ? 'USD' : curr === 'EUR' ? 'EUR' : 'INR',
        maximumFractionDigits: 0
      }).format(amt);
    } catch {
      return `₹${amt.toLocaleString()}`;
    }
  };

  const formattedAmount = formatCurrency(amount, currency);

  // Quick clickable prompt chips
  const promptChips = [
    'Why is this recipient dangerous?',
    'Is my account safe?',
    'What is a money mule?'
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

  const getAppName = () => {
    if (upiApp === 'GPAY') return 'UPI App A';
    if (upiApp === 'PHONEPE') return 'UPI App B';
    return 'UPI App C';
  };

  return (
    <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md animate-in fade-in duration-200 p-2 sm:p-4">
      <div 
        className={`w-full max-w-lg max-h-[92%] flex flex-col rounded-3xl overflow-hidden shadow-2xl border transition-all duration-300 ${
          isMule 
            ? 'bg-slate-950 border-rose-500/60 shadow-rose-950/80 ring-2 ring-rose-500/40' 
            : 'bg-slate-950 border-amber-500/60 shadow-amber-950/70'
        }`}
      >
        {/* 1. Loud, Urgent Security Alert Banner */}
        <div className={`p-4 text-white border-b relative ${
          isMule 
            ? 'bg-gradient-to-r from-rose-950 via-rose-900 to-slate-950 border-rose-800/60' 
            : 'bg-gradient-to-r from-amber-950 via-amber-900 to-slate-950 border-amber-800/60'
        }`}>
          {/* Interception Badge */}
          <div className="flex items-center justify-between mb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-900/90 border border-slate-700/80 text-[10px] font-mono text-indigo-300 font-semibold">
              <ShieldAlert className="h-3 w-3 text-rose-400" />
              <span>Intercepted from {getAppName()}</span>
            </span>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
              title="Close Alert"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-start gap-3">
            <div className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${
              isMule ? 'bg-rose-600 text-white animate-pulse' : 'bg-amber-500 text-slate-950'
            }`}>
              {isMule ? <ShieldAlert className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
            </div>

            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                {isMule ? '🚨 Model recommends: HOLD for review' : '⚠️ Model recommends: step-up verification'}
              </h2>
              <p className="text-xs text-rose-200/90 mt-0.5 leading-snug">
                Payment paused in this mock-up. The decision below is the recorded output of the MuleNet model; nothing is sent.
              </p>
            </div>
          </div>

          {/* Data provenance strip */}
          <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-slate-300">
            <div className="flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-indigo-400" />
              <span>Real MuleNet model output (replayed from results.csv)</span>
            </div>
            <span className="text-emerald-400 font-bold">
              {typeof scoreData.model_score === 'number' ? `score ${scoreData.model_score.toFixed(4)}` : ''}
            </span>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-slate-200">
          
          {/* Risk Score Meter & Details */}
          <div className="bg-slate-900/90 rounded-2xl p-3.5 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                  Flagged Recipient VPA
                </span>
                <span className="text-sm font-bold font-mono text-white">
                  {receiverVpa}
                </span>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                  Amount Paused
                </span>
                <span className="text-base font-bold font-mono text-rose-300">
                  {formattedAmount}
                </span>
              </div>
            </div>

            {/* Risk Gauge Bar */}
            <div className="pt-1">
              <div className="flex justify-between text-[11px] font-mono mb-1">
                <span className="text-slate-400">Model score (0 to 1):</span>
                <span className={`font-bold ${isMule ? 'text-rose-400' : 'text-amber-400'}`}>
                  {(riskScore / 100).toFixed(4)}
                </span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    isMule ? 'bg-gradient-to-r from-amber-500 to-rose-500' : 'bg-amber-400'
                  }`}
                  style={{ width: `${riskScore}%` }}
                />
              </div>
            </div>
          </div>

          {/* 2. Core AI Explanation (Why Was It Flagged?) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-300">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              <span>Why MuleNet Flagged This Recipient</span>
            </div>

            <p className="text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-line">
              {scoreData.ai_narrative}
            </p>

            {/* Model output */}
            <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
              <div className="bg-slate-950 p-2 rounded-xl border border-slate-800/80">
                <span className="text-[9px] text-slate-500 block">Model score (0 to 1)</span>
                <span className="font-bold text-rose-300">
                  {typeof scoreData.model_score === 'number' ? scoreData.model_score.toFixed(4) : 'n/a'}
                </span>
              </div>
              <div className="bg-slate-950 p-2 rounded-xl border border-slate-800/80">
                <span className="text-[9px] text-slate-500 block">Recommended action</span>
                <span className="font-bold text-rose-300">{isMule ? 'Hold for officer' : 'Step-up verification'}</span>
              </div>
            </div>
          </div>

          {/* 3. Interactive "Ask MuleNet AI" Assistant Inside the Pop-up */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 flex flex-col space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Bot className="h-3.5 w-3.5 text-indigo-400" />
                <span>Ask the explainer (template-based)</span>
              </span>
              <span className="text-[9px] font-mono text-slate-400">
                Plain English Explainer
              </span>
            </div>

            {/* Micro-Chat Message Log */}
            <div className="max-h-36 overflow-y-auto space-y-2 pr-1 font-sans text-xs">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2 ${
                    msg.sender === 'USER' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {msg.sender === 'AI' && (
                    <div className="h-5 w-5 rounded-md bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shrink-0 mt-0.5">
                      <Bot className="h-3 w-3" />
                    </div>
                  )}

                  <div
                    className={`p-2 rounded-xl max-w-[85%] leading-relaxed ${
                      msg.sender === 'USER'
                        ? 'bg-indigo-600 text-white rounded-tr-none'
                        : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-tl-none whitespace-pre-line text-[11px]'
                    }`}
                  >
                    {msg.text}
                  </div>

                  {msg.sender === 'USER' && (
                    <div className="h-5 w-5 rounded-md bg-slate-800 flex items-center justify-center text-slate-300 shrink-0 mt-0.5">
                      <User className="h-3 w-3" />
                    </div>
                  )}
                </div>
              ))}

              {isTyping && (
                <div className="flex items-center gap-1.5 text-[11px] text-indigo-400 font-mono">
                  <Bot className="h-3 w-3 animate-pulse" />
                  <span>MuleNet AI is answering...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Clickable Prompt Chips */}
            <div>
              <span className="text-[9px] font-mono text-slate-400 block mb-1 uppercase">
                Tap to Ask:
              </span>
              <div className="flex flex-wrap gap-1">
                {promptChips.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMicroChat(chip)}
                    className="px-2 py-0.5 rounded-full bg-slate-950 hover:bg-indigo-950/70 border border-slate-800 hover:border-indigo-500/50 text-[10px] text-slate-300 hover:text-white transition-all cursor-pointer text-left"
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
              className="flex items-center gap-1.5 pt-0.5"
            >
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="Ask the explainer about this result..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <button
                type="submit"
                disabled={!inputQuery.trim()}
                className="p-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-colors cursor-pointer shrink-0"
                title="Send"
              >
                <Send className="h-3 w-3" />
              </button>
            </form>
          </div>
        </div>

        {/* 4. Two User Choices (Decision Buttons) */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950/95 space-y-1.5">
          {/* Primary High-Contrast Button: Cancel & Protect My Money */}
          <button
            onClick={onCancelPayment}
            className="w-full py-3 px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs sm:text-sm tracking-wide shadow-lg shadow-rose-950/70 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <AlertOctagon className="h-4 w-4" />
            <span>🛑 Cancel & Protect My Money (Recommended)</span>
          </button>

          {/* Secondary Ghost Button: I Know This Recipient (Proceed Anyway) */}
          {!showOverrideConfirm ? (
            <button
              onClick={() => setShowOverrideConfirm(true)}
              className="w-full py-1.5 px-3 rounded-xl text-[11px] font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-all flex items-center justify-center gap-1 cursor-pointer"
            >
              <span>⚠️ I Know This Recipient (Proceed Anyway)</span>
            </button>
          ) : (
            <div className="p-2.5 rounded-xl bg-slate-900 border border-rose-500/50 text-center space-y-1.5 animate-in fade-in duration-150">
              <p className="text-[11px] text-rose-300 font-medium">
                Are you sure? Stolen funds sent to a mule account cannot be reversed once withdrawn.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowOverrideConfirm(false)}
                  className="flex-1 py-1 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 font-medium cursor-pointer"
                >
                  Keep Money Safe
                </button>
                <button
                  onClick={onProceedAnyway}
                  className="flex-1 py-1 px-2 rounded-lg bg-rose-700 hover:bg-rose-600 text-[11px] text-white font-bold cursor-pointer"
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
