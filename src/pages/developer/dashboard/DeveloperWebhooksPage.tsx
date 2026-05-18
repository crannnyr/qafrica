// src/pages/developer/dashboard/DeveloperWebhooksPage.tsx
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Webhook, Plus, Trash2, X, Check, Loader2,
  AlertTriangle, Play, RefreshCw, AlertCircle,
  ChevronLeft, ChevronRight, Clock, CheckCircle,
  XCircle, Radio,
} from 'lucide-react';
import { useDeveloperApiStore }       from '@/stores/developerApiStore';
import { useDeveloperPlan }           from '@/hooks/useDeveloperPlan';
import { WebhookEventSelector }       from '@/components/developer/WebhookEventSelector';
import { PlanGateMessage }            from '@/components/developer/PlanGateMessage';
import { CopyButton }                 from '@/components/developer/CopyButton';
import type { WebhookEvent, DeveloperWebhookConfig } from '@/types/developer';
import { toast } from 'sonner';

// ── Register webhook modal ────────────────────────────────────
function RegisterModal({
  onClose,
  onSubmit,
  isLoading,
}: {
  onClose: () => void;
  onSubmit: (url: string, events: WebhookEvent[]) => void;
  isLoading: boolean;
}) {
  const [url,    setUrl]    = useState('');
  const [events, setEvents] = useState<WebhookEvent[]>(['order.created', 'order.shipped', 'order.delivered']);
  const [errors, setErrors] = useState<{ url?: string; events?: string }>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!url.trim())               errs.url    = 'Webhook URL is required.';
    else if (!url.startsWith('https://')) errs.url = 'URL must start with https://';
    else {
      try { new URL(url); } catch { errs.url = 'Enter a valid URL.'; }
    }
    if (events.length === 0)       errs.events = 'Select at least one event.';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    onSubmit(url.trim(), events);
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-bold text-gray-900">Register Webhook</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto">
          <div className="p-6 space-y-5">
            {/* URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Endpoint URL <span className="text-orange-500">*</span>
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => { setUrl(e.target.value); setErrors((err) => ({ ...err, url: undefined })); }}
                placeholder="https://yourplatform.com/qafrica-webhooks"
                autoFocus
                className={`w-full h-11 px-4 rounded-xl border text-sm text-gray-900
                  placeholder-gray-400 focus:outline-none focus:ring-2
                  focus:ring-orange-500/20 focus:border-orange-500 transition-colors bg-white
                  ${errors.url ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
              />
              {errors.url
                ? <p className="text-xs text-red-500 mt-1.5">{errors.url}</p>
                : <p className="text-xs text-gray-400 mt-1.5">Must be HTTPS. We will POST JSON to this URL.</p>
              }
            </div>

            {/* Events */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Events to subscribe to <span className="text-orange-500">*</span>
              </label>
              {errors.events && (
                <p className="text-xs text-red-500 mb-2">{errors.events}</p>
              )}
              <WebhookEventSelector
                selected={events}
                onChange={setEvents}
              />
            </div>
          </div>

          <div className="px-6 pb-6 flex gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 border border-gray-200 text-gray-600 font-medium
                rounded-xl hover:bg-gray-50 transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 h-11 bg-orange-500 hover:bg-orange-600 disabled:opacity-50
                text-white font-semibold rounded-xl transition-colors text-sm
                flex items-center justify-center gap-2"
            >
              {isLoading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Registering...</>
                : 'Register webhook'
              }
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ── Signing secret reveal modal ───────────────────────────────
function SecretRevealModal({
  secret,
  onClose,
}: {
  secret: string;
  onClose: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
      >
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Webhook Signing Secret</h2>
          <p className="text-xs text-gray-500 mt-0.5">Shown once — store it securely.</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              Use this secret to verify incoming webhook signatures.
              We cannot recover it — copy it now.
            </p>
          </div>

          <div className="bg-gray-900 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
              <span className="text-xs text-gray-500 font-mono">Signing secret</span>
              <CopyButton text={secret} size="sm" />
            </div>
            <div className="px-4 py-3">
              <code className="text-xs font-mono text-green-400 break-all">{secret}</code>
            </div>
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
            />
            <span className="text-sm text-gray-700">
              I have saved this secret securely.
            </span>
          </label>

          <button
            onClick={onClose}
            disabled={!confirmed}
            className="w-full h-11 bg-orange-500 hover:bg-orange-600 disabled:opacity-40
              disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors text-sm"
          >
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Webhook card ──────────────────────────────────────────────
function WebhookCard({
  webhook,
  onDelete,
  onTest,
  isDeleting,
  isTesting,
  testResult,
}: {
  webhook: DeveloperWebhookConfig;
  onDelete: () => void;
  onTest: () => void;
  isDeleting: boolean;
  isTesting: boolean;
  testResult?: { delivered: boolean; message: string } | null;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5">
      {/* URL + actions */}
      <div className="flex items-start gap-3 mb-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Radio className={`w-3.5 h-3.5 flex-shrink-0 ${webhook.is_active ? 'text-green-500' : 'text-gray-300'}`} />
            <code className="text-sm font-mono text-gray-800 truncate">
              {webhook.url}
            </code>
          </div>
          <p className="text-xs text-gray-400">
            {webhook.events.length} event{webhook.events.length !== 1 ? 's' : ''}
            {webhook.stats && (
              <span className="ml-3">
                {webhook.stats.total} deliveries
                {webhook.stats.failed > 0 && (
                  <span className="text-red-500 ml-1">
                    · {webhook.stats.failed} failed
                  </span>
                )}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={onTest}
            disabled={isTesting}
            title="Send test payload"
            className="h-8 px-3 border border-gray-200 text-gray-600 text-xs font-medium
              rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors
              flex items-center gap-1.5"
          >
            {isTesting
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <Play className="w-3 h-3" />
            }
            Test
          </button>
          <button
            onClick={onDelete}
            disabled={isDeleting}
            title="Remove webhook"
            className="h-8 w-8 flex items-center justify-center border border-gray-200
              text-gray-400 rounded-lg hover:text-red-500 hover:bg-red-50
              disabled:opacity-50 transition-colors"
          >
            {isDeleting
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Trash2 className="w-3.5 h-3.5" />
            }
          </button>
        </div>
      </div>

      {/* Test result */}
      {testResult && (
        <div className={`flex items-start gap-2.5 p-3 rounded-xl text-xs mb-3 ${
          testResult.delivered
            ? 'bg-green-50 border border-green-200'
            : 'bg-red-50 border border-red-200'
        }`}>
          {testResult.delivered
            ? <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
            : <XCircle    className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5"   />
          }
          <span className={testResult.delivered ? 'text-green-700' : 'text-red-700'}>
            {testResult.message}
          </span>
        </div>
      )}

      {/* Events list */}
      <div className="flex flex-wrap gap-1.5">
        {webhook.events.slice(0, 8).map((ev) => (
          <code
            key={ev}
            className="text-xs font-mono bg-gray-50 text-gray-600 px-2 py-0.5 rounded-lg border border-gray-100"
          >
            {ev}
          </code>
        ))}
        {webhook.events.length > 8 && (
          <span className="text-xs text-gray-400 px-2 py-0.5">
            +{webhook.events.length - 8} more
          </span>
        )}
      </div>
    </div>
  );
}

// ── Delivery status badge ─────────────────────────────────────
function DeliveryStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending:   { label: 'Pending',   cls: 'bg-yellow-100 text-yellow-700' },
    delivered: { label: 'Delivered', cls: 'bg-green-100 text-green-700' },
    failed:    { label: 'Failed',    cls: 'bg-red-100 text-red-700' },
  };
  const s = map[status] ?? map.pending;
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.cls}`}>
      {s.label}
    </span>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function DeveloperWebhooksPage() {
  const {
    webhooks, webhooksLoading, webhooksError,
    newlyCreatedWebhookSecret,
    deliveries, deliveriesPage, deliveriesTotal, deliveriesLoading,
    fetchWebhooks, registerWebhook, deleteWebhook, testWebhook,
    clearNewWebhookSecret, fetchDeliveries,
  } = useDeveloperApiStore();

  const { can } = useDeveloperPlan();

  const [tab,          setTab]          = useState<'webhooks' | 'logs'>('webhooks');
  const [showRegister, setShowRegister] = useState(false);
  const [registering,  setRegistering]  = useState(false);
  const [deletingId,   setDeletingId]   = useState<string | null>(null);
  const [testingId,    setTestingId]    = useState<string | null>(null);
  const [testResults,  setTestResults]  = useState<Record<string, { delivered: boolean; message: string }>>({});

  useEffect(() => {
    fetchWebhooks();
  }, []);

  useEffect(() => {
    if (tab === 'logs') fetchDeliveries(1);
  }, [tab]);

  // ── Register ──────────────────────────────────────────────────
  async function handleRegister(url: string, events: WebhookEvent[]) {
    setRegistering(true);
    const result = await registerWebhook(url, events);
    setRegistering(false);
    if (result.success) {
      setShowRegister(false);
      // Secret modal shown by AnimatePresence watching newlyCreatedWebhookSecret
    } else {
      toast.error(result.error ?? 'Failed to register webhook.');
    }
  }

  // ── Delete ────────────────────────────────────────────────────
  async function handleDelete(webhookId: string) {
    setDeletingId(webhookId);
    const result = await deleteWebhook(webhookId);
    setDeletingId(null);
    if (result.success) {
      toast.success('Webhook removed.');
    } else {
      toast.error(result.error ?? 'Failed to delete webhook.');
    }
  }

  // ── Test ──────────────────────────────────────────────────────
  async function handleTest(webhookId: string) {
    setTestingId(webhookId);
    const result = await testWebhook(webhookId);
    setTestingId(null);
    setTestResults((prev) => ({
      ...prev,
      [webhookId]: { delivered: result.delivered, message: result.message },
    }));
    // Auto-clear test result after 8 seconds
    setTimeout(() => {
      setTestResults((prev) => {
        const n = { ...prev };
        delete n[webhookId];
        return n;
      });
    }, 8000);

    if (result.delivered) {
      toast.success('Test webhook delivered successfully.');
    } else {
      toast.error('Test webhook delivery failed. Check your endpoint.');
    }
  }

  if (!can.manageWebhooks) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Webhooks</h1>
        <PlanGateMessage
          requiredPlan="starter"
          featureName="Webhook notifications"
          description="Receive real-time event notifications on your platform when order statuses change."
        />
      </div>
    );
  }

  const deliveriesPages = Math.ceil(deliveriesTotal / 20);

  return (
    <>
      <div className="p-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Webhooks</h1>
            <p className="text-sm text-gray-500 mt-1">
              Receive real-time event notifications on your platform.
            </p>
          </div>
          <button
            onClick={() => setShowRegister(true)}
            className="h-10 px-5 bg-orange-500 hover:bg-orange-600 text-white font-semibold
              rounded-xl transition-colors text-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add webhook
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 mb-6">
          {[
            { id: 'webhooks', label: 'Endpoints' },
            { id: 'logs',     label: 'Delivery logs' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`h-9 px-5 rounded-xl text-sm font-semibold transition-colors ${
                tab === t.id
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Webhooks tab ──────────────────────────────────── */}
        {tab === 'webhooks' && (
          <>
            {webhooksError && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm text-red-700">{webhooksError}</p>
              </div>
            )}

            {webhooksLoading && webhooks.length === 0 && (
              <div className="flex justify-center py-12">
                <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
              </div>
            )}

            {!webhooksLoading && webhooks.length === 0 && !webhooksError && (
              <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Webhook className="w-7 h-7 text-gray-400" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">No webhooks yet</h3>
                <p className="text-sm text-gray-500 mb-5">
                  Register an endpoint to start receiving order events.
                </p>
                <button
                  onClick={() => setShowRegister(true)}
                  className="h-10 px-5 bg-orange-500 hover:bg-orange-600 text-white font-semibold
                    rounded-xl transition-colors text-sm inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Add first webhook
                </button>
              </div>
            )}

            <div className="space-y-3">
              <AnimatePresence>
                {webhooks.map((webhook) => (
                  <motion.div
                    key={webhook.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                  >
                    <WebhookCard
                      webhook={webhook}
                      onDelete={() => handleDelete(webhook.id)}
                      onTest={() => handleTest(webhook.id)}
                      isDeleting={deletingId === webhook.id}
                      isTesting={testingId === webhook.id}
                      testResult={testResults[webhook.id] ?? null}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </>
        )}

        {/* ── Delivery logs tab ─────────────────────────────── */}
        {tab === 'logs' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500">
                {deliveriesTotal.toLocaleString()} delivery attempts
              </p>
              <button
                onClick={() => fetchDeliveries(deliveriesPage)}
                disabled={deliveriesLoading}
                className="h-8 px-3 border border-gray-200 text-gray-600 text-xs font-medium
                  rounded-lg hover:bg-gray-50 flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${deliveriesLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {deliveriesLoading && deliveries.length === 0 && (
              <div className="flex justify-center py-10">
                <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
              </div>
            )}

            {!deliveriesLoading && deliveries.length === 0 && (
              <div className="text-center py-12 text-sm text-gray-400">
                No delivery attempts yet.
              </div>
            )}

            {deliveries.length > 0 && (
              <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                <div className="divide-y divide-gray-50">
                  {deliveries.map((d) => (
                    <div key={d.id} className="px-5 py-3.5 flex items-start gap-4">
                      <DeliveryStatusBadge status={d.status} />
                      <div className="flex-1 min-w-0">
                        <code className="text-xs font-mono text-gray-800">{d.event_type}</code>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{d.target_url}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-gray-500">
                          {d.attempts} attempt{d.attempts !== 1 ? 's' : ''}
                        </p>
                        {d.response_code && (
                          <p className="text-xs font-mono text-gray-400">
                            HTTP {d.response_code}
                          </p>
                        )}
                        <p className="text-xs text-gray-400">
                          {d.last_attempt_at
                            ? new Date(d.last_attempt_at).toLocaleDateString('en-NG', {
                                day: 'numeric', month: 'short',
                              })
                            : '—'
                          }
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pagination */}
            {deliveriesPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-5">
                <button
                  onClick={() => fetchDeliveries(deliveriesPage - 1)}
                  disabled={deliveriesPage <= 1 || deliveriesLoading}
                  className="w-9 h-9 rounded-lg border border-gray-200 flex items-center
                    justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-600">
                  {deliveriesPage} / {deliveriesPages}
                </span>
                <button
                  onClick={() => fetchDeliveries(deliveriesPage + 1)}
                  disabled={deliveriesPage >= deliveriesPages || deliveriesLoading}
                  className="w-9 h-9 rounded-lg border border-gray-200 flex items-center
                    justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showRegister && (
          <RegisterModal
            onClose={() => setShowRegister(false)}
            onSubmit={handleRegister}
            isLoading={registering}
          />
        )}
        {newlyCreatedWebhookSecret && (
          <SecretRevealModal
            secret={newlyCreatedWebhookSecret}
            onClose={() => clearNewWebhookSecret()}
          />
        )}
      </AnimatePresence>
    </>
  );
}