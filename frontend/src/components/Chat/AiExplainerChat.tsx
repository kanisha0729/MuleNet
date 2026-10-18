import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Send, 
  Sparkles, 
  User, 
  HelpCircle, 
  MessageSquare, 
  RotateCcw,
  Cpu,
  Info,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert
} from 'lucide-react';
import { ScoreResponse } from '../../services/consumerScoreService';
import { 
  ChatMessage, 
  generateInitialExplanation, 
  answerUserQuestion 
} from '../../services/aiChatService';

interface AiExplainerChatProps {
  currentTransfer: ScoreResponse | null;
}

export const AiExplainerChat: React.FC<AiExplainerChatProps> = ({ currentTransfer }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Suggested question chips
  const suggestedQuestions = [
    'Why do you think this is a scam account?',
    'What happens if I send the money?',
    'How did the system check this without delay?',
    'Is my money safe?',
    'Will my transfer be blocked automatically?',
    'How do I verify the recipient?'
  ];

  // When a new transfer evaluation arrives, automatically add an AI summary bubble
  useEffect(() => {
    if (currentTransfer) {
      const summaryText = generateInitialExplanation(currentTransfer);
      const initialMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        sender: 'AI',
        text: summaryText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages([initialMsg]);
    } else {
      setMessages([
        {
          id: 'welcome-1',
          sender: 'AI',
          text: "Hello! I am a small template-based explainer (not a language model). When you check a transfer, I summarise the model score, decision and signals that the backend returned.",
          timestamp: 'Now'
        }
      ]);
    }
  }, [currentTransfer?.txn_id]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSendMessage = (textToSend: string) => {
    const q = textToSend.trim();
    if (!q) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'USER',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuestion('');
    setIsTyping(true);

    // Simulate AI thinking
    setTimeout(() => {
      const reply = answerUserQuestion(q, currentTransfer);
      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'AI',
        text: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
    }, 450);
  };

  const handleResetChat = () => {
    if (currentTransfer) {
      const summaryText = generateInitialExplanation(currentTransfer);
      setMessages([
        {
          id: `msg-${Date.now()}`,
          sender: 'AI',
          text: summaryText,
          timestamp: 'Reset'
        }
      ]);
    } else {
      setMessages([]);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col h-full shadow-xl backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="p-3.5 px-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
            <Bot className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-white font-sans flex items-center gap-1.5">
                <span>Explainer</span>
              </h3>
              <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.2 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Template-based</span>
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              Conversational risk reasoning in plain English
            </p>
          </div>
        </div>

        <button
          onClick={handleResetChat}
          title="Reset conversation"
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Active Transfer Context Bar */}
      {currentTransfer && (
        <div className="px-3.5 py-2 bg-slate-950 border-b border-slate-800/80 text-[11px] font-mono flex items-center justify-between text-slate-300">
          <div className="flex items-center gap-2 truncate">
            <span className="text-slate-500">Context:</span>
            <span className="font-semibold text-white truncate">{currentTransfer.sender} → {currentTransfer.receiver}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-bold text-white">${currentTransfer.amount.toLocaleString()}</span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
              currentTransfer.decision === 'ALLOW' ? 'text-emerald-400 bg-emerald-500/10' :
              currentTransfer.decision === 'REVIEW' ? 'text-amber-400 bg-amber-500/10' : 'text-rose-400 bg-rose-500/10'
            }`}>
              {typeof currentTransfer.model_score === 'number' ? `score ${currentTransfer.model_score.toFixed(4)}` : currentTransfer.decision}
            </span>
          </div>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 p-3.5 space-y-3 overflow-y-auto max-h-[460px] text-xs">
        {messages.map((msg) => {
          const isAi = msg.sender === 'AI';

          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 animate-in fade-in duration-200 ${
                isAi ? 'justify-start' : 'justify-end'
              }`}
            >
              {isAi && (
                <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-sm">
                  <Bot className="h-3.5 w-3.5" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-3 shadow-sm ${
                  isAi
                    ? 'bg-slate-950 border border-slate-800 text-slate-200 rounded-tl-sm font-sans'
                    : 'bg-indigo-600 text-white rounded-tr-sm font-sans'
                }`}
              >
                <div className="leading-relaxed whitespace-pre-wrap">{msg.text}</div>
                <div
                  className={`text-[9px] font-mono mt-1.5 flex justify-end ${
                    isAi ? 'text-slate-500' : 'text-indigo-200'
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>

              {!isAi && (
                <div className="h-7 w-7 rounded-lg bg-indigo-700 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-sm">
                  <User className="h-3.5 w-3.5" />
                </div>
              )}
            </div>
          );
        })}

        {isTyping && (
          <div className="flex items-center gap-2 text-slate-400 text-xs font-mono py-1 animate-pulse">
            <div className="h-6 w-6 rounded-lg bg-slate-800 flex items-center justify-center text-indigo-400">
              <Bot className="h-3 w-3" />
            </div>
            <span>MuleNet AI is analyzing risk factors...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Question Chips */}
      <div className="p-2.5 px-3 bg-slate-950/70 border-t border-slate-800">
        <div className="text-[10px] font-mono text-slate-400 mb-1.5 flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-amber-400" />
          <span>Ask AI about this transfer:</span>
        </div>

        <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto pr-1">
          {suggestedQuestions.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(q)}
              className="text-[10px] px-2 py-1 rounded-lg bg-slate-900 hover:bg-indigo-600/20 border border-slate-800 hover:border-indigo-500/40 text-slate-300 hover:text-white transition-all text-left flex items-center gap-1 cursor-pointer"
            >
              <span>💡</span>
              <span className="truncate">{q}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Input box */}
      <div className="p-3 bg-slate-950 border-t border-slate-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(inputQuestion);
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputQuestion}
            onChange={(e) => setInputQuestion(e.target.value)}
            placeholder="Ask AI anything about this transfer or risk..."
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 font-sans"
          />
          <button
            type="submit"
            disabled={!inputQuestion.trim() || isTyping}
            className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-colors cursor-pointer shrink-0 shadow-sm"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
