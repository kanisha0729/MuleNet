import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  ArrowRight, 
  Lock, 
  Wallet, 
  Smartphone, 
  CheckCircle2, 
  RotateCcw, 
  Building, 
  CreditCard, 
  RefreshCw,
  Sparkles,
  User,
  ExternalLink,
  ChevronRight,
  Send,
  Zap,
  Coffee,
  Users
} from 'lucide-react';
import { 
  scoreTransferApi, 
  checkBackendHealth, 
  ScoreResponse 
} from '../../services/consumerScoreService';
import { UserProfile } from '../../types/auth';
import { InFlightSecurityAlertModal } from './InFlightSecurityAlertModal';

interface MobileBankingCheckoutProps {
  currentUser: UserProfile;
  onLogout: () => void;
  onSwitchToEnterprise?: () => void;
}

export const MobileBankingCheckout: React.FC<MobileBankingCheckoutProps> = ({
  currentUser,
  onLogout,
  onSwitchToEnterprise
}) => {
  // Input State
  const [receiver, setReceiver] = useState('0048308_811E3C9F0');
  const [receiverName, setReceiverName] = useState('Account 0048308_811E3C9F0');
  const [amount, setAmount] = useState('50.00');
  const [currency, setCurrency] = useState<'USD' | 'EUR' | 'INR'>('USD');
  const [note, setNote] = useState('Payment for online freelance task');

  // Balance & Transfer state
  const [balance, setBalance] = useState(currentUser.balance || 24850.00);
  const [isProcessing, setIsProcessing] = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);

  // In-Flight Modal & Result state
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [currentScore, setCurrentScore] = useState<ScoreResponse | null>(null);

  // Success / Receipt State
  const [successReceipt, setSuccessReceipt] = useState<{
    txn_id: string;
    amount: number;
    currency: string;
    receiver: string;
    receiverName: string;
    timestamp: string;
    latencyMs: number;
  } | null>(null);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Check backend health periodically
  useEffect(() => {
    let isMounted = true;
    const check = async () => {
      const ok = await checkBackendHealth();
      if (isMounted) setBackendOnline(ok);
    };
    check();
    const interval = setInterval(check, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Quick preset triggers
  const handleSelectPreset = (type: 'SAFE' | 'UNVERIFIED' | 'MULE') => {
    setSuccessReceipt(null);
    if (type === 'SAFE') {
      setReceiver('0021884_8087CC340');
      setReceiverName('Account 0021884_8087CC340');
      setAmount('36.55');
      setCurrency('USD');
      setNote('Real transaction from the IBM test stream');
    } else if (type === 'UNVERIFIED') {
      setReceiver('0221891_810B24C80');
      setReceiverName('Account 0221891_810B24C80');
      setAmount('248.86');
      setCurrency('USD');
      setNote('Real transaction from the IBM test stream');
    } else if (type === 'MULE') {
      setReceiver('0048308_811E3C9F0');
      setReceiverName('Account 0048308_811E3C9F0');
      setAmount('14161.55');
      setCurrency('USD');
      setNote('Real flagged transaction (CYCLE pattern)');
    }
  };

  // Main "Pay Now" Handler (The In-Flight Interception Engine)
  const handlePayNow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiver.trim() || !amount) return;

    setIsProcessing(true);
    setSuccessReceipt(null);

    const numericAmount = parseFloat(amount) || 50.0;
    const startTime = performance.now();

    // Look up the real model output for this recipient via /score
    const scoreResult = await scoreTransferApi({
      txn_id: `TXN_${Date.now()}`,
      sender: currentUser.accountNumber || 'ACC_10492',
      receiver: receiver.trim(),
      amount: numericAmount,
      currency
    });

    const elapsed = Math.round(performance.now() - startTime);
    if (scoreResult.decision === 'UNSCORED') {
      setIsProcessing(false);
      setToastMessage(scoreResult.status_text);
      setTimeout(() => setToastMessage(null), 5000);
      return;
    }
    setCurrentScore(scoreResult);
    setIsProcessing(false);

    // If Safe (Low Risk): Instant Success Receipt
    if (scoreResult.decision === 'ALLOW') {
      setBalance((prev) => Math.max(0, prev - numericAmount));
      setSuccessReceipt({
        txn_id: scoreResult.txn_id,
        amount: numericAmount,
        currency,
        receiver: receiver.trim(),
        receiverName,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        latencyMs: elapsed
      });
      setToastMessage('Verified Safe Destination — Transfer Completed');
      setTimeout(() => setToastMessage(null), 4000);
    } else {
      // If High Risk or Medium Risk: Pop up In-Flight Security Alert Modal immediately!
      setIsAlertOpen(true);
    }
  };

  // When user cancels payment from the alert modal
  const handleCancelFromAlert = () => {
    setIsAlertOpen(false);
    setToastMessage('🛑 Payment Safely Cancelled. Zero funds were deducted from your account.');
    setTimeout(() => setToastMessage(null), 5000);
  };

  // When user confirms override to send anyway
  const handleProceedAnywayFromAlert = () => {
    setIsAlertOpen(false);
    const numericAmount = parseFloat(amount) || 50.0;
    setBalance((prev) => Math.max(0, prev - numericAmount));
    setSuccessReceipt({
      txn_id: currentScore?.txn_id || `TXN_${Date.now()}`,
      amount: numericAmount,
      currency,
      receiver: receiver.trim(),
      receiverName,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      latencyMs: 0
    });
    setToastMessage('⚠️ Transfer Sent Under User Override.');
    setTimeout(() => setToastMessage(null), 4500);
  };

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white relative">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full shadow-2xl text-xs sm:text-sm font-semibold flex items-center gap-2.5 backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-200 border ${
          toastMessage.includes('Cancelled') 
            ? 'bg-rose-950/95 border-rose-500/60 text-rose-200'
            : toastMessage.includes('Verified') 
            ? 'bg-emerald-950/95 border-emerald-500/60 text-emerald-200'
            : 'bg-indigo-950/95 border-indigo-500/60 text-indigo-200'
        }`}>
          {toastMessage.includes('Cancelled') ? (
            <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          )}
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Mobile Banking Header Bar */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-6 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-md shadow-indigo-600/30">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight text-white block leading-tight">
                MuleNet SafePay
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                In-Flight Transfer Guard
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Live Backend Pill */}
            <div className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-medium flex items-center gap-1 border ${
              backendOnline ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${backendOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span>{backendOnline ? 'FastAPI 8000' : 'Local Fallback'}</span>
            </div>

            {/* User Logout */}
            <button
              onClick={onLogout}
              className="text-[11px] text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Container - Simulated Mobile Banking Payment Screen */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 w-full max-w-md mx-auto">
        
        {/* Account Balance Card */}
        <div className="w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 mb-4 shadow-xl backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                Checking Balance
              </span>
              <span className="text-xl font-bold font-mono text-white">
                {formatCurrency(balance, currentUser.currency || 'USD')}
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-mono text-indigo-300 block">
              {currentUser.accountNumber || 'ACC_10492'}
            </span>
            <span className="text-[10px] text-emerald-400 font-medium">
              Verified Tier
            </span>
          </div>
        </div>

        {/* Preset Triggers Selector */}
        <div className="w-full mb-4">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-2 px-1 text-center">
            ⚡ Quick-Test Triggers (Tap to Simulate)
          </span>
          <div className="grid grid-cols-3 gap-2">
            {/* 1. Safe Everyday Contact */}
            <button
              type="button"
              onClick={() => handleSelectPreset('SAFE')}
              className={`p-2 rounded-2xl border text-center transition-all cursor-pointer ${
                receiver === '0021884_8087CC340' 
                  ? 'bg-emerald-950/70 border-emerald-500/60 ring-2 ring-emerald-500/20' 
                  : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 text-slate-300'
              }`}
            >
              <span className="text-sm block mb-0.5">🟢</span>
              <span className="text-[11px] font-bold text-emerald-400 block leading-tight">
                Model: ALLOW
              </span>
              <span className="text-[9px] text-slate-400 font-mono mt-0.5 block">
                Real example
              </span>
            </button>

            {/* 2. New Unverified Account */}
            <button
              type="button"
              onClick={() => handleSelectPreset('UNVERIFIED')}
              className={`p-2 rounded-2xl border text-center transition-all cursor-pointer ${
                receiver === '0221891_810B24C80' 
                  ? 'bg-amber-950/70 border-amber-500/60 ring-2 ring-amber-500/20' 
                  : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 text-slate-300'
              }`}
            >
              <span className="text-sm block mb-0.5">🟡</span>
              <span className="text-[11px] font-bold text-amber-400 block leading-tight">
                Model: STEP-UP
              </span>
              <span className="text-[9px] text-slate-400 font-mono mt-0.5 block">
                Real example
              </span>
            </button>

            {/* 3. Layering Mule Account */}
            <button
              type="button"
              onClick={() => handleSelectPreset('MULE')}
              className={`p-2 rounded-2xl border text-center transition-all cursor-pointer ${
                receiver === '0048308_811E3C9F0' 
                  ? 'bg-rose-950/70 border-rose-500/60 ring-2 ring-rose-500/20' 
                  : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 text-slate-300'
              }`}
            >
              <span className="text-sm block mb-0.5">🔴</span>
              <span className="text-[11px] font-bold text-rose-400 block leading-tight">
                Model: HOLD
              </span>
              <span className="text-[9px] text-slate-400 font-mono mt-0.5 block">
                Real example
              </span>
            </button>
          </div>
        </div>

        {/* Payment Checkout Card */}
        <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl backdrop-blur-md relative overflow-hidden">
          
          <div className="mb-4 text-center">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block font-mono">
              Checkout & Transfer
            </span>
            <p className="text-xs text-slate-400 mt-0.5">
              Recipient check against real MuleNet model output (replay).
            </p>
          </div>

          <form onSubmit={handlePayNow} className="space-y-4">
            
            {/* Paying To Input */}
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                <span>Paying To:</span>
                <span className="text-[10px] text-slate-500 font-mono">Account / UPI ID</span>
              </label>

              <div className="relative">
                <input
                  type="text"
                  value={receiver}
                  onChange={(e) => {
                    setReceiver(e.target.value);
                    setSuccessReceipt(null);
                  }}
                  placeholder="Account ID from the dataset"
                  className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-3.5 py-3 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  required
                />

                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  {receiver === '0021884_8087CC340' && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/40">
                      Model: ALLOW
                    </span>
                  )}
                  {(receiver === '0048308_811E3C9F0') && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-500/40 animate-pulse">
                      Model: HOLD
                    </span>
                  )}
                  {receiver === '0221891_810B24C80' && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/40">
                      Model: STEP-UP
                    </span>
                  )}
                </div>
              </div>

              <div className="text-[11px] text-slate-400 mt-1 truncate">
                Recipient: <span className="text-slate-200 font-medium">{receiverName}</span>
              </div>
            </div>

            {/* Amount Input */}
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">
                Amount
              </label>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-slate-400 font-bold text-lg">
                    {currency === 'EUR' ? '€' : currency === 'INR' ? '₹' : '$'}
                  </span>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setSuccessReceipt(null);
                    }}
                    placeholder="50.00"
                    className="w-full bg-slate-950 border border-slate-700 rounded-2xl pl-8 pr-3 py-3 text-xl font-mono font-black text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    required
                  />
                </div>

                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as 'USD' | 'EUR' | 'INR')}
                  className="bg-slate-950 border border-slate-700 rounded-2xl px-3 py-3 text-xs font-mono font-bold text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="INR">INR</option>
                </select>
              </div>
            </div>

            {/* Optional Note */}
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1 block">
                Note (Optional)
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What's this for?"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Action Button: "Pay Now" */}
            <button
              type="submit"
              disabled={isProcessing || !receiver.trim() || !amount}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 disabled:opacity-50 text-white font-black text-base tracking-wide shadow-xl shadow-indigo-950/60 flex items-center justify-center gap-2.5 transition-all cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin text-white" />
                  <span>Checking in-flight safety...</span>
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 text-white" />
                  <span>Pay Now ({formatCurrency(parseFloat(amount) || 50, currency)})</span>
                  <ArrowRight className="h-4 w-4 text-white/80" />
                </>
              )}
            </button>
          </form>

          {/* Low Risk Success Receipt Display */}
          {successReceipt && (
            <div className="mt-4 p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-100 animate-in fade-in slide-in-from-top-2 duration-200 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                <span className="text-xs font-bold text-emerald-300">
                  Verified Safe Destination — Transfer Completed
                </span>
              </div>

              <div className="text-xs text-slate-300 space-y-0.5 font-mono pt-1 border-t border-emerald-500/20">
                <div className="flex justify-between">
                  <span>Txn ID:</span>
                  <span className="text-white">{successReceipt.txn_id}</span>
                </div>
                <div className="flex justify-between">
                  <span>To:</span>
                  <span className="text-white">{successReceipt.receiver}</span>
                </div>
                <div className="flex justify-between">
                  <span>Model output:</span>
                  <span className="text-emerald-400">replayed, no alert</span>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <span>Security Layer: MuleNet In-Flight</span>
            <span>Replay of real model output</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950/70 py-3 px-4 text-center text-[11px] text-slate-500 font-mono">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <span>Replay of real model output</span>
          {onSwitchToEnterprise && (
            <button
              onClick={onSwitchToEnterprise}
              className="text-indigo-400 hover:text-indigo-300 cursor-pointer"
            >
              Operations Desk View →
            </button>
          )}
        </div>
      </footer>

      {/* In-Flight Pre-Transfer Security Notification & AI Explainer Modal */}
      <InFlightSecurityAlertModal
        isOpen={isAlertOpen}
        onClose={() => setIsAlertOpen(false)}
        scoreData={currentScore}
        amount={parseFloat(amount) || 50.0}
        currency={currency}
        receiver={receiver}
        sender={currentUser.accountNumber || 'ACC_10492'}
        onCancelPayment={handleCancelFromAlert}
        onProceedAnyway={handleProceedAnywayFromAlert}
      />
    </div>
  );
};
