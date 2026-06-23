import { useState, useEffect, useCallback } from 'react';
import {
  Mail, ToggleLeft, ToggleRight, Zap, Send, RefreshCw,
  AlertTriangle, CheckCircle, Clock, ChevronDown, ChevronUp,
  Settings, Play, Calendar, Inbox
} from 'lucide-react';
import { supabase } from '@/services';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────
interface EmailTypeSetting {
  id: string;
  email_type: string;
  display_name: string;
  description: string;
  is_enabled: boolean;
  daily_limit: number;
  sent_today: number;
  total_sent_all_time: number;
  last_reset_at: string;
  priority: number;
  updated_at: string;
}

interface QueuedEmail {
  id: string;
  to_email: string;
  to_name: string;
  template_name: string;
  email_type: string;
  status: 'pending' | 'sent' | 'failed';
  priority: number;
  scheduled_for: string;
  is_manually_triggered: boolean;
  created_at: string;
  attempts: number;
  error: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pct(sent: number, limit: number) {
  return Math.min(100, Math.round((sent / limit) * 100));
}

function usageColor(p: number) {
  if (p >= 90) return { bar: 'bg-red-500',    text: 'text-red-600' };
  if (p >= 70) return { bar: 'bg-amber-400',  text: 'text-amber-600' };
  return              { bar: 'bg-emerald-400', text: 'text-emerald-600' };
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function AdminEmailControls() {
  const [settings, setSettings]         = useState<EmailTypeSetting[]>([]);
  const [queue, setQueue]               = useState<QueuedEmail[]>([]);
  const [isLoading, setIsLoading]       = useState(true);
  const [saving, setSaving]             = useState<string | null>(null);
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [editLimit, setEditLimit]       = useState<Record<string, number>>({});
  const [isSendingAll, setIsSendingAll] = useState(false);
  const [activeTab, setActiveTab]       = useState<'controls' | 'queue'>('controls');
  const [triggeringId, setTriggeringId] = useState<string | null>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('email_type_settings')
      .select('*')
      .order('priority', { ascending: true });
    if (!error && data) setSettings(data as EmailTypeSetting[]);
    setIsLoading(false);
  }, []);

  const fetchQueue = useCallback(async () => {
    const { data } = await supabase
      .from('email_queue')
      .select('*')
      .in('status', ['pending'])
      .order('priority', { ascending: true })
      .order('scheduled_for', { ascending: true })
      .limit(100);
    if (data) setQueue(data as QueuedEmail[]);
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchQueue();
  }, []);

  // ── Toggle enabled ────────────────────────────────────────────────────────
  const toggleEnabled = async (setting: EmailTypeSetting) => {
    setSaving(setting.id);
    const { error } = await supabase
      .from('email_type_settings')
      .update({ is_enabled: !setting.is_enabled, updated_at: new Date().toISOString() })
      .eq('id', setting.id);
    if (!error) {
      setSettings(prev => prev.map(s =>
        s.id === setting.id ? { ...s, is_enabled: !s.is_enabled } : s
      ));
      toast.success(`${setting.display_name} ${!setting.is_enabled ? 'enabled' : 'disabled'}`);
    } else {
      toast.error('Failed to update');
    }
    setSaving(null);
  };

  // ── Save limit ────────────────────────────────────────────────────────────
  const saveLimit = async (setting: EmailTypeSetting) => {
    const newLimit = editLimit[setting.id];
    if (!newLimit || newLimit < 1 || newLimit === setting.daily_limit) return;
    setSaving(setting.id);
    const { error } = await supabase
      .from('email_type_settings')
      .update({ daily_limit: newLimit, updated_at: new Date().toISOString() })
      .eq('id', setting.id);
    if (!error) {
      setSettings(prev => prev.map(s =>
        s.id === setting.id ? { ...s, daily_limit: newLimit } : s
      ));
      toast.success(`Limit updated to ${newLimit}/day`);
      setEditLimit(prev => { const n = { ...prev }; delete n[setting.id]; return n; });
    } else {
      toast.error('Failed to save limit');
    }
    setSaving(null);
  };

  // ── Send all scheduled now ────────────────────────────────────────────────
  const sendAllScheduled = async () => {
    if (!confirm(`Send all ${queue.length} scheduled emails now? This overrides daily limits.`)) return;
    setIsSendingAll(true);
    // Mark all pending as manually triggered so process-email-queue sends them immediately
    const { error } = await supabase
      .from('email_queue')
      .update({ is_manually_triggered: true, scheduled_for: new Date().toISOString() })
      .eq('status', 'pending');

    if (!error) {
      // Trigger the queue processor
      await supabase.functions.invoke('process-email-queue');
      toast.success('All scheduled emails queued for immediate sending');
      fetchQueue();
    } else {
      toast.error('Failed to trigger send-all');
    }
    setIsSendingAll(false);
  };

  // ── Manually trigger a single queued email ────────────────────────────────
  const triggerEmail = async (emailId: string) => {
    setTriggeringId(emailId);
    const { error } = await supabase
      .from('email_queue')
      .update({
        is_manually_triggered: true,
        scheduled_for: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', emailId);

    if (!error) {
      await supabase.functions.invoke('process-email-queue');
      toast.success('Email triggered for immediate sending');
      fetchQueue();
    } else {
      toast.error('Failed to trigger email');
    }
    setTriggeringId(null);
  };

  // ── Reset today's counts (manual) ────────────────────────────────────────
  const resetDailyCounts = async () => {
    if (!confirm('Reset today\'s sent counts for all email types? This does not affect Resend limits.')) return;
    await supabase.rpc('reset_email_daily_counts');
    toast.success('Daily counts reset');
    fetchSettings();
  };

  // ── Derived ──────────────────────────────────────────────────────────────
  const totalSentToday   = settings.reduce((s, e) => s + e.sent_today, 0);
  const totalScheduled   = queue.length;
  const disabledCount    = settings.filter(s => !s.is_enabled).length;
  const nearLimitCount   = settings.filter(s => s.is_enabled && pct(s.sent_today, s.daily_limit) >= 80).length;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Email Controls</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Set daily limits per email type. When a limit is hit, remaining emails are scheduled for next day — newest first.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={resetDailyCounts}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
            Reset Counts
          </button>
          {totalScheduled > 0 && (
            <button onClick={sendAllScheduled} disabled={isSendingAll}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-orange-500 text-white rounded-xl hover:bg-orange-600 disabled:opacity-50 transition-colors">
              {isSendingAll
                ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Send className="w-3.5 h-3.5" />
              }
              Send All Now ({totalScheduled})
            </button>
          )}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Sent Today',      value: totalSentToday,  color: 'text-blue-600',   bg: 'bg-blue-50',   icon: Mail     },
          { label: 'Scheduled',       value: totalScheduled,  color: 'text-orange-600', bg: 'bg-orange-50', icon: Calendar },
          { label: 'Near Limit',      value: nearLimitCount,  color: 'text-amber-600',  bg: 'bg-amber-50',  icon: AlertTriangle },
          { label: 'Types Disabled',  value: disabledCount,   color: 'text-gray-600',   bg: 'bg-gray-100',  icon: ToggleLeft },
        ].map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} className={`${k.bg} rounded-xl p-4 border border-white`}>
              <Icon className={`w-4 h-4 ${k.color} mb-2`} />
              <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 self-start w-fit">
        {(['controls', 'queue'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              activeTab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t === 'queue' ? `Queue (${totalScheduled})` : 'Controls'}
          </button>
        ))}
      </div>

      {/* ── CONTROLS TAB ──────────────────────────────────────────────────── */}
      {activeTab === 'controls' && (
        <div className="space-y-2">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 animate-pulse h-16" />
              ))
            : settings.map(s => {
                const p = pct(s.sent_today, s.daily_limit);
                const { bar, text } = usageColor(p);
                const isExpanded = expandedType === s.email_type;
                const isSavingThis = saving === s.id;
                const pendingLimit = editLimit[s.id];

                return (
                  <div key={s.id}
                    className={`bg-white border rounded-xl overflow-hidden transition-colors ${
                      !s.is_enabled ? 'border-gray-100 opacity-60' : 'border-gray-100 hover:border-gray-200'
                    }`}>
                    {/* Row */}
                    <div className="px-4 py-3 flex items-center gap-3">
                      {/* Toggle */}
                      <button onClick={() => toggleEnabled(s)} disabled={!!isSavingThis}
                        className="flex-shrink-0 transition-opacity" title={s.is_enabled ? 'Disable' : 'Enable'}>
                        {s.is_enabled
                          ? <ToggleRight className="w-8 h-8 text-emerald-500" />
                          : <ToggleLeft className="w-8 h-8 text-gray-300" />
                        }
                      </button>

                      {/* Name + desc */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900">{s.display_name}</span>
                          <span className="text-[10px] text-gray-400 font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                            {s.email_type}
                          </span>
                          {p >= 100 && (
                            <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                              LIMIT HIT
                            </span>
                          )}
                        </div>
                        {/* Progress bar */}
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                            <div className={`${bar} rounded-full h-1.5 transition-all`}
                              style={{ width: `${p}%` }} />
                          </div>
                          <span className={`text-xs font-semibold ${text} whitespace-nowrap`}>
                            {s.sent_today}/{s.daily_limit}
                          </span>
                        </div>
                      </div>

                      {/* Expand */}
                      <button onClick={() => setExpandedType(isExpanded ? null : s.email_type)}
                        className="p-1 hover:bg-gray-100 rounded-lg flex-shrink-0">
                        {isExpanded
                          ? <ChevronUp className="w-4 h-4 text-gray-400" />
                          : <ChevronDown className="w-4 h-4 text-gray-400" />
                        }
                      </button>
                    </div>

                    {/* Expanded edit */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 bg-gray-50 px-4 py-4">
                        <p className="text-xs text-gray-500 mb-3">{s.description}</p>
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex items-center gap-2">
                            <label className="text-xs font-medium text-gray-600 whitespace-nowrap">
                              Daily limit:
                            </label>
                            <input
                              type="number"
                              min={1}
                              value={pendingLimit ?? s.daily_limit}
                              onChange={e => setEditLimit(prev => ({ ...prev, [s.id]: Number(e.target.value) }))}
                              className="w-24 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-orange-400"
                            />
                          </div>
                          {pendingLimit && pendingLimit !== s.daily_limit && (
                            <button onClick={() => saveLimit(s)} disabled={!!isSavingThis}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-semibold hover:bg-orange-600 disabled:opacity-50">
                              {isSavingThis
                                ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                : <CheckCircle className="w-3.5 h-3.5" />
                              }
                              Save
                            </button>
                          )}
                          <div className="flex items-center gap-4 text-xs text-gray-400 ml-auto">
                            <span>All time: <strong className="text-gray-700">{s.total_sent_all_time.toLocaleString()}</strong></span>
                            <span>Priority: <strong className="text-gray-700">{s.priority}</strong></span>
                            <span>Reset: <strong className="text-gray-700">{new Date(s.last_reset_at).toLocaleDateString()}</strong></span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
          }
        </div>
      )}

      {/* ── QUEUE TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'queue' && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {queue.length === 0 ? (
            <div className="py-16 text-center">
              <Inbox className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No scheduled emails in queue</p>
              <p className="text-xs text-gray-300 mt-1">Emails appear here when daily limits are reached</p>
            </div>
          ) : (
            <>
              {/* Queue header */}
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <span className="text-sm font-semibold text-gray-700">{queue.length} emails scheduled</span>
                <span className="text-xs text-gray-400">Newest emails sent first when triggered</span>
              </div>
              <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
                {queue.map(email => (
                  <div key={email.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Mail className="w-4 h-4 text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900 truncate">{email.to_email}</span>
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-mono">
                          {email.template_name || email.email_type}
                        </span>
                        {email.is_manually_triggered && (
                          <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded font-semibold">
                            Manual
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                        <span>Scheduled: {new Date(email.scheduled_for).toLocaleString('en-NG', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                        })}</span>
                        <span>Priority: {email.priority}</span>
                        {email.attempts > 0 && <span className="text-red-400">{email.attempts} attempt(s)</span>}
                      </div>
                    </div>
                    <button onClick={() => triggerEmail(email.id)} disabled={triggeringId === email.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg text-xs font-semibold hover:bg-emerald-100 disabled:opacity-50 flex-shrink-0 transition-colors">
                      {triggeringId === email.id
                        ? <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                        : <Play className="w-3 h-3" />
                      }
                      Send Now
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
