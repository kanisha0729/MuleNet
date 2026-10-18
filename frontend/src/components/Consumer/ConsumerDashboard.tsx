import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  ArrowRight, 
  Coffee, 
  Zap, 
  Users, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert, 
  Inbox, 
  Send, 
  Clock, 
  RefreshCw, 
  Server, 
  Cpu, 
  Sparkles, 
  User, 
  LogOut, 
  History, 
  Check, 
  AlertCircle, 
  CreditCard, 
  Wallet, 
  ArrowUpRight, 
  ChevronRight, 
  TrendingUp, 
  Activity, 
  Layers 
} from 'lucide-react';
import { 
  scoreTransferApi, 
  checkBackendHealth, 
  ScoreResponse 
} from '../../services/consumerScoreService';
import { UserProfile } from '../../types/auth';
import { AiExplainerChat } from '../Chat/AiExplainerChat';
import { RecentHistoryView } from './RecentHistoryView';
import { SpamPaymentScreen } from '../SpamDetector/SpamPaymentScreen';
import { SpamAlertModal } from '../SpamDetector/SpamAlertModal';
import { MobileBankingCheckout } from '../PaymentFlow/MobileBankingCheckout';
import { UpiSimulationScreen } from '../UpiInterception/UpiSimulationScreen';

interface ConsumerDashboardProps {
  currentUser?: UserProfile | null;
  onLogout: () => void;
  onSwitchToEnterprise?: () => void;
}

export const ConsumerDashboard: React.FC<ConsumerDashboardProps> = ({ 
  currentUser,
  onLogout,
  onSwitchToEnterprise 
}) => {
  // Safe user defaults
  const safeUser: UserProfile = {
    name: currentUser?.name || 'Verified Customer',
    email: currentUser?.email || 'sarah.jenkins@safepay.io',
    accountNumber: currentUser?.accountNumber || 'ACC_10492',
    role: currentUser?.role || 'CUSTOMER',
    balance: typeof currentUser?.balance === 'number' ? currentUser.balance : 24850.00,
    currency: currentUser?.currency || 'USD',
    trustScore: typeof currentUser?.trustScore === 'number' ? currentUser.trustScore : 98,
    tier: currentUser?.tier || 'Verified Personal Customer'
  };

  // Navigation view: 'UPI_INTERCEPT' (default simulated UPI network interceptor) | 'IN_FLIGHT' | 'SPAM_PAY' | 'DASHBOARD' | 'FULL_HISTORY'
  const [viewTab, setViewTab] = useState<'UPI_INTERCEPT' | 'IN_FLIGHT' | 'SPAM_PAY' | 'DASHBOARD' | 'FULL_HISTORY'>('UPI_INTERCEPT');
  const [isSpamModalOpen, setIsSpamModalOpen] = useState(false);

  // Form State
  const [sender, setSender] = useState(safeUser.accountNumber);
  const [receiver, setReceiver] = useState('0021884_8087CC340');
  const [amount, setAmount] = useState('36.55');
  const [currency, setCurrency] = useState<'USD' | 'EUR' | 'INR'>('USD');

  // Loading & Result State
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<ScoreResponse | null>(null);
  const [backendOnline, setBackendOnline] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // History State
  const [history, setHistory] = useState<ScoreResponse[]>([]);

  // Set default initial result from history on load
  useEffect(() => {
    if (!result && history.length > 0) {
      setResult(history[0]);
    }
  }, []);

  // Periodic Backend Health Check
  useEffect(() => {
    let isMounted = true;
    const verifyHealth = async () => {
      const isUp = await checkBackendHealth();
      if (isMounted) {
        setBackendOnline(isUp);
      }
    };

    verifyHealth();
    const interval = setInterval(verifyHealth, 6000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Quick fill samples
  const handleQuickFill = (type: 'NORMAL' | 'RAPID' | 'FAN_IN') => {
    if (type === 'NORMAL') {
      setSender('0211_808B01880');
      setReceiver('0021884_8087CC340');
      setAmount('36.55');
      setCurrency('USD');
    } else if (type === 'RAPID') {
      setSender('070_100428660');
      setReceiver('0221891_810B24C80');
      setAmount('248.86');
      setCurrency('USD');
    } else if (type === 'FAN_IN') {
      setSender('0223_811EDA940');
      setReceiver('0048308_811E3C9F0');
      setAmount('14161.55');
      setCurrency('USD');
    }
  };

  // Submit transfer safety check
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sender.trim() || !receiver.trim() || !amount) return;

    setIsChecking(true);
    setResult(null);

    const scoreData = await scoreTransferApi({
      sender,
      receiver,
      amount: parseFloat(amount) || 0,
      currency
    });

    if (scoreData.decision === 'UNSCORED') {
      setIsChecking(false);
      setToastMessage(scoreData.status_text);
      setTimeout(() => setToastMessage(null), 5000);
      return;
    }

    setResult(scoreData);
    setIsChecking(false);

    // Prepend to history
    setHistory((prev) => [scoreData, ...prev]);
  };

  // Pre-transfer verify and send handler
  const handleVerifyAndSend = async (
    senderAcc: string,
    receiverAcc: string,
    amt: number,
    curr: 'USD' | 'EUR' | 'INR'
  ) => {
    setIsChecking(true);
    setSender(senderAcc);
    setReceiver(receiverAcc);
    setAmount(amt.toString());
    setCurrency(curr);

    const scoreData = await scoreTransferApi({
      sender: senderAcc,
      receiver: receiverAcc,
      amount: amt,
      currency: curr
    });

    if (scoreData.decision === 'UNSCORED') {
      setIsChecking(false);
      setToastMessage(scoreData.status_text);
      setTimeout(() => setToastMessage(null), 5000);
      return;
    }

    setResult(scoreData);
    setIsChecking(false);
    setIsSpamModalOpen(true);
    setHistory((prev) => [scoreData, ...prev]);
  };

  const handleProceedTransfer = () => {
    setIsSpamModalOpen(false);
    setToastMessage(`✅ Transfer of ${amount} ${currency} safely processed and released to ${receiver}.`);
    setTimeout(() => setToastMessage(null), 4500);
  };

  const handleCancelTransfer = () => {
    setIsSpamModalOpen(false);
    setToastMessage(`🛑 Transfer Cancelled: Your money remains safely in your account.`);
    setTimeout(() => setToastMessage(null), 4500);
  };

  const handleAnalystAction = (action: 'APPROVE' | 'REVIEW' | 'HOLD') => {
    if (action === 'APPROVE') {
      setToastMessage('✅ Transfer Approved: Funds verified and cleared for release.');
    } else if (action === 'REVIEW') {
      setToastMessage('🟡 Transfer Flagged: Escalated to Tier-2 desk for manual documentary verification.');
    } else {
      setToastMessage('🛑 Transfer Held: Temporary freeze applied to suspect beneficiary account.');
    }
    setTimeout(() => setToastMessage(null), 4500);
  };

  const handleSelectRecent = (check: ScoreResponse) => {
    setSender(check.sender);
    setReceiver(check.receiver);
    setAmount(check.amount.toString());
    setCurrency((check.currency as 'USD' | 'EUR' | 'INR') || 'USD');
    setResult(check);
    setViewTab('DASHBOARD');
  };

  // Crash-proof currency formatter
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
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 border border-indigo-500/50 text-white px-5 py-2.5 rounded-full shadow-2xl text-xs sm:text-sm font-medium flex items-center gap-2.5 backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-200">
          <Sparkles className="h-4 w-4 text-indigo-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Telemetry & User Bar */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-6 py-2.5">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Logo & Edition */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-white font-sans">
                  MuleNet SafePay
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-indigo-300">
                  {safeUser.role === 'COMPLIANCE_OFFICER' ? 'Compliance Edition' : 'Consumer Edition'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans hidden sm:block">
                Check Any Transfer Safety in 1 Click
              </p>
            </div>
          </div>

          {/* Navigation Tab Toggle */}
          <div className="flex items-center bg-slate-900 p-0.5 rounded-xl border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setViewTab('UPI_INTERCEPT')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                viewTab === 'UPI_INTERCEPT'
                  ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 text-white font-bold shadow-md shadow-emerald-900/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>🛡️ UPI Interceptor</span>
            </button>
            <button
              onClick={() => setViewTab('IN_FLIGHT')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                viewTab === 'IN_FLIGHT'
                  ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>📱 In-Flight Checkout</span>
            </button>
            <button
              onClick={() => setViewTab('SPAM_PAY')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                viewTab === 'SPAM_PAY'
                  ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🛡️ Spam Detector</span>
            </button>
            <button
              onClick={() => setViewTab('DASHBOARD')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewTab === 'DASHBOARD'
                  ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Risk Inspector
            </button>
            <button
              onClick={() => setViewTab('FULL_HISTORY')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                viewTab === 'FULL_HISTORY'
                  ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>History</span>
              <span className="text-[10px] px-1.5 rounded-full bg-slate-800 text-indigo-300">
                {history.length}
              </span>
            </button>
          </div>

          {/* Telemetry Status & User Avatar */}
          <div className="flex items-center gap-2.5">
            {/* Status Pill */}
            <div className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-medium flex items-center gap-1.5 border transition-all ${
              backendOnline 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
            }`}>
              <span className={`h-2 w-2 rounded-full ${backendOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
              <span className="hidden md:inline">{backendOnline ? 'Backend online (replay of results.csv)' : 'Backend offline: nothing will be scored'}</span>
              <span className="md:hidden">{backendOnline ? 'Port 8000' : 'Offline'}</span>
            </div>

            {/* Architecture Tag */}
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-[10px] text-slate-300 font-mono">
              <Cpu className="h-3 w-3 text-indigo-400" />
              <span>Replay of real model output</span>
            </div>

            {/* User Profile Pill & Sign Out */}
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-full pl-2.5 pr-1.5 py-1">
              <div className="h-6 w-6 rounded-full bg-indigo-600 text-xs font-bold flex items-center justify-center text-white">
                {safeUser.name.charAt(0)}
              </div>
              <div className="hidden xl:flex flex-col text-left leading-none pr-1">
                <span className="text-xs text-white font-medium">{safeUser.name}</span>
                <span className="text-[9px] text-slate-400 font-mono">{safeUser.accountNumber}</span>
              </div>
              <button
                onClick={onLogout}
                title="Sign Out"
                className="p-1 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Wide Layout */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-5">
        {viewTab === 'UPI_INTERCEPT' ? (
          <UpiSimulationScreen
            currentUser={safeUser}
            onLogout={onLogout}
            onSwitchToEnterprise={onSwitchToEnterprise}
            embedded={true}
          />
        ) : viewTab === 'IN_FLIGHT' ? (
          <MobileBankingCheckout
            currentUser={safeUser}
            onLogout={onLogout}
            onSwitchToEnterprise={onSwitchToEnterprise}
          />
        ) : viewTab === 'SPAM_PAY' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Center / Left Column (7 cols): payment screen + account status */}
            <div className="lg:col-span-7 space-y-5">
              <SpamPaymentScreen
                currentUser={safeUser}
                isChecking={isChecking}
                onVerifyAndSend={handleVerifyAndSend}
                lastResult={result}
              />

              {/* Verified Account Truecaller Reputation Card (if evaluated) */}
              {result && (
                <div className={`p-5 rounded-3xl border shadow-xl backdrop-blur-md transition-all ${
                  result.decision === 'HOLD'
                    ? 'bg-rose-950/40 border-rose-500/40'
                    : result.decision === 'REVIEW'
                    ? 'bg-amber-950/40 border-amber-500/40'
                    : 'bg-emerald-950/40 border-emerald-500/40'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">
                        {result.decision === 'HOLD' ? '🚨' : result.decision === 'REVIEW' ? '⚠️' : '🛡️'}
                      </span>
                      <div>
                        <span className="text-xs font-mono uppercase tracking-wider text-slate-400 block">
                          Verified Destination Reputation
                        </span>
                        <span className="text-sm font-bold text-white font-mono">
                          {result.receiver}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => setIsSpamModalOpen(true)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                        result.decision === 'HOLD'
                          ? 'bg-rose-600 hover:bg-rose-500 text-white'
                          : result.decision === 'REVIEW'
                          ? 'bg-amber-600 hover:bg-amber-500 text-slate-950'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      }`}
                    >
                      View Pre-Transfer Alert
                    </button>
                  </div>

                  {/* Plain-English Flags */}
                  <div className="space-y-1.5 mt-2">
                    {result.spam_flags ? (
                      result.spam_flags.map((flag, idx) => (
                        <div key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                          <span className="text-sm shrink-0">
                            {result.decision === 'HOLD' ? '🚩' : result.decision === 'REVIEW' ? '⚠️' : '✓'}
                          </span>
                          <span>{flag}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-300">
                        {result.ai_narrative}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column (5 cols): Interactive Ask MuleNet AI Chat Assistant */}
            <div className="lg:col-span-5 h-[680px]">
              <AiExplainerChat currentTransfer={result} />
            </div>
          </div>
        ) : viewTab === 'FULL_HISTORY' ? (
          <RecentHistoryView
            history={history}
            onSelectTransfer={handleSelectRecent}
            onNewCheck={() => setViewTab('SPAM_PAY')}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            
            {/* 1. LEFT PANEL (3 COLS): Quick Navigation & Account Activity */}
            <div className="lg:col-span-3 space-y-4">
              {/* User Profile Summary Card */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-indigo-600/20">
                      {safeUser.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white leading-tight">{safeUser.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{safeUser.accountNumber}</div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    {safeUser.role === 'COMPLIANCE_OFFICER' ? 'AML Lead' : 'Customer'}
                  </span>
                </div>

                {/* Account Balance */}
                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-sans mb-1">
                    <span className="flex items-center gap-1">
                      <Wallet className="h-3 w-3 text-emerald-400" />
                      <span>Available Balance</span>
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400 font-semibold">Active</span>
                  </div>
                  <div className="text-xl font-bold font-mono text-white tabular-nums">
                    {formatCurrency(safeUser.balance, safeUser.currency)}
                  </div>
                  <div className="text-[10px] text-slate-500 font-sans mt-0.5">
                    {safeUser.tier}
                  </div>
                </div>

                {/* Trust Score Badge */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <div>
                      <div className="font-semibold text-xs leading-none">Trust Score: {safeUser.trustScore}/100</div>
                      <div className="text-[10px] text-emerald-400/80 mt-0.5">High Trust Verified Account</div>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-400">AA+</span>
                </div>
              </div>

              {/* Quick-Preset Test Scenarios */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur-sm space-y-2.5">
                <div className="flex items-center justify-between text-xs font-semibold text-white font-sans">
                  <span>Quick-Preset Test Scenarios</span>
                  <span className="text-[10px] font-mono text-slate-400">1-Click</span>
                </div>

                <div className="space-y-2">
                  {/* Preset 1: Everyday Safe */}
                  <button
                    type="button"
                    onClick={() => handleQuickFill('NORMAL')}
                    className="w-full p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 text-left transition-all text-xs group cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-medium text-slate-200 group-hover:text-emerald-400">
                        <Coffee className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Model says: ALLOW</span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400 font-bold">$36.55 USD</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">
                      Real transaction from the IBM test stream
                    </p>
                  </button>

                  {/* Preset 2: Rapid Forwarding Mule */}
                  <button
                    type="button"
                    onClick={() => handleQuickFill('RAPID')}
                    className="w-full p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 text-left transition-all text-xs group cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-medium text-slate-200 group-hover:text-amber-400">
                        <Zap className="h-3.5 w-3.5 text-amber-400" />
                        <span>Model says: STEP-UP</span>
                      </div>
                      <span className="text-[10px] font-mono text-amber-400 font-bold">$248.86 USD</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">
                      Real transaction, model score 0.016
                    </p>
                  </button>

                  {/* Preset 3: High Fan-In Pool */}
                  <button
                    type="button"
                    onClick={() => handleQuickFill('FAN_IN')}
                    className="w-full p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-rose-500/40 text-left transition-all text-xs group cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-medium text-slate-200 group-hover:text-rose-400">
                        <Users className="h-3.5 w-3.5 text-rose-400" />
                        <span>Model says: HOLD</span>
                      </div>
                      <span className="text-[10px] font-mono text-rose-400 font-bold">$14,161.55 USD</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">
                      Real flagged transaction (CYCLE pattern)
                    </p>
                  </button>
                </div>
              </div>

              {/* Recent Safety Checks List */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur-sm space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-white font-sans mb-1">
                  <span>Recent Safety Checks</span>
                  <button
                    onClick={() => setViewTab('FULL_HISTORY')}
                    className="text-[10px] font-mono text-indigo-400 hover:text-indigo-300"
                  >
                    View All ({history.length})
                  </button>
                </div>

                <div className="divide-y divide-slate-800/80">
                  {history.slice(0, 3).map((check) => {
                    const isSelected = result?.txn_id === check.txn_id;
                    const isSafe = check.decision === 'ALLOW';
                    const isCaution = check.decision === 'REVIEW';

                    return (
                      <div
                        key={check.txn_id}
                        onClick={() => handleSelectRecent(check)}
                        className={`py-2 px-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-between ${
                          isSelected ? 'bg-indigo-600/15 border-l-2 border-indigo-500' : 'hover:bg-slate-800/50'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-mono font-medium text-slate-200 flex items-center gap-1">
                            <span className="truncate max-w-[80px]">{check.sender}</span>
                            <span className="text-slate-500">→</span>
                            <span className="truncate max-w-[80px]">{check.receiver}</span>
                          </div>
                          <div className="text-[10px] font-mono text-slate-500">
                            {formatCurrency(check.amount, check.currency)}
                          </div>
                        </div>

                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${
                          isSafe ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                          isCaution ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                          'bg-rose-500/15 text-rose-400 border-rose-500/35'
                        }`}>
                          {isSafe ? 'Safe' : (isCaution ? 'Review' : 'Hold')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 2. CENTER PANEL (5 COLS): Active Transfer & Risk Evaluation */}
            <div className="lg:col-span-5 space-y-4">
              {/* Transfer Form Card */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl backdrop-blur-sm relative overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-indigo-500 rounded-full opacity-80" />

                <div className="mb-4">
                  <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
                    <span>Active Transfer Safety Evaluator</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Looks up the real MuleNet model output for the recipient (replay of results.csv).
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Sender Account */}
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Sender Account
                      </label>
                      <input
                        type="text"
                        value={sender}
                        onChange={(e) => setSender(e.target.value)}
                        placeholder="e.g. ACC_10492"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                        required
                      />
                    </div>

                    {/* Receiver Account */}
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Receiver Account
                      </label>
                      <input
                        type="text"
                        value={receiver}
                        onChange={(e) => setReceiver(e.target.value)}
                        placeholder="e.g. ACC_88301"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                        required
                      />
                    </div>
                  </div>

                  {/* Transfer Amount & Currency */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Transfer Amount
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        step="any"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm sm:text-base font-semibold font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                        required
                      />
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value as 'USD' | 'EUR' | 'INR')}
                        className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold font-mono text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                      >
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="INR">INR (₹)</option>
                      </select>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isChecking}
                    className="w-full mt-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-medium text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition-all duration-200 disabled:opacity-60 cursor-pointer"
                  >
                    {isChecking ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Looking up model output...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-4 w-4" />
                        <span>Evaluate Transfer Safety</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Instant Evaluation Result Card */}
              {result && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xl backdrop-blur-sm animate-in fade-in slide-in-from-top-3 duration-300 space-y-4">
                  {/* Big Decision Banner */}
                  <div className={`p-4 rounded-xl border flex items-center gap-3.5 ${
                    result.decision === 'ALLOW' 
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200' 
                      : result.decision === 'REVIEW'
                      ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                      : 'bg-rose-950/40 border-rose-500/50 text-rose-200'
                  }`}>
                    <div className={`p-2.5 rounded-xl shrink-0 ${
                      result.decision === 'ALLOW'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : result.decision === 'REVIEW'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-rose-500/20 text-rose-400'
                    }`}>
                      {result.decision === 'ALLOW' && <CheckCircle2 className="h-6 w-6" />}
                      {result.decision === 'REVIEW' && <AlertTriangle className="h-6 w-6" />}
                      {result.decision === 'HOLD' && <ShieldAlert className="h-6 w-6" />}
                    </div>

                    <div>
                      <div className="text-sm sm:text-base font-bold tracking-tight">
                        {result.decision === 'ALLOW' && '🟢 ALLOW (no alert)'}
                        {result.decision === 'REVIEW' && '🟡 REVIEW (step-up verification)'}
                        {result.decision === 'HOLD' && '🔴 HOLD RECOMMENDED'}
                      </div>
                      <p className="text-xs text-slate-300 mt-0.5 font-sans leading-snug">
                        {result.decision === 'ALLOW' && 'The model score is below the alert threshold.'}
                        {result.decision === 'REVIEW' && 'The model score is in the step-up band. Secondary verification recommended.'}
                        {result.decision === 'HOLD' && 'The model score is above the hold threshold. Review the signals below.'}
                      </p>
                    </div>
                  </div>

                  {/* Visual Risk Meter Bar */}
                  <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-300">Model output (replay):</span>
                      <span className={`font-mono font-bold text-sm ${
                        result.decision === 'HOLD' ? 'text-rose-400' :
                        result.decision === 'REVIEW' ? 'text-amber-400' : 'text-emerald-400'
                      }`}>
                        Model score {typeof result.model_score === 'number' ? result.model_score.toFixed(4) : '0'}
                      </span>
                    </div>

                    <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden p-0.5 border border-slate-800">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ease-out ${
                          result.decision === 'HOLD' 
                            ? 'bg-gradient-to-r from-amber-500 to-rose-500 shadow-sm shadow-rose-500/50' 
                            : result.decision === 'REVIEW' 
                            ? 'bg-amber-400' 
                            : 'bg-emerald-400'
                        }`}
                        style={{ width: `${Math.max(5, result.risk_score ?? 0)}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>0 (no alert)</span>
                      <span>threshold 0.0156</span>
                      <span>1 (highest score)</span>
                    </div>
                  </div>

                  {/* Core Behavioral Metrics Chips */}
                  <div>
                    <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-2">
                      Replay-sample metrics (counted from the replayed rows, not 24h windows):
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                      {/* Fan-In */}
                      <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-center">
                        <span className="text-[9px] text-slate-500 block uppercase">Senders in sample</span>
                        <span className="font-bold text-white text-xs sm:text-sm">
                          {result.metrics?.fan_in_count ?? 1} senders
                        </span>
                      </div>

                      {/* Fan-Out */}
                      <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-center">
                        <span className="text-[9px] text-slate-500 block uppercase">Receivers in sample</span>
                        <span className="font-bold text-white text-xs sm:text-sm">
                          {result.metrics?.fan_out_count ?? 1} accounts
                        </span>
                      </div>

                      {/* Time Since Deposit */}
                      <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-center">
                        <span className="text-[9px] text-slate-500 block uppercase">Inflow Retention</span>
                        <span className="font-bold text-amber-300 text-xs sm:text-sm">
                          {result.metrics?.time_since_deposit ?? 'n/a'}
                        </span>
                      </div>

                      {/* Outflow Ratio */}
                      <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-center">
                        <span className="text-[9px] text-slate-500 block uppercase">Pass-Through</span>
                        <span className="font-bold text-indigo-300 text-xs sm:text-sm">
                          {result.metrics?.outflow_inflow_ratio ?? 'n/a'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Analyst Action Buttons */}
                  <div>
                    <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                      Decision Action Options:
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => handleAnalystAction('APPROVE')}
                        className="py-2 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center justify-center gap-1 transition-all shadow-sm cursor-pointer"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Approve</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAnalystAction('REVIEW')}
                        className="py-2 px-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs flex items-center justify-center gap-1 transition-all shadow-sm cursor-pointer"
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Review</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAnalystAction('HOLD')}
                        className="py-2 px-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs flex items-center justify-center gap-1 transition-all shadow-sm shadow-rose-900/30 cursor-pointer"
                      >
                        <ShieldAlert className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Hold</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 3. RIGHT PANEL (4 COLS): Interactive "Ask AI Explainer" Chatbot */}
            <div className="lg:col-span-4 h-full min-h-[580px]">
              <AiExplainerChat currentTransfer={result} />
            </div>

          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950/70 py-3 px-4 text-center text-[11px] text-slate-500 font-mono">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>MuleNet SafePay • Real-Time Laundering-Risk Prediction</span>
          <div className="flex items-center gap-3">
            <span>Replay of real model output</span>
            {onSwitchToEnterprise && (
              <button
                onClick={onSwitchToEnterprise}
                className="text-indigo-400 hover:text-indigo-300 cursor-pointer flex items-center gap-1"
              >
                <span>Operations Desk View</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Pre-Transfer Spam / Risk Alert Modal */}
      <SpamAlertModal
        isOpen={isSpamModalOpen}
        onClose={() => setIsSpamModalOpen(false)}
        result={result}
        onProceed={handleProceedTransfer}
        onCancel={handleCancelTransfer}
        onOpenAiChat={() => {
          setIsSpamModalOpen(false);
        }}
      />
    </div>
  );
};
