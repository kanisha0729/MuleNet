import { mockMuleNetService, MockMuleNetService } from './mockService';
import { fastApiService, FastApiMuleNetService } from './fastapiService';
import { Transaction, SystemTelemetry, MuleGraphData, AuditRecord, SARReport } from '../types';

export type DataSourceMode = 'MOCK_SIMULATOR' | 'FASTAPI_BACKEND';

export interface IMuleNetService {
  subscribeStream(
    onTxn: (txn: Transaction) => void,
    onTelemetry: (telemetry: SystemTelemetry) => void,
    onStatusChange?: (connected: boolean) => void
  ): () => void;
  submitDecision(txnId: string, action: 'APPROVE' | 'BLOCK' | 'KYC_STEPUP', notes: string): Promise<boolean>;
  fileSAR(txn: Transaction, notes: string): Promise<SARReport | null>;
  fetchMuleRing(txnId: string): Promise<MuleGraphData | null>;
  getAuditLog(): Promise<AuditRecord[]> | AuditRecord[];
}

class MuleNetServiceManager implements IMuleNetService {
  private mode: DataSourceMode = 'FASTAPI_BACKEND';

  public setMode(mode: DataSourceMode) {
    this.mode = mode;
  }

  public getMode(): DataSourceMode {
    return this.mode;
  }

  public subscribeStream(
    onTxn: (txn: Transaction) => void,
    onTelemetry: (telemetry: SystemTelemetry) => void,
    onStatusChange?: (connected: boolean) => void
  ): () => void {
    if (this.mode === 'FASTAPI_BACKEND') {
      return fastApiService.subscribeStream(onTxn, onTelemetry, onStatusChange);
    } else {
      if (onStatusChange) onStatusChange(true);
      return mockMuleNetService.subscribeStream(onTxn, onTelemetry);
    }
  }

  public async submitDecision(
    txnId: string, 
    action: 'APPROVE' | 'BLOCK' | 'KYC_STEPUP', 
    notes: string
  ): Promise<boolean> {
    if (this.mode === 'FASTAPI_BACKEND') {
      return fastApiService.submitDecision(txnId, action, notes);
    }
    return mockMuleNetService.submitDecision(txnId, action, notes);
  }

  public async fileSAR(txn: Transaction, notes: string): Promise<SARReport | null> {
    if (this.mode === 'FASTAPI_BACKEND') {
      return fastApiService.fileSAR(txn, notes);
    }
    return mockMuleNetService.fileSAR(txn, notes);
  }

  public async fetchMuleRing(txnId: string): Promise<MuleGraphData | null> {
    if (this.mode === 'FASTAPI_BACKEND') {
      const data = await fastApiService.fetchMuleRing(txnId);
      if (data) return data;
    }
    return mockMuleNetService.fetchMuleRing(txnId);
  }

  public getAuditLog(): Promise<AuditRecord[]> | AuditRecord[] {
    if (this.mode === 'FASTAPI_BACKEND') {
      return fastApiService.getAuditLog();
    }
    return mockMuleNetService.getAuditLog();
  }

  // Simulation controls
  public injectSuspiciousBurst() {
    mockMuleNetService.injectSuspiciousBurst();
  }

  public setStreamSpeed(speedMs: number) {
    mockMuleNetService.setStreamSpeed(speedMs);
  }

  public pauseStream() {
    mockMuleNetService.stopStreaming();
  }

  public resumeStream() {
    mockMuleNetService.startStreaming();
  }

  public getInitialMockTransactions(): Transaction[] {
    return mockMuleNetService.getTransactions();
  }
}

export const muleNetService = new MuleNetServiceManager();
