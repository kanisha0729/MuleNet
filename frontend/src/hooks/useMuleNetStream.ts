import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Transaction, 
  SystemTelemetry, 
  MuleGraphData, 
  AuditRecord, 
  SARReport, 
  DecisionStatus 
} from '../types';
import { muleNetService, DataSourceMode } from '../services/api';

export function useMuleNetStream() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);
  const [telemetry, setTelemetry] = useState<SystemTelemetry | null>(null);
  const [graphData, setGraphData] = useState<MuleGraphData | null>(null);
  const [auditLog, setAuditLog] = useState<AuditRecord[]>([]);
  const [isStreaming, setIsStreaming] = useState<boolean>(true);
  const [dataSource, setDataSource] = useState<DataSourceMode>('FASTAPI_BACKEND');
  const [fastApiConnected, setFastApiConnected] = useState<boolean>(false);
  const [speedMs, setSpeedMs] = useState<number>(1800);
  const [filterStatus, setFilterStatus] = useState<'ALL' | DecisionStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoadingGraph, setIsLoadingGraph] = useState<boolean>(false);
  const [lastActionToast, setLastActionToast] = useState<{ message: string; type: 'success' | 'danger' | 'info' } | null>(null);

  // Subscribe to live stream
  useEffect(() => {
    const unsubscribe = muleNetService.subscribeStream(
      (newTxn: Transaction) => {
        setTransactions((prev) => {
          const next = [newTxn, ...prev];
          if (next.length > 200) next.pop();
          return next;
        });

        // Update selected txn if it's the one modified or if none is selected
        setSelectedTxn((current) => {
          if (!current) return newTxn;
          if (current.id === newTxn.id) return newTxn;
          return current;
        });
      },
      (newTelemetry: SystemTelemetry) => {
        setTelemetry(newTelemetry);
      },
      (connected: boolean) => {
        setFastApiConnected(connected);
      }
    );

    // Initial audit log
    const loadAudit = async () => {
      const logs = await muleNetService.getAuditLog();
      setAuditLog(logs);
    };
    loadAudit();

    return () => {
      unsubscribe();
    };
  }, [dataSource]);

  // Load graph whenever selected transaction changes
  useEffect(() => {
    if (!selectedTxn) return;
    let isMounted = true;
    setIsLoadingGraph(true);

    muleNetService.fetchMuleRing(selectedTxn.id).then((data) => {
      if (isMounted && data) {
        setGraphData(data);
        setIsLoadingGraph(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [selectedTxn?.id]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((txn) => {
      const matchesStatus = filterStatus === 'ALL' || txn.decision === filterStatus;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        txn.id.toLowerCase().includes(q) ||
        txn.sender.name.toLowerCase().includes(q) ||
        txn.receiver.name.toLowerCase().includes(q) ||
        txn.sender.account.toLowerCase().includes(q) ||
        txn.receiver.account.toLowerCase().includes(q) ||
        txn.channel.toLowerCase().includes(q);

      return matchesStatus && matchesSearch;
    });
  }, [transactions, filterStatus, searchQuery]);

  const toggleStreaming = useCallback(() => {
    if (isStreaming) {
      muleNetService.pauseStream();
      setIsStreaming(false);
    } else {
      muleNetService.resumeStream();
      setIsStreaming(true);
    }
  }, [isStreaming]);

  const changeSpeed = useCallback((newSpeedMs: number) => {
    setSpeedMs(newSpeedMs);
    muleNetService.setStreamSpeed(newSpeedMs);
  }, []);

  const switchDataSource = useCallback((mode: DataSourceMode) => {
    setTransactions(mode === 'MOCK_SIMULATOR' ? muleNetService.getInitialMockTransactions() : []);
    setSelectedTxn(null);
    setGraphData(null);
    setDataSource(mode);
    muleNetService.setMode(mode);
  }, []);

  const triggerMuleBurst = useCallback(() => {
    muleNetService.injectSuspiciousBurst();
    setLastActionToast({
      message: 'Simulated attack burst injected into the MOCK generator (not real data).',
      type: 'danger'
    });
    setTimeout(() => setLastActionToast(null), 4000);
  }, []);

  const handleDecision = useCallback(async (
    txnId: string, 
    action: 'APPROVE' | 'BLOCK' | 'KYC_STEPUP', 
    notes: string
  ) => {
    const success = await muleNetService.submitDecision(txnId, action, notes);
    if (success) {
      // Update local state
      setTransactions((prev) => 
        prev.map((t) => {
          if (t.id === txnId) {
            return {
              ...t,
              decision: action === 'APPROVE' ? 'ALLOW' : (action === 'BLOCK' ? 'BLOCK' : 'REVIEW'),
              muleRiskScore: action === 'APPROVE' ? Math.min(t.muleRiskScore, 15) : (action === 'BLOCK' ? 98 : t.muleRiskScore),
              humanReviewed: true,
              reviewedBy: 'Compliance Desk 4B',
              reviewNotes: notes
            };
          }
          return t;
        })
      );

      if (selectedTxn?.id === txnId) {
        setSelectedTxn((prev) => prev ? {
          ...prev,
          decision: action === 'APPROVE' ? 'ALLOW' : (action === 'BLOCK' ? 'BLOCK' : 'REVIEW'),
          muleRiskScore: action === 'APPROVE' ? Math.min(prev.muleRiskScore, 15) : (action === 'BLOCK' ? 98 : prev.muleRiskScore),
          humanReviewed: true,
          reviewedBy: 'Compliance Desk 4B',
          reviewNotes: notes
        } : null);
      }

      // Refresh audit logs
      const updatedLogs = await muleNetService.getAuditLog();
      setAuditLog(updatedLogs);

      setLastActionToast({
        message: `Decision logged: ${action} on ${txnId} (demo audit log, in memory).`,
        type: action === 'BLOCK' ? 'danger' : 'success'
      });
      setTimeout(() => setLastActionToast(null), 4500);
    }
    return success;
  }, [selectedTxn?.id]);

  const handleFileSAR = useCallback(async (txn: Transaction, notes: string): Promise<SARReport | null> => {
    const report = await muleNetService.fileSAR(txn, notes);
    if (report) {
      const updatedLogs = await muleNetService.getAuditLog();
      setAuditLog(updatedLogs);
      setLastActionToast({
        message: `SAR draft generated (${report.reportId}). Nothing was filed.`,
        type: 'info'
      });
      setTimeout(() => setLastActionToast(null), 5000);
    }
    return report;
  }, []);

  return {
    transactions,
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
  };
}
