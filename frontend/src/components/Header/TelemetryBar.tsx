import React from 'react';
import { 
  Cpu, 
  Activity, 
  ShieldCheck, 
  Database, 
  UserCheck, 
  Play, 
  Pause, 
  Zap, 
  Server, 
  FileText, 
  Layers,
  Clock,
  Radio
} from 'lucide-react';
import { SystemTelemetry } from '../../types';
import { DataSourceMode } from '../../services/api';

interface TelemetryBarProps {
  telemetry: SystemTelemetry | null;
  isStreaming: boolean;
  dataSource: DataSourceMode;
  fastApiConnected: boolean;
  onToggleStreaming: () => void;
  onTriggerBurst: () => void;
  onSwitchDataSource: (mode: DataSourceMode) => void;
  onOpenAudit: () => void;
  speedMs: number;
  onChangeSpeed: (ms: number) => void;
}

export const TelemetryBar: React.FC<TelemetryBarProps> = ({
  telemetry,
  isStreaming,
  dataSource,
  fastApiConnected,
  onToggleStreaming,
  onTriggerBurst,
  onSwitchDataSource,
  onOpenAudit,
  speedMs,
  onChangeSpeed
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-700/80 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-slate-200">
      {/* Left: Branding & Core Host Telemetry */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {/* IBM Brand Accent Icon */}
          <div className="h-8 w-8 rounded bg-gradient-to-br from-ibm-blue to-ibm-navy border border-ibm-cyan/40 flex items-center justify-center shadow-lg shadow-ibm-blue/20">
            <ShieldCheck className="h-4.5 w-4.5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-white text-base">MuleNet</span>
              <span className="text-xs px-1.5 py-0.5 rounded font-mono bg-ibm-blue/20 text-ibm-cyan border border-ibm-blue/40 font-medium">
                AML Stream Monitor
              </span>
              <div className="flex items-center gap-1.5 ml-1">
                <span className="relative flex h-2.5 w-2.5">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isStreaming ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isStreaming ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                </span>
                <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                  {isStreaming ? (dataSource === 'FASTAPI_BACKEND' ? 'REPLAY' : 'SIMULATED') : 'PAUSED'}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 font-sans">
              Real-Time Anti-Money Laundering & Mule Ring Prediction Engine
            </p>
          </div>
        </div>

        {/* Host Telemetry Badge */}
        <div className="hidden xl:flex items-center gap-2 bg-slate-800/90 border border-slate-700 px-2.5 py-1 rounded text-xs">
          <Server className="h-3.5 w-3.5 text-ibm-cyan" />
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400 uppercase font-mono">Platform</span>
              <span className="font-mono text-[11px] font-semibold text-slate-200">
                {dataSource === 'FASTAPI_BACKEND' ? (telemetry?.platform || 'Replay of model output') : 'SIMULATED DATA (mock generator)'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
              <span className="text-ibm-teal font-medium">Not scored live in this UI</span>
            </div>
          </div>
        </div>
      </div>

      {/* Center: System Status Badges */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Stream Source Badge */}
        <div className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/80 px-2.5 py-1 rounded text-xs">
          <Radio className={`h-3 w-3 ${dataSource === 'FASTAPI_BACKEND' ? (fastApiConnected ? 'text-emerald-400 animate-pulse' : 'text-rose-400') : 'text-ibm-cyan'}`} />
          <span className="text-slate-400 text-[11px]">Source:</span>
          <span className="font-mono font-medium text-[11px] text-slate-200">
            {dataSource === 'FASTAPI_BACKEND' 
              ? (fastApiConnected ? 'REPLAY OF results.csv' : 'BACKEND OFFLINE') 
              : 'MOCK (SIMULATED)'}
          </span>
        </div>

        {/* Audit DB Badge */}
        <div className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/80 px-2.5 py-1 rounded text-xs">
          <Database className="h-3 w-3 text-emerald-400" />
          <span className="text-slate-400 text-[11px]">Audit DB:</span>
          <span className="font-mono font-medium text-[11px] text-emerald-400">
            IN-MEMORY (demo)
          </span>
        </div>

        {/* Human-in-the-Loop Mode Badge */}
        <div className="flex items-center gap-1.5 bg-slate-800/80 border border-ibm-blue/40 px-2.5 py-1 rounded text-xs bg-ibm-blue/5">
          <UserCheck className="h-3 w-3 text-ibm-cyan" />
          <span className="text-slate-400 text-[11px]">HITL Mode:</span>
          <span className="font-mono font-medium text-[11px] text-ibm-cyan">
            {telemetry?.hitlModeActive ? 'ACTIVE (Tier 2 Desk)' : 'STANDBY'}
          </span>
        </div>
      </div>

      {/* Model quality card (real held-out test metrics, only when the real backend is connected) */}
      <div className="flex items-center gap-3 bg-slate-800/90 border border-slate-700 px-3 py-1 rounded">
        {[
          ['Test PR-AUC', telemetry?.modelMetrics?.testPrAuc],
          ['Precision', telemetry?.modelMetrics?.testPrecision],
          ['Recall', telemetry?.modelMetrics?.testRecall]
        ].map(([label, val], i) => (
          <div key={String(label)} className={`flex items-center gap-1.5 ${i < 2 ? 'border-r border-slate-700 pr-3' : ''}`}>
            <div>
              <div className="text-[10px] text-slate-400 font-mono leading-none">{label as string}</div>
              <div className="font-mono text-xs font-bold text-emerald-400 leading-tight">
                {dataSource === 'FASTAPI_BACKEND' && typeof val === 'number' ? (val as number).toFixed(3) : 'n/a'}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Right Controls: Stream controls, Burst, Mode, Audit Modal */}
      <div className="flex items-center gap-2">
        {/* Play / Pause */}
        <button
          onClick={onToggleStreaming}
          title={isStreaming ? 'Pause Stream' : 'Resume Stream'}
          className={`px-2.5 py-1 rounded border text-xs font-mono font-medium flex items-center gap-1.5 transition-colors ${
            isStreaming
              ? 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-200'
              : 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white'
          }`}
        >
          {isStreaming ? (
            <>
              <Pause className="h-3 w-3 text-amber-400" />
              <span>PAUSE</span>
            </>
          ) : (
            <>
              <Play className="h-3 w-3 text-white fill-white" />
              <span>RESUME</span>
            </>
          )}
        </button>

        {/* Speed Selector */}
        <select
          value={speedMs}
          onChange={(e) => onChangeSpeed(Number(e.target.value))}
          className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-slate-300 focus:outline-none focus:border-ibm-blue"
          title="Stream Speed"
        >
          <option value={800}>Fast (0.8s)</option>
          <option value={1800}>Norm (1.8s)</option>
          <option value={3500}>Slow (3.5s)</option>
        </select>

        {/* Inject Attack Burst (mock generator only) */}
        {dataSource === 'MOCK_SIMULATOR' && (
        <button
          onClick={onTriggerBurst}
          className="px-2.5 py-1 rounded bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/50 text-rose-300 text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
          title="Inject Synthetic Mule Ring Activity"
        >
          <Zap className="h-3 w-3 text-rose-400 fill-rose-400" />
          <span className="hidden sm:inline">Inject Mule Attack</span>
          <span className="sm:hidden">Inject</span>
        </button>
        )}

        {/* Backend Switch */}
        <button
          onClick={() => onSwitchDataSource(dataSource === 'MOCK_SIMULATOR' ? 'FASTAPI_BACKEND' : 'MOCK_SIMULATOR')}
          className={`px-2 py-1 rounded border text-[11px] font-mono transition-colors flex items-center gap-1 ${
            dataSource === 'FASTAPI_BACKEND'
              ? 'bg-ibm-blue/20 border-ibm-blue text-ibm-cyan'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle between the simulated mock generator and the real replay backend (http://localhost:8000)"
        >
          <Layers className="h-3 w-3" />
          <span className="hidden lg:inline">{dataSource === 'FASTAPI_BACKEND' ? 'Real replay' : 'Mock (simulated)'}</span>
        </button>

        {/* Audit Log Modal Trigger */}
        <button
          onClick={onOpenAudit}
          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1 transition-colors"
          title="Open Immutable Regulatory Audit Ledger"
        >
          <FileText className="h-3 w-3 text-slate-400" />
          <span className="hidden md:inline">Audit Log</span>
        </button>
      </div>
    </header>
  );
};
