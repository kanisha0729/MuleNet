import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('MuleNet UI Error caught by boundary:', error, errorInfo);
  }

  private handleReset = () => {
    try {
      localStorage.removeItem('mulenet_user');
    } catch {}
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md shadow-2xl space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Something went wrong</h2>
              <p className="text-xs text-slate-400 mt-1 font-sans">
                A component error occurred. Click below to safely reset session cache and restore the dashboard.
              </p>
              {this.state.error && (
                <div className="mt-3 p-2.5 rounded-lg bg-slate-950 text-rose-400 text-[11px] font-mono text-left max-h-24 overflow-y-auto border border-slate-800">
                  {this.state.error.message}
                </div>
              )}
            </div>
            <button
              onClick={this.handleReset}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-indigo-600/30"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Reset Session & Reload</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
