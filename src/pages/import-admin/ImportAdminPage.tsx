// src/pages/import-admin/ImportAdminPage.tsx 
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag, LogOut, Package, Search, RefreshCw,
  Plus, Trash2, Edit2, Check, ChevronDown, ChevronUp,
  Upload, Loader, TrendingUp, AlertCircle, ExternalLink, X,
  Info, CheckCircle2, Send,
} from 'lucide-react'; 
import { compressImage } from '@/lib/imageCompression';
import { toast } from 'sonner';
import CONFIG from '@/lib/config';
import { useImportPwaManifest } from '@/hooks/useImportPwaManifest';
import { useImportAdminPermissions } from '@/hooks/useImportAdminPermissions';
import ImportAdminAnalytics from './ImportAdminAnalytics';
import ImportAdminCustomers from './ImportAdminCustomers';
import { CustomerDetail } from './ImportAdminCustomers';
import QuestionsManager from './QuestionsManager';
import TotalOrdersView from './TotalOrdersView';

import TrendingManager from './TrendingManager';
import ConfirmedPaymentsManager from './ConfirmedPaymentsManager';
import ConfirmedOrderMessagingManager from './ConfirmedOrderMessagingManager';
import BroadcastEmailManager from './BroadcastEmailManager';
import RefundsManager from './RefundsManager';
import AdminOrderReceiptSheet from './AdminOrderReceiptSheet';
import PaystackTransactions from './PaystackTransactions';
import CategoryManager from './CategoryManager';
import AiSupportInbox, { AiSupportAlertMonitor } from './AiSupportInbox';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import`;
const IMPORT_ADMIN_ORDERS_EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/import-admin-orders`;
const CUSTOM_ORDERS_EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/custom-orders`;

// ── Types ─────────────────────────────────────────────────────────────────────
interface ImportOrder {
  id: string;
  code: string;
  customer_name: string;
  customer_whatsapp: string;
  customer_email?: string | null;
  items: Array<{
    id: string;
    name: string;
    price_ngn: number;
    price_cny: number;
    quantity: number;
    image_url: string;
    variant_options?: Record<string, string>;
    shipping_method?: 'flight' | 'sea_freight';
  }>;
  delivery_type: 'to_qafrica' | 'to_me';
  shipping_method?: 'flight' | 'sea_freight' | null;
  delivery_address?: {
    name: string; phone: string; address_line1: string; address_line2: string;
    city: string; state: string; landmark: string;
  } | null;
  delivery_latitude?: number | null;
  delivery_longitude?: number | null;
  location_shared?: boolean;
  subtotal_ngn: number;
  jumia_fee_ngn: number;
  shipping_ngn: number | null;
  total_ngn: number;
  status: 'pending' | 'confirmed' | 'billed' | 'to_review' | 'cancelled' | 'refunded';
  payment_status: 'unpaid' | 'awaiting_confirmation' | 'paid' | 'failed';
  payment_method: 'paystack' | 'manual' | null;
  manual_sender_name?: string | null;
  manual_sender_bank?: string | null;
  admin_note: string | null;
  created_at: string;
  user_id: string | null;
  staged_at: string | null;
}

interface VariantGroup {
  id: string;
  name: string;
  options: string[];
  price_deltas?: Record<string, number>;
}

interface ImportProduct {
  id: string;
  name: string;
  description: string;
  image_url: string;
  image_urls: string[];
  price_cny: number;
  price_cny_original: number;
  price_ngn: number;
  price_usd?: number;
  cost_ngn?: number;
  price_input_currency?: 'cny' | 'usd' | 'ngn';
  price_input_amount?: number;
  category: string;
  is_active: boolean;
  sort_order: number;
  moq?: number;
  has_variants?: boolean;
  variants?: VariantGroup[];
  units_sold?: number;
  /** Admin-only 1688 sourcing link. Never returned by the public products endpoint. */
  source_url?: string | null;
  ship_only?: boolean;
  category_id?: string | null;
  subcategory_id?: string | null;
  parent_category?: string | null;
  volume_cbm?: number | null;
  weight_grams?: number | null;
  sea_shipping_cost_ngn?: number | null;
  flight_shipping_cost_ngn?: number | null;
  original_price_usd?: number | null;
  usd_to_ngn_rate?: number | null;
  markup_percent?: number | null;
  markup_amount_ngn?: number | null;
}

// Quick-add presets for the variant builder
const PRESET_COLORS = ['Black', 'White', 'Red', 'Blue', 'Green', 'Yellow', 'Grey', 'Pink', 'Purple', 'Orange', 'Brown', 'Beige'];
const PRESET_SIZES = [
  'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'One Size',
  '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46',
];

function genId() {
  return Math.random().toString(36).slice(2, 10);
}



interface Rates {
  cnyToNgn: number;
  usdToNgn: number;
  cnyToUsd: number;
}

interface ProductCategory {
  id: string;
  niche_id: string;
  name: string;
  sort_order: number;
  subcategories: Array<{
    id: string;
    category_id: string;
    niche_id: string;
    name: string;
    sort_order: number;
    markup_percent: number;
  }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number | null) {
  if (n === null || n === undefined) return '—';
  return `₦${Math.round(n).toLocaleString()}`;
}
function fmtCny(n: number) { return `¥${n.toFixed(2)}`; }
function fmtUsd(n: number) { return `$${n.toFixed(2)}`; }

function timeSince(d: string) {
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// Prefers precise GPS coords when the customer shared them; falls back to a
// text search built from the manually entered address.
function googleMapsLink(order: Pick<ImportOrder, 'delivery_latitude' | 'delivery_longitude' | 'delivery_address'>) {
  if (order.delivery_latitude != null && order.delivery_longitude != null) {
    return `https://www.google.com/maps/search/?api=1&query=${order.delivery_latitude},${order.delivery_longitude}`;
  }
  const a = order.delivery_address;
  if (!a) return null;
  const parts = [a.address_line1, a.address_line2, a.landmark, a.city, a.state].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts)}`;
}

const SHIPPING_METHOD_LABELS: Record<string, string> = {
  flight: 'Flight', sea_freight: 'Sea freight',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  billed: 'Billed — fee due',
  to_review: 'To Review',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  confirmed: 'bg-sky-50 text-sky-700',
  billed: 'bg-rose-50 text-rose-700',
  to_review: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-gray-100 text-gray-500',
  refunded: 'bg-blue-50 text-blue-700',
};

// Simplified pipeline: pending -> confirmed -> billed -> to_review. Folded
// from the old 7-stage pipeline (shipping_quoted/order_placed -> confirmed;
// awaiting_shipment -> billed; shipped/delivered -> to_review) via an
// expand -> migrate -> contract DB migration.
const STATUS_FLOW = ['pending', 'confirmed', 'billed', 'to_review'];

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: 'Unpaid',
  awaiting_confirmation: 'Awaiting confirmation',
  paid: 'Paid',
  failed: 'Failed',
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  unpaid: 'bg-gray-100 text-gray-500',
  awaiting_confirmation: 'bg-amber-50 text-amber-700',
  paid: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-red-50 text-red-600',
};

// ── Auth guard ────────────────────────────────────────────────────────────────
function useImportAuth() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [session, setSession] = useState<{
    token: string;
    manager: { email: string; full_name?: string | null } | null;
  }>({ token: '', manager: null });

  useEffect(() => {
    let cancelled = false;

    const checkAuth = () => {
      const token = sessionStorage.getItem('import_manager_token');
      const managerRaw = sessionStorage.getItem('import_manager');

      if (!token || !managerRaw) {
        if (!cancelled) {
          setAuthChecked(true);
          navigate('/importations/admin/login');
        }
        return;
      }

      try {
        const manager = JSON.parse(managerRaw);
        if (!manager || typeof manager.email !== 'string' || !manager.email.toLowerCase().endsWith('@qafrica.store')) {
          sessionStorage.removeItem('import_manager_token');
          sessionStorage.removeItem('import_manager');
          sessionStorage.removeItem('import_manager_source');
          if (!cancelled) {
            setAuthChecked(true);
            navigate('/importations/admin/login');
          }
          return;
        }

        if (!cancelled) {
          setSession({ token, manager });
          setAuthChecked(true);
        }
      } catch {
        sessionStorage.removeItem('import_manager_token');
        sessionStorage.removeItem('import_manager');
        sessionStorage.removeItem('import_manager_source');
        if (!cancelled) {
          setAuthChecked(true);
          navigate('/importations/admin/login');
        }
      }
    };

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const logout = async () => {
    const token = session.token || sessionStorage.getItem('import_manager_token');

    if (token) {
      fetch(CONFIG.SUPABASE_URL + '/functions/v1/china-import?action=admin-logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token }),
      }).catch(() => {});
    }

    sessionStorage.removeItem('import_manager_token');
    sessionStorage.removeItem('import_manager');
    sessionStorage.removeItem('import_manager_source');

    navigate('/importations/admin/login');
  };

  return {
    token: session.token || null,
    manager: session.manager,
    isLegacyManager: Boolean(session.token && session.manager),
    isSupabaseAdmin: false,
    authChecked,
    logout,
  };
}

// ── Divider ───────────────────────────────────────────────────────────────────
function ImportAdminAccessManager({ token, canManage }: { token: string; canManage: boolean }) {
  type Permission = {
    id: string;
    key: string;
    name: string;
    section: string;
    action: string;
    description: string | null;
  };
  type Role = {
    id: string;
    key: string;
    name: string;
    description: string | null;
    is_system: boolean;
    permission_ids?: string[];
  };
  type Manager = {
    id: string;
    email: string;
    full_name: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    roles: Role[];
    permissions: Permission[];
    denied_permission_ids: string[];
  };

  const [managers, setManagers] = useState<Manager[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRoleIds, setNewRoleIds] = useState<string[]>([]);
  const [newPermissionIds, setNewPermissionIds] = useState<string[]>([]);
  const [editingManagerId, setEditingManagerId] = useState<string | null>(null);
  const [editingPermissionIds, setEditingPermissionIds] = useState<string[]>([]);
  const [resetManagerId, setResetManagerId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${EDGE_URL}?action=admin-list-managers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not load Import Managers');
      setManagers(data.managers ?? []);
      setRoles(data.roles ?? []);
      setPermissions(data.permissions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load Import Managers');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const rolePermissionIds = (roleIds: string[]) => {
    const ids = new Set<string>();
    for (const role of roles) {
      if (roleIds.includes(role.id)) {
        for (const permissionId of role.permission_ids ?? []) ids.add(permissionId);
      }
    }
    return Array.from(ids);
  };

  const toggleNewRole = (roleId: string, checked: boolean) => {
    const nextRoleIds = checked
      ? Array.from(new Set([...newRoleIds, roleId]))
      : newRoleIds.filter(id => id !== roleId);

    const nextRolePermissionIds = rolePermissionIds(nextRoleIds);
    setNewRoleIds(nextRoleIds);
    setNewPermissionIds(current => current.filter(id => nextRolePermissionIds.includes(id)).concat(
      nextRolePermissionIds.filter(id => !current.includes(id))
    ));
  };

  const assignRole = async (managerId: string, roleId: string) => {
    if (!roleId || !canManage) return;
    const key = `assign:${managerId}:${roleId}`;
    setActing(key);
    setError('');
    try {
      const res = await fetch(`${EDGE_URL}?action=admin-assign-manager-role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, manager_id: managerId, role_id: roleId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not assign role');
      setManagers(current => current.map(manager => {
        if (manager.id !== managerId) return manager;
        const role = roles.find(item => item.id === roleId);
        if (!role) return manager;
        const nextRoles = [...manager.roles, { ...role, permission_ids: role.permission_ids ?? [] }];
        const permissionIds = rolePermissionIds(nextRoles.map(item => item.id));
        const denied = new Set(manager.denied_permission_ids ?? []);
        return {
          ...manager,
          roles: nextRoles,
          permissions: permissions.filter(permission => permissionIds.includes(permission.id) && !denied.has(permission.id)),
        };
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not assign role');
    } finally {
      setActing(null);
    }
  };

  const removeRole = async (managerId: string, roleId: string) => {
    if (!canManage) return;
    const key = `remove:${managerId}:${roleId}`;
    setActing(key);
    setError('');
    try {
      const res = await fetch(`${EDGE_URL}?action=admin-remove-manager-role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, manager_id: managerId, role_id: roleId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not remove role');
      setManagers(current => current.map(manager => {
        if (manager.id !== managerId) return manager;
        const nextRoles = manager.roles.filter(role => role.id !== roleId);
        const permissionIds = rolePermissionIds(nextRoles.map(item => item.id));
        const denied = new Set(manager.denied_permission_ids ?? []);
        return {
          ...manager,
          roles: nextRoles,
          permissions: permissions.filter(permission => permissionIds.includes(permission.id) && !denied.has(permission.id)),
          denied_permission_ids: (manager.denied_permission_ids ?? []).filter(id => permissionIds.includes(id)),
        };
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove role');
    } finally {
      setActing(null);
    }
  };

  const startEditingPermissions = (manager: Manager) => {
    const roleIds = manager.roles.map(role => role.id);
    const inherited = rolePermissionIds(roleIds);
    const denied = new Set(manager.denied_permission_ids ?? []);
    setEditingManagerId(manager.id);
    setEditingPermissionIds(inherited.filter(id => !denied.has(id)));
  };

  const savePermissions = async (managerId: string) => {
    if (!canManage) return;
    setActing(`permissions:${managerId}`);
    setError('');
    try {
      const res = await fetch(`${EDGE_URL}?action=admin-update-manager-permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager_token: token,
          manager_id: managerId,
          permission_ids: editingPermissionIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not save permissions');
      setManagers(current => current.map(manager => {
        if (manager.id !== managerId) return manager;
        const inherited = rolePermissionIds(manager.roles.map(role => role.id));
        const selected = new Set(editingPermissionIds);
        return {
          ...manager,
          permissions: permissions.filter(permission => inherited.includes(permission.id) && selected.has(permission.id)),
          denied_permission_ids: inherited.filter(id => !selected.has(id)),
        };
      }));
      setEditingManagerId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save permissions');
    } finally {
      setActing(null);
    }
  };

  const updateManagerStatus = async (manager: Manager, isActive: boolean) => {
    if (!canManage) return;
    if (manager.email === 'import@qafrica.store' && !isActive) {
      setError('The primary import@qafrica.store Super Admin account cannot be deactivated here.');
      return;
    }
    setActing(`status:${manager.id}`);
    setError('');
    try {
      const res = await fetch(`${EDGE_URL}?action=admin-set-manager-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager_token: token,
          manager_id: manager.id,
          is_active: isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not update admin status');
      setManagers(current => current.map(item => item.id === manager.id ? { ...item, is_active: isActive } : item));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update admin status');
    } finally {
      setActing(null);
    }
  };

  const deleteManager = async (manager: Manager) => {
    if (!canManage) return;
    if (manager.email === 'import@qafrica.store') {
      setError('The primary import@qafrica.store Super Admin account cannot be deleted here.');
      return;
    }
    const confirmed = window.confirm(`Delete ${manager.email}? This permanently removes the Import Manager account, roles, permissions, and password.\n\nUse Deactivate instead if you may need the account later.`);
    if (!confirmed) return;

    setActing(`delete:${manager.id}`);
    setError('');
    try {
      const res = await fetch(`${EDGE_URL}?action=admin-delete-manager`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, manager_id: manager.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not delete Import Manager');
      if (editingManagerId === manager.id) setEditingManagerId(null);
      setManagers(current => current.filter(item => item.id !== manager.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete Import Manager');
    } finally {
      setActing(null);
    }
  };

  const resetManagerPassword = async (managerId: string) => {
    if (!canManage || resetPassword.length < 8) return;
    setActing(`password:${managerId}`);
    setError('');
    try {
      const res = await fetch(`${EDGE_URL}?action=admin-reset-manager-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, manager_id: managerId, password: resetPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not reset password');
      setResetManagerId(null);
      setResetPassword('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reset password');
    } finally {
      setActing(null);
    }
  };

  const createManager = async () => {
    if (!canManage || newRoleIds.length === 0 || newPermissionIds.length === 0) return;
    setActing('create');
    setError('');
    try {
      const res = await fetch(`${EDGE_URL}?action=admin-create-manager`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager_token: token,
          email: newEmail,
          full_name: newName,
          role_ids: newRoleIds,
          password: newPassword,
          permission_ids: newPermissionIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not add Import Manager');
      setNewEmail('');
      setNewName('');
      setNewPassword('');
      setNewRoleIds([]);
      setNewPermissionIds([]);
      const selectedRoles = roles
        .filter(role => newRoleIds.includes(role.id))
        .map(role => ({ ...role, permission_ids: role.permission_ids ?? [] }));
      const selected = new Set(newPermissionIds);
      const inherited = rolePermissionIds(newRoleIds);
      const createdManager: Manager = {
        ...data.manager,
        roles: selectedRoles,
        permissions: permissions.filter(permission => inherited.includes(permission.id) && selected.has(permission.id)),
        denied_permission_ids: inherited.filter(id => !selected.has(id)),
      };
      setManagers(current => [...current, createdManager]);
      setShowAddForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add Import Manager');
    } finally {
      setActing(null);
    }
  };

  if (loading) {
    return <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-sm text-gray-400">Loading Import Managers…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-bold text-gray-900 text-sm">Admin Access</p>
            <p className="text-[11px] text-gray-400 mt-1">
              Assign one or more roles. Permissions come from the selected roles, and individual permissions can be removed for that admin.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canManage && (
              <button
                onClick={() => setShowAddForm(v => !v)}
                className="flex items-center gap-1.5 text-xs font-semibold bg-gray-900 text-white hover:bg-gray-700 px-3 py-2 rounded-lg"
              >
                <Plus className="w-3.5 h-3.5" />
                {showAddForm ? 'Close' : 'Add Admin'}
              </button>
            )}
            <button
              onClick={() => void load()}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>
        </div>

        {!canManage && (
          <div className="mt-3 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-[11px] text-amber-700">
            You can view manager access, but you do not have permission to change roles or permissions.
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-[11px] text-red-600">
            {error}
          </div>
        )}

        {canManage && showAddForm && (
          <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
            <p className="text-xs font-bold text-gray-900">Add Import Manager</p>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Full name"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs bg-white"
            />
            <input
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder="name@qafrica.store"
              type="email"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs bg-white"
            />
            <input
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Temporary password (minimum 8 characters)"
              type="password"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs bg-white"
            />

            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="text-[10px] font-bold text-gray-500 mb-2">Roles</p>
              <div className="space-y-2">
                {roles.map(role => (
                  <label key={role.id} className="flex items-start gap-2 text-[11px] text-gray-700">
                    <input
                      type="checkbox"
                      checked={newRoleIds.includes(role.id)}
                      onChange={e => toggleNewRole(role.id, e.target.checked)}
                    />
                    <span>
                      <b>{role.name}</b>
                      {role.description && <span className="block text-[10px] text-gray-400">{role.description}</span>}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="text-[10px] font-bold text-gray-500 mb-2">
                Permissions from selected roles
              </p>
              {newRoleIds.length === 0 ? (
                <p className="text-[10px] text-gray-400">Select at least one role first.</p>
              ) : (
                <div className="max-h-56 overflow-y-auto space-y-1.5">
                  {permissions
                    .filter(permission => rolePermissionIds(newRoleIds).includes(permission.id))
                    .map(permission => (
                      <label key={permission.id} className="flex items-start gap-2 text-[10px] text-gray-600">
                        <input
                          type="checkbox"
                          checked={newPermissionIds.includes(permission.id)}
                          onChange={e => setNewPermissionIds(ids =>
                            e.target.checked
                              ? Array.from(new Set([...ids, permission.id]))
                              : ids.filter(id => id !== permission.id)
                          )}
                        />
                        <span>
                          <b>{permission.name}</b>
                          <span className="text-gray-400"> — {permission.key}</span>
                        </span>
                      </label>
                    ))}
                </div>
              )}
              <p className="text-[10px] text-gray-400 mt-2">
                Checked permissions are allowed. Unchecked permissions are explicitly removed even when a selected role provides them.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void createManager()}
              disabled={
                acting === 'create' ||
                !newName.trim() ||
                !newEmail.trim() ||
                newPassword.length < 8 ||
                newRoleIds.length === 0 ||
                newPermissionIds.length === 0
              }
              className="w-full py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-xs font-bold"
            >
              {acting === 'create' ? 'Adding…' : 'Add Admin'}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {managers.map(manager => {
          const isEditing = editingManagerId === manager.id;
          const inheritedIds = rolePermissionIds(manager.roles.map(role => role.id));
          const inheritedSet = new Set(inheritedIds);

          return (
            <div key={manager.id} className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-gray-900 text-sm">{manager.full_name || 'Unnamed manager'}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{manager.email}</p>
                </div>
                <span className={`text-[9px] font-bold px-2 py-1 rounded-full ${manager.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                  {manager.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="mt-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Roles</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {manager.roles.map(role => (
                    <span key={role.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-50 border border-gray-100 text-[10px] text-gray-600">
                      {role.name}
                      {canManage && manager.roles.length > 1 && (
                        <button
                          type="button"
                          onClick={() => void removeRole(manager.id, role.id)}
                          disabled={acting === `remove:${manager.id}:${role.id}`}
                          className="text-gray-400 hover:text-red-500 disabled:opacity-40"
                          title="Remove role"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </span>
                  ))}
                  {manager.roles.length === 0 && <span className="text-[10px] text-red-500">No role assigned</span>}
                </div>

                {canManage && (
                  <div className="mt-2">
                    <select
                      defaultValue=""
                      onChange={e => {
                        const roleId = e.target.value;
                        e.target.value = '';
                        if (roleId) void assignRole(manager.id, roleId);
                      }}
                      className="w-full px-2.5 py-2 rounded-lg border border-gray-200 text-[10px] bg-white"
                    >
                      <option value="">Add another role…</option>
                      {roles.filter(role => !manager.roles.some(existing => existing.id === role.id)).map(role => (
                        <option key={role.id} value={role.id}>{role.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                    Effective permissions ({manager.permissions?.length ?? 0})
                  </p>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => isEditing ? setEditingManagerId(null) : startEditingPermissions(manager)}
                      className="text-[10px] font-semibold text-gray-600 hover:text-gray-900"
                    >
                      {isEditing ? 'Cancel' : 'Edit permissions'}
                    </button>
                  )}
                </div>

                {!isEditing ? (
                  <>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {(manager.permissions ?? []).map(permission => (
                        <span key={permission.id} className="px-2 py-1 rounded-md bg-white border border-gray-100 text-[9px] text-gray-600">
                          {permission.name}
                        </span>
                      ))}
                    </div>
                    {(manager.denied_permission_ids?.length ?? 0) > 0 && (
                      <p className="text-[10px] text-amber-600 mt-2">
                        {manager.denied_permission_ids.length} role permission{manager.denied_permission_ids.length === 1 ? '' : 's'} explicitly removed.
                      </p>
                    )}
                  </>
                ) : (
                  <div className="mt-2">
                    <div className="max-h-64 overflow-y-auto space-y-1.5">
                      {permissions
                        .filter(permission => inheritedSet.has(permission.id))
                        .map(permission => (
                          <label key={permission.id} className="flex items-start gap-2 text-[10px] text-gray-600">
                            <input
                              type="checkbox"
                              checked={editingPermissionIds.includes(permission.id)}
                              onChange={e => setEditingPermissionIds(ids =>
                                e.target.checked
                                  ? Array.from(new Set([...ids, permission.id]))
                                  : ids.filter(id => id !== permission.id)
                              )}
                            />
                            <span>
                              <b>{permission.name}</b>
                              <span className="text-gray-400"> — {permission.key}</span>
                            </span>
                          </label>
                        ))}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2">
                      Uncheck a permission to deny it for this admin. The denial stays in place even if another selected role also provides that permission.
                    </p>
                    <button
                      type="button"
                      onClick={() => void savePermissions(manager.id)}
                      disabled={acting === `permissions:${manager.id}`}
                      className="mt-3 px-3 py-2 rounded-lg bg-gray-900 text-white text-[10px] font-bold disabled:opacity-40"
                    >
                      {acting === `permissions:${manager.id}` ? 'Saving…' : 'Save permissions'}
                    </button>
                  </div>
                )}
              </div>

              {canManage && (
                <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-3">
                  <button
                    type="button"
                    onClick={() => void updateManagerStatus(manager, !manager.is_active)}
                    disabled={acting === `status:${manager.id}`}
                    className={`text-[10px] font-semibold disabled:opacity-40 ${manager.is_active ? 'text-amber-600 hover:text-amber-800' : 'text-emerald-600 hover:text-emerald-800'}`}
                  >
                    {acting === `status:${manager.id}`
                      ? 'Updating…'
                      : manager.is_active ? 'Deactivate admin' : 'Reactivate admin'}
                  </button>
                  {manager.email !== 'import@qafrica.store' && (
                    <button
                      type="button"
                      onClick={() => void deleteManager(manager)}
                      disabled={acting === `delete:${manager.id}`}
                      className="text-[10px] font-semibold text-red-600 hover:text-red-800 disabled:opacity-40"
                    >
                      {acting === `delete:${manager.id}` ? 'Deleting…' : 'Delete admin'}
                    </button>
                  )}
                </div>
              )}

              {canManage && (
                <div className="mt-3">
                  {resetManagerId === manager.id ? (
                    <div className="flex gap-2">
                      <input
                        value={resetPassword}
                        onChange={e => setResetPassword(e.target.value)}
                        type="password"
                        placeholder="New password (8+ characters)"
                        className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-xs bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => void resetManagerPassword(manager.id)}
                        disabled={acting === `password:${manager.id}` || resetPassword.length < 8}
                        className="px-3 py-2 rounded-lg bg-gray-900 text-white text-[10px] font-bold disabled:opacity-40"
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        onClick={() => { setResetManagerId(null); setResetPassword(''); }}
                        className="px-3 py-2 rounded-lg border border-gray-200 text-[10px] font-semibold"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setResetManagerId(manager.id); setResetPassword(''); }}
                      className="text-[10px] font-semibold text-gray-500 hover:text-gray-900"
                    >
                      Reset password
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-[11px] text-blue-700">
        <p className="font-bold mb-1">Legacy manager authentication</p>
        <p>
          Import Admin login is handled by the legacy manager session. This screen does not use Supabase Auth users or the old platform-admin role assignments.
        </p>
      </div>
    </div>
  );
}
function Divider() {
  return <div className="h-px bg-gray-100 my-1" />;
}

// ── Field label ───────────────────────────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
      {children}
    </p>
  );
}

// ── Load Code Panel ───────────────────────────────────────────────────────────
function LoadCodePanel({ token }: { token: string }) {
  const [code, setCode]           = useState('');
  const [order, setOrder]         = useState<ImportOrder | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState('');
  const [shipping, setShipping]   = useState('');
  const [note, setNote]           = useState('');
  const [statusDraft, setStatusDraft] = useState('');
  const [isSaving, setIsSaving]   = useState(false);
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
  const [rates, setRates]         = useState<Rates | null>(null);
  const [expanded, setExpanded]   = useState(false);
  const [showPackingSlip, setShowPackingSlip] = useState(false);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const fromUrl = searchParams.get('load_code');
    if (fromUrl) {
      setCode(fromUrl.toUpperCase());
      setExpanded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  useEffect(() => {
    if (code && expanded && !order && !isLoading) loadCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, expanded]);

  useEffect(() => {
    fetch(`${EDGE_URL}?action=rates`)
      .then(r => r.json())
      .then(d => setRates(d.rates))
      .catch(() => {});
  }, []);

  const loadCode = async () => {
    if (!code.trim()) return;
    setIsLoading(true);
    setError('');
    setOrder(null);
    try {
      const res = await fetch(`${EDGE_URL}?action=load-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.toUpperCase().trim(), manager_token: token }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Order not found'); return; }
      setOrder(data.order);
      setNote(data.order.admin_note ?? '');
      setShipping(data.order.shipping_ngn?.toString() ?? '');
      setStatusDraft(data.order.status);
    } catch {
      setError('Connection error');
    } finally {
      setIsLoading(false);
    }
  };

  // overrides lets a single call update status and/or payment_status together
  // (e.g. "Confirm Payment" sets payment_status without touching status).
  const updateOrder = async (overrides?: { status?: string; payment_status?: string }) => {
    if (!order) return;
    setIsSaving(true);
    try {
      const body: any = { id: order.id, manager_token: token };
      body.status = overrides?.status ?? statusDraft ?? order.status;
      if (overrides?.payment_status) body.payment_status = overrides.payment_status;
      if (shipping) body.shipping_ngn = parseFloat(shipping);
      if (note !== undefined) body.admin_note = note;

      const res = await fetch(`${EDGE_URL}?action=update-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.order) { setOrder(data.order); setStatusDraft(data.order.status); }
    } catch {
    } finally {
      setIsSaving(false);
    }
  };

  const confirmPayment = () => { setIsConfirmingPayment(true); updateOrder({ payment_status: 'paid' }).finally(() => setIsConfirmingPayment(false)); };
  const rejectPayment = () => { setIsConfirmingPayment(true); updateOrder({ payment_status: 'failed' }).finally(() => setIsConfirmingPayment(false)); };

  // Per-item shipping override — server rejects with an error if the batch
  // is already billed, which is surfaced via the same error banner used for
  // order lookup rather than a separate toast system (this file has none).
  const [shippingActingKey, setShippingActingKey] = useState<string | null>(null);
  const setItemShippingMethod = async (item: ImportOrder['items'][number], method: 'flight' | 'sea_freight') => {
    if (!order) return;
    const key = `${item.id}:${JSON.stringify(item.variant_options ?? null)}`;
    setShippingActingKey(key);
    setError('');
    try {
      const res = await fetch(`${EDGE_URL}?action=admin-set-item-shipping-method`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, order_id: order.id, product_id: item.id, variant_options: item.variant_options, new_method: method }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Could not update shipping method'); return; }
      setOrder(data.order);
    } catch {
      setError('Connection error');
    } finally {
      setShippingActingKey(null);
    }
  };

  const shippingNgn = parseFloat(shipping) || 0;
  const shippingCny = rates ? shippingNgn / rates.cnyToNgn : null;
  const shippingUsd = rates ? shippingNgn / rates.usdToNgn : null;
  const nextStatus = order ? STATUS_FLOW[STATUS_FLOW.indexOf(order.status) + 1] : null;

  const waLink = order
    ? `https://wa.me/${order.customer_whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
        `Hi ${order.customer_name}! Your QAFRICA import order *${order.code}* has been received. ${
          shippingNgn ? `Shipping cost: ₦${Math.round(shippingNgn).toLocaleString()}. ` : ''
        }We'll keep you updated!`
      )}`
    : '';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <button
        onClick={() => setExpanded(p => !p)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Search className="w-4 h-4 text-gray-400" />
          <span className="font-semibold text-gray-800 text-sm">Load order by code</span>
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-gray-300" />
          : <ChevronDown className="w-4 h-4 text-gray-300" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-100">
          <div className="flex gap-2 mt-4">
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && loadCode()}
              placeholder="e.g. AB3X7K"
              maxLength={6}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-mono font-bold tracking-widest uppercase focus:border-gray-400 focus:ring-2 focus:ring-gray-200 outline-none"
            />
            <button
              onClick={loadCode}
              disabled={isLoading || !code.trim()}
              className="px-5 py-2.5 bg-gray-900 hover:bg-gray-700 disabled:opacity-30 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2"
            >
              {isLoading ? <Loader className="w-3.5 h-3.5 animate-spin" /> : 'Load'}
            </button>
          </div>

          {error && (
            <div className="mt-3 flex items-center gap-2 text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {order && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 space-y-4"
            >
              {/* Customer block */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-gray-900">{order.customer_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{order.customer_whatsapp} · {timeSince(order.created_at)}</p>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <span className={`inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      order.delivery_type === 'to_qafrica'
                        ? 'bg-orange-50 text-orange-600'
                        : 'bg-sky-50 text-sky-600'
                    }`}>
                      {order.delivery_type === 'to_qafrica' ? 'To QAFRICA / Jumia' : 'To Customer'}
                    </span>
                    {order.shipping_method && (
                      <span className="inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                        {SHIPPING_METHOD_LABELS[order.shipping_method] ?? order.shipping_method}
                      </span>
                    )}
                    <span className={`inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full ${PAYMENT_STATUS_COLORS[order.payment_status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {PAYMENT_STATUS_LABELS[order.payment_status] ?? order.payment_status}
                      {order.payment_method === 'paystack' && order.payment_status === 'paid' ? ' · auto-verified' : ''}
                    </span>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${STATUS_COLORS[order.status]}`}>
                  {STATUS_LABELS[order.status]}
                </span>
              </div>

              {/* Manual transfer awaiting verification — admin must confirm or reject before it counts as paid */}
              {order.payment_status === 'awaiting_confirmation' && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl px-3.5 py-3">
                  <p className="text-xs text-amber-800 font-semibold mb-0.5">Customer says they've paid by bank transfer</p>
                  <p className="text-[11px] text-amber-600 mb-2.5">Check your bank statement before confirming — this is a self-report, not a verified payment.</p>
                  {(order.manual_sender_name || order.manual_sender_bank) && (
                    <div className="bg-white border border-amber-200 rounded-lg px-3 py-2 mb-2.5">
                      <p className="text-[10px] text-amber-500 font-semibold uppercase tracking-wide mb-0.5">Sender declared</p>
                      <p className="text-xs text-gray-800 font-semibold">{order.manual_sender_name || 'Not provided'}</p>
                      {order.manual_sender_bank && (
                        <p className="text-[11px] text-gray-500 mt-0.5">from {order.manual_sender_bank}</p>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={confirmPayment}
                      disabled={isConfirmingPayment}
                      className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                    >
                      {isConfirmingPayment ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Confirm Payment
                    </button>
                    <button
                      onClick={rejectPayment}
                      disabled={isConfirmingPayment}
                      className="flex-1 py-2 bg-white border border-amber-200 hover:bg-amber-100 disabled:opacity-40 text-amber-700 text-xs font-bold rounded-lg transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )}

              {/* Delivery address — only present for to_me orders */}
              {order.delivery_type === 'to_me' && order.delivery_address && (
                <div className="bg-gray-50 rounded-xl px-3.5 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs text-gray-600 leading-relaxed">
                      <p className="font-semibold text-gray-800">{order.delivery_address.name} · {order.delivery_address.phone}</p>
                      <p>{order.delivery_address.address_line1}{order.delivery_address.address_line2 ? `, ${order.delivery_address.address_line2}` : ''}</p>
                      <p>{order.delivery_address.city}, {order.delivery_address.state}</p>
                      {order.delivery_address.landmark && <p className="text-gray-400">Near: {order.delivery_address.landmark}</p>}
                      {order.location_shared && (
                        <p className="text-emerald-600 font-semibold mt-1">📍 GPS location shared</p>
                      )}
                    </div>
                    {googleMapsLink(order) && (
                      <a
                        href={googleMapsLink(order)!} target="_blank" rel="noopener noreferrer"
                        className="flex-shrink-0 flex items-center gap-1 text-[11px] font-bold text-white bg-gray-900 hover:bg-gray-700 px-2.5 py-1.5 rounded-lg transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" /> Maps
                      </a>
                    )}
                  </div>
                </div>
              )}

              <Divider />

              {/* Items */}
              <div className="space-y-2">
                {order.items.map((item, i) => {
                  const key = `${item.id}:${JSON.stringify(item.variant_options ?? null)}`;
                  const acting = shippingActingKey === key;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <img src={item.image_url} alt={item.name}
                        className="w-10 h-10 rounded-lg object-cover border border-gray-100 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                        <p className="text-[11px] text-gray-400">{fmtCny(item.price_cny)} · qty {item.quantity}</p>
                      </div>
                      {/* Shipping method for this specific item — admin can toggle it
                          (server rejects once the batch this order is in has been billed). */}
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => setItemShippingMethod(item, 'flight')}
                          disabled={acting}
                          className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-1 rounded-full border transition-colors disabled:opacity-40 ${item.shipping_method === 'flight' ? 'bg-sky-50 text-sky-600 border-sky-200' : 'bg-white text-gray-400 border-gray-200'}`}
                        >
                          Air
                        </button>
                        <button
                          onClick={() => setItemShippingMethod(item, 'sea_freight')}
                          disabled={acting}
                          className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-1 rounded-full border transition-colors disabled:opacity-40 ${item.shipping_method === 'sea_freight' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-white text-gray-400 border-gray-200'}`}
                        >
                          Sea
                        </button>
                      </div>
                      <p className="text-sm font-semibold text-gray-800 flex-shrink-0">
                        {fmt(item.price_ngn * item.quantity)}
                      </p>
                    </div>
                  );
                })}
              </div>

              <Divider />

              {/* Totals */}
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span><span>{fmt(order.subtotal_ngn)}</span>
                </div>
                {order.jumia_fee_ngn > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>Jumia fee</span><span>{fmt(order.jumia_fee_ngn)}</span>
                  </div>
                )}
                {order.shipping_ngn && (
                  <div className="flex justify-between text-gray-500">
                    <span>Shipping</span><span>{fmt(order.shipping_ngn)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-gray-100">
                  <span>Total</span><span className="text-orange-500">{fmt(order.total_ngn)}</span>
                </div>
              </div>

              <Divider />

              {/* Status — jump directly to any status (confirmed/billed/to_review are usually set automatically by payment/billing actions, but can be overridden here) */}
              <div>
                <Label>Order status</Label>
                <select
                  value={statusDraft}
                  onChange={e => setStatusDraft(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-200 outline-none bg-white"
                >
                  {STATUS_FLOW.map(s => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>

              {/* Shipping input */}
              <div>
                <Label>Shipping cost (₦)</Label>
                <input
                  type="number"
                  value={shipping}
                  onChange={e => setShipping(e.target.value)}
                  placeholder="Enter amount in Naira"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-200 outline-none"
                />
                {shippingNgn > 0 && rates && (
                  <div className="flex gap-2 mt-2">
                    <span className="text-[11px] bg-red-50 text-red-600 px-2 py-1 rounded-lg font-semibold">
                      {fmtCny(shippingCny!)} CNY
                    </span>
                    <span className="text-[11px] bg-green-50 text-green-600 px-2 py-1 rounded-lg font-semibold">
                      {fmtUsd(shippingUsd!)} USD
                    </span>
                    <span className="text-[11px] bg-gray-50 text-gray-400 px-2 py-1 rounded-lg">
                      ¥1 = ₦{Math.round(rates.cnyToNgn)}
                    </span>
                  </div>
                )}
              </div>

              {/* Admin note */}
              <div>
                <Label>Internal note</Label>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={2}
                  placeholder="Notes visible only to admins..."
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-200 outline-none resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-1">
                <button
                  onClick={() => updateOrder()}
                  disabled={isSaving}
                  className="w-full py-2.5 bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Save changes
                </button>

                {nextStatus && (
                  <button
                    onClick={() => updateOrder({ status: nextStatus })}
                    disabled={isSaving}
                    className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    {isSaving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <TrendingUp className="w-3.5 h-3.5" />}
                    Mark as {STATUS_LABELS[nextStatus]}
                  </button>
                )}

                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Message on WhatsApp
                </a>
                <button
                  onClick={() => setShowPackingSlip(true)}
                  className="w-full py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  Print packing slip
                </button>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {showPackingSlip && order && (
        <AdminOrderReceiptSheet
          order={{
            code: order.code,
            created_at: order.created_at,
            customer_name: order.customer_name,
            customer_whatsapp: order.customer_whatsapp,
            items: order.items,
            total_ngn: order.total_ngn,
            delivery_type: order.delivery_type,
            delivery_address: order.delivery_address,
            shipping_method: order.shipping_method,
          }}
          onClose={() => setShowPackingSlip(false)}
        />
      )}
    </div>
  );
}

// ── All Orders List ───────────────────────────────────────────────────────────
type OrderDateFilter = 'all' | 'today' | 'yesterday' | '7d' | 'month' | 'older';

const ORDER_PAGE_SIZE = 25;

function startOfLocalDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfLocalDay(date = new Date()) {
  const d = startOfLocalDay(date);
  d.setDate(d.getDate() + 1);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function getOrderDateRange(filter: OrderDateFilter): { date_from?: string; date_to?: string } {
  const todayStart = startOfLocalDay();
  const tomorrowStart = endOfLocalDay();

  switch (filter) {
    case 'today':
      return {
        date_from: todayStart.toISOString(),
        date_to: tomorrowStart.toISOString(),
      };
    case 'yesterday': {
      const yesterdayStart = addDays(todayStart, -1);
      return {
        date_from: yesterdayStart.toISOString(),
        date_to: todayStart.toISOString(),
      };
    }
    case '7d':
      return {
        date_from: addDays(todayStart, -6).toISOString(),
        date_to: tomorrowStart.toISOString(),
      };
    case 'month': {
      const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
      return {
        date_from: monthStart.toISOString(),
        date_to: tomorrowStart.toISOString(),
      };
    }
    case 'older':
      return {
        date_to: addDays(todayStart, -6).toISOString(),
      };
    default:
      return {};
  }
}

function formatOrderDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function OrdersList({ token }: { token: string }) {
  const [orders, setOrders] = useState<ImportOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<OrderDateFilter>('all');
  const [search, setSearch] = useState('');
  const [billingOrder, setBillingOrder] = useState<ImportOrder | null>(null);
  const [profileCustomerId, setProfileCustomerId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const load = useCallback(async (targetPage = 1, signal?: AbortSignal) => {
    setIsLoading(true);

    try {
      const range = getOrderDateRange(dateFilter);
      const body: Record<string, unknown> = {
        manager_token: token,
        page: targetPage,
        per_page: ORDER_PAGE_SIZE,
      };

      if (filter !== 'all') body.status = filter;
      if (range.date_from) body.date_from = range.date_from;
      if (range.date_to) body.date_to = range.date_to;

      // Keep the original casing/spacing. The backend handles the searchable
      // fields and customer lookup; lowercasing here was unnecessary.
      const trimmedSearch = search.trim();
      if (trimmedSearch) body.search = trimmedSearch;

      const res = await fetch(IMPORT_ADMIN_ORDERS_EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load orders');

      setOrders(data.orders ?? []);
      setTotalCount(Number(data.pagination?.total ?? data.orders?.length ?? 0));
      setPageCount(Math.max(1, Number(data.pagination?.page_count ?? 1)));
      setPage(Number(data.pagination?.page ?? targetPage));
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('[OrdersList]', error);
      setOrders([]);
      setTotalCount(0);
      setPageCount(1);
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [token, filter, dateFilter, search]);

  useEffect(() => {
    const controller = new AbortController();

    const timer = setTimeout(() => {
      load(1, controller.signal);
    }, search.trim() ? 350 : 0);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [load]);

  useEffect(() => {
    if (page > pageCount) setPage(1);
  }, [page, pageCount]);

  const changeDateFilter = (next: OrderDateFilter) => {
    setDateFilter(next);
    setPage(1);
  };

  const changeStatusFilter = (next: string) => {
    setFilter(next);
    setPage(1);
  };

  const todayCountHint = dateFilter === 'today' && filter === 'all' && !search.trim()
    ? totalCount
    : null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Package className="w-4 h-4 text-gray-400" />
          <span className="font-semibold text-gray-800 text-sm">All orders</span>
          <span className="text-[11px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
            {totalCount.toLocaleString()}
          </span>
        </div>

        <button
          onClick={() => load(page)}
          disabled={isLoading}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          title="Refresh orders"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="px-5 py-3 border-b border-gray-100 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300" />
          <input
            type="search"
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setPage(1);
            }}
            onKeyDown={e => {
              if (e.key === 'Escape') setSearch('');
            }}
            placeholder="Search order code, customer, email, phone or payment ref…"
            className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-gray-400 outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setPage(1);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {([
            ['all', 'All'],
            ['today', 'Today'],
            ['yesterday', 'Yesterday'],
            ['7d', 'Last 7 days'],
            ['month', 'This month'],
            ['older', 'Older'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => changeDateFilter(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                dateFilter === key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {label}
              {key === 'today' && todayCountHint !== null ? ` (${todayCountHint})` : ''}
            </button>
          ))}
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          <button
            onClick={() => changeStatusFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
              filter === 'all' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-500'
            }`}
          >
            All statuses
          </button>

          {STATUS_FLOW.map(status => (
            <button
              key={status}
              onClick={() => changeStatusFilter(status)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                filter === status ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {STATUS_LABELS[status]}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[920px] w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              <th className="px-5 py-3">Order</th>
              <th className="px-5 py-3">Customer</th>
              <th className="px-5 py-3">Payment</th>
              <th className="px-5 py-3">Delivery</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Total</th>
              <th className="px-5 py-3">Created</th>
              <th className="px-5 py-3 text-right">Action</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-50">
            {isLoading && orders.length === 0 ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({ length: 8 }).map((__, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="h-3 bg-gray-100 rounded w-20" />
                    </td>
                  ))}
                </tr>
              ))
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center">
                  <p className="text-sm text-gray-300">No orders found</p>
                </td>
              </tr>
            ) : (
              orders.map(order => (
                <tr
                  key={order.id}
                  onClick={() => order.user_id && setProfileCustomerId(order.user_id)}
                  className={`hover:bg-gray-50 transition-colors ${order.user_id ? 'cursor-pointer' : ''}`}
                >
                  <td className="px-5 py-3.5 align-middle">
                    <div>
                      <p className="font-bold text-gray-900 font-mono tracking-wider text-xs">
                        {order.code}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {formatOrderDate(order.created_at)}
                      </p>
                    </div>
                  </td>

                  <td className="px-5 py-3.5 align-middle">
                    <p className="text-sm font-medium text-gray-800">{order.customer_name}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5 max-w-[190px] truncate">
                      {order.customer_email ?? order.customer_whatsapp}
                    </p>
                  </td>

                  <td className="px-5 py-3.5 align-middle">
                    <span className={`inline-flex text-[10px] font-bold px-2 py-1 rounded-full ${
                      order.payment_status === 'paid'
                        ? 'bg-emerald-50 text-emerald-700'
                        : order.payment_status === 'awaiting_confirmation'
                          ? 'bg-amber-50 text-amber-700'
                          : order.payment_status === 'failed'
                            ? 'bg-red-50 text-red-600'
                            : 'bg-gray-100 text-gray-500'
                    }`}>
                      {PAYMENT_STATUS_LABELS[order.payment_status] ?? order.payment_status}
                    </span>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {order.payment_method === 'paystack' ? 'Paystack' : order.payment_method === 'manual' ? 'Bank transfer' : '—'}
                    </p>
                  </td>

                  <td className="px-5 py-3.5 align-middle">
                    <span className={`text-[10px] font-medium ${
                      order.delivery_type === 'to_qafrica' ? 'text-orange-500' : 'text-sky-500'
                    }`}>
                      {order.delivery_type === 'to_qafrica' ? 'QAFRICA / Jumia' : 'To customer'}
                    </span>
                  </td>

                  <td className="px-5 py-3.5 align-middle">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {STATUS_LABELS[order.status] ?? order.status}
                    </span>
                  </td>

                  <td className="px-5 py-3.5 align-middle text-right">
                    <span className="font-semibold text-gray-800 text-xs whitespace-nowrap">
                      {fmt(order.total_ngn)}
                    </span>
                  </td>

                  <td className="px-5 py-3.5 align-middle whitespace-nowrap">
                    <span className="text-[11px] text-gray-500">
                      {formatOrderDate(order.created_at)}
                    </span>
                    <span className="block text-[10px] text-gray-300">
                      {timeSince(order.created_at)}
                    </span>
                  </td>

                  <td className="px-5 py-3.5 align-middle text-right">
                    {order.user_id ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setBillingOrder(order);
                        }}
                        className="text-[11px] font-semibold text-orange-600 bg-orange-50 hover:bg-orange-100 px-2.5 py-1.5 rounded-lg transition-colors"
                      >
                        Bill
                      </button>
                    ) : (
                      <span className="text-[10px] text-gray-300">Guest</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-3">
          <p className="text-[11px] text-gray-400 whitespace-nowrap">
            Page {page} of {pageCount} · {totalCount.toLocaleString()} orders
          </p>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => load(page - 1)}
              disabled={page <= 1 || isLoading}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>

            {Array.from({ length: Math.min(5, pageCount) }).map((_, index) => {
              let pageNumber = index + 1;
              if (pageCount > 5) {
                if (page <= 3) pageNumber = index + 1;
                else if (page >= pageCount - 2) pageNumber = pageCount - 4 + index;
                else pageNumber = page - 2 + index;
              }

              return (
                <button
                  key={pageNumber}
                  onClick={() => load(pageNumber)}
                  disabled={isLoading}
                  className={`min-w-8 h-8 px-2 rounded-lg text-xs font-semibold transition-colors ${
                    page === pageNumber
                      ? 'bg-gray-900 text-white'
                      : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {pageNumber}
                </button>
              );
            })}

            <button
              onClick={() => load(page + 1)}
              disabled={page >= pageCount || isLoading}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {billingOrder && (
        <BillCustomerModal
          token={token}
          order={billingOrder}
          onClose={() => setBillingOrder(null)}
        />
      )}

      {profileCustomerId && (
        <CustomerDetail
          token={token}
          customerId={profileCustomerId}
          onClose={() => {
            setProfileCustomerId(null);
            load(page);
          }}
          onFavoriteToggled={() => {}}
        />
      )}
    </div>
  );
}

// ── Bill Customer Modal (consolidation drop-off fee) ────────────────────────
function BillCustomerModal({
  token,
  order,
  onClose,
}: {
  token: string;
  order: ImportOrder;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<'consolidation' | 'shipping'>('consolidation');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('Consolidation drop-off fee');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const selectKind = (k: 'consolidation' | 'shipping') => {
    setKind(k);
    // Only swap the reason if it still matches one of the two defaults —
    // if admin already typed something custom, don't clobber it.
    if (reason === 'Consolidation drop-off fee' || reason === 'Shipping fee to Nigeria') {
      setReason(k === 'shipping' ? 'Shipping fee to Nigeria' : 'Consolidation drop-off fee');
    }
  };

  const handleSubmit = async () => {
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) { setError('Enter a valid amount'); return; }
    setIsSaving(true);
    setError('');
    try {
      const res = await fetch(`${EDGE_URL}?action=admin-create-bill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager_token: token,
          user_id: order.user_id,
          order_id: order.id,
          amount_ngn: amountNum,
          reason: reason.trim() || undefined,
          kind,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create bill');
      setDone(true);
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl p-6">
        {done ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <h3 className="font-bold text-gray-900 text-lg mb-1">Bill sent</h3>
            <p className="text-gray-400 text-xs mb-5">
              {order.customer_name} will see this on their dashboard and can pay by bank transfer.
              {kind === 'shipping' && ' Once confirmed paid, this order moves to To Review.'}
            </p>
            <button onClick={onClose} className="w-full py-3 bg-gray-900 text-white font-bold text-sm rounded-xl">
              Done
            </button>
          </div>
        ) : (
          <>
            <h3 className="font-bold text-gray-900 text-lg mb-1">Bill this customer</h3>
            <p className="text-gray-400 text-xs mb-4">
              Order {order.code} · {order.customer_name}
            </p>

            <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Fee type</label>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                onClick={() => selectKind('consolidation')}
                className={`py-2.5 rounded-xl text-xs font-bold border-2 transition-colors ${
                  kind === 'consolidation' ? 'border-gray-900 bg-gray-50 text-gray-900' : 'border-gray-100 text-gray-400'
                }`}
              >
                Consolidation
              </button>
              <button
                onClick={() => selectKind('shipping')}
                className={`py-2.5 rounded-xl text-xs font-bold border-2 transition-colors ${
                  kind === 'shipping' ? 'border-gray-900 bg-gray-50 text-gray-900' : 'border-gray-100 text-gray-400'
                }`}
              >
                Shipping to Nigeria
              </button>
            </div>
            <p className="text-[11px] text-gray-400 -mt-2.5 mb-4">
              {kind === 'shipping'
                ? 'This is the final fee — once paid, the order moves to "To Review".'
                : 'The warehouse drop-off/consolidation fee. Paying this keeps the order at "Billed" in case a shipping fee follows later.'}
            </p>

            <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Amount (₦)</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="e.g. 5000"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none mb-3"
            />
            <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Reason</label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none mb-4"
            />

            {error && (
              <p className="text-red-500 text-xs font-medium bg-red-50 px-3 py-2 rounded-lg mb-3">{error}</p>
            )}

            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 py-3 text-sm font-semibold text-gray-500 bg-gray-100 rounded-xl">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSaving || !amount}
                className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2"
              >
                {isSaving ? <Loader className="w-4 h-4 animate-spin" /> : 'Send bill'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Image slot component ───────────────────────────────────────────────────────
function ImageSlot({
  src,
  index,
  onAdd,
  onRemove,
}: {
  src?: string;
  index: number;
  onAdd: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
}) {
  if (src) {
    return (
      <div className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 group">
        <img src={src} alt={`Image ${index + 1}`} className="w-full h-full object-cover" />
        <button
          onClick={onRemove}
          className="absolute top-1.5 right-1.5 w-6 h-6 bg-white/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
        >
          <X className="w-3 h-3 text-gray-700" />
        </button>
        {index === 0 && (
          <span className="absolute bottom-1.5 left-1.5 text-[9px] bg-gray-900/70 text-white px-1.5 py-0.5 rounded font-semibold">
            Main
          </span>
        )}
      </div>
    );
  }

  return (
    <label className="cursor-pointer aspect-square rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center hover:border-gray-400 transition-colors">
      <Upload className="w-4 h-4 text-gray-300 mb-1" />
      <span className="text-[10px] text-gray-300">Add photo</span>
      <input type="file" accept="image/*" className="hidden" onChange={onAdd} />
    </label>
  );
}

// ── Product Management ────────────────────────────────────────────────────────
function ProductsManager({ token, openProductId, onOpenedProduct }: { token: string; openProductId?: string | null; onOpenedProduct?: () => void }) {
  const [products, setProducts]       = useState<ImportProduct[]>([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [editProduct, setEditProduct] = useState<ImportProduct | null>(null);
  const [rates, setRates]             = useState<Rates | null>(null);
  const [pricingUsdToNgn, setPricingUsdToNgn] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [shippingRates, setShippingRates] = useState({
    seaRateNgnPerCbm: 0,
    flightRateNgnPerGram: 0,
    seaProductAllocationPercent: 80,
    seaCustomerPercent: 20,
    airCreditEnabled: true,
  });
  const [productCategories, setProductCategories] = useState<ProductCategory[]>([]);

  // Form state
  const [name, setName]               = useState('');
  const [description, setDesc]        = useState('');
  const [category, setCategory]       = useState('General');
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [priceAmount, setPriceAmount] = useState(''); // raw price as entered by admin
  const [moq, setMoq]                 = useState('1');
  const [sourceUrl, setSourceUrl]     = useState('');
  const [shipOnly, setShipOnly]       = useState(false);
  const [volumeCbm, setVolumeCbm] = useState('');
  const [weightGrams, setWeightGrams] = useState('');
  const [unitsSold, setUnitsSold]     = useState('');
  const [variantGroups, setVariantGroups] = useState<VariantGroup[]>([]);
  const [expandedVariantGroups, setExpandedVariantGroups] = useState<Set<string>>(new Set());
  const toggleVariantGroupExpanded = (key: string) =>
    setExpandedVariantGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  const [customGroupName, setCustomGroupName] = useState('');
  const [customOptionDrafts, setCustomOptionDrafts] = useState<Record<string, string>>({});
  const [imagePreviews, setImagePreviews] = useState<string[]>([]); // up to 3 preview URLs
  const [imageFiles, setImageFiles]   = useState<(File | null)[]>([null, null, null]);
  const [isSaving, setIsSaving]       = useState(false);
  const [saveError, setSaveError]     = useState('');

  // Live preview: original USD → current USD/NGN rate → selected subcategory markup.
  const rawAmount = parseFloat(priceAmount) || 0;
  const selectedCategory = productCategories.find(c => c.id === categoryId);
  const selectedSubcategory = selectedCategory?.subcategories.find(s => s.id === subcategoryId);
  const previewMarkupPercent = Number(selectedSubcategory?.markup_percent ?? 0);
  const previewBaseCostNgn = rawAmount > 0 && pricingUsdToNgn ? rawAmount * pricingUsdToNgn : 0;
  const previewMarkupNgn = previewBaseCostNgn * (previewMarkupPercent / 100);
  const previewProductCostNgn = previewBaseCostNgn + previewMarkupNgn;
  const volumeCbmNum = parseFloat(volumeCbm) || 0;
  const weightGramsNum = parseFloat(weightGrams) || 0;
  const previewRawSeaShipping = volumeCbmNum > 0 ? volumeCbmNum * shippingRates.seaRateNgnPerCbm : 0;
  const previewSeaAllocationNgn = previewRawSeaShipping * (shippingRates.seaProductAllocationPercent / 100);
  const previewSeaCustomerNgn = previewRawSeaShipping * (shippingRates.seaCustomerPercent / 100);
  const previewRawAirShipping = weightGramsNum > 0 ? weightGramsNum * shippingRates.flightRateNgnPerGram : 0;
  const previewAirCustomerNgn = Math.max(
    previewRawAirShipping - (shippingRates.airCreditEnabled ? previewSeaAllocationNgn : 0),
    0,
  );
  const previewFinalProductPriceNgn = previewProductCostNgn + previewSeaAllocationNgn;

  // ── Variant helpers ─────────────────────────────────────────────────────
  const toggleGroupOption = (groupName: string, option: string) => {
    setVariantGroups(prev => {
      const existingGroup = prev.find(g => g.name === groupName);
      if (!existingGroup) {
        return [...prev, { id: genId(), name: groupName, options: [option] }];
      }
      const hasOption = existingGroup.options.includes(option);
      const updatedOptions = hasOption
        ? existingGroup.options.filter(o => o !== option)
        : [...existingGroup.options, option];
      if (updatedOptions.length === 0) {
        return prev.filter(g => g.id !== existingGroup.id);
      }
      return prev.map(g => g.id === existingGroup.id ? { ...g, options: updatedOptions } : g);
    });
  };

  const addCustomGroup = () => {
    const trimmed = customGroupName.trim();
    if (!trimmed) return;
    if (variantGroups.some(g => g.name.toLowerCase() === trimmed.toLowerCase())) return;
    setVariantGroups(prev => [...prev, { id: genId(), name: trimmed, options: [] }]);
    setCustomGroupName('');
  };

  const addCustomOption = (groupId: string) => {
    const draft = (customOptionDrafts[groupId] ?? '').trim();
    if (!draft) return;
    setVariantGroups(prev => prev.map(g =>
      g.id === groupId && !g.options.includes(draft) ? { ...g, options: [...g.options, draft] } : g
    ));
    setCustomOptionDrafts(prev => ({ ...prev, [groupId]: '' }));
  };

  const removeCustomOption = (groupId: string, option: string) => {
    setVariantGroups(prev => prev
      .map(g => g.id === groupId ? { ...g, options: g.options.filter(o => o !== option) } : g)
      .filter(g => g.options.length > 0));
  };

  const removeGroup = (groupId: string) => {
    setVariantGroups(prev => prev.filter(g => g.id !== groupId));
  };

  // Sets (or clears, if left blank/0) the NGN price adjustment for one
  // specific option within a group — e.g. Size "XL" costs +₦1,500 more.
  const setOptionDelta = (groupId: string, option: string, deltaStr: string) => {
    const trimmed = deltaStr.trim();
    const delta = trimmed === '' ? undefined : Number(trimmed);
    setVariantGroups(prev => prev.map(g => {
      if (g.id !== groupId) return g;
      const price_deltas = { ...(g.price_deltas ?? {}) };
      if (delta === undefined || Number.isNaN(delta) || delta === 0) {
        delete price_deltas[option];
      } else {
        price_deltas[option] = delta;
      }
      return { ...g, price_deltas: Object.keys(price_deltas).length ? price_deltas : undefined };
    }));
  };

  useEffect(() => {
    loadProducts();
    fetch(`${EDGE_URL}?action=rates`)
      .then(r => r.json())
      .then(d => setRates(d.rates))
      .catch(() => {});
    fetch(`${EDGE_URL}?action=admin-pricing-settings`)
      .then(r => r.json())
      .then(d => {
        const s = d?.settings;
        if (!s) return;

        const usdToNgn = Number(s.usd_to_ngn);
        const seaRate = Number(s.sea_rate_ngn_per_cbm);
        // Accept both API names for the air rate so the admin preview
        // never silently falls back to zero if the response uses either
        // the air or flight naming convention.
        const airRate = Number(s.air_rate_ngn_per_gram ?? s.flight_rate_ngn_per_gram);
        const seaProductPct = Number(s.sea_product_allocation_percent ?? s.sea_shipping_product_allocation_percent);
        const seaCustomerPct = Number(s.sea_customer_percent ?? s.sea_shipping_customer_percent);

        if (Number.isFinite(usdToNgn) && usdToNgn > 0) setPricingUsdToNgn(usdToNgn);

        setShippingRates({
          seaRateNgnPerCbm: Number.isFinite(seaRate) && seaRate >= 0 ? seaRate : 0,
          flightRateNgnPerGram: Number.isFinite(airRate) && airRate >= 0 ? airRate : 0,
          seaProductAllocationPercent: Number.isFinite(seaProductPct) ? seaProductPct : 80,
          seaCustomerPercent: Number.isFinite(seaCustomerPct) ? seaCustomerPct : 20,
          airCreditEnabled: s.air_credit_enabled !== false,
        });
      })
      .catch(() => {});
    fetch(`${CONFIG.SUPABASE_URL}/functions/v1/category?action=list`)
      .then(r => r.json())
      .then(d => setProductCategories(Array.isArray(d.categories) ? d.categories : []))
      .catch(() => setProductCategories([]));
  }, []);

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${EDGE_URL}?action=admin-products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token }),
      });
      const data = await res.json();
      setProducts(data.products ?? []);
    } catch {
    } finally {
      setIsLoading(false);
    }
  };

  const openAdd = () => {
    setEditProduct(null);
    setName(''); setDesc(''); setCategory('General');
    setCategoryId(''); setSubcategoryId('');
    setPriceAmount(''); setMoq('1'); setUnitsSold('');
    setSourceUrl(''); setShipOnly(false);
    setVariantGroups([]); setCustomGroupName(''); setCustomOptionDrafts({}); setExpandedVariantGroups(new Set());
    setImagePreviews([]); setImageFiles([null, null, null]);
    setSaveError('');
    setShowForm(true);
    setVolumeCbm(''); setWeightGrams('');
  };

  const openEdit = (p: ImportProduct) => {
    setEditProduct(p);
    setName(p.name); setDesc(p.description); setCategory(p.category);
    const matchedCategory = p.category_id
      ? productCategories.find(c => c.id === p.category_id)
      : productCategories.find(c => c.name === (p.parent_category ?? p.category));
    setCategoryId(matchedCategory?.id ?? p.category_id ?? '');
    const matchedSubcategory = matchedCategory?.subcategories.find(s =>
      s.id === p.subcategory_id || s.name === p.category
    );
    setSubcategoryId(matchedSubcategory?.id ?? p.subcategory_id ?? '');
    // New products store the original supplier price in USD. For older products,
    // use the stored original CNY price as a fallback when CNY→USD is available.
    if (p.original_price_usd != null && Number(p.original_price_usd) > 0) {
      setPriceAmount(Number(p.original_price_usd).toString());
    } else if (p.price_cny_original != null && rates?.cnyToUsd) {
      setPriceAmount((Number(p.price_cny_original) * rates.cnyToUsd).toFixed(2));
    } else if (p.cost_ngn != null && pricingUsdToNgn) {
      setPriceAmount((Number(p.cost_ngn) / pricingUsdToNgn).toFixed(2));
    } else {
      setPriceAmount('');
    }
    setMoq((p.moq ?? 1).toString());
    setMoq((p.moq ?? 1).toString());
    setSourceUrl(p.source_url ?? '');
    setShipOnly(p.ship_only === true);
    setUnitsSold((p.units_sold ?? 0).toString());
    setVariantGroups(p.variants?.length ? p.variants.map(g => ({ ...g, id: g.id || genId() })) : []);
    setExpandedVariantGroups(new Set());
    setCustomGroupName(''); setCustomOptionDrafts({});
    // Populate previews from existing image_urls or fallback to image_url
    const existing = p.image_urls?.length ? p.image_urls : (p.image_url ? [p.image_url] : []);
    setImagePreviews(existing.slice(0, 3));
    setImageFiles([null, null, null]);
    setSaveError('');
    setShowForm(true);
    setVolumeCbm(p.volume_cbm != null ? p.volume_cbm.toString() : '');
    setWeightGrams(p.weight_grams != null ? p.weight_grams.toString() : '');
  };

  // Routed in from the Total Orders tab (click a product in a batch) —
  // once this manager's own product list has loaded, open that product's
  // edit form automatically.
  useEffect(() => {
    if (!openProductId) return;
    const match = products.find(p => p.id === openProductId);
    if (match) {
      openEdit(match);
      onOpenedProduct?.();
    }
  }, [openProductId, products]);

  const handleImageAdd = async (e: React.ChangeEvent<HTMLInputElement>, slot: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file, { maxWidth: 800, maxHeight: 800, targetSizeKb: 100 });
    const newFiles = [...imageFiles];
    newFiles[slot] = compressed;
    setImageFiles(newFiles);
    const newPreviews = [...imagePreviews];
    newPreviews[slot] = URL.createObjectURL(compressed);
    setImagePreviews(newPreviews);
  };

  const handleImageRemove = (slot: number) => {
    // Both arrays must shift together — previously imagePreviews spliced
    // (compacting slots) while imageFiles only nulled the slot in place,
    // which silently misaligned "this file" with "this preview" after any
    // removal and could save the wrong (or a stale) image on the next edit.
    const newPreviews = [...imagePreviews];
    newPreviews.splice(slot, 1);
    setImagePreviews(newPreviews);
    const newFiles = [...imageFiles];
    newFiles.splice(slot, 1);
    newFiles.push(null); // keep a fixed length of 3 for the slot-index checks in handleSave
    setImageFiles(newFiles);
  };

  const uploadImage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(',')[1];
          const ext = file.name.split('.').pop() ?? 'webp';
          const res = await fetch(`${EDGE_URL}?action=upload-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_base64: base64, extension: ext, manager_token: token }),
          });
          const data = await res.json();
          if (!res.ok || !data.url) throw new Error(data.error ?? 'Upload failed');
          resolve(data.url);
        } catch (err) { reject(err); }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleSave = async () => {
    if (!name || !priceAmount || imagePreviews.length === 0) return;
    setIsSaving(true);
    setSaveError('');
    try {
      // Upload any new files; keep existing URLs where no new file was uploaded
      const resolvedUrls: string[] = [];
      for (let i = 0; i < 3; i++) {
        if (imageFiles[i]) {
          resolvedUrls.push(await uploadImage(imageFiles[i]!));
        } else if (imagePreviews[i]) {
          resolvedUrls.push(imagePreviews[i]);
        }
      }

      const payload = {
        name,
        description,
        category,
        category_id: categoryId || undefined,
        subcategory_id: subcategoryId || undefined,
        original_price_usd: rawAmount,
        moq:             parseInt(moq, 10) >= 1 ? parseInt(moq, 10) : 1,
        has_variants:    variantGroups.length > 0,
        variants:        variantGroups,
        image_url:       resolvedUrls[0] ?? '',
        image_urls:      resolvedUrls,
        source_url:      sourceUrl.trim(),
        ship_only:       shipOnly,
        volume_cbm: volumeCbm.trim() === '' ? null : Number(volumeCbm),
        weight_grams: weightGrams.trim() === '' ? null : Number(weightGrams),
        manager_token:   token,
        ...(unitsSold.trim() !== '' ? { units_sold: parseInt(unitsSold, 10) } : {}),
      };

      const action = editProduct ? 'update-product' : 'add-product';
      const body   = editProduct ? { ...payload, id: editProduct.id } : payload;

      const res = await fetch(`${EDGE_URL}?action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setShowForm(false);
        loadProducts();
      } else {
        setSaveError(data.error ?? 'Save failed');
      }
    } catch (e: any) {
      setSaveError(e?.message ?? 'Unexpected error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    await fetch(`${EDGE_URL}?action=delete-product`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, manager_token: token }),
    });
    loadProducts();
  };

  // How many image slots to show: always show filled + 1 empty (up to 3 max)
  const slotsToShow = Math.min(3, imagePreviews.length + 1);

  const filteredProducts = (() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.description ?? '').toLowerCase().includes(q) ||
      (p.category ?? '').toLowerCase().includes(q)
    );
  })();

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Package className="w-4 h-4 text-gray-400" />
          <span className="font-semibold text-gray-800 text-sm">Products</span>
          <span className="text-[11px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
            {searchQuery ? `${filteredProducts.length}/${products.length}` : products.length}
          </span>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 hover:bg-gray-700 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add
        </button>
      </div>

      {/* Search */}
      <div className="px-5 py-3 border-b border-gray-100">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search products by name, category…"
            className="w-full pl-9 pr-8 py-2 rounded-lg border border-gray-200 text-xs focus:border-gray-400 focus:ring-2 focus:ring-gray-100 outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-gray-100"
          >
            <div className="px-5 py-5 space-y-4 bg-gray-50">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-gray-800 text-sm">
                  {editProduct ? 'Edit product' : 'New product'}
                </p>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Image slots — max 3 */}
              <div>
                <Label>Photos (up to 3)</Label>
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: slotsToShow }).map((_, i) => (
                    <ImageSlot
                      key={i}
                      index={i}
                      src={imagePreviews[i]}
                      onAdd={e => handleImageAdd(e, i)}
                      onRemove={() => handleImageRemove(i)}
                    />
                  ))}
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5">First photo is the main display image.</p>
              </div>

              <div>
                <Label>Product name</Label>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g. Wireless Earbuds Pro"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-200 outline-none" />
              </div>

              <div>
                <Label>Description</Label>
                <textarea value={description} onChange={e => setDesc(e.target.value)}
                  rows={2} placeholder="Brief product description…"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-200 outline-none resize-none" />
              </div>

              <div>
                <Label>Category</Label>
                <select
                  value={categoryId}
                  onChange={e => {
                    const nextId = e.target.value;
                    const nextCategory = productCategories.find(c => c.id === nextId);
                    setCategoryId(nextId);
                    setSubcategoryId('');
                    setCategory(nextCategory?.name ?? 'General');
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:border-gray-400 focus:ring-2 focus:ring-gray-200 outline-none"
                >
                  <option value="">Select category</option>
                  {[...productCategories]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
              </div>

              <div>
                <Label>Subcategory</Label>
                <select
                  value={subcategoryId}
                  disabled={!categoryId}
                  onChange={e => setSubcategoryId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:border-gray-400 focus:ring-2 focus:ring-gray-200 outline-none disabled:bg-gray-100 disabled:text-gray-400"
                >
                  <option value="">{categoryId ? 'Select subcategory' : 'Select a category first'}</option>
                  {[...(productCategories.find(c => c.id === categoryId)?.subcategories ?? [])]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({Number(s.markup_percent ?? 0).toFixed(2)}%)
                      </option>
                    ))}
                </select>
              </div>

              {/* Original USD price + subcategory markup preview */}
              <div>
                <Label>Original product price (USD)</Label>
                <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 mb-2">
                  <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-blue-600 leading-relaxed">
                    Enter the <strong>original supplier price in USD</strong>. The selected subcategory's markup percentage is applied automatically.
                  </p>
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input type="number" min={0} step="0.01" value={priceAmount}
                    onChange={e => setPriceAmount(e.target.value)} placeholder="e.g. 10.00"
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-200 outline-none" />
                </div>
                {rawAmount > 0 && (
                  <div className="mt-2 bg-white border border-gray-100 rounded-xl px-4 py-3 space-y-1.5">
                    <div className="flex justify-between text-xs text-gray-500"><span>Original price</span><span className="font-medium">{fmtUsd(rawAmount)}</span></div>
                    <div className="flex justify-between text-xs text-gray-500"><span>USD → NGN rate</span><span className="font-medium">{pricingUsdToNgn ? `₦${pricingUsdToNgn.toLocaleString()}` : 'Loading…'}</span></div>
                    <div className="flex justify-between text-xs text-gray-500"><span>Base cost</span><span className="font-medium">{pricingUsdToNgn ? fmt(previewBaseCostNgn) : '—'}</span></div>
                    <div className="flex justify-between text-xs text-gray-500"><span>Markup ({previewMarkupPercent.toFixed(2)}%)</span><span className="font-medium text-orange-500">{pricingUsdToNgn ? fmt(previewMarkupNgn) : '—'}</span></div>
                    <div className="h-px bg-gray-100" />
                    <div className="flex justify-between text-xs font-bold text-gray-800"><span>Product cost before shipping</span><span>{pricingUsdToNgn ? fmt(previewProductCostNgn) : '—'}</span></div>
                  </div>
                )}
              </div>

              <div>
                <Label>Minimum order quantity</Label>
                <input type="number" min={1} value={moq} onChange={e => setMoq(e.target.value)}
                  placeholder="1"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-200 outline-none" />
              </div>

              {/* Sourcing link — admin only. Never returned by the public
                  products endpoint, since it exposes the supplier and the
                  true landed cost. */}
              <div>
                <Label>1688 product link <span className="font-normal text-gray-400">(optional)</span></Label>
                <input
                  type="url"
                  inputMode="url"
                  value={sourceUrl}
                  onChange={e => setSourceUrl(e.target.value)}
                  placeholder="https://detail.1688.com/offer/..."
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-200 outline-none"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Only you see this. It powers the "Open on 1688" button when you're sourcing a batch.
                </p>
              </div>

              <div>
                <label className="flex items-start gap-3 px-4 py-3 rounded-xl border border-gray-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shipOnly}
                    onChange={e => setShipOnly(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-orange-500"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-gray-900">Sea freight only</span>
                    <span className="block text-[11px] text-gray-400">
                      Customers can't pick air for this product, and checkout will block a flight order containing it.
                    </span>
                  </span>
                </label>
              </div>

              <div>
                <Label>Volume for sea freight (CBM)</Label>
                <input
                  type="number" min={0} step="0.001"
                  value={volumeCbm} onChange={e => setVolumeCbm(e.target.value)}
                  placeholder="e.g. 0.05"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-200 outline-none"
                />
                {volumeCbmNum > 0 && (
                  <div className="mt-2 bg-white border border-gray-100 rounded-xl px-4 py-3 space-y-1.5">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Raw sea freight</span>
                      <span className="font-medium">{fmt(previewRawSeaShipping)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Added to product ({shippingRates.seaProductAllocationPercent.toFixed(2)}%)</span>
                      <span className="font-medium">{fmt(previewSeaAllocationNgn)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Customer sea fee ({shippingRates.seaCustomerPercent.toFixed(2)}%)</span>
                      <span className="font-medium">{fmt(previewSeaCustomerNgn)}</span>
                    </div>
                    <div className="h-px bg-gray-100" />
                    <div className="flex justify-between text-xs font-bold text-gray-800">
                      <span>Product price incl. sea allocation</span>
                      <span>{pricingUsdToNgn ? fmt(previewFinalProductPriceNgn) : '—'}</span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <Label>Weight for flight (grams)</Label>
                <input
                  type="number" min={0}
                  value={weightGrams} onChange={e => setWeightGrams(e.target.value)}
                  placeholder="e.g. 350"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-200 outline-none"
                />
                {weightGramsNum > 0 && (
                  <div className="mt-2 bg-white border border-gray-100 rounded-xl px-4 py-3 space-y-1.5">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Raw air freight</span>
                      <span className="font-medium">{fmt(previewRawAirShipping)}</span>
                    </div>
                    {shippingRates.airCreditEnabled && (
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Sea allocation credit</span>
                        <span className="font-medium text-emerald-600">−{fmt(Math.min(previewSeaAllocationNgn, previewRawAirShipping))}</span>
                      </div>
                    )}
                    <div className="h-px bg-gray-100" />
                    <div className="flex justify-between text-xs font-bold text-gray-800">
                      <span>Customer air fee</span>
                      <span>{fmt(previewAirCustomerNgn)}</span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <Label>Sold count</Label>
                <input type="number" min={0} value={unitsSold} onChange={e => setUnitsSold(e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-200 outline-none" />
                <p className="text-[11px] text-gray-400 mt-1">
                  Shown to customers as "X sold". Set this to seed prior real sales, or give a new listing a head start. Leave blank to keep it unchanged — it otherwise only increases automatically when a real order is confirmed paid.
                </p>
              </div>

              {/* Variants */}
              <div>
                <Label>Variants (optional)</Label>

                {/* Quick-add: Colors */}
                <div className="mb-3">
                  <p className="text-[11px] font-semibold text-gray-500 mb-1.5">Colors</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_COLORS.map(color => {
                      const active = variantGroups.find(g => g.name === 'Color')?.options.includes(color);
                      return (
                        <button key={color} type="button" onClick={() => toggleGroupOption('Color', color)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                            active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                          }`}>
                          {color}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Quick-add: Sizes */}
                <div className="mb-3">
                  <p className="text-[11px] font-semibold text-gray-500 mb-1.5">Sizes</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_SIZES.map(size => {
                      const active = variantGroups.find(g => g.name === 'Size')?.options.includes(size);
                      return (
                        <button key={size} type="button" onClick={() => toggleGroupOption('Size', size)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                            active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                          }`}>
                          {size}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom variant groups (also covers "unspecified" variants) */}
                {variantGroups.filter(g => g.name !== 'Color' && g.name !== 'Size').map(group => {
                  const isLong = group.options.length > 10;
                  const isExpanded = expandedVariantGroups.has(`chips:${group.id}`);
                  const visibleOptions = isLong && !isExpanded ? group.options.slice(0, 10) : group.options;
                  return (
                    <div key={group.id} className="mb-3 bg-white border border-gray-100 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[11px] font-semibold text-gray-700">{group.name} <span className="text-gray-400 font-normal">({group.options.length})</span></p>
                        <button type="button" onClick={() => removeGroup(group.id)} className="text-gray-300 hover:text-red-400">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {visibleOptions.map(opt => (
                          <span key={opt} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-gray-100 text-gray-600">
                            {opt}
                            <button type="button" onClick={() => removeCustomOption(group.id, opt)} className="text-gray-400 hover:text-red-400">
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        ))}
                        {isLong && (
                          <button type="button" onClick={() => toggleVariantGroupExpanded(`chips:${group.id}`)}
                            className="px-2 py-1 rounded-lg text-[11px] font-semibold border border-dashed border-gray-300 text-gray-500 hover:border-gray-400">
                            {isExpanded ? 'Show less' : `+${group.options.length - 10} more`}
                          </button>
                        )}
                      </div>
                      <div className="flex gap-1.5">
                        <input type="text" value={customOptionDrafts[group.id] ?? ''}
                          onChange={e => setCustomOptionDrafts(prev => ({ ...prev, [group.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomOption(group.id); } }}
                          placeholder="Add an option…"
                          className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:border-gray-400" />
                        <button type="button" onClick={() => addCustomOption(group.id)}
                          className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Per-option price adjustments — lets a costly variant (e.g. a larger
                    size or premium color) actually cost more than the base price. */}
                {variantGroups.length > 0 && (() => {
                  const allOptionRows = variantGroups.flatMap(group => group.options.map(opt => ({ group, opt })));
                  const isLong = allOptionRows.length > 10;
                  const isExpanded = expandedVariantGroups.has('price-panel');
                  const visibleRows = isLong && !isExpanded ? allOptionRows.slice(0, 10) : allOptionRows;
                  return (
                    <div className="mb-3 bg-white border border-gray-100 rounded-xl p-3">
                      <p className="text-[11px] font-semibold text-gray-700 mb-0.5">Price adjustments (optional)</p>
                      <p className="text-[10px] text-gray-400 mb-2.5">Leave blank for no change vs. the base price above. Customers see this reflected live when they pick options.</p>
                      <div className="space-y-2">
                        {visibleRows.map(({ group, opt }) => (
                          <div key={`${group.id}:${opt}`} className="flex items-center gap-2">
                            <span className="text-[11px] text-gray-500 flex-1 truncate">{group.name}: <span className="font-semibold text-gray-700">{opt}</span></span>
                            <div className="flex items-center gap-1">
                              <span className="text-[11px] text-gray-400">₦</span>
                              <input
                                type="number"
                                value={group.price_deltas?.[opt] ?? ''}
                                onChange={e => setOptionDelta(group.id, opt, e.target.value)}
                                placeholder="0"
                                className="w-24 px-2 py-1 rounded-lg border border-gray-200 text-xs text-right outline-none focus:border-gray-400"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      {isLong && (
                        <button type="button" onClick={() => toggleVariantGroupExpanded('price-panel')}
                          className="mt-2.5 w-full text-center py-1.5 rounded-lg text-[11px] font-semibold border border-dashed border-gray-300 text-gray-500 hover:border-gray-400">
                          {isExpanded ? 'Show less' : `Show all ${allOptionRows.length} options`}
                        </button>
                      )}
                    </div>
                  );
                })()}

                {/* Add a fully custom variant group — for anything not covered by color/size */}
                <div className="flex gap-1.5">
                  <input type="text" value={customGroupName}
                    onChange={e => setCustomGroupName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomGroup(); } }}
                    placeholder="Custom variant name (e.g. Material)"
                    className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-xs outline-none focus:border-gray-400" />
                  <button type="button" onClick={addCustomGroup}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-600 text-xs font-semibold flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>
              </div>

              {saveError && (
                <div className="flex items-center gap-2 text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {saveError}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={handleSave}
                  disabled={isSaving || !name || !priceAmount || imagePreviews.length === 0}
                  className="flex-1 py-2.5 bg-gray-900 hover:bg-gray-700 disabled:opacity-30 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                  {isSaving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  {editProduct ? 'Save changes' : 'Add product'}
                </button>
                <button onClick={() => setShowForm(false)}
                  className="px-4 py-2.5 border border-gray-200 text-gray-500 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Products list */}
      <div className="divide-y divide-gray-50">
        {isLoading && products.length === 0 ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="px-5 py-4 animate-pulse flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-36 bg-gray-100 rounded" />
                <div className="h-2 w-20 bg-gray-100 rounded" />
              </div>
            </div>
          ))
        ) : products.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-gray-300">No products yet. Add your first one.</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-gray-300">No products match "{searchQuery}".</p>
          </div>
        ) : (
          filteredProducts.map(p => (
            <div key={p.id} className="px-5 py-3.5 flex items-center gap-3">
              {/* Show first image; if image_urls exists show stacked hint */}
              <div className="relative flex-shrink-0">
                <img src={p.image_url} alt={p.name}
                  className="w-10 h-10 rounded-lg object-cover border border-gray-100" />
                {p.image_urls?.length > 1 && (
                  <span className="absolute -bottom-1 -right-1 text-[8px] bg-gray-800 text-white px-1 rounded-full font-bold">
                    +{p.image_urls.length - 1}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 text-sm truncate">{p.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-gray-400">¥{p.price_cny_original ?? p.price_cny}</span>
                  <span className="text-[10px] text-gray-300">→</span>
                  <span className="text-[11px] text-orange-500 font-semibold">
                    ₦{Math.round(p.price_ngn).toLocaleString()}
                  </span>
                  <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">
                    {p.category}
                  </span>
                  {p.has_variants && p.variants?.length ? (
                    <span className="text-[10px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded-full font-medium">
                      {p.variants.map(g => g.name).join(', ')}
                    </span>
                  ) : null}
                  {!!p.units_sold && (
                    <span className="text-[10px] text-gray-400">{p.units_sold.toLocaleString()} sold</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <a href={`/recommendations/${p.id}`} target="_blank" rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-300 hover:text-orange-500 transition-colors"
                  title="View on live site">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button onClick={() => openEdit(p)}
                  className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-300 hover:text-gray-600 transition-colors">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(p.id)}
                  className="p-1.5 hover:bg-red-50 rounded-lg text-gray-300 hover:text-red-400 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Main Admin Page ───────────────────────────────────────────────────────────
// ── Timed Out Orders ─────────────────────────────────────────────────────
// Orders that expired (order-reminders' 24h sweep) before admin confirmed
// payment — e.g. a manual transfer the customer claimed but nobody
// confirmed in time. Restoring puts the order straight to paid and sends
// an apology email; shipping method/address were lost on expiry (the
// failed-orders snapshot doesn't carry them), so the customer gets asked
// to set those again via hourly-then-daily reminders (order-reminders).
interface FailedOrder {
  id: string;
  code: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  total_ngn: number;
  delivery_type: 'to_qafrica' | 'to_me';
  payment_method: 'paystack' | 'manual' | null;
  failed_at: string;
  order_created_at: string;
}

function TimedOutOrdersManager({ token }: { token: string }) {
  const [orders, setOrders] = useState<FailedOrder[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${EDGE_URL}?action=admin-failed-orders`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, search: search.trim() || undefined }),
      });
      const data = await res.json();
      setOrders(data.failed_orders ?? []);
    } finally {
      setIsLoading(false);
    }
  }, [token, search]);

  useEffect(() => {
    const t = setTimeout(load, 250); // debounce search
    return () => clearTimeout(t);
  }, [load]);

  const restore = async (order: FailedOrder) => {
    setRestoringId(order.id);
    try {
      const res = await fetch(`${EDGE_URL}?action=admin-restore-failed-order`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, failed_order_id: order.id }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Could not restore this order'); return; }
      toast.success(`Order ${order.code} restored and marked paid — apology email sent`);
      setOrders(prev => prev.filter(o => o.id !== order.id));
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="bg-amber-50 border border-amber-100 rounded-xl px-3.5 py-3">
        <p className="text-xs text-amber-800 leading-relaxed">
          These orders timed out 24h after checkout because payment wasn't confirmed in time — often a manual transfer that was missed.
          Restoring sets the order to <strong>paid</strong> immediately. Shipping method and delivery address were lost when the order expired,
          so the customer will be prompted (hourly, then daily) to set those again from their dashboard.
        </p>
      </div>

      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by order code or customer name…"
        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-200 outline-none"
      />

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader className="w-5 h-5 animate-spin text-gray-300" /></div>
      ) : orders.length === 0 ? (
        <div className="text-center py-10">
          <CheckCircle2 className="w-8 h-8 text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No timed-out orders right now.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map(o => (
            <div key={o.id} className="bg-white rounded-2xl border border-gray-100 p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono font-bold text-sm text-gray-900">{o.code}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{o.customer_name}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {o.customer_email ?? 'no email'}{o.customer_phone ? ` · ${o.customer_phone}` : ''}
                  </p>
                </div>
                <span className="text-sm font-bold text-gray-900 flex-shrink-0">{fmt(o.total_ngn)}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                  {o.payment_method === 'manual' ? 'Manual transfer' : o.payment_method === 'paystack' ? 'Paystack' : 'Unknown method'}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                  {o.delivery_type === 'to_qafrica' ? 'To QAFRICA / Jumia' : 'To Customer'}
                </span>
                <span className="text-[10px] text-gray-300">timed out {timeSince(o.failed_at)}</span>
              </div>
              <button
                onClick={() => restore(o)}
                disabled={restoringId === o.id}
                className="w-full mt-3 py-2 bg-gray-900 hover:bg-gray-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5"
              >
                {restoringId === o.id ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Restore & mark paid
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Settings ──────────────────────────────────────────────────────────────
interface AdminSettings {
  paystack_enabled: boolean;
  manual_transfer_enabled: boolean;
  bank_account_number: string;
  bank_account_name: string;
  bank_name: string;
  sea_rate_ngn_per_cbm: number;
  flight_rate_ngn_per_gram: number;
  shipping_discount_percent: number;
  shipping_discount_min_ngn: number;
  bulk_discount_tier1_qty: number;
  bulk_discount_tier1_percent: number;
  bulk_discount_tier2_qty: number;
  bulk_discount_tier2_percent: number;
  charge_shipping_at_checkout: boolean;
  paystack_manual_threshold_ngn: number;
}

function SettingsManager({ token }: { token: string }) {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${EDGE_URL}?action=admin-settings`);
      const data = await res.json();
      if (data.settings) setSettings(data.settings);
    } catch {
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setField = <K extends keyof AdminSettings>(field: K, value: AdminSettings[K]) =>
    setSettings(prev => prev ? { ...prev, [field]: value } : prev);

  const handleSave = async () => {
    if (!settings) return;
    setIsSaving(true);
    setSaveError('');
    setSaved(false);
    try {
      const res = await fetch(`${EDGE_URL}?action=admin-update-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, ...settings }),
      });
      const data = await res.json();
      if (!res.ok) { setSaveError(data.error ?? 'Failed to save'); return; }
      setSettings(data.settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setSaveError(e?.message ?? 'Unexpected error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !settings) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
        <Loader className="w-5 h-5 animate-spin text-gray-300 mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Payment methods */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <p className="font-semibold text-gray-800 text-sm">Payment methods</p>

        <label className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200">
          <div>
            <p className="text-sm font-semibold text-gray-900">Paystack enabled</p>
            <p className="text-[11px] text-gray-400">Turn off to force manual transfer only, site-wide.</p>
          </div>
          <input type="checkbox" checked={settings.paystack_enabled} onChange={e => setField('paystack_enabled', e.target.checked)} className="w-4 h-4 accent-orange-500" />
        </label>

        <label className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200">
          <div>
            <p className="text-sm font-semibold text-gray-900">Manual bank transfer enabled</p>
            <p className="text-[11px] text-gray-400">Turn off to force Paystack only, site-wide.</p>
          </div>
          <input type="checkbox" checked={settings.manual_transfer_enabled} onChange={e => setField('manual_transfer_enabled', e.target.checked)} className="w-4 h-4 accent-orange-500" />
        </label>

        <div>
          <Label>Paystack / Manual threshold (₦)</Label>
          <input
            type="number" min={0} value={settings.paystack_manual_threshold_ngn}
            onChange={e => setField('paystack_manual_threshold_ngn', Number(e.target.value))}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-200 outline-none"
          />
          <p className="text-[11px] text-gray-400 mt-1">
            Orders below this amount use Paystack. Orders at or above it must use manual bank transfer.
          </p>
        </div>
      </div>

      {/* Shipping checkout behavior */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <p className="font-semibold text-gray-800 text-sm">Shipping checkout behavior</p>
        <label className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200">
          <div>
            <p className="text-sm font-semibold text-gray-900">Charge shipping at checkout</p>
            <p className="text-[11px] text-gray-400">When off, checkout doesn't add shipping to the total — bill it manually later instead.</p>
          </div>
          <input type="checkbox" checked={settings.charge_shipping_at_checkout} onChange={e => setField('charge_shipping_at_checkout', e.target.checked)} className="w-4 h-4 accent-orange-500" />
        </label>
        <p className="text-[11px] text-gray-400">
          Sea and air freight rates are managed in <strong>Pricing &amp; Shipping</strong>, which is the single source of truth for import pricing and shipping rates.
        </p>
      </div>

      {/* Shipping discount */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <p className="font-semibold text-gray-800 text-sm">Shipping discount</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Base discount (%)</Label>
            <input type="number" min={0} max={100} value={settings.shipping_discount_percent}
              onChange={e => setField('shipping_discount_percent', Number(e.target.value))}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-200 outline-none" />
          </div>
          <div>
            <Label>Minimum shipping fee to qualify (₦)</Label>
            <input type="number" min={0} value={settings.shipping_discount_min_ngn}
              onChange={e => setField('shipping_discount_min_ngn', Number(e.target.value))}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-200 outline-none" />
          </div>
        </div>
        <p className="text-[11px] text-gray-400 -mt-2">
          No discount applies at all until the cart's raw shipping cost reaches this amount.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Bulk tier 1: qty threshold</Label>
            <input type="number" min={0} value={settings.bulk_discount_tier1_qty}
              onChange={e => setField('bulk_discount_tier1_qty', Number(e.target.value))}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-200 outline-none" />
          </div>
          <div>
            <Label>Bulk tier 1: extra discount (%)</Label>
            <input type="number" min={0} max={100} value={settings.bulk_discount_tier1_percent}
              onChange={e => setField('bulk_discount_tier1_percent', Number(e.target.value))}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-200 outline-none" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Bulk tier 2: qty threshold</Label>
            <input type="number" min={0} value={settings.bulk_discount_tier2_qty}
              onChange={e => setField('bulk_discount_tier2_qty', Number(e.target.value))}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-200 outline-none" />
          </div>
          <div>
            <Label>Bulk tier 2: extra discount (%)</Label>
            <input type="number" min={0} max={100} value={settings.bulk_discount_tier2_percent}
              onChange={e => setField('bulk_discount_tier2_percent', Number(e.target.value))}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-200 outline-none" />
          </div>
        </div>
        <p className="text-[11px] text-gray-400 -mt-2">
          Cumulative: a cart with quantity ≥ tier 2 gets base + tier 1 + tier 2 all added together (e.g. defaults give 20+ units a total of +10%, on top of the base discount).
        </p>
      </div>

      {saveError && (
        <div className="flex items-center gap-2 text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {saveError}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="w-full py-3 bg-gray-900 hover:bg-gray-700 disabled:opacity-40 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        {isSaving ? <Loader className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
        {isSaving ? 'Saving…' : saved ? 'Saved' : 'Save settings'}
      </button>
    </div>
  );
}

// ── Pricing & Shipping Management ─────────────────────────────────────────
interface ImportPricingSettings {
  usd_to_ngn: number;
  cny_to_usd: number;
  sea_rate_ngn_per_cbm: number;
  air_rate_ngn_per_gram: number;
  sea_product_allocation_percent: number;
  sea_customer_percent: number;
  air_credit_enabled: boolean;
  updated_at?: string;
}

function PricingShippingManager({ token }: { token: string }) {
  const [settings, setSettings] = useState<ImportPricingSettings>({
    usd_to_ngn: 1480,
    cny_to_usd: 0.13986014,
    sea_rate_ngn_per_cbm: 0,
    air_rate_ngn_per_gram: 0,
    sea_product_allocation_percent: 80,
    sea_customer_percent: 20,
    air_credit_enabled: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`${EDGE_URL}?action=admin-pricing-settings`);
      const data = await res.json();
      if (!res.ok || !data.settings) throw new Error(data.error ?? 'Could not load pricing settings');
      setSettings({
        usd_to_ngn: Number(data.settings.usd_to_ngn),
        cny_to_usd: Number(data.settings.cny_to_usd),
        sea_rate_ngn_per_cbm: Number(data.settings.sea_rate_ngn_per_cbm),
        air_rate_ngn_per_gram: Number(data.settings.air_rate_ngn_per_gram),
        sea_product_allocation_percent: Number(data.settings.sea_product_allocation_percent),
        sea_customer_percent: Number(data.settings.sea_customer_percent),
        air_credit_enabled: Boolean(data.settings.air_credit_enabled),
        updated_at: data.settings.updated_at,
      });
    } catch (e: any) {
      setError(e?.message ?? 'Could not load pricing settings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setField = <K extends keyof ImportPricingSettings>(key: K, value: ImportPricingSettings[K]) => {
    setSaved(false);
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setError('');
    setSaved(false);

    const numericChecks: Array<[string, number, boolean]> = [
      ['USD → NGN rate', settings.usd_to_ngn, settings.usd_to_ngn > 0],
      ['CNY → USD rate', settings.cny_to_usd, settings.cny_to_usd > 0],
      ['Sea rate', settings.sea_rate_ngn_per_cbm, settings.sea_rate_ngn_per_cbm >= 0],
      ['Air rate', settings.air_rate_ngn_per_gram, settings.air_rate_ngn_per_gram >= 0],
      ['Sea product allocation', settings.sea_product_allocation_percent, settings.sea_product_allocation_percent >= 0 && settings.sea_product_allocation_percent <= 100],
      ['Sea customer percentage', settings.sea_customer_percent, settings.sea_customer_percent >= 0 && settings.sea_customer_percent <= 100],
    ];
    const invalid = numericChecks.find(([, value, ok]) => !Number.isFinite(value) || !ok);
    if (invalid) {
      setError(`${invalid[0]} must be a valid non-negative value within its allowed range.`);
      return;
    }
    if (Math.abs(settings.sea_product_allocation_percent + settings.sea_customer_percent - 100) > 0.0001) {
      setError('Sea product allocation and customer percentage must add up to 100%.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`${EDGE_URL}?action=admin-update-pricing-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, ...settings }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not save pricing settings');
      if (data.settings) {
        setSettings({
          usd_to_ngn: Number(data.settings.usd_to_ngn),
          cny_to_usd: Number(data.settings.cny_to_usd),
          sea_rate_ngn_per_cbm: Number(data.settings.sea_rate_ngn_per_cbm),
          air_rate_ngn_per_gram: Number(data.settings.air_rate_ngn_per_gram),
          sea_product_allocation_percent: Number(data.settings.sea_product_allocation_percent),
          sea_customer_percent: Number(data.settings.sea_customer_percent),
          air_credit_enabled: Boolean(data.settings.air_credit_enabled),
          updated_at: data.settings.updated_at,
        });
      }
      setSaved(true);
      toast.success('Pricing & shipping settings saved');
    } catch (e: any) {
      setError(e?.message ?? 'Could not save pricing settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="bg-white rounded-2xl border border-gray-100 py-12 flex justify-center"><Loader className="w-5 h-5 animate-spin text-gray-300" /></div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Pricing & Shipping</h2>
        <p className="text-xs text-gray-400 mt-1">These are the rates and shipping allocation rules used by the import pricing system.</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <div>
          <p className="font-semibold text-gray-800 text-sm">Currency rates</p>
          <p className="text-[11px] text-gray-400 mt-0.5">The USD → NGN rate is the main pricing conversion. CNY → USD is kept for legacy/import price conversion.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>USD → NGN</Label>
            <input type="number" min={0.0001} step="0.01" value={settings.usd_to_ngn}
              onChange={e => setField('usd_to_ngn', Number(e.target.value))}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-200 outline-none" />
            <p className="text-[10px] text-gray-400 mt-1">Example: 1 USD = ₦1,480</p>
          </div>
          <div>
            <Label>CNY → USD</Label>
            <input type="number" min={0.00000001} step="0.00000001" value={settings.cny_to_usd}
              onChange={e => setField('cny_to_usd', Number(e.target.value))}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-200 outline-none" />
            <p className="text-[10px] text-gray-400 mt-1">Example: ¥1 = $0.13986014</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <div>
          <p className="font-semibold text-gray-800 text-sm">Shipping rates</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Set the raw freight cost before the sea allocation/air credit rules are applied.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Sea rate (₦ / CBM)</Label>
            <input type="number" min={0} step="0.01" value={settings.sea_rate_ngn_per_cbm}
              onChange={e => setField('sea_rate_ngn_per_cbm', Number(e.target.value))}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-200 outline-none" />
          </div>
          <div>
            <Label>Air rate (₦ / gram)</Label>
            <input type="number" min={0} step="0.0001" value={settings.air_rate_ngn_per_gram}
              onChange={e => setField('air_rate_ngn_per_gram', Number(e.target.value))}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-200 outline-none" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <div>
          <p className="font-semibold text-gray-800 text-sm">Sea shipping allocation</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Raw sea freight is split once. The product allocation is added to product cost; the remaining percentage stays as customer sea shipping.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Moved into product cost (%)</Label>
            <input type="number" min={0} max={100} step="0.01" value={settings.sea_product_allocation_percent}
              onChange={e => setField('sea_product_allocation_percent', Number(e.target.value))}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-200 outline-none" />
          </div>
          <div>
            <Label>Remaining customer sea fee (%)</Label>
            <input type="number" min={0} max={100} step="0.01" value={settings.sea_customer_percent}
              onChange={e => setField('sea_customer_percent', Number(e.target.value))}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-200 outline-none" />
          </div>
        </div>
        <div className="rounded-xl bg-gray-50 px-4 py-3 text-[11px] text-gray-500">
          Example with 80% / 20%: if raw sea freight is ₦10,000, ₦8,000 is added to the product cost and ₦2,000 remains as the customer's sea shipping fee.
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <label className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">Use sea allocation as an air-shipping credit</p>
            <p className="text-[11px] text-gray-400 mt-0.5">When enabled, the absolute NGN amount allocated into product cost from sea freight is credited against raw air freight. It is not another percentage discount.</p>
          </div>
          <input type="checkbox" checked={settings.air_credit_enabled}
            onChange={e => setField('air_credit_enabled', e.target.checked)}
            className="w-4 h-4 accent-orange-500 flex-shrink-0" />
        </label>
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-[11px] text-blue-700">
        <p className="font-bold mb-1">Calculation rules</p>
        <p>Sea: volume × sea rate → raw sea freight → split into product allocation + customer sea fee.</p>
        <p className="mt-1">Air: weight × air rate → raw air freight → subtract the sea allocation credit when enabled → never below ₦0.</p>
        <p className="mt-1">Changing these settings does not recalculate existing products. Existing saved prices remain unchanged until a product is deliberately edited/re-saved.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      <button onClick={handleSave} disabled={isSaving}
        className="w-full py-3 bg-gray-900 hover:bg-gray-700 disabled:opacity-40 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
        {isSaving ? <Loader className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
        {isSaving ? 'Saving…' : saved ? 'Saved' : 'Save pricing & shipping settings'}
      </button>
    </div>
  );
}

// ── Custom Orders ────────────────────────────────────────────────────────
// Customer-submitted "find this for me" requests: each has one or more
// items (image, description, qty, budget). Admin attaches a store product
// link per item as they're sourced, then marks the whole request ready,
// which emails the customer and surfaces "Order now" buttons in their
// dashboard's Custom tab.
interface CustomOrderItemRow {
  id: string;
  image_url: string;
  description: string;
  quantity: number;
  estimated_budget_ngn: number | null;
  product_url: string | null;
  product_name: string | null;
}
interface CustomOrderRequestRow {
  id: string;
  status: 'pending' | 'in_progress' | 'ready';
  created_at: string;
  ready_at: string | null;
  custom_order_items: CustomOrderItemRow[];
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
}

function CustomOrdersManager({ token }: { token: string }) {
  const [requests, setRequests] = useState<CustomOrderRequestRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in_progress' | 'ready'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [linkDrafts, setLinkDrafts] = useState<Record<string, string>>({});
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [markingReadyId, setMarkingReadyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${CUSTOM_ORDERS_EDGE_URL}?action=admin-list-requests`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, status: statusFilter === 'all' ? undefined : statusFilter }),
      });
      const data = await res.json();
      setRequests(data.requests ?? []);
    } finally {
      setIsLoading(false);
    }
  }, [token, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const saveLink = async (item: CustomOrderItemRow) => {
    const url = (linkDrafts[item.id] ?? item.product_url ?? '').trim();
    if (!url) { toast.error('Paste a product link first'); return; }
    setSavingItemId(item.id);
    try {
      const res = await fetch(`${CUSTOM_ORDERS_EDGE_URL}?action=admin-set-item-link`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, item_id: item.id, product_url: url }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Could not save link'); return; }
      toast.success('Link saved');
      await load();
    } finally {
      setSavingItemId(null);
    }
  };

  const markReady = async (request: CustomOrderRequestRow) => {
    setMarkingReadyId(request.id);
    try {
      const res = await fetch(`${CUSTOM_ORDERS_EDGE_URL}?action=admin-mark-ready`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, request_id: request.id }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Could not mark ready'); return; }
      toast.success('Marked ready — customer notified');
      await load();
    } finally {
      setMarkingReadyId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {(['all', 'pending', 'in_progress', 'ready'] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors capitalize ${statusFilter === s ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 border border-gray-100'}`}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader className="w-5 h-5 animate-spin text-gray-300" /></div>
      ) : requests.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-sm text-gray-400">No custom order requests here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(r => {
            const unlinkedCount = r.custom_order_items.filter(i => !i.product_url).length;
            return (
              <div key={r.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{r.customer_name ?? 'Unknown customer'}</p>
                    <p className="text-[11px] text-gray-400 truncate">
                      {r.customer_email ?? 'no email'}{r.customer_phone ? ` · ${r.customer_phone}` : ''}
                    </p>
                    <p className="text-[10px] text-gray-300 mt-0.5">{new Date(r.created_at).toLocaleString()}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                    r.status === 'ready' ? 'bg-emerald-50 text-emerald-700' :
                    r.status === 'in_progress' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {r.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {r.custom_order_items.map(item => (
                    <div key={item.id} className="flex gap-2.5 bg-gray-50 rounded-xl p-2.5">
                      <img src={item.image_url} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border border-gray-100" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-700">{item.description}</p>
                        <p className="text-[10px] text-gray-400 mb-1.5">
                          Qty {item.quantity}{item.estimated_budget_ngn ? ` · up to ₦${Number(item.estimated_budget_ngn).toLocaleString()} each` : ''}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            defaultValue={item.product_url ?? ''}
                            onChange={e => setLinkDrafts(prev => ({ ...prev, [item.id]: e.target.value }))}
                            placeholder="Paste QAFRICA product link…"
                            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px]"
                          />
                          <button
                            onClick={() => saveLink(item)}
                            disabled={savingItemId === item.id}
                            className="flex-shrink-0 px-2.5 py-1.5 bg-gray-900 hover:bg-gray-700 disabled:opacity-40 text-white text-[10px] font-bold rounded-lg"
                          >
                            {savingItemId === item.id ? '…' : item.product_url ? 'Update' : 'Save'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {r.status !== 'ready' && (
                  <button
                    onClick={() => markReady(r)}
                    disabled={unlinkedCount > 0 || markingReadyId === r.id}
                    className="w-full mt-3 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-30 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5"
                  >
                    {markingReadyId === r.id ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    {unlinkedCount > 0 ? `${unlinkedCount} item${unlinkedCount > 1 ? 's' : ''} still need a link` : 'Mark ready & notify customer'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ImportAdminPage() {
  useImportPwaManifest();
  const { token, manager, isLegacyManager, isSupabaseAdmin, authChecked, logout } = useImportAuth();
  const { hasPermission, loading: permissionsLoading, error: permissionsError } = useImportAdminPermissions(token);
  const [tab, setTab] = useState<'analytics' | 'confirmed-payments' | 'messages' | 'broadcast' | 'orders' | 'total-orders' | 'products' | 'trending' | 'clients' | 'questions' | 'refunds' | 'paystack-transactions' | 'timed-out' | 'settings' | 'pricing-shipping' | 'custom-orders' | 'categories' | 'admin-access' | 'ai-support'>('analytics');
  // Lets TotalOrdersView route a product click straight into the Products
  // tab's edit form, and OrdersList/TotalOrdersView route a buyer click
  // into the customer detail sheet.
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);

  if (!authChecked) return null;
  if (!isLegacyManager && !isSupabaseAdmin) return null;

  const tabPermissions = {
    analytics: 'import.analytics.view',
    'confirmed-payments': 'import.confirmed_payments.view',
    messages: 'import.messages.view',
    broadcast: 'import.broadcast.view',
    orders: 'import.orders.view',
    'total-orders': 'import.total_orders.view',
    products: 'import.products.view',
    trending: 'import.trending.view',
    clients: 'import.clients.view',
    questions: 'import.questions.view',
    refunds: 'import.refunds.view',
    'paystack-transactions': 'import.paystack_transactions.view',
    'timed-out': 'import.timed_out.view',
    settings: 'import.settings.view',
    'pricing-shipping': 'import.pricing_shipping.view',
    'custom-orders': 'import.custom_orders.view',
    categories: 'import.categories.view',
    'admin-access': 'import.admin_access.view',
    'ai-support': 'import.messages.view',
  } as const;

  const allTabs = ['analytics', 'confirmed-payments', 'messages', 'broadcast', 'orders', 'total-orders', 'products', 'trending', 'clients', 'questions', 'refunds', 'paystack-transactions', 'timed-out', 'settings', 'pricing-shipping', 'custom-orders', 'categories', 'admin-access', 'ai-support'] as const;

  const visibleTabs = allTabs.filter(t => hasPermission(tabPermissions[t]));

  if (permissionsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-gray-100 p-6 text-center">
          <ShoppingBag className="w-8 h-8 mx-auto mb-3 text-gray-900" />
          <h1 className="font-bold text-gray-900 text-lg">Checking Import Admin access</h1>
          <p className="text-sm text-gray-500 mt-2">Loading your assigned Import Admin permissions…</p>
        </div>
      </div>
    );
  }

  if (!permissionsLoading && visibleTabs.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-gray-100 p-6 text-center">
          <ShoppingBag className="w-8 h-8 mx-auto mb-3 text-gray-900" />
          <h1 className="font-bold text-gray-900 text-lg">No Import Admin permissions</h1>
          <p className="text-sm text-gray-500 mt-2">
            Your platform admin account is authenticated, but no Import Admin role has been assigned to it yet.
          </p>
          {permissionsError && (
            <p className="text-xs text-red-500 mt-3">{permissionsError}</p>
          )}
          <button
            onClick={logout}
            className="mt-5 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (isSupabaseAdmin && !token) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-gray-100 p-6 text-center">
          <ShoppingBag className="w-8 h-8 mx-auto mb-3 text-gray-900" />
          <h1 className="font-bold text-gray-900 text-lg">Import Admin access</h1>
          <p className="text-sm text-gray-500 mt-2">
            Your platform admin account is authenticated. Import Admin permissions are being checked before access is enabled.
          </p>
          <button
            onClick={logout}
            className="mt-5 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  // All functional Import Admin panels still use the legacy manager token.
  // Supabase-admin access is handled separately until the server-side RBAC bridge is added.
  if (!token) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <AiSupportAlertMonitor token={token} enabled={hasPermission('import.messages.view')} />
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="flex items-center justify-between px-4 lg:px-8 py-3 max-w-3xl lg:max-w-6xl mx-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-gray-900 rounded-lg flex items-center justify-center">
              <ShoppingBag className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm leading-none">Import Admin</p>
              <p className="text-[10px] text-gray-400 leading-none mt-0.5">{manager?.full_name}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 font-medium px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </header>

      <div className="max-w-3xl lg:max-w-6xl mx-auto px-4 lg:px-8 py-5 space-y-4">
        {/* Tabs */}
        <div className="flex bg-white rounded-xl border border-gray-100 p-1 gap-1 overflow-x-auto">
          {visibleTabs.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors capitalize whitespace-nowrap ${
                tab === t
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-700'
              }`}
            >
              {t === 'total-orders' ? 'Total Orders' : t === 'confirmed-payments' ? 'Confirmed' : t === 'timed-out' ? 'Timed Out' : t === 'custom-orders' ? 'Custom Orders' : t === 'paystack-transactions' ? 'Paystack' : t === 'categories' ? 'Categories' : t === 'admin-access' ? 'Admin Access' : t === 'ai-support' ? 'AI Support' : t === 'pricing-shipping' ? 'Pricing & Shipping' : t}
            </button>
          ))}
        </div>

        {tab === 'analytics' ? (
          <ImportAdminAnalytics token={token} />
        ) : tab === 'confirmed-payments' ? (
          <ConfirmedPaymentsManager token={token} />
        ) : tab === 'messages' ? (
          <ConfirmedOrderMessagingManager token={token} />
        ) : tab === 'broadcast' ? (
          <BroadcastEmailManager token={token} />
        ) : tab === 'orders' ? (
          <>
            <LoadCodePanel token={token} />
            <OrdersList token={token} />
          </>
        ) : tab === 'total-orders' ? (
          <TotalOrdersView token={token} onOpenProduct={id => { setPendingProductId(id); setTab('products'); }} />
        ) : tab === 'products' ? (
          <ProductsManager token={token} openProductId={pendingProductId} onOpenedProduct={() => setPendingProductId(null)} />
        ) : tab === 'trending' ? (
          <TrendingManager token={token} />
        ) : tab === 'questions' ? (
          <QuestionsManager token={token} />
        ) : tab === 'refunds' ? (
          <RefundsManager token={token} />
        ) : tab === 'paystack-transactions' ? (
          <PaystackTransactions token={token} />
        ) : tab === 'timed-out' ? (
          <TimedOutOrdersManager token={token} />
        ) : tab === 'categories' ? (
          <CategoryManager token={token} />
        ) : tab === 'admin-access' ? (
          <ImportAdminAccessManager token={token} canManage={hasPermission('import.admin_access.manage')} />
        ) : tab === 'ai-support' ? (
          <AiSupportInbox token={token} />
        ) : tab === 'settings' ? (
          <SettingsManager token={token} />
        ) : tab === 'pricing-shipping' ? (
          <PricingShippingManager token={token} />
        ) : tab === 'custom-orders' ? (
          <CustomOrdersManager token={token} />
        ) : (
          <ImportAdminCustomers token={token} />
        )}
      </div>
    </div>
  );
}