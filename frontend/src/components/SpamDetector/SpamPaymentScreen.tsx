import React, { useState } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  ArrowRight, 
  Send, 
  UserCheck, 
  HelpCircle, 
  Sparkles, 
  CheckCircle2, 
  RefreshCw,
  Search,
  Wallet,
  Building,
  CreditCard,
  QrCode,
  Smartphone
} from 'lucide-react';
import { ScoreResponse } from '../../services/consumerScoreService';
import { UserProfile } from '../../types/auth';

interface SpamPaymentScreenProps {
  currentUser: UserProfile;
  isChecking: boolean;
  onVerifyAndSend: (sender: string, receiver: string, amount: number, currency: 'USD' | 'EUR' | 'INR') => void;
  lastResult: ScoreResponse | null;
}

export const SpamPaymentScreen: React.FC<SpamPaymentScreenProps> = ({
  currentUser,
  isChecking,
  onVerifyAndSend,
  lastResult
}) => {
  const [receiver, setReceiver] = useState('0048308_811E3C9F0');
  const [amount, setAmount] = useState('14161.55');
  const [currency, setCurrency] = useState<'USD' | 'EUR' | 'INR'>('USD');
  const sender = currentUser.accountNumber || 'ACC_10492';

  // Quick preset test accounts
  const handleSelectPreset = (presetType: 'SAFE' | 'SCAM' | 'UNVERIFIED') => {
    if (presetType === 'SAFE') {
      setReceiver('0021884_8087CC340');
      setAmount('36.55');
      setCurrency('USD');
    } else if (presetType === 'SCAM') {
      setReceiver('0048308_811E3C9F0');
      setAmount('14161.55');
      setCurrency('USD');
    } else if (presetType === 'UNVERIFIED') {
      setReceiver('0221891_810B24C80');
      setAmount('248.86');
      setCurrency('USD');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiver.trim() || !amount) return;
    onVerifyAndSend(sender, receiver.trim(), parseFloat(amount) || 0, currency);
  };

  const formatBalance = (amt: number, curr: string) => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: curr || 'USD',
        maximumFractionDigits: 2
      }).format(amt);
    } catch {
      return `$${amt.toLocaleString()}`;
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col items-center">
      {/* Wallet Balance Card */}
      <div className="w-full bg-gradient-to-r from-indigo-900/60 via-slate-900/80 to-slate-900/60 border border-indigo-500/30 rounded-3xl p-5 mb-5 shadow-xl backdrop-blur-sm flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-indigo-300">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
              SafePay Checking Balance
            </span>
            <span className="text-xl font-black text-white font-mono">
              {formatBalance(currentUser.balance || 24850, currentUser.currency || 'USD')}
            </span>
            <span className="text-xs text-indigo-300 font-mono block">
              {currentUser.accountNumber || 'ACC_10492'} • Verified Tier
            </span>
          </div>
        </div>

        <div className="text-right">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Spam Guard ON</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">
            Replay of real model output
          </span>
        </div>
      </div>

      {/* Main Payment Form Card */}
      <div className="w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md">
        {/* Card Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/80 text-slate-300 text-xs font-medium mb-2">
            <Smartphone className="h-3.5 w-3.5 text-indigo-400" />
            <span>Recipient account check</span>
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            Send Money Securely
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            We inspect the destination account for money-mule patterns before releasing funds.
          </p>
        </div>

        {/* Quick-Test Preset Account Buttons */}
        <div className="mb-6">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-2 text-center">
            ⚡ Quick-Test Destination Accounts
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* Mom / Verified Merchant */}
            <button
              type="button"
              onClick={() => handleSelectPreset('SAFE')}
              className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                receiver === '0021884_8087CC340'
                  ? 'bg-emerald-950/60 border-emerald-500/60 ring-2 ring-emerald-500/20'
                  : 'bg-slate-950/50 border-slate-800 hover:border-slate-700 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold mb-0.5">
                <span>🛡️</span>
                <span>Model: ALLOW</span>
              </div>
              <p className="text-[10px] text-slate-400 line-clamp-1">
                Real example, score 0.000
              </p>
            </button>

            {/* Job Scam / Mule Account */}
            <button
              type="button"
              onClick={() => handleSelectPreset('SCAM')}
              className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                receiver === '0048308_811E3C9F0'
                  ? 'bg-rose-950/60 border-rose-500/60 ring-2 ring-rose-500/20'
                  : 'bg-slate-950/50 border-slate-800 hover:border-slate-700 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-1.5 text-rose-400 text-xs font-bold mb-0.5">
                <span>🚨</span>
                <span>Model: HOLD</span>
              </div>
              <p className="text-[10px] text-slate-400 line-clamp-1">
                Real flagged example (CYCLE)
              </p>
            </button>

            {/* New Unverified Account */}
            <button
              type="button"
              onClick={() => handleSelectPreset('UNVERIFIED')}
              className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                receiver === '0221891_810B24C80'
                  ? 'bg-amber-950/60 border-amber-500/60 ring-2 ring-amber-500/20'
                  : 'bg-slate-950/50 border-slate-800 hover:border-slate-700 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold mb-0.5">
                <span>⚠️</span>
                <span>Model: STEP-UP</span>
              </div>
              <p className="text-[10px] text-slate-400 line-clamp-1">
                Real example, score 0.016
              </p>
            </button>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Receiver Account / UPI ID */}
          <div>
            <label className="text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Receiver Bank Account / UPI ID</span>
              <span className="text-[10px] text-indigo-300 font-mono">Real-Time Risk Guard</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={receiver}
                onChange={(e) => setReceiver(e.target.value)}
                placeholder="Account ID from the dataset"
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3.5 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                required
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
                {receiver === '0021884_8087CC340' && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/40">
                    Model: ALLOW
                  </span>
                )}
                {(receiver === '0048308_811E3C9F0') && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-500/40">
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
          </div>

          {/* Amount to Send + Currency */}
          <div>
            <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
              Amount to Send
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  step="any"
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3.5 text-lg font-mono font-bold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  required
                />
              </div>

              {/* Currency Selector */}
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as 'USD' | 'EUR' | 'INR')}
                className="bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3.5 text-sm font-mono font-bold text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="INR">INR (₹)</option>
              </select>
            </div>
          </div>

          {/* Big Action Button: "Verify Account & Send" */}
          <button
            type="submit"
            disabled={isChecking || !receiver.trim() || !amount}
            className="w-full mt-2 py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 disabled:opacity-50 text-white font-black text-base tracking-wide shadow-xl shadow-indigo-950/50 flex items-center justify-center gap-2.5 transition-all cursor-pointer"
          >
            {isChecking ? (
              <>
                <RefreshCw className="h-5 w-5 animate-spin text-white" />
                <span>Looking up model output...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="h-5 w-5 text-white" />
                <span>Verify Account & Send</span>
                <ArrowRight className="h-5 w-5 text-white/80" />
              </>
            )}
          </button>
        </form>

        {/* Informational Footer in the Card */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Model output replay
          </span>
          <span className="font-mono">Lookup of precomputed scores</span>
        </div>
      </div>
    </div>
  );
};
