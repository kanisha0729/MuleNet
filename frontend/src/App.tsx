import React, { useState } from 'react';
import { useMuleNetStream } from './hooks/useMuleNetStream';
import { TelemetryBar } from './components/Header/TelemetryBar';
import { TransactionStream } from './components/StreamTable/TransactionStream';
import { MuleRiskInspector } from './components/RiskInspector/MuleRiskInspector';
import { MuleNetworkGraph } from './components/NetworkGraph/MuleNetworkGraph';
import { SystemMetrics } from './components/Analytics/SystemMetrics';
import { AuditLedgerModal } from './components/Analytics/AuditLedgerModal';
import { SarExportModal } from './components/Analytics/SarExportModal';
import { ConsumerDashboard } from './components/Consumer/ConsumerDashboard';
import { AuthModal } from './components/Auth/AuthModal';
import { ErrorBoundary } from './components/UI/ErrorBoundary';
import { UserProfile, DEMO_USERS } from './types/auth';
import { Transaction } from './types';
import { CheckCircle2, AlertTriangle, ShieldAlert, ArrowLeft, Layers } from 'lucide-react';

export function App() {
  // Safe authentication session state initialization
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('mulenet_user');
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      if (!parsed || !parsed.name) return null;

      // Ensure full sanitized object with valid fallbacks
      return {
        ...DEMO_USERS.regular,
        ...parsed,
        balance: typeof parsed.balance === 'number' && !isNaN(parsed.balance) ? parsed.balance : 24850.00,
        currency: (parsed.currency && typeof parsed.currency === 'string' && parsed.currency.length === 3) ? parsed.currency : 'USD',
        trustScore: typeof parsed.trustScore === 'number' ? parsed.trustScore : 98,
        accountNumber: parsed.accountNumber || 'ACC_10492',
        role: parsed.role || 'CUSTOMER',
        tier: parsed.tier || 'Verified Personal Customer'
      };
    } catch {
      return null;
    }
  });

  // View mode: 'CONSUMER' (default) | 'ENTERPRISE'
  const [viewMode, setViewMode] = useState<'CONSUMER' | 'ENTERPRISE'>('CONSUMER');

  const {
    filteredTransactions,
    selectedTxn,
    setSelectedTxn,
    telemetry,
    graphData,
    isLoadingGraph,
    auditLog,
    isStreaming,
    speedMs,
    dataSource,
    fastApiConnected,
    filterStatus,
    setFilterStatus,
    searchQuery,
    setSearchQuery,
    toggleStreaming,
    changeSpeed,
    switchDataSource,
    triggerMuleBurst,
    handleDecision,
    handleFileSAR,
    lastActionToast
  } = useMuleNetStream();

  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isSarModalOpen, setIsSarModalOpen] = useState(false);
  const [sarTxn, setSarTxn] = useState<Transaction | null>(null);

  const handleLogin = (newUser: UserProfile) => {
    setUser(newUser);
    try {
      localStorage.setItem('mulenet_user', JSON.stringify(newUser));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  };

  const handleLogout = () => {
    setUser(null);
    try {
      localStorage.removeItem('mulenet_user');
    } catch (e) {
      console.warn('LocalStorage clear failed:', e);
    }
  };

  const handleOpenSAR = (txn: Transaction) => {
    setSarTxn(txn);
    setIsSarModalOpen(true);
  };

  const handleQuickDecision = (txnId: string, action: 'APPROVE' | 'BLOCK') => {
    handleDecision(
      txnId,
      action,
      action === 'APPROVE'
        ? 'Quick Allow verified by Tier-2 Compliance desk'
        : 'Immediate Block & Account Freeze: High Risk Mule Indicator'
    );
  };

  // If unauthenticated, render AuthModal (with Sign In and Sign Up tabs)
  if (!user) {
    return (
      <ErrorBoundary>
        <AuthModal onLogin={handleLogin} />
      </ErrorBoundary>
    );
  }

  // If in Consumer View (default multi-panel wide view)
  if (viewMode === 'CONSUMER') {
    return (
      <ErrorBoundary>
        <div className="relative min-h-screen">
          <ConsumerDashboard 
            currentUser={user}
            onLogout={handleLogout}
            onSwitchToEnterprise={() => setViewMode('ENTERPRISE')}
          />
        </div>
      </ErrorBoundary>
    );
  }

  // Enterprise Operations Desk View
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-x-hidden">
        {/* View Switcher Banner */}
        <div className="bg-indigo-950/80 border-b border-indigo-500/30 px-4 py-1.5 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2 text-indigo-200">
            <span className="font-semibold text-white">Compliance Operations Desk View</span>
            <span>•</span>
            <span className="text-[11px] text-indigo-300">{dataSource === 'FASTAPI_BACKEND' ? 'Replay of real model output' : 'SIMULATED DATA'}</span>
          </div>
          <button
            onClick={() => setViewMode('CONSUMER')}
            className="px-2.5 py-0.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-3 w-3" />
            <span>Back to SafePay Dashboard</span>
          </button>
        </div>

        {dataSource === 'MOCK_SIMULATOR' ? (
          <div className="bg-rose-950/80 border-b border-rose-500/40 px-4 py-1 text-[11px] font-mono text-rose-200 text-center">
            SIMULATED DATA: accounts, scores and metrics below come from a mock generator, not from the MuleNet model. Switch to "Real replay" for model output.
          </div>
        ) : !fastApiConnected ? (
          <div className="bg-amber-950/80 border-b border-amber-500/40 px-4 py-1 text-[11px] font-mono text-amber-200 text-center">
            Backend offline: start it (see README) to replay the real model output. Nothing is shown until it connects.
          </div>
        ) : (
          <div className="bg-emerald-950/60 border-b border-emerald-500/30 px-4 py-1 text-[11px] font-mono text-emerald-200 text-center">
            Replay of results/results.csv: scores were produced by the MuleNet model on the IBM AML HI-Small test stream. Not scored live in this UI.
          </div>
        )}

        {/* 1. Top Navigation & Telemetry Bar */}
        <TelemetryBar
          telemetry={telemetry}
          isStreaming={isStreaming}
          dataSource={dataSource}
          fastApiConnected={fastApiConnected}
          onToggleStreaming={toggleStreaming}
          onTriggerBurst={triggerMuleBurst}
          onSwitchDataSource={switchDataSource}
          onOpenAudit={() => setIsAuditModalOpen(true)}
          speedMs={speedMs}
          onChangeSpeed={changeSpeed}
        />

        {/* Floating Action Toast Notification */}
        {lastActionToast && (
          <div className={`fixed top-20 right-4 z-50 flex items-center gap-2 px-3.5 py-2 rounded-lg shadow-2xl border text-xs font-mono font-medium animate-in fade-in slide-in-from-top-2 duration-200 backdrop-blur-md ${
            lastActionToast.type === 'danger'
              ? 'bg-rose-950/90 text-rose-200 border-rose-500/60 shadow-rose-950/80'
              : lastActionToast.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/60 shadow-emerald-950/80'
              : 'bg-ibm-blue/90 text-white border-ibm-cyan/60 shadow-ibm-blue/80'
          }`}>
            {lastActionToast.type === 'danger' && <ShieldAlert className="h-4 w-4 text-rose-400" />}
            {lastActionToast.type === 'success' && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
            {lastActionToast.type === 'info' && <AlertTriangle className="h-4 w-4 text-ibm-cyan" />}
            <span>{lastActionToast.message}</span>
          </div>
        )}

        {/* 2. Main Dashboard Split View */}
        <main className="flex-1 p-3 flex flex-col gap-3 min-h-0">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-[640px]">
            {/* Left Column: Incoming Transaction Stream & Live Queue (5 cols) */}
            <div className="lg:col-span-5 h-[640px] lg:h-full">
              <TransactionStream
                transactions={filteredTransactions}
                selectedTxn={selectedTxn}
                onSelectTxn={setSelectedTxn}
                filterStatus={filterStatus}
                onFilterChange={setFilterStatus}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onQuickDecision={handleQuickDecision}
              />
            </div>

            {/* Right Column: Selected Transaction Deep-Dive & Mule Network Graph (7 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-3 h-[640px] lg:h-full">
              {/* Upper: Mule Risk Inspector (Selected Transaction) */}
              <div className="flex-1 min-h-[360px]">
                <MuleRiskInspector
                  transaction={selectedTxn}
                  onDecision={handleDecision}
                  onOpenSAR={handleOpenSAR}
                />
              </div>

              {/* Lower: Interactive Mule Syndicate & Layering Topology Network Graph */}
              <div className="h-[270px]">
                <MuleNetworkGraph
                  graphData={graphData}
                  isLoading={isLoadingGraph}
                  selectedTxnId={selectedTxn?.id}
                />
              </div>
            </div>
          </div>

          {/* 3. Bottom Row: System Telemetry & Regulatory Metrics */}
          <div className="mt-1">
            <SystemMetrics telemetry={telemetry} />
          </div>
        </main>

        {/* 4. Modals */}
        <AuditLedgerModal
          isOpen={isAuditModalOpen}
          onClose={() => setIsAuditModalOpen(false)}
          auditLog={auditLog}
        />

        <SarExportModal
          isOpen={isSarModalOpen}
          onClose={() => {
            setIsSarModalOpen(false);
            setSarTxn(null);
          }}
          transaction={sarTxn}
          onFileSAR={handleFileSAR}
        />
      </div>
    </ErrorBoundary>
  );
}

export default App;
