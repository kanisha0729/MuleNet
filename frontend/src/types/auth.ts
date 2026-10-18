export type UserRole = 'CUSTOMER' | 'COMPLIANCE_OFFICER';

export interface UserProfile {
  name: string;
  email: string;
  accountNumber: string;
  role: UserRole;
  balance: number;
  currency: string;
  trustScore: number; // 0 to 100
  tier: string;
}

export const DEMO_USERS: Record<string, UserProfile> = {
  regular: {
    name: 'Sarah Jenkins',
    email: 'sarah.jenkins@safepay.io',
    accountNumber: 'ACC_10492',
    role: 'CUSTOMER',
    balance: 24850.00,
    currency: 'USD',
    trustScore: 98,
    tier: 'Verified Personal Tier'
  },
  officer: {
    name: 'David Vance',
    email: 'd.vance@mulenet.org',
    accountNumber: 'OFFICER_4B',
    role: 'COMPLIANCE_OFFICER',
    balance: 150000.00,
    currency: 'USD',
    trustScore: 100,
    tier: 'AML Compliance Officer (Desk 4B)'
  }
};
