import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, Check, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/stores';
import { toast } from 'sonner';

interface FailureLog {
  id: string;
  failure_type: string;
  entity_type: string;
  entity_id: string;
  error_message: string;
  metadata: Record<string, any>;
  is_resolved: boolean;
  resolved_at: string | null;
  admin_note: string | null;
  created_at: string;
  affected_user_id: string | null;
}

const TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  subscription_expired: { label: 'Subscription Expired', color: 'text-purple-700', bg: 'bg-purple-100' },
  out_of_stock:         { label: 'Out of Stock',         color: 'text-orange-700', bg: 'bg-orange-100' },
  dispute_opened:       { label: 'Dispute Opened',       color: 'text-red-700',    bg: 'bg-red-100'    },
  refund_processed:     { label: 'Refund Processed',     color: 'text-blue-700',   bg: 'bg-blue-100'   },
  abandoned_payment:    { label: 'Abandoned Payment',    color: 'text-amber-700',  bg: 'bg-amber-100'  },
};

export default function AdminFailures() {
  const { user } = useAuthStore();
  const [logs, setLogs]             = useState<FailureLog[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [showFilter, setShowFilter] = useState<'unresolved' | 'all'>('unresolved');
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [resolving, setResolving]   = useState<string | null>(null);
  const [noteInput, setNoteInput]   = useState<Record<string, string>>({});

  const fetchLogs = async () => {
    setIsLoading(true);
    let query = supabase
      .from('system_failure_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (showFilter === 'unresolved') query = query.eq('is_resolved', false);

    const { data, error } = await query;
    if (!error && data) setLogs(data as FailureLog[]);
    else toast.error('Failed to load failure logs');
    setIsLoading(false);
  };

  useEffect(() => { fetchLogs(); }, [showFilter]);

  const filtered = logs.filter(l =>
    typeFilter === 'all' || l.failure_type === typeFilter
  );

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const handleResolve = async (log: FailureLog) => {
    setResolving(log.id);
    const { error } = await supabase
      .from('system_failure_logs')
      .update({
        is_resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: user?.id,
        admin_note: noteInput[log.id]?.trim() || log.admin_note,
      })
      .eq('id', log.id);
    if (error) toast.error('Failed to resolve');
    else {
      toast.success('Marked as resolved');
      await fetchLogs();
    }
    setResolving(null);
  };

  // KPIs
  const unresolved       = logs.filter(l => !l.is_resolved).length;
  const disputes         = logs.filter(l => l.failure_type === 'dispute_opened' && !l.is_resolved).length;
  const abandoned        = logs.filter(l => l.failure_type === 'abandoned_payment' && !l.is_resolved).length;
  const outOfStock       = logs.filter(l => l.failure_type === 'out_of_stock' && !l.is_resolved).length;

  const types = [...new Set(logs.map(l => l.failure_type))];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">System Failures</h1>
          <p className="text-xs text-gray-400 mt-0.5">Real-time platform health monitor</p>
        </div>
        <button onClick={fetchLogs} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <RefreshCw className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Unresolved',      value: unresolved,  color: 'text-red-600',    bg: 'bg-red-50'    },
          { label: 'Open Disputes',   value: disputes,    color: 'text-red-600',    bg: 'bg-red-50'    },
          { label: 'Abandoned Pays',  value: abandoned,   color: 'text-amber-600',  bg: 'bg-amber-50'  },
          { label: 'Out of Stock',    value: outOfStock,  color: 'text-orange-600', bg: 'bg-orange-50' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl p-3 border border-gray-100`}>
            <p className="text-[10px] text-gray-500 mb-1">{label}</p>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex gap-1">
          {(['unresolved', 'all'] as const).map(f => (
            <button key={f} onClick={() => setShowFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${
                showFilter === f ? 'bg-orange-500 text-white' : 'bg-white border border-gray-200 text-gray-600'
              }`}>
              {f === 'unresolved' ? `⚠️ Unresolved (${unresolved})` : 'All logs'}
            </button>
          ))}
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20">
          <option value="all">All types</option>
          {types.map(t => (
            <option key={t} value={t}>{TYPE_META[t]?.label || t}</option>
          ))}
        </select>
      </div>

      {/* Logs */}
      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-1/3 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-2/3" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 py-16 text-center">
            <AlertTriangle className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No failures found</p>
          </div>
        ) : filtered.map(log => {
          const meta    = TYPE_META[log.failure_type] || { label: log.failure_type, color: 'text-gray-700', bg: 'bg-gray-100' };
          const isOpen  = expanded === log.id;
          const m       = log.metadata || {};

          return (
            <div key={log.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${
              log.is_resolved ? 'opacity-50 border-gray-100' : 'border-gray-200'
            }`}>
              {/* Header row */}
              <div className="flex items-start gap-3 p-4">
                <div className={`w-8 h-8 ${meta.bg} rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <AlertTriangle className={`w-4 h-4 ${meta.color}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`px-2 py-0.5 ${meta.bg} ${meta.color} rounded-full text-[10px] font-semibold uppercase tracking-wide`}>
                      {meta.label}
                    </span>
                    {log.is_resolved && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-medium">
                        Resolved
                      </span>
                    )}
                    <span className="text-[10px] text-gray-400">
                      {new Date(log.created_at).toLocaleString('en-NG', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-gray-700 leading-relaxed">{log.error_message}</p>

                  {/* Quick contact info from metadata */}
                  {(m.customer_email || m.customer_phone || m.customer_name) && (
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {m.customer_name && <span className="text-[10px] text-gray-500">{m.customer_name}</span>}
                      {m.customer_email && (
                        <button onClick={() => copy(m.customer_email, 'Email')}
                          className="flex items-center gap-1 text-[10px] text-blue-500 hover:underline">
                          {m.customer_email} <Copy className="w-2.5 h-2.5" />
                        </button>
                      )}
                      {m.customer_phone && (
                        <button onClick={() => copy(m.customer_phone, 'Phone')}
                          className="flex items-center gap-1 text-[10px] text-blue-500 hover:underline">
                          {m.customer_phone} <Copy className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Expand + Resolve */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => setExpanded(isOpen ? null : log.id)}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                    {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </button>
                  {!log.is_resolved && (
                    <button onClick={() => handleResolve(log)} disabled={resolving === log.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-medium disabled:opacity-50 transition-colors">
                      {resolving === log.id
                        ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <Check className="w-3 h-3" />
                      }
                      Resolve
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded details */}
              {isOpen && (
                <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 space-y-3">
                  {/* Metadata */}
                  <div>
                    <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1.5">Details</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      {Object.entries(m).filter(([, v]) => v != null).map(([k, v]) => (
                        <div key={k} className="flex items-start gap-1">
                          <span className="text-[10px] text-gray-400 capitalize">{k.replace(/_/g, ' ')}:</span>
                          <span className="text-[10px] text-gray-700 font-medium truncate">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-[10px] text-gray-400">Entity ID:</span>
                      <span className="text-[10px] font-mono text-gray-500">{log.entity_id.slice(0, 16)}…</span>
                      <button onClick={() => copy(log.entity_id, 'ID')} className="p-0.5 hover:bg-gray-200 rounded">
                        <Copy className="w-2.5 h-2.5 text-gray-400" />
                      </button>
                    </div>
                  </div>

                  {/* Admin note */}
                  {!log.is_resolved && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Note before resolving</p>
                      <textarea
                        value={noteInput[log.id] || ''}
                        onChange={e => setNoteInput(prev => ({ ...prev, [log.id]: e.target.value }))}
                        placeholder="Optional note..."
                        className="w-full px-2.5 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 resize-none min-h-[60px]"
                      />
                    </div>
                  )}

                  {log.admin_note && (
                    <p className="text-[10px] text-gray-500 italic">Admin note: {log.admin_note}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}