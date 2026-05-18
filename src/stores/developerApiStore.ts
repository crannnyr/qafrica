// src/stores/developerApiStore.ts
import { create } from 'zustand';
import {
  developerKeyService,
  developerWebhookService,
} from '@/services/developer';
import type {
  DeveloperApiKey,
  DeveloperApiKeyCreated,
  DeveloperWebhookConfig,
  DeveloperWebhookDelivery,
  DeveloperApiLog,
  WebhookEvent,
  PaginatedResponse,
  DeveloperEnvironment,
} from '@/types/developer';

// ── State shape ───────────────────────────────────────────────
interface DeveloperApiState {
  // ── API Keys ─────────────────────────────────────────────────
  keys:            Omit<DeveloperApiKey, 'key_hash'>[];
  keysLoading:     boolean;
  keysError:       string | null;
  // The newly-created key (with raw value) — cleared after user copies it
  newlyCreatedKey: DeveloperApiKeyCreated | null;

  // ── Webhooks ─────────────────────────────────────────────────
  webhooks:        DeveloperWebhookConfig[];
  webhooksLoading: boolean;
  webhooksError:   string | null;
  // The signing secret — only available right after registration
  newlyCreatedWebhookSecret: string | null;

  // ── Webhook deliveries (log viewer) ──────────────────────────
  deliveries:         DeveloperWebhookDelivery[];
  deliveriesPage:     number;
  deliveriesTotal:    number;
  deliveriesLoading:  boolean;

  // ── API request logs ──────────────────────────────────────────
  logs:         DeveloperApiLog[];
  logsPage:     number;
  logsTotal:    number;
  logsLoading:  boolean;

  // ── Shared ───────────────────────────────────────────────────
  error: string | null;

  // ── Actions: Keys ────────────────────────────────────────────
  fetchKeys:    () => Promise<void>;
  createKey:    (name: string, environment: DeveloperEnvironment) => Promise<{ success: boolean; error?: string }>;
  revokeKey:    (keyId: string) => Promise<{ success: boolean; error?: string }>;
  clearNewKey:  () => void;

  // ── Actions: Webhooks ────────────────────────────────────────
  fetchWebhooks:         () => Promise<void>;
  registerWebhook:       (url: string, events: WebhookEvent[]) => Promise<{ success: boolean; error?: string }>;
  deleteWebhook:         (webhookId: string) => Promise<{ success: boolean; error?: string }>;
  testWebhook:           (webhookId: string) => Promise<{ success: boolean; delivered: boolean; message: string; error?: string }>;
  clearNewWebhookSecret: () => void;

  // ── Actions: Deliveries ───────────────────────────────────────
  fetchDeliveries: (page?: number) => Promise<void>;

  // ── Actions: Logs (assembled from developerSupabase direct query) ─
  setLogs:    (logs: DeveloperApiLog[], total: number, page: number) => void;
  setLogsLoading: (loading: boolean) => void;

  // ── Utils ────────────────────────────────────────────────────
  clearError: () => void;
  reset:      () => void;
}

// ── Store ─────────────────────────────────────────────────────
export const useDeveloperApiStore = create<DeveloperApiState>()((set, get) => ({
  // ── Initial state ─────────────────────────────────────────────
  keys:                    [],
  keysLoading:             false,
  keysError:               null,
  newlyCreatedKey:         null,

  webhooks:                [],
  webhooksLoading:         false,
  webhooksError:           null,
  newlyCreatedWebhookSecret: null,

  deliveries:              [],
  deliveriesPage:          1,
  deliveriesTotal:         0,
  deliveriesLoading:       false,

  logs:                    [],
  logsPage:                1,
  logsTotal:               0,
  logsLoading:             false,

  error:                   null,

  // ════════════════════════════════════════════════════════════
  // API KEYS
  // ════════════════════════════════════════════════════════════

  fetchKeys: async () => {
    set({ keysLoading: true, keysError: null });
    try {
      const result = await developerKeyService.listKeys();
      set({ keys: result.data ?? [], keysLoading: false });
    } catch (err: any) {
      const message = err?.message ?? 'Failed to load API keys.';
      set({ keysLoading: false, keysError: message });
    }
  },

  createKey: async (name, environment) => {
    set({ keysLoading: true, keysError: null });
    try {
      const newKey = await developerKeyService.createKey(name, environment);

      // Add to list WITHOUT the raw key (strip it from the list entry)
      const { key: _rawKey, warning: _warning, ...safeKey } = newKey;

      set((state) => ({
        keys:            [safeKey as Omit<DeveloperApiKey, 'key_hash'>, ...state.keys],
        newlyCreatedKey: newKey,   // full object with raw key for the reveal modal
        keysLoading:     false,
      }));

      return { success: true };
    } catch (err: any) {
      const message = err?.message ?? 'Failed to create API key.';
      set({ keysLoading: false, keysError: message });
      return { success: false, error: message };
    }
  },

  revokeKey: async (keyId) => {
    // Optimistic update — remove from list immediately
    const previous = get().keys;
    set((state) => ({
      keys: state.keys.filter((k) => k.id !== keyId),
    }));

    try {
      await developerKeyService.revokeKey(keyId);
      return { success: true };
    } catch (err: any) {
      // Rollback on failure
      set({ keys: previous });
      const message = err?.message ?? 'Failed to revoke API key.';
      set({ keysError: message });
      return { success: false, error: message };
    }
  },

  clearNewKey: () => set({ newlyCreatedKey: null }),

  // ════════════════════════════════════════════════════════════
  // WEBHOOKS
  // ════════════════════════════════════════════════════════════

  fetchWebhooks: async () => {
    set({ webhooksLoading: true, webhooksError: null });
    try {
      const result = await developerWebhookService.listWebhooks();
      set({ webhooks: result.data ?? [], webhooksLoading: false });
    } catch (err: any) {
      const message = err?.message ?? 'Failed to load webhooks.';
      set({ webhooksLoading: false, webhooksError: message });
    }
  },

  registerWebhook: async (url, events) => {
    set({ webhooksLoading: true, webhooksError: null });
    try {
      const result = await developerWebhookService.registerWebhook({ url, events });

      // Extract the signing secret before adding to list
      const { signing_secret, warning: _warning, ...webhookConfig } = result;

      set((state) => ({
        webhooks:                [webhookConfig as DeveloperWebhookConfig, ...state.webhooks],
        newlyCreatedWebhookSecret: signing_secret,
        webhooksLoading:         false,
      }));

      return { success: true };
    } catch (err: any) {
      const message = err?.message ?? 'Failed to register webhook.';
      set({ webhooksLoading: false, webhooksError: message });
      return { success: false, error: message };
    }
  },

  deleteWebhook: async (webhookId) => {
    // Optimistic
    const previous = get().webhooks;
    set((state) => ({
      webhooks: state.webhooks.filter((w) => w.id !== webhookId),
    }));

    try {
      await developerWebhookService.deleteWebhook(webhookId);
      return { success: true };
    } catch (err: any) {
      set({ webhooks: previous });
      const message = err?.message ?? 'Failed to delete webhook.';
      set({ webhooksError: message });
      return { success: false, error: message };
    }
  },

  testWebhook: async (webhookId) => {
    try {
      const result = await developerWebhookService.testWebhook(webhookId);
      return {
        success:   true,
        delivered: result.delivered,
        message:   result.message,
      };
    } catch (err: any) {
      const message = err?.message ?? 'Test delivery failed.';
      return { success: false, delivered: false, message, error: message };
    }
  },

  clearNewWebhookSecret: () => set({ newlyCreatedWebhookSecret: null }),

  // ════════════════════════════════════════════════════════════
  // WEBHOOK DELIVERIES (log viewer)
  // ════════════════════════════════════════════════════════════

  fetchDeliveries: async (page = 1) => {
    set({ deliveriesLoading: true });
    try {
      const result = await developerWebhookService.getDeliveries(page, 20);
      set({
        deliveries:        result.data,
        deliveriesPage:    result.meta.page,
        deliveriesTotal:   result.meta.total,
        deliveriesLoading: false,
      });
    } catch (err: any) {
      console.error('[DeveloperApiStore] fetchDeliveries error:', err);
      set({ deliveriesLoading: false });
    }
  },

  // ════════════════════════════════════════════════════════════
  // LOGS (set externally by the page component which queries Supabase directly)
  // ════════════════════════════════════════════════════════════

  setLogs: (logs, total, page) =>
    set({ logs, logsTotal: total, logsPage: page }),

  setLogsLoading: (loading) => set({ logsLoading: loading }),

  // ── Utils ────────────────────────────────────────────────────
  clearError: () => set({ error: null, keysError: null, webhooksError: null }),

  reset: () =>
    set({
      keys:                    [],
      keysLoading:             false,
      keysError:               null,
      newlyCreatedKey:         null,
      webhooks:                [],
      webhooksLoading:         false,
      webhooksError:           null,
      newlyCreatedWebhookSecret: null,
      deliveries:              [],
      deliveriesPage:          1,
      deliveriesTotal:         0,
      deliveriesLoading:       false,
      logs:                    [],
      logsPage:                1,
      logsTotal:               0,
      logsLoading:             false,
      error:                   null,
    }),
}));

export default useDeveloperApiStore;