export interface ScoreRequest {
  txn_id?: string;
  timestamp?: string;
  sender: string;
  receiver: string;
  amount: number;
  currency: 'USD' | 'EUR' | 'INR';
}

export interface ScoreExplanation {
  incoming_senders: string;
  outgoing_receivers: string;
  forwarding_speed: string;
  passthrough_amount: string;
}

export interface FeatureMetrics {
  fan_in_count: number;
  fan_out_count: number;
  time_since_deposit: string;
  outflow_inflow_ratio: string;
}

export interface ScoreResponse {
  txn_id: string;
  sender: string;
  receiver: string;
  amount: number;
  currency: string;
  risk_score: number; // 0 to 100
  mulenet_score?: number; // 0 to 100
  decision: 'ALLOW' | 'REVIEW' | 'HOLD' | 'UNSCORED';
  model_score?: number; // raw model score 0..1 (not a calibrated probability)
  source_txn_id?: string;
  status_text: string;
  ai_narrative: string;
  metrics: FeatureMetrics;
  explanation: ScoreExplanation;
  spam_flags?: string[];
  features?: Array<{ name: string; value: string; impact: string }>;
  engine: string;
  timestamp: string;
  isSimulated?: boolean;
}

const BACKEND_URL = 'http://localhost:8000';

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(`${BACKEND_URL}/api/telemetry`, {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}

export async function scoreTransferApi(data: ScoreRequest): Promise<ScoreResponse> {
  const txn_id = data.txn_id || `TXN_${Date.now()}`;
  const timestamp = data.timestamp || new Date().toISOString();

  const payload = {
    txn_id,
    timestamp,
    sender: data.sender.trim(),
    receiver: data.receiver.trim(),
    amount: Number(data.amount),
    currency: data.currency
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const response = await fetch(`${BACKEND_URL}/score`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const result = await response.json();
      return {
        ...result,
        isSimulated: false
      };
    }
    throw new Error(`Backend returned status ${response.status}`);
  } catch {
    return {
      txn_id,
      sender: payload.sender,
      receiver: payload.receiver,
      amount: payload.amount,
      currency: payload.currency,
      risk_score: 0,
      decision: 'UNSCORED',
      status_text: 'Not scored: scoring backend is offline',
      ai_narrative:
        'No score available: start the backend (see README) so the UI can look up the real MuleNet model output. Nothing is simulated.',
      metrics: { fan_in_count: 0, fan_out_count: 0, time_since_deposit: 'n/a', outflow_inflow_ratio: 'n/a' },
      explanation: { incoming_senders: 'n/a', outgoing_receivers: 'n/a', forwarding_speed: 'n/a', passthrough_amount: 'n/a' },
      engine: 'none (backend offline)',
      timestamp,
      isSimulated: false
    };
  }
}
