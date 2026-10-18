export type DecisionStatus = 'ALLOW' | 'REVIEW' | 'BLOCK';

export type MuleTypology = 
  | 'RAPID_DISPERSAL'        // High-velocity in-and-out layering
  | 'STRUCTURING_SMURF'      // Multiple sub-threshold transactions
  | 'DORMANT_ACTIVATION'     // Suddenly active account with high volume
  | 'CROSS_BORDER_FUNNEL'    // Multi-jurisdictional hop into crypto/cashout
  | 'SYNTHETIC_IDENTITY'     // Anomalous device/IP and high degree centrality
  | 'CLEAN_TRANSIT';         // Legitimate standard flow

export interface FeatureAttribution {
  feature: string;
  impact: number; // positive = increased mule risk, negative = lowered
  description: string;
  category: 'VELOCITY' | 'GRAPH' | 'DEVICE' | 'AMOUNT' | 'BEHAVIOR';
}

export interface Transaction {
  id: string;
  timestamp: string;
  sender: {
    name: string;
    account: string;
    bank: string;
    country: string;
    flag: string;
    accountAgeDays: number;
    kycTier: string;
  };
  receiver: {
    name: string;
    account: string;
    bank: string;
    country: string;
    flag: string;
    isSuspectedMule: boolean;
    degreeCentrality: number;
  };
  amount: number;
  currency: 'USD' | 'EUR' | 'GBP' | 'SGD' | 'CHF';
  channel: string;
  muleRiskScore: number; // 0 to 100
  decision: DecisionStatus;
  typology: string;
  features: FeatureAttribution[];
  ruleAlerts: string[];
  latencyMs: number;
  /** Only set by the real backend: the model's own decision and the dataset ground-truth label. */
  modelDecision?: string;
  datasetLabel?: number;
  humanReviewed?: boolean;
  reviewedBy?: string;
  reviewNotes?: string;
}

export interface GraphNode {
  id: string;
  label: string;
  account: string;
  type: 'VICTIM' | 'MULE_ORIGIN' | 'MULE_LAYER' | 'SUSPECT_TARGET' | 'CASHOUT' | 'CRYPTO_EXCHANGE';
  riskScore: number;
  flagged?: boolean;
  amount?: number;
  country: string;
}

export interface GraphLink {
  source: string;
  target: string;
  amount: number;
  currency: string;
  timestamp: string;
  isLayeringHop: boolean;
}

export interface MuleGraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface SystemTelemetry {
  platform: string;
  hostArchitecture: string; // "s390x"
  accelerator: string;
  acceleratorLoad: number; // 84%
  cpacfCryptoEngine: 'ACTIVE_HARDWARE_ACCELERATED' | 'SOFTWARE_FALLBACK';
  throughputTps: number; // e.g. 14,250
  avgLatencyMs: number; // e.g. 1.42
  p95LatencyMs: number; // e.g. 3.10
  p99LatencyMs: number; // e.g. 4.85
  auditDbStatus: 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED';
  hitlModeActive: boolean;
  sourceStream: string;
  totalTransactionsProcessed: number;
  decisionCounts: {
    allow: number;
    review: number;
    block: number;
  };
  totalVolumeUSD: number;
  /** Real held-out test metrics read from artifacts/meta.json (only set by the real backend). */
  modelMetrics?: {
    testPrAuc?: number | null;
    testPrecision?: number | null;
    testRecall?: number | null;
    threshold?: number | null;
    trees?: number | null;
  };
}

export interface AuditRecord {
  id: string;
  timestamp: string;
  txnId: string;
  action: 'AUTO_ALLOW' | 'AUTO_BLOCK' | 'HUMAN_APPROVE' | 'HUMAN_BLOCK' | 'SAR_FILED' | 'KYC_STEPUP';
  analyst: string;
  notes: string;
  immutableHash: string; // SHA-256 digest (demo, in-memory log)
}

export interface SARReport {
  reportId: string;
  generatedAt: string;
  fincenTrackingNo: string;
  primarySubject: {
    name: string;
    account: string;
    bank: string;
    country: string;
  };
  suspiciousActivityType: string;
  amount: number;
  currency: string;
  narrativeSummary: string;
  muleRingEvidence: string[];
  recommendedAction: string;
}
