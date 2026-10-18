import React, { useState } from 'react';
import { 
  X, 
  ShieldCheck, 
  Search, 
  Download, 
  Hash, 
  Clock, 
  User, 
  FileCheck 
} from 'lucide-react';
import { AuditRecord } from '../../types';

interface AuditLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  auditLog: AuditRecord[];
}

export const AuditLedgerModal: React.FC<AuditLedgerModalProps> = ({
  isOpen,
  onClose,
  auditLog
}) => {
  const [filterQuery, setFilterQuery] = useState('');

  if (!isOpen) return null;

  const filteredLog = auditLog.filter((rec) => {
    const q = filterQuery.toLowerCase();
    return !q || 
      rec.txnId.toLowerCase().includes(q) ||
      rec.action.toLowerCase().includes(q) ||
      rec.analyst.toLowerCase().includes(q) ||
      rec.notes.toLowerCase().includes(q) ||
      rec.immutableHash.toLowerCase().includes(q);
  });

  const exportCSV = () => {
    const headers = 'ID,Timestamp,TxnID,Action,Analyst,Notes,SHA256_Digest\n';
    const rows = filteredLog.map(r => 
      `"${r.id}","${r.timestamp}","${r.txnId}","${r.action}","${r.analyst}","${r.notes}","${r.immutableHash}"`
    ).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MuleNet_Audit_Ledger_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-5xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded bg-ibm-blue/20 text-ibm-cyan border border-ibm-blue/40">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                <span>Immutable Regulatory Compliance Audit Trail</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  In-memory demo log
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-sans">
                Demo log of analyst decisions made in this session (in memory, not tamper-proof)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1.5 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-slate-800 bg-slate-900 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter by Txn ID, action, hash, or officer..."
              className="w-full bg-slate-950 border border-slate-800 rounded pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-ibm-blue font-sans"
            />
          </div>
          <span className="text-xs font-mono text-slate-400">
            Showing {filteredLog.length} of {auditLog.length} cryptographically signed entries
          </span>
        </div>

        {/* Audit Table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-950 border-b border-slate-800 text-slate-400 font-mono text-[10px] uppercase tracking-wider z-10">
              <tr>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Txn ID</th>
                <th className="py-2.5 px-3">Action Type</th>
                <th className="py-2.5 px-3">Actor / Engine</th>
                <th className="py-2.5 px-3">Verification Details</th>
                <th className="py-2.5 px-3 font-mono">SHA-256 digest</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 font-mono">
              {filteredLog.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No matching audit records found
                  </td>
                </tr>
              ) : (
                filteredLog.map((rec) => {
                  const isHuman = rec.action.startsWith('HUMAN');
                  const isBlock = rec.action.includes('BLOCK');
                  const isSar = rec.action === 'SAR_FILED';

                  return (
                    <tr key={rec.id} className="hover:bg-slate-800/40 text-[11px]">
                      <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                        {rec.timestamp}
                      </td>
                      <td className="py-2.5 px-3 text-ibm-cyan font-bold whitespace-nowrap">
                        {rec.txnId}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                          isSar ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' :
                          isBlock ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' :
                          isHuman ? 'bg-ibm-blue/20 text-ibm-cyan border-ibm-blue/40' :
                          'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        }`}>
                          {rec.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap font-sans">
                        {rec.analyst}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 font-sans max-w-xs truncate" title={rec.notes}>
                        {rec.notes}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 text-[10px] truncate max-w-[160px]" title={rec.immutableHash}>
                        {rec.immutableHash}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950 text-xs text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
            <span>Demo log: entries are kept in memory only</span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white text-xs font-mono"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
