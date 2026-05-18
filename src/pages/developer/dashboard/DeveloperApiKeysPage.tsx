// src/pages/developer/dashboard/DeveloperApiKeysPage.tsx
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Key, Plus, Copy, Check, Trash2, Eye, EyeOff,
  Loader2, AlertTriangle, Clock, Shield, X,
  Terminal, ChevronDown,
} from 'lucide-react';
import { useDeveloperApiStore } from '@/stores/developerApiStore';
import { useDeveloperPlan }     from '@/hooks/useDeveloperPlan';
import type { DeveloperEnvironment } from '@/types/developer';
import { toast } from 'sonner';

// ── Copy button ───────────────────────────────────────────────
function CopyBtn({ text, size = 'md' }: { text: string; size?: 'sm' | 'md' }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  }
  const cls = size === 'sm'
    ? 'p-1 rounded-md'
    : 'p-1.5 rounded-lg';
  return (
    <button
      onClick={copy}
      className={`${cls} hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors`}
      title="Copy"
    >
      {copied
        ? <Check className="w-3.5 h-3.5 text-green-500" />
        : <Copy className="w-3.5 h-3.5" />
      }
    </button>
  );
}

// ── Key reveal modal ──────────────────────────────────────────
function KeyRevealModal({
  rawKey,
  onClose,
}: {
  rawKey: string;
  onClose: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center">
              <Key className="w-4.5 h-4.5 text-green-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">API Key Created</h2>
              <p className="text-xs text-gray-500">Copy it now — you won't see it again.</p>
            </div>
          </div>
          <button
            onClick={() => confirmed ? onClose() : undefined}
            disabled={!confirmed}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Warning banner */}
          <div className="flex items-start gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              <strong>This key is shown only once.</strong> Store it in a secrets manager,
              environment variable, or password manager. We cannot recover it.
            </p>
          </div>

          {/* Key display */}
          <div className="bg-gray-900 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
              <span className="text-xs text-gray-500 font-mono">API Key</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setRevealed((r) => !r)}
                  className="p-1 rounded text-gray-500 hover:text-gray-300 transition-colors"
                  title={revealed ? 'Hide key' : 'Reveal key'}
                >
                  {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <CopyBtn text={rawKey} size="sm" />
              </div>
            </div>
            <div className="px-4 py-3">
              <code className="text-xs font-mono text-green-400 break-all">
                {revealed ? rawKey : rawKey.slice(0, 20) + '•'.repeat(rawKey.length - 20)}
              </code>
            </div>
          </div>

          {/* Confirmation checkbox */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
            />
            <span className="text-sm text-gray-700">
              I have copied and securely stored this API key.
            </span>
          </label>

          <button
            onClick={onClose}
            disabled={!confirmed}
            className="w-full h-11 bg-orange-500 hover:bg-orange-600 disabled:opacity-50
              disabled:cursor-not-allowed text-white font-semibold rounded-xl
              transition-colors text-sm"
          >
            Done — close this window
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Create key modal ──────────────────────────────────────────
function CreateKeyModal({
  onClose,
  onSubmit,
  isLoading,
}: {
  onClose: () => void;
  onSubmit: (name: string, env: DeveloperEnvironment) => void;
  isLoading: boolean;
}) {
  const [name, setName] = useState('');
  const [env,  setEnv]  = useState<DeveloperEnvironment>('production');
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Key name is required.'); return; }
    if (name.trim().length < 3) { setError('Name must be at least 3 characters.'); return; }
    onSubmit(name.trim(), env);
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm"
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Create API Key</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Key name <span className="text-orange-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              placeholder="e.g. Production Integration"
              autoFocus
              maxLength={50}
              className={`w-full h-11 px-4 rounded-xl border text-sm text-gray-900
                placeholder-gray-400 focus:outline-none focus:ring-2
                focus:ring-orange-500/20 focus:border-orange-500 transition-colors
                ${error ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'}`}
            />
            {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
            <p className="text-xs text-gray-400 mt-1.5">
              A label to identify where this key is used. Visible in your key list.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Environment
            </label>
            <div className="relative">
              <select
                value={env}
                onChange={(e) => setEnv(e.target.value as DeveloperEnvironment)}
                className="w-full h-11 pl-4 pr-10 rounded-xl border border-gray-200 text-sm
                  text-gray-900 bg-white appearance-none focus:outline-none
                  focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
              >
                <option value="production">Production</option>
                <option value="test">Test / Sandbox</option>
              </select>
              <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              Production keys hit the live API. Test keys are for development.
            </p>
          </div>

          <div className="flex gap-3 pt-1">
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
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>
                : 'Create key'
              }
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ── Revoke confirmation modal ─────────────────────────────────
function RevokeConfirmModal({
  keyName,
  onConfirm,
  onCancel,
  isLoading,
}: {
  keyName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
      >
        <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-4">
          <Trash2 className="w-5 h-5 text-red-500" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 text-center mb-2">Revoke API Key?</h2>
        <p className="text-sm text-gray-500 text-center mb-1">
          You are about to revoke <strong className="text-gray-800">{keyName}</strong>.
        </p>
        <p className="text-sm text-gray-500 text-center mb-6">
          Any integrations using this key will immediately stop working. This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 h-11 border border-gray-200 text-gray-600 font-medium
              rounded-xl hover:bg-gray-50 transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 h-11 bg-red-500 hover:bg-red-600 disabled:opacity-50
              text-white font-semibold rounded-xl transition-colors text-sm
              flex items-center justify-center gap-2"
          >
            {isLoading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Revoking...</>
              : 'Yes, revoke'
            }
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Key row ───────────────────────────────────────────────────
function KeyRow({
  apiKey,
  onRevoke,
}: {
  apiKey: any;
  onRevoke: (id: string, name: string) => void;
}) {
  const isTest = apiKey.environment === 'test';

  const lastUsed = apiKey.last_used_at
    ? new Date(apiKey.last_used_at).toLocaleDateString('en-NG', {
        day: 'numeric', month: 'short', year: 'numeric',
      })
    : 'Never';

  const created = new Date(apiKey.created_at).toLocaleDateString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-gray-100 rounded-xl p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow"
    >
      {/* Icon */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
        isTest ? 'bg-blue-50' : 'bg-orange-50'
      }`}>
        <Key className={`w-4.5 h-4.5 ${isTest ? 'text-blue-500' : 'text-orange-500'}`} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="font-semibold text-gray-900 text-sm">{apiKey.name}</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            isTest
              ? 'bg-blue-100 text-blue-700'
              : 'bg-orange-100 text-orange-700'
          }`}>
            {isTest ? 'Test' : 'Production'}
          </span>
        </div>

        {/* Key prefix */}
        <div className="flex items-center gap-1.5 mb-2">
          <code className="text-xs font-mono text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
            {apiKey.key_prefix}••••••••••••••••••••••••
          </code>
          <CopyBtn text={apiKey.key_prefix} size="sm" />
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-4 text-xs text-gray-400 flex-wrap">
          <span className="flex items-center gap-1">
            <Shield className="w-3 h-3" />
            Created {created}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Last used: {lastUsed}
          </span>
          {apiKey.expires_at && (
            <span className="flex items-center gap-1 text-amber-600">
              <AlertTriangle className="w-3 h-3" />
              Expires {new Date(apiKey.expires_at).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      {/* Revoke */}
      <button
        onClick={() => onRevoke(apiKey.id, apiKey.name)}
        className="flex-shrink-0 p-2 rounded-lg text-gray-300 hover:text-red-500
          hover:bg-red-50 transition-colors"
        title="Revoke key"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

// ── Plan gate ─────────────────────────────────────────────────
function PlanGate({ maxKeys, currentCount }: { maxKeys: number | null; currentCount: number }) {
  if (maxKeys === null) return null; // unlimited
  const atLimit = currentCount >= maxKeys;
  if (!atLimit) return null;

  return (
    <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl mb-6">
      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-amber-800">Key limit reached</p>
        <p className="text-xs text-amber-700 mt-0.5">
          Your plan allows up to {maxKeys} active API key{maxKeys === 1 ? '' : 's'}.
          Revoke an existing key or{' '}
          <a href="/developer/dashboard/subscription" className="font-semibold underline">
            upgrade your plan
          </a>{' '}
          to create more.
        </p>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function DeveloperApiKeysPage() {
  const {
    keys, keysLoading, keysError,
    newlyCreatedKey,
    fetchKeys, createKey, revokeKey, clearNewKey,
  } = useDeveloperApiStore();

  const { limits } = useDeveloperPlan();

  const [showCreate,  setShowCreate]  = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; name: string } | null>(null);
  const [creating,    setCreating]    = useState(false);
  const [revoking,    setRevoking]    = useState(false);

  useEffect(() => {
    fetchKeys();
  }, []);

  // ── Handlers ──────────────────────────────────────────────────
  async function handleCreate(name: string, env: DeveloperEnvironment) {
    setCreating(true);
    const result = await createKey(name, env);
    setCreating(false);
    if (result.success) {
      setShowCreate(false);
      // newlyCreatedKey is now set in the store — KeyRevealModal will appear
    } else {
      toast.error(result.error ?? 'Failed to create key.');
    }
  }

  async function handleRevoke() {
    if (!revokeTarget) return;
    setRevoking(true);
    const result = await revokeKey(revokeTarget.id);
    setRevoking(false);
    if (result.success) {
      toast.success(`Key "${revokeTarget.name}" revoked.`);
      setRevokeTarget(null);
    } else {
      toast.error(result.error ?? 'Failed to revoke key.');
    }
  }

  const atLimit   = limits.maxKeysPerPlan !== null && keys.length >= limits.maxKeysPerPlan;
  const canCreate = !atLimit;

  return (
    <>
      <div className="p-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage keys used to authenticate your API requests.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            disabled={!canCreate || keysLoading}
            className="h-10 px-5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50
              disabled:cursor-not-allowed text-white font-semibold rounded-xl
              transition-colors flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            New key
          </button>
        </div>

        {/* Plan gate */}
        <PlanGate maxKeys={limits.maxKeysPerPlan} currentCount={keys.length} />

        {/* Auth header guide */}
        <div className="mb-6 bg-gray-900 rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
            <Terminal className="w-4 h-4 text-orange-400" />
            <span className="text-xs text-gray-400 font-mono">Required header on every request</span>
          </div>
          <div className="px-4 py-3 flex items-center justify-between gap-4">
            <code className="text-xs font-mono text-gray-300">
              Authorization: Bearer <span className="text-orange-400">qaf_dev_live_••••••••••••••••••••</span>
            </code>
          </div>
        </div>

        {/* Error */}
        {keysError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm text-red-700">{keysError}</p>
          </div>
        )}

        {/* Loading */}
        {keysLoading && keys.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
          </div>
        )}

        {/* Empty */}
        {!keysLoading && keys.length === 0 && !keysError && (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Key className="w-7 h-7 text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">No API keys yet</h3>
            <p className="text-sm text-gray-500 mb-5">
              Create your first API key to start integrating with QAFRICA.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="h-10 px-5 bg-orange-500 hover:bg-orange-600 text-white font-semibold
                rounded-xl transition-colors text-sm inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Create first key
            </button>
          </div>
        )}

        {/* Key list */}
        {keys.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Active keys ({keys.length}{limits.maxKeysPerPlan !== null ? ` / ${limits.maxKeysPerPlan}` : ''})
              </p>
            </div>
            <AnimatePresence>
              {keys.map((k) => (
                <KeyRow
                  key={k.id}
                  apiKey={k}
                  onRevoke={(id, name) => setRevokeTarget({ id, name })}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Security best practices */}
        <div className="mt-8 p-5 bg-gray-50 border border-gray-100 rounded-xl">
          <p className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-gray-500" />
            Security best practices
          </p>
          <ul className="space-y-1.5">
            {[
              'Never expose your API key in client-side JavaScript or public repositories.',
              'Store keys in environment variables or a secrets manager (e.g. Vault, AWS Secrets Manager).',
              'Rotate keys regularly and immediately if you suspect a compromise.',
              'Use separate keys for production and test environments.',
            ].map((tip) => (
              <li key={tip} className="text-xs text-gray-500 flex items-start gap-2">
                <Check className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showCreate && (
          <CreateKeyModal
            onClose={() => setShowCreate(false)}
            onSubmit={handleCreate}
            isLoading={creating}
          />
        )}
        {newlyCreatedKey && (
          <KeyRevealModal
            rawKey={newlyCreatedKey.key}
            onClose={() => clearNewKey()}
          />
        )}
        {revokeTarget && (
          <RevokeConfirmModal
            keyName={revokeTarget.name}
            onConfirm={handleRevoke}
            onCancel={() => setRevokeTarget(null)}
            isLoading={revoking}
          />
        )}
      </AnimatePresence>
    </>
  );
}