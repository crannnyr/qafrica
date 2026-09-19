import { useEffect, useMemo, useState } from 'react';
import { Check, ShieldCheck, X } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { toast } from 'sonner';

interface AdminUser { id: string; full_name: string | null; email: string; }
interface ImportRole { id: string; key: string; name: string; description: string | null; is_system: boolean; }
interface Assignment { user_id: string; role_id: string; }

export default function ImportAdminAccess() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<ImportRole[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [adminsRes, rolesRes, assignmentsRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email').eq('role', 'admin').order('full_name'),
      supabase.from('import_admin_roles').select('id, key, name, description, is_system').order('name'),
      supabase.from('import_admin_user_roles').select('user_id, role_id'),
    ]);
    const error = adminsRes.error || rolesRes.error || assignmentsRes.error;
    if (error) {
      toast.error('Failed to load Import Admin access');
      setLoading(false);
      return;
    }
    setAdmins((adminsRes.data || []) as AdminUser[]);
    setRoles((rolesRes.data || []) as ImportRole[]);
    setAssignments((assignmentsRes.data || []) as Assignment[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const roleMap = useMemo(() => new Map(roles.map(role => [role.id, role])), [roles]);
  const getUserRoles = (userId: string) =>
    assignments.filter(a => a.user_id === userId).map(a => roleMap.get(a.role_id)).filter(Boolean) as ImportRole[];

  const assignRole = async () => {
    if (!selectedUserId || !selectedRoleId) return;
    if (assignments.some(a => a.user_id === selectedUserId && a.role_id === selectedRoleId)) {
      toast.info('That role is already assigned');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('import_admin_user_roles').insert({ user_id: selectedUserId, role_id: selectedRoleId });
    if (error) toast.error('Failed to assign role');
    else { toast.success('Import Admin role assigned'); setSelectedRoleId(''); await load(); }
    setSaving(false);
  };

  const removeRole = async (userId: string, roleId: string) => {
    setSaving(true);
    const { error } = await supabase.from('import_admin_user_roles').delete().eq('user_id', userId).eq('role_id', roleId);
    if (error) toast.error('Failed to remove role');
    else { toast.success('Import Admin role removed'); await load(); }
    setSaving(false);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Import Admin Access</h1>
        <p className="text-xs text-gray-500 mt-1">Assign predefined Import Admin roles to existing platform admins. No roles are assigned automatically.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}
            className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500">
            <option value="">Select an admin...</option>
            {admins.map(admin => <option key={admin.id} value={admin.id}>{admin.full_name || 'Unnamed admin'} — {admin.email}</option>)}
          </select>
          <select value={selectedRoleId} onChange={e => setSelectedRoleId(e.target.value)}
            className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500">
            <option value="">Select Import Admin role...</option>
            {roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
          </select>
          <button onClick={assignRole} disabled={!selectedUserId || !selectedRoleId || saving}
            className="px-4 py-2.5 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg disabled:opacity-50 transition-colors">
            Assign Role
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Current Import Admin Access</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">An admin may have multiple roles. Their effective access will be the combined permissions of those roles.</p>
        </div>
        {loading ? <div className="p-8 text-center text-sm text-gray-400">Loading access...</div> :
          admins.length === 0 ? <div className="p-8 text-center text-sm text-gray-400">No platform admins found.</div> :
          <div className="divide-y divide-gray-50">
            {admins.map(admin => {
              const userRoles = getUserRoles(admin.id);
              return <div key={admin.id} className="px-4 py-4 flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="flex items-center gap-3 min-w-0 lg:w-1/3">
                  <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0"><ShieldCheck className="w-4 h-4 text-orange-600" /></div>
                  <div className="min-w-0"><p className="text-sm font-medium text-gray-900 truncate">{admin.full_name || 'Unnamed admin'}</p><p className="text-xs text-gray-400 truncate">{admin.email}</p></div>
                </div>
                <div className="flex-1 flex flex-wrap gap-2">
                  {userRoles.length === 0 ? <span className="text-xs text-gray-400">No Import Admin access assigned</span> :
                    userRoles.map(role => <span key={role.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-medium" title={role.description || undefined}>
                      <Check className="w-3 h-3" />{role.name}
                      <button onClick={() => removeRole(admin.id, role.id)} disabled={saving} className="ml-0.5 p-0.5 rounded-full hover:bg-purple-100 disabled:opacity-50" aria-label={`Remove ${role.name}`}><X className="w-3 h-3" /></button>
                    </span>)
                  }
                </div>
              </div>;
            })}
          </div>
        }
      </div>
    </div>
  );
}
