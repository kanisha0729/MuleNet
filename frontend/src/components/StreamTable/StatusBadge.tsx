import React from 'react';
import { CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { DecisionStatus } from '../../types';

interface StatusBadgeProps {
  status: DecisionStatus;
  size?: 'sm' | 'md';
  showIcon?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ 
  status, 
  size = 'sm', 
  showIcon = true 
}) => {
  const isSmall = size === 'sm';

  switch (status) {
    case 'ALLOW':
      return (
        <span className={`inline-flex items-center gap-1 font-mono font-semibold rounded ${
          isSmall ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
        } bg-emerald-500/15 text-emerald-400 border border-emerald-500/30`}>
          {showIcon && <CheckCircle2 className={isSmall ? "h-3 w-3" : "h-3.5 w-3.5"} />}
          <span>ALLOW</span>
        </span>
      );
    case 'REVIEW':
      return (
        <span className={`inline-flex items-center gap-1 font-mono font-semibold rounded ${
          isSmall ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
        } bg-amber-500/15 text-amber-400 border border-amber-500/35 animate-pulse-fast`}>
          {showIcon && <AlertTriangle className={isSmall ? "h-3 w-3" : "h-3.5 w-3.5"} />}
          <span>REVIEW</span>
        </span>
      );
    case 'BLOCK':
      return (
        <span className={`inline-flex items-center gap-1 font-mono font-semibold rounded ${
          isSmall ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
        } bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-sm shadow-rose-900/40`}>
          {showIcon && <ShieldAlert className={isSmall ? "h-3 w-3" : "h-3.5 w-3.5"} />}
          <span>BLOCK</span>
        </span>
      );
    default:
      return null;
  }
};
