import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  Lock, 
  Smartphone, 
  CheckCircle2, 
  ArrowRight, 
  Sparkles, 
  Building, 
  CreditCard, 
  RefreshCw, 
  ExternalLink,
  Info,
  ChevronRight,
  Send,
  Zap,
  Coffee,
  Users,
  AlertOctagon
} from 'lucide-react';
import { 
  scoreTransferApi, 
  checkBackendHealth, 
  ScoreResponse 
} from '../../services/consumerScoreService';
import { UserProfile } from '../../types/auth';
import { MuleNetAlertOverlay } from './MuleNetAlertOverlay';

interface UpiSimulationScreenProps {
  currentUser: UserProfile;
  onLogout: () => void;
  onSwitchToEnterprise?: () => void;
  embedded?: boolean;
}

export const UpiSimulationScreen: React.FC<UpiSimulationScreenProps> = ({
  currentUser,
  onLogout,
  onSwitchToEnterprise,
  embedded = false
}) => {
  // Active Simulated UPI App: 'GPAY' | 'PHONEPE' | 'PAYTM'
  const [upiApp, setUpiApp] = useState<'GPAY' | 'PHONEPE' | 'PAYTM'>('GPAY');

  // UPI Form State
  const [receiverVpa, setReceiverVpa] = useState('0048308_811E3C9F0');
  const [receiverName, setReceiverName] = useState('Account 0048308_811E3C9F0');
  const [amount, setAmount] = useState('14161.55');
  const [currency, setCurrency] = useState<'INR' | 'USD' | 'EUR'>('USD');
  const [note, setNote] = useState('Real flagged transaction (CYCLE pattern)');

  // Interception & Processing State
  const [isIntercepting, setIsIntercepting] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [currentScore, setCurrentScore] = useState<ScoreResponse | null>(null);
  const [backendOnline, setBackendOnline] = useState(false);

  // Success / Clean Payment State
  const [successReceipt, setSuccessReceipt] = useState<{
    txn_id: string;
    amount: number;
    currency: string;
    vpa: string;
    name: string;
    time: string;
    latencyMs: number;
  } | null>(null);

  // Interception toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Backend Health check
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
      setReceiverVpa('0021884_8087CC340');
      setReceiverName('Account 0021884_8087CC340');
      setAmount('36.55');
      setCurrency('USD');
      setNote('Real transaction from the IBM test stream');
    } else if (type === 'UNVERIFIED') {
      setReceiverVpa('0221891_810B24C80');
      setReceiverName('Account 0221891_810B24C80');
      setAmount('248.86');
      setCurrency('USD');
      setNote('Real transaction from the IBM test stream');
    } else if (type === 'MULE') {
      setReceiverVpa('0048308_811E3C9F0');
      setReceiverName('Account 0048308_811E3C9F0');
      setAmount('14161.55');
      setCurrency('USD');
      setNote('Real flagged transaction (CYCLE pattern)');
    }
  };

  // When user taps "Pay" inside the third-party UPI app
  const handleUpiPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiverVpa.trim() || !amount) return;

    setIsIntercepting(true);
    setSuccessReceipt(null);

    const numericAmount = parseFloat(amount) || 500;
    const startTime = performance.now();

    // Look up the real model output for this recipient
    const scoreResult = await scoreTransferApi({
      txn_id: `UPI_${Date.now()}`,
      sender: currentUser.accountNumber || 'ACC_10492',
      receiver: receiverVpa.trim(),
      amount: numericAmount,
      currency
    });

    const elapsed = Math.round(performance.now() - startTime);
    if (scoreResult.decision === 'UNSCORED') {
      setIsIntercepting(false);
      setToastMessage(scoreResult.status_text);
      setTimeout(() => setToastMessage(null), 5000);
      return;
    }
    setCurrentScore(scoreResult);
    setIsIntercepting(false);

    // If Safe (Low Risk): Allow the UPI app to finish payment
    if (scoreResult.decision === 'ALLOW') {
      setSuccessReceipt({
        txn_id: scoreResult.txn_id,
        amount: numericAmount,
        currency,
        vpa: receiverVpa.trim(),
        name: receiverName,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        latencyMs: elapsed
      });
      setToastMessage('✅ Verified Safe Destination — Payment Released');
      setTimeout(() => setToastMessage(null), 4000);
    } else {
      // If High Risk or Suspicious Mule: MuleNet INTERCEPTS and pauses payment!
      setIsAlertOpen(true);
      setToastMessage('🚨 Model recommends holding this payment for review');
      setTimeout(() => setToastMessage(null), 4500);
    }
  };

  const handleCancelFromAlert = () => {
    setIsAlertOpen(false);
    setToastMessage('🛑 Transfer Aborted. Your bank balance remains 100% safe.');
    setTimeout(() => setToastMessage(null), 5000);
  };

  const handleProceedAnywayFromAlert = () => {
    setIsAlertOpen(false);
    const numericAmount = parseFloat(amount) || 500;
    setSuccessReceipt({
      txn_id: currentScore?.txn_id || `UPI_${Date.now()}`,
      amount: numericAmount,
      currency,
      vpa: receiverVpa.trim(),
      name: receiverName,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      latencyMs: 0
    });
    setToastMessage('⚠️ UPI Transfer Released Under User Override.');
    setTimeout(() => setToastMessage(null), 4500);
  };

  // App Theme Styling
  const getAppStyle = () => {
    if (upiApp === 'GPAY') {
      return {
        name: 'UPI App A',
        headerBg: 'bg-slate-900 border-b border-slate-800 text-white',
        logoColor: 'text-indigo-400',
        accentBtn: 'bg-indigo-600 hover:bg-indigo-500 text-white',
        appName: 'UPI App A',
        badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
      };
    }
    if (upiApp === 'PHONEPE') {
      return {
        name: 'UPI App B',
        headerBg: 'bg-purple-950 border-b border-purple-800 text-white',
        logoColor: 'text-purple-400',
        accentBtn: 'bg-purple-600 hover:bg-purple-500 text-white',
        appName: 'UPI App B',
        badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40'
      };
    }
    return {
      name: 'UPI App C',
      headerBg: 'bg-cyan-950 border-b border-cyan-800 text-white',
      logoColor: 'text-cyan-400',
      accentBtn: 'bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold',
      appName: 'UPI App C',
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
    };
  };

  const appStyle = getAppStyle();

  return (
    <div className={embedded ? "w-full text-slate-100 flex flex-col justify-between" : "min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white"}>
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full shadow-2xl text-xs sm:text-sm font-semibold flex items-center gap-2.5 backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-200 border ${
          toastMessage.includes('Aborted') 
            ? 'bg-rose-950/95 border-rose-500/60 text-rose-200'
            : toastMessage.includes('Verified') 
            ? 'bg-emerald-950/95 border-emerald-500/60 text-emerald-200'
            : 'bg-slate-900/95 border-indigo-500/60 text-indigo-200'
        }`}>
          {toastMessage.includes('Aborted') ? (
            <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          )}
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Clarification & Telemetry Banner (Only if not embedded in ConsumerDashboard) */}
      {!embedded && (
        <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-6 py-2.5">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            
            {/* Logo & Product Clarification Tag */}
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-indigo-600/30 shrink-0">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm sm:text-base font-bold tracking-tight text-white font-sans">
                    MuleNet UPI Interceptor
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-semibold">
                    Network Security Plugin
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-sans hidden sm:block">
                  MuleNet is <strong className="text-white font-semibold">NOT a payment wallet</strong>. It intercepts transfers on third-party UPI apps in real time.
                </p>
              </div>
            </div>

            {/* Right Controls: Telemetry Pill & Logout */}
            <div className="flex items-center gap-2.5 text-xs font-mono">
              {/* Live Backend Indicator */}
              <div className={`px-2.5 py-1 rounded-full text-[11px] font-medium flex items-center gap-1.5 border transition-all ${
                backendOnline ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
              }`}>
                <span className={`h-2 w-2 rounded-full ${backendOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                <span>{backendOnline ? 'Backend online (replay of results.csv)' : 'Backend offline: nothing will be scored'}</span>
              </div>

              {/* Logout */}
              <button
                onClick={onLogout}
                className="text-slate-400 hover:text-white px-2.5 py-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Embedded Clarification Banner */}
      {embedded && (
        <div className="w-full max-w-5xl mx-auto mb-4 p-3 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shrink-0">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <span className="text-white font-bold">UPI Interceptor Mode: </span>
              <span className="text-slate-300">
                MuleNet is <strong>NOT a payment wallet</strong>. This screen is a mock-up showing where a recipient check could sit in a payment flow.
              </span>
            </div>
          </div>
          <span className="hidden sm:inline-block px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono text-[10px] font-semibold shrink-0">
            Real model output, replayed
          </span>
        </div>
      )}

      {/* Main Interactive Workspace */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 flex flex-col lg:flex-row items-center justify-center gap-8">
        
        {/* Left Explanation Column: How MuleNet Interception Works */}
        <div className="flex-1 max-w-md space-y-4 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/70 border border-indigo-500/40 text-indigo-300 text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Simulated UI over real model output</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
            See the Model's Decision at the Moment of Payment
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            This is a <strong className="text-white">simulated payment screen</strong>. The three examples below are
            real transactions from the IBM AML test stream, and the decision shown is the output the MuleNet model
            already produced for that account (<span className="font-mono">results/results.csv</span>). Nothing is scored
            live here, and accounts outside the dataset are reported as "not scored".
          </p>

          {/* Quick-Test Destination Selector */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-2.5">
            <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block font-mono">
              1. Choose a Test Scenario:
            </span>

            <div className="space-y-2">
              {/* Green: Verified Friend/Shop */}
              <button
                type="button"
                onClick={() => handleSelectPreset('SAFE')}
                className={`w-full p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                  receiverVpa === '0021884_8087CC340'
                    ? 'bg-emerald-950/60 border-emerald-500/60 ring-2 ring-emerald-500/20'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                    <span>🟢</span>
                    <span>Model says: ALLOW</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                    Real transaction • score 0.000 ($36.55)
                  </span>
                </div>
                <span className="text-xs text-emerald-400 font-mono font-bold">Allow</span>
              </button>

              {/* Yellow: New Unverified Contact */}
              <button
                type="button"
                onClick={() => handleSelectPreset('UNVERIFIED')}
                className={`w-full p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                  receiverVpa === '0221891_810B24C80'
                    ? 'bg-amber-950/60 border-amber-500/60 ring-2 ring-amber-500/20'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                    <span>🟡</span>
                    <span>Model says: STEP-UP</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                    Real transaction • score 0.016 ($248.86)
                  </span>
                </div>
                <span className="text-xs text-amber-400 font-mono font-bold">Review</span>
              </button>

              {/* Red: Compromised Mule Account */}
              <button
                type="button"
                onClick={() => handleSelectPreset('MULE')}
                className={`w-full p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                  receiverVpa === '0048308_811E3C9F0'
                    ? 'bg-rose-950/60 border-rose-500/60 ring-2 ring-rose-500/20'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
                    <span>🔴</span>
                    <span>Model says: HOLD</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                    Real flagged transaction • CYCLE ($14,161.55)
                  </span>
                </div>
                <span className="text-xs text-rose-400 font-mono font-bold">Hold</span>
              </button>
            </div>
          </div>

          {/* Third-Party App Selector Pills */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[11px] font-mono text-slate-400">Simulate App:</span>
            <button
              onClick={() => setUpiApp('GPAY')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                upiApp === 'GPAY' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              UPI App A
            </button>
            <button
              onClick={() => setUpiApp('PHONEPE')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                upiApp === 'PHONEPE' ? 'bg-purple-600 text-white shadow-md' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              UPI App B
            </button>
            <button
              onClick={() => setUpiApp('PAYTM')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                upiApp === 'PAYTM' ? 'bg-cyan-600 text-slate-950 shadow-md' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              UPI App C
            </button>
          </div>
        </div>

        {/* Right Column: Simulated Mobile Phone Frame */}
        <div className="relative w-[340px] sm:w-[380px] h-[660px] bg-slate-950 rounded-[44px] p-3 shadow-2xl border-4 border-slate-800 ring-1 ring-slate-700/50 flex flex-col shrink-0">
          
          {/* Mobile Phone Speaker Notch */}
          <div className="w-28 h-4 bg-slate-800 rounded-full mx-auto mb-2 shrink-0 flex items-center justify-center">
            <div className="w-10 h-1 bg-slate-700 rounded-full" />
          </div>

          {/* Mobile Screen Surface */}
          <div className="flex-1 bg-slate-900 rounded-[34px] overflow-hidden flex flex-col justify-between relative border border-slate-800/80">
            
            {/* Phone Top Status Bar */}
            <div className="px-4 py-1.5 flex items-center justify-between text-[11px] font-mono text-slate-400 select-none bg-slate-950/60">
              <span>9:41</span>
              <div className="flex items-center gap-1.5">
                <span>5G</span>
                <span>100%</span>
              </div>
            </div>

            {/* UPI App Header */}
            <div className={`px-4 py-3 flex items-center justify-between ${appStyle.headerBg}`}>
              <div className="flex items-center gap-2">
                <span className={`text-base font-black ${appStyle.logoColor}`}>
                  {appStyle.name}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">UPI Pay</span>
              </div>

              {/* Silent MuleNet Interceptor Badge */}
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-[9px] font-mono text-emerald-400 font-semibold">
                <ShieldCheck className="h-3 w-3 text-emerald-400" />
                <span>MuleNet Protected</span>
              </div>
            </div>

            {/* Simulated UPI Checkout Form */}
            <div className="p-4 flex-1 flex flex-col justify-between overflow-y-auto">
              
              <div className="space-y-3.5">
                {/* Recipient VPA / Account */}
                <div>
                  <label className="text-[11px] font-medium text-slate-400 block mb-1">
                    To account (ID from the dataset):
                  </label>
                  <input
                    type="text"
                    value={receiverVpa}
                    onChange={(e) => {
                      setReceiverVpa(e.target.value);
                      setSuccessReceipt(null);
                    }}
                    placeholder="Account ID from the dataset"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                  <div className="text-[10px] text-slate-400 mt-1 truncate">
                    Account: <span className="text-white font-medium">{receiverName}</span>
                  </div>
                </div>

                {/* Amount to Pay */}
                <div>
                  <label className="text-[11px] font-medium text-slate-400 block mb-1">
                    Paying Amount:
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-slate-400 font-bold text-base">
                      {currency === 'INR' ? '₹' : currency === 'EUR' ? '€' : '$'}
                    </span>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => {
                        setAmount(e.target.value);
                        setSuccessReceipt(null);
                      }}
                      placeholder="0.00"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-7 pr-3 py-2.5 text-lg font-mono font-bold text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      required
                    />
                  </div>
                </div>

                {/* Optional Note */}
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">
                    Add a note (Optional):
                  </label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="What's this for?"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none"
                  />
                </div>

                {/* Payment Source Bank */}
                <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-blue-600/30 text-blue-400 flex items-center justify-center font-bold text-[10px]">
                      SBI
                    </div>
                    <div>
                      <span className="font-semibold text-white block leading-tight">Demo Bank</span>
                      <span className="text-[10px] text-slate-400 font-mono">•••• 1049</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-mono">Active</span>
                </div>
              </div>

              {/* Clean Success Receipt (Only shown when safe) */}
              {successReceipt && (
                <div className="p-3 rounded-2xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-100 animate-in fade-in zoom-in-95 duration-200 space-y-1.5 my-2">
                  <div className="flex items-center gap-1.5 text-emerald-300 text-xs font-bold">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span>Demo payment of ${successReceipt.amount} released</span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-300 space-y-0.5 pt-1 border-t border-emerald-500/30">
                    <div className="flex justify-between">
                      <span>UPI Ref:</span>
                      <span className="text-white">{successReceipt.txn_id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Model output:</span>
                      <span className="text-emerald-400">no alert</span>
                    </div>
                  </div>
                </div>
              )}

              {/* UPI App "Pay" Action Button */}
              <button
                type="button"
                onClick={handleUpiPay}
                disabled={isIntercepting || !receiverVpa.trim() || !amount}
                className={`w-full py-3.5 px-4 rounded-2xl font-black text-sm tracking-wide shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${appStyle.accentBtn} disabled:opacity-50`}
              >
                {isIntercepting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>MuleNet Intercepting...</span>
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    <span>Pay ${amount || '0'} via {appStyle.name}</span>
                  </>
                )}
              </button>
            </div>

            {/* The MuleNet Security Alert Overlay (Interception Pop-Up) */}
            <MuleNetAlertOverlay
              isOpen={isAlertOpen}
              onClose={() => setIsAlertOpen(false)}
              scoreData={currentScore}
              amount={parseFloat(amount) || 500}
              currency={currency}
              receiverVpa={receiverVpa}
              upiApp={upiApp}
              onCancelPayment={handleCancelFromAlert}
              onProceedAnyway={handleProceedAnywayFromAlert}
            />
          </div>

          {/* Bottom Home Indicator Bar */}
          <div className="w-32 h-1 bg-slate-700 rounded-full mx-auto mt-2 shrink-0" />
        </div>
      </main>

      {/* Footer */}
      {!embedded && (
        <footer className="border-t border-slate-800 bg-slate-950/80 py-2.5 px-4 text-center text-[11px] text-slate-500 font-mono">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>MuleNet Real-Time Interceptor • Integrated into Banking & UPI Rails</span>
            <div className="flex items-center gap-3">
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
          </div>
        </footer>
      )}
    </div>
  );
};
