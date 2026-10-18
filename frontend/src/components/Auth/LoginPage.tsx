import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Mail, 
  ArrowRight, 
  KeyRound, 
  Cpu, 
  Sparkles, 
  AlertCircle 
} from 'lucide-react';

interface LoginPageProps {
  onLogin: (user: { name: string; email: string; role: string }) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError('Please provide both email and password.');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      // Mock authentication
      onLogin({
        name: email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        email: email.trim(),
        role: 'Verified Analyst'
      });
      setIsLoading(false);
    }, 400);
  };

  const handleDemoLogin = () => {
    setIsLoading(true);
    setEmail('analyst@mulenet.org');
    setPassword('demo123');
    setTimeout(() => {
      onLogin({
        name: 'Compliance Officer',
        email: 'analyst@mulenet.org',
        role: 'Tier-2 Financial Crime Desk'
      });
      setIsLoading(false);
    }, 300);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-12 selection:bg-indigo-500 selection:text-white">
      {/* Background radial glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        
        {/* Top Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-indigo-600 shadow-xl shadow-indigo-500/20 text-white mb-2">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-sans">
            MuleNet SafePay
          </h1>
          <p className="text-sm text-slate-400">
            Sign in to access your secure transfer portal
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-7 shadow-2xl backdrop-blur-md relative overflow-hidden">
          {/* Top highlight bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-indigo-500" />

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email / Username */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Email / Username
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="analyst@mulenet.org"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  required
                />
              </div>
            </div>

            {/* Remember & Forgot Password */}
            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
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

            {/* Primary Sign In Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-60"
            >
              <span>{isLoading ? 'Authenticating...' : 'Sign In'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-slate-900 px-3 text-slate-500 font-mono text-[11px]">
                QUICK ACCESS
              </span>
            </div>
          </div>

          {/* 1-Click Demo Login Button */}
          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 text-slate-200 font-medium text-sm flex items-center justify-center gap-2 transition-all cursor-pointer group"
          >
            <Sparkles className="h-4 w-4 text-amber-400 group-hover:scale-110 transition-transform" />
            <span>1-Click Demo Login</span>
            <span className="text-[11px] font-mono text-slate-500">
              (analyst@mulenet.org)
            </span>
          </button>
        </div>

        {/* Footer info badge */}
        <div className="text-center text-xs text-slate-500 font-mono flex items-center justify-center gap-2">
          <Cpu className="h-3.5 w-3.5 text-indigo-400" />
          <span>Demo login: no real accounts or credentials</span>
        </div>
      </div>
    </div>
  );
};
