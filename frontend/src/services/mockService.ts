import { 
  Transaction, 
  SystemTelemetry, 
  MuleGraphData, 
  AuditRecord, 
  SARReport, 
  DecisionStatus, 
  MuleTypology 
} from '../types';

const SENDER_NAMES = [
  { name: 'Apex Meridian Capital Ltd', bank: 'HSBC UK', country: 'GB', flag: '🇬🇧', age: 1420, kyc: 'Tier 3 (Institutional)' },
  { name: 'Nordic Freight & Logistics A/S', bank: 'Danske Bank', country: 'DK', flag: '🇩🇰', age: 890, kyc: 'Tier 3 (Institutional)' },
  { name: 'Dr. Elena Rostova', bank: 'UBS Zurich', country: 'CH', flag: '🇨🇭', age: 2100, kyc: 'Tier 2 (Private Wealth)' },
  { name: 'Vanguard Retail Holdings', bank: 'JPMorgan Chase', country: 'US', flag: '🇺🇸', age: 1800, kyc: 'Tier 3 (Corporate)' },
  { name: 'Alexander Chen', bank: 'DBS Singapore', country: 'SG', flag: '🇸🇬', age: 620, kyc: 'Tier 2 (Verified)' },
  { name: 'Kowloon Trade Link Co.', bank: 'Standard Chartered HK', country: 'HK', flag: '🇭🇰', age: 310, kyc: 'Tier 1 (Basic)' },
  { name: 'Sophia Martinez (Student Acct)', bank: 'Barclays UK', country: 'GB', flag: '🇬🇧', age: 48, kyc: 'Tier 1 (Provisional)' },
  { name: 'Helios Global Import Export', bank: 'Deutsche Bank', country: 'DE', flag: '🇩🇪', age: 120, kyc: 'Tier 2 (Corporate)' },
  { name: 'CryptoLiquid P2P Desk', bank: 'Revolut EU', country: 'LT', flag: '🇱🇹', age: 15, kyc: 'Tier 1 (Unverified)' },
  { name: 'Dormant Holdco #419', bank: 'Cyprus Popular Bank', country: 'CY', flag: '🇨🇾', age: 1820, kyc: 'Tier 1 (Lapsed)' }
];

const RECEIVER_NAMES = [
  { name: 'SwiftPay P2P Settlement Node 4', bank: 'Monzo UK', country: 'GB', flag: '🇬🇧', isMule: true },
  { name: 'Nexus Off-Ramp Digital Ltd', bank: 'Kraken Financial', country: 'US', flag: '🇺🇸', isMule: true },
  { name: 'Bavaria Motor Components GmbH', bank: 'Commerzbank', country: 'DE', flag: '🇩🇪', isMule: false },
  { name: 'Marcus Sterling', bank: 'Citibank N.A.', country: 'US', flag: '🇺🇸', isMule: false },
  { name: 'Dubai Oasis Gold Bullion DMCC', bank: 'Emirates NBD', country: 'AE', flag: '🇦🇪', isMule: true },
  { name: 'Global Cloud Systems Inc', bank: 'Wells Fargo', country: 'US', flag: '🇺🇸', isMule: false },
  { name: 'Sven Lindqvist (Freelance)', bank: 'Nordea', country: 'SE', flag: '🇸🇪', isMule: false },
  { name: 'FastEx Courier Logistics Hub', bank: 'Santander ES', country: 'ES', flag: '🇪🇸', isMule: true },
  { name: 'Anonymous ATM Cashout Network', bank: 'State Bank N/A', country: 'RO', flag: '🇷🇴', isMule: true }
];

const CHANNELS: ('SWIFT MT103' | 'ISO 20022' | 'FedNow' | 'SEPA Instant' | 'Faster Payments')[] = [
  'ISO 20022', 'SEPA Instant', 'Faster Payments', 'FedNow', 'SWIFT MT103'
];

const CURRENCIES: ('USD' | 'EUR' | 'GBP' | 'SGD' | 'CHF')[] = ['USD', 'EUR', 'GBP', 'SGD', 'CHF'];

export class MockMuleNetService {
  private streamInterval: any = null;
  private intervalSpeedMs: number = 1800; // default 1.8s per new transfer
  private transactions: Transaction[] = [];
  private auditLog: AuditRecord[] = [];
  private telemetry: SystemTelemetry = {
    platform: 'IBM LinuxONE III Express (s390x)',
    hostArchitecture: 's390x / z/Architecture 64-bit',
    accelerator: 'IBM Telum II AI Co-Processor (32 TOPS On-Chip)',
    acceleratorLoad: 84.6,
    cpacfCryptoEngine: 'ACTIVE_HARDWARE_ACCELERATED',
    throughputTps: 14280,
    avgLatencyMs: 1.42,
    p95LatencyMs: 3.10,
    p99LatencyMs: 4.85,
    auditDbStatus: 'CONNECTED',
    hitlModeActive: true,
    sourceStream: 'LIVE STREAM (s390x SIMD)',
    totalTransactionsProcessed: 1849204,
    decisionCounts: {
      allow: 172910,
      review: 8520,
      block: 3410
    },
    totalVolumeUSD: 48920150.00
  };

  private listeners: {
    onTxn?: (txn: Transaction) => void;
    onTelemetry?: (telemetry: SystemTelemetry) => void;
  } = {};

  constructor() {
    this.seedInitialData();
  }

  private seedInitialData() {
    // Generate initial 25 transactions so dashboard loads populated instantly
    for (let i = 0; i < 25; i++) {
      const isBurst = i % 5 === 0;
      const txn = this.generateRandomTransaction(isBurst, Date.now() - (25 - i) * 3500);
      this.transactions.unshift(txn);
      this.appendAuditForTxn(txn, 'AUTO');
    }
  }

  public subscribeStream(
    onTxn: (txn: Transaction) => void,
    onTelemetry: (telemetry: SystemTelemetry) => void
  ): () => void {
    this.listeners.onTxn = onTxn;
    this.listeners.onTelemetry = onTelemetry;

    // Send initial telemetry immediately
    onTelemetry({ ...this.telemetry });

    this.startStreaming();

    return () => {
      this.stopStreaming();
      this.listeners = {};
    };
  }

  public startStreaming() {
    if (this.streamInterval) clearInterval(this.streamInterval);

    this.streamInterval = setInterval(() => {
      const isSuspicious = Math.random() < 0.28; // 28% suspicious rate for active operational desk testing
      const newTxn = this.generateRandomTransaction(isSuspicious, Date.now());
      this.transactions.unshift(newTxn);
      if (this.transactions.length > 250) {
        this.transactions.pop();
      }

      // Update telemetry
      this.telemetry.totalTransactionsProcessed += 1;
      this.telemetry.totalVolumeUSD += newTxn.amount;
      if (newTxn.decision === 'ALLOW') this.telemetry.decisionCounts.allow += 1;
      else if (newTxn.decision === 'REVIEW') this.telemetry.decisionCounts.review += 1;
      else if (newTxn.decision === 'BLOCK') this.telemetry.decisionCounts.block += 1;

      // Jitter metrics realistically
      this.telemetry.avgLatencyMs = Number((1.38 + Math.random() * 0.12).toFixed(2));
      this.telemetry.p95LatencyMs = Number((2.95 + Math.random() * 0.35).toFixed(2));
      this.telemetry.throughputTps = Math.floor(13800 + Math.random() * 900);
      this.telemetry.acceleratorLoad = Number((82.0 + Math.random() * 6.5).toFixed(1));

      this.appendAuditForTxn(newTxn, 'AUTO');

      if (this.listeners.onTxn) this.listeners.onTxn(newTxn);
      if (this.listeners.onTelemetry) this.listeners.onTelemetry({ ...this.telemetry });
    }, this.intervalSpeedMs);
  }

  public stopStreaming() {
    if (this.streamInterval) {
      clearInterval(this.streamInterval);
      this.streamInterval = null;
    }
  }

  public setStreamSpeed(speedMs: number) {
    this.intervalSpeedMs = speedMs;
    if (this.streamInterval) {
      this.startStreaming();
    }
  }

  public injectSuspiciousBurst() {
    // Manually inject a high-priority Mule syndicate attack
    const highRiskTxn = this.generateRandomTransaction(true, Date.now(), true);
    this.transactions.unshift(highRiskTxn);
    this.telemetry.decisionCounts.block += 1;
    this.appendAuditForTxn(highRiskTxn, 'AUTO');

    if (this.listeners.onTxn) this.listeners.onTxn(highRiskTxn);
    if (this.listeners.onTelemetry) this.listeners.onTelemetry({ ...this.telemetry });
  }

  public getTransactions(): Transaction[] {
    return [...this.transactions];
  }

  public getAuditLog(): AuditRecord[] {
    return [...this.auditLog];
  }

  public getTelemetry(): SystemTelemetry {
    return { ...this.telemetry };
  }

  public async submitDecision(
    txnId: string, 
    action: 'APPROVE' | 'BLOCK' | 'KYC_STEPUP', 
    notes: string,
    analyst: string = 'Compliance Officer (Desk 4B)'
  ): Promise<boolean> {
    const txn = this.transactions.find(t => t.id === txnId);
    if (!txn) return false;

    txn.humanReviewed = true;
    txn.reviewedBy = analyst;
    txn.reviewNotes = notes;

    if (action === 'APPROVE') {
      txn.decision = 'ALLOW';
      txn.muleRiskScore = Math.min(txn.muleRiskScore, 18);
    } else if (action === 'BLOCK') {
      txn.decision = 'BLOCK';
      txn.muleRiskScore = Math.max(txn.muleRiskScore, 95);
    }

    const auditAction = action === 'APPROVE' ? 'HUMAN_APPROVE' : (action === 'BLOCK' ? 'HUMAN_BLOCK' : 'KYC_STEPUP');
    this.appendAuditRecord(txn.id, auditAction, analyst, notes);

    // Notify listeners of updated telemetry
    if (this.listeners.onTelemetry) this.listeners.onTelemetry({ ...this.telemetry });
    return true;
  }

  public async fileSAR(txn: Transaction, notes: string): Promise<SARReport> {
    const reportId = `SAR-IBM-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
    const fincenTrackingNo = `BSA-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const report: SARReport = {
      reportId,
      generatedAt: new Date().toISOString(),
      fincenTrackingNo,
      primarySubject: {
        name: txn.receiver.name,
        account: txn.receiver.account,
        bank: txn.receiver.bank,
        country: txn.receiver.country
      },
      suspiciousActivityType: `Mule Syndicate Pattern: ${txn.typology.replace(/_/g, ' ')}`,
      amount: txn.amount,
      currency: txn.currency,
      narrativeSummary: `Automated detection on IBM LinuxONE s390x Telum II co-processor identified severe mule routing anomalies. Subject account ${txn.receiver.account} at ${txn.receiver.bank} received ${txn.currency} ${txn.amount.toLocaleString()} with risk score ${txn.muleRiskScore}/100. Analyst Note: ${notes || 'Immediate account freeze and SAR filing requested due to layering indicators.'}`,
      muleRingEvidence: [
        `Risk Score: ${txn.muleRiskScore}/100 (Telum GNN inference in ${txn.latencyMs}ms)`,
        ...txn.ruleAlerts,
        `Degree Centrality: ${txn.receiver.degreeCentrality.toFixed(2)} with fan-out to external off-ramps`,
        `Top ML driver: ${txn.features[0]?.description || 'Velocity spike'}`
      ],
      recommendedAction: 'Mandatory beneficiary freeze, SAR disclosure to FinCEN/FIU, cross-institution blacklist entry.'
    };

    this.appendAuditRecord(txn.id, 'SAR_FILED', 'Compliance Lead / Automated SAR Engine', `SAR filed: ${fincenTrackingNo}`);
    return report;
  }

  public async fetchMuleRing(txnId: string): Promise<MuleGraphData> {
    const txn = this.transactions.find(t => t.id === txnId) || this.transactions[0];

    const nodes = [
      {
        id: 'orig-1',
        label: txn.sender.name.split(' ')[0] + ' (Origin)',
        account: txn.sender.account,
        type: 'VICTIM' as const,
        riskScore: 12,
        country: txn.sender.country,
        amount: txn.amount
      },
      {
        id: 'mule-in-1',
        label: 'Layering Proxy A',
        account: 'GB88BARC20019' + Math.floor(100 + Math.random() * 899),
        type: 'MULE_LAYER' as const,
        riskScore: 78,
        country: 'GB',
        amount: Math.round(txn.amount * 0.48)
      },
      {
        id: 'mule-in-2',
        label: 'Rapid Funnel B',
        account: 'DE44DB998124' + Math.floor(100 + Math.random() * 899),
        type: 'MULE_LAYER' as const,
        riskScore: 82,
        country: 'DE',
        amount: Math.round(txn.amount * 0.52)
      },
      {
        id: 'target-suspect',
        label: `${txn.receiver.name.slice(0, 14)} (Hub)`,
        account: txn.receiver.account,
        type: 'SUSPECT_TARGET' as const,
        riskScore: txn.muleRiskScore,
        country: txn.receiver.country,
        amount: txn.amount,
        flagged: txn.muleRiskScore > 40
      },
      {
        id: 'cashout-1',
        label: 'Off-Ramp Crypto Desk',
        account: '0x71C...B92E',
        type: 'CRYPTO_EXCHANGE' as const,
        riskScore: 94,
        country: 'RO',
        amount: Math.round(txn.amount * 0.65)
      },
      {
        id: 'cashout-2',
        label: 'Bulk ATM Dispenser #9',
        account: 'ATM-BUDAPEST-9',
        type: 'CASHOUT' as const,
        riskScore: 91,
        country: 'HU',
        amount: Math.round(txn.amount * 0.35)
      }
    ];

    const links = [
      {
        source: 'orig-1',
        target: 'mule-in-1',
        amount: Math.round(txn.amount * 0.48),
        currency: txn.currency,
        timestamp: '-18m',
        isLayeringHop: false
      },
      {
        source: 'orig-1',
        target: 'mule-in-2',
        amount: Math.round(txn.amount * 0.52),
        currency: txn.currency,
        timestamp: '-14m',
        isLayeringHop: false
      },
      {
        source: 'mule-in-1',
        target: 'target-suspect',
        amount: Math.round(txn.amount * 0.47),
        currency: txn.currency,
        timestamp: '-4m',
        isLayeringHop: true
      },
      {
        source: 'mule-in-2',
        target: 'target-suspect',
        amount: Math.round(txn.amount * 0.51),
        currency: txn.currency,
        timestamp: '-2m',
        isLayeringHop: true
      },
      {
        source: 'target-suspect',
        target: 'cashout-1',
        amount: Math.round(txn.amount * 0.65),
        currency: txn.currency,
        timestamp: 'PENDING',
        isLayeringHop: true
      },
      {
        source: 'target-suspect',
        target: 'cashout-2',
        amount: Math.round(txn.amount * 0.35),
        currency: txn.currency,
        timestamp: 'PENDING',
        isLayeringHop: true
      }
    ];

    return { nodes, links };
  }

  private generateRandomTransaction(
    forceSuspicious: boolean = false, 
    timeMs: number = Date.now(), 
    forceExtremeBlock: boolean = false
  ): Transaction {
    const sender = SENDER_NAMES[Math.floor(Math.random() * SENDER_NAMES.length)];
    const receiver = RECEIVER_NAMES[Math.floor(Math.random() * RECEIVER_NAMES.length)];
    const currency = CURRENCIES[Math.floor(Math.random() * CURRENCIES.length)];
    const channel = CHANNELS[Math.floor(Math.random() * CHANNELS.length)];

    let muleRiskScore = forceExtremeBlock 
      ? Math.floor(88 + Math.random() * 11) 
      : (forceSuspicious ? Math.floor(45 + Math.random() * 52) : Math.floor(4 + Math.random() * 26));

    if (receiver.isMule && !forceSuspicious && !forceExtremeBlock) {
      muleRiskScore = Math.floor(65 + Math.random() * 30);
    }

    let decision: DecisionStatus = 'ALLOW';
    if (muleRiskScore >= 80) {
      decision = 'BLOCK';
    } else if (muleRiskScore >= 35) {
      decision = 'REVIEW';
    }

    // Realistic amounts
    let amount: number;
    let typology: MuleTypology = 'CLEAN_TRANSIT';
    const ruleAlerts: string[] = [];

    if (muleRiskScore >= 80) {
      // High-risk laundering pattern
      if (Math.random() > 0.5) {
        typology = 'STRUCTURING_SMURF';
        // Classic BSA $10k structuring: $9,850, $9,920, $9,750
        amount = 9000 + Math.floor(Math.random() * 950);
        ruleAlerts.push('BSA Smurfing: Amount strategically positioned < $10k threshold');
        ruleAlerts.push('High fan-out degree centrality to flagged off-ramps (4.8x normal)');
      } else {
        typology = 'RAPID_DISPERSAL';
        amount = 24500 + Math.floor(Math.random() * 65000);
        ruleAlerts.push('Rapid In-and-Out: 94% of balance swept out within 180 seconds');
        ruleAlerts.push('Account Age Discrepancy: Account active only 3 weeks with high velocity');
      }
    } else if (muleRiskScore >= 35) {
      // Borderline review pattern
      typology = Math.random() > 0.5 ? 'DORMANT_ACTIVATION' : 'CROSS_BORDER_FUNNEL';
      amount = 4500 + Math.floor(Math.random() * 12000);
      ruleAlerts.push('Sudden surge over 30-day baseline velocity (+380%)');
      ruleAlerts.push('First-time counterparty in high-risk crypto corridor');
    } else {
      // Normal commercial / personal transfer
      typology = 'CLEAN_TRANSIT';
      amount = Math.random() > 0.4 ? 150 + Math.floor(Math.random() * 3200) : 12000 + Math.floor(Math.random() * 45000);
    }

    const txDate = new Date(timeMs);
    const timeFormatted = txDate.toTimeString().split(' ')[0] + '.' + String(txDate.getMilliseconds()).padStart(3, '0');

    const id = `TXN-${txDate.getFullYear().toString().slice(-2)}${String(txDate.getMonth() + 1).padStart(2, '0')}-${Math.floor(100000 + Math.random() * 900000)}`;

    const features = [
      {
        feature: 'Velocity Hop Ratio',
        impact: muleRiskScore > 40 ? +(muleRiskScore * 0.4).toFixed(1) : -12.4,
        description: 'Time delta between credit receipt and onward dispersal (180s avg)',
        category: 'VELOCITY' as const
      },
      {
        feature: 'Mule Ring Graph Centrality',
        impact: muleRiskScore > 50 ? +(muleRiskScore * 0.32).toFixed(1) : -8.5,
        description: 'PageRank and 3-hop neighbor overlap with confirmed mule cluster',
        category: 'GRAPH' as const
      },
      {
        feature: 'Amount Structuring Profile',
        impact: typology === 'STRUCTURING_SMURF' ? +28.9 : (amount > 10000 ? +8.2 : -5.1),
        description: 'Deviation from Benford law and proximity to $10k reporting limit',
        category: 'AMOUNT' as const
      },
      {
        feature: 'Device & IP Telemetry Mismatch',
        impact: muleRiskScore > 60 ? +16.7 : -6.3,
        description: 'Tor exit node / datacenter IP proxy detected during initiation',
        category: 'DEVICE' as const
      },
      {
        feature: 'Dormant Account Re-activation',
        impact: typology === 'DORMANT_ACTIVATION' ? +22.4 : -4.0,
        description: 'Zero transaction history for 180 days preceding sudden high-value credit',
        category: 'BEHAVIOR' as const
      }
    ];

    return {
      id,
      timestamp: timeFormatted,
      sender: {
        name: sender.name,
        account: `US${Math.floor(1000 + Math.random() * 8999)}...${Math.floor(1000 + Math.random() * 8999)}`,
        bank: sender.bank,
        country: sender.country,
        flag: sender.flag,
        accountAgeDays: sender.age,
        kycTier: sender.kyc
      },
      receiver: {
        name: receiver.name,
        account: `EU${Math.floor(1000 + Math.random() * 8999)}...${Math.floor(1000 + Math.random() * 8999)}`,
        bank: receiver.bank,
        country: receiver.country,
        flag: receiver.flag,
        isSuspectedMule: receiver.isMule || muleRiskScore > 65,
        degreeCentrality: Number((1.2 + (muleRiskScore / 25)).toFixed(2))
      },
      amount,
      currency,
      channel,
      muleRiskScore,
      decision,
      typology,
      features,
      ruleAlerts,
      latencyMs: Number((1.12 + Math.random() * 0.65).toFixed(2))
    };
  }

  private appendAuditForTxn(txn: Transaction, prefix: 'AUTO' | 'HUMAN') {
    const action = prefix === 'AUTO' 
      ? (txn.decision === 'ALLOW' ? 'AUTO_ALLOW' : (txn.decision === 'BLOCK' ? 'AUTO_BLOCK' : 'KYC_STEPUP'))
      : 'HUMAN_APPROVE';

    this.appendAuditRecord(
      txn.id,
      action,
      'IBM Telum II Co-Processor Engine',
      `Inference completed in ${txn.latencyMs}ms. Decision: ${txn.decision} (Risk ${txn.muleRiskScore}/100)`
    );
  }

  private appendAuditRecord(txnId: string, action: any, analyst: string, notes: string) {
    const hash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    this.auditLog.unshift({
      id: `AUD-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      txnId,
      action,
      analyst,
      notes,
      immutableHash: hash
    });

    if (this.auditLog.length > 100) this.auditLog.pop();
  }
}

export const mockMuleNetService = new MockMuleNetService();
