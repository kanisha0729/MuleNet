import { 
  Transaction, 
  SystemTelemetry, 
  MuleGraphData, 
  AuditRecord, 
  SARReport 
} from '../types';

export class FastApiMuleNetService {
  private baseUrl: string;
  private wsUrl: string;
  private socket: WebSocket | null = null;
  private reconnectTimeout: any = null;
  private isConnected: boolean = false;

  constructor(baseUrl: string = 'http://localhost:8000') {
    this.baseUrl = baseUrl;
    this.wsUrl = baseUrl.replace(/^http/, 'ws') + '/ws/stream';
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }

  public subscribeStream(
    onTxn: (txn: Transaction) => void,
    onTelemetry: (telemetry: SystemTelemetry) => void,
    onStatusChange?: (connected: boolean) => void
  ): () => void {
    let disposed = false;
    const connect = () => {
      if (disposed) return;
      try {
        this.socket = new WebSocket(this.wsUrl);

        this.socket.onopen = () => {
          this.isConnected = true;
          if (onStatusChange) onStatusChange(true);
          console.log('[FastAPI] Connected to MuleNet stream at', this.wsUrl);
        };

        this.socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'TRANSACTION' && data.payload) {
              onTxn(data.payload);
            } else if (data.type === 'TELEMETRY' && data.payload) {
              onTelemetry(data.payload);
            }
          } catch (e) {
            console.error('[FastAPI] Message parse error:', e);
          }
        };

        this.socket.onclose = () => {
          if (disposed) return;
          this.isConnected = false;
          if (onStatusChange) onStatusChange(false);
          console.warn('[FastAPI] Socket closed. Reconnecting in 3s...');
          this.reconnectTimeout = setTimeout(connect, 3000);
        };

        this.socket.onerror = (err) => {
          console.warn('[FastAPI] WebSocket connection failed:', err);
          this.isConnected = false;
          if (onStatusChange) onStatusChange(false);
          this.socket?.close();
        };
      } catch (err) {
        console.warn('[FastAPI] WebSocket connection attempt error:', err);
        this.isConnected = false;
        if (onStatusChange) onStatusChange(false);
        this.reconnectTimeout = setTimeout(connect, 4000);
      }
    };

    connect();

    return () => {
      disposed = true;
      if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
      if (this.socket) {
        this.socket.close();
        this.socket = null;
      }
      this.isConnected = false;
    };
  }

  public async submitDecision(
    txnId: string, 
    action: 'APPROVE' | 'BLOCK' | 'KYC_STEPUP', 
    notes: string
  ): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txnId, action, notes })
      });
      return res.ok;
    } catch (err) {
      console.error('[FastAPI] submitDecision error:', err);
      return false;
    }
  }

  public async fileSAR(txn: Transaction, notes: string): Promise<SARReport | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/sar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txn, notes })
      });
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch (err) {
      console.error('[FastAPI] fileSAR error:', err);
      return null;
    }
  }

  public async fetchMuleRing(txnId: string): Promise<MuleGraphData | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/graph/${txnId}`);
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch (err) {
      console.error('[FastAPI] fetchMuleRing error:', err);
      return null;
    }
  }

  public async getAuditLog(): Promise<AuditRecord[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/audit-log`);
      if (res.ok) {
        return await res.json();
      }
      return [];
    } catch (err) {
      console.error('[FastAPI] getAuditLog error:', err);
      return [];
    }
  }
}

export const fastApiService = new FastApiMuleNetService();
