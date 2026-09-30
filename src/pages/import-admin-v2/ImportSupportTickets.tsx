import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, CheckCircle2, Clock3, FileText, Loader2, MessageSquare, Plus,
  Search, UserRound, X, ChevronRight, RefreshCw, CircleDot,
} from 'lucide-react';
import CONFIG from '@/lib/config';
import { getManagementToken } from './ManagementAuth';
import { useImportAdminPermissions } from '@/hooks/useImportAdminPermissions';

const API_URL = CONFIG.SUPABASE_URL + '/functions/v1/import-support-tickets';

type Status = 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';
type Priority = 'low' | 'normal' | 'high' | 'urgent';

type Ticket = {
  id: string;
  ticket_number: number;
  customer_id: string | null;
  conversation_id: string | null;
  order_id: string | null;
  order_code: string | null;
  category: string;
  subject: string;
  description: string | null;
  status: Status;
  priority: Priority;
  assigned_agent_id: string | null;
  resolution_notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  closed_at: string | null;
  customers?: { id: string; full_name: string | null; email: string | null; phone: string | null; avatar_url: string | null } | null;
};

async function request(token: string, action: string, extra: Record<string, unknown> = {}) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, manager_token: token, ...extra }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Ticket request failed');
  return data;
}

const STATUS_LABELS: Record<Status, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  waiting_customer: 'Waiting for Customer',
  resolved: 'Resolved',
  closed: 'Closed',
};

function statusClass(status: Status) {
  if (status === 'open') return 'bg-orange-50 text-orange-700 border-orange-100';
  if (status === 'in_progress') return 'bg-blue-50 text-blue-700 border-blue-100';
  if (status === 'waiting_customer') return 'bg-amber-50 text-amber-700 border-amber-100';
  if (status === 'resolved') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  return 'bg-gray-100 text-gray-600 border-gray-200';
}

function priorityClass(priority: Priority) {
  if (priority === 'urgent') return 'text-red-600';
  if (priority === 'high') return 'text-orange-600';
  if (priority === 'low') return 'text-gray-400';
  return 'text-gray-500';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function ticketCode(number: number) {
  return `QAF-${String(number).padStart(6, '0')}`;
}

export default function ImportSupportTickets() {
  const token = getManagementToken();
  const { loading: permissionLoading, error: permissionError, hasPermission } = useImportAdminPermissions(token);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | Status>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createForm, setCreateForm] = useState({ subject: '', description: '', order_code: '', category: 'general', priority: 'normal' as Priority });

  const loadTickets = useCallback(async (silent = false) => {
    if (!token) return;
    if (silent) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const data = await request(token, 'list_tickets', { status: 'all' });
      setTickets((data.tickets || []) as Ticket[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load support tickets');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { void loadTickets(); }, [loadTickets]);

  const counts = useMemo(() => {
    const result: Record<'all' | Status, number> = { all: tickets.length, open: 0, in_progress: 0, waiting_customer: 0, resolved: 0, closed: 0 };
    for (const ticket of tickets) result[ticket.status] += 1;
    return result;
  }, [tickets]);

  const filtered = useMemo(() => {
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return tickets.filter(ticket => {
      if (statusFilter !== 'all' && ticket.status !== statusFilter) return false;
      if (!terms.length) return true;
      const customer = ticket.customers;
      const haystack = [
        ticketCode(ticket.ticket_number), ticket.subject, ticket.description, ticket.order_code,
        ticket.category, ticket.status, customer?.full_name, customer?.email, customer?.phone,
      ].filter(Boolean).join(' ').toLowerCase();
      return terms.every(term => haystack.includes(term));
    });
  }, [tickets, query, statusFilter]);

  const updateStatus = async (status: Status) => {
    if (!token || !selected) return;
    setSaving(true);
    try {
      const data = await request(token, 'update_ticket', { ticket_id: selected.id, status });
      const updated = data.ticket as Ticket;
      setTickets(current => current.map(ticket => ticket.id === updated.id ? updated : ticket));
      setSelected(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update ticket');
    } finally {
      setSaving(false);
    }
  };

  const createTicket = async () => {
    if (!token || !createForm.subject.trim()) return;
    setSaving(true);
    try {
      const data = await request(token, 'create_ticket', createForm);
      const ticket = data.ticket as Ticket;
      setTickets(current => [ticket, ...current]);
      setSelected(ticket);
      setCreating(false);
      setCreateForm({ subject: '', description: '', order_code: '', category: 'general', priority: 'normal' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create ticket');
    } finally {
      setSaving(false);
    }
  };

  if (!token) return null;
  if (permissionLoading) return <div className="min-h-[240px] flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-orange-500" /></div>;
  if (permissionError) return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{permissionError}</div>;
  if (!hasPermission('import.messages.view')) return <div className="rounded-2xl border border-gray-200 bg-white p-6"><p className="font-semibold text-gray-900">Support access required</p><p className="text-sm text-gray-500 mt-1">Your manager account cannot view support tickets.</p></div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Support Tickets</h1>
          <p className="text-sm text-gray-500 mt-1">Track support requests separately from live WhatsApp conversations.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void loadTickets(true)} className="h-10 px-3 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 flex items-center gap-2 text-sm">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button type="button" onClick={() => setCreating(true)} className="h-10 px-4 rounded-xl bg-orange-500 text-white hover:bg-orange-600 flex items-center gap-2 text-sm font-semibold">
            <Plus className="w-4 h-4" /> New ticket
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(['all', 'open', 'in_progress', 'waiting_customer', 'resolved'] as const).map(status => (
          <button key={status} type="button" onClick={() => setStatusFilter(status)} className={`text-left rounded-2xl border p-4 bg-white transition ${statusFilter === status ? 'border-orange-300 ring-2 ring-orange-100' : 'border-gray-100 hover:border-gray-200'}`}>
            <div className="flex items-center justify-between"><span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{status === 'all' ? 'Total' : STATUS_LABELS[status]}</span><CircleDot className="w-4 h-4 text-gray-300" /></div>
            <p className="text-2xl font-bold text-gray-900 mt-2">{counts[status]}</p>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search ticket, customer, order, issue or keyword..." className="w-full h-10 pl-9 pr-9 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:bg-white focus:border-orange-300" />
            {query && <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400"><X className="w-4 h-4" /></button>}
          </div>
          <span className="text-xs text-gray-400">{filtered.length} ticket{filtered.length === 1 ? '' : 's'}</span>
        </div>

        {loading ? (
          <div className="py-16 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-orange-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center"><FileText className="w-8 h-8 mx-auto text-gray-300" /><p className="mt-3 font-semibold text-gray-700">No tickets found</p><p className="text-sm text-gray-400 mt-1">Tickets created from AI support handoffs will appear here.</p></div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(ticket => {
              const customer = ticket.customers;
              return (
                <button key={ticket.id} type="button" onClick={() => setSelected(ticket)} className="w-full text-left px-4 py-4 hover:bg-gray-50 transition flex items-center gap-4">
                  {customer?.avatar_url ? <img src={customer.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"><UserRound className="w-5 h-5 text-gray-400" /></div>}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-bold text-orange-600">{ticketCode(ticket.ticket_number)}</span><span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusClass(ticket.status)}`}>{STATUS_LABELS[ticket.status]}</span><span className={`text-[10px] font-semibold uppercase ${priorityClass(ticket.priority)}`}>{ticket.priority}</span></div>
                    <p className="font-semibold text-sm text-gray-900 mt-1 truncate">{ticket.subject}</p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{customer?.full_name || customer?.phone || 'Unknown customer'} {ticket.order_code ? `• Order ${ticket.order_code}` : ''}</p>
                  </div>
                  <div className="hidden sm:block text-right"><p className="text-[11px] text-gray-400">Updated</p><p className="text-xs text-gray-600 mt-0.5">{formatDate(ticket.updated_at)}</p></div>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-[70] bg-black/40 flex items-end md:items-center justify-center p-0 md:p-6" onClick={() => setSelected(null)}>
          <div className="bg-white w-full md:max-w-2xl md:rounded-2xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100 flex items-start justify-between sticky top-0 bg-white z-10">
              <div><div className="flex items-center gap-2"><span className="text-sm font-bold text-orange-600">{ticketCode(selected.ticket_number)}</span><span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusClass(selected.status)}`}>{STATUS_LABELS[selected.status]}</span></div><h2 className="text-lg font-bold text-gray-900 mt-2">{selected.subject}</h2></div>
              <button onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-5 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-gray-50 p-3"><p className="text-[10px] uppercase tracking-wide text-gray-400">Customer</p><p className="text-sm font-semibold text-gray-900 mt-1">{selected.customers?.full_name || selected.customers?.phone || 'Unknown'}</p><p className="text-xs text-gray-500 mt-0.5">{selected.customers?.phone || selected.customers?.email || ''}</p></div>
                <div className="rounded-xl bg-gray-50 p-3"><p className="text-[10px] uppercase tracking-wide text-gray-400">Order</p><p className="text-sm font-semibold text-gray-900 mt-1">{selected.order_code || 'Not linked'}</p><p className="text-xs text-gray-500 mt-0.5">{selected.category}</p></div>
              </div>
              <div><p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Request</p><p className="text-sm text-gray-700 whitespace-pre-wrap mt-2">{selected.description || 'No description provided.'}</p></div>
              {selected.conversation_id && <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 flex gap-3"><MessageSquare className="w-5 h-5 text-blue-500 mt-0.5" /><div><p className="text-sm font-semibold text-blue-900">Linked WhatsApp conversation</p><p className="text-xs text-blue-700 mt-0.5">This ticket can be traced back to the customer's support conversation.</p></div></div>}
              <div><p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Change status</p><div className="flex flex-wrap gap-2 mt-2">{(['open','in_progress','waiting_customer','resolved','closed'] as Status[]).map(status => <button key={status} disabled={saving || selected.status === status} onClick={() => void updateStatus(status)} className={`px-3 py-2 rounded-lg border text-xs font-semibold ${selected.status === status ? statusClass(status) : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{STATUS_LABELS[status]}</button>)}</div></div>
              <div className="text-[11px] text-gray-400 flex items-center gap-2"><Clock3 className="w-3.5 h-3.5" /> Created {formatDate(selected.created_at)} • Updated {formatDate(selected.updated_at)}</div>
            </div>
          </div>
        </div>
      )}

      {creating && (
        <div className="fixed inset-0 z-[70] bg-black/40 flex items-end md:items-center justify-center p-0 md:p-6" onClick={() => setCreating(false)}>
          <div className="bg-white w-full md:max-w-lg md:rounded-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100 flex items-center justify-between"><h2 className="font-bold text-gray-900">Create support ticket</h2><button onClick={() => setCreating(false)}><X className="w-5 h-5 text-gray-500" /></button></div>
            <div className="p-5 space-y-4">
              <input value={createForm.subject} onChange={e => setCreateForm(v => ({ ...v, subject: e.target.value }))} placeholder="Ticket subject" className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-orange-300" />
              <input value={createForm.order_code} onChange={e => setCreateForm(v => ({ ...v, order_code: e.target.value }))} placeholder="Order code (optional)" className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-orange-300" />
              <div className="grid grid-cols-2 gap-3"><select value={createForm.category} onChange={e => setCreateForm(v => ({ ...v, category: e.target.value }))} className="h-10 px-3 rounded-xl border border-gray-200 text-sm"><option value="general">General</option><option value="address_change">Address change</option><option value="variant_change">Variant change</option><option value="order_issue">Order issue</option><option value="billing">Billing</option><option value="delivery">Delivery</option></select><select value={createForm.priority} onChange={e => setCreateForm(v => ({ ...v, priority: e.target.value as Priority }))} className="h-10 px-3 rounded-xl border border-gray-200 text-sm"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>
              <textarea value={createForm.description} onChange={e => setCreateForm(v => ({ ...v, description: e.target.value }))} placeholder="Describe the customer's request..." rows={5} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm resize-none outline-none focus:border-orange-300" />
              <button disabled={saving || !createForm.subject.trim()} onClick={() => void createTicket()} className="w-full h-11 rounded-xl bg-orange-500 text-white font-semibold text-sm disabled:opacity-50">{saving ? 'Creating…' : 'Create ticket'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
