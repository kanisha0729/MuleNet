import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Mail, 
  User, 
  CreditCard, 
  ArrowRight, 
  Sparkles, 
  ShieldAlert, 
  UserCheck, 
  Cpu, 
  Building2,
  CheckCircle2
} from 'lucide-react';
import { UserProfile, UserRole, DEMO_USERS } from '../../types/auth';

interface AuthModalProps {
  onLogin: (user: UserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onLogin }) => {
  const [activeTab, setActiveTab] = useState<'SIGN_IN' | 'SIGN_UP'>('SIGN_IN');

  // Sign in state
  const [signInIdentifier, setSignInIdentifier] = useState('sarah.jenkins@safepay.io');
  const [signInPassword, setSignInPassword] = useState('demo123');

  // Sign up state
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpAccount, setSignUpAccount] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpRole, setSignUpRole] = useState<UserRole>('CUSTOMER');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!signInIdentifier.trim() || !signInPassword.trim()) {
      setErrorMessage('Please enter both your email/account ID and password.');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      // Check if it's the officer or regular user
      const isOfficer = signInIdentifier.toLowerCase().includes('officer') || signInIdentifier.toLowerCase().includes('vance');
      const baseUser = isOfficer ? DEMO_USERS.officer : DEMO_USERS.regular;
      
      onLogin({
        ...baseUser,
        email: signInIdentifier.includes('@') ? signInIdentifier : baseUser.email,
        accountNumber: !signInIdentifier.includes('@') ? signInIdentifier : baseUser.accountNumber
      });
      setIsLoading(false);
    }, 350);
  };

  const handleSignUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!signUpName.trim() || !signUpEmail.trim() || !signUpAccount.trim() || !signUpPassword.trim()) {
      setErrorMessage('Please fill in all registration fields.');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      const newUser: UserProfile = {
        name: signUpName.trim(),
        email: signUpEmail.trim(),
        accountNumber: signUpAccount.trim(),
        role: signUpRole,
        balance: signUpRole === 'CUSTOMER' ? 12500.00 : 100000.00,
        currency: 'USD',
        trustScore: signUpRole === 'CUSTOMER' ? 95 : 100,
        tier: signUpRole === 'CUSTOMER' ? 'Verified Personal Customer' : 'AML Compliance Desk'
      };
      onLogin(newUser);
      setIsLoading(false);
    }, 450);
  };

  const handleDemoAccess = (role: 'regular' | 'officer') => {
    setIsLoading(true);
    setTimeout(() => {
      onLogin(DEMO_USERS[role]);
      setIsLoading(false);
    }, 250);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-8 selection:bg-indigo-500 selection:text-white relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

      <div className="w-full max-w-lg relative z-10 space-y-5">
        
        {/* Branding Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-indigo-600 shadow-xl shadow-indigo-500/25 text-white mb-1">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-sans">
            MuleNet SafePay
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Real-Time Laundering-Risk Prediction & Transfer Safety Portal
          </p>
        </div>

        {/* 1-Click Quick Demo Access Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 shadow-lg backdrop-blur-md">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-indigo-400 font-semibold">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span>Instant 1-Click Demo Access</span>
            </span>
            <span className="text-[10px] text-slate-500">No setup required</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* Demo 1: Regular User */}
            <button
              type="button"
              onClick={() => handleDemoAccess('regular')}
              disabled={isLoading}
              className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800/90 border border-slate-800 hover:border-emerald-500/40 text-left transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-2 font-medium text-xs text-slate-200 group-hover:text-emerald-400">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <User className="h-3.5 w-3.5" />
                </div>
                <span>Enter as Regular User</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">
                Sarah Jenkins (ACC_10492)
              </p>
            </button>

            {/* Demo 2: Compliance Officer */}
            <button
              type="button"
              onClick={() => handleDemoAccess('officer')}
              disabled={isLoading}
              className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800/90 border border-slate-800 hover:border-indigo-500/40 text-left transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-2 font-medium text-xs text-slate-200 group-hover:text-indigo-400">
                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                  <ShieldAlert className="h-3.5 w-3.5" />
                </div>
                <span>Enter as AML Officer</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">
                David Vance (Compliance Desk 4B)
              </p>
            </button>
          </div>
        </div>

        {/* Main Auth Form Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-2xl backdrop-blur-md relative overflow-hidden">
          {/* Top highlight bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-indigo-500" />

          {/* Toggle Tabs: Sign In vs Sign Up */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 mb-5">
            <button
              type="button"
              onClick={() => { setActiveTab('SIGN_IN'); setErrorMessage(null); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === 'SIGN_IN'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('SIGN_UP'); setErrorMessage(null); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === 'SIGN_UP'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Create Account (Sign Up)
            </button>
          </div>

          {/* Error notice */}
          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
              <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* TAB 1: SIGN IN */}
          {activeTab === 'SIGN_IN' && (
            <form onSubmit={handleSignInSubmit} className="space-y-4 animate-in fade-in duration-200">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Email or Account Number
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    value={signInIdentifier}
                    onChange={(e) => setSignInIdentifier(e.target.value)}
                    placeholder="sarah.jenkins@safepay.io or ACC_10492"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="password"
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="rounded bg-slate-950 border-slate-800 text-indigo-500 focus:ring-0 focus:ring-offset-0"
                  />
                  <span>Remember this device</span>
                </label>
                <span className="text-indigo-400 hover:text-indigo-300 cursor-pointer">
                  Forgot password?
                </span>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-60"
              >
                <span>{isLoading ? 'Authenticating...' : 'Sign In'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}

          {/* TAB 2: SIGN UP */}
          {activeTab === 'SIGN_UP' && (
            <form onSubmit={handleSignUpSubmit} className="space-y-3.5 animate-in fade-in duration-200">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    value={signUpName}
                    onChange={(e) => setSignUpName(e.target.value)}
                    placeholder="Alex Morgan"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                      type="email"
                      value={signUpEmail}
                      onChange={(e) => setSignUpEmail(e.target.value)}
                      placeholder="alex@bank.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Account Number
                  </label>
                  <div className="relative">
                    <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      value={signUpAccount}
                      onChange={(e) => setSignUpAccount(e.target.value)}
                      placeholder="ACC_55219"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="password"
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                    required
                  />
                </div>
              </div>

              {/* Role selector */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Account Role
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSignUpRole('CUSTOMER')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      signUpRole === 'CUSTOMER'
                        ? 'bg-indigo-600/20 border-indigo-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="font-semibold text-xs flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Bank Customer</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Everyday personal transfer safety
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSignUpRole('COMPLIANCE_OFFICER')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      signUpRole === 'COMPLIANCE_OFFICER'
                        ? 'bg-indigo-600/20 border-indigo-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="font-semibold text-xs flex items-center gap-1.5">
                      <ShieldAlert className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Compliance Officer</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      AML oversight & SAR filing
                    </p>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-60"
              >
                <span>{isLoading ? 'Creating Account...' : 'Complete Registration'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}
        </div>

        {/* Security badge footer */}
        <div className="text-center text-xs text-slate-500 font-mono flex items-center justify-center gap-2">
          <Cpu className="h-3.5 w-3.5 text-indigo-400" />
          <span>Demo login: no real accounts or credentials</span>
        </div>
      </div>
    </div>
  );
};
