import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Shield, Trash2, UserCheck, UserX, X } from 'lucide-react';
import CONFIG from '@/lib/config';
import { getManagementToken } from './ManagementAuth';
import { useImportAdminPermissions } from '@/hooks/useImportAdminPermissions';

const EDGE_URL = CONFIG.SUPABASE_URL + '/functions/v1/china-import';

type Role = { id: string; key: string; name: string; description?: string | null; is_system?: boolean; permission_ids?: string[] };
type Permission = { id: string; key: string; name: string; description?: string | null };
type Manager = {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  role_ids?: string[];
  permission_ids?: string[];
  denied_permission_ids?: string[];
  permissions?: Permission[];
  roles?: Role[];
};

async function adminRequest(token: string, action: string, body: Record<string, unknown> = {}) {
  const res = await fetch(`${EDGE_URL}?action=${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ manager_token: token, ...body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Admin access request failed');
  return data;
}

export default function ImportAdminV2Access() {
  const token = getManagementToken();
  const { loading: permissionLoading, error: permissionError, hasPermission } = useImportAdminPermissions(token);
  const canManage = hasPermission('import.admin_access.manage');

  const [managers, setManagers] = useState<Manager[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Manager | null>(null);
  const [draftPermissionIds, setDraftPermissionIds] = useState<string[]>([]);
  const [createForm, setCreateForm] = useState({ full_name: '', email: '', password: '', role_ids: [] as string[], permission_ids: [] as string[] });

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await adminRequest(token, 'admin-list-managers');
      setManagers(data.managers ?? []);
      setRoles(data.roles ?? []);
      setPermissions(data.permissions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load admin accounts');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const rolePermissionIds = useCallback((roleIds: string[]) => {
    const ids = new Set<string>();
    for (const role of roles) {
      if (roleIds.includes(role.id)) {
        for (const id of role.permission_ids ?? []) ids.add(id);
      }
    }
    return Array.from(ids);
  }, [roles]);

  const roleNameById = useMemo(() => new Map(roles.map(r => [r.id, r.name])), [roles]);

  const openManager = (manager: Manager) => {
    const roleIds = (manager.roles ?? []).map(role => role.id);
    const inherited = rolePermissionIds(roleIds);
    const denied = new Set(manager.denied_permission_ids ?? []);
    setSelected(manager);
    setDraftPermissionIds(inherited.filter(id => !denied.has(id)));
  };

  const toggleActive = async (manager: Manager) => {
    if (!canManage) return;
    if (manager.email.toLowerCase() === 'import@qafrica.store') return;
    const next = !manager.is_active;
    setActing(`active:${manager.id}`);
    try {
      await adminRequest(token!, 'admin-set-manager-status', {
        manager_id: manager.id,
        is_active: next,
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update account');
    } finally { setActing(''); }
  };

  const deleteManager = async (manager: Manager) => {
    if (!canManage) return;
    if (manager.email.toLowerCase() === 'import@qafrica.store') return;
    if (!window.confirm(`Delete ${manager.email}? This cannot be undone.`)) return;
    setActing(`delete:${manager.id}`);
    try {
      await adminRequest(token!, 'admin-delete-manager', { manager_id: manager.id });
      if (selected?.id === manager.id) setSelected(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete account');
    } finally { setActing(''); }
  };

  const assignRole = async (manager: Manager, roleId: string) => {
    if (!canManage || !roleId) return;
    setActing(`role:${manager.id}`);
    try {
      await adminRequest(token!, 'admin-assign-manager-role', { manager_id: manager.id, role_id: roleId });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not assign role');
    } finally { setActing(''); }
  };

  const removeRole = async (manager: Manager, roleId: string) => {
    if (!canManage) return;
    setActing(`role:${manager.id}`);
    try {
      await adminRequest(token!, 'admin-remove-manager-role', { manager_id: manager.id, role_id: roleId });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove role');
    } finally { setActing(''); }
  };

  const savePermissions = async () => {
    if (!selected || !canManage) return;
    setActing(`permissions:${selected.id}`);
    try {
      await adminRequest(token!, 'admin-update-manager-permissions', {
        manager_id: selected.id,
        permission_ids: draftPermissionIds,
      });
      await load();
      setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update permissions');
    } finally { setActing(''); }
  };

  const createManager = async () => {
    if (!canManage || !createForm.email.trim() || !createForm.password) return;
    setActing('create');
    setError('');
    try {
      await adminRequest(token!, 'admin-create-manager', {
        email: createForm.email.trim(),
        full_name: createForm.full_name.trim(),
        password: createForm.password,
        role_ids: createForm.role_ids,
        permission_ids: createForm.permission_ids,
      });
      setCreateForm({ full_name: '', email: '', password: '', role_ids: [], permission_ids: [] });
      setShowCreate(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create account');
    } finally { setActing(''); }
  };

  if (!token) return null;

  if (permissionLoading || loading) {
    return <div className="bg-white rounded-2xl border border-gray-100 p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-orange-500" /></div>;
  }

  if (permissionError || error) {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{permissionError || error}</div>
        <button onClick={() => void load()} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-xs font-bold">Retry</button>
      </div>
    );
  }

  if (!hasPermission('import.admin_access.view')) {
    return <div className="rounded-2xl border border-gray-200 bg-white p-6"><h2 className="text-sm font-bold text-gray-900">Admin Access permission required</h2><p className="text-xs text-gray-500 mt-1">Your manager account cannot view administrator access.</p></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-900">Admin Access</h2>
          <p className="text-xs text-gray-500 mt-1">Manage Import Admin accounts, roles and permissions.</p>
        </div>
        {canManage && (
          <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold">
            <Plus className="w-3.5 h-3.5" /> Add admin
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[900px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-gray-400 font-bold">Admin</th>
                <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-gray-400 font-bold">Roles</th>
                <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-gray-400 font-bold">Status</th>
                <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-gray-400 font-bold">Created</th>
                <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-gray-400 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {managers.map(manager => {
                const managerRoleIds = manager.roles?.map(r => r.id) ?? manager.role_ids ?? [];
                const managerRoles = manager.roles ?? managerRoleIds.map(id => ({ id, name: roleNameById.get(id) || id } as Role));
                const protectedAccount = manager.email.toLowerCase() === 'import@qafrica.store';
                return (
                  <tr key={manager.id} className="hover:bg-gray-50/70">
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-gray-900">{manager.full_name || 'Unnamed admin'}</p>
                      <p className="text-[11px] text-gray-400">{manager.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {managerRoles.length ? managerRoles.map(role => (
                          <span key={role.id} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold text-gray-600">
                            <Shield className="w-3 h-3" />{role.name}
                            {canManage && !protectedAccount && (
                              <button onClick={() => void removeRole(manager, role.id)} className="ml-0.5 text-gray-400 hover:text-red-500"><X className="w-3 h-3" /></button>
                            )}
                          </span>
                        )) : <span className="text-[11px] text-gray-400">No role assigned</span>}
                        {canManage && !protectedAccount && roles.length > managerRoles.length && (
                          <select value="" onChange={e => void assignRole(manager, e.target.value)} className="text-[10px] border border-gray-200 rounded-lg px-1.5 py-1 bg-white">
                            <option value="">+ Role</option>
                            {roles.filter(r => !managerRoleIds.includes(r.id)).map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
                          </select>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${manager.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        {manager.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(manager.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {canManage && !protectedAccount && (
                          <button title={manager.is_active ? 'Deactivate' : 'Activate'} onClick={() => void toggleActive(manager)} disabled={!!acting} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-40">
                            {manager.is_active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                          </button>
                        )}
                        {canManage && <button onClick={() => openManager(manager)} className="px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-[10px] font-bold">Permissions</button>}
                        {canManage && !protectedAccount && (
                          <button title="Delete" onClick={() => void deleteManager(manager)} disabled={!!acting} className="p-2 rounded-lg hover:bg-red-50 text-red-400 disabled:opacity-40">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {managers.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400">No admin accounts found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5">
            <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-gray-900">Add admin</h3><button onClick={() => setShowCreate(false)}><X className="w-4 h-4 text-gray-400" /></button></div>
            <div className="space-y-3">
              <input value={createForm.full_name} onChange={e => setCreateForm(v => ({ ...v, full_name: e.target.value }))} placeholder="Full name" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none" />
              <input type="email" value={createForm.email} onChange={e => setCreateForm(v => ({ ...v, email: e.target.value }))} placeholder="Email" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none" />
              <input type="password" value={createForm.password} onChange={e => setCreateForm(v => ({ ...v, password: e.target.value }))} placeholder="Temporary password" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none" />
              <div className="border border-gray-200 rounded-xl p-3">
                <p className="text-[11px] font-bold text-gray-700 mb-2">Roles</p>
                <div className="space-y-2">
                  {roles.map(role => {
                    const checked = createForm.role_ids.includes(role.id);
                    return <label key={role.id} className="flex items-start gap-2 text-[10px] text-gray-600">
                      <input type="checkbox" checked={checked} onChange={e => {
                        const roleIds = e.target.checked ? [...createForm.role_ids, role.id] : createForm.role_ids.filter(id => id !== role.id);
                        const inherited = rolePermissionIds(roleIds);
                        setCreateForm(v => ({ ...v, role_ids: roleIds, permission_ids: inherited }));
                      }} className="mt-0.5 accent-orange-500" />
                      <span><span className="font-semibold text-gray-800 block">{role.name}</span><span className="text-gray-400">{role.description || role.key}</span></span>
                    </label>;
                  })}
                </div>
              </div>
              <div className="border border-gray-200 rounded-xl p-3">
                <p className="text-[11px] font-bold text-gray-700 mb-2">Direct permissions</p>
                <div className="grid sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto">
                  {permissions.map(permission => {
                    const checked = createForm.permission_ids.includes(permission.id);
                    return <label key={permission.id} className="flex items-start gap-2 text-[10px] text-gray-600"><input type="checkbox" checked={checked} onChange={e => setCreateForm(v => ({ ...v, permission_ids: e.target.checked ? [...v.permission_ids, permission.id] : v.permission_ids.filter(id => id !== permission.id) }))} className="mt-0.5 accent-orange-500" /><span>{permission.name || permission.key}</span></label>;
                  })}
                </div>
              </div>
              <button onClick={() => void createManager()} disabled={acting === 'create'} className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-bold disabled:opacity-40">{acting === 'create' ? 'Creating…' : 'Create admin'}</button>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5">
            <div className="flex items-center justify-between mb-1"><h3 className="font-bold text-gray-900">Permissions</h3><button onClick={() => setSelected(null)}><X className="w-4 h-4 text-gray-400" /></button></div>
            <p className="text-xs text-gray-400 mb-4">{selected.full_name || selected.email}</p>
            <div className="mb-4 border border-gray-100 rounded-xl p-3">
              <p className="text-[11px] font-bold text-gray-700 mb-2">Selected roles</p>
              <div className="flex flex-wrap gap-1.5">
                {(selected.roles ?? []).map(role => <span key={role.id} className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold text-gray-600">{role.name}</span>)}
              </div>
              <p className="text-[10px] text-gray-400 mt-2">Permissions below are inherited from these roles. Uncheck one to deny it for this admin.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto">
              {permissions.map(permission => {
                const inherited = rolePermissionIds((selected.roles ?? []).map(role => role.id)).includes(permission.id);
                if (!inherited) return null;
                const checked = draftPermissionIds.includes(permission.id);
                return <label key={permission.id} className="flex items-start gap-2 rounded-xl border border-gray-100 p-2.5 text-[10px] text-gray-600">
                  <input type="checkbox" checked={checked} onChange={e => setDraftPermissionIds(v => e.target.checked ? [...v, permission.id] : v.filter(id => id !== permission.id))} className="mt-0.5 accent-orange-500" />
                  <span><span className="font-semibold text-gray-800 block">{permission.name || permission.key}</span><span className="text-gray-400">{permission.key}</span></span>
                </label>;
              })}
            </div>
            <div className="flex justify-end gap-2 mt-4"><button onClick={() => setSelected(null)} className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600">Cancel</button><button onClick={() => void savePermissions()} disabled={!!acting} className="px-4 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold disabled:opacity-40">{acting === `permissions:${selected.id}` ? 'Saving…' : 'Save permissions'}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
