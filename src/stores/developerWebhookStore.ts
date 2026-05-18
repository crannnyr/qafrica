// FILE: src/stores/developerWebhookStore.ts
import { create } from 'zustand';
import { developerSupabase } from '@/services/developer';
import { toast } from 'sonner';

export type WebhookEvent = 
  | 'order.created' | 'order.confirmed' | 'order.processing' 
  | 'order.shipped' | 'order.out_for_delivery' | 'order.delivered' 
  | 'order.cancelled' | 'order.refunded' 
  | 'product.stock_updated' | 'product.price_updated' | 'product.deactivated';

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_type: WebhookEvent;
  status: 'pending' | 'delivered' | 'failed' | 'retrying';
  http_status?: number;
  response_preview?: string;
  created_at: string;
  attempts: number;
}

export interface Webhook {
  id: string;
  owner_id: string;
  url: string;
  events: WebhookEvent[];
  secret_prefix?: string;
  webhook_secret?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_delivery_at?: string;
  recent_deliveries?: WebhookDelivery[];
}

interface DeveloperWebhookState {
  webhooks: Webhook[];
  loading: boolean;
  
  fetchWebhooks: () => Promise<void>;
  createWebhook: (data: { url: string; events: WebhookEvent[] }) => Promise<{ success: boolean; secret?: string; error?: string }>;
  updateWebhook: (id: string, data: { url?: string; events?: WebhookEvent[] }) => Promise<{ success: boolean; error?: string }>;
  deleteWebhook: (id: string) => Promise<{ success: boolean; error?: string }>;
  testWebhook: (id: string) => Promise<{ success: boolean; statusCode?: number; response?: string; error?: string }>;
}

export const useDeveloperWebhookStore = create<DeveloperWebhookState>((set) => ({
  webhooks: [],
  loading: false,

  fetchWebhooks: async () => {
    set({ loading: true });
    try {
      const { data, error } = await developerSupabase.functions.invoke('developer-webhooks', {
        method: 'GET',
      });

      if (error) throw error;

      if (data?.webhooks) {
        set({ webhooks: data.webhooks, loading: false });
      } else {
        set({ webhooks: [], loading: false });
      }
    } catch (err: any) {
      console.error('Failed to fetch webhooks:', err);
      toast.error('Failed to load webhooks');
      set({ loading: false });
    }
  },

  createWebhook: async (input) => {
    try {
      const { data, error } = await developerSupabase.functions.invoke('developer-webhooks', {
        method: 'POST',
        body: input,
      });

      if (error) throw error;

      if (data?.webhook) {
        set(state => ({
          webhooks: [data.webhook, ...state.webhooks]
        }));
        
        return { success: true, secret: data.webhook_secret };
      }
      
      return { success: false, error: 'Invalid response' };
    } catch (err: any) {
      console.error('Failed to create webhook:', err);
      return { success: false, error: err?.message || 'Failed to create webhook' };
    }
  },

  updateWebhook: async (id, input) => {
    try {
      const { data, error } = await developerSupabase.functions.invoke(`developer-webhooks/${id}`, {
        method: 'PATCH',
        body: input,
      });

      if (error) throw error;

      if (data?.webhook) {
        set(state => ({
          webhooks: state.webhooks.map(w => 
            w.id === id ? { ...w, ...data.webhook } : w
          )
        }));
        return { success: true };
      }
      
      return { success: false, error: 'Invalid response' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to update webhook' };
    }
  },

  deleteWebhook: async (id) => {
    try {
      const { error } = await developerSupabase.functions.invoke(`developer-webhooks/${id}`, {
        method: 'DELETE',
      });

      if (error) throw error;

      set(state => ({
        webhooks: state.webhooks.filter(w => w.id !== id)
      }));
      
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to delete webhook' };
    }
  },

  testWebhook: async (id) => {
    try {
      const { data, error } = await developerSupabase.functions.invoke(`developer-webhooks/${id}/test`, {
        method: 'POST',
      });

      if (error) throw error;

      return { 
        success: true, 
        statusCode: data?.status_code,
        response: data?.response_body 
      };
    } catch (err: any) {
      return { 
        success: false, 
        error: err?.message || 'Test delivery failed' 
      };
    }
  },
}));

export default useDeveloperWebhookStore;