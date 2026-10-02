import { useState, useEffect, useRef } from 'react';
import { Loader, Search, X, CheckCircle2 } from 'lucide-react';
import CONFIG from '@/lib/config';
import ManagementOrdersLegacy, { OrderDetails } from './ManagementOrdersLegacy';
import { toast } from 'sonner';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import`;
const BATCH_VIEW_STORAGE_KEY = 'qafrica-import-admin-v2-batch-view';
const BATCH_SELECTION_STORAGE_KEY = 'qafrica-import-admin-v2-selected-batch';
const BATCH_CUSTOMER_TAB_KEY = 'qafrica-import-admin-v2-customer-bill-tab';
const BATCH_CUSTOMER_SCROLL_KEY = 'qafrica-import-admin-v2-customer-scroll';

type CustomerBillTab = 'unbilled' | 'billed' | 'paid';

export default function ManagementOrders() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [found, setFound] = useState<any>(null);
  const [details, setDetails] = useState<any>(null);
  const legacyRootRef = useRef<HTMLDivElement>(null);
  const restoringRef = useRef(false);
  const token = sessionStorage.getItem('import_manager_token') || '';

  const getScrollContainer = (): HTMLElement | null => {
    let node: HTMLElement | null = legacyRootRef.current;
    while (node) {
      const style = window.getComputedStyle(node);
      if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  };

  const getBatchStorageId = () => localStorage.getItem(BATCH_SELECTION_STORAGE_KEY) || 'current';

  const getStoredCustomerTab = (batchId = getBatchStorageId()): CustomerBillTab => {
    const value = localStorage.getItem(`${BATCH_CUSTOMER_TAB_KEY}:${batchId}`);
    return value === 'billed' || value === 'paid' ? value : 'unbilled';
  };

  const restoreCustomerTabAndScroll = (batchId = getBatchStorageId()) => {
    const root = legacyRootRef.current;
    if (!root) return;

    let attempts = 0;
    const tab = getStoredCustomerTab(batchId);
    const savedScroll = Number(localStorage.getItem(`${BATCH_CUSTOMER_SCROLL_KEY}:${batchId}:${tab}`) || '0');

    const restore = () => {
      attempts += 1;
      const buttons = Array.from(root.querySelectorAll('button'));
      const tabButton = buttons.find((button) => {
        const text = button.textContent?.trim() || '';
        return text.startsWith(tab === 'unbilled' ? '1. Unbilled' : tab === 'billed' ? '2. Billed' : '3. Paid');
      });

      if (!tabButton) {
        if (attempts < 60) window.setTimeout(restore, 100);
        return;
      }

      tabButton.click();

      const restorePosition = (remaining: number) => {
        const container = getScrollContainer();
        if (!container) {
          if (remaining > 0) window.setTimeout(() => restorePosition(remaining - 1), 100);
          return;
        }
        container.scrollTop = Math.max(0, savedScroll);
        if (remaining > 0) {
          window.requestAnimationFrame(() => {
            container.scrollTop = Math.max(0, savedScroll);
            window.setTimeout(() => restorePosition(remaining - 1), 60);
          });
        }
      };

      window.setTimeout(() => restorePosition(10), 80);
    };

    window.setTimeout(restore, 80);
  };

  const searchOrder = async () => {
    const code = query.trim().toUpperCase();
    if (!code) return;
    setLoading(true);
    setError('');
    setFound(null);
    try {
      if (!token) throw new Error('Management session expired');
      const res = await fetch(`${EDGE_URL}?action=load-code`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ manager_token: token, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error || !data.order) throw new Error(data.error ?? 'Order not found');
      setFound(data.order);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Order not found';
      setError(message); toast.error(message);
    } finally { setLoading(false); }
  };

  const clearSearch = () => { setQuery(''); setFound(null); setError(''); };
  const batchLabel = found?.staged_at
    ? `Batch — ${new Date(found.staged_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}`
    : 'Active — not yet assigned to a batch';

  useEffect(() => {
    const root = legacyRootRef.current;
    if (!root) return;
    const view = localStorage.getItem(BATCH_VIEW_STORAGE_KEY);
    const selected = localStorage.getItem(BATCH_SELECTION_STORAGE_KEY);
    if (view !== 'closed') return;

    restoringRef.current = true;
    let attempts = 0;
    let timer: number | undefined;
    const restore = () => {
      attempts += 1;
      const buttons = Array.from(root.querySelectorAll('button'));
      const closedButton = buttons.find((button) => button.textContent?.trim() === 'Closed');
      if (!closedButton) {
        if (attempts < 50) timer = window.setTimeout(restore, 100);
        else restoringRef.current = false;
        return;
      }
      closedButton.click();
      if (!selected) { restoringRef.current = false; return; }

      const findAndOpenBatch = () => {
        const viewButtons = Array.from(root.querySelectorAll('button')).filter((button) => button.textContent?.trim() === 'View');
        const match = viewButtons.find((button) => button.closest('tr')?.textContent?.includes(selected) ?? false);
        if (match) {
          match.click();
          restoreCustomerTabAndScroll(selected);
          restoringRef.current = false;
          return;
        }
        attempts += 1;
        if (attempts < 50) timer = window.setTimeout(findAndOpenBatch, 100);
        else restoringRef.current = false;
      };
      timer = window.setTimeout(findAndOpenBatch, 100);
    };
    timer = window.setTimeout(restore, 0);
    return () => { if (timer !== undefined) window.clearTimeout(timer); restoringRef.current = false; };
  }, []);

  useEffect(() => {
    const root = legacyRootRef.current;
    if (!root) return;

    const saveScroll = () => {
      if (restoringRef.current) return;
      const selected = localStorage.getItem(BATCH_SELECTION_STORAGE_KEY);
      if (!selected) return;
      const tab = getStoredCustomerTab(selected);
      const container = getScrollContainer();
      if (container) localStorage.setItem(`${BATCH_CUSTOMER_SCROLL_KEY}:${selected}:${tab}`, String(container.scrollTop));
    };

    const onClick = (event: MouseEvent) => {
      if (restoringRef.current) return;
      const target = event.target as HTMLElement | null;
      const button = target?.closest('button');
      if (!button || !root.contains(button)) return;
      const text = button.textContent?.trim() ?? '';

      if (text === 'Active') {
        localStorage.setItem(BATCH_VIEW_STORAGE_KEY, 'active');
        localStorage.removeItem(BATCH_SELECTION_STORAGE_KEY);
      } else if (text === 'Closed') {
        localStorage.setItem(BATCH_VIEW_STORAGE_KEY, 'closed');
        localStorage.removeItem(BATCH_SELECTION_STORAGE_KEY);
      } else if (text === 'View') {
        const row = button.closest('tr');
        const rowText = row?.textContent?.trim();
        if (rowText) {
          localStorage.setItem(BATCH_VIEW_STORAGE_KEY, 'closed');
          localStorage.setItem(BATCH_SELECTION_STORAGE_KEY, rowText);
          restoreCustomerTabAndScroll(rowText);
        }
      } else if (text.startsWith('1. Unbilled') || text.startsWith('2. Billed') || text.startsWith('3. Paid')) {
        const selected = localStorage.getItem(BATCH_SELECTION_STORAGE_KEY);
        if (selected) {
          const tab: CustomerBillTab = text.startsWith('1. Unbilled') ? 'unbilled' : text.startsWith('2. Billed') ? 'billed' : 'paid';
          localStorage.setItem(`${BATCH_CUSTOMER_TAB_KEY}:${selected}`, tab);
          window.setTimeout(() => {
            const saved = Number(localStorage.getItem(`${BATCH_CUSTOMER_SCROLL_KEY}:${selected}:${tab}`) || '0');
            const container = getScrollContainer();
            if (container) container.scrollTop = Math.max(0, saved);
          }, 80);
        }
      }
    };

    const container = getScrollContainer();
    if (container) container.addEventListener('scroll', saveScroll, { passive: true });
    root.addEventListener('click', onClick);

    return () => {
      if (container) container.removeEventListener('scroll', saveScroll);
      root.removeEventListener('click', onClick);
    };
  }, []);

  const searchContent = (
    <div className="w-full space-y-3 mt-3 mb-1">
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input value={query} onChange={e => { setQuery(e.target.value.toUpperCase()); setError(''); }} onKeyDown={e => { if (e.key === 'Enter') void searchOrder(); }} placeholder="Search any order by order code…" className="flex-1 min-w-0 px-1 py-2 text-sm outline-none font-mono uppercase" aria-label="Search batch orders by order code" />
          {query && <button onClick={clearSearch} className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Clear search"><X className="w-4 h-4 text-gray-400" /></button>}
          <button onClick={() => void searchOrder()} disabled={loading || !query.trim()} className="px-4 py-2 bg-gray-900 hover:bg-gray-700 disabled:opacity-30 text-white text-xs font-bold rounded-xl flex items-center gap-1.5">{loading ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />} Search</button>
        </div>
        {error && <p className="mt-2 text-[11px] text-red-500">{error}</p>}
      </div>
      {found && (
        <div className="bg-white rounded-2xl border border-orange-100 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Order found</p>
              <button onClick={() => setDetails(found)} className="mt-0.5 text-sm font-black text-orange-600 font-mono hover:underline">{found.code}</button>
              <p className="text-xs text-gray-700 mt-1">{found.customer_name} · {found.customer_whatsapp || 'No WhatsApp'}</p>
              <p className="text-[11px] text-gray-400 mt-1">Created {new Date(found.created_at).toLocaleString('en-NG')}</p>
              <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg"><CheckCircle2 className="w-3.5 h-3.5" /> {batchLabel}</p>
            </div>
            <button onClick={() => setDetails(found)} className="shrink-0 px-3 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold">View details</button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="w-full space-y-4">
      <div ref={legacyRootRef}>
        <ManagementOrdersLegacy belowTabs={searchContent} />
      </div>
      {details && <OrderDetails token={token} order={details} onClose={() => setDetails(null)} onReload={async () => { setDetails(null); }} onOpenClient={() => toast.info('Open this order from the batch list to view client details.')} />}
    </div>
  );
}
